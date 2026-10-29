import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCreditNoteNumber,
  computeCreditNoteStatus,
  createSupplierCreditRecord,
  applySupplierCreditNote,
  applyCreditAmountAcrossSupplierNotes,
  calculateSupplierCreditSummary,
  getSupplierCreditProfile,
} from './supplierCredits.ts';
import { PurchaseRecord, SupplierCreditRecord } from '../types/index.ts';

test('generateCreditNoteNumber formats sequential credit note numbers', () => {
  assert.equal(generateCreditNoteNumber(0, 2026), 'CN-2026-0001');
  assert.equal(generateCreditNoteNumber(3, 2026), 'CN-2026-0004');
});

test('computeCreditNoteStatus transitions AVAILABLE -> PARTIAL -> APPLIED and clamps over-application', () => {
  const avail = computeCreditNoteStatus(12000, 0);
  assert.equal(avail.status, 'AVAILABLE');
  assert.equal(avail.remainingAmount, 12000);

  const partial = computeCreditNoteStatus(12000, 5000);
  assert.equal(partial.status, 'PARTIAL');
  assert.equal(partial.appliedAmount, 5000);
  assert.equal(partial.remainingAmount, 7000);

  const applied = computeCreditNoteStatus(12000, 12000);
  assert.equal(applied.status, 'APPLIED');
  assert.equal(applied.remainingAmount, 0);

  const overApplied = computeCreditNoteStatus(12000, 15000);
  assert.equal(overApplied.appliedAmount, 12000);
  assert.equal(overApplied.remainingAmount, 0);
  assert.equal(overApplied.status, 'APPLIED');
});

test('createSupplierCreditRecord and applySupplierCreditNote record partial and full applications', () => {
  const cn = createSupplierCreditRecord(
    {
      id: 'cn-test-1',
      creditNoteNumber: 'CN-2026-0010',
      date: '2026-10-12',
      supplierName: 'abdullah vai',
      refPurchaseInvoice: 'PUR-2026-1005',
      reason: 'Weight Shortage / Shrinkage',
      amount: 10000,
    },
    9
  );

  assert.equal(cn.supplierName, 'ABDULLAH VAI');
  assert.equal(cn.status, 'AVAILABLE');
  assert.equal(cn.remainingAmount, 10000);

  const step1 = applySupplierCreditNote(cn, {
    amount: 4000,
    date: '2026-10-15',
    targetPaymentInvoice: 'PAY-2026-1009',
  });
  assert.equal(step1.appliedDelta, 4000);
  assert.equal(step1.updatedCredit.status, 'PARTIAL');
  assert.equal(step1.updatedCredit.appliedAmount, 4000);
  assert.equal(step1.updatedCredit.remainingAmount, 6000);
  assert.equal(step1.updatedCredit.applications.length, 1);

  const step2 = applySupplierCreditNote(step1.updatedCredit, {
    amount: 9000, // exceeds 6000 remaining -> clamped to 6000
    date: '2026-10-18',
    targetPaymentInvoice: 'PAY-2026-1012',
  });
  assert.equal(step2.appliedDelta, 6000);
  assert.equal(step2.updatedCredit.status, 'APPLIED');
  assert.equal(step2.updatedCredit.appliedAmount, 10000);
  assert.equal(step2.updatedCredit.remainingAmount, 0);
  assert.equal(step2.updatedCredit.applications.length, 2);
});

test('applyCreditAmountAcrossSupplierNotes applies FIFO or targeted credit across supplier notes', () => {
  const credits: SupplierCreditRecord[] = [
    createSupplierCreditRecord({
      id: 'cn-1',
      creditNoteNumber: 'CN-2026-0001',
      date: '2026-10-01',
      supplierName: 'ABDULLAH VAI',
      amount: 5000,
    }),
    createSupplierCreditRecord({
      id: 'cn-2',
      creditNoteNumber: 'CN-2026-0002',
      date: '2026-10-05',
      supplierName: 'ABDULLAH VAI',
      amount: 8000,
    }),
  ];

  const result = applyCreditAmountAcrossSupplierNotes(
    credits,
    'ABDULLAH VAI',
    9000,
    {
      date: '2026-10-20',
      targetPaymentInvoice: 'PAY-2026-1020',
    }
  );

  assert.equal(result.totalApplied, 9000);
  assert.deepEqual(result.affectedCreditNotes, ['CN-2026-0001', 'CN-2026-0002']);
  assert.equal(result.updatedCredits[0].status, 'APPLIED');
  assert.equal(result.updatedCredits[0].remainingAmount, 0);
  assert.equal(result.updatedCredits[1].status, 'PARTIAL');
  assert.equal(result.updatedCredits[1].appliedAmount, 4000);
  assert.equal(result.updatedCredits[1].remainingAmount, 4000);
});

test('calculateSupplierCreditSummary and getSupplierCreditProfile aggregate P&L and supplier metrics', () => {
  const credits: SupplierCreditRecord[] = [
    createSupplierCreditRecord({
      id: 'cn-a',
      creditNoteNumber: 'CN-2026-0001',
      date: '2026-10-10',
      supplierName: 'ABDULLAH VAI',
      amount: 12000,
      appliedAmount: 0,
    }),
    createSupplierCreditRecord({
      id: 'cn-b',
      creditNoteNumber: 'CN-2026-0002',
      date: '2026-09-25',
      supplierName: 'FAISAL VAI',
      amount: 18000,
      appliedAmount: 8000,
    }),
    createSupplierCreditRecord({
      id: 'cn-c',
      creditNoteNumber: 'CN-2026-0003',
      date: '2026-08-30',
      supplierName: 'RAKIB VAI',
      amount: 6500,
      appliedAmount: 6500,
    }),
  ];

  const purchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'PUR-01',
      date: '2026-10-01',
      description: 'ABDULLAH VAI',
      contactNumber: '+8801',
      items: [],
      totalQty: 500,
      totalAmount: 250000,
      previousAmount: 0,
      paidAmount: 200000,
      balance: 50000,
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];

  const summary = calculateSupplierCreditSummary(credits, purchases);
  assert.equal(summary.totalCreditsCount, 3);
  assert.equal(summary.totalIssuedAmount, 36500);
  assert.equal(summary.totalAppliedAmount, 14500);
  assert.equal(summary.totalAvailableAmount, 22000);
  assert.equal(summary.openCreditsCount, 2);
  assert.equal(summary.appliedCreditsCount, 1);
  assert.equal(summary.grossPurchasingCost, 250000);
  assert.equal(summary.netPurchasingAfterIssuedCredits, 213500);
  assert.equal(summary.netPurchasingAfterAppliedCredits, 235500);

  const faisalProfile = getSupplierCreditProfile(credits, 'faisal vai');
  assert.equal(faisalProfile.supplierName, 'FAISAL VAI');
  assert.equal(faisalProfile.totalIssued, 18000);
  assert.equal(faisalProfile.totalApplied, 8000);
  assert.equal(faisalProfile.availableBalance, 10000);
  assert.equal(faisalProfile.openNotesCount, 1);
});
