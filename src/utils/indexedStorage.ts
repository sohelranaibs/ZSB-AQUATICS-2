import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

/**
 * Indexed DB configuration constants
 */
export const INDEXED_DB_NAME = 'ZSBAquaticsDatabaseDB';
export const INDEXED_DB_VERSION = 1;

export const DB_STORE_NAMES = {
  PURCHASES: 'purchases',
  PACKINGS: 'packings',
  PAYMENTS: 'payments',
  OTHER_COSTS: 'otherCosts',
  SNAPSHOTS: 'snapshots',
  AUDIT_LOGS: 'auditLogs',
} as const;

export type DbStoreName = typeof DB_STORE_NAMES[keyof typeof DB_STORE_NAMES];

/**
 * Interface for Indexed Search Queries
 */
export interface IndexedQueryOptions {
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  partyFilter?: string; // supplierName or shippingMark
  categoryFilter?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * Structure representing built in-memory index structures for quick dataset querying
 */
export interface DatasetIndices<T> {
  recordMap: Map<string, T>;
  invoiceMap: Map<string, T>;
  dateIndex: Map<string, string[]>; // YYYY-MM-DD -> record IDs
  partyIndex: Map<string, string[]>; // Normalized party name -> record IDs
  tokenInvertedIndex: Map<string, Set<string>>; // Token -> Set of record IDs
}

/**
 * Normalize string for exact and prefix token matching
 */
export function normalizeIndexKey(val: string | null | undefined): string {
  return String(val || '')
    .trim()
    .toUpperCase();
}

/**
 * Tokenize string into lowercase search terms for inverted index
 */
export function tokenizeText(text: string | null | undefined): string[] {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 0);
}

/**
 * Builds an inverted index and exact hash maps for any record set
 */
export function buildDatasetIndices<T extends { id: string }>(
  records: T[],
  extractors: {
    getInvoice?: (rec: T) => string | undefined;
    getDate?: (rec: T) => string | undefined;
    getParty?: (rec: T) => string | undefined;
    getSearchableText?: (rec: T) => string;
  }
): DatasetIndices<T> {
  const recordMap = new Map<string, T>();
  const invoiceMap = new Map<string, T>();
  const dateIndex = new Map<string, string[]>();
  const partyIndex = new Map<string, string[]>();
  const tokenInvertedIndex = new Map<string, Set<string>>();

  for (const rec of records) {
    if (!rec || !rec.id) continue;
    recordMap.set(rec.id, rec);

    // 1. Invoice Indexing
    if (extractors.getInvoice) {
      const inv = normalizeIndexKey(extractors.getInvoice(rec));
      if (inv) {
        invoiceMap.set(inv, rec);
      }
    }

    // 2. Date Indexing
    if (extractors.getDate) {
      const d = extractors.getDate(rec);
      if (d) {
        const dateKey = d.slice(0, 10);
        const existing = dateIndex.get(dateKey) || [];
        existing.push(rec.id);
        dateIndex.set(dateKey, existing);
      }
    }

    // 3. Party Indexing
    if (extractors.getParty) {
      const party = normalizeIndexKey(extractors.getParty(rec));
      if (party) {
        const existing = partyIndex.get(party) || [];
        existing.push(rec.id);
        partyIndex.set(party, existing);
      }
    }

    // 4. Token Inverted Index
    if (extractors.getSearchableText) {
      const fullText = extractors.getSearchableText(rec);
      const tokens = tokenizeText(fullText);
      for (const tok of tokens) {
        let set = tokenInvertedIndex.get(tok);
        if (!set) {
          set = new Set<string>();
          tokenInvertedIndex.set(tok, set);
        }
        set.add(rec.id);
      }
    }
  }

  return {
    recordMap,
    invoiceMap,
    dateIndex,
    partyIndex,
    tokenInvertedIndex,
  };
}

/**
 * Fast search and retrieval utilizing inverted token indices and hash maps
 */
export function queryIndexedRecords<T extends { id: string }>(
  records: T[],
  indices: DatasetIndices<T>,
  options: IndexedQueryOptions
): T[] {
  const { searchTerm = '', startDate = '', endDate = '', partyFilter = 'ALL' } = options;

  let candidateIds: Set<string> | null = null;

  // 1. Party Filter optimization using hash lookup
  const normParty = normalizeIndexKey(partyFilter);
  if (normParty && normParty !== 'ALL') {
    const partyMatchIds = indices.partyIndex.get(normParty) || [];
    candidateIds = new Set(partyMatchIds);
    if (candidateIds.size === 0) return [];
  }

  // 2. Tokenized inverted index search
  const queryTokens = tokenizeText(searchTerm);
  if (queryTokens.length > 0) {
    let tokenMatchIds: Set<string> | null = null;

    for (const tok of queryTokens) {
      const matchingIdsForTok = new Set<string>();
      // Match exact token or prefix tokens in inverted index
      indices.tokenInvertedIndex.forEach((idSet, indexTok) => {
        if (indexTok.includes(tok)) {
          idSet.forEach((id) => matchingIdsForTok.add(id));
        }
      });

      if (tokenMatchIds === null) {
        tokenMatchIds = matchingIdsForTok;
      } else {
        // Intersect sets for AND search
        const intersected = new Set<string>();
        tokenMatchIds.forEach((id) => {
          if (matchingIdsForTok.has(id)) {
            intersected.add(id);
          }
        });
        tokenMatchIds = intersected;
      }
    }

    if (tokenMatchIds !== null) {
      if (candidateIds === null) {
        candidateIds = tokenMatchIds;
      } else {
        const combined = new Set<string>();
        candidateIds.forEach((id) => {
          if (tokenMatchIds!.has(id)) {
            combined.add(id);
          }
        });
        candidateIds = combined;
      }
    }
  }

  // Determine target records pool
  let targetRecords: T[];
  if (candidateIds !== null) {
    targetRecords = Array.from(candidateIds)
      .map((id) => indices.recordMap.get(id))
      .filter((rec): rec is T => rec !== undefined);
  } else {
    targetRecords = records;
  }

  // 3. Date Range Filter
  if (startDate || endDate) {
    targetRecords = targetRecords.filter((rec) => {
      const recDate = (rec as any).date || (rec as any).packingDate;
      if (!recDate) return false;
      const target = String(recDate).slice(0, 10);
      if (startDate && target < startDate) return false;
      if (endDate && target > endDate) return false;
      return true;
    });
  }

  return targetRecords;
}

/**
 * Asynchronous IndexedDB Storage Driver with fallback for browser persistence
 */
export class IndexedDBStorageDriver {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.dbPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        if (typeof window === 'undefined' || !window.indexedDB) {
          resolve(null);
          return;
        }

        const request = window.indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(DB_STORE_NAMES.PURCHASES)) {
            const store = db.createObjectStore(DB_STORE_NAMES.PURCHASES, { keyPath: 'id' });
            store.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
            store.createIndex('date', 'date', { unique: false });
            store.createIndex('description', 'description', { unique: false });
          }

          if (!db.objectStoreNames.contains(DB_STORE_NAMES.PACKINGS)) {
            const store = db.createObjectStore(DB_STORE_NAMES.PACKINGS, { keyPath: 'id' });
            store.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
            store.createIndex('packingDate', 'packingDate', { unique: false });
            store.createIndex('shippingMark', 'shippingMark', { unique: false });
          }

          if (!db.objectStoreNames.contains(DB_STORE_NAMES.PAYMENTS)) {
            const store = db.createObjectStore(DB_STORE_NAMES.PAYMENTS, { keyPath: 'id' });
            store.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
            store.createIndex('date', 'date', { unique: false });
            store.createIndex('description', 'description', { unique: false });
          }

          if (!db.objectStoreNames.contains(DB_STORE_NAMES.OTHER_COSTS)) {
            const store = db.createObjectStore(DB_STORE_NAMES.OTHER_COSTS, { keyPath: 'id' });
            store.createIndex('date', 'date', { unique: false });
            store.createIndex('category', 'category', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  public async saveCollection<T extends { id: string }>(
    storeName: DbStoreName,
    records: T[]
  ): Promise<boolean> {
    try {
      if (!this.dbPromise) return false;
      const db = await this.dbPromise;
      if (!db) return false;

      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();

        for (const rec of records) {
          store.put(rec);
        }

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  public async loadCollection<T>(storeName: DbStoreName): Promise<T[] | null> {
    try {
      if (!this.dbPromise) return null;
      const db = await this.dbPromise;
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }
}

export const indexedStorageDriver = new IndexedDBStorageDriver();
