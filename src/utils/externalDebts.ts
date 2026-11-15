import {
  ExternalDebtFrequency,
  ExternalDebtRecord,
  ExternalDebtRepayment,
} from '../types/index.ts';

export const EXTERNAL_DEBT_CATEGORIES = [
  'Bank Business Loan',
  'Supplier / Trade Credit',
  'Cold Storage / Cargo Credit',
  'Equipment / Vehicle Finance',
  'Short-Term Bridge Loan',
  'Private / Informal Credit',
] as const;

export const EXTERNAL_DEBT_FREQUENCIES: Array<{
  value: ExternalDebtFrequency;
  label: string;
}> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Bi-Weekly (14 Days)' },
  { value: 'weekly', label: 'Weekly (7 Days)' },
  { value: 'one_time', label: 'One-Time Maturity' },
];

export const EXTERNAL_DEBT_PRESETS = [
  {
    id: 'bank_working_capital',
    label: 'Bank Working Capital',
    title: 'Bank Working Capital Loan',
    category: 'Bank Business Loan',
    frequency: 'monthly' as ExternalDebtFrequency,
    defaultInstallments: 12,
  },
  {
    id: 'supplier_credit_line',
    label: 'Supplier Credit Line',
    title: 'Supplier Bulk Procurement Credit',
    category: 'Supplier / Trade Credit',
    frequency: 'biweekly' as ExternalDebtFrequency,
    defaultInstallments: 4,
  },
  {
    id: 'cargo_freight_credit',
    label: 'Cargo / Freight Credit',
    title: 'Air Cargo & Chiller Credit',
    category: 'Cold Storage / Cargo Credit',
    frequency: 'monthly' as ExternalDebtFrequency,
    defaultInstallments: 6,
  },
  {
    id: 'bridge_loan',
    label: 'Short-Term Bridge',
    title: 'Short-Term Working Bridge Loan',
    category: 'Short-Term Bridge Loan',
    frequency: 'one_time' as ExternalDebtFrequency,
    defaultInstallments: 1,
  },
] as const;

export type InstallmentStatus = 'PAID' | 'PARTIAL' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
export type ExternalDebtOverallStatus = 'SETTLED' | 'OVERDUE' | 'ACTIVE';

export interface ExternalDebtInstallment {
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string; // YYYY-MM-DD
  scheduledAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
}

export interface ExternalDebtScheduleSummary {
  debtId: string;
  principalAmount: number;
  interestAmount: number;
  totalObligation: number;
  totalPaid: number;
  remainingBalance: number;
  progressPercent: number;
  debtStatus: ExternalDebtOverallStatus;
  installments: ExternalDebtInstallment[];
  paidInstallmentCount: number;
  overdueInstallmentCount: number;
  nextDueInstallment: ExternalDebtInstallment | null;
}

export interface ExternalDebtsAggregateSummary {
  totalCount: number;
  activeCount: number;
  settledCount: number;
  overdueDebtCount: number;
  overdueInstallmentCount: number;
  totalPrincipal: number;
  totalInterest: number;
  totalObligation: number;
  totalPaid: number;
  totalRemaining: number;
  overallProgressPercent: number;
  nextDue: {
    debtId: string;
    debtTitle: string;
    lenderName: string;
    installmentNumber: number;
    dueDate: string;
    remainingAmount: number;
    isOverdue: boolean;
  } | null;
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function isIsoDate(value?: string): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()));
}

export function addDaysIso(dateStr: string, days: number): string {
  if (!isIsoDate(dateStr)) return dateStr;
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function addMonthsIso(dateStr: string, months: number): string {
  if (!isIsoDate(dateStr)) return dateStr;
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const targetTotalMonths = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(targetTotalMonths / 12);
  const targetMonthZero = ((targetTotalMonths % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthZero + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  const mm = String(targetMonthZero + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function diffDaysBetweenIso(fromDate: string, toDate: string): number {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) return 0;
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / 86400000);
}

export function getFrequencyLabel(freq: ExternalDebtFrequency): string {
  switch (freq) {
    case 'biweekly':
      return 'Bi-Weekly';
    case 'weekly':
      return 'Weekly';
    case 'one_time':
      return 'One-Time';
    case 'monthly':
    default:
      return 'Monthly';
  }
}

export function computeExternalDebtTotalObligation(
  debt: Pick<ExternalDebtRecord, 'principalAmount' | 'interestAmount'>
): number {
  const principal = Math.max(0, Number(debt.principalAmount) || 0);
  const interest = Math.max(0, Number(debt.interestAmount) || 0);
  return round2(principal + interest);
}

export interface ExternalDebtValidationResult {
  valid: boolean;
  error?: string;
  cleanTitle?: string;
  cleanLenderName?: string;
  cleanCategory?: string;
  cleanPrincipal?: number;
  cleanInterest?: number;
  cleanInstallmentCount?: number;
}

export function validateExternalDebtInput(input: {
  title: string;
  lenderName: string;
  category: string;
  originationDate: string;
  principalAmount: number | string;
  interestAmount?: number | string;
  frequency: ExternalDebtFrequency;
  installmentCount: number | string;
  firstDueDate: string;
}): ExternalDebtValidationResult {
  const cleanTitle = (input.title || '').trim();
  if (!cleanTitle) {
    return { valid: false, error: 'Please enter a loan or credit title.' };
  }
  const cleanLenderName = (input.lenderName || '').trim();
  if (!cleanLenderName) {
    return { valid: false, error: 'Please enter the lender or creditor name.' };
  }
  const cleanCategory = (input.category || '').trim() || EXTERNAL_DEBT_CATEGORIES[0];

  if (!isIsoDate(input.originationDate)) {
    return { valid: false, error: 'Please select a valid loan origination date.' };
  }
  const principal = Number(input.principalAmount);
  if (!Number.isFinite(principal) || principal <= 0) {
    return { valid: false, error: 'Principal loan/credit amount must be greater than 0.' };
  }
  const rawInterest =
    input.interestAmount === '' || input.interestAmount === undefined
      ? 0
      : Number(input.interestAmount);
  if (!Number.isFinite(rawInterest) || rawInterest < 0) {
    return { valid: false, error: 'Interest / fee amount cannot be negative.' };
  }

  const count =
    input.frequency === 'one_time' ? 1 : Math.floor(Number(input.installmentCount));
  if (!Number.isFinite(count) || count < 1 || count > 120) {
    return {
      valid: false,
      error: 'Repayment installment count must be between 1 and 120.',
    };
  }
  if (!isIsoDate(input.firstDueDate)) {
    return { valid: false, error: 'Please select a valid first repayment due date.' };
  }
  if (input.firstDueDate.trim() < input.originationDate.trim()) {
    return {
      valid: false,
      error: 'First repayment due date cannot be earlier than the origination date.',
    };
  }

  return {
    valid: true,
    cleanTitle,
    cleanLenderName,
    cleanCategory,
    cleanPrincipal: round2(principal),
    cleanInterest: round2(rawInterest),
    cleanInstallmentCount: count,
  };
}

export function validateExternalDebtRepaymentInput(input: {
  date: string;
  amount: number | string;
  remainingBalance?: number;
}): { valid: boolean; error?: string; cleanAmount?: number } {
  if (!isIsoDate(input.date)) {
    return { valid: false, error: 'Please select a valid repayment date.' };
  }
  const num = Number(input.amount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Repayment amount must be greater than 0.' };
  }
  const cleanAmount = round2(num);
  if (
    typeof input.remainingBalance === 'number' &&
    input.remainingBalance > 0 &&
    cleanAmount > round2(input.remainingBalance + 0.01)
  ) {
    return {
      valid: false,
      error: `Repayment amount exceeds remaining debt balance (${round2(input.remainingBalance).toLocaleString()}).`,
    };
  }
  return { valid: true, cleanAmount };
}

export function computeDueDateForInstallment(
  firstDueDate: string,
  frequency: ExternalDebtFrequency,
  indexZeroBased: number
): string {
  if (indexZeroBased <= 0 || frequency === 'one_time') return firstDueDate;
  if (frequency === 'weekly') return addDaysIso(firstDueDate, indexZeroBased * 7);
  if (frequency === 'biweekly') return addDaysIso(firstDueDate, indexZeroBased * 14);
  return addMonthsIso(firstDueDate, indexZeroBased);
}

/**
 * Generates an exact cent-reconciled repayment schedule for an External Debt
 * and allocates recorded repayments FIFO across installments.
 */
export function generateExternalDebtSchedule(
  debt: ExternalDebtRecord,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): ExternalDebtScheduleSummary {
  const principalAmount = round2(Math.max(0, Number(debt.principalAmount) || 0));
  const interestAmount = round2(Math.max(0, Number(debt.interestAmount) || 0));
  const totalObligation = round2(principalAmount + interestAmount);
  const count =
    debt.frequency === 'one_time'
      ? 1
      : Math.max(1, Math.min(120, Math.floor(Number(debt.installmentCount) || 1)));

  const sortedRepayments: ExternalDebtRepayment[] = [...(debt.repayments || [])].sort((a, b) =>
    (a.date || '').localeCompare(b.date || '')
  );
  const rawTotalPaid = round2(
    sortedRepayments.reduce((sum, r) => sum + Math.max(0, Number(r.amount) || 0), 0)
  );
  const totalPaid = Math.min(totalObligation, rawTotalPaid);
  const remainingBalance = round2(Math.max(0, totalObligation - totalPaid));

  // Build exact scheduled amounts where sum(scheduledAmount) === totalObligation
  const baseInstallmentAmount = round2(totalObligation / count);
  let allocatedScheduleSum = 0;
  let unallocatedPaidPool = totalPaid;

  const installments: ExternalDebtInstallment[] = [];
  let paidInstallmentCount = 0;
  let overdueInstallmentCount = 0;
  let nextDueInstallment: ExternalDebtInstallment | null = null;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const scheduledAmount = isLast
      ? round2(Math.max(0, totalObligation - allocatedScheduleSum))
      : baseInstallmentAmount;
    allocatedScheduleSum = round2(allocatedScheduleSum + scheduledAmount);

    const paidForRow = round2(Math.min(scheduledAmount, Math.max(0, unallocatedPaidPool)));
    unallocatedPaidPool = round2(Math.max(0, unallocatedPaidPool - paidForRow));
    const rowRemaining = round2(Math.max(0, scheduledAmount - paidForRow));

    const dueDate = computeDueDateForInstallment(
      debt.firstDueDate || debt.originationDate,
      debt.frequency,
      i
    );

    let status: InstallmentStatus;
    if (rowRemaining <= 0.005) {
      status = 'PAID';
      paidInstallmentCount += 1;
    } else if (isIsoDate(dueDate) && isIsoDate(referenceDate) && dueDate < referenceDate) {
      status = 'OVERDUE';
      overdueInstallmentCount += 1;
    } else if (paidForRow > 0) {
      status = 'PARTIAL';
    } else if (
      isIsoDate(dueDate) &&
      isIsoDate(referenceDate) &&
      diffDaysBetweenIso(referenceDate, dueDate) <= 7
    ) {
      status = 'DUE_SOON';
    } else {
      status = 'UPCOMING';
    }

    const row: ExternalDebtInstallment = {
      installmentNumber: i + 1,
      totalInstallments: count,
      dueDate,
      scheduledAmount,
      paidAmount: paidForRow,
      remainingAmount: rowRemaining,
      status,
    };
    installments.push(row);

    if (rowRemaining > 0 && !nextDueInstallment) {
      nextDueInstallment = row;
    }
  }

  const progressPercent =
    totalObligation > 0
      ? Math.min(100, Math.round((totalPaid / totalObligation) * 1000) / 10)
      : 100;

  const debtStatus: ExternalDebtOverallStatus =
    remainingBalance <= 0.005
      ? 'SETTLED'
      : overdueInstallmentCount > 0
      ? 'OVERDUE'
      : 'ACTIVE';

  return {
    debtId: debt.id,
    principalAmount,
    interestAmount,
    totalObligation,
    totalPaid,
    remainingBalance,
    progressPercent,
    debtStatus,
    installments,
    paidInstallmentCount,
    overdueInstallmentCount,
    nextDueInstallment,
  };
}

export function calculateExternalDebtsSummary(
  debts: ExternalDebtRecord[],
  referenceDate: string = new Date().toISOString().slice(0, 10)
): ExternalDebtsAggregateSummary {
  const safeDebts = Array.isArray(debts) ? debts : [];
  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalObligation = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  let activeCount = 0;
  let settledCount = 0;
  let overdueDebtCount = 0;
  let overdueInstallmentCount = 0;
  let nextDue: ExternalDebtsAggregateSummary['nextDue'] = null;

  for (const debt of safeDebts) {
    const sched = generateExternalDebtSchedule(debt, referenceDate);
    totalPrincipal = round2(totalPrincipal + sched.principalAmount);
    totalInterest = round2(totalInterest + sched.interestAmount);
    totalObligation = round2(totalObligation + sched.totalObligation);
    totalPaid = round2(totalPaid + sched.totalPaid);
    totalRemaining = round2(totalRemaining + sched.remainingBalance);

    if (sched.debtStatus === 'SETTLED') {
      settledCount += 1;
    } else {
      activeCount += 1;
      if (sched.debtStatus === 'OVERDUE') {
        overdueDebtCount += 1;
      }
    }
    overdueInstallmentCount += sched.overdueInstallmentCount;

    if (sched.nextDueInstallment) {
      const candidateDue = sched.nextDueInstallment.dueDate;
      if (!nextDue || candidateDue < nextDue.dueDate) {
        nextDue = {
          debtId: debt.id,
          debtTitle: debt.title,
          lenderName: debt.lenderName,
          installmentNumber: sched.nextDueInstallment.installmentNumber,
          dueDate: candidateDue,
          remainingAmount: sched.nextDueInstallment.remainingAmount,
          isOverdue: sched.nextDueInstallment.status === 'OVERDUE',
        };
      }
    }
  }

  const overallProgressPercent =
    totalObligation > 0
      ? Math.min(100, Math.round((totalPaid / totalObligation) * 1000) / 10)
      : 0;

  return {
    totalCount: safeDebts.length,
    activeCount,
    settledCount,
    overdueDebtCount,
    overdueInstallmentCount,
    totalPrincipal,
    totalInterest,
    totalObligation,
    totalPaid,
    totalRemaining,
    overallProgressPercent,
    nextDue,
  };
}
