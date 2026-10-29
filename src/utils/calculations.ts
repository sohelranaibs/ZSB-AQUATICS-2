/**
 * Calculation and formatting utilities for ZSB AQUATICS
 */
import {
  PurchaseItemRow,
  PackingItemRow,
  PaymentItemRow,
  PurchaseRecord,
  PackingRecord,
  PackingFormDraft,
  PaymentRecord,
  OtherCostRecord,
  ExporterPaymentSlipRow,
} from '../types/index.ts';

/**
 * Calculates Purchase Row Total = Quantity * Rate
 */
export function calculatePurchaseRowTotal(quantity: number, rate: number): number {
  const qty = Number(quantity) || 0;
  const rt = Number(rate) || 0;
  return Math.round(qty * rt * 100) / 100;
}

/**
 * Calculates Purchase Form Totals
 */
export function calculatePurchaseTotals(
  rows: PurchaseItemRow[],
  previousAmount: number,
  paidAmount: number
) {
  const totalQty = rows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  const totalAmount = rows.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
  const prev = Number(previousAmount) || 0;
  const paid = Number(paidAmount) || 0;
  const balance = totalAmount + prev - paid;

  return {
    totalQty: Math.round(totalQty * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    previousAmount: prev,
    paidAmount: paid,
    balance: Math.round(balance * 100) / 100,
  };
}

/**
 * Calculates Packing List Row:
 * Total Weight = Box * Weight
 * Amount = Total Weight * Rate
 */
export function calculatePackingRow(box: number, weight: number, rate: number) {
  const b = Number(box) || 0;
  const w = Number(weight) || 0;
  const r = Number(rate) || 0;

  const totalWeight = Math.round(b * w * 100) / 100;
  const amount = Math.round(totalWeight * r * 100) / 100;

  return {
    totalWeight,
    amount,
  };
}

/**
 * Calculates Packing List Totals
 */
export function calculatePackingTotals(rows: PackingItemRow[]) {
  const totalBox = rows.reduce((acc, r) => acc + (Number(r.box) || 0), 0);
  const totalWeight = rows.reduce((acc, r) => acc + (Number(r.totalWeight) || 0), 0);
  const totalAmount = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  return {
    totalBox,
    totalWeight: Math.round(totalWeight * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Calculates Packing DB Total Amount (BDT) from Total Value (RMB) and editable RMB Rate:
 * Total Amount (BDT) = Total Value * RMB Rate
 */
export function calculatePackingTotalAmountBDT(
  totalValue: number,
  rmbRate?: number
): number {
  const val = Number(totalValue) || 0;
  const rate = Number(rmbRate) || 0;
  return Math.round(val * rate * 100) / 100;
}

/**
 * Calculates Cumulative Export Value (Total Amount BDT) from Packing DB records:
 * Sums Total Amount (BDT) = Total Value * RMB Rate for each record in Packing DB.
 */
export function calculateCumulativeExportValueBDT(
  packings: Array<{ totalAmount?: number; rmbRate?: number; totalAmountBDT?: number }>
): number {
  if (!Array.isArray(packings)) return 0;
  const total = packings.reduce((acc, pkg) => {
    const val = Number(pkg.totalAmount) || 0;
    if (pkg.rmbRate !== undefined) {
      return acc + calculatePackingTotalAmountBDT(val, pkg.rmbRate);
    }
    if (pkg.totalAmountBDT !== undefined) {
      return acc + (Number(pkg.totalAmountBDT) || 0);
    }
    return acc + calculatePackingTotalAmountBDT(val, pkg.rmbRate);
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Calculates Foreign RMB Remittance Value from Master Database Sheets & Batch Print Center
 * (Packing DB) TOTAL VALUE column (sum of pkg.totalAmount in RMB).
 */
export function calculateForeignRmbRemittanceValue(
  packings: Array<{ totalAmount?: number }>
): number {
  if (!Array.isArray(packings)) return 0;
  const total = packings.reduce((acc, pkg) => acc + (Number(pkg.totalAmount) || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Calculates Payment Row:
 * Balance = Debit Amount - Credit Amount
 */
export function calculatePaymentRow(debit: number, credit: number): number {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  return Math.round((d - c) * 100) / 100;
}

/**
 * Calculates Payment Form Totals
 */
export function calculatePaymentTotals(
  rows: PaymentItemRow[],
  previousAmount: number,
  paidAmount: number
) {
  const totalDebit = rows.reduce((acc, r) => acc + (Number(r.debitAmount) || 0), 0);
  const totalCredit = rows.reduce((acc, r) => acc + (Number(r.creditAmount) || 0), 0);
  const totalAmount = totalDebit;
  const prev = Number(previousAmount) || 0;
  const paid = Number(paidAmount) || 0;
  const balance = prev - paid;

  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    previousAmount: prev,
    paidAmount: paid,
    balance: Math.round(balance * 100) / 100,
  };
}

/**
 * Calculates Loss & Profit Analysis:
 * Collects data from Total Purchasing and Exporter Payment / Export Revenue and Other Costing
 */
export function calculateProfitLoss(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  rmbExchangeRate: number = 16.5
) {
  const totalPurchasing = purchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
  const totalExportValue = packings.reduce((acc, p) => {
    const val = Number(p.totalAmount) || 0;
    const rate = Number(p.rmbRate) || 0;
    if (rate > 0) {
      return acc + calculatePackingTotalAmountBDT(val, rate);
    }
    if (p.totalAmountBDT !== undefined && Number(p.totalAmountBDT) > 0) {
      return acc + (Number(p.totalAmountBDT) || 0);
    }
    return acc + val;
  }, 0);
  const totalWeightExported = packings.reduce((acc, p) => acc + (Number(p.totalWeight) || 0), 0);
  const totalPaymentMade = payments.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);
  
  // Total Return RMB converted to BDT/TK
  const totalReturnRMB = payments.reduce((acc, p) => acc + (Number(p.returnRMB) || 0), 0);
  const totalReturnRMBInBDT = Math.round(totalReturnRMB * rmbExchangeRate * 100) / 100;

  const totalOtherCosting = otherCosts.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

  // Gross profit = Total Export Revenue (or Exporter Payment collected) - Purchasing Cost
  const grossProfit = Math.round((totalExportValue - totalPurchasing) * 100) / 100;

  // Net profit = Gross profit - Other costing
  const netProfit = Math.round((grossProfit - totalOtherCosting) * 100) / 100;

  const marginPercent =
    totalExportValue > 0 ? Math.round((netProfit / totalExportValue) * 1000) / 10 : 0;

  return {
    totalPurchasing: Math.round(totalPurchasing * 100) / 100,
    totalExportValue: Math.round(totalExportValue * 100) / 100,
    totalWeightExported: Math.round(totalWeightExported * 100) / 100,
    totalPaymentMade: Math.round(totalPaymentMade * 100) / 100,
    totalReturnRMB: Math.round(totalReturnRMB * 100) / 100,
    totalReturnRMBInBDT,
    totalOtherCosting: Math.round(totalOtherCosting * 100) / 100,
    grossProfit,
    netProfit,
    marginPercent,
  };
}

/**
 * Format currency with commas and decimals
 */
export function formatCurrency(amount: number, currency: string = 'TK'): string {
  const val = Number(amount) || 0;
  return `${currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date to DD/MM/YYYY or readable
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Generates next sequential invoice number
 */
export function generateInvoiceNumber(prefix: string, count: number): string {
  const nextNum = (count + 1).toString().padStart(4, '0');
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${nextNum}`;
}

export interface MonthlySummaryResult {
  yearMonth: string;
  monthLabel: string;
  totalPurchases: number;
  totalExportValue: number;
  totalOtherCosts: number;
  grossProfit: number;
  netProfit: number;
  marginPercent: number;
  totalPurchaseQty: number;
  totalWeightExported: number;
  totalBoxesExported: number;
  totalPaymentsMade: number;
  totalReturnRMB: number;
  totalReturnRMBInBDT: number;
  purchaseCount: number;
  packingCount: number;
  paymentCount: number;
  otherCostCount: number;
}

/**
 * Formats a YYYY-MM string into a readable Month Year label (e.g. "October 2026")
 */
export function formatYearMonthLabel(yearMonth: string): string {
  if (!yearMonth || yearMonth === 'all') return 'All Time';
  const parts = yearMonth.split('-');
  if (parts.length < 2) return yearMonth;
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return yearMonth;
  }
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${monthNames[monthIndex]} ${year}`;
}

/**
 * Returns the YYYY-MM string for a given Date object (defaults to current local date)
 */
export function getCurrentYearMonth(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Calculates total purchases, total export value, and net profit for a target month (YYYY-MM)
 * or across all records when targetYearMonth === 'all'.
 */
export function calculateMonthlySummary(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  targetYearMonth: string = getCurrentYearMonth(),
  rmbExchangeRate: number = 16.5
): MonthlySummaryResult {
  const isAll = !targetYearMonth || targetYearMonth === 'all';
  const matchesMonth = (dateStr?: string) => {
    if (isAll) return true;
    if (!dateStr) return false;
    return dateStr.slice(0, 7) === targetYearMonth;
  };

  const monthPurchases = purchases.filter((p) => matchesMonth(p.date));
  const monthPackings = packings.filter((pk) => matchesMonth(pk.packingDate));
  const monthPayments = payments.filter((pm) => matchesMonth(pm.date));
  const monthOtherCosts = otherCosts.filter((c) => matchesMonth(c.date));

  const pl = calculateProfitLoss(
    monthPurchases,
    monthPackings,
    monthPayments,
    monthOtherCosts,
    rmbExchangeRate
  );

  const totalPurchaseQty = monthPurchases.reduce((acc, p) => acc + (Number(p.totalQty) || 0), 0);
  const totalBoxesExported = monthPackings.reduce((acc, pk) => acc + (Number(pk.totalBox) || 0), 0);

  return {
    yearMonth: isAll ? 'all' : targetYearMonth,
    monthLabel: formatYearMonthLabel(isAll ? 'all' : targetYearMonth),
    totalPurchases: pl.totalPurchasing,
    totalExportValue: pl.totalExportValue,
    totalOtherCosts: pl.totalOtherCosting,
    grossProfit: pl.grossProfit,
    netProfit: pl.netProfit,
    marginPercent: pl.marginPercent,
    totalPurchaseQty: Math.round(totalPurchaseQty * 100) / 100,
    totalWeightExported: pl.totalWeightExported,
    totalBoxesExported,
    totalPaymentsMade: pl.totalPaymentMade,
    totalReturnRMB: pl.totalReturnRMB,
    totalReturnRMBInBDT: pl.totalReturnRMBInBDT,
    purchaseCount: monthPurchases.length,
    packingCount: monthPackings.length,
    paymentCount: monthPayments.length,
    otherCostCount: monthOtherCosts.length,
  };
}

export interface MonthlyTrendPoint {
  yearMonth: string;
  shortMonthLabel: string;
  monthLabel: string;
  purchaseValue: number;
  exportValue: number;
  otherCosts: number;
  grossProfit: number;
  netProfit: number;
  marginPercent: number;
  purchaseVolume: number;
  exportWeight: number;
  exportBoxes: number;
  paymentsMade: number;
  purchaseCount: number;
  packingCount: number;
  paymentCount: number;
}

/**
 * Formats a YYYY-MM string into a short readable Month Year label (e.g. "Oct 2026")
 */
export function formatShortYearMonthLabel(yearMonth: string): string {
  if (!yearMonth || yearMonth === 'all') return 'All Time';
  const parts = yearMonth.split('-');
  if (parts.length < 2) return yearMonth;
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return yearMonth;
  }
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${shortMonthNames[monthIndex]} ${year}`;
}

/**
 * Computes monthly transaction trend points across a rolling window of months or active months.
 * Aggregates purchase volume/value, export weight/value, payments, and net profit per month.
 */
export function calculateMonthlyTrends(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  options: {
    monthsToShow?: number;
    endYearMonth?: string;
    activeOnly?: boolean;
    rmbExchangeRate?: number;
  } = {}
): MonthlyTrendPoint[] {
  const {
    monthsToShow = 6,
    endYearMonth,
    activeOnly = false,
    rmbExchangeRate = 16.5,
  } = options;

  const activeMonthsSet = new Set<string>();
  const addDateMonth = (dateStr?: string) => {
    if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
      activeMonthsSet.add(dateStr.slice(0, 7));
    }
  };

  purchases.forEach((p) => addDateMonth(p.date));
  packings.forEach((pk) => addDateMonth(pk.packingDate));
  payments.forEach((pm) => addDateMonth(pm.date));
  otherCosts.forEach((c) => addDateMonth(c.date));

  const sortedActiveMonths = Array.from(activeMonthsSet).sort((a, b) => a.localeCompare(b));
  const fallbackEndMonth = endYearMonth || sortedActiveMonths[sortedActiveMonths.length - 1] || getCurrentYearMonth();

  let targetMonths: string[] = [];

  if (activeOnly) {
    targetMonths = sortedActiveMonths.length > 0 ? sortedActiveMonths : [fallbackEndMonth];
    if (monthsToShow > 0 && targetMonths.length > monthsToShow) {
      targetMonths = targetMonths.slice(-monthsToShow);
    }
  } else {
    const parts = fallbackEndMonth.split('-');
    const endYear = Number(parts[0]) || new Date().getFullYear();
    const endMonthIdx = (Number(parts[1]) || new Date().getMonth() + 1) - 1;
    const count = Math.max(1, monthsToShow);

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(endYear, endMonthIdx - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      targetMonths.push(ym);
    }
  }

  return targetMonths.map((ym) => {
    const summary = calculateMonthlySummary(
      purchases,
      packings,
      payments,
      otherCosts,
      ym,
      rmbExchangeRate
    );

    return {
      yearMonth: ym,
      shortMonthLabel: formatShortYearMonthLabel(ym),
      monthLabel: summary.monthLabel,
      purchaseValue: summary.totalPurchases,
      exportValue: summary.totalExportValue,
      otherCosts: summary.totalOtherCosts,
      grossProfit: summary.grossProfit,
      netProfit: summary.netProfit,
      marginPercent: summary.marginPercent,
      purchaseVolume: summary.totalPurchaseQty,
      exportWeight: summary.totalWeightExported,
      exportBoxes: summary.totalBoxesExported,
      paymentsMade: summary.totalPaymentsMade,
      purchaseCount: summary.purchaseCount,
      packingCount: summary.packingCount,
      paymentCount: summary.paymentCount,
    };
  });
}

export interface SupplierLedgerStats {
  supplierName: string;
  invoiceCount: number;
  totalPurchasedQty: number;
  totalPurchasedValue: number;
  totalPaidAmount: number;
  latestClosingBalance: number;
  latestInvoiceDate: string;
  latestContactNumber: string;
}

/**
 * Computes historical purchase ledger stats for a specific supplier
 */
export function getSupplierLedgerStats(
  purchases: PurchaseRecord[],
  supplierName: string
): SupplierLedgerStats {
  const normalizedTarget = (supplierName || '').trim().toLowerCase();
  const matched = purchases
    .filter((p) => (p.description || '').trim().toLowerCase() === normalizedTarget)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalPurchasedQty = matched.reduce((acc, p) => acc + (Number(p.totalQty) || 0), 0);
  const totalPurchasedValue = matched.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
  const totalPaidAmount = matched.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);
  const latest = matched[0];

  return {
    supplierName: supplierName.trim(),
    invoiceCount: matched.length,
    totalPurchasedQty: Math.round(totalPurchasedQty * 100) / 100,
    totalPurchasedValue: Math.round(totalPurchasedValue * 100) / 100,
    totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
    latestClosingBalance: latest ? Math.round((Number(latest.balance) || 0) * 100) / 100 : 0,
    latestInvoiceDate: latest?.date || '',
    latestContactNumber: latest?.contactNumber || '',
  };
}

/**
 * Formats an amount in Chinese Yuan (RMB) with the ¥ prefix (e.g., ¥10,460.00)
 */
export function formatRMB(amount: number): string {
  const val = Number(amount) || 0;
  return `¥${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ExporterSlipFilterOptions {
  shippingMark?: string;
  packingDate?: string;
  flight?: string;
  status?: string;
  rmbExchangeRate?: number;
}

/**
 * Calculates Exporter Payment Slip Row Amount:
 * Amount = Weight * RMB
 */
export function calculateExporterSlipRowAmount(weightKg: number, rmb: number): number {
  const w = Number(weightKg) || 0;
  const r = Number(rmb) || 0;
  return Math.round(w * r * 100) / 100;
}

/**
 * Checks whether the active PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST) draft
 * has user-entered shipment data.
 */
export function isPackingFormDraftPopulated(
  draft?: PackingFormDraft | null
): boolean {
  if (!draft) return false;
  const hasHeader =
    (draft.shippingMark || '').trim() !== '' ||
    (draft.flight || '').trim() !== '';
  const hasRowData = Array.isArray(draft.rows)
    ? draft.rows.some(
        (r) =>
          (r.item || '').trim() !== '' ||
          (Number(r.box) || 0) > 0 ||
          (Number(r.weight) || 0) > 0 ||
          (Number(r.rate) || 0) > 0
      )
    : false;
  return hasHeader || hasRowData;
}

/**
 * Converts a live PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST) draft
 * into a PackingRecord so the Automatic Exporter Database Lookup collects it immediately.
 */
export function buildPackingRecordFromDraft(
  draft: PackingFormDraft,
  id: string = 'draft-packing-manifest'
): PackingRecord {
  const rows = Array.isArray(draft.rows) ? draft.rows : [];
  const { totalBox, totalWeight, totalAmount } = calculatePackingTotals(rows);
  const avgRatePerKg =
    totalWeight > 0 ? Math.round((totalAmount / totalWeight) * 100) / 100 : 0;

  const customRmbTrimmed = (draft.customRmbAmount || '').trim();
  const hasCustomRmb =
    customRmbTrimmed !== '' && !Number.isNaN(Number(customRmbTrimmed));
  const rmbRate = hasCustomRmb ? Number(customRmbTrimmed) : avgRatePerKg;
  const settledAmount = calculateExporterSlipRowAmount(totalWeight, rmbRate);
  const status = draft.paymentStatus || 'NO REPORT';
  const packingDate =
    (draft.packingDate || '').trim() || new Date().toISOString().slice(0, 10);

  return {
    id,
    invoiceNumber: (draft.invoiceNumber || 'PKG-DRAFT').trim(),
    shippingMark: (draft.shippingMark || '').trim(),
    flight: (draft.flight || '').trim(),
    destination: (draft.destination || '').trim(),
    shipper: (draft.shipper || '').trim(),
    packingDate,
    fromDate: packingDate,
    toDate: packingDate,
    items: rows.filter(
      (r) =>
        (r.item || '').trim() !== '' ||
        (Number(r.box) || 0) > 0 ||
        (Number(r.weight) || 0) > 0 ||
        (Number(r.rate) || 0) > 0
    ),
    totalBox,
    totalWeight,
    totalAmount,
    rmbAmount: Math.round(rmbRate * 100) / 100,
    settledAmount,
    exporterStatus: status,
    paymentStatus: status,
    paymentDate: status === 'PAID' ? packingDate : '',
    billSite: (draft.destination || '').trim(),
    remarks: draft.remarks || '',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Collects all Packing List records from the PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST),
 * combining saved PackingRecords with any active/unsaved draft in the Packing List Form.
 */
export function collectPackingManifestRecords(
  packings: PackingRecord[],
  draft?: PackingFormDraft | null,
  editingPackingId?: string | null
): PackingRecord[] {
  const safePackings = Array.isArray(packings) ? packings : [];

  if (!isPackingFormDraftPopulated(draft) || !draft) {
    return safePackings;
  }

  if (editingPackingId) {
    const editedRecord = buildPackingRecordFromDraft(draft, editingPackingId);
    const exists = safePackings.some((p) => p.id === editingPackingId);
    if (exists) {
      return safePackings.map((p) => (p.id === editingPackingId ? editedRecord : p));
    }
    return [editedRecord, ...safePackings];
  }

  // Only include unsaved draft if it has a shippingMark or positive box/weight
  const draftRecord = buildPackingRecordFromDraft(draft, 'draft-packing-manifest');
  if (!draftRecord.shippingMark && draftRecord.totalBox === 0 && draftRecord.totalWeight === 0) {
    return safePackings;
  }

  // Avoid duplicating if a saved record already matches invoiceNumber + mark + date + box + weight
  const alreadySaved = safePackings.some(
    (p) =>
      p.invoiceNumber === draftRecord.invoiceNumber &&
      p.shippingMark.trim().toLowerCase() === draftRecord.shippingMark.trim().toLowerCase() &&
      p.packingDate === draftRecord.packingDate &&
      Number(p.totalBox) === draftRecord.totalBox &&
      Number(p.totalWeight) === draftRecord.totalWeight
  );

  if (alreadySaved) {
    return safePackings;
  }

  return [draftRecord, ...safePackings];
}

export interface PackingLookupMarkSummary {
  mark: string;
  manifestCount: number;
  totalBoxes: number;
  totalWeightKg: number;
  latestDate: string;
  flights: string[];
}

export interface PackingLookupOptionsResult {
  marks: PackingLookupMarkSummary[];
  dbMarks: string[];
  markDates: string[];
  otherDates: string[];
  allDates: string[];
  flights: string[];
  statuses: string[];
}

/**
 * Extracts all Shipping Marks, Packing Dates, Flights, and Statuses directly from
 * PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST) records for the
 * Automatic Exporter Database Lookup (Select Shipping Mark & Packing Date).
 */
export function extractPackingLookupOptions(
  packings: PackingRecord[],
  selectedMark: string = 'ALL',
  selectedDate: string = 'ALL'
): PackingLookupOptionsResult {
  const safePackings = Array.isArray(packings) ? packings : [];
  const markMap = new Map<string, PackingLookupMarkSummary>();

  for (const pkg of safePackings) {
    const rawMark = (pkg.shippingMark || '').trim();
    if (!rawMark) continue;
    const key = rawMark.toUpperCase();
    const existing = markMap.get(key);
    const box = Number(pkg.totalBox) || 0;
    const weight = Number(pkg.totalWeight) || 0;
    const date = (pkg.packingDate || '').trim();
    const flight = (pkg.flight || '').trim();

    if (existing) {
      existing.manifestCount += 1;
      existing.totalBoxes += box;
      existing.totalWeightKg = Math.round((existing.totalWeightKg + weight) * 100) / 100;
      if (date && date > existing.latestDate) {
        existing.latestDate = date;
      }
      if (flight && !existing.flights.includes(flight)) {
        existing.flights.push(flight);
      }
    } else {
      markMap.set(key, {
        mark: rawMark,
        manifestCount: 1,
        totalBoxes: box,
        totalWeightKg: Math.round(weight * 100) / 100,
        latestDate: date,
        flights: flight ? [flight] : [],
      });
    }
  }

  const marks = Array.from(markMap.values());
  const dbMarks = marks.map((m) => m.mark);

  const normalizedSelectedMark = (selectedMark || 'ALL').trim().toLowerCase();
  const normalizedSelectedDate = (selectedDate || 'ALL').trim();

  const matchingMarkPackings =
    normalizedSelectedMark === 'all' || normalizedSelectedMark === ''
      ? safePackings
      : safePackings.filter(
          (p) => (p.shippingMark || '').trim().toLowerCase() === normalizedSelectedMark
        );

  const markDates = Array.from(
    new Set(matchingMarkPackings.map((p) => (p.packingDate || '').trim()).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  const allDates = Array.from(
    new Set(safePackings.map((p) => (p.packingDate || '').trim()).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  const otherDates =
    normalizedSelectedMark === 'all' || normalizedSelectedMark === ''
      ? allDates
      : allDates.filter((d) => !markDates.includes(d));

  const matchingForFlights = matchingMarkPackings.filter((p) =>
    normalizedSelectedDate === 'ALL' ||
    normalizedSelectedDate === 'all' ||
    normalizedSelectedDate === ''
      ? true
      : (p.packingDate || '').trim() === normalizedSelectedDate
  );

  const flights = Array.from(
    new Set([
      ...matchingForFlights.map((p) => (p.flight || '').trim()).filter(Boolean),
      ...safePackings.map((p) => (p.flight || '').trim()).filter(Boolean),
    ])
  );

  const dbStatuses = safePackings
    .map((p) => (p.exporterStatus || p.paymentStatus || '').trim())
    .filter(Boolean);
  const statuses = Array.from(new Set(['NO REPORT', 'REPORT', 'PAID', ...dbStatuses]));

  return {
    marks,
    dbMarks,
    markDates,
    otherDates,
    allDates,
    flights,
    statuses,
  };
}

/**
 * Automatically builds Exporter Payment Slip rows from the PACKING LIST DATA ENTRY FORM
 * (AIR FREIGHT EXPORT MANIFEST) records filtered by Shipping Mark and Packing Date dropdown selections.
 * Calculation: Weight * RMB = Amount
 */
export function buildExporterPaymentSlipRows(
  packings: PackingRecord[],
  payments: PaymentRecord[] = [],
  filters: ExporterSlipFilterOptions = {}
): ExporterPaymentSlipRow[] {
  const {
    shippingMark = 'ALL',
    packingDate = 'ALL',
    flight = 'ALL',
    status = 'ALL',
    rmbExchangeRate = 16.5,
  } = filters;

  const rate = Number(rmbExchangeRate) > 0 ? Number(rmbExchangeRate) : 16.5;
  const markTarget = (shippingMark || 'ALL').trim().toLowerCase();
  const dateTarget = (packingDate || 'ALL').trim();
  const flightTarget = (flight || 'ALL').trim().toLowerCase();
  const statusTarget = (status || 'ALL').trim().toLowerCase();

  const matchedPackings = packings.filter((pkg) => {
    if (markTarget !== 'all' && markTarget !== '' && (pkg.shippingMark || '').trim().toLowerCase() !== markTarget) {
      return false;
    }
    if (dateTarget !== 'ALL' && dateTarget !== 'all' && dateTarget !== '' && pkg.packingDate !== dateTarget) {
      return false;
    }
    if (flightTarget !== 'all' && flightTarget !== '' && (pkg.flight || '').trim().toLowerCase() !== flightTarget) {
      return false;
    }
    return true;
  });

  const rows: ExporterPaymentSlipRow[] = matchedPackings.map((pkg) => {
    const linkedPayment = payments.find(
      (pm) =>
        (pm.exportGoodsRef && pm.exportGoodsRef.trim().toLowerCase() === pkg.invoiceNumber.trim().toLowerCase()) ||
        (pm.description && pm.description.trim().toLowerCase() === pkg.shippingMark.trim().toLowerCase())
    );

    const itemTotals =
      Array.isArray(pkg.items) && pkg.items.length > 0
        ? calculatePackingTotals(pkg.items)
        : { totalBox: 0, totalWeight: 0, totalAmount: 0 };

    const box = Number(pkg.totalBox) || itemTotals.totalBox || 0;
    const rawWeight = Number(pkg.totalWeight) || itemTotals.totalWeight || 0;
    const weightKg = Math.round(rawWeight * 100) / 100;
    const rawTotalAmount = Number(pkg.totalAmount) || itemTotals.totalAmount || 0;

    const computedStatus =
      pkg.exporterStatus || pkg.paymentStatus || linkedPayment?.status || 'REPORT';

    let computedRmb = 0;
    if (pkg.rmbAmount !== undefined && Number(pkg.rmbAmount) > 0) {
      computedRmb = Number(pkg.rmbAmount);
    } else if (
      computedStatus === 'NO REPORT' &&
      (pkg.rmbAmount === 0 || rawTotalAmount === 0)
    ) {
      computedRmb = 0;
    } else if (linkedPayment && Number(linkedPayment.returnRMB) > 0) {
      computedRmb = Number(linkedPayment.returnRMB);
    } else if (
      Array.isArray(pkg.items) &&
      pkg.items.length > 0 &&
      weightKg > 0 &&
      rawTotalAmount > 0
    ) {
      // Derive the per-KG rate directly from the Packing List Data Entry Form items
      computedRmb = Math.round((rawTotalAmount / weightKg) * 100) / 100;
    } else if (rawTotalAmount > 0) {
      computedRmb = Math.round((rawTotalAmount / rate) * 100) / 100;
    }

    const rmb = Math.round(computedRmb * 100) / 100;
    const computedAmount = calculateExporterSlipRowAmount(weightKg, rmb);

    return {
      id: pkg.id,
      packingId: pkg.id,
      invoiceNumber: pkg.invoiceNumber,
      date: pkg.packingDate,
      flight: pkg.flight,
      mark: pkg.shippingMark,
      box,
      weightKg,
      rmb,
      amount: computedAmount,
      status: computedStatus,
      destination: pkg.destination,
      shipper: pkg.shipper,
      isDraft: pkg.id === 'draft-packing-manifest',
    };
  });

  if (statusTarget !== 'all' && statusTarget !== '') {
    return rows.filter((r) => (r.status || '').trim().toLowerCase() === statusTarget);
  }

  return rows;
}

/**
 * Calculates Grand Totals for the Exporter Payment Slip (BOX, WEIGHT/KG, RMB, AMOUNT)
 */
export function calculateExporterSlipTotals(
  rows: Array<{ box?: number; weightKg?: number; rmb?: number; amount?: number }>
) {
  const totalBox = rows.reduce((acc, r) => acc + (Number(r.box) || 0), 0);
  const totalWeightKg = rows.reduce((acc, r) => acc + (Number(r.weightKg) || 0), 0);
  const totalRmb = rows.reduce((acc, r) => acc + (Number(r.rmb) || 0), 0);
  const totalAmount = rows.reduce((acc, r) => {
    const rowWeight = Number(r.weightKg) || 0;
    const rowRmb = Number(r.rmb) || 0;
    const computed =
      rowWeight > 0 && rowRmb > 0
        ? calculateExporterSlipRowAmount(rowWeight, rowRmb)
        : Number(r.amount) || 0;
    return acc + computed;
  }, 0);

  return {
    totalBox,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
    totalRmb: Math.round(totalRmb * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

export const DEFAULT_EXPORTER_SLIP_ROWS = 3;

/**
 * Generates a clean, deterministic filename for exporting the Exporter Payment Slip (付款单)
 * as either a .pdf or .png file.
 */
export function formatExporterSlipExportFilename(
  shippingMark: string = 'ALL',
  packingDate: string = 'ALL',
  extension: 'pdf' | 'png' = 'png',
  referenceDateStr?: string
): string {
  const cleanMark =
    shippingMark && shippingMark !== 'ALL'
      ? shippingMark.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'ALL_MARKS';
  const fallbackDate = referenceDateStr ?? new Date().toISOString().slice(0, 10);
  const cleanDate =
    packingDate && packingDate !== 'ALL'
      ? packingDate.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
      : fallbackDate;
  const ext = extension.toLowerCase() === 'pdf' ? 'pdf' : 'png';
  return `ZSB_AQUATICS_Payment_Slip_${cleanMark}_${cleanDate}.${ext}`;
}


/**
 * Creates a blank/custom row for the Exporter Payment Slip (付款单) form
 * Calculation: Weight * RMB = Amount
 */
export function createEmptyExporterSlipRow(
  id: string,
  defaults: Partial<ExporterPaymentSlipRow> = {}
): ExporterPaymentSlipRow {
  const weightKg = Number(defaults.weightKg) || 0;
  const rmb = Number(defaults.rmb) || 0;
  const computedAmount = calculateExporterSlipRowAmount(weightKg, rmb);
  const amount =
    weightKg > 0 && rmb > 0
      ? computedAmount
      : defaults.amount !== undefined
      ? Number(defaults.amount) || 0
      : computedAmount;

  return {
    id,
    isCustom: true,
    date: defaults.date ?? new Date().toISOString().slice(0, 10),
    flight: defaults.flight ?? '',
    mark: defaults.mark ?? '',
    box: Number(defaults.box) || 0,
    weightKg,
    rmb,
    amount,
    status: defaults.status ?? 'REPORT',
  };
}

/**
 * Creates the default initial 3 blank rows for the Exporter Payment Slip (付款单)
 */
export function createInitialExporterSlipRows(
  count: number = DEFAULT_EXPORTER_SLIP_ROWS,
  defaultDate?: string
): ExporterPaymentSlipRow[] {
  const today = defaultDate ?? new Date().toISOString().slice(0, 10);
  return Array.from({ length: count }, (_, idx) =>
    createEmptyExporterSlipRow(`slip-row-${idx + 1}`, { date: today })
  );
}

/**
 * Checks if an Exporter Payment Slip row has any user-entered or DB-synced values
 */
export function isExporterSlipRowPopulated(
  row: ExporterPaymentSlipRow | null | undefined
): boolean {
  if (!row) return false;
  if (row.packingId) return true;
  return (
    (row.flight || '').trim() !== '' ||
    (row.mark || '').trim() !== '' ||
    (Number(row.box) || 0) > 0 ||
    (Number(row.weightKg) || 0) > 0 ||
    (Number(row.rmb) || 0) > 0 ||
    (Number(row.amount) || 0) > 0
  );
}

/**
 * Merges auto-synced database rows with custom/manual rows added in the Payment Slip form
 * and ensures Weight * RMB = Amount calculation on all rows.
 */
export function mergeExporterPaymentSlipRows(
  dbRows: ExporterPaymentSlipRow[],
  customRows: ExporterPaymentSlipRow[],
  filters: ExporterSlipFilterOptions = {}
): ExporterPaymentSlipRow[] {
  const {
    shippingMark = 'ALL',
    packingDate = 'ALL',
    flight = 'ALL',
    status = 'ALL',
  } = filters;

  const markTarget = (shippingMark || 'ALL').trim().toLowerCase();
  const dateTarget = (packingDate || 'ALL').trim();
  const flightTarget = (flight || 'ALL').trim().toLowerCase();
  const statusTarget = (status || 'ALL').trim().toLowerCase();

  const dbMarksSet = new Set(
    dbRows.map((r) => (r.mark || '').trim().toLowerCase()).filter(Boolean)
  );

  // Clean up any custom row that only had a placeholder mark (0 box, 0 weight, 0 rmb, no flight)
  // when a real Packing List record already exists for that mark.
  const sanitizedCustomRows = customRows.map((row) => {
    const hasOnlyPlaceholderMark =
      !row.packingId &&
      (row.mark || '').trim() !== '' &&
      (row.flight || '').trim() === '' &&
      (Number(row.box) || 0) === 0 &&
      (Number(row.weightKg) || 0) === 0 &&
      (Number(row.rmb) || 0) === 0 &&
      (Number(row.amount) || 0) === 0;
    if (
      hasOnlyPlaceholderMark &&
      (dbRows.length > 0 || dbMarksSet.has((row.mark || '').trim().toLowerCase()))
    ) {
      return { ...row, mark: '' };
    }
    return row;
  });

  const matchingCustomRows = sanitizedCustomRows
    .filter((row) => {
      // Always keep unpopulated blank custom rows visible so user can type into newly added rows
      if (!isExporterSlipRowPopulated(row)) {
        return true;
      }

      const rowMark = (row.mark || '').trim().toLowerCase();
      if (markTarget !== 'all' && markTarget !== '' && rowMark !== '' && rowMark !== markTarget) {
        return false;
      }

      const rowDate = (row.date || '').trim();
      if (dateTarget !== 'ALL' && dateTarget !== 'all' && dateTarget !== '' && rowDate !== '' && rowDate !== dateTarget) {
        return false;
      }

      const rowFlight = (row.flight || '').trim().toLowerCase();
      if (flightTarget !== 'all' && flightTarget !== '' && rowFlight !== '' && rowFlight !== flightTarget) {
        return false;
      }

      const rowStatus = (row.status || '').trim().toLowerCase();
      if (statusTarget !== 'all' && statusTarget !== '' && rowStatus !== '' && rowStatus !== statusTarget) {
        return false;
      }

      return true;
    })
    .map((row) => {
      const weightKg = Number(row.weightKg) || 0;
      const rmb = Number(row.rmb) || 0;
      return {
        ...row,
        amount:
          weightKg > 0 || rmb > 0
            ? calculateExporterSlipRowAmount(weightKg, rmb)
            : Number(row.amount) || 0,
      };
    });

  const normalizedDbRows = dbRows.map((row) => {
    const weightKg = Number(row.weightKg) || 0;
    const rmb = Number(row.rmb) || 0;
    return {
      ...row,
      amount: calculateExporterSlipRowAmount(weightKg, rmb),
    };
  });

  // Cap unpopulated default initial rows (slip-row-*) so default sheet has 3 rows total
  const occupiedInitialSlots =
    normalizedDbRows.length +
    matchingCustomRows.filter(
      (r) => isExporterSlipRowPopulated(r) && r.id.startsWith('slip-row-')
    ).length;
  let remainingDefaultBlanks = Math.max(0, DEFAULT_EXPORTER_SLIP_ROWS - occupiedInitialSlots);

  const finalCustomRows = matchingCustomRows.filter((row) => {
    if (!isExporterSlipRowPopulated(row) && row.id.startsWith('slip-row-')) {
      if (remainingDefaultBlanks > 0) {
        remainingDefaultBlanks -= 1;
        return true;
      }
      return false;
    }
    return true;
  });

  return [...normalizedDbRows, ...finalCustomRows];
}

/**
 * Classifies whether a PaymentRecord belongs to the Supplier Payment ledger
 * or the Exporter Payment ledger.
 */
export function classifyPaymentCategory(record: PaymentRecord): 'supplier' | 'exporter' {
  if (record.paymentCategory === 'supplier' || record.paymentCategory === 'exporter') {
    return record.paymentCategory;
  }
  const inv = (record.invoiceNumber || '').trim().toUpperCase();
  if (inv.startsWith('EXP-') || Boolean(record.shippingMark && record.shippingMark.trim())) {
    return 'exporter';
  }
  return 'supplier';
}

export interface SupplierPaymentStats {
  supplierName: string;
  purchaseInvoiceCount: number;
  paymentVoucherCount: number;
  totalPurchasedValue: number;
  totalPaidInPurchases: number;
  totalPaidInVouchers: number;
  latestBalance: number;
  latestContactNumber: string;
  latestTransactionDate: string;
}

/**
 * Computes combined Supplier Purchase + Supplier Payment Voucher ledger stats
 * for the dedicated Supplier Payment Data Entry Form.
 */
export function getSupplierPaymentStats(
  purchases: PurchaseRecord[],
  payments: PaymentRecord[],
  supplierName: string
): SupplierPaymentStats {
  const target = (supplierName || '').trim().toLowerCase();

  const matchedPurchases = purchases
    .filter((p) => (p.description || '').trim().toLowerCase() === target)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const matchedPayments = payments
    .filter(
      (pm) =>
        classifyPaymentCategory(pm) === 'supplier' &&
        (pm.description || '').trim().toLowerCase() === target
    )
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalPurchasedValue = matchedPurchases.reduce(
    (acc, p) => acc + (Number(p.totalAmount) || 0),
    0
  );
  const totalPaidInPurchases = matchedPurchases.reduce(
    (acc, p) => acc + (Number(p.paidAmount) || 0),
    0
  );
  const totalPaidInVouchers = matchedPayments.reduce(
    (acc, pm) => acc + (Number(pm.paidAmount) || 0),
    0
  );

  const latestPurchase = matchedPurchases[0];
  const latestPayment = matchedPayments[0];

  let latestBalance = 0;
  let latestTransactionDate = '';
  if (latestPayment && latestPurchase) {
    if ((latestPayment.date || '') >= (latestPurchase.date || '')) {
      latestBalance = Number(latestPayment.balance) || 0;
      latestTransactionDate = latestPayment.date;
    } else {
      latestBalance = Number(latestPurchase.balance) || 0;
      latestTransactionDate = latestPurchase.date;
    }
  } else if (latestPayment) {
    latestBalance = Number(latestPayment.balance) || 0;
    latestTransactionDate = latestPayment.date;
  } else if (latestPurchase) {
    latestBalance = Number(latestPurchase.balance) || 0;
    latestTransactionDate = latestPurchase.date;
  }

  return {
    supplierName: (supplierName || '').trim(),
    purchaseInvoiceCount: matchedPurchases.length,
    paymentVoucherCount: matchedPayments.length,
    totalPurchasedValue: Math.round(totalPurchasedValue * 100) / 100,
    totalPaidInPurchases: Math.round(totalPaidInPurchases * 100) / 100,
    totalPaidInVouchers: Math.round(totalPaidInVouchers * 100) / 100,
    latestBalance: Math.round(latestBalance * 100) / 100,
    latestContactNumber:
      latestPayment?.contactNumber || latestPurchase?.contactNumber || '',
    latestTransactionDate,
  };
}

export interface ExporterManifestStats {
  shippingMark: string;
  manifestCount: number;
  exporterVoucherCount: number;
  totalBoxes: number;
  totalWeightKg: number;
  totalExportValueBDT: number;
  estimatedTotalRMB: number;
  totalSettledRMB: number;
  totalSettledBDT: number;
  pendingBalanceBDT: number;
  latestManifestRef: string;
  latestPackingDate: string;
  latestFlight: string;
  latestDestination: string;
  latestShipper: string;
  latestStatus: string;
}

/**
 * Computes combined Export Packing List + Exporter Payment Voucher stats
 * for a given Shipping Mark or Exporter in the dedicated Exporter Payment Data Entry Form.
 */
export function getExporterManifestStats(
  packings: PackingRecord[],
  payments: PaymentRecord[],
  shippingMark: string,
  rmbExchangeRate: number = 16.5
): ExporterManifestStats {
  const target = (shippingMark || '').trim().toLowerCase();
  const rate = Number(rmbExchangeRate) > 0 ? Number(rmbExchangeRate) : 16.5;

  const matchedPackings = packings
    .filter((pk) => (pk.shippingMark || '').trim().toLowerCase() === target)
    .sort((a, b) => (b.packingDate || '').localeCompare(a.packingDate || ''));

  const matchedPayments = payments
    .filter((pm) => {
      if (classifyPaymentCategory(pm) !== 'exporter') return false;
      const pmMark = (pm.shippingMark || '').trim().toLowerCase();
      const pmDesc = (pm.description || '').trim().toLowerCase();
      return pmMark === target || pmDesc.includes(target);
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalBoxes = matchedPackings.reduce((acc, pk) => acc + (Number(pk.totalBox) || 0), 0);
  const totalWeightKg = matchedPackings.reduce(
    (acc, pk) => acc + (Number(pk.totalWeight) || 0),
    0
  );
  const totalExportValueBDT = matchedPackings.reduce(
    (acc, pk) => acc + (Number(pk.totalAmount) || 0),
    0
  );
  const estimatedTotalRMB = Math.round((totalExportValueBDT / rate) * 100) / 100;

  const totalSettledRMB = matchedPayments.reduce(
    (acc, pm) => acc + (Number(pm.returnRMB) || 0),
    0
  );
  const totalSettledBDT = matchedPayments.reduce(
    (acc, pm) => acc + (Number(pm.paidAmount) || 0),
    0
  );

  const latestManifest = matchedPackings[0];
  const latestVoucher = matchedPayments[0];

  const pendingBalanceBDT =
    latestVoucher !== undefined
      ? Math.round((Number(latestVoucher.balance) || 0) * 100) / 100
      : Math.max(0, Math.round((totalExportValueBDT - totalSettledBDT) * 100) / 100);

  return {
    shippingMark: (shippingMark || '').trim(),
    manifestCount: matchedPackings.length,
    exporterVoucherCount: matchedPayments.length,
    totalBoxes,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
    totalExportValueBDT: Math.round(totalExportValueBDT * 100) / 100,
    estimatedTotalRMB,
    totalSettledRMB: Math.round(totalSettledRMB * 100) / 100,
    totalSettledBDT: Math.round(totalSettledBDT * 100) / 100,
    pendingBalanceBDT,
    latestManifestRef: latestManifest?.invoiceNumber || '',
    latestPackingDate: latestManifest?.packingDate || '',
    latestFlight: latestManifest?.flight || '',
    latestDestination: latestManifest?.destination || '',
    latestShipper: latestManifest?.shipper || '',
    latestStatus: latestVoucher?.status || latestManifest?.exporterStatus || 'REPORT',
  };
}

export interface TopSupplierStat {
  rank: number;
  supplierName: string;
  shortName: string;
  totalVolume: number;
  totalAmount: number;
  invoiceCount: number;
  avgRatePerUnit: number;
  volumeSharePercent: number;
  latestDate: string;
}

/**
 * Aggregates purchase records by supplier and returns the top N suppliers
 * ranked by total purchase volume (KG) descending.
 */
export function getTopSuppliersByVolume(
  purchases: PurchaseRecord[],
  limit: number = 5,
  targetYearMonth: string = 'all'
): TopSupplierStat[] {
  const isAll = !targetYearMonth || targetYearMonth === 'all';
  const filtered = isAll
    ? purchases
    : purchases.filter((p) => (p.date || '').slice(0, 7) === targetYearMonth);

  const map = new Map<
    string,
    {
      displayName: string;
      totalVolume: number;
      totalAmount: number;
      invoiceCount: number;
      latestDate: string;
    }
  >();

  let overallVolume = 0;

  for (const p of filtered) {
    const rawName = (p.description || '').trim() || 'UNKNOWN SUPPLIER';
    const key = rawName.toLowerCase();
    const qty = Number(p.totalQty) || 0;
    const amt = Number(p.totalAmount) || 0;
    overallVolume += qty;

    const existing = map.get(key);
    if (existing) {
      existing.totalVolume += qty;
      existing.totalAmount += amt;
      existing.invoiceCount += 1;
      if ((p.date || '') > existing.latestDate) {
        existing.latestDate = p.date || '';
      }
    } else {
      map.set(key, {
        displayName: rawName,
        totalVolume: qty,
        totalAmount: amt,
        invoiceCount: 1,
        latestDate: p.date || '',
      });
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.totalVolume !== a.totalVolume) return b.totalVolume - a.totalVolume;
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return a.displayName.localeCompare(b.displayName);
  });

  const maxItems = Math.max(1, limit);
  return sorted.slice(0, maxItems).map((entry, idx) => {
    const totalVolume = Math.round(entry.totalVolume * 100) / 100;
    const totalAmount = Math.round(entry.totalAmount * 100) / 100;
    const avgRatePerUnit =
      totalVolume > 0 ? Math.round((totalAmount / totalVolume) * 100) / 100 : 0;
    const volumeSharePercent =
      overallVolume > 0 ? Math.round((entry.totalVolume / overallVolume) * 1000) / 10 : 0;
    const shortName =
      entry.displayName.length > 16
        ? `${entry.displayName.slice(0, 14).trim()}…`
        : entry.displayName;

    return {
      rank: idx + 1,
      supplierName: entry.displayName,
      shortName,
      totalVolume,
      totalAmount,
      invoiceCount: entry.invoiceCount,
      avgRatePerUnit,
      volumeSharePercent,
      latestDate: entry.latestDate,
    };
  });
}

/**
 * Formats a clean export filename for Purchase Challan / Data Entry Form (.pdf or .png)
 */
export function formatPurchaseExportFilename(
  invoiceNumber: string,
  supplierName: string,
  date: string,
  extension: 'pdf' | 'png' = 'pdf'
): string {
  const sanitize = (str: string) =>
    (str || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const cleanInv = sanitize(invoiceNumber) || 'PUR';
  const cleanSupplier = sanitize(supplierName);
  const cleanDate = sanitize(date) || new Date().toISOString().slice(0, 10);
  const cleanExt = extension.toLowerCase() === 'png' ? 'png' : 'pdf';

  const parts = ['ZSB_AQUATICS_Purchase_Challan', cleanInv];
  if (cleanSupplier) {
    parts.push(cleanSupplier);
  }
  parts.push(cleanDate);

  return `${parts.join('_')}.${cleanExt}`;
}

/**
 * Formats a clean export filename for Export Packing List Manifest (.pdf or .png)
 */
export function formatPackingExportFilename(
  invoiceNumber: string,
  shippingMark: string = '',
  date: string = '',
  extension: 'pdf' | 'png' = 'pdf'
): string {
  const sanitize = (str: string) =>
    (str || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const cleanInv = sanitize(invoiceNumber) || 'PKG';
  const cleanMark = sanitize(shippingMark);
  const cleanDate = sanitize(date) || new Date().toISOString().slice(0, 10);
  const cleanExt = extension.toLowerCase() === 'png' ? 'png' : 'pdf';

  const parts = ['ZSB_AQUATICS_Export_Packing_List', cleanInv];
  if (cleanMark) {
    parts.push(cleanMark);
  }
  parts.push(cleanDate);

  return `${parts.join('_')}.${cleanExt}`;
}

export interface PackingConsignmentSummary {
  totalConsignments: number;
  totalCumulativeWeightKg: number;
  totalBoxes: number;
  avgWeightPerConsignmentKg: number;
  avgWeightPerBoxKg: number;
  uniqueShippingMarksCount: number;
  uniqueDestinations: string[];
  paidConsignmentsCount: number;
  pendingConsignmentsCount: number;
  latestConsignmentDate: string;
  latestInvoiceNumber: string;
}

/**
 * Calculates the cumulative export weight (KG), total consignments processed,
 * carton count, and averages directly from the Packing List database (packings).
 */
export function calculatePackingConsignmentSummary(
  packings: PackingRecord[]
): PackingConsignmentSummary {
  const safePackings = Array.isArray(packings) ? packings : [];
  const totalConsignments = safePackings.length;

  let rawTotalWeight = 0;
  let totalBoxes = 0;
  let paidConsignmentsCount = 0;
  const markSet = new Set<string>();
  const destinationSet = new Set<string>();
  let latestConsignmentDate = '';
  let latestInvoiceNumber = '';

  for (const pkg of safePackings) {
    const itemTotals =
      Array.isArray(pkg.items) && pkg.items.length > 0
        ? calculatePackingTotals(pkg.items)
        : { totalBox: 0, totalWeight: 0, totalAmount: 0 };

    const recordWeight =
      Number(pkg.totalWeight) > 0 ? Number(pkg.totalWeight) : itemTotals.totalWeight;
    const recordBoxes =
      Number(pkg.totalBox) > 0 ? Number(pkg.totalBox) : itemTotals.totalBox;

    rawTotalWeight += recordWeight;
    totalBoxes += recordBoxes;

    const mark = (pkg.shippingMark || '').trim();
    if (mark) {
      markSet.add(mark.toUpperCase());
    }

    const dest = (pkg.destination || '').trim();
    if (dest) {
      destinationSet.add(dest.toUpperCase());
    }

    const status = (pkg.paymentStatus || pkg.exporterStatus || '').trim().toUpperCase();
    if (status === 'PAID') {
      paidConsignmentsCount += 1;
    }

    const pDate = (pkg.packingDate || '').trim();
    if (pDate && (!latestConsignmentDate || pDate >= latestConsignmentDate)) {
      latestConsignmentDate = pDate;
      latestInvoiceNumber = (pkg.invoiceNumber || '').trim();
    } else if (!latestInvoiceNumber && pkg.invoiceNumber) {
      latestInvoiceNumber = pkg.invoiceNumber.trim();
    }
  }

  const totalCumulativeWeightKg = Math.round(rawTotalWeight * 100) / 100;
  const avgWeightPerConsignmentKg =
    totalConsignments > 0
      ? Math.round((totalCumulativeWeightKg / totalConsignments) * 100) / 100
      : 0;
  const avgWeightPerBoxKg =
    totalBoxes > 0
      ? Math.round((totalCumulativeWeightKg / totalBoxes) * 100) / 100
      : 0;

  return {
    totalConsignments,
    totalCumulativeWeightKg,
    totalBoxes,
    avgWeightPerConsignmentKg,
    avgWeightPerBoxKg,
    uniqueShippingMarksCount: markSet.size,
    uniqueDestinations: Array.from(destinationSet),
    paidConsignmentsCount,
    pendingConsignmentsCount: Math.max(0, totalConsignments - paidConsignmentsCount),
    latestConsignmentDate,
    latestInvoiceNumber,
  };
}

export interface MonthlyExportsPurchasesReportItem {
  yearMonth: string;
  monthLabel: string;
  shortMonthLabel: string;
  year: string;
  purchaseVolume: number;
  purchaseValue: number;
  purchaseCount: number;
  exportWeight: number;
  exportBoxes: number;
  exportValueRMB: number;
  exportValueBDT: number;
  exportCount: number;
  otherCosts: number;
  netProfit: number;
  marginPercent: number;
}

export interface MonthlyReportsSummaryTotals {
  totalPurchaseVolume: number;
  totalPurchaseValue: number;
  totalPurchaseCount: number;
  totalExportWeight: number;
  totalExportBoxes: number;
  totalExportValueRMB: number;
  totalExportValueBDT: number;
  totalExportCount: number;
  totalOtherCosts: number;
  totalNetProfit: number;
  overallMarginPercent: number;
}

/**
 * Computes consolidated monthly summary reports of all exports and purchases.
 * Groups by YYYY-MM and calculates volume (KG), monetary amounts (BDT & RMB),
 * consignment counts, purchase counts, other costing, and net profit.
 */
export function calculateAllMonthlyReports(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  otherCosts: OtherCostRecord[] = [],
  rmbExchangeRate: number = 16.5
): {
  items: MonthlyExportsPurchasesReportItem[];
  totals: MonthlyReportsSummaryTotals;
  availableYears: string[];
} {
  const monthSet = new Set<string>();

  const extractMonth = (dateStr?: string) => {
    if (dateStr && /^\d{4}-\d{2}/.test(dateStr.trim())) {
      monthSet.add(dateStr.trim().slice(0, 7));
    }
  };

  purchases.forEach((p) => extractMonth(p.date));
  packings.forEach((pk) => extractMonth(pk.packingDate));
  otherCosts.forEach((c) => extractMonth(c.date));

  // If no records exist, ensure current month is represented
  if (monthSet.size === 0) {
    monthSet.add(getCurrentYearMonth());
  }

  // Sort months descending (latest first)
  const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  const yearSet = new Set<string>();

  const items: MonthlyExportsPurchasesReportItem[] = sortedMonths.map((ym) => {
    const year = ym.slice(0, 4);
    yearSet.add(year);

    const mPurchases = purchases.filter((p) => (p.date || '').slice(0, 7) === ym);
    const mPackings = packings.filter((pk) => (pk.packingDate || '').slice(0, 7) === ym);
    const mOtherCosts = otherCosts.filter((c) => (c.date || '').slice(0, 7) === ym);

    const purchaseVolume = Math.round(
      mPurchases.reduce((acc, p) => acc + (Number(p.totalQty) || 0), 0) * 100
    ) / 100;
    const purchaseValue = Math.round(
      mPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0) * 100
    ) / 100;
    const purchaseCount = mPurchases.length;

    const exportWeight = Math.round(
      mPackings.reduce((acc, pk) => acc + (Number(pk.totalWeight) || 0), 0) * 100
    ) / 100;
    const exportBoxes = mPackings.reduce((acc, pk) => acc + (Number(pk.totalBox) || 0), 0);
    const exportValueRMB = Math.round(
      mPackings.reduce((acc, pk) => acc + (Number(pk.totalAmount) || 0), 0) * 100
    ) / 100;

    const exportValueBDT = Math.round(
      mPackings.reduce((acc, pk) => {
        const val = Number(pk.totalAmount) || 0;
        const rate = Number(pk.rmbRate) > 0 ? Number(pk.rmbRate) : rmbExchangeRate;
        return acc + calculatePackingTotalAmountBDT(val, rate);
      }, 0) * 100
    ) / 100;
    const exportCount = mPackings.length;

    const otherCostVal = Math.round(
      mOtherCosts.reduce((acc, c) => acc + (Number(c.amount) || 0), 0) * 100
    ) / 100;

    const netProfit = Math.round((exportValueBDT - purchaseValue - otherCostVal) * 100) / 100;
    const marginPercent =
      exportValueBDT > 0 ? Math.round((netProfit / exportValueBDT) * 1000) / 10 : 0;

    return {
      yearMonth: ym,
      monthLabel: formatYearMonthLabel(ym),
      shortMonthLabel: formatShortYearMonthLabel(ym),
      year,
      purchaseVolume,
      purchaseValue,
      purchaseCount,
      exportWeight,
      exportBoxes,
      exportValueRMB,
      exportValueBDT,
      exportCount,
      otherCosts: otherCostVal,
      netProfit,
      marginPercent,
    };
  });

  const totals: MonthlyReportsSummaryTotals = items.reduce(
    (acc, it) => ({
      totalPurchaseVolume: Math.round((acc.totalPurchaseVolume + it.purchaseVolume) * 100) / 100,
      totalPurchaseValue: Math.round((acc.totalPurchaseValue + it.purchaseValue) * 100) / 100,
      totalPurchaseCount: acc.totalPurchaseCount + it.purchaseCount,
      totalExportWeight: Math.round((acc.totalExportWeight + it.exportWeight) * 100) / 100,
      totalExportBoxes: acc.totalExportBoxes + it.exportBoxes,
      totalExportValueRMB: Math.round((acc.totalExportValueRMB + it.exportValueRMB) * 100) / 100,
      totalExportValueBDT: Math.round((acc.totalExportValueBDT + it.exportValueBDT) * 100) / 100,
      totalExportCount: acc.totalExportCount + it.exportCount,
      totalOtherCosts: Math.round((acc.totalOtherCosts + it.otherCosts) * 100) / 100,
      totalNetProfit: Math.round((acc.totalNetProfit + it.netProfit) * 100) / 100,
      overallMarginPercent: 0,
    }),
    {
      totalPurchaseVolume: 0,
      totalPurchaseValue: 0,
      totalPurchaseCount: 0,
      totalExportWeight: 0,
      totalExportBoxes: 0,
      totalExportValueRMB: 0,
      totalExportValueBDT: 0,
      totalExportCount: 0,
      totalOtherCosts: 0,
      totalNetProfit: 0,
      overallMarginPercent: 0,
    }
  );

  totals.overallMarginPercent =
    totals.totalExportValueBDT > 0
      ? Math.round((totals.totalNetProfit / totals.totalExportValueBDT) * 1000) / 10
      : 0;

  const availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a));

  return { items, totals, availableYears };
}
