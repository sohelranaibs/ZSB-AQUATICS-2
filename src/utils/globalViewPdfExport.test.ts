import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGlobalViewTableReport,
  convertExtractedDomTablesToSections,
  formatGlobalViewPdfFilename,
  inferColumnAlignment,
} from './globalViewPdfExport.ts';
import {
  initialCompanyProfile,
  initialDropdownOptions,
  sampleOtherCosts as initialOtherCosts,
  samplePackings as initialPackings,
  samplePayments as initialPayments,
  samplePurchases as initialPurchases,
  sampleSupplierCredits as initialSupplierCredits,
} from '../context/initialData.ts';
import { ActiveTab } from '../types/index.ts';

test('formatGlobalViewPdfFilename produces deterministic sanitized PDF filenames per view', () => {
  assert.equal(
    formatGlobalViewPdfFilename('dashboard', '2026-10-29'),
    'ZSB_AQUATICS_DASHBOARD_TABLE_2026-10-29.pdf'
  );
  assert.equal(
    formatGlobalViewPdfFilename('exporter_payment_form', '2026-10-29'),
    'ZSB_AQUATICS_EXPORTER_PAYMENT_HISTORY_TABLE_2026-10-29.pdf'
  );
  assert.equal(
    formatGlobalViewPdfFilename('purchase_db', '2026-10-29'),
    'ZSB_AQUATICS_PURCHASE_DB_TABLE_2026-10-29.pdf'
  );
});

test('inferColumnAlignment assigns right alignment to numeric/currency columns and center to SL/DATE/STATUS', () => {
  assert.equal(inferColumnAlignment('SL'), 'center');
  assert.equal(inferColumnAlignment('PACKING DATE'), 'center');
  assert.equal(inferColumnAlignment('STATUS'), 'center');
  assert.equal(inferColumnAlignment('TOTAL AMOUNT (TK)'), 'right');
  assert.equal(inferColumnAlignment('WEIGHT (KG)'), 'right');
  assert.equal(inferColumnAlignment('DEBIT (RMB)'), 'right');
  assert.equal(inferColumnAlignment('SUPPLIER NAME'), 'left');
});

test('convertExtractedDomTablesToSections strips action columns and empty template rows', () => {
  const sections = convertExtractedDomTablesToSections(
    [
      {
        title: 'Purchase Ledger Table',
        headers: ['', 'SL', 'INVOICE NO', 'SUPPLIER NAME', 'TOTAL AMOUNT (TK)', 'ACTIONS'],
        rows: [
          ['', '1', 'PUR-2026-0001', 'ALAM ENTERPRISE', 'TK 125,000.00', 'Print Delete'],
          ['', '2', '', '', '0.00', ''],
        ],
        footers: [['', '', '', 'GRAND TOTAL', 'TK 125,000.00', '']],
      },
    ],
    'Fallback Title'
  );

  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, 'Purchase Ledger Table');
  // Checkbox column and ACTIONS column stripped -> 4 columns remain
  assert.equal(sections[0].columns.length, 4);
  assert.deepEqual(
    sections[0].columns.map((c) => c.label),
    ['SL', 'INVOICE NO', 'SUPPLIER NAME', 'TOTAL AMOUNT (TK)']
  );
  // Empty template row #2 stripped -> 1 data row remains
  assert.equal(sections[0].rows.length, 1);
  assert.equal(sections[0].rows[0].col_2, 'PUR-2026-0001');
});

test('buildGlobalViewTableReport builds valid structured table reports for all 12 ActiveTab views', () => {
  const allTabs: ActiveTab[] = [
    'dashboard',
    'purchase_form',
    'packing_form',
    'payment_form',
    'exporter_payment_form',
    'exporter_payment_slip',
    'profit_loss',
    'purchase_db',
    'packing_db',
    'payment_db',
    'search_reports',
    'settings',
  ];

  for (const tab of allTabs) {
    const report = buildGlobalViewTableReport({
      activeTab: tab,
      companyProfile: initialCompanyProfile,
      purchases: initialPurchases,
      packings: initialPackings,
      payments: initialPayments,
      otherCosts: initialOtherCosts,
      supplierCredits: initialSupplierCredits,
      dropdownOptions: initialDropdownOptions,
      referenceDate: '2026-10-29',
    });

    assert.equal(report.activeTab, tab);
    assert.ok(report.filename.endsWith('_2026-10-29.pdf'), `Filename for ${tab} should end with date.pdf`);
    assert.ok(report.sections.length > 0, `View ${tab} should produce at least 1 table section`);
    assert.ok(report.sections[0].columns.length > 0, `View ${tab} section 0 should have columns`);
    assert.ok(report.sections[0].rows.length > 0, `View ${tab} section 0 should have rows`);
  }
});

test('buildGlobalViewTableReport for exporter_payment_form includes DEBIT, CREDIT, BALANCE & STATUS columns', () => {
  const report = buildGlobalViewTableReport({
    activeTab: 'exporter_payment_form',
    companyProfile: initialCompanyProfile,
    purchases: initialPurchases,
    packings: initialPackings,
    payments: initialPayments,
    otherCosts: initialOtherCosts,
    referenceDate: '2026-10-29',
  });

  const colLabels = report.sections[0].columns.map((c) => c.label);
  assert.ok(colLabels.includes('DEBIT (RMB)'));
  assert.ok(colLabels.includes('CREDIT (RMB)'));
  assert.ok(colLabels.includes('BALANCE (RMB)'));
  assert.ok(colLabels.includes('STATUS'));
});
