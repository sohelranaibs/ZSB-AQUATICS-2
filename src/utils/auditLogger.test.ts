import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  createAuditLogEntry,
  filterAuditLogs,
  calculateAuditLogStats,
  formatAuditLogsCSV,
} from './auditLogger.ts';

test('authenticateUser validates admin credentials and rejects empty or wrong inputs', () => {
  const emptyUser = authenticateUser('', 'ZSB@Admin2026');
  assert.equal(emptyUser.valid, false);
  assert.ok(emptyUser.error?.includes('Username'));

  const emptyPass = authenticateUser('admin', '');
  assert.equal(emptyPass.valid, false);
  assert.ok(emptyPass.error?.includes('Password'));

  const wrongPass = authenticateUser('admin', 'wrong-pass');
  assert.equal(wrongPass.valid, false);

  const validLogin = authenticateUser(
    'zsbaquatics@gmail.com',
    'ZSB@Admin2026',
    undefined,
    '2026-10-30T08:00:00.000Z'
  );
  assert.equal(validLogin.valid, true);
  assert.equal(validLogin.user?.displayName, 'Md. Sohel Rana');
  assert.equal(validLogin.user?.email, 'zsbaquatics@gmail.com');
});

test('createAuditLogEntry, filterAuditLogs, and calculateAuditLogStats track entries, edits, and deletions', () => {
  const logs = [
    createAuditLogEntry({
      id: 'log-1',
      timestamp: '2026-10-30T10:00:00.000Z',
      action: 'CREATE',
      module: 'Purchase',
      entityId: 'INV-2026-0001',
      summary: 'Created Purchase Challan INV-2026-0001 for ABDULLAH VAI',
      details: 'Qty: 150 KG · Total: TK 125,000',
      actor: 'Md. Sohel Rana',
    }),
    createAuditLogEntry({
      id: 'log-2',
      timestamp: '2026-10-30T10:15:00.000Z',
      action: 'UPDATE',
      module: 'Packing',
      entityId: 'PKG-2026-0001',
      summary: 'Updated Export Packing List PKG-2026-0001',
      details: 'Mark: AAD · Status: PAID',
      actor: 'Md. Sohel Rana',
    }),
    createAuditLogEntry({
      id: 'log-3',
      timestamp: '2026-10-30T10:30:00.000Z',
      action: 'DELETE',
      module: 'Payment',
      entityId: 'PAY-2026-0001',
      summary: 'Deleted Payment Voucher PAY-2026-0001',
      actor: 'Md. Sohel Rana',
    }),
  ];

  const stats = calculateAuditLogStats(logs);
  assert.equal(stats.totalCount, 3);
  assert.equal(stats.entriesCount, 1);
  assert.equal(stats.editsCount, 1);
  assert.equal(stats.deletionsCount, 1);
  assert.equal(stats.uniqueModulesCount, 3);

  const onlyEntries = filterAuditLogs(logs, { actionFilter: 'ENTRY' });
  assert.equal(onlyEntries.length, 1);
  assert.equal(onlyEntries[0].entityId, 'INV-2026-0001');

  const onlyEdits = filterAuditLogs(logs, { actionFilter: 'EDIT' });
  assert.equal(onlyEdits.length, 1);
  assert.equal(onlyEdits[0].entityId, 'PKG-2026-0001');

  const onlyDeletes = filterAuditLogs(logs, { actionFilter: 'DELETE' });
  assert.equal(onlyDeletes.length, 1);
  assert.equal(onlyDeletes[0].entityId, 'PAY-2026-0001');

  const csv = formatAuditLogsCSV(logs);
  assert.ok(csv.includes('INV-2026-0001'));
  assert.ok(csv.includes('Created Purchase Challan'));
});
