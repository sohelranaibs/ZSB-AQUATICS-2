import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toggleSort,
  compareValues,
  sortPurchaseRecords,
  sortPackingRecords,
  sortPaymentRecords,
  getColumnHeaderTitle,
  SortConfig,
} from './databaseSorting.ts';
import { PurchaseRecord, PackingRecord, PaymentRecord } from '../types/index.ts';

test('toggleSort transitions correctly between columns and directions', () => {
  const initial: SortConfig = { column: null, direction: 'asc' };

  // Select new column -> defaults to asc
  const step1 = toggleSort(initial, 'date');
  assert.deepEqual(step1, { column: 'date', direction: 'asc' });

  // Click same column -> toggles to desc
  const step2 = toggleSort(step1, 'date');
  assert.deepEqual(step2, { column: 'date', direction: 'desc' });

  // Click same column again -> toggles back to asc
  const step3 = toggleSort(step2, 'date');
  assert.deepEqual(step3, { column: 'date', direction: 'asc' });

  // Click a different column -> switches column and defaults to asc
  const step4 = toggleSort(step3, 'totalAmount');
  assert.deepEqual(step4, { column: 'totalAmount', direction: 'asc' });

  // Click same column -> toggles to desc
  const step5 = toggleSort(step4, 'totalAmount');
  assert.deepEqual(step5, { column: 'totalAmount', direction: 'desc' });
});

test('compareValues handles numbers, natural strings, and dates accurately', () => {
  // Pure numbers
  assert.equal(compareValues(10, 20, 'asc') < 0, true);
  assert.equal(compareValues(10, 20, 'desc') > 0, true);
  assert.equal(compareValues(50, 50, 'asc'), 0);

  // Numeric strings
  assert.equal(compareValues('100', '25', 'asc') > 0, true);
  assert.equal(compareValues('100', '25', 'desc') < 0, true);

  // Natural alphanumeric strings (INV-2 vs INV-10)
  assert.equal(compareValues('INV-002', 'INV-010', 'asc') < 0, true);
  assert.equal(compareValues('INV-002', 'INV-010', 'desc') > 0, true);
  assert.equal(compareValues('INV-2', 'INV-10', 'asc') < 0, true);

  // ISO Dates
  assert.equal(compareValues('2026-01-15', '2026-03-20', 'asc') < 0, true);
  assert.equal(compareValues('2026-01-15', '2026-03-20', 'desc') > 0, true);

  // Empty / null values pushed to end
  assert.equal(compareValues('', 'Valid', 'asc') > 0, true);
  assert.equal(compareValues(null, 100, 'asc') > 0, true);
  assert.equal(compareValues(undefined, 100, 'desc') > 0, true);
});

test('sortPurchaseRecords sorts purchase data by various columns', () => {
  const mockPurchases: PurchaseRecord[] = [
    {
      id: 'p1',
      invoiceNumber: 'INV-102',
      date: '2026-03-01',
      description: 'Zaman Fisheries',
      contactNumber: '01800000001',
      items: [],
      totalQty: 250,
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 40000,
      balance: 10000,
      createdAt: '2026-03-01T00:00:00Z',
    },
    {
      id: 'p2',
      invoiceNumber: 'INV-101',
      date: '2026-03-10',
      description: 'Ali Enterprise',
      contactNumber: '01800000002',
      items: [],
      totalQty: 100,
      totalAmount: 20000,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 0,
      createdAt: '2026-03-10T00:00:00Z',
    },
    {
      id: 'p3',
      invoiceNumber: 'INV-103',
      date: '2026-02-15',
      description: 'Barisal Aqua',
      contactNumber: '01800000003',
      items: [],
      totalQty: 400,
      totalAmount: 95000,
      previousAmount: 0,
      paidAmount: 50000,
      balance: 45000,
      createdAt: '2026-02-15T00:00:00Z',
    },
  ];

  // Sort by invoiceNumber ASC
  const byInvAsc = sortPurchaseRecords(mockPurchases, { column: 'invoiceNumber', direction: 'asc' });
  assert.deepEqual(byInvAsc.map((p) => p.invoiceNumber), ['INV-101', 'INV-102', 'INV-103']);

  // Sort by invoiceNumber DESC
  const byInvDesc = sortPurchaseRecords(mockPurchases, { column: 'invoiceNumber', direction: 'desc' });
  assert.deepEqual(byInvDesc.map((p) => p.invoiceNumber), ['INV-103', 'INV-102', 'INV-101']);

  // Sort by totalAmount ASC
  const byAmountAsc = sortPurchaseRecords(mockPurchases, { column: 'totalAmount', direction: 'asc' });
  assert.deepEqual(byAmountAsc.map((p) => p.totalAmount), [20000, 50000, 95000]);

  // Sort by totalAmount DESC
  const byAmountDesc = sortPurchaseRecords(mockPurchases, { column: 'totalAmount', direction: 'desc' });
  assert.deepEqual(byAmountDesc.map((p) => p.totalAmount), [95000, 50000, 20000]);

  // Sort by date ASC
  const byDateAsc = sortPurchaseRecords(mockPurchases, { column: 'date', direction: 'asc' });
  assert.deepEqual(byDateAsc.map((p) => p.id), ['p3', 'p1', 'p2']);

  // Sort by date DESC
  const byDateDesc = sortPurchaseRecords(mockPurchases, { column: 'date', direction: 'desc' });
  assert.deepEqual(byDateDesc.map((p) => p.id), ['p2', 'p1', 'p3']);

  // Sort by description ASC
  const byDescAsc = sortPurchaseRecords(mockPurchases, { column: 'description', direction: 'asc' });
  assert.deepEqual(byDescAsc.map((p) => p.description), ['Ali Enterprise', 'Barisal Aqua', 'Zaman Fisheries']);
});

test('sortPackingRecords sorts packing manifests accurately', () => {
  const mockPackings: PackingRecord[] = [
    {
      id: 'pkg1',
      invoiceNumber: 'EXP-05',
      packingDate: '2026-03-05',
      fromDate: '',
      toDate: '',
      shippingMark: 'MK-GUANGZHOU',
      flight: 'CZ-392',
      destination: 'Guangzhou',
      shipper: 'ZSB AQUATICS',
      items: [],
      totalBox: 15,
      totalWeight: 450,
      totalAmount: 12000, // RMB
      rmbRate: 16.5,
      createdAt: '2026-03-05T00:00:00Z',
    },
    {
      id: 'pkg2',
      invoiceNumber: 'EXP-02',
      packingDate: '2026-03-12',
      fromDate: '',
      toDate: '',
      shippingMark: 'MK-SHANGHAI',
      flight: 'MU-2036',
      destination: 'Shanghai',
      shipper: 'ZSB AQUATICS',
      items: [],
      totalBox: 30,
      totalWeight: 900,
      totalAmount: 25000, // RMB
      rmbRate: 16.5,
      createdAt: '2026-03-12T00:00:00Z',
    },
    {
      id: 'pkg3',
      invoiceNumber: 'EXP-10',
      packingDate: '2026-02-28',
      fromDate: '',
      toDate: '',
      shippingMark: 'MK-KUNMING',
      flight: 'MU-2036',
      destination: 'Kunming',
      shipper: 'ZSB AQUATICS',
      items: [],
      totalBox: 8,
      totalWeight: 240,
      totalAmount: 6500, // RMB
      rmbRate: 16.5,
      createdAt: '2026-02-28T00:00:00Z',
    },
  ];

  // Sort by totalWeight ASC
  const byWeightAsc = sortPackingRecords(mockPackings, { column: 'totalWeight', direction: 'asc' });
  assert.deepEqual(byWeightAsc.map((p) => p.totalWeight), [240, 450, 900]);

  // Sort by totalWeight DESC
  const byWeightDesc = sortPackingRecords(mockPackings, { column: 'totalWeight', direction: 'desc' });
  assert.deepEqual(byWeightDesc.map((p) => p.totalWeight), [900, 450, 240]);

  // Sort by invoiceNumber natural order
  const byInvAsc = sortPackingRecords(mockPackings, { column: 'invoiceNumber', direction: 'asc' });
  assert.deepEqual(byInvAsc.map((p) => p.invoiceNumber), ['EXP-02', 'EXP-05', 'EXP-10']);

  // Sort by destination
  const byDestAsc = sortPackingRecords(mockPackings, { column: 'destination', direction: 'asc' });
  assert.deepEqual(byDestAsc.map((p) => p.destination), ['Guangzhou', 'Kunming', 'Shanghai']);
});

test('sortPaymentRecords sorts payment vouchers accurately', () => {
  const mockPayments: PaymentRecord[] = [
    {
      id: 'pay1',
      invoiceNumber: 'PAY-003',
      date: '2026-03-05',
      description: 'Zaman Fisheries',
      contactNumber: '',
      items: [],
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 30000,
      balance: 20000,
      status: 'PARTIAL',
      returnRMB: 0,
      createdAt: '2026-03-05T00:00:00Z',
    },
    {
      id: 'pay2',
      invoiceNumber: 'PAY-001',
      date: '2026-03-15',
      description: 'Ali Enterprise',
      contactNumber: '',
      items: [],
      totalAmount: 20000,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      createdAt: '2026-03-15T00:00:00Z',
    },
    {
      id: 'pay3',
      invoiceNumber: 'PAY-002',
      date: '2026-03-01',
      description: 'MK-GUANGZHOU',
      contactNumber: '',
      items: [],
      totalAmount: 85000,
      previousAmount: 0,
      paidAmount: 85000,
      balance: 0,
      status: 'PAID',
      returnRMB: 5000,
      shippingMark: 'MK-GUANGZHOU',
      paymentCategory: 'exporter',
      createdAt: '2026-03-01T00:00:00Z',
    },
  ];

  // Sort by paidAmount ASC
  const byPaidAsc = sortPaymentRecords(mockPayments, { column: 'paidAmount', direction: 'asc' });
  assert.deepEqual(byPaidAsc.map((p) => p.paidAmount), [20000, 30000, 85000]);

  // Sort by paidAmount DESC
  const byPaidDesc = sortPaymentRecords(mockPayments, { column: 'paidAmount', direction: 'desc' });
  assert.deepEqual(byPaidDesc.map((p) => p.paidAmount), [85000, 30000, 20000]);

  // Sort by status
  const byStatusAsc = sortPaymentRecords(mockPayments, { column: 'status', direction: 'asc' });
  assert.deepEqual(byStatusAsc.map((p) => p.status), ['PAID', 'PAID', 'PARTIAL']);

  // Sort by type (supplier vs exporter)
  const byTypeAsc = sortPaymentRecords(mockPayments, { column: 'type', direction: 'asc' });
  assert.deepEqual(byTypeAsc.map((p) => p.paymentCategory || 'supplier'), ['exporter', 'supplier', 'supplier']);
});

test('getColumnHeaderTitle returns readable labels', () => {
  assert.equal(getColumnHeaderTitle('invoiceNumber'), 'Invoice / Doc No');
  assert.equal(getColumnHeaderTitle('totalAmount'), 'Total Amount');
  assert.equal(getColumnHeaderTitle('totalWeight'), 'Total Weight (KG)');
  assert.equal(getColumnHeaderTitle('unknownKey'), 'unknownKey');
});
