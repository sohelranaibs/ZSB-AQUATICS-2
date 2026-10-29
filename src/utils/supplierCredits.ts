import {
  PurchaseRecord,
  SupplierCreditApplication,
  SupplierCreditReason,
  SupplierCreditRecord,
  SupplierCreditStatus,
} from '../types/index.ts';
import { generateRecordId } from './idGenerator.ts';

export const SUPPLIER_CREDIT_REASONS: SupplierCreditReason[] = [
  'Weight Shortage / Shrinkage',
  'Mortality / DOA Claim',
  'Grade / Quality Discount',
  'Overcharge Adjustment',
  'Volume Rebate / Loyalty Credit',
  'Returned Consignment',
  'Other Credit Note',
];

export interface SupplierCreditVendorSummary {
  supplierName: string;
  totalIssued: number;
  totalApplied: number;
  availableBalance: number;
  openNotesCount: number;
  totalNotesCount: number;
  openCreditNotes: SupplierCreditRecord[];
  allCreditNotes: SupplierCreditRecord[];
}

export interface SupplierCreditSummary {
  totalCreditsCount: number;
  totalIssuedAmount: number;
  totalAppliedAmount: number;
  totalAvailableAmount: number;
  openCreditsCount: number;
  appliedCreditsCount: number;
  grossPurchasingCost: number;
  netPurchasingAfterIssuedCredits: number;
  netPurchasingAfterAppliedCredits: number;
  bySupplier: SupplierCreditVendorSummary[];
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Generates sequential credit note numbers (e.g., CN-2026-0001).
 */
export function generateCreditNoteNumber(
  existingCount: number,
  year: number = new Date().getFullYear()
): string {
  const nextNum = Math.max(1, Math.floor(Number(existingCount) || 0) + 1)
    .toString()
    .padStart(4, '0');
  return `CN-${year}-${nextNum}`;
}

/**
 * Computes normalized appliedAmount, remainingAmount, and status for a credit note.
 */
export function computeCreditNoteStatus(
  amount: number,
  appliedAmount: number
): {
  amount: number;
  appliedAmount: number;
  remainingAmount: number;
  status: SupplierCreditStatus;
} {
  const safeAmount = Math.max(0, round2(amount));
  const safeApplied = Math.min(safeAmount, Math.max(0, round2(appliedAmount)));
  const remainingAmount = round2(Math.max(0, safeAmount - safeApplied));

  let status: SupplierCreditStatus = 'AVAILABLE';
  if (safeAmount > 0 && remainingAmount === 0) {
    status = 'APPLIED';
  } else if (safeApplied > 0 && remainingAmount > 0) {
    status = 'PARTIAL';
  }

  return {
    amount: safeAmount,
    appliedAmount: safeApplied,
    remainingAmount,
    status,
  };
}

/**
 * Builds a validated SupplierCreditRecord from form inputs.
 */
export function createSupplierCreditRecord(
  input: {
    id?: string;
    creditNoteNumber?: string;
    date: string;
    supplierName: string;
    refPurchaseInvoice?: string;
    reason?: string;
    amount: number;
    appliedAmount?: number;
    applications?: SupplierCreditApplication[];
    remarks?: string;
    createdAt?: string;
  },
  existingCount: number = 0
): SupplierCreditRecord {
  const computed = computeCreditNoteStatus(
    input.amount,
    input.appliedAmount || 0
  );
  const cleanSupplier = (input.supplierName || '').trim().toUpperCase();
  const cleanDate =
    (input.date || '').trim() || new Date().toISOString().slice(0, 10);

  return {
    id: input.id || generateRecordId('cn'),
    creditNoteNumber:
      (input.creditNoteNumber || '').trim() ||
      generateCreditNoteNumber(existingCount),
    date: cleanDate,
    supplierName: cleanSupplier || 'UNSPECIFIED SUPPLIER',
    refPurchaseInvoice: (input.refPurchaseInvoice || '').trim() || undefined,
    reason: (input.reason || '').trim() || SUPPLIER_CREDIT_REASONS[0],
    amount: computed.amount,
    appliedAmount: computed.appliedAmount,
    remainingAmount: computed.remainingAmount,
    status: computed.status,
    applications: Array.isArray(input.applications)
      ? [...input.applications]
      : [],
    remarks: (input.remarks || '').trim() || undefined,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

/**
 * Applies a credit amount to a single SupplierCreditRecord, clamping to remainingAmount.
 */
export function applySupplierCreditNote(
  credit: SupplierCreditRecord,
  application: {
    id?: string;
    amount: number;
    date?: string;
    targetPaymentInvoice?: string;
    targetPurchaseInvoice?: string;
    notes?: string;
  }
): {
  updatedCredit: SupplierCreditRecord;
  appliedDelta: number;
} {
  const requested = Math.max(0, round2(application.amount));
  const currentStatus = computeCreditNoteStatus(
    credit.amount,
    credit.appliedAmount
  );
  const appliedDelta = round2(
    Math.min(requested, currentStatus.remainingAmount)
  );

  if (appliedDelta <= 0) {
    return {
      updatedCredit: {
        ...credit,
        ...currentStatus,
      },
      appliedDelta: 0,
    };
  }

  const nextStatus = computeCreditNoteStatus(
    credit.amount,
    currentStatus.appliedAmount + appliedDelta
  );

  const newApp: SupplierCreditApplication = {
    id: application.id || generateRecordId('cnapp'),
    date:
      (application.date || '').trim() || new Date().toISOString().slice(0, 10),
    amount: appliedDelta,
    targetPaymentInvoice:
      (application.targetPaymentInvoice || '').trim() || undefined,
    targetPurchaseInvoice:
      (application.targetPurchaseInvoice || '').trim() || undefined,
    notes: (application.notes || '').trim() || undefined,
  };

  return {
    updatedCredit: {
      ...credit,
      appliedAmount: nextStatus.appliedAmount,
      remainingAmount: nextStatus.remainingAmount,
      status: nextStatus.status,
      applications: [...(credit.applications || []), newApp],
    },
    appliedDelta,
  };
}

/**
 * Applies a credit amount against a specific credit note or FIFO across a supplier's
 * available credit notes when recording/applying a supplier payment.
 */
export function applyCreditAmountAcrossSupplierNotes(
  credits: SupplierCreditRecord[],
  supplierName: string,
  amountToApply: number,
  meta: {
    date?: string;
    targetPaymentInvoice?: string;
    targetPurchaseInvoice?: string;
    notes?: string;
    specificCreditId?: string;
  } = {}
): {
  updatedCredits: SupplierCreditRecord[];
  totalApplied: number;
  affectedCreditNotes: string[];
} {
  const safeCredits = Array.isArray(credits) ? credits : [];
  const normSupplier = (supplierName || '').trim().toLowerCase();
  let remainingToApply = Math.max(0, round2(amountToApply));

  if (!normSupplier || remainingToApply <= 0) {
    return {
      updatedCredits: safeCredits,
      totalApplied: 0,
      affectedCreditNotes: [],
    };
  }

  const affectedCreditNotes: string[] = [];
  let totalApplied = 0;

  // Determine priority order: specificCreditId first (if provided), then oldest date first (FIFO)
  const matchingOpenIds = safeCredits
    .filter(
      (cn) =>
        cn.supplierName.trim().toLowerCase() === normSupplier &&
        computeCreditNoteStatus(cn.amount, cn.appliedAmount).remainingAmount > 0
    )
    .sort((a, b) => {
      if (meta.specificCreditId) {
        if (a.id === meta.specificCreditId) return -1;
        if (b.id === meta.specificCreditId) return 1;
      }
      return (a.date || '').localeCompare(b.date || '');
    })
    .map((cn) => cn.id);

  const updatesById = new Map<string, SupplierCreditRecord>();
  const creditMap = new Map<string, SupplierCreditRecord>(
    safeCredits.map((c) => [c.id, c])
  );

  for (const id of matchingOpenIds) {
    if (remainingToApply <= 0) break;
    const target = creditMap.get(id);
    if (!target) continue;

    const { updatedCredit, appliedDelta } = applySupplierCreditNote(target, {
      amount: remainingToApply,
      date: meta.date,
      targetPaymentInvoice: meta.targetPaymentInvoice,
      targetPurchaseInvoice: meta.targetPurchaseInvoice,
      notes: meta.notes,
    });

    if (appliedDelta > 0) {
      updatesById.set(id, updatedCredit);
      remainingToApply = round2(Math.max(0, remainingToApply - appliedDelta));
      totalApplied = round2(totalApplied + appliedDelta);
      affectedCreditNotes.push(updatedCredit.creditNoteNumber);
    }
  }

  const updatedCredits = safeCredits.map((cn) => updatesById.get(cn.id) || cn);

  return {
    updatedCredits,
    totalApplied,
    affectedCreditNotes,
  };
}

/**
 * Aggregates supplier credit metrics across all suppliers and computes net purchasing impact.
 */
export function calculateSupplierCreditSummary(
  credits: SupplierCreditRecord[],
  purchases: PurchaseRecord[] = []
): SupplierCreditSummary {
  const safeCredits = Array.isArray(credits) ? credits : [];
  const safePurchases = Array.isArray(purchases) ? purchases : [];

  let totalIssuedAmount = 0;
  let totalAppliedAmount = 0;
  let totalAvailableAmount = 0;
  let openCreditsCount = 0;
  let appliedCreditsCount = 0;

  const vendorMap = new Map<string, SupplierCreditVendorSummary>();

  for (const rawCn of safeCredits) {
    const normalized = computeCreditNoteStatus(
      rawCn.amount,
      rawCn.appliedAmount
    );
    const cn: SupplierCreditRecord = {
      ...rawCn,
      ...normalized,
    };

    totalIssuedAmount = round2(totalIssuedAmount + cn.amount);
    totalAppliedAmount = round2(totalAppliedAmount + cn.appliedAmount);
    totalAvailableAmount = round2(totalAvailableAmount + cn.remainingAmount);

    if (cn.status === 'APPLIED') {
      appliedCreditsCount += 1;
    } else if (cn.remainingAmount > 0) {
      openCreditsCount += 1;
    }

    const cleanName =
      (cn.supplierName || '').trim().toUpperCase() || 'UNSPECIFIED SUPPLIER';
    const key = cleanName.toLowerCase();

    let bucket = vendorMap.get(key);
    if (!bucket) {
      bucket = {
        supplierName: cleanName,
        totalIssued: 0,
        totalApplied: 0,
        availableBalance: 0,
        openNotesCount: 0,
        totalNotesCount: 0,
        openCreditNotes: [],
        allCreditNotes: [],
      };
      vendorMap.set(key, bucket);
    }

    bucket.totalIssued = round2(bucket.totalIssued + cn.amount);
    bucket.totalApplied = round2(bucket.totalApplied + cn.appliedAmount);
    bucket.availableBalance = round2(
      bucket.availableBalance + cn.remainingAmount
    );
    bucket.totalNotesCount += 1;
    bucket.allCreditNotes.push(cn);
    if (cn.remainingAmount > 0) {
      bucket.openNotesCount += 1;
      bucket.openCreditNotes.push(cn);
    }
  }

  const bySupplier = Array.from(vendorMap.values()).sort((a, b) => {
    if (b.availableBalance !== a.availableBalance) {
      return b.availableBalance - a.availableBalance;
    }
    if (b.totalIssued !== a.totalIssued) {
      return b.totalIssued - a.totalIssued;
    }
    return a.supplierName.localeCompare(b.supplierName);
  });

  const grossPurchasingCost = round2(
    safePurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0)
  );
  const netPurchasingAfterIssuedCredits = round2(
    Math.max(0, grossPurchasingCost - totalIssuedAmount)
  );
  const netPurchasingAfterAppliedCredits = round2(
    Math.max(0, grossPurchasingCost - totalAppliedAmount)
  );

  return {
    totalCreditsCount: safeCredits.length,
    totalIssuedAmount,
    totalAppliedAmount,
    totalAvailableAmount,
    openCreditsCount,
    appliedCreditsCount,
    grossPurchasingCost,
    netPurchasingAfterIssuedCredits,
    netPurchasingAfterAppliedCredits,
    bySupplier,
  };
}

/**
 * Returns credit summary and open credit notes for a specific supplier name.
 */
export function getSupplierCreditProfile(
  credits: SupplierCreditRecord[],
  supplierName: string
): SupplierCreditVendorSummary {
  const cleanName = (supplierName || '').trim().toUpperCase();
  const key = cleanName.toLowerCase();
  const summary = calculateSupplierCreditSummary(credits);
  const match = summary.bySupplier.find(
    (s) => s.supplierName.toLowerCase() === key
  );

  if (match) return match;

  return {
    supplierName: cleanName,
    totalIssued: 0,
    totalApplied: 0,
    availableBalance: 0,
    openNotesCount: 0,
    totalNotesCount: 0,
    openCreditNotes: [],
    allCreditNotes: [],
  };
}
