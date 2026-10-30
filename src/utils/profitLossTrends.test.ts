import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMonthlySupplierOutflow,
  calculateProfitLossMonthlyTrends,
} from './profitLossTrends.ts';
import {
  samplePurchases as initialPurchases,
  samplePackings as initialPackings,
  samplePayments as initialPayments,
  sampleOtherCosts as initialOtherCosts,
} from '../context/initialData.ts';
import { PurchaseRecord, PaymentRecord, PackingRecord } from '../types/index.ts';

test('computeMonthlySupplierOutflow sums supplier payment vouchers and avoids double-counting matching purchase paid amounts', () => {
  const octPurchases = initialPurchases.filter((p) => p.date.startsWith('2026-10'));
  const octPayments = initialPayments.filter((pm) => pm.date.startsWith('2026-10'));

  const result = computeMonthlySupplierOutflow(octPurchases, octPayments);
  // In 2026-10: ABDULLAH VAI voucher = 100,000, UZZAL VAI voucher = 94,500 -> total 194,500
  assert.equal(result.supplierVoucherOutflow, 194500);
  assert.equal(result.supplierPaymentOutflow, 194500);
  assert.equal(result.purchaseBillTotal, 219500);
  assert.equal(result.supplierPaymentCount, 2);
});

test('computeMonthlySupplierOutflow includes paidAmount from purchases when a supplier has no voucher in that month and ignores exporter payments', () => {
  const purchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'INV-1',
      date: '2026-10-10',
      description: 'NEW SUPPLIER',
      contactNumber: '',
      items: [],
      totalQty: 50,
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 35000,
      balance: 15000,
      remarks: '',
      createdAt: '',
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'exp-1',
      invoiceNumber: 'EXP-2026-0001',
      date: '2026-10-11',
      description: 'AAD',
      shippingMark: 'AAD',
      paymentCategory: 'exporter',
      contactNumber: '',
      items: [],
      totalAmount: 200000,
      previousAmount: 0,
      paidAmount: 200000,
      balance: 0,
      status: 'PAID',
      returnRMB: 12000,
      remarks: '',
      createdAt: '',
    },
  ];

  const result = computeMonthlySupplierOutflow(purchases, payments);
  assert.equal(result.supplierVoucherOutflow, 0);
  assert.equal(result.supplierPaymentOutflow, 35000);
  assert.equal(result.supplierPaymentCount, 1);
});

test('calculateProfitLossMonthlyTrends computes accurate MoM export revenue vs supplier payment outflows on seed data', () => {
  const trends = calculateProfitLossMonthlyTrends(
    initialPurchases,
    initialPackings,
    initialPayments,
    initialOtherCosts,
    { windowMode: 'active', rmbExchangeRate: 16.5 }
  );

  assert.equal(trends.points.length, 4);
  assert.deepEqual(
    trends.points.map((p) => p.yearMonth),
    ['2026-07', '2026-08', '2026-09', '2026-10']
  );

  // Jul 2026: Export = 0, Outflow = 60,000 (Kabir Vai purchase paid), Spread = -60,000
  const jul = trends.points[0];
  assert.equal(jul.exportRevenue, 0);
  assert.equal(jul.supplierPaymentOutflow, 60000);
  assert.equal(jul.netCashflowSpread, -60000);

  // Aug 2026: Export = 198,000, Outflow = 110,000, Spread = 88,000
  const aug = trends.points[1];
  assert.equal(aug.exportRevenue, 198000);
  assert.equal(aug.supplierPaymentOutflow, 110000);
  assert.equal(aug.netCashflowSpread, 88000);
  assert.equal(aug.revenueMoMPercent, null);

  // Sep 2026: Export = 305,250 (+54.2%), Outflow = 120,000 (+9.1%), Spread = 185,250
  const sep = trends.points[2];
  assert.equal(sep.exportRevenue, 305250);
  assert.equal(sep.supplierPaymentOutflow, 120000);
  assert.equal(sep.netCashflowSpread, 185250);
  assert.equal(sep.revenueMoMChange, 107250);
  assert.equal(sep.revenueMoMPercent, 54.2);
  assert.equal(sep.outflowMoMChange, 10000);
  assert.equal(sep.outflowMoMPercent, 9.1);

  // Oct 2026: Export = 432,300 (+41.6%), Outflow = 194,500 (+62.1%), Spread = 237,800
  const oct = trends.points[3];
  assert.equal(oct.exportRevenue, 432300);
  assert.equal(oct.supplierPaymentOutflow, 194500);
  assert.equal(oct.netCashflowSpread, 237800);
  assert.equal(oct.revenueMoMChange, 127050);
  assert.equal(oct.revenueMoMPercent, 41.6);
  assert.equal(oct.outflowMoMChange, 74500);
  assert.equal(oct.outflowMoMPercent, 62.1);

  // Aggregate totals
  assert.equal(trends.totalExportRevenue, 935550);
  assert.equal(trends.totalSupplierOutflow, 484500);
  assert.equal(trends.totalNetCashflowSpread, 451050);
  assert.equal(trends.overallOutflowToRevenueRatio, 51.8);
  assert.equal(trends.latestMonth?.yearMonth, '2026-10');
  assert.equal(trends.previousMonth?.yearMonth, '2026-09');
});

test('calculateProfitLossMonthlyTrends supports 6m and 12m rolling windows and handles empty records safely', () => {
  const sixMonth = calculateProfitLossMonthlyTrends(
    initialPurchases,
    initialPackings,
    initialPayments,
    initialOtherCosts,
    { windowMode: '6m', endYearMonth: '2026-10', rmbExchangeRate: 16.5 }
  );
  assert.equal(sixMonth.points.length, 6);
  assert.equal(sixMonth.points[0].yearMonth, '2026-05');
  assert.equal(sixMonth.points[5].yearMonth, '2026-10');

  const emptyTrends = calculateProfitLossMonthlyTrends([], [], [], [], {
    windowMode: 'active',
    endYearMonth: '2026-10',
  });
  assert.equal(emptyTrends.points.length, 1);
  assert.equal(emptyTrends.totalExportRevenue, 0);
  assert.equal(emptyTrends.totalSupplierOutflow, 0);
  assert.equal(emptyTrends.overallOutflowToRevenueRatio, 0);
});
