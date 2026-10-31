import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSyncTimestamp,
  computeTotalPersistedRecords,
  getSyncStatusDisplay,
} from './syncStatus.ts';

test('formatSyncTimestamp formats valid ISO strings into HH:MM:SS and handles invalid inputs', () => {
  const sampleDate = new Date(2026, 9, 28, 14, 5, 9); // 14:05:09 local time
  assert.equal(formatSyncTimestamp(sampleDate.toISOString()), '14:05:09');
  assert.equal(formatSyncTimestamp(''), '--:--:--');
  assert.equal(formatSyncTimestamp(null), '--:--:--');
  assert.equal(formatSyncTimestamp('invalid-date'), '--:--:--');
});

test('computeTotalPersistedRecords sums all four financial record collections safely', () => {
  assert.equal(
    computeTotalPersistedRecords({
      purchases: 4,
      packings: 5,
      payments: 3,
      otherCosts: 2,
    }),
    14
  );

  // Handles zero or negative gracefully
  assert.equal(
    computeTotalPersistedRecords({
      purchases: 0,
      packings: -2,
      payments: 0,
      otherCosts: 0,
    }),
    0
  );
});

test('getSyncStatusDisplay returns accurate labels for saving, synced, error, and paused states', () => {
  const iso = new Date(2026, 9, 28, 9, 30, 45).toISOString();

  // 1. Saving state
  const savingInfo = getSyncStatusDisplay({
    status: 'saving',
    lastSyncedAt: iso,
    lastSyncedEntity: 'Purchase Ledger',
    totalRecordsCount: 16,
  });
  assert.equal(savingInfo.status, 'saving');
  assert.equal(savingInfo.badgeText, 'Auto-saving...');
  assert.equal(savingInfo.detailText, 'Updating Purchase Ledger');
  assert.equal(savingInfo.isLiveSyncActive, true);
  assert.ok(savingInfo.ariaLabel.includes('Auto-saving Purchase Ledger'));

  // 2. Synced state
  const syncedInfo = getSyncStatusDisplay({
    status: 'synced',
    lastSyncedAt: iso,
    lastSyncedEntity: 'Purchase Ledger',
    totalRecordsCount: 16,
  });
  assert.equal(syncedInfo.status, 'synced');
  assert.equal(syncedInfo.badgeText, 'Synced');
  assert.equal(syncedInfo.formattedTime, '09:30:45');
  assert.equal(syncedInfo.detailText, '16 records · 09:30:45');
  assert.equal(syncedInfo.isLiveSyncActive, true);
  assert.ok(syncedInfo.ariaLabel.includes('Synced (16 records saved at 09:30:45)'));

  // 3. Error state
  const errorInfo = getSyncStatusDisplay({
    status: 'error',
    lastSyncedAt: iso,
    totalRecordsCount: 16,
    errorMessage: 'QuotaExceededError',
  });
  assert.equal(errorInfo.status, 'error');
  assert.equal(errorInfo.badgeText, 'Sync Error');
  assert.equal(errorInfo.detailText, 'QuotaExceededError');
  assert.ok(errorInfo.ariaLabel.includes('Sync Error - QuotaExceededError'));

  // 4. Paused state (Live Sync disabled)
  const pausedInfo = getSyncStatusDisplay({
    status: 'paused',
    lastSyncedAt: iso,
    totalRecordsCount: 16,
    isLiveSyncEnabled: false,
    hasUnsyncedChanges: false,
  });
  assert.equal(pausedInfo.status, 'paused');
  assert.equal(pausedInfo.badgeText, 'Live Sync Paused');
  assert.equal(pausedInfo.detailText, 'Auto-save paused');
  assert.equal(pausedInfo.isLiveSyncActive, false);
  assert.ok(pausedInfo.ariaLabel.includes('Live Sync paused'));

  // 5. Paused state with unsaved pending changes
  const pausedPendingInfo = getSyncStatusDisplay({
    status: 'paused',
    lastSyncedAt: iso,
    totalRecordsCount: 16,
    isLiveSyncEnabled: false,
    hasUnsyncedChanges: true,
  });
  assert.equal(pausedPendingInfo.status, 'paused');
  assert.equal(pausedPendingInfo.badgeText, 'Live Sync Paused');
  assert.equal(pausedPendingInfo.detailText, 'Unsaved changes pending (Click to sync)');
  assert.ok(pausedPendingInfo.ariaLabel.includes('Unsaved changes pending in memory'));
});
