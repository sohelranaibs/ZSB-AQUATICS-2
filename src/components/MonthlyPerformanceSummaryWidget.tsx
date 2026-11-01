import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/calculations.ts';
import {
  calculateMonthlyPerformanceSummary,
  MonthlyPerformancePaymentMode,
} from '../utils/monthlyPerformanceSummary.ts';
import {
  BarChart3,
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Table2,
} from 'lucide-react';

export const MonthlyPerformanceSummaryWidget: React.FC = () => {
  const { purchases, payments, companyProfile, setActiveTab } = useApp();

  const [windowMode, setWindowMode] = useState<'6m' | 'active' | '12m'>('6m');
  const [paymentMode, setPaymentMode] =
    useState<MonthlyPerformancePaymentMode>('all_payments');
  const [showComparisonTable, setShowComparisonTable] = useState<boolean>(true);

  const performanceSummary = useMemo(
    () =>
      calculateMonthlyPerformanceSummary(purchases, payments, {
        monthsToShow: windowMode === '12m' ? 12 : 6,
        activeOnly: windowMode === 'active',
        paymentMode,
        rmbExchangeRate: companyProfile.rmbExchangeRate,
      }),
    [purchases, payments, windowMode, paymentMode, companyProfile.rmbExchangeRate]
  );

  const { points, totals, periodRangeLabel } = performanceSummary;
  const currency = companyProfile.currency || 'TK';

  return (
    <section
      aria-label="Monthly Performance Summary"
      data-testid="monthly-performance-summary-widget"
      className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden"
    >
      {/* Top Executive Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-3.5 border-b border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-sky-400" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">
                Monthly Performance Summary
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-400 text-slate-950">
                Purchases vs. Payments
              </span>
              <span
                data-testid="monthly-performance-period-label"
                className="text-xs font-mono text-sky-300 font-semibold tabular-nums"
              >
                {periodRangeLabel}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Side-by-side monthly comparison of total fish procurement bills against supplier &amp; ledger payment settlements
            </p>
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Payment Basis Mode Switcher */}
          <div
            role="group"
            aria-label="Payment comparison mode"
            className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-700"
          >
            <button
              type="button"
              data-testid="perf-mode-all-payments"
              onClick={() => setPaymentMode('all_payments')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                paymentMode === 'all_payments'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Compare against all monthly settlements (Payment Vouchers + Direct Challan Settlements)"
            >
              All Payments
            </button>
            <button
              type="button"
              data-testid="perf-mode-vouchers"
              onClick={() => setPaymentMode('payment_vouchers')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                paymentMode === 'payment_vouchers'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Compare strictly against standalone Payment DB Vouchers"
            >
              Vouchers Only
            </button>
            <button
              type="button"
              data-testid="perf-mode-challan"
              onClick={() => setPaymentMode('challan_paid')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                paymentMode === 'challan_paid'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Compare against Paid Amounts recorded directly on Purchase Challans"
            >
              Challan Paid
            </button>
          </div>

          {/* Time Window Switcher */}
          <div
            role="group"
            aria-label="Performance summary time window"
            className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-700"
          >
            <button
              type="button"
              data-testid="perf-window-6m"
              onClick={() => setWindowMode('6m')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                windowMode === '6m'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              6 Months
            </button>
            <button
              type="button"
              data-testid="perf-window-active"
              onClick={() => setWindowMode('active')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                windowMode === 'active'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Active Months
            </button>
            <button
              type="button"
              data-testid="perf-window-12m"
              onClick={() => setWindowMode('12m')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                windowMode === '12m'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              12 Months
            </button>
          </div>

          <button
            type="button"
            data-testid="perf-toggle-table-btn"
            onClick={() => setShowComparisonTable((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              showComparisonTable
                ? 'bg-slate-800 border-amber-400/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>{showComparisonTable ? 'Hide Table' : 'Show Table'}</span>
          </button>
        </div>
      </div>

      {/* 4-Column Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/70 border-b border-slate-200">
        {/* KPI 1: Total Monthly Purchases */}
        <div className="p-4 px-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Monthly Purchases</span>
            <ShoppingCart className="w-4 h-4 text-sky-600 shrink-0" />
          </div>
          <div
            data-testid="perf-kpi-total-purchases"
            className="text-xl sm:text-2xl font-black font-mono tabular-nums text-sky-900 mt-1"
          >
            {formatCurrency(totals.totalPurchases, currency)}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center justify-between">
            <span>{totals.totalPurchaseCount} Challans</span>
            <span>·</span>
            <span>{totals.totalPurchaseVolumeKg.toLocaleString()} KG</span>
          </div>
        </div>

        {/* KPI 2: Total Monthly Payments */}
        <div className="p-4 px-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Monthly Payments</span>
            <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div
            data-testid="perf-kpi-total-payments"
            className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-800 mt-1"
          >
            {formatCurrency(totals.totalPayments, currency)}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center justify-between">
            <span>{totals.totalPaymentCount} Settlements</span>
            <span>·</span>
            <span>Peak: {totals.peakPaymentMonth}</span>
          </div>
        </div>

        {/* KPI 3: Payment Settlement Coverage Ratio */}
        <div className="p-4 px-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Payment Settlement Ratio</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span
              data-testid="perf-kpi-payment-ratio"
              className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900"
            >
              {totals.overallPaymentRatioPercent}%
            </span>
            <span className="text-[11px] font-mono font-semibold text-teal-700">
              {totals.activeMonthsCount} Active {totals.activeMonthsCount === 1 ? 'Month' : 'Months'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
            <div
              style={{
                width: `${Math.min(100, Math.max(0, totals.overallPaymentRatioPercent))}%`,
              }}
              className="h-full bg-emerald-600 rounded-full transition-all"
            />
          </div>
        </div>

        {/* KPI 4: Net Payable Variance (Purchases - Payments) */}
        <div className="p-4 px-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Net Payable Variance</span>
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                totals.totalNetPayableVariance > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <div
            data-testid="perf-kpi-net-variance"
            className={`text-xl sm:text-2xl font-black font-mono tabular-nums mt-1 ${
              totals.totalNetPayableVariance > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {formatCurrency(totals.totalNetPayableVariance, currency)}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center justify-between">
            <span>
              {totals.totalNetPayableVariance > 0
                ? 'Outstanding Payable'
                : 'Fully Covered'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('payment_form')}
              className="text-indigo-700 hover:text-indigo-900 font-bold inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Pay Supplier</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Side-by-Side Monthly Comparison Ledger Table inside Scrollable Box */}
      {showComparisonTable && (
        <div className="p-3 bg-slate-50/70">
          <div className="max-h-[360px] overflow-y-auto overflow-x-auto border-2 border-slate-200 rounded-lg bg-white shadow-inner">
          <table
            data-testid="monthly-performance-comparison-table"
            className="w-full text-xs border-collapse"
          >
            <thead className="sticky top-0 z-10 shadow-2xs">
              <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-4 text-left">MONTH</th>
                <th className="py-2.5 px-3 text-center">CHALLANS / VOL</th>
                <th className="py-2.5 px-4 text-right">
                  TOTAL PURCHASES ({currency})
                </th>
                <th className="py-2.5 px-4 text-right">
                  TOTAL PAYMENTS ({currency})
                </th>
                <th className="py-2.5 px-4 text-right">
                  NET VARIANCE ({currency})
                </th>
                <th className="py-2.5 px-3 text-right">SETTLED %</th>
                <th className="py-2.5 px-4 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {points.map((pt) => (
                <tr
                  key={pt.yearMonth}
                  data-testid={`monthly-perf-row-${pt.yearMonth}`}
                  className="hover:bg-slate-50/80 transition"
                >
                  <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                    {pt.monthLabel}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                    {pt.purchaseCount} Bills ({pt.purchaseVolumeKg.toLocaleString()} KG)
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-900 tabular-nums whitespace-nowrap">
                    {formatCurrency(pt.totalPurchases, '')}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                    {formatCurrency(pt.totalPayments, '')}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                      pt.netPayableVariance > 0
                        ? 'text-rose-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {formatCurrency(pt.netPayableVariance, '')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 tabular-nums whitespace-nowrap">
                    {pt.paymentRatioPercent}%
                  </td>
                  <td className="py-2.5 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        pt.settlementStatus === 'FULLY_SETTLED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : pt.settlementStatus === 'PARTIAL_SETTLED'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : pt.settlementStatus === 'UNPAID'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {pt.settlementStatus === 'FULLY_SETTLED'
                        ? 'SETTLED'
                        : pt.settlementStatus === 'PARTIAL_SETTLED'
                        ? 'PARTIAL'
                        : pt.settlementStatus === 'UNPAID'
                        ? 'UNPAID'
                        : 'NO ACTIVITY'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-slate-100 font-black text-xs border-t-2 border-slate-300">
                <td className="py-2.5 px-4 uppercase text-slate-900">
                  PERIOD TOTAL ({periodRangeLabel})
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-slate-800">
                  {totals.totalPurchaseCount} Bills ({totals.totalPurchaseVolumeKg.toLocaleString()} KG)
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-sky-900">
                  {formatCurrency(totals.totalPurchases, currency)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-800">
                  {formatCurrency(totals.totalPayments, currency)}
                </td>
                <td
                  className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                    totals.totalNetPayableVariance > 0
                      ? 'text-rose-700'
                      : 'text-emerald-800'
                  }`}
                >
                  {formatCurrency(totals.totalNetPayableVariance, currency)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                  {totals.overallPaymentRatioPercent}%
                </td>
                <td className="py-2.5 px-4 text-center font-mono text-[11px] text-slate-700">
                  {totals.totalPaymentCount} Payments
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}
    </section>
  );
};
