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
