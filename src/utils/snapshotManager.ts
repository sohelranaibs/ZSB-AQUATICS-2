import {
  CompanyProfile,
  DropdownOptions,
  PackingFormDraft,
  PackingRecord,
  PaymentRecord,
  PurchaseRecord,
  OtherCostRecord,
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionRecord,
  BalanceIncomeRecord,
} from '../types/index.ts';
import { deduplicateRecords, generateRecordId } from './idGenerator.ts';
import { calculatePackingTotalAmountBDT } from './calculations.ts';

export type SnapshotTrigger =
  | 'manual'
  | 'auto_pre_clear'
  | 'auto_pre_restore'
  | 'imported_file';

export interface SnapshotPayload {
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts: OtherCostRecord[];
  partnerDeposits?: PartnerDepositRecord[];
  partnerWithdrawals?: PartnerWithdrawalRecord[];
  profitDistributions?: ProfitDistributionRecord[];
  balanceIncomes?: BalanceIncomeRecord[];
  companyProfile?: CompanyProfile;
  dropdownOptions?: DropdownOptions;
  packingDraft?: PackingFormDraft;
}

export interface SnapshotRecordCounts {
  purchases: number;
  packings: number;
  payments: number;
  otherCosts: number;
  totalRecords: number;
}

export interface SnapshotFinancialSummary {
  totalPurchaseTk: number;
  totalExportRmb: number;
  totalExportTk: number;
  totalPaymentTk: number;
  totalExpenseTk: number;
}

export interface DatabaseSnapshot {
  id: string;
  schemaVersion: number;
  appIdentifier: 'ZSB_AQUATICS_ENTERPRISE_LEDGER';
  label: string;
  notes?: string;
  createdAt: string;
  trigger: SnapshotTrigger;
  recordCounts: SnapshotRecordCounts;
  financialSummary: SnapshotFinancialSummary;
  checksum: string;
  payload: SnapshotPayload;
}

export interface SnapshotValidationResult {
  valid: boolean;
  error?: string;
  warnings: string[];
  snapshot?: DatabaseSnapshot;
}

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_APP_IDENTIFIER = 'ZSB_AQUATICS_ENTERPRISE_LEDGER' as const;
export const DEFAULT_MAX_SNAPSHOTS = 25;
export const DEFAULT_SNAPSHOT_RETENTION_DAYS = 30;
export const DEFAULT_MIN_RETAINED_SNAPSHOTS = 1;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SnapshotRetentionItemStatus {
  snapshotId: string;
  ageDays: number;
  ageMs: number;
  isOlderThanThreshold: boolean;
  isFlaggedForDeletion: boolean;
  isProtectedRecent: boolean;
  estimatedBytes: number;
}

export interface SnapshotCleanupPlan {
  retainedSnapshots: DatabaseSnapshot[];
  flaggedSnapshots: DatabaseSnapshot[];
  flaggedIds: string[];
  protectedSnapshotIds: string[];
  protectedExpiredCount: number;
  statusById: Record<string, SnapshotRetentionItemStatus>;
  totalStorageBytes: number;
  reclaimableStorageBytes: number;
  retainedStorageBytes: number;
  maxAgeDays: number;
  minRetainedCount: number;
  evaluatedAtIso: string;
}

export interface SnapshotCleanupResult {
  retainedSnapshots: DatabaseSnapshot[];
  deletedSnapshots: DatabaseSnapshot[];
  deletedIds: string[];
  deletedCount: number;
  retainedCount: number;
  protectedExpiredCount: number;
  reclaimedBytes: number;
  remainingBytes: number;
  maxAgeDays: number;
  minRetainedCount: number;
  cleanedAtIso: string;
}


/**
 * Deep-clones JSON-serializable data to guarantee snapshot immutability.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Deterministic lightweight FNV-1a 32-bit hex checksum over core snapshot payload.
 */
export function computeSnapshotChecksum(payload: SnapshotPayload): string {
  const canonical = JSON.stringify({
    p: (payload.purchases || []).map((r) => [r.id, r.invoiceNumber, Number(r.totalAmount) || 0]),
    k: (payload.packings || []).map((r) => [r.id, r.invoiceNumber, Number(r.totalAmount) || 0]),
    m: (payload.payments || []).map((r) => [r.id, r.invoiceNumber, Number(r.paidAmount) || 0]),
    c: (payload.otherCosts || []).map((r) => [r.id, r.category, Number(r.amount) || 0]),
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `zsb-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Calculates record counts and financial totals for a snapshot payload.
 */
export function calculateSnapshotMetrics(payload: SnapshotPayload): {
  recordCounts: SnapshotRecordCounts;
  financialSummary: SnapshotFinancialSummary;
} {
  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  const packings = Array.isArray(payload.packings) ? payload.packings : [];
  const payments = Array.isArray(payload.payments) ? payload.payments : [];
  const otherCosts = Array.isArray(payload.otherCosts) ? payload.otherCosts : [];

  const rmbFallbackRate = Number(payload.companyProfile?.rmbExchangeRate) || 16.5;

  const totalPurchaseTk =
    Math.round(
      purchases.reduce((sum, p) => sum + (Number(p?.totalAmount) || 0), 0) * 100
    ) / 100;

  const totalExportRmb =
    Math.round(
      packings.reduce((sum, p) => sum + (Number(p?.totalAmount) || 0), 0) * 100
    ) / 100;

  const totalExportTk =
    Math.round(
      packings.reduce((sum, p) => {
        const rate = p?.rmbRate !== undefined ? Number(p.rmbRate) || 0 : rmbFallbackRate;
        const bdt =
          p?.totalAmountBDT !== undefined && Number(p.totalAmountBDT) > 0
            ? Number(p.totalAmountBDT)
            : calculatePackingTotalAmountBDT(Number(p?.totalAmount) || 0, rate);
        return sum + bdt;
      }, 0) * 100
    ) / 100;

  const totalPaymentTk =
    Math.round(
      payments.reduce((sum, p) => sum + (Number(p?.paidAmount) || 0), 0) * 100
    ) / 100;

  const totalExpenseTk =
    Math.round(
      otherCosts.reduce((sum, c) => sum + (Number(c?.amount) || 0), 0) * 100
    ) / 100;

  const recordCounts: SnapshotRecordCounts = {
    purchases: purchases.length,
    packings: packings.length,
    payments: payments.length,
    otherCosts: otherCosts.length,
    totalRecords: purchases.length + packings.length + payments.length + otherCosts.length,
  };

  return {
    recordCounts,
    financialSummary: {
      totalPurchaseTk,
      totalExportRmb,
      totalExportTk,
      totalPaymentTk,
      totalExpenseTk,
    },
  };
}

/**
 * Sanitizes and repairs an array of purchase records so corrupted fields do not break the app.
 */
function sanitizePurchaseRecords(raw: unknown[], warnings: string[]): PurchaseRecord[] {
  const valid: PurchaseRecord[] = [];
  const now = new Date().toISOString();

  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(`Skipped malformed purchase record at index ${idx}.`);
      return;
    }
    const r = item as Record<string, any>;
    const items = Array.isArray(r.items)
      ? r.items
          .filter((row) => row && typeof row === 'object')
          .map((row, rowIdx) => ({
            id: typeof row.id === 'string' && row.id ? row.id : `${idx + 1}-${rowIdx + 1}`,
            item: String(row.item ?? ''),
            quantity: Number(row.quantity) || 0,
            rate: Number(row.rate) || 0,
            totalAmount: Number(row.totalAmount) || 0,
            previousAmount: Number(row.previousAmount) || 0,
            paidAmount: Number(row.paidAmount) || 0,
            balance: Number(row.balance) || 0,
          }))
      : [];

    valid.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : generateRecordId('pur'),
      invoiceNumber:
        typeof r.invoiceNumber === 'string' && r.invoiceNumber.trim()
          ? r.invoiceNumber.trim()
          : `PUR-RESTORED-${idx + 1}`,
      date:
        typeof r.date === 'string' && r.date.trim() ? r.date.trim() : now.slice(0, 10),
      description: String(r.description ?? 'Restored Supplier'),
      contactNumber: String(r.contactNumber ?? ''),
      items,
      totalQty: Number(r.totalQty) || items.reduce((s, it) => s + it.quantity, 0),
      totalAmount: Number(r.totalAmount) || items.reduce((s, it) => s + it.totalAmount, 0),
      previousAmount: Number(r.previousAmount) || 0,
      paidAmount: Number(r.paidAmount) || 0,
      balance: Number(r.balance) || 0,
      remarks: r.remarks ? String(r.remarks) : undefined,
      createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : now,
    });
  });

  return deduplicateRecords(valid, 'pur');
}

/**
 * Sanitizes and repairs an array of packing records.
 */
function sanitizePackingRecords(raw: unknown[], warnings: string[]): PackingRecord[] {
  const valid: PackingRecord[] = [];
  const now = new Date().toISOString();

  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(`Skipped malformed packing record at index ${idx}.`);
      return;
    }
    const r = item as Record<string, any>;
    const items = Array.isArray(r.items)
      ? r.items
          .filter((row) => row && typeof row === 'object')
          .map((row, rowIdx) => ({
            id: typeof row.id === 'string' && row.id ? row.id : `${idx + 1}-${rowIdx + 1}`,
            item: String(row.item ?? ''),
            box: Number(row.box) || 0,
            weight: Number(row.weight) || 0,
            totalWeight: Number(row.totalWeight) || (Number(row.box) || 0) * (Number(row.weight) || 0),
            unit: String(row.unit ?? 'KG'),
            rate: Number(row.rate) || 0,
            amount: Number(row.amount) || 0,
          }))
      : [];

    const packingDate =
      typeof r.packingDate === 'string' && r.packingDate.trim()
        ? r.packingDate.trim()
        : now.slice(0, 10);

    valid.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : generateRecordId('pkg'),
      invoiceNumber:
        typeof r.invoiceNumber === 'string' && r.invoiceNumber.trim()
          ? r.invoiceNumber.trim()
          : `PKG-RESTORED-${idx + 1}`,
      shippingMark: String(r.shippingMark ?? ''),
      flight: String(r.flight ?? ''),
      destination: String(r.destination ?? ''),
      shipper: String(r.shipper ?? ''),
      packingDate,
      fromDate: typeof r.fromDate === 'string' ? r.fromDate : packingDate,
      toDate: typeof r.toDate === 'string' ? r.toDate : packingDate,
      items,
      totalBox: Number(r.totalBox) || items.reduce((s, it) => s + it.box, 0),
      totalWeight: Number(r.totalWeight) || items.reduce((s, it) => s + it.totalWeight, 0),
      totalAmount: Number(r.totalAmount) || items.reduce((s, it) => s + it.amount, 0),
      rmbRate: r.rmbRate !== undefined ? Number(r.rmbRate) || 0 : undefined,
      totalAmountBDT: r.totalAmountBDT !== undefined ? Number(r.totalAmountBDT) || 0 : undefined,
      rmbAmount: r.rmbAmount !== undefined ? Number(r.rmbAmount) || 0 : undefined,
      settledAmount: r.settledAmount !== undefined ? Number(r.settledAmount) || 0 : undefined,
      debitAmount: r.debitAmount !== undefined ? Number(r.debitAmount) || 0 : undefined,
      reportAmount: r.reportAmount !== undefined ? Number(r.reportAmount) || 0 : undefined,
      creditAmount: r.creditAmount !== undefined ? Number(r.creditAmount) || 0 : undefined,
      balanceAmount: r.balanceAmount !== undefined ? Number(r.balanceAmount) || 0 : undefined,
      exporterStatus: r.exporterStatus ? String(r.exporterStatus) : undefined,
      paymentStatus: r.paymentStatus ? String(r.paymentStatus) : undefined,
      paymentDate: r.paymentDate ? String(r.paymentDate) : undefined,
      billSite: r.billSite ? String(r.billSite) : undefined,
      remarks: r.remarks ? String(r.remarks) : undefined,
      createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : now,
    });
  });

  return deduplicateRecords(valid, 'pkg');
}

/**
 * Sanitizes and repairs an array of payment records.
 */
function sanitizePaymentRecords(raw: unknown[], warnings: string[]): PaymentRecord[] {
  const valid: PaymentRecord[] = [];
  const now = new Date().toISOString();

  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(`Skipped malformed payment record at index ${idx}.`);
      return;
    }
    const r = item as Record<string, any>;
    const items = Array.isArray(r.items)
      ? r.items
          .filter((row) => row && typeof row === 'object')
          .map((row, rowIdx) => ({
            id: typeof row.id === 'string' && row.id ? row.id : `${idx + 1}-${rowIdx + 1}`,
            description: String(row.description ?? ''),
            debitAmount: Number(row.debitAmount) || 0,
            ...(row.reportAmount !== undefined ? { reportAmount: Number(row.reportAmount) || 0 } : {}),
            creditAmount: Number(row.creditAmount) || 0,
            balance: Number(row.balance) || (Number(row.reportAmount ?? row.debitAmount) || 0) - (Number(row.creditAmount) || 0),
          }))
      : [];

    valid.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : generateRecordId('pay'),
      invoiceNumber:
        typeof r.invoiceNumber === 'string' && r.invoiceNumber.trim()
          ? r.invoiceNumber.trim()
          : `PAY-RESTORED-${idx + 1}`,
      date:
        typeof r.date === 'string' && r.date.trim() ? r.date.trim() : now.slice(0, 10),
      description: String(r.description ?? ''),
      contactNumber: String(r.contactNumber ?? ''),
      items,
      totalAmount: Number(r.totalAmount) || 0,
      previousAmount: Number(r.previousAmount) || 0,
      paidAmount: Number(r.paidAmount) || 0,
      balance: Number(r.balance) || 0,
      status: String(r.status ?? 'NO REPORT'),
      ...(r.reportAmount !== undefined ? { reportAmount: Number(r.reportAmount) || 0 } : {}),
      returnRMB: Number(r.returnRMB) || 0,
      returnRMBInBDT: r.returnRMBInBDT !== undefined ? Number(r.returnRMBInBDT) || 0 : undefined,
      exportGoodsRef: r.exportGoodsRef ? String(r.exportGoodsRef) : undefined,
      paymentCategory:
        r.paymentCategory === 'supplier' || r.paymentCategory === 'exporter'
          ? r.paymentCategory
          : undefined,
      shippingMark: r.shippingMark ? String(r.shippingMark) : undefined,
      remarks: r.remarks ? String(r.remarks) : undefined,
      createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : now,
    });
  });

  return deduplicateRecords(valid, 'pay');
}

/**
 * Sanitizes and repairs an array of otherCost records.
 */
function sanitizeOtherCostRecords(raw: unknown[], warnings: string[]): OtherCostRecord[] {
  const valid: OtherCostRecord[] = [];
  const now = new Date().toISOString();

  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(`Skipped malformed expense record at index ${idx}.`);
      return;
    }
    const r = item as Record<string, any>;
    valid.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : generateRecordId('cost'),
      date:
        typeof r.date === 'string' && r.date.trim() ? r.date.trim() : now.slice(0, 10),
      category: String(r.category ?? 'GENERAL'),
      amount: Number(r.amount) || 0,
      description: String(r.description ?? ''),
      refInvoice: r.refInvoice ? String(r.refInvoice) : undefined,
      createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : now,
    });
  });

  return deduplicateRecords(valid, 'cost');
}

/**
 * Human-readable badge description for snapshot trigger types.
 */
export function describeSnapshotTrigger(trigger: SnapshotTrigger): string {
  switch (trigger) {
    case 'manual':
      return 'Manual Snapshot';
    case 'auto_pre_clear':
      return 'Auto Safety Backup (Pre-Clear)';
    case 'auto_pre_restore':
      return 'Auto Safety Backup (Pre-Restore)';
    case 'imported_file':
      return 'Imported JSON Archive';
    default:
      return 'Database Snapshot';
  }
}

/**
 * Creates a complete, immutable local JSON snapshot of current application records.
 */
export function createDatabaseSnapshot(
  state: SnapshotPayload,
  options?: {
    id?: string;
    label?: string;
    notes?: string;
    trigger?: SnapshotTrigger;
    createdAt?: string;
  }
): DatabaseSnapshot {
  const createdAt = options?.createdAt || new Date().toISOString();
  const trigger: SnapshotTrigger = options?.trigger || 'manual';
  const cloned = deepClone(state);
  const warnings: string[] = [];

  const sanitizedPayload: SnapshotPayload = {
    purchases: sanitizePurchaseRecords(
      Array.isArray(cloned.purchases) ? cloned.purchases : [],
      warnings
    ),
    packings: sanitizePackingRecords(
      Array.isArray(cloned.packings) ? cloned.packings : [],
      warnings
    ),
    payments: sanitizePaymentRecords(
      Array.isArray(cloned.payments) ? cloned.payments : [],
      warnings
    ),
    otherCosts: sanitizeOtherCostRecords(
      Array.isArray(cloned.otherCosts) ? cloned.otherCosts : [],
      warnings
    ),
    partnerDeposits: Array.isArray(cloned.partnerDeposits)
      ? deduplicateRecords(cloned.partnerDeposits, 'pdep')
      : undefined,
    partnerWithdrawals: Array.isArray(cloned.partnerWithdrawals)
      ? deduplicateRecords(cloned.partnerWithdrawals, 'pwdr')
      : undefined,
    profitDistributions: Array.isArray(cloned.profitDistributions)
      ? deduplicateRecords(cloned.profitDistributions, 'pdist')
      : undefined,
    balanceIncomes: Array.isArray(cloned.balanceIncomes)
      ? deduplicateRecords(cloned.balanceIncomes, 'inc')
      : undefined,
    companyProfile: cloned.companyProfile ? { ...cloned.companyProfile } : undefined,
    dropdownOptions: cloned.dropdownOptions ? { ...cloned.dropdownOptions } : undefined,
    packingDraft: cloned.packingDraft ? { ...cloned.packingDraft } : undefined,
  };

  const { recordCounts, financialSummary } = calculateSnapshotMetrics(sanitizedPayload);
  const checksum = computeSnapshotChecksum(sanitizedPayload);

  const defaultLabel =
    trigger === 'auto_pre_clear'
      ? `Auto Safety Backup (Before Clear) — ${createdAt.slice(0, 10)}`
      : trigger === 'auto_pre_restore'
      ? `Auto Safety Backup (Before Restore) — ${createdAt.slice(0, 10)}`
      : trigger === 'imported_file'
      ? `Imported JSON Archive — ${createdAt.slice(0, 10)}`
      : `Manual Snapshot — ${createdAt.replace('T', ' ').slice(0, 16)}`;

  return {
    id: options?.id || generateRecordId('snap'),
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    appIdentifier: SNAPSHOT_APP_IDENTIFIER,
    label: options?.label && options.label.trim() ? options.label.trim() : defaultLabel,
    notes: options?.notes && options.notes.trim() ? options.notes.trim() : undefined,
    createdAt,
    trigger,
    recordCounts,
    financialSummary,
    checksum,
    payload: sanitizedPayload,
  };
}

/**
 * Serializes a DatabaseSnapshot into a formatted JSON string for file download.
 */
export function serializeSnapshotToJSON(snapshot: DatabaseSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Validates and parses a JSON string into a verified DatabaseSnapshot.
 * Supports both full DatabaseSnapshot JSON archives and legacy flat backup JSON files.
 * Detects syntax corruption, invalid root structures, and repairs malformed records.
 */
export function validateAndParseSnapshotJSON(rawJson: string): SnapshotValidationResult {
  if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
    return {
      valid: false,
      error: 'Snapshot JSON content is empty. Please upload or paste a valid JSON archive.',
      warnings: [],
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    return {
      valid: false,
      error: `Corrupted JSON format: ${err?.message || 'Unable to parse JSON syntax.'}`,
      warnings: [],
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'Invalid snapshot structure: root JSON value must be an object.',
      warnings: [],
    };
  }

  const warnings: string[] = [];

  // Determine whether this is a structured DatabaseSnapshot (with `payload`) or a flat backup object
  const isSnapshotEnvelope =
    parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload);

  const sourcePayload = isSnapshotEnvelope ? parsed.payload : parsed;

  const hasAnyRecognizedKey =
    'purchases' in sourcePayload ||
    'packings' in sourcePayload ||
    'payments' in sourcePayload ||
    'otherCosts' in sourcePayload ||
    'companyProfile' in sourcePayload ||
    'dropdownOptions' in sourcePayload;

  if (!hasAnyRecognizedKey) {
    return {
      valid: false,
      error:
        'Unrecognized JSON archive: missing database collections (purchases, packings, payments, or otherCosts).',
      warnings: [],
    };
  }

  // Validate that collection keys, when present, are arrays
  const collectionKeys = ['purchases', 'packings', 'payments', 'otherCosts'] as const;
  for (const key of collectionKeys) {
    if (key in sourcePayload && sourcePayload[key] !== undefined && !Array.isArray(sourcePayload[key])) {
      return {
        valid: false,
        error: `Corrupted "${key}" collection in JSON archive: expected an array of records.`,
        warnings: [],
      };
    }
  }

  const sanitizedPayload: SnapshotPayload = {
    purchases: sanitizePurchaseRecords(
      Array.isArray(sourcePayload.purchases) ? sourcePayload.purchases : [],
      warnings
    ),
    packings: sanitizePackingRecords(
      Array.isArray(sourcePayload.packings) ? sourcePayload.packings : [],
      warnings
    ),
    payments: sanitizePaymentRecords(
      Array.isArray(sourcePayload.payments) ? sourcePayload.payments : [],
      warnings
    ),
    otherCosts: sanitizeOtherCostRecords(
      Array.isArray(sourcePayload.otherCosts) ? sourcePayload.otherCosts : [],
      warnings
    ),
    partnerDeposits: Array.isArray(sourcePayload.partnerDeposits)
      ? sourcePayload.partnerDeposits
      : undefined,
    partnerWithdrawals: Array.isArray(sourcePayload.partnerWithdrawals)
      ? sourcePayload.partnerWithdrawals
      : undefined,
    profitDistributions: Array.isArray(sourcePayload.profitDistributions)
      ? sourcePayload.profitDistributions
      : undefined,
    balanceIncomes: Array.isArray(sourcePayload.balanceIncomes)
      ? sourcePayload.balanceIncomes
      : undefined,
    companyProfile:
      sourcePayload.companyProfile && typeof sourcePayload.companyProfile === 'object'
        ? sourcePayload.companyProfile
        : undefined,
    dropdownOptions:
      sourcePayload.dropdownOptions && typeof sourcePayload.dropdownOptions === 'object'
        ? sourcePayload.dropdownOptions
        : undefined,
    packingDraft:
      sourcePayload.packingDraft && typeof sourcePayload.packingDraft === 'object'
        ? sourcePayload.packingDraft
        : undefined,
  };

  const createdAt =
    typeof parsed.createdAt === 'string' && parsed.createdAt
      ? parsed.createdAt
      : typeof parsed.exportedAt === 'string' && parsed.exportedAt
      ? parsed.exportedAt
      : new Date().toISOString();

  const label =
    typeof parsed.label === 'string' && parsed.label.trim()
      ? parsed.label.trim()
      : `Restored JSON Archive (${createdAt.slice(0, 10)})`;

  const snapshot = createDatabaseSnapshot(sanitizedPayload, {
    id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : undefined,
    label,
    notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
    trigger: 'imported_file',
    createdAt,
  });

  if (
    isSnapshotEnvelope &&
    typeof parsed.checksum === 'string' &&
    parsed.checksum !== snapshot.checksum
  ) {
    warnings.push(
      'Checksum differs from original archive header; records were sanitized and re-indexed.'
    );
  }

  return {
    valid: true,
    warnings,
    snapshot,
  };
}

/**
 * Prepends a new snapshot to the existing list and enforces bounded retention.
 */
export function appendSnapshotWithRetention(
  existingSnapshots: DatabaseSnapshot[],
  newSnapshot: DatabaseSnapshot,
  maxSnapshots: number = DEFAULT_MAX_SNAPSHOTS
): DatabaseSnapshot[] {
  const safeList = Array.isArray(existingSnapshots) ? existingSnapshots : [];
  const filtered = safeList.filter((s) => s && s.id !== newSnapshot.id);
  const combined = [newSnapshot, ...filtered];
  return combined.slice(0, Math.max(1, maxSnapshots));
}

/**
 * Estimates serialized JSON byte size for a single DatabaseSnapshot.
 */
export function estimateSnapshotBytes(snapshot: DatabaseSnapshot): number {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  try {
    return JSON.stringify(snapshot).length;
  } catch {
    return 0;
  }
}

/**
 * Formats byte counts into human-readable storage telemetry (B / KB / MB).
 */
export function formatStorageBytes(bytes: number): string {
  const safe = Math.max(0, Number(bytes) || 0);
  if (safe < 1024) {
    return `${Math.round(safe)} B`;
  }
  if (safe < 1024 * 1024) {
    return `${(safe / 1024).toFixed(1)} KB`;
  }
  return `${(safe / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Calculates age in days and milliseconds for a snapshot timestamp relative to referenceNowMs.
 */
export function calculateSnapshotAgeDays(
  createdAtIso: string,
  referenceNowMs: number = Date.now()
): { ageDays: number; ageMs: number } {
  if (!createdAtIso || typeof createdAtIso !== 'string') {
    return { ageDays: 0, ageMs: 0 };
  }
  const parsedMs = Date.parse(createdAtIso);
  if (Number.isNaN(parsedMs)) {
    return { ageDays: 0, ageMs: 0 };
  }
  const ageMs = Math.max(0, referenceNowMs - parsedMs);
  const ageDays = Math.floor(ageMs / MS_PER_DAY);
  return { ageDays, ageMs };
}

/**
 * Evaluates all local snapshots against the 30-day retention rule while guaranteeing
 * that at least `minRetainedCount` (default 1) most recent snapshot is always protected and kept.
 */
export function evaluateSnapshotCleanupPlan(
  snapshots: DatabaseSnapshot[],
  options?: {
    maxAgeDays?: number;
    minRetainedCount?: number;
    referenceNowMs?: number;
  }
): SnapshotCleanupPlan {
  const safeList = Array.isArray(snapshots)
    ? snapshots.filter((s): s is DatabaseSnapshot => Boolean(s && typeof s === 'object' && s.id))
    : [];

  const maxAgeDays = Math.max(1, options?.maxAgeDays ?? DEFAULT_SNAPSHOT_RETENTION_DAYS);
  const minRetainedCount = Math.max(1, options?.minRetainedCount ?? DEFAULT_MIN_RETAINED_SNAPSHOTS);
  const referenceNowMs = options?.referenceNowMs ?? Date.now();
  const thresholdMs = maxAgeDays * MS_PER_DAY;
  const evaluatedAtIso = new Date(referenceNowMs).toISOString();

  // Sort newest-first by createdAt timestamp (tie-break by original array index)
  const indexed = safeList.map((snap, originalIndex) => {
    const parsedMs = Date.parse(snap.createdAt);
    return {
      snap,
      originalIndex,
      timestampMs: Number.isNaN(parsedMs) ? referenceNowMs : parsedMs,
    };
  });

  indexed.sort((a, b) => {
    if (b.timestampMs !== a.timestampMs) {
      return b.timestampMs - a.timestampMs;
    }
    return a.originalIndex - b.originalIndex;
  });

  const retainedSnapshots: DatabaseSnapshot[] = [];
  const flaggedSnapshots: DatabaseSnapshot[] = [];
  const flaggedIds: string[] = [];
  const protectedSnapshotIds: string[] = [];
  let protectedExpiredCount = 0;
  let totalStorageBytes = 0;
  let reclaimableStorageBytes = 0;
  let retainedStorageBytes = 0;
  const statusById: Record<string, SnapshotRetentionItemStatus> = {};

  indexed.forEach((entry, rankIndex) => {
    const { snap } = entry;
    const { ageDays, ageMs } = calculateSnapshotAgeDays(snap.createdAt, referenceNowMs);
    const isOlderThanThreshold = ageMs > thresholdMs;
    const isProtectedRecent = rankIndex < minRetainedCount;
    const isFlaggedForDeletion = !isProtectedRecent && isOlderThanThreshold;
    const estimatedBytes = estimateSnapshotBytes(snap);

    totalStorageBytes += estimatedBytes;

    if (isProtectedRecent) {
      protectedSnapshotIds.push(snap.id);
      if (isOlderThanThreshold) {
        protectedExpiredCount += 1;
      }
    }

    if (isFlaggedForDeletion) {
      flaggedSnapshots.push(snap);
      flaggedIds.push(snap.id);
      reclaimableStorageBytes += estimatedBytes;
    } else {
      retainedSnapshots.push(snap);
      retainedStorageBytes += estimatedBytes;
    }

    statusById[snap.id] = {
      snapshotId: snap.id,
      ageDays,
      ageMs,
      isOlderThanThreshold,
      isFlaggedForDeletion,
      isProtectedRecent,
      estimatedBytes,
    };
  });

  return {
    retainedSnapshots,
    flaggedSnapshots,
    flaggedIds,
    protectedSnapshotIds,
    protectedExpiredCount,
    statusById,
    totalStorageBytes,
    reclaimableStorageBytes,
    retainedStorageBytes,
    maxAgeDays,
    minRetainedCount,
    evaluatedAtIso,
  };
}

/**
 * Executes the 30-day snapshot cleanup policy, deleting snapshots older than `maxAgeDays`
 * while always keeping at least `minRetainedCount` (default 1) most recent snapshot.
 */
export function cleanupExpiredSnapshots(
  snapshots: DatabaseSnapshot[],
  options?: {
    maxAgeDays?: number;
    minRetainedCount?: number;
    referenceNowMs?: number;
  }
): SnapshotCleanupResult {
  const plan = evaluateSnapshotCleanupPlan(snapshots, options);
  return {
    retainedSnapshots: plan.retainedSnapshots,
    deletedSnapshots: plan.flaggedSnapshots,
    deletedIds: plan.flaggedIds,
    deletedCount: plan.flaggedSnapshots.length,
    retainedCount: plan.retainedSnapshots.length,
    protectedExpiredCount: plan.protectedExpiredCount,
    reclaimedBytes: plan.reclaimableStorageBytes,
    remainingBytes: plan.retainedStorageBytes,
    maxAgeDays: plan.maxAgeDays,
    minRetainedCount: plan.minRetainedCount,
    cleanedAtIso: plan.evaluatedAtIso,
  };
}

