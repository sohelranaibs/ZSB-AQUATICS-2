import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  AuditLogAction,
  AuditLogModule,
} from '../types/index.ts';
import {
  filterAuditLogs,
  calculateAuditLogStats,
  formatAuditLogsCSV,
} from '../utils/auditLogger.ts';
import {
  ShieldCheck,
  Search,
  Download,
  Trash2,
  PlusCircle,
  Edit3,
  FilePlus2,
  UserCheck,
  Clock,
  Filter,
  RotateCcw,
} from 'lucide-react';

const MODULE_OPTIONS: ('ALL' | AuditLogModule)[] = [
  'ALL',
  'Purchase',
  'Packing',
  'Payment',
  'Mortality',
  'OtherCost',
  'SupplierCredit',
  'Database',
  'Settings',
  'Authentication',
];

export const AuditLogsView: React.FC = () => {
  const {
    auditLogs,
    addAuditLog,
    clearAuditLogs,
    currentUser,
    companyProfile,
    showToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<
    'ALL' | 'ENTRY' | 'EDIT' | 'DELETE' | 'AUTH'
  >('ALL');
  const [moduleFilter, setModuleFilter] = useState<'ALL' | AuditLogModule>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Manual Admin Audit Entry Form state
  const [manualAction, setManualAction] = useState<AuditLogAction>('CREATE');
  const [manualModule, setManualModule] = useState<AuditLogModule>('Purchase');
  const [manualEntityId, setManualEntityId] = useState<string>('');
  const [manualSummary, setManualSummary] = useState<string>('');
  const [manualDetails, setManualDetails] = useState<string>('');

  const stats = useMemo(() => calculateAuditLogStats(auditLogs), [auditLogs]);

  const filteredLogs = useMemo(
    () =>
      filterAuditLogs(auditLogs, {
        searchQuery,
        actionFilter,
        moduleFilter,
        dateFilter,
      }),
    [auditLogs, searchQuery, actionFilter, moduleFilter, dateFilter]
  );

  const handleExportCSV = () => {
    const csvContent = formatAuditLogsCSV(filteredLogs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeDate = new Date().toISOString().slice(0, 10);
    a.download = `ZSB_AQUATICS_AUDIT_LOGS_${safeDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredLogs.length} audit log records to CSV.`);
  };

  const handleAddManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSummary.trim()) {
      showToast('Please enter an activity summary for the audit log.');
      return;
    }
    addAuditLog({
      action: manualAction,
      module: manualModule,
      entityId: manualEntityId.trim() || undefined,
      summary: manualSummary.trim(),
      details: manualDetails.trim() || undefined,
    });
    setManualEntityId('');
    setManualSummary('');
    setManualDetails('');
    showToast('Administrator audit log entry recorded.');
  };

  const formatTimestampDisplay = (iso: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getActionBadgeStyle = (action: AuditLogAction) => {
    switch (action) {
      case 'CREATE':
      case 'IMPORT':
        return {
          label: action === 'IMPORT' ? 'IMPORT' : 'ENTRY',
          className: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
        };
      case 'UPDATE':
        return {
          label: 'EDIT',
          className: 'bg-amber-50 text-amber-900 border border-amber-300',
        };
      case 'DELETE':
      case 'CLEAR':
        return {
          label: action === 'CLEAR' ? 'CLEAR DB' : 'DELETE',
          className: 'bg-rose-50 text-rose-800 border border-rose-300',
        };
      case 'AUTH':
      default:
        return {
          label: 'AUTH',
          className: 'bg-sky-50 text-sky-800 border border-sky-300',
        };
    }
  };

  return (
    <div
      data-testid="audit-logs-view"
      className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6"
    >
      {/* Top Executive Header */}
      <section
        aria-label="System Audit Logs Header"
        className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-white p-0.5 border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                System Audit Logs &amp; Activity Monitor
              </h1>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-xs font-mono text-amber-300 font-semibold tabular-nums">
                Sheet 13 · Administrator Trail
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Tracks user actions (entries, edits, deletions, and database operations) across all trade ledgers in real time.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Admin: <strong>{currentUser?.displayName || 'Md. Sohel Rana'}</strong>
            </span>
          </div>

          <button
            type="button"
            data-testid="audit-export-csv-btn"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit CSV</span>
          </button>

          <button
            type="button"
            data-testid="audit-clear-logs-btn"
            onClick={clearAuditLogs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/40 text-xs font-bold transition cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Clear Audit Trail</span>
          </button>
        </div>
      </section>

      {/* 4-Column KPI Summary Strip */}
      <section
        aria-label="Audit Activity Summary Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Logged Actions</span>
            <Clock className="w-4 h-4 text-slate-600 shrink-0" />
          </div>
          <div
            data-testid="audit-kpi-total"
            className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-2"
          >
            {stats.totalCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            {stats.uniqueModulesCount} Active Modules Monitored
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
            <span>Entries &amp; Creations</span>
            <FilePlus2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div
            data-testid="audit-kpi-entries"
            className="text-2xl font-black font-mono tabular-nums text-emerald-700 mt-2"
          >
            {stats.entriesCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            New Vouchers, Manifests &amp; Imports
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
            <span>Edits &amp; Modifications</span>
            <Edit3 className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div
            data-testid="audit-kpi-edits"
            className="text-2xl font-black font-mono tabular-nums text-amber-700 mt-2"
          >
            {stats.editsCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Updated Balances, Statuses &amp; Config
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
            <span>Deletions &amp; Clears</span>
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div
            data-testid="audit-kpi-deletions"
            className="text-2xl font-black font-mono tabular-nums text-rose-700 mt-2"
          >
            {stats.deletionsCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Removed Records &amp; Database Resets
          </div>
        </div>
      </section>

      {/* Main Content Split: Manual Audit Entry Form (4 Cols) + Filterable Audit Table (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Columns: Record Manual Admin Audit Entry */}
        <section
          aria-label="Record Administrator Audit Entry"
          className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
        >
          <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wide">
              Log Manual Audit Event
            </h2>
          </div>

          <form
            onSubmit={handleAddManualLog}
            data-testid="audit-manual-entry-form"
            className="p-4 space-y-3.5 text-xs"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="audit-manual-action"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  Action Type
                </label>
                <select
                  id="audit-manual-action"
                  data-testid="audit-manual-action"
                  value={manualAction}
                  onChange={(e) => setManualAction(e.target.value as AuditLogAction)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-slate-50 font-bold text-slate-900"
                >
                  <option value="CREATE">ENTRY (CREATE)</option>
                  <option value="UPDATE">EDIT (UPDATE)</option>
                  <option value="DELETE">DELETE</option>
                  <option value="CLEAR">CLEAR DB</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="audit-manual-module"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  Target Module
                </label>
                <select
                  id="audit-manual-module"
                  data-testid="audit-manual-module"
                  value={manualModule}
                  onChange={(e) => setManualModule(e.target.value as AuditLogModule)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-slate-50 font-bold text-slate-900"
                >
                  <option value="Purchase">Purchase</option>
                  <option value="Packing">Packing</option>
                  <option value="Payment">Payment</option>
                  <option value="Mortality">Mortality</option>
                  <option value="OtherCost">OtherCost</option>
                  <option value="SupplierCredit">SupplierCredit</option>
                  <option value="Database">Database</option>
                  <option value="Settings">Settings</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="audit-manual-entity-id"
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Voucher / Document Ref (Optional)
              </label>
              <input
                id="audit-manual-entity-id"
                data-testid="audit-manual-entity-id"
                type="text"
                value={manualEntityId}
                onChange={(e) => setManualEntityId(e.target.value)}
                placeholder="e.g. INV-2026-0001 or PKG-2026-0001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="audit-manual-summary"
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Activity Summary *
              </label>
              <input
                id="audit-manual-summary"
                data-testid="audit-manual-summary"
                type="text"
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
                placeholder="e.g. Verified supplier balance adjustment"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                required
              />
            </div>

            <div>
              <label
                htmlFor="audit-manual-details"
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Additional Details (Optional)
              </label>
              <input
                id="audit-manual-details"
                data-testid="audit-manual-details"
                type="text"
                value={manualDetails}
                onChange={(e) => setManualDetails(e.target.value)}
                placeholder="e.g. Approved by Managing Partner"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <button
              type="submit"
              data-testid="audit-manual-submit-btn"
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Audit Log Event</span>
            </button>
          </form>
        </section>

        {/* Right 8 Columns: Filter Controls & Audit Trail Table */}
        <section
          aria-label="System Activity Audit Log Table"
          className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
        >
          {/* Filter Toolbar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Action Category Segmented Control */}
              <div
                role="group"
                aria-label="Filter audit logs by action type"
                className="flex flex-wrap items-center gap-1 bg-slate-200/80 p-1 rounded-lg"
              >
                {(
                  [
                    { id: 'ALL', label: `All (${stats.totalCount})` },
                    { id: 'ENTRY', label: `Entries (${stats.entriesCount})` },
                    { id: 'EDIT', label: `Edits (${stats.editsCount})` },
                    { id: 'DELETE', label: `Deletions (${stats.deletionsCount})` },
                    { id: 'AUTH', label: `Auth (${stats.authCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`audit-filter-action-${tab.id.toLowerCase()}`}
                    onClick={() => setActionFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      actionFilter === tab.id
                        ? 'bg-slate-900 text-amber-400 font-bold shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {(searchQuery || actionFilter !== 'ALL' || moduleFilter !== 'ALL' || dateFilter) && (
                <button
                  type="button"
                  data-testid="audit-reset-filters-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setActionFilter('ALL');
                    setModuleFilter('ALL');
                    setDateFilter('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Search, Module & Date Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-6 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  data-testid="audit-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by invoice, supplier, summary, or admin..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div className="sm:col-span-3 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  aria-label="Filter by Module"
                  data-testid="audit-module-filter"
                  value={moduleFilter}
                  onChange={(e) =>
                    setModuleFilter(e.target.value as 'ALL' | AuditLogModule)
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-800"
                >
                  {MODULE_OPTIONS.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod === 'ALL' ? 'All Modules' : mod}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <input
                  type="date"
                  aria-label="Filter by Date"
                  data-testid="audit-date-filter"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-x-auto">
            <table
              data-testid="audit-logs-table"
              className="w-full text-left text-xs border-collapse"
            >
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[11px] border-b border-slate-800">
                  <th className="py-2.5 px-3.5">TIMESTAMP</th>
                  <th className="py-2.5 px-3 text-center">ACTION</th>
                  <th className="py-2.5 px-3">MODULE</th>
                  <th className="py-2.5 px-3">REF NO.</th>
                  <th className="py-2.5 px-3.5">ACTIVITY SUMMARY &amp; DETAILS</th>
                  <th className="py-2.5 px-3.5">ACTOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      data-testid="audit-logs-empty-state"
                      className="py-10 px-4 text-center text-slate-500 space-y-1"
                    >
                      <div className="font-bold text-slate-700">
                        No audit log events match the current filter.
                      </div>
                      <div className="text-[11px]">
                        New entries, edits, and deletions across Purchase, Packing, Payment, and Mortality modules will appear here automatically.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const badge = getActionBadgeStyle(log.action);
                    return (
                      <tr
                        key={log.id}
                        data-testid={`audit-log-row-${log.id}`}
                        className="hover:bg-slate-50/90 transition"
                      >
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                          {formatTimestampDisplay(log.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {log.module}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-sky-900 whitespace-nowrap">
                          {log.entityId || '-'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-slate-900">
                            {log.summary}
                          </div>
                          {log.details && (
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              {log.details}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                          {log.actor}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
