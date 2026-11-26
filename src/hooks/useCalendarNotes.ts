import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CALENDAR_NOTES_STORAGE_KEY,
  CalendarDateNote,
  CalendarNotesMap,
  deleteCalendarNote,
  getNotedDatesInMonth,
  hasNoteContent,
  loadCalendarNotesFromStorage,
  normalizeNoteText,
  parseCalendarNotesJson,
  persistCalendarNotesToStorage,
  upsertCalendarNote,
} from '../utils/calendarNotes.ts';

export interface UseCalendarNotesReturn {
  notes: CalendarNotesMap;
  getNote: (dateIso: string) => CalendarDateNote | undefined;
  getNoteContent: (dateIso: string) => string;
  hasNote: (dateIso: string) => boolean;
  saveNote: (dateIso: string, rawContent: string) => CalendarDateNote | null;
  deleteNote: (dateIso: string) => void;
  getNotedDatesForMonth: (monthYm: string) => string[];
}

/**
 * Custom hook to persist and retrieve date-wise user notes in localStorage.
 * Synchronizes state across updates and browser tabs via the storage event.
 */
export function useCalendarNotes(): UseCalendarNotesReturn {
  const [notes, setNotes] = useState<CalendarNotesMap>(() => loadCalendarNotesFromStorage());
  const notesRef = useRef<CalendarNotesMap>(notes);
  notesRef.current = notes;

  // Keep multiple open tabs synchronized if localStorage changes externally
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CALENDAR_NOTES_STORAGE_KEY) return;
      setNotes(parseCalendarNotesJson(event.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const getNote = useCallback(
    (dateIso: string): CalendarDateNote | undefined => {
      const cleanDate = (dateIso || '').trim();
      return notes[cleanDate];
    },
    [notes]
  );

  const getNoteContent = useCallback(
    (dateIso: string): string => {
      const cleanDate = (dateIso || '').trim();
      return notes[cleanDate]?.content ?? '';
    },
    [notes]
  );

  const hasNote = useCallback(
    (dateIso: string): boolean => {
      const cleanDate = (dateIso || '').trim();
      return hasNoteContent(notes[cleanDate]?.content);
    },
    [notes]
  );

  const saveNote = useCallback((dateIso: string, rawContent: string): CalendarDateNote | null => {
    const cleanDate = (dateIso || '').trim();
    const normalized = normalizeNoteText(rawContent);
    const next = upsertCalendarNote(notesRef.current, cleanDate, normalized);
    notesRef.current = next;
    persistCalendarNotesToStorage(next);
    setNotes(next);
    return next[cleanDate] ?? null;
  }, []);

  const deleteNote = useCallback((dateIso: string): void => {
    const cleanDate = (dateIso || '').trim();
    const next = deleteCalendarNote(notesRef.current, cleanDate);
    if (next === notesRef.current) return;
    notesRef.current = next;
    persistCalendarNotesToStorage(next);
    setNotes(next);
  }, []);

  const getNotedDatesForMonth = useCallback(
    (monthYm: string): string[] => getNotedDatesInMonth(notes, monthYm),
    [notes]
  );

  return {
    notes,
    getNote,
    getNoteContent,
    hasNote,
    saveNote,
    deleteNote,
    getNotedDatesForMonth,
  };
}
