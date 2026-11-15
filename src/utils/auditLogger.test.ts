import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  createAuditLogEntry,
  filterAuditLogs,
  calculateAuditLogStats,
  formatAuditLogsCSV,
  getRelativeTimeInterval,
  isAuditIntervalInverted,
  isAuditTimestampInInterval,
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

test('authenticateUser invalidates all previous default passwords after password update', () => {
  const customPass = 'NewSecretPassword2026!';

  // Test 1: All previous default passwords must fail when password has been updated
  const prevDefault1 = authenticateUser('zsbaquatics@gmail.com', 'admin123', customPass);
  assert.equal(prevDefault1.valid, false);
  assert.ok(prevDefault1.error?.includes('updated'));

  const prevDefault2 = authenticateUser('zsbaquatics@gmail.com', 'ZSB@Admin2026', customPass);
  assert.equal(prevDefault2.valid, false);
  assert.ok(prevDefault2.error?.includes('updated'));

  const prevDefault3 = authenticateUser('admin', 'zsb2026', customPass);
  assert.equal(prevDefault3.valid, false);
  assert.ok(prevDefault3.error?.includes('updated'));

  // Test 2: ONLY the updated custom password passes!
  const updatedLogin = authenticateUser('zsbaquatics@gmail.com', customPass, customPass);
  assert.equal(updatedLogin.valid, true);
  assert.equal(updatedLogin.user?.displayName, 'Md. Sohel Rana');
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

test('filterAuditLogs filters accurately by local calendar date range and intraday time interval', () => {
  const localTs = (y: number, m: number, d: number, hh: number, mm: number) =>
    new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();

  const logs = [
    createAuditLogEntry({
      id: 't-1',
      timestamp: localTs(2026, 11, 10, 8, 30),
      action: 'CREATE',
      module: 'Purchase',
      entityId: 'PUR-10',
      summary: 'Morning purchase on Nov 10',
      actor: 'Md. Sohel Rana',
    }),
    createAuditLogEntry({
      id: 't-2',
      timestamp: localTs(2026, 11, 14, 14, 15),
      action: 'UPDATE',
      module: 'Packing',
      entityId: 'PKG-14',
      summary: 'Afternoon edit on Nov 14',
      actor: 'Md. Sohel Rana',
    }),
    createAuditLogEntry({
      id: 't-3',
      timestamp: localTs(2026, 11, 15, 9, 45),
      action: 'CREATE',
      module: 'Payment',
      entityId: 'PAY-15-AM',
      summary: 'Morning payment on Nov 15',
      actor: 'Md. Sohel Rana',
    }),
    createAuditLogEntry({
      id: 't-4',
      timestamp: localTs(2026, 11, 15, 23, 30),
      action: 'DELETE',
      module: 'Payment',
      entityId: 'PAY-15-PM',
      summary: 'Late night deletion on Nov 15',
      actor: 'Md. Sohel Rana',
    }),
  ];

  // Inclusive single-day local calendar range includes late-night local event regardless of UTC offset
  const nov15Only = filterAuditLogs(logs, {
    startDate: '2026-11-15',
    endDate: '2026-11-15',
  });
  assert.deepEqual(nov15Only.map((l) => l.id), ['t-3', 't-4']);

  // Specific intraday time interval: Nov 14 14:00 -> Nov 15 10:00
  const intradayWindow = filterAuditLogs(logs, {
    startDate: '2026-11-14',
    startTime: '14:00',
    endDate: '2026-11-15',
    endTime: '10:00',
  });
  assert.deepEqual(intradayWindow.map((l) => l.id), ['t-2', 't-3']);

  // Time-of-day only filter across all dates (08:00 - 10:00)
  const morningOnly = filterAuditLogs(logs, {
    startTime: '08:00',
    endTime: '10:00',
  });
  assert.deepEqual(morningOnly.map((l) => l.id), ['t-1', 't-3']);

  // Open-ended startDate + module + action combined
  const nov14OnwardPayment = filterAuditLogs(logs, {
    startDate: '2026-11-14',
    moduleFilter: 'Payment',
    actionFilter: 'ENTRY',
  });
  assert.deepEqual(nov14OnwardPayment.map((l) => l.id), ['t-3']);

  // Date-only string matches same calendar day
  assert.equal(
    isAuditTimestampInInterval('2026-11-15', {
      startDate: '2026-11-15',
      endDate: '2026-11-15',
    }),
    true
  );
  assert.equal(isAuditTimestampInInterval('invalid-ts', { startDate: '2026-11-15' }), false);
});

test('getRelativeTimeInterval and isAuditIntervalInverted handle rolling intervals and boundary validation', () => {
  // Reference local time: 2026-11-15 00:30 (checks midnight rollover for 1h and 24h)
  const ref = new Date(2026, 10, 15, 0, 30, 0, 0);

  const last1h = getRelativeTimeInterval(1, ref);
  assert.equal(last1h.startDate, '2026-11-14');
  assert.equal(last1h.startTime, '23:30');
  assert.equal(last1h.endDate, '2026-11-15');
  assert.equal(last1h.endTime, '00:30');

  const last24h = getRelativeTimeInterval(24, ref);
  assert.equal(last24h.startDate, '2026-11-14');
  assert.equal(last24h.startTime, '00:30');
  assert.equal(last24h.endDate, '2026-11-15');
  assert.equal(last24h.endTime, '00:30');

  // Inverted range detection
  assert.equal(
    isAuditIntervalInverted({ startDate: '2026-11-16', endDate: '2026-11-15' }),
    true
  );
  assert.equal(
    isAuditIntervalInverted({
      startDate: '2026-11-15',
      endDate: '2026-11-15',
      startTime: '14:00',
      endTime: '09:00',
    }),
    true
  );
  assert.equal(
    isAuditIntervalInverted({
      startDate: '2026-11-15',
      endDate: '2026-11-15',
      startTime: '09:00',
      endTime: '14:00',
    }),
    false
  );
});
