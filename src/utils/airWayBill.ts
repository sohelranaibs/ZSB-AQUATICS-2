import { PackingRecord } from '../types/index.ts';
import { calculatePackingTotals } from './calculations.ts';

export const DEFAULT_AIR_WAY_BILL_ROWS = 4;

export interface AirWayBillRow {
  id: string;
  packingId?: string;
  invoiceNumber?: string;
  shippingMark?: string;
  destination?: string;
  date: string;
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
  documentsHolder?: string;
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
  const normFromDate = (fromDate || '').trim().slice(0, 10);
  const normToDate = (toDate || '').trim().slice(0, 10);
  const normShipper = (shipper || 'ALL').trim().toLowerCase();
  const normDocumentsHolder = (documentsHolder || 'ALL').trim().toLowerCase();
  const normFlight = (flight || 'ALL').trim().toLowerCase();

  const matched = safePackings.filter((pkg) => {
    const pkgDate = (pkg.packingDate || '').trim();
    const pkgIsoDate = pkgDate.slice(0, 10);
    if (normMonth !== 'all' && normMonth !== '' && pkgDate.slice(0, 7).toLowerCase() !== normMonth) {
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
      const overrideHolder = overrides[pkg.id]?.documentsHolder;
      const effectiveHolder =
        overrideHolder !== undefined
          ? overrideHolder.trim()
          : (pkg.documentsHolder || '').trim() || (pkg.shipper || '').trim();
      if (effectiveHolder.toLowerCase() !== normDocumentsHolder) {
        return false;
      }
    }
    if (
      normFlight !== 'all' &&
      normFlight !== '' &&
      (pkg.flight || '').trim().toLowerCase() !== normFlight
    ) {
      return false;
    }
    return true;
  });

  // Sort chronologically by packingDate ascending for a clean monthly statement
  const sorted = [...matched].sort((a, b) =>
    (a.packingDate || '').localeCompare(b.packingDate || '')
  );

  return sorted.map((pkg) => {
    const itemTotals =
      Array.isArray(pkg.items) && pkg.items.length > 0
        ? calculatePackingTotals(pkg.items)
        : { totalBox: 0, totalWeight: 0, totalAmount: 0 };

    const totalBox = Number(pkg.totalBox) || itemTotals.totalBox || 0;
    const rowOverride = overrides[pkg.id] || {};

    const resolvedRmbPerBox =
      rowOverride.rmbPerBox !== undefined
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
    const { totalRmb, bdtAmount } = calculateAirWayBillRow(totalBox, rmbPerBox, rate);

    const pkgShipper = (pkg.shipper || '').trim();
    const pkgDocumentsHolder = (pkg.documentsHolder || '').trim();
    const resolvedDocumentsHolder =
      rowOverride.documentsHolder !== undefined
        ? rowOverride.documentsHolder.trim()
        : pkgDocumentsHolder || pkgShipper;

    return {
      id: pkg.id,
      packingId: pkg.id,
      invoiceNumber: pkg.invoiceNumber,
      shippingMark: pkg.shippingMark,
      destination: pkg.destination,
      date: (pkg.packingDate || '').trim(),
      shipper: pkgShipper,
      documentsHolder: resolvedDocumentsHolder,
      flight: (pkg.flight || '').trim(),
      totalBox,
      rmbPerBox,
      totalRmb,
      rate,
      rateSpecified: hasExplicitRate,
      bdtAmount,
      isDraft: pkg.id === 'draft-packing-manifest',
    };
  });
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
  const normFromDate = (fromDate || '').trim().slice(0, 10);
  const normToDate = (toDate || '').trim().slice(0, 10);
  const normShipper = (shipper || 'ALL').trim().toLowerCase();
  const normDocumentsHolder = (documentsHolder || 'ALL').trim().toLowerCase();
  const normFlight = (flight || 'ALL').trim().toLowerCase();

  const matchingCustomRows = customRows
    .filter((row) => {
      if (!isAirWayBillRowPopulated(row)) {
        return true;
      }
      const rDate = (row.date || '').trim();
      const rIsoDate = rDate.slice(0, 10);
      if (
        normMonth !== 'all' &&
        normMonth !== '' &&
        rDate !== '' &&
        rDate.slice(0, 7).toLowerCase() !== normMonth
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
      const rDocumentsHolder = (row.documentsHolder || '').trim().toLowerCase();
      if (
        normDocumentsHolder !== 'all' &&
        normDocumentsHolder !== '' &&
        rDocumentsHolder !== '' &&
        rDocumentsHolder !== normDocumentsHolder
      ) {
        return false;
      }
      const rFlight = (row.flight || '').trim().toLowerCase();
      if (normFlight !== 'all' && normFlight !== '' && rFlight !== '' && rFlight !== normFlight) {
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

  const normalizedDbRows = dbRows.map((row) => {
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

  const occupiedInitialSlots =
    normalizedDbRows.length +
    matchingCustomRows.filter(
      (r) => isAirWayBillRowPopulated(r) && r.id.startsWith('awb-row-')
    ).length;

  let remainingDefaultBlanks = Math.max(
    0,
    DEFAULT_AIR_WAY_BILL_ROWS - occupiedInitialSlots
  );

  const finalCustomRows = matchingCustomRows.filter((row) => {
    if (!isAirWayBillRowPopulated(row) && row.id.startsWith('awb-row-')) {
      if (remainingDefaultBlanks > 0) {
        remainingDefaultBlanks -= 1;
        return true;
      }
      return false;
    }
    return true;
  });

  return [...normalizedDbRows, ...finalCustomRows];
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
