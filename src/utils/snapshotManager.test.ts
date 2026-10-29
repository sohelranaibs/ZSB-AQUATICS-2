import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDatabaseSnapshot,
  serializeSnapshotToJSON,
  validateAndParseSnapshotJSON,
  appendSnapshotWithRetention,
  computeSnapshotChecksum,
  describeSnapshotTrigger,
  SnapshotPayload,
} from './snapshotManager.ts';

function buildSamplePayload(): SnapshotPayload {
  return {
    purchases: [
      {
        id: 'pur-101',
        invoiceNumber: 'PUR-001',
        date: '2026-10-15',
        description: 'Rahim Crab Supplier',
        contactNumber: '01711000000',
        items: [
          {
            id: '1',
            item: 'FF1',
            quantity: 50,
            rate: 1000,
            totalAmount: 50000,
            previousAmount: 0,
            paidAmount: 30000,
            balance: 20000,
          },
        ],
        totalQty: 50,
        totalAmount: 50000,
        previousAmount: 0,
        paidAmount: 30000,
        balance: 20000,
        createdAt: '2026-10-15T10:00:00.000Z',
      },
    ],
    packings: [
      {
        id: 'pkg-201',
        invoiceNumber: 'PKG-001',
        shippingMark: 'ZSB-GZ-01',
        flight: 'CZ-392',
        destination: 'Guangzhou',
        shipper: 'Apex Cargo',
        packingDate: '2026-10-16',
        fromDate: '2026-10-16',
        toDate: '2026-10-16',
        items: [
          {
            id: '1',
            item: 'XXL',
            box: 10,
            weight: 15,
            totalWeight: 150,
            unit: 'KG',
            rate: 40,
            amount: 6000,
          },
        ],
        totalBox: 10,
        totalWeight: 150,
        totalAmount: 6000,
        rmbRate: 17,
        totalAmountBDT: 102000,
        createdAt: '2026-10-16T12:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 'pay-301',
        invoiceNumber: 'PAY-001',
        date: '2026-10-17',
        description: 'CASH',
        contactNumber: '01711000000',
        items: [
          {
            id: '1',
            description: 'CASH',
            debitAmount: 20000,
            creditAmount: 0,
            balance: 20000,
          },
        ],
        totalAmount: 20000,
        previousAmount: 20000,
        paidAmount: 20000,
        balance: 0,
        status: 'PAID',
        returnRMB: 0,
        paymentCategory: 'supplier',
        createdAt: '2026-10-17T14:00:00.000Z',
      },
    ],
    otherCosts: [
      {
        id: 'cost-401',
        date: '2026-10-18',
        category: 'ICE & BOX',
        amount: 4500,
        description: 'Foam boxes and ice packs',
        createdAt: '2026-10-18T08:00:00.000Z',
      },
    ],
  };
}

test('createDatabaseSnapshot creates an immutable snapshot with accurate counts and financials', () => {
  const payload = buildSamplePayload();
  const snapshot = createDatabaseSnapshot(payload, {
    label: 'Pre-Audit October Checkpoint',
    notes: 'Verified all October invoices',
    trigger: 'manual',
    createdAt: '2026-10-20T09:30:00.000Z',
  });

  assert.equal(snapshot.label, 'Pre-Audit October Checkpoint');
  assert.equal(snapshot.notes, 'Verified all October invoices');
  assert.equal(snapshot.trigger, 'manual');
  assert.equal(snapshot.recordCounts.purchases, 1);
  assert.equal(snapshot.recordCounts.packings, 1);
  assert.equal(snapshot.recordCounts.payments, 1);
  assert.equal(snapshot.recordCounts.otherCosts, 1);
  assert.equal(snapshot.recordCounts.totalRecords, 4);

  assert.equal(snapshot.financialSummary.totalPurchaseTk, 50000);
  assert.equal(snapshot.financialSummary.totalExportRmb, 6000);
  assert.equal(snapshot.financialSummary.totalExportTk, 102000);
  assert.equal(snapshot.financialSummary.totalPaymentTk, 20000);
  assert.equal(snapshot.financialSummary.totalExpenseTk, 4500);
  assert.match(snapshot.checksum, /^zsb-[0-9a-f]{8}$/);

  // Mutating original payload must not mutate snapshot payload
  payload.purchases[0].totalAmount = 999999;
  assert.equal(snapshot.payload.purchases[0].totalAmount, 50000);
});

test('serializeSnapshotToJSON and validateAndParseSnapshotJSON round-trip cleanly', () => {
  const payload = buildSamplePayload();
  const original = createDatabaseSnapshot(payload, {
    label: 'Daily Backup',
    trigger: 'manual',
  });

  const jsonStr = serializeSnapshotToJSON(original);
  const result = validateAndParseSnapshotJSON(jsonStr);

  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0);
  assert.ok(result.snapshot);
  assert.equal(result.snapshot.label, 'Daily Backup');
  assert.equal(result.snapshot.recordCounts.totalRecords, 4);
  assert.equal(result.snapshot.checksum, original.checksum);
  assert.equal(result.snapshot.payload.packings[0].shippingMark, 'ZSB-GZ-01');
});

test('validateAndParseSnapshotJSON supports legacy flat exportDatabaseJSON backups', () => {
  const payload = buildSamplePayload();
  const legacyJson = JSON.stringify({
    purchases: payload.purchases,
    packings: payload.packings,
    payments: payload.payments,
    otherCosts: payload.otherCosts,
    exportedAt: '2026-10-19T12:00:00.000Z',
  });

  const result = validateAndParseSnapshotJSON(legacyJson);
  assert.equal(result.valid, true);
  assert.ok(result.snapshot);
  assert.equal(result.snapshot.recordCounts.totalRecords, 4);
  assert.equal(result.snapshot.payload.purchases[0].invoiceNumber, 'PUR-001');
  assert.equal(result.snapshot.trigger, 'imported_file');
});

test('validateAndParseSnapshotJSON rejects empty, syntax-corrupted, or unrecognized JSON', () => {
  const emptyRes = validateAndParseSnapshotJSON('   ');
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.error || '', /empty/i);

  const syntaxRes = validateAndParseSnapshotJSON('{ "purchases": [1, 2, ');
  assert.equal(syntaxRes.valid, false);
  assert.match(syntaxRes.error || '', /Corrupted JSON format/i);

  const arrayRootRes = validateAndParseSnapshotJSON('[1, 2, 3]');
  assert.equal(arrayRootRes.valid, false);
  assert.match(arrayRootRes.error || '', /root JSON value must be an object/i);

  const unrecognizedRes = validateAndParseSnapshotJSON('{"hello": "world"}');
  assert.equal(unrecognizedRes.valid, false);
  assert.match(unrecognizedRes.error || '', /missing database collections/i);

  const nonArrayCollectionRes = validateAndParseSnapshotJSON('{"purchases": "corrupted-string"}');
  assert.equal(nonArrayCollectionRes.valid, false);
  assert.match(nonArrayCollectionRes.error || '', /Corrupted "purchases" collection/i);
});

test('validateAndParseSnapshotJSON repairs partially corrupted records and deduplicates IDs', () => {
  const partiallyCorruptedJson = JSON.stringify({
    label: 'Recovered Partial File',
    purchases: [
      null,
      {
        id: 'dup-id',
        invoiceNumber: '',
        description: 'Vendor A',
        totalAmount: '15000',
      },
      {
        id: 'dup-id',
        invoiceNumber: 'PUR-002',
        description: 'Vendor B',
        totalAmount: 25000,
      },
    ],
    packings: [],
    payments: [],
    otherCosts: [],
  });

  const result = validateAndParseSnapshotJSON(partiallyCorruptedJson);
  assert.equal(result.valid, true);
  assert.ok(result.snapshot);
  assert.equal(result.snapshot.recordCounts.purchases, 2);
  assert.equal(result.warnings.length, 1);
  assert.notEqual(
    result.snapshot.payload.purchases[0].id,
    result.snapshot.payload.purchases[1].id
  );
  assert.equal(result.snapshot.payload.purchases[0].totalAmount, 15000);
});

test('appendSnapshotWithRetention prepends newest snapshot and enforces max retention limit', () => {
  const payload = buildSamplePayload();
  const s1 = createDatabaseSnapshot(payload, { id: 'snap-1', label: 'Snap 1' });
  const s2 = createDatabaseSnapshot(payload, { id: 'snap-2', label: 'Snap 2' });
  const s3 = createDatabaseSnapshot(payload, { id: 'snap-3', label: 'Snap 3' });

  let list = appendSnapshotWithRetention([], s1, 2);
  list = appendSnapshotWithRetention(list, s2, 2);
  list = appendSnapshotWithRetention(list, s3, 2);

  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'snap-3');
  assert.equal(list[1].id, 'snap-2');
});

test('describeSnapshotTrigger returns clean labels and computeSnapshotChecksum is deterministic', () => {
  const payload = buildSamplePayload();
  assert.equal(computeSnapshotChecksum(payload), computeSnapshotChecksum(payload));
  assert.equal(describeSnapshotTrigger('auto_pre_clear'), 'Auto Safety Backup (Pre-Clear)');
  assert.equal(describeSnapshotTrigger('manual'), 'Manual Snapshot');
});
