import type { PurchaseRecord, PaymentRecord } from '../types/index.ts';

export function toLocalIsoDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Normalizes various date string formats (YYYY-MM-DD, DD-MMM-YYYY, DD/MM/YYYY, ISO string)
 * into a canonical YYYY-MM-DD string.
 */
export function normalizeToIsoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (!trimmed) return '';

  // Match YYYY-MM-DD (or ISO timestamp starting with YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Match DD-MMM-YYYY or DD MMM YYYY (e.g., 02-Nov-2026)
  const dmyAlphaMatch = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[A-Za-z]*[-/\s](\d{4})$/);
  if (dmyAlphaMatch) {
    const [, day, monStr, year] = dmyAlphaMatch;
    const month = MONTH_MAP[monStr.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyNumericMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyNumericMatch) {
    const [, day, month, year] = dmyNumericMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return trimmed.slice(0, 10);
}

/**
 * Resolves the effective payment amount (BDT) from a PaymentRecord.
 * Checks paidAmount first, then sum of item creditAmounts, then totalAmount.
 */
export function getEffectivePaymentAmount(payment: PaymentRecord): number {
  const explicitPaid = Number(payment.paidAmount) || 0;
  if (explicitPaid > 0) {
    return Math.round(explicitPaid * 100) / 100;
  }

  const itemsCredit = (payment.items || []).reduce(
    (sum, item) => sum + (Number(item.creditAmount) || 0),
    0
  );
  if (itemsCredit > 0) {
    return Math.round(itemsCredit * 100) / 100;
  }

  const fallbackTotal = Number(payment.totalAmount) || 0;
  return Math.round(fallbackTotal * 100) / 100;
}

export interface DailyPaymentBreakdownItem {
  id: string;
  invoiceNumber: string;
  date: string;
  partyName: string;
  category: 'supplier' | 'exporter';
  source: 'payment_voucher' | 'purchase_direct_paid';
  amount: number;
  reference: string;
  status: string;
}

export interface DailyFinancialSummaryResult {
  targetDate: string;
  isCurrentDay: boolean;
  // Purchase Metrics for targetDate
  totalPurchases: number;
  totalPurchasePaid: number;
  totalPurchaseBalance: number;
  totalPurchaseQty: number;
  purchaseCount: number;
  // Payment Metrics for targetDate
  totalPayments: number;
  voucherPaymentsTotal: number;
  directPurchasePaymentsTotal: number;
  supplierPaymentsTotal: number;
  exporterPaymentsTotal: number;
  paymentCount: number;
  supplierPaymentCount: number;
  exporterPaymentCount: number;
  // Net Daily Summary
  netDailyBalance: number; // totalPurchases - totalPayments
  netSupplierPayableDelta: number; // totalPurchases - supplierPaymentsTotal
  paymentCoverageRatio: number; // percentage of today's purchases covered by today's payments
  // Filtered Records for targetDate
  dailyPurchases: PurchaseRecord[];
  dailyPayments: PaymentRecord[];
  dailyPaymentBreakdown: DailyPaymentBreakdownItem[];
  // Most recent date in dataset for quick reference if targetDate has no entries
  latestActivityDate: string;
}

/**
 * Calculates the Daily Financial Summary (total purchases and total payments)
 * for the specified targetDate (defaults to the current day).
 */
export function calculateDailyFinancialSummary(
  purchases: PurchaseRecord[],
  payments: PaymentRecord[],
  targetDate?: string,
  referenceToday: Date = new Date()
): DailyFinancialSummaryResult {
  const currentDayIso = toLocalIsoDate(referenceToday);
  const resolvedTargetDate = targetDate
    ? normalizeToIsoDate(targetDate)
    : currentDayIso;

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  // Track latest activity date across all purchase and payment records
  let latestActivityDate = '';
  for (const p of safePurchases) {
    const norm = normalizeToIsoDate(p.date);
    if (norm && norm > latestActivityDate) {
      latestActivityDate = norm;
    }
  }
  for (const pm of safePayments) {
    const norm = normalizeToIsoDate(pm.date);
    if (norm && norm > latestActivityDate) {
      latestActivityDate = norm;
    }
  }

  // 1. Filter Purchases for resolvedTargetDate
  const dailyPurchases = safePurchases.filter(
    (p) => normalizeToIsoDate(p.date) === resolvedTargetDate
  );

  const totalPurchases = Math.round(
    dailyPurchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0) * 100
  ) / 100;

  const totalPurchasePaid = Math.round(
    dailyPurchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0) * 100
  ) / 100;

  const totalPurchaseBalance = Math.round(
    dailyPurchases.reduce((sum, p) => sum + (Number(p.balance) || 0), 0) * 100
  ) / 100;

  const totalPurchaseQty = Math.round(
    dailyPurchases.reduce((sum, p) => sum + (Number(p.totalQty) || 0), 0) * 100
  ) / 100;

  const purchaseCount = dailyPurchases.length;

  // 2. Filter Payment Vouchers for resolvedTargetDate
  const dailyPayments = safePayments.filter(
    (pm) => normalizeToIsoDate(pm.date) === resolvedTargetDate
  );

  const dailyPaymentBreakdown: DailyPaymentBreakdownItem[] = [];
  const syncedPurchaseInvoices = new Set<string>();

  let voucherPaymentsTotal = 0;
  let supplierPaymentsTotal = 0;
  let exporterPaymentsTotal = 0;
  let supplierPaymentCount = 0;
  let exporterPaymentCount = 0;

  for (const pm of dailyPayments) {
    const amount = getEffectivePaymentAmount(pm);
    const category: 'supplier' | 'exporter' =
      pm.paymentCategory === 'exporter' ? 'exporter' : 'supplier';

    voucherPaymentsTotal += amount;
    if (category === 'exporter') {
      exporterPaymentsTotal += amount;
      exporterPaymentCount += 1;
    } else {
      supplierPaymentsTotal += amount;
      supplierPaymentCount += 1;
    }

    // Track purchase invoice references that already have a payment voucher on this date
    // so we don't double-count auto-synced payment vouchers (e.g. pay-sync-*)
    if (pm.exportGoodsRef) {
      syncedPurchaseInvoices.add(pm.exportGoodsRef.trim().toUpperCase());
    }
    if (pm.id && pm.id.startsWith('pay-sync-')) {
      const linkedPurId = pm.id.replace('pay-sync-', '');
      const linkedPur = dailyPurchases.find((p) => p.id === linkedPurId);
      if (linkedPur?.invoiceNumber) {
        syncedPurchaseInvoices.add(linkedPur.invoiceNumber.trim().toUpperCase());
      }
    }

    dailyPaymentBreakdown.push({
      id: pm.id,
      invoiceNumber: pm.invoiceNumber || '-',
      date: resolvedTargetDate,
      partyName: pm.description || (category === 'exporter' ? 'Exporter' : 'Supplier'),
      category,
      source: 'payment_voucher',
      amount,
      reference: pm.exportGoodsRef || '-',
      status: pm.status || 'PAID',
    });
  }

  // 3. Include any direct paidAmount on today's purchases that does NOT already have
  // a matching payment voucher on the same date (prevents under-counting if a purchase
  // has paidAmount > 0 without a standalone voucher, while avoiding double-counting when synced)
  let directPurchasePaymentsTotal = 0;
  for (const pur of dailyPurchases) {
    const directPaid = Number(pur.paidAmount) || 0;
    const invKey = (pur.invoiceNumber || '').trim().toUpperCase();
    const hasSyncedVoucher =
      (invKey && syncedPurchaseInvoices.has(invKey)) ||
      dailyPayments.some((pm) => pm.id === `pay-sync-${pur.id}`);

    if (directPaid > 0 && !hasSyncedVoucher) {
      const roundedPaid = Math.round(directPaid * 100) / 100;
      directPurchasePaymentsTotal += roundedPaid;
      supplierPaymentsTotal += roundedPaid;
      supplierPaymentCount += 1;

      dailyPaymentBreakdown.push({
        id: `pur-paid-${pur.id}`,
        invoiceNumber: pur.invoiceNumber || '-',
        date: resolvedTargetDate,
        partyName: pur.description || 'Supplier',
        category: 'supplier',
        source: 'purchase_direct_paid',
        amount: roundedPaid,
        reference: pur.invoiceNumber || 'Direct Bill Settlement',
        status: pur.balance <= 0 ? 'PAID IN FULL' : 'PARTIAL PAID',
      });
    }
  }

  voucherPaymentsTotal = Math.round(voucherPaymentsTotal * 100) / 100;
  directPurchasePaymentsTotal = Math.round(directPurchasePaymentsTotal * 100) / 100;
  supplierPaymentsTotal = Math.round(supplierPaymentsTotal * 100) / 100;
  exporterPaymentsTotal = Math.round(exporterPaymentsTotal * 100) / 100;

  const totalPayments = Math.round((voucherPaymentsTotal + directPurchasePaymentsTotal) * 100) / 100;
  const paymentCount = dailyPaymentBreakdown.length;

  const netDailyBalance = Math.round((totalPurchases - totalPayments) * 100) / 100;
  const netSupplierPayableDelta = Math.round((totalPurchases - supplierPaymentsTotal) * 100) / 100;

  const paymentCoverageRatio =
    totalPurchases > 0
      ? Math.min(100, Math.round((supplierPaymentsTotal / totalPurchases) * 1000) / 10)
      : totalPayments > 0
      ? 100
      : 0;

  return {
    targetDate: resolvedTargetDate,
    isCurrentDay: resolvedTargetDate === currentDayIso,
    totalPurchases,
    totalPurchasePaid,
    totalPurchaseBalance,
    totalPurchaseQty,
    purchaseCount,
    totalPayments,
    voucherPaymentsTotal,
    directPurchasePaymentsTotal,
    supplierPaymentsTotal,
    exporterPaymentsTotal,
    paymentCount,
    supplierPaymentCount,
    exporterPaymentCount,
    netDailyBalance,
    netSupplierPayableDelta,
    paymentCoverageRatio,
    dailyPurchases,
    dailyPayments,
    dailyPaymentBreakdown,
    latestActivityDate,
  };
}
