import React, { useId } from 'react';
import {
  Calendar,
  X,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';
import {
  DatePresetKey,
  DATE_PRESET_OPTIONS,
  getDateRangePreset,
  detectMatchingPreset,
  formatDateRangeLabel,
} from '../utils/dateFilters.ts';
import { isAuditIntervalInverted } from '../utils/auditLogger.ts';

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string, preset?: DatePresetKey) => void;
  activePreset?: DatePresetKey;
  onPresetChange?: (preset: DatePresetKey) => void;
  label?: string;
  className?: string;
  showPresets?: boolean;
  compact?: boolean;
  showTimeInputs?: boolean;
  startTime?: string;
  endTime?: string;
  onTimeRangeChange?: (startTime: string, endTime: string) => void;
  extraPresetControls?: React.ReactNode;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onDateRangeChange,
  activePreset,
  onPresetChange,
  label = 'Filter by Custom Time Interval',
  className = '',
  showPresets = true,
  compact = false,
  showTimeInputs = false,
  startTime = '',
  endTime = '',
  onTimeRangeChange,
  extraPresetControls,
}) => {
  const uid = useId();
  const startDateInputId = `${uid}-start-date`;
  const endDateInputId = `${uid}-end-date`;
  const startTimeInputId = `${uid}-start-time`;
  const endTimeInputId = `${uid}-end-time`;

  const currentPreset =
    activePreset || detectMatchingPreset(startDate, endDate);

  const handleSelectPreset = (presetKey: DatePresetKey) => {
    const range = getDateRangePreset(presetKey);
    if (onPresetChange) {
      onPresetChange(presetKey);
    }
    if (onTimeRangeChange) {
      onTimeRangeChange('', '');
    }
    onDateRangeChange(range.startDate, range.endDate, presetKey);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const nextPreset = detectMatchingPreset(val, endDate);
    if (onPresetChange) {
      onPresetChange(nextPreset);
    }
    onDateRangeChange(val, endDate, nextPreset);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const nextPreset = detectMatchingPreset(startDate, val);
    if (onPresetChange) {
      onPresetChange(nextPreset);
    }
    onDateRangeChange(startDate, val, nextPreset);
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onTimeRangeChange) {
      if (onPresetChange) {
        onPresetChange('custom');
      }
      onTimeRangeChange(e.target.value, endTime);
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onTimeRangeChange) {
      if (onPresetChange) {
        onPresetChange('custom');
      }
      onTimeRangeChange(startTime, e.target.value);
    }
  };

  const handleClear = () => {
    if (onPresetChange) {
      onPresetChange('all');
    }
    if (onTimeRangeChange) {
      onTimeRangeChange('', '');
    }
    onDateRangeChange('', '', 'all');
  };

  const handleSwapInvertedRange = () => {
    if (startDate && endDate && startDate > endDate) {
      const nextPreset = detectMatchingPreset(endDate, startDate);
      if (onPresetChange) {
        onPresetChange(nextPreset);
      }
      onDateRangeChange(endDate, startDate, nextPreset);
    }
    if (
      onTimeRangeChange &&
      startTime &&
      endTime &&
      startDate === endDate &&
      startTime > endTime
    ) {
      onTimeRangeChange(endTime, startTime);
    }
  };

  const isFiltered =
    Boolean(startDate) || Boolean(endDate) || Boolean(startTime) || Boolean(endTime);
  const rangeLabel = formatDateRangeLabel(startDate, endDate);
  const timeSuffix =
    showTimeInputs && (startTime || endTime)
      ? ` · ${startTime || '00:00'} – ${endTime || '23:59'}`
      : '';
  const isInverted = isAuditIntervalInverted({
    startDate,
    endDate,
    startTime: showTimeInputs ? startTime : '',
    endTime: showTimeInputs ? endTime : '',
  });

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <input
            type="date"
            data-testid="compact-start-date"
            aria-label="Start Date"
            value={startDate}
            onChange={handleStartDateChange}
            className="text-xs font-mono text-slate-800 focus:outline-none bg-transparent"
          />
          <span className="text-xs text-slate-400 font-bold">—</span>
          <input
            type="date"
            data-testid="compact-end-date"
            aria-label="End Date"
            value={endDate}
            onChange={handleEndDateChange}
            className="text-xs font-mono text-slate-800 focus:outline-none bg-transparent"
          />
          {isFiltered && (
            <button
              type="button"
              data-testid="compact-date-clear-btn"
              onClick={handleClear}
              title="Clear date filter"
              className="text-slate-400 hover:text-rose-600 transition p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="date-range-picker"
      className={`bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              {label}
            </span>
            <span
              data-testid="date-range-active-label"
              className="text-[11px] font-mono text-slate-600"
            >
              {rangeLabel}
              {timeSuffix}
            </span>
          </div>
        </div>

        {isFiltered && (
          <button
            type="button"
            data-testid="date-range-reset-btn"
            onClick={handleClear}
            className="inline-flex items-center space-x-1 text-xs font-semibold transition cursor-pointer px-2.5 py-1 rounded-md"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span>Reset Interval</span>
          </button>
        )}
      </div>

      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {DATE_PRESET_OPTIONS.map((opt) => {
            const isActive =
              currentPreset === opt.key && !startTime && !endTime;
            return (
              <button
                key={opt.key}
                type="button"
                aria-pressed={isActive}
                data-testid={`date-preset-${opt.key}`}
                onClick={() => handleSelectPreset(opt.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  isActive ? 'font-bold shadow-2xs' : ''
                }`}
              >
                {isActive && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
          {extraPresetControls}
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-2.5 pt-1 ${
          showTimeInputs ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'
        }`}
      >
        <div className="space-y-1">
          <label
            htmlFor={startDateInputId}
            className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block"
          >
            Start Date (From)
          </label>
          <input
            id={startDateInputId}
            type="date"
            aria-label="Start Date (From)"
            data-testid="date-picker-start-input"
            value={startDate}
            onChange={handleStartDateChange}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
          />
        </div>

        {showTimeInputs && onTimeRangeChange && (
          <div className="space-y-1">
            <label
              htmlFor={startTimeInputId}
              className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
              <span>Start Time</span>
            </label>
            <input
              id={startTimeInputId}
              type="time"
              aria-label="Start Time"
              data-testid="date-picker-start-time-input"
              value={startTime}
              onChange={handleStartTimeChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
            />
          </div>
        )}

        <div className="space-y-1">
          <label
            htmlFor={endDateInputId}
            className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block"
          >
            End Date (To)
          </label>
          <input
            id={endDateInputId}
            type="date"
            aria-label="End Date (To)"
            data-testid="date-picker-end-input"
            value={endDate}
            onChange={handleEndDateChange}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
          />
        </div>

        {showTimeInputs && onTimeRangeChange && (
          <div className="space-y-1">
            <label
              htmlFor={endTimeInputId}
              className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
              <span>End Time</span>
            </label>
            <input
              id={endTimeInputId}
              type="time"
              aria-label="End Time"
              data-testid="date-picker-end-time-input"
              value={endTime}
              onChange={handleEndTimeChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
            />
          </div>
        )}
      </div>

      {isInverted && (
        <div
          role="alert"
          data-testid="date-range-inverted-warning"
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Start date/time is after end date/time — swap boundaries to match events.
            </span>
          </div>
          <button
            type="button"
            data-testid="date-range-swap-btn"
            onClick={handleSwapInvertedRange}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer"
          >
            <ArrowLeftRight className="w-3 h-3 shrink-0" />
            <span>Swap Order</span>
          </button>
        </div>
      )}
    </div>
  );
};
