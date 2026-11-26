import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_COLUMN_WIDTH_PX,
  MIN_COLUMN_WIDTH_PX,
  StorageLike,
  TABLE_COLUMN_WIDTHS_STORAGE_PREFIX,
  buildUserColumnWidthsStorageKey,
  clampColumnWidth,
  computeResizedColumnWidth,
  deriveColumnResizeKey,
  deriveTableResizeKey,
  loadUserColumnWidths,
  normalizeHeaderToken,
  normalizeUserColumnWidthKey,
  persistUserColumnWidths,
  removeColumnWidthForUser,
  resetTableColumnWidthsForUser,
  sanitizeUserColumnWidthsMap,
  saveColumnWidthForUser,
} from './tableColumnWidths';

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

test('normalizeUserColumnWidthKey and storage key isolate users cleanly', () => {
  assert.equal(normalizeUserColumnWidthKey('  Sohel  '), 'sohel');
  assert.equal(normalizeUserColumnWidthKey('User@Example.COM'), 'user@example.com');
  assert.equal(normalizeUserColumnWidthKey(''), 'guest');
  assert.equal(normalizeUserColumnWidthKey(null), 'guest');
  assert.equal(
    buildUserColumnWidthsStorageKey('Sohel'),
    `${TABLE_COLUMN_WIDTHS_STORAGE_PREFIX}sohel`
  );
  assert.notEqual(
    buildUserColumnWidthsStorageKey('sohel'),
    buildUserColumnWidthsStorageKey('mizan')
  );
});

test('clampColumnWidth and computeResizedColumnWidth honor bounds and CSS zoom', () => {
  assert.equal(clampColumnWidth(12), MIN_COLUMN_WIDTH_PX);
  assert.equal(clampColumnWidth(2400), MAX_COLUMN_WIDTH_PX);
  assert.equal(clampColumnWidth(185.6), 186);
  assert.equal(clampColumnWidth(Number.NaN), MIN_COLUMN_WIDTH_PX);

  // 100% zoom
  assert.equal(computeResizedColumnWidth(160, 45, 1), 205);
  assert.equal(computeResizedColumnWidth(160, -200, 1), MIN_COLUMN_WIDTH_PX);

  // 125% zoom: moving pointer 100px right equals 80 CSS layout px
  assert.equal(computeResizedColumnWidth(160, 100, 1.25), 240);
  // 50% zoom: moving pointer 50px right equals 100 CSS layout px
  assert.equal(computeResizedColumnWidth(160, 50, 0.5), 260);
  // Invalid zoom falls back to 1
  assert.equal(computeResizedColumnWidth(160, 40, 0), 200);
});

test('deriveTableResizeKey prioritizes explicit IDs and stays stable across header reorder', () => {
  assert.equal(
    deriveTableResizeKey({
      tableIdAttr: 'purchase_db',
      firstHeaderTableId: 'other',
      headerTexts: ['SL', 'Date'],
    }),
    'purchase_db'
  );

  assert.equal(
    deriveTableResizeKey({
      firstHeaderTableId: 'export_db_v1',
      headerTexts: ['SL', 'Date'],
    }),
    'export_db_v1'
  );

  const keyOrderA = deriveTableResizeKey({
    headerTexts: ['Date ▲', 'Supplier / Description', 'Amount (TK)'],
  });
  const keyOrderB = deriveTableResizeKey({
    headerTexts: ['Amount (TK)', 'Date ▼', 'Supplier / Description'],
  });
  assert.equal(keyOrderA, keyOrderB);
  assert.equal(normalizeHeaderToken('Supplier / Description ▲'), 'supplier_description');
});

test('deriveColumnResizeKey prioritizes data-column-id and disambiguates duplicate headers', () => {
  const used = new Set<string>();
  assert.equal(
    deriveColumnResizeKey({
      columnIdAttr: 'supplierName',
      headerText: 'Supplier',
      columnIndex: 2,
      usedKeys: used,
    }),
    'supplierName'
  );
  assert.equal(
    deriveColumnResizeKey({
      headerText: 'Amount',
      columnIndex: 3,
      usedKeys: used,
    }),
    'amount'
  );
  assert.equal(
    deriveColumnResizeKey({
      headerText: 'Amount',
      columnIndex: 4,
      usedKeys: used,
    }),
    'amount__2'
  );
  assert.equal(
    deriveColumnResizeKey({
      headerText: '',
      columnIndex: 5,
      usedKeys: used,
    }),
    'col_5'
  );
});

test('per-user localStorage persistence saves, restores, isolates, removes, and resets widths', () => {
  const storage = createMemoryStorage();

  // Save widths for user 'sohel'
  saveColumnWidthForUser('sohel', 'purchase_db', 'supplier', 340, storage);
  saveColumnWidthForUser('sohel', 'purchase_db', 'invoiceNo', 165, storage);

  // Save different width for user 'mizan'
  saveColumnWidthForUser('mizan', 'purchase_db', 'supplier', 220, storage);

  assert.deepEqual(loadUserColumnWidths('sohel', storage), {
    purchase_db: { supplier: 340, invoiceNo: 165 },
  });
  assert.deepEqual(loadUserColumnWidths('mizan', storage), {
    purchase_db: { supplier: 220 },
  });
  assert.deepEqual(loadUserColumnWidths('guest', storage), {});

  // Remove a single column for 'sohel' without touching 'invoiceNo' or 'mizan'
  removeColumnWidthForUser('sohel', 'purchase_db', 'supplier', storage);
  assert.deepEqual(loadUserColumnWidths('sohel', storage), {
    purchase_db: { invoiceNo: 165 },
  });
  assert.deepEqual(loadUserColumnWidths('mizan', storage), {
    purchase_db: { supplier: 220 },
  });

  // Removing the last column for a table removes the empty storage key completely
  removeColumnWidthForUser('sohel', 'purchase_db', 'invoiceNo', storage);
  assert.deepEqual(loadUserColumnWidths('sohel', storage), {});
  assert.equal(
    storage.getItem(buildUserColumnWidthsStorageKey('sohel')),
    null
  );

  // Resetting an entire table clears it cleanly
  saveColumnWidthForUser('mizan', 'export_db', 'buyer', 280, storage);
  resetTableColumnWidthsForUser('mizan', 'purchase_db', storage);
  assert.deepEqual(loadUserColumnWidths('mizan', storage), {
    export_db: { buyer: 280 },
  });
});

test('sanitizeUserColumnWidthsMap and loadUserColumnWidths recover safely from corrupt storage', () => {
  const storage = createMemoryStorage();
  const key = buildUserColumnWidthsStorageKey('sohel');
  storage.setItem(key, '{not-valid-json');
  assert.deepEqual(loadUserColumnWidths('sohel', storage), {});

  const sanitized = sanitizeUserColumnWidthsMap({
    purchase_db: {
      supplier: 310.4,
      tooSmall: 10,
      tooLarge: 9999,
      invalidStr: '200',
      negative: -50,
    },
    emptyTable: {
      bad: null,
    },
  });

  assert.deepEqual(sanitized, {
    purchase_db: {
      supplier: 310,
      tooSmall: MIN_COLUMN_WIDTH_PX,
      tooLarge: MAX_COLUMN_WIDTH_PX,
    },
  });

  persistUserColumnWidths('sohel', {}, storage);
  assert.equal(storage.getItem(key), null);
});

test('COL_RESIZE_EXCLUDED_SELECTOR excludes print/PDF containers but keeps custom-scroll interactive tables resizable', async () => {
  const { COL_RESIZE_EXCLUDED_SELECTOR } = await import('./tableColumnWidths');
  assert.match(COL_RESIZE_EXCLUDED_SELECTOR, /\.zsb-print-paper/);
  assert.match(COL_RESIZE_EXCLUDED_SELECTOR, /#printable-document/);
  assert.match(COL_RESIZE_EXCLUDED_SELECTOR, /#global-pdf-export-host/);
  assert.doesNotMatch(
    COL_RESIZE_EXCLUDED_SELECTOR,
    /data-manual-scroll-viewport/
  );
  assert.doesNotMatch(COL_RESIZE_EXCLUDED_SELECTOR, /data-row-scroll-managed/);
});

