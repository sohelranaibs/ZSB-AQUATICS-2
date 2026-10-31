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
} from 'lucide-react';

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
      label: 'Administration',
      shortLabel: 'Administration',
    },
  ];

  const currentSheetIndex = Math.max(
    0,
    workbookSheets.findIndex((s) => s.id === activeTab)
  );
  const currentSheet = workbookSheets[currentSheetIndex] || workbookSheets[0];

  const handleStepSheet = (direction: 'prev' | 'next') => {
    const total = workbookSheets.length;
    const nextIndex =
      direction === 'next'
        ? (currentSheetIndex + 1) % total
        : (currentSheetIndex - 1 + total) % total;
    setActiveTab(workbookSheets[nextIndex].id);
  };

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

        {/* Right: Quick Macro Actions & Sync Status */}
        <div className="flex items-center space-x-2">
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
                : 'bg-emerald-950/80 hover:bg-emerald-900/80 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {syncStatus === 'saving' ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            ) : syncStatus === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            )}
            <span>{syncDisplay.badgeText}</span>
            <span className="hidden xl:inline text-[10px] font-mono font-normal opacity-85 border-l border-current/25 pl-1.5">
              {syncStatus === 'saving' ? lastSyncedEntity : syncDisplay.formattedTime}
            </span>
          </button>

          <button
            type="button"
            data-testid="ribbon-excel-csv-btn"
            onClick={() => openDataCenterModal('import', getDatasetForActiveTab())}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow-sm transition cursor-pointer"
            title="Import & Export Data from Excel (.xlsx) and CSV (.csv) (Shortcut: Ctrl+E)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Excel / CSV</span>
          </button>

          <button
            type="button"
            data-testid="global-export-pdf-btn"
            data-last-exported-pdf={lastExportedPdfFilename || ''}
            disabled={isExportingGlobalPdf}
            onClick={() => {
              void exportCurrentViewToPdf();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white rounded shadow-sm transition cursor-pointer"
            title="Download the current view's table data as a professionally formatted PDF using official print styles"
          >
            {isExportingGlobalPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                <span>Export View PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="ribbon-print-preview-btn"
            onClick={() => {
              void exportCurrentViewToPdf({ openPreviewOnly: true });
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm transition cursor-pointer"
            title="Open Document Print & PDF Download Preview for Current View (Shortcut: Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
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
          {/* Prev / Next Sheet Navigation Buttons */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              data-testid="ribbon-prev-sheet-btn"
              onClick={() => handleStepSheet('prev')}
              title="Go to Previous Sheet (Shortcut: Alt + Left Arrow)"
              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded text-[11px] font-bold transition cursor-pointer"
            >
              ◀ Prev
            </button>
            <button
              type="button"
              data-testid="ribbon-next-sheet-btn"
              onClick={() => handleStepSheet('next')}
              title="Go to Next Sheet (Shortcut: Alt + Right Arrow)"
              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded text-[11px] font-bold transition cursor-pointer"
            >
              Next ▶
            </button>
          </div>

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
                : 'text-emerald-400/90'
            }`}
          >
            <Database className="w-3 h-3 shrink-0" />
            <span>
              {syncStatus === 'saving'
                ? `Auto-saving (${lastSyncedEntity})...`
                : syncStatus === 'error'
                ? 'Sync Error'
                : `Synced (${totalRecordsCount} records)`}
            </span>
          </span>
          <span className="text-slate-600">|</span>
          <span>1 RMB = {companyProfile.rmbExchangeRate} TK</span>
        </div>
      </div>

      {/* Persistent Global Workbook Sheet Tabs Bar (Always visible on every sheet) */}
      <nav
        aria-label="Workbook Sheets Navigation"
        data-testid="global-workbook-sheets-nav"
        className="bg-slate-950/95 px-3 py-1.5 border-b border-slate-800 flex flex-wrap items-center gap-1.5"
      >
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 px-1.5 shrink-0 flex items-center gap-1">
          <Layers className="w-3 h-3 text-amber-400" />
          <span>Sheets:</span>
        </span>
        {workbookSheets.map((sheet) => {
          const isActive = activeTab === sheet.id;
          return (
            <button
              key={sheet.id}
              type="button"
              data-testid={`ribbon-sheet-tab-${sheet.id}`}
              onClick={() => setActiveTab(sheet.id)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                isActive
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm ring-1 ring-amber-300/60'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800 hover:border-slate-600'
              }`}
              title={`Switch to Sheet [${sheet.num}] ${sheet.label}`}
            >
              <span
                className={`px-1 py-0.2 rounded text-[9px] font-mono font-black ${
                  isActive
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-slate-800 text-amber-400 border border-slate-700'
                }`}
              >
                {sheet.num}
              </span>
              <span>{sheet.shortLabel}</span>
              {sheet.badge !== undefined && (
                <span
                  className={`px-1 rounded-full text-[9px] font-mono font-extrabold ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-emerald-400'
                  }`}
                >
                  {sheet.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
