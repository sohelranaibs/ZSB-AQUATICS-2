import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAirWayBillRow,
  buildAirWayBillRows,
  createEmptyAirWayBillRow,
  createInitialAirWayBillRows,
  mergeAirWayBillRows,
  calculateAirWayBillTotals,
  extractAirWayBillFilterOptions,
  formatAirWayBillExportFilename,
  isAirWayBillRowPopulated,
  isValidSignedDecimalDraft,
  parseSignedNumber,
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
    documentsHolder: 'SHISHIR MAMA',
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
    documentsHolder: 'ANJUM',
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
  assert.deepEqual(opts.documentsHolders, ['ANJUM', 'SHISHIR MAMA']);
  assert.deepEqual(opts.flights, ['CZ-392', 'MU-2036']);

  const filename = formatAirWayBillExportFilename('2026-10', 'ZSB AQUATICS', 'pdf');
  assert.equal(filename, 'ZSB_AQUATICS_Flight_Return_Bill_2026-10_ZSB_AQUATICS.pdf');

  const rangeFilename = formatAirWayBillExportFilename(
    'all',
    'ZSB AQUATICS',
    'pdf',
    undefined,
    '2026-10-01',
    '2026-10-29'
  );
  assert.equal(
    rangeFilename,
    'ZSB_AQUATICS_Flight_Return_Bill_2026-10-01_to_2026-10-29_ZSB_AQUATICS.pdf'
  );
});

test('buildAirWayBillRows and mergeAirWayBillRows filter inclusively by fromDate and toDate', () => {
  // Only fromDate = 2026-10-29 should match pkg-awb-2 (2026-10-30) only
  const fromOnly = buildAirWayBillRows(samplePackings, {}, { fromDate: '2026-10-29' });
  assert.equal(fromOnly.length, 1);
  assert.equal(fromOnly[0].id, 'pkg-awb-2');

  // Only toDate = 2026-10-28 should match pkg-awb-1 (2026-10-28) inclusively
  const toOnly = buildAirWayBillRows(samplePackings, {}, { toDate: '2026-10-28' });
  assert.equal(toOnly.length, 1);
  assert.equal(toOnly[0].id, 'pkg-awb-1');

  // Inclusive range covering both dates
  const bothDates = buildAirWayBillRows(
    samplePackings,
    {},
    { fromDate: '2026-10-28', toDate: '2026-10-30' }
  );
  assert.equal(bothDates.length, 2);

  // Custom rows with dates outside range are excluded during merge
  const customRows = [
    {
      id: 'custom-in-range',
      isCustom: true,
      date: '2026-10-29',
      shipper: 'CUSTOM A',
      flight: 'CZ-101',
      totalBox: 5,
      rmbPerBox: 100,
      totalRmb: 500,
      rate: 16,
      bdtAmount: 8000,
    },
    {
      id: 'custom-out-of-range',
      isCustom: true,
      date: '2026-11-05',
      shipper: 'CUSTOM B',
      flight: 'CZ-202',
      totalBox: 4,
      rmbPerBox: 100,
      totalRmb: 400,
      rate: 16,
      bdtAmount: 6400,
    },
  ];
  const merged = mergeAirWayBillRows(fromOnly, customRows, {
    fromDate: '2026-10-29',
    toDate: '2026-10-31',
  });
  const ids = merged.map((r) => r.id);
  assert.equal(ids.includes('pkg-awb-2'), true);
  assert.equal(ids.includes('custom-in-range'), true);
  assert.equal(ids.includes('custom-out-of-range'), false);
});

test('buildAirWayBillRows and mergeAirWayBillRows pull and filter by documentsHolder from Packing List', () => {
  const rows = buildAirWayBillRows(samplePackings, {}, { documentsHolder: 'SHISHIR MAMA' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'pkg-awb-1');
  assert.equal(rows[0].documentsHolder, 'SHISHIR MAMA');

  const anjumRows = buildAirWayBillRows(samplePackings, {}, { documentsHolder: 'anjum' });
  assert.equal(anjumRows.length, 1);
  assert.equal(anjumRows[0].id, 'pkg-awb-2');
  assert.equal(anjumRows[0].documentsHolder, 'ANJUM');

  // Override documentsHolder on a synced Packing List row
  const overridden = buildAirWayBillRows(
    samplePackings,
    { 'pkg-awb-1': { documentsHolder: 'ZSB AQUATICS' } },
    { documentsHolder: 'ZSB AQUATICS' }
  );
  assert.equal(overridden.length, 1);
  assert.equal(overridden[0].id, 'pkg-awb-1');
  assert.equal(overridden[0].documentsHolder, 'ZSB AQUATICS');

  // Falls back to shipper when documentsHolder is blank in Packing List
  const withoutHolder: PackingRecord[] = [
    { ...samplePackings[0], id: 'pkg-no-holder', documentsHolder: '' },
  ];
  const fallbackRows = buildAirWayBillRows(withoutHolder);
  assert.equal(fallbackRows[0].documentsHolder, 'ZSB AQUATICS');
});

test('signed rate parsing (-0, +0, negative, positive) and formula calculations work accurately', () => {
  assert.equal(isValidSignedDecimalDraft('-0'), true);
  assert.equal(isValidSignedDecimalDraft('+0'), true);
  assert.equal(isValidSignedDecimalDraft('-18.9'), true);
  assert.equal(isValidSignedDecimalDraft('+18.9'), true);
  assert.equal(isValidSignedDecimalDraft('-.5'), true);
  assert.equal(isValidSignedDecimalDraft('abc'), false);

  assert.equal(Object.is(parseSignedNumber('-0'), 0), true);
  assert.equal(Object.is(parseSignedNumber('+0'), 0), true);
  assert.equal(parseSignedNumber('-18.9'), -18.9);
  assert.equal(parseSignedNumber('+18.9'), 18.9);
  assert.equal(parseSignedNumber('-0.5'), -0.5);

  // Negative rate produces negative BDT amount
  const negRes = calculateAirWayBillRow(3, 100, -18.9);
  assert.equal(negRes.totalRmb, 300);
  assert.equal(negRes.bdtAmount, -5670);

  // -0 and +0 normalize cleanly to +0 (never -0)
  const negZeroRes = calculateAirWayBillRow(3, 100, -0);
  assert.equal(negZeroRes.totalRmb, 300);
  assert.equal(Object.is(negZeroRes.bdtAmount, 0), true);

  const posRes = calculateAirWayBillRow(3, 100, 18.9);
  assert.equal(posRes.bdtAmount, 5670);

  // Explicit 0 and negative overrides persist on Packing List rows and net cleanly in totals
  const rows = buildAirWayBillRows(samplePackings, {
    'pkg-awb-1': { rmbPerBox: 100, rate: -10, rateSpecified: true },
    'pkg-awb-2': { rmbPerBox: 100, rate: 0, rateSpecified: true },
  });
  assert.equal(rows[0].rate, -10);
  assert.equal(rows[0].bdtAmount, -12000);
  assert.equal(rows[1].rate, 0);
  assert.equal(rows[1].rateSpecified, true);
  assert.equal(rows[1].bdtAmount, 0);

  const totals = calculateAirWayBillTotals(rows);
  assert.equal(totals.totalAmountBDT, -12000);

  // Custom row with negative rate or explicit 0 rate counts as populated
  const negCustom = createEmptyAirWayBillRow('neg-1', { rate: -5, rateSpecified: true });
  assert.equal(isAirWayBillRowPopulated(negCustom), true);
  const zeroCustom = createEmptyAirWayBillRow('zero-1', { rate: 0, rateSpecified: true });
  assert.equal(isAirWayBillRowPopulated(zeroCustom), true);
});

