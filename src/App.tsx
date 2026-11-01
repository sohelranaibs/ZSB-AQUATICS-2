/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { ExcelHeaderRibbon } from './components/ExcelHeaderRibbon.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { PurchaseFormView } from './components/PurchaseFormView.tsx';
import { PackingListView } from './components/PackingListView.tsx';
import { AirWayBillView } from './components/AirWayBillView.tsx';
import { PaymentFormView } from './components/PaymentFormView.tsx';
import { ExporterPaymentFormView } from './components/ExporterPaymentFormView.tsx';
import { ExporterPaymentSlipView } from './components/ExporterPaymentSlipView.tsx';
import { ProfitLossView } from './components/ProfitLossView.tsx';
import { DatabaseView } from './components/DatabaseView.tsx';
import { SearchReportsView } from './components/SearchReportsView.tsx';
import { AuditLogsView } from './components/AuditLogsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { AdministrationView } from './components/AdministrationView.tsx';
import { LandingLoginView } from './components/LandingLoginView.tsx';
import { PrintPreviewModal } from './components/PrintPreviewModal.tsx';
import { QuickEntryModal } from './components/QuickEntryModal.tsx';
import { SuperAdminClearModal } from './components/SuperAdminClearModal.tsx';
import { DatabaseSnapshotModal } from './components/DatabaseSnapshotModal.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';
import {
  ShortcutActionId,
  ORDERED_WORKBOOK_TABS,
  resolveGlobalKeyboardShortcut,
  isEditableElement,
  getAdjacentWorkbookTab,
  dispatchViewShortcutAction,
} from './utils/keyboardShortcuts.ts';
import { ActiveTab } from './types/index.ts';
import {
  CheckCircle2,
  Smartphone,
  Monitor,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
} from 'lucide-react';
import {
  DisplayMode,
  HorizontalScrollState,
  clampZoomPercent,
  stepZoomPercent,
  computeViewportLayoutMetrics,
  shouldLockHorizontalSwipe,
  computeSwipeScrollLeft,
  computeMomentumScrollLeft,
  computeHorizontalScrollState,
  SWIPE_MOMENTUM_MIN_VELOCITY,
  bindPassiveTouchListeners,
  loadDisplayPreferences,
  saveDisplayPreferences,
} from './utils/displayViewport.ts';

const MainContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    toastMessage,
    showToast,
    printModalData,
    closePrintModal,
    dataCenterModal,
    openDataCenterModal,
    closeDataCenterModal,
    snapshotModalOpen,
    openSnapshotModal,
    closeSnapshotModal,
    superAdminClearModal,
    closeSuperAdminClearModal,
    triggerManualSync,
    createSnapshot,
    exportCurrentViewToPdf,
  } = useApp();

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Display Mode, Zoom In/Out & Full Screen Workspace State
  const [displayPrefs, setDisplayPrefs] = useState(() => loadDisplayPreferences());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    saveDisplayPreferences(displayPrefs);
  }, [displayPrefs]);

  useEffect(() => {
    let rafId = 0;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setIsFullScreen(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const layoutMetrics = useMemo(
    () =>
      computeViewportLayoutMetrics({
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height,
        displayMode: displayPrefs.displayMode,
        zoomPercent: displayPrefs.zoomPercent,
      }),
    [viewportSize.width, viewportSize.height, displayPrefs.displayMode, displayPrefs.zoomPercent]
  );

  const handleChangeDisplayMode = useCallback(
    (mode: DisplayMode) => {
      setDisplayPrefs((prev) => ({
        ...prev,
        displayMode: mode,
      }));
      showToast(
        mode === 'desktop_full'
          ? 'Desktop View (1440px Full Workbook Sheet) enabled.'
          : 'Smart Mobile Display Auto-Adjust enabled.'
      );
    },
    [showToast]
  );

  const handleZoomIn = useCallback(() => {
    setDisplayPrefs((prev) => {
      const nextZoom = stepZoomPercent(prev.zoomPercent, 'in');
      return { ...prev, zoomPercent: nextZoom };
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setDisplayPrefs((prev) => {
      const nextZoom = stepZoomPercent(prev.zoomPercent, 'out');
      return { ...prev, zoomPercent: nextZoom };
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setDisplayPrefs((prev) => ({
      ...prev,
      zoomPercent: stepZoomPercent(prev.zoomPercent, 'reset'),
    }));
  }, []);

  const handleSelectZoomPreset = useCallback((zoom: number) => {
    setDisplayPrefs((prev) => ({
      ...prev,
      zoomPercent: clampZoomPercent(zoom),
    }));
  }, []);

  const handleToggleFullScreen = useCallback(async () => {
    const nextState = !isFullScreen;
    setIsFullScreen(nextState);
    try {
      if (nextState && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!nextState && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback gracefully to in-app maximized full-screen workspace when inside restricted iframes
    }
    showToast(
      nextState
        ? 'Full Screen Workspace active. Top header compacted for maximum sheet view.'
        : 'Exited Full Screen Workspace.'
    );
  }, [isFullScreen, showToast]);

  const getDatasetForTab = useCallback((tab: ActiveTab) => {
    if (
      tab === 'packing_form' ||
      tab === 'air_way_bill' ||
      tab === 'packing_db' ||
      tab === 'exporter_payment_slip'
    ) {
      return 'packing' as const;
    }
    if (tab === 'payment_form' || tab === 'exporter_payment_form' || tab === 'payment_db') {
      return 'payment' as const;
    }
    if (tab === 'profit_loss') {
      return 'other_cost' as const;
    }
    return 'purchase' as const;
  }, []);

  const executeShortcutAction = useCallback(
    (action: ShortcutActionId, targetTab?: ActiveTab) => {
      switch (action) {
        case 'CLOSE_ACTIVE_MODAL': {
          if (shortcutsModalOpen) {
            setShortcutsModalOpen(false);
            return;
          }
          if (printModalData.isOpen) {
            closePrintModal();
            return;
          }
          if (dataCenterModal.isOpen) {
            closeDataCenterModal();
            return;
          }
          if (snapshotModalOpen) {
            closeSnapshotModal();
            return;
          }
          if (superAdminClearModal.isOpen) {
            closeSuperAdminClearModal();
            return;
          }
          return;
        }
        case 'FOCUS_GLOBAL_SEARCH': {
          const input = document.getElementById('header-global-search-input') as HTMLInputElement | null;
          if (input) {
            input.focus();
            input.select();
          }
          return;
        }
        case 'OPEN_SHORTCUTS_MODAL': {
          setShortcutsModalOpen((prev) => !prev);
          return;
        }
        case 'OPEN_SNAPSHOT_MODAL': {
          openSnapshotModal();
          showToast('Opened Database Snapshot Manager (Ctrl+Shift+S).');
          return;
        }
        case 'OPEN_EXCEL_MODAL': {
          openDataCenterModal('import', getDatasetForTab(activeTab));
          showToast('Opened Excel & CSV Data Center (Ctrl+E).');
          return;
        }
        case 'SAVE_ACTIVE_VIEW': {
          const handled = dispatchViewShortcutAction('SAVE_ACTIVE_VIEW');
          if (!handled) {
            triggerManualSync('All Ledgers (Ctrl+S)');
            createSnapshot(
              'Quick Save (Ctrl+S)',
              `Saved from ${activeTab} via Ctrl+S shortcut`,
              'manual'
            );
            showToast('All ledgers synced and database snapshot saved (Ctrl+S).');
          }
          return;
        }
        case 'PRINT_ACTIVE_VIEW': {
          const handled = dispatchViewShortcutAction('PRINT_ACTIVE_VIEW');
          if (!handled) {
            void exportCurrentViewToPdf({ openPreviewOnly: true });
          }
          return;
        }
        case 'ADD_FORM_ROW': {
          const handled = dispatchViewShortcutAction('ADD_FORM_ROW');
          if (!handled) {
            showToast(
              'Switch to a data-entry form (Alt+2..Alt+6) to add a new line item row (Alt+N).'
            );
          }
          return;
        }
        case 'RESET_FORM': {
          const handled = dispatchViewShortcutAction('RESET_FORM');
          if (!handled) {
            showToast(
              'Switch to a data-entry form (Alt+2..Alt+6) to reset form fields (Alt+R).'
            );
          }
          return;
        }
        case 'NEXT_TAB': {
          const nextTab = getAdjacentWorkbookTab(activeTab, 'next');
          setActiveTab(nextTab);
          const info = ORDERED_WORKBOOK_TABS.find((t) => t.id === nextTab);
          if (info) {
            showToast(`Switched to Sheet #${info.number}: ${info.label} (Alt+→)`);
          }
          return;
        }
        case 'PREV_TAB': {
          const prevTab = getAdjacentWorkbookTab(activeTab, 'prev');
          setActiveTab(prevTab);
          const info = ORDERED_WORKBOOK_TABS.find((t) => t.id === prevTab);
          if (info) {
            showToast(`Switched to Sheet #${info.number}: ${info.label} (Alt+←)`);
          }
          return;
        }
        case 'JUMP_TO_TAB': {
          if (targetTab) {
            setActiveTab(targetTab);
            const info = ORDERED_WORKBOOK_TABS.find((t) => t.id === targetTab);
            if (info) {
              const keyDigit = info.number === 10 ? 0 : info.number;
              showToast(`Switched to Sheet #${info.number}: ${info.label} (Alt+${keyDigit})`);
            }
          }
          return;
        }
      }
    },
    [
      activeTab,
      closeDataCenterModal,
      closePrintModal,
      closeSnapshotModal,
      closeSuperAdminClearModal,
      createSnapshot,
      dataCenterModal.isOpen,
      exportCurrentViewToPdf,
      getDatasetForTab,
      openDataCenterModal,
      openSnapshotModal,
      printModalData.isOpen,
      setActiveTab,
      shortcutsModalOpen,
      showToast,
      snapshotModalOpen,
      superAdminClearModal.isOpen,
      triggerManualSync,
    ]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const resolved = resolveGlobalKeyboardShortcut({
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        repeat: e.repeat,
        isEditableTarget: isEditableElement(target),
      });

      if (!resolved) return;

      if (resolved.preventDefault) {
        e.preventDefault();
      }

      executeShortcutAction(resolved.action, resolved.targetTab);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeShortcutAction]);

  // Horizontal Swipe-to-Scroll State & Gesture Refs for `sheet-viewport-scroll-wrapper` in Smart Mobile Mode
  const sheetScrollWrapperRef = useRef<HTMLDivElement | null>(null);
  const activeScrollTargetRef = useRef<HTMLElement | null>(null);
  const touchGestureActiveRef = useRef(false);
  const [isSwipeScrolling, setIsSwipeScrolling] = useState(false);
  const [scrollState, setScrollState] = useState<HorizontalScrollState>(() =>
    computeHorizontalScrollState(0, 0, 0)
  );

  const swipeSessionRef = useRef<{
    active: boolean;
    pointerId: number | null;
    isLockedHorizontal: boolean;
    isCancelledVertical: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastTimestamp: number;
    velocityXPerMs: number;
    startScrollLeft: number;
    maxScrollLeft: number;
    targetEl: HTMLElement | null;
  }>({
    active: false,
    pointerId: null,
    isLockedHorizontal: false,
    isCancelledVertical: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTimestamp: 0,
    velocityXPerMs: 0,
    startScrollLeft: 0,
    maxScrollLeft: 0,
    targetEl: null,
  });

  const isInteractiveSwipeExcludedTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        'input, select, textarea, button, a, label, [role="button"], [contenteditable="true"]'
      )
    );
  }, []);

  const resolveHorizontalScrollTarget = useCallback(
    (originTarget: EventTarget | null, wrapperEl: HTMLDivElement): HTMLElement => {
      if (originTarget instanceof HTMLElement) {
        let cursor: HTMLElement | null = originTarget;
        while (cursor && cursor !== wrapperEl) {
          if (cursor.scrollWidth > cursor.clientWidth + 2) {
            const overflowX = window.getComputedStyle(cursor).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll') {
              return cursor;
            }
          }
          cursor = cursor.parentElement;
        }
      }

      if (wrapperEl.scrollWidth > wrapperEl.clientWidth + 2) {
        return wrapperEl;
      }

      const nestedScrollables = wrapperEl.querySelectorAll<HTMLElement>('.overflow-x-auto');
      let bestCandidate: HTMLElement | null = null;
      let bestOverflow = 2;
      nestedScrollables.forEach((el) => {
        const overflow = el.scrollWidth - el.clientWidth;
        if (overflow > bestOverflow) {
          bestOverflow = overflow;
          bestCandidate = el;
        }
      });

      return bestCandidate ?? wrapperEl;
    },
    []
  );

  const syncScrollMetricsFromTarget = useCallback(
    (preferredTarget?: HTMLElement | null) => {
      const wrapperEl = sheetScrollWrapperRef.current;
      if (!wrapperEl) return;
      const targetEl =
        preferredTarget && wrapperEl.contains(preferredTarget)
          ? preferredTarget
          : resolveHorizontalScrollTarget( activeScrollTargetRef.current, wrapperEl);
      activeScrollTargetRef.current = targetEl;
      const nextMetrics = computeHorizontalScrollState(
        targetEl.scrollLeft,
        targetEl.scrollWidth,
        targetEl.clientWidth
      );
      setScrollState((prev) => {
        if (
          prev.scrollLeft === nextMetrics.scrollLeft &&
          prev.maxScrollLeft === nextMetrics.maxScrollLeft &&
          prev.canScrollLeft === nextMetrics.canScrollLeft &&
          prev.canScrollRight === nextMetrics.canScrollRight &&
          prev.scrollProgressPercent === nextMetrics.scrollProgressPercent
        ) {
          return prev;
        }
        return nextMetrics;
      });
    },
    [resolveHorizontalScrollTarget]
  );

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      syncScrollMetricsFromTarget(null);
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    activeTab,
    layoutMetrics.displayMode,
    layoutMetrics.effectiveScale,
    viewportSize.width,
    syncScrollMetricsFromTarget,
  ]);

  const beginSwipeGesture = useCallback(
    (clientX: number, clientY: number, originTarget: EventTarget | null, pointerId: number | null) => {
      if (layoutMetrics.displayMode !== 'smart_mobile') return;
      const wrapperEl = sheetScrollWrapperRef.current;
      if (!wrapperEl) return;

      const targetEl = resolveHorizontalScrollTarget(originTarget, wrapperEl);
      activeScrollTargetRef.current = targetEl;
      const maxScrollLeft = Math.max(0, targetEl.scrollWidth - targetEl.clientWidth);

      swipeSessionRef.current = {
        active: true,
        pointerId,
        isLockedHorizontal: false,
        isCancelledVertical: false,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        lastTimestamp: performance.now(),
        velocityXPerMs: 0,
        startScrollLeft: targetEl.scrollLeft,
        maxScrollLeft,
        targetEl,
      };
    },
    [layoutMetrics.displayMode, resolveHorizontalScrollTarget]
  );

  const updateSwipeGesture = useCallback(
    (clientX: number, clientY: number, preventDefaultEvent?: () => void) => {
      const session = swipeSessionRef.current;
      if (!session.active || session.isCancelledVertical || layoutMetrics.displayMode !== 'smart_mobile') {
        return;
      }

      const deltaX = clientX - session.startX;
      const deltaY = clientY - session.startY;

      if (!session.isLockedHorizontal) {
        if (Math.abs(deltaY) > Math.abs(deltaX) * 1.25 && Math.abs(deltaY) > 10) {
          session.isCancelledVertical = true;
          session.active = false;
          setIsSwipeScrolling(false);
          return;
        }
        if (!shouldLockHorizontalSwipe(deltaX, deltaY)) {
          return;
        }
        session.isLockedHorizontal = true;
        setIsSwipeScrolling(true);
      }

      if (preventDefaultEvent) {
        preventDefaultEvent();
      }

      const now = performance.now();
      const dt = Math.max(1, now - session.lastTimestamp);
      const instantVelocity = (clientX - session.lastX) / dt;
      session.velocityXPerMs = session.velocityXPerMs * 0.25 + instantVelocity * 0.75;
      session.lastX = clientX;
      session.lastTimestamp = now;

      const targetEl = session.targetEl ?? sheetScrollWrapperRef.current;
      if (!targetEl) return;

      const liveMaxScroll = Math.max(session.maxScrollLeft, targetEl.scrollWidth - targetEl.clientWidth);
      session.maxScrollLeft = liveMaxScroll;

      const nextScrollLeft = computeSwipeScrollLeft({
        startScrollLeft: session.startScrollLeft,
        deltaX,
        maxScrollLeft: liveMaxScroll,
      });

      targetEl.scrollLeft = nextScrollLeft;
      if (
        sheetScrollWrapperRef.current &&
        targetEl !== sheetScrollWrapperRef.current &&
        sheetScrollWrapperRef.current.scrollWidth > sheetScrollWrapperRef.current.clientWidth
      ) {
        sheetScrollWrapperRef.current.scrollLeft = nextScrollLeft;
      }

      syncScrollMetricsFromTarget(targetEl);
    },
    [layoutMetrics.displayMode, syncScrollMetricsFromTarget]
  );

  const endSwipeGesture = useCallback(() => {
    const session = swipeSessionRef.current;
    if (!session.active) return;

    const wasLocked = session.isLockedHorizontal;
    const targetEl = session.targetEl ?? sheetScrollWrapperRef.current;
    const velocityXPerMs = session.velocityXPerMs;
    const maxScrollLeft = session.maxScrollLeft;

    session.active = false;
    session.pointerId = null;
    session.isLockedHorizontal = false;
    session.isCancelledVertical = false;
    setIsSwipeScrolling(false);

    if (wasLocked && targetEl && Math.abs(velocityXPerMs) >= SWIPE_MOMENTUM_MIN_VELOCITY) {
      const momentumTarget = computeMomentumScrollLeft({
        currentScrollLeft: targetEl.scrollLeft,
        velocityXPerMs,
        maxScrollLeft: Math.max(maxScrollLeft, targetEl.scrollWidth - targetEl.clientWidth),
      });
      targetEl.scrollLeft = momentumTarget;
      if (
        sheetScrollWrapperRef.current &&
        targetEl !== sheetScrollWrapperRef.current &&
        sheetScrollWrapperRef.current.scrollWidth > sheetScrollWrapperRef.current.clientWidth
      ) {
        sheetScrollWrapperRef.current.scrollLeft = momentumTarget;
      }
      syncScrollMetricsFromTarget(targetEl);
    } else if (targetEl) {
      syncScrollMetricsFromTarget(targetEl);
    }
  }, [syncScrollMetricsFromTarget]);

  const handleWrapperTouchStart = useCallback(
    (e: TouchEvent) => {
      if (layoutMetrics.displayMode !== 'smart_mobile' || e.touches.length !== 1) return;
      if (isInteractiveSwipeExcludedTarget(e.target)) return;
      touchGestureActiveRef.current = true;
      const touch = e.touches[0];
      beginSwipeGesture(touch.clientX, touch.clientY, e.target, null);
    },
    [beginSwipeGesture, isInteractiveSwipeExcludedTarget, layoutMetrics.displayMode]
  );

  const handleWrapperTouchMove = useCallback(
    (e: TouchEvent) => {
      if (layoutMetrics.displayMode !== 'smart_mobile' || e.touches.length !== 1) return;
      const touch = e.touches[0];
      // Passive touchmove listener: never calls preventDefault() so mobile browser compositor stays non-blocking
      updateSwipeGesture(touch.clientX, touch.clientY);
    },
    [layoutMetrics.displayMode, updateSwipeGesture]
  );

  const handleWrapperTouchEnd = useCallback(() => {
    endSwipeGesture();
    window.setTimeout(() => {
      touchGestureActiveRef.current = false;
    }, 80);
  }, [endSwipeGesture]);

  useEffect(() => {
    const wrapperEl = sheetScrollWrapperRef.current;
    if (!wrapperEl) return;
    return bindPassiveTouchListeners(wrapperEl, {
      onTouchStart: handleWrapperTouchStart,
      onTouchMove: handleWrapperTouchMove,
      onTouchEnd: handleWrapperTouchEnd,
      onTouchCancel: handleWrapperTouchEnd,
    });
  }, [handleWrapperTouchStart, handleWrapperTouchMove, handleWrapperTouchEnd]);

  const handleWrapperPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (layoutMetrics.displayMode !== 'smart_mobile') return;
      if (touchGestureActiveRef.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isInteractiveSwipeExcludedTarget(e.target)) return;

      beginSwipeGesture(e.clientX, e.clientY, e.target, e.pointerId);
    },
    [beginSwipeGesture, isInteractiveSwipeExcludedTarget, layoutMetrics.displayMode]
  );

  const handleWrapperPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (touchGestureActiveRef.current) return;
      if (!swipeSessionRef.current.active) return;
      updateSwipeGesture(e.clientX, e.clientY, () => e.preventDefault());
    },
    [updateSwipeGesture]
  );

  const handleWrapperPointerUp = useCallback(() => {
    if (touchGestureActiveRef.current) return;
    endSwipeGesture();
  }, [endSwipeGesture]);

  const handleWrapperScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrolledEl = e.target instanceof HTMLElement ? e.target : sheetScrollWrapperRef.current;
      syncScrollMetricsFromTarget(scrolledEl);
    },
    [syncScrollMetricsFromTarget]
  );

  const handleQuickHorizontalPan = useCallback(
    (direction: 'left' | 'right') => {
      const wrapperEl = sheetScrollWrapperRef.current;
      if (!wrapperEl) return;
      const targetEl = resolveHorizontalScrollTarget(activeScrollTargetRef.current, wrapperEl);
      const stepPx = Math.max(140, Math.round(targetEl.clientWidth * 0.55));
      const maxScrollLeft = Math.max(0, targetEl.scrollWidth - targetEl.clientWidth);
      const deltaX = direction === 'right' ? -stepPx : stepPx;
      const nextScrollLeft = computeSwipeScrollLeft({
        startScrollLeft: targetEl.scrollLeft,
        deltaX,
        maxScrollLeft,
        multiplier: 1,
      });
      targetEl.scrollLeft = nextScrollLeft;
      syncScrollMetricsFromTarget(targetEl);
    },
    [resolveHorizontalScrollTarget, syncScrollMetricsFromTarget]
  );

  return (
    <div
      data-testid="app-workspace-root"
      data-display-mode={layoutMetrics.displayMode}
      data-zoom-percent={layoutMetrics.userZoomPercent}
      data-fullscreen={isFullScreen ? 'true' : 'false'}
      className={`min-h-screen flex flex-col bg-slate-100 text-slate-900 pb-14 ${
        layoutMetrics.displayMode === 'smart_mobile' ? 'smart-mobile-active' : 'desktop-view-active'
      } ${isFullScreen ? 'workspace-fullscreen-active' : ''}`}
    >
      {/* Excel Ribbon & Sheet Navigation Tabs */}
      <ExcelHeaderRibbon
        onOpenShortcutsModal={() => setShortcutsModalOpen(true)}
        displayMode={layoutMetrics.displayMode}
        onChangeDisplayMode={handleChangeDisplayMode}
        zoomPercent={layoutMetrics.userZoomPercent}
        effectivePercentLabel={layoutMetrics.effectivePercentLabel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onSelectZoomPreset={handleSelectZoomPreset}
        isFullScreen={isFullScreen}
        onToggleFullScreen={handleToggleFullScreen}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="global-toast-banner"
          className="fixed bottom-14 right-3 sm:bottom-4 sm:right-4 z-[70] bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border-2 border-emerald-400/80 flex items-center space-x-2.5 text-xs font-bold transition-all duration-150 print:hidden max-w-md"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Smart Mobile Horizontal Swipe-to-Scroll Navigation Strip (Visible when horizontal overflow exists in Smart Mobile mode) */}
      {layoutMetrics.displayMode === 'smart_mobile' && scrollState.maxScrollLeft > 0 && (
        <div
          data-testid="smart-mobile-swipe-bar"
          className="bg-slate-900/95 text-slate-200 px-3 py-1 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] print:hidden select-none"
        >
          <div className="flex items-center space-x-1.5 min-w-0">
            <MoveHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-300 truncate">
              Swipe Left / Right to Scroll Sheet
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              ({scrollState.scrollProgressPercent}%)
            </span>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              data-testid="smart-mobile-pan-left-btn"
              onClick={() => handleQuickHorizontalPan('left')}
              disabled={!scrollState.canScrollLeft}
              aria-label="Pan Sheet Left"
              title="Pan Sheet Left"
              className="flex items-center space-x-0.5 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:opacity-40 cursor-pointer font-bold"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Left</span>
            </button>
            <button
              type="button"
              data-testid="smart-mobile-pan-right-btn"
              onClick={() => handleQuickHorizontalPan('right')}
              disabled={!scrollState.canScrollRight}
              aria-label="Pan Sheet Right"
              title="Pan Sheet Right"
              className="flex items-center space-x-0.5 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:opacity-40 cursor-pointer font-bold"
            >
              <span>Right</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main Active Sheet Body with Smart Mobile / Desktop View (1440px), Horizontal Swipe-to-Scroll & Zoom Scaling */}
      <div
        ref={sheetScrollWrapperRef}
        data-testid="sheet-viewport-scroll-wrapper"
        data-passive-touch="true"
        data-swipe-enabled={layoutMetrics.displayMode === 'smart_mobile' ? 'true' : 'false'}
        data-swipe-scrolling={isSwipeScrolling ? 'true' : 'false'}
        data-scroll-left={scrollState.scrollLeft}
        data-max-scroll-left={scrollState.maxScrollLeft}
        data-can-scroll-left={scrollState.canScrollLeft ? 'true' : 'false'}
        data-can-scroll-right={scrollState.canScrollRight ? 'true' : 'false'}
        data-scroll-progress={scrollState.scrollProgressPercent}
        onPointerDown={handleWrapperPointerDown}
        onPointerMove={handleWrapperPointerMove}
        onPointerUp={handleWrapperPointerUp}
        onPointerCancel={handleWrapperPointerUp}
        onPointerLeave={handleWrapperPointerUp}
        onScrollCapture={handleWrapperScroll}
        className="flex-1 w-full overflow-x-auto smart-scroll-container"
      >
        <main
          data-testid="sheet-zoom-canvas"
          style={{
            zoom: layoutMetrics.effectiveScale,
            minWidth: layoutMetrics.canvasMinWidthPx
              ? `${layoutMetrics.canvasMinWidthPx}px`
              : undefined,
          }}
          className="w-full origin-top-left transition-none"
        >
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'purchase_form' && <PurchaseFormView />}
          {activeTab === 'packing_form' && <PackingListView />}
          {activeTab === 'air_way_bill' && <AirWayBillView />}
          {activeTab === 'payment_form' && <PaymentFormView />}
          {activeTab === 'exporter_payment_form' && <ExporterPaymentFormView />}
          {activeTab === 'exporter_payment_slip' && <ExporterPaymentSlipView />}
          {activeTab === 'profit_loss' && <ProfitLossView />}
          {activeTab === 'purchase_db' && <DatabaseView initialType="purchase" />}
          {activeTab === 'packing_db' && <DatabaseView initialType="packing" />}
          {activeTab === 'payment_db' && <DatabaseView initialType="payment" />}
          {activeTab === 'search_reports' && <SearchReportsView />}
          {activeTab === 'audit_logs' && <AuditLogsView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'administration' && <AdministrationView />}
        </main>
      </div>

      {/* Floating Quick Display, Zoom & Full Screen Pill (Fast Bottom-Left Access on Mobile & Desktop) */}
      <div
        data-testid="floating-display-quickbar"
        className="fixed bottom-3 left-3 z-50 flex items-center space-x-1 bg-slate-950/95 text-slate-100 px-2 py-1 rounded-full shadow-xl border border-slate-700/90 backdrop-blur-xs print:hidden select-none text-[11px] font-mono"
      >
        <button
          type="button"
          data-testid="quickbar-mode-toggle-btn"
          onClick={() =>
            handleChangeDisplayMode(
              layoutMetrics.displayMode === 'smart_mobile' ? 'desktop_full' : 'smart_mobile'
            )
          }
          title={
            layoutMetrics.displayMode === 'smart_mobile'
              ? 'Currently in Smart Mobile Mode. Click to switch to Desktop View (1440px).'
              : 'Currently in Desktop View (1440px). Click to switch to Smart Mobile Adjust.'
          }
          className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-sans font-bold transition cursor-pointer ${
            layoutMetrics.displayMode === 'desktop_full'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {layoutMetrics.displayMode === 'desktop_full' ? (
            <>
              <Monitor className="w-3 h-3 shrink-0" />
              <span>Desktop</span>
            </>
          ) : (
            <>
              <Smartphone className="w-3 h-3 shrink-0" />
              <span>Smart Mobile</span>
            </>
          )}
        </button>

        <div className="h-3.5 w-px bg-slate-700" />

        <button
          type="button"
          data-testid="quickbar-zoom-out-btn"
          onClick={handleZoomOut}
          disabled={layoutMetrics.userZoomPercent <= 40}
          aria-label="Quick Zoom Out"
          title="Zoom Out (-10%)"
          className="p-1 rounded-full hover:bg-slate-800 text-slate-200 hover:text-amber-300 disabled:opacity-40 cursor-pointer"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        <button
          type="button"
          data-testid="quickbar-zoom-reset-btn"
          onClick={handleZoomReset}
          title="Click to reset zoom to 100%"
          className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-amber-300 font-bold cursor-pointer"
        >
          {layoutMetrics.effectivePercentLabel}
        </button>

        <button
          type="button"
          data-testid="quickbar-zoom-in-btn"
          onClick={handleZoomIn}
          disabled={layoutMetrics.userZoomPercent >= 200}
          aria-label="Quick Zoom In"
          title="Zoom In (+10%)"
          className="p-1 rounded-full hover:bg-slate-800 text-slate-200 hover:text-amber-300 disabled:opacity-40 cursor-pointer"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        {layoutMetrics.userZoomPercent !== 100 && (
          <button
            type="button"
            onClick={handleZoomReset}
            title="Reset Zoom to 100%"
            className="p-1 rounded-full hover:bg-slate-800 text-amber-400 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        <div className="h-3.5 w-px bg-slate-700" />

        <button
          type="button"
          data-testid="quickbar-fullscreen-btn"
          onClick={handleToggleFullScreen}
          aria-label={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          title={isFullScreen ? 'Exit Full Screen' : 'Show Full Screen'}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-sans font-bold transition cursor-pointer ${
            isFullScreen
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
          }`}
        >
          {isFullScreen ? (
            <>
              <Minimize2 className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Exit Full</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Full Screen</span>
            </>
          )}
        </button>
      </div>

      {/* Printable Modal (Voucher / Statement / PDF) */}
      <PrintPreviewModal />

      {/* Global Excel (.XLSX) & CSV Import / Export Center Modal */}
      <QuickEntryModal />

      {/* Super Admin Password Verification Modal for Clear All Records */}
      <SuperAdminClearModal />

      {/* Local JSON Database Snapshot & State Recovery Modal */}
      <DatabaseSnapshotModal />

      {/* Global Keyboard Shortcuts Reference & Command Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        onExecuteShortcut={executeShortcutAction}
      />
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <LandingLoginView />;
  }

  return <MainContent />;
};

export default function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
}
