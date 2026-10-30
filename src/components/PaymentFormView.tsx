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
import { validateSupplierPaymentForm } from '../utils/validation.ts';
import { generateRecordId } from '../utils/idGenerator.ts';
import {
  ZSB_VIEW_SHORTCUT_EVENT,
  ViewShortcutEventDetail,
} from '../utils/keyboardShortcuts.ts';
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
    payments,
    addPayment,
    supplierCredits,
    addSupplierCredit,
    applySupplierCredit,
    applySupplierCreditsForPayment,
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

  const [rows, setRows] = useState<PaymentItemRow[]>([
    createEmptyRow('1'),
    createEmptyRow('2'),
    createEmptyRow('3'),
  ]);

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

  const validation = validateSupplierPaymentForm({
    invoiceNumber,
    date,
    supplierName,
    overallPreviousAmount,
    overallPaidAmount,
    rows,
  });

  // Live Supplier Ledger Stats from Purchases + Supplier Payments
  const supplierStats = useMemo(
    () => getSupplierPaymentStats(purchases, payments, supplierName),
    [purchases, payments, supplierName]
  );

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
    ]
  );

  const supplierHistoryTotals = useMemo(
    () => calculateSupplierHistoryTotals(supplierRecordHistory),
    [supplierRecordHistory]
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
    const stats = getSupplierPaymentStats(purchases, payments, selectedSupplier);
    if (stats.latestContactNumber) {
      setContactNumber(stats.latestContactNumber);
    }
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

    setRows((prev) => {
      const emptyIdx = prev.findIndex(
        (r) =>
          r.description.trim() === '' &&
          r.debitAmount === 0 &&
          r.creditAmount === 0
      );
      const newRow: PaymentItemRow = {
        id: emptyIdx >= 0 ? prev[emptyIdx].id : generateRecordId('payrow'),
        description: creditDescription,
        debitAmount: 0,
        creditAmount: applyAmt,
        balance: calculatePaymentRow(0, applyAmt),
      };
      if (emptyIdx >= 0) {
        const copy = [...prev];
        copy[emptyIdx] = newRow;
        return copy;
      }
      return [...prev, newRow];
    });

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
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        const d = field === 'debitAmount' ? Number(value) : row.debitAmount;
        const c = field === 'creditAmount' ? Number(value) : row.creditAmount;
        updated.balance = calculatePaymentRow(d, c);

        return updated;
      })
    );
  };

  const handleClearRow = (id: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? createEmptyRow(id) : row))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      createEmptyRow(generateRecordId('payrow')),
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
    setRows([
      createEmptyRow('1'),
      createEmptyRow('2'),
      createEmptyRow('3'),
    ]);
    setAppliedCreditIdsInVoucher([]);
    setValidationAttempted(false);
  };

  const handleClear = () => {
    resetFormFields();
    showToast('Supplier payment form cleared and all cells reset.');
  };

  const { totalDebit, totalCredit, balance } = calculatePaymentTotals(
    rows,
    overallPreviousAmount,
    overallPaidAmount
  );

  const netBalanceAfterCredit = Math.max(0, balance - totalCredit);

  const activeRowCount = rows.filter(
    (r) => r.description.trim() !== '' || r.debitAmount !== 0 || r.creditAmount !== 0
  ).length;

  const handleSavePDF = () => {
    const check = validateSupplierPaymentForm({
      invoiceNumber,
      date,
      supplierName,
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

    // If the user manually entered a credit/rebate amount in the voucher rows without already clicking "Apply Credit"
    if (
      totalCredit > 0 &&
      appliedCreditIdsInVoucher.length === 0 &&
      selectedSupplierCreditProfile.availableBalance > 0
    ) {
      applySupplierCreditsForPayment(supplierName, totalCredit, {
        date,
        targetPaymentInvoice: invoiceNumber.trim(),
        notes: `Auto-applied via Supplier Payment Voucher ${invoiceNumber.trim()}`,
      });
    }

    const newRecord = {
      invoiceNumber: invoiceNumber.trim(),
      date,
      dueDate: dueDate || undefined,
      isRecurring: isRecurring || Boolean(dueDate),
      recurrenceFrequency: isRecurring || dueDate ? recurrenceFrequency : undefined,
      description: supplierName,
      contactNumber,
      items: validItems,
      totalAmount: totalDebit,
      previousAmount: overallPreviousAmount,
      paidAmount: overallPaidAmount,
      balance: totalCredit > 0 ? netBalanceAfterCredit : balance,
      status: voucherStatus,
      returnRMB: 0,
      returnRMBInBDT: 0,
      exportGoodsRef: '',
      paymentCategory: 'supplier' as const,
      remarks,
    };

    addPayment(newRecord);

    openPrintModal({
      type: 'payment',
      title: `Supplier Payment Voucher - ${newRecord.invoiceNumber}`,
      data: newRecord,
      items: validItems,
    });

    setInvoiceNumber(generateInvoiceNumber('PAY', supplierPayments.length + 1));
    resetFormFields();
    showToast(
      `Supplier payment voucher ${newRecord.invoiceNumber} saved successfully. All fields cleared and ready for next entry.`
    );
  };

  const handlePrintSelected = () => {
    const validItems = rows.filter(
      (r) => r.description.trim() !== '' || r.debitAmount > 0 || r.creditAmount > 0
    );
    openPrintModal({
      type: 'payment',
      title: `Supplier Payment Voucher (Preview) - ${invoiceNumber}`,
      data: {
        invoiceNumber,
        date,
        description: supplierName,
        contactNumber,
        items: validItems.length > 0 ? validItems : rows.slice(0, 5),
        totalAmount: totalDebit,
        previousAmount: overallPreviousAmount,
        paidAmount: overallPaidAmount,
        balance: totalCredit > 0 ? netBalanceAfterCredit : balance,
        status: voucherStatus,
        returnRMB: 0,
        returnRMBInBDT: 0,
        exportGoodsRef: '',
        paymentCategory: 'supplier',
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
              src={companyProfile.logoUrl || '/assets/aistudio/Gemini_Generated_Image_x7u4nx7u4nx7u4nx_2672ff47.jpg'}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('exporter_payment_form')}
            className="text-xs bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 px-3 py-1 rounded border border-teal-400/40 font-bold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <span>Open Exporter Payment Sheet (#5)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded border border-amber-400/40 font-mono">
            Sheet #4
          </span>
        </div>
      </div>

      {/* Automatic Supplier Database Lookup & Payment Details (DEBIT, CREDIT, BALANCE & STATUS) */}
      <div
        data-testid="supplier-payment-details-card"
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-700" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              Supplier Payment Details &amp; Record History (DEBIT, CREDIT, BALANCE &amp; STATUS)
            </span>
          </div>
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
              {dropdownOptions.suppliers.map((s) => (
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
                  <th className="px-2.5 py-2 border-r border-indigo-800/60 w-28 text-right">
                    CREDIT (TK)
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
                        {row.debitAmount > 0 ? formatCurrency(row.debitAmount, '') : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-800">
                        {row.creditAmount > 0 ? formatCurrency(row.creditAmount, '') : '-'}
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
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#242b58] text-white font-bold border-t-2 border-indigo-900">
                  <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wider text-[11px]">
                    SUPPLIER DETAILS GRAND TOTAL ({supplierRecordHistory.length} RECORDS):
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-amber-300 font-black text-xs">
                    {supplierHistoryTotals.totalDebit.toFixed(2)}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-emerald-300 font-bold text-xs">
                    {supplierHistoryTotals.totalCredit.toFixed(2)}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-rose-300 font-black text-xs">
                    {supplierHistoryTotals.totalBalance.toFixed(2)}
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
                    src={companyProfile.logoUrl || '/assets/aistudio/Gemini_Generated_Image_x7u4nx7u4nx7u4nx_2672ff47.jpg'}
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
                  EMAIL: {companyProfile.email || 'www.zsbaquatics.com'}
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

            {/* Top Supplier Metadata Fields Row (4 Columns) */}
            <div className="p-3.5 bg-amber-50/60 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
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
                <label
                  htmlFor="supplier-payment-date"
                  className="font-bold text-slate-800 uppercase block mb-1"
                >
                  DATE: <span className="text-rose-600">*</span>
                </label>
                <input
                  id="supplier-payment-date"
                  type="date"
                  aria-invalid={
                    validationAttempted && Boolean(validation.fieldErrors.date)
                  }
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-2 ${
                    validationAttempted && validation.fieldErrors.date
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
                  {dropdownOptions.suppliers.map((sup) => (
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

            {/* Recurring Supplier Payment & Future Due Date Bar */}
            <div className="px-3.5 py-2.5 bg-indigo-50/70 border-b border-indigo-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs">
              <div className="flex items-center space-x-2">
                <input
                  id="supplier-payment-recurring"
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-indigo-300 text-indigo-700 focus:ring-indigo-500 cursor-pointer"
                />
                <label
                  htmlFor="supplier-payment-recurring"
                  className="font-bold text-indigo-950 cursor-pointer select-none"
                >
                  Recurring Supplier Payment Schedule
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <label
                  htmlFor="supplier-payment-duedate"
                  className="font-bold text-slate-700 uppercase whitespace-nowrap text-[11px]"
                >
                  Next Due Date:
                </label>
                <input
                  id="supplier-payment-duedate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    if (e.target.value) setIsRecurring(true);
                  }}
                  className="w-full bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <label
                  htmlFor="supplier-payment-frequency"
                  className="font-bold text-slate-700 uppercase whitespace-nowrap text-[11px]"
                >
                  Cycle:
                </label>
                <select
                  id="supplier-payment-frequency"
                  value={recurrenceFrequency}
                  onChange={(e) => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
                  className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="weekly">Weekly (7 Days)</option>
                  <option value="biweekly">Bi-Weekly (14 Days)</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
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

            {/* Live Supplier Account Ledger Strip */}
            <div className="px-3.5 py-2.5 bg-purple-50/80 border-b border-purple-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700">
                <span className="inline-flex items-center space-x-1 font-bold text-purple-950">
                  <UserCheck className="w-3.5 h-3.5 text-purple-700" />
                  <span>{supplierName} Ledger:</span>
                </span>
                <span className="font-mono">
                  Purchases: <strong>{supplierStats.purchaseInvoiceCount} Bills</strong> (
                  {formatCurrency(supplierStats.totalPurchasedValue, companyProfile.currency)})
                </span>
                <span>·</span>
                <span className="font-mono">
                  Vouchers Paid:{' '}
                  <strong className="text-emerald-800">
                    {formatCurrency(supplierStats.totalPaidInVouchers, companyProfile.currency)}
                  </strong>
                </span>
                <span>·</span>
                <span className="font-mono">
                  Last Balance:{' '}
                  <strong className="text-rose-700">
                    {formatCurrency(supplierStats.latestBalance, companyProfile.currency)}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOverallPreviousAmount(supplierStats.latestBalance);
                    showToast(
                      `Applied ${supplierName}'s last closing balance (${formatCurrency(
                        supplierStats.latestBalance,
                        companyProfile.currency
                      )}) to Previous Amount.`
                    );
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 rounded font-bold text-[11px] shadow-2xs transition cursor-pointer"
                >
                  Apply Last Balance
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverallPaidAmount(totalDebit);
                    showToast(
                      `Synced Paid Amount with Total Debit (${formatCurrency(
                        totalDebit,
                        companyProfile.currency
                      )}).`
                    );
                  }}
                  className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded font-bold text-[11px] shadow-2xs transition cursor-pointer"
                >
                  Sync Paid = Total Debit
                </button>
              </div>
            </div>

            {/* Supplier Credit Notes & Rebate Application Panel */}
            <div
              data-testid="payment-supplier-credit-panel"
              className="px-3.5 py-3 bg-teal-50/70 border-b border-teal-200 space-y-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-teal-950 uppercase tracking-wide">
                    <BadgePercent className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>
                      Supplier Credit Notes &amp; Rebates{' '}
                      {supplierName ? `(${supplierName})` : '(All Suppliers)'}
                    </span>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span
                    data-testid="payment-credit-available-summary"
                    className="font-mono tabular-nums text-teal-900"
                  >
                    Available Credit:{' '}
                    <strong className="text-teal-800">
                      {formatCurrency(
                        supplierName
                          ? selectedSupplierCreditProfile.availableBalance
                          : creditSummary.totalAvailableAmount,
                        companyProfile.currency
                      )}
                    </strong>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    Applied:{' '}
                    <strong>
                      {formatCurrency(
                        supplierName
                          ? selectedSupplierCreditProfile.totalApplied
                          : creditSummary.totalAppliedAmount,
                        companyProfile.currency
                      )}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="payment-toggle-add-credit-btn"
                    onClick={() => {
                      if (!newCreditSupplier && supplierName) {
                        setNewCreditSupplier(supplierName);
                      } else if (!newCreditSupplier && dropdownOptions.suppliers[0]) {
                        setNewCreditSupplier(dropdownOptions.suppliers[0]);
                      }
                      setIsAddingCreditNote((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold text-[11px] shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isAddingCreditNote ? 'Close Form' : 'Record Credit Note'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profit_loss')}
                    className="px-2.5 py-1 bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 rounded font-bold text-[11px] transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    P&amp;L Credit Ledger
                  </button>
                </div>
              </div>

              {/* Inline Record New Supplier Credit Note Form */}
              {isAddingCreditNote && (
                <form
                  onSubmit={handleCreateSupplierCredit}
                  data-testid="payment-add-credit-form"
                  className="p-3 bg-white rounded-lg border border-teal-300 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 items-end"
                >
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Supplier
                    </label>
                    <select
                      aria-label="Credit Note Supplier"
                      data-testid="payment-credit-supplier-select"
                      value={newCreditSupplier || supplierName}
                      onChange={(e) => setNewCreditSupplier(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="">-- Select --</option>
                      {dropdownOptions.suppliers.map((sup) => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Credit Amount ({companyProfile.currency})
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      aria-label="Credit Note Amount"
                      data-testid="payment-credit-amount-input"
                      placeholder="e.g. 5000"
                      value={newCreditAmount}
                      onChange={(e) => setNewCreditAmount(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Credit Reason
                    </label>
                    <select
                      aria-label="Credit Note Reason"
                      data-testid="payment-credit-reason-select"
                      value={newCreditReason}
                      onChange={(e) => setNewCreditReason(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-800 bg-white"
                    >
                      {SUPPLIER_CREDIT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Ref Purchase Bill
                    </label>
                    <input
                      type="text"
                      aria-label="Credit Note Reference Purchase Bill"
                      data-testid="payment-credit-ref-input"
                      placeholder="e.g. PUR-2026-0001"
                      value={newCreditRefInvoice}
                      onChange={(e) => setNewCreditRefInvoice(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Remarks
                    </label>
                    <input
                      type="text"
                      aria-label="Credit Note Remarks"
                      data-testid="payment-credit-remarks-input"
                      placeholder="Shortage / discount details..."
                      value={newCreditRemarks}
                      onChange={(e) => setNewCreditRemarks(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      data-testid="payment-save-credit-btn"
                      className="w-full px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
                    >
                      Save Credit
                    </button>
                  </div>
                </form>
              )}

              {/* Credit Notes List & 1-Click Apply to Payment Voucher */}
              {visibleCreditNotes.length === 0 ? (
                <div className="text-[11px] text-slate-600 bg-white/80 rounded border border-teal-200/80 px-3 py-2 flex items-center justify-between">
                  <span>
                    No credit notes recorded for{' '}
                    <strong>{supplierName || 'any supplier'}</strong> yet. Record a credit note to deduct against future purchase payments.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {visibleCreditNotes.slice(0, 4).map((cn) => {
                    const isAvailable = cn.remainingAmount > 0;
                    return (
                      <div
                        key={cn.id}
                        data-testid={`payment-credit-card-${cn.creditNoteNumber}`}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition ${
                          isAvailable
                            ? 'bg-white border-teal-300 shadow-2xs'
                            : 'bg-slate-50/90 border-slate-200 opacity-80'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-extrabold text-teal-950 text-xs">
                              {cn.creditNoteNumber}
                            </span>
                            <span className="font-bold text-slate-800 text-xs truncate">
                              · {cn.supplierName}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
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
                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                            {cn.reason}
                            {cn.refPurchaseInvoice ? ` · Ref: ${cn.refPurchaseInvoice}` : ''}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-700 mt-0.5">
                            Issued: {formatCurrency(cn.amount, companyProfile.currency)} ·{' '}
                            <strong
                              className={
                                isAvailable ? 'text-teal-800' : 'text-slate-500'
                              }
                            >
                              Rem: {formatCurrency(cn.remainingAmount, companyProfile.currency)}
                            </strong>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {isAvailable ? (
                            <button
                              type="button"
                              data-testid={`payment-apply-credit-btn-${cn.creditNoteNumber}`}
                              onClick={() => handleApplyCreditNoteToVoucher(cn)}
                              className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold text-[11px] shadow-2xs transition cursor-pointer whitespace-nowrap"
                            >
                              Apply Credit
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 px-2 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Applied</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Table Action Bar */}
            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <Wallet className="w-3.5 h-3.5 text-[#8b3858]" />
                <span className="font-bold text-slate-700 uppercase">
                  Supplier Ledger Entries ({activeRowCount} Active / {rows.length} Rows)
                </span>
              </div>
              <div className="flex items-center space-x-2">
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

            {/* Data Entry Table Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#8b3858] text-white uppercase text-[11px] font-bold tracking-wider text-center border-b border-pink-900">
                    <th className="px-2 py-2.5 border-r border-pink-800/60 w-10">SL</th>
                    <th className="px-3 py-2.5 border-r border-pink-800/60 text-left min-w-[260px]">
                      <div className="flex items-center justify-between gap-1.5">
                        <span>SUPPLIER PAYMENT PARTICULARS / BILL DESCRIPTION</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingPaymentMode(true)}
                          className="text-[10px] bg-pink-950/90 hover:bg-pink-900 px-2 py-0.5 rounded text-amber-300 font-bold cursor-pointer whitespace-nowrap shrink-0"
                          title="Add new payment mode or particulars to dropdown"
                        >
                          + Add Mode
                        </button>
                      </div>
                    </th>
                    <th className="px-3 py-2.5 border-r border-pink-800/60 w-32">
                      DEBIT (PAID TK)
                    </th>
                    <th className="px-3 py-2.5 border-r border-pink-800/60 w-32">
                      CREDIT (REBATE)
                    </th>
                    <th className="px-3 py-2.5 border-r border-pink-800/60 w-32">
                      ROW BALANCE
                    </th>
                    <th className="px-2 py-2.5 border-r border-pink-800/60 w-28">
                      STATUS
                    </th>
                    <th className="px-2 py-2.5 w-12">CLR</th>
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
                    const rowStatus = row.status || 'PAID';
                    return (
                      <tr
                        key={row.id}
                        className={
                          rowErr || highlightFirstEmptyRow
                            ? 'bg-rose-50/60 hover:bg-rose-50'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-purple-50/30'
                            : 'bg-slate-50/70 hover:bg-purple-50/30'
                        }
                      >
                        <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Description Dropdown Box (Cash, Bank Transfer / Online Payment, etc.) */}
                        <td className="p-1 border-r border-slate-200 min-w-[240px]">
                          <select
                            aria-label={`Supplier payment row ${idx + 1} particulars`}
                            aria-invalid={Boolean(
                              rowErr?.description || highlightFirstEmptyRow
                            )}
                            value={row.description}
                            onChange={(e) =>
                              handleRowChange(row.id, 'description', e.target.value)
                            }
                            className={`w-full border rounded px-2.5 py-1.5 font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 ${
                              rowErr?.description || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                                : row.description
                                ? 'bg-white border-slate-300 text-slate-900 focus:ring-purple-500'
                                : 'bg-slate-50 border-slate-200 text-slate-500 focus:ring-purple-500'
                            }`}
                          >
                            <option value="">-- Select Payment Mode / Particulars --</option>
                            {dropdownOptions.paymentDescriptions.map((mode) => (
                              <option key={mode} value={mode}>
                                {mode}
                              </option>
                            ))}
                            {row.description &&
                              !dropdownOptions.paymentDescriptions.includes(row.description) && (
                                <option value={row.description}>{row.description}</option>
                              )}
                          </select>
                        </td>

                        {/* Debit Amount */}
                        <td className="p-1 border-r border-slate-200">
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
                            className={`w-full bg-white border rounded px-2 py-1.5 text-right font-mono text-slate-900 font-semibold focus:outline-none focus:ring-1 ${
                              rowErr?.debitAmount || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-purple-500'
                            }`}
                            placeholder="0.00"
                          />
                        </td>

                        {/* Credit Amount */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            aria-label={`Supplier payment row ${idx + 1} credit amount`}
                            aria-invalid={Boolean(
                              rowErr?.creditAmount || highlightFirstEmptyRow
                            )}
                            min="0"
                            step="0.01"
                            value={row.creditAmount || ''}
                            onChange={(e) =>
                              handleRowChange(
                                row.id,
                                'creditAmount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full bg-white border rounded px-2 py-1.5 text-right font-mono text-slate-800 focus:outline-none focus:ring-1 ${
                              rowErr?.creditAmount || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-purple-500'
                            }`}
                            placeholder="0.00"
                          />
                        </td>

                        {/* Row Balance (Debit - Credit) */}
                        <td className="p-1 border-r border-slate-200 text-right font-mono font-bold text-slate-900 pr-3 bg-slate-50">
                          {row.balance.toFixed(2)}
                        </td>

                        {/* Row Status Column (PAID, UNPAID) */}
                        <td className="p-1 border-r border-slate-200 text-center">
                          <select
                            aria-label={`Supplier payment row ${idx + 1} status`}
                            value={rowStatus === 'PAID' ? 'PAID' : 'UNPAID'}
                            onChange={(e) =>
                              handleRowChange(row.id, 'status', e.target.value)
                            }
                            className={`w-full text-center text-[10px] font-black uppercase rounded px-1 py-1.5 border cursor-pointer focus:outline-none ${
                              rowStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-rose-100 text-rose-900 border-rose-300'
                            }`}
                          >
                            <option value="PAID">PAID</option>
                            <option value="UNPAID">UNPAID</option>
                          </select>
                        </td>

                        {/* Clear Single Row */}
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleClearRow(row.id)}
                            title={`Clear row ${idx + 1}`}
                            aria-label={`Clear supplier payment row ${idx + 1}`}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Subtotals & Review Totals Footer */}
                <tfoot>
                  <tr className="bg-[#8b3858] text-white font-bold border-t-2 border-pink-900">
                    <td
                      colSpan={2}
                      className="px-3 py-2 text-right uppercase tracking-wider text-[11px]"
                    >
                      TOTAL SUPPLIER VOUCHER ({companyProfile.currency}):
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300 font-black text-sm">
                      {totalDebit.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-200 font-bold text-xs">
                      {totalCredit.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300 font-black text-sm pr-3">
                      {(totalDebit - totalCredit).toFixed(2)}
                    </td>
                    <td colSpan={2} className="px-2 py-2 text-center text-[11px] font-mono font-bold text-amber-200">
                      {voucherStatus}
                    </td>
                  </tr>

                  {/* Review Section */}
                  <tr className="bg-amber-100/70 text-slate-800 font-bold border-t border-amber-300">
                    <td
                      colSpan={2}
                      rowSpan={totalCredit > 0 ? 5 : 4}
                      className="px-3 py-2 text-center uppercase font-black tracking-widest text-[#8b3858] border-r border-amber-300"
                    >
                      SUPPLIER BALANCE REVIEW
                    </td>
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-bold text-slate-700"
                    >
                      PREVIOUS AMOUNT ({companyProfile.currency}):
                    </td>
                    <td colSpan={3} className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Supplier Previous Amount"
                        aria-invalid={
                          validationAttempted &&
                          Boolean(validation.fieldErrors.overallPreviousAmount)
                        }
                        value={overallPreviousAmount || ''}
                        onChange={(e) =>
                          setOverallPreviousAmount(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className={`w-full bg-white border rounded px-2 py-1 text-right font-mono font-bold text-slate-800 ${
                          validationAttempted &&
                          validation.fieldErrors.overallPreviousAmount
                            ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40'
                            : 'border-amber-400'
                        }`}
                      />
                    </td>
                  </tr>
                  <tr className="bg-amber-100/70 text-slate-800 font-bold">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-bold text-slate-700"
                    >
                      PAID AMOUNT ({companyProfile.currency}):
                    </td>
                    <td colSpan={3} className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Supplier Paid Amount"
                        aria-invalid={
                          validationAttempted &&
                          Boolean(validation.fieldErrors.overallPaidAmount)
                        }
                        value={overallPaidAmount || ''}
                        onChange={(e) =>
                          setOverallPaidAmount(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className={`w-full bg-white border rounded px-2 py-1 text-right font-mono font-bold text-emerald-800 ${
                          validationAttempted &&
                          validation.fieldErrors.overallPaidAmount
                            ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40'
                            : 'border-amber-400'
                        }`}
                      />
                    </td>
                  </tr>
                  {totalCredit > 0 && (
                    <tr
                      data-testid="payment-applied-credit-review-row"
                      className="bg-teal-100/80 text-teal-950 font-bold border-t border-amber-300"
                    >
                      <td
                        colSpan={2}
                        className="px-2 py-1.5 text-right font-bold text-teal-900 uppercase"
                      >
                        APPLIED CREDIT NOTE REBATE ({companyProfile.currency}):
                      </td>
                      <td
                        colSpan={3}
                        className="px-2 py-1.5 text-right font-mono font-extrabold text-teal-800 pr-3"
                      >
                        - {totalCredit.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {/* Voucher Status in Review */}
                  <tr className="bg-amber-100/70 text-slate-800 font-bold border-t border-amber-300">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-bold text-slate-700 uppercase"
                    >
                      VOUCHER STATUS:
                    </td>
                    <td colSpan={3} className="px-2 py-1.5">
                      <select
                        value={voucherStatus === 'PAID' ? 'PAID' : 'UNPAID'}
                        onChange={(e) => setVoucherStatus(e.target.value as ExporterStatus)}
                        aria-label="Supplier Voucher Status"
                        className={`w-full border rounded px-2.5 py-1 text-xs font-black uppercase cursor-pointer ${
                          voucherStatus === 'PAID'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                            : 'bg-rose-50 border-rose-400 text-rose-900'
                        }`}
                      >
                        <option value="PAID">PAID</option>
                        <option value="UNPAID">UNPAID</option>
                      </select>
                    </td>
                  </tr>
                  <tr className="bg-amber-200 text-slate-900 font-black border-t border-amber-300">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-extrabold uppercase text-[#8b3858]"
                    >
                      NET CLOSING BALANCE ({companyProfile.currency}):
                    </td>
                    <td
                      colSpan={3}
                      data-testid="payment-net-closing-balance"
                      className="px-2 py-1.5 text-right font-mono text-base text-rose-800 pr-3"
                    >
                      {(totalCredit > 0 ? netBalanceAfterCredit : balance).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Remarks */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center space-x-2 text-xs">
              <span className="font-bold text-slate-700 uppercase">Supplier Remarks:</span>
              <input
                type="text"
                placeholder="e.g. Cash paid at Turag depot, Bank cheque ref, or mobile banking number..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
              />
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
                  const pmStatus = pm.status || (pm.balance <= 0 ? 'PAID' : 'REPORT');
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
                            {formatCurrency(pm.totalAmount, companyProfile.currency)}
                          </span>
                        </div>
                        <div className="bg-white px-1.5 py-1 rounded border border-slate-200">
                          <span className="text-[9px] font-bold text-emerald-700 uppercase block">CREDIT</span>
                          <span className="font-bold text-emerald-700">
                            {formatCurrency(pm.paidAmount, companyProfile.currency)}
                          </span>
                        </div>
                        <div className="bg-white px-1.5 py-1 rounded border border-slate-200">
                          <span className="text-[9px] font-bold text-rose-700 uppercase block">BALANCE</span>
                          <span className={`font-bold ${pm.balance > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                            {formatCurrency(pm.balance, companyProfile.currency)}
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
    </div>
  );
};
