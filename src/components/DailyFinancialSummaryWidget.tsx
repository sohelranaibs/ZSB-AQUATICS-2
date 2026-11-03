import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ShoppingCart,
  CreditCard,
  Scale,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileText,
  Wallet,
  Building2,
  TrendingUp,
  TrendingDown,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { PurchaseRecord, PaymentRecord } from '../types/index.ts';
import { calculateDailyFinancialSummary } from '../utils/dailyFinancialSummary.ts';
import { toISODateString } from '../utils/dateFilters.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';

interface DailyFinancialSummaryWidgetProps {
  purchases: PurchaseRecord[];
  payments: PaymentRecord[];
  currency?: string;
  onNavigateTab?: (tab: string) => void;
}

export const DailyFinancialSummaryWidget: React.FC<DailyFinancialSummaryWidgetProps> = ({
  purchases,
  payments,
  currency = 'BDT',
  onNavigateTab,
}) => {
  const todayIso = useMemo(() => toISODateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [showRecordsDetail, setShowRecordsDetail] = useState<boolean>(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'all' | 'purchases' | 'payments'>('all');

  const summary = useMemo(
    () => calculateDailyFinancialSummary(purchases, payments, selectedDate),
    [purchases, payments, selectedDate]
  );

  const isViewingToday = selectedDate === todayIso;
  const hasActivityOnSelectedDate =
    summary.purchaseCount > 0 || summary.paymentCount > 0;

  // Step day helper to easily navigate previous / next days
  const handleStepDay = (deltaDays: number) => {
    const parts = selectedDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      dt.setDate(dt.getDate() + deltaDays);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${d}`);
    }
  };

  // Channel share percentages for visual bar
  const totalDailyPaymentSum = summary.totalPayments;
  const supplierPercent =
    totalDailyPaymentSum > 0
      ? Math.round((summary.supplierPaymentsTotal / totalDailyPaymentSum) * 100)
      : 0;
  const exporterPercent =
    totalDailyPaymentSum > 0
      ? Math.round((summary.exporterPaymentsTotal / totalDailyPaymentSum) * 100)
      : 0;

  // Purchase payment fulfillment ratio for the day
  const purchaseSettlementPercent =
    summary.totalPurchases > 0
      ? Math.min(100, Math.round((summary.totalPurchasePaid / summary.totalPurchases) * 100))
      : 0;

  return (
    <section
      aria-label="Daily Financial Summary"
      data-testid="daily-financial-summary-widget"
      className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden transition-all duration-200 h-full flex flex-col justify-between"
    >
      {/* Top Executive Command Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-4 sm:px-5 py-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Icon, Title & Active Date Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-inner">
                <Wallet className="w-4 h-4 text-emerald-300" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-slate-950"></span>
              </span>
            </div>

            <h2 className="text-sm sm:text-base font-black tracking-tight text-white whitespace-nowrap">
              Daily Financial Summary
            </h2>

            {/* Active Date Badge */}
            <span
              data-testid="daily-summary-active-date-badge"
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border tracking-wide transition shadow-xs whitespace-nowrap ${
                isViewingToday
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isViewingToday ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span>
                {isViewingToday
                  ? `TODAY · ${formatDate(summary.targetDate)}`
                  : `DATE · ${formatDate(summary.targetDate)}`}
              </span>
            </span>

            {/* Activity Counts Pill */}
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-800/90 text-slate-300 border border-slate-700/80 whitespace-nowrap">
              <span className="text-emerald-400 font-bold">{summary.purchaseCount}</span> Purchases ·{' '}
              <span className="text-teal-400 font-bold">{summary.paymentCount}</span> Payments
            </span>
          </div>

          {/* Right: Quick Date Control Suite */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Step navigation & Date picker */}
            <div className="inline-flex items-center bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-xl p-0.5 gap-0.5 shadow-inner transition">
              <button
                type="button"
                onClick={() => handleStepDay(-1)}
                className="w-6 h-6 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/80 flex items-center justify-center transition cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center px-1.5 gap-1">
                <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
                <label htmlFor="daily-summary-date-picker" className="sr-only">
                  Select Day
                </label>
                <input
                  id="daily-summary-date-picker"
                  data-testid="daily-summary-date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                    }
                  }}
                  className="bg-transparent text-[11px] font-mono font-bold text-white focus:outline-none cursor-pointer w-26 text-center"
                />
              </div>

              <button
                type="button"
                onClick={() => handleStepDay(1)}
                className="w-6 h-6 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/80 flex items-center justify-center transition cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Current Day / Today Reset Button */}
            <button
              type="button"
              data-testid="daily-summary-today-btn"
              onClick={() => setSelectedDate(todayIso)}
              disabled={isViewingToday}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 whitespace-nowrap ${
                isViewingToday
                  ? 'bg-slate-800/60 text-slate-500 border-slate-800/60 cursor-default'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400/90 cursor-pointer shadow-sm active:scale-95'
              }`}
              title="Reset to Current Day"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Today</span>
            </button>

            {/* Latest Active Activity Quick Jump Button */}
            {!hasActivityOnSelectedDate &&
              summary.latestActivityDate &&
              summary.latestActivityDate !== selectedDate && (
                <button
                  type="button"
                  data-testid="daily-summary-latest-activity-btn"
                  onClick={() => setSelectedDate(summary.latestActivityDate)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-[11px] font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-xs"
                  title={`View most recent day with recorded transactions (${summary.latestActivityDate})`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Latest: {formatDate(summary.latestActivityDate)}</span>
                </button>
              )}

            {/* View Records Toggle Button */}
            <button
              type="button"
              data-testid="daily-summary-toggle-details-btn"
              onClick={() => setShowRecordsDetail((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                showRecordsDetail
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                  : 'bg-slate-800 hover:bg-slate-700/90 text-slate-200 border-slate-700 shadow-xs'
              }`}
            >
              <FileText className="w-3 h-3 text-emerald-400" />
              <span>{showRecordsDetail ? 'Hide Records' : 'Daily Records'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-900 text-emerald-300 border border-slate-700">
                {summary.purchaseCount + summary.paymentCount}
              </span>
              {showRecordsDetail ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Box Content: All Financial Data Structured in 2 Clean Rows */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50/60 via-white to-white flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* ==================== ROW 1, COL 1: TOTAL PURCHASES ==================== */}
          <div
            data-testid="daily-summary-purchases-card"
            className="group relative bg-white rounded-xl px-4 py-3.5 border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600" />

            {/* Card Row 1: Title + Badges + Main Value */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-sky-900 truncate">
                      Total Purchases
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                      ({isViewingToday ? 'Today' : formatDate(summary.targetDate)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono">
                    <span
                      data-testid="daily-summary-purchase-count"
                      className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 font-bold border border-sky-200/80"
                    >
                      {summary.purchaseCount} {summary.purchaseCount === 1 ? 'Bill' : 'Bills'}
                    </span>
                    <span
                      data-testid="daily-summary-purchase-qty"
                      className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200/60"
                    >
                      {summary.totalPurchaseQty.toLocaleString()} KG
                    </span>
                  </div>
                </div>
              </div>

              <div
                data-testid="daily-summary-total-purchases"
                className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums tracking-tight text-right shrink-0"
              >
                {formatCurrency(summary.totalPurchases, currency)}
              </div>
            </div>

            {/* Card Row 2: Paid vs Due & Settlement Bar */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-3">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Paid: {formatCurrency(summary.totalPurchasePaid, currency)}</span>
                </span>
                <span className="text-rose-700 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Due: {formatCurrency(summary.totalPurchaseBalance, currency)}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:flex">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${purchaseSettlementPercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-600">
                  {purchaseSettlementPercent}% Settled
                </span>
              </div>
            </div>
          </div>

          {/* ==================== ROW 1, COL 2: TOTAL PAYMENTS ==================== */}
          <div
            data-testid="daily-summary-payments-card"
            className="group relative bg-white rounded-xl px-4 py-3.5 border border-slate-200/90 hover:border-emerald-300 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600" />

            {/* Card Row 1: Title + Badges + Main Value */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 truncate">
                      Total Payments
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                      ({isViewingToday ? 'Today' : formatDate(summary.targetDate)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono">
                    <span
                      data-testid="daily-summary-payment-count"
                      className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80"
                    >
                      {summary.paymentCount} {summary.paymentCount === 1 ? 'Payment' : 'Payments'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200/60">
                      Coverage: <strong className="text-slate-900">{summary.paymentCoverageRatio}%</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div
                data-testid="daily-summary-total-payments"
                className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tabular-nums tracking-tight text-right shrink-0"
              >
                {formatCurrency(summary.totalPayments, currency)}
              </div>
            </div>

            {/* Card Row 2: Vouchers vs Direct & Coverage Bar */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-3">
                <span className="text-indigo-700 font-bold">
                  Vouchers: {formatCurrency(summary.voucherPaymentsTotal, currency)}
                </span>
                {summary.directPurchasePaymentsTotal > 0 ? (
                  <span className="text-teal-700 font-bold">
                    Direct: {formatCurrency(summary.directPurchasePaymentsTotal, currency)}
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium">Synced with Ledger</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:flex">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, summary.paymentCoverageRatio)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-emerald-700">
                  {summary.paymentCoverageRatio}% Ratio
                </span>
              </div>
            </div>
          </div>

          {/* ==================== ROW 2, COL 1: PAYMENT CHANNELS BREAKDOWN ==================== */}
          <div
            data-testid="daily-summary-breakdown-card"
            className="group relative bg-white rounded-xl px-4 py-3.5 border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-400 via-indigo-500 to-purple-600" />

            {/* Card Row 1: Title + Quick Action Links */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950 block">
                    Daily Payment Breakdown
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Supplier ({supplierPercent}%) vs Exporter ({exporterPercent}%)
                  </span>
                </div>
              </div>

              {onNavigateTab && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('payment_form')}
                    className="text-[10px] font-bold text-indigo-700 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 px-2 py-1 rounded-lg transition inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>+ Supplier</span>
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('exporter_payment_form')}
                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 px-2 py-1 rounded-lg transition inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>+ Exporter</span>
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Card Row 2: Side-by-Side Supplier & Exporter Totals in One Horizontal Row */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                <span className="text-slate-700 font-semibold flex items-center gap-1 text-[11px]">
                  <Building2 className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Supplier ({summary.supplierPaymentCount})</span>
                </span>
                <span
                  data-testid="daily-summary-supplier-payments"
                  className="font-black text-indigo-900 text-[11px] sm:text-xs tabular-nums"
                >
                  {formatCurrency(summary.supplierPaymentsTotal, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50/60 border border-amber-100">
                <span className="text-slate-700 font-semibold flex items-center gap-1 text-[11px]">
                  <CreditCard className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Exporter ({summary.exporterPaymentCount})</span>
                </span>
                <span
                  data-testid="daily-summary-exporter-payments"
                  className="font-black text-amber-900 text-[11px] sm:text-xs tabular-nums"
                >
                  {formatCurrency(summary.exporterPaymentsTotal, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* ==================== ROW 2, COL 2: NET DAILY BALANCE ==================== */}
          <div
            data-testid="daily-summary-net-card"
            className={`group relative rounded-xl px-4 py-3.5 border shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden ${
              summary.netDailyBalance > 0
                ? 'bg-gradient-to-b from-rose-50/40 to-white border-rose-200/90 hover:border-rose-300'
                : summary.netDailyBalance < 0
                ? 'bg-gradient-to-b from-emerald-50/40 to-white border-emerald-200/90 hover:border-emerald-300'
                : 'bg-gradient-to-b from-slate-50/60 to-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div
              className={`absolute top-0 inset-x-0 h-1 ${
                summary.netDailyBalance > 0
                  ? 'bg-gradient-to-r from-rose-400 via-rose-500 to-red-600'
                  : summary.netDailyBalance < 0
                  ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600'
                  : 'bg-gradient-to-r from-slate-300 to-slate-400'
              }`}
            />

            {/* Card Row 1: Title + Status Badge + Main Net Balance */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    summary.netDailyBalance > 0
                      ? 'bg-rose-100/80 text-rose-700 border border-rose-200'
                      : summary.netDailyBalance < 0
                      ? 'bg-emerald-100/80 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 block truncate">
                    Net Daily Balance
                  </span>
                  <div className="mt-0.5">
                    {summary.netDailyBalance > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <TrendingUp className="w-2.5 h-2.5 text-rose-600" />
                        <span>NET PAYABLE INCREASE</span>
                      </span>
                    ) : summary.netDailyBalance < 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <TrendingDown className="w-2.5 h-2.5 text-emerald-600" />
                        <span>NET DEBT REDUCTION</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        <CheckCircle2 className="w-2.5 h-2.5 text-slate-600" />
                        <span>FULLY BALANCED</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                data-testid="daily-summary-net-balance"
                className={`text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight text-right shrink-0 ${
                  summary.netDailyBalance > 0
                    ? 'text-rose-700'
                    : summary.netDailyBalance < 0
                    ? 'text-emerald-700'
                    : 'text-slate-800'
                }`}
              >
                {summary.netDailyBalance > 0
                  ? `+${formatCurrency(summary.netDailyBalance, currency)}`
                  : summary.netDailyBalance < 0
                  ? `-${formatCurrency(Math.abs(summary.netDailyBalance), currency)}`
                  : formatCurrency(0, currency)}
              </div>
            </div>

            {/* Card Row 2: Formula & Supplier Net Due */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span className="text-slate-500">Purchases − Payments</span>
              <div>
                <span className="font-medium mr-1.5">Supplier Net Due:</span>
                <strong
                  className={`font-black ${
                    summary.netSupplierPayableDelta > 0
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {formatCurrency(summary.netSupplierPayableDelta, currency)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Daily Records Detail Panel */}
        {showRecordsDetail && (
          <div
            data-testid="daily-summary-records-detail"
            className="mt-5 pt-5 border-t border-slate-200/90"
          >
            {/* Sub-panel header & tab filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900">
                  Transaction Audit Ledger · {formatDate(summary.targetDate)}
                </h3>
              </div>

              {/* View filter buttons */}
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold font-mono">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    activeDetailTab === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({summary.purchaseCount + summary.paymentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('purchases')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    activeDetailTab === 'purchases'
                      ? 'bg-white text-sky-800 shadow-xs'
                      : 'text-slate-600 hover:text-sky-800'
                  }`}
                >
                  <ShoppingCart className="w-3 h-3" />
                  <span>Purchases ({summary.purchaseCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('payments')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    activeDetailTab === 'payments'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-emerald-800'
                  }`}
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Payments ({summary.paymentCount})</span>
                </button>
              </div>
            </div>

            {/* Split Grid for Ledger Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Purchase Bills */}
              {(activeDetailTab === 'all' || activeDetailTab === 'purchases') && (
                <div
                  className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between ${
                    activeDetailTab === 'purchases' ? 'lg:col-span-2' : ''
                  }`}
                >
                  <div>
                    <div className="bg-gradient-to-r from-sky-950 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-sky-900/50">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-sky-400" />
                        <span className="text-xs font-bold uppercase tracking-wide">
                          Purchases on {formatDate(summary.targetDate)} ({summary.purchaseCount})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-sky-300 font-bold hidden sm:inline">
                          Total: {formatCurrency(summary.totalPurchases, currency)}
                        </span>
                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('purchase_form')}
                            className="text-[11px] font-bold text-sky-300 hover:text-white cursor-pointer inline-flex items-center gap-0.5"
                          >
                            <span>+ Add Purchase</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-[11px] uppercase tracking-wider">
                            <th className="p-2.5 w-12 text-center">SL #</th>
                            <th className="p-2.5">Invoice #</th>
                            <th className="p-2.5">Supplier</th>
                            <th className="p-2.5 text-right">Qty (KG)</th>
                            <th className="p-2.5 text-right">Total ({currency})</th>
                            <th className="p-2.5 text-right">Paid ({currency})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {summary.dailyPurchases.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400">
                                <ShoppingCart className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                                <p className="font-medium">No purchase records found for {formatDate(summary.targetDate)}.</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Use the date switcher above to review previous activity.</p>
                              </td>
                            </tr>
                          ) : (
                            summary.dailyPurchases.map((pur, idx) => (
                              <tr key={pur.id} className="hover:bg-sky-50/30 transition">
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                                </td>
                                <td className="p-2.5 font-mono font-bold text-sky-900 whitespace-nowrap">
                                  {pur.invoiceNumber}
                                </td>
                                <td className="p-2.5 font-semibold text-slate-800">
                                  {pur.description || '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-700">
                                  {(Number(pur.totalQty) || 0).toLocaleString()}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {formatCurrency(pur.totalAmount, currency)}
                                </td>
                                <td className="p-2.5 text-right font-mono text-emerald-700 font-bold whitespace-nowrap">
                                  {formatCurrency(pur.paidAmount, currency)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {summary.dailyPurchases.length > 0 && (
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 font-semibold">
                        Daily Procurement Volume:
                      </span>
                      <span className="font-black text-slate-900">
                        {summary.totalPurchaseQty.toLocaleString()} KG · {formatCurrency(summary.totalPurchases, currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Right Column: Payment Vouchers & Direct Settlements */}
              {(activeDetailTab === 'all' || activeDetailTab === 'payments') && (
                <div
                  className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between ${
                    activeDetailTab === 'payments' ? 'lg:col-span-2' : ''
                  }`}
                >
                  <div>
                    <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-emerald-900/50">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wide">
                          Payments on {formatDate(summary.targetDate)} ({summary.paymentCount})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-emerald-300 font-bold hidden sm:inline">
                          Total: {formatCurrency(summary.totalPayments, currency)}
                        </span>
                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('payment_form')}
                            className="text-[11px] font-bold text-emerald-300 hover:text-white cursor-pointer inline-flex items-center gap-0.5"
                          >
                            <span>+ Add Payment</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-[11px] uppercase tracking-wider">
                            <th className="p-2.5 w-12 text-center">SL #</th>
                            <th className="p-2.5">Voucher #</th>
                            <th className="p-2.5">Party / Account</th>
                            <th className="p-2.5">Channel</th>
                            <th className="p-2.5 text-right">Amount ({currency})</th>
                            <th className="p-2.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {summary.dailyPaymentBreakdown.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400">
                                <CreditCard className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                                <p className="font-medium">No payment records found for {formatDate(summary.targetDate)}.</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Use the date switcher above to review previous activity.</p>
                              </td>
                            </tr>
                          ) : (
                            summary.dailyPaymentBreakdown.map((pm, idx) => (
                              <tr key={pm.id} className="hover:bg-emerald-50/30 transition">
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                                </td>
                                <td className="p-2.5 font-mono font-bold text-emerald-900 whitespace-nowrap">
                                  {pm.invoiceNumber}
                                </td>
                                <td className="p-2.5 font-semibold text-slate-800">
                                  {pm.partyName}
                                </td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      pm.category === 'exporter'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                        : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                    }`}
                                  >
                                    {pm.category}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                                  {formatCurrency(pm.amount, currency)}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    {pm.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {summary.dailyPaymentBreakdown.length > 0 && (
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 font-semibold">
                        Daily Disbursed Total:
                      </span>
                      <span className="font-black text-emerald-700">
                        {formatCurrency(summary.totalPayments, currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

