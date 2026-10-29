import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  calculateMonthlySummary,
  formatCurrency,
  getCurrentYearMonth,
} from '../utils/calculations.ts';
import {
  Calendar,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RotateCcw,
  Download,
} from 'lucide-react';

interface MonthlySummaryCardProps {
  onOpenMonthlyReports?: () => void;
}

export const MonthlySummaryCard: React.FC<MonthlySummaryCardProps> = ({
  onOpenMonthlyReports,
}) => {
  const {
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile,
    setActiveTab,
  } = useApp();

  const currentYearMonth = useMemo(() => getCurrentYearMonth(), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);

  const summary = useMemo(
    () =>
      calculateMonthlySummary(
        purchases,
        packings,
        payments,
        otherCosts,
        selectedMonth,
        companyProfile.rmbExchangeRate
      ),
    [purchases, packings, payments, otherCosts, selectedMonth, companyProfile.rmbExchangeRate]
  );

  const isCurrentMonth = selectedMonth === currentYearMonth;
  const isProfitable = summary.netProfit >= 0;

  // Calculate percentage shares for visual cost & profit structure bar
  const baseTotal = Math.max(
    summary.totalExportValue,
    summary.totalPurchases + summary.totalOtherCosts,
    1
  );
  const purchaseShare = Math.min(100, Math.round((summary.totalPurchases / baseTotal) * 100));
  const otherCostShare = Math.min(
    100 - purchaseShare,
    Math.round((summary.totalOtherCosts / baseTotal) * 100)
  );
  const profitShare =
    summary.netProfit > 0
      ? Math.max(0, 100 - purchaseShare - otherCostShare)
      : 0;

  return (
    <section
      aria-label="Current Month Financial Summary"
      data-testid="monthly-summary-card"
      className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden"
    >
      {/* Executive Section Header Bar */}
      <div className="bg-slate-900 text-white px-5 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="text-sm font-bold tracking-wide text-white">
            Monthly Financial Performance
          </h2>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span
            data-testid="monthly-summary-period-badge"
            className="text-amber-300 font-mono text-xs font-semibold tabular-nums"
          >
            {summary.monthLabel}
            {isCurrentMonth ? ' (Current Period)' : ''}
          </span>
        </div>

        {/* Month Selector & P&L Sheet Link */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
            <label htmlFor="dashboard-summary-month" className="text-slate-300 font-medium mr-2 whitespace-nowrap">
              Period:
            </label>
            <input
              id="dashboard-summary-month"
              data-testid="monthly-summary-month-input"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || currentYearMonth)}
              className="bg-transparent text-white font-mono text-xs font-semibold focus:outline-none cursor-pointer tabular-nums [color-scheme:dark]"
            />
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentYearMonth)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
              title="Reset to Current Month"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Current Month</span>
            </button>
          )}

          {onOpenMonthlyReports && (
            <button
              type="button"
              data-testid="monthly-summary-export-csv-btn"
              onClick={onOpenMonthlyReports}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
              title="Open Monthly Summary Reports and CSV Export View"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Monthly CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('profit_loss')}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>P&amp;L Statement</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3 Core Monthly KPI Columns: Total Purchases, Total Export Value, Net Profit */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        {/* 1. Total Purchases (Current Month) */}
        <div className="p-5 flex flex-col justify-between bg-white hover:bg-slate-50/50 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  01 · Procurement Cost
                </div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  Total Purchases ({summary.monthLabel})
                </div>
              </div>
              <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-700 shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </span>
            </div>

            <div
              data-testid="monthly-total-purchases"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums mt-3 tracking-tight"
            >
              {formatCurrency(summary.totalPurchases, companyProfile.currency)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
            <span className="font-semibold text-sky-800">
              {summary.purchaseCount} {summary.purchaseCount === 1 ? 'Challan' : 'Challans'}
            </span>
            <span>·</span>
            <span>
              Volume: {summary.totalPurchaseQty.toLocaleString()} KG
            </span>
          </div>
        </div>

        {/* 2. Total Export Value (Current Month) */}
        <div className="p-5 flex flex-col justify-between bg-white hover:bg-slate-50/50 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  02 · Export Revenue
                </div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  Total Export Value ({summary.monthLabel})
                </div>
              </div>
              <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-700 shrink-0">
                <Package className="w-4 h-4" />
              </span>
            </div>

            <div
              data-testid="monthly-total-export-value"
              className="text-2xl sm:text-3xl font-extrabold text-teal-800 font-mono tabular-nums mt-3 tracking-tight"
            >
              {formatCurrency(summary.totalExportValue, companyProfile.currency)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
            <span className="font-semibold text-teal-800">
              {summary.packingCount} {summary.packingCount === 1 ? 'Manifest' : 'Manifests'}
            </span>
            <span>·</span>
            <span>
              {summary.totalWeightExported.toLocaleString()} KG ({summary.totalBoxesExported} Boxes)
            </span>
          </div>
        </div>

        {/* 3. Net Profit / Loss (Current Month) */}
        <div
          className={`p-5 flex flex-col justify-between transition-colors ${
            isProfitable ? 'bg-emerald-50/25' : 'bg-rose-50/25'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span>03 · Operating Margin</span>
                  <span aria-hidden="true">·</span>
                  <span
                    data-testid="monthly-profit-margin"
                    className={`font-mono font-bold tabular-nums ${
                      isProfitable ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {summary.marginPercent > 0 ? `+${summary.marginPercent}%` : `${summary.marginPercent}%`} Margin
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  Net {isProfitable ? 'Profit' : 'Loss'} ({summary.monthLabel})
                </div>
              </div>

              <span
                className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                  isProfitable
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {isProfitable ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </span>
            </div>

            <div
              data-testid="monthly-net-profit"
              className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums mt-3 tracking-tight ${
                isProfitable ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatCurrency(summary.netProfit, companyProfile.currency)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs font-mono tabular-nums text-slate-600">
            <span>
              Gross: <strong className="text-slate-900">{formatCurrency(summary.grossProfit, companyProfile.currency)}</strong>
            </span>
            <span>·</span>
            <span>
              Overheads: <strong className="text-amber-800">{formatCurrency(summary.totalOtherCosts, companyProfile.currency)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Formula & Allocation Strip */}
      <div className="bg-slate-50/90 px-5 py-3 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 font-mono tabular-nums">
          <span className="font-sans font-semibold text-slate-700">
            Ledger Formula:
          </span>
          <span>
            Export <strong className="text-teal-800">{formatCurrency(summary.totalExportValue, companyProfile.currency)}</strong>
          </span>
          <span>−</span>
          <span>
            Purchases <strong className="text-sky-800">{formatCurrency(summary.totalPurchases, companyProfile.currency)}</strong>
          </span>
          <span>−</span>
          <span>
            Overheads <strong className="text-amber-800">{formatCurrency(summary.totalOtherCosts, companyProfile.currency)}</strong>
          </span>
          <span>=</span>
          <strong className={isProfitable ? 'text-emerald-700' : 'text-rose-700'}>
            {formatCurrency(summary.netProfit, companyProfile.currency)}
          </strong>
        </div>

        {/* Visual Proportion Bar */}
        <div className="flex items-center space-x-3 min-w-[240px] sm:min-w-[300px]">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${purchaseShare}%` }}
              className="bg-sky-600 h-full"
              title={`Purchases: ${purchaseShare}%`}
            />
            <div
              style={{ width: `${otherCostShare}%` }}
              className="bg-amber-500 h-full"
              title={`Operating Costs: ${otherCostShare}%`}
            />
            <div
              style={{ width: `${profitShare}%` }}
              className="bg-emerald-600 h-full"
              title={`Net Profit: ${profitShare}%`}
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600 shrink-0 font-mono tabular-nums">
            <span className="text-sky-800">Pur {purchaseShare}%</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-800">Cost {otherCostShare}%</span>
            {profitShare > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-800">Net {profitShare}%</span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
