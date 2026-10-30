import { PurchaseItemRow, PackingItemRow } from '../types/index.ts';

/**
 * Standard GST rate presets (%) available in Purchase Form and Packing List views
 */
export const GST_RATE_PRESETS = [0, 5, 12, 18, 28] as const;

export interface PurchaseRowCalculationResult {
  quantity: number;
  rate: number;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface PurchaseFormCalculationSummary {
  rows: PurchaseItemRow[];
  activeRowCount: number;
  totalQty: number;
  subtotalAmount: number;
  totalGstAmount: number;
  effectiveGstRate: number;
  totalAmount: number;
  previousAmount: number;
  paidAmount: number;
  balance: number;
}

export interface PackingRowCalculationResult {
  box: number;
  weight: number;
  totalWeight: number;
  rate: number;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  amount: number;
}

export interface PackingFormCalculationSummary {
  rows: PackingItemRow[];
  activeRowCount: number;
  totalBox: number;
  totalWeight: number;
  subtotalAmount: number;
  totalGstAmount: number;
  effectiveGstRate: number;
  totalAmount: number;
  avgRatePerKg: number;
}

/**
 * Rounds any numeric value deterministically to 2 decimal places
 */
export function roundToTwoDecimals(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Parses a number or string input into a safe non-negative number
 */
export function sanitizeNonNegativeNumber(input: unknown): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return 0;
    return input;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }
  return 0;
}

/**
 * Clamps a GST rate percentage between 0 and 100
 */
export function sanitizeGstRate(input: unknown): number {
  const raw = sanitizeNonNegativeNumber(input);
  return roundToTwoDecimals(Math.min(100, raw));
}

/**
 * Real-time row calculation engine for the Purchase Form:
 * - Subtotal = Quantity * Rate
 * - GST Amount = Subtotal * (GST Rate / 100)
 * - Total Amount = Subtotal + GST Amount
 */
export function calculatePurchaseRowEngine(
  quantityInput: unknown,
  rateInput: unknown,
  gstRateInput: unknown = 0
): PurchaseRowCalculationResult {
  const quantity = roundToTwoDecimals(sanitizeNonNegativeNumber(quantityInput));
  const rate = roundToTwoDecimals(sanitizeNonNegativeNumber(rateInput));
  const gstRate = sanitizeGstRate(gstRateInput);

  const subtotal = roundToTwoDecimals(quantity * rate);
  const gstAmount = roundToTwoDecimals(subtotal * (gstRate / 100));
  const totalAmount = roundToTwoDecimals(subtotal + gstAmount);

  return {
    quantity,
    rate,
    subtotal,
    gstRate,
    gstAmount,
    totalAmount,
  };
}

/**
 * Recalculates an array of PurchaseItemRow in real-time.
 * If applyDefaultGstToAll is true, overrides each row's gstRate with defaultGstRate;
 * otherwise uses each row's existing gstRate (falling back to defaultGstRate if undefined).
 */
export function recalculatePurchaseRows(
  rows: PurchaseItemRow[],
  defaultGstRate: number = 0,
  applyDefaultGstToAll: boolean = false
): PurchaseItemRow[] {
  const safeDefaultGst = sanitizeGstRate(defaultGstRate);
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const rowGst = applyDefaultGstToAll
      ? safeDefaultGst
      : row.gstRate !== undefined
      ? sanitizeGstRate(row.gstRate)
      : safeDefaultGst;

    const calc = calculatePurchaseRowEngine(row.quantity, row.rate, rowGst);
    return {
      ...row,
      quantity: calc.quantity,
      rate: calc.rate,
      subtotal: calc.subtotal,
      gstRate: calc.gstRate,
      gstAmount: calc.gstAmount,
      totalAmount: calc.totalAmount,
      balance: calc.totalAmount,
    };
  });
}

/**
 * Full Purchase Form real-time auto-calculation engine.
 * Computes row-level subtotals, GST, and line totals, plus form-level
 * Taxable Subtotal, Total GST, Grand Total (Bill Total), and Net Closing Balance.
 */
export function runPurchaseAutoCalculationEngine(
  rows: PurchaseItemRow[],
  previousAmountInput: unknown = 0,
  paidAmountInput: unknown = 0,
  defaultGstRate: number = 0
): PurchaseFormCalculationSummary {
  const computedRows = recalculatePurchaseRows(rows, defaultGstRate, false);
  const previousAmount = roundToTwoDecimals(sanitizeNonNegativeNumber(previousAmountInput));
  const paidAmount = roundToTwoDecimals(sanitizeNonNegativeNumber(paidAmountInput));

  let activeRowCount = 0;
  let totalQty = 0;
  let subtotalAmount = 0;
  let totalGstAmount = 0;
  let totalAmount = 0;

  for (const r of computedRows) {
    const isPopulated =
      (r.item || '').trim() !== '' || r.quantity > 0 || r.rate > 0;
    if (isPopulated) {
      activeRowCount += 1;
    }
    totalQty += r.quantity;
    subtotalAmount += r.subtotal ?? 0;
    totalGstAmount += r.gstAmount ?? 0;
    totalAmount += r.totalAmount;
  }

  totalQty = roundToTwoDecimals(totalQty);
  subtotalAmount = roundToTwoDecimals(subtotalAmount);
  totalGstAmount = roundToTwoDecimals(totalGstAmount);
  totalAmount = roundToTwoDecimals(totalAmount);

  const effectiveGstRate =
    subtotalAmount > 0
      ? roundToTwoDecimals((totalGstAmount / subtotalAmount) * 100)
      : sanitizeGstRate(defaultGstRate);

  const balance = roundToTwoDecimals(totalAmount + previousAmount - paidAmount);

  return {
    rows: computedRows,
    activeRowCount,
    totalQty,
    subtotalAmount,
    totalGstAmount,
    effectiveGstRate,
    totalAmount,
    previousAmount,
    paidAmount,
    balance,
  };
}

/**
 * Real-time row calculation engine for the Packing List Form:
 * - Total Weight = Box * Weight
 * - Subtotal = Total Weight * Rate
 * - GST Amount = Subtotal * (GST Rate / 100)
 * - Total Amount = Subtotal + GST Amount
 */
export function calculatePackingRowEngine(
  boxInput: unknown,
  weightInput: unknown,
  rateInput: unknown,
  gstRateInput: unknown = 0
): PackingRowCalculationResult {
  const box = roundToTwoDecimals(sanitizeNonNegativeNumber(boxInput));
  const weight = roundToTwoDecimals(sanitizeNonNegativeNumber(weightInput));
  const rate = roundToTwoDecimals(sanitizeNonNegativeNumber(rateInput));
  const gstRate = sanitizeGstRate(gstRateInput);

  const totalWeight = roundToTwoDecimals(box * weight);
  const subtotal = roundToTwoDecimals(totalWeight * rate);
  const gstAmount = roundToTwoDecimals(subtotal * (gstRate / 100));
  const amount = roundToTwoDecimals(subtotal + gstAmount);

  return {
    box,
    weight,
    totalWeight,
    rate,
    subtotal,
    gstRate,
    gstAmount,
    amount,
  };
}

/**
 * Recalculates an array of PackingItemRow in real-time.
 * If applyDefaultGstToAll is true, overrides each row's gstRate with defaultGstRate;
 * otherwise uses each row's existing gstRate (falling back to defaultGstRate if undefined).
 */
export function recalculatePackingRows(
  rows: PackingItemRow[],
  defaultGstRate: number = 0,
  applyDefaultGstToAll: boolean = false
): PackingItemRow[] {
  const safeDefaultGst = sanitizeGstRate(defaultGstRate);
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const rowGst = applyDefaultGstToAll
      ? safeDefaultGst
      : row.gstRate !== undefined
      ? sanitizeGstRate(row.gstRate)
      : safeDefaultGst;

    const calc = calculatePackingRowEngine(row.box, row.weight, row.rate, rowGst);
    return {
      ...row,
      box: calc.box,
      weight: calc.weight,
      totalWeight: calc.totalWeight,
      rate: calc.rate,
      subtotal: calc.subtotal,
      gstRate: calc.gstRate,
      gstAmount: calc.gstAmount,
      amount: calc.amount,
    };
  });
}

/**
 * Full Packing List real-time auto-calculation engine.
 * Computes row-level total weights, subtotals, GST, and line totals, plus manifest-level
 * Total Boxes, Total Net Weight, Taxable Subtotal, Total GST, and Grand Total.
 */
export function runPackingAutoCalculationEngine(
  rows: PackingItemRow[],
  defaultGstRate: number = 0
): PackingFormCalculationSummary {
  const computedRows = recalculatePackingRows(rows, defaultGstRate, false);

  let activeRowCount = 0;
  let totalBox = 0;
  let totalWeight = 0;
  let subtotalAmount = 0;
  let totalGstAmount = 0;
  let totalAmount = 0;

  for (const r of computedRows) {
    const isPopulated =
      (r.item || '').trim() !== '' || r.box > 0 || r.weight > 0 || r.rate > 0;
    if (isPopulated) {
      activeRowCount += 1;
    }
    totalBox += r.box;
    totalWeight += r.totalWeight;
    subtotalAmount += r.subtotal ?? 0;
    totalGstAmount += r.gstAmount ?? 0;
    totalAmount += r.amount;
  }

  totalBox = roundToTwoDecimals(totalBox);
  totalWeight = roundToTwoDecimals(totalWeight);
  subtotalAmount = roundToTwoDecimals(subtotalAmount);
  totalGstAmount = roundToTwoDecimals(totalGstAmount);
  totalAmount = roundToTwoDecimals(totalAmount);

  const effectiveGstRate =
    subtotalAmount > 0
      ? roundToTwoDecimals((totalGstAmount / subtotalAmount) * 100)
      : sanitizeGstRate(defaultGstRate);

  const avgRatePerKg =
    totalWeight > 0 ? roundToTwoDecimals(subtotalAmount / totalWeight) : 0;

  return {
    rows: computedRows,
    activeRowCount,
    totalBox,
    totalWeight,
    subtotalAmount,
    totalGstAmount,
    effectiveGstRate,
    totalAmount,
    avgRatePerKg,
  };
}
