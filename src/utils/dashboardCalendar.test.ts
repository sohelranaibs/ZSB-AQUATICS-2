import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarActivityMap,
  buildMonthCalendarCells,
  calculateCalendarMonthTotals,
  formatCalendarMonthHeading,
  formatCalendarSelectedDateHeading,
  shiftCalendarMonth,
} from './dashboardCalendar.ts';
import { OtherCostRecord, PackingRecord, PaymentRecord, PurchaseRecord } from '../types/index.ts';

test('shiftCalendarMonth and format helpers handle month transitions and headings accurately', () => {
  assert.equal(formatCalendarMonthHeading('2026-11'), 'November 2026');
  assert.equal(formatCalendarSelectedDateHeading('2026-11-19'), 'Thursday, 19 November 2026');
  assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12');
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01');
});

test('buildMonthCalendarCells produces aligned Sun-Sat weeks with current-month flags', () => {
  // November 2026 starts on Sunday (0 leading blanks) and has 30 days -> 5 weeks = 35 cells
  const nov2026 = buildMonthCalendarCells('2026-11');
  assert.equal(nov2026.length, 35);
  assert.equal(nov2026[0].dateIso, '2026-11-01');
  assert.equal(nov2026[0].inCurrentMonth, true);
  assert.equal(nov2026[29].dateIso, '2026-11-30');
  assert.equal(nov2026[30].dateIso, '2026-12-01');
  assert.equal(nov2026[30].inCurrentMonth, false);

  // August 2026 starts on Saturday (6 leading blanks) + 31 days = 37 -> 6 weeks = 42 cells
  const aug2026 = buildMonthCalendarCells('2026-08');
  assert.equal(aug2026.length, 42);
  assert.equal(aug2026[0].inCurrentMonth, false);
  assert.equal(aug2026[6].dateIso, '2026-08-01');
  assert.equal(aug2026[6].inCurrentMonth, true);
});

test('buildCalendarActivityMap and calculateCalendarMonthTotals aggregate purchases, exports, payments, and expenses by date', () => {
  const purchases: PurchaseRecord[] = [
    {
      id: 'p-1',
      invoiceNumber: 'PUR-01',
      date: '2026-11-19',
      description: 'Satkhira Crab Depot',
      contactNumber: '01700000000',
      items: [],
      totalQty: 120,
      totalAmount: 48000,
      previousAmount: 0,
      paidAmount: 0,
      balance: 48000,
      createdAt: '2026-11-19T06:00:00.000Z',
    },
  ];
  const packings: PackingRecord[] = [
    {
      id: 'pk-1',
      invoiceNumber: 'PKL-01',
      packingDate: '2026-11-19',
      shippingMark: 'KMG',
      flight: 'CZ-392',
      destination: 'KUNMING',
      shipper: 'ZSB AQUATICS',
      fromDate: '2026-11-19',
      toDate: '2026-11-19',
      items: [],
      totalBox: 10,
      totalWeight: 100,
      totalAmount: 5000, // 5000 RMB * 16.5 = 82500 BDT
      rmbRate: 16.5,
      paymentStatus: 'PAID',
      createdAt: '2026-11-19T07:00:00.000Z',
    },
  ];
  const payments: PaymentRecord[] = [
    {
      id: 'pm-1',
      invoiceNumber: 'PAY-01',
      date: '2026-11-15',
      description: 'Supplier A',
      contactNumber: '01700000000',
      items: [],
      totalAmount: 20000,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      createdAt: '2026-11-15T10:00:00.000Z',
    },
  ];
  const otherCosts: OtherCostRecord[] = [
    {
      id: 'oc-1',
      date: '2026-11-19',
      category: 'Office Tea & Pantry',
      amount: 650,
      description: 'Tea and snacks',
      createdAt: '2026-11-19T09:00:00.000Z',
    },
  ];

  const activityMap = buildCalendarActivityMap({
    purchases,
    packings,
    payments,
    otherCosts,
    mortalities: [],
    upcomingRecurringPayments: [],
  });

  const nov19 = activityMap.get('2026-11-19');
  assert.ok(nov19);
  assert.equal(nov19.purchasesCount, 1);
  assert.equal(nov19.purchasesTotal, 48000);
  assert.equal(nov19.packingsCount, 1);
  assert.equal(nov19.packingsTotalBDT, 82500);
  assert.equal(nov19.expensesCount, 1);
  assert.equal(nov19.expensesTotal, 650);
  assert.equal(nov19.totalActivityCount, 3);
  assert.equal(nov19.items.length, 3);

  const novTotals = calculateCalendarMonthTotals(activityMap, '2026-11');
  assert.equal(novTotals.activeDays, 2);
  assert.equal(novTotals.purchasesTotal, 48000);
  assert.equal(novTotals.packingsTotalBDT, 82500);
  assert.equal(novTotals.paymentsTotal, 20000);
  assert.equal(novTotals.expensesTotal, 650);
  assert.equal(novTotals.totalEvents, 4);
});
