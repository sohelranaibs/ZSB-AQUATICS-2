import {
  ExporterStatus,
  PaymentRecord,
  PurchaseRecord,
  SupplierCreditRecord,
} from '../types/index.ts';
import {
  SupplierRecordHistoryRow,
  SupplierRecordType,
  normalizeSupplierStatus,
} from './supplierHistory.ts';

export interface LedgerEditFormValues {
  date: string;
  invoiceNumber: string;
  supplierName: string;
  debitAmount: string;
  creditAmount: string;
  status: ExporterStatus;
  remarks: string;
}

export interface ResolvedLedgerRowSource {
  row: SupplierRecordHistoryRow;
  recordType: SupplierRecordType;
  recordId: string;
  purchase?: PurchaseRecord;
  payment?: PaymentRecord;
  creditNote?: SupplierCreditRecord;
  initialValues: LedgerEditFormValues;
}

export interface LedgerEditValidationResult {
  valid: boolean;
  error?: string;
  parsedDebit: number;
  parsedCredit: number;
  computedBalance: number;
  normalizedDate: string;
  normalizedSupplier: string;
  normalizedInvoice: string;
  normalizedStatus: ExporterStatus;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolves a row from the Supplier Account Reconciliation Ledger back to its
 * authoritative PurchaseRecord, PaymentRecord, or SupplierCreditRecord and
 * returns pre-populated form values for editing.
 */
export function resolveLedgerRowSource(
  row: SupplierRecordHistoryRow,
  purchases: PurchaseRecord[],
  payments: PaymentRecord[],
  supplierCredits: SupplierCreditRecord[]
): ResolvedLedgerRowSource | null {
  if (row.recordType === 'PURCHASE_BILL') {
    const recordId = row.id.replace(/^purchase-/, '');
    const purchase = purchases.find((p) => p.id === recordId);
    if (!purchase) return null;

    return {
      row,
      recordType: 'PURCHASE_BILL',
      recordId: purchase.id,
      purchase,
      initialValues: {
        date: purchase.date || row.date || '',
        invoiceNumber: purchase.invoiceNumber || row.invoiceNumber || '',
        supplierName: purchase.description || row.supplierName || '',
        debitAmount: String(round2(Number(purchase.totalAmount) || 0)),
        creditAmount: String(round2(Number(purchase.paidAmount) || 0)),
        status: normalizeSupplierStatus(purchase.status || row.status, 'REPORT'),
        remarks: purchase.remarks || '',
      },
    };
  }

  if (row.recordType === 'PAYMENT_VOUCHER') {
    const recordId = row.paymentId || row.id.replace(/^voucher-/, '');
    const payment = payments.find((pm) => pm.id === recordId);
    if (!payment) return null;

    return {
      row,
      recordType: 'PAYMENT_VOUCHER',
      recordId: payment.id,
      payment,
      initialValues: {
        date: payment.date || row.date || '',
        invoiceNumber: payment.invoiceNumber || row.invoiceNumber || '',
        supplierName: payment.description || row.supplierName || '',
        debitAmount: String(round2(Number(row.debitAmount) || 0)),
        creditAmount: String(round2(Number(payment.paidAmount) || Number(row.creditAmount) || 0)),
        status: normalizeSupplierStatus(payment.status || row.status, 'PAID'),
        remarks: payment.remarks || '',
      },
    };
  }

  if (row.recordType === 'CREDIT_NOTE') {
    const recordId = row.id.replace(/^credit-/, '');
    const creditNote = supplierCredits.find((cn) => cn.id === recordId);
    if (!creditNote) return null;

    return {
      row,
      recordType: 'CREDIT_NOTE',
      recordId: creditNote.id,
      creditNote,
      initialValues: {
        date: creditNote.date || row.date || '',
        invoiceNumber: creditNote.creditNoteNumber || row.invoiceNumber || '',
        supplierName: creditNote.supplierName || row.supplierName || '',
        debitAmount: '0',
        creditAmount: String(round2(Number(creditNote.amount) || 0)),
        status: creditNote.remainingAmount === 0 ? 'PAID' : 'REPORT',
        remarks: creditNote.remarks || creditNote.reason || '',
      },
    };
  }

  return null;
}

/**
 * Validates and parses the edited ledger form fields.
 */
export function validateLedgerEditForm(
  values: LedgerEditFormValues,
  recordType: SupplierRecordType
): LedgerEditValidationResult {
  const normalizedDate = (values.date || '').trim();
  const normalizedSupplier = (values.supplierName || '').trim();
  const normalizedInvoice = (values.invoiceNumber || '').trim();
  const normalizedStatus = (values.status || 'REPORT').trim().toUpperCase();

  const rawDebit = (values.debitAmount ?? '').toString().trim();
  const rawCredit = (values.creditAmount ?? '').toString().trim();

  const parsedDebit = recordType === 'CREDIT_NOTE' ? 0 : rawDebit === '' ? 0 : Number(rawDebit);
  const parsedCredit = rawCredit === '' ? 0 : Number(rawCredit);

  if (!ISO_DATE_RE.test(normalizedDate)) {
    return {
      valid: false,
      error: 'Please enter a valid date in YYYY-MM-DD format.',
      parsedDebit: 0,
      parsedCredit: 0,
      computedBalance: 0,
      normalizedDate,
      normalizedSupplier,
      normalizedInvoice,
      normalizedStatus,
    };
  }

  if (!normalizedSupplier) {
    return {
      valid: false,
      error: 'Supplier name is required.',
      parsedDebit: 0,
      parsedCredit: 0,
      computedBalance: 0,
      normalizedDate,
      normalizedSupplier,
      normalizedInvoice,
      normalizedStatus,
    };
  }

  if (!normalizedInvoice) {
    return {
      valid: false,
      error: 'Invoice / Voucher number is required.',
      parsedDebit: 0,
      parsedCredit: 0,
      computedBalance: 0,
      normalizedDate,
      normalizedSupplier,
      normalizedInvoice,
      normalizedStatus,
    };
  }

  if (!Number.isFinite(parsedDebit) || parsedDebit < 0) {
    return {
      valid: false,
      error: 'Debit amount must be a valid number greater than or equal to 0.',
      parsedDebit: 0,
      parsedCredit: 0,
      computedBalance: 0,
      normalizedDate,
      normalizedSupplier,
      normalizedInvoice,
      normalizedStatus,
    };
  }

  if (!Number.isFinite(parsedCredit) || parsedCredit < 0) {
    return {
      valid: false,
      error: 'Credit amount must be a valid number greater than or equal to 0.',
      parsedDebit: 0,
      parsedCredit: 0,
      computedBalance: 0,
      normalizedDate,
      normalizedSupplier,
      normalizedInvoice,
      normalizedStatus,
    };
  }

  if (recordType === 'CREDIT_NOTE' && parsedCredit <= 0) {
    return {
      valid: false,
      error: 'Credit Note amount must be greater than 0.',
      parsedDebit: 0,
      parsedCredit: 0,
      computedBalance: 0,
      normalizedDate,
      normalizedSupplier,
      normalizedInvoice,
      normalizedStatus,
    };
  }

  const cleanDebit = round2(parsedDebit);
  const cleanCredit = round2(parsedCredit);

  return {
    valid: true,
    parsedDebit: cleanDebit,
    parsedCredit: cleanCredit,
    computedBalance: round2(cleanDebit - cleanCredit),
    normalizedDate,
    normalizedSupplier,
    normalizedInvoice,
    normalizedStatus,
  };
}

function clearResolvedPendingFields(
  pendingFields: string[] | undefined,
  rawValues: Record<string, string> | undefined,
  clearedKeys: string[]
): {
  pendingFields: string[] | undefined;
  rawValues: Record<string, string> | undefined;
  calculationPending: boolean;
} {
  const clearedSet = new Set(clearedKeys);
  const nextPending = (pendingFields || []).filter((k) => !clearedSet.has(k));
  const nextRaw: Record<string, string> = { ...(rawValues || {}) };
  for (const key of clearedKeys) {
    delete nextRaw[key];
  }
  return {
    pendingFields: nextPending.length > 0 ? nextPending : undefined,
    rawValues: Object.keys(nextRaw).length > 0 ? nextRaw : undefined,
    calculationPending: nextPending.length > 0,
  };
}

/**
 * Builds the PurchaseRecord partial update from an edited Supplier Reconciliation Ledger row.
 */
export function buildPurchaseUpdateFromLedgerEdit(
  existing: PurchaseRecord,
  validated: LedgerEditValidationResult,
  remarks: string
): Partial<PurchaseRecord> {
  const prevAmount = Number(existing.previousAmount) || 0;
  const nextTotal = validated.parsedDebit;
  const nextPaid = validated.parsedCredit;
  const nextBalance = round2(nextTotal + prevAmount - nextPaid);

  let updatedItems = existing.items;
  if (Array.isArray(existing.items) && existing.items.length === 1) {
    const item = existing.items[0];
    const qty = Number(item.quantity) || 0;
    const nextRate = qty > 0 ? round2(nextTotal / qty) : nextTotal;
    updatedItems = [
      {
        ...item,
        rate: nextRate,
        totalAmount: nextTotal,
        paidAmount: nextPaid,
        balance: nextBalance,
      },
    ];
  } else if (Array.isArray(existing.items) && existing.items.length > 1) {
    const oldItemsSum = existing.items.reduce(
      (sum, it) => sum + (Number(it.totalAmount) || 0),
      0
    );
    const diff = round2(nextTotal - oldItemsSum);
    updatedItems = existing.items.map((item, idx) => {
      const adjustedTotal =
        idx === existing.items.length - 1 && Math.abs(diff) > 0.001
          ? Math.max(0, round2((Number(item.totalAmount) || 0) + diff))
          : item.totalAmount;
      const qty = Number(item.quantity) || 0;
      const adjustedRate =
        idx === existing.items.length - 1 && Math.abs(diff) > 0.001 && qty > 0
          ? round2(adjustedTotal / qty)
          : item.rate;
      return idx === 0
        ? {
            ...item,
            rate: adjustedRate,
            totalAmount: adjustedTotal,
            paidAmount: nextPaid,
            balance: nextBalance,
          }
        : {
            ...item,
            rate: adjustedRate,
            totalAmount: adjustedTotal,
          };
    });
  }

  const pendingMeta = clearResolvedPendingFields(
    existing.pendingFields,
    existing.rawValues,
    ['date', 'invoiceNumber', 'description', 'totalAmount', 'paidAmount', 'balance', 'remarks']
  );

  return {
    date: validated.normalizedDate,
    invoiceNumber: validated.normalizedInvoice,
    description: validated.normalizedSupplier,
    totalAmount: nextTotal,
    paidAmount: nextPaid,
    balance: nextBalance,
    status: validated.normalizedStatus,
    remarks: remarks.trim(),
    items: updatedItems,
    ...pendingMeta,
  };
}

/**
 * Builds the PaymentRecord partial update from an edited Supplier Reconciliation Ledger row.
 * Keeps standalone debit items synchronized with buildSupplierRecordHistory().
 */
export function buildPaymentUpdateFromLedgerEdit(
  existing: PaymentRecord,
  validated: LedgerEditValidationResult,
  remarks: string
): Partial<PaymentRecord> {
  const nextDebit = validated.parsedDebit;
  const nextCredit = validated.parsedCredit;
  const nextBalance = round2(nextDebit - nextCredit);

  const existingItems = Array.isArray(existing.items) ? existing.items : [];
  const standaloneItems = existingItems.filter(
    (i) =>
      !String(i.id || '').startsWith('pur-') &&
      !String(i.id || '').startsWith('pay-') &&
      !String(i.id || '').startsWith('cn-')
  );
  const linkedItems = existingItems.filter(
    (i) =>
      String(i.id || '').startsWith('pur-') ||
      String(i.id || '').startsWith('pay-') ||
      String(i.id || '').startsWith('cn-')
  );

  let updatedItems = existingItems;
  let nextExportGoodsRef = existing.exportGoodsRef;

  if (nextDebit > 0) {
    // Ensure standalone item holds the edited debit amount so buildSupplierRecordHistory reflects it
    nextExportGoodsRef = undefined;
    if (standaloneItems.length > 0) {
      const updatedStandalone = standaloneItems.map((it, idx) =>
        idx === 0
          ? {
              ...it,
              date: validated.normalizedDate,
              invoiceNumber: validated.normalizedInvoice,
              description: it.description || `Supplier Adjustment (${validated.normalizedSupplier})`,
              debitAmount: nextDebit,
              creditAmount: nextCredit,
              balance: nextBalance,
              status: validated.normalizedStatus,
            }
          : {
              ...it,
              debitAmount: 0,
              creditAmount: 0,
            }
      );
      updatedItems = [...updatedStandalone, ...linkedItems];
    } else {
      updatedItems = [
        {
          id: `adj-${existing.id}`,
          invoiceNumber: validated.normalizedInvoice,
          date: validated.normalizedDate,
          description: `Supplier Ledger Entry (${validated.normalizedSupplier})`,
          debitAmount: nextDebit,
          creditAmount: nextCredit,
          balance: nextBalance,
          status: validated.normalizedStatus,
        },
        ...linkedItems,
      ];
    }
  } else {
    // Debit is 0: zero out standalone debits while keeping creditAmount synced
    if (standaloneItems.length > 0) {
      const updatedStandalone = standaloneItems.map((it, idx) =>
        idx === 0
          ? {
              ...it,
              date: validated.normalizedDate,
              invoiceNumber: validated.normalizedInvoice,
              debitAmount: 0,
              creditAmount: nextCredit,
              balance: nextBalance,
              status: validated.normalizedStatus,
            }
          : {
              ...it,
              debitAmount: 0,
              creditAmount: 0,
            }
      );
      updatedItems = [...updatedStandalone, ...linkedItems];
    }
  }

  const pendingMeta = clearResolvedPendingFields(
    existing.pendingFields,
    existing.rawValues,
    ['date', 'invoiceNumber', 'description', 'totalAmount', 'paidAmount', 'balance', 'remarks']
  );

  return {
    date: validated.normalizedDate,
    invoiceNumber: validated.normalizedInvoice,
    description: validated.normalizedSupplier,
    totalAmount: nextDebit > 0 ? nextDebit : existing.totalAmount,
    paidAmount: nextCredit,
    balance: nextBalance,
    status: validated.normalizedStatus,
    remarks: remarks.trim(),
    exportGoodsRef: nextExportGoodsRef,
    items: updatedItems,
    ...pendingMeta,
  };
}

/**
 * Builds the SupplierCreditRecord partial update from an edited Supplier Reconciliation Ledger row.
 */
export function buildSupplierCreditUpdateFromLedgerEdit(
  existing: SupplierCreditRecord,
  validated: LedgerEditValidationResult,
  remarks: string
): Partial<SupplierCreditRecord> {
  const nextAmount = validated.parsedCredit;
  const clampedApplied =
    validated.normalizedStatus === 'PAID'
      ? nextAmount
      : Math.min(nextAmount, round2(Number(existing.appliedAmount) || 0));
  const nextRemaining = Math.max(0, round2(nextAmount - clampedApplied));
  const nextCreditStatus =
    nextRemaining === 0 ? 'APPLIED' : clampedApplied > 0 ? 'PARTIAL' : 'AVAILABLE';

  return {
    date: validated.normalizedDate,
    creditNoteNumber: validated.normalizedInvoice,
    supplierName: validated.normalizedSupplier,
    amount: nextAmount,
    appliedAmount: clampedApplied,
    remainingAmount: nextRemaining,
    status: nextCreditStatus,
    remarks: remarks.trim(),
  };
}
