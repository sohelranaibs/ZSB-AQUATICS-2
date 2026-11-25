import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';
import {
  MonthlyExportsPurchasesReportItem,
  MonthlyReportsSummaryTotals,
  calculatePackingTotalAmountBDT,
} from './calculations.ts';
import { resolvePackingRecordStatus } from './batchDatabaseUpdate.ts';

/**
 * UTF-8 Byte Order Mark (BOM) to force Microsoft Excel and spreadsheets
 * to interpret the file as UTF-8 without garbling special characters or symbols.
 */
export const UTF8_BOM = '\uFEFF';

/**
 * Escapes an individual cell value according to RFC 4180:
 * Encloses value in double quotes if it contains commas, double quotes, or newlines,
 * and escapes double quotes by doubling them (" -> "").
 */
export function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats an array of string values into a single RFC 4180 CSV line.
 */
export function formatCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

/**
 * Generates an Excel-compatible CSV string for Purchase Records.
 */
export function generatePurchasesCSV(records: PurchaseRecord[]): string {
  const headers = [
    'Invoice No',
    'Date',
    'Supplier / Description',
    'Contact Number',
    'Total Items (Lines)',
    'Total Quantity',
    'Total Amount',
    'Previous Amount',
    'Paid Amount',
    'Balance Amount',
    'Items Breakdown',
    'Remarks',
  ];

  const rows = records.map((p) => {
    const itemsSummary = (p.items || [])
      .map((it) => `${it.item || 'Item'}: Qty ${it.quantity} @ ${it.rate} = ${it.totalAmount}`)
      .join('; ');

    return [
      p.invoiceNumber || '',
      p.date || '',
      p.description || '',
      p.contactNumber || '',
      p.items?.length || 0,
      p.totalQty || 0,
      p.totalAmount || 0,
      p.previousAmount || 0,
      p.paidAmount || 0,
      p.balance || 0,
      itemsSummary,
      p.remarks || '',
    ];
  });

  const lines = [
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Generates an Excel-compatible CSV string for Packing List Records.
 */
export function generatePackingsCSV(records: PackingRecord[]): string {
  const headers = [
    'Packing List No',
    'Date',
    'Shipping Mark',
    'Flight',
    'Destination',
    'Shipper',
    'Total Box',
    'Total Weight (KG)',
    'Total Value (RMB)',
    'RMB Rate',
    'Total Amount (BDT)',
    'From Date',
    'To Date',
    'Items Breakdown',
    'Remarks',
  ];

  const rows = records.map((pkg) => {
    const itemsSummary = (pkg.items || [])
      .map((it) => `${it.item || 'Item'}: ${it.box} box, ${it.weight} kg, Tot ${it.totalWeight} kg @ ${it.rate} = ${it.amount}`)
      .join('; ');
    const rmbRate = Number(pkg.rmbRate) || 0;
    const totalAmountBDT =
      Math.round((Number(pkg.totalAmount) || 0) * rmbRate * 100) / 100;

    return [
      pkg.invoiceNumber || '',
      pkg.packingDate || '',
      pkg.shippingMark || '',
      pkg.flight || '',
      pkg.destination || '',
      pkg.shipper || '',
      pkg.totalBox || 0,
      pkg.totalWeight || 0,
      pkg.totalAmount || 0,
      rmbRate,
      totalAmountBDT,
      pkg.fromDate || '',
      pkg.toDate || '',
      itemsSummary,
      pkg.remarks || '',
    ];
  });

  const lines = [
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}

export type PackingLedgerCsvColumnId =
  | 'invoiceNumber'
  | 'date'
  | 'shippingMark'
  | 'flight'
  | 'destination'
  | 'shipper'
  | 'documentsHolder'
  | 'items'
  | 'totalBox'
  | 'totalWeight'
  | 'totalAmount'
  | 'rmbRate'
  | 'amountBDT'
  | 'status';

export const PACKING_LEDGER_DEFAULT_CSV_COLUMNS: readonly PackingLedgerCsvColumnId[] = [
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
];

const PACKING_LEDGER_COLUMN_SPECS: Record<
  PackingLedgerCsvColumnId,
  {
    header: string;
    getValue: (pkg: PackingRecord) => string | number;
  }
> = {
  invoiceNumber: {
    header: 'Packing List No',
    getValue: (pkg) => pkg.invoiceNumber || '',
  },
  date: {
    header: 'Date',
    getValue: (pkg) => pkg.packingDate || '',
  },
  shippingMark: {
    header: 'Shipping Mark (Exporter)',
    getValue: (pkg) => pkg.shippingMark || '',
  },
  flight: {
    header: 'Flight',
    getValue: (pkg) => pkg.flight || '',
  },
  destination: {
    header: 'Destination',
    getValue: (pkg) => pkg.destination || '',
  },
  shipper: {
    header: 'Shipper',
    getValue: (pkg) => pkg.shipper || '',
  },
  documentsHolder: {
    header: 'Documents Holder',
    getValue: (pkg) => pkg.documentsHolder || '',
  },
  items: {
    header: 'Items',
    getValue: (pkg) =>
      (pkg.items || [])
        .map((it) => it.item || 'Item')
        .filter(Boolean)
        .join(', '),
  },
  totalBox: {
    header: 'Total Box',
    getValue: (pkg) => Number(pkg.totalBox) || 0,
  },
  totalWeight: {
    header: 'Total Weight (KG)',
    getValue: (pkg) => Number(pkg.totalWeight) || 0,
  },
  totalAmount: {
    header: 'Total Value (RMB)',
    getValue: (pkg) => Number(pkg.totalAmount) || 0,
  },
  rmbRate: {
    header: 'RMB Rate',
    getValue: (pkg) => Number(pkg.rmbRate) || 0,
  },
  amountBDT: {
    header: 'Total Amount (BDT)',
    getValue: (pkg) => calculatePackingTotalAmountBDT(pkg.totalAmount, pkg.rmbRate),
  },
  status: {
    header: 'Status',
    getValue: (pkg) => resolvePackingRecordStatus(pkg),
  },
};

function sanitizeCsvFilenameToken(raw: string, maxLength: number = 24): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.slice(0, maxLength);
}

/**
 * Generates a descriptive, filesystem-safe CSV filename reflecting active Packing List filters.
 */
export function formatFilteredPackingCsvFilename(options?: {
  startDate?: string;
  endDate?: string;
  partyQuery?: string;
  searchTerm?: string;
  validationFilter?: string;
  referenceDate?: string;
}): string {
  const {
    startDate = '',
    endDate = '',
    partyQuery = '',
    searchTerm = '',
    validationFilter = 'all',
    referenceDate,
  } = options || {};

  const parts = ['ZSB_Aquatics_Packing_List'];
  const partyToken = sanitizeCsvFilenameToken(partyQuery);
  const searchToken = sanitizeCsvFilenameToken(searchTerm);

  if (partyToken) {
    parts.push(`Filter_${partyToken}`);
  }
  if (searchToken && searchToken.toLowerCase() !== partyToken.toLowerCase()) {
    parts.push(`Search_${searchToken}`);
  }
  if (validationFilter === 'invalid_only') {
    parts.push('Invalid_Only');
  }

  if (startDate || endDate) {
    const startToken = sanitizeCsvFilenameToken(startDate || 'start', 16) || 'start';
    const endToken = sanitizeCsvFilenameToken(endDate || 'end', 16) || 'end';
    parts.push(`${startToken}_to_${endToken}`);
  } else {
    const dateToken =
      sanitizeCsvFilenameToken(referenceDate || new Date().toISOString().slice(0, 10), 16) ||
      'export';
    parts.push(dateToken);
  }

  return `${parts.join('_')}.csv`;
}

/**
 * Generates an Excel-compatible UTF-8 CSV reflecting the currently filtered and sorted
 * Packing List Ledger view, including persistent S. No., active column order,
 * live BDT conversion, status, and item breakdown for offline spreadsheet analysis.
 */
export function generateFilteredPackingLedgerCSV(
  records: readonly PackingRecord[],
  options?: {
    serialNumberMap?: ReadonlyMap<string, number>;
    columnOrder?: readonly string[];
  }
): string {
  const seenCols = new Set<PackingLedgerCsvColumnId>();
  const orderedCols: PackingLedgerCsvColumnId[] = [];

  if (options?.columnOrder && options.columnOrder.length > 0) {
    for (const col of options.columnOrder) {
      if (
        Object.prototype.hasOwnProperty.call(PACKING_LEDGER_COLUMN_SPECS, col) &&
        !seenCols.has(col as PackingLedgerCsvColumnId)
      ) {
        const typedCol = col as PackingLedgerCsvColumnId;
        seenCols.add(typedCol);
        orderedCols.push(typedCol);
      }
    }
  }

  const activeCols =
    orderedCols.length > 0 ? orderedCols : [...PACKING_LEDGER_DEFAULT_CSV_COLUMNS];

  const headers = [
    'S. No.',
    ...activeCols.map((colId) => PACKING_LEDGER_COLUMN_SPECS[colId].header),
    'Items Breakdown',
    'Remarks',
  ];

  const rows = records.map((pkg, index) => {
    const persistentSerialNo =
      pkg.serialNumber ?? options?.serialNumberMap?.get(pkg.id) ?? index + 1;
    const itemsBreakdown = (pkg.items || [])
      .map(
        (it) =>
          `${it.item || 'Item'}: ${it.box} box, ${it.weight} kg, Tot ${it.totalWeight} kg @ ${it.rate} = ${it.amount}`
      )
      .join('; ');

    return [
      persistentSerialNo,
      ...activeCols.map((colId) => PACKING_LEDGER_COLUMN_SPECS[colId].getValue(pkg)),
      itemsBreakdown,
      pkg.remarks || '',
    ];
  });

  const lines = [
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Generates an Excel-compatible CSV string for Payment Voucher Records.
 */
export function generatePaymentsCSV(records: PaymentRecord[]): string {
  const headers = [
    'Payment Voucher No',
    'Date',
    'Party / Supplier',
    'Status',
    'Total Amount / Debit',
    'Previous Amount',
    'Paid Amount',
    'Balance Amount',
    'Export Goods Ref',
    'Contact Number',
    'Remarks',
  ];

  const rows = records.map((pm) => [
    pm.invoiceNumber || '',
    pm.date || '',
    pm.description || '',
    pm.status || 'PAID',
    pm.totalAmount || 0,
    pm.previousAmount || 0,
    pm.paidAmount || 0,
    pm.balance || 0,
    pm.exportGoodsRef || '',
    pm.contactNumber || '',
    pm.remarks || '',
  ]);

  const lines = [
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Triggers browser file download with properly formatted CSV content.
 */
export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an Excel-compatible CSV string for Monthly Summary Reports of All Exports and Purchases.
 */
export function generateMonthlyExportsAndPurchasesSummaryCSV(
  items: MonthlyExportsPurchasesReportItem[],
  totals?: MonthlyReportsSummaryTotals,
  companyName: string = 'ZSB AQUATICS'
): string {
  const metaRows = [
    formatCsvRow([`${companyName} — MONTHLY SUMMARY REPORT (ALL EXPORTS & PURCHASES)`]),
    formatCsvRow([`Export Date: ${new Date().toISOString().slice(0, 10)}`, `Currencies: BDT / TK & RMB`]),
    formatCsvRow([]),
  ];

  const headers = [
    'Month (YYYY-MM)',
    'Month Label',
    'Purchase Volume (KG)',
    'Purchase Value (BDT)',
    'Purchase Bills Count',
    'Export Weight (KG)',
    'Export Cartons (Boxes)',
    'Export Value (RMB)',
    'Export Value (BDT)',
    'Export Manifests Count',
    'Operating / Cargo Costs (BDT)',
    'Net Trade Profit (BDT)',
    'Gross Margin (%)',
    'Trade Result',
  ];

  const rows = items.map((it) => [
    it.yearMonth,
    it.monthLabel,
    it.purchaseVolume,
    it.purchaseValue,
    it.purchaseCount,
    it.exportWeight,
    it.exportBoxes,
    it.exportValueRMB,
    it.exportValueBDT,
    it.exportCount,
    it.otherCosts,
    it.netProfit,
    `${it.marginPercent}%`,
    it.netProfit >= 0 ? 'PROFIT' : 'LOSS',
  ]);

  const lines = [
    ...metaRows,
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  if (totals) {
    const summaryRow = [
      'TOTAL / CUMULATIVE',
      `${items.length} Month(s)`,
      totals.totalPurchaseVolume,
      totals.totalPurchaseValue,
      totals.totalPurchaseCount,
      totals.totalExportWeight,
      totals.totalExportBoxes,
      totals.totalExportValueRMB,
      totals.totalExportValueBDT,
      totals.totalExportCount,
      totals.totalOtherCosts,
      totals.totalNetProfit,
      `${totals.overallMarginPercent}%`,
      totals.totalNetProfit >= 0 ? 'PROFIT' : 'LOSS',
    ];
    lines.push(formatCsvRow([]));
    lines.push(formatCsvRow(summaryRow));
  }

  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Generates an Excel-compatible detailed transactions CSV combining purchases and exports.
 */
export function generateDetailedMonthlyExportsPurchasesCSV(options: {
  targetMonth?: string;
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  rmbExchangeRate?: number;
  companyName?: string;
}): string {
  const {
    targetMonth = 'ALL',
    purchases,
    packings,
    rmbExchangeRate = 16.5,
    companyName = 'ZSB AQUATICS',
  } = options;

  const filterFn = (dateStr?: string) => {
    if (!targetMonth || targetMonth === 'ALL') return true;
    return (dateStr || '').slice(0, 7) === targetMonth;
  };

  const filteredPurchases = purchases.filter((p) => filterFn(p.date));
  const filteredPackings = packings.filter((pk) => filterFn(pk.packingDate));

  const metaRows = [
    formatCsvRow([`${companyName} — DETAILED EXPORTS & PURCHASES LEDGER REPORT`]),
    formatCsvRow([`Period Filter: ${targetMonth === 'ALL' ? 'All Months' : targetMonth}`, `Exported on: ${new Date().toISOString().slice(0, 10)}`]),
    formatCsvRow([]),
  ];

  const headers = [
    'Type',
    'Document / Invoice No',
    'Date',
    'Month (YYYY-MM)',
    'Supplier / Shipping Mark',
    'Destination / Flight / Contact',
    'Item Grades Summary',
    'Boxes',
    'Volume / Weight (KG)',
    'Currency',
    'Rate (Unit)',
    'Total Value (RMB)',
    'Total Amount (BDT)',
    'Settlement Status',
    'Remarks',
  ];

  const rows: (string | number | null | undefined)[][] = [];

  // 1. Add Purchases
  filteredPurchases.forEach((p) => {
    const itemsSummary = (p.items || [])
      .map((it) => `${it.item || 'Item'}: ${it.quantity} KG @ ${it.rate}`)
      .join('; ');
    rows.push([
      'PURCHASE_BILL',
      p.invoiceNumber || '',
      p.date || '',
      (p.date || '').slice(0, 7),
      p.description || '',
      p.contactNumber || '',
      itemsSummary,
      '',
      p.totalQty || 0,
      'BDT',
      '',
      0,
      p.totalAmount || 0,
      p.balance <= 0 ? 'PAID' : `DUE: ${p.balance}`,
      p.remarks || '',
    ]);
  });

  // 2. Add Export Manifests
  filteredPackings.forEach((pk) => {
    const itemsSummary = (pk.items || [])
      .map((it) => `${it.item || 'Item'}: ${it.box} box, ${it.weight} kg (${it.totalWeight} kg) @ ${it.rate} RMB`)
      .join('; ');
    const rate = Number(pk.rmbRate) > 0 ? Number(pk.rmbRate) : rmbExchangeRate;
    const rmbTotal = Number(pk.totalAmount) || 0;
    const bdtTotal = Math.round(rmbTotal * rate * 100) / 100;

    rows.push([
      'EXPORT_MANIFEST',
      pk.invoiceNumber || '',
      pk.packingDate || '',
      (pk.packingDate || '').slice(0, 7),
      pk.shippingMark || '',
      `${pk.destination || ''} · ${pk.flight || ''} · ${pk.shipper || ''}`,
      itemsSummary,
      pk.totalBox || 0,
      pk.totalWeight || 0,
      'RMB',
      rate,
      rmbTotal,
      bdtTotal,
      pk.paymentStatus || 'NO REPORT',
      pk.remarks || '',
    ]);
  });

  // Sort by date descending
  rows.sort((a, b) => String(b[2] || '').localeCompare(String(a[2] || '')));

  const lines = [
    ...metaRows,
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Generates an Excel-compatible consolidated financial transactions CSV
 * covering Purchases, Packings, Payments, and Other Operational Costs
 * filtered by the active date range.
 */
export function generateDateFilteredFinancialTransactionsCSV(options: {
  startDate?: string;
  endDate?: string;
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts: OtherCostRecord[];
  rmbExchangeRate?: number;
  companyName?: string;
}): string {
  const {
    startDate = '',
    endDate = '',
    purchases,
    packings,
    payments,
    otherCosts,
    rmbExchangeRate = 18.0,
    companyName = 'ZSB AQUATICS',
  } = options;

  const dateRangeLabel =
    !startDate && !endDate
      ? 'All Time'
      : `${startDate || 'Start'} to ${endDate || 'End'}`;

  const metaRows = [
    formatCsvRow([`${companyName} — CONSOLIDATED FINANCIAL TRANSACTIONS REPORT`]),
    formatCsvRow([
      `Active Filter Date Range: ${dateRangeLabel}`,
      `Exported At: ${new Date().toISOString()}`,
    ]),
    formatCsvRow([
      `Records: ${purchases.length} Purchases, ${packings.length} Packings, ${payments.length} Payments, ${otherCosts.length} Other Costs`,
    ]),
    formatCsvRow([]),
  ];

  const headers = [
    'Transaction Type',
    'Date',
    'Reference / Invoice No',
    'Party / Account / Description',
    'Details / Notes',
    'Boxes / Qty',
    'Weight (KG)',
    'Currency',
    'RMB Amount',
    'BDT Amount',
    'Status / Due Balance',
  ];

  const rows: (string | number)[][] = [];

  // Purchases
  purchases.forEach((p) => {
    rows.push([
      'PURCHASE',
      p.date || '',
      p.invoiceNumber || '',
      p.description || '',
      p.remarks || `Contact: ${p.contactNumber || 'N/A'}`,
      p.totalQty || 0,
      '',
      'BDT',
      '',
      p.totalAmount || 0,
      p.balance <= 0 ? 'PAID' : `DUE: ${p.balance}`,
    ]);
  });

  // Packings
  packings.forEach((pk) => {
    const rate = Number(pk.rmbRate) > 0 ? Number(pk.rmbRate) : rmbExchangeRate;
    const rmbTotal = Number(pk.totalAmount) || 0;
    const bdtTotal =
      pk.totalAmountBDT || Math.round(rmbTotal * rate * 100) / 100;

    rows.push([
      'EXPORT_PACKING',
      pk.packingDate || '',
      pk.invoiceNumber || '',
      pk.shippingMark || pk.shipper || '',
      `${pk.destination || ''} · ${pk.flight || ''}`,
      pk.totalBox || 0,
      pk.totalWeight || 0,
      'RMB',
      rmbTotal,
      bdtTotal,
      pk.paymentStatus || 'NO REPORT',
    ]);
  });

  // Payments
  payments.forEach((pm) => {
    rows.push([
      'PAYMENT_VOUCHER',
      pm.date || '',
      pm.invoiceNumber || '',
      pm.description || '',
      pm.exportGoodsRef ? `Ref: ${pm.exportGoodsRef}` : pm.remarks || '',
      '',
      '',
      'BDT',
      '',
      pm.paidAmount || pm.totalAmount || 0,
      pm.status || 'PAID',
    ]);
  });

  // Other Costs
  otherCosts.forEach((c) => {
    rows.push([
      'OPERATIONAL_COST',
      c.date || '',
      c.refInvoice || 'COST',
      c.category || 'Costing',
      c.description || '',
      '',
      '',
      'BDT',
      '',
      c.amount || 0,
      'DISBURSED',
    ]);
  });

  // Sort chronologically descending
  rows.sort((a, b) => String(b[1] || '').localeCompare(String(a[1] || '')));

  const lines = [
    ...metaRows,
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}

