import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import {
  BANGLA_MONTHS,
  BANGLA_WEEKDAYS,
  BanglaCalendarDay,
  buildBanglaMonthCalendar,
  gregorianIsoToBanglaYearMonth,
  shiftBanglaMonth,
  toBanglaDigits,
} from '../utils/banglaCalendar.ts';

/** Crisp inline SVG Mangal Kalash (auspicious Bengali Panjika pot with mango leaves & coconut) */
const MangalKalashIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    {/* Mango leaves */}
    <path d="M12 9 C9 6, 5 6, 4 9 C6.5 9.5, 9 9.5, 11 10.5 Z" fill="#2e7d32" />
    <path d="M12 9 C15 6, 19 6, 20 9 C17.5 9.5, 15 9.5, 13 10.5 Z" fill="#2e7d32" />
    <path d="M12 8 C10 4.5, 8 3.5, 7 5 C8 6.5, 9.5 7.5, 11 9 Z" fill="#43a047" />
    <path d="M12 8 C14 4.5, 16 3.5, 17 5 C16 6.5, 14.5 7.5, 13 9 Z" fill="#43a047" />
    {/* Coconut */}
    <ellipse cx="12" cy="7.5" rx="2.8" ry="3.2" fill="#8d5524" stroke="#5d3a1a" strokeWidth="0.6" />
    {/* Kalash pot neck */}
    <rect x="8.5" y="10" width="7" height="2" rx="0.8" fill="#d97706" stroke="#92400e" strokeWidth="0.6" />
    {/* Kalash pot body */}
    <path
      d="M8.5 12 C6 13.5, 5.5 17.5, 7.5 20 C9 21.5, 15 21.5, 16.5 20 C18.5 17.5, 18 13.5, 15.5 12 Z"
      fill="#ea580c"
      stroke="#7c2d12"
      strokeWidth="0.8"
    />
    {/* Auspicious Swastika / sacred dot accent */}
    <circle cx="12" cy="16.2" r="1.4" fill="#fde047" />
    <path d="M7.6 14.2 Q12 15.6 16.4 14.2" stroke="#fef08a" strokeWidth="0.8" fill="none" />
  </svg>
);

const BANGLA_YEAR_OPTIONS = [1430, 1431, 1432, 1433, 1434, 1435, 1436];

export const BanglaPanjikaCalendar: React.FC = () => {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const initialBangla = useMemo(() => gregorianIsoToBanglaYearMonth(todayIso), [todayIso]);

  const [banglaYear, setBanglaYear] = useState<number>(initialBangla.banglaYear);
  const [banglaMonthIndex, setBanglaMonthIndex] = useState<number>(initialBangla.banglaMonthIndex);
  const [selectedBanglaDay, setSelectedBanglaDay] = useState<number>(initialBangla.banglaDay);

  const calendarData = useMemo(
    () => buildBanglaMonthCalendar(banglaYear, banglaMonthIndex, todayIso),
    [banglaYear, banglaMonthIndex, todayIso]
  );

  const selectedDayObj: BanglaCalendarDay | undefined = useMemo(() => {
    return (
      calendarData.days.find((d) => d.banglaDay === selectedBanglaDay) ||
      calendarData.days.find((d) => d.isToday) ||
      calendarData.days[0]
    );
  }, [calendarData.days, selectedBanglaDay]);

  const handleShiftMonth = (delta: number) => {
    const next = shiftBanglaMonth(banglaYear, banglaMonthIndex, delta);
    setBanglaYear(next.banglaYear);
    setBanglaMonthIndex(next.banglaMonthIndex);
    setSelectedBanglaDay(1);
  };

  const handleJumpToday = () => {
    setBanglaYear(initialBangla.banglaYear);
    setBanglaMonthIndex(initialBangla.banglaMonthIndex);
    setSelectedBanglaDay(initialBangla.banglaDay);
  };

  const leadingCells = useMemo(
    () => Array.from({ length: calendarData.leadingBlanks }, (_, i) => i),
    [calendarData.leadingBlanks]
  );
  const trailingCells = useMemo(
    () => Array.from({ length: calendarData.trailingBlanks }, (_, i) => i),
    [calendarData.trailingBlanks]
  );

  // Split festivals evenly into left & right columns like the traditional Bengali Panjika sheet
  const festivalMidpoint = Math.ceil(calendarData.festivals.length / 2);
  const leftFestivals = calendarData.festivals.slice(0, festivalMidpoint);
  const rightFestivals = calendarData.festivals.slice(festivalMidpoint);

  return (
    <section
      aria-label="Bangla Panjika Calendar"
      data-testid="bangla-panjika-calendar"
      className="bg-white rounded-xl shadow-xs border border-[#CBD8E6] overflow-hidden"
      style={{ fontFamily: '"Noto Sans Bengali", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Top Interactive Navigation Strip matching Dashboard chrome */}
      <div className="bg-[#273E56] text-white px-4 sm:px-5 py-3 border-b border-[#1E3247] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#1c2a33] border border-[#00897b]/50 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-4 h-4 text-amber-400" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-wide text-white leading-tight">
              বাংলা পঞ্জিকা ক্যালেন্ডার · Bangla Calendar
            </h2>
            <p className="text-[11px] text-slate-300 truncate">
              {calendarData.banglaYearBn} {calendarData.monthMeta.bn} ({calendarData.monthMeta.enTitle}{' '}
              {calendarData.banglaYear}) · {calendarData.gregorianRangeBn}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="bangla-cal-prev-btn"
            aria-label="Previous Bangla Month"
            onClick={() => handleShiftMonth(-1)}
            className="p-1.5 rounded-lg bg-[#1c2a33] hover:bg-[#152028] text-slate-200 border border-slate-600/60 transition cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            aria-label="Select Bangla Month"
            data-testid="bangla-cal-month-select"
            value={banglaMonthIndex}
            onChange={(e) => {
              setBanglaMonthIndex(Number(e.target.value));
              setSelectedBanglaDay(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#1c2a33] text-white border border-slate-600/70 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
          >
            {BANGLA_MONTHS.map((m) => (
              <option key={m.index} value={m.index}>
                {m.bn} ({m.enTitle})
              </option>
            ))}
          </select>

          <select
            aria-label="Select Bangla Year"
            data-testid="bangla-cal-year-select"
            value={banglaYear}
            onChange={(e) => {
              setBanglaYear(Number(e.target.value));
              setSelectedBanglaDay(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#1c2a33] text-white border border-slate-600/70 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
          >
            {BANGLA_YEAR_OPTIONS.map((yr) => (
              <option key={yr} value={yr}>
                {toBanglaDigits(yr)} ({yr})
              </option>
            ))}
          </select>

          <button
            type="button"
            data-testid="bangla-cal-next-btn"
            aria-label="Next Bangla Month"
            onClick={() => handleShiftMonth(1)}
            className="p-1.5 rounded-lg bg-[#1c2a33] hover:bg-[#152028] text-slate-200 border border-slate-600/60 transition cursor-pointer shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="bangla-cal-today-btn"
            onClick={handleJumpToday}
            className="px-3 py-1.5 rounded-lg bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            আজ (Today)
          </button>
        </div>
      </div>

      {/* Authentic Pastoral Sage-Olive Bangla Panjika Sheet Canvas */}
      <div
        className="p-3 sm:p-5 space-y-4"
        style={{
          background:
            'linear-gradient(180deg, #98aa8e 0%, #86997b 14%, #a8b79d 42%, #8e9f81 74%, #9cad7c 90%, #869964 100%)',
        }}
      >
        {/* Top 3-Zone Traditional Calendar Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1 pt-0.5">
          <div
            data-testid="bangla-cal-heading-en"
            className="text-xl sm:text-2xl lg:text-[26px] font-black tracking-tight text-slate-950 uppercase leading-none"
          >
            {calendarData.banglaYear} {calendarData.monthMeta.en}
          </div>

          <div className="text-center">
            <div
              data-testid="bangla-cal-heading-greg"
              className="text-base sm:text-lg font-extrabold text-slate-950 leading-tight"
            >
              {calendarData.gregorianRangeBn}
            </div>
            <div className="w-28 h-[3px] bg-[#66785f] mx-auto mt-1 rounded-full" />
          </div>

          <div
            data-testid="bangla-cal-heading-bn"
            className="text-xl sm:text-2xl lg:text-[26px] font-black text-slate-950 leading-none sm:text-right"
          >
            {calendarData.banglaYearBn} {calendarData.monthMeta.bn}
          </div>
        </div>

        {/* Main 7-Column Calendar Table & Legend Card */}
        <div className="bg-white shadow-sm border border-[#73846c] overflow-x-auto">
          <div className="min-w-[780px]">
            {/* Weekday Header Bar */}
            <div className="grid grid-cols-7 bg-[#788871] border-b border-[#63725d] divide-x divide-white/35">
              {BANGLA_WEEKDAYS.map((wd) => (
                <div
                  key={wd.index}
                  className={`py-2.5 px-2 text-center text-sm sm:text-[15px] font-extrabold tracking-wide ${
                    wd.isSunday ? 'text-[#E11D48]' : 'text-slate-950'
                  }`}
                >
                  {wd.bn}
                </div>
              ))}
            </div>

            {/* Monthly Date Cells Grid */}
            <div
              data-testid="bangla-cal-grid"
              className="grid grid-cols-7 bg-white border-b border-slate-200"
            >
              {/* Leading Blank Days */}
              {leadingCells.map((i) => (
                <div
                  key={`lead-${i}`}
                  className="min-h-[112px] sm:min-h-[122px] border-r border-b border-slate-200/90 bg-white last:border-r-0"
                />
              ))}

              {/* Active Days of the Bengali Month */}
              {calendarData.days.map((day) => {
                const isSunday = day.weekdayIndex === 0;
                const isSelected = selectedDayObj?.banglaDay === day.banglaDay;

                return (
                  <button
                    key={day.gregorianDateIso}
                    type="button"
                    data-testid={`bangla-day-${day.banglaDay}`}
                    aria-label={`${day.banglaDayLabel} ${calendarData.monthMeta.bn} ${calendarData.banglaYearBn}, ${day.weekdayBn}, ${day.gregorianMonthBn} ${day.gregorianDayLabel}, ${day.tithiNameBn}, ${day.nakshatraBn}`}
                    onClick={() => setSelectedBanglaDay(day.banglaDay)}
                    className={`group relative min-h-[112px] sm:min-h-[122px] p-1.5 sm:p-2 border-r border-b border-slate-200/90 text-left flex flex-col justify-between transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00897b] ${
                      isSelected
                        ? 'bg-amber-50/75 ring-2 ring-inset ring-amber-500'
                        : day.isToday
                        ? 'bg-teal-50/50 ring-2 ring-inset ring-[#00897b]'
                        : 'bg-white hover:bg-slate-50/90'
                    }`}
                  >
                    {/* Top Row: Optional Mangal Kalash (Left) + Tithi & End Time (Right) */}
                    <div className="w-full flex items-start justify-between gap-1">
                      <div className="flex items-center gap-0.5 shrink-0 min-h-[18px]">
                        {day.hasKalashIcon && <MangalKalashIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
                        {day.isToday && (
                          <span className="text-[10px] font-extrabold text-[#00796b] leading-none">
                            আজ
                          </span>
                        )}
                      </div>

                      <div className="text-right leading-tight">
                        <div className="text-[11px] sm:text-[12px] font-bold text-slate-900 whitespace-nowrap tabular-nums">
                          {day.tithiNameBn}{' '}
                          <span className="font-semibold text-slate-700">
                            {day.tithiEndPeriodBn} {day.tithiEndTimeBn}
                          </span>
                        </div>
                        {day.isBankHoliday && (
                          <div className="text-[11px] font-black text-red-600 leading-none mt-0.5">
                            BH
                          </div>
                        )}
                        {day.isHijriMonthStart && (
                          <div className="text-[11px] font-extrabold text-green-700 leading-none mt-0.5">
                            {day.hijriMonthBn}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Center: Large Bengali Numeral (with Major Festival label if applicable) */}
                    <div className="relative flex flex-col items-center justify-center my-0.5 min-h-[44px]">
                      {day.centerFestivalBn ? (
                        <div className="relative w-full flex items-center justify-center">
                          <span
                            aria-hidden="true"
                            className={`text-3xl sm:text-[36px] font-extrabold leading-none opacity-20 select-none tabular-nums ${
                              isSunday ? 'text-[#E11D48]' : 'text-slate-900'
                            }`}
                          >
                            {day.banglaDayLabel}
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center text-center text-[11px] sm:text-[12px] font-extrabold text-slate-950 leading-tight px-0.5">
                            {day.centerFestivalBn}
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`text-[34px] sm:text-[40px] font-extrabold leading-none tracking-tight tabular-nums ${
                            isSunday ? 'text-[#E11D48]' : 'text-slate-950'
                          }`}
                        >
                          {day.banglaDayLabel}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Nakshatra (Left) + Gregorian Red & Hijri Green (Right) */}
                    <div className="w-full flex items-end justify-between gap-1 pt-0.5">
                      <span className="text-[11px] sm:text-[12px] font-bold text-slate-900 leading-tight truncate">
                        {day.nakshatraBn}
                      </span>

                      <div className="text-right leading-tight shrink-0 tabular-nums">
                        <div className="text-[11px] sm:text-[12px] font-extrabold text-red-600 whitespace-nowrap">
                          {day.isGregorianMonthStart
                            ? `${day.gregorianMonthBn} ${day.gregorianDayLabel}`
                            : day.gregorianDayLabel}
                        </div>
                        <div className="text-[11px] sm:text-[12px] font-extrabold text-green-700 whitespace-nowrap">
                          {day.hijriDayLabel}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Trailing Blank Days */}
              {trailingCells.map((i) => (
                <div
                  key={`trail-${i}`}
                  className="min-h-[112px] sm:min-h-[122px] border-r border-b border-slate-200/90 bg-white last:border-r-0"
                />
              ))}
            </div>

            {/* Bottom White Legend & Ekadashi Tithi Strip */}
            <div className="bg-white px-3 sm:px-4 py-3 space-y-1.5 text-xs sm:text-[13px] text-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  স - সকাল, দি - দিবা, রা - রাত্রি
                </span>
                <span className="text-[11px] text-slate-600 font-medium">
                  লাল সংখ্যা: ইংরেজি তারিখ · সবুজ (হি): হিজরি তারিখ · BH: ব্যাংক ছুটি
                </span>
              </div>

              <div data-testid="bangla-cal-ekadashi" className="pt-0.5 leading-snug">
                <div className="font-semibold text-slate-800">একাদশী তিথি</div>
                <div className="font-extrabold text-slate-950 tabular-nums">
                  {calendarData.ekadashiTithiText}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Day Quick Panjika Details Bar */}
        {selectedDayObj && (
          <div
            data-testid="bangla-cal-selected-day-bar"
            className="bg-white/95 border border-[#6e7f66] px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs text-slate-900"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#556b4d] shrink-0" />
              <span>
                {selectedDayObj.banglaDayLabel} {calendarData.monthMeta.bn} {calendarData.banglaYearBn}
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>{selectedDayObj.weekdayBn}</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-red-700">
                {selectedDayObj.gregorianDayLabel} {selectedDayObj.gregorianMonthBn}{' '}
                {toBanglaDigits(selectedDayObj.gregorianYear)} ({selectedDayObj.gregorianDateIso})
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-green-800">
                {selectedDayObj.hijriDayLabel} {selectedDayObj.hijriMonthBn}{' '}
                {toBanglaDigits(selectedDayObj.hijriYear)} হিজরি
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-slate-800">
              <span>
                তিথি: <strong>{selectedDayObj.tithiNameBn}</strong> ({selectedDayObj.tithiEndPeriodBn}{' '}
                {selectedDayObj.tithiEndTimeBn} পর্যন্ত)
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>
                নক্ষত্র: <strong>{selectedDayObj.nakshatraBn}</strong>
              </span>
              {selectedDayObj.festivals.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="text-amber-900 font-bold">
                    {selectedDayObj.festivals.join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Festivals, Observances and Holidays Section (Matching Reference Image) */}
        <div className="pt-1 space-y-2.5">
          <div className="text-center">
            <h3
              data-testid="bangla-cal-festivals-heading"
              className="text-sm sm:text-base font-extrabold text-slate-950"
            >
              Festival, Observances and Holidays in {calendarData.monthMeta.enTitle}{' '}
              {calendarData.banglaYear}
            </h3>
            <div className="w-36 h-[3px] bg-[#64765c] mx-auto mt-1 rounded-full" />
          </div>

          <div
            data-testid="bangla-cal-festivals-box"
            className="bg-[#788970]/95 border border-[#65755e] px-4 sm:px-6 py-4 text-slate-950"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 text-xs sm:text-[13.5px]">
              {/* Left Column */}
              <div className="space-y-2">
                {leftFestivals.map((fest) => (
                  <button
                    key={`${fest.gregorianDateIso}-${fest.titleBn}`}
                    type="button"
                    data-testid={`bangla-festival-${fest.banglaDay}`}
                    onClick={() => setSelectedBanglaDay(fest.banglaDay)}
                    className="w-full grid grid-cols-[140px_1fr] sm:grid-cols-[165px_1fr] items-baseline gap-3 text-left hover:bg-white/15 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-950 whitespace-nowrap tabular-nums">
                      {fest.banglaDayLabel} ({fest.gregorianMonthBn} {fest.gregorianDayLabel})
                    </span>
                    <span className="font-bold text-slate-950">{fest.titleBn}</span>
                  </button>
                ))}
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                {rightFestivals.map((fest) => (
                  <button
                    key={`${fest.gregorianDateIso}-${fest.titleBn}`}
                    type="button"
                    data-testid={`bangla-festival-${fest.banglaDay}`}
                    onClick={() => setSelectedBanglaDay(fest.banglaDay)}
                    className="w-full grid grid-cols-[140px_1fr] sm:grid-cols-[165px_1fr] items-baseline gap-3 text-left hover:bg-white/15 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-950 whitespace-nowrap tabular-nums">
                      {fest.banglaDayLabel} ({fest.gregorianMonthBn} {fest.gregorianDayLabel})
                    </span>
                    <span className="font-bold text-slate-950">{fest.titleBn}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center text-xs font-extrabold text-slate-950/85 pt-0.5">
            বাংলা পঞ্জিকা ক্যালেন্ডার · {calendarData.monthMeta.bn} {calendarData.banglaYearBn} ({calendarData.gregorianRangeBn})
          </div>
        </div>
      </div>
    </section>
  );
};
