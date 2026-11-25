import { ActiveTab } from '../types/index.ts';

export interface PrintableSheetEntry {
  id: ActiveTab;
  num: string;
  label: string;
  shortLabel?: string;
}

export interface WorkbookSheetNavItem {
  id: ActiveTab;
  num: string;
  label: string;
  shortLabel: string;
  badge?: string | number;
}

export function buildWorkbookSheets(counts: {
  purchasesCount: number;
  packingsCount: number;
  paymentsCount: number;
  auditLogsCount: number;
  otherCostsCount?: number;
}): WorkbookSheetNavItem[] {
  return [
    {
      id: 'dashboard',
      num: '01',
      label: 'Executive Overview',
      shortLabel: 'Dashboard',
    },
    {
      id: 'purchase_form',
      num: '02',
      label: 'Purchase Challan / Bill',
      shortLabel: 'Purchase Form',
    },
    {
      id: 'packing_form',
      num: '03',
      label: 'Export Packing List',
      shortLabel: 'Packing List',
    },
    {
      id: 'exporter_payment_form',
      num: '04',
      label: 'Exporter Payment Form',
      shortLabel: 'Exporter Payment',
    },
    {
      id: 'payment_form',
      num: '05',
      label: 'Supplier Payment Form',
      shortLabel: 'Supplier Payment',
    },
    {
      id: 'air_way_bill',
      num: '06',
      label: 'FLIGHT RETURN BILL',
      shortLabel: 'Flight Return Bill',
    },
    {
      id: 'exporter_payment_slip',
      num: '07',
      label: 'PAYMENT SLIP',
      shortLabel: 'PAYMENT SLIP',
    },
    {
      id: 'profit_loss',
      num: '08',
      label: 'Loss & Profit Analysis',
      shortLabel: 'Loss & Profit',
    },
    {
      id: 'purchase_db',
      num: '09',
      label: 'Purchase Database',
      shortLabel: 'Purchase DB',
      badge: counts.purchasesCount,
    },
    {
      id: 'packing_db',
      num: '10',
      label: 'Packing List Database',
      shortLabel: 'Packing DB',
      badge: counts.packingsCount,
    },
    {
      id: 'payment_db',
      num: '11',
      label: 'Payment Vouchers DB',
      shortLabel: 'Payment DB',
      badge: counts.paymentsCount,
    },
    {
      id: 'search_reports',
      num: '12',
      label: 'Search & Audit Reports',
      shortLabel: 'Search & Reports',
    },
    {
      id: 'settings',
      num: '13',
      label: 'Settings & Config',
      shortLabel: 'Settings',
    },
    {
      id: 'audit_logs',
      num: '14',
      label: 'System Audit Logs',
      shortLabel: 'Audit Logs',
      badge: counts.auditLogsCount,
    },
    {
      id: 'administration',
      num: '15',
      label: 'Administration (Super Admin)',
      shortLabel: 'Admin Control',
    },
    {
      id: 'forget_password',
      num: '16',
      label: 'FORGET PASSWORD',
      shortLabel: 'FORGET PASSWORD',
    },
    {
      id: 'total_balance',
      num: '17',
      label: 'TOTAL BALANCE',
      shortLabel: 'TOTAL BALANCE',
    },
    {
      id: 'daily_expense',
      num: '18',
      label: 'DAILY EXPENSE',
      shortLabel: 'DAILY EXPENSE',
      badge: counts.otherCostsCount,
    },
  ];
}

export interface PrintAllSequenceState {
  isActive: boolean;
  queue: PrintableSheetEntry[];
  currentIndex: number;
  originTab: ActiveTab | null;
  isAutoPlaying: boolean;
  autoDelayMs: number;
  triggeredSheetIds: ActiveTab[];
  completedAll: boolean;
}

export interface PrintAllSequenceProgress {
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  currentSheet: PrintableSheetEntry | null;
  isFirst: boolean;
  isLast: boolean;
  triggeredCount: number;
  remainingCount: number;
  canAdvance: boolean;
  canStepBack: boolean;
}

export const DEFAULT_PRINT_ALL_AUTO_DELAY_MS = 2200;

export function createIdlePrintAllState(): PrintAllSequenceState {
  return {
    isActive: false,
    queue: [],
    currentIndex: 0,
    originTab: null,
    isAutoPlaying: false,
    autoDelayMs: DEFAULT_PRINT_ALL_AUTO_DELAY_MS,
    triggeredSheetIds: [],
    completedAll: false,
  };
}

/**
 * Resolves the ordered list of workbook sheets that are visible in the
 * current authenticated session (enforcing RBAC visibility filtering and deduplication).
 */
export function resolvePrintableActiveSheets(
  sheets: readonly PrintableSheetEntry[],
  canAccessTab: (tabId: ActiveTab) => boolean
): PrintableSheetEntry[] {
  const seen = new Set<ActiveTab>();
  const resolved: PrintableSheetEntry[] = [];

  for (const sheet of sheets) {
    if (!sheet || !sheet.id || seen.has(sheet.id)) continue;
    if (!canAccessTab(sheet.id)) continue;
    seen.add(sheet.id);
    resolved.push({
      id: sheet.id,
      num: sheet.num,
      label: sheet.label,
      shortLabel: sheet.shortLabel || sheet.label,
    });
  }

  return resolved;
}

export function startPrintAllSequence(
  sheets: readonly PrintableSheetEntry[],
  originTab: ActiveTab,
  options?: { autoPlay?: boolean; autoDelayMs?: number }
): PrintAllSequenceState {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    return createIdlePrintAllState();
  }

  const normalizedQueue = sheets.map((s) => ({
    id: s.id,
    num: s.num,
    label: s.label,
    shortLabel: s.shortLabel || s.label,
  }));

  const delay =
    typeof options?.autoDelayMs === 'number' && options.autoDelayMs >= 300
      ? options.autoDelayMs
      : DEFAULT_PRINT_ALL_AUTO_DELAY_MS;

  const isSingleSheet = normalizedQueue.length === 1;

  return {
    isActive: true,
    queue: normalizedQueue,
    currentIndex: 0,
    originTab,
    isAutoPlaying: isSingleSheet ? false : options?.autoPlay ?? true,
    autoDelayMs: delay,
    triggeredSheetIds: [],
    completedAll: false,
  };
}

export function markPrintAllStepTriggered(
  state: PrintAllSequenceState,
  index: number
): PrintAllSequenceState {
  if (!state.isActive || index < 0 || index >= state.queue.length) {
    return state;
  }

  const targetSheet = state.queue[index];
  const triggeredSheetIds = state.triggeredSheetIds.includes(targetSheet.id)
    ? state.triggeredSheetIds
    : [...state.triggeredSheetIds, targetSheet.id];

  const isLastStep = index >= state.queue.length - 1;
  const allTriggered = triggeredSheetIds.length >= state.queue.length;

  return {
    ...state,
    triggeredSheetIds,
    completedAll: state.completedAll || (isLastStep && allTriggered),
    isAutoPlaying: isLastStep ? false : state.isAutoPlaying,
  };
}

export function advancePrintAllSequence(state: PrintAllSequenceState): {
  nextState: PrintAllSequenceState;
  reachedEnd: boolean;
} {
  if (!state.isActive || state.queue.length === 0) {
    return { nextState: state, reachedEnd: true };
  }

  if (state.currentIndex >= state.queue.length - 1) {
    return {
      nextState: {
        ...state,
        isAutoPlaying: false,
        completedAll: true,
      },
      reachedEnd: true,
    };
  }

  const nextIndex = state.currentIndex + 1;
  return {
    nextState: {
      ...state,
      currentIndex: nextIndex,
      completedAll: nextIndex === state.queue.length - 1 ? state.completedAll : false,
    },
    reachedEnd: false,
  };
}

export function stepBackPrintAllSequence(
  state: PrintAllSequenceState
): PrintAllSequenceState {
  if (!state.isActive || state.currentIndex <= 0) {
    return state;
  }
  return {
    ...state,
    currentIndex: state.currentIndex - 1,
    isAutoPlaying: false,
  };
}

export function jumpPrintAllSequence(
  state: PrintAllSequenceState,
  targetIndex: number
): PrintAllSequenceState {
  if (!state.isActive || state.queue.length === 0) {
    return state;
  }
  const bounded = Math.max(0, Math.min(state.queue.length - 1, Math.trunc(targetIndex)));
  return {
    ...state,
    currentIndex: bounded,
    isAutoPlaying: false,
  };
}

export function setPrintAllAutoPlay(
  state: PrintAllSequenceState,
  autoPlay: boolean
): PrintAllSequenceState {
  if (!state.isActive || state.queue.length <= 1) {
    return { ...state, isAutoPlaying: false };
  }
  const isAtEnd = state.currentIndex >= state.queue.length - 1;
  return {
    ...state,
    isAutoPlaying: isAtEnd ? false : autoPlay,
  };
}

export function stopPrintAllSequence(
  _state?: PrintAllSequenceState
): PrintAllSequenceState {
  return createIdlePrintAllState();
}

export function getPrintAllSequenceProgress(
  state: PrintAllSequenceState
): PrintAllSequenceProgress {
  if (!state.isActive || state.queue.length === 0) {
    return {
      currentStep: 0,
      totalSteps: 0,
      percentComplete: 0,
      currentSheet: null,
      isFirst: true,
      isLast: true,
      triggeredCount: 0,
      remainingCount: 0,
      canAdvance: false,
      canStepBack: false,
    };
  }

  const totalSteps = state.queue.length;
  const boundedIdx = Math.max(0, Math.min(totalSteps - 1, state.currentIndex));
  const currentStep = boundedIdx + 1;
  const currentSheet = state.queue[boundedIdx] || null;
  const triggeredCount = state.triggeredSheetIds.length;

  return {
    currentStep,
    totalSteps,
    percentComplete: Math.round((currentStep / totalSteps) * 100),
    currentSheet,
    isFirst: boundedIdx === 0,
    isLast: boundedIdx === totalSteps - 1,
    triggeredCount,
    remainingCount: Math.max(0, totalSteps - currentStep),
    canAdvance: boundedIdx < totalSteps - 1,
    canStepBack: boundedIdx > 0,
  };
}
