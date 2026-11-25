import React, { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { OtherCostRecord } from '../types/index.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import { canUserDeleteRecords, canUserEditRecords } from '../utils/rbacPermissions.ts';
import {
  buildDailyExpenseCsv,
  buildMonthlyExpenseAggregateCsv,
  calculateDailyExpenseSummary,
  calculateMonthlyExpenseAggregate,
  calculateVisibleRowsScrollHeight,
  DAILY_EXPENSE_VISIBLE_ROWS,
  DAILY_EXPENSE_PAYMENT_METHODS,
  DailyExpenseScope,
  getTodayLocalIsoDate,
  mergeExpenseCategories,
  normalizeExpenseDateString,
  validateDailyExpenseInput,
} from '../utils/dailyExpense.ts';
import { exportDatasetFile } from '../utils/excelDataHandler.ts';
import {
  Plus,
  Printer,
  Download,
  Edit3,
  Trash2,
  Search,
  Calendar,
  ArrowLeft,
  X,
  Check,
  ReceiptText,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';
import { useTableColumnOrder } from '../hooks/useTableColumnOrder.ts';
import {
  ColumnReorderToolbar,
  ColumnDragGrip,
} from './ColumnReorderToolbar.tsx';

const DAILY_EXPENSE_DEFAULT_COLUMNS = [
  'date',
  'category',
  'particulars',
  'methodPayer',
  'amount',
] as const;

export const DailyExpenseView: React.FC = () => {
  const expenseColOrder = useTableColumnOrder(
    'daily_expense',
    DAILY_EXPENSE_DEFAULT_COLUMNS
  );
  const {
    otherCosts,
    addOtherCost,
    updateOtherCost,
    deleteOtherCost,
    companyProfile,
    dropdownOptions,
    currentUser,
    setActiveTab,
    exportCurrentViewToPdf,
    openDataCenterModal,
    showToast,
  } = useApp();

  const todayIso = getTodayLocalIsoDate();
  const canEdit = canUserEditRecords(currentUser);
  const canDelete = canUserDeleteRecords(currentUser);
  const currency = companyProfile.currency || 'TK';

  const categoryOptions = useMemo(
    () => mergeExpenseCategories(dropdownOptions.costingCategories, otherCosts),
    [dropdownOptions.costingCategories, otherCosts]
  );

  // Entry / Edit Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState<string>(todayIso);
  const [categoryInput, setCategoryInput] = useState<string>(
    () => categoryOptions[0] || 'Office Tea, Snacks & Pantry'
  );
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>('Cash');
  const [paidByInput, setPaidByInput] = useState<string>(
    () => currentUser?.displayName || ''
  );
  const [refInput, setRefInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Ledger Scope & Filtering State
  const [scope, setScope] = useState<DailyExpenseScope>('month');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayIso.slice(0, 7));
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Monthly Summary Aggregate Filter State
  const [monthlyYearFilter, setMonthlyYearFilter] = useState<string>('ALL');
  const [monthlyCategoryFilter, setMonthlyCategoryFilter] = useState<string>('ALL');
  const [monthlySearchQuery, setMonthlySearchQuery] = useState<string>('');

  const summary = useMemo(
    () =>
      calculateDailyExpenseSummary(otherCosts, {
        todayDate: todayIso,
        selectedDate,
        selectedMonth,
        scope,
        filterCategory,
        searchQuery,
      }),
    [otherCosts, todayIso, selectedDate, selectedMonth, scope, filterCategory, searchQuery]
  );

  const monthlyAggregate = useMemo(
    () =>
      calculateMonthlyExpenseAggregate(otherCosts, {
        yearFilter: monthlyYearFilter,
        categoryFilter: monthlyCategoryFilter,
        searchQuery: monthlySearchQuery,
      }),
    [otherCosts, monthlyYearFilter, monthlyCategoryFilter, monthlySearchQuery]
  );

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollMaxHeight, setTableScrollMaxHeight] = useState<number | null>(null);
  const isTableScrollable = summary.filteredExpenses.length > DAILY_EXPENSE_VISIBLE_ROWS;

  useLayoutEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return;

    const measureVisibleHeight = () => {
      if (summary.filteredExpenses.length <= DAILY_EXPENSE_VISIBLE_ROWS) {
        setTableScrollMaxHeight(null);
        return;
      }
      const table = container.querySelector('table');
      if (!table) return;
      const thead = table.querySelector('thead');
      const tfoot = table.querySelector('tfoot');
      const bodyRows = Array.from(table.querySelectorAll('tbody > tr'));
      const computedHeight = calculateVisibleRowsScrollHeight({
        headerHeight: thead ? thead.getBoundingClientRect().height : 0,
        rowHeights: bodyRows.map((row) => row.getBoundingClientRect().height),
        footerHeight: tfoot ? tfoot.getBoundingClientRect().height : 0,
        borderHeight: 2,
        maxVisibleRows: DAILY_EXPENSE_VISIBLE_ROWS,
      });
      setTableScrollMaxHeight(computedHeight);
    };

    measureVisibleHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measureVisibleHeight);
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, [summary.filteredExpenses, canEdit, canDelete]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setDateInput(selectedDate || todayIso);
    setCategoryInput(categoryOptions[0] || 'Office Tea, Snacks & Pantry');
    setCustomCategoryInput('');
    setAmountInput('');
    setPaymentMethodInput('Cash');
    setPaidByInput(currentUser?.displayName || '');
    setRefInput('');
    setDescriptionInput('');
    setFormError('');
  }, [selectedDate, todayIso, categoryOptions, currentUser?.displayName]);

  const handleStartEdit = (cost: OtherCostRecord) => {
    if (!canEdit) return;
    setEditingId(cost.id);
    setDateInput(normalizeExpenseDateString(cost.date) || todayIso);
    const matchesPreset = categoryOptions.some(
      (c) => c.toLowerCase() === (cost.category || '').trim().toLowerCase()
    );
    if (matchesPreset) {
      setCategoryInput(cost.category);
      setCustomCategoryInput('');
    } else {
      setCategoryInput('__custom__');
      setCustomCategoryInput(cost.category || '');
    }
    setAmountInput(String(cost.amount ?? ''));
    setPaymentMethodInput(cost.paymentMethod || 'Cash');
    setPaidByInput(cost.paidBy || '');
    setRefInput(cost.refInvoice || '');
    setDescriptionInput(cost.description || '');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setFormError('Your current account role has read-only permissions.');
      return;
    }

    const effectiveCategory =
      categoryInput === '__custom__' ? customCategoryInput : categoryInput;

    const validation = validateDailyExpenseInput({
      date: dateInput,
      category: effectiveCategory,
      amount: amountInput,
      description: descriptionInput,
    });

    if (!validation.valid) {
      setFormError(validation.error || 'Please check required expense fields.');
      return;
    }

    const payload: Omit<OtherCostRecord, 'id' | 'createdAt'> = {
      date: validation.normalizedDate,
      category: validation.normalizedCategory,
      amount: validation.normalizedAmount,
      description: validation.normalizedDescription,
      paymentMethod: paymentMethodInput.trim() || 'Cash',
      paidBy: paidByInput.trim() || undefined,
      refInvoice: refInput.trim() || undefined,
    };

    if (editingId) {
      updateOtherCost(editingId, payload);
      setEditingId(null);
      setAmountInput('');
      setRefInput('');
      setDescriptionInput('');
      setFormError('');
    } else {
      addOtherCost(payload);
      setSelectedDate(validation.normalizedDate);
      setSelectedMonth(validation.normalizedDate.slice(0, 7));
      setAmountInput('');
      setRefInput('');
      setDescriptionInput('');
      setFormError('');
    }
  };

  const handleExportCsv = () => {
    const csv = buildDailyExpenseCsv(summary.filteredExpenses, currency);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZSB_DAILY_EXPENSE_${scope.toUpperCase()}_${todayIso}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${summary.filteredExpenses.length} daily expense rows to CSV.`);
  };

  const handleExportExcel = () => {
    const filename = exportDatasetFile(
      'other_cost',
      'xlsx',
      summary.filteredExpenses,
      `ZSB_DAILY_EXPENSE_${scope.toUpperCase()}_${todayIso}.xlsx`
    );
    showToast(
      `Exported ${summary.filteredExpenses.length} daily expense row(s) to ${filename}.`
    );
  };

  const handleExportMonthlySummaryCsv = () => {
    const csv = buildMonthlyExpenseAggregateCsv(monthlyAggregate, currency);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const yearSuffix = monthlyYearFilter === 'ALL' ? 'ALL_YEARS' : monthlyYearFilter;
    a.download = `ZSB_MONTHLY_EXPENSE_SUMMARY_${yearSuffix}_${todayIso}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(
      `Exported ${monthlyAggregate.totalMonths} monthly summary row(s) to CSV.`
    );
  };

  const handleInspectMonthFromAggregate = (monthYm: string) => {
    setScope('month');
    setSelectedMonth(monthYm);
    setFilterCategory(monthlyCategoryFilter);
    setSearchQuery('');
  };

  return (
    <div
      data-testid="daily-expense-sheet"
      className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-5 text-slate-900"
    >
      {/* Top Sheet Header */}
      <section className="bg-[#273E56] text-white rounded-xl border border-[#385775] px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="min-w-0">
          <div className="text-xs font-mono text-sky-200 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Sheet 18</span>
            <span aria-hidden="true">·</span>
            <span>Company Operating &amp; Petty Cash Ledger</span>
            <span aria-hidden="true">·</span>
            <span>Synced to Profit &amp; Loss &amp; Total Balance</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            <ReceiptText className="w-5 h-5 text-amber-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              DAILY EXPENSE
            </h1>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Log daily office, utilities, staff conveyance, and operational company costs by date and category.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full">
          <button
            type="button"
            data-testid="daily-expense-back-dashboard-btn"
            onClick={() => setActiveTab('dashboard')}
            className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Dashboard</span>
          </button>

          {canEdit && (
            <button
              type="button"
              data-testid="daily-expense-import-excel-btn"
              onClick={() => openDataCenterModal('import', 'other_cost')}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 shrink-0" />
              <span>Import Excel</span>
            </button>
          )}

          <button
            type="button"
            data-testid="daily-expense-export-xlsx-btn"
            onClick={handleExportExcel}
            className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            data-testid="daily-expense-export-csv-btn"
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            data-testid="daily-expense-print-btn"
            onClick={() => exportCurrentViewToPdf({ openPreviewOnly: true })}
            className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>Print / PDF</span>
          </button>
        </div>
      </section>

      {/* 4-Metric KPI Summary Strip */}
      <section
        aria-label="Daily Expense Summary Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-2xs">
          <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
            <span>Today&apos;s Company Expense</span>
            <span className="font-mono">{formatDate(todayIso)}</span>
          </div>
          <div
            data-testid="daily-expense-today-total"
            className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1.5"
          >
            {formatCurrency(summary.todayTotal, currency)}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
            {summary.todayCount} {summary.todayCount === 1 ? 'Entry' : 'Entries'} Today
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-2xs">
          <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
            <span>Selected Month Spend</span>
            <span className="font-mono">{selectedMonth}</span>
          </div>
          <div
            data-testid="daily-expense-month-total"
            className="text-2xl font-black font-mono tabular-nums text-rose-700 mt-1.5"
          >
            {formatCurrency(summary.selectedMonthTotal, currency)}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
            {summary.selectedMonthCount} {summary.selectedMonthCount === 1 ? 'Entry' : 'Entries'} in Month
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-2xs">
          <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
            <span>Filtered Ledger Total</span>
            <span className="font-mono">
              {scope === 'day' ? 'Selected Day' : scope === 'month' ? 'Month View' : 'All Dates'}
            </span>
          </div>
          <div
            data-testid="daily-expense-filtered-total"
            className="text-2xl font-black font-mono tabular-nums text-[#1D6CE0] mt-1.5"
          >
            {formatCurrency(summary.filteredTotal, currency)}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
            {summary.filteredCount} Matching {summary.filteredCount === 1 ? 'Record' : 'Records'} · All-Time: {formatCurrency(summary.allTimeTotal, currency)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-2xs">
          <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
            <span>Top Expense Category</span>
            <span className="font-mono">Share</span>
          </div>
          <div
            data-testid="daily-expense-top-category"
            className="text-base font-bold text-slate-900 mt-1.5 truncate"
            title={summary.topCategory ? summary.topCategory.category : 'None yet'}
          >
            {summary.topCategory ? summary.topCategory.category : 'No entries in view'}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
            {summary.topCategory
              ? `${formatCurrency(summary.topCategory.totalAmount, currency)} (${summary.topCategory.sharePercent}%)`
              : 'Add a daily expense to analyze spend'}
          </div>
        </div>
      </section>

      {/* Main Workspace: Entry Form (340px) + Expense Ledger & Breakdown (minmax(0,1fr)) */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        {/* Left: Add / Edit Daily Company Expense Form */}
        <section
          aria-label="Daily Company Expense Entry Form"
          className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
        >
          <div className="px-4 py-3 bg-[#273E56] text-white flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold tracking-wide">
              {editingId ? 'Edit Daily Expense' : 'Record Daily Company Expense'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate className="p-4 space-y-3 text-xs">
            {formError && (
              <div
                role="alert"
                data-testid="daily-expense-form-error"
                className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-semibold"
              >
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="daily-expense-date"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Expense Date *
                </label>
                <input
                  id="daily-expense-date"
                  data-testid="daily-expense-date-input"
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 font-mono text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="daily-expense-amount"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Amount ({currency}) *
                </label>
                <input
                  id="daily-expense-amount"
                  data-testid="daily-expense-amount-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 font-mono font-bold text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="daily-expense-category"
                className="block font-semibold text-slate-700 mb-1"
              >
                Expense Category *
              </label>
              <select
                id="daily-expense-category"
                data-testid="daily-expense-category-select"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                disabled={!canEdit}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom__">+ Enter Custom Category...</option>
              </select>
            </div>

            {categoryInput === '__custom__' && (
              <div>
                <label
                  htmlFor="daily-expense-custom-category"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Custom Category Name *
                </label>
                <input
                  id="daily-expense-custom-category"
                  data-testid="daily-expense-custom-category-input"
                  type="text"
                  placeholder="e.g. Generator Diesel / Courier"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="daily-expense-description"
                className="block font-semibold text-slate-700 mb-1"
              >
                Particulars / Expense Details *
              </label>
              <input
                id="daily-expense-description"
                data-testid="daily-expense-description-input"
                type="text"
                placeholder="e.g. Office tea, electricity bill, staff fuel..."
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                disabled={!canEdit}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="daily-expense-method"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Payment Method
                </label>
                <select
                  id="daily-expense-method"
                  data-testid="daily-expense-method-select"
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
                >
                  {DAILY_EXPENSE_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="daily-expense-paid-by"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Paid By / Receiver
                </label>
                <input
                  id="daily-expense-paid-by"
                  data-testid="daily-expense-paidby-input"
                  type="text"
                  placeholder="Staff or payer name"
                  value={paidByInput}
                  onChange={(e) => setPaidByInput(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="daily-expense-ref"
                className="block font-semibold text-slate-700 mb-1"
              >
                Voucher / Slip No (Optional)
              </label>
              <input
                id="daily-expense-ref"
                data-testid="daily-expense-ref-input"
                type="text"
                placeholder="e.g. VCH-2026-019"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                disabled={!canEdit}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 font-mono text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              data-testid="daily-expense-submit-btn"
              disabled={!canEdit}
              className="w-full py-2.5 px-4 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {editingId ? <Check className="w-4 h-4 shrink-0" /> : <Plus className="w-4 h-4 shrink-0" />}
              <span>{editingId ? 'Update Expense' : 'Add Daily Expense'}</span>
            </button>

            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              Every daily expense automatically deducts from Net Profit (Sheet #08) and Total Balance (Sheet #17).
            </p>
          </form>
        </section>

        {/* Right: Daily Expense Ledger Table + Category Breakdown */}
        <section className="space-y-4 min-w-0">
          {/* Filter & Scope Bar */}
          <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Interactive Scope Selector */}
              <div
                role="group"
                aria-label="Expense Ledger Date Scope"
                className="flex items-center gap-1.5"
              >
                {(['day', 'month', 'all'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`daily-expense-scope-${mode}`}
                    aria-pressed={scope === mode}
                    onClick={() => setScope(mode)}
                    className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                      scope === mode ? 'ring-2 ring-[#273E56]' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {mode === 'day' ? 'Selected Day' : mode === 'month' ? 'Monthly View' : 'All Dates'}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {scope === 'day' && (
                  <label className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="date"
                      aria-label="Filter by Day"
                      data-testid="daily-expense-filter-day"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        if (e.target.value) setSelectedMonth(e.target.value.slice(0, 7));
                      }}
                      className="border border-slate-300 rounded-lg px-2 py-1 font-mono text-slate-900 bg-white"
                    />
                  </label>
                )}

                {scope === 'month' && (
                  <label className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="month"
                      aria-label="Filter by Month"
                      data-testid="daily-expense-filter-month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2 py-1 font-mono text-slate-900 bg-white"
                    />
                  </label>
                )}

                <select
                  aria-label="Filter by Expense Category"
                  data-testid="daily-expense-filter-category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white max-w-[200px]"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Search daily expenses"
                    data-testid="daily-expense-search-input"
                    placeholder="Search particulars, ref, payer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 bg-white w-48 sm:w-56 focus:border-[#1D6CE0] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <ColumnReorderToolbar
              tableId="daily_expense"
              isCustomized={expenseColOrder.isCustomized}
              onReset={expenseColOrder.resetOrder}
              className="mb-1.5"
            />

            {/* Ledger Table (10 rows visible per viewport, controlled by scroll) */}
            <div
              ref={tableScrollRef}
              tabIndex={isTableScrollable ? 0 : undefined}
              role={isTableScrollable ? 'region' : undefined}
              aria-label={
                isTableScrollable ? 'Daily company expenses scrollable ledger' : undefined
              }
              data-testid="daily-expense-table-scroll"
              style={
                isTableScrollable
                  ? ({
                      '--daily-expense-scroll-max-h': `${tableScrollMaxHeight ?? 470}px`,
                    } as React.CSSProperties)
                  : undefined
              }
              className={`overflow-x-auto border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D6CE0]/40 print:!max-h-none print:!overflow-visible ${
                isTableScrollable
                  ? 'overflow-y-auto max-h-[var(--daily-expense-scroll-max-h,470px)]'
                  : ''
              }`}
            >
              <table className="w-full text-xs border-collapse" data-testid="daily-expense-table">
                <thead className="sticky top-0 z-10 bg-[#273E56] shadow-2xs">
                  <tr className="bg-[#273E56] text-white text-left">
                    <th className="py-2.5 px-2 font-semibold text-center w-10 bg-[#273E56]">SL</th>
                    {expenseColOrder.columnOrder.map((colId) => {
                      const dragClass = expenseColOrder.getHeaderDragClassName(colId);
                      switch (colId) {
                        case 'date':
                          return (
                            <th key="date" {...expenseColOrder.getHeaderDragProps('date', 'DATE')} className={`py-2.5 px-2 font-semibold whitespace-nowrap bg-[#273E56] ${dragClass}`}>
                              <span className="inline-flex items-center gap-1"><ColumnDragGrip /><span>DATE</span></span>
                            </th>
                          );
                        case 'category':
                          return (
                            <th key="category" {...expenseColOrder.getHeaderDragProps('category', 'CATEGORY')} className={`py-2.5 px-2 font-semibold bg-[#273E56] ${dragClass}`}>
                              <span className="inline-flex items-center gap-1"><ColumnDragGrip /><span>CATEGORY</span></span>
                            </th>
                          );
                        case 'particulars':
                          return (
                            <th key="particulars" {...expenseColOrder.getHeaderDragProps('particulars', 'PARTICULARS')} className={`py-2.5 px-2 font-semibold bg-[#273E56] ${dragClass}`}>
                              <span className="inline-flex items-center gap-1"><ColumnDragGrip /><span>PARTICULARS</span></span>
                            </th>
                          );
                        case 'methodPayer':
                          return (
                            <th key="methodPayer" {...expenseColOrder.getHeaderDragProps('methodPayer', 'METHOD / PAYER')} className={`py-2.5 px-2 font-semibold bg-[#273E56] ${dragClass}`}>
                              <span className="inline-flex items-center gap-1"><ColumnDragGrip /><span>METHOD / PAYER</span></span>
                            </th>
                          );
                        case 'amount':
                          return (
                            <th key="amount" {...expenseColOrder.getHeaderDragProps('amount', `AMOUNT (${currency})`)} className={`py-2.5 px-2 font-semibold text-right whitespace-nowrap bg-[#273E56] ${dragClass}`}>
                              <span className="inline-flex items-center justify-end gap-1"><ColumnDragGrip /><span>AMOUNT ({currency})</span></span>
                            </th>
                          );
                        default:
                          return null;
                      }
                    })}
                    {(canEdit || canDelete) && (
                      <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap w-24 bg-[#273E56]">
                        ACTIONS
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {summary.filteredExpenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEdit || canDelete ? 7 : 6}
                        className="py-10 px-4 text-center text-slate-500"
                      >
                        <div className="font-semibold text-slate-700">
                          No daily company expenses found for this filter.
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Use the form on the left to record today&apos;s company expenses or switch to All Dates.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    summary.filteredExpenses.map((cost, idx) => (
                      <tr
                        key={cost.id}
                        data-testid={`daily-expense-row-${cost.id}`}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        {expenseColOrder.columnOrder.map((colId) => {
                          switch (colId) {
                            case 'date':
                              return (
                                <td key="date" className="py-2.5 px-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                  {formatDate(cost.date)}
                                </td>
                              );
                            case 'category':
                              return (
                                <td key="category" className="py-2.5 px-2 font-semibold text-slate-900">
                                  {cost.category}
                                </td>
                              );
                            case 'particulars':
                              return (
                                <td key="particulars" className="py-2.5 px-2 text-slate-700">
                                  <div>{cost.description}</div>
                                  {cost.refInvoice && (
                                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                      Ref: {cost.refInvoice}
                                    </div>
                                  )}
                                </td>
                              );
                            case 'methodPayer':
                              return (
                                <td key="methodPayer" className="py-2.5 px-2 text-slate-600">
                                  <span>{cost.paymentMethod || 'Cash'}</span>
                                  {cost.paidBy && (
                                    <span className="text-slate-400"> · {cost.paidBy}</span>
                                  )}
                                </td>
                              );
                            case 'amount':
                              return (
                                <td key="amount" className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                  {formatCurrency(cost.amount, currency)}
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                        {(canEdit || canDelete) && (
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {canEdit && (
                                <button
                                  type="button"
                                  data-testid={`edit-expense-${cost.id}`}
                                  title="Edit expense"
                                  aria-label={`Edit expense ${cost.description}`}
                                  onClick={() => handleStartEdit(cost)}
                                  className="p-1.5 rounded-full inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  data-testid={`delete-expense-${cost.id}`}
                                  title="Delete expense"
                                  aria-label={`Delete expense ${cost.description}`}
                                  onClick={() => deleteOtherCost(cost.id)}
                                  className="p-1.5 rounded-full inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                {summary.filteredExpenses.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-slate-100 shadow-[0_-1px_0_0_#cbd5e1]">
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td className="py-2.5 px-2 text-center uppercase text-[10px] bg-slate-100 whitespace-nowrap">
                        TOTAL
                      </td>
                      {expenseColOrder.columnOrder.map((colId) => {
                        if (colId === 'amount') {
                          return (
                            <td
                              key="amount"
                              data-testid="daily-expense-table-total"
                              className="py-2.5 px-2 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap bg-slate-100"
                            >
                              {formatCurrency(summary.filteredTotal, currency)}
                            </td>
                          );
                        }
                        if (colId === 'particulars') {
                          return (
                            <td key="particulars" className="py-2.5 px-2 uppercase text-[11px] bg-slate-100">
                              Grand Total ({summary.filteredCount}{' '}
                              {summary.filteredCount === 1 ? 'Entry' : 'Entries'})
                            </td>
                          );
                        }
                        return <td key={colId} className="bg-slate-100" />;
                      })}
                      {(canEdit || canDelete) && <td className="bg-slate-100" />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {isTableScrollable && (
              <div
                data-testid="daily-expense-scroll-hint"
                className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 pt-0.5 print:hidden"
              >
                <span>
                  Showing {DAILY_EXPENSE_VISIBLE_ROWS} rows per view · Scroll inside table to browse all {summary.filteredCount} entries
                </span>
              </div>
            )}
          </div>

          {/* Bottom Split: Category Breakdown + Day-by-Day Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Category Breakdown
              </h3>
              {summary.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400">No category spend in current filter.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {summary.categoryBreakdown.map((cat) => (
                    <div
                      key={cat.category}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{cat.category}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {cat.count} {cat.count === 1 ? 'entry' : 'entries'} · {cat.sharePercent}%
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                        {formatCurrency(cat.totalAmount, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Day-by-Day Totals ({selectedMonth})
              </h3>
              {summary.dailyGroupedTotals.length === 0 ? (
                <p className="text-xs text-slate-400">No daily expenses logged in {selectedMonth}.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                  {summary.dailyGroupedTotals.map((day) => (
                    <div
                      key={day.date}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div className="font-mono tabular-nums text-slate-800 font-semibold">
                        {formatDate(day.date)}
                        <span className="text-slate-400 font-normal">
                          {' '}· {day.count} {day.count === 1 ? 'entry' : 'entries'}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums font-bold text-rose-700">
                        {formatCurrency(day.totalAmount, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Monthly Summary Aggregate (Filters & Sums Expenses by Month) */}
          <section
            aria-label="Monthly Expense Summary Aggregate"
            data-testid="daily-expense-monthly-summary"
            className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#273E56] text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-wide">
                  Monthly Summary Aggregate
                </h3>
                <p className="text-[11px] text-sky-200 font-mono">
                  Filter and compare summed monthly company spending across months and categories
                </p>
              </div>
              <button
                type="button"
                data-testid="monthly-summary-export-csv-btn"
                onClick={handleExportMonthlySummaryCsv}
                disabled={monthlyAggregate.months.length === 0}
                className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Export Summary CSV</span>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter monthly summary by year"
                    data-testid="monthly-summary-year-filter"
                    value={monthlyYearFilter}
                    onChange={(e) => setMonthlyYearFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-semibold text-slate-900 bg-white focus:border-[#1D6CE0] focus:outline-none"
                  >
                    <option value="ALL">All Years</option>
                    {monthlyAggregate.availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Year {yr}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter monthly summary by category"
                    data-testid="monthly-summary-category-filter"
                    value={monthlyCategoryFilter}
                    onChange={(e) => setMonthlyCategoryFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-900 bg-white max-w-[220px] focus:border-[#1D6CE0] focus:outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  {(monthlyYearFilter !== 'ALL' ||
                    monthlyCategoryFilter !== 'ALL' ||
                    monthlySearchQuery.trim() !== '') && (
                    <button
                      type="button"
                      data-testid="monthly-summary-reset-filters-btn"
                      onClick={() => {
                        setMonthlyYearFilter('ALL');
                        setMonthlyCategoryFilter('ALL');
                        setMonthlySearchQuery('');
                      }}
                      className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Filter monthly summary by month or keyword"
                    data-testid="monthly-summary-search-input"
                    placeholder="Filter month, category, particulars..."
                    value={monthlySearchQuery}
                    onChange={(e) => setMonthlySearchQuery(e.target.value)}
                    className="border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 bg-white w-56 focus:border-[#1D6CE0] focus:outline-none"
                  />
                </div>
              </div>

              {/* Aggregate KPI Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Filtered Months Sum
                  </div>
                  <div
                    data-testid="monthly-summary-grand-total"
                    className="text-lg font-black font-mono tabular-nums text-[#1D6CE0] mt-0.5"
                  >
                    {formatCurrency(monthlyAggregate.grandTotal, currency)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {monthlyAggregate.totalMonths}{' '}
                    {monthlyAggregate.totalMonths === 1 ? 'Month' : 'Months'} ·{' '}
                    {monthlyAggregate.totalEntries}{' '}
                    {monthlyAggregate.totalEntries === 1 ? 'Entry' : 'Entries'}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Monthly Average Spend
                  </div>
                  <div
                    data-testid="monthly-summary-average"
                    className="text-lg font-black font-mono tabular-nums text-slate-900 mt-0.5"
                  >
                    {formatCurrency(monthlyAggregate.monthlyAverage, currency)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Per active month in filter
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Highest Spend Month
                  </div>
                  <div
                    data-testid="monthly-summary-highest"
                    className="text-sm font-bold text-rose-700 mt-0.5 truncate"
                  >
                    {monthlyAggregate.highestMonth
                      ? `${monthlyAggregate.highestMonth.monthLabel}`
                      : 'No data'}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-600">
                    {monthlyAggregate.highestMonth
                      ? `${formatCurrency(monthlyAggregate.highestMonth.totalAmount, currency)} (${monthlyAggregate.highestMonth.sharePercent}%)`
                      : 'Add expenses to compare months'}
                  </div>
                </div>
              </div>

              {/* Monthly Aggregate Table */}
              <div className="overflow-x-auto overflow-y-auto max-h-[380px] border border-slate-200 rounded-lg print:!max-h-none print:!overflow-visible">
                <table
                  className="w-full text-xs border-collapse"
                  data-testid="monthly-summary-table"
                >
                  <thead className="sticky top-0 z-10 bg-[#273E56]">
                    <tr className="bg-[#273E56] text-white text-left">
                      <th className="py-2 px-2 font-semibold whitespace-nowrap bg-[#273E56]">
                        MONTH
                      </th>
                      <th className="py-2 px-1.5 font-semibold text-center whitespace-nowrap bg-[#273E56]">
                        ENTRIES
                      </th>
                      <th className="py-2 px-2 font-semibold bg-[#273E56]">
                        TOP CATEGORY
                      </th>
                      <th className="py-2 px-1.5 font-semibold text-right whitespace-nowrap bg-[#273E56]">
                        SHARE
                      </th>
                      <th className="py-2 px-2 font-semibold text-right whitespace-nowrap bg-[#273E56]">
                        AVG / ENTRY
                      </th>
                      <th className="py-2 px-2 font-semibold text-right whitespace-nowrap bg-[#273E56]">
                        TOTAL ({currency})
                      </th>
                      <th className="py-2 px-2 font-semibold text-center whitespace-nowrap bg-[#273E56] print:hidden">
                        LEDGER
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {monthlyAggregate.months.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                          No monthly expenses match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      monthlyAggregate.months.map((row) => {
                        const isActiveMonth = scope === 'month' && selectedMonth === row.month;
                        return (
                          <tr
                            key={row.month}
                            data-testid={`monthly-summary-row-${row.month}`}
                            className={`transition-colors ${
                              isActiveMonth ? 'bg-sky-50/80' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-2 px-2 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{row.monthLabel}</div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {row.month}
                                {isActiveMonth ? ' · Active' : ''}
                              </div>
                            </td>
                            <td className="py-2 px-1.5 text-center font-mono tabular-nums text-slate-700 font-semibold">
                              {row.entryCount}
                            </td>
                            <td className="py-2 px-2 text-slate-700">
                              <div
                                className="font-medium text-slate-800 truncate max-w-[140px]"
                                title={row.topCategory || '-'}
                              >
                                {row.topCategory || '-'}
                              </div>
                              {row.topCategory && (
                                <div className="text-[11px] font-mono text-slate-500">
                                  {formatCurrency(row.topCategoryAmount, currency)}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-1.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {row.sharePercent}%
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {formatCurrency(row.averagePerEntry, currency)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(row.totalAmount, currency)}
                            </td>
                            <td className="py-2 px-2 text-center whitespace-nowrap print:hidden">
                              <button
                                type="button"
                                data-testid={`monthly-summary-inspect-${row.month}`}
                                onClick={() => handleInspectMonthFromAggregate(row.month)}
                                className="px-2 py-1 rounded-full text-[11px] font-bold cursor-pointer"
                              >
                                {isActiveMonth ? 'Viewing' : 'View'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {monthlyAggregate.months.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100 shadow-[0_-1px_0_0_#cbd5e1]">
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                        <td className="py-2 px-2 uppercase bg-slate-100 whitespace-nowrap">
                          Total ({monthlyAggregate.totalMonths}{' '}
                          {monthlyAggregate.totalMonths === 1 ? 'Month' : 'Months'})
                        </td>
                        <td className="py-2 px-1.5 text-center font-mono tabular-nums bg-slate-100">
                          {monthlyAggregate.totalEntries}
                        </td>
                        <td className="py-2 px-2 bg-slate-100" />
                        <td className="py-2 px-1.5 text-right font-mono tabular-nums bg-slate-100">
                          {monthlyAggregate.grandTotal > 0 ? '100%' : '0%'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums bg-slate-100 whitespace-nowrap">
                          {formatCurrency(
                            monthlyAggregate.totalEntries > 0
                              ? monthlyAggregate.grandTotal / monthlyAggregate.totalEntries
                              : 0,
                            currency
                          )}
                        </td>
                        <td
                          data-testid="monthly-summary-table-total"
                          className="py-2 px-2 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap bg-slate-100"
                        >
                          {formatCurrency(monthlyAggregate.grandTotal, currency)}
                        </td>
                        <td className="py-2 px-2 bg-slate-100 print:hidden" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
};
