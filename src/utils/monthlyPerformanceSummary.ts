import { PurchaseRecord, PaymentRecord } from '../types/index.ts';
import {
  classifyPaymentCategory,
  formatShortYearMonthLabel,
  formatYearMonthLabel,
  getCurrentYearMonth,
} from './calculations.ts';

export type MonthlyPerformancePaymentMode =
  | 'all_payments'
  | 'payment_vouchers'
  | 'challan_paid';

export type MonthlySettlementStatus =
  | 'FULLY_SETTLED'
  | 'PARTIAL_SETTLED'
  | 'UNPAID'
  | 'NO_ACTIVITY';

export interface MonthlyPerformanceDataPoint {
  yearMonth: string;
  shortMonthLabel: string;
  monthLabel: string;
  totalPurchases: number;
  totalPayments: number;
  voucherPayments: number;
  challanDirectPayments: number;
  netPayableVariance: number; // totalPurchases - totalPayments
  paymentRatioPercent: number; // (totalPayments / totalPurchases) * 100
  purchaseCount: number;
  paymentCount: number;
  purchaseVolumeKg: number;
  settlementStatus: MonthlySettlementStatus;
}

export interface MonthlyPerformanceSummaryTotals {
  totalPurchases: number;
  totalPayments: number;
  totalVoucherPayments: number;
  totalChallanDirectPayments: number;
  totalNetPayableVariance: number;
  overallPaymentRatioPercent: number;
  totalPurchaseCount: number;
  totalPaymentCount: number;
  totalPurchaseVolumeKg: number;
  activeMonthsCount: number;
  peakPurchaseMonth: string;
  peakPaymentMonth: string;
}

export interface MonthlyPerformanceSummaryResult {
  points: MonthlyPerformanceDataPoint[];
  totals: MonthlyPerformanceSummaryTotals;
  periodRangeLabel: string;
}

export interface MonthlyPerformanceOptions {
  monthsToShow?: number;
  endYearMonth?: string;
  activeOnly?: boolean;
  paymentMode?: MonthlyPerformancePaymentMode;
  rmbExchangeRate?: number;
}

/**
 * Computes monthly side-by-side comparison points and summary totals for
 * Total Monthly Purchases vs. Total Monthly Payments.
 */
export function calculateMonthlyPerformanceSummary(
  purchases: PurchaseRecord[] = [],
  payments: PaymentRecord[] = [],
  options: MonthlyPerformanceOptions = {}
): MonthlyPerformanceSummaryResult {
  const {
    monthsToShow = 6,
    endYearMonth,
    activeOnly = false,
    paymentMode = 'all_payments',
  } = options;

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const activeMonthsSet = new Set<string>();
  const registerMonth = (dateStr?: string) => {
    if (dateStr && /^\d{4}-\d{2}/.test(dateStr.trim())) {
      activeMonthsSet.add(dateStr.trim().slice(0, 7));
    }
  };

  safePurchases.forEach((p) => registerMonth(p.date));
  safePayments.forEach((pm) => registerMonth(pm.date));

  const sortedActiveMonths = Array.from(activeMonthsSet).sort((a, b) =>
    a.localeCompare(b)
  );
  const fallbackEndMonth =
    endYearMonth ||
    sortedActiveMonths[sortedActiveMonths.length - 1] ||
    getCurrentYearMonth();

  let targetMonths: string[] = [];

  if (activeOnly) {
    targetMonths =
      sortedActiveMonths.length > 0 ? sortedActiveMonths : [fallbackEndMonth];
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

  const points: MonthlyPerformanceDataPoint[] = targetMonths.map((ym) => {
    const monthPurchases = safePurchases.filter(
      (p) => (p.date || '').trim().slice(0, 7) === ym
    );
    const monthPayments = safePayments.filter(
      (pm) => (pm.date || '').trim().slice(0, 7) === ym
    );

    const rawTotalPurchases = monthPurchases.reduce(
      (acc, p) => acc + (Number(p.totalAmount) || 0),
      0
    );
    const rawPurchaseVolume = monthPurchases.reduce(
      (acc, p) => acc + (Number(p.totalQty) || 0),
      0
    );
    const rawChallanPaid = monthPurchases.reduce(
      (acc, p) => acc + (Number(p.paidAmount) || 0),
      0
    );

    const rawVoucherPaid = monthPayments.reduce(
      (acc, pm) => acc + (Number(pm.paidAmount) || 0),
      0
    );

    // Identify any purchase challan payments for suppliers that do not have a dedicated
    // supplier payment voucher in the same month so no real settlement is omitted.
    const voucherSuppliersInMonth = new Set(
      monthPayments
        .filter((pm) => classifyPaymentCategory(pm) === 'supplier')
        .map((pm) => (pm.description || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const unvoucheredChallanPaid = monthPurchases.reduce((acc, p) => {
      const sup = (p.description || '').trim().toLowerCase();
      if (sup && voucherSuppliersInMonth.has(sup)) {
        return acc;
      }
      return acc + (Number(p.paidAmount) || 0);
    }, 0);

    let effectivePayments = 0;
    let effectivePaymentCount = monthPayments.length;

    if (paymentMode === 'payment_vouchers') {
      effectivePayments = rawVoucherPaid;
      effectivePaymentCount = monthPayments.length;
    } else if (paymentMode === 'challan_paid') {
      effectivePayments = rawChallanPaid;
      effectivePaymentCount = monthPurchases.filter(
        (p) => (Number(p.paidAmount) || 0) > 0
      ).length;
    } else {
      // 'all_payments': combines payment vouchers + any unvouchered direct challan settlements
      effectivePayments = rawVoucherPaid + unvoucheredChallanPaid;
      const unvoucheredCount = monthPurchases.filter((p) => {
        const sup = (p.description || '').trim().toLowerCase();
        return (
          (Number(p.paidAmount) || 0) > 0 &&
          (!sup || !voucherSuppliersInMonth.has(sup))
        );
      }).length;
      effectivePaymentCount = monthPayments.length + unvoucheredCount;
    }

    const totalPurchases = Math.round(rawTotalPurchases * 100) / 100;
    const totalPayments = Math.round(effectivePayments * 100) / 100;
    const voucherPayments = Math.round(rawVoucherPaid * 100) / 100;
    const challanDirectPayments = Math.round(rawChallanPaid * 100) / 100;
    const netPayableVariance =
      Math.round((totalPurchases - totalPayments) * 100) / 100;
    const paymentRatioPercent =
      totalPurchases > 0
        ? Math.round((totalPayments / totalPurchases) * 1000) / 10
        : totalPayments > 0
        ? 100
        : 0;

    let settlementStatus: MonthlySettlementStatus = 'NO_ACTIVITY';
    if (totalPurchases === 0 && totalPayments === 0) {
      settlementStatus = 'NO_ACTIVITY';
    } else if (totalPayments >= totalPurchases && totalPurchases > 0) {
      settlementStatus = 'FULLY_SETTLED';
    } else if (totalPayments > 0) {
      settlementStatus = 'PARTIAL_SETTLED';
    } else {
      settlementStatus = 'UNPAID';
    }

    return {
      yearMonth: ym,
      shortMonthLabel: formatShortYearMonthLabel(ym),
      monthLabel: formatYearMonthLabel(ym),
      totalPurchases,
      totalPayments,
      voucherPayments,
      challanDirectPayments,
      netPayableVariance,
      paymentRatioPercent,
      purchaseCount: monthPurchases.length,
      paymentCount: effectivePaymentCount,
      purchaseVolumeKg: Math.round(rawPurchaseVolume * 100) / 100,
      settlementStatus,
    };
  });

  let peakPurchaseVal = -1;
  let peakPurchaseMonth = 'N/A';
  let peakPaymentVal = -1;
  let peakPaymentMonth = 'N/A';

  const totalsAcc = points.reduce(
    (acc, pt) => {
      if (pt.totalPurchases > peakPurchaseVal && pt.totalPurchases > 0) {
        peakPurchaseVal = pt.totalPurchases;
        peakPurchaseMonth = pt.shortMonthLabel;
      }
      if (pt.totalPayments > peakPaymentVal && pt.totalPayments > 0) {
        peakPaymentVal = pt.totalPayments;
        peakPaymentMonth = pt.shortMonthLabel;
      }
      const isActive = pt.totalPurchases > 0 || pt.totalPayments > 0;
      return {
        totalPurchases: acc.totalPurchases + pt.totalPurchases,
        totalPayments: acc.totalPayments + pt.totalPayments,
        totalVoucherPayments: acc.totalVoucherPayments + pt.voucherPayments,
        totalChallanDirectPayments:
          acc.totalChallanDirectPayments + pt.challanDirectPayments,
        totalPurchaseCount: acc.totalPurchaseCount + pt.purchaseCount,
        totalPaymentCount: acc.totalPaymentCount + pt.paymentCount,
        totalPurchaseVolumeKg: acc.totalPurchaseVolumeKg + pt.purchaseVolumeKg,
        activeMonthsCount: acc.activeMonthsCount + (isActive ? 1 : 0),
      };
    },
    {
      totalPurchases: 0,
      totalPayments: 0,
      totalVoucherPayments: 0,
      totalChallanDirectPayments: 0,
      totalPurchaseCount: 0,
      totalPaymentCount: 0,
      totalPurchaseVolumeKg: 0,
      activeMonthsCount: 0,
    }
  );

  const totalPurchases = Math.round(totalsAcc.totalPurchases * 100) / 100;
  const totalPayments = Math.round(totalsAcc.totalPayments * 100) / 100;
  const totalNetPayableVariance =
    Math.round((totalPurchases - totalPayments) * 100) / 100;
  const overallPaymentRatioPercent =
    totalPurchases > 0
      ? Math.round((totalPayments / totalPurchases) * 1000) / 10
      : totalPayments > 0
      ? 100
      : 0;

  const firstLabel = points[0]?.shortMonthLabel || '';
  const lastLabel = points[points.length - 1]?.shortMonthLabel || '';
  const periodRangeLabel =
    firstLabel && lastLabel
      ? firstLabel === lastLabel
        ? firstLabel
        : `${firstLabel} – ${lastLabel}`
      : 'All Periods';

  return {
    points,
    totals: {
      totalPurchases,
      totalPayments,
      totalVoucherPayments: Math.round(totalsAcc.totalVoucherPayments * 100) / 100,
      totalChallanDirectPayments:
        Math.round(totalsAcc.totalChallanDirectPayments * 100) / 100,
      totalNetPayableVariance,
      overallPaymentRatioPercent,
      totalPurchaseCount: totalsAcc.totalPurchaseCount,
      totalPaymentCount: totalsAcc.totalPaymentCount,
      totalPurchaseVolumeKg: Math.round(totalsAcc.totalPurchaseVolumeKg * 100) / 100,
      activeMonthsCount: totalsAcc.activeMonthsCount,
      peakPurchaseMonth,
      peakPaymentMonth,
    },
    periodRangeLabel,
  };
}
