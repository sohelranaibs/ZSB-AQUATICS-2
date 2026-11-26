import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPackingDbPdfReport,
  formatPackingDbPdfFilename,
} from './packingDbPdfExport.ts';
import type { CompanyProfile, PackingRecord } from '../types/index.ts';

const MOCK_PROFILE: CompanyProfile = {
  companyName: 'ZSB AQUATICS',
  address: '29/B, NISHATNAGAR, TARARTEK, TURAG, DHAKA-1230',
  mobiles: ['+880 18411-65902'],
  email: 'zsbaquatics@gmail.com',
  website: 'www.zsbaquatics.com',
  managingPartner: 'Md. Mizanur Rahman',
  partner: 'Md. Sohel Rana',
  currency: 'TK',
  rmbExchangeRate: 16.5,
  logoUrl: '',
};

const SAMPLE_PACKINGS: PackingRecord[] = [
  {
    id: 'pkg-1',
    serialNumber: 1,
    invoiceNumber: 'PKG-2026-1001',
    packingDate: '2026-10-08',
    fromDate: '2026-10-08',
    toDate: '2026-10-08',
    shippingMark: 'AAD',
    flight: 'CZ-392',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    documentsHolder: 'Sohel',
    items: [
      {
        id: 'it-1',
        item: 'LIVE CRAB M1',
        box: 15,
        weight: 16,
        totalWeight: 240,
        unit: 'KG',
        rate: 60,
        amount: 14400,
      },
    ],
    totalBox: 25,
    totalWeight: 400,
    totalAmount: 15000,
    rmbRate: 16.5,
    exporterStatus: 'PAID',
    createdAt: '2026-10-08T08:00:00Z',
  },
  {
    id: 'pkg-2',
    serialNumber: 2,
    invoiceNumber: 'PKG-2026-1015',
    packingDate: '2026-10-15',
    fromDate: '2026-10-15',
    toDate: '2026-10-15',
    shippingMark: 'CHJ-22',
    flight: 'MU-2036',
    destination: 'SHANGHAI',
    shipper: 'DHAKA FRESH',
    documentsHolder: 'Mizan',
    items: [
      {
        id: 'it-2',
        item: 'EEL FISH A',
        box: 18,
        weight: 16,
        totalWeight: 288,
        unit: 'KG',
        rate: 55,
        amount: 11200,
      },
    ],
    totalBox: 18,
    totalWeight: 288,
    totalAmount: 11200,
    rmbRate: 17.0,
    exporterStatus: 'REPORT',
    createdAt: '2026-10-15T09:00:00Z',
  },
];

test('formatPackingDbPdfFilename builds deterministic names with date range and filters', () => {
  assert.equal(
    formatPackingDbPdfFilename({ referenceDate: '2026-11-26' }),
    'ZSB_AQUATICS_PACKING_DB_2026-11-26.pdf'
  );

  assert.equal(
    formatPackingDbPdfFilename({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      partyQuery: 'Dhaka Fresh',
      searchTerm: 'CHJ-22',
      validationFilter: 'issues',
    }),
    'ZSB_AQUATICS_PACKING_DB_2026-10-01_TO_2026-10-31_DHAKA_FRESH_CHJ_22_ISSUES.pdf'
  );
});

test('buildPackingDbPdfReport computes accurate totals, metadata, and respects custom column order', () => {
  const customOrder = [
    'shippingMark',
    'invoiceNumber',
    'totalBox',
    'totalWeight',
    'totalAmount',
    'amountBDT',
    'status',
  ];
  const serialMap = new Map<string, number>([
    ['pkg-1', 10],
    ['pkg-2', 11],
  ]);

  const report = buildPackingDbPdfReport({
    records: SAMPLE_PACKINGS,
    totalRecordCount: 4,
    companyProfile: MOCK_PROFILE,
    serialNumberMap: serialMap,
    columnOrder: customOrder,
    partyQuery: 'ZSB',
    referenceDate: '2026-11-26',
  });

  assert.equal(report.activeTab, 'packing_db');
  assert.equal(report.filename, 'ZSB_AQUATICS_PACKING_DB_2026-11-26_ZSB.pdf');
  assert.equal(report.sections.length, 1);

  const section = report.sections[0];
  // S. NO. is always first, followed by customOrder, then remaining default columns
  assert.equal(section.columns[0].key, 'sl');
  assert.equal(section.columns[1].key, 'shippingMark');
  assert.equal(section.columns[2].key, 'invoiceNumber');
  assert.equal(section.columns[3].key, 'totalBox');
  assert.equal(section.columns.length, 15);

  assert.equal(section.rows.length, 2);
  assert.equal(section.rows[0].sl, 10);
  assert.equal(section.rows[1].sl, 11);

  // Footer cells must have exact 1-to-1 correspondence with columns so column toggles & reorder stay aligned
  const footerCells = section.footerRows?.[0]?.cells || [];
  assert.equal(footerCells.length, section.columns.length);
  assert.equal(footerCells[0].value, 'TOTAL');

  const boxIdx = section.columns.findIndex((c) => c.key === 'totalBox');
  const weightIdx = section.columns.findIndex((c) => c.key === 'totalWeight');
  const rmbIdx = section.columns.findIndex((c) => c.key === 'totalAmount');
  const bdtIdx = section.columns.findIndex((c) => c.key === 'amountBDT');

  assert.equal(footerCells[boxIdx].value, '43');
  assert.equal(footerCells[weightIdx].value, '688 KG');
  assert.equal(footerCells[rmbIdx].value, '¥26,200.00');
  // 15000 * 16.5 = 247500; 11200 * 17.0 = 190400 -> 437900
  assert.equal(footerCells[bdtIdx].value, 'TK 437,900.00');

  // Verify metadata grid reflects filtered count
  const countMeta = report.metadataGrid.find((m) => m.label === 'CONSIGNMENTS');
  assert.equal(countMeta?.value, '2 of 4 Filtered');
});

test('buildPackingDbPdfReport handles empty record list cleanly', () => {
  const report = buildPackingDbPdfReport({
    records: [],
    totalRecordCount: 0,
    companyProfile: MOCK_PROFILE,
    referenceDate: '2026-11-26',
  });

  assert.equal(report.sections[0].rows.length, 0);
  assert.equal(report.sections[0].footerRows?.length, 0);
  assert.equal(report.metadataGrid[0].value, '0 Total');
});
