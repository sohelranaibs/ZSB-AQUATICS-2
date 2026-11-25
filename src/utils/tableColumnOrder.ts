export type ColumnDropSide = 'before' | 'after';

export const TABLE_COLUMN_ORDER_STORAGE_KEY = 'zsb_aquatics_table_column_orders_v1';

export type StoredTableColumnOrderMap = Record<string, string[]>;

/**
 * Sanitizes a candidate column order against the canonical default column list:
 * - Drops unknown/stale column IDs
 * - Deduplicates repeated IDs while preserving first occurrence
 * - Appends any newly introduced default column IDs at the end
 */
export function sanitizeColumnOrder(
  savedOrder: unknown,
  defaultOrder: readonly string[]
): string[] {
  const defaultSet = new Set(defaultOrder);
  const seen = new Set<string>();
  const sanitized: string[] = [];

  if (Array.isArray(savedOrder)) {
    for (const rawId of savedOrder) {
      if (typeof rawId !== 'string') continue;
      if (!defaultSet.has(rawId) || seen.has(rawId)) continue;
      seen.add(rawId);
      sanitized.push(rawId);
    }
  }

  for (const defaultId of defaultOrder) {
    if (!seen.has(defaultId)) {
      seen.add(defaultId);
      sanitized.push(defaultId);
    }
  }

  return sanitized;
}

/**
 * Moves `sourceId` relative to `targetId` in an immutable column order array.
 * - When `dropSide` is `'before'`, `sourceId` is placed immediately before `targetId`.
 * - When `dropSide` is `'after'`, `sourceId` is placed immediately after `targetId`.
 * - When `dropSide` is omitted, `sourceId` takes `targetId`'s slot (standard left/right shift).
 * Returns the original array reference if no effective move occurs.
 */
export function reorderColumns(
  currentOrder: readonly string[],
  sourceId: string,
  targetId: string,
  dropSide?: ColumnDropSide
): string[] {
  if (!sourceId || !targetId || sourceId === targetId) {
    return currentOrder as string[];
  }

  const fromIndex = currentOrder.indexOf(sourceId);
  const toIndex = currentOrder.indexOf(targetId);

  if (fromIndex === -1 || toIndex === -1) {
    return currentOrder as string[];
  }

  const next = [...currentOrder];
  const [moved] = next.splice(fromIndex, 1);

  let insertIndex: number;
  if (dropSide === 'before') {
    const updatedTargetIndex = next.indexOf(targetId);
    insertIndex = updatedTargetIndex;
  } else if (dropSide === 'after') {
    const updatedTargetIndex = next.indexOf(targetId);
    insertIndex = updatedTargetIndex + 1;
  } else {
    insertIndex = toIndex;
  }

  next.splice(insertIndex, 0, moved);

  const unchanged = next.every((id, idx) => id === currentOrder[idx]);
  return unchanged ? (currentOrder as string[]) : next;
}

/**
 * Shifts a column one position left (-1) or right (+1) for keyboard accessibility.
 * Returns the original array reference when already at the boundary or invalid.
 */
export function moveColumnByOffset(
  currentOrder: readonly string[],
  columnId: string,
  delta: -1 | 1
): string[] {
  const index = currentOrder.indexOf(columnId);
  if (index === -1) return currentOrder as string[];

  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= currentOrder.length) {
    return currentOrder as string[];
  }

  const next = [...currentOrder];
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

/**
 * Returns true if `currentOrder` differs from `defaultOrder`.
 */
export function isCustomColumnOrder(
  currentOrder: readonly string[],
  defaultOrder: readonly string[]
): boolean {
  if (currentOrder.length !== defaultOrder.length) return true;
  for (let i = 0; i < defaultOrder.length; i++) {
    if (currentOrder[i] !== defaultOrder[i]) return true;
  }
  return false;
}

function resolveStorage(explicitStorage?: Storage | null): Storage | null {
  if (explicitStorage !== undefined) return explicitStorage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readOrderMap(storage: Storage | null): StoredTableColumnOrderMap {
  if (!storage) return {};
  try {
    const raw = storage.getItem(TABLE_COLUMN_ORDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as StoredTableColumnOrderMap;
  } catch {
    return {};
  }
}

function writeOrderMap(
  storage: Storage | null,
  map: StoredTableColumnOrderMap
): void {
  if (!storage) return;
  try {
    if (Object.keys(map).length === 0) {
      storage.removeItem(TABLE_COLUMN_ORDER_STORAGE_KEY);
    } else {
      storage.setItem(TABLE_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore quota or privacy mode errors cleanly
  }
}

export function loadTableColumnOrder(
  tableId: string,
  defaultOrder: readonly string[],
  storage?: Storage | null
): string[] {
  const store = resolveStorage(storage);
  const map = readOrderMap(store);
  return sanitizeColumnOrder(map[tableId], defaultOrder);
}

export function saveTableColumnOrder(
  tableId: string,
  order: readonly string[],
  defaultOrder: readonly string[],
  storage?: Storage | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;

  const sanitized = sanitizeColumnOrder(order, defaultOrder);
  const map = readOrderMap(store);

  if (!isCustomColumnOrder(sanitized, defaultOrder)) {
    if (Object.prototype.hasOwnProperty.call(map, tableId)) {
      delete map[tableId];
      writeOrderMap(store, map);
    }
    return;
  }

  map[tableId] = sanitized;
  writeOrderMap(store, map);
}

export function resetTableColumnOrder(
  tableId: string,
  storage?: Storage | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  const map = readOrderMap(store);
  if (Object.prototype.hasOwnProperty.call(map, tableId)) {
    delete map[tableId];
    writeOrderMap(store, map);
  }
}
