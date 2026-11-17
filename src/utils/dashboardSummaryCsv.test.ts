import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UTF8_BOM } from './csvExporter.ts';
import {
  buildDashboardSummaryCsvFilename,
  generateDashboardSummaryCSV,
} from './dashboardSummaryCsv.ts';

describe('dashboardSummaryCsv export helpers', () => {
  it('builds a clean dated filename for dashboard summary CSV exports', () => {
    assert.equal(
      buildDashboardSummaryCsvFilename('2026-11-17'),
      'ZSB_AQUATICS_DASHBOARD_SUMMARY_2026-11-17.csv'
    );
  });

  it('generates valid UTF-8 BOM RFC-4180 CSV containing all dashboard card metrics', () => {
    const csv = generateDashboardSummaryCSV({
      companyName: 'ZSB AQUATICS',
      currency: 'TK',
      rmbExchangeRate: 16.5,
      totalExportValueBDT: 935550,
      totalPurchaseValue: 565500,
      totalPurchaseCount: 5,
      totalPurchaseQtyKg: 680,
      totalPackingCount: 4,
      totalExportWeightKg: 1488,
      totalExportBoxes: 93,
      totalRmbSettled: 56700,
      totalPaymentCount: 4,
      supplierPaymentCount: 4,
      exporterPaymentCount: 0,
      totalPaymentsMade: 424500,
      activePartiesCount: 9,
      executiveMarginPercent: '39.55',
      availableStockKg: 0,
      stockStatus: 'critical_low',
      totalBalance: 370050,
      latestPurchaseDate: '12/10/2026',
      latestPackingDate: '15/10/2026',
      latestPaymentDate: '13/10/2026',
      exportedAt: '2026-11-17',
    });

    assert.equal(csv.startsWith(UTF8_BOM), true);
    const lines = csv.slice(UTF8_BOM.length).split('\r\n');
    assert.equal(lines[0], 'ZSB AQUATICS — EXECUTIVE DASHBOARD SUMMARY');
    assert.equal(lines[3], 'Section,Metric Name,Value,Unit / Currency,Supporting Details');

    assert.ok(csv.includes('Total Export Revenue,935550.00,BDT,'));
    assert.ok(csv.includes('Total Procurement,565500.00,TK,'));
    assert.ok(csv.includes('Total Orders & Bills,9,Records,'));
    assert.ok(csv.includes('Suppliers & Marks,9,Parties,'));
    assert.ok(csv.includes('Gross Margin,39.55%,Percent,'));
    assert.ok(csv.includes('Foreign RMB Remittance,56700.00,RMB,'));
    assert.ok(csv.includes('Net Total Balance,370050.00,TK,'));
  });
});
