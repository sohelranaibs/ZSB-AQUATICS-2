import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countLockedRows,
  countUnlockedPopulatedRows,
  getRowLockLabel,
  hydrateLoadedRowsWithFinalizedLock,
  isPopulatedPackingRow,
  isPopulatedPurchaseRow,
  isRowLocked,
  lockPopulatedRows,
  toggleRowLockById,
  unlockAllRows,
} from './rowLock.ts';
import { PackingItemRow, PurchaseItemRow } from '../types/index.ts';

const makePurchaseRow = (overrides: Partial<PurchaseItemRow> = {}): PurchaseItemRow => ({
  id: 'p1',
  item: 'XL',
  quantity: 10,
  rate: 500,
  rateSpecified: true,
  totalAmount: 5000,
  previousAmount: 0,
  paidAmount: 0,
  balance: 5000,
  ...overrides,
});

const makePackingRow = (overrides: Partial<PackingItemRow> = {}): PackingItemRow => ({
  id: 'k1',
  item: 'BIG-3XL',
  box: 5,
  weight: 20,
  reportWeight: 0,
  totalWeight: 100,
  unit: 'KG',
  rate: 45,
  amount: 4500,
  ...overrides,
});

test('toggleRowLockById locks and unlocks a single row while preserving sibling references', () => {
  const rows: PurchaseItemRow[] = [
    makePurchaseRow({ id: 'p1' }),
    makePurchaseRow({ id: 'p2', item: '2XL' }),
  ];

  const locked = toggleRowLockById(rows, 'p1', 'manual', '2026-11-23T10:00:00.000Z');
  assert.equal(isRowLocked(locked[0]), true);
  assert.equal(locked[0].lockReason, 'manual');
  assert.equal(locked[0].lockedAt, '2026-11-23T10:00:00.000Z');
  assert.equal(locked[1], rows[1]);
  assert.equal(getRowLockLabel(locked[0]), 'Locked');
  assert.equal(getRowLockLabel(locked[1]), 'Unlocked');

  const unlocked = toggleRowLockById(locked, 'p1');
  assert.equal(isRowLocked(unlocked[0]), false);
  assert.equal(unlocked[0].lockReason, undefined);
  assert.equal(unlocked[0].lockedAt, undefined);
  assert.equal(unlocked[1], rows[1]);

  // Unknown id returns original array reference
  assert.equal(toggleRowLockById(rows, 'non-existent'), rows);
});

test('lockPopulatedRows locks only populated rows and respects exported precedence', () => {
  const rows: PackingItemRow[] = [
    makePackingRow({ id: 'k1' }),
    makePackingRow({
      id: 'k2',
      item: '',
      box: 0,
      weight: 0,
      reportWeight: 0,
      totalWeight: 0,
      rate: 0,
      amount: 0,
    }),
  ];

  const finalized = lockPopulatedRows(
    rows,
    isPopulatedPackingRow,
    'finalized',
    '2026-11-23T10:00:00.000Z'
  );
  assert.equal(finalized[0].locked, true);
  assert.equal(finalized[0].lockReason, 'finalized');
  assert.equal(getRowLockLabel(finalized[0]), 'Locked (Finalized)');
  assert.equal(finalized[1], rows[1]); // Empty row untouched
  assert.equal(countLockedRows(finalized), 1);
  assert.equal(countUnlockedPopulatedRows(finalized, isPopulatedPackingRow), 0);

  // Exporting upgrades finalized -> exported
  const exported = lockPopulatedRows(
    finalized,
    isPopulatedPackingRow,
    'exported',
    '2026-11-23T10:05:00.000Z'
  );
  assert.equal(exported[0].lockReason, 'exported');
  assert.equal(getRowLockLabel(exported[0]), 'Locked (Exported)');

  // Re-finalizing preserves exported reason
  const reFinalized = lockPopulatedRows(
    exported,
    isPopulatedPackingRow,
    'finalized',
    '2026-11-23T10:10:00.000Z'
  );
  assert.equal(reFinalized, exported);
  assert.equal(reFinalized[0].lockReason, 'exported');
});

test('unlockAllRows clears locks cleanly and bails out when none are locked', () => {
  const rows: PurchaseItemRow[] = [
    makePurchaseRow({ id: 'p1', locked: true, lockReason: 'exported', lockedAt: '2026-11-23T10:00:00.000Z' }),
    makePurchaseRow({ id: 'p2' }),
  ];

  assert.equal(countLockedRows(rows), 1);
  assert.equal(countUnlockedPopulatedRows(rows, isPopulatedPurchaseRow), 1);

  const unlocked = unlockAllRows(rows);
  assert.equal(countLockedRows(unlocked), 0);
  assert.equal(unlocked[0].locked, false);
  assert.equal(unlocked[0].lockReason, undefined);
  assert.equal(unlocked[1], rows[1]);

  // Calling again returns exact same reference
  assert.equal(unlockAllRows(unlocked), unlocked);
});

test('hydrateLoadedRowsWithFinalizedLock auto-locks legacy and exported saved items', () => {
  const legacyItems: PurchaseItemRow[] = [
    makePurchaseRow({ id: 'legacy-1' }), // locked is undefined
    makePurchaseRow({ id: 'explicit-open', locked: false }),
  ];

  const hydratedFinalized = hydrateLoadedRowsWithFinalizedLock(legacyItems, {
    createdAt: '2026-11-20T09:00:00.000Z',
  });
  assert.equal(hydratedFinalized[0].locked, true);
  assert.equal(hydratedFinalized[0].lockReason, 'finalized');
  assert.equal(hydratedFinalized[0].lockedAt, '2026-11-20T09:00:00.000Z');
  assert.equal(hydratedFinalized[1].locked, false);

  const hydratedExported = hydrateLoadedRowsWithFinalizedLock(legacyItems, {
    exportedAt: '2026-11-21T12:00:00.000Z',
  });
  assert.equal(hydratedExported[0].locked, true);
  assert.equal(hydratedExported[0].lockReason, 'exported');
  assert.equal(hydratedExported[0].lockedAt, '2026-11-21T12:00:00.000Z');
});
