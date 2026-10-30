export type TeamRole =
  | 'Super Admin'
  | 'Managing Partner'
  | 'Senior Accountant'
  | 'Logistics Manager'
  | 'Depot Dispatcher'
  | 'Read Only';

export interface PermissionDefinition {
  id: string;
  label: string;
  category:
    | 'Procurement & Stock'
    | 'Logistics & Manifests'
    | 'Settlement & Vouchers'
    | 'Financial & Analytics'
    | 'System & Security';
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Procurement & Stock
  {
    id: 'perm_purchase_entry',
    label: 'Procurement Challan & Rate Entry',
    category: 'Procurement & Stock',
    description: 'Create, edit and manage live crab and eel procurement challans with rate computations.',
  },
  {
    id: 'perm_inventory_mortality',
    label: 'Mortality & Holding Stock Logging',
    category: 'Procurement & Stock',
    description: 'Record live seafood mortality losses, cause analysis, and adjust holding tank inventories.',
  },
  // Logistics & Manifests
  {
    id: 'perm_packing_manifest',
    label: 'Air Freight Export Manifests',
    category: 'Logistics & Manifests',
    description: 'Draft carton-level export packing lists, shipping mark dispatches and QR tracking codes.',
  },
  {
    id: 'perm_flight_return_bill',
    label: 'Flight Return Bill Statements',
    category: 'Logistics & Manifests',
    description: 'Manage monthly Flight Return Bill rates, box tallies, and BDT currency conversions.',
  },
  {
    id: 'perm_exporter_slips',
    label: 'Exporter Payment Slips (付款单)',
    category: 'Logistics & Manifests',
    description: 'Generate, edit and sign bilingual RMB exporter payment slips and settlement statements.',
  },
  // Settlement & Vouchers
  {
    id: 'perm_supplier_payments',
    label: 'Supplier Payment Vouchers',
    category: 'Settlement & Vouchers',
    description: 'Issue supplier cash/bank payments, transport rebate adjustments, and settlement vouchers.',
  },
  {
    id: 'perm_credit_notes',
    label: 'Supplier Credit & DOA Claims',
    category: 'Settlement & Vouchers',
    description: 'Apply weight shortage, quality claims, and transit dead-on-arrival (DOA) credit notes.',
  },
  {
    id: 'perm_operating_costs',
    label: 'Other Operating & Cargo Expenses',
    category: 'Settlement & Vouchers',
    description: 'Record air cargo freight, airport handling, ice, oxygen, customs and quarantine costs.',
  },
  // Financial & Analytics
  {
    id: 'perm_profit_loss',
    label: 'Profit & Loss Financial Analysis',
    category: 'Financial & Analytics',
    description: 'Inspect net business profit margins, daily P&L rollups, and rolling monthly trading trends.',
  },
  {
    id: 'perm_export_reports',
    label: 'Multi-Ledger Reports & Excel Exports',
    category: 'Financial & Analytics',
    description: 'Export multi-ledger database tables to Excel (.xlsx), CSV, and formatted PDF documents.',
  },
  // System & Security
  {
    id: 'perm_admin_user_manage',
    label: 'Admin & Team User Provisioning',
    category: 'System & Security',
    description: 'Register and manage administrator accounts, reset passwords, and assign role clearances.',
  },
  {
    id: 'perm_database_backups',
    label: 'Database Snapshots & Recovery',
    category: 'System & Security',
    description: 'Archive system state into local JSON snapshots and execute point-in-time state rollbacks.',
  },
  {
    id: 'perm_audit_trail',
    label: 'Audit Trail Inspection & Export',
    category: 'System & Security',
    description: 'Review tamper-evident administrator activity logs, security events, and audit exports.',
  },
  {
    id: 'perm_super_admin_clear',
    label: 'Super Admin Clearance & Master Key',
    category: 'System & Security',
    description: 'Execute protected database wipes and manage root partner master security credentials.',
  },
];

export const ROLE_DEFAULT_PERMISSION_IDS: Record<TeamRole, string[]> = {
  'Super Admin': SYSTEM_PERMISSIONS.map((p) => p.id),
  'Managing Partner': [
    'perm_purchase_entry',
    'perm_packing_manifest',
    'perm_flight_return_bill',
    'perm_exporter_slips',
    'perm_supplier_payments',
    'perm_profit_loss',
    'perm_export_reports',
    'perm_database_backups',
    'perm_audit_trail',
  ],
  'Senior Accountant': [
    'perm_supplier_payments',
    'perm_credit_notes',
    'perm_operating_costs',
    'perm_profit_loss',
    'perm_export_reports',
    'perm_audit_trail',
  ],
  'Logistics Manager': [
    'perm_packing_manifest',
    'perm_flight_return_bill',
    'perm_exporter_slips',
    'perm_export_reports',
  ],
  'Depot Dispatcher': [
    'perm_purchase_entry',
    'perm_inventory_mortality',
    'perm_export_reports',
  ],
  'Read Only': [
    'perm_export_reports',
  ],
};

export const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  'Super Admin': [
    'All System Access',
    'Super Admin Clearance',
    'Account & Team Management',
    'Database Clear & Recovery',
    'Audit Trail Purge & Export',
    'Financial Settings & Exchange Rates',
  ],
  'Managing Partner': [
    'Executive Financial Reports',
    'Consignment Sign-Off',
    'Purchase & Packing Approvals',
    'Profit & Loss Statements',
    'Team View Access',
  ],
  'Senior Accountant': [
    'Supplier & Exporter Ledgers',
    'Payment Voucher Entry & Edit',
    'Credit Note Application',
    'Other Operating Costs',
    'Monthly Financial Statements',
  ],
  'Logistics Manager': [
    'Air Freight Packing Manifests',
    'Flight Return Bill Statements',
    'Carton Weights & Flight Tracking',
    'Exporter Payment Slips',
  ],
  'Depot Dispatcher': [
    'Live Crab & Eel Procurement Entry',
    'Depot Holding Tank Inventory',
    'Mortality & DOA Logging',
    'Challan Print & PDF Generation',
  ],
  'Read Only': [
    'View Ledgers & Statements',
    'Print Vouchers',
    'No Edit or Delete Privileges',
  ],
};

export interface TeamMember {
  id: string;
  displayName: string;
  username: string;
  email: string;
  role: TeamRole;
  status: 'active' | 'suspended';
  permissions: string[];
  createdAt: string;
  lastLogin?: string;
  isRoot?: boolean;
  password?: string;
}

export const TEAM_MEMBERS_STORAGE_KEY = 'zsb_team_members_v1';
export const SUPER_ADMIN_SESSION_STORAGE_KEY = 'zsb_super_admin_verified_session_v1';

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'team-root-001',
    displayName: 'Md. Sohel Rana',
    username: 'sohel',
    email: 'sohelranaibs@gmail.com',
    role: 'Super Admin',
    status: 'active',
    permissions: ROLE_PERMISSIONS['Super Admin'],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLogin: '2026-10-30T11:20:00.000Z',
    isRoot: true,
    password: 'admin123',
  },
  {
    id: 'team-root-002',
    displayName: 'Md. Mizanur Rahman',
    username: 'mizanur',
    email: 'managing.partner@zsbaquatics.com',
    role: 'Managing Partner',
    status: 'active',
    permissions: ROLE_PERMISSIONS['Managing Partner'],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLogin: '2026-10-30T10:15:00.000Z',
    isRoot: true,
    password: 'admin123',
  },
  {
    id: 'team-staff-003',
    displayName: 'Tareq Ahmed',
    username: 'tareq',
    email: 'tareq.acct@zsbaquatics.com',
    role: 'Senior Accountant',
    status: 'active',
    permissions: ROLE_PERMISSIONS['Senior Accountant'],
    createdAt: '2026-02-15T09:00:00.000Z',
    lastLogin: '2026-10-29T16:40:00.000Z',
    password: 'admin123',
  },
  {
    id: 'team-staff-004',
    displayName: 'Rafiqul Islam',
    username: 'rafiq',
    email: 'rafiq.cargo@zsbaquatics.com',
    role: 'Logistics Manager',
    status: 'active',
    permissions: ROLE_PERMISSIONS['Logistics Manager'],
    createdAt: '2026-03-01T08:30:00.000Z',
    lastLogin: '2026-10-30T09:00:00.000Z',
    password: 'admin123',
  },
];

/**
 * Loads team members from local storage or defaults.
 */
export function loadInitialTeamMembers(): TeamMember[] {
  if (typeof window === 'undefined') return DEFAULT_TEAM_MEMBERS;
  try {
    const raw = localStorage.getItem(TEAM_MEMBERS_STORAGE_KEY);
    if (!raw) return DEFAULT_TEAM_MEMBERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_TEAM_MEMBERS;
  } catch {
    return DEFAULT_TEAM_MEMBERS;
  }
}

/**
 * Validates a standard team member payload.
 */
export function validateTeamMember(
  data: Partial<TeamMember>,
  existing: TeamMember[],
  ignoreId?: string
): { valid: boolean; error?: string } {
  const name = (data.displayName || '').trim();
  const username = (data.username || '').trim().toLowerCase();
  const email = (data.email || '').trim().toLowerCase();

  if (!name) {
    return { valid: false, error: 'Full name is required.' };
  }
  if (!username) {
    return { valid: false, error: 'Username is required.' };
  }
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters.' };
  }
  if (!email || !email.includes('@')) {
    return { valid: false, error: 'A valid email address is required.' };
  }

  const dupUser = existing.find(
    (m) => m.id !== ignoreId && m.username.toLowerCase() === username
  );
  if (dupUser) {
    return { valid: false, error: `Username "${username}" is already assigned to ${dupUser.displayName}.` };
  }

  const dupEmail = existing.find(
    (m) => m.id !== ignoreId && m.email.toLowerCase() === email
  );
  if (dupEmail) {
    return { valid: false, error: `Email "${email}" is already assigned to ${dupEmail.displayName}.` };
  }

  return { valid: true };
}

export interface RegisterAdminInput {
  displayName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
  role: TeamRole;
  permissions: string[];
  status?: 'active' | 'suspended';
}

/**
 * Validates a request to register a new Administrator.
 * CRITICAL SECURITY REQUIREMENT:
 * Ensures only verified Super Admins can trigger this registration.
 */
export function validateNewAdminRegistration(
  input: RegisterAdminInput,
  existingMembers: TeamMember[],
  callerIsSuperAdmin: boolean
): { valid: boolean; error?: string } {
  if (!callerIsSuperAdmin) {
    return {
      valid: false,
      error: 'Security Clearance Denied: Only verified Super Admins can register new administrator accounts.',
    };
  }

  const baseCheck = validateTeamMember(
    {
      displayName: input.displayName,
      username: input.username,
      email: input.email,
    },
    existingMembers
  );

  if (!baseCheck.valid) {
    return baseCheck;
  }

  const pwd = (input.password || '').trim();
  if (pwd.length < 4) {
    return {
      valid: false,
      error: 'Administrator password must be at least 4 characters long.',
    };
  }

  if (input.confirmPassword !== undefined && input.confirmPassword !== pwd) {
    return {
      valid: false,
      error: 'Password and confirmation password do not match.',
    };
  }

  if (!input.role) {
    return {
      valid: false,
      error: 'A specific administrative role must be selected.',
    };
  }

  if (!Array.isArray(input.permissions) || input.permissions.length === 0) {
    return {
      valid: false,
      error: 'At least one specific role-based access permission must be granted.',
    };
  }

  return { valid: true };
}

/**
 * Registers a new Administrator with specific role-based permissions.
 */
export function registerNewAdmin(
  existingMembers: TeamMember[],
  input: RegisterAdminInput
): { updatedList: TeamMember[]; createdAdmin: TeamMember } {
  const cleanUsername = input.username.trim().toLowerCase();
  const cleanEmail = input.email.trim().toLowerCase();
  const id = `admin-usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const createdAdmin: TeamMember = {
    id,
    displayName: input.displayName.trim(),
    username: cleanUsername,
    email: cleanEmail,
    role: input.role,
    status: input.status || 'active',
    permissions: [...input.permissions],
    createdAt: new Date().toISOString(),
    password: input.password.trim(),
  };

  return {
    updatedList: [...existingMembers, createdAdmin],
    createdAdmin,
  };
}

/**
 * Adds a new team member.
 */
export function addTeamMember(
  existing: TeamMember[],
  newMemberData: Omit<TeamMember, 'id' | 'createdAt' | 'permissions'>
): { updatedList: TeamMember[]; createdMember: TeamMember } {
  const id = `team-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const permissions = ROLE_PERMISSIONS[newMemberData.role] || ROLE_PERMISSIONS['Read Only'];
  const createdMember: TeamMember = {
    ...newMemberData,
    id,
    permissions,
    createdAt: new Date().toISOString(),
  };

  return {
    updatedList: [...existing, createdMember],
    createdMember,
  };
}

/**
 * Updates an existing team member.
 */
export function updateTeamMember(
  existing: TeamMember[],
  id: string,
  updates: Partial<TeamMember>
): TeamMember[] {
  return existing.map((member) => {
    if (member.id !== id) return member;
    const nextRole = (updates.role || member.role) as TeamRole;
    const nextPermissions = updates.permissions || (updates.role ? ROLE_PERMISSIONS[nextRole] : member.permissions);
    return {
      ...member,
      ...updates,
      permissions: nextPermissions,
    };
  });
}

/**
 * Deletes a team member (root accounts cannot be deleted).
 */
export function deleteTeamMember(
  existing: TeamMember[],
  id: string
): { success: boolean; updatedList: TeamMember[]; error?: string } {
  const target = existing.find((m) => m.id === id);
  if (!target) {
    return { success: false, updatedList: existing, error: 'Team member not found.' };
  }
  if (target.isRoot) {
    return {
      success: false,
      updatedList: existing,
      error: `Cannot delete core partner account "${target.displayName}".`,
    };
  }

  return {
    success: true,
    updatedList: existing.filter((m) => m.id !== id),
  };
}

/**
 * Toggles status between 'active' and 'suspended'. Root accounts cannot be suspended.
 */
export function toggleTeamMemberStatus(
  existing: TeamMember[],
  id: string
): { success: boolean; updatedList: TeamMember[]; error?: string } {
  const target = existing.find((m) => m.id === id);
  if (!target) {
    return { success: false, updatedList: existing, error: 'Team member not found.' };
  }
  if (target.isRoot && target.status === 'active') {
    return {
      success: false,
      updatedList: existing,
      error: `Core partner account "${target.displayName}" cannot be suspended.`,
    };
  }

  const nextStatus = target.status === 'active' ? 'suspended' : 'active';
  return {
    success: true,
    updatedList: existing.map((m) =>
      m.id === id ? { ...m, status: nextStatus } : m
    ),
  };
}

/**
 * Formats team members as CSV for data export.
 */
export function formatTeamMembersCSV(members: TeamMember[]): string {
  const headers = ['ID', 'Display Name', 'Username', 'Email', 'Role', 'Status', 'Permissions Count', 'Created At', 'Last Login'];
  const rows = members.map((m) => [
    `"${m.id}"`,
    `"${m.displayName.replace(/"/g, '""')}"`,
    `"${m.username}"`,
    `"${m.email}"`,
    `"${m.role}"`,
    `"${m.status.toUpperCase()}"`,
    `"${m.permissions ? m.permissions.length : 0}"`,
    `"${m.createdAt}"`,
    `"${m.lastLogin || 'Never'}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
