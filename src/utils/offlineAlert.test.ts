import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOfflineAlertState,
  readInitialOnlineStatus,
} from './offlineAlert';

test('readInitialOnlineStatus defaults to true when navigator is unavailable', () => {
  assert.equal(readInitialOnlineStatus(undefined), true);
  assert.equal(readInitialOnlineStatus(null), true);
  assert.equal(readInitialOnlineStatus({}), true);
  assert.equal(readInitialOnlineStatus({ onLine: true }), true);
  assert.equal(readInitialOnlineStatus({ onLine: false }), false);
});

test('deriveOfflineAlertState stays hidden when online and idle', () => {
  const state = deriveOfflineAlertState({
    isOnline: true,
    recentlyReconnected: false,
    pendingQueueCount: 0,
    isSyncingQueue: false,
  });

  assert.equal(state.visible, false);
  assert.equal(state.tone, 'idle');
  assert.equal(state.label, '');
  assert.equal(state.queueBadgeText, null);
});

test('deriveOfflineAlertState shows Offline Mode with clear tooltip when disconnected', () => {
  const state = deriveOfflineAlertState({
    isOnline: false,
    recentlyReconnected: false,
    pendingQueueCount: 0,
  });

  assert.equal(state.visible, true);
  assert.equal(state.tone, 'offline');
  assert.equal(state.label, 'Offline Mode');
  assert.equal(state.compactLabel, 'Offline');
  assert.equal(state.queueBadgeText, null);
  assert.match(state.tooltip, /No internet connection detected/i);
  assert.match(state.ariaLabel, /Offline Mode/i);
});

test('deriveOfflineAlertState includes pending queue count when offline with queued actions', () => {
  const single = deriveOfflineAlertState({
    isOnline: false,
    recentlyReconnected: false,
    pendingQueueCount: 1,
  });
  assert.equal(single.queueBadgeText, '1 queued');
  assert.match(single.tooltip, /1 change queued/i);

  const multiple = deriveOfflineAlertState({
    isOnline: false,
    recentlyReconnected: false,
    pendingQueueCount: 4,
  });
  assert.equal(multiple.queueBadgeText, '4 queued');
  assert.match(multiple.tooltip, /4 changes queued/i);
});

test('deriveOfflineAlertState shows brief Back Online confirmation when connection returns', () => {
  const restored = deriveOfflineAlertState({
    isOnline: true,
    recentlyReconnected: true,
    isSyncingQueue: false,
  });
  assert.equal(restored.visible, true);
  assert.equal(restored.tone, 'reconnected');
  assert.equal(restored.label, 'Back Online');
  assert.equal(restored.queueBadgeText, null);

  const syncing = deriveOfflineAlertState({
    isOnline: true,
    recentlyReconnected: true,
    isSyncingQueue: true,
  });
  assert.equal(syncing.visible, true);
  assert.equal(syncing.tone, 'reconnected');
  assert.equal(syncing.queueBadgeText, 'Syncing');
});
