import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailyProfitLossReport,
  getWeekdayShortLabel,
  DAILY_PL_ROW_BATCH_SIZE,
  getVisibleDailyProfitLossWindow,
  shouldLoadMoreOnScroll,
  getNextDailyProfitLossRowLimit,
} from './dailyProfitLoss.ts';
import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

const samplePurchases: PurchaseRecord[] = [
  {
    id: 'pur-1',
    invoiceNumber: 'PUR-2026-0001',
    date: '2026-10-28',
    description: 'ABDULLAH VAI',
    contactNumber: '01700000001',
    items: [
      {
        id: '1',
        item: 'FF1',
        quantity: 100,
        rate: 500,
        totalAmount: 50000,
        previousAmount: 0,
        paidAmount: 0,
        balance: 50000,
      },
    ],
    totalQty: 100,
    totalAmount: 50000,
    previousAmount: 0,
    paidAmount: 20000,
    balance: 30000,
    createdAt: '2026-10-28T08:00:00Z',
  },
  {
    id: 'pur-2',
    invoiceNumber: 'PUR-2026-0002',
    date: '2026-10-30',
    description: 'KORIM TRADER',
    contactNumber: '01700000002',
    items: [
      {
        id: '1',
        item: 'KS/3',
        quantity: 80,
        rate: 600,
        totalAmount: 48000,
        previousAmount: 0,
        paidAmount: 0,
        balance: 48000,
      },
    ],
    totalQty: 80,
    totalAmount: 48000,
    previousAmount: 0,
    paidAmount: 10000,
    balance: 38000,
    createdAt: '2026-10-30T08:00:00Z',
  },
];

const samplePackings: PackingRecord[] = [
  {
    id: 'pkg-1',
    invoiceNumber: 'PKG-2026-0001',
    shippingMark: 'ZSB-HK-01',
    flight: 'CZ-392',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    packingDate: '2026-10-28',
    fromDate: '2026-10-28',
    toDate: '2026-10-28',
    items: [],
    totalBox: 10,
    totalWeight: 160,
    totalAmount: 5000, // 5000 RMB
    rmbRate: 16.5, // 82,500 BDT
    totalAmountBDT: 82500,
    createdAt: '2026-10-28T10:00:00Z',
  },
  {
    id: 'pkg-2',
    invoiceNumber: 'PKG-2026-0002',
    shippingMark: 'ZSB-SH-02',
    flight: 'MU-2036',
    destination: 'SHANGHAI',
    shipper: 'ZSB AQUATICS',
    packingDate: '2026-10-30',
    fromDate: '2026-10-30',
    toDate: '2026-10-30',
    items: [],
    totalBox: 5,
    totalWeight: 80,
    totalAmount: 2000, // 2000 RMB
    rmbRate: 16.5, // 33,000 BDT
    totalAmountBDT: 33000,
    createdAt: '2026-10-30T10:00:00Z',
  },
];

const sampleOtherCosts: OtherCostRecord[] = [
  {
    id: 'cost-1',
    date: '2026-10-28',
    category: 'Air Freight & Cargo',
    amount: 7500,
    description: 'Airport handling & C&F',
    refInvoice: 'PKG-2026-0001',
    createdAt: '2026-10-28T11:00:00Z',
  },
  {
    id: 'cost-2',
    date: '2026-10-30',
    category: 'Ice & Styrofoam Box',
    amount: 5000,
    description: 'Boxes & gel packs',
    refInvoice: 'PKG-2026-0002',
    createdAt: '2026-10-30T11:00:00Z',
  },
];

const samplePayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceNumber: 'PAY-2026-0001',
    date: '2026-10-29',
    description: 'ABDULLAH VAI',
    contactNumber: '01700000001',
    items: [],
    totalAmount: 15000,
    previousAmount: 30000,
    paidAmount: 15000,
    balance: 15000,
    status: 'PAID',
    returnRMB: 0,
    paymentCategory: 'supplier',
    createdAt: '2026-10-29T09:00:00Z',
  },
];

test('getWeekdayShortLabel returns accurate weekday label', () => {
  assert.equal(getWeekdayShortLabel('2026-10-30'), 'Fri');
  assert.equal(getWeekdayShortLabel('2026-10-28'), 'Wed');
  assert.equal(getWeekdayShortLabel('invalid'), '');
});

test('calculateDailyProfitLossReport aggregates daily profit, loss, and running balance accurately', () => {
  const report = calculateDailyProfitLossReport(
    samplePurchases,
    samplePackings,
    samplePayments,
    sampleOtherCosts
  );

  // 3 unique dates: 2026-10-30, 2026-10-29, 2026-10-28 (sorted descending)
  assert.equal(report.entries.length, 3);
  assert.equal(report.entries[0].date, '2026-10-30');
  assert.equal(report.entries[1].date, '2026-10-29');
  assert.equal(report.entries[2].date, '2026-10-28');

  // Check 2026-10-28: Export 5,000 RMB / 82,500 BDT - Purchase 50,000 = Gross 32,500; - OtherCost 7,500 = Net +25,000 (PROFIT)
  const day28 = report.entries[2];
  assert.equal(day28.exportAmountRMB, 5000);
  assert.equal(day28.exportAmountBDT, 82500);
  assert.equal(day28.purchaseAmount, 50000);
  assert.equal(day28.grossProfit, 32500);
  assert.equal(day28.otherCostAmount, 7500);
  assert.equal(day28.netProfit, 25000);
  assert.equal(day28.runningCumulativeNetProfit, 25000);
  assert.equal(day28.status, 'PROFIT');

  // Check 2026-10-29: Only supplier payment voucher (15,000), so P&L is 0 (BREAKEVEN), running net stays 25,000
  const day29 = report.entries[1];
  assert.equal(day29.exportAmountRMB, 0);
  assert.equal(day29.netProfit, 0);
  assert.equal(day29.supplierPaymentAmount, 15000);
  assert.equal(day29.runningCumulativeNetProfit, 25000);
  assert.equal(day29.status, 'BREAKEVEN');

  // Check 2026-10-30: Export 2,000 RMB / 33,000 BDT - Purchase 48,000 = Gross -15,000; - OtherCost 5,000 = Net -20,000 (LOSS)
  const day30 = report.entries[0];
  assert.equal(day30.exportAmountRMB, 2000);
  assert.equal(day30.exportAmountBDT, 33000);
  assert.equal(day30.purchaseAmount, 48000);
  assert.equal(day30.grossProfit, -15000);
  assert.equal(day30.otherCostAmount, 5000);
  assert.equal(day30.netProfit, -20000);
  assert.equal(day30.runningCumulativeNetProfit, 5000);
  assert.equal(day30.status, 'LOSS');

  // Summary totals across all 3 days
  assert.equal(report.totals.totalPurchaseAmount, 98000);
  assert.equal(report.totals.totalExportAmountRMB, 7000);
  assert.equal(report.totals.totalExportAmountBDT, 115500);
  assert.equal(report.totals.totalOtherCostAmount, 12500);
  assert.equal(report.totals.totalGrossProfit, 17500);
  assert.equal(report.totals.totalNetProfit, 5000);
  assert.equal(report.totals.profitableDaysCount, 1);
  assert.equal(report.totals.lossDaysCount, 1);
  assert.equal(report.totals.breakEvenDaysCount, 1);
  assert.equal(report.totals.bestProfitDay?.date, '2026-10-28');
  assert.equal(report.totals.worstLossDay?.date, '2026-10-30');
});

test('calculateDailyProfitLossReport filters by status, date range, and search query', () => {
  const profitOnly = calculateDailyProfitLossReport(
    samplePurchases,
    samplePackings,
    samplePayments,
    sampleOtherCosts,
    { statusFilter: 'profit' }
  );
  assert.equal(profitOnly.entries.length, 1);
  assert.equal(profitOnly.entries[0].date, '2026-10-28');
  assert.equal(profitOnly.totals.totalExportAmountRMB, 5000);

  const lossOnly = calculateDailyProfitLossReport(
    samplePurchases,
    samplePackings,
    samplePayments,
    sampleOtherCosts,
    { statusFilter: 'loss' }
  );
  assert.equal(lossOnly.entries.length, 1);
  assert.equal(lossOnly.entries[0].date, '2026-10-30');
  assert.equal(lossOnly.totals.totalExportAmountRMB, 2000);

  const searchResult = calculateDailyProfitLossReport(
    samplePurchases,
    samplePackings,
    samplePayments,
    sampleOtherCosts,
    { searchQuery: 'SHANGHAI' }
  );
  assert.equal(searchResult.entries.length, 1);
  assert.equal(searchResult.entries[0].date, '2026-10-30');
});

test('calculateDailyProfitLossReport sums multiple shipments per day accurately in RMB', () => {
  const sameDayPackings: PackingRecord[] = [
    ...samplePackings,
    {
      ...samplePackings[0],
      id: 'pkg-3',
      invoiceNumber: 'PKG-2026-0003',
      totalAmount: 1250.45,
      rmbRate: 16.5,
      totalAmountBDT: 20632.43,
    },
  ];
  const report = calculateDailyProfitLossReport(
    samplePurchases,
    sameDayPackings,
    samplePayments,
    sampleOtherCosts
  );
  const day28 = report.entries.find((e) => e.date === '2026-10-28');
  assert.ok(day28);
  assert.equal(day28.exportAmountRMB, 6250.45);
  assert.equal(report.totals.totalExportAmountRMB, 8250.45);
});

test('getVisibleDailyProfitLossWindow defaults to 10 rows and tracks remaining count', () => {
  assert.equal(DAILY_PL_ROW_BATCH_SIZE, 10);
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  const initialWindow = getVisibleDailyProfitLossWindow(rows);
  assert.equal(initialWindow.shownCount, 10);
  assert.equal(initialWindow.totalCount, 25);
  assert.equal(initialWindow.remainingCount, 15);
  assert.equal(initialWindow.hasMore, true);
  assert.equal(initialWindow.visibleEntries.length, 10);
  assert.equal(initialWindow.visibleEntries[0].id, 1);
  assert.equal(initialWindow.visibleEntries[9].id, 10);

  const secondWindow = getVisibleDailyProfitLossWindow(rows, 20);
  assert.equal(secondWindow.shownCount, 20);
  assert.equal(secondWindow.remainingCount, 5);
  assert.equal(secondWindow.hasMore, true);

  const fullWindow = getVisibleDailyProfitLossWindow(rows, 50);
  assert.equal(fullWindow.shownCount, 25);
  assert.equal(fullWindow.remainingCount, 0);
  assert.equal(fullWindow.hasMore, false);
});

test('shouldLoadMoreOnScroll triggers only when near bottom and more rows exist', () => {
  assert.equal(
    shouldLoadMoreOnScroll({
      scrollTop: 0,
      clientHeight: 400,
      scrollHeight: 600,
      hasMore: true,
    }),
    false
  );

  assert.equal(
    shouldLoadMoreOnScroll({
      scrollTop: 120,
      clientHeight: 400,
      scrollHeight: 600,
      hasMore: true,
    }),
    true
  );

  assert.equal(
    shouldLoadMoreOnScroll({
      scrollTop: 200,
      clientHeight: 400,
      scrollHeight: 600,
      hasMore: false,
    }),
    false
  );
});

test('getNextDailyProfitLossRowLimit increments in batches of 10 and caps at totalCount', () => {
  assert.equal(getNextDailyProfitLossRowLimit(10, 25), 20);
  assert.equal(getNextDailyProfitLossRowLimit(20, 25), 25);
  assert.equal(getNextDailyProfitLossRowLimit(25, 25), 25);
  assert.equal(getNextDailyProfitLossRowLimit(10, 0), 10);
});
