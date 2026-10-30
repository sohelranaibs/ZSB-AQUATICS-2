import React, { useState, useMemo } from 'react';
import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
  CompanyProfile,
  ActiveTab,
} from '../types/index.ts';
import {
  calculateDailyProfitLossReport,
  DailyPLStatusFilter,
  DailyProfitLossEntry,
} from '../utils/dailyProfitLoss.ts';
import {
  formatCurrency,
  formatRMB,
  formatYearMonthLabel,
  classifyPaymentCategory,
} from '../utils/calculations.ts';
import {
  Calendar,
  Printer,
  Search,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpRight,
} from 'lucide-react';

interface DailyProfitLossSectionProps {
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts: OtherCostRecord[];
  companyProfile: CompanyProfile;
  openPrintModal: (modalData: any) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const DailyProfitLossSection: React.FC<DailyProfitLossSectionProps> = ({
  purchases,
  packings,
  payments,
  otherCosts,
  companyProfile,
  openPrintModal,
  setActiveTab,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<DailyPLStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dailyReport = useMemo(
    () =>
      calculateDailyProfitLossReport(purchases, packings, payments, otherCosts, {
        targetYearMonth: selectedMonth,
        fromDate,
        toDate,
        statusFilter,
        searchQuery,
        rmbExchangeRate: companyProfile.rmbExchangeRate,
      }),
    [
      purchases,
      packings,
      payments,
      otherCosts,
      selectedMonth,
      fromDate,
      toDate,
      statusFilter,
      searchQuery,
      companyProfile.rmbExchangeRate,
    ]
  );

  // Resolve the active day for the itemized drill-down panel
  const activeDayEntry: DailyProfitLossEntry | null = useMemo(() => {
    if (dailyReport.entries.length === 0) return null;
    if (selectedDate) {
      const found = dailyReport.entries.find((e) => e.date === selectedDate);
      if (found) return found;
    }
    return dailyReport.entries[0];
  }, [dailyReport.entries, selectedDate]);

  const hasActiveFilters =
    selectedMonth !== 'all' ||
    fromDate !== '' ||
    toDate !== '' ||
    statusFilter !== 'all' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedMonth('all');
    setFromDate('');
    setToDate('');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handlePrintDailyReport = (singleEntry?: DailyProfitLossEntry) => {
    const entriesToPrint = singleEntry ? [singleEntry] : dailyReport.entries;
    const printTotals = singleEntry
      ? {
          totalPurchasing: singleEntry.purchaseAmount,
          totalExportValue: singleEntry.exportAmountBDT,
          totalWeightExported: singleEntry.exportWeightKg,
          totalPaymentMade: singleEntry.supplierPaymentAmount,
          totalReturnRMB: singleEntry.returnRmbAmount,
          totalReturnRMBInBDT: singleEntry.returnRmbInBDT,
          totalOtherCosting: singleEntry.otherCostAmount,
          grossProfit: singleEntry.grossProfit,
          netProfit: singleEntry.netProfit,
          marginPercent: singleEntry.marginPercent,
        }
      : {
          totalPurchasing: dailyReport.totals.totalPurchaseAmount,
          totalExportValue: dailyReport.totals.totalExportAmountBDT,
          totalWeightExported: dailyReport.totals.totalExportWeightKg,
          totalPaymentMade: dailyReport.totals.totalSupplierPaymentAmount,
          totalReturnRMB: dailyReport.totals.totalReturnRmbAmount,
          totalReturnRMBInBDT: dailyReport.totals.totalReturnRmbInBDT,
          totalOtherCosting: dailyReport.totals.totalOtherCostAmount,
          grossProfit: dailyReport.totals.totalGrossProfit,
          netProfit: dailyReport.totals.totalNetProfit,
          marginPercent: dailyReport.totals.overallMarginPercent,
        };

    openPrintModal({
      type: 'profit_loss',
      title: singleEntry
        ? `Daily Profit & Loss Statement — ${singleEntry.formattedDate}`
        : 'Daily Profit & Loss Detailed Report',
      data: {
        summary: printTotals,
        dailyEntries: entriesToPrint,
        singleDayEntry: singleEntry || null,
        periodLabel: singleEntry
          ? `Single Day Report: ${singleEntry.formattedDate} (${singleEntry.weekdayLabel})`
          : selectedMonth !== 'all'
          ? formatYearMonthLabel(selectedMonth)
          : fromDate || toDate
          ? `${fromDate || 'Start'} to ${toDate || 'Present'}`
          : 'All Active Trading Days',
        purchases: singleEntry ? singleEntry.purchases : purchases,
        packings: singleEntry ? singleEntry.packings : packings,
        payments: singleEntry ? singleEntry.payments : payments,
        otherCosts: singleEntry ? singleEntry.otherCosts : otherCosts,
      },
    });
  };

  const { totals } = dailyReport;
  const isPeriodProfitable = totals.totalNetProfit >= 0;

  return (
    <section
      aria-label="Daily Report Details of Profit and Loss"
      data-testid="pl-daily-report-section"
      className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden"
    >
      {/* Top Section Header Bar */}
      <div className="bg-[#1b2b44] text-white px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Daily Report Details of Profit &amp; Loss
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                {totals.totalDays} {totals.totalDays === 1 ? 'Day' : 'Days'}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {totals.profitableDaysCount} Profit
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">
                {totals.lossDaysCount} Loss
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Day-by-day itemized financial breakdown of Export Revenue (A), Purchase Cost (B), Other Costing (C), and Net Profit / Loss
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Status Filter Buttons */}
          <div
            role="group"
            aria-label="Daily Profit and Loss Status Filter"
            className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700"
          >
            <button
              type="button"
              data-testid="pl-daily-filter-all"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All Days ({dailyReport.allEntriesCount})
            </button>
            <button
              type="button"
              data-testid="pl-daily-filter-profit"
              onClick={() => setStatusFilter('profit')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'profit'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Profit Days
            </button>
            <button
              type="button"
              data-testid="pl-daily-filter-loss"
              onClick={() => setStatusFilter('loss')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'loss'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Loss Days
            </button>
          </div>

          <button
            type="button"
            data-testid="pl-daily-print-all-btn"
            onClick={() => handlePrintDailyReport()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Daily P&amp;L Report</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="pl-daily-month-select"
              className="text-[11px] font-bold uppercase text-slate-600"
            >
              Month:
            </label>
            <select
              id="pl-daily-month-select"
              aria-label="Filter Daily P&L by Month"
              data-testid="pl-daily-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 font-bold text-slate-800 text-xs"
            >
              <option value="all">All Active Months</option>
              {dailyReport.availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatYearMonthLabel(ym)} ({ym})
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="flex items-center gap-1">
            <label
              htmlFor="pl-daily-from-date"
              className="text-[11px] font-bold uppercase text-slate-600"
            >
              From:
            </label>
            <input
              id="pl-daily-from-date"
              type="date"
              aria-label="Daily P&L From Date"
              data-testid="pl-daily-from-date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-slate-800 text-xs"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-1">
            <label
              htmlFor="pl-daily-to-date"
              className="text-[11px] font-bold uppercase text-slate-600"
            >
              To:
            </label>
            <input
              id="pl-daily-to-date"
              type="date"
              aria-label="Daily P&L To Date"
              data-testid="pl-daily-to-date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-slate-800 text-xs"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              data-testid="pl-daily-reset-filters"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Search Daily Profit and Loss Report"
            data-testid="pl-daily-search-input"
            placeholder="Search date, supplier, mark, invoice, cost..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded pl-8 pr-2.5 py-1 text-xs text-slate-800"
          />
        </div>
      </div>

      {/* Daily P&L Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/90 border-b border-slate-200">
        {/* Card 1: Filtered Period Net Profit / Loss */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
            <span>Filtered Daily Net {isPeriodProfitable ? 'Profit' : 'Loss'}</span>
            <span
              className={`text-[11px] font-mono font-bold ${
                isPeriodProfitable ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              Margin: {totals.overallMarginPercent}%
            </span>
          </div>
          <div
            data-testid="pl-daily-total-net-profit"
            className={`text-sm sm:text-base font-black font-mono tabular-nums mt-0.5 ${
              isPeriodProfitable ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {totals.totalNetProfit >= 0 ? '+' : ''}
            {formatCurrency(totals.totalNetProfit, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
            Gross: {formatCurrency(totals.totalGrossProfit, companyProfile.currency)} · Costs:{' '}
            {formatCurrency(totals.totalOtherCostAmount, companyProfile.currency)}
          </div>
        </div>

        {/* Card 2: Average Daily Net P&L & Win/Loss Days */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
            <span>Average Daily Net P&amp;L</span>
            <span className="text-[11px] font-mono font-bold text-slate-700">
              {totals.totalDays} Active {totals.totalDays === 1 ? 'Day' : 'Days'}
            </span>
          </div>
          <div
            data-testid="pl-daily-avg-net-profit"
            className={`text-sm sm:text-base font-extrabold font-mono tabular-nums mt-0.5 ${
              totals.averageDailyNetProfit >= 0 ? 'text-teal-800' : 'text-rose-700'
            }`}
          >
            {totals.averageDailyNetProfit >= 0 ? '+' : ''}
            {formatCurrency(totals.averageDailyNetProfit, companyProfile.currency)} / day
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            {totals.profitableDaysCount} Profit · {totals.lossDaysCount} Loss ·{' '}
            {totals.breakEvenDaysCount} Even
          </div>
        </div>

        {/* Card 3: Best Single-Day Profit */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
            <span>Peak Daily Profit Record</span>
            {totals.bestProfitDay && (
              <span className="text-[11px] font-mono font-bold text-emerald-700">
                {totals.bestProfitDay.formattedDate}
              </span>
            )}
          </div>
          <div
            data-testid="pl-daily-best-day"
            className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5"
          >
            {totals.bestProfitDay
              ? `+${formatCurrency(totals.bestProfitDay.netProfit, companyProfile.currency)}`
              : formatCurrency(0, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
            {totals.worstLossDay
              ? `Largest Daily Loss: ${formatCurrency(
                  totals.worstLossDay.netProfit,
                  companyProfile.currency
                )} (${totals.worstLossDay.formattedDate})`
              : 'No net loss days in selection'}
          </div>
        </div>

        {/* Card 4: Daily Volume & Revenue vs Purchase Summary */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500">
            Daily Export vs. Purchase Volume
          </div>
          <div className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
            Exp: {totals.totalExportWeightKg} KG ({totals.totalExportBoxes} Box)
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
            Purchased: {totals.totalPurchaseQtyKg} KG ({totals.totalPurchaseCount} Bills)
          </div>
        </div>
      </div>

      {/* Main Chronological Daily Profit & Loss Statement Table */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-xs border-collapse"
          data-testid="pl-daily-report-table"
        >
          <thead className="bg-slate-800 text-white uppercase text-[10px] font-bold tracking-wider border-b border-slate-700 whitespace-nowrap">
            <tr>
              <th className="py-2.5 px-3 text-left">Date &amp; Particulars</th>
              <th className="py-2.5 px-2.5 text-right">Export Revenue (A)</th>
              <th className="py-2.5 px-2.5 text-right">Purchase Cost (B)</th>
              <th className="py-2.5 px-2.5 text-right">Gross Profit (A-B)</th>
              <th className="py-2.5 px-2.5 text-right">Other Costing (C)</th>
              <th className="py-2.5 px-2.5 text-right">Net Profit / Loss</th>
              <th className="py-2.5 px-2.5 text-right">Running P&amp;L</th>
              <th className="py-2.5 px-3 text-center">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
            {dailyReport.entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                  No daily profit &amp; loss records match the active filter criteria.
                </td>
              </tr>
            ) : (
              dailyReport.entries.map((entry) => {
                const isSelected = activeDayEntry?.date === entry.date;
                const isProfit = entry.netProfit > 0;
                const isLoss = entry.netProfit < 0;

                return (
                  <tr
                    key={entry.date}
                    data-testid={`pl-daily-row-${entry.date}`}
                    onClick={() =>
                      setSelectedDate((prev) => (prev === entry.date ? null : entry.date))
                    }
                    className={`transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/90 hover:bg-amber-100/70'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Date & Activity Summary */}
                    <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-slate-900 text-xs">
                          {entry.formattedDate}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-slate-200 text-slate-700">
                          {entry.weekdayLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded ${
                            isProfit
                              ? 'bg-emerald-100 text-emerald-800'
                              : isLoss
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[230px]">
                        {entry.topSummaryText}
                      </div>
                    </td>

                    {/* Export Revenue (A) */}
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div className="font-bold text-teal-800">
                        {formatCurrency(entry.exportAmountBDT, companyProfile.currency)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {entry.exportCount > 0
                          ? `${formatRMB(entry.exportAmountRMB)} · ${entry.exportWeightKg} KG`
                          : '0 Shipments'}
                      </div>
                    </td>

                    {/* Purchase Cost (B) */}
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div className="font-bold text-blue-800">
                        {formatCurrency(entry.purchaseAmount, companyProfile.currency)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {entry.purchaseCount > 0
                          ? `${entry.purchaseQtyKg} KG · ${entry.purchaseCount} Bill${
                              entry.purchaseCount > 1 ? 's' : ''
                            }`
                          : '0 Bills'}
                      </div>
                    </td>

                    {/* Gross Profit (A - B) */}
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div
                        className={`font-bold ${
                          entry.grossProfit > 0
                            ? 'text-teal-700'
                            : entry.grossProfit < 0
                            ? 'text-rose-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {entry.grossProfit > 0 ? '+' : ''}
                        {formatCurrency(entry.grossProfit, companyProfile.currency)}
                      </div>
                      <div className="text-[10px] text-slate-400">Rev − Purchase</div>
                    </td>

                    {/* Other Costing (C) */}
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div className="font-bold text-amber-700">
                        {formatCurrency(entry.otherCostAmount, companyProfile.currency)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {entry.otherCostCount > 0
                          ? `${entry.otherCostCount} Expense${
                              entry.otherCostCount > 1 ? 's' : ''
                            }`
                          : 'No Extra Cost'}
                      </div>
                    </td>

                    {/* Net Profit / Loss (A - B - C) */}
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div
                        data-testid={`pl-daily-net-${entry.date}`}
                        className={`font-black text-xs inline-flex items-center justify-end gap-1 ${
                          isProfit
                            ? 'text-emerald-700'
                            : isLoss
                            ? 'text-rose-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {isProfit ? (
                          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                        ) : isLoss ? (
                          <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                        ) : null}
                        <span>
                          {isProfit ? '+' : ''}
                          {formatCurrency(entry.netProfit, companyProfile.currency)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Margin: {entry.marginPercent}%
                      </div>
                    </td>

                    {/* Running Cumulative Net P&L */}
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div
                        className={`font-bold ${
                          entry.runningCumulativeNetProfit >= 0
                            ? 'text-slate-900'
                            : 'text-rose-700'
                        }`}
                      >
                        {entry.runningCumulativeNetProfit >= 0 ? '+' : ''}
                        {formatCurrency(
                          entry.runningCumulativeNetProfit,
                          companyProfile.currency
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">Cum. Balance</div>
                    </td>

                    {/* Action / Inspect Day */}
                    <td
                      className="py-2.5 px-3 text-center font-sans whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`pl-daily-inspect-btn-${entry.date}`}
                          onClick={() =>
                            setSelectedDate((prev) =>
                              prev === entry.date ? null : entry.date
                            )
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#1b2b44] text-amber-300'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          <span>{isSelected ? 'Viewing' : 'Details'}</span>
                          {isSelected ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={`Print Daily P&L for ${entry.formattedDate}`}
                          data-testid={`pl-daily-print-day-${entry.date}`}
                          onClick={() => handlePrintDailyReport(entry)}
                          className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                          title={`Print Daily Statement for ${entry.formattedDate}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {dailyReport.entries.length > 0 && (
            <tfoot className="bg-slate-900 text-white font-mono text-xs font-black border-t-2 border-amber-500 whitespace-nowrap">
              <tr>
                <td className="py-3 px-3 font-sans uppercase">
                  TOTAL ({totals.totalDays} {totals.totalDays === 1 ? 'DAY' : 'DAYS'}):
                </td>
                <td className="py-3 px-2.5 text-right text-teal-300">
                  {formatCurrency(totals.totalExportAmountBDT, companyProfile.currency)}
                </td>
                <td className="py-3 px-2.5 text-right text-blue-300">
                  {formatCurrency(totals.totalPurchaseAmount, companyProfile.currency)}
                </td>
                <td className="py-3 px-2.5 text-right text-amber-300">
                  {totals.totalGrossProfit >= 0 ? '+' : ''}
                  {formatCurrency(totals.totalGrossProfit, companyProfile.currency)}
                </td>
                <td className="py-3 px-2.5 text-right text-orange-300">
                  {formatCurrency(totals.totalOtherCostAmount, companyProfile.currency)}
                </td>
                <td
                  className={`py-3 px-2.5 text-right ${
                    totals.totalNetProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {totals.totalNetProfit >= 0 ? '+' : ''}
                  {formatCurrency(totals.totalNetProfit, companyProfile.currency)}
                </td>
                <td className="py-3 px-2.5 text-right text-slate-300">
                  Margin: {totals.overallMarginPercent}%
                </td>
                <td className="py-3 px-3 text-center"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Selected Day Itemized Drill-Down Breakdown Panel */}
      {activeDayEntry && (
        <div
          data-testid="pl-daily-detail-drawer"
          className="bg-slate-50 border-t-2 border-slate-300 p-4 sm:p-5 space-y-4"
        >
          {/* Drill-down Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black uppercase text-slate-900">
                    Daily Itemized Profit &amp; Loss Breakdown — {activeDayEntry.formattedDate} (
                    {activeDayEntry.weekdayLabel})
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded ${
                      activeDayEntry.netProfit > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeDayEntry.netProfit < 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {activeDayEntry.status}:{' '}
                    {activeDayEntry.netProfit > 0 ? '+' : ''}
                    {formatCurrency(activeDayEntry.netProfit, companyProfile.currency)}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                  Export Rev (A):{' '}
                  <strong>
                    {formatCurrency(activeDayEntry.exportAmountBDT, companyProfile.currency)}
                  </strong>{' '}
                  − Purchase Cost (B):{' '}
                  <strong>
                    {formatCurrency(activeDayEntry.purchaseAmount, companyProfile.currency)}
                  </strong>{' '}
                  − Other Costing (C):{' '}
                  <strong>
                    {formatCurrency(activeDayEntry.otherCostAmount, companyProfile.currency)}
                  </strong>{' '}
                  ={' '}
                  <strong
                    className={
                      activeDayEntry.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }
                  >
                    {activeDayEntry.netProfit >= 0 ? '+' : ''}
                    {formatCurrency(activeDayEntry.netProfit, companyProfile.currency)}
                  </strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePrintDailyReport(activeDayEntry)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2b44] hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print {activeDayEntry.formattedDate} Statement</span>
            </button>
          </div>

          {/* 4-Column / 2x2 Grid of Itemized Daily Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Daily Export Packing Consignments (Revenue A) */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2 bg-teal-900 text-white flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-teal-300" />
                  <span>
                    1. EXPORT CONSIGNMENTS (REVENUE A) — {activeDayEntry.packings.length}
                  </span>
                </div>
                <span className="font-mono text-teal-200">
                  {formatCurrency(activeDayEntry.exportAmountBDT, companyProfile.currency)}
                </span>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5 text-left">Packing # &amp; Mark</th>
                      <th className="py-1.5 px-2 text-left">Flight / Dest</th>
                      <th className="py-1.5 px-2 text-right">Box / Wt</th>
                      <th className="py-1.5 px-2.5 text-right">Export Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeDayEntry.packings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 font-sans">
                          No export consignments recorded on {activeDayEntry.formattedDate}.
                        </td>
                      </tr>
                    ) : (
                      activeDayEntry.packings.map((pk) => {
                        const rate =
                          Number(pk.rmbRate) > 0
                            ? Number(pk.rmbRate)
                            : companyProfile.rmbExchangeRate;
                        const bdtVal =
                          pk.totalAmountBDT && Number(pk.totalAmountBDT) > 0
                            ? Number(pk.totalAmountBDT)
                            : Math.round((Number(pk.totalAmount) || 0) * rate * 100) / 100;
                        return (
                          <tr key={pk.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 font-sans">
                              <div className="font-mono font-bold text-slate-900">
                                {pk.invoiceNumber}
                              </div>
                              <div className="text-[10px] font-bold text-teal-800">
                                Mark: {pk.shippingMark}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 font-sans text-slate-700">
                              <div>{pk.flight}</div>
                              <div className="text-[10px] text-slate-500">{pk.destination}</div>
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <div className="font-bold text-slate-800">{pk.totalWeight} KG</div>
                              <div className="text-[10px] text-slate-500">{pk.totalBox} Box</div>
                            </td>
                            <td className="py-1.5 px-2.5 text-right">
                              <div className="font-bold text-teal-800">
                                {formatCurrency(bdtVal, companyProfile.currency)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {formatRMB(pk.totalAmount)}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Daily Live Fish Purchase Bills (Cost B) */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2 bg-blue-900 text-white flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-300" />
                  <span>
                    2. PURCHASE BILLS (COST B) — {activeDayEntry.purchases.length}
                  </span>
                </div>
                <span className="font-mono text-blue-200">
                  {formatCurrency(activeDayEntry.purchaseAmount, companyProfile.currency)}
                </span>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5 text-left">Invoice &amp; Supplier</th>
                      <th className="py-1.5 px-2 text-left">Grades</th>
                      <th className="py-1.5 px-2 text-right">Qty (KG)</th>
                      <th className="py-1.5 px-2.5 text-right">Bill Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeDayEntry.purchases.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 font-sans">
                          No purchase bills recorded on {activeDayEntry.formattedDate}.
                        </td>
                      </tr>
                    ) : (
                      activeDayEntry.purchases.map((pur) => (
                        <tr key={pur.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 font-sans">
                            <div className="font-mono font-bold text-slate-900">
                              {pur.invoiceNumber}
                            </div>
                            <div className="text-[10px] font-bold text-blue-800">
                              {pur.description}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 font-sans text-slate-700">
                            {(pur.items || []).map((i) => i.item).filter(Boolean).join(', ') ||
                              '-'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-slate-800">
                            {pur.totalQty} KG
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <div className="font-bold text-blue-800">
                              {formatCurrency(pur.totalAmount, companyProfile.currency)}
                            </div>
                            {pur.paidAmount > 0 && (
                              <div className="text-[10px] text-emerald-700">
                                Paid: {formatCurrency(pur.paidAmount, companyProfile.currency)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Daily Other Operating Costs (Expense C) */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2 bg-amber-800 text-white flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-amber-200" />
                  <span>
                    3. OTHER OPERATING COSTS (EXPENSE C) — {activeDayEntry.otherCosts.length}
                  </span>
                </div>
                <span className="font-mono text-amber-200">
                  {formatCurrency(activeDayEntry.otherCostAmount, companyProfile.currency)}
                </span>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5 text-left">Category</th>
                      <th className="py-1.5 px-2 text-left">Particulars / Ref</th>
                      <th className="py-1.5 px-2.5 text-right">Expense Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeDayEntry.otherCosts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400 font-sans">
                          No other operating costs logged on {activeDayEntry.formattedDate}.
                        </td>
                      </tr>
                    ) : (
                      activeDayEntry.otherCosts.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900">
                            {c.category}
                          </td>
                          <td className="py-1.5 px-2 font-sans text-slate-600">
                            <div>{c.description}</div>
                            {c.refInvoice && (
                              <div className="text-[10px] font-mono text-slate-400">
                                Ref: {c.refInvoice}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-bold text-amber-800">
                            {formatCurrency(c.amount, companyProfile.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Daily Payments & Settlements (Cashflow) */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2 bg-purple-900 text-white flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-purple-300" />
                  <span>
                    4. PAYMENTS &amp; SETTLEMENTS — {activeDayEntry.payments.length}
                  </span>
                </div>
                <span className="font-mono text-purple-200">
                  Sup Outflow:{' '}
                  {formatCurrency(activeDayEntry.supplierPaymentAmount, companyProfile.currency)}
                </span>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5 text-left">Voucher &amp; Party</th>
                      <th className="py-1.5 px-2 text-left">Ledger Type</th>
                      <th className="py-1.5 px-2.5 text-right">Paid / Return RMB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeDayEntry.payments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400 font-sans">
                          No payment vouchers recorded on {activeDayEntry.formattedDate}.
                        </td>
                      </tr>
                    ) : (
                      activeDayEntry.payments.map((pm) => {
                        const cat = classifyPaymentCategory(pm);
                        return (
                          <tr key={pm.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 font-sans">
                              <div className="font-mono font-bold text-slate-900">
                                {pm.invoiceNumber}
                              </div>
                              <div className="text-[10px] font-bold text-purple-900">
                                {pm.description}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 font-sans">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                  cat === 'exporter'
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {cat}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-right">
                              <div className="font-bold text-slate-900">
                                {formatCurrency(pm.paidAmount, companyProfile.currency)}
                              </div>
                              {pm.returnRMB > 0 && (
                                <div className="text-[10px] text-purple-700 font-semibold">
                                  Return: {formatRMB(pm.returnRMB)}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quick Jump Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
            <span>
              Click any date row in the Daily Report table above to inspect its itemized transactions.
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('purchase_form')}
                className="text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>+ Log Purchase Bill</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('packing_form')}
                className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>+ Log Export Packing</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
