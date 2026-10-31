import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAllRecords, GlobalSearchDataset } from './globalSearch.ts';
import { PurchaseRecord, PackingRecord, PaymentRecord, OtherCostRecord } from '../types/index.ts';

const mockDataset: GlobalSearchDataset = {
  purchases: [
    {
      id: 'pur-1',
      invoiceNumber: 'PUR-2026-0001',
      date: '2026-02-15',
      description: 'Abdullah Vai',
      contactNumber: '01711000111',
      items: [
        {
          id: 'item-1',
          item: 'Live Kuchia Grade A',
          quantity: 250,
          rate: 320,
          totalAmount: 80000,
          previousAmount: 0,
          paidAmount: 80000,
          balance: 0,
        },
      ],
      totalQty: 250,
      totalAmount: 80000,
      previousAmount: 0,
      paidAmount: 80000,
      balance: 0,
      createdAt: '2026-02-15T10:00:00Z',
    },
    {
      id: 'pur-2',
      invoiceNumber: 'PUR-2026-0002',
      date: '2026-02-16',
      description: 'Uzzal Vai',
      contactNumber: '01822000222',
      items: [
        {
          id: 'item-2',
          item: 'Eel Fish Small',
          quantity: 120,
          rate: 280,
          totalAmount: 33600,
          previousAmount: 0,
          paidAmount: 20000,
          balance: 13600,
        },
      ],
      totalQty: 120,
      totalAmount: 33600,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 13600,
      createdAt: '2026-02-16T10:00:00Z',
    },
  ],
  packings: [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-2026-0001',
      shippingMark: 'AAD',
      flight: 'CZ392',
      destination: 'CAN / GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-02-15',
      fromDate: '2026-02-15',
      toDate: '2026-02-15',
      items: [
        {
          id: 'p-item-1',
          item: 'Live Eel Fish',
          box: 30,
          weight: 20,
          totalWeight: 600,
          unit: 'KG',
          rate: 45,
          amount: 27000,
        },
      ],
      totalBox: 30,
      totalWeight: 600,
      totalAmount: 27000,
      createdAt: '2026-02-15T12:00:00Z',
    },
    {
      id: 'pkg-2',
      invoiceNumber: 'PKG-2026-0002',
      shippingMark: 'ZSB-HK',
      flight: 'BG084',
      destination: 'HKG / HONG KONG',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-02-17',
      fromDate: '2026-02-17',
      toDate: '2026-02-17',
      items: [],
      totalBox: 45,
      totalWeight: 900,
      totalAmount: 42000,
      createdAt: '2026-02-17T12:00:00Z',
    },
  ],
  payments: [
    {
      id: 'pay-1',
      invoiceNumber: 'PAY-2026-0001',
      date: '2026-02-16',
      description: 'Abdullah Vai',
      contactNumber: '01711000111',
      items: [],
      totalAmount: 80000,
      previousAmount: 0,
      paidAmount: 80000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      createdAt: '2026-02-16T15:00:00Z',
    },
  ],
  otherCosts: [
    {
      id: 'cost-1',
      date: '2026-02-15',
      category: 'Air Freight',
      amount: 45000,
      description: 'Flight CZ392 air cargo freight charge',
      refInvoice: 'EXP-CZ392',
      createdAt: '2026-02-15T16:00:00Z',
    },
  ],
};

test('searchAllRecords returns empty result when query is blank or spaces', () => {
  const result1 = searchAllRecords('', mockDataset);
  assert.equal(result1.items.length, 0);
  assert.equal(result1.totalMatches, 0);

  const result2 = searchAllRecords('    ', mockDataset);
  assert.equal(result2.items.length, 0);
});

test('searchAllRecords accurately finds specific invoice number', () => {
  const result = searchAllRecords('PUR-2026-0001', mockDataset);
  assert.ok(result.items.length >= 1);
  assert.equal(result.items[0].primaryTitle, 'PUR-2026-0001');
  assert.equal(result.items[0].module, 'purchase');
  assert.equal(result.items[0].targetTab, 'purchase_db');
  assert.ok(result.items[0].matchedFields.some((f) => f.includes('Invoice #')));
});

test('searchAllRecords finds records by supplier name across purchases and payments', () => {
  const result = searchAllRecords('Abdullah', mockDataset);
  assert.ok(result.items.length >= 2, 'Should match purchase and payment for Abdullah Vai');
  const modules = result.items.map((i) => i.module);
  assert.ok(modules.includes('purchase'));
  assert.ok(modules.includes('payment'));
  assert.equal(result.countsByModule.purchase, 1);
  assert.equal(result.countsByModule.payment, 1);
});

test('searchAllRecords finds packing record by Shipping Mark (Tracking ID)', () => {
  const result = searchAllRecords('AAD', mockDataset);
  assert.ok(result.items.length >= 1);
  const pkgMatch = result.items.find((i) => i.module === 'packing');
  assert.ok(pkgMatch, 'Packing with shipping mark AAD should be found');
  assert.equal(pkgMatch.primaryTitle, 'PKG-2026-0001');
  assert.ok(pkgMatch.matchedFields.some((f) => f.includes('Mark: AAD')));
});

test('searchAllRecords finds packing record by Flight number (Tracking ID)', () => {
  const result = searchAllRecords('CZ392', mockDataset);
  assert.ok(result.items.length >= 1);
  const pkgMatch = result.items.find((i) => i.module === 'packing');
  assert.ok(pkgMatch);
  assert.equal(pkgMatch.primaryTitle, 'PKG-2026-0001');

  // Should also match other cost mentioning Flight CZ392
  const costMatch = result.items.find((i) => i.module === 'other_cost');
  assert.ok(costMatch);
});

test('searchAllRecords supports module filtering', () => {
  const resultAll = searchAllRecords('Abdullah', mockDataset);
  assert.equal(resultAll.countsByModule.all, 2);

  const resultPurchasesOnly = searchAllRecords('Abdullah', mockDataset, { filterModule: 'purchase' });
  assert.equal(resultPurchasesOnly.items.length, 1);
  assert.equal(resultPurchasesOnly.items[0].module, 'purchase');
});
