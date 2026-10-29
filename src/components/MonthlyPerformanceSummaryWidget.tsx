import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/calculations.ts';
import {
  calculateMonthlyPerformanceSummary,
  MonthlyPerformancePaymentMode,
} from '../utils/monthlyPerformanceSummary.ts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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

      {/* Side-by-Side Comparison Recharts BarChart */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Side-by-Side Monthly Purchases vs. Payments Bar Chart ({currency})
            </h3>
            <p className="text-xs text-slate-500">
              Grouped bars comparing monthly procurement obligation (Sky Blue) against monthly payments disbursed (Emerald Green)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-xs bg-sky-600 inline-block" />
              <span>Total Monthly Purchases</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
              <span>Total Monthly Payments</span>
            </span>
          </div>
        </div>

        <div
          data-testid="monthly-performance-barchart-container"
          className="h-72 sm:h-80 w-full"
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart
              data={points}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
              barGap={8}
              barCategoryGap="24%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="shortMonthLabel"
                tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val: number) =>
                  val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                }
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0]?.payload;
                  if (!pt) return null;
                  return (
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2 min-w-[240px]">
                      <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                        <span className="font-bold text-amber-300">{pt.monthLabel}</span>
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
                          {pt.paymentRatioPercent}% Settled
                        </span>
                      </div>
                      <div className="space-y-1 font-mono tabular-nums">
                        <div className="flex items-center justify-between">
                          <span className="text-sky-300 font-sans">Total Purchases:</span>
                          <span className="font-bold text-white">
                            {formatCurrency(pt.totalPurchases, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-300 font-sans">Total Payments:</span>
                          <span className="font-bold text-emerald-300">
                            {formatCurrency(pt.totalPayments, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                          <span className="text-slate-400 font-sans">Net Variance:</span>
                          <span
                            className={`font-bold ${
                              pt.netPayableVariance > 0 ? 'text-rose-400' : 'text-teal-300'
                            }`}
                          >
                            {formatCurrency(pt.netPayableVariance, currency)}
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                        {pt.purchaseCount} Challan(s) ({pt.purchaseVolumeKg} KG) · {pt.paymentCount} Payment(s)
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '8px' }}
              />
              <Bar
                dataKey="totalPurchases"
                name={`Total Monthly Purchases (${currency})`}
                fill="#0284c7"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey="totalPayments"
                name={`Total Monthly Payments (${currency})`}
                fill="#059669"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Collapsible Side-by-Side Monthly Comparison Ledger Table */}
      {showComparisonTable && (
        <div className="border-t border-slate-200 overflow-x-auto">
          <table
            data-testid="monthly-performance-comparison-table"
            className="w-full text-xs border-collapse"
          >
            <thead>
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
            <tfoot>
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
      )}
    </section>
  );
};
