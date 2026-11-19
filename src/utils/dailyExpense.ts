import { OtherCostRecord } from '../types/index.ts';
import { toISODateString } from './dateFilters.ts';

export function getTodayLocalIsoDate(): string {
  return toISODateString(new Date());
}

export function normalizeExpenseDateString(raw: string | null | undefined): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const dmy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return toISODateString(parsed);
  return '';
}

function toFiniteNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const parsed = Number(String(val ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export const DAILY_EXPENSE_PAYMENT_METHODS = [
  'Cash',
  'bKash / Nagad',
  'Bank Transfer',
  'Company Card',
  'Petty Cash',
] as const;

export const DEFAULT_DAILY_COMPANY_EXPENSE_CATEGORIES: string[] = [
  'Office Tea, Snacks & Pantry',
  'Office Rent & Utilities',
  'Staff Conveyance & Fuel',
  'Mobile, Internet & IT',
  'Staff Lunch & Overtime',
  'Packaging Supplies & Tape',
  'Depot Maintenance & Repairs',
  'Courier & Postage',
  'Office & Overhead Expenses',
  'Miscellaneous Expense',
];

export type DailyExpenseScope = 'day' | 'month' | 'all';

export interface DailyExpenseValidationInput {
  date: string;
  category: string;
  amount: number | string;
  description: string;
}

export interface DailyExpenseValidationResult {
  valid: boolean;
  error?: string;
  normalizedDate: string;
  normalizedCategory: string;
  normalizedAmount: number;
  normalizedDescription: string;
}

export interface DailyExpenseCategorySummary {
  category: string;
  count: number;
  totalAmount: number;
  sharePercent: number;
}

export interface DailyExpenseDaySummary {
  date: string;
  count: number;
  totalAmount: number;
}

export interface DailyExpenseReportSummary {
  todayTotal: number;
  todayCount: number;
  selectedDateTotal: number;
  selectedDateCount: number;
  selectedMonthTotal: number;
  selectedMonthCount: number;
  allTimeTotal: number;
  allTimeCount: number;
  filteredTotal: number;
  filteredCount: number;
  topCategory: DailyExpenseCategorySummary | null;
  categoryBreakdown: DailyExpenseCategorySummary[];
  dailyGroupedTotals: DailyExpenseDaySummary[];
  filteredExpenses: OtherCostRecord[];
}

export function mergeExpenseCategories(
  configuredCategories: readonly string[] = [],
  recordedExpenses: readonly OtherCostRecord[] = []
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const pushUnique = (raw: string | undefined) => {
    const clean = (raw || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  };

  for (const cat of configuredCategories) pushUnique(cat);
  for (const cat of DEFAULT_DAILY_COMPANY_EXPENSE_CATEGORIES) pushUnique(cat);
  for (const exp of recordedExpenses) pushUnique(exp.category);

  return result;
}

export function validateDailyExpenseInput(
  input: DailyExpenseValidationInput
): DailyExpenseValidationResult {
  const normalizedDate = normalizeExpenseDateString(input.date);
  const normalizedCategory = (input.category || '').trim();
  const normalizedDescription = (input.description || '').trim();
  const parsedAmount =
    typeof input.amount === 'number'
      ? input.amount
      : Number(String(input.amount ?? '').replace(/,/g, '').trim());

  if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return {
      valid: false,
      error: 'Please choose a valid expense date (YYYY-MM-DD).',
      normalizedDate: '',
      normalizedCategory,
      normalizedAmount: 0,
      normalizedDescription,
    };
  }

  if (!normalizedCategory) {
    return {
      valid: false,
      error: 'Please select or enter an expense category.',
      normalizedDate,
      normalizedCategory: '',
      normalizedAmount: 0,
      normalizedDescription,
    };
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return {
      valid: false,
      error: 'Please enter a positive expense amount greater than 0.',
      normalizedDate,
      normalizedCategory,
      normalizedAmount: 0,
      normalizedDescription,
    };
  }

  if (!normalizedDescription) {
    return {
      valid: false,
      error: 'Please enter expense particulars / description.',
      normalizedDate,
      normalizedCategory,
      normalizedAmount: Number(parsedAmount.toFixed(2)),
      normalizedDescription: '',
    };
  }

  return {
    valid: true,
    normalizedDate,
    normalizedCategory,
    normalizedAmount: Number(parsedAmount.toFixed(2)),
    normalizedDescription,
  };
}

function sortExpensesNewestFirst(list: readonly OtherCostRecord[]): OtherCostRecord[] {
  return [...list].sort((a, b) => {
    const dateCmp = normalizeExpenseDateString(b.date).localeCompare(
      normalizeExpenseDateString(a.date)
    );
    if (dateCmp !== 0) return dateCmp;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export function calculateDailyExpenseSummary(
  otherCosts: readonly OtherCostRecord[],
  options: {
    todayDate: string;
    selectedDate: string;
    selectedMonth: string; // YYYY-MM
    scope: DailyExpenseScope;
    filterCategory?: string;
    searchQuery?: string;
  }
): DailyExpenseReportSummary {
  const safeList = Array.isArray(otherCosts) ? otherCosts : [];
  const todayIso = normalizeExpenseDateString(options.todayDate);
  const selectedIso = normalizeExpenseDateString(options.selectedDate) || todayIso;
  const selectedMonthPrefix =
    options.selectedMonth && /^\d{4}-\d{2}$/.test(options.selectedMonth)
      ? options.selectedMonth
      : selectedIso.slice(0, 7);

  let todayTotal = 0;
  let todayCount = 0;
  let selectedDateTotal = 0;
  let selectedDateCount = 0;
  let selectedMonthTotal = 0;
  let selectedMonthCount = 0;
  let allTimeTotal = 0;

  const dayGroupMap = new Map<string, { count: number; totalAmount: number }>();

  for (const item of safeList) {
    const amt = Math.max(0, toFiniteNumber(item.amount));
    const itemDate = normalizeExpenseDateString(item.date);
    allTimeTotal += amt;

    if (itemDate === todayIso) {
      todayTotal += amt;
      todayCount += 1;
    }
    if (itemDate === selectedIso) {
      selectedDateTotal += amt;
      selectedDateCount += 1;
    }
    if (itemDate.startsWith(selectedMonthPrefix)) {
      selectedMonthTotal += amt;
      selectedMonthCount += 1;
      const existingDay = dayGroupMap.get(itemDate) || { count: 0, totalAmount: 0 };
      existingDay.count += 1;
      existingDay.totalAmount += amt;
      dayGroupMap.set(itemDate, existingDay);
    }
  }

  const filterCat = (options.filterCategory || 'ALL').trim();
  const query = (options.searchQuery || '').trim().toLowerCase();

  const scoped = safeList.filter((item) => {
    const itemDate = normalizeExpenseDateString(item.date);
    if (options.scope === 'day' && itemDate !== selectedIso) return false;
    if (options.scope === 'month' && !itemDate.startsWith(selectedMonthPrefix)) return false;

    if (filterCat && filterCat !== 'ALL') {
      if ((item.category || '').trim().toLowerCase() !== filterCat.toLowerCase()) {
        return false;
      }
    }

    if (query) {
      const haystack = [
        item.category,
        item.description,
        item.refInvoice,
        item.paidBy,
        item.paymentMethod,
        itemDate,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const filteredExpenses = sortExpensesNewestFirst(scoped);
  const filteredTotal = Number(
    filteredExpenses.reduce((sum, item) => sum + Math.max(0, toFiniteNumber(item.amount)), 0).toFixed(2)
  );

  const catMap = new Map<string, { count: number; totalAmount: number }>();
  for (const item of filteredExpenses) {
    const cat = (item.category || 'Miscellaneous Expense').trim();
    const prev = catMap.get(cat) || { count: 0, totalAmount: 0 };
    prev.count += 1;
    prev.totalAmount += Math.max(0, toFiniteNumber(item.amount));
    catMap.set(cat, prev);
  }

  const categoryBreakdown: DailyExpenseCategorySummary[] = Array.from(catMap.entries())
    .map(([category, info]) => ({
      category,
      count: info.count,
      totalAmount: Number(info.totalAmount.toFixed(2)),
      sharePercent:
        filteredTotal > 0 ? Number(((info.totalAmount / filteredTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const dailyGroupedTotals: DailyExpenseDaySummary[] = Array.from(dayGroupMap.entries())
    .map(([date, info]) => ({
      date,
      count: info.count,
      totalAmount: Number(info.totalAmount.toFixed(2)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    todayTotal: Number(todayTotal.toFixed(2)),
    todayCount,
    selectedDateTotal: Number(selectedDateTotal.toFixed(2)),
    selectedDateCount,
    selectedMonthTotal: Number(selectedMonthTotal.toFixed(2)),
    selectedMonthCount,
    allTimeTotal: Number(allTimeTotal.toFixed(2)),
    allTimeCount: safeList.length,
    filteredTotal,
    filteredCount: filteredExpenses.length,
    topCategory: categoryBreakdown[0] || null,
    categoryBreakdown,
    dailyGroupedTotals,
    filteredExpenses,
  };
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildDailyExpenseCsv(
  records: readonly OtherCostRecord[],
  currency: string = 'TK'
): string {
  const header = [
    'SL #',
    'Date',
    'Category',
    'Particulars / Description',
    'Payment Method',
    'Paid By',
    'Voucher / Ref No',
    `Amount (${currency})`,
  ];

  const rows = records.map((item, idx) => [
    idx + 1,
    normalizeExpenseDateString(item.date),
    item.category,
    item.description,
    item.paymentMethod || 'Cash',
    item.paidBy || '-',
    item.refInvoice || '-',
    toFiniteNumber(item.amount).toFixed(2),
  ]);

  const totalAmount = records.reduce((s, r) => s + toFiniteNumber(r.amount), 0);
  const footer = ['TOTAL', '', `${records.length} Entries`, '', '', '', '', totalAmount.toFixed(2)];

  return [header, ...rows, footer]
    .map((line) => line.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');
}

export const DAILY_EXPENSE_VISIBLE_ROWS = 10;

export function calculateVisibleRowsScrollHeight(params: {
  headerHeight: number;
  rowHeights: readonly number[];
  footerHeight?: number;
  borderHeight?: number;
  maxVisibleRows?: number;
}): number | null {
  const limit = Math.max(1, Math.floor(params.maxVisibleRows ?? DAILY_EXPENSE_VISIBLE_ROWS));
  if (params.rowHeights.length <= limit) {
    return null;
  }

  const visibleRowsSum = params.rowHeights
    .slice(0, limit)
    .reduce((sum, h) => sum + (Number.isFinite(h) && h > 0 ? h : 0), 0);

  if (visibleRowsSum <= 0) {
    return null;
  }

  const headerH =
    Number.isFinite(params.headerHeight) && params.headerHeight > 0 ? params.headerHeight : 0;
  const footerH =
    Number.isFinite(params.footerHeight ?? 0) && (params.footerHeight ?? 0) > 0
      ? (params.footerHeight ?? 0)
      : 0;
  const borderH =
    Number.isFinite(params.borderHeight ?? 0) && (params.borderHeight ?? 0) > 0
      ? (params.borderHeight ?? 0)
      : 0;

  return Math.ceil(headerH + visibleRowsSum + footerH + borderH);
}

export interface DailyExpenseMonthlySummaryRow {
  month: string; // YYYY-MM
  monthLabel: string;
  year: string;
  entryCount: number;
  totalAmount: number;
  averagePerEntry: number;
  sharePercent: number;
  topCategory: string | null;
  topCategoryAmount: number;
}

export interface DailyExpenseMonthlySummaryResult {
  months: DailyExpenseMonthlySummaryRow[];
  availableYears: string[];
  totalMonths: number;
  totalEntries: number;
  grandTotal: number;
  highestMonth: DailyExpenseMonthlySummaryRow | null;
  monthlyAverage: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatExpenseMonthLabel(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec((ym || '').trim());
  if (!match) return ym;
  const monthIdx = Number(match[2]) - 1;
  const monthName = MONTH_NAMES[monthIdx];
  return monthName ? `${monthName} ${match[1]}` : ym;
}

export function calculateMonthlyExpenseAggregate(
  otherCosts: readonly OtherCostRecord[],
  options: {
    yearFilter?: string;
    categoryFilter?: string;
    searchQuery?: string;
  } = {}
): DailyExpenseMonthlySummaryResult {
  const safeList = Array.isArray(otherCosts) ? otherCosts : [];
  const yearSet = new Set<string>();

  for (const item of safeList) {
    const iso = normalizeExpenseDateString(item.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      yearSet.add(iso.slice(0, 4));
    }
  }

  const availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  const yearFilter = (options.yearFilter || 'ALL').trim();
  const categoryFilter = (options.categoryFilter || 'ALL').trim();
  const query = (options.searchQuery || '').trim().toLowerCase();

  interface MonthBucket {
    month: string;
    entryCount: number;
    totalAmount: number;
    categoryTotals: Map<string, number>;
  }

  const monthMap = new Map<string, MonthBucket>();

  for (const item of safeList) {
    const iso = normalizeExpenseDateString(item.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;

    const year = iso.slice(0, 4);
    const month = iso.slice(0, 7);
    const monthLabel = formatExpenseMonthLabel(month);

    if (yearFilter && yearFilter !== 'ALL' && year !== yearFilter) {
      continue;
    }

    const cat = (item.category || 'Miscellaneous Expense').trim();
    if (categoryFilter && categoryFilter !== 'ALL') {
      if (cat.toLowerCase() !== categoryFilter.toLowerCase()) {
        continue;
      }
    }

    if (query) {
      const haystack = [
        month,
        monthLabel,
        cat,
        item.description,
        item.paymentMethod,
        item.paidBy,
        item.refInvoice,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) {
        continue;
      }
    }

    const amt = Math.max(0, toFiniteNumber(item.amount));
    const bucket = monthMap.get(month) || {
      month,
      entryCount: 0,
      totalAmount: 0,
      categoryTotals: new Map<string, number>(),
    };

    bucket.entryCount += 1;
    bucket.totalAmount += amt;
    bucket.categoryTotals.set(cat, (bucket.categoryTotals.get(cat) || 0) + amt);
    monthMap.set(month, bucket);
  }

  const grandTotalRaw = Array.from(monthMap.values()).reduce((sum, b) => sum + b.totalAmount, 0);
  const grandTotal = Number(grandTotalRaw.toFixed(2));

  const months: DailyExpenseMonthlySummaryRow[] = Array.from(monthMap.values())
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((bucket) => {
      let topCategory: string | null = null;
      let topCategoryAmount = 0;
      for (const [catName, catAmt] of bucket.categoryTotals.entries()) {
        if (catAmt > topCategoryAmount || topCategory === null) {
          topCategory = catName;
          topCategoryAmount = catAmt;
        }
      }

      const roundedTotal = Number(bucket.totalAmount.toFixed(2));
      return {
        month: bucket.month,
        monthLabel: formatExpenseMonthLabel(bucket.month),
        year: bucket.month.slice(0, 4),
        entryCount: bucket.entryCount,
        totalAmount: roundedTotal,
        averagePerEntry:
          bucket.entryCount > 0 ? Number((bucket.totalAmount / bucket.entryCount).toFixed(2)) : 0,
        sharePercent:
          grandTotal > 0 ? Number(((bucket.totalAmount / grandTotal) * 100).toFixed(1)) : 0,
        topCategory,
        topCategoryAmount: Number(topCategoryAmount.toFixed(2)),
      };
    });

  const totalEntries = months.reduce((sum, m) => sum + m.entryCount, 0);
  const highestMonth = months.reduce<DailyExpenseMonthlySummaryRow | null>(
    (best, row) => (!best || row.totalAmount > best.totalAmount ? row : best),
    null
  );
  const monthlyAverage =
    months.length > 0 ? Number((grandTotal / months.length).toFixed(2)) : 0;

  return {
    months,
    availableYears,
    totalMonths: months.length,
    totalEntries,
    grandTotal,
    highestMonth,
    monthlyAverage,
  };
}

export function buildMonthlyExpenseAggregateCsv(
  summary: DailyExpenseMonthlySummaryResult,
  currency: string = 'TK'
): string {
  const header = [
    'Month (YYYY-MM)',
    'Month Label',
    'Entries',
    'Top Category',
    'Share (%)',
    `Avg / Entry (${currency})`,
    `Monthly Total (${currency})`,
  ];

  const rows = summary.months.map((row) => [
    row.month,
    row.monthLabel,
    row.entryCount,
    row.topCategory || '-',
    row.sharePercent.toFixed(1),
    row.averagePerEntry.toFixed(2),
    row.totalAmount.toFixed(2),
  ]);

  const footer = [
    'TOTAL',
    `${summary.totalMonths} Month(s)`,
    summary.totalEntries,
    '',
    summary.grandTotal > 0 ? '100.0' : '0.0',
    '',
    summary.grandTotal.toFixed(2),
  ];

  return [header, ...rows, footer]
    .map((line) => line.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');
}


