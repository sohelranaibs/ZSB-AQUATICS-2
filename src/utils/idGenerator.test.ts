import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecordId, deduplicateRecords } from './idGenerator.ts';

test('generateRecordId produces distinct unique IDs in high-frequency batch loops', () => {
  const ids = new Set<string>();
  const count = 1000;

  for (let i = 0; i < count; i++) {
    const id = generateRecordId('pur');
    assert.match(id, /^pur-\d+-\d+-[a-z0-9]+$/);
    ids.add(id);
  }

  assert.equal(ids.size, count, 'All generated IDs must be strictly unique');
});

test('deduplicateRecords resolves duplicate IDs and replaces duplicates with unique IDs', () => {
  const records = [
    { id: 'pur-1792600039057', name: 'Item 1' },
    { id: 'pur-1792600039057', name: 'Item 2 (Duplicate)' },
    { id: 'pur-2', name: 'Item 3' },
    { id: '', name: 'Item 4 (Empty ID)' },
    { id: 'pur-1792600039057', name: 'Item 5 (Third duplicate)' },
  ];

  const cleaned = deduplicateRecords(records, 'pur');

  assert.equal(cleaned.length, 5);
  // First item keeps original ID
  assert.equal(cleaned[0].id, 'pur-1792600039057');
  assert.equal(cleaned[0].name, 'Item 1');

  // Second item gets a new unique ID
  assert.notEqual(cleaned[1].id, 'pur-1792600039057');
  assert.equal(cleaned[1].name, 'Item 2 (Duplicate)');

  // Third item keeps 'pur-2'
  assert.equal(cleaned[2].id, 'pur-2');

  // Fourth item gets a new unique ID
  assert.ok(cleaned[3].id.length > 0);

  // All resulting IDs must be distinct
  const uniqueIds = new Set(cleaned.map((r) => r.id));
  assert.equal(uniqueIds.size, 5);
});

test('deduplicateRecords handles empty or invalid inputs gracefully', () => {
  // @ts-expect-error test invalid input
  assert.deepEqual(deduplicateRecords(null, 'pur'), []);
  // @ts-expect-error test invalid input
  assert.deepEqual(deduplicateRecords(undefined, 'pur'), []);
  assert.deepEqual(deduplicateRecords([], 'pur'), []);
});
