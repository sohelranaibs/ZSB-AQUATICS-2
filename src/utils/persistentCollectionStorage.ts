import { DbStoreName } from './indexedStorage.ts';

export const WIPE_MIGRATION_FLAG_KEY = 'zsb_db_wipe_all_v12';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface PersistCollectionDualParams<T extends { id: string }> {
  storageKey: string;
  storeName: DbStoreName;
  records: T[];
  storage: StorageLike | null | undefined;
  saveToIndexedDb: (storeName: DbStoreName, records: T[]) => Promise<boolean>;
}

export interface PersistCollectionDualResult {
  savedToLocalStorage: boolean;
  savedToIndexedDb: boolean;
  quotaExceeded: boolean;
  serializedBytes: number;
}

export interface ResolveHydratedCollectionParams<T extends { id: string }> {
  localRecords: T[];
  idbRecords: T[] | null;
  hasOverflowMarker: boolean;
  hasUserMutated: boolean;
  deduplicate: (records: T[]) => T[];
}

export interface ResolveHydratedCollectionResult<T> {
  shouldHydrate: boolean;
  records: T[];
  source: 'localStorage' | 'indexedDB';
}

export function getOverflowMarkerKey(storageKey: string): string {
  return `${storageKey}__idb_overflow`;
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { name?: string; code?: number; message?: string };
  if (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014
  ) {
    return true;
  }
  const msg = String(candidate.message || '').toLowerCase();
  return msg.includes('quota') || msg.includes('exceeded');
}

export function ensureWipeMigrationFlag(storage: StorageLike | null | undefined): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(WIPE_MIGRATION_FLAG_KEY) !== '1') {
      storage.setItem(WIPE_MIGRATION_FLAG_KEY, '1');
    }
    return true;
  } catch {
    return false;
  }
}

export function hasCollectionOverflowMarker(
  storage: StorageLike | null | undefined,
  storageKey: string
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(getOverflowMarkerKey(storageKey)) === '1';
  } catch {
    return false;
  }
}

/**
 * Persists a record collection synchronously to localStorage (with graceful
 * QuotaExceededError handling) AND asynchronously to IndexedDB.
 *
 * Critically, a localStorage write failure NEVER aborts the IndexedDB write.
 * When localStorage exceeds quota, any stale localStorage payload for that key
 * is removed and a lightweight overflow marker is stored so the next page reload
 * automatically hydrates the authoritative dataset from IndexedDB.
 */
export async function persistCollectionDual<T extends { id: string }>(
  params: PersistCollectionDualParams<T>
): Promise<PersistCollectionDualResult> {
  const { storageKey, storeName, records, storage, saveToIndexedDb } = params;
  const safeRecords = Array.isArray(records) ? records : [];
  const overflowKey = getOverflowMarkerKey(storageKey);

  let savedToLocalStorage = false;
  let quotaExceeded = false;
  let serializedBytes = 0;

  if (storage) {
    ensureWipeMigrationFlag(storage);
    let serialized = '[]';
    try {
      serialized = JSON.stringify(safeRecords);
      serializedBytes = serialized.length;
    } catch {
      serialized = '[]';
      serializedBytes = 2;
    }

    try {
      storage.setItem(storageKey, serialized);
      try {
        storage.removeItem(overflowKey);
      } catch {
        // Ignore cleanup error
      }
      savedToLocalStorage = true;
    } catch (err) {
      quotaExceeded = isQuotaExceededError(err);
      // Clear stale localStorage payload so reload hydrates the latest IndexedDB copy
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore removal error
      }
      try {
        storage.setItem(WIPE_MIGRATION_FLAG_KEY, '1');
      } catch {
        // Ignore flag write error
      }
      try {
        storage.setItem(overflowKey, '1');
      } catch {
        // Ignore marker write error if storage is completely full
      }
    }
  }

  let savedToIndexedDb = false;
  try {
    savedToIndexedDb = await saveToIndexedDb(storeName, safeRecords);
  } catch {
    savedToIndexedDb = false;
  }

  return {
    savedToLocalStorage,
    savedToIndexedDb,
    quotaExceeded,
    serializedBytes,
  };
}

/**
 * Synchronous-only localStorage write helper used during pagehide/beforeunload
 * flushes where async IndexedDB commits may not finish before tab teardown.
 */
export function persistCollectionLocalSync<T extends { id: string }>(
  storageKey: string,
  records: T[],
  storage: StorageLike | null | undefined
): { savedToLocalStorage: boolean; quotaExceeded: boolean } {
  if (!storage) {
    return { savedToLocalStorage: false, quotaExceeded: false };
  }
  const safeRecords = Array.isArray(records) ? records : [];
  const overflowKey = getOverflowMarkerKey(storageKey);
  ensureWipeMigrationFlag(storage);
  try {
    storage.setItem(storageKey, JSON.stringify(safeRecords));
    try {
      storage.removeItem(overflowKey);
    } catch {
      // Ignore cleanup error
    }
    return { savedToLocalStorage: true, quotaExceeded: false };
  } catch (err) {
    const quotaExceeded = isQuotaExceededError(err);
    try {
      storage.removeItem(storageKey);
      storage.setItem(overflowKey, '1');
    } catch {
      // Ignore secondary storage errors
    }
    return { savedToLocalStorage: false, quotaExceeded };
  }
}

/**
 * Clears a collection across both localStorage (including overflow marker)
 * and IndexedDB so cleared records do not resurrect on reload.
 */
export async function clearCollectionDual(params: {
  storageKey: string;
  storeName: DbStoreName;
  storage: StorageLike | null | undefined;
  saveToIndexedDb: (storeName: DbStoreName, records: { id: string }[]) => Promise<boolean>;
}): Promise<boolean> {
  const { storageKey, storeName, storage, saveToIndexedDb } = params;
  const overflowKey = getOverflowMarkerKey(storageKey);
  if (storage) {
    ensureWipeMigrationFlag(storage);
    try {
      storage.removeItem(overflowKey);
    } catch {
      // Ignore
    }
    try {
      storage.setItem(storageKey, '[]');
    } catch {
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore
      }
    }
  }
  try {
    return await saveToIndexedDb(storeName, []);
  } catch {
    return false;
  }
}

/**
 * Pure decision function for startup hydration from IndexedDB.
 * Recovers records from IndexedDB when localStorage was empty or overflowed,
 * without ever clobbering in-session user mutations.
 */
export function resolveHydratedCollection<T extends { id: string }>(
  params: ResolveHydratedCollectionParams<T>
): ResolveHydratedCollectionResult<T> {
  const { localRecords, idbRecords, hasOverflowMarker, hasUserMutated, deduplicate } = params;

  if (hasUserMutated) {
    return {
      shouldHydrate: false,
      records: localRecords,
      source: 'localStorage',
    };
  }

  if (!Array.isArray(idbRecords) || idbRecords.length === 0) {
    return {
      shouldHydrate: false,
      records: localRecords,
      source: 'localStorage',
    };
  }

  if (hasOverflowMarker || localRecords.length === 0) {
    return {
      shouldHydrate: true,
      records: deduplicate(idbRecords),
      source: 'indexedDB',
    };
  }

  return {
    shouldHydrate: false,
    records: localRecords,
    source: 'localStorage',
  };
}
