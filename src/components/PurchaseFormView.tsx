import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  calculatePurchaseRowTotal,
  calculatePurchaseTotals,
  formatCurrency,
  formatDate,
  formatPurchaseExportFilename,
  generateInvoiceNumber,
  getSupplierLedgerStats,
} from '../utils/calculations.ts';
import { PurchaseItemRow } from '../types/index.ts';
import { validatePurchaseForm } from '../utils/validation.ts';
import { generateRecordId } from '../utils/idGenerator.ts';
import { exportElementToPdf, exportElementToPng } from '../utils/pdfGenerator.ts';
import {
  Save,
  FileText,
  Search,
  Trash2,
  Printer,
  Plus,
  Layers,
  Database,
  RotateCcw,
  Receipt,
  UserCheck,
  AlertCircle,
  X,
  Edit2,
  FileDown,
  ImageDown,
  Loader2,
} from 'lucide-react';

export const PurchaseFormView: React.FC = () => {
  const {
    companyProfile,
    dropdownOptions,
    addDropdownItem,
    purchases,
    addPurchase,
    updatePurchase,
    editingPurchaseId,
    setEditingPurchaseId,
    openPrintModal,
    setActiveTab,
    showToast,
  } = useApp();

  // Invoice header state
  const nextInvoiceNo = generateInvoiceNumber('PUR', purchases.length);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(nextInvoiceNo);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [lastSavedRecord, setLastSavedRecord] = useState<{ id: string; invoiceNumber: string } | null>(null);

  const createEmptyRow = (id: string): PurchaseItemRow => ({
    id,
    item: '',
    quantity: 0,
    rate: 0,
    totalAmount: 0,
    previousAmount: 0,
    paidAmount: 0,
    balance: 0,
  });

  const [rows, setRows] = useState<PurchaseItemRow[]>([
    createEmptyRow('1'),
    createEmptyRow('2'),
    createEmptyRow('3'),
    createEmptyRow('4'),
    createEmptyRow('5'),
  ]);

  // Overall invoice-level settlement summary inputs (empty / 0 by default)
  const [overallPreviousAmount, setOverallPreviousAmount] = useState<number>(0);
  const [overallPaidAmount, setOverallPaidAmount] = useState<number>(0);

  // Search input by supplier/description
  const [searchDescription, setSearchDescription] = useState<string>('');

  // Inline modal state for adding new item or supplier
  const [isAddingNewItem, setIsAddingNewItem] = useState<boolean>(false);
  const [newItemValue, setNewItemValue] = useState<string>('');
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState<boolean>(false);
  const [newSupplierValue, setNewSupplierValue] = useState<string>('');
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  const validation = validatePurchaseForm({
    invoiceNumber,
    date,
    supplierName: description,
    overallPreviousAmount,
    overallPaidAmount,
    rows,
  });

  // Supplier historical ledger stats
  const supplierStats = getSupplierLedgerStats(purchases, description);

  // Handle supplier selection and auto-fill contact number if known
  const handleSupplierChange = (newSupplier: string) => {
    setDescription(newSupplier);
    const stats = getSupplierLedgerStats(purchases, newSupplier);
    if (stats.latestContactNumber) {
      setContactNumber(stats.latestContactNumber);
    }
  };

  // Handle line-item row changes (Item, Quantity, Rate)
  const handleRowChange = (
    id: string,
    field: 'item' | 'quantity' | 'rate',
    value: string | number
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        if (field === 'quantity' || field === 'rate') {
          const qty = field === 'quantity' ? Number(value) : row.quantity;
          const rt = field === 'rate' ? Number(value) : row.rate;
          const total = calculatePurchaseRowTotal(qty, rt);
          updated.totalAmount = total;
          updated.balance = total;
        }
        return updated;
      })
    );
  };

  // Clear or remove a single row
  const handleClearRow = (id: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? createEmptyRow(row.id) : row))
    );
  };

  // Append a new blank row to the table
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      createEmptyRow(generateRecordId('prow')),
    ]);
  };

  // Load a previously saved purchase bill into form for editing
  const handleLoadForEdit = (idToEdit: string) => {
    const found = purchases.find((p) => p.id === idToEdit);
    if (!found) return;
    setEditingPurchaseId(found.id);
    setInvoiceNumber(found.invoiceNumber);
    setDate(found.date);
    setDescription(found.description);
    setContactNumber(found.contactNumber || '');
    setRemarks(found.remarks || '');
    setOverallPreviousAmount(found.previousAmount || 0);
    setOverallPaidAmount(found.paidAmount || 0);

    const loadedRows = found.items.map((it) => ({ ...it }));
    while (loadedRows.length < 5) {
      loadedRows.push(createEmptyRow(generateRecordId('prow')));
    }
    setRows(loadedRows);
    setValidationAttempted(false);
    showToast(`Loaded purchase invoice ${found.invoiceNumber} for editing.`);
  };

  const handleCancelEdit = () => {
    setEditingPurchaseId(null);
    resetFormFields();
    setInvoiceNumber(generateInvoiceNumber('PUR', purchases.length + 1));
    showToast('Exited edit mode. Ready for new purchase entry.');
  };

  // Sync when editingPurchaseId is selected externally (e.g. from DatabaseView)
  useEffect(() => {
    if (editingPurchaseId) {
      const found = purchases.find((p) => p.id === editingPurchaseId);
      if (found && found.invoiceNumber !== invoiceNumber) {
        handleLoadForEdit(editingPurchaseId);
      }
    }
  }, [editingPurchaseId]);

  const resetFormFields = () => {
    setDescription('');
    setContactNumber('');
    setRemarks('');
    setOverallPreviousAmount(0);
    setOverallPaidAmount(0);
    setSearchDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setRows([
      createEmptyRow('1'),
      createEmptyRow('2'),
      createEmptyRow('3'),
      createEmptyRow('4'),
      createEmptyRow('5'),
    ]);
    setValidationAttempted(false);
  };

  const handleClear = () => {
    setEditingPurchaseId(null);
    resetFormFields();
    setInvoiceNumber(generateInvoiceNumber('PUR', purchases.length + 1));
    showToast('Form cleared and all fillable cells reset.');
  };

  const { totalQty, totalAmount, balance } = calculatePurchaseTotals(
    rows,
    overallPreviousAmount,
    overallPaidAmount
  );

  const populatedRowCount = rows.filter(
    (r) => r.item.trim() !== '' || r.quantity !== 0 || r.rate !== 0
  ).length;

  const handleSavePDF = () => {
    const check = validatePurchaseForm({
      invoiceNumber,
      date,
      supplierName: description,
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

    if (editingPurchaseId) {
      const updatedFields = {
        invoiceNumber: invoiceNumber.trim(),
        date,
        description,
        contactNumber,
        items: validItems,
        totalQty,
        totalAmount,
        previousAmount: overallPreviousAmount,
        paidAmount: overallPaidAmount,
        balance,
        remarks,
      };

      updatePurchase(editingPurchaseId, updatedFields);

      const updatedRecord = {
        ...updatedFields,
        id: editingPurchaseId,
        createdAt: new Date().toISOString(),
      };

      openPrintModal({
        type: 'purchase',
        title: `Purchase Challan / Bill (Updated) - ${updatedRecord.invoiceNumber}`,
        data: updatedRecord,
        items: validItems,
      });

      setLastSavedRecord({ id: editingPurchaseId, invoiceNumber: updatedRecord.invoiceNumber });
      showToast(
        `Purchase invoice ${updatedRecord.invoiceNumber} updated successfully! Click "Edit" if you need further adjustments.`
      );
    } else {
      const newRecord = {
        invoiceNumber: invoiceNumber.trim(),
        date,
        description,
        contactNumber,
        items: validItems,
        totalQty,
        totalAmount,
        previousAmount: overallPreviousAmount,
        paidAmount: overallPaidAmount,
        balance,
        remarks,
      };

      const newId = addPurchase(newRecord);

      openPrintModal({
        type: 'purchase',
        title: `Purchase Challan / Bill - ${newRecord.invoiceNumber}`,
        data: newRecord,
        items: validItems,
      });

      setLastSavedRecord({ id: newId, invoiceNumber: newRecord.invoiceNumber });
      setInvoiceNumber(generateInvoiceNumber('PUR', purchases.length + 1));
      resetFormFields();
      showToast(
        `Purchase Bill ${newRecord.invoiceNumber} saved successfully. Click "Edit" if you need to update it.`
      );
    }
  };

  const exportableRows = (() => {
    const validItems = rows.filter(
      (r) => r.item.trim() !== '' || r.quantity > 0 || r.rate > 0
    );
    return validItems.length > 0 ? validItems : rows.slice(0, 5);
  })();

  const handlePrintSelected = () => {
    openPrintModal({
      type: 'purchase',
      title: `Purchase Challan / Bill (Preview) - ${invoiceNumber}`,
      data: {
        invoiceNumber,
        date,
        description,
        contactNumber,
        items: exportableRows,
        totalQty,
        totalAmount,
        previousAmount: overallPreviousAmount,
        paidAmount: overallPaidAmount,
        balance,
        remarks,
      },
      items: exportableRows,
    });
  };

  const handleDirectSavePdf = async () => {
    setIsExportingPdf(true);
    const filename = formatPurchaseExportFilename(invoiceNumber, description, date, 'pdf');
    try {
      const success = await exportElementToPdf('purchase-voucher-export-canvas', filename);
      if (success) {
        showToast(`PDF downloaded: ${filename}`);
      } else {
        showToast('Opening Print / Save PDF preview...');
        handlePrintSelected();
      }
    } catch (err) {
      console.error('Purchase PDF export error:', err);
      showToast('Error generating PDF file.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDirectSavePng = async () => {
    setIsExportingPng(true);
    const filename = formatPurchaseExportFilename(invoiceNumber, description, date, 'png');
    try {
      const success = await exportElementToPng('purchase-voucher-export-canvas', filename, 800);
      if (success) {
        showToast(`PNG image downloaded: ${filename}`);
      } else {
        showToast('Opening Print / Save PNG preview...');
        handlePrintSelected();
      }
    } catch (err) {
      console.error('Purchase PNG export error:', err);
      showToast('Error generating PNG image.');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleMonthlyStatement = () => {
    const matched = purchases.filter((p) =>
      p.description.toLowerCase().includes(description.toLowerCase())
    );
    openPrintModal({
      type: 'monthly_statement',
      title: `Monthly Supplier Statement - ${description}`,
      data: {
        party: description,
        date,
        records: matched,
        totalRecords: matched.length,
      },
    });
  };

  const handleSearchDescription = () => {
    setActiveTab('purchase_db');
    if (searchDescription.trim()) {
      showToast(`Viewing Purchase DB for: "${searchDescription}"`);
    }
  };

  const recentSupplierBills = purchases
    .filter((p) => p.description.toLowerCase() === description.toLowerCase())
    .slice(0, 3);

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-[#1e2548] text-white px-5 py-3.5 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xl sm:text-2xl font-black tracking-wider text-amber-400 font-serif uppercase">
            {companyProfile.companyName}
          </span>
          <span className="text-slate-400 hidden sm:inline">·</span>
          <span className="text-sm sm:text-base font-semibold text-slate-100 tracking-wide">
            Purchase Challan / Bill — Data Entry Voucher
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-300 font-mono tabular-nums">
          <span>Active Rows: {populatedRowCount}/{rows.length}</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300 font-bold">
            Bill Total: {formatCurrency(totalAmount, companyProfile.currency)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-200">Sheet #2</span>
        </div>
      </div>

      {/* Main Grid: Redesigned Purchase Voucher Sheet (Left 8 Cols) + Controls & Ledger Context (Right 4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Purchase Data Entry Voucher (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden">
            {/* Sheet Title Header */}
            <div className="bg-[#7c2d4d] text-white py-3 px-5 flex flex-wrap items-center justify-between gap-3 border-b border-pink-950">
              <div>
                <div className="text-lg sm:text-xl font-black tracking-widest text-amber-400 font-serif uppercase">
                  {companyProfile.companyName}
                </div>
                <div className="text-xs font-semibold tracking-wider uppercase text-pink-100">
                  PURCHASE DATA ENTRY FORM (LIVE CRABS, EEL FISH &amp; CHILLED FISH GRADES)
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrintSelected}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                    title="Open Print / Save PDF & .PNG Preview"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                    <span>PRINT / SAVE PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectSavePng}
                    disabled={isExportingPng || isExportingPdf}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    title="Download Purchase Challan / Data Entry Form as .PNG image"
                  >
                    {isExportingPng ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>SAVING .PNG...</span>
                      </>
                    ) : (
                      <>
                        <ImageDown className="w-3.5 h-3.5 shrink-0" />
                        <span>SAVE .PNG</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-right font-mono text-xs text-pink-100 tabular-nums pl-2 border-l border-pink-900/80">
                  <div className="text-[11px] text-pink-200 uppercase">Voucher Ref</div>
                  <div className="font-bold text-amber-300 text-sm">{invoiceNumber}</div>
                </div>
              </div>
            </div>

            {/* Top Edit Mode Indicator Banner */}
            {editingPurchaseId && (
              <div className="bg-amber-100 border-b-2 border-amber-300 text-amber-950 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="font-bold uppercase tracking-wider text-amber-900">
                    EDIT MODE ACTIVE:
                  </span>
                  <span className="font-mono font-bold bg-amber-200/80 px-2 py-0.5 rounded text-amber-950 border border-amber-400/60">
                    {invoiceNumber}
                  </span>
                  <span className="text-amber-800 hidden sm:inline">
                    (Modify supplier, items, rates, or payments, then click <strong>UPDATE INVOICE</strong>)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 shadow-xs cursor-pointer text-xs transition"
                >
                  Cancel Edit / New Entry
                </button>
              </div>
            )}

            {/* Quick Edit Last Saved Purchase Banner */}
            {!editingPurchaseId && lastSavedRecord && (
              <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Purchase invoice <strong>{lastSavedRecord.invoiceNumber}</strong> saved successfully.
                  </span>
                  <span className="text-emerald-700 hidden sm:inline">
                    Need to update quantities, rates, or payments?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadForEdit(lastSavedRecord.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs cursor-pointer text-xs transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>EDIT {lastSavedRecord.invoiceNumber}</span>
                </button>
              </div>
            )}

            {/* Validation Alert Banner */}
            {validationAttempted && !validation.isValid && (
              <div
                role="alert"
                data-testid="purchase-validation-alert"
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

            {/* Invoice Metadata Strip: Invoice No, Date, Supplier, Contact */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label
                    htmlFor="purchase-invoice-no"
                    className="font-bold text-slate-700 uppercase block mb-1"
                  >
                    INVOICE NUMBER <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="purchase-invoice-no"
                    type="text"
                    aria-invalid={
                      validationAttempted && Boolean(validation.fieldErrors.invoiceNumber)
                    }
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className={`w-full bg-white border rounded-lg px-2.5 py-2 font-mono font-bold text-blue-950 focus:outline-none focus:ring-2 ${
                      validationAttempted && validation.fieldErrors.invoiceNumber
                        ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="purchase-bill-date"
                    className="font-bold text-slate-700 uppercase block mb-1"
                  >
                    BILL DATE <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="purchase-bill-date"
                    type="date"
                    aria-invalid={
                      validationAttempted && Boolean(validation.fieldErrors.date)
                    }
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full bg-white border rounded-lg px-2.5 py-2 text-slate-800 font-medium font-mono focus:outline-none focus:ring-2 ${
                      validationAttempted && validation.fieldErrors.date
                        ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor="purchase-supplier-select"
                      className="font-bold text-slate-700 uppercase whitespace-nowrap"
                    >
                      SUPPLIER <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewSupplier(true)}
                      className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer whitespace-nowrap shrink-0"
                      title="Add new supplier"
                    >
                      + Add Supplier
                    </button>
                  </div>
                  <select
                    id="purchase-supplier-select"
                    aria-invalid={
                      validationAttempted && Boolean(validation.fieldErrors.supplierName)
                    }
                    value={description}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className={`w-full bg-white border rounded-lg px-2.5 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                      validationAttempted && validation.fieldErrors.supplierName
                        ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">-- Select Supplier Name --</option>
                    {dropdownOptions.suppliers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="purchase-contact-no"
                    className="font-bold text-slate-700 uppercase block mb-1"
                  >
                    CONTACT NUMBER
                  </label>
                  <input
                    id="purchase-contact-no"
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="+8801..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Supplier Ledger Context Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-[#7c2d4d] shrink-0" />
                  <span className="font-semibold text-slate-800">{description}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {supplierStats.invoiceCount} Saved Bill(s)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Total Qty: {supplierStats.totalPurchasedQty} KG
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    Last Closing Balance:{' '}
                    {formatCurrency(supplierStats.latestClosingBalance, companyProfile.currency)}
                  </span>
                </div>
                {supplierStats.invoiceCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOverallPreviousAmount(supplierStats.latestClosingBalance);
                      showToast(
                        `Applied ${description}'s latest closing balance (${formatCurrency(
                          supplierStats.latestClosingBalance,
                          companyProfile.currency
                        )}) to Previous Amount.`
                      );
                    }}
                    className="text-xs font-bold text-[#7c2d4d] hover:text-pink-950 underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Apply Last Balance ({formatCurrency(supplierStats.latestClosingBalance, companyProfile.currency)})
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add Supplier Inline Form */}
            {isAddingNewSupplier && (
              <div className="p-3 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-blue-950">Add New Supplier:</span>
                <input
                  type="text"
                  placeholder="Enter supplier name..."
                  value={newSupplierValue}
                  onChange={(e) => setNewSupplierValue(e.target.value)}
                  className="bg-white border border-blue-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium flex-1 min-w-[180px] max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newSupplierValue.trim()) {
                      addDropdownItem('suppliers', newSupplierValue.trim());
                      setDescription(newSupplierValue.trim());
                      setNewSupplierValue('');
                      setIsAddingNewSupplier(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Save Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewSupplier(false)}
                  className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Redesigned Line-Item Table (Without Previous Amount and Paid Columns) */}
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-xs"
                data-testid="purchase-entry-table"
              >
                <thead>
                  <tr className="bg-[#7c2d4d] text-white uppercase text-[11px] font-bold tracking-wider border-b border-pink-950">
                    <th className="px-3 py-2.5 border-r border-pink-900/60 w-14 text-center whitespace-nowrap">
                      SL #
                    </th>
                    <th className="px-3 py-2.5 border-r border-pink-900/60 text-left min-w-[210px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="whitespace-nowrap">ITEM / GRADE</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingNewItem(true)}
                          className="text-[10px] bg-pink-950/90 hover:bg-pink-900 px-2 py-0.5 rounded text-amber-300 font-bold cursor-pointer whitespace-nowrap shrink-0"
                          title="Add new purchase item grade"
                        >
                          + New Grade
                        </button>
                      </div>
                    </th>
                    <th className="px-3 py-2.5 border-r border-pink-900/60 w-36 text-right whitespace-nowrap">
                      QUANTITY (KG)
                    </th>
                    <th className="px-3 py-2.5 border-r border-pink-900/60 w-36 text-right whitespace-nowrap">
                      RATE ({companyProfile.currency})
                    </th>
                    <th className="px-3 py-2.5 border-r border-pink-900/60 w-44 text-right whitespace-nowrap">
                      TOTAL AMOUNT ({companyProfile.currency})
                    </th>
                    <th className="px-2 py-2.5 w-16 text-center whitespace-nowrap">
                      CLEAR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((row, idx) => {
                    const isFilled =
                      row.item.trim() !== '' || row.quantity !== 0 || row.rate !== 0;
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
                        className={`transition-colors ${
                          rowErr || highlightFirstEmptyRow
                            ? 'bg-rose-50/60 hover:bg-rose-50'
                            : isFilled
                            ? 'bg-amber-50/20 hover:bg-amber-50/50'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-slate-50/50 hover:bg-slate-100/60'
                        }`}
                      >
                        {/* Row SL Number */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-500 font-semibold">
                          {String(idx + 1).padStart(2, '0')}
                        </td>

                        {/* Item / Grade Dropdown */}
                        <td className="p-1.5 border-r border-slate-200">
                          <select
                            aria-label={`Row ${idx + 1} Item`}
                            aria-invalid={Boolean(rowErr?.item || highlightFirstEmptyRow)}
                            value={row.item}
                            onChange={(e) =>
                              handleRowChange(row.id, 'item', e.target.value)
                            }
                            className={`w-full border rounded-md px-2.5 py-1.5 font-semibold focus:bg-white focus:outline-none focus:ring-2 ${
                              rowErr?.item || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                                : row.item
                                ? 'bg-white border-slate-300 text-slate-900 focus:ring-blue-500'
                                : 'bg-slate-50 border-slate-200 text-slate-500 focus:ring-blue-500'
                            }`}
                          >
                            <option value="">-- Select Grade / Size --</option>
                            {dropdownOptions.purchaseItems.map((it) => (
                              <option key={it} value={it}>
                                {it}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity Input */}
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            aria-label={`Row ${idx + 1} Quantity`}
                            aria-invalid={Boolean(rowErr?.quantity || highlightFirstEmptyRow)}
                            type="number"
                            min="0"
                            step="any"
                            value={row.quantity || ''}
                            onChange={(e) =>
                              handleRowChange(
                                row.id,
                                'quantity',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full bg-white border rounded-md px-2.5 py-1.5 text-right font-mono tabular-nums font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                              rowErr?.quantity || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-blue-500'
                            }`}
                            placeholder="0"
                          />
                        </td>

                        {/* Unit Rate Input */}
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            aria-label={`Row ${idx + 1} Rate`}
                            aria-invalid={Boolean(rowErr?.rate || highlightFirstEmptyRow)}
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.rate || ''}
                            onChange={(e) =>
                              handleRowChange(
                                row.id,
                                'rate',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full bg-white border rounded-md px-2.5 py-1.5 text-right font-mono tabular-nums font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                              rowErr?.rate || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-blue-500'
                            }`}
                            placeholder="0.00"
                          />
                        </td>

                        {/* Row Total Amount (Auto calculated: Quantity * Rate) */}
                        <td className="px-3 py-1.5 border-r border-slate-200 bg-amber-50/40 text-right font-mono tabular-nums font-bold text-slate-900 text-xs">
                          {row.totalAmount > 0
                            ? row.totalAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : '0.00'}
                        </td>

                        {/* Row Clear Action */}
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleClearRow(row.id)}
                            disabled={!isFilled}
                            aria-label={`Clear row ${idx + 1}`}
                            title="Reset this row"
                            className={`p-1 rounded transition ${
                              isFilled
                                ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Clean 6-Column Aligned Subtotal Footer */}
                <tfoot>
                  <tr className="bg-[#7c2d4d] text-white font-bold border-t-2 border-pink-950">
                    <td colSpan={2} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleAddRow}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-300" />
                          <span>Add Item Row</span>
                        </button>
                        <span className="text-[11px] uppercase tracking-wider text-pink-100">
                          TOTAL QUANTITY:
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-300 text-sm font-black border-l border-pink-900/60 whitespace-nowrap">
                      {totalQty}
                    </td>
                    <td className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px] text-pink-100 border-l border-pink-900/60 whitespace-nowrap">
                      BILL SUBTOTAL:
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-300 text-sm font-black border-l border-pink-900/60 whitespace-nowrap">
                      {totalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-2.5 border-l border-pink-900/60"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Quick Add Item Grade Inline Form */}
            {isAddingNewItem && (
              <div className="p-3 bg-amber-50 border-t border-amber-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-amber-950">
                  Add New Purchase Item (Size / Grade):
                </span>
                <input
                  type="text"
                  placeholder="e.g. 4XL or BIG-GRADE..."
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  className="bg-white border border-amber-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium flex-1 min-w-[180px] max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newItemValue.trim()) {
                      addDropdownItem('purchaseItems', newItemValue.trim());
                      setNewItemValue('');
                      setIsAddingNewItem(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-md font-bold hover:bg-amber-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Add Grade
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewItem(false)}
                  className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Redesigned Invoice Review & Financial Settlement Section */}
            <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {/* Left 6 Cols: Challan Remarks & Formula Verification */}
              <div className="md:col-span-6 flex flex-col justify-between space-y-3">
                <div>
                  <label
                    htmlFor="purchase-remarks"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5"
                  >
                    CHALLAN REMARKS / DELIVERY NOTES
                  </label>
                  <textarea
                    id="purchase-remarks"
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes on fish quality, crate count, vehicle/boat ref, or bank transfer ref..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                    Calculation &amp; Ledger Settlement Rules
                  </div>
                  <div className="text-slate-600 font-mono text-[11px] space-y-0.5 tabular-nums">
                    <div>1. Row Total Amount = Quantity × Unit Rate</div>
                    <div>
                      2. Net Closing Balance = Bill Total ({totalAmount.toFixed(2)}) + Previous (
                      {overallPreviousAmount.toFixed(2)}) − Paid ({overallPaidAmount.toFixed(2)})
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 6 Cols: Invoice Review & Balance Summary Box */}
              <div className="md:col-span-6 bg-amber-50/70 rounded-xl border border-amber-300/90 p-4 space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 border-b border-amber-200 pb-2">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <Receipt className="w-4 h-4 text-[#7c2d4d] shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#7c2d4d]">
                      REVIEW &amp; SETTLEMENT
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                    {populatedRowCount} Items · {totalQty} KG
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Current Bill Total */}
                  <div className="flex items-center justify-between py-1 border-b border-amber-200/60">
                    <span className="font-bold text-slate-700 uppercase">
                      CURRENT BILL TOTAL ({companyProfile.currency}):
                    </span>
                    <span className="font-mono tabular-nums font-black text-sm text-slate-900">
                      {totalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Invoice-Level Previous Amount */}
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label
                      htmlFor="invoice-previous-amount"
                      className="col-span-7 font-bold text-slate-700 uppercase"
                    >
                      PREVIOUS AMOUNT:
                      <span className="block text-[10px] font-normal text-slate-500 normal-case">
                        Supplier balance brought forward
                      </span>
                    </label>
                    <div className="col-span-5">
                      <input
                        id="invoice-previous-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        aria-invalid={
                          validationAttempted &&
                          Boolean(validation.fieldErrors.overallPreviousAmount)
                        }
                        value={overallPreviousAmount || ''}
                        onChange={(e) =>
                          setOverallPreviousAmount(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-right font-mono tabular-nums font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                          validationAttempted &&
                          validation.fieldErrors.overallPreviousAmount
                            ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                            : 'border-amber-400 focus:ring-amber-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Invoice-Level Paid Amount */}
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-7">
                      <label
                        htmlFor="invoice-paid-amount"
                        className="font-bold text-slate-700 uppercase block"
                      >
                        PAID AMOUNT:
                      </label>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>Cash / bank paid today</span>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            setOverallPaidAmount(totalAmount + overallPreviousAmount)
                          }
                          className="text-emerald-800 hover:underline font-semibold cursor-pointer"
                        >
                          Pay Full Due
                        </button>
                      </div>
                    </div>
                    <div className="col-span-5">
                      <input
                        id="invoice-paid-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        aria-invalid={
                          validationAttempted &&
                          Boolean(validation.fieldErrors.overallPaidAmount)
                        }
                        value={overallPaidAmount || ''}
                        onChange={(e) =>
                          setOverallPaidAmount(parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-right font-mono tabular-nums font-bold text-emerald-800 focus:outline-none focus:ring-2 ${
                          validationAttempted &&
                          validation.fieldErrors.overallPaidAmount
                            ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                            : 'border-amber-400 focus:ring-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Net Closing Balance Banner */}
                <div className="pt-2.5 border-t-2 border-amber-300 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-[#7c2d4d] block">
                      BALANCE ({companyProfile.currency}):
                    </span>
                    <span className="text-[11px] font-medium text-slate-600">
                      {balance > 0
                        ? 'Net Payable Due to Supplier'
                        : balance < 0
                        ? 'Advance Credit with Supplier'
                        : 'Account Fully Settled'}
                    </span>
                  </div>
                  <div
                    data-testid="purchase-net-balance"
                    className={`font-mono tabular-nums text-lg font-black ${
                      balance > 0
                        ? 'text-rose-800'
                        : balance < 0
                        ? 'text-blue-800'
                        : 'text-emerald-800'
                    }`}
                  >
                    {formatCurrency(balance, companyProfile.currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: ACTION BUTTONS, SEARCH, RECENT BILLS & SYSTEM FLOW (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Action Buttons Container */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ACTION BUTTONS
            </div>

            {/* Primary Action Button: Update or Save */}
            {editingPurchaseId ? (
              <>
                <button
                  type="button"
                  onClick={handleSavePDF}
                  className="w-full bg-[#d97706] hover:bg-[#b45309] text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Edit2 className="w-4 h-4 shrink-0" />
                  <span>UPDATE INVOICE (SAVE)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>CANCEL EDIT (NEW BILL)</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSavePDF}
                className="w-full bg-[#129c54] hover:bg-[#0e8346] text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>SAVE (PDF / .PNG)</span>
              </button>
            )}

            {/* Direct Download PDF (.pdf) & Save as PNG (.png) Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDirectSavePdf}
                disabled={isExportingPdf || isExportingPng}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-3 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Download Purchase Challan directly as a .PDF file"
              >
                {isExportingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5 shrink-0" />
                    <span>SAVE PDF (.pdf)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDirectSavePng}
                disabled={isExportingPng || isExportingPdf}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-3 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Download Purchase Challan directly as a .PNG image"
              >
                {isExportingPng ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>PNG...</span>
                  </>
                ) : (
                  <>
                    <ImageDown className="w-3.5 h-3.5 shrink-0" />
                    <span>SAVE .PNG (.png)</span>
                  </>
                )}
              </button>
            </div>

            {/* PRINT / SAVE PDF with .PNG (Preview) Button */}
            <button
              type="button"
              onClick={handlePrintSelected}
              className="w-full bg-[#0891b2] hover:bg-[#0e7490] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>PRINT / SAVE PDF &amp; .PNG</span>
            </button>

            {/* MONTHLY STATEMENT (PDF) Button */}
            <button
              type="button"
              onClick={handleMonthlyStatement}
              className="w-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>MONTHLY STATEMENT (PDF)</span>
            </button>

            {/* SEARCH Button */}
            <button
              type="button"
              onClick={() => setActiveTab('purchase_db')}
              className="w-full bg-[#1b73b4] hover:bg-[#165f95] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer whitespace-nowrap"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>SEARCH DATABASE</span>
            </button>

            {/* CLEAR Button */}
            <button
              type="button"
              onClick={handleClear}
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>CLEAR</span>
            </button>

            {/* Quick Edit Existing Invoices Dropdown */}
            <div className="pt-2 border-t border-slate-200">
              <label
                htmlFor="select-invoice-to-edit"
                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                EDIT SAVED INVOICE:
              </label>
              <select
                id="select-invoice-to-edit"
                value={editingPurchaseId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleLoadForEdit(e.target.value);
                  } else {
                    handleCancelEdit();
                  }
                }}
                className="w-full text-xs font-semibold bg-amber-50/80 border border-amber-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="">
                  {purchases.length === 0
                    ? '-- No saved invoices --'
                    : '-- Select Invoice to Edit --'}
                </option>
                {purchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.invoiceNumber} — {p.description} ({formatDate(p.date)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SEARCH BY DESCRIPTION Box */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2.5">
            <label
              htmlFor="search-by-description-input"
              className="text-xs font-bold text-slate-700 uppercase tracking-wider block"
            >
              SEARCH BY DESCRIPTION
            </label>
            <input
              id="search-by-description-input"
              type="text"
              placeholder="Enter supplier or item description..."
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSearchDescription}
              className="w-full bg-[#3b5998] hover:bg-[#2d4373] text-white py-2 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>SEARCH</span>
            </button>
          </div>

          {/* Recent Bills for Selected Supplier */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                RECENT BILLS: {description}
              </span>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {recentSupplierBills.length} shown
              </span>
            </div>
            {recentSupplierBills.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {recentSupplierBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">
                        {bill.invoiceNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {formatDate(bill.date)} · {bill.totalQty} KG
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono tabular-nums font-bold text-slate-900">
                        {formatCurrency(bill.totalAmount, companyProfile.currency)}
                      </div>
                      <div className="flex items-center justify-end space-x-2 mt-0.5">
                        <button
                          type="button"
                          onClick={() => handleLoadForEdit(bill.id)}
                          className="text-[11px] text-amber-700 hover:text-amber-900 hover:underline font-bold cursor-pointer inline-flex items-center gap-0.5"
                          title={`Edit ${bill.invoiceNumber}`}
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                          <span>Edit</span>
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            openPrintModal({
                              type: 'purchase',
                              title: `Purchase Challan / Bill - ${bill.invoiceNumber}`,
                              data: bill,
                              items: bill.items,
                            })
                          }
                          className="text-[11px] text-blue-700 hover:underline font-semibold cursor-pointer"
                        >
                          PDF / .PNG
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">
                No previous purchase bills recorded for {description}.
              </p>
            )}
          </div>

          {/* SYSTEM FLOW Diagram */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              SYSTEM FLOW
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-purple-950">1. Purchase Data Entry Form</div>
                  <div className="text-[11px] text-slate-600">
                    Select supplier, enter grade Qty &amp; Rate
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-blue-950">2. Review &amp; Settlement</div>
                  <div className="text-[11px] text-slate-600">
                    Verify subtotal, previous balance &amp; paid amount
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-emerald-950">3. Purchase Database &amp; PDF</div>
                  <div className="text-[11px] text-slate-600">
                    Archive record and print signed Challan
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sheet 2 Footer Specification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="font-bold text-blue-950 uppercase border-b border-slate-100 pb-1.5">
            01. SHEET STRUCTURE
          </div>
          <ul className="space-y-1.5 text-slate-600 font-medium">
            <li><strong className="text-slate-800">1. Dashboard</strong> – Monthly KPIs &amp; charts</li>
            <li><strong className="text-slate-800">2. Purchase Challan</strong> – Streamlined entry</li>
            <li><strong className="text-slate-800">3. Purchase DB</strong> – Saved supplier bills</li>
            <li><strong className="text-slate-800">4. Search Reports</strong> – Filtered statements</li>
            <li><strong className="text-slate-800">5. Settings</strong> – Dropdowns &amp; profile</li>
          </ul>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="font-bold text-purple-950 uppercase border-b border-slate-100 pb-1.5">
            02. TABLE COLUMNS SPEC
          </div>
          <ul className="space-y-1 text-slate-600">
            <li><strong className="text-slate-800">SL #:</strong> Sequential row number</li>
            <li><strong className="text-slate-800">Item / Grade:</strong> Fish size selector</li>
            <li><strong className="text-slate-800">Quantity:</strong> Weight in KG or Pieces</li>
            <li><strong className="text-slate-800">Rate:</strong> Unit purchase price ({companyProfile.currency})</li>
            <li><strong className="text-slate-800">Total Amount:</strong> Auto Quantity × Rate</li>
            <li><strong className="text-slate-800">Review Summary:</strong> Previous, Paid &amp; Net Balance</li>
          </ul>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="font-bold text-emerald-950 uppercase border-b border-slate-100 pb-1.5">
            03. FORMULA SPECIFICATION
          </div>
          <div className="space-y-1 text-slate-600 font-mono text-[11px] tabular-nums">
            <div>• Row Total = Quantity × Rate</div>
            <div>• Bill Subtotal = Sum(Row Totals)</div>
            <div>• Previous Amount = Brought forward</div>
            <div>• Balance = Subtotal + Previous − Paid</div>
          </div>
          <div className="bg-emerald-50/80 p-2 rounded text-[11px] text-emerald-900 font-sans">
            Generates official printable PDF voucher with Managing Partner &amp; Partner signatures.
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="font-bold text-slate-900 uppercase border-b border-slate-100 pb-1.5">
            04. OPERATOR WORKFLOW
          </div>
          <ol className="space-y-1 text-slate-600 list-decimal list-inside font-medium">
            <li>Select Supplier &amp; verify Bill Date</li>
            <li>Enter Item Grade, Quantity &amp; Rate rows</li>
            <li>Enter Previous Amount &amp; Paid Amount in Review</li>
            <li>Click Save (PDF / .PNG) or Save .PNG to export Challan</li>
          </ol>
        </div>
      </div>

      {/* Offscreen Printable / Exportable Purchase Challan Canvas for Direct PDF & .PNG Export */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div
          id="purchase-voucher-export-canvas"
          style={{
            width: '800px',
            backgroundColor: '#ffffff',
            color: '#000000',
            padding: '32px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Official Header */}
          <div
            style={{ borderBottom: '2px solid #0f172a', paddingBottom: '16px', textAlign: 'center' }}
          >
            <div
              style={{
                color: '#d4af37',
                fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
                fontSize: '32px',
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {companyProfile.companyName}
            </div>
            <div
              style={{
                color: '#000000',
                fontSize: '13px',
                fontWeight: 700,
                marginTop: '4px',
              }}
            >
              Address: {companyProfile.address}
            </div>
            <div
              style={{
                color: '#000000',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'monospace',
                marginTop: '2px',
              }}
            >
              Mobile: {companyProfile.mobiles.join(' , ')}
            </div>
            <div
              style={{
                backgroundColor: '#7c2d4d',
                color: '#ffffff',
                display: 'inline-block',
                marginTop: '10px',
                padding: '5px 18px 9px 18px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
                lineHeight: '1.2',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              PURCHASE DATA ENTRY FORM (LIVE CRABS, EEL FISH &amp; CHILLED FISH GRADES) — CHALLAN / BILL
            </div>
          </div>

          {/* Invoice Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '12px',
              marginTop: '16px',
              fontSize: '12px',
            }}
          >
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>INVOICE NO:</div>
              <div style={{ color: '#0f172a', fontWeight: 900, fontFamily: 'monospace', fontSize: '14px' }}>
                {invoiceNumber || '-'}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>BILL DATE:</div>
              <div style={{ color: '#0f172a', fontWeight: 700, fontFamily: 'monospace' }}>
                {formatDate(date)}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>SUPPLIER:</div>
              <div style={{ color: '#0f172a', fontWeight: 900 }}>
                {description || '-'}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>CONTACT NUMBER:</div>
              <div style={{ color: '#0f172a', fontWeight: 700, fontFamily: 'monospace' }}>
                {contactNumber || '-'}
              </div>
            </div>
          </div>

          {/* Purchase Line Items Table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '16px',
              fontSize: '12px',
              border: '1px solid #cbd5e1',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#7c2d4d',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '6px 8px 10px 8px', border: '1px solid #9d174d', textAlign: 'center', width: '50px' }}>
                  SL #
                </th>
                <th style={{ padding: '6px 8px 10px 8px', border: '1px solid #9d174d', textAlign: 'left' }}>
                  ITEM / GRADE
                </th>
                <th style={{ padding: '6px 8px 10px 8px', border: '1px solid #9d174d', textAlign: 'right', width: '120px' }}>
                  QUANTITY (KG)
                </th>
                <th style={{ padding: '6px 8px 10px 8px', border: '1px solid #9d174d', textAlign: 'right', width: '130px' }}>
                  RATE ({companyProfile.currency})
                </th>
                <th style={{ padding: '6px 8px 10px 8px', border: '1px solid #9d174d', textAlign: 'right', width: '150px' }}>
                  TOTAL AMOUNT ({companyProfile.currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {exportableRows.map((row, idx) => (
                <tr key={row.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    {row.item || '-'}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                    }}
                  >
                    {row.quantity || 0}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {formatCurrency(row.rate || 0, '')}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      backgroundColor: '#fffbeb',
                    }}
                  >
                    {formatCurrency(row.totalAmount || 0, '')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #64748b' }}>
                <td colSpan={2} style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                  TOTAL QUANTITY:
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    color: '#1e3a8a',
                  }}
                >
                  {totalQty} KG
                </td>
                <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                  CURRENT BILL TOTAL:
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    color: '#0f172a',
                  }}
                >
                  {formatCurrency(totalAmount, companyProfile.currency)}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f8fafc', fontSize: '11px', fontWeight: 600 }}>
                <td colSpan={4} style={{ padding: '7px 8px', border: '1px solid #cbd5e1', textAlign: 'right', color: '#475569' }}>
                  PREVIOUS BALANCE (BROUGHT FORWARD):
                </td>
                <td
                  style={{
                    padding: '7px 8px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    color: '#1e293b',
                  }}
                >
                  {formatCurrency(overallPreviousAmount, companyProfile.currency)}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f8fafc', fontSize: '11px', fontWeight: 600 }}>
                <td colSpan={4} style={{ padding: '7px 8px', border: '1px solid #cbd5e1', textAlign: 'right', color: '#475569' }}>
                  LESS: PAID AMOUNT (TODAY):
                </td>
                <td
                  style={{
                    padding: '7px 8px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    color: '#047857',
                  }}
                >
                  - {formatCurrency(overallPaidAmount, companyProfile.currency)}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#e2e8f0', fontSize: '13px', fontWeight: 900 }}>
                <td colSpan={4} style={{ padding: '9px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#0f172a' }}>
                  NET CLOSING BALANCE ({companyProfile.currency}):
                </td>
                <td
                  style={{
                    padding: '9px 8px',
                    border: '1px solid #94a3b8',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    color: '#be123c',
                  }}
                >
                  {formatCurrency(balance, companyProfile.currency)}
                </td>
              </tr>
            </tfoot>
          </table>

          {remarks && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            >
              <strong style={{ color: '#334155' }}>Challan Remarks / Delivery Notes:</strong> {remarks}
            </div>
          )}

          {/* Dual Official Signatures */}
          <div
            style={{
              paddingTop: '48px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '32px',
              textAlign: 'center',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  borderBottom: '2px solid #0f172a',
                  width: '210px',
                  paddingBottom: '6px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    color: '#0f172a',
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                >
                  {companyProfile.managingPartner}
                </div>
              </div>
              <div
                style={{
                  color: '#0f172a',
                  marginTop: '6px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Managing Partner
              </div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
                {companyProfile.companyName}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  borderBottom: '2px solid #0f172a',
                  width: '210px',
                  paddingBottom: '6px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    color: '#0f172a',
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                >
                  {companyProfile.partner}
                </div>
              </div>
              <div
                style={{
                  color: '#0f172a',
                  marginTop: '6px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Partner
              </div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
                {companyProfile.companyName}
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid #e2e8f0',
              color: '#94a3b8',
              textAlign: 'center',
              fontSize: '10px',
              paddingTop: '14px',
              marginTop: '24px',
            }}
          >
            This is an official computer-generated document from {companyProfile.companyName} System • Validated and archived.
          </div>
        </div>
      </div>
    </div>
  );
};
