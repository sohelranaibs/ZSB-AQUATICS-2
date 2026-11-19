import {
  BG_SYNC_CHANNEL_NAME,
  BG_SYNC_DB_NAME,
  BG_SYNC_STORE_NAME,
  BG_SYNC_TAG,
  OfflineSyncAction,
  deduplicateQueuedActions,
} from './backgroundSyncQueue.ts';

export interface BackgroundSyncStatus {
  supported: boolean;
  swActive: boolean;
  syncApiSupported: boolean;
  registrationScope: string | null;
}

export type BackgroundSyncEvent =
  | {
      type: 'BG_SYNC_QUEUE_UPDATED';
      items: OfflineSyncAction[];
      source?: string;
    }
  | {
      type: 'BG_SYNC_FLUSH_BATCH';
      items: OfflineSyncAction[];
      source?: string;
      triggeredAt?: string;
    };

const BG_SYNC_SW_URL = '/bg-sync-sw.js';
const BG_SYNC_SW_SCOPE = '/bg-sync/';

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let cachedRegistration: ServiceWorkerRegistration | null = null;

// --- Direct IndexedDB Fallback (same schema as SW so data is shared seamlessly) ---
function openFallbackDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BG_SYNC_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BG_SYNC_STORE_NAME)) {
        const store = db.createObjectStore(BG_SYNC_STORE_NAME, { keyPath: 'id' });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fallbackGetAll(): Promise<OfflineSyncAction[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openFallbackDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BG_SYNC_STORE_NAME, 'readonly');
      const req = tx.objectStore(BG_SYNC_STORE_NAME).getAll();
      req.onsuccess = () =>
        resolve(deduplicateQueuedActions((req.result as OfflineSyncAction[]) || []));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function fallbackPut(action: OfflineSyncAction): Promise<OfflineSyncAction[]> {
  if (typeof indexedDB === 'undefined') return [action];
  try {
    const db = await openFallbackDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BG_SYNC_STORE_NAME, 'readwrite');
      tx.objectStore(BG_SYNC_STORE_NAME).put(action);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IDB failure
  }
  return fallbackGetAll();
}

async function fallbackDeleteIds(ids: string[]): Promise<OfflineSyncAction[]> {
  if (typeof indexedDB === 'undefined' || ids.length === 0) return fallbackGetAll();
  try {
    const db = await openFallbackDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BG_SYNC_STORE_NAME, 'readwrite');
      const store = tx.objectStore(BG_SYNC_STORE_NAME);
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
  return fallbackGetAll();
}

async function fallbackClear(): Promise<OfflineSyncAction[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openFallbackDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BG_SYNC_STORE_NAME, 'readwrite');
      tx.objectStore(BG_SYNC_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
  return [];
}

async function waitForActiveWorker(
  reg: ServiceWorkerRegistration,
  timeoutMs: number = 3500
): Promise<ServiceWorker | null> {
  if (reg.active) return reg.active;
  const candidate = reg.installing || reg.waiting;
  if (!candidate) return null;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolve(reg.active || null);
    }, timeoutMs);

    const onStateChange = () => {
      if (candidate.state === 'activated' || reg.active) {
        window.clearTimeout(timer);
        candidate.removeEventListener('statechange', onStateChange);
        resolve(reg.active || candidate);
      } else if (candidate.state === 'redundant') {
        window.clearTimeout(timer);
        candidate.removeEventListener('statechange', onStateChange);
        resolve(null);
      }
    };

    candidate.addEventListener('statechange', onStateChange);
  });
}

export async function registerBackgroundSyncServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (cachedRegistration && cachedRegistration.active) {
    return cachedRegistration;
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(BG_SYNC_SW_URL, { scope: BG_SYNC_SW_SCOPE })
      .then(async (reg) => {
        await waitForActiveWorker(reg);
        cachedRegistration = reg;
        return reg;
      })
      .catch(() => {
        registrationPromise = null;
        return null;
      });
  }

  return registrationPromise;
}

export async function getBackgroundSyncStatus(): Promise<BackgroundSyncStatus> {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator;
  if (!supported) {
    return {
      supported: false,
      swActive: false,
      syncApiSupported: false,
      registrationScope: null,
    };
  }

  const reg = await registerBackgroundSyncServiceWorker();
  const syncApiSupported = Boolean(reg && 'sync' in reg);

  return {
    supported: true,
    swActive: Boolean(reg?.active),
    syncApiSupported,
    registrationScope: reg?.scope || null,
  };
}

async function postToSyncWorker<TResponse = { ok: boolean; items?: OfflineSyncAction[] }>(
  message: Record<string, unknown>,
  timeoutMs: number = 2500
): Promise<TResponse | null> {
  const reg = await registerBackgroundSyncServiceWorker();
  const worker = reg?.active;
  if (!worker) return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve((event.data as TResponse) || null);
    };

    try {
      worker.postMessage(message, [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

async function registerNativeBackgroundSyncTag(): Promise<boolean> {
  const reg = await registerBackgroundSyncServiceWorker();
  if (!reg) return false;

  const syncReg = reg as ServiceWorkerRegistration & {
    sync?: { register: (tag: string) => Promise<void> };
  };

  if (syncReg.sync && typeof syncReg.sync.register === 'function') {
    try {
      await syncReg.sync.register(BG_SYNC_TAG);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function enqueueOfflineAction(
  action: OfflineSyncAction
): Promise<OfflineSyncAction[]> {
  const swResponse = await postToSyncWorker({
    type: 'ENQUEUE_ACTION',
    action,
  });

  await registerNativeBackgroundSyncTag();

  if (swResponse?.ok && Array.isArray(swResponse.items)) {
    return deduplicateQueuedActions(swResponse.items);
  }

  return fallbackPut(action);
}

export async function getPendingSyncActions(): Promise<OfflineSyncAction[]> {
  const swResponse = await postToSyncWorker({ type: 'GET_QUEUE' });
  if (swResponse?.ok && Array.isArray(swResponse.items)) {
    return deduplicateQueuedActions(swResponse.items);
  }
  return fallbackGetAll();
}

export async function requestBackgroundSyncFlush(
  source: string = 'client-online-trigger'
): Promise<OfflineSyncAction[]> {
  const swResponse = await postToSyncWorker({
    type: 'FLUSH_QUEUE',
    source,
  });
  if (swResponse?.ok && Array.isArray(swResponse.items)) {
    return deduplicateQueuedActions(swResponse.items);
  }
  return fallbackGetAll();
}

export async function acknowledgeSyncedActions(
  ids: string[]
): Promise<OfflineSyncAction[]> {
  if (ids.length === 0) return getPendingSyncActions();
  const swResponse = await postToSyncWorker({
    type: 'ACK_ITEMS',
    ids,
  });
  if (swResponse?.ok && Array.isArray(swResponse.items)) {
    return deduplicateQueuedActions(swResponse.items);
  }
  return fallbackDeleteIds(ids);
}

export async function removeQueuedSyncAction(id: string): Promise<OfflineSyncAction[]> {
  const swResponse = await postToSyncWorker({
    type: 'REMOVE_ITEM',
    id,
  });
  if (swResponse?.ok && Array.isArray(swResponse.items)) {
    return deduplicateQueuedActions(swResponse.items);
  }
  return fallbackDeleteIds([id]);
}

export async function clearQueuedSyncActions(): Promise<OfflineSyncAction[]> {
  const swResponse = await postToSyncWorker({ type: 'CLEAR_QUEUE' });
  if (swResponse?.ok && Array.isArray(swResponse.items)) {
    return [];
  }
  return fallbackClear();
}

export function subscribeToBackgroundSyncEvents(
  listener: (event: BackgroundSyncEvent) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handlePayload = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return;
    const msg = raw as BackgroundSyncEvent;
    if (msg.type === 'BG_SYNC_QUEUE_UPDATED' || msg.type === 'BG_SYNC_FLUSH_BATCH') {
      listener({
        ...msg,
        items: deduplicateQueuedActions(Array.isArray(msg.items) ? msg.items : []),
      });
    }
  };

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(BG_SYNC_CHANNEL_NAME);
      channel.onmessage = (event) => handlePayload(event.data);
    } catch {
      channel = null;
    }
  }

  const handleSwMessage = (event: MessageEvent) => {
    handlePayload(event.data);
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
  }

  return () => {
    if (channel) {
      channel.close();
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  };
}
