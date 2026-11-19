import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyExpenseCsv,
  buildMonthlyExpenseAggregateCsv,
  calculateDailyExpenseSummary,
  calculateMonthlyExpenseAggregate,
  calculateVisibleRowsScrollHeight,
  DAILY_EXPENSE_VISIBLE_ROWS,
  formatExpenseMonthLabel,
  mergeExpenseCategories,
  validateDailyExpenseInput,
} from './dailyExpense.ts';
import { OtherCostRecord } from '../types/index.ts';

const SAMPLE_EXPENSES: OtherCostRecord[] = [
  {
    id: 'cost-1',
    date: '2026-11-19',
    category: 'Office Tea, Snacks & Pantry',
    amount: 450,
    description: 'Morning office tea & guest biscuits',
    paymentMethod: 'Cash',
    paidBy: 'Sohel',
    refInvoice: 'EXP-101',
    createdAt: '2026-11-19T08:00:00.000Z',
  },
  {
    id: 'cost-2',
    date: '2026-11-19',
    category: 'Staff Conveyance & Fuel',
    amount: 1200,
    description: 'Airport pickup motorbike fuel',
    paymentMethod: 'Petty Cash',
    paidBy: 'Rafiq',
    refInvoice: 'EXP-102',
    createdAt: '2026-11-19T11:30:00.000Z',
  },
  {
    id: 'cost-3',
    date: '2026-11-15',
    category: 'Office Rent & Utilities',
    amount: 18500,
    description: 'November electricity & internet bill',
    paymentMethod: 'Bank Transfer',
    paidBy: 'Mizanur',
    refInvoice: 'UTL-11',
    createdAt: '2026-11-15T10:00:00.000Z',
  },
  {
    id: 'cost-4',
    date: '2026-10-28',
    category: 'Staff Conveyance & Fuel',
    amount: 800,
    description: 'Prior month messenger rickshaw fare',
    paymentMethod: 'Cash',
    paidBy: 'Tareq',
    createdAt: '2026-10-28T09:00:00.000Z',
  },
];

test('mergeExpenseCategories merges configured, default, and recorded categories cleanly', () => {
  const merged = mergeExpenseCategories(
    ['Air Freight & Cargo', 'office & overhead expenses'],
    SAMPLE_EXPENSES
  );
  assert.ok(merged.includes('Air Freight & Cargo'));
  assert.ok(merged.includes('Office Tea, Snacks & Pantry'));
  const overheadMatches = merged.filter((c) => c.toLowerCase() === 'office & overhead expenses');
  assert.equal(overheadMatches.length, 1);
});

test('validateDailyExpenseInput enforces required date, category, positive amount, and particulars', () => {
  assert.equal(
    validateDailyExpenseInput({
      date: '',
      category: 'Office Tea, Snacks & Pantry',
      amount: 500,
      description: 'Tea',
    }).valid,
    false
  );

  assert.equal(
    validateDailyExpenseInput({
      date: '2026-11-19',
      category: '',
      amount: 500,
      description: 'Tea',
    }).valid,
    false
  );

  assert.equal(
    validateDailyExpenseInput({
      date: '2026-11-19',
      category: 'Office Tea, Snacks & Pantry',
      amount: '0',
      description: 'Tea',
    }).valid,
    false
  );

  assert.equal(
    validateDailyExpenseInput({
      date: '2026-11-19',
      category: 'Office Tea, Snacks & Pantry',
      amount: 350,
      description: '   ',
    }).valid,
    false
  );

  const ok = validateDailyExpenseInput({
    date: '2026-11-19',
    category: '  Staff Conveyance & Fuel  ',
    amount: '1,250.5',
    description: '  CNG fare to Dhaka Airport  ',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.normalizedAmount, 1250.5);
  assert.equal(ok.normalizedCategory, 'Staff Conveyance & Fuel');
  assert.equal(ok.normalizedDescription, 'CNG fare to Dhaka Airport');
});

test('calculateDailyExpenseSummary computes today, day, month, all-time, category shares, and search filtering', () => {
  const daySummary = calculateDailyExpenseSummary(SAMPLE_EXPENSES, {
    todayDate: '2026-11-19',
    selectedDate: '2026-11-19',
    selectedMonth: '2026-11',
    scope: 'day',
    filterCategory: 'ALL',
    searchQuery: '',
  });

  assert.equal(daySummary.todayCount, 2);
  assert.equal(daySummary.todayTotal, 1650);
  assert.equal(daySummary.selectedMonthCount, 3);
  assert.equal(daySummary.selectedMonthTotal, 20150);
  assert.equal(daySummary.allTimeCount, 4);
  assert.equal(daySummary.allTimeTotal, 20950);
  assert.equal(daySummary.filteredCount, 2);
  assert.equal(daySummary.filteredTotal, 1650);
  assert.equal(daySummary.topCategory?.category, 'Staff Conveyance & Fuel');
  assert.equal(daySummary.dailyGroupedTotals.length, 2);
  assert.equal(daySummary.dailyGroupedTotals[0].date, '2026-11-19');

  const monthFiltered = calculateDailyExpenseSummary(SAMPLE_EXPENSES, {
    todayDate: '2026-11-19',
    selectedDate: '2026-11-19',
    selectedMonth: '2026-11',
    scope: 'month',
    filterCategory: 'Office Rent & Utilities',
    searchQuery: 'electricity',
  });
  assert.equal(monthFiltered.filteredCount, 1);
  assert.equal(monthFiltered.filteredTotal, 18500);
});

test('buildDailyExpenseCsv exports RFC-4180 CSV rows with quoted fields and grand total footer', () => {
  const csv = buildDailyExpenseCsv(SAMPLE_EXPENSES.slice(0, 2), 'TK');
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /Amount \(TK\)/);
  assert.match(lines[1], /"Office Tea, Snacks & Pantry"/);
  assert.match(lines[3], /^TOTAL,,2 Entries,,,,/);
  assert.match(lines[3], /,1650\.00$/);
});

test('calculateVisibleRowsScrollHeight limits scrollable viewport to 10 rows only when count exceeds 10', () => {
  assert.equal(DAILY_EXPENSE_VISIBLE_ROWS, 10);

  // 10 or fewer rows -> null (no fixed scroll height restriction)
  assert.equal(
    calculateVisibleRowsScrollHeight({
      headerHeight: 38,
      rowHeights: Array(10).fill(40),
      footerHeight: 36,
      borderHeight: 2,
    }),
    null
  );

  // More than 10 rows -> sums only the first 10 rows + sticky header + sticky footer + border
  const exactHeight = calculateVisibleRowsScrollHeight({
    headerHeight: 38,
    rowHeights: [...Array(10).fill(42), 55, 60, 42],
    footerHeight: 36,
    borderHeight: 2,
  });
  assert.equal(exactHeight, 38 + 420 + 36 + 2);
});

test('calculateMonthlyExpenseAggregate groups, filters by year/category/search, and sums expenses by month', () => {
  assert.equal(formatExpenseMonthLabel('2026-11'), 'November 2026');

  const multiYearExpenses: OtherCostRecord[] = [
    ...SAMPLE_EXPENSES,
    {
      id: 'cost-5',
      date: '2025-12-10',
      category: 'Staff Conveyance & Fuel',
      amount: 1500,
      description: 'Year-end courier & dispatch bike fuel',
      paymentMethod: 'Cash',
      paidBy: 'Karim',
      createdAt: '2025-12-10T10:00:00.000Z',
    },
  ];

  // Unfiltered aggregate across all years
  const allAgg = calculateMonthlyExpenseAggregate(multiYearExpenses);
  assert.deepEqual(allAgg.availableYears, ['2026', '2025']);
  assert.equal(allAgg.totalMonths, 3);
  assert.equal(allAgg.totalEntries, 5);
  assert.equal(allAgg.grandTotal, 22450);
  assert.equal(allAgg.months[0].month, '2026-11');
  assert.equal(allAgg.months[0].monthLabel, 'November 2026');
  assert.equal(allAgg.months[0].entryCount, 3);
  assert.equal(allAgg.months[0].totalAmount, 20150);
  assert.equal(allAgg.months[0].topCategory, 'Office Rent & Utilities');
  assert.equal(allAgg.months[1].month, '2026-10');
  assert.equal(allAgg.months[2].month, '2025-12');
  assert.equal(allAgg.highestMonth?.month, '2026-11');

  // Filter by year = 2026 and category = Staff Conveyance & Fuel
  const fuel2026 = calculateMonthlyExpenseAggregate(multiYearExpenses, {
    yearFilter: '2026',
    categoryFilter: 'Staff Conveyance & Fuel',
  });
  assert.equal(fuel2026.totalMonths, 2);
  assert.equal(fuel2026.totalEntries, 2);
  assert.equal(fuel2026.grandTotal, 2000);
  assert.equal(fuel2026.monthlyAverage, 1000);
  assert.equal(fuel2026.months[0].month, '2026-11');
  assert.equal(fuel2026.months[0].totalAmount, 1200);
  assert.equal(fuel2026.months[1].month, '2026-10');
  assert.equal(fuel2026.months[1].totalAmount, 800);

  // Filter by month search query
  const searchOct = calculateMonthlyExpenseAggregate(multiYearExpenses, {
    searchQuery: 'October',
  });
  assert.equal(searchOct.totalMonths, 1);
  assert.equal(searchOct.grandTotal, 800);

  // CSV summary export check
  const csv = buildMonthlyExpenseAggregateCsv(fuel2026, 'TK');
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /Monthly Total \(TK\)/);
  assert.match(lines[1], /^2026-11,November 2026,1,/);
  assert.match(lines[3], /^TOTAL,2 Month\(s\),2,,100\.0,,2000\.00$/);
});


