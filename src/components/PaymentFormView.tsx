import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  generateInvoiceNumber,
  formatCurrency,
  formatDate,
  getSupplierPaymentStats,
  classifyPaymentCategory,
} from '../utils/calculations.ts';
import {
  ZSB_VIEW_SHORTCUT_EVENT,
  ViewShortcutEventDetail,
} from '../utils/keyboardShortcuts.ts';
import { emitPaymentSyncTrigger } from '../utils/paymentSync.ts';
import { useDebouncedStoreSave } from '../hooks/useDebouncedStoreSave.ts';
import {
  FORM_DRAFT_STORAGE_KEYS,
  clearFormDraft,
  hasMeaningfulPaymentDraft,
  loadFormDraft,
  sanitizePaymentFormDraft,
  saveFormDraftJson,
} from '../utils/formDraftStorage.ts';
import {
  Save,
  Printer,
  Plus,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Clock,
  Sparkles,
  Edit2,
  CreditCard,
} from 'lucide-react';
import type { ExporterStatus } from '../types/index.ts';

export const PaymentFormView: React.FC = () => {
  const {
    companyProfile,
    dropdownOptions,
    addDropdownItem,
    purchases,
    payments,
    addPayment,
    updatePayment,
    openPrintModal,
    setActiveTab,
    showToast,
    editingPaymentId,
    setEditingPaymentId,
  } = useApp();

  const currency = companyProfile.currency || 'BDT';

  // Supplier payments only
  const supplierPayments = useMemo(
    () => payments.filter((pm) => classifyPaymentCategory(pm) === 'supplier'),
    [payments]
  );

  // Auto-generated Voucher Number
  const nextInvoiceNo = useMemo(
    () => generateInvoiceNumber('PAY', supplierPayments.length),
    [supplierPayments.length]
  );

  // Form States (hydrated from localStorage unsaved draft if available)
  const initialPaymentDraft = useMemo(() => {
    if (editingPaymentId) return null;
    const loaded = loadFormDraft(
      FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM,
      sanitizePaymentFormDraft
    );
    return hasMeaningfulPaymentDraft(loaded) ? loaded : null;
  }, []);

  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    () => initialPaymentDraft?.invoiceNumber?.trim() || nextInvoiceNo
  );
  const [date, setDate] = useState<string>(
    () => initialPaymentDraft?.date || new Date().toISOString().slice(0, 10)
  );
  const [supplierName, setSupplierName] = useState<string>(
    () => initialPaymentDraft?.supplierName || ''
  );
  const [creditAmount, setCreditAmount] = useState<string>(
    () => initialPaymentDraft?.creditAmount || ''
  );
  const [paymentMode, setPaymentMode] = useState<string>(
    () => initialPaymentDraft?.paymentMode || 'Cash'
  );
  const [refPurchaseInvoice, setRefPurchaseInvoice] = useState<string>(
    () => initialPaymentDraft?.refPurchaseInvoice || ''
  );
  const [remarks, setRemarks] = useState<string>(
    () => initialPaymentDraft?.remarks || ''
  );
  const [voucherStatus, setVoucherStatus] = useState<ExporterStatus>(
    () => initialPaymentDraft?.voucherStatus || 'PAID'
  );
  const [contactNumber, setContactNumber] = useState<string>(
    () => initialPaymentDraft?.contactNumber || ''
  );

  const serializedPaymentDraft = useMemo(
    () =>
      JSON.stringify({
        invoiceNumber,
        date,
        supplierName,
        creditAmount,
        paymentMode,
        refPurchaseInvoice,
        remarks,
        voucherStatus,
        contactNumber,
      }),
    [
      invoiceNumber,
      date,
      supplierName,
      creditAmount,
      paymentMode,
      refPurchaseInvoice,
      remarks,
      voucherStatus,
      contactNumber,
    ]
  );

  useDebouncedStoreSave('Supplier Payment Draft', serializedPaymentDraft, () => {
    if (!editingPaymentId) {
      saveFormDraftJson(
        FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM,
        serializedPaymentDraft
      );
    }
  });

  // Quick add supplier inline modal
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState<boolean>(false);
  const [newSupplierValue, setNewSupplierValue] = useState<string>('');
  const [isAddingPaymentMode, setIsAddingPaymentMode] = useState<boolean>(false);
  const [newPaymentModeValue, setNewPaymentModeValue] = useState<string>('');

  const creditInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when editingPaymentId is provided from database (load once per ID selection)
  const lastLoadedEditingPaymentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editingPaymentId) {
      lastLoadedEditingPaymentIdRef.current = null;
      return;
    }
    if (lastLoadedEditingPaymentIdRef.current !== editingPaymentId) {
      const pm = payments.find((p) => p.id === editingPaymentId);
      if (pm) {
        lastLoadedEditingPaymentIdRef.current = editingPaymentId;
        setInvoiceNumber(pm.invoiceNumber || nextInvoiceNo);
        setDate(pm.date || new Date().toISOString().slice(0, 10));
        setSupplierName(pm.description || '');
        setCreditAmount(pm.paidAmount !== undefined && pm.paidAmount !== 0 ? String(pm.paidAmount) : '');
        setVoucherStatus((pm.status as ExporterStatus) || 'PAID');
        setRemarks(pm.remarks || '');
        setRefPurchaseInvoice(pm.exportGoodsRef || '');
        if (pm.contactNumber) setContactNumber(pm.contactNumber);
      }
    }
  }, [editingPaymentId, payments, nextInvoiceNo]);

  // All known distinct suppliers from Dropdowns, Purchases, Payments, and Credits
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
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [dropdownOptions.suppliers, purchases, supplierPayments]);

  // Selected supplier real-time financial ledger stats
  const supplierStats = useMemo(
    () => getSupplierPaymentStats(purchases, payments, supplierName),
    [purchases, payments, supplierName]
  );

  // Active purchase invoices for the selected supplier (for optional challan reference)
  const supplierPurchaseInvoices = useMemo(() => {
    if (!supplierName.trim()) return [];
    const target = supplierName.trim().toLowerCase();
    return purchases
      .filter((p) => (p.description || '').trim().toLowerCase() === target)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [purchases, supplierName]);

  // When supplier changes, auto-populate phone if known
  const handleSupplierSelect = (name: string) => {
    setSupplierName(name);
    const stats = getSupplierPaymentStats(purchases, payments, name);
    if (stats.latestContactNumber) {
      setContactNumber(stats.latestContactNumber);
    }
    // Focus credit amount input for fast entry
    setTimeout(() => {
      creditInputRef.current?.focus();
    }, 50);
  };

  // Calculated values
  const parsedCredit = parseFloat(creditAmount);
  const numericCredit = Number.isFinite(parsedCredit) ? Math.round(parsedCredit * 100) / 100 : 0;
  const currentSupplierDue = supplierStats.latestBalance;
  const totalPurchased = supplierStats.totalPurchasedValue;
  const totalPaid = supplierStats.totalPaidInPurchases + supplierStats.totalPaidInVouchers;
  const billCount = supplierStats.purchaseInvoiceCount;
  const balanceAfterThisPayment = Math.max(0, Math.round((currentSupplierDue - numericCredit) * 100) / 100);

  // Quick fill full due amount
  const handlePayFullDue = () => {
    if (currentSupplierDue > 0) {
      setCreditAmount(String(currentSupplierDue));
    }
  };

  // Add new supplier inline
  const handleAddSupplierInline = () => {
    const val = newSupplierValue.trim();
    if (!val) return;
    addDropdownItem('suppliers', val);
    setSupplierName(val);
    setNewSupplierValue('');
    setIsAddingNewSupplier(false);
    showToast(`Added supplier "${val}" to master list.`);
  };

  // Add new payment mode inline
  const handleAddPaymentModeInline = () => {
    const val = newPaymentModeValue.trim();
    if (!val) return;
    setPaymentMode(val);
    setNewPaymentModeValue('');
    setIsAddingPaymentMode(false);
    showToast(`Payment mode set to "${val}".`);
  };

  // Save payment voucher
  const handleSaveVoucher = (options?: { openPreview?: boolean }) => {
    if (!supplierName.trim()) {
      showToast('Please select or enter a Supplier Name.');
      return;
    }
    if (!Number.isFinite(parsedCredit) || numericCredit === 0) {
      showToast('Please enter a valid non-zero Credit Amount (+ to pay, - to deduct).');
      creditInputRef.current?.focus();
      return;
    }

    const effectiveTotal =
      currentSupplierDue > 0 ? currentSupplierDue : numericCredit > 0 ? numericCredit : 0;
    const effectiveBalance = balanceAfterThisPayment;

    const itemDescription = remarks.trim()
      ? `${remarks.trim()}${paymentMode ? ` via ${paymentMode}` : ''}`
      : numericCredit < 0
      ? `Payment deduction from ${supplierName.trim()}${paymentMode ? ` via ${paymentMode}` : ''}`
      : `Payment to ${supplierName.trim()}${paymentMode ? ` via ${paymentMode}` : ''}`;

    const recordPayload = {
      invoiceNumber: invoiceNumber.trim(),
      date,
      description: supplierName.trim(),
      contactNumber: contactNumber.trim(),
      totalAmount: effectiveTotal,
      previousAmount: 0,
      paidAmount: numericCredit,
      balance: effectiveBalance,
      status: voucherStatus,
      returnRMB: 0,
      returnRMBInBDT: 0,
      exportGoodsRef: refPurchaseInvoice.trim(),
      paymentCategory: 'supplier' as const,
      remarks: remarks.trim() ? `${remarks.trim()} (${paymentMode})` : paymentMode,
      items: [
        {
          id: '1',
          date,
          description: itemDescription,
          debitAmount: 0,
          creditAmount: numericCredit,
          balance: effectiveBalance,
          status: voucherStatus,
        },
      ],
    };

    let savedId = '';
    if (editingPaymentId) {
      // We are updating an existing voucher
      savedId = editingPaymentId;
      updatePayment(editingPaymentId, recordPayload);
      showToast(`Payment voucher ${invoiceNumber.trim()} updated successfully!`);
      setEditingPaymentId(null);
    } else {
      // Create new voucher
      savedId = addPayment(recordPayload);
      showToast(
        `Payment voucher ${invoiceNumber.trim()} for ${supplierName.trim()} (${formatCurrency(numericCredit, currency)}) saved to Payment Database!`
      );
    }

    emitPaymentSyncTrigger({
      category: 'supplier',
      action: editingPaymentId ? 'update' : 'confirm',
      invoiceNumber: invoiceNumber.trim(),
      partyName: supplierName.trim(),
      creditAmount: numericCredit,
      runningBalance: effectiveBalance,
    });

    if (options?.openPreview) {
      openPrintModal({
        type: 'payment',
        title: `Supplier Payment Voucher - ${invoiceNumber.trim()}`,
        data: {
          ...recordPayload,
          id: savedId,
        },
        items: recordPayload.items,
      });
    }

    // Reset form for next entry (do not advance sequence count when editing an existing voucher)
    clearFormDraft(FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM);
    setCreditAmount('');
    setRemarks('');
    setRefPurchaseInvoice('');
    setInvoiceNumber(
      generateInvoiceNumber('PAY', editingPaymentId ? supplierPayments.length : supplierPayments.length + 1)
    );

    // Focus supplier input for the next fast payment entry
    setTimeout(() => {
      creditInputRef.current?.focus();
    }, 100);
  };

  const handleClearForm = () => {
    clearFormDraft(FORM_DRAFT_STORAGE_KEYS.PAYMENT_FORM);
    setCreditAmount('');
    setRemarks('');
    setRefPurchaseInvoice('');
    setSupplierName('');
    setContactNumber('');
    setInvoiceNumber(nextInvoiceNo);
    if (editingPaymentId) {
      setEditingPaymentId(null);
    }
    showToast('Payment form cleared.');
  };

  // Keyboard shortcut support (Ctrl+S, Print)
  const shortcutHandlerRef = useRef<(action: ViewShortcutEventDetail['action']) => void>(() => {});
  shortcutHandlerRef.current = (action) => {
    if (action === 'SAVE_ACTIVE_VIEW') {
      handleSaveVoucher({ openPreview: false });
    } else if (action === 'PRINT_ACTIVE_VIEW') {
      handleSaveVoucher({ openPreview: true });
    } else if (action === 'RESET_FORM') {
      handleClearForm();
    }
  };

  useEffect(() => {
    const handleShortcut = (e: Event) => {
      const customEvent = e as CustomEvent<ViewShortcutEventDetail>;
      const action = customEvent.detail?.action;
      if (
        action === 'SAVE_ACTIVE_VIEW' ||
        action === 'PRINT_ACTIVE_VIEW' ||
        action === 'RESET_FORM'
      ) {
        customEvent.detail.handled = true;
        shortcutHandlerRef.current(action);
      }
    };

    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, handleShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, handleShortcut);
  }, []);

  // Latest 8 supplier payments for quick audit table
  const recentSupplierPayments = useMemo(() => {
    return [...supplierPayments]
      .sort((a, b) => {
        const dDiff = (b.date || '').localeCompare(a.date || '');
        if (dDiff !== 0) return dDiff;
        return (b.id || '').localeCompare(a.id || '');
      })
      .slice(0, 8);
  }, [supplierPayments]);

  return (
    <div className="space-y-5 pb-10">
      {/* Main Payment Entry Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
              {editingPaymentId ? 'Editing Payment Voucher' : 'New Supplier Payment Voucher'}
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Press <strong className="text-slate-800">Ctrl+S</strong> to save voucher immediately
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Row 1: Voucher Info Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Voucher Number *
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  data-testid="supplier-payment-invoice-input"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-purple-900 bg-purple-50/30 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setInvoiceNumber(generateInvoiceNumber('PAY', supplierPayments.length))}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Regenerate next voucher number"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Payment Date *
              </label>
              <input
                type="date"
                data-testid="supplier-payment-date-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Voucher Status
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setVoucherStatus('PAID')}
                  className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1 ${
                    voucherStatus === 'PAID'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PAID</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherStatus('PENDING')}
                  className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1 ${
                    voucherStatus === 'PENDING'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>PENDING</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Supplier Selection with Live Financial Card */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                1. Select Supplier Account *
              </label>
              <button
                type="button"
                onClick={() => setIsAddingNewSupplier(true)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add New Supplier</span>
              </button>
            </div>

            {isAddingNewSupplier && (
              <div className="flex items-center space-x-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 animate-in fade-in">
                <input
                  type="text"
                  value={newSupplierValue}
                  onChange={(e) => setNewSupplierValue(e.target.value)}
                  placeholder="Enter new supplier full name"
                  className="flex-1 px-3 py-1.5 border border-emerald-300 rounded-lg text-xs font-bold bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSupplierInline}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700"
                >
                  Save Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewSupplier(false)}
                  className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  data-testid="supplier-payment-name-input"
                  list="payment-suppliers-datalist"
                  value={supplierName}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  placeholder="Type or select supplier from list..."
                  className="w-full px-3.5 py-2.5 border-2 border-slate-300 focus:border-emerald-500 rounded-xl font-bold text-slate-900 text-sm bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  required
                />
                <datalist id="payment-suppliers-datalist">
                  {availableSuppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="Supplier Phone / Mobile number (optional)"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Supplier Financial Due Status Card */}
            {supplierName.trim() && (
              <div className="mt-3 p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
                <div className="border-r border-slate-100 pr-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Total Invoiced / Procured
                  </span>
                  <span className="text-base font-black font-mono text-slate-900 mt-0.5 block">
                    {formatCurrency(totalPurchased, currency)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Across {billCount} purchase bills
                  </span>
                </div>

                <div className="border-r border-slate-100 pr-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Total Paid to Date
                  </span>
                  <span className="text-base font-black font-mono text-emerald-700 mt-0.5 block">
                    {formatCurrency(totalPaid, currency)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Across {supplierStats.paymentVoucherCount} vouchers
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                      Current Outstanding Due
                    </span>
                    {currentSupplierDue > 0 && (
                      <button
                        type="button"
                        onClick={handlePayFullDue}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition"
                      >
                        ⚡ Pay Full Due
                      </button>
                    )}
                  </div>
                  <span
                    className={`text-lg font-black font-mono mt-0.5 block ${
                      currentSupplierDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(currentSupplierDue, currency)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {currentSupplierDue > 0 ? 'Unsettled balance' : 'Fully settled'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Row 3: PRIMARY CREDIT AMOUNT INPUT & PAYMENT DETAILS */}
          <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-white rounded-2xl border-2 border-emerald-400/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>2. Credit Amount Disbursed *</span>
                </span>
                <p className="text-[11px] text-emerald-800">
                  Enter a positive amount to pay the supplier, or a negative amount (below 0, e.g. -5000) to deduct supplier payment
                </p>
              </div>

              {currentSupplierDue > 0 && (
                <button
                  type="button"
                  onClick={handlePayFullDue}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Fill Full Due ({formatCurrency(currentSupplierDue, currency)})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Giant Credit Amount Box */}
              <div className="lg:col-span-6">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-lg sm:text-xl">
                    {currency}
                  </span>
                  <input
                    ref={creditInputRef}
                    type="number"
                    step="any"
                    data-testid="supplier-payment-credit-amount-input"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="0.00 (or -amount to deduct)"
                    className={`w-full pl-14 pr-4 py-3 border-2 rounded-xl font-mono font-black text-2xl sm:text-3xl bg-white focus:ring-4 focus:outline-none tracking-tight ${
                      numericCredit < 0
                        ? 'border-rose-500 text-rose-700 focus:ring-rose-400/30'
                        : 'border-emerald-500 text-emerald-800 focus:ring-emerald-400/30'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Payment Method / Mode & Invoice Reference */}
              <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Payment Mode
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingPaymentMode(true)}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      + Custom Mode
                    </button>
                  </div>

                  {isAddingPaymentMode ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={newPaymentModeValue}
                        onChange={(e) => setNewPaymentModeValue(e.target.value)}
                        placeholder="e.g. Dutch Bangla Bank"
                        className="w-full px-2 py-1.5 text-xs border rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleAddPaymentModeInline}
                        className="px-2 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold"
                      >
                        Set
                      </button>
                    </div>
                  ) : (
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="Cash">Cash (Depot Counter)</option>
                      <option value="Bank Transfer">Bank Transfer (EFT / RTGS)</option>
                      <option value="Cheque">Cheque Payout</option>
                      <option value="bKash">bKash Mobile Payment</option>
                      <option value="Nagad">Nagad Mobile Payment</option>
                      <option value="Rocket">Rocket Mobile Payment</option>
                      {paymentMode && !['Cash', 'Bank Transfer', 'Cheque', 'bKash', 'Nagad', 'Rocket'].includes(paymentMode) && (
                        <option value={paymentMode}>{paymentMode}</option>
                      )}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reference Challan (Optional)
                  </label>
                  {supplierPurchaseInvoices.length > 0 ? (
                    <select
                      value={refPurchaseInvoice}
                      onChange={(e) => setRefPurchaseInvoice(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- General Payment (No Challan) --</option>
                      {supplierPurchaseInvoices.map((inv) => (
                        <option key={inv.id} value={inv.invoiceNumber}>
                          {inv.invoiceNumber} ({formatDate(inv.date)} · Due: {formatCurrency(inv.balance, currency)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={refPurchaseInvoice}
                      onChange={(e) => setRefPurchaseInvoice(e.target.value)}
                      placeholder="e.g. INV-2026-001 or memo"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Remarks / Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Transaction Note / Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Paid cash at Turag depot by Md. Sohel Rana, full payment for eel fish batch..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Live Impact Calculation Preview */}
            {supplierName.trim() && numericCredit !== 0 && (
              <div
                data-testid="supplier-payment-live-impact"
                className={`bg-white/90 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-mono ${
                  numericCredit < 0 ? 'border-rose-300' : 'border-emerald-300'
                }`}
              >
                <div>
                  <span className="text-slate-500">Current Due:</span>{' '}
                  <strong className="text-slate-900">{formatCurrency(currentSupplierDue, currency)}</strong>
                </div>
                {numericCredit < 0 ? (
                  <div className="text-rose-700">
                    <span>Deducting Payment:</span>{' '}
                    <strong className="text-rose-800 font-black">
                      + {formatCurrency(Math.abs(numericCredit), currency)} (Credit: {formatCurrency(numericCredit, currency)})
                    </strong>
                  </div>
                ) : (
                  <div className="text-emerald-700">
                    <span>Paying (Credit):</span>{' '}
                    <strong className="text-emerald-800 font-black">− {formatCurrency(numericCredit, currency)}</strong>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Remaining Balance:</span>{' '}
                  <strong
                    className={`font-black ${
                      balanceAfterThisPayment > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(balanceAfterThisPayment, currency)}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClearForm}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>CLEAR / RESET</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSaveVoucher({ openPreview: true })}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1877d2] hover:bg-[#1465b5] text-white shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                title="Save payment and open official PDF voucher for printing"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>SAVE &amp; PRINT PDF</span>
              </button>

              <button
                type="button"
                data-testid="supplier-payment-save-btn"
                onClick={() => handleSaveVoucher({ openPreview: false })}
                className="px-6 py-2.5 rounded-xl text-sm font-black bg-[#00897b] hover:bg-[#00796b] active:scale-95 text-white shadow-sm transition flex items-center space-x-2 cursor-pointer"
                title="Save Payment Voucher (Ctrl+S)"
              >
                <Save className="w-4 h-4" />
                <span>{editingPaymentId ? 'UPDATE PAYMENT VOUCHER' : 'CONFIRM & SAVE PAYMENT'}</span>
                <span className="text-[10px] font-mono bg-black/25 px-1.5 py-0.5 rounded text-[#80cbc4]">
                  Ctrl+S
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Supplier Payments Today (Fast Audit Strip) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#273E56] px-5 py-3 border-b border-[#1d2c35] flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#5eead4]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Recent Supplier Payments in Database ({supplierPayments.length} Total)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('payment_db')}
            className="text-xs font-bold text-[#5eead4] hover:text-white inline-flex items-center space-x-1 cursor-pointer"
          >
            <span>View All in Payment DB</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <th className="p-2.5 w-12 text-center">SL #</th>
                <th className="p-2.5">Voucher #</th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Supplier Name</th>
                <th className="p-2.5 text-right">Credit Amount ({currency})</th>
                <th className="p-2.5">Method / Note</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSupplierPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No supplier payment records found yet. Enter your first voucher above!
                  </td>
                </tr>
              ) : (
                recentSupplierPayments.map((pm, idx) => (
                  <tr key={pm.id} className="hover:bg-purple-50/40 transition">
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-purple-900 whitespace-nowrap">
                      {pm.invoiceNumber}
                    </td>
                    <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(pm.date)}
                    </td>
                    <td className="p-2.5 font-bold text-slate-800">
                      {pm.description}
                    </td>
                    <td
                      className={`p-2.5 text-right font-mono font-black whitespace-nowrap ${
                        pm.paidAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(pm.paidAmount, currency)}
                    </td>
                    <td className="p-2.5 text-slate-600 text-[11px] truncate max-w-xs">
                      {pm.remarks || pm.exportGoodsRef || 'Disbursement'}
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          pm.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {pm.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('payment_db');
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 transition flex items-center space-x-0.5 cursor-pointer"
                          title="Open Payment DB to edit if anything was entered wrong"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                          <span>Edit in DB</span>
                        </button>
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
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 transition flex items-center space-x-0.5 cursor-pointer"
                          title="Print or view PDF slip"
                        >
                          <Printer className="w-2.5 h-2.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
