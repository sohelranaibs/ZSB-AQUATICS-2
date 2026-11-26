import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Save, StickyNote, Trash2, X } from 'lucide-react';
import {
  CalendarDateNote,
  formatNoteUpdatedTime,
  hasNoteContent,
} from '../utils/calendarNotes.ts';
import { formatCalendarSelectedDateHeading } from '../utils/dashboardCalendar.ts';

export interface CalendarNoteModalProps {
  isOpen: boolean;
  dateIso: string | null;
  existingNote?: CalendarDateNote;
  dayEventsCount?: number;
  onSave: (dateIso: string, content: string) => void;
  onDelete: (dateIso: string) => void;
  onClose: () => void;
}

export const CalendarNoteModal: React.FC<CalendarNoteModalProps> = ({
  isOpen,
  dateIso,
  existingNote,
  dayEventsCount = 0,
  onSave,
  onDelete,
  onClose,
}) => {
  const [draft, setDraft] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef<string>(draft);
  draftRef.current = draft;

  // Sync draft text whenever modal opens for a date
  useEffect(() => {
    if (!isOpen || !dateIso) return;
    setDraft(existingNote?.content ?? '');
    const rafId = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, dateIso, existingNote]);

  // Close modal on Escape key & save on Ctrl/Cmd+S without leaking to App.tsx global handlers
  useEffect(() => {
    if (!isOpen || !dateIso) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        onSave(dateIso, draftRef.current);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, dateIso, onSave, onClose]);

  if (!isOpen || !dateIso) return null;

  const isEditing = Boolean(existingNote && hasNoteContent(existingNote.content));
  const formattedDate = formatCalendarSelectedDateHeading(dateIso);
  const charCount = draft.length;
  const lineCount = draft ? draft.split('\n').length : 0;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(dateIso, draft);
    onClose();
  };

  const handleDelete = () => {
    onDelete(dateIso);
    onClose();
  };

  return (
    <div
      data-testid="calendar-note-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-note-modal-title"
        data-testid="calendar-note-modal"
        className="w-full max-w-lg rounded-xl bg-white border border-[#CBD8E6] shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-[#273E56] text-white px-5 py-3.5 border-b border-[#1E3247] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#1E3247] border border-white/15 flex items-center justify-center shrink-0">
              <StickyNote className="w-4 h-4 text-amber-300" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="calendar-note-modal-title"
                data-testid="calendar-note-modal-title"
                className="text-sm font-bold tracking-wide text-white"
              >
                {isEditing ? 'Edit Calendar Note' : 'Add Calendar Note'}
              </h2>
              <p
                data-testid="calendar-note-modal-date"
                className="text-[11px] text-sky-200 font-mono truncate flex items-center gap-1.5"
              >
                <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{formattedDate}</span>
                {isEditing && existingNote?.updatedAt && (
                  <span className="text-amber-200">
                    · Updated {formatNoteUpdatedTime(existingNote.updatedAt)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="calendar-note-modal-close-btn"
            aria-label="Close calendar note modal"
            onClick={onClose}
            className="!p-1.5 rounded-full flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3 bg-amber-50/30">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label
                htmlFor="calendar-note-modal-input"
                className="font-bold text-slate-800"
              >
                Notes &amp; Reminders for {formattedDate}
              </label>
              {dayEventsCount > 0 && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">
                  {dayEventsCount} ledger {dayEventsCount === 1 ? 'entry' : 'entries'} logged
                </span>
              )}
            </div>

            <textarea
              ref={textareaRef}
              id="calendar-note-modal-input"
              data-testid="calendar-note-modal-textarea"
              rows={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write whatever is on your mind for this date — supplier calls, flight bookings, payment reminders, or daily tasks..."
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1D6CE0]/40 focus:border-[#1D6CE0] resize-y min-h-[140px]"
            />

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Tip: Press Ctrl+S to save quickly</span>
              <span>
                {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {charCount} chars
              </span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              {(isEditing || hasNoteContent(draft)) && (
                <button
                  type="button"
                  data-testid="calendar-note-modal-delete-btn"
                  onClick={handleDelete}
                  className="!px-3 !py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Delete Note</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="calendar-note-modal-cancel-btn"
                onClick={onClose}
                className="!px-3.5 !py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="calendar-note-modal-save-btn"
                className="!px-4 !py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isEditing ? 'Update Note' : 'Save Note'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
