import {
  AuditLogAction,
  AuditLogModule,
  AuditLogRecord,
  AuthUser,
} from '../types/index.ts';
import { DEFAULT_SUPER_ADMIN_PASSWORD } from './superAdminAuth.ts';

export const ZSB_BANNER_IMAGE_URL =
  '/assets/aistudio/WhatsApp_Image_2026-10-30_at_12.38.58_70038e4b.jpeg';

export interface AdminAccountSpec {
  username: string;
  aliases: string[];
  displayName: string;
  role: string;
  email: string;
  defaultPasswords: string[];
}

export const DEFAULT_ADMIN_ACCOUNTS: AdminAccountSpec[] = [
  {
    username: 'admin',
    aliases: ['admin', 'sohel', 'zsbaquatics@gmail.com', 'sohelranaibs@gmail.com'],
    displayName: 'Md. Sohel Rana',
    role: 'Partner & Administrator',
    email: 'zsbaquatics@gmail.com',
    defaultPasswords: [DEFAULT_SUPER_ADMIN_PASSWORD, 'ZSB@Admin2026', 'admin123', 'zsb2026'],
  },
  {
    username: 'mizanur',
    aliases: ['mizanur', 'managing.partner@zsbaquatics.com'],
    displayName: 'Md. Mizanur Rahman',
    role: 'Managing Partner',
    email: 'zsbaquatics@gmail.com',
    defaultPasswords: [DEFAULT_SUPER_ADMIN_PASSWORD, 'ZSB@Admin2026', 'admin123', 'zsb2026'],
  },
];

export interface AuthVerificationResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

/**
 * Verifies user credentials before allowing access to MainContent.
 */
export function authenticateUser(
  usernameOrEmailInput: string,
  passwordInput: string,
  customSuperAdminPassword?: string,
  nowIso: string = new Date().toISOString()
): AuthVerificationResult {
  const cleanUser = (usernameOrEmailInput || '').trim().toLowerCase();
  const cleanPass = (passwordInput || '').trim();

  if (!cleanUser) {
    return {
      valid: false,
      error: 'Please enter your Administrator Username or Email.',
    };
  }

  if (!cleanPass) {
    return {
      valid: false,
      error: 'Please enter your Administrator Password.',
    };
  }

  // Check dynamically registered team administrators
  let dynamicTeamMembers: any[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('zsb_team_members_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) dynamicTeamMembers = parsed;
      }
    } catch {
      // Ignore
    }
  }

  const matchedDynamic = dynamicTeamMembers.find(
    (m) =>
      (typeof m.username === 'string' && m.username.toLowerCase() === cleanUser) ||
      (typeof m.email === 'string' && m.email.toLowerCase() === cleanUser)
  );

  if (matchedDynamic) {
    if (matchedDynamic.status === 'suspended') {
      return {
        valid: false,
        error: `Account "@${matchedDynamic.username}" is currently suspended. Please contact Super Admin.`,
      };
    }

    const isCustomPasswordActive =
      Boolean(customSuperAdminPassword) &&
      customSuperAdminPassword!.trim().length > 0 &&
      customSuperAdminPassword!.trim() !== DEFAULT_SUPER_ADMIN_PASSWORD;

    const validPasswords = new Set<string>();
    if (isCustomPasswordActive) {
      // Password updated: Previous default passwords will NOT work!
      validPasswords.add(customSuperAdminPassword!.trim());
      if (matchedDynamic.password && matchedDynamic.password.trim().length > 0) {
        validPasswords.add(matchedDynamic.password.trim());
      }
    } else {
      validPasswords.add(matchedDynamic.password || 'admin123');
      validPasswords.add(DEFAULT_SUPER_ADMIN_PASSWORD);
      validPasswords.add('ZSB@Admin2026');
    }

    if (!validPasswords.has(cleanPass)) {
      return {
        valid: false,
        error: isCustomPasswordActive
          ? 'Invalid password. The administrator password was updated — all previous passwords no longer work.'
          : 'Invalid password. Please verify your administrator credentials.',
      };
    }

    return {
      valid: true,
      user: {
        username: matchedDynamic.username,
        displayName: matchedDynamic.displayName,
        role: matchedDynamic.role,
        email: matchedDynamic.email,
        loginAt: nowIso,
      },
    };
  }

  const matchedAccount = DEFAULT_ADMIN_ACCOUNTS.find((acc) =>
    acc.aliases.some((alias) => alias.toLowerCase() === cleanUser)
  );

  if (!matchedAccount) {
    return {
      valid: false,
      error:
        'Unrecognized username or email. Please check your credentials or contact Super Admin.',
    };
  }

  const isCustomPasswordActive =
    Boolean(customSuperAdminPassword) &&
    customSuperAdminPassword!.trim().length > 0 &&
    customSuperAdminPassword!.trim() !== DEFAULT_SUPER_ADMIN_PASSWORD;

  const validPasswords = new Set<string>();
  if (isCustomPasswordActive) {
    // Password updated: ONLY the new updated password works! ALL previous default passwords will NOT work!
    validPasswords.add(customSuperAdminPassword!.trim());
  } else {
    matchedAccount.defaultPasswords.forEach((p) => validPasswords.add(p));
    if (customSuperAdminPassword) validPasswords.add(customSuperAdminPassword.trim());
  }

  if (!validPasswords.has(cleanPass)) {
    return {
      valid: false,
      error: isCustomPasswordActive
        ? 'Invalid password. The administrator password was updated — all previous passwords no longer work.'
        : 'Invalid password. Please verify your administrator credentials.',
    };
  }

  return {
    valid: true,
    user: {
      username: matchedAccount.username,
      displayName: matchedAccount.displayName,
      role: matchedAccount.role,
      email: matchedAccount.email,
      loginAt: nowIso,
    },
  };
}

export interface CreateAuditLogInput {
  action: AuditLogAction;
  module: AuditLogModule;
  entityId?: string;
  summary: string;
  details?: string;
  actor?: string;
  timestamp?: string;
  id?: string;
}

/**
 * Creates a normalized AuditLogRecord entry.
 */
export function createAuditLogEntry(input: CreateAuditLogInput): AuditLogRecord {
  const timestamp = input.timestamp || new Date().toISOString();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const id = input.id || `audit-${Date.now()}-${randomSuffix}`;

  return {
    id,
    timestamp,
    action: input.action,
    module: input.module,
    entityId: input.entityId?.trim() || undefined,
    summary: input.summary.trim(),
    details: input.details?.trim() || undefined,
    actor: (input.actor || 'Md. Sohel Rana (Admin)').trim(),
  };
}

export interface AuditLogFilterOptions {
  searchQuery?: string;
  actionFilter?: 'ALL' | 'ENTRY' | 'EDIT' | 'DELETE' | 'AUTH';
  moduleFilter?: 'ALL' | AuditLogModule;
  dateFilter?: string; // YYYY-MM-DD or YYYY-MM
}

/**
 * Filters audit logs by search query, action category, module, and date prefix.
 */
export function filterAuditLogs(
  logs: AuditLogRecord[],
  options: AuditLogFilterOptions = {}
): AuditLogRecord[] {
  const {
    searchQuery = '',
    actionFilter = 'ALL',
    moduleFilter = 'ALL',
    dateFilter = '',
  } = options;

  const q = searchQuery.trim().toLowerCase();
  const cleanDate = dateFilter.trim();

  return (logs || []).filter((log) => {
    if (actionFilter === 'ENTRY' && log.action !== 'CREATE' && log.action !== 'IMPORT') {
      return false;
    }
    if (actionFilter === 'EDIT' && log.action !== 'UPDATE') {
      return false;
    }
    if (actionFilter === 'DELETE' && log.action !== 'DELETE' && log.action !== 'CLEAR') {
      return false;
    }
    if (actionFilter === 'AUTH' && log.action !== 'AUTH') {
      return false;
    }

    if (moduleFilter !== 'ALL' && log.module !== moduleFilter) {
      return false;
    }

    if (cleanDate && !(log.timestamp || '').startsWith(cleanDate)) {
      return false;
    }

    if (q) {
      const haystack = [
        log.summary,
        log.details || '',
        log.entityId || '',
        log.module,
        log.action,
        log.actor,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

export interface AuditLogStats {
  totalCount: number;
  entriesCount: number; // CREATE + IMPORT
  editsCount: number; // UPDATE
  deletionsCount: number; // DELETE + CLEAR
  authCount: number; // AUTH
  uniqueModulesCount: number;
  latestTimestamp: string | null;
}

/**
 * Computes summary counts for the AuditLogsView KPI strip.
 */
export function calculateAuditLogStats(logs: AuditLogRecord[]): AuditLogStats {
  let entriesCount = 0;
  let editsCount = 0;
  let deletionsCount = 0;
  let authCount = 0;
  const modules = new Set<string>();

  for (const log of logs || []) {
    modules.add(log.module);
    if (log.action === 'CREATE' || log.action === 'IMPORT') {
      entriesCount++;
    } else if (log.action === 'UPDATE') {
      editsCount++;
    } else if (log.action === 'DELETE' || log.action === 'CLEAR') {
      deletionsCount++;
    } else if (log.action === 'AUTH') {
      authCount++;
    }
  }

  return {
    totalCount: (logs || []).length,
    entriesCount,
    editsCount,
    deletionsCount,
    authCount,
    uniqueModulesCount: modules.size,
    latestTimestamp: logs && logs.length > 0 ? logs[0].timestamp : null,
  };
}

/**
 * Generates an RFC-4180 CSV string for downloading audit log records.
 */
export function formatAuditLogsCSV(logs: AuditLogRecord[]): string {
  const escapeCsvCell = (val: string | undefined): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Log ID',
    'Timestamp',
    'Action Type',
    'System Module',
    'Reference / Voucher No',
    'Activity Summary',
    'Details',
    'Administrator / Actor',
  ];

  const rows = (logs || []).map((log) =>
    [
      escapeCsvCell(log.id),
      escapeCsvCell(log.timestamp),
      escapeCsvCell(log.action),
      escapeCsvCell(log.module),
      escapeCsvCell(log.entityId || '-'),
      escapeCsvCell(log.summary),
      escapeCsvCell(log.details || '-'),
      escapeCsvCell(log.actor),
    ].join(',')
  );

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}
