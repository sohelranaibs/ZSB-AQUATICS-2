import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfitLossMonthlyTrends } from './profitLossTrends.ts';
import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

describe('calculateProfitLossMonthlyTrends', () => {
  const samplePurchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'INV-1',
      date: '2026-08-15',
      description: 'Supplier A',
      contactNumber: '+8801700000001',
      items: [],
      totalQty: 100,
      totalAmount: 100000,
      previousAmount: 0,
      paidAmount: 80000,
      balance: 20000,
      createdAt: '2026-08-15T00:00:00Z',
    },
    {
      id: 'pur-2',
      invoiceNumber: 'INV-2',
      date: '2026-09-10',
      description: 'Supplier B',
      contactNumber: '+8801700000002',
      items: [],
      totalQty: 150,
      totalAmount: 120000,
      previousAmount: 0,
      paidAmount: 120000,
      balance: 0,
      createdAt: '2026-09-10T00:00:00Z',
    },
  ];

  const samplePackings: PackingRecord[] = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-1',
      packingDate: '2026-08-20',
      shippingMark: 'AAD',
      flight: 'CZ392',
      destination: 'CAN',
      shipper: 'ZSB',
      fromDate: '2026-08-20',
      toDate: '2026-08-20',
      items: [],
      totalBox: 10,
      totalWeight: 160,
      totalAmount: 10000, // 165,000 BDT
      rmbRate: 16.5,
      totalAmountBDT: 165000,
      createdAt: '2026-08-20T00:00:00Z',
    },
    {
      id: 'pkg-2',
      invoiceNumber: 'PKG-2',
      packingDate: '2026-09-18',
      shippingMark: 'CHJ',
      flight: 'MU',
      destination: 'PVG',
      shipper: 'ZSB',
      fromDate: '2026-09-18',
      toDate: '2026-09-18',
      items: [],
      totalBox: 20,
      totalWeight: 320,
      totalAmount: 20000, // 330,000 BDT (+100% MoM)
      rmbRate: 16.5,
      totalAmountBDT: 330000,
      createdAt: '2026-09-18T00:00:00Z',
    },
  ];

  const samplePayments: PaymentRecord[] = [
    {
      id: 'pay-1',
      invoiceNumber: 'PAY-1',
      date: '2026-08-16',
      description: 'Supplier A',
      contactNumber: '+8801700000001',
      items: [],
      totalAmount: 80000,
      previousAmount: 0,
      paidAmount: 80000,
      balance: 20000,
      status: 'PAID',
      returnRMB: 0,
      paymentCategory: 'supplier',
      createdAt: '2026-08-16T00:00:00Z',
    },
  ];

  const sampleOtherCosts: OtherCostRecord[] = [];

  it('computes active months, MoM deltas, and net cashflow spreads accurately', () => {
    const res = calculateProfitLossMonthlyTrends(
      samplePurchases,
      samplePackings,
      samplePayments,
      sampleOtherCosts,
      { windowMode: 'active', rmbExchangeRate: 16.5 }
    );

    assert.equal(res.windowMode, 'active');
    assert.equal(res.points.length, 2);
    assert.equal(res.points[0].yearMonth, '2026-08');
    assert.equal(res.points[0].exportRevenue, 165000);
    assert.equal(res.points[0].supplierPaymentOutflow, 80000);
    assert.equal(res.points[0].netCashflowSpread, 85000);
    assert.equal(res.points[0].revenueMoMPercent, null);

    // Sep 2026 includes unvouchered direct purchase payment for Supplier B (120,000)
    assert.equal(res.points[1].yearMonth, '2026-09');
    assert.equal(res.points[1].exportRevenue, 330000);
    assert.equal(res.points[1].supplierPaymentOutflow, 120000);
    assert.equal(res.points[1].netCashflowSpread, 210000);
    assert.equal(res.points[1].revenueMoMPercent, 100);
    assert.equal(res.points[1].outflowMoMPercent, 50);

    assert.equal(res.latestMonth?.yearMonth, '2026-09');
    assert.equal(res.previousMonth?.yearMonth, '2026-08');
    assert.equal(res.totalExportRevenue, 495000);
    assert.equal(res.totalSupplierOutflow, 200000);
    assert.equal(res.totalNetCashflowSpread, 295000);
    assert.equal(res.overallOutflowToRevenueRatio, 40.4);
  });

  it('supports 6m and 12m rolling calendar windows', () => {
    const res6m = calculateProfitLossMonthlyTrends(
      samplePurchases,
      samplePackings,
      samplePayments,
      sampleOtherCosts,
      { windowMode: '6m', endYearMonth: '2026-09' }
    );
    assert.equal(res6m.points.length, 6);
    assert.equal(res6m.points[0].yearMonth, '2026-04');
    assert.equal(res6m.points[5].yearMonth, '2026-09');

    const res12m = calculateProfitLossMonthlyTrends(
      samplePurchases,
      samplePackings,
      samplePayments,
      sampleOtherCosts,
      { windowMode: '12m', endYearMonth: '2026-09' }
    );
    assert.equal(res12m.points.length, 12);
    assert.equal(res12m.points[0].yearMonth, '2025-10');
    assert.equal(res12m.points[11].yearMonth, '2026-09');
  });
});
