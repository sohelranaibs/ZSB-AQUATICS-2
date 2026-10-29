import { PurchaseRecord } from '../types/index.ts';
import {
  formatShortYearMonthLabel,
  getCurrentYearMonth,
} from './calculations.ts';

export type SupplierPerformanceWindow = '6m' | 'all';

export interface SupplierMonthlyPoint {
  yearMonth: string;
  shortMonthLabel: string;
  purchaseValue: number;
  quantityKg: number;
  invoiceCount: number;
}

export interface SupplierPerformanceMetric {
  rank: number;
  supplierName: string;
  shortLabel: string;
  contactNumber: string;
  totalPurchaseValue: number;
  totalPaidAmount: number;
  totalBalanceDue: number;
  totalQuantityKg: number;
  invoiceCount: number;
  avgRatePerKg: number;
  shareOfWindowSpendPercent: number;
  shareOfTop5Percent: number;
  settlementRatePercent: number;
  latestPurchaseDate: string;
  latestInvoiceNumber: string;
  topItems: string[];
  monthlyBreakdown: SupplierMonthlyPoint[];
}

export interface SupplierPerformanceSummary {
  windowMode: SupplierPerformanceWindow;
  monthsWindow: number;
  startYearMonth: string;
  endYearMonth: string;
  windowRangeLabel: string;
  targetMonths: string[];
  topSuppliers: SupplierPerformanceMetric[];
  allSuppliersCount: number;
  totalWindowPurchaseValue: number;
  totalWindowQuantityKg: number;
  totalWindowInvoices: number;
  top5TotalPurchaseValue: number;
  top5TotalPaidAmount: number;
  top5TotalBalanceDue: number;
  top5TotalQuantityKg: number;
  top5ShareOfTotalPercent: number;
  top5SettlementRatePercent: number;
  top5WeightedAvgRatePerKg: number;
  topSupplier: SupplierPerformanceMetric | null;
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function round1(val: number): number {
  return Math.round((Number(val) || 0) * 10) / 10;
}

/**
 * Generates an ordered list of YYYY-MM strings for a rolling N-month window ending at `endYearMonth`.
 */
export function buildRollingMonthWindow(
  endYearMonth: string,
  monthsCount: number = 6
): string[] {
  const safeCount = Math.max(1, Math.floor(Number(monthsCount) || 6));
  const parts = (endYearMonth || '').trim().split('-');
  const endYear = Number(parts[0]) || new Date().getFullYear();
  const endMonthIdx = (Number(parts[1]) || new Date().getMonth() + 1) - 1;

  const result: string[] = [];
  for (let i = safeCount - 1; i >= 0; i--) {
    const d = new Date(endYear, endMonthIdx - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push(ym);
  }
  return result;
}

function buildShortSupplierLabel(name: string): string {
  const cleaned = (name || 'Unknown').trim();
  if (cleaned.length <= 14) return cleaned;
  return `${cleaned.slice(0, 12).trim()}…`;
}

/**
 * Computes the Top N (default 5) suppliers by total purchase value over the last 6 months
 * (or all time when windowMode === 'all') for the Profit & Loss Supplier Performance module.
 */
export function calculateSupplierPerformance(
  purchases: PurchaseRecord[],
  options: {
    windowMode?: SupplierPerformanceWindow;
    monthsWindow?: number;
    endYearMonth?: string;
    topLimit?: number;
  } = {}
): SupplierPerformanceSummary {
  const {
    windowMode = '6m',
    monthsWindow = 6,
    endYearMonth,
    topLimit = 5,
  } = options;

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safeLimit = Math.max(1, Math.floor(Number(topLimit) || 5));
  const safeMonthsWindow = Math.max(1, Math.floor(Number(monthsWindow) || 6));

  // Extract all valid YYYY-MM months present in purchase records
  const activeMonthsSet = new Set<string>();
  for (const pur of safePurchases) {
    const rawDate = (pur.date || '').trim();
    if (/^\d{4}-\d{2}/.test(rawDate)) {
      activeMonthsSet.add(rawDate.slice(0, 7));
    }
  }

  const sortedActiveMonths = Array.from(activeMonthsSet).sort((a, b) =>
    a.localeCompare(b)
  );

  const resolvedEndMonth =
    (endYearMonth && /^\d{4}-\d{2}$/.test(endYearMonth.trim())
      ? endYearMonth.trim()
      : '') ||
    sortedActiveMonths[sortedActiveMonths.length - 1] ||
    getCurrentYearMonth();

  let targetMonths: string[] = [];
  let startYearMonth = resolvedEndMonth;

  if (windowMode === '6m') {
    targetMonths = buildRollingMonthWindow(resolvedEndMonth, safeMonthsWindow);
    startYearMonth = targetMonths[0] || resolvedEndMonth;
  } else {
    targetMonths =
      sortedActiveMonths.length > 0 ? sortedActiveMonths : [resolvedEndMonth];
    startYearMonth = targetMonths[0] || resolvedEndMonth;
  }

  const targetMonthSet = new Set<string>(targetMonths);

  // Filter purchases within the active window
  const windowPurchases = safePurchases.filter((pur) => {
    const ym = (pur.date || '').trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return false;
    if (windowMode === 'all') return true;
    return targetMonthSet.has(ym);
  });

  interface InternalSupplierBucket {
    supplierName: string;
    contactNumber: string;
    totalPurchaseValue: number;
    totalPaidAmount: number;
    totalBalanceDue: number;
    totalQuantityKg: number;
    invoiceCount: number;
    latestPurchaseDate: string;
    latestInvoiceNumber: string;
    itemsSet: Set<string>;
    byMonth: Map<
      string,
      { purchaseValue: number; quantityKg: number; invoiceCount: number }
    >;
  }

  const supplierMap = new Map<string, InternalSupplierBucket>();
  let totalWindowPurchaseValue = 0;
  let totalWindowQuantityKg = 0;

  for (const pur of windowPurchases) {
    const rawName = (pur.description || '').trim() || 'UNSPECIFIED SUPPLIER';
    const key = rawName.toLowerCase();

    const amount = round2(Number(pur.totalAmount) || 0);
    const paid = round2(Number(pur.paidAmount) || 0);
    const explicitBalance = Number(pur.balance);
    const due = round2(
      !Number.isNaN(explicitBalance) && explicitBalance >= 0
        ? explicitBalance
        : Math.max(0, amount - paid)
    );

    const itemRows = Array.isArray(pur.items) ? pur.items : [];
    const computedQtyFromItems = itemRows.reduce(
      (sum, row) => sum + (Number(row.quantity) || 0),
      0
    );
    const qty = round2(
      Number(pur.totalQty) > 0 ? Number(pur.totalQty) : computedQtyFromItems
    );

    totalWindowPurchaseValue = round2(totalWindowPurchaseValue + amount);
    totalWindowQuantityKg = round2(totalWindowQuantityKg + qty);

    let bucket = supplierMap.get(key);
    if (!bucket) {
      bucket = {
        supplierName: rawName.toUpperCase(),
        contactNumber: (pur.contactNumber || '').trim(),
        totalPurchaseValue: 0,
        totalPaidAmount: 0,
        totalBalanceDue: 0,
        totalQuantityKg: 0,
        invoiceCount: 0,
        latestPurchaseDate: (pur.date || '').trim(),
        latestInvoiceNumber: (pur.invoiceNumber || '').trim(),
        itemsSet: new Set<string>(),
        byMonth: new Map(),
      };
      supplierMap.set(key, bucket);
    }

    bucket.totalPurchaseValue = round2(bucket.totalPurchaseValue + amount);
    bucket.totalPaidAmount = round2(bucket.totalPaidAmount + paid);
    bucket.totalBalanceDue = round2(bucket.totalBalanceDue + due);
    bucket.totalQuantityKg = round2(bucket.totalQuantityKg + qty);
    bucket.invoiceCount += 1;

    if (!bucket.contactNumber && pur.contactNumber) {
      bucket.contactNumber = pur.contactNumber.trim();
    }

    const purDate = (pur.date || '').trim();
    if (purDate >= bucket.latestPurchaseDate) {
      bucket.latestPurchaseDate = purDate;
      if (pur.invoiceNumber) {
        bucket.latestInvoiceNumber = pur.invoiceNumber.trim();
      }
    }

    for (const row of itemRows) {
      const itemLabel = (row.item || '').trim();
      if (itemLabel) {
        bucket.itemsSet.add(itemLabel);
      }
    }

    const ym = purDate.slice(0, 7);
    if (ym) {
      const mEntry = bucket.byMonth.get(ym) || {
        purchaseValue: 0,
        quantityKg: 0,
        invoiceCount: 0,
      };
      mEntry.purchaseValue = round2(mEntry.purchaseValue + amount);
      mEntry.quantityKg = round2(mEntry.quantityKg + qty);
      mEntry.invoiceCount += 1;
      bucket.byMonth.set(ym, mEntry);
    }
  }

  // Sort all suppliers descending by totalPurchaseValue, then totalQuantityKg, then name
  const sortedBuckets = Array.from(supplierMap.values()).sort((a, b) => {
    if (b.totalPurchaseValue !== a.totalPurchaseValue) {
      return b.totalPurchaseValue - a.totalPurchaseValue;
    }
    if (b.totalQuantityKg !== a.totalQuantityKg) {
      return b.totalQuantityKg - a.totalQuantityKg;
    }
    return a.supplierName.localeCompare(b.supplierName);
  });

  const topBuckets = sortedBuckets.slice(0, safeLimit);

  const top5TotalPurchaseValue = round2(
    topBuckets.reduce((acc, b) => acc + b.totalPurchaseValue, 0)
  );
  const top5TotalPaidAmount = round2(
    topBuckets.reduce((acc, b) => acc + b.totalPaidAmount, 0)
  );
  const top5TotalBalanceDue = round2(
    topBuckets.reduce((acc, b) => acc + b.totalBalanceDue, 0)
  );
  const top5TotalQuantityKg = round2(
    topBuckets.reduce((acc, b) => acc + b.totalQuantityKg, 0)
  );

  const topSuppliers: SupplierPerformanceMetric[] = topBuckets.map(
    (b, index) => {
      const avgRatePerKg =
        b.totalQuantityKg > 0
          ? round2(b.totalPurchaseValue / b.totalQuantityKg)
          : 0;
      const shareOfWindowSpendPercent =
        totalWindowPurchaseValue > 0
          ? round1((b.totalPurchaseValue / totalWindowPurchaseValue) * 100)
          : 0;
      const shareOfTop5Percent =
        top5TotalPurchaseValue > 0
          ? round1((b.totalPurchaseValue / top5TotalPurchaseValue) * 100)
          : 0;
      const settlementRatePercent =
        b.totalPurchaseValue > 0
          ? Math.min(
              100,
              Math.max(0, round1((b.totalPaidAmount / b.totalPurchaseValue) * 100))
            )
          : 0;

      const monthlyBreakdown: SupplierMonthlyPoint[] = targetMonths.map((ym) => {
        const m = b.byMonth.get(ym);
        return {
          yearMonth: ym,
          shortMonthLabel: formatShortYearMonthLabel(ym),
          purchaseValue: m ? m.purchaseValue : 0,
          quantityKg: m ? m.quantityKg : 0,
          invoiceCount: m ? m.invoiceCount : 0,
        };
      });

      return {
        rank: index + 1,
        supplierName: b.supplierName,
        shortLabel: buildShortSupplierLabel(b.supplierName),
        contactNumber: b.contactNumber,
        totalPurchaseValue: b.totalPurchaseValue,
        totalPaidAmount: b.totalPaidAmount,
        totalBalanceDue: b.totalBalanceDue,
        totalQuantityKg: b.totalQuantityKg,
        invoiceCount: b.invoiceCount,
        avgRatePerKg,
        shareOfWindowSpendPercent,
        shareOfTop5Percent,
        settlementRatePercent,
        latestPurchaseDate: b.latestPurchaseDate,
        latestInvoiceNumber: b.latestInvoiceNumber,
        topItems: Array.from(b.itemsSet),
        monthlyBreakdown,
      };
    }
  );

  const top5ShareOfTotalPercent =
    totalWindowPurchaseValue > 0
      ? round1((top5TotalPurchaseValue / totalWindowPurchaseValue) * 100)
      : 0;
  const top5SettlementRatePercent =
    top5TotalPurchaseValue > 0
      ? Math.min(
          100,
          Math.max(0, round1((top5TotalPaidAmount / top5TotalPurchaseValue) * 100))
        )
      : 0;
  const top5WeightedAvgRatePerKg =
    top5TotalQuantityKg > 0
      ? round2(top5TotalPurchaseValue / top5TotalQuantityKg)
      : 0;

  const startLabel = formatShortYearMonthLabel(startYearMonth);
  const endLabel = formatShortYearMonthLabel(resolvedEndMonth);
  const windowRangeLabel =
    windowMode === '6m'
      ? `${startLabel} – ${endLabel} (Last ${safeMonthsWindow} Months)`
      : startYearMonth === resolvedEndMonth
      ? `${endLabel} (All Time)`
      : `${startLabel} – ${endLabel} (All Time)`;

  return {
    windowMode,
    monthsWindow: safeMonthsWindow,
    startYearMonth,
    endYearMonth: resolvedEndMonth,
    windowRangeLabel,
    targetMonths,
    topSuppliers,
    allSuppliersCount: sortedBuckets.length,
    totalWindowPurchaseValue,
    totalWindowQuantityKg,
    totalWindowInvoices: windowPurchases.length,
    top5TotalPurchaseValue,
    top5TotalPaidAmount,
    top5TotalBalanceDue,
    top5TotalQuantityKg,
    top5ShareOfTotalPercent,
    top5SettlementRatePercent,
    top5WeightedAvgRatePerKg,
    topSupplier: topSuppliers[0] || null,
  };
}
