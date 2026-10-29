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
 * (Debit, Credit, Balance & Status: Paid, Report, No Report) across
 * all Supplier Payment Vouchers, Purchase Consignment Bills, and Credit Notes.
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
  } = filters;

  const targetSupplier = (supplierName || 'ALL').trim().toLowerCase();
  const targetStatus = (status || 'ALL').trim().toUpperCase();
  const targetSearch = (search || '').trim().toLowerCase();
  const targetType = (recordType || 'ALL').trim().toUpperCase();

  const isSupplierMatch = (name?: string) => {
    if (targetSupplier === 'all' || !targetSupplier) return true;
    return (name || '').trim().toLowerCase() === targetSupplier;
  };

  const rows: SupplierRecordHistoryRow[] = [];

  // 1. Process Supplier Payment Vouchers
  const supplierPayments = payments.filter(
    (pm) => classifyPaymentCategory(pm) === 'supplier'
  );

  for (const pm of supplierPayments) {
    if (!isSupplierMatch(pm.description)) continue;

    const debitAmt = Number(pm.totalAmount) || 0;
    const creditAmt = Number(pm.paidAmount) || 0;
    const balAmt = Number(pm.balance) || calculatePaymentRow(debitAmt, creditAmt);

    // If voucher balance is 0 or less and paidAmount > 0, it is PAID
    let rowStatus: ExporterStatus = normalizeSupplierStatus(pm.status, 'PAID');
    if (balAmt <= 0 && creditAmt > 0) {
      rowStatus = 'PAID';
    } else if (balAmt > 0 && creditAmt > 0) {
      rowStatus = 'REPORT';
    }

    rows.push({
      id: `voucher-${pm.id}`,
      paymentId: pm.id,
      recordType: 'PAYMENT_VOUCHER',
      invoiceNumber: pm.invoiceNumber,
      date: pm.date,
      supplierName: pm.description,
      description: `Payment Voucher: ${pm.invoiceNumber} (${pm.items?.length || 1} line item${(pm.items?.length || 1) === 1 ? '' : 's'})`,
      debitAmount: Math.round(debitAmt * 100) / 100,
      creditAmount: Math.round(creditAmt * 100) / 100,
      balance: Math.round(balAmt * 100) / 100,
      status: rowStatus,
      refDocument: pm.invoiceNumber,
    });
  }

  // 2. Process Purchase Consignment Bills (Local Fish Suppliers)
  for (const pur of purchases) {
    if (!isSupplierMatch(pur.description)) continue;

    const purDebit = Number(pur.totalAmount) || 0;
    const purCredit = Number(pur.paidAmount) || 0;
    const purBalance = Number(pur.balance) || calculatePaymentRow(purDebit, purCredit);

    let purStatus: ExporterStatus = 'REPORT';
    if (purBalance <= 0 && purDebit > 0) {
      purStatus = 'PAID';
    } else if (purCredit === 0 && purDebit > 0) {
      purStatus = 'NO REPORT';
    } else {
      purStatus = 'REPORT';
    }

    rows.push({
      id: `purchase-${pur.id}`,
      recordType: 'PURCHASE_BILL',
      invoiceNumber: pur.invoiceNumber,
      date: pur.date,
      supplierName: pur.description,
      description: `Purchase Consignment: ${pur.invoiceNumber} · ${pur.totalQty || 0} KG ${pur.remarks ? `· ${pur.remarks}` : ''}`,
      debitAmount: Math.round(purDebit * 100) / 100,
      creditAmount: Math.round(purCredit * 100) / 100,
      balance: Math.round(purBalance * 100) / 100,
      status: purStatus,
      refDocument: pur.invoiceNumber,
    });
  }

  // 3. Process Supplier Credit Notes & Rebates
  for (const cn of supplierCredits) {
    if (!isSupplierMatch(cn.supplierName)) continue;

    const cnAmount = Number(cn.amount) || 0;
    const appliedAmount = cnAmount - (Number(cn.remainingAmount) || 0);

    const cnStatus: ExporterStatus = cn.remainingAmount === 0 ? 'PAID' : 'REPORT';

    rows.push({
      id: `credit-${cn.id}`,
      recordType: 'CREDIT_NOTE',
      invoiceNumber: cn.creditNoteNumber,
      date: cn.date,
      supplierName: cn.supplierName,
      description: `Credit Note / Rebate: ${cn.creditNoteNumber} · ${cn.reason}${cn.refPurchaseInvoice ? ` (Ref: ${cn.refPurchaseInvoice})` : ''}`,
      debitAmount: 0,
      creditAmount: Math.round(cnAmount * 100) / 100,
      balance: Math.round(-appliedAmount * 100) / 100,
      status: cnStatus,
      refDocument: cn.refPurchaseInvoice,
    });
  }

  // Sort by Date descending (newest first)
  rows.sort((a, b) => {
    const dDiff = (b.date || '').localeCompare(a.date || '');
    if (dDiff !== 0) return dDiff;
    return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
  });

  // Apply Filters
  return rows.filter((r) => {
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
}

/**
 * Calculates Grand Totals & Counts for Supplier Payment Details & History
 */
export function calculateSupplierHistoryTotals(
  rows: SupplierRecordHistoryRow[]
): SupplierHistoryTotals {
  let totalDebit = 0;
  let totalCredit = 0;
  let totalBalance = 0;
  let paidCount = 0;
  let reportCount = 0;
  let noReportCount = 0;
  let voucherCount = 0;
  let purchaseCount = 0;
  let creditNoteCount = 0;

  for (const r of rows) {
    totalDebit += r.debitAmount;
    totalCredit += r.creditAmount;
    totalBalance += r.balance;

    if (r.recordType === 'PAYMENT_VOUCHER') voucherCount++;
    else if (r.recordType === 'PURCHASE_BILL') purchaseCount++;
    else if (r.recordType === 'CREDIT_NOTE') creditNoteCount++;

    const norm = normalizeSupplierStatus(r.status);
    if (norm === 'PAID') paidCount++;
    else if (norm === 'NO REPORT') noReportCount++;
    else reportCount++;
  }

  let computedOverallStatus: ExporterStatus = 'REPORT';
  if (totalBalance <= 0 && totalCredit > 0) {
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
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalBalance: Math.round(totalBalance * 100) / 100,
    paidCount,
    reportCount,
    noReportCount,
    computedOverallStatus,
  };
}
