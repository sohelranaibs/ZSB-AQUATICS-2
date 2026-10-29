import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SUPER_ADMIN_PASSWORD,
  verifySuperAdminPassword,
  validateSuperAdminPasswordChange,
  describeClearScope,
} from './superAdminAuth';

test('verifySuperAdminPassword rejects empty or whitespace-only passwords', () => {
  const res1 = verifySuperAdminPassword('');
  assert.equal(res1.valid, false);
  assert.match(res1.error || '', /required/i);

  const res2 = verifySuperAdminPassword('   ');
  assert.equal(res2.valid, false);
  assert.match(res2.error || '', /required/i);
});

test('verifySuperAdminPassword rejects wrong password and accepts valid default or custom password', () => {
  const wrong = verifySuperAdminPassword('wrong123', DEFAULT_SUPER_ADMIN_PASSWORD);
  assert.equal(wrong.valid, false);
  assert.match(wrong.error || '', /Invalid Super Admin password/i);

  const rightDefault = verifySuperAdminPassword('admin123');
  assert.equal(rightDefault.valid, true);
  assert.equal(rightDefault.error, undefined);

  const rightCustom = verifySuperAdminPassword('zsbSuper2026', 'zsbSuper2026');
  assert.equal(rightCustom.valid, true);
});

test('validateSuperAdminPasswordChange enforces current password, minimum length, and confirmation match', () => {
  const badCurrent = validateSuperAdminPasswordChange('wrong', 'newpass123', 'newpass123', 'admin123');
  assert.equal(badCurrent.valid, false);
  assert.match(badCurrent.error || '', /Current Super Admin password is incorrect/i);

  const tooShort = validateSuperAdminPasswordChange('admin123', '123', '123', 'admin123');
  assert.equal(tooShort.valid, false);
  assert.match(tooShort.error || '', /at least 4 characters/i);

  const mismatch = validateSuperAdminPasswordChange('admin123', 'zsb2026', 'zsb2027', 'admin123');
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.error || '', /do not match/i);

  const validChange = validateSuperAdminPasswordChange('admin123', 'zsb2026', 'zsb2026', 'admin123');
  assert.equal(validChange.valid, true);
  assert.equal(validChange.normalizedNewPassword, 'zsb2026');
});

test('describeClearScope accurately calculates targeted records for all and individual sheets', () => {
  const counts = { purchases: 5, packings: 8, payments: 4, otherCosts: 2 };

  const allDesc = describeClearScope('all', counts);
  assert.equal(allDesc.totalRecords, 19);
  assert.match(allDesc.breakdown, /5 Purchases, 8 Packing Lists, 4 Payments, 2 Other Costing/);

  const purDesc = describeClearScope('purchase', counts);
  assert.equal(purDesc.totalRecords, 5);
  assert.equal(purDesc.title, 'Purchase DB Only');

  const pkgDesc = describeClearScope('packing', counts);
  assert.equal(pkgDesc.totalRecords, 8);
  assert.equal(pkgDesc.title, 'Packing DB Only');

  const payDesc = describeClearScope('payment', counts);
  assert.equal(payDesc.totalRecords, 4);
  assert.equal(payDesc.title, 'Payment DB Only');
});
