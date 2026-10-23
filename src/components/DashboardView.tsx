import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  formatCurrency,
  formatDate,
  formatRMB,
  calculateMonthlyTrends,
  classifyPaymentCategory,
  calculatePackingTotalAmountBDT,
  calculateCumulativeExportValueBDT,
  calculateForeignRmbRemittanceValue,
  calculatePackingConsignmentSummary,
} from '../utils/calculations.ts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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
} from 'lucide-react';
import { QuickEntryModal } from './QuickEntryModal.tsx';
import { MonthlySummaryCard } from './MonthlySummaryCard.tsx';
import { TopSuppliersChart } from './TopSuppliersChart.tsx';

export const DashboardView: React.FC = () => {
  const {
    setActiveTab,
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile,
    openPrintModal,
  } = useApp();

  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<'value' | 'volume_vs_value' | 'volume'>('value');
  const [chartWindow, setChartWindow] = useState<'6m' | 'active' | '12m'>('6m');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'Purchase' | 'Packing' | 'Payment'>('ALL');

  const monthlyTrends = useMemo(() => {
    return calculateMonthlyTrends(purchases, packings, payments, otherCosts, {
      monthsToShow: chartWindow === '12m' ? 12 : 6,
      activeOnly: chartWindow === 'active',
      rmbExchangeRate: companyProfile.rmbExchangeRate,
    });
  }, [purchases, packings, payments, otherCosts, chartWindow, companyProfile.rmbExchangeRate]);

  const trendPeriodTotals = useMemo(() => {
    return monthlyTrends.reduce(
      (acc, pt) => ({
        purchaseValue: acc.purchaseValue + pt.purchaseValue,
        exportValue: acc.exportValue + pt.exportValue,
        netProfit: acc.netProfit + pt.netProfit,
        purchaseVolume: acc.purchaseVolume + pt.purchaseVolume,
        exportWeight: acc.exportWeight + pt.exportWeight,
      }),
      { purchaseValue: 0, exportValue: 0, netProfit: 0, purchaseVolume: 0, exportWeight: 0 }
    );
  }, [monthlyTrends]);

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

  // Latest dates
  const latestPurchaseDate = purchases[0]?.date ? formatDate(purchases[0].date) : 'No records';
  const latestPaymentDate = payments[0]?.date ? formatDate(payments[0].date) : 'No records';
  const latestPackingDate = packings[0]?.packingDate ? formatDate(packings[0].packingDate) : 'No records';

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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Executive Command Header */}
      <section
        aria-label="Executive Command Header"
        className="bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-800 text-white shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400/90 font-semibold tracking-wide">
              <span>Sheet 01 · Executive Overview</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300 font-normal">
                Live Seafood Procurement, Air-Freight Export &amp; RMB Settlement Ledger
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-serif uppercase">
                {companyProfile.companyName}
              </h1>
              <span className="text-slate-500 hidden sm:inline" aria-hidden="true">/</span>
              <span className="text-base sm:text-lg font-semibold text-amber-400">
                Business Control Center
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 pt-0.5 font-mono tabular-nums">
              <span>{companyProfile.address}</span>
              <span aria-hidden="true">·</span>
              <span>Rate: 1 RMB = {companyProfile.rmbExchangeRate} {companyProfile.currency}</span>
              <span aria-hidden="true">·</span>
              <span>Synced {new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('purchase_form')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + New Purchase Bill
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('packing_form')}
              className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              + New Packing Manifest
            </button>
            <button
              type="button"
              onClick={() => setIsQuickEntryOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
              title="Open Quick Entry CSV Bulk Upload"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Quick Entry (CSV Bulk)</span>
            </button>
          </div>
        </div>

        {/* Cumulative Executive Ledger Strip inside Hero */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5 pt-5 border-t border-slate-800/90">
          <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cumulative Procurement</span>
              <ShoppingCart className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums mt-1 whitespace-nowrap">
              {formatCurrency(totalPurchaseValue, companyProfile.currency)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
              {totalPurchaseCount} Bills · {totalPurchaseQty.toLocaleString()} KG
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cumulative Export Value</span>
              <Package className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            </div>
            <div
              data-testid="dashboard-cumulative-export-value"
              className="text-lg sm:text-xl font-bold text-teal-300 font-mono tabular-nums mt-1 whitespace-nowrap"
            >
              {formatCurrency(totalExportValue, 'BDT')}
            </div>
            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
              Total Amount (BDT) · {totalPackingCount} Manifests · {totalWeight.toLocaleString()} KG ({totalBoxes} Box)
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Foreign RMB Remittance</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </div>
            <div
              data-testid="dashboard-foreign-rmb-remittance"
              className="text-lg sm:text-xl font-bold text-amber-300 font-mono tabular-nums mt-1 whitespace-nowrap"
            >
              {formatRMB(totalRmbSettled)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
              Total Value ({formatCurrency(totalRmbSettled, 'RMB')}) · Latest: {latestPackingDate}
            </div>
          </div>
        </div>
      </section>

      {/* Packing List Export Weight & Consignments Summary Section */}
      <section
        aria-label="Packing List Export Weight and Consignments Summary"
        data-testid="dashboard-export-consignments-summary"
        className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden"
      >
        <div className="bg-slate-900 text-white px-5 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Scale className="w-4 h-4 text-teal-400 shrink-0" />
            <h2 className="text-sm font-bold tracking-wide text-white">
              Packing List Export Consignments &amp; Weight Summary
            </h2>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-xs text-slate-300 font-mono tabular-nums">
              Synced from Sheet 09 (Packing List Database)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('packing_form')}
              className="px-3 py-1.5 rounded-md bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              + New Consignment Manifest
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('packing_db')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <span>Open Packing List DB</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
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
      <MonthlySummaryCard />

      {/* Monthly Transaction Trends Chart (Recharts BarChart) */}
      <section
        aria-label="Monthly Transaction Trends"
        data-testid="monthly-trends-chart"
        className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden"
      >
        <div className="bg-slate-900 text-white px-5 py-3.5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-sm font-bold tracking-wide text-white">
              Monthly Transaction Trends
            </h2>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-xs text-slate-300 font-mono tabular-nums">
              {monthlyTrends[0]?.shortMonthLabel} – {monthlyTrends[monthlyTrends.length - 1]?.shortMonthLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Mode Switcher */}
            <div
              role="group"
              aria-label="Chart Metric Mode"
              className="flex flex-wrap items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700"
            >
              <button
                type="button"
                data-testid="chart-mode-value"
                onClick={() => setChartViewMode('value')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartViewMode === 'value'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Value &amp; Profit ({companyProfile.currency})
              </button>
              <button
                type="button"
                data-testid="chart-mode-volume-vs-value"
                onClick={() => setChartViewMode('volume_vs_value')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartViewMode === 'volume_vs_value'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Vol vs. Export Value
              </button>
              <button
                type="button"
                data-testid="chart-mode-volume"
                onClick={() => setChartViewMode('volume')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartViewMode === 'volume'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Volume (KG/PCS)
              </button>
            </div>

            {/* Period Window Switcher */}
            <div
              role="group"
              aria-label="Chart Time Window"
              className="flex flex-wrap items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700"
            >
              <button
                type="button"
                data-testid="chart-window-6m"
                onClick={() => setChartWindow('6m')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartWindow === '6m'
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                6 Months
              </button>
              <button
                type="button"
                data-testid="chart-window-active"
                onClick={() => setChartWindow('active')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartWindow === 'active'
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Active Months
              </button>
              <button
                type="button"
                data-testid="chart-window-12m"
                onClick={() => setChartWindow('12m')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartWindow === '12m'
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                12 Months
              </button>
            </div>
          </div>
        </div>

        {/* Period Totals KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/80 border-b border-slate-200">
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Period Purchase Volume
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {trendPeriodTotals.purchaseVolume.toLocaleString()} KG
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Period Purchase Value
            </div>
            <div className="text-sm sm:text-base font-bold text-sky-800 font-mono tabular-nums mt-0.5">
              {formatCurrency(trendPeriodTotals.purchaseValue, companyProfile.currency)}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Period Export Value ({trendPeriodTotals.exportWeight.toLocaleString()} KG)
            </div>
            <div className="text-sm sm:text-base font-bold text-teal-800 font-mono tabular-nums mt-0.5">
              {formatCurrency(trendPeriodTotals.exportValue, companyProfile.currency)}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Period Net Profit
            </div>
            <div
              className={`text-sm sm:text-base font-bold font-mono tabular-nums mt-0.5 ${
                trendPeriodTotals.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatCurrency(trendPeriodTotals.netProfit, companyProfile.currency)}
            </div>
          </div>
        </div>

        {/* Recharts BarChart Canvas */}
        <div className="p-5">
          <div className="w-full h-[270px]">
            <ResponsiveContainer width="100%" height={270}>
              {chartViewMode === 'value' ? (
                <BarChart
                  data={monthlyTrends}
                  margin={{ top: 8, right: 16, left: 4, bottom: 2 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortMonthLabel"
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val: number) =>
                      val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)
                    }
                    tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    width={52}
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
                    wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                  />
                  <Bar
                    dataKey="purchaseValue"
                    name={`Purchase Value (${companyProfile.currency})`}
                    fill="#0284c7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="exportValue"
                    name={`Export Value (${companyProfile.currency})`}
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="netProfit"
                    name={`Net Profit (${companyProfile.currency})`}
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                </BarChart>
              ) : chartViewMode === 'volume_vs_value' ? (
                <BarChart
                  data={monthlyTrends}
                  margin={{ top: 8, right: 16, left: 4, bottom: 2 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortMonthLabel"
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(val: number) => `${val}kg`}
                    tick={{ fill: '#0284c7', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#93c5fd' }}
                    tickLine={false}
                    width={56}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(val: number) =>
                      val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)
                    }
                    tick={{ fill: '#0d9488', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#5eead4' }}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const label = String(name);
                      if (label.includes(companyProfile.currency)) {
                        return [formatCurrency(Number(value) || 0, companyProfile.currency), label];
                      }
                      return [`${Number(value || 0).toLocaleString()} KG/PCS`, label];
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
                    wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="purchaseVolume"
                    name="Purchase Volume (KG/PCS)"
                    fill="#0284c7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="exportWeight"
                    name="Export Weight (KG)"
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="exportValue"
                    name={`Export Value (${companyProfile.currency})`}
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={monthlyTrends}
                  margin={{ top: 8, right: 16, left: 4, bottom: 2 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortMonthLabel"
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val: number) => `${val}`}
                    tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${Number(value || 0).toLocaleString()}`,
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
                    wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                  />
                  <Bar
                    dataKey="purchaseVolume"
                    name="Purchase Volume (KG/PCS)"
                    fill="#0284c7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="exportWeight"
                    name="Export Weight (KG)"
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="exportBoxes"
                    name="Shipped Boxes"
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top 5 Suppliers by Total Purchase Volume (Recharts BarChart & Leaderboard) */}
      <TopSuppliersChart />

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
                Sheets 02 – 06
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

              {/* Sheet 04: Supplier Payment Form */}
              <button
                type="button"
                onClick={() => setActiveTab('payment_form')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-600/70 bg-white hover:bg-indigo-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 04 · Local Ledger</span>
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

              {/* Sheet 05: Exporter Payment Form */}
              <button
                type="button"
                onClick={() => setActiveTab('exporter_payment_form')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-teal-700/70 bg-white hover:bg-teal-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 05 · Foreign Buyers</span>
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

              {/* Sheet 06: Exporter Payment Slip (付款单) */}
              <button
                type="button"
                onClick={() => setActiveTab('exporter_payment_slip')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-amber-600/70 bg-white hover:bg-amber-50/25 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 06 · Bilingual Slip</span>
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

              {/* Sheet 12: Settings & Config */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="group text-left p-4 rounded-xl border border-slate-200 hover:border-slate-500 bg-white hover:bg-slate-50 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Sheet 12 · Configuration</span>
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
              <span>Open Search &amp; Reports (Sheet 11)</span>
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
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold tracking-wide text-white">
              Recent System Activities
            </h2>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-xs text-slate-400">
              Latest archived vouchers and manifests across all ledgers
            </span>
          </div>

          {/* Interactive Activity Filter */}
          <div
            role="group"
            aria-label="Filter recent activities"
            className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700"
          >
            {(['ALL', 'Purchase', 'Packing', 'Payment'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActivityFilter(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activityFilter === tab
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab === 'ALL' ? 'All Records' : `${tab}s`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
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
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No matching records found for this filter.
                  </td>
                </tr>
              ) : (
                recentActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
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
      </section>

      {/* Quick Entry CSV Bulk Upload Modal */}
      <QuickEntryModal
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
      />
    </div>
  );
};
