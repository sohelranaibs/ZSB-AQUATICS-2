import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePurchaseForm,
  validatePackingForm,
  validateSupplierPaymentForm,
  validateExporterPaymentForm,
} from './validation.ts';

describe('validatePurchaseForm', () => {
  it('passes when header fields, summary amounts, and active rows are valid', () => {
    const result = validatePurchaseForm({
      invoiceNumber: 'PUR-2026-0005',
      date: '2026-03-15',
      supplierName: 'ABDULLAH VAI',
      overallPreviousAmount: 10000,
      overallPaidAmount: 50000,
      rows: [
        {
          id: '1',
          item: '2F',
          quantity: 120,
          rate: 380,
          totalAmount: 45600,
          previousAmount: 0,
          paidAmount: 0,
          balance: 45600,
        },
        {
          id: '2',
          item: '',
          quantity: 0,
          rate: 0,
          totalAmount: 0,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
      ],
    });

    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.validItems.length, 1);
  });

  it('fails when required header fields are empty or summary amounts are negative', () => {
    const result = validatePurchaseForm({
      invoiceNumber: '   ',
      date: '',
      supplierName: '',
      overallPreviousAmount: -500,
      overallPaidAmount: -100,
      rows: [],
    });

    assert.equal(result.isValid, false);
    assert.ok(result.fieldErrors.invoiceNumber);
    assert.ok(result.fieldErrors.date);
    assert.ok(result.fieldErrors.supplierName);
    assert.ok(result.fieldErrors.overallPreviousAmount);
    assert.ok(result.fieldErrors.overallPaidAmount);
    assert.ok(result.fieldErrors.rows);
  });

  it('flags incomplete rows where item is selected without quantity/rate or vice versa', () => {
    const result = validatePurchaseForm({
      invoiceNumber: 'PUR-2026-0006',
      date: '2026-03-15',
      supplierName: 'BILLAL VAI',
      overallPreviousAmount: 0,
      overallPaidAmount: 0,
      rows: [
        {
          id: '1',
          item: '3F',
          quantity: 0,
          rate: 350,
          totalAmount: 0,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
        {
          id: '2',
          item: '',
          quantity: 50,
          rate: 0,
          totalAmount: 0,
          previousAmount: 0,
          paidAmount: 0,
          balance: 0,
        },
      ],
    });

    assert.equal(result.isValid, false);
    assert.equal(result.rowErrors['1']?.quantity, true);
    assert.equal(result.rowErrors['2']?.item, true);
    assert.equal(result.rowErrors['2']?.rate, true);
  });
});

describe('validatePackingForm', () => {
  it('passes when manifest metadata and at least one complete packing row are valid', () => {
    const result = validatePackingForm({
      invoiceNumber: 'PKG-2026-0004',
      packingDate: '2026-03-15',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      customRmbAmount: '4500.50',
      rows: [
        {
          id: '1',
          item: '2F',
          box: 6,
          weight: 15,
          totalWeight: 90,
          unit: 'KG',
          rate: 420,
          amount: 37800,
        },
      ],
    });

    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.validItems.length, 1);
  });

  it('fails when customRmbAmount is negative or non-numeric or rows are incomplete', () => {
    const result = validatePackingForm({
      invoiceNumber: '',
      packingDate: '',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      customRmbAmount: '-200',
      rows: [
        {
          id: '1',
          item: 'XXL',
          box: 5,
          weight: 0,
          totalWeight: 0,
          unit: 'KG',
          rate: 0,
          amount: 0,
        },
      ],
    });

    assert.equal(result.isValid, false);
    assert.ok(result.fieldErrors.invoiceNumber);
    assert.ok(result.fieldErrors.packingDate);
    assert.ok(result.fieldErrors.customRmbAmount);
    assert.equal(result.rowErrors['1']?.weight, true);
    assert.equal(result.rowErrors['1']?.rate, true);
  });

  it('allows rate = 0 when status is "NO REPORT"', () => {
    const result = validatePackingForm({
      invoiceNumber: 'PKG-2026-0005',
      packingDate: '2026-03-15',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      paymentStatus: 'NO REPORT',
      customRmbAmount: '0',
      rows: [
        {
          id: '1',
          item: '2F',
          box: 4,
          weight: 15,
          totalWeight: 60,
          unit: 'KG',
          rate: 0,
          amount: 0,
        },
      ],
    });

    assert.equal(result.isValid, true);
    assert.equal(result.validItems.length, 1);
    assert.equal(result.validItems[0].rate, 0);
  });

  it('requires rate > 0 when status is "REPORT" or "PAID"', () => {
    const reportZeroRate = validatePackingForm({
      invoiceNumber: 'PKG-2026-0006',
      packingDate: '2026-03-15',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      paymentStatus: 'REPORT',
      customRmbAmount: '0',
      rows: [
        {
          id: '1',
          item: '2F',
          box: 4,
          weight: 15,
          totalWeight: 60,
          unit: 'KG',
          rate: 0,
          amount: 0,
        },
      ],
    });
    assert.equal(reportZeroRate.isValid, false);
    assert.equal(reportZeroRate.rowErrors['1']?.rate, true);

    const paidZeroRate = validatePackingForm({
      invoiceNumber: 'PKG-2026-0007',
      packingDate: '2026-03-15',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      paymentStatus: 'PAID',
      customRmbAmount: '0',
      rows: [
        {
          id: '1',
          item: '2F',
          box: 4,
          weight: 15,
          totalWeight: 60,
          unit: 'KG',
          rate: 0,
          amount: 0,
        },
      ],
    });
    assert.equal(paidZeroRate.isValid, false);
    assert.equal(paidZeroRate.rowErrors['1']?.rate, true);

    const paidPositiveRate = validatePackingForm({
      invoiceNumber: 'PKG-2026-0007',
      packingDate: '2026-03-15',
      shippingMark: 'AAD',
      flight: 'CAN',
      destination: 'GUANGZHOU',
      shipper: 'ZSB AQUATICS',
      paymentStatus: 'PAID',
      customRmbAmount: '0',
      rows: [
        {
          id: '1',
          item: '2F',
          box: 4,
          weight: 15,
          totalWeight: 60,
          unit: 'KG',
          rate: 450,
          amount: 27000,
        },
      ],
    });
    assert.equal(paidPositiveRate.isValid, true);
  });
});

describe('validateSupplierPaymentForm', () => {
  it('passes when supplier header and at least one payment row with description and amount are valid', () => {
    const result = validateSupplierPaymentForm({
      invoiceNumber: 'PAY-2026-0003',
      date: '2026-03-15',
      supplierName: 'ABDULLAH VAI',
      overallPreviousAmount: 85000,
      overallPaidAmount: 60000,
      rows: [
        {
          id: '1',
          description: 'Cash advance',
          debitAmount: 60000,
          creditAmount: 0,
          balance: 60000,
        },
      ],
    });

    assert.equal(result.isValid, true);
    assert.equal(result.validItems.length, 1);
  });

  it('fails when a payment row has description but 0 debit and 0 credit, or amount without description', () => {
    const result = validateSupplierPaymentForm({
      invoiceNumber: 'PAY-2026-0004',
      date: '2026-03-15',
      supplierName: 'ABDULLAH VAI',
      overallPreviousAmount: 0,
      overallPaidAmount: 0,
      rows: [
        {
          id: '1',
          description: 'Description without amount',
          debitAmount: 0,
          creditAmount: 0,
          balance: 0,
        },
        {
          id: '2',
          description: '   ',
          debitAmount: 15000,
          creditAmount: 0,
          balance: 15000,
        },
      ],
    });

    assert.equal(result.isValid, false);
    assert.equal(result.rowErrors['1']?.debitAmount, true);
    assert.equal(result.rowErrors['1']?.creditAmount, true);
    assert.equal(result.rowErrors['2']?.description, true);
  });
});

describe('validateExporterPaymentForm', () => {
  it('passes when exporter fields, non-negative RMB, and settlement rows are valid', () => {
    const result = validateExporterPaymentForm({
      invoiceNumber: 'EXP-PAY-2026-0002',
      date: '2026-03-15',
      shippingMark: 'AAD',
      exporterStatus: 'PAID',
      returnRMB: 7903.03,
      overallPreviousAmount: 130400,
      overallPaidAmount: 130400,
      rows: [
        {
          id: '1',
          description: 'AAD - Export shipment settlement',
          debitAmount: 130400,
          creditAmount: 0,
          balance: 130400,
        },
      ],
    });

    assert.equal(result.isValid, true);
    assert.equal(result.validItems.length, 1);
  });

  it('fails when returnRMB is negative or no rows are filled', () => {
    const result = validateExporterPaymentForm({
      invoiceNumber: '',
      date: '2026-03-15',
      shippingMark: '',
      exporterStatus: 'PAID',
      returnRMB: -100,
      overallPreviousAmount: 0,
      overallPaidAmount: 0,
      rows: [],
    });

    assert.equal(result.isValid, false);
    assert.ok(result.fieldErrors.invoiceNumber);
    assert.ok(result.fieldErrors.shippingMark);
    assert.ok(result.fieldErrors.returnRMB);
    assert.ok(result.fieldErrors.rows);
  });
});
