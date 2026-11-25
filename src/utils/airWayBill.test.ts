import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAirWayBillRow,
  buildAirWayBillRows,
  createEmptyAirWayBillRow,
  createInitialAirWayBillRows,
  mergeAirWayBillRows,
  aggregateAirWayBillRows,
  normalizeAirWayBillDateKey,
  isCompleteIsoDateInput,
  calculateAirWayBillTotals,
  extractAirWayBillFilterOptions,
  formatAirWayBillExportFilename,
  isAirWayBillRowPopulated,
  isValidSignedDecimalDraft,
  parseSignedNumber,
  resolveAirWayBillSelection,
  toggleAirWayBillRowSelection,
  toggleAllAirWayBillRowsSelection,
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

  // Documents holder is strictly locked to Packing List (stale/extra override keys are ignored)
  const lockedCheck = buildAirWayBillRows(
    samplePackings,
    { 'pkg-awb-1': { date: '2026-10-28' } },
    { documentsHolder: 'SHISHIR MAMA' }
  );
  assert.equal(lockedCheck.length, 1);
  assert.equal(lockedCheck[0].id, 'pkg-awb-1');
  assert.equal(lockedCheck[0].documentsHolder, 'SHISHIR MAMA');

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

test('buildAirWayBillRows combines rows with identical Date, DOCUMENTS HOLDER/SHIPPER, and Flight into a single row with summed TOTAL BOX', () => {
  const duplicatePackings: PackingRecord[] = [
    {
      id: 'pkg-grp-1',
      invoiceNumber: 'PKG-2026-0101',
      shippingMark: 'BT-1',
      flight: 'CZ CAN',
      destination: 'GUANGZHOU',
      shipper: 'SHIPPER A',
      documentsHolder: 'BANGLA TRADE',
      packingDate: '2026-10-01',
      fromDate: '2026-10-01',
      toDate: '2026-10-01',
      items: [],
      totalBox: 4,
      totalWeight: 64,
      totalAmount: 6400,
      awbRmbPerBox: 40,
      awbRate: 17,
      createdAt: '2026-10-01T08:00:00Z',
    },
    {
      id: 'pkg-grp-2',
      invoiceNumber: 'PKG-2026-0102',
      shippingMark: 'BT-2',
      flight: '  cz   can ',
      destination: 'GUANGZHOU',
      shipper: 'BANGLA TRADE',
      documentsHolder: '', // falls back to shipper -> matches BANGLA TRADE
      packingDate: '2026-10-01',
      fromDate: '2026-10-01',
      toDate: '2026-10-01',
      items: [],
      totalBox: 1,
      totalWeight: 16,
      totalAmount: 1600,
      awbRmbPerBox: 40,
      awbRate: 17,
      createdAt: '2026-10-01T09:00:00Z',
    },
    {
      id: 'pkg-grp-3',
      invoiceNumber: 'PKG-2026-0103',
      shippingMark: 'SS-1',
      flight: 'CZ CAN',
      destination: 'GUANGZHOU',
      shipper: 'SHOWMIK SHISIR',
      documentsHolder: 'SHOWMIK SHISIR', // different holder on same date & flight -> separate row
      packingDate: '2026-10-01',
      fromDate: '2026-10-01',
      toDate: '2026-10-01',
      items: [],
      totalBox: 3,
      totalWeight: 48,
      totalAmount: 4800,
      awbRmbPerBox: 40,
      awbRate: 17,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'pkg-grp-4',
      invoiceNumber: 'PKG-2026-0104',
      shippingMark: 'ANJ-1',
      flight: 'NKG',
      destination: 'NANJING',
      shipper: 'ANJUM',
      documentsHolder: 'ANJUM',
      packingDate: '2026-10-02',
      fromDate: '2026-10-02',
      toDate: '2026-10-02',
      items: [],
      totalBox: 2,
      totalWeight: 32,
      totalAmount: 3200,
      awbRmbPerBox: 40,
      awbRate: 17,
      createdAt: '2026-10-02T08:00:00Z',
    },
    {
      id: 'pkg-grp-5',
      invoiceNumber: 'PKG-2026-0105',
      shippingMark: 'ANJ-2',
      flight: 'NKG',
      destination: 'NANJING',
      shipper: 'ANJUM',
      documentsHolder: 'ANJUM',
      packingDate: '2026-10-02',
      fromDate: '2026-10-02',
      toDate: '2026-10-02',
      items: [],
      totalBox: 3,
      totalWeight: 48,
      totalAmount: 4800,
      awbRmbPerBox: 40,
      awbRate: 17,
      createdAt: '2026-10-02T09:00:00Z',
    },
  ];

  const rows = buildAirWayBillRows(duplicatePackings);
  // 5 packings collapse cleanly into 3 unique (Date, Holder/Shipper, Flight) rows
  assert.equal(rows.length, 3);

  // Row 1: 2026-10-01 | BANGLA TRADE | CZ CAN -> 4 + 1 = 5 boxes, 5*40 = 200 RMB, 200*17 = 3400 BDT
  assert.equal(rows[0].date, '2026-10-01');
  assert.equal(rows[0].documentsHolder, 'BANGLA TRADE');
  assert.equal(rows[0].flight, 'CZ CAN');
  assert.equal(rows[0].totalBox, 5);
  assert.equal(rows[0].totalRmb, 200);
  assert.equal(rows[0].bdtAmount, 3400);
  assert.deepEqual(rows[0].packingIds, ['pkg-grp-1', 'pkg-grp-2']);
  assert.equal(rows[0].mergedCount, 2);

  // Row 2: 2026-10-01 | SHOWMIK SHISIR | CZ CAN -> stays separate (3 boxes)
  assert.equal(rows[1].documentsHolder, 'SHOWMIK SHISIR');
  assert.equal(rows[1].totalBox, 3);
  assert.equal(rows[1].mergedCount, 1);

  // Row 3: 2026-10-02 | ANJUM | NKG -> 2 + 3 = 5 boxes, 200 RMB, 3400 BDT
  assert.equal(rows[2].date, '2026-10-02');
  assert.equal(rows[2].documentsHolder, 'ANJUM');
  assert.equal(rows[2].flight, 'NKG');
  assert.equal(rows[2].totalBox, 5);
  assert.equal(rows[2].totalRmb, 200);
  assert.equal(rows[2].bdtAmount, 3400);
  assert.deepEqual(rows[2].packingIds, ['pkg-grp-4', 'pkg-grp-5']);
  assert.equal(rows[2].mergedCount, 2);

  // Grand totals remain exact (5 + 3 + 5 = 13 boxes)
  const totals = calculateAirWayBillTotals(rows);
  assert.equal(totals.totalBoxes, 13);
  assert.equal(totals.totalRmb, 520);
  assert.equal(totals.totalAmountBDT, 8840);
});

test('editable Date override moves row to target Date, sums Total Box with matching entries, and preserves source Packing List', () => {
  assert.equal(isCompleteIsoDateInput('2026-10-24'), true);
  assert.equal(isCompleteIsoDateInput('0002-10-24'), false);
  assert.equal(isCompleteIsoDateInput('2026-02-30'), false);
  assert.equal(isCompleteIsoDateInput(''), false);

  const datePackings: PackingRecord[] = [
    {
      ...samplePackings[0],
      id: 'pkg-d1',
      packingDate: '2025-12-23',
      documentsHolder: 'SHISHIR MAMA',
      flight: 'CZ CAN',
      totalBox: 3,
      awbRmbPerBox: 100,
      awbRate: 17,
    },
    {
      ...samplePackings[0],
      id: 'pkg-d2',
      packingDate: '2025-12-24',
      documentsHolder: 'SHISHIR MAMA',
      flight: 'CZ CAN',
      totalBox: 2,
      awbRmbPerBox: 100,
      awbRate: 17,
    },
    {
      ...samplePackings[0],
      id: 'pkg-d3',
      packingDate: '2025-12-25',
      documentsHolder: 'SAJID INT.',
      flight: 'NKG',
      totalBox: 9,
      awbRmbPerBox: 100,
      awbRate: 17,
    },
  ];

  // Baseline: 3 separate rows (3, 2, 9 boxes)
  const baseline = buildAirWayBillRows(datePackings);
  assert.equal(baseline.length, 3);
  assert.equal(baseline[0].date, '2025-12-23');
  assert.equal(baseline[0].totalBox, 3);
  assert.equal(baseline[1].date, '2025-12-24');
  assert.equal(baseline[1].totalBox, 2);

  // Edit Row 1 Date from 2025-12-23 -> 2025-12-24: combines with Row 2 on 2025-12-24 and sums Total Box (3 + 2 = 5)
  const movedAndMerged = buildAirWayBillRows(datePackings, {
    'pkg-d1': { date: '2025-12-24' },
  });
  assert.equal(movedAndMerged.length, 2);
  assert.equal(movedAndMerged[0].date, '2025-12-24');
  assert.equal(movedAndMerged[0].documentsHolder, 'SHISHIR MAMA');
  assert.equal(movedAndMerged[0].flight, 'CZ CAN');
  assert.equal(movedAndMerged[0].totalBox, 5);
  assert.equal(movedAndMerged[0].totalRmb, 500);
  assert.equal(movedAndMerged[0].bdtAmount, 8500);
  assert.equal(movedAndMerged[0].isDateOverridden, true);
  assert.deepEqual(movedAndMerged[0].packingIds, ['pkg-d1', 'pkg-d2']);

  // Edit Row 1 Date to a later date (2025-12-28): moves chronologically after 2025-12-25 with its Total Box (3)
  const movedLater = buildAirWayBillRows(datePackings, {
    'pkg-d1': { date: '2025-12-28' },
  });
  assert.equal(movedLater.length, 3);
  assert.equal(movedLater[0].date, '2025-12-24');
  assert.equal(movedLater[1].date, '2025-12-25');
  assert.equal(movedLater[2].date, '2025-12-28');
  assert.equal(movedLater[2].totalBox, 3);
  assert.equal(movedLater[2].isDateOverridden, true);
  assert.equal(movedLater[2].originalDate, '2025-12-23');

  // Filtering by fromDate/toDate respects the edited Date
  const filteredOnNewDate = buildAirWayBillRows(
    datePackings,
    { 'pkg-d1': { date: '2025-12-28' } },
    { fromDate: '2025-12-28', toDate: '2025-12-28' }
  );
  assert.equal(filteredOnNewDate.length, 1);
  assert.equal(filteredOnNewDate[0].totalBox, 3);

  // Underlying source Packing List records remain completely unmutated
  assert.equal(datePackings[0].packingDate, '2025-12-23');
});

test('normalizeAirWayBillDateKey and aggregateAirWayBillRows group across mixed date formats and custom rows', () => {
  assert.equal(normalizeAirWayBillDateKey('2026-10-01'), '2026-10-01');
  assert.equal(normalizeAirWayBillDateKey('2026-10-01T08:30:00Z'), '2026-10-01');
  assert.equal(normalizeAirWayBillDateKey('01/10/2026'), '2026-10-01');
  assert.equal(normalizeAirWayBillDateKey('2026/10/01'), '2026-10-01');

  // Mixed date formats on Packing Lists still aggregate into 1 summary row
  const mixedDatePackings: PackingRecord[] = [
    {
      ...samplePackings[0],
      id: 'mix-1',
      packingDate: '2026-10-01',
      documentsHolder: 'BANGLA TRADE',
      flight: 'CZ CAN',
      totalBox: 4,
      awbRmbPerBox: 40,
      awbRate: 17,
    },
    {
      ...samplePackings[0],
      id: 'mix-2',
      packingDate: '01/10/2026',
      documentsHolder: 'bangla trade',
      flight: 'cz  can',
      totalBox: 1,
      awbRmbPerBox: 40,
      awbRate: 17,
    },
    {
      ...samplePackings[0],
      id: 'mix-3',
      packingDate: '2026-10-01T14:00:00.000Z',
      documentsHolder: 'BANGLA TRADE',
      flight: 'CZ CAN',
      totalBox: 6,
      awbRmbPerBox: 40,
      awbRate: 17,
    },
  ];

  const dbRows = buildAirWayBillRows(mixedDatePackings);
  assert.equal(dbRows.length, 1);
  assert.equal(dbRows[0].totalBox, 11);
  assert.equal(dbRows[0].totalRmb, 440);
  assert.equal(dbRows[0].bdtAmount, 7480);
  assert.equal(dbRows[0].mergedCount, 3);

  // mergeAirWayBillRows also aggregates duplicate custom rows AND custom rows matching a DB row
  const customRows = [
    createEmptyAirWayBillRow('cust-match-db', {
      date: '2026-10-01',
      documentsHolder: 'BANGLA TRADE',
      flight: 'CZ CAN',
      totalBox: 2,
      rmbPerBox: 40,
      rate: 17,
    }),
    createEmptyAirWayBillRow('cust-dup-1', {
      date: '2026-10-02',
      documentsHolder: 'RAKIB TRADERS',
      flight: 'YG KMG',
      totalBox: 2,
      rmbPerBox: 40,
      rate: 17,
    }),
    createEmptyAirWayBillRow('cust-dup-2', {
      date: '02/10/2026',
      documentsHolder: '  rakib   traders ',
      flight: 'yg kmg',
      totalBox: 1,
      rmbPerBox: 40,
      rate: 17,
    }),
    ...createInitialAirWayBillRows(4),
  ];

  const merged = mergeAirWayBillRows(dbRows, customRows);
  // 2 unique populated summary rows + 2 remaining blank default rows = 4 rows
  assert.equal(merged.length, 4);

  // Row 1: DB (11) + matching custom row (2) = 13 boxes -> 520 RMB -> 8840 BDT
  assert.equal(merged[0].totalBox, 13);
  assert.equal(merged[0].totalRmb, 520);
  assert.equal(merged[0].bdtAmount, 8840);
  assert.equal(merged[0].mergedCount, 4);
  assert.deepEqual(merged[0].packingIds, ['mix-1', 'mix-2', 'mix-3']);
  assert.deepEqual(merged[0].customRowIds, ['cust-match-db']);

  // Row 2: Two matching custom rows (2 + 1 = 3 boxes) -> 120 RMB -> 2040 BDT
  assert.equal(merged[1].documentsHolder, 'RAKIB TRADERS');
  assert.equal(merged[1].flight, 'YG KMG');
  assert.equal(merged[1].totalBox, 3);
  assert.equal(merged[1].totalRmb, 120);
  assert.equal(merged[1].bdtAmount, 2040);
  assert.equal(merged[1].mergedCount, 2);
  assert.deepEqual(merged[1].customRowIds, ['cust-dup-1', 'cust-dup-2']);

  // Direct aggregateAirWayBillRows preserves incomplete/blank rows without merging them
  const withBlanks = aggregateAirWayBillRows([
    createEmptyAirWayBillRow('b1', { date: '2026-10-05' }),
    createEmptyAirWayBillRow('b2', { date: '2026-10-05' }),
  ]);
  assert.equal(withBlanks.length, 2);
});

test('SELECT ROW helpers resolve individual and multi-row bill invoices, exclude blank rows, and prune stale IDs', () => {
  const dbRows = buildAirWayBillRows(samplePackings, {
    'pkg-awb-2': { rmbPerBox: 200, rate: 17.5 },
  });
  const displayRows = mergeAirWayBillRows(dbRows, createInitialAirWayBillRows(4));
  // 2 populated rows + 2 blank padding rows
  assert.equal(displayRows.length, 4);

  // Default (no selection): full statement rows & totals
  const noneSelected = resolveAirWayBillSelection(displayRows, []);
  assert.equal(noneSelected.hasSelection, false);
  assert.equal(noneSelected.allSelected, false);
  assert.equal(noneSelected.isIndeterminate, false);
  assert.deepEqual(noneSelected.selectableRowIds, ['pkg-awb-1', 'pkg-awb-2']);
  assert.equal(noneSelected.invoiceRows.length, 4);
  assert.equal(noneSelected.invoiceTotals.totalBoxes, 20);
  assert.equal(noneSelected.invoiceTotals.totalAmountBDT, 57700);

  // Select 1 individual row -> invoice contains ONLY that row with exact row totals
  const singleIds = toggleAirWayBillRowSelection([], 'pkg-awb-2');
  const singleSelected = resolveAirWayBillSelection(displayRows, singleIds);
  assert.equal(singleSelected.hasSelection, true);
  assert.equal(singleSelected.allSelected, false);
  assert.equal(singleSelected.isIndeterminate, true);
  assert.equal(singleSelected.invoiceRows.length, 1);
  assert.equal(singleSelected.invoiceRows[0].id, 'pkg-awb-2');
  assert.equal(singleSelected.invoiceTotals.totalBoxes, 8);
  assert.equal(singleSelected.invoiceTotals.totalRmb, 1600);
  assert.equal(singleSelected.invoiceTotals.totalAmountBDT, 28000);

  // Select all populates all selectable rows (never blank padding rows)
  const allIds = toggleAllAirWayBillRowsSelection(singleIds, singleSelected.selectableRowIds);
  const allSelected = resolveAirWayBillSelection(displayRows, allIds);
  assert.equal(allSelected.hasSelection, true);
  assert.equal(allSelected.allSelected, true);
  assert.equal(allSelected.isIndeterminate, false);
  assert.equal(allSelected.invoiceRows.length, 2);
  assert.equal(allSelected.invoiceTotals.totalBoxes, 20);
  assert.equal(allSelected.invoiceTotals.totalAmountBDT, 57700);

  // Calling toggleAll again clears selection
  const clearedIds = toggleAllAirWayBillRowsSelection(allIds, allSelected.selectableRowIds);
  assert.deepEqual(clearedIds, []);

  // Stale or blank row IDs are silently ignored
  const staleCheck = resolveAirWayBillSelection(displayRows, ['non-existent-id', 'awb-row-3']);
  assert.equal(staleCheck.hasSelection, false);
  assert.deepEqual(staleCheck.selectedRowIds, []);
  assert.equal(staleCheck.invoiceRows.length, 4);
});



