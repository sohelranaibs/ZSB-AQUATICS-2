import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBatchPaymentSlipsPdfFilename,
  buildBatchPaymentSlipSummary,
  preparePaymentRecordsForBatchExport,
} from './batchPaymentSlipPdf.ts';
import { PaymentRecord } from '../types/index.ts';

const mockPayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceNumber: 'PAY-2026-001',
    date: '2026-10-10',
    description: 'Satkhira Live Crab Fishery',
    contactNumber: '+880 1711-223344',
    items: [
      {
        id: 'item-1',
        description: 'XL Mud Crabs Consignment Batch',
        debitAmount: 120000,
        creditAmount: 100000,
        balance: 20000,
      },
    ],
    totalAmount: 120000,
    previousAmount: 0,
    paidAmount: 100000,
    balance: 20000,
    status: 'PAID',
    returnRMB: 0,
    paymentCategory: 'supplier',
    createdAt: '2026-10-10T10:00:00Z',
  },
  {
    id: 'pay-2',
    invoiceNumber: 'PAY-2026-002',
    date: '2026-10-15',
    description: 'Khulna Eel Fish Suppliers',
    contactNumber: '+880 1819-334455',
    items: [],
    totalAmount: 85000,
    previousAmount: 0,
    paidAmount: 85000,
    balance: 0,
    status: 'PAID',
    returnRMB: 0,
    paymentCategory: 'supplier',
    createdAt: '2026-10-15T12:00:00Z',
  },
  {
    id: 'pay-3',
    invoiceNumber: 'EXP-PAY-001',
    date: '2026-10-18',
    description: 'AAD - Guangzhou Aquatic Import Ltd',
    contactNumber: '+86 138-0013-8000',
    items: [
      {
        id: 'exp-item-1',
        description: 'Flight CZ392 Live Crabs Consignment',
        debitAmount: 15000,
        creditAmount: 15000,
        balance: 0,
        status: 'PAID',
      },
    ],
    totalAmount: 15000,
    previousAmount: 0,
    paidAmount: 15000,
    balance: 0,
    status: 'PAID',
    returnRMB: 15000,
    paymentCategory: 'exporter',
    shippingMark: 'AAD',
    createdAt: '2026-10-18T14:00:00Z',
  },
];

test('formatBatchPaymentSlipsPdfFilename produces clean sanitized filenames', () => {
  const filenameAll = formatBatchPaymentSlipsPdfFilename(3, 'all', '2026-10-29');
  assert.equal(filenameAll, 'ZSB_Aquatics_Batch_Payment_Slips_3_Slips_2026-10-29.pdf');

  const filenameSupplier = formatBatchPaymentSlipsPdfFilename(1, 'supplier', '2026-10-29');
  assert.equal(filenameSupplier, 'ZSB_Aquatics_Supplier_Payment_Slips_1_Slip_2026-10-29.pdf');

  const filenameExporter = formatBatchPaymentSlipsPdfFilename(5, 'exporter', '2026-10-29');
  assert.equal(filenameExporter, 'ZSB_Aquatics_Exporter_Payment_Slips_5_Slips_2026-10-29.pdf');
});

test('buildBatchPaymentSlipSummary separates supplier BDT and exporter RMB totals correctly', () => {
  const summary = buildBatchPaymentSlipSummary(mockPayments);
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.supplierCount, 2);
  assert.equal(summary.exporterCount, 1);

  // Supplier totals (BDT)
  assert.equal(summary.totalDebitBDT, 205000); // 120000 + 85000
  assert.equal(summary.totalCreditBDT, 185000); // 100000 + 85000
  assert.equal(summary.totalBalanceBDT, 20000); // 20000 + 0

  // Exporter totals (RMB)
  assert.equal(summary.totalDebitRMB, 15000);
  assert.equal(summary.totalCreditRMB, 15000);
  assert.equal(summary.totalBalanceRMB, 0);
});

test('preparePaymentRecordsForBatchExport filters records matching selected IDs', () => {
  const selected = preparePaymentRecordsForBatchExport(mockPayments, ['pay-1', 'pay-3']);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].id, 'pay-1');
  assert.equal(selected[1].id, 'pay-3');

  const empty = preparePaymentRecordsForBatchExport(mockPayments, []);
  assert.equal(empty.length, 0);
});
