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
  pendingCount?: number;
}

export interface NumericCellInspection {
  status: 'blank' | 'number' | 'unreadable';
  numericValue: number;
  rawText: string;
  isFormula: boolean;
}

export const MAX_POPULATED_ROWS_PRIMARY = 500_000;
export const MAX_POPULATED_ROWS_COMPACT = 5_000;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Inspects a cell expected to hold a number without dropping rows:
 * - Blank / null / undefined -> status: 'blank', numericValue: 0
 * - Finite numbers (including 0, negatives, commas, currency symbols) -> status: 'number'
 * - Non-numeric text ("TBD", "abc") or literal formulas ("=SUM(A1:A2)") -> status: 'unreadable', preserves rawText
 */
export function inspectNumericImportCell(raw: unknown): NumericCellInspection {
  if (raw === undefined || raw === null) {
    return { status: 'blank', numericValue: 0, rawText: '', isFormula: false };
  }
  if (typeof raw === 'number') {
    if (Number.isFinite(raw)) {
      return { status: 'number', numericValue: raw, rawText: String(raw), isFormula: false };
    }
    return { status: 'unreadable', numericValue: 0, rawText: String(raw), isFormula: false };
  }
  const str = String(raw).trim();
  if (str === '') {
    return { status: 'blank', numericValue: 0, rawText: '', isFormula: false };
  }
  if (str.startsWith('=')) {
    return { status: 'unreadable', numericValue: 0, rawText: str, isFormula: true };
  }
  const cleaned = str.replace(/[,৳¥$\s]/g, '');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return { status: 'number', numericValue: parsed, rawText: str, isFormula: false };
    }
  }
  return { status: 'unreadable', numericValue: 0, rawText: str, isFormula: false };
}

export function hasPresentImportText(raw: unknown): boolean {
  return raw !== undefined && raw !== null && String(raw).trim() !== '';
}

export function validateImportLimits(options: {
  dataset: 'purchase' | 'packing' | 'payment' | 'other_cost' | 'all';
  populatedRows: number;
  fileSizeBytes?: number;
}): { valid: boolean; error?: string } {
  const maxRows =
    options.dataset === 'other_cost' ? MAX_POPULATED_ROWS_COMPACT : MAX_POPULATED_ROWS_PRIMARY;

  if (options.fileSizeBytes !== undefined && options.fileSizeBytes > MAX_IMPORT_FILE_BYTES) {
    // Allow > 5MB when explicitly importing high-capacity 500k primary datasets? Wait: honor strict 5 MB guard for compact/standard upload limit when indicated
    if (options.dataset === 'other_cost') {
      return {
        valid: false,
        error: `File size exceeds maximum 5 MB limit (${(options.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }
  }

  if (options.populatedRows > maxRows) {
    return {
      valid: false,
      error: `Populated rows (${options.populatedRows.toLocaleString()}) exceed the maximum allowed limit of ${maxRows.toLocaleString()} populated rows.`,
    };
  }

  return { valid: true };
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
 * Builds a normalized group key for a Purchase record based on
 * Purchasing Supplier Name (description) and Date.
 */
export function buildPurchaseSupplierGroupKey(input: {
  description: string;
  date: string;
}): string {
  const normSupplier = String(input.description ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  const normDate = String(input.date ?? '').trim();
  return `${normSupplier}||${normDate}`;
}

function mergeRawValues(
  base?: Record<string, string>,
  incoming?: Record<string, string>
): Record<string, string> | undefined {
  const merged = { ...(base || {}), ...(incoming || {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergePendingFields(base?: string[], incoming?: string[]): string[] | undefined {
  const set = new Set([...(base || []), ...(incoming || [])]);
  return set.size > 0 ? Array.from(set) : undefined;
}

function buildPurchaseItemScopedRawValues(
  baseItemIdx: number,
  incoming?: Record<string, string>
): Record<string, string> | undefined {
  if (!incoming) return undefined;
  const scoped: Record<string, string> = { ...incoming };
  const qtyVal = incoming.quantity ?? incoming.totalQty;
  if (qtyVal !== undefined) scoped[`item${baseItemIdx}_quantity`] = qtyVal;
  if (incoming.rate !== undefined) scoped[`item${baseItemIdx}_rate`] = incoming.rate;
  if (incoming.item !== undefined) scoped[`item${baseItemIdx}_item`] = incoming.item;
  return scoped;
}

function buildPackingItemScopedRawValues(
  baseItemIdx: number,
  incoming?: Record<string, string>
): Record<string, string> | undefined {
  if (!incoming) return undefined;
  const scoped: Record<string, string> = { ...incoming };
  const boxVal = incoming.box ?? incoming.totalBox;
  const weightVal = incoming.weight ?? incoming.totalWeight;
  if (boxVal !== undefined) scoped[`item${baseItemIdx}_box`] = boxVal;
  if (weightVal !== undefined) scoped[`item${baseItemIdx}_weight`] = weightVal;
  if (incoming.rate !== undefined) scoped[`item${baseItemIdx}_rate`] = incoming.rate;
  if (incoming.item !== undefined) scoped[`item${baseItemIdx}_item`] = incoming.item;
  return scoped;
}

/**
 * Merges PurchaseRecords that share the same Purchasing Supplier Name (description)
 * and Date into a single PurchaseRecord with 1 invoice/purchasing invoice number
 * and all item rows combined. Missing invoice references receive an INV number.
 */
export function mergePurchaseRecordsBySupplierAndDate(
  records: Omit<PurchaseRecord, 'id' | 'createdAt'>[],
  startCount: number = 0
): Omit<PurchaseRecord, 'id' | 'createdAt'>[] {
  const groupMap = new Map<string, Omit<PurchaseRecord, 'id' | 'createdAt'>>();
  const usedInvoiceNumbers = new Set<string>();
  let groupCount = startCount;

  for (const rec of records) {
    const key = buildPurchaseSupplierGroupKey({
      description: rec.description,
      date: rec.date,
    });

    const normalizedItems: PurchaseItemRow[] = (rec.items || []).map((it, idx) => {
      const quantity = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const totalAmount = rec.calculationPending
        ? Number(it.totalAmount) || 0
        : calculatePurchaseRowTotal(quantity, rate);
      return {
        ...it,
        id: it.id || `pi-merged-${Date.now()}-${groupMap.size}-${idx}`,
        item: hasPresentImportText(it.item) ? String(it.item).trim() : '',
        quantity,
        rate,
        totalAmount,
        previousAmount: 0,
        paidAmount: 0,
        balance: 0,
      };
    });

    if (!groupMap.has(key)) {
      const explicitInvoice = String(rec.invoiceNumber || '').trim();
      const invoiceNumber =
        explicitInvoice && !usedInvoiceNumbers.has(explicitInvoice.toUpperCase())
          ? explicitInvoice
          : generateInvoiceNumber('INV', groupCount);
      usedInvoiceNumbers.add(invoiceNumber.toUpperCase());
      groupCount++;

      const previousAmount = Number(rec.previousAmount) || 0;
      const paidAmount = Number(rec.paidAmount) || 0;
      const totals = calculatePurchaseTotals(normalizedItems, previousAmount, paidAmount);
      const scopedRaw = buildPurchaseItemScopedRawValues(0, rec.rawValues);

      groupMap.set(key, {
        ...rec,
        invoiceNumber,
        date: String(rec.date || '').trim(),
        description: String(rec.description ?? '')
          .trim()
          .replace(/\s+/g, ' '),
        contactNumber: String(rec.contactNumber ?? '').trim(),
        items: normalizedItems,
        totalQty: totals.totalQty,
        totalAmount: rec.calculationPending ? Number(rec.totalAmount) || totals.totalAmount : totals.totalAmount,
        previousAmount: totals.previousAmount,
        paidAmount: totals.paidAmount,
        balance: rec.calculationPending ? Number(rec.balance) || totals.balance : totals.balance,
        calculationPending: Boolean(rec.calculationPending),
        pendingFields: rec.pendingFields,
        rawValues: scopedRaw,
      });
    } else {
      const existing = groupMap.get(key)!;
      const baseItemIdx = existing.items.length;
      const combinedItems: PurchaseItemRow[] = [
        ...existing.items,
        ...normalizedItems.map((it, idx) => ({
          ...it,
          id: `pi-merged-${Date.now()}-${existing.items.length + idx}`,
        })),
      ];
      const combinedPrevious =
        (Number(existing.previousAmount) || 0) + (Number(rec.previousAmount) || 0);
      const combinedPaid =
        (Number(existing.paidAmount) || 0) + (Number(rec.paidAmount) || 0);
      const totals = calculatePurchaseTotals(
        combinedItems,
        combinedPrevious,
        combinedPaid
      );

      const combinedPending = Boolean(existing.calculationPending || rec.calculationPending);
      const scopedIncomingRaw = buildPurchaseItemScopedRawValues(baseItemIdx, rec.rawValues);

      groupMap.set(key, {
        ...existing,
        contactNumber: existing.contactNumber || String(rec.contactNumber ?? '').trim(),
        items: combinedItems,
        totalQty: totals.totalQty,
        totalAmount: totals.totalAmount,
        previousAmount: totals.previousAmount,
        paidAmount: totals.paidAmount,
        balance: totals.balance,
        calculationPending: combinedPending,
        pendingFields: mergePendingFields(existing.pendingFields, rec.pendingFields),
        rawValues: mergeRawValues(existing.rawValues, scopedIncomingRaw),
      });
    }
  }

  return Array.from(groupMap.values());
}

/**
 * Parses CSV lines into PurchaseRecords.
 * Rows sharing the same Purchasing Supplier Name and Date are automatically
 * merged into a single PurchaseRecord with 1 INV invoice number.
 * Accepts all cell values including numeric supplier names, blanks, negatives, text amounts, and formulas.
 */
export function parsePurchasesCSV(
  csvText: string,
  startCount: number = 0
): ParseResult<Omit<PurchaseRecord, 'id' | 'createdAt'>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rawRecords: Omit<PurchaseRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      i === 0 &&
      (line.toLowerCase().includes('supplier') ||
        line.toLowerCase().includes('item') ||
        line.toLowerCase().includes('invoice'))
    ) {
      continue;
    }

    const parts = splitCsvLine(line);
    if (parts.every((c) => c === '')) {
      continue;
    }

    const supplier = hasPresentImportText(parts[0]) ? String(parts[0]).trim() : '';
    const date = hasPresentImportText(parts[1])
      ? String(parts[1]).trim()
      : new Date().toISOString().slice(0, 10);
    const item = hasPresentImportText(parts[2]) ? String(parts[2]).trim() : '';

    const qtyCheck = inspectNumericImportCell(parts[3]);
    const rateCheck = inspectNumericImportCell(parts[4]);
    const prevCheck = inspectNumericImportCell(parts[5]);
    const paidCheck = inspectNumericImportCell(parts[6]);
    const contact = hasPresentImportText(parts[7]) ? String(parts[7]).trim() : '';
    const explicitInvoiceNumber = hasPresentImportText(parts[8]) ? String(parts[8]).trim() : '';
    const remarksRaw = hasPresentImportText(parts[9]) ? String(parts[9]).trim() : '';

    const pendingFields: string[] = [];
    const rawValues: Record<string, string> = {};

    if (qtyCheck.status === 'unreadable') {
      pendingFields.push('totalQty');
      rawValues.quantity = qtyCheck.rawText;
      rawValues.totalQty = qtyCheck.rawText;
    }
    if (rateCheck.status === 'unreadable') {
      pendingFields.push('rate');
      pendingFields.push('totalAmount');
      rawValues.rate = rateCheck.rawText;
      rawValues.totalAmount = rateCheck.rawText;
    }
    if (prevCheck.status === 'unreadable') {
      pendingFields.push('previousAmount');
      rawValues.previousAmount = prevCheck.rawText;
    }
    if (paidCheck.status === 'unreadable') {
      pendingFields.push('paidAmount');
      rawValues.paidAmount = paidCheck.rawText;
    }
    if (supplier.startsWith('=')) rawValues.description = supplier;
    if (item.startsWith('=')) rawValues.item = item;
    if (date.startsWith('=')) rawValues.date = date;
    if (contact.startsWith('=')) rawValues.contactNumber = contact;
    if (explicitInvoiceNumber.startsWith('=')) rawValues.invoiceNumber = explicitInvoiceNumber;
    if (remarksRaw.startsWith('=')) rawValues.remarks = remarksRaw;

    const calculationPending = pendingFields.length > 0;
    const quantity = qtyCheck.numericValue;
    const rate = rateCheck.numericValue;
    const previousAmount = prevCheck.numericValue;
    const paidAmount = paidCheck.numericValue;

    const rowTotal = calculationPending ? 0 : calculatePurchaseRowTotal(quantity, rate);
    const itemRow: PurchaseItemRow = {
      id: `pi-bulk-${Date.now()}-${i}`,
      item,
      quantity,
      rate,
      totalAmount: rowTotal,
      previousAmount: 0,
      paidAmount: 0,
      balance: 0,
    };

    const totals = calculatePurchaseTotals([itemRow], previousAmount, paidAmount);

    rawRecords.push({
      invoiceNumber: explicitInvoiceNumber,
      date,
      description: supplier,
      contactNumber: contact,
      items: [itemRow],
      totalQty: totals.totalQty,
      totalAmount: calculationPending ? 0 : totals.totalAmount,
      previousAmount: totals.previousAmount,
      paidAmount: totals.paidAmount,
      balance: calculationPending ? 0 : totals.balance,
      remarks: remarksRaw || 'Bulk uploaded via Quick Entry',
      calculationPending,
      pendingFields: pendingFields.length > 0 ? pendingFields : undefined,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    });
  }

  const limitCheck = validateImportLimits({
    dataset: 'purchase',
    populatedRows: rawRecords.length,
  });
  if (!limitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [limitCheck.error || 'Row limit exceeded.'],
      totalParsedRows: rawRecords.length,
      pendingCount: 0,
    };
  }

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
 * Builds a normalized shipment group key for a Packing List record based on
 * Shipping Mark, Flight, Destination, Shipper, and Packing Date.
 */
export function buildPackingShipmentGroupKey(input: {
  shippingMark: string;
  flight: string;
  destination: string;
  shipper: string;
  packingDate: string;
}): string {
  const norm = (val: string) =>
    String(val ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  return [
    norm(input.shippingMark),
    norm(input.flight),
    norm(input.destination),
    norm(input.shipper),
    String(input.packingDate ?? '').trim(),
  ].join('||');
}

/**
 * Merges PackingRecords that share the same Shipping Mark, Flight, Destination,
 * Shipper, and Packing Date into a single PackingRecord with 1 invoice/packing number
 * and all item rows combined.
 */
export function mergePackingRecordsByShipmentGroup(
  records: Omit<PackingRecord, 'id' | 'createdAt'>[],
  startCount: number = 0
): Omit<PackingRecord, 'id' | 'createdAt'>[] {
  const groupMap = new Map<string, Omit<PackingRecord, 'id' | 'createdAt'>>();
  const usedInvoiceNumbers = new Set<string>();
  let groupCount = startCount;

  for (const rec of records) {
    const key = buildPackingShipmentGroupKey({
      shippingMark: rec.shippingMark,
      flight: rec.flight,
      destination: rec.destination,
      shipper: rec.shipper,
      packingDate: rec.packingDate,
    });

    const normalizedItems: PackingItemRow[] = (rec.items || []).map((it, idx) => {
      const box = Number(it.box) || 0;
      const weight = Number(it.weight) || 0;
      const rate = Number(it.rate) || 0;
      const calcs = rec.calculationPending
        ? {
            totalWeight: Number(it.totalWeight) || 0,
            amount: Number(it.amount) || 0,
          }
        : calculatePackingRow(box, weight, rate);
      return {
        ...it,
        id: it.id || `pki-merged-${Date.now()}-${groupMap.size}-${idx}`,
        box,
        weight,
        totalWeight: calcs.totalWeight,
        unit: it.unit || 'KG',
        rate,
        amount: calcs.amount,
      };
    });

    if (!groupMap.has(key)) {
      const explicitInvoice = String(rec.invoiceNumber || '').trim();
      const invoiceNumber =
        explicitInvoice && !usedInvoiceNumbers.has(explicitInvoice.toUpperCase())
          ? explicitInvoice
          : generateInvoiceNumber('PKG', groupCount);
      usedInvoiceNumbers.add(invoiceNumber.toUpperCase());
      groupCount++;

      const totals = calculatePackingTotals(normalizedItems);
      const rmbRate = rec.rmbRate !== undefined ? rec.rmbRate : undefined;
      const totalAmountBDT =
        !rec.calculationPending && rmbRate && rmbRate > 0
          ? Math.round(totals.totalAmount * rmbRate * 100) / 100
          : rec.totalAmountBDT;
      const rmbAmount =
        !rec.calculationPending && totals.totalWeight > 0
          ? Math.round((totals.totalAmount / totals.totalWeight) * 100) / 100
          : 0;
      const scopedRaw = buildPackingItemScopedRawValues(0, rec.rawValues);

      groupMap.set(key, {
        ...rec,
        invoiceNumber,
        shippingMark: String(rec.shippingMark ?? '').trim(),
        flight: String(rec.flight ?? '').trim(),
        destination: String(rec.destination ?? '').trim(),
        shipper: String(rec.shipper ?? '').trim(),
        packingDate: String(rec.packingDate ?? '').trim(),
        fromDate: rec.fromDate || rec.packingDate,
        toDate: rec.toDate || rec.packingDate,
        items: normalizedItems,
        totalBox: totals.totalBox,
        totalWeight: totals.totalWeight,
        totalAmount: totals.totalAmount,
        rmbAmount,
        settledAmount: totals.totalAmount,
        rmbRate,
        totalAmountBDT,
        calculationPending: Boolean(rec.calculationPending),
        pendingFields: rec.pendingFields,
        rawValues: scopedRaw,
      });
    } else {
      const existing = groupMap.get(key)!;
      const baseItemIdx = existing.items.length;
      const combinedItems: PackingItemRow[] = [
        ...existing.items,
        ...normalizedItems.map((it, idx) => ({
          ...it,
          id: `pki-merged-${Date.now()}-${existing.items.length + idx}`,
        })),
      ];
      const totals = calculatePackingTotals(combinedItems);
      const rmbRate =
        existing.rmbRate !== undefined
          ? existing.rmbRate
          : rec.rmbRate !== undefined
          ? rec.rmbRate
          : undefined;
      const combinedPending = Boolean(existing.calculationPending || rec.calculationPending);
      const totalAmountBDT =
        !combinedPending && rmbRate && rmbRate > 0
          ? Math.round(totals.totalAmount * rmbRate * 100) / 100
          : existing.totalAmountBDT;
      const rmbAmount =
        !combinedPending && totals.totalWeight > 0
          ? Math.round((totals.totalAmount / totals.totalWeight) * 100) / 100
          : 0;
      const scopedIncomingRaw = buildPackingItemScopedRawValues(baseItemIdx, rec.rawValues);

      groupMap.set(key, {
        ...existing,
        items: combinedItems,
        totalBox: totals.totalBox,
        totalWeight: totals.totalWeight,
        totalAmount: totals.totalAmount,
        rmbAmount,
        settledAmount: totals.totalAmount,
        rmbRate,
        totalAmountBDT,
        calculationPending: combinedPending,
        pendingFields: mergePendingFields(existing.pendingFields, rec.pendingFields),
        rawValues: mergeRawValues(existing.rawValues, scopedIncomingRaw),
      });
    }
  }

  return Array.from(groupMap.values());
}

/**
 * Parses CSV lines into PackingRecords.
 * Rows sharing ShippingMark, Flight, Destination, Shipper, and Date share 1 invoice.
 * Accepts numeric marks/names, blanks, negatives, text amounts, and literal formulas.
 */
export function parsePackingsCSV(
  csvText: string,
  startCount: number = 0
): ParseResult<Omit<PackingRecord, 'id' | 'createdAt'>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rawRecords: Omit<PackingRecord, 'id' | 'createdAt'>[] = [];
  const errors: string[] = [];

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
    if (parts.every((c) => c === '')) {
      continue;
    }

    const shippingMark = hasPresentImportText(parts[0]) ? String(parts[0]).trim() : '';
    const flight = hasPresentImportText(parts[1]) ? String(parts[1]).trim() : '';
    const destination = hasPresentImportText(parts[2]) ? String(parts[2]).trim() : '';
    const shipper = hasPresentImportText(parts[3]) ? String(parts[3]).trim() : '';
    const packingDate = hasPresentImportText(parts[4])
      ? String(parts[4]).trim()
      : new Date().toISOString().slice(0, 10);
    const item = hasPresentImportText(parts[5]) ? String(parts[5]).trim() : '';

    const boxCheck = inspectNumericImportCell(parts[6]);
    const weightCheck = inspectNumericImportCell(parts[7]);
    const rateCheck = inspectNumericImportCell(parts[8]);

    const col9 = hasPresentImportText(parts[9]) ? String(parts[9]).trim() : '';
    const col10 = hasPresentImportText(parts[10]) ? String(parts[10]).trim() : '';
    const col9Check = inspectNumericImportCell(col9);
    const col9LooksLikeInvoice = !col10 && /^(PKG|INV|EXP|PAY)-/i.test(col9);
    const isCol9NumericRate = col9Check.status === 'number';
    const isCol9UnreadableRate = !col9LooksLikeInvoice && col9Check.status === 'unreadable';
    const rmbRate = isCol9NumericRate ? col9Check.numericValue : 0;
    const explicitInvoiceNumber = col10
      ? col10
      : col9LooksLikeInvoice
      ? col9
      : '';

    const pendingFields: string[] = [];
    const rawValues: Record<string, string> = {};

    if (boxCheck.status === 'unreadable') {
      pendingFields.push('totalBox');
      rawValues.box = boxCheck.rawText;
      rawValues.totalBox = boxCheck.rawText;
    }
    if (weightCheck.status === 'unreadable') {
      pendingFields.push('totalWeight');
      rawValues.weight = weightCheck.rawText;
      rawValues.totalWeight = weightCheck.rawText;
    }
    if (rateCheck.status === 'unreadable') {
      pendingFields.push('totalAmount');
      rawValues.rate = rateCheck.rawText;
      rawValues.totalAmount = rateCheck.rawText;
    }
    if (isCol9UnreadableRate) {
      pendingFields.push('rmbRate');
      rawValues.rmbRate = col9Check.rawText;
    }
    if (item.startsWith('=')) rawValues.item = item;
    if (shippingMark.startsWith('=')) rawValues.shippingMark = shippingMark;
    if (flight.startsWith('=')) rawValues.flight = flight;
    if (destination.startsWith('=')) rawValues.destination = destination;
    if (shipper.startsWith('=')) rawValues.shipper = shipper;
    if (packingDate.startsWith('=')) rawValues.packingDate = packingDate;
    if (explicitInvoiceNumber.startsWith('=')) rawValues.invoiceNumber = explicitInvoiceNumber;

    const calculationPending = pendingFields.length > 0;
    const box = boxCheck.numericValue;
    const weight = weightCheck.numericValue;
    const rate = rateCheck.numericValue;

    const itemCalcs = calculationPending
      ? { totalWeight: 0, amount: 0 }
      : calculatePackingRow(box, weight, rate);
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
    const totalAmountBDT =
      !calculationPending && rmbRate !== 0
        ? Math.round(totals.totalAmount * rmbRate * 100) / 100
        : undefined;

    rawRecords.push({
      invoiceNumber: explicitInvoiceNumber,
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
      rmbRate: isCol9NumericRate ? rmbRate : undefined,
      totalAmountBDT,
      remarks: 'Bulk uploaded via Quick Entry',
      calculationPending,
      pendingFields: pendingFields.length > 0 ? pendingFields : undefined,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    });
  }

  const limitCheck = validateImportLimits({
    dataset: 'packing',
    populatedRows: rawRecords.length,
  });
  if (!limitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [limitCheck.error || 'Row limit exceeded.'],
      totalParsedRows: rawRecords.length,
      pendingCount: 0,
    };
  }

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
 * Parses CSV lines into PaymentRecords
 * Accepts numeric names/marks, blanks, negatives, text amounts, and literal formulas.
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
  let hasInvoiceColFirst = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      i === 0 &&
      (line.toLowerCase().includes('party') ||
        line.toLowerCase().includes('debit') ||
        line.toLowerCase().includes('description') ||
        line.toLowerCase().includes('invoice'))
    ) {
      const headerParts = splitCsvLine(line);
      const firstHeader = (headerParts[0] || '').toLowerCase();
      hasInvoiceColFirst = firstHeader.includes('invoice') || firstHeader.includes('voucher');
      continue;
    }

    const parts = splitCsvLine(line);
    if (parts.every((c) => c === '')) {
      continue;
    }

    const offset = hasInvoiceColFirst ? 1 : 0;
    const explicitInvPart = hasInvoiceColFirst ? parts[0] : parts[7];
    const party = hasPresentImportText(parts[offset + 0]) ? String(parts[offset + 0]).trim() : '';
    const date = hasPresentImportText(parts[offset + 1])
      ? String(parts[offset + 1]).trim()
      : new Date().toISOString().slice(0, 10);

    const debitCheck = inspectNumericImportCell(parts[offset + 2]);
    const creditCheck = inspectNumericImportCell(parts[offset + 3]);
    const status = hasPresentImportText(parts[offset + 4]) ? String(parts[offset + 4]).trim() : 'PAID';
    const rmbCheck = inspectNumericImportCell(parts[offset + 5]);
    const exportRef = hasPresentImportText(parts[offset + 6]) ? String(parts[offset + 6]).trim() : '';
    const invoiceNumber = hasPresentImportText(explicitInvPart)
      ? String(explicitInvPart).trim()
      : generateInvoiceNumber('PAY', count);

    const pendingFields: string[] = [];
    const rawValues: Record<string, string> = {};

    if (debitCheck.status === 'unreadable') {
      pendingFields.push('totalAmount');
      pendingFields.push('paidAmount');
      rawValues.debitAmount = debitCheck.rawText;
      rawValues.totalAmount = debitCheck.rawText;
      rawValues.paidAmount = debitCheck.rawText;
    }
    if (creditCheck.status === 'unreadable') {
      pendingFields.push('balance');
      rawValues.creditAmount = creditCheck.rawText;
      rawValues.balance = creditCheck.rawText;
    }
    if (rmbCheck.status === 'unreadable') {
      pendingFields.push('returnRMB');
      rawValues.returnRMB = rmbCheck.rawText;
    }
    if (party.startsWith('=')) rawValues.description = party;
    if (date.startsWith('=')) rawValues.date = date;
    if (status.startsWith('=')) rawValues.status = status;
    if (exportRef.startsWith('=')) rawValues.exportGoodsRef = exportRef;
    if (invoiceNumber.startsWith('=')) rawValues.invoiceNumber = invoiceNumber;

    const calculationPending = pendingFields.length > 0;
    const debitAmount = debitCheck.numericValue;
    const creditAmount = creditCheck.numericValue;
    const returnRMB = rmbCheck.numericValue;

    count++;

    const itemRow: PaymentItemRow = {
      id: `pyi-bulk-${Date.now()}-${i}`,
      description: party ? `Payment for ${party}` : 'Payment Entry',
      debitAmount,
      creditAmount,
      balance: calculationPending ? 0 : calculatePaymentRow(debitAmount, creditAmount),
    };

    const resolvedPaidAmount =
      debitCheck.status === 'unreadable' && creditCheck.status === 'number'
        ? creditAmount
        : calculationPending
        ? 0
        : debitAmount - creditAmount;

    records.push({
      invoiceNumber,
      date,
      description: party,
      contactNumber: '',
      items: [itemRow],
      totalAmount: debitAmount,
      previousAmount: debitAmount,
      paidAmount: resolvedPaidAmount,
      balance: creditAmount,
      status,
      returnRMB,
      returnRMBInBDT: calculationPending ? 0 : Math.round(returnRMB * 16.5 * 100) / 100,
      exportGoodsRef: exportRef,
      remarks: 'Bulk uploaded via Quick Entry',
      calculationPending,
      pendingFields: pendingFields.length > 0 ? pendingFields : undefined,
      rawValues: Object.keys(rawValues).length > 0 ? rawValues : undefined,
    });
  }

  const limitCheck = validateImportLimits({
    dataset: 'payment',
    populatedRows: records.length,
  });
  if (!limitCheck.valid) {
    return {
      success: false,
      records: [],
      errors: [limitCheck.error || 'Row limit exceeded.'],
      totalParsedRows: records.length,
      pendingCount: 0,
    };
  }

  return {
    success: records.length > 0,
    records,
    errors,
    totalParsedRows: records.length,
    pendingCount: records.filter((r) => r.calculationPending).length,
  };
}
