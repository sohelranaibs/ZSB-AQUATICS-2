import {
  PurchaseRecord,
  PaymentRecord,
  SupplierCreditRecord,
} from '../types/index.ts';
import {
  SupplierRecordHistoryRow,
  SupplierHistoryTotals,
  SupplierRecordType,
  buildSupplierRecordHistory,
  calculateSupplierHistoryTotals,
} from './supplierHistory.ts';
import { UTF8_BOM, formatCsvRow } from './csvExporter.ts';

export const SUPPLIER_PORTAL_CREDENTIALS_STORAGE_KEY = 'zsb_supplier_portal_credentials_v1';
export const SUPPLIER_PORTAL_PBKDF2_ITERATIONS = 100000;
export const SUPPLIER_PORTAL_GENERIC_AUTH_ERROR = 'Invalid supplier name or password.';

export interface SupplierPortalCredential {
  id: string;
  supplierName: string;
  normalizedName: string;
  passwordHash: string;
  salt: string;
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SupplierPortalSession {
  credentialId: string;
  supplierName: string;
  normalizedName: string;
  authenticatedAt: string;
}

export type SupplierPortalAuthResult =
  | {
      valid: true;
      session: SupplierPortalSession;
    }
  | {
      valid: false;
      error: string;
    };

export interface SupplierPortalStatementFilters {
  fromDate?: string;
  toDate?: string;
  search?: string;
  recordType?: 'ALL' | SupplierRecordType;
  sortDirection?: 'asc' | 'desc';
}

export interface SupplierPortalLedgerRow extends SupplierRecordHistoryRow {
  runningBalance: number;
}

export interface SupplierPortalStatementResult {
  supplierName: string;
  rows: SupplierPortalLedgerRow[];
  filteredTotals: SupplierHistoryTotals;
  overallTotals: SupplierHistoryTotals;
  invoices: PurchaseRecord[];
  paymentVouchers: PaymentRecord[];
  creditNotes: SupplierCreditRecord[];
  contactNumber: string;
}

/**
 * Normalizes a supplier name for case-insensitive, whitespace-tolerant matching.
 */
export function normalizeSupplierPortalName(name: string | null | undefined): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

/**
 * Constant-time hex string comparison to prevent timing side-channels.
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generates a cryptographically strong random salt as hex.
 */
export function generateSupplierSaltHex(byteLength = 16): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Secure Web Crypto API is unavailable in this environment.');
  }
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Derives a salted PBKDF2-SHA256 hex digest for a supplier portal password.
 */
export async function hashSupplierPassword(
  password: string,
  saltHex?: string,
  iterations: number = SUPPLIER_PORTAL_PBKDF2_ITERATIONS
): Promise<{
  salt: string;
  hash: string;
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
}> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto Subtle API is unavailable for password hashing.');
  }

  const salt = saltHex || generateSupplierSaltHex(16);
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = hexToBytes(salt);
  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return {
    salt,
    hash: bytesToHex(new Uint8Array(derivedBits)),
    algorithm: 'PBKDF2-SHA256',
    iterations,
  };
}

/**
 * Verifies a candidate password against a stored salted PBKDF2 credential.
 */
export async function verifySupplierPassword(
  candidatePassword: string,
  credential: SupplierPortalCredential
): Promise<boolean> {
  if (!candidatePassword || !credential.passwordHash || !credential.salt) {
    return false;
  }
  const iterations =
    Number.isFinite(credential.iterations) && credential.iterations > 0
      ? credential.iterations
      : SUPPLIER_PORTAL_PBKDF2_ITERATIONS;
  const derived = await hashSupplierPassword(candidatePassword, credential.salt, iterations);
  return constantTimeEqualHex(derived.hash, credential.passwordHash);
}

/**
 * Validates admin input when creating or updating a supplier portal password.
 */
export function validateSupplierPortalPasswordInput(
  supplierName: string,
  password: string
): { valid: boolean; error?: string } {
  const cleanName = String(supplierName || '').trim();
  const cleanPassword = String(password || '').trim();

  if (!cleanName) {
    return { valid: false, error: 'Please enter or select a supplier name.' };
  }
  if (cleanName.length < 2) {
    return { valid: false, error: 'Supplier name must be at least 2 characters.' };
  }
  if (!cleanPassword) {
    return { valid: false, error: 'Please enter a password for this supplier.' };
  }
  if (cleanPassword.length < 4) {
    return { valid: false, error: 'Supplier password must be at least 4 characters long.' };
  }
  if (cleanPassword.length > 128) {
    return { valid: false, error: 'Supplier password must be 128 characters or fewer.' };
  }
  return { valid: true };
}

/**
 * Creates or updates a supplier's portal credential with a newly salted PBKDF2 hash.
 */
export async function upsertSupplierPortalCredential(
  existing: SupplierPortalCredential[],
  input: {
    supplierName: string;
    password: string;
    updatedBy: string;
    active?: boolean;
  }
): Promise<{
  updatedList: SupplierPortalCredential[];
  credential: SupplierPortalCredential;
  isUpdate: boolean;
}> {
  const cleanName = input.supplierName.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeSupplierPortalName(cleanName);
  const hashed = await hashSupplierPassword(input.password.trim());
  const now = new Date().toISOString();

  const existingMatch = existing.find((c) => c.normalizedName === normalizedName);
  if (existingMatch) {
    const updated: SupplierPortalCredential = {
      ...existingMatch,
      supplierName: cleanName,
      normalizedName,
      passwordHash: hashed.hash,
      salt: hashed.salt,
      algorithm: hashed.algorithm,
      iterations: hashed.iterations,
      active: input.active !== undefined ? input.active : true,
      updatedAt: now,
      updatedBy: input.updatedBy || 'Admin',
    };
    return {
      updatedList: existing.map((c) => (c.id === existingMatch.id ? updated : c)),
      credential: updated,
      isUpdate: true,
    };
  }

  const created: SupplierPortalCredential = {
    id: `sup-cred-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    supplierName: cleanName,
    normalizedName,
    passwordHash: hashed.hash,
    salt: hashed.salt,
    algorithm: hashed.algorithm,
    iterations: hashed.iterations,
    active: input.active !== undefined ? input.active : true,
    createdAt: now,
    updatedAt: now,
    updatedBy: input.updatedBy || 'Admin',
  };

  return {
    updatedList: [created, ...existing],
    credential: created,
    isUpdate: false,
  };
}

/**
 * Enables or disables a supplier's portal access without deleting the credential.
 */
export function toggleSupplierPortalCredentialStatus(
  existing: SupplierPortalCredential[],
  credentialId: string,
  updatedBy: string
): SupplierPortalCredential[] {
  const now = new Date().toISOString();
  return existing.map((cred) =>
    cred.id === credentialId
      ? {
          ...cred,
          active: !cred.active,
          updatedAt: now,
          updatedBy: updatedBy || cred.updatedBy,
        }
      : cred
  );
}

/**
 * Removes a supplier's portal credential completely.
 */
export function removeSupplierPortalCredential(
  existing: SupplierPortalCredential[],
  credentialId: string
): SupplierPortalCredential[] {
  return existing.filter((cred) => cred.id !== credentialId);
}

/**
 * Authenticates a supplier using Supplier Name + Password.
 * Always returns a generic error message on failure to avoid revealing account existence.
 */
export async function authenticateSupplierPortal(
  supplierNameInput: string,
  passwordInput: string,
  credentials: SupplierPortalCredential[]
): Promise<SupplierPortalAuthResult> {
  const normalizedInput = normalizeSupplierPortalName(supplierNameInput);
  const cleanPassword = String(passwordInput || '').trim();

  if (!normalizedInput || !cleanPassword) {
    return {
      valid: false,
      error: 'Please enter both supplier name and password.',
    };
  }

  const matched = credentials.find((c) => c.normalizedName === normalizedInput);
  if (!matched || !matched.active) {
    return {
      valid: false,
      error: SUPPLIER_PORTAL_GENERIC_AUTH_ERROR,
    };
  }

  const isPasswordValid = await verifySupplierPassword(cleanPassword, matched);
  if (!isPasswordValid) {
    return {
      valid: false,
      error: SUPPLIER_PORTAL_GENERIC_AUTH_ERROR,
    };
  }

  return {
    valid: true,
    session: {
      credentialId: matched.id,
      supplierName: matched.supplierName,
      normalizedName: matched.normalizedName,
      authenticatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Collects a sorted, deduplicated directory of known supplier names for authenticated admins.
 */
export function collectKnownSupplierNames(input: {
  dropdownSuppliers: string[];
  purchases: PurchaseRecord[];
  payments: PaymentRecord[];
  supplierCredits: SupplierCreditRecord[];
  credentials: SupplierPortalCredential[];
}): string[] {
  const seen = new Map<string, string>();
  const register = (raw: string | null | undefined) => {
    const clean = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!clean) return;
    const norm = clean.toLowerCase();
    if (!seen.has(norm)) {
      seen.set(norm, clean);
    }
  };

  (input.dropdownSuppliers || []).forEach(register);
  (input.purchases || []).forEach((p) => register(p.description));
  (input.payments || []).forEach((pay) => {
    if (pay.paymentCategory !== 'exporter') {
      register(pay.description);
    }
  });
  (input.supplierCredits || []).forEach((c) => register(c.supplierName));
  (input.credentials || []).forEach((cred) => register(cred.supplierName));

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

function isSupplierOwnedName(candidate: string | null | undefined, normalizedOwner: string): boolean {
  if (!normalizedOwner) return false;
  return normalizeSupplierPortalName(candidate) === normalizedOwner;
}

/**
 * Builds the strictly supplier-scoped ledger statement, lifetime totals, invoices,
 * payment vouchers, and credit notes for a single authenticated supplier.
 */
export function getSupplierPortalStatement(
  authenticatedSupplierName: string,
  data: {
    purchases: PurchaseRecord[];
    payments: PaymentRecord[];
    supplierCredits: SupplierCreditRecord[];
  },
  filters: SupplierPortalStatementFilters = {}
): SupplierPortalStatementResult {
  const cleanSupplierName = String(authenticatedSupplierName || '').trim().replace(/\s+/g, ' ');
  const normalizedOwner = normalizeSupplierPortalName(cleanSupplierName);

  if (!normalizedOwner) {
    const emptyTotals: SupplierHistoryTotals = {
      recordCount: 0,
      voucherCount: 0,
      purchaseCount: 0,
      creditNoteCount: 0,
      totalDebit: 0,
      totalCredit: 0,
      totalBalance: 0,
      paidCount: 0,
      reportCount: 0,
      noReportCount: 0,
      computedOverallStatus: 'REPORT',
    };
    return {
      supplierName: '',
      rows: [],
      filteredTotals: emptyTotals,
      overallTotals: emptyTotals,
      invoices: [],
      paymentVouchers: [],
      creditNotes: [],
      contactNumber: '',
    };
  }

  // Strictly isolate underlying datasets to ONLY this authenticated supplier
  const ownedPurchases = (data.purchases || [])
    .filter((p) => isSupplierOwnedName(p.description, normalizedOwner))
    .sort((a, b) => {
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

  const ownedPayments = (data.payments || [])
    .filter((pay) => {
      if (pay.paymentCategory === 'exporter') return false;
      if (pay.id && pay.id.startsWith('pay-sync-')) return false;
      return isSupplierOwnedName(pay.description, normalizedOwner);
    })
    .sort((a, b) => {
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

  const ownedCredits = (data.supplierCredits || [])
    .filter((c) => isSupplierOwnedName(c.supplierName, normalizedOwner))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  // Compute full unfiltered lifetime ledger chronologically for exact cumulative running balance
  const allRowsAsc = buildSupplierRecordHistory(ownedPurchases, ownedPayments, ownedCredits, {
    supplierName: cleanSupplierName,
    sortDirection: 'asc',
  });
  const overallTotals = calculateSupplierHistoryTotals(allRowsAsc);

  // Map each ledger row ID to its true cumulative chronological balance
  const runningBalanceById = new Map<string, number>();
  let cumulativeBalance = 0;
  for (const row of allRowsAsc) {
    cumulativeBalance =
      Math.round((cumulativeBalance + (Number(row.debitAmount) || 0) - (Number(row.creditAmount) || 0)) * 100) /
      100;
    runningBalanceById.set(row.id, cumulativeBalance);
  }

  // Compute filtered ledger rows for table display
  const filteredRawRows = buildSupplierRecordHistory(ownedPurchases, ownedPayments, ownedCredits, {
    supplierName: cleanSupplierName,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
    search: filters.search || undefined,
    recordType: filters.recordType || 'ALL',
    sortDirection: filters.sortDirection || 'desc',
  });
  const filteredTotals = calculateSupplierHistoryTotals(filteredRawRows);
  const filteredRows: SupplierPortalLedgerRow[] = filteredRawRows.map((row) => ({
    ...row,
    runningBalance: runningBalanceById.get(row.id) ?? row.balance,
  }));

  // Derive supplier contact number from latest purchase or payment record
  const contactNumber =
    ownedPurchases.find((p) => p.contactNumber?.trim())?.contactNumber?.trim() ||
    ownedPayments.find((p) => p.contactNumber?.trim())?.contactNumber?.trim() ||
    '';

  return {
    supplierName: cleanSupplierName,
    rows: filteredRows,
    filteredTotals,
    overallTotals,
    invoices: ownedPurchases,
    paymentVouchers: ownedPayments,
    creditNotes: ownedCredits,
    contactNumber,
  };
}

/**
 * Strictly owner-verified lookup of a single purchase invoice by ID or invoice number.
 */
export function getSupplierInvoiceById(
  authenticatedSupplierName: string,
  invoiceIdOrNumber: string,
  purchases: PurchaseRecord[]
): PurchaseRecord | null {
  const normalizedOwner = normalizeSupplierPortalName(authenticatedSupplierName);
  const target = String(invoiceIdOrNumber || '').trim();
  if (!normalizedOwner || !target) return null;

  return (
    (purchases || []).find(
      (p) =>
        isSupplierOwnedName(p.description, normalizedOwner) &&
        (p.id === target || p.invoiceNumber === target)
    ) || null
  );
}

/**
 * Strictly owner-verified lookup of a single supplier payment voucher by ID or invoice number.
 */
export function getSupplierPaymentVoucherById(
  authenticatedSupplierName: string,
  paymentIdOrNumber: string,
  payments: PaymentRecord[]
): PaymentRecord | null {
  const normalizedOwner = normalizeSupplierPortalName(authenticatedSupplierName);
  const target = String(paymentIdOrNumber || '').trim();
  if (!normalizedOwner || !target) return null;

  return (
    (payments || []).find(
      (pay) =>
        pay.paymentCategory !== 'exporter' &&
        isSupplierOwnedName(pay.description, normalizedOwner) &&
        (pay.id === target || pay.invoiceNumber === target)
    ) || null
  );
}

/**
 * Neutralizes leading formula characters in CSV text cells to protect spreadsheet users.
 */
function sanitizeCsvTextCell(value: string | null | undefined): string {
  const str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function formatSupplierRecordTypeLabel(recordType: SupplierRecordType): string {
  if (recordType === 'PURCHASE_BILL') return 'Purchase Invoice';
  if (recordType === 'PAYMENT_VOUCHER') return 'Payment Voucher';
  if (recordType === 'CREDIT_NOTE') return 'Credit Note';
  return recordType;
}

/**
 * Generates an Excel-ready UTF-8 BOM CSV export of the supplier's statement.
 */
export function generateSupplierStatementCSV(
  supplierName: string,
  rows: SupplierPortalLedgerRow[],
  totals: SupplierHistoryTotals,
  companyName: string = 'ZSB AQUATICS',
  currency: string = 'TK'
): string {
  const headerMeta = [
    formatCsvRow([`${sanitizeCsvTextCell(companyName)} - SUPPLIER LEDGER STATEMENT`]),
    formatCsvRow(['Supplier Name', sanitizeCsvTextCell(supplierName), 'Currency', currency]),
    formatCsvRow([]),
  ];

  const headers = [
    'S. No.',
    'Date',
    'Invoice / Ref No',
    'Entry Type',
    'Details / Description',
    `Purchase / Debit (${currency})`,
    `Payment / Credit (${currency})`,
    `Running Balance (${currency})`,
    'Status',
    'Ref Document',
  ];

  const dataLines = rows.map((row, idx) =>
    formatCsvRow([
      idx + 1,
      row.date || '',
      sanitizeCsvTextCell(row.invoiceNumber || ''),
      formatSupplierRecordTypeLabel(row.recordType),
      sanitizeCsvTextCell(row.description || ''),
      row.debitAmount || 0,
      row.creditAmount || 0,
      row.runningBalance,
      row.status || '',
      sanitizeCsvTextCell(row.refDocument || ''),
    ])
  );

  const summaryLine = formatCsvRow([
    '',
    '',
    'TOTALS',
    `${totals.recordCount} Entries`,
    '',
    totals.totalDebit,
    totals.totalCredit,
    totals.totalBalance,
    totals.computedOverallStatus,
    '',
  ]);

  return UTF8_BOM + [...headerMeta, formatCsvRow(headers), ...dataLines, summaryLine].join('\r\n');
}

function sanitizeFilenameSegment(raw: string | null | undefined, fallback: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

/**
 * Formats a clean, filesystem-safe PDF filename for a supplier account statement.
 */
export function formatSupplierStatementPdfFilename(
  supplierName: string,
  dateStr: string = new Date().toISOString().slice(0, 10)
): string {
  const safeSupplier = sanitizeFilenameSegment(supplierName, 'Supplier');
  const safeDate = sanitizeFilenameSegment(dateStr, new Date().toISOString().slice(0, 10));
  return `${safeSupplier}_Account_Statement_${safeDate}.pdf`;
}

/**
 * Formats a clean, filesystem-safe PDF filename for an individual supplier purchase invoice.
 */
export function formatSupplierInvoicePdfFilename(
  invoiceNumber: string,
  supplierName: string
): string {
  const safeInvoice = sanitizeFilenameSegment(invoiceNumber, 'Invoice');
  const safeSupplier = sanitizeFilenameSegment(supplierName, 'Supplier');
  return `${safeInvoice}_${safeSupplier}.pdf`;
}

/**
 * Formats a clean, filesystem-safe PDF filename for a supplier payment receipt voucher.
 */
export function formatSupplierReceiptPdfFilename(
  voucherNumber: string,
  supplierName: string
): string {
  const safeVoucher = sanitizeFilenameSegment(voucherNumber, 'Receipt');
  const safeSupplier = sanitizeFilenameSegment(supplierName, 'Supplier');
  return `${safeVoucher}_${safeSupplier}_Receipt.pdf`;
}

/**
 * Safely loads persisted supplier portal credentials from localStorage.
 */
export function loadSupplierPortalCredentials(
  storage: Pick<Storage, 'getItem'> | null | undefined
): SupplierPortalCredential[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SUPPLIER_PORTAL_CREDENTIALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SupplierPortalCredential =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.supplierName === 'string' &&
        typeof item.normalizedName === 'string' &&
        typeof item.passwordHash === 'string' &&
        typeof item.salt === 'string' &&
        typeof item.active === 'boolean'
    );
  } catch {
    return [];
  }
}
