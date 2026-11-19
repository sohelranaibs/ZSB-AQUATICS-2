/**
 * Pure utilities for managing and formatting local database persistence sync status
 * and time-based synchronization freshness indicators.
 */

export type SyncStatusState = 'saving' | 'synced' | 'error' | 'paused';

export type SyncFreshnessTier = 'up_to_date' | 'recent' | 'stale' | 'out_of_sync';

export type SyncIndicatorColor = 'emerald' | 'sky' | 'amber' | 'rose';

export const SLOW_SYNC_THRESHOLD_MS = 2500;
export const AUTO_SAVE_INDICATOR_HOLD_MS = 950;
export const DATA_ENTRY_AUTOSAVE_DEBOUNCE_MS = 250;

export interface SyncMetadata {
  status: SyncStatusState;
  lastSyncedAt: string; // ISO timestamp
  lastBackupAt?: string; // ISO timestamp of last confirmed backup write
  lastSyncedEntity?: string;
  totalRecordsCount: number;
  errorMessage?: string;
  isLiveSyncEnabled?: boolean;
  hasUnsyncedChanges?: boolean;
  syncStartedAtMs?: number | null;
  slowSyncThresholdMs?: number;
  isSlowConnection?: boolean;
  isForcingSync?: boolean;
  isAutoSaving?: boolean;
  lastAutoSaveTriggeredAtMs?: number | null;
}

export interface SyncFreshnessInfo {
  freshnessTier: SyncFreshnessTier;
  indicatorColor: SyncIndicatorColor;
  freshnessLabel: 'Up-to-date' | 'Synced Recently' | 'Sync Stale' | 'Out of Sync';
  elapsedText: string;
  elapsedSeconds: number | null;
  isUpToDateWithDb: boolean;
}

export interface BackupTimestampInfo {
  isoString: string;
  formattedTime: string;
  formattedDateTime: string;
  elapsedText: string;
  elapsedSeconds: number | null;
  backupSummaryText: string;
  hasBackup: boolean;
}

export interface SyncDisplayInfo {
  status: SyncStatusState;
  badgeText: 'Auto-saving...' | 'Synced' | 'Sync Error' | 'Live Sync Paused';
  statusBannerLabel:
    | 'Slow Connection'
    | 'Forcing Sync...'
    | 'Syncing...'
    | 'Synced'
    | 'Sync Error'
    | 'Unsaved Changes'
    | 'Sync Paused';
  detailText: string;
  formattedTime: string;
  lastBackupAt: string;
  formattedBackupTime: string;
  formattedBackupDateTime: string;
  backupElapsedText: string;
  backupSummaryText: string;
  isSlowSync: boolean;
  shouldHighlightForceSync: boolean;
  ariaLabel: string;
  isLiveSyncActive: boolean;
  freshnessTier: SyncFreshnessTier;
  indicatorColor: SyncIndicatorColor;
  freshnessLabel: 'Up-to-date' | 'Synced Recently' | 'Sync Stale' | 'Out of Sync';
  elapsedText: string;
  isUpToDateWithDb: boolean;
  showAutoSavingIndicator: boolean;
  autoSavingLabel: 'Auto-saving...';
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
 * Formats an ISO timestamp into YYYY-MM-DD HH:MM:SS (local time) for backup inspection & tooltips.
 */
export function formatSyncDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'No backup recorded yet';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'No backup recorded yet';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} ${formatSyncTimestamp(isoString)}`;
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
 * Formats the last confirmed backup timestamp and age for header display.
 */
export function formatBackupTimestampLabel(
  lastBackupAt: string | null | undefined,
  nowMs: number = Date.now()
): BackupTimestampInfo {
  if (!lastBackupAt) {
    return {
      isoString: '',
      formattedTime: '--:--:--',
      formattedDateTime: 'No backup recorded yet',
      elapsedText: 'Never backed up',
      elapsedSeconds: null,
      backupSummaryText: 'Backup: Pending',
      hasBackup: false,
    };
  }

  const parsedMs = new Date(lastBackupAt).getTime();
  if (isNaN(parsedMs)) {
    return {
      isoString: '',
      formattedTime: '--:--:--',
      formattedDateTime: 'No backup recorded yet',
      elapsedText: 'Unknown',
      elapsedSeconds: null,
      backupSummaryText: 'Backup: Pending',
      hasBackup: false,
    };
  }

  const formattedTime = formatSyncTimestamp(lastBackupAt);
  const formattedDateTime = formatSyncDateTime(lastBackupAt);
  const { elapsedSeconds, elapsedText } = formatSyncElapsedAge(lastBackupAt, nowMs);

  return {
    isoString: lastBackupAt,
    formattedTime,
    formattedDateTime,
    elapsedText,
    elapsedSeconds,
    backupSummaryText: `Backup ${formattedTime} · ${elapsedText}`,
    hasBackup: true,
  };
}

/**
 * Determines whether the background sync operation is experiencing slow connection / latency.
 */
export function detectSlowSync(params: {
  status: SyncStatusState;
  syncStartedAtMs?: number | null;
  isSlowConnection?: boolean;
  nowMs?: number;
  thresholdMs?: number;
}): boolean {
  if (params.isSlowConnection) return true;
  if (params.status !== 'saving') return false;
  if (typeof params.syncStartedAtMs !== 'number' || !Number.isFinite(params.syncStartedAtMs)) {
    return false;
  }
  const nowMs = params.nowMs ?? Date.now();
  const thresholdMs = Math.max(250, params.thresholdMs ?? SLOW_SYNC_THRESHOLD_MS);
  return nowMs - params.syncStartedAtMs >= thresholdMs;
}

/**
 * Determines whether the subtle 'Auto-saving...' indicator next to the header
 * synchronization timestamp should be visible.
 */
export function shouldShowAutoSavingIndicator(params: {
  status: SyncStatusState;
  isLiveSyncEnabled?: boolean;
  isAutoSaving?: boolean;
  lastAutoSaveTriggeredAtMs?: number | null;
  nowMs?: number;
  holdDurationMs?: number;
}): boolean {
  if (
    params.isLiveSyncEnabled === false ||
    params.status === 'paused' ||
    params.status === 'error'
  ) {
    return false;
  }
  if (params.status === 'saving' || Boolean(params.isAutoSaving)) {
    return true;
  }
  if (
    typeof params.lastAutoSaveTriggeredAtMs === 'number' &&
    Number.isFinite(params.lastAutoSaveTriggeredAtMs)
  ) {
    const nowMs = params.nowMs ?? Date.now();
    const holdMs = Math.max(100, params.holdDurationMs ?? AUTO_SAVE_INDICATOR_HOLD_MS);
    const elapsed = nowMs - params.lastAutoSaveTriggeredAtMs;
    if (elapsed >= 0 && elapsed < holdMs) {
      return true;
    }
  }
  return false;
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
  const resolvedBackupIso = meta.lastBackupAt ?? meta.lastSyncedAt;
  const backupInfo = formatBackupTimestampLabel(resolvedBackupIso, nowMs);
  const entityLabel = meta.lastSyncedEntity ? `${meta.lastSyncedEntity}` : 'Local DB';
  const isLiveSyncActive = meta.isLiveSyncEnabled !== false && meta.status !== 'paused';
  const freshness = evaluateSyncFreshness(meta, nowMs);
  const isSlowSync = detectSlowSync({
    status: meta.status,
    syncStartedAtMs: meta.syncStartedAtMs,
    isSlowConnection: meta.isSlowConnection,
    nowMs,
    thresholdMs: meta.slowSyncThresholdMs,
  });

  const shouldHighlightForceSync =
    isSlowSync ||
    meta.status === 'error' ||
    Boolean(meta.hasUnsyncedChanges) ||
    freshness.freshnessTier === 'stale' ||
    freshness.freshnessTier === 'out_of_sync';

  const showAutoSavingIndicator = shouldShowAutoSavingIndicator({
    status: meta.status,
    isLiveSyncEnabled: meta.isLiveSyncEnabled,
    isAutoSaving: meta.isAutoSaving,
    lastAutoSaveTriggeredAtMs: meta.lastAutoSaveTriggeredAtMs,
    nowMs,
  });

  if (!isLiveSyncActive || meta.status === 'paused') {
    const detail = meta.hasUnsyncedChanges
      ? 'Unsaved changes pending (Click to sync)'
      : 'Auto-save paused';
    return {
      status: 'paused',
      badgeText: 'Live Sync Paused',
      statusBannerLabel: meta.hasUnsyncedChanges ? 'Unsaved Changes' : 'Sync Paused',
      detailText: detail,
      formattedTime,
      lastBackupAt: backupInfo.isoString,
      formattedBackupTime: backupInfo.formattedTime,
      formattedBackupDateTime: backupInfo.formattedDateTime,
      backupElapsedText: backupInfo.elapsedText,
      backupSummaryText: backupInfo.backupSummaryText,
      isSlowSync,
      shouldHighlightForceSync: Boolean(meta.hasUnsyncedChanges) || isSlowSync,
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
      showAutoSavingIndicator: false,
      autoSavingLabel: 'Auto-saving...',
    };
  }

  if (meta.status === 'saving') {
    const statusBannerLabel = meta.isForcingSync
      ? 'Forcing Sync...'
      : isSlowSync
      ? 'Slow Connection'
      : 'Syncing...';
    return {
      status: 'saving',
      badgeText: 'Auto-saving...',
      statusBannerLabel,
      detailText: isSlowSync
        ? `Slow connection while updating ${entityLabel} — Force Sync available`
        : `Updating ${entityLabel}`,
      formattedTime,
      lastBackupAt: backupInfo.isoString,
      formattedBackupTime: backupInfo.formattedTime,
      formattedBackupDateTime: backupInfo.formattedDateTime,
      backupElapsedText: backupInfo.elapsedText,
      backupSummaryText: backupInfo.backupSummaryText,
      isSlowSync,
      shouldHighlightForceSync: true,
      ariaLabel: isSlowSync
        ? `Database persistence status: Slow connection detected while saving ${entityLabel}. Use Force Sync to flush immediately.`
        : `Database persistence status: Auto-saving ${entityLabel} to local storage`,
      isLiveSyncActive: true,
      freshnessTier: freshness.freshnessTier,
      indicatorColor: freshness.indicatorColor,
      freshnessLabel: freshness.freshnessLabel,
      elapsedText: isSlowSync ? 'Slow connection' : freshness.elapsedText,
      isUpToDateWithDb: freshness.isUpToDateWithDb,
      showAutoSavingIndicator: true,
      autoSavingLabel: 'Auto-saving...',
    };
  }

  if (meta.status === 'error') {
    return {
      status: 'error',
      badgeText: 'Sync Error',
      statusBannerLabel: 'Sync Error',
      detailText: meta.errorMessage || 'Local storage write failed',
      formattedTime,
      lastBackupAt: backupInfo.isoString,
      formattedBackupTime: backupInfo.formattedTime,
      formattedBackupDateTime: backupInfo.formattedDateTime,
      backupElapsedText: backupInfo.elapsedText,
      backupSummaryText: backupInfo.backupSummaryText,
      isSlowSync,
      shouldHighlightForceSync: true,
      ariaLabel: `Database persistence status: Sync Error - ${meta.errorMessage || 'Local storage write failed'}`,
      isLiveSyncActive: true,
      freshnessTier: freshness.freshnessTier,
      indicatorColor: freshness.indicatorColor,
      freshnessLabel: freshness.freshnessLabel,
      elapsedText: freshness.elapsedText,
      isUpToDateWithDb: freshness.isUpToDateWithDb,
      showAutoSavingIndicator: false,
      autoSavingLabel: 'Auto-saving...',
    };
  }

  return {
    status: 'synced',
    badgeText: 'Synced',
    statusBannerLabel: isSlowSync ? 'Slow Connection' : 'Synced',
    detailText: `${meta.totalRecordsCount} records · ${formattedTime}`,
    formattedTime,
    lastBackupAt: backupInfo.isoString,
    formattedBackupTime: backupInfo.formattedTime,
    formattedBackupDateTime: backupInfo.formattedDateTime,
    backupElapsedText: backupInfo.elapsedText,
    backupSummaryText: backupInfo.backupSummaryText,
    isSlowSync,
    shouldHighlightForceSync,
    ariaLabel: `Database persistence status: Synced (${meta.totalRecordsCount} records saved at ${formattedTime})`,
    isLiveSyncActive: true,
    freshnessTier: freshness.freshnessTier,
    indicatorColor: freshness.indicatorColor,
    freshnessLabel: freshness.freshnessLabel,
    elapsedText: freshness.elapsedText,
    isUpToDateWithDb: freshness.isUpToDateWithDb,
    showAutoSavingIndicator,
    autoSavingLabel: 'Auto-saving...',
  };
}
