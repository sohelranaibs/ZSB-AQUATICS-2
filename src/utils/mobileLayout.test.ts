import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMobileBottomNavItems,
  computeMobileStickyBudget,
  resolveActiveMobileNavSlot,
  MOBILE_TOP_BAR_HEIGHT_PX,
  MOBILE_BOTTOM_NAV_HEIGHT_PX,
} from './mobileLayout.ts';
import { buildWorkbookSheets } from './printAllSheets.ts';
import { AuthUser } from '../types/index.ts';

const SUPER_ADMIN_USER: AuthUser = {
  username: 'admin',
  displayName: 'Admin User',
  email: 'admin@zsbaquatics.com',
  role: 'Partner & Administrator',
  loginAt: '2026-01-01T00:00:00Z',
};

const ALL_SHEETS = buildWorkbookSheets({
  purchasesCount: 12,
  packingsCount: 8,
  paymentsCount: 5,
  auditLogsCount: 30,
  otherCostsCount: 4,
});

describe('mobileLayout utilities', () => {
  it('keeps aggregate mobile top + bottom sticky height within the 15% cap on standard phones', () => {
    const budget = computeMobileStickyBudget(844);
    assert.equal(
      budget.combinedStickyHeightPx,
      MOBILE_TOP_BAR_HEIGHT_PX + MOBILE_BOTTOM_NAV_HEIGHT_PX
    );
    assert.equal(budget.withinCap, true);
    assert.ok(budget.ratio <= 0.15);
  });

  it('flags sticky budgets exceeding 15% on unusually short viewports', () => {
    const budget = computeMobileStickyBudget(500, 52, 58);
    assert.equal(budget.withinCap, false);
    assert.ok(budget.ratio > 0.15);
  });

  it('builds 5 bottom nav slots for Super Admin including Home, Purchase, Packing, Records, and Sheets', () => {
    const items = buildMobileBottomNavItems(ALL_SHEETS, SUPER_ADMIN_USER);
    assert.equal(items.length, 5);
    assert.deepEqual(
      items.map((i) => i.slotId),
      ['dashboard', 'purchase_form', 'packing_form', 'databases', 'more']
    );
    assert.equal(items[3].targetTab, 'purchase_db');
    assert.deepEqual(items[3].matchTabs, ['purchase_db', 'packing_db', 'payment_db']);
    assert.equal(items[4].targetTab, null);
  });

  it('highlights the matching bottom nav slot for database sub-tabs and falls back to Sheets for secondary views', () => {
    const items = buildMobileBottomNavItems(ALL_SHEETS, SUPER_ADMIN_USER);
    assert.equal(resolveActiveMobileNavSlot('dashboard', items, false), 'dashboard');
    assert.equal(resolveActiveMobileNavSlot('purchase_form', items, false), 'purchase_form');
    assert.equal(resolveActiveMobileNavSlot('packing_form', items, false), 'packing_form');
    assert.equal(resolveActiveMobileNavSlot('packing_db', items, false), 'databases');
    assert.equal(resolveActiveMobileNavSlot('payment_db', items, false), 'databases');
    assert.equal(resolveActiveMobileNavSlot('profit_loss', items, false), 'more');
    assert.equal(resolveActiveMobileNavSlot('dashboard', items, true), 'more');
  });

  it('respects RBAC restricted sheets when building mobile bottom nav items', () => {
    const restrictedSheets = ALL_SHEETS.filter(
      (s) => s.id === 'dashboard' || s.id === 'settings'
    );
    const items = buildMobileBottomNavItems(restrictedSheets, SUPER_ADMIN_USER);
    assert.deepEqual(
      items.map((i) => i.slotId),
      ['dashboard', 'more']
    );
  });
});
