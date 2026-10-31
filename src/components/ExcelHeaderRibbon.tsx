import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ActiveTab } from '../types/index.ts';
import {
  buildExporterPaymentSlipRows,
  calculateExporterSlipTotals,
} from '../utils/calculations.ts';
import {
  computeTotalPersistedRecords,
  getSyncStatusDisplay,
} from '../utils/syncStatus.ts';
import {
  FileSpreadsheet,
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
} from 'lucide-react';
import { GlobalSearchBar } from './GlobalSearchBar.tsx';

interface ExcelHeaderRibbonProps {
  onOpenShortcutsModal?: () => void;
}

export const ExcelHeaderRibbon: React.FC<ExcelHeaderRibbonProps> = ({
  onOpenShortcutsModal,
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

  const totalRecordsCount = computeTotalPersistedRecords({
    purchases: purchases.length,
    packings: packings.length,
    payments: payments.length,
    otherCosts: otherCosts.length,
  });

  const syncDisplay = getSyncStatusDisplay({
    status: syncStatus,
    lastSyncedAt,
    lastSyncedEntity,
    totalRecordsCount,
    isLiveSyncEnabled,
    hasUnsyncedChanges,
  });

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
    if (activeTab === 'profit_loss') {
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
        return '=Debit (Export RMB) - Credit (Claim RMB) = Row_Balance (RMB) | Exporter Status [NO REPORT, REPORT, PAID]';
      case 'exporter_payment_slip':
        return '=Weight * RMB = Amount | FILTER(EXPORTER_DB!A:H, (MARK=Selected_Mark) * (DATE=Selected_Packing_Date))';
      case 'profit_loss':
        return '=Total_Export_Value - Total_Purchases - Total_Other_Costing = NET_PROFIT';
      case 'audit_logs':
        return `=COUNTIF(AUDIT_TRAIL!A:G, "ENTRY | EDIT | DELETE") [TOTAL_LOGGED: ${auditLogs.length}]`;
      case 'administration':
        return '=AUTH.ROLE("SUPER_ADMIN") & VAULT.MANAGE("ACCOUNTS", "TEAM", "AUDIT", "BACKUPS") [SUPER ADMIN SECURE CONSOLE]';
      case 'settings':
        return '=CONFIG.SYSTEM("COMPANY_PROFILE", "DROPDOWNS", "THRESHOLDS") [SETTINGS & CONFIGURATION]';
      default:
        return '=VLOOKUP(Invoice_Number, MASTER_DATABASE, 2, FALSE)';
    }
  };

  const workbookSheets: {
    id: ActiveTab;
    num: string;
    label: string;
    shortLabel: string;
    badge?: string | number;
  }[] = [
    {
      id: 'dashboard',
      num: '01',
      label: 'Executive Overview',
      shortLabel: 'Overview',
    },
    {
      id: 'purchase_form',
      num: '02',
      label: 'Purchase Challan / Bill',
      shortLabel: 'Purchase Form',
    },
    {
      id: 'packing_form',
      num: '03',
      label: 'Export Packing List',
      shortLabel: 'Packing List',
    },
    {
      id: 'air_way_bill',
      num: 'FRB',
      label: 'FLIGHT RETURN BILL',
      shortLabel: 'Flight Return Bill',
    },
    {
      id: 'payment_form',
      num: '04',
      label: 'Supplier Payment Form',
      shortLabel: 'Supplier Payment',
    },
    {
      id: 'exporter_payment_form',
      num: '05',
      label: 'Exporter Payment Form',
      shortLabel: 'Exporter Payment',
    },
    {
      id: 'exporter_payment_slip',
      num: '06',
      label: 'Exporter Payment Slip 付款单',
      shortLabel: 'Payment Slip 付款单',
    },
    {
      id: 'profit_loss',
      num: '07',
      label: 'Loss & Profit Analysis',
      shortLabel: 'Loss & Profit',
    },
    {
      id: 'purchase_db',
      num: '08',
      label: 'Purchase Database',
      shortLabel: 'Purchase DB',
      badge: purchases.length,
    },
    {
      id: 'packing_db',
      num: '09',
      label: 'Packing List Database',
      shortLabel: 'Packing DB',
      badge: packings.length,
    },
    {
      id: 'payment_db',
      num: '10',
      label: 'Payment Vouchers DB',
      shortLabel: 'Payment DB',
      badge: payments.length,
    },
    {
      id: 'search_reports',
      num: '11',
      label: 'Search & Audit Reports',
      shortLabel: 'Search & Reports',
    },
    {
      id: 'settings',
      num: '12',
      label: 'Settings & Config',
      shortLabel: 'Settings',
    },
    {
      id: 'audit_logs',
      num: '13',
      label: 'System Audit Logs',
      shortLabel: 'Audit Logs',
      badge: auditLogs.length,
    },
    {
      id: 'administration',
      num: 'ADM',
      label: 'Administration (Super Admin 🔒)',
      shortLabel: 'Admin 🔒',
    },
  ];


  return (
    <header className="bg-slate-900 border-b border-slate-700 shadow-md select-none print:hidden sticky top-0 z-40">
      {/* Top Company & Excel Title Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Golden Company Branding */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            title="Return to Sheet 01 · Executive Overview"
            className="w-11 h-11 rounded-full bg-white p-0.5 border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-transform"
          >
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="zsb-3d-text text-lg sm:text-xl font-black tracking-wider cursor-pointer text-left"
                title="Go to Executive Overview (Sheet 01)"
              >
                {companyProfile.companyName}
              </button>
              <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest text-slate-400 border-l border-slate-700 pl-2.5">
                Enterprise Trade Ledger
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-[11px] text-slate-300">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-medium">Address:</span>
                <span className="font-semibold text-slate-100">{companyProfile.address}</span>
              </div>
              <span className="text-slate-700 hidden sm:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-medium">Mobile:</span>
                <span className="font-mono font-semibold text-slate-100">
                  {companyProfile.mobiles.join(', ')}
                </span>
              </div>
              <span className="text-slate-700 hidden sm:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-amber-400 font-bold">EMAIL:</span>
                <span className="font-mono font-semibold text-amber-300">
                  {companyProfile.email || 'www.zsbaquatics.com'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Global Cross-Database Search Bar */}
        <div className="flex-1 max-w-xl mx-1 min-w-[260px] order-3 xl:order-2 w-full xl:w-auto">
          <GlobalSearchBar />
        </div>

        {/* Right: Quick Macro Actions & Sync Status */}
        <div className="flex items-center space-x-2 order-2 xl:order-3 flex-wrap gap-y-1.5">
          {/* Live Sync Background Auto-save Toggle */}
          <div
            className="flex items-center space-x-1.5 px-2 py-1 text-xs rounded border border-slate-700 bg-slate-950/80 whitespace-nowrap shrink-0"
            title={
              isLiveSyncEnabled
                ? 'Live Sync is ON: Background database auto-save is active. Click to pause for high-frequency data entry.'
                : 'Live Sync is PAUSED: Background auto-save disabled for faster data entry. Click to resume or use "Sync Now" (Ctrl+S) to save.'
            }
          >
            <div className="flex items-center space-x-1 text-slate-300">
              <Zap
                className={`w-3.5 h-3.5 transition-colors ${
                  isLiveSyncEnabled ? 'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]' : 'text-slate-500'
                }`}
              />
              <span className="text-[11px] font-bold hidden sm:inline">Live Sync</span>
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
              className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                isLiveSyncEnabled ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isLiveSyncEnabled ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </button>

            <span
              className={`text-[10px] font-mono font-bold ${
                isLiveSyncEnabled ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isLiveSyncEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          <button
            type="button"
            data-testid="ribbon-sync-status"
            onClick={() => triggerManualSync('All Ledgers')}
            aria-label={syncDisplay.ariaLabel}
            title={`${syncDisplay.ariaLabel}. Click to verify and sync local database now.`}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold rounded border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              syncStatus === 'saving'
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-xs'
                : syncStatus === 'error'
                ? 'bg-rose-950/90 border-rose-500/60 text-rose-300'
                : syncStatus === 'paused'
                ? hasUnsyncedChanges
                  ? 'bg-amber-950/90 hover:bg-amber-900/90 border-amber-400 text-amber-200 ring-1 ring-amber-400/60'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                : 'bg-emerald-950/80 hover:bg-emerald-900/80 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {syncStatus === 'saving' ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            ) : syncStatus === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : syncStatus === 'paused' ? (
              <Pause className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            )}
            <span>
              {syncStatus === 'paused'
                ? hasUnsyncedChanges
                  ? 'Sync Now (Unsaved)'
                  : 'Sync Paused'
                : syncDisplay.badgeText}
            </span>
            <span className="hidden xl:inline text-[10px] font-mono font-normal opacity-85 border-l border-current/25 pl-1.5">
              {syncStatus === 'saving' ? lastSyncedEntity : syncDisplay.formattedTime}
            </span>
          </button>

          <button
            type="button"
            data-testid="ribbon-snapshots-btn"
            onClick={openSnapshotModal}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
            title="Open Database Snapshot & Local JSON Recovery Manager (Shortcut: Ctrl+Shift+S)"
          >
            <Archive className="w-3.5 h-3.5 text-amber-300" />
            <span>Snapshots ({snapshots.length})</span>
          </button>

          <button
            type="button"
            data-testid="ribbon-shortcuts-btn"
            onClick={onOpenShortcutsModal}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
            title="Open Global Keyboard Shortcuts Reference (Shortcut: Ctrl+/ or ?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden md:inline">Shortcuts</span>
            <kbd className="px-1 py-0.2 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-amber-300">
              Ctrl+/
            </kbd>
          </button>

          <button
            onClick={exportDatabaseJSON}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition cursor-pointer"
            title="Export full database backup as JSON"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Backup DB</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition cursor-pointer"
            title="Restore database from JSON"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Restore</span>
          </button>

          <button
            type="button"
            data-testid="ribbon-audit-logs-btn"
            onClick={() => setActiveTab('audit_logs')}
            className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded border transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'audit_logs'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Open System Audit Logs (Entries, Edits & Deletions)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden lg:inline">Audit Logs ({auditLogs.length})</span>
          </button>

          <button
            type="button"
            data-testid="ribbon-logout-btn"
            onClick={logout}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-rose-950/90 text-slate-200 hover:text-rose-200 border border-slate-700 hover:border-rose-700/70 rounded transition cursor-pointer whitespace-nowrap shrink-0"
            title={
              currentUser
                ? `Signed in as ${currentUser.displayName} (${currentUser.role}). Click to lock & sign out.`
                : 'Sign out to login screen'
            }
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
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

      {/* Excel Formula Bar + Quick Sheet Switcher Controls */}
      <div className="bg-slate-800 px-4 py-1.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300">
        <div className="flex items-center space-x-2 min-w-0 flex-1">

          {/* Direct Sheet Dropdown Jumper */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <label htmlFor="global-sheet-select" className="text-[10px] uppercase tracking-wider text-amber-400 font-bold hidden sm:inline">
              Sheet:
            </label>
            <select
              id="global-sheet-select"
              data-testid="ribbon-sheet-select"
              aria-label="Jump to Workbook Sheet"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as ActiveTab)}
              className="bg-slate-950 text-amber-300 border border-amber-500/50 rounded px-2 py-0.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              {workbookSheets.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  [{s.num}] {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-slate-400 font-bold select-none text-emerald-400 italic hidden md:inline">
            fx
          </div>
          <div className="h-4 w-px bg-slate-700 hidden md:block" />
          <div className="flex-1 overflow-x-auto whitespace-nowrap text-slate-200 hidden lg:block">
            <span className="text-amber-300/90 font-medium">{getFormulaForTab()}</span>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="text-[11px] font-mono text-slate-400 hidden md:flex items-center space-x-2.5 shrink-0"
        >
          <span
            className={`flex items-center space-x-1 ${
              syncStatus === 'saving'
                ? 'text-amber-300 font-semibold'
                : syncStatus === 'error'
                ? 'text-rose-400 font-semibold'
                : syncStatus === 'paused'
                ? 'text-amber-400 font-semibold'
                : 'text-emerald-400/90'
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
          <span className="text-slate-600">|</span>
          <span>1 RMB = {companyProfile.rmbExchangeRate} TK</span>
        </div>
      </div>

      {/* Horizontal Workbook Sheet Tab Strip (All Sheets Displayed in a Dedicated Row) */}
      <nav
        aria-label="Workbook Sheet Tabs"
        data-testid="enterprise-sheet-tab-bar"
        className="bg-[#0b1322] px-3 py-1 border-t border-slate-800 flex items-center space-x-1 overflow-x-auto scrollbar-thin select-none"
      >
        <div className="flex items-center space-x-1.5 pr-2 mr-1 border-r border-slate-800 shrink-0 text-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider">
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Sheets ({workbookSheets.length}):</span>
        </div>

        {workbookSheets.map((s) => {
          const isActive = activeTab === s.id;
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`sheet-tab-${s.id}`}
              onClick={() => setActiveTab(s.id)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold rounded-t-lg transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#1e293b] text-amber-300 border-t-2 border-t-amber-400 border-x border-slate-700/80 shadow-md font-black'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800/80 font-semibold'
              }`}
              title={`Switch to Sheet [${s.num}] ${s.label}`}
            >
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-950 text-amber-400/90 border border-amber-500/30'
                }`}
              >
                {s.num}
              </span>
              <span className="whitespace-nowrap">{s.shortLabel || s.label}</span>
              {s.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                    isActive
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {s.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
