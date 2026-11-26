/* eslint-disable no-restricted-globals */
/**
 * ZSB AQUATICS — Dedicated Background Sync Service Worker
 *
 * Persists offline data-entry mutations inside IndexedDB (`zsb_bg_sync_queue_db`)
 * and flushes them back to active application clients via the Background Sync API
 * (`sync` event) and `BroadcastChannel` as soon as connectivity is restored, so the
 * client pushes them atomically into `localStorage` and React state.
 */

const DB_NAME = 'zsb_bg_sync_queue_db';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';
const SYNC_TAG = 'zsb-offline-data-sync';
const CHANNEL_NAME = 'zsb-bg-sync-channel';

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putQueueItem(item) {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllQueueItems() {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = Array.isArray(req.result) ? req.result : [];
      items.sort((a, b) => {
        const t = Date.parse(a.queuedAt || '') - Date.parse(b.queuedAt || '');
        if (!Number.isNaN(t) && t !== 0) return t;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteQueueItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllQueueItems() {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function broadcastMessage(payload) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // Ignore channel errors
  }

  try {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clientList) {
      client.postMessage(payload);
    }
  } catch {
    // Ignore client postMessage errors
  }
}

async function triggerFlushToClients(source) {
  const items = await getAllQueueItems();
  if (items.length === 0) {
    await broadcastMessage({
      type: 'BG_SYNC_QUEUE_UPDATED',
      items: [],
      source,
    });
    return;
  }

  await broadcastMessage({
    type: 'BG_SYNC_FLUSH_BATCH',
    items,
    source,
    triggeredAt: new Date().toISOString(),
  });
}

const RUNTIME_CACHE = 'zsb-aquatics-runtime-v1';
const FONT_CACHE = 'zsb-aquatics-fonts-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(RUNTIME_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== RUNTIME_CACHE && k !== FONT_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cache-first for Google Fonts
  if (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh && (fresh.status === 200 || fresh.status === 0)) {
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Only cache same-origin app assets & navigations
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for HTML navigations with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(RUNTIME_CACHE);
          return (await cache.match(req)) || (await cache.match('/')) || Response.error();
        })
    );
    return;
  }

  // Stale-while-revalidate for static assets (JS, CSS, images, icons)
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(triggerFlushToClients('sw-sync-event'));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data.type !== 'string') return;
  const replyPort = event.ports && event.ports[0] ? event.ports[0] : null;

  const respond = (payload) => {
    if (replyPort) {
      replyPort.postMessage(payload);
    }
  };

  event.waitUntil(
    (async () => {
      try {
        switch (data.type) {
          case 'ENQUEUE_ACTION': {
            if (data.action && data.action.id) {
              await putQueueItem(data.action);
            }
            const items = await getAllQueueItems();
            respond({ ok: true, items });
            await broadcastMessage({
              type: 'BG_SYNC_QUEUE_UPDATED',
              items,
              source: 'sw-enqueue',
            });
            break;
          }
          case 'GET_QUEUE': {
            const items = await getAllQueueItems();
            respond({ ok: true, items });
            break;
          }
          case 'FLUSH_QUEUE': {
            const items = await getAllQueueItems();
            respond({ ok: true, items });
            await triggerFlushToClients(data.source || 'client-online-trigger');
            break;
          }
          case 'ACK_ITEMS': {
            await deleteQueueItems(data.ids || []);
            const items = await getAllQueueItems();
            respond({ ok: true, items });
            await broadcastMessage({
              type: 'BG_SYNC_QUEUE_UPDATED',
              items,
              source: 'sw-ack',
            });
            break;
          }
          case 'REMOVE_ITEM': {
            if (data.id) {
              await deleteQueueItems([data.id]);
            }
            const items = await getAllQueueItems();
            respond({ ok: true, items });
            await broadcastMessage({
              type: 'BG_SYNC_QUEUE_UPDATED',
              items,
              source: 'sw-remove',
            });
            break;
          }
          case 'CLEAR_QUEUE': {
            await clearAllQueueItems();
            respond({ ok: true, items: [] });
            await broadcastMessage({
              type: 'BG_SYNC_QUEUE_UPDATED',
              items: [],
              source: 'sw-clear',
            });
            break;
          }
          default:
            respond({ ok: false, error: 'Unknown message type' });
        }
      } catch (err) {
        respond({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })()
  );
});
