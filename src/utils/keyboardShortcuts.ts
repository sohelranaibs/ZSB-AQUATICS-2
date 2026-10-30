import { ActiveTab } from '../types/index.ts';

export type ShortcutActionId =
  | 'SAVE_ACTIVE_VIEW'
  | 'PRINT_ACTIVE_VIEW'
  | 'ADD_FORM_ROW'
  | 'RESET_FORM'
  | 'OPEN_EXCEL_MODAL'
  | 'OPEN_SNAPSHOT_MODAL'
  | 'OPEN_SHORTCUTS_MODAL'
  | 'CLOSE_ACTIVE_MODAL'
  | 'NEXT_TAB'
  | 'PREV_TAB'
  | 'JUMP_TO_TAB';

export type ShortcutCategory =
  | 'File, Save & Print'
  | 'Data Entry & Forms'
  | 'Sheet Navigation'
  | 'System Modals & Tools';

export interface ShortcutDefinition {
  id: string;
  action: ShortcutActionId;
  category: ShortcutCategory;
  keys: string[];
  label: string;
  description: string;
  targetTab?: ActiveTab;
}

export interface KeyboardEventInput {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isEditableTarget?: boolean;
}

export interface ResolvedShortcut {
  action: ShortcutActionId;
  targetTab?: ActiveTab;
  preventDefault: boolean;
  description: string;
  shortcutLabel: string;
}

export const ORDERED_WORKBOOK_TABS: { id: ActiveTab; label: string; number: number }[] = [
  { id: 'dashboard', label: 'Dashboard', number: 1 },
  { id: 'purchase_form', label: 'Purchase Challan / Bill', number: 2 },
  { id: 'packing_form', label: 'Packing List Form', number: 3 },
  { id: 'payment_form', label: 'Supplier Payment Form', number: 4 },
  { id: 'exporter_payment_form', label: 'Exporter Payment Form', number: 5 },
  { id: 'exporter_payment_slip', label: 'Exporter Payment Slip', number: 6 },
  { id: 'profit_loss', label: 'Loss & Profit Analysis', number: 7 },
  { id: 'purchase_db', label: 'Purchase DB', number: 8 },
  { id: 'packing_db', label: 'Packing DB', number: 9 },
  { id: 'payment_db', label: 'Payment DB', number: 10 },
  { id: 'search_reports', label: 'Search & Reports', number: 11 },
  { id: 'settings', label: 'Settings & Config', number: 12 },
  { id: 'audit_logs', label: 'Audit Logs', number: 13 },
  { id: 'air_way_bill', label: 'FLIGHT RETURN BILL', number: 14 },
  { id: 'administration', label: 'Administration', number: 15 },
];

export const GLOBAL_SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'save-active-view',
    action: 'SAVE_ACTIVE_VIEW',
    category: 'File, Save & Print',
    keys: ['Ctrl', 'S'],
    label: 'Save Active Form / Sync Ledger',
    description:
      'Saves the current voucher/manifest in data-entry forms, or syncs & snapshots all ledgers on database/report views.',
  },
  {
    id: 'print-active-view',
    action: 'PRINT_ACTIVE_VIEW',
    category: 'File, Save & Print',
    keys: ['Ctrl', 'P'],
    label: 'Print / PDF Preview',
    description:
      'Opens the official print & PDF download preview for the active voucher, payment slip, or table report.',
  },
  {
    id: 'open-snapshot-modal',
    action: 'OPEN_SNAPSHOT_MODAL',
    category: 'File, Save & Print',
    keys: ['Ctrl', 'Shift', 'S'],
    label: 'Database Snapshot Manager',
    description: 'Opens the local JSON database snapshot and state recovery manager.',
  },
  {
    id: 'open-excel-modal',
    action: 'OPEN_EXCEL_MODAL',
    category: 'File, Save & Print',
    keys: ['Ctrl', 'E'],
    label: 'Excel (.xlsx) & CSV Data Center',
    description: 'Opens the bulk Excel & CSV import/export center for the active sheet dataset.',
  },
  {
    id: 'add-form-row',
    action: 'ADD_FORM_ROW',
    category: 'Data Entry & Forms',
    keys: ['Alt', 'N'],
    label: 'Add New Line Item Row',
    description:
      'Appends a new blank line item row in Purchase Challan, Packing List, Supplier Payment, or Exporter Payment forms.',
  },
  {
    id: 'reset-form',
    action: 'RESET_FORM',
    category: 'Data Entry & Forms',
    keys: ['Alt', 'R'],
    label: 'Clear / Reset Active Form',
    description: 'Resets fillable cells or lookup filters on the active data-entry form.',
  },
  {
    id: 'prev-tab',
    action: 'PREV_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '←'],
    label: 'Previous Workbook Sheet',
    description: 'Cycles to the previous workbook tab in the ribbon.',
  },
  {
    id: 'next-tab',
    action: 'NEXT_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '→'],
    label: 'Next Workbook Sheet',
    description: 'Cycles to the next workbook tab in the ribbon.',
  },
  {
    id: 'jump-tab-1',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '1'],
    label: 'Go to Sheet 1: Dashboard',
    description: 'Switches immediately to the executive Dashboard overview.',
    targetTab: 'dashboard',
  },
  {
    id: 'jump-tab-2',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '2'],
    label: 'Go to Sheet 2: Purchase Challan / Bill',
    description: 'Switches immediately to the Purchase Challan / Bill entry form.',
    targetTab: 'purchase_form',
  },
  {
    id: 'jump-tab-3',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '3'],
    label: 'Go to Sheet 3: Packing List Form',
    description: 'Switches immediately to the Export Packing List manifest form.',
    targetTab: 'packing_form',
  },
  {
    id: 'jump-tab-4',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '4'],
    label: 'Go to Sheet 4: Supplier Payment Form',
    description: 'Switches immediately to the Supplier Payment voucher form.',
    targetTab: 'payment_form',
  },
  {
    id: 'jump-tab-5',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '5'],
    label: 'Go to Sheet 5: Exporter Payment Form',
    description: 'Switches immediately to the Exporter Payment form.',
    targetTab: 'exporter_payment_form',
  },
  {
    id: 'jump-tab-6',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '6'],
    label: 'Go to Sheet 6: Exporter Payment Slip',
    description: 'Switches immediately to the Bilingual Exporter Payment Slip (付款单).',
    targetTab: 'exporter_payment_slip',
  },
  {
    id: 'jump-tab-7',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '7'],
    label: 'Go to Sheet 7: Loss & Profit Analysis',
    description: 'Switches immediately to the Loss & Profit Analysis sheet.',
    targetTab: 'profit_loss',
  },
  {
    id: 'jump-tab-8',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '8'],
    label: 'Go to Sheet 8: Purchase DB',
    description: 'Switches immediately to the Purchase Database ledger.',
    targetTab: 'purchase_db',
  },
  {
    id: 'jump-tab-9',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '9'],
    label: 'Go to Sheet 9: Packing DB',
    description: 'Switches immediately to the Packing Database ledger.',
    targetTab: 'packing_db',
  },
  {
    id: 'jump-tab-10',
    action: 'JUMP_TO_TAB',
    category: 'Sheet Navigation',
    keys: ['Alt', '0'],
    label: 'Go to Sheet 10: Payment DB',
    description: 'Switches immediately to the Payment Database ledger.',
    targetTab: 'payment_db',
  },
  {
    id: 'open-shortcuts-modal',
    action: 'OPEN_SHORTCUTS_MODAL',
    category: 'System Modals & Tools',
    keys: ['Ctrl', '/'],
    label: 'Keyboard Shortcuts Reference',
    description: 'Opens or toggles this global keyboard shortcuts command palette.',
  },
  {
    id: 'close-active-modal',
    action: 'CLOSE_ACTIVE_MODAL',
    category: 'System Modals & Tools',
    keys: ['Esc'],
    label: 'Close Active Modal / Preview',
    description: 'Closes any open print preview, data center, snapshot, or shortcuts modal.',
  },
];

export function isEditableElement(
  target: { tagName?: string; isContentEditable?: boolean } | null | undefined
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function getWorkbookTabByNumber(num: number): ActiveTab | null {
  const effectiveNumber = num === 0 ? 10 : num;
  const found = ORDERED_WORKBOOK_TABS.find((t) => t.number === effectiveNumber);
  return found ? found.id : null;
}

export function getAdjacentWorkbookTab(
  currentTab: ActiveTab,
  direction: 'next' | 'prev'
): ActiveTab {
  const idx = ORDERED_WORKBOOK_TABS.findIndex((t) => t.id === currentTab);
  if (idx === -1) return 'dashboard';
  const total = ORDERED_WORKBOOK_TABS.length;
  const nextIdx =
    direction === 'next' ? (idx + 1) % total : (idx - 1 + total) % total;
  return ORDERED_WORKBOOK_TABS[nextIdx].id;
}

export function filterShortcutsCatalog(
  query: string,
  categoryFilter: ShortcutCategory | 'ALL' = 'ALL'
): ShortcutDefinition[] {
  const cleanQuery = (query || '').trim().toLowerCase();
  return GLOBAL_SHORTCUT_DEFINITIONS.filter((item) => {
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
      return false;
    }
    if (!cleanQuery) return true;
    const keysJoined = item.keys.join('+').toLowerCase();
    return (
      item.label.toLowerCase().includes(cleanQuery) ||
      item.description.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery) ||
      keysJoined.includes(cleanQuery)
    );
  });
}

export function resolveGlobalKeyboardShortcut(
  event: KeyboardEventInput
): ResolvedShortcut | null {
  if (!event || event.repeat) return null;

  const key = event.key || '';
  const lowerKey = key.toLowerCase();
  const code = event.code || '';
  const hasPrimaryMod = Boolean(event.ctrlKey || event.metaKey);
  const hasAlt = Boolean(event.altKey);
  const hasShift = Boolean(event.shiftKey);
  const isEditable = Boolean(event.isEditableTarget);

  // 1. Escape closes active modals regardless of focus
  if (key === 'Escape' && !hasPrimaryMod && !hasAlt && !hasShift) {
    return {
      action: 'CLOSE_ACTIVE_MODAL',
      preventDefault: false,
      description: 'Close active modal dialog',
      shortcutLabel: 'Esc',
    };
  }

  // 2. Ctrl/Cmd + Shift + S -> Open Database Snapshot Modal
  if (hasPrimaryMod && hasShift && !hasAlt && (lowerKey === 's' || code === 'KeyS')) {
    return {
      action: 'OPEN_SNAPSHOT_MODAL',
      preventDefault: true,
      description: 'Open Database Snapshot Manager',
      shortcutLabel: 'Ctrl+Shift+S',
    };
  }

  // 3. Ctrl/Cmd + S -> Save active form or sync ledger
  if (hasPrimaryMod && !hasShift && !hasAlt && (lowerKey === 's' || code === 'KeyS')) {
    return {
      action: 'SAVE_ACTIVE_VIEW',
      preventDefault: true,
      description: 'Save active form or sync database',
      shortcutLabel: 'Ctrl+S',
    };
  }

  // 4. Ctrl/Cmd + P -> Print / PDF preview for active view
  if (hasPrimaryMod && !hasShift && !hasAlt && (lowerKey === 'p' || code === 'KeyP')) {
    return {
      action: 'PRINT_ACTIVE_VIEW',
      preventDefault: true,
      description: 'Open Print / PDF Preview',
      shortcutLabel: 'Ctrl+P',
    };
  }

  // 5. Ctrl/Cmd + E -> Open Excel / CSV Data Center
  if (hasPrimaryMod && !hasShift && !hasAlt && (lowerKey === 'e' || code === 'KeyE')) {
    return {
      action: 'OPEN_EXCEL_MODAL',
      preventDefault: true,
      description: 'Open Excel / CSV Import & Export Data Center',
      shortcutLabel: 'Ctrl+E',
    };
  }

  // 6. Ctrl/Cmd + / or Ctrl/Cmd + K -> Toggle Keyboard Shortcuts Reference Modal
  if (
    hasPrimaryMod &&
    !hasAlt &&
    (key === '/' || key === '?' || code === 'Slash' || (!hasShift && (lowerKey === 'k' || code === 'KeyK')))
  ) {
    return {
      action: 'OPEN_SHORTCUTS_MODAL',
      preventDefault: true,
      description: 'Open Keyboard Shortcuts Reference',
      shortcutLabel: lowerKey === 'k' ? 'Ctrl+K' : 'Ctrl+/',
    };
  }

  // 7. Plain '?' when NOT focused inside an input/textarea/select
  if (!hasPrimaryMod && !hasAlt && key === '?' && !isEditable) {
    return {
      action: 'OPEN_SHORTCUTS_MODAL',
      preventDefault: true,
      description: 'Open Keyboard Shortcuts Reference',
      shortcutLabel: '?',
    };
  }

  // 8. Alt + N -> Add a new row in active data-entry form
  if (hasAlt && !hasPrimaryMod && !hasShift && (lowerKey === 'n' || code === 'KeyN')) {
    return {
      action: 'ADD_FORM_ROW',
      preventDefault: true,
      description: 'Add new line item row',
      shortcutLabel: 'Alt+N',
    };
  }

  // 9. Alt + R -> Reset / Clear active form
  if (hasAlt && !hasPrimaryMod && !hasShift && (lowerKey === 'r' || code === 'KeyR')) {
    return {
      action: 'RESET_FORM',
      preventDefault: true,
      description: 'Reset active form fields',
      shortcutLabel: 'Alt+R',
    };
  }

  // 10. Alt + ArrowRight / Alt + ArrowLeft -> Cycle sheets
  if (hasAlt && !hasPrimaryMod && !hasShift && key === 'ArrowRight') {
    return {
      action: 'NEXT_TAB',
      preventDefault: true,
      description: 'Switch to next workbook sheet',
      shortcutLabel: 'Alt+→',
    };
  }

  if (hasAlt && !hasPrimaryMod && !hasShift && key === 'ArrowLeft') {
    return {
      action: 'PREV_TAB',
      preventDefault: true,
      description: 'Switch to previous workbook sheet',
      shortcutLabel: 'Alt+←',
    };
  }

  // 11. Alt + 1..9, 0 -> Direct jump to sheet 1..10
  if (hasAlt && !hasPrimaryMod && !hasShift) {
    let digit: number | null = null;
    if (/^[0-9]$/.test(key)) {
      digit = Number(key);
    } else if (/^Digit[0-9]$/.test(code)) {
      digit = Number(code.replace('Digit', ''));
    }

    if (digit !== null) {
      const targetTab = getWorkbookTabByNumber(digit);
      if (targetTab) {
        return {
          action: 'JUMP_TO_TAB',
          targetTab,
          preventDefault: true,
          description: `Jump to sheet #${digit === 0 ? 10 : digit}`,
          shortcutLabel: `Alt+${digit}`,
        };
      }
    }
  }

  return null;
}

export const ZSB_VIEW_SHORTCUT_EVENT = 'zsb:view-shortcut-action';

export interface ViewShortcutEventDetail {
  action: 'SAVE_ACTIVE_VIEW' | 'PRINT_ACTIVE_VIEW' | 'ADD_FORM_ROW' | 'RESET_FORM';
  handled: boolean;
}

export function dispatchViewShortcutAction(
  action: ViewShortcutEventDetail['action']
): boolean {
  if (typeof window === 'undefined') return false;
  const detail: ViewShortcutEventDetail = { action, handled: false };
  const customEvent = new CustomEvent<ViewShortcutEventDetail>(
    ZSB_VIEW_SHORTCUT_EVENT,
    { detail }
  );
  window.dispatchEvent(customEvent);
  return detail.handled;
}
