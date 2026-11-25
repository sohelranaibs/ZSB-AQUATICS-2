export type OfflineAlertTone = 'idle' | 'offline' | 'reconnected';

export interface OfflineAlertInput {
  isOnline: boolean;
  recentlyReconnected: boolean;
  pendingQueueCount?: number;
  isSyncingQueue?: boolean;
}

export interface OfflineAlertViewModel {
  visible: boolean;
  tone: OfflineAlertTone;
  label: string;
  compactLabel: string;
  queueBadgeText: string | null;
  tooltip: string;
  ariaLabel: string;
}

export const RECONNECT_BANNER_DURATION_MS = 3200;

/**
 * Safely reads initial browser connectivity status, defaulting to online
 * in non-browser or SSR contexts where `navigator.onLine` is unavailable.
 */
export function readInitialOnlineStatus(
  nav?: { onLine?: boolean } | null
): boolean {
  if (!nav || typeof nav.onLine !== 'boolean') {
    return true;
  }
  return nav.onLine;
}

/**
 * Pure view-model derivation for the top-right header Offline Mode alert.
 * Hidden when online and idle; subtly alerts when offline or briefly upon reconnecting.
 */
export function deriveOfflineAlertState(
  input: OfflineAlertInput
): OfflineAlertViewModel {
  const pendingCount = Math.max(0, Math.floor(input.pendingQueueCount ?? 0));

  if (!input.isOnline) {
    const queueBadgeText =
      pendingCount > 0 ? `${pendingCount} queued` : null;
    const detail =
      pendingCount > 0
        ? `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} queued locally for sync when reconnected.`
        : 'Changes are saved locally on this device and will sync automatically when reconnected.';

    return {
      visible: true,
      tone: 'offline',
      label: 'Offline Mode',
      compactLabel: 'Offline',
      queueBadgeText,
      tooltip: `Offline Mode — No internet connection detected. ${detail}`,
      ariaLabel: `Offline Mode. No internet connection detected. ${detail}`,
    };
  }

  if (input.recentlyReconnected) {
    const detail = input.isSyncingQueue
      ? 'Connection restored. Syncing queued local changes.'
      : 'Internet connection restored.';
    return {
      visible: true,
      tone: 'reconnected',
      label: 'Back Online',
      compactLabel: 'Online',
      queueBadgeText: input.isSyncingQueue ? 'Syncing' : null,
      tooltip: detail,
      ariaLabel: `Back Online. ${detail}`,
    };
  }

  return {
    visible: false,
    tone: 'idle',
    label: '',
    compactLabel: '',
    queueBadgeText: null,
    tooltip: '',
    ariaLabel: '',
  };
}
