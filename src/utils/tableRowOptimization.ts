import {
  PurchaseItemRow,
  PackingItemRow,
  PaymentItemRow,
  ExporterPaymentSlipRow,
} from '../types/index.ts';
import {
  calculatePurchaseRowTotal,
  calculatePackingRow,
  calculatePaymentRow,
  calculateExporterSlipRowAmount,
} from './calculations.ts';
import {
  AirWayBillRow,
  calculateAirWayBillRow,
  parseSignedNumber,
} from './airWayBill.ts';

/**
 * Value equality check for PurchaseItemRow data fields rendered in PurchaseItemTableRow.
 * Ensures a row component only re-renders when its own cell values or computed total truly change.
 */
export function isPurchaseRowDataEqual(
  prev: PurchaseItemRow,
  next: PurchaseItemRow
): boolean {
  if (prev === next) return true;
  return (
    prev.id === next.id &&
    prev.item === next.item &&
    prev.quantity === next.quantity &&
    prev.rate === next.rate &&
    Boolean(prev.rateSpecified) === Boolean(next.rateSpecified) &&
    prev.totalAmount === next.totalAmount &&
    Boolean(prev.locked) === Boolean(next.locked) &&
    prev.lockReason === next.lockReason
  );
}

/**
 * Value equality check for PackingItemRow data fields rendered in PackingItemTableRow.
 * Ensures a row component only re-renders when its own cell values or computed totals truly change.
 */
export function isPackingRowDataEqual(
  prev: PackingItemRow,
  next: PackingItemRow
): boolean {
  if (prev === next) return true;
  return (
    prev.id === next.id &&
    prev.item === next.item &&
    prev.box === next.box &&
    prev.weight === next.weight &&
    (Number(prev.reportWeight) || 0) === (Number(next.reportWeight) || 0) &&
    prev.totalWeight === next.totalWeight &&
    prev.unit === next.unit &&
    prev.rate === next.rate &&
    prev.amount === next.amount &&
    Boolean(prev.locked) === Boolean(next.locked) &&
    prev.lockReason === next.lockReason
  );
}

/**
 * Value equality check for PaymentItemRow data fields rendered in ExporterPaymentHistoryTableRow.
 */
export function isExporterHistoryRowDataEqual(
  prev: PaymentItemRow,
  next: PaymentItemRow
): boolean {
  if (prev === next) return true;
  return (
    prev.id === next.id &&
    prev.packingId === next.packingId &&
    prev.paymentId === next.paymentId &&
    prev.date === next.date &&
    prev.shippingMark === next.shippingMark &&
    prev.description === next.description &&
    prev.debitAmount === next.debitAmount &&
    (prev.reportAmount ?? 0) === (next.reportAmount ?? 0) &&
    prev.creditAmount === next.creditAmount &&
    prev.balance === next.balance &&
    prev.status === next.status
  );
}

/**
 * Value equality check for AirWayBillRow data fields rendered in AirWayBillTableRow.
 */
export function isAirWayBillRowDataEqual(
  prev: AirWayBillRow,
  next: AirWayBillRow
): boolean {
  if (prev === next) return true;
  return (
    prev.id === next.id &&
    prev.packingId === next.packingId &&
    Boolean(prev.isCustom) === Boolean(next.isCustom) &&
    (prev.mergedCount || 1) === (next.mergedCount || 1) &&
    (prev.packingIds || []).join(',') === (next.packingIds || []).join(',') &&
    (prev.customRowIds || []).join(',') === (next.customRowIds || []).join(',') &&
    prev.date === next.date &&
    (prev.originalDate || '') === (next.originalDate || '') &&
    Boolean(prev.isDateOverridden) === Boolean(next.isDateOverridden) &&
    prev.shipper === next.shipper &&
    (prev.documentsHolder || '') === (next.documentsHolder || '') &&
    prev.flight === next.flight &&
    prev.totalBox === next.totalBox &&
    prev.rmbPerBox === next.rmbPerBox &&
    prev.totalRmb === next.totalRmb &&
    prev.rate === next.rate &&
    Boolean(prev.rateSpecified) === Boolean(next.rateSpecified) &&
    prev.bdtAmount === next.bdtAmount
  );
}

/**
 * Value equality check for ExporterPaymentSlipRow data fields rendered in ExporterPaymentSlipTableRow.
 */
export function isExporterSlipRowDataEqual(
  prev: ExporterPaymentSlipRow,
  next: ExporterPaymentSlipRow
): boolean {
  if (prev === next) return true;
  return (
    prev.id === next.id &&
    prev.packingId === next.packingId &&
    prev.paymentId === next.paymentId &&
    prev.date === next.date &&
    prev.flight === next.flight &&
    prev.mark === next.mark &&
    prev.box === next.box &&
    prev.weightKg === next.weightKg &&
    prev.rmb === next.rmb &&
    prev.amount === next.amount &&
    prev.status === next.status
  );
}

/**
 * Immutable Purchase row array updater with reference-preserving bailout.
 * Returns the exact `prev` array reference when the target row is missing or its value did not change,
 * and preserves object references for all unchanged sibling rows.
 */
export function updatePurchaseRowById(
  prev: PurchaseItemRow[],
  id: string,
  field: 'item' | 'quantity' | 'rate',
  value: string | number
): PurchaseItemRow[] {
  let changed = false;
  const next = prev.map((row) => {
    if (row.id !== id) return row;
    if (row.locked) return row;

    const updated: PurchaseItemRow = { ...row };
    if (field === 'item') {
      updated.item = String(value);
    } else if (field === 'quantity') {
      const qty = Number(value) || 0;
      updated.quantity = qty;
      updated.totalAmount = calculatePurchaseRowTotal(qty, updated.rate);
      updated.balance = updated.totalAmount;
    } else if (field === 'rate') {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        const isEmptyOrSignOnly =
          trimmed === '' ||
          trimmed === '+' ||
          trimmed === '-' ||
          trimmed === '.' ||
          trimmed === '+.' ||
          trimmed === '-.';
        updated.rate = parseSignedNumber(trimmed);
        updated.rateSpecified = !isEmptyOrSignOnly;
      } else {
        updated.rate = parseSignedNumber(value);
        updated.rateSpecified = true;
      }
      updated.totalAmount = calculatePurchaseRowTotal(updated.quantity, updated.rate);
      updated.balance = updated.totalAmount;
    }

    if (isPurchaseRowDataEqual(row, updated)) {
      return row;
    }
    changed = true;
    return updated;
  });

  return changed ? next : prev;
}

/**
 * Immutable Packing row array updater with reference-preserving bailout.
 * Returns the exact `prev` array reference when the target row is missing or its value did not change,
 * and preserves object references for all unchanged sibling rows.
 */
export function updatePackingRowById(
  prev: PackingItemRow[],
  id: string,
  field: keyof PackingItemRow,
  value: string | number
): PackingItemRow[] {
  let changed = false;
  const next = prev.map((row) => {
    if (row.id !== id) return row;
    if (row.locked) return row;

    const updated: PackingItemRow = { ...row, [field]: value };
    const b = field === 'box' ? Number(value) || 0 : row.box;
    const w = field === 'weight' ? Number(value) || 0 : row.weight;
    const rw =
      field === 'reportWeight'
        ? Number(value) || 0
        : Number(row.reportWeight) || 0;
    const r = field === 'rate' ? Number(value) || 0 : row.rate;

    const calcs = calculatePackingRow(b, w, r, rw);
    updated.totalWeight = calcs.totalWeight;
    updated.amount = calcs.amount;

    if (isPackingRowDataEqual(row, updated)) {
      return row;
    }
    changed = true;
    return updated;
  });

  return changed ? next : prev;
}

/**
 * Immutable Exporter Payment custom row array updater with reference-preserving bailout.
 */
export function updateCustomExporterPaymentRowById(
  prev: PaymentItemRow[],
  id: string,
  field: 'description' | 'debitAmount' | 'reportAmount' | 'creditAmount' | 'status',
  value: string | number
): PaymentItemRow[] {
  let changed = false;
  const next = prev.map((row) => {
    if (row.id !== id) return row;
    if (row[field] === value) return row;

    const updated: PaymentItemRow = { ...row, [field]: value };
    const rep =
      field === 'reportAmount' ? Number(value) || 0 : (row.reportAmount ?? 0);
    const cred =
      field === 'creditAmount' ? Number(value) || 0 : row.creditAmount;
    updated.balance = calculatePaymentRow(rep, cred);

    if (isExporterHistoryRowDataEqual(row, updated)) {
      return row;
    }
    changed = true;
    return updated;
  });

  return changed ? next : prev;
}

/**
 * Immutable Air Way Bill custom row array updater with reference-preserving bailout.
 */
export function updateCustomAirWayBillRowById(
  prev: AirWayBillRow[],
  id: string,
  field: 'rmbPerBox' | 'rate' | 'date' | 'shipper' | 'documentsHolder' | 'flight' | 'totalBox',
  rawValue: string
): AirWayBillRow[] {
  let changed = false;
  const next = prev.map((row) => {
    if (row.id !== id) return row;
    const updated: AirWayBillRow = { ...row };
    if (
      field === 'date' ||
      field === 'shipper' ||
      field === 'documentsHolder' ||
      field === 'flight'
    ) {
      updated[field] = rawValue;
    } else if (field === 'rate') {
      const trimmed = rawValue.trim();
      const isEmptyOrSignOnly =
        trimmed === '' ||
        trimmed === '+' ||
        trimmed === '-' ||
        trimmed === '.' ||
        trimmed === '+.' ||
        trimmed === '-.';
      updated.rate = parseSignedNumber(rawValue);
      updated.rateSpecified = !isEmptyOrSignOnly;
    } else {
      updated[field] = parseSignedNumber(rawValue);
    }
    const computed = calculateAirWayBillRow(
      updated.totalBox,
      updated.rmbPerBox,
      updated.rate
    );
    updated.totalRmb = computed.totalRmb;
    updated.bdtAmount = computed.bdtAmount;

    if (isAirWayBillRowDataEqual(row, updated)) {
      return row;
    }
    changed = true;
    return updated;
  });

  return changed ? next : prev;
}

/**
 * Immutable Exporter Payment Slip custom row array updater with reference-preserving bailout.
 */
export function updateCustomExporterSlipRowById(
  prev: ExporterPaymentSlipRow[],
  id: string,
  field: keyof ExporterPaymentSlipRow,
  value: string | number
): ExporterPaymentSlipRow[] {
  let changed = false;
  const next = prev.map((item) => {
    if (item.id !== id) return item;
    const updated: ExporterPaymentSlipRow = { ...item };

    if (field === 'date') {
      updated.date = String(value);
    } else if (field === 'flight') {
      updated.flight = String(value).toUpperCase();
    } else if (field === 'mark') {
      updated.mark = String(value).toUpperCase();
    } else if (field === 'box') {
      updated.box = Number(value) || 0;
    } else if (field === 'weightKg') {
      const newWeight = Number(value) || 0;
      updated.weightKg = newWeight;
      if (Number(updated.rmb) > 0) {
        updated.amount = calculateExporterSlipRowAmount(newWeight, updated.rmb);
      }
    } else if (field === 'rmb') {
      const newRmb = Number(value) || 0;
      updated.rmb = newRmb;
      updated.amount = calculateExporterSlipRowAmount(updated.weightKg, newRmb);
    } else if (field === 'amount') {
      updated.amount = Number(value) || 0;
      updated.rmb = 0;
    } else if (field === 'status') {
      updated.status = String(value);
    }

    if (isExporterSlipRowDataEqual(item, updated)) {
      return item;
    }
    changed = true;
    return updated;
  });

  return changed ? next : prev;
}
