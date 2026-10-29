import { PurchaseRecord, PackingRecord, MortalityRecord } from '../types/index.ts';

export type StockAlertLevel = 'critical_low' | 'approaching_low' | 'healthy';

export interface InventoryStockItem {
  item: string;
  purchasedKg: number;
  exportedKg: number;
  mortalityKg: number;
  currentStockKg: number;
  invoiceCount: number;
  lastUpdatedDate: string;
  latestSupplier: string;
  minThresholdKg: number;
  approachingCeilingKg: number;
  shortfallOrBufferKg: number; // currentStockKg - minThresholdKg
  thresholdRatioPercent: number; // Math.round((currentStockKg / minThresholdKg) * 100)
  status: StockAlertLevel;
}

export interface LowStockSummary {
  minThresholdKg: number;
  approachingThresholdPercent: number;
  approachingCeilingKg: number;
  totalTrackedItems: number;
  totalPurchasedKg: number;
  totalExportedKg: number;
  totalMortalityKg: number;
  totalAvailableStockKg: number;
  totalStockStatus: StockAlertLevel;
  totalShortfallOrBufferKg: number; // totalAvailableStockKg - minThresholdKg
  totalThresholdRatioPercent: number; // Math.round((totalAvailableStockKg / minThresholdKg) * 100)
  mortalityCount: number;
  criticalLowCount: number; // currentStockKg <= minThresholdKg
  approachingLowCount: number; // minThresholdKg < currentStockKg <= approachingCeilingKg
  flaggedCount: number; // criticalLowCount + approachingLowCount
  healthyCount: number;
  flaggedItems: InventoryStockItem[];
  allItems: InventoryStockItem[];
}

export const DEFAULT_MIN_INVENTORY_THRESHOLD_KG = 100;
export const DEFAULT_APPROACHING_THRESHOLD_PERCENT = 25;

/**
 * Calculates current inventory stock (KG) per item/grade across purchase records,
 * deducting exported quantities (from packing manifests) and mortality losses (from mortality logs),
 * and classifies each item against the minimum inventory threshold defined in settings.
 */
export function calculateInventoryStockItems(
  purchases: PurchaseRecord[],
  packings: PackingRecord[] = [],
  mortalitiesOrThreshold?: MortalityRecord[] | number,
  minThresholdOrApproaching?: number,
  approachingPercentArg?: number
): InventoryStockItem[] {
  let mortalities: MortalityRecord[] = [];
  let minThresholdKg = DEFAULT_MIN_INVENTORY_THRESHOLD_KG;
  let approachingPercent = DEFAULT_APPROACHING_THRESHOLD_PERCENT;

  if (Array.isArray(mortalitiesOrThreshold)) {
    mortalities = mortalitiesOrThreshold;
    if (typeof minThresholdOrApproaching === 'number') {
      minThresholdKg = minThresholdOrApproaching;
    }
    if (typeof approachingPercentArg === 'number') {
      approachingPercent = approachingPercentArg;
    }
  } else if (typeof mortalitiesOrThreshold === 'number') {
    minThresholdKg = mortalitiesOrThreshold;
    if (typeof minThresholdOrApproaching === 'number') {
      approachingPercent = minThresholdOrApproaching;
    }
  }

  const safeMinThreshold = Math.max(1, Number(minThresholdKg) || DEFAULT_MIN_INVENTORY_THRESHOLD_KG);
  const safeApproachingPct = Math.max(0, Number(approachingPercent) ?? DEFAULT_APPROACHING_THRESHOLD_PERCENT);
  const approachingCeilingKg =
    Math.round(safeMinThreshold * (1 + safeApproachingPct / 100) * 100) / 100;

  const itemMap = new Map<
    string,
    {
      purchasedKg: number;
      exportedKg: number;
      mortalityKg: number;
      invoices: Set<string>;
      lastUpdatedDate: string;
      latestSupplier: string;
    }
  >();

  // Aggregate procurement quantities by item grade
  for (const pur of purchases || []) {
    const purDate = pur.date || '';
    const supplier = pur.description || 'Supplier';
    for (const row of pur.items || []) {
      const code = (row.item || '').trim().toUpperCase();
      if (!code) continue;
      const qty = Number(row.quantity) || 0;
      if (qty <= 0) continue;

      const existing = itemMap.get(code) || {
        purchasedKg: 0,
        exportedKg: 0,
        mortalityKg: 0,
        invoices: new Set<string>(),
        lastUpdatedDate: purDate,
        latestSupplier: supplier,
      };

      existing.purchasedKg = Math.round((existing.purchasedKg + qty) * 100) / 100;
      if (pur.invoiceNumber) {
        existing.invoices.add(pur.invoiceNumber);
      }
      if (!existing.lastUpdatedDate || purDate >= existing.lastUpdatedDate) {
        existing.lastUpdatedDate = purDate;
        existing.latestSupplier = supplier;
      }
      itemMap.set(code, existing);
    }
  }

  // Deduct any matching item codes exported in packing manifests
  for (const pkg of packings || []) {
    for (const row of pkg.items || []) {
      const code = (row.item || '').trim().toUpperCase();
      if (!code) continue;
      const existing = itemMap.get(code);
      if (!existing) continue;
      const expWeight = Number(row.totalWeight) || 0;
      if (expWeight > 0) {
        existing.exportedKg = Math.round((existing.exportedKg + expWeight) * 100) / 100;
      }
    }
  }

  // Deduct mortality losses per species / grade for automated stock adjustment
  for (const mort of mortalities || []) {
    const code = (mort.species || '').trim().toUpperCase();
    if (!code) continue;
    const mortWeight = Number(mort.quantityKg) || 0;
    if (mortWeight <= 0) continue;

    const existing = itemMap.get(code) || {
      purchasedKg: 0,
      exportedKg: 0,
      mortalityKg: 0,
      invoices: new Set<string>(),
      lastUpdatedDate: mort.date || '',
      latestSupplier: 'Mortality Adjustment',
    };

    existing.mortalityKg = Math.round((existing.mortalityKg + mortWeight) * 100) / 100;
    if (!existing.lastUpdatedDate || (mort.date && mort.date >= existing.lastUpdatedDate)) {
      existing.lastUpdatedDate = mort.date;
    }
    itemMap.set(code, existing);
  }

  const results: InventoryStockItem[] = [];
  for (const [item, entry] of itemMap.entries()) {
    // Current stock after exports and mortality stock adjustments
    const currentStockKg = Math.max(
      0,
      Math.round((entry.purchasedKg - entry.exportedKg - entry.mortalityKg) * 100) / 100
    );
    const shortfallOrBufferKg = Math.round((currentStockKg - safeMinThreshold) * 100) / 100;
    const thresholdRatioPercent = Math.round((currentStockKg / safeMinThreshold) * 100);

    let status: StockAlertLevel = 'healthy';
    if (currentStockKg <= safeMinThreshold) {
      status = 'critical_low';
    } else if (currentStockKg <= approachingCeilingKg) {
      status = 'approaching_low';
    }

    results.push({
      item,
      purchasedKg: entry.purchasedKg,
      exportedKg: entry.exportedKg,
      mortalityKg: entry.mortalityKg,
      currentStockKg,
      invoiceCount: entry.invoices.size,
      lastUpdatedDate: entry.lastUpdatedDate,
      latestSupplier: entry.latestSupplier,
      minThresholdKg: safeMinThreshold,
      approachingCeilingKg,
      shortfallOrBufferKg,
      thresholdRatioPercent,
      status,
    });
  }

  // Sort: critical_low first, then approaching_low, then healthy, and by lowest stock ascending
  const statusPriority: Record<StockAlertLevel, number> = {
    critical_low: 0,
    approaching_low: 1,
    healthy: 2,
  };

  results.sort((a, b) => {
    const pDiff = statusPriority[a.status] - statusPriority[b.status];
    if (pDiff !== 0) return pDiff;
    if (a.currentStockKg !== b.currentStockKg) return a.currentStockKg - b.currentStockKg;
    return a.item.localeCompare(b.item);
  });

  return results;
}

/**
 * Computes summary counts and lists of low-stock / approaching-threshold items for the
 * DashboardView notification badge and inventory threshold alert card, incorporating
 * recorded mortality stock adjustments.
 */
export function calculateLowStockSummary(
  purchases: PurchaseRecord[],
  packings: PackingRecord[] = [],
  mortalitiesOrThreshold?: MortalityRecord[] | number,
  minThresholdOrApproaching?: number,
  approachingPercentArg?: number
): LowStockSummary {
  let mortalities: MortalityRecord[] = [];
  let minThresholdKg = DEFAULT_MIN_INVENTORY_THRESHOLD_KG;
  let approachingPercent = DEFAULT_APPROACHING_THRESHOLD_PERCENT;

  if (Array.isArray(mortalitiesOrThreshold)) {
    mortalities = mortalitiesOrThreshold;
    if (typeof minThresholdOrApproaching === 'number') {
      minThresholdKg = minThresholdOrApproaching;
    }
    if (typeof approachingPercentArg === 'number') {
      approachingPercent = approachingPercentArg;
    }
  } else if (typeof mortalitiesOrThreshold === 'number') {
    minThresholdKg = mortalitiesOrThreshold;
    if (typeof minThresholdOrApproaching === 'number') {
      approachingPercent = minThresholdOrApproaching;
    }
  }

  const safeMinThreshold = Math.max(1, Number(minThresholdKg) || DEFAULT_MIN_INVENTORY_THRESHOLD_KG);
  const safeApproachingPct = Math.max(0, Number(approachingPercent) ?? DEFAULT_APPROACHING_THRESHOLD_PERCENT);
  const approachingCeilingKg =
    Math.round(safeMinThreshold * (1 + safeApproachingPct / 100) * 100) / 100;

  const allItems = calculateInventoryStockItems(
    purchases,
    packings,
    mortalities,
    safeMinThreshold,
    safeApproachingPct
  );

  const criticalItems = allItems.filter((it) => it.status === 'critical_low');
  const approachingItems = allItems.filter((it) => it.status === 'approaching_low');
  const healthyItems = allItems.filter((it) => it.status === 'healthy');
  const flaggedItems = [...criticalItems, ...approachingItems];

  // Total Procurement (KG) across all purchases
  const totalPurchasedKg = Math.round(
    (purchases || []).reduce((acc, p) => acc + (Number(p.totalQty) || 0), 0) * 100
  ) / 100;

  // Total Exported (KG) across all packing manifests
  const totalExportedKg = Math.round(
    (packings || []).reduce((acc, pk) => acc + (Number(pk.totalWeight) || 0), 0) * 100
  ) / 100;

  // Total Mortality Losses (KG) across all mortality records
  const totalMortalityKg = Math.round(
    (mortalities || []).reduce((acc, m) => acc + (Number(m.quantityKg) || 0), 0) * 100
  ) / 100;

  // Cumulative Total Available Stock = Procured - Exported - Mortality
  const totalAvailableStockKg = Math.max(
    0,
    Math.round((totalPurchasedKg - totalExportedKg - totalMortalityKg) * 100) / 100
  );

  let totalStockStatus: StockAlertLevel = 'healthy';
  if (totalAvailableStockKg <= safeMinThreshold) {
    totalStockStatus = 'critical_low';
  } else if (totalAvailableStockKg <= approachingCeilingKg) {
    totalStockStatus = 'approaching_low';
  }

  const totalShortfallOrBufferKg = Math.round((totalAvailableStockKg - safeMinThreshold) * 100) / 100;
  const totalThresholdRatioPercent = safeMinThreshold > 0
    ? Math.round((totalAvailableStockKg / safeMinThreshold) * 100)
    : 100;

  return {
    minThresholdKg: safeMinThreshold,
    approachingThresholdPercent: safeApproachingPct,
    approachingCeilingKg,
    totalTrackedItems: allItems.length,
    totalPurchasedKg,
    totalExportedKg,
    totalMortalityKg,
    totalAvailableStockKg,
    totalStockStatus,
    totalShortfallOrBufferKg,
    totalThresholdRatioPercent,
    mortalityCount: (mortalities || []).length,
    criticalLowCount: criticalItems.length,
    approachingLowCount: approachingItems.length,
    flaggedCount: flaggedItems.length,
    healthyCount: healthyItems.length,
    flaggedItems,
    allItems,
  };
}
