import { PurchaseRecord, PaymentRecord } from '../types/index.ts';
import { classifyPaymentCategory } from './calculations.ts';

export type PurchaseReconciliationStatus =
  | 'RECONCILED'
  | 'MISSING_VOUCHER'
  | 'AMOUNT_MISMATCH'
  | 'BALANCE_MISMATCH'
  | 'UNPAID_PENDING';

export type PaymentReconciliationStatus =
  | 'RECONCILED'
  | 'AMOUNT_MISMATCH'
  | 'BALANCE_MISMATCH'
  | 'UNLINKED_VOUCHER'
  | 'EXPORTER_LEDGER';

export interface PurchaseReconciliationItem {
  purchaseId: string;
  invoiceNumber: string;
  supplierName: string;
  date: string;
  status: PurchaseReconciliationStatus;
  label: string;
  hasDiscrepancy: boolean;
  challanTotalAmount: number;
  challanPaidAmount: number;
  voucherPaidAmount: number;
  discrepancyAmount: number;
  expectedBalance: number;
  recordedBalance: number;
  matchedPaymentIds: string[];
  matchedPaymentInvoices: string[];
  summaryText: string;
  resolutionLabel: string;
}

export interface PaymentReconciliationItem {
  paymentId: string;
  invoiceNumber: string;
  partyName: string;
  date: string;
  category: 'supplier' | 'exporter';
  status: PaymentReconciliationStatus;
  label: string;
  hasDiscrepancy: boolean;
  voucherPaidAmount: number;
  challanPaidAmount: number;
  discrepancyAmount: number;
  expectedBalance: number;
  recordedBalance: number;
  matchedPurchaseId?: string;
  matchedPurchaseInvoice?: string;
  summaryText: string;
  resolutionLabel: string;
}

export interface SmartDataSyncSummary {
  totalPurchasesChecked: number;
  totalSupplierPaymentsChecked: number;
  reconciledPurchasesCount: number;
  reconciledPaymentsCount: number;
  discrepancyCount: number;
  purchaseDiscrepancyCount: number;
  paymentDiscrepancyCount: number;
  totalDiscrepancyAmount: number;
  missingVoucherCount: number;
  amountMismatchCount: number;
  balanceMismatchCount: number;
  unlinkedVoucherCount: number;
  unpaidPendingCount: number;
}

export interface SmartDataSyncAnalysis {
  purchaseReconciliations: Record<string, PurchaseReconciliationItem>;
  paymentReconciliations: Record<string, PaymentReconciliationItem>;
  summary: SmartDataSyncSummary;
}

export interface SmartDataSyncMutationPlan {
  paymentsToCreate: PaymentRecord[];
  purchasesToCreate: PurchaseRecord[];
  purchasesToUpdate: Array<{ id: string; record: PurchaseRecord }>;
  paymentsToUpdate: Array<{ id: string; record: PaymentRecord }>;
  resolvedCount: number;
  descriptions: string[];
}

function normalizePartyName(name: string | undefined | null): string {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function normalizeInvoiceRef(inv: string | undefined | null): string {
  return String(inv || '')
    .trim()
    .toUpperCase();
}

function daysBetweenDates(dateA: string, dateB: string): number {
  const a = Date.parse(dateA);
  const b = Date.parse(dateB);
  if (Number.isNaN(a) || Number.isNaN(b)) return 999;
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

function deriveVoucherNumberFromPurchase(
  purchaseInvoice: string,
  existingInvoiceNumbers: Set<string>
): string {
  const cleaned = purchaseInvoice.trim();
  const baseCandidate = /^INV-/i.test(cleaned)
    ? cleaned.replace(/^INV-/i, 'PAY-')
    : `PAY-${cleaned}`;
  if (!existingInvoiceNumbers.has(baseCandidate.toUpperCase())) {
    return baseCandidate;
  }
  let suffix = 2;
  while (existingInvoiceNumbers.has(`${baseCandidate}-${suffix}`.toUpperCase())) {
    suffix += 1;
  }
  return `${baseCandidate}-${suffix}`;
}

function derivePurchaseNumberFromVoucher(
  paymentInvoice: string,
  existingInvoiceNumbers: Set<string>
): string {
  const cleaned = paymentInvoice.trim();
  const baseCandidate = /^PAY-/i.test(cleaned)
    ? cleaned.replace(/^PAY-/i, 'INV-')
    : `INV-${cleaned}`;
  if (!existingInvoiceNumbers.has(baseCandidate.toUpperCase())) {
    return baseCandidate;
  }
  let suffix = 2;
  while (existingInvoiceNumbers.has(`${baseCandidate}-${suffix}`.toUpperCase())) {
    suffix += 1;
  }
  return `${baseCandidate}-${suffix}`;
}

/**
 * Matches PurchaseRecords and supplier PaymentRecords using:
 * 1. Explicit invoice number cross-reference (e.g., INV-2026-1001 <-> PAY-2026-1001 or remarks/item ref)
 * 2. Supplier name + matching bill amount or close transaction date (<= 14 days)
 */
function buildPurchasePaymentLinks(
  purchases: PurchaseRecord[],
  supplierPayments: PaymentRecord[]
): {
  purchaseToPayments: Map<string, PaymentRecord[]>;
  paymentToPurchase: Map<string, PurchaseRecord>;
} {
  const purchaseToPayments = new Map<string, PaymentRecord[]>();
  const paymentToPurchase = new Map<string, PurchaseRecord>();

  for (const p of purchases) {
    purchaseToPayments.set(p.id, []);
  }

  // Pass 1: Explicit invoice reference or direct INV- <-> PAY- code match
  for (const pm of supplierPayments) {
    const pmInv = normalizeInvoiceRef(pm.invoiceNumber);
    const pmInvSuffix = pmInv.replace(/^PAY-/i, '');
    const pmRemarks = String(pm.remarks || '').toUpperCase();
    const pmExportRef = normalizeInvoiceRef(pm.exportGoodsRef);

    const explicitMatch = purchases.find((p) => {
      const pInv = normalizeInvoiceRef(p.invoiceNumber);
      const pInvSuffix = pInv.replace(/^INV-/i, '');

      if (pInv && (pmRemarks.includes(pInv) || pmExportRef === pInv)) {
        return true;
      }
      if (
        Array.isArray(pm.items) &&
        pm.items.some(
          (item) =>
            normalizeInvoiceRef(item.invoiceNumber) === pInv ||
            String(item.description || '')
              .toUpperCase()
              .includes(pInv)
        )
      ) {
        return true;
      }
      if (
        pInvSuffix &&
        pmInvSuffix &&
        pInvSuffix === pmInvSuffix &&
        normalizePartyName(p.description) === normalizePartyName(pm.description)
      ) {
        return true;
      }
      return false;
    });

    if (explicitMatch) {
      purchaseToPayments.get(explicitMatch.id)?.push(pm);
      paymentToPurchase.set(pm.id, explicitMatch);
    }
  }

  // Pass 2: Match remaining supplier payments by supplier name + bill total or date proximity
  for (const pm of supplierPayments) {
    if (paymentToPurchase.has(pm.id)) continue;

    const pmSupplier = normalizePartyName(pm.description);
    if (!pmSupplier) continue;

    // Prefer purchases of the same supplier that don't yet have a payment linked
    const candidates = purchases.filter(
      (p) => normalizePartyName(p.description) === pmSupplier
    );
    if (candidates.length === 0) continue;

    const unlinkedCandidates = candidates.filter(
      (p) => (purchaseToPayments.get(p.id)?.length || 0) === 0
    );
    const pool = unlinkedCandidates.length > 0 ? unlinkedCandidates : candidates;

    // Score candidates by totalAmount match, paidAmount match, and date proximity
    let bestCandidate: PurchaseRecord | null = null;
    let bestScore = -1;

    for (const candidate of pool) {
      const dayDiff = daysBetweenDates(candidate.date, pm.date);
      const sameTotal =
        Math.abs((Number(candidate.totalAmount) || 0) - (Number(pm.totalAmount) || 0)) < 0.01;
      const samePaid =
        Math.abs((Number(candidate.paidAmount) || 0) - (Number(pm.paidAmount) || 0)) < 0.01;

      if (!sameTotal && !samePaid && dayDiff > 14) {
        continue;
      }

      let score = 0;
      if (sameTotal) score += 50;
      if (samePaid) score += 30;
      if (dayDiff <= 3) score += 20;
      else if (dayDiff <= 14) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      purchaseToPayments.get(bestCandidate.id)?.push(pm);
      paymentToPurchase.set(pm.id, bestCandidate);
    }
  }

  return { purchaseToPayments, paymentToPurchase };
}

/**
 * Pure analysis utility that cross-references Purchase Records and Payment Records
 * and returns per-record reconciliation status and overall summary metrics.
 */
export function analyzePurchasePaymentReconciliation(
  purchases: PurchaseRecord[],
  payments: PaymentRecord[]
): SmartDataSyncAnalysis {
  const supplierPayments = payments.filter(
    (pm) => classifyPaymentCategory(pm) === 'supplier'
  );

  const { purchaseToPayments, paymentToPurchase } = buildPurchasePaymentLinks(
    purchases,
    supplierPayments
  );

  const purchaseReconciliations: Record<string, PurchaseReconciliationItem> = {};
  const paymentReconciliations: Record<string, PaymentReconciliationItem> = {};

  let reconciledPurchasesCount = 0;
  let reconciledPaymentsCount = 0;
  let purchaseDiscrepancyCount = 0;
  let paymentDiscrepancyCount = 0;
  let totalDiscrepancyAmount = 0;
  let missingVoucherCount = 0;
  let amountMismatchCount = 0;
  let balanceMismatchCount = 0;
  let unlinkedVoucherCount = 0;
  let unpaidPendingCount = 0;

  for (const p of purchases) {
    const matchedPayments = purchaseToPayments.get(p.id) || [];
    const challanTotal = Number(p.totalAmount) || 0;
    const challanPrev = Number(p.previousAmount) || 0;
    const challanPaid = Number(p.paidAmount) || 0;
    const recordedBalance = Number(p.balance) || 0;
    const expectedBalance = Math.max(0, challanTotal + challanPrev - challanPaid);
    const hasInternalBalanceDrift = Math.abs(expectedBalance - recordedBalance) > 0.01;

    const voucherPaidSum = matchedPayments.reduce(
      (acc, mp) => acc + (Number(mp.paidAmount) || 0),
      0
    );
    const matchedIds = matchedPayments.map((mp) => mp.id);
    const matchedInvoices = matchedPayments.map((mp) => mp.invoiceNumber);

    if (matchedPayments.length === 0) {
      if (challanPaid > 0) {
        missingVoucherCount += 1;
        purchaseDiscrepancyCount += 1;
        totalDiscrepancyAmount += challanPaid;
        purchaseReconciliations[p.id] = {
          purchaseId: p.id,
          invoiceNumber: p.invoiceNumber,
          supplierName: p.description,
          date: p.date,
          status: 'MISSING_VOUCHER',
          label: 'MISSING VOUCHER',
          hasDiscrepancy: true,
          challanTotalAmount: challanTotal,
          challanPaidAmount: challanPaid,
          voucherPaidAmount: 0,
          discrepancyAmount: challanPaid,
          expectedBalance,
          recordedBalance,
          matchedPaymentIds: [],
          matchedPaymentInvoices: [],
          summaryText: `Paid ${challanPaid.toLocaleString()} on challan — missing Supplier Payment Voucher`,
          resolutionLabel: 'Generate Payment Voucher',
        };
      } else if (hasInternalBalanceDrift) {
        const drift = Math.abs(expectedBalance - recordedBalance);
        balanceMismatchCount += 1;
        purchaseDiscrepancyCount += 1;
        totalDiscrepancyAmount += drift;
        purchaseReconciliations[p.id] = {
          purchaseId: p.id,
          invoiceNumber: p.invoiceNumber,
          supplierName: p.description,
          date: p.date,
          status: 'BALANCE_MISMATCH',
          label: 'BALANCE DRIFT',
          hasDiscrepancy: true,
          challanTotalAmount: challanTotal,
          challanPaidAmount: challanPaid,
          voucherPaidAmount: 0,
          discrepancyAmount: drift,
          expectedBalance,
          recordedBalance,
          matchedPaymentIds: [],
          matchedPaymentInvoices: [],
          summaryText: `Challan balance (${recordedBalance.toLocaleString()}) ≠ expected (${expectedBalance.toLocaleString()})`,
          resolutionLabel: 'Recalculate Balance',
        };
      } else {
        unpaidPendingCount += 1;
        purchaseReconciliations[p.id] = {
          purchaseId: p.id,
          invoiceNumber: p.invoiceNumber,
          supplierName: p.description,
          date: p.date,
          status: 'UNPAID_PENDING',
          label: 'UNPAID BILL',
          hasDiscrepancy: false,
          challanTotalAmount: challanTotal,
          challanPaidAmount: 0,
          voucherPaidAmount: 0,
          discrepancyAmount: 0,
          expectedBalance,
          recordedBalance,
          matchedPaymentIds: [],
          matchedPaymentInvoices: [],
          summaryText: 'Unpaid credit challan (0 paid, no voucher required yet)',
          resolutionLabel: 'No Action Needed',
        };
      }
      continue;
    }

    // Has 1 or more matched supplier payment vouchers
    const paidDiff = Math.abs(challanPaid - voucherPaidSum);
    const latestVoucher = matchedPayments[matchedPayments.length - 1];
    const voucherBalance = Number(latestVoucher.balance) || 0;
    const hasVoucherBalanceDrift = Math.abs(expectedBalance - voucherBalance) > 0.01;

    if (paidDiff > 0.01) {
      amountMismatchCount += 1;
      purchaseDiscrepancyCount += 1;
      totalDiscrepancyAmount += paidDiff;
      purchaseReconciliations[p.id] = {
        purchaseId: p.id,
        invoiceNumber: p.invoiceNumber,
        supplierName: p.description,
        date: p.date,
        status: 'AMOUNT_MISMATCH',
        label: 'AMOUNT MISMATCH',
        hasDiscrepancy: true,
        challanTotalAmount: challanTotal,
        challanPaidAmount: challanPaid,
        voucherPaidAmount: voucherPaidSum,
        discrepancyAmount: paidDiff,
        expectedBalance,
        recordedBalance,
        matchedPaymentIds: matchedIds,
        matchedPaymentInvoices: matchedInvoices,
        summaryText: `Challan paid (${challanPaid.toLocaleString()}) ≠ Voucher ${matchedInvoices.join(', ')} (${voucherPaidSum.toLocaleString()})`,
        resolutionLabel: 'Sync Paid & Balance',
      };
    } else if (hasInternalBalanceDrift || hasVoucherBalanceDrift) {
      const drift = Math.max(
        Math.abs(expectedBalance - recordedBalance),
        Math.abs(expectedBalance - voucherBalance)
      );
      balanceMismatchCount += 1;
      purchaseDiscrepancyCount += 1;
      totalDiscrepancyAmount += drift;
      purchaseReconciliations[p.id] = {
        purchaseId: p.id,
        invoiceNumber: p.invoiceNumber,
        supplierName: p.description,
        date: p.date,
        status: 'BALANCE_MISMATCH',
        label: 'BALANCE DRIFT',
        hasDiscrepancy: true,
        challanTotalAmount: challanTotal,
        challanPaidAmount: challanPaid,
        voucherPaidAmount: voucherPaidSum,
        discrepancyAmount: drift,
        expectedBalance,
        recordedBalance,
        matchedPaymentIds: matchedIds,
        matchedPaymentInvoices: matchedInvoices,
        summaryText: `Balance mismatch between ${p.invoiceNumber} and ${matchedInvoices.join(', ')}`,
        resolutionLabel: 'Sync Ledger Balance',
      };
    } else {
      reconciledPurchasesCount += 1;
      purchaseReconciliations[p.id] = {
        purchaseId: p.id,
        invoiceNumber: p.invoiceNumber,
        supplierName: p.description,
        date: p.date,
        status: 'RECONCILED',
        label: 'RECONCILED',
        hasDiscrepancy: false,
        challanTotalAmount: challanTotal,
        challanPaidAmount: challanPaid,
        voucherPaidAmount: voucherPaidSum,
        discrepancyAmount: 0,
        expectedBalance,
        recordedBalance,
        matchedPaymentIds: matchedIds,
        matchedPaymentInvoices: matchedInvoices,
        summaryText: `Synced with ${matchedInvoices.join(', ')}`,
        resolutionLabel: 'Reconciled',
      };
    }
  }

  // Evaluate all PaymentRecords (both supplier and exporter)
  for (const pm of payments) {
    const category = classifyPaymentCategory(pm);
    const voucherPaid = Number(pm.paidAmount) || 0;
    const recordedBalance = Number(pm.balance) || 0;
    const expectedBalance = Math.max(
      0,
      (Number(pm.totalAmount) || 0) + (Number(pm.previousAmount) || 0) - voucherPaid
    );

    if (category === 'exporter') {
      paymentReconciliations[pm.id] = {
        paymentId: pm.id,
        invoiceNumber: pm.invoiceNumber,
        partyName: pm.description,
        date: pm.date,
        category: 'exporter',
        status: 'EXPORTER_LEDGER',
        label: 'EXPORTER SLIP',
        hasDiscrepancy: false,
        voucherPaidAmount: voucherPaid,
        challanPaidAmount: voucherPaid,
        discrepancyAmount: 0,
        expectedBalance,
        recordedBalance,
        summaryText: `Exporter settlement (${pm.shippingMark || pm.description})`,
        resolutionLabel: 'Exporter Ledger',
      };
      continue;
    }

    const matchedPurchase = paymentToPurchase.get(pm.id);
    if (!matchedPurchase) {
      unlinkedVoucherCount += 1;
      paymentDiscrepancyCount += 1;
      totalDiscrepancyAmount += voucherPaid;
      paymentReconciliations[pm.id] = {
        paymentId: pm.id,
        invoiceNumber: pm.invoiceNumber,
        partyName: pm.description,
        date: pm.date,
        category: 'supplier',
        status: 'UNLINKED_VOUCHER',
        label: 'UNLINKED VOUCHER',
        hasDiscrepancy: true,
        voucherPaidAmount: voucherPaid,
        challanPaidAmount: 0,
        discrepancyAmount: voucherPaid,
        expectedBalance,
        recordedBalance,
        summaryText: `No matching Purchase Challan found for ${pm.description}`,
        resolutionLabel: 'Create Purchase Challan',
      };
      continue;
    }

    const purchaseRec = purchaseReconciliations[matchedPurchase.id];
    if (purchaseRec && purchaseRec.hasDiscrepancy) {
      paymentDiscrepancyCount += 1;
      const mappedStatus: PaymentReconciliationStatus =
        purchaseRec.status === 'BALANCE_MISMATCH' ? 'BALANCE_MISMATCH' : 'AMOUNT_MISMATCH';
      paymentReconciliations[pm.id] = {
        paymentId: pm.id,
        invoiceNumber: pm.invoiceNumber,
        partyName: pm.description,
        date: pm.date,
        category: 'supplier',
        status: mappedStatus,
        label: purchaseRec.label,
        hasDiscrepancy: true,
        voucherPaidAmount: voucherPaid,
        challanPaidAmount: purchaseRec.challanPaidAmount,
        discrepancyAmount: purchaseRec.discrepancyAmount,
        expectedBalance: purchaseRec.expectedBalance,
        recordedBalance,
        matchedPurchaseId: matchedPurchase.id,
        matchedPurchaseInvoice: matchedPurchase.invoiceNumber,
        summaryText: purchaseRec.summaryText,
        resolutionLabel: purchaseRec.resolutionLabel,
      };
    } else {
      reconciledPaymentsCount += 1;
      paymentReconciliations[pm.id] = {
        paymentId: pm.id,
        invoiceNumber: pm.invoiceNumber,
        partyName: pm.description,
        date: pm.date,
        category: 'supplier',
        status: 'RECONCILED',
        label: 'RECONCILED',
        hasDiscrepancy: false,
        voucherPaidAmount: voucherPaid,
        challanPaidAmount: Number(matchedPurchase.paidAmount) || 0,
        discrepancyAmount: 0,
        expectedBalance,
        recordedBalance,
        matchedPurchaseId: matchedPurchase.id,
        matchedPurchaseInvoice: matchedPurchase.invoiceNumber,
        summaryText: `Synced with ${matchedPurchase.invoiceNumber}`,
        resolutionLabel: 'Reconciled',
      };
    }
  }

  return {
    purchaseReconciliations,
    paymentReconciliations,
    summary: {
      totalPurchasesChecked: purchases.length,
      totalSupplierPaymentsChecked: supplierPayments.length,
      reconciledPurchasesCount,
      reconciledPaymentsCount,
      discrepancyCount: purchaseDiscrepancyCount + unlinkedVoucherCount,
      purchaseDiscrepancyCount,
      paymentDiscrepancyCount,
      totalDiscrepancyAmount,
      missingVoucherCount,
      amountMismatchCount,
      balanceMismatchCount,
      unlinkedVoucherCount,
      unpaidPendingCount,
    },
  };
}

/**
 * Builds a deterministic reconciliation plan for either all discrepant records
 * or a single targeted record (`targetRecordId` can be a `purchase.id` or `payment.id`).
 */
export function buildSmartSyncReconciliationPlan(
  purchases: PurchaseRecord[],
  payments: PaymentRecord[],
  targetRecordId?: string
): SmartDataSyncMutationPlan {
  const analysis = analyzePurchasePaymentReconciliation(purchases, payments);
  const paymentsToCreate: PaymentRecord[] = [];
  const purchasesToCreate: PurchaseRecord[] = [];
  const purchasesToUpdate: Array<{ id: string; record: PurchaseRecord }> = [];
  const paymentsToUpdate: Array<{ id: string; record: PaymentRecord }> = [];
  const descriptions: string[] = [];

  const existingPaymentInvoices = new Set(
    payments.map((pm) => normalizeInvoiceRef(pm.invoiceNumber))
  );
  const existingPurchaseInvoices = new Set(
    purchases.map((p) => normalizeInvoiceRef(p.invoiceNumber))
  );

  const nowIso = new Date().toISOString();

  // If targetRecordId corresponds to a payment that is linked to a purchase, redirect to that purchase
  let effectiveTargetId = targetRecordId;
  if (targetRecordId && analysis.paymentReconciliations[targetRecordId]?.matchedPurchaseId) {
    effectiveTargetId = analysis.paymentReconciliations[targetRecordId].matchedPurchaseId;
  }

  // 1. Reconcile Purchase discrepancies
  for (const p of purchases) {
    if (effectiveTargetId && p.id !== effectiveTargetId) continue;

    const rec = analysis.purchaseReconciliations[p.id];
    if (!rec || !rec.hasDiscrepancy) continue;

    if (rec.status === 'MISSING_VOUCHER') {
      const voucherNo = deriveVoucherNumberFromPurchase(
        p.invoiceNumber,
        existingPaymentInvoices
      );
      existingPaymentInvoices.add(voucherNo.toUpperCase());

      const totalBill = (Number(p.totalAmount) || 0) + (Number(p.previousAmount) || 0);
      const paidAmt = Number(p.paidAmount) || 0;
      const cleanBalance = Math.max(0, totalBill - paidAmt);

      const newPayment: PaymentRecord = {
        id: `pay-sync-${p.id}`,
        invoiceNumber: voucherNo,
        date: p.date,
        description: p.description,
        contactNumber: p.contactNumber || '',
        items: [
          {
            id: `payi-sync-${p.id}`,
            invoiceNumber: p.invoiceNumber,
            date: p.date,
            description: `Smart Data Sync — Auto-reconciled payment for Purchase Challan ${p.invoiceNumber}`,
            debitAmount: totalBill,
            creditAmount: paidAmt,
            balance: cleanBalance,
            status: cleanBalance === 0 ? 'PAID' : 'REPORT',
          },
        ],
        totalAmount: Number(p.totalAmount) || 0,
        previousAmount: Number(p.previousAmount) || 0,
        paidAmount: paidAmt,
        balance: cleanBalance,
        status: cleanBalance === 0 ? 'PAID' : 'REPORT',
        returnRMB: 0,
        returnRMBInBDT: 0,
        exportGoodsRef: p.invoiceNumber,
        paymentCategory: 'supplier',
        remarks: `Auto-generated by Smart Data Sync to reconcile ${p.invoiceNumber}`,
        createdAt: nowIso,
      };

      paymentsToCreate.push(newPayment);

      // Also fix purchase balance if drifted
      if (Math.abs((Number(p.balance) || 0) - cleanBalance) > 0.01) {
        purchasesToUpdate.push({
          id: p.id,
          record: {
            ...p,
            balance: cleanBalance,
          },
        });
      }

      descriptions.push(
        `Created Supplier Payment Voucher ${voucherNo} (${paidAmt.toLocaleString()}) for ${p.invoiceNumber} (${p.description})`
      );
    } else if (rec.status === 'AMOUNT_MISMATCH' || rec.status === 'BALANCE_MISMATCH') {
      const matchedPayments = payments.filter((pm) =>
        rec.matchedPaymentIds.includes(pm.id)
      );
      const totalBill = (Number(p.totalAmount) || 0) + (Number(p.previousAmount) || 0);
      const authoritativePaid = Math.min(
        totalBill,
        Math.max(rec.challanPaidAmount, rec.voucherPaidAmount)
      );
      const syncedBalance = Math.max(0, totalBill - authoritativePaid);

      // Update Purchase Record
      const updatedItems = Array.isArray(p.items)
        ? p.items.map((item, idx) =>
            idx === 0
              ? {
                  ...item,
                  paidAmount: authoritativePaid,
                  balance: syncedBalance,
                }
              : item
          )
        : [];

      purchasesToUpdate.push({
        id: p.id,
        record: {
          ...p,
          items: updatedItems,
          paidAmount: authoritativePaid,
          balance: syncedBalance,
        },
      });

      // Update matched Payment Record(s)
      if (matchedPayments.length === 1) {
        const mp = matchedPayments[0];
        const updatedPaymentItems = Array.isArray(mp.items)
          ? mp.items.map((item, idx) =>
              idx === 0
                ? {
                    ...item,
                    debitAmount: totalBill,
                    creditAmount: authoritativePaid,
                    balance: syncedBalance,
                    status: syncedBalance === 0 ? 'PAID' : 'REPORT',
                  }
                : item
            )
          : [];

        paymentsToUpdate.push({
          id: mp.id,
          record: {
            ...mp,
            items: updatedPaymentItems,
            totalAmount: Number(p.totalAmount) || 0,
            previousAmount: Number(p.previousAmount) || 0,
            paidAmount: authoritativePaid,
            balance: syncedBalance,
            status: syncedBalance === 0 ? 'PAID' : 'REPORT',
            exportGoodsRef: mp.exportGoodsRef || p.invoiceNumber,
          },
        });
      } else if (matchedPayments.length > 1) {
        // Adjust the last matched payment voucher so cumulative paid equals authoritativePaid
        const priorPaid = matchedPayments
          .slice(0, -1)
          .reduce((acc, item) => acc + (Number(item.paidAmount) || 0), 0);
        const lastMp = matchedPayments[matchedPayments.length - 1];
        const adjustedLastPaid = Math.max(0, authoritativePaid - priorPaid);
        paymentsToUpdate.push({
          id: lastMp.id,
          record: {
            ...lastMp,
            paidAmount: adjustedLastPaid,
            balance: syncedBalance,
            status: syncedBalance === 0 ? 'PAID' : 'REPORT',
            exportGoodsRef: lastMp.exportGoodsRef || p.invoiceNumber,
          },
        });
      }

      descriptions.push(
        `Synchronized paid amount (${authoritativePaid.toLocaleString()}) and balance (${syncedBalance.toLocaleString()}) for ${p.invoiceNumber}`
      );
    }
  }

  // 2. Reconcile Unlinked Supplier Payment Vouchers
  for (const pm of payments) {
    if (effectiveTargetId && pm.id !== effectiveTargetId) continue;

    const pmRec = analysis.paymentReconciliations[pm.id];
    if (!pmRec || pmRec.status !== 'UNLINKED_VOUCHER') continue;

    const newPurchaseInv = derivePurchaseNumberFromVoucher(
      pm.invoiceNumber,
      existingPurchaseInvoices
    );
    existingPurchaseInvoices.add(newPurchaseInv.toUpperCase());

    const totalAmt =
      (Number(pm.totalAmount) || 0) > 0
        ? Number(pm.totalAmount)
        : (Number(pm.paidAmount) || 0) + (Number(pm.balance) || 0);
    const paidAmt = Number(pm.paidAmount) || 0;
    const prevAmt = Number(pm.previousAmount) || 0;
    const cleanBalance = Math.max(0, totalAmt + prevAmt - paidAmt);

    const newPurchase: PurchaseRecord = {
      id: `pur-sync-${pm.id}`,
      invoiceNumber: newPurchaseInv,
      date: pm.date,
      description: pm.description,
      contactNumber: pm.contactNumber || '',
      items: [
        {
          id: `puri-sync-${pm.id}`,
          item: 'EEL FISH / CONSIGNMENT',
          quantity: 1,
          rate: totalAmt,
          totalAmount: totalAmt,
          previousAmount: prevAmt,
          paidAmount: paidAmt,
          balance: cleanBalance,
        },
      ],
      totalQty: 1,
      totalAmount: totalAmt,
      previousAmount: prevAmt,
      paidAmount: paidAmt,
      balance: cleanBalance,
      remarks: `Auto-created by Smart Data Sync from Supplier Payment Voucher ${pm.invoiceNumber}`,
      createdAt: nowIso,
    };

    purchasesToCreate.push(newPurchase);
    paymentsToUpdate.push({
      id: pm.id,
      record: {
        ...pm,
        totalAmount: totalAmt,
        balance: cleanBalance,
        exportGoodsRef: newPurchaseInv,
      },
    });

    descriptions.push(
      `Created linked Purchase Challan ${newPurchaseInv} for unlinked voucher ${pm.invoiceNumber} (${pm.description})`
    );
  }

  const resolvedCount =
    paymentsToCreate.length +
    purchasesToCreate.length +
    purchasesToUpdate.length;

  return {
    paymentsToCreate,
    purchasesToCreate,
    purchasesToUpdate,
    paymentsToUpdate,
    resolvedCount,
    descriptions,
  };
}
