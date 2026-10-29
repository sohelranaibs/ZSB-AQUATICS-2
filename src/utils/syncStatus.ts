/**
 * Pure utilities for managing and formatting local database persistence sync status
 */

export type SyncStatusState = 'saving' | 'synced' | 'error';

export interface SyncMetadata {
  status: SyncStatusState;
  lastSyncedAt: string; // ISO timestamp
  lastSyncedEntity?: string;
  totalRecordsCount: number;
  errorMessage?: string;
}

export interface SyncDisplayInfo {
  status: SyncStatusState;
  badgeText: 'Auto-saving...' | 'Synced' | 'Sync Error';
  detailText: string;
  formattedTime: string;
  ariaLabel: string;
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
export function getSyncStatusDisplay(meta: SyncMetadata): SyncDisplayInfo {
  const formattedTime = formatSyncTimestamp(meta.lastSyncedAt);
  const entityLabel = meta.lastSyncedEntity ? `${meta.lastSyncedEntity}` : 'Local DB';

  if (meta.status === 'saving') {
    return {
      status: 'saving',
      badgeText: 'Auto-saving...',
      detailText: `Updating ${entityLabel}`,
      formattedTime,
      ariaLabel: `Database persistence status: Auto-saving ${entityLabel} to local storage`,
    };
  }

  if (meta.status === 'error') {
    return {
      status: 'error',
      badgeText: 'Sync Error',
      detailText: meta.errorMessage || 'Local storage write failed',
      formattedTime,
      ariaLabel: `Database persistence status: Sync Error - ${meta.errorMessage || 'Local storage write failed'}`,
    };
  }

  return {
    status: 'synced',
    badgeText: 'Synced',
    detailText: `${meta.totalRecordsCount} records · ${formattedTime}`,
    formattedTime,
    ariaLabel: `Database persistence status: Synced (${meta.totalRecordsCount} records saved at ${formattedTime})`,
  };
}
