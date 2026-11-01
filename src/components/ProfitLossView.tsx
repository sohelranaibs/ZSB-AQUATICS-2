import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calculateProfitLoss, formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  calculateProfitLossMonthlyTrends,
  TrendWindowMode,
  ProfitLossMonthlyTrendPoint,
} from '../utils/profitLossTrends.ts';
import {
  calculateSupplierPerformance,
  SupplierPerformanceWindow,
  SupplierPerformanceMetric,
} from '../utils/supplierPerformance.ts';
import {
  SUPPLIER_CREDIT_REASONS,
  calculateSupplierCreditSummary,
} from '../utils/supplierCredits.ts';
import { calculateDailyProfitLossReport } from '../utils/dailyProfitLoss.ts';
import { DailyProfitLossSection } from './DailyProfitLossSection.tsx';
import { SupplierCreditRecord } from '../types/index.ts';
import {
  ComposedChart,
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Printer,
  Package,
  ShoppingCart,
  Receipt,
  Scale,
  BarChart3,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  BadgePercent,
  CheckCircle2,
} from 'lucide-react';

export const ProfitLossView: React.FC = () => {
  const {
    companyProfile,
    purchases,
    packings,
    payments,
    otherCosts,
    addOtherCost,
    deleteOtherCost,
    supplierCredits,
    addSupplierCredit,
    applySupplierCredit,
    deleteSupplierCredit,
    dropdownOptions,
    openPrintModal,
    setActiveTab,
    showToast,
  } = useApp();

  const [newCategory, setNewCategory] = useState<string>(dropdownOptions.costingCategories[0] || 'Air Freight & Cargo');
  const [newCostDate, setNewCostDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newAmount, setNewAmount] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newRef, setNewRef] = useState<string>('');
  const [trendWindow, setTrendWindow] = useState<TrendWindowMode>('active');
  const [chartType, setChartType] = useState<'composed' | 'area'>('composed');
  const [supplierWindow, setSupplierWindow] = useState<SupplierPerformanceWindow>('6m');
  const [supplierChartMode, setSupplierChartMode] = useState<'value' | 'volume'>('value');

  // Supplier Credit Tracking Module State
  const [creditFilter, setCreditFilter] = useState<'all' | 'open' | 'applied'>('all');
  const [creditSupplier, setCreditSupplier] = useState<string>(
    dropdownOptions.suppliers[0] || 'ABDULLAH VAI'
  );
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditReason, setCreditReason] = useState<string>(SUPPLIER_CREDIT_REASONS[0]);
  const [creditRefInvoice, setCreditRefInvoice] = useState<string>('');
  const [creditDate, setCreditDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [creditRemarks, setCreditRemarks] = useState<string>('');

  const summary = calculateProfitLoss(
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile.rmbExchangeRate
  );

  const trendsData = useMemo(
    () =>
      calculateProfitLossMonthlyTrends(purchases, packings, payments, otherCosts, {
        windowMode: trendWindow,
        rmbExchangeRate: companyProfile.rmbExchangeRate,
      }),
    [purchases, packings, payments, otherCosts, trendWindow, companyProfile.rmbExchangeRate]
  );

  const supplierPerformance = useMemo(
    () =>
      calculateSupplierPerformance(purchases, {
        windowMode: supplierWindow,
        monthsWindow: 6,
        topLimit: 5,
      }),
    [purchases, supplierWindow]
  );

  const creditSummary = useMemo(
    () => calculateSupplierCreditSummary(supplierCredits, purchases),
    [supplierCredits, purchases]
  );

  const filteredCredits = useMemo(() => {
    const list = [...supplierCredits].sort((a, b) => {
      if (a.remainingAmount > 0 && b.remainingAmount === 0) return -1;
      if (a.remainingAmount === 0 && b.remainingAmount > 0) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });
    if (creditFilter === 'open') {
      return list.filter((cn) => cn.remainingAmount > 0);
    }
    if (creditFilter === 'applied') {
      return list.filter((cn) => cn.status === 'APPLIED');
    }
    return list;
  }, [supplierCredits, creditFilter]);

  const handleAddSupplierCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(creditAmount);
    if (!creditSupplier.trim()) {
      showToast('Please select a supplier name.');
      return;
    }
    if (!amt || amt <= 0) {
      showToast('Please enter a valid positive credit note amount.');
      return;
    }

    addSupplierCredit({
      date: creditDate,
      supplierName: creditSupplier.trim(),
      amount: amt,
      reason: creditReason,
      refPurchaseInvoice: creditRefInvoice.trim() || undefined,
      remarks: creditRemarks.trim() || undefined,
    });

    setCreditAmount('');
    setCreditRefInvoice('');
    setCreditRemarks('');
  };

  const handleQuickApplyCreditInPL = (cn: SupplierCreditRecord) => {
    if (cn.remainingAmount <= 0) return;
    applySupplierCredit(cn.id, {
      amount: cn.remainingAmount,
      date: new Date().toISOString().slice(0, 10),
      targetPurchaseInvoice: cn.refPurchaseInvoice,
      notes: 'Applied against supplier purchase balance from P&L Credit Ledger',
    });
  };

  const handleAddCost = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!amt || amt <= 0) return;

    addOtherCost({
      date: newCostDate || new Date().toISOString().slice(0, 10),
      category: newCategory,
      amount: amt,
      description: newDesc.trim() || newCategory,
      refInvoice: newRef.trim() || undefined,
    });

    setNewAmount('');
    setNewDesc('');
    setNewRef('');
  };

  const handlePrintProfitLoss = () => {
    const fullDailyReport = calculateDailyProfitLossReport(
      purchases,
      packings,
      payments,
      otherCosts,
      { rmbExchangeRate: companyProfile.rmbExchangeRate }
    );
    openPrintModal({
      type: 'profit_loss',
      title: 'Loss & Profit Financial Statement & Daily Report',
      data: {
        summary,
        dailyEntries: fullDailyReport.entries,
        periodLabel: 'All Active Trading Days',
        purchases,
        packings,
        payments,
        otherCosts,
      },
    });
  };

  const isProfitable = summary.netProfit >= 0;
  const latestTrend = trendsData.latestMonth;
  const prevTrend = trendsData.previousMonth;

  const formatMoMDelta = (percent: number | null | undefined) => {
    if (percent === null || percent === undefined) return 'Baseline month';
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}% MoM`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1b2b44] text-white px-5 py-3 rounded-lg shadow-md flex items-center justify-between border-b-2 border-amber-500">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <span className="zsb-3d-text text-xl sm:text-2xl font-black">
                {companyProfile.companyName}
              </span>
              <span className="text-lg text-slate-300">|</span>
              <span className="text-sm sm:text-base font-semibold text-slate-100 uppercase tracking-wide">
                Loss &amp; Profit Statement &amp; Other Costing
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Auto-consolidated from Total Purchasing, Export Revenues &amp; Other Costing
            </p>
          </div>
        </div>

        <button
          onClick={handlePrintProfitLoss}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print P&amp;L Statement</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Purchasing */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Total Purchasing Cost</span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-700 font-mono tabular-nums mt-2">
            {formatCurrency(summary.totalPurchasing, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">From {purchases.length} Purchase Invoices</div>
        </div>

        {/* Total Export Revenue */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Total Export Value</span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-teal-700 font-mono tabular-nums mt-2">
            {formatCurrency(summary.totalExportValue, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total {summary.totalWeightExported} KG live export
          </div>
        </div>

        {/* Total Other Costing */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Other Operating Costs</span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 font-mono tabular-nums mt-2">
            {formatCurrency(summary.totalOtherCosting, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Freight, packing, customs &amp; labor
          </div>
        </div>

        {/* Net Profit / Loss */}
        <div
          className={`rounded-xl shadow border p-4 ${
            isProfitable
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-rose-50/70 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span className={isProfitable ? 'text-emerald-800' : 'text-rose-800'}>
              Net {isProfitable ? 'Profit' : 'Loss'}
            </span>
            {isProfitable ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums mt-2 ${
              isProfitable ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(summary.netProfit, companyProfile.currency)}
          </div>
          <div
            className={`text-[11px] font-bold mt-1 ${
              isProfitable ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            Margin: {summary.marginPercent}%
          </div>
        </div>
      </div>

      {/* Daily Report Details of Profit & Loss */}
      <DailyProfitLossSection
        purchases={purchases}
        packings={packings}
        payments={payments}
        otherCosts={otherCosts}
        companyProfile={companyProfile}
        openPrintModal={openPrintModal}
        setActiveTab={setActiveTab}
      />

      {/* Month-over-Month Visual Trends Chart: Export Revenue vs. Supplier Payment Outflows */}
      <section
        aria-label="Month-over-Month Export Revenue vs. Supplier Payment Outflows"
        data-testid="pl-mom-trends-section"
        className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden"
      >
        {/* Trends Header Bar */}
        <div className="bg-[#1b2b44] text-white px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white truncate">
              Month-over-Month Trends: Export Revenue vs. Supplier Outflows
            </h2>
            <span className="text-slate-500 shrink-0" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-slate-300 font-mono tabular-nums whitespace-nowrap shrink-0">
              {trendsData.points.length} {trendsData.points.length === 1 ? 'Month' : 'Months'}
            </span>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
            {/* Chart Visualization Toggle */}
            <div
              role="group"
              aria-label="Trends Chart Visualization Mode"
              className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 shrink-0"
            >
              <button
                type="button"
                data-testid="pl-trends-chart-bar"
                onClick={() => setChartType('composed')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartType === 'composed'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Bar &amp; Net Spread
              </button>
              <button
                type="button"
                data-testid="pl-trends-chart-area"
                onClick={() => setChartType('area')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartType === 'area'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Area Trajectory
              </button>
            </div>

            {/* Timeframe Window Selector */}
            <div
              role="group"
              aria-label="Trends Month Window"
              className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 shrink-0"
            >
              <button
                type="button"
                data-testid="pl-trends-window-active"
                onClick={() => setTrendWindow('active')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  trendWindow === 'active'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Active Months
              </button>
              <button
                type="button"
                data-testid="pl-trends-window-6m"
                onClick={() => setTrendWindow('6m')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  trendWindow === '6m'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                6 Months
              </button>
              <button
                type="button"
                data-testid="pl-trends-window-12m"
                onClick={() => setTrendWindow('12m')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  trendWindow === '12m'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                12 Months
              </button>
            </div>
          </div>
        </div>

        {/* MoM Comparison KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/90 border-b border-slate-200">
          {/* Latest Month Export Revenue + MoM */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
              <span className="truncate">
                Export Revenue ({latestTrend ? latestTrend.shortMonthLabel : 'N/A'})
              </span>
              {latestTrend?.revenueMoMPercent !== null &&
                latestTrend?.revenueMoMPercent !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-bold whitespace-nowrap shrink-0 ${
                      latestTrend.revenueMoMPercent >= 0 ? 'text-teal-700' : 'text-rose-700'
                    }`}
                  >
                    {latestTrend.revenueMoMPercent >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {formatMoMDelta(latestTrend.revenueMoMPercent)}
                  </span>
                )}
            </div>
            <div
              data-testid="pl-trends-latest-revenue"
              className="text-sm sm:text-base font-extrabold text-teal-800 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(latestTrend ? latestTrend.exportRevenue : 0, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
              {prevTrend
                ? `Prior (${prevTrend.shortMonthLabel}): ${formatCurrency(
                    prevTrend.exportRevenue,
                    companyProfile.currency
                  )}`
                : 'Single month recorded'}
            </div>
          </div>

          {/* Latest Month Supplier Payment Outflows + MoM */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
              <span className="truncate">
                Supplier Outflow ({latestTrend ? latestTrend.shortMonthLabel : 'N/A'})
              </span>
              {latestTrend?.outflowMoMPercent !== null &&
                latestTrend?.outflowMoMPercent !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-bold whitespace-nowrap shrink-0 ${
                      latestTrend.outflowMoMPercent <= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {latestTrend.outflowMoMPercent >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {formatMoMDelta(latestTrend.outflowMoMPercent)}
                  </span>
                )}
            </div>
            <div
              data-testid="pl-trends-latest-outflow"
              className="text-sm sm:text-base font-extrabold text-rose-700 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(
                latestTrend ? latestTrend.supplierPaymentOutflow : 0,
                companyProfile.currency
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
              {prevTrend
                ? `Prior (${prevTrend.shortMonthLabel}): ${formatCurrency(
                    prevTrend.supplierPaymentOutflow,
                    companyProfile.currency
                  )}`
                : 'Single month recorded'}
            </div>
          </div>

          {/* Cumulative Net Cashflow Spread */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Cumulative Revenue vs. Outflow Spread
            </div>
            <div
              data-testid="pl-trends-net-spread"
              className={`text-sm sm:text-base font-extrabold font-mono tabular-nums mt-0.5 ${
                trendsData.totalNetCashflowSpread >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {trendsData.totalNetCashflowSpread >= 0 ? '+' : ''}
              {formatCurrency(trendsData.totalNetCashflowSpread, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              Rev {formatCurrency(trendsData.totalExportRevenue, companyProfile.currency)} · Outflow{' '}
              {formatCurrency(trendsData.totalSupplierOutflow, companyProfile.currency)}
            </div>
          </div>

          {/* Outflow-to-Revenue Ratio */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Supplier Outflow / Export Revenue Ratio
            </div>
            <div
              data-testid="pl-trends-outflow-ratio"
              className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5"
            >
              {trendsData.overallOutflowToRevenueRatio}% of Revenue
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              Retained Operating Spread:{' '}
              {trendsData.totalExportRevenue > 0
                ? `${Math.max(0, Math.round((100 - trendsData.overallOutflowToRevenueRatio) * 10) / 10)}%`
                : '0%'}
            </div>
          </div>
        </div>

        {/* Main Split: Visual Chart (7 Cols) + Month-over-Month Comparison Table (5 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left: Recharts Visual Trend Chart */}
          <div className="lg:col-span-7 p-5 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Monthly Export Revenue vs. Supplier Payment Outflows ({companyProfile.currency})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Compares gross export cargo revenue against cash disbursed to fish suppliers each month
                </p>
              </div>
            </div>

            <div className="w-full h-[290px]" data-testid="pl-mom-trends-chart">
              <ResponsiveContainer width="100%" height={290}>
                {chartType === 'composed' ? (
                  <ComposedChart
                    data={trendsData.points}
                    margin={{ top: 12, right: 16, left: 6, bottom: 8 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="shortMonthLabel"
                      tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(val: number) =>
                        Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
                      }
                      tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatCurrency(Number(value) || 0, companyProfile.currency),
                        String(name),
                      ]}
                      labelFormatter={(_label: any, payload: any) => {
                        const pt = payload?.[0]?.payload as
                          | ProfitLossMonthlyTrendPoint
                          | undefined;
                        if (!pt) return String(_label);
                        const revDelta =
                          pt.revenueMoMPercent !== null
                            ? ` · Rev ${formatMoMDelta(pt.revenueMoMPercent)}`
                            : '';
                        const outDelta =
                          pt.outflowMoMPercent !== null
                            ? ` · Outflow ${formatMoMDelta(pt.outflowMoMPercent)}`
                            : '';
                        return `${pt.monthLabel}${revDelta}${outDelta}`;
                      }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                      itemStyle={{ color: '#f8fafc' }}
                      labelStyle={{ color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '8px' }}
                    />
                    <Bar
                      dataKey="exportRevenue"
                      name={`Total Export Revenue (${companyProfile.currency})`}
                      fill="#0d9488"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={42}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="supplierPaymentOutflow"
                      name={`Supplier Payment Outflows (${companyProfile.currency})`}
                      fill="#e11d48"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={42}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="netCashflowSpread"
                      name={`Net Revenue Spread (${companyProfile.currency})`}
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#0284c7', strokeWidth: 2, stroke: '#ffffff' }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                ) : (
                  <AreaChart
                    data={trendsData.points}
                    margin={{ top: 12, right: 16, left: 6, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="shortMonthLabel"
                      tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(val: number) =>
                        Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
                      }
                      tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatCurrency(Number(value) || 0, companyProfile.currency),
                        String(name),
                      ]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                      itemStyle={{ color: '#f8fafc' }}
                      labelStyle={{ color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '8px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="exportRevenue"
                      name={`Total Export Revenue (${companyProfile.currency})`}
                      stroke="#0d9488"
                      fill="#0d9488"
                      fillOpacity={0.18}
                      strokeWidth={2.5}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="supplierPaymentOutflow"
                      name={`Supplier Payment Outflows (${companyProfile.currency})`}
                      stroke="#e11d48"
                      fill="#e11d48"
                      fillOpacity={0.16}
                      strokeWidth={2.5}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="netCashflowSpread"
                      name={`Net Revenue Spread (${companyProfile.currency})`}
                      stroke="#0284c7"
                      fill="#0284c7"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Month-over-Month Breakdown Ledger Table */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50/40">
            <div>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Month-over-Month Comparison Ledger
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Revenue vs. Outflows
                </span>
              </div>

              <div className="p-2.5">
                <div className="overflow-x-auto border-2 border-slate-200 rounded-lg bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-left">Month</th>
                      <th className="py-2 px-2.5 text-right">Export Rev</th>
                      <th className="py-2 px-2.5 text-right">Supplier Outflow</th>
                      <th className="py-2 px-3 text-right">Net Spread</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-mono tabular-nums">
                    {trendsData.points.map((pt) => {
                      const isPositiveSpread = pt.netCashflowSpread >= 0;
                      return (
                        <tr
                          key={pt.yearMonth}
                          data-testid={`pl-trend-row-${pt.yearMonth}`}
                          className="hover:bg-white transition"
                        >
                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-bold text-slate-900">{pt.shortMonthLabel}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {pt.exportConsignmentCount} Exp · {pt.supplierPaymentCount} Pay
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <div className="font-bold text-teal-800">
                              {formatCurrency(pt.exportRevenue, companyProfile.currency)}
                            </div>
                            <div
                              className={`text-[10px] ${
                                pt.revenueMoMPercent === null
                                  ? 'text-slate-400'
                                  : pt.revenueMoMPercent >= 0
                                  ? 'text-teal-700 font-semibold'
                                  : 'text-rose-600 font-semibold'
                              }`}
                            >
                              {formatMoMDelta(pt.revenueMoMPercent)}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <div className="font-bold text-rose-700">
                              {formatCurrency(pt.supplierPaymentOutflow, companyProfile.currency)}
                            </div>
                            <div
                              className={`text-[10px] ${
                                pt.outflowMoMPercent === null
                                  ? 'text-slate-400'
                                  : pt.outflowMoMPercent <= 0
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-rose-600 font-semibold'
                              }`}
                            >
                              {formatMoMDelta(pt.outflowMoMPercent)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div
                              className={`font-bold ${
                                isPositiveSpread ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isPositiveSpread ? '+' : ''}
                              {formatCurrency(pt.netCashflowSpread, companyProfile.currency)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Outflow: {pt.outflowToRevenueRatio}%
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('packing_form')}
                className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>+ Log Export Manifest</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('payment_form')}
                className="text-rose-700 hover:text-rose-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>+ Log Supplier Payment</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Supplier Performance Module: Top 5 Suppliers by Purchase Value (Last 6 Months) */}
      <section
        aria-label="Supplier Performance Top 5 Suppliers by Total Purchase Value"
        data-testid="pl-supplier-performance-section"
        className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden"
      >
        {/* Module Header Bar */}
        <div className="bg-[#1b2b44] text-white px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white whitespace-nowrap">
              Supplier Performance: Top 5 Suppliers
            </h2>
            <span className="text-slate-500 shrink-0" aria-hidden="true">
              ·
            </span>
            <span
              data-testid="pl-supplier-window-label"
              className="text-xs text-slate-300 font-mono tabular-nums whitespace-nowrap shrink-0"
            >
              {supplierPerformance.windowRangeLabel}
            </span>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
            {/* Chart Mode Toggle */}
            <div
              role="group"
              aria-label="Supplier Performance Chart Mode"
              className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 shrink-0"
            >
              <button
                type="button"
                data-testid="pl-supplier-chart-value"
                onClick={() => setSupplierChartMode('value')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  supplierChartMode === 'value'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Value &amp; Settlement
              </button>
              <button
                type="button"
                data-testid="pl-supplier-chart-volume"
                onClick={() => setSupplierChartMode('volume')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  supplierChartMode === 'volume'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Volume &amp; Rate
              </button>
            </div>

            {/* Timeframe Window Selector (Default: Last 6 Months) */}
            <div
              role="group"
              aria-label="Supplier Performance Timeframe Window"
              className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 shrink-0"
            >
              <button
                type="button"
                data-testid="pl-supplier-window-6m"
                onClick={() => setSupplierWindow('6m')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  supplierWindow === '6m'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Last 6 Months
              </button>
              <button
                type="button"
                data-testid="pl-supplier-window-all"
                onClick={() => setSupplierWindow('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  supplierWindow === 'all'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>

        {/* Supplier Performance KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/90 border-b border-slate-200">
          {/* #1 Ranked Supplier */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
              <span className="truncate">#1 Lead Supplier (6M Value)</span>
              {supplierPerformance.topSupplier && (
                <span className="text-[11px] font-mono font-bold text-blue-700 whitespace-nowrap shrink-0">
                  {supplierPerformance.topSupplier.shareOfWindowSpendPercent}% Share
                </span>
              )}
            </div>
            <div
              data-testid="pl-supplier-top1-name"
              className="text-sm sm:text-base font-extrabold text-slate-900 truncate mt-0.5"
            >
              {supplierPerformance.topSupplier
                ? supplierPerformance.topSupplier.supplierName
                : 'No Supplier Data'}
            </div>
            <div
              data-testid="pl-supplier-top1-value"
              className="text-[11px] text-slate-600 font-mono tabular-nums mt-0.5 truncate"
            >
              {supplierPerformance.topSupplier
                ? `${formatCurrency(
                    supplierPerformance.topSupplier.totalPurchaseValue,
                    companyProfile.currency
                  )} · ${supplierPerformance.topSupplier.totalQuantityKg} KG`
                : 'Log purchase bills to rank suppliers'}
            </div>
          </div>

          {/* Top 5 Combined Purchase Value */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
              <span className="truncate">Top 5 Combined Spend</span>
              <span className="text-[11px] font-mono font-bold text-teal-700 whitespace-nowrap shrink-0">
                {supplierPerformance.top5ShareOfTotalPercent}% of Total
              </span>
            </div>
            <div
              data-testid="pl-supplier-top5-total"
              className="text-sm sm:text-base font-extrabold text-blue-800 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(
                supplierPerformance.top5TotalPurchaseValue,
                companyProfile.currency
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
              {supplierPerformance.topSuppliers.length} of {supplierPerformance.allSuppliersCount}{' '}
              Suppliers · {supplierPerformance.totalWindowInvoices} Bills
            </div>
          </div>

          {/* Top 5 Combined Volume & Avg Rate */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Top 5 Procured Volume &amp; Avg Rate
            </div>
            <div
              data-testid="pl-supplier-top5-volume"
              className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5"
            >
              {supplierPerformance.top5TotalQuantityKg.toLocaleString()} KG
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              Weighted Avg:{' '}
              {formatCurrency(
                supplierPerformance.top5WeightedAvgRatePerKg,
                companyProfile.currency
              )}{' '}
              / KG
            </div>
          </div>

          {/* Top 5 Settlement Ratio */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between gap-2">
              <span className="truncate">Top 5 Settlement Ratio</span>
              <span className="text-[11px] font-mono font-bold text-emerald-700 whitespace-nowrap shrink-0">
                {supplierPerformance.top5SettlementRatePercent}% Paid
              </span>
            </div>
            <div
              data-testid="pl-supplier-top5-settlement"
              className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(supplierPerformance.top5TotalPaidAmount, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-rose-700 font-mono tabular-nums mt-0.5 truncate">
              Outstanding Due:{' '}
              {formatCurrency(supplierPerformance.top5TotalBalanceDue, companyProfile.currency)}
            </div>
          </div>
        </div>

        {/* Main Split: Recharts Top 5 Supplier Chart (7 Cols) + Ranked Performance Table (5 Cols) */}
        {supplierPerformance.topSuppliers.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              No supplier purchase records found in this timeframe window.
            </p>
            <p className="text-xs text-slate-500">
              Record a fish purchase bill to visualize the top 5 suppliers by purchase value over the last 6 months.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('purchase_form')}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b73b4] hover:bg-[#165f95] text-white text-xs font-bold rounded shadow transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Purchase Bill</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Left: Recharts Top 5 Suppliers Visualization */}
            <div className="lg:col-span-7 p-5 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Top {supplierPerformance.topSuppliers.length} Suppliers by Total Purchase Value (
                    {companyProfile.currency})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {supplierChartMode === 'value'
                      ? 'Compares total purchase bill value against settled payments and outstanding balance due per supplier'
                      : 'Compares total purchase expenditure against cumulative live fish weight (KG) procured per supplier'}
                  </p>
                </div>
              </div>

              <div className="w-full h-[300px]" data-testid="pl-supplier-performance-chart">
                <ResponsiveContainer width="100%" height={300}>
                  {supplierChartMode === 'value' ? (
                    <ComposedChart
                      data={supplierPerformance.topSuppliers}
                      margin={{ top: 12, right: 16, left: 6, bottom: 8 }}
                      barGap={6}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(val: number) =>
                          Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
                        }
                        tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        width={56}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          formatCurrency(Number(value) || 0, companyProfile.currency),
                          String(name),
                        ]}
                        labelFormatter={(_label: any, payload: any) => {
                          const sup = payload?.[0]?.payload as
                            | SupplierPerformanceMetric
                            | undefined;
                          if (!sup) return String(_label);
                          return `#${sup.rank} ${sup.supplierName} · ${sup.totalQuantityKg} KG (${sup.shareOfWindowSpendPercent}% of 6M Spend)`;
                        }}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                        itemStyle={{ color: '#f8fafc' }}
                        labelStyle={{ color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '8px' }}
                      />
                      <Bar
                        dataKey="totalPurchaseValue"
                        name={`Total Purchase Value (${companyProfile.currency})`}
                        fill="#2563eb"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={42}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="totalPaidAmount"
                        name={`Paid Settlement (${companyProfile.currency})`}
                        fill="#0d9488"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={42}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalBalanceDue"
                        name={`Outstanding Due (${companyProfile.currency})`}
                        stroke="#e11d48"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#e11d48', strokeWidth: 2, stroke: '#ffffff' }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  ) : (
                    <ComposedChart
                      data={supplierPerformance.topSuppliers}
                      margin={{ top: 12, right: 16, left: 6, bottom: 8 }}
                      barGap={8}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={(val: number) =>
                          Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
                        }
                        tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        width={56}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(val: number) => `${val} KG`}
                        tick={{ fill: '#d97706', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        width={58}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => {
                          const label = String(name);
                          if (label.includes('KG')) {
                            return [`${Number(value) || 0} KG`, label];
                          }
                          return [
                            formatCurrency(Number(value) || 0, companyProfile.currency),
                            label,
                          ];
                        }}
                        labelFormatter={(_label: any, payload: any) => {
                          const sup = payload?.[0]?.payload as
                            | SupplierPerformanceMetric
                            | undefined;
                          if (!sup) return String(_label);
                          return `#${sup.rank} ${sup.supplierName} · Avg ${formatCurrency(
                            sup.avgRatePerKg,
                            companyProfile.currency
                          )}/KG`;
                        }}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                        itemStyle={{ color: '#f8fafc' }}
                        labelStyle={{ color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '8px' }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="totalPurchaseValue"
                        name={`Total Purchase Value (${companyProfile.currency})`}
                        fill="#2563eb"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={44}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="totalQuantityKg"
                        name="Total Quantity Procured (KG)"
                        stroke="#d97706"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#d97706', strokeWidth: 2, stroke: '#ffffff' }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Top 5 Suppliers Ranked Breakdown Ledger Table */}
            <div
              className="lg:col-span-5 flex flex-col justify-between bg-slate-50/40"
              data-testid="pl-supplier-performance-table"
            >
              <div>
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Top 5 Suppliers Ranked Ledger
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    By Total Purchase Value
                  </span>
                </div>

                <div className="p-2.5">
                  <div className="overflow-x-auto border-2 border-slate-200 rounded-lg bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 text-left">Rank &amp; Supplier</th>
                        <th className="py-2 px-2 text-right">Volume</th>
                        <th className="py-2 px-2 text-right">Paid / Due</th>
                        <th className="py-2 px-3 text-right">Purchase Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 font-mono tabular-nums">
                      {supplierPerformance.topSuppliers.map((sup) => (
                        <tr
                          key={sup.supplierName}
                          data-testid={`pl-supplier-row-${sup.rank}`}
                          className="hover:bg-white transition"
                        >
                          <td className="py-2.5 px-3 font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-slate-500 text-[11px]">
                                #{sup.rank}
                              </span>
                              <span className="font-bold text-slate-900 truncate max-w-[130px]">
                                {sup.supplierName}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[155px]">
                              {sup.invoiceCount} {sup.invoiceCount === 1 ? 'Bill' : 'Bills'}
                              {sup.topItems.length > 0 ? ` · ${sup.topItems.join(', ')}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <div className="font-bold text-slate-800">
                              {sup.totalQuantityKg} KG
                            </div>
                            <div className="text-[10px] text-slate-500">
                              @{Math.round(sup.avgRatePerKg)}/KG
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <div className="font-bold text-teal-800">
                              {formatCurrency(sup.totalPaidAmount, companyProfile.currency)}
                            </div>
                            <div
                              className={`text-[10px] font-semibold ${
                                sup.totalBalanceDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                              }`}
                            >
                              {sup.totalBalanceDue > 0
                                ? `Due: ${formatCurrency(
                                    sup.totalBalanceDue,
                                    companyProfile.currency
                                  )}`
                                : 'Settled (100%)'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="font-bold text-blue-800">
                              {formatCurrency(sup.totalPurchaseValue, companyProfile.currency)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {sup.shareOfWindowSpendPercent}% of 6M
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('purchase_form')}
                  className="text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>+ New Purchase Bill</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('purchase_db')}
                  className="text-slate-700 hover:text-slate-950 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Open Purchase DB</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Supplier Credit Tracking & Rebate Ledger Module */}
      <section
        aria-label="Supplier Credit Tracking & Purchase Rebate Ledger"
        data-testid="pl-supplier-credit-section"
        className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden"
      >
        {/* Module Header Bar */}
        <div className="bg-[#1b2b44] text-white px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <BadgePercent className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white whitespace-nowrap">
              Supplier Credit Tracking &amp; Purchase Rebates
            </h2>
            <span className="text-slate-500 shrink-0" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-slate-300 font-mono tabular-nums whitespace-nowrap shrink-0">
              {creditSummary.totalCreditsCount} Credit Notes ({creditSummary.openCreditsCount} Open)
            </span>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
            {/* Credit Status Filter */}
            <div
              role="group"
              aria-label="Supplier Credit Status Filter"
              className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 shrink-0"
            >
              <button
                type="button"
                data-testid="pl-credit-filter-all"
                onClick={() => setCreditFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  creditFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All Credits ({creditSummary.totalCreditsCount})
              </button>
              <button
                type="button"
                data-testid="pl-credit-filter-open"
                onClick={() => setCreditFilter('open')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  creditFilter === 'open'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Available ({creditSummary.openCreditsCount})
              </button>
              <button
                type="button"
                data-testid="pl-credit-filter-applied"
                onClick={() => setCreditFilter('applied')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  creditFilter === 'applied'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Fully Applied ({creditSummary.appliedCreditsCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('payment_form')}
              className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1"
            >
              <span>Apply in Supplier Payment</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Supplier Credit KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/90 border-b border-slate-200">
          {/* Total Credit Notes Issued */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Total Credit Notes Issued
            </div>
            <div
              data-testid="pl-credit-total-issued"
              className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(creditSummary.totalIssuedAmount, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              Across {creditSummary.bySupplier.length} Suppliers · {creditSummary.totalCreditsCount} Notes
            </div>
          </div>

          {/* Credit Applied Against Payments */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Credits Applied to Payments
            </div>
            <div
              data-testid="pl-credit-total-applied"
              className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(creditSummary.totalAppliedAmount, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              {creditSummary.appliedCreditsCount} Fully Settled Notes
            </div>
          </div>

          {/* Available Unapplied Credit Balance */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Available Credit Balance
            </div>
            <div
              data-testid="pl-credit-total-available"
              className="text-sm sm:text-base font-extrabold text-teal-800 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(creditSummary.totalAvailableAmount, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              {creditSummary.openCreditsCount} Open Credit Notes Ready
            </div>
          </div>

          {/* Net Purchasing Cost After Credits */}
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Net Purchasing After Credits
            </div>
            <div
              data-testid="pl-credit-net-purchasing"
              className="text-sm sm:text-base font-extrabold text-blue-800 font-mono tabular-nums mt-0.5"
            >
              {formatCurrency(
                creditSummary.netPurchasingAfterIssuedCredits,
                companyProfile.currency
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              Gross Purchasing: {formatCurrency(creditSummary.grossPurchasingCost, companyProfile.currency)}
            </div>
          </div>
        </div>

        {/* Main Split: Credit Notes Ledger Table (7 Cols) + Record New Credit Note Form (5 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left: Credit Notes Ledger Table */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Supplier Credit Notes &amp; Application Ledger
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Showing {filteredCredits.length} of {supplierCredits.length} Notes
                </span>
              </div>

              <div className="p-2.5">
                <div className="overflow-x-auto border-2 border-slate-200 rounded-lg bg-white">
                <table className="w-full text-xs" data-testid="pl-credit-ledger-table">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200 whitespace-nowrap">
                    <tr>
                      <th className="py-2 px-2.5 text-left">Credit Note &amp; Supplier</th>
                      <th className="py-2 px-2 text-left">Reason &amp; Ref</th>
                      <th className="py-2 px-2 text-right">Issued / Applied</th>
                      <th className="py-2 px-2 text-right">Available</th>
                      <th className="py-2 px-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-mono tabular-nums">
                    {filteredCredits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                          No supplier credit notes match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredCredits.map((cn) => {
                        const isAvailable = cn.remainingAmount > 0;
                        return (
                          <tr
                            key={cn.id}
                            data-testid={`pl-credit-row-${cn.creditNoteNumber}`}
                            className="hover:bg-slate-50/80 transition"
                          >
                            <td className="py-2.5 px-2.5 font-sans whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-extrabold text-teal-900 whitespace-nowrap">
                                  {cn.creditNoteNumber}
                                </span>
                                <span
                                  className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${
                                    cn.status === 'AVAILABLE'
                                      ? 'bg-teal-100 text-teal-900'
                                      : cn.status === 'PARTIAL'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {cn.status}
                                </span>
                              </div>
                              <div className="font-bold text-slate-900 mt-0.5 truncate max-w-[140px]">
                                {cn.supplierName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {formatDate(cn.date)}
                              </div>
                            </td>

                            <td className="py-2.5 px-2 font-sans">
                              <div className="font-semibold text-slate-800 truncate max-w-[165px]">
                                {cn.reason}
                              </div>
                              {cn.refPurchaseInvoice && (
                                <div className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                                  Ref Bill: {cn.refPurchaseInvoice}
                                </div>
                              )}
                              {cn.remarks && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[165px]">
                                  {cn.remarks}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-right whitespace-nowrap">
                              <div className="font-bold text-slate-900">
                                {formatCurrency(cn.amount, companyProfile.currency)}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                App: {formatCurrency(cn.appliedAmount, companyProfile.currency)}
                              </div>
                            </td>

                            <td className="py-2.5 px-2 text-right whitespace-nowrap">
                              <div
                                className={`font-extrabold ${
                                  isAvailable ? 'text-teal-800' : 'text-slate-400'
                                }`}
                              >
                                {formatCurrency(cn.remainingAmount, companyProfile.currency)}
                              </div>
                            </td>

                            <td className="py-2.5 px-2.5 text-right font-sans whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1">
                                {isAvailable ? (
                                  <button
                                    type="button"
                                    data-testid={`pl-apply-credit-btn-${cn.creditNoteNumber}`}
                                    onClick={() => handleQuickApplyCreditInPL(cn)}
                                    className="px-2 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold text-[11px] shadow-2xs transition cursor-pointer whitespace-nowrap"
                                  >
                                    Apply Credit
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Applied</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Delete credit note ${cn.creditNoteNumber}`}
                                  onClick={() => deleteSupplierCredit(cn.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                                  title="Delete credit note"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Open credits can be applied directly here or inside Sheet #4 (Supplier Payment).
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('payment_form')}
                className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              >
                <span>Open Supplier Payment</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Record Supplier Credit Note Form */}
          <div className="lg:col-span-5 p-4 bg-slate-50/40">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-teal-700" />
              <span>Record New Supplier Credit Note</span>
            </div>

            <form
              onSubmit={handleAddSupplierCredit}
              data-testid="pl-record-credit-form"
              className="space-y-2.5 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Supplier Name <span className="text-rose-600">*</span>
                  </label>
                  <select
                    aria-label="Supplier Credit Supplier Name"
                    data-testid="pl-credit-supplier-select"
                    value={creditSupplier}
                    onChange={(e) => setCreditSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-800"
                  >
                    {dropdownOptions.suppliers.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Credit Note Date
                  </label>
                  <input
                    type="date"
                    aria-label="Supplier Credit Date"
                    data-testid="pl-credit-date-input"
                    value={creditDate}
                    onChange={(e) => setCreditDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Credit Amount ({companyProfile.currency}) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    aria-label="Supplier Credit Amount"
                    data-testid="pl-credit-amount-input"
                    placeholder="e.g. 7500"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Ref Purchase Invoice
                  </label>
                  <input
                    type="text"
                    aria-label="Supplier Credit Reference Purchase Invoice"
                    data-testid="pl-credit-ref-input"
                    placeholder="e.g. PUR-2026-0001"
                    value={creditRefInvoice}
                    onChange={(e) => setCreditRefInvoice(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Credit Reason / Adjustment Category
                </label>
                <select
                  aria-label="Supplier Credit Reason"
                  data-testid="pl-credit-reason-select"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800"
                >
                  {SUPPLIER_CREDIT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Remarks / Claim Particulars
                </label>
                <input
                  type="text"
                  aria-label="Supplier Credit Remarks"
                  data-testid="pl-credit-remarks-input"
                  placeholder="Weight shortage, mortality claim, or rebate note..."
                  value={creditRemarks}
                  onChange={(e) => setCreditRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                />
              </div>

              <button
                type="submit"
                data-testid="pl-save-credit-btn"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white py-2 rounded font-bold text-xs uppercase shadow transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Supplier Credit Note</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Grid: Financial Statement & Add Other Costing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Financial Statement Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="bg-[#1b2b44] text-white px-5 py-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
            <span>FINANCIAL SUMMARY LEDGER</span>
            <Scale className="w-4 h-4 text-amber-400" />
          </div>

          <div className="p-3 bg-slate-50/70">
            <div className="overflow-x-auto border-2 border-slate-200 rounded-lg bg-white">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-slate-50/80">
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    Gross Export Cargo Revenue (A)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800">
                    {formatCurrency(summary.totalExportValue, companyProfile.currency)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    Less: Live Fish Purchasing Cost (B)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                    - {formatCurrency(summary.totalPurchasing, companyProfile.currency)}
                  </td>
                </tr>
                <tr className="bg-teal-50/60 text-teal-950">
                  <td className="py-2 px-3 font-semibold">
                    Supplier Credit Notes &amp; Purchase Rebates (Issued / Applied)
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-teal-800">
                    {formatCurrency(creditSummary.totalIssuedAmount, companyProfile.currency)} (Applied:{' '}
                    {formatCurrency(creditSummary.totalAppliedAmount, companyProfile.currency)})
                  </td>
                </tr>
                <tr className="bg-amber-50/60 font-bold border-y-2 border-amber-300">
                  <td className="py-2.5 px-3 text-slate-900 uppercase">
                    GROSS MARGIN (A - B)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                    {formatCurrency(summary.grossProfit, companyProfile.currency)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    Less: Total Other Costing (C)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                    - {formatCurrency(summary.totalOtherCosting, companyProfile.currency)}
                  </td>
                </tr>
                <tr
                  className={`font-black text-sm border-t-2 ${
                    isProfitable ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-rose-100 text-rose-950 border-rose-400'
                  }`}
                >
                  <td className="py-3 px-3 uppercase">
                    NET {isProfitable ? 'PROFIT' : 'LOSS'} (A - B - C)
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatCurrency(summary.netProfit, companyProfile.currency)}
                  </td>
                </tr>
                <tr className="bg-slate-50 text-slate-600 text-[11px]">
                  <td className="py-2 px-3">
                    Total RMB Return Collected on Export Goods
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-purple-800">
                    ¥ {summary.totalReturnRMB.toLocaleString()} (≈ {formatCurrency(summary.totalReturnRMBInBDT, companyProfile.currency)})
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Right: Add Other Costing Form & List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Add Cost Form */}
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>ADD OTHER COSTING (EXPENSE)</span>
            </div>

            <form onSubmit={handleAddCost} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expense Category</label>
                  <select
                    aria-label="Other Costing Category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800"
                  >
                    {dropdownOptions.costingCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expense Date</label>
                  <input
                    type="date"
                    aria-label="Other Costing Date"
                    data-testid="pl-other-cost-date-input"
                    value={newCostDate}
                    onChange={(e) => setNewCostDate(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Amount ({companyProfile.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Ref Invoice / Doc</label>
                  <input
                    type="text"
                    placeholder="e.g. PKG-2026-0001"
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Particulars</label>
                <input
                  type="text"
                  placeholder="Details of expense..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1b73b4] hover:bg-[#165f95] text-white py-2 rounded font-bold text-xs uppercase shadow transition flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Save Other Costing</span>
              </button>
            </form>
          </div>

          {/* List of Recent Other Costing Records */}
          <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
              <span>RECORDED EXPENSES ({otherCosts.length})</span>
              <span className="font-mono text-amber-700">
                {formatCurrency(summary.totalOtherCosting, companyProfile.currency)}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
              {otherCosts.length === 0 ? (
                <div className="p-4 text-center text-slate-400">No other costing recorded yet.</div>
              ) : (
                otherCosts.map((cost) => (
                  <div key={cost.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-800">{cost.category}</div>
                      <div className="text-[11px] text-slate-500">{cost.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatDate(cost.date)} {cost.refInvoice ? `• Ref: ${cost.refInvoice}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(cost.amount, companyProfile.currency)}
                      </span>
                      <button
                        onClick={() => deleteOtherCost(cost.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
