import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  calculatePaymentRow,
  calculatePaymentTotals,
  generateInvoiceNumber,
  formatCurrency,
  formatDate,
  getSupplierPaymentStats,
  classifyPaymentCategory,
} from '../utils/calculations.ts';
import {
  SUPPLIER_CREDIT_REASONS,
  calculateSupplierCreditSummary,
  getSupplierCreditProfile,
} from '../utils/supplierCredits.ts';
import {
  SUPPLIER_STATUS_OPTIONS,
  SupplierRecordHistoryRow,
  buildSupplierRecordHistory,
  calculateSupplierHistoryTotals,
  normalizeSupplierStatus,
} from '../utils/supplierHistory.ts';
import {
  PaymentItemRow,
  RecurrenceFrequency,
  SupplierCreditRecord,
  ExporterStatus,
} from '../types/index.ts';
import { initialSupplierPaymentSheetRows } from '../context/initialData.ts';
import { validateSupplierPaymentForm } from '../utils/validation.ts';
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
  Printer,
  Plus,
  Layers,
  Database,
  UserCheck,
  ArrowRight,
  RotateCcw,
  Eye,
  Wallet,
  AlertCircle,
  X,
  BadgePercent,
  CheckCircle2,
  CheckCircle,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  Tag,
  Receipt,
} from 'lucide-react';

export const PaymentFormView: React.FC = () => {
  const {
    companyProfile,
    dropdownOptions,
    addDropdownItem,
    purchases,
    updatePurchase,
    deletePurchase,
    payments,
    addPayment,
    updatePayment,
    deletePayment,
    supplierCredits,
    addSupplierCredit,
    applySupplierCredit,
    applySupplierCreditsForPayment,
    deleteSupplierCredit,
    openPrintModal,
    setActiveTab,
    showToast,
  } = useApp();

  const supplierPayments = useMemo(
    () => payments.filter((pm) => classifyPaymentCategory(pm) === 'supplier'),
    [payments]
  );

  // Invoice & Top Fields
  const nextInvoiceNo = generateInvoiceNumber('PAY', supplierPayments.length);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(nextInvoiceNo);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly');
  const [supplierName, setSupplierName] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [voucherStatus, setVoucherStatus] = useState<ExporterStatus>('PAID');

  // Supplier Record History Filters (Debit, Credit, Balance & Status: Paid, Report, No Report)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyRecordType, setHistoryRecordType] = useState<string>('ALL');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(true);

  const createEmptyRow = (id: string): PaymentItemRow => ({
    id,
    description: '',
    debitAmount: 0,
    creditAmount: 0,
    balance: 0,
    status: 'PAID',
  });

  const getSupplierBgStyle = (name: string): string => {
    const norm = (name || '').trim().toUpperCase();
    if (norm.includes('MAMUN') || norm.includes('ABDULLAH')) return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    if (norm.includes('NURUL')) return 'bg-teal-800 text-white border-teal-900 font-extrabold';
    if (norm.includes('TONMOY')) return 'bg-pink-100 text-pink-900 border-pink-300 font-bold';
    if (norm.includes('PROTAP')) return 'bg-orange-100 text-orange-900 border-orange-300 font-bold';
    if (norm.includes('NAPAL')) return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    if (norm.includes('NOZRUL')) return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
    return 'bg-purple-50 text-purple-900 border-purple-200 font-bold';
  };

  const [customRows, setCustomRows] = useState<PaymentItemRow[]>(() => {
    try {
      localStorage.removeItem('zsb_supplier_sheet_custom_rows_v3');
      const saved = localStorage.getItem('zsb_supplier_sheet_custom_rows_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return initialSupplierPaymentSheetRows;
    } catch {
      return initialSupplierPaymentSheetRows;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('zsb_supplier_sheet_custom_rows_v4', JSON.stringify(customRows));
    } catch {
      // ignore
    }
  }, [customRows]);

  const [rowEdits, setRowEdits] = useState<Record<string, Partial<PaymentItemRow>>>({});
  const [historySyncRevision, setHistorySyncRevision] = useState<number>(0);
  const [lastSyncEvent, setLastSyncEvent] = useState<PaymentSyncEventDetail | null>(
    null
  );

  // Automated synchronization listener: refreshes 'All Supplier Record History' whenever a payment entry is confirmed
  useEffect(() => {
    const handlePaymentSync = (event: Event) => {
      const customEvent = event as CustomEvent<PaymentSyncEventDetail>;
      const detail = customEvent.detail;
      setHistorySyncRevision((prev) => prev + 1);
      if (detail) {
        setLastSyncEvent(detail);
      }
      // Clear any transient row edits that have now been persisted to the database
      setRowEdits({});
    };

    window.addEventListener(ZSB_PAYMENT_ENTRY_CONFIRMED_EVENT, handlePaymentSync);
    return () => {
      window.removeEventListener(ZSB_PAYMENT_ENTRY_CONFIRMED_EVENT, handlePaymentSync);
    };
  }, []);

  // Overall footer summary inputs (empty / 0 by default)
  const [overallPreviousAmount, setOverallPreviousAmount] = useState<number>(0);
  const [overallPaidAmount, setOverallPaidAmount] = useState<number>(0);

  // Search input by supplier description
  const [searchDescription, setSearchDescription] = useState<string>('');

  // Quick inline add supplier & payment mode modals
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState<boolean>(false);
  const [newSupplierValue, setNewSupplierValue] = useState<string>('');
  const [isAddingPaymentMode, setIsAddingPaymentMode] = useState<boolean>(false);
  const [newPaymentModeValue, setNewPaymentModeValue] = useState<string>('');
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);

  // Supplier Credit Note inline form & session tracking
  const [isAddingCreditNote, setIsAddingCreditNote] = useState<boolean>(false);
  const [newCreditSupplier, setNewCreditSupplier] = useState<string>('');
  const [newCreditAmount, setNewCreditAmount] = useState<string>('');
  const [newCreditReason, setNewCreditReason] = useState<string>(
    SUPPLIER_CREDIT_REASONS[0]
  );
  const [newCreditRefInvoice, setNewCreditRefInvoice] = useState<string>('');
  const [newCreditRemarks, setNewCreditRemarks] = useState<string>('');
  const [appliedCreditIdsInVoucher, setAppliedCreditIdsInVoucher] = useState<
    string[]
  >([]);

  // All distinct supplier names from Dropdown Options + Purchase DB + Payment DB + Credit Notes
  const availableSuppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of dropdownOptions.suppliers) {
      if (s && s.trim()) map.set(s.trim().toLowerCase(), s.trim());
    }
    for (const p of purchases) {
      if (p.description && p.description.trim()) {
        const key = p.description.trim().toLowerCase();
        if (!map.has(key)) map.set(key, p.description.trim());
      }
    }
    for (const pm of supplierPayments) {
      if (pm.description && pm.description.trim()) {
        const key = pm.description.trim().toLowerCase();
        if (!map.has(key)) map.set(key, pm.description.trim());
      }
    }
    for (const cn of supplierCredits) {
      if (cn.supplierName && cn.supplierName.trim()) {
        const key = cn.supplierName.trim().toLowerCase();
        if (!map.has(key)) map.set(key, cn.supplierName.trim());
      }
    }
    return Array.from(map.values());
  }, [dropdownOptions.suppliers, purchases, supplierPayments, supplierCredits]);

  // Comprehensive Supplier Payment Details & Transaction History (Debit, Credit, Balance & Status)
  const supplierRecordHistory = useMemo(
    () =>
      buildSupplierRecordHistory(purchases, payments, supplierCredits, {
        supplierName: supplierName || 'ALL',
        status: historyStatusFilter,
        search: historySearch,
        recordType: historyRecordType,
      }),
    [
      purchases,
      payments,
      supplierCredits,
      supplierName,
      historyStatusFilter,
      historySearch,
      historyRecordType,
      historySyncRevision,
    ]
  );

  const supplierHistoryTotals = useMemo(
    () => calculateSupplierHistoryTotals(supplierRecordHistory),
    [supplierRecordHistory]
  );

  // Date-by-date supplier purchase & payment details rows from Purchase Database + Supplier Payment Vouchers + Credit Notes
  const dbSupplierRows: PaymentItemRow[] = useMemo(() => {
    const target = (supplierName || '').trim().toLowerCase();
    const isMatch = (name?: string) => {
      if (!target || target === 'all') return true;
      const n = (name || '').trim().toLowerCase();
      return n === target || n.includes(target) || target.includes(n);
    };

    const collected: PaymentItemRow[] = [];

    // 1. Purchase Consignment Bills (with item details, weight, invoice, date)
    for (const pur of purchases) {
      if (!isMatch(pur.description)) continue;
      const rowId = `pur-${pur.id}`;
      const edit = rowEdits[rowId];
      const baseDebit = Math.round((Number(pur.totalAmount) || 0) * 100) / 100;
      const baseCredit = Math.round((Number(pur.paidAmount) || 0) * 100) / 100;
      const debitAmount = edit?.debitAmount !== undefined ? edit.debitAmount : baseDebit;
      const creditAmount = edit?.creditAmount !== undefined ? edit.creditAmount : baseCredit;
      const dueBal = debitAmount - creditAmount;
      const itemSummary =
        Array.isArray(pur.items) && pur.items.length > 0
          ? pur.items
              .filter((it) => it.item || it.quantity > 0)
              .map((it) => `${it.item || 'Fish'}: ${it.quantity}KG @${it.rate}`)
              .join(', ')
          : `${pur.totalQty || 0} KG`;
      const baseDesc = `${pur.description} — ${pur.invoiceNumber} (${pur.totalQty || 0} KG${itemSummary ? ` · ${itemSummary}` : ''}${pur.remarks ? ` · ${pur.remarks}` : ''})`;

      collected.push({
        id: rowId,
        date: edit?.date !== undefined ? edit.date : pur.date,
        description: edit?.description !== undefined ? edit.description : baseDesc,
        debitAmount,
        creditAmount,
        balance: dueBal,
        status: edit?.status !== undefined ? edit.status : dueBal <= 0 && debitAmount > 0 ? 'PAID' : 'UNPAID',
      });
    }

    // 2. Supplier Payment Vouchers
    for (const pm of supplierPayments) {
      if (!isMatch(pm.description)) continue;
      if (pm.id.startsWith('pay-sync-')) continue;
      const rowId = `pay-${pm.id}`;
      const edit = rowEdits[rowId];
      const standaloneItems = Array.isArray(pm.items)
        ? pm.items.filter(
            (i) =>
              !String(i.id || '').startsWith('pur-') &&
              !String(i.id || '').startsWith('pay-') &&
              !String(i.id || '').startsWith('cn-')
          )
        : [];
      const standaloneDebit = standaloneItems.reduce(
        (s, i) => s + (Number(i.debitAmount) || 0),
        0
      );
      const standaloneCredit = standaloneItems.reduce(
        (s, i) => s + (Number(i.creditAmount) || 0),
        0
      );
      const baseDebit = !pm.exportGoodsRef
        ? Math.round(
            (standaloneDebit > 0 ? standaloneDebit : Number(pm.totalAmount) || 0) * 100
          ) / 100
        : 0;
      const baseCredit =
        Math.round(
          (Number(pm.paidAmount) || standaloneCredit || 0) * 100
        ) / 100;
      const debitAmount = edit?.debitAmount !== undefined ? edit.debitAmount : baseDebit;
      const creditAmount = edit?.creditAmount !== undefined ? edit.creditAmount : baseCredit;
      const dueBal = debitAmount - creditAmount;
      const baseDesc = `${pm.description} — Voucher ${pm.invoiceNumber}${pm.remarks ? ` (${pm.remarks})` : ''}`;

      collected.push({
        id: rowId,
        paymentId: pm.id,
        date: edit?.date !== undefined ? edit.date : pm.date,
        description: edit?.description !== undefined ? edit.description : baseDesc,
        debitAmount,
        creditAmount,
        balance: dueBal,
        status: edit?.status !== undefined ? edit.status : dueBal <= 0 && (creditAmount > 0 || debitAmount > 0) ? 'PAID' : 'UNPAID',
      });
    }

    // 3. Supplier Credit Notes / Rebates
    for (const cn of supplierCredits) {
      if (!isMatch(cn.supplierName)) continue;
      const rowId = `cn-${cn.id}`;
      const edit = rowEdits[rowId];
      const baseDebit = 0;
      const baseCredit = Math.round((Number(cn.amount) || 0) * 100) / 100;
      const debitAmount = edit?.debitAmount !== undefined ? edit.debitAmount : baseDebit;
      const creditAmount = edit?.creditAmount !== undefined ? edit.creditAmount : baseCredit;
      const dueBal = debitAmount - creditAmount;
      const baseDesc = `${cn.supplierName} — Credit Note ${cn.creditNoteNumber} (${cn.reason}${cn.refPurchaseInvoice ? ` · Ref: ${cn.refPurchaseInvoice}` : ''})`;

      collected.push({
        id: rowId,
        date: edit?.date !== undefined ? edit.date : cn.date,
        description: edit?.description !== undefined ? edit.description : baseDesc,
        debitAmount,
        creditAmount,
        balance: dueBal,
        status: edit?.status !== undefined ? edit.status : 'PAID',
      });
    }

    collected.sort((a, b) => {
      const dDiff = (b.date || '').localeCompare(a.date || '');
      if (dDiff !== 0) return dDiff;
      return (b.description || '').localeCompare(a.description || '');
    });

    return collected;
  }, [
    purchases,
    supplierPayments,
    supplierCredits,
    supplierName,
    rowEdits,
    historySyncRevision,
  ]);

  const rows: PaymentItemRow[] = useMemo(() => {
    const merged = [...customRows, ...dbSupplierRows];
    if (merged.length > 0) return merged;
    if (supplierName && supplierName.trim()) {
      return [
        {
          ...createEmptyRow('1'),
          date,
          description: `${supplierName} — Opening / New Entry`,
        },
      ];
    }
    return [
      { ...createEmptyRow('1'), date },
      { ...createEmptyRow('2'), date },
      { ...createEmptyRow('3'), date },
    ];
  }, [dbSupplierRows, customRows, supplierName, date]);

  // Per-row Balance Formula: Balance = DEBIT AMOUNT - CREDIT AMOUNT (matching user spreadsheet image)
  const rowsWithCumulativeBalance = useMemo(() => {
    return rows.map((r) => {
      const d = Number(r.debitAmount) || 0;
      const c = Number(r.creditAmount) || 0;
      const hasAmounts = d > 0 || c > 0;
      return {
        ...r,
        description: hasAmounts
          ? r.description?.trim() || supplierName || 'Supplier Payment'
          : '',
        balance: Math.round((d - c) * 100) / 100,
      };
    });
  }, [rows, supplierName]);

  const validation = validateSupplierPaymentForm({
    invoiceNumber,
    date,
    supplierName,
    overallPreviousAmount,
    overallPaidAmount,
    rows: rowsWithCumulativeBalance,
  });

  // Live Supplier Ledger Stats from Purchases + Supplier Payments
  const supplierStats = useMemo(
    () => getSupplierPaymentStats(purchases, payments, supplierName),
    [purchases, payments, supplierName]
  );

  // Supplier Credit Summary & Selected Supplier Profile
  const creditSummary = useMemo(
    () => calculateSupplierCreditSummary(supplierCredits, purchases),
    [supplierCredits, purchases]
  );

  const selectedSupplierCreditProfile = useMemo(
    () => getSupplierCreditProfile(supplierCredits, supplierName),
    [supplierCredits, supplierName]
  );

  const visibleCreditNotes = useMemo(() => {
    const list = supplierName.trim()
      ? selectedSupplierCreditProfile.allCreditNotes
      : supplierCredits;
    return [...list].sort((a, b) => {
      if (a.remainingAmount > 0 && b.remainingAmount === 0) return -1;
      if (a.remainingAmount === 0 && b.remainingAmount > 0) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [supplierName, selectedSupplierCreditProfile, supplierCredits]);

  const handleSupplierChange = (selectedSupplier: string) => {
    setSupplierName(selectedSupplier);
    setNewCreditSupplier(selectedSupplier);
    setCustomRows([]);
    setRowEdits({});
    const stats = getSupplierPaymentStats(purchases, payments, selectedSupplier);
    if (stats.latestContactNumber) {
      setContactNumber(stats.latestContactNumber);
    } else {
      setContactNumber('');
    }
    setOverallPreviousAmount(0);
  };

  const handleCreateSupplierCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSupplier = (newCreditSupplier || supplierName).trim();
    const amt = parseFloat(newCreditAmount);
    if (!targetSupplier) {
      showToast('Please select a supplier for the credit note.');
      return;
    }
    if (!amt || amt <= 0) {
      showToast('Please enter a valid positive credit note amount.');
      return;
    }

    const created = addSupplierCredit({
      date,
      supplierName: targetSupplier,
      amount: amt,
      reason: newCreditReason,
      refPurchaseInvoice: newCreditRefInvoice.trim() || undefined,
      remarks: newCreditRemarks.trim() || undefined,
    });

    if (!supplierName) {
      handleSupplierChange(created.supplierName);
    }
    setNewCreditAmount('');
    setNewCreditRefInvoice('');
    setNewCreditRemarks('');
    setIsAddingCreditNote(false);
  };

  const handleApplyCreditNoteToVoucher = (cn: SupplierCreditRecord) => {
    const applyAmt = cn.remainingAmount;
    if (applyAmt <= 0) {
      showToast(`Credit note ${cn.creditNoteNumber} is already fully applied.`);
      return;
    }

    if (!supplierName || supplierName.toUpperCase() !== cn.supplierName.toUpperCase()) {
      handleSupplierChange(cn.supplierName);
      const stats = getSupplierPaymentStats(purchases, payments, cn.supplierName);
      if (overallPreviousAmount === 0 && stats.latestBalance > 0) {
        setOverallPreviousAmount(stats.latestBalance);
      }
    } else if (overallPreviousAmount === 0 && supplierStats.latestBalance > 0) {
      setOverallPreviousAmount(supplierStats.latestBalance);
    }

    const creditDescription = `SUPPLIER CREDIT NOTE (${cn.creditNoteNumber} - ${cn.reason})`;

    setCustomRows((prev) => [
      ...prev,
      {
        id: generateRecordId('payrow'),
        date,
        description: creditDescription,
        debitAmount: 0,
        creditAmount: applyAmt,
        balance: calculatePaymentRow(0, applyAmt),
        status: 'PAID',
      },
    ]);

    applySupplierCredit(cn.id, {
      amount: applyAmt,
      date,
      targetPaymentInvoice: invoiceNumber,
      targetPurchaseInvoice: cn.refPurchaseInvoice,
      notes: `Applied to Supplier Payment Voucher ${invoiceNumber}`,
    });

    setAppliedCreditIdsInVoucher((prev) =>
      prev.includes(cn.id) ? prev : [...prev, cn.id]
    );

    setRemarks((prev) =>
      prev.includes(cn.creditNoteNumber)
        ? prev
        : prev
        ? `${prev} | Applied ${cn.creditNoteNumber} (${formatCurrency(applyAmt, companyProfile.currency)})`
        : `Applied Credit Note ${cn.creditNoteNumber} (${formatCurrency(applyAmt, companyProfile.currency)})`
    );
  };

  const handleRowChange = (
    id: string,
    field: keyof PaymentItemRow,
    value: string | number
  ) => {
    if (id.startsWith('pur-') || id.startsWith('pay-') || id.startsWith('cn-')) {
      setRowEdits((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value,
        },
      }));
      if (id.startsWith('pur-') && field === 'creditAmount') {
        const purId = id.replace(/^pur-/, '');
        const foundPur = purchases.find((p) => p.id === purId);
        if (foundPur) {
          const nextCredit = Math.max(0, Number(value) || 0);
          updatePurchase(purId, {
            paidAmount: nextCredit,
            balance: Math.round((Number(foundPur.totalAmount || 0) - nextCredit) * 100) / 100,
          });
        }
      }
    } else {
      setCustomRows((prev) => {
        const baseList =
          prev.length === 0 && dbSupplierRows.length === 0
            ? supplierName && supplierName.trim()
              ? [
                  {
                    ...createEmptyRow('1'),
                    date,
                    description: `${supplierName} — Opening / New Entry`,
                  },
                ]
              : [
                  { ...createEmptyRow('1'), date },
                  { ...createEmptyRow('2'), date },
                  { ...createEmptyRow('3'), date },
                ]
            : prev;
        return baseList.map((row) => {
          if (row.id !== id) return row;
          const updated = { ...row, [field]: value };

          const d = field === 'debitAmount' ? Number(value) : row.debitAmount;
          const c = field === 'creditAmount' ? Number(value) : row.creditAmount;
          if ((d > 0 || c > 0) && !updated.description.trim()) {
            updated.description = supplierName || 'Supplier Purchase Goods';
          }
          updated.balance = d - c;

          return updated;
        });
      });
    }
  };

  const handleClearRow = (id: string) => {
    if (id.startsWith('pur-') || id.startsWith('pay-') || id.startsWith('cn-')) {
      setRowEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setCustomRows((prev) =>
        prev.map((row) => (row.id === id ? createEmptyRow(id) : row))
      );
    }
  };

  const handleDeleteRow = (id: string) => {
    if (id.startsWith('pur-') || id.startsWith('purchase-')) {
      const targetId = id.replace(/^(pur-|purchase-)/, '');
      deletePurchase(targetId);
      setRowEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else if (id.startsWith('pay-') || id.startsWith('voucher-')) {
      const targetId = id.replace(/^(pay-|voucher-)/, '');
      deletePayment(targetId);
      setRowEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else if (id.startsWith('cn-') || id.startsWith('credit-')) {
      const targetId = id.replace(/^(cn-|credit-)/, '');
      deleteSupplierCredit(targetId);
      setRowEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setCustomRows((prev) => {
        const baseList =
          prev.length === 0 && dbSupplierRows.length === 0
            ? rows
            : prev;
        const filtered = baseList.filter((row) => row.id !== id);
        if (filtered.length === 0 && dbSupplierRows.length === 0) {
          return [{ ...createEmptyRow(generateRecordId('payrow')), date }];
        }
        return filtered;
      });
      showToast('Row deleted from Supplier Record History table.');
    }
  };

  const handleAddRow = () => {
    setCustomRows((prev) => [
      ...prev,
      {
        ...createEmptyRow(generateRecordId('payrow')),
        date,
        description: '',
      },
    ]);
  };

  const resetFormFields = () => {
    setSupplierName('');
    setContactNumber('');
    setRemarks('');
    setSearchDescription('');
    setOverallPreviousAmount(0);
    setOverallPaidAmount(0);
    setDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setIsRecurring(false);
    setRecurrenceFrequency('monthly');
    setVoucherStatus('PAID');
    setCustomRows(initialSupplierPaymentSheetRows);
    setRowEdits({});
    setAppliedCreditIdsInVoucher([]);
    setValidationAttempted(false);
  };

  const handleClear = () => {
    resetFormFields();
    showToast('Supplier payment form cleared and all cells reset.');
  };

  const { totalDebit, totalCredit } = calculatePaymentTotals(
    rowsWithCumulativeBalance,
    0,
    overallPaidAmount
  );

  // Total Voucher Credit (TK) = sum of row Credit Amounts (or overallPaidAmount if entered)
  const effectivePaidAmount = Math.round((totalCredit > 0 ? totalCredit : overallPaidAmount) * 100) / 100;
  // Balance (TK) = Total Debit - Total Voucher Credit (TK)
  const voucherBalance = Math.round((totalDebit - effectivePaidAmount) * 100) / 100;

  const activeRowCount = rowsWithCumulativeBalance.filter(
    (r) => r.debitAmount !== 0 || r.creditAmount !== 0
  ).length;

  const commitSupplierPaymentEntry = (options?: { openPreview?: boolean }) => {
    const shouldOpenPreview = options?.openPreview ?? true;
    const effectiveSupplier = supplierName.trim() || 'GENERAL SUPPLIER';

    // Flush any inline edits made to existing Purchase or Payment rows first
    for (const [editRowId, editPatch] of Object.entries(rowEdits)) {
      if (editRowId.startsWith('pur-')) {
        const purId = editRowId.replace(/^pur-/, '');
        const foundPur = purchases.find((p) => p.id === purId);
        if (foundPur) {
          const nextDebit =
            editPatch.debitAmount !== undefined
              ? Math.max(0, Number(editPatch.debitAmount) || 0)
              : Number(foundPur.totalAmount) || 0;
          const nextCredit =
            editPatch.creditAmount !== undefined
              ? Math.max(0, Number(editPatch.creditAmount) || 0)
              : Number(foundPur.paidAmount) || 0;
          updatePurchase(purId, {
            date: editPatch.date !== undefined ? editPatch.date : foundPur.date,
            totalAmount: nextDebit,
            paidAmount: nextCredit,
            balance: Math.round((nextDebit - nextCredit) * 100) / 100,
          });
        }
      } else if (editRowId.startsWith('pay-')) {
        const payId = editRowId.replace(/^pay-/, '');
        const foundPay = payments.find((p) => p.id === payId);
        if (foundPay) {
          const nextDebit =
            editPatch.debitAmount !== undefined
              ? Math.max(0, Number(editPatch.debitAmount) || 0)
              : Number(foundPay.totalAmount) || 0;
          const nextCredit =
            editPatch.creditAmount !== undefined
              ? Math.max(0, Number(editPatch.creditAmount) || 0)
              : Number(foundPay.paidAmount) || 0;
          updatePayment(payId, {
            date: editPatch.date !== undefined ? editPatch.date : foundPay.date,
            totalAmount: nextDebit,
            paidAmount: nextCredit,
            balance: Math.round((nextDebit - nextCredit) * 100) / 100,
          });
        }
      }
    }

    const check = validateSupplierPaymentForm({
      invoiceNumber,
      date,
      supplierName: options?.openPreview === false ? effectiveSupplier : supplierName,
      overallPreviousAmount: 0,
      overallPaidAmount: effectivePaidAmount,
      rows: rowsWithCumulativeBalance,
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

    // Separate newly entered custom rows from already-persisted DB rows so existing history rows are never double-counted
    const newCustomItems = validItems.filter(
      (item) =>
        !String(item.id || '').startsWith('pur-') &&
        !String(item.id || '').startsWith('pay-') &&
        !String(item.id || '').startsWith('cn-')
    );

    const newCustomDebit =
      Math.round(
        newCustomItems.reduce((s, r) => s + (Number(r.debitAmount) || 0), 0) * 100
      ) / 100;
    const newCustomCredit =
      Math.round(
        newCustomItems.reduce((s, r) => s + (Number(r.creditAmount) || 0), 0) * 100
      ) / 100;

    // If the user manually entered a credit/rebate amount in the voucher rows without already clicking "Apply Credit"
    if (
      newCustomCredit > 0 &&
      appliedCreditIdsInVoucher.length === 0 &&
      selectedSupplierCreditProfile.availableBalance > 0
    ) {
      applySupplierCreditsForPayment(effectiveSupplier, newCustomCredit, {
        date,
        targetPaymentInvoice: invoiceNumber.trim(),
        notes: `Auto-applied via Supplier Payment Voucher ${invoiceNumber.trim()}`,
      });
    }

    // Only create a new PaymentRecord when there are new custom entry rows (or when there were no DB rows yet)
    const shouldCreateVoucherRecord =
      newCustomItems.length > 0 || dbSupplierRows.length === 0;

    const recordItems =
      newCustomItems.length > 0 ? newCustomItems : validItems;
    const recordDebit =
      newCustomItems.length > 0 ? newCustomDebit : totalDebit;
    const recordPaid =
      newCustomItems.length > 0
        ? newCustomCredit > 0
          ? newCustomCredit
          : overallPaidAmount
        : effectivePaidAmount;
    const recordBalance =
      Math.round((recordDebit - recordPaid) * 100) / 100;

    const newRecord = {
      invoiceNumber: invoiceNumber.trim(),
      date: recordItems[0]?.date || date,
      dueDate: dueDate || undefined,
      isRecurring: isRecurring || Boolean(dueDate),
      recurrenceFrequency: isRecurring || dueDate ? recurrenceFrequency : undefined,
      description: effectiveSupplier,
      contactNumber,
      items: recordItems,
      totalAmount: recordDebit,
      previousAmount: 0,
      paidAmount: recordPaid,
      balance: recordBalance,
      status: voucherStatus,
      returnRMB: 0,
      returnRMBInBDT: 0,
      exportGoodsRef: '',
      paymentCategory: 'supplier' as const,
      remarks,
    };

    if (shouldCreateVoucherRecord) {
      addPayment(newRecord);
      setInvoiceNumber(generateInvoiceNumber('PAY', supplierPayments.length + 1));
    } else {
      emitPaymentSyncTrigger({
        category: 'supplier',
        action: 'confirm',
        invoiceNumber: newRecord.invoiceNumber,
        partyName: effectiveSupplier,
        debitAmount: totalDebit,
        creditAmount: effectivePaidAmount,
        runningBalance: voucherBalance,
      });
    }

    // Clear draft custom rows and rowEdits so 'All Supplier Record History' refreshes directly from the synchronized database
    setCustomRows([]);
    setRowEdits({});
    setOverallPreviousAmount(0);
    setOverallPaidAmount(0);
    setAppliedCreditIdsInVoucher([]);

    if (shouldOpenPreview) {
      openPrintModal({
        type: 'payment',
        title: `Supplier Payment Voucher - ${newRecord.invoiceNumber}`,
        data: {
          ...newRecord,
          items: validItems,
          totalAmount: totalDebit,
          paidAmount: effectivePaidAmount,
          balance: voucherBalance,
        },
        items: validItems,
      });
      setSupplierName('');
      setContactNumber('');
      setRemarks('');
      setSearchDescription('');
      setDueDate('');
      setIsRecurring(false);
      setRecurrenceFrequency('monthly');
      setVoucherStatus('PAID');
      showToast(
        `Supplier payment voucher ${newRecord.invoiceNumber} confirmed and synchronized with All Supplier Record History.`
      );
    } else {
      showToast(
        `Payment entry ${newRecord.invoiceNumber} confirmed! All Supplier Record History and Net Running Balance updated.`
      );
    }
  };

  const handleSavePDF = () => {
    commitSupplierPaymentEntry({ openPreview: true });
  };

  const handleConfirmPaymentEntry = () => {
    commitSupplierPaymentEntry({ openPreview: false });
  };

  const handlePrintSelected = () => {
    const validItems = rowsWithCumulativeBalance.filter(
      (r) => r.debitAmount > 0 || r.creditAmount > 0
    );
    openPrintModal({
      type: 'payment',
      title: `Supplier Payment Voucher (Preview) - ${invoiceNumber}`,
      data: {
        invoiceNumber,
        date,
        description: supplierName,
        contactNumber,
        items: validItems.length > 0 ? validItems : rowsWithCumulativeBalance.slice(0, 5),
        totalAmount: totalDebit,
        previousAmount: 0,
        paidAmount: effectivePaidAmount,
        balance: voucherBalance,
        status: voucherStatus,
        returnRMB: 0,
        returnRMBInBDT: 0,
        exportGoodsRef: '',
        paymentCategory: 'supplier',
        remarks,
      },
      items: validItems.length > 0 ? validItems : rowsWithCumulativeBalance.slice(0, 5),
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
        showToast('Added new line item row to Supplier Payment Voucher (Alt+N).');
      } else if (action === 'RESET_FORM') {
        customEvent.detail.handled = true;
        handleClear();
      }
    };

    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
  });

  const handleMonthlyStatement = () => {
    const matched = supplierPayments.filter((p) =>
      p.description.toLowerCase().includes(supplierName.toLowerCase())
    );
    openPrintModal({
      type: 'monthly_statement',
      title: `Supplier Monthly Payment Statement - ${supplierName}`,
      data: {
        party: supplierName,
        date,
        records: matched,
        totalRecords: matched.length,
      },
    });
  };

  const matchingSupplierVouchers = useMemo(() => {
    const query = (searchDescription || supplierName || '').trim().toLowerCase();
    if (!query) return supplierPayments.slice(0, 4);
    return supplierPayments
      .filter(
        (pm) =>
          pm.description.toLowerCase().includes(query) ||
          pm.invoiceNumber.toLowerCase().includes(query)
      )
      .slice(0, 4);
  }, [supplierPayments, searchDescription, supplierName]);

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-5">
      {/* Top Banner (Sheet #4 - Dedicated Supplier Payment) */}
      <div className="bg-[#242b58] text-white px-5 py-3 rounded-lg shadow-md flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
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
              Supplier Payment Data Entry Form – Local Fish Suppliers (DEBIT, CREDIT, BALANCE &amp; STATUS)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('exporter_payment_form')}
            className="text-xs bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 px-3 py-1 rounded border border-teal-400/40 font-bold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <span>Exporter Payment Sheet (#5)</span>
          </button>
          <span className="text-xs bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded border border-amber-400/40 font-mono">
            Sheet #4
          </span>
        </div>
      </div>

      {/* Automatic Supplier Database Lookup (Select Supplier Name) */}
      <div
        data-testid="supplier-form-auto-lookup-card"
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#8b3858]" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              Automatic Supplier Database Lookup (Select Supplier Name)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-0.5 rounded font-bold">
              Showing {rows.length} Record{rows.length === 1 ? '' : 's'} ({supplierHistoryTotals.paidCount} PAID · {supplierHistoryTotals.reportCount + supplierHistoryTotals.noReportCount} UNPAID)
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Show All History ({purchases.length})</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs">
          {/* 1. Select Supplier Name */}
          <div>
            <label
              htmlFor="supplier-lookup-name-select"
              className="flex items-center justify-between font-black uppercase text-slate-700 mb-1"
            >
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#8b3858]" />
                <span>Select Supplier Name</span>
              </span>
              <span className="text-[10px] text-purple-700 font-bold">Auto-Lookup</span>
            </label>
            <select
              id="supplier-lookup-name-select"
              value={supplierName}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="w-full bg-purple-50/50 border-2 border-purple-600/40 rounded-lg px-2.5 py-1.5 font-black text-sm text-slate-950 focus:bg-white focus:border-purple-700 focus:outline-none"
            >
              <option value="">ALL LOCAL FISH SUPPLIERS ({purchases.length})</option>
              {availableSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Left (8 Cols), Action Buttons & Supplier Search Right (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: The Dedicated Supplier Payment Excel Sheet (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl shadow-md border-2 border-slate-300 overflow-hidden">
            {/* Plum / Maroon Sheet Header Box */}
            <div className="bg-[#8b3858] text-white py-3 px-4 text-center border-b border-pink-900 shadow-inner space-y-1.5">
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
              <div className="text-xs sm:text-sm font-bold tracking-wider uppercase text-pink-100">
                SUPPLIER PAYMENT DATA ENTRY FORM – LOCAL FISH SUPPLIERS (DEBIT, CREDIT, BALANCE &amp; STATUS)
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
                data-testid="supplier-payment-validation-alert"
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

            {/* Top Supplier Metadata Fields Row (3 Columns) */}
            <div className="p-3.5 bg-amber-50/60 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label
                  htmlFor="supplier-payment-invoice"
                  className="font-bold text-slate-800 uppercase block mb-1"
                >
                  INVOICE NUMBER <span className="text-rose-600">*</span>
                </label>
                <input
                  id="supplier-payment-invoice"
                  type="text"
                  aria-invalid={
                    validationAttempted && Boolean(validation.fieldErrors.invoiceNumber)
                  }
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={`w-full bg-white border rounded-lg px-2.5 py-1.5 font-mono font-bold text-purple-900 focus:outline-none focus:ring-2 ${
                    validationAttempted && validation.fieldErrors.invoiceNumber
                      ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-purple-500'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="supplier-payment-select"
                    className="font-bold text-slate-800 uppercase"
                  >
                    SUPPLIER NAME <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewSupplier(true)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                  >
                    + Add Supplier
                  </button>
                </div>
                <select
                  id="supplier-payment-select"
                  aria-invalid={
                    validationAttempted && Boolean(validation.fieldErrors.supplierName)
                  }
                  value={supplierName}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className={`w-full bg-white border rounded-lg px-2 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 ${
                    validationAttempted && validation.fieldErrors.supplierName
                      ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-purple-500'
                  }`}
                >
                  <option value="">-- Select Supplier Name --</option>
                  {availableSuppliers.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="supplier-payment-contact"
                  className="font-bold text-slate-800 uppercase block mb-1"
                >
                  CONTACT NUMBER:
                </label>
                <input
                  id="supplier-payment-contact"
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+8801..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>



            {/* Quick Add Supplier Inline Bar */}
            {isAddingNewSupplier && (
              <div className="p-3 bg-purple-50 border-b border-purple-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-purple-900">Add Local Fish Supplier:</span>
                <input
                  type="text"
                  placeholder="e.g. HASAN VAI..."
                  value={newSupplierValue}
                  onChange={(e) => setNewSupplierValue(e.target.value)}
                  className="bg-white border border-purple-300 rounded px-2.5 py-1 text-slate-800 font-medium flex-1 max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newSupplierValue.trim()) {
                      addDropdownItem('suppliers', newSupplierValue.trim());
                      addDropdownItem('paymentDescriptions', newSupplierValue.trim());
                      setSupplierName(newSupplierValue.trim());
                      setNewSupplierValue('');
                      setIsAddingNewSupplier(false);
                    }
                  }}
                  className="px-3 py-1 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 cursor-pointer"
                >
                  Save Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewSupplier(false)}
                  className="px-2 py-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Table Action Bar */}
            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-[#8b3858]" />
                <span className="font-bold text-slate-700 uppercase">
                  All Supplier Record History — Debit, Credit, Balance &amp; Status ({activeRowCount} Active / {rows.length} Rows)
                </span>
                <span
                  data-testid="supplier-history-sync-status"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold"
                  title={
                    lastSyncEvent
                      ? `Last synchronized at ${new Date(lastSyncEvent.timestamp).toLocaleTimeString()}`
                      : 'Automated synchronization active'
                  }
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>
                    Auto-Sync Active
                    {lastSyncEvent?.invoiceNumber ? ` · ${lastSyncEvent.invoiceNumber}` : ''}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="confirm-supplier-payment-entry-btn"
                  onClick={handleConfirmPaymentEntry}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded font-bold text-[11px] transition cursor-pointer shadow-xs"
                  title="Confirm current payment entry and synchronize All Supplier Record History running balance"
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>Confirm Entry &amp; Sync</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded font-bold text-[11px] transition cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-purple-700" />
                  <span>Add Blank Row</span>
                </button>
              </div>
            </div>

            {/* Quick Add Payment Mode Inline Bar */}
            {isAddingPaymentMode && (
              <div className="p-3 bg-purple-50 border-b border-purple-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-purple-950">Add Payment Particulars / Mode:</span>
                <input
                  type="text"
                  placeholder="e.g. BKASH / MOBILE BANKING or CASH (OFFICE)..."
                  value={newPaymentModeValue}
                  onChange={(e) => setNewPaymentModeValue(e.target.value)}
                  className="bg-white border border-purple-300 rounded px-2.5 py-1 text-slate-800 font-medium flex-1 min-w-[180px] max-w-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newPaymentModeValue.trim()) {
                      const val = newPaymentModeValue.trim().toUpperCase();
                      addDropdownItem('paymentDescriptions', val);
                      setNewPaymentModeValue('');
                      setIsAddingPaymentMode(false);
                      showToast(`Added "${val}" to payment dropdown options.`);
                    }
                  }}
                  className="px-3 py-1 bg-purple-700 text-white rounded font-bold hover:bg-purple-800 cursor-pointer"
                >
                  Save Mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPaymentMode(false);
                    setNewPaymentModeValue('');
                  }}
                  className="px-2 py-1 text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Data Entry & Record History Table Grid */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200">
              <div
                data-testid="supplier-payment-history-scroll-box"
                className="overflow-x-auto border-2 border-purple-200 rounded-lg bg-white"
              >
                <table
                  data-testid="supplier-payment-history-table"
                  className="w-full border-collapse text-xs table-fixed"
                >
                  <thead>
                    <tr className="bg-[#1d4ed8] text-white uppercase text-[11px] font-black tracking-wider text-center border-b border-blue-900">
                      <th className="px-2 py-2.5 border-r border-blue-700/60 w-12">SL</th>
                      <th className="px-2.5 py-2.5 border-r border-blue-700/60 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <span>DATE</span>
                          <Filter className="w-3 h-3 text-blue-200" />
                        </span>
                      </th>
                      <th className="px-2.5 py-2.5 border-r border-blue-700/60 w-36 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <span>DEBIT AMOUNT</span>
                          <Filter className="w-3 h-3 text-blue-200" />
                        </span>
                      </th>
                      <th className="px-2.5 py-2.5 border-r border-blue-700/60 w-36 text-right bg-blue-800/80">
                        <span className="flex items-center justify-end gap-1">
                          <span>CREDIT AMOUNT</span>
                          <Filter className="w-3 h-3 text-blue-200" />
                        </span>
                      </th>
                      <th className="px-2.5 py-2.5 border-r border-blue-700/60 w-36 bg-blue-900 text-right">
                        BALANCE
                      </th>
                      <th className="px-2 py-2.5 w-16 bg-blue-950 text-center">
                        DELETE
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rowsWithCumulativeBalance.map((row, idx) => {
                      const rowErr = validationAttempted
                        ? validation.rowErrors[row.id]
                        : undefined;
                      const highlightFirstEmptyRow =
                        validationAttempted &&
                        Boolean(validation.fieldErrors.rows) &&
                        idx === 0;
                      return (
                        <tr
                          key={row.id}
                          className={
                            rowErr || highlightFirstEmptyRow
                              ? 'bg-rose-50/60 hover:bg-rose-50 h-10'
                              : idx % 2 === 0
                              ? 'bg-white hover:bg-blue-50/30 h-10'
                              : 'bg-slate-50/70 hover:bg-blue-50/30 h-10'
                          }
                        >
                          <td className="p-1.5 border-r border-slate-200 text-center w-12">
                            <span className="zsb-sl-badge">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </td>

                          {/* Editable Date */}
                          <td className="p-1 border-r border-slate-200 text-center">
                            <input
                              type="text"
                              aria-label={`Supplier payment row ${idx + 1} date`}
                              value={row.date || date}
                              onChange={(e) =>
                                handleRowChange(row.id, 'date', e.target.value)
                              }
                              className="w-full font-mono text-xs text-center font-bold text-slate-800 bg-transparent border border-slate-200 hover:border-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-1"
                            />
                          </td>

                          {/* Debit Amount */}
                          <td className="p-1 border-r border-slate-200 w-36 text-right font-mono font-bold">
                            {row.paymentId ? (
                              <span className="text-slate-400 font-normal px-2 block text-center">-</span>
                            ) : (
                              <input
                                type="number"
                                aria-label={`Supplier payment row ${idx + 1} debit amount`}
                                aria-invalid={Boolean(
                                  rowErr?.debitAmount || highlightFirstEmptyRow
                                )}
                                min="0"
                                step="0.01"
                                value={row.debitAmount || ''}
                                onChange={(e) =>
                                  handleRowChange(
                                    row.id,
                                    'debitAmount',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className={`w-full bg-white border rounded px-2 py-1 text-right font-mono text-slate-900 font-bold focus:outline-none focus:ring-1 ${
                                  rowErr?.debitAmount || highlightFirstEmptyRow
                                    ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                                placeholder="0.00"
                              />
                            )}
                          </td>

                          {/* Credit Amount */}
                          <td className="p-1 border-r border-slate-200 w-36">
                            <input
                              type="number"
                              aria-label={`Supplier payment row ${idx + 1} credit amount`}
                              aria-invalid={Boolean(
                                rowErr?.creditAmount || highlightFirstEmptyRow
                              )}
                              min="0"
                              step="0.01"
                              value={row.creditAmount || ''}
                              onChange={(e) => {
                                const nextCredit = Math.max(0, parseFloat(e.target.value) || 0);
                                if (row.paymentId) {
                                  updatePayment(row.paymentId, {
                                    paidAmount: nextCredit,
                                    balance: Math.max(0, row.debitAmount - nextCredit),
                                  });
                                }
                                handleRowChange(
                                  row.id,
                                  'creditAmount',
                                  nextCredit
                                );
                              }}
                              className={`w-full bg-emerald-50/80 hover:bg-white focus:bg-white border rounded px-2 py-1 text-right font-mono text-emerald-900 font-bold focus:outline-none focus:ring-1 ${
                                rowErr?.creditAmount || highlightFirstEmptyRow
                                  ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                  : 'border-emerald-300 focus:ring-emerald-600'
                              }`}
                              placeholder="0.00"
                            />
                          </td>

                          {/* Balance */}
                          <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold pr-2.5 bg-slate-50/90 w-36">
                            <span className={row.balance < 0 ? 'text-rose-600 font-black' : 'text-slate-900 font-bold'}>
                              {formatCurrency(row.balance, '')}
                            </span>
                          </td>

                          {/* Delete Row Column */}
                          <td className="p-1 text-center w-16">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              aria-label={`Delete supplier payment row ${idx + 1}`}
                              title="Delete this row"
                              className="inline-flex items-center justify-center p-1.5 rounded bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot data-testid="supplier-payment-history-footer">
                    <tr
                      data-testid="supplier-history-summary-footer-row"
                      className="bg-[#1d4ed8] text-white font-black border-t-2 border-blue-900"
                    >
                      <td
                        colSpan={2}
                        className="px-3 py-2.5 text-left uppercase tracking-wider text-xs border-r border-blue-700/60"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span>Total Supplier Record History</span>
                          <span className="text-[10px] font-mono bg-blue-900/80 text-blue-100 px-1.5 py-0.5 rounded">
                            Net Running Balance = Debit − Credit
                          </span>
                        </div>
                      </td>
                      <td
                        data-testid="supplier-history-footer-total-debit"
                        className="px-2.5 py-2.5 text-right font-mono text-white font-black text-sm w-36 border-r border-blue-700/60"
                      >
                        <div className="text-[9px] font-sans uppercase text-blue-200 font-bold leading-none mb-0.5">
                          Total Debit
                        </div>
                        {totalDebit.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        data-testid="supplier-history-footer-total-credit"
                        className="px-2.5 py-2.5 text-right font-mono text-emerald-200 font-black text-sm w-36 border-r border-blue-700/60 bg-blue-800/80"
                      >
                        <div className="text-[9px] font-sans uppercase text-emerald-200 font-bold leading-none mb-0.5">
                          Total Credit
                        </div>
                        {effectivePaidAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        data-testid="supplier-history-footer-running-balance"
                        className="px-2.5 py-2.5 text-right font-mono text-amber-200 font-black text-sm w-36 border-r border-blue-700/60 bg-blue-900"
                      >
                        <div className="text-[9px] font-sans uppercase text-amber-200 font-bold leading-none mb-0.5">
                          Net Running Balance
                        </div>
                        {voucherBalance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="w-16 bg-blue-950 text-center font-mono text-[10px] text-blue-200">
                        {activeRowCount} Rows
                      </td>
                    </tr>
                    <tr className="bg-slate-900 text-white font-black border-t border-slate-700">
                      <td
                        colSpan={2}
                        className="px-3 py-1.5 text-left uppercase tracking-wider text-[11px] text-slate-300 border-r border-slate-800"
                      >
                        SUPPLIER PAYMENT VOUCHER SUMMARY
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-slate-200 text-xs w-36 border-r border-slate-800">
                        Debit: {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-emerald-300 text-xs w-36 border-r border-slate-800">
                        Total Voucher Credit (TK): {effectivePaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-amber-300 text-xs w-36 border-r border-slate-800">
                        Balance (TK): {voucherBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="w-16 bg-slate-950" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right: ACTION BUTTONS, SUPPLIER SEARCH, SYSTEM FLOW (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Action Buttons Container */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ACTION BUTTONS (SUPPLIER VOUCHER)
            </div>

            {/* SAVE (PDF) Button - Emerald Green */}
            <button
              type="button"
              onClick={handleSavePDF}
              title="Save Supplier Payment Voucher (Shortcut: Ctrl+S)"
              className="w-full bg-[#129c54] hover:bg-[#0e8346] text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>SAVE (PDF)</span>
              <span className="text-[10px] font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded text-amber-200">
                Ctrl+S
              </span>
            </button>

            {/* MONTHLY STATEMENT (PDF) Button - Violet/Purple */}
            <button
              type="button"
              onClick={handleMonthlyStatement}
              className="w-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>MONTHLY STATEMENT (PDF)</span>
            </button>

            {/* SEARCH Button - Royal Blue */}
            <button
              type="button"
              onClick={() => setActiveTab('payment_db')}
              className="w-full bg-[#1b73b4] hover:bg-[#165f95] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>SEARCH PAYMENT DB</span>
            </button>

            {/* CLEAR Button - Red */}
            <button
              type="button"
              onClick={handleClear}
              title="Clear form fields (Shortcut: Alt+R)"
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>CLEAR</span>
              <span className="text-[10px] font-mono bg-red-950/60 px-1.5 py-0.5 rounded text-amber-200">
                Alt+R
              </span>
            </button>

            {/* PRINT (Selected Cells) Button - Cyan */}
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

          {/* SEARCH BY SUPPLIER Box with Live Voucher History */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              SEARCH SUPPLIER VOUCHERS
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search supplier name or PAY no..."
                value={searchDescription}
                onChange={(e) => setSearchDescription(e.target.value)}
                className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => {
                  setActiveTab('payment_db');
                  showToast(`Opening Payment DB for: "${searchDescription || supplierName}"`);
                }}
                className="bg-[#3b5998] hover:bg-[#2d4373] text-white px-3 py-1.5 rounded font-bold text-xs uppercase shadow flex items-center space-x-1 transition cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>DB</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">
                Recent Supplier Vouchers ({matchingSupplierVouchers.length})
              </div>
              {matchingSupplierVouchers.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">
                  No matching supplier vouchers found.
                </div>
              ) : (
                matchingSupplierVouchers.map((pm) => {
                  const itemsDebit = Array.isArray(pm.items)
                    ? pm.items.reduce((s, i) => s + (Number(i.debitAmount) || 0), 0)
                    : 0;
                  const itemsCredit = Array.isArray(pm.items)
                    ? pm.items.reduce((s, i) => s + (Number(i.creditAmount) || 0), 0)
                    : 0;
                  const pmDebit = Number(pm.totalAmount) || itemsDebit || 0;
                  const pmCredit = Number(pm.paidAmount) || itemsCredit || 0;
                  const pmBal =
                    pm.balance !== 0
                      ? Number(pm.balance)
                      : Math.round((pmDebit - pmCredit) * 100) / 100;
                  const pmStatus = pm.status || (pmBal <= 0 ? 'PAID' : 'REPORT');
                  return (
                    <div
                      key={pm.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50/40 space-y-1.5 text-xs transition"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-mono font-bold text-purple-900 truncate">
                          {pm.invoiceNumber} · <span className="font-sans font-semibold text-slate-800">{pm.description}</span>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                            pmStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : pmStatus === 'REPORT'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}
                        >
                          {pmStatus}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono">
                        {formatDate(pm.date)}
                      </div>

                      {/* Explicit DEBIT, CREDIT, BALANCE details */}
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                        <div className="bg-white px-1.5 py-1 rounded border border-slate-200">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">DEBIT</span>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(pmDebit, companyProfile.currency)}
                          </span>
                        </div>
                        <div className="bg-white px-1.5 py-1 rounded border border-slate-200">
                          <span className="text-[9px] font-bold text-emerald-700 uppercase block">CREDIT</span>
                          <span className="font-bold text-emerald-700">
                            {formatCurrency(pmCredit, companyProfile.currency)}
                          </span>
                        </div>
                        <div className="bg-white px-1.5 py-1 rounded border border-slate-200">
                          <span className="text-[9px] font-bold text-rose-700 uppercase block">BALANCE</span>
                          <span className={`font-bold ${pmBal > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                            {formatCurrency(pmBal, companyProfile.currency)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            openPrintModal({
                              type: 'payment',
                              title: `Supplier Payment Voucher - ${pm.invoiceNumber}`,
                              data: pm,
                              items: pm.items,
                            })
                          }
                          className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-purple-800 hover:bg-purple-100 flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>PDF Voucher</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* System Flow Diagram */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              SUPPLIER PAYMENT WORKFLOW
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-purple-900">1. Select Local Supplier</div>
                  <div className="text-[11px] text-slate-500">
                    Auto-loads purchase history &amp; closing balance
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-blue-900">2. Record Cash / Bank Debit</div>
                  <div className="text-[11px] text-slate-500">
                    Calculates net closing balance in BDT ({companyProfile.currency})
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-emerald-900">3. Archive Supplier Voucher</div>
                  <div className="text-[11px] text-slate-500">
                    Saves to Payment DB &amp; clears form fields
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Automatic Supplier Database Lookup & Payment Details Records Table (DEBIT, CREDIT, BALANCE & STATUS) */}
      <div
        data-testid="supplier-payment-details-card"
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-0.5 rounded font-bold">
              Showing {supplierRecordHistory.length} Record{supplierRecordHistory.length === 1 ? '' : 's'} (
              <span className="text-emerald-700 font-extrabold">{supplierHistoryTotals.paidCount} PAID</span> ·{' '}
              <span className="text-rose-700 font-extrabold">{supplierHistoryTotals.reportCount + supplierHistoryTotals.noReportCount} UNPAID</span>)
            </span>
            <button
              type="button"
              onClick={() => setIsHistoryExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold cursor-pointer"
            >
              {isHistoryExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Expand ({supplierRecordHistory.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Metric Cards (DEBIT, CREDIT, BALANCE & STATUS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              TOTAL DEBIT (BILLS / DUE)
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-purple-950 mt-0.5">
              {formatCurrency(supplierHistoryTotals.totalDebit, companyProfile.currency)}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              {supplierHistoryTotals.purchaseCount} Purchase Bills
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-emerald-800 uppercase">
              TOTAL CREDIT (PAID / REBATE)
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-0.5">
              {formatCurrency(supplierHistoryTotals.totalCredit, companyProfile.currency)}
            </div>
            <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
              {supplierHistoryTotals.voucherCount} Vouchers · {supplierHistoryTotals.creditNoteCount} Rebates
            </div>
          </div>

          <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-rose-800 uppercase">
              OUTSTANDING BALANCE
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-rose-700 mt-0.5">
              {formatCurrency(supplierHistoryTotals.totalBalance, companyProfile.currency)}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              Net Supplier Balance
            </div>
          </div>

          <div className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-2.5 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-indigo-900 uppercase">
              OVERALL STATUS
            </div>
            <div className="mt-1">
              <span
                className={`inline-block px-2.5 py-1 text-xs font-black uppercase rounded border ${
                  supplierHistoryTotals.computedOverallStatus === 'PAID'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border-rose-300'
                }`}
              >
                {supplierHistoryTotals.computedOverallStatus === 'PAID' ? 'PAID' : 'UNPAID'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
              {supplierName ? supplierName : 'All Suppliers Combined'}
            </div>
          </div>
        </div>

        {/* Filter Bar: Supplier Select, Status Filter, Record Type, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs pt-1">
          <div>
            <label className="font-bold text-slate-700 uppercase block mb-1">
              Supplier Filter
            </label>
            <select
              value={supplierName}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">-- ALL LOCAL FISH SUPPLIERS --</option>
              {availableSuppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 uppercase block mb-1">
              Status (PAID / UNPAID)
            </label>
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">-- ALL STATUSES (PAID, UNPAID) --</option>
              <option value="PAID">PAID</option>
              <option value="UNPAID">UNPAID</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 uppercase block mb-1">
              Record Type
            </label>
            <select
              value={historyRecordType}
              onChange={(e) => setHistoryRecordType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Documents (Vouchers, Purchases, Rebates)</option>
              <option value="PAYMENT_VOUCHER">Payment Vouchers Only</option>
              <option value="PURCHASE_BILL">Purchase Bills Only</option>
              <option value="CREDIT_NOTE">Credit Notes &amp; Rebates</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 uppercase block mb-1">
              Search Invoice / Particulars
            </label>
            <input
              type="text"
              placeholder="Search PAY, INV, CN, notes..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Collapsible Table of Supplier Payment Details */}
        {isHistoryExpanded && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#242b58] text-white uppercase text-[11px] font-bold tracking-wider text-center border-b border-indigo-900">
                  <th className="px-2 py-2 border-r border-indigo-800/60 w-10">SL</th>
                  <th className="px-2.5 py-2 border-r border-indigo-800/60 w-24">DATE</th>
                  <th className="px-2.5 py-2 border-r border-indigo-800/60 w-32">DOC NO</th>
                  <th className="px-3 py-2 border-r border-indigo-800/60 text-left min-w-[200px]">
                    SUPPLIER &amp; PARTICULARS
                  </th>
                  <th className="px-2.5 py-2 border-r border-indigo-800/60 w-28 text-right">
                    DEBIT (TK)
                  </th>
                  <th className="px-2.5 py-2 border-r border-indigo-800/60 w-32 text-right bg-indigo-900/60">
                    CREDIT (TK) [EDITABLE]
                  </th>
                  <th className="px-2.5 py-2 border-r border-indigo-800/60 w-28 text-right">
                    BALANCE (TK)
                  </th>
                  <th className="px-2.5 py-2 border-r border-indigo-800/60 w-28 text-center">
                    STATUS
                  </th>
                  <th className="px-2 py-2 w-28 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {supplierRecordHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-slate-400 italic bg-slate-50/50"
                    >
                      No payment or purchase records found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  supplierRecordHistory.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={
                        idx % 2 === 0
                          ? 'bg-white hover:bg-purple-50/40'
                          : 'bg-slate-50/60 hover:bg-purple-50/40'
                      }
                    >
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 font-mono text-center text-slate-700 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-purple-950 whitespace-nowrap">
                        {row.invoiceNumber}
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <div className="font-bold text-slate-800">{row.supplierName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{row.description}</div>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                        {row.recordType === 'PAYMENT_VOUCHER' || row.paymentId ? (
                          <span className="text-slate-400 font-normal block text-center">-</span>
                        ) : row.debitAmount > 0 ? (
                          formatCurrency(row.debitAmount, '')
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-1 border-r border-slate-200 text-right font-mono font-bold text-emerald-800 w-32">
                        {row.recordType === 'PAYMENT_VOUCHER' || row.paymentId || row.recordType === 'PURCHASE_BILL' ? (
                          <input
                            type="number"
                            aria-label={`Credit amount for ${row.invoiceNumber}`}
                            min="0"
                            step="0.01"
                            value={row.creditAmount || ''}
                            onChange={(e) => {
                              const nextCredit = Math.max(0, parseFloat(e.target.value) || 0);
                              if (row.paymentId) {
                                updatePayment(row.paymentId, {
                                  paidAmount: nextCredit,
                                  balance: Math.round((row.debitAmount - nextCredit) * 100) / 100,
                                });
                                showToast(
                                  `Updated Payment Voucher ${row.invoiceNumber} Credit Amount to ${nextCredit.toLocaleString()}`
                                );
                              } else if (row.recordType === 'PURCHASE_BILL') {
                                const purId = row.id.replace(/^purchase-/, '');
                                updatePurchase(purId, {
                                  paidAmount: nextCredit,
                                  balance: Math.round((row.debitAmount - nextCredit) * 100) / 100,
                                });
                                showToast(
                                  `Updated Purchase ${row.invoiceNumber} Credit (Paid) Amount to ${nextCredit.toLocaleString()}`
                                );
                              } else {
                                handleRowChange(row.id, 'creditAmount', nextCredit);
                              }
                            }}
                            className="w-full bg-emerald-50/80 hover:bg-white focus:bg-white border border-emerald-300 focus:border-emerald-600 rounded px-1.5 py-1 text-right font-mono font-black text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="0.00"
                          />
                        ) : row.creditAmount > 0 ? (
                          formatCurrency(row.creditAmount, '')
                        ) : (
                          '-'
                        )}
                      </td>
                      <td
                        className={`p-1.5 border-r border-slate-200 text-right font-mono font-bold ${
                          row.balance > 0 ? 'text-rose-700' : 'text-slate-700'
                        }`}
                      >
                        {formatCurrency(row.balance, '')}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase rounded border ${
                            row.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : row.status === 'REPORT'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="p-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {row.recordType === 'PAYMENT_VOUCHER' && (
                            <button
                              type="button"
                              onClick={() => {
                                const found = payments.find((p) => p.invoiceNumber === row.invoiceNumber);
                                if (found) {
                                  openPrintModal({
                                    type: 'payment',
                                    title: `Supplier Payment Voucher - ${found.invoiceNumber}`,
                                    data: found,
                                    items: found.items,
                                  });
                                }
                              }}
                              className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded text-[10px] font-bold cursor-pointer"
                              title="Preview PDF"
                            >
                              PDF
                            </button>
                          )}
                          {row.recordType === 'PURCHASE_BILL' && (
                            <button
                              type="button"
                              onClick={() => {
                                const found = purchases.find((p) => p.invoiceNumber === row.invoiceNumber);
                                if (found) {
                                  openPrintModal({
                                    type: 'purchase',
                                    title: `Purchase Consignment Bill - ${found.invoiceNumber}`,
                                    data: found,
                                    items: found.items,
                                  });
                                }
                              }}
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded text-[10px] font-bold cursor-pointer"
                              title="Preview Purchase PDF"
                            >
                              PDF
                            </button>
                          )}
                          {row.balance > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSupplierName(row.supplierName);
                                setOverallPreviousAmount(row.balance);
                                showToast(
                                  `Applied ${row.supplierName}'s balance (${formatCurrency(
                                    row.balance,
                                    companyProfile.currency
                                  )}) to Previous Amount.`
                                );
                              }}
                              className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold cursor-pointer"
                              title="Apply balance to payment form"
                            >
                              Apply
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded transition-colors cursor-pointer"
                            title="Delete Row"
                            aria-label={`Delete detail row for ${row.supplierName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#242b58] text-white font-bold border-t-2 border-indigo-900">
                  <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wider text-[11px] border-r border-indigo-800/60">
                    TOTAL SUPPLIER RECORD HISTORY ({supplierRecordHistory.length} RECORDS) — NET RUNNING BALANCE:
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-amber-300 font-black text-xs border-r border-indigo-800/60">
                    {formatCurrency(supplierHistoryTotals.totalDebit, '')}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-emerald-300 font-bold text-xs border-r border-indigo-800/60">
                    {formatCurrency(supplierHistoryTotals.totalCredit, '')}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-rose-300 font-black text-xs border-r border-indigo-800/60">
                    {formatCurrency(supplierHistoryTotals.totalBalance, '')}
                  </td>
                  <td colSpan={2} className="px-2.5 py-2 text-center text-[10px] font-mono text-amber-200 font-bold">
                    {supplierHistoryTotals.paidCount} PAID · {supplierHistoryTotals.reportCount} REPORT · {supplierHistoryTotals.noReportCount} NO REPORT
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
