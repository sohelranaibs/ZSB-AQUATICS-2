import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPurchaseBatchUpdate,
  buildPackingBatchUpdate,
  buildPaymentBatchUpdate,
  countActiveBatchFields,
  computeBulkSelectionState,
  toggleBulkSelectAll,
  toggleBulkSelectRow,
  resolvePurchaseRecordStatus,
  resolvePackingRecordStatus,
  resolvePaymentRecordStatus,
  buildBatchStatusUpdateForPurchase,
  buildBatchStatusUpdateForPacking,
  buildBatchStatusUpdateForPayment,
  filterRecordsAfterBatchDelete,
} from './batchDatabaseUpdate.ts';
import { PurchaseRecord, PackingRecord, PaymentRecord } from '../types/index.ts';

test('buildPurchaseBatchUpdate applies supplier, contact, date, and full balance settlement', () => {
  const samplePurchase: PurchaseRecord = {
    id: 'pur-1',
    invoiceNumber: 'INV-2026-0001',
    date: '2026-10-01',
    description: 'OLD SUPPLIER',
    contactNumber: '01700000000',
    items: [],
    totalQty: 100,
    totalAmount: 50000,
    previousAmount: 10000,
    paidAmount: 20000,
    balance: 40000,
    createdAt: '2026-10-01T00:00:00Z',
  };

  const patch = {
    date: '2026-10-31',
    description: 'ABDULLAH VAI',
    contactNumber: '+8801711223344',
    settleFullBalance: true,
    remarks: 'Bulk settled',
  };

  const result = buildPurchaseBatchUpdate(samplePurchase, patch);
  assert.equal(result.date, '2026-10-31');
  assert.equal(result.description, 'ABDULLAH VAI');
  assert.equal(result.contactNumber, '+8801711223344');
  assert.equal(result.paidAmount, 60000);
  assert.equal(result.balance, 0);
  assert.equal(result.status, 'PAID');
  assert.equal(result.remarks, 'Bulk settled');
  assert.equal(countActiveBatchFields(patch), 5);
});

test('buildPackingBatchUpdate applies shipping mark, flight, destination, RMB rate and recalculates BDT total', () => {
  const samplePacking: PackingRecord = {
    id: 'pkg-1',
    invoiceNumber: 'PKG-2026-0001',
    shippingMark: 'OLD-MARK',
    flight: 'CZ-392',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    packingDate: '2026-10-01',
    fromDate: '2026-10-01',
    toDate: '2026-10-01',
    items: [],
    totalBox: 20,
    totalWeight: 400,
    totalAmount: 10000, // RMB
    createdAt: '2026-10-01T00:00:00Z',
  };

  const patch = {
    packingDate: '2026-10-31',
    shippingMark: 'AAD',
    flight: 'MU-2036',
    destination: 'KUNMING',
    rmbRate: 16.5,
    paymentStatus: 'PAID' as const,
  };

  const result = buildPackingBatchUpdate(samplePacking, patch);
  assert.equal(result.packingDate, '2026-10-31');
  assert.equal(result.shippingMark, 'AAD');
  assert.equal(result.flight, 'MU-2036');
  assert.equal(result.destination, 'KUNMING');
  assert.equal(result.rmbRate, 16.5);
  assert.equal(result.totalAmountBDT, 165000);
  assert.equal(result.paymentStatus, 'PAID');
  assert.equal(result.exporterStatus, 'PAID');
  assert.equal(countActiveBatchFields(patch), 6);
});

test('buildPaymentBatchUpdate applies status, category, export ref, and date', () => {
  const samplePayment: PaymentRecord = {
    id: 'pay-1',
    invoiceNumber: 'PAY-2026-0001',
    date: '2026-10-01',
    description: 'PARTY A',
    contactNumber: '',
    items: [
      {
        id: '1',
        description: 'Row 1',
        debitAmount: 25000,
        creditAmount: 25000,
        balance: 0,
        status: 'UNPAID',
      },
    ],
    totalAmount: 25000,
    previousAmount: 0,
    paidAmount: 25000,
    balance: 0,
    status: 'UNPAID',
    returnRMB: 0,
    createdAt: '2026-10-01T00:00:00Z',
  };

  const patch = {
    date: '2026-10-31',
    status: 'PAID' as const,
    paymentCategory: 'exporter' as const,
    exportGoodsRef: 'AWB-8899',
  };

  const result = buildPaymentBatchUpdate(samplePayment, patch);
  assert.equal(result.date, '2026-10-31');
  assert.equal(result.status, 'PAID');
  assert.equal(result.items?.[0]?.status, 'PAID');
  assert.equal(result.paymentCategory, 'exporter');
  assert.equal(result.exportGoodsRef, 'AWB-8899');
  assert.equal(countActiveBatchFields(patch), 4);
});

test('computeBulkSelectionState, toggleBulkSelectAll, and toggleBulkSelectRow handle header and row selection accurately', () => {
  const visible = ['id-1', 'id-2', 'id-3'];

  const emptyState = computeBulkSelectionState(visible, []);
  assert.equal(emptyState.allSelected, false);
  assert.equal(emptyState.someSelected, false);
  assert.equal(emptyState.selectedVisibleCount, 0);

  const oneSelected = toggleBulkSelectRow('id-2', []);
  assert.deepEqual(oneSelected, ['id-2']);

  const partialState = computeBulkSelectionState(visible, oneSelected);
  assert.equal(partialState.allSelected, false);
  assert.equal(partialState.someSelected, true);
  assert.equal(partialState.selectedVisibleCount, 1);

  const allSelectedIds = toggleBulkSelectAll(visible, oneSelected);
  assert.equal(allSelectedIds.length, 3);
  const fullState = computeBulkSelectionState(visible, allSelectedIds);
  assert.equal(fullState.allSelected, true);
  assert.equal(fullState.someSelected, false);
  assert.equal(fullState.selectedVisibleCount, 3);

  const clearedIds = toggleBulkSelectAll(visible, allSelectedIds);
  assert.deepEqual(clearedIds, []);
});

test('batch status update helpers and status resolvers work across purchase, packing, and payment records', () => {
  const pur: PurchaseRecord = {
    id: 'pur-10',
    invoiceNumber: 'INV-10',
    date: '2026-11-01',
    description: 'SUPPLIER X',
    contactNumber: '',
    items: [],
    totalQty: 50,
    totalAmount: 10000,
    previousAmount: 2000,
    paidAmount: 4000,
    balance: 8000,
    createdAt: '2026-11-01T00:00:00Z',
  };

  assert.equal(resolvePurchaseRecordStatus(pur), 'PARTIAL');

  const purPaidPatch = buildBatchStatusUpdateForPurchase(pur, 'PAID');
  assert.equal(purPaidPatch.status, 'PAID');
  assert.equal(purPaidPatch.paidAmount, 12000);
  assert.equal(purPaidPatch.balance, 0);
  assert.equal(resolvePurchaseRecordStatus({ ...pur, ...purPaidPatch }), 'PAID');

  const purUnpaidPatch = buildBatchStatusUpdateForPurchase(pur, 'UNPAID');
  assert.equal(purUnpaidPatch.status, 'UNPAID');
  assert.equal(purUnpaidPatch.paidAmount, 0);
  assert.equal(purUnpaidPatch.balance, 12000);

  const pkg: PackingRecord = {
    id: 'pkg-10',
    invoiceNumber: 'PKG-10',
    shippingMark: 'MK',
    flight: 'CZ-1',
    destination: 'CAN',
    shipper: 'ZSB',
    packingDate: '2026-11-01',
    fromDate: '2026-11-01',
    toDate: '2026-11-01',
    items: [],
    totalBox: 10,
    totalWeight: 200,
    totalAmount: 5000,
    createdAt: '2026-11-01T00:00:00Z',
  };
  assert.equal(resolvePackingRecordStatus(pkg), 'UNPAID');
  const pkgPatch = buildBatchStatusUpdateForPacking(pkg, 'REPORT');
  assert.equal(pkgPatch.paymentStatus, 'REPORT');
  assert.equal(pkgPatch.exporterStatus, 'REPORT');
  assert.equal(resolvePackingRecordStatus({ ...pkg, ...pkgPatch }), 'REPORT');

  const pay: PaymentRecord = {
    id: 'pay-10',
    invoiceNumber: 'PAY-10',
    date: '2026-11-01',
    description: 'SUPPLIER X',
    contactNumber: '',
    items: [],
    totalAmount: 5000,
    previousAmount: 0,
    paidAmount: 5000,
    balance: 0,
    status: 'PENDING',
    returnRMB: 0,
    createdAt: '2026-11-01T00:00:00Z',
  };
  assert.equal(resolvePaymentRecordStatus(pay), 'PENDING');
  const payPatch = buildBatchStatusUpdateForPayment(pay, 'PAID');
  assert.equal(payPatch.status, 'PAID');
});

test('filterRecordsAfterBatchDelete removes selected IDs and preserves unselected rows', () => {
  const rows = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }];
  const res = filterRecordsAfterBatchDelete(rows, ['r2', 'r4']);
  assert.equal(res.deletedCount, 2);
  assert.deepEqual(
    res.remaining.map((r) => r.id),
    ['r1', 'r3']
  );
  assert.deepEqual(
    res.deleted.map((r) => r.id),
    ['r2', 'r4']
  );
});
