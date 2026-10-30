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
  flight: string;
  totalBox: number;
  rmbPerBox: number;
  totalRmb: number; // totalBox * rmbPerBox
  rate: number; // BDT exchange rate per RMB
  bdtAmount: number; // totalRmb * rate
  isDraft?: boolean;
  isCustom?: boolean;
}

export interface AirWayBillRowOverride {
  rmbPerBox?: number;
  rate?: number;
}

export interface AirWayBillFilterOptions {
  yearMonth?: string; // 'all' or 'YYYY-MM'
  shipper?: string; // 'ALL' or specific shipper
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
  flights: string[];
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Calculates Air Way Bill Row values:
 * TOTAL RMB = TOTAL BOX * RMB/PER BOX
 * BDT AMOUNT = TOTAL RMB * RATE
 */
export function calculateAirWayBillRow(
  totalBox: number,
  rmbPerBox: number,
  rate: number
): { totalRmb: number; bdtAmount: number } {
  const boxes = Number(totalBox) || 0;
  const rmbBox = Number(rmbPerBox) || 0;
  const exRate = Number(rate) || 0;

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
    const rawFlight = (pkg.flight || '').trim();
    if (rawFlight) {
      flightSet.add(rawFlight);
    }
  }

  return {
    months: Array.from(monthSet).sort((a, b) => b.localeCompare(a)),
    shippers: Array.from(shipperSet).sort((a, b) => a.localeCompare(b)),
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
    shipper = 'ALL',
    flight = 'ALL',
    defaultRmbPerBox = 0,
    defaultRate = 0,
  } = filters;

  const safePackings = Array.isArray(packings) ? packings : [];
  const normMonth = (yearMonth || 'all').trim().toLowerCase();
  const normShipper = (shipper || 'ALL').trim().toLowerCase();
  const normFlight = (flight || 'ALL').trim().toLowerCase();

  const matched = safePackings.filter((pkg) => {
    const pkgDate = (pkg.packingDate || '').trim();
    if (normMonth !== 'all' && normMonth !== '' && pkgDate.slice(0, 7).toLowerCase() !== normMonth) {
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
        ? Number(rowOverride.rmbPerBox) || 0
        : pkg.awbRmbPerBox !== undefined
        ? Number(pkg.awbRmbPerBox) || 0
        : Number(defaultRmbPerBox) || 0;

    const resolvedRate =
      rowOverride.rate !== undefined
        ? Number(rowOverride.rate) || 0
        : pkg.awbRate !== undefined
        ? Number(pkg.awbRate) || 0
        : Number(pkg.rmbRate) > 0
        ? Number(pkg.rmbRate)
        : Number(defaultRate) || 0;

    const rmbPerBox = round2(resolvedRmbPerBox);
    const rate = round2(resolvedRate);
    const { totalRmb, bdtAmount } = calculateAirWayBillRow(totalBox, rmbPerBox, rate);

    return {
      id: pkg.id,
      packingId: pkg.id,
      invoiceNumber: pkg.invoiceNumber,
      shippingMark: pkg.shippingMark,
      destination: pkg.destination,
      date: (pkg.packingDate || '').trim(),
      shipper: (pkg.shipper || '').trim(),
      flight: (pkg.flight || '').trim(),
      totalBox,
      rmbPerBox,
      totalRmb,
      rate,
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
  const totalBox = Number(defaults.totalBox) || 0;
  const rmbPerBox = Number(defaults.rmbPerBox) || 0;
  const rate = Number(defaults.rate) || 0;
  const { totalRmb, bdtAmount } = calculateAirWayBillRow(totalBox, rmbPerBox, rate);

  return {
    id,
    isCustom: true,
    date: defaults.date ?? '',
    shipper: defaults.shipper ?? '',
    flight: defaults.flight ?? '',
    totalBox,
    rmbPerBox,
    totalRmb,
    rate,
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
    (row.flight || '').trim() !== '' ||
    (Number(row.totalBox) || 0) > 0 ||
    (Number(row.rmbPerBox) || 0) > 0 ||
    (Number(row.totalRmb) || 0) > 0 ||
    (Number(row.rate) || 0) > 0 ||
    (Number(row.bdtAmount) || 0) > 0
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
  const { yearMonth = 'all', shipper = 'ALL', flight = 'ALL' } = filters;
  const normMonth = (yearMonth || 'all').trim().toLowerCase();
  const normShipper = (shipper || 'ALL').trim().toLowerCase();
  const normFlight = (flight || 'ALL').trim().toLowerCase();

  const matchingCustomRows = customRows
    .filter((row) => {
      if (!isAirWayBillRowPopulated(row)) {
        return true;
      }
      const rDate = (row.date || '').trim().toLowerCase();
      if (normMonth !== 'all' && normMonth !== '' && rDate !== '' && rDate.slice(0, 7) !== normMonth) {
        return false;
      }
      const rShipper = (row.shipper || '').trim().toLowerCase();
      if (normShipper !== 'all' && normShipper !== '' && rShipper !== '' && rShipper !== normShipper) {
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
  referenceDateStr?: string
): string {
  const cleanMonth =
    yearMonth && yearMonth !== 'all'
      ? yearMonth.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
      : referenceDateStr ?? new Date().toISOString().slice(0, 7);
  const cleanShipper =
    shipper && shipper !== 'ALL'
      ? shipper.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'ALL_SHIPPERS';
  const ext = extension.toLowerCase() === 'png' ? 'png' : 'pdf';
  return `ZSB_AQUATICS_Air_Way_Bill_${cleanMonth}_${cleanShipper}.${ext}`;
}
