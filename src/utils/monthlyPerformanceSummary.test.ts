import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonthlyPerformanceSummary } from './monthlyPerformanceSummary.ts';
import { initialPurchases, initialPayments } from '../context/initialData.ts';

test('calculateMonthlyPerformanceSummary computes accurate monthly purchases vs payments for seed records', () => {
  const result = calculateMonthlyPerformanceSummary(
    initialPurchases,
    initialPayments,
    {
      monthsToShow: 6,
      endYearMonth: '2026-10',
      activeOnly: false,
      paymentMode: 'all_payments',
    }
  );

  assert.equal(result.points.length, 6);
  assert.equal(result.periodRangeLabel, 'May 2026 – Oct 2026');

  const octPoint = result.points.find((p) => p.yearMonth === '2026-10');
  assert.ok(octPoint);
  // Oct 2026: INV-2026-1001 (125,000) + INV-2026-1012 (94,500) = 219,500
  assert.equal(octPoint.totalPurchases, 219500);
  // Oct 2026 payments: PAY-2026-1001 (100,000) + PAY-2026-1013 (94,500) = 194,500
  assert.equal(octPoint.totalPayments, 194500);
  assert.equal(octPoint.netPayableVariance, 25000);
  assert.equal(octPoint.settlementStatus, 'PARTIAL_SETTLED');

  const augPoint = result.points.find((p) => p.yearMonth === '2026-08');
  assert.ok(augPoint);
  assert.equal(augPoint.totalPurchases, 110000);
  assert.equal(augPoint.totalPayments, 110000);
  assert.equal(augPoint.netPayableVariance, 0);
  assert.equal(augPoint.settlementStatus, 'FULLY_SETTLED');
});

test('calculateMonthlyPerformanceSummary supports activeOnly and payment_vouchers mode', () => {
  const activeVouchersOnly = calculateMonthlyPerformanceSummary(
    initialPurchases,
    initialPayments,
    {
      activeOnly: true,
      paymentMode: 'payment_vouchers',
    }
  );

  // Active months in seed: 2026-07, 2026-08, 2026-09, 2026-10 (4 months)
  assert.equal(activeVouchersOnly.points.length, 4);

  const julPoint = activeVouchersOnly.points.find((p) => p.yearMonth === '2026-07');
  assert.ok(julPoint);
  assert.equal(julPoint.totalPurchases, 76000);
  // In payment_vouchers mode, July has 0 standalone PaymentRecord vouchers
  assert.equal(julPoint.totalPayments, 0);
  assert.equal(julPoint.settlementStatus, 'UNPAID');

  // Totals across all 4 active months:
  // Purchases: 76,000 + 110,000 + 160,000 + 219,500 = 565,500
  assert.equal(activeVouchersOnly.totals.totalPurchases, 565500);
  // Vouchers only: 110,000 + 120,000 + 194,500 = 424,500
  assert.equal(activeVouchersOnly.totals.totalPayments, 424500);
  assert.equal(activeVouchersOnly.totals.peakPurchaseMonth, 'Oct 2026');
  assert.equal(activeVouchersOnly.totals.peakPaymentMonth, 'Oct 2026');
});
