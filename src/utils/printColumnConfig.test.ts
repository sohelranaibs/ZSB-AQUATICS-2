import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRINT_COLUMN_VISIBILITY_STORAGE_KEY,
  PrintColumnDescriptor,
  StorageLike,
  buildDefaultHiddenColumnIds,
  buildPrintColumnId,
  buildPrintDocumentColumnSignature,
  classifyPrintColumn,
  clearSavedPrintHiddenColumns,
  computeAdjustedCellSpan,
  computeCleanA4HiddenColumnIds,
  computeNormalizedColWidths,
  enforceMinimumVisibleColumns,
  loadSavedPrintHiddenColumns,
  normalizePrintColToken,
  savePrintHiddenColumns,
  togglePrintColumnVisibility,
} from './printColumnConfig';

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

function makeCol(
  tableKey: string,
  colIndex: number,
  label: string,
  colKey?: string
): PrintColumnDescriptor {
  const resolvedKey = colKey || normalizePrintColToken(label, colIndex);
  const { category, defaultHidden } = classifyPrintColumn(label, resolvedKey);
  return {
    id: buildPrintColumnId(tableKey, resolvedKey),
    tableKey,
    tableIndex: 0,
    tableTitle: 'Document Table',
    colIndex,
    colKey: resolvedKey,
    label,
    category,
    defaultHidden,
  };
}

test('classifyPrintColumn distinguishes debug, metadata, and core columns', () => {
  assert.deepEqual(classifyPrintColumn('Record ID', 'record_id'), {
    category: 'debug',
    defaultHidden: true,
  });
  assert.deepEqual(classifyPrintColumn('Debug Payload', 'debug'), {
    category: 'debug',
    defaultHidden: true,
  });
  assert.deepEqual(classifyPrintColumn('Metadata', 'metadata'), {
    category: 'debug',
    defaultHidden: true,
  });
  assert.deepEqual(classifyPrintColumn('SL'), {
    category: 'metadata',
    defaultHidden: false,
  });
  assert.deepEqual(classifyPrintColumn('STATUS'), {
    category: 'metadata',
    defaultHidden: false,
  });
  assert.deepEqual(classifyPrintColumn('DOC / REF NO'), {
    category: 'metadata',
    defaultHidden: false,
  });
  assert.deepEqual(classifyPrintColumn('ITEM / GRADE'), {
    category: 'core',
    defaultHidden: false,
  });
  assert.deepEqual(classifyPrintColumn('TOTAL AMOUNT (TK)'), {
    category: 'core',
    defaultHidden: false,
  });
});

test('computeAdjustedCellSpan recalculates spanning footer/banner cells accurately', () => {
  // 8-column table where columns 0 (SL) and 2 (TYPE) are hidden
  const hidden = new Set([0, 2]);
  // Top banner spanning all 8 columns shrinks to 6
  assert.equal(computeAdjustedCellSpan(0, 8, hidden), 6);
  // Footer label spanning columns [0, 1, 2] shrinks to 1 (only col 1 visible)
  assert.equal(computeAdjustedCellSpan(0, 3, hidden), 1);
  // Single hidden cell returns 0
  assert.equal(computeAdjustedCellSpan(2, 1, hidden), 0);
  // Unaffected cell stays 1
  assert.equal(computeAdjustedCellSpan(5, 1, hidden), 1);
  // Span covering only hidden columns returns 0
  assert.equal(computeAdjustedCellSpan(0, 2, new Set([0, 1])), 0);
});

test('computeNormalizedColWidths rebalances visible <col> percentages to exactly 100%', () => {
  const orig = [10, 30, 20, 40];
  const hidden = new Set([0, 2]); // hiding 10% + 20% leaves 30% + 40% = 70%
  const next = computeNormalizedColWidths(orig, hidden);

  assert.equal(next[0], null);
  assert.equal(next[2], null);
  const w1 = parseFloat((next[1] || '0').replace('%', ''));
  const w3 = parseFloat((next[3] || '0').replace('%', ''));
  assert.equal(Math.round((w1 + w3) * 100) / 100, 100);
  assert.ok(w3 > w1, 'wider original column stays proportionally wider');

  // Tables without percentage widths return all nulls cleanly
  assert.deepEqual(computeNormalizedColWidths([null, null, null], new Set([0])), [
    null,
    null,
    null,
  ]);
});

test('default hidden, Clean A4 preset, and toggle guardrail keep at least 1 column visible per table', () => {
  const cols = [
    makeCol('t0', 0, 'SL'),
    makeCol('t0', 1, 'Record ID', 'record_id'),
    makeCol('t0', 2, 'ITEM / GRADE'),
    makeCol('t0', 3, 'TOTAL AMOUNT'),
    makeCol('t0', 4, 'STATUS'),
  ];

  // Defaults auto-hide only debug columns
  const defaultHidden = buildDefaultHiddenColumnIds(cols);
  assert.deepEqual(defaultHidden, ['t0::record_id']);

  // Clean A4 hides debug + metadata columns, leaving ITEM / GRADE and TOTAL AMOUNT visible
  const cleanA4 = computeCleanA4HiddenColumnIds(cols);
  assert.deepEqual(
    cleanA4.sort(),
    ['t0::record_id', 't0::sl', 't0::status'].sort()
  );

  // Toggling ITEM / GRADE off leaves TOTAL AMOUNT visible
  const afterHideItem = togglePrintColumnVisibility(
    cleanA4,
    't0::item_grade',
    cols
  );
  assert.equal(afterHideItem.length, 4);

  // Attempting to hide the last remaining visible column (TOTAL AMOUNT) is blocked
  const blocked = togglePrintColumnVisibility(
    afterHideItem,
    't0::total_amount',
    cols
  );
  assert.deepEqual(blocked, afterHideItem);

  // Re-enabling a hidden column works immediately
  const reShown = togglePrintColumnVisibility(blocked, 't0::sl', cols);
  assert.ok(!reShown.includes('t0::sl'));

  // Trying to hide every column via enforceMinimumVisibleColumns preserves a core column
  const enforced = enforceMinimumVisibleColumns(
    cols.map((c) => c.id),
    cols
  );
  assert.equal(enforced.length, cols.length - 1);
  assert.ok(!enforced.includes('t0::item_grade'));
});

test('localStorage helpers save, load, clear, and recover from corrupt payloads', () => {
  const storage = createMemoryStorage();
  const cols = [makeCol('t0', 0, 'SL'), makeCol('t0', 1, 'ITEM')];
  const sig = buildPrintDocumentColumnSignature('purchase', cols);

  assert.equal(loadSavedPrintHiddenColumns(sig, storage), null);

  savePrintHiddenColumns(sig, ['t0::sl'], storage);
  assert.deepEqual(loadSavedPrintHiddenColumns(sig, storage), ['t0::sl']);

  clearSavedPrintHiddenColumns(sig, storage);
  assert.equal(loadSavedPrintHiddenColumns(sig, storage), null);
  assert.equal(storage.getItem(PRINT_COLUMN_VISIBILITY_STORAGE_KEY), null);

  // Corrupt JSON fails gracefully
  storage.setItem(PRINT_COLUMN_VISIBILITY_STORAGE_KEY, '{corrupt');
  assert.equal(loadSavedPrintHiddenColumns(sig, storage), null);
});
