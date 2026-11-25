import { PackingRecord } from '../types/index.ts';
import { calculatePackingTotals } from './calculations.ts';

export const DEFAULT_AIR_WAY_BILL_ROWS = 4;

export interface AirWayBillRow {
  id: string;
  packingId?: string;
  packingIds?: string[]; // All underlying PackingRecord IDs when merged by Date + Documents Holder/Shipper + Flight
  customRowIds?: string[]; // All underlying custom row IDs when merged by Date + Documents Holder/Shipper + Flight
  mergedCount?: number; // Number of entries combined into this summary row
  invoiceNumber?: string;
  shippingMark?: string;
  destination?: string;
  date: string;
  originalDate?: string;
  isDateOverridden?: boolean;
  shipper: string;
  documentsHolder?: string;
  flight: string;
  totalBox: number;
  rmbPerBox: number;
  totalRmb: number; // totalBox * rmbPerBox
  rate: number; // BDT exchange rate per RMB (supports negative, -0, +0, positive)
  rateSpecified?: boolean; // true when user explicitly entered a rate (including 0, -0, +0)
  bdtAmount: number; // totalRmb * rate
  isDraft?: boolean;
  isCustom?: boolean;
}

export interface AirWayBillRowOverride {
  date?: string;
  rmbPerBox?: number;
  rate?: number;
  rateSpecified?: boolean;
}

export interface AirWayBillFilterOptions {
  yearMonth?: string; // 'all' or 'YYYY-MM'
  fromDate?: string; // 'YYYY-MM-DD' inclusive lower bound
  toDate?: string; // 'YYYY-MM-DD' inclusive upper bound
  shipper?: string; // 'ALL' or specific shipper
  documentsHolder?: string; // 'ALL' or specific documents holder
  flight?: string; // 'ALL' or specific flight
  defaultRmbPerBox?: number;
  defaultRate?: number;
}

export interface AirWayBillTotals {
  totalBoxes: number;
  totalRmb: number;
  totalAmountBDT: number;
  populatedRowsCount: number;
}

export interface AirWayBillLookupOptions {
  months: string[];
  shippers: string[];
  documentsHolders: string[];
  flights: string[];
}

export function normalizeSignedZero(val: number): number {
  return Object.is(val, -0) || val === 0 ? 0 : val;
}

export function isValidSignedDecimalDraft(raw: string): boolean {
  return /^[+-]?(\d+\.?\d*|\.\d*)?$/.test(raw.trim());
}

export function parseSignedNumber(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? normalizeSignedZero(raw) : 0;
  }
  const trimmed = String(raw ?? '').trim().replace(/,/g, '');
  if (
    trimmed === '' ||
    trimmed === '+' ||
    trimmed === '-' ||
    trimmed === '.' ||
    trimmed === '+.' ||
    trimmed === '-.'
  ) {
    return 0;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? normalizeSignedZero(parsed) : 0;
}

function round2(val: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num * 100) / 100;
  return normalizeSignedZero(rounded);
}

/**
 * Normalizes a date value (YYYY-MM-DD, ISO timestamp, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, etc.)
 * into a canonical YYYY-MM-DD key so identical calendar dates always group together.
 */
export function normalizeAirWayBillDateKey(dateStr: string): string {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) return '';

  // ISO prefix or YYYY-MM-DD / YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|T|\s)/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (matches displayed DD/MM/YYYY format)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback for other valid date strings (e.g. "01-Oct-2026")
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return trimmed.toUpperCase();
}

/**
 * Validates whether a raw date string is a complete YYYY-MM-DD calendar date
 * with a realistic 4-digit year (1900-2100) so partial keyboard typing never
 * triggers premature row re-sorting or regrouping.
 */
export function isCompleteIsoDateInput(raw: string): boolean {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Normalizes text identifiers (Documents Holder/Shipper, Flight Number) by trimming,
 * collapsing internal whitespace, and uppercasing.
 */
export function normalizeAirWayBillTextKey(val: string): string {
  return (val || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Builds the composite grouping key for (Date, DOCUMENTS HOLDER/SHIPPER, Flight Number).
 * Returns null if any of the three grouping fields is empty so incomplete/draft rows stay separate.
 */
export function buildAirWayBillGroupKey(
  dateStr: string,
  holderOrShipper: string,
  flightStr: string
): string | null {
  const normDate = normalizeAirWayBillDateKey(dateStr);
  const normHolder = normalizeAirWayBillTextKey(holderOrShipper);
  const normFlight = normalizeAirWayBillTextKey(flightStr);
  if (!normDate || !normHolder || !normFlight) return null;
  return `${normDate}|${normHolder}|${normFlight}`;
}

/**
 * Aggregates AirWayBillRow entries by unique (Date, DOCUMENTS HOLDER/SHIPPER, Flight Number),
 * summing totalBox quantities and recalculating TOTAL RMB and BDT AMOUNT into a single summary row.
 */
export function aggregateAirWayBillRows(rows: AirWayBillRow[]): AirWayBillRow[] {
  const aggregatedOrder: AirWayBillRow[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const effectiveHolder = (row.documentsHolder || '').trim() || (row.shipper || '').trim();
    const groupKey = buildAirWayBillGroupKey(row.date, effectiveHolder, row.flight);

    const rowPackingIds =
      Array.isArray(row.packingIds) && row.packingIds.length > 0
        ? row.packingIds
        : row.packingId
        ? [row.packingId]
        : [];
    const rowCustomIds =
      Array.isArray(row.customRowIds) && row.customRowIds.length > 0
        ? row.customRowIds
        : row.isCustom || !row.packingId
        ? [row.id]
        : [];

    if (groupKey && indexByKey.has(groupKey)) {
      const existingIdx = indexByKey.get(groupKey)!;
      const existing = aggregatedOrder[existingIdx];

      const mergedPackingIds = Array.from(
        new Set([...(existing.packingIds || (existing.packingId ? [existing.packingId] : [])), ...rowPackingIds])
      );
      const mergedCustomIds = Array.from(
        new Set([
          ...(existing.customRowIds || (existing.isCustom || !existing.packingId ? [existing.id] : [])),
          ...rowCustomIds,
        ])
      );

      const nextTotalBox = round2(parseSignedNumber(existing.totalBox) + parseSignedNumber(row.totalBox));
      const nextRmbPerBox =
        parseSignedNumber(existing.rmbPerBox) !== 0
          ? parseSignedNumber(existing.rmbPerBox)
          : parseSignedNumber(row.rmbPerBox);

      const existingRateSpecified = Boolean(existing.rateSpecified) || parseSignedNumber(existing.rate) !== 0;
      const rowRateSpecified = Boolean(row.rateSpecified) || parseSignedNumber(row.rate) !== 0;
      const nextRate = existingRateSpecified
        ? parseSignedNumber(existing.rate)
        : rowRateSpecified
        ? parseSignedNumber(row.rate)
        : 0;
      const nextRateSpecified = existingRateSpecified || rowRateSpecified;

      const computed = calculateAirWayBillRow(nextTotalBox, nextRmbPerBox, nextRate);
      const mergedPackingId = existing.packingId || row.packingId;

      aggregatedOrder[existingIdx] = {
        ...existing,
        packingId: mergedPackingId,
        packingIds: mergedPackingIds.length > 0 ? mergedPackingIds : undefined,
        customRowIds: mergedCustomIds.length > 0 ? mergedCustomIds : undefined,
        isCustom: !mergedPackingId,
        mergedCount: (existing.mergedCount || 1) + (row.mergedCount || 1),
        documentsHolder: (existing.documentsHolder || '').trim() || effectiveHolder,
        shipper: (existing.shipper || '').trim() || (row.shipper || '').trim(),
        totalBox: nextTotalBox,
        rmbPerBox: round2(nextRmbPerBox),
        totalRmb: computed.totalRmb,
        rate: round2(nextRate),
        rateSpecified: nextRateSpecified,
        bdtAmount: computed.bdtAmount,
        isDraft: Boolean(existing.isDraft || row.isDraft),
      };
    } else {
      const computed = calculateAirWayBillRow(row.totalBox, row.rmbPerBox, row.rate);
      const normalizedRow: AirWayBillRow = {
        ...row,
        packingIds: rowPackingIds.length > 0 ? rowPackingIds : undefined,
        customRowIds: rowCustomIds.length > 0 ? rowCustomIds : undefined,
        mergedCount: row.mergedCount || 1,
        totalRmb: computed.totalRmb,
        bdtAmount: computed.bdtAmount,
      };
      const nextIdx = aggregatedOrder.length;
      aggregatedOrder.push(normalizedRow);
      if (groupKey) {
        indexByKey.set(groupKey, nextIdx);
      }
    }
  }

  return aggregatedOrder;
}

/**
 * Calculates Air Way Bill Row values:
 * TOTAL RMB = TOTAL BOX * RMB/PER BOX
 * BDT AMOUNT = TOTAL RMB * RATE
 * Supports positive, negative, -0, and +0 values seamlessly.
 */
export function calculateAirWayBillRow(
  totalBox: number,
  rmbPerBox: number,
  rate: number
): { totalRmb: number; bdtAmount: number } {
  const boxes = parseSignedNumber(totalBox);
  const rmbBox = parseSignedNumber(rmbPerBox);
  const exRate = parseSignedNumber(rate);

  const totalRmb = round2(boxes * rmbBox);
  const bdtAmount = round2(totalRmb * exRate);

  return {
    totalRmb,
    bdtAmount,
  };
}

/**
 * Extracts unique months (YYYY-MM), shippers, and flights from Packing List Manifest records
 */
export function extractAirWayBillFilterOptions(
  packings: PackingRecord[]
): AirWayBillLookupOptions {
  const safePackings = Array.isArray(packings) ? packings : [];
  const monthSet = new Set<string>();
  const shipperSet = new Set<string>();
  const documentsHolderSet = new Set<string>();
  const flightSet = new Set<string>();

  for (const pkg of safePackings) {
    const rawDate = (pkg.packingDate || '').trim();
    if (/^\d{4}-\d{2}/.test(rawDate)) {
      monthSet.add(rawDate.slice(0, 7));
    }
    const rawShipper = (pkg.shipper || '').trim();
    if (rawShipper) {
      shipperSet.add(rawShipper);
    }
    const rawDocumentsHolder = (pkg.documentsHolder || '').trim();
    if (rawDocumentsHolder) {
      documentsHolderSet.add(rawDocumentsHolder);
    }
    const rawFlight = (pkg.flight || '').trim();
    if (rawFlight) {
      flightSet.add(rawFlight);
    }
  }

  return {
    months: Array.from(monthSet).sort((a, b) => b.localeCompare(a)),
    shippers: Array.from(shipperSet).sort((a, b) => a.localeCompare(b)),
    documentsHolders: Array.from(documentsHolderSet).sort((a, b) => a.localeCompare(b)),
    flights: Array.from(flightSet).sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Builds Air Way Bill Monthly Statement rows directly from PACKING LIST DATA ENTRY FORM
 * (AIR FREIGHT EXPORT MANIFEST) records.
 * Editable RMB/PER BOX and RATE are resolved from row overrides or saved PackingRecord fields.
 */
export function buildAirWayBillRows(
  packings: PackingRecord[],
  overrides: Record<string, AirWayBillRowOverride> = {},
  filters: AirWayBillFilterOptions = {}
): AirWayBillRow[] {
  const {
    yearMonth = 'all',
    fromDate = '',
    toDate = '',
    shipper = 'ALL',
    documentsHolder = 'ALL',
    flight = 'ALL',
    defaultRmbPerBox = 0,
    defaultRate = 0,
  } = filters;

  const safePackings = Array.isArray(packings) ? packings : [];
  const normMonth = (yearMonth || 'all').trim().toLowerCase();
  const normFromDate = normalizeAirWayBillDateKey(fromDate || '');
  const normToDate = normalizeAirWayBillDateKey(toDate || '');
  const normShipper = (shipper || 'ALL').trim().toLowerCase();
  const normDocumentsHolder = (documentsHolder || 'ALL').trim().toLowerCase();
  const normFlight = (flight || 'ALL').trim().toLowerCase();

  const resolveEffectiveDate = (pkg: PackingRecord): string => {
    const rawOverrideDate = (overrides[pkg.id]?.date || '').trim();
    if (rawOverrideDate) {
      return normalizeAirWayBillDateKey(rawOverrideDate);
    }
    return (pkg.packingDate || '').trim();
  };

  const matched = safePackings.filter((pkg) => {
    const effectiveDate = resolveEffectiveDate(pkg);
    const pkgIsoDate = normalizeAirWayBillDateKey(effectiveDate);
    if (normMonth !== 'all' && normMonth !== '' && pkgIsoDate.slice(0, 7).toLowerCase() !== normMonth) {
      return false;
    }
    if (normFromDate && (!pkgIsoDate || pkgIsoDate < normFromDate)) {
      return false;
    }
    if (normToDate && (!pkgIsoDate || pkgIsoDate > normToDate)) {
      return false;
    }
    if (
      normShipper !== 'all' &&
      normShipper !== '' &&
      (pkg.shipper || '').trim().toLowerCase() !== normShipper
    ) {
      return false;
    }
    if (
      normDocumentsHolder !== 'all' &&
      normDocumentsHolder !== ''
    ) {
      // Strictly locked to Packing List documentsHolder / shipper (no sheet-level holder overrides)
      const effectiveHolder =
        (pkg.documentsHolder || '').trim() || (pkg.shipper || '').trim();
      if (effectiveHolder.toLowerCase() !== normDocumentsHolder) {
        return false;
      }
    }
    if (
      normFlight !== 'all' &&
      normFlight !== '' &&
      normalizeAirWayBillTextKey(pkg.flight || '').toLowerCase() !== normalizeAirWayBillTextKey(normFlight).toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  // Sort chronologically by effective statement date ascending for a clean monthly statement
  const sorted = [...matched].sort((a, b) =>
    normalizeAirWayBillDateKey(resolveEffectiveDate(a)).localeCompare(
      normalizeAirWayBillDateKey(resolveEffectiveDate(b))
    )
  );

  interface PendingGroup {
    row: AirWayBillRow;
    packingIds: string[];
    hasOverrideRmb: boolean;
    hasOverrideRate: boolean;
  }

  const groupedOrder: PendingGroup[] = [];
  const groupByKey = new Map<string, PendingGroup>();

  for (const pkg of sorted) {
    const itemTotals =
      Array.isArray(pkg.items) && pkg.items.length > 0
        ? calculatePackingTotals(pkg.items)
        : { totalBox: 0, totalWeight: 0, totalAmount: 0 };

    const totalBox = Number(pkg.totalBox) || itemTotals.totalBox || 0;
    const rowOverride = overrides[pkg.id] || {};
    const hasOverrideRmb = rowOverride.rmbPerBox !== undefined;
    const hasOverrideRate =
      rowOverride.rate !== undefined || rowOverride.rateSpecified !== undefined;

    const resolvedRmbPerBox = hasOverrideRmb
      ? parseSignedNumber(rowOverride.rmbPerBox)
      : pkg.awbRmbPerBox !== undefined
      ? parseSignedNumber(pkg.awbRmbPerBox)
      : parseSignedNumber(defaultRmbPerBox);

    const hasExplicitRate =
      rowOverride.rateSpecified !== undefined
        ? rowOverride.rateSpecified
        : rowOverride.rate !== undefined ||
          pkg.awbRate !== undefined ||
          (pkg.rmbRate !== undefined && pkg.rmbRate !== null && parseSignedNumber(pkg.rmbRate) !== 0) ||
          parseSignedNumber(defaultRate) !== 0;

    const resolvedRate =
      rowOverride.rate !== undefined
        ? parseSignedNumber(rowOverride.rate)
        : pkg.awbRate !== undefined
        ? parseSignedNumber(pkg.awbRate)
        : pkg.rmbRate !== undefined && pkg.rmbRate !== null && parseSignedNumber(pkg.rmbRate) !== 0
        ? parseSignedNumber(pkg.rmbRate)
        : parseSignedNumber(defaultRate);

    const rmbPerBox = round2(resolvedRmbPerBox);
    const rate = round2(resolvedRate);
    const originalPkgDate = (pkg.packingDate || '').trim();
    const overrideDate = (rowOverride.date || '').trim();
    const effectivePkgDate = overrideDate
      ? normalizeAirWayBillDateKey(overrideDate)
      : originalPkgDate;
    const isDateOverridden =
      Boolean(overrideDate) &&
      normalizeAirWayBillDateKey(overrideDate) !== normalizeAirWayBillDateKey(originalPkgDate);
    const pkgShipper = (pkg.shipper || '').trim();
    const pkgDocumentsHolder = (pkg.documentsHolder || '').trim();
    // Locked strictly to PACKING LIST (never altered from Flight Return Bill)
    const resolvedDocumentsHolder = pkgDocumentsHolder || pkgShipper;
    const pkgFlight = (pkg.flight || '').trim();

    const groupKey = buildAirWayBillGroupKey(effectivePkgDate, resolvedDocumentsHolder || pkgShipper, pkgFlight);
    const existingGroup = groupKey ? groupByKey.get(groupKey) : undefined;

    if (existingGroup) {
      existingGroup.packingIds.push(pkg.id);
      const nextTotalBox = round2(existingGroup.row.totalBox + totalBox);

      // Prefer explicit user overrides, otherwise keep the first non-zero/specified value in the group
      let nextRmbPerBox = existingGroup.row.rmbPerBox;
      if (!existingGroup.hasOverrideRmb) {
        if (hasOverrideRmb) {
          nextRmbPerBox = rmbPerBox;
          existingGroup.hasOverrideRmb = true;
        } else if (nextRmbPerBox === 0 && rmbPerBox !== 0) {
          nextRmbPerBox = rmbPerBox;
        }
      }

      let nextRate = existingGroup.row.rate;
      let nextRateSpecified = Boolean(existingGroup.row.rateSpecified);
      if (!existingGroup.hasOverrideRate) {
        if (hasOverrideRate) {
          nextRate = rate;
          nextRateSpecified = hasExplicitRate;
          existingGroup.hasOverrideRate = true;
        } else if (!nextRateSpecified && hasExplicitRate) {
          nextRate = rate;
          nextRateSpecified = true;
        } else if (nextRate === 0 && rate !== 0) {
          nextRate = rate;
          nextRateSpecified = hasExplicitRate;
        }
      }

      const computed = calculateAirWayBillRow(nextTotalBox, nextRmbPerBox, nextRate);
      existingGroup.row = {
        ...existingGroup.row,
        packingIds: [...existingGroup.packingIds],
        mergedCount: existingGroup.packingIds.length,
        isDateOverridden: Boolean(existingGroup.row.isDateOverridden || isDateOverridden),
        totalBox: nextTotalBox,
        rmbPerBox: nextRmbPerBox,
        totalRmb: computed.totalRmb,
        rate: nextRate,
        rateSpecified: nextRateSpecified,
        bdtAmount: computed.bdtAmount,
        isDraft: existingGroup.row.isDraft || pkg.id === 'draft-packing-manifest',
      };
    } else {
      const { totalRmb, bdtAmount } = calculateAirWayBillRow(totalBox, rmbPerBox, rate);
      const newGroup: PendingGroup = {
        packingIds: [pkg.id],
        hasOverrideRmb,
        hasOverrideRate,
        row: {
          id: pkg.id,
          packingId: pkg.id,
          packingIds: [pkg.id],
          mergedCount: 1,
          invoiceNumber: pkg.invoiceNumber,
          shippingMark: pkg.shippingMark,
          destination: pkg.destination,
          date: effectivePkgDate,
          originalDate: originalPkgDate,
          isDateOverridden,
          shipper: pkgShipper,
          documentsHolder: resolvedDocumentsHolder,
          flight: pkgFlight,
          totalBox,
          rmbPerBox,
          totalRmb,
          rate,
          rateSpecified: hasExplicitRate,
          bdtAmount,
          isDraft: pkg.id === 'draft-packing-manifest',
        },
      };
      groupedOrder.push(newGroup);
      if (groupKey) {
        groupByKey.set(groupKey, newGroup);
      }
    }
  }

  return groupedOrder.map((g) => g.row);
}

/**
 * Creates a blank/custom row for the Air Way Bill sheet
 */
export function createEmptyAirWayBillRow(
  id: string,
  defaults: Partial<AirWayBillRow> = {}
): AirWayBillRow {
  const totalBox = parseSignedNumber(defaults.totalBox);
  const rmbPerBox = parseSignedNumber(defaults.rmbPerBox);
  const rate = parseSignedNumber(defaults.rate);
  const rateSpecified =
    defaults.rateSpecified !== undefined ? defaults.rateSpecified : defaults.rate !== undefined;
  const { totalRmb, bdtAmount } = calculateAirWayBillRow(totalBox, rmbPerBox, rate);

  return {
    id,
    isCustom: true,
    date: defaults.date ?? '',
    shipper: defaults.shipper ?? '',
    documentsHolder: defaults.documentsHolder ?? '',
    flight: defaults.flight ?? '',
    totalBox,
    rmbPerBox,
    totalRmb,
    rate,
    rateSpecified,
    bdtAmount,
  };
}

/**
 * Creates the default initial 4 blank rows for the Air Way Bill table
 */
export function createInitialAirWayBillRows(
  count: number = DEFAULT_AIR_WAY_BILL_ROWS
): AirWayBillRow[] {
  return Array.from({ length: count }, (_, idx) =>
    createEmptyAirWayBillRow(`awb-row-${idx + 1}`)
  );
}

/**
 * Checks if an Air Way Bill row has any user-entered or DB-synced values
 */
export function isAirWayBillRowPopulated(
  row: AirWayBillRow | null | undefined
): boolean {
  if (!row) return false;
  if (row.packingId) return true;
  return (
    (row.date || '').trim() !== '' ||
    (row.shipper || '').trim() !== '' ||
    (row.documentsHolder || '').trim() !== '' ||
    (row.flight || '').trim() !== '' ||
    parseSignedNumber(row.totalBox) !== 0 ||
    parseSignedNumber(row.rmbPerBox) !== 0 ||
    parseSignedNumber(row.totalRmb) !== 0 ||
    parseSignedNumber(row.rate) !== 0 ||
    Boolean(row.rateSpecified) ||
    parseSignedNumber(row.bdtAmount) !== 0
  );
}

/**
 * Merges auto-synced Packing List rows with custom/blank rows so the Air Way Bill table
 * always displays at least 4 rows (matching the reference Excel layout) and recalculates
 * TOTAL RMB and BDT AMOUNT on every row.
 */
export function mergeAirWayBillRows(
  dbRows: AirWayBillRow[],
  customRows: AirWayBillRow[],
  filters: AirWayBillFilterOptions = {}
): AirWayBillRow[] {
  const {
    yearMonth = 'all',
    fromDate = '',
    toDate = '',
    shipper = 'ALL',
    documentsHolder = 'ALL',
    flight = 'ALL',
  } = filters;
  const normMonth = (yearMonth || 'all').trim().toLowerCase();
  const normFromDate = normalizeAirWayBillDateKey(fromDate || '');
  const normToDate = normalizeAirWayBillDateKey(toDate || '');
  const normShipper = (shipper || 'ALL').trim().toLowerCase();
  const normDocumentsHolder = (documentsHolder || 'ALL').trim().toLowerCase();
  const normFlight = (flight || 'ALL').trim().toLowerCase();

  const matchingCustomRows = customRows
    .filter((row) => {
      if (!isAirWayBillRowPopulated(row)) {
        return true;
      }
      const rDate = (row.date || '').trim();
      const rIsoDate = normalizeAirWayBillDateKey(rDate);
      if (
        normMonth !== 'all' &&
        normMonth !== '' &&
        rIsoDate !== '' &&
        rIsoDate.slice(0, 7).toLowerCase() !== normMonth
      ) {
        return false;
      }
      if (normFromDate && rIsoDate !== '' && rIsoDate < normFromDate) {
        return false;
      }
      if (normToDate && rIsoDate !== '' && rIsoDate > normToDate) {
        return false;
      }
      const rShipper = (row.shipper || '').trim().toLowerCase();
      if (normShipper !== 'all' && normShipper !== '' && rShipper !== '' && rShipper !== normShipper) {
        return false;
      }
      const rDocumentsHolder = ((row.documentsHolder || '').trim() || (row.shipper || '').trim()).toLowerCase();
      if (
        normDocumentsHolder !== 'all' &&
        normDocumentsHolder !== '' &&
        rDocumentsHolder !== '' &&
        rDocumentsHolder !== normDocumentsHolder
      ) {
        return false;
      }
      const rFlight = normalizeAirWayBillTextKey(row.flight || '').toLowerCase();
      if (
        normFlight !== 'all' &&
        normFlight !== '' &&
        rFlight !== '' &&
        rFlight !== normalizeAirWayBillTextKey(normFlight).toLowerCase()
      ) {
        return false;
      }
      return true;
    })
    .map((row) => {
      const { totalRmb, bdtAmount } = calculateAirWayBillRow(
        row.totalBox,
        row.rmbPerBox,
        row.rate
      );
      return {
        ...row,
        totalRmb,
        bdtAmount,
      };
    });

  const populatedCustomRows = matchingCustomRows.filter((r) => isAirWayBillRowPopulated(r));
  const blankCustomRows = matchingCustomRows.filter((r) => !isAirWayBillRowPopulated(r));

  // Aggregate ALL populated rows (both DB-synced Packing Lists and populated manual rows)
  // so every unique (Date, DOCUMENTS HOLDER/SHIPPER, Flight Number) renders as a single summary row.
  const aggregatedPopulatedRows = aggregateAirWayBillRows([
    ...dbRows,
    ...populatedCustomRows,
  ]);

  let remainingDefaultBlanks = Math.max(
    0,
    DEFAULT_AIR_WAY_BILL_ROWS - aggregatedPopulatedRows.length
  );

  const finalBlankRows = blankCustomRows.filter((row) => {
    if (row.id.startsWith('awb-row-')) {
      if (remainingDefaultBlanks > 0) {
        remainingDefaultBlanks -= 1;
        return true;
      }
      return false;
    }
    return true;
  });

  return [...aggregatedPopulatedRows, ...finalBlankRows];
}

/**
 * Calculates Grand Totals for the Air Way Bill Monthly Statement:
 * TOTAL BOX, TOTAL RMB, and TOTAL AMOUNT (BDT)
 */
export function calculateAirWayBillTotals(rows: AirWayBillRow[]): AirWayBillTotals {
  let totalBoxes = 0;
  let totalRmb = 0;
  let totalAmountBDT = 0;
  let populatedRowsCount = 0;

  for (const row of rows) {
    if (isAirWayBillRowPopulated(row)) {
      populatedRowsCount += 1;
    }
    const boxes = Number(row.totalBox) || 0;
    const rmbPerBox = Number(row.rmbPerBox) || 0;
    const rate = Number(row.rate) || 0;
    const computed = calculateAirWayBillRow(boxes, rmbPerBox, rate);

    totalBoxes += boxes;
    totalRmb += computed.totalRmb;
    totalAmountBDT += computed.bdtAmount;
  }

  return {
    totalBoxes,
    totalRmb: round2(totalRmb),
    totalAmountBDT: round2(totalAmountBDT),
    populatedRowsCount,
  };
}

/**
 * Formats a clean export filename for the Air Way Bill Monthly Statement (.pdf or .png)
 */
export function formatAirWayBillExportFilename(
  yearMonth: string = 'all',
  shipper: string = 'ALL',
  extension: 'pdf' | 'png' = 'pdf',
  referenceDateStr?: string,
  fromDate?: string,
  toDate?: string
): string {
  const cleanFrom = (fromDate || '').trim().replace(/[^0-9-]/g, '');
  const cleanTo = (toDate || '').trim().replace(/[^0-9-]/g, '');
  const cleanPeriod =
    cleanFrom || cleanTo
      ? `${cleanFrom || 'START'}_to_${cleanTo || 'END'}`
      : yearMonth && yearMonth !== 'all'
      ? yearMonth.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
      : referenceDateStr ?? new Date().toISOString().slice(0, 7);
  const cleanShipper =
    shipper && shipper !== 'ALL'
      ? shipper.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'ALL_SHIPPERS';
  const ext = extension.toLowerCase() === 'png' ? 'png' : 'pdf';
  return `ZSB_AQUATICS_Flight_Return_Bill_${cleanPeriod}_${cleanShipper}.${ext}`;
}

export interface AirWayBillSelectionSummary {
  selectableRowIds: string[];
  selectedRowIds: string[];
  selectedRows: AirWayBillRow[];
  hasSelection: boolean;
  allSelected: boolean;
  isIndeterminate: boolean;
  invoiceRows: AirWayBillRow[];
  invoiceTotals: AirWayBillTotals;
}

/**
 * Toggles a single Flight Return Bill row ID in the active selection list.
 */
export function toggleAirWayBillRowSelection(
  currentSelectedIds: readonly string[],
  rowId: string
): string[] {
  if (!rowId) return [...currentSelectedIds];
  if (currentSelectedIds.includes(rowId)) {
    return currentSelectedIds.filter((id) => id !== rowId);
  }
  return [...currentSelectedIds, rowId];
}

/**
 * Toggles selection of all currently selectable (populated) Flight Return Bill rows.
 * If every selectable row is already selected, clears selection; otherwise selects all selectable rows.
 */
export function toggleAllAirWayBillRowsSelection(
  currentSelectedIds: readonly string[],
  selectableRowIds: readonly string[]
): string[] {
  if (selectableRowIds.length === 0) return [];
  const selectedSet = new Set(currentSelectedIds);
  const allCurrentlySelected = selectableRowIds.every((id) => selectedSet.has(id));
  if (allCurrentlySelected) {
    return [];
  }
  return [...selectableRowIds];
}

/**
 * Resolves active Flight Return Bill row selection against visible rows.
 * - Blank padding rows are never selectable.
 * - Stale IDs (e.g., filtered out or merged into another row) are ignored automatically.
 * - When 1+ rows are selected, invoiceRows/invoiceTotals contain ONLY the selected rows
 *   so individual or multi-row bill invoices can be printed or exported cleanly.
 * - When no rows are selected, invoiceRows/invoiceTotals reflect the full visible statement.
 */
export function resolveAirWayBillSelection(
  displayRows: readonly AirWayBillRow[],
  selectedIds: readonly string[]
): AirWayBillSelectionSummary {
  const selectableRows = displayRows.filter((row) => isAirWayBillRowPopulated(row));
  const selectableRowIds = selectableRows.map((row) => row.id);
  const requestedSet = new Set(selectedIds);

  const selectedRows = selectableRows.filter((row) => requestedSet.has(row.id));
  const selectedRowIds = selectedRows.map((row) => row.id);

  const hasSelection = selectedRows.length > 0;
  const allSelected =
    selectableRows.length > 0 && selectedRows.length === selectableRows.length;
  const isIndeterminate = hasSelection && !allSelected;

  const invoiceRows = hasSelection ? selectedRows : [...displayRows];
  const invoiceTotals = calculateAirWayBillTotals(invoiceRows);

  return {
    selectableRowIds,
    selectedRowIds,
    selectedRows,
    hasSelection,
    allSelected,
    isIndeterminate,
    invoiceRows,
    invoiceTotals,
  };
}

