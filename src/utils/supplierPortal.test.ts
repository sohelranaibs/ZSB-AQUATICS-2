import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SupplierPortalCredential,
  SUPPLIER_PORTAL_GENERIC_AUTH_ERROR,
  normalizeSupplierPortalName,
  hashSupplierPassword,
  verifySupplierPassword,
  validateSupplierPortalPasswordInput,
  upsertSupplierPortalCredential,
  toggleSupplierPortalCredentialStatus,
  removeSupplierPortalCredential,
  authenticateSupplierPortal,
  getSupplierPortalStatement,
  getSupplierInvoiceById,
  getSupplierPaymentVoucherById,
  generateSupplierStatementCSV,
  collectKnownSupplierNames,
  formatSupplierStatementPdfFilename,
  formatSupplierInvoicePdfFilename,
  formatSupplierReceiptPdfFilename,
} from './supplierPortal.ts';
import { PurchaseRecord, PaymentRecord, SupplierCreditRecord } from '../types/index.ts';

const samplePurchases: PurchaseRecord[] = [
  {
    id: 'pur-1',
    invoiceNumber: 'PUR-2026-0001',
    date: '2026-10-01',
    description: 'RAHIM FISHERIES',
    contactNumber: '+8801711000001',
    items: [
      {
        id: 'row-1',
        item: 'FF1',
        quantity: 100,
        rate: 1200,
        totalAmount: 120000,
        previousAmount: 0,
        paidAmount: 50000,
        balance: 70000,
      },
    ],
    totalQty: 100,
    totalAmount: 120000,
    previousAmount: 0,
    paidAmount: 50000,
    balance: 70000,
    status: 'UNPAID',
    remarks: 'First consignment',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'pur-2',
    invoiceNumber: 'PUR-2026-0002',
    date: '2026-10-05',
    description: 'KARIM AQUA',
    contactNumber: '+8801711000002',
    items: [
      {
        id: 'row-2',
        item: 'F1',
        quantity: 80,
        rate: 1000,
        totalAmount: 80000,
        previousAmount: 0,
        paidAmount: 80000,
        balance: 0,
      },
    ],
    totalQty: 80,
    totalAmount: 80000,
    previousAmount: 0,
    paidAmount: 80000,
    balance: 0,
    status: 'PAID',
    remarks: 'Secret competitor bill',
    createdAt: '2026-10-05T08:00:00.000Z',
  },
];

const samplePayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceNumber: 'PAY-2026-0001',
    date: '2026-10-03',
    description: 'RAHIM FISHERIES',
    contactNumber: '+8801711000001',
    items: [
      {
        id: 'p-item-1',
        description: 'Bank Transfer Settlement',
        debitAmount: 0,
        creditAmount: 40000,
        balance: -40000,
      },
    ],
    totalAmount: 0,
    previousAmount: 70000,
    paidAmount: 40000,
    balance: 30000,
    status: 'PAID',
    returnRMB: 0,
    paymentCategory: 'supplier',
    remarks: 'Partial payment via City Bank',
    createdAt: '2026-10-03T10:00:00.000Z',
  },
  {
    id: 'pay-2',
    invoiceNumber: 'PAY-2026-0002',
    date: '2026-10-06',
    description: 'KARIM AQUA',
    contactNumber: '+8801711000002',
    items: [],
    totalAmount: 0,
    previousAmount: 0,
    paidAmount: 25000,
    balance: 0,
    status: 'PAID',
    returnRMB: 0,
    paymentCategory: 'supplier',
    remarks: 'Competitor payment',
    createdAt: '2026-10-06T10:00:00.000Z',
  },
];

const sampleCredits: SupplierCreditRecord[] = [
  {
    id: 'cr-1',
    creditNoteNumber: 'CN-2026-0001',
    date: '2026-10-04',
    supplierName: 'RAHIM FISHERIES',
    refPurchaseInvoice: 'PUR-2026-0001',
    reason: 'Weight Shortage / Shrinkage',
    amount: 5000,
    appliedAmount: 5000,
    remainingAmount: 0,
    status: 'APPLIED',
    applications: [],
    remarks: '2 kg dead loss',
    createdAt: '2026-10-04T09:00:00.000Z',
  },
];

test('normalizeSupplierPortalName trims, collapses whitespace, and lowercases', () => {
  assert.equal(normalizeSupplierPortalName('  Rahim   Fisheries  '), 'rahim fisheries');
  assert.equal(normalizeSupplierPortalName(''), '');
});

test('hashSupplierPassword uses unique random salts and verifies accurately', async () => {
  const h1 = await hashSupplierPassword('secret123');
  const h2 = await hashSupplierPassword('secret123');

  assert.notEqual(h1.salt, h2.salt);
  assert.notEqual(h1.hash, h2.hash);
  assert.equal(h1.hash.length, 64);
  assert.ok(!h1.hash.includes('secret123'));

  const cred: SupplierPortalCredential = {
    id: 'c-1',
    supplierName: 'RAHIM FISHERIES',
    normalizedName: 'rahim fisheries',
    passwordHash: h1.hash,
    salt: h1.salt,
    algorithm: h1.algorithm,
    iterations: h1.iterations,
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: 'Admin',
  };

  assert.equal(await verifySupplierPassword('secret123', cred), true);
  assert.equal(await verifySupplierPassword('wrongpass', cred), false);
});

test('validateSupplierPortalPasswordInput enforces required fields and min length', () => {
  assert.equal(validateSupplierPortalPasswordInput('', '1234').valid, false);
  assert.equal(validateSupplierPortalPasswordInput('RAHIM FISHERIES', '123').valid, false);
  assert.equal(validateSupplierPortalPasswordInput('RAHIM FISHERIES', '1234').valid, true);
});

test('upsert, authenticate, toggle inactive, and remove supplier portal credentials', async () => {
  const { updatedList, credential, isUpdate } = await upsertSupplierPortalCredential([], {
    supplierName: 'RAHIM FISHERIES',
    password: 'rahim-pass-2026',
    updatedBy: 'Super Admin',
  });

  assert.equal(isUpdate, false);
  assert.equal(updatedList.length, 1);
  assert.equal(credential.supplierName, 'RAHIM FISHERIES');

  // Valid login (case-insensitive supplier name)
  const okRes = await authenticateSupplierPortal('rahim fisheries', 'rahim-pass-2026', updatedList);
  assert.equal(okRes.valid, true);
  if (okRes.valid) {
    assert.equal(okRes.session.supplierName, 'RAHIM FISHERIES');
  }

  // Wrong password returns generic error
  const wrongPwdRes = await authenticateSupplierPortal('RAHIM FISHERIES', 'bad-pass', updatedList);
  assert.equal(wrongPwdRes.valid, false);
  if (!wrongPwdRes.valid) {
    assert.equal(wrongPwdRes.error, SUPPLIER_PORTAL_GENERIC_AUTH_ERROR);
  }

  // Unknown supplier returns identical generic error (prevents enumeration)
  const unknownSupRes = await authenticateSupplierPortal('UNKNOWN SUPPLIER', 'rahim-pass-2026', updatedList);
  assert.equal(unknownSupRes.valid, false);
  if (!unknownSupRes.valid) {
    assert.equal(unknownSupRes.error, SUPPLIER_PORTAL_GENERIC_AUTH_ERROR);
  }

  // Disabled credential cannot sign in
  const disabledList = toggleSupplierPortalCredentialStatus(updatedList, credential.id, 'Super Admin');
  assert.equal(disabledList[0].active, false);
  const disabledAuth = await authenticateSupplierPortal('RAHIM FISHERIES', 'rahim-pass-2026', disabledList);
  assert.equal(disabledAuth.valid, false);

  // Updating password re-enables and rotates salt/hash
  const rotated = await upsertSupplierPortalCredential(disabledList, {
    supplierName: 'RAHIM FISHERIES',
    password: 'new-password-99',
    updatedBy: 'Super Admin',
  });
  assert.equal(rotated.isUpdate, true);
  assert.equal(rotated.updatedList.length, 1);
  assert.equal(rotated.credential.active, true);
  assert.equal((await authenticateSupplierPortal('RAHIM FISHERIES', 'rahim-pass-2026', rotated.updatedList)).valid, false);
  assert.equal((await authenticateSupplierPortal('RAHIM FISHERIES', 'new-password-99', rotated.updatedList)).valid, true);

  // Removing credential revokes access
  const emptied = removeSupplierPortalCredential(rotated.updatedList, rotated.credential.id);
  assert.equal(emptied.length, 0);
});

test('getSupplierPortalStatement enforces strict supplier isolation and accurate running balance', () => {
  const statement = getSupplierPortalStatement('RAHIM FISHERIES', {
    purchases: samplePurchases,
    payments: samplePayments,
    supplierCredits: sampleCredits,
  });

  // Strict tenant isolation: zero KARIM AQUA records
  assert.equal(statement.invoices.length, 1);
  assert.equal(statement.invoices[0].invoiceNumber, 'PUR-2026-0001');
  assert.equal(statement.paymentVouchers.length, 1);
  assert.equal(statement.paymentVouchers[0].invoiceNumber, 'PAY-2026-0001');
  assert.equal(statement.creditNotes.length, 1);
  assert.ok(statement.rows.every((r) => r.supplierName === 'RAHIM FISHERIES'));

  // Math parity: Debit 120,000 - Paid on bill 50,000 - Payment 40,000 - Credit Note 5,000 = 25,000 closing balance
  assert.equal(statement.overallTotals.totalDebit, 120000);
  assert.equal(statement.overallTotals.totalCredit, 95000);
  assert.equal(statement.overallTotals.totalBalance, 25000);
  assert.equal(statement.contactNumber, '+8801711000001');

  // Chronological running balances (rows sorted desc: CN 10-04 = 25,000, PAY 10-03 = 30,000, PUR 10-01 = 70,000)
  const byInvoice = new Map(statement.rows.map((r) => [r.invoiceNumber, r.runningBalance]));
  assert.equal(byInvoice.get('PUR-2026-0001'), 70000);
  assert.equal(byInvoice.get('PAY-2026-0001'), 30000);
  assert.equal(byInvoice.get('CN-2026-0001'), 25000);
});

test('getSupplierInvoiceById and getSupplierPaymentVoucherById reject cross-supplier access', () => {
  // Own invoice succeeds
  const ownInv = getSupplierInvoiceById('RAHIM FISHERIES', 'pur-1', samplePurchases);
  assert.ok(ownInv);
  assert.equal(ownInv.invoiceNumber, 'PUR-2026-0001');

  // Another supplier's invoice is strictly blocked
  const foreignInv = getSupplierInvoiceById('RAHIM FISHERIES', 'pur-2', samplePurchases);
  assert.equal(foreignInv, null);

  // Another supplier's payment voucher is strictly blocked
  const foreignPay = getSupplierPaymentVoucherById('RAHIM FISHERIES', 'pay-2', samplePayments);
  assert.equal(foreignPay, null);
});

test('generateSupplierStatementCSV outputs UTF-8 BOM, headers, rows, totals, and neutralizes formula cells', () => {
  const statement = getSupplierPortalStatement('RAHIM FISHERIES', {
    purchases: samplePurchases,
    payments: samplePayments,
    supplierCredits: sampleCredits,
  });

  const rowsWithFormula = statement.rows.map((r, idx) =>
    idx === 0 ? { ...r, description: '=SUM(A1:A5)' } : r
  );

  const csv = generateSupplierStatementCSV(
    'RAHIM FISHERIES',
    rowsWithFormula,
    statement.filteredTotals,
    'ZSB AQUATICS',
    'TK'
  );

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('SUPPLIER LEDGER STATEMENT'));
  assert.ok(csv.includes('PUR-2026-0001'));
  assert.ok(csv.includes('PAY-2026-0001'));
  assert.ok(csv.includes("'=SUM(A1:A5)"));
  assert.ok(!csv.includes('KARIM AQUA'));
});

test('collectKnownSupplierNames merges and deduplicates suppliers across collections', () => {
  const names = collectKnownSupplierNames({
    dropdownSuppliers: ['RAHIM FISHERIES', 'PADMA TRADERS'],
    purchases: samplePurchases,
    payments: samplePayments,
    supplierCredits: sampleCredits,
    credentials: [],
  });

  assert.deepEqual(names, ['KARIM AQUA', 'PADMA TRADERS', 'RAHIM FISHERIES']);
});

test('PDF filename helpers sanitize supplier names and invoice numbers safely', () => {
  assert.equal(
    formatSupplierStatementPdfFilename('RAHIM FISHERIES / LTD', '2026-11-24'),
    'RAHIM_FISHERIES_LTD_Account_Statement_2026-11-24.pdf'
  );
  assert.equal(
    formatSupplierInvoicePdfFilename('PUR-2026-0001', '../RAHIM FISHERIES'),
    'PUR-2026-0001_RAHIM_FISHERIES.pdf'
  );
  assert.equal(
    formatSupplierReceiptPdfFilename('PAY-2026-0001', 'RAHIM FISHERIES'),
    'PAY-2026-0001_RAHIM_FISHERIES_Receipt.pdf'
  );
});
