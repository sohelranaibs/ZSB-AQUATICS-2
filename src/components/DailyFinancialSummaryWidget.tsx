import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ShoppingCart,
  CreditCard,
  Scale,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileText,
  Wallet,
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

  const summary = useMemo(
    () => calculateDailyFinancialSummary(purchases, payments, selectedDate),
    [purchases, payments, selectedDate]
  );

  const isViewingToday = selectedDate === todayIso;
  const hasActivityOnSelectedDate =
    summary.purchaseCount > 0 || summary.paymentCount > 0;

  return (
    <section
      aria-label="Daily Financial Summary"
      data-testid="daily-financial-summary-widget"
      className="bg-white rounded-xl shadow-xs border-2 border-emerald-400/80 overflow-hidden"
    >
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-5 py-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-xs">
            <Wallet className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Daily Financial Summary
              </h2>
              <span
                data-testid="daily-summary-active-date-badge"
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                  isViewingToday
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-amber-500 text-slate-950 border-amber-400'
                }`}
              >
                {isViewingToday
                  ? `TODAY · ${formatDate(summary.targetDate)}`
                  : `DATE · ${formatDate(summary.targetDate)}`}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-800 text-emerald-300 border border-slate-700">
                {summary.purchaseCount} Purchases · {summary.paymentCount} Payments
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Real-time daily calculation of total purchases and total payments from existing purchase &amp; payment records
            </p>
          </div>
        </div>

        {/* Date Picker & Quick Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 gap-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <label htmlFor="daily-summary-date-picker" className="text-[11px] font-bold text-slate-300 uppercase">
              Day:
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
              className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            data-testid="daily-summary-today-btn"
            onClick={() => setSelectedDate(todayIso)}
            disabled={isViewingToday}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap ${
              isViewingToday
                ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 cursor-pointer shadow-xs'
            }`}
            title="Reset to Current Day"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Current Day (Today)</span>
          </button>

          {!hasActivityOnSelectedDate &&
            summary.latestActivityDate &&
            summary.latestActivityDate !== selectedDate && (
              <button
                type="button"
                data-testid="daily-summary-latest-activity-btn"
                onClick={() => setSelectedDate(summary.latestActivityDate)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                title={`View most recent day with recorded transactions (${summary.latestActivityDate})`}
              >
                Latest Active: {formatDate(summary.latestActivityDate)}
              </button>
            )}

          <button
            type="button"
            data-testid="daily-summary-toggle-details-btn"
            onClick={() => setShowRecordsDetail((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>{showRecordsDetail ? 'Hide Daily Records' : 'View Daily Records'}</span>
            {showRecordsDetail ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main 4 KPI Cards Grid */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-emerald-50/30 to-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Total Purchases (Current Day) */}
          <div
            data-testid="daily-summary-purchases-card"
            className="bg-white rounded-xl p-4 border-2 border-sky-200 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-800">
                  Total Purchases ({isViewingToday ? 'Today' : formatDate(summary.targetDate)})
                </span>
                <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </span>
              </div>
              <div
                data-testid="daily-summary-total-purchases"
                className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-2"
              >
                {formatCurrency(summary.totalPurchases, currency)}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-mono text-slate-600">
                <span
                  data-testid="daily-summary-purchase-count"
                  className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-bold border border-sky-200"
                >
                  {summary.purchaseCount} {summary.purchaseCount === 1 ? 'Bill' : 'Bills'}
                </span>
                <span
                  data-testid="daily-summary-purchase-qty"
                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold"
                >
                  {summary.totalPurchaseQty.toLocaleString()} KG
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
              <span className="text-emerald-700 font-bold">
                Bill Paid: {formatCurrency(summary.totalPurchasePaid, currency)}
              </span>
              <span className="text-rose-700 font-bold">
                Bill Due: {formatCurrency(summary.totalPurchaseBalance, currency)}
              </span>
            </div>
          </div>

          {/* Card 2: Total Payments (Current Day) */}
          <div
            data-testid="daily-summary-payments-card"
            className="bg-white rounded-xl p-4 border-2 border-emerald-200 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                  Total Payments ({isViewingToday ? 'Today' : formatDate(summary.targetDate)})
                </span>
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div
                data-testid="daily-summary-total-payments"
                className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-2"
              >
                {formatCurrency(summary.totalPayments, currency)}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-mono text-slate-600">
                <span
                  data-testid="daily-summary-payment-count"
                  className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                >
                  {summary.paymentCount} {summary.paymentCount === 1 ? 'Payment' : 'Payments'}
                </span>
                <span className="text-slate-500">
                  Coverage: <strong className="text-slate-800">{summary.paymentCoverageRatio}%</strong>
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
              <span className="text-indigo-700 font-bold">
                Vouchers: {formatCurrency(summary.voucherPaymentsTotal, currency)}
              </span>
              {summary.directPurchasePaymentsTotal > 0 ? (
                <span className="text-teal-700 font-bold">
                  Direct: {formatCurrency(summary.directPurchasePaymentsTotal, currency)}
                </span>
              ) : (
                <span className="text-slate-500">Synced with Ledger</span>
              )}
            </div>
          </div>

          {/* Card 3: Supplier vs. Exporter Payments Breakdown */}
          <div
            data-testid="daily-summary-breakdown-card"
            className="bg-white rounded-xl p-4 border-2 border-indigo-200 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                  Daily Payment Breakdown
                </span>
                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 font-semibold">
                    Supplier ({summary.supplierPaymentCount}):
                  </span>
                  <span
                    data-testid="daily-summary-supplier-payments"
                    className="font-black text-indigo-800"
                  >
                    {formatCurrency(summary.supplierPaymentsTotal, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 font-semibold">
                    Exporter ({summary.exporterPaymentCount}):
                  </span>
                  <span
                    data-testid="daily-summary-exporter-payments"
                    className="font-black text-amber-800"
                  >
                    {formatCurrency(summary.exporterPaymentsTotal, currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
              {onNavigateTab && (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('payment_form')}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>+ Supplier Pay</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('exporter_payment_form')}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>+ Exporter Pay</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Card 4: Net Daily Position (Purchases - Payments) */}
          <div
            data-testid="daily-summary-net-card"
            className={`rounded-xl p-4 border-2 shadow-2xs flex flex-col justify-between ${
              summary.netDailyBalance > 0
                ? 'bg-rose-50/40 border-rose-200'
                : summary.netDailyBalance < 0
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-slate-50/60 border-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                  Net Daily Balance (Purchases − Payments)
                </span>
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    summary.netDailyBalance > 0
                      ? 'bg-rose-100 text-rose-700'
                      : summary.netDailyBalance < 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                </span>
              </div>

              <div
                data-testid="daily-summary-net-balance"
                className={`text-2xl font-black font-mono tabular-nums mt-2 ${
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

              <div className="mt-1.5">
                {summary.netDailyBalance > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <Clock className="w-3 h-3" />
                    <span>NET PAYABLE INCREASE TODAY</span>
                  </span>
                ) : summary.netDailyBalance < 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>NET DEBT REDUCTION TODAY</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-200 text-slate-800">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>FULLY BALANCED FOR DAY</span>
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span>Supplier Net Due:</span>
              <strong
                className={
                  summary.netSupplierPayableDelta > 0
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }
              >
                {formatCurrency(summary.netSupplierPayableDelta, currency)}
              </strong>
            </div>
          </div>
        </div>

        {/* Collapsible Daily Records Detail Panel */}
        {showRecordsDetail && (
          <div
            data-testid="daily-summary-records-detail"
            className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {/* Left: Daily Purchase Bills */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-sky-950 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Purchases on {formatDate(summary.targetDate)} ({summary.purchaseCount})
                  </span>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('purchase_form')}
                    className="text-[11px] font-bold text-sky-300 hover:text-white cursor-pointer"
                  >
                    + Add Purchase
                  </button>
                )}
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="p-2">Invoice #</th>
                      <th className="p-2">Supplier</th>
                      <th className="p-2 text-right">Qty (KG)</th>
                      <th className="p-2 text-right">Total (TK)</th>
                      <th className="p-2 text-right">Paid (TK)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {summary.dailyPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500">
                          No purchase records found for {formatDate(summary.targetDate)}.
                        </td>
                      </tr>
                    ) : (
                      summary.dailyPurchases.map((pur) => (
                        <tr key={pur.id} className="hover:bg-white transition">
                          <td className="p-2 font-mono font-bold text-sky-900">
                            {pur.invoiceNumber}
                          </td>
                          <td className="p-2 font-semibold text-slate-800">
                            {pur.description || '-'}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {(Number(pur.totalQty) || 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(pur.totalAmount, currency)}
                          </td>
                          <td className="p-2 text-right font-mono text-emerald-700 font-bold">
                            {formatCurrency(pur.paidAmount, currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Daily Payment Vouchers & Settlements */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-emerald-950 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Payments on {formatDate(summary.targetDate)} ({summary.paymentCount})
                  </span>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('payment_form')}
                    className="text-[11px] font-bold text-emerald-300 hover:text-white cursor-pointer"
                  >
                    + Add Payment
                  </button>
                )}
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="p-2">Voucher #</th>
                      <th className="p-2">Party / Account</th>
                      <th className="p-2">Category</th>
                      <th className="p-2 text-right">Paid Amount (TK)</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {summary.dailyPaymentBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500">
                          No payment records found for {formatDate(summary.targetDate)}.
                        </td>
                      </tr>
                    ) : (
                      summary.dailyPaymentBreakdown.map((pm) => (
                        <tr key={pm.id} className="hover:bg-white transition">
                          <td className="p-2 font-mono font-bold text-emerald-900">
                            {pm.invoiceNumber}
                          </td>
                          <td className="p-2 font-semibold text-slate-800">
                            {pm.partyName}
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                pm.category === 'exporter'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-indigo-100 text-indigo-900'
                              }`}
                            >
                              {pm.category}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-black text-emerald-700">
                            {formatCurrency(pm.amount, currency)}
                          </td>
                          <td className="p-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
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
          </div>
        )}
      </div>
    </section>
  );
};
