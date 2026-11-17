import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';
import {
  calculatePackingTotalAmountBDT,
  classifyPaymentCategory,
  formatShortYearMonthLabel,
  formatYearMonthLabel,
  getCurrentYearMonth,
} from './calculations.ts';
import { buildRollingMonthWindow } from './supplierPerformance.ts';

export type TrendWindowMode = 'active' | '6m' | '12m';

export interface ProfitLossMonthlyTrendPoint {
  yearMonth: string;
  shortMonthLabel: string;
  monthLabel: string;
  exportRevenue: number;
  supplierPaymentOutflow: number;
  netCashflowSpread: number;
  revenueMoMPercent: number | null;
  outflowMoMPercent: number | null;
  outflowToRevenueRatio: number;
  exportConsignmentCount: number;
  supplierPaymentCount: number;
}

export interface ProfitLossMonthlyTrendsResult {
  windowMode: TrendWindowMode;
  points: ProfitLossMonthlyTrendPoint[];
  latestMonth: ProfitLossMonthlyTrendPoint | null;
  previousMonth: ProfitLossMonthlyTrendPoint | null;
  totalExportRevenue: number;
  totalSupplierOutflow: number;
  totalNetCashflowSpread: number;
  overallOutflowToRevenueRatio: number;
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function round1(val: number): number {
  return Math.round((Number(val) || 0) * 10) / 10;
}

function calculateMoMPercent(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous <= 0) {
    return null;
  }
  return round1(((current - previous) / previous) * 100);
}

/**
 * Computes Month-over-Month Export Revenue vs. Supplier Payment Outflow trends
 * for the Profit & Loss Statement sheet (Bar/Net Spread, Area Trajectory, and MoM Ledger).
 */
export function calculateProfitLossMonthlyTrends(
  purchases: PurchaseRecord[] = [],
  packings: PackingRecord[] = [],
  payments: PaymentRecord[] = [],
  otherCosts: OtherCostRecord[] = [],
  options: {
    windowMode?: TrendWindowMode;
    rmbExchangeRate?: number;
    endYearMonth?: string;
  } = {}
): ProfitLossMonthlyTrendsResult {
  const {
    windowMode = 'active',
    rmbExchangeRate = 16.5,
    endYearMonth,
  } = options;

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safePackings = Array.isArray(packings) ? packings : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeOtherCosts = Array.isArray(otherCosts) ? otherCosts : [];
  const rate = Number(rmbExchangeRate) > 0 ? Number(rmbExchangeRate) : 16.5;

  const activeMonthsSet = new Set<string>();
  const registerMonth = (dateStr?: string) => {
    const clean = (dateStr || '').trim();
    if (/^\d{4}-\d{2}/.test(clean)) {
      activeMonthsSet.add(clean.slice(0, 7));
    }
  };

  safePurchases.forEach((p) => registerMonth(p.date));
  safePackings.forEach((pk) => registerMonth(pk.packingDate));
  safePayments.forEach((pm) => registerMonth(pm.date));
  safeOtherCosts.forEach((c) => registerMonth(c.date));

  const sortedActiveMonths = Array.from(activeMonthsSet).sort((a, b) => a.localeCompare(b));
  const resolvedEndMonth =
    (endYearMonth && /^\d{4}-\d{2}$/.test(endYearMonth.trim()) ? endYearMonth.trim() : '') ||
    sortedActiveMonths[sortedActiveMonths.length - 1] ||
    getCurrentYearMonth();

  let targetMonths: string[] = [];
  if (windowMode === '6m') {
    targetMonths = buildRollingMonthWindow(resolvedEndMonth, 6);
  } else if (windowMode === '12m') {
    targetMonths = buildRollingMonthWindow(resolvedEndMonth, 12);
  } else {
    targetMonths = sortedActiveMonths.length > 0 ? sortedActiveMonths : [resolvedEndMonth];
  }

  const rawPoints = targetMonths.map((ym) => {
    const monthPackings = safePackings.filter(
      (pk) => (pk.packingDate || '').trim().slice(0, 7) === ym
    );
    const monthPurchases = safePurchases.filter(
      (p) => (p.date || '').trim().slice(0, 7) === ym
    );
    const monthSupplierVouchers = safePayments.filter(
      (pm) =>
        (pm.date || '').trim().slice(0, 7) === ym &&
        classifyPaymentCategory(pm) === 'supplier'
    );

    const exportRevenue = round2(
      monthPackings.reduce((acc, pk) => {
        const val = Number(pk.totalAmount) || 0;
        const pkgRate = Number(pk.rmbRate) || 0;
        if (pkgRate > 0) {
          return acc + calculatePackingTotalAmountBDT(val, pkgRate);
        }
        if (pk.totalAmountBDT !== undefined && Number(pk.totalAmountBDT) > 0) {
          return acc + (Number(pk.totalAmountBDT) || 0);
        }
        return acc + calculatePackingTotalAmountBDT(val, rate);
      }, 0)
    );

    const voucherSuppliersInMonth = new Set(
      monthSupplierVouchers
        .map((pm) => (pm.description || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const voucherOutflow = monthSupplierVouchers.reduce(
      (acc, pm) => acc + (Number(pm.paidAmount) || 0),
      0
    );

    const unvoucheredPurchases = monthPurchases.filter((p) => {
      const sup = (p.description || '').trim().toLowerCase();
      return (Number(p.paidAmount) || 0) > 0 && (!sup || !voucherSuppliersInMonth.has(sup));
    });

    const unvoucheredPurchaseOutflow = unvoucheredPurchases.reduce(
      (acc, p) => acc + (Number(p.paidAmount) || 0),
      0
    );

    const supplierPaymentOutflow = round2(voucherOutflow + unvoucheredPurchaseOutflow);
    const supplierPaymentCount = monthSupplierVouchers.length + unvoucheredPurchases.length;
    const netCashflowSpread = round2(exportRevenue - supplierPaymentOutflow);
    const outflowToRevenueRatio =
      exportRevenue > 0
        ? round1((supplierPaymentOutflow / exportRevenue) * 100)
        : supplierPaymentOutflow > 0
        ? 100
        : 0;

    return {
      yearMonth: ym,
      shortMonthLabel: formatShortYearMonthLabel(ym),
      monthLabel: formatYearMonthLabel(ym),
      exportRevenue,
      supplierPaymentOutflow,
      netCashflowSpread,
      outflowToRevenueRatio,
      exportConsignmentCount: monthPackings.length,
      supplierPaymentCount,
    };
  });

  const points: ProfitLossMonthlyTrendPoint[] = rawPoints.map((pt, idx) => {
    const prev = idx > 0 ? rawPoints[idx - 1] : undefined;
    return {
      ...pt,
      revenueMoMPercent: calculateMoMPercent(pt.exportRevenue, prev?.exportRevenue),
      outflowMoMPercent: calculateMoMPercent(
        pt.supplierPaymentOutflow,
        prev?.supplierPaymentOutflow
      ),
    };
  });

  const totalExportRevenue = round2(points.reduce((sum, p) => sum + p.exportRevenue, 0));
  const totalSupplierOutflow = round2(
    points.reduce((sum, p) => sum + p.supplierPaymentOutflow, 0)
  );
  const totalNetCashflowSpread = round2(totalExportRevenue - totalSupplierOutflow);
  const overallOutflowToRevenueRatio =
    totalExportRevenue > 0
      ? round1((totalSupplierOutflow / totalExportRevenue) * 100)
      : totalSupplierOutflow > 0
      ? 100
      : 0;

  return {
    windowMode,
    points,
    latestMonth: points.length > 0 ? points[points.length - 1] : null,
    previousMonth: points.length > 1 ? points[points.length - 2] : null,
    totalExportRevenue,
    totalSupplierOutflow,
    totalNetCashflowSpread,
    overallOutflowToRevenueRatio,
  };
}
