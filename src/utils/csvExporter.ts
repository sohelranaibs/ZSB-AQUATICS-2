import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
} from '../types/index.ts';

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
