import { PackingItemRow } from '../types/index.ts';
import { calculatePackingRow } from './calculations.ts';

export const REPORT_WEIGHT_DEBOUNCE_MS = 180;

/**
 * Parses a raw user input string for Report Weight (KG), clamping invalid or
 * negative values safely to 0.
 */
export function parseReportWeightInput(raw: string): number {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

/**
 * Formats a stored numeric report weight into the controlled/draft input string.
 */
export function formatReportWeightDraft(val: number | undefined): string {
  const numeric = Number(val) || 0;
  return numeric > 0 ? String(numeric) : '';
}

/**
 * Applies a committed report weight value to a single packing row and recalculates
 * totalWeight & amount. Returns the original row reference if unchanged.
 */
export function applyReportWeightToRow(
  row: PackingItemRow,
  nextReportWeight: number
): PackingItemRow {
  if (row.locked) return row;
  const sanitized = Number.isFinite(nextReportWeight) && nextReportWeight > 0 ? nextReportWeight : 0;
  const calcs = calculatePackingRow(row.box, row.weight, row.rate, sanitized);
  const currentReportWeight = Number(row.reportWeight) || 0;
  if (
    currentReportWeight === sanitized &&
    row.totalWeight === calcs.totalWeight &&
    row.amount === calcs.amount
  ) {
    return row;
  }
  return {
    ...row,
    reportWeight: sanitized,
    totalWeight: calcs.totalWeight,
    amount: calcs.amount,
  };
}

/**
 * Synchronously merges any pending debounced Report Weight (KG) drafts into the
 * row array (e.g., on form submission, print preview, or manual flush).
 */
export function reconcilePackingRowsWithReportDrafts(
  rows: PackingItemRow[],
  pendingDrafts: Record<string, string>
): PackingItemRow[] {
  const draftKeys = Object.keys(pendingDrafts);
  if (draftKeys.length === 0) return rows;
  let changed = false;
  const nextRows = rows.map((row) => {
    if (!(row.id in pendingDrafts)) return row;
    const parsed = parseReportWeightInput(pendingDrafts[row.id]);
    const updated = applyReportWeightToRow(row, parsed);
    if (updated !== row) changed = true;
    return updated;
  });
  return changed ? nextRows : rows;
}
