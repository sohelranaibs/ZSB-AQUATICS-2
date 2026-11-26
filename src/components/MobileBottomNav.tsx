import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  FilePlus,
  Package,
  Database,
  Menu,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { WorkbookSheetNavItem } from '../utils/printAllSheets.ts';
import {
  buildMobileBottomNavItems,
  resolveActiveMobileNavSlot,
  MobileBottomNavSlotId,
} from '../utils/mobileLayout.ts';

interface MobileBottomNavProps {
  sheets: WorkbookSheetNavItem[];
  isMobileDrawerOpen: boolean;
  onOpenMobileDrawer: () => void;
  hidden?: boolean;
}

function renderSlotIcon(slotId: MobileBottomNavSlotId, isActive: boolean) {
  const cls = `w-5 h-5 shrink-0 transition-transform ${
    isActive ? 'scale-105' : 'opacity-85'
  }`;
  switch (slotId) {
    case 'dashboard':
      return <LayoutDashboard className={cls} aria-hidden="true" />;
    case 'purchase_form':
      return <FilePlus className={cls} aria-hidden="true" />;
    case 'packing_form':
      return <Package className={cls} aria-hidden="true" />;
    case 'databases':
      return <Database className={cls} aria-hidden="true" />;
    case 'more':
      return <Menu className={cls} aria-hidden="true" />;
  }
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = React.memo(
  ({ sheets, isMobileDrawerOpen, onOpenMobileDrawer, hidden = false }) => {
    const { activeTab, setActiveTab, currentUser } = useApp();

    const navItems = useMemo(
      () => buildMobileBottomNavItems(sheets, currentUser),
      [sheets, currentUser]
    );

    const activeSlot = useMemo(
      () => resolveActiveMobileNavSlot(activeTab, navItems, isMobileDrawerOpen),
      [activeTab, navItems, isMobileDrawerOpen]
    );

    if (hidden) {
      return null;
    }

    return (
      <nav
        aria-label="Mobile Quick Navigation"
        data-testid="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1E3247]/95 backdrop-blur-md border-t border-white/15 shadow-[0_-4px_16px_rgba(15,23,42,0.28)] pb-safe print:hidden select-none"
      >
        <div
          className="grid items-stretch h-[58px] px-1"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const isActive = activeSlot === item.slotId;
            return (
              <button
                key={item.slotId}
                type="button"
                data-mobile-chrome-btn="true"
                data-testid={`mobile-bottom-nav-${item.slotId}`}
                aria-current={isActive && item.targetTab ? 'page' : undefined}
                aria-expanded={item.slotId === 'more' ? isMobileDrawerOpen : undefined}
                onClick={() => {
                  if (item.targetTab) {
                    setActiveTab(item.targetTab);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    onOpenMobileDrawer();
                  }
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-1 py-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isActive
                    ? 'text-amber-300'
                    : 'text-slate-300 hover:text-white active:bg-white/10'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-b-full bg-amber-400"
                  />
                )}
                {renderSlotIcon(item.slotId, isActive)}
                <span className="text-[10px] font-bold tracking-tight leading-none whitespace-nowrap truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }
);
