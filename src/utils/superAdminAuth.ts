/**
 * Pure Super Admin password verification & scope helpers for protecting
 * destructive database operations ("Clear All Records").
 */

export const DEFAULT_SUPER_ADMIN_PASSWORD = 'admin123';

export type ClearRecordsScope = 'all' | 'purchase' | 'packing' | 'payment' | 'other_cost';

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
