import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSyncTelemetrySnapshot,
  getToastSnapshot,
  publishToastMessage,
  subscribeSyncTelemetry,
  subscribeToast,
  updateSyncTelemetry,
} from './VolatileFeedbackStore.ts';

describe('VolatileFeedbackStore', () => {
  it('notifies toast listeners only when the message changes', () => {
    let calls = 0;
    const unsub = subscribeToast(() => {
      calls += 1;
    });

    publishToastMessage('Saved bill #1');
    assert.equal(getToastSnapshot(), 'Saved bill #1');
    assert.equal(calls, 1);

    // Same message should be ignored cleanly (no wasted notification)
    publishToastMessage('Saved bill #1');
    assert.equal(calls, 1);

    publishToastMessage(null);
    assert.equal(getToastSnapshot(), null);
    assert.equal(calls, 2);
    unsub();
  });

  it('notifies sync telemetry listeners only when fields actually change', () => {
    let calls = 0;
    const unsub = subscribeSyncTelemetry(() => {
      calls += 1;
    });

    updateSyncTelemetry({
      syncStatus: 'saving',
      isForcingSync: true,
      lastSyncedEntity: 'Purchase DB',
    });
    assert.equal(getSyncTelemetrySnapshot().syncStatus, 'saving');
    assert.equal(getSyncTelemetrySnapshot().isForcingSync, true);
    assert.equal(calls, 1);

    // Identical patch should be a no-op
    updateSyncTelemetry({
      syncStatus: 'saving',
      isForcingSync: true,
      lastSyncedEntity: 'Purchase DB',
    });
    assert.equal(calls, 1);

    updateSyncTelemetry({
      syncStatus: 'synced',
      isForcingSync: false,
    });
    assert.equal(getSyncTelemetrySnapshot().syncStatus, 'synced');
    assert.equal(calls, 2);
    unsub();
  });
});
