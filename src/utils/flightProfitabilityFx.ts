import {
  MortalityRecord,
  OtherCostRecord,
  PackingRecord,
  PurchaseRecord,
} from '../types/index.ts';

export interface RmbFxRateLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  rateBdtPerRmb: number;
  source?: string;
  notes?: string;
  createdAt: string;
}

export interface FlightProfitabilityRow {
  flightKey: string;
  date: string;
  flight: string;
  destination: string;
  shippingMarks: string[];
  manifestCount: number;
  totalBox: number;
  totalWeightKg: number;
  exportRmb: number;
  bookedRmbRate: number;
  settlementRmbRate: number;
  bookedRevenueBdt: number;
  settlementRevenueBdt: number;
  fxGainLossBdt: number;
  allocatedPurchaseCostBdt: number;
  allocatedMortalityLossBdt: number;
  allocatedOperatingCostBdt: number;
  totalCostBdt: number;
  netProfitBdt: number;
  netMarginPercent: number;
}

export interface FlightProfitabilitySummary {
  rows: FlightProfitabilityRow[];
  totalFlights: number;
  totalExportRmb: number;
  totalBookedRevenueBdt: number;
  totalSettlementRevenueBdt: number;
  totalFxGainLossBdt: number;
  totalCostBdt: number;
  totalNetProfitBdt: number;
  overallMarginPercent: number;
  profitableFlightsCount: number;
  lossMakingFlightsCount: number;
}

export const RMB_FX_HISTORY_STORAGE_KEY = 'zsb_rmb_fx_rate_history_v1';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function loadRmbFxHistory(fallbackRate: number = 16.5): RmbFxRateLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RMB_FX_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is RmbFxRateLogEntry =>
          Boolean(item && typeof item.date === 'string' && Number(item.rateBdtPerRmb) > 0)
      );
    }
    return [];
  } catch {
    return fallbackRate > 0 ? [] : [];
  }
}

export function saveRmbFxHistory(entries: RmbFxRateLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RMB_FX_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Resolves the latest RMB->BDT exchange rate on or before targetDate from FX history,
 * falling back to defaultRate when no history entry matches.
 */
export function resolveHistoricalRmbRate(
  fxHistory: RmbFxRateLogEntry[],
  targetDate: string,
  defaultRate: number
): number {
  const safeDefault = Number(defaultRate) > 0 ? Number(defaultRate) : 16.5;
  if (!Array.isArray(fxHistory) || fxHistory.length === 0) return safeDefault;

  const cleanTarget = (targetDate || '').slice(0, 10);
  const sorted = [...fxHistory]
    .filter((e) => Number(e.rateBdtPerRmb) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!cleanTarget) {
    return sorted[0]?.rateBdtPerRmb ?? safeDefault;
  }

  const onOrBefore = sorted.find((e) => e.date.slice(0, 10) <= cleanTarget);
  return onOrBefore ? Number(onOrBefore.rateBdtPerRmb) : safeDefault;
}

/**
 * Calculates per-flight net profitability (Flight + Date) and RMB FX variance gain/loss.
 *
 * Cost allocation rules:
 * - Export RMB = packing reportAmount / debitAmount / rmbAmount / totalAmount.
 * - Booked BDT = exportRmb * bookedRate (packing.rmbRate or FX rate on packingDate).
 * - Settlement BDT = exportRmb * settlementRate (FX rate on paymentDate if settled, else latest active FX rate / defaultRate).
 * - FX Gain/Loss = settlementRevenueBdt - bookedRevenueBdt.
 * - Purchase cost: weighted average purchase cost per KG across procurement ledger (or same-date purchases when matched), multiplied by flight weight KG.
 * - Mortality loss: proportional share of mortality KG valued at average purchase cost per KG.
 * - Operating costs: direct refInvoice matches to any manifest on the flight, plus proportional weight share of same-date general cargo/ice/box expenses.
 */
export function calculateFlightProfitabilityAndFx(params: {
  packings: PackingRecord[];
  purchases: PurchaseRecord[];
  otherCosts: OtherCostRecord[];
  mortalities?: MortalityRecord[];
  fxHistory?: RmbFxRateLogEntry[];
  currentRmbRate?: number;
}): FlightProfitabilitySummary {
  const {
    packings = [],
    purchases = [],
    otherCosts = [],
    mortalities = [],
    fxHistory = [],
    currentRmbRate = 16.5,
  } = params;

  const safeCurrentRate = Number(currentRmbRate) > 0 ? Number(currentRmbRate) : 16.5;

  // Compute global weighted average purchase cost per KG
  const totalPurchaseKg = purchases.reduce((sum, p) => sum + (Number(p.totalQty) || 0), 0);
  const totalPurchaseTk = purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const avgPurchaseRatePerKg = totalPurchaseKg > 0 ? totalPurchaseTk / totalPurchaseKg : 0;

  // Compute total packed weight across all manifests for mortality pro-rata
  const totalPackedKgAll = packings.reduce((sum, pkg) => sum + (Number(pkg.totalWeight) || 0), 0);
  const totalMortalityKgAll = mortalities.reduce((sum, m) => sum + (Number(m.quantityKg) || 0), 0);
  const totalMortalityCostBdt = totalMortalityKgAll * avgPurchaseRatePerKg;

  // Map same-date purchases to compute date-specific avg purchase rate if available
  const purchaseByDate = new Map<string, { kg: number; tk: number }>();
  for (const p of purchases) {
    const d = (p.date || '').slice(0, 10);
    if (!d) continue;
    const prev = purchaseByDate.get(d) || { kg: 0, tk: 0 };
    prev.kg += Number(p.totalQty) || 0;
    prev.tk += Number(p.totalAmount) || 0;
    purchaseByDate.set(d, prev);
  }

  // Group packings by Date + Flight
  interface FlightGroupAcc {
    flightKey: string;
    date: string;
    flight: string;
    destination: string;
    shippingMarks: Set<string>;
    invoiceNumbers: Set<string>;
    manifestCount: number;
    totalBox: number;
    totalWeightKg: number;
    exportRmb: number;
    bookedRevenueBdt: number;
    settlementRevenueBdt: number;
  }

  const groupMap = new Map<string, FlightGroupAcc>();
  const weightByDate = new Map<string, number>();

  for (const pkg of packings) {
    if (!pkg) continue;
    const date = (pkg.packingDate || pkg.createdAt || '').slice(0, 10) || 'UNASSIGNED';
    const flight = (pkg.flight || 'UNASSIGNED FLIGHT').trim().toUpperCase();
    const flightKey = `${date}::${flight}`;

    const exportRmb =
      Number(pkg.reportAmount) > 0
        ? Number(pkg.reportAmount)
        : Number(pkg.debitAmount) > 0
        ? Number(pkg.debitAmount)
        : Number(pkg.rmbAmount) > 0
        ? Number(pkg.rmbAmount)
        : Number(pkg.totalAmount) || 0;

    const bookedRate =
      Number(pkg.rmbRate) > 0
        ? Number(pkg.rmbRate)
        : resolveHistoricalRmbRate(fxHistory, date, safeCurrentRate);

    const settlementDate = (pkg.paymentDate || '').slice(0, 10);
    const settlementRate = settlementDate
      ? resolveHistoricalRmbRate(fxHistory, settlementDate, safeCurrentRate)
      : safeCurrentRate;

    const bookedBdt =
      Number(pkg.totalAmountBDT) > 0 && Number(pkg.rmbRate) > 0
        ? Number(pkg.totalAmountBDT)
        : exportRmb * bookedRate;
    const settlementBdt = exportRmb * settlementRate;

    const weightKg = Number(pkg.totalWeight) || 0;
    weightByDate.set(date, (weightByDate.get(date) || 0) + weightKg);

    let acc = groupMap.get(flightKey);
    if (!acc) {
      acc = {
        flightKey,
        date,
        flight,
        destination: pkg.destination || '—',
        shippingMarks: new Set<string>(),
        invoiceNumbers: new Set<string>(),
        manifestCount: 0,
        totalBox: 0,
        totalWeightKg: 0,
        exportRmb: 0,
        bookedRevenueBdt: 0,
        settlementRevenueBdt: 0,
      };
      groupMap.set(flightKey, acc);
    }

    if (pkg.shippingMark) acc.shippingMarks.add(pkg.shippingMark.trim());
    if (pkg.invoiceNumber) acc.invoiceNumbers.add(pkg.invoiceNumber.trim().toUpperCase());
    if (acc.destination === '—' && pkg.destination) acc.destination = pkg.destination;
    acc.manifestCount += 1;
    acc.totalBox += Number(pkg.totalBox) || 0;
    acc.totalWeightKg += weightKg;
    acc.exportRmb += exportRmb;
    acc.bookedRevenueBdt += bookedBdt;
    acc.settlementRevenueBdt += settlementBdt;
  }

  // Direct vs general otherCosts allocation
  const generalCostByDate = new Map<string, number>();
  const directCostByInvoice = new Map<string, number>();

  for (const c of otherCosts) {
    if (!c) continue;
    const amt = Number(c.amount) || 0;
    if (amt <= 0) continue;
    const refInv = (c.refInvoice || '').trim().toUpperCase();
    if (refInv) {
      directCostByInvoice.set(refInv, (directCostByInvoice.get(refInv) || 0) + amt);
    } else {
      const d = (c.date || '').slice(0, 10);
      if (d) {
        generalCostByDate.set(d, (generalCostByDate.get(d) || 0) + amt);
      }
    }
  }

  const rows: FlightProfitabilityRow[] = Array.from(groupMap.values()).map((acc) => {
    const bookedRevenueBdt = round2(acc.bookedRevenueBdt);
    const settlementRevenueBdt = round2(acc.settlementRevenueBdt);
    const fxGainLossBdt = round2(settlementRevenueBdt - bookedRevenueBdt);
    const bookedRmbRate = acc.exportRmb > 0 ? round2(bookedRevenueBdt / acc.exportRmb) : safeCurrentRate;
    const settlementRmbRate =
      acc.exportRmb > 0 ? round2(settlementRevenueBdt / acc.exportRmb) : safeCurrentRate;

    // Purchase cost allocation (prefer same-date purchase rate, else global weighted average)
    const dayPur = purchaseByDate.get(acc.date);
    const unitPurchaseRate =
      dayPur && dayPur.kg > 0 ? dayPur.tk / dayPur.kg : avgPurchaseRatePerKg;
    const allocatedPurchaseCostBdt = round2(acc.totalWeightKg * unitPurchaseRate);

    // Mortality cost allocation proportional to flight weight share
    const weightShareAll = totalPackedKgAll > 0 ? acc.totalWeightKg / totalPackedKgAll : 0;
    const allocatedMortalityLossBdt = round2(totalMortalityCostBdt * weightShareAll);

    // Direct operating costs + proportional same-date general costs
    let directCost = 0;
    acc.invoiceNumbers.forEach((inv) => {
      directCost += directCostByInvoice.get(inv) || 0;
    });
    const dayWeightTotal = weightByDate.get(acc.date) || 0;
    const dayGeneralCost = generalCostByDate.get(acc.date) || 0;
    const sharedDayCost =
      dayWeightTotal > 0 ? dayGeneralCost * (acc.totalWeightKg / dayWeightTotal) : 0;
    const allocatedOperatingCostBdt = round2(directCost + sharedDayCost);

    const totalCostBdt = round2(
      allocatedPurchaseCostBdt + allocatedMortalityLossBdt + allocatedOperatingCostBdt
    );
    const netProfitBdt = round2(settlementRevenueBdt - totalCostBdt);
    const netMarginPercent =
      settlementRevenueBdt > 0 ? round2((netProfitBdt / settlementRevenueBdt) * 100) : 0;

    return {
      flightKey: acc.flightKey,
      date: acc.date,
      flight: acc.flight,
      destination: acc.destination,
      shippingMarks: Array.from(acc.shippingMarks),
      manifestCount: acc.manifestCount,
      totalBox: acc.totalBox,
      totalWeightKg: round2(acc.totalWeightKg),
      exportRmb: round2(acc.exportRmb),
      bookedRmbRate,
      settlementRmbRate,
      bookedRevenueBdt,
      settlementRevenueBdt,
      fxGainLossBdt,
      allocatedPurchaseCostBdt,
      allocatedMortalityLossBdt,
      allocatedOperatingCostBdt,
      totalCostBdt,
      netProfitBdt,
      netMarginPercent,
    };
  });

  rows.sort((a, b) => b.date.localeCompare(a.date) || b.netProfitBdt - a.netProfitBdt);

  const totalExportRmb = round2(rows.reduce((s, r) => s + r.exportRmb, 0));
  const totalBookedRevenueBdt = round2(rows.reduce((s, r) => s + r.bookedRevenueBdt, 0));
  const totalSettlementRevenueBdt = round2(rows.reduce((s, r) => s + r.settlementRevenueBdt, 0));
  const totalFxGainLossBdt = round2(rows.reduce((s, r) => s + r.fxGainLossBdt, 0));
  const totalCostBdt = round2(rows.reduce((s, r) => s + r.totalCostBdt, 0));
  const totalNetProfitBdt = round2(totalSettlementRevenueBdt - totalCostBdt);
  const overallMarginPercent =
    totalSettlementRevenueBdt > 0
      ? round2((totalNetProfitBdt / totalSettlementRevenueBdt) * 100)
      : 0;

  return {
    rows,
    totalFlights: rows.length,
    totalExportRmb,
    totalBookedRevenueBdt,
    totalSettlementRevenueBdt,
    totalFxGainLossBdt,
    totalCostBdt,
    totalNetProfitBdt,
    overallMarginPercent,
    profitableFlightsCount: rows.filter((r) => r.netProfitBdt >= 0).length,
    lossMakingFlightsCount: rows.filter((r) => r.netProfitBdt < 0).length,
  };
}
