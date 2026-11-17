import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';
import { calculateMonthlyTrends } from './calculations.ts';

export interface ProfitLossAreaTrendPoint {
  yearMonth: string;
  monthLabel: string;
  revenue: number;
  costs: number;
  purchasesCost: number;
  operatingCost: number;
  netProfit: number;
}

export interface ProfitLossTrendSummary {
  points: ProfitLossAreaTrendPoint[];
  totalRevenue: number;
  totalCosts: number;
  totalNetProfit: number;
  overallMarginPercent: number;
  periodRangeLabel: string;
}

/**
 * Formats BDT/currency Y-axis tick values cleanly (e.g., 0 -> "0", 150000 -> "150k", 1250000 -> "1.3M").
 */
export function formatCompactCurrencyAxisTick(val: number): string {
  const num = Number(val) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

/**
 * Builds the 6-month Profit & Loss area-chart dataset pairing Monthly Export Revenue
 * against Total Monthly Costs (Procurement + Other Operating Costs).
 */
export function buildSixMonthProfitLossTrends(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  options: {
    rmbExchangeRate?: number;
    endYearMonth?: string;
    monthsToShow?: number;
  } = {}
): ProfitLossTrendSummary {
  const {
    rmbExchangeRate = 16.5,
    endYearMonth,
    monthsToShow = 6,
  } = options;

  const monthly = calculateMonthlyTrends(purchases, packings, payments, otherCosts, {
    monthsToShow,
    endYearMonth,
    activeOnly: false,
    rmbExchangeRate,
  });

  const points: ProfitLossAreaTrendPoint[] = monthly.map((m) => {
    const revenue = Math.round((Number(m.exportValue) || 0) * 100) / 100;
    const purchasesCost = Math.round((Number(m.purchaseValue) || 0) * 100) / 100;
    const operatingCost = Math.round((Number(m.otherCosts) || 0) * 100) / 100;
    const costs = Math.round((purchasesCost + operatingCost) * 100) / 100;
    const netProfit = Math.round((revenue - costs) * 100) / 100;

    return {
      yearMonth: m.yearMonth,
      monthLabel: m.shortMonthLabel,
      revenue,
      costs,
      purchasesCost,
      operatingCost,
      netProfit,
    };
  });

  const totalRevenue =
    Math.round(points.reduce((sum, p) => sum + p.revenue, 0) * 100) / 100;
  const totalCosts =
    Math.round(points.reduce((sum, p) => sum + p.costs, 0) * 100) / 100;
  const totalNetProfit = Math.round((totalRevenue - totalCosts) * 100) / 100;
  const overallMarginPercent =
    totalRevenue > 0
      ? Math.round((totalNetProfit / totalRevenue) * 10000) / 100
      : 0;

  const periodRangeLabel =
    points.length > 1
      ? `${points[0].monthLabel} – ${points[points.length - 1].monthLabel}`
      : points[0]?.monthLabel || 'Last 6 Months';

  return {
    points,
    totalRevenue,
    totalCosts,
    totalNetProfit,
    overallMarginPercent,
    periodRangeLabel,
  };
}
