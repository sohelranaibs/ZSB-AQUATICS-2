import { PackingItemRow, PurchaseItemRow, RowLockReason } from '../types/index.ts';

export interface LockableRow {
  id: string;
  locked?: boolean;
  lockReason?: RowLockReason;
  lockedAt?: string;
}

export interface SavedRecordLockMeta {
  finalizedAt?: string;
  exportedAt?: string;
  createdAt?: string;
  status?: string;
}

export function isRowLocked(row: Pick<LockableRow, 'locked'> | null | undefined): boolean {
  return Boolean(row?.locked);
}

export function sanitizeRowLockReason(val: unknown): RowLockReason | undefined {
  if (val === 'manual' || val === 'finalized' || val === 'exported') {
    return val;
  }
  return undefined;
}

export function getRowLockLabel(row: Pick<LockableRow, 'locked' | 'lockReason'>): string {
  if (!row.locked) return 'Unlocked';
  if (row.lockReason === 'exported') return 'Locked (Exported)';
  if (row.lockReason === 'finalized') return 'Locked (Finalized)';
  return 'Locked';
}

export function getRowLockShortTag(row: Pick<LockableRow, 'locked' | 'lockReason'>): string {
  if (!row.locked) return '';
  if (row.lockReason === 'exported') return 'Exported';
  if (row.lockReason === 'finalized') return 'Finalized';
  return 'Locked';
}

export function isPopulatedPurchaseRow(row: PurchaseItemRow): boolean {
  return (
    row.item.trim() !== '' ||
    row.quantity !== 0 ||
    row.rate !== 0 ||
    Boolean(row.rateSpecified)
  );
}

export function isPopulatedPackingRow(row: PackingItemRow): boolean {
  return (
    row.item.trim() !== '' ||
    row.box !== 0 ||
    row.weight !== 0 ||
    (Number(row.reportWeight) || 0) !== 0 ||
    row.rate !== 0
  );
}

/**
 * Toggles lock state for a single row by id, preserving sibling object references.
 */
export function toggleRowLockById<T extends LockableRow>(
  rows: T[],
  id: string,
  reason: RowLockReason = 'manual',
  nowIso: string = new Date().toISOString()
): T[] {
  let changed = false;
  const next = rows.map((row) => {
    if (row.id !== id) return row;
    changed = true;
    if (row.locked) {
      return {
        ...row,
        locked: false,
        lockReason: undefined,
        lockedAt: undefined,
      };
    }
    return {
      ...row,
      locked: true,
      lockReason: reason,
      lockedAt: nowIso,
    };
  });
  return changed ? next : rows;
}

/**
 * Locks all populated rows with the specified reason while leaving blank rows editable.
 * Preserves `'exported'` reason if already exported and only `'finalized'` or `'manual'` is requested.
 */
export function lockPopulatedRows<T extends LockableRow>(
  rows: T[],
  isPopulated: (row: T) => boolean,
  reason: RowLockReason,
  nowIso: string = new Date().toISOString()
): T[] {
  let changed = false;
  const next = rows.map((row) => {
    if (!isPopulated(row)) return row;
    const targetReason: RowLockReason =
      row.locked && row.lockReason === 'exported' && reason !== 'exported'
        ? 'exported'
        : reason;

    if (row.locked && row.lockReason === targetReason) {
      return row;
    }
    changed = true;
    return {
      ...row,
      locked: true,
      lockReason: targetReason,
      lockedAt: row.lockedAt || nowIso,
    };
  });
  return changed ? next : rows;
}

/**
 * Unlocks all locked rows while preserving references for already-unlocked rows.
 */
export function unlockAllRows<T extends LockableRow>(rows: T[]): T[] {
  let changed = false;
  const next = rows.map((row) => {
    if (!row.locked && !row.lockReason && !row.lockedAt) return row;
    changed = true;
    return {
      ...row,
      locked: false,
      lockReason: undefined,
      lockedAt: undefined,
    };
  });
  return changed ? next : rows;
}

/**
 * Hydrates items loaded from a previously saved/finalized/exported record.
 * Existing saved items default to locked so finalized/exported records are protected
 * against accidental modifications unless explicitly unlocked.
 */
export function hydrateLoadedRowsWithFinalizedLock<T extends LockableRow>(
  items: T[],
  recordMeta?: SavedRecordLockMeta
): T[] {
  const defaultReason: RowLockReason = recordMeta?.exportedAt
    ? 'exported'
    : 'finalized';
  const defaultLockedAt =
    recordMeta?.exportedAt || recordMeta?.finalizedAt || recordMeta?.createdAt;

  return items.map((item) => {
    // Respect explicit false ONLY if the user intentionally saved an unlocked row;
    // otherwise (undefined or true), protect finalized/exported rows by default.
    if (item.locked === false) {
      return {
        ...item,
        locked: false,
        lockReason: undefined,
        lockedAt: undefined,
      };
    }

    const effectiveReason: RowLockReason =
      recordMeta?.exportedAt
        ? 'exported'
        : sanitizeRowLockReason(item.lockReason) || defaultReason;

    return {
      ...item,
      locked: true,
      lockReason: effectiveReason,
      lockedAt: item.lockedAt || defaultLockedAt,
    };
  });
}

export function countLockedRows<T extends LockableRow>(rows: T[]): number {
  return rows.reduce((count, row) => count + (row.locked ? 1 : 0), 0);
}

export function countUnlockedPopulatedRows<T extends LockableRow>(
  rows: T[],
  isPopulated: (row: T) => boolean
): number {
  return rows.reduce(
    (count, row) => count + (!row.locked && isPopulated(row) ? 1 : 0),
    0
  );
}
