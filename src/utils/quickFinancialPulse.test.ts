import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPulsePresetDateRange,
  computePreviousPeriodWindow,
  buildVolumePeriodComparison,
  calculateQuickFinancialPulse,
} from './quickFinancialPulse.ts';
import type { PurchaseRecord, PaymentRecord } from '../types/index.ts';

describe('quickFinancialPulse utility', () => {
  it('computes accurate preset date ranges and previous period windows', () => {
    const refDate = new Date(2026, 10, 10); // Nov 10, 2026
    const r7 = getPulsePresetDateRange('last_7_days', refDate);
    assert.equal(r7.startDate, '2026-11-04');
    assert.equal(r7.endDate, '2026-11-10');

    const prevWindow = computePreviousPeriodWindow('2026-11-04', '2026-11-10');
    assert.equal(prevWindow.daysCount, 7);
    assert.equal(prevWindow.startDate, '2026-10-28');
    assert.equal(prevWindow.endDate, '2026-11-03');
  });

  it('builds up, down, and flat period-over-period volume comparison objects', () => {
    const up = buildVolumePeriodComparison(125000, 100000);
    assert.equal(up.direction, 'up');
    assert.equal(up.deltaAmount, 25000);
    assert.equal(up.deltaPercent, 25);

    const down = buildVolumePeriodComparison(60000, 100000);
    assert.equal(down.direction, 'down');
    assert.equal(down.deltaAmount, -40000);
    assert.equal(down.deltaPercent, -40);

    const flat = buildVolumePeriodComparison(50000, 50000);
    assert.equal(flat.direction, 'flat');
    assert.equal(flat.deltaAmount, 0);
    assert.equal(flat.deltaPercent, 0);
  });

  it('aggregates purchase vs payment volumes across a date range and compares against the previous period', () => {
    const purchases: PurchaseRecord[] = [
      {
        id: 'p-1',
        invoiceNumber: 'PUR-01',
        date: '2026-11-01',
        description: 'SUPPLIER A',
        contactNumber: '01700000001',
        items: [],
        totalQty: 100,
        totalAmount: 50000,
        previousAmount: 0,
        paidAmount: 20000, // synced with pay-sync-p-1
        balance: 30000,
        createdAt: '2026-11-01T08:00:00Z',
      },
      {
        id: 'p-2',
        invoiceNumber: 'PUR-02',
        date: '2026-11-02',
        description: 'SUPPLIER B',
        contactNumber: '01700000002',
        items: [],
        totalQty: 150,
        totalAmount: 75000,
        previousAmount: 0,
        paidAmount: 15000, // direct payment (not synced)
        balance: 60000,
        createdAt: '2026-11-02T09:00:00Z',
      },
      {
        id: 'p-prev',
        invoiceNumber: 'PUR-00',
        date: '2026-10-30', // Falls in the 2-day previous period [2026-10-30, 2026-10-31]
        description: 'SUPPLIER OLD',
        contactNumber: '01700000000',
        items: [],
        totalQty: 200,
        totalAmount: 100000,
        previousAmount: 0,
        paidAmount: 100000, // Direct payment in previous period = 100,000
        balance: 0,
        createdAt: '2026-10-30T09:00:00Z',
      },
    ];

    const payments: PaymentRecord[] = [
      {
        id: 'pay-sync-p-1',
        invoiceNumber: 'PAY-SYNC-01',
        date: '2026-11-01',
        description: 'SUPPLIER A',
        contactNumber: '01700000001',
        exportGoodsRef: 'PUR-01',
        paymentCategory: 'supplier',
        totalAmount: 50000,
        previousAmount: 0,
        paidAmount: 20000,
        balance: 30000,
        returnRMB: 0,
        status: 'PARTIAL',
        items: [],
        createdAt: '2026-11-01T08:05:00Z',
      },
      {
        id: 'pm-exp-1',
        invoiceNumber: 'EXP-PAY-01',
        date: '2026-11-02',
        description: 'EXPORTER X',
        contactNumber: '01700000009',
        paymentCategory: 'exporter',
        totalAmount: 40000,
        previousAmount: 0,
        paidAmount: 40000,
        balance: 0,
        returnRMB: 0,
        status: 'PAID',
        items: [],
        createdAt: '2026-11-02T14:00:00Z',
      },
    ];

    const pulse = calculateQuickFinancialPulse(
      purchases,
      payments,
      '2026-11-01',
      '2026-11-02'
    );

    assert.equal(pulse.activeDaysCount, 2);
    assert.equal(pulse.totalPurchaseVolume, 125000);
    assert.equal(pulse.totalPaymentVolume, 75000);

    // Previous period [2026-10-30, 2026-10-31] had 100,000 purchase volume and 100,000 payment volume
    // Current period has 125,000 purchase volume (+25% -> 'up') and 75,000 payment volume (-25% -> 'down')
    assert.equal(pulse.purchaseComparison.previousVolume, 100000);
    assert.equal(pulse.purchaseComparison.direction, 'up');
    assert.equal(pulse.purchaseComparison.deltaPercent, 25);

    assert.equal(pulse.paymentComparison.previousVolume, 100000);
    assert.equal(pulse.paymentComparison.direction, 'down');
    assert.equal(pulse.paymentComparison.deltaPercent, -25);
  });
});
