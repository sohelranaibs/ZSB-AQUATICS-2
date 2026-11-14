import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_VISIBLE_TABLE_ROWS,
  calculateScrollViewportMaxHeight,
} from './tableScroll.ts';

describe('tableScroll 31-row scroll viewport helpers', () => {
  it('defaults MAX_VISIBLE_TABLE_ROWS to 31', () => {
    assert.equal(MAX_VISIBLE_TABLE_ROWS, 31);
  });

  it('returns undefined when row count is 31 or fewer (no artificial scroll cap)', () => {
    const heights31 = Array.from({ length: 31 }, () => 40);
    assert.equal(
      calculateScrollViewportMaxHeight({
        theadHeight: 38,
        tfootHeight: 44,
        rowHeights: heights31,
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

  it('caps height cleanly at thead + first 31 rows + tfoot + border when row count > 31', () => {
    const heights45 = Array.from({ length: 45 }, (_, idx) => (idx % 2 === 0 ? 40 : 42));
    // Sum of first 31 items (16 * 40 + 15 * 42 = 640 + 630 = 1270)
    const maxH = calculateScrollViewportMaxHeight({
      theadHeight: 38,
      tfootHeight: 44,
      rowHeights: heights45,
    });
    assert.equal(maxH, 38 + 1270 + 44 + 2);
  });
});
