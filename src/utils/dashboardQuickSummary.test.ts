import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDashboardQuickSummary } from './dashboardQuickSummary.ts';
import type { PackingRecord, PaymentRecord, PurchaseRecord } from '../types/index.ts';

const REF_TODAY = new Date('2026-11-18T08:00:00Z');

test('calculateDashboardQuickSummary returns zeroed metrics on empty dataset', () => {
  const res = calculateDashboardQuickSummary({
    purchases: [],
    payments: [],
    packings: [],
    supplierCredits: [],
    referenceToday: REF_TODAY,
  });

  assert.equal(res.targetDate, '2026-11-18');
  assert.equal(res.isToday, true);
  assert.equal(res.totalPurchasesTodayAmount, 0);
  assert.equal(res.todayPurchaseBillsCount, 0);
  assert.equal(res.todayPurchaseQtyKg, 0);
  assert.equal(res.totalPendingPaymentsAmount, 0);
  assert.equal(res.suppliersWithDueCount, 0);
  assert.equal(res.hasPendingPayments, false);
});

test('calculateDashboardQuickSummary aggregates Total Purchases Today and Total Pending Payments across today and historical bills', () => {
  const purchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'PUR-001',
      date: '2026-11-18',
      description: 'ABDULLAH VAI',
      contactNumber: '01711-000111',
      items: [
        {
          id: '1',
          item: 'LIVE MUD CRAB',
          quantity: 50,
          rate: 600,
          totalAmount: 30000,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
      ],
      totalQty: 50,
      totalAmount: 30000,
      previousAmount: 0,
      paidAmount: 10000,
      balance: 20000,
      remarks: 'Morning catch',
      createdAt: '2026-11-18T06:00:00Z',
    },
    {
      id: 'pur-2',
      invoiceNumber: 'PUR-002',
      date: '2026-11-18',
      description: 'KARIM ENTERPRISE',
      contactNumber: '01711-000222',
      items: [
        {
          id: '1',
          item: 'LIVE EEL',
          quantity: 30,
          rate: 500,
          totalAmount: 15000,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
      ],
      totalQty: 30,
      totalAmount: 15000,
      previousAmount: 0,
      paidAmount: 15000,
      balance: 0,
      remarks: 'Paid in full',
      createdAt: '2026-11-18T07:00:00Z',
    },
    {
      id: 'pur-3',
      invoiceNumber: 'PUR-003',
      date: '2026-11-15',
      description: 'ROHIM TRADERS',
      contactNumber: '01711-000333',
      items: [],
      totalQty: 100,
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 15000,
      balance: 35000,
      remarks: 'Earlier bill with pending balance',
      createdAt: '2026-11-15T07:00:00Z',
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay-1',
      invoiceNumber: 'PAY-001',
      date: '2026-11-17',
      description: 'ROHIM TRADERS',
      contactNumber: '01711-000333',
      items: [],
      totalAmount: 35000,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 30000,
      status: 'PARTIAL',
      returnRMB: 0,
      returnRMBInBDT: 0,
      exportGoodsRef: 'PUR-003',
      paymentCategory: 'supplier',
      remarks: 'Partial voucher payment',
      createdAt: '2026-11-17T08:00:00Z',
    },
  ];

  const packings: PackingRecord[] = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-001',
      packingDate: '2026-11-18',
      fromDate: '2026-11-18',
      toDate: '2026-11-18',
      shippingMark: 'ZSB-88',
      flight: 'MU-2036',
      destination: 'PVG',
      shipper: 'ZSB',
      items: [],
      totalBox: 10,
      totalWeight: 200,
      totalAmount: 4000,
      rmbRate: 16.5,
      totalAmountBDT: 66000,
      rmbAmount: 20,
      settledAmount: 4000,
      exporterStatus: 'UNPAID',
      paymentStatus: 'UNPAID',
      paymentDate: '',
      billSite: 'PVG',
      remarks: '',
      createdAt: '2026-11-18T08:00:00Z',
    },
  ];

  const res = calculateDashboardQuickSummary({
    purchases,
    payments,
    packings,
    referenceToday: REF_TODAY,
  });

  // Today's purchases: PUR-001 (30,000, 50kg, paid 10,000) + PUR-002 (15,000, 30kg, paid 15,000)
  assert.equal(res.totalPurchasesTodayAmount, 45000);
  assert.equal(res.todayPurchaseBillsCount, 2);
  assert.equal(res.todayPurchaseQtyKg, 80);
  assert.equal(res.todayPurchasePaidAmount, 25000);
  assert.equal(res.todayPurchaseUnpaidBalance, 20000);
  assert.equal(res.todaySettlementPercent, 56);

  // Pending payments: ABDULLAH VAI owes 20,000; ROHIM TRADERS owes 50,000 - 15,000 - 5,000 = 30,000 -> total 50,000 across 2 suppliers
  assert.equal(res.supplierPendingAmount, 50000);
  assert.equal(res.totalPendingPaymentsAmount, 50000);
  assert.equal(res.suppliersWithDueCount, 2);
  assert.equal(res.pendingPartiesCount, 2);
  assert.equal(res.unpaidPackingCount, 1);
  assert.equal(res.hasPendingPayments, true);
});
