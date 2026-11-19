import React, { useMemo } from 'react';
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';
import type {
  ActiveTab,
  PackingRecord,
  PaymentRecord,
  PurchaseRecord,
  SupplierCreditRecord,
} from '../types/index.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import { calculateDashboardQuickSummary } from '../utils/dashboardQuickSummary.ts';

interface DashboardQuickSummaryWidgetProps {
  purchases: PurchaseRecord[];
  payments: PaymentRecord[];
  packings: PackingRecord[];
  supplierCredits?: SupplierCreditRecord[];
  currency?: string;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const DashboardQuickSummaryWidget: React.FC<
  DashboardQuickSummaryWidgetProps
> = ({
  purchases,
  payments,
  packings,
  supplierCredits = [],
  currency = 'TK',
  onNavigateTab,
}) => {
  const summary = useMemo(
    () =>
      calculateDashboardQuickSummary({
        purchases,
        payments,
        packings,
        supplierCredits,
      }),
    [purchases, payments, packings, supplierCredits]
  );

  const formattedTargetDate = formatDate(summary.targetDate);

  return (
    <section
      aria-label="Quick Summary"
      data-testid="dashboard-quick-summary-widget"
      className="bg-white rounded-2xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Top Header Strip */}
      <div className="bg-[#273E56] text-white px-4 sm:px-5 py-2.5 border-b border-[#1E3247] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <h2 className="text-sm sm:text-base font-black tracking-tight text-white whitespace-nowrap">
            Quick Summary
          </h2>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span
            data-testid="quick-summary-date-label"
            className="font-mono text-sky-200 font-semibold whitespace-nowrap"
          >
            Daily-Updated Snapshot ({formattedTargetDate})
          </span>
          <span aria-hidden="true" className="text-slate-400 hidden sm:inline">
            ·
          </span>
          <span className="text-slate-300 hidden sm:inline whitespace-nowrap">
            Immediate Procurement &amp; Payable Visibility
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-200 font-mono tabular-nums shrink-0">
          <span>
            Today: <strong className="text-white">{summary.todayPurchaseBillsCount}</strong>{' '}
            {summary.todayPurchaseBillsCount === 1 ? 'Bill' : 'Bills'}
          </span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span>
            Pending:{' '}
            <strong className={summary.hasPendingPayments ? 'text-amber-300' : 'text-emerald-300'}>
              {summary.pendingPartiesCount}
            </strong>{' '}
            {summary.pendingPartiesCount === 1 ? 'Supplier' : 'Suppliers'}
          </span>
        </div>
      </div>

      {/* Two Daily-Updated Mini-Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E2E8F0]">
        {/* Mini-Card 1: Total Purchases Today */}
        <div
          data-testid="quick-summary-total-purchases-today"
          className="p-4 sm:p-5 flex flex-col justify-between gap-3 bg-gradient-to-b from-emerald-50/35 via-white to-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span>Total Purchases Today</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-700 font-bold">
                  {formattedTargetDate}
                </span>
              </div>
              <div
                data-testid="quick-summary-purchases-today-amount"
                className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums tracking-tight mt-1"
              >
                {formatCurrency(summary.totalPurchasesTodayAmount, currency)}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
                <span>
                  <strong className="text-slate-900">
                    {summary.todayPurchaseBillsCount}
                  </strong>{' '}
                  {summary.todayPurchaseBillsCount === 1 ? 'Bill' : 'Bills'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-slate-900">
                    {summary.todayPurchaseQtyKg.toLocaleString()}
                  </strong>{' '}
                  KG
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700">
                  Paid:{' '}
                  <strong>
                    {formatCurrency(summary.todayPurchasePaidAmount, currency)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-rose-700">
                  Due Today:{' '}
                  <strong>
                    {formatCurrency(summary.todayPurchaseUnpaidBalance, currency)}
                  </strong>
                </span>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
              {summary.todayPurchaseBillsCount > 0 ? (
                <span>
                  Settlement Coverage:{' '}
                  <strong className="text-slate-900">
                    {summary.todaySettlementPercent}%
                  </strong>{' '}
                  Settled Today
                </span>
              ) : (
                <span>
                  No purchase bills logged yet today
                  {summary.latestPurchaseDate
                    ? ` · Latest: ${formatDate(summary.latestPurchaseDate)}`
                    : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigateTab('purchase_form')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>+ Log Purchase</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('purchase_db')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Purchase DB</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-black" />
              </button>
            </div>
          </div>
        </div>

        {/* Mini-Card 2: Total Pending Payments */}
        <div
          data-testid="quick-summary-total-pending-payments"
          className="p-4 sm:p-5 flex flex-col justify-between gap-3 bg-gradient-to-b from-amber-50/35 via-white to-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span>Total Pending Payments</span>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-mono tabular-nums font-bold ${
                    summary.hasPendingPayments
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {summary.hasPendingPayments
                    ? `${summary.pendingPartiesCount} Pending ${
                        summary.pendingPartiesCount === 1 ? 'Account' : 'Accounts'
                      }`
                    : 'All Settled'}
                </span>
              </div>
              <div
                data-testid="quick-summary-pending-payments-amount"
                className={`text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight mt-1 ${
                  summary.hasPendingPayments ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {formatCurrency(summary.totalPendingPaymentsAmount, currency)}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
                <span>
                  Suppliers Due:{' '}
                  <strong className="text-slate-900">
                    {summary.suppliersWithDueCount}
                  </strong>{' '}
                  ({formatCurrency(summary.supplierPendingAmount, currency)})
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Today&apos;s Unpaid:{' '}
                  <strong className="text-rose-700">
                    {formatCurrency(summary.todayPendingPurchaseBalance, currency)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Unpaid Manifests:{' '}
                  <strong className="text-slate-900">
                    {summary.unpaidPackingCount}
                  </strong>
                </span>
              </div>
            </div>

            <div
              className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
                summary.hasPendingPayments ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              {summary.hasPendingPayments ? (
                <Clock className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
              {summary.hasPendingPayments ? (
                <span>
                  Outstanding payable across{' '}
                  <strong className="text-slate-900">
                    {summary.suppliersWithDueCount}
                  </strong>{' '}
                  supplier ledgers
                </span>
              ) : (
                <span>All supplier purchase bills &amp; vouchers are settled</span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigateTab('payment_form')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 hover:bg-amber-200 text-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Settle Due</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('payment_db')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Payment DB</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-black" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
