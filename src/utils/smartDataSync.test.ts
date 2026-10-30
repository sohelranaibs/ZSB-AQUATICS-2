import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePurchasePaymentReconciliation,
  buildSmartSyncReconciliationPlan,
} from './smartDataSync.ts';
import {
  samplePurchases as initialPurchases,
  samplePayments as initialPayments,
} from '../context/initialData.ts';
import { PurchaseRecord, PaymentRecord } from '../types/index.ts';

describe('smartDataSync utility', () => {
  it('detects the missing payment voucher discrepancy on initial seed data (INV-2026-0719 KABIR VAI) and reconciles it to 0 discrepancies', () => {
    const initialAnalysis = analyzePurchasePaymentReconciliation(
      initialPurchases,
      initialPayments
    );

    assert.equal(initialAnalysis.summary.totalPurchasesChecked, 5);
    assert.equal(initialAnalysis.summary.reconciledPurchasesCount, 4);
    assert.equal(initialAnalysis.summary.missingVoucherCount, 1);
    assert.equal(initialAnalysis.summary.discrepancyCount, 1);
    assert.equal(initialAnalysis.summary.totalDiscrepancyAmount, 60000);

    const kabirRec = initialAnalysis.purchaseReconciliations['pur-seed-005'];
    assert.ok(kabirRec);
    assert.equal(kabirRec.status, 'MISSING_VOUCHER');
    assert.equal(kabirRec.hasDiscrepancy, true);
    assert.equal(kabirRec.discrepancyAmount, 60000);

    // Build and apply reconciliation plan
    const plan = buildSmartSyncReconciliationPlan(initialPurchases, initialPayments);
    assert.equal(plan.paymentsToCreate.length, 1);
    assert.equal(plan.paymentsToCreate[0].invoiceNumber, 'PAY-2026-0719');
    assert.equal(plan.paymentsToCreate[0].paidAmount, 60000);
    assert.equal(plan.paymentsToCreate[0].balance, 16000);

    const nextPayments = [...initialPayments, ...plan.paymentsToCreate];
    const postSyncAnalysis = analyzePurchasePaymentReconciliation(
      initialPurchases,
      nextPayments
    );

    assert.equal(postSyncAnalysis.summary.discrepancyCount, 0);
    assert.equal(postSyncAnalysis.summary.reconciledPurchasesCount, 5);
    assert.equal(
      postSyncAnalysis.purchaseReconciliations['pur-seed-005'].status,
      'RECONCILED'
    );
  });

  it('detects and reconciles AMOUNT_MISMATCH, BALANCE_MISMATCH, and UNLINKED_VOUCHER discrepancies', () => {
    const samplePurchases: PurchaseRecord[] = [
      {
        id: 'pur-test-1',
        invoiceNumber: 'INV-2026-9001',
        date: '2026-10-15',
        description: 'ABDULLAH VAI',
        contactNumber: '01711-000111',
        items: [],
        totalQty: 100,
        totalAmount: 100000,
        previousAmount: 0,
        paidAmount: 50000, // Challan says 50,000 paid
        balance: 50000,
        createdAt: '2026-10-15T10:00:00.000Z',
      },
      {
        id: 'pur-test-2',
        invoiceNumber: 'INV-2026-9002',
        date: '2026-10-16',
        description: 'UZZAL VAI',
        contactNumber: '01711-000222',
        items: [],
        totalQty: 80,
        totalAmount: 80000,
        previousAmount: 0,
        paidAmount: 0,
        balance: 95000, // Internal balance drift (should be 80,000)
        createdAt: '2026-10-16T10:00:00.000Z',
      },
    ];

    const samplePayments: PaymentRecord[] = [
      {
        id: 'pay-test-1',
        invoiceNumber: 'PAY-2026-9001',
        date: '2026-10-15',
        description: 'ABDULLAH VAI',
        contactNumber: '01711-000111',
        items: [],
        totalAmount: 100000,
        previousAmount: 0,
        paidAmount: 75000, // Voucher says 75,000 paid -> 25,000 mismatch
        balance: 25000,
        status: 'REPORT',
        returnRMB: 0,
        paymentCategory: 'supplier',
        createdAt: '2026-10-15T12:00:00.000Z',
      },
      {
        id: 'pay-test-orphan',
        invoiceNumber: 'PAY-2026-9999',
        date: '2026-10-20',
        description: 'NEW SUPPLIER VAI',
        contactNumber: '01711-999999',
        items: [],
        totalAmount: 45000,
        previousAmount: 0,
        paidAmount: 45000,
        balance: 0,
        status: 'PAID',
        returnRMB: 0,
        paymentCategory: 'supplier',
        createdAt: '2026-10-20T12:00:00.000Z',
      },
    ];

    const analysis = analyzePurchasePaymentReconciliation(
      samplePurchases,
      samplePayments
    );

    assert.equal(analysis.purchaseReconciliations['pur-test-1'].status, 'AMOUNT_MISMATCH');
    assert.equal(analysis.purchaseReconciliations['pur-test-1'].discrepancyAmount, 25000);
    assert.equal(analysis.purchaseReconciliations['pur-test-2'].status, 'BALANCE_MISMATCH');
    assert.equal(analysis.paymentReconciliations['pay-test-orphan'].status, 'UNLINKED_VOUCHER');

    // Reconcile all
    const plan = buildSmartSyncReconciliationPlan(samplePurchases, samplePayments);
    const updatedPurchasesMap = new Map(
      plan.purchasesToUpdate.map((u) => [u.id, u.record])
    );
    const updatedPaymentsMap = new Map(
      plan.paymentsToUpdate.map((u) => [u.id, u.record])
    );

    const finalPurchases = [
      ...samplePurchases.map((p) => updatedPurchasesMap.get(p.id) || p),
      ...plan.purchasesToCreate,
    ];
    const finalPayments = [
      ...samplePayments.map((pm) => updatedPaymentsMap.get(pm.id) || pm),
      ...plan.paymentsToCreate,
    ];

    const postAnalysis = analyzePurchasePaymentReconciliation(
      finalPurchases,
      finalPayments
    );
    assert.equal(postAnalysis.summary.discrepancyCount, 0);
    assert.equal(
      postAnalysis.purchaseReconciliations['pur-test-1'].status,
      'RECONCILED'
    );
    assert.equal(
      postAnalysis.purchaseReconciliations['pur-test-2'].status,
      'UNPAID_PENDING'
    );
    assert.equal(
      postAnalysis.paymentReconciliations['pay-test-orphan'].status,
      'RECONCILED'
    );
  });
});
