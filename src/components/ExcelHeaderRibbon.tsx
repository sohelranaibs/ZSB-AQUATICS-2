import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  buildExporterPaymentSlipRows,
  calculateExporterSlipTotals,
} from '../utils/calculations.ts';
import {
  computeTotalPersistedRecords,
  getSyncStatusDisplay,
} from '../utils/syncStatus.ts';
import {
  Menu,
  Save,
  Printer,
  Download,
  Upload,
  Archive,
  Layers,
  Sparkles,
  Calculator,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Database,
  FileDown,
  Loader2,
  LogOut,
  ShieldCheck,
  Keyboard,
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

export const ExcelHeaderRibbon: React.FC<ExcelHeaderRibbonProps> = ({
  onOpenShortcutsModal,
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
    exportDatabaseJSON,
    importDatabaseJSON,
    openPrintModal,
    openDataCenterModal,
    openSnapshotModal,
    snapshots,
    purchases,
    packings,
    payments,
    otherCosts,
    syncStatus,
    lastSyncedAt,
    lastSyncedEntity,
    triggerManualSync,
    isLiveSyncEnabled,
    toggleLiveSync,
    hasUnsyncedChanges,
    exportCurrentViewToPdf,
    isExportingGlobalPdf,
    lastExportedPdfFilename,
    currentUser,
    logout,
    auditLogs,
  } = useApp();

  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => window.clearInterval(interval);
  }, [lastSyncedAt, syncStatus, hasUnsyncedChanges]);

  const totalRecordsCount = computeTotalPersistedRecords({
    purchases: purchases.length,
    packings: packings.length,
    payments: payments.length,
    otherCosts: otherCosts.length,
  });

  const syncDisplay = getSyncStatusDisplay(
    {
      status: syncStatus,
      lastSyncedAt,
      lastSyncedEntity,
      totalRecordsCount,
      isLiveSyncEnabled,
      hasUnsyncedChanges,
    },
    nowMs
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importDatabaseJSON(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };



  const getDatasetForActiveTab = () => {
    if (
      activeTab === 'packing_form' ||
      activeTab === 'air_way_bill' ||
      activeTab === 'packing_db' ||
      activeTab === 'exporter_payment_slip'
    ) {
      return 'packing' as const;
    }
    if (activeTab === 'payment_form' || activeTab === 'exporter_payment_form' || activeTab === 'payment_db') {
      return 'payment' as const;
    }
    if (activeTab === 'profit_loss' || activeTab === 'total_balance') {
      return 'other_cost' as const;
    }
    return 'purchase' as const;
  };

  const getFormulaForTab = () => {
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
  };

  const workbookSheets = buildWorkbookSheets({
    purchasesCount: purchases.length,
    packingsCount: packings.length,
    paymentsCount: payments.length,
    auditLogsCount: auditLogs.length,
  });

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

      {/* Top Company & Control Header Bar (Deep Navy #273E56 Matching Reference Top L-Frame) */}
      {!isFullScreen && (
      <div className="bg-[#273E56] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: Sidebar Toggle & Company Branding */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
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
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            title="Return to Sheet 01 · Executive Overview"
            className="w-9 h-9 rounded-full bg-white p-0.5 border border-[#CBD8E6] shadow-2xs flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-[#1D6CE0] transition"
          >
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="text-base sm:text-lg font-black tracking-tight text-amber-400 hover:text-amber-300 zsb-golden-brand cursor-pointer text-left leading-tight transition-colors"
                title="Go to Executive Overview (Sheet 01)"
              >
                <span className="zsb-golden-brand">{companyProfile.companyName}</span>
              </button>
              <span className="hidden 2xl:inline-block text-[10px] font-mono uppercase tracking-widest text-sky-200 border-l border-white/20 pl-2">
                Export Ledger
              </span>
            </div>
            <div className="hidden 2xl:flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-[10px] text-slate-300 leading-tight">
              <div className="flex items-center space-x-1">
                <span className="text-slate-400 font-medium">Addr:</span>
                <span className="font-semibold text-slate-100">{companyProfile.address}</span>
              </div>
              <span className="text-white/30">•</span>
              <div className="flex items-center space-x-1">
                <span className="text-slate-400 font-medium">Tel:</span>
                <span className="font-mono font-semibold text-slate-100">
                  {companyProfile.mobiles.join(', ')}
                </span>
              </div>
              <span className="text-white/30">•</span>
              <div className="flex items-center space-x-1">
                <span className="text-sky-300 font-bold">Email:</span>
                <span className="font-mono font-semibold text-slate-100">
                  {companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com'
                    ? companyProfile.email
                    : 'zsbaquatics@gmail.com'}
                </span>
              </div>
            </div>
            <div className="hidden md:flex 2xl:hidden items-center gap-x-2 mt-0.5 text-[10px] text-slate-300 max-w-[230px] truncate leading-tight">
              <span className="truncate">{companyProfile.address}</span>
            </div>
          </div>
        </div>

        {/* Center: Global Cross-Database Search Bar */}
        <div className="flex-1 max-w-xs xl:max-w-sm mx-1 min-w-[170px] order-3 xl:order-2 w-full xl:w-auto">
          <GlobalSearchBar />
        </div>

        {/* Right: Quick Macro Actions & Sync Status */}
        <div className="flex items-center gap-1.5 order-2 xl:order-3 flex-wrap justify-end">
          {/* Live Sync Background Auto-save Toggle */}
          <div
            className="flex items-center space-x-1 px-2 py-1 text-[11px] rounded-lg border border-white/15 bg-[#1F3349] whitespace-nowrap shrink-0"
            title={
              isLiveSyncEnabled
                ? 'Live Sync is ON: Background database auto-save is active. Click to pause for high-frequency data entry.'
                : 'Live Sync is PAUSED: Background auto-save disabled for faster data entry. Click to resume or use "Sync Now" (Ctrl+S) to save.'
            }
          >
            <div className="flex items-center space-x-1 text-slate-200">
              <Zap
                className={`w-3 h-3 transition-colors ${
                  isLiveSyncEnabled ? 'text-[#00B14F]' : 'text-slate-400'
                }`}
              />
              <span className="text-[10px] font-bold hidden 2xl:inline">Live Sync</span>
            </div>

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

          <button
            type="button"
            data-testid="ribbon-sync-status"
            data-sync-freshness={syncDisplay.freshnessTier}
            data-sync-color={syncDisplay.indicatorColor}
            onClick={() => {
              triggerManualSync('All Ledgers');
              setNowMs(Date.now());
            }}
            aria-label={`${syncDisplay.ariaLabel} (${syncDisplay.freshnessLabel} · ${syncDisplay.elapsedText})`}
            title={`Ledger Database Status: ${syncDisplay.freshnessLabel} (${syncDisplay.elapsedText} at ${syncDisplay.formattedTime}). Click to synchronize all ledger data now.`}
            className="flex items-center space-x-1 px-2 py-1 text-[11px] font-bold rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-white transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            {syncStatus === 'saving' ? (
              <RefreshCw className="w-3 h-3 text-amber-300 animate-spin shrink-0" />
            ) : syncDisplay.indicatorColor === 'rose' ? (
              <AlertCircle className="w-3 h-3 text-rose-300 shrink-0" />
            ) : syncStatus === 'paused' ? (
              <Pause className="w-3 h-3 text-amber-300 shrink-0" />
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
            <span data-testid="header-sync-freshness-label">
              {syncStatus === 'saving'
                ? 'Saving...'
                : syncStatus === 'paused'
                ? hasUnsyncedChanges
                  ? 'Unsaved'
                  : 'Paused'
                : syncDisplay.freshnessLabel}
            </span>
            <span
              data-testid="header-sync-elapsed-badge"
              className="text-[10px] font-mono font-semibold text-sky-200 border-l border-white/20 pl-1 hidden 2xl:inline"
            >
              {syncStatus === 'saving'
                ? lastSyncedEntity
                : `${syncDisplay.elapsedText} · ${syncDisplay.formattedTime}`}
            </span>
          </button>

          <button
            type="button"
            data-testid="ribbon-snapshots-btn"
            onClick={openSnapshotModal}
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold bg-[#1D6CE0] hover:bg-[#1558BD] text-white rounded-lg shadow-2xs transition whitespace-nowrap shrink-0 cursor-pointer"
            title="Open Database Snapshot & Local JSON Recovery Manager (Shortcut: Ctrl+Shift+S)"
          >
            <Archive className="w-3 h-3 text-white" />
            <span>Snapshots ({snapshots.length})</span>
          </button>

          <button
            type="button"
            data-testid="ribbon-shortcuts-btn"
            onClick={onOpenShortcutsModal}
            className="flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
            title="Open Global Keyboard Shortcuts Reference (Shortcut: Ctrl+/ or ?)"
          >
            <Keyboard className="w-3 h-3 text-sky-200 shrink-0" />
            <span className="hidden 2xl:inline">Shortcuts</span>
            <kbd className="px-1 py-0 bg-white/15 border border-white/20 rounded text-[9px] font-mono text-white">
              Ctrl+/
            </kbd>
          </button>

          <button
            onClick={exportDatabaseJSON}
            className="flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
            title="Export full database backup as JSON"
          >
            <Download className="w-3 h-3 text-sky-300" />
            <span className="hidden 2xl:inline">Backup DB</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
            title="Restore database from JSON"
          >
            <Upload className="w-3 h-3 text-emerald-300" />
            <span className="hidden 2xl:inline">Restore</span>
          </button>

          <button
            type="button"
            data-testid="ribbon-audit-logs-btn"
            onClick={() => setActiveTab('audit_logs')}
            className={`flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'audit_logs'
                ? 'bg-[#EDF2F7] text-[#1F3349] border-[#EDF2F7] font-bold'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
            }`}
            title="Open System Audit Logs (Entries, Edits & Deletions)"
          >
            <ShieldCheck className={`w-3 h-3 shrink-0 ${activeTab === 'audit_logs' ? 'text-[#1D6CE0]' : 'text-emerald-300'}`} />
            <span className="hidden lg:inline">Audit ({auditLogs.length})</span>
          </button>

          <button
            type="button"
            data-testid="ribbon-landing-page-btn"
            onClick={logout}
            className="flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
            title="Return to ZSB AQUATICS Landing Page"
          >
            <span>Landing</span>
          </button>

          {/* Top-Right Active User Profile Lockup */}
          {currentUser && (
            <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-white/15">
              <div className="text-right leading-tight">
                <div className="text-[11px] font-bold text-white">
                  {currentUser.displayName}
                </div>
                <div className="text-[9px] font-mono font-bold text-sky-200 uppercase tracking-wider">
                  {currentUser.role === 'SUPER_ADMIN' ? 'ADMIN' : currentUser.role}
                </div>
              </div>
              <div className="w-7 h-7 rounded-full border border-white/25 bg-white/15 flex items-center justify-center text-white shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="ribbon-logout-btn"
            onClick={logout}
            className="flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold bg-white/10 hover:bg-rose-500/80 text-white border border-white/15 hover:border-rose-400 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
            title={
              currentUser
                ? `Signed in as ${currentUser.displayName} (${currentUser.role}). Click to lock & sign out.`
                : 'Sign out to login screen'
            }
          >
            <LogOut className="w-3 h-3 text-rose-300 shrink-0" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>
      )}

      {/* Clean Compact Navy Formula Bar + Display & Zoom Toolbar */}
      <div className="bg-[#1F3349] px-2.5 sm:px-5 py-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-200">
        <div className={`${isFullScreen ? 'flex' : 'hidden xl:flex'} flex-wrap items-center gap-2 min-w-0 flex-1 basis-auto`}>
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

          <div className="font-bold select-none text-sky-300 italic hidden xl:inline">
            fx
          </div>
          <div className="h-4 w-px bg-white/15 hidden xl:block" />
          <div className="flex-1 overflow-x-auto whitespace-nowrap text-slate-200 hidden xl:block">
            <span className="text-slate-200 font-medium">{getFormulaForTab()}</span>
          </div>
        </div>

        {/* Smart Mobile Display Adjust / Desktop View / Zoom In / Zoom Out / Full Screen Toolbar */}
        <div
          data-testid="display-viewport-toolbar"
          className="flex items-center flex-wrap gap-1 sm:gap-1.5 shrink-0 w-full sm:w-auto justify-between sm:justify-end"
        >
          {/* Smart Mobile Adjust vs Desktop View Mode Switcher */}
          <div
            role="group"
            aria-label="Display Viewport Mode"
            className="inline-flex items-center rounded-md border border-white/15 bg-[#273E56] p-0.5"
          >
            <button
              type="button"
              data-testid="display-mode-smart-mobile-btn"
              onClick={() => onChangeDisplayMode?.('smart_mobile')}
              aria-pressed={displayMode === 'smart_mobile'}
              title="Smart Mobile Display Adjust: Automatically optimizes layout, table scrolling, and responsive touch controls for mobile & tablet screens"
              className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition cursor-pointer ${
                displayMode === 'smart_mobile'
                  ? 'bg-white text-[#1F3349] shadow-2xs'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3 h-3 shrink-0" />
              <span>Smart Mobile</span>
            </button>

            <button
              type="button"
              data-testid="display-mode-desktop-btn"
              onClick={() => onChangeDisplayMode?.('desktop_full')}
              aria-pressed={displayMode === 'desktop_full'}
              title="Show Desktop View (1440px Full Workbook Sheet): Renders the complete desktop spreadsheet layout scaled to fit any screen"
              className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition cursor-pointer ${
                displayMode === 'desktop_full'
                  ? 'bg-white text-[#1F3349] shadow-2xs'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Monitor className="w-3 h-3 shrink-0" />
              <span>Desktop View</span>
            </button>
          </div>

          {/* Zoom Out / Zoom Percentage / Zoom In Controls */}
          <div
            role="group"
            aria-label="Zoom Controls"
            className="inline-flex items-center rounded-md border border-white/15 bg-[#273E56] p-0.5 space-x-0.5"
          >
            <button
              type="button"
              data-testid="zoom-out-btn"
              onClick={onZoomOut}
              disabled={zoomPercent <= 40}
              aria-label="Zoom Out"
              title="Zoom Out (-10%)"
              className="flex items-center justify-center w-5 sm:w-6 h-5 rounded text-slate-200 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ZoomOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            <select
              data-testid="zoom-preset-select"
              aria-label="Select Zoom Percentage"
              value={zoomPercent}
              onChange={(e) => onSelectZoomPreset?.(Number(e.target.value))}
              title={`Current Display Scale: ${effectivePercentLabel}. Select a preset zoom level (50% - 200%).`}
              className="bg-white text-[#1F3349] border border-[#CBD8E6] rounded px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold focus:outline-none focus:border-[#1D6CE0] cursor-pointer"
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
              className="flex items-center justify-center w-5 sm:w-6 h-5 rounded text-slate-200 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            {zoomPercent !== 100 && (
              <button
                type="button"
                data-testid="zoom-reset-btn"
                onClick={onZoomReset}
                aria-label="Reset Zoom to 100%"
                title="Reset Zoom to 100%"
                className="flex items-center justify-center px-1 sm:px-1.5 h-5 rounded bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold transition cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
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
            className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border text-[10px] sm:text-[11px] font-bold transition cursor-pointer ${
              isFullScreen
                ? 'bg-white text-[#1F3349] border-white'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
            }`}
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>Full Screen</span>
              </>
            )}
          </button>
        </div>

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
          <span className="text-sky-200">1 RMB = {companyProfile.rmbExchangeRate} TK</span>
        </div>
      </div>
    </header>
  );
};
