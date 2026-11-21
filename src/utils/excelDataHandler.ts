import * as XLSX from 'xlsx';
import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
  PurchaseItemRow,
  PackingItemRow,
  PaymentItemRow,
} from '../types/index.ts';
import {
  calculatePurchaseRowTotal,
  calculatePurchaseTotals,
  calculatePackingRow,
  calculatePackingTotals,
  calculatePaymentRow,
  generateInvoiceNumber,
} from './calculations.ts';
import {
  UTF8_BOM,
  formatCsvRow,
  downloadCsvFile,
  generatePurchasesCSV,
  generatePackingsCSV,
  generatePaymentsCSV,
} from './csvExporter.ts';
import {
  splitCsvLine,
  parsePurchasesCSV,
  parsePackingsCSV,
  parsePaymentsCSV,
  buildPurchaseSupplierGroupKey,
  mergePurchaseRecordsBySupplierAndDate,
  buildPackingShipmentGroupKey,
  mergePackingRecordsByShipmentGroup,
  inspectNumericImportCell,
  hasPresentImportText,
  validateImportLimits,
  MAX_POPULATED_ROWS_PRIMARY,
  MAX_POPULATED_ROWS_COMPACT,
  MAX_IMPORT_FILE_BYTES,
  ParseResult,
} from './csvParser.ts';

export {
  buildPurchaseSupplierGroupKey,
  mergePurchaseRecordsBySupplierAndDate,
  buildPackingShipmentGroupKey,
  mergePackingRecordsByShipmentGroup,
  inspectNumericImportCell,
  validateImportLimits,
  MAX_POPULATED_ROWS_PRIMARY,
  MAX_POPULATED_ROWS_COMPACT,
  MAX_IMPORT_FILE_BYTES,
};

export type DatasetKey = 'purchase' | 'packing' | 'payment' | 'other_cost';

export interface MultiSheetImportResult {
  purchases: ParseResult<Omit<PurchaseRecord, 'id' | 'createdAt'>>;
  packings: ParseResult<Omit<PackingRecord, 'id' | 'createdAt'>>;
  payments: ParseResult<Omit<PaymentRecord, 'id' | 'createdAt'>>;
  otherCosts: ParseResult<Omit<OtherCostRecord, 'id' | 'createdAt'>>;
  detectedSheets: string[];
}

/**
 * Generates an Excel-compatible CSV string for Other Cost Records.
 */
export function generateOtherCostsCSV(records: OtherCostRecord[]): string {
  const headers = [
    'Date',
    'Category',
    'Amount (BDT)',
    'Description',
    'Payment Method',
    'Paid By',
    'Reference Invoice',
  ];

  const rows = records.map((c) => [
    c.date || '',
    c.category || '',
    c.amount || 0,
    c.description || '',
    c.paymentMethod || 'Cash',
    c.paidBy || '',
    c.refInvoice || '',
  ]);

  const lines = [
    formatCsvRow(headers),
    ...rows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Converts PurchaseRecords to flat tabular rows for Excel (.xlsx) export.
 */
export function purchasesToSheetRows(records: PurchaseRecord[]): Record<string, any>[] {
  return records.map((p) => {
    const firstItem = p.items?.[0];
    const itemsSummary = (p.items || [])
      .map((it) => `${it.item || 'Item'}: Qty ${it.quantity} @ ${it.rate} = ${it.totalAmount}`)
      .join('; ');

    return {
      'Invoice No': p.invoiceNumber || '',
      Date: p.date || '',
      'Supplier / Description': p.description || '',
      'Contact Number': p.contactNumber || '',
      Item: firstItem?.item || 'F1',
      Quantity: p.totalQty || firstItem?.quantity || 0,
      Rate: firstItem?.rate || (p.totalQty > 0 ? Math.round((p.totalAmount / p.totalQty) * 100) / 100 : 0),
      'Total Amount': p.totalAmount || 0,
      'Previous Amount': p.previousAmount || 0,
      'Paid Amount': p.paidAmount || 0,
      'Balance Amount': p.balance || 0,
      'Items Breakdown': itemsSummary,
      Remarks: p.remarks || '',
    };
  });
}

/**
 * Converts PackingRecords to flat tabular rows for Excel (.xlsx) export.
 */
export function packingsToSheetRows(records: PackingRecord[]): Record<string, any>[] {
  return records.map((pkg) => {
    const firstItem = pkg.items?.[0];
    const itemsSummary = (pkg.items || [])
      .map(
        (it) =>
          `${it.item || 'Item'}: ${it.box} box, ${it.weight} kg, Tot ${it.totalWeight} kg @ ${it.rate} = ${it.amount}`
      )
      .join('; ');
    const rmbRate = Number(pkg.rmbRate) || 0;
    const totalAmountBDT = Math.round((Number(pkg.totalAmount) || 0) * rmbRate * 100) / 100;

    return {
      'Packing List No': pkg.invoiceNumber || '',
      Date: pkg.packingDate || '',
      'Shipping Mark': pkg.shippingMark || '',
      Flight: pkg.flight || '',
      Destination: pkg.destination || '',
      Shipper: pkg.shipper || '',
      'Documents Holder': pkg.documentsHolder || '',
      Item: firstItem?.item || '2F',
      Box: pkg.totalBox || firstItem?.box || 0,
      'Weight Per Box (KG)': firstItem?.weight || (pkg.totalBox > 0 ? Math.round((pkg.totalWeight / pkg.totalBox) * 100) / 100 : 0),
      'Total Weight (KG)': pkg.totalWeight || 0,
      'Rate (RMB)': firstItem?.rate || (pkg.totalWeight > 0 ? Math.round((pkg.totalAmount / pkg.totalWeight) * 100) / 100 : 0),
      'Total Value (RMB)': pkg.totalAmount || 0,
      'RMB Rate': rmbRate,
      'Total Amount (BDT)': totalAmountBDT,
      Status: pkg.paymentStatus || pkg.exporterStatus || 'NO REPORT',
      'Items Breakdown': itemsSummary,
      Remarks: pkg.remarks || '',
    };
  });
}

/**
 * Converts PaymentRecords to flat tabular rows for Excel (.xlsx) export.
 */
export function paymentsToSheetRows(records: PaymentRecord[]): Record<string, any>[] {
  return records.map((pm) => ({
    'Payment Voucher No': pm.invoiceNumber || '',
    Date: pm.date || '',
    'Party / Supplier': pm.description || '',
    Category: pm.paymentCategory || (pm.returnRMB > 0 ? 'exporter' : 'supplier'),
    Status: pm.status || 'PAID',
    'Total Amount / Debit': pm.totalAmount || 0,
    'Previous Amount': pm.previousAmount || 0,
    'Paid Amount': pm.paidAmount || 0,
    'Balance Amount': pm.balance || 0,
    'Return RMB': pm.returnRMB || 0,
    'Export Goods Ref': pm.exportGoodsRef || '',
    'Contact Number': pm.contactNumber || '',
    Remarks: pm.remarks || '',
  }));
}

/**
 * Converts OtherCostRecords to flat tabular rows for Excel (.xlsx) export.
 */
export function otherCostsToSheetRows(records: OtherCostRecord[]): Record<string, any>[] {
  return records.map((c) => ({
    Date: c.date || '',
    Category: c.category || '',
    'Amount (BDT)': c.amount || 0,
    Description: c.description || '',
    'Payment Method': c.paymentMethod || 'Cash',
    'Paid By': c.paidBy || '',
    'Reference Invoice': c.refInvoice || '',
  }));
}

/**
 * Builds an Excel (.xlsx) binary buffer for a single dataset.
 */
export function generateSingleSheetWorkbookBuffer(
  type: DatasetKey,
  records: any[]
): Uint8Array {
  const wb = XLSX.utils.book_new();
  let rows: Record<string, any>[] = [];
  let sheetName = 'Sheet1';

  if (type === 'purchase') {
    rows = purchasesToSheetRows(records as PurchaseRecord[]);
    sheetName = 'Purchases';
  } else if (type === 'packing') {
    rows = packingsToSheetRows(records as PackingRecord[]);
    sheetName = 'Packing_Lists';
  } else if (type === 'payment') {
    rows = paymentsToSheetRows(records as PaymentRecord[]);
    sheetName = 'Payments';
  } else {
    rows = otherCostsToSheetRows(records as OtherCostRecord[]);
    sheetName = 'Other_Costs';
  }

  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([getTemplateHeaders(type)]);

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

/**
 * Builds a complete multi-sheet Master Workbook (.xlsx) containing all 4 ledgers.
 */
export function generateMasterWorkbookBuffer(data: {
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts: OtherCostRecord[];
}): Uint8Array {
  const wb = XLSX.utils.book_new();

  const purchaseRows = purchasesToSheetRows(data.purchases);
  const packingRows = packingsToSheetRows(data.packings);
  const paymentRows = paymentsToSheetRows(data.payments);
  const costRows = otherCostsToSheetRows(data.otherCosts);

  const wsPurchases =
    purchaseRows.length > 0
      ? XLSX.utils.json_to_sheet(purchaseRows)
      : XLSX.utils.aoa_to_sheet([getTemplateHeaders('purchase')]);
  const wsPackings =
    packingRows.length > 0
      ? XLSX.utils.json_to_sheet(packingRows)
      : XLSX.utils.aoa_to_sheet([getTemplateHeaders('packing')]);
  const wsPayments =
    paymentRows.length > 0
      ? XLSX.utils.json_to_sheet(paymentRows)
      : XLSX.utils.aoa_to_sheet([getTemplateHeaders('payment')]);
  const wsCosts =
    costRows.length > 0
      ? XLSX.utils.json_to_sheet(costRows)
      : XLSX.utils.aoa_to_sheet([getTemplateHeaders('other_cost')]);

  XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases');
  XLSX.utils.book_append_sheet(wb, wsPackings, 'Packing_Lists');
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');
  XLSX.utils.book_append_sheet(wb, wsCosts, 'Other_Costs');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

/**
 * Triggers a browser download for a generated .xlsx Uint8Array buffer.
 */
export function downloadExcelBuffer(buffer: Uint8Array, filename: string): void {
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const blob = new Blob([buffer as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getTemplateHeaders(type: DatasetKey): string[] {
  if (type === 'purchase') {
    return [
      'Supplier',
      'Date',
      'Item',
      'Quantity',
      'Rate',
      'PreviousAmount',
      'PaidAmount',
      'ContactNumber',
      'InvoiceNo',
      'Remarks',
    ];
  }
  if (type === 'packing') {
    return [
      'ShippingMark',
      'Flight',
      'Destination',
      'Shipper',
      'Date',
      'Item',
      'Box',
      'Weight',
      'Rate',
      'RmbRate',
      'PackingListNo',
      'Remarks',
    ];
  }
  if (type === 'payment') {
    return [
      'Party',
      'Date',
      'DebitAmount',
      'CreditAmount',
      'Status',
      'ReturnRMB',
      'ExportRef',
      'PaymentNo',
      'Remarks',
    ];
  }
  return ['Date', 'Category', 'Amount', 'Description', 'PaymentMethod', 'PaidBy', 'RefInvoice'];
}

export function getSampleTemplateRows(type: DatasetKey): Record<string, any>[] {
  if (type === 'purchase') {
    return [
      {
        Supplier: 'ABDULLAH VAI',
        Date: '2026-10-21',
        Item: 'FF1',
        Quantity: 120,
        Rate: 460,
        PreviousAmount: 10000,
        PaidAmount: 45000,
        ContactNumber: '+8801711223344',
        InvoiceNo: '',
        Remarks: 'Sample Purchase Challan (Merges with same Supplier + Date)',
      },
      {
        Supplier: 'ABDULLAH VAI',
        Date: '2026-10-21',
        Item: 'F1',
        Quantity: 80,
        Rate: 340,
        PreviousAmount: 0,
        PaidAmount: 20000,
        ContactNumber: '+8801711223344',
        InvoiceNo: '',
        Remarks: 'Sample Purchase Challan (Merges with same Supplier + Date)',
      },
      {
        Supplier: 'UZZAL VAI',
        Date: '2026-10-22',
        Item: 'F1',
        Quantity: 150,
        Rate: 330,
        PreviousAmount: 0,
        PaidAmount: 49500,
        ContactNumber: '+8801822334455',
        InvoiceNo: '',
        Remarks: 'Sample Purchase Challan',
      },
    ];
  }
  if (type === 'packing') {
    return [
      {
        ShippingMark: 'AAD',
        Flight: 'CAN',
        Destination: 'GUANGZHOU',
        Shipper: 'ZSB AQUATICS',
        Date: '2026-10-21',
        Item: '2F',
        Box: 8,
        Weight: 15,
        Rate: 420,
        RmbRate: 16.5,
        PackingListNo: '',
        Remarks: 'Air Freight Export Manifest (Same Mark/Flight/Dest/Shipper/Date auto-merges)',
      },
      {
        ShippingMark: 'AAD',
        Flight: 'CAN',
        Destination: 'GUANGZHOU',
        Shipper: 'ZSB AQUATICS',
        Date: '2026-10-21',
        Item: '3F',
        Box: 6,
        Weight: 14,
        Rate: 400,
        RmbRate: 16.5,
        PackingListNo: '',
        Remarks: 'Air Freight Export Manifest (Auto-merged into 1 Invoice & Packing No)',
      },
      {
        ShippingMark: 'CHJ-22',
        Flight: 'YG CAN',
        Destination: 'KUNMING',
        Shipper: 'SAJID INT.',
        Date: '2026-10-22',
        Item: '4F',
        Box: 7,
        Weight: 15,
        Rate: 390,
        RmbRate: 16.5,
        PackingListNo: '',
        Remarks: 'Air Freight Export Manifest',
      },
    ];
  }
  if (type === 'payment') {
    return [
      {
        Party: 'ABDULLAH VAI',
        Date: '2026-10-21',
        DebitAmount: 65000,
        CreditAmount: 0,
        Status: 'PAID',
        ReturnRMB: 3000,
        ExportRef: 'PKG-2026-0101',
        PaymentNo: 'PAY-2026-0101',
        Remarks: 'Supplier / Exporter Settlement',
      },
    ];
  }
  return [
    {
      Date: '2026-10-21',
      Category: 'Office Tea, Snacks & Pantry',
      Amount: 1850,
      Description: 'Office tea, guest snacks & utility supplies',
      PaymentMethod: 'Cash',
      PaidBy: 'Office Cashier',
      RefInvoice: 'VCH-2026-0101',
    },
  ];
}

/**
 * Downloads a sample Excel (.xlsx) template for the specified dataset or all datasets.
 */
export function downloadSampleExcelTemplate(type: DatasetKey | 'all'): void {
  const wb = XLSX.utils.book_new();
  if (type === 'all') {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getSampleTemplateRows('purchase')), 'Purchases');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getSampleTemplateRows('packing')), 'Packing_Lists');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getSampleTemplateRows('payment')), 'Payments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getSampleTemplateRows('other_cost')), 'Other_Costs');
    const out = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    downloadExcelBuffer(out, 'ZSB_Aquatics_Master_Import_Template.xlsx');
    return;
  }

  const sheetName =
    type === 'purchase'
      ? 'Purchases'
      : type === 'packing'
      ? 'Packing_Lists'
      : type === 'payment'
      ? 'Payments'
      : 'Other_Costs';
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getSampleTemplateRows(type)), sheetName);
  const out = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
  downloadExcelBuffer(out, `ZSB_Aquatics_${sheetName}_Template.xlsx`);
}

/**
 * Helper to normalize object keys (lowercase, strip spaces/punctuation) for flexible column matching.
 */
function normalizeKey(key: string): string {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getFieldByAliases(row: Record<string, any>, aliases: string[]): any {
  const normalizedMap = new Map<string, any>();
  for (const [k, v] of Object.entries(row)) {
    normalizedMap.set(normalizeKey(k), v);
  }
  for (const alias of aliases) {
    const val = normalizedMap.get(normalizeKey(alias));
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val;
    }
  }
  return undefined;
}

function parseNumberSafe(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const cleaned = String(val).replace(/[,৳¥$\s]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDateString(val: any): string {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (typeof val === 'number') {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const yyyy = String(parsed.y).padStart(4, '0');
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str;
}

/**
/**
 * Parses an exported Purchase "Items Breakdown" string
 * (e.g. "FF1: Qty 120 @ 460 = 55200; F1: Qty 80 @ 340 = 27200")
 * into PurchaseItemRow[] if present and valid.
 */
function parsePurchaseItemsBreakdown(
  breakdownStr: string,
  rowIndex: number
): PurchaseItemRow[] {
  if (!breakdownStr || !breakdownStr.includes(';')) return [];
  const segments = breakdownStr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return [];

  const parsedItems: PurchaseItemRow[] = [];
  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const match = seg.match(
      /^([^:]+):\s*(?:Qty\s*)?([\d.]+)\s*(?:KG\s*)?@\s*([+-]?[\d.]+)/i
    );
    if (!match) return [];
    const item = match[1].trim() || 'F1';
    const quantity = parseFloat(match[2]) || 1;
    const parsedRate = parseFloat(match[3]);
    const rate = Number.isFinite(parsedRate) && parsedRate !== 0 ? parsedRate : 0;
    parsedItems.push({
      id: `pi-imp-${Date.now()}-${rowIndex}-${sIdx}`,
      item,
      quantity,
      rate,
      rateSpecified: true,
      totalAmount: calculatePurchaseRowTotal(quantity, rate),
      previousAmount: 0,
      paidAmount: 0,
      balance: 0,
    });
  }
  return parsedItems;
}

function extractWorksheetCellLiteralOrValue(cell: XLSX.CellObject | undefined): any {
  if (!cell) return '';
  if (cell.f !== undefined && String(cell.f).trim() !== '') {
    const formulaText = String(cell.f).trim();
    return formulaText.startsWith('=') ? formulaText : `=${formulaText}`;
  }
  if (cell.v === undefined || cell.v === null) {
    return '';
  }
  return cell.v;
}

/**
 * Extracts worksheet row objects preserving formula expressions (`=SUM(...)`) as literal text strings.
 */
export function extractWorksheetRowObjectsWithLiteralFormulas(
  ws: XLSX.WorkSheet
): Record<string, any>[] {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const headerRow: string[] = [];
  const usedHeaders = new Set<string>();

  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    const rawHeader = extractWorksheetCellLiteralOrValue(ws[addr]);
    let headerText = hasPresentImportText(rawHeader) ? String(rawHeader).trim() : `__EMPTY_${C}`;
    if (usedHeaders.has(headerText)) {
      headerText = `${headerText}_${C}`;
    }
    usedHeaders.add(headerText);
    headerRow.push(headerText);
  }

  const rows: Record<string, any>[] = [];
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    const rowObj: Record<string, any> = {};
    let hasAnyPopulated = false;

    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const val = extractWorksheetCellLiteralOrValue(ws[addr]);
      const key = headerRow[C - range.s.c];
      rowObj[key] = val;
      if (hasPresentImportText(val)) {
        hasAnyPopulated = true;
      }
    }

    if (hasAnyPopulated) {
      rows.push(rowObj);
    }
  }

  return rows;
}

function extractWorksheetTextMatrixWithLiteralFormulas(ws: XLSX.WorkSheet): string[][] {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const matrix: string[][] = [];

  for (let R = range.s.r; R <= range.e.r; R++) {
    const rowCells: string[] = [];
    let hasAny = false;
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const val = extractWorksheetCellLiteralOrValue(ws[addr]);
      const str = val === undefined || val === null ? '' : String(val).trim();
      rowCells.push(str);
      if (str !== '') hasAny = true;
    }
    if (hasAny) matrix.push(rowCells);
  }

  return matrix;
}

/**
 * Parses an array of row objects (from Excel sheet or header-mapped CSV) into PurchaseRecords.
 * Rows sharing the same Purchasing Supplier Name and Date are automatically
 * merged into 1 PurchaseRecord with a single INV invoice number.
 * Accepts all cell values including numeric supplier names, blanks, negatives, text amounts & formulas.
 */
export function parsePurchasesFromRowObjects(
  rows: Record<string, any>[],
  startCount: number = 0
): ParseResult<Omit<PurchaseRecord, 'id' | 'createdAt'>> {
  const rawRecords: Omit<PurchaseRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  const populatedRows = rows.filter((row) =>
    Object.values(row || {}).some((v) => hasPresentImportText(v))
  );

  const limitCheck = validateImportLimits({
    dataset: 'purchase',
    populatedRows: populatedRows.length,
  });
  if (!limitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [limitCheck.error || 'Row limit exceeded.'],
      totalParsedRows: populatedRows.length,
      pendingCount: 0,
    };
  }

  populatedRows.forEach((row, idx) => {
    const supplierRaw = getFieldByAliases(row, [
      'Supplier',
      'Supplier / Description',
      'Description',
      'Party',
      'Vendor',
    ]);
    const supplier = hasPresentImportText(supplierRaw) ? String(supplierRaw).trim() : '';

    const date = normalizeDateString(getFieldByAliases(row, ['Date', 'Purchase Date', 'Invoice Date']));
    const itemRaw = getFieldByAliases(row, ['Item', 'Grade', 'Product']);
    const item = hasPresentImportText(itemRaw) ? String(itemRaw).trim() : '';

    const qtyRaw = getFieldByAliases(row, ['Quantity', 'Total Quantity', 'Qty', 'TotalQty', 'Weight']);
    const totalAmtRaw = getFieldByAliases(row, ['Total Amount', 'TotalAmount', 'Amount']);
    const rateRaw = getFieldByAliases(row, ['Rate', 'Unit Rate', 'Price']);
    const prevRaw = getFieldByAliases(row, ['Previous Amount', 'PreviousAmount', 'Previous', 'PrevBalance']);
    const paidRaw = getFieldByAliases(row, ['Paid Amount', 'PaidAmount', 'Paid']);

    const qtyCheck = inspectNumericImportCell(qtyRaw);
    const totalAmtCheck = inspectNumericImportCell(totalAmtRaw);
    const rateCheck = inspectNumericImportCell(rateRaw);
    const prevCheck = inspectNumericImportCell(prevRaw);
    const paidCheck = inspectNumericImportCell(paidRaw);

    const pendingFields: string[] = [];
    const rawValues: Record<string, string> = {};

    if (qtyCheck.status === 'unreadable') {
      pendingFields.push('totalQty');
      rawValues.quantity = qtyCheck.rawText;
      rawValues.totalQty = qtyCheck.rawText;
    }
    if (rateCheck.status === 'unreadable') {
      pendingFields.push('rate');
      rawValues.rate = rateCheck.rawText;
    }
    if (totalAmtCheck.status === 'unreadable') {
      pendingFields.push('totalAmount');
      rawValues.totalAmount = totalAmtCheck.rawText;
    }
    if (prevCheck.status === 'unreadable') {
      pendingFields.push('previousAmount');
      rawValues.previousAmount = prevCheck.rawText;
    }
    if (paidCheck.status === 'unreadable') {
      pendingFields.push('paidAmount');
      rawValues.paidAmount = paidCheck.rawText;
    }

    const quantity = qtyCheck.numericValue;
    const totalAmountVal = totalAmtCheck.numericValue;
    let rate = rateCheck.numericValue;
    if (rateCheck.status !== 'unreadable' && rate === 0 && quantity !== 0 && totalAmountVal !== 0) {
      rate = Math.round((totalAmountVal / quantity) * 100) / 100;
    }

    const contactNumber = hasPresentImportText(
      getFieldByAliases(row, ['Contact Number', 'ContactNumber', 'Contact', 'Phone', 'Mobile'])
    )
      ? String(
          getFieldByAliases(row, ['Contact Number', 'ContactNumber', 'Contact', 'Phone', 'Mobile'])
        ).trim()
      : '';
    const explicitInvoiceNumber = hasPresentImportText(
      getFieldByAliases(row, ['Invoice No', 'InvoiceNo', 'Invoice Number', 'InvoiceNumber', 'Doc No'])
    )
      ? String(
          getFieldByAliases(row, ['Invoice No', 'InvoiceNo', 'Invoice Number', 'InvoiceNumber', 'Doc No'])
        ).trim()
      : '';
    const remarksRaw = getFieldByAliases(row, ['Remarks', 'Notes', 'Comment']);
    const remarks = hasPresentImportText(remarksRaw)
      ? String(remarksRaw).trim()
      : 'Imported from Excel/CSV';

    if (supplier.startsWith('=')) rawValues.description = supplier;
    if (item.startsWith('=')) rawValues.item = item;
    if (date.startsWith('=')) rawValues.date = date;
    if (contactNumber.startsWith('=')) rawValues.contactNumber = contactNumber;
    if (explicitInvoiceNumber.startsWith('=')) rawValues.invoiceNumber = explicitInvoiceNumber;
    if (remarks.startsWith('=')) rawValues.remarks = remarks;

    const itemsBreakdownRaw = getFieldByAliases(row, ['Items Breakdown', 'ItemsBreakdown']);
    const itemsBreakdownStr = hasPresentImportText(itemsBreakdownRaw)
      ? String(itemsBreakdownRaw).trim()
      : '';

    const calculationPending = pendingFields.length > 0;
    const breakdownItems = parsePurchaseItemsBreakdown(itemsBreakdownStr, idx);
    let rowItems: PurchaseItemRow[];
    if (breakdownItems.length > 0) {
      rowItems = breakdownItems;
    } else {
      const effectiveQty = quantity;
      const effectiveRate = rate !== 0 || qtyCheck.status === 'number' ? rate : totalAmountVal;
      const computedRowTotal = calculationPending
        ? totalAmtCheck.status === 'number'
          ? totalAmountVal
          : 0
        : rateCheck.status === 'blank' && totalAmtCheck.status === 'number'
        ? totalAmountVal
        : calculatePurchaseRowTotal(effectiveQty, effectiveRate);

      rowItems = [
        {
          id: `pi-imp-${Date.now()}-${idx}`,
          item,
          quantity: effectiveQty,
          rate: effectiveRate,
          totalAmount: computedRowTotal,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
      ];
    }

    const previousAmount = prevCheck.numericValue;
    const paidAmount = paidCheck.numericValue;
    const totals = calculatePurchaseTotals(rowItems, previousAmount, paidAmount);

    rawRecords.push({
      invoiceNumber: explicitInvoiceNumber,
      date,
      description: supplier,
      contactNumber,
      items: rowItems,
      totalQty: totals.totalQty,
      totalAmount: calculationPending
        ? totalAmtCheck.status === 'number'
          ? totalAmountVal
          : 0
        : totals.totalAmount,
      previousAmount: totals.previousAmount,
      paidAmount: totals.paidAmount,
      balance: calculationPending ? 0 : totals.balance,
      remarks,
      calculationPending,
      pendingFields: pendingFields.length > 0 ? pendingFields : undefined,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    });
  });

  const records = mergePurchaseRecordsBySupplierAndDate(rawRecords, startCount);

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: rawRecords.length,
    pendingCount: records.filter((r) => r.calculationPending).length,
  };
}

/**
 * Parses an exported "Items Breakdown" string (e.g. "2F: 8 box, 15 kg, Tot 120 kg @ 420 = 50400; 3F: 6 box...")
 * into PackingItemRow[] if present and valid.
 */
function parsePackingItemsBreakdown(
  breakdownStr: string,
  rowIndex: number
): PackingItemRow[] {
  if (!breakdownStr || !breakdownStr.includes(';')) return [];
  const segments = breakdownStr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return [];

  const parsedItems: PackingItemRow[] = [];
  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const match = seg.match(
      /^([^:]+):\s*([+-]?[\d.]+)\s*box,\s*([+-]?[\d.]+)\s*kg,\s*Tot\s*([+-]?[\d.]+)\s*kg\s*@\s*([+-]?[\d.]+)/i
    );
    if (!match) return [];
    const item = match[1].trim() || '';
    const box = parseFloat(match[2]) || 0;
    const weight = parseFloat(match[3]) || 0;
    const rate = parseFloat(match[5]) || 0;
    const calcs = calculatePackingRow(box, weight, rate);
    parsedItems.push({
      id: `pki-imp-${Date.now()}-${rowIndex}-${sIdx}`,
      item,
      box,
      weight,
      totalWeight: calcs.totalWeight,
      unit: 'KG',
      rate,
      amount: calcs.amount,
    });
  }
  return parsedItems;
}

/**
 * Parses an array of row objects (from Excel sheet or header-mapped CSV) into PackingRecords.
 * Rows sharing ShippingMark, Flight, Destination, Shipper, and Date share 1 invoice.
 * Accepts all cell values: numeric names & marks, blanks, negatives, text amounts, literal formulas.
 */
export function parsePackingsFromRowObjects(
  rows: Record<string, any>[],
  startCount: number = 0
): ParseResult<Omit<PackingRecord, 'id' | 'createdAt'>> {
  const rawRecords: Omit<PackingRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  const populatedRows = rows.filter((row) =>
    Object.values(row || {}).some((v) => hasPresentImportText(v))
  );

  const limitCheck = validateImportLimits({
    dataset: 'packing',
    populatedRows: populatedRows.length,
  });
  if (!limitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [limitCheck.error || 'Row limit exceeded.'],
      totalParsedRows: populatedRows.length,
      pendingCount: 0,
    };
  }

  populatedRows.forEach((row, idx) => {
    const markRaw = getFieldByAliases(row, ['Shipping Mark', 'ShippingMark', 'Mark']);
    const mark = hasPresentImportText(markRaw) ? String(markRaw).trim() : '';

    const flightRaw = getFieldByAliases(row, ['Flight', 'Airline']);
    const flight = hasPresentImportText(flightRaw) ? String(flightRaw).trim() : '';

    const destRaw = getFieldByAliases(row, ['Destination', 'Dest', 'City']);
    const destination = hasPresentImportText(destRaw) ? String(destRaw).trim() : '';

    const shipperRaw = getFieldByAliases(row, ['Shipper', 'Exporter', 'Agency']);
    const shipper = hasPresentImportText(shipperRaw) ? String(shipperRaw).trim() : '';

    const documentsHolderRaw = getFieldByAliases(row, [
      'Documents Holder',
      'Document Holder',
      'Docs Holder',
      'documentsHolder',
    ]);
    const documentsHolder = hasPresentImportText(documentsHolderRaw)
      ? String(documentsHolderRaw).trim()
      : '';

    const packingDate = normalizeDateString(
      getFieldByAliases(row, ['Date', 'Packing Date', 'PackingDate', 'From Date'])
    );
    const itemRaw = getFieldByAliases(row, ['Item', 'Grade', 'Export Item']);
    const item = hasPresentImportText(itemRaw) ? String(itemRaw).trim() : '';

    const boxCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['Box', 'Total Box', 'TotalBox', 'Boxes', 'Cartons'])
    );
    const totalWeightCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['Total Weight (KG)', 'TotalWeight', 'Total Weight'])
    );
    const weightPerBoxCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['Weight', 'Weight Per Box (KG)', 'WeightPerBox'])
    );
    const totalValueRmbCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['Total Value (RMB)', 'TotalValue', 'Total Amount', 'Amount'])
    );
    const rateCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['Rate', 'Rate (RMB)', 'Unit Rate'])
    );
    const rmbRateCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['RMB Rate', 'RmbRate', 'Exchange Rate'])
    );

    const pendingFields: string[] = [];
    const rawValues: Record<string, string> = {};

    if (boxCheck.status === 'unreadable') {
      pendingFields.push('totalBox');
      rawValues.box = boxCheck.rawText;
      rawValues.totalBox = boxCheck.rawText;
    }
    if (totalWeightCheck.status === 'unreadable' || weightPerBoxCheck.status === 'unreadable') {
      pendingFields.push('totalWeight');
      if (weightPerBoxCheck.status === 'unreadable') {
        rawValues.weight = weightPerBoxCheck.rawText;
      }
      rawValues.totalWeight =
        totalWeightCheck.status === 'unreadable'
          ? totalWeightCheck.rawText
          : weightPerBoxCheck.rawText;
    }
    if (rateCheck.status === 'unreadable') {
      pendingFields.push('totalAmount');
      rawValues.rate = rateCheck.rawText;
      rawValues.totalAmount = rateCheck.rawText;
    }
    if (totalValueRmbCheck.status === 'unreadable') {
      if (!pendingFields.includes('totalAmount')) pendingFields.push('totalAmount');
      rawValues.totalAmount = totalValueRmbCheck.rawText;
    }
    if (rmbRateCheck.status === 'unreadable') {
      pendingFields.push('rmbRate');
      rawValues.rmbRate = rmbRateCheck.rawText;
    }

    if (item.startsWith('=')) rawValues.item = item;
    if (mark.startsWith('=')) rawValues.shippingMark = mark;
    if (flight.startsWith('=')) rawValues.flight = flight;
    if (destination.startsWith('=')) rawValues.destination = destination;
    if (shipper.startsWith('=')) rawValues.shipper = shipper;
    if (documentsHolder.startsWith('=')) rawValues.documentsHolder = documentsHolder;

    const calculationPending = pendingFields.length > 0;
    const box = boxCheck.numericValue;
    const weight =
      weightPerBoxCheck.status === 'number'
        ? weightPerBoxCheck.numericValue
        : totalWeightCheck.status === 'number' && box !== 0
        ? Math.round((totalWeightCheck.numericValue / box) * 100) / 100
        : 0;

    let rate = rateCheck.numericValue;
    const computedWeight =
      weightPerBoxCheck.status === 'blank' && totalWeightCheck.status === 'number'
        ? totalWeightCheck.numericValue
        : Math.round(box * weight * 100) / 100;

    if (
      rateCheck.status !== 'unreadable' &&
      rate === 0 &&
      totalValueRmbCheck.status === 'number' &&
      computedWeight !== 0
    ) {
      rate = Math.round((totalValueRmbCheck.numericValue / computedWeight) * 100) / 100;
    }

    const rmbRate = rmbRateCheck.status === 'number' ? rmbRateCheck.numericValue : undefined;
    const explicitInvoiceRaw = getFieldByAliases(row, [
      'Packing List No',
      'PackingListNo',
      'Invoice No',
      'InvoiceNo',
      'Packing No',
    ]);
    const explicitInvoiceNumber = hasPresentImportText(explicitInvoiceRaw)
      ? String(explicitInvoiceRaw).trim()
      : '';
    const statusRaw = getFieldByAliases(row, ['Status', 'Payment Status', 'Exporter Status']);
    const status = hasPresentImportText(statusRaw) ? String(statusRaw).trim() : 'NO REPORT';
    const remarksRaw = getFieldByAliases(row, ['Remarks', 'Notes']);
    const remarks = hasPresentImportText(remarksRaw)
      ? String(remarksRaw).trim()
      : 'Imported from Excel/CSV';
    if (packingDate.startsWith('=')) rawValues.packingDate = packingDate;
    if (explicitInvoiceNumber.startsWith('=')) rawValues.invoiceNumber = explicitInvoiceNumber;
    if (status.startsWith('=')) rawValues.paymentStatus = status;
    if (remarks.startsWith('=')) rawValues.remarks = remarks;

    const itemsBreakdownRaw = getFieldByAliases(row, ['Items Breakdown', 'ItemsBreakdown']);
    const itemsBreakdownStr = hasPresentImportText(itemsBreakdownRaw)
      ? String(itemsBreakdownRaw).trim()
      : '';

    const breakdownItems = parsePackingItemsBreakdown(itemsBreakdownStr, idx);
    let rowItems: PackingItemRow[];
    if (breakdownItems.length > 0) {
      rowItems = breakdownItems;
    } else {
      const effectiveTotalWeight =
        weightPerBoxCheck.status === 'blank' && totalWeightCheck.status === 'number'
          ? totalWeightCheck.numericValue
          : Math.round(box * weight * 100) / 100;
      const computedAmount = calculationPending
        ? totalValueRmbCheck.status === 'number'
          ? totalValueRmbCheck.numericValue
          : 0
        : Math.round(effectiveTotalWeight * rate * 100) / 100;

      rowItems = [
        {
          id: `pki-imp-${Date.now()}-${idx}`,
          item,
          box,
          weight,
          totalWeight: calculationPending ? 0 : effectiveTotalWeight,
          unit: 'KG',
          rate,
          amount: computedAmount,
        },
      ];
    }

    const totals = calculatePackingTotals(rowItems);
    const totalAmountBDT =
      !calculationPending && rmbRate !== undefined
        ? Math.round(totals.totalAmount * rmbRate * 100) / 100
        : undefined;

    rawRecords.push({
      invoiceNumber: explicitInvoiceNumber,
      shippingMark: mark,
      flight,
      destination,
      shipper,
      documentsHolder,
      packingDate,
      fromDate: packingDate,
      toDate: packingDate,
      items: rowItems,
      totalBox: totals.totalBox,
      totalWeight: totals.totalWeight,
      totalAmount: totals.totalAmount,
      rmbRate,
      totalAmountBDT,
      paymentStatus: status,
      exporterStatus: status,
      remarks,
      calculationPending,
      pendingFields: pendingFields.length > 0 ? pendingFields : undefined,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    });
  });

  const records = mergePackingRecordsByShipmentGroup(rawRecords, startCount);

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: rawRecords.length,
    pendingCount: records.filter((r) => r.calculationPending).length,
  };
}

/**
 * Parses an array of row objects (from Excel sheet or header-mapped CSV) into PaymentRecords.
 * Accepts numeric names & marks, blanks, negatives, text amounts, literal formulas.
 */
export function parsePaymentsFromRowObjects(
  rows: Record<string, any>[],
  startCount: number = 0
): ParseResult<Omit<PaymentRecord, 'id' | 'createdAt'>> {
  const records: Omit<PaymentRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];
  let count = startCount;

  const populatedRows = rows.filter((row) =>
    Object.values(row || {}).some((v) => hasPresentImportText(v))
  );

  const limitCheck = validateImportLimits({
    dataset: 'payment',
    populatedRows: populatedRows.length,
  });
  if (!limitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [limitCheck.error || 'Row limit exceeded.'],
      totalParsedRows: populatedRows.length,
      pendingCount: 0,
    };
  }

  populatedRows.forEach((row, idx) => {
    const partyRaw = getFieldByAliases(row, ['Party', 'Party / Supplier', 'Supplier', 'Description', 'Mark']);
    const party = hasPresentImportText(partyRaw) ? String(partyRaw).trim() : '';

    const debitCheck = inspectNumericImportCell(
      getFieldByAliases(row, [
        'DebitAmount',
        'Total Amount / Debit',
        'Total Amount',
        'Debit',
      ])
    );
    const creditCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['CreditAmount', 'Credit', 'Balance Amount', 'Balance'])
    );
    const paidAmountCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['Paid Amount', 'PaidAmount'])
    );
    const prevAmountRaw = getFieldByAliases(row, ['Previous Amount', 'PreviousAmount', 'Previous']);
    const prevAmountCheck = inspectNumericImportCell(prevAmountRaw);
    const rmbCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['ReturnRMB', 'Return RMB', 'RMB'])
    );

    const pendingFields: string[] = [];
    const rawValues: Record<string, string> = {};

    if (debitCheck.status === 'unreadable') {
      pendingFields.push('totalAmount');
      rawValues.debitAmount = debitCheck.rawText;
      rawValues.totalAmount = debitCheck.rawText;
    }
    if (creditCheck.status === 'unreadable') {
      pendingFields.push('balance');
      rawValues.creditAmount = creditCheck.rawText;
      rawValues.balance = creditCheck.rawText;
    }
    if (paidAmountCheck.status === 'unreadable') {
      pendingFields.push('paidAmount');
      rawValues.paidAmount = paidAmountCheck.rawText;
    }
    if (prevAmountCheck.status === 'unreadable') {
      pendingFields.push('previousAmount');
      rawValues.previousAmount = prevAmountCheck.rawText;
    }
    if (rmbCheck.status === 'unreadable') {
      pendingFields.push('returnRMB');
      rawValues.returnRMB = rmbCheck.rawText;
    }
    if (party.startsWith('=')) rawValues.description = party;

    const calculationPending = pendingFields.length > 0;
    const debitAmount = debitCheck.numericValue;
    const creditAmount = creditCheck.numericValue;
    const returnRMB = rmbCheck.numericValue;

    const date = normalizeDateString(getFieldByAliases(row, ['Date', 'Payment Date', 'Voucher Date']));
    const statusRaw = getFieldByAliases(row, ['Status', 'Payment Status']);
    const status = hasPresentImportText(statusRaw) ? String(statusRaw).trim() : 'PAID';
    const exportRefRaw = getFieldByAliases(row, ['ExportRef', 'Export Goods Ref', 'ExportGoodsRef', 'Ref']);
    const exportGoodsRef = hasPresentImportText(exportRefRaw) ? String(exportRefRaw).trim() : '';
    const shippingMarkRaw = getFieldByAliases(row, ['Shipping Mark', 'ShippingMark']);
    const shippingMark = hasPresentImportText(shippingMarkRaw) ? String(shippingMarkRaw).trim() : '';
    const contactRaw = getFieldByAliases(row, ['Contact Number', 'ContactNumber', 'Contact']);
    const contactNumber = hasPresentImportText(contactRaw) ? String(contactRaw).trim() : '';
    const invoiceRaw = getFieldByAliases(row, [
      'Payment Voucher No',
      'PaymentNo',
      'Invoice No',
      'InvoiceNumber',
      'Voucher No',
      'VoucherNo',
    ]);
    const invoiceNumber = hasPresentImportText(invoiceRaw)
      ? String(invoiceRaw).trim()
      : generateInvoiceNumber('PAY', count);

    const categoryRaw = String(getFieldByAliases(row, ['Category', 'PaymentCategory', 'Type']) || '').toLowerCase();
    const paymentCategory: 'supplier' | 'exporter' =
      categoryRaw === 'exporter' || returnRMB > 0 ? 'exporter' : 'supplier';
    const remarksRaw = getFieldByAliases(row, ['Remarks', 'Notes']);
    const remarks = hasPresentImportText(remarksRaw)
      ? String(remarksRaw).trim()
      : 'Imported from Excel/CSV';
    if (date.startsWith('=')) rawValues.date = date;
    if (status.startsWith('=')) rawValues.status = status;
    if (exportGoodsRef.startsWith('=')) rawValues.exportGoodsRef = exportGoodsRef;
    if (shippingMark.startsWith('=')) rawValues.shippingMark = shippingMark;
    if (contactNumber.startsWith('=')) rawValues.contactNumber = contactNumber;
    if (invoiceNumber.startsWith('=')) rawValues.invoiceNumber = invoiceNumber;
    if (remarks.startsWith('=')) rawValues.remarks = remarks;

    count++;

    const itemRow: PaymentItemRow = {
      id: `pyi-imp-${Date.now()}-${idx}`,
      description: party ? `Payment for ${party}` : 'Payment Entry',
      debitAmount,
      creditAmount,
      balance: calculationPending ? 0 : calculatePaymentRow(debitAmount, creditAmount),
    };

    const paidAmount =
      paidAmountCheck.status === 'number'
        ? paidAmountCheck.numericValue
        : calculationPending
        ? 0
        : debitAmount - creditAmount;
    const previousAmount =
      prevAmountCheck.status === 'number' ? prevAmountCheck.numericValue : debitAmount;

    records.push({
      invoiceNumber,
      date,
      description: party,
      contactNumber,
      items: [itemRow],
      totalAmount: debitAmount,
      previousAmount,
      paidAmount,
      balance: creditAmount,
      status,
      returnRMB,
      returnRMBInBDT: calculationPending ? 0 : Math.round(returnRMB * 16.5 * 100) / 100,
      exportGoodsRef,
      shippingMark: shippingMark || undefined,
      paymentCategory,
      remarks,
      calculationPending,
      pendingFields: pendingFields.length > 0 ? pendingFields : undefined,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    });
  });

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
    pendingCount: records.filter((r) => r.calculationPending).length,
  };
}

/**
 * Parses an array of row objects into OtherCostRecords.
 * Enforces compact 5,000 populated rows guard and preserves unreadable amounts/formulas cleanly.
 */
export function parseOtherCostsFromRowObjects(
  rows: Record<string, any>[]
): ParseResult<Omit<OtherCostRecord, 'id' | 'createdAt'>> {
  const records: Omit<OtherCostRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  const populatedRows = rows.filter((row) =>
    Object.values(row || {}).some((v) => hasPresentImportText(v))
  );

  const limitCheck = validateImportLimits({
    dataset: 'other_cost',
    populatedRows: populatedRows.length,
  });
  if (!limitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [limitCheck.error || 'Row limit exceeded.'],
      totalParsedRows: populatedRows.length,
      pendingCount: 0,
    };
  }

  populatedRows.forEach((row) => {
    const catRaw = getFieldByAliases(row, [
      'Category',
      'Cost Category',
      'Expense Category',
      'Expense Head',
      'Type',
    ]);
    const category = hasPresentImportText(catRaw) ? String(catRaw).trim() : '';
    const amountCheck = inspectNumericImportCell(
      getFieldByAliases(row, ['Amount', 'Amount (BDT)', 'Amount (TK)', 'BDT', 'TK', 'Cost', 'Total'])
    );

    const pendingFields: string[] = [];
    const rawValues: Record<string, string> = {};
    if (amountCheck.status === 'unreadable') {
      pendingFields.push('amount');
      rawValues.amount = amountCheck.rawText;
    }
    if (category.startsWith('=')) rawValues.category = category;

    const date = normalizeDateString(getFieldByAliases(row, ['Date', 'Expense Date', 'Tarikh']));
    const descRaw = getFieldByAliases(row, [
      'Description',
      'Particulars',
      'Particulars / Expense Details',
      'Expense Details',
      'Details',
      'Remarks',
      'Notes',
    ]);
    const description = hasPresentImportText(descRaw)
      ? String(descRaw).trim()
      : category || 'Operating Expense';
    if (description.startsWith('=')) rawValues.description = description;

    const methodRaw = getFieldByAliases(row, [
      'Payment Method',
      'PaymentMethod',
      'Method',
      'Paid Via',
      'Mode',
    ]);
    const paymentMethod = hasPresentImportText(methodRaw) ? String(methodRaw).trim() : '';
    if (paymentMethod.startsWith('=')) rawValues.paymentMethod = paymentMethod;

    const paidByRaw = getFieldByAliases(row, [
      'Paid By',
      'PaidBy',
      'Paid By / Receiver',
      'Receiver',
      'Staff',
    ]);
    const paidBy = hasPresentImportText(paidByRaw) ? String(paidByRaw).trim() : '';
    if (paidBy.startsWith('=')) rawValues.paidBy = paidBy;

    const refRaw = getFieldByAliases(row, [
      'Reference Invoice',
      'RefInvoice',
      'Voucher No',
      'Voucher / Slip No',
      'Slip No',
      'Ref',
      'Invoice No',
    ]);
    const refInvoice = hasPresentImportText(refRaw) ? String(refRaw).trim() : '';
    if (date.startsWith('=')) rawValues.date = date;
    if (refInvoice.startsWith('=')) rawValues.refInvoice = refInvoice;

    records.push({
      date,
      category: category || 'OTHER COSTING',
      amount: amountCheck.numericValue,
      description,
      paymentMethod: paymentMethod || undefined,
      paidBy: paidBy || undefined,
      refInvoice: refInvoice || undefined,
      calculationPending: pendingFields.length > 0,
      pendingFields: pendingFields.length > 0 ? pendingFields : undefined,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    });
  });

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
    pendingCount: records.filter((r) => r.calculationPending).length,
  };
}

/**
 * Smart text parser that supports:
 * 1. Exported CSV files with headers (e.g. "Invoice No,Date,Supplier / Description...")
 * 2. Tab-separated lines pasted directly from Microsoft Excel (Ctrl+C -> Ctrl+V)
 * 3. Standard Quick-Entry CSV lines
 * Stores formula expressions (=...) as literal text.
 */
export function parseSmartTextData(
  type: DatasetKey,
  rawText: string,
  startCount: number = 0
): ParseResult<any> {
  const cleanedText = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleanedText) {
    return { success: false, records: [], errors: [], totalParsedRows: 0, pendingCount: 0 };
  }

  const lines = cleanedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { success: false, records: [], errors: [], totalParsedRows: 0, pendingCount: 0 };
  }

  const firstLine = lines[0];
  const isTabSeparated = firstLine.includes('\t');
  const splitLine = (line: string): string[] =>
    isTabSeparated ? line.split('\t').map((c) => c.trim()) : splitCsvLine(line);

  const firstRowCells = splitLine(firstLine);
  const firstRowNormalized = firstRowCells.map(normalizeKey);

  const exportedHeaderMarkers = [
    'invoiceno',
    'packinglistno',
    'paymentvoucherno',
    'supplierdescription',
    'totalamountbdt',
    'totalvaluermb',
    'partysupplier',
    'amountbdt',
    'referenceinvoice',
    'rmbrate',
    'weightperboxkg',
    'ratermb',
    'itemsbreakdown',
  ];
  const hasExportedHeaders = firstRowNormalized.some((h) => exportedHeaderMarkers.includes(h));

  if (hasExportedHeaders || type === 'other_cost') {
    const hasHeaderRow =
      hasExportedHeaders ||
      firstRowNormalized.some((h) =>
        [
          'date',
          'expensedate',
          'category',
          'expensecategory',
          'amount',
          'amounttk',
          'particulars',
          'paymentmethod',
          'supplier',
          'shippingmark',
          'party',
        ].includes(h)
      );

    const headers = hasHeaderRow ? firstRowCells : getTemplateHeaders(type);
    const dataLines = hasHeaderRow ? lines.slice(1) : lines;

    const rowObjects: Record<string, any>[] = dataLines.map((line) => {
      const cells = splitLine(line);
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        obj[h] = cells[i] ?? '';
      });
      return obj;
    });

    if (type === 'purchase') return parsePurchasesFromRowObjects(rowObjects, startCount);
    if (type === 'packing') return parsePackingsFromRowObjects(rowObjects, startCount);
    if (type === 'payment') return parsePaymentsFromRowObjects(rowObjects, startCount);
    return parseOtherCostsFromRowObjects(rowObjects);
  }

  const normalizedCsvText = isTabSeparated
    ? lines.map((l) => splitLine(l).map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n')
    : cleanedText;

  if (type === 'purchase') return parsePurchasesCSV(normalizedCsvText, startCount);
  if (type === 'packing') return parsePackingsCSV(normalizedCsvText, startCount);
  return parsePaymentsCSV(normalizedCsvText, startCount);
}

/**
 * Parses an uploaded Excel (.xlsx / .xls) or CSV binary buffer.
 * Preserves Excel cell formulas (`cell.f`) as literal text strings and enforces size/row guards.
 */
export function parseExcelOrCsvBuffer(
  buffer: ArrayBuffer | Uint8Array,
  targetType: DatasetKey,
  startCount: number = 0
): ParseResult<any> {
  const byteLength = buffer instanceof Uint8Array ? buffer.byteLength : buffer.byteLength;
  const fileLimitCheck = validateImportLimits({
    dataset: targetType,
    populatedRows: 0,
    fileSizeBytes: byteLength,
  });
  if (!fileLimitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [fileLimitCheck.error || 'File limit exceeded.'],
      totalParsedRows: 0,
      pendingCount: 0,
    };
  }

  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return {
      success: false,
      records: [],
      errors: ['No sheets found in the uploaded workbook.'],
      totalParsedRows: 0,
      pendingCount: 0,
    };
  }

  const targetSheetName =
    wb.SheetNames.find((name) => {
      const n = normalizeKey(name);
      if (targetType === 'purchase' && n.includes('purchase')) return true;
      if (targetType === 'packing' && (n.includes('packing') || n.includes('export'))) return true;
      if (targetType === 'payment' && n.includes('payment')) return true;
      if (targetType === 'other_cost' && (n.includes('cost') || n.includes('expense') || n.includes('daily'))) return true;
      return false;
    }) || wb.SheetNames[0];

  const ws = wb.Sheets[targetSheetName];
  const rowObjects = extractWorksheetRowObjectsWithLiteralFormulas(ws);

  if (rowObjects.length === 0) {
    return {
      success: false,
      records: [],
      errors: [`Sheet "${targetSheetName}" contains no data rows.`],
      totalParsedRows: 0,
      pendingCount: 0,
    };
  }

  const firstRowKeys = Object.keys(rowObjects[0]).map(normalizeKey);
  const recognizableHeaders = [
    'supplier',
    'invoiceno',
    'supplierdescription',
    'shippingmark',
    'packinglistno',
    'party',
    'partysupplier',
    'paymentvoucherno',
    'category',
    'expensecategory',
    'expensedate',
    'amount',
    'amountbdt',
    'amounttk',
    'particulars',
    'paymentmethod',
  ];
  const isHeaderMapped = firstRowKeys.some((k) => recognizableHeaders.includes(k));

  if (isHeaderMapped) {
    if (targetType === 'purchase') return parsePurchasesFromRowObjects(rowObjects, startCount);
    if (targetType === 'packing') return parsePackingsFromRowObjects(rowObjects, startCount);
    if (targetType === 'payment') return parsePaymentsFromRowObjects(rowObjects, startCount);
    return parseOtherCostsFromRowObjects(rowObjects);
  }

  const matrix = extractWorksheetTextMatrixWithLiteralFormulas(ws);
  const csvStr = matrix
    .map((cells) => cells.map((c) => (c.includes(',') ? `"${c}"` : c)).join(','))
    .join('\n');
  return parseSmartTextData(targetType, csvStr, startCount);
}

/**
 * Parses all matching sheets from a multi-sheet Master Excel Workbook (.xlsx),
 * preserving cell formulas as literal text strings.
 */
export function parseMasterWorkbookBuffer(
  buffer: ArrayBuffer | Uint8Array,
  counts: { purchases?: number; packings?: number; payments?: number } = {}
): MultiSheetImportResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const emptyResult = { success: false, records: [], errors: [], totalParsedRows: 0, pendingCount: 0 };
  const result: MultiSheetImportResult = {
    purchases: { ...emptyResult },
    packings: { ...emptyResult },
    payments: { ...emptyResult },
    otherCosts: { ...emptyResult },
    detectedSheets: wb.SheetNames || [],
  };

  for (const sheetName of wb.SheetNames || []) {
    const n = normalizeKey(sheetName);
    const ws = wb.Sheets[sheetName];
    const rowObjects = extractWorksheetRowObjectsWithLiteralFormulas(ws);
    if (rowObjects.length === 0) continue;

    if (n.includes('purchase') || n.includes('challan')) {
      result.purchases = parsePurchasesFromRowObjects(rowObjects, counts.purchases || 0);
    } else if (n.includes('packing') || n.includes('export') || n.includes('manifest')) {
      result.packings = parsePackingsFromRowObjects(rowObjects, counts.packings || 0);
    } else if (n.includes('payment') || n.includes('voucher')) {
      result.payments = parsePaymentsFromRowObjects(rowObjects, counts.payments || 0);
    } else if (n.includes('cost') || n.includes('expense') || n.includes('daily')) {
      result.otherCosts = parseOtherCostsFromRowObjects(rowObjects);
    }
  }

  return result;
}

/**
 * High-level helper to export any dataset as either .xlsx or .csv
 */
export function exportDatasetFile(
  type: DatasetKey,
  format: 'xlsx' | 'csv',
  records: any[],
  customFilename?: string
): string {
  const today = new Date().toISOString().slice(0, 10);
  const labelMap: Record<DatasetKey, string> = {
    purchase: 'Purchases',
    packing: 'Packing_Lists',
    payment: 'Payments',
    other_cost: 'Other_Costs',
  };
  const baseName = customFilename || `ZSB_Aquatics_${labelMap[type]}_${today}`;

  if (format === 'xlsx') {
    const buffer = generateSingleSheetWorkbookBuffer(type, records);
    const filename = baseName.endsWith('.xlsx') ? baseName : `${baseName}.xlsx`;
    downloadExcelBuffer(buffer, filename);
    return filename;
  } else {
    let csv = '';
    if (type === 'purchase') csv = generatePurchasesCSV(records as PurchaseRecord[]);
    else if (type === 'packing') csv = generatePackingsCSV(records as PackingRecord[]);
    else if (type === 'payment') csv = generatePaymentsCSV(records as PaymentRecord[]);
    else csv = generateOtherCostsCSV(records as OtherCostRecord[]);

    const filename = baseName.endsWith('.csv') ? baseName : `${baseName}.csv`;
    downloadCsvFile(csv, filename);
    return filename;
  }
}
