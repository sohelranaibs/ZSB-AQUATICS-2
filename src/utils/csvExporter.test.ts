import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeCsvField,
  formatCsvRow,
  generatePurchasesCSV,
  generatePackingsCSV,
  generatePaymentsCSV,
  UTF8_BOM,
} from './csvExporter.ts';
import { isDateInRange, getDateRangePreset } from './dateFilters.ts';
import { PurchaseRecord, PackingRecord, PaymentRecord } from '../types/index.ts';

test('escapeCsvField correctly handles quotes, commas, and newlines', () => {
  assert.equal(escapeCsvField('Simple Text'), 'Simple Text');
  assert.equal(escapeCsvField('Text, with comma'), '"Text, with comma"');
  assert.equal(escapeCsvField('Text "with quotes"'), '"Text ""with quotes"""');
  assert.equal(escapeCsvField('Line 1\nLine 2'), '"Line 1\nLine 2"');
  assert.equal(escapeCsvField(null), '');
  assert.equal(escapeCsvField(undefined), '');
  assert.equal(escapeCsvField(1234.56), '1234.56');
});

test('formatCsvRow formats comma separated row with proper escaping', () => {
  const row = ['INV-001', '2026-10-21', 'ZSB, LTD', 'Notes: "URGENT"'];
  const formatted = formatCsvRow(row);
  assert.equal(formatted, 'INV-001,2026-10-21,"ZSB, LTD","Notes: ""URGENT"""');
});

test('generatePurchasesCSV outputs UTF-8 BOM, headers, and correct purchase records', () => {
  const mockPurchases: PurchaseRecord[] = [
    {
      id: 'p-1',
      invoiceNumber: 'PUR-2026-0001',
      date: '2026-10-15',
      description: 'ABDULLAH VAI, KHULNA',
      contactNumber: '01711223344',
      items: [
        {
          id: 'it-1',
          item: 'F1',
          quantity: 100,
          rate: 300,
          totalAmount: 30000,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
      ],
      totalQty: 100,
      totalAmount: 30000,
      previousAmount: 5000,
      paidAmount: 25000,
      balance: 10000,
      remarks: 'First consignment',
      createdAt: '2026-10-15T10:00:00Z',
    },
  ];

  const csv = generatePurchasesCSV(mockPurchases);
  assert.equal(csv.startsWith(UTF8_BOM), true);
  assert.equal(csv.includes('Invoice No,Date,Supplier / Description'), true);
  assert.equal(csv.includes('PUR-2026-0001'), true);
  assert.equal(csv.includes('"ABDULLAH VAI, KHULNA"'), true);
  assert.equal(csv.includes('30000'), true);
  assert.equal(csv.includes('10000'), true);
  assert.equal(csv.includes('F1: Qty 100 @ 300 = 30000'), true);
});

test('generatePackingsCSV outputs UTF-8 BOM, headers, and packing list records', () => {
  const mockPackings: PackingRecord[] = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-2026-0001',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-20',
      fromDate: '2026-10-18',
      toDate: '2026-10-20',
      items: [
        {
          id: 'pi-1',
          item: '2F',
          box: 5,
          weight: 15,
          totalWeight: 75,
          unit: 'KG',
          rate: 350,
          amount: 26250,
        },
      ],
      totalBox: 5,
      totalWeight: 75,
      totalAmount: 26250,
      remarks: 'Packed in live boxes',
      createdAt: '2026-10-20T12:00:00Z',
    },
  ];

  const csv = generatePackingsCSV(mockPackings);
  assert.equal(csv.startsWith(UTF8_BOM), true);
  assert.equal(csv.includes('Packing List No,Date,Shipping Mark'), true);
  assert.equal(csv.includes('PKG-2026-0001'), true);
  assert.equal(csv.includes('AAD'), true);
  assert.equal(csv.includes('26250'), true);
  assert.equal(csv.includes('75'), true);
});

test('generatePaymentsCSV outputs UTF-8 BOM, headers, and payment records', () => {
  const mockPayments: PaymentRecord[] = [
    {
      id: 'pm-1',
      invoiceNumber: 'PAY-2026-0001',
      date: '2026-10-18',
      description: 'CHINA AGENT LI',
      contactNumber: '+8613800138000',
      items: [],
      totalAmount: 50000,
      previousAmount: 50000,
      paidAmount: 40000,
      balance: 10000,
      status: 'PAID',
      returnRMB: 3000,
      returnRMBInBDT: 49500,
      exportGoodsRef: 'PKG-2026-0001',
      remarks: 'Wire transfer confirmed',
      createdAt: '2026-10-18T14:00:00Z',
    },
  ];

  const csv = generatePaymentsCSV(mockPayments);
  assert.equal(csv.startsWith(UTF8_BOM), true);
  assert.equal(csv.includes('Payment Voucher No,Date,Party / Supplier'), true);
  assert.equal(csv.includes('Return RMB'), false);
  assert.equal(csv.includes('PAY-2026-0001'), true);
  assert.equal(csv.includes('PAID'), true);
  assert.equal(csv.includes('40000'), true);
  assert.equal(csv.includes('10000'), true);
});

test('isDateInRange filters dates correctly', () => {
  assert.equal(isDateInRange('2026-10-15', '2026-10-01', '2026-10-31'), true);
  assert.equal(isDateInRange('2026-10-01', '2026-10-01', '2026-10-31'), true);
  assert.equal(isDateInRange('2026-10-31', '2026-10-01', '2026-10-31'), true);
  assert.equal(isDateInRange('2026-09-30', '2026-10-01', '2026-10-31'), false);
  assert.equal(isDateInRange('2026-11-01', '2026-10-01', '2026-10-31'), false);

  // Partial boundaries (only start or only end)
  assert.equal(isDateInRange('2026-10-15', '2026-10-01', ''), true);
  assert.equal(isDateInRange('2026-09-15', '2026-10-01', ''), false);
  assert.equal(isDateInRange('2026-09-15', '', '2026-10-01'), true);
  assert.equal(isDateInRange('2026-10-15', '', '2026-10-01'), false);
  assert.equal(isDateInRange('2026-10-15', '', ''), true);
});

test('getDateRangePreset produces valid start and end dates', () => {
  const ref = new Date('2026-10-21T12:00:00Z');
  const todayPreset = getDateRangePreset('today', ref);
  assert.equal(todayPreset.startDate, '2026-10-21');
  assert.equal(todayPreset.endDate, '2026-10-21');

  const monthPreset = getDateRangePreset('this_month', ref);
  assert.equal(monthPreset.startDate, '2026-10-01');
  assert.equal(monthPreset.endDate, '2026-10-21');

  const yearPreset = getDateRangePreset('this_year', ref);
  assert.equal(yearPreset.startDate, '2026-01-01');
  assert.equal(yearPreset.endDate, '2026-12-31');

  const allPreset = getDateRangePreset('all', ref);
  assert.equal(allPreset.startDate, '');
  assert.equal(allPreset.endDate, '');
});
