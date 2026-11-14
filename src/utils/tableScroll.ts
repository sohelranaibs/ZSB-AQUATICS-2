/**
 * Shared 31-row vertical scroll viewport calculation helper for ledger & database tables.
 */

export const MAX_VISIBLE_TABLE_ROWS = 31;

export interface ScrollViewportHeightParams {
  theadHeight: number;
  tfootHeight?: number;
  rowHeights: number[];
  maxVisibleRows?: number;
  borderCompensationPx?: number;
}

/**
 * Computes exact pixel maxHeight for a table scroll container so only `maxVisibleRows` (default 31)
 * body rows are visible at a time with sticky header/footer and vertical scroll for rows beyond 31.
 * Returns `undefined` when total body rows <= maxVisibleRows so shorter tables do not reserve empty space.
 */
export function calculateScrollViewportMaxHeight(
  params: ScrollViewportHeightParams
): number | undefined {
  const maxRows =
    typeof params.maxVisibleRows === 'number' && params.maxVisibleRows > 0
      ? Math.floor(params.maxVisibleRows)
      : MAX_VISIBLE_TABLE_ROWS;

  const rowHeights = Array.isArray(params.rowHeights) ? params.rowHeights : [];
  if (rowHeights.length <= maxRows) {
    return undefined;
  }

  const visibleSlice = rowHeights.slice(0, maxRows);
  const bodyHeight = visibleSlice.reduce((sum, h) => sum + (Number(h) || 0), 0);
  if (bodyHeight <= 0) {
    return undefined;
  }

  const theadHeight = Math.max(0, Number(params.theadHeight) || 0);
  const tfootHeight = Math.max(0, Number(params.tfootHeight) || 0);
  const borderPx =
    typeof params.borderCompensationPx === 'number' ? params.borderCompensationPx : 2;

  return Math.ceil(theadHeight + bodyHeight + tfootHeight + borderPx);
}
