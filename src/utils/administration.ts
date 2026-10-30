export type TeamRole =
  | 'Super Admin'
  | 'Managing Partner'
  | 'Senior Accountant'
  | 'Logistics Manager'
  | 'Depot Dispatcher'
  | 'Read Only';

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
}

export const TEAM_MEMBERS_STORAGE_KEY = 'zsb_team_members_v1';
export const SUPER_ADMIN_SESSION_STORAGE_KEY = 'zsb_super_admin_verified_session_v1';

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
 * Validates a new or edited team member payload.
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
    const nextPermissions = updates.role ? ROLE_PERMISSIONS[nextRole] : member.permissions;
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
  const headers = ['ID', 'Display Name', 'Username', 'Email', 'Role', 'Status', 'Created At', 'Last Login'];
  const rows = members.map((m) => [
    `"${m.id}"`,
    `"${m.displayName.replace(/"/g, '""')}"`,
    `"${m.username}"`,
    `"${m.email}"`,
    `"${m.role}"`,
    `"${m.status.toUpperCase()}"`,
    `"${m.createdAt}"`,
    `"${m.lastLogin || 'Never'}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
