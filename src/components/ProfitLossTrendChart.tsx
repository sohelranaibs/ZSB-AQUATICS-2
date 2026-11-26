import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency } from '../utils/calculations.ts';
import {
  buildSixMonthProfitLossTrends,
  formatCompactCurrencyAxisTick,
} from '../utils/dashboardProfitLossChart.ts';
import { SvgCartesianChart } from './SvgCharts.tsx';
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

      {/* Area Chart Canvas */}
      <div className="p-4 sm:p-5">
        <div className="w-full h-[270px]" data-testid="pl-trend-recharts-container">
          <SvgCartesianChart
            data={trendSummary.points}
            xKey="monthLabel"
            height={270}
            leftTickFormatter={formatCompactCurrencyAxisTick}
            legendPosition="top"
            series={[
              {
                key: 'revenue',
                name: 'Monthly Revenue',
                type: 'area',
                color: '#0D9488',
                strokeWidth: 2.5,
                gradientTopOpacity: 0.32,
                gradientBottomOpacity: 0.03,
              },
              {
                key: 'costs',
                name: 'Monthly Costs',
                type: 'area',
                color: '#E11D48',
                strokeWidth: 2.25,
                gradientTopOpacity: 0.26,
                gradientBottomOpacity: 0.02,
              },
            ]}
            renderTooltip={(row) => {
              const net = Number(row?.netProfit) || 0;
              return (
                <div className="bg-white border border-slate-300 rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[200px]">
                  <div className="font-black text-[#273E56] border-b border-slate-200 pb-1">
                    {row.monthLabel}
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
        </div>
      </div>
    </section>
  );
};
