import { useEffect, useRef } from 'react';
import { triggerDebouncedAutoSaveIndicator } from '../context/VolatileFeedbackStore.ts';

/**
 * Monitors a serialized form/table payload and triggers a debounced save callback
 * along with the subtle header "Auto-saving..." indicator whenever a user-driven
 * data-entry change occurs.
 *
 * Supports both:
 * - `useDebouncedStoreSave(serializedPayload, onSave, debounceMs)`
 * - `useDebouncedStoreSave(sourceLabel, serializedPayload, onSave, debounceMs)`
 *
 * Also flushes any pending unsaved change synchronously on component unmount or
 * browser page unload/refresh so navigating away immediately after typing never
 * loses the latest draft.
 */
export function useDebouncedStoreSave(
  arg1: string,
  arg2?: string | (() => void),
  arg3?: number | (() => void),
  arg4?: number
): void {
  const hasLabel = typeof arg2 === 'string';
  const sourceLabel = hasLabel ? arg1 : undefined;
  const serializedPayload = hasLabel ? (arg2 as string) : arg1;
  const onSave = hasLabel
    ? (typeof arg3 === 'function' ? arg3 : undefined)
    : (typeof arg2 === 'function' ? arg2 : undefined);
  const debounceMs = hasLabel
    ? (typeof arg4 === 'number' ? arg4 : 180)
    : (typeof arg3 === 'number' ? arg3 : 180);

  const isInitialMountRef = useRef(true);
  const lastSavedPayloadRef = useRef(serializedPayload);
  const latestPayloadRef = useRef(serializedPayload);
  const onSaveRef = useRef(onSave);
  const sourceLabelRef = useRef(sourceLabel);

  latestPayloadRef.current = serializedPayload;
  onSaveRef.current = onSave;
  sourceLabelRef.current = sourceLabel;

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedPayloadRef.current = serializedPayload;
      return;
    }

    if (serializedPayload === lastSavedPayloadRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      lastSavedPayloadRef.current = serializedPayload;
      try {
        onSaveRef.current?.();
      } catch (err) {
        console.error('[useDebouncedStoreSave] Failed to persist debounced draft:', err);
      }
      triggerDebouncedAutoSaveIndicator(sourceLabelRef.current);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [serializedPayload, debounceMs]);

  useEffect(() => {
    const flushPendingSave = () => {
      if (latestPayloadRef.current !== lastSavedPayloadRef.current) {
        lastSavedPayloadRef.current = latestPayloadRef.current;
        try {
          onSaveRef.current?.();
        } catch (err) {
          console.error('[useDebouncedStoreSave] Failed to flush draft on unload:', err);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', flushPendingSave);
      window.addEventListener('pagehide', flushPendingSave);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', flushPendingSave);
        window.removeEventListener('pagehide', flushPendingSave);
      }
      flushPendingSave();
    };
  }, []);
}
