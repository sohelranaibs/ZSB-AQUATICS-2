import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplierReconciliationPdfDocument,
  buildSupplierReconciliationPdfPayload,
} from './supplierReconciliationPdf';
import { CompanyProfile } from '../types/index';
import { SupplierRecordHistoryRow } from './supplierHistory';

const MOCK_PROFILE: CompanyProfile = {
  companyName: 'ZSB AQUATICS',
  address: '29/B, Tarartek, Nolvog, Turag, Dhaka - 1230',
  mobiles: ['+8801671036114'],
  email: 'zsbaquatics@gmail.com',
  managingPartner: 'Md. Mizanur Rahman',
  partner: 'Md. Sohel Rana',
  currency: 'TK',
  rmbExchangeRate: 16.5,
};

const SAMPLE_ROWS: SupplierRecordHistoryRow[] = [
  {
    id: 'row-1',
    recordType: 'PURCHASE_BILL',
    invoiceNumber: 'INV-2026-0719',
    date: '2026-07-19',
    supplierName: 'KABIR VAI',
    description: 'Live Eel Supply',
    debitAmount: 76000,
    creditAmount: 60000,
    balance: 16000,
    status: 'REPORT',
  },
  {
    id: 'row-2',
    recordType: 'PAYMENT_VOUCHER',
    invoiceNumber: 'PAY-2026-0720',
    date: '2026-07-20',
    supplierName: 'KABIR VAI',
    description: 'Settlement',
    debitAmount: 0,
    creditAmount: 16000,
    balance: 0,
    status: 'PAID',
  },
];

test('buildSupplierReconciliationPdfPayload formats filename, metadata, and rows accurately', () => {
  const payload = buildSupplierReconciliationPdfPayload({
    companyProfile: MOCK_PROFILE,
    supplierFilter: 'KABIR VAI',
    fromDate: '2026-07-01',
    toDate: '2026-07-31',
    sortDirection: 'asc',
    rows: SAMPLE_ROWS,
    totals: {
      totalDebit: 76000,
      totalCredit: 76000,
      netEndingBalance: 0,
    },
    todayIso: '2026-11-17',
  });

  assert.equal(
    payload.filename,
    'ZSB_AQUATICS_SUPPLIER_RECONCILIATION_LEDGER_KABIR_VAI_2026-07-01_to_2026-07-31.pdf'
  );
  assert.equal(payload.supplierLabel, 'KABIR VAI');
  assert.equal(payload.periodLabel, '01/07/2026 -> 31/07/2026');
  assert.equal(payload.orderLabel, 'Oldest First (2)');
  assert.equal(payload.entryCount, 2);
  assert.equal(payload.rows[0].sl, '01');
  assert.equal(payload.rows[0].dateFormatted, '19-Jul-2026');
  assert.equal(payload.rows[0].debitFormatted, '76,000.00');
  assert.equal(payload.rows[1].debitFormatted, '');
  assert.equal(payload.netBalanceFormatted, 'TK 0.00');
});

test('buildSupplierReconciliationPdfDocument generates multi-page vector PDF quickly for large ledgers', () => {
  const manyRows: SupplierRecordHistoryRow[] = Array.from({ length: 85 }, (_, i) => ({
    id: `row-${i + 1}`,
    recordType: 'PURCHASE_BILL',
    invoiceNumber: `INV-2026-${String(i + 1).padStart(4, '0')}`,
    date: '2026-10-01',
    supplierName: `SUPPLIER ${i + 1}`,
    description: 'Supply',
    debitAmount: 50000,
    creditAmount: 40000,
    balance: (i + 1) * 10000,
    status: 'REPORT',
  }));

  const t0 = performance.now();
  const { pdf, payload } = buildSupplierReconciliationPdfDocument({
    companyProfile: MOCK_PROFILE,
    supplierFilter: 'ALL',
    fromDate: '',
    toDate: '',
    sortDirection: 'desc',
    rows: manyRows,
    totals: {
      totalDebit: 85 * 50000,
      totalCredit: 85 * 40000,
      netEndingBalance: 85 * 10000,
    },
    todayIso: '2026-11-17',
  });
  const elapsedMs = performance.now() - t0;

  assert.equal(payload.entryCount, 85);
  assert.ok(pdf.getNumberOfPages() >= 2, 'Expected multi-page vector pagination for 85 rows');
  assert.ok(elapsedMs < 1000, `Expected fast vector generation (<1000ms), got ${elapsedMs}ms`);
});
