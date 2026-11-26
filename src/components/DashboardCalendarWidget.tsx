import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Package,
  Plus,
  ReceiptText,
  Save,
  ShoppingCart,
  StickyNote,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  MortalityRecord,
  OtherCostRecord,
  PackingRecord,
  PaymentRecord,
  PurchaseRecord,
} from '../types/index.ts';
import { UpcomingRecurringPaymentItem } from '../utils/recurringPayments.ts';
import { formatCurrency } from '../utils/calculations.ts';
import { getTodayLocalIsoDate } from '../utils/dailyExpense.ts';
import { useCalendarNotes } from '../hooks/useCalendarNotes.ts';
import { CalendarNoteModal } from './CalendarNoteModal.tsx';
import {
  formatNotePreview,
  formatNoteUpdatedTime,
  formatShortCalendarNoteChip,
  hasNoteContent,
  normalizeNoteText,
} from '../utils/calendarNotes.ts';
import {
  buildCalendarActivityMap,
  buildMonthCalendarCells,
  calculateCalendarMonthTotals,
  CalendarActivityKind,
  createEmptyDayAggregate,
  formatCalendarMonthHeading,
  formatCalendarSelectedDateHeading,
  shiftCalendarMonth,
} from '../utils/dashboardCalendar.ts';

interface DashboardCalendarWidgetProps {
  purchases: readonly PurchaseRecord[];
  packings: readonly PackingRecord[];
  payments: readonly PaymentRecord[];
  otherCosts: readonly OtherCostRecord[];
  mortalities: readonly MortalityRecord[];
  upcomingRecurringPayments?: readonly UpcomingRecurringPaymentItem[];
  currency: string;
  onNavigateTab: (
    tab: 'purchase_form' | 'packing_form' | 'payment_form' | 'daily_expense'
  ) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const KIND_BADGE_MAP: Record<
  CalendarActivityKind,
  { label: string; badgeClass: string; dotClass: string }
> = {
  purchase: {
    label: 'Purchase',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
    dotClass: 'bg-sky-600',
  },
  packing: {
    label: 'Export',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-200',
    dotClass: 'bg-teal-600',
  },
  payment: {
    label: 'Payment',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    dotClass: 'bg-indigo-600',
  },
  expense: {
    label: 'Expense',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  mortality: {
    label: 'Mortality',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-200',
    dotClass: 'bg-purple-600',
  },
  upcoming_due: {
    label: 'Due',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
    dotClass: 'bg-rose-600',
  },
};

export const DashboardCalendarWidget: React.FC<DashboardCalendarWidgetProps> = ({
  purchases,
  packings,
  payments,
  otherCosts,
  mortalities,
  upcomingRecurringPayments = [],
  currency,
  onNavigateTab,
}) => {
  const todayIso = getTodayLocalIsoDate();
  const [displayedMonth, setDisplayedMonth] = useState<string>(() => todayIso.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [modalDateIso, setModalDateIso] = useState<string | null>(null);
  const {
    notes: notesMap,
    getNote,
    getNoteContent,
    saveNote,
    deleteNote,
    getNotedDatesForMonth,
  } = useCalendarNotes();

  const [draftNote, setDraftNote] = useState<string>(() => getNoteContent(todayIso));
  const [justSavedFlag, setJustSavedFlag] = useState<boolean>(false);

  const selectedDateRef = useRef<string>(selectedDate);
  const draftNoteRef = useRef<string>(draftNote);
  const notesMapRef = useRef(notesMap);

  selectedDateRef.current = selectedDate;
  draftNoteRef.current = draftNote;
  notesMapRef.current = notesMap;

  const commitNoteForDate = useCallback(
    (dateIso: string, rawText: string, showSavedBadge = false) => {
      const normalizedDraft = normalizeNoteText(rawText);
      const existingSaved = notesMapRef.current[dateIso]?.content ?? '';
      if (
        normalizedDraft === existingSaved &&
        (hasNoteContent(normalizedDraft) || !notesMapRef.current[dateIso])
      ) {
        if (showSavedBadge && hasNoteContent(normalizedDraft)) {
          setJustSavedFlag(true);
        }
        return;
      }
      saveNote(dateIso, normalizedDraft);
      if (showSavedBadge) {
        setJustSavedFlag(true);
      }
    },
    [saveNote]
  );

  // Auto-save inline draft changes gently after short pause so thoughts are never lost
  useEffect(() => {
    const existingSaved = notesMapRef.current[selectedDate]?.content ?? '';
    if (normalizeNoteText(draftNote) === existingSaved) return undefined;
    const timer = window.setTimeout(() => {
      commitNoteForDate(selectedDate, draftNote, false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draftNote, selectedDate, commitNoteForDate]);

  // Reset transient "Saved" highlight after brief confirmation
  useEffect(() => {
    if (!justSavedFlag) return undefined;
    const timer = window.setTimeout(() => setJustSavedFlag(false), 1800);
    return () => window.clearTimeout(timer);
  }, [justSavedFlag]);

  // Flush any unsaved inline note if component unmounts
  useEffect(() => {
    return () => {
      const dateIso = selectedDateRef.current;
      const latestText = draftNoteRef.current;
      const existingSaved = notesMapRef.current[dateIso]?.content ?? '';
      if (normalizeNoteText(latestText) !== existingSaved) {
        saveNote(dateIso, latestText);
      }
    };
  }, [saveNote]);

  const switchSelectedDate = useCallback(
    (nextDateIso: string, syncMonth: boolean) => {
      const currentDateIso = selectedDateRef.current;
      const latestDraft = draftNoteRef.current;
      const currentSaved = notesMapRef.current[currentDateIso]?.content ?? '';

      if (currentDateIso !== nextDateIso && normalizeNoteText(latestDraft) !== currentSaved) {
        saveNote(currentDateIso, latestDraft);
      }

      setSelectedDate(nextDateIso);
      setDraftNote(notesMapRef.current[nextDateIso]?.content ?? '');
      setJustSavedFlag(false);
      if (syncMonth) {
        setDisplayedMonth(nextDateIso.slice(0, 7));
      }
    },
    [saveNote]
  );

  const handleClearSelectedNote = () => {
    setDraftNote('');
    setJustSavedFlag(false);
    deleteNote(selectedDate);
  };

  const handleModalSaveNote = (dateIso: string, content: string) => {
    const saved = saveNote(dateIso, content);
    if (dateIso === selectedDateRef.current) {
      setDraftNote(saved?.content ?? '');
      if (saved) {
        setJustSavedFlag(true);
      }
    }
  };

  const handleModalDeleteNote = (dateIso: string) => {
    deleteNote(dateIso);
    if (dateIso === selectedDateRef.current) {
      setDraftNote('');
      setJustSavedFlag(false);
    }
  };

  const activityMap = useMemo(
    () =>
      buildCalendarActivityMap({
        purchases,
        packings,
        payments,
        otherCosts,
        mortalities,
        upcomingRecurringPayments,
      }),
    [purchases, packings, payments, otherCosts, mortalities, upcomingRecurringPayments]
  );

  const calendarCells = useMemo(
    () => buildMonthCalendarCells(displayedMonth),
    [displayedMonth]
  );

  const monthTotals = useMemo(
    () => calculateCalendarMonthTotals(activityMap, displayedMonth),
    [activityMap, displayedMonth]
  );

  const notedDatesInMonth = useMemo(
    () => getNotedDatesForMonth(displayedMonth),
    [getNotedDatesForMonth, displayedMonth]
  );

  const selectedDay = useMemo(
    () => activityMap.get(selectedDate) ?? createEmptyDayAggregate(selectedDate),
    [activityMap, selectedDate]
  );

  const savedSelectedNote = getNote(selectedDate);
  const isDraftDirty =
    normalizeNoteText(draftNote) !== (savedSelectedNote?.content ?? '');

  const handleSelectCell = (dateIso: string, inCurrentMonth: boolean) => {
    switchSelectedDate(dateIso, !inCurrentMonth);
    setModalDateIso(dateIso);
  };

  const handleJumpToday = () => {
    switchSelectedDate(todayIso, true);
  };

  return (
    <section
      aria-label="Business Operations & Ledger Calendar"
      data-testid="dashboard-calendar-widget"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Header Bar */}
      <div className="bg-[#273E56] text-white px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-[#1E3247] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#1E3247] border border-white/15 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-amber-400" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-wide text-white">
              Operations &amp; Ledger Calendar
            </h2>
            <p className="text-[11px] text-sky-200 font-mono truncate">
              {formatCalendarMonthHeading(displayedMonth)} · {monthTotals.activeDays} active{' '}
              {monthTotals.activeDays === 1 ? 'day' : 'days'} · {monthTotals.totalEvents}{' '}
              {monthTotals.totalEvents === 1 ? 'entry' : 'entries'}
              {notedDatesInMonth.length > 0 && (
                <>
                  {' '}
                  · {notedDatesInMonth.length}{' '}
                  {notedDatesInMonth.length === 1 ? 'note' : 'notes'}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="dashboard-calendar-prev-btn"
            aria-label="Previous month"
            title="Previous month"
            onClick={() => setDisplayedMonth((m) => shiftCalendarMonth(m, -1))}
            className="px-2 py-1.5 rounded-full text-xs font-bold flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <input
            type="month"
            aria-label="Select calendar month"
            data-testid="dashboard-calendar-month-input"
            value={displayedMonth}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                setDisplayedMonth(e.target.value);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-white text-slate-900 border border-slate-300 font-mono font-bold text-xs focus:outline-none"
          />

          <button
            type="button"
            data-testid="dashboard-calendar-next-btn"
            aria-label="Next month"
            title="Next month"
            onClick={() => setDisplayedMonth((m) => shiftCalendarMonth(m, 1))}
            className="px-2 py-1.5 rounded-full text-xs font-bold flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="dashboard-calendar-today-btn"
            onClick={handleJumpToday}
            className="px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer whitespace-nowrap"
          >
            Today
          </button>
        </div>
      </div>

      {/* Main Split: 7-col Calendar Grid + 5-col Selected Day Activity Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left: Monthly Calendar Grid */}
        <div className="lg:col-span-7 p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 bg-white">
          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pb-1 border-b border-slate-100">
            <span className="font-bold text-slate-800 font-mono">
              {formatCalendarMonthHeading(displayedMonth)}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-600 inline-block" /> Purchase
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" /> Export
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" /> Payment
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Expense
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" /> Due
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-amber-300 border border-amber-600 inline-block" /> Note
              </span>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {WEEKDAY_LABELS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Day Tiles Grid */}
          <div
            role="grid"
            aria-label={`Calendar dates for ${formatCalendarMonthHeading(displayedMonth)}`}
            data-testid="dashboard-calendar-grid"
            className="grid grid-cols-7 gap-1 sm:gap-1.5"
          >
            {calendarCells.map((cell) => {
              const dayInfo = activityMap.get(cell.dateIso);
              const dayNote = notesMap[cell.dateIso];
              const hasNote = Boolean(dayNote && hasNoteContent(dayNote.content));
              const isToday = cell.dateIso === todayIso;
              const isSelected = cell.dateIso === selectedDate;
              const count = dayInfo?.totalActivityCount || 0;

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  data-testid={`calendar-day-${cell.dateIso}`}
                  aria-label={`${formatCalendarSelectedDateHeading(cell.dateIso)}${
                    count > 0 ? `, ${count} entries` : ''
                  }${hasNote ? ', has note' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectCell(cell.dateIso, cell.inCurrentMonth)}
                  className={`min-h-[46px] sm:min-h-[64px] p-1 sm:p-1.5 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#1D6CE0] text-white border-[#1558BD] shadow-xs ring-2 ring-[#1D6CE0]/25'
                      : isToday
                      ? 'bg-sky-50 text-slate-900 border-sky-400 ring-1 ring-sky-300 hover:bg-sky-100/70'
                      : cell.inCurrentMonth
                      ? 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      : 'bg-slate-50/70 text-slate-400 border-slate-100 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`text-xs font-mono font-bold tabular-nums leading-none ${
                        isSelected
                          ? 'text-white'
                          : isToday
                          ? 'text-[#1D6CE0]'
                          : cell.inCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {count > 0 && (
                      <span
                        className={`text-[10px] font-mono font-bold px-1 rounded leading-tight ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Activity Dots Row */}
                  <div className="flex flex-wrap items-center gap-1 min-h-[10px]">
                    {dayInfo && dayInfo.purchasesCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-sky-200' : 'bg-sky-600'
                        }`}
                        title={`${dayInfo.purchasesCount} Purchase(s)`}
                      />
                    )}
                    {dayInfo && dayInfo.packingsCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-emerald-200' : 'bg-teal-600'
                        }`}
                        title={`${dayInfo.packingsCount} Packing(s)`}
                      />
                    )}
                    {dayInfo && dayInfo.paymentsCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-indigo-200' : 'bg-indigo-600'
                        }`}
                        title={`${dayInfo.paymentsCount} Payment(s)`}
                      />
                    )}
                    {dayInfo && dayInfo.expensesCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-amber-300' : 'bg-amber-500'
                        }`}
                        title={`${dayInfo.expensesCount} Daily Expense(s)`}
                      />
                    )}
                    {dayInfo && dayInfo.upcomingDueCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-rose-200' : 'bg-rose-600'
                        }`}
                        title={`${dayInfo.upcomingDueCount} Upcoming Due`}
                      />
                    )}
                    {dayInfo && dayInfo.mortalitiesCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-purple-200' : 'bg-purple-600'
                        }`}
                        title={`${dayInfo.mortalitiesCount} Mortality Log(s)`}
                      />
                    )}
                    {hasNote && dayNote && (
                      <span
                        data-testid={`calendar-day-note-indicator-${cell.dateIso}`}
                        title={`Note: ${formatNotePreview(dayNote.content)}`}
                        className={`inline-flex items-center px-1 py-px rounded-[3px] text-[9px] font-bold leading-none border ${
                          isSelected
                            ? 'bg-amber-300 text-slate-950 border-amber-200'
                            : 'bg-amber-100 text-amber-900 border-amber-400'
                        }`}
                      >
                        Note
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Month Financial Strip Footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px]">
            <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5">
              <div className="text-slate-500">Month Purchases</div>
              <div
                data-testid="calendar-month-purchases-total"
                className="font-mono font-bold text-slate-900 tabular-nums truncate"
              >
                {formatCurrency(monthTotals.purchasesTotal, currency)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5">
              <div className="text-slate-500">Month Exports</div>
              <div
                data-testid="calendar-month-exports-total"
                className="font-mono font-bold text-teal-800 tabular-nums truncate"
              >
                {formatCurrency(monthTotals.packingsTotalBDT, currency)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5">
              <div className="text-slate-500">Month Payments</div>
              <div
                data-testid="calendar-month-payments-total"
                className="font-mono font-bold text-indigo-800 tabular-nums truncate"
              >
                {formatCurrency(monthTotals.paymentsTotal, currency)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5">
              <div className="text-slate-500">Daily Expenses</div>
              <div
                data-testid="calendar-month-expenses-total"
                className="font-mono font-bold text-rose-700 tabular-nums truncate"
              >
                {formatCurrency(monthTotals.expensesTotal, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Selected Day Ledger & Quick Entry */}
        <div className="lg:col-span-5 p-3 sm:p-4 bg-slate-50/40 flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Selected Date Activity
                </div>
                <h3
                  data-testid="calendar-selected-date-heading"
                  className="text-sm font-black text-slate-900 mt-0.5"
                >
                  {formatCalendarSelectedDateHeading(selectedDate)}
                </h3>
              </div>
              <span
                data-testid="calendar-selected-date-count"
                className="px-2 py-0.5 rounded bg-[#273E56] text-white text-[11px] font-mono font-bold"
              >
                {selectedDay.totalActivityCount}{' '}
                {selectedDay.totalActivityCount === 1 ? 'Event' : 'Events'}
              </span>
            </div>

            {/* Day Totals Micro-Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Purchases ({selectedDay.purchasesCount})</span>
                  <ShoppingCart className="w-3.5 h-3.5 text-sky-600" />
                </div>
                <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                  {formatCurrency(selectedDay.purchasesTotal, currency)}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Exports ({selectedDay.packingsCount})</span>
                  <Package className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <div className="font-mono font-bold text-teal-800 tabular-nums mt-0.5">
                  {formatCurrency(selectedDay.packingsTotalBDT, currency)}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Payments ({selectedDay.paymentsCount})</span>
                  <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="font-mono font-bold text-indigo-800 tabular-nums mt-0.5">
                  {formatCurrency(selectedDay.paymentsTotal, currency)}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Daily Expense ({selectedDay.expensesCount})</span>
                  <ReceiptText className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="font-mono font-bold text-rose-700 tabular-nums mt-0.5">
                  {formatCurrency(selectedDay.expensesTotal, currency)}
                </div>
              </div>
            </div>

            {/* Selected Day Event List */}
            <div
              data-testid="calendar-selected-day-events"
              className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-56 overflow-y-auto"
            >
              {selectedDay.items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No vouchers, manifests, or expenses logged for this date.
                </div>
              ) : (
                selectedDay.items.map((item) => {
                  const style = KIND_BADGE_MAP[item.kind];
                  return (
                    <div
                      key={item.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.badgeClass}`}
                          >
                            {style.label}
                          </span>
                          <span className="font-semibold text-slate-900 truncate">
                            {item.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                        {item.amountLabel ?? formatCurrency(item.amount, currency)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Date-Wise Notepad */}
            <div
              data-testid="calendar-date-notepad"
              className="rounded-lg border border-amber-200/90 bg-amber-50/45 overflow-hidden"
            >
              <div className="px-3 py-2 bg-amber-100/60 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <StickyNote className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold text-slate-900">Date Notepad</span>
                  <span
                    data-testid="calendar-notepad-status"
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      isDraftDirty
                        ? 'bg-amber-200/80 text-amber-900'
                        : savedSelectedNote
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-white/80 text-slate-500'
                    }`}
                  >
                    {isDraftDirty
                      ? 'Saving...'
                      : justSavedFlag
                      ? 'Saved'
                      : savedSelectedNote
                      ? `Saved · ${formatNoteUpdatedTime(savedSelectedNote.updatedAt)}`
                      : 'Empty'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid="calendar-notepad-open-modal-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      commitNoteForDate(selectedDate, draftNote, false);
                      setModalDateIso(selectedDate);
                    }}
                    aria-label={`Open note modal for ${formatCalendarSelectedDateHeading(selectedDate)}`}
                    title="Open full note editor"
                    className="!px-2 !py-1 text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Maximize2 className="w-3 h-3" aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    data-testid="calendar-notepad-save-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitNoteForDate(selectedDate, draftNote, true)}
                    className="!px-2.5 !py-1 text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    {justSavedFlag ? (
                      <Check className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <Save className="w-3 h-3" aria-hidden="true" />
                    )}
                    <span>{justSavedFlag ? 'Saved' : 'Save Note'}</span>
                  </button>
                  {(hasNoteContent(draftNote) || Boolean(savedSelectedNote)) && (
                    <button
                      type="button"
                      data-testid="calendar-notepad-clear-btn"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClearSelectedNote}
                      aria-label={`Clear note for ${formatCalendarSelectedDateHeading(selectedDate)}`}
                      className="!px-2.5 !py-1 text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-2.5 space-y-2">
                <textarea
                  data-testid="calendar-notepad-textarea"
                  aria-label={`Date notepad for ${formatCalendarSelectedDateHeading(selectedDate)}`}
                  rows={4}
                  value={draftNote}
                  onChange={(e) => {
                    setDraftNote(e.target.value);
                    if (justSavedFlag) setJustSavedFlag(false);
                  }}
                  onBlur={() => commitNoteForDate(selectedDate, draftNote, false)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                      e.preventDefault();
                      commitNoteForDate(selectedDate, draftNote, true);
                    }
                  }}
                  placeholder="Write whatever is on your mind for this date — reminders, supplier follow-ups, flight plans, or daily notes..."
                  className="w-full rounded-md border border-amber-200/90 bg-white/95 focus:bg-white px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400/70 focus:border-amber-400 resize-y min-h-[88px] max-h-48"
                />

                {notedDatesInMonth.length > 0 && (
                  <div
                    data-testid="calendar-noted-dates-strip"
                    className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-200/70"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-900/80">
                      Noted dates:
                    </span>
                    {notedDatesInMonth.map((dateIso) => {
                      const isActive = dateIso === selectedDate;
                      return (
                        <button
                          key={dateIso}
                          type="button"
                          data-testid={`calendar-day-note-jump-${dateIso}`}
                          title={formatNotePreview(notesMap[dateIso]?.content || '')}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => switchSelectedDate(dateIso, false)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition cursor-pointer ${
                            isActive
                              ? 'bg-[#1D6CE0] text-white border-[#1558BD]'
                              : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                          }`}
                        >
                          {formatShortCalendarNoteChip(dateIso)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Sheet Actions */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="calendar-quick-purchase-btn"
              onClick={() => onNavigateTab('purchase_form')}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Purchase</span>
            </button>
            <button
              type="button"
              data-testid="calendar-quick-packing-btn"
              onClick={() => onNavigateTab('packing_form')}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Packing</span>
            </button>
            <button
              type="button"
              data-testid="calendar-quick-payment-btn"
              onClick={() => onNavigateTab('payment_form')}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Payment</span>
            </button>
            <button
              type="button"
              data-testid="calendar-quick-expense-btn"
              onClick={() => onNavigateTab('daily_expense')}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Daily Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Date Note Modal */}
      <CalendarNoteModal
        isOpen={Boolean(modalDateIso)}
        dateIso={modalDateIso}
        existingNote={modalDateIso ? getNote(modalDateIso) : undefined}
        dayEventsCount={
          modalDateIso ? activityMap.get(modalDateIso)?.totalActivityCount ?? 0 : 0
        }
        onSave={handleModalSaveNote}
        onDelete={handleModalDeleteNote}
        onClose={() => setModalDateIso(null)}
      />
    </section>
  );
};
