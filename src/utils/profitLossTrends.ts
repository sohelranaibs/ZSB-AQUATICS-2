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

export type TrendWindowMode = 'active' | '6m' | '12m';

export interface ProfitLossMonthlyTrendPoint {
  yearMonth: string;
  shortMonthLabel: string;
  monthLabel: string;
  exportRevenue: number;
  exportRevenueRMB: number;
  exportWeightKg: number;
  exportConsignmentCount: number;
  supplierPaymentOutflow: number;
  supplierVoucherOutflow: number;
  purchasePaidOutflow: number;
  purchaseBillTotal: number;
  supplierPaymentCount: number;
  otherOperatingCosts: number;
  netCashflowSpread: number;
  netProfitAfterCosts: number;
  outflowToRevenueRatio: number;
  revenueMoMChange: number | null;
  revenueMoMPercent: number | null;
  outflowMoMChange: number | null;
  outflowMoMPercent: number | null;
  spreadMoMChange: number | null;
}

export interface ProfitLossTrendsAggregate {
  points: ProfitLossMonthlyTrendPoint[];
  totalExportRevenue: number;
  totalSupplierOutflow: number;
  totalOtherOperatingCosts: number;
  totalNetCashflowSpread: number;
  overallOutflowToRevenueRatio: number;
  latestMonth: ProfitLossMonthlyTrendPoint | null;
  previousMonth: ProfitLossMonthlyTrendPoint | null;
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function round1(val: number): number {
  return Math.round((Number(val) || 0) * 10) / 10;
}

/**
 * Computes the supplier payment outflow for a specific YYYY-MM month.
 * Combines explicit Supplier Payment Vouchers (category === 'supplier') with any
 * Purchase Challan paid amounts from suppliers that do not already have a supplier
 * payment voucher in the same month, avoiding double-counting when both a purchase
 * bill and a payment voucher are logged for the same supplier in that month.
 */
export function computeMonthlySupplierOutflow(
  monthPurchases: PurchaseRecord[],
  monthPayments: PaymentRecord[]
): {
  supplierPaymentOutflow: number;
  supplierVoucherOutflow: number;
  purchasePaidOutflow: number;
  purchaseBillTotal: number;
  supplierPaymentCount: number;
} {
  const supplierPayments = monthPayments.filter(
    (pm) => classifyPaymentCategory(pm) === 'supplier'
  );

  const suppliersWithVouchers = new Set<string>();
  let supplierVoucherOutflow = 0;

  for (const pm of supplierPayments) {
    const paid = Number(pm.paidAmount) || 0;
    const fallbackTotal = Number(pm.totalAmount) || 0;
    const effectiveOutflow = paid > 0 ? paid : fallbackTotal;
    supplierVoucherOutflow += effectiveOutflow;

    const normSupplier = (pm.description || '').trim().toLowerCase();
    if (normSupplier) {
      suppliersWithVouchers.add(normSupplier);
    }
  }

  let purchasePaidOutflow = 0;
  let purchaseBillTotal = 0;
  let unvoucheredPurchasePaid = 0;
  let unvoucheredPaidCount = 0;

  for (const pur of monthPurchases) {
    const paid = Number(pur.paidAmount) || 0;
    const bill = Number(pur.totalAmount) || 0;
    purchasePaidOutflow += paid;
    purchaseBillTotal += bill;

    const normSupplier = (pur.description || '').trim().toLowerCase();
    if (paid > 0 && (!normSupplier || !suppliersWithVouchers.has(normSupplier))) {
      unvoucheredPurchasePaid += paid;
      unvoucheredPaidCount += 1;
    }
  }

  const supplierPaymentOutflow = round2(supplierVoucherOutflow + unvoucheredPurchasePaid);

  return {
    supplierPaymentOutflow,
    supplierVoucherOutflow: round2(supplierVoucherOutflow),
    purchasePaidOutflow: round2(purchasePaidOutflow),
    purchaseBillTotal: round2(purchaseBillTotal),
    supplierPaymentCount: supplierPayments.length + unvoucheredPaidCount,
  };
}

/**
 * Builds chronological month-over-month trend points comparing Total Export Revenue
 * against Supplier Payment Outflows for the Profit & Loss view.
 */
export function calculateProfitLossMonthlyTrends(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  options: {
    windowMode?: TrendWindowMode;
    endYearMonth?: string;
    rmbExchangeRate?: number;
  } = {}
): ProfitLossTrendsAggregate {
  const {
    windowMode = 'active',
    endYearMonth,
    rmbExchangeRate = 16.5,
  } = options;

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safePackings = Array.isArray(packings) ? packings : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeOtherCosts = Array.isArray(otherCosts) ? otherCosts : [];
  const defaultRate = Number(rmbExchangeRate) > 0 ? Number(rmbExchangeRate) : 16.5;

  const activeMonthsSet = new Set<string>();
  const registerMonth = (dateStr?: string) => {
    if (dateStr && /^\d{4}-\d{2}/.test(dateStr.trim())) {
      activeMonthsSet.add(dateStr.trim().slice(0, 7));
    }
  };

  safePurchases.forEach((p) => registerMonth(p.date));
  safePackings.forEach((pk) => registerMonth(pk.packingDate));
  safePayments.forEach((pm) => registerMonth(pm.date));
  safeOtherCosts.forEach((c) => registerMonth(c.date));

  const sortedActiveMonths = Array.from(activeMonthsSet).sort((a, b) => a.localeCompare(b));
  const resolvedEndMonth =
    endYearMonth ||
    sortedActiveMonths[sortedActiveMonths.length - 1] ||
    getCurrentYearMonth();

  let targetMonths: string[] = [];

  if (windowMode === 'active') {
    targetMonths = sortedActiveMonths.length > 0 ? sortedActiveMonths : [resolvedEndMonth];
  } else {
    const count = windowMode === '12m' ? 12 : 6;
    const parts = resolvedEndMonth.split('-');
    const endYear = Number(parts[0]) || new Date().getFullYear();
    const endMonthIdx = (Number(parts[1]) || new Date().getMonth() + 1) - 1;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(endYear, endMonthIdx - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      targetMonths.push(ym);
    }
  }

  const rawPoints: ProfitLossMonthlyTrendPoint[] = targetMonths.map((ym) => {
    const mPurchases = safePurchases.filter((p) => (p.date || '').trim().slice(0, 7) === ym);
    const mPackings = safePackings.filter((pk) => (pk.packingDate || '').trim().slice(0, 7) === ym);
    const mPayments = safePayments.filter((pm) => (pm.date || '').trim().slice(0, 7) === ym);
    const mOtherCosts = safeOtherCosts.filter((c) => (c.date || '').trim().slice(0, 7) === ym);

    let exportRevenue = 0;
    let exportRevenueRMB = 0;
    let exportWeightKg = 0;

    for (const pk of mPackings) {
      const valRMB = Number(pk.totalAmount) || 0;
      exportRevenueRMB += valRMB;
      exportWeightKg += Number(pk.totalWeight) || 0;

      const rate = Number(pk.rmbRate) > 0 ? Number(pk.rmbRate) : 0;
      if (rate > 0) {
        exportRevenue += calculatePackingTotalAmountBDT(valRMB, rate);
      } else if (pk.totalAmountBDT !== undefined && Number(pk.totalAmountBDT) > 0) {
        exportRevenue += Number(pk.totalAmountBDT) || 0;
      } else {
        exportRevenue += calculatePackingTotalAmountBDT(valRMB, defaultRate);
      }
    }

    exportRevenue = round2(exportRevenue);
    exportRevenueRMB = round2(exportRevenueRMB);
    exportWeightKg = round2(exportWeightKg);

    const outflowStats = computeMonthlySupplierOutflow(mPurchases, mPayments);
    const otherOperatingCosts = round2(
      mOtherCosts.reduce((acc, c) => acc + (Number(c.amount) || 0), 0)
    );

    const netCashflowSpread = round2(exportRevenue - outflowStats.supplierPaymentOutflow);
    const netProfitAfterCosts = round2(
      exportRevenue - outflowStats.purchaseBillTotal - otherOperatingCosts
    );
    const outflowToRevenueRatio =
      exportRevenue > 0
        ? round1((outflowStats.supplierPaymentOutflow / exportRevenue) * 100)
        : 0;

    return {
      yearMonth: ym,
      shortMonthLabel: formatShortYearMonthLabel(ym),
      monthLabel: formatYearMonthLabel(ym),
      exportRevenue,
      exportRevenueRMB,
      exportWeightKg,
      exportConsignmentCount: mPackings.length,
      supplierPaymentOutflow: outflowStats.supplierPaymentOutflow,
      supplierVoucherOutflow: outflowStats.supplierVoucherOutflow,
      purchasePaidOutflow: outflowStats.purchasePaidOutflow,
      purchaseBillTotal: outflowStats.purchaseBillTotal,
      supplierPaymentCount: outflowStats.supplierPaymentCount,
      otherOperatingCosts,
      netCashflowSpread,
      netProfitAfterCosts,
      outflowToRevenueRatio,
      revenueMoMChange: null,
      revenueMoMPercent: null,
      outflowMoMChange: null,
      outflowMoMPercent: null,
      spreadMoMChange: null,
    };
  });

  // Compute Month-over-Month (MoM) deltas against the prior point
  const points: ProfitLossMonthlyTrendPoint[] = rawPoints.map((pt, idx) => {
    if (idx === 0) return pt;
    const prev = rawPoints[idx - 1];

    const revenueMoMChange = round2(pt.exportRevenue - prev.exportRevenue);
    const revenueMoMPercent =
      prev.exportRevenue > 0
        ? round1(((pt.exportRevenue - prev.exportRevenue) / prev.exportRevenue) * 100)
        : null;

    const outflowMoMChange = round2(pt.supplierPaymentOutflow - prev.supplierPaymentOutflow);
    const outflowMoMPercent =
      prev.supplierPaymentOutflow > 0
        ? round1(
            ((pt.supplierPaymentOutflow - prev.supplierPaymentOutflow) /
              prev.supplierPaymentOutflow) *
              100
          )
        : null;

    const spreadMoMChange = round2(pt.netCashflowSpread - prev.netCashflowSpread);

    return {
      ...pt,
      revenueMoMChange,
      revenueMoMPercent,
      outflowMoMChange,
      outflowMoMPercent,
      spreadMoMChange,
    };
  });

  const totalExportRevenue = round2(
    points.reduce((acc, p) => acc + p.exportRevenue, 0)
  );
  const totalSupplierOutflow = round2(
    points.reduce((acc, p) => acc + p.supplierPaymentOutflow, 0)
  );
  const totalOtherOperatingCosts = round2(
    points.reduce((acc, p) => acc + p.otherOperatingCosts, 0)
  );
  const totalNetCashflowSpread = round2(totalExportRevenue - totalSupplierOutflow);
  const overallOutflowToRevenueRatio =
    totalExportRevenue > 0
      ? round1((totalSupplierOutflow / totalExportRevenue) * 100)
      : 0;

  // Identify latest and previous populated/chronological month for headline MoM badges
  const populatedPoints = points.filter(
    (p) => p.exportRevenue > 0 || p.supplierPaymentOutflow > 0 || p.otherOperatingCosts > 0
  );
  const effectiveSeries = populatedPoints.length > 0 ? populatedPoints : points;
  const latestMonth =
    effectiveSeries.length > 0 ? effectiveSeries[effectiveSeries.length - 1] : null;
  const previousMonth =
    effectiveSeries.length > 1 ? effectiveSeries[effectiveSeries.length - 2] : null;

  return {
    points,
    totalExportRevenue,
    totalSupplierOutflow,
    totalOtherOperatingCosts,
    totalNetCashflowSpread,
    overallOutflowToRevenueRatio,
    latestMonth,
    previousMonth,
  };
}
