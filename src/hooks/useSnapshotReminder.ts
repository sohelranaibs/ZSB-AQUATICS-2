import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  SNAPSHOT_REMINDER_INTERVAL_MS,
  SNAPSHOT_REMINDER_SNOOZE_MS,
  SNAPSHOT_REMINDER_SYNC_EVENT,
  SnapshotReminderState,
  accumulateActiveUsage,
  buildSnapshotReminderStorageKey,
  calculateUsageProgressPercent,
  formatUsageDuration,
  isSnapshotReminderDue,
  loadSnapshotReminderState,
  markSnapshotSavedForReminder,
  normalizeReminderUserKey,
  saveSnapshotReminderState,
  setSnapshotReminderEnabled,
  snoozeSnapshotReminder,
} from '../utils/snapshotReminder.ts';

const HEARTBEAT_INTERVAL_MS = 30_000;

function broadcastReminderSync(userKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(SNAPSHOT_REMINDER_SYNC_EVENT, { detail: { userKey } })
    );
  } catch {
    // Ignore CustomEvent restriction in non-browser environments
  }
}

export interface UseSnapshotReminderResult {
  reminderState: SnapshotReminderState;
  isDue: boolean;
  progressPercent: number;
  formattedUsage: string;
  formattedRemaining: string;
  remainingMs: number;
  liveRecordCount: number;
  saveSnapshotNow: () => void;
  saveAndDownloadSnapshot: () => void;
  snoozeReminder: () => void;
  openSnapshotsManager: () => void;
  toggleReminderEnabled: (enabled: boolean) => void;
}

export function useSnapshotReminder(options?: {
  trackUsage?: boolean;
}): UseSnapshotReminderResult {
  const trackUsage = options?.trackUsage !== false;
  const {
    isAuthenticated,
    currentUser,
    snapshots,
    purchases,
    packings,
    payments,
    otherCosts,
    createSnapshot,
    downloadSnapshotJSON,
    openSnapshotModal,
    showToast,
  } = useApp();

  const userKey = normalizeReminderUserKey(
    currentUser?.username || currentUser?.email || 'guest'
  );

  const [reminderState, setReminderState] = useState<SnapshotReminderState>(() =>
    loadSnapshotReminderState(userKey)
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const stateRef = useRef<SnapshotReminderState>(reminderState);
  stateRef.current = reminderState;

  const lastTickAtRef = useRef<number>(Date.now());
  const hasInitializedSnapshotsRef = useRef<boolean>(false);
  const lastSeenLatestSnapshotIdRef = useRef<string | null>(
    snapshots[0]?.id || null
  );

  const commitState = useCallback(
    (next: SnapshotReminderState, notifyPeers: boolean = true) => {
      const persisted = saveSnapshotReminderState(userKey, next);
      stateRef.current = persisted;
      setReminderState(persisted);
      setNowMs(Date.now());
      if (notifyPeers) {
        broadcastReminderSync(userKey);
      }
    },
    [userKey]
  );

  // Reload state whenever active authenticated user changes
  useEffect(() => {
    const loaded = loadSnapshotReminderState(userKey);
    stateRef.current = loaded;
    setReminderState(loaded);
    setNowMs(Date.now());
    lastTickAtRef.current = Date.now();
  }, [userKey]);

  // Keep multiple hook consumers (SnapshotReminderPrompt & DatabaseSnapshotModal) & tabs synchronized
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const storageKey = buildSnapshotReminderStorageKey(userKey);

    const reloadFromStorage = () => {
      const loaded = loadSnapshotReminderState(userKey);
      stateRef.current = loaded;
      setReminderState(loaded);
      setNowMs(Date.now());
    };

    const onCustomSync = (ev: Event) => {
      const customEv = ev as CustomEvent<{ userKey?: string }>;
      if (!customEv.detail?.userKey || customEv.detail.userKey === userKey) {
        reloadFromStorage();
      }
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === storageKey) {
        reloadFromStorage();
      }
    };

    window.addEventListener(SNAPSHOT_REMINDER_SYNC_EVENT, onCustomSync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SNAPSHOT_REMINDER_SYNC_EVENT, onCustomSync);
      window.removeEventListener('storage', onStorage);
    };
  }, [userKey]);

  // Automatically reset the 24-hour usage timer whenever a new local snapshot is saved anywhere in the app
  useEffect(() => {
    if (!trackUsage) return;
    const latest = snapshots[0];

    if (!hasInitializedSnapshotsRef.current) {
      hasInitializedSnapshotsRef.current = true;
      lastSeenLatestSnapshotIdRef.current = latest?.id ?? null;
      return;
    }

    if (!latest) {
      lastSeenLatestSnapshotIdRef.current = null;
      return;
    }

    if (latest.id !== lastSeenLatestSnapshotIdRef.current) {
      lastSeenLatestSnapshotIdRef.current = latest.id;
      const latestMs = Date.parse(latest.createdAt);
      const trackedMs = stateRef.current.lastSnapshotAt
        ? Date.parse(stateRef.current.lastSnapshotAt)
        : 0;
      if (!Number.isFinite(trackedMs) || !Number.isFinite(latestMs) || latestMs > trackedMs) {
        const next = markSnapshotSavedForReminder(
          stateRef.current,
          latest.createdAt,
          Date.now()
        );
        lastTickAtRef.current = Date.now();
        commitState(next, true);
      }
    }
  }, [trackUsage, snapshots, commitState]);

  // Active foreground usage heartbeat (tracks usage only while authenticated and tab is visible)
  useEffect(() => {
    if (
      !trackUsage ||
      !isAuthenticated ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return undefined;
    }

    lastTickAtRef.current = Date.now();

    const flushElapsed = (isVisibleOverride?: boolean) => {
      const now = Date.now();
      const delta = now - lastTickAtRef.current;
      lastTickAtRef.current = now;
      const isVisible =
        isVisibleOverride !== undefined
          ? isVisibleOverride
          : document.visibilityState === 'visible';

      const latestStored = loadSnapshotReminderState(userKey);
      const baseState =
        latestStored.lastUpdatedAtMs > stateRef.current.lastUpdatedAtMs
          ? latestStored
          : stateRef.current;

      if (delta > 0 && isVisible && baseState.enabled) {
        const next = accumulateActiveUsage(baseState, delta, {
          isVisible: true,
          nowMs: now,
        });
        if (next !== baseState) {
          commitState(next, true);
          return;
        }
      }
      if (baseState !== stateRef.current) {
        stateRef.current = baseState;
        setReminderState(baseState);
      }
      setNowMs(now);
    };

    const intervalId = window.setInterval(() => {
      flushElapsed();
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Flush active time accumulated up to the moment the tab became hidden
        flushElapsed(true);
      } else {
        // Returning to foreground: reset tick anchor so hidden duration is not counted
        lastTickAtRef.current = Date.now();
        setNowMs(Date.now());
      }
    };

    const handlePageHide = () => {
      if (document.visibilityState === 'visible') {
        flushElapsed(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [trackUsage, isAuthenticated, commitState]);

  const saveSnapshotNow = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const snap = createSnapshot(
      `24h Scheduled Backup (${today})`,
      `Saved from 24-hour active usage reminder (${formatUsageDuration(stateRef.current.accumulatedUsageMs)} logged).`,
      'manual'
    );
    lastSeenLatestSnapshotIdRef.current = snap.id;
    lastTickAtRef.current = Date.now();
    const next = markSnapshotSavedForReminder(
      stateRef.current,
      snap.createdAt,
      Date.now()
    );
    commitState(next, true);
  }, [createSnapshot, commitState]);

  const saveAndDownloadSnapshot = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const snap = createSnapshot(
      `24h Scheduled Backup (${today})`,
      `Saved and exported to JSON from 24-hour active usage reminder.`,
      'manual'
    );
    lastSeenLatestSnapshotIdRef.current = snap.id;
    lastTickAtRef.current = Date.now();
    const next = markSnapshotSavedForReminder(
      stateRef.current,
      snap.createdAt,
      Date.now()
    );
    commitState(next, true);
    downloadSnapshotJSON(snap.id);
  }, [createSnapshot, downloadSnapshotJSON, commitState]);

  const snoozeReminder = useCallback(() => {
    const now = Date.now();
    const next = snoozeSnapshotReminder(
      stateRef.current,
      now,
      SNAPSHOT_REMINDER_SNOOZE_MS
    );
    commitState(next, true);
    showToast('Backup reminder snoozed for 2 hours.');
  }, [commitState, showToast]);

  const openSnapshotsManager = useCallback(() => {
    openSnapshotModal();
  }, [openSnapshotModal]);

  const toggleReminderEnabled = useCallback(
    (enabled: boolean) => {
      const next = setSnapshotReminderEnabled(
        stateRef.current,
        enabled,
        Date.now()
      );
      lastTickAtRef.current = Date.now();
      commitState(next, true);
    },
    [commitState]
  );

  const isDue = useMemo(
    () => isSnapshotReminderDue(reminderState, nowMs, SNAPSHOT_REMINDER_INTERVAL_MS),
    [reminderState, nowMs]
  );

  const progressPercent = useMemo(
    () =>
      calculateUsageProgressPercent(
        reminderState.accumulatedUsageMs,
        SNAPSHOT_REMINDER_INTERVAL_MS
      ),
    [reminderState.accumulatedUsageMs]
  );

  const remainingMs = Math.max(
    0,
    SNAPSHOT_REMINDER_INTERVAL_MS - reminderState.accumulatedUsageMs
  );

  const liveRecordCount =
    purchases.length + packings.length + payments.length + otherCosts.length;

  return {
    reminderState,
    isDue,
    progressPercent,
    formattedUsage: formatUsageDuration(reminderState.accumulatedUsageMs),
    formattedRemaining: formatUsageDuration(remainingMs),
    remainingMs,
    liveRecordCount,
    saveSnapshotNow,
    saveAndDownloadSnapshot,
    snoozeReminder,
    openSnapshotsManager,
    toggleReminderEnabled,
  };
}
