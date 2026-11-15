import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findRegisteredAccountByIdentifier,
  listRecoverableAccounts,
  createPasswordResetRequest,
  buildConfirmationEmailContent,
  verifyPasswordResetConfirmation,
  validatePasswordResetNewPassword,
  applyResetPasswordToTeamMembers,
  maskEmailAddress,
} from './passwordReset.ts';
import { DEFAULT_TEAM_MEMBERS } from './administration.ts';
import { authenticateUser } from './auditLogger.ts';

test('findRegisteredAccountByIdentifier resolves root admins, team members, and rejects unknown or suspended accounts', () => {
  const sohel = findRegisteredAccountByIdentifier('sohelranaibs@gmail.com', DEFAULT_TEAM_MEMBERS);
  assert.equal(sohel.found, true);
  assert.equal(sohel.account?.username, 'sohel');
  assert.equal(sohel.account?.isRootAdmin, true);

  const companyAlias = findRegisteredAccountByIdentifier('zsbaquatics@gmail.com', DEFAULT_TEAM_MEMBERS);
  assert.equal(companyAlias.found, true);
  assert.equal(companyAlias.account?.username, 'admin');
  assert.equal(companyAlias.account?.isRootAdmin, true);

  const tareq = findRegisteredAccountByIdentifier('tareq.acct@zsbaquatics.com', DEFAULT_TEAM_MEMBERS);
  assert.equal(tareq.found, true);
  assert.equal(tareq.account?.username, 'tareq');
  assert.equal(tareq.account?.isRootAdmin, false);

  const suspendedList = DEFAULT_TEAM_MEMBERS.map((m) =>
    m.username === 'tareq' ? { ...m, status: 'suspended' as const } : m
  );
  const suspendedLookup = findRegisteredAccountByIdentifier('tareq', suspendedList);
  assert.equal(suspendedLookup.found, false);
  assert.ok(suspendedLookup.error?.includes('suspended'));

  const unknown = findRegisteredAccountByIdentifier('nobody@example.com', DEFAULT_TEAM_MEMBERS);
  assert.equal(unknown.found, false);
  assert.ok(unknown.error?.includes('No active administrator'));

  const list = listRecoverableAccounts(DEFAULT_TEAM_MEMBERS);
  assert.ok(list.length >= 4);
});

test('createPasswordResetRequest & verifyPasswordResetConfirmation enforce code matching, expiry, attempts, and single use', () => {
  const lookup = findRegisteredAccountByIdentifier('sohelranaibs@gmail.com', DEFAULT_TEAM_MEMBERS);
  assert.ok(lookup.account);

  const now = 1_700_000_000_000;
  const req = createPasswordResetRequest({
    account: lookup.account,
    nowMs: now,
    ttlMs: 15 * 60 * 1000,
    codeOverride: '482910',
    tokenOverride: 'zsb-rst-test-token-123',
  });

  const emailPreview = buildConfirmationEmailContent(req, 'http://localhost:3000');
  assert.equal(emailPreview.to, 'sohelranaibs@gmail.com');
  assert.ok(emailPreview.subject.includes('482910'));
  assert.ok(emailPreview.confirmUrl.includes('reset_token=zsb-rst-test-token-123'));
  assert.equal(maskEmailAddress('sohelranaibs@gmail.com'), 'so**********@gmail.com');

  // Wrong code increments attempts and rejects
  const wrong1 = verifyPasswordResetConfirmation(req, { code: '000000' }, now + 5000);
  assert.equal(wrong1.valid, false);
  assert.equal(wrong1.updatedRequest.attempts, 1);
  assert.ok(wrong1.error?.includes('4 attempt(s) remaining'));

  // Expired code fails even if code matches
  const expired = verifyPasswordResetConfirmation(
    wrong1.updatedRequest,
    { code: '482910' },
    now + 16 * 60 * 1000
  );
  assert.equal(expired.valid, false);
  assert.ok(expired.error?.includes('expired'));

  // Valid code within TTL verifies
  const okCode = verifyPasswordResetConfirmation(
    wrong1.updatedRequest,
    { code: '482910' },
    now + 60_000
  );
  assert.equal(okCode.valid, true);
  assert.equal(okCode.updatedRequest.verified, true);

  // Token match verifies too
  const okToken = verifyPasswordResetConfirmation(
    req,
    { token: 'zsb-rst-test-token-123' },
    now + 60_000
  );
  assert.equal(okToken.valid, true);

  // Used token cannot be reused
  const usedReq = { ...okCode.updatedRequest, used: true };
  const reuse = verifyPasswordResetConfirmation(usedReq, { code: '482910' }, now + 65_000);
  assert.equal(reuse.valid, false);
  assert.ok(reuse.error?.includes('already been used'));
});

test('validatePasswordResetNewPassword & applyResetPasswordToTeamMembers update credentials cleanly', () => {
  const shortRes = validatePasswordResetNewPassword('12', '12');
  assert.equal(shortRes.valid, false);

  const mismatchRes = validatePasswordResetNewPassword('Zsb2026!', 'Zsb2025!');
  assert.equal(mismatchRes.valid, false);

  const goodRes = validatePasswordResetNewPassword('Zsb2026!', 'Zsb2026!');
  assert.equal(goodRes.valid, true);
  assert.equal(goodRes.normalizedPassword, 'Zsb2026!');

  // Root admin reset via zsbaquatics@gmail.com updates sohel team member & flags Super Admin update
  const rootLookup = findRegisteredAccountByIdentifier('zsbaquatics@gmail.com', DEFAULT_TEAM_MEMBERS);
  assert.ok(rootLookup.account);
  const appliedRoot = applyResetPasswordToTeamMembers(
    DEFAULT_TEAM_MEMBERS,
    rootLookup.account,
    'Zsb2026!'
  );
  assert.equal(appliedRoot.shouldUpdateSuperAdminPassword, true);
  assert.ok(appliedRoot.updatedUsernames.includes('sohel'));
  const updatedSohel = appliedRoot.updatedMembers.find((m) => m.username === 'sohel');
  assert.equal(updatedSohel?.password, 'Zsb2026!');

  // Non-root team member reset updates only that member without changing Super Admin master password
  const staffLookup = findRegisteredAccountByIdentifier('tareq.acct@zsbaquatics.com', DEFAULT_TEAM_MEMBERS);
  assert.ok(staffLookup.account);
  const appliedStaff = applyResetPasswordToTeamMembers(
    DEFAULT_TEAM_MEMBERS,
    staffLookup.account,
    'Tareq999'
  );
  assert.equal(appliedStaff.shouldUpdateSuperAdminPassword, false);
  assert.deepEqual(appliedStaff.updatedUsernames, ['tareq']);

  // Verify authenticateUser recognizes the newly updated password and rejects the old one
  const loginNew = authenticateUser('zsbaquatics@gmail.com', 'Zsb2026!', 'Zsb2026!');
  assert.equal(loginNew.valid, true);
  const loginOld = authenticateUser('zsbaquatics@gmail.com', 'admin123', 'Zsb2026!');
  assert.equal(loginOld.valid, false);
});
