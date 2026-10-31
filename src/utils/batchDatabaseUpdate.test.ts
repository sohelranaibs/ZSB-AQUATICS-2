import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPurchaseBatchUpdate,
  buildPackingBatchUpdate,
  buildPaymentBatchUpdate,
  countActiveBatchFields,
} from './batchDatabaseUpdate.ts';
import { PurchaseRecord, PackingRecord, PaymentRecord } from '../types/index.ts';

test('buildPurchaseBatchUpdate applies supplier, contact, date, and full balance settlement', () => {
  const samplePurchase: PurchaseRecord = {
    id: 'pur-1',
    invoiceNumber: 'INV-2026-0001',
    date: '2026-10-01',
    description: 'OLD SUPPLIER',
    contactNumber: '01700000000',
    items: [],
    totalQty: 100,
    totalAmount: 50000,
    previousAmount: 10000,
    paidAmount: 20000,
    balance: 40000,
    createdAt: '2026-10-01T00:00:00Z',
  };

  const patch = {
    date: '2026-10-31',
    description: 'ABDULLAH VAI',
    contactNumber: '+8801711223344',
    settleFullBalance: true,
    remarks: 'Bulk settled',
  };

  const result = buildPurchaseBatchUpdate(samplePurchase, patch);
  assert.equal(result.date, '2026-10-31');
  assert.equal(result.description, 'ABDULLAH VAI');
  assert.equal(result.contactNumber, '+8801711223344');
  assert.equal(result.paidAmount, 60000);
  assert.equal(result.balance, 0);
  assert.equal(result.remarks, 'Bulk settled');
  assert.equal(countActiveBatchFields(patch), 5);
});

test('buildPackingBatchUpdate applies shipping mark, flight, destination, RMB rate and recalculates BDT total', () => {
  const samplePacking: PackingRecord = {
    id: 'pkg-1',
    invoiceNumber: 'PKG-2026-0001',
    shippingMark: 'OLD-MARK',
    flight: 'CZ-392',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    packingDate: '2026-10-01',
    fromDate: '2026-10-01',
    toDate: '2026-10-01',
    items: [],
    totalBox: 20,
    totalWeight: 400,
    totalAmount: 10000, // RMB
    createdAt: '2026-10-01T00:00:00Z',
  };

  const patch = {
    packingDate: '2026-10-31',
    shippingMark: 'AAD',
    flight: 'MU-2036',
    destination: 'KUNMING',
    rmbRate: 16.5,
    paymentStatus: 'PAID' as const,
  };

  const result = buildPackingBatchUpdate(samplePacking, patch);
  assert.equal(result.packingDate, '2026-10-31');
  assert.equal(result.shippingMark, 'AAD');
  assert.equal(result.flight, 'MU-2036');
  assert.equal(result.destination, 'KUNMING');
  assert.equal(result.rmbRate, 16.5);
  assert.equal(result.totalAmountBDT, 165000);
  assert.equal(result.paymentStatus, 'PAID');
  assert.equal(result.exporterStatus, 'PAID');
  assert.equal(countActiveBatchFields(patch), 6);
});

test('buildPaymentBatchUpdate applies status, category, export ref, and date', () => {
  const samplePayment: PaymentRecord = {
    id: 'pay-1',
    invoiceNumber: 'PAY-2026-0001',
    date: '2026-10-01',
    description: 'PARTY A',
    contactNumber: '',
    items: [],
    totalAmount: 25000,
    previousAmount: 0,
    paidAmount: 25000,
    balance: 0,
    status: 'UNPAID',
    returnRMB: 0,
    createdAt: '2026-10-01T00:00:00Z',
  };

  const patch = {
    date: '2026-10-31',
    status: 'PAID' as const,
    paymentCategory: 'exporter' as const,
    exportGoodsRef: 'AWB-8899',
  };

  const result = buildPaymentBatchUpdate(samplePayment, patch);
  assert.equal(result.date, '2026-10-31');
  assert.equal(result.status, 'PAID');
  assert.equal(result.paymentCategory, 'exporter');
  assert.equal(result.exportGoodsRef, 'AWB-8899');
  assert.equal(countActiveBatchFields(patch), 4);
});
