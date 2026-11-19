import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCanonicalTeamRole,
  canUserAccessTab,
  canUserDeleteRecords,
  canUserEditRecords,
  getFallbackTabForUser,
} from './rbacPermissions.ts';
import { AuthUser } from '../types/index.ts';

function makeUser(username: string, role: string): AuthUser {
  return {
    username,
    displayName: username,
    role,
    email: `${username}@zsbaquatics.com`,
    loginAt: '2026-11-18T10:00:00.000Z',
  };
}

test('Super Admin and Partner & Administrator have full system tab and delete access', () => {
  const admin = makeUser('admin', 'Partner & Administrator');
  assert.equal(resolveCanonicalTeamRole(admin), 'Super Admin');
  assert.equal(canUserAccessTab(admin, 'administration'), true);
  assert.equal(canUserAccessTab(admin, 'total_balance'), true);
  assert.equal(canUserAccessTab(admin, 'daily_expense'), true);
  assert.equal(canUserAccessTab(admin, 'profit_loss'), true);
  assert.equal(canUserDeleteRecords(admin), true);
  assert.equal(canUserEditRecords(admin), true);
});

test('Logistics Manager is restricted from Profit & Loss, Total Balance, Daily Expense, and Administration', () => {
  const rafiq = makeUser('rafiq', 'Logistics Manager');
  assert.equal(resolveCanonicalTeamRole(rafiq), 'Logistics Manager');
  assert.equal(canUserAccessTab(rafiq, 'packing_form'), true);
  assert.equal(canUserAccessTab(rafiq, 'air_way_bill'), true);
  assert.equal(canUserAccessTab(rafiq, 'exporter_payment_slip'), true);
  assert.equal(canUserAccessTab(rafiq, 'packing_db'), true);

  assert.equal(canUserAccessTab(rafiq, 'profit_loss'), false);
  assert.equal(canUserAccessTab(rafiq, 'total_balance'), false);
  assert.equal(canUserAccessTab(rafiq, 'daily_expense'), false);
  assert.equal(canUserAccessTab(rafiq, 'administration'), false);
  assert.equal(canUserAccessTab(rafiq, 'settings'), false);
  assert.equal(canUserDeleteRecords(rafiq), false);
});

test('Senior Accountant can access P&L, Daily Expense, and payments but cannot access Administration or delete records', () => {
  const tareq = makeUser('tareq', 'Senior Accountant');
  assert.equal(resolveCanonicalTeamRole(tareq), 'Senior Accountant');
  assert.equal(canUserAccessTab(tareq, 'profit_loss'), true);
  assert.equal(canUserAccessTab(tareq, 'daily_expense'), true);
  assert.equal(canUserAccessTab(tareq, 'payment_form'), true);
  assert.equal(canUserAccessTab(tareq, 'search_reports'), true);
  assert.equal(canUserAccessTab(tareq, 'administration'), false);
  assert.equal(canUserDeleteRecords(tareq), false);
  assert.equal(canUserEditRecords(tareq), true);
});

test('Read Only role has zero edit/delete rights and falls back safely to dashboard', () => {
  const auditor = makeUser('auditor', 'Read Only');
  assert.equal(canUserEditRecords(auditor), false);
  assert.equal(canUserDeleteRecords(auditor), false);
  assert.equal(canUserAccessTab(auditor, 'purchase_form'), false);
  assert.equal(canUserAccessTab(auditor, 'search_reports'), true);
  assert.equal(getFallbackTabForUser(auditor), 'dashboard');
});
