import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useSyncTelemetrySnapshot } from '../context/VolatileFeedbackStore.ts';
import {
  computeTotalPersistedRecords,
  getSyncStatusDisplay,
} from '../utils/syncStatus.ts';
import {
  Menu,
  Archive,
  RefreshCw,
  AlertCircle,
  Database,
  Zap,
  Pause,
  Smartphone,
  Monitor,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  PanelLeft,
  User,
} from 'lucide-react';
import { GlobalSearchBar } from './GlobalSearchBar.tsx';
import { DisplayMode, ZOOM_PRESETS } from '../utils/displayViewport.ts';
import { buildWorkbookSheets } from './ThemeSidebarNav.tsx';

interface ExcelHeaderRibbonProps {
  sheets?: ReturnType<typeof buildWorkbookSheets>;
  onOpenShortcutsModal?: () => void;
  displayMode?: DisplayMode;
  onChangeDisplayMode?: (mode: DisplayMode) => void;
  zoomPercent?: number;
  effectivePercentLabel?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onSelectZoomPreset?: (zoom: number) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenMobileDrawer?: () => void;
}

interface HeaderSyncControlsProps {
  totalRecordsCount: number;
  isLiveSyncEnabled: boolean;
  toggleLiveSync: (enabled?: boolean) => void;
  forceSyncNow: (entityLabel?: string) => Promise<boolean>;
}

const HeaderSyncControls: React.FC<HeaderSyncControlsProps> = React.memo(
  ({ totalRecordsCount, isLiveSyncEnabled, toggleLiveSync, forceSyncNow }) => {
    const {
      syncStatus,
      lastSyncedAt,
      lastBackupAt,
      lastSyncedEntity,
      syncStartedAtMs,
      isSlowConnection,
      isForcingSync,
      hasUnsyncedChanges,
      isAutoSaving,
      lastAutoSaveTriggeredAtMs,
    } = useSyncTelemetrySnapshot();

    const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

    React.useEffect(() => {
      setNowMs(Date.now());
      const tickMs =
        syncStatus === 'saving' || isForcingSync || isAutoSaving ? 500 : 10000;
      const interval = window.setInterval(() => {
        setNowMs(Date.now());
      }, tickMs);
      return () => window.clearInterval(interval);
    }, [
      lastSyncedAt,
      lastBackupAt,
      syncStatus,
      isForcingSync,
      hasUnsyncedChanges,
      isAutoSaving,
      lastAutoSaveTriggeredAtMs,
    ]);

    const syncDisplay = useMemo(
      () =>
        getSyncStatusDisplay(
          {
            status: syncStatus,
            lastSyncedAt,
            lastBackupAt,
            lastSyncedEntity,
            totalRecordsCount,
            isLiveSyncEnabled,
            hasUnsyncedChanges,
            syncStartedAtMs,
            isSlowConnection,
            isForcingSync,
            isAutoSaving,
            lastAutoSaveTriggeredAtMs,
          },
          nowMs
        ),
      [
        syncStatus,
        lastSyncedAt,
        lastBackupAt,
        lastSyncedEntity,
        totalRecordsCount,
        isLiveSyncEnabled,
        hasUnsyncedChanges,
        syncStartedAtMs,
        isSlowConnection,
        isForcingSync,
        isAutoSaving,
        lastAutoSaveTriggeredAtMs,
        nowMs,
      ]
    );

    return (
      <div
        data-testid="header-sync-group"
        className={`flex items-center gap-2 sm:gap-2.5 px-3 py-1 rounded-full border bg-[#1F3349] shrink-0 transition-colors ${
          syncDisplay.isSlowSync || syncDisplay.indicatorColor === 'rose'
            ? 'border-amber-400/70'
            : 'border-white/15'
        }`}
      >
        {/* Live Sync Background Auto-save Toggle */}
        <div
          className="flex items-center space-x-1.5 text-[11px] whitespace-nowrap shrink-0 pr-2 border-r border-white/15"
          title={
            isLiveSyncEnabled
              ? 'Live Sync is ON: Background database auto-save is active. Click to pause for high-frequency data entry.'
              : 'Live Sync is PAUSED: Background auto-save disabled. Click to resume or click "Force Sync" (Ctrl+S) to back up immediately.'
          }
        >
          <Zap
            className={`w-3.5 h-3.5 transition-colors ${
              isLiveSyncEnabled ? 'text-[#00B14F]' : 'text-slate-400'
            }`}
          />
          <button
            type="button"
            role="switch"
            aria-checked={isLiveSyncEnabled}
            data-testid="ribbon-live-sync-toggle"
            onClick={() => toggleLiveSync()}
            aria-label={`Live Sync background auto-save toggle. Currently ${
              isLiveSyncEnabled ? 'Enabled' : 'Paused'
            }. Click to toggle.`}
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#1D6CE0] ${
              isLiveSyncEnabled ? 'bg-[#00B14F]' : 'bg-slate-500'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isLiveSyncEnabled ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>

          <span
            className={`text-[10px] font-mono font-bold ${
              isLiveSyncEnabled ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {isLiveSyncEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Background Sync Status & Last Successful Backup Timestamp */}
        <div
          role="status"
          aria-live="polite"
          data-testid="ribbon-sync-status"
          data-sync-freshness={syncDisplay.freshnessTier}
          data-sync-color={syncDisplay.indicatorColor}
          data-sync-slow={syncDisplay.isSlowSync ? 'true' : 'false'}
          data-autosaving={syncDisplay.showAutoSavingIndicator ? 'true' : 'false'}
          aria-label={`${syncDisplay.ariaLabel}. Last backup at ${syncDisplay.formattedBackupDateTime}.`}
          title={`Background Sync: ${syncDisplay.statusBannerLabel} (${syncDisplay.freshnessLabel})\nLast Successful Backup: ${syncDisplay.formattedBackupDateTime} (${syncDisplay.backupElapsedText})\nRecords Protected: ${totalRecordsCount} ledger entries`}
          className="flex items-center space-x-1.5 text-[11px] whitespace-nowrap shrink-0"
        >
          {syncStatus === 'saving' || isForcingSync ? (
            <RefreshCw className="w-3 h-3 text-amber-300 animate-spin shrink-0" />
          ) : syncDisplay.indicatorColor === 'rose' ? (
            <AlertCircle className="w-3 h-3 text-rose-300 shrink-0" />
          ) : syncStatus === 'paused' ? (
            <Pause className="w-3 h-3 text-amber-300 shrink-0" />
          ) : syncDisplay.isSlowSync ? (
            <AlertCircle className="w-3 h-3 text-amber-300 shrink-0" />
          ) : (
            <span
              data-testid="header-sync-status-dot"
              className="relative flex h-2 w-2 shrink-0"
            >
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  syncDisplay.indicatorColor === 'emerald'
                    ? 'bg-[#00B14F]'
                    : syncDisplay.indicatorColor === 'sky'
                    ? 'bg-[#1D6CE0]'
                    : 'bg-amber-400'
                }`}
              />
            </span>
          )}

          <span
            data-testid="header-sync-freshness-label"
            className={`text-[11px] font-bold ${
              syncDisplay.isSlowSync || syncStatus === 'saving'
                ? 'text-amber-300'
                : syncDisplay.indicatorColor === 'rose'
                ? 'text-rose-300'
                : syncStatus === 'paused'
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {syncDisplay.statusBannerLabel}
          </span>

          <span
            data-testid="header-last-backup-timestamp"
            className="text-[10px] font-mono font-semibold text-sky-200 border-l border-white/20 pl-2 inline-flex items-center gap-1.5"
          >
            <span>
              Last Backup: {syncDisplay.formattedBackupTime}
              <span
                data-testid="header-sync-elapsed-badge"
                className="hidden 2xl:inline text-slate-300"
              >
                {' '}
                · {syncDisplay.backupElapsedText}
              </span>
            </span>

            {syncDisplay.showAutoSavingIndicator && (
              <span
                data-testid="header-autosaving-indicator"
                aria-live="polite"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-300/35 text-[10px] font-sans font-medium text-amber-200 animate-pulse transition-opacity duration-200"
              >
                <RefreshCw className="w-2.5 h-2.5 text-amber-300 animate-spin shrink-0" />
                <span>{syncDisplay.autoSavingLabel}</span>
              </span>
            )}
          </span>
        </div>

        {/* Manual Force Sync Button (especially helpful if connection is slow or sync is paused) */}
        <button
          type="button"
          data-testid="ribbon-force-sync-btn"
          disabled={isForcingSync}
          onClick={() => {
            void forceSyncNow('All Ledgers (Manual Force Sync)');
            setNowMs(Date.now());
          }}
          aria-label="Force immediate background synchronization and backup"
          title={
            syncDisplay.isSlowSync
              ? 'Slow connection detected: Click Force Sync to immediately flush all ledgers to backup storage (Ctrl+S)'
              : 'Force Sync: Immediately flush all ledgers & update backup timestamp (Ctrl+S)'
          }
          className={`flex items-center space-x-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
            syncDisplay.shouldHighlightForceSync
              ? 'border-amber-400 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
              : 'border-white/25 bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          <RefreshCw
            className={`w-3 h-3 shrink-0 ${
              isForcingSync ? 'animate-spin text-amber-300' : 'text-sky-200'
            }`}
          />
          <span>{isForcingSync ? 'Syncing...' : 'Force Sync'}</span>
        </button>
      </div>
    );
  }
);

const HeaderBottomSyncStatus: React.FC<{ totalRecordsCount: number; rmbExchangeRate: number }> =
  React.memo(({ totalRecordsCount, rmbExchangeRate }) => {
    const { syncStatus, lastSyncedEntity, hasUnsyncedChanges } = useSyncTelemetrySnapshot();
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-[11px] font-mono text-slate-200 hidden 2xl:flex items-center space-x-2.5 shrink-0"
      >
        <span
          className={`flex items-center space-x-1 ${
            syncStatus === 'saving'
              ? 'text-amber-300 font-semibold'
              : syncStatus === 'error'
              ? 'text-rose-300 font-semibold'
              : syncStatus === 'paused'
              ? 'text-amber-300 font-semibold'
              : 'text-emerald-300 font-semibold'
          }`}
        >
          <Database className="w-3 h-3 shrink-0" />
          <span>
            {syncStatus === 'saving'
              ? `Auto-saving (${lastSyncedEntity})...`
              : syncStatus === 'error'
              ? 'Sync Error'
              : syncStatus === 'paused'
              ? hasUnsyncedChanges
                ? 'Live Sync Paused (Unsaved Edits)'
                : 'Live Sync Paused (Idle)'
              : `Synced (${totalRecordsCount} records)`}
          </span>
        </span>
        <span className="text-white/25">|</span>
        <span className="text-sky-200">1 RMB = {rmbExchangeRate} TK</span>
      </div>
    );
  });

export const ExcelHeaderRibbon: React.FC<ExcelHeaderRibbonProps> = React.memo(({
  sheets,
  displayMode = 'smart_mobile',
  onChangeDisplayMode,
  zoomPercent = 100,
  effectivePercentLabel = '100%',
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onSelectZoomPreset,
  isFullScreen = false,
  onToggleFullScreen,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onOpenMobileDrawer,
}) => {
  const {
    activeTab,
    setActiveTab,
    companyProfile,
    openSnapshotModal,
    snapshots,
    purchases,
    packings,
    payments,
    otherCosts,
    forceSyncNow,
    isLiveSyncEnabled,
    toggleLiveSync,
    currentUser,
    auditLogs,
  } = useApp();

  const totalRecordsCount = computeTotalPersistedRecords({
    purchases: purchases.length,
    packings: packings.length,
    payments: payments.length,
    otherCosts: otherCosts.length,
  });



  const formulaText = useMemo(() => {
    switch (activeTab) {
      case 'dashboard':
        return '=SUM(PURCHASE_DB!E:E) + SUM(PACKING_DB!G:G) [REAL-TIME SYSTEM ROLLUP]';
      case 'purchase_form':
        return '=SUM(Quantity * Rate) + Previous_Amount - Paid_Amount';
      case 'packing_form':
        return '=Box * Weight (Total Weight KG) * Rate (RMB) = Total Export Value (RMB)';
      case 'air_way_bill':
        return '=TOTAL_BOX * RMB/PER_BOX = TOTAL_RMB | TOTAL_RMB * RATE = BDT_AMOUNT [FLIGHT RETURN BILL]';
      case 'payment_form':
        return '=Supplier_Debit_Paid - Supplier_Credit_Rebate | Previous_Balance - Paid_Amount';
      case 'exporter_payment_form':
        return '=Report (RMB) - Credit (Claim RMB) = Row_Balance (RMB) | Debit (RMB) Display Only';
      case 'exporter_payment_slip':
        return '=Weight * RMB = Amount | FILTER(EXPORTER_DB!A:H, (MARK=Selected_Mark) * (DATE=Selected_Packing_Date))';
      case 'profit_loss':
        return '=Total_Export_Value - Total_Purchases - Total_Other_Costing = NET_PROFIT';
      case 'total_balance':
        return '=SUM(PARTNER_DEPOSIT_SHARES) + SUM(EXPORT_&_OTHER_INCOME) - SUM(ALL_COSTING) [TOTAL BALANCE]';
      case 'audit_logs':
        return `=COUNTIF(AUDIT_TRAIL!A:G, "ENTRY | EDIT | DELETE") [TOTAL_LOGGED: ${auditLogs.length}]`;
      case 'administration':
        return '=AUTH.ROLE("SUPER_ADMIN") & VAULT.MANAGE("ACCOUNTS", "TEAM", "AUDIT", "BACKUPS") [SUPER ADMIN SECURE CONSOLE]';
      case 'forget_password':
        return '=AUTH.RESET("EMAIL_CONFIRMATION", "VERIFY_CODE", "RESET_PASSWORD") [FORGET PASSWORD]';
      case 'settings':
        return '=CONFIG.SYSTEM("COMPANY_PROFILE", "DROPDOWNS", "THRESHOLDS") [SETTINGS & CONFIGURATION]';
      default:
        return '=VLOOKUP(Invoice_Number, MASTER_DATABASE, 2, FALSE)';
    }
  }, [activeTab, auditLogs.length]);

  const workbookSheets = useMemo(
    () =>
      sheets ??
      buildWorkbookSheets({
        purchasesCount: purchases.length,
        packingsCount: packings.length,
        paymentsCount: payments.length,
        auditLogsCount: auditLogs.length,
      }),
    [sheets, purchases.length, packings.length, payments.length, auditLogs.length]
  );

  const activeSheetMeta = workbookSheets.find((s) => s.id === activeTab) || workbookSheets[0];

  return (
    <header className="bg-[#273E56] text-white select-none print:hidden md:sticky md:top-0 z-40">
      {/* Persistent Mobile ZSB AQUATICS Export Ledger Bar (< md, visible across every sheet) */}
      <div
        data-testid="mobile-export-ledger-bar"
        className="md:hidden bg-[#273E56] text-white px-3 py-2 border-b border-white/15 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {onOpenMobileDrawer && (
            <button
              type="button"
              data-testid="mobile-ledger-menu-btn"
              onClick={onOpenMobileDrawer}
              aria-label="Open ZSB AQUATICS Export Ledger Menu"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-white p-0.5 border border-[#CBD8E6] flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                alt={companyProfile.companyName}
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-xs font-black tracking-tight text-amber-400 zsb-golden-brand truncate">
                {companyProfile.companyName}
              </div>
              <div className="text-[10px] font-semibold text-sky-200 truncate">
                Export Ledger
              </div>
            </div>
          </button>
        </div>

        <span className="px-2 py-0.5 rounded bg-[#1D6CE0] text-white text-[10px] font-mono font-bold border border-white/20 shrink-0">
          #{activeSheetMeta?.num} {activeSheetMeta?.shortLabel}
        </span>
      </div>

      {/* Top Control Header Bar (Deep Navy #273E56: Left Sidebar Toggle + Search | Right Sync + Snapshots + User) */}
      {!isFullScreen && (
      <div className="bg-[#273E56] px-3 sm:px-4 py-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: Sidebar Toggle + Global Cross-Database Search Bar */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-[180px] max-w-xs xl:max-w-sm">
          {onToggleSidebar && (
            <button
              type="button"
              data-testid="ribbon-sidebar-toggle-btn"
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? 'Expand Sheet Sidebar' : 'Collapse Sheet Sidebar'}
              className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-[150px]">
            <GlobalSearchBar />
          </div>
        </div>

        {/* Right: Background Sync Status + Snapshots + Active User Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
          <HeaderSyncControls
            totalRecordsCount={totalRecordsCount}
            isLiveSyncEnabled={isLiveSyncEnabled}
            toggleLiveSync={toggleLiveSync}
            forceSyncNow={forceSyncNow}
          />

          <button
            type="button"
            data-testid="ribbon-snapshots-btn"
            onClick={openSnapshotModal}
            className="flex items-center space-x-1.5 px-3 py-1 text-[11px] font-bold bg-[#1D6CE0] hover:bg-[#1558BD] text-white rounded-full shadow-2xs transition whitespace-nowrap shrink-0 cursor-pointer"
            title="Open Database Snapshot & Local JSON Recovery Manager (Shortcut: Ctrl+Shift+S)"
          >
            <Archive className="w-3.5 h-3.5 text-white" />
            <span>Snapshots ({snapshots.length})</span>
          </button>

          {/* Top-Right Active User Profile Lockup */}
          {currentUser && (
            <div className="hidden xl:flex items-center gap-2 pl-2.5 border-l border-white/15 shrink-0">
              <div className="text-right leading-tight">
                <div className="text-[11px] font-bold text-white whitespace-nowrap">
                  {currentUser.displayName}
                </div>
                <div className="text-[9px] font-mono font-bold text-sky-200 uppercase tracking-wider whitespace-nowrap">
                  {currentUser.role === 'SUPER_ADMIN' ? 'ADMIN' : currentUser.role}
                </div>
              </div>
              <div className="w-7 h-7 rounded-full border border-white/25 bg-white/15 flex items-center justify-center text-white shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Clean Compact Navy Formula Bar + Display & Zoom Toolbar */}
      <div className="bg-[#1F3349] px-3 sm:px-4 py-1.5 border-t border-white/10 flex flex-wrap md:flex-nowrap items-center justify-between gap-2.5 text-xs font-mono text-slate-200">
        <div className={`${isFullScreen ? 'flex' : 'hidden md:flex'} items-center gap-2 min-w-0 flex-1 overflow-hidden`}>
          {isFullScreen && (
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="text-xs font-black tracking-tight text-amber-400 zsb-golden-brand shrink-0 mr-1 cursor-pointer"
              title="ZSB AQUATICS — Return to Dashboard"
            >
              {companyProfile.companyName}
            </button>
          )}

          <div className="px-1.5 py-0.5 rounded bg-white/10 font-bold select-none text-sky-300 italic text-[11px] shrink-0">
            fx
          </div>
          <div className="h-4 w-px bg-white/15 shrink-0" />
          <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-slate-200 min-w-0">
            <span className="text-slate-200 font-medium text-[11px]">{formulaText}</span>
          </div>
        </div>

        {/* Smart Mobile Display Adjust / Desktop View / Zoom In / Zoom Out / Full Screen Toolbar */}
        <div
          data-testid="display-viewport-toolbar"
          className="flex items-center flex-nowrap gap-2 sm:gap-2.5 shrink-0 w-full md:w-auto justify-between md:justify-end ml-auto"
        >
          {/* Smart Mobile Adjust vs Desktop View Mode Switcher */}
          <div
            role="group"
            aria-label="Display Viewport Mode"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#273E56] px-1.5 py-1"
          >
            <button
              type="button"
              data-testid="display-mode-smart-mobile-btn"
              onClick={() => onChangeDisplayMode?.('smart_mobile')}
              aria-pressed={displayMode === 'smart_mobile'}
              title="Smart Mobile Display Adjust: Automatically optimizes layout, table scrolling, and responsive touch controls for mobile & tablet screens"
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                displayMode === 'smart_mobile'
                  ? 'bg-white text-[#1F3349] shadow-2xs'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>Smart Mobile</span>
            </button>

            <button
              type="button"
              data-testid="display-mode-desktop-btn"
              onClick={() => onChangeDisplayMode?.('desktop_full')}
              aria-pressed={displayMode === 'desktop_full'}
              title="Show Desktop View (1440px Full Workbook Sheet): Renders the complete desktop spreadsheet layout scaled to fit any screen"
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                displayMode === 'desktop_full'
                  ? 'bg-white text-[#1F3349] shadow-2xs'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span>Desktop View</span>
            </button>
          </div>

          {/* Zoom Out / Zoom Percentage / Zoom In Controls */}
          <div
            role="group"
            aria-label="Zoom Controls"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#273E56] px-2 py-1"
          >
            <button
              type="button"
              data-testid="zoom-out-btn"
              onClick={onZoomOut}
              disabled={zoomPercent <= 40}
              aria-label="Zoom Out"
              title="Zoom Out (-10%)"
              className="flex items-center justify-center w-6 h-6 rounded-full text-slate-200 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <select
              data-testid="zoom-preset-select"
              aria-label="Select Zoom Percentage"
              value={zoomPercent}
              onChange={(e) => onSelectZoomPreset?.(Number(e.target.value))}
              title={`Current Display Scale: ${effectivePercentLabel}. Select a preset zoom level (50% - 200%).`}
              className="bg-white text-[#1F3349] border border-[#CBD8E6] rounded-md px-2 py-0.5 text-[11px] font-mono font-bold focus:outline-none focus:border-[#1D6CE0] cursor-pointer"
            >
              {!ZOOM_PRESETS.includes(zoomPercent) && (
                <option value={zoomPercent}>{effectivePercentLabel}</option>
              )}
              {ZOOM_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset === 100 && effectivePercentLabel.startsWith('Fit')
                    ? effectivePercentLabel
                    : `${preset}%`}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="zoom-in-btn"
              onClick={onZoomIn}
              disabled={zoomPercent >= 200}
              aria-label="Zoom In"
              title="Zoom In (+10%)"
              className="flex items-center justify-center w-6 h-6 rounded-full text-slate-200 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {zoomPercent !== 100 && (
              <button
                type="button"
                data-testid="zoom-reset-btn"
                onClick={onZoomReset}
                aria-label="Reset Zoom to 100%"
                title="Reset Zoom to 100%"
                className="flex items-center justify-center px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 mr-0.5" />
                <span>100%</span>
              </button>
            )}
          </div>

          {/* Full Screen Toggle Button */}
          <button
            type="button"
            data-testid="fullscreen-toggle-btn"
            onClick={onToggleFullScreen}
            aria-pressed={isFullScreen}
            title={
              isFullScreen
                ? 'Exit Full Screen Workspace (Esc)'
                : 'Show Full Screen Workspace (Maximizes active sheet & hides top banner)'
            }
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition cursor-pointer ${
              isFullScreen
                ? 'bg-white text-[#1F3349] border-white'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
            }`}
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Full Screen</span>
              </>
            )}
          </button>
        </div>

        <HeaderBottomSyncStatus
          totalRecordsCount={totalRecordsCount}
          rmbExchangeRate={companyProfile.rmbExchangeRate}
        />
      </div>
    </header>
  );
});
