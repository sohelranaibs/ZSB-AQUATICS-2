export const TABLE_COLUMN_WIDTHS_STORAGE_PREFIX =
  'zsb_aquatics_table_column_widths_v1::';

export const MIN_COLUMN_WIDTH_PX = 48;
export const MAX_COLUMN_WIDTH_PX = 960;
export const KEYBOARD_RESIZE_STEP_PX = 12;
export const KEYBOARD_RESIZE_FAST_STEP_PX = 24;

export const RESIZE_HANDLE_ATTR = 'data-col-resize-handle';
export const RESIZE_GUIDE_OVERLAY_ID = 'zsb-col-resize-guide-overlay';

/**
 * Only print/PDF/hidden containers and explicitly opted-out containers are excluded from
 * interactive column resizing. Interactive tables with custom vertical scroll containers
 * (`data-manual-scroll-viewport`, `data-row-scroll-managed`) remain fully resizable.
 */
export const COL_RESIZE_EXCLUDED_SELECTOR = [
  '.zsb-print-paper',
  '#printable-document',
  '#printable-modal-card',
  '#partner-financial-statement-host',
  '#partner-financial-statement-printable',
  '#pdf-export-temp-container',
  '#global-pdf-export-host',
  '[aria-hidden="true"]',
  '[data-disable-col-resize="true"]',
].join(', ');

export type ColumnWidthMap = Record<string, number>;
export type UserTableColumnWidths = Record<string, ColumnWidthMap>;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Normalizes a user identifier (username or email) into a safe, stable localStorage segment.
 */
export function normalizeUserColumnWidthKey(userKey?: string | null): string {
  const raw = (userKey || '').trim().toLowerCase();
  if (!raw) return 'guest';
  const cleaned = raw.replace(/[^a-z0-9@._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'guest';
}

/**
 * Builds the per-user localStorage key used to persist table column widths.
 */
export function buildUserColumnWidthsStorageKey(
  userKey?: string | null
): string {
  return `${TABLE_COLUMN_WIDTHS_STORAGE_PREFIX}${normalizeUserColumnWidthKey(userKey)}`;
}

/**
 * Clamps a column width to safe integer pixel bounds.
 */
export function clampColumnWidth(
  widthPx: number,
  minPx: number = MIN_COLUMN_WIDTH_PX,
  maxPx: number = MAX_COLUMN_WIDTH_PX
): number {
  if (!Number.isFinite(widthPx)) {
    return Math.round(minPx);
  }
  const boundedMin = Number.isFinite(minPx) ? minPx : MIN_COLUMN_WIDTH_PX;
  const boundedMax = Number.isFinite(maxPx)
    ? Math.max(boundedMin, maxPx)
    : MAX_COLUMN_WIDTH_PX;
  return Math.round(Math.min(boundedMax, Math.max(boundedMin, widthPx)));
}

/**
 * Computes the next column width from a starting width, viewport pointer deltaX,
 * and the table's effective CSS zoom factor.
 */
export function computeResizedColumnWidth(
  startWidthPx: number,
  deltaX: number,
  zoomFactor: number = 1,
  minPx: number = MIN_COLUMN_WIDTH_PX,
  maxPx: number = MAX_COLUMN_WIDTH_PX
): number {
  const safeStart = Number.isFinite(startWidthPx) ? startWidthPx : minPx;
  const safeDelta = Number.isFinite(deltaX) ? deltaX : 0;
  const safeZoom =
    Number.isFinite(zoomFactor) && zoomFactor > 0.1 ? zoomFactor : 1;
  return clampColumnWidth(safeStart + safeDelta / safeZoom, minPx, maxPx);
}

/**
 * Normalizes header text into a compact deterministic token for fallback keys.
 */
export function normalizeHeaderToken(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/[▲▼↕↑↓⇅]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export interface TableResizeKeyParams {
  tableIdAttr?: string | null;
  firstHeaderTableId?: string | null;
  tableTestId?: string | null;
  tableDomId?: string | null;
  headerTexts: string[];
}

/**
 * Derives a stable identifier for a table across re-renders, reloads, and column reorders.
 */
export function deriveTableResizeKey(params: TableResizeKeyParams): string {
  const explicit =
    (params.tableIdAttr || '').trim() ||
    (params.firstHeaderTableId || '').trim() ||
    (params.tableTestId || '').trim() ||
    (params.tableDomId || '').trim();

  if (explicit) {
    return explicit;
  }

  const normalizedHeaders = params.headerTexts
    .map((label) => normalizeHeaderToken(label))
    .filter((token) => token.length > 0)
    .sort();

  if (normalizedHeaders.length > 0) {
    return `tbl:${normalizedHeaders.join('|')}`;
  }

  return `tbl:cols_${params.headerTexts.length}`;
}

export interface ColumnResizeKeyParams {
  columnIdAttr?: string | null;
  colKeyAttr?: string | null;
  headerText?: string | null;
  columnIndex: number;
  usedKeys: Set<string>;
}

/**
 * Derives a stable, unique key for a column within a table.
 * Prefers `data-column-id` so custom widths follow columns when reordered.
 */
export function deriveColumnResizeKey(params: ColumnResizeKeyParams): string {
  const explicit =
    (params.columnIdAttr || '').trim() || (params.colKeyAttr || '').trim();
  const base =
    explicit ||
    normalizeHeaderToken(params.headerText) ||
    `col_${params.columnIndex}`;

  if (!params.usedKeys.has(base)) {
    params.usedKeys.add(base);
    return base;
  }

  let suffix = 2;
  let candidate = `${base}__${suffix}`;
  while (params.usedKeys.has(candidate)) {
    suffix += 1;
    candidate = `${base}__${suffix}`;
  }
  params.usedKeys.add(candidate);
  return candidate;
}

/**
 * Validates and clamps a parsed localStorage payload into a clean table->column->width map.
 */
export function sanitizeUserColumnWidthsMap(
  raw: unknown
): UserTableColumnWidths {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const sanitized: UserTableColumnWidths = {};
  for (const [tableKey, tableVal] of Object.entries(
    raw as Record<string, unknown>
  )) {
    const cleanTableKey = tableKey.trim();
    if (!cleanTableKey || !tableVal || typeof tableVal !== 'object' || Array.isArray(tableVal)) {
      continue;
    }

    const colMap: ColumnWidthMap = {};
    for (const [colKey, widthVal] of Object.entries(
      tableVal as Record<string, unknown>
    )) {
      const cleanColKey = colKey.trim();
      if (!cleanColKey) continue;
      if (typeof widthVal !== 'number' || !Number.isFinite(widthVal) || widthVal <= 0) {
        continue;
      }
      colMap[cleanColKey] = clampColumnWidth(widthVal);
    }

    if (Object.keys(colMap).length > 0) {
      sanitized[cleanTableKey] = colMap;
    }
  }

  return sanitized;
}

/**
 * Loads persisted custom column widths for a specific user from localStorage.
 */
export function loadUserColumnWidths(
  userKey: string | null | undefined,
  storage: StorageLike | null = getDefaultStorage()
): UserTableColumnWidths {
  if (!storage) return {};
  const storageKey = buildUserColumnWidthsStorageKey(userKey);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return {};
    return sanitizeUserColumnWidthsMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * Persists a user's full column width map to localStorage (or removes the key if empty).
 */
export function persistUserColumnWidths(
  userKey: string | null | undefined,
  widths: UserTableColumnWidths,
  storage: StorageLike | null = getDefaultStorage()
): UserTableColumnWidths {
  const sanitized = sanitizeUserColumnWidthsMap(widths);
  if (!storage) return sanitized;

  const storageKey = buildUserColumnWidthsStorageKey(userKey);
  try {
    if (Object.keys(sanitized).length === 0) {
      storage.removeItem(storageKey);
    } else {
      storage.setItem(storageKey, JSON.stringify(sanitized));
    }
  } catch {
    // Ignore quota or storage restriction errors
  }
  return sanitized;
}

/**
 * Saves a single resized column width for the given user and table.
 */
export function saveColumnWidthForUser(
  userKey: string | null | undefined,
  tableKey: string,
  colKey: string,
  widthPx: number,
  storage: StorageLike | null = getDefaultStorage()
): UserTableColumnWidths {
  const cleanTableKey = tableKey.trim();
  const cleanColKey = colKey.trim();
  const current = loadUserColumnWidths(userKey, storage);
  if (!cleanTableKey || !cleanColKey) return current;

  const next: UserTableColumnWidths = {
    ...current,
    [cleanTableKey]: {
      ...(current[cleanTableKey] || {}),
      [cleanColKey]: clampColumnWidth(widthPx),
    },
  };
  return persistUserColumnWidths(userKey, next, storage);
}

/**
 * Removes a single custom column width for the given user and table (e.g. double-click reset).
 */
export function removeColumnWidthForUser(
  userKey: string | null | undefined,
  tableKey: string,
  colKey: string,
  storage: StorageLike | null = getDefaultStorage()
): UserTableColumnWidths {
  const cleanTableKey = tableKey.trim();
  const cleanColKey = colKey.trim();
  const current = loadUserColumnWidths(userKey, storage);
  if (!cleanTableKey || !cleanColKey || !current[cleanTableKey]) {
    return current;
  }

  const nextTable = { ...current[cleanTableKey] };
  delete nextTable[cleanColKey];

  const next: UserTableColumnWidths = { ...current };
  if (Object.keys(nextTable).length === 0) {
    delete next[cleanTableKey];
  } else {
    next[cleanTableKey] = nextTable;
  }

  return persistUserColumnWidths(userKey, next, storage);
}

/**
 * Clears all custom column widths for a given table for the specified user.
 */
export function resetTableColumnWidthsForUser(
  userKey: string | null | undefined,
  tableKey: string,
  storage: StorageLike | null = getDefaultStorage()
): UserTableColumnWidths {
  const cleanTableKey = tableKey.trim();
  const current = loadUserColumnWidths(userKey, storage);
  if (!cleanTableKey || !current[cleanTableKey]) {
    return current;
  }
  const next: UserTableColumnWidths = { ...current };
  delete next[cleanTableKey];
  return persistUserColumnWidths(userKey, next, storage);
}
