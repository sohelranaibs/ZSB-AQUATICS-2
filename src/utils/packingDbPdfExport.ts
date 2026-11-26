import { CompanyProfile, PackingRecord } from '../types/index.ts';
import {
  calculatePackingTotalAmountBDT,
  formatCurrency,
  formatDate,
  formatRMB,
} from './calculations.ts';
import { resolvePackingRecordStatus } from './batchDatabaseUpdate.ts';
import {
  GlobalTableColumn,
  GlobalTableFooterCell,
  GlobalViewTableReport,
} from './globalViewPdfExport.ts';

export const DEFAULT_PACKING_DB_PDF_COLUMNS = [
  'invoiceNumber',
  'date',
  'shippingMark',
  'flight',
  'destination',
  'shipper',
  'documentsHolder',
  'items',
  'totalBox',
  'totalWeight',
  'totalAmount',
  'rmbRate',
  'amountBDT',
  'status',
] as const;

export type PackingDbPdfColumnId = (typeof DEFAULT_PACKING_DB_PDF_COLUMNS)[number];

export interface PackingDbPdfFilenameOptions {
  startDate?: string;
  endDate?: string;
  partyQuery?: string;
  searchTerm?: string;
  validationFilter?: string;
  referenceDate?: string;
}

export interface BuildPackingDbPdfReportInput extends PackingDbPdfFilenameOptions {
  records: PackingRecord[];
  totalRecordCount?: number;
  companyProfile: CompanyProfile;
  serialNumberMap?: Map<string, number>;
  columnOrder?: string[];
}

function sanitizeSlug(raw: string, maxLen: number = 28): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
}

/**
 * Produces a deterministic, human-readable filename for Packing DB A4 PDF exports.
 */
export function formatPackingDbPdfFilename(
  options: PackingDbPdfFilenameOptions = {}
): string {
  const parts: string[] = ['ZSB_AQUATICS_PACKING_DB'];

  const cleanStart = (options.startDate || '').trim().replace(/[^0-9-]/g, '');
  const cleanEnd = (options.endDate || '').trim().replace(/[^0-9-]/g, '');
  if (cleanStart || cleanEnd) {
    parts.push(`${cleanStart || 'START'}_TO_${cleanEnd || 'END'}`);
  } else {
    const refDate = (
      options.referenceDate || new Date().toISOString().slice(0, 10)
    )
      .trim()
      .replace(/[^0-9-]/g, '');
    parts.push(refDate || '2026-10-29');
  }

  const partySlug = sanitizeSlug(options.partyQuery || '');
  if (partySlug) {
    parts.push(partySlug);
  }

  const searchSlug = sanitizeSlug(options.searchTerm || '');
  if (searchSlug && searchSlug !== partySlug) {
    parts.push(searchSlug);
  }

  if (options.validationFilter && options.validationFilter !== 'all') {
    const valSlug = sanitizeSlug(options.validationFilter, 18);
    if (valSlug) parts.push(valSlug);
  }

  return `${parts.join('_')}.pdf`;
}

function resolveOrderedColumnIds(columnOrder?: string[]): PackingDbPdfColumnId[] {
  const validSet = new Set<string>(DEFAULT_PACKING_DB_PDF_COLUMNS);
  if (!columnOrder || columnOrder.length === 0) {
    return [...DEFAULT_PACKING_DB_PDF_COLUMNS];
  }
  const seen = new Set<string>();
  const ordered: PackingDbPdfColumnId[] = [];
  for (const id of columnOrder) {
    if (validSet.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id as PackingDbPdfColumnId);
    }
  }
  for (const id of DEFAULT_PACKING_DB_PDF_COLUMNS) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}

function buildColumnDefinition(
  colId: PackingDbPdfColumnId,
  currency: string
): GlobalTableColumn {
  switch (colId) {
    case 'invoiceNumber':
      return { key: 'invoiceNumber', label: 'PACK NO', align: 'left' };
    case 'date':
      return { key: 'date', label: 'DATE', align: 'center' };
    case 'shippingMark':
      return { key: 'shippingMark', label: 'MARK', align: 'left' };
    case 'flight':
      return { key: 'flight', label: 'FLIGHT', align: 'left' };
    case 'destination':
      return { key: 'destination', label: 'DEST.', align: 'left' };
    case 'shipper':
      return { key: 'shipper', label: 'SHIPPER', align: 'left' };
    case 'documentsHolder':
      return { key: 'documentsHolder', label: 'DOCS', align: 'left' };
    case 'items':
      return { key: 'items', label: 'ITEMS', align: 'left' };
    case 'totalBox':
      return { key: 'totalBox', label: 'BOX', align: 'right' };
    case 'totalWeight':
      return { key: 'totalWeight', label: 'WT (KG)', align: 'right' };
    case 'totalAmount':
      return { key: 'totalAmount', label: 'RMB', align: 'right' };
    case 'rmbRate':
      return { key: 'rmbRate', label: 'RATE', align: 'right' };
    case 'amountBDT':
      return { key: 'amountBDT', label: `TOTAL (${currency})`, align: 'right' };
    case 'status':
      return { key: 'status', label: 'STATUS', align: 'center' };
  }
}

function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Builds a structured A4 Company-Pad printable report for the currently filtered Packing DB view.
 * Preserves the user's active filter set, row sorting, persistent serial numbers, and column order.
 */
export function buildPackingDbPdfReport(
  input: BuildPackingDbPdfReportInput
): GlobalViewTableReport {
  const {
    records,
    totalRecordCount = records.length,
    companyProfile,
    serialNumberMap,
    columnOrder,
    startDate,
    endDate,
    partyQuery,
    searchTerm,
    validationFilter,
    referenceDate,
  } = input;

  const currency = companyProfile.currency || 'TK';
  const defaultRmbRate =
    Number(companyProfile.rmbExchangeRate) > 0
      ? Number(companyProfile.rmbExchangeRate)
      : 16.5;

  const orderedIds = resolveOrderedColumnIds(columnOrder);
  const columns: GlobalTableColumn[] = [
    { key: 'sl', label: 'S. NO.', align: 'center' },
    ...orderedIds.map((id) => buildColumnDefinition(id, currency)),
  ];

  let totalBoxes = 0;
  let totalWeight = 0;
  let totalRmb = 0;
  let totalBdt = 0;

  const rows: Record<string, string | number>[] = records.map((pkg, idx) => {
    const serialNo =
      serialNumberMap?.get(pkg.id) ??
      (typeof pkg.serialNumber === 'number' && pkg.serialNumber > 0
        ? pkg.serialNumber
        : idx + 1);

    const rowBoxes = Number(pkg.totalBox) || 0;
    const rowWeight = Number(pkg.totalWeight) || 0;
    const rowRmb = Number(pkg.totalAmount) || 0;
    const effectiveRate =
      Number(pkg.rmbRate) > 0 ? Number(pkg.rmbRate) : defaultRmbRate;
    const rowBdt = calculatePackingTotalAmountBDT(rowRmb, effectiveRate);

    totalBoxes += rowBoxes;
    totalWeight += rowWeight;
    totalRmb += rowRmb;
    totalBdt += rowBdt;

    const itemNames = (pkg.items || [])
      .map((it) => (it.item || '').trim())
      .filter(Boolean);
    const itemsSummary =
      itemNames.length > 0
        ? `${pkg.items.length} (${itemNames.join(', ')})`
        : `${pkg.items?.length || 0} Items`;

    return {
      sl: serialNo,
      invoiceNumber: pkg.invoiceNumber || '-',
      date: pkg.rawValues?.packingDate || formatDate(pkg.packingDate) || '-',
      shippingMark: pkg.rawValues?.shippingMark || pkg.shippingMark || '-',
      flight: pkg.rawValues?.flight || pkg.flight || '-',
      destination: pkg.rawValues?.destination || pkg.destination || '-',
      shipper: pkg.rawValues?.shipper || pkg.shipper || '-',
      documentsHolder: pkg.documentsHolder || '-',
      items: itemsSummary,
      totalBox: rowBoxes,
      totalWeight: `${roundTwo(rowWeight)} KG`,
      totalAmount: pkg.calculationPending ? 'Pending' : formatRMB(rowRmb),
      rmbRate:
        Number(pkg.rmbRate) > 0
          ? Number(pkg.rmbRate).toFixed(2)
          : defaultRmbRate.toFixed(2),
      amountBDT: formatCurrency(rowBdt, ''),
      status: resolvePackingRecordStatus(pkg),
    };
  });

  // Build 1-cell-per-column footer so totals stay aligned under their columns
  // regardless of column reordering or column toggling in PrintPreviewModal.
  const footerCells: GlobalTableFooterCell[] = columns.map((col, idx) => {
    if (idx === 0) {
      return { value: 'TOTAL', align: 'center', tone: 'default' };
    }
    switch (col.key) {
      case 'totalBox':
        return { value: `${roundTwo(totalBoxes)}`, align: 'right', tone: 'blue' };
      case 'totalWeight':
        return {
          value: `${roundTwo(totalWeight)} KG`,
          align: 'right',
          tone: 'emerald',
        };
      case 'totalAmount':
        return {
          value: formatRMB(roundTwo(totalRmb)),
          align: 'right',
          tone: 'amber',
        };
      case 'amountBDT':
        return {
          value: formatCurrency(roundTwo(totalBdt), currency),
          align: 'right',
          tone: 'default',
        };
      default:
        return { value: '', align: col.align || 'left' };
    }
  });

  const dateRangeLabel =
    startDate || endDate
      ? `${startDate ? formatDate(startDate) : 'Start'} — ${endDate ? formatDate(endDate) : 'Present'}`
      : 'All Dates';

  const activeFilters: string[] = [];
  if (partyQuery && partyQuery.trim()) {
    activeFilters.push(`Shipper/Exporter: ${partyQuery.trim()}`);
  }
  if (searchTerm && searchTerm.trim()) {
    activeFilters.push(`Search: ${searchTerm.trim()}`);
  }
  if (validationFilter && validationFilter !== 'all') {
    activeFilters.push(`Audit: ${validationFilter}`);
  }
  const filterLabel =
    activeFilters.length > 0 ? activeFilters.join(' · ') : 'All Shippers & Marks';

  const isFiltered =
    records.length !== totalRecordCount ||
    Boolean(startDate || endDate || activeFilters.length > 0);

  const generatedDate = referenceDate || new Date().toISOString().slice(0, 10);
  const filename = formatPackingDbPdfFilename({
    startDate,
    endDate,
    partyQuery,
    searchTerm,
    validationFilter,
    referenceDate: generatedDate,
  });

  const subtitleParts = [
    isFiltered
      ? `${records.length} of ${totalRecordCount} Export Consignment(s)`
      : `${records.length} Export Consignment(s)`,
    dateRangeLabel,
  ];
  if (activeFilters.length > 0) {
    subtitleParts.push(activeFilters.join(' · '));
  }

  return {
    activeTab: 'packing_db',
    viewLabel: 'Packing DB',
    documentTitle: `Packing DB Ledger (${records.length} Consignment${records.length === 1 ? '' : 's'})`,
    documentBadge: 'MASTER EXPORT PACKING LIST DATABASE — OFFICIAL A4 LEDGER',
    sheetReference: 'PACKING_DB',
    generatedDate,
    filename,
    metadataGrid: [
      {
        label: 'CONSIGNMENTS',
        value: isFiltered
          ? `${records.length} of ${totalRecordCount} Filtered`
          : `${records.length} Total`,
      },
      {
        label: 'DATE RANGE',
        value: dateRangeLabel,
      },
      {
        label: 'FILTER SCOPE',
        value: filterLabel,
      },
      {
        label: 'TOTAL BOXES & WEIGHT',
        value: `${roundTwo(totalBoxes)} Boxes · ${roundTwo(totalWeight)} KG`,
      },
      {
        label: 'TOTAL VALUE (RMB)',
        value: formatRMB(roundTwo(totalRmb)),
      },
      {
        label: `TOTAL AMOUNT (${currency})`,
        value: formatCurrency(roundTwo(totalBdt), currency),
      },
    ],
    sections: [
      {
        id: 'packing-db-ledger',
        title: 'Export Packing List Database Ledger',
        subtitle: subtitleParts.join(' · '),
        columns,
        rows,
        footerRows: records.length > 0 ? [{ cells: footerCells }] : [],
      },
    ],
  };
}
