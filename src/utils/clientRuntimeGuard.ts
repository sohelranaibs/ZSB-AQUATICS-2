export type DocumentReadyStateValue = 'loading' | 'interactive' | 'complete';

export interface DocumentLike {
  readyState?: DocumentReadyStateValue | string;
  visibilityState?: 'visible' | 'hidden' | string;
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) => void;
}

export interface HotContextLike {
  on?: (event: string, cb: (payload?: unknown) => void) => void;
  off?: (event: string, cb: (payload?: unknown) => void) => void;
  dispose?: (cb: () => void) => void;
}

export interface ClientHmrCheckOptions {
  isProduction: boolean;
  hasWindow?: boolean;
  document?: Pick<DocumentLike, 'readyState' | 'visibilityState'> | null;
  hasHotContext?: boolean;
}

export interface SafeHmrInitOptions {
  isProduction: boolean;
  doc?: DocumentLike | null;
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
  hot?: HotContextLike | null;
  onWsDisconnect?: () => void;
}

/**
 * Verifies that a DOM Document is available and has reached at least interactive state.
 */
export function isDocumentReady(
  doc?: Pick<DocumentLike, 'readyState'> | null
): boolean {
  if (!doc) return false;
  return doc.readyState === 'interactive' || doc.readyState === 'complete';
}

/**
 * Determines whether Vite HMR / client-side dev WebSocket listeners should be initialized.
 * Never returns true in production builds, SSR contexts, hidden/unloading tabs, or while loading.
 */
export function shouldInitializeHmrConnection(
  options: ClientHmrCheckOptions
): boolean {
  if (options.isProduction) return false;
  if (options.hasWindow === false) return false;
  if (!isDocumentReady(options.document)) return false;
  if (options.document?.visibilityState === 'hidden') return false;
  if (!options.hasHotContext) return false;
  return true;
}

/**
 * Identifies transient Vite HMR WebSocket handshake errors that occur if a dev socket closes
 * without opening during production transition or proxy disconnects.
 */
export function isTransientViteWebSocketError(reason: unknown): boolean {
  if (!reason) return false;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'object' && reason !== null && 'message' in reason
      ? String((reason as { message?: unknown }).message ?? '')
      : String(reason);

  return (
    message.includes('WebSocket closed without opened') ||
    message.includes('failed to connect to websocket')
  );
}

/**
 * Runs initialization only after verifying document availability and readyState.
 * If the document is still loading, defers execution until DOMContentLoaded.
 */
export function runWhenDocumentReady(
  onReady: (doc: DocumentLike) => void | (() => void),
  doc: DocumentLike | undefined = typeof document !== 'undefined' ? document : undefined
): () => void {
  if (!doc) {
    return () => {};
  }

  let innerCleanup: (() => void) | void;
  let disposed = false;

  if (isDocumentReady(doc)) {
    innerCleanup = onReady(doc);
    return () => {
      disposed = true;
      if (typeof innerCleanup === 'function') {
        innerCleanup();
      }
    };
  }

  const handleDomReady = () => {
    if (disposed) return;
    if (isDocumentReady(doc)) {
      innerCleanup = onReady(doc);
    }
  };

  doc.addEventListener('DOMContentLoaded', handleDomReady, { once: true });

  return () => {
    disposed = true;
    doc.removeEventListener('DOMContentLoaded', handleDomReady);
    if (typeof innerCleanup === 'function') {
      innerCleanup();
    }
  };
}

/**
 * Wraps HMR and client-side WebSocket disconnection safety around document-ready verification.
 * Skips HMR connection setup entirely in production builds while guarding against stray WebSocket rejections.
 */
export function initializeSafeClientHmr(
  options: SafeHmrInitOptions
): { active: boolean; cleanup: () => void } {
  const { isProduction, doc, win, hot, onWsDisconnect } = options;

  const handleUnhandledRejection = (event: Event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    if (
      isTransientViteWebSocketError(rejectionEvent?.reason) &&
      (isProduction || !isDocumentReady(doc) || doc?.visibilityState === 'hidden')
    ) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }
  };

  if (win) {
    win.addEventListener('unhandledrejection', handleUnhandledRejection);
  }

  const canConnectHmr = shouldInitializeHmrConnection({
    isProduction,
    hasWindow: Boolean(win),
    document: doc,
    hasHotContext: Boolean(hot),
  });

  if (!canConnectHmr || !hot) {
    return {
      active: false,
      cleanup: () => {
        if (win) {
          win.removeEventListener('unhandledrejection', handleUnhandledRejection);
        }
      },
    };
  }

  const handleWsDisconnect = () => {
    if (typeof onWsDisconnect === 'function') {
      onWsDisconnect();
    }
  };

  if (typeof hot.on === 'function') {
    hot.on('vite:ws:disconnect', handleWsDisconnect);
  }

  const cleanup = () => {
    if (win) {
      win.removeEventListener('unhandledrejection', handleUnhandledRejection);
    }
    if (typeof hot.off === 'function') {
      hot.off('vite:ws:disconnect', handleWsDisconnect);
    }
  };

  if (typeof hot.dispose === 'function') {
    hot.dispose(cleanup);
  }

  return {
    active: true,
    cleanup,
  };
}
