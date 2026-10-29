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
} from 'lucide-react';

export const ExcelHeaderRibbon: React.FC = () => {
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

  const tabs: { id: ActiveTab; label: string; number: string; icon: string }[] = [
    { id: 'dashboard', number: '1', label: 'Dashboard', icon: '📊' },
    { id: 'purchase_form', number: '2', label: 'Purchase Challan / Bill', icon: '🛒' },
    { id: 'packing_form', number: '3', label: 'Packing List Form', icon: '📦' },
    { id: 'payment_form', number: '4', label: 'Supplier Payment Form', icon: '💳' },
    { id: 'exporter_payment_form', number: '5', label: 'Exporter Payment Form', icon: '💱' },
    { id: 'exporter_payment_slip', number: '6', label: 'Exporter Payment Slip', icon: '🧾' },
    { id: 'profit_loss', number: '7', label: 'Loss & Profit Analysis', icon: '📈' },
    { id: 'purchase_db', number: '8', label: 'Purchase DB', icon: '🗄️' },
    { id: 'packing_db', number: '9', label: 'Packing DB', icon: '📋' },
    { id: 'payment_db', number: '10', label: 'Payment DB', icon: '📑' },
    { id: 'search_reports', number: '11', label: 'Search & Reports', icon: '🔍' },
    { id: 'settings', number: '12', label: 'Settings & Config', icon: '⚙️' },
  ];

  const getDatasetForActiveTab = () => {
    if (activeTab === 'packing_form' || activeTab === 'packing_db' || activeTab === 'exporter_payment_slip') {
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
      case 'payment_form':
        return '=Supplier_Debit_Paid - Supplier_Credit_Rebate | Previous_Balance - Paid_Amount';
      case 'exporter_payment_form':
        return '=Debit (Export RMB) - Credit (Claim RMB) = Row_Balance (RMB) | Exporter Status [NO REPORT, REPORT, PAID]';
      case 'exporter_payment_slip':
        return '=Weight * RMB = Amount | FILTER(EXPORTER_DB!A:H, (MARK=Selected_Mark) * (DATE=Selected_Packing_Date))';
      case 'profit_loss':
        return '=Total_Export_Value - Total_Purchases - Total_Other_Costing = NET_PROFIT';
      default:
        return '=VLOOKUP(Invoice_Number, MASTER_DATABASE, 2, FALSE)';
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-700 shadow-md select-none print:hidden">
      {/* Top Company & Excel Title Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Golden Company Branding */}
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-full bg-white p-0.5 border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140834_5_203_3ce3afae.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="zsb-3d-text text-lg sm:text-xl font-black tracking-wider">
                {companyProfile.companyName}
              </span>
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
            title="Import & Export Data from Excel (.xlsx) and CSV (.csv)"
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
            title="Open Document Print & PDF Download Preview for Current View"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            data-testid="ribbon-snapshots-btn"
            onClick={openSnapshotModal}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
            title="Open Database Snapshot & Local JSON Recovery Manager"
          >
            <Archive className="w-3.5 h-3.5 text-amber-300" />
            <span>Snapshots ({snapshots.length})</span>
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

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

      {/* Excel Formula Bar */}
      <div className="bg-slate-800 px-4 py-1.5 border-b border-slate-700 flex items-center space-x-3 text-xs font-mono text-slate-300">
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded font-semibold text-amber-400 min-w-16 justify-center">
          <span>
            {activeTab === 'dashboard'
              ? 'A1:D10'
              : activeTab === 'purchase_form'
              ? 'CHALLAN_R1'
              : activeTab === 'packing_form'
              ? 'PACK_R1'
              : activeTab === 'payment_form'
              ? 'SUP_PAY_R1'
              : activeTab === 'exporter_payment_form'
              ? 'EXP_PAY_R1'
              : activeTab === 'exporter_payment_slip'
              ? 'SLIP_A1:H10'
              : 'SUMMARY'}
          </span>
        </div>
        <div className="text-slate-400 font-bold select-none text-emerald-400 italic">
          fx
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <div className="flex-1 overflow-x-auto whitespace-nowrap text-slate-200">
          <span className="text-amber-300/90 font-medium">{getFormulaForTab()}</span>
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

      {/* Workbook Sheet Tabs */}
      <div className="bg-slate-900 px-3 pt-1.5 border-b border-slate-800 flex items-center space-x-1 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium transition-all whitespace-nowrap border-t-2 cursor-pointer ${
                isActive
                  ? 'bg-slate-50 text-slate-900 border-amber-500 shadow-sm font-bold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-transparent'
              }`}
            >
              <span
                className={`w-4 h-4 rounded text-[10px] font-mono flex items-center justify-center font-bold ${
                  isActive ? 'bg-slate-900 text-amber-400' : 'bg-slate-700/80 text-slate-300'
                }`}
              >
                {tab.number}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
