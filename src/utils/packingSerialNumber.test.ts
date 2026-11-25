import test from 'node:test';
import assert from 'node:assert/strict';
import { PackingRecord } from '../types/index.ts';
import {
  isValidPackingSerialNumber,
  getNextPackingSerialNumber,
  ensurePackingSerialNumbers,
  buildPackingSerialNumberMap,
} from './packingSerialNumber.ts';
import { sortPackingRecords } from './databaseSorting.ts';

function makePacking(overrides: Partial<PackingRecord> & { id: string }): PackingRecord {
  return {
    id: overrides.id,
    invoiceNumber: overrides.invoiceNumber ?? `PKG-${overrides.id}`,
    shippingMark: overrides.shippingMark ?? 'MARK-A',
    flight: overrides.flight ?? 'CZ CAN',
    destination: overrides.destination ?? 'GUANGZHOU',
    shipper: overrides.shipper ?? 'ZSB AQUATICS',
    packingDate: overrides.packingDate ?? '2026-10-01',
    fromDate: overrides.fromDate ?? '2026-10-01',
    toDate: overrides.toDate ?? '2026-10-01',
    items: overrides.items ?? [],
    totalBox: overrides.totalBox ?? 5,
    totalWeight: overrides.totalWeight ?? 80,
    totalAmount: overrides.totalAmount ?? 8000,
    rmbRate: overrides.rmbRate ?? 17,
    createdAt: overrides.createdAt ?? '2026-10-01T08:00:00Z',
    ...(overrides.serialNumber !== undefined ? { serialNumber: overrides.serialNumber } : {}),
  };
}

test('ensurePackingSerialNumbers backfills legacy records chronologically and is idempotent', () => {
  assert.equal(isValidPackingSerialNumber(1), true);
  assert.equal(isValidPackingSerialNumber(0), false);
  assert.equal(isValidPackingSerialNumber(-2), false);
  assert.equal(isValidPackingSerialNumber(1.5), false);
  assert.equal(isValidPackingSerialNumber(undefined), false);

  // Stored newest-first (as AppContext prepends new records), without serialNumber
  const legacyPackings = [
    makePacking({ id: 'p3', invoiceNumber: 'PKG-003', packingDate: '2026-10-03', createdAt: '2026-10-03T10:00:00Z' }),
    makePacking({ id: 'p1', invoiceNumber: 'PKG-001', packingDate: '2026-10-01', createdAt: '2026-10-01T10:00:00Z' }),
    makePacking({ id: 'p2', invoiceNumber: 'PKG-002', packingDate: '2026-10-02', createdAt: '2026-10-02T10:00:00Z' }),
  ];

  const normalized = ensurePackingSerialNumbers(legacyPackings);
  // Original array order preserved, but chronological creation gets 1, 2, 3
  assert.equal(normalized[0].id, 'p3');
  assert.equal(normalized[0].serialNumber, 3);
  assert.equal(normalized[1].id, 'p1');
  assert.equal(normalized[1].serialNumber, 1);
  assert.equal(normalized[2].id, 'p2');
  assert.equal(normalized[2].serialNumber, 2);

  // Idempotent: returns exact same reference when all serials are already valid & unique
  const secondPass = ensurePackingSerialNumbers(normalized);
  assert.equal(secondPass, normalized);
});

test('getNextPackingSerialNumber auto-increments without renumbering after deletions', () => {
  const afterDeletion = [
    makePacking({ id: 'p1', serialNumber: 1 }),
    makePacking({ id: 'p3', serialNumber: 3 }),
  ];

  // Even though row #2 was deleted, next S. No. must be 4 and existing rows stay 1 and 3
  assert.equal(getNextPackingSerialNumber(afterDeletion), 4);

  const withNewRecord = ensurePackingSerialNumbers([
    makePacking({ id: 'p4', createdAt: '2026-10-04T10:00:00Z' }),
    ...afterDeletion,
  ]);
  assert.equal(withNewRecord.find((r) => r.id === 'p1')?.serialNumber, 1);
  assert.equal(withNewRecord.find((r) => r.id === 'p3')?.serialNumber, 3);
  assert.equal(withNewRecord.find((r) => r.id === 'p4')?.serialNumber, 4);
});

test('persistent S. No. remains consistent under sorting and filtering', () => {
  const records = ensurePackingSerialNumbers([
    makePacking({ id: 'p1', shippingMark: 'BANGLA', totalBox: 5, packingDate: '2026-10-01', createdAt: '2026-10-01T08:00:00Z' }),
    makePacking({ id: 'p2', shippingMark: 'RAKIB', totalBox: 2, packingDate: '2026-10-02', createdAt: '2026-10-02T08:00:00Z' }),
    makePacking({ id: 'p3', shippingMark: 'WCM', totalBox: 9, packingDate: '2026-10-03', createdAt: '2026-10-03T08:00:00Z' }),
  ]);

  const snoMap = buildPackingSerialNumberMap(records);
  assert.equal(snoMap.get('p1'), 1);
  assert.equal(snoMap.get('p2'), 2);
  assert.equal(snoMap.get('p3'), 3);

  // Sort ascending by totalBox -> order is p2 (2), p1 (5), p3 (9), but S. No. stays 2, 1, 3
  const sortedByBox = sortPackingRecords(records, { column: 'totalBox', direction: 'asc' });
  assert.deepEqual(
    sortedByBox.map((r) => ({ id: r.id, sno: r.serialNumber })),
    [
      { id: 'p2', sno: 2 },
      { id: 'p1', sno: 1 },
      { id: 'p3', sno: 3 },
    ]
  );

  // Sort descending by S. No. -> order is 3, 2, 1
  const sortedBySnoDesc = sortPackingRecords(records, { column: 'serialNumber', direction: 'desc' });
  assert.deepEqual(
    sortedBySnoDesc.map((r) => r.serialNumber),
    [3, 2, 1]
  );

  // Filter down to only RAKIB -> persistent S. No. remains 2 (NOT reset to 1)
  const filtered = sortedByBox.filter((r) => r.shippingMark === 'RAKIB');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].serialNumber, 2);
  assert.equal(snoMap.get(filtered[0].id), 2);
});
