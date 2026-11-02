import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSyncTimestamp,
  formatSyncElapsedAge,
  evaluateSyncFreshness,
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

test('formatSyncElapsedAge returns human-readable elapsed time since last synchronization', () => {
  const nowMs = new Date('2026-11-02T12:10:00Z').getTime();

  assert.deepEqual(formatSyncElapsedAge('2026-11-02T12:09:55Z', nowMs), {
    elapsedSeconds: 5,
    elapsedText: 'Just now',
  });
  assert.deepEqual(formatSyncElapsedAge('2026-11-02T12:09:20Z', nowMs), {
    elapsedSeconds: 40,
    elapsedText: '40s ago',
  });
  assert.deepEqual(formatSyncElapsedAge('2026-11-02T12:07:00Z', nowMs), {
    elapsedSeconds: 180,
    elapsedText: '3m ago',
  });
  assert.deepEqual(formatSyncElapsedAge('2026-11-02T10:10:00Z', nowMs), {
    elapsedSeconds: 7200,
    elapsedText: '2h ago',
  });
});

test('evaluateSyncFreshness assigns emerald, sky, amber, and rose color tiers based on lastSyncedAt age and state', () => {
  const nowMs = new Date('2026-11-02T12:10:00Z').getTime();

  // 1. Synced 15 seconds ago -> emerald ('up_to_date')
  const fresh = evaluateSyncFreshness(
    {
      status: 'synced',
      lastSyncedAt: '2026-11-02T12:09:45Z',
      hasUnsyncedChanges: false,
    },
    nowMs
  );
  assert.equal(fresh.freshnessTier, 'up_to_date');
  assert.equal(fresh.indicatorColor, 'emerald');
  assert.equal(fresh.freshnessLabel, 'Up-to-date');
  assert.equal(fresh.isUpToDateWithDb, true);

  // 2. Synced 3 minutes ago -> sky ('recent')
  const recent = evaluateSyncFreshness(
    {
      status: 'synced',
      lastSyncedAt: '2026-11-02T12:07:00Z',
      hasUnsyncedChanges: false,
    },
    nowMs
  );
  assert.equal(recent.freshnessTier, 'recent');
  assert.equal(recent.indicatorColor, 'sky');
  assert.equal(recent.freshnessLabel, 'Synced Recently');
  assert.equal(recent.isUpToDateWithDb, true);

  // 3. Synced 10 minutes ago -> amber ('stale')
  const stale = evaluateSyncFreshness(
    {
      status: 'synced',
      lastSyncedAt: '2026-11-02T12:00:00Z',
      hasUnsyncedChanges: false,
    },
    nowMs
  );
  assert.equal(stale.freshnessTier, 'stale');
  assert.equal(stale.indicatorColor, 'amber');
  assert.equal(stale.freshnessLabel, 'Sync Stale');
  assert.equal(stale.isUpToDateWithDb, false);

  // 4. Unsaved changes pending -> rose ('out_of_sync')
  const outOfSync = evaluateSyncFreshness(
    {
      status: 'paused',
      lastSyncedAt: '2026-11-02T12:09:50Z',
      hasUnsyncedChanges: true,
    },
    nowMs
  );
  assert.equal(outOfSync.freshnessTier, 'out_of_sync');
  assert.equal(outOfSync.indicatorColor, 'rose');
  assert.equal(outOfSync.freshnessLabel, 'Out of Sync');
  assert.equal(outOfSync.isUpToDateWithDb, false);
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

test('getSyncStatusDisplay returns accurate labels and freshness colors for saving, synced, error, and paused states', () => {
  const sampleDate = new Date(2026, 9, 28, 9, 30, 45);
  const iso = sampleDate.toISOString();
  const nowMs = sampleDate.getTime() + 5000; // 5s after sync

  // 1. Saving state
  const savingInfo = getSyncStatusDisplay(
    {
      status: 'saving',
      lastSyncedAt: iso,
      lastSyncedEntity: 'Purchase Ledger',
      totalRecordsCount: 16,
    },
    nowMs
  );
  assert.equal(savingInfo.status, 'saving');
  assert.equal(savingInfo.badgeText, 'Auto-saving...');
  assert.equal(savingInfo.detailText, 'Updating Purchase Ledger');
  assert.equal(savingInfo.isLiveSyncActive, true);
  assert.equal(savingInfo.indicatorColor, 'amber');
  assert.ok(savingInfo.ariaLabel.includes('Auto-saving Purchase Ledger'));

  // 2. Synced state (5s ago -> emerald Up-to-date)
  const syncedInfo = getSyncStatusDisplay(
    {
      status: 'synced',
      lastSyncedAt: iso,
      lastSyncedEntity: 'Purchase Ledger',
      totalRecordsCount: 16,
    },
    nowMs
  );
  assert.equal(syncedInfo.status, 'synced');
  assert.equal(syncedInfo.badgeText, 'Synced');
  assert.equal(syncedInfo.formattedTime, '09:30:45');
  assert.equal(syncedInfo.detailText, '16 records · 09:30:45');
  assert.equal(syncedInfo.isLiveSyncActive, true);
  assert.equal(syncedInfo.indicatorColor, 'emerald');
  assert.equal(syncedInfo.freshnessLabel, 'Up-to-date');
  assert.ok(syncedInfo.ariaLabel.includes('Synced (16 records saved at 09:30:45)'));

  // 3. Error state (-> rose Out of Sync)
  const errorInfo = getSyncStatusDisplay(
    {
      status: 'error',
      lastSyncedAt: iso,
      totalRecordsCount: 16,
      errorMessage: 'QuotaExceededError',
    },
    nowMs
  );
  assert.equal(errorInfo.status, 'error');
  assert.equal(errorInfo.badgeText, 'Sync Error');
  assert.equal(errorInfo.detailText, 'QuotaExceededError');
  assert.equal(errorInfo.indicatorColor, 'rose');
  assert.ok(errorInfo.ariaLabel.includes('Sync Error - QuotaExceededError'));

  // 4. Paused state (Live Sync disabled)
  const pausedInfo = getSyncStatusDisplay(
    {
      status: 'paused',
      lastSyncedAt: iso,
      totalRecordsCount: 16,
      isLiveSyncEnabled: false,
      hasUnsyncedChanges: false,
    },
    nowMs
  );
  assert.equal(pausedInfo.status, 'paused');
  assert.equal(pausedInfo.badgeText, 'Live Sync Paused');
  assert.equal(pausedInfo.detailText, 'Auto-save paused');
  assert.equal(pausedInfo.isLiveSyncActive, false);
  assert.equal(pausedInfo.indicatorColor, 'amber');
  assert.ok(pausedInfo.ariaLabel.includes('Live Sync paused'));

  // 5. Paused state with unsaved pending changes (-> rose Out of Sync)
  const pausedPendingInfo = getSyncStatusDisplay(
    {
      status: 'paused',
      lastSyncedAt: iso,
      totalRecordsCount: 16,
      isLiveSyncEnabled: false,
      hasUnsyncedChanges: true,
    },
    nowMs
  );
  assert.equal(pausedPendingInfo.status, 'paused');
  assert.equal(pausedPendingInfo.badgeText, 'Live Sync Paused');
  assert.equal(pausedPendingInfo.detailText, 'Unsaved changes pending (Click to sync)');
  assert.equal(pausedPendingInfo.indicatorColor, 'rose');
  assert.ok(pausedPendingInfo.ariaLabel.includes('Unsaved changes pending in memory'));
});
