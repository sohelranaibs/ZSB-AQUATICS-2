import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_WEIGHT_DEBOUNCE_MS,
  parseReportWeightInput,
  formatReportWeightDraft,
  applyReportWeightToRow,
  reconcilePackingRowsWithReportDrafts,
} from './packingReportWeight.ts';
import { PackingItemRow } from '../types/index.ts';

const baseRow = (overrides: Partial<PackingItemRow> = {}): PackingItemRow => ({
  id: '1',
  item: 'FF1',
  box: 10,
  weight: 16,
  reportWeight: 0,
  totalWeight: 160,
  unit: 'KG',
  rate: 30,
  amount: 4800,
  ...overrides,
});

describe('packingReportWeight pure debounce & reconciliation helpers', () => {
  it('exposes a fast responsive debounce window', () => {
    assert.ok(REPORT_WEIGHT_DEBOUNCE_MS >= 100 && REPORT_WEIGHT_DEBOUNCE_MS <= 300);
  });

  it('parses valid decimal inputs cleanly and clamps empty/invalid/negative to 0', () => {
    assert.equal(parseReportWeightInput(''), 0);
    assert.equal(parseReportWeightInput('   '), 0);
    assert.equal(parseReportWeightInput('-5.4'), 0);
    assert.equal(parseReportWeightInput('abc'), 0);
    assert.equal(parseReportWeightInput('12.'), 12);
    assert.equal(parseReportWeightInput('12.50'), 12.5);
  });

  it('formats report weight values for display without trailing zeros on zero values', () => {
    assert.equal(formatReportWeightDraft(0), '');
    assert.equal(formatReportWeightDraft(undefined), '');
    assert.equal(formatReportWeightDraft(14.25), '14.25');
  });

  it('applies reportWeight override immutably and avoids unnecessary object churn when unchanged', () => {
    const row = baseRow();
    const unchanged = applyReportWeightToRow(row, 0);
    assert.equal(unchanged, row);

    const updated = applyReportWeightToRow(row, 12.5);
    assert.notEqual(updated, row);
    assert.equal(updated.reportWeight, 12.5);
    assert.equal(updated.totalWeight, 125); // 10 boxes * 12.5 KG
    assert.equal(updated.amount, 3750); // 125 * 30

    // Calling again with same committed value keeps reference stability
    assert.equal(applyReportWeightToRow(updated, 12.5), updated);
  });

  it('flushes pending debounced drafts across multiple rows cleanly on save', () => {
    const rows = [baseRow({ id: '1' }), baseRow({ id: '2', box: 4, weight: 15, totalWeight: 60, rate: 20, amount: 1200 })];
    const reconciled = reconcilePackingRowsWithReportDrafts(rows, {
      '1': '12.5',
      '2': '',
    });

    assert.equal(reconciled[0].reportWeight, 12.5);
    assert.equal(reconciled[0].totalWeight, 125);
    assert.equal(reconciled[0].amount, 3750);
    assert.equal(reconciled[1], rows[1]);
  });
});
