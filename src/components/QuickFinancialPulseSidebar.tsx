import React, { useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  ShoppingCart,
  CreditCard,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import type { PurchaseRecord, PaymentRecord } from '../types/index.ts';
import {
  PulsePresetKey,
  PULSE_PRESET_OPTIONS,
  VolumePeriodComparison,
  getPulsePresetDateRange,
  calculateQuickFinancialPulse,
} from '../utils/quickFinancialPulse.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';

interface QuickFinancialPulseSidebarProps {
  purchases: PurchaseRecord[];
  payments: PaymentRecord[];
  currency?: string;
}

const VolumeTrendArrowBadge: React.FC<{
  comparison: VolumePeriodComparison;
  currency: string;
  testId: string;
  label: string;
}> = ({ comparison, currency, testId, label }) => {
  const { direction, deltaPercent, previousVolume, deltaAmount } = comparison;

  if (direction === 'up') {
    return (
      <span
        data-testid={testId}
        data-trend-direction="up"
        title={`${label} increased by ${formatCurrency(deltaAmount, currency)} (+${deltaPercent}%) vs previous period (${formatCurrency(previousVolume, currency)})`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap"
      >
        <ArrowUpRight className="w-3 h-3 text-emerald-600 stroke-[2.75] shrink-0" />
        <span>▲ +{deltaPercent}%</span>
      </span>
    );
  }

  if (direction === 'down') {
    return (
      <span
        data-testid={testId}
        data-trend-direction="down"
        title={`${label} decreased by ${formatCurrency(Math.abs(deltaAmount), currency)} (${deltaPercent}%) vs previous period (${formatCurrency(previousVolume, currency)})`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap"
      >
        <ArrowDownRight className="w-3 h-3 text-rose-600 stroke-[2.75] shrink-0" />
        <span>▼ {deltaPercent}%</span>
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      data-trend-direction="flat"
      title={`${label} unchanged (0%) vs previous period (${formatCurrency(previousVolume, currency)})`}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700 border border-slate-300 whitespace-nowrap"
    >
      <Minus className="w-3 h-3 text-slate-500 shrink-0" />
      <span>0%</span>
    </span>
  );
};

export const QuickFinancialPulseSidebar: React.FC<QuickFinancialPulseSidebarProps> = ({
  purchases,
  payments,
  currency = 'BDT',
}) => {
  // Default to 'last_30_days' if there are records in the last 30 days, otherwise 'all_time'
  // so existing ledger records are immediately reflected in the trend summary.
  const initialRangeConfig = useMemo(() => {
    const r30 = getPulsePresetDateRange('last_30_days');
    const s30 = calculateQuickFinancialPulse(
      purchases,
      payments,
      r30.startDate,
      r30.endDate
    );
    if (s30.totalPurchaseCount > 0 || s30.totalPaymentCount > 0) {
      return {
        preset: 'last_30_days' as PulsePresetKey,
        startDate: r30.startDate,
        endDate: r30.endDate,
      };
    }
    return {
      preset: 'all_time' as PulsePresetKey,
      startDate: '',
      endDate: '',
    };
  }, []);

  const [activePreset, setActivePreset] = useState<PulsePresetKey>(
    initialRangeConfig.preset
  );
  const [startDate, setStartDate] = useState<string>(initialRangeConfig.startDate);
  const [endDate, setEndDate] = useState<string>(initialRangeConfig.endDate);

  const handleSelectPreset = (preset: Exclude<PulsePresetKey, 'custom'>) => {
    const range = getPulsePresetDateRange(preset);
    setActivePreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const summary = useMemo(
    () => calculateQuickFinancialPulse(purchases, payments, startDate, endDate),
    [purchases, payments, startDate, endDate]
  );

  const maxCombinedVolume = useMemo(() => {
    return Math.max(
      1,
      summary.totalPurchaseVolume,
      summary.totalPaymentVolume
    );
  }, [summary.totalPurchaseVolume, summary.totalPaymentVolume]);

  const maxDayVolume = useMemo(() => {
    let maxVal = 1;
    for (const d of summary.dailySeries) {
      if (d.purchaseVolume > maxVal) maxVal = d.purchaseVolume;
      if (d.paymentVolume > maxVal) maxVal = d.paymentVolume;
    }
    return maxVal;
  }, [summary.dailySeries]);

  const purchaseBarWidth = Math.min(
    100,
    Math.round((summary.totalPurchaseVolume / maxCombinedVolume) * 100)
  );
  const paymentBarWidth = Math.min(
    100,
    Math.round((summary.totalPaymentVolume / maxCombinedVolume) * 100)
  );

  return (
    <aside
      aria-label="Quick Financial Pulse"
      data-testid="quick-financial-pulse-sidebar"
      className="bg-white rounded-xl shadow-xs border-2 border-indigo-400/80 overflow-hidden flex flex-col justify-between h-full"
    >
      <div>
        {/* Sidebar Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3.5 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                  Quick Financial Pulse
                </h2>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Purchase vs. Payment Volume Trend Summary
                </p>
              </div>
            </div>

            <span
              data-testid="pulse-active-days-badge"
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 whitespace-nowrap"
            >
              {summary.activeDaysCount} Active {summary.activeDaysCount === 1 ? 'Day' : 'Days'}
            </span>
          </div>

          {/* Preset Date Range Pills */}
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {PULSE_PRESET_OPTIONS.map((opt) => {
              const isSelected = activePreset === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  data-testid={`pulse-preset-${opt.key}`}
                  onClick={() => handleSelectPreset(opt.key)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-2xs'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                  title={opt.label}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
            {(startDate || endDate) && (
              <button
                type="button"
                data-testid="pulse-reset-range-btn"
                onClick={() => handleSelectPreset('all_time')}
                className="px-2 py-1 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer inline-flex items-center gap-1 ml-auto"
                title="Reset to All Time"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Custom Start & End Date Inputs */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="flex items-center bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 gap-1.5">
              <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
              <label
                htmlFor="pulse-start-date"
                className="text-[10px] font-bold text-slate-400 uppercase shrink-0"
              >
                From:
              </label>
              <input
                id="pulse-start-date"
                data-testid="pulse-start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="bg-transparent text-[11px] font-mono font-bold text-white focus:outline-none w-full cursor-pointer"
              />
            </div>

            <div className="flex items-center bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 gap-1.5">
              <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
              <label
                htmlFor="pulse-end-date"
                className="text-[10px] font-bold text-slate-400 uppercase shrink-0"
              >
                To:
              </label>
              <input
                id="pulse-end-date"
                data-testid="pulse-end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="bg-transparent text-[11px] font-mono font-bold text-white focus:outline-none w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-3.5">
          {/* Generated Trend Summary Callout Box */}
          <div
            data-testid="pulse-trend-summary-box"
            className={`rounded-xl p-3 border ${
              summary.trendStatus === 'net_payable_growth'
                ? 'bg-amber-50/70 border-amber-200'
                : summary.trendStatus === 'net_settlement_surplus'
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {summary.trendStatus === 'net_payable_growth' ? (
                  <TrendingUp className="w-4 h-4 text-amber-700 shrink-0" />
                ) : summary.trendStatus === 'net_settlement_surplus' ? (
                  <TrendingDown className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0" />
                )}
                <span
                  data-testid="pulse-trend-headline"
                  className="text-xs font-black uppercase tracking-wide text-slate-900"
                >
                  {summary.trendHeadline}
                </span>
              </div>
              <span
                data-testid="pulse-settlement-ratio"
                className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-white border border-slate-200 text-indigo-900"
              >
                {summary.settlementRatioPercent}% Settled
              </span>
            </div>
            <p
              data-testid="pulse-trend-narrative"
              className="text-[11px] text-slate-700 mt-1.5 leading-relaxed"
            >
              {summary.trendSummaryText}
            </p>
          </div>

          {/* Volume Comparison Bars: Purchase Volume vs Payment Volume with Green/Red Trend Arrows */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
            {/* Purchase Volume Row */}
            <div>
              <div className="flex items-center justify-between gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-sky-900">
                  <ShoppingCart className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Purchase Volume ({summary.totalPurchaseCount})</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <VolumeTrendArrowBadge
                    comparison={summary.purchaseComparison}
                    currency={currency}
                    testId="pulse-purchase-trend-indicator"
                    label="Purchase Volume"
                  />
                  <span
                    data-testid="pulse-total-purchases"
                    className="font-mono font-black text-slate-900"
                  >
                    {formatCurrency(summary.totalPurchaseVolume, currency)}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-300"
                  style={{ width: `${purchaseBarWidth}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>
                  Prev Period: {formatCurrency(summary.purchaseComparison.previousVolume, currency)}
                </span>
                <span>Avg/Day: {formatCurrency(summary.avgDailyPurchaseVolume, currency)}</span>
              </div>
            </div>

            {/* Payment Volume Row */}
            <div>
              <div className="flex items-center justify-between gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Payment Volume ({summary.totalPaymentCount})</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <VolumeTrendArrowBadge
                    comparison={summary.paymentComparison}
                    currency={currency}
                    testId="pulse-payment-trend-indicator"
                    label="Payment Volume"
                  />
                  <span
                    data-testid="pulse-total-payments"
                    className="font-mono font-black text-emerald-700"
                  >
                    {formatCurrency(summary.totalPaymentVolume, currency)}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${paymentBarWidth}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>
                  Prev Period: {formatCurrency(summary.paymentComparison.previousVolume, currency)}
                </span>
                <span>Avg/Day: {formatCurrency(summary.avgDailyPaymentVolume, currency)}</span>
              </div>
            </div>

            {/* Net Volume Delta Footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-600 font-semibold">
                Net Volume Variance:
              </span>
              <span
                data-testid="pulse-net-delta"
                className={`font-black ${
                  summary.netVolumeDelta > 0
                    ? 'text-rose-700'
                    : summary.netVolumeDelta < 0
                    ? 'text-emerald-700'
                    : 'text-slate-800'
                }`}
              >
                {summary.netVolumeDelta > 0
                  ? `+${formatCurrency(summary.netVolumeDelta, currency)} Due`
                  : summary.netVolumeDelta < 0
                  ? `-${formatCurrency(Math.abs(summary.netVolumeDelta), currency)} Paid`
                  : formatCurrency(0, currency)}
              </span>
            </div>
          </div>

          {/* Daily Trend Spark-Bars */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wide">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Daily Volume Trend</span>
              </span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <span className="w-2 h-2 rounded-xs bg-sky-400 inline-block" />
                  Purchase
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <span className="w-2 h-2 rounded-xs bg-emerald-400 inline-block" />
                  Payment
                </span>
              </div>
            </div>

            <div
              data-testid="pulse-daily-trend-list"
              className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white p-2 space-y-1.5"
            >
              {summary.dailySeries.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No purchase or payment activity in this date range.
                </div>
              ) : (
                [...summary.dailySeries]
                  .reverse()
                  .slice(0, 10)
                  .map((day) => {
                    const pPct = Math.min(
                      100,
                      Math.round((day.purchaseVolume / maxDayVolume) * 100)
                    );
                    const pmPct = Math.min(
                      100,
                      Math.round((day.paymentVolume / maxDayVolume) * 100)
                    );
                    return (
                      <div
                        key={day.date}
                        data-testid={`pulse-day-row-${day.date}`}
                        className="py-1.5 px-1 text-[11px] font-mono space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">
                            {formatDate(day.date)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sky-700 font-bold">
                              P: {formatCurrency(day.purchaseVolume, currency)}
                            </span>
                            <span className="text-emerald-700 font-bold">
                              Pay: {formatCurrency(day.paymentVolume, currency)}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{ width: `${pPct}%` }}
                            />
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${pmPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
