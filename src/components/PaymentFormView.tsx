import React, { useState, useMemo } from 'react';
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
import { PaymentItemRow } from '../types/index.ts';
import { validateSupplierPaymentForm } from '../utils/validation.ts';
import { generateRecordId } from '../utils/idGenerator.ts';
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
} from 'lucide-react';

export const PaymentFormView: React.FC = () => {
  const {
    companyProfile,
    dropdownOptions,
    addDropdownItem,
    purchases,
    payments,
    addPayment,
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
  const [supplierName, setSupplierName] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const createEmptyRow = (id: string): PaymentItemRow => ({
    id,
    description: '',
    debitAmount: 0,
    creditAmount: 0,
    balance: 0,
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

  const handleSupplierChange = (selectedSupplier: string) => {
    setSupplierName(selectedSupplier);
    const stats = getSupplierPaymentStats(purchases, payments, selectedSupplier);
    if (stats.latestContactNumber) {
      setContactNumber(stats.latestContactNumber);
    }
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
    setRows([
      createEmptyRow('1'),
      createEmptyRow('2'),
      createEmptyRow('3'),
    ]);
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

    const newRecord = {
      invoiceNumber: invoiceNumber.trim(),
      date,
      description: supplierName,
      contactNumber,
      items: validItems,
      totalAmount: totalDebit,
      previousAmount: overallPreviousAmount,
      paidAmount: overallPaidAmount,
      balance,
      status: 'PAID' as const,
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
        balance,
        status: 'PAID',
        returnRMB: 0,
        returnRMBInBDT: 0,
        exportGoodsRef: '',
        paymentCategory: 'supplier',
        remarks,
      },
      items: validItems.length > 0 ? validItems : rows.slice(0, 5),
    });
  };

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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl font-black tracking-wider text-amber-400 font-serif uppercase">
            {companyProfile.companyName}
          </span>
          <span className="text-lg text-slate-300 hidden sm:inline">|</span>
          <span className="text-sm sm:text-base font-semibold text-slate-100 uppercase tracking-wide">
            Supplier Payment Data Entry Form – Local Fish Suppliers
          </span>
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

      {/* Main Grid: Form Left (8 Cols), Action Buttons & Supplier Search Right (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: The Dedicated Supplier Payment Excel Sheet (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl shadow-md border-2 border-slate-300 overflow-hidden">
            {/* Plum / Maroon Sheet Header Box */}
            <div className="bg-[#8b3858] text-white py-3 px-4 text-center border-b border-pink-900 shadow-inner space-y-1.5">
              <div className="text-xl sm:text-2xl font-black tracking-widest text-amber-400 font-serif uppercase">
                {companyProfile.companyName}
              </div>
              <div className="text-xs sm:text-sm font-bold tracking-wider uppercase text-pink-100">
                SUPPLIER PAYMENT DATA ENTRY FORM
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                <span className="bg-white/95 text-black px-2.5 py-0.5 rounded text-[11px] font-bold shadow-xs">
                  Address: {companyProfile.address}
                </span>
                <span className="bg-white/95 text-black px-2.5 py-0.5 rounded text-[11px] font-bold font-mono shadow-xs">
                  Mobile: {companyProfile.mobiles.join(', ')}
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
                    <td
                      colSpan={2}
                      className="px-3 py-2 text-right font-mono text-amber-300 font-black text-sm pr-3"
                    >
                      {(totalDebit - totalCredit).toFixed(2)}
                    </td>
                  </tr>

                  {/* Review Section */}
                  <tr className="bg-amber-100/70 text-slate-800 font-bold border-t border-amber-300">
                    <td
                      colSpan={2}
                      rowSpan={3}
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
                    <td colSpan={2} className="px-2 py-1.5">
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
                    <td colSpan={2} className="px-2 py-1.5">
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
                  <tr className="bg-amber-200 text-slate-900 font-black border-t border-amber-300">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-extrabold uppercase text-[#8b3858]"
                    >
                      NET CLOSING BALANCE ({companyProfile.currency}):
                    </td>
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right font-mono text-base text-rose-800 pr-3"
                    >
                      {balance.toFixed(2)}
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
              className="w-full bg-[#129c54] hover:bg-[#0e8346] text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>SAVE (PDF)</span>
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
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>CLEAR</span>
            </button>

            {/* PRINT (Selected Cells) Button - Cyan */}
            <button
              type="button"
              onClick={handlePrintSelected}
              className="w-full bg-[#0891b2] hover:bg-[#0e7490] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>PRINT (Selected Cells)</span>
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
                matchingSupplierVouchers.map((pm) => (
                  <div
                    key={pm.id}
                    className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50/40 flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <div className="font-mono font-bold text-purple-900">
                        {pm.invoiceNumber} · <span className="font-sans">{pm.description}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatDate(pm.date)} · Paid:{' '}
                        <strong className="text-emerald-700">
                          {formatCurrency(pm.paidAmount, companyProfile.currency)}
                        </strong>
                      </div>
                    </div>
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
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-bold text-purple-800 hover:bg-purple-100 flex items-center space-x-1 cursor-pointer"
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
