import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  calculateAllMonthlyReports,
  formatCurrency,
  formatDate,
  formatRMB,
} from '../utils/calculations.ts';
import {
  downloadCsvFile,
  generateMonthlyExportsAndPurchasesSummaryCSV,
  generateDetailedMonthlyExportsPurchasesCSV,
} from '../utils/csvExporter.ts';
import {
  Download,
  FileSpreadsheet,
  Calendar,
  ShoppingCart,
  Package,
  TrendingUp,
  Scale,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  CheckCircle2,
  DollarSign,
  ArrowUpDown,
  FileText,
  Boxes,
} from 'lucide-react';

interface MonthlyReportsExportViewProps {
  onBackToOverview?: () => void;
}

export const MonthlyReportsExportView: React.FC<MonthlyReportsExportViewProps> = ({
  onBackToOverview,
}) => {
  const {
    companyProfile,
    purchases,
    packings,
    otherCosts,
    showToast,
    openPrintModal,
  } = useApp();

  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  // Calculate all monthly data across purchases, exports, and other costs
  const reportData = useMemo(() => {
    return calculateAllMonthlyReports(
      purchases,
      packings,
      otherCosts,
      companyProfile.rmbExchangeRate
    );
  }, [purchases, packings, otherCosts, companyProfile.rmbExchangeRate]);

  // Filter items by selected year and search query
  const filteredItems = useMemo(() => {
    let list = reportData.items;

    if (selectedYear !== 'ALL') {
      list = list.filter((it) => it.year === selectedYear);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.yearMonth.toLowerCase().includes(q) ||
          it.monthLabel.toLowerCase().includes(q) ||
          it.shortMonthLabel.toLowerCase().includes(q)
      );
    }

    if (sortOrder === 'asc') {
      return [...list].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }
    return [...list].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  }, [reportData.items, selectedYear, searchTerm, sortOrder]);

  // Recalculate totals for the filtered subset
  const filteredTotals = useMemo(() => {
    const init = {
      totalPurchaseVolume: 0,
      totalPurchaseValue: 0,
      totalPurchaseCount: 0,
      totalExportWeight: 0,
      totalExportBoxes: 0,
      totalExportValueRMB: 0,
      totalExportValueBDT: 0,
      totalExportCount: 0,
      totalOtherCosts: 0,
      totalNetProfit: 0,
      overallMarginPercent: 0,
    };

    const res = filteredItems.reduce(
      (acc, it) => ({
        totalPurchaseVolume: Math.round((acc.totalPurchaseVolume + it.purchaseVolume) * 100) / 100,
        totalPurchaseValue: Math.round((acc.totalPurchaseValue + it.purchaseValue) * 100) / 100,
        totalPurchaseCount: acc.totalPurchaseCount + it.purchaseCount,
        totalExportWeight: Math.round((acc.totalExportWeight + it.exportWeight) * 100) / 100,
        totalExportBoxes: acc.totalExportBoxes + it.exportBoxes,
        totalExportValueRMB: Math.round((acc.totalExportValueRMB + it.exportValueRMB) * 100) / 100,
        totalExportValueBDT: Math.round((acc.totalExportValueBDT + it.exportValueBDT) * 100) / 100,
        totalExportCount: acc.totalExportCount + it.exportCount,
        totalOtherCosts: Math.round((acc.totalOtherCosts + it.otherCosts) * 100) / 100,
        totalNetProfit: Math.round((acc.totalNetProfit + it.netProfit) * 100) / 100,
        overallMarginPercent: 0,
      }),
      init
    );

    res.overallMarginPercent =
      res.totalExportValueBDT > 0
        ? Math.round((res.totalNetProfit / res.totalExportValueBDT) * 1000) / 10
        : 0;

    return res;
  }, [filteredItems]);

  const toggleMonthExpand = (yearMonth: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [yearMonth]: !prev[yearMonth],
    }));
  };

  // CSV Export Handlers
  const handleExportSummaryCSV = () => {
    const yearSuffix = selectedYear === 'ALL' ? 'All_Years' : selectedYear;
    const filename = `${companyProfile.companyName.replace(/\s+/g, '_')}_Monthly_Summary_Report_${yearSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    const csvContent = generateMonthlyExportsAndPurchasesSummaryCSV(
      filteredItems,
      filteredTotals,
      companyProfile.companyName
    );
    downloadCsvFile(csvContent, filename);
    showToast(`Exported monthly summary report to CSV (${filteredItems.length} months)`);
  };

  const handleExportDetailedCSV = (targetMonth: string = 'ALL') => {
    const monthSuffix = targetMonth === 'ALL' ? (selectedYear === 'ALL' ? 'All_Months' : `Year_${selectedYear}`) : targetMonth;
    const filename = `${companyProfile.companyName.replace(/\s+/g, '_')}_Detailed_Exports_Purchases_${monthSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    const csvContent = generateDetailedMonthlyExportsPurchasesCSV({
      targetMonth,
      purchases,
      packings,
      rmbExchangeRate: companyProfile.rmbExchangeRate,
      companyName: companyProfile.companyName,
    });
    downloadCsvFile(csvContent, filename);
    showToast(`Downloaded detailed transactions CSV for ${targetMonth === 'ALL' ? 'all months' : targetMonth}`);
  };

  const handleExportSingleMonthSummaryCSV = (item: typeof filteredItems[0]) => {
    const filename = `${companyProfile.companyName.replace(/\s+/g, '_')}_Monthly_Summary_${item.yearMonth}.csv`;
    const singleTotals = {
      totalPurchaseVolume: item.purchaseVolume,
      totalPurchaseValue: item.purchaseValue,
      totalPurchaseCount: item.purchaseCount,
      totalExportWeight: item.exportWeight,
      totalExportBoxes: item.exportBoxes,
      totalExportValueRMB: item.exportValueRMB,
      totalExportValueBDT: item.exportValueBDT,
      totalExportCount: item.exportCount,
      totalOtherCosts: item.otherCosts,
      totalNetProfit: item.netProfit,
      overallMarginPercent: item.marginPercent,
    };
    const csvContent = generateMonthlyExportsAndPurchasesSummaryCSV(
      [item],
      singleTotals,
      companyProfile.companyName
    );
    downloadCsvFile(csvContent, filename);
    showToast(`Downloaded monthly summary CSV for ${item.monthLabel}`);
  };

  return (
    <div className="space-y-6" data-testid="monthly-reports-export-view">
      {/* View Header & Action Controls Bar */}
      <section
        aria-label="Monthly Summary Reports Header"
        className="bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-800 text-white shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white p-0.5 border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140834_5_203_3ce3afae.jpg'}
                alt={companyProfile.companyName}
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400 font-semibold tracking-wide">
                <span>Dashboard Sub-View · CSV Export Engine</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300 font-normal">
                  All Exports &amp; Purchases Reconciliation
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="zsb-3d-text-lg text-2xl sm:text-3xl font-black">
                  {companyProfile.companyName}
                </h1>
                <span className="text-slate-500 hidden sm:inline" aria-hidden="true">/</span>
                <span className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                  Monthly Summary Reports
                </span>
                <span className="text-slate-500 hidden sm:inline" aria-hidden="true">·</span>
                <span className="text-sm sm:text-base font-semibold text-amber-400">
                  Exports &amp; Purchases CSV
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                Auto-consolidated across {purchases.length} Purchase Bills &amp; {packings.length} Export Manifests
              </p>
            </div>
          </div>

          {/* Top CSV Export & Back Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                ← Back to Overview
              </button>
            )}

            <button
              type="button"
              data-testid="export-all-monthly-summary-csv"
              onClick={handleExportSummaryCSV}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
              title="Download consolidated monthly summary of all exports and purchases in CSV format"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Export Monthly Summary CSV</span>
            </button>

            <button
              type="button"
              data-testid="export-all-detailed-transactions-csv"
              onClick={() => handleExportDetailedCSV('ALL')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
              title="Download combined detailed transactions of all purchases and exports in CSV format"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Export Detailed Ledger CSV</span>
            </button>
          </div>
        </div>

        {/* Executive Aggregate Metric Cards for Filtered Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-800/90">
          {/* Card 1: Total Purchases Volume & Value */}
          <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Procurement (Purchases)</span>
              <ShoppingCart className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums mt-1 whitespace-nowrap">
              {formatCurrency(filteredTotals.totalPurchaseValue, companyProfile.currency)}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
              {filteredTotals.totalPurchaseVolume.toLocaleString()} KG · {filteredTotals.totalPurchaseCount} Bills
            </div>
          </div>

          {/* Card 2: Total Exports Volume & Value */}
          <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Air-Freight Exports</span>
              <Package className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-teal-300 font-mono tabular-nums mt-1 whitespace-nowrap">
              {formatCurrency(filteredTotals.totalExportValueBDT, 'BDT')}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
              {formatRMB(filteredTotals.totalExportValueRMB)} · {filteredTotals.totalExportWeight.toLocaleString()} KG ({filteredTotals.totalExportBoxes} Boxes)
            </div>
          </div>

          {/* Card 3: Net Trade Profit */}
          <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Net Trade Profit</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold font-mono tabular-nums mt-1 whitespace-nowrap ${
                filteredTotals.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(filteredTotals.totalNetProfit, companyProfile.currency)}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
              Margin: {filteredTotals.overallMarginPercent}% · Costs: {formatCurrency(filteredTotals.totalOtherCosts, companyProfile.currency)}
            </div>
          </div>

          {/* Card 4: Consignments & Period Rollup */}
          <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Active Reporting Scope</span>
              <Scale className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums mt-1 whitespace-nowrap">
              {filteredItems.length} <span className="text-sm font-normal text-slate-400">Month(s)</span>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
              {filteredTotals.totalExportCount} Manifests · {filteredTotals.totalPurchaseCount} Bills
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Table Card */}
      <section
        aria-label="Monthly Breakdown Table and CSV Export Controls"
        className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden"
      >
        {/* Table Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by month name or year..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-56"
              />
            </div>

            {/* Year Filter Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <label htmlFor="monthly-reports-year-select" className="font-bold text-slate-700">
                Year:
              </label>
              <select
                id="monthly-reports-year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">All Years ({reportData.availableYears.join(', ') || 'Current'})</option>
                {reportData.availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Year {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              title="Toggle sort order between latest and oldest months"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200/70 px-2.5 py-1 rounded">
              Showing {filteredItems.length} Month(s)
            </span>
          </div>
        </div>

        {/* Main Monthly Reconciliation Spreadsheet Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[11px] font-bold border-b border-slate-800">
                <th className="py-3 px-4 w-44">Month / Period</th>
                <th className="py-3 px-3 text-right">
                  Purchases (KG)
                </th>
                <th className="py-3 px-3 text-right">
                  Purchases ({companyProfile.currency})
                </th>
                <th className="py-3 px-2 text-center">Bills</th>
                <th className="py-3 px-3 text-right">
                  Export Wt (KG)
                </th>
                <th className="py-3 px-2 text-center">Boxes</th>
                <th className="py-3 px-3 text-right">
                  Export Value (RMB)
                </th>
                <th className="py-3 px-3 text-right">
                  Export Value (BDT)
                </th>
                <th className="py-3 px-2 text-center">Manifests</th>
                <th className="py-3 px-3 text-right">Costs (TK)</th>
                <th className="py-3 px-3 text-right">Net Profit</th>
                <th className="py-3 px-4 text-center">Actions &amp; CSV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 font-medium bg-slate-50/50">
                    No monthly transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = Boolean(expandedMonths[item.yearMonth]);
                  const monthPurchases = purchases.filter((p) => (p.date || '').slice(0, 7) === item.yearMonth);
                  const monthPackings = packings.filter((pk) => (pk.packingDate || '').slice(0, 7) === item.yearMonth);

                  return (
                    <React.Fragment key={item.yearMonth}>
                      <tr className="hover:bg-amber-50/40 transition">
                        {/* Month / Period */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleMonthExpand(item.yearMonth)}
                            className="flex items-center space-x-1.5 text-left font-bold text-slate-900 hover:text-amber-700 transition cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="font-mono text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 text-[11px]">
                              {item.yearMonth}
                            </span>
                            <span>{item.monthLabel}</span>
                          </button>
                        </td>

                        {/* Purchases KG */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 font-bold whitespace-nowrap">
                          {item.purchaseVolume.toLocaleString()}
                        </td>

                        {/* Purchases TK */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 font-semibold whitespace-nowrap">
                          {formatCurrency(item.purchaseValue, '')}
                        </td>

                        {/* Purchase Bills Count */}
                        <td className="py-3 px-2 text-center font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-700">
                            {item.purchaseCount}
                          </span>
                        </td>

                        {/* Export Weight KG */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-800 font-bold whitespace-nowrap">
                          {item.exportWeight.toLocaleString()}
                        </td>

                        {/* Export Boxes */}
                        <td className="py-3 px-2 text-center font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {item.exportBoxes > 0 ? (
                            <span className="bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
                              {item.exportBoxes}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>

                        {/* Export Value RMB */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-800 font-bold whitespace-nowrap">
                          {item.exportValueRMB > 0 ? formatRMB(item.exportValueRMB) : '¥0.00'}
                        </td>

                        {/* Export Value BDT */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-800 font-black whitespace-nowrap">
                          {formatCurrency(item.exportValueBDT, '')}
                        </td>

                        {/* Export Manifests Count */}
                        <td className="py-3 px-2 text-center font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          <span className="bg-teal-50 px-1.5 py-0.5 rounded text-[11px] font-bold text-teal-800">
                            {item.exportCount}
                          </span>
                        </td>

                        {/* Other Costs */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-rose-700 font-semibold whitespace-nowrap">
                          {formatCurrency(item.otherCosts, '')}
                        </td>

                        {/* Net Trade Profit */}
                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono tabular-nums font-black">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.netProfit >= 0
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {formatCurrency(item.netProfit, '')}
                          </span>
                        </td>

                        {/* Row Action Buttons */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            {/* Download Single Month Summary CSV */}
                            <button
                              type="button"
                              onClick={() => handleExportSingleMonthSummaryCSV(item)}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold transition cursor-pointer inline-flex items-center space-x-1"
                              title={`Export summary CSV for ${item.monthLabel}`}
                            >
                              <Download className="w-3 h-3" />
                              <span>Summary</span>
                            </button>

                            {/* Download Single Month Detailed Transactions CSV */}
                            <button
                              type="button"
                              onClick={() => handleExportDetailedCSV(item.yearMonth)}
                              className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-[11px] font-bold transition cursor-pointer inline-flex items-center space-x-1"
                              title={`Export detailed transactions CSV for ${item.monthLabel}`}
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              <span>Details</span>
                            </button>

                            {/* Toggle Inline Drill-down */}
                            <button
                              type="button"
                              onClick={() => toggleMonthExpand(item.yearMonth)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold transition cursor-pointer"
                              title="Toggle month transaction drill-down"
                            >
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Drill-down of Month Transactions */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b-2 border-slate-300">
                          <td colSpan={12} className="p-4">
                            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-inner">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                <div className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                                  <Calendar className="w-4 h-4 text-amber-600" />
                                  <span>
                                    Transaction Breakdown for {item.monthLabel} ({item.yearMonth})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleExportDetailedCSV(item.yearMonth)}
                                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold inline-flex items-center space-x-1 transition cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Download Month CSV</span>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left: Purchase Bills in this month */}
                                <div>
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
                                    <span className="flex items-center space-x-1">
                                      <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Purchase Bills ({monthPurchases.length})</span>
                                    </span>
                                    <span className="font-mono font-bold text-slate-900">
                                      {formatCurrency(item.purchaseValue, companyProfile.currency)}
                                    </span>
                                  </div>

                                  {monthPurchases.length === 0 ? (
                                    <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded border border-dashed text-center">
                                      No purchase bills recorded for this month.
                                    </div>
                                  ) : (
                                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                                      {monthPurchases.map((p) => (
                                        <div
                                          key={p.id}
                                          className="p-2 flex items-center justify-between hover:bg-slate-50"
                                        >
                                          <div>
                                            <div className="font-bold text-slate-900 font-mono">
                                              {p.invoiceNumber} · {p.description}
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                              {formatDate(p.date)} · {p.totalQty} KG ({p.items?.length || 0} grades)
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-mono font-bold text-slate-900">
                                              {formatCurrency(p.totalAmount, companyProfile.currency)}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openPrintModal({
                                                  type: 'purchase',
                                                  title: `Purchase Challan - ${p.invoiceNumber}`,
                                                  data: p,
                                                  items: p.items,
                                                })
                                              }
                                              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                                            >
                                              Print Challan
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Right: Export Packing Manifests in this month */}
                                <div>
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
                                    <span className="flex items-center space-x-1">
                                      <Package className="w-3.5 h-3.5 text-teal-600" />
                                      <span>Export Manifests ({monthPackings.length})</span>
                                    </span>
                                    <span className="font-mono font-bold text-teal-800">
                                      {formatCurrency(item.exportValueBDT, 'BDT')}
                                    </span>
                                  </div>

                                  {monthPackings.length === 0 ? (
                                    <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded border border-dashed text-center">
                                      No export packing manifests recorded for this month.
                                    </div>
                                  ) : (
                                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                                      {monthPackings.map((pk) => (
                                        <div
                                          key={pk.id}
                                          className="p-2 flex items-center justify-between hover:bg-slate-50"
                                        >
                                          <div>
                                            <div className="font-bold text-teal-950 font-mono">
                                              {pk.invoiceNumber} · {pk.shippingMark} ({pk.destination})
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                              {formatDate(pk.packingDate)} · {pk.totalBox} Boxes ({pk.totalWeight} KG)
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-mono font-bold text-emerald-800">
                                              {formatRMB(pk.totalAmount)}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openPrintModal({
                                                  type: 'packing',
                                                  title: `Packing List - ${pk.invoiceNumber}`,
                                                  data: pk,
                                                  items: pk.items,
                                                })
                                              }
                                              className="text-[10px] text-teal-600 hover:text-teal-800 font-semibold"
                                            >
                                              Print Manifest
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Total / Cumulative Rollup Row */}
            {filteredItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-700">
                  <td className="py-3 px-4 uppercase text-amber-400 font-serif font-black tracking-wider whitespace-nowrap">
                    CUMULATIVE TOTAL ({filteredItems.length} M)
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {filteredTotals.totalPurchaseVolume.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-amber-300 font-bold">
                    {formatCurrency(filteredTotals.totalPurchaseValue, '')}
                  </td>
                  <td className="py-3 px-2 text-center font-mono tabular-nums whitespace-nowrap">
                    {filteredTotals.totalPurchaseCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-teal-300 font-bold">
                    {filteredTotals.totalExportWeight.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-center font-mono tabular-nums whitespace-nowrap">
                    {filteredTotals.totalExportBoxes}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-amber-300 font-bold">
                    {formatRMB(filteredTotals.totalExportValueRMB)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-emerald-400 font-black">
                    {formatCurrency(filteredTotals.totalExportValueBDT, '')}
                  </td>
                  <td className="py-3 px-2 text-center font-mono tabular-nums whitespace-nowrap">
                    {filteredTotals.totalExportCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-rose-300">
                    {formatCurrency(filteredTotals.totalOtherCosts, '')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-emerald-400 font-black">
                    {formatCurrency(filteredTotals.totalNetProfit, '')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={handleExportSummaryCSV}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-black shadow-xs inline-flex items-center space-x-1 cursor-pointer"
                      title="Download full cumulative monthly summary CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export All</span>
                    </button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};
