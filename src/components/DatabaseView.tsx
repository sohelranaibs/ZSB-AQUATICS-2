import React, { useState, useMemo, useEffect } from 'react';
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
  UploadCloud,
  Lock,
  Archive,
  QrCode,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Zap,
  FileDown,
  Loader2,
  Layers,
} from 'lucide-react';
import { findShipmentByDeepLink } from '../utils/shipmentQrCode.ts';
import { ShipmentQrBadge } from './ShipmentQrBadge.tsx';
import {
  downloadCsvFile,
  generatePurchasesCSV,
  generatePackingsCSV,
  generatePaymentsCSV,
} from '../utils/csvExporter.ts';
import { exportDatasetFile } from '../utils/excelDataHandler.ts';
import {
  isDateInRange,
  getDateRangePreset,
  DatePresetKey,
} from '../utils/dateFilters.ts';
import {
  analyzePurchasePaymentReconciliation,
  buildSmartSyncReconciliationPlan,
} from '../utils/smartDataSync.ts';
import { exportElementsToCombinedPdf } from '../utils/pdfGenerator.ts';
import {
  formatBatchPaymentSlipsPdfFilename,
  preparePaymentRecordsForBatchExport,
} from '../utils/batchPaymentSlipPdf.ts';
import { PaymentSlipPrintCard } from './PaymentSlipPrintCard.tsx';
import { BatchUpdateSidebar } from './BatchUpdateSidebar.tsx';

interface DatabaseViewProps {
  initialType?: 'purchase' | 'packing' | 'payment';
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ initialType = 'purchase' }) => {
  const {
    purchases,
    addPurchase,
    updatePurchase,
    deletePurchase,
    packings,
    updatePacking,
    deletePacking,
    payments,
    addPayment,
    updatePayment,
    deletePayment,
    companyProfile,
    dropdownOptions,
    openPrintModal,
    openDataCenterModal,
    openSnapshotModal,
    snapshots,
    showToast,
    clearAllDatabaseRecords,
    setActiveTab,
    setEditingPackingId,
    setEditingPurchaseId,
    focusedShipmentInvoice,
    clearFocusedShipment,
  } = useApp();

  const [activeDbType, setActiveDbType] = useState<'purchase' | 'packing' | 'payment'>(() =>
    focusedShipmentInvoice ? 'packing' : initialType
  );
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState<'all' | 'supplier' | 'exporter'>('all');
  const [reconciliationFilter, setReconciliationFilter] = useState<'all' | 'discrepancies' | 'reconciled'>('all');
  const [lastSyncLog, setLastSyncLog] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>(() => focusedShipmentInvoice || '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportingBatchSlips, setIsExportingBatchSlips] = useState<boolean>(false);
  const [isBatchSidebarOpen, setIsBatchSidebarOpen] = useState<boolean>(false);

  // Selected payment records for batch export
  const selectedPaymentsForBatch = useMemo(
    () => preparePaymentRecordsForBatchExport(payments, selectedIds),
    [payments, selectedIds]
  );

  // Date-range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<DatePresetKey>('all');

  // Smart Data Sync live reconciliation analysis across Purchase DB & Payment DB
  const smartSyncAnalysis = useMemo(
    () => analyzePurchasePaymentReconciliation(purchases, payments),
    [purchases, payments]
  );

  const handleSmartSyncReconcile = (targetRecordId?: string) => {
    const plan = buildSmartSyncReconciliationPlan(purchases, payments, targetRecordId);
    if (
      plan.paymentsToCreate.length === 0 &&
      plan.purchasesToCreate.length === 0 &&
      plan.purchasesToUpdate.length === 0 &&
      plan.paymentsToUpdate.length === 0
    ) {
      showToast('Smart Data Sync: All purchase records and supplier payments are already reconciled.');
      return;
    }

    for (const newPayment of plan.paymentsToCreate) {
      addPayment(newPayment);
    }
    for (const newPurchase of plan.purchasesToCreate) {
      addPurchase(newPurchase);
    }
    for (const updPurchase of plan.purchasesToUpdate) {
      updatePurchase(updPurchase.id, updPurchase.record);
    }
    for (const updPayment of plan.paymentsToUpdate) {
      updatePayment(updPayment.id, updPayment.record);
    }

    setLastSyncLog(plan.descriptions);
    if (reconciliationFilter === 'discrepancies' && !targetRecordId) {
      setReconciliationFilter('all');
    }
    showToast(
      `Smart Data Sync reconciled ${plan.resolvedCount} discrepancy record(s) automatically.`
    );
  };

  useEffect(() => {
    if (focusedShipmentInvoice) {
      setActiveDbType('packing');
      setSearchTerm(focusedShipmentInvoice);
    }
  }, [focusedShipmentInvoice]);

  const focusedShipmentRecord = useMemo(() => {
    if (!focusedShipmentInvoice) return null;
    return findShipmentByDeepLink(packings, {
      invoiceNumber: focusedShipmentInvoice,
      shippingMark: focusedShipmentInvoice,
    });
  }, [packings, focusedShipmentInvoice]);

  useEffect(() => {
    const handleCleared = () => {
      setSelectedIds([]);
    };
    window.addEventListener('zsb-records-cleared', handleCleared);
    return () => window.removeEventListener('zsb-records-cleared', handleCleared);
  }, []);

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
      showToast('Please select at least one record using the checkboxes to batch print.');
      return;
    }

    let records: any[] = [];
    if (activeDbType === 'purchase') {
      records = purchases.filter((p) => selectedIds.includes(p.id));
      openPrintModal({
        type: 'batch_print',
        title: `Batch Print (${records.length} Documents) - PURCHASE DB`,
        data: {
          dbType: 'purchase',
          records,
        },
        selectedIds,
      });
    } else if (activeDbType === 'packing') {
      records = packings.filter((p) => selectedIds.includes(p.id));
      openPrintModal({
        type: 'batch_print',
        title: `Batch Print (${records.length} Documents) - PACKING DB`,
        data: {
          dbType: 'packing',
          records,
        },
        selectedIds,
      });
    } else {
      records = payments.filter((p) => selectedIds.includes(p.id));
      openPrintModal({
        type: 'batch_payment_slips',
        title: `Batch Payment Slips (${records.length} Documents) - Combined PDF`,
        data: {
          dbType: 'payment',
          records,
          categoryFilter: paymentCategoryFilter,
        },
        selectedIds,
      });
    }
  };

  /**
   * Batch exports multiple selected payment slips as a single combined PDF document.
   */
  const handleBatchExportPaymentSlipsPdf = async () => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one payment record using the checkboxes to batch export payment slips.');
      return;
    }

    const targetPayments = preparePaymentRecordsForBatchExport(payments, selectedIds);
    if (targetPayments.length === 0) {
      showToast('No matching payment records found for the selected IDs.');
      return;
    }

    setIsExportingBatchSlips(true);
    const filename = formatBatchPaymentSlipsPdfFilename(
      targetPayments.length,
      paymentCategoryFilter,
      startDate || endDate || undefined
    );

    showToast(`Generating combined PDF for ${targetPayments.length} payment slips...`);

    try {
      // Allow React DOM to mount and flush the offscreen elements
      await new Promise((resolve) => setTimeout(resolve, 150));

      const elementIds = targetPayments.map((_, idx) => `batch-db-slip-${idx}`);
      const success = await exportElementsToCombinedPdf(elementIds, filename, 800);

      if (success) {
        showToast(
          `Batch exported ${targetPayments.length} payment slips as single combined PDF (${filename})`
        );
      } else {
        showToast('Direct batch PDF export encountered an issue. Opening preview modal...');
        openPrintModal({
          type: 'batch_payment_slips',
          title: `Batch Payment Slips (${targetPayments.length} Documents) - Combined PDF`,
          data: {
            dbType: 'payment',
            records: targetPayments,
            categoryFilter: paymentCategoryFilter,
          },
          selectedIds,
        });
      }
    } catch (err) {
      console.error('Batch payment slips PDF export error:', err);
      showToast('Error exporting batch payment slips combined PDF.');
    } finally {
      setIsExportingBatchSlips(false);
    }
  };

  // Filtered lists reactive to search term, date range, and reconciliation status filter
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const rec = smartSyncAnalysis.purchaseReconciliations[p.id];
      if (reconciliationFilter === 'discrepancies' && !rec?.hasDiscrepancy) {
        return false;
      }
      if (reconciliationFilter === 'reconciled' && rec?.status !== 'RECONCILED') {
        return false;
      }
      const matchesSearch =
        !searchTerm.trim() ||
        p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec?.label || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = isDateInRange(p.date, startDate, endDate);
      return matchesSearch && matchesDate;
    });
  }, [purchases, smartSyncAnalysis, reconciliationFilter, searchTerm, startDate, endDate]);

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
      const rec = smartSyncAnalysis.paymentReconciliations[pm.id];
      if (reconciliationFilter === 'discrepancies' && !rec?.hasDiscrepancy) {
        return false;
      }
      if (reconciliationFilter === 'reconciled' && rec?.status !== 'RECONCILED') {
        return false;
      }
      const matchesSearch =
        !searchTerm.trim() ||
        pm.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pm.shippingMark || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        pm.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec?.label || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = isDateInRange(pm.date, startDate, endDate);
      return matchesSearch && matchesDate;
    });
  }, [payments, paymentCategoryFilter, smartSyncAnalysis, reconciliationFilter, searchTerm, startDate, endDate]);

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

  // Export current database view as Excel (.xlsx) file
  const handleExportExcel = () => {
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
      const filename = exportDatasetFile(
        'purchase',
        'xlsx',
        filteredPurchases,
        `ZSB_Aquatics_Purchases${dateRangeTag}.xlsx`
      );
      showToast(`Exported ${filteredPurchases.length} purchase records to Excel (${filename})`);
    } else if (activeDbType === 'packing') {
      if (filteredPackings.length === 0) {
        showToast('No packing records in current filtered view to export.');
        return;
      }
      const filename = exportDatasetFile(
        'packing',
        'xlsx',
        filteredPackings,
        `ZSB_Aquatics_Packing_Lists${dateRangeTag}.xlsx`
      );
      showToast(`Exported ${filteredPackings.length} packing records to Excel (${filename})`);
    } else {
      if (filteredPayments.length === 0) {
        showToast('No payment records in current filtered view to export.');
        return;
      }
      const filename = exportDatasetFile(
        'payment',
        'xlsx',
        filteredPayments,
        `ZSB_Aquatics_Payments${dateRangeTag}.xlsx`
      );
      showToast(`Exported ${filteredPayments.length} payment records to Excel (${filename})`);
    }
  };

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
                Master Database Sheets &amp; Batch Print Center
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Filter by Date Range, Import or Export Excel (.xlsx) &amp; CSV (.csv), Select records for Batch Print, or audit transactions
            </p>
          </div>
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

      {/* Smart Data Sync & Reconciliation Utility Panel */}
      {(activeDbType === 'purchase' || activeDbType === 'payment') && (
        <div
          data-testid="smart-data-sync-panel"
          className={`rounded-xl p-4 sm:p-5 border-2 shadow-sm transition-all ${
            smartSyncAnalysis.summary.discrepancyCount > 0
              ? 'bg-amber-50/90 border-amber-400'
              : 'bg-emerald-50/80 border-emerald-300'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg border shrink-0 ${
                  smartSyncAnalysis.summary.discrepancyCount > 0
                    ? 'bg-amber-500 text-slate-950 border-amber-600'
                    : 'bg-emerald-600 text-white border-emerald-700'
                }`}
              >
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Smart Data Sync — Purchase &amp; Supplier Payment Reconciliation
                  </h3>
                  {smartSyncAnalysis.summary.discrepancyCount > 0 ? (
                    <span
                      data-testid="smart-sync-status-badge"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        {smartSyncAnalysis.summary.discrepancyCount} Discrepanc
                        {smartSyncAnalysis.summary.discrepancyCount === 1 ? 'y' : 'ies'} Detected
                      </span>
                    </span>
                  ) : (
                    <span
                      data-testid="smart-sync-status-badge"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All Records Reconciled</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Automatically cross-references Purchase Challans against Supplier Payment Vouchers to highlight missing payment vouchers, paid amount mismatches, and balance drift in the{' '}
                  <strong className="text-slate-900">RECONCILIATION STATUS</strong> column below.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Reconciliation Filter Buttons */}
              <div className="flex items-center bg-white/90 p-1 rounded-lg border border-slate-300 text-xs">
                <button
                  type="button"
                  data-testid="smart-sync-filter-all"
                  onClick={() => setReconciliationFilter('all')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    reconciliationFilter === 'all'
                      ? 'bg-[#1b2b44] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  All ({activeDbType === 'purchase' ? purchases.length : payments.length})
                </button>
                <button
                  type="button"
                  data-testid="smart-sync-filter-discrepancies"
                  onClick={() => setReconciliationFilter('discrepancies')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    reconciliationFilter === 'discrepancies'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Discrepancies (
                  {activeDbType === 'purchase'
                    ? smartSyncAnalysis.summary.purchaseDiscrepancyCount
                    : smartSyncAnalysis.summary.paymentDiscrepancyCount}
                  )
                </button>
                <button
                  type="button"
                  data-testid="smart-sync-filter-reconciled"
                  onClick={() => setReconciliationFilter('reconciled')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    reconciliationFilter === 'reconciled'
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  Reconciled (
                  {activeDbType === 'purchase'
                    ? smartSyncAnalysis.summary.reconciledPurchasesCount
                    : smartSyncAnalysis.summary.reconciledPaymentsCount}
                  )
                </button>
              </div>

              {/* Primary Auto-Reconcile Button */}
              <button
                type="button"
                data-testid="smart-sync-reconcile-all-btn"
                disabled={smartSyncAnalysis.summary.discrepancyCount === 0}
                onClick={() => handleSmartSyncReconcile()}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide shadow-sm transition ${
                  smartSyncAnalysis.summary.discrepancyCount > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-emerald-700/20 text-emerald-900 border border-emerald-300 cursor-not-allowed'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>
                  {smartSyncAnalysis.summary.discrepancyCount > 0
                    ? `Smart Sync & Reconcile (${smartSyncAnalysis.summary.discrepancyCount})`
                    : '100% Synced'}
                </span>
              </button>
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-200/80 text-xs">
            <div className="bg-white/90 px-3 py-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Reconciled Purchase Bills
              </div>
              <div
                data-testid="smart-sync-reconciled-count"
                className="font-mono font-black text-emerald-700 text-sm mt-0.5"
              >
                {smartSyncAnalysis.summary.reconciledPurchasesCount} /{' '}
                {smartSyncAnalysis.summary.totalPurchasesChecked} Bills
              </div>
            </div>
            <div className="bg-white/90 px-3 py-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Missing Vouchers / Mismatches
              </div>
              <div
                data-testid="smart-sync-discrepancy-breakdown"
                className="font-mono font-black text-rose-700 text-sm mt-0.5"
              >
                {smartSyncAnalysis.summary.missingVoucherCount} Missing ·{' '}
                {smartSyncAnalysis.summary.amountMismatchCount +
                  smartSyncAnalysis.summary.balanceMismatchCount}{' '}
                Mismatch
              </div>
            </div>
            <div className="bg-white/90 px-3 py-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Unreconciled Variance Value
              </div>
              <div
                data-testid="smart-sync-discrepancy-amount"
                className={`font-mono font-black text-sm mt-0.5 ${
                  smartSyncAnalysis.summary.totalDiscrepancyAmount > 0
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                {formatCurrency(
                  smartSyncAnalysis.summary.totalDiscrepancyAmount,
                  companyProfile.currency
                )}
              </div>
            </div>
            <div className="bg-white/90 px-3 py-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Supplier Vouchers Audited
              </div>
              <div className="font-mono font-black text-purple-900 text-sm mt-0.5">
                {smartSyncAnalysis.summary.reconciledPaymentsCount} /{' '}
                {smartSyncAnalysis.summary.totalSupplierPaymentsChecked} Synced
              </div>
            </div>
          </div>

          {lastSyncLog.length > 0 && (
            <div
              data-testid="smart-sync-execution-log"
              className="mt-3 px-3 py-2 rounded-lg bg-emerald-900 text-emerald-50 text-xs flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>
                  <strong>Last Smart Data Sync Action:</strong> {lastSyncLog.join(' | ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLastSyncLog([])}
                className="text-emerald-200 hover:text-white text-[11px] font-bold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* QR Linked Shipment Details Banner */}
      {focusedShipmentInvoice && activeDbType === 'packing' && (
        <div
          data-testid="qr-linked-shipment-banner"
          className="bg-teal-950 text-white rounded-xl p-4 sm:p-5 border-2 border-teal-400 shadow-md space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-400/40 text-teal-300">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-teal-300">
                    QR Linked Shipment Inspector
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-xs font-black">
                    {focusedShipmentRecord?.invoiceNumber || focusedShipmentInvoice}
                  </span>
                </div>
                <p className="text-xs text-teal-100/90 mt-0.5">
                  Showing specific Export Packing List shipment details linked via QR code
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {focusedShipmentRecord && (
                <button
                  type="button"
                  onClick={() =>
                    openPrintModal({
                      type: 'packing',
                      title: `Export Packing List - ${focusedShipmentRecord.invoiceNumber}`,
                      data: focusedShipmentRecord,
                      items: focusedShipmentRecord.items,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / View QR Manifest</span>
                </button>
              )}
              <button
                type="button"
                data-testid="clear-qr-shipment-filter-btn"
                onClick={() => {
                  clearFocusedShipment();
                  setSearchTerm('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear QR Filter (Show All)</span>
              </button>
            </div>
          </div>

          {focusedShipmentRecord && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2 border-t border-teal-800/80 text-xs">
              <div className="bg-teal-900/60 p-2.5 rounded-lg border border-teal-800">
                <div className="text-[10px] text-teal-300 uppercase font-bold">Manifest No</div>
                <div className="font-mono font-black text-white mt-0.5">
                  {focusedShipmentRecord.invoiceNumber}
                </div>
              </div>
              <div className="bg-teal-900/60 p-2.5 rounded-lg border border-teal-800">
                <div className="text-[10px] text-teal-300 uppercase font-bold">Shipping Mark</div>
                <div className="font-black text-amber-300 mt-0.5">
                  {focusedShipmentRecord.shippingMark}
                </div>
              </div>
              <div className="bg-teal-900/60 p-2.5 rounded-lg border border-teal-800">
                <div className="text-[10px] text-teal-300 uppercase font-bold">Packing Date</div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {formatDate(focusedShipmentRecord.packingDate)}
                </div>
              </div>
              <div className="bg-teal-900/60 p-2.5 rounded-lg border border-teal-800">
                <div className="text-[10px] text-teal-300 uppercase font-bold">Flight &amp; Dest</div>
                <div className="font-bold text-white mt-0.5 truncate">
                  {focusedShipmentRecord.flight} · {focusedShipmentRecord.destination}
                </div>
              </div>
              <div className="bg-teal-900/60 p-2.5 rounded-lg border border-teal-800">
                <div className="text-[10px] text-teal-300 uppercase font-bold">Total Weight</div>
                <div className="font-mono font-black text-emerald-300 mt-0.5">
                  {focusedShipmentRecord.totalWeight} KG ({focusedShipmentRecord.totalBox} Box)
                </div>
              </div>
              <div className="bg-teal-900/60 p-2.5 rounded-lg border border-teal-800">
                <div className="text-[10px] text-teal-300 uppercase font-bold">Invoice Value</div>
                <div className="font-mono font-black text-amber-300 mt-0.5">
                  {formatCurrency(focusedShipmentRecord.totalAmount, 'RMB')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

        {/* Action Buttons: Import/Export Excel & CSV, Batch Print */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Import from Excel / CSV Button */}
          <button
            type="button"
            data-testid="database-import-excel-csv-btn"
            onClick={() => openDataCenterModal('import', activeDbType)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
            title={`Import ${activeDbType} records from Excel (.xlsx) or CSV (.csv)`}
          >
            <UploadCloud className="w-4 h-4 stroke-[2.2]" />
            <span>IMPORT EXCEL / CSV</span>
          </button>

          {/* Export to Excel (.XLSX) Button */}
          <button
            type="button"
            data-testid="database-export-xlsx-btn"
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white cursor-pointer"
            title={`Export current filtered ${activeDbType} view as Microsoft Excel (.xlsx)`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>EXPORT EXCEL .XLSX ({currentFilteredCount})</span>
          </button>

          {/* Export to CSV (.CSV) Button */}
          <button
            type="button"
            data-testid="database-export-csv-btn"
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white cursor-pointer"
            title={`Export current filtered ${activeDbType} view as Excel-compatible CSV`}
          >
            <Download className="w-4 h-4 text-teal-200" />
            <span>EXPORT CSV ({currentFilteredCount})</span>
          </button>

          {/* Batch Update Sidebar Toggle Button */}
          <button
            type="button"
            data-testid="database-batch-update-btn"
            onClick={() => setIsBatchSidebarOpen((prev) => !prev)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition cursor-pointer ${
              isBatchSidebarOpen
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                : selectedIds.length > 0
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
            }`}
            title="Open Batch Update secondary sidebar to bulk edit multiple selected rows at once"
          >
            <Layers className="w-4 h-4" />
            <span>BATCH UPDATE ({selectedIds.length})</span>
          </button>

          {/* Batch Print Button */}
          <button
            type="button"
            data-testid="database-batch-print-btn"
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

          {/* Batch Export Payment Slips (Combined PDF) Button */}
          {activeDbType === 'payment' && (
            <button
              type="button"
              data-testid="batch-export-payment-slips-pdf-btn"
              onClick={handleBatchExportPaymentSlipsPdf}
              disabled={isExportingBatchSlips || selectedIds.length === 0}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition ${
                selectedIds.length > 0
                  ? 'bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white cursor-pointer ring-1 ring-purple-400/50'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              } disabled:opacity-50`}
              title="Batch export multiple selected payment slips as a single combined PDF document"
            >
              {isExportingBatchSlips ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                  <span>EXPORTING {selectedIds.length} SLIPS...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-amber-300" />
                  <span>
                    BATCH EXPORT SLIPS .PDF {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Database Snapshots (JSON Archive & Recovery) Button */}
          <button
            type="button"
            data-testid="database-snapshots-btn"
            onClick={openSnapshotModal}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            title="Create or Restore Local JSON Database Snapshots"
          >
            <Archive className="w-3.5 h-3.5 text-amber-300" />
            <span>SNAPSHOTS ({snapshots.length})</span>
          </button>

          {/* Clear All Database Records Button (Protected by Super Admin Password) */}
          <button
            type="button"
            data-testid="database-clear-all-records-btn"
            onClick={() => {
              clearAllDatabaseRecords('all');
            }}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 cursor-pointer"
            title="Clear all database records permanently (Requires Super Admin Password)"
          >
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>CLEAR ALL RECORDS</span>
          </button>

          <span className="text-xs text-slate-500 pl-1">
            Selected: <strong className="text-slate-900">{selectedIds.length}</strong>
          </span>
        </div>
      </div>

      {/* Main Database Content + Secondary Batch Update Sidebar */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
      {/* Database Tables */}
      <div className="flex-1 min-w-0 w-full bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
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
                  <th className="p-3 text-right">PAID AMOUNT</th>
                  <th className="p-3 text-right">BALANCE</th>
                  <th className="p-3">RECONCILIATION STATUS</th>
                  <th className="p-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400">
                      No purchase records found.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p, idx) => {
                    const isSelected = selectedIds.includes(p.id);
                    const rec = smartSyncAnalysis.purchaseReconciliations[p.id];
                    const hasDiscrepancy = Boolean(rec?.hasDiscrepancy);
                    const isEvenRow = idx % 2 === 1;
                    return (
                      <tr
                        key={p.id}
                        data-testid={`purchase-row-${p.id}`}
                        className={`transition-colors duration-150 ${
                          isSelected
                            ? 'bg-blue-100/85 hover:bg-blue-100'
                            : isEvenRow
                            ? 'bg-slate-50/90 hover:bg-blue-50/85'
                            : 'bg-white hover:bg-blue-50/85'
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
                        <td className="p-3 text-right font-mono font-bold text-emerald-800">
                          {formatCurrency(p.paidAmount, companyProfile.currency)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700">
                          {formatCurrency(p.balance, companyProfile.currency)}
                        </td>
                        <td
                          className="p-3 min-w-[230px]"
                          data-testid={`reconciliation-status-cell-${p.id}`}
                        >
                          {rec && (
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  data-testid={`reconciliation-badge-${p.id}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                    rec.status === 'RECONCILED'
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      : rec.status === 'UNPAID_PENDING'
                                      ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                      : 'bg-rose-600 text-white shadow-xs'
                                  }`}
                                >
                                  {rec.hasDiscrepancy ? (
                                    <AlertTriangle className="w-3 h-3" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  <span>{rec.label}</span>
                                </span>

                                {rec.hasDiscrepancy && (
                                  <span className="font-mono text-[10px] font-black text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                                    Δ {formatCurrency(rec.discrepancyAmount, companyProfile.currency)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 leading-snug">
                                {rec.summaryText}
                              </div>
                              {rec.hasDiscrepancy && (
                                <div data-export-ignore="true" className="pt-0.5">
                                  <button
                                    type="button"
                                    data-testid={`reconcile-record-btn-${p.id}`}
                                    onClick={() => handleSmartSyncReconcile(p.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b2b44] hover:bg-blue-800 text-amber-300 text-[10px] font-black uppercase tracking-wide transition cursor-pointer shadow-xs"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Auto-Sync: {rec.resolutionLabel}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
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
                              type="button"
                              onClick={() => deletePurchase(p.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title={`Delete purchase invoice ${p.invoiceNumber}`}
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
                    filteredPackings.map((pkg, idx) => {
                      const isSelected = selectedIds.includes(pkg.id);
                      const isEvenRow = idx % 2 === 1;
                      const computedAmountBDT = calculatePackingTotalAmountBDT(
                        pkg.totalAmount,
                        pkg.rmbRate
                      );
                      return (
                      <tr
                        key={pkg.id}
                        data-testid={`packing-row-${pkg.id}`}
                        className={`transition-colors duration-150 ${
                          isSelected
                            ? 'bg-teal-100/85 hover:bg-teal-100'
                            : isEvenRow
                            ? 'bg-slate-50/90 hover:bg-teal-50/85'
                            : 'bg-white hover:bg-teal-50/85'
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
                              type="button"
                              onClick={() => deletePacking(pkg.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title={`Delete packing list ${pkg.invoiceNumber}`}
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
                    <th className="p-3">RECONCILIATION STATUS</th>
                    <th className="p-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No payment records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((pm, idx) => {
                      const isSelected = selectedIds.includes(pm.id);
                      const category = classifyPaymentCategory(pm);
                      const rec = smartSyncAnalysis.paymentReconciliations[pm.id];
                      const isEvenRow = idx % 2 === 1;
                      return (
                        <tr
                          key={pm.id}
                          data-testid={`payment-row-${pm.id}`}
                          className={`transition-colors duration-150 ${
                            isSelected
                              ? 'bg-purple-100/85 hover:bg-purple-100'
                              : isEvenRow
                              ? 'bg-slate-50/90 hover:bg-purple-50/85'
                              : 'bg-white hover:bg-purple-50/85'
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
                          <td
                            className="p-3 min-w-[220px]"
                            data-testid={`reconciliation-status-cell-${pm.id}`}
                          >
                            {rec && (
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    data-testid={`reconciliation-badge-${pm.id}`}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                      rec.status === 'RECONCILED'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : rec.status === 'EXPORTER_LEDGER'
                                        ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                        : 'bg-rose-600 text-white shadow-xs'
                                    }`}
                                  >
                                    {rec.hasDiscrepancy ? (
                                      <AlertTriangle className="w-3 h-3" />
                                    ) : (
                                      <CheckCircle2 className="w-3 h-3" />
                                    )}
                                    <span>{rec.label}</span>
                                  </span>
                                  {rec.hasDiscrepancy && (
                                    <span className="font-mono text-[10px] font-black text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                                      Δ {formatCurrency(rec.discrepancyAmount, companyProfile.currency)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-600 leading-snug">
                                  {rec.summaryText}
                                </div>
                                {rec.hasDiscrepancy && (
                                  <div data-export-ignore="true" className="pt-0.5">
                                    <button
                                      type="button"
                                      data-testid={`reconcile-record-btn-${pm.id}`}
                                      onClick={() => handleSmartSyncReconcile(pm.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b2b44] hover:bg-purple-800 text-amber-300 text-[10px] font-black uppercase tracking-wide transition cursor-pointer shadow-xs"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      <span>Auto-Sync: {rec.resolutionLabel}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
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
                                type="button"
                                onClick={() => deletePayment(pm.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                title={`Delete payment voucher ${pm.invoiceNumber}`}
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

      {/* Secondary Sidebar for Batch Updating Selected Rows */}
      <BatchUpdateSidebar
        isOpen={isBatchSidebarOpen}
        onClose={() => setIsBatchSidebarOpen(false)}
        activeDbType={activeDbType}
        selectedIds={selectedIds}
        purchases={purchases}
        packings={packings}
        payments={payments}
        dropdownOptions={dropdownOptions}
        defaultRmbRate={companyProfile.rmbExchangeRate}
        onUpdatePurchase={updatePurchase}
        onUpdatePacking={updatePacking}
        onUpdatePayment={updatePayment}
        onSuccess={(msg) => showToast(msg)}
      />
      </div>

      {/* Offscreen Host for Direct Batch Payment Slips Combined PDF Export */}
      {activeDbType === 'payment' && selectedPaymentsForBatch.length > 0 && (
        <div
          id="batch-payment-slips-offscreen-host"
          data-testid="batch-payment-slips-offscreen-host"
          style={{
            position: 'fixed',
            left: -9999,
            top: 0,
            opacity: 0,
            pointerEvents: 'none',
            width: '800px',
            zIndex: -1,
          }}
        >
          {selectedPaymentsForBatch.map((pm, idx) => (
            <PaymentSlipPrintCard
              key={pm.id}
              id={`batch-db-slip-${idx}`}
              payment={pm}
              companyProfile={companyProfile}
              pageNumber={idx + 1}
              totalPages={selectedPaymentsForBatch.length}
            />
          ))}
        </div>
      )}
    </div>
  );
};
