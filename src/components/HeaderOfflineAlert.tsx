import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall.ts';
import {
  deriveOfflineAlertState,
  RECONNECT_BANNER_DURATION_MS,
} from '../utils/offlineAlert.ts';

interface HeaderOfflineAlertProps {
  pendingQueueCount?: number;
  isSyncingQueue?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Subtle, non-blocking visual alert for the top-right corner of the header.
 * Appears automatically when the browser detects a loss of internet connectivity
 * and transitions cleanly back to idle when connection is restored.
 */
export const HeaderOfflineAlert: React.FC<HeaderOfflineAlertProps> = React.memo(
  ({
    pendingQueueCount = 0,
    isSyncingQueue = false,
    compact = false,
    className = '',
  }) => {
    const isOnline = useOnlineStatus();
    const [recentlyReconnected, setRecentlyReconnected] = useState(false);
    const wasOfflineRef = useRef<boolean>(!isOnline);

    useEffect(() => {
      if (!isOnline) {
        wasOfflineRef.current = true;
        setRecentlyReconnected(false);
        return;
      }

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setRecentlyReconnected(true);
        const timer = window.setTimeout(() => {
          setRecentlyReconnected(false);
        }, RECONNECT_BANNER_DURATION_MS);
        return () => window.clearTimeout(timer);
      }
    }, [isOnline]);

    const viewModel = useMemo(
      () =>
        deriveOfflineAlertState({
          isOnline,
          recentlyReconnected,
          pendingQueueCount,
          isSyncingQueue,
        }),
      [isOnline, recentlyReconnected, pendingQueueCount, isSyncingQueue]
    );

    if (!viewModel.visible) {
      return null;
    }

    const isOffline = viewModel.tone === 'offline';

    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={viewModel.ariaLabel}
        title={viewModel.tooltip}
        data-testid={compact ? 'header-offline-alert-compact' : 'header-offline-alert'}
        data-network-state={viewModel.tone}
        className={`inline-flex items-center gap-1.5 rounded-md border backdrop-blur-xs select-none whitespace-nowrap shrink-0 transition-all duration-200 print:hidden ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } ${
          isOffline
            ? 'bg-amber-950/65 border-amber-400/50 text-amber-100 shadow-2xs'
            : 'bg-emerald-950/60 border-emerald-400/45 text-emerald-100 shadow-2xs'
        } ${className}`}
      >
        <span
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isOffline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
          }`}
        />
        {isOffline ? (
          <WifiOff
            className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} !text-amber-300 shrink-0`}
            aria-hidden="true"
          />
        ) : (
          <Wifi
            className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} !text-emerald-300 shrink-0`}
            aria-hidden="true"
          />
        )}
        <span className="font-semibold tracking-wide leading-none">
          {compact ? viewModel.compactLabel : viewModel.label}
        </span>
        {!compact && viewModel.queueBadgeText && (
          <span className="text-[10px] font-mono text-amber-200/90 pl-1 border-l border-amber-300/30 leading-none">
            {viewModel.queueBadgeText}
          </span>
        )}
      </div>
    );
  }
);

HeaderOfflineAlert.displayName = 'HeaderOfflineAlert';
