import { OtherCostRecord, RecurringExpenseRecord } from '../types/index.ts';

export interface RecurringExpensePreset {
  id: string;
  label: string;
  title: string;
  category: string;
  defaultDay: number;
}

export const RECURRING_EXPENSE_PRESETS: RecurringExpensePreset[] = [
  {
    id: 'office_rent',
    label: 'Office Rent',
    title: 'Office & Warehouse Rent',
    category: 'Office & Overhead Expenses',
    defaultDay: 1,
  },
  {
    id: 'internet',
    label: 'Internet & Wi-Fi',
    title: 'Fiber Internet & Wi-Fi',
    category: 'Office & Overhead Expenses',
    defaultDay: 5,
  },
  {
    id: 'software',
    label: 'Software Subscriptions',
    title: 'Software & Cloud Subscriptions',
    category: 'Office & Overhead Expenses',
    defaultDay: 1,
  },
  {
    id: 'utilities',
    label: 'Electricity & Water',
    title: 'Depot Electricity & Water',
    category: 'Office & Overhead Expenses',
    defaultDay: 10,
  },
  {
    id: 'salaries',
    label: 'Fixed Salaries',
    title: 'Staff Fixed Salaries',
    category: 'Labor & Handling',
    defaultDay: 1,
  },
  {
    id: 'security',
    label: 'Security & CCTV',
    title: 'Security & CCTV Monitoring',
    category: 'Miscellaneous Expense',
    defaultDay: 15,
  },
];

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_SCAN_MONTHS = 36;

export function isValidYearMonth(yearMonth: string): boolean {
  return YEAR_MONTH_REGEX.test((yearMonth || '').trim());
}

/**
 * Clamps a day-of-month (1-31) safely to the actual length of YYYY-MM.
 * E.g. clampBillingDate('2026-02', 31) => '2026-02-28'.
 */
export function clampBillingDate(yearMonth: string, billingDay: number): string {
  const cleanYm = (yearMonth || '').trim();
  const [yStr, mStr] = cleanYm.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return `${new Date().toISOString().slice(0, 7)}-01`;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(daysInMonth, Math.max(1, Math.floor(Number(billingDay) || 1)));
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function addMonthsToYearMonth(yearMonth: string, offset: number): string {
  if (!isValidYearMonth(yearMonth)) {
    return new Date().toISOString().slice(0, 7);
  }
  const [yStr, mStr] = yearMonth.trim().split('-');
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + Math.trunc(offset), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function compareYearMonth(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function enumerateYearMonths(
  startYearMonth: string,
  endYearMonth: string,
  maxMonths: number = MAX_SCAN_MONTHS
): string[] {
  if (!isValidYearMonth(startYearMonth) || !isValidYearMonth(endYearMonth)) {
    return [];
  }
  if (compareYearMonth(startYearMonth, endYearMonth) > 0) {
    return [];
  }
  const months: string[] = [];
  let cursor = startYearMonth.trim();
  while (compareYearMonth(cursor, endYearMonth) <= 0 && months.length < maxMonths) {
    months.push(cursor);
    cursor = addMonthsToYearMonth(cursor, 1);
  }
  return months;
}

export interface RecurringExpenseValidationResult {
  valid: boolean;
  error?: string;
  cleanTitle?: string;
  cleanCategory?: string;
  cleanAmount?: number;
  cleanBillingDay?: number;
  cleanStartYearMonth?: string;
}

export function validateRecurringExpenseInput(input: {
  title: string;
  category: string;
  amount: string | number;
  billingDay: string | number;
  startYearMonth: string;
}): RecurringExpenseValidationResult {
  const cleanTitle = (input.title || '').trim();
  if (cleanTitle.length < 2) {
    return { valid: false, error: 'Please enter a descriptive expense title (min 2 characters).' };
  }

  const cleanCategory = (input.category || '').trim();
  if (!cleanCategory) {
    return { valid: false, error: 'Please select a costing category.' };
  }

  const numericAmount =
    typeof input.amount === 'number' ? input.amount : Number(String(input.amount || '').trim());
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { valid: false, error: 'Monthly fixed amount must be greater than 0.' };
  }

  const numericDay =
    typeof input.billingDay === 'number'
      ? input.billingDay
      : Number(String(input.billingDay || '').trim());
  if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) {
    return { valid: false, error: 'Billing day must be a whole day between 1 and 31.' };
  }

  const cleanStartYearMonth = (input.startYearMonth || '').trim();
  if (!isValidYearMonth(cleanStartYearMonth)) {
    return { valid: false, error: 'Please select a valid Start Month (YYYY-MM).' };
  }

  return {
    valid: true,
    cleanTitle,
    cleanCategory,
    cleanAmount: Math.round(numericAmount * 100) / 100,
    cleanBillingDay: numericDay,
    cleanStartYearMonth,
  };
}

export function hasRecurringDeductionForMonth(
  existingCosts: OtherCostRecord[],
  ruleId: string,
  yearMonth: string
): boolean {
  return (existingCosts || []).some(
    (cost) => cost.recurringExpenseId === ruleId && cost.recurringYearMonth === yearMonth
  );
}

export function buildRecurringCostDeductionRecord(
  rule: RecurringExpenseRecord,
  yearMonth: string,
  overrideDate?: string
): Omit<OtherCostRecord, 'id' | 'createdAt'> {
  const scheduledDate = overrideDate || clampBillingDate(yearMonth, rule.billingDay);
  const noteSuffix = rule.notes && rule.notes.trim() ? ` · ${rule.notes.trim()}` : '';
  return {
    date: scheduledDate,
    category: rule.category,
    amount: Math.round(Math.max(0, Number(rule.amount) || 0) * 100) / 100,
    description: `${rule.title} (Auto Monthly Fixed Cost — ${yearMonth})${noteSuffix}`,
    refInvoice: `AUTO-REC-${yearMonth}`,
    recurringExpenseId: rule.id,
    recurringYearMonth: yearMonth,
  };
}

export interface DueRecurringExpenseCycle {
  rule: RecurringExpenseRecord;
  yearMonth: string;
  billingDate: string;
}

/**
 * Scans all active (autoDeduct === true) recurring rules from each rule's startYearMonth
 * through the referenceDate's month and returns every cycle whose clamped billingDate
 * is <= referenceDate and has not yet been posted to otherCosts.
 */
export function getDueRecurringExpenseCycles(
  rules: RecurringExpenseRecord[],
  existingCosts: OtherCostRecord[],
  referenceDate: string = new Date().toISOString().slice(0, 10)
): DueRecurringExpenseCycle[] {
  const cleanRefDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : new Date().toISOString().slice(0, 10);
  const currentYearMonth = cleanRefDate.slice(0, 7);
  const dueCycles: DueRecurringExpenseCycle[] = [];

  for (const rule of rules || []) {
    if (!rule.autoDeduct) continue;
    if (!isValidYearMonth(rule.startYearMonth)) continue;

    // If startYearMonth is more than MAX_SCAN_MONTHS behind currentYearMonth, anchor scan window cleanly
    const earliestAllowed = addMonthsToYearMonth(currentYearMonth, -(MAX_SCAN_MONTHS - 1));
    const effectiveStart =
      compareYearMonth(rule.startYearMonth, earliestAllowed) < 0
        ? earliestAllowed
        : rule.startYearMonth;

    const months = enumerateYearMonths(effectiveStart, currentYearMonth, MAX_SCAN_MONTHS);
    for (const ym of months) {
      const billingDate = clampBillingDate(ym, rule.billingDay);
      if (billingDate > cleanRefDate) {
        continue;
      }
      if (!hasRecurringDeductionForMonth(existingCosts, rule.id, ym)) {
        dueCycles.push({
          rule,
          yearMonth: ym,
          billingDate,
        });
      }
    }
  }

  return dueCycles.sort((a, b) => a.billingDate.localeCompare(b.billingDate));
}

export interface RecurringRuleStatusSnapshot {
  currentMonthPaid: boolean;
  lastDeductedYearMonth: string | null;
  nextBillingDate: string | null;
  isDueTodayOrEarlier: boolean;
  deductionCount: number;
  totalDeductedAmount: number;
}

export function getRecurringRuleStatus(
  rule: RecurringExpenseRecord,
  existingCosts: OtherCostRecord[],
  referenceDate: string = new Date().toISOString().slice(0, 10)
): RecurringRuleStatusSnapshot {
  const cleanRefDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : new Date().toISOString().slice(0, 10);
  const currentYearMonth = cleanRefDate.slice(0, 7);

  const matchingCosts = (existingCosts || []).filter(
    (c) => c.recurringExpenseId === rule.id
  );
  const currentMonthPaid = matchingCosts.some(
    (c) => c.recurringYearMonth === currentYearMonth
  );

  const postedMonths = matchingCosts
    .map((c) => c.recurringYearMonth || '')
    .filter((ym) => isValidYearMonth(ym))
    .sort();
  if (rule.lastProcessedYearMonth && isValidYearMonth(rule.lastProcessedYearMonth)) {
    if (!postedMonths.includes(rule.lastProcessedYearMonth)) {
      postedMonths.push(rule.lastProcessedYearMonth);
      postedMonths.sort();
    }
  }

  const lastDeductedYearMonth =
    postedMonths.length > 0 ? postedMonths[postedMonths.length - 1] : null;
  const deductionCount = matchingCosts.length;
  const totalDeductedAmount =
    Math.round(
      matchingCosts.reduce((sum, c) => sum + Math.max(0, Number(c.amount) || 0), 0) * 100
    ) / 100;

  let nextMonthCandidate =
    compareYearMonth(rule.startYearMonth, currentYearMonth) > 0
      ? rule.startYearMonth
      : currentYearMonth;

  if (nextMonthCandidate === currentYearMonth && currentMonthPaid) {
    nextMonthCandidate = addMonthsToYearMonth(currentYearMonth, 1);
  }

  const candidateBillingDate = clampBillingDate(nextMonthCandidate, rule.billingDay);
  const isDueTodayOrEarlier =
    rule.autoDeduct && !currentMonthPaid && candidateBillingDate <= cleanRefDate;

  return {
    currentMonthPaid,
    lastDeductedYearMonth,
    nextBillingDate: candidateBillingDate,
    isDueTodayOrEarlier,
    deductionCount,
    totalDeductedAmount,
  };
}

export interface RecurringExpenseSummaryMetrics {
  totalRules: number;
  activeRules: number;
  pausedRules: number;
  monthlyFixedCommitment: number;
  allRulesMonthlyTotal: number;
  dueCycleCount: number;
  totalAutoDeductedAllTime: number;
  thisMonthDeducted: number;
}

export function calculateRecurringExpenseSummary(
  rules: RecurringExpenseRecord[],
  existingCosts: OtherCostRecord[],
  referenceDate: string = new Date().toISOString().slice(0, 10)
): RecurringExpenseSummaryMetrics {
  const cleanRefDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : new Date().toISOString().slice(0, 10);
  const currentYearMonth = cleanRefDate.slice(0, 7);

  let activeRules = 0;
  let pausedRules = 0;
  let monthlyFixedCommitment = 0;
  let allRulesMonthlyTotal = 0;

  for (const rule of rules || []) {
    const amt = Math.max(0, Number(rule.amount) || 0);
    allRulesMonthlyTotal += amt;
    if (rule.autoDeduct) {
      activeRules += 1;
      monthlyFixedCommitment += amt;
    } else {
      pausedRules += 1;
    }
  }

  const dueCycles = getDueRecurringExpenseCycles(rules, existingCosts, cleanRefDate);

  let totalAutoDeductedAllTime = 0;
  let thisMonthDeducted = 0;
  for (const cost of existingCosts || []) {
    if (!cost.recurringExpenseId) continue;
    const amt = Math.max(0, Number(cost.amount) || 0);
    totalAutoDeductedAllTime += amt;
    if (
      cost.recurringYearMonth === currentYearMonth ||
      (cost.date || '').startsWith(currentYearMonth)
    ) {
      thisMonthDeducted += amt;
    }
  }

  return {
    totalRules: (rules || []).length,
    activeRules,
    pausedRules,
    monthlyFixedCommitment: Math.round(monthlyFixedCommitment * 100) / 100,
    allRulesMonthlyTotal: Math.round(allRulesMonthlyTotal * 100) / 100,
    dueCycleCount: dueCycles.length,
    totalAutoDeductedAllTime: Math.round(totalAutoDeductedAllTime * 100) / 100,
    thisMonthDeducted: Math.round(thisMonthDeducted * 100) / 100,
  };
}
