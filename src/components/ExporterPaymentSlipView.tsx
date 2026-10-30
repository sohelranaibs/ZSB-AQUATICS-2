import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  DEFAULT_EXPORTER_SLIP_ROWS,
  formatExporterSlipExportFilename,
  buildExporterPaymentSlipRows,
  calculateExporterSlipRowAmount,
  calculateExporterSlipTotals,
  createEmptyExporterSlipRow,
  createInitialExporterSlipRows,
  isExporterSlipRowPopulated,
  mergeExporterPaymentSlipRows,
  generateInvoiceNumber,
  formatDate,
  formatRMB,
  calculatePaymentRow,
} from '../utils/calculations.ts';
import {
  EXPORTER_STATUS_OPTIONS,
  ExporterRecordHistoryRow,
  buildExporterRecordHistory,
  calculateExporterHistoryTotals,
} from '../utils/exporterHistory.ts';
import { ExporterPaymentSlipRow, ExporterStatus } from '../types/index.ts';
import { generateRecordId } from '../utils/idGenerator.ts';
import { exportElementToPng } from '../utils/pdfGenerator.ts';
import {
  ZSB_VIEW_SHORTCUT_EVENT,
  ViewShortcutEventDetail,
} from '../utils/keyboardShortcuts.ts';
import {
  Printer,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  Calendar,
  Tag,
  Plane,
  CheckCircle2,
  Database,
  PlusCircle,
  Plus,
  Trash2,
  Save,
  ImageDown,
  Loader2,
} from 'lucide-react';

import {
  PngShareModal,
  WhatsAppIcon,
  WeChatIcon,
} from './PngShareModal.tsx';

const CUSTOM_SLIP_ROWS_STORAGE_KEY = 'zsb_exporter_slip_custom_rows_v3';

export const ExporterPaymentSlipView: React.FC = () => {
  const {
    packings,
    payments,
    addPacking,
    updatePacking,
    updatePayment,
    dropdownOptions,
    companyProfile,
    openPrintModal,
    setActiveTab,
    showToast,
  } = useApp();

  // Primary automatic lookup dropdown states: Shipping Mark & Packing Date
  const [selectedMark, setSelectedMark] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [selectedFlight, setSelectedFlight] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareChannel, setShareChannel] = useState<'whatsapp' | 'wechat'>('wechat');

  // Custom / manual rows added directly inside the Payment Slip form (defaults to 3 rows)
  const [customRows, setCustomRows] = useState<ExporterPaymentSlipRow[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_SLIP_ROWS_STORAGE_KEY);
      if (!saved) {
        return createInitialExporterSlipRows(DEFAULT_EXPORTER_SLIP_ROWS);
      }
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return createInitialExporterSlipRows(DEFAULT_EXPORTER_SLIP_ROWS);
    } catch {
      return createInitialExporterSlipRows(DEFAULT_EXPORTER_SLIP_ROWS);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_SLIP_ROWS_STORAGE_KEY, JSON.stringify(customRows));
    } catch (e) {
      console.error(e);
    }
  }, [customRows]);

  useEffect(() => {
    const handleClearAll = () => {
      setCustomRows(createInitialExporterSlipRows(DEFAULT_EXPORTER_SLIP_ROWS));
      setSelectedMark('ALL');
      setSelectedDate('ALL');
      setSelectedFlight('ALL');
      setSelectedStatus('ALL');
    };
    window.addEventListener('zsb-clear-all-db', handleClearAll);
    return () => window.removeEventListener('zsb-clear-all-db', handleClearAll);
  }, []);

  // Unique Shipping Marks present in Exporter DB (packings) + dropdownOptions
  const availableMarks = useMemo(() => {
    const dbMarks = Array.from(new Set(packings.map((p) => p.shippingMark).filter(Boolean)));
    const otherMarks = dropdownOptions.shippingMarks.filter((m) => !dbMarks.includes(m));
    return { dbMarks, otherMarks };
  }, [packings, dropdownOptions.shippingMarks]);

  // Unique Packing Dates present in Exporter DB (filtered by selectedMark if set, plus all dates)
  const availableDates = useMemo(() => {
    const matchingPackings =
      selectedMark === 'ALL'
        ? packings
        : packings.filter(
            (p) => p.shippingMark.trim().toLowerCase() === selectedMark.trim().toLowerCase()
          );

    const markDates = Array.from(
      new Set(matchingPackings.map((p) => p.packingDate).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));

    const allDates = Array.from(
      new Set(packings.map((p) => p.packingDate).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));

    const otherDates =
      selectedMark === 'ALL' ? allDates : allDates.filter((d) => !markDates.includes(d));

    return { markDates, otherDates };
  }, [packings, selectedMark]);

  // Unique Flights in Exporter DB + dropdownOptions
  const availableFlights = useMemo(() => {
    const dbFlights = packings.map((p) => p.flight).filter(Boolean);
    return Array.from(new Set([...dbFlights, ...dropdownOptions.flights]));
  }, [packings, dropdownOptions.flights]);

  // Handle Shipping Mark dropdown change with automatic date synchronization
  const handleMarkChange = (newMark: string) => {
    setSelectedMark(newMark);
    if (newMark !== 'ALL' && selectedDate !== 'ALL') {
      const hasRecordOnDate = packings.some(
        (p) =>
          p.shippingMark.trim().toLowerCase() === newMark.trim().toLowerCase() &&
          p.packingDate === selectedDate
      );
      if (!hasRecordOnDate) {
        setSelectedDate('ALL');
      }
    }

    // If no DB records exist for the selected mark, reflect the selected mark in the first blank custom row
    const hasDbRecordsForMark =
      newMark !== 'ALL' &&
      packings.some(
        (p) => p.shippingMark.trim().toLowerCase() === newMark.trim().toLowerCase()
      );
    setCustomRows((prev) =>
      prev.map((row, idx) => {
        const hasOtherData =
          Boolean((row.flight || '').trim()) ||
          Number(row.box) > 0 ||
          Number(row.weightKg) > 0 ||
          Number(row.rmb) > 0;
        if (idx === 0 && !hasOtherData) {
          return {
            ...row,
            mark: newMark === 'ALL' || hasDbRecordsForMark ? '' : newMark,
          };
        }
        return row;
      })
    );
  };

  // Handle Packing Date dropdown change with automatic mark synchronization
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (newDate !== 'ALL' && selectedMark !== 'ALL') {
      const hasRecordForMark = packings.some(
        (p) =>
          p.packingDate === newDate &&
          p.shippingMark.trim().toLowerCase() === selectedMark.trim().toLowerCase()
      );
      if (!hasRecordForMark) {
        setSelectedMark('ALL');
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedMark('ALL');
    setSelectedDate('ALL');
    setSelectedFlight('ALL');
    setSelectedStatus('ALL');
    setCustomRows((prev) =>
      prev.map((row, idx) => {
        const hasOtherData =
          Boolean((row.flight || '').trim()) ||
          Number(row.box) > 0 ||
          Number(row.weightKg) > 0 ||
          Number(row.rmb) > 0;
        if (idx === 0 && !hasOtherData) {
          return { ...row, mark: '' };
        }
        return row;
      })
    );
    showToast('Showing all Exporter Database records in Payment Slip.');
  };

  // Build rows automatically from Exporter Database (packings + payments)
  const dbSlipRows = useMemo(() => {
    return buildExporterPaymentSlipRows(packings, payments, {
      shippingMark: selectedMark,
      packingDate: selectedDate,
      flight: selectedFlight,
      status: selectedStatus,
      rmbExchangeRate: companyProfile.rmbExchangeRate,
    });
  }, [
    packings,
    payments,
    selectedMark,
    selectedDate,
    selectedFlight,
    selectedStatus,
    companyProfile.rmbExchangeRate,
  ]);

  // Merge auto-synced DB rows with custom rows in the Payment Slip form
  const slipRows = useMemo(() => {
    return mergeExporterPaymentSlipRows(dbSlipRows, customRows, {
      shippingMark: selectedMark,
      packingDate: selectedDate,
      flight: selectedFlight,
      status: selectedStatus,
    });
  }, [dbSlipRows, customRows, selectedMark, selectedDate, selectedFlight, selectedStatus]);

  const populatedSlipRows = useMemo(
    () => slipRows.filter((r) => isExporterSlipRowPopulated(r)),
    [slipRows]
  );

  const populatedCustomRows = useMemo(
    () => customRows.filter((r) => isExporterSlipRowPopulated(r)),
    [customRows]
  );

  const totals = useMemo(() => calculateExporterSlipTotals(slipRows), [slipRows]);

  // Build All Exporter Record History (Debit, Credit, Balance & Status: Report, No Report, Paid)
  const historyRows = useMemo(
    () =>
      buildExporterRecordHistory(packings, payments, {
        shippingMark: selectedMark,
        packingDate: selectedDate,
        flight: selectedFlight,
        status: selectedStatus,
        rmbExchangeRate: companyProfile.rmbExchangeRate,
      }),
    [
      packings,
      payments,
      selectedMark,
      selectedDate,
      selectedFlight,
      selectedStatus,
      companyProfile.rmbExchangeRate,
    ]
  );

  const historyTotals = useMemo(
    () => calculateExporterHistoryTotals(historyRows),
    [historyRows]
  );

  const statusOptions = useMemo(() => {
    return dropdownOptions.paymentStatuses.length > 0
      ? dropdownOptions.paymentStatuses
      : ['PAID', 'UNPAID'];
  }, [dropdownOptions.paymentStatuses]);

  const handleUpdateHistoryRow = (
    row: ExporterRecordHistoryRow,
    field: 'debitAmount' | 'creditAmount' | 'status',
    value: number | string
  ) => {
    if (row.packingId) {
      if (field === 'debitAmount') {
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
    } else if (row.paymentId) {
      if (field === 'debitAmount') {
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
    }
  };

  // Add a new row to the Payment Slip form
  const handleAddRow = () => {
    const newRow = createEmptyExporterSlipRow(generateRecordId('sliprow'), {
      date: selectedDate !== 'ALL' ? selectedDate : new Date().toISOString().slice(0, 10),
      flight: selectedFlight !== 'ALL' ? selectedFlight : '',
      mark: selectedMark !== 'ALL' ? selectedMark : '',
      status: selectedStatus !== 'ALL' ? selectedStatus : 'REPORT',
    });
    setCustomRows((prev) => [...prev, newRow]);
    showToast('Added new row to Exporter Payment Slip (付款单).');
  };

  // Delete or clear a custom row in the Payment Slip form
  const handleRemoveCustomRow = (rowId: string) => {
    setCustomRows((prev) => {
      if (prev.length <= 1) {
        return [
          createEmptyExporterSlipRow(generateRecordId('sliprow'), {
            date: new Date().toISOString().slice(0, 10),
          }),
        ];
      }
      return prev.filter((r) => r.id !== rowId);
    });
    showToast('Removed row from Payment Slip.');
  };

  // Reset all custom rows in the Payment Slip form
  const handleResetCustomRows = () => {
    setCustomRows(createInitialExporterSlipRows(DEFAULT_EXPORTER_SLIP_ROWS));
    showToast('Reset manual Payment Slip rows to 3 rows.');
  };

  // Update any field on a row (persists to PackingRecord if DB-linked, or updates customRows)
  // Calculation: Weight * RMB = Amount
  const handleUpdateRow = (
    row: ExporterPaymentSlipRow,
    field: keyof ExporterPaymentSlipRow,
    value: string | number
  ) => {
    if (row.packingId) {
      if (field === 'date') {
        updatePacking(row.packingId, { packingDate: String(value) });
      } else if (field === 'flight') {
        updatePacking(row.packingId, { flight: String(value).toUpperCase() });
      } else if (field === 'mark') {
        updatePacking(row.packingId, { shippingMark: String(value).toUpperCase() });
      } else if (field === 'box') {
        updatePacking(row.packingId, { totalBox: Number(value) || 0 });
      } else if (field === 'weightKg') {
        const newWeight = Number(value) || 0;
        if (Number(row.rmb) > 0) {
          const newAmount = calculateExporterSlipRowAmount(newWeight, row.rmb);
          updatePacking(row.packingId, { totalWeight: newWeight, settledAmount: newAmount });
        } else {
          updatePacking(row.packingId, { totalWeight: newWeight });
        }
      } else if (field === 'rmb') {
        const newRmb = Number(value) || 0;
        const newAmount = calculateExporterSlipRowAmount(row.weightKg, newRmb);
        updatePacking(row.packingId, { rmbAmount: newRmb, settledAmount: newAmount });
      } else if (field === 'amount') {
        const newAmount = Number(value) || 0;
        const derivedRmb =
          row.weightKg > 0 ? Math.round((newAmount / row.weightKg) * 100) / 100 : 0;
        updatePacking(row.packingId, {
          settledAmount: newAmount,
          rmbAmount: derivedRmb,
        });
      } else if (field === 'status') {
        updatePacking(row.packingId, { exporterStatus: String(value) });
      }
      return;
    }

    setCustomRows((prev) =>
      prev.map((item) => {
        if (item.id !== row.id) return item;
        const updated: ExporterPaymentSlipRow = { ...item };

        if (field === 'date') {
          updated.date = String(value);
        } else if (field === 'flight') {
          updated.flight = String(value).toUpperCase();
        } else if (field === 'mark') {
          updated.mark = String(value).toUpperCase();
        } else if (field === 'box') {
          updated.box = Number(value) || 0;
        } else if (field === 'weightKg') {
          const newWeight = Number(value) || 0;
          updated.weightKg = newWeight;
          if (Number(updated.rmb) > 0) {
            updated.amount = calculateExporterSlipRowAmount(newWeight, updated.rmb);
          }
        } else if (field === 'rmb') {
          const newRmb = Number(value) || 0;
          updated.rmb = newRmb;
          updated.amount = calculateExporterSlipRowAmount(updated.weightKg, newRmb);
        } else if (field === 'amount') {
          updated.amount = Number(value) || 0;
        } else if (field === 'status') {
          updated.status = String(value);
        }

        return updated;
      })
    );
  };

  // Save a populated custom row into the master Exporter / Packing Database
  const handleSaveCustomRowToDb = (row: ExporterPaymentSlipRow) => {
    if (!isExporterSlipRowPopulated(row)) {
      showToast('Enter Mark, Flight, Box, Weight, or RMB before saving to Exporter DB.');
      return;
    }
    const rate = companyProfile.rmbExchangeRate || 16.5;
    const computedSlipAmount = calculateExporterSlipRowAmount(row.weightKg, row.rmb);
    const effectiveRmbTotal =
      computedSlipAmount > 0 ? computedSlipAmount : Number(row.amount) || Number(row.rmb) || 0;
    const totalAmountBdt = Math.round(effectiveRmbTotal * rate * 100) / 100;
    const invoiceNo = generateInvoiceNumber('PKG', packings.length);

    addPacking({
      invoiceNumber: invoiceNo,
      shippingMark: (row.mark || 'GENERAL').trim(),
      flight: (row.flight || 'CAN').trim(),
      destination: 'GUANGZHOU',
      shipper: companyProfile.companyName,
      packingDate: row.date || new Date().toISOString().slice(0, 10),
      fromDate: row.date || new Date().toISOString().slice(0, 10),
      toDate: row.date || new Date().toISOString().slice(0, 10),
      items: [
        {
          id: generateRecordId('pkgitem'),
          item: 'EXPORT SHIPMENT',
          box: Number(row.box) || 0,
          weight:
            Number(row.box) > 0
              ? Math.round(((Number(row.weightKg) || 0) / Number(row.box)) * 100) / 100
              : Number(row.weightKg) || 0,
          totalWeight: Number(row.weightKg) || 0,
          unit: 'KG',
          rate:
            Number(row.weightKg) > 0
              ? Math.round((totalAmountBdt / Number(row.weightKg)) * 100) / 100
              : 0,
          amount: totalAmountBdt,
        },
      ],
      totalBox: Number(row.box) || 0,
      totalWeight: Number(row.weightKg) || 0,
      totalAmount: totalAmountBdt,
      rmbAmount: Number(row.rmb) || 0,
      settledAmount: effectiveRmbTotal,
      exporterStatus: row.status || 'REPORT',
      paymentStatus: row.status || 'REPORT',
    });

    setCustomRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const handlePrintSlip = () => {
    const filterTitle =
      selectedMark !== 'ALL' && selectedDate !== 'ALL'
        ? `${selectedMark} (${formatDate(selectedDate)})`
        : selectedMark !== 'ALL'
        ? `Mark: ${selectedMark}`
        : selectedDate !== 'ALL'
        ? `Date: ${formatDate(selectedDate)}`
        : 'All Shipments';

    const rowsToPrint = populatedSlipRows.length > 0 ? populatedSlipRows : slipRows;

    openPrintModal({
      type: 'exporter_payment_slip',
      title: `Exporter Payment Slip 付款单 - ${filterTitle}`,
      data: {
        shippingMark: selectedMark,
        packingDate: selectedDate,
        rows: rowsToPrint,
        totals,
      },
      items: rowsToPrint,
    });
  };

  useEffect(() => {
    const onShortcut = (event: Event) => {
      const customEvent = event as CustomEvent<ViewShortcutEventDetail>;
      const action = customEvent.detail?.action;
      if (!action) return;

      if (action === 'SAVE_ACTIVE_VIEW') {
        customEvent.detail.handled = true;
        if (populatedCustomRows.length > 0) {
          handleSaveCustomRowToDb(populatedCustomRows[0]);
        } else {
          showToast('Exporter Payment Slip synced — opening Print / Save PDF preview (Ctrl+S).');
          handlePrintSlip();
        }
      } else if (action === 'PRINT_ACTIVE_VIEW') {
        customEvent.detail.handled = true;
        handlePrintSlip();
      } else if (action === 'ADD_FORM_ROW') {
        customEvent.detail.handled = true;
        handleAddRow();
      } else if (action === 'RESET_FORM') {
        customEvent.detail.handled = true;
        handleResetFilters();
      }
    };

    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
  });

  const handleSavePngSlip = async () => {
    setIsExportingPng(true);
    const filename = formatExporterSlipExportFilename(selectedMark, selectedDate, 'png');
    try {
      const success = await exportElementToPng('exporter-payment-slip-canvas', filename, 900);
      if (success) {
        showToast(`PNG image downloaded: ${filename}`);
      } else {
        showToast('Error generating PNG image. Opening preview...');
        handlePrintSlip();
      }
    } catch (err) {
      console.error('PNG export error:', err);
      showToast('Error generating PNG image.');
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-5 font-sans">
      {/* Shared Datalists for Flight & Shipping Mark Autocomplete */}
      <datalist id="exporter-slip-flights-datalist">
        {availableFlights.map((fl) => (
          <option key={fl} value={fl} />
        ))}
      </datalist>
      <datalist id="exporter-slip-marks-datalist">
        {dropdownOptions.shippingMarks.map((mk) => (
          <option key={mk} value={mk} />
        ))}
      </datalist>

      {/* Top Action & Filter Bar */}
      <div className="bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-md border-b-2 border-amber-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="zsb-3d-text text-lg sm:text-xl font-black">
                {companyProfile.companyName}
              </span>
              <span className="text-slate-500">·</span>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Exporter Payment Slip (付款单) — Automatic Database Sheet
              </h1>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Automatically receives shipment &amp; record history from Exporter Database (Select Shipping Mark &amp; Packing Date)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-black bg-[#98486f] hover:bg-[#7d3759] text-white border border-amber-400/50 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>Add Row (添加行)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('packing_form')}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>+ New Packing Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('packing_db')}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-teal-400" />
            <span>Exporter / Packing DB ({packings.length})</span>
          </button>

          <button
            type="button"
            onClick={handlePrintSlip}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md transition cursor-pointer"
            title="Open Print, Save PDF & Save .PNG Preview"
          >
            <Printer className="w-4 h-4" />
            <span>PRINT / SAVE PDF (付款单)</span>
          </button>

          <button
            type="button"
            onClick={handleSavePngSlip}
            disabled={isExportingPng}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-black bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-md transition cursor-pointer disabled:opacity-50"
            title="Download Payment Slip directly as a high-resolution .PNG image"
          >
            {isExportingPng ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>SAVING .PNG...</span>
              </>
            ) : (
              <>
                <ImageDown className="w-4 h-4" />
                <span>SAVE .PNG (付款单)</span>
              </>
            )}
          </button>

          {/* Share via WeChat (微信分享) Button */}
          <button
            type="button"
            data-testid="exporter-share-wechat-btn"
            onClick={() => {
              setShareChannel('wechat');
              setIsShareModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-black bg-[#07C160] hover:bg-[#06a853] text-white rounded-lg shadow-md transition cursor-pointer"
            title="Share Payment Slip .PNG directly to Chinese buyers via WeChat (微信)"
          >
            <WeChatIcon className="w-4 h-4 text-white" />
            <span>SHARE WECHAT (微信)</span>
          </button>

          {/* Share via WhatsApp Button */}
          <button
            type="button"
            data-testid="exporter-share-whatsapp-btn"
            onClick={() => {
              setShareChannel('whatsapp');
              setIsShareModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-black bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg shadow-md transition cursor-pointer"
            title="Share Payment Slip .PNG via WhatsApp"
          >
            <WhatsAppIcon className="w-4 h-4 text-white" />
            <span>SHARE WHATSAPP</span>
          </button>
        </div>
      </div>

      {/* Automatic Lookup Dropdown Controls Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Filter className="w-4 h-4 text-[#98486f]" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              Automatic Exporter Database Lookup (Select Shipping Mark &amp; Packing Date)
            </span>
            {selectedMark !== 'ALL' && (
              <span
                data-testid="active-selected-mark-badge"
                className="inline-flex items-center gap-1.5 bg-[#faefd0] border-2 border-[#98486f] px-3 py-0.5 rounded-lg shadow-xs"
              >
                <span className="text-[11px] font-bold uppercase text-slate-700">MARK:</span>
                <span className="text-2xl sm:text-[28px] leading-tight font-black tracking-wider text-[#98486f] uppercase">
                  {selectedMark}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              Record History: <strong className="text-slate-900">{historyRows.length}</strong> · Active Slip Rows: <strong className="text-slate-900">{populatedSlipRows.length}</strong>
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center space-x-1 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded border border-rose-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Show All ({packings.length})</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* 1. Shipping Mark Dropdown Box (Double Font Size for MARK e.g. HM-105) */}
          <div>
            <label
              htmlFor="exporter-slip-mark-select"
              className="flex items-center justify-between text-[11px] font-black uppercase text-slate-700 mb-1.5"
            >
              <span className="flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-[#98486f]" />
                <span>Shipping Mark (MARK 标记)</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-700">Auto-Sync · 2× Font</span>
            </label>
            <select
              id="exporter-slip-mark-select"
              aria-label="Shipping Mark"
              value={selectedMark}
              onChange={(e) => handleMarkChange(e.target.value)}
              className="w-full px-3 py-1.5 text-2xl sm:text-[28px] leading-tight font-black tracking-wider uppercase border-2 border-[#98486f]/60 rounded-lg bg-[#faefd0]/60 text-slate-950 focus:bg-white focus:border-[#98486f] focus:outline-none transition"
            >
              <option value="ALL" className="text-sm font-bold">
                ALL MARKS ({packings.length})
              </option>
              <optgroup label="Marks with Saved Exporter Records" className="text-base font-black">
                {availableMarks.dbMarks.map((mark) => {
                  const count = packings.filter((p) => p.shippingMark === mark).length;
                  return (
                    <option key={mark} value={mark} className="text-xl font-black">
                      {mark} ({count})
                    </option>
                  );
                })}
              </optgroup>
              {availableMarks.otherMarks.length > 0 && (
                <optgroup label="Other Registered Marks" className="text-base font-black">
                  {availableMarks.otherMarks.map((mark) => (
                    <option key={mark} value={mark} className="text-xl font-black">
                      {mark}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 2. Packing Date Dropdown Box */}
          <div>
            <label
              htmlFor="exporter-slip-date-select"
              className="flex items-center justify-between text-[11px] font-black uppercase text-slate-700 mb-1.5"
            >
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-[#98486f]" />
                <span>Packing Date (DATE 发货日期)</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-700">Auto-Sync</span>
            </label>
            <div className="flex items-center space-x-1.5">
              <select
                id="exporter-slip-date-select"
                aria-label="Packing Date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="flex-1 px-3 py-2 text-xs sm:text-sm font-bold font-mono border-2 border-[#98486f]/40 rounded-lg bg-[#faefd0]/40 text-slate-900 focus:bg-white focus:border-[#98486f] focus:outline-none transition"
              >
                <option value="ALL">-- ALL PACKING DATES --</option>
                {selectedMark !== 'ALL' && availableDates.markDates.length > 0 && (
                  <optgroup label={`Dates for Mark: ${selectedMark}`}>
                    {availableDates.markDates.map((d) => {
                      const recs = packings.filter(
                        (p) => p.packingDate === d && p.shippingMark === selectedMark
                      );
                      return (
                        <option key={d} value={d}>
                          {formatDate(d)} ({d}) — {recs.map((r) => r.flight).join(', ')}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {availableDates.otherDates.length > 0 && (
                  <optgroup
                    label={
                      selectedMark === 'ALL'
                        ? 'All Exporter Packing Dates'
                        : 'Other Exporter Packing Dates'
                    }
                  >
                    {availableDates.otherDates.map((d) => {
                      const recs = packings.filter((p) => p.packingDate === d);
                      const marksList = Array.from(new Set(recs.map((r) => r.shippingMark))).join(
                        ', '
                      );
                      return (
                        <option key={d} value={d}>
                          {formatDate(d)} ({marksList})
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
              <input
                type="date"
                aria-label="Calendar Date Picker"
                value={selectedDate === 'ALL' ? '' : selectedDate}
                onChange={(e) => handleDateChange(e.target.value || 'ALL')}
                className="w-9 px-1.5 py-2 text-xs border-2 border-slate-300 rounded-lg bg-slate-50 hover:bg-white focus:border-[#98486f] focus:outline-none"
                title="Pick packing date from calendar"
              />
            </div>
          </div>

          {/* 3. Flight Filter Dropdown */}
          <div>
            <label
              htmlFor="exporter-slip-flight-select"
              className="flex items-center space-x-1 text-[11px] font-black uppercase text-slate-700 mb-1.5"
            >
              <Plane className="w-3.5 h-3.5 text-slate-600" />
              <span>Flight (FLIGHT 航班名称)</span>
            </label>
            <select
              id="exporter-slip-flight-select"
              aria-label="Flight Filter"
              value={selectedFlight}
              onChange={(e) => setSelectedFlight(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:bg-white focus:border-[#98486f] focus:outline-none transition"
            >
              <option value="ALL">-- All Flights --</option>
              {availableFlights.map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Status Filter Dropdown */}
          <div>
            <label
              htmlFor="exporter-slip-status-select"
              className="flex items-center space-x-1 text-[11px] font-black uppercase text-slate-700 mb-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Status (PAID &amp; UNPAID)</span>
            </label>
            <select
              id="exporter-slip-status-select"
              aria-label="Status Filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:bg-white focus:border-[#98486f] focus:outline-none transition"
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

        {/* All Exporter Record History Table (Debit, Credit, Balance & Status: Report, No Report, Paid) */}
        <div
          data-testid="exporter-lookup-record-history-section"
          className="pt-2 border-t border-slate-200 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#98486f]" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                All Exporter Record History (Debit, Credit, Balance &amp; Status)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                Records: {historyTotals.recordCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                PAID: {historyTotals.paidCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-bold border border-rose-200">
                UNPAID: {historyTotals.reportCount + historyTotals.noReportCount}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table
              data-testid="exporter-lookup-record-history-table"
              className="w-full border-collapse text-xs"
            >
              <thead>
                <tr className="bg-[#0f3d4c] text-white uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                  <th className="py-2 px-2.5 border-r border-slate-700 text-center w-10">SL</th>
                  <th className="py-2 px-2.5 border-r border-slate-700 text-left w-28">
                    PACKING DATE
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-700 text-left w-28">
                    SHIPPING MARK
                  </th>
                  <th className="py-2 px-3 border-r border-slate-700 text-left">
                    RECORD HISTORY / SHIPMENT PARTICULARS
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-700 text-right w-32">
                    DEBIT (RMB)
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-700 text-right w-32">
                    CREDIT (RMB)
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-700 text-right w-32">
                    BALANCE (RMB)
                  </th>
                  <th className="py-2 px-2.5 text-center w-44">
                    STATUS (PAID / UNPAID)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-5 text-center text-slate-400 italic">
                      No exporter records match the selected Shipping Mark &amp; Packing Date filter.
                    </td>
                  </tr>
                ) : (
                  historyRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      data-testid={`exporter-history-row-${idx + 1}`}
                      className={
                        idx % 2 === 0
                          ? 'bg-white hover:bg-amber-50/40'
                          : 'bg-slate-50/70 hover:bg-amber-50/40'
                      }
                    >
                      <td className="py-1.5 px-2 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-200 font-mono font-semibold text-slate-700">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-200 font-black text-sm text-[#98486f] uppercase">
                        {row.shippingMark}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 font-medium text-slate-800">
                        <span className="font-mono font-bold text-teal-900">
                          {row.invoiceNumber}
                        </span>
                        {row.flight ? ` · Flight ${row.flight}` : ''}
                        {row.box > 0 || row.weightKg > 0
                          ? ` (${row.box} Box / ${row.weightKg} KG)`
                          : ''}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`History Row ${idx + 1} Debit`}
                          value={row.debitAmount || ''}
                          onChange={(e) =>
                            handleUpdateHistoryRow(
                              row,
                              'debitAmount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full px-2 py-1 text-right font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#98486f]"
                        />
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`History Row ${idx + 1} Credit`}
                          value={row.creditAmount || ''}
                          onChange={(e) =>
                            handleUpdateHistoryRow(
                              row,
                              'creditAmount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full px-2 py-1 text-right font-mono font-bold text-emerald-800 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#98486f]"
                        />
                      </td>
                      <td
                        data-testid={`exporter-history-balance-${idx + 1}`}
                        className={`py-1.5 px-2.5 border-r border-slate-200 text-right font-mono font-black ${
                          row.balance > 0 ? 'text-rose-700' : 'text-emerald-800'
                        }`}
                      >
                        {formatRMB(row.balance)}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <select
                          aria-label={`History Row ${idx + 1} Status`}
                          value={row.status === 'PAID' ? 'PAID' : 'UNPAID'}
                          onChange={(e) =>
                            handleUpdateHistoryRow(row, 'status', e.target.value)
                          }
                          className={`w-full text-center text-xs font-black uppercase rounded px-2 py-1 border cursor-pointer focus:outline-none ${
                            row.status === 'PAID'
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
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-800">
                  <td colSpan={4} className="py-2 px-3 text-right uppercase tracking-wider">
                    TOTAL EXPORTER RECORD HISTORY:
                  </td>
                  <td
                    data-testid="exporter-history-total-debit"
                    className="py-2 px-2.5 text-right font-mono text-amber-300 border-l border-slate-700"
                  >
                    {formatRMB(historyTotals.totalDebit)}
                  </td>
                  <td
                    data-testid="exporter-history-total-credit"
                    className="py-2 px-2.5 text-right font-mono text-emerald-300 border-l border-slate-700"
                  >
                    {formatRMB(historyTotals.totalCredit)}
                  </td>
                  <td
                    data-testid="exporter-history-total-balance"
                    className="py-2 px-2.5 text-right font-mono text-rose-300 border-l border-slate-700"
                  >
                    {formatRMB(historyTotals.totalBalance)}
                  </td>
                  <td className="py-2 px-2.5 text-center font-mono text-[11px] text-slate-200 border-l border-slate-700">
                    {historyTotals.paidCount} PAID ·{' '}
                    {historyTotals.reportCount + historyTotals.noReportCount} UNPAID
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Main "Exporter Payment Slip" Spreadsheet Canvas */}
      <div className="bg-white rounded-sm shadow-xl border-2 border-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <div id="exporter-payment-slip-canvas" className="min-w-[900px] font-sans bg-white">
            {/* 1. Top Plum Title Header: ZSB AQUATICS */}
            <div className="bg-[#98486f] text-white py-3 px-6 flex items-center justify-center gap-3.5 border-b-2 border-black">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-300 bg-white p-0.5 shrink-0 shadow-xs flex items-center justify-center">
                <img
                  src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                  alt={companyProfile.companyName}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div
                className="zsb-3d-text-lg text-3xl sm:text-4xl font-black tracking-wider uppercase"
                style={{
                  color: '#ffe57f',
                  fontFamily: "'Cinzel', Georgia, Cambria, 'Times New Roman', Times, serif",
                  fontWeight: 900,
                  letterSpacing: '0.09em',
                  textShadow:
                    '0px 1px 0px #f59e0b, 1px 2px 0px #d97706, 2px 3px 0px #b45309, 3px 4px 0px #92400e, 4px 5px 0px #78350f, 5px 6px 0px #451a03, 6px 8px 10px rgba(0, 0, 0, 0.75)',
                }}
              >
                {companyProfile.companyName}
              </div>
            </div>

            {/* 2. Cream Address & Contact Rows */}
            <div className="bg-[#faefd0] text-black text-center border-b-2 border-black divide-y divide-black/20">
              <div className="py-1.5 px-4 text-sm sm:text-base font-bold tracking-wide uppercase">
                29/B, NISHATNAGAR, TARARTEK, TURAG, DHAKA-1230
              </div>
              <div className="py-1.5 px-4 text-sm sm:text-base font-bold tracking-wide uppercase">
                CONTACT NUMBER - +880 18411-65902, +880 1711 331545 | EMAIL:{' '}
                <span className="normal-case">{companyProfile.email || 'www.zsbaquatics.com'}</span>
              </div>
            </div>

            {/* 3. PAYMENT SLIP 付款单 Banner */}
            <div className="bg-[#faefd0] text-black py-2.5 px-4 text-center border-b-2 border-black">
              <div className="text-xl sm:text-2xl font-black tracking-wide">
                PAYMENT SLIP 付款单
              </div>
            </div>

            {/* 4. 7-Column Bilingual Exporter Payment Slip Table (RMB Column Removed) */}
            <table
              className="w-full border-collapse text-center"
              data-testid="exporter-payment-slip-table"
            >
              <thead>
                <tr className="bg-[#98486f] text-white text-xs sm:text-sm font-bold uppercase border-b-2 border-black">
                  <th className="py-2.5 px-2 border-r-2 border-black w-36">
                    <div>DATE</div>
                    <div className="text-xs font-normal mt-0.5">发货日期</div>
                  </th>
                  <th className="py-2.5 px-2 border-r-2 border-black w-28">
                    <div>FLIGHT</div>
                    <div className="text-xs font-normal mt-0.5">航班名称</div>
                  </th>
                  <th className="py-2.5 px-2 border-r-2 border-black w-44">
                    <div>MARK 标记</div>
                  </th>
                  <th className="py-2.5 px-2 border-r-2 border-black w-24">
                    <div>BOX</div>
                    <div className="text-xs font-normal mt-0.5">箱数</div>
                  </th>
                  <th className="py-2.5 px-2 border-r-2 border-black w-28">
                    <div>WEIGHT</div>
                    <div className="text-xs font-normal mt-0.5">/KG 重量</div>
                  </th>
                  <th className="py-2.5 px-2 border-r-2 border-black w-40">
                    <div>AMOUNT</div>
                    <div className="text-xs font-normal mt-0.5">待结金额</div>
                  </th>
                  <th className="py-2.5 px-2 w-48">
                    <div>STATUS 地位</div>
                  </th>
                </tr>
              </thead>

              <tbody className="bg-[#faefd0] text-black">
                {slipRows.map((row, idx) => {
                  const isPopulated = isExporterSlipRowPopulated(row);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-black h-12 text-xs sm:text-sm font-bold hover:bg-[#f5e4b3] transition-colors"
                    >
                      {/* 1. DATE 发货日期 */}
                      <td className="py-1 px-1.5 border-r-2 border-black font-mono">
                        <input
                          type="date"
                          aria-label={`Row ${idx + 1} Date`}
                          value={row.date || ''}
                          onChange={(e) => handleUpdateRow(row, 'date', e.target.value)}
                          className="w-full text-center font-mono text-xs sm:text-sm font-bold bg-transparent border-b border-transparent hover:border-black/40 focus:border-black focus:bg-white/80 focus:outline-none rounded-xs px-1 py-0.5 text-black"
                        />
                      </td>

                      {/* 2. FLIGHT 航班名称 */}
                      <td className="py-1 px-1.5 border-r-2 border-black uppercase">
                        <input
                          type="text"
                          list="exporter-slip-flights-datalist"
                          aria-label={`Row ${idx + 1} Flight`}
                          placeholder="Flight..."
                          value={row.flight || ''}
                          onChange={(e) => handleUpdateRow(row, 'flight', e.target.value)}
                          className="w-full text-center uppercase font-bold bg-transparent border-b border-transparent hover:border-black/40 focus:border-black focus:bg-white/80 focus:outline-none rounded-xs px-1 py-0.5 text-black placeholder:text-black/35 placeholder:font-normal"
                        />
                      </td>

                      {/* 3. MARK 标记 (Double Font Size: 24px / 28px vs 12px / 14px base) */}
                      <td className="py-1 px-1.5 border-r-2 border-black uppercase font-black">
                        <input
                          type="text"
                          list="exporter-slip-marks-datalist"
                          aria-label={`Row ${idx + 1} Mark`}
                          placeholder="Mark..."
                          value={row.mark || ''}
                          onChange={(e) => handleUpdateRow(row, 'mark', e.target.value)}
                          className="w-full text-center uppercase text-2xl sm:text-[28px] leading-tight font-black tracking-wider bg-transparent border-b border-transparent hover:border-black/40 focus:border-black focus:bg-white/80 focus:outline-none rounded-xs px-1 py-0.5 text-black placeholder:text-xs sm:placeholder:text-sm placeholder:text-black/35 placeholder:font-normal placeholder:tracking-normal"
                        />
                      </td>

                      {/* 4. BOX 箱数 */}
                      <td className="py-1 px-1.5 border-r-2 border-black font-mono">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Row ${idx + 1} Box`}
                          placeholder="0"
                          value={row.box || ''}
                          onChange={(e) => handleUpdateRow(row, 'box', e.target.value)}
                          className="w-full text-center font-mono font-bold bg-transparent border-b border-transparent hover:border-black/40 focus:border-black focus:bg-white/80 focus:outline-none rounded-xs px-1 py-0.5 text-black placeholder:text-black/35"
                        />
                      </td>

                      {/* 5. WEIGHT /KG 重量 */}
                      <td className="py-1 px-1.5 border-r-2 border-black font-mono">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`Row ${idx + 1} Weight KG`}
                          placeholder="0.00"
                          value={row.weightKg || ''}
                          onChange={(e) => handleUpdateRow(row, 'weightKg', e.target.value)}
                          className="w-full text-center font-mono font-bold bg-transparent border-b border-transparent hover:border-black/40 focus:border-black focus:bg-white/80 focus:outline-none rounded-xs px-1 py-0.5 text-black placeholder:text-black/35"
                        />
                      </td>

                      {/* 6. AMOUNT 待结金额 */}
                      <td className="py-1 px-2 border-r-2 border-black font-mono">
                        <div className="flex items-center justify-center space-x-0.5">
                          <span className="text-black font-bold">¥</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label={`Settlement Amount Row ${idx + 1}`}
                            placeholder="0.00"
                            value={row.amount || ''}
                            onChange={(e) => handleUpdateRow(row, 'amount', e.target.value)}
                            className="w-28 text-center font-mono font-black bg-transparent border-b border-transparent hover:border-black/40 focus:border-black focus:bg-white/80 focus:outline-none rounded-xs px-1 py-0.5 text-black placeholder:text-black/35"
                          />
                        </div>
                      </td>

                      {/* 8. STATUS 地位 + Row Actions */}
                      <td className="py-1 px-2">
                        <div className="flex items-center justify-between gap-1">
                          <select
                            aria-label={`Exporter Status Row ${idx + 1}`}
                            value={row.status === 'PAID' ? 'PAID' : 'UNPAID'}
                            onChange={(e) => handleUpdateRow(row, 'status', e.target.value)}
                            className={`flex-1 text-center text-xs font-black uppercase rounded px-1.5 py-1 border border-transparent hover:border-black/30 focus:outline-none cursor-pointer ${
                              row.status === 'PAID'
                                ? 'text-emerald-900 bg-emerald-500/15'
                                : 'text-rose-900 bg-rose-500/15'
                            }`}
                          >
                            {statusOptions.map((st) => (
                              <option key={st} value={st} className="bg-white text-black">
                                {st}
                              </option>
                            ))}
                          </select>

                          {!row.packingId && (
                            <div
                              data-export-ignore="true"
                              className="flex items-center gap-0.5"
                            >
                              {isPopulated && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomRowToDb(row)}
                                  aria-label={`Save Row ${idx + 1} to Exporter DB`}
                                  title="Save this row to Exporter / Packing Database"
                                  className="p-1 rounded text-teal-800 hover:text-white hover:bg-teal-700 transition cursor-pointer"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomRow(row.id)}
                                aria-label={`Delete Row ${idx + 1}`}
                                title="Remove row from Payment Slip"
                                className="p-1 rounded text-rose-800/70 hover:text-white hover:bg-rose-600 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* 5. GRAND TOTAL 累计 Plum Footer Row */}
              <tfoot>
                <tr className="bg-[#98486f] text-white border-t-2 border-b-2 border-black text-sm sm:text-base font-black">
                  <td
                    colSpan={3}
                    className="py-2.5 px-4 border-r-2 border-black text-center uppercase tracking-wide"
                  >
                    GRAND TOTAL 累计
                  </td>
                  <td
                    className="py-2.5 px-2 border-r-2 border-black font-mono text-center"
                    data-testid="slip-total-box"
                  >
                    {totals.totalBox}
                  </td>
                  <td
                    className="py-2.5 px-2 border-r-2 border-black font-mono text-center"
                    data-testid="slip-total-weight"
                  >
                    {totals.totalWeightKg > 0 ? totals.totalWeightKg : 0}
                  </td>
                  <td
                    className="py-2.5 px-2 border-r-2 border-black font-mono text-center"
                    data-testid="slip-total-amount"
                  >
                    {formatRMB(totals.totalAmount)}
                  </td>
                  <td className="py-2.5 px-2"></td>
                </tr>
              </tfoot>
            </table>

            {/* Payment Slip Form Action Bar (+ Add Row, Print/PDF & Save .PNG Controls) */}
            <div
              data-export-ignore="true"
              className="bg-[#f5e4b3]/70 px-4 py-2.5 border-b-2 border-black flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md bg-[#98486f] hover:bg-[#7d3759] text-white text-xs sm:text-sm font-black shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-300" />
                  <span>Add Row (添加行)</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetCustomRows}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-white/80 hover:bg-white text-slate-800 border border-black/25 text-xs font-bold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
                  <span>Reset Blank Rows</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PRINT / SAVE PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePngSlip}
                  disabled={isExportingPng}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <ImageDown className="w-3.5 h-3.5" />
                  <span>{isExportingPng ? 'SAVING .PNG...' : 'SAVE .PNG'}</span>
                </button>

                <span className="text-xs font-mono font-semibold text-slate-800">
                  Total Rows: <strong>{slipRows.length}</strong> ({populatedSlipRows.length} populated)
                </span>
              </div>

              <div className="text-xs font-medium text-slate-800">
                Select <strong>Shipping Mark</strong> &amp; <strong>Packing Date</strong> above or edit cells directly to update <strong>AMOUNT 待结金额</strong> &amp; <strong>GRAND TOTAL 累计</strong>.
              </div>
            </div>

            {/* 6. Bottom Right Signature Block: YOURS FAITHFULLY - 此致 / MD. SOHEL RANA / PARTNER */}
            <div className="bg-white px-8 py-7 flex justify-end items-end">
              <div className="text-right space-y-1 flex flex-col items-end">
                <div className="text-sm sm:text-base font-bold text-black tracking-wide uppercase">
                  YOURS FAITHFULLY - 此致
                </div>
                <div className="py-1 flex justify-end">
                  <img
                    src="/assets/aistudio/Md._Sohel_Rana_38797da9.jpg"
                    alt="Md. Sohel Rana Signature"
                    className="h-14 sm:h-16 w-auto object-contain select-none"
                  />
                </div>
                <div className="text-sm sm:text-base font-black text-black tracking-wider uppercase">
                  {companyProfile.partner || 'MD. SOHEL RANA'}
                </div>
                <div className="text-xs sm:text-sm font-bold text-black tracking-widest uppercase">
                  PARTNER
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive PNG WeChat & WhatsApp Share Modal */}
      {isShareModalOpen && (
        <PngShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title={`Exporter Payment Slip (付款单) — ${selectedMark} (${selectedDate})`}
          documentType="exporter_payment_slip"
          documentData={{
            shippingMark: selectedMark,
            packingDate: selectedDate,
            totalRmb: totals.totalAmount,
            totalBdt: totals.totalAmount * (companyProfile.rmbExchangeRate || 16.5),
            flight: selectedFlight,
          }}
          targetElementId="exporter-payment-slip-canvas"
          defaultFilename={formatExporterSlipExportFilename(selectedMark, selectedDate, 'png')}
          defaultPhone=""
        />
      )}
    </div>
  );
};
