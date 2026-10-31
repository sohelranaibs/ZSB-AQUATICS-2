import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDatabaseCellValue,
  validateDatabaseRecord,
  summarizeTableValidation,
} from './databaseFieldValidation';

test('validateDatabaseCellValue flags non-numeric input in price/amount columns', () => {
  const invalidPrice = validateDatabaseCellValue('purchase', 'totalAmount', 'abc-invalid');
  assert.equal(invalidPrice.isValid, false);
  assert.match(invalidPrice.errorMessage || '', /expected numeric value/i);

  const negativePrice = validateDatabaseCellValue('purchase', 'totalAmount', '-250');
  assert.equal(negativePrice.isValid, false);
  assert.match(negativePrice.errorMessage || '', /cannot be negative/i);

  const validPrice = validateDatabaseCellValue('purchase', 'totalAmount', '125,000.50');
  assert.equal(validPrice.isValid, true);
  assert.equal(validPrice.parsedValue, 125000.5);
});

test('validateDatabaseCellValue validates optional RMB rate and integer boxes in packing DB', () => {
  const emptyRate = validateDatabaseCellValue('packing', 'rmbRate', '');
  assert.equal(emptyRate.isValid, true);
  assert.equal(emptyRate.parsedValue, undefined);

  const nonNumericRate = validateDatabaseCellValue('packing', 'rmbRate', '16.5xyz');
  assert.equal(nonNumericRate.isValid, false);
  assert.match(nonNumericRate.errorMessage || '', /expected numeric rate/i);

  const decimalBox = validateDatabaseCellValue('packing', 'totalBox', '12.5');
  assert.equal(decimalBox.isValid, false);
  assert.match(decimalBox.errorMessage || '', /expected whole integer/i);

  const validBox = validateDatabaseCellValue('packing', 'totalBox', '40');
  assert.equal(validBox.isValid, true);
  assert.equal(validBox.parsedValue, 40);
});

test('validateDatabaseCellValue validates dates, phone numbers, and required text', () => {
  const badDate = validateDatabaseCellValue('purchase', 'date', '2026-02-30');
  assert.equal(badDate.isValid, false);

  const goodDate = validateDatabaseCellValue('purchase', 'date', '2026-03-15');
  assert.equal(goodDate.isValid, true);

  const badPhone = validateDatabaseCellValue('purchase', 'contactNumber', 'call-me-maybe');
  assert.equal(badPhone.isValid, false);

  const goodPhone = validateDatabaseCellValue('purchase', 'contactNumber', '+880 1711-223344');
  assert.equal(goodPhone.isValid, true);

  const emptySupplier = validateDatabaseCellValue('purchase', 'description', '   ');
  assert.equal(emptySupplier.isValid, false);
});

test('summarizeTableValidation aggregates invalid cells and draft overrides across records', () => {
  const samplePurchases = [
    {
      id: 'p1',
      invoiceNumber: 'INV-2026-0001',
      date: '2026-03-10',
      description: 'Khulna Fish Traders',
      contactNumber: '01711-112233',
      totalQty: 120,
      totalAmount: 180000,
      paidAmount: 100000,
      balance: 80000,
    },
    {
      id: 'p2',
      invoiceNumber: 'INV-2026-0002',
      date: '2026-03-11',
      description: 'Satkhira Aqua Hub',
      contactNumber: '01819-445566',
      totalQty: 95,
      totalAmount: 142500,
      paidAmount: 142500,
      balance: 0,
    },
  ];

  const cleanSummary = summarizeTableValidation('purchase', samplePurchases, {});
  assert.equal(cleanSummary.invalidCellCount, 0);
  assert.equal(cleanSummary.invalidRecordCount, 0);

  const dirtySummary = summarizeTableValidation('purchase', samplePurchases, {
    p1: {
      totalAmount: 'non-numeric-price',
      paidAmount: '-500',
    },
  });
  assert.equal(dirtySummary.invalidCellCount, 2);
  assert.equal(dirtySummary.invalidRecordCount, 1);
  assert.deepEqual(dirtySummary.invalidRecordIds, ['p1']);

  const p1Results = validateDatabaseRecord('purchase', samplePurchases[0], {
    totalAmount: 'non-numeric-price',
  });
  assert.equal(p1Results.totalAmount.isValid, false);
  assert.equal(p1Results.invoiceNumber.isValid, true);
});
