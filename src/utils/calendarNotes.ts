/**
 * Pure date-wise Calendar Notepad logic & localStorage persistence.
 * Stores one rich text note per ISO date (`YYYY-MM-DD`) so users can jot down
 * reminders, supplier follow-ups, or daily thoughts directly on any calendar date.
 */

export const CALENDAR_NOTES_STORAGE_KEY = 'zsb_calendar_notes_v1';

export interface CalendarDateNote {
  dateIso: string; // YYYY-MM-DD
  content: string;
  updatedAt: string; // ISO timestamp
}

export type CalendarNotesMap = Record<string, CalendarDateNote>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidIsoDate(dateIso: string): boolean {
  return ISO_DATE_RE.test((dateIso || '').trim());
}

export function normalizeNoteText(rawText: string): string {
  return (rawText || '').replace(/\r\n/g, '\n');
}

export function hasNoteContent(rawText: string | undefined | null): boolean {
  return Boolean(rawText && rawText.trim().length > 0);
}

/**
 * Safely parses serialized CalendarNotesMap JSON, ignoring invalid or empty entries.
 */
export function parseCalendarNotesJson(rawJson: string | null | undefined): CalendarNotesMap {
  if (!rawJson || typeof rawJson !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: CalendarNotesMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const cleanDate = key.trim();
      if (!isValidIsoDate(cleanDate)) continue;
      if (!value || typeof value !== 'object') continue;
      const candidate = value as Partial<CalendarDateNote>;
      if (typeof candidate.content !== 'string') continue;
      const normalized = normalizeNoteText(candidate.content);
      if (!hasNoteContent(normalized)) continue;
      result[cleanDate] = {
        dateIso: cleanDate,
        content: normalized,
        updatedAt:
          typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim().length > 0
            ? candidate.updatedAt
            : new Date().toISOString(),
      };
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Loads saved date-wise notes from localStorage (returns empty map in non-browser contexts).
 */
export function loadCalendarNotesFromStorage(): CalendarNotesMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    return parseCalendarNotesJson(window.localStorage.getItem(CALENDAR_NOTES_STORAGE_KEY));
  } catch {
    return {};
  }
}

/**
 * Persists CalendarNotesMap to localStorage safely.
 */
export function persistCalendarNotesToStorage(notesMap: CalendarNotesMap): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(CALENDAR_NOTES_STORAGE_KEY, JSON.stringify(notesMap));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a new CalendarNotesMap with the given date's note saved (or removed if blank/whitespace).
 */
export function upsertCalendarNote(
  notesMap: CalendarNotesMap,
  dateIso: string,
  rawContent: string,
  nowIso: string = new Date().toISOString()
): CalendarNotesMap {
  const cleanDate = (dateIso || '').trim();
  if (!isValidIsoDate(cleanDate)) return notesMap;

  const normalized = normalizeNoteText(rawContent);
  if (!hasNoteContent(normalized)) {
    return deleteCalendarNote(notesMap, cleanDate);
  }

  return {
    ...notesMap,
    [cleanDate]: {
      dateIso: cleanDate,
      content: normalized,
      updatedAt: nowIso,
    },
  };
}

/**
 * Returns a new CalendarNotesMap with the specified date's note removed.
 */
export function deleteCalendarNote(
  notesMap: CalendarNotesMap,
  dateIso: string
): CalendarNotesMap {
  const cleanDate = (dateIso || '').trim();
  if (!Object.prototype.hasOwnProperty.call(notesMap, cleanDate)) {
    return notesMap;
  }
  const next: CalendarNotesMap = { ...notesMap };
  delete next[cleanDate];
  return next;
}

/**
 * Returns sorted ISO dates (`YYYY-MM-DD`) in `monthYm` (`YYYY-MM`) that have a saved note.
 */
export function getNotedDatesInMonth(
  notesMap: CalendarNotesMap,
  monthYm: string
): string[] {
  const cleanMonth = (monthYm || '').trim();
  if (!ISO_MONTH_RE.test(cleanMonth)) return [];
  return Object.keys(notesMap)
    .filter((dateIso) => dateIso.startsWith(`${cleanMonth}-`) && hasNoteContent(notesMap[dateIso]?.content))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Returns a concise single-line preview of a note suitable for tooltips and badges.
 */
export function formatNotePreview(content: string, maxLength: number = 64): string {
  const collapsed = (content || '').replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

/**
 * Formats a short readable date chip label like "25 Nov" from an ISO date string.
 */
export function formatShortCalendarNoteChip(dateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateIso || '').trim());
  if (!match) return dateIso;
  const shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const monthLabel = shortMonths[Number(match[2]) - 1] || match[2];
  return `${Number(match[3])} ${monthLabel}`;
}

/**
 * Formats the saved timestamp into a friendly local time label (e.g. "10:15 PM").
 */
export function formatNoteUpdatedTime(updatedAtIso: string | undefined): string {
  if (!updatedAtIso) return '';
  const dt = new Date(updatedAtIso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
