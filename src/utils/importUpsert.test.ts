import test from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertPurchasesInPlace,
  upsertPackingsInPlace,
  upsertPaymentsInPlace,
  upsertOtherCostsInPlace,
} from './importUpsert.ts';
import type {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

let idCounter = 1;
const makeId = (prefix: string) => `${prefix}-${idCounter++}`;

test('upsertPurchasesInPlace assigns INV number on missing invoice ref, keeps identical unchanged, and updates modified in place', () => {
  const existing: PurchaseRecord[] = [
    {
      id: 'pur-existing-1',
      invoiceNumber: 'INV-2026-0001',
      date: '2026-10-21',
      description: '1042',
      contactNumber: '+8801711223344',
      items: [
        {
          id: 'pi-1',
          item: 'FF1',
          quantity: 100,
          rate: 450,
          totalAmount: 45000,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
      ],
      totalQty: 100,
      totalAmount: 45000,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 25000,
      createdAt: '2026-10-21T09:00:00Z',
    },
  ];

  // 1. Re-import identical supplier+date with missing invoiceNumber => remains unchanged
  const identicalResult = upsertPurchasesInPlace(
    existing,
    [
      {
        invoiceNumber: '',
        date: '2026-10-21',
        description: '1042',
        contactNumber: '+8801711223344',
        items: [
          {
            id: 'pi-tmp',
            item: 'FF1',
            quantity: 100,
            rate: 450,
            totalAmount: 45000,
            previousAmount: 0,
            paidAmount: 0,
            balance: 0,
          },
        ],
        totalQty: 100,
        totalAmount: 45000,
        previousAmount: 0,
        paidAmount: 20000,
        balance: 25000,
      },
    ],
    makeId,
    '2026-10-22T10:00:00Z'
  );

  assert.equal(identicalResult.unchangedCount, 1);
  assert.equal(identicalResult.updatedCount, 0);
  assert.equal(identicalResult.insertedCount, 0);
  assert.equal(identicalResult.records.length, 1);
  assert.equal(identicalResult.records[0].invoiceNumber, 'INV-2026-0001');

  // 2. Import modified same supplier+date AND one brand-new missing invoice => updates in place & creates INV-2026-0002
  const upsertResult = upsertPurchasesInPlace(
    existing,
    [
      {
        invoiceNumber: '',
        date: '2026-10-21',
        description: '1042',
        contactNumber: '+8801711223344',
        items: [
          {
            id: 'pi-tmp-2',
            item: 'FF1',
            quantity: 120,
            rate: 450,
            totalAmount: 54000,
            previousAmount: 0,
            paidAmount: 0,
            balance: 0,
          },
        ],
        totalQty: 120,
        totalAmount: 54000,
        previousAmount: 0,
        paidAmount: 20000,
        balance: 34000,
      },
      {
        invoiceNumber: '',
        date: '2026-10-22',
        description: 'ABDULLAH VAI',
        contactNumber: '',
        items: [
          {
            id: 'pi-tmp-3',
            item: '2F',
            quantity: 50,
            rate: 0,
            totalAmount: 0,
            previousAmount: 0,
            paidAmount: 0,
            balance: 0,
          },
        ],
        totalQty: 50,
        totalAmount: 0,
        previousAmount: 0,
        paidAmount: 0,
        balance: 0,
        calculationPending: true,
        pendingFields: ['item0_rate'],
        rawValues: { item0_rate: 'TBD' },
      },
    ],
    makeId,
    '2026-10-22T11:00:00Z'
  );

  assert.equal(upsertResult.updatedCount, 1);
  assert.equal(upsertResult.insertedCount, 1);
  assert.equal(upsertResult.records.length, 2);

  const inserted = upsertResult.records[0];
  assert.ok(inserted.invoiceNumber.startsWith('INV-'));
  assert.equal(inserted.calculationPending, true);
  assert.equal(inserted.rawValues?.item0_rate, 'TBD');

  const updated = upsertResult.records[1];
  assert.equal(updated.id, 'pur-existing-1');
  assert.equal(updated.invoiceNumber, 'INV-2026-0001');
  assert.equal(updated.totalQty, 120);
  assert.equal(updated.totalAmount, 54000);
});

test('upsertPackingsInPlace matches existing invoice number & shipment group, updates in place, and leaves identical unchanged', () => {
  const existing: PackingRecord[] = [
    {
      id: 'pkg-existing-1',
      invoiceNumber: 'PKG-2026-0010',
      shippingMark: '1042',
      flight: 'BG366',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-25',
      fromDate: '2026-10-25',
      toDate: '2026-10-25',
      items: [
        {
          id: 'pki-1',
          item: 'FF1',
          box: 10,
          weight: 15,
          totalWeight: 150,
          unit: 'KG',
          rate: 400,
          amount: 60000,
        },
      ],
      totalBox: 10,
      totalWeight: 150,
      totalAmount: 60000,
      rmbRate: 16.5,
      totalAmountBDT: 990000,
      createdAt: '2026-10-25T08:00:00Z',
    },
  ];

  // Identical shipment group => stays unchanged
  const unchangedRes = upsertPackingsInPlace(
    existing,
    [
      {
        invoiceNumber: '',
        shippingMark: '1042',
        flight: 'BG366',
        destination: 'GUANGZHOU',
        shipper: 'ZSB AQUATICS',
        packingDate: '2026-10-25',
        fromDate: '2026-10-25',
        toDate: '2026-10-25',
        items: [
          {
            id: 'pki-new',
            item: 'FF1',
            box: 10,
            weight: 15,
            totalWeight: 150,
            unit: 'KG',
            rate: 400,
            amount: 60000,
          },
        ],
        totalBox: 10,
        totalWeight: 150,
        totalAmount: 60000,
        rmbRate: 16.5,
        totalAmountBDT: 990000,
      },
    ],
    makeId
  );

  assert.equal(unchangedRes.unchangedCount, 1);
  assert.equal(unchangedRes.updatedCount, 0);

  // Modified invoice by invoiceNumber => updates in place keeping id & createdAt
  const updatedRes = upsertPackingsInPlace(
    existing,
    [
      {
        invoiceNumber: 'PKG-2026-0010',
        shippingMark: '1042',
        flight: 'BG366',
        destination: 'GUANGZHOU',
        shipper: 'ZSB AQUATICS',
        packingDate: '2026-10-25',
        fromDate: '2026-10-25',
        toDate: '2026-10-25',
        items: [
          {
            id: 'pki-new-2',
            item: 'FF1',
            box: 12,
            weight: 15,
            totalWeight: 180,
            unit: 'KG',
            rate: 400,
            amount: 72000,
          },
        ],
        totalBox: 12,
        totalWeight: 180,
        totalAmount: 72000,
        rmbRate: 16.5,
        totalAmountBDT: 1188000,
      },
    ],
    makeId
  );

  assert.equal(updatedRes.updatedCount, 1);
  assert.equal(updatedRes.records.length, 1);
  assert.equal(updatedRes.records[0].id, 'pkg-existing-1');
  assert.equal(updatedRes.records[0].totalBox, 12);
  assert.equal(updatedRes.records[0].totalWeight, 180);
});

test('upsertPaymentsInPlace and upsertOtherCostsInPlace update existing in place and keep identical unchanged', () => {
  const existingPay: PaymentRecord[] = [
    {
      id: 'pay-1',
      invoiceNumber: 'PAY-2026-0001',
      date: '2026-10-21',
      description: '5501',
      contactNumber: '',
      items: [],
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 25000,
      balance: 25000,
      status: 'UNPAID',
      returnRMB: 0,
      createdAt: '2026-10-21T08:00:00Z',
    },
  ];

  const payIdentical = upsertPaymentsInPlace(
    existingPay,
    [
      {
        invoiceNumber: 'PAY-2026-0001',
        date: '2026-10-21',
        description: '5501',
        contactNumber: '',
        items: [],
        totalAmount: 50000,
        previousAmount: 0,
        paidAmount: 25000,
        balance: 25000,
        status: 'UNPAID',
        returnRMB: 0,
      },
    ],
    makeId
  );
  assert.equal(payIdentical.unchangedCount, 1);

  const payUpdated = upsertPaymentsInPlace(
    existingPay,
    [
      {
        invoiceNumber: 'PAY-2026-0001',
        date: '2026-10-21',
        description: '5501',
        contactNumber: '',
        items: [],
        totalAmount: 50000,
        previousAmount: 0,
        paidAmount: 50000,
        balance: 0,
        status: 'PAID',
        returnRMB: 0,
      },
    ],
    makeId
  );
  assert.equal(payUpdated.updatedCount, 1);
  assert.equal(payUpdated.records[0].id, 'pay-1');
  assert.equal(payUpdated.records[0].status, 'PAID');

  const existingCost: OtherCostRecord[] = [
    {
      id: 'cost-1',
      date: '2026-10-21',
      category: 'Ice & Thermocol',
      amount: 3200,
      description: 'Dock Ice Supply',
      refInvoice: 'EXP-1',
      createdAt: '2026-10-21T08:00:00Z',
    },
  ];

  const costUpdated = upsertOtherCostsInPlace(
    existingCost,
    [
      {
        date: '2026-10-21',
        category: 'Ice & Thermocol',
        amount: 3800,
        description: 'Dock Ice Supply',
        refInvoice: 'EXP-1',
      },
    ],
    makeId
  );
  assert.equal(costUpdated.updatedCount, 1);
  assert.equal(costUpdated.records[0].id, 'cost-1');
  assert.equal(costUpdated.records[0].amount, 3800);
});
