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
  buildPackingShipmentGroupKey,
  mergePackingRecordsByShipmentGroup,
  ParseResult,
} from './csvParser.ts';

export { buildPackingShipmentGroupKey, mergePackingRecordsByShipmentGroup };

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
    'Reference Invoice',
  ];

  const rows = records.map((c) => [
    c.date || '',
    c.category || '',
    c.amount || 0,
    c.description || '',
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
  return ['Date', 'Category', 'Amount', 'Description', 'RefInvoice'];
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
        InvoiceNo: 'PUR-2026-0101',
        Remarks: 'Sample Purchase Challan',
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
        InvoiceNo: 'PUR-2026-0102',
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
      Category: 'AIR FREIGHT / CARGO BILL',
      Amount: 18500,
      Description: 'Airport cargo handling & ice packing',
      RefInvoice: 'PKG-2026-0101',
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
 * Parses an array of row objects (from Excel sheet or header-mapped CSV) into PurchaseRecords.
 */
export function parsePurchasesFromRowObjects(
  rows: Record<string, any>[],
  startCount: number = 0
): ParseResult<Omit<PurchaseRecord, 'id' | 'createdAt'>> {
  const records: Omit<PurchaseRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];
  let count = startCount;

  rows.forEach((row, idx) => {
    const supplier =
      getFieldByAliases(row, ['Supplier', 'Supplier / Description', 'Description', 'Party', 'Vendor']) ||
      'ABDULLAH VAI';
    const date = normalizeDateString(getFieldByAliases(row, ['Date', 'Purchase Date', 'Invoice Date']));
    const item = String(getFieldByAliases(row, ['Item', 'Grade', 'Product']) || 'F1').trim();
    const quantity = parseNumberSafe(
      getFieldByAliases(row, ['Quantity', 'Total Quantity', 'Qty', 'TotalQty', 'Weight']),
      0
    );
    const totalAmountRaw = parseNumberSafe(
      getFieldByAliases(row, ['Total Amount', 'TotalAmount', 'Amount']),
      0
    );
    let rate = parseNumberSafe(getFieldByAliases(row, ['Rate', 'Unit Rate', 'Price']), 0);
    if (rate <= 0 && quantity > 0 && totalAmountRaw > 0) {
      rate = Math.round((totalAmountRaw / quantity) * 100) / 100;
    }

    if (quantity <= 0 && totalAmountRaw <= 0) {
      errors.push(`Row ${idx + 1}: Quantity or Total Amount must be greater than 0.`);
      return;
    }

    const effectiveQty = quantity > 0 ? quantity : 1;
    const effectiveRate = rate > 0 ? rate : totalAmountRaw;
    const previousAmount = parseNumberSafe(
      getFieldByAliases(row, ['Previous Amount', 'PreviousAmount', 'Previous', 'PrevBalance']),
      0
    );
    const paidAmount = parseNumberSafe(
      getFieldByAliases(row, ['Paid Amount', 'PaidAmount', 'Paid']),
      0
    );
    const contactNumber = String(
      getFieldByAliases(row, ['Contact Number', 'ContactNumber', 'Contact', 'Phone', 'Mobile']) || ''
    ).trim();
    const invoiceNumber = String(
      getFieldByAliases(row, ['Invoice No', 'InvoiceNo', 'Invoice Number', 'InvoiceNumber', 'Doc No']) ||
        generateInvoiceNumber('PUR', count)
    ).trim();
    const remarks = String(getFieldByAliases(row, ['Remarks', 'Notes', 'Comment']) || 'Imported from Excel/CSV').trim();

    count++;

    const itemRow: PurchaseItemRow = {
      id: `pi-imp-${Date.now()}-${idx}`,
      item,
      quantity: effectiveQty,
      rate: effectiveRate,
      totalAmount: calculatePurchaseRowTotal(effectiveQty, effectiveRate),
      previousAmount: 0,
      paidAmount: 0,
      balance: 0,
    };

    const totals = calculatePurchaseTotals([itemRow], previousAmount, paidAmount);

    records.push({
      invoiceNumber,
      date,
      description: String(supplier).trim(),
      contactNumber,
      items: [itemRow],
      totalQty: totals.totalQty,
      totalAmount: totals.totalAmount,
      previousAmount: totals.previousAmount,
      paidAmount: totals.paidAmount,
      balance: totals.balance,
      remarks,
    });
  });

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
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
      /^([^:]+):\s*([\d.]+)\s*box,\s*([\d.]+)\s*kg,\s*Tot\s*([\d.]+)\s*kg\s*@\s*([\d.]+)/i
    );
    if (!match) return [];
    const item = match[1].trim() || '2F';
    const box = parseFloat(match[2]) || 1;
    const weight = parseFloat(match[3]) || 15;
    const rate = parseFloat(match[5]) || 350;
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
 * Rows sharing the same ShippingMark, Flight, Destination, Shipper, and Date
 * are automatically merged into 1 PackingRecord with a single invoice & packing number.
 */
export function parsePackingsFromRowObjects(
  rows: Record<string, any>[],
  startCount: number = 0
): ParseResult<Omit<PackingRecord, 'id' | 'createdAt'>> {
  const rawRecords: Omit<PackingRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const shippingMark = String(
      getFieldByAliases(row, ['Shipping Mark', 'ShippingMark', 'Mark']) || ''
    ).trim();
    const totalBoxRaw = parseNumberSafe(
      getFieldByAliases(row, ['Box', 'Total Box', 'TotalBox', 'Boxes', 'Cartons']),
      0
    );
    const totalWeightRaw = parseNumberSafe(
      getFieldByAliases(row, ['Total Weight (KG)', 'TotalWeight', 'Total Weight']),
      0
    );
    const weightPerBoxRaw = parseNumberSafe(
      getFieldByAliases(row, ['Weight', 'Weight Per Box (KG)', 'WeightPerBox']),
      0
    );

    if (!shippingMark && totalBoxRaw <= 0 && totalWeightRaw <= 0 && weightPerBoxRaw <= 0) {
      errors.push(`Row ${idx + 1}: Missing Shipping Mark and Box/Weight values.`);
      return;
    }

    const mark = shippingMark || 'AAD';
    const flight = String(getFieldByAliases(row, ['Flight', 'Airline']) || 'CAN').trim();
    const destination = String(getFieldByAliases(row, ['Destination', 'Dest', 'City']) || 'GUANGZHOU').trim();
    const shipper = String(getFieldByAliases(row, ['Shipper', 'Exporter', 'Agency']) || 'ZSB AQUATICS').trim();
    const packingDate = normalizeDateString(
      getFieldByAliases(row, ['Date', 'Packing Date', 'PackingDate', 'From Date'])
    );
    const item = String(getFieldByAliases(row, ['Item', 'Grade', 'Export Item']) || '2F').trim();

    const box = totalBoxRaw > 0 ? totalBoxRaw : 1;
    const weight =
      weightPerBoxRaw > 0
        ? weightPerBoxRaw
        : totalWeightRaw > 0 && box > 0
        ? Math.round((totalWeightRaw / box) * 100) / 100
        : 15;

    const totalValueRmbRaw = parseNumberSafe(
      getFieldByAliases(row, ['Total Value (RMB)', 'TotalValue', 'Total Amount', 'Amount']),
      0
    );
    let rate = parseNumberSafe(getFieldByAliases(row, ['Rate', 'Rate (RMB)', 'Unit Rate']), 0);
    const computedWeight = Math.round(box * weight * 100) / 100;
    if (rate <= 0 && totalValueRmbRaw > 0 && computedWeight > 0) {
      rate = Math.round((totalValueRmbRaw / computedWeight) * 100) / 100;
    }
    if (rate <= 0) rate = 350;

    const rmbRate = parseNumberSafe(getFieldByAliases(row, ['RMB Rate', 'RmbRate', 'Exchange Rate']), 0);
    const explicitInvoiceNumber = String(
      getFieldByAliases(row, ['Packing List No', 'PackingListNo', 'Invoice No', 'InvoiceNo', 'Packing No']) || ''
    ).trim();
    const status = String(
      getFieldByAliases(row, ['Status', 'Payment Status', 'Exporter Status']) || 'NO REPORT'
    ).trim();
    const remarks = String(getFieldByAliases(row, ['Remarks', 'Notes']) || 'Imported from Excel/CSV').trim();
    const itemsBreakdownStr = String(
      getFieldByAliases(row, ['Items Breakdown', 'ItemsBreakdown']) || ''
    ).trim();

    const breakdownItems = parsePackingItemsBreakdown(itemsBreakdownStr, idx);
    let rowItems: PackingItemRow[];
    if (breakdownItems.length > 0) {
      rowItems = breakdownItems;
    } else {
      const itemCalcs = calculatePackingRow(box, weight, rate);
      rowItems = [
        {
          id: `pki-imp-${Date.now()}-${idx}`,
          item,
          box,
          weight,
          totalWeight: itemCalcs.totalWeight,
          unit: 'KG',
          rate,
          amount: itemCalcs.amount,
        },
      ];
    }

    const totals = calculatePackingTotals(rowItems);
    const totalAmountBDT = rmbRate > 0 ? Math.round(totals.totalAmount * rmbRate * 100) / 100 : undefined;

    rawRecords.push({
      invoiceNumber: explicitInvoiceNumber,
      shippingMark: mark,
      flight,
      destination,
      shipper,
      packingDate,
      fromDate: packingDate,
      toDate: packingDate,
      items: rowItems,
      totalBox: totals.totalBox,
      totalWeight: totals.totalWeight,
      totalAmount: totals.totalAmount,
      rmbRate: rmbRate > 0 ? rmbRate : undefined,
      totalAmountBDT,
      paymentStatus: status,
      exporterStatus: status,
      remarks,
    });
  });

  const records = mergePackingRecordsByShipmentGroup(rawRecords, startCount);

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: rawRecords.length,
  };
}

/**
 * Parses an array of row objects (from Excel sheet or header-mapped CSV) into PaymentRecords.
 */
export function parsePaymentsFromRowObjects(
  rows: Record<string, any>[],
  startCount: number = 0
): ParseResult<Omit<PaymentRecord, 'id' | 'createdAt'>> {
  const records: Omit<PaymentRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];
  let count = startCount;

  rows.forEach((row, idx) => {
    const party = String(
      getFieldByAliases(row, ['Party', 'Party / Supplier', 'Supplier', 'Description', 'Mark']) || ''
    ).trim();
    const debitAmount = parseNumberSafe(
      getFieldByAliases(row, [
        'DebitAmount',
        'Total Amount / Debit',
        'Total Amount',
        'Debit',
        'Paid Amount',
        'PaidAmount',
      ]),
      0
    );
    const creditAmount = parseNumberSafe(
      getFieldByAliases(row, ['CreditAmount', 'Credit', 'Balance Amount', 'Balance']),
      0
    );

    if (!party && debitAmount <= 0 && creditAmount <= 0) {
      errors.push(`Row ${idx + 1}: Missing Party name and payment amounts.`);
      return;
    }

    const effectiveParty = party || 'ABDULLAH VAI';
    const date = normalizeDateString(getFieldByAliases(row, ['Date', 'Payment Date', 'Voucher Date']));
    const status = String(getFieldByAliases(row, ['Status', 'Payment Status']) || 'PAID').trim();
    const returnRMB = parseNumberSafe(getFieldByAliases(row, ['ReturnRMB', 'Return RMB', 'RMB']), 0);
    const exportGoodsRef = String(
      getFieldByAliases(row, ['ExportRef', 'Export Goods Ref', 'ExportGoodsRef', 'Ref']) || ''
    ).trim();
    const contactNumber = String(
      getFieldByAliases(row, ['Contact Number', 'ContactNumber', 'Contact']) || ''
    ).trim();
    const invoiceNumber = String(
      getFieldByAliases(row, ['Payment Voucher No', 'PaymentNo', 'Invoice No', 'Voucher No']) ||
        generateInvoiceNumber('PAY', count)
    ).trim();
    const categoryRaw = String(getFieldByAliases(row, ['Category', 'PaymentCategory', 'Type']) || '').toLowerCase();
    const paymentCategory: 'supplier' | 'exporter' =
      categoryRaw === 'exporter' || returnRMB > 0 ? 'exporter' : 'supplier';
    const remarks = String(getFieldByAliases(row, ['Remarks', 'Notes']) || 'Imported from Excel/CSV').trim();

    count++;

    const itemRow: PaymentItemRow = {
      id: `pyi-imp-${Date.now()}-${idx}`,
      description: `Payment for ${effectiveParty}`,
      debitAmount,
      creditAmount,
      balance: calculatePaymentRow(debitAmount, creditAmount),
    };

    const paidAmountField = getFieldByAliases(row, ['Paid Amount', 'PaidAmount']);
    const paidAmount =
      paidAmountField !== undefined ? parseNumberSafe(paidAmountField, debitAmount - creditAmount) : debitAmount - creditAmount;

    records.push({
      invoiceNumber,
      date,
      description: effectiveParty,
      contactNumber,
      items: [itemRow],
      totalAmount: debitAmount,
      previousAmount: debitAmount,
      paidAmount,
      balance: creditAmount,
      status,
      returnRMB,
      returnRMBInBDT: Math.round(returnRMB * 16.5 * 100) / 100,
      exportGoodsRef,
      paymentCategory,
      remarks,
    });
  });

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
  };
}

/**
 * Parses an array of row objects into OtherCostRecords.
 */
export function parseOtherCostsFromRowObjects(
  rows: Record<string, any>[]
): ParseResult<Omit<OtherCostRecord, 'id' | 'createdAt'>> {
  const records: Omit<OtherCostRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const category = String(
      getFieldByAliases(row, ['Category', 'Cost Category', 'Expense Category', 'Type']) || ''
    ).trim();
    const amount = parseNumberSafe(
      getFieldByAliases(row, ['Amount', 'Amount (BDT)', 'Cost', 'Total']),
      0
    );

    if (!category && amount <= 0) {
      errors.push(`Row ${idx + 1}: Missing Category or Amount.`);
      return;
    }

    const date = normalizeDateString(getFieldByAliases(row, ['Date', 'Expense Date']));
    const description = String(
      getFieldByAliases(row, ['Description', 'Details', 'Remarks', 'Notes']) || category || 'Operating Expense'
    ).trim();
    const refInvoice = String(
      getFieldByAliases(row, ['Reference Invoice', 'RefInvoice', 'Ref', 'Invoice No']) || ''
    ).trim();

    records.push({
      date,
      category: category || 'OTHER COSTING',
      amount,
      description,
      refInvoice: refInvoice || undefined,
    });
  });

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
  };
}

/**
 * Smart text parser that supports:
 * 1. Exported CSV files with headers (e.g. "Invoice No,Date,Supplier / Description...")
 * 2. Tab-separated lines pasted directly from Microsoft Excel (Ctrl+C -> Ctrl+V)
 * 3. Standard Quick-Entry CSV lines
 */
export function parseSmartTextData(
  type: DatasetKey,
  rawText: string,
  startCount: number = 0
): ParseResult<any> {
  const cleanedText = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleanedText) {
    return { success: false, records: [], errors: [], totalParsedRows: 0 };
  }

  const lines = cleanedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { success: false, records: [], errors: [], totalParsedRows: 0 };
  }

  // Detect if tab-separated (pasted from Excel) or comma-separated
  const firstLine = lines[0];
  const isTabSeparated = firstLine.includes('\t');
  const splitLine = (line: string): string[] =>
    isTabSeparated ? line.split('\t').map((c) => c.trim()) : splitCsvLine(line);

  const firstRowCells = splitLine(firstLine);
  const firstRowNormalized = firstRowCells.map(normalizeKey);

  // Check if first row looks like an exported header or named header
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
    // Convert lines into row objects keyed by header
    const hasHeaderRow =
      hasExportedHeaders ||
      firstRowNormalized.some((h) =>
        ['date', 'category', 'amount', 'supplier', 'shippingmark', 'party'].includes(h)
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

  // If tab-separated quick-entry paste from Excel, convert tabs to commas for standard CSV parser
  const normalizedCsvText = isTabSeparated
    ? lines.map((l) => splitLine(l).map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n')
    : cleanedText;

  if (type === 'purchase') return parsePurchasesCSV(normalizedCsvText, startCount);
  if (type === 'packing') return parsePackingsCSV(normalizedCsvText, startCount);
  return parsePaymentsCSV(normalizedCsvText, startCount);
}

/**
 * Parses an uploaded Excel (.xlsx / .xls) or CSV binary buffer.
 * Can parse either a targeted dataset type OR auto-detect sheets in a multi-sheet workbook.
 */
export function parseExcelOrCsvBuffer(
  buffer: ArrayBuffer | Uint8Array,
  targetType: DatasetKey,
  startCount: number = 0
): ParseResult<any> {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return {
      success: false,
      records: [],
      errors: ['No sheets found in the uploaded workbook.'],
      totalParsedRows: 0,
    };
  }

  // Try to find a matching sheet name first, otherwise use the first sheet
  const targetSheetName =
    wb.SheetNames.find((name) => {
      const n = normalizeKey(name);
      if (targetType === 'purchase' && n.includes('purchase')) return true;
      if (targetType === 'packing' && (n.includes('packing') || n.includes('export'))) return true;
      if (targetType === 'payment' && n.includes('payment')) return true;
      if (targetType === 'other_cost' && (n.includes('cost') || n.includes('expense'))) return true;
      return false;
    }) || wb.SheetNames[0];

  const ws = wb.Sheets[targetSheetName];
  const rowObjects = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  if (rowObjects.length === 0) {
    return {
      success: false,
      records: [],
      errors: [`Sheet "${targetSheetName}" contains no data rows.`],
      totalParsedRows: 0,
    };
  }

  // Check if the first row has recognizable header keys; if not, fallback to AOA csv conversion
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
    'amount',
    'amountbdt',
  ];
  const isHeaderMapped = firstRowKeys.some((k) => recognizableHeaders.includes(k));

  if (isHeaderMapped) {
    if (targetType === 'purchase') return parsePurchasesFromRowObjects(rowObjects, startCount);
    if (targetType === 'packing') return parsePackingsFromRowObjects(rowObjects, startCount);
    if (targetType === 'payment') return parsePaymentsFromRowObjects(rowObjects, startCount);
    return parseOtherCostsFromRowObjects(rowObjects);
  }

  // Fallback: convert worksheet to CSV and use parseSmartTextData
  const csvStr = XLSX.utils.sheet_to_csv(ws);
  return parseSmartTextData(targetType, csvStr, startCount);
}

/**
 * Parses all matching sheets from a multi-sheet Master Excel Workbook (.xlsx).
 */
export function parseMasterWorkbookBuffer(
  buffer: ArrayBuffer | Uint8Array,
  counts: { purchases?: number; packings?: number; payments?: number } = {}
): MultiSheetImportResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const emptyResult = { success: false, records: [], errors: [], totalParsedRows: 0 };
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
    const rowObjects = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    if (rowObjects.length === 0) continue;

    if (n.includes('purchase') || n.includes('challan')) {
      result.purchases = parsePurchasesFromRowObjects(rowObjects, counts.purchases || 0);
    } else if (n.includes('packing') || n.includes('export') || n.includes('manifest')) {
      result.packings = parsePackingsFromRowObjects(rowObjects, counts.packings || 0);
    } else if (n.includes('payment') || n.includes('voucher')) {
      result.payments = parsePaymentsFromRowObjects(rowObjects, counts.payments || 0);
    } else if (n.includes('cost') || n.includes('expense')) {
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
