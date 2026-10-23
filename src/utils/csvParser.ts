import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
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
  calculatePaymentTotals,
  generateInvoiceNumber,
} from './calculations.ts';

export interface ParseResult<T> {
  success: boolean;
  records: T[];
  errors: string[];
  totalParsedRows: number;
}

/**
 * Splits CSV lines safely handling basic quotes and comma separation
 */
export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses CSV lines into PurchaseRecords
 * Expected header or line format:
 * Supplier, Date, Item, Quantity, Rate, [PreviousAmount], [PaidAmount], [ContactNumber], [InvoiceNumber]
 */
export function parsePurchasesCSV(
  csvText: string,
  startCount: number = 0
): ParseResult<Omit<PurchaseRecord, 'id' | 'createdAt'>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const records: Omit<PurchaseRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  // Group items by invoice or create one record per row or group by (Supplier + Date)
  let count = startCount;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment or header line
    if (
      i === 0 &&
      (line.toLowerCase().includes('supplier') ||
        line.toLowerCase().includes('item') ||
        line.toLowerCase().includes('invoice'))
    ) {
      continue;
    }

    const parts = splitCsvLine(line);
    if (parts.length < 5) {
      errors.push(`Row ${i + 1}: Insufficient columns (expected at least Supplier, Date, Item, Quantity, Rate).`);
      continue;
    }

    const supplier = parts[0] || 'ABDULLAH VAI';
    const date = parts[1] || new Date().toISOString().slice(0, 10);
    const item = parts[2] || 'F1';
    const quantity = parseFloat(parts[3]) || 0;
    const rate = parseFloat(parts[4]) || 0;
    const previousAmount = parts[5] ? parseFloat(parts[5]) || 0 : 0;
    const paidAmount = parts[6] ? parseFloat(parts[6]) || 0 : 0;
    const contact = parts[7] || '';
    const invoiceNumber = parts[8] || generateInvoiceNumber('PUR', count);

    if (quantity <= 0) {
      errors.push(`Row ${i + 1}: Quantity must be greater than 0.`);
      continue;
    }

    count++;

    const itemRow: PurchaseItemRow = {
      id: `pi-bulk-${Date.now()}-${i}`,
      item,
      quantity,
      rate,
      totalAmount: calculatePurchaseRowTotal(quantity, rate),
      previousAmount: 0,
      paidAmount: 0,
      balance: 0,
    };

    const totals = calculatePurchaseTotals([itemRow], previousAmount, paidAmount);

    records.push({
      invoiceNumber,
      date,
      description: supplier,
      contactNumber: contact,
      items: [itemRow],
      totalQty: totals.totalQty,
      totalAmount: totals.totalAmount,
      previousAmount: totals.previousAmount,
      paidAmount: totals.paidAmount,
      balance: totals.balance,
      remarks: 'Bulk uploaded via Quick Entry',
    });
  }

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
  };
}

/**
 * Parses CSV lines into PackingRecords
 * Expected header/format:
 * ShippingMark, Flight, Destination, Shipper, Date, Item, Box, Weight, Rate
 */
export function parsePackingsCSV(
  csvText: string,
  startCount: number = 0
): ParseResult<Omit<PackingRecord, 'id' | 'createdAt'>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const records: Omit<PackingRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  let count = startCount;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      i === 0 &&
      (line.toLowerCase().includes('shipping') ||
        line.toLowerCase().includes('flight') ||
        line.toLowerCase().includes('mark'))
    ) {
      continue;
    }

    const parts = splitCsvLine(line);
    if (parts.length < 8) {
      errors.push(`Row ${i + 1}: Expected at least: Mark, Flight, Destination, Shipper, Date, Item, Box, Weight, [Rate]`);
      continue;
    }

    const shippingMark = parts[0] || 'AAD';
    const flight = parts[1] || 'CAN';
    const destination = parts[2] || 'GUANGZHOU';
    const shipper = parts[3] || 'ZSB AQUATICS';
    const packingDate = parts[4] || new Date().toISOString().slice(0, 10);
    const item = parts[5] || '2F';
    const box = parseFloat(parts[6]) || 1;
    const weight = parseFloat(parts[7]) || 15;
    const rate = parts[8] ? parseFloat(parts[8]) || 0 : 350;
    const invoiceNumber = parts[9] || generateInvoiceNumber('PKG', count);

    count++;

    const itemCalcs = calculatePackingRow(box, weight, rate);
    const itemRow: PackingItemRow = {
      id: `pki-bulk-${Date.now()}-${i}`,
      item,
      box,
      weight,
      totalWeight: itemCalcs.totalWeight,
      unit: 'KG',
      rate,
      amount: itemCalcs.amount,
    };

    const totals = calculatePackingTotals([itemRow]);

    records.push({
      invoiceNumber,
      shippingMark,
      flight,
      destination,
      shipper,
      packingDate,
      fromDate: packingDate,
      toDate: packingDate,
      items: [itemRow],
      totalBox: totals.totalBox,
      totalWeight: totals.totalWeight,
      totalAmount: totals.totalAmount,
      remarks: 'Bulk uploaded via Quick Entry',
    });
  }

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
  };
}

/**
 * Parses CSV lines into PaymentRecords
 * Expected header/format:
 * Party, Date, DebitAmount, CreditAmount, [Status], [ReturnRMB], [ExportRef]
 */
export function parsePaymentsCSV(
  csvText: string,
  startCount: number = 0
): ParseResult<Omit<PaymentRecord, 'id' | 'createdAt'>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const records: Omit<PaymentRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  let count = startCount;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      i === 0 &&
      (line.toLowerCase().includes('party') ||
        line.toLowerCase().includes('debit') ||
        line.toLowerCase().includes('description'))
    ) {
      continue;
    }

    const parts = splitCsvLine(line);
    if (parts.length < 3) {
      errors.push(`Row ${i + 1}: Expected at least: Party, Date, DebitAmount, [CreditAmount]`);
      continue;
    }

    const party = parts[0] || 'ABDULLAH VAI';
    const date = parts[1] || new Date().toISOString().slice(0, 10);
    const debitAmount = parseFloat(parts[2]) || 0;
    const creditAmount = parts[3] ? parseFloat(parts[3]) || 0 : 0;
    const status = parts[4] || 'PAID';
    const returnRMB = parts[5] ? parseFloat(parts[5]) || 0 : 0;
    const exportRef = parts[6] || '';
    const invoiceNumber = parts[7] || generateInvoiceNumber('PAY', count);

    count++;

    const itemRow: PaymentItemRow = {
      id: `pyi-bulk-${Date.now()}-${i}`,
      description: `Payment for ${party}`,
      debitAmount,
      creditAmount,
      balance: calculatePaymentRow(debitAmount, creditAmount),
    };

    const totals = calculatePaymentTotals([itemRow], debitAmount, debitAmount - creditAmount);

    records.push({
      invoiceNumber,
      date,
      description: party,
      contactNumber: '',
      items: [itemRow],
      totalAmount: debitAmount,
      previousAmount: debitAmount,
      paidAmount: debitAmount - creditAmount,
      balance: creditAmount,
      status,
      returnRMB,
      returnRMBInBDT: Math.round(returnRMB * 16.5 * 100) / 100,
      exportGoodsRef: exportRef,
      remarks: 'Bulk uploaded via Quick Entry',
    });
  }

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
  };
}
