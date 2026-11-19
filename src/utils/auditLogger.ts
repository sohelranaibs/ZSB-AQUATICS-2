import {
  AuditLogAction,
  AuditLogModule,
  AuditLogRecord,
  AuthUser,
} from '../types/index.ts';
import { DEFAULT_SUPER_ADMIN_PASSWORD } from './superAdminAuth.ts';
import { toISODateString } from './dateFilters.ts';
import { DEFAULT_TEAM_MEMBERS } from './administration.ts';

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

  // Check dynamically registered team administrators (fallback to DEFAULT_TEAM_MEMBERS on fresh boot)
  let dynamicTeamMembers: any[] = DEFAULT_TEAM_MEMBERS;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('zsb_team_members_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) dynamicTeamMembers = parsed;
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

    const memberPwd = matchedDynamic.password ? matchedDynamic.password.trim() : '';
    const hasMemberCustomPassword =
      memberPwd.length > 0 && memberPwd !== DEFAULT_SUPER_ADMIN_PASSWORD;

    const validPasswords = new Set<string>();
    if (hasMemberCustomPassword) {
      validPasswords.add(memberPwd);
      if (isCustomPasswordActive) {
        validPasswords.add(customSuperAdminPassword!.trim());
      }
    } else if (isCustomPasswordActive) {
      // Password updated: Previous default passwords will NOT work!
      validPasswords.add(customSuperAdminPassword!.trim());
      if (memberPwd.length > 0 && memberPwd !== DEFAULT_SUPER_ADMIN_PASSWORD) {
        validPasswords.add(memberPwd);
      }
    } else {
      validPasswords.add(memberPwd || 'admin123');
      validPasswords.add(DEFAULT_SUPER_ADMIN_PASSWORD);
      validPasswords.add('ZSB@Admin2026');
    }

    if (!validPasswords.has(cleanPass)) {
      return {
        valid: false,
        error:
          isCustomPasswordActive || hasMemberCustomPassword
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
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface TimeIntervalRange {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalTimeHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Computes a rolling [now - hoursAgo, now] date+time interval in local calendar time.
 */
export function getRelativeTimeInterval(
  hoursAgo: number,
  referenceDate: Date = new Date()
): TimeIntervalRange {
  const safeHours = Number.isFinite(hoursAgo) && hoursAgo > 0 ? hoursAgo : 1;
  const end = new Date(referenceDate.getTime());
  const start = new Date(referenceDate.getTime() - safeHours * 60 * 60 * 1000);
  return {
    startDate: toISODateString(start),
    endDate: toISODateString(end),
    startTime: toLocalTimeHHMM(start),
    endTime: toLocalTimeHHMM(end),
  };
}

/**
 * Returns true if the start date/time comes chronologically after the end date/time.
 */
export function isAuditIntervalInverted(options: {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}): boolean {
  const startDate = (options.startDate || '').trim();
  const endDate = (options.endDate || '').trim();
  const startTime = (options.startTime || '').trim();
  const endTime = (options.endTime || '').trim();

  if (startDate && endDate) {
    if (startDate > endDate) return true;
    if (startDate === endDate && startTime && endTime && startTime > endTime) {
      return true;
    }
    return false;
  }

  if (!startDate && !endDate && startTime && endTime && startTime > endTime) {
    return true;
  }

  return false;
}

function parseLocalBoundaryMs(
  dateStr: string,
  timeStr: string | undefined,
  isEndBoundary: boolean
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec((timeStr || '').trim());
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const mins = Number(timeMatch[2]);
    const secs = timeMatch[3] ? Number(timeMatch[3]) : isEndBoundary ? 59 : 0;
    const ms = isEndBoundary ? 999 : 0;
    return new Date(year, month, day, hours, mins, secs, ms).getTime();
  }

  return isEndBoundary
    ? new Date(year, month, day, 23, 59, 59, 999).getTime()
    : new Date(year, month, day, 0, 0, 0, 0).getTime();
}

/**
 * Checks whether an audit log timestamp falls within the specified [startDate/startTime, endDate/endTime] interval.
 * Full ISO timestamps are evaluated in local calendar time so filtering matches the displayed table timestamps.
 * Date-only strings (YYYY-MM-DD) are treated as local calendar days.
 */
export function isAuditTimestampInInterval(
  timestamp: string | null | undefined,
  options: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  } = {}
): boolean {
  const startDate = (options.startDate || '').trim();
  const endDate = (options.endDate || '').trim();
  const startTime = (options.startTime || '').trim();
  const endTime = (options.endTime || '').trim();

  if (!startDate && !endDate && !startTime && !endTime) {
    return true;
  }
  if (!timestamp) return false;

  const cleanTs = timestamp.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanTs);

  let logEpochMs: number;
  let logLocalHHMM: string;

  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1]);
    const m = Number(dateOnlyMatch[2]) - 1;
    const d = Number(dateOnlyMatch[3]);
    logEpochMs = new Date(y, m, d, 12, 0, 0, 0).getTime();
    logLocalHHMM = '12:00';
  } else {
    const parsed = new Date(cleanTs);
    if (isNaN(parsed.getTime())) {
      return false;
    }
    logEpochMs = parsed.getTime();
    logLocalHHMM = toLocalTimeHHMM(parsed);
  }

  // Date-bounded interval (with optional startTime/endTime precision)
  if (startDate || endDate) {
    if (startDate) {
      const minMs = parseLocalBoundaryMs(startDate, startTime, false);
      if (minMs !== null && logEpochMs < minMs) {
        return false;
      }
    }
    if (endDate) {
      const maxMs = parseLocalBoundaryMs(endDate, endTime, true);
      if (maxMs !== null && logEpochMs > maxMs) {
        return false;
      }
    }
    // If only one date bound is set AND an unanchored opposite time bound is set, enforce intraday time-of-day
    if (!startDate && startTime && logLocalHHMM < startTime) {
      return false;
    }
    if (!endDate && endTime && logLocalHHMM > endTime) {
      return false;
    }
    return true;
  }

  // Time-of-day only filter (across all dates)
  if (startTime && logLocalHHMM < startTime) {
    return false;
  }
  if (endTime && logLocalHHMM > endTime) {
    return false;
  }

  return true;
}

/**
 * Filters audit logs by search query, action category, module, and date/time interval.
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
    startDate = '',
    endDate = '',
    startTime = '',
    endTime = '',
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

    if (
      (startDate || endDate || startTime || endTime) &&
      !isAuditTimestampInInterval(log.timestamp, {
        startDate,
        endDate,
        startTime,
        endTime,
      })
    ) {
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
