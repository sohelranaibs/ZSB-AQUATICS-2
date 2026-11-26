import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIPE_MIGRATION_FLAG_KEY,
  StorageLike,
  getOverflowMarkerKey,
  hasCollectionOverflowMarker,
  persistCollectionDual,
  clearCollectionDual,
  resolveHydratedCollection,
} from './persistentCollectionStorage';
import { DB_STORE_NAMES } from './indexedStorage';

interface MockRecord {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
}

function createMemoryStorage(options?: { failQuotaKeys?: Set<string> }): StorageLike & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      if (options?.failQuotaKeys?.has(key)) {
        const err = new Error('QuotaExceededError: storage limit exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

test('persistCollectionDual saves to both localStorage and IndexedDB and sets wipe flag', async () => {
  const storage = createMemoryStorage();
  const idbStores = new Map<string, MockRecord[]>();
  const records: MockRecord[] = [
    { id: 'pur-1', invoiceNumber: 'INV-0001', totalAmount: 15000 },
    { id: 'pur-2', invoiceNumber: 'INV-0002', totalAmount: 22500 },
  ];

  const result = await persistCollectionDual({
    storageKey: 'zsb_purchases_v8',
    storeName: DB_STORE_NAMES.PURCHASES,
    records,
    storage,
    saveToIndexedDb: async (store, recs) => {
      idbStores.set(store, recs);
      return true;
    },
  });

  assert.equal(result.savedToLocalStorage, true);
  assert.equal(result.savedToIndexedDb, true);
  assert.equal(result.quotaExceeded, false);
  assert.equal(storage.getItem(WIPE_MIGRATION_FLAG_KEY), '1');
  assert.equal(hasCollectionOverflowMarker(storage, 'zsb_purchases_v8'), false);
  assert.deepEqual(JSON.parse(storage.getItem('zsb_purchases_v8') || '[]'), records);
  assert.deepEqual(idbStores.get(DB_STORE_NAMES.PURCHASES), records);
});

test('persistCollectionDual falls back to IndexedDB and sets overflow marker when localStorage hits QuotaExceededError', async () => {
  const storage = createMemoryStorage({ failQuotaKeys: new Set(['zsb_purchases_v8']) });
  // Simulate older stale data already sitting in localStorage before a large Excel import
  storage.data.set(
    'zsb_purchases_v8',
    JSON.stringify([{ id: 'pur-old', invoiceNumber: 'INV-OLD', totalAmount: 100 }])
  );
  const idbStores = new Map<string, MockRecord[]>();
  const largeImport: MockRecord[] = [
    { id: 'pur-101', invoiceNumber: 'INV-0101', totalAmount: 55000 },
    { id: 'pur-102', invoiceNumber: 'INV-0102', totalAmount: 82000 },
  ];

  const result = await persistCollectionDual({
    storageKey: 'zsb_purchases_v8',
    storeName: DB_STORE_NAMES.PURCHASES,
    records: largeImport,
    storage,
    saveToIndexedDb: async (store, recs) => {
      idbStores.set(store, recs);
      return true;
    },
  });

  assert.equal(result.savedToLocalStorage, false);
  assert.equal(result.savedToIndexedDb, true);
  assert.equal(result.quotaExceeded, true);
  // Stale localStorage value must be cleared so reload does not show stale records
  assert.equal(storage.getItem('zsb_purchases_v8'), null);
  assert.equal(storage.getItem(getOverflowMarkerKey('zsb_purchases_v8')), '1');
  assert.equal(storage.getItem(WIPE_MIGRATION_FLAG_KEY), '1');
  assert.deepEqual(idbStores.get(DB_STORE_NAMES.PURCHASES), largeImport);

  // On next page reload, localStorage yields [] while IndexedDB has largeImport
  const hydrated = resolveHydratedCollection({
    localRecords: [],
    idbRecords: idbStores.get(DB_STORE_NAMES.PURCHASES) || null,
    hasOverflowMarker: hasCollectionOverflowMarker(storage, 'zsb_purchases_v8'),
    hasUserMutated: false,
    deduplicate: (recs) => recs,
  });

  assert.equal(hydrated.shouldHydrate, true);
  assert.equal(hydrated.source, 'indexedDB');
  assert.deepEqual(hydrated.records, largeImport);
});

test('resolveHydratedCollection recovers from IndexedDB when localStorage is empty even without overflow marker', () => {
  const idbRecords: MockRecord[] = [
    { id: 'pur-1', invoiceNumber: 'INV-0001', totalAmount: 9000 },
  ];

  const hydrated = resolveHydratedCollection({
    localRecords: [],
    idbRecords,
    hasOverflowMarker: false,
    hasUserMutated: false,
    deduplicate: (recs) => recs,
  });

  assert.equal(hydrated.shouldHydrate, true);
  assert.equal(hydrated.source, 'indexedDB');
  assert.deepEqual(hydrated.records, idbRecords);
});

test('resolveHydratedCollection never overwrites in-session user mutations', () => {
  const inSessionRecords: MockRecord[] = [
    { id: 'pur-new', invoiceNumber: 'INV-NEW', totalAmount: 42000 },
  ];
  const olderIdbRecords: MockRecord[] = [
    { id: 'pur-old', invoiceNumber: 'INV-OLD', totalAmount: 1000 },
  ];

  const hydrated = resolveHydratedCollection({
    localRecords: inSessionRecords,
    idbRecords: olderIdbRecords,
    hasOverflowMarker: true,
    hasUserMutated: true,
    deduplicate: (recs) => recs,
  });

  assert.equal(hydrated.shouldHydrate, false);
  assert.deepEqual(hydrated.records, inSessionRecords);
});

test('clearCollectionDual clears both localStorage overflow marker and IndexedDB so cleared records stay cleared on reload', async () => {
  const storage = createMemoryStorage();
  storage.setItem(getOverflowMarkerKey('zsb_purchases_v8'), '1');
  const idbStores = new Map<string, { id: string }[]>();
  idbStores.set(DB_STORE_NAMES.PURCHASES, [{ id: 'pur-1' }]);

  const ok = await clearCollectionDual({
    storageKey: 'zsb_purchases_v8',
    storeName: DB_STORE_NAMES.PURCHASES,
    storage,
    saveToIndexedDb: async (store, recs) => {
      idbStores.set(store, recs);
      return true;
    },
  });

  assert.equal(ok, true);
  assert.equal(storage.getItem('zsb_purchases_v8'), '[]');
  assert.equal(hasCollectionOverflowMarker(storage, 'zsb_purchases_v8'), false);
  assert.deepEqual(idbStores.get(DB_STORE_NAMES.PURCHASES), []);

  const hydrated = resolveHydratedCollection({
    localRecords: [],
    idbRecords: idbStores.get(DB_STORE_NAMES.PURCHASES) || null,
    hasOverflowMarker: hasCollectionOverflowMarker(storage, 'zsb_purchases_v8'),
    hasUserMutated: false,
    deduplicate: (recs) => recs,
  });
  assert.equal(hydrated.shouldHydrate, false);
  assert.deepEqual(hydrated.records, []);
});
