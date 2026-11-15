import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Landmark,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  ExternalDebtFrequency,
  ExternalDebtRecord,
  ExternalDebtRepayment,
} from '../types/index.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import { PARTNER_PAYMENT_METHODS } from '../utils/totalBalance.ts';
import {
  EXTERNAL_DEBT_CATEGORIES,
  EXTERNAL_DEBT_FREQUENCIES,
  EXTERNAL_DEBT_PRESETS,
  ExternalDebtOverallStatus,
  InstallmentStatus,
  addMonthsIso,
  calculateExternalDebtsSummary,
  generateExternalDebtSchedule,
  getFrequencyLabel,
  validateExternalDebtInput,
  validateExternalDebtRepaymentInput,
} from '../utils/externalDebts.ts';

interface ExternalDebtsCardProps {
  currency: string;
  externalDebts: ExternalDebtRecord[];
  onAddExternalDebt: (
    record: Omit<ExternalDebtRecord, 'id' | 'createdAt' | 'repayments'>
  ) => string;
  onRecordRepayment: (
    debtId: string,
    repayment: Omit<ExternalDebtRepayment, 'id' | 'createdAt'>
  ) => string;
  onDeleteRepayment: (debtId: string, repaymentId: string) => void;
  onDeleteExternalDebt: (debtId: string) => void;
}

function getDebtStatusBadgeClass(status: ExternalDebtOverallStatus): string {
  switch (status) {
    case 'SETTLED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'OVERDUE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'ACTIVE':
    default:
      return 'bg-sky-50 text-sky-800 border-sky-200';
  }
}

function getInstallmentBadgeClass(status: InstallmentStatus): string {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PARTIAL':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'OVERDUE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'DUE_SOON':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'UPCOMING':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function formatInstallmentStatusLabel(status: InstallmentStatus): string {
  if (status === 'DUE_SOON') return 'DUE SOON';
  return status;
}

export const ExternalDebtsCard: React.FC<ExternalDebtsCardProps> = ({
  currency,
  externalDebts,
  onAddExternalDebt,
  onRecordRepayment,
  onDeleteRepayment,
  onDeleteExternalDebt,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultFirstDue = addMonthsIso(todayStr, 1);

  // Add External Debt Form State
  const [title, setTitle] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [category, setCategory] = useState<string>(EXTERNAL_DEBT_CATEGORIES[0]);
  const [originationDate, setOriginationDate] = useState(todayStr);
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('0');
  const [frequency, setFrequency] = useState<ExternalDebtFrequency>('monthly');
  const [installmentCount, setInstallmentCount] = useState('6');
  const [firstDueDate, setFirstDueDate] = useState(defaultFirstDue);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Schedule Drawer & Custom Repayment Form State
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [repayDate, setRepayDate] = useState(todayStr);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<string>(PARTNER_PAYMENT_METHODS[0]);
  const [repayRef, setRepayRef] = useState('');
  const [repayNotes, setRepayNotes] = useState('');
  const [repayError, setRepayError] = useState('');

  const summary = useMemo(
    () => calculateExternalDebtsSummary(externalDebts, todayStr),
    [externalDebts, todayStr]
  );

  const schedulesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof generateExternalDebtSchedule>>();
    for (const debt of externalDebts) {
      map.set(debt.id, generateExternalDebtSchedule(debt, todayStr));
    }
    return map;
  }, [externalDebts, todayStr]);

  const sortedDebts = useMemo(
    () =>
      [...externalDebts].sort((a, b) => {
        const dateCmp = (b.originationDate || '').localeCompare(a.originationDate || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }),
    [externalDebts]
  );

  const expandedDebt = useMemo(
    () => externalDebts.find((d) => d.id === expandedDebtId) || null,
    [externalDebts, expandedDebtId]
  );
  const expandedSchedule = expandedDebt ? schedulesById.get(expandedDebt.id) || null : null;

  const previewObligation = useMemo(() => {
    const p = Math.max(0, Number(principalAmount) || 0);
    const i = Math.max(0, Number(interestAmount) || 0);
    return Math.round((p + i) * 100) / 100;
  }, [principalAmount, interestAmount]);

  const previewInstallmentCount =
    frequency === 'one_time' ? 1 : Math.max(1, Math.floor(Number(installmentCount) || 1));

  const applyPreset = (presetId: string) => {
    const preset = EXTERNAL_DEBT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTitle(preset.title);
    setCategory(preset.category);
    setFrequency(preset.frequency);
    setInstallmentCount(String(preset.defaultInstallments));
    setFormError('');
  };

  const handleSubmitDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateExternalDebtInput({
      title,
      lenderName,
      category,
      originationDate,
      principalAmount,
      interestAmount,
      frequency,
      installmentCount,
      firstDueDate,
    });
    if (
      !check.valid ||
      !check.cleanTitle ||
      !check.cleanLenderName ||
      !check.cleanCategory ||
      check.cleanPrincipal === undefined ||
      check.cleanInterest === undefined ||
      check.cleanInstallmentCount === undefined
    ) {
      setFormError(check.error || 'Please check all external debt details.');
      return;
    }

    setFormError('');
    const newId = onAddExternalDebt({
      title: check.cleanTitle,
      lenderName: check.cleanLenderName,
      category: check.cleanCategory,
      originationDate,
      principalAmount: check.cleanPrincipal,
      interestAmount: check.cleanInterest,
      frequency,
      installmentCount: check.cleanInstallmentCount,
      firstDueDate,
      referenceNo: referenceNo.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    setTitle('');
    setLenderName('');
    setPrincipalAmount('');
    setInterestAmount('0');
    setReferenceNo('');
    setNotes('');
    if (newId) {
      setExpandedDebtId(newId);
      setRepayAmount('');
      setRepayError('');
    }
  };

  const handleQuickPayNext = (debt: ExternalDebtRecord) => {
    const sched = schedulesById.get(debt.id);
    if (!sched?.nextDueInstallment) return;
    const nextInst = sched.nextDueInstallment;
    onRecordRepayment(debt.id, {
      date: todayStr,
      amount: nextInst.remainingAmount,
      paymentMethod: PARTNER_PAYMENT_METHODS[0],
      referenceNo: `${debt.referenceNo ? `${debt.referenceNo}-` : ''}INST-${nextInst.installmentNumber}`,
      notes: `Installment #${nextInst.installmentNumber}/${nextInst.totalInstallments} repayment`,
    });
  };

  const handlePayInstallment = (
    debt: ExternalDebtRecord,
    installmentNumber: number,
    totalInstallments: number,
    amountDue: number
  ) => {
    if (amountDue <= 0) return;
    setRepayError('');
    onRecordRepayment(debt.id, {
      date: todayStr,
      amount: amountDue,
      paymentMethod: PARTNER_PAYMENT_METHODS[0],
      referenceNo: `${debt.referenceNo ? `${debt.referenceNo}-` : ''}INST-${installmentNumber}`,
      notes: `Installment #${installmentNumber}/${totalInstallments} repayment`,
    });
  };

  const handleCustomRepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedDebt || !expandedSchedule) return;
    const check = validateExternalDebtRepaymentInput({
      date: repayDate,
      amount: repayAmount,
      remainingBalance: expandedSchedule.remainingBalance,
    });
    if (!check.valid || check.cleanAmount === undefined) {
      setRepayError(check.error || 'Invalid repayment amount.');
      return;
    }
    setRepayError('');
    onRecordRepayment(expandedDebt.id, {
      date: repayDate,
      amount: check.cleanAmount,
      paymentMethod: repayMethod.trim() || PARTNER_PAYMENT_METHODS[0],
      referenceNo: repayRef.trim() || undefined,
      notes: repayNotes.trim() || undefined,
    });
    setRepayAmount('');
    setRepayRef('');
    setRepayNotes('');
  };

  return (
    <section
      data-testid="external-debts-card"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <Landmark className="w-4 h-4 text-[#1D6CE0] shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              External Debts — Business Loans, Credit Lines &amp; Repayment Schedule
            </h2>
            <p className="text-[11px] text-slate-500">
              Track bank loans, supplier credits, and bridge financing with automatic deduction from Total Balance and installment repayment tracking
            </p>
          </div>
        </div>

        <div className="text-xs font-mono font-bold tabular-nums text-rose-700 shrink-0">
          {summary.totalObligation > 0
            ? `Deducted: −${formatCurrency(summary.totalObligation, currency)}`
            : 'No External Debt'}
        </div>
      </div>

      {/* 4-Metric KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/70 border-b border-slate-200">
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">
            Total Debt Taken (Deducted)
          </div>
          <div
            data-testid="external-debt-total-obligation"
            className="mt-1 text-base font-bold font-mono tabular-nums text-rose-700"
          >
            {summary.totalObligation > 0
              ? `−${formatCurrency(summary.totalObligation, currency)}`
              : formatCurrency(0, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {summary.totalCount} Loan(s) · Principal {formatCurrency(summary.totalPrincipal, currency)}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Remaining Unpaid Debt</div>
          <div
            data-testid="external-debt-total-remaining"
            className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900"
          >
            {formatCurrency(summary.totalRemaining, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.activeCount} active · {summary.settledCount} settled
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Total Repaid</div>
          <div
            data-testid="external-debt-total-paid"
            className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-700"
          >
            {formatCurrency(summary.totalPaid, currency)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${Math.min(100, summary.overallProgressPercent)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-600">
              {summary.overallProgressPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">
            Next Scheduled Installment
          </div>
          <div
            data-testid="external-debt-next-due"
            className={`mt-1 text-sm font-bold flex items-center gap-1.5 ${
              summary.nextDue?.isOverdue
                ? 'text-rose-700'
                : summary.nextDue
                ? 'text-slate-900'
                : 'text-emerald-700'
            }`}
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span className="font-mono tabular-nums truncate">
              {summary.nextDue
                ? formatCurrency(summary.nextDue.remainingAmount, currency)
                : summary.totalCount > 0
                ? 'All Settled'
                : 'No Schedule'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {summary.nextDue
              ? `${summary.nextDue.debtTitle} · #${summary.nextDue.installmentNumber} due ${formatDate(summary.nextDue.dueDate)}${
                  summary.overdueInstallmentCount > 0
                    ? ` (${summary.overdueInstallmentCount} overdue)`
                    : ''
                }`
              : 'Schedule installments auto-computed'}
          </div>
        </div>
      </div>

      {/* Form */}
      <form
        data-testid="external-debt-form"
        onSubmit={handleSubmitDebt}
        className="p-4 space-y-3 border-b border-slate-200"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Loan Presets:</span>
          {EXTERNAL_DEBT_PRESETS.map((preset) => {
            const isSelected = title.trim().toLowerCase() === preset.title.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`external-debt-preset-${preset.id}`}
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
            data-testid="external-debt-form-error"
            className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
          >
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label
              htmlFor="external-debt-title"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Loan / Credit Title
            </label>
            <input
              id="external-debt-title"
              data-testid="external-debt-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Working Capital Loan, Supplier Credit Line"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="external-debt-lender"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Lender / Creditor
            </label>
            <input
              id="external-debt-lender"
              data-testid="external-debt-lender-input"
              type="text"
              value={lenderName}
              onChange={(e) => setLenderName(e.target.value)}
              placeholder="e.g. Prime Bank, Sundarbans Cargo"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="external-debt-category"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Credit Category
            </label>
            <select
              id="external-debt-category"
              data-testid="external-debt-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            >
              {EXTERNAL_DEBT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="external-debt-origination"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Origination Date
            </label>
            <input
              id="external-debt-origination"
              data-testid="external-debt-origination-input"
              type="date"
              value={originationDate}
              onChange={(e) => setOriginationDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="external-debt-principal"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Principal ({currency})
            </label>
            <input
              id="external-debt-principal"
              data-testid="external-debt-principal-input"
              type="number"
              min="0.01"
              step="0.01"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(e.target.value)}
              placeholder="e.g. 200000"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label
              htmlFor="external-debt-interest"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Interest / Fee ({currency})
            </label>
            <input
              id="external-debt-interest"
              data-testid="external-debt-interest-input"
              type="number"
              min="0"
              step="0.01"
              value={interestAmount}
              onChange={(e) => setInterestAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
            />
          </div>

          <div>
            <label
              htmlFor="external-debt-frequency"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Repayment Frequency
            </label>
            <select
              id="external-debt-frequency"
              data-testid="external-debt-frequency-select"
              value={frequency}
              onChange={(e) => {
                const nextFreq = e.target.value as ExternalDebtFrequency;
                setFrequency(nextFreq);
                if (nextFreq === 'one_time') {
                  setInstallmentCount('1');
                }
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            >
              {EXTERNAL_DEBT_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="external-debt-installments"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Installments (1–120)
            </label>
            <input
              id="external-debt-installments"
              data-testid="external-debt-installments-input"
              type="number"
              min="1"
              max="120"
              step="1"
              disabled={frequency === 'one_time'}
              value={frequency === 'one_time' ? '1' : installmentCount}
              onChange={(e) => setInstallmentCount(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0] disabled:bg-slate-100"
              required
            />
          </div>

          <div>
            <label
              htmlFor="external-debt-first-due"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              First Due Date
            </label>
            <input
              id="external-debt-first-due"
              data-testid="external-debt-first-due-input"
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="external-debt-ref"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Loan / Voucher Ref
            </label>
            <input
              id="external-debt-ref"
              data-testid="external-debt-ref-input"
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. LN-2026-04"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
            />
          </div>

          <div>
            <label
              htmlFor="external-debt-notes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Terms / Notes
            </label>
            <input
              id="external-debt-notes"
              data-testid="external-debt-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Collateral or agreement notes..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-600 font-mono tabular-nums">
            Total Balance Deduction:{' '}
            <span className="font-bold text-rose-700">
              {previewObligation > 0
                ? `−${formatCurrency(previewObligation, currency)}`
                : formatCurrency(0, currency)}
            </span>
            {previewObligation > 0 && (
              <span className="text-slate-500">
                {' '}
                · {previewInstallmentCount}x {getFrequencyLabel(frequency)} (~
                {formatCurrency(previewObligation / previewInstallmentCount, currency)} / installment)
              </span>
            )}
          </div>

          <button
            type="submit"
            data-testid="save-external-debt-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Record External Debt (Deduct from Total Balance)</span>
          </button>
        </div>
      </form>

      {/* External Debts Summary Table */}
      {sortedDebts.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          No external business loans or credit facilities recorded yet. Record a loan or credit line above to automatically deduct it from Total Balance and generate its installment repayment schedule.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            data-testid="external-debts-table"
            className="w-full text-xs text-left border-collapse"
          >
            <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Loan / Creditor</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Obligation (&minus; {currency})
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Repaid</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Remaining</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Schedule &amp; Next Due</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedDebts.map((debt) => {
                const sched = schedulesById.get(debt.id)!;
                const isExpanded = expandedDebtId === debt.id;
                return (
                  <tr
                    key={debt.id}
                    data-testid={`external-debt-row-${debt.id}`}
                    className={`hover:bg-slate-50/70 ${isExpanded ? 'bg-sky-50/40' : ''}`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{debt.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {debt.lenderName} · {debt.category} · {formatDate(debt.originationDate)}
                        {debt.referenceNo ? ` · Ref: ${debt.referenceNo}` : ''}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide ${getDebtStatusBadgeClass(
                          sched.debtStatus
                        )}`}
                      >
                        {sched.debtStatus}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="font-mono font-bold tabular-nums text-rose-700">
                        &minus; {formatCurrency(sched.totalObligation, currency)}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-500">
                        P: {Math.round(sched.principalAmount).toLocaleString()}
                        {sched.interestAmount > 0
                          ? ` + I: ${Math.round(sched.interestAmount).toLocaleString()}`
                          : ''}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="font-mono font-bold tabular-nums text-emerald-700">
                        {formatCurrency(sched.totalPaid, currency)}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${Math.min(100, sched.progressPercent)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-slate-500">
                          {sched.progressPercent.toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                      {formatCurrency(sched.remainingBalance, currency)}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono text-slate-800 font-semibold">
                        {sched.paidInstallmentCount}/{sched.installments.length}{' '}
                        {getFrequencyLabel(debt.frequency)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {sched.nextDueInstallment
                          ? `Next #${sched.nextDueInstallment.installmentNumber}: ${formatDate(
                              sched.nextDueInstallment.dueDate
                            )} (${formatCurrency(
                              sched.nextDueInstallment.remainingAmount,
                              currency
                            )})`
                          : 'Fully repaid'}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          data-testid={`toggle-debt-schedule-${debt.id}`}
                          aria-expanded={isExpanded}
                          onClick={() => {
                            setExpandedDebtId(isExpanded ? null : debt.id);
                            setRepayError('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>Schedule ({sched.installments.length})</span>
                        </button>

                        {sched.nextDueInstallment && (
                          <button
                            type="button"
                            data-testid={`quick-pay-debt-${debt.id}`}
                            onClick={() => handleQuickPayNext(debt)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Pay Next</span>
                          </button>
                        )}

                        <button
                          type="button"
                          data-testid={`delete-external-debt-${debt.id}`}
                          onClick={() => {
                            if (expandedDebtId === debt.id) {
                              setExpandedDebtId(null);
                            }
                            onDeleteExternalDebt(debt.id);
                          }}
                          aria-label={`Delete external debt ${debt.title}`}
                          title="Delete external debt (Super Admin verification required)"
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

      {/* Expandable Repayment Schedule & Custom Repayment Drawer */}
      {expandedDebt && expandedSchedule && (
        <div
          data-testid="external-debt-schedule-panel"
          className="border-t-2 border-[#CBD8E6] bg-[#F7FAFC] p-4 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#CBD8E6]">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Repayment Schedule — {expandedDebt.title} ({expandedDebt.lenderName})
                </h3>
              </div>
              <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                <span>Obligation: {formatCurrency(expandedSchedule.totalObligation, currency)}</span>
                <span className="text-emerald-700 font-semibold">
                  Repaid: {formatCurrency(expandedSchedule.totalPaid, currency)}
                </span>
                <span className="text-slate-900 font-bold">
                  Remaining: {formatCurrency(expandedSchedule.remainingBalance, currency)}
                </span>
                {expandedDebt.notes && <span>Notes: {expandedDebt.notes}</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpandedDebtId(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold self-start sm:self-auto cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span>Close Schedule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Installment Schedule Table */}
            <div className="xl:col-span-7 bg-white rounded-lg border border-[#CBD8E6] overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-[#CBD8E6] text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>
                  Installment Schedule ({expandedSchedule.installments.length}{' '}
                  {getFrequencyLabel(expandedDebt.frequency)})
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {expandedSchedule.paidInstallmentCount}/{expandedSchedule.installments.length} Paid
                </span>
              </div>
              <div className="overflow-x-auto">
                <table
                  data-testid="external-debt-installments-table"
                  className="w-full text-xs text-left border-collapse"
                >
                  <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-2.5 text-center w-10">#</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">Due Date</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Scheduled</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Paid</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Remaining</th>
                      <th className="py-2 px-2.5 text-center whitespace-nowrap">Status</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {expandedSchedule.installments.map((inst) => (
                      <tr
                        key={inst.installmentNumber}
                        data-testid={`installment-row-${expandedDebt.id}-${inst.installmentNumber}`}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums text-slate-600">
                          {inst.installmentNumber}
                        </td>
                        <td className="py-2 px-2.5 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {formatDate(inst.dueDate)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {formatCurrency(inst.scheduledAmount, currency)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                          {inst.paidAmount > 0 ? formatCurrency(inst.paidAmount, currency) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                          {inst.remainingAmount > 0
                            ? formatCurrency(inst.remainingAmount, currency)
                            : formatCurrency(0, currency)}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span
                            data-testid={`installment-status-${expandedDebt.id}-${inst.installmentNumber}`}
                            className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide ${getInstallmentBadgeClass(
                              inst.status
                            )}`}
                          >
                            {formatInstallmentStatusLabel(inst.status)}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right whitespace-nowrap">
                          {inst.remainingAmount > 0 ? (
                            <button
                              type="button"
                              data-testid={`pay-installment-${expandedDebt.id}-${inst.installmentNumber}`}
                              onClick={() =>
                                handlePayInstallment(
                                  expandedDebt,
                                  inst.installmentNumber,
                                  inst.totalInstallments,
                                  inst.remainingAmount
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Pay</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-700">
                              Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Custom Repayment Entry + Repayment History */}
            <div className="xl:col-span-5 space-y-4">
              {expandedSchedule.remainingBalance > 0 && (
                <form
                  data-testid="custom-repayment-form"
                  onSubmit={handleCustomRepaymentSubmit}
                  className="bg-white rounded-lg border border-[#CBD8E6] p-3.5 space-y-2.5"
                >
                  <div className="text-xs font-bold text-slate-900">
                    Record Custom / Partial Repayment
                  </div>

                  {repayError && (
                    <div
                      role="alert"
                      data-testid="repayment-form-error"
                      className="p-2 rounded bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
                    >
                      {repayError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="repayment-date"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Repayment Date
                      </label>
                      <input
                        id="repayment-date"
                        data-testid="repayment-date-input"
                        type="date"
                        value={repayDate}
                        onChange={(e) => setRepayDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="repayment-amount"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Amount ({currency})
                      </label>
                      <input
                        id="repayment-amount"
                        data-testid="repayment-amount-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                        placeholder={`Max ${Math.round(expandedSchedule.remainingBalance)}`}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="repayment-method"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Payment Method
                      </label>
                      <select
                        id="repayment-method"
                        data-testid="repayment-method-select"
                        value={repayMethod}
                        onChange={(e) => setRepayMethod(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
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
                        htmlFor="repayment-ref"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Receipt / Voucher Ref
                      </label>
                      <input
                        id="repayment-ref"
                        data-testid="repayment-ref-input"
                        type="text"
                        value={repayRef}
                        onChange={(e) => setRepayRef(e.target.value)}
                        placeholder="Optional ref..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    data-testid="repayment-notes-input"
                    aria-label="Repayment notes"
                    value={repayNotes}
                    onChange={(e) => setRepayNotes(e.target.value)}
                    placeholder="Optional repayment notes..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                  />

                  <button
                    type="submit"
                    data-testid="submit-repayment-btn"
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Log Repayment Entry</span>
                  </button>
                </form>
              )}

              {/* Repayment History */}
              <div className="bg-white rounded-lg border border-[#CBD8E6] overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-[#CBD8E6] text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Recorded Repayments ({expandedDebt.repayments.length})</span>
                  <span className="font-mono text-[11px] text-emerald-700">
                    {formatCurrency(expandedSchedule.totalPaid, currency)}
                  </span>
                </div>
                {expandedDebt.repayments.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No repayments logged yet for this debt. Use &ldquo;Pay&rdquo; on any installment or log a custom repayment above.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table
                      data-testid="repayment-history-table"
                      className="w-full text-xs text-left border-collapse"
                    >
                      <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold sticky top-0">
                        <tr>
                          <th className="py-1.5 px-2.5">Date</th>
                          <th className="py-1.5 px-2.5">Details</th>
                          <th className="py-1.5 px-2.5 text-right">Paid</th>
                          <th className="py-1.5 px-2.5 text-center w-10">Del</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[...expandedDebt.repayments]
                          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                          .map((rep) => (
                            <tr key={rep.id} className="hover:bg-slate-50/70">
                              <td className="py-1.5 px-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                {formatDate(rep.date)}
                              </td>
                              <td className="py-1.5 px-2.5">
                                <div className="font-medium text-slate-800">
                                  {rep.paymentMethod}
                                  {rep.referenceNo ? ` · ${rep.referenceNo}` : ''}
                                </div>
                                {rep.notes && (
                                  <div className="text-[10px] text-slate-500">{rep.notes}</div>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-mono font-bold tabular-nums text-emerald-700 whitespace-nowrap">
                                {formatCurrency(rep.amount, currency)}
                              </td>
                              <td className="py-1.5 px-2.5 text-center">
                                <button
                                  type="button"
                                  data-testid={`delete-repayment-${expandedDebt.id}-${rep.id}`}
                                  onClick={() => onDeleteRepayment(expandedDebt.id, rep.id)}
                                  aria-label={`Delete repayment on ${formatDate(rep.date)}`}
                                  title="Delete repayment entry"
                                  className="inline-flex items-center justify-center p-1 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3 shrink-0" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
