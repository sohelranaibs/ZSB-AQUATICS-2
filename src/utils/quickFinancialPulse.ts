import type { PurchaseRecord, PaymentRecord } from '../types/index.ts';
import {
  normalizeToIsoDate,
  getEffectivePaymentAmount,
  toLocalIsoDate,
} from './dailyFinancialSummary.ts';

export type PulsePresetKey =
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'last_90_days'
  | 'all_time'
  | 'custom';

export interface PulsePresetOption {
  key: Exclude<PulsePresetKey, 'custom'>;
  label: string;
  shortLabel: string;
}

export const PULSE_PRESET_OPTIONS: PulsePresetOption[] = [
  { key: 'last_7_days', label: 'Last 7 Days', shortLabel: '7D' },
  { key: 'last_30_days', label: 'Last 30 Days', shortLabel: '30D' },
  { key: 'this_month', label: 'This Month', shortLabel: 'MTD' },
  { key: 'last_month', label: 'Last Month', shortLabel: 'Last Mo' },
  { key: 'last_90_days', label: 'Last 90 Days', shortLabel: '90D' },
  { key: 'all_time', label: 'All Time', shortLabel: 'All' },
];

export function getPulsePresetDateRange(
  preset: PulsePresetKey,
  referenceDate: Date = new Date()
): { startDate: string; endDate: string; label: string } {
  const todayStr = toLocalIsoDate(referenceDate);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  switch (preset) {
    case 'last_7_days': {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 6);
      return {
        startDate: toLocalIsoDate(d),
        endDate: todayStr,
        label: 'Last 7 Days',
      };
    }
    case 'last_30_days': {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 29);
      return {
        startDate: toLocalIsoDate(d),
        endDate: todayStr,
        label: 'Last 30 Days',
      };
    }
    case 'this_month': {
      const monthStr = String(month + 1).padStart(2, '0');
      return {
        startDate: `${year}-${monthStr}-01`,
        endDate: todayStr,
        label: 'This Month',
      };
    }
    case 'last_month': {
      const prevMonthDate = new Date(year, month - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth();
      const prevMonthStr = String(prevMonth + 1).padStart(2, '0');
      const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      return {
        startDate: `${prevYear}-${prevMonthStr}-01`,
        endDate: `${prevYear}-${prevMonthStr}-${String(lastDay).padStart(2, '0')}`,
        label: 'Last Month',
      };
    }
    case 'last_90_days': {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 89);
      return {
        startDate: toLocalIsoDate(d),
        endDate: todayStr,
        label: 'Last 90 Days',
      };
    }
    case 'all_time':
    default:
      return {
        startDate: '',
        endDate: '',
        label: 'All Time',
      };
  }
}

export interface DailyPulsePoint {
  date: string;
  purchaseVolume: number;
  purchaseQtyKg: number;
  purchaseCount: number;
  paymentVolume: number;
  supplierPaymentVolume: number;
  exporterPaymentVolume: number;
  paymentCount: number;
  netDelta: number; // purchaseVolume - paymentVolume
}

export type PulseTrendStatus =
  | 'net_payable_growth'
  | 'net_settlement_surplus'
  | 'balanced';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface VolumePeriodComparison {
  currentVolume: number;
  previousVolume: number;
  deltaAmount: number;
  deltaPercent: number;
  direction: TrendDirection;
}

export interface PreviousPeriodWindow {
  startDate: string;
  endDate: string;
  daysCount: number;
}

export interface QuickFinancialPulseSummary {
  startDate: string;
  endDate: string;
  activeDaysCount: number;
  totalPurchaseVolume: number;
  totalPurchaseQtyKg: number;
  totalPurchaseCount: number;
  totalPaymentVolume: number;
  supplierPaymentVolume: number;
  exporterPaymentVolume: number;
  totalPaymentCount: number;
  netVolumeDelta: number;
  settlementRatioPercent: number;
  avgDailyPurchaseVolume: number;
  avgDailyPaymentVolume: number;
  peakPurchaseDay: { date: string; amount: number } | null;
  peakPaymentDay: { date: string; amount: number } | null;
  trendStatus: PulseTrendStatus;
  trendHeadline: string;
  trendSummaryText: string;
  dailySeries: DailyPulsePoint[];
  previousPeriodWindow: PreviousPeriodWindow;
  purchaseComparison: VolumePeriodComparison;
  paymentComparison: VolumePeriodComparison;
}

function isIsoDateInWindow(
  isoDate: string,
  startDate: string,
  endDate: string
): boolean {
  if (!isoDate) return false;
  if (startDate && isoDate < startDate) return false;
  if (endDate && isoDate > endDate) return false;
  return true;
}

function parseIsoToLocalDate(isoDate: string): Date | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/**
 * Computes the immediately preceding period of equal duration (in calendar days)
 * for any [startDate, endDate] range.
 */
export function computePreviousPeriodWindow(
  startDate: string,
  endDate: string,
  fallbackEarliestDate: string = '',
  fallbackLatestDate: string = ''
): PreviousPeriodWindow {
  const effectiveStart = startDate || fallbackEarliestDate;
  const effectiveEnd = endDate || fallbackLatestDate;

  const startObj = parseIsoToLocalDate(effectiveStart);
  const endObj = parseIsoToLocalDate(effectiveEnd);

  if (!startObj || !endObj || endObj < startObj) {
    return { startDate: '', endDate: '', daysCount: 0 };
  }

  // If neither startDate nor endDate was explicitly provided ('all_time'),
  // compare the second half of the dataset window against the first half, or at least 1 day prior.
  if (!startDate && !endDate) {
    const totalSpanDays =
      Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const halfDays = Math.max(1, Math.floor(totalSpanDays / 2));
    const prevEnd = new Date(endObj);
    prevEnd.setDate(prevEnd.getDate() - halfDays);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (halfDays - 1));
    return {
      startDate: toLocalIsoDate(prevStart),
      endDate: toLocalIsoDate(prevEnd),
      daysCount: halfDays,
    };
  }

  const daysCount =
    Math.max(
      1,
      Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

  const prevEndObj = new Date(startObj);
  prevEndObj.setDate(prevEndObj.getDate() - 1);

  const prevStartObj = new Date(prevEndObj);
  prevStartObj.setDate(prevStartObj.getDate() - (daysCount - 1));

  return {
    startDate: toLocalIsoDate(prevStartObj),
    endDate: toLocalIsoDate(prevEndObj),
    daysCount,
  };
}

/**
 * Computes volume comparison metrics and direction ('up' | 'down' | 'flat')
 * between the current period and the previous period.
 */
export function buildVolumePeriodComparison(
  currentVolume: number,
  previousVolume: number
): VolumePeriodComparison {
  const curr = Math.round((Number(currentVolume) || 0) * 100) / 100;
  const prev = Math.round((Number(previousVolume) || 0) * 100) / 100;
  const deltaAmount = Math.round((curr - prev) * 100) / 100;

  let deltaPercent = 0;
  if (prev > 0) {
    deltaPercent = Math.round(((curr - prev) / prev) * 1000) / 10;
  } else if (curr > 0) {
    deltaPercent = 100;
  }

  const direction: TrendDirection =
    deltaAmount > 0 ? 'up' : deltaAmount < 0 ? 'down' : 'flat';

  return {
    currentVolume: curr,
    previousVolume: prev,
    deltaAmount,
    deltaPercent,
    direction,
  };
}

function aggregateWindowVolumes(
  purchases: PurchaseRecord[],
  payments: PaymentRecord[],
  normStart: string,
  normEnd: string
): {
  dailySeries: DailyPulsePoint[];
  totalPurchaseVolume: number;
  totalPurchaseQtyKg: number;
  totalPurchaseCount: number;
  totalPaymentVolume: number;
  supplierPaymentVolume: number;
  exporterPaymentVolume: number;
  totalPaymentCount: number;
  peakPurchaseDay: { date: string; amount: number } | null;
  peakPaymentDay: { date: string; amount: number } | null;
} {
  const dayMap = new Map<string, DailyPulsePoint>();
  const syncedInvoicesByDate = new Map<string, Set<string>>();

  const getOrCreateDay = (isoDate: string): DailyPulsePoint => {
    let existing = dayMap.get(isoDate);
    if (!existing) {
      existing = {
        date: isoDate,
        purchaseVolume: 0,
        purchaseQtyKg: 0,
        purchaseCount: 0,
        paymentVolume: 0,
        supplierPaymentVolume: 0,
        exporterPaymentVolume: 0,
        paymentCount: 0,
        netDelta: 0,
      };
      dayMap.set(isoDate, existing);
    }
    return existing;
  };

  const inRangePayments: { pm: PaymentRecord; isoDate: string }[] = [];
  for (const pm of payments) {
    const isoDate = normalizeToIsoDate(pm.date);
    if (!isIsoDateInWindow(isoDate, normStart, normEnd)) continue;
    inRangePayments.push({ pm, isoDate });

    if (pm.exportGoodsRef) {
      let set = syncedInvoicesByDate.get(isoDate);
      if (!set) {
        set = new Set<string>();
        syncedInvoicesByDate.set(isoDate, set);
      }
      set.add(pm.exportGoodsRef.trim().toUpperCase());
    }
  }

  for (const { pm, isoDate } of inRangePayments) {
    const point = getOrCreateDay(isoDate);
    const amount = getEffectivePaymentAmount(pm);
    const category = pm.paymentCategory === 'exporter' ? 'exporter' : 'supplier';

    point.paymentVolume = Math.round((point.paymentVolume + amount) * 100) / 100;
    if (category === 'exporter') {
      point.exporterPaymentVolume =
        Math.round((point.exporterPaymentVolume + amount) * 100) / 100;
    } else {
      point.supplierPaymentVolume =
        Math.round((point.supplierPaymentVolume + amount) * 100) / 100;
    }
    point.paymentCount += 1;
  }

  for (const pur of purchases) {
    const isoDate = normalizeToIsoDate(pur.date);
    if (!isIsoDateInWindow(isoDate, normStart, normEnd)) continue;

    const point = getOrCreateDay(isoDate);
    const amount = Number(pur.totalAmount) || 0;
    const qty = Number(pur.totalQty) || 0;

    point.purchaseVolume = Math.round((point.purchaseVolume + amount) * 100) / 100;
    point.purchaseQtyKg = Math.round((point.purchaseQtyKg + qty) * 100) / 100;
    point.purchaseCount += 1;

    const directPaid = Number(pur.paidAmount) || 0;
    if (directPaid > 0) {
      const invKey = (pur.invoiceNumber || '').trim().toUpperCase();
      const syncedSet = syncedInvoicesByDate.get(isoDate);
      const hasSyncVoucher =
        (invKey && syncedSet?.has(invKey)) ||
        inRangePayments.some(
          (entry) => entry.isoDate === isoDate && entry.pm.id === `pay-sync-${pur.id}`
        );

      if (!hasSyncVoucher) {
        const roundedPaid = Math.round(directPaid * 100) / 100;
        point.paymentVolume =
          Math.round((point.paymentVolume + roundedPaid) * 100) / 100;
        point.supplierPaymentVolume =
          Math.round((point.supplierPaymentVolume + roundedPaid) * 100) / 100;
        point.paymentCount += 1;
      }
    }
  }

  const dailySeries = Array.from(dayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  let totalPurchaseVolume = 0;
  let totalPurchaseQtyKg = 0;
  let totalPurchaseCount = 0;
  let totalPaymentVolume = 0;
  let supplierPaymentVolume = 0;
  let exporterPaymentVolume = 0;
  let totalPaymentCount = 0;

  let peakPurchaseDay: { date: string; amount: number } | null = null;
  let peakPaymentDay: { date: string; amount: number } | null = null;

  for (const day of dailySeries) {
    day.netDelta = Math.round((day.purchaseVolume - day.paymentVolume) * 100) / 100;

    totalPurchaseVolume += day.purchaseVolume;
    totalPurchaseQtyKg += day.purchaseQtyKg;
    totalPurchaseCount += day.purchaseCount;
    totalPaymentVolume += day.paymentVolume;
    supplierPaymentVolume += day.supplierPaymentVolume;
    exporterPaymentVolume += day.exporterPaymentVolume;
    totalPaymentCount += day.paymentCount;

    if (
      day.purchaseVolume > 0 &&
      (!peakPurchaseDay || day.purchaseVolume > peakPurchaseDay.amount)
    ) {
      peakPurchaseDay = { date: day.date, amount: day.purchaseVolume };
    }
    if (
      day.paymentVolume > 0 &&
      (!peakPaymentDay || day.paymentVolume > peakPaymentDay.amount)
    ) {
      peakPaymentDay = { date: day.date, amount: day.paymentVolume };
    }
  }

  return {
    dailySeries,
    totalPurchaseVolume: Math.round(totalPurchaseVolume * 100) / 100,
    totalPurchaseQtyKg: Math.round(totalPurchaseQtyKg * 100) / 100,
    totalPurchaseCount,
    totalPaymentVolume: Math.round(totalPaymentVolume * 100) / 100,
    supplierPaymentVolume: Math.round(supplierPaymentVolume * 100) / 100,
    exporterPaymentVolume: Math.round(exporterPaymentVolume * 100) / 100,
    totalPaymentCount,
    peakPurchaseDay,
    peakPaymentDay,
  };
}

/**
 * Calculates the Quick Financial Pulse trend summary of purchase vs. payment volumes
 * across a user-selected date range, including comparison against the previous period.
 */
export function calculateQuickFinancialPulse(
  purchases: PurchaseRecord[],
  payments: PaymentRecord[],
  startDate: string = '',
  endDate: string = ''
): QuickFinancialPulseSummary {
  const normStart = startDate ? normalizeToIsoDate(startDate) : '';
  const normEnd = endDate ? normalizeToIsoDate(endDate) : '';

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const currentAgg = aggregateWindowVolumes(
    safePurchases,
    safePayments,
    normStart,
    normEnd
  );

  const {
    dailySeries,
    totalPurchaseVolume,
    totalPurchaseQtyKg,
    totalPurchaseCount,
    totalPaymentVolume,
    supplierPaymentVolume,
    exporterPaymentVolume,
    totalPaymentCount,
    peakPurchaseDay,
    peakPaymentDay,
  } = currentAgg;

  // Determine previous period window and calculate previous period volumes
  const earliestActive = dailySeries.length > 0 ? dailySeries[0].date : '';
  const latestActive =
    dailySeries.length > 0 ? dailySeries[dailySeries.length - 1].date : '';

  const previousPeriodWindow = computePreviousPeriodWindow(
    normStart,
    normEnd,
    earliestActive,
    latestActive
  );

  // When in All-Time mode with multiple days, compare recent half vs prior half;
  // when explicit startDate/endDate is selected, compare [normStart, normEnd] vs [previousPeriodWindow.startDate, previousPeriodWindow.endDate]
  let purchaseComparison: VolumePeriodComparison;
  let paymentComparison: VolumePeriodComparison;

  if (!normStart && !normEnd && previousPeriodWindow.startDate && previousPeriodWindow.endDate && latestActive) {
    // Split at previousPeriodWindow.endDate: prior half vs recent half
    const priorHalfAgg = aggregateWindowVolumes(
      safePurchases,
      safePayments,
      previousPeriodWindow.startDate,
      previousPeriodWindow.endDate
    );
    const prevEndObj = parseIsoToLocalDate(previousPeriodWindow.endDate);
    let recentHalfStart = previousPeriodWindow.endDate;
    if (prevEndObj) {
      const nextDay = new Date(prevEndObj);
      nextDay.setDate(nextDay.getDate() + 1);
      recentHalfStart = toLocalIsoDate(nextDay);
    }
    const recentHalfAgg = aggregateWindowVolumes(
      safePurchases,
      safePayments,
      recentHalfStart,
      latestActive
    );
    purchaseComparison = buildVolumePeriodComparison(
      recentHalfAgg.totalPurchaseVolume,
      priorHalfAgg.totalPurchaseVolume
    );
    paymentComparison = buildVolumePeriodComparison(
      recentHalfAgg.totalPaymentVolume,
      priorHalfAgg.totalPaymentVolume
    );
  } else if (previousPeriodWindow.startDate && previousPeriodWindow.endDate) {
    const prevAgg = aggregateWindowVolumes(
      safePurchases,
      safePayments,
      previousPeriodWindow.startDate,
      previousPeriodWindow.endDate
    );
    purchaseComparison = buildVolumePeriodComparison(
      totalPurchaseVolume,
      prevAgg.totalPurchaseVolume
    );
    paymentComparison = buildVolumePeriodComparison(
      totalPaymentVolume,
      prevAgg.totalPaymentVolume
    );
  } else {
    purchaseComparison = buildVolumePeriodComparison(totalPurchaseVolume, 0);
    paymentComparison = buildVolumePeriodComparison(totalPaymentVolume, 0);
  }

  const netVolumeDelta =
    Math.round((totalPurchaseVolume - totalPaymentVolume) * 100) / 100;

  const settlementRatioPercent =
    totalPurchaseVolume > 0
      ? Math.round((totalPaymentVolume / totalPurchaseVolume) * 1000) / 10
      : totalPaymentVolume > 0
      ? 100
      : 0;

  const activeDaysCount = dailySeries.length;
  const avgDailyPurchaseVolume =
    activeDaysCount > 0
      ? Math.round((totalPurchaseVolume / activeDaysCount) * 100) / 100
      : 0;
  const avgDailyPaymentVolume =
    activeDaysCount > 0
      ? Math.round((totalPaymentVolume / activeDaysCount) * 100) / 100
      : 0;

  let trendStatus: PulseTrendStatus = 'balanced';
  let trendHeadline = 'Balanced Purchase & Payment Flow';
  let trendSummaryText =
    'No purchase or payment volume recorded in the selected date window.';

  if (totalPurchaseVolume > 0 || totalPaymentVolume > 0) {
    if (netVolumeDelta > 0) {
      trendStatus = 'net_payable_growth';
      trendHeadline = 'Purchases Outpace Payments';
      trendSummaryText = `Purchase volume (${totalPurchaseCount} bills) exceeded payment settlements (${totalPaymentCount} entries) by ${netVolumeDelta.toLocaleString()} TK across ${activeDaysCount} active ${
        activeDaysCount === 1 ? 'day' : 'days'
      } (${settlementRatioPercent}% settled).`;
    } else if (netVolumeDelta < 0) {
      trendStatus = 'net_settlement_surplus';
      trendHeadline = 'Payments Exceed New Purchases';
      trendSummaryText = `Payment disbursements (${totalPaymentCount} entries) exceeded new purchase volume (${totalPurchaseCount} bills) by ${Math.abs(
        netVolumeDelta
      ).toLocaleString()} TK across ${activeDaysCount} active ${
        activeDaysCount === 1 ? 'day' : 'days'
      } (${settlementRatioPercent}% settlement ratio).`;
    } else {
      trendStatus = 'balanced';
      trendHeadline = '100% Purchase-to-Payment Equilibrium';
      trendSummaryText = `Total payment volume matched 100% of purchase volume across ${activeDaysCount} active ${
        activeDaysCount === 1 ? 'day' : 'days'
      } with zero net payable variance.`;
    }
  }

  return {
    startDate: normStart,
    endDate: normEnd,
    activeDaysCount,
    totalPurchaseVolume,
    totalPurchaseQtyKg,
    totalPurchaseCount,
    totalPaymentVolume,
    supplierPaymentVolume,
    exporterPaymentVolume,
    totalPaymentCount,
    netVolumeDelta,
    settlementRatioPercent,
    avgDailyPurchaseVolume,
    avgDailyPaymentVolume,
    peakPurchaseDay,
    peakPaymentDay,
    trendStatus,
    trendHeadline,
    trendSummaryText,
    dailySeries,
    previousPeriodWindow,
    purchaseComparison,
    paymentComparison,
  };
}
