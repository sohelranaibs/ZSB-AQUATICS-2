import React, { useMemo, useState } from 'react';
import { SvgDonutChart, SvgHorizontalBarChart } from './SvgCharts.tsx';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { formatCurrency } from '../utils/calculations.ts';
import {
  PartnerCapitalChartDatum,
  PartnerShareSummary,
  buildPartnerCapitalChartData,
  getUnfundedRegisteredPartners,
} from '../utils/totalBalance.ts';

interface PartnerCapitalChartCardProps {
  partnerShares: PartnerShareSummary[];
  partnerDirectory: string[];
  totalPartnerDeposit: number;
  currency: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: PartnerCapitalChartDatum }>;
  currency: string;
}

const CapitalTooltip: React.FC<CustomTooltipProps> = ({ active, payload, currency }) => {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div className="bg-white border border-[#CBD8E6] rounded-lg px-3 py-2 shadow-md text-xs space-y-1 min-w-[180px]">
      <div className="flex items-center gap-2 font-bold text-slate-900">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span className="truncate">{item.partnerName}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 font-mono tabular-nums">
        <span>Equity Share:</span>
        <span className="font-bold text-[#1D6CE0]">{item.sharePercent.toFixed(2)}%</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 font-mono tabular-nums">
        <span>Net Capital:</span>
        <span className="font-bold text-slate-900">
          {formatCurrency(item.netContribution, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-500 font-mono tabular-nums text-[11px]">
        <span>Deposited (+):</span>
        <span>{formatCurrency(item.totalDeposited, currency)}</span>
      </div>
      {item.totalWithdrawn > 0 && (
        <div className="flex items-center justify-between gap-4 text-rose-700 font-mono tabular-nums text-[11px]">
          <span>Withdrawn (&minus;):</span>
          <span>&minus;{formatCurrency(item.totalWithdrawn, currency)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px]">
        <span>Entries:</span>
        <span>
          {item.depositCount} dep{item.withdrawalCount > 0 ? ` · ${item.withdrawalCount} w/d` : ''}
        </span>
      </div>
    </div>
  );
};

export const PartnerCapitalChartCard: React.FC<PartnerCapitalChartCardProps> = ({
  partnerShares,
  partnerDirectory,
  totalPartnerDeposit,
  currency,
}) => {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');

  const chartData = useMemo(
    () => buildPartnerCapitalChartData(partnerShares),
    [partnerShares]
  );

  const unfundedPartners = useMemo(
    () => getUnfundedRegisteredPartners(partnerDirectory, partnerShares),
    [partnerDirectory, partnerShares]
  );

  return (
    <section
      data-testid="partner-capital-chart-card"
      aria-label="Partner Capital Structure Visualization"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Capital Structure (% Contribution)
          </h2>
          <p className="text-[11px] text-slate-500">
            Visual share of each partner in Total Partner Deposit Pool
          </p>
        </div>

        <div
          role="group"
          aria-label="Capital chart display mode"
          className="flex items-center gap-1.5 shrink-0"
        >
          <button
            type="button"
            data-testid="capital-chart-mode-donut"
            aria-pressed={chartType === 'donut'}
            onClick={() => setChartType('donut')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap border-2 ${
              chartType === 'donut' ? 'border-[#fbbf24]' : 'border-transparent'
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Donut</span>
          </button>
          <button
            type="button"
            data-testid="capital-chart-mode-bar"
            aria-pressed={chartType === 'bar'}
            onClick={() => setChartType('bar')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap border-2 ${
              chartType === 'bar' ? 'border-[#fbbf24]' : 'border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>Bar %</span>
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div
          data-testid="partner-capital-chart-empty"
          className="p-6 text-center space-y-3"
        >
          <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
            <PieChartIcon className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-800">
              No Capital Deposits Recorded Yet
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add a partner deposit share above to visualize each partner&apos;s percentage contribution to the company capital structure.
            </p>
          </div>
          {partnerDirectory.length > 0 && (
            <div className="pt-1 flex flex-wrap items-center justify-center gap-1.5">
              {partnerDirectory.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600"
                >
                  {name}: 0%
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div
            data-testid="partner-capital-recharts-container"
            className="relative w-full h-[240px]"
          >
            {chartType === 'donut' ? (
              <>
                <SvgDonutChart
                  data={chartData.map((entry) => ({
                    key: entry.partnerKey,
                    label: entry.partnerName,
                    value: entry.sharePercent,
                    color: entry.color,
                    datum: entry,
                  }))}
                  height={240}
                  innerRadius={64}
                  outerRadius={96}
                  renderTooltip={(slice) => (
                    <CapitalTooltip active payload={[{ payload: slice.datum }]} currency={currency} />
                  )}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total Capital
                  </span>
                  <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5 max-w-[118px] truncate">
                    {currency} {Math.round(totalPartnerDeposit).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    {chartData.length} Partner{chartData.length === 1 ? '' : 's'}
                  </span>
                </div>
              </>
            ) : (
              <SvgHorizontalBarChart
                data={chartData.map((entry) => ({
                  key: entry.partnerKey,
                  label: entry.shortName,
                  value: entry.sharePercent,
                  color: entry.color,
                  datum: entry,
                }))}
                height={240}
                maxValue={100}
                formatXTick={(val) => `${val}%`}
                formatBarLabel={(val) => `${val.toFixed(1)}%`}
                renderTooltip={(bar) => (
                  <CapitalTooltip active payload={[{ payload: bar.datum }]} currency={currency} />
                )}
              />
            )}
          </div>

          {/* Partner Percentage Contribution Legend Grid */}
          <div
            data-testid="partner-capital-chart-legend"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200"
          >
            {chartData.map((item) => (
              <div
                key={item.partnerKey}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200/80 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 leading-snug break-words">
                      {item.partnerName}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500">
                      {formatCurrency(item.netContribution, currency)}
                      {item.totalWithdrawn > 0 ? ' net' : ''}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold tabular-nums text-slate-900 shrink-0">
                  {item.sharePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          {unfundedPartners.length > 0 && (
            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
              <span className="font-semibold text-slate-600">Awaiting deposit (0%):</span>
              <span>{unfundedPartners.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
