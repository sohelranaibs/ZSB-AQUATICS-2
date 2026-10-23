import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePurchaseRowTotal,
  calculatePurchaseTotals,
  calculatePackingRow,
  calculatePackingTotals,
  calculatePackingTotalAmountBDT,
  calculateCumulativeExportValueBDT,
  calculateForeignRmbRemittanceValue,
  calculatePaymentRow,
  calculatePaymentTotals,
  calculateProfitLoss,
  calculateMonthlySummary,
  calculateMonthlyTrends,
  formatYearMonthLabel,
  formatShortYearMonthLabel,
  getCurrentYearMonth,
  generateInvoiceNumber,
  getSupplierLedgerStats,
  formatRMB,
  calculateExporterSlipRowAmount,
  buildExporterPaymentSlipRows,
  calculateExporterSlipTotals,
  DEFAULT_EXPORTER_SLIP_ROWS,
  formatExporterSlipExportFilename,
  formatPurchaseExportFilename,
  createEmptyExporterSlipRow,
  createInitialExporterSlipRows,
  isExporterSlipRowPopulated,
  mergeExporterPaymentSlipRows,
  isPackingFormDraftPopulated,
  buildPackingRecordFromDraft,
  collectPackingManifestRecords,
  extractPackingLookupOptions,
  classifyPaymentCategory,
  getSupplierPaymentStats,
  getExporterManifestStats,
  getTopSuppliersByVolume,
  calculatePackingConsignmentSummary,
} from './calculations.ts';

test('calculatePurchaseRowTotal should multiply quantity and rate correctly', () => {
  assert.equal(calculatePurchaseRowTotal(10, 150), 1500);
  assert.equal(calculatePurchaseRowTotal(12.5, 200), 2500);
  assert.equal(calculatePurchaseRowTotal(0, 100), 0);
});

test('calculatePurchaseTotals calculates sum, previous and balance', () => {
  const rows = [
    { id: '1', item: 'F1', quantity: 10, rate: 100, totalAmount: 1000, previousAmount: 0, paidAmount: 0, balance: 0 },
    { id: '2', item: 'FF1', quantity: 5, rate: 200, totalAmount: 1000, previousAmount: 0, paidAmount: 0, balance: 0 },
  ];
  const totals = calculatePurchaseTotals(rows, 500, 1500);
  assert.equal(totals.totalQty, 15);
  assert.equal(totals.totalAmount, 2000);
  assert.equal(totals.previousAmount, 500);
  assert.equal(totals.paidAmount, 1500);
  assert.equal(totals.balance, 1000); // 2000 + 500 - 1500 = 1000
});

test('calculatePackingRow calculates total weight = box * weight and amount = total weight * rate', () => {
  const result = calculatePackingRow(5, 14, 250);
  assert.equal(result.totalWeight, 70); // 5 * 14
  assert.equal(result.amount, 17500); // 70 * 250
});

test('calculatePackingTotals sums boxes, weights and amounts', () => {
  const rows = [
    { id: '1', item: '2F', box: 2, weight: 16, totalWeight: 32, unit: 'KG', rate: 300, amount: 9600 },
    { id: '2', item: '3F', box: 3, weight: 15, totalWeight: 45, unit: 'KG', rate: 200, amount: 9000 },
  ];
  const totals = calculatePackingTotals(rows);
  assert.equal(totals.totalBox, 5);
  assert.equal(totals.totalWeight, 77);
  assert.equal(totals.totalAmount, 18600);
});

test('calculatePackingTotalAmountBDT, calculateCumulativeExportValueBDT, and calculateForeignRmbRemittanceValue calculate Total Value (RMB) and Total Amount (BDT) from Packing DB', () => {
  assert.equal(calculatePackingTotalAmountBDT(10000, 16.5), 165000);
  assert.equal(calculatePackingTotalAmountBDT(2500, 17.25), 43125);
  assert.equal(calculatePackingTotalAmountBDT(10000, 0), 0);
  assert.equal(calculatePackingTotalAmountBDT(10000, undefined), 0);

  const samplePackings = [
    { totalAmount: 10000, rmbRate: 16.5 },
    { totalAmount: 2500, rmbRate: 17.25 },
    { totalAmount: 5000, rmbRate: undefined },
  ];

  assert.equal(
    calculateCumulativeExportValueBDT(samplePackings),
    208125 // 165000 + 43125 + 0
  );
  assert.equal(calculateCumulativeExportValueBDT([]), 0);

  assert.equal(
    calculateForeignRmbRemittanceValue(samplePackings),
    17500 // 10000 + 2500 + 5000 (sum of Total Value from Packing DB)
  );
  assert.equal(calculateForeignRmbRemittanceValue([]), 0);
});

test('calculatePaymentRow calculates debit - credit', () => {
  assert.equal(calculatePaymentRow(50000, 20000), 30000);
  assert.equal(calculatePaymentRow(0, 10000), -10000);
});

test('calculatePaymentTotals calculates balance correctly', () => {
  const rows = [
    { id: '1', description: 'ABDULLAH VAI', debitAmount: 50000, creditAmount: 20000, balance: 30000 },
  ];
  const totals = calculatePaymentTotals(rows, 100000, 40000);
  assert.equal(totals.totalDebit, 50000);
  assert.equal(totals.totalCredit, 20000);
  assert.equal(totals.balance, 60000); // previous 100000 - paid 40000
});

test('calculateProfitLoss calculates gross profit, net profit and margin', () => {
  const purchases = [
    { id: 'p1', invoiceNumber: 'INV-1', date: '2026-10-01', description: 'Uzzal', contactNumber: '', items: [], totalQty: 10, totalAmount: 100000, previousAmount: 0, paidAmount: 0, balance: 0, createdAt: '' },
  ];
  const packings = [
    { id: 'pk1', invoiceNumber: 'PKG-1', shippingMark: 'AAD', flight: 'CZ', destination: 'CAN', shipper: 'ZSB', packingDate: '2026-10-02', fromDate: '', toDate: '', items: [], totalBox: 10, totalWeight: 140, totalAmount: 160000, createdAt: '' },
  ];
  const payments = [
    { id: 'pm1', invoiceNumber: 'PAY-1', date: '2026-10-03', description: 'Abdullah', contactNumber: '', items: [], totalAmount: 50000, previousAmount: 0, paidAmount: 50000, balance: 0, status: 'PAID', returnRMB: 2000, createdAt: '' },
  ];
  const otherCosts = [
    { id: 'c1', date: '2026-10-02', category: 'Freight', amount: 20000, description: 'Air cargo', createdAt: '' },
  ];

  const pl = calculateProfitLoss(purchases, packings, payments, otherCosts, 16.5);
  assert.equal(pl.totalPurchasing, 100000);
  assert.equal(pl.totalExportValue, 160000);
  assert.equal(pl.grossProfit, 60000); // 160000 - 100000
  assert.equal(pl.totalOtherCosting, 20000);
  assert.equal(pl.netProfit, 40000); // 60000 - 20000
  assert.equal(pl.totalReturnRMB, 2000);
  assert.equal(pl.totalReturnRMBInBDT, 33000); // 2000 * 16.5
});

test('calculateMonthlySummary filters by target year-month and calculates purchases, export value, and net profit', () => {
  const purchases = [
    { id: 'p1', invoiceNumber: 'PUR-1', date: '2026-10-18', description: 'Abdullah', contactNumber: '', items: [], totalQty: 295, totalAmount: 101000, previousAmount: 0, paidAmount: 80000, balance: 21000, createdAt: '' },
    { id: 'p2', invoiceNumber: 'PUR-2', date: '2026-09-15', description: 'Old Month', contactNumber: '', items: [], totalQty: 100, totalAmount: 50000, previousAmount: 0, paidAmount: 50000, balance: 0, createdAt: '' },
  ];
  const packings = [
    { id: 'pk1', invoiceNumber: 'PKG-1', shippingMark: 'AAD', flight: 'CAN', destination: 'GUANGZHOU', shipper: 'ZSB', packingDate: '2026-10-19', fromDate: '', toDate: '', items: [], totalBox: 19, totalWeight: 284, totalAmount: 150000, createdAt: '' },
    { id: 'pk2', invoiceNumber: 'PKG-2', shippingMark: 'OLD', flight: 'CAN', destination: 'GUANGZHOU', shipper: 'ZSB', packingDate: '2026-09-20', fromDate: '', toDate: '', items: [], totalBox: 10, totalWeight: 150, totalAmount: 80000, createdAt: '' },
  ];
  const payments = [
    { id: 'pm1', invoiceNumber: 'PAY-1', date: '2026-10-18', description: 'Abdullah', contactNumber: '', items: [], totalAmount: 80000, previousAmount: 0, paidAmount: 80000, balance: 0, status: 'PAID', returnRMB: 1000, createdAt: '' },
  ];
  const otherCosts = [
    { id: 'c1', date: '2026-10-19', category: 'Freight', amount: 15000, description: 'Air freight', createdAt: '' },
    { id: 'c2', date: '2026-09-19', category: 'Freight', amount: 10000, description: 'Sept freight', createdAt: '' },
  ];

  const octSummary = calculateMonthlySummary(purchases, packings, payments, otherCosts, '2026-10', 16.5);
  assert.equal(octSummary.yearMonth, '2026-10');
  assert.equal(octSummary.monthLabel, 'October 2026');
  assert.equal(octSummary.totalPurchases, 101000);
  assert.equal(octSummary.totalExportValue, 150000);
  assert.equal(octSummary.grossProfit, 49000);
  assert.equal(octSummary.totalOtherCosts, 15000);
  assert.equal(octSummary.netProfit, 34000); // 150000 - 101000 - 15000
  assert.equal(octSummary.purchaseCount, 1);
  assert.equal(octSummary.packingCount, 1);
  assert.equal(octSummary.otherCostCount, 1);

  const septSummary = calculateMonthlySummary(purchases, packings, payments, otherCosts, '2026-09', 16.5);
  assert.equal(septSummary.monthLabel, 'September 2026');
  assert.equal(septSummary.totalPurchases, 50000);
  assert.equal(septSummary.totalExportValue, 80000);
  assert.equal(septSummary.netProfit, 20000); // 80000 - 50000 - 10000

  const emptySummary = calculateMonthlySummary(purchases, packings, payments, otherCosts, '2026-11', 16.5);
  assert.equal(emptySummary.totalPurchases, 0);
  assert.equal(emptySummary.totalExportValue, 0);
  assert.equal(emptySummary.netProfit, 0);
  assert.equal(emptySummary.marginPercent, 0);
});

test('formatYearMonthLabel, formatShortYearMonthLabel and getCurrentYearMonth format dates properly', () => {
  assert.equal(formatYearMonthLabel('2026-10'), 'October 2026');
  assert.equal(formatYearMonthLabel('2026-01'), 'January 2026');
  assert.equal(formatYearMonthLabel('all'), 'All Time');
  assert.equal(formatShortYearMonthLabel('2026-10'), 'Oct 2026');
  assert.equal(formatShortYearMonthLabel('2026-01'), 'Jan 2026');
  assert.equal(formatShortYearMonthLabel('all'), 'All Time');
  assert.equal(getCurrentYearMonth(new Date('2026-10-21T12:00:00Z')), '2026-10');
});

test('calculateMonthlyTrends generates rolling window and active-only trend series accurately', () => {
  const purchases = [
    { id: 'p1', invoiceNumber: 'PUR-1', date: '2026-10-18', description: 'Abdullah', contactNumber: '', items: [], totalQty: 295, totalAmount: 101000, previousAmount: 0, paidAmount: 80000, balance: 21000, createdAt: '' },
    { id: 'p2', invoiceNumber: 'PUR-2', date: '2026-09-15', description: 'Faisal', contactNumber: '', items: [], totalQty: 180, totalAmount: 60000, previousAmount: 0, paidAmount: 60000, balance: 0, createdAt: '' },
  ];
  const packings = [
    { id: 'pk1', invoiceNumber: 'PKG-1', shippingMark: 'AAD', flight: 'CAN', destination: 'GUANGZHOU', shipper: 'ZSB', packingDate: '2026-10-19', fromDate: '', toDate: '', items: [], totalBox: 19, totalWeight: 284, totalAmount: 150000, createdAt: '' },
    { id: 'pk2', invoiceNumber: 'PKG-2', shippingMark: 'ROE', flight: 'CAN', destination: 'GUANGZHOU', shipper: 'ZSB', packingDate: '2026-09-20', fromDate: '', toDate: '', items: [], totalBox: 12, totalWeight: 180, totalAmount: 95000, createdAt: '' },
  ];
  const payments = [
    { id: 'pm1', invoiceNumber: 'PAY-1', date: '2026-10-18', description: 'Abdullah', contactNumber: '', items: [], totalAmount: 80000, previousAmount: 0, paidAmount: 80000, balance: 0, status: 'PAID' as const, returnRMB: 1000, createdAt: '' },
  ];
  const otherCosts = [
    { id: 'c1', date: '2026-10-19', category: 'Freight', amount: 15000, description: 'Air freight', createdAt: '' },
    { id: 'c2', date: '2026-09-19', category: 'Freight', amount: 10000, description: 'Sept freight', createdAt: '' },
  ];

  // 1. 6-month rolling window ending at 2026-10
  const sixMonthTrends = calculateMonthlyTrends(purchases, packings, payments, otherCosts, {
    monthsToShow: 6,
    endYearMonth: '2026-10',
    activeOnly: false,
  });

  assert.equal(sixMonthTrends.length, 6);
  assert.equal(sixMonthTrends[0].yearMonth, '2026-05');
  assert.equal(sixMonthTrends[0].shortMonthLabel, 'May 2026');
  assert.equal(sixMonthTrends[0].purchaseValue, 0);
  assert.equal(sixMonthTrends[0].exportValue, 0);

  const sepPoint = sixMonthTrends[4];
  assert.equal(sepPoint.yearMonth, '2026-09');
  assert.equal(sepPoint.shortMonthLabel, 'Sep 2026');
  assert.equal(sepPoint.purchaseValue, 60000);
  assert.equal(sepPoint.exportValue, 95000);
  assert.equal(sepPoint.netProfit, 25000); // 95000 - 60000 - 10000
  assert.equal(sepPoint.purchaseVolume, 180);
  assert.equal(sepPoint.exportWeight, 180);

  const octPoint = sixMonthTrends[5];
  assert.equal(octPoint.yearMonth, '2026-10');
  assert.equal(octPoint.shortMonthLabel, 'Oct 2026');
  assert.equal(octPoint.purchaseValue, 101000);
  assert.equal(octPoint.exportValue, 150000);
  assert.equal(octPoint.netProfit, 34000); // 150000 - 101000 - 15000
  assert.equal(octPoint.purchaseVolume, 295);
  assert.equal(octPoint.exportWeight, 284);

  // 2. Active months only mode
  const activeTrends = calculateMonthlyTrends(purchases, packings, payments, otherCosts, {
    activeOnly: true,
  });
  assert.equal(activeTrends.length, 2);
  assert.equal(activeTrends[0].yearMonth, '2026-09');
  assert.equal(activeTrends[1].yearMonth, '2026-10');
});

test('generateInvoiceNumber formats correctly with padding', () => {
  const inv = generateInvoiceNumber('PUR', 5);
  const year = new Date().getFullYear();
  assert.equal(inv, `PUR-${year}-0006`);
});

test('getSupplierLedgerStats aggregates supplier purchase history and latest balance', () => {
  const purchases = [
    {
      id: 'p1',
      invoiceNumber: 'PUR-1',
      date: '2026-09-10',
      description: 'ABDULLAH VAI',
      contactNumber: '+8801711223344',
      items: [],
      totalQty: 120,
      totalAmount: 48000,
      previousAmount: 0,
      paidAmount: 40000,
      balance: 8000,
      createdAt: '',
    },
    {
      id: 'p2',
      invoiceNumber: 'PUR-2',
      date: '2026-10-18',
      description: 'ABDULLAH VAI',
      contactNumber: '+8801711223344',
      items: [],
      totalQty: 295,
      totalAmount: 101000,
      previousAmount: 8000,
      paidAmount: 88000,
      balance: 21000,
      createdAt: '',
    },
    {
      id: 'p3',
      invoiceNumber: 'PUR-3',
      date: '2026-10-19',
      description: 'UZZAL VAI',
      contactNumber: '+8801822334455',
      items: [],
      totalQty: 150,
      totalAmount: 55000,
      previousAmount: 0,
      paidAmount: 55000,
      balance: 0,
      createdAt: '',
    },
  ];

  const stats = getSupplierLedgerStats(purchases, 'abdullah vai');
  assert.equal(stats.invoiceCount, 2);
  assert.equal(stats.totalPurchasedQty, 415);
  assert.equal(stats.totalPurchasedValue, 149000);
  assert.equal(stats.totalPaidAmount, 128000);
  assert.equal(stats.latestClosingBalance, 21000);
  assert.equal(stats.latestInvoiceDate, '2026-10-18');
  assert.equal(stats.latestContactNumber, '+8801711223344');

  const emptyStats = getSupplierLedgerStats(purchases, 'UNKNOWN SUPPLIER');
  assert.equal(emptyStats.invoiceCount, 0);
  assert.equal(emptyStats.latestClosingBalance, 0);
});

test('formatRMB, calculateExporterSlipRowAmount, buildExporterPaymentSlipRows, and calculateExporterSlipTotals compute Weight * RMB = Amount and filter accurately', () => {
  assert.equal(formatRMB(10460), '¥10,460.00');
  assert.equal(formatRMB(0), '¥0.00');

  assert.equal(calculateExporterSlipRowAmount(120, 85), 10200);
  assert.equal(calculateExporterSlipRowAmount(180.5, 40), 7220);
  assert.equal(calculateExporterSlipRowAmount(0, 85), 0);

  const packings = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-2026-0001',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-19',
      fromDate: '2026-10-19',
      toDate: '2026-10-20',
      items: [],
      totalBox: 8,
      totalWeight: 120,
      totalAmount: 172590,
      rmbAmount: 85,
      settledAmount: 10200,
      exporterStatus: 'PAID',
      createdAt: '',
    },
    {
      id: 'pkg-2',
      invoiceNumber: 'PKG-2026-0002',
      shippingMark: 'CHJ-22',
      flight: 'YG CAN',
      destination: 'KUNMING',
      shipper: 'SAJID INT.',
      packingDate: '2026-10-20',
      fromDate: '2026-10-20',
      toDate: '2026-10-21',
      items: [],
      totalBox: 22,
      totalWeight: 300,
      totalAmount: 113390,
      rmbAmount: 60,
      createdAt: '',
    },
  ];

  const payments = [
    {
      id: 'pay-2',
      invoiceNumber: 'PAY-2026-0002',
      date: '2026-10-20',
      description: 'CHJ-22',
      contactNumber: '',
      items: [],
      totalAmount: 113390,
      previousAmount: 0,
      paidAmount: 113390,
      balance: 0,
      status: 'REPORT',
      returnRMB: 60,
      exportGoodsRef: 'PKG-2026-0002',
      createdAt: '',
    },
  ];

  // Filter by Shipping Mark = 'AAD' and Packing Date = '2026-10-19'
  const aadRows = buildExporterPaymentSlipRows(packings, payments, {
    shippingMark: 'AAD',
    packingDate: '2026-10-19',
  });
  assert.equal(aadRows.length, 1);
  assert.equal(aadRows[0].mark, 'AAD');
  assert.equal(aadRows[0].flight, 'CAN');
  assert.equal(aadRows[0].box, 8);
  assert.equal(aadRows[0].weightKg, 120);
  assert.equal(aadRows[0].rmb, 85);
  assert.equal(aadRows[0].amount, 10200); // 120 * 85 = 10200
  assert.equal(aadRows[0].status, 'PAID');

  const aadTotals = calculateExporterSlipTotals(aadRows);
  assert.equal(aadTotals.totalBox, 8);
  assert.equal(aadTotals.totalWeightKg, 120);
  assert.equal(aadTotals.totalRmb, 85);
  assert.equal(aadTotals.totalAmount, 10200);

  // Filter by ALL marks and ALL dates
  const allRows = buildExporterPaymentSlipRows(packings, payments, {
    shippingMark: 'ALL',
    packingDate: 'ALL',
  });
  assert.equal(allRows.length, 2);
  const allTotals = calculateExporterSlipTotals(allRows);
  assert.equal(allTotals.totalBox, 30);
  assert.equal(allTotals.totalWeightKg, 420); // 120 + 300
  assert.equal(allTotals.totalRmb, 145); // 85 + 60
  assert.equal(allTotals.totalAmount, 28200); // 10200 + (300 * 60 = 18000)
});

test('classifyPaymentCategory, getSupplierPaymentStats, and getExporterManifestStats separate supplier and exporter ledgers cleanly', () => {
  const supplierPayment = {
    id: 'pay-1',
    invoiceNumber: 'PAY-2026-0001',
    date: '2026-10-19',
    description: 'ABDULLAH VAI',
    contactNumber: '+8801711223344',
    items: [],
    totalAmount: 50000,
    previousAmount: 86000,
    paidAmount: 50000,
    balance: 36000,
    status: 'PAID',
    returnRMB: 0,
    paymentCategory: 'supplier' as const,
    createdAt: '',
  };

  const exporterPayment = {
    id: 'pay-2',
    invoiceNumber: 'EXP-PAY-2026-0001',
    date: '2026-10-20',
    description: 'AAD (GUANGZHOU)',
    shippingMark: 'AAD',
    contactNumber: '+86-13800138000',
    items: [],
    totalAmount: 130400,
    previousAmount: 130400,
    paidAmount: 100000,
    balance: 30400,
    status: 'REPORT',
    returnRMB: 7903.03,
    exportGoodsRef: 'PKG-2026-0001',
    paymentCategory: 'exporter' as const,
    createdAt: '',
  };

  assert.equal(classifyPaymentCategory(supplierPayment), 'supplier');
  assert.equal(classifyPaymentCategory(exporterPayment), 'exporter');

  const purchases = [
    {
      id: 'pur-1',
      invoiceNumber: 'PUR-2026-0001',
      date: '2026-10-18',
      description: 'ABDULLAH VAI',
      contactNumber: '+8801711223344',
      items: [],
      totalQty: 295,
      totalAmount: 101000,
      previousAmount: 15000,
      paidAmount: 30000,
      balance: 86000,
      createdAt: '',
    },
  ];

  const supStats = getSupplierPaymentStats(
    purchases,
    [supplierPayment, exporterPayment],
    'ABDULLAH VAI'
  );
  assert.equal(supStats.purchaseInvoiceCount, 1);
  assert.equal(supStats.paymentVoucherCount, 1);
  assert.equal(supStats.totalPurchasedValue, 101000);
  assert.equal(supStats.totalPaidInVouchers, 50000);
  assert.equal(supStats.latestBalance, 36000);

  const packings = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-2026-0001',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-19',
      fromDate: '',
      toDate: '',
      items: [],
      totalBox: 19,
      totalWeight: 284,
      totalAmount: 130400,
      createdAt: '',
    },
  ];

  const expStats = getExporterManifestStats(
    packings,
    [supplierPayment, exporterPayment],
    'AAD',
    16.5
  );
  assert.equal(expStats.manifestCount, 1);
  assert.equal(expStats.exporterVoucherCount, 1);
  assert.equal(expStats.totalBoxes, 19);
  assert.equal(expStats.totalWeightKg, 284);
  assert.equal(expStats.totalExportValueBDT, 130400);
  assert.equal(expStats.totalSettledBDT, 100000);
  assert.equal(expStats.pendingBalanceBDT, 30400);
});

test('getTopSuppliersByVolume aggregates, ranks top 5 by volume, and filters by month', () => {
  const samplePurchases = [
    {
      id: '1',
      invoiceNumber: 'PUR-01',
      date: '2026-10-05',
      description: 'ABDULLAH VAI',
      contactNumber: '',
      items: [],
      totalQty: 300,
      totalAmount: 105000,
      previousAmount: 0,
      paidAmount: 100000,
      balance: 5000,
      createdAt: '',
    },
    {
      id: '2',
      invoiceNumber: 'PUR-02',
      date: '2026-10-12',
      description: 'abdullah vai', // case-insensitive aggregation
      contactNumber: '',
      items: [],
      totalQty: 200,
      totalAmount: 75000,
      previousAmount: 5000,
      paidAmount: 50000,
      balance: 30000,
      createdAt: '',
    },
    {
      id: '3',
      invoiceNumber: 'PUR-03',
      date: '2026-10-10',
      description: 'UZZAL VAI',
      contactNumber: '',
      items: [],
      totalQty: 450,
      totalAmount: 162000,
      previousAmount: 0,
      paidAmount: 162000,
      balance: 0,
      createdAt: '',
    },
    {
      id: '4',
      invoiceNumber: 'PUR-04',
      date: '2026-09-20',
      description: 'NAPAL VAI',
      contactNumber: '',
      items: [],
      totalQty: 400,
      totalAmount: 140000,
      previousAmount: 0,
      paidAmount: 140000,
      balance: 0,
      createdAt: '',
    },
    {
      id: '5',
      invoiceNumber: 'PUR-05',
      date: '2026-10-15',
      description: 'ROKIB VAI',
      contactNumber: '',
      items: [],
      totalQty: 350,
      totalAmount: 122500,
      previousAmount: 0,
      paidAmount: 100000,
      balance: 22500,
      createdAt: '',
    },
    {
      id: '6',
      invoiceNumber: 'PUR-06',
      date: '2026-10-18',
      description: 'LITON VAI',
      contactNumber: '',
      items: [],
      totalQty: 250,
      totalAmount: 87500,
      previousAmount: 0,
      paidAmount: 87500,
      balance: 0,
      createdAt: '',
    },
    {
      id: '7',
      invoiceNumber: 'PUR-07',
      date: '2026-10-19',
      description: 'SMALL SUPPLIER',
      contactNumber: '',
      items: [],
      totalQty: 50,
      totalAmount: 15000,
      previousAmount: 0,
      paidAmount: 15000,
      balance: 0,
      createdAt: '',
    },
  ];

  // All time top 5 out of 6 distinct suppliers (total overall volume = 2000 KG)
  const top5 = getTopSuppliersByVolume(samplePurchases, 5, 'all');
  assert.equal(top5.length, 5);
  assert.equal(top5[0].supplierName, 'ABDULLAH VAI');
  assert.equal(top5[0].rank, 1);
  assert.equal(top5[0].totalVolume, 500);
  assert.equal(top5[0].totalAmount, 180000);
  assert.equal(top5[0].invoiceCount, 2);
  assert.equal(top5[0].avgRatePerUnit, 360);
  assert.equal(top5[0].volumeSharePercent, 25); // 500 / 2000 = 25%
  assert.equal(top5[0].latestDate, '2026-10-12');

  assert.equal(top5[1].supplierName, 'UZZAL VAI');
  assert.equal(top5[1].totalVolume, 450);
  assert.equal(top5[2].supplierName, 'NAPAL VAI');
  assert.equal(top5[2].totalVolume, 400);
  assert.equal(top5[3].supplierName, 'ROKIB VAI');
  assert.equal(top5[3].totalVolume, 350);
  assert.equal(top5[4].supplierName, 'LITON VAI');
  assert.equal(top5[4].totalVolume, 250);

  // Filter by 2026-10 (excludes NAPAL VAI from 2026-09)
  const octTop5 = getTopSuppliersByVolume(samplePurchases, 5, '2026-10');
  assert.equal(octTop5.length, 5);
  assert.equal(octTop5.some((s) => s.supplierName === 'NAPAL VAI'), false);
  assert.equal(octTop5[4].supplierName, 'SMALL SUPPLIER');

  // Empty array returns empty result
  assert.deepEqual(getTopSuppliersByVolume([], 5), []);
});

test('createEmptyExporterSlipRow, isExporterSlipRowPopulated, and mergeExporterPaymentSlipRows handle Add Row and Weight * RMB = Amount in Exporter Payment Slip', () => {
  const emptyRow = createEmptyExporterSlipRow('custom-1', { date: '2026-10-22' });
  assert.equal(emptyRow.id, 'custom-1');
  assert.equal(emptyRow.isCustom, true);
  assert.equal(emptyRow.date, '2026-10-22');
  assert.equal(emptyRow.box, 0);
  assert.equal(emptyRow.weightKg, 0);
  assert.equal(emptyRow.rmb, 0);
  assert.equal(emptyRow.amount, 0);
  assert.equal(emptyRow.status, 'REPORT');
  assert.equal(isExporterSlipRowPopulated(emptyRow), false);

  const filledCustomRow = createEmptyExporterSlipRow('custom-2', {
    date: '2026-10-22',
    flight: 'CAN',
    mark: 'AAD',
    box: 12,
    weightKg: 180,
    rmb: 40,
    status: 'PAID',
  });
  assert.equal(isExporterSlipRowPopulated(filledCustomRow), true);
  assert.equal(filledCustomRow.amount, 7200); // 180 * 40 = 7200

  const dbRow = {
    id: 'pkg-1',
    packingId: 'pkg-1',
    invoiceNumber: 'PKG-2026-0001',
    date: '2026-10-19',
    flight: 'CAN',
    mark: 'AAD',
    box: 8,
    weightKg: 120,
    rmb: 85,
    amount: 10200, // 120 * 85
    status: 'PAID',
  };

  // Merge DB row with blank row and filled custom row
  const merged = mergeExporterPaymentSlipRows([dbRow], [emptyRow, filledCustomRow], {
    shippingMark: 'AAD',
  });
  assert.equal(merged.length, 3);
  assert.equal(merged[0].amount, 10200);
  assert.equal(merged[2].amount, 7200);

  const totals = calculateExporterSlipTotals(merged);
  assert.equal(totals.totalBox, 20); // 8 + 0 + 12
  assert.equal(totals.totalWeightKg, 300); // 120 + 0 + 180
  assert.equal(totals.totalRmb, 125); // 85 + 0 + 40
  assert.equal(totals.totalAmount, 17400); // 10200 + 0 + 7200

  // Filter out custom row that belongs to a different mark, while keeping blank newly added row visible
  const filteredOtherMark = mergeExporterPaymentSlipRows([], [emptyRow, filledCustomRow], {
    shippingMark: 'CHJ-22',
  });
  assert.equal(filteredOtherMark.length, 1);
  assert.equal(filteredOtherMark[0].id, 'custom-1');

  // Verify default Exporter Payment Slip initial row count is 3 rows
  assert.equal(DEFAULT_EXPORTER_SLIP_ROWS, 3);
  const initialThreeRows = createInitialExporterSlipRows(DEFAULT_EXPORTER_SLIP_ROWS, '2026-10-22');
  assert.equal(initialThreeRows.length, 3);
  assert.equal(initialThreeRows[0].id, 'slip-row-1');
  assert.equal(initialThreeRows[1].id, 'slip-row-2');
  assert.equal(initialThreeRows[2].id, 'slip-row-3');

  // Merging 0 DB rows with initial 3 rows yields 3 rows
  const mergedInitialOnly = mergeExporterPaymentSlipRows([], initialThreeRows);
  assert.equal(mergedInitialOnly.length, 3);

  // Merging 1 DB row with initial 3 blank rows still keeps total at 3 rows
  const mergedOneDbWithInitial = mergeExporterPaymentSlipRows([dbRow], initialThreeRows);
  assert.equal(mergedOneDbWithInitial.length, 3);
  assert.equal(mergedOneDbWithInitial[0].id, 'pkg-1');
  assert.equal(mergedOneDbWithInitial[1].id, 'slip-row-1');
  assert.equal(mergedOneDbWithInitial[2].id, 'slip-row-2');

  // Verify export filenames for PDF and PNG
  assert.equal(
    formatExporterSlipExportFilename('HM-105', '2026-10-19', 'png', '2026-10-22'),
    'ZSB_AQUATICS_Payment_Slip_HM-105_2026-10-19.png'
  );
  assert.equal(
    formatExporterSlipExportFilename('ALL', 'ALL', 'pdf', '2026-10-22'),
    'ZSB_AQUATICS_Payment_Slip_ALL_MARKS_2026-10-22.pdf'
  );
});

test('collectPackingManifestRecords and extractPackingLookupOptions collect all data from PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST)', () => {
  const emptyDraft = {
    invoiceNumber: 'PKG-2026-0001',
    packingDate: '2026-10-22',
    shippingMark: '',
    flight: '',
    destination: '',
    shipper: '',
    paymentStatus: 'NO REPORT' as const,
    customRmbAmount: '',
    remarks: '',
    rows: [
      { id: '1', item: '', box: 0, weight: 0, totalWeight: 0, unit: 'KG', rate: 0, amount: 0 },
    ],
  };
  assert.equal(isPackingFormDraftPopulated(emptyDraft), false);

  const liveDraft = {
    invoiceNumber: 'PKG-2026-0003',
    packingDate: '2026-10-22',
    shippingMark: 'HM-105',
    flight: 'CZ',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    paymentStatus: 'PAID' as const,
    customRmbAmount: '',
    remarks: 'Air cargo manifest',
    rows: [
      { id: '1', item: '2F', box: 10, weight: 15, totalWeight: 150, unit: 'KG', rate: 80, amount: 12000 },
      { id: '2', item: '3F', box: 5, weight: 10, totalWeight: 50, unit: 'KG', rate: 80, amount: 4000 },
    ],
  };
  assert.equal(isPackingFormDraftPopulated(liveDraft), true);

  const draftRecord = buildPackingRecordFromDraft(liveDraft);
  assert.equal(draftRecord.shippingMark, 'HM-105');
  assert.equal(draftRecord.packingDate, '2026-10-22');
  assert.equal(draftRecord.flight, 'CZ');
  assert.equal(draftRecord.totalBox, 15);
  assert.equal(draftRecord.totalWeight, 200);
  assert.equal(draftRecord.rmbAmount, 80); // 16000 / 200 = 80
  assert.equal(draftRecord.settledAmount, 16000); // 200 * 80 = 16000
  assert.equal(draftRecord.paymentStatus, 'PAID');
  assert.equal(draftRecord.exporterStatus, 'PAID');

  const savedPackings = [
    {
      id: 'pkg-saved-1',
      invoiceNumber: 'PKG-2026-0001',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-19',
      fromDate: '2026-10-19',
      toDate: '2026-10-19',
      items: [
        { id: 'i1', item: 'XXL', box: 8, weight: 15, totalWeight: 120, unit: 'KG', rate: 0, amount: 0 },
      ],
      totalBox: 8,
      totalWeight: 120,
      totalAmount: 0,
      rmbAmount: 0,
      paymentStatus: 'NO REPORT',
      createdAt: '',
    },
  ];

  const collected = collectPackingManifestRecords(savedPackings, liveDraft, null);
  assert.equal(collected.length, 2);

  const lookupOptions = extractPackingLookupOptions(collected, 'HM-105', '2026-10-22');
  assert.deepEqual(lookupOptions.dbMarks, ['HM-105', 'AAD']);
  assert.deepEqual(lookupOptions.markDates, ['2026-10-22']);
  assert.deepEqual(lookupOptions.otherDates, ['2026-10-19']);
  assert.equal(lookupOptions.marks[0].mark, 'HM-105');
  assert.equal(lookupOptions.marks[0].totalBoxes, 15);
  assert.equal(lookupOptions.marks[0].totalWeightKg, 200);

  const hmRows = buildExporterPaymentSlipRows(collected, [], {
    shippingMark: 'HM-105',
    packingDate: '2026-10-22',
  });
  assert.equal(hmRows.length, 1);
  assert.equal(hmRows[0].mark, 'HM-105');
  assert.equal(hmRows[0].date, '2026-10-22');
  assert.equal(hmRows[0].flight, 'CZ');
  assert.equal(hmRows[0].box, 15);
  assert.equal(hmRows[0].weightKg, 200);
  assert.equal(hmRows[0].rmb, 80);
  assert.equal(hmRows[0].amount, 16000);
  assert.equal(hmRows[0].status, 'PAID');

  const aadNoReportRows = buildExporterPaymentSlipRows(collected, [], {
    shippingMark: 'AAD',
    packingDate: '2026-10-19',
  });
  assert.equal(aadNoReportRows.length, 1);
  assert.equal(aadNoReportRows[0].status, 'NO REPORT');
  assert.equal(aadNoReportRows[0].rmb, 0);
  assert.equal(aadNoReportRows[0].amount, 0);
});

test('formatPurchaseExportFilename generates clean filenames for PDF and PNG exports', () => {
  assert.equal(
    formatPurchaseExportFilename('PUR-0005', 'MD. KARIM', '2026-10-23', 'pdf'),
    'ZSB_AQUATICS_Purchase_Challan_PUR-0005_MD_KARIM_2026-10-23.pdf'
  );
  assert.equal(
    formatPurchaseExportFilename('PUR-0005', 'MD. KARIM', '2026-10-23', 'png'),
    'ZSB_AQUATICS_Purchase_Challan_PUR-0005_MD_KARIM_2026-10-23.png'
  );
  assert.equal(
    formatPurchaseExportFilename('PUR-0001', '', '2026-10-23', 'png'),
    'ZSB_AQUATICS_Purchase_Challan_PUR-0001_2026-10-23.png'
  );
});

test('calculatePackingConsignmentSummary calculates cumulative export weight and number of consignments processed from Packing List database', () => {
  const emptySummary = calculatePackingConsignmentSummary([]);
  assert.equal(emptySummary.totalConsignments, 0);
  assert.equal(emptySummary.totalCumulativeWeightKg, 0);
  assert.equal(emptySummary.totalBoxes, 0);
  assert.equal(emptySummary.avgWeightPerConsignmentKg, 0);
  assert.equal(emptySummary.avgWeightPerBoxKg, 0);
  assert.equal(emptySummary.uniqueShippingMarksCount, 0);
  assert.deepEqual(emptySummary.uniqueDestinations, []);
  assert.equal(emptySummary.paidConsignmentsCount, 0);
  assert.equal(emptySummary.pendingConsignmentsCount, 0);

  const packings = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-2026-0001',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-19',
      fromDate: '2026-10-19',
      toDate: '2026-10-19',
      items: [],
      totalBox: 10,
      totalWeight: 150.5,
      totalAmount: 12040,
      paymentStatus: 'PAID' as const,
      createdAt: '',
    },
    {
      id: 'pkg-2',
      invoiceNumber: 'PKG-2026-0002',
      shippingMark: 'CHJ-22',
      flight: 'YG CAN',
      destination: 'KUNMING',
      shipper: 'SAJID INT.',
      packingDate: '2026-10-21',
      fromDate: '2026-10-21',
      toDate: '2026-10-21',
      items: [
        { id: 'r1', item: 'XXL', box: 15, weight: 20, totalWeight: 300, unit: 'KG', rate: 80, amount: 24000 },
      ],
      totalBox: 0, // fallback to items calculation (15 boxes)
      totalWeight: 0, // fallback to items calculation (300 KG)
      totalAmount: 24000,
      paymentStatus: 'REPORT' as const,
      createdAt: '',
    },
    {
      id: 'pkg-3',
      invoiceNumber: 'PKG-2026-0003',
      shippingMark: 'aad', // case-insensitive duplicate mark
      flight: 'CZ',
      destination: 'guangzhou', // case-insensitive duplicate destination
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-23',
      fromDate: '2026-10-23',
      toDate: '2026-10-23',
      items: [],
      totalBox: 25,
      totalWeight: 349.5,
      totalAmount: 27960,
      exporterStatus: 'PAID',
      createdAt: '',
    },
  ];

  const summary = calculatePackingConsignmentSummary(packings);
  assert.equal(summary.totalConsignments, 3);
  assert.equal(summary.totalCumulativeWeightKg, 800); // 150.5 + 300 + 349.5 = 800
  assert.equal(summary.totalBoxes, 50); // 10 + 15 + 25 = 50
  assert.equal(summary.avgWeightPerConsignmentKg, 266.67); // 800 / 3 = 266.67
  assert.equal(summary.avgWeightPerBoxKg, 16); // 800 / 50 = 16
  assert.equal(summary.uniqueShippingMarksCount, 2); // AAD, CHJ-22
  assert.deepEqual(summary.uniqueDestinations, ['GUANGZHOU', 'KUNMING']);
  assert.equal(summary.paidConsignmentsCount, 2);
  assert.equal(summary.pendingConsignmentsCount, 1);
  assert.equal(summary.latestConsignmentDate, '2026-10-23');
  assert.equal(summary.latestInvoiceNumber, 'PKG-2026-0003');
});
