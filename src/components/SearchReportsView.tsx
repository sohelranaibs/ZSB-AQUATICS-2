import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  isDateInRange,
  getDateRangePreset,
  detectMatchingPreset,
  formatDateRangeLabel,
  getDaysInDateRange,
  DatePresetKey,
  DATE_PRESET_OPTIONS,
  filterFinancialTransactions,
  calculateConsolidatedFinancials,
  TransactionKind,
} from '../utils/dateFilters.ts';
import {
  generateDateFilteredFinancialTransactionsCSV,
  downloadCsvFile,
} from '../utils/csvExporter.ts';
import {
  Search,
  Calendar,
  Filter,
  Printer,
  FileText,
  RotateCcw,
  Package,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Receipt,
  Layers,
  ArrowDownUp,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export const SearchReportsView: React.FC = () => {
  const {
    companyProfile,
    purchases,
    packings,
    payments,
    otherCosts,
    dropdownOptions,
    openPrintModal,
    showToast,
  } = useApp();

  // Date Range State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<DatePresetKey>('all');

  // Multi-Field Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [shipperFilter, setShipperFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [shippingMarkFilter, setShippingMarkFilter] = useState<string>('ALL');
  const [activeKindTab, setActiveKindTab] = useState<TransactionKind | 'all'>('all');

  // Statement Month State for PDF generation
  const [statementMonth, setStatementMonth] = useState<string>(
    () => new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  // Handle Preset selection
  const handleSelectPreset = (preset: DatePresetKey) => {
    setActivePreset(preset);
    const range = getDateRangePreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  // Handle manual date input changes
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setActivePreset(detectMatchingPreset(val, endDate));
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setActivePreset(detectMatchingPreset(startDate, val));
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setActivePreset('all');
    setSearchQuery('');
    setShipperFilter('ALL');
    setSupplierFilter('ALL');
    setShippingMarkFilter('ALL');
    setActiveKindTab('all');
    showToast('Filters cleared — displaying all records.');
  };

  // Perform reactive multi-ledger filtering
  const allKindsFiltered = useMemo(() => {
    return filterFinancialTransactions(
      purchases,
      packings,
      payments,
      otherCosts,
      {
        startDate,
        endDate,
        searchQuery,
        shipper: shipperFilter,
        supplier: supplierFilter,
        shippingMark: shippingMarkFilter,
        kind: 'all',
      },
      companyProfile.rmbExchangeRate || 18.0
    );
  }, [
    purchases,
    packings,
    payments,
    otherCosts,
    startDate,
    endDate,
    searchQuery,
    shipperFilter,
    supplierFilter,
    shippingMarkFilter,
    companyProfile.rmbExchangeRate,
  ]);

  const {
    filteredPurchases,
    filteredPackings,
    filteredPayments,
    filteredOtherCosts,
    unifiedTransactions,
  } = useMemo(() => {
    if (activeKindTab === 'all') {
      return allKindsFiltered;
    }
    return filterFinancialTransactions(
      purchases,
      packings,
      payments,
      otherCosts,
      {
        startDate,
        endDate,
        searchQuery,
        shipper: shipperFilter,
        supplier: supplierFilter,
        shippingMark: shippingMarkFilter,
        kind: activeKindTab,
      },
      companyProfile.rmbExchangeRate || 18.0
    );
  }, [
    allKindsFiltered,
    purchases,
    packings,
    payments,
    otherCosts,
    startDate,
    endDate,
    searchQuery,
    shipperFilter,
    supplierFilter,
    shippingMarkFilter,
    activeKindTab,
    companyProfile.rmbExchangeRate,
  ]);

  // Compute consolidated financial metrics based on the active date range
  const financialSummary = useMemo(() => {
    return calculateConsolidatedFinancials(
      allKindsFiltered.filteredPurchases,
      allKindsFiltered.filteredPackings,
      allKindsFiltered.filteredPayments,
      allKindsFiltered.filteredOtherCosts,
      companyProfile.rmbExchangeRate || 18.0
    );
  }, [allKindsFiltered, companyProfile.rmbExchangeRate]);

  // Handle Export Filtered Transactions to CSV
  const handleExportFilteredCSV = () => {
    try {
      const csvContent = generateDateFilteredFinancialTransactionsCSV({
        startDate,
        endDate,
        purchases: filteredPurchases,
        packings: filteredPackings,
        payments: filteredPayments,
        otherCosts: filteredOtherCosts,
        rmbExchangeRate: companyProfile.rmbExchangeRate || 18.0,
        companyName: companyProfile.companyName || 'ZSB AQUATICS',
      });

      const dateSuffix =
        startDate && endDate
          ? `${startDate}_to_${endDate}`
          : startDate
          ? `from_${startDate}`
          : endDate
          ? `up_to_${endDate}`
          : 'all_time';

      const filename = `ZSB_Aquatics_Financial_Transactions_${dateSuffix}.csv`;
      downloadCsvFile(csvContent, filename);
      showToast(`Exported ${financialSummary.totalTransactionsCount} transactions to ${filename}`);
    } catch (err: any) {
      showToast(`Export failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Handle Monthly Statement Generation (PDF)
  const handleGenerateMonthlyStatement = () => {
    const monthPurchases = purchases.filter((p) => p.date.startsWith(statementMonth));
    const monthPackings = packings.filter((p) => p.packingDate.startsWith(statementMonth));
    const monthPayments = payments.filter((p) => p.date.startsWith(statementMonth));

    openPrintModal({
      type: 'monthly_statement',
      title: `Monthly Business & Export Statement - ${statementMonth}`,
      data: {
        statementMonth,
        purchases: monthPurchases,
        packings: monthPackings,
        payments: monthPayments,
        totalPurchases: monthPurchases.reduce((a, b) => a + b.totalAmount, 0),
        totalExport: monthPackings.reduce((a, b) => a + b.totalAmount, 0),
        totalWeight: monthPackings.reduce((a, b) => a + b.totalWeight, 0),
        totalPayments: monthPayments.reduce((a, b) => a + b.paidAmount, 0),
      },
    });
  };

  // Handle Batch Print of Filtered Transactions
  const handlePrintFilteredReport = () => {
    const activeRangeDescription = formatDateRangeLabel(startDate, endDate);

    openPrintModal({
      type: 'batch_print',
      title: `Consolidated Financial Report — ${activeRangeDescription}`,
      data: {
        dbType: 'filtered_multi',
        records: [
          ...filteredPurchases.map((p) => ({ ...p, _kind: 'Purchase' })),
          ...filteredPackings.map((p) => ({ ...p, _kind: 'Packing' })),
          ...filteredPayments.map((p) => ({ ...p, _kind: 'Payment' })),
          ...filteredOtherCosts.map((c) => ({ ...c, _kind: 'OtherCost' })),
        ],
        filters: {
          shipper: shipperFilter,
          supplier: supplierFilter,
          shippingMark: shippingMarkFilter,
          fromDate: startDate,
          toDate: endDate,
        },
      },
    });
  };

  const isFilterActive =
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(searchQuery) ||
    shipperFilter !== 'ALL' ||
    supplierFilter !== 'ALL' ||
    shippingMarkFilter !== 'ALL' ||
    activeKindTab !== 'all';

  const dateIntervalDays = getDaysInDateRange(startDate, endDate);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1b2b44] text-white px-5 py-3 rounded-lg shadow-md flex flex-wrap items-center justify-between gap-4 border-b-2 border-amber-500">
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
                Financial Search &amp; Global Reports
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Comprehensive timeframe analysis across Purchases, Export Cargo, Payments &amp; Operational Costs
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportFilteredCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow transition cursor-pointer"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrintFilteredReport}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded shadow transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Global Date Range Picker Box */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Date Filter Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-500/30 flex items-center justify-center text-blue-200 border border-blue-400/40">
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Global Date Range Filter
              </span>
              <span className="text-[11px] text-blue-200 ml-2 hidden sm:inline">
                Controls all financial transactions and summary metrics
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            {activePreset !== 'all' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono font-bold text-[11px]">
                Preset: {DATE_PRESET_OPTIONS.find((o) => o.key === activePreset)?.label || 'Custom'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                All Historical Time
              </span>
            )}

            {isFilterActive && (
              <button
                onClick={handleResetFilters}
                className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold bg-rose-600/80 hover:bg-rose-600 text-white rounded transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Quick Preset Buttons */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Quick Date Presets:</span>
              <span className="text-[10px] text-slate-400 font-normal">Click to apply instant date bounds</span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {DATE_PRESET_OPTIONS.map((opt) => {
                const isSelected = activePreset === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectPreset(opt.key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 scale-[1.02]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-amber-300" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range Inputs & Status Indicator */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100 items-center">
            {/* From Date */}
            <div className="md:col-span-4">
              <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase">
                From Date (Start)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {startDate && (
                  <button
                    type="button"
                    onClick={() => handleStartDateChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear start date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* To Date */}
            <div className="md:col-span-4">
              <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase">
                To Date (End)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {endDate && (
                  <button
                    type="button"
                    onClick={() => handleEndDateChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear end date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Active Range Summary Pill */}
            <div className="md:col-span-4">
              <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase">
                Active Timeframe Window
              </label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs">
                <div className="font-semibold text-blue-900 truncate">
                  {formatDateRangeLabel(startDate, endDate)}
                </div>
                {dateIntervalDays !== null && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-200/80 text-blue-900 rounded font-mono font-bold text-[10px] shrink-0">
                    {dateIntervalDays}d
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Search & Multi-Field Filters */}
        <div className="bg-slate-50 p-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Free Search */}
            <div>
              <label className="font-bold text-slate-700 block mb-1 uppercase">
                Free-Text Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Invoice #, party, note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-slate-800 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Shipper */}
            <div>
              <label className="font-bold text-slate-700 block mb-1 uppercase">Shipper</label>
              <select
                value={shipperFilter}
                onChange={(e) => setShipperFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Shippers</option>
                {dropdownOptions.shippers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Name */}
            <div>
              <label className="font-bold text-slate-700 block mb-1 uppercase">Supplier Name</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Suppliers</option>
                {dropdownOptions.suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Shipping Mark */}
            <div>
              <label className="font-bold text-slate-700 block mb-1 uppercase">Shipping Mark</label>
              <select
                value={shippingMarkFilter}
                onChange={(e) => setShippingMarkFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Shipping Marks</option>
                {dropdownOptions.shippingMarks.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Financial Rollup Metrics Cards for Active Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Purchases Total Card */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">
              Purchases (BDT)
            </span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-700 font-mono mt-1">
            {formatCurrency(financialSummary.totalPurchasesBDT, companyProfile.currency)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span>{financialSummary.purchasesCount} Invoices</span>
            <span className="text-rose-600 font-bold">
              Due: {formatCurrency(financialSummary.purchasesBalanceBDT, companyProfile.currency)}
            </span>
          </div>
        </div>

        {/* Export Cargo Value Card */}
        <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wide">
              Export Cargo (BDT)
            </span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-black text-teal-700 font-mono mt-1">
            {formatCurrency(financialSummary.totalExportBDT, companyProfile.currency)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span className="font-bold text-amber-700">
              ¥ {financialSummary.totalExportRMB.toLocaleString()} RMB
            </span>
            <span>{financialSummary.packingsCount} Shipments</span>
          </div>
        </div>

        {/* Export Weight & Cargo Volume Card */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">
              Export Volume
            </span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 font-mono mt-1">
            {financialSummary.totalExportWeightKG.toLocaleString()} KG
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span>{financialSummary.totalExportBoxes} Boxes</span>
            <span className="font-medium text-slate-600">Live Eel Fish</span>
          </div>
        </div>

        {/* Payments Made Card */}
        <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">
              Payments Disbursed
            </span>
            <CreditCard className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-purple-700 font-mono mt-1">
            {formatCurrency(financialSummary.totalPaymentsBDT, companyProfile.currency)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span>{financialSummary.paymentsCount} Vouchers</span>
            <span className="text-slate-400">Paid out</span>
          </div>
        </div>

        {/* Net Operating Position / Margin Card */}
        <div
          className={`p-3.5 rounded-xl border shadow-sm relative overflow-hidden ${
            financialSummary.netOperatingMarginBDT >= 0
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-rose-50/70 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
              Net Operating Margin
            </span>
            {financialSummary.netOperatingMarginBDT >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div
            className={`text-xl font-black font-mono mt-1 ${
              financialSummary.netOperatingMarginBDT >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(financialSummary.netOperatingMarginBDT, companyProfile.currency)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span>Costs: {formatCurrency(financialSummary.totalOtherCostsBDT, companyProfile.currency)}</span>
            <span className="font-semibold text-slate-700">
              {financialSummary.netOperatingMarginBDT >= 0 ? 'SURPLUS' : 'DEFICIT'}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Stream Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveKindTab('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeKindTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Transactions ({financialSummary.totalTransactionsCount})</span>
          </button>

          <button
            onClick={() => setActiveKindTab('packing')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeKindTab === 'packing'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-teal-500" />
            <span>Export Cargo ({filteredPackings.length})</span>
          </button>

          <button
            onClick={() => setActiveKindTab('purchase')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeKindTab === 'purchase'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
            <span>Purchases ({filteredPurchases.length})</span>
          </button>

          <button
            onClick={() => setActiveKindTab('payment')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeKindTab === 'payment'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-purple-500" />
            <span>Payments ({filteredPayments.length})</span>
          </button>

          <button
            onClick={() => setActiveKindTab('other_cost')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeKindTab === 'other_cost'
                ? 'bg-amber-700 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-amber-500" />
            <span>Operational Costs ({filteredOtherCosts.length})</span>
          </button>
        </div>

        {/* Monthly Statement Quick Box */}
        <div className="flex items-center space-x-2 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-purple-700" />
          <span className="text-[11px] font-bold text-purple-950 uppercase hidden sm:inline">
            Statement:
          </span>
          <input
            type="month"
            value={statementMonth}
            onChange={(e) => setStatementMonth(e.target.value)}
            className="border border-purple-300 rounded px-2 py-0.5 text-xs font-mono font-bold text-purple-900 bg-white"
          />
          <button
            onClick={handleGenerateMonthlyStatement}
            className="flex items-center space-x-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-[11px] font-bold uppercase transition cursor-pointer"
          >
            <FileText className="w-3 h-3" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        {/* Table Title Bar */}
        <div className="px-5 py-3 bg-slate-900 text-white font-bold text-xs uppercase flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ArrowDownUp className="w-4 h-4 text-amber-400" />
            <span>
              {activeKindTab === 'all'
                ? 'Consolidated Financial Transactions Stream'
                : activeKindTab === 'packing'
                ? 'Export Shipments & Packing Lists'
                : activeKindTab === 'purchase'
                ? 'Purchase Invoices & Challans'
                : activeKindTab === 'payment'
                ? 'Party & Supplier Payment Vouchers'
                : 'Operational Overhead & Other Expenses'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
              {unifiedTransactions.length} records matching timeframe
            </span>
          </div>

          <span className="text-[11px] text-slate-300 font-normal hidden sm:inline">
            Sorted chronologically (Newest first)
          </span>
        </div>

        {unifiedTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="text-base font-bold text-slate-800">
              No financial transactions found in this timeframe
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are no records matching the selected date range ({formatDateRangeLabel(startDate, endDate)})
              {searchQuery ? ` and search query "${searchQuery}"` : ''}.
            </p>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Show All Historical Transactions</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b">
                <tr>
                  <th className="p-2.5">DATE</th>
                  <th className="p-2.5">TYPE</th>
                  <th className="p-2.5">REF / INVOICE</th>
                  <th className="p-2.5">PARTY / ACCOUNT</th>
                  <th className="p-2.5">DETAILS &amp; NOTES</th>
                  <th className="p-2.5 text-right">AMOUNT (BDT)</th>
                  <th className="p-2.5 text-right">RMB / WEIGHT</th>
                  <th className="p-2.5">STATUS</th>
                  <th className="p-2.5 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unifiedTransactions.map((tx) => {
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>

                      {/* Transaction Type Badge */}
                      <td className="p-2.5 whitespace-nowrap">
                        {tx.kind === 'purchase' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            PURCHASE
                          </span>
                        )}
                        {tx.kind === 'packing' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                            EXPORT CARGO
                          </span>
                        )}
                        {tx.kind === 'payment' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            PAYMENT
                          </span>
                        )}
                        {tx.kind === 'other_cost' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            OTHER COST
                          </span>
                        )}
                      </td>

                      {/* Reference No */}
                      <td className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {tx.referenceNo}
                      </td>

                      {/* Party */}
                      <td className="p-2.5 font-bold text-slate-800">
                        {tx.primaryParty}
                      </td>

                      {/* Secondary Info */}
                      <td className="p-2.5 text-slate-600 max-w-xs truncate">
                        {tx.secondaryInfo}
                      </td>

                      {/* Amount BDT */}
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(tx.amountBDT, companyProfile.currency)}
                      </td>

                      {/* RMB / Weight */}
                      <td className="p-2.5 text-right font-mono text-slate-600 whitespace-nowrap">
                        {tx.amountRMB !== undefined && tx.amountRMB > 0 ? (
                          <span className="text-amber-700 font-bold">
                            ¥{tx.amountRMB.toLocaleString()}{' '}
                            <span className="text-slate-400 font-normal">
                              ({tx.weightKG} kg)
                            </span>
                          </span>
                        ) : tx.weightKG !== undefined && tx.weightKG > 0 ? (
                          <span>{tx.weightKG} kg</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            String(tx.status).includes('PAID')
                              ? 'bg-emerald-100 text-emerald-800'
                              : String(tx.status).includes('DUE')
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (tx.kind === 'purchase') {
                              const p = tx.rawRecord as any;
                              openPrintModal({
                                type: 'purchase',
                                title: `Purchase Challan - ${p.invoiceNumber}`,
                                data: p,
                                items: p.items,
                              });
                            } else if (tx.kind === 'packing') {
                              const pkg = tx.rawRecord as any;
                              openPrintModal({
                                type: 'packing',
                                title: `Packing List - ${pkg.invoiceNumber}`,
                                data: pkg,
                                items: pkg.items,
                              });
                            } else if (tx.kind === 'payment') {
                              const pm = tx.rawRecord as any;
                              openPrintModal({
                                type: 'payment',
                                title: `Payment Voucher - ${pm.invoiceNumber}`,
                                data: pm,
                                items: pm.items,
                              });
                            } else {
                              openPrintModal({
                                type: 'profit_loss',
                                title: `Operational Expense - ${tx.referenceNo}`,
                                data: tx.rawRecord,
                              });
                            }
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition cursor-pointer"
                        >
                          View PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
