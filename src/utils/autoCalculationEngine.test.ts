import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundToTwoDecimals,
  sanitizeNonNegativeNumber,
  sanitizeGstRate,
  calculatePurchaseRowEngine,
  recalculatePurchaseRows,
  runPurchaseAutoCalculationEngine,
  calculatePackingRowEngine,
  recalculatePackingRows,
  runPackingAutoCalculationEngine,
} from './autoCalculationEngine.ts';
import { PurchaseItemRow, PackingItemRow } from '../types/index.ts';

test('sanitizeNonNegativeNumber and sanitizeGstRate handle strings, negatives, and NaN safely', () => {
  assert.equal(sanitizeNonNegativeNumber(125.5), 125.5);
  assert.equal(sanitizeNonNegativeNumber('450.75'), 450.75);
  assert.equal(sanitizeNonNegativeNumber('-10'), 0);
  assert.equal(sanitizeNonNegativeNumber(-50), 0);
  assert.equal(sanitizeNonNegativeNumber(''), 0);
  assert.equal(sanitizeNonNegativeNumber(NaN), 0);

  assert.equal(sanitizeGstRate(5), 5);
  assert.equal(sanitizeGstRate('18'), 18);
  assert.equal(sanitizeGstRate(-5), 0);
  assert.equal(sanitizeGstRate(150), 100);
  assert.equal(roundToTwoDecimals(10.555), 10.56);
});

test('calculatePurchaseRowEngine computes subtotal, GST amount, and total in real-time', () => {
  // Without GST (0%)
  const r0 = calculatePurchaseRowEngine(25, 400, 0);
  assert.equal(r0.quantity, 25);
  assert.equal(r0.rate, 400);
  assert.equal(r0.subtotal, 10000);
  assert.equal(r0.gstRate, 0);
  assert.equal(r0.gstAmount, 0);
  assert.equal(r0.totalAmount, 10000);

  // With 5% GST
  const r5 = calculatePurchaseRowEngine(25, 400, 5);
  assert.equal(r5.subtotal, 10000);
  assert.equal(r5.gstRate, 5);
  assert.equal(r5.gstAmount, 500);
  assert.equal(r5.totalAmount, 10500);

  // With 12% GST and decimal quantity/rate
  const r12 = calculatePurchaseRowEngine('12.5', '350.4', '12');
  assert.equal(r12.subtotal, 4380); // 12.5 * 350.4
  assert.equal(r12.gstAmount, 525.6); // 4380 * 0.12
  assert.equal(r12.totalAmount, 4905.6);
});

test('runPurchaseAutoCalculationEngine aggregates multi-row subtotals, GST, totals, and net balance', () => {
  const rows: PurchaseItemRow[] = [
    {
      id: '1',
      item: 'F1',
      quantity: 20,
      rate: 500,
      gstRate: 5,
      totalAmount: 0,
      previousAmount: 0,
      paidAmount: 0,
      balance: 0,
    },
    {
      id: '2',
      item: 'FF1',
      quantity: 10,
      rate: 800,
      gstRate: 12,
      totalAmount: 0,
      previousAmount: 0,
      paidAmount: 0,
      balance: 0,
    },
    {
      id: '3',
      item: '',
      quantity: 0,
      rate: 0,
      totalAmount: 0,
      previousAmount: 0,
      paidAmount: 0,
      balance: 0,
    },
  ];

  const summary = runPurchaseAutoCalculationEngine(rows, 2000, 10000, 5);

  assert.equal(summary.activeRowCount, 2);
  assert.equal(summary.totalQty, 30);
  // Row 1: subtotal 10,000, GST (5%) = 500, total = 10,500
  // Row 2: subtotal 8,000, GST (12%) = 960, total = 8,960
  assert.equal(summary.subtotalAmount, 18000);
  assert.equal(summary.totalGstAmount, 1460);
  assert.equal(summary.totalAmount, 19460);
  assert.equal(summary.previousAmount, 2000);
  assert.equal(summary.paidAmount, 10000);
  assert.equal(summary.balance, 11460); // 19460 + 2000 - 10000

  // Verify recalculatePurchaseRows with applyDefaultGstToAll = true
  const uniformRows = recalculatePurchaseRows(rows, 18, true);
  assert.equal(uniformRows[0].gstRate, 18);
  assert.equal(uniformRows[0].gstAmount, 1800);
  assert.equal(uniformRows[0].totalAmount, 11800);
  assert.equal(uniformRows[1].gstRate, 18);
  assert.equal(uniformRows[1].gstAmount, 1440);
  assert.equal(uniformRows[1].totalAmount, 9440);
});

test('calculatePackingRowEngine computes totalWeight, subtotal, GST amount, and amount in real-time', () => {
  // Without GST (0%)
  const p0 = calculatePackingRowEngine(10, 20, 85, 0);
  assert.equal(p0.totalWeight, 200);
  assert.equal(p0.subtotal, 17000);
  assert.equal(p0.gstRate, 0);
  assert.equal(p0.gstAmount, 0);
  assert.equal(p0.amount, 17000);

  // With 5% GST
  const p5 = calculatePackingRowEngine(10, 20, 85, 5);
  assert.equal(p5.totalWeight, 200);
  assert.equal(p5.subtotal, 17000);
  assert.equal(p5.gstRate, 5);
  assert.equal(p5.gstAmount, 850);
  assert.equal(p5.amount, 17850);
});

test('runPackingAutoCalculationEngine aggregates boxes, weights, subtotals, GST, and grand total', () => {
  const rows: PackingItemRow[] = [
    {
      id: '1',
      item: 'XXL',
      box: 5,
      weight: 20,
      totalWeight: 0,
      unit: 'KG',
      rate: 100,
      gstRate: 5,
      amount: 0,
    },
    {
      id: '2',
      item: 'XL',
      box: 10,
      weight: 15,
      totalWeight: 0,
      unit: 'KG',
      rate: 80,
      gstRate: 5,
      amount: 0,
    },
    {
      id: '3',
      item: '',
      box: 0,
      weight: 0,
      totalWeight: 0,
      unit: 'KG',
      rate: 0,
      amount: 0,
    },
  ];

  const summary = runPackingAutoCalculationEngine(rows, 5);

  assert.equal(summary.activeRowCount, 2);
  assert.equal(summary.totalBox, 15);
  assert.equal(summary.totalWeight, 250); // 100 + 150
  // Row 1: 100kg * 100 = 10,000 subtotal, 500 GST, 10,500 total
  // Row 2: 150kg * 80 = 12,000 subtotal, 600 GST, 12,600 total
  assert.equal(summary.subtotalAmount, 22000);
  assert.equal(summary.totalGstAmount, 1100);
  assert.equal(summary.totalAmount, 23100);
  assert.equal(summary.effectiveGstRate, 5);
  assert.equal(summary.avgRatePerKg, 88); // 22000 / 250

  // Verify recalculatePackingRows with applyDefaultGstToAll = true
  const updatedRows = recalculatePackingRows(rows, 12, true);
  assert.equal(updatedRows[0].gstRate, 12);
  assert.equal(updatedRows[0].gstAmount, 1200);
  assert.equal(updatedRows[0].amount, 11200);
});
