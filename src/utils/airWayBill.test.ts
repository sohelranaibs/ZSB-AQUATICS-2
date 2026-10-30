import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAirWayBillRow,
  buildAirWayBillRows,
  createInitialAirWayBillRows,
  mergeAirWayBillRows,
  calculateAirWayBillTotals,
  extractAirWayBillFilterOptions,
  formatAirWayBillExportFilename,
} from './airWayBill.ts';
import { PackingRecord } from '../types/index.ts';

const samplePackings: PackingRecord[] = [
  {
    id: 'pkg-awb-1',
    invoiceNumber: 'PKG-2026-0001',
    shippingMark: 'ZSB-HK',
    flight: 'CZ-392',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    packingDate: '2026-10-28',
    fromDate: '2026-10-28',
    toDate: '2026-10-28',
    items: [],
    totalBox: 12,
    totalWeight: 192,
    totalAmount: 19200,
    awbRmbPerBox: 150,
    awbRate: 16.5,
    createdAt: '2026-10-28T08:00:00Z',
  },
  {
    id: 'pkg-awb-2',
    invoiceNumber: 'PKG-2026-0002',
    shippingMark: 'ZSB-SH',
    flight: 'MU-2036',
    destination: 'SHANGHAI',
    shipper: 'DHAKA MARINE',
    packingDate: '2026-10-30',
    fromDate: '2026-10-30',
    toDate: '2026-10-30',
    items: [],
    totalBox: 8,
    totalWeight: 128,
    totalAmount: 12800,
    rmbRate: 17,
    createdAt: '2026-10-30T08:00:00Z',
  },
];

test('calculateAirWayBillRow computes TOTAL RMB = TOTAL BOX * RMB/PER BOX and BDT AMOUNT = TOTAL RMB * RATE', () => {
  const res = calculateAirWayBillRow(12, 150, 16.5);
  assert.equal(res.totalRmb, 1800);
  assert.equal(res.bdtAmount, 29700);
});

test('buildAirWayBillRows builds rows from Packing List records and applies editable overrides', () => {
  const rows = buildAirWayBillRows(
    samplePackings,
    {
      'pkg-awb-2': { rmbPerBox: 200, rate: 17.5 },
    },
    { yearMonth: '2026-10' }
  );

  assert.equal(rows.length, 2);

  // Row 1 uses saved awbRmbPerBox=150, awbRate=16.5 -> totalRmb=1800, bdtAmount=29700
  assert.equal(rows[0].date, '2026-10-28');
  assert.equal(rows[0].shipper, 'ZSB AQUATICS');
  assert.equal(rows[0].flight, 'CZ-392');
  assert.equal(rows[0].totalBox, 12);
  assert.equal(rows[0].rmbPerBox, 150);
  assert.equal(rows[0].totalRmb, 1800);
  assert.equal(rows[0].rate, 16.5);
  assert.equal(rows[0].bdtAmount, 29700);

  // Row 2 uses override rmbPerBox=200, rate=17.5 -> totalRmb=1600, bdtAmount=28000
  assert.equal(rows[1].date, '2026-10-30');
  assert.equal(rows[1].shipper, 'DHAKA MARINE');
  assert.equal(rows[1].flight, 'MU-2036');
  assert.equal(rows[1].totalBox, 8);
  assert.equal(rows[1].rmbPerBox, 200);
  assert.equal(rows[1].totalRmb, 1600);
  assert.equal(rows[1].rate, 17.5);
  assert.equal(rows[1].bdtAmount, 28000);
});

test('mergeAirWayBillRows and calculateAirWayBillTotals maintain minimum 4 rows and compute TOTAL AMOUNT (BDT)', () => {
  const dbRows = buildAirWayBillRows(samplePackings, {
    'pkg-awb-2': { rmbPerBox: 200, rate: 17.5 },
  });
  const initialCustom = createInitialAirWayBillRows(4);
  const merged = mergeAirWayBillRows(dbRows, initialCustom);

  // 2 DB rows + 2 remaining blank rows = 4 rows
  assert.equal(merged.length, 4);

  const totals = calculateAirWayBillTotals(merged);
  assert.equal(totals.totalBoxes, 20);
  assert.equal(totals.totalRmb, 3400);
  assert.equal(totals.totalAmountBDT, 57700);
  assert.equal(totals.populatedRowsCount, 2);
});

test('extractAirWayBillFilterOptions and formatAirWayBillExportFilename work accurately', () => {
  const opts = extractAirWayBillFilterOptions(samplePackings);
  assert.deepEqual(opts.months, ['2026-10']);
  assert.deepEqual(opts.shippers, ['DHAKA MARINE', 'ZSB AQUATICS']);
  assert.deepEqual(opts.flights, ['CZ-392', 'MU-2036']);

  const filename = formatAirWayBillExportFilename('2026-10', 'ZSB AQUATICS', 'pdf');
  assert.equal(filename, 'ZSB_AQUATICS_Air_Way_Bill_2026-10_ZSB_AQUATICS.pdf');
});
