import test from 'node:test';
import assert from 'node:assert/strict';
import { OtherCostRecord, RecurringExpenseRecord } from '../types/index.ts';
import {
  addMonthsToYearMonth,
  buildRecurringCostDeductionRecord,
  calculateRecurringExpenseSummary,
  clampBillingDate,
  enumerateYearMonths,
  getDueRecurringExpenseCycles,
  getRecurringRuleStatus,
  validateRecurringExpenseInput,
} from './recurringExpenses.ts';

const makeRule = (overrides: Partial<RecurringExpenseRecord> = {}): RecurringExpenseRecord => ({
  id: 'rec-1',
  title: 'Office & Warehouse Rent',
  category: 'Office & Overhead Expenses',
  amount: 50000,
  billingDay: 1,
  startYearMonth: '2026-10',
  autoDeduct: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const makeCost = (overrides: Partial<OtherCostRecord> = {}): OtherCostRecord => ({
  id: 'cost-1',
  date: '2026-10-01',
  category: 'Office & Overhead Expenses',
  amount: 50000,
  description: 'Office & Warehouse Rent (Auto Monthly Fixed Cost — 2026-10)',
  refInvoice: 'AUTO-REC-2026-10',
  recurringExpenseId: 'rec-1',
  recurringYearMonth: '2026-10',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

test('clampBillingDate safely clamps month-end days across short and leap months', () => {
  assert.equal(clampBillingDate('2026-02', 31), '2026-02-28');
  assert.equal(clampBillingDate('2024-02', 31), '2024-02-29'); // leap year
  assert.equal(clampBillingDate('2026-04', 31), '2026-04-30');
  assert.equal(clampBillingDate('2026-11', 15), '2026-11-15');
  assert.equal(clampBillingDate('2026-11', 0), '2026-11-01');
});

test('addMonthsToYearMonth and enumerateYearMonths handle year boundaries accurately', () => {
  assert.equal(addMonthsToYearMonth('2025-11', 3), '2026-02');
  assert.equal(addMonthsToYearMonth('2026-01', -1), '2025-12');
  assert.deepEqual(enumerateYearMonths('2026-10', '2027-01'), [
    '2026-10',
    '2026-11',
    '2026-12',
    '2027-01',
  ]);
  assert.deepEqual(enumerateYearMonths('2026-12', '2026-10'), []);
});

test('validateRecurringExpenseInput enforces title, positive amount, valid billing day 1-31, and YYYY-MM', () => {
  const badTitle = validateRecurringExpenseInput({
    title: 'A',
    category: 'Office & Overhead Expenses',
    amount: '1000',
    billingDay: '5',
    startYearMonth: '2026-11',
  });
  assert.equal(badTitle.valid, false);

  const badAmount = validateRecurringExpenseInput({
    title: 'Internet',
    category: 'Office & Overhead Expenses',
    amount: '0',
    billingDay: '5',
    startYearMonth: '2026-11',
  });
  assert.equal(badAmount.valid, false);

  const badDay = validateRecurringExpenseInput({
    title: 'Internet',
    category: 'Office & Overhead Expenses',
    amount: '2500',
    billingDay: '32',
    startYearMonth: '2026-11',
  });
  assert.equal(badDay.valid, false);

  const badMonth = validateRecurringExpenseInput({
    title: 'Internet',
    category: 'Office & Overhead Expenses',
    amount: '2500',
    billingDay: '5',
    startYearMonth: '2026-13',
  });
  assert.equal(badMonth.valid, false);

  const validRes = validateRecurringExpenseInput({
    title: '  Fiber Internet & Wi-Fi  ',
    category: 'Office & Overhead Expenses',
    amount: '4500.556',
    billingDay: '15',
    startYearMonth: '2026-11',
  });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.cleanTitle, 'Fiber Internet & Wi-Fi');
  assert.equal(validRes.cleanAmount, 4500.56);
  assert.equal(validRes.cleanBillingDay, 15);
});

test('getDueRecurringExpenseCycles catches missed past/current months and enforces idempotency', () => {
  const rules: RecurringExpenseRecord[] = [
    makeRule({ id: 'rec-rent', startYearMonth: '2026-09', billingDay: 5, autoDeduct: true }),
    makeRule({
      id: 'rec-software',
      title: 'Cloud ERP',
      amount: 12000,
      startYearMonth: '2026-11',
      billingDay: 25, // not yet due on 2026-11-15
      autoDeduct: true,
    }),
    makeRule({
      id: 'rec-paused',
      title: 'Paused Ad Spend',
      amount: 8000,
      startYearMonth: '2026-09',
      billingDay: 1,
      autoDeduct: false,
    }),
  ];

  // 2026-09 already deducted for rec-rent; 2026-10 and 2026-11 still missing
  const existingCosts: OtherCostRecord[] = [
    makeCost({
      id: 'cost-sept',
      recurringExpenseId: 'rec-rent',
      recurringYearMonth: '2026-09',
      date: '2026-09-05',
    }),
  ];

  const due = getDueRecurringExpenseCycles(rules, existingCosts, '2026-11-15');
  assert.equal(due.length, 2);
  assert.equal(due[0].rule.id, 'rec-rent');
  assert.equal(due[0].yearMonth, '2026-10');
  assert.equal(due[0].billingDate, '2026-10-05');
  assert.equal(due[1].rule.id, 'rec-rent');
  assert.equal(due[1].yearMonth, '2026-11');
  assert.equal(due[1].billingDate, '2026-11-05');

  // Once both generated deductions are added to existingCosts, running again produces 0 due cycles
  const afterPosting: OtherCostRecord[] = [
    ...existingCosts,
    ...due.map((cycle, idx) => ({
      ...buildRecurringCostDeductionRecord(cycle.rule, cycle.yearMonth),
      id: `cost-gen-${idx}`,
      createdAt: '2026-11-15T00:00:00.000Z',
    })),
  ];
  assert.equal(getDueRecurringExpenseCycles(rules, afterPosting, '2026-11-15').length, 0);
});

test('getRecurringRuleStatus and calculateRecurringExpenseSummary report paid status, next date, and totals', () => {
  const rentRule = makeRule({
    id: 'rec-rent',
    amount: 50000,
    billingDay: 1,
    startYearMonth: '2026-10',
    autoDeduct: true,
  });
  const internetRule = makeRule({
    id: 'rec-net',
    title: 'Internet',
    amount: 5000,
    billingDay: 20,
    startYearMonth: '2026-11',
    autoDeduct: true,
  });
  const pausedRule = makeRule({
    id: 'rec-paused',
    title: 'Newsletter',
    amount: 3000,
    billingDay: 10,
    startYearMonth: '2026-11',
    autoDeduct: false,
  });

  const existingCosts: OtherCostRecord[] = [
    makeCost({
      id: 'c1',
      recurringExpenseId: 'rec-rent',
      recurringYearMonth: '2026-10',
      amount: 50000,
      date: '2026-10-01',
    }),
    makeCost({
      id: 'c2',
      recurringExpenseId: 'rec-rent',
      recurringYearMonth: '2026-11',
      amount: 50000,
      date: '2026-11-01',
    }),
  ];

  const rentStatus = getRecurringRuleStatus(rentRule, existingCosts, '2026-11-15');
  assert.equal(rentStatus.currentMonthPaid, true);
  assert.equal(rentStatus.nextBillingDate, '2026-12-01');
  assert.equal(rentStatus.lastDeductedYearMonth, '2026-11');
  assert.equal(rentStatus.deductionCount, 2);
  assert.equal(rentStatus.totalDeductedAmount, 100000);

  const internetStatus = getRecurringRuleStatus(internetRule, existingCosts, '2026-11-15');
  assert.equal(internetStatus.currentMonthPaid, false);
  assert.equal(internetStatus.nextBillingDate, '2026-11-20');
  assert.equal(internetStatus.isDueTodayOrEarlier, false);

  const summary = calculateRecurringExpenseSummary(
    [rentRule, internetRule, pausedRule],
    existingCosts,
    '2026-11-15'
  );
  assert.equal(summary.totalRules, 3);
  assert.equal(summary.activeRules, 2);
  assert.equal(summary.pausedRules, 1);
  assert.equal(summary.monthlyFixedCommitment, 55000);
  assert.equal(summary.allRulesMonthlyTotal, 58000);
  assert.equal(summary.dueCycleCount, 0);
  assert.equal(summary.totalAutoDeductedAllTime, 100000);
  assert.equal(summary.thisMonthDeducted, 50000);
});
