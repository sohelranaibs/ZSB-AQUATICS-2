/**
 * Pure Super Admin password verification & scope helpers for protecting
 * destructive database operations ("Clear All Records").
 */

export const DEFAULT_SUPER_ADMIN_PASSWORD = 'admin123';

export type ClearRecordsScope = 'all' | 'purchase' | 'packing' | 'payment' | 'other_cost';

export type SingleDeleteRecordType =
  | 'purchase'
  | 'packing'
  | 'payment'
  | 'other_cost'
  | 'supplier_credit'
  | 'mortality'
  | 'dropdown_item'
  | 'snapshot'
  | 'audit_logs'
  | 'audit_log'
  | 'team_member'
  | 'custom_row';

export interface PendingSingleDeleteRequest {
  recordType: SingleDeleteRecordType;
  recordId: string;
  title?: string;
  recordTitle?: string;
  identifier?: string;
  details?: string;
  recordSubtitle?: string;
  category?: string;
}

export interface SuperAdminVerifyResult {
  valid: boolean;
  error?: string;
}

export interface SuperAdminPasswordChangeResult {
  valid: boolean;
  error?: string;
  normalizedNewPassword?: string;
}

export interface DatabaseRecordCounts {
  purchases: number;
  packings: number;
  payments: number;
  otherCosts: number;
}

/**
 * Verifies whether the provided password matches the active Super Admin password.
 */
export function verifySuperAdminPassword(
  inputPassword: string,
  storedPassword: string = DEFAULT_SUPER_ADMIN_PASSWORD
): SuperAdminVerifyResult {
  const effectiveStored =
    typeof storedPassword === 'string' && storedPassword.trim().length > 0
      ? storedPassword.trim()
      : DEFAULT_SUPER_ADMIN_PASSWORD;

  if (typeof inputPassword !== 'string' || inputPassword.trim().length === 0) {
    return {
      valid: false,
      error: 'Super Admin password is required to clear records.',
    };
  }

  if (inputPassword.trim() !== effectiveStored) {
    return {
      valid: false,
      error: 'Invalid Super Admin password. Access denied — records were not cleared.',
    };
  }

  return { valid: true };
}

/**
 * Verifies Super Admin password specifically for deleting any single data record.
 */
export function verifySuperAdminForSingleDelete(
  inputPassword: string,
  storedPassword: string = DEFAULT_SUPER_ADMIN_PASSWORD
): SuperAdminVerifyResult {
  const effectiveStored =
    typeof storedPassword === 'string' && storedPassword.trim().length > 0
      ? storedPassword.trim()
      : DEFAULT_SUPER_ADMIN_PASSWORD;

  if (typeof inputPassword !== 'string' || inputPassword.trim().length === 0) {
    return {
      valid: false,
      error: 'Super Admin password is required to delete this data.',
    };
  }

  if (inputPassword.trim() !== effectiveStored) {
    return {
      valid: false,
      error: 'Invalid Super Admin password. Access denied — data was not deleted.',
    };
  }

  return { valid: true };
}

/**
 * Computes human-readable metadata for the single-record Super Admin deletion gate.
 */
export function describeSingleDeleteTarget(request: PendingSingleDeleteRequest): {
  badgeLabel: string;
  heading: string;
  identifierLabel: string;
  identifier: string;
  summaryText: string;
} {
  const safeId = (request.identifier || request.recordId || '-').trim();
  const safeTitle = (request.title || request.recordTitle || 'Data Record').trim();
  const safeDetails = (request.details || request.recordSubtitle || '').trim();
  const displayIdentifier =
    request.recordTitle ||
    (request.identifier ? `${safeTitle} (${safeId})` : safeTitle);

  switch (request.recordType) {
    case 'purchase':
      return {
        badgeLabel: 'Purchase Challan / Bill',
        heading: 'Super Admin Permission Required to Delete Purchase Data',
        identifierLabel: 'Invoice No',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle} (${safeId})${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'packing':
      return {
        badgeLabel: 'Export Packing List',
        heading: 'Super Admin Permission Required to Delete Packing Data',
        identifierLabel: 'Packing No',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle} (${safeId})${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'payment':
      return {
        badgeLabel: 'Payment Voucher',
        heading: 'Super Admin Permission Required to Delete Payment Data',
        identifierLabel: 'Voucher No',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle} (${safeId})${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'other_cost':
      return {
        badgeLabel: 'Operating Expense / Costing',
        heading: 'Super Admin Permission Required to Delete Expense Data',
        identifierLabel: 'Expense Category',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle}${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'supplier_credit':
      return {
        badgeLabel: 'Supplier Credit Note',
        heading: 'Super Admin Permission Required to Delete Credit Note',
        identifierLabel: 'Credit Note No',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle} (${safeId})${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'mortality':
      return {
        badgeLabel: 'Mortality Log Record',
        heading: 'Super Admin Permission Required to Delete Mortality Data',
        identifierLabel: 'Species / Grade',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle}${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'dropdown_item':
      return {
        badgeLabel: 'Master Dropdown Option',
        heading: 'Super Admin Permission Required to Delete Preset Option',
        identifierLabel: 'Option Value',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle}${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'snapshot':
      return {
        badgeLabel: 'Database Snapshot Archive',
        heading: 'Super Admin Permission Required to Delete Snapshot',
        identifierLabel: 'Snapshot Label',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle}${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'audit_logs':
    case 'audit_log':
      return {
        badgeLabel: 'System Audit Trail',
        heading: 'Super Admin Permission Required to Delete Audit Logs',
        identifierLabel: 'Audit Scope',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle}${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'team_member':
      return {
        badgeLabel: 'Team / Admin Account',
        heading: 'Super Admin Permission Required to Delete Team Account',
        identifierLabel: 'Username / Role',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle}${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
    case 'custom_row':
    default:
      return {
        badgeLabel: 'Sheet Data Row',
        heading: 'Super Admin Permission Required to Delete Row Data',
        identifierLabel: 'Row Reference',
        identifier: displayIdentifier,
        summaryText: request.recordTitle
          ? safeDetails || `Record ID: ${safeId}`
          : `${safeTitle}${safeDetails ? ` · ${safeDetails}` : ''}`,
      };
  }
}

/**
 * Validates a request to update the Super Admin password.
 */
export function validateSuperAdminPasswordChange(
  currentInput: string,
  newPassword: string,
  confirmPassword: string,
  storedPassword: string = DEFAULT_SUPER_ADMIN_PASSWORD
): SuperAdminPasswordChangeResult {
  const verifyCurrent = verifySuperAdminPassword(currentInput, storedPassword);
  if (!verifyCurrent.valid) {
    return {
      valid: false,
      error: 'Current Super Admin password is incorrect.',
    };
  }

  const trimmedNew = (newPassword || '').trim();
  const trimmedConfirm = (confirmPassword || '').trim();

  if (trimmedNew.length < 4) {
    return {
      valid: false,
      error: 'New Super Admin password must be at least 4 characters long.',
    };
  }

  if (trimmedNew !== trimmedConfirm) {
    return {
      valid: false,
      error: 'New password and confirmation password do not match.',
    };
  }

  return {
    valid: true,
    normalizedNewPassword: trimmedNew,
  };
}

/**
 * Computes human-readable details and total record count for a clear operation scope.
 */
export function describeClearScope(
  scope: ClearRecordsScope,
  counts: DatabaseRecordCounts
): {
  title: string;
  totalRecords: number;
  breakdown: string;
} {
  const purchases = Math.max(0, Number(counts.purchases) || 0);
  const packings = Math.max(0, Number(counts.packings) || 0);
  const payments = Math.max(0, Number(counts.payments) || 0);
  const otherCosts = Math.max(0, Number(counts.otherCosts) || 0);

  switch (scope) {
    case 'purchase':
      return {
        title: 'Purchase DB Only',
        totalRecords: purchases,
        breakdown: `${purchases} Purchase Challan / Bill record(s)`,
      };
    case 'packing':
      return {
        title: 'Packing DB Only',
        totalRecords: packings,
        breakdown: `${packings} Export Packing List record(s)`,
      };
    case 'payment':
      return {
        title: 'Payment DB Only',
        totalRecords: payments,
        breakdown: `${payments} Supplier & Exporter Payment voucher(s)`,
      };
    case 'other_cost':
      return {
        title: 'Other Costs / Expenses DB Only',
        totalRecords: otherCosts,
        breakdown: `${otherCosts} Operating Expense & Costing record(s)`,
      };
    case 'all':
    default: {
      const total = purchases + packings + payments + otherCosts;
      return {
        title: 'All Database Records (All Sheets)',
        totalRecords: total,
        breakdown: `${purchases} Purchases, ${packings} Packing Lists, ${payments} Payments, ${otherCosts} Other Costing entries`,
      };
    }
  }
}
