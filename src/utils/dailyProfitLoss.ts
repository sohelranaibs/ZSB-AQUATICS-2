import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';
import {
  calculateProfitLoss,
  classifyPaymentCategory,
  formatDate,
  formatYearMonthLabel,
} from './calculations.ts';

export type DailyPLStatusFilter = 'all' | 'profit' | 'loss' | 'breakeven';

export interface DailyProfitLossEntry {
  date: string; // YYYY-MM-DD
  formattedDate: string; // DD/MM/YYYY
  weekdayLabel: string; // e.g., "Fri"
  yearMonth: string; // YYYY-MM
  monthLabel: string; // e.g., "October 2026"
  purchaseCount: number;
  purchaseQtyKg: number;
  purchaseAmount: number;
  exportCount: number;
  exportBoxes: number;
  exportWeightKg: number;
  exportAmountRMB: number;
  exportAmountBDT: number;
  otherCostCount: number;
  otherCostAmount: number;
  supplierPaymentCount: number;
  supplierPaymentAmount: number;
  exporterPaymentCount: number;
  exporterPaymentAmount: number;
  returnRmbAmount: number;
  returnRmbInBDT: number;
  grossProfit: number;
  netProfit: number;
  runningCumulativeNetProfit: number;
  marginPercent: number;
  status: 'PROFIT' | 'LOSS' | 'BREAKEVEN';
  totalTransactionsCount: number;
  topSummaryText: string;
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  otherCosts: OtherCostRecord[];
  payments: PaymentRecord[];
}

export interface DailyProfitLossSummaryTotals {
  totalDays: number;
  profitableDaysCount: number;
  lossDaysCount: number;
  breakEvenDaysCount: number;
  totalPurchaseCount: number;
  totalPurchaseQtyKg: number;
  totalPurchaseAmount: number;
  totalExportCount: number;
  totalExportBoxes: number;
  totalExportWeightKg: number;
  totalExportAmountRMB: number;
  totalExportAmountBDT: number;
  totalOtherCostCount: number;
  totalOtherCostAmount: number;
  totalSupplierPaymentAmount: number;
  totalExporterPaymentAmount: number;
  totalReturnRmbAmount: number;
  totalReturnRmbInBDT: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  overallMarginPercent: number;
  averageDailyNetProfit: number;
  bestProfitDay: DailyProfitLossEntry | null;
  worstLossDay: DailyProfitLossEntry | null;
}

export interface DailyProfitLossFilterOptions {
  targetYearMonth?: string; // 'all' or 'YYYY-MM'
  fromDate?: string; // 'YYYY-MM-DD'
  toDate?: string; // 'YYYY-MM-DD'
  statusFilter?: DailyPLStatusFilter;
  searchQuery?: string;
  rmbExchangeRate?: number;
  includeTodayIfEmpty?: boolean;
  referenceTodayDate?: string;
}

export interface DailyProfitLossReportResult {
  entries: DailyProfitLossEntry[];
  allEntriesCount: number;
  availableMonths: string[];
  totals: DailyProfitLossSummaryTotals;
}

export const DAILY_PL_ROW_BATCH_SIZE = 10;
export const DAILY_PL_SCROLL_LOAD_THRESHOLD_PX = 96;

export interface DailyProfitLossWindowResult<T> {
  visibleEntries: T[];
  totalCount: number;
  shownCount: number;
  remainingCount: number;
  hasMore: boolean;
}

/**
 * Slices daily P&L entries to the active scroll-controlled row limit (defaults to 10 rows).
 */
export function getVisibleDailyProfitLossWindow<T>(
  entries: T[],
  visibleLimit: number = DAILY_PL_ROW_BATCH_SIZE
): DailyProfitLossWindowResult<T> {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const totalCount = safeEntries.length;
  const normalizedLimit =
    Number.isFinite(visibleLimit) && visibleLimit > 0
      ? Math.floor(visibleLimit)
      : DAILY_PL_ROW_BATCH_SIZE;
  const visibleEntries = safeEntries.slice(0, normalizedLimit);
  const shownCount = visibleEntries.length;
  const remainingCount = Math.max(0, totalCount - shownCount);

  return {
    visibleEntries,
    totalCount,
    shownCount,
    remainingCount,
    hasMore: remainingCount > 0,
  };
}

export interface DailyProfitLossScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  hasMore: boolean;
  thresholdPx?: number;
}

/**
 * Determines whether scrolling inside the Daily P&L table container has reached the load threshold.
 */
export function shouldLoadMoreOnScroll(
  metrics: DailyProfitLossScrollMetrics
): boolean {
  if (!metrics.hasMore) return false;
  if (metrics.scrollHeight <= 0 || metrics.clientHeight <= 0) return false;
  const threshold =
    typeof metrics.thresholdPx === 'number' && metrics.thresholdPx >= 0
      ? metrics.thresholdPx
      : DAILY_PL_SCROLL_LOAD_THRESHOLD_PX;
  return metrics.scrollTop + metrics.clientHeight >= metrics.scrollHeight - threshold;
}

/**
 * Computes the next row batch limit in increments of DAILY_PL_ROW_BATCH_SIZE (10), capped at totalCount.
 */
export function getNextDailyProfitLossRowLimit(
  currentLimit: number,
  totalCount: number,
  batchSize: number = DAILY_PL_ROW_BATCH_SIZE
): number {
  const safeBatch = batchSize > 0 ? Math.floor(batchSize) : DAILY_PL_ROW_BATCH_SIZE;
  const safeTotal = Math.max(0, Math.floor(totalCount));
  const safeCurrent =
    Number.isFinite(currentLimit) && currentLimit > 0 ? Math.floor(currentLimit) : safeBatch;
  if (safeTotal === 0) return safeBatch;
  return Math.min(safeTotal, safeCurrent + safeBatch);
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function round1(val: number): number {
  return Math.round((Number(val) || 0) * 10) / 10;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getWeekdayShortLabel(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return '';
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return '';
  return WEEKDAY_NAMES[dt.getDay()] || '';
}

/**
 * Aggregates all Purchase Challans, Export Packing Lists, Other Costing expenses,
 * and Supplier/Exporter Payments into a day-by-day Profit & Loss report.
 */
export function calculateDailyProfitLossReport(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  options: DailyProfitLossFilterOptions = {}
): DailyProfitLossReportResult {
  const {
    targetYearMonth = 'all',
    fromDate = '',
    toDate = '',
    statusFilter = 'all',
    searchQuery = '',
    rmbExchangeRate = 16.5,
    includeTodayIfEmpty = true,
    referenceTodayDate,
  } = options;

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safePackings = Array.isArray(packings) ? packings : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeOtherCosts = Array.isArray(otherCosts) ? otherCosts : [];
  const rate = Number(rmbExchangeRate) > 0 ? Number(rmbExchangeRate) : 16.5;

  const dateSet = new Set<string>();
  const monthSet = new Set<string>();

  const registerDate = (rawDate?: string) => {
    const clean = (rawDate || '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      dateSet.add(clean);
      monthSet.add(clean.slice(0, 7));
    }
  };

  safePurchases.forEach((p) => registerDate(p.date));
  safePackings.forEach((pk) => registerDate(pk.packingDate));
  safePayments.forEach((pm) => registerDate(pm.date));
  safeOtherCosts.forEach((c) => registerDate(c.date));

  if (dateSet.size === 0 && includeTodayIfEmpty) {
    const today = (referenceTodayDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    dateSet.add(today);
    monthSet.add(today.slice(0, 7));
  }

  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  // Build chronological ascending list first so we can compute running cumulative net profit
  const sortedDatesAsc = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
  let runningNet = 0;

  const allEntriesAsc: DailyProfitLossEntry[] = sortedDatesAsc.map((date) => {
    const dayPurchases = safePurchases.filter((p) => (p.date || '').trim().slice(0, 10) === date);
    const dayPackings = safePackings.filter(
      (pk) => (pk.packingDate || '').trim().slice(0, 10) === date
    );
    const dayPayments = safePayments.filter((pm) => (pm.date || '').trim().slice(0, 10) === date);
    const dayOtherCosts = safeOtherCosts.filter(
      (c) => (c.date || '').trim().slice(0, 10) === date
    );

    const pl = calculateProfitLoss(
      dayPurchases,
      dayPackings,
      dayPayments,
      dayOtherCosts,
      rate
    );

    const purchaseQtyKg = round2(
      dayPurchases.reduce((acc, p) => acc + (Number(p.totalQty) || 0), 0)
    );
    const exportBoxes = dayPackings.reduce((acc, pk) => acc + (Number(pk.totalBox) || 0), 0);
    const exportAmountRMB = round2(
      dayPackings.reduce((acc, pk) => acc + (Number(pk.totalAmount) || 0), 0)
    );

    const supplierVouchers = dayPayments.filter(
      (pm) => classifyPaymentCategory(pm) === 'supplier'
    );
    const exporterVouchers = dayPayments.filter(
      (pm) => classifyPaymentCategory(pm) === 'exporter'
    );

    const supplierVoucherPaid = supplierVouchers.reduce(
      (acc, pm) => acc + (Number(pm.paidAmount) || 0),
      0
    );
    const directPurchasePaid = dayPurchases.reduce(
      (acc, p) => acc + (Number(p.paidAmount) || 0),
      0
    );
    const supplierPaymentAmount = round2(supplierVoucherPaid + directPurchasePaid);
    const supplierPaymentCount =
      supplierVouchers.length + dayPurchases.filter((p) => (Number(p.paidAmount) || 0) > 0).length;

    const exporterPaymentAmount = round2(
      exporterVouchers.reduce((acc, pm) => acc + (Number(pm.paidAmount) || 0), 0)
    );
    const exporterPaymentCount = exporterVouchers.length;

    runningNet = round2(runningNet + pl.netProfit);

    const status: 'PROFIT' | 'LOSS' | 'BREAKEVEN' =
      pl.netProfit > 0 ? 'PROFIT' : pl.netProfit < 0 ? 'LOSS' : 'BREAKEVEN';

    const yearMonth = date.slice(0, 7);
    const totalTransactionsCount =
      dayPurchases.length + dayPackings.length + dayOtherCosts.length + dayPayments.length;

    const summaryParts: string[] = [];
    if (dayPackings.length > 0) {
      const marks = Array.from(
        new Set(dayPackings.map((pk) => pk.shippingMark).filter(Boolean))
      );
      summaryParts.push(
        `${dayPackings.length} Export${dayPackings.length > 1 ? 's' : ''}${
          marks.length > 0 ? ` (${marks.slice(0, 2).join(', ')})` : ''
        }`
      );
    }
    if (dayPurchases.length > 0) {
      const sups = Array.from(
        new Set(dayPurchases.map((p) => p.description).filter(Boolean))
      );
      summaryParts.push(
        `${dayPurchases.length} Purchase${dayPurchases.length > 1 ? 's' : ''}${
          sups.length > 0 ? ` (${sups.slice(0, 2).join(', ')})` : ''
        }`
      );
    }
    if (dayOtherCosts.length > 0) {
      const cats = Array.from(
        new Set(dayOtherCosts.map((c) => c.category).filter(Boolean))
      );
      summaryParts.push(
        `${dayOtherCosts.length} Cost${dayOtherCosts.length > 1 ? 's' : ''}${
          cats.length > 0 ? ` (${cats.slice(0, 2).join(', ')})` : ''
        }`
      );
    }
    if (dayPayments.length > 0 && summaryParts.length === 0) {
      summaryParts.push(`${dayPayments.length} Payment Voucher${dayPayments.length > 1 ? 's' : ''}`);
    }

    return {
      date,
      formattedDate: formatDate(date),
      weekdayLabel: getWeekdayShortLabel(date),
      yearMonth,
      monthLabel: formatYearMonthLabel(yearMonth),
      purchaseCount: dayPurchases.length,
      purchaseQtyKg,
      purchaseAmount: pl.totalPurchasing,
      exportCount: dayPackings.length,
      exportBoxes,
      exportWeightKg: pl.totalWeightExported,
      exportAmountRMB,
      exportAmountBDT: pl.totalExportValue,
      otherCostCount: dayOtherCosts.length,
      otherCostAmount: pl.totalOtherCosting,
      supplierPaymentCount,
      supplierPaymentAmount,
      exporterPaymentCount,
      exporterPaymentAmount,
      returnRmbAmount: pl.totalReturnRMB,
      returnRmbInBDT: pl.totalReturnRMBInBDT,
      grossProfit: pl.grossProfit,
      netProfit: pl.netProfit,
      runningCumulativeNetProfit: runningNet,
      marginPercent: pl.marginPercent,
      status,
      totalTransactionsCount,
      topSummaryText:
        summaryParts.length > 0 ? summaryParts.join(' · ') : 'No transactions logged',
      purchases: dayPurchases,
      packings: dayPackings,
      otherCosts: dayOtherCosts,
      payments: dayPayments,
    };
  });

  // Sort newest date first for table display
  const allEntriesDesc = [...allEntriesAsc].reverse();

  const normalizedMonth = (targetYearMonth || 'all').trim();
  const normalizedFrom = (fromDate || '').trim();
  const normalizedTo = (toDate || '').trim();
  const normalizedStatus = (statusFilter || 'all').toLowerCase();
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const filteredEntries = allEntriesDesc.filter((entry) => {
    if (normalizedMonth !== 'all' && normalizedMonth !== '' && entry.yearMonth !== normalizedMonth) {
      return false;
    }
    if (normalizedFrom && entry.date < normalizedFrom) {
      return false;
    }
    if (normalizedTo && entry.date > normalizedTo) {
      return false;
    }
    if (normalizedStatus === 'profit' && entry.status !== 'PROFIT') {
      return false;
    }
    if (normalizedStatus === 'loss' && entry.status !== 'LOSS') {
      return false;
    }
    if (normalizedStatus === 'breakeven' && entry.status !== 'BREAKEVEN') {
      return false;
    }
    if (normalizedQuery) {
      const haystacks: string[] = [
        entry.date,
        entry.formattedDate,
        entry.weekdayLabel,
        entry.topSummaryText,
        ...entry.purchases.flatMap((p) => [
          p.invoiceNumber,
          p.description,
          p.remarks || '',
          ...(p.items || []).map((i) => i.item),
        ]),
        ...entry.packings.flatMap((pk) => [
          pk.invoiceNumber,
          pk.shippingMark,
          pk.flight,
          pk.destination,
          pk.shipper,
          ...(pk.items || []).map((i) => i.item),
        ]),
        ...entry.otherCosts.flatMap((c) => [
          c.category,
          c.description,
          c.refInvoice || '',
        ]),
        ...entry.payments.flatMap((pm) => [
          pm.invoiceNumber,
          pm.description,
          pm.shippingMark || '',
        ]),
      ];
      const matches = haystacks.some((h) => (h || '').toLowerCase().includes(normalizedQuery));
      if (!matches) return false;
    }
    return true;
  });

  let profitableDaysCount = 0;
  let lossDaysCount = 0;
  let breakEvenDaysCount = 0;
  let totalPurchaseCount = 0;
  let totalPurchaseQtyKg = 0;
  let totalPurchaseAmount = 0;
  let totalExportCount = 0;
  let totalExportBoxes = 0;
  let totalExportWeightKg = 0;
  let totalExportAmountRMB = 0;
  let totalExportAmountBDT = 0;
  let totalOtherCostCount = 0;
  let totalOtherCostAmount = 0;
  let totalSupplierPaymentAmount = 0;
  let totalExporterPaymentAmount = 0;
  let totalReturnRmbAmount = 0;
  let totalReturnRmbInBDT = 0;
  let bestProfitDay: DailyProfitLossEntry | null = null;
  let worstLossDay: DailyProfitLossEntry | null = null;

  for (const e of filteredEntries) {
    if (e.status === 'PROFIT') profitableDaysCount += 1;
    else if (e.status === 'LOSS') lossDaysCount += 1;
    else breakEvenDaysCount += 1;

    totalPurchaseCount += e.purchaseCount;
    totalPurchaseQtyKg += e.purchaseQtyKg;
    totalPurchaseAmount += e.purchaseAmount;
    totalExportCount += e.exportCount;
    totalExportBoxes += e.exportBoxes;
    totalExportWeightKg += e.exportWeightKg;
    totalExportAmountRMB += e.exportAmountRMB;
    totalExportAmountBDT += e.exportAmountBDT;
    totalOtherCostCount += e.otherCostCount;
    totalOtherCostAmount += e.otherCostAmount;
    totalSupplierPaymentAmount += e.supplierPaymentAmount;
    totalExporterPaymentAmount += e.exporterPaymentAmount;
    totalReturnRmbAmount += e.returnRmbAmount;
    totalReturnRmbInBDT += e.returnRmbInBDT;

    if (e.netProfit > 0 && (!bestProfitDay || e.netProfit > bestProfitDay.netProfit)) {
      bestProfitDay = e;
    }
    if (e.netProfit < 0 && (!worstLossDay || e.netProfit < worstLossDay.netProfit)) {
      worstLossDay = e;
    }
  }

  totalPurchaseQtyKg = round2(totalPurchaseQtyKg);
  totalPurchaseAmount = round2(totalPurchaseAmount);
  totalExportWeightKg = round2(totalExportWeightKg);
  totalExportAmountRMB = round2(totalExportAmountRMB);
  totalExportAmountBDT = round2(totalExportAmountBDT);
  totalOtherCostAmount = round2(totalOtherCostAmount);
  totalSupplierPaymentAmount = round2(totalSupplierPaymentAmount);
  totalExporterPaymentAmount = round2(totalExporterPaymentAmount);
  totalReturnRmbAmount = round2(totalReturnRmbAmount);
  totalReturnRmbInBDT = round2(totalReturnRmbInBDT);

  const totalGrossProfit = round2(totalExportAmountBDT - totalPurchaseAmount);
  const totalNetProfit = round2(totalGrossProfit - totalOtherCostAmount);
  const overallMarginPercent =
    totalExportAmountBDT > 0 ? round1((totalNetProfit / totalExportAmountBDT) * 100) : 0;
  const averageDailyNetProfit =
    filteredEntries.length > 0 ? round2(totalNetProfit / filteredEntries.length) : 0;

  return {
    entries: filteredEntries,
    allEntriesCount: allEntriesDesc.length,
    availableMonths,
    totals: {
      totalDays: filteredEntries.length,
      profitableDaysCount,
      lossDaysCount,
      breakEvenDaysCount,
      totalPurchaseCount,
      totalPurchaseQtyKg,
      totalPurchaseAmount,
      totalExportCount,
      totalExportBoxes,
      totalExportWeightKg,
      totalExportAmountRMB,
      totalExportAmountBDT,
      totalOtherCostCount,
      totalOtherCostAmount,
      totalSupplierPaymentAmount,
      totalExporterPaymentAmount,
      totalReturnRmbAmount,
      totalReturnRmbInBDT,
      totalGrossProfit,
      totalNetProfit,
      overallMarginPercent,
      averageDailyNetProfit,
      bestProfitDay,
      worstLossDay,
    },
  };
}

export interface ProfitLossFiscalSummaryReportPayload {
  statementRef: string;
  filename: string;
  title: string;
  periodLabel: string;
  generatedAt: string;
  summary: ReturnType<typeof calculateProfitLoss>;
  dailyEntries: DailyProfitLossEntry[];
  totals: DailyProfitLossSummaryTotals;
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts: OtherCostRecord[];
}

/**
 * Formats a clean, standardized PDF/PNG filename for the Profit & Loss Fiscal Summary report.
 */
export function formatProfitLossFiscalSummaryFilename(
  referenceDate?: string,
  ext: 'pdf' | 'png' = 'pdf'
): string {
  const cleanDate =
    referenceDate && /^\d{4}-\d{2}-\d{2}/.test(referenceDate.trim())
      ? referenceDate.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const safeExt = ext === 'png' ? 'png' : 'pdf';
  return `ZSB_AQUATICS_FISCAL_SUMMARY_REPORT_${cleanDate}.${safeExt}`;
}

/**
 * Builds the consolidated Profit & Loss Fiscal Summary report payload for one-click PDF generation and print preview.
 */
export function buildProfitLossFiscalSummaryReportPayload(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  options: {
    rmbExchangeRate?: number;
    referenceDate?: string;
    periodLabel?: string;
  } = {}
): ProfitLossFiscalSummaryReportPayload {
  const rate =
    Number(options.rmbExchangeRate) > 0 ? Number(options.rmbExchangeRate) : 16.5;
  const cleanDate =
    options.referenceDate && /^\d{4}-\d{2}-\d{2}/.test(options.referenceDate.trim())
      ? options.referenceDate.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const summary = calculateProfitLoss(purchases, packings, payments, otherCosts, rate);
  const dailyReport = calculateDailyProfitLossReport(
    purchases,
    packings,
    payments,
    otherCosts,
    {
      rmbExchangeRate: rate,
      referenceTodayDate: cleanDate,
    }
  );

  return {
    statementRef: `PL-FS-${cleanDate.replace(/-/g, '')}`,
    filename: formatProfitLossFiscalSummaryFilename(cleanDate, 'pdf'),
    title: 'Loss & Profit Financial Statement & Daily Report',
    periodLabel: options.periodLabel || 'All Active Trading Days',
    generatedAt: cleanDate,
    summary,
    dailyEntries: dailyReport.entries,
    totals: dailyReport.totals,
    purchases: Array.isArray(purchases) ? purchases : [],
    packings: Array.isArray(packings) ? packings : [],
    payments: Array.isArray(payments) ? payments : [],
    otherCosts: Array.isArray(otherCosts) ? otherCosts : [],
  };
}

