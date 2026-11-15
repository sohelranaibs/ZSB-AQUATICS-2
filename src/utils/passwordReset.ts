import { DEFAULT_ADMIN_ACCOUNTS } from './auditLogger.ts';
import {
  DEFAULT_TEAM_MEMBERS,
  TEAM_MEMBERS_STORAGE_KEY,
  TeamMember,
} from './administration.ts';

export const PASSWORD_RESET_STORAGE_KEY = 'zsb_password_reset_requests_v1';
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;

export interface RegisteredAccountMatch {
  accountKey: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isRootAdmin: boolean;
  source: 'team_member' | 'default_admin';
}

export interface AccountLookupResult {
  found: boolean;
  account?: RegisteredAccountMatch;
  error?: string;
}

export interface PasswordResetRequest {
  id: string;
  account: RegisteredAccountMatch;
  code: string;
  confirmToken: string;
  createdAtMs: number;
  expiresAtMs: number;
  verified: boolean;
  verifiedAtMs?: number;
  used: boolean;
  usedAtMs?: number;
  attempts: number;
  maxAttempts: number;
  deliveryMode?: 'smtp_email' | 'confirmation_inbox';
  messageId?: string;
}

export interface VerificationResult {
  valid: boolean;
  updatedRequest: PasswordResetRequest;
  error?: string;
}

export interface NewPasswordValidationResult {
  valid: boolean;
  normalizedPassword?: string;
  error?: string;
}

export interface ConfirmationEmailPreview {
  from: string;
  to: string;
  subject: string;
  recipientName: string;
  code: string;
  confirmToken: string;
  confirmUrl: string;
  expiresInMinutes: number;
  bodyText: string;
}

function loadStoredTeamMembers(): TeamMember[] {
  if (typeof window === 'undefined') {
    return DEFAULT_TEAM_MEMBERS;
  }
  try {
    const raw = localStorage.getItem(TEAM_MEMBERS_STORAGE_KEY);
    if (!raw) return DEFAULT_TEAM_MEMBERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEAM_MEMBERS;
  } catch {
    return DEFAULT_TEAM_MEMBERS;
  }
}

export function listRecoverableAccounts(
  teamMembers?: TeamMember[]
): RegisteredAccountMatch[] {
  const members = teamMembers ?? loadStoredTeamMembers();
  const seen = new Set<string>();
  const results: RegisteredAccountMatch[] = [];

  for (const m of members) {
    if (m.status === 'suspended') continue;
    const key = `${m.username.toLowerCase()}|${m.email.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      accountKey: m.email.toLowerCase(),
      username: m.username,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      isRootAdmin: Boolean(m.isRoot) || m.role === 'Super Admin',
      source: 'team_member',
    });
  }

  for (const acc of DEFAULT_ADMIN_ACCOUNTS) {
    const key = `${acc.username.toLowerCase()}|${acc.email.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      accountKey: acc.email.toLowerCase(),
      username: acc.username,
      displayName: acc.displayName,
      email: acc.email,
      role: acc.role,
      isRootAdmin: true,
      source: 'default_admin',
    });
  }

  return results;
}

/**
 * Resolves a registered ZSB AQUATICS administrator/team account by email or username.
 */
export function findRegisteredAccountByIdentifier(
  identifierInput: string,
  teamMembers?: TeamMember[]
): AccountLookupResult {
  const clean = (identifierInput || '').trim().toLowerCase();
  if (!clean) {
    return {
      found: false,
      error: 'Please enter your registered email address or username.',
    };
  }

  const members = teamMembers ?? loadStoredTeamMembers();
  const matchedMember = members.find(
    (m) =>
      m.email.trim().toLowerCase() === clean ||
      m.username.trim().toLowerCase() === clean
  );

  if (matchedMember) {
    if (matchedMember.status === 'suspended') {
      return {
        found: false,
        error: `Account "@${matchedMember.username}" is currently suspended. Contact Super Admin for reactivation.`,
      };
    }

    return {
      found: true,
      account: {
        accountKey: matchedMember.email.trim().toLowerCase(),
        username: matchedMember.username,
        displayName: matchedMember.displayName,
        email: matchedMember.email,
        role: matchedMember.role,
        isRootAdmin: Boolean(matchedMember.isRoot) || matchedMember.role === 'Super Admin',
        source: 'team_member',
      },
    };
  }

  const matchedDefault = DEFAULT_ADMIN_ACCOUNTS.find(
    (acc) =>
      acc.email.trim().toLowerCase() === clean ||
      acc.username.trim().toLowerCase() === clean ||
      acc.aliases.some((alias) => alias.trim().toLowerCase() === clean)
  );

  if (matchedDefault) {
    const targetEmail = clean.includes('@') ? clean : matchedDefault.email;
    return {
      found: true,
      account: {
        accountKey: targetEmail.toLowerCase(),
        username: matchedDefault.username,
        displayName: matchedDefault.displayName,
        email: targetEmail,
        role: matchedDefault.role,
        isRootAdmin: true,
        source: 'default_admin',
      },
    };
  }

  return {
    found: false,
    error: 'No active administrator or team account matches that email or username.',
  };
}

export function generateConfirmationCode(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    const num = 100000 + (arr[0] % 900000);
    return String(num);
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateConfirmationToken(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(12);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `zsb-rst-${hex}`;
  }
  return `zsb-rst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function maskEmailAddress(email: string): string {
  const clean = (email || '').trim();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 1) return clean;
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  const visiblePrefix = local.slice(0, Math.min(2, local.length));
  const maskedLocal = `${visiblePrefix}${'*'.repeat(Math.max(2, local.length - visiblePrefix.length))}`;
  return `${maskedLocal}@${domain}`;
}

export function createPasswordResetRequest(params: {
  account: RegisteredAccountMatch;
  nowMs?: number;
  ttlMs?: number;
  codeOverride?: string;
  tokenOverride?: string;
}): PasswordResetRequest {
  const nowMs = params.nowMs ?? Date.now();
  const ttlMs = params.ttlMs ?? PASSWORD_RESET_TTL_MS;
  const code = params.codeOverride ?? generateConfirmationCode();
  const confirmToken = params.tokenOverride ?? generateConfirmationToken();

  return {
    id: `rst-req-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    account: params.account,
    code,
    confirmToken,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
    verified: false,
    used: false,
    attempts: 0,
    maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
  };
}

export function buildConfirmationEmailContent(
  request: PasswordResetRequest,
  originUrl: string = 'http://localhost:3000'
): ConfirmationEmailPreview {
  const normalizedOrigin = originUrl.replace(/\/+$/, '');
  const confirmUrl = `${normalizedOrigin}/?tab=forget_password&reset_token=${encodeURIComponent(
    request.confirmToken
  )}`;
  const expiresInMinutes = Math.max(
    1,
    Math.round((request.expiresAtMs - request.createdAtMs) / 60000)
  );

  const bodyText = [
    `Hello ${request.account.displayName},`,
    '',
    `A password reset request was submitted for your ZSB AQUATICS account (${request.account.email}).`,
    `Your Email Confirmation Code: ${request.code}`,
    '',
    `Confirm via direct verification link: ${confirmUrl}`,
    `This confirmation code expires in ${expiresInMinutes} minutes.`,
  ].join('\n');

  return {
    from: 'ZSB AQUATICS Security <no-reply@zsbaquatics.com>',
    to: request.account.email,
    subject: `ZSB AQUATICS — Password Reset Confirmation Code (${request.code})`,
    recipientName: request.account.displayName,
    code: request.code,
    confirmToken: request.confirmToken,
    confirmUrl,
    expiresInMinutes,
    bodyText,
  };
}

/**
 * Verifies either the 6-digit confirmation code or the email confirmation token.
 */
export function verifyPasswordResetConfirmation(
  request: PasswordResetRequest,
  input: { code?: string; token?: string },
  nowMs: number = Date.now()
): VerificationResult {
  if (request.used) {
    return {
      valid: false,
      updatedRequest: request,
      error: 'This password reset confirmation has already been used. Request a new email confirmation.',
    };
  }

  if (nowMs > request.expiresAtMs) {
    return {
      valid: false,
      updatedRequest: request,
      error: 'Confirmation code expired. Please send a new confirmation email.',
    };
  }

  if (request.attempts >= request.maxAttempts) {
    return {
      valid: false,
      updatedRequest: request,
      error: 'Too many invalid confirmation attempts. Please send a new confirmation email.',
    };
  }

  const submittedToken = (input.token || '').trim();
  const submittedCode = (input.code || '').replace(/\s+/g, '').trim();

  if (!submittedToken && !submittedCode) {
    return {
      valid: false,
      updatedRequest: request,
      error: 'Please enter the 6-digit confirmation code sent to your email.',
    };
  }

  const tokenMatches = Boolean(submittedToken) && submittedToken === request.confirmToken;
  const codeMatches = Boolean(submittedCode) && submittedCode === request.code;

  if (!tokenMatches && !codeMatches) {
    const nextAttempts = request.attempts + 1;
    const remaining = Math.max(0, request.maxAttempts - nextAttempts);
    return {
      valid: false,
      updatedRequest: {
        ...request,
        attempts: nextAttempts,
      },
      error:
        remaining > 0
          ? `Invalid confirmation code. ${remaining} attempt(s) remaining.`
          : 'Maximum confirmation attempts reached. Please request a new confirmation email.',
    };
  }

  return {
    valid: true,
    updatedRequest: {
      ...request,
      verified: true,
      verifiedAtMs: nowMs,
    },
  };
}

export function validatePasswordResetNewPassword(
  newPassword: string,
  confirmPassword: string
): NewPasswordValidationResult {
  const trimmedNew = (newPassword || '').trim();
  const trimmedConfirm = (confirmPassword || '').trim();

  if (trimmedNew.length < 4) {
    return {
      valid: false,
      error: 'New password must be at least 4 characters long.',
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
    normalizedPassword: trimmedNew,
  };
}

/**
 * Applies a newly reset password to matching team member entries and indicates
 * whether the master Super Admin password should also be updated.
 */
export function applyResetPasswordToTeamMembers(
  teamMembers: TeamMember[],
  account: RegisteredAccountMatch,
  normalizedNewPassword: string
): {
  updatedMembers: TeamMember[];
  shouldUpdateSuperAdminPassword: boolean;
  updatedUsernames: string[];
} {
  const cleanEmail = account.email.trim().toLowerCase();
  const cleanUsername = account.username.trim().toLowerCase();
  const isSohelAlias =
    cleanUsername === 'admin' ||
    cleanUsername === 'sohel' ||
    cleanEmail === 'zsbaquatics@gmail.com' ||
    cleanEmail === 'sohelranaibs@gmail.com';

  const updatedUsernames: string[] = [];
  const updatedMembers = teamMembers.map((member) => {
    const memberEmail = member.email.trim().toLowerCase();
    const memberUsername = member.username.trim().toLowerCase();
    const directMatch = memberEmail === cleanEmail || memberUsername === cleanUsername;
    const rootAliasMatch =
      isSohelAlias &&
      (memberUsername === 'sohel' || memberEmail === 'sohelranaibs@gmail.com');

    if (directMatch || rootAliasMatch) {
      updatedUsernames.push(member.username);
      return {
        ...member,
        password: normalizedNewPassword,
      };
    }
    return member;
  });

  return {
    updatedMembers,
    shouldUpdateSuperAdminPassword: account.isRootAdmin || isSohelAlias,
    updatedUsernames,
  };
}

export function savePendingResetRequest(request: PasswordResetRequest): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PASSWORD_RESET_STORAGE_KEY, JSON.stringify(request));
  } catch {
    // Ignore quota errors
  }
}

export function loadPendingResetRequest(): PasswordResetRequest | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PASSWORD_RESET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PasswordResetRequest;
    if (!parsed || !parsed.id || !parsed.account || !parsed.confirmToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingResetRequest(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PASSWORD_RESET_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
