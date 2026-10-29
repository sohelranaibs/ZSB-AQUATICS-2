import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNextRecurrenceDate,
  calculateDaysUntilDue,
  classifyPaymentUrgency,
  scanUpcomingRecurringSupplierPayments,
  calculateUpcomingRecurringSummary,
  buildNextCyclePaymentPatch,
} from './recurringPayments.ts';
import { PaymentRecord } from '../types/index.ts';

test('computeNextRecurrenceDate advances dates accurately across weekly, biweekly, monthly, and quarterly frequencies', () => {
  assert.equal(computeNextRecurrenceDate('2026-10-29', 'weekly'), '2026-11-05');
  assert.equal(computeNextRecurrenceDate('2026-10-29', 'biweekly'), '2026-11-12');
  assert.equal(computeNextRecurrenceDate('2026-10-29', 'monthly'), '2026-11-29');
  // Month-end clamping (Jan 31 -> Feb 28 in 2026)
  assert.equal(computeNextRecurrenceDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(computeNextRecurrenceDate('2026-10-15', 'quarterly'), '2027-01-15');
});

test('calculateDaysUntilDue and classifyPaymentUrgency classify today, urgent, upcoming, and scheduled due dates', () => {
  assert.equal(calculateDaysUntilDue('2026-10-29', '2026-10-29'), 0);
  assert.equal(calculateDaysUntilDue('2026-11-01', '2026-10-29'), 3);
  assert.equal(calculateDaysUntilDue('2026-11-04', '2026-10-29'), 6);
  assert.equal(calculateDaysUntilDue('2026-11-15', '2026-10-29'), 17);

  assert.deepEqual(classifyPaymentUrgency(0), {
    urgency: 'due_today',
    urgencyLabel: 'Due Today',
  });
  assert.deepEqual(classifyPaymentUrgency(1), {
    urgency: 'urgent',
    urgencyLabel: 'Due Tomorrow',
  });
  assert.deepEqual(classifyPaymentUrgency(3), {
    urgency: 'urgent',
    urgencyLabel: 'Due in 3 Days',
  });
  assert.deepEqual(classifyPaymentUrgency(6), {
    urgency: 'upcoming',
    urgencyLabel: 'Due in 6 Days',
  });
  assert.deepEqual(classifyPaymentUrgency(14), {
    urgency: 'scheduled',
    urgencyLabel: 'In 14 Days',
  });
});

test('scanUpcomingRecurringSupplierPayments filters future supplier due dates, ignores past/exporter payments, and sorts by urgency', () => {
  const refDate = new Date(2026, 9, 29); // 2026-10-29

  const samplePayments: PaymentRecord[] = [
    // 1. Past completed payment without future dueDate -> should be ignored
    {
      id: 'p-past',
      invoiceNumber: 'PAY-2026-1001',
      date: '2026-10-06',
      description: 'ABDULLAH VAI',
      contactNumber: '+8801711223344',
      items: [],
      totalAmount: 100000,
      previousAmount: 0,
      paidAmount: 100000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      paymentCategory: 'supplier',
      createdAt: '2026-10-06T10:00:00Z',
    },
    // 2. Upcoming recurring payment due in 12 days (monthly)
    {
      id: 'p-monthly',
      invoiceNumber: 'PAY-REC-102',
      date: '2026-10-10',
      dueDate: '2026-11-10',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      description: 'UZZAL VAI',
      contactNumber: '+8801822334455',
      items: [],
      totalAmount: 85000,
      previousAmount: 0,
      paidAmount: 85000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      paymentCategory: 'supplier',
      remarks: 'Monthly live fish retainer',
      createdAt: '2026-10-10T10:00:00Z',
    },
    // 3. Urgent recurring payment due in 2 days (weekly)
    {
      id: 'p-urgent',
      invoiceNumber: 'PAY-REC-101',
      date: '2026-10-24',
      dueDate: '2026-10-31',
      isRecurring: true,
      recurrenceFrequency: 'weekly',
      description: 'ABDULLAH VAI',
      contactNumber: '+8801711223344',
      items: [],
      totalAmount: 120000,
      previousAmount: 0,
      paidAmount: 60000,
      balance: 60000,
      status: 'PAID',
      returnRMB: 0,
      paymentCategory: 'supplier',
      remarks: 'Weekly live eel installment',
      createdAt: '2026-10-24T10:00:00Z',
    },
    // 4. Exporter payment even with future dueDate -> should be ignored (only supplier payments)
    {
      id: 'p-exporter',
      invoiceNumber: 'EXP-2026-999',
      date: '2026-10-20',
      dueDate: '2026-11-02',
      isRecurring: true,
      description: 'GUANGZHOU BUYER',
      contactNumber: '',
      items: [],
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 50000,
      balance: 0,
      status: 'PAID',
      returnRMB: 3000,
      paymentCategory: 'exporter',
      createdAt: '2026-10-20T10:00:00Z',
    },
  ];

  const scanned = scanUpcomingRecurringSupplierPayments(samplePayments, refDate);
  assert.equal(scanned.length, 2);

  // First item should be the urgent one (due in 2 days)
  assert.equal(scanned[0].id, 'p-urgent');
  assert.equal(scanned[0].supplierName, 'ABDULLAH VAI');
  assert.equal(scanned[0].daysUntilDue, 2);
  assert.equal(scanned[0].urgency, 'urgent');
  assert.equal(scanned[0].amountDue, 60000); // uses balance when balance > 0
  assert.equal(scanned[0].nextProjectedDate, '2026-11-07');

  // Second item should be the scheduled monthly one (due in 12 days)
  assert.equal(scanned[1].id, 'p-monthly');
  assert.equal(scanned[1].supplierName, 'UZZAL VAI');
  assert.equal(scanned[1].daysUntilDue, 12);
  assert.equal(scanned[1].urgency, 'scheduled');
  assert.equal(scanned[1].amountDue, 85000);
  assert.equal(scanned[1].nextProjectedDate, '2026-12-10');

  // Verify summary calculations
  const summary = calculateUpcomingRecurringSummary(scanned);
  assert.equal(summary.totalScheduledCount, 2);
  assert.equal(summary.totalUpcomingAmount, 145000);
  assert.equal(summary.dueWithin7DaysCount, 1);
  assert.equal(summary.dueWithin7DaysAmount, 60000);
  assert.equal(summary.urgentCount, 1);
  assert.equal(summary.uniqueSuppliersCount, 2);

  // Verify next cycle patch generation
  const patch = buildNextCyclePaymentPatch(scanned[0]);
  assert.equal(patch.date, '2026-10-31');
  assert.equal(patch.dueDate, '2026-11-07');
  assert.equal(patch.isRecurring, true);
  assert.equal(patch.recurrenceFrequency, 'weekly');
});
