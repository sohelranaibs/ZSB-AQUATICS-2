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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import {
  toggleSort,
  sortPurchaseRecords,
  sortPackingRecords,
  sortPaymentRecords,
  getColumnHeaderTitle,
  SortConfig,
} from '../utils/databaseSorting.ts';
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
import {
  DatabaseTableType,
  summarizeTableValidation,
  validateDatabaseCellValue,
} from '../utils/databaseFieldValidation.ts';
import { DatabaseValidatedCell } from './DatabaseValidatedCell.tsx';
import {
  buildDatasetIndices,
  queryIndexedRecords,
} from '../utils/indexedStorage.ts';
import { DateRangePicker } from './DateRangePicker.tsx';

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
  const [validationFilter, setValidationFilter] = useState<'all' | 'invalid_only'>('all');
  const [cellDraftsByDb, setCellDraftsByDb] = useState<
    Record<DatabaseTableType, Record<string, Record<string, string>>>
  >({
    purchase: {},
    packing: {},
    payment: {},
  });
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

  // Sort state per database view: defaults to date descending
  const [purchaseSort, setPurchaseSort] = useState<SortConfig>({ column: 'date', direction: 'desc' });
  const [packingSort, setPackingSort] = useState<SortConfig>({ column: 'date', direction: 'desc' });
  const [paymentSort, setPaymentSort] = useState<SortConfig>({ column: 'date', direction: 'desc' });

  const activeSortConfig = useMemo<SortConfig>(() => {
    if (activeDbType === 'purchase') return purchaseSort;
    if (activeDbType === 'packing') return packingSort;
    return paymentSort;
  }, [activeDbType, purchaseSort, packingSort, paymentSort]);

  const handleHeaderSortClick = (columnKey: string) => {
    if (activeDbType === 'purchase') {
      setPurchaseSort((prev) => toggleSort(prev, columnKey));
    } else if (activeDbType === 'packing') {
      setPackingSort((prev) => toggleSort(prev, columnKey));
    } else {
      setPaymentSort((prev) => toggleSort(prev, columnKey));
    }
  };

  const handleResetSort = () => {
    if (activeDbType === 'purchase') {
      setPurchaseSort({ column: null, direction: 'asc' });
    } else if (activeDbType === 'packing') {
      setPackingSort({ column: null, direction: 'asc' });
    } else {
      setPaymentSort({ column: null, direction: 'asc' });
    }
  };

  // Field validation summary across the active database table
  const activeRecordsForValidation = useMemo(() => {
    if (activeDbType === 'purchase') return purchases as unknown as Array<{ id: string } & Record<string, unknown>>;
    if (activeDbType === 'packing') return packings as unknown as Array<{ id: string } & Record<string, unknown>>;
    return payments as unknown as Array<{ id: string } & Record<string, unknown>>;
  }, [activeDbType, purchases, packings, payments]);

  const validationSummary = useMemo(
    () =>
      summarizeTableValidation(
        activeDbType,
        activeRecordsForValidation,
        cellDraftsByDb[activeDbType]
      ),
    [activeDbType, activeRecordsForValidation, cellDraftsByDb]
  );

  const handleCellDraftChange = (recordId: string, fieldKey: string, nextRawValue: string) => {
    // For Packing DB rmbRate live input, if valid numeric or empty, also update live BDT conversion
    if (activeDbType === 'packing' && fieldKey === 'rmbRate') {
      const check = validateDatabaseCellValue('packing', 'rmbRate', nextRawValue);
      if (check.isValid) {
        const targetPkg = packings.find((pk) => pk.id === recordId);
        if (targetPkg) {
          const parsedRate = check.parsedValue === undefined ? 0 : Number(check.parsedValue) || 0;
          const nextTotalAmountBDT = calculatePackingTotalAmountBDT(
            targetPkg.totalAmount,
            parsedRate
          );
          updatePacking(
            recordId,
            {
              rmbRate: check.parsedValue === undefined ? undefined : Number(check.parsedValue),
              totalAmountBDT: nextTotalAmountBDT,
            },
            true
          );
        }
      }
    }

    setCellDraftsByDb((prev) => ({
      ...prev,
      [activeDbType]: {
        ...prev[activeDbType],
        [recordId]: {
          ...(prev[activeDbType][recordId] || {}),
          [fieldKey]: nextRawValue,
        },
      },
    }));
  };

  const handleCellClearDraft = (recordId: string, fieldKey: string) => {
    setCellDraftsByDb((prev) => {
      const dbDrafts = { ...prev[activeDbType] };
      const recDrafts = { ...(dbDrafts[recordId] || {}) };
      delete recDrafts[fieldKey];
      if (Object.keys(recDrafts).length === 0) {
        delete dbDrafts[recordId];
      } else {
        dbDrafts[recordId] = recDrafts;
      }
      return {
        ...prev,
        [activeDbType]: dbDrafts,
      };
    });
  };

  const handleCellCommitValid = (
    recordId: string,
    fieldKey: string,
    parsedValue: string | number | undefined
  ) => {
    handleCellClearDraft(recordId, fieldKey);

    if (activeDbType === 'purchase') {
      const target = purchases.find((p) => p.id === recordId);
      if (!target) return;
      const updates: Record<string, unknown> = { [fieldKey]: parsedValue };
      if (fieldKey === 'totalAmount' || fieldKey === 'paidAmount') {
        const nextTotal =
          fieldKey === 'totalAmount' ? Number(parsedValue) || 0 : target.totalAmount;
        const nextPaid =
          fieldKey === 'paidAmount' ? Number(parsedValue) || 0 : target.paidAmount;
        updates.balance = nextTotal + (target.previousAmount || 0) - nextPaid;
      }
      updatePurchase(recordId, updates);
    } else if (activeDbType === 'packing') {
      const target = packings.find((pk) => pk.id === recordId);
      if (!target) return;
      const updates: Record<string, unknown> = { [fieldKey]: parsedValue };
      if (fieldKey === 'totalAmount' || fieldKey === 'rmbRate') {
        const nextTotal =
          fieldKey === 'totalAmount' ? Number(parsedValue) || 0 : target.totalAmount;
        const nextRate =
          fieldKey === 'rmbRate'
            ? parsedValue === undefined
              ? 0
              : Number(parsedValue) || 0
            : target.rmbRate || 0;
        updates.totalAmountBDT = calculatePackingTotalAmountBDT(nextTotal, nextRate);
      }
      updatePacking(recordId, updates, true);
    } else {
      const target = payments.find((pm) => pm.id === recordId);
      if (!target) return;
      updatePayment(recordId, { [fieldKey]: parsedValue });
    }
  };

  const handleResetAllInvalidCells = () => {
    setCellDraftsByDb((prev) => ({
      ...prev,
      [activeDbType]: {},
    }));
    setValidationFilter('all');
    showToast('Reverted all invalid cell inputs to their valid saved formats.');
  };

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

  // In-memory dataset indices for fast indexed search & filtering
  const purchaseIndices = useMemo(
    () =>
      buildDatasetIndices(purchases, {
        getInvoice: (p) => p.invoiceNumber,
        getDate: (p) => p.date,
        getParty: (p) => p.description,
        getSearchableText: (p) =>
          `${p.invoiceNumber} ${p.description} ${p.contactNumber || ''} ${p.remarks || ''}`,
      }),
    [purchases]
  );

  const packingIndices = useMemo(
    () =>
      buildDatasetIndices(packings, {
        getInvoice: (p) => p.invoiceNumber,
        getDate: (p) => p.packingDate || p.fromDate || p.toDate,
        getParty: (p) => p.shippingMark,
        getSearchableText: (p) =>
          `${p.invoiceNumber} ${p.shippingMark} ${p.destination} ${p.shipper} ${p.flight} ${p.remarks || ''}`,
      }),
    [packings]
  );

  const paymentIndices = useMemo(
    () =>
      buildDatasetIndices(payments, {
        getInvoice: (p) => p.invoiceNumber,
        getDate: (p) => p.date,
        getParty: (p) => p.description,
        getSearchableText: (p) =>
          `${p.invoiceNumber} ${p.description} ${p.shippingMark || ''} ${p.status} ${p.remarks || ''}`,
      }),
    [payments]
  );

  // Filtered lists reactive to search term, date range, reconciliation status, and field validation filter using index queries
  const filteredPurchases = useMemo(() => {
    const candidateRecords = queryIndexedRecords(purchases, purchaseIndices, {
      searchTerm,
      startDate,
      endDate,
    });

    return candidateRecords.filter((p) => {
      if (
        validationFilter === 'invalid_only' &&
        !validationSummary.invalidRecordIds.includes(p.id)
      ) {
        return false;
      }
      const rec = smartSyncAnalysis.purchaseReconciliations[p.id];
      if (reconciliationFilter === 'discrepancies' && !rec?.hasDiscrepancy) {
        return false;
      }
      if (reconciliationFilter === 'reconciled' && rec?.status !== 'RECONCILED') {
        return false;
      }
      return true;
    });
  }, [
    purchases,
    purchaseIndices,
    validationFilter,
    validationSummary.invalidRecordIds,
    smartSyncAnalysis,
    reconciliationFilter,
    searchTerm,
    startDate,
    endDate,
  ]);

  const filteredPackings = useMemo(() => {
    const candidateRecords = queryIndexedRecords(packings, packingIndices, {
      searchTerm,
      startDate,
      endDate,
    });

    return candidateRecords.filter((pkg) => {
      if (
        validationFilter === 'invalid_only' &&
        !validationSummary.invalidRecordIds.includes(pkg.id)
      ) {
        return false;
      }
      return true;
    });
  }, [
    packings,
    packingIndices,
    validationFilter,
    validationSummary.invalidRecordIds,
    searchTerm,
    startDate,
    endDate,
  ]);

  const filteredPayments = useMemo(() => {
    const candidateRecords = queryIndexedRecords(payments, paymentIndices, {
      searchTerm,
      startDate,
      endDate,
    });

    return candidateRecords.filter((pm) => {
      if (
        validationFilter === 'invalid_only' &&
        !validationSummary.invalidRecordIds.includes(pm.id)
      ) {
        return false;
      }
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
      return true;
    });
  }, [
    payments,
    paymentIndices,
    validationFilter,
    validationSummary.invalidRecordIds,
    paymentCategoryFilter,
    smartSyncAnalysis,
    reconciliationFilter,
    searchTerm,
    startDate,
    endDate,
  ]);

  // Sorted records based on active sort configuration
  const sortedPurchases = useMemo(() => {
    return sortPurchaseRecords(
      filteredPurchases,
      purchaseSort,
      smartSyncAnalysis.purchaseReconciliations
    );
  }, [filteredPurchases, purchaseSort, smartSyncAnalysis.purchaseReconciliations]);

  const sortedPackings = useMemo(() => {
    return sortPackingRecords(
      filteredPackings,
      packingSort,
      companyProfile.rmbExchangeRate || 16.5
    );
  }, [filteredPackings, packingSort, companyProfile.rmbExchangeRate]);

  const sortedPayments = useMemo(() => {
    return sortPaymentRecords(
      filteredPayments,
      paymentSort,
      smartSyncAnalysis.paymentReconciliations
    );
  }, [filteredPayments, paymentSort, smartSyncAnalysis.paymentReconciliations]);

  // Current active filtered/sorted records count and total records
  const currentFilteredCount =
    activeDbType === 'purchase'
      ? sortedPurchases.length
      : activeDbType === 'packing'
      ? sortedPackings.length
      : sortedPayments.length;

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
      if (sortedPurchases.length === 0) {
        showToast('No purchase records in current filtered view to export.');
        return;
      }
      const filename = exportDatasetFile(
        'purchase',
        'xlsx',
        sortedPurchases,
        `ZSB_Aquatics_Purchases${dateRangeTag}.xlsx`
      );
      showToast(`Exported ${sortedPurchases.length} purchase records to Excel (${filename})`);
    } else if (activeDbType === 'packing') {
      if (sortedPackings.length === 0) {
        showToast('No packing records in current filtered view to export.');
        return;
      }
      const filename = exportDatasetFile(
        'packing',
        'xlsx',
        sortedPackings,
        `ZSB_Aquatics_Packing_Lists${dateRangeTag}.xlsx`
      );
      showToast(`Exported ${sortedPackings.length} packing records to Excel (${filename})`);
    } else {
      if (sortedPayments.length === 0) {
        showToast('No payment records in current filtered view to export.');
        return;
      }
      const filename = exportDatasetFile(
        'payment',
        'xlsx',
        sortedPayments,
        `ZSB_Aquatics_Payments${dateRangeTag}.xlsx`
      );
      showToast(`Exported ${sortedPayments.length} payment records to Excel (${filename})`);
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
      if (sortedPurchases.length === 0) {
        showToast('No purchase records in current filtered view to export.');
        return;
      }
      const csv = generatePurchasesCSV(sortedPurchases);
      const filename = `ZSB_Aquatics_Purchases${dateRangeTag}.csv`;
      downloadCsvFile(csv, filename);
      showToast(`Exported ${sortedPurchases.length} purchase records to Excel CSV (${filename})`);
    } else if (activeDbType === 'packing') {
      if (sortedPackings.length === 0) {
        showToast('No packing records in current filtered view to export.');
        return;
      }
      const csv = generatePackingsCSV(sortedPackings);
      const filename = `ZSB_Aquatics_Packing_Lists${dateRangeTag}.csv`;
      downloadCsvFile(csv, filename);
      showToast(`Exported ${sortedPackings.length} packing records to Excel CSV (${filename})`);
    } else {
      if (sortedPayments.length === 0) {
        showToast('No payment records in current filtered view to export.');
        return;
      }
      const csv = generatePaymentsCSV(sortedPayments);
      const filename = `ZSB_Aquatics_Payments${dateRangeTag}.csv`;
      downloadCsvFile(csv, filename);
      showToast(`Exported ${sortedPayments.length} payment records to Excel CSV (${filename})`);
    }
  };

  const isDateFilterActive = Boolean(startDate || endDate);

  /**
   * Helper to render sortable table column header with accessible ARIA tags and toggle icon
   */
  const renderSortableHeader = (
    colKey: string,
    label: string,
    align: 'left' | 'center' | 'right' = 'left',
    extraClasses: string = ''
  ) => {
    const isSorted = activeSortConfig.column === colKey;
    const dir = activeSortConfig.direction;
    const alignClass =
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

    return (
      <th
        scope="col"
        aria-sort={isSorted ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        data-testid={`sort-header-${colKey}`}
        onClick={() => handleHeaderSortClick(colKey)}
        title={`Click to sort by ${label} (${
          isSorted
            ? `currently ${dir}ending, click to sort ${dir === 'asc' ? 'desc' : 'asc'}ending`
            : 'click to sort'
        })`}
        className={`px-1.5 py-2 select-none cursor-pointer transition-colors hover:bg-black/25 group ${alignClass} ${extraClasses}`}
      >
        <div
          className={`inline-flex items-center gap-1 w-full ${
            align === 'right'
              ? 'justify-end'
              : align === 'center'
              ? 'justify-center'
              : 'justify-start'
          }`}
        >
          <span
            className={`font-bold uppercase tracking-tight whitespace-nowrap transition-colors ${
              isSorted
                ? 'text-amber-200 font-black underline underline-offset-2'
                : 'group-hover:text-amber-100'
            }`}
          >
            {label}
          </span>
          <span className="inline-flex items-center shrink-0">
            {isSorted ? (
              dir === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.8]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.8]" />
              )
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-90 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="w-full max-w-full mx-auto px-2 sm:px-3 py-3 space-y-4">
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
      <div className="space-y-2">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          activePreset={activePreset}
          onPresetChange={(p) => setActivePreset(p)}
          onDateRangeChange={(start, end, preset) => {
            setStartDate(start);
            setEndDate(end);
            if (preset) setActivePreset(preset);
            setSelectedIds([]);
          }}
          label="Filter Database Records by Date Range"
        />
        <div className="flex items-center justify-between text-xs px-1 text-slate-500">
          <span>
            Showing <strong className="text-blue-900 font-bold">{currentFilteredCount}</strong> of{' '}
            <strong className="text-slate-700">{totalUnfilteredCount}</strong> records
          </span>
          {isDateFilterActive && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              Date Filter Active
            </span>
          )}
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

          <span className="text-xs text-slate-500 pl-1">
            Selected: <strong className="text-slate-900">{selectedIds.length}</strong>
          </span>
        </div>
      </div>

      {/* Database Field Validation System Bar */}
      <div
        data-testid="database-field-validation-bar"
        className={`rounded-xl px-4 py-3 border-2 shadow-xs flex flex-wrap items-center justify-between gap-3 transition-colors ${
          validationSummary.invalidCellCount > 0
            ? 'bg-rose-50 border-rose-500 text-rose-950'
            : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {validationSummary.invalidCellCount > 0 ? (
            <span
              data-testid="field-validation-status-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs font-black uppercase tracking-wide shadow-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {validationSummary.invalidCellCount} Invalid Cell
                {validationSummary.invalidCellCount === 1 ? '' : 's'} in Red (
                {validationSummary.invalidRecordCount} Row
                {validationSummary.invalidRecordCount === 1 ? '' : 's'})
              </span>
            </span>
          ) : (
            <span
              data-testid="field-validation-status-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-700 text-white text-xs font-black uppercase tracking-wide shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Field Validation Active · All Cells Valid</span>
            </span>
          )}

          <div className="text-xs text-slate-700">
            <strong className="font-black text-slate-900 uppercase">
              Inline Type Validation:
            </strong>{' '}
            Click any cell to edit. Mismatched formats (e.g. non-numeric data in a{' '}
            <span className="font-mono font-bold text-rose-700">Price / Amount / Rate / Qty</span>{' '}
            column or invalid <span className="font-mono font-bold text-rose-700">YYYY-MM-DD</span>{' '}
            date) highlight the cell in <strong className="text-rose-700">RED</strong>.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white p-1 rounded-lg border border-slate-300 text-xs">
            <button
              type="button"
              data-testid="validation-filter-all-btn"
              onClick={() => setValidationFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                validationFilter === 'all'
                  ? 'bg-[#1b2b44] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              All Rows ({totalUnfilteredCount})
            </button>
            <button
              type="button"
              data-testid="validation-filter-invalid-btn"
              onClick={() => setValidationFilter('invalid_only')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                validationFilter === 'invalid_only'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Invalid Cells ({validationSummary.invalidRecordCount})
            </button>
          </div>

          {validationSummary.invalidCellCount > 0 && (
            <button
              type="button"
              data-testid="validation-reset-invalid-btn"
              onClick={handleResetAllInvalidCells}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Invalid Cells</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Database Content + Secondary Batch Update Sidebar */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
      {/* Database Tables */}
      <div className="flex-1 min-w-0 w-full bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        {/* Active Sort Banner Indicator */}
        {activeSortConfig.column && (
          <div
            data-testid="database-active-sort-banner"
            className="px-3.5 py-1.5 bg-slate-900 text-white text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-700"
          >
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                Sorted View:
              </span>
              <span className="text-slate-200 font-medium">
                <strong className="text-white font-bold">{getColumnHeaderTitle(activeSortConfig.column)}</strong> (
                <span className="text-amber-300 font-mono font-bold">
                  {activeSortConfig.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
                </span>
                )
              </span>
            </div>
            <button
              type="button"
              data-testid="database-reset-sort-btn"
              onClick={handleResetSort}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
            >
              Reset Sort
            </button>
          </div>
        )}

        {activeDbType === 'purchase' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#1b73b4] text-white font-bold uppercase text-[10px] tracking-tight border-b border-blue-900">
                <tr>
                  <th className="px-1.5 py-2 w-7 text-center">
                    <input
                      type="checkbox"
                      checked={
                        sortedPurchases.length > 0 &&
                        selectedIds.length === sortedPurchases.length
                      }
                      onChange={() =>
                        handleSelectAll(sortedPurchases.map((p) => p.id))
                      }
                    />
                  </th>
                  {renderSortableHeader('invoiceNumber', 'INVOICE NO', 'left', 'whitespace-nowrap')}
                  {renderSortableHeader('date', 'DATE', 'left', 'whitespace-nowrap')}
                  {renderSortableHeader('description', 'SUPPLIER / DESCRIPTION', 'left')}
                  {renderSortableHeader('contactNumber', 'CONTACT', 'left', 'whitespace-nowrap')}
                  {renderSortableHeader('items', 'ITEMS', 'center', 'whitespace-nowrap')}
                  {renderSortableHeader('totalQty', 'TOTAL QTY', 'right', 'whitespace-nowrap')}
                  {renderSortableHeader('totalAmount', 'TOTAL AMOUNT', 'right', 'whitespace-nowrap')}
                  {renderSortableHeader('paidAmount', 'PAID AMOUNT', 'right', 'whitespace-nowrap')}
                  {renderSortableHeader('balance', 'BALANCE', 'right', 'whitespace-nowrap')}
                  {renderSortableHeader('reconciliation', 'RECONCILIATION STATUS', 'left')}
                  <th className="px-1.5 py-2 text-center whitespace-nowrap">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {sortedPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400">
                      No purchase records found.
                    </td>
                  </tr>
                ) : (
                  sortedPurchases.map((p, idx) => {
                    const isSelected = selectedIds.includes(p.id);
                    const rec = smartSyncAnalysis.purchaseReconciliations[p.id];
                    const isEvenRow = idx % 2 === 1;
                    const rowValidation = validationSummary.resultsByRecordId[p.id] || {};
                    const rowDrafts = cellDraftsByDb.purchase[p.id] || {};
                    const hasRowValidationError = validationSummary.invalidRecordIds.includes(p.id);
                    return (
                      <tr
                        key={p.id}
                        data-testid={`purchase-row-${p.id}`}
                        className={`transition-colors duration-150 ${
                          hasRowValidationError
                            ? 'bg-rose-50/70 hover:bg-rose-50'
                            : isSelected
                            ? 'bg-blue-100/85 hover:bg-blue-100'
                            : isEvenRow
                            ? 'bg-slate-50/90 hover:bg-blue-50/85'
                            : 'bg-white hover:bg-blue-50/85'
                        }`}
                      >
                        <td className="px-1.5 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(p.id)}
                          />
                        </td>
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="invoiceNumber"
                          rawValue={p.invoiceNumber}
                          displayNode={p.invoiceNumber}
                          validation={
                            rowValidation.invoiceNumber ||
                            validateDatabaseCellValue('purchase', 'invoiceNumber', p.invoiceNumber)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'invoiceNumber'
                          )}
                          className="font-mono font-bold text-blue-900 whitespace-nowrap"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="date"
                          rawValue={p.date}
                          displayNode={formatDate(p.date)}
                          validation={
                            rowValidation.date ||
                            validateDatabaseCellValue('purchase', 'date', p.date)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'date'
                          )}
                          className="font-mono text-slate-600 whitespace-nowrap"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="description"
                          rawValue={p.description}
                          displayNode={p.description}
                          validation={
                            rowValidation.description ||
                            validateDatabaseCellValue('purchase', 'description', p.description)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'description'
                          )}
                          className="font-bold text-slate-800"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="contactNumber"
                          rawValue={p.contactNumber}
                          displayNode={p.contactNumber || '-'}
                          validation={
                            rowValidation.contactNumber ||
                            validateDatabaseCellValue('purchase', 'contactNumber', p.contactNumber)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'contactNumber'
                          )}
                          className="font-mono text-slate-600 whitespace-nowrap"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                            {p.items?.length || 0} Lines
                          </span>
                        </td>
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="totalQty"
                          rawValue={p.totalQty}
                          displayNode={p.totalQty}
                          align="right"
                          validation={
                            rowValidation.totalQty ||
                            validateDatabaseCellValue('purchase', 'totalQty', p.totalQty)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'totalQty'
                          )}
                          className="font-mono text-slate-700"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="totalAmount"
                          rawValue={p.totalAmount}
                          displayNode={formatCurrency(p.totalAmount, companyProfile.currency)}
                          align="right"
                          validation={
                            rowValidation.totalAmount ||
                            validateDatabaseCellValue('purchase', 'totalAmount', p.totalAmount)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'totalAmount'
                          )}
                          className="font-mono font-bold text-slate-900"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="paidAmount"
                          rawValue={p.paidAmount}
                          displayNode={formatCurrency(p.paidAmount, companyProfile.currency)}
                          align="right"
                          validation={
                            rowValidation.paidAmount ||
                            validateDatabaseCellValue('purchase', 'paidAmount', p.paidAmount)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'paidAmount'
                          )}
                          className="font-mono font-bold text-emerald-800"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={p.id}
                          fieldKey="balance"
                          rawValue={p.balance}
                          displayNode={formatCurrency(p.balance, companyProfile.currency)}
                          align="right"
                          validation={
                            rowValidation.balance ||
                            validateDatabaseCellValue('purchase', 'balance', p.balance)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'balance'
                          )}
                          className="font-mono font-bold text-rose-700"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <td
                          className="px-1.5 py-1.5 max-w-[175px]"
                          data-testid={`reconciliation-status-cell-${p.id}`}
                        >
                          {rec && (
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1">
                                <span
                                  data-testid={`reconciliation-badge-${p.id}`}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                    rec.status === 'RECONCILED'
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      : rec.status === 'UNPAID_PENDING'
                                      ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                      : 'bg-rose-600 text-white shadow-xs'
                                  }`}
                                >
                                  {rec.hasDiscrepancy ? (
                                    <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                  )}
                                  <span>{rec.label}</span>
                                </span>

                                {rec.hasDiscrepancy && (
                                  <span className="font-mono text-[9px] font-black text-rose-800 bg-rose-100 px-1 py-0.5 rounded">
                                    Δ {formatCurrency(rec.discrepancyAmount, companyProfile.currency)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-600 leading-tight">
                                {rec.summaryText}
                              </div>
                              {rec.hasDiscrepancy && (
                                <div data-export-ignore="true" className="pt-0.5">
                                  <button
                                    type="button"
                                    data-testid={`reconcile-record-btn-${p.id}`}
                                    onClick={() => handleSmartSyncReconcile(p.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2b44] hover:bg-blue-800 text-amber-300 text-[9px] font-black uppercase tracking-wide transition cursor-pointer shadow-xs"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Auto-Sync: {rec.resolutionLabel}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setEditingPurchaseId(p.id);
                                setActiveTab('purchase_form');
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition flex items-center space-x-0.5"
                              title="Edit Purchase Bill"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
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
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition flex items-center space-x-0.5"
                              title="Print or Save PDF"
                            >
                              <Printer className="w-2.5 h-2.5" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePurchase(p.id)}
                              className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
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
            <div className="px-3 py-2 bg-teal-50/70 border-b border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold text-teal-950">
                Packing List Ledger — Live BDT Conversion
              </div>
              <div className="font-mono text-[11px] font-semibold text-teal-900 bg-white px-2.5 py-0.5 rounded border border-teal-200">
                Formula: <strong>Total Value (RMB) × RMB Rate = Total Amount (BDT)</strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#12776c] text-white font-bold uppercase text-[10px] tracking-tight border-b border-teal-900">
                  <tr>
                    <th className="px-1 py-2 w-6 text-center">
                      <input
                        type="checkbox"
                        checked={
                          sortedPackings.length > 0 &&
                          selectedIds.length === sortedPackings.length
                        }
                        onChange={() =>
                          handleSelectAll(sortedPackings.map((p) => p.id))
                        }
                      />
                    </th>
                    {renderSortableHeader('invoiceNumber', 'PACKING NO', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('date', 'DATE', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('shippingMark', 'SHIPPING MARK', 'left')}
                    {renderSortableHeader('flight', 'FLIGHT', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('destination', 'DESTINATION', 'left')}
                    {renderSortableHeader('shipper', 'SHIPPER', 'left')}
                    {renderSortableHeader('items', 'ITEMS', 'left')}
                    {renderSortableHeader('totalBox', 'TOTAL BOX', 'right')}
                    {renderSortableHeader('totalWeight', 'TOTAL WEIGHT', 'right')}
                    {renderSortableHeader('totalAmount', 'TOTAL VALUE', 'right')}
                    {renderSortableHeader('rmbRate', 'RMB RATE', 'right')}
                    {renderSortableHeader('amountBDT', 'TOTAL AMOUNT (BDT)', 'right')}
                    <th className="px-1 py-2 text-center whitespace-nowrap">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {sortedPackings.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-8 text-center text-slate-400">
                        No packing list records found.
                      </td>
                    </tr>
                  ) : (
                    sortedPackings.map((pkg, idx) => {
                      const isSelected = selectedIds.includes(pkg.id);
                      const isEvenRow = idx % 2 === 1;
                      const computedAmountBDT = calculatePackingTotalAmountBDT(
                        pkg.totalAmount,
                        pkg.rmbRate
                      );
                      const rowValidation = validationSummary.resultsByRecordId[pkg.id] || {};
                      const rowDrafts = cellDraftsByDb.packing[pkg.id] || {};
                      const hasRowValidationError = validationSummary.invalidRecordIds.includes(pkg.id);
                      return (
                      <tr
                        key={pkg.id}
                        data-testid={`packing-row-${pkg.id}`}
                        className={`transition-colors duration-150 ${
                          hasRowValidationError
                            ? 'bg-rose-50/70 hover:bg-rose-50'
                            : isSelected
                            ? 'bg-teal-100/85 hover:bg-teal-100'
                            : isEvenRow
                            ? 'bg-slate-50/90 hover:bg-teal-50/85'
                            : 'bg-white hover:bg-teal-50/85'
                        }`}
                      >
                        <td className="px-1.5 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(pkg.id)}
                          />
                        </td>
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="invoiceNumber"
                          rawValue={pkg.invoiceNumber}
                          displayNode={pkg.invoiceNumber}
                          validation={
                            rowValidation.invoiceNumber ||
                            validateDatabaseCellValue('packing', 'invoiceNumber', pkg.invoiceNumber)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'invoiceNumber'
                          )}
                          className="font-mono font-bold text-teal-900 whitespace-nowrap"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="packingDate"
                          rawValue={pkg.packingDate}
                          displayNode={formatDate(pkg.packingDate)}
                          validation={
                            rowValidation.packingDate ||
                            validateDatabaseCellValue('packing', 'packingDate', pkg.packingDate)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'packingDate'
                          )}
                          className="font-mono text-slate-600 whitespace-nowrap"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="shippingMark"
                          rawValue={pkg.shippingMark}
                          displayNode={pkg.shippingMark}
                          validation={
                            rowValidation.shippingMark ||
                            validateDatabaseCellValue('packing', 'shippingMark', pkg.shippingMark)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'shippingMark'
                          )}
                          className="font-black text-blue-900"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="flight"
                          rawValue={pkg.flight}
                          displayNode={pkg.flight}
                          validation={
                            rowValidation.flight ||
                            validateDatabaseCellValue('packing', 'flight', pkg.flight)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'flight'
                          )}
                          className="font-mono text-slate-700 whitespace-nowrap"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="destination"
                          rawValue={pkg.destination}
                          displayNode={pkg.destination}
                          validation={
                            rowValidation.destination ||
                            validateDatabaseCellValue('packing', 'destination', pkg.destination)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'destination'
                          )}
                          className="font-bold text-slate-800"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="shipper"
                          rawValue={pkg.shipper}
                          displayNode={pkg.shipper}
                          validation={
                            rowValidation.shipper ||
                            validateDatabaseCellValue('packing', 'shipper', pkg.shipper)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'shipper'
                          )}
                          className="text-slate-700"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <td
                          className="px-1.5 py-1.5 font-mono text-[11px] text-slate-700"
                          data-testid={`packing-items-cell-${pkg.id}`}
                        >
                          <div className="flex flex-wrap items-center gap-1 leading-tight">
                            <span className="px-1 py-0.5 rounded bg-teal-100 text-teal-900 font-bold text-[10px] whitespace-nowrap">
                              {pkg.items?.length || 0} {(pkg.items?.length || 0) === 1 ? 'Item' : 'Items'}
                            </span>
                            <span className="font-bold text-slate-800">
                              {(pkg.items || []).map((it) => it.item).join(', ')}
                            </span>
                          </div>
                        </td>
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="totalBox"
                          rawValue={pkg.totalBox}
                          displayNode={pkg.totalBox}
                          align="right"
                          validation={
                            rowValidation.totalBox ||
                            validateDatabaseCellValue('packing', 'totalBox', pkg.totalBox)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'totalBox'
                          )}
                          className="font-mono text-slate-700"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="totalWeight"
                          rawValue={pkg.totalWeight}
                          displayNode={`${pkg.totalWeight} KG`}
                          align="right"
                          validation={
                            rowValidation.totalWeight ||
                            validateDatabaseCellValue('packing', 'totalWeight', pkg.totalWeight)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'totalWeight'
                          )}
                          className="font-mono font-bold text-teal-800"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="totalAmount"
                          rawValue={pkg.totalAmount}
                          displayNode={formatCurrency(pkg.totalAmount, 'RMB')}
                          align="right"
                          validation={
                            rowValidation.totalAmount ||
                            validateDatabaseCellValue('packing', 'totalAmount', pkg.totalAmount)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'totalAmount'
                          )}
                          className="font-mono font-bold text-slate-900"
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <DatabaseValidatedCell
                          recordId={pkg.id}
                          fieldKey="rmbRate"
                          rawValue={pkg.rmbRate}
                          displayNode={pkg.rmbRate ?? ''}
                          align="right"
                          alwaysShowInput={true}
                          inputPlaceholder="0.00"
                          validation={
                            rowValidation.rmbRate ||
                            validateDatabaseCellValue('packing', 'rmbRate', pkg.rmbRate)
                          }
                          hasDraftOverride={Object.prototype.hasOwnProperty.call(
                            rowDrafts,
                            'rmbRate'
                          )}
                          onDraftChange={handleCellDraftChange}
                          onCommitValid={handleCellCommitValid}
                          onClearDraft={handleCellClearDraft}
                        />
                        <td className="px-1.5 py-1.5 text-right font-mono font-black text-emerald-800 bg-emerald-50/40 whitespace-nowrap">
                          {formatCurrency(computedAmountBDT, 'BDT')}
                        </td>
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setEditingPackingId(pkg.id);
                                setActiveTab('packing_form');
                                showToast(`Loaded manifest ${pkg.invoiceNumber} for editing.`);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition flex items-center space-x-0.5 cursor-pointer"
                              title={`Edit Packing List ${pkg.invoiceNumber}`}
                            >
                              <Edit2 className="w-2.5 h-2.5 text-amber-700" />
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
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 hover:bg-teal-200 text-teal-800 rounded transition flex items-center space-x-0.5 cursor-pointer"
                              title="Print or Save PDF"
                            >
                              <Printer className="w-2.5 h-2.5" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePacking(pkg.id)}
                              className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
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
                  <tr className="bg-teal-50 font-black border-t-2 border-teal-200 text-[11px]">
                    <td colSpan={8} className="px-1.5 py-2 text-right uppercase text-teal-950">
                      PACKING DB TOTALS:
                    </td>
                    <td className="px-1.5 py-2 text-right font-mono text-slate-900 whitespace-nowrap">
                      {filteredPackings.reduce((acc, p) => acc + (Number(p.totalBox) || 0), 0)}
                    </td>
                    <td className="px-1.5 py-2 text-right font-mono text-teal-800 whitespace-nowrap">
                      {Math.round(
                        filteredPackings.reduce((acc, p) => acc + (Number(p.totalWeight) || 0), 0) *
                          100
                      ) / 100}{' '}
                      KG
                    </td>
                    <td className="px-1.5 py-2 text-right font-mono text-slate-900 whitespace-nowrap">
                      {formatCurrency(
                        filteredPackings.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0),
                        'RMB'
                      )}
                    </td>
                    <td className="px-1.5 py-2 text-right font-mono text-slate-500 text-[10px] whitespace-nowrap">
                      × RATE =
                    </td>
                    <td className="px-1.5 py-2 text-right font-mono text-emerald-800 bg-emerald-100/60 whitespace-nowrap">
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
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#793282] text-white font-bold uppercase text-[10px] tracking-tight border-b border-purple-900">
                  <tr>
                    <th className="px-1.5 py-2 w-7 text-center">
                      <input
                        type="checkbox"
                        checked={
                          sortedPayments.length > 0 &&
                          selectedIds.length === sortedPayments.length
                        }
                        onChange={() =>
                          handleSelectAll(sortedPayments.map((p) => p.id))
                        }
                      />
                    </th>
                    {renderSortableHeader('invoiceNumber', 'PAYMENT NO', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('type', 'TYPE', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('date', 'DATE', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('description', 'PARTY / MARK', 'left')}
                    {renderSortableHeader('status', 'STATUS', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('paidAmount', 'PAID AMOUNT', 'right', 'whitespace-nowrap')}
                    {renderSortableHeader('balance', 'BALANCE', 'right', 'whitespace-nowrap')}
                    {renderSortableHeader('exportRef', 'EXPORT REF', 'left', 'whitespace-nowrap')}
                    {renderSortableHeader('reconciliation', 'RECONCILIATION STATUS', 'left')}
                    <th className="px-1.5 py-2 text-center whitespace-nowrap">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {sortedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No payment records found.
                      </td>
                    </tr>
                  ) : (
                    sortedPayments.map((pm, idx) => {
                      const isSelected = selectedIds.includes(pm.id);
                      const category = classifyPaymentCategory(pm);
                      const rec = smartSyncAnalysis.paymentReconciliations[pm.id];
                      const isEvenRow = idx % 2 === 1;
                      const rowValidation = validationSummary.resultsByRecordId[pm.id] || {};
                      const rowDrafts = cellDraftsByDb.payment[pm.id] || {};
                      const hasRowValidationError = validationSummary.invalidRecordIds.includes(pm.id);
                      return (
                        <tr
                          key={pm.id}
                          data-testid={`payment-row-${pm.id}`}
                          className={`transition-colors duration-150 ${
                            hasRowValidationError
                              ? 'bg-rose-50/70 hover:bg-rose-50'
                              : isSelected
                              ? 'bg-purple-100/85 hover:bg-purple-100'
                              : isEvenRow
                              ? 'bg-slate-50/90 hover:bg-purple-50/85'
                              : 'bg-white hover:bg-purple-50/85'
                          }`}
                        >
                          <td className="px-1.5 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(pm.id)}
                            />
                          </td>
                          <DatabaseValidatedCell
                            recordId={pm.id}
                            fieldKey="invoiceNumber"
                            rawValue={pm.invoiceNumber}
                            displayNode={pm.invoiceNumber}
                            validation={
                              rowValidation.invoiceNumber ||
                              validateDatabaseCellValue('payment', 'invoiceNumber', pm.invoiceNumber)
                            }
                            hasDraftOverride={Object.prototype.hasOwnProperty.call(
                              rowDrafts,
                              'invoiceNumber'
                            )}
                            className="font-mono font-bold text-purple-900 whitespace-nowrap"
                            onDraftChange={handleCellDraftChange}
                            onCommitValid={handleCellCommitValid}
                            onClearDraft={handleCellClearDraft}
                          />
                          <td className="px-1.5 py-1.5 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                category === 'exporter'
                                  ? 'bg-teal-100 text-teal-900'
                                  : 'bg-pink-100 text-pink-900'
                              }`}
                            >
                              {category === 'exporter' ? 'EXPORTER' : 'SUPPLIER'}
                            </span>
                          </td>
                          <DatabaseValidatedCell
                            recordId={pm.id}
                            fieldKey="date"
                            rawValue={pm.date}
                            displayNode={formatDate(pm.date)}
                            validation={
                              rowValidation.date ||
                              validateDatabaseCellValue('payment', 'date', pm.date)
                            }
                            hasDraftOverride={Object.prototype.hasOwnProperty.call(
                              rowDrafts,
                              'date'
                            )}
                            className="font-mono text-slate-600 whitespace-nowrap"
                            onDraftChange={handleCellDraftChange}
                            onCommitValid={handleCellCommitValid}
                            onClearDraft={handleCellClearDraft}
                          />
                          <DatabaseValidatedCell
                            recordId={pm.id}
                            fieldKey="description"
                            rawValue={pm.description}
                            displayNode={pm.description}
                            validation={
                              rowValidation.description ||
                              validateDatabaseCellValue('payment', 'description', pm.description)
                            }
                            hasDraftOverride={Object.prototype.hasOwnProperty.call(
                              rowDrafts,
                              'description'
                            )}
                            className="font-bold text-slate-800"
                            onDraftChange={handleCellDraftChange}
                            onCommitValid={handleCellCommitValid}
                            onClearDraft={handleCellClearDraft}
                          />
                          <td className="px-1.5 py-1.5 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
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
                          <DatabaseValidatedCell
                            recordId={pm.id}
                            fieldKey="paidAmount"
                            rawValue={pm.paidAmount}
                            displayNode={formatCurrency(pm.paidAmount, companyProfile.currency)}
                            align="right"
                            validation={
                              rowValidation.paidAmount ||
                              validateDatabaseCellValue('payment', 'paidAmount', pm.paidAmount)
                            }
                            hasDraftOverride={Object.prototype.hasOwnProperty.call(
                              rowDrafts,
                              'paidAmount'
                            )}
                            className="font-mono font-bold text-slate-900"
                            onDraftChange={handleCellDraftChange}
                            onCommitValid={handleCellCommitValid}
                            onClearDraft={handleCellClearDraft}
                          />
                          <DatabaseValidatedCell
                            recordId={pm.id}
                            fieldKey="balance"
                            rawValue={pm.balance}
                            displayNode={formatCurrency(pm.balance, companyProfile.currency)}
                            align="right"
                            validation={
                              rowValidation.balance ||
                              validateDatabaseCellValue('payment', 'balance', pm.balance)
                            }
                            hasDraftOverride={Object.prototype.hasOwnProperty.call(
                              rowDrafts,
                              'balance'
                            )}
                            className="font-mono font-bold text-rose-700"
                            onDraftChange={handleCellDraftChange}
                            onCommitValid={handleCellCommitValid}
                            onClearDraft={handleCellClearDraft}
                          />
                          <DatabaseValidatedCell
                            recordId={pm.id}
                            fieldKey="exportGoodsRef"
                            rawValue={pm.exportGoodsRef}
                            displayNode={pm.exportGoodsRef || '-'}
                            validation={
                              rowValidation.exportGoodsRef ||
                              validateDatabaseCellValue(
                                'payment',
                                'exportGoodsRef',
                                pm.exportGoodsRef
                              )
                            }
                            hasDraftOverride={Object.prototype.hasOwnProperty.call(
                              rowDrafts,
                              'exportGoodsRef'
                            )}
                            className="font-mono text-slate-600 whitespace-nowrap"
                            onDraftChange={handleCellDraftChange}
                            onCommitValid={handleCellCommitValid}
                            onClearDraft={handleCellClearDraft}
                          />
                          <td
                            className="px-1.5 py-1.5 max-w-[175px]"
                            data-testid={`reconciliation-status-cell-${pm.id}`}
                          >
                            {rec && (
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span
                                    data-testid={`reconciliation-badge-${pm.id}`}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                      rec.status === 'RECONCILED'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : rec.status === 'EXPORTER_LEDGER'
                                        ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                        : 'bg-rose-600 text-white shadow-xs'
                                    }`}
                                  >
                                    {rec.hasDiscrepancy ? (
                                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                    ) : (
                                      <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                    )}
                                    <span>{rec.label}</span>
                                  </span>
                                  {rec.hasDiscrepancy && (
                                    <span className="font-mono text-[9px] font-black text-rose-800 bg-rose-100 px-1 py-0.5 rounded">
                                      Δ {formatCurrency(rec.discrepancyAmount, companyProfile.currency)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-600 leading-tight">
                                  {rec.summaryText}
                                </div>
                                {rec.hasDiscrepancy && (
                                  <div data-export-ignore="true" className="pt-0.5">
                                    <button
                                      type="button"
                                      data-testid={`reconcile-record-btn-${pm.id}`}
                                      onClick={() => handleSmartSyncReconcile(pm.id)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b2b44] hover:bg-purple-800 text-amber-300 text-[9px] font-black uppercase tracking-wide transition cursor-pointer shadow-xs"
                                    >
                                      <RefreshCw className="w-2.5 h-2.5" />
                                      <span>Auto-Sync: {rec.resolutionLabel}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1">
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
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 rounded transition flex items-center space-x-0.5"
                                title="Print or Save PDF"
                              >
                                <Printer className="w-2.5 h-2.5" />
                                <span>PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePayment(pm.id)}
                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
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
