import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEAM_MEMBERS,
  ROLE_PERMISSIONS,
  validateTeamMember,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  toggleTeamMemberStatus,
  formatTeamMembersCSV,
} from './administration.ts';

test('DEFAULT_TEAM_MEMBERS has core partners Md. Sohel Rana and Md. Mizanur Rahman as root accounts', () => {
  assert.equal(DEFAULT_TEAM_MEMBERS.length >= 2, true);
  const sohel = DEFAULT_TEAM_MEMBERS.find((m) => m.username === 'sohel');
  assert.ok(sohel);
  assert.equal(sohel?.displayName, 'Md. Sohel Rana');
  assert.equal(sohel?.role, 'Super Admin');
  assert.equal(sohel?.isRoot, true);

  const mizanur = DEFAULT_TEAM_MEMBERS.find((m) => m.username === 'mizanur');
  assert.ok(mizanur);
  assert.equal(mizanur?.displayName, 'Md. Mizanur Rahman');
  assert.equal(mizanur?.role, 'Managing Partner');
  assert.equal(mizanur?.isRoot, true);
});

test('validateTeamMember checks required fields and prevents duplicate usernames and emails', () => {
  const invalid1 = validateTeamMember({ displayName: '', username: 'user1', email: 'user@test.com' }, DEFAULT_TEAM_MEMBERS);
  assert.equal(invalid1.valid, false);

  const invalid2 = validateTeamMember({ displayName: 'John', username: '', email: 'user@test.com' }, DEFAULT_TEAM_MEMBERS);
  assert.equal(invalid2.valid, false);

  const invalid3 = validateTeamMember({ displayName: 'John', username: 'sohel', email: 'sohel-new@test.com' }, DEFAULT_TEAM_MEMBERS);
  assert.equal(invalid3.valid, false);
  assert.match(invalid3.error || '', /already assigned/);

  const valid = validateTeamMember({ displayName: 'New Auditor', username: 'auditor1', email: 'audit@zsbaquatics.com' }, DEFAULT_TEAM_MEMBERS);
  assert.equal(valid.valid, true);
});

test('addTeamMember adds member with correct role permissions', () => {
  const { updatedList, createdMember } = addTeamMember(DEFAULT_TEAM_MEMBERS, {
    displayName: 'Amina Khatun',
    username: 'amina',
    email: 'amina@zsbaquatics.com',
    role: 'Senior Accountant',
    status: 'active',
  });

  assert.equal(updatedList.length, DEFAULT_TEAM_MEMBERS.length + 1);
  assert.equal(createdMember.displayName, 'Amina Khatun');
  assert.deepEqual(createdMember.permissions, ROLE_PERMISSIONS['Senior Accountant']);
});

test('updateTeamMember updates fields and refreshes permissions on role change', () => {
  const members = [...DEFAULT_TEAM_MEMBERS];
  const updated = updateTeamMember(members, 'team-staff-003', {
    role: 'Logistics Manager',
    displayName: 'Tareq Ahmed (Promoted)',
  });

  const modified = updated.find((m) => m.id === 'team-staff-003');
  assert.equal(modified?.displayName, 'Tareq Ahmed (Promoted)');
  assert.equal(modified?.role, 'Logistics Manager');
  assert.deepEqual(modified?.permissions, ROLE_PERMISSIONS['Logistics Manager']);
});

test('deleteTeamMember prevents deleting root accounts and deletes non-root accounts', () => {
  const rootDel = deleteTeamMember(DEFAULT_TEAM_MEMBERS, 'team-root-001');
  assert.equal(rootDel.success, false);
  assert.match(rootDel.error || '', /Cannot delete core partner account/);

  const nonRootDel = deleteTeamMember(DEFAULT_TEAM_MEMBERS, 'team-staff-003');
  assert.equal(nonRootDel.success, true);
  assert.equal(nonRootDel.updatedList.some((m) => m.id === 'team-staff-003'), false);
});

test('toggleTeamMemberStatus toggles status and protects root accounts from suspension', () => {
  const rootToggle = toggleTeamMemberStatus(DEFAULT_TEAM_MEMBERS, 'team-root-001');
  assert.equal(rootToggle.success, false);
  assert.match(rootToggle.error || '', /cannot be suspended/);

  const nonRootToggle = toggleTeamMemberStatus(DEFAULT_TEAM_MEMBERS, 'team-staff-003');
  assert.equal(nonRootToggle.success, true);
  const staff = nonRootToggle.updatedList.find((m) => m.id === 'team-staff-003');
  assert.equal(staff?.status, 'suspended');
});

test('formatTeamMembersCSV outputs CSV with correct headers and rows', () => {
  const csv = formatTeamMembersCSV(DEFAULT_TEAM_MEMBERS);
  assert.ok(csv.includes('Display Name,Username,Email,Role,Status'));
  assert.ok(csv.includes('Md. Sohel Rana'));
  assert.ok(csv.includes('Md. Mizanur Rahman'));
});
