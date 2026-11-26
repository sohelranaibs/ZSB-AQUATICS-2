export const PRINT_COLUMN_VISIBILITY_STORAGE_KEY =
  'zsb_aquatics_print_hidden_columns_v1';

export type PrintColumnCategory = 'core' | 'metadata' | 'debug';

export interface PrintColumnDescriptor {
  id: string;
  tableKey: string;
  tableIndex: number;
  tableTitle: string;
  colIndex: number;
  colKey: string;
  label: string;
  category: PrintColumnCategory;
  defaultHidden: boolean;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const DEBUG_COLUMN_PATTERN =
  /\b(debug|raw|json|uuid|guid|trace|stack|hash|checksum|meta(?:data)?|internal[\s_-]?id|record[\s_-]?id|system[\s_-]?id|audit[\s_-]?id|row[\s_-]?id|created[\s_-]?at|updated[\s_-]?at|synced[\s_-]?at|modified[\s_-]?at|user[\s_-]?agent|ip[\s_-]?address|schema[\s_-]?ver|revision)\b/i;

const EXACT_DEBUG_TOKEN_SET = new Set([
  'id',
  '_id',
  '__id',
  'uid',
  'uuid',
  'meta',
  'metadata',
  'debug',
  'raw',
  'trace',
  'hash',
]);

const SERIAL_COLUMN_PATTERN = /^(sl|sl\s*#|s\.?l\.?|#|no\.?|sr\.?\s*no\.?)$/i;

const METADATA_COLUMN_PATTERN =
  /\b(status|type|unit|contact|phone|mobile|notes?|remarks?|location|ref(?:erence)?\s*no|doc\s*\/\s*ref|voucher\s*no|timestamp|created\s*by|updated\s*by|actor|role|module|action|category|source|stock\s*adjustment\s*impact|report\s*wt)\b/i;

/**
 * Normalizes a column header label into a compact deterministic token.
 */
export function normalizePrintColToken(
  label: string | null | undefined,
  fallbackIdx: number = 0
): string {
  const cleaned = (label || '')
    .replace(/[▲▼↕↑↓⇅]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return cleaned || `col_${fallbackIdx}`;
}

/**
 * Classifies a print table column into core business data, auxiliary metadata, or debug/technical info.
 * True debug/technical columns default to hidden so exported A4 layouts stay clean automatically.
 */
export function classifyPrintColumn(
  label: string,
  colKey?: string
): { category: PrintColumnCategory; defaultHidden: boolean } {
  const cleanLabel = (label || '').replace(/\s+/g, ' ').trim();
  const cleanKey = (colKey || '').trim().toLowerCase();
  const normalizedLabel = cleanLabel.toLowerCase();

  if (
    EXACT_DEBUG_TOKEN_SET.has(cleanKey) ||
    EXACT_DEBUG_TOKEN_SET.has(normalizedLabel) ||
    DEBUG_COLUMN_PATTERN.test(cleanLabel) ||
    DEBUG_COLUMN_PATTERN.test(cleanKey)
  ) {
    return { category: 'debug', defaultHidden: true };
  }

  if (
    SERIAL_COLUMN_PATTERN.test(cleanLabel) ||
    METADATA_COLUMN_PATTERN.test(cleanLabel) ||
    METADATA_COLUMN_PATTERN.test(cleanKey)
  ) {
    return { category: 'metadata', defaultHidden: false };
  }

  return { category: 'core', defaultHidden: false };
}

/**
 * Builds a stable unique identifier for a column within a specific print table.
 */
export function buildPrintColumnId(tableKey: string, colKey: string): string {
  return `${tableKey}::${colKey}`;
}

/**
 * Builds a stable persistence signature for a print preview document's discovered table structure.
 */
export function buildPrintDocumentColumnSignature(
  docType: string,
  columns: PrintColumnDescriptor[]
): string {
  const safeType = (docType || 'doc').trim().toLowerCase() || 'doc';
  const colSig = columns.map((c) => c.id).join('|');
  return `${safeType}::${colSig}`;
}

/**
 * Computes the visible colSpan for a table cell starting at `cellStartCol` with `origColSpan`
 * when a set of logical column indices are hidden. Returns 0 if the entire cell should be hidden.
 */
export function computeAdjustedCellSpan(
  cellStartCol: number,
  origColSpan: number,
  hiddenColIndices: ReadonlySet<number>
): number {
  const safeStart = Math.max(0, Math.floor(cellStartCol));
  const safeSpan = Math.max(1, Math.floor(origColSpan));
  let visibleCount = 0;
  for (let i = 0; i < safeSpan; i++) {
    if (!hiddenColIndices.has(safeStart + i)) {
      visibleCount += 1;
    }
  }
  return visibleCount;
}

/**
 * Proportionally re-normalizes `<col>` percentage widths across remaining visible columns
 * so the table continues filling 100% of the A4 printable width cleanly.
 */
export function computeNormalizedColWidths(
  origPercentWidths: Array<number | null>,
  hiddenColIndices: ReadonlySet<number>
): Array<string | null> {
  const result: Array<string | null> = new Array(origPercentWidths.length).fill(null);

  const visibleIndices: number[] = [];
  let visibleWeightSum = 0;
  let allVisibleHavePercent = true;

  for (let i = 0; i < origPercentWidths.length; i++) {
    if (hiddenColIndices.has(i)) continue;
    visibleIndices.push(i);
    const w = origPercentWidths[i];
    if (typeof w === 'number' && Number.isFinite(w) && w > 0) {
      visibleWeightSum += w;
    } else {
      allVisibleHavePercent = false;
    }
  }

  if (visibleIndices.length === 0) {
    return result;
  }

  if (!allVisibleHavePercent || visibleWeightSum <= 0) {
    // Distribute evenly if original table used mixed or non-percentage widths
    const hasAnyPercent = origPercentWidths.some(
      (w) => typeof w === 'number' && Number.isFinite(w) && w > 0
    );
    if (!hasAnyPercent) {
      return result;
    }
    const equalPct = Math.floor((10000 / visibleIndices.length)) / 100;
    let assigned = 0;
    for (let idx = 0; idx < visibleIndices.length; idx++) {
      const colIdx = visibleIndices[idx];
      const pct =
        idx === visibleIndices.length - 1
          ? Math.round((100 - assigned) * 100) / 100
          : equalPct;
      assigned += pct;
      result[colIdx] = `${pct}%`;
    }
    return result;
  }

  let assigned = 0;
  for (let idx = 0; idx < visibleIndices.length; idx++) {
    const colIdx = visibleIndices[idx];
    const orig = origPercentWidths[colIdx] as number;
    const pct =
      idx === visibleIndices.length - 1
        ? Math.round((100 - assigned) * 100) / 100
        : Math.round(((orig / visibleWeightSum) * 100) * 100) / 100;
    assigned += pct;
    result[colIdx] = `${Math.max(1, pct)}%`;
  }

  return result;
}

/**
 * Ensures every table keeps at least one visible column.
 */
export function enforceMinimumVisibleColumns(
  candidateHiddenIds: Iterable<string>,
  allColumns: PrintColumnDescriptor[]
): string[] {
  const validIds = new Set(allColumns.map((c) => c.id));
  const hiddenSet = new Set<string>();
  for (const id of candidateHiddenIds) {
    if (validIds.has(id)) {
      hiddenSet.add(id);
    }
  }

  const byTable = new Map<string, PrintColumnDescriptor[]>();
  for (const col of allColumns) {
    const list = byTable.get(col.tableKey) || [];
    list.push(col);
    byTable.set(col.tableKey, list);
  }

  for (const [, cols] of byTable.entries()) {
    const visibleCount = cols.filter((c) => !hiddenSet.has(c.id)).length;
    if (visibleCount === 0 && cols.length > 0) {
      // Keep the first core column if available, otherwise the first column
      const fallbackKeep =
        cols.find((c) => c.category === 'core') || cols[0];
      hiddenSet.delete(fallbackKeep.id);
    }
  }

  return Array.from(hiddenSet);
}

/**
 * Returns default hidden column IDs (auto-hides technical/debug columns while keeping business columns visible).
 */
export function buildDefaultHiddenColumnIds(
  allColumns: PrintColumnDescriptor[]
): string[] {
  const defaults = allColumns
    .filter((c) => c.defaultHidden)
    .map((c) => c.id);
  return enforceMinimumVisibleColumns(defaults, allColumns);
}

/**
 * Computes the "Clean A4" preset: hides all debug and auxiliary metadata columns
 * while keeping core financial/operational columns (and at least 1 column per table) visible.
 */
export function computeCleanA4HiddenColumnIds(
  allColumns: PrintColumnDescriptor[]
): string[] {
  const nonCore = allColumns
    .filter((c) => c.category === 'debug' || c.category === 'metadata')
    .map((c) => c.id);
  return enforceMinimumVisibleColumns(nonCore, allColumns);
}

/**
 * Toggles a single column's visibility while guaranteeing at least 1 visible column per table.
 */
export function togglePrintColumnVisibility(
  currentHiddenIds: string[],
  columnId: string,
  allColumns: PrintColumnDescriptor[]
): string[] {
  const target = allColumns.find((c) => c.id === columnId);
  if (!target) return currentHiddenIds;

  const hiddenSet = new Set(currentHiddenIds);
  if (hiddenSet.has(columnId)) {
    hiddenSet.delete(columnId);
    return Array.from(hiddenSet);
  }

  const tableCols = allColumns.filter((c) => c.tableKey === target.tableKey);
  const visibleInTable = tableCols.filter((c) => !hiddenSet.has(c.id)).length;
  if (visibleInTable <= 1) {
    return currentHiddenIds;
  }

  hiddenSet.add(columnId);
  return Array.from(hiddenSet);
}

function readStorageMap(
  storage: StorageLike | null
): Record<string, string[]> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PRINT_COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const clean: Record<string, string[]> = {};
    for (const [sig, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        clean[sig] = val.filter((item): item is string => typeof item === 'string');
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function loadSavedPrintHiddenColumns(
  docSignature: string,
  storage: StorageLike | null = getDefaultStorage()
): string[] | null {
  if (!docSignature) return null;
  const map = readStorageMap(storage);
  return Object.prototype.hasOwnProperty.call(map, docSignature)
    ? map[docSignature]
    : null;
}

export function savePrintHiddenColumns(
  docSignature: string,
  hiddenIds: string[],
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage || !docSignature) return;
  try {
    const map = readStorageMap(storage);
    map[docSignature] = Array.from(new Set(hiddenIds));
    // Keep storage compact (max 40 most recent document signatures)
    const keys = Object.keys(map);
    if (keys.length > 40) {
      const excess = keys.length - 40;
      for (let i = 0; i < excess; i++) {
        delete map[keys[i]];
      }
    }
    storage.setItem(PRINT_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota or access errors
  }
}

export function clearSavedPrintHiddenColumns(
  docSignature: string,
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage || !docSignature) return;
  try {
    const map = readStorageMap(storage);
    if (!Object.prototype.hasOwnProperty.call(map, docSignature)) return;
    delete map[docSignature];
    if (Object.keys(map).length === 0) {
      storage.removeItem(PRINT_COLUMN_VISIBILITY_STORAGE_KEY);
    } else {
      storage.setItem(PRINT_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage access errors
  }
}
