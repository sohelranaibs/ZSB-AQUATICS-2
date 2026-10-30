import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  calculatePackingRow,
  calculatePackingTotals,
  calculatePackingTotalAmountBDT,
  formatCurrency,
  formatDate,
  formatPackingExportFilename,
  generateInvoiceNumber,
} from '../utils/calculations.ts';
import { PackingItemRow } from '../types/index.ts';
import { validatePackingForm } from '../utils/validation.ts';
import { generateRecordId } from '../utils/idGenerator.ts';
import { exportElementToPng } from '../utils/pdfGenerator.ts';
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
  Plane,
  RotateCcw,
  FileCheck2,
  PackageCheck,
  AlertCircle,
  X,
  Edit2,
  Edit3,
  CheckCircle2,
  ImageDown,
  Loader2,
} from 'lucide-react';
import { ShipmentQrBadge } from './ShipmentQrBadge.tsx';
import {
  PngShareModal,
  WhatsAppIcon,
  WeChatIcon,
} from './PngShareModal.tsx';

export const PackingListView: React.FC = () => {
  const {
    companyProfile,
    dropdownOptions,
    addDropdownItem,
    packings,
    addPacking,
    updatePacking,
    editingPackingId,
    setEditingPackingId,
    openPrintModal,
    setActiveTab,
    showToast,
    openShipmentDetails,
  } = useApp();

  // Manifest Header Fields (From Date & To Date removed per user request)
  const nextInvoiceNo = generateInvoiceNumber('PKG', packings.length);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(nextInvoiceNo);
  const [packingDate, setPackingDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [shippingMark, setShippingMark] = useState<string>('');
  const [flight, setFlight] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [shipper, setShipper] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UNPAID'>(
    'UNPAID'
  );
  const [remarks, setRemarks] = useState<string>('');
  const [lastSavedRecord, setLastSavedRecord] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareChannel, setShareChannel] = useState<'whatsapp' | 'wechat'>('whatsapp');

  // 5 standard empty rows ready for data entry
  const createEmptyRow = (id: string): PackingItemRow => ({
    id,
    item: '',
    box: 0,
    weight: 0,
    totalWeight: 0,
    unit: 'KG',
    rate: 0,
    amount: 0,
  });

  const [rows, setRows] = useState<PackingItemRow[]>([
    createEmptyRow('1'),
    createEmptyRow('2'),
    createEmptyRow('3'),
    createEmptyRow('4'),
    createEmptyRow('5'),
  ]);

  // Search by dropdowns
  const [searchShippingMark, setSearchShippingMark] = useState<string>('ALL');
  const [searchDestination, setSearchDestination] = useState<string>('ALL');

  // Quick Inline Add Modal States
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState<string>('');
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  const validation = validatePackingForm({
    invoiceNumber,
    packingDate,
    shippingMark,
    flight,
    destination,
    shipper,
    paymentStatus,
    rows,
  });

  // Load a previously saved manifest into form for editing
  const handleLoadForEdit = (idToEdit: string) => {
    const found = packings.find((p) => p.id === idToEdit);
    if (!found) return;
    setEditingPackingId(found.id);
    setInvoiceNumber(found.invoiceNumber);
    setPackingDate(found.packingDate);
    setShippingMark(found.shippingMark);
    setFlight(found.flight);
    setDestination(found.destination);
    setShipper(found.shipper);
    setPaymentStatus(found.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID');
    setRemarks(found.remarks || '');

    const loadedRows = found.items.map((it) => {
      const calcs = calculatePackingRow(it.box, it.weight, it.rate);
      return {
        ...it,
        totalWeight: calcs.totalWeight,
        amount: calcs.amount,
      };
    });
    while (loadedRows.length < 5) {
      loadedRows.push(createEmptyRow(generateRecordId('pkgrow')));
    }
    setRows(loadedRows);
    setValidationAttempted(false);
    showToast(`Loaded manifest ${found.invoiceNumber} for editing.`);
  };

  const handleCancelEdit = () => {
    setEditingPackingId(null);
    resetFormFields();
    setInvoiceNumber(generateInvoiceNumber('PKG', packings.length + 1));
    showToast('Exited edit mode. Ready for new manifest entry.');
  };

  // Sync when editingPackingId is selected externally (e.g. from DatabaseView)
  useEffect(() => {
    if (editingPackingId) {
      const found = packings.find((p) => p.id === editingPackingId);
      if (found && found.invoiceNumber !== invoiceNumber) {
        handleLoadForEdit(editingPackingId);
      }
    }
  }, [editingPackingId]);

  // Row update logic (Box, Weight, Rate)
  const handleRowChange = (
    id: string,
    field: keyof PackingItemRow,
    value: string | number
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        const b = field === 'box' ? Number(value) : row.box;
        const w = field === 'weight' ? Number(value) : row.weight;
        const r = field === 'rate' ? Number(value) : row.rate;

        const calcs = calculatePackingRow(b, w, r);
        updated.totalWeight = calcs.totalWeight;
        updated.amount = calcs.amount;

        return updated;
      })
    );
  };

  // Clear single row
  const handleClearRow = (id: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? createEmptyRow(row.id) : row))
    );
  };

  // Add a new blank row at the bottom
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      createEmptyRow(generateRecordId('pkgrow')),
    ]);
  };

  const resetFormFields = () => {
    setShippingMark('');
    setFlight('');
    setDestination('');
    setShipper('');
    setRemarks('');
    setPaymentStatus('UNPAID');
    setPackingDate(new Date().toISOString().slice(0, 10));
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
    setEditingPackingId(null);
    resetFormFields();
    setInvoiceNumber(generateInvoiceNumber('PKG', packings.length + 1));
    showToast('Packing list form cleared and all cells reset.');
  };

  const { totalBox, totalWeight, totalAmount } = calculatePackingTotals(rows);
  const populatedRowCount = rows.filter(
    (r) => r.item.trim() !== '' || r.box !== 0 || r.weight !== 0 || r.rate !== 0
  ).length;
  const avgRatePerKg =
    totalWeight > 0 ? Math.round((totalAmount / totalWeight) * 100) / 100 : 0;

  // Historical stats for the currently selected Shipping Mark
  const markShipments = packings.filter(
    (p) => p.shippingMark.toUpperCase() === shippingMark.toUpperCase()
  );
  const markTotalBoxes = markShipments.reduce((acc, p) => acc + p.totalBox, 0);
  const markTotalWeight = markShipments.reduce((acc, p) => acc + p.totalWeight, 0);

  // Live filtered search results for the right-hand Search By panel
  const filteredSearchRecords = packings.filter((p) => {
    const matchMark =
      searchShippingMark === 'ALL' || p.shippingMark === searchShippingMark;
    const matchDest =
      searchDestination === 'ALL' || p.destination === searchDestination;
    return matchMark && matchDest;
  });

  const handleSavePDF = () => {
    const check = validatePackingForm({
      invoiceNumber,
      packingDate,
      shippingMark,
      flight,
      destination,
      shipper,
      paymentStatus,
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

    if (editingPackingId) {
      const existingRec = packings.find((p) => p.id === editingPackingId);
      const preservedRmbRate = existingRec?.rmbRate;
      const updatedFields = {
        invoiceNumber: invoiceNumber.trim(),
        shippingMark,
        flight,
        destination,
        shipper,
        packingDate,
        fromDate: packingDate,
        toDate: packingDate,
        items: validItems,
        totalBox,
        totalWeight,
        totalAmount,
        rmbRate: preservedRmbRate,
        totalAmountBDT: calculatePackingTotalAmountBDT(totalAmount, preservedRmbRate),
        rmbAmount: totalWeight > 0 ? Math.round((totalAmount / totalWeight) * 100) / 100 : 0,
        settledAmount: totalAmount,
        exporterStatus: paymentStatus,
        remarks,
        paymentDate: paymentStatus === 'PAID' ? packingDate : '',
        paymentStatus,
        billSite: destination,
      };

      updatePacking(editingPackingId, updatedFields);

      const updatedRecord = {
        ...updatedFields,
        id: editingPackingId,
        createdAt: new Date().toISOString(),
      };

      openPrintModal({
        type: 'packing',
        title: `Export Packing List (Updated) - ${updatedRecord.invoiceNumber}`,
        data: updatedRecord,
        items: validItems,
      });

      setLastSavedRecord({ id: editingPackingId, invoiceNumber: updatedRecord.invoiceNumber });
      setEditingPackingId(null);
      resetFormFields();
      setInvoiceNumber(generateInvoiceNumber('PKG', packings.length));
      showToast(
        `Export packing manifest ${updatedRecord.invoiceNumber} updated successfully! Click "Edit" if you need further adjustments.`
      );
      return;
    }

    const newRecord = {
      invoiceNumber: invoiceNumber.trim(),
      shippingMark,
      flight,
      destination,
      shipper,
      packingDate,
      fromDate: packingDate,
      toDate: packingDate,
      items: validItems,
      totalBox,
      totalWeight,
      totalAmount,
      rmbAmount: totalWeight > 0 ? Math.round((totalAmount / totalWeight) * 100) / 100 : 0,
      settledAmount: totalAmount,
      exporterStatus: paymentStatus,
      remarks,
      paymentDate: paymentStatus === 'PAID' ? packingDate : '',
      paymentStatus,
      billSite: destination,
    };

    const newId = addPacking(newRecord);
    setLastSavedRecord({ id: newId, invoiceNumber: newRecord.invoiceNumber });

    openPrintModal({
      type: 'packing',
      title: `Export Packing List - ${newRecord.invoiceNumber}`,
      data: newRecord,
      items: validItems,
    });

    setInvoiceNumber(generateInvoiceNumber('PKG', packings.length + 1));
    resetFormFields();
    showToast(
      `Export packing manifest ${newRecord.invoiceNumber} saved successfully. Click "Edit" if you need to update rates later.`
    );
  };

  const exportableRows = (() => {
    const validItems = rows.filter(
      (r) => r.item.trim() !== '' || r.box > 0 || r.weight > 0 || r.rate > 0
    );
    return validItems.length > 0 ? validItems : rows.slice(0, 5);
  })();

  const handlePrintSelected = () => {
    openPrintModal({
      type: 'packing',
      title: `Export Packing List - ${invoiceNumber}`,
      data: {
        invoiceNumber,
        shippingMark,
        flight,
        destination,
        shipper,
        packingDate,
        fromDate: packingDate,
        toDate: packingDate,
        items: exportableRows,
        totalBox,
        totalWeight,
        totalAmount,
        remarks,
      },
      items: exportableRows,
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
        showToast('Added new line item row to Export Packing List (Alt+N).');
      } else if (action === 'RESET_FORM') {
        customEvent.detail.handled = true;
        handleClear();
      }
    };

    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
  });

  const handleDirectSavePng = async () => {
    setIsExportingPng(true);
    const filename = formatPackingExportFilename(invoiceNumber, shippingMark, packingDate, 'png');
    try {
      const success = await exportElementToPng('packing-manifest-export-canvas', filename, 800);
      if (success) {
        showToast(`PNG image downloaded: ${filename}`);
      } else {
        showToast('Opening Document Print Preview...');
        handlePrintSelected();
      }
    } catch (err) {
      console.error('Packing PNG export error:', err);
      showToast('Error generating PNG image.');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleMonthlyStatement = () => {
    const matched = packings.filter((p) => p.shippingMark === shippingMark);
    openPrintModal({
      type: 'monthly_statement',
      title: `Monthly Export Statement - Mark: ${shippingMark}`,
      data: {
        party: `Mark: ${shippingMark} / Shipper: ${shipper}`,
        date: packingDate,
        records: matched,
        totalRecords: matched.length,
      },
    });
  };

  const handleSearchClick = () => {
    setActiveTab('packing_db');
    showToast(
      `Filtering Packing DB — Mark: ${searchShippingMark}, Destination: ${searchDestination}`
    );
  };

  const handleAddCustomOption = () => {
    if (!addingCategory || !newOptionValue.trim()) return;
    const cat = addingCategory as any;
    addDropdownItem(cat, newOptionValue.trim());
    if (addingCategory === 'shippingMarks') setShippingMark(newOptionValue.trim());
    if (addingCategory === 'flights') setFlight(newOptionValue.trim());
    if (addingCategory === 'destinations') setDestination(newOptionValue.trim());
    if (addingCategory === 'shippers') setShipper(newOptionValue.trim());
    setNewOptionValue('');
    setAddingCategory(null);
  };

  return (
    <div className="p-3 sm:p-5 max-w-[1440px] mx-auto space-y-5">
      {/* Top Banner with Official ZSB Branding */}
      <div className="bg-[#1e2548] text-white px-5 py-3.5 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="zsb-3d-text text-xl sm:text-2xl font-black">
                {companyProfile.companyName}
              </span>
              <span className="text-slate-400 hidden sm:inline">·</span>
              <span className="text-sm sm:text-base font-semibold text-slate-100 tracking-wide">
                Export Packing List — Manifest Entry Form
              </span>
            </div>
            <div className="mt-1 inline-flex flex-wrap items-center gap-2 bg-amber-50/95 px-2.5 py-0.5 rounded text-[11px] font-semibold text-black">
              <span>{companyProfile.address}</span>
              <span>|</span>
              <span className="font-mono">
                Mob: {companyProfile.mobiles.join(', ')}
              </span>
              <span>|</span>
              <span className="font-mono">
                EMAIL: {companyProfile.email || 'www.zsbaquatics.com'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200 font-mono tabular-nums">
          <span>
            Active Rows: <strong>{populatedRowCount}</strong>/{rows.length}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-300 font-bold">
            {totalBox} Boxes ({totalWeight.toFixed(2)} KG)
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300 font-bold">
            {formatCurrency(totalAmount, 'RMB')}
          </span>
          <span aria-hidden="true">·</span>
          <span className="bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded border border-amber-400/40">
            Sheet #3
          </span>
        </div>
      </div>

      {/* Main Grid: Redesigned Packing List Voucher (Left 9 Cols) + Action & Search Controls (Right 3 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Packing List Data Entry Sheet (9 Cols) */}
        <div className="lg:col-span-9 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden">
            {/* Sheet Title Header */}
            <div className="bg-[#8b3858] text-white py-3 px-5 flex flex-wrap items-center justify-between gap-3 border-b border-pink-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-300 bg-white p-0.5 shrink-0 shadow-xs flex items-center justify-center">
                  <img
                    src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                    alt={companyProfile.companyName}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div>
                  <div className="zsb-3d-text text-lg sm:text-xl font-black">
                    {companyProfile.companyName}
                  </div>
                  <div className="text-xs font-semibold tracking-wider uppercase text-pink-100">
                    PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST)
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrintSelected}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                    title="Open Document Print Preview (Save as PDF & Save as .PNG)"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                    <span>PRINT / SAVE PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectSavePng}
                    disabled={isExportingPng}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    title="Download Export Packing List Manifest as .PNG image"
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
                  <div className="text-[11px] text-pink-200 uppercase">Manifest Ref</div>
                  <div className="font-bold text-amber-300 text-sm">{invoiceNumber}</div>
                </div>
              </div>
            </div>

            {/* Edit Mode Active Banner */}
            {editingPackingId && (
              <div className="bg-amber-100 border-b-2 border-amber-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-800 shrink-0" />
                  <span className="font-black text-amber-950 uppercase tracking-wide">
                    EDIT MODE ACTIVE:
                  </span>
                  <span className="font-mono font-bold text-slate-900 bg-amber-200 px-2 py-0.5 rounded border border-amber-400">
                    {invoiceNumber}
                  </span>
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                    Status: {paymentStatus}
                  </span>
                  <span className="text-amber-800 hidden md:inline">
                    (Modify status, rates, or items, then click <strong>UPDATE MANIFEST</strong>)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded shadow-2xs transition cursor-pointer"
                >
                  Cancel Edit / New Entry
                </button>
              </div>
            )}

            {/* Quick Edit Last Saved Manifest Banner */}
            {lastSavedRecord && !editingPackingId && (
              <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Manifest <strong className="font-mono text-emerald-950">{lastSavedRecord.invoiceNumber}</strong> saved successfully.
                  </span>
                  <span className="text-[11px] text-emerald-700 hidden sm:inline">
                    Need to update rate or report status?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadForEdit(lastSavedRecord.id)}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow-2xs transition cursor-pointer flex items-center space-x-1"
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
                data-testid="packing-validation-alert"
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

            {/* Redesigned Shipment Metadata Strip (Without From Date and To Date) */}
            <div className="p-4 bg-amber-50/40 border-b border-slate-200 space-y-3">
              <div
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs"
                data-testid="packing-metadata-grid"
              >
                {/* 1. Packing / Invoice No */}
                <div>
                  <label
                    htmlFor="packing-invoice-no"
                    className="font-bold text-slate-700 uppercase block mb-1 whitespace-nowrap"
                  >
                    PACKING NO. <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="packing-invoice-no"
                    type="text"
                    aria-invalid={
                      validationAttempted && Boolean(validation.fieldErrors.invoiceNumber)
                    }
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className={`w-full bg-white border rounded-lg px-2.5 py-2 font-mono font-bold text-blue-950 focus:outline-none focus:ring-2 ${
                      validationAttempted && validation.fieldErrors.invoiceNumber
                        ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-amber-500'
                    }`}
                  />
                </div>

                {/* 2. Packing Date */}
                <div>
                  <label
                    htmlFor="packing-date-input"
                    className="font-bold text-slate-700 uppercase block mb-1 whitespace-nowrap"
                  >
                    PACKING DATE <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="packing-date-input"
                    type="date"
                    aria-invalid={
                      validationAttempted && Boolean(validation.fieldErrors.packingDate)
                    }
                    value={packingDate}
                    onChange={(e) => setPackingDate(e.target.value)}
                    className={`w-full bg-white border rounded-lg px-2.5 py-2 text-slate-800 font-mono font-semibold focus:outline-none focus:ring-2 ${
                      validationAttempted && validation.fieldErrors.packingDate
                        ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-amber-500'
                    }`}
                  />
                </div>

                {/* 3. Shipping Mark */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="packing-shipping-mark"
                      className="font-bold text-slate-700 uppercase whitespace-nowrap"
                    >
                      SHIPPING MARK <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddingCategory('shippingMarks')}
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer whitespace-nowrap"
                    >
                      + Add
                    </button>
                  </div>
                  <select
                    id="packing-shipping-mark"
                    aria-invalid={
                      validationAttempted && Boolean(validation.fieldErrors.shippingMark)
                    }
                    value={shippingMark}
                    onChange={(e) => setShippingMark(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Select Shipping Mark --</option>
                    {dropdownOptions.shippingMarks.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Flight */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="packing-flight-select"
                      className="font-bold text-slate-700 uppercase whitespace-nowrap"
                    >
                      FLIGHT <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddingCategory('flights')}
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer whitespace-nowrap"
                    >
                      + Add
                    </button>
                  </div>
                  <select
                    id="packing-flight-select"
                    value={flight}
                    onChange={(e) => setFlight(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Select Flight --</option>
                    {dropdownOptions.flights.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Destination */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="packing-destination-select"
                      className="font-bold text-slate-700 uppercase whitespace-nowrap"
                    >
                      DESTINATION <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddingCategory('destinations')}
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer whitespace-nowrap"
                    >
                      + Add
                    </button>
                  </div>
                  <select
                    id="packing-destination-select"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Select Destination --</option>
                    {dropdownOptions.destinations.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Shipper */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="packing-shipper-select"
                      className="font-bold text-slate-700 uppercase whitespace-nowrap"
                    >
                      SHIPPER <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddingCategory('shippers')}
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer whitespace-nowrap"
                    >
                      + Add
                    </button>
                  </div>
                  <select
                    id="packing-shipper-select"
                    value={shipper}
                    onChange={(e) => setShipper(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Select Shipper --</option>
                    {dropdownOptions.shippers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mark History & Exporter Payment Slip Sync Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-amber-200/80 text-xs text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Plane className="w-3.5 h-3.5 text-[#8b3858] shrink-0" />
                  <span>
                    Mark <strong className="text-blue-950 font-mono">{shippingMark}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {markShipments.length} Saved Manifest(s)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Cumulative: <strong>{markTotalBoxes} Boxes</strong> ({markTotalWeight} KG)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Exporter Payment Status"
                    value={paymentStatus}
                    onChange={(e) =>
                      setPaymentStatus(
                        e.target.value as 'PAID' | 'UNPAID'
                      )
                    }
                    className="bg-white border border-slate-300 rounded-md px-2 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="PAID">PAID</option>
                    <option value="UNPAID">UNPAID</option>
                  </select>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      paymentStatus === 'UNPAID'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {paymentStatus === 'UNPAID'
                      ? 'Rate: ≥ 0 (Unpaid)'
                      : 'Rate: > 0 Required (Paid)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Add Inline Bar */}
            {addingCategory && (
              <div className="p-3 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-blue-950 uppercase">
                  Add to {addingCategory}:
                </span>
                <input
                  type="text"
                  placeholder="Enter new preset value..."
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  className="bg-white border border-blue-300 rounded-md px-2.5 py-1.5 text-slate-800 font-medium flex-1 min-w-[180px] max-w-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomOption}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 cursor-pointer"
                >
                  Save Option
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCategory(null);
                    setNewOptionValue('');
                  }}
                  className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Redesigned Manifest Line-Item Table Grid */}
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-xs"
                data-testid="packing-entry-table"
              >
                <thead>
                  <tr className="bg-[#e67327] text-white uppercase text-[11px] font-bold tracking-wider border-b border-amber-800">
                    <th className="px-2 py-2.5 border-r border-amber-600/60 w-10 text-center">
                      SL #
                    </th>
                    <th className="px-2.5 py-2.5 border-r border-amber-600/60 text-left min-w-[150px]">
                      <div className="flex items-center justify-between">
                        <span>ITEM / SIZE</span>
                        <button
                          type="button"
                          onClick={() => setAddingCategory('exportItems')}
                          className="text-[9px] bg-amber-900/90 hover:bg-amber-950 px-1.5 py-0.5 rounded text-amber-200 font-bold cursor-pointer"
                          title="Add new export item"
                        >
                          +New
                        </button>
                      </div>
                    </th>
                    <th className="px-2 py-2.5 border-r border-amber-600/60 w-24 text-center">
                      <div className="flex items-center justify-between px-1">
                        <span>BOX</span>
                        <button
                          type="button"
                          onClick={() => setAddingCategory('boxes')}
                          className="text-[9px] bg-amber-900/90 hover:bg-amber-950 px-1 py-0.5 rounded text-amber-200 cursor-pointer"
                          title="Add box preset"
                        >
                          +
                        </button>
                      </div>
                    </th>
                    <th className="px-2 py-2.5 border-r border-amber-600/60 w-24 text-center">
                      <div className="flex items-center justify-between px-1">
                        <span>WEIGHT (KG)</span>
                        <button
                          type="button"
                          onClick={() => setAddingCategory('weights')}
                          className="text-[9px] bg-amber-900/90 hover:bg-amber-950 px-1 py-0.5 rounded text-amber-200 cursor-pointer"
                          title="Add weight preset"
                        >
                          +
                        </button>
                      </div>
                    </th>
                    <th className="px-2.5 py-2.5 border-r border-amber-600/60 w-28 text-right">
                      TOTAL WEIGHT
                    </th>
                    <th className="px-2 py-2.5 border-r border-amber-600/60 w-20 text-center">
                      UNIT
                    </th>
                    <th className="px-2.5 py-2.5 border-r border-amber-600/60 w-28 text-right">
                      <div>RATE (RMB)</div>
                      <div className="text-[9px] font-normal lowercase tracking-normal text-amber-100">
                        {paymentStatus === 'UNPAID' ? '≥ 0 (Unpaid)' : '> 0 (Required)'}
                      </div>
                    </th>
                    <th className="px-2.5 py-2.5 border-r border-amber-600/60 w-32 text-right">
                      TOTAL AMOUNT (RMB)
                    </th>
                    <th className="px-2 py-2.5 w-12 text-center">CLR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((row, idx) => {
                    const isFilled =
                      row.item.trim() !== '' ||
                      row.box !== 0 ||
                      row.weight !== 0 ||
                      row.rate !== 0;
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
                            ? 'bg-amber-50/25 hover:bg-amber-50/60'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-slate-50/50 hover:bg-slate-100/60'
                        }`}
                      >
                        {/* Row Number */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-500 font-semibold">
                          {String(idx + 1).padStart(2, '0')}
                        </td>

                        {/* Item Dropdown */}
                        <td className="p-1.5 border-r border-slate-200">
                          <select
                            aria-label={`Row ${idx + 1} Export Item`}
                            aria-invalid={Boolean(rowErr?.item || highlightFirstEmptyRow)}
                            value={row.item}
                            onChange={(e) =>
                              handleRowChange(row.id, 'item', e.target.value)
                            }
                            className={`w-full border rounded-md px-2 py-1.5 font-semibold focus:bg-white focus:outline-none focus:ring-2 ${
                              rowErr?.item || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                                : row.item
                                ? 'bg-white border-slate-300 text-slate-900 focus:ring-amber-500'
                                : 'bg-slate-50 border-slate-200 text-slate-500 focus:ring-amber-500'
                            }`}
                          >
                            <option value="">-- Select Grade / Size --</option>
                            {dropdownOptions.exportItems.map((it) => (
                              <option key={it} value={it}>
                                {it}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Box Dropdown */}
                        <td className="p-1.5 border-r border-slate-200">
                          <select
                            aria-label={`Row ${idx + 1} Box`}
                            aria-invalid={Boolean(rowErr?.box || highlightFirstEmptyRow)}
                            value={row.box || ''}
                            onChange={(e) =>
                              handleRowChange(
                                row.id,
                                'box',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full bg-white border rounded-md px-2 py-1.5 text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 ${
                              rowErr?.box || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-amber-500'
                            }`}
                          >
                            <option value="0">-</option>
                            {dropdownOptions.boxes.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Weight Dropdown */}
                        <td className="p-1.5 border-r border-slate-200">
                          <select
                            aria-label={`Row ${idx + 1} Weight`}
                            aria-invalid={Boolean(rowErr?.weight || highlightFirstEmptyRow)}
                            value={row.weight || ''}
                            onChange={(e) =>
                              handleRowChange(
                                row.id,
                                'weight',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full bg-white border rounded-md px-2 py-1.5 text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 ${
                              rowErr?.weight || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-amber-500'
                            }`}
                          >
                            <option value="0">-</option>
                            {dropdownOptions.weights.map((w) => (
                              <option key={w} value={w}>
                                {w} KG
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Total Weight (Box * Weight) */}
                        <td
                          data-testid={`packing-row-${idx + 1}-weight`}
                          className="p-1.5 border-r border-slate-200 bg-amber-50/40 text-right font-mono font-bold tabular-nums text-teal-800 pr-2.5"
                        >
                          {row.totalWeight > 0 ? `${row.totalWeight} KG` : '0'}
                        </td>

                        {/* Unit Dropdown */}
                        <td className="p-1.5 border-r border-slate-200">
                          <select
                            aria-label={`Row ${idx + 1} Unit`}
                            value={row.unit}
                            onChange={(e) =>
                              handleRowChange(row.id, 'unit', e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1.5 text-center text-[11px] font-bold text-slate-700"
                          >
                            {dropdownOptions.units.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Rate Input */}
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
                            className={`w-full bg-white border rounded-md px-2 py-1.5 text-right font-mono tabular-nums text-slate-800 focus:outline-none focus:ring-2 ${
                              rowErr?.rate || highlightFirstEmptyRow
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                                : 'border-slate-200 focus:ring-amber-500'
                            }`}
                            placeholder={paymentStatus === 'UNPAID' ? '0.00' : 'Rate > 0'}
                          />
                        </td>

                        {/* Amount (Total Weight * Rate) */}
                        <td
                          data-testid={`packing-row-${idx + 1}-total`}
                          className="p-1.5 border-r border-slate-200 text-right font-mono font-bold tabular-nums text-slate-900 pr-2.5 bg-slate-50/40"
                        >
                          {row.amount > 0 ? formatCurrency(row.amount, '') : '0.00'}
                        </td>

                        {/* Single Row Clear Button */}
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleClearRow(row.id)}
                            disabled={!isFilled}
                            title="Clear row"
                            className={`p-1.5 rounded transition ${
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

                {/* Subtotals Row */}
                <tfoot>
                  <tr className="bg-[#e67327] text-white font-bold border-t-2 border-amber-800">
                    <td
                      colSpan={2}
                      className="px-3 py-2.5 text-right uppercase tracking-wider text-xs border-r border-amber-600/60"
                    >
                      MANIFEST SUBTOTALS:
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono tabular-nums text-amber-100 text-sm font-black border-r border-amber-600/60">
                      {totalBox} Boxes
                    </td>
                    <td className="px-2 py-2.5 text-right uppercase text-[11px] border-r border-amber-600/60">
                      TOTAL WT:
                    </td>
                    <td
                      data-testid="packing-footer-weight"
                      className="px-2.5 py-2.5 text-right font-mono tabular-nums text-amber-100 text-sm font-black border-r border-amber-600/60"
                    >
                      {totalWeight.toFixed(2)} KG
                    </td>
                    <td
                      colSpan={2}
                      className="px-2.5 py-2.5 text-right uppercase text-[11px] border-r border-amber-600/60"
                    >
                      TOTAL VALUE:
                    </td>
                    <td
                      colSpan={2}
                      data-testid="packing-footer-total"
                      className="px-2.5 py-2.5 text-right font-mono tabular-nums text-white text-sm font-black pr-3"
                    >
                      {formatCurrency(totalAmount, 'RMB')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Table Action Bar (+ Add Row & Formula Summary) */}
            <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 font-bold text-slate-700 shadow-2xs cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-600" />
                  <span>Add Blank Row</span>
                </button>
                <span className="text-slate-500 font-mono text-[11px]">
                  ({populatedRowCount} of {rows.length} rows populated)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-mono">
                Formula: <strong>Total Weight = Box × Weight</strong> ·{' '}
                <strong>Total Amount = Total Weight × Rate</strong>
              </div>
            </div>

            {/* Manifest KPI Summary Strip & Remarks */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    TOTAL CARTONS / BOXES
                  </div>
                  <div className="text-base font-black font-mono tabular-nums text-slate-900 mt-0.5">
                    {totalBox} <span className="text-xs font-semibold text-slate-500">Boxes</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    TOTAL NET WEIGHT
                  </div>
                  <div className="text-base font-black font-mono tabular-nums text-teal-800 mt-0.5">
                    {totalWeight.toFixed(2)}{' '}
                    <span className="text-xs font-semibold text-teal-600">KG</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    AVG EXPORT RATE / KG
                  </div>
                  <div className="text-base font-black font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatCurrency(avgRatePerKg, 'RMB')}
                  </div>
                </div>

                <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-300 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-amber-900">
                    TOTAL MANIFEST VALUE
                  </div>
                  <div
                    data-testid="packing-summary-total"
                    className="text-base font-black font-mono tabular-nums text-amber-950 mt-0.5"
                  >
                    {formatCurrency(totalAmount, 'RMB')}
                  </div>
                </div>
              </div>

              {/* Remarks input */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs pt-1">
                <label
                  htmlFor="packing-remarks-input"
                  className="font-bold text-slate-700 uppercase whitespace-nowrap"
                >
                  Manifest Remarks:
                </label>
                <input
                  id="packing-remarks-input"
                  type="text"
                  placeholder="e.g. Oxygenated poly bags, Airway bill handover notes, temperature check..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Live Shipment QR Code Preview & Direct System Link */}
              <ShipmentQrBadge
                shipment={{
                  id: editingPackingId || undefined,
                  invoiceNumber,
                  shippingMark,
                  packingDate,
                  flight,
                  destination,
                  totalBox,
                  totalWeight,
                  totalAmount,
                }}
                showInteractiveControls={true}
                onOpenInSystem={openShipmentDetails}
                testIdPrefix="packing-form-shipment-qr"
              />
            </div>
          </div>
        </div>

        {/* Right: ACTION BUTTONS, SEARCH BY, & RECENT MARK SHIPMENTS (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Action Buttons Container */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ACTION BUTTONS
            </div>

            {/* SAVE (PDF / .PNG) / UPDATE MANIFEST Button */}
            {editingPackingId ? (
              <>
                <button
                  type="button"
                  onClick={handleSavePDF}
                  className="w-full bg-[#d97706] hover:bg-[#b45309] text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <Edit3 className="w-4 h-4 text-amber-200 shrink-0" />
                  <span>UPDATE MANIFEST (SAVE)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span>CANCEL EDIT (NEW MANIFEST)</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSavePDF}
                className="w-full text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer bg-[#129c54] hover:bg-[#0e8346] whitespace-nowrap"
                title="Save Manifest and open Document Print Preview (Shortcut: Ctrl+S)"
              >
                <Save className="w-5 h-5 shrink-0" />
                <span>SAVE (PDF / .PNG)</span>
                <span className="text-[10px] font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded text-amber-200">
                  Ctrl+S
                </span>
              </button>
            )}

            {/* Direct Save .PNG & Document Print Preview Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDirectSavePng}
                disabled={isExportingPng}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-3 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Download Export Packing List Manifest directly as a .PNG image"
              >
                {isExportingPng ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>PNG...</span>
                  </>
                ) : (
                  <>
                    <ImageDown className="w-3.5 h-3.5 shrink-0" />
                    <span>SAVE .PNG</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrintSelected}
                className="w-full bg-[#0891b2] hover:bg-[#0e7490] text-white py-2.5 px-3 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer whitespace-nowrap"
                title="Open Document Print Preview"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>PRINT / PDF</span>
              </button>
            </div>

            {/* Share via WhatsApp & WeChat (.PNG) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="packing-share-whatsapp-btn"
                onClick={() => {
                  setShareChannel('whatsapp');
                  setIsShareModalOpen(true);
                }}
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white py-2 px-2.5 rounded-lg font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                title="Share Packing List Manifest .PNG to WhatsApp"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                <span>WHATSAPP</span>
              </button>

              <button
                type="button"
                data-testid="packing-share-wechat-btn"
                onClick={() => {
                  setShareChannel('wechat');
                  setIsShareModalOpen(true);
                }}
                className="w-full bg-[#07C160] hover:bg-[#06a853] text-white py-2 px-2.5 rounded-lg font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                title="Share Packing List Manifest .PNG to WeChat (微信)"
              >
                <WeChatIcon className="w-3.5 h-3.5 shrink-0" />
                <span>WECHAT (微信)</span>
              </button>
            </div>

            {/* SEARCH Button - Royal Blue */}
            {/* FLIGHT RETURN BILL Monthly Statement Button */}
            <button
              type="button"
              data-testid="packing-open-awb-btn"
              onClick={() => setActiveTab('air_way_bill')}
              className="w-full bg-[#2f75b5] hover:bg-[#245c8f] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>FLIGHT RETURN BILL STATEMENT</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('packing_db')}
              className="w-full bg-[#1b73b4] hover:bg-[#165f95] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>SEARCH PACKING DB</span>
            </button>

            {/* CLEAR Button - Red */}
            <button
              type="button"
              onClick={handleClear}
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>CLEAR</span>
            </button>

            {/* EDIT / UPDATE MANIFEST Quick Selector */}
            <div className="pt-2 border-t border-slate-200">
              <label
                htmlFor="edit-manifest-select"
                className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center space-x-1"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>EDIT SAVED MANIFEST:</span>
              </label>
              <select
                id="edit-manifest-select"
                aria-label="Select saved manifest to edit"
                value={editingPackingId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleLoadForEdit(e.target.value);
                  } else {
                    handleCancelEdit();
                  }
                }}
                className="w-full bg-amber-50/80 border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="">
                  {packings.length > 0 ? '-- Select Manifest to Edit --' : '-- No saved manifests --'}
                </option>
                {packings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.invoiceNumber} — {p.shippingMark} ({p.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SEARCH BY Container (Live Filter + Quick Preview) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                SEARCH BY
              </div>
              <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {filteredSearchRecords.length} Match(es)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Shipping Mark
                </label>
                <select
                  value={searchShippingMark}
                  onChange={(e) => setSearchShippingMark(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold bg-white"
                >
                  <option value="ALL">ALL MARKS</option>
                  {dropdownOptions.shippingMarks.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Destination
                </label>
                <select
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold bg-white"
                >
                  <option value="ALL">ALL DESTINATIONS</option>
                  {dropdownOptions.destinations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matching Shipments Mini List */}
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {filteredSearchRecords.slice(0, 4).map((rec) => (
                <div
                  key={rec.id}
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50/40 flex items-center justify-between gap-2 text-xs transition"
                >
                  <div>
                    <div className="font-bold text-slate-900 font-mono">
                      {rec.invoiceNumber}{' '}
                      <span className="text-blue-800">({rec.shippingMark})</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(rec.packingDate)} · {rec.destination} · {rec.totalBox} Box (
                      {rec.totalWeight} KG)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openPrintModal({
                        type: 'packing',
                        title: `Export Packing List - ${rec.invoiceNumber}`,
                        data: rec,
                        items: rec.items,
                      })
                    }
                    className="px-2 py-1 bg-white border border-slate-300 hover:border-blue-500 text-blue-700 rounded text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSearchClick}
              className="w-full bg-[#3b5998] hover:bg-[#2d4373] text-white py-2 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>OPEN IN PACKING DB</span>
            </button>
          </div>

          {/* System Flow Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              SYSTEM FLOW
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-purple-900">1. Manifest Header Entry</div>
                  <div className="text-[11px] text-slate-500">
                    Packing No, Date, Mark, Flight &amp; Shipper
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-blue-900">2. Weight &amp; Value Engine</div>
                  <div className="text-[11px] text-slate-500">
                    Auto Box × Weight &amp; Export Rate Tally
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-emerald-900">
                    3. Packing DB &amp; Exporter Slip (付款单)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Instant sync to Exporter Payment Slip
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Offscreen Printable / Exportable Packing Manifest Canvas for Direct .PNG and PDF Export */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div
          id="packing-manifest-export-canvas"
          style={{
            width: '800px',
            backgroundColor: '#ffffff',
            color: '#000000',
            padding: '32px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Official Document Header */}
          <div
            style={{ borderBottom: '2px solid #0f172a', paddingBottom: '16px', textAlign: 'center' }}
          >
            {/* Official Company Logo Emblem */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  border: '2px solid #d4af37',
                  backgroundColor: '#ffffff',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                  alt={companyProfile.companyName}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                />
              </div>
            </div>

            <div
              className="zsb-3d-text-print"
              style={{
                color: '#f59e0b',
                fontFamily: "'Cinzel', Georgia, Cambria, 'Times New Roman', Times, serif",
                fontSize: '32px',
                fontWeight: 900,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                textShadow:
                  '1px 1px 0px #b45309, 2px 2px 0px #92400e, 3px 3px 0px #78350f, 4px 4px 0px #451a03, 5px 5px 7px rgba(15, 23, 42, 0.35)',
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
              Mobile: {companyProfile.mobiles.join(' , ')} | EMAIL: {companyProfile.email || 'www.zsbaquatics.com'}
            </div>
            <div
              style={{
                backgroundColor: '#0f172a',
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
              EXPORT AIR PACKING LIST MANIFEST
            </div>
          </div>

          {/* Manifest Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '12px',
              marginTop: '16px',
              fontSize: '12px',
            }}
          >
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>PACKING NO:</div>
              <div style={{ color: '#0f172a', fontWeight: 900, fontFamily: 'monospace', fontSize: '14px' }}>
                {invoiceNumber || '-'}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>SHIPPING MARK:</div>
              <div style={{ color: '#1e3a8a', fontWeight: 900, fontSize: '14px' }}>
                {shippingMark || '-'}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>PACKING DATE:</div>
              <div style={{ color: '#0f172a', fontWeight: 700, fontFamily: 'monospace' }}>
                {formatDate(packingDate)}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>FLIGHT:</div>
              <div style={{ color: '#0f172a', fontWeight: 700 }}>{flight || '-'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>DESTINATION:</div>
              <div style={{ color: '#0f172a', fontWeight: 700 }}>{destination || '-'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>SHIPPER:</div>
              <div style={{ color: '#0f172a', fontWeight: 700 }}>{shipper || '-'}</div>
            </div>
          </div>

          {/* Manifest Line Items Table */}
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
                  backgroundColor: '#f1f5f9',
                  color: '#1e293b',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', width: '40px' }}>
                  SL
                </th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>
                  ITEM / SIZE
                </th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', width: '70px' }}>
                  BOX
                </th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', width: '70px' }}>
                  WEIGHT (KG)
                </th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right', width: '100px' }}>
                  TOTAL WEIGHT
                </th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', width: '60px' }}>
                  UNIT
                </th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>
                  RATE (RMB)
                </th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right', width: '110px' }}>
                  AMOUNT (RMB)
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
                    {idx + 1}
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
                      textAlign: 'center',
                      fontFamily: 'monospace',
                    }}
                  >
                    {row.box || 0}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                    }}
                  >
                    {row.weight || 0}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#115e59',
                    }}
                  >
                    {(row.totalWeight || 0).toFixed(2)} KG
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {row.unit || 'KG'}
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
                    }}
                  >
                    {formatCurrency(row.amount || 0, '')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #64748b' }}>
                <td colSpan={2} style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                  TOTALS:
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    color: '#0f172a',
                  }}
                >
                  {totalBox} Boxes
                </td>
                <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}></td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    color: '#115e59',
                  }}
                >
                  {totalWeight.toFixed(2)} KG
                </td>
                <td colSpan={2} style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                  TOTAL INVOICE VALUE:
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
                  {formatCurrency(totalAmount, 'RMB')}
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
              <strong style={{ color: '#334155' }}>Flight &amp; Handling Remarks:</strong> {remarks}
            </div>
          )}

          {/* Shipment QR Code for Direct System Lookup on PNG Export Canvas */}
          <ShipmentQrBadge
            shipment={{
              id: editingPackingId || undefined,
              invoiceNumber,
              shippingMark,
              packingDate,
              flight,
              destination,
              totalBox,
              totalWeight,
              totalAmount,
            }}
            inlineStylesOnly={true}
            testIdPrefix="packing-canvas-shipment-qr"
          />

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

      {/* Interactive PNG WeChat & WhatsApp Share Modal */}
      {isShareModalOpen && (
        <PngShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title={`Air Freight Export Packing Manifest — #${invoiceNumber} (Mark: ${shippingMark || 'ALL'})`}
          documentType="packing"
          documentData={{
            invoiceNumber,
            shippingMark,
            packingDate,
            flight,
            destination,
            shipper,
            totalBox,
            totalWeight,
            totalAmount,
            remarks,
          }}
          targetElementId="packing-manifest-export-canvas"
          defaultFilename={formatPackingExportFilename(invoiceNumber, shippingMark, packingDate, 'png')}
          defaultPhone=""
        />
      )}
    </div>
  );
};
