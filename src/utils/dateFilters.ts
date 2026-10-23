/**
 * Utilities for date range filtering and presets
 */

export interface DateRangeState {
  startDate: string; // YYYY-MM-DD or empty
  endDate: string;   // YYYY-MM-DD or empty
}

export type DatePresetKey =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'this_year';

/**
 * Checks if a given ISO date string (YYYY-MM-DD...) falls within the [startDate, endDate] window inclusive.
 */
export function isDateInRange(
  dateStr: string | null | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (!dateStr) return false;
  const target = dateStr.slice(0, 10);
  if (startDate && target < startDate) {
    return false;
  }
  if (endDate && target > endDate) {
    return false;
  }
  return true;
}

/**
 * Helper to format a Date into YYYY-MM-DD
 */
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns startDate and endDate strings for a given preset
 */
export function getDateRangePreset(
  preset: DatePresetKey,
  referenceDate: Date = new Date()
): DateRangeState {
  const todayStr = toISODateString(referenceDate);

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'this_week': {
      // Start of current week (Monday)
      const d = new Date(referenceDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      d.setDate(diff);
      return { startDate: toISODateString(d), endDate: todayStr };
    }

    case 'this_month': {
      const year = referenceDate.getFullYear();
      const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
      return {
        startDate: `${year}-${month}-01`,
        endDate: todayStr,
      };
    }

    case 'last_30_days': {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 30);
      return {
        startDate: toISODateString(d),
        endDate: todayStr,
      };
    }

    case 'this_year': {
      const year = referenceDate.getFullYear();
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }

    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
}
