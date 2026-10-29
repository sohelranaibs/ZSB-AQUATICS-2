import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSupplierStatus,
  buildSupplierRecordHistory,
  calculateSupplierHistoryTotals,
} from './supplierHistory.ts';
import {
  PurchaseRecord,
  PaymentRecord,
  SupplierCreditRecord,
} from '../types/index.ts';

describe('supplierHistory pure logic tests', () => {
  const dummyPurchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'INV-1001',
      date: '2026-10-01',
      description: 'HASAN VAI',
      contactNumber: '01700000000',
      items: [],
      totalQty: 100,
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 30000,
      balance: 20000,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'pur-2',
      invoiceNumber: 'INV-1002',
      date: '2026-10-05',
      description: 'HASAN VAI',
      contactNumber: '01700000000',
      items: [],
      totalQty: 80,
      totalAmount: 40000,
      previousAmount: 20000,
      paidAmount: 40000,
      balance: 0,
      createdAt: '2026-10-05T10:00:00Z',
    },
  ];

  const dummyPayments: PaymentRecord[] = [
    {
      id: 'pay-1',
      invoiceNumber: 'PAY-1001',
      date: '2026-10-06',
      description: 'HASAN VAI',
      contactNumber: '01700000000',
      items: [],
      totalAmount: 20000,
      previousAmount: 20000,
      paidAmount: 20000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      paymentCategory: 'supplier',
      createdAt: '2026-10-06T10:00:00Z',
    },
  ];

  const dummyCredits: SupplierCreditRecord[] = [
    {
      id: 'cn-1',
      creditNoteNumber: 'CN-1001',
      date: '2026-10-07',
      supplierName: 'HASAN VAI',
      amount: 5000,
      appliedAmount: 5000,
      remainingAmount: 0,
      reason: 'Weight Shortage / Shrinkage',
      status: 'APPLIED',
      applications: [],
      createdAt: '2026-10-07T10:00:00Z',
    },
  ];

  it('normalizes supplier status properly', () => {
    assert.equal(normalizeSupplierStatus('paid'), 'PAID');
    assert.equal(normalizeSupplierStatus('no report'), 'NO REPORT');
    assert.equal(normalizeSupplierStatus('report'), 'REPORT');
    assert.equal(normalizeSupplierStatus(undefined), 'REPORT');
  });

  it('builds record history filtered by supplier name', () => {
    const history = buildSupplierRecordHistory(
      dummyPurchases,
      dummyPayments,
      dummyCredits,
      { supplierName: 'HASAN VAI' }
    );

    assert.equal(history.length, 4);
    // Verified sorted newest first
    assert.equal(history[0].invoiceNumber, 'CN-1001');
    assert.equal(history[1].invoiceNumber, 'PAY-1001');
    assert.equal(history[2].invoiceNumber, 'INV-1002');
    assert.equal(history[3].invoiceNumber, 'INV-1001');

    // Check Debit, Credit, Balance
    assert.equal(history[1].debitAmount, 20000);
    assert.equal(history[1].creditAmount, 20000);
    assert.equal(history[1].balance, 0);
    assert.equal(history[1].status, 'PAID');
  });

  it('filters history by status', () => {
    const paidOnly = buildSupplierRecordHistory(
      dummyPurchases,
      dummyPayments,
      dummyCredits,
      { supplierName: 'HASAN VAI', status: 'PAID' }
    );

    assert.ok(paidOnly.every((r) => r.status === 'PAID'));
    assert.ok(paidOnly.length >= 2);
  });

  it('calculates totals accurately', () => {
    const history = buildSupplierRecordHistory(
      dummyPurchases,
      dummyPayments,
      dummyCredits,
      { supplierName: 'HASAN VAI' }
    );
    const totals = calculateSupplierHistoryTotals(history);

    assert.equal(totals.recordCount, 4);
    assert.equal(totals.voucherCount, 1);
    assert.equal(totals.purchaseCount, 2);
    assert.equal(totals.creditNoteCount, 1);
    assert.ok(totals.totalDebit > 0);
    assert.ok(totals.totalCredit > 0);
    assert.ok(totals.paidCount >= 2);
  });
});
