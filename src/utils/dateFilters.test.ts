import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDateInRange,
  toISODateString,
  getDateRangePreset,
  detectMatchingPreset,
  getDaysInDateRange,
  formatDateRangeLabel,
  filterFinancialTransactions,
  calculateConsolidatedFinancials,
} from './dateFilters.ts';
import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

test('isDateInRange: boundary, inclusive, open-ended, and edge conditions', () => {
  // Exact boundaries
  assert.equal(isDateInRange('2026-05-10', '2026-05-10', '2026-05-20'), true);
  assert.equal(isDateInRange('2026-05-20', '2026-05-10', '2026-05-20'), true);
  assert.equal(isDateInRange('2026-05-15', '2026-05-10', '2026-05-20'), true);

  // Outside bounds
  assert.equal(isDateInRange('2026-05-09', '2026-05-10', '2026-05-20'), false);
  assert.equal(isDateInRange('2026-05-21', '2026-05-10', '2026-05-20'), false);

  // Open-ended
  assert.equal(isDateInRange('2026-01-01', '', ''), true);
  assert.equal(isDateInRange('2026-05-10', '2026-05-01', ''), true);
  assert.equal(isDateInRange('2026-04-30', '2026-05-01', ''), false);
  assert.equal(isDateInRange('2026-05-10', '', '2026-05-15'), true);
  assert.equal(isDateInRange('2026-05-16', '', '2026-05-15'), false);

  // Date with timestamp
  assert.equal(isDateInRange('2026-05-15T10:30:00.000Z', '2026-05-10', '2026-05-20'), true);

  // Null, undefined, empty
  assert.equal(isDateInRange(null, '2026-05-10', '2026-05-20'), false);
  assert.equal(isDateInRange(undefined, '2026-05-10', '2026-05-20'), false);
  assert.equal(isDateInRange('', '2026-05-10', '2026-05-20'), false);
});

test('getDateRangePreset: verifies all standard presets with deterministic reference dates', () => {
  // Use a fixed reference date: Wednesday, May 20, 2026
  const refDate = new Date(2026, 4, 20); // Note month is 0-indexed: 4 = May

  // 1. All
  const allRange = getDateRangePreset('all', refDate);
  assert.equal(allRange.startDate, '');
  assert.equal(allRange.endDate, '');

  // 2. Today
  const todayRange = getDateRangePreset('today', refDate);
  assert.equal(todayRange.startDate, '2026-05-20');
  assert.equal(todayRange.endDate, '2026-05-20');

  // 3. Last 7 Days (May 14 to May 20, exactly 7 days inclusive)
  const last7Range = getDateRangePreset('last_7_days', refDate);
  assert.equal(last7Range.startDate, '2026-05-14');
  assert.equal(last7Range.endDate, '2026-05-20');

  // 4. This Month (May 1 to May 20, 2026)
  const thisMonthRange = getDateRangePreset('this_month', refDate);
  assert.equal(thisMonthRange.startDate, '2026-05-01');
  assert.equal(thisMonthRange.endDate, '2026-05-20');

  // 5. Last Month (April 1 to April 30, 2026)
  const lastMonthRange = getDateRangePreset('last_month', refDate);
  assert.equal(lastMonthRange.startDate, '2026-04-01');
  assert.equal(lastMonthRange.endDate, '2026-04-30');

  // 6. This Quarter (Q2 2026: April 1 to May 20, 2026)
  const thisQuarterRange = getDateRangePreset('this_quarter', refDate);
  assert.equal(thisQuarterRange.startDate, '2026-04-01');
  assert.equal(thisQuarterRange.endDate, '2026-05-20');

  // 7. This Year (Jan 1 to Dec 31, 2026)
  const thisYearRange = getDateRangePreset('this_year', refDate);
  assert.equal(thisYearRange.startDate, '2026-01-01');
  assert.equal(thisYearRange.endDate, '2026-12-31');
});

test('getDateRangePreset: year rollover when evaluating last month in January', () => {
  // Reference date: January 15, 2026
  const janDate = new Date(2026, 0, 15);
  const lastMonthRange = getDateRangePreset('last_month', janDate);
  assert.equal(lastMonthRange.startDate, '2025-12-01');
  assert.equal(lastMonthRange.endDate, '2025-12-31');
});

test('detectMatchingPreset: identifies presets and flags custom ranges', () => {
  const refDate = new Date(2026, 4, 20); // May 20, 2026

  assert.equal(detectMatchingPreset('', '', refDate), 'all');
  assert.equal(detectMatchingPreset('2026-05-20', '2026-05-20', refDate), 'today');
  assert.equal(detectMatchingPreset('2026-05-14', '2026-05-20', refDate), 'last_7_days');
  assert.equal(detectMatchingPreset('2026-05-01', '2026-05-20', refDate), 'this_month');
  assert.equal(detectMatchingPreset('2026-04-01', '2026-04-30', refDate), 'last_month');
  assert.equal(detectMatchingPreset('2026-01-01', '2026-12-31', refDate), 'this_year');

  // Arbitrary range
  assert.equal(detectMatchingPreset('2026-03-12', '2026-05-04', refDate), 'custom');
});

test('getDaysInDateRange and formatDateRangeLabel', () => {
  assert.equal(getDaysInDateRange('2026-05-01', '2026-05-01'), 1);
  assert.equal(getDaysInDateRange('2026-05-01', '2026-05-07'), 7);
  assert.equal(getDaysInDateRange('2026-05-01', '2026-05-31'), 31);
  assert.equal(getDaysInDateRange('', '2026-05-31'), null);

  assert.equal(formatDateRangeLabel('', ''), 'All Time (No Date Constraints)');
  assert.equal(formatDateRangeLabel('2026-05-20', '2026-05-20'), 'Single Day: 2026-05-20');
  assert.equal(
    formatDateRangeLabel('2026-05-01', '2026-05-31'),
    '2026-05-01 to 2026-05-31 (31 days)'
  );
  assert.equal(formatDateRangeLabel('2026-05-01', ''), 'From 2026-05-01 onward');
});

test('filterFinancialTransactions: filters all 4 transaction types and builds unified chronological stream', () => {
  const dummyPurchases: PurchaseRecord[] = [
    {
      id: 'p1',
      invoiceNumber: 'INV-001',
      date: '2026-05-05',
      description: 'Md. Dulal Fish',
      contactNumber: '01711',
      items: [{ id: '1', item: 'Live Eel', quantity: 100, rate: 800, totalAmount: 80000, previousAmount: 0, paidAmount: 80000, balance: 0 }],
      totalQty: 100,
      totalAmount: 80000,
      previousAmount: 0,
      paidAmount: 80000,
      balance: 0,
      remarks: 'Top grade',
      createdAt: '2026-05-05T08:00:00Z',
    },
    {
      id: 'p2',
      invoiceNumber: 'INV-002',
      date: '2026-06-15',
      description: 'Rahmat Ali',
      contactNumber: '01811',
      items: [],
      totalQty: 50,
      totalAmount: 40000,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 20000,
      createdAt: '2026-06-15T08:00:00Z',
    },
  ];

  const dummyPackings: PackingRecord[] = [
    {
      id: 'pk1',
      invoiceNumber: 'PKG-001',
      shippingMark: 'GUANGZHOU-A1',
      flight: 'CZ392',
      destination: 'CAN',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-05-10',
      fromDate: '2026-05-01',
      toDate: '2026-05-10',
      items: [],
      totalBox: 20,
      totalWeight: 500,
      totalAmount: 10000, // RMB
      rmbRate: 18,
      totalAmountBDT: 180000,
      paymentStatus: 'PAID',
      createdAt: '2026-05-10T10:00:00Z',
    },
    {
      id: 'pk2',
      invoiceNumber: 'PKG-002',
      shippingMark: 'SHANGHAI-B2',
      flight: 'MU203',
      destination: 'PVG',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-07-01',
      fromDate: '2026-07-01',
      toDate: '2026-07-01',
      items: [],
      totalBox: 10,
      totalWeight: 250,
      totalAmount: 5000,
      rmbRate: 18,
      totalAmountBDT: 90000,
      paymentStatus: 'NO REPORT',
      createdAt: '2026-07-01T10:00:00Z',
    },
  ];

  const dummyPayments: PaymentRecord[] = [
    {
      id: 'pm1',
      invoiceNumber: 'PAY-001',
      date: '2026-05-08',
      description: 'Md. Dulal Fish',
      contactNumber: '01711',
      items: [],
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 50000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      createdAt: '2026-05-08T09:00:00Z',
    },
  ];

  const dummyOtherCosts: OtherCostRecord[] = [
    {
      id: 'c1',
      date: '2026-05-06',
      category: 'Packing Material',
      amount: 12000,
      description: 'Ice gel packs and foam boxes',
      refInvoice: 'PKG-001',
      createdAt: '2026-05-06T07:00:00Z',
    },
    {
      id: 'c2',
      date: '2026-06-20',
      category: 'Air Freight',
      amount: 45000,
      description: 'Airline customs fee',
      createdAt: '2026-06-20T07:00:00Z',
    },
  ];

  // Filter May 2026 (2026-05-01 to 2026-05-31)
  const result = filterFinancialTransactions(
    dummyPurchases,
    dummyPackings,
    dummyPayments,
    dummyOtherCosts,
    { startDate: '2026-05-01', endDate: '2026-05-31' },
    18.0
  );

  assert.equal(result.filteredPurchases.length, 1);
  assert.equal(result.filteredPurchases[0].id, 'p1');

  assert.equal(result.filteredPackings.length, 1);
  assert.equal(result.filteredPackings[0].id, 'pk1');

  assert.equal(result.filteredPayments.length, 1);
  assert.equal(result.filteredPayments[0].id, 'pm1');

  assert.equal(result.filteredOtherCosts.length, 1);
  assert.equal(result.filteredOtherCosts[0].id, 'c1');

  // Unified stream count = 4
  assert.equal(result.unifiedTransactions.length, 4);

  // Check descending date order: pk1 (May 10), pm1 (May 8), c1 (May 6), p1 (May 5)
  assert.equal(result.unifiedTransactions[0].date, '2026-05-10');
  assert.equal(result.unifiedTransactions[1].date, '2026-05-08');
  assert.equal(result.unifiedTransactions[2].date, '2026-05-06');
  assert.equal(result.unifiedTransactions[3].date, '2026-05-05');

  // Financial Summary calculation
  const summary = calculateConsolidatedFinancials(
    result.filteredPurchases,
    result.filteredPackings,
    result.filteredPayments,
    result.filteredOtherCosts,
    18.0
  );

  assert.equal(summary.totalPurchasesBDT, 80000);
  assert.equal(summary.purchasesPaidBDT, 80000);
  assert.equal(summary.purchasesBalanceBDT, 0);

  assert.equal(summary.totalExportRMB, 10000);
  assert.equal(summary.totalExportBDT, 180000);
  assert.equal(summary.totalExportWeightKG, 500);
  assert.equal(summary.totalExportBoxes, 20);

  assert.equal(summary.totalPaymentsBDT, 50000);
  assert.equal(summary.totalOtherCostsBDT, 12000);

  // Net Operating Margin = Export BDT (180,000) - Purchases BDT (80,000) - Other Costs (12,000) = 88,000
  assert.equal(summary.netOperatingMarginBDT, 88000);
  assert.equal(summary.totalTransactionsCount, 4);
});
