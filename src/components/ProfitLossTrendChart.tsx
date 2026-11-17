import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/calculations.ts';
import {
  buildSixMonthProfitLossTrends,
  formatCompactCurrencyAxisTick,
} from '../utils/dashboardProfitLossChart.ts';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ArrowUpRight } from 'lucide-react';

export const ProfitLossTrendChart: React.FC = () => {
  const {
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile,
    setActiveTab,
  } = useApp();

  const currency = companyProfile.currency || 'TK';

  const trendSummary = useMemo(
    () =>
      buildSixMonthProfitLossTrends(purchases, packings, payments, otherCosts, {
        rmbExchangeRate: companyProfile.rmbExchangeRate || 16.5,
        monthsToShow: 6,
      }),
    [purchases, packings, payments, otherCosts, companyProfile.rmbExchangeRate]
  );

  const isOverallPositive = trendSummary.totalNetProfit >= 0;

  return (
    <section
      aria-label="Profit and Loss 6-Month Trends Area Chart"
      data-testid="dashboard-profit-loss-trend-chart"
      className="bg-white rounded-xl shadow-xs border border-[#CBD8E6] overflow-hidden"
    >
      {/* Header Bar */}
      <div className="bg-[#273E56] text-white px-5 py-3.5 border-b border-[#1E3247] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-emerald-300 shrink-0" />
          <h2 className="text-sm font-bold tracking-wide text-white">
            Profit &amp; Loss Trends (Last 6 Months)
          </h2>
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-300 font-mono tabular-nums">
            {trendSummary.periodRangeLabel}
          </span>
        </div>

        <button
          type="button"
          data-testid="pl-trend-open-full-btn"
          onClick={() => setActiveTab('profit_loss')}
          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-[#1E3247] hover:bg-white/15 text-slate-100 border border-white/15 text-[11px] font-bold transition cursor-pointer self-start sm:self-auto"
        >
          <span>Open Full P&amp;L</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3-Metric Rollup Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/70 border-b border-slate-200">
        <div className="px-5 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            6-Month Revenue
          </div>
          <div
            data-testid="pl-trend-total-revenue"
            className="text-base sm:text-lg font-black text-teal-700 font-mono tabular-nums mt-0.5"
          >
            {formatCurrency(trendSummary.totalRevenue, currency)}
          </div>
        </div>
        <div className="px-5 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            6-Month Total Costs (Purchases + Operating)
          </div>
          <div
            data-testid="pl-trend-total-costs"
            className="text-base sm:text-lg font-black text-rose-700 font-mono tabular-nums mt-0.5"
          >
            {formatCurrency(trendSummary.totalCosts, currency)}
          </div>
        </div>
        <div className="px-5 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            6-Month Net Profit &amp; Margin
          </div>
          <div
            data-testid="pl-trend-net-profit"
            className={`text-base sm:text-lg font-black font-mono tabular-nums mt-0.5 ${
              isOverallPositive ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isOverallPositive ? '+' : ''}
            {formatCurrency(trendSummary.totalNetProfit, currency)}{' '}
            <span className="text-xs font-bold text-slate-500">
              ({trendSummary.overallMarginPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Area Chart Canvas */}
      <div className="p-4 sm:p-5">
        <div className="w-full h-[270px]" data-testid="pl-trend-recharts-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendSummary.points}
              margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="plAreaRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="plAreaCostsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E11D48" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="#E11D48" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCompactCurrencyAxisTick}
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const row = payload[0]?.payload;
                  const net = Number(row?.netProfit) || 0;
                  return (
                    <div className="bg-white border border-slate-300 rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[200px]">
                      <div className="font-black text-[#273E56] border-b border-slate-200 pb-1">
                        {label}
                      </div>
                      <div className="flex items-center justify-between gap-4 font-mono">
                        <span className="text-teal-700 font-bold">Monthly Revenue:</span>
                        <span className="font-black text-slate-900">
                          {formatCurrency(Number(row?.revenue) || 0, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-mono">
                        <span className="text-rose-700 font-bold">Monthly Costs:</span>
                        <span className="font-black text-slate-900">
                          {formatCurrency(Number(row?.costs) || 0, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-mono pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-600">Net P&amp;L:</span>
                        <span
                          className={`font-black ${
                            net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {net >= 0 ? '+' : ''}
                          {formatCurrency(net, currency)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                wrapperStyle={{ fontSize: '12px', fontWeight: 700 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Monthly Revenue"
                stroke="#0D9488"
                strokeWidth={2.5}
                fill="url(#plAreaRevenueGrad)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: '#0D9488' }}
              />
              <Area
                type="monotone"
                dataKey="costs"
                name="Monthly Costs"
                stroke="#E11D48"
                strokeWidth={2.25}
                fill="url(#plAreaCostsGrad)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: '#E11D48' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
