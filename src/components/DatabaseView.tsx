import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  formatCurrency,
  formatDate,
  classifyPaymentCategory,
  calculatePackingTotalAmountBDT,
} from '../utils/calculations.ts';
import {
  FileSpreadsheet,
  Printer,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  Search,
  Download,
  Filter,
  Calendar,
  X,
  RotateCcw,
  Edit2,
} from 'lucide-react';
import {
  downloadCsvFile,
  generatePurchasesCSV,
  generatePackingsCSV,
  generatePaymentsCSV,
} from '../utils/csvExporter.ts';
import {
  isDateInRange,
  getDateRangePreset,
  DatePresetKey,
} from '../utils/dateFilters.ts';

interface DatabaseViewProps {
  initialType?: 'purchase' | 'packing' | 'payment';
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ initialType = 'purchase' }) => {
  const {
    purchases,
    deletePurchase,
    packings,
    updatePacking,
    deletePacking,
    payments,
    deletePayment,
    companyProfile,
    openPrintModal,
    showToast,
    clearAllDatabaseRecords,
    setActiveTab,
    setEditingPackingId,
    setEditingPurchaseId,
  } = useApp();

  const [activeDbType, setActiveDbType] = useState<'purchase' | 'packing' | 'payment'>(initialType);
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState<'all' | 'supplier' | 'exporter'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Date-range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<DatePresetKey>('all');

  const handleSelectAll = (allIds: string[]) => {
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Date range presets
  const applyPreset = (preset: DatePresetKey) => {
    setActivePreset(preset);
    const range = getDateRangePreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setSelectedIds([]);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setActivePreset('all');
    setSelectedIds([]);
  };

  const handleBatchPrint = () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one record using the checkboxes to batch print.');
      return;
    }

    let records: any[] = [];
    if (activeDbType === 'purchase') {
      records = purchases.filter((p) => selectedIds.includes(p.id));
    } else if (activeDbType === 'packing') {
      records = packings.filter((p) => selectedIds.includes(p.id));
    } else {
      records = payments.filter((p) => selectedIds.includes(p.id));
    }

    openPrintModal({
      type: 'batch_print',
      title: `Batch Print (${records.length} Documents) - ${activeDbType.toUpperCase()} DB`,
      data: {
        dbType: activeDbType,
        records,
      },
      selectedIds,
    });
  };

  // Filtered lists reactive to both search term and date range
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesSearch =
        !searchTerm.trim() ||
        p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = isDateInRange(p.date, startDate, endDate);
      return matchesSearch && matchesDate;
    });
  }, [purchases, searchTerm, startDate, endDate]);

  const filteredPackings = useMemo(() => {
    return packings.filter((pkg) => {
      const matchesSearch =
        !searchTerm.trim() ||
        pkg.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.shippingMark.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.shipper.toLowerCase().includes(searchTerm.toLowerCase());
      const dateToMatch = pkg.packingDate || pkg.fromDate || pkg.toDate;
      const matchesDate = isDateInRange(dateToMatch, startDate, endDate);
      return matchesSearch && matchesDate;
    });
  }, [packings, searchTerm, startDate, endDate]);

  const filteredPayments = useMemo(() => {
    return payments.filter((pm) => {
      const cat = classifyPaymentCategory(pm);
      if (paymentCategoryFilter !== 'all' && cat !== paymentCategoryFilter) {
        return false;
      }
      const matchesSearch =
        !searchTerm.trim() ||
        pm.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pm.shippingMark || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.status.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = isDateInRange(pm.date, startDate, endDate);
      return matchesSearch && matchesDate;
    });
  }, [payments, paymentCategoryFilter, searchTerm, startDate, endDate]);

  // Current active filtered records count and total records
  const currentFilteredCount =
    activeDbType === 'purchase'
      ? filteredPurchases.length
      : activeDbType === 'packing'
      ? filteredPackings.length
      : filteredPayments.length;

  const totalUnfilteredCount =
    activeDbType === 'purchase'
      ? purchases.length
      : activeDbType === 'packing'
      ? packings.length
      : payments.length;

  // Export current database view as Excel-compatible CSV file
  const handleExportCSV = () => {
    const today = new Date().toISOString().slice(0, 10);
    const dateRangeTag =
      startDate || endDate
        ? `_${startDate || 'start'}_to_${endDate || 'end'}`
        : `_${today}`;

    if (activeDbType === 'purchase') {
      if (filteredPurchases.length === 0) {
        showToast('No purchase records in current filtered view to export.');
        return;
      }
      const csv = generatePurchasesCSV(filteredPurchases);
      const filename = `ZSB_Aquatics_Purchases${dateRangeTag}.csv`;
      downloadCsvFile(csv, filename);
      showToast(`Exported ${filteredPurchases.length} purchase records to Excel CSV (${filename})`);
    } else if (activeDbType === 'packing') {
      if (filteredPackings.length === 0) {
        showToast('No packing records in current filtered view to export.');
        return;
      }
      const csv = generatePackingsCSV(filteredPackings);
      const filename = `ZSB_Aquatics_Packing_Lists${dateRangeTag}.csv`;
      downloadCsvFile(csv, filename);
      showToast(`Exported ${filteredPackings.length} packing records to Excel CSV (${filename})`);
    } else {
      if (filteredPayments.length === 0) {
        showToast('No payment records in current filtered view to export.');
        return;
      }
      const csv = generatePaymentsCSV(filteredPayments);
      const filename = `ZSB_Aquatics_Payments${dateRangeTag}.csv`;
      downloadCsvFile(csv, filename);
      showToast(`Exported ${filteredPayments.length} payment records to Excel CSV (${filename})`);
    }
  };

  const isDateFilterActive = Boolean(startDate || endDate);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-[#1b2b44] text-white px-5 py-3 rounded-lg shadow-md flex flex-wrap items-center justify-between gap-4 border-b-2 border-amber-500">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-xl sm:text-2xl font-black tracking-wider text-amber-400 font-serif uppercase">
              {companyProfile.companyName}
            </span>
            <span className="text-lg text-slate-300">|</span>
            <span className="text-sm sm:text-base font-semibold text-slate-100 uppercase tracking-wide">
              Master Database Sheets &amp; Batch Print Center
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Filter by Date Range, Export to Excel CSV, Select records for Batch Print, or audit transactions
          </p>
        </div>

        {/* Database Switcher Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => {
              setActiveDbType('purchase');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition ${
              activeDbType === 'purchase'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Purchase DB ({purchases.length})
          </button>
          <button
            onClick={() => {
              setActiveDbType('packing');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition ${
              activeDbType === 'packing'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Packing DB ({packings.length})
          </button>
          <button
            onClick={() => {
              setActiveDbType('payment');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition ${
              activeDbType === 'payment'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Payment DB ({payments.length})
          </button>
        </div>
      </div>

      {/* Date-Range Filter & Preset Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Date Range Filter
              </span>
              <p className="text-[11px] text-slate-500">
                Narrow down records by invoice, packing, or voucher transaction dates
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Presets:</span>
            {(
              [
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'this_week', label: 'This Week' },
                { key: 'this_month', label: 'This Month' },
                { key: 'last_30_days', label: 'Last 30 Days' },
                { key: 'this_year', label: 'This Year' },
              ] as const
            ).map((p) => {
              const isSelected = activePreset === p.key && (!startDate || p.key !== 'all' || !endDate);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                    activePreset === p.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Inputs & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <label htmlFor="filter-from-date" className="text-xs font-semibold text-slate-600">
                From Date:
              </label>
              <input
                id="filter-from-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('all');
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white text-slate-800 font-mono"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="filter-to-date" className="text-xs font-semibold text-slate-600">
                To Date:
              </label>
              <input
                id="filter-to-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('all');
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white text-slate-800 font-mono"
              />
            </div>

            {isDateFilterActive && (
              <button
                type="button"
                onClick={clearDateFilter}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                title="Clear date filter"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Reset Dates</span>
              </button>
            )}
          </div>

          {/* Filter Status Badge */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500">
              Showing{' '}
              <strong className="text-blue-900 font-bold">{currentFilteredCount}</strong> of{' '}
              <strong className="text-slate-700">{totalUnfilteredCount}</strong> records
            </span>
            {isDateFilterActive && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                Date Filter Active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Actions (Export CSV, Batch Print) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-64 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Search ${activeDbType} records by doc no, party, or mark...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Action Buttons: Export to CSV & Batch Print */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export to CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white cursor-pointer"
            title={`Export current filtered ${activeDbType} view as Excel-compatible CSV`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>EXPORT CSV ({currentFilteredCount})</span>
          </button>

          {/* Batch Print Button */}
          <button
            type="button"
            onClick={handleBatchPrint}
            disabled={selectedIds.length === 0}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition ${
              selectedIds.length > 0
                ? 'bg-[#1b2b44] hover:bg-slate-800 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>BATCH PRINT ({selectedIds.length})</span>
          </button>

          {/* Clear All Database Records Button */}
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Are you sure you want to clear ALL database records? This will delete all purchases, packings, payments, and expenses permanently.'
                )
              ) {
                clearAllDatabaseRecords();
                setSelectedIds([]);
              }
            }}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 cursor-pointer"
            title="Clear all database records permanently"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>CLEAR ALL RECORDS</span>
          </button>

          <span className="text-xs text-slate-500 pl-1">
            Selected: <strong className="text-slate-900">{selectedIds.length}</strong>
          </span>
        </div>
      </div>

      {/* Database Tables */}
      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        {activeDbType === 'purchase' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1b73b4] text-white font-bold uppercase text-[11px] border-b border-blue-900">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredPurchases.length > 0 &&
                        selectedIds.length === filteredPurchases.length
                      }
                      onChange={() =>
                        handleSelectAll(filteredPurchases.map((p) => p.id))
                      }
                    />
                  </th>
                  <th className="p-3">INVOICE NO</th>
                  <th className="p-3">DATE</th>
                  <th className="p-3">SUPPLIER / DESCRIPTION</th>
                  <th className="p-3">CONTACT</th>
                  <th className="p-3 text-center">ITEMS</th>
                  <th className="p-3 text-right">TOTAL QTY</th>
                  <th className="p-3 text-right">TOTAL AMOUNT</th>
                  <th className="p-3 text-right">BALANCE</th>
                  <th className="p-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No purchase records found.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-blue-50/40 transition ${
                          isSelected ? 'bg-blue-50/80' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(p.id)}
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-900">
                          {p.invoiceNumber}
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {formatDate(p.date)}
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          {p.description}
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {p.contactNumber || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                            {p.items?.length || 0} Lines
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {p.totalQty}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(p.totalAmount, companyProfile.currency)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700">
                          {formatCurrency(p.balance, companyProfile.currency)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => {
                                setEditingPurchaseId(p.id);
                                setActiveTab('purchase_form');
                              }}
                              className="px-2 py-1 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition flex items-center space-x-1"
                              title="Edit Purchase Bill"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>EDIT</span>
                            </button>
                            <button
                              onClick={() =>
                                openPrintModal({
                                  type: 'purchase',
                                  title: `Purchase Challan - ${p.invoiceNumber}`,
                                  data: p,
                                  items: p.items,
                                })
                              }
                              className="px-2 py-1 text-[11px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition flex items-center space-x-1"
                              title="Print or Save PDF"
                            >
                              <Printer className="w-3 h-3" />
                              <span>PDF</span>
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete purchase invoice ${p.invoiceNumber}?`
                                  )
                                ) {
                                  deletePurchase(p.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Delete"
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
        )}

        {activeDbType === 'packing' && (
          <div>
            <div className="px-4 py-2 bg-teal-50/70 border-b border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold text-teal-950">
                Packing List Ledger — Live BDT Conversion
              </div>
              <div className="font-mono text-[11px] font-semibold text-teal-900 bg-white px-2.5 py-0.5 rounded border border-teal-200">
                Formula: <strong>Total Value (RMB) × RMB Rate = Total Amount (BDT)</strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12776c] text-white font-bold uppercase text-[11px] border-b border-teal-900">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredPackings.length > 0 &&
                          selectedIds.length === filteredPackings.length
                        }
                        onChange={() =>
                          handleSelectAll(filteredPackings.map((p) => p.id))
                        }
                      />
                    </th>
                    <th className="p-3">PACKING NO</th>
                    <th className="p-3">DATE</th>
                    <th className="p-3">SHIPPING MARK</th>
                    <th className="p-3">FLIGHT</th>
                    <th className="p-3">DESTINATION</th>
                    <th className="p-3">SHIPPER</th>
                    <th className="p-3 text-right">TOTAL BOX</th>
                    <th className="p-3 text-right">TOTAL WEIGHT</th>
                    <th className="p-3 text-right">TOTAL VALUE</th>
                    <th className="p-3 text-right">RMB RATE (EDITABLE)</th>
                    <th className="p-3 text-right">TOTAL AMOUNT (BDT)</th>
                    <th className="p-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredPackings.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-slate-400">
                        No packing list records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPackings.map((pkg) => {
                      const isSelected = selectedIds.includes(pkg.id);
                      const computedAmountBDT = calculatePackingTotalAmountBDT(
                        pkg.totalAmount,
                        pkg.rmbRate
                      );
                      return (
                      <tr
                        key={pkg.id}
                        className={`hover:bg-teal-50/40 transition ${
                          isSelected ? 'bg-teal-50/80' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(pkg.id)}
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-teal-900">
                          {pkg.invoiceNumber}
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {formatDate(pkg.packingDate)}
                        </td>
                        <td className="p-3 font-black text-blue-900">
                          {pkg.shippingMark}
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          {pkg.flight}
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          {pkg.destination}
                        </td>
                        <td className="p-3 text-slate-700">{pkg.shipper}</td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {pkg.totalBox}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-teal-800">
                          {pkg.totalWeight} KG
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(pkg.totalAmount, 'RMB')}
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label={`RMB Rate for ${pkg.invoiceNumber}`}
                            placeholder="0.00"
                            value={pkg.rmbRate ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsedRate = raw === '' ? 0 : parseFloat(raw) || 0;
                              const nextTotalAmountBDT = calculatePackingTotalAmountBDT(
                                pkg.totalAmount,
                                parsedRate
                              );
                              updatePacking(
                                pkg.id,
                                {
                                  rmbRate: raw === '' ? undefined : parsedRate,
                                  totalAmountBDT: nextTotalAmountBDT,
                                },
                                true
                              );
                            }}
                            className="w-24 px-2 py-1 text-right font-mono font-bold text-amber-950 bg-amber-50 border border-amber-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                          {formatCurrency(computedAmountBDT, 'BDT')}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => {
                                setEditingPackingId(pkg.id);
                                setActiveTab('packing_form');
                                showToast(`Loaded manifest ${pkg.invoiceNumber} for editing.`);
                              }}
                              className="px-2 py-1 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition flex items-center space-x-1 cursor-pointer"
                              title={`Edit Packing List ${pkg.invoiceNumber}`}
                            >
                              <Edit2 className="w-3 h-3 text-amber-700" />
                              <span>EDIT</span>
                            </button>
                            <button
                              onClick={() =>
                                openPrintModal({
                                  type: 'packing',
                                  title: `Export Packing List - ${pkg.invoiceNumber}`,
                                  data: pkg,
                                  items: pkg.items,
                                })
                              }
                              className="px-2 py-1 text-[11px] font-bold bg-teal-100 hover:bg-teal-200 text-teal-800 rounded transition flex items-center space-x-1 cursor-pointer"
                              title="Print or Save PDF"
                            >
                              <Printer className="w-3 h-3" />
                              <span>PDF</span>
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete packing list ${pkg.invoiceNumber}?`
                                  )
                                ) {
                                  deletePacking(pkg.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Delete"
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
              {filteredPackings.length > 0 && (
                <tfoot>
                  <tr className="bg-teal-50 font-black border-t-2 border-teal-200 text-xs">
                    <td colSpan={7} className="p-3 text-right uppercase text-teal-950">
                      PACKING DB TOTALS:
                    </td>
                    <td className="p-3 text-right font-mono text-slate-900">
                      {filteredPackings.reduce((acc, p) => acc + (Number(p.totalBox) || 0), 0)}
                    </td>
                    <td className="p-3 text-right font-mono text-teal-800">
                      {Math.round(
                        filteredPackings.reduce((acc, p) => acc + (Number(p.totalWeight) || 0), 0) *
                          100
                      ) / 100}{' '}
                      KG
                    </td>
                    <td className="p-3 text-right font-mono text-slate-900">
                      {formatCurrency(
                        filteredPackings.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0),
                        'RMB'
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-500 text-[10px]">
                      × RMB RATE =
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-800 bg-emerald-100/60">
                      {formatCurrency(
                        filteredPackings.reduce(
                          (acc, p) =>
                            acc + calculatePackingTotalAmountBDT(p.totalAmount, p.rmbRate),
                          0
                        ),
                        'BDT'
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          </div>
        )}

        {activeDbType === 'payment' && (
          <div>
            {/* Payment Category Filter Bar */}
            <div className="px-4 py-2.5 bg-purple-50/70 border-b border-purple-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-purple-950 uppercase">Filter Payment Ledger:</span>
                <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-purple-200">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentCategoryFilter('all');
                      setSelectedIds([]);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                      paymentCategoryFilter === 'all'
                        ? 'bg-purple-700 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    All Vouchers ({payments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentCategoryFilter('supplier');
                      setSelectedIds([]);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                      paymentCategoryFilter === 'supplier'
                        ? 'bg-[#8b3858] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Supplier Payments (
                    {payments.filter((p) => classifyPaymentCategory(p) === 'supplier').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentCategoryFilter('exporter');
                      setSelectedIds([]);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                      paymentCategoryFilter === 'exporter'
                        ? 'bg-[#126b62] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Exporter Payments (
                    {payments.filter((p) => classifyPaymentCategory(p) === 'exporter').length})
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#793282] text-white font-bold uppercase text-[11px] border-b border-purple-900">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredPayments.length > 0 &&
                          selectedIds.length === filteredPayments.length
                        }
                        onChange={() =>
                          handleSelectAll(filteredPayments.map((p) => p.id))
                        }
                      />
                    </th>
                    <th className="p-3">PAYMENT NO</th>
                    <th className="p-3">TYPE</th>
                    <th className="p-3">DATE</th>
                    <th className="p-3">PARTY / MARK</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3 text-right">PAID AMOUNT</th>
                    <th className="p-3 text-right">BALANCE</th>
                    <th className="p-3">EXPORT REF</th>
                    <th className="p-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No payment records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((pm) => {
                      const isSelected = selectedIds.includes(pm.id);
                      const category = classifyPaymentCategory(pm);
                      return (
                        <tr
                          key={pm.id}
                          className={`hover:bg-purple-50/40 transition ${
                            isSelected ? 'bg-purple-50/80' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(pm.id)}
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-900">
                            {pm.invoiceNumber}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                category === 'exporter'
                                  ? 'bg-teal-100 text-teal-900'
                                  : 'bg-pink-100 text-pink-900'
                              }`}
                            >
                              {category === 'exporter' ? 'EXPORTER' : 'SUPPLIER'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {formatDate(pm.date)}
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            {pm.description}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                pm.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pm.status === 'REPORT'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {pm.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(pm.paidAmount, companyProfile.currency)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-700">
                            {formatCurrency(pm.balance, companyProfile.currency)}
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {pm.exportGoodsRef || '-'}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() =>
                                  openPrintModal({
                                    type: 'payment',
                                    title: `${
                                      category === 'exporter'
                                        ? 'Exporter Payment Voucher'
                                        : 'Supplier Payment Voucher'
                                    } - ${pm.invoiceNumber}`,
                                    data: pm,
                                    items: pm.items,
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 rounded transition flex items-center space-x-1"
                                title="Print or Save PDF"
                              >
                                <Printer className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Delete payment voucher ${pm.invoiceNumber}?`
                                    )
                                  ) {
                                    deletePayment(pm.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Delete"
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
        )}
      </div>
    </div>
  );
};
