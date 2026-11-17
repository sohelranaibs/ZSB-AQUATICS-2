import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAllSuppliersDashboardReport,
  generateAllSuppliersReportCSV,
  buildAllSuppliersReportCsvFilename,
} from './dashboardSupplierReport.ts';
import {
  initialDropdownOptions,
  samplePayments,
  samplePurchases,
} from '../context/initialData.ts';
import { PaymentRecord, PurchaseRecord, SupplierCreditRecord } from '../types/index.ts';

test('buildAllSuppliersDashboardReport reconciles seeded suppliers without double-counting linked vouchers', () => {
  const report = buildAllSuppliersDashboardReport({
    purchases: samplePurchases,
    payments: samplePayments,
    supplierCredits: [],
    registeredSuppliers: initialDropdownOptions.suppliers,
    statusFilter: 'all',
    sortBy: 'due_desc',
  });

  // 5 active seeded suppliers + 10 remaining registered dropdown suppliers = 15 unique suppliers
  assert.equal(report.totals.totalSuppliersCount, 15);
  assert.equal(report.totals.activeSuppliersCount, 5);
  assert.equal(report.totals.suppliersWithDueCount, 3);
  assert.equal(report.totals.settledSuppliersCount, 2);
  assert.equal(report.totals.noActivitySuppliersCount, 10);

  // Exact financial reconciliation across all seeded purchases
  assert.equal(report.totals.totalPurchaseBillsCount, 5);
  assert.equal(report.totals.totalPurchaseQtyKg, 680);
  assert.equal(report.totals.totalPurchaseAmount, 565500);
  assert.equal(report.totals.totalPaidAmount, 484500);
  assert.equal(report.totals.totalDueAmount, 81000);

  // Top due suppliers sorted descending
  const faisal = report.filteredSuppliers[0];
  assert.equal(faisal.supplierName, 'FAISAL VAI');
  assert.equal(faisal.totalPurchaseAmount, 160000);
  assert.equal(faisal.totalPaidAmount, 120000);
  assert.equal(faisal.totalDueAmount, 40000);
  assert.equal(faisal.status, 'DUE');
  assert.ok(faisal.historyRows.length >= 2);

  const abdullah = report.filteredSuppliers[1];
  assert.equal(abdullah.supplierName, 'ABDULLAH VAI');
  assert.equal(abdullah.totalPurchaseAmount, 125000);
  assert.equal(abdullah.totalPaidAmount, 100000);
  assert.equal(abdullah.totalDueAmount, 25000);

  const kabir = report.filteredSuppliers[2];
  assert.equal(kabir.supplierName, 'KABIR VAI');
  assert.equal(kabir.totalPurchaseAmount, 76000);
  assert.equal(kabir.totalPaidAmount, 60000);
  assert.equal(kabir.totalDueAmount, 16000);
  assert.equal(kabir.historyRows.length, 1);
});

test('buildAllSuppliersDashboardReport applies standalone unlinked vouchers and open credit notes', () => {
  const extraPayment: PaymentRecord = {
    id: 'pay-extra-1',
    invoiceNumber: 'PAY-2026-1199',
    date: '2026-11-10',
    description: 'ABDULLAH VAI',
    contactNumber: '+8801711223344',
    items: [
      {
        id: '1',
        date: '2026-11-10',
        description: 'Partial settlement via Bank',
        debitAmount: 0,
        creditAmount: 15000,
        balance: 10000,
        status: 'REPORT',
      },
    ],
    totalAmount: 25000,
    previousAmount: 0,
    paidAmount: 15000,
    balance: 10000,
    status: 'REPORT',
    returnRMB: 0,
    paymentCategory: 'supplier',
    remarks: 'Bank transfer installment',
    createdAt: '2026-11-10T10:00:00.000Z',
  };

  const creditNote: SupplierCreditRecord = {
    id: 'cn-faisal-1',
    creditNoteNumber: 'CN-2026-0001',
    date: '2026-10-20',
    supplierName: 'FAISAL VAI',
    refPurchaseInvoice: 'INV-2026-0918',
    reason: 'Mortality / DOA Claim',
    amount: 10000,
    appliedAmount: 0,
    remainingAmount: 10000,
    status: 'AVAILABLE',
    applications: [],
    createdAt: '2026-10-20T09:00:00.000Z',
  };

  const report = buildAllSuppliersDashboardReport({
    purchases: samplePurchases,
    payments: [...samplePayments, extraPayment],
    supplierCredits: [creditNote],
    registeredSuppliers: initialDropdownOptions.suppliers,
  });

  const abdullah = report.allSuppliers.find((s) => s.supplierName === 'ABDULLAH VAI');
  assert.ok(abdullah);
  assert.equal(abdullah.totalPurchaseAmount, 125000);
  assert.equal(abdullah.totalPaidAmount, 115000);
  assert.equal(abdullah.totalDueAmount, 10000);
  assert.equal(abdullah.latestDate, '2026-11-10');
  assert.equal(abdullah.latestRef, 'PAY-2026-1199');

  const faisal = report.allSuppliers.find((s) => s.supplierName === 'FAISAL VAI');
  assert.ok(faisal);
  assert.equal(faisal.openCreditBalance, 10000);
  assert.equal(faisal.totalDueAmount, 30000);
  assert.ok(faisal.historyRows.some((r) => r.recordType === 'CREDIT_NOTE'));

  // Grand due reduced by 15,000 payment + 10,000 open credit = 56,000
  assert.equal(report.totals.totalDueAmount, 56000);
});

test('buildAllSuppliersDashboardReport filters and sorts accurately and preserves unregistered purchase suppliers', () => {
  const customPurchase: PurchaseRecord = {
    id: 'pur-custom-1',
    invoiceNumber: 'INV-2026-1201',
    date: '2026-11-15',
    description: 'BENGAL AQUA FARMS',
    contactNumber: '+8801700000000',
    items: [
      { id: '1', item: 'FF1', quantity: 50, rate: 900, totalAmount: 45000, previousAmount: 0, paidAmount: 0, balance: 45000 },
    ],
    totalQty: 50,
    totalAmount: 45000,
    previousAmount: 0,
    paidAmount: 0,
    balance: 45000,
    createdAt: '2026-11-15T08:00:00.000Z',
  };

  const dueOnly = buildAllSuppliersDashboardReport({
    purchases: [...samplePurchases, customPurchase],
    payments: samplePayments,
    registeredSuppliers: initialDropdownOptions.suppliers,
    statusFilter: 'due',
    sortBy: 'due_desc',
  });

  assert.equal(dueOnly.filteredSuppliers.length, 4);
  assert.equal(dueOnly.filteredSuppliers[0].supplierName, 'BENGAL AQUA FARMS');
  assert.equal(dueOnly.filteredSuppliers[0].totalDueAmount, 45000);

  const searchBengal = buildAllSuppliersDashboardReport({
    purchases: [...samplePurchases, customPurchase],
    payments: samplePayments,
    registeredSuppliers: initialDropdownOptions.suppliers,
    searchTerm: 'bengal',
  });
  assert.equal(searchBengal.filteredSuppliers.length, 1);
  assert.equal(searchBengal.filteredTotals.totalPurchaseAmount, 45000);

  const nameAsc = buildAllSuppliersDashboardReport({
    purchases: samplePurchases,
    payments: samplePayments,
    registeredSuppliers: [],
    sortBy: 'name_asc',
  });
  assert.deepEqual(
    nameAsc.filteredSuppliers.map((s) => s.supplierName),
    ['ABDULLAH VAI', 'FAISAL VAI', 'KABIR VAI', 'RAKIB VAI', 'UZZAL VAI']
  );
});

test('generateAllSuppliersReportCSV produces RFC-4180 CSV with grand total footer row', () => {
  const report = buildAllSuppliersDashboardReport({
    purchases: samplePurchases,
    payments: samplePayments,
    registeredSuppliers: initialDropdownOptions.suppliers,
    statusFilter: 'due',
  });

  const csv = generateAllSuppliersReportCSV(report, 'TK');
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 5); // Header + 3 due suppliers + GRAND TOTAL
  assert.ok(lines[0].includes('Total Purchase (TK)'));
  assert.ok(lines[0].includes('Total Due (TK)'));
  assert.ok(lines[1].includes('FAISAL VAI'));
  assert.ok(lines[1].includes('160000.00'));
  assert.ok(lines[1].includes('40000.00'));
  assert.ok(lines[4].startsWith('GRAND TOTAL,'));
  assert.ok(lines[4].includes('81000.00'));

  assert.equal(
    buildAllSuppliersReportCsvFilename('2026-11-17'),
    'ZSB_AQUATICS_ALL_SUPPLIERS_PURCHASE_DUE_REPORT_2026-11-17.csv'
  );
});
