import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORM_DRAFT_STORAGE_KEYS,
  StorageLike,
  clearAllFormDrafts,
  clearFormDraft,
  hasMeaningfulPackingDraft,
  hasMeaningfulPaymentDraft,
  hasMeaningfulPurchaseDraft,
  loadFormDraft,
  sanitizeExporterPaymentFormDraft,
  sanitizePackingFormDraft,
  sanitizePaymentFormDraft,
  sanitizeProfitLossFormDraft,
  sanitizePurchaseFormDraft,
  sanitizeTotalBalanceFormDraft,
  saveFormDraft,
} from './formDraftStorage.ts';

function createMemoryStorage(): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

test('saveFormDraft and loadFormDraft persist and hydrate PurchaseFormDraftData accurately', () => {
  const storage = createMemoryStorage();
  const draftInput = {
    invoiceNumber: 'PUR-2026-099',
    date: '2026-03-28',
    description: 'M/S OCEAN FISH SUPPLIERS',
    contactNumber: '01711-998877',
    remarks: 'Urgent morning catch draft',
    overallPreviousAmount: 12000,
    overallPaidAmount: 5000,
    rows: [
      { id: '1', item: 'LIVE MUD CRAB (XL)', quantity: 25, rate: 800, totalAmount: 0 },
      { id: '2', item: '', quantity: 0, rate: 0, totalAmount: 0 },
    ],
  };

  const saved = saveFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PURCHASE_FORM,
    draftInput,
    storage
  );
  assert.equal(saved, true);

  const loaded = loadFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PURCHASE_FORM,
    sanitizePurchaseFormDraft,
    storage
  );
  assert.ok(loaded);
  assert.equal(loaded.invoiceNumber, 'PUR-2026-099');
  assert.equal(loaded.description, 'M/S OCEAN FISH SUPPLIERS');
  assert.equal(loaded.contactNumber, '01711-998877');
  assert.equal(loaded.remarks, 'Urgent morning catch draft');
  assert.equal(loaded.overallPreviousAmount, 12000);
  assert.equal(loaded.overallPaidAmount, 5000);
  assert.equal(loaded.rows.length, 2);
  assert.equal(loaded.rows[0].item, 'LIVE MUD CRAB (XL)');
  assert.equal(loaded.rows[0].totalAmount, 20000);
  assert.equal(hasMeaningfulPurchaseDraft(loaded), true);
});

test('hasMeaningfulPurchaseDraft returns false for completely blank purchase form state', () => {
  const blank = sanitizePurchaseFormDraft({
    invoiceNumber: 'PUR-2026-001',
    date: '2026-03-28',
    description: '   ',
    contactNumber: '',
    remarks: '',
    overallPreviousAmount: 0,
    overallPaidAmount: 0,
    rows: [
      { id: '1', item: '', quantity: 0, rate: 0, totalAmount: 0 },
      { id: '2', item: '', quantity: 0, rate: 0, totalAmount: 0 },
    ],
  });
  assert.ok(blank);
  assert.equal(hasMeaningfulPurchaseDraft(blank), false);
});

test('sanitizePackingFormDraft recalculates row totalWeight and amount and detects meaningful draft', () => {
  const storage = createMemoryStorage();
  saveFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PACKING_FORM,
    {
      invoiceNumber: 'PKG-2026-042',
      packingDate: '2026-03-28',
      shippingMark: 'ZSB-SHANGHAI-88',
      flight: 'MU-2036',
      destination: 'PVG SHANGHAI',
      shipper: 'Z S B AQUATICS',
      paymentStatus: 'UNPAID',
      remarks: 'Fragile live eels',
      customRmbAmount: '4500',
      rows: [
        {
          id: '1',
          item: 'LIVE RICE FIELD EEL',
          box: 10,
          weight: 22,
          reportWeight: 21,
          totalWeight: 0,
          unit: 'KG',
          rate: 35,
          amount: 0,
        },
      ],
    },
    storage
  );

  const loaded = loadFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PACKING_FORM,
    sanitizePackingFormDraft,
    storage
  );
  assert.ok(loaded);
  assert.equal(loaded.shippingMark, 'ZSB-SHANGHAI-88');
  assert.equal(loaded.customRmbAmount, '4500');
  assert.equal(loaded.rows[0].totalWeight, 210);
  assert.equal(loaded.rows[0].amount, 7350); // 10 boxes * 21 reportWeight * 35 rate
  assert.equal(hasMeaningfulPackingDraft(loaded), true);
});

test('sanitizePaymentFormDraft and sanitizeExporterPaymentFormDraft preserve unsaved fields', () => {
  const storage = createMemoryStorage();
  saveFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM,
    {
      invoiceNumber: 'PAY-2026-015',
      date: '2026-03-28',
      supplierName: 'ROHIM ENTERPRISE',
      creditAmount: '18500',
      paymentMode: 'bKash',
      refPurchaseInvoice: 'PUR-2026-002',
      remarks: 'Part payment',
      voucherStatus: 'PARTIAL',
      contactNumber: '01819-001122',
    },
    storage
  );

  const paymentDraft = loadFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM,
    sanitizePaymentFormDraft,
    storage
  );
  assert.ok(paymentDraft);
  assert.equal(paymentDraft.supplierName, 'ROHIM ENTERPRISE');
  assert.equal(paymentDraft.creditAmount, '18500');
  assert.equal(paymentDraft.voucherStatus, 'PARTIAL');
  assert.equal(hasMeaningfulPaymentDraft(paymentDraft), true);

  saveFormDraft(
    FORM_DRAFT_STORAGE_KEYS.EXPORTER_PAYMENT_FORM,
    {
      invoiceNumber: 'EXP-PAY-2026-009',
      date: '2026-03-28',
      shippingMark: 'MK-99',
      selectedPackingDate: 'ALL',
      fromDate: '2026-03-01',
      toDate: '2026-03-28',
      selectedStatusFilter: 'UNPAID',
      contactNumber: '+86-13800138000',
      exporterStatus: 'PAID',
      returnRMB: 3200,
      exportGoodsRef: 'PKG-2026-001',
      remarks: 'WeChat settlement',
      overallPreviousAmount: 5000,
      overallReportAmount: 8000,
      overallPaidAmount: 3200,
      customRows: [
        {
          id: 'custom-1',
          date: '2026-03-28',
          shippingMark: 'MK-99',
          description: 'Advance TT transfer',
          debitAmount: 5000,
          reportAmount: 4800,
          creditAmount: 3000,
          balance: 0,
          status: 'UNPAID',
        },
      ],
      rowDescriptionOverrides: { 'db-row-1': 'Edited description' },
    },
    storage
  );

  const expDraft = loadFormDraft(
    FORM_DRAFT_STORAGE_KEYS.EXPORTER_PAYMENT_FORM,
    sanitizeExporterPaymentFormDraft,
    storage
  );
  assert.ok(expDraft);
  assert.equal(expDraft.shippingMark, 'MK-99');
  assert.equal(expDraft.overallReportAmount, 8000);
  assert.equal(expDraft.customRows.length, 1);
  assert.equal(expDraft.customRows[0].balance, 1800);
  assert.equal(expDraft.rowDescriptionOverrides['db-row-1'], 'Edited description');
});

test('sanitizeProfitLossFormDraft and sanitizeTotalBalanceFormDraft handle all sub-form fields', () => {
  const storage = createMemoryStorage();
  saveFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PROFIT_LOSS_FORM,
    {
      newCategory: 'Ice & Oxygen Packing',
      newCostDate: '2026-03-28',
      newAmount: '4200',
      newDesc: 'Extra oxygen cylinders',
      newRef: 'OC-77',
      creditSupplier: 'ABDULLAH VAI',
      creditAmount: '1500',
      creditReason: 'Mortality Claim',
      creditRefInvoice: 'PUR-001',
      creditDate: '2026-03-28',
      creditRemarks: 'Dead crab adjustment',
    },
    storage
  );

  const plDraft = loadFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PROFIT_LOSS_FORM,
    sanitizeProfitLossFormDraft,
    storage
  );
  assert.ok(plDraft);
  assert.equal(plDraft.newAmount, '4200');
  assert.equal(plDraft.creditAmount, '1500');

  saveFormDraft(
    FORM_DRAFT_STORAGE_KEYS.TOTAL_BALANCE_FORM,
    {
      depositDate: '2026-03-28',
      partnerName: 'Md. Mizanur Rahman',
      depositAmount: '75000',
      paymentMethod: 'Bank Transfer',
      depositRef: 'DEP-101',
      depositNotes: 'Q1 capital injection',
      withdrawalDate: '2026-03-28',
      withdrawalPartnerName: 'Md. Mizanur Rahman',
      withdrawalAmount: '10000',
      withdrawalMethod: 'Cash',
      withdrawalRef: 'WDR-202',
      withdrawalNotes: 'Personal drawing',
      entryMode: 'income',
      entryDate: '2026-03-28',
      costCategory: 'Air Freight & Cargo',
      incomeSource: 'Crate & Styrofoam Box Resale',
      entryAmount: '3400',
      entryRef: 'INC-55',
      entryDescription: 'Sold 40 used boxes',
    },
    storage
  );

  const tbDraft = loadFormDraft(
    FORM_DRAFT_STORAGE_KEYS.TOTAL_BALANCE_FORM,
    sanitizeTotalBalanceFormDraft,
    storage
  );
  assert.ok(tbDraft);
  assert.equal(tbDraft.depositAmount, '75000');
  assert.equal(tbDraft.withdrawalAmount, '10000');
  assert.equal(tbDraft.entryMode, 'income');
  assert.equal(tbDraft.entryAmount, '3400');
});

test('loadFormDraft safely returns null on corrupted JSON and clearAllFormDrafts removes all keys', () => {
  const storage = createMemoryStorage();
  storage.setItem(FORM_DRAFT_STORAGE_KEYS.PURCHASE_FORM, '{not-valid-json');
  const corrupted = loadFormDraft(
    FORM_DRAFT_STORAGE_KEYS.PURCHASE_FORM,
    sanitizePurchaseFormDraft,
    storage
  );
  assert.equal(corrupted, null);

  saveFormDraft(FORM_DRAFT_STORAGE_KEYS.PURCHASE_FORM, { description: 'Test' }, storage);
  saveFormDraft(FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM, { supplierName: 'Test' }, storage);
  clearFormDraft(FORM_DRAFT_STORAGE_KEYS.PURCHASE_FORM, storage);
  assert.equal(storage.getItem(FORM_DRAFT_STORAGE_KEYS.PURCHASE_FORM), null);
  assert.notEqual(storage.getItem(FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM), null);

  clearAllFormDrafts(storage);
  assert.equal(storage.getItem(FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM), null);
});
