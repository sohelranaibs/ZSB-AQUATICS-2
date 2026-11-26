import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteCalendarNote,
  formatNotePreview,
  formatShortCalendarNoteChip,
  getNotedDatesInMonth,
  parseCalendarNotesJson,
  upsertCalendarNote,
} from './calendarNotes.ts';

test('upsertCalendarNote saves date-wise notes and removes entry when cleared or whitespace-only', () => {
  const initial = {};
  const saved = upsertCalendarNote(
    initial,
    '2026-11-25',
    'Call Rahim Fisheries\r\nConfirm Kunming flight space',
    '2026-11-25T10:15:00.000Z'
  );

  assert.equal(Object.keys(saved).length, 1);
  assert.equal(saved['2026-11-25'].dateIso, '2026-11-25');
  assert.equal(
    saved['2026-11-25'].content,
    'Call Rahim Fisheries\nConfirm Kunming flight space'
  );
  assert.equal(saved['2026-11-25'].updatedAt, '2026-11-25T10:15:00.000Z');
  // Immutability check
  assert.equal(Object.keys(initial).length, 0);

  // Whitespace-only content deletes the note cleanly
  const cleared = upsertCalendarNote(saved, '2026-11-25', '   \n\t  ');
  assert.equal(Object.keys(cleared).length, 0);
  assert.equal(cleared['2026-11-25'], undefined);
});

test('upsertCalendarNote ignores invalid ISO dates and deleteCalendarNote is idempotent', () => {
  const base = upsertCalendarNote({}, '2026-11-28', 'Check ice boxes', '2026-11-28T08:00:00.000Z');
  const afterInvalid = upsertCalendarNote(base, 'not-a-date', 'Ignored');
  assert.deepEqual(afterInvalid, base);

  const afterMissingDelete = deleteCalendarNote(base, '2026-11-01');
  assert.equal(afterMissingDelete, base);

  const afterDelete = deleteCalendarNote(base, '2026-11-28');
  assert.equal(Object.keys(afterDelete).length, 0);
});

test('parseCalendarNotesJson safely filters corrupt or blank entries', () => {
  assert.deepEqual(parseCalendarNotesJson(null), {});
  assert.deepEqual(parseCalendarNotesJson('{bad-json'), {});
  assert.deepEqual(parseCalendarNotesJson('[]'), {});

  const parsed = parseCalendarNotesJson(
    JSON.stringify({
      '2026-11-25': {
        dateIso: '2026-11-25',
        content: 'Prepare export invoice',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
      '2026-11-26': {
        dateIso: '2026-11-26',
        content: '   ',
        updatedAt: '2026-11-26T09:00:00.000Z',
      },
      'bad-key': {
        dateIso: 'bad-key',
        content: 'Should be dropped',
      },
    })
  );

  assert.deepEqual(Object.keys(parsed), ['2026-11-25']);
  assert.equal(parsed['2026-11-25'].content, 'Prepare export invoice');
});

test('getNotedDatesInMonth returns sorted noted dates for the target month only', () => {
  let map = upsertCalendarNote({}, '2026-11-28', 'Note 28', '2026-11-28T08:00:00.000Z');
  map = upsertCalendarNote(map, '2026-11-05', 'Note 05', '2026-11-05T08:00:00.000Z');
  map = upsertCalendarNote(map, '2026-12-01', 'December note', '2026-12-01T08:00:00.000Z');
  map = upsertCalendarNote(map, '2026-11-14', 'Note 14', '2026-11-14T08:00:00.000Z');

  assert.deepEqual(getNotedDatesInMonth(map, '2026-11'), [
    '2026-11-05',
    '2026-11-14',
    '2026-11-28',
  ]);
  assert.deepEqual(getNotedDatesInMonth(map, '2026-12'), ['2026-12-01']);
  assert.deepEqual(getNotedDatesInMonth(map, '2026-10'), []);
  assert.deepEqual(getNotedDatesInMonth(map, 'invalid'), []);
});

test('formatNotePreview and formatShortCalendarNoteChip produce clean UI strings', () => {
  assert.equal(formatNotePreview('Line one\n\n  Line two  ', 64), 'Line one Line two');
  assert.equal(formatNotePreview('A'.repeat(40), 10), 'AAAAAAAAA…');
  assert.equal(formatShortCalendarNoteChip('2026-11-05'), '5 Nov');
  assert.equal(formatShortCalendarNoteChip('2026-12-25'), '25 Dec');
});

test('persistCalendarNotesToStorage and loadCalendarNotesFromStorage round-trip via localStorage', async () => {
  const {
    CALENDAR_NOTES_STORAGE_KEY,
    loadCalendarNotesFromStorage,
    persistCalendarNotesToStorage,
  } = await import('./calendarNotes.ts');

  const backing = new Map<string, string>();
  const originalWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, value);
      },
      removeItem: (key: string) => {
        backing.delete(key);
      },
    },
  };

  try {
    const notes = upsertCalendarNote(
      {},
      '2026-11-28',
      'Confirm Kunming flight space',
      '2026-11-28T09:00:00.000Z'
    );
    assert.equal(persistCalendarNotesToStorage(notes), true);
    assert.ok(backing.has(CALENDAR_NOTES_STORAGE_KEY));

    const reloaded = loadCalendarNotesFromStorage();
    assert.equal(reloaded['2026-11-28']?.content, 'Confirm Kunming flight space');
    assert.equal(reloaded['2026-11-28']?.updatedAt, '2026-11-28T09:00:00.000Z');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
});
