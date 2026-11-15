import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
} from 'lucide-react';
import { OtherCostRecord, RecurringExpenseRecord } from '../types/index.ts';
import { formatCurrency, formatDate, getCurrentYearMonth } from '../utils/calculations.ts';
import {
  RECURRING_EXPENSE_PRESETS,
  calculateRecurringExpenseSummary,
  getRecurringRuleStatus,
  validateRecurringExpenseInput,
} from '../utils/recurringExpenses.ts';

interface RecurringExpensesCardProps {
  currency: string;
  costingCategories: string[];
  recurringExpenses: RecurringExpenseRecord[];
  otherCosts: OtherCostRecord[];
  onAddRecurringExpense: (
    record: Omit<RecurringExpenseRecord, 'id' | 'createdAt' | 'lastProcessedYearMonth'>
  ) => { id: string; autoDeductedCount: number };
  onToggleAutoDeduct: (ruleId: string) => void;
  onDeleteRecurringExpense: (ruleId: string) => void;
  onRunDueDeductions: () => number;
  onDeductNow: (ruleId: string) => boolean;
}

export const RecurringExpensesCard: React.FC<RecurringExpensesCardProps> = ({
  currency,
  costingCategories,
  recurringExpenses,
  otherCosts,
  onAddRecurringExpense,
  onToggleAutoDeduct,
  onDeleteRecurringExpense,
  onRunDueDeductions,
  onDeductNow,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYearMonth = getCurrentYearMonth();
  const defaultCategory =
    costingCategories.find((c) => c.toLowerCase().includes('office')) ||
    costingCategories[0] ||
    'Office & Overhead Expenses';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [amount, setAmount] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [startYearMonth, setStartYearMonth] = useState(currentYearMonth);
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const categoryOptions = useMemo(() => {
    const base = [...costingCategories];
    if (category && !base.includes(category)) {
      base.unshift(category);
    }
    return base.length > 0 ? base : ['Office & Overhead Expenses', 'Miscellaneous Expense'];
  }, [costingCategories, category]);

  const summary = useMemo(
    () => calculateRecurringExpenseSummary(recurringExpenses, otherCosts, todayStr),
    [recurringExpenses, otherCosts, todayStr]
  );

  const applyPreset = (presetId: string) => {
    const preset = RECURRING_EXPENSE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTitle(preset.title);
    if (categoryOptions.includes(preset.category)) {
      setCategory(preset.category);
    }
    setBillingDay(String(preset.defaultDay));
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateRecurringExpenseInput({
      title,
      category,
      amount,
      billingDay,
      startYearMonth,
    });
    if (
      !check.valid ||
      !check.cleanTitle ||
      !check.cleanCategory ||
      check.cleanAmount === undefined ||
      check.cleanBillingDay === undefined ||
      !check.cleanStartYearMonth
    ) {
      setFormError(check.error || 'Please check the recurring fixed expense fields.');
      return;
    }

    setFormError('');
    onAddRecurringExpense({
      title: check.cleanTitle,
      category: check.cleanCategory,
      amount: check.cleanAmount,
      billingDay: check.cleanBillingDay,
      startYearMonth: check.cleanStartYearMonth,
      autoDeduct,
      notes: notes.trim() || undefined,
    });
    setTitle('');
    setAmount('');
    setNotes('');
  };

  return (
    <section
      data-testid="recurring-expenses-card"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <Repeat className="w-4 h-4 text-[#1D6CE0] shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Recurring Expenses — Automated Monthly Fixed Costs
            </h2>
            <p className="text-[11px] text-slate-500">
              Define monthly fixed overhead (rent, internet, software, utilities) and automatically deduct due cycles from Total Balance
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="run-recurring-expenses-btn"
          onClick={() => onRunDueDeductions()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span>
            Run Auto-Deductions{summary.dueCycleCount > 0 ? ` (${summary.dueCycleCount})` : ''}
          </span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/70 border-b border-slate-200">
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Monthly Fixed Commitment</div>
          <div
            data-testid="recurring-monthly-commitment"
            className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900"
          >
            {formatCurrency(summary.monthlyFixedCommitment, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.activeRules} active · {summary.pausedRules} paused
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">This Month Deducted</div>
          <div
            data-testid="recurring-this-month-deducted"
            className="mt-1 text-base font-bold font-mono tabular-nums text-rose-700"
          >
            {summary.thisMonthDeducted > 0
              ? `−${formatCurrency(summary.thisMonthDeducted, currency)}`
              : formatCurrency(0, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
            Period: {currentYearMonth}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Total Auto-Deducted</div>
          <div
            data-testid="recurring-alltime-deducted"
            className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900"
          >
            {formatCurrency(summary.totalAutoDeductedAllTime, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Synced to Operating Cost &amp; P&amp;L</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Automation Status</div>
          <div className="mt-1 text-sm font-bold text-emerald-700 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span>
              {summary.dueCycleCount > 0
                ? `${summary.dueCycleCount} Due Cycle(s)`
                : summary.activeRules > 0
                ? 'Schedule Up to Date'
                : 'No Active Rules'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Idempotent monthly posting
          </div>
        </div>
      </div>

      {/* Form */}
      <form
        data-testid="recurring-expense-form"
        onSubmit={handleSubmit}
        className="p-4 space-y-3 border-b border-slate-200"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Presets:</span>
          {RECURRING_EXPENSE_PRESETS.map((preset) => {
            const isSelected = title.trim().toLowerCase() === preset.title.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`recurring-preset-${preset.id}`}
                aria-pressed={isSelected}
                onClick={() => applyPreset(preset.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer border-2 ${
                  isSelected ? 'border-[#fbbf24]' : 'border-transparent'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {formError && (
          <div
            role="alert"
            className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
          >
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label
              htmlFor="recurring-expense-title"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Fixed Expense Name
            </label>
            <input
              id="recurring-expense-title"
              data-testid="recurring-expense-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Office Rent, Fiber Internet, Cloud SaaS"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="recurring-expense-category"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Costing Category
            </label>
            <select
              id="recurring-expense-category"
              data-testid="recurring-expense-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="recurring-expense-amount"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Monthly Cost ({currency})
            </label>
            <input
              id="recurring-expense-amount"
              data-testid="recurring-expense-amount-input"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="recurring-expense-day"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Billing Day (1–31)
            </label>
            <input
              id="recurring-expense-day"
              data-testid="recurring-expense-day-input"
              type="number"
              min="1"
              max="31"
              step="1"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="recurring-expense-start-month"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Start Month
            </label>
            <input
              id="recurring-expense-start-month"
              data-testid="recurring-expense-start-month-input"
              type="month"
              value={startYearMonth}
              onChange={(e) => setStartYearMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <input
              type="text"
              data-testid="recurring-expense-notes-input"
              aria-label="Recurring expense vendor or notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional vendor, account ID, or payment notes..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            />

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="recurring-expense-autodeduct-checkbox"
                checked={autoDeduct}
                onChange={(e) => setAutoDeduct(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Automatically deduct from Total Balance when billing day arrives</span>
            </label>
          </div>

          <button
            type="submit"
            data-testid="save-recurring-expense-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Recurring Fixed Cost</span>
          </button>
        </div>
      </form>

      {/* Active Rules Table */}
      {recurringExpenses.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          No monthly recurring fixed expenses defined yet. Use a preset chip above or enter a fixed cost (Office Rent, Internet, Software Subscriptions) to automate monthly Total Balance deductions.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            data-testid="recurring-expenses-table"
            className="w-full text-xs text-left border-collapse"
          >
            <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Fixed Expense Rule</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Monthly Fixed Cost</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Billing Schedule</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Auto-Deduct</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recurringExpenses.map((rule) => {
                const status = getRecurringRuleStatus(rule, otherCosts, todayStr);
                return (
                  <tr
                    key={rule.id}
                    data-testid={`recurring-rule-row-${rule.id}`}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{rule.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {rule.notes ? `${rule.notes} · ` : ''}
                        {status.deductionCount} cycle(s) deducted (
                        {formatCurrency(status.totalDeductedAmount, currency)})
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-slate-700">{rule.category}</td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-rose-700 whitespace-nowrap">
                      &minus; {formatCurrency(rule.amount, currency)}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono text-slate-800 font-semibold">
                        Day {rule.billingDay} monthly · From {rule.startYearMonth}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {status.lastDeductedYearMonth
                          ? `Last paid: ${status.lastDeductedYearMonth}`
                          : 'Not yet deducted'}
                        {status.nextBillingDate
                          ? ` · Next: ${formatDate(status.nextBillingDate)}`
                          : ''}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        data-testid={`toggle-recurring-autodeduct-${rule.id}`}
                        aria-pressed={rule.autoDeduct}
                        onClick={() => onToggleAutoDeduct(rule.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {rule.autoDeduct ? (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Paused</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          data-testid={`deduct-recurring-now-${rule.id}`}
                          disabled={status.currentMonthPaid}
                          onClick={() => onDeductNow(rule.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {status.currentMonthPaid
                              ? `Paid ${currentYearMonth}`
                              : 'Deduct Now'}
                          </span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-recurring-expense-${rule.id}`}
                          onClick={() => onDeleteRecurringExpense(rule.id)}
                          aria-label={`Delete recurring expense ${rule.title}`}
                          title="Delete recurring expense rule"
                          className="inline-flex items-center justify-center p-1.5 rounded-lg cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
