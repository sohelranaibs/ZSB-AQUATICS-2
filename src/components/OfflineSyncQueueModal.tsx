import React from 'react';
import {
  CheckCircle2,
  CloudOff,
  RefreshCw,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { useOnlineStatus } from '../hooks/usePWAInstall.ts';
import { formatEntityDisplayName } from '../utils/backgroundSyncQueue.ts';

interface OfflineSyncQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineSyncQueueModal: React.FC<OfflineSyncQueueModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    offlineSyncQueue,
    isFlushingOfflineQueue,
    backgroundSyncStatus,
    lastBackgroundSyncAt,
    flushOfflineSyncQueue,
    discardOfflineSyncItem,
    clearOfflineSyncQueue,
  } = useApp();
  const isOnline = useOnlineStatus();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Service Worker Offline Background Sync Queue"
      data-testid="offline-sync-queue-modal"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 print:hidden"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#273E56] text-white px-5 py-4 flex items-center justify-between gap-3 border-b-2 border-amber-400">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-sky-200">
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span>
                {isOnline ? 'CONNECTED — AUTO-PUSH READY' : 'OFFLINE — QUEUEING IN SERVICE WORKER'}
              </span>
            </div>
            <h2 className="text-base font-extrabold tracking-tight text-white truncate">
              Service Worker Background Sync Queue ({offlineSyncQueue.length})
            </h2>
          </div>

          <button
            type="button"
            data-testid="close-offline-sync-modal-btn"
            aria-label="Close Background Sync Queue Modal"
            onClick={onClose}
            className="p-1.5 rounded-full text-black cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Service Worker Status Strip */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-700 font-mono">
            <span>
              Worker:{' '}
              <strong className={backgroundSyncStatus.swActive ? 'text-emerald-700' : 'text-amber-700'}>
                {backgroundSyncStatus.swActive ? 'ACTIVE' : 'FALLBACK IDB'}
              </strong>
            </span>
            <span>·</span>
            <span>
              Sync API:{' '}
              <strong className="text-slate-900">
                {backgroundSyncStatus.syncApiSupported ? 'NATIVE BG SYNC' : 'ONLINE RECONNECT'}
              </strong>
            </span>
            {lastBackgroundSyncAt && (
              <>
                <span>·</span>
                <span>
                  Last Push:{' '}
                  <strong className="text-slate-900">
                    {new Date(lastBackgroundSyncAt).toLocaleTimeString()}
                  </strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {offlineSyncQueue.length > 0 && (
              <button
                type="button"
                data-testid="clear-offline-queue-btn"
                onClick={() => {
                  void clearOfflineSyncQueue();
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer whitespace-nowrap"
              >
                CLEAR QUEUE
              </button>
            )}
            <button
              type="button"
              data-testid="flush-offline-queue-btn"
              disabled={!isOnline || isFlushingOfflineQueue || offlineSyncQueue.length === 0}
              onClick={() => {
                void flushOfflineSyncQueue('manual-button');
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-black disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isFlushingOfflineQueue ? 'animate-spin' : ''}`}
              />
              <span>{isFlushingOfflineQueue ? 'SYNCING...' : 'PUSH TO LOCAL STORAGE'}</span>
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-5">
          {offlineSyncQueue.length === 0 ? (
            <div
              data-testid="offline-queue-empty-state"
              className="py-10 text-center space-y-2"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="text-sm font-bold text-slate-900">
                All Data Entry Actions Synchronized
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When you lose internet connectivity, new purchases, export packing lists,
                payment vouchers, operating costs, and mortality entries are queued securely
                in the Service Worker and pushed to local storage automatically upon reconnect.
              </p>
            </div>
          ) : (
            <ul data-testid="offline-queue-items-list" className="space-y-2.5">
              {offlineSyncQueue.map((item) => (
                <li
                  key={item.id}
                  data-testid={`offline-queue-item-${item.recordId}`}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#273E56] text-white text-[10px] font-bold uppercase tracking-wider">
                        {formatEntityDisplayName(item.entity)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-bold uppercase">
                        {item.operation}
                      </span>
                      <span className="text-xs font-extrabold font-mono text-slate-900 truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">{item.summary}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Queued at {new Date(item.queuedAt).toLocaleString()} · Waiting for connection
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid={`discard-queue-item-${item.recordId}`}
                    aria-label={`Discard queued action ${item.label}`}
                    onClick={() => {
                      void discardOfflineSyncItem(item.id);
                    }}
                    className="p-1.5 text-black cursor-pointer shrink-0"
                    title="Remove from offline queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
          <span>Durable Service Worker IndexedDB Queue · Auto-pushes on reconnect</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 text-xs font-bold text-black cursor-pointer"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
