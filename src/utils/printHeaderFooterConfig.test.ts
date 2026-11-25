import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRINT_HEADER_FOOTER_CONFIG,
  PRINT_HEADER_FOOTER_STORAGE_KEY,
  sanitizePrintHeaderFooterConfig,
  loadPrintHeaderFooterConfig,
  savePrintHeaderFooterConfig,
  isPrintHeaderFooterCustomized,
  formatPrintHeaderDate,
} from './printHeaderFooterConfig.ts';

test('sanitizePrintHeaderFooterConfig applies defaults for missing or invalid inputs', () => {
  assert.deepEqual(sanitizePrintHeaderFooterConfig(null), DEFAULT_PRINT_HEADER_FOOTER_CONFIG);
  assert.deepEqual(sanitizePrintHeaderFooterConfig('bad'), DEFAULT_PRINT_HEADER_FOOTER_CONFIG);

  const partial = sanitizePrintHeaderFooterConfig({
    showCompanyName: false,
    showDate: true,
    customHeaderText: 'EXPORT COPY',
    showFooter: false,
    customFooterText: 'Thank you for your business',
    showSignatures: 'invalid-bool',
  });

  assert.equal(partial.showHeader, true);
  assert.equal(partial.showCompanyName, false);
  assert.equal(partial.showDate, true);
  assert.equal(partial.customHeaderText, 'EXPORT COPY');
  assert.equal(partial.showFooter, false);
  assert.equal(partial.showSignatures, true);
  assert.equal(partial.customFooterText, 'Thank you for your business');
});

test('loadPrintHeaderFooterConfig and savePrintHeaderFooterConfig round-trip cleanly', () => {
  const map = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };

  assert.deepEqual(loadPrintHeaderFooterConfig(mockStorage), DEFAULT_PRINT_HEADER_FOOTER_CONFIG);

  const custom = {
    ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG,
    showDate: true,
    customHeaderText: 'CONFIDENTIAL',
    showFooter: true,
    showPageNumber: false,
    customFooterText: 'Office Copy Only',
  };
  savePrintHeaderFooterConfig(custom, mockStorage);

  const loaded = loadPrintHeaderFooterConfig(mockStorage);
  assert.deepEqual(loaded, custom);

  // Corrupted JSON falls back gracefully to defaults
  map.set(PRINT_HEADER_FOOTER_STORAGE_KEY, '{not-json');
  assert.deepEqual(loadPrintHeaderFooterConfig(mockStorage), DEFAULT_PRINT_HEADER_FOOTER_CONFIG);
});

test('isPrintHeaderFooterCustomized detects deviations from defaults accurately', () => {
  assert.equal(isPrintHeaderFooterCustomized(DEFAULT_PRINT_HEADER_FOOTER_CONFIG), false);
  assert.equal(
    isPrintHeaderFooterCustomized({
      ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG,
      customHeaderText: '   ',
    }),
    false
  );
  assert.equal(
    isPrintHeaderFooterCustomized({
      ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG,
      showDate: true,
    }),
    true
  );
  assert.equal(
    isPrintHeaderFooterCustomized({
      ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG,
      showCompanyName: false,
    }),
    true
  );
  assert.equal(
    isPrintHeaderFooterCustomized({
      ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG,
      customFooterText: 'Authorized Copy',
    }),
    true
  );
});

test('formatPrintHeaderDate formats dates as DD/MM/YYYY', () => {
  const sampleDate = new Date(2026, 9, 5); // Oct 5, 2026
  assert.equal(formatPrintHeaderDate(sampleDate), '05/10/2026');
});
