import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplierRecordHistory,
} from './supplierHistory';
import {
  resolveLedgerRowSource,
  validateLedgerEditForm,
  buildPurchaseUpdateFromLedgerEdit,
  buildPaymentUpdateFromLedgerEdit,
  buildSupplierCreditUpdateFromLedgerEdit,
} from './supplierLedgerEdit';
import {
  PurchaseRecord,
  PaymentRecord,
  SupplierCreditRecord,
} from '../types/index';

const samplePurchase: PurchaseRecord = {
  id: 'pur-1',
  invoiceNumber: 'INV-2026-0001',
  date: '2026-11-10',
  description: 'ABDULLAH AL MAMUN',
  contactNumber: '01700000000',
  items: [
    {
      id: 'pi-1',
      item: 'F1 CRAB',
      quantity: 50,
      rate: 1000,
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 20000,
      balance: 30000,
    },
  ],
  totalQty: 50,
  totalAmount: 50000,
  previousAmount: 0,
  paidAmount: 20000,
  balance: 30000,
  status: 'REPORT',
  remarks: 'Initial purchase',
  createdAt: '2026-11-10T08:00:00.000Z',
};

const samplePayment: PaymentRecord = {
  id: 'pay-1',
  invoiceNumber: 'PAY-2026-0001',
  date: '2026-11-12',
  description: 'ABDULLAH AL MAMUN',
  contactNumber: '01700000000',
  items: [
    {
      id: 'item-1',
      invoiceNumber: 'PAY-2026-0001',
      date: '2026-11-12',
      description: 'Cash Payment',
      debitAmount: 0,
      creditAmount: 15000,
      balance: -15000,
      status: 'PAID',
    },
  ],
  totalAmount: 0,
  previousAmount: 0,
  paidAmount: 15000,
  balance: -15000,
  status: 'PAID',
  returnRMB: 0,
  paymentCategory: 'supplier',
  remarks: 'Cash voucher',
  createdAt: '2026-11-12T08:00:00.000Z',
};

const sampleCredit: SupplierCreditRecord = {
  id: 'cn-1',
  creditNoteNumber: 'CN-2026-0001',
  date: '2026-11-14',
  supplierName: 'ABDULLAH AL MAMUN',
  reason: 'Weight Shortage / Shrinkage',
  amount: 2500,
  appliedAmount: 0,
  remainingAmount: 2500,
  status: 'AVAILABLE',
  applications: [],
  remarks: 'Shrinkage adjustment',
  createdAt: '2026-11-14T08:00:00.000Z',
};

test('edits a Purchase Bill row and reflects corrected Debit, Credit, Balance, and Status in ledger', () => {
  const initialRows = buildSupplierRecordHistory([samplePurchase], [], [], { sortDirection: 'asc' });
  assert.equal(initialRows.length, 1);

  const resolved = resolveLedgerRowSource(initialRows[0], [samplePurchase], [], []);
  assert.ok(resolved);
  assert.equal(resolved.recordType, 'PURCHASE_BILL');
  assert.equal(resolved.initialValues.debitAmount, '50000');
  assert.equal(resolved.initialValues.creditAmount, '20000');

  const validated = validateLedgerEditForm(
    {
      date: '2026-11-11',
      invoiceNumber: 'INV-2026-0001-REV',
      supplierName: 'RAHIM ENTERPRISE',
      debitAmount: '60000',
      creditAmount: '35000',
      status: 'REPORT',
      remarks: 'Corrected wrong rate',
    },
    'PURCHASE_BILL'
  );
  assert.equal(validated.valid, true);
  assert.equal(validated.computedBalance, 25000);

  const patch = buildPurchaseUpdateFromLedgerEdit(samplePurchase, validated, 'Corrected wrong rate');
  const updatedPurchase: PurchaseRecord = { ...samplePurchase, ...patch };

  // Verify single item rate synced (60000 / 50 = 1200)
  assert.equal(updatedPurchase.items[0].rate, 1200);
  assert.equal(updatedPurchase.items[0].totalAmount, 60000);
  assert.equal(updatedPurchase.balance, 25000);

  const afterRows = buildSupplierRecordHistory([updatedPurchase], [], [], { sortDirection: 'asc' });
  assert.equal(afterRows[0].date, '2026-11-11');
  assert.equal(afterRows[0].supplierName, 'RAHIM ENTERPRISE');
  assert.equal(afterRows[0].debitAmount, 60000);
  assert.equal(afterRows[0].creditAmount, 35000);
  assert.equal(afterRows[0].balance, 25000);
});

test('edits a Payment Voucher row including standalone Debit & Credit and reflects in ledger', () => {
  const initialRows = buildSupplierRecordHistory([], [samplePayment], [], { sortDirection: 'asc' });
  assert.equal(initialRows.length, 1);

  const resolved = resolveLedgerRowSource(initialRows[0], [], [samplePayment], []);
  assert.ok(resolved);
  assert.equal(resolved.recordType, 'PAYMENT_VOUCHER');
  assert.equal(resolved.initialValues.creditAmount, '15000');

  const validated = validateLedgerEditForm(
    {
      date: '2026-11-13',
      invoiceNumber: 'PAY-2026-0001',
      supplierName: 'ABDULLAH AL MAMUN',
      debitAmount: '5000',
      creditAmount: '18000',
      status: 'PAID',
      remarks: 'Updated cash amount',
    },
    'PAYMENT_VOUCHER'
  );
  assert.equal(validated.valid, true);
  assert.equal(validated.computedBalance, -13000);

  const patch = buildPaymentUpdateFromLedgerEdit(samplePayment, validated, 'Updated cash amount');
  const updatedPayment: PaymentRecord = { ...samplePayment, ...patch };

  const afterRows = buildSupplierRecordHistory([], [updatedPayment], [], { sortDirection: 'asc' });
  assert.equal(afterRows[0].date, '2026-11-13');
  assert.equal(afterRows[0].debitAmount, 5000);
  assert.equal(afterRows[0].creditAmount, 18000);
  assert.equal(afterRows[0].balance, -13000);
});

test('edits a Credit Note row and recalculates remainingAmount and ledger status', () => {
  const initialRows = buildSupplierRecordHistory([], [], [sampleCredit], { sortDirection: 'asc' });
  assert.equal(initialRows.length, 1);

  const resolved = resolveLedgerRowSource(initialRows[0], [], [], [sampleCredit]);
  assert.ok(resolved);
  assert.equal(resolved.recordType, 'CREDIT_NOTE');

  const validated = validateLedgerEditForm(
    {
      date: '2026-11-15',
      invoiceNumber: 'CN-2026-0001',
      supplierName: 'ABDULLAH AL MAMUN',
      debitAmount: '999', // Ignored for credit note (forced to 0)
      creditAmount: '3200',
      status: 'PAID',
      remarks: 'Revised shrinkage credit',
    },
    'CREDIT_NOTE'
  );
  assert.equal(validated.valid, true);
  assert.equal(validated.parsedDebit, 0);
  assert.equal(validated.parsedCredit, 3200);

  const patch = buildSupplierCreditUpdateFromLedgerEdit(
    sampleCredit,
    validated,
    'Revised shrinkage credit'
  );
  const updatedCredit: SupplierCreditRecord = { ...sampleCredit, ...patch };

  assert.equal(updatedCredit.amount, 3200);
  assert.equal(updatedCredit.remainingAmount, 0);
  assert.equal(updatedCredit.status, 'APPLIED');

  const afterRows = buildSupplierRecordHistory([], [], [updatedCredit], { sortDirection: 'asc' });
  assert.equal(afterRows[0].creditAmount, 3200);
  assert.equal(afterRows[0].balance, -3200);
  assert.equal(afterRows[0].status, 'PAID');
});

test('validation rejects invalid date, empty supplier, negative numbers, and zero credit note', () => {
  const badDate = validateLedgerEditForm(
    {
      date: '11/10/2026',
      invoiceNumber: 'INV-1',
      supplierName: 'SUPPLIER',
      debitAmount: '100',
      creditAmount: '0',
      status: 'REPORT',
      remarks: '',
    },
    'PURCHASE_BILL'
  );
  assert.equal(badDate.valid, false);

  const emptySupplier = validateLedgerEditForm(
    {
      date: '2026-11-10',
      invoiceNumber: 'INV-1',
      supplierName: '   ',
      debitAmount: '100',
      creditAmount: '0',
      status: 'REPORT',
      remarks: '',
    },
    'PURCHASE_BILL'
  );
  assert.equal(emptySupplier.valid, false);

  const negativeDebit = validateLedgerEditForm(
    {
      date: '2026-11-10',
      invoiceNumber: 'INV-1',
      supplierName: 'SUPPLIER',
      debitAmount: '-50',
      creditAmount: '0',
      status: 'REPORT',
      remarks: '',
    },
    'PURCHASE_BILL'
  );
  assert.equal(negativeDebit.valid, false);

  const zeroCreditNote = validateLedgerEditForm(
    {
      date: '2026-11-10',
      invoiceNumber: 'CN-1',
      supplierName: 'SUPPLIER',
      debitAmount: '0',
      creditAmount: '0',
      status: 'REPORT',
      remarks: '',
    },
    'CREDIT_NOTE'
  );
  assert.equal(zeroCreditNote.valid, false);
});
