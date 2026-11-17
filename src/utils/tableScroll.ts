/**
 * Shared 10-row vertical scroll viewport calculation helpers for all ledger, report & database tables.
 */

export const MAX_VISIBLE_TABLE_ROWS = 10;

export const EXCLUDED_TABLE_CONTAINER_SELECTORS = [
  '.zsb-print-paper',
  '#printable-document',
  '#printable-modal-card',
  '#partner-financial-statement-host',
  '#partner-financial-statement-printable',
  '#pdf-export-temp-container',
  '[aria-hidden="true"]',
  '[data-manual-scroll-viewport="true"]',
  '[data-row-scroll-managed="true"]',
  '[data-testid="pl-daily-report-scroll-box"]',
] as const;

export const EXCLUDED_TABLE_CONTAINER_SELECTOR = EXCLUDED_TABLE_CONTAINER_SELECTORS.join(', ');

export interface ScrollViewportHeightParams {
  theadHeight: number;
  tfootHeight?: number;
  rowHeights: number[];
  maxVisibleRows?: number;
  borderCompensationPx?: number;
}

/**
 * Computes exact pixel maxHeight for a table scroll container so only `maxVisibleRows` (default 10)
 * body rows are visible at a time with sticky header/footer and vertical scroll for rows beyond 10.
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

/**
 * Returns true if a CSS color value is visibly opaque (not empty, transparent, or rgba(..., 0)).
 */
export function isOpaqueCssColor(color: string | null | undefined): boolean {
  if (!color) return false;
  const normalized = color.trim().toLowerCase();
  if (!normalized || normalized === 'transparent' || normalized === 'none') {
    return false;
  }
  if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized)) {
    return false;
  }
  if (/^hsla\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized)) {
    return false;
  }
  return true;
}

/**
 * Picks the first opaque background color for sticky table headers/footers so scrolling rows never bleed through.
 */
export function resolveStickySectionBackground(
  candidates: Array<string | null | undefined>,
  fallbackBg = '#f8fafc'
): string {
  for (const candidate of candidates) {
    if (isOpaqueCssColor(candidate)) {
      return candidate!.trim();
    }
  }
  return fallbackBg;
}

/**
 * Builds a lightweight layout signature string for a table scroll container
 * so observers skip expensive style/geometry scans when rows and dimensions have not changed.
 */
export function computeTableScrollSignature(params: {
  rowCount: number;
  containerWidth: number;
  theadHeight: number;
  tfootHeight: number;
}): string {
  const rows = Math.max(0, Math.floor(Number(params.rowCount) || 0));
  const widthBucket = Math.round(Number(params.containerWidth) || 0);
  const headH = Math.round(Number(params.theadHeight) || 0);
  const footH = Math.round(Number(params.tfootHeight) || 0);
  return `${rows}:${widthBucket}:${headH}:${footH}`;
}
