import React, { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/calculations.ts';
import {
  TotalBalanceMonthlyTrendPoint,
  TotalBalanceMonthlyTrendSummary,
} from '../utils/totalBalance.ts';

interface TotalBalanceTrendChartCardProps {
  trend: TotalBalanceMonthlyTrendSummary;
  currency: string;
}

interface CustomTrendTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: TotalBalanceMonthlyTrendPoint }>;
  currency: string;
}

function formatCompactAxisTick(value: number): string {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(num / 1_000).toFixed(0)}k`;
  }
  return `${Math.round(num)}`;
}

const BalanceTrendTooltip: React.FC<CustomTrendTooltipProps> = ({
  active,
  payload,
  currency,
}) => {
  const pt = payload?.[0]?.payload;
  if (!active || !pt) return null;

  const totalInflow = pt.partnerDeposit + pt.incomeAdded;
  const totalOutflow = pt.partnerWithdrawal + pt.profitDistribution + pt.costingDeducted;

  return (
    <div className="bg-white border border-[#CBD8E6] rounded-lg px-3.5 py-2.5 shadow-md text-xs space-y-1.5 min-w-[235px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1">
        <span className="font-bold text-slate-900">{pt.monthLabel}</span>
        <span className="text-[11px] font-mono text-slate-500">
          {pt.entryCount} {pt.entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="font-semibold text-slate-700">Total Balance:</span>
        <span
          className={`font-bold ${
            pt.endingTotalBalance >= 0 ? 'text-[#1D6CE0]' : 'text-rose-700'
          }`}
        >
          {formatCurrency(pt.endingTotalBalance, currency)}
        </span>
      </div>

      <div className="space-y-0.5 pt-1 border-t border-slate-100 text-[11px] font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4 text-slate-600">
          <span>Partner Deposits (+):</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(pt.partnerDeposit, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-600">
          <span>Export &amp; Other Income (+):</span>
          <span className="font-semibold text-emerald-700">
            {formatCurrency(pt.incomeAdded, currency)}
          </span>
        </div>
        {pt.partnerWithdrawal > 0 && (
          <div className="flex items-center justify-between gap-4 text-slate-600">
            <span>Partner Withdrawals (&minus;):</span>
            <span className="font-semibold text-amber-700">
              {formatCurrency(pt.partnerWithdrawal, currency)}
            </span>
          </div>
        )}
        {pt.profitDistribution > 0 && (
          <div className="flex items-center justify-between gap-4 text-slate-600">
            <span>Profit Payouts (&minus;):</span>
            <span className="font-semibold text-violet-700">
              {formatCurrency(pt.profitDistribution, currency)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 text-slate-600">
          <span>All Costing (&minus;):</span>
          <span className="font-semibold text-rose-700">
            {formatCurrency(pt.costingDeducted, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-700 pt-0.5 border-t border-slate-100">
          <span className="font-semibold">Month Net ({totalInflow > 0 || totalOutflow > 0 ? 'Flow' : 'Idle'}):</span>
          <span
            className={`font-bold ${
              pt.monthlyNetChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {pt.monthlyNetChange >= 0 ? '+' : ''}
            {formatCurrency(pt.monthlyNetChange, currency)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const TotalBalanceTrendChartCard: React.FC<TotalBalanceTrendChartCardProps> = ({
  trend,
  currency,
}) => {
  const [showFlowOverlay, setShowFlowOverlay] = useState(false);

  const isPositiveGrowth = trend.netPeriodChange >= 0;

  return (
    <section
      data-testid="total-balance-trend-chart-card"
      aria-label="12-Month Total Balance Growth Trend"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#1D6CE0] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Total Balance Growth Trend (Last 12 Months)
            </h2>
            <p className="text-[11px] text-slate-500">
              Cumulative Total Balance trajectory from {trend.windowRangeLabel} · {trend.activeMonthsCount} active month(s)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="trend-toggle-flows-btn"
            aria-pressed={showFlowOverlay}
            onClick={() => setShowFlowOverlay((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-2 ${
              showFlowOverlay ? 'border-[#fbbf24]' : 'border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>{showFlowOverlay ? 'Hide Monthly Flows' : 'Overlay Monthly Flows'}</span>
          </button>
        </div>
      </div>

      {/* Compact 4-Metric Growth Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/70 border-b border-slate-200">
        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            Opening Balance (Prior)
          </div>
          <div
            data-testid="trend-opening-balance"
            className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-800 mt-0.5"
          >
            {formatCurrency(trend.openingBalance, currency)}
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            12-Month Net Growth
          </div>
          <div
            data-testid="trend-net-growth"
            className={`text-xs sm:text-sm font-bold font-mono tabular-nums mt-0.5 flex items-center gap-1.5 ${
              isPositiveGrowth ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isPositiveGrowth ? (
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {isPositiveGrowth ? '+' : ''}
              {formatCurrency(trend.netPeriodChange, currency)}
            </span>
            {trend.growthPercent !== null && (
              <span className="text-[11px] font-semibold">
                ({isPositiveGrowth ? '+' : ''}
                {trend.growthPercent.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            Peak Monthly Balance
          </div>
          <div
            data-testid="trend-peak-balance"
            className="text-xs sm:text-sm font-bold font-mono tabular-nums text-[#1D6CE0] mt-0.5"
          >
            {formatCurrency(trend.peakBalance, currency)}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            {trend.peakMonthLabel}
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            Current Total Balance
          </div>
          <div
            data-testid="trend-current-balance"
            className={`text-xs sm:text-sm font-bold font-mono tabular-nums mt-0.5 ${
              trend.currentBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(trend.currentBalance, currency)}
          </div>
        </div>
      </div>

      {/* Line Chart Area */}
      {!trend.hasAnyActivity ? (
        <div
          data-testid="total-balance-trend-empty"
          className="p-8 text-center space-y-2.5"
        >
          <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-slate-800">
            No 12-Month Balance History Recorded Yet
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Add a partner deposit share, record income, or save a costing deduction above to visualize your month-by-month Total Balance growth line over the last 12 months.
          </p>
        </div>
      ) : (
        <div className="p-4">
          <div
            data-testid="total-balance-trend-recharts-container"
            className="w-full h-[270px]"
          >
            <ResponsiveContainer width="100%" height={270}>
              <LineChart
                data={trend.points}
                margin={{ top: 14, right: 32, left: 10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="shortMonthLabel"
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  padding={{ left: 12, right: 16 }}
                  interval={0}
                />
                <YAxis
                  tickFormatter={formatCompactAxisTick}
                  tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  width={58}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                <Tooltip content={<BalanceTrendTooltip currency={currency} />} />
                <Legend
                  wrapperStyle={{
                    fontSize: '12px',
                    fontWeight: 600,
                    paddingTop: '8px',
                    color: '#334155',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="endingTotalBalance"
                  name={`Cumulative Total Balance (${currency})`}
                  stroke="#1D6CE0"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#1D6CE0', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#fbbf24', stroke: '#1e3247', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {showFlowOverlay && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="partnerDeposit"
                      name={`Monthly Partner Deposits (${currency})`}
                      stroke="#16A34A"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 2.5, fill: '#16A34A' }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="partnerWithdrawal"
                      name={`Partner Withdrawals (${currency})`}
                      stroke="#D97706"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 2.5, fill: '#D97706' }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="profitDistribution"
                      name={`Profit Payouts (${currency})`}
                      stroke="#7C3AED"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 2.5, fill: '#7C3AED' }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="costingDeducted"
                      name={`Monthly Costing Deducted (${currency})`}
                      stroke="#DC2626"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 2.5, fill: '#DC2626' }}
                      isAnimationActive={false}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
};
