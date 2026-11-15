import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboardAlertsReport,
  evaluateExpiringDocumentAlerts,
  evaluateRecurringPaymentDeadlineAlerts,
  evaluateTotalBalanceWarning,
  extendDocumentExpiryByOneYear,
  filterDashboardAlerts,
  validateBusinessDocumentInput,
} from './dashboardAlerts.ts';
import type {
  BusinessDocumentRecord,
  ExternalDebtRecord,
  PaymentRecord,
  RecurringExpenseRecord,
} from '../types/index.ts';

test('validateBusinessDocumentInput validates required title, valid expiry date, and issue-before-expiry ordering', () => {
  const missingTitle = validateBusinessDocumentInput({
    title: 'A',
    category: 'Export License',
    expiryDate: '2026-12-01',
  });
  assert.equal(missingTitle.valid, false);

  const badDate = validateBusinessDocumentInput({
    title: 'Trade License',
    category: 'Trade License',
    expiryDate: '2026-02-30',
  });
  assert.equal(badDate.valid, false);

  const reversedDates = validateBusinessDocumentInput({
    title: 'Quarantine Certificate',
    category: 'Quarantine / Health Certificate',
    issueDate: '2026-12-10',
    expiryDate: '2026-11-30',
  });
  assert.equal(reversedDates.valid, false);

  const valid = validateBusinessDocumentInput({
    title: '  Export Registration Certificate  ',
    category: 'Export License',
    referenceNumber: 'ERC-2026-88',
    issueDate: '2025-11-20',
    expiryDate: '2026-11-20',
    notes: 'Ministry of Commerce renewal',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.cleanTitle, 'Export Registration Certificate');
  assert.equal(valid.cleanReferenceNumber, 'ERC-2026-88');
  assert.equal(valid.cleanExpiryDate, '2026-11-20');
});

test('evaluateExpiringDocumentAlerts flags expired and upcoming documents within window and ignores far-future valid docs', () => {
  const docs: BusinessDocumentRecord[] = [
    {
      id: 'doc-expired',
      title: 'Air Cargo Permit',
      category: 'Airline / Cargo Permit',
      expiryDate: '2026-11-10',
      createdAt: '2025-11-10T00:00:00.000Z',
    },
    {
      id: 'doc-soon-crit',
      title: 'Quarantine Certificate',
      category: 'Quarantine / Health Certificate',
      expiryDate: '2026-11-18',
      createdAt: '2025-11-18T00:00:00.000Z',
    },
    {
      id: 'doc-soon-warn',
      title: 'Trade License',
      category: 'Trade License',
      expiryDate: '2026-12-05',
      createdAt: '2025-12-05T00:00:00.000Z',
    },
    {
      id: 'doc-far-valid',
      title: 'Customs Bond',
      category: 'Customs Bond / Insurance',
      expiryDate: '2027-06-01',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ];

  const alerts = evaluateExpiringDocumentAlerts(docs, '2026-11-15', 30);
  assert.equal(alerts.length, 3);
  assert.equal(alerts[0].severity, 'critical');
  assert.equal(alerts[0].statusLabel, 'Expired 5d ago');
  assert.equal(alerts[1].severity, 'critical');
  assert.equal(alerts[1].statusLabel, 'Expires in 3d');
  assert.equal(alerts[2].severity, 'warning');
  assert.equal(alerts[2].statusLabel, 'Expires in 20d');

  // One-year renewal shifts expired doc from referenceDate and future doc from expiryDate
  assert.equal(extendDocumentExpiryByOneYear('2026-11-10', '2026-11-15'), '2027-11-15');
  assert.equal(extendDocumentExpiryByOneYear('2026-12-05', '2026-11-15'), '2027-12-05');
});

test('evaluateRecurringPaymentDeadlineAlerts aggregates supplier vouchers, recurring expenses, and external debt installments', () => {
  const refDate = new Date(2026, 10, 15, 10, 0, 0); // 2026-11-15

  const payments: PaymentRecord[] = [
    {
      id: 'pay-rec-1',
      invoiceNumber: 'PAY-2026-101',
      date: '2026-11-01',
      dueDate: '2026-11-17',
      isRecurring: true,
      recurrenceFrequency: 'biweekly',
      description: 'ABDULLAH VAI',
      contactNumber: '01700000000',
      items: [],
      totalAmount: 45000,
      previousAmount: 0,
      paidAmount: 0,
      balance: 45000,
      status: 'UNPAID',
      returnRMB: 0,
      paymentCategory: 'supplier',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];

  const recurringExpenses: RecurringExpenseRecord[] = [
    {
      id: 'rexp-1',
      title: 'Cold Storage Warehouse Rent',
      category: 'Office & Overhead Expenses',
      amount: 35000,
      billingDay: 20,
      startYearMonth: '2026-11',
      autoDeduct: true,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: 'rexp-paused',
      title: 'Paused Guard Service',
      category: 'Miscellaneous Expense',
      amount: 8000,
      billingDay: 16,
      startYearMonth: '2026-11',
      autoDeduct: false,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];

  const externalDebts: ExternalDebtRecord[] = [
    {
      id: 'edebt-1',
      title: 'Working Capital Loan',
      lenderName: 'Prime Bank',
      category: 'Bank Business Loan',
      originationDate: '2026-10-01',
      principalAmount: 100000,
      interestAmount: 0,
      frequency: 'monthly',
      installmentCount: 4,
      firstDueDate: '2026-11-12', // 3 days overdue relative to 2026-11-15
      repayments: [],
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const alerts = evaluateRecurringPaymentDeadlineAlerts({
    payments,
    recurringExpenses,
    otherCosts: [],
    externalDebts,
    currency: 'TK',
    referenceDate: refDate,
    windowDays: 14,
  });

  assert.equal(alerts.length, 3);
  const sources = new Set(alerts.map((a) => a.recurringSource));
  assert.equal(sources.has('supplier_voucher'), true);
  assert.equal(sources.has('recurring_expense'), true);
  assert.equal(sources.has('external_debt'), true);

  const debtAlert = alerts.find((a) => a.recurringSource === 'external_debt');
  assert.equal(debtAlert?.severity, 'critical');
  assert.equal(debtAlert?.statusLabel, 'Overdue 3d');
  assert.equal(debtAlert?.amount, 25000);
});

test('evaluateTotalBalanceWarning detects deficit, critical low, warning low, approaching, and healthy states', () => {
  const deficit = evaluateTotalBalanceWarning({ totalBalance: -15000, minThreshold: 100000 });
  assert.equal(deficit.health.status, 'critical_deficit');
  assert.equal(deficit.alert?.severity, 'critical');

  const criticalLow = evaluateTotalBalanceWarning({ totalBalance: 30000, minThreshold: 100000 });
  assert.equal(criticalLow.health.status, 'critical_low');
  assert.equal(criticalLow.alert?.severity, 'critical');

  const warningLow = evaluateTotalBalanceWarning({ totalBalance: 85000, minThreshold: 100000 });
  assert.equal(warningLow.health.status, 'warning_low');
  assert.equal(warningLow.alert?.severity, 'warning');

  const approaching = evaluateTotalBalanceWarning({ totalBalance: 115000, minThreshold: 100000 });
  assert.equal(approaching.health.status, 'approaching_low');
  assert.equal(approaching.alert?.severity, 'warning');

  const healthy = evaluateTotalBalanceWarning({ totalBalance: 250000, minThreshold: 100000 });
  assert.equal(healthy.health.status, 'healthy');
  assert.equal(healthy.alert, null);
  assert.equal(healthy.health.bufferAmount, 150000);
});

test('buildDashboardAlertsReport prioritizes critical alerts and supports category filtering', () => {
  const refDate = new Date(2026, 10, 15, 10, 0, 0);
  const report = buildDashboardAlertsReport({
    documents: [
      {
        id: 'd1',
        title: 'Export License',
        category: 'Export License',
        expiryDate: '2026-12-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payments: [],
    recurringExpenses: [
      {
        id: 'r1',
        title: 'Office Rent',
        category: 'Office & Overhead Expenses',
        amount: 20000,
        billingDay: 16,
        startYearMonth: '2026-11',
        autoDeduct: true,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ],
    otherCosts: [],
    externalDebts: [],
    totalBalance: 40000,
    minTotalBalanceThreshold: 100000,
    currency: 'TK',
    referenceDate: refDate,
  });

  assert.equal(report.counts.total, 3);
  assert.equal(report.counts.critical, 2); // critical low balance + 1d due expense
  assert.equal(report.counts.warning, 1); // expiring doc in 16d
  assert.equal(report.counts.expiringDocuments, 1);
  assert.equal(report.counts.recurringDeadlines, 1);
  assert.equal(report.counts.lowBalance, 1);
  assert.equal(filterDashboardAlerts(report.items, 'expiring_document').length, 1);
  assert.equal(filterDashboardAlerts(report.items, 'recurring_payment').length, 1);
  assert.equal(filterDashboardAlerts(report.items, 'low_balance').length, 1);
});
