import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitCsvLine,
  parsePurchasesCSV,
  parsePackingsCSV,
  parsePaymentsCSV,
} from './csvParser.ts';

test('splitCsvLine splits comma separated values', () => {
  const line = 'ABDULLAH VAI, 2026-10-21, F1, 100, 320';
  const parts = splitCsvLine(line);
  assert.deepEqual(parts, ['ABDULLAH VAI', '2026-10-21', 'F1', '100', '320']);
});

test('parsePurchasesCSV parses lines and ignores header', () => {
  const csv = `Supplier,Date,Item,Quantity,Rate,PreviousAmount,PaidAmount
UZZAL VAI, 2026-10-21, 2F, 50, 400, 5000, 20000
NAPAL VAI, 2026-10-21, FF1, 30, 450, 0, 13500`;

  const result = parsePurchasesCSV(csv, 10);
  assert.equal(result.success, true);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].description, 'UZZAL VAI');
  assert.equal(result.records[0].totalQty, 50);
  assert.equal(result.records[0].totalAmount, 20000); // 50 * 400
  assert.equal(result.records[1].description, 'NAPAL VAI');
  assert.equal(result.records[1].totalAmount, 13500); // 30 * 450
});

test('parsePackingsCSV parses packing records and calculates weight & amount', () => {
  const csv = `ShippingMark,Flight,Destination,Shipper,Date,Item,Box,Weight,Rate
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-21, 2F, 4, 15, 300
CHJ-22, YG CAN, KUNMING, SAJID INT., 2026-10-21, XXL, 2, 16, 500`;

  const result = parsePackingsCSV(csv, 5);
  assert.equal(result.success, true);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].shippingMark, 'AAD');
  assert.equal(result.records[0].totalWeight, 60); // 4 * 15
  assert.equal(result.records[0].totalAmount, 18000); // 60 * 300
  assert.equal(result.records[1].shippingMark, 'CHJ-22');
  assert.equal(result.records[1].totalWeight, 32); // 2 * 16
  assert.equal(result.records[1].totalAmount, 16000); // 32 * 500
});

test('parsePackingsCSV merges items with same ShippingMark, Flight, Destination, Shipper, and Date into 1 invoice and packing number', () => {
  const csv = `ShippingMark,Flight,Destination,Shipper,Date,Item,Box,Weight,Rate
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-21, 2F, 8, 15, 420
aad, can, guangzhou, zsb aquatics, 2026-10-21, 3F, 6, 14, 400
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-21, XXL, 5, 16, 580
CHJ-22, YG CAN, KUNMING, SAJID INT., 2026-10-21, 4F, 7, 15, 390
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-22, 2F, 10, 15, 410`;

  const result = parsePackingsCSV(csv, 0);
  assert.equal(result.success, true);
  assert.equal(result.totalParsedRows, 5);
  // 3 rows for AAD on 2026-10-21 merge into 1 record; CHJ-22 on 2026-10-21 is 1 record; AAD on 2026-10-22 is 1 record => 3 total invoices
  assert.equal(result.records.length, 3);

  const firstMerged = result.records[0];
  assert.equal(firstMerged.invoiceNumber, 'PKG-2026-0001');
  assert.equal(firstMerged.shippingMark, 'AAD');
  assert.equal(firstMerged.flight, 'CAN');
  assert.equal(firstMerged.destination, 'GUANGZHOU');
  assert.equal(firstMerged.shipper, 'ZSB AQUATICS');
  assert.equal(firstMerged.packingDate, '2026-10-21');
  assert.equal(firstMerged.items.length, 3);
  assert.deepEqual(
    firstMerged.items.map((it) => it.item),
    ['2F', '3F', 'XXL']
  );
  // Total box: 8 + 6 + 5 = 19
  assert.equal(firstMerged.totalBox, 19);
  // Total weight: (8*15=120) + (6*14=84) + (5*16=80) = 284
  assert.equal(firstMerged.totalWeight, 284);
  // Total amount: (120*420=50400) + (84*400=33600) + (80*580=46400) = 130400
  assert.equal(firstMerged.totalAmount, 130400);

  // Second group gets sequential invoice number PKG-2026-0002
  assert.equal(result.records[1].invoiceNumber, 'PKG-2026-0002');
  assert.equal(result.records[1].shippingMark, 'CHJ-22');
  assert.equal(result.records[1].items.length, 1);

  // Third group (same mark/flight/dest/shipper but different date 2026-10-22) gets PKG-2026-0003
  assert.equal(result.records[2].invoiceNumber, 'PKG-2026-0003');
  assert.equal(result.records[2].packingDate, '2026-10-22');
  assert.equal(result.records[2].items.length, 1);
});

test('parsePaymentsCSV parses payment records', () => {
  const csv = `Party,Date,Debit,Credit,Status,ReturnRMB
ABDULLAH VAI, 2026-10-21, 50000, 0, PAID, 2500`;

  const result = parsePaymentsCSV(csv, 2);
  assert.equal(result.success, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].description, 'ABDULLAH VAI');
  assert.equal(result.records[0].totalAmount, 50000);
  assert.equal(result.records[0].status, 'PAID');
  assert.equal(result.records[0].returnRMB, 2500);
});

test('parsePurchasesCSV and parsePaymentsCSV accept numeric names, blanks, negatives, literal formulas, and text amounts leaving calculations pending', () => {
  const purchaseCsv = [
    'Supplier,Date,Item,Quantity,Rate,PreviousAmount,PaidAmount',
    '1042, 2026-10-29, FF1, 40, TBD, , -500',
    '1042, 2026-10-29, F1, =SUM(D2:D3), 300, 1000, 0',
  ].join('\n');

  const pRes = parsePurchasesCSV(purchaseCsv, 0);
  assert.equal(pRes.success, true);
  assert.equal(pRes.records.length, 1);
  const pRec = pRes.records[0];
  assert.ok(pRec.invoiceNumber.startsWith('INV-'));
  assert.equal(pRec.description, '1042');
  assert.equal(pRec.calculationPending, true);
  assert.equal(pRec.paidAmount, -500);
  assert.equal(pRec.rawValues?.['item0_rate'], 'TBD');
  assert.equal(pRec.rawValues?.['item1_quantity'], '=SUM(D2:D3)');

  const payCsv = [
    'InvoiceNumber,Party,Date,Debit,Credit,Status,ReturnRMB',
    ', 8844, 2026-10-29, =A1+B1, -250, PENDING, TBD',
  ].join('\n');
  const payRes = parsePaymentsCSV(payCsv, 0);
  assert.equal(payRes.success, true);
  assert.equal(payRes.records.length, 1);
  assert.equal(payRes.records[0].description, '8844');
  assert.equal(payRes.records[0].calculationPending, true);
  assert.equal(payRes.records[0].rawValues?.['debitAmount'], '=A1+B1');
  assert.equal(payRes.records[0].rawValues?.['returnRMB'], 'TBD');
  assert.equal(payRes.records[0].paidAmount, -250);
});

test('parsePackingsCSV and parsePaymentsCSV preserve formula dates, blank marks, creditAmount text, and explicit PackingNo alongside formula RmbRate', () => {
  const pkgCsv = [
    'ShippingMark,Flight,Destination,Shipper,Date,Item,Box,Weight,Rate,RmbRate,PackingNo',
    ', =C2, , 7788, =TODAY(), 2F, -1, 15, TBD, =D2*16.5, PKG-2026-0500',
  ].join('\n');
  const pkgRes = parsePackingsCSV(pkgCsv, 0);
  assert.equal(pkgRes.success, true);
  assert.equal(pkgRes.records.length, 1);
  assert.equal(pkgRes.records[0].invoiceNumber, 'PKG-2026-0500');
  assert.equal(pkgRes.records[0].shipper, '7788');
  assert.equal(pkgRes.records[0].totalBox, -1);
  assert.equal(pkgRes.records[0].calculationPending, true);
  assert.equal(pkgRes.records[0].rawValues?.flight, '=C2');
  assert.equal(pkgRes.records[0].rawValues?.packingDate, '=TODAY()');
  assert.equal(pkgRes.records[0].rawValues?.rmbRate, '=D2*16.5');

  const payCsv = [
    'InvoiceNumber,Party,Date,Debit,Credit,Status,ReturnRMB,ExportRef',
    'PAY-2026-0888, 9001, =TODAY(), 1000, pending-credit, =E2, 0, =F2',
  ].join('\n');
  const payRes = parsePaymentsCSV(payCsv, 0);
  assert.equal(payRes.success, true);
  assert.equal(payRes.records[0].invoiceNumber, 'PAY-2026-0888');
  assert.equal(payRes.records[0].calculationPending, true);
  assert.equal(payRes.records[0].rawValues?.creditAmount, 'pending-credit');
  assert.equal(payRes.records[0].rawValues?.balance, 'pending-credit');
  assert.equal(payRes.records[0].rawValues?.date, '=TODAY()');
  assert.equal(payRes.records[0].rawValues?.status, '=E2');
  assert.equal(payRes.records[0].rawValues?.exportGoodsRef, '=F2');
});


