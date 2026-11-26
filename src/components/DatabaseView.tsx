import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  formatCurrency,
  formatDate,
  classifyPaymentCategory,
  calculatePackingTotalAmountBDT,
} from '../utils/calculations.ts';
import { useRowScrollViewport } from '../hooks/useRowScrollViewport.ts';
import { MAX_VISIBLE_TABLE_ROWS } from '../utils/tableScroll.ts';
import { yieldForDomFrame } from '../utils/pdfExportStyles.ts';
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
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Calculator,
} from 'lucide-react';
import {
  toggleSort,
  sortPurchaseRecords,
  sortPackingRecords,
  sortPaymentRecords,
  getColumnHeaderTitle,
  SortConfig,
} from '../utils/databaseSorting.ts';
import { buildPackingSerialNumberMap } from '../utils/packingSerialNumber.ts';
import { findShipmentByDeepLink } from '../utils/shipmentQrCode.ts';
import {
  downloadCsvFile,
  generatePurchasesCSV,
  generateFilteredPackingLedgerCSV,
  formatFilteredPackingCsvFilename,
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
import {
  buildSupplierRecordHistory,
  SupplierRecordHistoryRow,
} from '../utils/supplierHistory.ts';
import {
  resolveLedgerRowSource,
  ResolvedLedgerRowSource,
  LedgerEditValidationResult,
  buildPurchaseUpdateFromLedgerEdit,
  buildPaymentUpdateFromLedgerEdit,
  buildSupplierCreditUpdateFromLedgerEdit,
} from '../utils/supplierLedgerEdit.ts';
import { EditReconciliationRowModal } from './EditReconciliationRowModal.tsx';
import { formatDateImageStyle } from '../utils/calculations.ts';
import { exportElementToPdf, exportElementsToCombinedPdf, resolveCompanyLogoSrc } from '../utils/pdfGenerator.ts';
import { exportSupplierReconciliationLedgerPdf } from '../utils/supplierReconciliationPdf.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import {
  formatBatchPaymentSlipsPdfFilename,
  preparePaymentRecordsForBatchExport,
} from '../utils/batchPaymentSlipPdf.ts';
import { buildPackingDbPdfReport } from '../utils/packingDbPdfExport.ts';
import { PaymentSlipPrintCard } from './PaymentSlipPrintCard.tsx';
import { BatchUpdateSidebar } from './BatchUpdateSidebar.tsx';
import {
  BATCH_STATUS_OPTIONS,
  computeBulkSelectionState,
  toggleBulkSelectAll,
  toggleBulkSelectRow,
  resolvePurchaseRecordStatus,
  resolvePackingRecordStatus,
  resolvePaymentRecordStatus,
} from '../utils/batchDatabaseUpdate.ts';
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
import type { PaymentRecord, ExporterStatus } from '../types/index.ts';
import { emitPaymentSyncTrigger } from '../utils/paymentSync.ts';
import { matchesPaymentSearch } from '../utils/paymentFilters.ts';
import { matchesPackingShipperOrExporter } from '../utils/packingFilters.ts';
import { canUserEditRecords } from '../utils/rbacPermissions.ts';
import {
  useTableColumnOrder,
  UseTableColumnOrderResult,
} from '../hooks/useTableColumnOrder.ts';
import {
  ColumnReorderToolbar,
  ColumnDragGrip,
} from './ColumnReorderToolbar.tsx';

const RECONCILIATION_DEFAULT_COLUMNS = [
  'date',
  'supplierName',
  'debitAmount',
  'creditAmount',
  'balance',
  'status',
] as const;

const PURCHASE_DB_DEFAULT_COLUMNS = [
  'invoiceNumber',
  'date',
  'description',
  'contactNumber',
  'items',
  'totalQty',
  'totalAmount',
  'paidAmount',
  'balance',
  'status',
] as const;

const PACKING_DB_DEFAULT_COLUMNS = [
  'invoiceNumber',
  'date',
  'shippingMark',
  'flight',
  'destination',
  'shipper',
  'documentsHolder',
  'items',
  'totalBox',
  'totalWeight',
  'totalAmount',
  'rmbRate',
  'amountBDT',
  'status',
] as const;

const PAYMENT_DB_DEFAULT_COLUMNS = [
  'invoiceNumber',
  'type',
  'date',
  'description',
  'status',
  'paidAmount',
  'balance',
  'exportRef',
] as const;

interface DatabaseViewProps {
  initialType?: 'purchase' | 'packing' | 'payment';
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ initialType = 'purchase' }) => {
  const {
    purchases,
    addPurchase,
    updatePurchase,
    deletePurchase,
    batchDeletePurchases,
    batchUpdatePurchasesStatus,
    packings,
    updatePacking,
    deletePacking,
    batchDeletePackings,
    batchUpdatePackingsStatus,
    payments,
    addPayment,
    updatePayment,
    deletePayment,
    batchDeletePayments,
    batchUpdatePaymentsStatus,
    supplierCredits,
    updateSupplierCredit,
    batchDeleteSupplierCredits,
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
    currentUser,
  } = useApp();

  const canEditDbRecords = useMemo(() => canUserEditRecords(currentUser), [currentUser]);

  const reconciliationColOrder = useTableColumnOrder(
    'supplier_reconciliation',
    RECONCILIATION_DEFAULT_COLUMNS
  );
  const purchaseDbColOrder = useTableColumnOrder(
    'purchase_db',
    PURCHASE_DB_DEFAULT_COLUMNS
  );
  const packingDbColOrder = useTableColumnOrder(
    'packing_db',
    PACKING_DB_DEFAULT_COLUMNS
  );
  const paymentDbColOrder = useTableColumnOrder(
    'payment_db',
    PAYMENT_DB_DEFAULT_COLUMNS
  );

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
  const [packingPartySearch, setPackingPartySearch] = useState<string>('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<ExporterStatus>('PAID');
  const [selectedLedgerRowIds, setSelectedLedgerRowIds] = useState<string[]>([]);
  const [ledgerTargetStatus, setLedgerTargetStatus] = useState<ExporterStatus>('PAID');
  const [isExportingBatchSlips, setIsExportingBatchSlips] = useState<boolean>(false);
  const [isBatchSidebarOpen, setIsBatchSidebarOpen] = useState<boolean>(false);
  const [syncLedgerSupplier, setSyncLedgerSupplier] = useState<string>('ALL');
  const [syncLedgerFromDate, setSyncLedgerFromDate] = useState<string>('');
  const [syncLedgerToDate, setSyncLedgerToDate] = useState<string>('');
  const [syncLedgerSortDirection, setSyncLedgerSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSyncLedgerExpanded, setIsSyncLedgerExpanded] = useState<boolean>(true);
  const [isExportingSyncLedgerPdf, setIsExportingSyncLedgerPdf] = useState<boolean>(false);

  const syncLedgerScrollRef = useRef<HTMLDivElement>(null);
  const purchaseDbScrollRef = useRef<HTMLDivElement>(null);
  const packingDbScrollRef = useRef<HTMLDivElement>(null);
  const paymentDbScrollRef = useRef<HTMLDivElement>(null);
  const purchaseHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const packingHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const paymentHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const ledgerHeaderCheckboxRef = useRef<HTMLInputElement>(null);

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
        cellDraftsByDb[activeDbType],
        { acceptSavedNegatives: true, acceptSavedImportValues: true }
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
      const nextPending = (target.pendingFields || []).filter((f) => f !== fieldKey);
      const nextRaw = { ...(target.rawValues || {}) };
      delete nextRaw[fieldKey];
      updates.pendingFields = nextPending.length > 0 ? nextPending : undefined;
      updates.rawValues = Object.keys(nextRaw).length > 0 ? nextRaw : undefined;
      updates.calculationPending = nextPending.length > 0;
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
      const nextPending = (target.pendingFields || []).filter((f) => f !== fieldKey);
      const nextRaw = { ...(target.rawValues || {}) };
      delete nextRaw[fieldKey];
      updates.pendingFields = nextPending.length > 0 ? nextPending : undefined;
      updates.rawValues = Object.keys(nextRaw).length > 0 ? nextRaw : undefined;
      updates.calculationPending = nextPending.length > 0;
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
      const updates: Record<string, unknown> = { [fieldKey]: parsedValue };
      const nextPending = (target.pendingFields || []).filter((f) => f !== fieldKey);
      const nextRaw = { ...(target.rawValues || {}) };
      delete nextRaw[fieldKey];
      updates.pendingFields = nextPending.length > 0 ? nextPending : undefined;
      updates.rawValues = Object.keys(nextRaw).length > 0 ? nextRaw : undefined;
      updates.calculationPending = nextPending.length > 0;
      updatePayment(recordId, updates);
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

  // Smart Data Sync live reconciliation analysis across Purchase DB & Payment DB (skipped when viewing Packing DB)
  const smartSyncAnalysis = useMemo(() => {
    if (activeDbType === 'packing') {
      return analyzePurchasePaymentReconciliation([], []);
    }
    return analyzePurchasePaymentReconciliation(purchases, payments);
  }, [activeDbType, purchases, payments]);

  const syncSupplierLedgerRows = useMemo(() => {
    if (activeDbType === 'packing') {
      return [];
    }
    return buildSupplierRecordHistory(purchases, payments, supplierCredits || [], {
      supplierName: syncLedgerSupplier,
      fromDate: syncLedgerFromDate,
      toDate: syncLedgerToDate,
      sortDirection: syncLedgerSortDirection,
    });
  }, [
    activeDbType,
    purchases,
    payments,
    supplierCredits,
    syncLedgerSupplier,
    syncLedgerFromDate,
    syncLedgerToDate,
    syncLedgerSortDirection,
  ]);

  const syncSupplierLedgerTotals = useMemo(() => {
    const totalDebit = syncSupplierLedgerRows.reduce((acc, r) => acc + r.debitAmount, 0);
    const totalCredit = syncSupplierLedgerRows.reduce((acc, r) => acc + r.creditAmount, 0);
    const netEndingBalance = totalDebit - totalCredit;
    return { totalDebit, totalCredit, netEndingBalance };
  }, [syncSupplierLedgerRows]);

  const handleExportSyncLedgerPdf = async () => {
    if (isExportingSyncLedgerPdf) return;
    setIsExportingSyncLedgerPdf(true);
    const safeSupplier =
      syncLedgerSupplier === 'ALL'
        ? 'ALL_SUPPLIERS'
        : syncLedgerSupplier.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateTag =
      syncLedgerFromDate || syncLedgerToDate
        ? `${syncLedgerFromDate || 'START'}_to_${syncLedgerToDate || 'END'}`
        : new Date().toISOString().slice(0, 10);
    const pdfFilename = `ZSB_AQUATICS_SUPPLIER_RECONCILIATION_LEDGER_${safeSupplier}_${dateTag}.pdf`;
    try {
      await yieldForDomFrame();
      const canvasEl = document.getElementById('supplier-reconciliation-ledger-pdf-canvas');
      if (canvasEl) {
        const ok = await exportElementToPdf(canvasEl, pdfFilename);
        if (ok) {
          showToast(`Exported PDF: ${pdfFilename}`);
          return;
        }
      }
      const result = exportSupplierReconciliationLedgerPdf({
        companyProfile,
        supplierFilter: syncLedgerSupplier,
        fromDate: syncLedgerFromDate,
        toDate: syncLedgerToDate,
        sortDirection: syncLedgerSortDirection,
        rows: syncSupplierLedgerRows,
        totals: syncSupplierLedgerTotals,
      });
      if (result.ok) {
        showToast(`Exported PDF: ${result.filename}`);
      } else {
        showToast('Failed to export Supplier Reconciliation Ledger PDF. Please try again.');
      }
    } catch (err) {
      console.error('Supplier Reconciliation Ledger PDF export failed:', err);
      showToast('Failed to export Supplier Reconciliation Ledger PDF. Please try again.');
    } finally {
      setIsExportingSyncLedgerPdf(false);
    }
  };

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

  // Editing payment modal state for maintenance & corrections
  const [editingPaymentRecord, setEditingPaymentRecord] = useState<PaymentRecord | null>(null);
  const [editingReconciliationRow, setEditingReconciliationRow] =
    useState<ResolvedLedgerRowSource | null>(null);

  const handleOpenReconciliationRowEdit = (row: SupplierRecordHistoryRow) => {
    if (!canEditDbRecords) {
      showToast('Read-only role: You do not have permission to edit ledger entries.');
      return;
    }
    const resolved = resolveLedgerRowSource(
      row,
      purchases,
      payments,
      supplierCredits || []
    );
    if (!resolved) {
      showToast(`Unable to locate underlying record for ${row.invoiceNumber}.`);
      return;
    }
    setEditingReconciliationRow(resolved);
  };

  const handleSaveReconciliationRowEdit = (
    target: ResolvedLedgerRowSource,
    validated: LedgerEditValidationResult,
    remarks: string
  ) => {
    if (target.recordType === 'PURCHASE_BILL' && target.purchase) {
      const updates = buildPurchaseUpdateFromLedgerEdit(
        target.purchase,
        validated,
        remarks
      );
      updatePurchase(target.purchase.id, updates);
    } else if (target.recordType === 'PAYMENT_VOUCHER' && target.payment) {
      const updates = buildPaymentUpdateFromLedgerEdit(
        target.payment,
        validated,
        remarks
      );
      updatePayment(target.payment.id, updates);
    } else if (target.recordType === 'CREDIT_NOTE' && target.creditNote) {
      const updates = buildSupplierCreditUpdateFromLedgerEdit(
        target.creditNote,
        validated,
        remarks
      );
      updateSupplierCredit(target.creditNote.id, updates);
    }
    setEditingReconciliationRow(null);
  };

  const handleOpenFullPurchaseFromLedger = (purchaseId: string) => {
    setEditingReconciliationRow(null);
    setEditingPurchaseId(purchaseId);
    setActiveTab('purchase_form');
  };
  const [paymentEditForm, setPaymentEditForm] = useState<{
    invoiceNumber: string;
    date: string;
    description: string;
    paidAmount: string;
    totalAmount: string;
    balance: string;
    returnRMB: string;
    status: ExporterStatus;
    exportGoodsRef: string;
    remarks: string;
  }>({
    invoiceNumber: '',
    date: '',
    description: '',
    paidAmount: '',
    totalAmount: '',
    balance: '',
    returnRMB: '0',
    status: 'PAID',
    exportGoodsRef: '',
    remarks: '',
  });

  useEffect(() => {
    if (editingPaymentRecord) {
      setPaymentEditForm({
        invoiceNumber:
          editingPaymentRecord.rawValues?.invoiceNumber ||
          editingPaymentRecord.invoiceNumber ||
          '',
        date:
          editingPaymentRecord.rawValues?.date ||
          editingPaymentRecord.date ||
          new Date().toISOString().slice(0, 10),
        description:
          editingPaymentRecord.rawValues?.description ??
          (editingPaymentRecord.description || ''),
        paidAmount:
          editingPaymentRecord.rawValues?.paidAmount ??
          editingPaymentRecord.rawValues?.totalAmount ??
          String(editingPaymentRecord.paidAmount ?? 0),
        totalAmount:
          editingPaymentRecord.rawValues?.totalAmount ??
          editingPaymentRecord.rawValues?.debitAmount ??
          String(editingPaymentRecord.totalAmount ?? 0),
        balance:
          editingPaymentRecord.rawValues?.balance ??
          editingPaymentRecord.rawValues?.creditAmount ??
          String(editingPaymentRecord.balance ?? 0),
        returnRMB:
          editingPaymentRecord.rawValues?.returnRMB ??
          String(editingPaymentRecord.returnRMB ?? 0),
        status: (editingPaymentRecord.status as ExporterStatus) || 'PAID',
        exportGoodsRef:
          editingPaymentRecord.rawValues?.exportGoodsRef ??
          (editingPaymentRecord.exportGoodsRef || ''),
        remarks:
          editingPaymentRecord.rawValues?.remarks ??
          (editingPaymentRecord.remarks || ''),
      });
    }
  }, [editingPaymentRecord]);

  const handleSavePaymentEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentRecord) return;
    const paidRawStr = String(paymentEditForm.paidAmount ?? '').trim();
    const totalRawStr = String(paymentEditForm.totalAmount ?? '').trim();
    const balRawStr = String(paymentEditForm.balance ?? '').trim();
    const rmbRawStr = String(paymentEditForm.returnRMB ?? '').trim();
    const dateRawStr = String(paymentEditForm.date ?? '').trim();

    const paidIsFormulaOrText =
      paidRawStr !== '' &&
      (paidRawStr.startsWith('=') || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(paidRawStr));
    const totalIsFormulaOrText =
      totalRawStr !== '' &&
      (totalRawStr.startsWith('=') || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(totalRawStr));
    const balIsFormulaOrText =
      balRawStr !== '' &&
      (balRawStr.startsWith('=') || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(balRawStr));
    const rmbIsFormulaOrText =
      rmbRawStr !== '' &&
      (rmbRawStr.startsWith('=') || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(rmbRawStr));

    const paidAmt = paidIsFormulaOrText
      ? 0
      : Math.round((parseFloat(paidRawStr) || 0) * 100) / 100;
    const totalAmt = totalIsFormulaOrText
      ? 0
      : Math.round((parseFloat(totalRawStr) || 0) * 100) / 100;
    const balAmt = balIsFormulaOrText
      ? 0
      : balRawStr !== ''
      ? Math.round((parseFloat(balRawStr) || 0) * 100) / 100
      : Math.round((totalAmt - paidAmt) * 100) / 100;
    const rmbAmt = rmbIsFormulaOrText
      ? 0
      : Math.round((parseFloat(rmbRawStr) || 0) * 100) / 100;
    const rmbRate = companyProfile.rmbExchangeRate || 16.5;

    const nextRawValues: Record<string, string> = { ...(editingPaymentRecord.rawValues || {}) };
    const nextPendingFields = new Set(editingPaymentRecord.pendingFields || []);
    if (paidIsFormulaOrText) {
      nextRawValues.paidAmount = paidRawStr;
      nextPendingFields.add('paidAmount');
    } else {
      delete nextRawValues.paidAmount;
      nextPendingFields.delete('paidAmount');
    }
    if (totalIsFormulaOrText) {
      nextRawValues.totalAmount = totalRawStr;
      nextRawValues.debitAmount = totalRawStr;
      nextPendingFields.add('totalAmount');
    } else {
      delete nextRawValues.totalAmount;
      delete nextRawValues.debitAmount;
      nextPendingFields.delete('totalAmount');
    }
    if (balIsFormulaOrText) {
      nextRawValues.balance = balRawStr;
      nextRawValues.creditAmount = balRawStr;
      nextPendingFields.add('balance');
    } else {
      delete nextRawValues.balance;
      delete nextRawValues.creditAmount;
      nextPendingFields.delete('balance');
    }
    if (rmbIsFormulaOrText) {
      nextRawValues.returnRMB = rmbRawStr;
      nextPendingFields.add('returnRMB');
    } else {
      delete nextRawValues.returnRMB;
      nextPendingFields.delete('returnRMB');
    }
    if (dateRawStr.startsWith('=')) {
      nextRawValues.date = dateRawStr;
    } else {
      delete nextRawValues.date;
    }
    if (paymentEditForm.description.trim().startsWith('=')) {
      nextRawValues.description = paymentEditForm.description.trim();
    } else {
      delete nextRawValues.description;
    }
    if (paymentEditForm.remarks.trim().startsWith('=')) {
      nextRawValues.remarks = paymentEditForm.remarks.trim();
    } else {
      delete nextRawValues.remarks;
    }

    const updatedItems =
      Array.isArray(editingPaymentRecord.items) && editingPaymentRecord.items.length > 0
        ? editingPaymentRecord.items.map((it, idx) =>
            idx === 0
              ? {
                  ...it,
                  date: dateRawStr,
                  creditAmount: paidAmt,
                  debitAmount: it.debitAmount || 0,
                  balance: balAmt,
                  status: paymentEditForm.status,
                  description: paymentEditForm.remarks.trim() || it.description,
                }
              : it
          )
        : [
            {
              id: '1',
              date: dateRawStr,
              creditAmount: paidAmt,
              debitAmount: 0,
              balance: balAmt,
              status: paymentEditForm.status,
              description:
                paymentEditForm.remarks.trim() ||
                `Payment to ${paymentEditForm.description}`,
            },
          ];

    const pendingArr = Array.from(nextPendingFields);
    updatePayment(editingPaymentRecord.id, {
      invoiceNumber: paymentEditForm.invoiceNumber.trim(),
      date: dateRawStr,
      description: paymentEditForm.description.trim(),
      paidAmount: paidAmt,
      totalAmount: totalAmt,
      balance: balAmt,
      returnRMB: rmbAmt,
      returnRMBInBDT: rmbIsFormulaOrText ? 0 : Math.round(rmbAmt * rmbRate * 100) / 100,
      status: paymentEditForm.status,
      exportGoodsRef: paymentEditForm.exportGoodsRef.trim(),
      remarks: paymentEditForm.remarks.trim(),
      items: updatedItems,
      calculationPending: pendingArr.length > 0,
      pendingFields: pendingArr.length > 0 ? pendingArr : undefined,
      rawValues: Object.keys(nextRawValues).length > 0 ? nextRawValues : undefined,
    });

    emitPaymentSyncTrigger({
      category: classifyPaymentCategory(editingPaymentRecord),
      action: 'update',
      invoiceNumber: paymentEditForm.invoiceNumber.trim(),
      partyName: paymentEditForm.description.trim(),
      creditAmount: paidAmt,
      runningBalance: balAmt,
    });

    showToast(`Payment voucher ${paymentEditForm.invoiceNumber.trim()} updated successfully!`);
    setEditingPaymentRecord(null);
  };

  useEffect(() => {
    if (focusedShipmentInvoice) {
      setActiveDbType('packing');
      setSearchTerm(focusedShipmentInvoice);
    }
  }, [focusedShipmentInvoice]);

  useEffect(() => {
    if (!focusedShipmentInvoice) {
      setActiveDbType(initialType);
      setSelectedIds([]);
    }
  }, [initialType, focusedShipmentInvoice]);

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
    setSelectedIds((prev) => toggleBulkSelectAll(allIds, prev));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => toggleBulkSelectRow(id, prev));
  };

  const handleSelectAllLedgerRows = (allLedgerIds: string[]) => {
    setSelectedLedgerRowIds((prev) => toggleBulkSelectAll(allLedgerIds, prev));
  };

  const toggleSelectLedgerRow = (rowId: string) => {
    setSelectedLedgerRowIds((prev) => toggleBulkSelectRow(rowId, prev));
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
      // Allow React DOM to flush offscreen batch slip elements without artificial 150ms sleep
      await yieldForDomFrame();
      await yieldForDomFrame();

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

  // In-memory dataset indices for fast indexed search & filtering (lazily built only for the active dataset)
  const isPurchaseDbActive = activeDbType === 'purchase';
  const isPackingDbActive = activeDbType === 'packing';

  const purchaseIndices = useMemo(
    () =>
      buildDatasetIndices(isPurchaseDbActive ? purchases : [], {
        getInvoice: (p) => p.invoiceNumber,
        getDate: (p) => p.date,
        getParty: (p) => p.description,
        getSearchableText: (p) =>
          `${p.invoiceNumber} ${p.description} ${p.contactNumber || ''} ${p.remarks || ''}`,
      }),
    [isPurchaseDbActive, purchases]
  );

  const packingIndices = useMemo(
    () =>
      buildDatasetIndices(isPackingDbActive ? packings : [], {
        getInvoice: (p) => p.invoiceNumber,
        getDate: (p) => p.packingDate || p.fromDate || p.toDate,
        getParty: (p) => p.shippingMark,
        getSearchableText: (p) =>
          `${p.invoiceNumber} ${p.shippingMark} ${p.destination} ${p.shipper} ${p.documentsHolder || ''} ${p.flight} ${p.remarks || ''}`,
      }),
    [isPackingDbActive, packings]
  );

  // Filtered lists reactive to search term, date range, reconciliation status, and field validation filter using index queries
  const filteredPurchases = useMemo(() => {
    if (activeDbType !== 'purchase') return [];
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
    activeDbType,
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
    if (activeDbType !== 'packing') return [];
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
      if (!matchesPackingShipperOrExporter(pkg, packingPartySearch)) {
        return false;
      }
      return true;
    });
  }, [
    activeDbType,
    packings,
    packingIndices,
    validationFilter,
    validationSummary.invalidRecordIds,
    searchTerm,
    packingPartySearch,
    startDate,
    endDate,
  ]);

  const filteredPayments = useMemo(() => {
    if (activeDbType !== 'payment') return [];
    const activeSearch = (paymentSearchQuery || (activeDbType === 'payment' ? searchTerm : '')).trim();

    return payments.filter((pm) => {
      // 1. Date range filter
      if (startDate || endDate) {
        if (!isDateInRange(pm.date, startDate, endDate)) {
          return false;
        }
      }

      // 2. Real-time search by supplier name, reference ID, or payment remarks
      if (activeSearch && !matchesPaymentSearch(pm, activeSearch)) {
        return false;
      }

      // 3. Category filter
      const cat = classifyPaymentCategory(pm);
      if (paymentCategoryFilter !== 'all' && cat !== paymentCategoryFilter) {
        return false;
      }

      // 4. Validation filter
      if (
        validationFilter === 'invalid_only' &&
        !validationSummary.invalidRecordIds.includes(pm.id)
      ) {
        return false;
      }

      // 5. Smart sync reconciliation filter
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
    paymentSearchQuery,
    searchTerm,
    activeDbType,
    startDate,
    endDate,
    paymentCategoryFilter,
    validationFilter,
    validationSummary.invalidRecordIds,
    smartSyncAnalysis,
    reconciliationFilter,
  ]);

  // Sorted records based on active sort configuration
  const sortedPurchases = useMemo(() => {
    if (activeDbType !== 'purchase') return [];
    return sortPurchaseRecords(
      filteredPurchases,
      purchaseSort,
      smartSyncAnalysis.purchaseReconciliations
    );
  }, [activeDbType, filteredPurchases, purchaseSort, smartSyncAnalysis.purchaseReconciliations]);

  const packingSerialNumberMap = useMemo(
    () => buildPackingSerialNumberMap(packings),
    [packings]
  );

  const sortedPackings = useMemo(() => {
    if (activeDbType !== 'packing') return [];
    return sortPackingRecords(
      filteredPackings,
      packingSort,
      companyProfile.rmbExchangeRate || 16.5
    );
  }, [activeDbType, filteredPackings, packingSort, companyProfile.rmbExchangeRate]);

  const sortedPayments = useMemo(() => {
    if (activeDbType !== 'payment') return [];
    return sortPaymentRecords(
      filteredPayments,
      paymentSort,
      smartSyncAnalysis.paymentReconciliations
    );
  }, [activeDbType, filteredPayments, paymentSort, smartSyncAnalysis.paymentReconciliations]);

  const {
    maxHeight: syncLedgerScrollMaxHeight,
    isCapped: isSyncLedgerScrollCapped,
  } = useRowScrollViewport(syncLedgerScrollRef, syncSupplierLedgerRows.length, {
    maxVisibleRows: MAX_VISIBLE_TABLE_ROWS,
    enabled:
      isSyncLedgerExpanded &&
      (activeDbType === 'purchase' || activeDbType === 'payment'),
    includeFooter: true,
    depsKey: `${activeDbType}|${syncLedgerSupplier}|${syncLedgerFromDate}|${syncLedgerToDate}|${syncLedgerSortDirection}`,
  });

  const {
    maxHeight: purchaseDbScrollMaxHeight,
    isCapped: isPurchaseDbScrollCapped,
  } = useRowScrollViewport(purchaseDbScrollRef, sortedPurchases.length, {
    maxVisibleRows: MAX_VISIBLE_TABLE_ROWS,
    enabled: activeDbType === 'purchase',
    includeFooter: false,
    depsKey: `${activeDbType}|${searchTerm}|${startDate}|${endDate}|${purchaseSort.column}|${purchaseSort.direction}|${validationFilter}|${reconciliationFilter}`,
  });

  const {
    maxHeight: packingDbScrollMaxHeight,
    isCapped: isPackingDbScrollCapped,
  } = useRowScrollViewport(packingDbScrollRef, sortedPackings.length, {
    maxVisibleRows: MAX_VISIBLE_TABLE_ROWS,
    enabled: activeDbType === 'packing',
    includeFooter: true,
    depsKey: `${activeDbType}|${searchTerm}|${packingPartySearch}|${startDate}|${endDate}|${packingSort.column}|${packingSort.direction}|${validationFilter}`,
  });

  const {
    maxHeight: paymentDbScrollMaxHeight,
    isCapped: isPaymentDbScrollCapped,
  } = useRowScrollViewport(paymentDbScrollRef, sortedPayments.length, {
    maxVisibleRows: MAX_VISIBLE_TABLE_ROWS,
    enabled: activeDbType === 'payment',
    includeFooter: false,
    depsKey: `${activeDbType}|${searchTerm}|${paymentSearchQuery}|${startDate}|${endDate}|${paymentCategoryFilter}|${paymentSort.column}|${paymentSort.direction}|${validationFilter}|${reconciliationFilter}`,
  });

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

  // Visible row IDs and bulk selection state for active DatabaseView table
  const activeVisibleIds = useMemo(() => {
    if (activeDbType === 'purchase') return sortedPurchases.map((p) => p.id);
    if (activeDbType === 'packing') return sortedPackings.map((p) => p.id);
    return sortedPayments.map((p) => p.id);
  }, [activeDbType, sortedPurchases, sortedPackings, sortedPayments]);

  const activeSelectionState = useMemo(
    () => computeBulkSelectionState(activeVisibleIds, selectedIds),
    [activeVisibleIds, selectedIds]
  );

  const visibleLedgerRowIds = useMemo(
    () => syncSupplierLedgerRows.map((r) => r.id),
    [syncSupplierLedgerRows]
  );

  const ledgerSelectionState = useMemo(
    () => computeBulkSelectionState(visibleLedgerRowIds, selectedLedgerRowIds),
    [visibleLedgerRowIds, selectedLedgerRowIds]
  );

  // Sync native checkbox indeterminate property for header checkboxes
  useEffect(() => {
    if (purchaseHeaderCheckboxRef.current) {
      purchaseHeaderCheckboxRef.current.indeterminate =
        activeDbType === 'purchase' && activeSelectionState.someSelected;
    }
    if (packingHeaderCheckboxRef.current) {
      packingHeaderCheckboxRef.current.indeterminate =
        activeDbType === 'packing' && activeSelectionState.someSelected;
    }
    if (paymentHeaderCheckboxRef.current) {
      paymentHeaderCheckboxRef.current.indeterminate =
        activeDbType === 'payment' && activeSelectionState.someSelected;
    }
  }, [activeDbType, activeSelectionState.someSelected]);

  useEffect(() => {
    if (ledgerHeaderCheckboxRef.current) {
      ledgerHeaderCheckboxRef.current.indeterminate = ledgerSelectionState.someSelected;
    }
  }, [ledgerSelectionState.someSelected]);

  // Batch status update handler for selected rows in active DatabaseView table
  const handleBatchStatusUpdate = (statusOverride?: ExporterStatus) => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one row using the checkboxes to update status.');
      return;
    }
    const targetStatus = (statusOverride || bulkTargetStatus || 'PAID').trim().toUpperCase();
    if (activeDbType === 'purchase') {
      batchUpdatePurchasesStatus(selectedIds, targetStatus);
    } else if (activeDbType === 'packing') {
      batchUpdatePackingsStatus(selectedIds, targetStatus);
    } else {
      batchUpdatePaymentsStatus(selectedIds, targetStatus);
    }
  };

  // Batch deletion handler for selected rows in active DatabaseView table
  const handleBatchDeleteSelected = () => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one row using the checkboxes to delete.');
      return;
    }
    if (activeDbType === 'purchase') {
      batchDeletePurchases(selectedIds);
    } else if (activeDbType === 'packing') {
      batchDeletePackings(selectedIds);
    } else {
      batchDeletePayments(selectedIds);
    }
    setSelectedIds([]);
  };

  // Batch status update & delete for Supplier Account Reconciliation Ledger rows
  const handleLedgerBatchStatusUpdate = (statusOverride?: ExporterStatus) => {
    if (selectedLedgerRowIds.length === 0) {
      showToast('Please select at least one reconciliation ledger row to update status.');
      return;
    }
    const targetStatus = (statusOverride || ledgerTargetStatus || 'PAID').trim().toUpperCase();
    const purchaseIds = selectedLedgerRowIds
      .filter((id) => id.startsWith('purchase-'))
      .map((id) => id.replace(/^purchase-/, ''));
    const paymentIds = selectedLedgerRowIds
      .filter((id) => id.startsWith('voucher-'))
      .map((id) => id.replace(/^voucher-/, ''));
    const creditIds = selectedLedgerRowIds
      .filter((id) => id.startsWith('credit-'))
      .map((id) => id.replace(/^credit-/, ''));

    if (purchaseIds.length > 0) {
      batchUpdatePurchasesStatus(purchaseIds, targetStatus);
    }
    if (paymentIds.length > 0) {
      batchUpdatePaymentsStatus(paymentIds, targetStatus);
    }
    if (creditIds.length > 0) {
      for (const cnId of creditIds) {
        const cn = (supplierCredits || []).find((c) => c.id === cnId);
        if (!cn) continue;
        const markPaid = targetStatus === 'PAID';
        updateSupplierCredit(cnId, {
          appliedAmount: markPaid ? cn.amount : 0,
          remainingAmount: markPaid ? 0 : cn.amount,
          status: markPaid ? 'APPLIED' : 'AVAILABLE',
        });
      }
    }
    showToast(
      `Updated status to ${targetStatus} for ${selectedLedgerRowIds.length} selected reconciliation ledger row(s).`
    );
  };

  const handleLedgerBatchDeleteSelected = () => {
    if (selectedLedgerRowIds.length === 0) {
      showToast('Please select at least one reconciliation ledger row to delete.');
      return;
    }
    const purchaseIds = selectedLedgerRowIds
      .filter((id) => id.startsWith('purchase-'))
      .map((id) => id.replace(/^purchase-/, ''));
    const paymentIds = selectedLedgerRowIds
      .filter((id) => id.startsWith('voucher-'))
      .map((id) => id.replace(/^voucher-/, ''));
    const creditIds = selectedLedgerRowIds
      .filter((id) => id.startsWith('credit-'))
      .map((id) => id.replace(/^credit-/, ''));

    if (purchaseIds.length > 0) {
      batchDeletePurchases(purchaseIds);
    }
    if (paymentIds.length > 0) {
      batchDeletePayments(paymentIds);
    }
    if (creditIds.length > 0) {
      batchDeleteSupplierCredits(creditIds);
    }
    setSelectedLedgerRowIds([]);
  };

  // Helper to render consistent status badge across all DatabaseView tables
  const renderStatusBadge = (statusValue: ExporterStatus, testId?: string) => {
    const clean = (statusValue || 'UNPAID').trim().toUpperCase();
    const badgeColor =
      clean === 'PAID'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
        : clean === 'REPORT' || clean === 'PARTIAL'
        ? 'bg-blue-100 text-blue-800 border-blue-300'
        : clean === 'PENDING'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-rose-100 text-rose-800 border-rose-300';

    return (
      <span
        data-testid={testId}
        className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-tight whitespace-nowrap ${badgeColor}`}
      >
        {clean}
      </span>
    );
  };

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
      const csv = generateFilteredPackingLedgerCSV(sortedPackings, {
        serialNumberMap: packingSerialNumberMap,
        columnOrder: packingDbColOrder.columnOrder,
      });
      const filename = formatFilteredPackingCsvFilename({
        startDate,
        endDate,
        partyQuery: packingPartySearch,
        searchTerm,
        validationFilter,
        referenceDate: today,
      });
      downloadCsvFile(csv, filename);
      showToast(
        `Exported ${sortedPackings.length} filtered packing record${sortedPackings.length === 1 ? '' : 's'} to CSV (${filename})`
      );
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

  // Export currently filtered Packing DB view as an official A4 Company-Pad PDF (with column toggle preview)
  const handleExportPackingPdf = () => {
    if (sortedPackings.length === 0) {
      showToast('No packing records in current filtered view to export as PDF.');
      return;
    }
    const report = buildPackingDbPdfReport({
      records: sortedPackings,
      totalRecordCount: packings.length,
      companyProfile,
      serialNumberMap: packingSerialNumberMap,
      columnOrder: packingDbColOrder.columnOrder,
      startDate,
      endDate,
      partyQuery: packingPartySearch,
      searchTerm,
      validationFilter,
    });
    openPrintModal({
      type: 'global_view_table',
      title: report.documentTitle,
      data: report,
    });
  };

  const isDateFilterActive = Boolean(startDate || endDate);

  /**
   * Helper to render sortable (and optionally drag-reorderable) table column header
   */
  const renderSortableHeader = (
    colKey: string,
    label: string,
    align: 'left' | 'center' | 'right' = 'left',
    extraClasses: string = '',
    dragCtx?: UseTableColumnOrderResult<any>
  ) => {
    const isSorted = activeSortConfig.column === colKey;
    const dir = activeSortConfig.direction;
    const alignClass =
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
    const dragProps = dragCtx ? dragCtx.getHeaderDragProps(colKey, label) : undefined;
    const dragClass = dragCtx ? dragCtx.getHeaderDragClassName(colKey) : '';

    return (
      <th
        key={colKey}
        scope="col"
        aria-sort={isSorted ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        data-testid={`sort-header-${colKey}`}
        {...dragProps}
        onClick={() => handleHeaderSortClick(colKey)}
        title={`Click to sort by ${label} (${
          isSorted
            ? `currently ${dir}ending, click to sort ${dir === 'asc' ? 'desc' : 'asc'}ending`
            : 'click to sort'
        })${dragCtx ? ' · Drag header to reorder column' : ''}`}
        className={`px-1.5 py-2 select-none cursor-pointer transition-colors hover:bg-black/25 group ${alignClass} ${extraClasses} ${dragClass}`}
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
          {dragCtx && <ColumnDragGrip className="w-2.5 h-2.5 opacity-45 group-hover:opacity-90 shrink-0" />}
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
      <div className="bg-[#273E56] text-white px-5 py-3 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#1D6CE0]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#93C5FD] bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-amber-400 zsb-golden-brand">
                {companyProfile.companyName}
              </span>
              <span className="text-lg text-slate-400">|</span>
              <span className="text-sm sm:text-base font-semibold text-[#93C5FD] uppercase tracking-wide">
                Master Database Sheets &amp; Batch Print Center
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Filter by Date Range, Import or Export Excel (.xlsx) &amp; CSV (.csv), Select records for Batch Print, or audit transactions
            </p>
          </div>
        </div>

        {/* Database Switcher Tabs */}
        <div className="flex items-center space-x-1.5 bg-[#1F3349] p-1 rounded-lg border border-[#3B5572]">
          <button
            onClick={() => {
              setActiveDbType('purchase');
              setActiveTab('purchase_db');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition cursor-pointer ${
              activeDbType === 'purchase'
                ? 'bg-[#1D6CE0] text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Purchase DB ({purchases.length})
          </button>
          <button
            onClick={() => {
              setActiveDbType('packing');
              setActiveTab('packing_db');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition cursor-pointer ${
              activeDbType === 'packing'
                ? 'bg-[#00B14F] text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Packing DB ({packings.length})
          </button>
          <button
            onClick={() => {
              setActiveDbType('payment');
              setActiveTab('payment_db');
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition cursor-pointer ${
              activeDbType === 'payment'
                ? 'bg-[#7C3AED] text-white shadow'
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
                  Automatically cross-references Purchase Challans against Supplier Payment Vouchers to reconcile missing payment vouchers, paid amount mismatches, and balance drift across ledgers.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Reconciliation Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-white/90 p-1.5 rounded-xl border border-slate-300 text-xs">
                <button
                  type="button"
                  data-testid="smart-sync-filter-all"
                  aria-pressed={reconciliationFilter === 'all'}
                  onClick={() => setReconciliationFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    reconciliationFilter === 'all'
                      ? 'bg-[#273E56] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  All ({activeDbType === 'purchase' ? purchases.length : payments.length})
                </button>
                <button
                  type="button"
                  data-testid="smart-sync-filter-discrepancies"
                  aria-pressed={reconciliationFilter === 'discrepancies'}
                  onClick={() => setReconciliationFilter('discrepancies')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
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
                  aria-pressed={reconciliationFilter === 'reconciled'}
                  onClick={() => setReconciliationFilter('reconciled')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide shadow-sm transition whitespace-nowrap ${
                  smartSyncAnalysis.summary.discrepancyCount > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-emerald-700/20 text-emerald-900 border border-emerald-300 cursor-not-allowed'
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
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
                className="px-2.5 py-1 text-emerald-200 hover:text-white text-xs font-bold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Supplier Account Reconciliation Ledger Table (Matching Image Formula: Balance = Prev + Debit - Credit) */}
          <div className="mt-4 pt-4 border-t border-slate-200/90" data-testid="smart-sync-supplier-ledger">
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  data-testid="toggle-supplier-reconciliation-ledger-btn"
                  aria-expanded={isSyncLedgerExpanded}
                  onClick={() => setIsSyncLedgerExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide text-slate-900 hover:text-purple-800 transition cursor-pointer whitespace-nowrap"
                >
                  {isSyncLedgerExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                  )}
                  <span>SUPPLIER ACCOUNT RECONCILIATION LEDGER</span>
                </button>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-100 text-blue-900 text-[10px] font-mono font-bold border border-blue-200">
                  <Calculator className="w-3 h-3 text-blue-700 shrink-0" />
                  <span>Formula: Balance = Prev Balance + Debit Amount - Credit Amount (Credit Amount = Paid Amount)</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Supplier Filter Select */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Supplier:</span>
                  <select
                    data-testid="smart-sync-supplier-select"
                    aria-label="Supplier filter"
                    value={syncLedgerSupplier}
                    onChange={(e) => setSyncLedgerSupplier(e.target.value)}
                    className="font-bold text-slate-900 text-xs bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">ALL SUPPLIERS</option>
                    {dropdownOptions.suppliers.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>
                </div>

                {/* From Date Input */}
                <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500 whitespace-nowrap">
                    From Date:
                  </span>
                  <input
                    type="date"
                    data-testid="sync-ledger-from-date"
                    aria-label="Reconciliation From Date"
                    value={syncLedgerFromDate}
                    onChange={(e) => setSyncLedgerFromDate(e.target.value)}
                    className="font-mono font-bold text-slate-900 text-xs bg-transparent focus:outline-none cursor-pointer"
                  />
                </label>

                {/* To Date Input */}
                <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500 whitespace-nowrap">
                    To Date:
                  </span>
                  <input
                    type="date"
                    data-testid="sync-ledger-to-date"
                    aria-label="Reconciliation To Date"
                    value={syncLedgerToDate}
                    onChange={(e) => setSyncLedgerToDate(e.target.value)}
                    className="font-mono font-bold text-slate-900 text-xs bg-transparent focus:outline-none cursor-pointer"
                  />
                </label>

                {(syncLedgerFromDate || syncLedgerToDate) && (
                  <button
                    type="button"
                    data-testid="sync-ledger-clear-dates-btn"
                    onClick={() => {
                      setSyncLedgerFromDate('');
                      setSyncLedgerToDate('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer transition"
                    title="Clear From/To Date filter"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Clear Dates</span>
                  </button>
                )}

                {/* Sort Direction Toggle */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-300 shadow-xs">
                  <button
                    type="button"
                    aria-pressed={syncLedgerSortDirection === 'asc'}
                    onClick={() => setSyncLedgerSortDirection('asc')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer whitespace-nowrap ${
                      syncLedgerSortDirection === 'asc'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Chronological Ascending Order (Oldest First - Spreadsheet Formula Order)"
                  >
                    Oldest First (Asc)
                  </button>
                  <button
                    type="button"
                    aria-pressed={syncLedgerSortDirection === 'desc'}
                    onClick={() => setSyncLedgerSortDirection('desc')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer whitespace-nowrap ${
                      syncLedgerSortDirection === 'desc'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Newest First (Desc)"
                  >
                    Newest First (Desc)
                  </button>
                </div>

                {/* Export PDF Button */}
                <button
                  type="button"
                  data-testid="sync-ledger-export-pdf-btn"
                  onClick={handleExportSyncLedgerPdf}
                  disabled={isExportingSyncLedgerPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00897b] hover:bg-[#00796b] disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wide shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  title="Export Supplier Account Reconciliation Ledger as official A4 PDF"
                >
                  {isExportingSyncLedgerPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{isExportingSyncLedgerPdf ? 'Exporting...' : 'Export PDF'}</span>
                </button>
              </div>
            </div>

            {isSyncLedgerExpanded && (
              <div>
                {/* Bulk Selection Action Bar for Supplier Reconciliation Ledger */}
                {selectedLedgerRowIds.length > 0 && (
                  <div
                    data-testid="reconciliation-ledger-bulk-bar"
                    className="mb-2 px-3.5 py-2 rounded-lg bg-[#273E56] text-white flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="reconciliation-selected-count"
                        className="px-2.5 py-1 rounded bg-[#1D6CE0] text-white font-mono font-black text-xs"
                      >
                        {selectedLedgerRowIds.length} Selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedLedgerRowIds([])}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-[#1F3349] px-2.5 py-1 rounded-lg border border-[#3B5572]">
                        <span className="text-[11px] font-bold uppercase text-[#93C5FD]">
                          Status:
                        </span>
                        <select
                          data-testid="reconciliation-bulk-status-select"
                          aria-label="Batch status for selected reconciliation rows"
                          value={ledgerTargetStatus}
                          onChange={(e) => setLedgerTargetStatus(e.target.value)}
                          className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                        >
                          {BATCH_STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st} className="text-slate-900">
                              {st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          data-testid="reconciliation-bulk-status-apply-btn"
                          onClick={() => handleLedgerBatchStatusUpdate()}
                          className="ml-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase cursor-pointer whitespace-nowrap"
                        >
                          Update Status
                        </button>
                      </div>

                      <button
                        type="button"
                        data-testid="reconciliation-bulk-delete-btn"
                        onClick={handleLedgerBatchDeleteSelected}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Delete Selected ({selectedLedgerRowIds.length})</span>
                      </button>
                    </div>
                  </div>
                )}

                {isSyncLedgerScrollCapped && (
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 px-1">
                    <span>
                      Viewport: <strong>{MAX_VISIBLE_TABLE_ROWS} Rows</strong> visible ({syncSupplierLedgerRows.length} total rows — scroll vertically to view more)
                    </span>
                  </div>
                )}
                <ColumnReorderToolbar
                  tableId="supplier_reconciliation"
                  isCustomized={reconciliationColOrder.isCustomized}
                  onReset={reconciliationColOrder.resetOrder}
                  className="mb-1.5"
                />
                <div
                  ref={syncLedgerScrollRef}
                  data-testid="supplier-reconciliation-scroll-box"
                  data-row-scroll-managed="true"
                  data-visible-row-limit={MAX_VISIBLE_TABLE_ROWS}
                  style={syncLedgerScrollMaxHeight ? { maxHeight: `${syncLedgerScrollMaxHeight}px` } : undefined}
                  className="overflow-auto border border-slate-200 rounded-lg bg-white shadow-xs print:!max-h-none print:!overflow-visible"
                >
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead className="sticky top-0 z-10 bg-[#273E56] text-white font-bold uppercase text-[11px] tracking-wider border-b border-[#1F3349]">
                    <tr>
                      <th className="px-2 py-2 border-r border-[#3B5572] w-8 text-center">
                        <input
                          ref={ledgerHeaderCheckboxRef}
                          type="checkbox"
                          data-testid="select-all-reconciliation-checkbox"
                          aria-label="Select all reconciliation ledger rows"
                          checked={ledgerSelectionState.allSelected}
                          onChange={() => handleSelectAllLedgerRows(visibleLedgerRowIds)}
                          className="cursor-pointer accent-[#1D6CE0]"
                        />
                      </th>
                      <th className="px-2 py-2 border-r border-[#3B5572] w-12 text-center">SL #</th>
                      {reconciliationColOrder.columnOrder.map((colId) => {
                        const dragClass = reconciliationColOrder.getHeaderDragClassName(colId);
                        switch (colId) {
                          case 'date':
                            return (
                              <th
                                key="date"
                                {...reconciliationColOrder.getHeaderDragProps('date', 'DATE')}
                                className={`px-3 py-2 border-r border-[#3B5572] w-32 text-center ${dragClass}`}
                              >
                                <span className="inline-flex items-center justify-center gap-1">
                                  <ColumnDragGrip />
                                  <span>DATE</span>
                                </span>
                              </th>
                            );
                          case 'supplierName':
                            return (
                              <th
                                key="supplierName"
                                {...reconciliationColOrder.getHeaderDragProps('supplierName', 'SUPPLIER NAME')}
                                className={`px-3 py-2 border-r border-[#3B5572] min-w-[160px] ${dragClass}`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <ColumnDragGrip />
                                  <span>SUPPLIER NAME</span>
                                </span>
                              </th>
                            );
                          case 'debitAmount':
                            return (
                              <th
                                key="debitAmount"
                                {...reconciliationColOrder.getHeaderDragProps('debitAmount', 'DEBIT AMOUNT')}
                                className={`px-3 py-2 border-r border-[#3B5572] text-right w-36 ${dragClass}`}
                              >
                                <span className="inline-flex items-center justify-end gap-1">
                                  <ColumnDragGrip />
                                  <span>DEBIT AMOUNT</span>
                                </span>
                              </th>
                            );
                          case 'creditAmount':
                            return (
                              <th
                                key="creditAmount"
                                {...reconciliationColOrder.getHeaderDragProps('creditAmount', 'CREDIT AMOUNT')}
                                className={`px-3 py-2 border-r border-[#3B5572] text-right w-36 ${dragClass}`}
                              >
                                <span className="inline-flex items-center justify-end gap-1">
                                  <ColumnDragGrip />
                                  <span>CREDIT AMOUNT</span>
                                </span>
                              </th>
                            );
                          case 'balance':
                            return (
                              <th
                                key="balance"
                                {...reconciliationColOrder.getHeaderDragProps('balance', 'BALANCE')}
                                className={`px-3 py-2 border-r border-[#3B5572] text-right w-40 bg-[#1F3349] ${dragClass}`}
                              >
                                <span className="inline-flex items-center justify-end gap-1">
                                  <ColumnDragGrip />
                                  <span>BALANCE</span>
                                </span>
                              </th>
                            );
                          case 'status':
                            return (
                              <th
                                key="status"
                                {...reconciliationColOrder.getHeaderDragProps('status', 'STATUS')}
                                className={`px-2.5 py-2 border-r border-[#3B5572] text-center w-24 ${dragClass}`}
                              >
                                <span className="inline-flex items-center justify-center gap-1">
                                  <ColumnDragGrip />
                                  <span>STATUS</span>
                                </span>
                              </th>
                            );
                          default:
                            return null;
                        }
                      })}
                      <th className="px-2.5 py-2 text-center w-24">EDIT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {syncSupplierLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic bg-slate-50 font-sans">
                          No purchase bills or supplier payment vouchers found for the selected supplier.
                        </td>
                      </tr>
                    ) : (
                      syncSupplierLedgerRows.map((row, idx) => {
                        const isEven = idx % 2 === 1;
                        const isRowSelected = selectedLedgerRowIds.includes(row.id);
                        return (
                          <tr
                            key={row.id}
                            data-testid={`reconciliation-row-${row.id}`}
                            className={`transition-colors ${
                              isRowSelected
                                ? 'bg-blue-100/85 hover:bg-blue-100'
                                : isEven
                                ? 'bg-slate-50/70 hover:bg-blue-50/60'
                                : 'bg-white hover:bg-blue-50/60'
                            }`}
                          >
                            <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap">
                              <input
                                type="checkbox"
                                data-testid={`select-reconciliation-row-${row.id}`}
                                aria-label={`Select reconciliation row ${row.invoiceNumber}`}
                                checked={isRowSelected}
                                onChange={() => toggleSelectLedgerRow(row.id)}
                                className="cursor-pointer accent-[#1D6CE0]"
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap">
                              <span className="zsb-sl-badge">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                            </td>
                            {reconciliationColOrder.columnOrder.map((colId) => {
                              switch (colId) {
                                case 'date':
                                  return (
                                    <td key="date" className="px-3 py-2 border-r border-slate-200 text-center font-bold text-slate-700 whitespace-nowrap">
                                      {formatDateImageStyle(row.date)}
                                    </td>
                                  );
                                case 'supplierName':
                                  return (
                                    <td key="supplierName" className="px-3 py-2 border-r border-slate-200 font-sans font-bold text-slate-900 whitespace-nowrap">
                                      {row.supplierName}
                                    </td>
                                  );
                                case 'debitAmount':
                                  return (
                                    <td key="debitAmount" className="px-3 py-2 border-r border-slate-200 text-right font-bold text-slate-900 whitespace-nowrap">
                                      {row.debitAmount !== 0 ? formatCurrency(row.debitAmount, '') : ''}
                                    </td>
                                  );
                                case 'creditAmount':
                                  return (
                                    <td key="creditAmount" className="px-3 py-2 border-r border-slate-200 text-right font-bold text-slate-900 whitespace-nowrap">
                                      {row.creditAmount !== 0 ? formatCurrency(row.creditAmount, '') : ''}
                                    </td>
                                  );
                                case 'balance':
                                  return (
                                    <td key="balance" className="px-3 py-2 border-r border-slate-200 text-right font-black text-slate-950 bg-blue-50/40 whitespace-nowrap">
                                      {formatCurrency(row.balance, '')}
                                    </td>
                                  );
                                case 'status':
                                  return (
                                    <td key="status" className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap font-sans">
                                      {renderStatusBadge(row.status, `reconciliation-status-${row.id}`)}
                                    </td>
                                  );
                                default:
                                  return null;
                              }
                            })}
                            <td className="px-2 py-2 text-center whitespace-nowrap font-sans">
                              <button
                                type="button"
                                data-testid={`edit-reconciliation-row-${row.id}`}
                                aria-label={`Edit reconciliation row ${row.invoiceNumber} ${row.supplierName}`}
                                disabled={!canEditDbRecords}
                                onClick={() => handleOpenReconciliationRowEdit(row)}
                                title={
                                  canEditDbRecords
                                    ? `Edit ${row.invoiceNumber} (${row.supplierName})`
                                    : 'Read-only role: editing disabled'
                                }
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-[10px] font-black uppercase tracking-wide transition cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>EDIT</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {syncSupplierLedgerRows.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900 text-xs">
                      <tr>
                        <td colSpan={2} className="px-2 py-2 border-r border-slate-300 uppercase text-center font-sans font-black text-[10px] whitespace-nowrap">
                          TOTALS ({syncSupplierLedgerRows.length})
                        </td>
                        {reconciliationColOrder.columnOrder.map((colId) => {
                          switch (colId) {
                            case 'debitAmount':
                              return (
                                <td key="debitAmount" className="px-3 py-2 border-r border-slate-300 text-right font-black text-slate-950 whitespace-nowrap">
                                  {formatCurrency(syncSupplierLedgerTotals.totalDebit, '')}
                                </td>
                              );
                            case 'creditAmount':
                              return (
                                <td key="creditAmount" className="px-3 py-2 border-r border-slate-300 text-right font-black text-emerald-800 whitespace-nowrap">
                                  {formatCurrency(syncSupplierLedgerTotals.totalCredit, '')}
                                </td>
                              );
                            case 'balance':
                              return (
                                <td key="balance" className="px-3 py-2 border-r border-slate-300 text-right font-black text-blue-900 bg-blue-100/70 whitespace-nowrap">
                                  {formatCurrency(syncSupplierLedgerTotals.netEndingBalance, companyProfile.currency)}
                                </td>
                              );
                            default:
                              return <td key={colId} className="bg-slate-100 border-r border-slate-300"></td>;
                          }
                        })}
                        <td className="bg-slate-100"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                </div>
              </div>
            )}
          </div>
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
            data-testid="db-general-search-input"
            placeholder={
              activeDbType === 'payment'
                ? 'Search payments by supplier name, reference ID, or remarks...'
                : `Search ${activeDbType} records by doc no, party, or mark...`
            }
            value={activeDbType === 'payment' ? (paymentSearchQuery || searchTerm) : searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (activeDbType === 'payment') {
                setPaymentSearchQuery(e.target.value);
              }
            }}
            className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
          />
          {(activeDbType === 'payment' ? (paymentSearchQuery || searchTerm) : searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPaymentSearchQuery('');
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-[#00897b] hover:bg-[#00796b] text-white cursor-pointer"
            title={`Export current filtered ${activeDbType} view as Excel-compatible CSV`}
          >
            <Download className="w-4 h-4 text-[#80cbc4]" />
            <span>EXPORT CSV ({currentFilteredCount})</span>
          </button>

          {/* Export Packing DB as A4 Company-Pad PDF Button */}
          {activeDbType === 'packing' && (
            <button
              type="button"
              data-testid="database-export-pdf-btn"
              onClick={handleExportPackingPdf}
              disabled={sortedPackings.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-rose-700 hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white cursor-pointer"
              title="Export current filtered Packing DB ledger as official A4 Company-Pad PDF"
            >
              <FileDown className="w-4 h-4 text-rose-100" />
              <span>EXPORT PDF ({sortedPackings.length})</span>
            </button>
          )}

          {/* Batch Update Sidebar Toggle Button */}
          <button
            type="button"
            data-testid="database-batch-update-btn"
            onClick={() => setIsBatchSidebarOpen((prev) => !prev)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition cursor-pointer ${
              isBatchSidebarOpen
                ? 'bg-[#00897b] text-white ring-2 ring-[#5eead4]'
                : selectedIds.length > 0
                ? 'bg-[#1877d2] hover:bg-[#1465b5] text-white'
                : 'bg-[#273E56] hover:bg-[#1c2a33] text-[#5eead4]'
            }`}
            title="Open Batch Update secondary sidebar to bulk edit multiple selected rows at once"
          >
            <Layers className="w-4 h-4" />
            <span>BATCH UPDATE ({selectedIds.length})</span>
          </button>

          {/* Update All Button */}
          <button
            type="button"
            data-testid="database-update-all-btn"
            onClick={() => {
              const allIds =
                activeDbType === 'purchase'
                  ? sortedPurchases.map((p) => p.id)
                  : activeDbType === 'packing'
                  ? sortedPackings.map((p) => p.id)
                  : sortedPayments.map((p) => p.id);
              setSelectedIds(allIds);
              setIsBatchSidebarOpen(true);
            }}
            disabled={currentFilteredCount === 0}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition whitespace-nowrap ${
              currentFilteredCount > 0
                ? 'bg-[#089bc4] hover:bg-[#0782a5] text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title={`Select all ${currentFilteredCount} records and open batch update panel`}
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>UPDATE ALL ({currentFilteredCount})</span>
          </button>

          {/* Batch Print Button */}
          <button
            type="button"
            data-testid="database-batch-print-btn"
            onClick={handleBatchPrint}
            disabled={selectedIds.length === 0}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition ${
              selectedIds.length > 0
                ? 'bg-[#273E56] hover:bg-[#1c2a33] text-white cursor-pointer'
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
                  ? 'bg-[#00897b] hover:bg-[#00796b] text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              } disabled:opacity-50`}
              title="Batch export multiple selected payment slips as a single combined PDF document"
            >
              {isExportingBatchSlips ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>EXPORTING {selectedIds.length} SLIPS...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-[#80cbc4]" />
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
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition bg-[#1877d2] hover:bg-[#1465b5] text-white cursor-pointer"
            title="Create or Restore Local JSON Database Snapshots"
          >
            <Archive className="w-3.5 h-3.5 text-white" />
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
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-300 text-xs">
            <button
              type="button"
              data-testid="validation-filter-all-btn"
              aria-pressed={validationFilter === 'all'}
              onClick={() => setValidationFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                validationFilter === 'all'
                  ? 'bg-[#273E56] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              All Rows ({totalUnfilteredCount})
            </button>
            <button
              type="button"
              data-testid="validation-filter-invalid-btn"
              aria-pressed={validationFilter === 'invalid_only'}
              onClick={() => setValidationFilter('invalid_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
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

      {/* Bulk Selection & Batch Operations Toolbar (Status Updates & Deletion) */}
      <div
        data-testid="database-bulk-action-bar"
        className={`rounded-xl px-4 py-3 border-2 shadow-sm flex flex-wrap items-center justify-between gap-3 transition-all ${
          selectedIds.length > 0
            ? 'bg-[#273E56] border-[#1D6CE0] text-white'
            : 'bg-white border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            type="button"
            data-testid="bulk-bar-toggle-select-all-btn"
            onClick={() => handleSelectAll(activeVisibleIds)}
            disabled={activeVisibleIds.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              selectedIds.length > 0
                ? 'bg-[#1F3349] hover:bg-[#152536] text-[#93C5FD] border border-[#3B5572]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {activeSelectionState.allSelected ? (
              <CheckSquare className="w-4 h-4 text-[#60A5FA]" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>
              {activeSelectionState.allSelected
                ? `Deselect All (${activeVisibleIds.length})`
                : `Select All (${activeVisibleIds.length})`}
            </span>
          </button>

          <span
            data-testid="bulk-selected-count-badge"
            className={`px-2.5 py-1 rounded-md font-mono font-black text-xs ${
              selectedIds.length > 0
                ? 'bg-[#1D6CE0] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {selectedIds.length} Row{selectedIds.length === 1 ? '' : 's'} Selected
          </span>

          {selectedIds.length > 0 && (
            <button
              type="button"
              data-testid="bulk-clear-selection-btn"
              onClick={() => setSelectedIds([])}
              className="text-xs font-semibold text-[#93C5FD] hover:text-white underline cursor-pointer"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Batch Operations: Status Update & Batch Delete */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Batch Status Selector + Apply Button */}
          <div
            className={`flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              selectedIds.length > 0
                ? 'bg-[#1F3349] border-[#3B5572]'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <span
              className={`text-[11px] font-bold uppercase ${
                selectedIds.length > 0 ? 'text-[#93C5FD]' : 'text-slate-500'
              }`}
            >
              Batch Status:
            </span>
            <select
              data-testid="bulk-status-select"
              aria-label="Batch status for selected rows"
              value={bulkTargetStatus}
              onChange={(e) => setBulkTargetStatus(e.target.value)}
              className={`font-bold text-xs px-2 py-1 rounded border focus:outline-none cursor-pointer ${
                selectedIds.length > 0
                  ? 'bg-[#273E56] text-white border-[#3B5572]'
                  : 'bg-white text-slate-800 border-slate-300'
              }`}
            >
              {BATCH_STATUS_OPTIONS.map((statusOpt) => (
                <option key={statusOpt} value={statusOpt} className="text-slate-900 bg-white">
                  {statusOpt}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="bulk-status-update-btn"
              disabled={selectedIds.length === 0}
              onClick={() => handleBatchStatusUpdate()}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-black uppercase tracking-wide transition ${
                selectedIds.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Update Status ({selectedIds.length})</span>
            </button>
          </div>

          {/* Quick Status Action Buttons */}
          <div className="hidden xl:flex items-center gap-1">
            <button
              type="button"
              data-testid="bulk-quick-mark-paid-btn"
              disabled={selectedIds.length === 0}
              onClick={() => handleBatchStatusUpdate('PAID')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase transition ${
                selectedIds.length > 0
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="Mark all selected rows as PAID"
            >
              Mark PAID
            </button>
            <button
              type="button"
              data-testid="bulk-quick-mark-unpaid-btn"
              disabled={selectedIds.length === 0}
              onClick={() => handleBatchStatusUpdate('UNPAID')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase transition ${
                selectedIds.length > 0
                  ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="Mark all selected rows as UNPAID"
            >
              Mark UNPAID
            </button>
          </div>

          {/* Batch Delete Selected Rows Button */}
          <button
            type="button"
            data-testid="bulk-delete-selected-btn"
            aria-label={`Delete ${selectedIds.length} selected rows`}
            disabled={selectedIds.length === 0}
            onClick={handleBatchDeleteSelected}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide shadow-sm transition ${
              selectedIds.length > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Batch delete all currently selected rows"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Selected ({selectedIds.length})</span>
          </button>
        </div>
      </div>

      {/* Main Database Content + Secondary Batch Update Sidebar */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
      {/* Database Tables */}
      <div className="flex-1 min-w-0 w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Active Sort Banner Indicator */}
        {activeSortConfig.column && (
          <div
            data-testid="database-active-sort-banner"
            className="px-3.5 py-1.5 bg-[#273E56] text-white text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#1F3349]"
          >
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#93C5FD]">
                Sorted View:
              </span>
              <span className="text-slate-200 font-medium">
                <strong className="text-white font-bold">{getColumnHeaderTitle(activeSortConfig.column)}</strong> (
                <span className="text-[#BFDBFE] font-mono font-bold">
                  {activeSortConfig.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
                </span>
                )
              </span>
            </div>
            <button
              type="button"
              data-testid="database-reset-sort-btn"
              onClick={handleResetSort}
              className="text-[11px] text-[#93C5FD] hover:text-white underline font-semibold cursor-pointer"
            >
              Reset Sort
            </button>
          </div>
        )}

        {activeDbType === 'purchase' && (
          <div className="p-2.5 bg-[#EDF2F7]/60">
            {isPurchaseDbScrollCapped && (
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 px-1">
                <span>
                  Viewport: <strong>{MAX_VISIBLE_TABLE_ROWS} Rows</strong> visible ({sortedPurchases.length} total rows — scroll vertically to view more)
                </span>
              </div>
            )}
            <ColumnReorderToolbar
              tableId="purchase_db"
              isCustomized={purchaseDbColOrder.isCustomized}
              onReset={purchaseDbColOrder.resetOrder}
              className="mb-1.5"
            />
            <div
              ref={purchaseDbScrollRef}
              data-testid="purchase-db-scroll-box"
              data-row-scroll-managed="true"
              data-visible-row-limit={MAX_VISIBLE_TABLE_ROWS}
              style={purchaseDbScrollMaxHeight ? { maxHeight: `${purchaseDbScrollMaxHeight}px` } : undefined}
              className="overflow-auto border border-[#CBD8E6] rounded-lg bg-white print:!max-h-none print:!overflow-visible"
            >
            <table data-testid="purchase-db-table" className="w-full text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-[#273E56] text-white font-bold uppercase text-[10px] tracking-tight border-b border-[#1F3349]">
                <tr>
                  <th className="px-1.5 py-2 w-7 text-center">
                    <input
                      ref={purchaseHeaderCheckboxRef}
                      type="checkbox"
                      data-testid="select-all-purchase-checkbox"
                      aria-label="Select all purchase rows"
                      checked={activeSelectionState.allSelected}
                      onChange={() =>
                        handleSelectAll(sortedPurchases.map((p) => p.id))
                      }
                      className="cursor-pointer accent-[#1D6CE0]"
                    />
                  </th>
                  <th className="px-1.5 py-2 w-10 text-center whitespace-nowrap">SL #</th>
                  {purchaseDbColOrder.columnOrder.map((colId) => {
                    switch (colId) {
                      case 'invoiceNumber':
                        return renderSortableHeader('invoiceNumber', 'INVOICE NO', 'left', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'date':
                        return renderSortableHeader('date', 'DATE', 'left', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'description':
                        return renderSortableHeader('description', 'SUPPLIER / DESCRIPTION', 'left', '', purchaseDbColOrder);
                      case 'contactNumber':
                        return renderSortableHeader('contactNumber', 'CONTACT', 'left', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'items':
                        return renderSortableHeader('items', 'ITEMS', 'center', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'totalQty':
                        return renderSortableHeader('totalQty', 'TOTAL QTY', 'right', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'totalAmount':
                        return renderSortableHeader('totalAmount', 'TOTAL AMOUNT', 'right', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'paidAmount':
                        return renderSortableHeader('paidAmount', 'PAID AMOUNT', 'right', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'balance':
                        return renderSortableHeader('balance', 'BALANCE', 'right', 'whitespace-nowrap', purchaseDbColOrder);
                      case 'status':
                        return renderSortableHeader('status', 'STATUS', 'center', 'whitespace-nowrap', purchaseDbColOrder);
                      default:
                        return null;
                    }
                  })}
                  <th className="px-1.5 py-2 text-center whitespace-nowrap">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {sortedPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400">
                      No purchase records found.
                    </td>
                  </tr>
                ) : (
                  sortedPurchases.map((p, idx) => {
                    const isSelected = selectedIds.includes(p.id);
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
                            data-testid={`select-purchase-row-${p.id}`}
                            aria-label={`Select purchase invoice ${p.invoiceNumber}`}
                            checked={isSelected}
                            onChange={() => toggleSelectOne(p.id)}
                            className="cursor-pointer accent-[#1D6CE0]"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                          <span className="zsb-sl-badge">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>
                        {purchaseDbColOrder.columnOrder.map((colId) => {
                          switch (colId) {
                            case 'invoiceNumber':
                              return (
                                <DatabaseValidatedCell
                                  key="invoiceNumber"
                                  recordId={p.id}
                                  fieldKey="invoiceNumber"
                                  rawValue={p.invoiceNumber}
                                  displayNode={
                                    <div className="flex items-center gap-1">
                                      <span>{p.invoiceNumber}</span>
                                      {p.calculationPending && (
                                        <span
                                          data-testid={`pending-calc-badge-${p.id}`}
                                          className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black uppercase"
                                        >
                                          Pending Calc
                                        </span>
                                      )}
                                    </div>
                                  }
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
                              );
                            case 'date':
                              return (
                                <DatabaseValidatedCell
                                  key="date"
                                  recordId={p.id}
                                  fieldKey="date"
                                  rawValue={p.rawValues?.date ?? p.date}
                                  displayNode={p.rawValues?.date || formatDate(p.date) || '(Blank)'}
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
                              );
                            case 'description':
                              return (
                                <DatabaseValidatedCell
                                  key="description"
                                  recordId={p.id}
                                  fieldKey="description"
                                  rawValue={p.rawValues?.description ?? p.description}
                                  displayNode={p.rawValues?.description || p.description || '(Blank)'}
                                  validation={
                                    rowValidation.description ||
                                    validateDatabaseCellValue('purchase', 'description', p.description || '-')
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
                              );
                            case 'contactNumber':
                              return (
                                <DatabaseValidatedCell
                                  key="contactNumber"
                                  recordId={p.id}
                                  fieldKey="contactNumber"
                                  rawValue={p.rawValues?.contactNumber ?? p.contactNumber}
                                  displayNode={p.rawValues?.contactNumber || p.contactNumber || '-'}
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
                              );
                            case 'items':
                              return (
                                <td key="items" className="px-1.5 py-1.5 text-center whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                                    {p.items?.length || 0} Lines
                                  </span>
                                </td>
                              );
                            case 'totalQty':
                              return (
                                <DatabaseValidatedCell
                                  key="totalQty"
                                  recordId={p.id}
                                  fieldKey="totalQty"
                                  rawValue={p.rawValues?.totalQty ?? p.totalQty}
                                  displayNode={p.rawValues?.totalQty ? `${p.rawValues.totalQty}` : p.totalQty}
                                  isPendingCalc={Boolean(p.pendingFields?.includes('totalQty'))}
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
                              );
                            case 'totalAmount':
                              return (
                                <DatabaseValidatedCell
                                  key="totalAmount"
                                  recordId={p.id}
                                  fieldKey="totalAmount"
                                  rawValue={p.rawValues?.totalAmount ?? p.totalAmount}
                                  displayNode={
                                    p.rawValues?.totalAmount ||
                                    (p.calculationPending ? 'Pending Calc' : formatCurrency(p.totalAmount, companyProfile.currency))
                                  }
                                  isPendingCalc={Boolean(p.calculationPending)}
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
                              );
                            case 'paidAmount':
                              return (
                                <DatabaseValidatedCell
                                  key="paidAmount"
                                  recordId={p.id}
                                  fieldKey="paidAmount"
                                  rawValue={p.rawValues?.paidAmount ?? p.paidAmount}
                                  displayNode={
                                    p.rawValues?.paidAmount || formatCurrency(p.paidAmount, companyProfile.currency)
                                  }
                                  isPendingCalc={Boolean(p.pendingFields?.includes('paidAmount'))}
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
                              );
                            case 'balance':
                              return (
                                <DatabaseValidatedCell
                                  key="balance"
                                  recordId={p.id}
                                  fieldKey="balance"
                                  rawValue={p.balance}
                                  displayNode={
                                    p.calculationPending
                                      ? 'Pending Calc'
                                      : formatCurrency(p.balance, companyProfile.currency)
                                  }
                                  isPendingCalc={Boolean(p.calculationPending)}
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
                              );
                            case 'status':
                              return (
                                <td key="status" className="px-1.5 py-1.5 text-center whitespace-nowrap">
                                  {renderStatusBadge(
                                    resolvePurchaseRecordStatus(p),
                                    `purchase-status-badge-${p.id}`
                                  )}
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
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
                              data-testid={`delete-purchase-btn-${p.id}`}
                              aria-label={`Delete purchase invoice ${p.invoiceNumber}`}
                              onClick={() => deletePurchase(p.id)}
                              className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title={`Delete purchase invoice ${p.invoiceNumber} (Super Admin Required)`}
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

        {activeDbType === 'packing' && (
          <div>
            <div className="px-3 py-2.5 bg-white border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5 text-xs text-black">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-bold text-black">
                  Packing List Ledger — Live BDT Conversion
                </div>
                {packingPartySearch.trim() !== '' && (
                  <span
                    data-testid="packing-shipper-exporter-count"
                    className="inline-flex items-center px-2 py-0.5 rounded bg-sky-50 border border-sky-300 text-[11px] font-mono font-bold text-sky-900"
                  >
                    {sortedPackings.length} of {packings.length} row{packings.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {/* Real-Time Shipper / Exporter Search Bar */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end min-w-[260px]">
                <div className="relative flex items-center w-full sm:w-80">
                  <Search
                    className="w-3.5 h-3.5 text-[#0D9488] absolute left-2.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    data-testid="packing-shipper-exporter-search"
                    aria-label="Filter Packing List rows in real-time by Shipper or Exporter name"
                    placeholder="Search by Shipper or Exporter name..."
                    value={packingPartySearch}
                    onChange={(e) => setPackingPartySearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-[#0D9488] transition"
                  />
                  {packingPartySearch && (
                    <button
                      type="button"
                      data-testid="packing-shipper-exporter-clear-btn"
                      aria-label="Clear Shipper or Exporter search"
                      onClick={() => setPackingPartySearch('')}
                      className="absolute right-1.5 p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                      title="Clear Shipper / Exporter search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="packing-ledger-export-csv-btn"
                  aria-label={`Export currently filtered Packing List view as CSV (${sortedPackings.length} rows)`}
                  onClick={handleExportCSV}
                  disabled={sortedPackings.length === 0}
                  title={
                    sortedPackings.length === 0
                      ? 'No filtered Packing List rows available to export'
                      : `Download ${sortedPackings.length} filtered Packing List row${sortedPackings.length === 1 ? '' : 's'} as CSV for offline analysis`
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed text-white border border-[#0F766E] text-xs font-bold shadow-xs transition whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Export CSV ({sortedPackings.length})</span>
                </button>
                <button
                  type="button"
                  data-testid="packing-ledger-export-pdf-btn"
                  aria-label={`Export currently filtered Packing List view as A4 PDF (${sortedPackings.length} rows)`}
                  onClick={handleExportPackingPdf}
                  disabled={sortedPackings.length === 0}
                  title={
                    sortedPackings.length === 0
                      ? 'No filtered Packing List rows available to export as PDF'
                      : `Preview & download ${sortedPackings.length} filtered Packing List row${sortedPackings.length === 1 ? '' : 's'} as an A4 Company-Pad PDF`
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed text-white border border-rose-800 text-xs font-bold shadow-xs transition whitespace-nowrap cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Export PDF ({sortedPackings.length})</span>
                </button>
                <div className="font-mono text-[11px] font-semibold text-black bg-white px-2.5 py-1 rounded border border-slate-300 whitespace-nowrap">
                  Formula: <strong>Total Value (RMB) × RMB Rate = Total Amount (BDT)</strong>
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-white">
              {isPackingDbScrollCapped && (
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono text-black px-1">
                  <span>
                    Viewport: <strong>{MAX_VISIBLE_TABLE_ROWS} Rows</strong> visible ({sortedPackings.length} total rows — scroll vertically to view more)
                  </span>
                </div>
              )}
              <ColumnReorderToolbar
                tableId="packing_db"
                isCustomized={packingDbColOrder.isCustomized}
                onReset={packingDbColOrder.resetOrder}
                className="mb-1.5"
              />
              <div
                ref={packingDbScrollRef}
                data-testid="packing-db-scroll-box"
                data-row-scroll-managed="true"
                data-visible-row-limit={MAX_VISIBLE_TABLE_ROWS}
                style={packingDbScrollMaxHeight ? { maxHeight: `${packingDbScrollMaxHeight}px` } : undefined}
                className="overflow-auto border border-slate-300 rounded-lg bg-white text-black print:!max-h-none print:!overflow-visible"
              >
              <table
                data-testid="packing-ledger-live-bdt-table"
                className="w-full text-left text-[11px] bg-white text-black packing-ledger-plain-table"
              >
                <thead className="sticky top-0 z-10 bg-[#273E56] text-white font-bold uppercase text-[10px] tracking-tight border-b border-[#1F3349]">
                  <tr className="bg-[#273E56] text-white">
                    <th className="px-1 py-2 w-6 text-center bg-[#273E56] text-white">
                      <input
                        ref={packingHeaderCheckboxRef}
                        type="checkbox"
                        data-testid="select-all-packing-checkbox"
                        aria-label="Select all packing rows"
                        checked={activeSelectionState.allSelected}
                        onChange={() =>
                          handleSelectAll(sortedPackings.map((p) => p.id))
                        }
                        className="cursor-pointer accent-[#0D9488]"
                      />
                    </th>
                    <th
                      scope="col"
                      data-testid="packing-ledger-sno-header"
                      aria-sort={
                        activeSortConfig.column === 'serialNumber'
                          ? activeSortConfig.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      onClick={() => handleHeaderSortClick('serialNumber')}
                      title="Persistent auto-incrementing row index (click to sort by S. No.)"
                      className="px-1.5 py-2 w-14 text-center whitespace-nowrap bg-[#273E56] text-white select-none cursor-pointer hover:bg-black/25 transition-colors group"
                    >
                      <div className="inline-flex items-center justify-center gap-1 w-full">
                        <span
                          className={`font-bold normal-case tracking-tight whitespace-nowrap transition-colors ${
                            activeSortConfig.column === 'serialNumber'
                              ? 'text-amber-200 font-black underline underline-offset-2'
                              : 'group-hover:text-amber-100'
                          }`}
                        >
                          S. No.
                        </span>
                        <span className="inline-flex items-center shrink-0">
                          {activeSortConfig.column === 'serialNumber' ? (
                            activeSortConfig.direction === 'asc' ? (
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
                    {packingDbColOrder.columnOrder.map((colId) => {
                      switch (colId) {
                        case 'invoiceNumber':
                          return renderSortableHeader('invoiceNumber', 'PACKING NO', 'left', 'whitespace-nowrap bg-[#273E56] text-white', packingDbColOrder);
                        case 'date':
                          return renderSortableHeader('date', 'DATE', 'left', 'whitespace-nowrap bg-[#273E56] text-white', packingDbColOrder);
                        case 'shippingMark':
                          return renderSortableHeader('shippingMark', 'SHIPPING MARK', 'left', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'flight':
                          return renderSortableHeader('flight', 'FLIGHT', 'left', 'whitespace-nowrap bg-[#273E56] text-white', packingDbColOrder);
                        case 'destination':
                          return renderSortableHeader('destination', 'DESTINATION', 'left', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'shipper':
                          return renderSortableHeader('shipper', 'SHIPPER', 'left', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'documentsHolder':
                          return (
                            <th
                              key="documentsHolder"
                              {...packingDbColOrder.getHeaderDragProps('documentsHolder', 'DOCUMENTS HOLDER')}
                              className={`px-2 py-2 text-left whitespace-nowrap bg-[#273E56] text-white ${packingDbColOrder.getHeaderDragClassName('documentsHolder')}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                <ColumnDragGrip />
                                <span>DOCUMENTS HOLDER</span>
                              </span>
                            </th>
                          );
                        case 'items':
                          return renderSortableHeader('items', 'ITEMS', 'left', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'totalBox':
                          return renderSortableHeader('totalBox', 'TOTAL BOX', 'right', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'totalWeight':
                          return renderSortableHeader('totalWeight', 'TOTAL WEIGHT', 'right', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'totalAmount':
                          return renderSortableHeader('totalAmount', 'TOTAL VALUE', 'right', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'rmbRate':
                          return renderSortableHeader('rmbRate', 'RMB RATE', 'right', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'amountBDT':
                          return renderSortableHeader('amountBDT', 'TOTAL AMOUNT (BDT)', 'right', 'bg-[#273E56] text-white', packingDbColOrder);
                        case 'status':
                          return renderSortableHeader('status', 'STATUS', 'center', 'whitespace-nowrap bg-[#273E56] text-white', packingDbColOrder);
                        default:
                          return null;
                      }
                    })}
                    <th className="px-1 py-2 text-center whitespace-nowrap bg-[#273E56] text-white">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium bg-white text-black">
                  {sortedPackings.length === 0 ? (
                    <tr className="bg-white text-black">
                      <td colSpan={17} className="p-8 text-center text-black bg-white">
                        {packingPartySearch.trim() !== '' ? (
                          <div className="inline-flex flex-col items-center gap-2">
                            <span>
                              No Packing List rows match Shipper or Exporter{' '}
                              <strong>&ldquo;{packingPartySearch.trim()}&rdquo;</strong>.
                            </span>
                            <button
                              type="button"
                              data-testid="packing-shipper-exporter-empty-reset-btn"
                              onClick={() => setPackingPartySearch('')}
                              className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800 transition cursor-pointer"
                            >
                              Clear Filter
                            </button>
                          </div>
                        ) : (
                          'No packing list records found.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    sortedPackings.map((pkg) => {
                      const isSelected = selectedIds.includes(pkg.id);
                      const persistentSerialNo =
                        pkg.serialNumber ?? packingSerialNumberMap.get(pkg.id) ?? 0;
                      const computedAmountBDT = calculatePackingTotalAmountBDT(
                        pkg.totalAmount,
                        pkg.rmbRate
                      );
                      const rowValidation = validationSummary.resultsByRecordId[pkg.id] || {};
                      const rowDrafts = cellDraftsByDb.packing[pkg.id] || {};
                      return (
                      <tr
                        key={pkg.id}
                        data-testid={`packing-row-${pkg.id}`}
                        className="bg-white text-black"
                      >
                        <td className="px-1.5 py-1.5 text-center bg-white text-black">
                          <input
                            type="checkbox"
                            data-testid={`select-packing-row-${pkg.id}`}
                            aria-label={`Select packing list ${pkg.invoiceNumber}`}
                            checked={isSelected}
                            onChange={() => toggleSelectOne(pkg.id)}
                            className="cursor-pointer accent-black"
                          />
                        </td>
                        <td
                          data-testid={`packing-row-sno-${pkg.id}`}
                          className="px-1.5 py-1.5 text-center whitespace-nowrap bg-white text-black"
                        >
                          <span className="font-mono font-bold tabular-nums text-black">
                            {persistentSerialNo}
                          </span>
                        </td>
                        {packingDbColOrder.columnOrder.map((colId) => {
                          switch (colId) {
                            case 'invoiceNumber':
                              return (
                                <DatabaseValidatedCell
                                  key="invoiceNumber"
                                  recordId={pkg.id}
                                  fieldKey="invoiceNumber"
                                  rawValue={pkg.invoiceNumber}
                                  displayNode={
                                    <div className="flex items-center gap-1 text-black">
                                      <span>{pkg.invoiceNumber}</span>
                                      {pkg.calculationPending && (
                                        <span
                                          data-testid={`pending-calc-badge-${pkg.id}`}
                                          className="px-1.5 py-0.5 rounded bg-white text-black border border-slate-300 text-[9px] font-black uppercase"
                                        >
                                          Pending Calc
                                        </span>
                                      )}
                                    </div>
                                  }
                                  validation={
                                    rowValidation.invoiceNumber ||
                                    validateDatabaseCellValue('packing', 'invoiceNumber', pkg.invoiceNumber)
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'invoiceNumber'
                                  )}
                                  className="font-mono font-bold text-black bg-white whitespace-nowrap"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'date':
                              return (
                                <DatabaseValidatedCell
                                  key="date"
                                  recordId={pkg.id}
                                  fieldKey="packingDate"
                                  rawValue={pkg.rawValues?.packingDate ?? pkg.packingDate}
                                  displayNode={pkg.rawValues?.packingDate || formatDate(pkg.packingDate) || '(Blank)'}
                                  validation={
                                    rowValidation.packingDate ||
                                    validateDatabaseCellValue('packing', 'packingDate', pkg.packingDate)
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'packingDate'
                                  )}
                                  className="font-mono text-black bg-white whitespace-nowrap"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'shippingMark':
                              return (
                                <DatabaseValidatedCell
                                  key="shippingMark"
                                  recordId={pkg.id}
                                  fieldKey="shippingMark"
                                  rawValue={pkg.rawValues?.shippingMark ?? pkg.shippingMark}
                                  displayNode={pkg.rawValues?.shippingMark || pkg.shippingMark || '(Blank)'}
                                  validation={
                                    rowValidation.shippingMark ||
                                    validateDatabaseCellValue('packing', 'shippingMark', pkg.shippingMark || '-')
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'shippingMark'
                                  )}
                                  className="font-black text-black bg-white"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'flight':
                              return (
                                <DatabaseValidatedCell
                                  key="flight"
                                  recordId={pkg.id}
                                  fieldKey="flight"
                                  rawValue={pkg.rawValues?.flight ?? pkg.flight}
                                  displayNode={pkg.rawValues?.flight || pkg.flight || '(Blank)'}
                                  validation={
                                    rowValidation.flight ||
                                    validateDatabaseCellValue('packing', 'flight', pkg.flight || '-')
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'flight'
                                  )}
                                  className="font-mono text-black bg-white whitespace-nowrap"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'destination':
                              return (
                                <DatabaseValidatedCell
                                  key="destination"
                                  recordId={pkg.id}
                                  fieldKey="destination"
                                  rawValue={pkg.rawValues?.destination ?? pkg.destination}
                                  displayNode={pkg.rawValues?.destination || pkg.destination || '(Blank)'}
                                  validation={
                                    rowValidation.destination ||
                                    validateDatabaseCellValue('packing', 'destination', pkg.destination || '-')
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'destination'
                                  )}
                                  className="font-bold text-black bg-white"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'shipper':
                              return (
                                <DatabaseValidatedCell
                                  key="shipper"
                                  recordId={pkg.id}
                                  fieldKey="shipper"
                                  rawValue={pkg.rawValues?.shipper ?? pkg.shipper}
                                  displayNode={pkg.rawValues?.shipper || pkg.shipper || '(Blank)'}
                                  validation={
                                    rowValidation.shipper ||
                                    validateDatabaseCellValue('packing', 'shipper', pkg.shipper || '-')
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'shipper'
                                  )}
                                  className="font-bold text-black bg-white"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'documentsHolder':
                              return (
                                <td key="documentsHolder" className="px-2 py-1.5 font-semibold text-black bg-white whitespace-nowrap">
                                  {pkg.documentsHolder || '-'}
                                </td>
                              );
                            case 'items':
                              return (
                                <td
                                  key="items"
                                  className="px-1.5 py-1.5 font-mono text-[11px] text-black bg-white"
                                  data-testid={`packing-items-cell-${pkg.id}`}
                                >
                                  <div className="flex flex-wrap items-center gap-1 leading-tight text-black">
                                    <span className="px-1 py-0.5 rounded bg-white text-black border border-slate-300 font-bold text-[10px] whitespace-nowrap">
                                      {pkg.items?.length || 0} {(pkg.items?.length || 0) === 1 ? 'Item' : 'Items'}
                                    </span>
                                    <span className="font-bold text-black">
                                      {(pkg.items || []).map((it) => it.item).join(', ')}
                                    </span>
                                  </div>
                                </td>
                              );
                            case 'totalBox':
                              return (
                                <DatabaseValidatedCell
                                  key="totalBox"
                                  recordId={pkg.id}
                                  fieldKey="totalBox"
                                  rawValue={pkg.rawValues?.totalBox ?? pkg.totalBox}
                                  displayNode={pkg.rawValues?.totalBox || pkg.totalBox}
                                  isPendingCalc={Boolean(pkg.pendingFields?.includes('totalBox'))}
                                  align="right"
                                  validation={
                                    rowValidation.totalBox ||
                                    validateDatabaseCellValue('packing', 'totalBox', pkg.totalBox)
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'totalBox'
                                  )}
                                  className="font-mono text-black bg-white"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'totalWeight':
                              return (
                                <DatabaseValidatedCell
                                  key="totalWeight"
                                  recordId={pkg.id}
                                  fieldKey="totalWeight"
                                  rawValue={pkg.rawValues?.totalWeight ?? pkg.totalWeight}
                                  displayNode={pkg.rawValues?.totalWeight || `${pkg.totalWeight} KG`}
                                  isPendingCalc={Boolean(pkg.pendingFields?.includes('totalWeight'))}
                                  align="right"
                                  validation={
                                    rowValidation.totalWeight ||
                                    validateDatabaseCellValue('packing', 'totalWeight', pkg.totalWeight)
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'totalWeight'
                                  )}
                                  className="font-mono font-bold text-black bg-white"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'totalAmount':
                              return (
                                <DatabaseValidatedCell
                                  key="totalAmount"
                                  recordId={pkg.id}
                                  fieldKey="totalAmount"
                                  rawValue={pkg.rawValues?.totalAmount ?? pkg.totalAmount}
                                  displayNode={
                                    pkg.rawValues?.totalAmount ||
                                    (pkg.calculationPending ? 'Pending Calc' : formatCurrency(pkg.totalAmount, 'RMB'))
                                  }
                                  isPendingCalc={Boolean(pkg.calculationPending)}
                                  align="right"
                                  validation={
                                    rowValidation.totalAmount ||
                                    validateDatabaseCellValue('packing', 'totalAmount', pkg.totalAmount)
                                  }
                                  hasDraftOverride={Object.prototype.hasOwnProperty.call(
                                    rowDrafts,
                                    'totalAmount'
                                  )}
                                  className="font-mono font-bold text-black bg-white"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'rmbRate':
                              return (
                                <DatabaseValidatedCell
                                  key="rmbRate"
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
                                  className="font-mono font-bold text-black bg-white"
                                  onDraftChange={handleCellDraftChange}
                                  onCommitValid={handleCellCommitValid}
                                  onClearDraft={handleCellClearDraft}
                                />
                              );
                            case 'amountBDT':
                              return (
                                <td key="amountBDT" className="px-1.5 py-1.5 text-right font-mono font-black text-black bg-white whitespace-nowrap">
                                  {formatCurrency(computedAmountBDT, 'BDT')}
                                </td>
                              );
                            case 'status':
                              return (
                                <td key="status" className="px-1.5 py-1.5 text-center whitespace-nowrap bg-white text-black">
                                  {renderStatusBadge(
                                    resolvePackingRecordStatus(pkg),
                                    `packing-status-badge-${pkg.id}`
                                  )}
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                        <td className="px-1.5 py-1.5 text-center whitespace-nowrap bg-white text-black">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setEditingPackingId(pkg.id);
                                setActiveTab('packing_form');
                                showToast(`Loaded manifest ${pkg.invoiceNumber} for editing.`);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-black border border-slate-300 rounded transition flex items-center space-x-0.5 cursor-pointer"
                              title={`Edit Packing List ${pkg.invoiceNumber}`}
                            >
                              <Edit2 className="w-2.5 h-2.5 text-black" />
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
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-black border border-slate-300 rounded transition flex items-center space-x-0.5 cursor-pointer"
                              title="Print or Save PDF"
                            >
                              <Printer className="w-2.5 h-2.5 text-black" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              data-testid={`delete-packing-btn-${pkg.id}`}
                              aria-label={`Delete packing list ${pkg.invoiceNumber}`}
                              onClick={() => deletePacking(pkg.id)}
                              className="p-0.5 bg-white text-black border border-slate-300 rounded transition cursor-pointer"
                              title={`Delete packing list ${pkg.invoiceNumber} (Super Admin Required)`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-black" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredPackings.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-white text-black">
                  <tr className="bg-white text-black font-black border-t-2 border-slate-300 text-[11px]">
                    <td colSpan={2} className="px-1.5 py-2 text-center uppercase text-black bg-white text-[10px] whitespace-nowrap">
                      TOTALS
                    </td>
                    {packingDbColOrder.columnOrder.map((colId) => {
                      switch (colId) {
                        case 'totalBox':
                          return (
                            <td key="totalBox" className="px-1.5 py-2 text-right font-mono text-black bg-white whitespace-nowrap">
                              {filteredPackings.reduce((acc, p) => acc + (Number(p.totalBox) || 0), 0)}
                            </td>
                          );
                        case 'totalWeight':
                          return (
                            <td key="totalWeight" className="px-1.5 py-2 text-right font-mono text-black bg-white whitespace-nowrap">
                              {Math.round(
                                filteredPackings.reduce((acc, p) => acc + (Number(p.totalWeight) || 0), 0) *
                                  100
                              ) / 100}{' '}
                              KG
                            </td>
                          );
                        case 'totalAmount':
                          return (
                            <td key="totalAmount" className="px-1.5 py-2 text-right font-mono text-black bg-white whitespace-nowrap">
                              {formatCurrency(
                                filteredPackings.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0),
                                'RMB'
                              )}
                            </td>
                          );
                        case 'rmbRate':
                          return (
                            <td key="rmbRate" className="px-1.5 py-2 text-right font-mono text-black bg-white text-[10px] whitespace-nowrap">
                              × RATE =
                            </td>
                          );
                        case 'amountBDT':
                          return (
                            <td key="amountBDT" className="px-1.5 py-2 text-right font-mono text-black bg-white whitespace-nowrap">
                              {formatCurrency(
                                filteredPackings.reduce(
                                  (acc, p) =>
                                    acc + calculatePackingTotalAmountBDT(p.totalAmount, p.rmbRate),
                                  0
                                ),
                                'BDT'
                              )}
                            </td>
                          );
                        default:
                          return <td key={colId} className="bg-white text-black"></td>;
                      }
                    })}
                    <td className="bg-white text-black"></td>
                  </tr>
                </tfoot>
              )}
            </table>
              </div>
          </div>
          </div>
        )}

        {activeDbType === 'payment' && (
          <div>
            {/* Payment Database Real-Time Search & Category Filter Toolbar */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-[#273E56] uppercase text-[11px] shrink-0">
                  Ledger:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    aria-pressed={paymentCategoryFilter === 'all'}
                    onClick={() => {
                      setPaymentCategoryFilter('all');
                      setSelectedIds([]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      paymentCategoryFilter === 'all'
                        ? 'bg-[#273E56] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    All Vouchers ({payments.length})
                  </button>
                  <button
                    type="button"
                    aria-pressed={paymentCategoryFilter === 'supplier'}
                    onClick={() => {
                      setPaymentCategoryFilter('supplier');
                      setSelectedIds([]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      paymentCategoryFilter === 'supplier'
                        ? 'bg-[#1877d2] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Supplier Payments (
                    {payments.filter((p) => classifyPaymentCategory(p) === 'supplier').length})
                  </button>
                  <button
                    type="button"
                    aria-pressed={paymentCategoryFilter === 'exporter'}
                    onClick={() => {
                      setPaymentCategoryFilter('exporter');
                      setSelectedIds([]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      paymentCategoryFilter === 'exporter'
                        ? 'bg-[#00897b] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Exporter Payments (
                    {payments.filter((p) => classifyPaymentCategory(p) === 'exporter').length})
                  </button>
                </div>
              </div>

              {/* Dedicated Real-Time Search Bar for Payment Database */}
              <div className="flex-1 max-w-md w-full relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-[#00897b] absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    data-testid="payment-db-search-input"
                    aria-label="Filter payment records in real-time by supplier name, reference ID, or remarks"
                    placeholder="Search by supplier name, reference ID, or payment remarks..."
                    value={paymentSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentSearchQuery(val);
                      setSearchTerm(val);
                    }}
                    className="w-full pl-9 pr-8 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#00897b] focus:border-[#00897b] shadow-2xs transition"
                  />
                  {paymentSearchQuery && (
                    <button
                      type="button"
                      data-testid="clear-payment-search-btn"
                      onClick={() => {
                        setPaymentSearchQuery('');
                        setSearchTerm('');
                      }}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                      title="Clear search filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Live Count & Search Match Indicator */}
              <div className="flex items-center space-x-2 text-[11px] shrink-0">
                {paymentSearchQuery && (
                  <span
                    data-testid="payment-search-results-badge"
                    className="px-2.5 py-0.5 rounded-full bg-teal-50 text-[#00897b] font-bold border border-teal-200 flex items-center space-x-1 animate-in fade-in"
                  >
                    <span>Found {sortedPayments.length} matches</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentSearchQuery('');
                        setSearchTerm('');
                      }}
                      className="hover:text-[#273E56] font-black cursor-pointer text-xs"
                      title="Clear search"
                    >
                      ×
                    </button>
                  </span>
                )}
                <span className="text-slate-500 font-mono">
                  Showing <strong className="text-[#273E56]">{sortedPayments.length}</strong> of{' '}
                  {payments.length}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50/70">
              {isPaymentDbScrollCapped && (
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 px-1">
                  <span>
                    Viewport: <strong>{MAX_VISIBLE_TABLE_ROWS} Rows</strong> visible ({sortedPayments.length} total rows — scroll vertically to view more)
                  </span>
                </div>
              )}
              <ColumnReorderToolbar
                tableId="payment_db"
                isCustomized={paymentDbColOrder.isCustomized}
                onReset={paymentDbColOrder.resetOrder}
                className="mb-1.5"
              />
              <div
                ref={paymentDbScrollRef}
                data-testid="payment-db-scroll-box"
                data-row-scroll-managed="true"
                data-visible-row-limit={MAX_VISIBLE_TABLE_ROWS}
                style={paymentDbScrollMaxHeight ? { maxHeight: `${paymentDbScrollMaxHeight}px` } : undefined}
                className="overflow-auto border border-slate-200 rounded-lg bg-white print:!max-h-none print:!overflow-visible"
              >
              <table data-testid="payment-db-table" className="w-full text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-[#273E56] text-white font-bold uppercase text-[10px] tracking-tight border-b border-[#1F3349]">
                  <tr>
                    <th className="px-1.5 py-2 w-7 text-center">
                      <input
                        ref={paymentHeaderCheckboxRef}
                        type="checkbox"
                        data-testid="select-all-payment-checkbox"
                        aria-label="Select all payment rows"
                        checked={activeSelectionState.allSelected}
                        onChange={() =>
                          handleSelectAll(sortedPayments.map((p) => p.id))
                        }
                        className="cursor-pointer accent-[#7C3AED]"
                      />
                    </th>
                    <th className="px-1.5 py-2 w-10 text-center whitespace-nowrap">SL #</th>
                    {paymentDbColOrder.columnOrder.map((colId) => {
                      switch (colId) {
                        case 'invoiceNumber':
                          return renderSortableHeader('invoiceNumber', 'PAYMENT NO', 'left', 'whitespace-nowrap', paymentDbColOrder);
                        case 'type':
                          return renderSortableHeader('type', 'TYPE', 'left', 'whitespace-nowrap', paymentDbColOrder);
                        case 'date':
                          return renderSortableHeader('date', 'DATE', 'left', 'whitespace-nowrap', paymentDbColOrder);
                        case 'description':
                          return renderSortableHeader('description', 'PARTY / MARK', 'left', '', paymentDbColOrder);
                        case 'status':
                          return renderSortableHeader('status', 'STATUS', 'left', 'whitespace-nowrap', paymentDbColOrder);
                        case 'paidAmount':
                          return renderSortableHeader('paidAmount', 'PAID AMOUNT', 'right', 'whitespace-nowrap', paymentDbColOrder);
                        case 'balance':
                          return renderSortableHeader('balance', 'BALANCE', 'right', 'whitespace-nowrap', paymentDbColOrder);
                        case 'exportRef':
                          return renderSortableHeader('exportRef', 'EXPORT REF', 'left', 'whitespace-nowrap', paymentDbColOrder);
                        default:
                          return null;
                      }
                    })}
                    <th className="px-1.5 py-2 text-center whitespace-nowrap">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {sortedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center bg-slate-50">
                        <div className="max-w-md mx-auto space-y-2">
                          <p className="text-slate-700 font-bold text-sm">
                            {paymentSearchQuery || searchTerm ? (
                              <>
                                No payments matching{' '}
                                <strong className="text-purple-700 font-black">
                                  "{(paymentSearchQuery || searchTerm)}"
                                </strong>
                              </>
                            ) : (
                              'No payment records found.'
                            )}
                          </p>
                          <p className="text-slate-500 text-xs">
                            Search checks supplier/buyer name, voucher &amp; challan reference IDs, and payment remarks in real-time.
                          </p>
                          {(paymentSearchQuery || searchTerm) && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentSearchQuery('');
                                setSearchTerm('');
                              }}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center space-x-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Clear Search Filter</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedPayments.map((pm, idx) => {
                      const isSelected = selectedIds.includes(pm.id);
                      const category = classifyPaymentCategory(pm);
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
                              data-testid={`select-payment-row-${pm.id}`}
                              aria-label={`Select payment voucher ${pm.invoiceNumber}`}
                              checked={isSelected}
                              onChange={() => toggleSelectOne(pm.id)}
                              className="cursor-pointer accent-[#7C3AED]"
                            />
                          </td>
                          <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                            <span className="zsb-sl-badge">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </td>
                          {paymentDbColOrder.columnOrder.map((colId) => {
                            switch (colId) {
                              case 'invoiceNumber':
                                return (
                                  <DatabaseValidatedCell
                                    key="invoiceNumber"
                                    recordId={pm.id}
                                    fieldKey="invoiceNumber"
                                    rawValue={pm.invoiceNumber}
                                    displayNode={
                                      <div className="flex items-center gap-1">
                                        <span>{pm.invoiceNumber}</span>
                                        {pm.calculationPending && (
                                          <span
                                            data-testid={`pending-calc-badge-${pm.id}`}
                                            className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black uppercase"
                                          >
                                            Pending Calc
                                          </span>
                                        )}
                                      </div>
                                    }
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
                                );
                              case 'type':
                                return (
                                  <td key="type" className="px-1.5 py-1.5 whitespace-nowrap">
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
                                );
                              case 'date':
                                return (
                                  <DatabaseValidatedCell
                                    key="date"
                                    recordId={pm.id}
                                    fieldKey="date"
                                    rawValue={pm.rawValues?.date ?? pm.date}
                                    displayNode={pm.rawValues?.date || formatDate(pm.date) || '(Blank)'}
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
                                );
                              case 'description':
                                return (
                                  <DatabaseValidatedCell
                                    key="description"
                                    recordId={pm.id}
                                    fieldKey="description"
                                    rawValue={pm.rawValues?.description ?? pm.description}
                                    displayNode={
                                      <div>
                                        <span className="font-bold text-slate-800">
                                          {pm.rawValues?.description || pm.description || '(Blank)'}
                                        </span>
                                        {pm.remarks && (
                                          <span
                                            className="block text-[10px] text-purple-700 font-normal truncate max-w-[220px]"
                                            title={pm.remarks}
                                          >
                                            💬 {pm.remarks}
                                          </span>
                                        )}
                                      </div>
                                    }
                                    validation={
                                      rowValidation.description ||
                                      validateDatabaseCellValue('payment', 'description', pm.description || '-')
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
                                );
                              case 'status':
                                return (
                                  <td key="status" className="px-1.5 py-1.5 whitespace-nowrap">
                                    {renderStatusBadge(
                                      resolvePaymentRecordStatus(pm),
                                      `payment-status-badge-${pm.id}`
                                    )}
                                  </td>
                                );
                              case 'paidAmount':
                                return (
                                  <DatabaseValidatedCell
                                    key="paidAmount"
                                    recordId={pm.id}
                                    fieldKey="paidAmount"
                                    rawValue={pm.rawValues?.paidAmount ?? pm.rawValues?.totalAmount ?? pm.paidAmount}
                                    displayNode={
                                      pm.rawValues?.paidAmount ||
                                      pm.rawValues?.totalAmount ||
                                      (pm.calculationPending
                                        ? 'Pending Calc'
                                        : formatCurrency(pm.paidAmount, companyProfile.currency))
                                    }
                                    isPendingCalc={Boolean(pm.calculationPending)}
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
                                );
                              case 'balance':
                                return (
                                  <DatabaseValidatedCell
                                    key="balance"
                                    recordId={pm.id}
                                    fieldKey="balance"
                                    rawValue={pm.rawValues?.balance ?? pm.balance}
                                    displayNode={
                                      pm.rawValues?.balance ||
                                      (pm.calculationPending
                                        ? 'Pending Calc'
                                        : formatCurrency(pm.balance, companyProfile.currency))
                                    }
                                    isPendingCalc={Boolean(pm.pendingFields?.includes('balance'))}
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
                                );
                              case 'exportRef':
                                return (
                                  <DatabaseValidatedCell
                                    key="exportRef"
                                    recordId={pm.id}
                                    fieldKey="exportGoodsRef"
                                    rawValue={pm.rawValues?.exportGoodsRef ?? pm.exportGoodsRef}
                                    displayNode={pm.rawValues?.exportGoodsRef || pm.exportGoodsRef || '-'}
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
                                );
                              default:
                                return null;
                            }
                          })}
                          <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                data-testid={`edit-payment-btn-${pm.id}`}
                                onClick={() => setEditingPaymentRecord(pm)}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition flex items-center space-x-0.5 cursor-pointer"
                                title={`Edit payment voucher ${pm.invoiceNumber} (correct amount, date, supplier)`}
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                                <span>EDIT</span>
                              </button>
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
                                data-testid={`delete-payment-btn-${pm.id}`}
                                aria-label={`Delete payment voucher ${pm.invoiceNumber}`}
                                onClick={() => deletePayment(pm.id)}
                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                title={`Delete payment voucher ${pm.invoiceNumber} (Super Admin Required)`}
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
        onBatchDelete={handleBatchDeleteSelected}
        onSuccess={(msg) => showToast(msg)}
      />
      </div>

      {/* Offscreen Host for Direct Batch Payment Slips Combined PDF Export */}
      {activeDbType === 'payment' && isExportingBatchSlips && selectedPaymentsForBatch.length > 0 && (
        <div
          id="batch-payment-slips-offscreen-host"
          data-testid="batch-payment-slips-offscreen-host"
          className="zsb-print-paper"
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

      {/* Offscreen Host for Official Supplier Reconciliation Ledger PDF Export (Mounted Only During Fallback Export) */}
      {isExportingSyncLedgerPdf && (
      <div
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          opacity: 0,
          pointerEvents: 'none',
          width: '760px',
          zIndex: -1,
        }}
      >
        <div
          id="supplier-reconciliation-ledger-pdf-canvas"
          className="zsb-print-paper relative bg-white p-7 space-y-4 text-slate-900 overflow-hidden"
          style={{
            backgroundColor: '#ffffff',
            color: '#0f172a',
            width: '760px',
          }}
        >
          {/* Watermark */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              opacity: 0.06,
              zIndex: 0,
            }}
          >
            <img
              src={resolveCompanyLogoSrc(companyProfile.logoUrl) || COMPANY_LOGO_URL}
              alt=""
              style={{ width: '280px', height: '280px', objectFit: 'contain', borderRadius: '9999px' }}
            />
          </div>

          {/* Header */}
          <div style={{ borderBottom: '2px solid #0f172a', position: 'relative', zIndex: 10 }} className="pb-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  border: '2px solid #d4af37',
                  backgroundColor: '#ffffff',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <img
                  src={resolveCompanyLogoSrc(companyProfile.logoUrl) || COMPANY_LOGO_URL}
                  alt={companyProfile.companyName}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '9999px' }}
                />
              </div>
              <div
                className="text-3xl font-black tracking-widest uppercase"
                style={{
                  color: '#f59e0b',
                  fontFamily: "'Cinzel', Georgia, Cambria, 'Times New Roman', Times, serif",
                  fontWeight: 900,
                  letterSpacing: '0.09em',
                  textShadow: '1px 1px 0px #b45309, 2px 2px 0px #78350f',
                }}
              >
                {companyProfile.companyName}
              </div>
            </div>
            <div className="text-xs font-bold text-slate-900">Address: {companyProfile.address}</div>
            <div className="text-[11px] font-bold font-mono text-slate-800">
              Mobile: {companyProfile.mobiles.join(' , ')} | Email:{' '}
              {companyProfile.email || 'zsbaquatics@gmail.com'}
            </div>
            <div
              className="mt-2 py-1.5 px-4 text-xs font-black uppercase tracking-widest text-white rounded"
              style={{ backgroundColor: '#273E56', display: 'inline-block' }}
            >
              SUPPLIER ACCOUNT RECONCILIATION LEDGER
            </div>
          </div>

          {/* Filter Metadata Summary */}
          <div
            className="grid grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-300 relative z-10"
            style={{ position: 'relative', zIndex: 10 }}
          >
            <div>
              <span className="font-bold text-slate-500 uppercase block text-[9px]">Supplier</span>
              <span className="font-black text-slate-900">
                {syncLedgerSupplier === 'ALL' ? 'ALL SUPPLIERS' : syncLedgerSupplier}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase block text-[9px]">Date Period</span>
              <span className="font-mono font-bold text-slate-900">
                {syncLedgerFromDate ? formatDate(syncLedgerFromDate) : 'All'} →{' '}
                {syncLedgerToDate ? formatDate(syncLedgerToDate) : 'Latest'}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase block text-[9px]">Order / Entries</span>
              <span className="font-mono font-bold text-slate-900">
                {syncLedgerSortDirection === 'asc' ? 'Oldest First' : 'Newest First'} ({syncSupplierLedgerRows.length})
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-500 uppercase block text-[9px]">Net Balance</span>
              <span className="font-mono font-black text-slate-950">
                {formatCurrency(syncSupplierLedgerTotals.netEndingBalance, companyProfile.currency)}
              </span>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <table className="w-full border-collapse text-[11px] font-mono border border-slate-400">
              <thead>
                <tr style={{ backgroundColor: '#273E56', color: '#ffffff' }} className="uppercase font-bold">
                  <th className="px-2 py-2 border border-slate-500 text-center w-10">SL #</th>
                  <th className="px-2 py-2 border border-slate-500 text-center w-24">DATE</th>
                  <th className="px-2.5 py-2 border border-slate-500 text-left">SUPPLIER NAME</th>
                  <th className="px-2.5 py-2 border border-slate-500 text-right w-28">DEBIT AMOUNT</th>
                  <th className="px-2.5 py-2 border border-slate-500 text-right w-28">CREDIT AMOUNT</th>
                  <th className="px-2.5 py-2 border border-slate-500 text-right w-32">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {syncSupplierLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 italic font-sans">
                      No reconciliation records found for the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  syncSupplierLedgerRows.map((row, idx) => (
                    <tr key={row.id} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                      <td className="px-2 py-1.5 border border-slate-300 text-center font-bold">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="px-2 py-1.5 border border-slate-300 text-center font-bold text-slate-800">
                        {formatDateImageStyle(row.date)}
                      </td>
                      <td className="px-2.5 py-1.5 border border-slate-300 font-sans font-bold text-slate-900">
                        {row.supplierName}
                      </td>
                      <td className="px-2.5 py-1.5 border border-slate-300 text-right font-bold text-slate-900">
                        {row.debitAmount !== 0 ? formatCurrency(row.debitAmount, '') : ''}
                      </td>
                      <td className="px-2.5 py-1.5 border border-slate-300 text-right font-bold text-slate-900">
                        {row.creditAmount !== 0 ? formatCurrency(row.creditAmount, '') : ''}
                      </td>
                      <td className="px-2.5 py-1.5 border border-slate-300 text-right font-black text-slate-950">
                        {formatCurrency(row.balance, '')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {syncSupplierLedgerRows.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 900 }} className="border-t-2 border-slate-700">
                    <td colSpan={3} className="px-2.5 py-2 border border-slate-400 text-right font-sans uppercase">
                      TOTALS ({syncSupplierLedgerRows.length} ENTRIES):
                    </td>
                    <td className="px-2.5 py-2 border border-slate-400 text-right">
                      {formatCurrency(syncSupplierLedgerTotals.totalDebit, '')}
                    </td>
                    <td className="px-2.5 py-2 border border-slate-400 text-right text-emerald-800">
                      {formatCurrency(syncSupplierLedgerTotals.totalCredit, '')}
                    </td>
                    <td className="px-2.5 py-2 border border-slate-400 text-right text-slate-950">
                      {formatCurrency(syncSupplierLedgerTotals.netEndingBalance, companyProfile.currency)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Signature Footer */}
          <div
            className="pt-8 grid grid-cols-3 gap-6 text-center text-[10px] font-bold uppercase text-slate-700 relative z-10"
            style={{ position: 'relative', zIndex: 10 }}
          >
            <div className="border-t border-slate-400 pt-1.5">Prepared By</div>
            <div className="border-t border-slate-400 pt-1.5">Accounts &amp; Audit</div>
            <div className="border-t border-slate-400 pt-1.5">Managing Director</div>
          </div>
        </div>
      </div>
      )}
      {/* Edit Payment Voucher Modal for Fast Maintenance & Corrections */}
      {editingPaymentRecord && (
        <div
          data-testid="edit-payment-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white px-5 py-4 flex items-center justify-between border-b border-purple-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                  <Edit2 className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-wide text-white">
                    Edit Payment Voucher — {editingPaymentRecord.invoiceNumber}
                  </h3>
                  <p className="text-[11px] text-purple-200">
                    Correct credit amount, date, supplier, or notes. Balance recalculates automatically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPaymentRecord(null)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                title="Close edit modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentEdit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Voucher Number *
                  </label>
                  <input
                    type="text"
                    data-testid="edit-payment-invoice-number-input"
                    value={paymentEditForm.invoiceNumber}
                    onChange={(e) =>
                      setPaymentEditForm((prev) => ({
                        ...prev,
                        invoiceNumber: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="text"
                    data-testid="edit-payment-date-input"
                    value={paymentEditForm.date}
                    onChange={(e) =>
                      setPaymentEditForm((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    placeholder="YYYY-MM-DD or =TODAY()"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Supplier / Party Name *
                </label>
                <input
                  type="text"
                  data-testid="edit-payment-supplier-input"
                  list="payment-edit-suppliers-datalist"
                  value={paymentEditForm.description}
                  onChange={(e) =>
                    setPaymentEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Select or enter supplier name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
                <datalist id="payment-edit-suppliers-datalist">
                  {dropdownOptions.suppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                  <label className="block font-black text-emerald-900 mb-1 text-[11px] uppercase tracking-wide">
                    Credit / Paid Amount ({companyProfile.currency}) *
                  </label>
                  <input
                    type="text"
                    data-testid="edit-payment-paid-amount-input"
                    value={paymentEditForm.paidAmount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const p = parseFloat(raw);
                      setPaymentEditForm((prev) => {
                        const tot = parseFloat(prev.totalAmount);
                        return {
                          ...prev,
                          paidAmount: raw,
                          balance:
                            Number.isFinite(p) && Number.isFinite(tot) && tot > 0
                              ? String(tot - p)
                              : prev.balance,
                        };
                      });
                    }}
                    className="w-full px-3 py-1.5 border-2 border-emerald-400 rounded-lg font-mono font-black text-emerald-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  />
                  <p className="text-[10px] text-emerald-700 mt-1 font-medium">
                    Cash / bank disbursement, negative adjustment, or literal formula
                  </p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="block font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wide">
                    Total Billed ({companyProfile.currency})
                  </label>
                  <input
                    type="text"
                    data-testid="edit-payment-total-amount-input"
                    value={paymentEditForm.totalAmount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const tot = parseFloat(raw);
                      setPaymentEditForm((prev) => {
                        const p = parseFloat(prev.paidAmount);
                        return {
                          ...prev,
                          totalAmount: raw,
                          balance:
                            Number.isFinite(tot) && Number.isFinite(p)
                              ? String(tot - p)
                              : prev.balance,
                        };
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Bill or Challan total
                  </p>
                </div>

                <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200">
                  <label className="block font-black text-rose-900 mb-1 text-[11px] uppercase tracking-wide">
                    Due Balance ({companyProfile.currency})
                  </label>
                  <input
                    type="text"
                    data-testid="edit-payment-balance-input"
                    value={paymentEditForm.balance}
                    onChange={(e) =>
                      setPaymentEditForm((prev) => ({
                        ...prev,
                        balance: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-1.5 border border-rose-300 rounded-lg font-mono font-bold text-rose-800 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
                  />
                  <p className="text-[10px] text-rose-700 mt-1 font-medium">
                    Remaining after disbursement
                  </p>
                </div>

                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-black text-amber-900 mb-1 text-[11px] uppercase tracking-wide">
                    Return / Foreign RMB
                  </label>
                  <input
                    type="text"
                    data-testid="edit-payment-rmb-input"
                    value={paymentEditForm.returnRMB}
                    onChange={(e) =>
                      setPaymentEditForm((prev) => ({
                        ...prev,
                        returnRMB: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg font-mono font-bold text-amber-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  />
                  <p className="text-[10px] text-amber-800 mt-1 font-medium">
                    Foreign RMB value or formula
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Voucher Status
                  </label>
                  <select
                    value={paymentEditForm.status}
                    onChange={(e) =>
                      setPaymentEditForm((prev) => ({
                        ...prev,
                        status: e.target.value as ExporterStatus,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                    <option value="REPORT">REPORT</option>
                    <option value="NO REPORT">NO REPORT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Challan / Export Reference
                  </label>
                  <input
                    type="text"
                    value={paymentEditForm.exportGoodsRef}
                    onChange={(e) =>
                      setPaymentEditForm((prev) => ({
                        ...prev,
                        exportGoodsRef: e.target.value,
                      }))
                    }
                    placeholder="e.g. INV-2026-001 or shipping mark"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Remarks / Transaction Note
                </label>
                <input
                  type="text"
                  value={paymentEditForm.remarks}
                  onChange={(e) =>
                    setPaymentEditForm((prev) => ({
                      ...prev,
                      remarks: e.target.value,
                    }))
                  }
                  placeholder="Cash payout at Turag depot, cheque no, bKash TrxID, etc."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-[11px] font-mono text-slate-400">
                  Voucher ID: {editingPaymentRecord.id}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingPaymentRecord(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="save-payment-edit-btn"
                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SAVE CHANGES</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Account Reconciliation Ledger Row Modal */}
      <EditReconciliationRowModal
        target={editingReconciliationRow}
        suppliers={dropdownOptions.suppliers}
        currency={companyProfile.currency}
        onClose={() => setEditingReconciliationRow(null)}
        onSave={handleSaveReconciliationRowEdit}
        onOpenFullPurchaseForm={handleOpenFullPurchaseFromLedger}
      />
    </div>
  );
};
