import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  EXCEL_A4_PAPER_SIZE,
  EXCEL_COMPANY_PAD_ROW_COUNT,
  setActiveCompanyPadProfile,
  resolveCompanyPadMetadata,
  drawPdfCompanyPadFrame,
} from './companyPadLayout.ts';
import {
  generateSingleSheetWorkbookBuffer,
  generateMasterWorkbookBuffer,
  parseExcelOrCsvBuffer,
  parseMasterWorkbookBuffer,
} from './excelDataHandler.ts';
import { buildSupplierReconciliationPdfDocument } from './supplierReconciliationPdf.ts';
import { initialCompanyProfile } from '../context/initialData.ts';
import type {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';
import type { SupplierRecordHistoryRow } from './supplierHistory.ts';

function readZipEntryXml(buf: Uint8Array, path: string): string {
  const xlsxAny = XLSX as unknown as {
    CFB?: typeof XLSX.CFB;
    default?: { CFB?: typeof XLSX.CFB };
  };
  const cfbLib = xlsxAny.CFB || xlsxAny.default?.CFB;
  assert.ok(cfbLib, 'Expected XLSX.CFB to be available');
  const cfb = cfbLib.read(buf, { type: 'array' });
  const entry = cfbLib.find(cfb, path);
  assert.ok(entry && entry.content, `Expected OOXML entry ${path} to exist`);
  return new TextDecoder('utf-8').decode(new Uint8Array(entry.content));
}

const samplePurchases: PurchaseRecord[] = [
  {
    id: 'pur-pad-1',
    invoiceNumber: 'INV-2026-0101',
    date: '2026-11-25',
    description: 'ABDULLAH VAI',
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
    previousAmount: 5000,
    paidAmount: 20000,
    balance: 30000,
    remarks: 'A4 Company Pad round-trip purchase',
    createdAt: '2026-11-25T10:00:00.000Z',
  },
];

const samplePackings: PackingRecord[] = [
  {
    id: 'pkg-pad-1',
    invoiceNumber: 'PKG-2026-0101',
    shippingMark: 'AAD',
    flight: 'CAN',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    documentsHolder: 'SOHEL',
    packingDate: '2026-11-25',
    fromDate: '2026-11-25',
    toDate: '2026-11-25',
    items: [
      {
        id: 'pki-1',
        item: '2F',
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
    rmbRate: 18,
    totalAmountBDT: 1080000,
    paymentStatus: 'UNPAID',
    exporterStatus: 'UNPAID',
    remarks: 'A4 Company Pad round-trip packing',
    createdAt: '2026-11-25T10:00:00.000Z',
  },
];

const samplePayments: PaymentRecord[] = [
  {
    id: 'pay-pad-1',
    invoiceNumber: 'PAY-2026-0101',
    date: '2026-11-25',
    description: 'ABDULLAH VAI',
    contactNumber: '+8801711223344',
    items: [
      {
        id: 'pyi-1',
        description: 'Supplier settlement',
        debitAmount: 30000,
        creditAmount: 10000,
        balance: 20000,
      },
    ],
    totalAmount: 30000,
    previousAmount: 30000,
    paidAmount: 20000,
    balance: 10000,
    status: 'PAID',
    returnRMB: 0,
    returnRMBInBDT: 0,
    exportGoodsRef: '',
    paymentCategory: 'supplier',
    remarks: 'A4 Company Pad round-trip payment',
    createdAt: '2026-11-25T10:00:00.000Z',
  },
];

const sampleCosts: OtherCostRecord[] = [
  {
    id: 'cost-pad-1',
    date: '2026-11-25',
    category: 'Cargo Handling',
    amount: 4500,
    description: 'Airport cold storage fee',
    paymentMethod: 'Cash',
    paidBy: 'Office Cashier',
    refInvoice: 'VCH-2026-09',
    createdAt: '2026-11-25T10:00:00.000Z',
  },
];

test('resolveCompanyPadMetadata syncs active profile and falls back to ZSB AQUATICS', () => {
  setActiveCompanyPadProfile(null);
  const defaults = resolveCompanyPadMetadata();
  assert.equal(defaults.companyName, 'ZSB AQUATICS');
  assert.ok(defaults.email.includes('@'));
  assert.ok(defaults.contactLine.includes('Mobile:'));

  setActiveCompanyPadProfile({
    companyName: 'ZSB AQUATICS EXPORT LTD.',
    address: 'House 12, Sector 7, Uttara, Dhaka',
    mobiles: ['+8801700000000'],
    email: 'accounts@zsbaquatics.com',
    website: 'www.zsbaquatics.com',
  });
  const live = resolveCompanyPadMetadata();
  assert.equal(live.companyName, 'ZSB AQUATICS EXPORT LTD.');
  assert.equal(live.address, 'House 12, Sector 7, Uttara, Dhaka');
  assert.ok(live.contactLine.includes('+8801700000000'));

  // Restore clean default for remaining tests
  setActiveCompanyPadProfile(null);
});

test('Single-sheet Excel exports enforce ISO A4, Company Pad letterhead, repeating print titles, and lossless round-trip', () => {
  const cases: Array<{
    type: 'purchase' | 'packing' | 'payment' | 'other_cost';
    records: any[];
    sheetName: string;
  }> = [
    { type: 'purchase', records: samplePurchases, sheetName: 'Purchases' },
    { type: 'packing', records: samplePackings, sheetName: 'Packing_Lists' },
    { type: 'payment', records: samplePayments, sheetName: 'Payments' },
    { type: 'other_cost', records: sampleCosts, sheetName: 'Other_Costs' },
  ];

  for (const item of cases) {
    const buf = generateSingleSheetWorkbookBuffer(item.type, item.records, initialCompanyProfile);
    const sheetXml = readZipEntryXml(buf, '/xl/worksheets/sheet1.xml');
    const wbXml = readZipEntryXml(buf, '/xl/workbook.xml');

    // Strictly ISO A4 portrait with fitToWidth=1 and pageLayout view
    assert.ok(
      sheetXml.includes(`paperSize="${EXCEL_A4_PAPER_SIZE}"`),
      `${item.type} sheet must set paperSize="9" (ISO A4)`
    );
    assert.ok(sheetXml.includes('orientation="portrait"'), `${item.type} must be portrait`);
    assert.ok(sheetXml.includes('fitToPage="1"'), `${item.type} must enable fitToPage`);
    assert.ok(sheetXml.includes('fitToWidth="1"'), `${item.type} must fit width to 1 A4 page`);
    assert.ok(sheetXml.includes('fitToHeight="0"'), `${item.type} must flow vertically across pages`);
    assert.ok(sheetXml.includes('view="pageLayout"'), `${item.type} must open in Page Layout view`);
    assert.ok(
      sheetXml.includes('<headerFooter>') && sheetXml.includes('ZSB AQUATICS') && sheetXml.includes('Page &amp;P of &amp;N'),
      `${item.type} must include running Company Pad header & Page X of Y footer`
    );

    // Repeating Company Pad letterhead + table header row ($1:$6) on every printed A4 page
    const expectedTitleEndRow = EXCEL_COMPANY_PAD_ROW_COUNT + 1;
    assert.ok(
      wbXml.includes(`name="_xlnm.Print_Titles" localSheetId="0">'${item.sheetName}'!$1:$${expectedTitleEndRow}</definedName>`),
      `${item.type} workbook must repeat rows $1:$${expectedTitleEndRow} on every printed A4 page`
    );

    // Verify 5 merged Company Pad letterhead rows at top of worksheet
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[item.sheetName];
    assert.ok(ws, `Sheet ${item.sheetName} should parse cleanly`);
    assert.equal(ws['A1']?.v, 'ZSB AQUATICS');
    assert.ok(String(ws['A5']?.v || '').includes('OFFICIAL COMPANY PAD (A4)'));
    assert.ok(Array.isArray(ws['!merges']) && ws['!merges'].length >= 5);

    // Verify lossless round-trip import skipping the 5-row Company Pad banner
    const reimported = parseExcelOrCsvBuffer(buf, item.type, 0);
    assert.equal(reimported.success, true, `${item.type} must round-trip cleanly`);
    assert.equal(reimported.records.length, item.records.length, `${item.type} record count must match`);
  }
});

test('Master multi-sheet Excel workbook sets ISO A4 + Company Pad on ALL 4 sheets and round-trips cleanly', () => {
  const masterBuf = generateMasterWorkbookBuffer(
    {
      purchases: samplePurchases,
      packings: samplePackings,
      payments: samplePayments,
      otherCosts: sampleCosts,
    },
    initialCompanyProfile
  );

  const expectedSheets = ['Purchases', 'Packing_Lists', 'Payments', 'Other_Costs'];
  const wbXml = readZipEntryXml(masterBuf, '/xl/workbook.xml');

  expectedSheets.forEach((sheetName, idx) => {
    const sheetXml = readZipEntryXml(masterBuf, `/xl/worksheets/sheet${idx + 1}.xml`);
    assert.ok(sheetXml.includes('paperSize="9"'), `${sheetName} must use ISO A4 paper`);
    assert.ok(sheetXml.includes('orientation="portrait"'), `${sheetName} must be portrait`);
    assert.ok(sheetXml.includes('fitToPage="1"'), `${sheetName} must enable fitToPage`);
    assert.ok(sheetXml.includes('<headerFooter>'), `${sheetName} must have running Company Pad header/footer`);
    assert.ok(
      wbXml.includes(`name="_xlnm.Print_Titles" localSheetId="${idx}">'${sheetName}'!$1:$6</definedName>`),
      `${sheetName} must repeat Company Pad rows $1:$6 on every page`
    );
  });

  const roundTrip = parseMasterWorkbookBuffer(masterBuf);
  assert.equal(roundTrip.purchases.records.length, 1);
  assert.equal(roundTrip.packings.records.length, 1);
  assert.equal(roundTrip.payments.records.length, 1);
  assert.equal(roundTrip.otherCosts.records.length, 1);
  assert.equal(roundTrip.purchases.records[0].description, 'ABDULLAH VAI');
  assert.equal(roundTrip.packings.records[0].shippingMark, 'AAD');
  assert.equal(roundTrip.payments.records[0].invoiceNumber, 'PAY-2026-0101');
  assert.equal(roundTrip.otherCosts.records[0].category, 'Cargo Handling');
});

test('drawPdfCompanyPadFrame renders A4 Company Pad letterhead & Page X of Y on EVERY page of multi-page jsPDF', () => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: false,
  });

  pdf.text('Page 1 Body Content', 20, 60);
  pdf.addPage('a4', 'portrait');
  pdf.text('Page 2 Body Content', 20, 60);
  pdf.addPage('a4', 'portrait');
  pdf.text('Page 3 Body Content', 20, 60);

  const totalPages = pdf.getNumberOfPages();
  assert.equal(totalPages, 3);

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawPdfCompanyPadFrame(pdf, {
      pageNumber: p,
      totalPages,
      profile: initialCompanyProfile,
      documentLabel: 'Test Report',
      exportDateIso: '2026-11-25',
      drawWatermark: false,
    });

    const pageSize = pdf.internal.pageSize;
    assert.ok(Math.abs(pageSize.getWidth() - A4_PAGE_WIDTH_MM) < 0.2, `Page ${p} width must be 210mm (A4)`);
    assert.ok(Math.abs(pageSize.getHeight() - A4_PAGE_HEIGHT_MM) < 0.2, `Page ${p} height must be 297mm (A4)`);
  }

  // Inspect uncompressed PDF page streams directly to confirm Company Pad text appears on EVERY page
  const pagesInternal = (pdf.internal as unknown as { pages: string[][] }).pages;
  for (let p = 1; p <= totalPages; p++) {
    const stream = (pagesInternal[p] || []).join('\n');
    assert.ok(stream.includes('ZSB AQUATICS'), `Page ${p} must show ZSB AQUATICS Company Pad letterhead`);
    assert.ok(stream.includes('OFFICIAL COMPANY PAD'), `Page ${p} must show OFFICIAL COMPANY PAD stamp`);
    assert.ok(stream.includes(`Page ${p} of ${totalPages}`), `Page ${p} must show Page ${p} of ${totalPages}`);
  }
});

test('Multi-page Supplier Reconciliation PDF maintains strict A4 size and Company Pad on every page', () => {
  const manyRows: SupplierRecordHistoryRow[] = Array.from({ length: 85 }, (_, idx) => ({
    id: `hist-${idx + 1}`,
    recordType: 'PURCHASE_BILL',
    date: '2026-11-25',
    supplierName: `SUPPLIER ${String(idx + 1).padStart(2, '0')}`,
    description: `Purchase Bill #${idx + 1}`,
    debitAmount: 10000,
    creditAmount: idx % 2 === 0 ? 5000 : 0,
    balance: (idx + 1) * 5000,
    status: 'PAID',
    invoiceNumber: `INV-2026-${String(idx + 1).padStart(4, '0')}`,
  }));

  const { pdf } = buildSupplierReconciliationPdfDocument({
    companyProfile: initialCompanyProfile,
    supplierFilter: 'ALL',
    fromDate: '2026-11-01',
    toDate: '2026-11-25',
    sortDirection: 'asc',
    rows: manyRows,
    totals: {
      totalDebit: 850000,
      totalCredit: 215000,
      netEndingBalance: 635000,
    },
    todayIso: '2026-11-25',
  });

  const totalPages = pdf.getNumberOfPages();
  assert.ok(totalPages >= 3, `Expected 85-row ledger to paginate into >= 3 A4 pages, got ${totalPages}`);

  const pagesInternal = (pdf.internal as unknown as { pages: string[][] }).pages;
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    const pageSize = pdf.internal.pageSize;
    assert.ok(Math.abs(pageSize.getWidth() - A4_PAGE_WIDTH_MM) < 0.2, `Reconciliation Page ${p} must be A4 width`);
    assert.ok(Math.abs(pageSize.getHeight() - A4_PAGE_HEIGHT_MM) < 0.2, `Reconciliation Page ${p} must be A4 height`);
    const stream = (pagesInternal[p] || []).join('\n');
    assert.ok(stream.includes('ZSB AQUATICS'), `Reconciliation Page ${p} must render Company Pad letterhead`);
    assert.ok(stream.includes('OFFICIAL COMPANY PAD'), `Reconciliation Page ${p} must render Company Pad stamp`);
    assert.ok(stream.includes(`Page ${p} of ${totalPages}`), `Reconciliation Page ${p} must render Page ${p} of ${totalPages}`);
  }
});
