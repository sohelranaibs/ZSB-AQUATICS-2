import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_VISIBLE_TABLE_ROWS,
  EXCLUDED_TABLE_CONTAINER_SELECTORS,
  calculateScrollViewportMaxHeight,
  isOpaqueCssColor,
  resolveStickySectionBackground,
  computeTableScrollSignature,
} from './tableScroll.ts';

describe('tableScroll 10-row scroll viewport helpers', () => {
  it('defaults MAX_VISIBLE_TABLE_ROWS to 10', () => {
    assert.equal(MAX_VISIBLE_TABLE_ROWS, 10);
  });

  it('returns undefined when row count is 10 or fewer (no artificial scroll cap)', () => {
    const heights10 = Array.from({ length: 10 }, () => 40);
    assert.equal(
      calculateScrollViewportMaxHeight({
        theadHeight: 38,
        tfootHeight: 44,
        rowHeights: heights10,
      }),
      undefined
    );

    assert.equal(
      calculateScrollViewportMaxHeight({
        theadHeight: 38,
        tfootHeight: 44,
        rowHeights: [],
      }),
      undefined
    );
  });

  it('caps height cleanly at thead + first 10 rows + tfoot + border when row count > 10', () => {
    const heights25 = Array.from({ length: 25 }, (_, idx) => (idx % 2 === 0 ? 40 : 42));
    // Sum of first 10 items (5 * 40 + 5 * 42 = 200 + 210 = 410)
    const maxH = calculateScrollViewportMaxHeight({
      theadHeight: 38,
      tfootHeight: 44,
      rowHeights: heights25,
    });
    assert.equal(maxH, 38 + 410 + 44 + 2);
  });

  it('supports explicit custom maxVisibleRows override when needed', () => {
    const heights15 = Array.from({ length: 15 }, () => 30);
    const maxH = calculateScrollViewportMaxHeight({
      theadHeight: 32,
      tfootHeight: 0,
      rowHeights: heights15,
      maxVisibleRows: 5,
    });
    assert.equal(maxH, 32 + 150 + 0 + 2);
  });

  it('identifies opaque vs transparent CSS colors for sticky table headers', () => {
    assert.equal(isOpaqueCssColor('transparent'), false);
    assert.equal(isOpaqueCssColor('rgba(0, 0, 0, 0)'), false);
    assert.equal(isOpaqueCssColor('rgba(255, 255, 255, 0.0)'), false);
    assert.equal(isOpaqueCssColor(''), false);
    assert.equal(isOpaqueCssColor('rgb(39, 62, 86)'), true);
    assert.equal(isOpaqueCssColor('#273e56'), true);

    assert.equal(
      resolveStickySectionBackground(['rgba(0, 0, 0, 0)', 'rgb(39, 62, 86)']),
      'rgb(39, 62, 86)'
    );
    assert.equal(
      resolveStickySectionBackground(['transparent', undefined], '#f1f5f9'),
      '#f1f5f9'
    );
  });

  it('excludes print/PDF and manually managed scroll containers', () => {
    assert.ok(EXCLUDED_TABLE_CONTAINER_SELECTORS.includes('.zsb-print-paper'));
    assert.ok(EXCLUDED_TABLE_CONTAINER_SELECTORS.includes('#printable-document'));
    assert.ok(EXCLUDED_TABLE_CONTAINER_SELECTORS.includes('[aria-hidden="true"]'));
    assert.ok(EXCLUDED_TABLE_CONTAINER_SELECTORS.includes('[data-row-scroll-managed="true"]'));
  });

  it('computes deterministic table scroll layout signatures', () => {
    assert.equal(
      computeTableScrollSignature({
        rowCount: 15,
        containerWidth: 1120.4,
        theadHeight: 40,
        tfootHeight: 36,
      }),
      '15:1120:40:36'
    );
  });
});
