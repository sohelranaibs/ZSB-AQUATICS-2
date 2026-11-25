import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        data-testid="pwa-install-btn"
        onClick={() => {
          void install();
        }}
        className="flex items-center space-x-1.5 px-3 py-1 text-[11px] font-bold text-black rounded-full transition whitespace-nowrap shrink-0 cursor-pointer"
        title="Install ZSB AQUATICS as an offline-ready desktop/mobile app"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          data-testid="pwa-ios-install-btn"
          onClick={() => setShowGuide(true)}
          className="flex items-center space-x-1.5 px-3 py-1 text-[11px] font-bold text-black rounded-full transition whitespace-nowrap shrink-0 cursor-pointer"
          title="Install ZSB AQUATICS on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {showGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Install on iPhone or iPad"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 print:hidden"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Install ZSB AQUATICS on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close iOS install instructions"
                  className="p-1 rounded-full text-black cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Tap the <strong>Share</strong> icon in your Safari toolbar.</li>
                <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> to launch ZSB AQUATICS offline like a native app.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2 text-xs font-bold text-black cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

interface OfflineIndicatorProps {
  pendingQueueCount?: number;
  isSyncingQueue?: boolean;
  onOpenQueueModal?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  pendingQueueCount = 0,
  isSyncingQueue = false,
  onOpenQueueModal,
}) => {
  const isOnline = useOnlineStatus();

  // Offline Mode status is rendered as a subtle non-blocking alert in the top-right header.
  // Only show this queue progress toast when online and actively flushing/holding queued items.
  if (!isOnline || (pendingQueueCount === 0 && !isSyncingQueue)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-offline-indicator"
      className={`fixed bottom-4 left-4 z-[85] flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-lg border print:hidden ${
        !isOnline
          ? 'bg-amber-700 border-amber-400'
          : 'bg-[#273E56] border-sky-400'
      }`}
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {!isOnline
          ? pendingQueueCount > 0
            ? `Offline Mode — ${pendingQueueCount} ${pendingQueueCount === 1 ? 'Action' : 'Actions'} Queued in Service Worker`
            : 'Offline Mode — Service Worker Background Sync Ready'
          : isSyncingQueue
          ? 'Reconnected — Pushing Queued Actions to Local Storage...'
          : `${pendingQueueCount} Queued Offline ${pendingQueueCount === 1 ? 'Action' : 'Actions'} Pending Push`}
      </span>
      {onOpenQueueModal && (
        <button
          type="button"
          data-testid="offline-indicator-open-queue-btn"
          onClick={onOpenQueueModal}
          className="px-2.5 py-0.5 text-[10px] font-extrabold text-black rounded-full whitespace-nowrap cursor-pointer"
        >
          VIEW QUEUE ({pendingQueueCount})
        </button>
      )}
    </div>
  );
};
