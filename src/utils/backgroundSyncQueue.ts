import type {
  MortalityRecord,
  OtherCostRecord,
  PackingRecord,
  PaymentRecord,
  PurchaseRecord,
} from '../types/index.ts';

export type OfflineSyncEntityType =
  | 'purchase'
  | 'packing'
  | 'payment'
  | 'other_cost'
  | 'mortality';

export type OfflineSyncOperation = 'create' | 'update';

export interface OfflineSyncAction<TPayload = unknown> {
  id: string;
  entity: OfflineSyncEntityType;
  operation: OfflineSyncOperation;
  recordId: string;
  label: string;
  summary: string;
  payload: TPayload;
  queuedAt: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

export interface SyncQueueCollections {
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts: OtherCostRecord[];
  mortalities: MortalityRecord[];
}

export interface ApplySyncQueueResult {
  collections: SyncQueueCollections;
  appliedIds: string[];
  appliedCount: number;
  countsByEntity: Record<OfflineSyncEntityType, number>;
}

export interface SyncQueueSummary {
  totalPending: number;
  byEntity: Record<OfflineSyncEntityType, number>;
  oldestQueuedAt: string | null;
}

export const BG_SYNC_TAG = 'zsb-offline-data-sync';
export const BG_SYNC_CHANNEL_NAME = 'zsb-bg-sync-channel';
export const BG_SYNC_DB_NAME = 'zsb_bg_sync_queue_db';
export const BG_SYNC_STORE_NAME = 'sync_queue';

export function createOfflineSyncAction<TPayload = unknown>(params: {
  entity: OfflineSyncEntityType;
  operation: OfflineSyncOperation;
  recordId: string;
  label: string;
  summary: string;
  payload: TPayload;
  queuedAt?: string;
  id?: string;
}): OfflineSyncAction<TPayload> {
  const queuedAt = params.queuedAt || new Date().toISOString();
  const id =
    params.id ||
    `sync-${params.entity}-${params.operation}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  return {
    id,
    entity: params.entity,
    operation: params.operation,
    recordId: params.recordId,
    label: params.label,
    summary: params.summary,
    payload: params.payload,
    queuedAt,
    attempts: 0,
    status: 'pending',
  };
}

/**
 * Sorts queued offline actions in deterministic FIFO chronological order.
 */
export function sortQueueChronologically(
  actions: OfflineSyncAction[]
): OfflineSyncAction[] {
  return [...actions].sort((a, b) => {
    const timeDiff = Date.parse(a.queuedAt) - Date.parse(b.queuedAt);
    if (!Number.isNaN(timeDiff) && timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Deduplicates queued actions by action ID while preserving FIFO order.
 */
export function deduplicateQueuedActions(
  actions: OfflineSyncAction[]
): OfflineSyncAction[] {
  const seen = new Set<string>();
  const ordered = sortQueueChronologically(actions);
  const result: OfflineSyncAction[] = [];

  for (const item of ordered) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function applyCreateOrUpdate<T extends { id: string }>(
  list: T[],
  operation: OfflineSyncOperation,
  recordId: string,
  payload: unknown
): T[] {
  if (operation === 'create') {
    const record = payload as T;
    const existsIndex = list.findIndex((item) => item.id === record.id);
    if (existsIndex >= 0) {
      // Idempotent merge: update existing record rather than duplicating
      return list.map((item, idx) =>
        idx === existsIndex ? { ...item, ...record } : item
      );
    }
    return [record, ...list];
  }

  const patch = payload as Partial<T>;
  return list.map((item) => (item.id === recordId ? { ...item, ...patch } : item));
}

/**
 * Pure, idempotent reducer that replays queued offline actions onto ERP collections
 * in FIFO order once connectivity is restored.
 */
export function applyQueuedActionsToCollections(
  current: SyncQueueCollections,
  actions: OfflineSyncAction[]
): ApplySyncQueueResult {
  const ordered = deduplicateQueuedActions(actions);
  let purchases = [...current.purchases];
  let packings = [...current.packings];
  let payments = [...current.payments];
  let otherCosts = [...current.otherCosts];
  let mortalities = [...current.mortalities];

  const appliedIds: string[] = [];
  const countsByEntity: Record<OfflineSyncEntityType, number> = {
    purchase: 0,
    packing: 0,
    payment: 0,
    other_cost: 0,
    mortality: 0,
  };

  for (const action of ordered) {
    switch (action.entity) {
      case 'purchase':
        purchases = applyCreateOrUpdate(
          purchases,
          action.operation,
          action.recordId,
          action.payload
        );
        countsByEntity.purchase += 1;
        appliedIds.push(action.id);
        break;
      case 'packing':
        packings = applyCreateOrUpdate(
          packings,
          action.operation,
          action.recordId,
          action.payload
        );
        countsByEntity.packing += 1;
        appliedIds.push(action.id);
        break;
      case 'payment':
        payments = applyCreateOrUpdate(
          payments,
          action.operation,
          action.recordId,
          action.payload
        );
        countsByEntity.payment += 1;
        appliedIds.push(action.id);
        break;
      case 'other_cost':
        otherCosts = applyCreateOrUpdate(
          otherCosts,
          action.operation,
          action.recordId,
          action.payload
        );
        countsByEntity.other_cost += 1;
        appliedIds.push(action.id);
        break;
      case 'mortality':
        mortalities = applyCreateOrUpdate(
          mortalities,
          action.operation,
          action.recordId,
          action.payload
        );
        countsByEntity.mortality += 1;
        appliedIds.push(action.id);
        break;
    }
  }

  return {
    collections: {
      purchases,
      packings,
      payments,
      otherCosts,
      mortalities,
    },
    appliedIds,
    appliedCount: appliedIds.length,
    countsByEntity,
  };
}

export function summarizeSyncQueue(actions: OfflineSyncAction[]): SyncQueueSummary {
  const ordered = deduplicateQueuedActions(actions);
  const byEntity: Record<OfflineSyncEntityType, number> = {
    purchase: 0,
    packing: 0,
    payment: 0,
    other_cost: 0,
    mortality: 0,
  };

  for (const item of ordered) {
    byEntity[item.entity] = (byEntity[item.entity] || 0) + 1;
  }

  return {
    totalPending: ordered.length,
    byEntity,
    oldestQueuedAt: ordered.length > 0 ? ordered[0].queuedAt : null,
  };
}

export function formatEntityDisplayName(entity: OfflineSyncEntityType): string {
  switch (entity) {
    case 'purchase':
      return 'Purchase Bill';
    case 'packing':
      return 'Export Packing';
    case 'payment':
      return 'Payment Voucher';
    case 'other_cost':
      return 'Operating Cost';
    case 'mortality':
      return 'Mortality Log';
  }
}
