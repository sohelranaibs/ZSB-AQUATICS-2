import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSixMonthProfitLossTrends,
  formatCompactCurrencyAxisTick,
} from './dashboardProfitLossChart.ts';
import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

describe('dashboardProfitLossChart 6-month area chart helpers', () => {
  it('formats compact axis ticks cleanly across ranges', () => {
    assert.equal(formatCompactCurrencyAxisTick(0), '0');
    assert.equal(formatCompactCurrencyAxisTick(850), '850');
    assert.equal(formatCompactCurrencyAxisTick(12500), '12.5k');
    assert.equal(formatCompactCurrencyAxisTick(250000), '250k');
    assert.equal(formatCompactCurrencyAxisTick(1500000), '1.5M');
  });

  it('aggregates rolling 6-month revenue, costs, and net profit accurately', () => {
    const purchases: PurchaseRecord[] = [
      {
        id: 'pur-1',
        invoiceNumber: 'INV-1',
        date: '2026-09-10',
        description: 'Supplier A',
        contactNumber: '+8801700000001',
        items: [],
        totalQty: 100,
        totalAmount: 100000,
        previousAmount: 0,
        paidAmount: 100000,
        balance: 0,
        createdAt: '2026-09-10T00:00:00Z',
      },
      {
        id: 'pur-2',
        invoiceNumber: 'INV-2',
        date: '2026-10-05',
        description: 'Supplier B',
        contactNumber: '+8801700000002',
        items: [],
        totalQty: 120,
        totalAmount: 150000,
        previousAmount: 0,
        paidAmount: 150000,
        balance: 0,
        createdAt: '2026-10-05T00:00:00Z',
      },
    ];

    const packings: PackingRecord[] = [
      {
        id: 'pkg-1',
        invoiceNumber: 'PKG-1',
        packingDate: '2026-09-15',
        shippingMark: 'AAD',
        flight: 'CZ392',
        destination: 'CAN',
        shipper: 'ZSB',
        fromDate: '2026-09-15',
        toDate: '2026-09-15',
        items: [],
        totalBox: 10,
        totalWeight: 160,
        totalAmount: 10000, // RMB * 16.5 = 165,000 BDT
        rmbRate: 16.5,
        totalAmountBDT: 165000,
        createdAt: '2026-09-15T00:00:00Z',
      },
      {
        id: 'pkg-2',
        invoiceNumber: 'PKG-2',
        packingDate: '2026-10-12',
        shippingMark: 'CHJ',
        flight: 'MU',
        destination: 'PVG',
        shipper: 'ZSB',
        fromDate: '2026-10-12',
        toDate: '2026-10-12',
        items: [],
        totalBox: 15,
        totalWeight: 240,
        totalAmount: 20000, // RMB * 16.5 = 330,000 BDT
        rmbRate: 16.5,
        totalAmountBDT: 330000,
        createdAt: '2026-10-12T00:00:00Z',
      },
    ];

    const otherCosts: OtherCostRecord[] = [
      {
        id: 'oc-1',
        date: '2026-10-14',
        category: 'Air Freight',
        description: 'Cargo charges',
        amount: 25000,
        createdAt: '2026-10-14T00:00:00Z',
      },
    ];

    const payments: PaymentRecord[] = [];
    const summary = buildSixMonthProfitLossTrends(
      purchases,
      packings,
      payments,
      otherCosts,
      { rmbExchangeRate: 16.5, endYearMonth: '2026-10', monthsToShow: 6 }
    );

    assert.equal(summary.points.length, 6);
    assert.equal(summary.points[0].yearMonth, '2026-05');
    assert.equal(summary.points[5].yearMonth, '2026-10');
    assert.equal(summary.periodRangeLabel, 'May 2026 – Oct 2026');

    const sep = summary.points[4];
    assert.equal(sep.revenue, 165000);
    assert.equal(sep.costs, 100000);
    assert.equal(sep.netProfit, 65000);

    const oct = summary.points[5];
    assert.equal(oct.revenue, 330000);
    assert.equal(oct.purchasesCost, 150000);
    assert.equal(oct.operatingCost, 25000);
    assert.equal(oct.costs, 175000);
    assert.equal(oct.netProfit, 155000);

    assert.equal(summary.totalRevenue, 495000);
    assert.equal(summary.totalCosts, 275000);
    assert.equal(summary.totalNetProfit, 220000);
  });
});
