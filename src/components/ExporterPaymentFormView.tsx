import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  calculatePaymentRow,
  calculatePaymentTotals,
  generateInvoiceNumber,
  formatCurrency,
  formatDate,
  formatRMB,
  getExporterManifestStats,
  classifyPaymentCategory,
} from '../utils/calculations.ts';
import {
  EXPORTER_STATUS_OPTIONS,
  ExporterRecordHistoryRow,
  buildExporterRecordHistory,
  calculateExporterHistoryTotals,
} from '../utils/exporterHistory.ts';
import { PaymentItemRow, ExporterStatus } from '../types/index.ts';
import { validateExporterPaymentForm } from '../utils/validation.ts';
import { generateRecordId } from '../utils/idGenerator.ts';
import {
  ZSB_VIEW_SHORTCUT_EVENT,
  ViewShortcutEventDetail,
} from '../utils/keyboardShortcuts.ts';
import {
  ZSB_PAYMENT_ENTRY_CONFIRMED_EVENT,
  PaymentSyncEventDetail,
  emitPaymentSyncTrigger,
} from '../utils/paymentSync.ts';
import {
  Save,
  FileText,
  Search,
  Trash2,
  Edit2,
  Check,
  Printer,
  Plus,
  Database,
  Coins,
  CheckCircle,
  Plane,
  RotateCcw,
  Eye,
  Receipt,
  AlertCircle,
  X,
  Filter,
  Tag,
  Calendar,
} from 'lucide-react';
import { ExporterRecordImageModal } from './ExporterRecordImageModal.tsx';
import {
  ExporterRecordSharePayload,
  parseExporterWeChatDeepLinkFromSearch,
} from '../utils/exporterWeChatShare.ts';

export const ExporterPaymentFormView: React.FC = () => {
  const {
    companyProfile,
    dropdownOptions,
    addDropdownItem,
    packings,
    payments,
    updatePacking,
    updatePayment,
    deletePacking,
    deletePayment,
    addPayment,
    openPrintModal,
    setActiveTab,
    showToast,
    requestSuperAdminSingleDelete,
  } = useApp();

  const exporterPayments = useMemo(
    () => payments.filter((pm) => classifyPaymentCategory(pm) === 'exporter'),
    [payments]
  );

  const nextVoucherNo = generateInvoiceNumber('EXP-PAY', exporterPayments.length);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(nextVoucherNo);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shippingMark, setShippingMark] = useState<string>('ALL');
  const [selectedPackingDate, setSelectedPackingDate] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [contactNumber, setContactNumber] = useState<string>('');

  // Exporter Specific Fields
  const [exporterStatus, setExporterStatus] = useState<ExporterStatus>('UNPAID');
  const [returnRMB, setReturnRMB] = useState<number>(0);
  const [exportGoodsRef, setExportGoodsRef] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const createEmptyRow = (id: string, defaultMark = ''): PaymentItemRow => ({
    id,
    shippingMark: defaultMark,
    description: '',
    debitAmount: 0,
    creditAmount: 0,
    balance: 0,
    status: 'UNPAID',
  });

  // Optional custom rows added on top of automatic Exporter DB record history
  const [customRows, setCustomRows] = useState<PaymentItemRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [deletedRowIds, setDeletedRowIds] = useState<string[]>([]);
  const [rowDescriptionOverrides, setRowDescriptionOverrides] = useState<
    Record<string, string>
  >({});
  const [historySyncRevision, setHistorySyncRevision] = useState<number>(0);
  const [lastSyncEvent, setLastSyncEvent] = useState<PaymentSyncEventDetail | null>(
    null
  );

  // Automated synchronization listener: refreshes Exporter & Supplier Record History whenever a payment entry is confirmed
  useEffect(() => {
    const handlePaymentSync = (event: Event) => {
      const customEvent = event as CustomEvent<PaymentSyncEventDetail>;
      const detail = customEvent.detail;
      setHistorySyncRevision((prev) => prev + 1);
      if (detail) {
        setLastSyncEvent(detail);
      }
    };

    window.addEventListener(ZSB_PAYMENT_ENTRY_CONFIRMED_EVENT, handlePaymentSync);
    return () => {
      window.removeEventListener(ZSB_PAYMENT_ENTRY_CONFIRMED_EVENT, handlePaymentSync);
    };
  }, []);

  const [overallPreviousAmount, setOverallPreviousAmount] = useState<number>(0);
  const [overallPaidAmount, setOverallPaidAmount] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddingNewMark, setIsAddingNewMark] = useState<boolean>(false);
  const [newMarkValue, setNewMarkValue] = useState<string>('');
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);
  const [selectedImageRowPayload, setSelectedImageRowPayload] =
    useState<ExporterRecordSharePayload | null>(null);

  // Automatically open Transaction Image & Details modal when visited via a share deep link (?wechat_tx=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sharedPayload = parseExporterWeChatDeepLinkFromSearch(
      window.location.search,
      {
        companyName: companyProfile.companyName,
        companyAddress: companyProfile.address,
        companyMobiles: companyProfile.mobiles,
        companyEmail: companyProfile.email,
        partnerName: companyProfile.partner,
      }
    );
    if (sharedPayload) {
      setSelectedImageRowPayload(sharedPayload);
    }
  }, [
    companyProfile.companyName,
    companyProfile.address,
    companyProfile.mobiles,
    companyProfile.email,
    companyProfile.partner,
  ]);

  const statusOptions = useMemo(() => {
    return dropdownOptions.paymentStatuses.length > 0
      ? dropdownOptions.paymentStatuses
      : ['PAID', 'UNPAID'];
  }, [dropdownOptions.paymentStatuses]);

  // Available Shipping Marks & Packing Dates for Automatic Exporter Database Lookup
  const availableMarks = useMemo(() => {
    const dbMarks = Array.from(
      new Set(packings.map((p) => p.shippingMark).filter(Boolean))
    );
    const otherMarks = dropdownOptions.shippingMarks.filter(
      (m) => !dbMarks.includes(m)
    );
    return { dbMarks, otherMarks };
  }, [packings, dropdownOptions.shippingMarks]);

  const availablePackingDates = useMemo(() => {
    const matching =
      shippingMark === 'ALL' || !shippingMark
        ? packings
        : packings.filter(
            (p) =>
              p.shippingMark.trim().toLowerCase() ===
              shippingMark.trim().toLowerCase()
          );
    return Array.from(
      new Set(matching.map((p) => p.packingDate).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
  }, [packings, shippingMark]);

  // Automatic Exporter Record History (Debit, Credit, Balance & Status: Report, No Report, Paid)
  const dbHistoryRows = useMemo(
    () =>
      buildExporterRecordHistory(packings, payments, {
        shippingMark: shippingMark || 'ALL',
        packingDate: selectedPackingDate || 'ALL',
        status: selectedStatusFilter || 'ALL',
        rmbExchangeRate: companyProfile.rmbExchangeRate,
      }),
    [
      packings,
      payments,
      shippingMark,
      selectedPackingDate,
      selectedStatusFilter,
      companyProfile.rmbExchangeRate,
      historySyncRevision,
    ]
  );

  // Combined rows: all Exporter Database record history + any custom added rows
  const rows: PaymentItemRow[] = useMemo(() => {
    const merged = [...dbHistoryRows, ...customRows]
      .filter((r) => !deletedRowIds.includes(r.id))
      .map((r) =>
        rowDescriptionOverrides[r.id] !== undefined
          ? { ...r, description: rowDescriptionOverrides[r.id] }
          : r
      );
    if (merged.length > 0) return merged;
    const defaultMark = shippingMark !== 'ALL' ? shippingMark : '';
    const defaults = [
      { ...createEmptyRow('exp-default-1', defaultMark), date },
      { ...createEmptyRow('exp-default-2', defaultMark), date },
      { ...createEmptyRow('exp-default-3', defaultMark), date },
    ].filter((r) => !deletedRowIds.includes(r.id));
    return defaults.length > 0
      ? defaults
      : [{ ...createEmptyRow('exp-default-fallback', defaultMark), date }];
  }, [
    dbHistoryRows,
    customRows,
    deletedRowIds,
    rowDescriptionOverrides,
    shippingMark,
    date,
  ]);

  const historyTotals = useMemo(
    () => calculateExporterHistoryTotals(rows),
    [rows]
  );

  const effectiveShippingMarkForSave =
    shippingMark && shippingMark !== 'ALL'
      ? shippingMark
      : rows[0]?.shippingMark || 'ALL MARKS';

  const validation = validateExporterPaymentForm({
    invoiceNumber,
    date,
    shippingMark: effectiveShippingMarkForSave,
    exporterStatus,
    returnRMB,
    overallPreviousAmount,
    overallPaidAmount,
    rows,
  });

  // Live Exporter Manifest Stats
  const exporterStats = useMemo(
    () =>
      getExporterManifestStats(
        packings,
        payments,
        shippingMark === 'ALL' ? '' : shippingMark,
        companyProfile.rmbExchangeRate
      ),
    [packings, payments, shippingMark, companyProfile.rmbExchangeRate]
  );

  const handleSelectShippingMark = (mark: string) => {
    const normalized = mark || 'ALL';
    setShippingMark(normalized);
    if (normalized !== 'ALL') {
      const matchingPkg = packings.find(
        (pk) => pk.shippingMark.trim().toLowerCase() === normalized.trim().toLowerCase()
      );
      if (matchingPkg) {
        setExportGoodsRef(matchingPkg.invoiceNumber);
        const estRmb =
          matchingPkg.rmbAmount && matchingPkg.rmbAmount > 0
            ? matchingPkg.rmbAmount
            : Math.round(
                (matchingPkg.totalAmount / (companyProfile.rmbExchangeRate || 16.5)) * 100
              ) / 100;
        setReturnRMB(estRmb);
        if (matchingPkg.exporterStatus || matchingPkg.paymentStatus) {
          setExporterStatus(
            (matchingPkg.exporterStatus || matchingPkg.paymentStatus) as ExporterStatus
          );
        }
      }
      if (selectedPackingDate !== 'ALL') {
        const hasOnDate = packings.some(
          (p) =>
            p.shippingMark.trim().toLowerCase() === normalized.trim().toLowerCase() &&
            p.packingDate === selectedPackingDate
        );
        if (!hasOnDate) {
          setSelectedPackingDate('ALL');
        }
      }
    }
  };

  const handleSelectPackingDate = (newDate: string) => {
    const normalized = newDate || 'ALL';
    setSelectedPackingDate(normalized);
    if (normalized !== 'ALL') {
      setDate(normalized);
    }
  };

  const handleSelectManifestRef = (manifestInvoiceNo: string) => {
    setExportGoodsRef(manifestInvoiceNo);
    const foundPkg = packings.find((pk) => pk.invoiceNumber === manifestInvoiceNo);
    if (foundPkg) {
      setShippingMark(foundPkg.shippingMark);
      setSelectedPackingDate(foundPkg.packingDate || 'ALL');
      const estRmb =
        foundPkg.rmbAmount && foundPkg.rmbAmount > 0
          ? foundPkg.rmbAmount
          : Math.round(
              (foundPkg.totalAmount / (companyProfile.rmbExchangeRate || 16.5)) * 100
            ) / 100;
      setReturnRMB(estRmb);
      setOverallPreviousAmount(foundPkg.totalAmount);
      setOverallPaidAmount(foundPkg.totalAmount);
      showToast(
        `Synced manifest ${foundPkg.invoiceNumber} (${foundPkg.shippingMark} · ${foundPkg.totalWeight} KG · ${formatRMB(estRmb)})`
      );
    }
  };

  const handleRowChange = (
    row: PaymentItemRow,
    field: 'description' | 'debitAmount' | 'creditAmount' | 'status',
    value: string | number
  ) => {
    if (row.packingId) {
      if (field === 'description') {
        const nextDesc = String(value);
        setRowDescriptionOverrides((prev) => ({ ...prev, [row.id]: nextDesc }));
      } else if (field === 'debitAmount') {
        const nextDebit = Math.max(0, Number(value) || 0);
        const nextBalance = calculatePaymentRow(nextDebit, row.creditAmount);
        updatePacking(row.packingId, {
          debitAmount: nextDebit,
          settledAmount: nextDebit,
          balanceAmount: nextBalance,
        });
      } else if (field === 'creditAmount') {
        const nextCredit = Math.max(0, Number(value) || 0);
        const nextBalance = calculatePaymentRow(row.debitAmount, nextCredit);
        updatePacking(row.packingId, {
          creditAmount: nextCredit,
          balanceAmount: nextBalance,
        });
      } else if (field === 'status') {
        const nextStatus = String(value) as ExporterStatus;
        updatePacking(row.packingId, {
          exporterStatus: nextStatus,
          paymentStatus: nextStatus,
        });
      }
      return;
    }

    if (row.paymentId) {
      if (field === 'description') {
        const nextDesc = String(value);
        setRowDescriptionOverrides((prev) => ({ ...prev, [row.id]: nextDesc }));
        updatePayment(row.paymentId, {
          description: nextDesc,
        });
      } else if (field === 'debitAmount') {
        const nextDebit = Math.max(0, Number(value) || 0);
        const nextBalance = calculatePaymentRow(nextDebit, row.creditAmount);
        updatePayment(row.paymentId, {
          totalAmount: nextDebit,
          balance: nextBalance,
        });
      } else if (field === 'creditAmount') {
        const nextCredit = Math.max(0, Number(value) || 0);
        const nextBalance = calculatePaymentRow(row.debitAmount, nextCredit);
        updatePayment(row.paymentId, {
          paidAmount: nextCredit,
          balance: nextBalance,
        });
      } else if (field === 'status') {
        updatePayment(row.paymentId, {
          status: String(value) as ExporterStatus,
        });
      }
      return;
    }

    setCustomRows((prev) => {
      const baseList =
        prev.length > 0
          ? prev
          : dbHistoryRows.length === 0
          ? [
              {
                ...createEmptyRow(
                  'exp-default-1',
                  shippingMark !== 'ALL' ? shippingMark : ''
                ),
                date,
              },
              {
                ...createEmptyRow(
                  'exp-default-2',
                  shippingMark !== 'ALL' ? shippingMark : ''
                ),
                date,
              },
              {
                ...createEmptyRow(
                  'exp-default-3',
                  shippingMark !== 'ALL' ? shippingMark : ''
                ),
                date,
              },
            ]
          : [];
      return baseList.map((r) => {
        if (r.id !== row.id) return r;
        const updated = { ...r, [field]: value };
        const d = field === 'debitAmount' ? Number(value) : r.debitAmount;
        const c = field === 'creditAmount' ? Number(value) : r.creditAmount;
        updated.balance = calculatePaymentRow(d, c);
        return updated;
      });
    });
  };

  const handleAddRow = () => {
    setCustomRows((prev) => [
      ...prev,
      createEmptyRow(
        generateRecordId('exprow'),
        shippingMark !== 'ALL' ? shippingMark : ''
      ),
    ]);
  };

  const handleEditRow = (row: PaymentItemRow, idx: number) => {
    if (editingRowId === row.id) {
      setEditingRowId(null);
      showToast(`Saved changes for Exporter row #${idx + 1}.`);
      return;
    }
    setEditingRowId(row.id);
    setTimeout(() => {
      const inputEl = document.getElementById(
        `exporter-row-desc-${row.id}`
      ) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 0);
  };

  const handleDeleteRow = (row: PaymentItemRow, idx: number) => {
    if (editingRowId === row.id) {
      setEditingRowId(null);
    }
    if (row.packingId) {
      deletePacking(row.packingId);
      return;
    }
    if (row.paymentId) {
      deletePayment(row.paymentId);
      return;
    }
    requestSuperAdminSingleDelete(
      {
        recordType: 'custom_row',
        recordId: row.id,
        recordTitle: `Exporter Ledger Row #${idx + 1}${row.shippingMark ? ` (${row.shippingMark})` : ''}`,
        recordSubtitle: row.description || `Date: ${row.date || '-'}`,
      },
      () => {
        setCustomRows((prev) => prev.filter((r) => r.id !== row.id));
        setDeletedRowIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
        showToast(`Super Admin verified: Deleted Exporter row #${idx + 1}.`);
      }
    );
  };

  const resetFormFields = () => {
    setShippingMark('ALL');
    setSelectedPackingDate('ALL');
    setSelectedStatusFilter('ALL');
    setContactNumber('');
    setExporterStatus('UNPAID');
    setReturnRMB(0);
    setExportGoodsRef('');
    setRemarks('');
    setSearchQuery('');
    setOverallPreviousAmount(0);
    setOverallPaidAmount(0);
    setDate(new Date().toISOString().slice(0, 10));
    setCustomRows([]);
    setEditingRowId(null);
    setDeletedRowIds([]);
    setRowDescriptionOverrides({});
    setValidationAttempted(false);
  };

  const handleClear = () => {
    resetFormFields();
    showToast('Reset lookup filters and showing all Exporter record history.');
  };

  const { totalDebit, totalCredit } = calculatePaymentTotals(
    rows,
    overallPreviousAmount,
    overallPaidAmount
  );

  const filteredOutstandingBalance =
    Math.round((totalDebit - totalCredit) * 100) / 100;

  const effectiveTotalDebit =
    overallPreviousAmount > 0 ? overallPreviousAmount : totalDebit;
  const effectiveTotalPaid =
    overallPaidAmount > 0 ? overallPaidAmount : totalCredit;
  const balance =
    Math.round((effectiveTotalDebit - effectiveTotalPaid) * 100) / 100;

  const returnRMBInBDT =
    Math.round(returnRMB * companyProfile.rmbExchangeRate * 100) / 100;

  const activeRowCount = rows.filter(
    (r) => r.description.trim() !== '' || r.debitAmount !== 0 || r.creditAmount !== 0
  ).length;

  const commitExporterPaymentEntry = (options?: { openPreview?: boolean }) => {
    const shouldOpenPreview = options?.openPreview ?? true;
    const check = validateExporterPaymentForm({
      invoiceNumber,
      date,
      shippingMark: effectiveShippingMarkForSave,
      exporterStatus,
      returnRMB,
      overallPreviousAmount,
      overallPaidAmount,
      rows,
    });

    if (!check.isValid) {
      setValidationAttempted(true);
      showToast(
        `Validation failed: ${check.errors[0] || 'Please fix highlighted fields before saving.'}`
      );
      return;
    }

    setValidationAttempted(false);
    const validItems = check.validItems;

    // Separate newly entered custom rows from already-persisted DB rows
    const newCustomItems = validItems.filter(
      (item) => !item.packingId && !item.paymentId
    );
    const newCustomDebit =
      Math.round(
        newCustomItems.reduce((s, r) => s + (Number(r.debitAmount) || 0), 0) * 100
      ) / 100;
    const newCustomCredit =
      Math.round(
        newCustomItems.reduce((s, r) => s + (Number(r.creditAmount) || 0), 0) * 100
      ) / 100;

    const shouldCreateStandaloneVoucher =
      newCustomItems.length > 0 ||
      Boolean(exportGoodsRef.trim()) ||
      dbHistoryRows.length === 0;

    const recordItems =
      newCustomItems.length > 0 ? newCustomItems : validItems;
    const recordDebit =
      newCustomItems.length > 0 ? newCustomDebit : totalDebit;
    const recordPaid =
      newCustomItems.length > 0
        ? newCustomCredit > 0
          ? newCustomCredit
          : overallPaidAmount
        : overallPaidAmount || totalCredit;
    const recordBalance =
      Math.round((recordDebit - recordPaid) * 100) / 100;

    const newRecord = {
      invoiceNumber: invoiceNumber.trim(),
      date:
        selectedPackingDate !== 'ALL'
          ? selectedPackingDate
          : date || new Date().toISOString().slice(0, 10),
      description: `${effectiveShippingMarkForSave}${
        exporterStats.latestDestination ? ` (${exporterStats.latestDestination})` : ''
      }`,
      shippingMark: effectiveShippingMarkForSave,
      contactNumber,
      items: recordItems,
      totalAmount: recordDebit,
      previousAmount: overallPreviousAmount || recordDebit,
      paidAmount: recordPaid,
      balance: recordBalance,
      status: exporterStatus,
      returnRMB: returnRMB || recordPaid,
      returnRMBInBDT,
      exportGoodsRef,
      paymentCategory: 'exporter' as const,
      remarks,
    };

    if (shouldCreateStandaloneVoucher) {
      addPayment(newRecord);
      setInvoiceNumber(generateInvoiceNumber('EXP-PAY', exporterPayments.length + 1));
    } else {
      emitPaymentSyncTrigger({
        category: 'exporter',
        action: 'confirm',
        invoiceNumber: newRecord.invoiceNumber,
        partyName: effectiveShippingMarkForSave,
        debitAmount: totalDebit,
        creditAmount: totalCredit,
        runningBalance: balance,
      });
    }

    if (exportGoodsRef.trim()) {
      const matchedPkg = packings.find(
        (pk) => pk.invoiceNumber.toLowerCase() === exportGoodsRef.trim().toLowerCase()
      );
      if (matchedPkg) {
        updatePacking(matchedPkg.id, {
          exporterStatus,
          paymentStatus: exporterStatus,
          rmbAmount: returnRMB > 0 ? returnRMB : matchedPkg.rmbAmount,
          settledAmount: returnRMB > 0 ? returnRMB : matchedPkg.settledAmount,
        });
      }
    }

    setCustomRows([]);
    setEditingRowId(null);

    if (shouldOpenPreview) {
      openPrintModal({
        type: 'payment',
        title: `Exporter Payment Voucher - ${newRecord.invoiceNumber}`,
        data: {
          ...newRecord,
          items: validItems,
          totalAmount: totalDebit,
          paidAmount: overallPaidAmount || totalCredit,
          balance: totalDebit - totalCredit,
        },
        items: validItems,
      });
      resetFormFields();
      showToast(
        `Exporter payment voucher ${newRecord.invoiceNumber} confirmed and synchronized.`
      );
    } else {
      showToast(
        `Exporter payment entry ${newRecord.invoiceNumber} confirmed! Record history and running balance updated.`
      );
    }
  };

  const handleSavePDF = () => {
    commitExporterPaymentEntry({ openPreview: true });
  };

  const handleConfirmExporterEntry = () => {
    commitExporterPaymentEntry({ openPreview: false });
  };

  const handlePrintSelected = () => {
    const validItems = rows.filter(
      (r) => r.description.trim() !== '' || r.debitAmount > 0 || r.creditAmount > 0
    );
    openPrintModal({
      type: 'payment',
      title: `Exporter Payment Voucher (Preview) - ${invoiceNumber}`,
      data: {
        invoiceNumber,
        date:
          selectedPackingDate !== 'ALL'
            ? selectedPackingDate
            : date || new Date().toISOString().slice(0, 10),
        description: effectiveShippingMarkForSave,
        shippingMark: effectiveShippingMarkForSave,
        contactNumber,
        items: validItems.length > 0 ? validItems : rows.slice(0, 5),
        totalAmount: totalDebit,
        previousAmount: overallPreviousAmount || totalDebit,
        paidAmount: overallPaidAmount || totalCredit,
        balance: totalDebit - totalCredit,
        status: exporterStatus,
        returnRMB: returnRMB || totalCredit,
        returnRMBInBDT,
        exportGoodsRef,
        paymentCategory: 'exporter',
        remarks,
      },
      items: validItems.length > 0 ? validItems : rows.slice(0, 5),
    });
  };

  useEffect(() => {
    const onShortcut = (event: Event) => {
      const customEvent = event as CustomEvent<ViewShortcutEventDetail>;
      const action = customEvent.detail?.action;
      if (!action) return;

      if (action === 'SAVE_ACTIVE_VIEW') {
        customEvent.detail.handled = true;
        handleSavePDF();
      } else if (action === 'PRINT_ACTIVE_VIEW') {
        customEvent.detail.handled = true;
        handlePrintSelected();
      } else if (action === 'ADD_FORM_ROW') {
        customEvent.detail.handled = true;
        handleAddRow();
        showToast('Added new line item row to Exporter Payment Form (Alt+N).');
      } else if (action === 'RESET_FORM') {
        customEvent.detail.handled = true;
        handleClear();
      }
    };

    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
  });

  const handleMonthlyStatement = () => {
    const targetMark = shippingMark === 'ALL' ? '' : shippingMark.toLowerCase();
    const matched = targetMark
      ? exporterPayments.filter(
          (p) =>
            (p.shippingMark || '').toLowerCase() === targetMark ||
            p.description.toLowerCase().includes(targetMark)
        )
      : exporterPayments;
    openPrintModal({
      type: 'monthly_statement',
      title: `Exporter Monthly Statement - ${effectiveShippingMarkForSave}`,
      data: {
        party: `Exporter Mark: ${effectiveShippingMarkForSave}`,
        date,
        records: matched,
        totalRecords: matched.length,
      },
    });
  };

  const matchingExporterVouchers = useMemo(() => {
    const rawMark = shippingMark === 'ALL' ? '' : shippingMark;
    const query = (searchQuery || rawMark || '').trim().toLowerCase();
    if (!query) return exporterPayments.slice(0, 4);
    return exporterPayments
      .filter(
        (pm) =>
          pm.description.toLowerCase().includes(query) ||
          (pm.shippingMark || '').toLowerCase().includes(query) ||
          pm.invoiceNumber.toLowerCase().includes(query) ||
          (pm.exportGoodsRef || '').toLowerCase().includes(query)
      )
      .slice(0, 4);
  }, [exporterPayments, searchQuery, shippingMark]);

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-5">
      {/* Top Banner (Sheet #04 - Dedicated Exporter Payment) */}
      <div className="bg-[#0f3d4c] text-white px-5 py-3 rounded-lg shadow-md flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="zsb-3d-text text-xl sm:text-2xl font-black">
              {companyProfile.companyName}
            </span>
            <span className="text-lg text-slate-300 hidden sm:inline">|</span>
            <span className="text-sm sm:text-base font-semibold text-slate-100 uppercase tracking-wide">
              Exporter Payment Data Entry Form – All Record History (Debit, Credit, Balance &amp; Status)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('payment_form')}
            className="text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 px-3 py-1 rounded border border-purple-400/40 font-bold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <span>Supplier Payment Sheet (#05)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exporter_payment_slip')}
            className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded font-black flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Exporter Payment Slip 付款单 (#07)</span>
          </button>
          <span className="text-xs bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded border border-amber-400/40 font-mono font-bold">
            Sheet #04
          </span>
        </div>
      </div>

      {/* Automatic Exporter Database Lookup (Select Shipping Mark & Packing Date) */}
      <div
        data-testid="exporter-form-auto-lookup-card"
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#126b62]" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              Automatic Exporter Database Lookup (Select Shipping Mark &amp; Packing Date)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono bg-teal-50 text-teal-900 border border-teal-200 px-2.5 py-0.5 rounded font-bold">
              Showing {rows.length} Record{rows.length === 1 ? '' : 's'} ({historyTotals.paidCount} PAID · {historyTotals.reportCount + historyTotals.noReportCount} UNPAID)
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Show All History ({packings.length})</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* 1. Select Shipping Mark */}
          <div>
            <label
              htmlFor="exporter-lookup-mark-select"
              className="flex items-center justify-between font-black uppercase text-slate-700 mb-1"
            >
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#126b62]" />
                <span>Select Shipping Mark</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold">Auto-Lookup</span>
            </label>
            <select
              id="exporter-lookup-mark-select"
              value={shippingMark}
              onChange={(e) => handleSelectShippingMark(e.target.value)}
              className="w-full bg-teal-50/50 border-2 border-teal-600/40 rounded-lg px-2.5 py-1.5 font-black text-sm text-slate-950 focus:bg-white focus:border-teal-700 focus:outline-none"
            >
              <option value="ALL">ALL SHIPPING MARKS ({packings.length})</option>
              <optgroup label="Marks with Saved Exporter Records">
                {availableMarks.dbMarks.map((mk) => (
                  <option key={mk} value={mk}>
                    {mk}
                  </option>
                ))}
              </optgroup>
              {availableMarks.otherMarks.length > 0 && (
                <optgroup label="Other Registered Shipping Marks">
                  {availableMarks.otherMarks.map((mk) => (
                    <option key={mk} value={mk}>
                      {mk}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 2. Select Packing Date */}
          <div>
            <label
              htmlFor="exporter-lookup-date-select"
              className="flex items-center justify-between font-black uppercase text-slate-700 mb-1"
            >
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#126b62]" />
                <span>Select Packing Date</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold">Auto-Lookup</span>
            </label>
            <select
              id="exporter-lookup-date-select"
              value={selectedPackingDate}
              onChange={(e) => handleSelectPackingDate(e.target.value)}
              className="w-full bg-teal-50/50 border-2 border-teal-600/40 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
            >
              <option value="ALL">-- ALL PACKING DATES --</option>
              {availablePackingDates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)} ({d})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter by Status (PAID, UNPAID) */}
          <div>
            <label
              htmlFor="exporter-lookup-status-filter"
              className="flex items-center justify-between font-black uppercase text-slate-700 mb-1"
            >
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-[#126b62]" />
                <span>Status Filter (PAID / UNPAID)</span>
              </span>
            </label>
            <select
              id="exporter-lookup-status-filter"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
            >
              <option value="ALL">-- All Statuses (PAID, UNPAID) --</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Left (8 Cols), Action Buttons & Exporter Search Right (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: The Dedicated Exporter Payment Excel Sheet (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl shadow-md border-2 border-slate-300 overflow-hidden">
            {/* Teal / Navy Sheet Header Box */}
            <div className="bg-[#126b62] text-white py-3 px-4 text-center border-b border-teal-950 shadow-inner space-y-1.5">
              <div className="flex items-center justify-center gap-2.5">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-300 bg-white p-0.5 shrink-0 shadow-xs flex items-center justify-center">
                  <img
                    src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                    alt={companyProfile.companyName}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div className="zsb-3d-text-lg text-xl sm:text-2xl font-black">
                  {companyProfile.companyName}
                </div>
              </div>
              <div className="text-xs sm:text-sm font-bold tracking-wider uppercase text-teal-100">
                EXPORTER PAYMENT DATA ENTRY &amp; RECORD HISTORY (DEBIT, CREDIT, BALANCE &amp; STATUS)
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                <span className="bg-white/95 text-black px-2.5 py-0.5 rounded text-[11px] font-bold shadow-xs">
                  Address: {companyProfile.address}
                </span>
                <span className="bg-white/95 text-black px-2.5 py-0.5 rounded text-[11px] font-bold font-mono shadow-xs">
                  Mobile: {companyProfile.mobiles.join(', ')}
                </span>
                <span className="bg-white/95 text-black px-2.5 py-0.5 rounded text-[11px] font-bold font-mono shadow-xs">
                  EMAIL: {companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com' ? companyProfile.email : 'zsbaquatics@gmail.com'}, Website : {companyProfile.website || 'www.zsbaquatics.com'}
                </span>
              </div>
            </div>

            {/* Validation Alert Banner */}
            {validationAttempted && !validation.isValid && (
              <div
                role="alert"
                data-testid="exporter-payment-validation-alert"
                className="bg-rose-50 border-b-2 border-rose-300 px-4 py-3 text-xs text-rose-900 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold uppercase tracking-wide text-rose-800">
                      Please resolve the following {validation.errors.length} validation{' '}
                      {validation.errors.length === 1 ? 'issue' : 'issues'} before saving:
                    </div>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-rose-700 font-medium">
                      {validation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationAttempted(false)}
                  aria-label="Dismiss validation errors"
                  className="text-rose-500 hover:text-rose-800 p-1 rounded cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Row 1: Voucher Number, Shipping Mark, Buyer Contact ("Settlement date" Deleted) */}
            <div className="p-3.5 bg-teal-50/50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label
                  htmlFor="exporter-payment-voucher"
                  className="font-bold text-slate-800 uppercase block mb-1"
                >
                  VOUCHER NUMBER <span className="text-rose-600">*</span>
                </label>
                <input
                  id="exporter-payment-voucher"
                  type="text"
                  aria-invalid={
                    validationAttempted && Boolean(validation.fieldErrors.invoiceNumber)
                  }
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={`w-full bg-white border rounded-lg px-2.5 py-1.5 font-mono font-bold text-teal-950 focus:outline-none focus:ring-2 ${
                    validationAttempted && validation.fieldErrors.invoiceNumber
                      ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-teal-600'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="exporter-mark-select"
                    className="font-bold text-slate-800 uppercase"
                  >
                    SHIPPING MARK <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewMark(true)}
                    className="text-[10px] text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer"
                  >
                    + Add Mark
                  </button>
                </div>
                <select
                  id="exporter-mark-select"
                  aria-invalid={
                    validationAttempted && Boolean(validation.fieldErrors.shippingMark)
                  }
                  value={shippingMark}
                  onChange={(e) => handleSelectShippingMark(e.target.value)}
                  className={`w-full bg-white border rounded-lg px-2 py-1.5 font-black text-blue-950 focus:outline-none focus:ring-2 ${
                    validationAttempted && validation.fieldErrors.shippingMark
                      ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-teal-600'
                  }`}
                >
                  <option value="ALL">ALL MARKS ({packings.length})</option>
                  {dropdownOptions.shippingMarks.map((mk) => (
                    <option key={mk} value={mk}>
                      {mk}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="exporter-payment-contact"
                  className="font-bold text-slate-800 uppercase block mb-1"
                >
                  BUYER / AGENT CONTACT:
                </label>
                <input
                  id="exporter-payment-contact"
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+86-138..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Quick Add Shipping Mark Inline Bar */}
            {isAddingNewMark && (
              <div className="p-3 bg-teal-50 border-b border-teal-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-teal-950">Add Exporter Shipping Mark:</span>
                <input
                  type="text"
                  placeholder="e.g. GZ-99 or SHANGHAI BUYER..."
                  value={newMarkValue}
                  onChange={(e) => setNewMarkValue(e.target.value)}
                  className="bg-white border border-teal-300 rounded px-2.5 py-1 text-slate-800 font-medium flex-1 max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newMarkValue.trim()) {
                      addDropdownItem('shippingMarks', newMarkValue.trim());
                      setShippingMark(newMarkValue.trim());
                      setNewMarkValue('');
                      setIsAddingNewMark(false);
                    }
                  }}
                  className="px-3 py-1 bg-teal-700 text-white rounded font-bold hover:bg-teal-800 cursor-pointer"
                >
                  Save Mark
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewMark(false)}
                  className="px-2 py-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Row 2: Export Goods Doc Ref Bar ("EXPORTER STATUS (REPORT, NO REPORT, PAID)" Deleted) */}
            <div className="p-3.5 bg-amber-50/80 border-b border-amber-200 grid grid-cols-1 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="exporter-doc-ref-select"
                    className="font-bold text-slate-800 uppercase"
                  >
                    EXPORT GOODS DOC REF
                  </label>
                  <span className="text-[10px] font-semibold text-teal-800">
                    Auto-syncs Packing DB
                  </span>
                </div>
                <select
                  id="exporter-doc-ref-select"
                  aria-label="Select Export Packing List Manifest"
                  value={
                    packings.some((pk) => pk.invoiceNumber === exportGoodsRef)
                      ? exportGoodsRef
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectManifestRef(e.target.value);
                    } else {
                      setExportGoodsRef('');
                    }
                  }}
                  className="w-full bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 font-mono font-bold text-teal-950 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">-- Select Packing Manifest --</option>
                  {packings.map((pk) => (
                    <option key={pk.id} value={pk.invoiceNumber}>
                      {pk.invoiceNumber} — {pk.shippingMark} ({pk.totalBox} Box / {pk.totalWeight} KG)
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-600 mt-1 truncate">
                  Active Ref:{' '}
                  <strong className="font-mono text-slate-900">
                    {exportGoodsRef || 'All Exporter History Loaded'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Table Action Bar */}
            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Coins className="w-3.5 h-3.5 text-[#126b62]" />
                <span className="font-bold text-slate-700 uppercase">
                  All Exporter Record History — Debit, Credit, Balance &amp; Status ({activeRowCount} Active / {rows.length} Rows)
                </span>
                <span
                  data-testid="exporter-history-sync-status"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold"
                  title={
                    lastSyncEvent
                      ? `Last synchronized at ${new Date(lastSyncEvent.timestamp).toLocaleTimeString()}`
                      : 'Automated synchronization active'
                  }
                >
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  <span>
                    Auto-Sync Active
                    {lastSyncEvent?.invoiceNumber ? ` · ${lastSyncEvent.invoiceNumber}` : ''}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="confirm-exporter-payment-entry-btn"
                  onClick={handleConfirmExporterEntry}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded font-bold text-[11px] transition cursor-pointer shadow-xs"
                  title="Confirm current payment entry and synchronize record history running balance"
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>Confirm Entry &amp; Sync</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded font-bold text-[11px] transition cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-teal-700" />
                  <span>Add Blank Row</span>
                </button>
              </div>
            </div>

            {/* Data Entry & Record History Table Grid */}
            <div className="p-2.5 bg-slate-50/70">
              <div
                data-testid="exporter-payment-history-scroll-box"
                className="overflow-x-auto border-2 border-teal-200 rounded-lg bg-white"
              >
              <table
                data-testid="exporter-payment-history-table"
                className="w-full border-collapse text-xs"
              >
                <thead>
                  <tr className="bg-[#126b62] text-white uppercase text-[11px] font-bold tracking-wider text-center border-b border-teal-950">
                    <th className="px-2 py-2.5 border-r border-teal-800/60 w-9">SL</th>
                    <th className="px-3 py-2.5 border-r border-teal-800/60 text-left min-w-[200px]">
                      RECORD HISTORY / SHIPMENT PARTICULARS (MARK &amp; DATE)
                    </th>
                    <th className="px-2 py-2.5 border-r border-teal-800/60 w-24">
                      DEBIT (RMB)
                    </th>
                    <th className="px-2 py-2.5 border-r border-teal-800/60 w-24">
                      CREDIT (RMB)
                    </th>
                    <th className="px-2 py-2.5 border-r border-teal-800/60 w-24">
                      BALANCE (RMB)
                    </th>
                    <th className="px-2 py-2.5 border-r border-teal-800/60 w-28 min-w-[98px]">
                      STATUS (PAID / UNPAID)
                    </th>
                    <th className="px-2 py-2.5 border-r border-teal-800/60 w-16 text-center">
                      EDIT
                    </th>
                    <th className="px-2 py-2.5 w-16 text-center">
                      DELETE
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((row, idx) => {
                    const rowErr = validationAttempted
                      ? validation.rowErrors[row.id]
                      : undefined;
                    const highlightFirstEmptyRow =
                      validationAttempted &&
                      Boolean(validation.fieldErrors.rows) &&
                      idx === 0;
                    const rowStatus = row.status === 'PAID' ? 'PAID' : 'UNPAID';
                    const isRowEditing = editingRowId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className={
                          isRowEditing
                            ? 'bg-amber-50/90 ring-1 ring-inset ring-teal-600'
                            : rowErr || highlightFirstEmptyRow
                            ? 'bg-rose-50/60 hover:bg-rose-50'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-teal-50/30'
                            : 'bg-slate-50/70 hover:bg-teal-50/30'
                        }
                      >
                        <td className="p-1.5 border-r border-slate-200 text-center">
                          <span className="zsb-sl-badge">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>

                        {/* Description Input */}
                        <td className="p-1 border-r border-slate-200">
                          <div className="flex flex-col gap-0.5">
                            {row.date && (
                              <div className="flex items-center gap-1.5 px-1 text-[10px] font-mono text-slate-500">
                                <span className="font-bold text-teal-900">
                                  {row.shippingMark}
                                </span>
                                <span>·</span>
                                <span>Packing Date: {formatDate(row.date)}</span>
                              </div>
                            )}
                            <input
                              id={`exporter-row-desc-${row.id}`}
                              type="text"
                              aria-label={`Exporter payment row ${idx + 1} particulars`}
                              aria-invalid={Boolean(
                                rowErr?.description || highlightFirstEmptyRow
                              )}
                              value={row.description}
                              onChange={(e) =>
                                handleRowChange(row, 'description', e.target.value)
                              }
                              placeholder="e.g. AAD - Export shipment settlement..."
                              className={`w-full border rounded px-2 py-1 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 ${
                                isRowEditing
                                  ? 'bg-white border-teal-600 ring-1 ring-teal-500'
                                  : rowErr?.description || highlightFirstEmptyRow
                                  ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                  : 'bg-slate-50 border-slate-200 focus:ring-teal-600'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Debit Amount */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            aria-label={`Exporter payment row ${idx + 1} debit amount`}
                            aria-invalid={Boolean(
                              rowErr?.debitAmount || highlightFirstEmptyRow
                            )}
                            min="0"
                            step="0.01"
                            value={row.debitAmount || ''}
                            onChange={(e) =>
                              handleRowChange(
                                row,
                                'debitAmount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full bg-white border rounded px-2 py-1.5 text-right font-mono text-slate-900 font-semibold focus:outline-none focus:ring-1 ${
                              isRowEditing
                                ? 'border-teal-600 ring-1 ring-teal-500'
                                : rowErr?.debitAmount || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-teal-600'
                            }`}
                            placeholder="0.00"
                          />
                        </td>

                        {/* Credit Amount */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            aria-label={`Exporter payment row ${idx + 1} credit amount`}
                            aria-invalid={Boolean(
                              rowErr?.creditAmount || highlightFirstEmptyRow
                            )}
                            min="0"
                            step="0.01"
                            value={row.creditAmount || ''}
                            onChange={(e) =>
                              handleRowChange(
                                row,
                                'creditAmount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full bg-white border rounded px-2 py-1.5 text-right font-mono text-emerald-800 font-semibold focus:outline-none focus:ring-1 ${
                              isRowEditing
                                ? 'border-teal-600 ring-1 ring-teal-500'
                                : rowErr?.creditAmount || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-teal-600'
                            }`}
                            placeholder="0.00"
                          />
                        </td>

                        {/* Row Balance */}
                        <td className="p-1 border-r border-slate-200 text-right font-mono font-bold text-slate-900 pr-2.5 bg-slate-50">
                          {row.balance.toFixed(2)}
                        </td>

                        {/* Status Column (PAID, UNPAID) */}
                        <td className="p-1 border-r border-slate-200 text-center">
                          <select
                            aria-label={`Exporter payment row ${idx + 1} status`}
                            value={rowStatus}
                            onChange={(e) =>
                              handleRowChange(row, 'status', e.target.value)
                            }
                            className={`w-full text-center text-[11px] font-black uppercase rounded px-1.5 py-1.5 border cursor-pointer focus:outline-none ${
                              rowStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-rose-100 text-rose-900 border-rose-300'
                            }`}
                          >
                            {statusOptions.map((st) => (
                              <option key={st} value={st} className="bg-white text-slate-900">
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Edit Row Column */}
                        <td className="p-1 border-r border-slate-200 text-center">
                          <button
                            type="button"
                            data-testid={`edit-exporter-row-${idx + 1}`}
                            onClick={() => handleEditRow(row, idx)}
                            title={
                              isRowEditing
                                ? `Save Exporter row ${idx + 1}`
                                : `Edit Exporter row ${idx + 1}`
                            }
                            aria-label={
                              isRowEditing
                                ? `Save Exporter row ${idx + 1}`
                                : `Edit Exporter row ${idx + 1}`
                            }
                            className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded font-bold text-[10px] border transition cursor-pointer ${
                              isRowEditing
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                                : 'bg-teal-50 hover:bg-teal-600 text-teal-800 hover:text-white border-teal-200'
                            }`}
                          >
                            {isRowEditing ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Save</span>
                              </>
                            ) : (
                              <>
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Delete Row Column */}
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            data-testid={`delete-exporter-row-${idx + 1}`}
                            onClick={() => handleDeleteRow(row, idx)}
                            title={`Delete Exporter row ${idx + 1}`}
                            aria-label={`Delete Exporter row ${idx + 1}`}
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded font-bold text-[10px] transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Subtotals & Review Totals Footer */}
                <tfoot data-testid="exporter-payment-history-footer">
                  <tr
                    data-testid="exporter-history-summary-footer-row"
                    className="bg-[#126b62] text-white font-black border-t-2 border-teal-950"
                  >
                    <td
                      colSpan={2}
                      className="px-3 py-2.5 text-left uppercase tracking-wider text-xs border-r border-teal-800/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span>TOTAL EXPORTER RECORD HISTORY (RMB)</span>
                        <span className="text-[10px] font-mono bg-teal-950/80 text-teal-100 px-1.5 py-0.5 rounded">
                          Outstanding Balance = Debit − Credit
                        </span>
                      </div>
                    </td>
                    <td
                      data-testid="exporter-history-footer-total-debit"
                      className="px-2.5 py-2.5 text-right font-mono text-amber-300 font-black text-sm border-r border-teal-800/60"
                    >
                      <div className="text-[9px] font-sans uppercase text-teal-100 font-bold leading-none mb-0.5">
                        Total Debit (RMB)
                      </div>
                      {totalDebit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      data-testid="exporter-history-footer-total-paid"
                      className="px-2.5 py-2.5 text-right font-mono text-emerald-200 font-black text-sm border-r border-teal-800/60 bg-teal-800/70"
                    >
                      <div className="text-[9px] font-sans uppercase text-emerald-200 font-bold leading-none mb-0.5">
                        Total Paid (Credit)
                      </div>
                      {totalCredit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      data-testid="exporter-history-footer-outstanding-balance"
                      className="px-2.5 py-2.5 text-right font-mono text-amber-300 font-black text-sm border-r border-teal-800/60 bg-teal-900/80"
                    >
                      <div className="text-[9px] font-sans uppercase text-amber-200 font-bold leading-none mb-0.5">
                        Outstanding Balance
                      </div>
                      {filteredOutstandingBalance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      colSpan={3}
                      className="px-2 py-2.5 text-center font-mono text-[10px] text-teal-100 bg-teal-950/50"
                    >
                      <div className="font-bold text-white">
                        {activeRowCount} Active / {rows.length} Filtered Rows
                      </div>
                      <div>
                        {historyTotals.paidCount} PAID ·{' '}
                        {historyTotals.reportCount + historyTotals.noReportCount} UNPAID
                      </div>
                    </td>
                  </tr>

                  {/* Review Section */}
                  <tr className="bg-amber-100/70 text-slate-800 font-bold border-t border-amber-300">
                    <td
                      colSpan={2}
                      rowSpan={3}
                      className="px-3 py-2 text-center uppercase font-black tracking-widest text-[#126b62] border-r border-amber-300"
                    >
                      EXPORTER BALANCE REVIEW
                    </td>
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-bold text-slate-700"
                    >
                      TOTAL DEBIT / INVOICED (RMB):
                    </td>
                    <td colSpan={4} className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Exporter Previous Amount"
                        value={overallPreviousAmount || totalDebit || ''}
                        onChange={(e) =>
                          setOverallPreviousAmount(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className="w-full bg-white border border-amber-400 rounded px-2 py-1 text-right font-mono font-bold text-slate-800"
                      />
                    </td>
                  </tr>
                  <tr className="bg-amber-100/70 text-slate-800 font-bold">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-bold text-slate-700"
                    >
                      TOTAL CREDIT / PAID (RMB):
                    </td>
                    <td colSpan={4} className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Exporter Paid Amount"
                        value={overallPaidAmount || totalCredit || ''}
                        onChange={(e) =>
                          setOverallPaidAmount(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className="w-full bg-white border border-amber-400 rounded px-2 py-1 text-right font-mono font-bold text-emerald-800"
                      />
                    </td>
                  </tr>
                  <tr className="bg-amber-200 text-slate-900 font-black border-t border-amber-300">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-extrabold uppercase text-[#126b62]"
                    >
                      OUTSTANDING EXPORTER BALANCE (RMB):
                    </td>
                    <td
                      colSpan={4}
                      className="px-2 py-1.5 text-right font-mono text-base text-rose-800 pr-3"
                    >
                      {balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>

            {/* Remarks */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center space-x-2 text-xs">
              <span className="font-bold text-slate-700 uppercase">Exporter Remarks:</span>
              <input
                type="text"
                placeholder="e.g. Guangzhou buyer TT remittance, WeChat/Alipay RMB slip reference..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Right: ACTION BUTTONS, EXPORTER SEARCH, SYSTEM FLOW (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Action Buttons Container */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ACTION BUTTONS (EXPORTER VOUCHER)
            </div>

            {/* SAVE (PDF) Button - Emerald Green */}
            <button
              type="button"
              onClick={handleSavePDF}
              title="Save Exporter Payment Voucher (Shortcut: Ctrl+S)"
              className="w-full bg-[#129c54] hover:bg-[#0e8346] text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>SAVE (PDF)</span>
              <span className="text-[10px] font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded text-amber-200">
                Ctrl+S
              </span>
            </button>

            {/* OPEN EXPORTER PAYMENT SLIP (付款单) Button - Plum/Gold */}
            <button
              type="button"
              onClick={() => setActiveTab('exporter_payment_slip')}
              className="w-full bg-[#98486f] hover:bg-[#7d3859] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-amber-300" />
              <span>EXPORTER PAYMENT SLIP (付款单)</span>
            </button>

            {/* MONTHLY STATEMENT (PDF) Button */}
            <button
              type="button"
              onClick={handleMonthlyStatement}
              className="w-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>MONTHLY STATEMENT (PDF)</span>
            </button>

            {/* SEARCH Button */}
            <button
              type="button"
              onClick={() => setActiveTab('payment_db')}
              className="w-full bg-[#1b73b4] hover:bg-[#165f95] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>SEARCH PAYMENT DB</span>
            </button>

            {/* CLEAR Button */}
            <button
              type="button"
              onClick={handleClear}
              title="Reset form fields (Shortcut: Alt+R)"
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>CLEAR</span>
              <span className="text-[10px] font-mono bg-red-950/60 px-1.5 py-0.5 rounded text-amber-200">
                Alt+R
              </span>
            </button>

            {/* PRINT (Selected Cells) Button */}
            <button
              type="button"
              onClick={handlePrintSelected}
              title="Open Print / PDF Preview (Shortcut: Ctrl+P)"
              className="w-full bg-[#0891b2] hover:bg-[#0e7490] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>PRINT (Selected Cells)</span>
              <span className="text-[10px] font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded text-amber-200">
                Ctrl+P
              </span>
            </button>
          </div>

          {/* SEARCH EXPORTER VOUCHERS Box */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              SEARCH EXPORTER VOUCHERS
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search mark (AAD, CHJ-22) or PKG..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => {
                  setActiveTab('payment_db');
                  showToast(`Opening Payment DB for Mark: "${searchQuery || effectiveShippingMarkForSave}"`);
                }}
                className="bg-[#126b62] hover:bg-[#0e524b] text-white px-3 py-1.5 rounded font-bold text-xs uppercase shadow flex items-center space-x-1 transition cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>DB</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">
                Recent Exporter Vouchers ({matchingExporterVouchers.length})
              </div>
              {matchingExporterVouchers.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">
                  No matching exporter vouchers found.
                </div>
              ) : (
                matchingExporterVouchers.map((pm) => (
                  <div
                    key={pm.id}
                    className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50/40 flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <div className="font-mono font-bold text-teal-950">
                        {pm.invoiceNumber} ·{' '}
                        <span className="font-sans text-blue-900">{pm.description}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatDate(pm.date)} · RMB:{' '}
                        <strong className="text-amber-700">
                          {formatRMB(pm.returnRMB)}
                        </strong>{' '}
                        · <span className="font-bold">{pm.status}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openPrintModal({
                          type: 'payment',
                          title: `Exporter Payment Voucher - ${pm.invoiceNumber}`,
                          data: pm,
                          items: pm.items,
                        })
                      }
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-bold text-teal-800 hover:bg-teal-100 flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Flow Diagram */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              EXPORTER RECORD FLOW
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-teal-200 bg-teal-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-teal-700 text-white flex items-center justify-center shrink-0">
                  <Plane className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-teal-950">1. Automatic Database Lookup</div>
                  <div className="text-[11px] text-slate-500">
                    Select Shipping Mark &amp; Packing Date to filter history
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-amber-600 text-white flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-amber-950">2. Debit, Credit, Balance &amp; Status</div>
                  <div className="text-[11px] text-slate-500">
                    Track RMB Debit/Credit/Balance &amp; Status (Report, No Report, Paid)
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-purple-700 text-white flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-purple-950">
                    3. Sync Payment DB &amp; Slip (付款单)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Updates Exporter Payment Slip automatically
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exporter Record Image View Modal */}
      <ExporterRecordImageModal
        isOpen={Boolean(selectedImageRowPayload)}
        onClose={() => setSelectedImageRowPayload(null)}
        payload={selectedImageRowPayload}
      />
    </div>
  );
};
