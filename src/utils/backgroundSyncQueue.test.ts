import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQueuedActionsToCollections,
  createOfflineSyncAction,
  deduplicateQueuedActions,
  summarizeSyncQueue,
  SyncQueueCollections,
} from './backgroundSyncQueue';
import type { PurchaseRecord, PackingRecord, OtherCostRecord } from '../types/index';

const emptyCollections: SyncQueueCollections = {
  purchases: [],
  packings: [],
  payments: [],
  otherCosts: [],
  mortalities: [],
};

test('createOfflineSyncAction builds deterministic pending action payload', () => {
  const action = createOfflineSyncAction({
    id: 'sync-1',
    entity: 'purchase',
    operation: 'create',
    recordId: 'pur-101',
    label: 'PUR-2026-0101',
    summary: 'Sundarbans Crab Depot · Tk 45,000',
    payload: { id: 'pur-101', invoiceNumber: 'PUR-2026-0101' },
    queuedAt: '2026-11-19T08:00:00.000Z',
  });

  assert.equal(action.id, 'sync-1');
  assert.equal(action.status, 'pending');
  assert.equal(action.attempts, 0);
  assert.equal(action.entity, 'purchase');
});

test('deduplicateQueuedActions sorts chronologically FIFO and removes duplicate IDs', () => {
  const late = createOfflineSyncAction({
    id: 'sync-b',
    entity: 'packing',
    operation: 'create',
    recordId: 'pkg-2',
    label: 'EXP-2',
    summary: 'Second',
    payload: { id: 'pkg-2' },
    queuedAt: '2026-11-19T09:00:00.000Z',
  });
  const early = createOfflineSyncAction({
    id: 'sync-a',
    entity: 'purchase',
    operation: 'create',
    recordId: 'pur-1',
    label: 'PUR-1',
    summary: 'First',
    payload: { id: 'pur-1' },
    queuedAt: '2026-11-19T08:00:00.000Z',
  });

  const deduped = deduplicateQueuedActions([late, early, late]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, 'sync-a');
  assert.equal(deduped[1].id, 'sync-b');
});

test('applyQueuedActionsToCollections replays create + update in FIFO order idempotently', () => {
  const purchaseRecord: PurchaseRecord = {
    id: 'pur-offline-1',
    invoiceNumber: 'PUR-OFF-001',
    date: '2026-11-19',
    description: 'Khulna Depot',
    contactNumber: '01700000000',
    items: [],
    totalQty: 50,
    totalAmount: 50000,
    previousAmount: 0,
    paidAmount: 20000,
    balance: 30000,
    status: 'UNPAID',
    createdAt: '2026-11-19T08:00:00.000Z',
  };

  const packingRecord: PackingRecord = {
    id: 'pkg-offline-1',
    invoiceNumber: 'EXP-OFF-001',
    shippingMark: 'GZ-88',
    flight: 'CZ-392',
    destination: 'Guangzhou',
    shipper: 'ZSB AQUATICS',
    packingDate: '2026-11-19',
    fromDate: '2026-11-19',
    toDate: '2026-11-19',
    items: [],
    totalBox: 8,
    totalWeight: 96,
    totalAmount: 8500,
    createdAt: '2026-11-19T08:05:00.000Z',
  };

  const costRecord: OtherCostRecord = {
    id: 'cost-offline-1',
    date: '2026-11-19',
    category: 'Ice & Packaging',
    amount: 3200,
    description: 'Foam boxes',
    createdAt: '2026-11-19T08:10:00.000Z',
  };

  const actions = [
    createOfflineSyncAction({
      id: 'sync-2',
      entity: 'purchase',
      operation: 'update',
      recordId: 'pur-offline-1',
      label: 'PUR-OFF-001',
      summary: 'Mark paid',
      payload: { paidAmount: 50000, balance: 0, status: 'PAID' },
      queuedAt: '2026-11-19T08:02:00.000Z',
    }),
    createOfflineSyncAction({
      id: 'sync-1',
      entity: 'purchase',
      operation: 'create',
      recordId: 'pur-offline-1',
      label: 'PUR-OFF-001',
      summary: 'Create purchase',
      payload: purchaseRecord,
      queuedAt: '2026-11-19T08:01:00.000Z',
    }),
    createOfflineSyncAction({
      id: 'sync-3',
      entity: 'packing',
      operation: 'create',
      recordId: 'pkg-offline-1',
      label: 'EXP-OFF-001',
      summary: 'Create packing',
      payload: packingRecord,
      queuedAt: '2026-11-19T08:05:00.000Z',
    }),
    createOfflineSyncAction({
      id: 'sync-4',
      entity: 'other_cost',
      operation: 'create',
      recordId: 'cost-offline-1',
      label: 'Ice & Packaging',
      summary: 'Cost entry',
      payload: costRecord,
      queuedAt: '2026-11-19T08:10:00.000Z',
    }),
  ];

  const firstRun = applyQueuedActionsToCollections(emptyCollections, actions);
  assert.equal(firstRun.appliedCount, 4);
  assert.equal(firstRun.collections.purchases.length, 1);
  assert.equal(firstRun.collections.purchases[0].status, 'PAID');
  assert.equal(firstRun.collections.purchases[0].balance, 0);
  assert.equal(firstRun.collections.packings.length, 1);
  assert.equal(firstRun.collections.otherCosts.length, 1);

  // Re-applying the exact same create action must not duplicate records
  const secondRun = applyQueuedActionsToCollections(firstRun.collections, [actions[1]]);
  assert.equal(secondRun.collections.purchases.length, 1);
});

test('summarizeSyncQueue counts actions by entity and reports oldest queued timestamp', () => {
  const summary = summarizeSyncQueue([
    createOfflineSyncAction({
      id: 'a1',
      entity: 'purchase',
      operation: 'create',
      recordId: 'p1',
      label: 'PUR-1',
      summary: 's1',
      payload: {},
      queuedAt: '2026-11-19T07:30:00.000Z',
    }),
    createOfflineSyncAction({
      id: 'a2',
      entity: 'purchase',
      operation: 'update',
      recordId: 'p1',
      label: 'PUR-1',
      summary: 's2',
      payload: {},
      queuedAt: '2026-11-19T07:45:00.000Z',
    }),
    createOfflineSyncAction({
      id: 'a3',
      entity: 'payment',
      operation: 'create',
      recordId: 'pm1',
      label: 'PAY-1',
      summary: 's3',
      payload: {},
      queuedAt: '2026-11-19T08:00:00.000Z',
    }),
  ]);

  assert.equal(summary.totalPending, 3);
  assert.equal(summary.byEntity.purchase, 2);
  assert.equal(summary.byEntity.payment, 1);
  assert.equal(summary.oldestQueuedAt, '2026-11-19T07:30:00.000Z');
});
