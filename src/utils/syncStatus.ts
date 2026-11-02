/**
 * Pure utilities for managing and formatting local database persistence sync status
 * and time-based synchronization freshness indicators.
 */

export type SyncStatusState = 'saving' | 'synced' | 'error' | 'paused';

export type SyncFreshnessTier = 'up_to_date' | 'recent' | 'stale' | 'out_of_sync';

export type SyncIndicatorColor = 'emerald' | 'sky' | 'amber' | 'rose';

export interface SyncMetadata {
  status: SyncStatusState;
  lastSyncedAt: string; // ISO timestamp
  lastSyncedEntity?: string;
  totalRecordsCount: number;
  errorMessage?: string;
  isLiveSyncEnabled?: boolean;
  hasUnsyncedChanges?: boolean;
}

export interface SyncFreshnessInfo {
  freshnessTier: SyncFreshnessTier;
  indicatorColor: SyncIndicatorColor;
  freshnessLabel: 'Up-to-date' | 'Synced Recently' | 'Sync Stale' | 'Out of Sync';
  elapsedText: string;
  elapsedSeconds: number | null;
  isUpToDateWithDb: boolean;
}

export interface SyncDisplayInfo {
  status: SyncStatusState;
  badgeText: 'Auto-saving...' | 'Synced' | 'Sync Error' | 'Live Sync Paused';
  detailText: string;
  formattedTime: string;
  ariaLabel: string;
  isLiveSyncActive: boolean;
  freshnessTier: SyncFreshnessTier;
  indicatorColor: SyncIndicatorColor;
  freshnessLabel: 'Up-to-date' | 'Synced Recently' | 'Sync Stale' | 'Out of Sync';
  elapsedText: string;
  isUpToDateWithDb: boolean;
}

/**
 * Formats an ISO timestamp into HH:MM:SS (24-hour local time) for compact display in the ribbon.
 */
export function formatSyncTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '--:--:--';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '--:--:--';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formats elapsed time since lastSyncedAt into a compact human-readable string.
 */
export function formatSyncElapsedAge(
  lastSyncedAt: string | null | undefined,
  nowMs: number = Date.now()
): { elapsedSeconds: number | null; elapsedText: string } {
  if (!lastSyncedAt) {
    return { elapsedSeconds: null, elapsedText: 'Never synced' };
  }
  const syncedMs = new Date(lastSyncedAt).getTime();
  if (isNaN(syncedMs)) {
    return { elapsedSeconds: null, elapsedText: 'Unknown' };
  }

  const diffSeconds = Math.max(0, Math.floor((nowMs - syncedMs) / 1000));
  if (diffSeconds < 10) {
    return { elapsedSeconds: diffSeconds, elapsedText: 'Just now' };
  }
  if (diffSeconds < 60) {
    return { elapsedSeconds: diffSeconds, elapsedText: `${diffSeconds}s ago` };
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return { elapsedSeconds: diffSeconds, elapsedText: `${diffMinutes}m ago` };
  }
  const diffHours = Math.floor(diffMinutes / 60);
  return { elapsedSeconds: diffSeconds, elapsedText: `${diffHours}h ago` };
}

/**
 * Evaluates whether the current ledger data is up-to-date with the database
 * and determines the color tier based on the last synchronization time and sync state.
 *
 * Color tiers:
 * - 'emerald' ('up_to_date'): Synced within the last 60 seconds, no unsaved edits
 * - 'sky' ('recent'): Synced between 1 and 5 minutes ago, no unsaved edits
 * - 'amber' ('stale'): Synced > 5 minutes ago, or currently saving / paused without unsaved edits
 * - 'rose' ('out_of_sync'): Sync error, unsaved changes pending, or invalid/missing timestamp
 */
export function evaluateSyncFreshness(
  meta: Pick<SyncMetadata, 'status' | 'lastSyncedAt' | 'hasUnsyncedChanges'>,
  nowMs: number = Date.now()
): SyncFreshnessInfo {
  const { elapsedSeconds, elapsedText } = formatSyncElapsedAge(meta.lastSyncedAt, nowMs);

  if (meta.status === 'error' || meta.hasUnsyncedChanges) {
    return {
      freshnessTier: 'out_of_sync',
      indicatorColor: 'rose',
      freshnessLabel: 'Out of Sync',
      elapsedText: meta.hasUnsyncedChanges ? 'Unsaved edits' : elapsedText,
      elapsedSeconds,
      isUpToDateWithDb: false,
    };
  }

  if (meta.status === 'saving') {
    return {
      freshnessTier: 'stale',
      indicatorColor: 'amber',
      freshnessLabel: 'Sync Stale',
      elapsedText: 'Syncing...',
      elapsedSeconds,
      isUpToDateWithDb: false,
    };
  }

  if (elapsedSeconds === null) {
    return {
      freshnessTier: 'out_of_sync',
      indicatorColor: 'rose',
      freshnessLabel: 'Out of Sync',
      elapsedText,
      elapsedSeconds: null,
      isUpToDateWithDb: false,
    };
  }

  if (meta.status === 'paused') {
    return {
      freshnessTier: 'stale',
      indicatorColor: 'amber',
      freshnessLabel: 'Sync Stale',
      elapsedText,
      elapsedSeconds,
      isUpToDateWithDb: true,
    };
  }

  // Synced within the last 60 seconds -> Emerald (Up-to-date)
  if (elapsedSeconds <= 60) {
    return {
      freshnessTier: 'up_to_date',
      indicatorColor: 'emerald',
      freshnessLabel: 'Up-to-date',
      elapsedText,
      elapsedSeconds,
      isUpToDateWithDb: true,
    };
  }

  // Synced between 1 minute and 5 minutes (300 seconds) -> Sky (Synced Recently)
  if (elapsedSeconds <= 300) {
    return {
      freshnessTier: 'recent',
      indicatorColor: 'sky',
      freshnessLabel: 'Synced Recently',
      elapsedText,
      elapsedSeconds,
      isUpToDateWithDb: true,
    };
  }

  // Synced more than 5 minutes ago -> Amber (Sync Stale - click to refresh)
  return {
    freshnessTier: 'stale',
    indicatorColor: 'amber',
    freshnessLabel: 'Sync Stale',
    elapsedText,
    elapsedSeconds,
    isUpToDateWithDb: false,
  };
}

/**
 * Computes total persisted records across primary financial ledgers.
 */
export function computeTotalPersistedRecords(counts: {
  purchases: number;
  packings: number;
  payments: number;
  otherCosts: number;
}): number {
  return (
    Math.max(0, Number(counts.purchases) || 0) +
    Math.max(0, Number(counts.packings) || 0) +
    Math.max(0, Number(counts.payments) || 0) +
    Math.max(0, Number(counts.otherCosts) || 0)
  );
}

/**
 * Returns structured display labels and accessible attributes for the ExcelHeaderRibbon status indicator.
 */
export function getSyncStatusDisplay(
  meta: SyncMetadata,
  nowMs: number = Date.now()
): SyncDisplayInfo {
  const formattedTime = formatSyncTimestamp(meta.lastSyncedAt);
  const entityLabel = meta.lastSyncedEntity ? `${meta.lastSyncedEntity}` : 'Local DB';
  const isLiveSyncActive = meta.isLiveSyncEnabled !== false && meta.status !== 'paused';
  const freshness = evaluateSyncFreshness(meta, nowMs);

  if (!isLiveSyncActive || meta.status === 'paused') {
    const detail = meta.hasUnsyncedChanges
      ? 'Unsaved changes pending (Click to sync)'
      : 'Auto-save paused';
    return {
      status: 'paused',
      badgeText: 'Live Sync Paused',
      detailText: detail,
      formattedTime,
      ariaLabel: `Database persistence status: Live Sync paused. ${
        meta.hasUnsyncedChanges
          ? 'Unsaved changes pending in memory. Click to sync now.'
          : 'Background auto-saving disabled.'
      }`,
      isLiveSyncActive: false,
      freshnessTier: freshness.freshnessTier,
      indicatorColor: freshness.indicatorColor,
      freshnessLabel: freshness.freshnessLabel,
      elapsedText: freshness.elapsedText,
      isUpToDateWithDb: freshness.isUpToDateWithDb,
    };
  }

  if (meta.status === 'saving') {
    return {
      status: 'saving',
      badgeText: 'Auto-saving...',
      detailText: `Updating ${entityLabel}`,
      formattedTime,
      ariaLabel: `Database persistence status: Auto-saving ${entityLabel} to local storage`,
      isLiveSyncActive: true,
      freshnessTier: freshness.freshnessTier,
      indicatorColor: freshness.indicatorColor,
      freshnessLabel: freshness.freshnessLabel,
      elapsedText: freshness.elapsedText,
      isUpToDateWithDb: freshness.isUpToDateWithDb,
    };
  }

  if (meta.status === 'error') {
    return {
      status: 'error',
      badgeText: 'Sync Error',
      detailText: meta.errorMessage || 'Local storage write failed',
      formattedTime,
      ariaLabel: `Database persistence status: Sync Error - ${meta.errorMessage || 'Local storage write failed'}`,
      isLiveSyncActive: true,
      freshnessTier: freshness.freshnessTier,
      indicatorColor: freshness.indicatorColor,
      freshnessLabel: freshness.freshnessLabel,
      elapsedText: freshness.elapsedText,
      isUpToDateWithDb: freshness.isUpToDateWithDb,
    };
  }

  return {
    status: 'synced',
    badgeText: 'Synced',
    detailText: `${meta.totalRecordsCount} records · ${formattedTime}`,
    formattedTime,
    ariaLabel: `Database persistence status: Synced (${meta.totalRecordsCount} records saved at ${formattedTime})`,
    isLiveSyncActive: true,
    freshnessTier: freshness.freshnessTier,
    indicatorColor: freshness.indicatorColor,
    freshnessLabel: freshness.freshnessLabel,
    elapsedText: freshness.elapsedText,
    isUpToDateWithDb: freshness.isUpToDateWithDb,
  };
}
