import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  ExporterStatus,
} from '../types/index.ts';
import { calculatePackingTotalAmountBDT } from './calculations.ts';

export type BatchDbViewType = 'purchase' | 'packing' | 'payment';

export const BATCH_STATUS_OPTIONS: readonly ExporterStatus[] = [
  'PAID',
  'UNPAID',
  'PARTIAL',
  'PENDING',
  'REPORT',
  'NO REPORT',
] as const;

export interface BulkSelectionState {
  allSelected: boolean;
  someSelected: boolean;
  selectedVisibleCount: number;
  totalSelectedCount: number;
}

/**
 * Computes header checkbox state (checked vs indeterminate) and counts for bulk selection.
 */
export function computeBulkSelectionState(
  visibleIds: string[],
  selectedIds: string[]
): BulkSelectionState {
  const selectedSet = new Set(selectedIds);
  let selectedVisibleCount = 0;
  for (const id of visibleIds) {
    if (selectedSet.has(id)) {
      selectedVisibleCount++;
    }
  }
  const allSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someSelected = selectedVisibleCount > 0 && !allSelected;

  return {
    allSelected,
    someSelected,
    selectedVisibleCount,
    totalSelectedCount: selectedIds.length,
  };
}

/**
 * Toggles bulk selection for all currently visible row IDs.
 * If all visible rows are already selected, deselects them; otherwise selects all visible rows.
 */
export function toggleBulkSelectAll(
  visibleIds: string[],
  selectedIds: string[]
): string[] {
  if (visibleIds.length === 0) return [];
  const { allSelected } = computeBulkSelectionState(visibleIds, selectedIds);
  if (allSelected) {
    const visibleSet = new Set(visibleIds);
    return selectedIds.filter((id) => !visibleSet.has(id));
  }
  const combined = new Set([...selectedIds, ...visibleIds]);
  return Array.from(combined);
}

/**
 * Toggles selection for a single row ID.
 */
export function toggleBulkSelectRow(
  id: string,
  selectedIds: string[]
): string[] {
  if (selectedIds.includes(id)) {
    return selectedIds.filter((item) => item !== id);
  }
  return [...selectedIds, id];
}

/**
 * Resolves the effective display status for a PurchaseRecord.
 */
export function resolvePurchaseRecordStatus(record: PurchaseRecord): ExporterStatus {
  if (record.status && record.status.trim().length > 0) {
    return record.status.trim().toUpperCase();
  }
  const totalPayable =
    (Number(record.totalAmount) || 0) + (Number(record.previousAmount) || 0);
  const paid = Number(record.paidAmount) || 0;
  const bal =
    record.balance !== undefined
      ? Number(record.balance)
      : totalPayable - paid;

  if (bal <= 0 && totalPayable > 0) return 'PAID';
  if (paid > 0 && bal > 0) return 'PARTIAL';
  return 'UNPAID';
}

/**
 * Resolves the effective display status for a PackingRecord.
 */
export function resolvePackingRecordStatus(record: PackingRecord): ExporterStatus {
  if (record.paymentStatus && record.paymentStatus.trim().length > 0) {
    return record.paymentStatus.trim().toUpperCase();
  }
  if (record.exporterStatus && record.exporterStatus.trim().length > 0) {
    return record.exporterStatus.trim().toUpperCase();
  }
  return 'UNPAID';
}

/**
 * Resolves the effective display status for a PaymentRecord.
 */
export function resolvePaymentRecordStatus(record: PaymentRecord): ExporterStatus {
  if (record.status && record.status.trim().length > 0) {
    return record.status.trim().toUpperCase();
  }
  return 'PAID';
}

export interface PurchaseBatchPatch {
  date?: string;
  description?: string;
  contactNumber?: string;
  status?: ExporterStatus;
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
 * Builds the update payload when applying a batch status update to a PurchaseRecord.
 */
export function buildBatchStatusUpdateForPurchase(
  record: PurchaseRecord,
  nextStatus: ExporterStatus
): Partial<PurchaseRecord> {
  const cleanStatus = (nextStatus || '').trim().toUpperCase();
  if (!cleanStatus) return {};

  const totalPayable = Math.round(
    ((Number(record.totalAmount) || 0) + (Number(record.previousAmount) || 0)) * 100
  ) / 100;

  if (cleanStatus === 'PAID') {
    return {
      status: 'PAID',
      paidAmount: totalPayable,
      balance: 0,
    };
  }
  if (cleanStatus === 'UNPAID') {
    return {
      status: 'UNPAID',
      paidAmount: 0,
      balance: totalPayable,
    };
  }
  return {
    status: cleanStatus,
  };
}

/**
 * Builds the update payload when applying a batch status update to a PackingRecord.
 */
export function buildBatchStatusUpdateForPacking(
  _record: PackingRecord,
  nextStatus: ExporterStatus
): Partial<PackingRecord> {
  const cleanStatus = (nextStatus || '').trim().toUpperCase();
  if (!cleanStatus) return {};
  return {
    paymentStatus: cleanStatus,
    exporterStatus: cleanStatus,
  };
}

/**
 * Builds the update payload when applying a batch status update to a PaymentRecord.
 */
export function buildBatchStatusUpdateForPayment(
  record: PaymentRecord,
  nextStatus: ExporterStatus
): Partial<PaymentRecord> {
  const cleanStatus = (nextStatus || '').trim().toUpperCase();
  if (!cleanStatus) return {};

  const updatedItems = Array.isArray(record.items)
    ? record.items.map((item) => ({
        ...item,
        status: cleanStatus,
      }))
    : record.items;

  return {
    status: cleanStatus,
    ...(updatedItems ? { items: updatedItems } : {}),
  };
}

/**
 * Filters a list of records after a batch delete operation.
 */
export function filterRecordsAfterBatchDelete<T extends { id: string }>(
  records: T[],
  idsToDelete: string[]
): {
  remaining: T[];
  deleted: T[];
  deletedCount: number;
} {
  const deleteSet = new Set(idsToDelete);
  const remaining: T[] = [];
  const deleted: T[] = [];

  for (const rec of records) {
    if (deleteSet.has(rec.id)) {
      deleted.push(rec);
    } else {
      remaining.push(rec);
    }
  }

  return {
    remaining,
    deleted,
    deletedCount: deleted.length,
  };
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
  if (patch.status && patch.status.trim().length > 0) {
    Object.assign(
      updates,
      buildBatchStatusUpdateForPurchase(record, patch.status.trim())
    );
  }
  if (patch.settleFullBalance) {
    const totalPayable =
      (Number(record.totalAmount) || 0) + (Number(record.previousAmount) || 0);
    updates.paidAmount = Math.round(totalPayable * 100) / 100;
    updates.balance = 0;
    updates.status = 'PAID';
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
    const cleanStatus = patch.paymentStatus.trim().toUpperCase();
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
  record: PaymentRecord,
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
    Object.assign(
      updates,
      buildBatchStatusUpdateForPayment(record, patch.status.trim())
    );
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
