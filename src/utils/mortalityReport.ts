import { MortalityRecord, PurchaseRecord } from '../types/index.ts';

export interface SpeciesMortalityBreakdown {
  species: string;
  totalLossKg: number;
  incidentCount: number;
  percentageOfTotal: number;
  estimatedRatePerKg: number;
  estimatedLossBDT: number;
}

export interface CauseMortalityBreakdown {
  cause: string;
  totalLossKg: number;
  incidentCount: number;
  percentageOfTotal: number;
}

export interface MonthlyMortalityReportData {
  targetMonth: string; // YYYY-MM (e.g., '2026-10')
  monthLabel: string; // e.g., 'October 2026'
  generatedAt: string;
  totalLossKg: number;
  totalIncidents: number;
  averageLossPerIncidentKg: number;
  primarySpecies: string;
  primaryCause: string;
  estimatedTotalLossBDT: number;
  speciesBreakdown: SpeciesMortalityBreakdown[];
  causeBreakdown: CauseMortalityBreakdown[];
  records: MortalityRecord[];
}

export function formatMonthLabel(yearMonth: string): string {
  if (!yearMonth || yearMonth.length < 7) return 'Current Month';
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return yearMonth;
  }
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function formatMortalityReportFilename(
  targetMonth: string,
  ext: 'pdf' | 'png' = 'pdf'
): string {
  const safeMonth = (targetMonth || new Date().toISOString().slice(0, 7)).replace(
    /[^0-9]/g,
    '_'
  );
  return `ZSB_AQUATICS_Mortality_Report_${safeMonth}.${ext}`;
}

/**
 * Builds an aggregated, printable monthly mortality report summary
 * for all mortality events recorded in the specified or current month (YYYY-MM).
 */
export function buildMonthlyMortalityReport(
  mortalities: MortalityRecord[],
  purchases: PurchaseRecord[] = [],
  targetMonthInput?: string
): MonthlyMortalityReportData {
  const targetMonth =
    targetMonthInput && /^\d{4}-\d{2}$/.test(targetMonthInput.trim())
      ? targetMonthInput.trim()
      : new Date().toISOString().slice(0, 7);

  const monthLabel = formatMonthLabel(targetMonth);

  // Filter records matching the target YYYY-MM
  const monthRecords = (mortalities || []).filter((m) => {
    if (!m.date) return false;
    return m.date.startsWith(targetMonth);
  });

  // Sort chronological
  const sortedRecords = [...monthRecords].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '')
  );

  // Calculate average purchase rates per species from purchases to estimate financial impact
  const speciesRateMap = new Map<string, { totalAmount: number; totalQty: number }>();
  for (const pur of purchases || []) {
    for (const item of pur.items || []) {
      const code = (item.item || '').trim().toUpperCase();
      if (!code) continue;
      const qty = Number(item.quantity) || 0;
      const amt = Number(item.totalAmount) || 0;
      if (qty > 0 && amt > 0) {
        const curr = speciesRateMap.get(code) || { totalAmount: 0, totalQty: 0 };
        curr.totalAmount += amt;
        curr.totalQty += qty;
        speciesRateMap.set(code, curr);
      }
    }
  }

  const getEstimatedRate = (species: string): number => {
    const data = speciesRateMap.get(species.toUpperCase());
    if (data && data.totalQty > 0) {
      return Math.round((data.totalAmount / data.totalQty) * 100) / 100;
    }
    // Default fallback estimation if no matching purchase line
    return 1000;
  };

  const totalLossKg = Math.round(
    sortedRecords.reduce((acc, r) => acc + (Number(r.quantityKg) || 0), 0) * 100
  ) / 100;

  const totalIncidents = sortedRecords.length;
  const averageLossPerIncidentKg =
    totalIncidents > 0 ? Math.round((totalLossKg / totalIncidents) * 100) / 100 : 0;

  // Aggregate by species
  const speciesMap = new Map<string, { lossKg: number; count: number }>();
  for (const r of sortedRecords) {
    const sp = (r.species || 'UNSPECIFIED').trim().toUpperCase();
    const curr = speciesMap.get(sp) || { lossKg: 0, count: 0 };
    curr.lossKg = Math.round((curr.lossKg + (Number(r.quantityKg) || 0)) * 100) / 100;
    curr.count += 1;
    speciesMap.set(sp, curr);
  }

  let estimatedTotalLossBDT = 0;
  const speciesBreakdown: SpeciesMortalityBreakdown[] = Array.from(speciesMap.entries())
    .map(([species, data]) => {
      const percentageOfTotal =
        totalLossKg > 0 ? Math.round((data.lossKg / totalLossKg) * 1000) / 10 : 0;
      const estimatedRatePerKg = getEstimatedRate(species);
      const estimatedLossBDT = Math.round(data.lossKg * estimatedRatePerKg);
      estimatedTotalLossBDT += estimatedLossBDT;
      return {
        species,
        totalLossKg: data.lossKg,
        incidentCount: data.count,
        percentageOfTotal,
        estimatedRatePerKg,
        estimatedLossBDT,
      };
    })
    .sort((a, b) => b.totalLossKg - a.totalLossKg);

  // Aggregate by cause
  const causeMap = new Map<string, { lossKg: number; count: number }>();
  for (const r of sortedRecords) {
    const cause = (r.cause || 'Unspecified Cause').trim();
    const curr = causeMap.get(cause) || { lossKg: 0, count: 0 };
    curr.lossKg = Math.round((curr.lossKg + (Number(r.quantityKg) || 0)) * 100) / 100;
    curr.count += 1;
    causeMap.set(cause, curr);
  }

  const causeBreakdown: CauseMortalityBreakdown[] = Array.from(causeMap.entries())
    .map(([cause, data]) => {
      const percentageOfTotal =
        totalLossKg > 0 ? Math.round((data.lossKg / totalLossKg) * 1000) / 10 : 0;
      return {
        cause,
        totalLossKg: data.lossKg,
        incidentCount: data.count,
        percentageOfTotal,
      };
    })
    .sort((a, b) => b.totalLossKg - a.totalLossKg);

  const primarySpecies = speciesBreakdown.length > 0 ? speciesBreakdown[0].species : 'None';
  const primaryCause = causeBreakdown.length > 0 ? causeBreakdown[0].cause : 'None';

  return {
    targetMonth,
    monthLabel,
    generatedAt: new Date().toISOString(),
    totalLossKg,
    totalIncidents,
    averageLossPerIncidentKg,
    primarySpecies,
    primaryCause,
    estimatedTotalLossBDT,
    speciesBreakdown,
    causeBreakdown,
    records: sortedRecords,
  };
}
