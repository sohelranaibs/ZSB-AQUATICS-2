import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  ExporterStatus,
} from '../types/index.ts';
import { calculatePackingTotalAmountBDT } from './calculations.ts';

export type BatchDbViewType = 'purchase' | 'packing' | 'payment';

export interface PurchaseBatchPatch {
  date?: string;
  description?: string;
  contactNumber?: string;
  remarks?: string;
  settleFullBalance?: boolean;
}

export interface PackingBatchPatch {
  packingDate?: string;
  shippingMark?: string;
  flight?: string;
  destination?: string;
  shipper?: string;
  rmbRate?: number;
  paymentStatus?: ExporterStatus;
  remarks?: string;
}

export interface PaymentBatchPatch {
  date?: string;
  description?: string;
  status?: ExporterStatus;
  paymentCategory?: 'supplier' | 'exporter';
  exportGoodsRef?: string;
  remarks?: string;
}

/**
 * Computes the partial update payload for a single PurchaseRecord based on the batch patch.
 */
export function buildPurchaseBatchUpdate(
  record: PurchaseRecord,
  patch: PurchaseBatchPatch
): Partial<PurchaseRecord> {
  const updates: Partial<PurchaseRecord> = {};

  if (patch.date && patch.date.trim().length > 0) {
    updates.date = patch.date.trim();
  }
  if (patch.description && patch.description.trim().length > 0) {
    updates.description = patch.description.trim();
  }
  if (patch.contactNumber && patch.contactNumber.trim().length > 0) {
    updates.contactNumber = patch.contactNumber.trim();
  }
  if (patch.remarks && patch.remarks.trim().length > 0) {
    updates.remarks = patch.remarks.trim();
  }
  if (patch.settleFullBalance) {
    const totalPayable =
      (Number(record.totalAmount) || 0) + (Number(record.previousAmount) || 0);
    updates.paidAmount = Math.round(totalPayable * 100) / 100;
    updates.balance = 0;
  }

  return updates;
}

/**
 * Computes the partial update payload for a single PackingRecord based on the batch patch.
 */
export function buildPackingBatchUpdate(
  record: PackingRecord,
  patch: PackingBatchPatch
): Partial<PackingRecord> {
  const updates: Partial<PackingRecord> = {};

  if (patch.packingDate && patch.packingDate.trim().length > 0) {
    const cleanDate = patch.packingDate.trim();
    updates.packingDate = cleanDate;
    updates.fromDate = cleanDate;
    updates.toDate = cleanDate;
  }
  if (patch.shippingMark && patch.shippingMark.trim().length > 0) {
    updates.shippingMark = patch.shippingMark.trim();
  }
  if (patch.flight && patch.flight.trim().length > 0) {
    updates.flight = patch.flight.trim();
  }
  if (patch.destination && patch.destination.trim().length > 0) {
    updates.destination = patch.destination.trim();
  }
  if (patch.shipper && patch.shipper.trim().length > 0) {
    updates.shipper = patch.shipper.trim();
  }
  if (
    typeof patch.rmbRate === 'number' &&
    Number.isFinite(patch.rmbRate) &&
    patch.rmbRate >= 0
  ) {
    updates.rmbRate = patch.rmbRate;
    updates.totalAmountBDT = calculatePackingTotalAmountBDT(
      record.totalAmount,
      patch.rmbRate
    );
  }
  if (patch.paymentStatus && patch.paymentStatus.trim().length > 0) {
    const cleanStatus = patch.paymentStatus.trim();
    updates.paymentStatus = cleanStatus;
    updates.exporterStatus = cleanStatus;
  }
  if (patch.remarks && patch.remarks.trim().length > 0) {
    updates.remarks = patch.remarks.trim();
  }

  return updates;
}

/**
 * Computes the partial update payload for a single PaymentRecord based on the batch patch.
 */
export function buildPaymentBatchUpdate(
  _record: PaymentRecord,
  patch: PaymentBatchPatch
): Partial<PaymentRecord> {
  const updates: Partial<PaymentRecord> = {};

  if (patch.date && patch.date.trim().length > 0) {
    updates.date = patch.date.trim();
  }
  if (patch.description && patch.description.trim().length > 0) {
    updates.description = patch.description.trim();
  }
  if (patch.status && patch.status.trim().length > 0) {
    updates.status = patch.status.trim();
  }
  if (
    patch.paymentCategory === 'supplier' ||
    patch.paymentCategory === 'exporter'
  ) {
    updates.paymentCategory = patch.paymentCategory;
  }
  if (patch.exportGoodsRef && patch.exportGoodsRef.trim().length > 0) {
    updates.exportGoodsRef = patch.exportGoodsRef.trim();
  }
  if (patch.remarks && patch.remarks.trim().length > 0) {
    updates.remarks = patch.remarks.trim();
  }

  return updates;
}

/**
 * Counts how many fields are populated in a given batch patch object.
 */
export function countActiveBatchFields(
  patch: PurchaseBatchPatch | PackingBatchPatch | PaymentBatchPatch
): number {
  let count = 0;
  for (const [key, val] of Object.entries(patch)) {
    if (key === 'settleFullBalance') {
      if (val === true) count++;
    } else if (typeof val === 'number') {
      if (Number.isFinite(val) && val >= 0) count++;
    } else if (typeof val === 'string') {
      if (val.trim().length > 0) count++;
    }
  }
  return count;
}
