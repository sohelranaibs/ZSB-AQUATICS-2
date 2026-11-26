export const SNAPSHOT_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours of active usage
export const SNAPSHOT_REMINDER_SNOOZE_MS = 2 * 60 * 60 * 1000; // 2 hours snooze
export const SNAPSHOT_REMINDER_MAX_TICK_DELTA_MS = 5 * 60 * 1000; // Cap single tick at 5 min to ignore sleep/idle gaps
export const SNAPSHOT_REMINDER_STORAGE_PREFIX =
  'zsb_aquatics_snapshot_reminder_v1::';
export const SNAPSHOT_REMINDER_SYNC_EVENT =
  'zsb-snapshot-reminder-state-changed';

export interface SnapshotReminderState {
  accumulatedUsageMs: number;
  lastSnapshotAt: string | null;
  snoozedUntilMs: number | null;
  completedRemindersCount: number;
  enabled: boolean;
  lastUpdatedAtMs: number;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeReminderUserKey(userKey?: string | null): string {
  const raw = (userKey || '').trim().toLowerCase();
  if (!raw) return 'guest';
  const cleaned = raw.replace(/[^a-z0-9@._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'guest';
}

export function buildSnapshotReminderStorageKey(
  userKey?: string | null
): string {
  return `${SNAPSHOT_REMINDER_STORAGE_PREFIX}${normalizeReminderUserKey(userKey)}`;
}

export function createInitialSnapshotReminderState(
  nowMs: number = Date.now()
): SnapshotReminderState {
  return {
    accumulatedUsageMs: 0,
    lastSnapshotAt: null,
    snoozedUntilMs: null,
    completedRemindersCount: 0,
    enabled: true,
    lastUpdatedAtMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
  };
}

export function sanitizeSnapshotReminderState(
  raw: unknown,
  nowMs: number = Date.now()
): SnapshotReminderState {
  const base = createInitialSnapshotReminderState(nowMs);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base;
  }
  const obj = raw as Record<string, unknown>;

  const accumulatedUsageMs =
    typeof obj.accumulatedUsageMs === 'number' &&
    Number.isFinite(obj.accumulatedUsageMs) &&
    obj.accumulatedUsageMs >= 0
      ? Math.floor(obj.accumulatedUsageMs)
      : 0;

  const lastSnapshotAt =
    typeof obj.lastSnapshotAt === 'string' && obj.lastSnapshotAt.trim().length > 0
      ? obj.lastSnapshotAt.trim()
      : null;

  const snoozedUntilMs =
    typeof obj.snoozedUntilMs === 'number' &&
    Number.isFinite(obj.snoozedUntilMs) &&
    obj.snoozedUntilMs > 0
      ? Math.floor(obj.snoozedUntilMs)
      : null;

  const completedRemindersCount =
    typeof obj.completedRemindersCount === 'number' &&
    Number.isFinite(obj.completedRemindersCount) &&
    obj.completedRemindersCount >= 0
      ? Math.floor(obj.completedRemindersCount)
      : 0;

  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : true;

  const lastUpdatedAtMs =
    typeof obj.lastUpdatedAtMs === 'number' &&
    Number.isFinite(obj.lastUpdatedAtMs) &&
    obj.lastUpdatedAtMs > 0
      ? Math.floor(obj.lastUpdatedAtMs)
      : base.lastUpdatedAtMs;

  return {
    accumulatedUsageMs,
    lastSnapshotAt,
    snoozedUntilMs,
    completedRemindersCount,
    enabled,
    lastUpdatedAtMs,
  };
}

/**
 * Accumulates active foreground usage time into the 24-hour reminder tracker.
 * Ignores hidden tabs and caps single-tick jumps so device sleep does not count as active usage.
 */
export function accumulateActiveUsage(
  state: SnapshotReminderState,
  deltaMs: number,
  options?: {
    isVisible?: boolean;
    nowMs?: number;
    maxTickDeltaMs?: number;
  }
): SnapshotReminderState {
  const nowMs = options?.nowMs ?? Date.now();
  const isVisible = options?.isVisible !== false;
  const maxTickDeltaMs =
    options?.maxTickDeltaMs ?? SNAPSHOT_REMINDER_MAX_TICK_DELTA_MS;

  if (!state.enabled || !isVisible || !Number.isFinite(deltaMs) || deltaMs <= 0) {
    return state;
  }

  const boundedDelta = Math.min(Math.floor(deltaMs), Math.max(1000, maxTickDeltaMs));
  return {
    ...state,
    accumulatedUsageMs: state.accumulatedUsageMs + boundedDelta,
    lastUpdatedAtMs: nowMs,
  };
}

/**
 * Evaluates whether the recurring 24-hour active usage reminder should prompt the user right now.
 */
export function isSnapshotReminderDue(
  state: SnapshotReminderState,
  nowMs: number = Date.now(),
  intervalMs: number = SNAPSHOT_REMINDER_INTERVAL_MS
): boolean {
  if (!state.enabled) return false;
  if (state.accumulatedUsageMs < intervalMs) return false;
  if (state.snoozedUntilMs !== null && nowMs < state.snoozedUntilMs) {
    return false;
  }
  return true;
}

/**
 * Resets the 24-hour usage counter after the user saves a local database snapshot.
 */
export function markSnapshotSavedForReminder(
  state: SnapshotReminderState,
  snapshotCreatedAtIso?: string,
  nowMs: number = Date.now()
): SnapshotReminderState {
  return {
    ...state,
    accumulatedUsageMs: 0,
    lastSnapshotAt: snapshotCreatedAtIso || new Date(nowMs).toISOString(),
    snoozedUntilMs: null,
    completedRemindersCount: state.completedRemindersCount + 1,
    lastUpdatedAtMs: nowMs,
  };
}

/**
 * Snoozes the prompt for a short interval (default 2 hours) without erasing accumulated usage,
 * so the recurring reminder re-appears once the snooze expires if no snapshot was saved yet.
 */
export function snoozeSnapshotReminder(
  state: SnapshotReminderState,
  nowMs: number = Date.now(),
  snoozeMs: number = SNAPSHOT_REMINDER_SNOOZE_MS
): SnapshotReminderState {
  return {
    ...state,
    snoozedUntilMs: nowMs + Math.max(60_000, snoozeMs),
    lastUpdatedAtMs: nowMs,
  };
}

export function setSnapshotReminderEnabled(
  state: SnapshotReminderState,
  enabled: boolean,
  nowMs: number = Date.now()
): SnapshotReminderState {
  return {
    ...state,
    enabled,
    snoozedUntilMs: enabled ? state.snoozedUntilMs : null,
    lastUpdatedAtMs: nowMs,
  };
}

export function calculateUsageProgressPercent(
  accumulatedUsageMs: number,
  intervalMs: number = SNAPSHOT_REMINDER_INTERVAL_MS
): number {
  if (!Number.isFinite(accumulatedUsageMs) || accumulatedUsageMs <= 0 || intervalMs <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((accumulatedUsageMs / intervalMs) * 100));
}

export function formatUsageDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '< 1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h 0m`;
  return `${hours}h ${minutes}m`;
}

export function loadSnapshotReminderState(
  userKey: string | null | undefined,
  storage: StorageLike | null = getDefaultStorage(),
  nowMs: number = Date.now()
): SnapshotReminderState {
  if (!storage) return createInitialSnapshotReminderState(nowMs);
  const key = buildSnapshotReminderStorageKey(userKey);
  try {
    const raw = storage.getItem(key);
    if (!raw) return createInitialSnapshotReminderState(nowMs);
    return sanitizeSnapshotReminderState(JSON.parse(raw), nowMs);
  } catch {
    return createInitialSnapshotReminderState(nowMs);
  }
}

export function saveSnapshotReminderState(
  userKey: string | null | undefined,
  state: SnapshotReminderState,
  storage: StorageLike | null = getDefaultStorage()
): SnapshotReminderState {
  const clean = sanitizeSnapshotReminderState(state, state.lastUpdatedAtMs);
  if (!storage) return clean;
  const key = buildSnapshotReminderStorageKey(userKey);
  try {
    storage.setItem(key, JSON.stringify(clean));
  } catch {
    // Ignore storage quota or restriction errors
  }
  return clean;
}
