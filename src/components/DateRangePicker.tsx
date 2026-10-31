import React from 'react';
import {
  Calendar,
  X,
  Clock,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  DatePresetKey,
  DATE_PRESET_OPTIONS,
  getDateRangePreset,
  detectMatchingPreset,
  formatDateRangeLabel,
} from '../utils/dateFilters.ts';

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
}) => {
  const currentPreset =
    activePreset || detectMatchingPreset(startDate, endDate);

  const handleSelectPreset = (presetKey: DatePresetKey) => {
    const range = getDateRangePreset(presetKey);
    if (onPresetChange) {
      onPresetChange(presetKey);
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

  const handleClear = () => {
    if (onPresetChange) {
      onPresetChange('all');
    }
    onDateRangeChange('', '', 'all');
  };

  const isFiltered = Boolean(startDate) || Boolean(endDate);
  const rangeLabel = formatDateRangeLabel(startDate, endDate);

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
            <span className="text-[11px] font-mono text-slate-500">
              {rangeLabel}
            </span>
          </div>
        </div>

        {isFiltered && (
          <button
            type="button"
            data-testid="date-range-reset-btn"
            onClick={handleClear}
            className="inline-flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-semibold transition cursor-pointer bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-md"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Interval</span>
          </button>
        )}
      </div>

      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {DATE_PRESET_OPTIONS.map((opt) => {
            const isActive = currentPreset === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                data-testid={`date-preset-${opt.key}`}
                onClick={() => handleSelectPreset(opt.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  isActive
                    ? 'bg-amber-500 text-slate-900 shadow-2xs font-bold'
                    : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {isActive && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Start Date (From)
          </label>
          <div className="relative">
            <input
              type="date"
              data-testid="date-picker-start-input"
              value={startDate}
              onChange={handleStartDateChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            End Date (To)
          </label>
          <div className="relative">
            <input
              type="date"
              data-testid="date-picker-end-input"
              value={endDate}
              onChange={handleEndDateChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
