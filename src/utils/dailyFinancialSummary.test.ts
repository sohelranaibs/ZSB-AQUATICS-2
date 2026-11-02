import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeToIsoDate,
  getEffectivePaymentAmount,
  calculateDailyFinancialSummary,
} from './dailyFinancialSummary.ts';
import type { PurchaseRecord, PaymentRecord } from '../types/index.ts';

describe('dailyFinancialSummary utility', () => {
  it('normalizes ISO, DD-MMM-YYYY, and DD/MM/YYYY dates to YYYY-MM-DD', () => {
    assert.equal(normalizeToIsoDate('2026-11-02'), '2026-11-02');
    assert.equal(normalizeToIsoDate('2026-11-02T14:30:00.000Z'), '2026-11-02');
    assert.equal(normalizeToIsoDate('02-Nov-2026'), '2026-11-02');
    assert.equal(normalizeToIsoDate('2/11/2026'), '2026-11-02');
    assert.equal(normalizeToIsoDate(''), '');
  });

  it('resolves effective payment amount from paidAmount, items creditAmount, or totalAmount', () => {
    const voucherWithPaid: PaymentRecord = {
      id: 'pm-1',
      invoiceNumber: 'PAY-001',
      date: '2026-11-02',
      description: 'BAGERHAT SUPPLIER',
      contactNumber: '01700000000',
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 35000,
      balance: 15000,
      returnRMB: 0,
      status: 'PARTIAL',
      items: [],
      createdAt: '2026-11-02T10:00:00Z',
    };
    assert.equal(getEffectivePaymentAmount(voucherWithPaid), 35000);

    const voucherWithItemsCredit: PaymentRecord = {
      id: 'pm-2',
      invoiceNumber: 'PAY-002',
      date: '2026-11-02',
      description: 'KHULNA SUPPLIER',
      contactNumber: '01700000000',
      totalAmount: 40000,
      previousAmount: 0,
      paidAmount: 0,
      balance: 10000,
      returnRMB: 0,
      status: 'PARTIAL',
      items: [
        {
          id: 'i-1',
          description: 'EEL',
          debitAmount: 40000,
          creditAmount: 30000,
          balance: 10000,
        },
      ],
      createdAt: '2026-11-02T10:00:00Z',
    };
    assert.equal(getEffectivePaymentAmount(voucherWithItemsCredit), 30000);
  });

  it('calculates total purchases and total payments for the current day accurately without double-counting synced vouchers', () => {
    const targetDay = '2026-11-02';
    const purchases: PurchaseRecord[] = [
      {
        id: 'pur-1',
        invoiceNumber: 'PUR-101',
        date: '2026-11-02',
        description: 'SUPPLIER ALPHA',
        contactNumber: '01711111111',
        items: [],
        totalQty: 120,
        totalAmount: 60000,
        previousAmount: 0,
        paidAmount: 20000, // Synced with pay-sync-pur-1 below
        balance: 40000,
        createdAt: '2026-11-02T09:00:00Z',
      },
      {
        id: 'pur-2',
        invoiceNumber: 'PUR-102',
        date: '02-Nov-2026', // DD-MMM-YYYY format for same day
        description: 'SUPPLIER BETA',
        contactNumber: '01722222222',
        items: [],
        totalQty: 80,
        totalAmount: 40000,
        previousAmount: 0,
        paidAmount: 10000, // Direct payment without separate voucher
        balance: 30000,
        createdAt: '2026-11-02T09:30:00Z',
      },
      {
        id: 'pur-old',
        invoiceNumber: 'PUR-099',
        date: '2026-11-01', // Previous day - should be excluded
        description: 'SUPPLIER OLD',
        contactNumber: '01733333333',
        items: [],
        totalQty: 500,
        totalAmount: 250000,
        previousAmount: 0,
        paidAmount: 250000,
        balance: 0,
        createdAt: '2026-11-01T09:00:00Z',
      },
    ];

    const payments: PaymentRecord[] = [
      {
        id: 'pay-sync-pur-1',
        invoiceNumber: 'PAY-SYNC-101',
        date: '2026-11-02',
        description: 'SUPPLIER ALPHA',
        contactNumber: '01711111111',
        exportGoodsRef: 'PUR-101',
        paymentCategory: 'supplier',
        totalAmount: 60000,
        previousAmount: 0,
        paidAmount: 20000,
        balance: 40000,
        returnRMB: 0,
        status: 'PARTIAL PAID',
        items: [],
        createdAt: '2026-11-02T09:05:00Z',
      },
      {
        id: 'pm-sup-standalone',
        invoiceNumber: 'PAY-201',
        date: '2026-11-02',
        description: 'SUPPLIER GAMMA',
        contactNumber: '01744444444',
        paymentCategory: 'supplier',
        totalAmount: 25000,
        previousAmount: 0,
        paidAmount: 25000,
        balance: 0,
        returnRMB: 0,
        status: 'PAID IN FULL',
        items: [],
        createdAt: '2026-11-02T11:00:00Z',
      },
      {
        id: 'pm-exp-1',
        invoiceNumber: 'EXP-PAY-301',
        date: '2026-11-02',
        description: 'EXPORTER DELTA',
        contactNumber: '01755555555',
        paymentCategory: 'exporter',
        totalAmount: 15000,
        previousAmount: 0,
        paidAmount: 15000,
        balance: 0,
        returnRMB: 0,
        status: 'PAID IN FULL',
        items: [],
        createdAt: '2026-11-02T12:00:00Z',
      },
    ];

    const summary = calculateDailyFinancialSummary(
      purchases,
      payments,
      targetDay,
      new Date('2026-11-02T12:00:00Z')
    );

    assert.equal(summary.targetDate, '2026-11-02');
    assert.equal(summary.isCurrentDay, true);
    // Purchases: 60,000 + 40,000 = 100,000 across 2 bills (200 KG)
    assert.equal(summary.purchaseCount, 2);
    assert.equal(summary.totalPurchases, 100000);
    assert.equal(summary.totalPurchaseQty, 200);
    assert.equal(summary.totalPurchasePaid, 30000);
    assert.equal(summary.totalPurchaseBalance, 70000);

    // Payments:
    // Vouchers: 20,000 (pay-sync-pur-1) + 25,000 (standalone supplier) + 15,000 (exporter) = 60,000
    // Direct non-synced purchase paid: 10,000 (from pur-2)
    // Total Payments = 70,000 (55,000 Supplier + 15,000 Exporter)
    assert.equal(summary.voucherPaymentsTotal, 60000);
    assert.equal(summary.directPurchasePaymentsTotal, 10000);
    assert.equal(summary.totalPayments, 70000);
    assert.equal(summary.supplierPaymentsTotal, 55000);
    assert.equal(summary.exporterPaymentsTotal, 15000);
    assert.equal(summary.paymentCount, 4);

    // Net Daily Balance: 100,000 purchases - 70,000 payments = 30,000
    assert.equal(summary.netDailyBalance, 30000);
  });
});
