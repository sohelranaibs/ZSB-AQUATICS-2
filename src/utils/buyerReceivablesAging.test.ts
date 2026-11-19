import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBuyerReceivablesAging,
  formatBilingualBuyerStatement,
  buildBuyerAgingCsv,
} from './buyerReceivablesAging.ts';
import { PackingRecord, PaymentRecord } from '../types/index.ts';

function makePacking(overrides: Partial<PackingRecord>): PackingRecord {
  return {
    id: 'pkg-1',
    invoiceNumber: 'PKG-001',
    shippingMark: 'ZSB-GZ-01',
    flight: 'CZ-392',
    destination: 'Guangzhou',
    shipper: 'Apex Cargo',
    packingDate: '2026-11-15',
    fromDate: '2026-11-15',
    toDate: '2026-11-15',
    items: [],
    totalBox: 10,
    totalWeight: 150,
    totalAmount: 10000,
    rmbRate: 17,
    paymentStatus: 'UNPAID',
    createdAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  };
}

test('calculateBuyerReceivablesAging buckets unpaid shipments accurately across 0-7, 8-15, 16-30, and 30+ days', () => {
  const packings: PackingRecord[] = [
    // 3 days old (0-7d)
    makePacking({ id: 'p1', invoiceNumber: 'PKG-1', shippingMark: 'GZ-ALPHA', packingDate: '2026-11-15', totalAmount: 5000, rmbRate: 17 }),
    // 12 days old (8-15d) with 2000 RMB already settled -> 8000 RMB remaining
    makePacking({ id: 'p2', invoiceNumber: 'PKG-2', shippingMark: 'GZ-ALPHA', packingDate: '2026-11-06', totalAmount: 10000, settledAmount: 2000, rmbRate: 17 }),
    // 25 days old (16-30d)
    makePacking({ id: 'p3', invoiceNumber: 'PKG-3', shippingMark: 'SH-BETA', packingDate: '2026-10-24', totalAmount: 12000, rmbRate: 16.5 }),
    // 45 days old (30+d overdue)
    makePacking({ id: 'p4', invoiceNumber: 'PKG-4', shippingMark: 'SH-BETA', packingDate: '2026-10-04', totalAmount: 20000, rmbRate: 16.5 }),
    // Paid shipment should be excluded
    makePacking({ id: 'p5', invoiceNumber: 'PKG-5', shippingMark: 'GZ-ALPHA', packingDate: '2026-09-01', totalAmount: 9000, paymentStatus: 'PAID' }),
  ];

  const report = calculateBuyerReceivablesAging(packings, [] as PaymentRecord[], {
    defaultRmbRate: 16.5,
    asOfDate: '2026-11-18',
  });

  assert.equal(report.totalUnpaidShipments, 4);
  assert.equal(report.totalBuyersWithDue, 2);
  assert.equal(report.bucketTotalsRmb['0_7'], 5000);
  assert.equal(report.bucketTotalsRmb['8_15'], 8000);
  assert.equal(report.bucketTotalsRmb['16_30'], 12000);
  assert.equal(report.bucketTotalsRmb.over_30, 20000);
  assert.equal(report.totalOutstandingRmb, 45000);

  // SH-BETA has 30+ day overdue balance, so it sorts first
  assert.equal(report.buyers[0].shippingMark, 'SH-BETA');
  assert.equal(report.buyers[0].bucketOver30Rmb, 20000);
  assert.equal(report.buyers[0].maxDaysOverdue, 45);
  assert.equal(report.buyers[1].shippingMark, 'GZ-ALPHA');
  assert.equal(report.buyers[1].outstandingRmb, 13000);

  const statement = formatBilingualBuyerStatement(report.buyers[0], 'ZSB AQUATICS', '2026-11-18');
  assert.match(statement, /应收账款对账单/);
  assert.match(statement, /SH-BETA/);
  assert.match(statement, /PKG-4/);

  const csv = buildBuyerAgingCsv(report);
  assert.match(csv, /Shipping Mark/);
  assert.match(csv, /SH-BETA/);
});
