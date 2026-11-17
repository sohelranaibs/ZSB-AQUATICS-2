import { useSyncExternalStore } from 'react';
import type { SyncStatusState } from '../utils/syncStatus.ts';

export interface SyncTelemetrySnapshot {
  syncStatus: SyncStatusState;
  lastSyncedAt: string;
  lastBackupAt: string;
  lastSyncedEntity: string;
  syncStartedAtMs: number | null;
  isSlowConnection: boolean;
  isForcingSync: boolean;
  hasUnsyncedChanges: boolean;
}

type Listener = () => void;

let currentToastMessage: string | null = null;
const toastListeners = new Set<Listener>();

export function subscribeToast(listener: Listener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function getToastSnapshot(): string | null {
  return currentToastMessage;
}

export function publishToastMessage(msg: string | null): void {
  if (currentToastMessage === msg) return;
  currentToastMessage = msg;
  toastListeners.forEach((listener) => listener());
}

export function useToastMessage(): string | null {
  return useSyncExternalStore(subscribeToast, getToastSnapshot, getToastSnapshot);
}

let currentSyncSnapshot: SyncTelemetrySnapshot = {
  syncStatus: 'synced',
  lastSyncedAt: new Date().toISOString(),
  lastBackupAt: new Date().toISOString(),
  lastSyncedEntity: 'All Ledgers',
  syncStartedAtMs: null,
  isSlowConnection: false,
  isForcingSync: false,
  hasUnsyncedChanges: false,
};

const syncListeners = new Set<Listener>();

export function subscribeSyncTelemetry(listener: Listener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function getSyncTelemetrySnapshot(): SyncTelemetrySnapshot {
  return currentSyncSnapshot;
}

export function updateSyncTelemetry(
  patch:
    | Partial<SyncTelemetrySnapshot>
    | ((prev: SyncTelemetrySnapshot) => Partial<SyncTelemetrySnapshot>)
): void {
  const resolvedPatch = typeof patch === 'function' ? patch(currentSyncSnapshot) : patch;
  const next: SyncTelemetrySnapshot = { ...currentSyncSnapshot, ...resolvedPatch };
  if (
    next.syncStatus === currentSyncSnapshot.syncStatus &&
    next.lastSyncedAt === currentSyncSnapshot.lastSyncedAt &&
    next.lastBackupAt === currentSyncSnapshot.lastBackupAt &&
    next.lastSyncedEntity === currentSyncSnapshot.lastSyncedEntity &&
    next.syncStartedAtMs === currentSyncSnapshot.syncStartedAtMs &&
    next.isSlowConnection === currentSyncSnapshot.isSlowConnection &&
    next.isForcingSync === currentSyncSnapshot.isForcingSync &&
    next.hasUnsyncedChanges === currentSyncSnapshot.hasUnsyncedChanges
  ) {
    return;
  }
  currentSyncSnapshot = next;
  syncListeners.forEach((listener) => listener());
}

export function useSyncTelemetrySnapshot(): SyncTelemetrySnapshot {
  return useSyncExternalStore(
    subscribeSyncTelemetry,
    getSyncTelemetrySnapshot,
    getSyncTelemetrySnapshot
  );
}
