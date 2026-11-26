import { ActiveTab, AuthUser } from '../types/index.ts';
import { canUserAccessTab } from './rbacPermissions.ts';
import { WorkbookSheetNavItem } from './printAllSheets.ts';

export type MobileBottomNavSlotId =
  | 'dashboard'
  | 'purchase_form'
  | 'packing_form'
  | 'databases'
  | 'more';

export interface MobileBottomNavItem {
  slotId: MobileBottomNavSlotId;
  label: string;
  targetTab: ActiveTab | null; // null => opens All Sheets drawer
  matchTabs: ActiveTab[];
  badge?: number | string;
}

export const MOBILE_TOP_BAR_HEIGHT_PX = 52;
export const MOBILE_BOTTOM_NAV_HEIGHT_PX = 58;
export const MAX_STICKY_VIEWPORT_RATIO = 0.15;

export interface MobileStickyBudgetResult {
  combinedStickyHeightPx: number;
  viewportHeightPx: number;
  ratio: number;
  withinCap: boolean;
}

/**
 * Verifies aggregate fixed/sticky chrome height on mobile remains <= 15% of viewport height.
 */
export function computeMobileStickyBudget(
  viewportHeightPx: number,
  topBarPx: number = MOBILE_TOP_BAR_HEIGHT_PX,
  bottomNavPx: number = MOBILE_BOTTOM_NAV_HEIGHT_PX
): MobileStickyBudgetResult {
  const safeHeight =
    Number.isFinite(viewportHeightPx) && viewportHeightPx > 0
      ? viewportHeightPx
      : 844;
  const combinedStickyHeightPx = Math.max(0, topBarPx) + Math.max(0, bottomNavPx);
  const ratio = Number((combinedStickyHeightPx / safeHeight).toFixed(4));
  return {
    combinedStickyHeightPx,
    viewportHeightPx: safeHeight,
    ratio,
    withinCap: ratio <= MAX_STICKY_VIEWPORT_RATIO,
  };
}

const DATABASE_TABS: ActiveTab[] = ['purchase_db', 'packing_db', 'payment_db'];

/**
 * Builds up to 5 ergonomic thumb-zone bottom navigation destinations for mobile screens,
 * honoring RBAC permissions so users only see accessible sheets.
 */
export function buildMobileBottomNavItems(
  visibleSheets: WorkbookSheetNavItem[],
  currentUser: AuthUser | null
): MobileBottomNavItem[] {
  const canAccess = (tab: ActiveTab) =>
    visibleSheets.some((s) => s.id === tab) && canUserAccessTab(currentUser, tab);

  const items: MobileBottomNavItem[] = [];

  if (canAccess('dashboard')) {
    items.push({
      slotId: 'dashboard',
      label: 'Home',
      targetTab: 'dashboard',
      matchTabs: ['dashboard'],
    });
  }

  if (canAccess('purchase_form')) {
    items.push({
      slotId: 'purchase_form',
      label: 'Purchase',
      targetTab: 'purchase_form',
      matchTabs: ['purchase_form'],
    });
  }

  if (canAccess('packing_form')) {
    items.push({
      slotId: 'packing_form',
      label: 'Packing',
      targetTab: 'packing_form',
      matchTabs: ['packing_form'],
    });
  }

  const accessibleDbTabs = DATABASE_TABS.filter((tab) => canAccess(tab));
  if (accessibleDbTabs.length > 0) {
    items.push({
      slotId: 'databases',
      label: 'Records',
      targetTab: accessibleDbTabs[0],
      matchTabs: accessibleDbTabs,
    });
  } else if (canAccess('payment_form')) {
    items.push({
      slotId: 'databases',
      label: 'Payments',
      targetTab: 'payment_form',
      matchTabs: ['payment_form', 'exporter_payment_form'],
    });
  }

  // Always keep "Sheets" menu trigger in the 5th (rightmost) thumb slot
  items.push({
    slotId: 'more',
    label: 'Sheets',
    targetTab: null,
    matchTabs: [],
  });

  return items;
}

/**
 * Resolves which bottom navigation slot should be highlighted for the active tab.
 */
export function resolveActiveMobileNavSlot(
  activeTab: ActiveTab,
  navItems: MobileBottomNavItem[],
  isDrawerOpen: boolean
): MobileBottomNavSlotId {
  if (isDrawerOpen) {
    return 'more';
  }
  const directMatch = navItems.find(
    (item) => item.slotId !== 'more' && item.matchTabs.includes(activeTab)
  );
  return directMatch ? directMatch.slotId : 'more';
}
