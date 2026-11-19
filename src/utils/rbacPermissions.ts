import { ActiveTab, AuthUser } from '../types/index.ts';
import { TeamRole } from './administration.ts';

export interface RoleAccessPolicy {
  roleLabel: string;
  allowedTabs: ActiveTab[];
  canCreateOrEdit: boolean;
  canDeleteRecords: boolean;
  canAccessFinancialAnalytics: boolean;
  canManageAdministration: boolean;
  description: string;
}

export const ALL_ACTIVE_TABS: ActiveTab[] = [
  'dashboard',
  'purchase_form',
  'packing_form',
  'exporter_payment_form',
  'payment_form',
  'air_way_bill',
  'exporter_payment_slip',
  'profit_loss',
  'purchase_db',
  'packing_db',
  'payment_db',
  'search_reports',
  'settings',
  'audit_logs',
  'administration',
  'forget_password',
  'total_balance',
  'daily_expense',
];

const ROLE_POLICIES: Record<TeamRole, RoleAccessPolicy> = {
  'Super Admin': {
    roleLabel: 'Super Admin',
    allowedTabs: [...ALL_ACTIVE_TABS],
    canCreateOrEdit: true,
    canDeleteRecords: true,
    canAccessFinancialAnalytics: true,
    canManageAdministration: true,
    description: 'Full access to all operational, financial, partner equity, and system administration modules.',
  },
  'Managing Partner': {
    roleLabel: 'Managing Partner',
    allowedTabs: [
      'dashboard',
      'purchase_form',
      'packing_form',
      'exporter_payment_form',
      'payment_form',
      'air_way_bill',
      'exporter_payment_slip',
      'profit_loss',
      'total_balance',
      'daily_expense',
      'purchase_db',
      'packing_db',
      'payment_db',
      'search_reports',
      'audit_logs',
      'settings',
      'forget_password',
    ],
    canCreateOrEdit: true,
    canDeleteRecords: false,
    canAccessFinancialAnalytics: true,
    canManageAdministration: false,
    description: 'Executive partner access across procurement, export, P&L, total balance, and audit reports.',
  },
  'Senior Accountant': {
    roleLabel: 'Senior Accountant',
    allowedTabs: [
      'dashboard',
      'exporter_payment_form',
      'payment_form',
      'exporter_payment_slip',
      'profit_loss',
      'daily_expense',
      'purchase_db',
      'packing_db',
      'payment_db',
      'search_reports',
      'audit_logs',
      'forget_password',
    ],
    canCreateOrEdit: true,
    canDeleteRecords: false,
    canAccessFinancialAnalytics: true,
    canManageAdministration: false,
    description: 'Financial accounting access to ledgers, payments, P&L statements, and receivables aging.',
  },
  'Logistics Manager': {
    roleLabel: 'Logistics Manager',
    allowedTabs: [
      'dashboard',
      'packing_form',
      'air_way_bill',
      'exporter_payment_slip',
      'packing_db',
      'search_reports',
      'forget_password',
    ],
    canCreateOrEdit: true,
    canDeleteRecords: false,
    canAccessFinancialAnalytics: false,
    canManageAdministration: false,
    description: 'Export logistics access to Packing Lists, Flight Return Bills, Payment Slips, and Packing DB.',
  },
  'Depot Dispatcher': {
    roleLabel: 'Depot Dispatcher',
    allowedTabs: [
      'dashboard',
      'purchase_form',
      'packing_form',
      'purchase_db',
      'packing_db',
      'forget_password',
    ],
    canCreateOrEdit: true,
    canDeleteRecords: false,
    canAccessFinancialAnalytics: false,
    canManageAdministration: false,
    description: 'Depot floor access limited to Purchase Challans, Packing Lists, and operational databases.',
  },
  'Read Only': {
    roleLabel: 'Read Only',
    allowedTabs: [
      'dashboard',
      'purchase_db',
      'packing_db',
      'payment_db',
      'search_reports',
      'forget_password',
    ],
    canCreateOrEdit: false,
    canDeleteRecords: false,
    canAccessFinancialAnalytics: false,
    canManageAdministration: false,
    description: 'View-only auditor access to operational databases and search reports with zero edit or delete privileges.',
  },
};

/**
 * Normalizes any user role string (including legacy display roles like "Partner & Administrator")
 * into a canonical TeamRole for deterministic RBAC enforcement.
 */
export function resolveCanonicalTeamRole(user: AuthUser | null | undefined): TeamRole {
  if (!user) return 'Read Only';
  const rawRole = (user.role || '').trim().toLowerCase();
  const username = (user.username || '').trim().toLowerCase();

  if (
    username === 'admin' ||
    username === 'sohel' ||
    rawRole.includes('super admin') ||
    rawRole.includes('super_admin') ||
    rawRole.includes('administrator') ||
    rawRole === 'admin'
  ) {
    return 'Super Admin';
  }
  if (rawRole.includes('managing partner') || rawRole === 'partner') {
    return 'Managing Partner';
  }
  if (rawRole.includes('accountant')) {
    return 'Senior Accountant';
  }
  if (rawRole.includes('logistics')) {
    return 'Logistics Manager';
  }
  if (rawRole.includes('depot') || rawRole.includes('dispatcher') || rawRole.includes('data entry')) {
    return 'Depot Dispatcher';
  }
  return 'Read Only';
}

export function getRoleAccessPolicy(user: AuthUser | null | undefined): RoleAccessPolicy {
  const canonical = resolveCanonicalTeamRole(user);
  return ROLE_POLICIES[canonical];
}

export function getAllowedTabsForUser(user: AuthUser | null | undefined): ActiveTab[] {
  return getRoleAccessPolicy(user).allowedTabs;
}

export function canUserAccessTab(
  user: AuthUser | null | undefined,
  tab: ActiveTab
): boolean {
  const allowed = getAllowedTabsForUser(user);
  return allowed.includes(tab);
}

export function canUserDeleteRecords(user: AuthUser | null | undefined): boolean {
  return getRoleAccessPolicy(user).canDeleteRecords;
}

export function canUserEditRecords(user: AuthUser | null | undefined): boolean {
  return getRoleAccessPolicy(user).canCreateOrEdit;
}

export function getFallbackTabForUser(user: AuthUser | null | undefined): ActiveTab {
  const allowed = getAllowedTabsForUser(user);
  return allowed.includes('dashboard') ? 'dashboard' : allowed[0] || 'dashboard';
}
