import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGlobalKeyboardShortcut,
  isEditableElement,
  getWorkbookTabByNumber,
  getAdjacentWorkbookTab,
  filterShortcutsCatalog,
  GLOBAL_SHORTCUT_DEFINITIONS,
} from '../keyboardShortcuts';

test('resolveGlobalKeyboardShortcut resolves Ctrl+S and Cmd+S even in editable inputs', () => {
  const ctrlS = resolveGlobalKeyboardShortcut({
    key: 's',
    ctrlKey: true,
    isEditableTarget: true,
  });
  assert.ok(ctrlS);
  assert.equal(ctrlS.action, 'SAVE_ACTIVE_VIEW');
  assert.equal(ctrlS.preventDefault, true);
  assert.equal(ctrlS.shortcutLabel, 'Ctrl+S');

  const cmdS = resolveGlobalKeyboardShortcut({
    key: 'S',
    metaKey: true,
    isEditableTarget: false,
  });
  assert.ok(cmdS);
  assert.equal(cmdS.action, 'SAVE_ACTIVE_VIEW');
  assert.equal(cmdS.preventDefault, true);
});

test('resolveGlobalKeyboardShortcut resolves Ctrl+Shift+S to OPEN_SNAPSHOT_MODAL', () => {
  const snap = resolveGlobalKeyboardShortcut({
    key: 'S',
    ctrlKey: true,
    shiftKey: true,
  });
  assert.ok(snap);
  assert.equal(snap.action, 'OPEN_SNAPSHOT_MODAL');
  assert.equal(snap.preventDefault, true);
});

test('resolveGlobalKeyboardShortcut resolves Ctrl+P and Cmd+P to PRINT_ACTIVE_VIEW', () => {
  const ctrlP = resolveGlobalKeyboardShortcut({
    key: 'p',
    ctrlKey: true,
    isEditableTarget: true,
  });
  assert.ok(ctrlP);
  assert.equal(ctrlP.action, 'PRINT_ACTIVE_VIEW');
  assert.equal(ctrlP.preventDefault, true);
  assert.equal(ctrlP.shortcutLabel, 'Ctrl+P');
});

test('resolveGlobalKeyboardShortcut resolves Ctrl+E to OPEN_EXCEL_MODAL', () => {
  const ctrlE = resolveGlobalKeyboardShortcut({
    key: 'e',
    ctrlKey: true,
  });
  assert.ok(ctrlE);
  assert.equal(ctrlE.action, 'OPEN_EXCEL_MODAL');
  assert.equal(ctrlE.preventDefault, true);
});

test('resolveGlobalKeyboardShortcut resolves Ctrl+/, Ctrl+K, and non-editable ? to OPEN_SHORTCUTS_MODAL', () => {
  const ctrlSlash = resolveGlobalKeyboardShortcut({
    key: '/',
    ctrlKey: true,
    isEditableTarget: true,
  });
  assert.ok(ctrlSlash);
  assert.equal(ctrlSlash.action, 'OPEN_SHORTCUTS_MODAL');

  const ctrlK = resolveGlobalKeyboardShortcut({
    key: 'k',
    ctrlKey: true,
  });
  assert.ok(ctrlK);
  assert.equal(ctrlK.action, 'OPEN_SHORTCUTS_MODAL');

  const plainQuestionOutsideInput = resolveGlobalKeyboardShortcut({
    key: '?',
    shiftKey: true,
    isEditableTarget: false,
  });
  assert.ok(plainQuestionOutsideInput);
  assert.equal(plainQuestionOutsideInput.action, 'OPEN_SHORTCUTS_MODAL');

  const plainQuestionInsideInput = resolveGlobalKeyboardShortcut({
    key: '?',
    shiftKey: true,
    isEditableTarget: true,
  });
  assert.equal(plainQuestionInsideInput, null);
});

test('resolveGlobalKeyboardShortcut resolves Alt+N and Alt+R for form actions', () => {
  const addRow = resolveGlobalKeyboardShortcut({
    key: 'n',
    altKey: true,
    isEditableTarget: true,
  });
  assert.ok(addRow);
  assert.equal(addRow.action, 'ADD_FORM_ROW');
  assert.equal(addRow.preventDefault, true);

  const resetForm = resolveGlobalKeyboardShortcut({
    key: 'r',
    altKey: true,
  });
  assert.ok(resetForm);
  assert.equal(resetForm.action, 'RESET_FORM');
});

test('resolveGlobalKeyboardShortcut resolves Alt+1..9 and Alt+0 to JUMP_TO_TAB', () => {
  const tab1 = resolveGlobalKeyboardShortcut({ key: '1', altKey: true });
  assert.ok(tab1);
  assert.equal(tab1.action, 'JUMP_TO_TAB');
  assert.equal(tab1.targetTab, 'dashboard');

  const tab2 = resolveGlobalKeyboardShortcut({ key: '2', altKey: true });
  assert.ok(tab2);
  assert.equal(tab2.targetTab, 'purchase_form');

  const tab6 = resolveGlobalKeyboardShortcut({ code: 'Digit6', key: '6', altKey: true });
  assert.ok(tab6);
  assert.equal(tab6.targetTab, 'exporter_payment_slip');

  const tab10 = resolveGlobalKeyboardShortcut({ key: '0', altKey: true });
  assert.ok(tab10);
  assert.equal(tab10.targetTab, 'payment_db');
});

test('resolveGlobalKeyboardShortcut resolves Alt+ArrowRight, Alt+ArrowLeft, and Escape', () => {
  const next = resolveGlobalKeyboardShortcut({ key: 'ArrowRight', altKey: true });
  assert.ok(next);
  assert.equal(next.action, 'NEXT_TAB');

  const prev = resolveGlobalKeyboardShortcut({ key: 'ArrowLeft', altKey: true });
  assert.ok(prev);
  assert.equal(prev.action, 'PREV_TAB');

  const esc = resolveGlobalKeyboardShortcut({ key: 'Escape' });
  assert.ok(esc);
  assert.equal(esc.action, 'CLOSE_ACTIVE_MODAL');
});

test('getAdjacentWorkbookTab cycles forward and backward across all 13 sheets', () => {
  assert.equal(getAdjacentWorkbookTab('dashboard', 'next'), 'purchase_form');
  assert.equal(getAdjacentWorkbookTab('dashboard', 'prev'), 'audit_logs');
  assert.equal(getAdjacentWorkbookTab('audit_logs', 'next'), 'dashboard');
});

test('getWorkbookTabByNumber maps 1..9 and 0 (10) accurately', () => {
  assert.equal(getWorkbookTabByNumber(1), 'dashboard');
  assert.equal(getWorkbookTabByNumber(3), 'packing_form');
  assert.equal(getWorkbookTabByNumber(0), 'payment_db');
  assert.equal(getWorkbookTabByNumber(99), null);
});

test('isEditableElement detects input, textarea, select, and contentEditable', () => {
  assert.equal(isEditableElement({ tagName: 'INPUT' }), true);
  assert.equal(isEditableElement({ tagName: 'textarea' }), true);
  assert.equal(isEditableElement({ tagName: 'SELECT' }), true);
  assert.equal(isEditableElement({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableElement({ tagName: 'BUTTON' }), false);
  assert.equal(isEditableElement(null), false);
});

test('filterShortcutsCatalog filters by search query and category', () => {
  const all = filterShortcutsCatalog('');
  assert.equal(all.length, GLOBAL_SHORTCUT_DEFINITIONS.length);

  const printMatches = filterShortcutsCatalog('Ctrl+P');
  assert.ok(printMatches.some((s) => s.action === 'PRINT_ACTIVE_VIEW'));

  const formOnly = filterShortcutsCatalog('', 'Data Entry & Forms');
  assert.ok(formOnly.length >= 2);
  assert.ok(formOnly.every((s) => s.category === 'Data Entry & Forms'));
});
