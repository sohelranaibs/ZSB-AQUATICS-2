import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  formatCurrency,
  formatDate,
  formatRMB,
  classifyPaymentCategory,
  calculatePackingTotalAmountBDT,
  calculateCumulativeExportValueBDT,
  calculateForeignRmbRemittanceValue,
  calculatePackingConsignmentSummary,
} from '../utils/calculations.ts';
import {
  scanUpcomingRecurringSupplierPayments,
  calculateUpcomingRecurringSummary,
  buildNextCyclePaymentPatch,
  UpcomingRecurringPaymentItem,
} from '../utils/recurringPayments.ts';
import {
  calculateLowStockSummary,
  DEFAULT_MIN_INVENTORY_THRESHOLD_KG,
  DEFAULT_APPROACHING_THRESHOLD_PERCENT,
} from '../utils/inventoryStock.ts';
import { calculateTotalBalanceSummary } from '../utils/totalBalance.ts';
import {
  calculateDailyExpenseSummary,
  getTodayLocalIsoDate,
} from '../utils/dailyExpense.ts';
import {
  ArrowRight,
  ArrowUpRight,
  TrendingUp,
  Package,
  ShoppingCart,
  Eye,
  BarChart3,
  Upload,
  FileSpreadsheet,
  SlidersHorizontal,
  Search,
  Scale,
  Plane,
  Download,
  Repeat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Activity,
  HeartCrack,
  Trash2,
  PlusCircle,
  Calendar,
  History,
  Printer,
  Users,
  Percent,
  Wallet,
} from 'lucide-react';
import { buildMonthlyMortalityReport } from '../utils/mortalityReport.ts';
import { downloadCsvFile } from '../utils/csvExporter.ts';
import {
  buildDashboardSummaryCsvFilename,
  generateDashboardSummaryCSV,
} from '../utils/dashboardSummaryCsv.ts';
import { MonthlySummaryCard } from './MonthlySummaryCard.tsx';
import { ProfitLossTrendChart } from './ProfitLossTrendChart.tsx';
import { MonthlyPerformanceSummaryWidget } from './MonthlyPerformanceSummaryWidget.tsx';
import { TopSuppliersChart } from './TopSuppliersChart.tsx';
import { DashboardAllSuppliersReport } from './DashboardAllSuppliersReport.tsx';
import { MonthlyReportsExportView } from './MonthlyReportsExportView.tsx';
import { DailyFinancialSummaryWidget } from './DailyFinancialSummaryWidget.tsx';
import { QuickFinancialPulseSidebar } from './QuickFinancialPulseSidebar.tsx';
import { DashboardAlertsWidget } from './DashboardAlertsWidget.tsx';
import { DashboardQuickSummaryWidget } from './DashboardQuickSummaryWidget.tsx';
import { DashboardCalendarWidget } from './DashboardCalendarWidget.tsx';
import { BanglaPanjikaCalendar } from './BanglaPanjikaCalendar.tsx';

export const DashboardView: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    purchases,
    packings,
    payments,
    updatePayment,
    otherCosts,
    partnerDeposits,
    partnerWithdrawals,
    profitDistributions,
    externalDebts,
    balanceIncomes,
    supplierCredits,
    companyProfile,
    mortalities,
    addMortality,
    deleteMortality,
    dropdownOptions,
    openPrintModal,
    openDataCenterModal,
    showToast,
  } = useApp();

  const [dashboardSubView, setDashboardSubView] = useState<'overview' | 'monthly_reports'>('overview');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'Purchase' | 'Packing' | 'Payment'>('ALL');
  const [recurringFilter, setRecurringFilter] = useState<'all' | 'urgent_7d' | 'weekly' | 'monthly'>('all');

  // Mortality Log form state within Inventory Monitor
  const [showMortalityLog, setShowMortalityLog] = useState<boolean>(true);
  const [mortalitySpecies, setMortalitySpecies] = useState<string>('');
  const [mortalityQty, setMortalityQty] = useState<string>('');
  const [mortalityDate, setMortalityDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [mortalityCause, setMortalityCause] = useState<string>('Tank Acclimation Stress');
  const [mortalityNotes, setMortalityNotes] = useState<string>('');

  // Generates printable summary of all mortality events recorded in the current month
  const handleOpenMonthlyMortalityReport = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const reportData = buildMonthlyMortalityReport(mortalities, purchases, currentMonth);

    openPrintModal({
      type: 'mortality_report',
      title: `Monthly Mortality Summary Report — ${reportData.monthLabel}`,
      data: reportData,
      items: reportData.records,
    });
  };

  // Calculate inventory stock levels and low-stock notifications against threshold defined in settings,
  // automatically deducting recorded mortality events
  const lowStockSummary = useMemo(
    () =>
      calculateLowStockSummary(
        purchases,
        packings,
        mortalities,
        companyProfile.minInventoryThresholdKg ?? DEFAULT_MIN_INVENTORY_THRESHOLD_KG,
        companyProfile.approachingThresholdPercent ?? DEFAULT_APPROACHING_THRESHOLD_PERCENT
      ),
    [
      purchases,
      packings,
      mortalities,
      companyProfile.minInventoryThresholdKg,
      companyProfile.approachingThresholdPercent,
    ]
  );

  // Scan payment records for upcoming recurring supplier payments with future due dates
  const upcomingRecurringPayments = useMemo(
    () => scanUpcomingRecurringSupplierPayments(payments),
    [payments]
  );

  const recurringSummary = useMemo(
    () => calculateUpcomingRecurringSummary(upcomingRecurringPayments),
    [upcomingRecurringPayments]
  );

  const filteredRecurringPayments = useMemo(() => {
    if (recurringFilter === 'urgent_7d') {
      return upcomingRecurringPayments.filter((item) => item.daysUntilDue <= 7);
    }
    if (recurringFilter === 'weekly') {
      return upcomingRecurringPayments.filter(
        (item) => item.recurrenceFrequency === 'weekly' || item.recurrenceFrequency === 'biweekly'
      );
    }
    if (recurringFilter === 'monthly') {
      return upcomingRecurringPayments.filter(
        (item) => item.recurrenceFrequency === 'monthly' || item.recurrenceFrequency === 'quarterly'
      );
    }
    return upcomingRecurringPayments;
  }, [upcomingRecurringPayments, recurringFilter]);

  const handleAdvanceRecurringCycle = (item: UpcomingRecurringPaymentItem) => {
    const patch = buildNextCyclePaymentPatch(item);
    updatePayment(item.id, patch);
    showToast(
      `Settled ${item.supplierName} (${item.invoiceNumber}) for ${formatDate(item.dueDate)}. Next recurring due date advanced to ${formatDate(item.nextProjectedDate)}.`
    );
  };

  // Metrics calculations
  const totalPurchaseCount = purchases.length;
  const totalPaymentCount = payments.length;
  const totalPackingCount = packings.length;

  const supplierPaymentCount = useMemo(
    () => payments.filter((p) => classifyPaymentCategory(p) === 'supplier').length,
    [payments]
  );
  const exporterPaymentCount = useMemo(
    () => payments.filter((p) => classifyPaymentCategory(p) === 'exporter').length,
    [payments]
  );

  const consignmentSummary = useMemo(
    () => calculatePackingConsignmentSummary(packings),
    [packings]
  );
  const totalPurchaseValue = purchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
  const totalPurchaseQty = purchases.reduce((acc, p) => acc + (Number(p.totalQty) || 0), 0);
  const totalExportValue = calculateCumulativeExportValueBDT(packings);
  const totalWeight = consignmentSummary.totalCumulativeWeightKg;
  const totalBoxes = consignmentSummary.totalBoxes;
  const totalPaymentsMade = payments.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);
  const totalRmbSettled = calculateForeignRmbRemittanceValue(packings);

  const todayIso = getTodayLocalIsoDate();
  const dailyExpenseSummary = useMemo(
    () =>
      calculateDailyExpenseSummary(otherCosts, {
        todayDate: todayIso,
        selectedDate: todayIso,
        selectedMonth: todayIso.slice(0, 7),
        scope: 'all',
        filterCategory: 'ALL',
        searchQuery: '',
      }),
    [otherCosts, todayIso]
  );

  const totalBalanceSummary = useMemo(
    () =>
      calculateTotalBalanceSummary({
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
        externalDebts,
        balanceIncomes,
        purchases,
        packings,
        otherCosts,
      }),
    [partnerDeposits, partnerWithdrawals, profitDistributions, externalDebts, balanceIncomes, purchases, packings, otherCosts]
  );

  const activePartiesCount = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      const name = String(p.description || '').trim().toLowerCase();
      if (name) set.add(`s:${name}`);
    });
    packings.forEach((pk) => {
      const mark = String(pk.shippingMark || '').trim().toLowerCase();
      if (mark) set.add(`m:${mark}`);
    });
    return set.size;
  }, [purchases, packings]);

  const executiveMarginPercent = useMemo(() => {
    if (totalExportValue <= 0) return '0.00';
    const spread = ((totalExportValue - totalPurchaseValue) / totalExportValue) * 100;
    return spread.toFixed(2);
  }, [totalExportValue, totalPurchaseValue]);

  // Latest dates
  const latestPurchaseDate = purchases[0]?.date ? formatDate(purchases[0].date) : 'No records';
  const latestPaymentDate = payments[0]?.date ? formatDate(payments[0].date) : 'No records';
  const latestPackingDate = packings[0]?.packingDate ? formatDate(packings[0].packingDate) : 'No records';

  const handleDownloadSummaryCsv = () => {
    const csvContent = generateDashboardSummaryCSV({
      companyName: companyProfile.companyName || 'ZSB AQUATICS',
      currency: companyProfile.currency || 'TK',
      rmbExchangeRate: companyProfile.rmbExchangeRate || 16.5,
      totalExportValueBDT: totalExportValue,
      totalPurchaseValue,
      totalPurchaseCount,
      totalPurchaseQtyKg: totalPurchaseQty,
      totalPackingCount,
      totalExportWeightKg: totalWeight,
      totalExportBoxes: totalBoxes,
      totalRmbSettled,
      totalPaymentCount,
      supplierPaymentCount,
      exporterPaymentCount,
      totalPaymentsMade,
      activePartiesCount,
      executiveMarginPercent,
      availableStockKg: lowStockSummary.totalAvailableStockKg,
      stockStatus: lowStockSummary.totalStockStatus,
      totalBalance: totalBalanceSummary.totalBalance,
      latestPurchaseDate,
      latestPackingDate,
      latestPaymentDate,
    });
    const filename = buildDashboardSummaryCsvFilename();
    downloadCsvFile(csvContent, filename);
    showToast(`Dashboard summary CSV downloaded: ${filename}`);
  };

  // Recent activity list with filter support
  const allActivities = useMemo(() => {
    const list = [
      ...purchases.map((p, idx) => ({
        type: 'Purchase' as const,
        categoryLabel: 'Supplier Challan',
        id: p.id ? (p.id.startsWith('pur-') ? p.id : `pur-${p.id}`) : `pur-${idx}`,
        docId: p.invoiceNumber,
        party: p.description,
        detail: `${p.totalQty.toLocaleString()} KG`,
        date: p.date,
        amount: p.totalAmount,
        raw: p,
      })),
      ...packings.map((pkg, idx) => ({
        type: 'Packing' as const,
        categoryLabel: 'Export Manifest',
        id: pkg.id ? (pkg.id.startsWith('pkg-') ? pkg.id : `pkg-${pkg.id}`) : `pkg-${idx}`,
        docId: pkg.invoiceNumber,
        party: `${pkg.shippingMark} · ${pkg.destination}`,
        detail: `${pkg.totalBox} Boxes (${pkg.totalWeight} KG)`,
        date: pkg.packingDate,
        amount: calculatePackingTotalAmountBDT(pkg.totalAmount, pkg.rmbRate),
        raw: pkg,
      })),
      ...payments.map((pm, idx) => {
        const isExporter = classifyPaymentCategory(pm) === 'exporter';
        return {
          type: 'Payment' as const,
          categoryLabel: isExporter ? 'Exporter Settlement' : 'Supplier Voucher',
          id: pm.id ? (pm.id.startsWith('pay-') ? pm.id : `pay-${pm.id}`) : `pay-${idx}`,
          docId: pm.invoiceNumber,
          party: pm.description,
          detail: isExporter && pm.returnRMB > 0 ? formatRMB(pm.returnRMB) : 'BDT Settlement',
          date: pm.date,
          amount: pm.paidAmount,
          raw: pm,
        };
      }),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Defensive deduplication to guarantee strictly unique React keys
    const seen = new Set<string>();
    return list.map((item, idx) => {
      let uniqueId = item.id;
      if (seen.has(uniqueId)) {
        uniqueId = `${item.id}-dup-${idx}`;
      }
      seen.add(uniqueId);
      return { ...item, id: uniqueId };
    });
  }, [purchases, packings, payments]);

  const recentActivities = useMemo(() => {
    const filtered =
      activityFilter === 'ALL'
        ? allActivities
        : allActivities.filter((a) => a.type === activityFilter);
    return filtered.slice(0, 6);
  }, [allActivities, activityFilter]);

  if (dashboardSubView === 'monthly_reports') {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <MonthlyReportsExportView onBackToOverview={() => setDashboardSubView('overview')} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Quick Summary Widget: Daily-Updated Mini-Cards for Total Purchases Today & Total Pending Payments */}
      <DashboardQuickSummaryWidget
        purchases={purchases}
        payments={payments}
        packings={packings}
        supplierCredits={supplierCredits}
        currency={companyProfile.currency}
        onNavigateTab={setActiveTab}
      />

      {/* Top 5-Card BI Executive Overview Strip — Decorated in 1 Single Horizontal Row */}
      <section
        aria-label="Executive BI KPI Overview Strip"
        data-testid="dashboard-bi-kpi-strip"
        className="bg-white rounded-2xl border border-[#CBD8E6] shadow-xs overflow-x-auto"
      >
        <div
          data-testid="dashboard-bi-kpi-row"
          className="grid grid-cols-5 min-w-[760px] divide-x divide-[#E2E8F0] items-stretch"
        >
          {/* KPI 1: Total Export Revenue */}
          <div className="relative p-3.5 sm:p-4 pb-2.5 flex flex-col justify-between bg-gradient-to-b from-sky-50/40 via-white to-white border-t-3 border-t-[#1D6CE0] min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-[#1D6CE0] text-white flex items-center justify-center shrink-0 shadow-xs ring-4 ring-[#1D6CE0]/10">
                <Package className="w-4 h-4 xl:w-5 xl:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                  TOTAL EXPORT REVENUE
                </div>
                <div className="text-sm xl:text-base 2xl:text-lg font-black text-slate-900 font-mono tabular-nums truncate mt-0.5">
                  {formatCurrency(totalExportValue, 'BDT')}
                </div>
              </div>
            </div>
            <svg viewBox="0 0 160 28" className="w-full h-6 mt-2 overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="kpiGradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D6CE0" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#1D6CE0" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M0,22 C24,18 40,21 62,14 C88,7 110,16 132,10 C145,7 152,5 160,6 L160,28 L0,28 Z" fill="url(#kpiGradBlue)" />
              <path d="M0,22 C24,18 40,21 62,14 C88,7 110,16 132,10 C145,7 152,5 160,6" fill="none" stroke="#1D6CE0" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* KPI 2: Total Procurement Spend */}
          <div className="relative p-3.5 sm:p-4 pb-2.5 flex flex-col justify-between bg-gradient-to-b from-emerald-50/40 via-white to-white border-t-3 border-t-[#00B14F] min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-[#00B14F] text-white flex items-center justify-center shrink-0 shadow-xs ring-4 ring-[#00B14F]/10">
                <Wallet className="w-4 h-4 xl:w-5 xl:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                  TOTAL PROCUREMENT
                </div>
                <div className="text-sm xl:text-base 2xl:text-lg font-black text-slate-900 font-mono tabular-nums truncate mt-0.5">
                  {formatCurrency(totalPurchaseValue, companyProfile.currency)}
                </div>
              </div>
            </div>
            <svg viewBox="0 0 160 28" className="w-full h-6 mt-2 overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="kpiGradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00B14F" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#00B14F" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M0,20 C22,12 42,24 66,13 C90,5 112,17 136,11 C148,8 154,12 160,9 L160,28 L0,28 Z" fill="url(#kpiGradGreen)" />
              <path d="M0,20 C22,12 42,24 66,13 C90,5 112,17 136,11 C148,8 154,12 160,9" fill="none" stroke="#00B14F" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* KPI 3: Total Orders & Manifests */}
          <div className="relative p-3.5 sm:p-4 pb-2.5 flex flex-col justify-between bg-gradient-to-b from-violet-50/40 via-white to-white border-t-3 border-t-[#7C3AED] min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-xs ring-4 ring-[#7C3AED]/10">
                <ShoppingCart className="w-4 h-4 xl:w-5 xl:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                  TOTAL ORDERS &amp; BILLS
                </div>
                <div className="text-sm xl:text-base 2xl:text-lg font-black text-slate-900 font-mono tabular-nums truncate mt-0.5">
                  {(totalPurchaseCount + totalPackingCount).toLocaleString()}
                </div>
              </div>
            </div>
            <svg viewBox="0 0 160 28" className="w-full h-6 mt-2 overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="kpiGradPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M0,18 C25,22 48,14 72,11 C96,8 122,13 142,8 C150,7 155,10 160,12 L160,28 L0,28 Z" fill="url(#kpiGradPurple)" />
              <path d="M0,18 C25,22 48,14 72,11 C96,8 122,13 142,8 C150,7 155,10 160,12" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* KPI 4: Suppliers & Marks */}
          <div className="relative p-3.5 sm:p-4 pb-2.5 flex flex-col justify-between bg-gradient-to-b from-orange-50/40 via-white to-white border-t-3 border-t-[#F97316] min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-[#F97316] text-white flex items-center justify-center shrink-0 shadow-xs ring-4 ring-[#F97316]/10">
                <Users className="w-4 h-4 xl:w-5 xl:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                  SUPPLIERS &amp; MARKS
                </div>
                <div className="text-sm xl:text-base 2xl:text-lg font-black text-slate-900 font-mono tabular-nums truncate mt-0.5">
                  {activePartiesCount.toLocaleString()}
                </div>
              </div>
            </div>
            <svg viewBox="0 0 160 28" className="w-full h-6 mt-2 overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="kpiGradOrange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#F97316" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M0,21 C26,15 52,8 78,16 C104,22 128,10 148,15 C154,17 157,19 160,21 L160,28 L0,28 Z" fill="url(#kpiGradOrange)" />
              <path d="M0,21 C26,15 52,8 78,16 C104,22 128,10 148,15 C154,17 157,19 160,21" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* KPI 5: Operating Margin % */}
          <div className="relative p-3.5 sm:p-4 pb-2.5 flex flex-col justify-between bg-gradient-to-b from-rose-50/40 via-white to-white border-t-3 border-t-[#E11D48] min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-[#E11D48] text-white flex items-center justify-center shrink-0 shadow-xs ring-4 ring-[#E11D48]/10">
                <Percent className="w-4 h-4 xl:w-5 xl:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                  GROSS MARGIN
                </div>
                <div className="text-sm xl:text-base 2xl:text-lg font-black text-slate-900 font-mono tabular-nums truncate mt-0.5">
                  {executiveMarginPercent}%
                </div>
              </div>
            </div>
            <svg viewBox="0 0 160 28" className="w-full h-6 mt-2 overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="kpiGradRose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E11D48" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M0,20 C24,9 46,21 70,12 C94,6 118,19 140,12 C150,9 155,14 160,18 L160,28 L0,28 Z" fill="url(#kpiGradRose)" />
              <path d="M0,20 C24,9 46,21 70,12 C94,6 118,19 140,12 C150,9 155,14 160,18" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </section>

      {/* Executive Command Header */}
      <section
        aria-label="Executive Command Header"
        className="bg-[#273E56] rounded-xl p-4 sm:p-5 border border-[#1E3247] text-white shadow-sm space-y-4"
      >
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Quick Actions Row */}
            {/* Low-Stock Notification Badge */}
            <button
              type="button"
              data-testid="dashboard-low-stock-badge"
              onClick={() => {
                const el = document.getElementById('dashboard-low-stock-monitor');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold border shadow-xs transition cursor-pointer whitespace-nowrap shrink-0 ${
                lowStockSummary.totalStockStatus === 'critical_low'
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-400/50'
                  : lowStockSummary.totalStockStatus === 'approaching_low'
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/50'
                  : 'bg-[#00B14F]/20 hover:bg-[#00B14F]/30 text-emerald-200 border-[#00B14F]/50'
              }`}
              title={`Total Available Stock: ${lowStockSummary.totalAvailableStockKg.toLocaleString()} KG (Minimum Threshold: ${lowStockSummary.minThresholdKg} KG)`}
            >
              <AlertTriangle
                className={`w-3.5 h-3.5 shrink-0 ${
                  lowStockSummary.totalStockStatus === 'critical_low'
                    ? 'text-rose-400'
                    : lowStockSummary.totalStockStatus === 'approaching_low'
                    ? 'text-amber-400'
                    : 'text-[#00B14F]'
                }`}
              />
              <span>Stock</span>
              <span
                data-testid="dashboard-low-stock-badge-count"
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-black ${
                  lowStockSummary.totalStockStatus === 'critical_low'
                    ? 'bg-rose-500 text-white'
                    : lowStockSummary.totalStockStatus === 'approaching_low'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-[#00B14F] text-white'
                }`}
              >
                {lowStockSummary.totalAvailableStockKg.toLocaleString()} KG
              </span>
            </button>

            {/* View Switcher: Overview vs Monthly Reports */}
            <div className="flex items-center bg-[#1E3247] p-0.5 rounded-lg border border-white/15">
              <button
                type="button"
                onClick={() => setDashboardSubView('overview')}
                className="px-2 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center space-x-1 bg-[#1D6CE0] text-white shadow-xs whitespace-nowrap"
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                data-testid="dashboard-subview-monthly-reports-btn"
                onClick={() => setDashboardSubView('monthly_reports')}
                className="px-2 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center space-x-1 text-slate-200 hover:text-white whitespace-nowrap"
                title="Open Monthly Summary Reports of All Exports and Purchases in CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span>Monthly CSV</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('purchase_form')}
              className="px-2.5 py-1.5 rounded-lg bg-[#1E3247] hover:bg-white/15 text-slate-100 border border-white/15 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + Purchase
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('packing_form')}
              className="px-2.5 py-1.5 rounded-lg bg-[#1D6CE0] hover:bg-[#1558BD] text-white text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + Packing
            </button>
            <button
              type="button"
              data-testid="dashboard-hero-daily-expense-btn"
              onClick={() => setActiveTab('daily_expense')}
              className="px-2.5 py-1.5 rounded-lg bg-[#1E3247] hover:bg-white/15 text-slate-100 border border-white/15 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + Daily Expense
            </button>
            <button
              type="button"
              data-testid="dashboard-download-summary-csv-btn"
              onClick={handleDownloadSummaryCsv}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] text-white border border-white/15 rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
              title="Export high-level dashboard card metrics as a formatted CSV file"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.25] shrink-0" />
              <span>Download Summary CSV</span>
            </button>
            <button
              type="button"
              data-testid="dashboard-open-excel-csv-btn"
              onClick={() => openDataCenterModal('import', 'purchase')}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-[#00B14F] hover:bg-[#009944] text-white rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
              title="Open Excel (.xlsx) & CSV Import / Export Center"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.25] shrink-0" />
              <span>Import / Export</span>
            </button>
        </div>

        {/* Cumulative Executive Ledger Strip inside Hero */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5 pt-5 border-t border-white/15">
          <div className="bg-[#1E3247]/90 rounded-lg p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Cumulative Procurement</span>
              <ShoppingCart className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums mt-1 whitespace-nowrap">
              {formatCurrency(totalPurchaseValue, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-slate-300 font-mono tabular-nums mt-1">
              {totalPurchaseCount} Bills · {totalPurchaseQty.toLocaleString()} KG
            </div>
          </div>

          <div className="bg-[#1E3247]/90 rounded-lg p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Cumulative Export Value</span>
              <Package className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            </div>
            <div
              data-testid="dashboard-cumulative-export-value"
              className="text-lg sm:text-xl font-bold text-emerald-300 font-mono tabular-nums mt-1 whitespace-nowrap"
            >
              {formatCurrency(totalExportValue, 'BDT')}
            </div>
            <div className="text-[11px] text-slate-300 font-mono tabular-nums mt-1">
              Total Amount (BDT) · {totalPackingCount} Manifests · {totalWeight.toLocaleString()} KG ({totalBoxes} Box)
            </div>
          </div>

          <div className="bg-[#1E3247]/90 rounded-lg p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Foreign RMB Remittance</span>
              <TrendingUp className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            </div>
            <div
              data-testid="dashboard-foreign-rmb-remittance"
              className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums mt-1 whitespace-nowrap"
            >
              {formatRMB(totalRmbSettled)}
            </div>
            <div className="text-[11px] text-slate-300 font-mono tabular-nums mt-1">
              Total Value ({formatCurrency(totalRmbSettled, 'RMB')}) · Latest: {latestPackingDate}
            </div>
          </div>
        </div>
      </section>

      {/* Daily Financial Summary + Quick Financial Pulse Companion Sidebar Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-8">
          <DailyFinancialSummaryWidget
            purchases={purchases}
            payments={payments}
            currency={companyProfile.currency || 'BDT'}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        </div>
        <div className="xl:col-span-4">
          <QuickFinancialPulseSidebar
            purchases={purchases}
            payments={payments}
            currency={companyProfile.currency || 'BDT'}
          />
        </div>
      </div>

      {/* Interactive Operations & Ledger Calendar */}
      <DashboardCalendarWidget
        purchases={purchases}
        packings={packings}
        payments={payments}
        otherCosts={otherCosts}
        mortalities={mortalities}
        upcomingRecurringPayments={upcomingRecurringPayments}
        currency={companyProfile.currency || 'BDT'}
        onNavigateTab={setActiveTab}
      />

      {/* Traditional Bangla Panjika Calendar (Tithi, Nakshatra, Hijri, Gregorian & Festivals) */}
      <BanglaPanjikaCalendar />

      {/* Unified Operational & Financial Alerts Widget */}
      <DashboardAlertsWidget totalBalance={totalBalanceSummary.totalBalance} />

      {/* Low-Stock & Minimum Inventory Threshold Notification Panel */}
      <section
        id="dashboard-low-stock-monitor"
        aria-label="Low-Stock Inventory Threshold Alerts"
        data-testid="dashboard-low-stock-section"
        className="bg-white rounded-xl shadow-xs border border-[#CBD8E6] overflow-hidden"
      >
        <div className="bg-[#273E56] text-white px-5 py-3.5 border-b border-[#1E3247] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                lowStockSummary.totalStockStatus === 'critical_low'
                  ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                  : lowStockSummary.totalStockStatus === 'approaching_low'
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-[#00897b]/25 border-[#00897b]/50 text-[#80cbc4]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide text-white whitespace-nowrap">
                  Inventory &amp; Mortality Stock Monitor
                </h2>
                <span
                  data-testid="low-stock-total-available-pill"
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#1c2a33] text-[#5eead4] border border-[#00897b]/40 whitespace-nowrap"
                >
                  Total Available: {lowStockSummary.totalAvailableStockKg.toLocaleString()} KG
                </span>
                <span
                  data-testid="low-stock-mortality-pill"
                  className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-600 text-white whitespace-nowrap flex items-center gap-1"
                >
                  <HeartCrack className="w-3 h-3 text-rose-200" />
                  <span>Mortality Loss: -{lowStockSummary.totalMortalityKg} KG</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Live total available inventory across all species: <strong className="font-mono text-[#5eead4]">{lowStockSummary.totalPurchasedKg} KG Procured</strong> − <strong className="font-mono text-[#7dd3fc]">{lowStockSummary.totalExportedKg} KG Exported</strong> − <strong className="font-mono text-rose-300">{lowStockSummary.totalMortalityKg} KG Mortality</strong> = <strong className="font-mono text-white">{lowStockSummary.totalAvailableStockKg} KG Available</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="toggle-mortality-log-btn"
              onClick={() => setShowMortalityLog((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                showMortalityLog
                  ? 'bg-[#00897b] border-[#00897b] text-white shadow-xs'
                  : 'bg-[#1c2a33] hover:bg-white/15 text-slate-200 border-white/15'
              }`}
              title="Toggle dedicated Mortality Log section"
            >
              <HeartCrack className="w-3.5 h-3.5" />
              <span>Mortality Log ({mortalities.length})</span>
            </button>

            <button
              type="button"
              data-testid="print-monthly-mortality-report-btn"
              onClick={handleOpenMonthlyMortalityReport}
              className="px-2.5 py-1.5 rounded-lg bg-[#1c2a33] hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs"
              title="Generate printable summary of all mortality events recorded in the current month"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Mortality Report</span>
            </button>

            <button
              type="button"
              data-testid="low-stock-restock-btn"
              onClick={() => setActiveTab('purchase_form')}
              className="px-2.5 py-1.5 rounded-lg bg-[#1877d2] hover:bg-[#1565c0] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + Restock
            </button>
          </div>
        </div>

        {/* Total Available Stock Hero & Balance Breakdown */}
        <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-200 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Primary Total Available Stock Hero Card */}
            <div
              data-testid="total-available-stock-hero-card"
              className={`lg:col-span-5 rounded-xl p-5 sm:p-6 border flex flex-col justify-between shadow-xs transition ${
                lowStockSummary.totalStockStatus === 'critical_low'
                  ? 'bg-rose-50/70 border-rose-300'
                  : lowStockSummary.totalStockStatus === 'approaching_low'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-emerald-50/70 border-emerald-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        lowStockSummary.totalStockStatus === 'critical_low'
                          ? 'bg-rose-500 animate-ping'
                          : lowStockSummary.totalStockStatus === 'approaching_low'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Total Available Stock
                    </span>
                  </div>
                  <span
                    data-testid="total-stock-status-badge"
                    className={`px-2.5 py-1 rounded text-xs font-black uppercase tracking-wide whitespace-nowrap shadow-2xs ${
                      lowStockSummary.totalStockStatus === 'critical_low'
                        ? 'bg-rose-600 text-white'
                        : lowStockSummary.totalStockStatus === 'approaching_low'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {lowStockSummary.totalAvailableStockKg > 0 ? 'Available in Stock' : 'Out of Stock'}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <div
                    data-testid="total-available-stock-kg"
                    className={`text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight tabular-nums ${
                      lowStockSummary.totalStockStatus === 'critical_low'
                        ? 'text-rose-700'
                        : lowStockSummary.totalStockStatus === 'approaching_low'
                        ? 'text-amber-800'
                        : 'text-emerald-700'
                    }`}
                  >
                    {lowStockSummary.totalAvailableStockKg.toLocaleString()}
                  </div>
                  <div className="text-lg sm:text-2xl font-black font-mono text-slate-600">KG</div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-600 font-mono">
                Net Live Inventory = Procured − Exported − Mortality
              </div>
            </div>

            {/* 3-Metric Inflow, Outflow & Mortality Loss Breakdown Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Procured / Inflow */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold uppercase tracking-wider text-[11px]">Total Procured</span>
                  <ShoppingCart className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="mt-2">
                  <div
                    data-testid="total-procured-kg"
                    className="text-xl sm:text-2xl font-black font-mono text-slate-900 tabular-nums"
                  >
                    {lowStockSummary.totalPurchasedKg.toLocaleString()} <span className="text-xs text-slate-500">KG</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Supplier Purchases · {totalPurchaseCount} Bills
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold font-mono">Stock Inflow (+)</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('purchase_form')}
                    className="text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    + Add Purchase
                  </button>
                </div>
              </div>

              {/* Exported / Outflow */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold uppercase tracking-wider text-[11px]">Total Exported</span>
                  <Plane className="w-4 h-4 text-teal-600 shrink-0" />
                </div>
                <div className="mt-2">
                  <div
                    data-testid="total-exported-kg"
                    className="text-xl sm:text-2xl font-black font-mono text-slate-900 tabular-nums"
                  >
                    {lowStockSummary.totalExportedKg.toLocaleString()} <span className="text-xs text-slate-500">KG</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Air-Freight Exports · {totalPackingCount} Manifests
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-teal-700 font-semibold font-mono">Stock Outflow (−)</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('packing_form')}
                    className="text-teal-600 hover:text-teal-800 font-bold underline cursor-pointer"
                  >
                    + Packing List
                  </button>
                </div>
              </div>

              {/* Mortality Loss / Stock Adjustment */}
              <div className="bg-white rounded-xl p-4 border border-purple-200 shadow-2xs flex flex-col justify-between bg-gradient-to-br from-white to-purple-50/40">
                <div className="flex items-center justify-between text-xs text-purple-900">
                  <span className="font-bold uppercase tracking-wider text-[11px]">Mortality Loss</span>
                  <HeartCrack className="w-4 h-4 text-purple-600 shrink-0" />
                </div>
                <div className="mt-2">
                  <div
                    data-testid="total-mortality-kg"
                    className="text-xl sm:text-2xl font-black font-mono text-purple-800 tabular-nums"
                  >
                    -{lowStockSummary.totalMortalityKg.toLocaleString()} <span className="text-xs text-purple-600">KG</span>
                  </div>
                  <div className="text-[11px] text-purple-700/90 mt-0.5">
                    Stock Adjustment · {mortalities.length} Incidents
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-purple-100 flex items-center justify-between text-[11px]">
                  <span className="text-purple-700 font-semibold font-mono">Loss Adjustment (−)</span>
                  <button
                    type="button"
                    data-testid="record-mortality-quick-btn"
                    onClick={() => {
                      setShowMortalityLog(true);
                      const el = document.getElementById('inventory-mortality-log-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className="text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                  >
                    - Record Loss
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Formula calculation banner */}
          <div className="bg-[#273E56] text-white rounded-lg px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#1c2a33] text-[#5eead4] font-bold uppercase text-[10px]">
                Inventory Formula
              </span>
              <span className="text-slate-200">
                Total Available Stock = Total Procured ({lowStockSummary.totalPurchasedKg} KG) − Total Exported ({lowStockSummary.totalExportedKg} KG) − Total Mortality ({lowStockSummary.totalMortalityKg} KG)
              </span>
            </div>
            <div className="text-right text-[#5eead4] font-bold whitespace-nowrap">
              = {lowStockSummary.totalAvailableStockKg.toLocaleString()} KG
            </div>
          </div>
        </div>

        {/* Dedicated Mortality Log & Stock Adjustment Section */}
        {showMortalityLog && (
          <div
            id="inventory-mortality-log-section"
            data-testid="inventory-mortality-log-section"
            className="border-t-2 border-purple-200 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/80 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <HeartCrack className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      Mortality Log &amp; Stock Adjustment
                    </h3>
                    <span
                      data-testid="mortality-total-loss-badge"
                      className="px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-purple-700 text-white"
                    >
                      Total Mortality Loss: -{lowStockSummary.totalMortalityKg} KG
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-300">
                      {mortalities.length} Incident{mortalities.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Tracks species, loss quantity, and mortality date to automatically update inventory stock adjustment levels and threshold alerts.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="print-monthly-mortality-report-section-btn"
                  onClick={handleOpenMonthlyMortalityReport}
                  className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Generate printable summary of all mortality events recorded in the current month"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Month Report</span>
                </button>
                <div className="text-xs text-purple-950 font-mono bg-purple-100/80 px-3 py-1.5 rounded-lg border border-purple-200">
                  Formula: <strong>Available Stock = Procured − Exported − Mortality</strong>
                </div>
              </div>
            </div>

            {/* Entry Form + History Table Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Interactive Record Mortality Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const cleanSpecies = mortalitySpecies.trim().toUpperCase();
                  const parsedQty = parseFloat(mortalityQty);
                  if (!cleanSpecies) {
                    showToast('Please select or specify a seafood species / grade.');
                    return;
                  }
                  if (isNaN(parsedQty) || parsedQty <= 0) {
                    showToast('Please enter a valid mortality quantity in KG (greater than 0).');
                    return;
                  }
                  if (!mortalityDate) {
                    showToast('Please select the date of mortality.');
                    return;
                  }

                  addMortality({
                    species: cleanSpecies,
                    quantityKg: Math.round(parsedQty * 100) / 100,
                    date: mortalityDate,
                    cause: mortalityCause,
                    notes: mortalityNotes.trim() || undefined,
                  });

                  setMortalityQty('');
                  setMortalityNotes('');
                }}
                data-testid="mortality-entry-form"
                className="lg:col-span-4 bg-white p-4 rounded-xl border border-purple-200 shadow-xs space-y-3"
              >
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <PlusCircle className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-black uppercase text-slate-900 tracking-wide">
                    Record Species Mortality
                  </span>
                </div>

                {/* Species / Grade Selection */}
                <div>
                  <label
                    htmlFor="mortality-species-select"
                    className="block text-[11px] font-bold text-slate-700 mb-1 uppercase"
                  >
                    Species / Grade *
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      id="mortality-species-select"
                      data-testid="mortality-species-select"
                      value={mortalitySpecies}
                      onChange={(e) => setMortalitySpecies(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg focus:ring-1 focus:ring-purple-500 bg-purple-50/30 font-bold text-slate-900"
                    >
                      <option value="">-- Select Grade / Species --</option>
                      {Array.from(
                        new Set([
                          ...dropdownOptions.purchaseItems,
                          ...lowStockSummary.allItems.map((i) => i.item),
                          ...mortalities.map((m) => m.species),
                        ])
                      )
                        .filter(Boolean)
                        .sort()
                        .map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or type..."
                      value={mortalitySpecies}
                      onChange={(e) => setMortalitySpecies(e.target.value)}
                      className="w-24 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-bold uppercase"
                      title="Or type custom species grade"
                    />
                  </div>
                </div>

                {/* Quantity (KG) and Date */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="mortality-qty-input"
                      className="block text-[11px] font-bold text-slate-700 mb-1 uppercase"
                    >
                      Loss Qty (KG) *
                    </label>
                    <input
                      id="mortality-qty-input"
                      data-testid="mortality-qty-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 5.50"
                      value={mortalityQty}
                      onChange={(e) => setMortalityQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-mono font-black text-rose-700 bg-purple-50/20"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mortality-date-input"
                      className="block text-[11px] font-bold text-slate-700 mb-1 uppercase"
                    >
                      Date *
                    </label>
                    <input
                      id="mortality-date-input"
                      data-testid="mortality-date-input"
                      type="date"
                      value={mortalityDate}
                      onChange={(e) => setMortalityDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-mono text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Cause / Reason */}
                <div>
                  <label
                    htmlFor="mortality-cause-select"
                    className="block text-[11px] font-bold text-slate-700 mb-1 uppercase"
                  >
                    Cause / Reason
                  </label>
                  <select
                    id="mortality-cause-select"
                    data-testid="mortality-cause-select"
                    value={mortalityCause}
                    onChange={(e) => setMortalityCause(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 bg-white text-slate-800"
                  >
                    <option value="Tank Acclimation Stress">Tank Acclimation Stress</option>
                    <option value="Transit Damage & DOA">Transit Damage &amp; DOA</option>
                    <option value="Water Quality Issue">Water Quality Issue</option>
                    <option value="Handling Shortage">Handling Shortage</option>
                    <option value="Disease / Pathogen Loss">Disease / Pathogen Loss</option>
                    <option value="Other Mortality">Other Mortality</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor="mortality-notes-input"
                    className="block text-[11px] font-bold text-slate-700 mb-1 uppercase"
                  >
                    Notes / Location Details
                  </label>
                  <input
                    id="mortality-notes-input"
                    data-testid="mortality-notes-input"
                    type="text"
                    placeholder="e.g. Tank 2 saline conditioning loss"
                    value={mortalityNotes}
                    onChange={(e) => setMortalityNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="submit-mortality-btn"
                  className="w-full py-2 px-3 rounded-lg bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white font-bold text-xs uppercase tracking-wide shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <HeartCrack className="w-3.5 h-3.5" />
                  <span>Record Mortality &amp; Adjust Stock</span>
                </button>
              </form>

              {/* Right Column: Mortality Log History Table */}
              <div
                data-testid="mortality-log-table-container"
                className="lg:col-span-8 bg-white rounded-xl border border-purple-200 shadow-xs overflow-hidden"
              >
                <div className="bg-purple-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-purple-950">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-purple-300" />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      Mortality History &amp; Stock Deduction Ledger
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-purple-200">
                    {mortalities.length} Total Records
                  </span>
                </div>

                <div className="p-2.5 bg-purple-50/30">
                  <div className="overflow-x-auto border-2 border-purple-200 rounded-lg bg-white">
                  <table
                    data-testid="mortality-history-table"
                    className="w-full text-left text-xs"
                  >
                    <thead className="bg-purple-50/95 text-purple-950 font-bold uppercase text-[10px] border-b border-purple-200">
                      <tr>
                        <th className="p-2.5 w-12 text-center">SL #</th>
                        <th className="p-2.5">DATE</th>
                        <th className="p-2.5">SPECIES / GRADE</th>
                        <th className="p-2.5 text-right">MORTALITY LOSS</th>
                        <th className="p-2.5">CAUSE / REASON</th>
                        <th className="p-2.5">NOTES</th>
                        <th className="p-2.5">STOCK ADJUSTMENT IMPACT</th>
                        <th className="p-2.5 text-center">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100 font-medium">
                      {mortalities.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                            No mortality events recorded yet. Use the form on the left to record mortality losses.
                          </td>
                        </tr>
                      ) : (
                        [...mortalities]
                          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                          .map((mort, idx) => (
                            <tr
                              key={mort.id}
                              data-testid={`mortality-row-${mort.id}`}
                              className="hover:bg-purple-50/40 transition"
                            >
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                              </td>
                              <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                                {formatDate(mort.date)}
                              </td>
                              <td className="p-2.5">
                                <span className="font-mono font-bold text-purple-950 bg-purple-100/70 px-2 py-0.5 rounded text-[11px]">
                                  {mort.species}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono font-black text-rose-700 whitespace-nowrap">
                                -{mort.quantityKg} KG
                              </td>
                              <td className="p-2.5 text-slate-800 text-[11px]">
                                {mort.cause || '-'}
                              </td>
                              <td className="p-2.5 text-slate-600 text-[11px] max-w-[180px] truncate" title={mort.notes}>
                                {mort.notes || '-'}
                              </td>
                              <td className="p-2.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 whitespace-nowrap">
                                  Deducted {mort.quantityKg} KG from {mort.species}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  data-testid={`delete-mortality-btn-${mort.id}`}
                                  onClick={() => deleteMortality(mort.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                  title={`Delete mortality record for ${mort.species} (${mort.quantityKg} KG)`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Upcoming Recurring Supplier Payments Highlight Section */}
      <section
        aria-label="Upcoming Recurring Supplier Payments"
        data-testid="upcoming-recurring-payments-section"
        className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden"
      >
        <div className="bg-[#273E56] text-white px-5 py-3.5 border-b border-[#1d2c35] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#00897b]/25 border border-[#00897b]/50 flex items-center justify-center shrink-0">
              <Repeat className="w-4 h-4 text-[#5eead4]" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide text-white">
                  Upcoming Recurring Supplier Payments
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#00897b] text-white">
                  {recurringSummary.totalScheduledCount} Scheduled
                </span>
                {recurringSummary.urgentCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500 text-white flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{recurringSummary.urgentCount} Urgent</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Auto-scanned from Supplier Payment Vouchers with future due dates &amp; recurring schedules
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter upcoming recurring payments"
              className="flex items-center gap-1 bg-[#1c2a33] p-1 rounded-lg border border-white/15"
            >
              {(
                [
                  { id: 'all', label: `All (${upcomingRecurringPayments.length})` },
                  { id: 'urgent_7d', label: `Due ≤ 7d (${recurringSummary.dueWithin7DaysCount})` },
                  { id: 'weekly', label: 'Weekly / Bi-Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRecurringFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    recurringFilter === tab.id
                      ? 'bg-[#00897b] text-white font-bold'
                      : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('payment_form')}
              className="px-3 py-1.5 rounded-lg bg-[#1877d2] hover:bg-[#1565c0] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + Schedule Payment
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-amber-50/35 border-b border-slate-200">
          <div className="p-3.5 px-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Upcoming Commitment
              </div>
              <div
                data-testid="recurring-total-upcoming-amount"
                className="text-lg font-black font-mono tabular-nums text-slate-900 mt-0.5"
              >
                {formatCurrency(recurringSummary.totalUpcomingAmount, companyProfile.currency)}
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
              {recurringSummary.totalScheduledCount} Vouchers
            </span>
          </div>

          <div className="p-3.5 px-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Due Within Next 7 Days
              </div>
              <div
                data-testid="recurring-due-7d-amount"
                className="text-lg font-black font-mono tabular-nums text-rose-700 mt-0.5"
              >
                {formatCurrency(recurringSummary.dueWithin7DaysAmount, companyProfile.currency)}
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-rose-800 bg-rose-100/80 border border-rose-200 px-2.5 py-1 rounded-md">
              {recurringSummary.dueWithin7DaysCount} Due Soon
            </span>
          </div>

          <div className="p-3.5 px-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Active Recurring Suppliers
              </div>
              <div className="text-lg font-black font-mono tabular-nums text-teal-800 mt-0.5">
                {recurringSummary.uniqueSuppliersCount} Suppliers
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('payment_db')}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Payment DB</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Highlighted Upcoming Recurring Payment Cards / Rows */}
        {filteredRecurringPayments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <div className="font-semibold text-slate-700">
              No upcoming recurring supplier payments match this filter.
            </div>
            <p>
              Set a future Next Due Date in the Supplier Payment Form (Sheet 05) to automatically track upcoming supplier installments here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/90">
            {filteredRecurringPayments.map((item) => {
              const isUrgent = item.urgency === 'due_today' || item.urgency === 'urgent';
              const isUpcoming = item.urgency === 'upcoming';

              return (
                <div
                  key={item.id}
                  data-testid={`recurring-payment-item-${item.id}`}
                  className={`p-4 px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition ${
                    isUrgent
                      ? 'bg-rose-50/40 hover:bg-rose-50/70'
                      : isUpcoming
                      ? 'bg-amber-50/40 hover:bg-amber-50/70'
                      : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Urgency Badge */}
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                        isUrgent
                          ? 'bg-rose-100 border-rose-300 text-rose-900'
                          : isUpcoming
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.urgencyLabel}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {item.supplierName}
                        </span>
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {item.invoiceNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                          <Repeat className="w-3 h-3" />
                          <span>{item.frequencyLabel}</span>
                        </span>
                        {item.contactNumber && (
                          <span className="text-xs font-mono text-slate-500">
                            {item.contactNumber}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{item.remarks}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono font-semibold text-slate-800">
                          Due Date: {formatDate(item.dueDate)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono text-slate-500">
                          Next Cycle: {formatDate(item.nextProjectedDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/70">
                    <div className="text-left lg:text-right mr-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Scheduled Installment
                      </div>
                      <div className="text-base font-black font-mono tabular-nums text-slate-900">
                        {formatCurrency(item.amountDue, companyProfile.currency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`settle-recurring-btn-${item.id}`}
                        onClick={() => handleAdvanceRecurringCycle(item)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap"
                        title={`Mark ${formatDate(item.dueDate)} installment paid and advance due date to ${formatDate(item.nextProjectedDate)}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settle &amp; Roll Cycle</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openPrintModal({
                            type: 'payment',
                            title: `Supplier Payment Voucher - ${item.invoiceNumber}`,
                            data: item.rawRecord,
                            items: item.rawRecord.items,
                          })
                        }
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 transition inline-flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>View PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Packing List Export Weight & Consignments Summary Section */}
      <section
        aria-label="Packing List Export Weight and Consignments Summary"
        data-testid="dashboard-export-consignments-summary"
        className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden"
      >
        <div className="bg-[#273E56] text-white px-5 py-3.5 border-b border-[#1d2c35] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Scale className="w-4 h-4 text-[#5eead4] shrink-0" />
            <h2 className="text-sm font-bold tracking-wide text-white">
              Packing List Export Consignments &amp; Weight Summary
            </h2>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="text-xs text-slate-300 font-mono tabular-nums">
              Synced from Sheet 09 (Packing List Database)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('packing_form')}
              className="px-3 py-1.5 rounded-md bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              + New Consignment Manifest
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('packing_db')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1c2a33] hover:bg-white/15 text-slate-200 border border-white/15 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <span>Open Packing List DB</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#5eead4]" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* Card 1: Total Cumulative Export Weight */}
          <div className="p-4 sm:p-5 bg-teal-50/35">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Total Cumulative Export Weight</span>
              <Scale className="w-4 h-4 text-teal-700 shrink-0" />
            </div>
            <div
              data-testid="dashboard-summary-cumulative-export-weight"
              className="text-2xl sm:text-3xl font-black text-teal-900 font-mono tabular-nums mt-1.5 tracking-tight"
            >
              {consignmentSummary.totalCumulativeWeightKg.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-sm font-bold text-teal-700">KG</span>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums mt-1.5">
              Avg {consignmentSummary.avgWeightPerBoxKg.toLocaleString()} KG / Carton · Net Air-Freight Weight
            </div>
          </div>

          {/* Card 2: Total Consignments Processed */}
          <div className="p-4 sm:p-5 bg-white">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Consignments Processed</span>
              <Plane className="w-4 h-4 text-sky-700 shrink-0" />
            </div>
            <div
              data-testid="dashboard-summary-consignments-processed"
              className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums mt-1.5 tracking-tight"
            >
              {consignmentSummary.totalConsignments.toLocaleString()}{' '}
              <span className="text-sm font-bold text-slate-500">
                {consignmentSummary.totalConsignments === 1 ? 'Consignment' : 'Consignments'}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums mt-1.5">
              {consignmentSummary.paidConsignmentsCount} Settled (PAID) · {consignmentSummary.pendingConsignmentsCount} Open / Report
            </div>
          </div>

          {/* Card 3: Total Shipped Cartons / Boxes */}
          <div className="p-4 sm:p-5 bg-white">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Total Export Cartons Shipped</span>
              <Package className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
            <div
              data-testid="dashboard-summary-total-export-boxes"
              className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums mt-1.5 tracking-tight"
            >
              {consignmentSummary.totalBoxes.toLocaleString()}{' '}
              <span className="text-sm font-bold text-slate-500">Boxes</span>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums mt-1.5">
              {consignmentSummary.uniqueShippingMarksCount} Active Shipping {consignmentSummary.uniqueShippingMarksCount === 1 ? 'Mark' : 'Marks'}
            </div>
          </div>

          {/* Card 4: Average Weight per Consignment & Latest Dispatch */}
          <div className="p-4 sm:p-5 bg-white">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Average Consignment Weight</span>
              <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
            </div>
            <div
              data-testid="dashboard-summary-avg-consignment-weight"
              className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums mt-1.5 tracking-tight"
            >
              {consignmentSummary.avgWeightPerConsignmentKg.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-sm font-bold text-slate-500">KG / Shipment</span>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums mt-1.5 truncate">
              {consignmentSummary.latestConsignmentDate
                ? `Latest: ${consignmentSummary.latestInvoiceNumber || 'Manifest'} (${formatDate(consignmentSummary.latestConsignmentDate)})`
                : 'No packing manifests recorded yet'}
            </div>
          </div>
        </div>
      </section>

      {/* Current Month Financial Summary (Total Purchases, Total Export Value, Net Profit) */}
      <MonthlySummaryCard onOpenMonthlyReports={() => setDashboardSubView('monthly_reports')} />

      {/* 6-Month Profit & Loss Area Chart (Monthly Revenue vs. Monthly Costs) */}
      <ProfitLossTrendChart />

      {/* Monthly Performance Summary Widget (Side-by-Side Comparison of Total Monthly Purchases vs. Total Monthly Payments Bar Chart) */}
      <MonthlyPerformanceSummaryWidget />

      {/* Top 5 Suppliers by Total Purchase Volume (Recharts BarChart & Leaderboard) */}
      <TopSuppliersChart />

      {/* All Supplier List · Total Purchase & Total Due Report History */}
      <DashboardAllSuppliersReport />

      {/* Main Two-Column Split: Workbook Data Entry Modules (7 Cols) & Ledger Database Status (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Workbook Data Entry & Settlement Modules */}
        <section
          aria-label="Workbook Data Entry Modules"
          className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-700 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900">
                  Data Entry &amp; Settlement Sheets
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Sheets 02 – 18
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Sheet 02: Purchase Challan / Bill */}
              <button
                type="button"
                onClick={() => setActiveTab('purchase_form')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-sky-600/70 bg-white hover:bg-sky-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 02 · Procurement</span>
                    <span className="text-sky-700 font-semibold">{totalPurchaseCount} Saved</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-sky-800 mt-1 flex items-center justify-between">
                    <span>Purchase Challan / Bill</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Record local live fish grades, weight (KG), and supplier balance.
                  </p>
                </div>
              </button>

              {/* Sheet 03: Packing List Form */}
              <button
                type="button"
                onClick={() => setActiveTab('packing_form')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-teal-600/70 bg-white hover:bg-teal-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 03 · Export Manifest</span>
                    <span className="text-teal-700 font-semibold">{totalPackingCount} Saved</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-teal-800 mt-1 flex items-center justify-between">
                    <span>Export Packing List</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Log air-freight shipping marks, carton counts, and net weight.
                  </p>
                </div>
              </button>

              {/* Sheet 04: Exporter Payment Form */}
              <button
                type="button"
                onClick={() => setActiveTab('exporter_payment_form')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-teal-700/70 bg-white hover:bg-teal-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 04 · Foreign Buyers</span>
                    <span className="text-teal-800 font-semibold">{exporterPaymentCount} Vouchers</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-teal-900 mt-1 flex items-center justify-between">
                    <span>Exporter Payment Form</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Record foreign buyer RMB return settlements and export claims.
                  </p>
                </div>
              </button>

              {/* Sheet 05: Supplier Payment Form */}
              <button
                type="button"
                onClick={() => setActiveTab('payment_form')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-600/70 bg-white hover:bg-indigo-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 05 · Local Ledger</span>
                    <span className="text-indigo-700 font-semibold">{supplierPaymentCount} Vouchers</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-800 mt-1 flex items-center justify-between">
                    <span>Supplier Payment Form</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Disburse cash or bank payments to local suppliers in BDT.
                  </p>
                </div>
              </button>

              {/* Sheet 06: FLIGHT RETURN BILL */}
              <button
                type="button"
                onClick={() => setActiveTab('air_way_bill')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-sky-600/70 bg-white hover:bg-sky-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 06 · Air Freight</span>
                    <span className="text-sky-800 font-semibold">Monthly Statement</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-sky-900 mt-1 flex items-center justify-between">
                    <span>FLIGHT RETURN BILL</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Air freight return bill calculations with RMB/Per Box, rates, and BDT totals.
                  </p>
                </div>
              </button>

              {/* Sheet 07: Exporter Payment Slip (付款单) */}
              <button
                type="button"
                onClick={() => setActiveTab('exporter_payment_slip')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-amber-600/70 bg-white hover:bg-amber-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 07 · Bilingual Slip</span>
                    <span className="text-amber-800 font-semibold">Auto-Synced</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-amber-900 mt-1 flex items-center justify-between">
                    <span>Exporter Payment Slip 付款单</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Filter by Shipping Mark &amp; Packing Date to print official 付款单.
                  </p>
                </div>
              </button>

              {/* Sheet 17: TOTAL BALANCE */}
              <button
                type="button"
                data-testid="dashboard-sheet-total-balance-btn"
                onClick={() => setActiveTab('total_balance')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-600/70 bg-white hover:bg-emerald-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 17 · Capital &amp; Cash</span>
                    <span className="text-emerald-700 font-semibold">
                      {formatCurrency(totalBalanceSummary.totalBalance, companyProfile.currency)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 mt-1 flex items-center justify-between">
                    <span>TOTAL BALANCE</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Partner deposit shares + income added &minus; all costing deductions.
                  </p>
                </div>
              </button>

              {/* Sheet 18: DAILY EXPENSE */}
              <button
                type="button"
                data-testid="dashboard-sheet-daily-expense-btn"
                onClick={() => setActiveTab('daily_expense')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-amber-600/70 bg-white hover:bg-amber-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 18 · Company Expense</span>
                    <span className="text-amber-800 font-semibold">
                      Today: {formatCurrency(dailyExpenseSummary.todayTotal, companyProfile.currency)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-amber-900 mt-1 flex items-center justify-between">
                    <span>DAILY EXPENSE</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Log daily office, utilities, petty cash &amp; company operating expenses ({dailyExpenseSummary.allTimeCount} entries).
                  </p>
                </div>
              </button>

              {/* Sheet 13: Settings & Config */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-slate-500 bg-white hover:bg-slate-50 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 13 · Configuration</span>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1 flex items-center justify-between">
                    <span>Settings &amp; Master Lists</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage dropdown presets, company profile, and RMB exchange rate.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>All data entry sheets enforce required field and numeric validation before PDF archive.</span>
            <button
              type="button"
              onClick={() => setActiveTab('search_reports')}
              className="text-slate-800 hover:text-sky-700 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Open Search &amp; Reports (Sheet 12)</span>
            </button>
          </div>
        </section>

        {/* Right 5 Cols: Live Database Tables & Ledger Rollup */}
        <section
          aria-label="Live Database Summary"
          className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Database Archives &amp; Financial Rollup
              </h2>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Sheets 07 – 10
              </span>
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              {/* Row 1: Purchase DB */}
              <div className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    Purchase Database (Sheet 08)
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                    {totalPurchaseCount} Saved · Latest: {latestPurchaseDate}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                    {formatCurrency(totalPurchaseValue, companyProfile.currency)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('purchase_db')}
                    className="text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>Open Purchase DB</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Packing DB */}
              <div className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    Packing List Database (Sheet 09)
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                    {totalPackingCount} Saved · Total Value: {formatCurrency(totalRmbSettled, 'RMB')} · Latest: {latestPackingDate}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    data-testid="dashboard-packing-db-total-bdt"
                    className="font-mono tabular-nums font-bold text-teal-800 text-sm"
                  >
                    {formatCurrency(totalExportValue, 'BDT')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('packing_db')}
                    className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>Open Packing DB</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 3: Payment DB */}
              <div className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    Payment Vouchers Database (Sheet 10)
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                    {totalPaymentCount} Saved ({supplierPaymentCount} Sup · {exporterPaymentCount} Exp) · {latestPaymentDate}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                    {formatCurrency(totalPaymentsMade, companyProfile.currency)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('payment_db')}
                    className="text-indigo-700 hover:text-indigo-900 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>Open Payment DB</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 4: Profit & Loss Analysis */}
              <div className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    Loss &amp; Profit Analysis (Sheet 07)
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                    Gross Margin &amp; Operating Cost Breakdown
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums font-bold text-emerald-700 text-sm">
                    {formatCurrency(totalExportValue - totalPurchaseValue, companyProfile.currency)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profit_loss')}
                    className="text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>View P&amp;L Sheet</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 4b: TOTAL BALANCE */}
              <div className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    TOTAL BALANCE (Sheet 17)
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                    Partner Shares ({partnerDeposits.length}) + Income &minus; All Costing
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono tabular-nums font-bold text-sm ${
                      totalBalanceSummary.totalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatCurrency(totalBalanceSummary.totalBalance, companyProfile.currency)}
                  </div>
                  <button
                    type="button"
                    data-testid="dashboard-open-total-balance-btn"
                    onClick={() => setActiveTab('total_balance')}
                    className="text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>Open TOTAL BALANCE</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 4c: DAILY EXPENSE */}
              <div className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    DAILY EXPENSE (Sheet 18)
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                    {dailyExpenseSummary.allTimeCount} Entries · Month: {formatCurrency(dailyExpenseSummary.selectedMonthTotal, companyProfile.currency)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums font-bold text-rose-700 text-sm">
                    {formatCurrency(dailyExpenseSummary.allTimeTotal, companyProfile.currency)}
                  </div>
                  <button
                    type="button"
                    data-testid="dashboard-open-daily-expense-btn"
                    onClick={() => setActiveTab('daily_expense')}
                    className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>Open DAILY EXPENSE</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 5: Search & Audit Reports */}
              <div className="p-4 bg-slate-50/50 hover:bg-slate-50 transition flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    Search &amp; Audit Reports (Sheet 11)
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                    {totalPurchaseCount + totalPackingCount + totalPaymentCount} Total Vouchers · Date &amp; Party Filter
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums font-bold text-amber-700 text-sm">
                    {formatRMB(totalRmbSettled)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('search_reports')}
                    className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>Open Audit Search</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition">
                <div>
                  <div className="font-semibold text-slate-800">
                    Sheet 13 · System Audit Logs
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    Tracks administrator entries, edits, deletions &amp; security events
                  </div>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    data-testid="dashboard-open-audit-logs-btn"
                    onClick={() => setActiveTab('audit_logs')}
                    className="text-slate-900 hover:text-amber-700 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Open Audit Logs</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Standard Operating Workflow Summary */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">
              Standard Audit Workflow
            </div>
            <p className="text-slate-500 leading-relaxed">
              01. Enter voucher or manifest rows · 02. Verify auto-calculated totals &amp; balances · 03. Click Save (PDF) to archive and print official signed document.
            </p>
          </div>
        </section>
      </div>

      {/* Recent System Activities (Live Audit Trail with Client-Side Filter) */}
      <section
        aria-label="Recent System Activities"
        className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-[#273E56] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold tracking-wide text-white">
              Recent System Activities
            </h2>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="text-xs text-slate-300">
              Latest archived vouchers and manifests across all ledgers
            </span>
          </div>

          {/* Interactive Activity Filter */}
          <div
            role="group"
            aria-label="Filter recent activities"
            className="flex items-center gap-1 bg-[#1c2a33] p-1 rounded-lg border border-white/15"
          >
            {(['ALL', 'Purchase', 'Packing', 'Payment'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActivityFilter(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activityFilter === tab
                    ? 'bg-[#00897b] text-white font-bold'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                {tab === 'ALL' ? 'All Records' : `${tab}s`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-slate-50/70">
          <div
            data-testid="recent-activities-scroll-box"
            className="overflow-x-auto border-2 border-slate-200 rounded-lg bg-white"
          >
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-12 text-center">SL #</th>
                <th className="px-4 py-3">Ledger Type</th>
                <th className="px-4 py-3">Voucher / Document No.</th>
                <th className="px-4 py-3">Supplier / Shipping Mark</th>
                <th className="px-4 py-3">Volume / Settlement Info</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount ({companyProfile.currency})</th>
                <th className="px-4 py-3 text-right">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 font-medium">
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No matching records found for this filter.
                  </td>
                </tr>
              ) : (
                recentActivities.map((act, idx) => (
                  <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          act.type === 'Purchase'
                            ? 'text-sky-800'
                            : act.type === 'Packing'
                            ? 'text-teal-800'
                            : 'text-indigo-800'
                        }`}
                      >
                        {act.categoryLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {act.docId}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-semibold">
                      {act.party}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono tabular-nums whitespace-nowrap">
                      {act.detail}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono tabular-nums whitespace-nowrap">
                      {formatDate(act.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(act.amount, companyProfile.currency)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (act.type === 'Purchase') {
                            openPrintModal({
                              type: 'purchase',
                              title: `Purchase Challan - ${act.docId}`,
                              data: act.raw,
                              items: act.raw.items,
                            });
                          } else if (act.type === 'Packing') {
                            openPrintModal({
                              type: 'packing',
                              title: `Packing List - ${act.docId}`,
                              data: act.raw,
                              items: act.raw.items,
                            });
                          } else {
                            openPrintModal({
                              type: 'payment',
                              title: `Payment Voucher - ${act.docId}`,
                              data: act.raw,
                              items: act.raw.items,
                            });
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 transition inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>View PDF</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
};
