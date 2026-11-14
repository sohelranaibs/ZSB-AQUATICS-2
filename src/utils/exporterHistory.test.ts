import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPORTER_STATUS_OPTIONS,
  normalizeExporterStatus,
  buildExporterRecordHistory,
  calculateExporterHistoryTotals,
} from './exporterHistory.ts';
import {
  samplePackings as initialPackings,
  samplePayments as initialPayments,
} from '../context/initialData.ts';

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

  it('calculateExporterHistoryTotals accurately sums Debit, Report, Credit, Balance (Report - Credit), and status counts', () => {
    const history = buildExporterRecordHistory(initialPackings, initialPayments);
    const totals = calculateExporterHistoryTotals(history);

    assert.equal(totals.recordCount, 4);
    assert.equal(totals.totalDebit, 56700);
    assert.equal(totals.totalReport, 56700);
    assert.equal(totals.totalCredit, 45500);
    assert.equal(totals.totalBalance, 11200);
    assert.equal(totals.paidCount, 3);
    assert.equal(totals.reportCount, 1);
    assert.equal(totals.noReportCount, 0);
  });

  it('uses REPORT (RMB) - CREDIT (RMB) = BALANCE (RMB) and treats DEBIT (RMB) as display-only', () => {
    const customPackings = [
      {
        ...initialPackings[0],
        id: 'pkg-custom-report-1',
        invoiceNumber: 'PKG-TEST-01',
        debitAmount: 20000,
        reportAmount: 14000,
        creditAmount: 5000,
        paymentStatus: 'REPORT' as const,
      },
      {
        ...initialPackings[1],
        id: 'pkg-custom-noreport-2',
        invoiceNumber: 'PKG-TEST-02',
        debitAmount: 9500,
        reportAmount: 0,
        creditAmount: 500,
        paymentStatus: 'NO REPORT' as const,
      },
    ];

    const history = buildExporterRecordHistory(customPackings, []);
    assert.equal(history.length, 2);

    assert.equal(history[0].debitAmount, 20000);
    assert.equal(history[0].reportAmount, 14000);
    assert.equal(history[0].creditAmount, 5000);
    assert.equal(history[0].balance, 9000);

    assert.equal(history[1].debitAmount, 9500);
    assert.equal(history[1].reportAmount, 0);
    assert.equal(history[1].creditAmount, 500);
    assert.equal(history[1].balance, -500);

    const totals = calculateExporterHistoryTotals(history);
    assert.equal(totals.totalDebit, 29500);
    assert.equal(totals.totalReport, 14000);
    assert.equal(totals.totalCredit, 5500);
    assert.equal(totals.totalBalance, 8500);
  });

  it('filters record history inclusively by fromDate and toDate range', () => {
    const datedPackings = [
      {
        ...initialPackings[0],
        id: 'pkg-d1',
        invoiceNumber: 'PKG-D1',
        shippingMark: 'MK-A',
        packingDate: '2026-06-01',
      },
      {
        ...initialPackings[1],
        id: 'pkg-d2',
        invoiceNumber: 'PKG-D2',
        shippingMark: 'MK-B',
        packingDate: '2026-06-05',
      },
      {
        ...initialPackings[2],
        id: 'pkg-d3',
        invoiceNumber: 'PKG-D3',
        shippingMark: 'MK-A',
        packingDate: '2026-06-10',
      },
      {
        ...initialPackings[3],
        id: 'pkg-d4',
        invoiceNumber: 'PKG-D4',
        shippingMark: 'MK-C',
        packingDate: '2026-06-15',
      },
    ];

    const rangeBoth = buildExporterRecordHistory(datedPackings, [], {
      fromDate: '2026-06-05',
      toDate: '2026-06-10',
    });
    assert.deepEqual(
      rangeBoth.map((r) => r.invoiceNumber),
      ['PKG-D2', 'PKG-D3']
    );

    const rangeFromOnly = buildExporterRecordHistory(datedPackings, [], {
      fromDate: '2026-06-10',
    });
    assert.deepEqual(
      rangeFromOnly.map((r) => r.invoiceNumber),
      ['PKG-D3', 'PKG-D4']
    );

    const rangeToOnly = buildExporterRecordHistory(datedPackings, [], {
      toDate: '2026-06-05',
    });
    assert.deepEqual(
      rangeToOnly.map((r) => r.invoiceNumber),
      ['PKG-D1', 'PKG-D2']
    );

    const combinedMarkAndRange = buildExporterRecordHistory(datedPackings, [], {
      shippingMark: 'MK-A',
      fromDate: '2026-06-02',
      toDate: '2026-06-12',
    });
    assert.deepEqual(
      combinedMarkAndRange.map((r) => r.invoiceNumber),
      ['PKG-D3']
    );
  });
});

