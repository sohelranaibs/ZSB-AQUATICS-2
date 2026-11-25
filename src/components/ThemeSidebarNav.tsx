import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ActiveTab } from '../types/index.ts';
import { canUserAccessTab, resolveCanonicalTeamRole } from '../utils/rbacPermissions.ts';
import {
  buildWorkbookSheets,
  WorkbookSheetNavItem,
} from '../utils/printAllSheets.ts';
export { buildWorkbookSheets };
export type { WorkbookSheetNavItem };
import {
  ChevronRight,
  ChevronLeft,
  LogOut,
  LayoutDashboard,
  FilePlus,
  Package,
  ArrowRightLeft,
  CreditCard,
  Plane,
  Receipt,
  TrendingUp,
  Database,
  Archive,
  Wallet,
  Search,
  Settings,
  ShieldCheck,
  Lock,
  KeyRound,
  Scale,
  ReceiptText,
} from 'lucide-react';

function renderSheetIcon(id: ActiveTab, isActive: boolean) {
  const cls = `w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-200 group-hover:text-white'}`;
  switch (id) {
    case 'dashboard':
      return <LayoutDashboard className={cls} />;
    case 'purchase_form':
      return <FilePlus className={cls} />;
    case 'packing_form':
      return <Package className={cls} />;
    case 'exporter_payment_form':
      return <ArrowRightLeft className={cls} />;
    case 'payment_form':
      return <CreditCard className={cls} />;
    case 'air_way_bill':
      return <Plane className={cls} />;
    case 'exporter_payment_slip':
      return <Receipt className={cls} />;
    case 'profit_loss':
      return <TrendingUp className={cls} />;
    case 'total_balance':
      return <Scale className={cls} />;
    case 'daily_expense':
      return <ReceiptText className={cls} />;
    case 'purchase_db':
      return <Database className={cls} />;
    case 'packing_db':
      return <Archive className={cls} />;
    case 'payment_db':
      return <Wallet className={cls} />;
    case 'search_reports':
      return <Search className={cls} />;
    case 'settings':
      return <Settings className={cls} />;
    case 'audit_logs':
      return <ShieldCheck className={cls} />;
    case 'administration':
      return <Lock className={cls} />;
    case 'forget_password':
      return <KeyRound className={cls} />;
  }
}

interface ThemeSidebarNavProps {
  sheets: WorkbookSheetNavItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
}

export const ThemeSidebarNav: React.FC<ThemeSidebarNavProps> = React.memo(({
  sheets,
  isCollapsed,
  onToggleCollapse,
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
}) => {
  const { activeTab, setActiveTab, companyProfile, currentUser, logout } = useApp();

  const visibleSheets = useMemo(
    () => sheets.filter((s) => canUserAccessTab(currentUser, s.id)),
    [sheets, currentUser]
  );

  const canonicalRole = useMemo(
    () => resolveCanonicalTeamRole(currentUser),
    [currentUser]
  );

  const handleSelectSheet = (id: ActiveTab) => {
    setActiveTab(id);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const renderDesktopSidebar = () => {
    if (isCollapsed) {
      return (
        <aside
          data-testid="theme-sidebar-collapsed"
          className="hidden md:flex flex-col items-center py-3 px-1.5 w-16 shrink-0 md:sticky md:top-0 md:h-screen self-start bg-[#273E56] print:hidden select-none z-30"
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            data-testid="sidebar-expand-btn"
            title="Expand ZSB AQUATICS Export Ledger Bar"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center mb-2 transition cursor-pointer shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-full py-1.5 mb-2 border-b border-white/10 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-[#CBD8E6] flex items-center justify-center overflow-hidden mb-1">
              <img
                src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                alt={companyProfile.companyName}
                className="w-full h-full object-contain rounded-md"
              />
            </div>
            <span className="text-[8px] font-black text-amber-400 zsb-golden-brand tracking-wider leading-none uppercase">
              ZSB
            </span>
            <span className="text-[7px] font-semibold text-sky-200 leading-tight uppercase mt-0.5">
              Ledger
            </span>
          </div>

          <div className="flex-1 w-full space-y-1.5 py-1 overflow-y-auto">
            {visibleSheets.map((s) => {
              const isActive = activeTab === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`sidebar-mini-${s.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleSelectSheet(s.id)}
                  title={`#${s.num} · ${s.label}`}
                  className={`w-full py-1.5 rounded-lg text-[11px] font-mono font-bold transition flex items-center justify-center cursor-pointer border ${
                    isActive
                      ? 'bg-[#273E56] text-white border-amber-400 shadow-xs'
                      : 'bg-[#273E56] text-slate-200 border-white/15 hover:text-white'
                  }`}
                >
                  {s.num}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={logout}
            title="Logout"
            className="mt-2 w-8 h-8 rounded-lg bg-white/10 hover:bg-[#1D6CE0] text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </aside>
      );
    }

    return (
      <aside
        aria-label="Workbook Sheet Sidebar Navigation"
        data-testid="theme-sidebar-nav"
        className="hidden md:flex flex-col w-56 lg:w-60 xl:w-64 shrink-0 md:sticky md:top-0 md:h-screen self-start bg-[#273E56] text-slate-100 print:hidden select-none z-30"
      >
        {/* Top Brand Lockup (Matching Reference Full-Height Deep Navy Sidebar) */}
        <div className="px-4 py-3 flex items-center justify-between gap-2.5 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-full bg-white p-0.5 border border-[#CBD8E6] shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-black tracking-tight text-amber-400 zsb-golden-brand leading-tight truncate">
              {companyProfile.companyName}
            </div>
            <div className="text-[11px] font-medium text-sky-200 leading-tight truncate">
              Export Ledger
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          data-testid="sidebar-collapse-btn"
          title="Collapse Sidebar for Wider Sheet View"
          className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Sheet Navigation List — Sleek Reduced-Height Pill Tabs */}
      <nav
        aria-label="Workbook Sheets Menu"
        className="flex-1 overflow-y-auto py-2.5 px-3 space-y-2"
      >
        {visibleSheets.map((s) => {
          const isActive = activeTab === s.id;
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`sidebar-nav-${s.id}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveTab(s.id)}
              className={`w-full py-1.5 px-3 rounded-xl flex items-center justify-between gap-2 text-left transition-all cursor-pointer group border ${
                isActive
                  ? 'bg-[#273E56] text-white border-amber-400 font-bold shadow-xs'
                  : 'bg-[#273E56] text-slate-100 border-white/15 hover:text-white font-medium'
              }`}
              title={`Sheet #${s.num} · ${s.label}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {renderSheetIcon(s.id, isActive)}
                <span className="text-[13px] leading-tight truncate">
                  {s.shortLabel || s.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {s.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums leading-none ${
                      isActive
                        ? 'bg-[#1D6CE0]/15 text-[#1D6CE0]'
                        : 'bg-white/10 text-slate-200'
                    }`}
                  >
                    {s.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Role Clearance & Logout Row */}
      <div className="border-t border-white/10 shrink-0">
        <div
          data-testid="sidebar-role-clearance"
          className="px-4 py-1.5 flex items-center justify-between text-[10px] font-mono text-slate-300 border-b border-white/10"
        >
          <span>Role</span>
          <span className="text-amber-300 font-bold uppercase tracking-wide truncate max-w-[130px]">
            {canonicalRole}
          </span>
        </div>

        <div className="px-3 py-2">
          <button
            type="button"
            data-testid="sidebar-logout-btn"
            onClick={logout}
            className="w-full py-1.5 px-3 rounded-xl flex items-center gap-2.5 text-slate-100 hover:text-white hover:bg-white/10 text-[13px] leading-tight font-semibold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
    );
  };

  return (
    <>
      {renderDesktopSidebar()}

      {/* Mobile Slide-Over ZSB AQUATICS Export Ledger Drawer (< md) */}
      {isMobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="ZSB AQUATICS Export Ledger Navigation"
        >
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xs"
            onClick={onCloseMobileDrawer}
          />
          <aside
            data-testid="theme-sidebar-mobile-drawer"
            className="relative z-10 flex flex-col w-64 max-w-[82vw] h-full bg-[#273E56] text-slate-100 border-r border-[#385775] shadow-2xl select-none"
          >
            <div className="px-4 py-3 flex items-center justify-between gap-2.5 border-b border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => handleSelectSheet('dashboard')}
                className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-white p-0.5 border border-[#CBD8E6] shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                    alt={companyProfile.companyName}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-black tracking-tight text-amber-400 zsb-golden-brand leading-tight truncate">
                    {companyProfile.companyName}
                  </div>
                  <div className="text-[11px] font-medium text-sky-200 leading-tight truncate">
                    Export Ledger
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onCloseMobileDrawer}
                aria-label="Close Export Ledger Menu"
                className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <nav aria-label="Mobile Workbook Sheets Menu" className="flex-1 overflow-y-auto py-2.5 px-3 space-y-2">
              {visibleSheets.map((s) => {
                const isActive = activeTab === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`mobile-sidebar-nav-${s.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handleSelectSheet(s.id)}
                    className={`w-full py-1.5 px-3 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer border ${
                      isActive
                        ? 'bg-[#273E56] text-white border-amber-400 font-bold shadow-xs'
                        : 'bg-[#273E56] text-slate-100 border-white/15 hover:text-white font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderSheetIcon(s.id, isActive)}
                      <span className="text-[13px] leading-tight truncate">
                        {s.shortLabel || s.label}
                      </span>
                    </div>
                    {s.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums leading-none shrink-0 ${
                          isActive ? 'bg-[#1D6CE0]/15 text-[#1D6CE0]' : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        {s.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-white/10 shrink-0">
              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-1.5 px-3 rounded-xl flex items-center gap-2.5 text-slate-100 hover:text-white hover:bg-white/10 text-[13px] leading-tight font-semibold transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
});
