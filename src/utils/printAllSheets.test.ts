import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advancePrintAllSequence,
  createIdlePrintAllState,
  getPrintAllSequenceProgress,
  jumpPrintAllSequence,
  markPrintAllStepTriggered,
  resolvePrintableActiveSheets,
  setPrintAllAutoPlay,
  startPrintAllSequence,
  stepBackPrintAllSequence,
  stopPrintAllSequence,
  PrintableSheetEntry,
} from './printAllSheets.ts';
import { buildWorkbookSheets } from '../components/ThemeSidebarNav.tsx';
import { canUserAccessTab } from './rbacPermissions.ts';
import { AuthUser } from '../types/index.ts';

const SAMPLE_USER_ADMIN: AuthUser = {
  username: 'admin',
  displayName: 'Super Admin',
  role: 'SUPER_ADMIN',
  email: 'admin@zsbaquatics.com',
  loginAt: '2026-10-29T00:00:00.000Z',
};

const SAMPLE_USER_DISPATCHER: AuthUser = {
  username: 'depot',
  displayName: 'Depot Dispatcher',
  role: 'Depot Dispatcher',
  email: 'depot@zsbaquatics.com',
  loginAt: '2026-10-29T00:00:00.000Z',
};

const SAMPLE_SHEETS: PrintableSheetEntry[] = [
  { id: 'dashboard', num: '01', label: 'Executive Overview', shortLabel: 'Dashboard' },
  { id: 'purchase_form', num: '02', label: 'Purchase Challan / Bill', shortLabel: 'Purchase Form' },
  { id: 'packing_form', num: '03', label: 'Export Packing List', shortLabel: 'Packing List' },
  { id: 'profit_loss', num: '08', label: 'Loss & Profit Analysis', shortLabel: 'Loss & Profit' },
];

test('resolvePrintableActiveSheets enforces RBAC visibility for Super Admin vs Depot Dispatcher', () => {
  const allWorkbookSheets = buildWorkbookSheets({
    purchasesCount: 5,
    packingsCount: 3,
    paymentsCount: 2,
    auditLogsCount: 1,
  });

  const adminSheets = resolvePrintableActiveSheets(allWorkbookSheets, (tab) =>
    canUserAccessTab(SAMPLE_USER_ADMIN, tab)
  );
  assert.equal(adminSheets.length, 18);
  assert.equal(adminSheets[0].id, 'dashboard');
  assert.equal(adminSheets[16].id, 'total_balance');
  assert.equal(adminSheets[17].id, 'daily_expense');

  const dispatcherSheets = resolvePrintableActiveSheets(allWorkbookSheets, (tab) =>
    canUserAccessTab(SAMPLE_USER_DISPATCHER, tab)
  );
  assert.equal(dispatcherSheets.length, 6);
  assert.deepEqual(
    dispatcherSheets.map((s) => s.id),
    ['dashboard', 'purchase_form', 'packing_form', 'purchase_db', 'packing_db', 'forget_password']
  );
});

test('resolvePrintableActiveSheets deduplicates repeated sheet entries while keeping order', () => {
  const duplicated: PrintableSheetEntry[] = [
    ...SAMPLE_SHEETS,
    SAMPLE_SHEETS[1],
    SAMPLE_SHEETS[0],
  ];
  const resolved = resolvePrintableActiveSheets(duplicated, () => true);
  assert.equal(resolved.length, 4);
  assert.deepEqual(
    resolved.map((s) => s.id),
    ['dashboard', 'purchase_form', 'packing_form', 'profit_loss']
  );
});

test('startPrintAllSequence initializes active sequence at step 1 and handles empty sheet lists safely', () => {
  const empty = startPrintAllSequence([], 'dashboard');
  assert.equal(empty.isActive, false);
  assert.equal(empty.queue.length, 0);

  const started = startPrintAllSequence(SAMPLE_SHEETS, 'profit_loss', {
    autoPlay: true,
    autoDelayMs: 1800,
  });
  assert.equal(started.isActive, true);
  assert.equal(started.currentIndex, 0);
  assert.equal(started.originTab, 'profit_loss');
  assert.equal(started.isAutoPlaying, true);
  assert.equal(started.autoDelayMs, 1800);
  assert.equal(started.queue.length, 4);

  const progress = getPrintAllSequenceProgress(started);
  assert.equal(progress.currentStep, 1);
  assert.equal(progress.totalSteps, 4);
  assert.equal(progress.percentComplete, 25);
  assert.equal(progress.isFirst, true);
  assert.equal(progress.isLast, false);
  assert.equal(progress.currentSheet?.id, 'dashboard');
});

test('sequential stepping triggers through every active sheet and marks completion on final sheet', () => {
  let seq = startPrintAllSequence(SAMPLE_SHEETS, 'dashboard', { autoPlay: true });
  seq = markPrintAllStepTriggered(seq, 0);
  assert.deepEqual(seq.triggeredSheetIds, ['dashboard']);
  assert.equal(seq.completedAll, false);

  for (let i = 1; i < SAMPLE_SHEETS.length; i++) {
    const adv = advancePrintAllSequence(seq);
    assert.equal(adv.reachedEnd, false);
    seq = markPrintAllStepTriggered(adv.nextState, i);
  }

  assert.equal(seq.currentIndex, 3);
  assert.equal(seq.completedAll, true);
  assert.equal(seq.isAutoPlaying, false);
  assert.deepEqual(seq.triggeredSheetIds, [
    'dashboard',
    'purchase_form',
    'packing_form',
    'profit_loss',
  ]);

  const progress = getPrintAllSequenceProgress(seq);
  assert.equal(progress.currentStep, 4);
  assert.equal(progress.totalSteps, 4);
  assert.equal(progress.percentComplete, 100);
  assert.equal(progress.isLast, true);
  assert.equal(progress.canAdvance, false);
  assert.equal(progress.canStepBack, true);

  const endAdv = advancePrintAllSequence(seq);
  assert.equal(endAdv.reachedEnd, true);
  assert.equal(endAdv.nextState.currentIndex, 3);
});

test('stepBackPrintAllSequence, jumpPrintAllSequence, setPrintAllAutoPlay, and stopPrintAllSequence behave deterministically', () => {
  let seq = startPrintAllSequence(SAMPLE_SHEETS, 'dashboard', { autoPlay: true });
  seq = jumpPrintAllSequence(seq, 2);
  assert.equal(seq.currentIndex, 2);
  assert.equal(seq.isAutoPlaying, false);

  seq = setPrintAllAutoPlay(seq, true);
  assert.equal(seq.isAutoPlaying, true);

  seq = stepBackPrintAllSequence(seq);
  assert.equal(seq.currentIndex, 1);
  assert.equal(seq.isAutoPlaying, false);

  // Out-of-bounds jump clamps safely
  seq = jumpPrintAllSequence(seq, 999);
  assert.equal(seq.currentIndex, 3);
  seq = setPrintAllAutoPlay(seq, true);
  // AutoPlay does not activate at final sheet
  assert.equal(seq.isAutoPlaying, false);

  const stopped = stopPrintAllSequence(seq);
  assert.deepEqual(stopped, createIdlePrintAllState());
});
