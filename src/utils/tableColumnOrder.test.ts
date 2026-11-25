import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeColumnOrder,
  reorderColumns,
  moveColumnByOffset,
  isCustomColumnOrder,
  loadTableColumnOrder,
  saveTableColumnOrder,
  resetTableColumnOrder,
  TABLE_COLUMN_ORDER_STORAGE_KEY,
} from './tableColumnOrder';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

test('sanitizeColumnOrder preserves valid order, removes stale/duplicate IDs, and appends new columns', () => {
  const defaults = ['date', 'invoice', 'supplier', 'amount', 'status'];
  const sanitized = sanitizeColumnOrder(
    ['amount', 'stale_col', 'date', 'amount', 123, 'supplier'],
    defaults
  );
  assert.deepEqual(sanitized, ['amount', 'date', 'supplier', 'invoice', 'status']);
  assert.deepEqual(sanitizeColumnOrder(null, defaults), defaults);
  assert.deepEqual(sanitizeColumnOrder('bad', defaults), defaults);
});

test('reorderColumns moves columns accurately with explicit before/after drop sides and implicit target slot', () => {
  const initial = ['a', 'b', 'c', 'd', 'e'];

  // Move right-to-left before target
  assert.deepEqual(reorderColumns(initial, 'd', 'b', 'before'), [
    'a',
    'd',
    'b',
    'c',
    'e',
  ]);

  // Move left-to-right after target
  assert.deepEqual(reorderColumns(initial, 'a', 'd', 'after'), [
    'b',
    'c',
    'd',
    'a',
    'e',
  ]);

  // Move left-to-right before target
  assert.deepEqual(reorderColumns(initial, 'a', 'd', 'before'), [
    'b',
    'c',
    'a',
    'd',
    'e',
  ]);

  // Implicit slot move
  assert.deepEqual(reorderColumns(initial, 'e', 'b'), [
    'a',
    'e',
    'b',
    'c',
    'd',
  ]);

  // No-op cases return identical reference
  assert.equal(reorderColumns(initial, 'b', 'b'), initial);
  assert.equal(reorderColumns(initial, 'b', 'c', 'before'), initial);
  assert.equal(reorderColumns(initial, 'c', 'b', 'after'), initial);
  assert.equal(reorderColumns(initial, 'missing', 'b'), initial);
});

test('moveColumnByOffset shifts columns left/right and bails out at boundaries', () => {
  const initial = ['a', 'b', 'c'];
  assert.deepEqual(moveColumnByOffset(initial, 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveColumnByOffset(initial, 'b', 1), ['a', 'c', 'b']);
  assert.equal(moveColumnByOffset(initial, 'a', -1), initial);
  assert.equal(moveColumnByOffset(initial, 'c', 1), initial);
  assert.equal(moveColumnByOffset(initial, 'z', 1), initial);
});

test('isCustomColumnOrder detects default vs customized orders accurately', () => {
  const defaults = ['a', 'b', 'c'];
  assert.equal(isCustomColumnOrder(['a', 'b', 'c'], defaults), false);
  assert.equal(isCustomColumnOrder(['b', 'a', 'c'], defaults), true);
  assert.equal(isCustomColumnOrder(['a', 'b'], defaults), true);
});

test('loadTableColumnOrder, saveTableColumnOrder, and resetTableColumnOrder persist per-table layouts safely', () => {
  const storage = createMemoryStorage();
  const purchaseDefaults = ['invoice', 'date', 'supplier', 'total'];
  const packingDefaults = ['packingNo', 'flight', 'mark', 'weight'];

  // Default load on empty storage
  assert.deepEqual(
    loadTableColumnOrder('purchase_db', purchaseDefaults, storage),
    purchaseDefaults
  );

  // Save custom order for two tables independently
  saveTableColumnOrder(
    'purchase_db',
    ['total', 'invoice', 'date', 'supplier'],
    purchaseDefaults,
    storage
  );
  saveTableColumnOrder(
    'packing_db',
    ['flight', 'mark', 'packingNo', 'weight'],
    packingDefaults,
    storage
  );

  assert.deepEqual(
    loadTableColumnOrder('purchase_db', purchaseDefaults, storage),
    ['total', 'invoice', 'date', 'supplier']
  );
  assert.deepEqual(
    loadTableColumnOrder('packing_db', packingDefaults, storage),
    ['flight', 'mark', 'packingNo', 'weight']
  );

  // Resetting one table does not affect the other
  resetTableColumnOrder('purchase_db', storage);
  assert.deepEqual(
    loadTableColumnOrder('purchase_db', purchaseDefaults, storage),
    purchaseDefaults
  );
  assert.deepEqual(
    loadTableColumnOrder('packing_db', packingDefaults, storage),
    ['flight', 'mark', 'packingNo', 'weight']
  );

  // Saving default order cleans up storage entry
  saveTableColumnOrder('packing_db', packingDefaults, packingDefaults, storage);
  assert.equal(storage.getItem(TABLE_COLUMN_ORDER_STORAGE_KEY), null);

  // Corrupted storage falls back cleanly to defaults
  storage.setItem(TABLE_COLUMN_ORDER_STORAGE_KEY, '{broken-json');
  assert.deepEqual(
    loadTableColumnOrder('purchase_db', purchaseDefaults, storage),
    purchaseDefaults
  );
});
