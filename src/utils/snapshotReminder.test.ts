import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SNAPSHOT_REMINDER_INTERVAL_MS,
  SNAPSHOT_REMINDER_MAX_TICK_DELTA_MS,
  SNAPSHOT_REMINDER_SNOOZE_MS,
  StorageLike,
  accumulateActiveUsage,
  buildSnapshotReminderStorageKey,
  calculateUsageProgressPercent,
  createInitialSnapshotReminderState,
  formatUsageDuration,
  isSnapshotReminderDue,
  loadSnapshotReminderState,
  markSnapshotSavedForReminder,
  normalizeReminderUserKey,
  sanitizeSnapshotReminderState,
  saveSnapshotReminderState,
  setSnapshotReminderEnabled,
  snoozeSnapshotReminder,
} from './snapshotReminder';

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

test('accumulateActiveUsage counts foreground time, ignores hidden tabs, and caps sleep jumps', () => {
  const t0 = 1_700_000_000_000;
  let state = createInitialSnapshotReminderState(t0);

  // Foreground tick of 60s accumulates cleanly
  state = accumulateActiveUsage(state, 60_000, { isVisible: true, nowMs: t0 + 60_000 });
  assert.equal(state.accumulatedUsageMs, 60_000);

  // Hidden tab tick does not accumulate
  const afterHidden = accumulateActiveUsage(state, 120_000, {
    isVisible: false,
    nowMs: t0 + 180_000,
  });
  assert.equal(afterHidden.accumulatedUsageMs, 60_000);

  // Huge 8-hour jump (e.g., laptop sleep) is capped at SNAPSHOT_REMINDER_MAX_TICK_DELTA_MS (5 min)
  state = accumulateActiveUsage(state, 8 * 60 * 60 * 1000, {
    isVisible: true,
    nowMs: t0 + 8 * 60 * 60 * 1000,
  });
  assert.equal(
    state.accumulatedUsageMs,
    60_000 + SNAPSHOT_REMINDER_MAX_TICK_DELTA_MS
  );
});

test('isSnapshotReminderDue triggers at 24 hours, respects snooze, and recurs after save reset', () => {
  const t0 = 1_700_000_000_000;
  let state = createInitialSnapshotReminderState(t0);

  // Below 24h: not due
  state = { ...state, accumulatedUsageMs: SNAPSHOT_REMINDER_INTERVAL_MS - 1000 };
  assert.equal(isSnapshotReminderDue(state, t0), false);

  // Reaches 24h: due immediately
  state = { ...state, accumulatedUsageMs: SNAPSHOT_REMINDER_INTERVAL_MS };
  assert.equal(isSnapshotReminderDue(state, t0), true);

  // Snoozing suppresses reminder for 2 hours, then re-triggers automatically
  state = snoozeSnapshotReminder(state, t0, SNAPSHOT_REMINDER_SNOOZE_MS);
  assert.equal(isSnapshotReminderDue(state, t0 + 60 * 60 * 1000), false);
  assert.equal(
    isSnapshotReminderDue(state, t0 + SNAPSHOT_REMINDER_SNOOZE_MS),
    true
  );

  // Saving a snapshot resets accumulated usage to 0 and clears snooze for the next 24h cycle
  state = markSnapshotSavedForReminder(
    state,
    '2026-11-26T04:00:00.000Z',
    t0 + SNAPSHOT_REMINDER_SNOOZE_MS
  );
  assert.equal(state.accumulatedUsageMs, 0);
  assert.equal(state.snoozedUntilMs, null);
  assert.equal(state.completedRemindersCount, 1);
  assert.equal(state.lastSnapshotAt, '2026-11-26T04:00:00.000Z');
  assert.equal(
    isSnapshotReminderDue(state, t0 + SNAPSHOT_REMINDER_SNOOZE_MS + 1000),
    false
  );

  // Disabling reminder prevents triggering even at 24h+
  state = { ...state, accumulatedUsageMs: SNAPSHOT_REMINDER_INTERVAL_MS + 5000 };
  state = setSnapshotReminderEnabled(state, false, t0);
  assert.equal(isSnapshotReminderDue(state, t0), false);
});

test('formatting and progress helpers compute clear human-readable strings', () => {
  assert.equal(formatUsageDuration(0), '0m');
  assert.equal(formatUsageDuration(30_000), '< 1m');
  assert.equal(formatUsageDuration(45 * 60_000), '45m');
  assert.equal(formatUsageDuration(24 * 60 * 60 * 1000), '24h 0m');
  assert.equal(
    formatUsageDuration(25 * 60 * 60 * 1000 + 15 * 60_000),
    '25h 15m'
  );

  assert.equal(calculateUsageProgressPercent(0), 0);
  assert.equal(
    calculateUsageProgressPercent(SNAPSHOT_REMINDER_INTERVAL_MS / 2),
    50
  );
  assert.equal(
    calculateUsageProgressPercent(SNAPSHOT_REMINDER_INTERVAL_MS * 1.5),
    100
  );
});

test('per-user localStorage persistence isolates users and recovers cleanly from corrupt JSON', () => {
  const storage = createMemoryStorage();
  assert.equal(normalizeReminderUserKey(' Sohel '), 'sohel');
  assert.notEqual(
    buildSnapshotReminderStorageKey('sohel'),
    buildSnapshotReminderStorageKey('mizan')
  );

  const saved = saveSnapshotReminderState(
    'sohel',
    {
      ...createInitialSnapshotReminderState(1000),
      accumulatedUsageMs: 12 * 60 * 60 * 1000,
      completedRemindersCount: 2,
    },
    storage
  );
  assert.equal(saved.accumulatedUsageMs, 12 * 60 * 60 * 1000);

  const reloaded = loadSnapshotReminderState('sohel', storage, 2000);
  assert.equal(reloaded.accumulatedUsageMs, 12 * 60 * 60 * 1000);
  assert.equal(reloaded.completedRemindersCount, 2);

  // Different user starts fresh at 0
  const mizanState = loadSnapshotReminderState('mizan', storage, 2000);
  assert.equal(mizanState.accumulatedUsageMs, 0);

  // Corrupt storage recovers gracefully
  storage.setItem(buildSnapshotReminderStorageKey('sohel'), '{bad-json');
  const recovered = loadSnapshotReminderState('sohel', storage, 3000);
  assert.equal(recovered.accumulatedUsageMs, 0);
  assert.equal(recovered.enabled, true);

  // Negative/invalid numbers sanitized cleanly
  const sanitized = sanitizeSnapshotReminderState(
    { accumulatedUsageMs: -500, enabled: 'yes' },
    4000
  );
  assert.equal(sanitized.accumulatedUsageMs, 0);
  assert.equal(sanitized.enabled, true);
});
