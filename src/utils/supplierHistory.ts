/**
 * Supplier Payment Record History & Details Builder
 * Supports Supplier Payment Data Entry Form – Local Fish Suppliers
 * with full Debit, Credit, Balance, and Status (REPORT, NO REPORT, PAID) breakdown.
 */
import {
  PurchaseRecord,
  PaymentRecord,
  SupplierCreditRecord,
  PaymentItemRow,
  ExporterStatus,
} from '../types/index.ts';
import {
  calculatePaymentRow,
  classifyPaymentCategory,
} from './calculations.ts';

export const SUPPLIER_STATUS_OPTIONS: readonly ExporterStatus[] = [
  'PAID',
  'REPORT',
  'NO REPORT',
] as const;

export type SupplierRecordType = 'PAYMENT_VOUCHER' | 'PURCHASE_BILL' | 'CREDIT_NOTE';

export interface SupplierRecordHistoryRow extends PaymentItemRow {
  id: string;
  recordType: SupplierRecordType;
  invoiceNumber: string;
  date: string;
  supplierName: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  status: ExporterStatus;
  refDocument?: string;
}

export interface SupplierHistoryTotals {
  recordCount: number;
  voucherCount: number;
  purchaseCount: number;
  creditNoteCount: number;
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
  paidCount: number;
  reportCount: number;
  noReportCount: number;
  computedOverallStatus: ExporterStatus;
}

export interface SupplierHistoryFilterOptions {
  supplierName?: string;
  status?: string;
  search?: string;
  recordType?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Normalizes status string to 'PAID' | 'REPORT' | 'NO REPORT'
 */
export function normalizeSupplierStatus(status?: string, fallback: ExporterStatus = 'REPORT'): ExporterStatus {
  const raw = (status || '').trim().toUpperCase();
  if (raw === 'PAID') return 'PAID';
  if (raw === 'NO REPORT' || raw === 'NOREPORT') return 'NO REPORT';
  if (raw === 'REPORT') return 'REPORT';
  return raw || fallback;
}

/**
 * Builds the comprehensive Supplier Payment Details & Transaction History
 * (Debit = Purchase Bills, Credit = Supplier Payments / Credit Notes, Balance = Running Cumulative)
 */
export function buildSupplierRecordHistory(
  purchases: PurchaseRecord[] = [],
  payments: PaymentRecord[] = [],
  supplierCredits: SupplierCreditRecord[] = [],
  filters: SupplierHistoryFilterOptions = {}
): SupplierRecordHistoryRow[] {
  const {
    supplierName = 'ALL',
    status = 'ALL',
    search = '',
    recordType = 'ALL',
    sortDirection = 'desc',
  } = filters;

  const targetSupplier = (supplierName || 'ALL').trim().toLowerCase();
  const targetStatus = (status || 'ALL').trim().toUpperCase();
  const targetSearch = (search || '').trim().toLowerCase();
  const targetType = (recordType || 'ALL').trim().toUpperCase();

  const isSupplierMatch = (name?: string) => {
    if (targetSupplier === 'all' || !targetSupplier) return true;
    return (name || '').trim().toLowerCase() === targetSupplier;
  };

  const rawRows: Omit<SupplierRecordHistoryRow, 'balance'>[] = [];

  // Track purchases that already have a paidAmount so auto-synced payment vouchers don't double-count credit
  const purchasesWithPaid = new Set(
    purchases
      .filter((p) => (Number(p.paidAmount) || 0) > 0 && p.invoiceNumber)
      .map((p) => p.invoiceNumber.trim().toUpperCase())
  );

  // 1. Process Supplier Payment Vouchers (CREDIT: reduces supplier balance)
  const supplierPayments = payments.filter(
    (pm) => classifyPaymentCategory(pm) === 'supplier'
  );

  for (const pm of supplierPayments) {
    if (!isSupplierMatch(pm.description)) continue;
    // Skip auto-synced mirror payment vouchers when the purchase bill itself already carries the paidAmount as Credit Amount
    if (
      pm.id.startsWith('pay-sync-') ||
      (pm.exportGoodsRef && purchasesWithPaid.has(pm.exportGoodsRef.trim().toUpperCase()))
    ) {
      continue;
    }

    const standaloneItemsDebit = Array.isArray(pm.items)
      ? pm.items
          .filter(
            (i) =>
              !String(i.id || '').startsWith('pur-') &&
              !String(i.id || '').startsWith('pay-') &&
              !String(i.id || '').startsWith('cn-')
          )
          .reduce((s, i) => s + (Number(i.debitAmount) || 0), 0)
      : 0;
    const itemsCredit = Array.isArray(pm.items)
      ? pm.items
          .filter(
            (i) =>
              !String(i.id || '').startsWith('pur-') &&
              !String(i.id || '').startsWith('pay-') &&
              !String(i.id || '').startsWith('cn-')
          )
          .reduce((s, i) => s + (Number(i.creditAmount) || 0), 0)
      : 0;
    const debitAmt = !pm.exportGoodsRef
      ? Math.round(standaloneItemsDebit * 100) / 100
      : 0;
    const creditAmt =
      Math.round((Number(pm.paidAmount) || itemsCredit || 0) * 100) / 100;
    const pmTotal = Math.round((Number(pm.totalAmount) || debitAmt || 0) * 100) / 100;
    const pmBalance =
      Math.round((Number(pm.balance) || pmTotal - creditAmt) * 100) / 100;

    let rowStatus: ExporterStatus = normalizeSupplierStatus(pm.status, 'PAID');
    if (pmBalance <= 0 && creditAmt > 0) {
      rowStatus = 'PAID';
    } else if (pmBalance > 0 && (creditAmt > 0 || debitAmt > 0)) {
      rowStatus = 'REPORT';
    }

    rawRows.push({
      id: `voucher-${pm.id}`,
      paymentId: pm.id,
      recordType: 'PAYMENT_VOUCHER',
      invoiceNumber: pm.invoiceNumber,
      date: pm.date,
      supplierName: pm.description,
      description: `Payment Voucher: ${pm.invoiceNumber}${pmTotal > 0 ? ` (Ref Total: ${pmTotal})` : ''}`,
      debitAmount: debitAmt,
      creditAmount: creditAmt,
      status: rowStatus,
      refDocument: pm.invoiceNumber,
    });
  }

  // 2. Process Purchase Consignment Bills (DEBIT = totalAmount, CREDIT = paidAmount, BALANCE = Debit - Credit)
  for (const pur of purchases) {
    if (!isSupplierMatch(pur.description)) continue;

    const purDebit = Math.round((Number(pur.totalAmount) || 0) * 100) / 100;
    const purPaid = Math.round((Number(pur.paidAmount) || 0) * 100) / 100;
    const purBalance = Math.round((Number(pur.balance) || (purDebit - purPaid)) * 100) / 100;

    let purStatus: ExporterStatus = 'REPORT';
    if (purBalance <= 0 && purDebit > 0) {
      purStatus = 'PAID';
    } else if (purPaid === 0 && purDebit > 0) {
      purStatus = 'NO REPORT';
    } else {
      purStatus = 'REPORT';
    }

    rawRows.push({
      id: `purchase-${pur.id}`,
      recordType: 'PURCHASE_BILL',
      invoiceNumber: pur.invoiceNumber,
      date: pur.date,
      supplierName: pur.description,
      description: `Purchase Consignment: ${pur.invoiceNumber} · ${pur.totalQty || 0} KG ${pur.remarks ? `· ${pur.remarks}` : ''}`,
      debitAmount: purDebit,
      creditAmount: purPaid,
      status: purStatus,
      refDocument: pur.invoiceNumber,
    });
  }

  // 3. Process Supplier Credit Notes & Rebates (CREDIT: reduces supplier balance)
  for (const cn of supplierCredits) {
    if (!isSupplierMatch(cn.supplierName)) continue;

    const cnAmount = Math.round((Number(cn.amount) || 0) * 100) / 100;
    const cnStatus: ExporterStatus = cn.remainingAmount === 0 ? 'PAID' : 'REPORT';

    rawRows.push({
      id: `credit-${cn.id}`,
      recordType: 'CREDIT_NOTE',
      invoiceNumber: cn.creditNoteNumber,
      date: cn.date,
      supplierName: cn.supplierName,
      description: `Credit Note / Rebate: ${cn.creditNoteNumber} · ${cn.reason}${cn.refPurchaseInvoice ? ` (Ref: ${cn.refPurchaseInvoice})` : ''}`,
      debitAmount: 0,
      creditAmount: cnAmount,
      status: cnStatus,
      refDocument: cn.refPurchaseInvoice,
    });
  }

  // 4. Sort chronologically ASCENDING to calculate cumulative running balance
  rawRows.sort((a, b) => {
    const dDiff = (a.date || '').localeCompare(b.date || '');
    if (dDiff !== 0) return dDiff;
    return (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
  });

  // 5. Calculate per-row balance: Balance = Debit - Credit (matching user spreadsheet layout)
  const computedRows: SupplierRecordHistoryRow[] = rawRows.map((r) => {
    return {
      ...r,
      balance: Math.round((r.debitAmount - r.creditAmount) * 100) / 100,
    };
  });

  // 6. Apply Filter by record type, status, search
  const filtered = computedRows.filter((r) => {
    if (targetType !== 'ALL' && r.recordType !== targetType) {
      return false;
    }

    if (targetStatus !== 'ALL') {
      if (r.status.toUpperCase() !== targetStatus) {
        return false;
      }
    }

    if (targetSearch) {
      const match =
        r.invoiceNumber.toLowerCase().includes(targetSearch) ||
        r.supplierName.toLowerCase().includes(targetSearch) ||
        r.description.toLowerCase().includes(targetSearch) ||
        (r.refDocument && r.refDocument.toLowerCase().includes(targetSearch));
      if (!match) return false;
    }

    return true;
  });

  // 7. Sort direction: 'desc' (newest first) or 'asc' (oldest first, like image spreadsheet)
  if (sortDirection === 'desc') {
    filtered.sort((a, b) => {
      const dDiff = (b.date || '').localeCompare(a.date || '');
      if (dDiff !== 0) return dDiff;
      return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
    });
  }

  return filtered;
}

/**
 * Calculates Grand Totals & Counts for Supplier Payment Details & History
 */
export function calculateSupplierHistoryTotals(
  rows: SupplierRecordHistoryRow[]
): SupplierHistoryTotals {
  let totalDebit = 0;
  let totalCredit = 0;
  let paidCount = 0;
  let reportCount = 0;
  let noReportCount = 0;
  let voucherCount = 0;
  let purchaseCount = 0;
  let creditNoteCount = 0;

  for (const r of rows) {
    totalDebit += r.debitAmount;
    totalCredit += r.creditAmount;

    if (r.recordType === 'PAYMENT_VOUCHER') voucherCount++;
    else if (r.recordType === 'PURCHASE_BILL') purchaseCount++;
    else if (r.recordType === 'CREDIT_NOTE') creditNoteCount++;

    const norm = normalizeSupplierStatus(r.status);
    if (norm === 'PAID') paidCount++;
    else if (norm === 'NO REPORT') noReportCount++;
    else reportCount++;
  }

  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;
  const totalBalance = Math.round((roundedDebit - roundedCredit) * 100) / 100;

  let computedOverallStatus: ExporterStatus = 'REPORT';
  if (totalBalance <= 0 && roundedCredit > 0) {
    computedOverallStatus = 'PAID';
  } else if (noReportCount > 0 && paidCount === 0 && reportCount === 0) {
    computedOverallStatus = 'NO REPORT';
  } else {
    computedOverallStatus = 'REPORT';
  }

  return {
    recordCount: rows.length,
    voucherCount,
    purchaseCount,
    creditNoteCount,
    totalDebit: roundedDebit,
    totalCredit: roundedCredit,
    totalBalance,
    paidCount,
    reportCount,
    noReportCount,
    computedOverallStatus,
  };
}
