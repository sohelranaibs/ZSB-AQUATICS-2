import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeSafeClientHmr,
  isDocumentReady,
  isTransientViteWebSocketError,
  runWhenDocumentReady,
  shouldInitializeHmrConnection,
  type DocumentLike,
  type HotContextLike,
} from './clientRuntimeGuard.ts';

function createMockDocument(
  readyState: string = 'complete',
  visibilityState: string = 'visible'
): DocumentLike & { triggerDomReady: () => void; listenerCount: number } {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    readyState,
    visibilityState,
    get listenerCount() {
      return listeners.get('DOMContentLoaded')?.size ?? 0;
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    triggerDomReady() {
      this.readyState = 'interactive';
      const set = listeners.get('DOMContentLoaded');
      if (!set) return;
      for (const listener of Array.from(set)) {
        if (typeof listener === 'function') {
          listener({ type: 'DOMContentLoaded' } as Event);
        }
        set.delete(listener);
      }
    },
  };
}

test('isDocumentReady checks document availability and readyState', () => {
  assert.equal(isDocumentReady(null), false);
  assert.equal(isDocumentReady(undefined), false);
  assert.equal(isDocumentReady({ readyState: 'loading' }), false);
  assert.equal(isDocumentReady({ readyState: 'interactive' }), true);
  assert.equal(isDocumentReady({ readyState: 'complete' }), true);
});

test('shouldInitializeHmrConnection skips production builds and unready documents', () => {
  assert.equal(
    shouldInitializeHmrConnection({
      isProduction: true,
      hasWindow: true,
      document: { readyState: 'complete', visibilityState: 'visible' },
      hasHotContext: true,
    }),
    false
  );

  assert.equal(
    shouldInitializeHmrConnection({
      isProduction: false,
      hasWindow: true,
      document: { readyState: 'loading', visibilityState: 'visible' },
      hasHotContext: true,
    }),
    false
  );

  assert.equal(
    shouldInitializeHmrConnection({
      isProduction: false,
      hasWindow: true,
      document: { readyState: 'complete', visibilityState: 'hidden' },
      hasHotContext: true,
    }),
    false
  );

  assert.equal(
    shouldInitializeHmrConnection({
      isProduction: false,
      hasWindow: false,
      document: { readyState: 'complete', visibilityState: 'visible' },
      hasHotContext: true,
    }),
    false
  );

  assert.equal(
    shouldInitializeHmrConnection({
      isProduction: false,
      hasWindow: true,
      document: { readyState: 'interactive', visibilityState: 'visible' },
      hasHotContext: true,
    }),
    true
  );
});

test('runWhenDocumentReady executes immediately when complete and defers when loading', () => {
  const readyDoc = createMockDocument('complete');
  let calledImmediate = 0;
  let cleanedImmediate = 0;
  const disposeImmediate = runWhenDocumentReady(() => {
    calledImmediate += 1;
    return () => {
      cleanedImmediate += 1;
    };
  }, readyDoc);
  assert.equal(calledImmediate, 1);
  disposeImmediate();
  assert.equal(cleanedImmediate, 1);

  const loadingDoc = createMockDocument('loading');
  let calledDeferred = 0;
  const disposeDeferred = runWhenDocumentReady(() => {
    calledDeferred += 1;
  }, loadingDoc);
  assert.equal(calledDeferred, 0);
  assert.equal(loadingDoc.listenerCount, 1);
  loadingDoc.triggerDomReady();
  assert.equal(calledDeferred, 1);
  disposeDeferred();
});

test('isTransientViteWebSocketError matches Vite WebSocket handshake failures only', () => {
  assert.equal(
    isTransientViteWebSocketError(new Error('WebSocket closed without opened.')),
    true
  );
  assert.equal(
    isTransientViteWebSocketError('[vite] failed to connect to websocket (Error: WebSocket closed without opened.).'),
    true
  );
  assert.equal(isTransientViteWebSocketError(new Error('Network timeout on API')), false);
  assert.equal(isTransientViteWebSocketError(null), false);
});

test('initializeSafeClientHmr activates only in ready dev environments and suppresses production WebSocket rejections', () => {
  const doc = createMockDocument('complete', 'visible');
  const winListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const mockWin = {
    addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EventListenerOrEventListenerObject) {
      winListeners.get(type)?.delete(fn);
    },
  };

  let registeredWsDisconnect = false;
  const mockHot: HotContextLike = {
    on(evt) {
      if (evt === 'vite:ws:disconnect') registeredWsDisconnect = true;
    },
    off(evt) {
      if (evt === 'vite:ws:disconnect') registeredWsDisconnect = false;
    },
  };

  // Production build: HMR connection stays inactive, rejection suppression works
  const prodInit = initializeSafeClientHmr({
    isProduction: true,
    doc,
    win: mockWin,
    hot: mockHot,
  });
  assert.equal(prodInit.active, false);
  assert.equal(registeredWsDisconnect, false);

  let prevented = false;
  const listener = Array.from(winListeners.get('unhandledrejection') || [])[0];
  assert.ok(typeof listener === 'function');
  listener({
    reason: new Error('WebSocket closed without opened.'),
    preventDefault() {
      prevented = true;
    },
  } as unknown as Event);
  assert.equal(prevented, true);
  prodInit.cleanup();

  // Dev mode with ready document: activates cleanly and cleans up on dispose
  const devInit = initializeSafeClientHmr({
    isProduction: false,
    doc,
    win: mockWin,
    hot: mockHot,
  });
  assert.equal(devInit.active, true);
  assert.equal(registeredWsDisconnect, true);
  devInit.cleanup();
  assert.equal(registeredWsDisconnect, false);
});
