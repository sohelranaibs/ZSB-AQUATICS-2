import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  buildAllSuppliersDashboardReport,
  buildAllSuppliersReportCsvFilename,
  DashboardSupplierSortBy,
  DashboardSupplierStatusFilter,
  DashboardSupplierSummaryRow,
  formatSupplierStatusLabel,
  generateAllSuppliersReportCSV,
} from '../utils/dashboardSupplierReport.ts';
import { buildSupplierRecordHistory } from '../utils/supplierHistory.ts';
import { exportSupplierReconciliationLedgerPdf } from '../utils/supplierReconciliationPdf.ts';
import { downloadCsvFile } from '../utils/csvExporter.ts';
import {
  Users,
  Download,
  FileText,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  History,
  Wallet,
  PlusCircle,
} from 'lucide-react';

export const DashboardAllSuppliersReport: React.FC = () => {
  const {
    purchases,
    payments,
    supplierCredits,
    dropdownOptions,
    companyProfile,
    setActiveTab,
    showToast,
  } = useApp();

  const currency = companyProfile.currency || 'TK';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DashboardSupplierStatusFilter>('all');
  const [sortBy, setSortBy] = useState<DashboardSupplierSortBy>('due_desc');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const report = useMemo(
    () =>
      buildAllSuppliersDashboardReport({
        purchases,
        payments,
        supplierCredits,
        registeredSuppliers: dropdownOptions.suppliers,
        searchTerm,
        statusFilter,
        sortBy,
      }),
    [
      purchases,
      payments,
      supplierCredits,
      dropdownOptions.suppliers,
      searchTerm,
      statusFilter,
      sortBy,
    ]
  );

  const toggleExpandSupplier = (supplierKey: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(supplierKey)) {
        next.delete(supplierKey);
      } else {
        next.add(supplierKey);
      }
      return next;
    });
  };

  const handleExportAllSuppliersCsv = () => {
    const csv = generateAllSuppliersReportCSV(report, currency);
    const filename = buildAllSuppliersReportCsvFilename();
    downloadCsvFile(filename, csv);
    showToast(`Exported ${report.filteredSuppliers.length} suppliers report to ${filename}`);
  };

  const handleExportAllSuppliersPdf = () => {
    const allHistoryRows = buildSupplierRecordHistory(
      purchases,
      payments,
      supplierCredits || [],
      {
        supplierName: 'ALL',
        sortDirection: 'desc',
      }
    );

    const res = exportSupplierReconciliationLedgerPdf({
      companyProfile,
      supplierFilter: 'ALL',
      fromDate: '',
      toDate: '',
      sortDirection: 'desc',
      rows: allHistoryRows,
      totals: {
        totalDebit: report.totals.totalPurchaseAmount,
        totalCredit: Number(
          (report.totals.totalPaidAmount + report.totals.totalOpenCreditsAmount).toFixed(2)
        ),
        netEndingBalance: report.totals.totalDueAmount,
      },
    });

    if (res.ok) {
      showToast(`Exported Supplier Reconciliation PDF: ${res.filename}`);
    } else {
      showToast('Failed to export Supplier Reconciliation PDF.');
    }
  };

  const handleExportSingleSupplierPdf = (row: DashboardSupplierSummaryRow) => {
    const res = exportSupplierReconciliationLedgerPdf({
      companyProfile,
      supplierFilter: row.supplierName,
      fromDate: '',
      toDate: '',
      sortDirection: 'desc',
      rows: row.historyRows,
      totals: {
        totalDebit: row.totalPurchaseAmount,
        totalCredit: Number((row.totalPaidAmount + row.openCreditBalance).toFixed(2)),
        netEndingBalance: row.totalDueAmount,
      },
    });

    if (res.ok) {
      showToast(`Exported ${row.supplierName} PDF: ${res.filename}`);
    } else {
      showToast(`Failed to export PDF for ${row.supplierName}.`);
    }
  };

  const getStatusBadgeClasses = (status: DashboardSupplierSummaryRow['status']) => {
    switch (status) {
      case 'DUE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'SETTLED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OVERPAID':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'NO_ACTIVITY':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getHistoryTypeBadgeClasses = (recordType: string) => {
    switch (recordType) {
      case 'PURCHASE_BILL':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'PAYMENT_VOUCHER':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CREDIT_NOTE':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getHistoryTypeLabel = (recordType: string) => {
    switch (recordType) {
      case 'PURCHASE_BILL':
        return 'PURCHASE BILL';
      case 'PAYMENT_VOUCHER':
        return 'PAYMENT VOUCHER';
      case 'CREDIT_NOTE':
        return 'CREDIT NOTE';
      default:
        return recordType;
    }
  };

  return (
    <section
      aria-label="All Supplier List — Total Purchase and Total Due Report History"
      data-testid="dashboard-all-suppliers-report"
      className="bg-white rounded-xl shadow-xs border border-[#CBD8E6] overflow-hidden"
    >
      {/* Header Bar */}
      <div className="bg-[#273E56] text-white px-5 py-3.5 border-b border-[#1E3247] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Users className="w-4 h-4 text-sky-300 shrink-0" />
          <h2 className="text-sm font-bold tracking-wide text-white">
            All Supplier List · Total Purchase &amp; Total Due Report History
          </h2>
          <span
            data-testid="dashboard-all-suppliers-badge"
            className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-sky-200 font-mono tabular-nums border border-white/15"
          >
            {report.totals.totalSuppliersCount} Suppliers · {report.totals.suppliersWithDueCount} With Due
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="dashboard-export-all-suppliers-csv"
            onClick={handleExportAllSuppliersCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export Suppliers CSV</span>
          </button>

          <button
            type="button"
            data-testid="dashboard-export-all-suppliers-pdf"
            onClick={handleExportAllSuppliersPdf}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Export Ledger PDF</span>
          </button>
        </div>
      </div>

      {/* Grand Totals KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 px-5 py-4 bg-slate-50/80 border-b border-slate-200">
        <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Suppliers
          </div>
          <div
            data-testid="dashboard-suppliers-kpi-count"
            className="text-xl font-black text-slate-900 font-mono tabular-nums mt-0.5"
          >
            {report.totals.totalSuppliersCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {report.totals.activeSuppliersCount} Active · {report.totals.noActivitySuppliersCount} Idle
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            All Suppliers Purchase
          </div>
          <div
            data-testid="dashboard-suppliers-kpi-purchase"
            className="text-xl font-black text-slate-900 font-mono tabular-nums mt-0.5"
          >
            {formatCurrency(report.totals.totalPurchaseAmount, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {report.totals.totalPurchaseQtyKg.toLocaleString('en-US', {
              maximumFractionDigits: 2,
            })}{' '}
            KG · {report.totals.totalPurchaseBillsCount} Bills
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Paid &amp; Credits
          </div>
          <div
            data-testid="dashboard-suppliers-kpi-paid"
            className="text-xl font-black text-emerald-700 font-mono tabular-nums mt-0.5"
          >
            {formatCurrency(
              report.totals.totalPaidAmount + report.totals.totalOpenCreditsAmount,
              currency
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {report.totals.totalPaymentVouchersCount} Vouchers
            {report.totals.totalOpenCreditsAmount > 0
              ? ` · ${formatCurrency(report.totals.totalOpenCreditsAmount, currency)} Cr`
              : ''}
          </div>
        </div>

        <div
          className={`rounded-lg border px-3.5 py-2.5 ${
            report.totals.totalDueAmount > 0.01
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Combined Total Due
          </div>
          <div
            data-testid="dashboard-suppliers-kpi-due"
            className={`text-xl font-black font-mono tabular-nums mt-0.5 ${
              report.totals.totalDueAmount > 0.01 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {formatCurrency(report.totals.totalDueAmount, currency)}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5 font-mono tabular-nums">
            {report.totals.suppliersWithDueCount} Suppliers Pending ·{' '}
            {report.totals.settledSuppliersCount} Settled
          </div>
        </div>
      </div>

      {/* Filter & Sort Toolbar */}
      <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search supplier name, phone, or invoice ref..."
            aria-label="Search suppliers"
            data-testid="dashboard-suppliers-search"
            className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600 text-slate-800"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear supplier search"
              className="zsb-clear-icon-btn absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter Suppliers by Due Status"
            className="flex flex-wrap items-center gap-1"
          >
            <button
              type="button"
              data-testid="dashboard-suppliers-filter-all"
              aria-pressed={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
            >
              All ({report.totals.totalSuppliersCount})
            </button>
            <button
              type="button"
              data-testid="dashboard-suppliers-filter-due"
              aria-pressed={statusFilter === 'due'}
              onClick={() => setStatusFilter('due')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
            >
              With Due ({report.totals.suppliersWithDueCount})
            </button>
            <button
              type="button"
              data-testid="dashboard-suppliers-filter-settled"
              aria-pressed={statusFilter === 'settled'}
              onClick={() => setStatusFilter('settled')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
            >
              Settled ({report.totals.settledSuppliersCount})
            </button>
            <button
              type="button"
              data-testid="dashboard-suppliers-filter-idle"
              aria-pressed={statusFilter === 'no_activity'}
              onClick={() => setStatusFilter('no_activity')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
            >
              No Activity ({report.totals.noActivitySuppliersCount})
            </button>
          </div>

          <select
            aria-label="Sort All Suppliers Report"
            data-testid="dashboard-suppliers-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as DashboardSupplierSortBy)}
            className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:border-sky-600 cursor-pointer"
          >
            <option value="due_desc">Sort: Highest Due</option>
            <option value="purchase_desc">Sort: Highest Purchase</option>
            <option value="paid_desc">Sort: Highest Paid</option>
            <option value="latest_desc">Sort: Latest Activity</option>
            <option value="name_asc">Sort: Supplier Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* All Suppliers Table + Expandable Report History Rows */}
      <div className="overflow-x-auto">
        <table
          data-testid="dashboard-all-suppliers-table"
          className="w-full text-left border-collapse text-xs"
        >
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px] font-bold tracking-wider">
              <th className="py-2.5 px-3 text-center w-12">SL</th>
              <th className="py-2.5 px-3">Supplier Name</th>
              <th className="py-2.5 px-3 text-center">Records</th>
              <th className="py-2.5 px-3 text-right">Qty (KG)</th>
              <th className="py-2.5 px-3 text-right">Total Purchase</th>
              <th className="py-2.5 px-3 text-right">Total Paid</th>
              <th className="py-2.5 px-3 text-right">Total Due</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3">Latest Activity</th>
              <th className="py-2.5 px-3 text-right">Report History &amp; PDF</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {report.filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 px-4 text-center text-slate-500">
                  No suppliers match the current filter. Try clearing the search box or switching
                  back to &ldquo;All&rdquo;.
                </td>
              </tr>
            ) : (
              report.filteredSuppliers.map((row, idx) => {
                const isExpanded = expandedKeys.has(row.supplierKey);
                return (
                  <React.Fragment key={row.supplierKey}>
                    <tr
                      data-testid={`dashboard-supplier-row-${row.slug}`}
                      className={`transition-colors ${
                        isExpanded
                          ? 'bg-sky-50/60'
                          : 'hover:bg-slate-50/90 bg-white'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 text-xs">
                          {row.supplierName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-2">
                          {row.contactNumber && <span>{row.contactNumber}</span>}
                          {row.openCreditBalance > 0 && (
                            <span className="text-amber-700 font-semibold">
                              Open Cr: {formatCurrency(row.openCreditBalance, currency)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600">
                        <span>{row.purchaseBillCount}B</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span>{row.paymentVoucherCount}V</span>
                        {row.creditNoteCount > 0 && (
                          <>
                            <span className="mx-1 text-slate-300">/</span>
                            <span className="text-amber-700">{row.creditNoteCount}C</span>
                          </>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row.totalQtyKg.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(row.totalPurchaseAmount, currency)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(row.totalPaidAmount, currency)}
                      </td>

                      <td
                        data-testid={`dashboard-supplier-due-${row.slug}`}
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-extrabold whitespace-nowrap ${
                          row.totalDueAmount > 0.01
                            ? 'text-rose-700'
                            : row.totalDueAmount < -0.01
                            ? 'text-sky-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(row.totalDueAmount, currency)}
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${getStatusBadgeClasses(
                            row.status
                          )}`}
                        >
                          {formatSupplierStatusLabel(row.status)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {row.latestDate ? (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {formatDate(row.latestDate)}
                            </div>
                            {row.latestRef && (
                              <div className="text-[10px] text-slate-500">{row.latestRef}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-pressed={isExpanded}
                            data-testid={`supplier-history-toggle-${row.slug}`}
                            onClick={() => toggleExpandSupplier(row.supplierKey)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 shrink-0" />
                            )}
                            <History className="w-3 h-3 shrink-0" />
                            <span>History ({row.historyCount})</span>
                          </button>

                          <button
                            type="button"
                            data-testid={`supplier-pdf-btn-${row.slug}`}
                            onClick={() => handleExportSingleSupplierPdf(row)}
                            title={`Export ${row.supplierName} Reconciliation Ledger PDF`}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-3 h-3 shrink-0" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Report History Drawer */}
                    {isExpanded && (
                      <tr
                        data-testid={`supplier-report-history-panel-${row.slug}`}
                        className="bg-slate-50/90"
                      >
                        <td colSpan={10} className="p-4 border-t border-b border-sky-200">
                          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                            {/* Sub-panel Header */}
                            <div className="px-4 py-2.5 bg-[#1E3247] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <History className="w-4 h-4 text-sky-300 shrink-0" />
                                <span className="text-xs font-bold">
                                  {row.supplierName} — Report History ({row.historyCount} Entries)
                                </span>
                                <span className="text-[11px] font-mono text-slate-300">
                                  Purchase: {formatCurrency(row.totalPurchaseAmount, currency)} ·
                                  Paid: {formatCurrency(row.totalPaidAmount, currency)} · Due:{' '}
                                  {formatCurrency(row.totalDueAmount, currency)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('payment_form')}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Wallet className="w-3 h-3 shrink-0" />
                                  <span>Record Payment</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportSingleSupplierPdf(row)}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3 h-3 shrink-0" />
                                  <span>Export Supplier PDF</span>
                                </button>
                              </div>
                            </div>

                            {row.historyRows.length === 0 ? (
                              <div className="p-5 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                                <span>
                                  No purchase bills, payment vouchers, or credit notes recorded yet
                                  for <strong>{row.supplierName}</strong>.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('purchase_form')}
                                  className="px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Create Purchase Challan</span>
                                </button>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold tracking-wider">
                                      <th className="py-2 px-3">Date</th>
                                      <th className="py-2 px-3">Type</th>
                                      <th className="py-2 px-3">Invoice / Ref</th>
                                      <th className="py-2 px-3">Particulars</th>
                                      <th className="py-2 px-3 text-right">Debit / Purchase</th>
                                      <th className="py-2 px-3 text-right">Credit / Paid</th>
                                      <th className="py-2 px-3 text-right">Row Balance</th>
                                      <th className="py-2 px-3 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {row.historyRows.map((hist) => (
                                      <tr key={hist.id} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                                          {hist.date ? formatDate(hist.date) : '—'}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getHistoryTypeBadgeClasses(
                                              hist.recordType
                                            )}`}
                                          >
                                            {getHistoryTypeLabel(hist.recordType)}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                                          {hist.invoiceNumber}
                                        </td>
                                        <td className="py-2 px-3 text-slate-600">
                                          {hist.description}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                                          {hist.debitAmount !== 0
                                            ? formatCurrency(hist.debitAmount, currency)
                                            : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold whitespace-nowrap">
                                          {hist.creditAmount !== 0
                                            ? formatCurrency(hist.creditAmount, currency)
                                            : '—'}
                                        </td>
                                        <td
                                          className={`py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                            hist.balance > 0.01
                                              ? 'text-rose-700'
                                              : 'text-emerald-700'
                                          }`}
                                        >
                                          {formatCurrency(hist.balance, currency)}
                                        </td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap">
                                          <span
                                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
                                              hist.status === 'PAID'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : hist.status === 'NO REPORT'
                                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                            }`}
                                          >
                                            {hist.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* Grand Total Footer Row */}
          {report.filteredSuppliers.length > 0 && (
            <tfoot>
              <tr
                data-testid="dashboard-all-suppliers-grand-total"
                className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900"
              >
                <td colSpan={2} className="py-3 px-3 uppercase tracking-wide text-[11px]">
                  Grand Total ({report.filteredTotals.totalSuppliersCount} Suppliers)
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums text-[11px]">
                  {report.filteredTotals.totalPurchaseBillsCount}B /{' '}
                  {report.filteredTotals.totalPaymentVouchersCount}V
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {report.filteredTotals.totalPurchaseQtyKg.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                  {formatCurrency(report.filteredTotals.totalPurchaseAmount, currency)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                  {formatCurrency(report.filteredTotals.totalPaidAmount, currency)}
                </td>
                <td
                  className={`py-3 px-3 text-right font-mono tabular-nums font-black whitespace-nowrap ${
                    report.filteredTotals.totalDueAmount > 0.01
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {formatCurrency(report.filteredTotals.totalDueAmount, currency)}
                </td>
                <td colSpan={3} className="py-3 px-3 text-right text-[11px] font-mono text-slate-600">
                  {report.filteredTotals.suppliersWithDueCount} With Due ·{' '}
                  {report.filteredTotals.settledSuppliersCount} Settled
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
};
