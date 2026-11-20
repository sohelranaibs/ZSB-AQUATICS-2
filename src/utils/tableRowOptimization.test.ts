import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPurchaseRowDataEqual,
  isPackingRowDataEqual,
  isExporterHistoryRowDataEqual,
  isAirWayBillRowDataEqual,
  isExporterSlipRowDataEqual,
  updatePurchaseRowById,
  updatePackingRowById,
  updateCustomExporterPaymentRowById,
  updateCustomAirWayBillRowById,
  updateCustomExporterSlipRowById,
} from './tableRowOptimization.ts';
import {
  PurchaseItemRow,
  PackingItemRow,
  PaymentItemRow,
  ExporterPaymentSlipRow,
} from '../types/index.ts';
import { AirWayBillRow } from './airWayBill.ts';

test('updatePurchaseRowById preserves sibling row references and bails out when unchanged', () => {
  const rows: PurchaseItemRow[] = [
    {
      id: '1',
      item: 'XL',
      quantity: 10,
      rate: 500,
      totalAmount: 5000,
      previousAmount: 0,
      paidAmount: 0,
      balance: 5000,
    },
    {
      id: '2',
      item: '2XL',
      quantity: 20,
      rate: 600,
      totalAmount: 12000,
      previousAmount: 0,
      paidAmount: 0,
      balance: 12000,
    },
  ];

  // Unchanged value returns exact same array reference
  const sameRef = updatePurchaseRowById(rows, '1', 'quantity', 10);
  assert.equal(sameRef, rows);

  // Changed value on row 1 creates new array & new row 1, but preserves row 2 reference
  const updated = updatePurchaseRowById(rows, '1', 'quantity', 15);
  assert.notEqual(updated, rows);
  assert.notEqual(updated[0], rows[0]);
  assert.equal(updated[1], rows[1]);
  assert.equal(updated[0].quantity, 15);
  assert.equal(updated[0].totalAmount, 7500);
  assert.equal(isPurchaseRowDataEqual(rows[1], updated[1]), true);
  assert.equal(isPurchaseRowDataEqual(rows[0], updated[0]), false);
});

test('updatePackingRowById preserves sibling row references and bails out when unchanged', () => {
  const rows: PackingItemRow[] = [
    {
      id: 'p1',
      item: 'BIG-3XL',
      box: 5,
      weight: 22,
      reportWeight: 0,
      totalWeight: 110,
      unit: 'KG',
      rate: 45,
      amount: 4950,
    },
    {
      id: 'p2',
      item: '2XL',
      box: 3,
      weight: 20,
      reportWeight: 0,
      totalWeight: 60,
      unit: 'KG',
      rate: 40,
      amount: 2400,
    },
  ];

  const sameRef = updatePackingRowById(rows, 'p1', 'rate', 45);
  assert.equal(sameRef, rows);

  const updated = updatePackingRowById(rows, 'p1', 'rate', 50);
  assert.notEqual(updated, rows);
  assert.notEqual(updated[0], rows[0]);
  assert.equal(updated[1], rows[1]);
  assert.equal(updated[0].amount, 5500);
  assert.equal(isPackingRowDataEqual(rows[1], updated[1]), true);
  assert.equal(isPackingRowDataEqual(rows[0], updated[0]), false);

  // Decimal rate and zero rate recalculate immediately
  const decimalRate = updatePackingRowById(updated, 'p1', 'rate', 45.5);
  assert.equal(decimalRate[0].amount, 5005); // 110 * 45.5
  const zeroRate = updatePackingRowById(decimalRate, 'p1', 'rate', 0);
  assert.equal(zeroRate[0].amount, 0);

  // Report weight immediately updates totalWeight and amount
  const withReportWeight = updatePackingRowById(decimalRate, 'p1', 'reportWeight', 12.5);
  assert.equal(withReportWeight[0].totalWeight, 62.5); // 5 * 12.5
  assert.equal(withReportWeight[0].amount, 2843.75); // 62.5 * 45.5
});

test('updateCustomExporterPaymentRowById updates balance and bails out when unchanged', () => {
  const rows: PaymentItemRow[] = [
    {
      id: 'e1',
      shippingMark: 'AAD',
      description: 'Shipment 1',
      debitAmount: 1000,
      reportAmount: 950,
      creditAmount: 400,
      balance: 550,
      status: 'UNPAID',
    },
    {
      id: 'e2',
      shippingMark: 'S45',
      description: 'Shipment 2',
      debitAmount: 2000,
      reportAmount: 2000,
      creditAmount: 2000,
      balance: 0,
      status: 'PAID',
    },
  ];

  const sameRef = updateCustomExporterPaymentRowById(rows, 'e1', 'creditAmount', 400);
  assert.equal(sameRef, rows);

  const updated = updateCustomExporterPaymentRowById(rows, 'e1', 'creditAmount', 500);
  assert.notEqual(updated, rows);
  assert.equal(updated[1], rows[1]);
  assert.equal(updated[0].balance, 450);
  assert.equal(isExporterHistoryRowDataEqual(rows[1], updated[1]), true);
  assert.equal(isExporterHistoryRowDataEqual(rows[0], updated[0]), false);
});

test('updateCustomAirWayBillRowById computes totals and preserves sibling references', () => {
  const rows: AirWayBillRow[] = [
    {
      id: 'awb-1',
      date: '2026-03-01',
      shipper: 'ZSB AQUATICS',
      flight: 'CZ392',
      totalBox: 10,
      rmbPerBox: 100,
      totalRmb: 1000,
      rate: 16.5,
      bdtAmount: 16500,
    },
    {
      id: 'awb-2',
      date: '2026-03-02',
      shipper: 'ZSB AQUATICS',
      flight: 'BS325',
      totalBox: 5,
      rmbPerBox: 100,
      totalRmb: 500,
      rate: 16.5,
      bdtAmount: 8250,
    },
  ];

  const sameRef = updateCustomAirWayBillRowById(rows, 'awb-1', 'rmbPerBox', '100');
  assert.equal(sameRef, rows);

  const updated = updateCustomAirWayBillRowById(rows, 'awb-1', 'rmbPerBox', '120');
  assert.notEqual(updated, rows);
  assert.equal(updated[1], rows[1]);
  assert.equal(updated[0].totalRmb, 1200);
  assert.equal(updated[0].bdtAmount, 19800);
  assert.equal(isAirWayBillRowDataEqual(rows[1], updated[1]), true);
  assert.equal(isAirWayBillRowDataEqual(rows[0], updated[0]), false);

  const negRate = updateCustomAirWayBillRowById(updated, 'awb-1', 'rate', '-18.9');
  assert.equal(negRate[0].rate, -18.9);
  assert.equal(negRate[0].rateSpecified, true);
  assert.equal(negRate[0].bdtAmount, -22680);

  const negZeroRate = updateCustomAirWayBillRowById(negRate, 'awb-1', 'rate', '-0');
  assert.equal(Object.is(negZeroRate[0].rate, 0), true);
  assert.equal(negZeroRate[0].rateSpecified, true);
  assert.equal(Object.is(negZeroRate[0].bdtAmount, 0), true);

  const posZeroRate = updateCustomAirWayBillRowById(negZeroRate, 'awb-1', 'rate', '+0');
  assert.equal(Object.is(posZeroRate[0].rate, 0), true);
  assert.equal(posZeroRate[0].rateSpecified, true);
  assert.equal(Object.is(posZeroRate[0].bdtAmount, 0), true);

  const holderUpdated = updateCustomAirWayBillRowById(posZeroRate, 'awb-1', 'documentsHolder', 'SAJID INT.');
  assert.equal(holderUpdated[0].documentsHolder, 'SAJID INT.');
});

test('updateCustomExporterSlipRowById normalizes uppercase mark/flight and bails out when unchanged', () => {
  const rows: ExporterPaymentSlipRow[] = [
    {
      id: 's1',
      date: '2026-03-01',
      flight: 'CZ392',
      mark: 'AAD',
      box: 12,
      weightKg: 264,
      rmb: 40,
      amount: 10560,
      status: 'UNPAID',
    },
    {
      id: 's2',
      date: '2026-03-02',
      flight: 'BS325',
      mark: 'S45',
      box: 8,
      weightKg: 176,
      rmb: 40,
      amount: 7040,
      status: 'PAID',
    },
  ];

  const sameRef = updateCustomExporterSlipRowById(rows, 's1', 'mark', 'aad');
  assert.equal(sameRef, rows);

  const updated = updateCustomExporterSlipRowById(rows, 's1', 'box', 15);
  assert.notEqual(updated, rows);
  assert.equal(updated[1], rows[1]);
  assert.equal(updated[0].box, 15);
  assert.equal(isExporterSlipRowDataEqual(rows[1], updated[1]), true);
  assert.equal(isExporterSlipRowDataEqual(rows[0], updated[0]), false);
});
