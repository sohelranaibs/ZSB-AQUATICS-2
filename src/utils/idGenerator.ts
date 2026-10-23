/**
 * Utilities for guaranteed unique ID generation and record deduplication.
 * Prevents React key collisions and duplicate ID persistence in localStorage.
 */

let globalIdCounter = 0;

/**
 * Generates a collision-resistant unique ID with high entropy.
 * Combines prefix, timestamp, incremental counter, and a random string.
 */
export function generateRecordId(prefix: string): string {
  globalIdCounter = (globalIdCounter + 1) % 1_000_000;
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${globalIdCounter}-${randomSuffix}`;
}

/**
 * Sanitizes an array of records to guarantee that every record has a unique ID.
 * If any record has an empty, duplicate, or missing ID, a fresh unique ID is assigned.
 */
export function deduplicateRecords<T extends { id: string }>(records: T[], prefix: string): T[] {
  if (!Array.isArray(records)) {
    return [];
  }

  const seenIds = new Set<string>();
  return records.map((record, index) => {
    let id = record && typeof record.id === 'string' ? record.id.trim() : '';

    if (!id || seenIds.has(id)) {
      id = generateRecordId(`${prefix}-dedup-${index}`);
    }

    seenIds.add(id);
    return id === record?.id ? record : { ...record, id };
  });
}
