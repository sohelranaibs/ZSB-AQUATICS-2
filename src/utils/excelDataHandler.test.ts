import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSingleSheetWorkbookBuffer,
  generateMasterWorkbookBuffer,
  parseExcelOrCsvBuffer,
  parseMasterWorkbookBuffer,
  parseSmartTextData,
  generateOtherCostsCSV,
} from './excelDataHandler.ts';
import {
  generatePurchasesCSV,
  generatePackingsCSV,
  generatePaymentsCSV,
} from './csvExporter.ts';
import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

const samplePurchases: PurchaseRecord[] = [
  {
    id: 'pur-1',
    invoiceNumber: 'PUR-2026-0001',
    date: '2026-10-20',
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
    paidAmount: 30000,
    balance: 20000,
    remarks: 'Fresh batch',
    createdAt: '2026-10-20T10:00:00Z',
  },
];

const samplePackings: PackingRecord[] = [
  {
    id: 'pkg-1',
    invoiceNumber: 'PKG-2026-0001',
    shippingMark: 'AAD',
    flight: 'CAN',
    destination: 'GUANGZHOU',
    shipper: 'ZSB AQUATICS',
    packingDate: '2026-10-21',
    fromDate: '2026-10-21',
    toDate: '2026-10-21',
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
    rmbRate: 16.5,
    totalAmountBDT: 990000,
    paymentStatus: 'PAID',
    remarks: 'Air cargo',
    createdAt: '2026-10-21T10:00:00Z',
  },
];

const samplePayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceNumber: 'PAY-2026-0001',
    date: '2026-10-22',
    description: 'ABDULLAH VAI',
    contactNumber: '+8801711223344',
    items: [
      {
        id: 'pyi-1',
        description: 'Payment for ABDULLAH VAI',
        debitAmount: 50000,
        creditAmount: 10000,
        balance: 40000,
      },
    ],
    totalAmount: 50000,
    previousAmount: 50000,
    paidAmount: 40000,
    balance: 10000,
    status: 'PAID',
    returnRMB: 3000,
    returnRMBInBDT: 49500,
    exportGoodsRef: 'PKG-2026-0001',
    paymentCategory: 'exporter',
    remarks: 'Settled',
    createdAt: '2026-10-22T10:00:00Z',
  },
];

const sampleCosts: OtherCostRecord[] = [
  {
    id: 'cost-1',
    date: '2026-10-22',
    category: 'AIR FREIGHT / CARGO BILL',
    amount: 15000,
    description: 'Airport handling',
    refInvoice: 'PKG-2026-0001',
    createdAt: '2026-10-22T11:00:00Z',
  },
];

test('Excel single-sheet round-trip export and import for Purchases, Packings, Payments, and Other Costs', () => {
  // 1. Purchases round-trip .xlsx
  const purBuf = generateSingleSheetWorkbookBuffer('purchase', samplePurchases);
  assert.ok(purBuf.byteLength > 0);
  const parsedPur = parseExcelOrCsvBuffer(purBuf, 'purchase', 0);
  assert.equal(parsedPur.success, true);
  assert.equal(parsedPur.records.length, 1);
  assert.equal(parsedPur.records[0].invoiceNumber, 'PUR-2026-0001');
  assert.equal(parsedPur.records[0].description, 'ABDULLAH VAI');
  assert.equal(parsedPur.records[0].totalQty, 100);
  assert.equal(parsedPur.records[0].totalAmount, 45000);
  assert.equal(parsedPur.records[0].balance, 20000);

  // 2. Packings round-trip .xlsx
  const pkgBuf = generateSingleSheetWorkbookBuffer('packing', samplePackings);
  const parsedPkg = parseExcelOrCsvBuffer(pkgBuf, 'packing', 0);
  assert.equal(parsedPkg.success, true);
  assert.equal(parsedPkg.records.length, 1);
  assert.equal(parsedPkg.records[0].invoiceNumber, 'PKG-2026-0001');
  assert.equal(parsedPkg.records[0].shippingMark, 'AAD');
  assert.equal(parsedPkg.records[0].totalBox, 10);
  assert.equal(parsedPkg.records[0].totalWeight, 150);
  assert.equal(parsedPkg.records[0].totalAmount, 60000);
  assert.equal(parsedPkg.records[0].rmbRate, 16.5);

  // 3. Payments round-trip .xlsx
  const payBuf = generateSingleSheetWorkbookBuffer('payment', samplePayments);
  const parsedPay = parseExcelOrCsvBuffer(payBuf, 'payment', 0);
  assert.equal(parsedPay.success, true);
  assert.equal(parsedPay.records.length, 1);
  assert.equal(parsedPay.records[0].invoiceNumber, 'PAY-2026-0001');
  assert.equal(parsedPay.records[0].description, 'ABDULLAH VAI');
  assert.equal(parsedPay.records[0].totalAmount, 50000);
  assert.equal(parsedPay.records[0].returnRMB, 3000);

  // 4. Other Costs round-trip .xlsx
  const costBuf = generateSingleSheetWorkbookBuffer('other_cost', sampleCosts);
  const parsedCost = parseExcelOrCsvBuffer(costBuf, 'other_cost', 0);
  assert.equal(parsedCost.success, true);
  assert.equal(parsedCost.records.length, 1);
  assert.equal(parsedCost.records[0].category, 'AIR FREIGHT / CARGO BILL');
  assert.equal(parsedCost.records[0].amount, 15000);
});

test('Master multi-sheet Excel workbook round-trip export and import', () => {
  const masterBuf = generateMasterWorkbookBuffer({
    purchases: samplePurchases,
    packings: samplePackings,
    payments: samplePayments,
    otherCosts: sampleCosts,
  });

  const multiResult = parseMasterWorkbookBuffer(masterBuf);
  assert.deepEqual(multiResult.detectedSheets, [
    'Purchases',
    'Packing_Lists',
    'Payments',
    'Other_Costs',
  ]);
  assert.equal(multiResult.purchases.records.length, 1);
  assert.equal(multiResult.packings.records.length, 1);
  assert.equal(multiResult.payments.records.length, 1);
  assert.equal(multiResult.otherCosts.records.length, 1);
});

test('CSV round-trip export and import via parseSmartTextData', () => {
  const purCsv = generatePurchasesCSV(samplePurchases);
  const parsedPur = parseSmartTextData('purchase', purCsv, 0);
  assert.equal(parsedPur.success, true);
  assert.equal(parsedPur.records.length, 1);
  assert.equal(parsedPur.records[0].invoiceNumber, 'PUR-2026-0001');
  assert.equal(parsedPur.records[0].totalAmount, 45000);

  const pkgCsv = generatePackingsCSV(samplePackings);
  const parsedPkg = parseSmartTextData('packing', pkgCsv, 0);
  assert.equal(parsedPkg.success, true);
  assert.equal(parsedPkg.records.length, 1);
  assert.equal(parsedPkg.records[0].shippingMark, 'AAD');
  assert.equal(parsedPkg.records[0].totalAmount, 60000);

  const payCsv = generatePaymentsCSV(samplePayments);
  const parsedPay = parseSmartTextData('payment', payCsv, 0);
  assert.equal(parsedPay.success, true);
  assert.equal(parsedPay.records.length, 1);
  assert.equal(parsedPay.records[0].invoiceNumber, 'PAY-2026-0001');

  const costCsv = generateOtherCostsCSV(sampleCosts);
  const parsedCost = parseSmartTextData('other_cost', costCsv, 0);
  assert.equal(parsedCost.success, true);
  assert.equal(parsedCost.records.length, 1);
  assert.equal(parsedCost.records[0].amount, 15000);
});

test('Tab-separated Excel copy-paste lines parse accurately', () => {
  const tsv = `Supplier\tDate\tItem\tQuantity\tRate\tPreviousAmount\tPaidAmount\nUZZAL VAI\t2026-10-25\tF1\t80\t350\t0\t28000`;
  const parsed = parseSmartTextData('purchase', tsv, 0);
  assert.equal(parsed.success, true);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].description, 'UZZAL VAI');
  assert.equal(parsed.records[0].totalQty, 80);
  assert.equal(parsed.records[0].totalAmount, 28000);
});

test('Excel and CSV import merges packing rows with same ShippingMark, Flight, Destination, Shipper, and Date into 1 invoice and packing number', () => {
  const headerMappedCsv = [
    'Shipping Mark,Flight,Destination,Shipper,Date,Item,Box,Weight Per Box (KG),Rate (RMB),RMB Rate',
    'AAD,CAN,GUANGZHOU,ZSB AQUATICS,2026-10-25,2F,10,15,400,16.5',
    'AAD,CAN,GUANGZHOU,ZSB AQUATICS,2026-10-25,3F,5,14,380,16.5',
    'AAD,CAN,GUANGZHOU,ZSB AQUATICS,2026-10-25,XXL,4,16,550,16.5',
    'ROE,MU KMG,XIAMEN,RIK INTERNATIONAL,2026-10-25,4F,8,15,360,16.5',
  ].join('\n');

  const parsed = parseSmartTextData('packing', headerMappedCsv, 10);
  assert.equal(parsed.success, true);
  assert.equal(parsed.totalParsedRows, 4);
  assert.equal(parsed.records.length, 2);

  const mergedAad = parsed.records[0];
  assert.equal(mergedAad.invoiceNumber, 'PKG-2026-0011');
  assert.equal(mergedAad.shippingMark, 'AAD');
  assert.equal(mergedAad.flight, 'CAN');
  assert.equal(mergedAad.destination, 'GUANGZHOU');
  assert.equal(mergedAad.shipper, 'ZSB AQUATICS');
  assert.equal(mergedAad.packingDate, '2026-10-25');
  assert.equal(mergedAad.items.length, 3);
  // Total Box: 10 + 5 + 4 = 19
  assert.equal(mergedAad.totalBox, 19);
  // Total Weight: 150 + 70 + 64 = 284 KG
  assert.equal(mergedAad.totalWeight, 284);
  // Total Amount (RMB): 60000 + 26600 + 35200 = 121800
  assert.equal(mergedAad.totalAmount, 121800);
  // Total Amount (BDT): 121800 * 16.5 = 2009700
  assert.equal(mergedAad.totalAmountBDT, 2009700);

  const roeRecord = parsed.records[1];
  assert.equal(roeRecord.invoiceNumber, 'PKG-2026-0012');
  assert.equal(roeRecord.shippingMark, 'ROE');
  assert.equal(roeRecord.items.length, 1);

  // Round-trip export and re-import of merged multi-item PackingRecord preserves all merged items
  const exportedXlsx = generateSingleSheetWorkbookBuffer('packing', [
    {
      ...mergedAad,
      id: 'pkg-merged-1',
      createdAt: '2026-10-25T10:00:00Z',
    },
  ]);
  const reimported = parseExcelOrCsvBuffer(exportedXlsx, 'packing', 0);
  assert.equal(reimported.success, true);
  assert.equal(reimported.records.length, 1);
  assert.equal(reimported.records[0].invoiceNumber, 'PKG-2026-0011');
  assert.equal(reimported.records[0].items.length, 3);
  assert.equal(reimported.records[0].totalBox, 19);
  assert.equal(reimported.records[0].totalWeight, 284);
  assert.equal(reimported.records[0].totalAmount, 121800);
});

