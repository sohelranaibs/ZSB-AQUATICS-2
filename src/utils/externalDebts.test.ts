import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExternalDebtsSummary,
  computeExternalDebtTotalObligation,
  generateExternalDebtSchedule,
  validateExternalDebtInput,
  validateExternalDebtRepaymentInput,
} from './externalDebts.ts';
import type { ExternalDebtRecord } from '../types/index.ts';

test('validateExternalDebtInput validates required fields, positive principal, and due date ordering', () => {
  assert.equal(
    validateExternalDebtInput({
      title: '',
      lenderName: 'Islami Bank',
      category: 'Bank Business Loan',
      originationDate: '2026-10-01',
      principalAmount: 100000,
      interestAmount: 0,
      frequency: 'monthly',
      installmentCount: 6,
      firstDueDate: '2026-11-01',
    }).valid,
    false
  );

  assert.equal(
    validateExternalDebtInput({
      title: 'Bridge Loan',
      lenderName: 'Lender',
      category: 'Short-Term Bridge Loan',
      originationDate: '2026-10-15',
      principalAmount: 50000,
      interestAmount: 0,
      frequency: 'one_time',
      installmentCount: 1,
      firstDueDate: '2026-10-10', // before origination
    }).valid,
    false
  );

  const ok = validateExternalDebtInput({
    title: '  Working Capital Credit ',
    lenderName: ' Islami Bank ',
    category: 'Bank Business Loan',
    originationDate: '2026-10-01',
    principalAmount: '200000.50',
    interestAmount: '10000',
    frequency: 'monthly',
    installmentCount: 6,
    firstDueDate: '2026-11-01',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.cleanTitle, 'Working Capital Credit');
  assert.equal(ok.cleanLenderName, 'Islami Bank');
  assert.equal(ok.cleanPrincipal, 200000.5);
  assert.equal(ok.cleanInterest, 10000);
  assert.equal(ok.cleanInstallmentCount, 6);
});

test('validateExternalDebtRepaymentInput guards against non-positive amounts and overpayments', () => {
  assert.equal(
    validateExternalDebtRepaymentInput({
      date: '2026-11-01',
      amount: 0,
      remainingBalance: 50000,
    }).valid,
    false
  );
  assert.equal(
    validateExternalDebtRepaymentInput({
      date: '2026-11-01',
      amount: 60000,
      remainingBalance: 50000,
    }).valid,
    false
  );
  const ok = validateExternalDebtRepaymentInput({
    date: '2026-11-01',
    amount: 25000,
    remainingBalance: 50000,
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.cleanAmount, 25000);
});

test('generateExternalDebtSchedule reconciles odd cents and allocates FIFO repayments cleanly', () => {
  const debt: ExternalDebtRecord = {
    id: 'debt-1',
    title: 'Trade Credit Facility',
    lenderName: 'Apex Cold Storage',
    category: 'Cold Storage / Cargo Credit',
    originationDate: '2026-08-31',
    principalAmount: 100000,
    interestAmount: 0,
    frequency: 'monthly',
    installmentCount: 3,
    firstDueDate: '2026-09-30',
    repayments: [
      {
        id: 'rep-1',
        date: '2026-09-30',
        amount: 40000,
        paymentMethod: 'Bank Transfer',
        createdAt: '2026-09-30T10:00:00Z',
      },
    ],
    createdAt: '2026-08-31T08:00:00Z',
  };

  assert.equal(computeExternalDebtTotalObligation(debt), 100000);

  const sched = generateExternalDebtSchedule(debt, '2026-11-15');
  assert.equal(sched.totalObligation, 100000);
  assert.equal(sched.totalPaid, 40000);
  assert.equal(sched.remainingBalance, 60000);
  assert.equal(sched.progressPercent, 40);
  assert.equal(sched.installments.length, 3);

  // Cent reconciliation across 3 installments: 33333.33 + 33333.33 + 33333.34 = 100000
  const scheduledTotal =
    Math.round(sched.installments.reduce((s, r) => s + r.scheduledAmount, 0) * 100) / 100;
  assert.equal(scheduledTotal, 100000);
  assert.equal(sched.installments[0].status, 'PAID');
  assert.equal(sched.installments[0].remainingAmount, 0);

  // 40,000 paid covers #1 (33333.33) + 6666.67 of #2 (due 2026-10-30 -> OVERDUE as of 2026-11-15)
  assert.equal(sched.installments[1].paidAmount, 6666.67);
  assert.equal(sched.installments[1].remainingAmount, 26666.66);
  assert.equal(sched.installments[1].status, 'OVERDUE');
  assert.equal(sched.installments[2].dueDate, '2026-11-30');
  assert.equal(sched.installments[2].status, 'UPCOMING');
  assert.equal(sched.debtStatus, 'OVERDUE');
  assert.equal(sched.overdueInstallmentCount, 1);
  assert.equal(sched.nextDueInstallment?.installmentNumber, 2);
});

test('calculateExternalDebtsSummary aggregates active, settled, and next-due across multiple debts', () => {
  const debts: ExternalDebtRecord[] = [
    {
      id: 'debt-a',
      title: 'Paid Bridge Loan',
      lenderName: 'Lender A',
      category: 'Short-Term Bridge Loan',
      originationDate: '2026-09-01',
      principalAmount: 50000,
      interestAmount: 0,
      frequency: 'one_time',
      installmentCount: 1,
      firstDueDate: '2026-10-01',
      repayments: [
        {
          id: 'r1',
          date: '2026-10-01',
          amount: 50000,
          createdAt: '2026-10-01T10:00:00Z',
        },
      ],
      createdAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'debt-b',
      title: 'Working Capital Loan',
      lenderName: 'Islami Bank',
      category: 'Bank Business Loan',
      originationDate: '2026-11-01',
      principalAmount: 180000,
      interestAmount: 20000,
      frequency: 'biweekly',
      installmentCount: 4,
      firstDueDate: '2026-11-20',
      repayments: [],
      createdAt: '2026-11-01T10:00:00Z',
    },
  ];

  const summary = calculateExternalDebtsSummary(debts, '2026-11-15');
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.settledCount, 1);
  assert.equal(summary.activeCount, 1);
  assert.equal(summary.totalPrincipal, 230000);
  assert.equal(summary.totalInterest, 20000);
  assert.equal(summary.totalObligation, 250000);
  assert.equal(summary.totalPaid, 50000);
  assert.equal(summary.totalRemaining, 200000);
  assert.equal(summary.overallProgressPercent, 20);
  assert.equal(summary.nextDue?.debtId, 'debt-b');
  assert.equal(summary.nextDue?.dueDate, '2026-11-20');
  assert.equal(summary.nextDue?.remainingAmount, 50000);
  assert.equal(summary.nextDue?.isOverdue, false);
});
