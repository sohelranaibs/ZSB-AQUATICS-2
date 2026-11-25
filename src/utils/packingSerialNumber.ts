import { PackingRecord } from '../types/index.ts';

/**
 * Checks whether a value is a valid positive integer persistent serial number (1, 2, 3, ...).
 */
export function isValidPackingSerialNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val > 0;
}

/**
 * Computes the next auto-incremented persistent S. No. for a newly created Packing List record.
 * Always increments from the highest existing valid serialNumber (or 0 -> 1 if none exist),
 * so deleting earlier rows never renumbers or collides with surviving rows.
 */
export function getNextPackingSerialNumber(records: readonly PackingRecord[]): number {
  let maxSerial = 0;
  for (const rec of records) {
    if (isValidPackingSerialNumber(rec?.serialNumber) && rec.serialNumber > maxSerial) {
      maxSerial = rec.serialNumber;
    }
  }
  return maxSerial + 1;
}

/**
 * Ensures every PackingRecord in the collection has a persistent, unique, positive integer
 * `serialNumber` (`S. No.`).
 * - Preserves already-assigned valid unique serial numbers untouched.
 * - Returns the original array reference unchanged when all records already have valid unique serials.
 * - Backfills missing (or duplicate) serial numbers deterministically in chronological creation order
 *   (createdAt -> packingDate -> invoiceNumber -> original index) starting after the highest existing serial.
 */
export function ensurePackingSerialNumbers(
  records: readonly PackingRecord[]
): PackingRecord[] {
  if (!Array.isArray(records) || records.length === 0) {
    return Array.isArray(records) ? (records as PackingRecord[]) : [];
  }

  const seenSerials = new Set<number>();
  let maxSerial = 0;
  const needsAssignmentIndices: number[] = [];

  for (let i = 0; i < records.length; i++) {
    const serial = records[i]?.serialNumber;
    if (isValidPackingSerialNumber(serial) && !seenSerials.has(serial)) {
      seenSerials.add(serial);
      if (serial > maxSerial) {
        maxSerial = serial;
      }
    } else {
      needsAssignmentIndices.push(i);
    }
  }

  if (needsAssignmentIndices.length === 0) {
    return records as PackingRecord[];
  }

  // Assign unassigned records deterministically from oldest to newest
  const orderedToAssign = [...needsAssignmentIndices].sort((idxA, idxB) => {
    const a = records[idxA];
    const b = records[idxB];
    const createdCmp = (a.createdAt || '').localeCompare(b.createdAt || '');
    if (createdCmp !== 0) return createdCmp;
    const dateCmp = (a.packingDate || '').localeCompare(b.packingDate || '');
    if (dateCmp !== 0) return dateCmp;
    const invCmp = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (invCmp !== 0) return invCmp;
    return idxA - idxB;
  });

  const assignedSerialByIndex = new Map<number, number>();
  let nextSerial = maxSerial + 1;
  for (const idx of orderedToAssign) {
    while (seenSerials.has(nextSerial)) {
      nextSerial += 1;
    }
    assignedSerialByIndex.set(idx, nextSerial);
    seenSerials.add(nextSerial);
    nextSerial += 1;
  }

  return records.map((rec, idx) => {
    const assigned = assignedSerialByIndex.get(idx);
    if (assigned === undefined) {
      return rec;
    }
    return {
      ...rec,
      serialNumber: assigned,
    };
  });
}

/**
 * Builds a deterministic lookup map from PackingRecord.id -> persistent S. No.
 * across the complete Packing List dataset so filtered or sorted ledger views
 * always display the exact persistent S. No. for every row.
 */
export function buildPackingSerialNumberMap(
  allPackings: readonly PackingRecord[]
): Map<string, number> {
  const normalized = ensurePackingSerialNumbers(allPackings);
  const map = new Map<string, number>();
  for (const rec of normalized) {
    if (isValidPackingSerialNumber(rec.serialNumber)) {
      map.set(rec.id, rec.serialNumber);
    }
  }
  return map;
}
