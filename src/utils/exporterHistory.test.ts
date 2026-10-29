import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPORTER_STATUS_OPTIONS,
  normalizeExporterStatus,
  buildExporterRecordHistory,
  calculateExporterHistoryTotals,
} from './exporterHistory.ts';
import { initialPackings, initialPayments } from '../context/initialData.ts';

describe('exporterHistory utilities', () => {
  it('EXPORTER_STATUS_OPTIONS includes REPORT, NO REPORT, and PAID', () => {
    assert.deepEqual(EXPORTER_STATUS_OPTIONS, ['REPORT', 'NO REPORT', 'PAID']);
    assert.equal(normalizeExporterStatus('report'), 'REPORT');
    assert.equal(normalizeExporterStatus('no report'), 'NO REPORT');
    assert.equal(normalizeExporterStatus('paid'), 'PAID');
  });

  it('buildExporterRecordHistory returns all exporter record history with Debit, Credit, Balance, and Status', () => {
    const history = buildExporterRecordHistory(initialPackings, initialPayments);
    assert.equal(history.length, initialPackings.length);

    // First record: PKG-2026-1001 (AAD, PAID, 15000 RMB)
    const aadRow = history.find((r) => r.shippingMark === 'AAD');
    assert.ok(aadRow);
    assert.equal(aadRow.debitAmount, 15000);
    assert.equal(aadRow.creditAmount, 15000);
    assert.equal(aadRow.balance, 0);
    assert.equal(aadRow.status, 'PAID');

    // Second record: PKG-2026-1015 (CHJ-22, REPORT, 11200 RMB)
    const chjRow = history.find((r) => r.shippingMark === 'CHJ-22');
    assert.ok(chjRow);
    assert.equal(chjRow.debitAmount, 11200);
    assert.equal(chjRow.creditAmount, 0);
    assert.equal(chjRow.balance, 11200);
    assert.equal(chjRow.status, 'REPORT');
  });

  it('filters record history by Shipping Mark, Packing Date, and Status (Report, No Report, Paid)', () => {
    const byMark = buildExporterRecordHistory(initialPackings, initialPayments, {
      shippingMark: 'CHJ-22',
    });
    assert.equal(byMark.length, 1);
    assert.equal(byMark[0].shippingMark, 'CHJ-22');
    assert.equal(byMark[0].status, 'REPORT');

    const byDate = buildExporterRecordHistory(initialPackings, initialPayments, {
      packingDate: '2026-09-22',
    });
    assert.equal(byDate.length, 1);
    assert.equal(byDate[0].shippingMark, 'LXB-52');

    const byStatusPaid = buildExporterRecordHistory(initialPackings, initialPayments, {
      status: 'PAID',
    });
    assert.equal(byStatusPaid.length, 3);
  });

  it('calculateExporterHistoryTotals accurately sums Debit, Credit, Balance, and status counts', () => {
    const history = buildExporterRecordHistory(initialPackings, initialPayments);
    const totals = calculateExporterHistoryTotals(history);

    assert.equal(totals.recordCount, 4);
    assert.equal(totals.totalDebit, 56700);
    assert.equal(totals.totalCredit, 45500);
    assert.equal(totals.totalBalance, 11200);
    assert.equal(totals.paidCount, 3);
    assert.equal(totals.reportCount, 1);
    assert.equal(totals.noReportCount, 0);
  });
});
