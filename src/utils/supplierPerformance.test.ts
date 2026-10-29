import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRollingMonthWindow,
  calculateSupplierPerformance,
} from './supplierPerformance.ts';
import { initialPurchases } from '../context/initialData.ts';
import { PurchaseRecord } from '../types/index.ts';

test('buildRollingMonthWindow returns 6 chronological YYYY-MM months including year rollover', () => {
  const octWindow = buildRollingMonthWindow('2026-10', 6);
  assert.deepEqual(octWindow, [
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
  ]);

  const febWindow = buildRollingMonthWindow('2026-02', 6);
  assert.deepEqual(febWindow, [
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
  ]);
});

test('calculateSupplierPerformance ranks Top 5 suppliers by total purchase value over the last 6 months on seed data', () => {
  const perf = calculateSupplierPerformance(initialPurchases, {
    windowMode: '6m',
    monthsWindow: 6,
    endYearMonth: '2026-10',
    topLimit: 5,
  });

  assert.equal(perf.windowMode, '6m');
  assert.equal(perf.startYearMonth, '2026-05');
  assert.equal(perf.endYearMonth, '2026-10');
  assert.equal(perf.windowRangeLabel, 'May 2026 – Oct 2026 (Last 6 Months)');
  assert.equal(perf.topSuppliers.length, 5);
  assert.equal(perf.allSuppliersCount, 5);

  // Verify descending order by totalPurchaseValue:
  // #1 FAISAL VAI (160,000), #2 ABDULLAH VAI (125,000), #3 RAKIB VAI (110,000), #4 UZZAL VAI (94,500), #5 KABIR VAI (76,000)
  assert.deepEqual(
    perf.topSuppliers.map((s) => ({
      rank: s.rank,
      supplierName: s.supplierName,
      totalPurchaseValue: s.totalPurchaseValue,
    })),
    [
      { rank: 1, supplierName: 'FAISAL VAI', totalPurchaseValue: 160000 },
      { rank: 2, supplierName: 'ABDULLAH VAI', totalPurchaseValue: 125000 },
      { rank: 3, supplierName: 'RAKIB VAI', totalPurchaseValue: 110000 },
      { rank: 4, supplierName: 'UZZAL VAI', totalPurchaseValue: 94500 },
      { rank: 5, supplierName: 'KABIR VAI', totalPurchaseValue: 76000 },
    ]
  );

  // Total 6-month purchase value = 160,000 + 125,000 + 110,000 + 94,500 + 76,000 = 565,500
  assert.equal(perf.totalWindowPurchaseValue, 565500);
  assert.equal(perf.top5TotalPurchaseValue, 565500);
  assert.equal(perf.top5TotalPaidAmount, 484500);
  assert.equal(perf.top5TotalBalanceDue, 81000);
  assert.equal(perf.top5TotalQuantityKg, 680);
  assert.equal(perf.top5ShareOfTotalPercent, 100);
  assert.equal(perf.topSupplier?.supplierName, 'FAISAL VAI');
});

test('calculateSupplierPerformance excludes purchases older than the 6-month cutoff and slices top 5 when more than 5 suppliers exist', () => {
  const sampleRecords: PurchaseRecord[] = [
    // Inside 6-month window (2026-05 to 2026-10)
    {
      id: 'p1',
      invoiceNumber: 'INV-1',
      date: '2026-10-10',
      description: 'SUPPLIER ALPHA',
      contactNumber: '01701',
      items: [],
      totalQty: 200,
      totalAmount: 200000,
      previousAmount: 0,
      paidAmount: 180000,
      balance: 20000,
      createdAt: '',
    },
    {
      id: 'p2',
      invoiceNumber: 'INV-2',
      date: '2026-09-12',
      description: 'SUPPLIER BETA',
      contactNumber: '01702',
      items: [],
      totalQty: 180,
      totalAmount: 175000,
      previousAmount: 0,
      paidAmount: 175000,
      balance: 0,
      createdAt: '',
    },
    {
      id: 'p3',
      invoiceNumber: 'INV-3',
      date: '2026-08-05',
      description: 'SUPPLIER GAMMA',
      contactNumber: '01703',
      items: [],
      totalQty: 150,
      totalAmount: 150000,
      previousAmount: 0,
      paidAmount: 100000,
      balance: 50000,
      createdAt: '',
    },
    {
      id: 'p4',
      invoiceNumber: 'INV-4',
      date: '2026-07-20',
      description: 'SUPPLIER DELTA',
      contactNumber: '01704',
      items: [],
      totalQty: 130,
      totalAmount: 120000,
      previousAmount: 0,
      paidAmount: 120000,
      balance: 0,
      createdAt: '',
    },
    {
      id: 'p5',
      invoiceNumber: 'INV-5',
      date: '2026-06-15',
      description: 'SUPPLIER EPSILON',
      contactNumber: '01705',
      items: [],
      totalQty: 100,
      totalAmount: 95000,
      previousAmount: 0,
      paidAmount: 95000,
      balance: 0,
      createdAt: '',
    },
    {
      id: 'p6',
      invoiceNumber: 'INV-6',
      date: '2026-05-03',
      description: 'SUPPLIER ZETA (6th in window)',
      contactNumber: '01706',
      items: [],
      totalQty: 60,
      totalAmount: 60000,
      previousAmount: 0,
      paidAmount: 60000,
      balance: 0,
      createdAt: '',
    },
    // Outside 6-month window (2026-03 is older than 2026-05)
    {
      id: 'p7',
      invoiceNumber: 'INV-OLD',
      date: '2026-03-10',
      description: 'SUPPLIER OMEGA (LEGACY HUGE)',
      contactNumber: '01707',
      items: [],
      totalQty: 500,
      totalAmount: 500000,
      previousAmount: 0,
      paidAmount: 500000,
      balance: 0,
      createdAt: '',
    },
  ];

  const sixMonthPerf = calculateSupplierPerformance(sampleRecords, {
    windowMode: '6m',
    endYearMonth: '2026-10',
    topLimit: 5,
  });

  // SUPPLIER OMEGA (2026-03) must be excluded in 6m mode
  assert.equal(sixMonthPerf.allSuppliersCount, 6);
  assert.equal(sixMonthPerf.topSuppliers.length, 5);
  assert.equal(
    sixMonthPerf.topSuppliers.some((s) =>
      s.supplierName.includes('SUPPLIER OMEGA')
    ),
    false
  );
  // 6th supplier in window (SUPPLIER ZETA) is sliced out of Top 5
  assert.equal(
    sixMonthPerf.topSuppliers.some((s) =>
      s.supplierName.includes('SUPPLIER ZETA')
    ),
    false
  );
  assert.equal(sixMonthPerf.totalWindowPurchaseValue, 800000);
  assert.equal(sixMonthPerf.top5TotalPurchaseValue, 740000);
  assert.equal(sixMonthPerf.top5ShareOfTotalPercent, 92.5);

  // In 'all' window mode, SUPPLIER OMEGA (500,000) becomes #1
  const allTimePerf = calculateSupplierPerformance(sampleRecords, {
    windowMode: 'all',
    endYearMonth: '2026-10',
    topLimit: 5,
  });
  assert.equal(allTimePerf.allSuppliersCount, 7);
  assert.equal(
    allTimePerf.topSuppliers[0].supplierName,
    'SUPPLIER OMEGA (LEGACY HUGE)'
  );
  assert.equal(allTimePerf.topSuppliers[0].totalPurchaseValue, 500000);
});

test('calculateSupplierPerformance handles empty purchase list gracefully', () => {
  const emptyPerf = calculateSupplierPerformance([], {
    windowMode: '6m',
    endYearMonth: '2026-10',
  });
  assert.equal(emptyPerf.topSuppliers.length, 0);
  assert.equal(emptyPerf.totalWindowPurchaseValue, 0);
  assert.equal(emptyPerf.top5TotalPurchaseValue, 0);
  assert.equal(emptyPerf.topSupplier, null);
});
