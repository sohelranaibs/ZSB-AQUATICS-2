import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, getCurrentYearMonth } from '../utils/calculations.ts';
import {
  PARTNER_PAYMENT_METHODS,
  PartnerEquityRosterSummary,
  calculateMonthlyNetProfitForDistribution,
  calculateProfitDistributionAllocation,
  validateProfitDistributionInput,
} from '../utils/totalBalance.ts';
import {
  BalanceIncomeRecord,
  OtherCostRecord,
  PackingRecord,
  ProfitDistributionRecord,
  PurchaseRecord,
} from '../types/index.ts';

interface ProfitDistributionCardProps {
  currency: string;
  roster: PartnerEquityRosterSummary;
  packings: PackingRecord[];
  balanceIncomes: BalanceIncomeRecord[];
  purchases: PurchaseRecord[];
  otherCosts: OtherCostRecord[];
  profitDistributions: ProfitDistributionRecord[];
  onIssuePayout: (record: Omit<ProfitDistributionRecord, 'id' | 'createdAt'>) => string;
  onDeleteDistribution: (id: string) => void;
}

export const ProfitDistributionCard: React.FC<ProfitDistributionCardProps> = ({
  currency,
  roster,
  packings,
  balanceIncomes,
  purchases,
  otherCosts,
  profitDistributions,
  onIssuePayout,
  onDeleteDistribution,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultMonth = getCurrentYearMonth();

  const [targetYearMonth, setTargetYearMonth] = useState(defaultMonth);
  const [payoutDate, setPayoutDate] = useState(today);
  const [distributableInput, setDistributableInput] = useState('');
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>(PARTNER_PAYMENT_METHODS[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const monthlyBreakdown = useMemo(
    () =>
      calculateMonthlyNetProfitForDistribution({
        yearMonth: targetYearMonth,
        packings,
        balanceIncomes,
        purchases,
        otherCosts,
        profitDistributions,
      }),
    [targetYearMonth, packings, balanceIncomes, purchases, otherCosts, profitDistributions]
  );

  // Auto-populate the distributable amount whenever remaining monthly net profit changes,
  // unless the operator explicitly typed a custom pool amount.
  useEffect(() => {
    if (!hasManualOverride) {
      setDistributableInput(
        monthlyBreakdown.remainingDistributableProfit > 0
          ? monthlyBreakdown.remainingDistributableProfit.toFixed(2)
          : ''
      );
    }
  }, [hasManualOverride, monthlyBreakdown.remainingDistributableProfit]);

  const parsedPoolAmount = useMemo(() => {
    const val = Number(distributableInput);
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [distributableInput]);

  const allocationSummary = useMemo(
    () => calculateProfitDistributionAllocation(parsedPoolAmount, roster),
    [parsedPoolAmount, roster]
  );

  const totalIssuedAllTime = useMemo(
    () =>
      (profitDistributions || []).reduce(
        (sum, rec) => sum + Math.max(0, Number(rec.distributedAmount) || 0),
        0
      ),
    [profitDistributions]
  );

  const retainedAfterPayout = Math.max(
    0,
    Math.round(
      (monthlyBreakdown.remainingDistributableProfit - allocationSummary.totalAllocated) * 100
    ) / 100
  );

  const applyPoolRatio = (ratio: number) => {
    const targetVal =
      Math.round(monthlyBreakdown.remainingDistributableProfit * ratio * 100) / 100;
    setHasManualOverride(ratio !== 1);
    setDistributableInput(targetVal > 0 ? targetVal.toFixed(2) : '');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateProfitDistributionInput({
      targetYearMonth,
      payoutDate,
      totalAmount: distributableInput,
      allocations: allocationSummary.allocations,
    });

    if (!check.valid || check.cleanAmount === undefined) {
      setFormError(check.error || 'Please verify the distributable profit amount and partner equity.');
      return;
    }

    setFormError('');
    const distributedAmount = allocationSummary.totalAllocated || check.cleanAmount;
    const retainedAmount = Math.max(
      0,
      Math.round((monthlyBreakdown.netMonthlyProfit - monthlyBreakdown.alreadyDistributedForMonth - distributedAmount) * 100) / 100
    );

    onIssuePayout({
      targetYearMonth: targetYearMonth.trim(),
      payoutDate: payoutDate.trim(),
      calculatedNetProfit: monthlyBreakdown.netMonthlyProfit,
      distributedAmount,
      retainedAmount,
      paymentMethod: paymentMethod.trim() || PARTNER_PAYMENT_METHODS[0],
      referenceNo: referenceNo.trim() || undefined,
      notes: notes.trim() || undefined,
      allocations: allocationSummary.allocations
        .filter((a) => a.payoutAmount > 0 || a.equityPercent > 0)
        .map((a) => ({
          partnerName: a.partnerName,
          equityPercent: a.equityPercent,
          payoutAmount: a.payoutAmount,
        })),
    });

    setHasManualOverride(false);
    setReferenceNo('');
    setNotes('');
  };

  return (
    <section
      data-testid="profit-distribution-card"
      aria-label="Monthly Profit Distribution and Partner Payouts"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-[#16A34A] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Profit Distribution &amp; Equity Payout Tool
            </h2>
            <p className="text-[11px] text-slate-500">
              Calculates monthly net profit (Income &minus; Purchasing &amp; Operating Costing) and allocates payouts by live partner equity %
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span
            data-testid="profit-dist-total-paid-badge"
            className="font-bold text-slate-800"
          >
            Issued All-Time: {formatCurrency(totalIssuedAllTime, currency)}
          </span>
        </div>
      </div>

      {/* 4-Column Monthly Net Profit Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/70 border-b border-slate-200">
        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            Monthly Income (+)
          </div>
          <div
            data-testid="profit-dist-monthly-income"
            className="text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-700 mt-0.5"
          >
            {formatCurrency(monthlyBreakdown.totalMonthlyIncome, currency)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
            Export: {Math.round(monthlyBreakdown.exportRevenue).toLocaleString()} · Direct: {Math.round(monthlyBreakdown.directIncome).toLocaleString()}
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            Monthly Costing (&minus;)
          </div>
          <div
            data-testid="profit-dist-monthly-cost"
            className="text-xs sm:text-sm font-bold font-mono tabular-nums text-rose-700 mt-0.5"
          >
            {formatCurrency(monthlyBreakdown.totalMonthlyCost, currency)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
            Purchase: {Math.round(monthlyBreakdown.purchasingCost).toLocaleString()} · Ops: {Math.round(monthlyBreakdown.operatingCost).toLocaleString()}
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            Calculated Net Monthly Profit (=)
          </div>
          <div
            data-testid="profit-dist-net-monthly"
            className={`text-xs sm:text-sm font-bold font-mono tabular-nums mt-0.5 ${
              monthlyBreakdown.netMonthlyProfit >= 0 ? 'text-[#1D6CE0]' : 'text-rose-700'
            }`}
          >
            {formatCurrency(monthlyBreakdown.netMonthlyProfit, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {monthlyBreakdown.monthLabel}
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">
            Remaining Distributable Profit
          </div>
          <div
            data-testid="profit-dist-remaining"
            className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5"
          >
            {formatCurrency(monthlyBreakdown.remainingDistributableProfit, currency)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            Paid This Month: {formatCurrency(monthlyBreakdown.alreadyDistributedForMonth, currency)}
          </div>
        </div>
      </div>

      {/* Profit Distribution Calculation & Payout Form */}
      <form
        data-testid="profit-distribution-form"
        onSubmit={handleSubmit}
        className="p-4 space-y-4"
      >
        {formError && (
          <div
            role="alert"
            className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
          >
            {formError}
          </div>
        )}

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label
              htmlFor="profit-dist-month"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Profit Month
            </label>
            <input
              id="profit-dist-month"
              data-testid="profit-dist-month-input"
              type="month"
              value={targetYearMonth}
              onChange={(e) => {
                setTargetYearMonth(e.target.value);
                setHasManualOverride(false);
                setFormError('');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="profit-dist-date"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Payout Issue Date
            </label>
            <input
              id="profit-dist-date"
              data-testid="profit-dist-date-input"
              type="date"
              value={payoutDate}
              onChange={(e) => setPayoutDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label
                htmlFor="profit-dist-amount"
                className="block text-xs font-semibold text-slate-700"
              >
                Distributable Pool ({currency})
              </label>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { label: '100%', ratio: 1, id: '100' },
                  { label: '75%', ratio: 0.75, id: '75' },
                  { label: '50%', ratio: 0.5, id: '50' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`profit-dist-ratio-${preset.id}`}
                    onClick={() => applyPoolRatio(preset.ratio)}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="profit-dist-amount"
              data-testid="profit-dist-amount-input"
              type="number"
              min="0.01"
              step="0.01"
              value={distributableInput}
              onChange={(e) => {
                setHasManualOverride(true);
                setDistributableInput(e.target.value);
                setFormError('');
              }}
              placeholder="Auto-calculated net monthly profit"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="profit-dist-method"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Disbursement Method
            </label>
            <select
              id="profit-dist-method"
              data-testid="profit-dist-method-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            >
              {PARTNER_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="profit-dist-ref"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Voucher / Ref No.
            </label>
            <input
              id="profit-dist-ref"
              data-testid="profit-dist-ref-input"
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Optional slip ref"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            />
          </div>
        </div>

        {/* Partner Allocation Preview Table */}
        <div className="border border-[#CBD8E6] rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800">
              Partner Equity Payout Allocation Preview
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-600">
              {roster.fundedPartnerCount} active equity partner(s) · Retained in Balance: {formatCurrency(retainedAfterPayout, currency)}
            </span>
          </div>

          {allocationSummary.allocations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No registered partners found. Add partner shares above to calculate profit payouts.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                data-testid="profit-distribution-allocation-table"
                className="w-full text-xs text-left border-collapse"
              >
                <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Partner Name</th>
                    <th className="py-2 px-3 text-right">Net Capital ({currency})</th>
                    <th className="py-2 px-3 text-right">Current Equity %</th>
                    <th className="py-2 px-3 text-right">Allocated Payout ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allocationSummary.allocations.map((item) => {
                    const slug = item.partnerKey.replace(/[^a-z0-9]+/g, '-');
                    return (
                      <tr
                        key={item.partnerKey}
                        data-testid={`profit-alloc-row-${slug}`}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span>{item.partnerName}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatCurrency(item.netCapital, currency)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {item.equityPercent.toFixed(2)}%
                        </td>
                        <td
                          data-testid={`profit-alloc-amount-${slug}`}
                          className={`py-2 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            item.payoutAmount > 0 ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(item.payoutAmount, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-[#CBD8E6] font-bold">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 text-right text-slate-700">
                      Total Allocated Profit Payout:
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#1D6CE0]">
                      {roster.totalEquityPercent.toFixed(2)}%
                    </td>
                    <td
                      data-testid="profit-dist-allocation-total"
                      className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap"
                    >
                      {formatCurrency(allocationSummary.totalAllocated, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Notes + Primary Issue Payout Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="profit-dist-notes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Payout Notes / Resolution Memo
            </label>
            <input
              id="profit-dist-notes"
              data-testid="profit-dist-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`e.g. Monthly equity dividend settlement (${monthlyBreakdown.monthLabel})`}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            />
          </div>

          <button
            type="submit"
            data-testid="issue-profit-payout-btn"
            className="px-5 py-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Issue Payout</span>
          </button>
        </div>
      </form>

      {/* Issued Profit Payout History */}
      {profitDistributions.length > 0 && (
        <div className="border-t border-[#CBD8E6]">
          <div className="px-4 py-2.5 bg-[#F7FAFC] border-b border-[#CBD8E6] flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800">
              Issued Profit Distribution History
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              {profitDistributions.length} payout(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table
              data-testid="profit-distribution-history-table"
              className="w-full text-xs text-left border-collapse"
            >
              <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
                <tr>
                  <th className="py-2 px-3 whitespace-nowrap">Profit Month</th>
                  <th className="py-2 px-3 whitespace-nowrap">Payout Date</th>
                  <th className="py-2 px-3 whitespace-nowrap">Method &amp; Ref</th>
                  <th className="py-2 px-3">Partner Allocation Breakdown</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">Net Profit</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">Issued Payout</th>
                  <th className="py-2 px-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {profitDistributions.map((dist) => (
                  <tr key={dist.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {dist.targetYearMonth}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatDate(dist.payoutDate)}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      <div>{dist.paymentMethod || 'Bank Transfer'}</div>
                      {dist.referenceNo && (
                        <div className="text-[11px] font-mono text-slate-500">
                          Ref: {dist.referenceNo}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono tabular-nums">
                        {(dist.allocations || [])
                          .filter((a) => Number(a.payoutAmount) > 0)
                          .map((a) => (
                            <span key={a.partnerName}>
                              <strong className="font-sans text-slate-800">{a.partnerName}:</strong>{' '}
                              {formatCurrency(a.payoutAmount, currency)} ({a.equityPercent.toFixed(1)}%)
                            </span>
                          ))}
                      </div>
                      {dist.notes && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{dist.notes}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatCurrency(dist.calculatedNetProfit, currency)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-rose-700 whitespace-nowrap">
                      &minus;{formatCurrency(dist.distributedAmount, currency)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        data-testid={`delete-profit-dist-${dist.id}`}
                        onClick={() => onDeleteDistribution(dist.id)}
                        aria-label={`Delete profit distribution ${dist.targetYearMonth}`}
                        title="Delete profit distribution (Super Admin verification required)"
                        className="inline-flex items-center justify-center p-1.5 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
