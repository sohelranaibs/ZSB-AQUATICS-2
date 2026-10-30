import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  collectPackingManifestRecords,
  formatDate,
  formatYearMonthLabel,
} from '../utils/calculations.ts';
import {
  AirWayBillRow,
  AirWayBillRowOverride,
  buildAirWayBillRows,
  calculateAirWayBillRow,
  calculateAirWayBillTotals,
  createEmptyAirWayBillRow,
  createInitialAirWayBillRows,
  extractAirWayBillFilterOptions,
  formatAirWayBillExportFilename,
  mergeAirWayBillRows,
} from '../utils/airWayBill.ts';
import {
  exportElementToPdf,
  exportElementToPng,
  resolveCompanyLogoSrc,
} from '../utils/pdfGenerator.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import {
  ZSB_VIEW_SHORTCUT_EVENT,
  ViewShortcutEventDetail,
} from '../utils/keyboardShortcuts.ts';
import {
  Plane,
  Printer,
  FileDown,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Package,
  Loader2,
  ArrowUpRight,
  Check,
} from 'lucide-react';

const AWB_OVERRIDES_STORAGE_KEY = 'zsb_awb_row_overrides_v1';

export const AirWayBillView: React.FC = () => {
  const {
    companyProfile,
    packings,
    packingDraft,
    editingPackingId,
    updatePacking,
    dropdownOptions,
    openPrintModal,
    setActiveTab,
    showToast,
  } = useApp();

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedShipper, setSelectedShipper] = useState<string>('ALL');
  const [selectedFlight, setSelectedFlight] = useState<string>('ALL');

  const [rowOverrides, setRowOverrides] = useState<Record<string, AirWayBillRowOverride>>(() => {
    try {
      const saved = localStorage.getItem(AWB_OVERRIDES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [customRows, setCustomRows] = useState<AirWayBillRow[]>(() =>
    createInitialAirWayBillRows(4)
  );

  const [bulkRmbPerBox, setBulkRmbPerBox] = useState<string>('');
  const [bulkRate, setBulkRate] = useState<string>(() =>
    String(companyProfile.rmbExchangeRate || 16.5)
  );

  const [isExporting, setIsExporting] = useState<'pdf' | 'png' | null>(null);
  const sheetCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(AWB_OVERRIDES_STORAGE_KEY, JSON.stringify(rowOverrides));
    } catch {
      // Ignore storage quota errors
    }
  }, [rowOverrides]);

  // Combine saved Packing List records with any active draft in Packing List Form
  const allManifestRecords = useMemo(
    () => collectPackingManifestRecords(packings, packingDraft, editingPackingId),
    [packings, packingDraft, editingPackingId]
  );

  const filterOptions = useMemo(
    () => extractAirWayBillFilterOptions(allManifestRecords),
    [allManifestRecords]
  );

  const dbRows = useMemo(
    () =>
      buildAirWayBillRows(allManifestRecords, rowOverrides, {
        yearMonth: selectedMonth,
        shipper: selectedShipper,
        flight: selectedFlight,
      }),
    [allManifestRecords, rowOverrides, selectedMonth, selectedShipper, selectedFlight]
  );

  const displayRows = useMemo(
    () =>
      mergeAirWayBillRows(dbRows, customRows, {
        yearMonth: selectedMonth,
        shipper: selectedShipper,
        flight: selectedFlight,
      }),
    [dbRows, customRows, selectedMonth, selectedShipper, selectedFlight]
  );

  const totals = useMemo(() => calculateAirWayBillTotals(displayRows), [displayRows]);

  const handleRowEditableChange = (
    row: AirWayBillRow,
    field: 'rmbPerBox' | 'rate' | 'date' | 'shipper' | 'flight' | 'totalBox',
    rawValue: string
  ) => {
    if (row.packingId && (field === 'rmbPerBox' || field === 'rate')) {
      const numVal = rawValue === '' ? 0 : parseFloat(rawValue) || 0;
      setRowOverrides((prev) => ({
        ...prev,
        [row.packingId!]: {
          ...prev[row.packingId!],
          [field]: numVal,
        },
      }));

      // Also persist onto saved PackingRecord if it exists in packings
      if (row.packingId !== 'draft-packing-manifest') {
        const nextRmbPerBox =
          field === 'rmbPerBox' ? numVal : row.rmbPerBox;
        const nextRate = field === 'rate' ? numVal : row.rate;
        updatePacking(
          row.packingId,
          {
            awbRmbPerBox: nextRmbPerBox,
            awbRate: nextRate,
          },
          true
        );
      }
      return;
    }

    // Custom row update
    setCustomRows((prev) =>
      prev.map((r) => {
        if (r.id !== row.id) return r;
        const updated = { ...r };
        if (field === 'date' || field === 'shipper' || field === 'flight') {
          updated[field] = rawValue;
        } else {
          const numVal = rawValue === '' ? 0 : parseFloat(rawValue) || 0;
          updated[field] = numVal;
        }
        const computed = calculateAirWayBillRow(
          updated.totalBox,
          updated.rmbPerBox,
          updated.rate
        );
        updated.totalRmb = computed.totalRmb;
        updated.bdtAmount = computed.bdtAmount;
        return updated;
      })
    );
  };

  const handleApplyBulkRates = () => {
    const hasBulkRmb = bulkRmbPerBox.trim() !== '' && !Number.isNaN(Number(bulkRmbPerBox));
    const hasBulkRate = bulkRate.trim() !== '' && !Number.isNaN(Number(bulkRate));
    if (!hasBulkRmb && !hasBulkRate) {
      showToast('Enter a default RMB/Per Box or Rate to apply to active rows.');
      return;
    }

    const rmbVal = hasBulkRmb ? parseFloat(bulkRmbPerBox) : undefined;
    const rateVal = hasBulkRate ? parseFloat(bulkRate) : undefined;

    const nextOverrides = { ...rowOverrides };
    for (const row of dbRows) {
      if (!row.packingId) continue;
      nextOverrides[row.packingId] = {
        rmbPerBox: rmbVal !== undefined ? rmbVal : row.rmbPerBox,
        rate: rateVal !== undefined ? rateVal : row.rate,
      };
      if (row.packingId !== 'draft-packing-manifest') {
        updatePacking(
          row.packingId,
          {
            awbRmbPerBox: rmbVal !== undefined ? rmbVal : row.rmbPerBox,
            awbRate: rateVal !== undefined ? rateVal : row.rate,
          },
          true
        );
      }
    }
    setRowOverrides(nextOverrides);

    setCustomRows((prev) =>
      prev.map((r) => {
        if (r.totalBox <= 0 && !r.shipper && !r.flight) return r;
        const nextRmb = rmbVal !== undefined ? rmbVal : r.rmbPerBox;
        const nextRt = rateVal !== undefined ? rateVal : r.rate;
        const computed = calculateAirWayBillRow(r.totalBox, nextRmb, nextRt);
        return {
          ...r,
          rmbPerBox: nextRmb,
          rate: nextRt,
          totalRmb: computed.totalRmb,
          bdtAmount: computed.bdtAmount,
        };
      })
    );

    showToast('Applied RMB/Per Box and Rate across active Air Way Bill rows.');
  };

  const handleAddRow = () => {
    setCustomRows((prev) => [
      ...prev,
      createEmptyAirWayBillRow(`awb-custom-${Date.now()}-${prev.length + 1}`),
    ]);
  };

  const handleResetFiltersAndOverrides = () => {
    setSelectedMonth('all');
    setSelectedShipper('ALL');
    setSelectedFlight('ALL');
    setCustomRows(createInitialAirWayBillRows(4));
    showToast('Reset Air Way Bill filters.');
  };

  const handleOpenPrintPreview = () => {
    openPrintModal({
      type: 'air_way_bill',
      title:
        selectedMonth !== 'all'
          ? `AIR WAY BILL — Monthly Statement (${formatYearMonthLabel(selectedMonth)})`
          : 'AIR WAY BILL — Monthly Statement',
      data: {
        yearMonth: selectedMonth,
        monthLabel:
          selectedMonth !== 'all' ? formatYearMonthLabel(selectedMonth) : 'All Active Months',
        shipper: selectedShipper,
        flight: selectedFlight,
        rows: displayRows,
        totals,
      },
    });
  };

  const handleDirectExport = async (format: 'pdf' | 'png') => {
    if (!sheetCaptureRef.current || isExporting) return;
    setIsExporting(format);
    const filename = formatAirWayBillExportFilename(selectedMonth, selectedShipper, format);
    try {
      if (format === 'pdf') {
        await exportElementToPdf(sheetCaptureRef.current, filename);
        showToast(`Saved Air Way Bill PDF: ${filename}`);
      } else {
        await exportElementToPng(sheetCaptureRef.current, filename);
        showToast(`Saved Air Way Bill PNG: ${filename}`);
      }
    } catch {
      showToast(`Failed to export ${format.toUpperCase()}. Opening print preview...`);
      handleOpenPrintPreview();
    } finally {
      setIsExporting(null);
    }
  };

  useEffect(() => {
    const onShortcut = (e: Event) => {
      const customEvent = e as CustomEvent<ViewShortcutEventDetail>;
      const action = customEvent.detail?.action;
      if (action === 'PRINT_ACTIVE_VIEW') {
        customEvent.detail.handled = true;
        handleOpenPrintPreview();
      } else if (action === 'SAVE_ACTIVE_VIEW') {
        customEvent.detail.handled = true;
        void handleDirectExport('pdf');
      } else if (action === 'ADD_FORM_ROW') {
        customEvent.detail.handled = true;
        handleAddRow();
      } else if (action === 'RESET_FORM') {
        customEvent.detail.handled = true;
        handleResetFiltersAndOverrides();
      }
    };
    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
  });

  const formatCellNumber = (val: number) => {
    if (!val || val === 0) return '';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: val % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  };

  const resolvedLogoSrc = resolveCompanyLogoSrc(companyProfile.logoUrl);

  return (
    <div
      className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5"
      data-testid="air-way-bill-view"
    >
      {/* Top Executive Banner */}
      <div className="bg-[#1b2b44] text-white px-5 py-3 rounded-lg shadow-md flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={resolvedLogoSrc}
              alt={companyProfile.companyName}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith(COMPANY_LOGO_URL)) {
                  target.src = COMPANY_LOGO_URL;
                }
              }}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="zsb-3d-text text-xl sm:text-2xl font-black">
                {companyProfile.companyName}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                AIR WAY BILL — Monthly Statement
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Auto-synced from PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST) · Editable RMB/PER BOX &amp; RATE
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="awb-save-pdf-btn"
            disabled={isExporting !== null}
            onClick={() => void handleDirectExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow transition cursor-pointer"
          >
            {isExporting === 'pdf' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>SAVE .PDF</span>
          </button>

          <button
            type="button"
            data-testid="awb-save-png-btn"
            disabled={isExporting !== null}
            onClick={() => void handleDirectExport('png')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow transition cursor-pointer"
          >
            {isExporting === 'png' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>SAVE .PNG</span>
          </button>

          <button
            type="button"
            data-testid="awb-print-preview-btn"
            onClick={handleOpenPrintPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#2f75b5] hover:bg-[#255e92] text-white rounded shadow transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT / PREVIEW</span>
          </button>
        </div>
      </div>

      {/* Filter & Bulk Rate Toolbar */}
      <div className="bg-white rounded-xl shadow border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {/* Month Statement Filter */}
          <div>
            <label
              htmlFor="awb-month-select"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1"
            >
              Statement Month (Packing Date)
            </label>
            <select
              id="awb-month-select"
              aria-label="Statement Month"
              data-testid="awb-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900"
            >
              <option value="all">All Active Months ({allManifestRecords.length} Manifests)</option>
              {filterOptions.months.map((ym) => (
                <option key={ym} value={ym}>
                  {formatYearMonthLabel(ym)} ({ym})
                </option>
              ))}
            </select>
          </div>

          {/* Shipper Filter */}
          <div>
            <label
              htmlFor="awb-shipper-select"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1"
            >
              Shipper (From Packing List)
            </label>
            <select
              id="awb-shipper-select"
              aria-label="Filter by Shipper"
              data-testid="awb-shipper-select"
              value={selectedShipper}
              onChange={(e) => setSelectedShipper(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900"
            >
              <option value="ALL">ALL SHIPPERS</option>
              {Array.from(
                new Set([...filterOptions.shippers, ...dropdownOptions.shippers])
              ).map((sh) => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </select>
          </div>

          {/* Flight Filter */}
          <div>
            <label
              htmlFor="awb-flight-select"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1"
            >
              Flight (From Packing List)
            </label>
            <select
              id="awb-flight-select"
              aria-label="Filter by Flight"
              data-testid="awb-flight-select"
              value={selectedFlight}
              onChange={(e) => setSelectedFlight(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900"
            >
              <option value="ALL">ALL FLIGHTS</option>
              {Array.from(
                new Set([...filterOptions.flights, ...dropdownOptions.flights])
              ).map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Default RMB/Per Box & Rate Apply + Row Actions */}
        <div className="flex flex-wrap items-end gap-2 border-t lg:border-t-0 lg:border-l border-slate-200 pt-3 lg:pt-0 lg:pl-4">
          <div className="w-28">
            <label
              htmlFor="awb-bulk-rmb-input"
              className="font-bold text-slate-700 uppercase text-[10px] block mb-1"
            >
              Set RMB/Box
            </label>
            <input
              id="awb-bulk-rmb-input"
              type="number"
              step="0.01"
              placeholder="e.g. 120"
              value={bulkRmbPerBox}
              onChange={(e) => setBulkRmbPerBox(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold text-slate-900"
            />
          </div>

          <div className="w-24">
            <label
              htmlFor="awb-bulk-rate-input"
              className="font-bold text-slate-700 uppercase text-[10px] block mb-1"
            >
              Set Rate
            </label>
            <input
              id="awb-bulk-rate-input"
              type="number"
              step="0.01"
              placeholder="16.5"
              value={bulkRate}
              onChange={(e) => setBulkRate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold text-slate-900"
            />
          </div>

          <button
            type="button"
            data-testid="awb-apply-bulk-btn"
            onClick={handleApplyBulkRates}
            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded shadow-2xs transition inline-flex items-center gap-1 cursor-pointer"
            title="Apply RMB/Per Box and Rate to all active Packing List rows"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply to Rows</span>
          </button>

          <button
            type="button"
            data-testid="awb-add-row-btn"
            onClick={handleAddRow}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded shadow-2xs transition inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Row</span>
          </button>

          <button
            type="button"
            data-testid="awb-reset-btn"
            onClick={handleResetFiltersAndOverrides}
            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded transition inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Printable AIR WAY BILL Sheet Card (A4 Portrait Print Area & Compact Column Widths) */}
      <div
        id="awb-printable-sheet"
        ref={sheetCaptureRef}
        data-testid="awb-sheet-card"
        style={{ backgroundColor: '#ffffff', color: '#000000' }}
        className="w-full max-w-[760px] mx-auto bg-white rounded-lg shadow-lg border border-slate-300 p-4 sm:p-6 space-y-4 overflow-x-auto"
      >
        {/* Official Company Header with Logo Emblem for A4 Sheet & Direct PDF/PNG Exports */}
        <div
          style={{ borderBottom: '2px solid #0f172a' }}
          className="pb-3 text-center space-y-1"
        >
          <div className="flex justify-center mb-1">
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '9999px',
                overflow: 'hidden',
                border: '2px solid #fbbf24',
                backgroundColor: '#ffffff',
                padding: '2px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="w-15 h-15 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shadow-xs flex items-center justify-center"
            >
              <img
                data-testid="awb-sheet-company-logo"
                src={resolvedLogoSrc}
                alt={companyProfile.companyName}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith(COMPANY_LOGO_URL)) {
                    target.src = COMPANY_LOGO_URL;
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '9999px',
                  display: 'block',
                }}
                className="w-full h-full object-contain rounded-full"
              />
            </div>
          </div>

          <div
            className="zsb-3d-text-print text-2xl sm:text-3xl font-black tracking-widest uppercase"
            style={{
              color: '#f59e0b',
              fontFamily: "'Cinzel', Georgia, Cambria, 'Times New Roman', Times, serif",
              fontWeight: 900,
              letterSpacing: '0.09em',
              textShadow:
                '1px 1px 0px #b45309, 2px 2px 0px #92400e, 3px 3px 0px #78350f, 4px 4px 0px #451a03, 5px 5px 7px rgba(15, 23, 42, 0.35)',
            }}
          >
            {companyProfile.companyName}
          </div>

          <div style={{ color: '#000000' }} className="text-[11px] font-bold tracking-wide">
            Address: {companyProfile.address}
          </div>

          <div style={{ color: '#000000' }} className="text-[11px] font-bold font-mono">
            Mobile: {companyProfile.mobiles.join(' , ')} | EMAIL:{' '}
            {companyProfile.email || 'www.zsbaquatics.com'}
          </div>
        </div>

        <table
          data-testid="awb-statement-table"
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            tableLayout: 'fixed',
          }}
          className="text-xs font-sans select-none"
        >
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            {/* Row 1: Deep Blue "AIR WAY BILL" Title Banner */}
            <tr>
              <th
                colSpan={8}
                style={{
                  backgroundColor: '#2f75b5',
                  color: '#ffffff',
                  border: '1.5px solid #000000',
                  letterSpacing: '0.04em',
                }}
                className="py-1.5 px-3 text-center text-base sm:text-lg font-extrabold uppercase"
              >
                AIR WAY BILL
              </th>
            </tr>

            {/* Row 2: Light Blue Column Headers (Compact A4 Sizing) */}
            <tr
              style={{
                backgroundColor: '#bdd7ee',
                color: '#000000',
              }}
              className="text-[10.5px] sm:text-[11px] font-extrabold uppercase text-center leading-tight"
            >
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                DATE
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                SHIPPER
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                FLIGHT
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                TOTAL BOX
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                RMB/PER BOX
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                TOTAL RMB
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                RATE
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                BDT AMOUNT
              </th>
            </tr>
          </thead>

          <tbody>
            {displayRows.map((row, idx) => {
              const rowNum = idx + 1;
              const isFromPackingList = Boolean(row.packingId);

              return (
                <tr
                  key={row.id}
                  data-testid={`awb-table-row-${rowNum}`}
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  className="hover:bg-sky-50/40 transition"
                >
                  {/* 1. DATE */}
                  <td
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="p-0.5 text-center font-mono font-semibold text-[11px]"
                  >
                    {isFromPackingList ? (
                      <span data-testid={`awb-row-${rowNum}-date`}>
                        {formatDate(row.date)}
                      </span>
                    ) : (
                      <input
                        type="date"
                        aria-label={`Row ${rowNum} Date`}
                        value={row.date}
                        onChange={(e) =>
                          handleRowEditableChange(row, 'date', e.target.value)
                        }
                        className="w-full h-full text-center font-mono text-[11px] bg-transparent focus:bg-amber-50 focus:outline-none px-0.5"
                      />
                    )}
                  </td>

                  {/* 2. SHIPPER */}
                  <td
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="p-0.5 text-center font-bold text-[11px] truncate"
                  >
                    {isFromPackingList ? (
                      <span data-testid={`awb-row-${rowNum}-shipper`}>
                        {row.shipper}
                      </span>
                    ) : (
                      <input
                        type="text"
                        aria-label={`Row ${rowNum} Shipper`}
                        placeholder=""
                        value={row.shipper}
                        onChange={(e) =>
                          handleRowEditableChange(row, 'shipper', e.target.value)
                        }
                        className="w-full h-full text-center font-bold text-[11px] bg-transparent focus:bg-amber-50 focus:outline-none px-0.5"
                      />
                    )}
                  </td>

                  {/* 3. FLIGHT */}
                  <td
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="p-0.5 text-center font-mono font-bold text-[11px] truncate"
                  >
                    {isFromPackingList ? (
                      <span data-testid={`awb-row-${rowNum}-flight`}>
                        {row.flight}
                      </span>
                    ) : (
                      <input
                        type="text"
                        aria-label={`Row ${rowNum} Flight`}
                        placeholder=""
                        value={row.flight}
                        onChange={(e) =>
                          handleRowEditableChange(row, 'flight', e.target.value)
                        }
                        className="w-full h-full text-center font-mono font-bold text-[11px] bg-transparent focus:bg-amber-50 focus:outline-none px-0.5"
                      />
                    )}
                  </td>

                  {/* 4. TOTAL BOX */}
                  <td
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="p-0.5 text-center font-mono font-bold text-[11px] tabular-nums"
                  >
                    {isFromPackingList ? (
                      <span data-testid={`awb-row-${rowNum}-box`}>
                        {row.totalBox > 0 ? row.totalBox : ''}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label={`Row ${rowNum} Total Box`}
                        value={row.totalBox > 0 ? row.totalBox : ''}
                        onChange={(e) =>
                          handleRowEditableChange(row, 'totalBox', e.target.value)
                        }
                        className="w-full h-full text-center font-mono font-bold text-[11px] bg-transparent focus:bg-amber-50 focus:outline-none px-0.5 tabular-nums"
                      />
                    )}
                  </td>

                  {/* 5. RMB/PER BOX (EDITABLE) */}
                  <td
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="p-0.5 text-center font-mono font-bold text-[11px] tabular-nums bg-amber-50/25"
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`Row ${rowNum} RMB/Per Box`}
                      data-testid={`awb-row-${rowNum}-rmb-per-box`}
                      value={row.rmbPerBox > 0 ? row.rmbPerBox : ''}
                      onChange={(e) =>
                        handleRowEditableChange(row, 'rmbPerBox', e.target.value)
                      }
                      className="w-full h-full text-center font-mono font-bold text-[11px] bg-transparent focus:bg-amber-100/70 focus:outline-none px-1 py-0.5 rounded tabular-nums"
                    />
                  </td>

                  {/* 6. TOTAL RMB (= TOTAL BOX * RMB/PER BOX) */}
                  <td
                    data-testid={`awb-row-${rowNum}-total-rmb`}
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="py-1 px-1.5 text-center font-mono font-bold text-[11px] tabular-nums"
                  >
                    {formatCellNumber(row.totalRmb)}
                  </td>

                  {/* 7. RATE (EDITABLE) */}
                  <td
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="p-0.5 text-center font-mono font-bold text-[11px] tabular-nums bg-amber-50/25"
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`Row ${rowNum} Rate`}
                      data-testid={`awb-row-${rowNum}-rate`}
                      value={row.rate > 0 ? row.rate : ''}
                      onChange={(e) =>
                        handleRowEditableChange(row, 'rate', e.target.value)
                      }
                      className="w-full h-full text-center font-mono font-bold text-[11px] bg-transparent focus:bg-amber-100/70 focus:outline-none px-1 py-0.5 rounded tabular-nums"
                    />
                  </td>

                  {/* 8. BDT AMOUNT (= TOTAL RMB * RATE) */}
                  <td
                    data-testid={`awb-row-${rowNum}-bdt-amount`}
                    style={{ border: '1.5px solid #000000', height: '30px' }}
                    className="py-1 px-1.5 text-center font-mono font-extrabold text-[11px] tabular-nums"
                  >
                    {formatCellNumber(row.bdtAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer: Matches Reference Image ("TOTAL AMOUNT (BDT)" spanning RMB/PER BOX..RATE + value in BDT AMOUNT) */}
          <tfoot>
            <tr>
              <td
                colSpan={4}
                style={{ border: 'none', backgroundColor: 'transparent' }}
                className="py-1.5 px-1 text-left text-[11px] text-slate-500 font-mono print:text-transparent"
              >
                {totals.totalBoxes > 0
                  ? `Boxes: ${totals.totalBoxes} | RMB: ¥${totals.totalRmb.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : ''}
              </td>
              <td
                colSpan={3}
                style={{
                  backgroundColor: '#bdd7ee',
                  color: '#000000',
                  border: '1.5px solid #000000',
                  height: '32px',
                }}
                className="py-1 px-2 text-center text-[11px] font-extrabold uppercase tracking-wide"
              >
                TOTAL AMOUNT (BDT)
              </td>
              <td
                data-testid="awb-grand-total-bdt"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: '1.5px solid #000000',
                  height: '32px',
                }}
                className="py-1 px-1.5 text-center font-mono font-black text-[11px] tabular-nums"
              >
                {totals.totalAmountBDT > 0
                  ? totals.totalAmountBDT.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '0.00'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bottom Summary Strip & Quick Link to Packing List Form */}
      <div className="bg-white rounded-xl shadow border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-6 font-mono">
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-sans font-bold block">
              Synced Packing Manifests
            </span>
            <span className="text-sm font-black text-slate-900">
              {dbRows.length} Consignment{dbRows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-sans font-bold block">
              Cumulative Total Box
            </span>
            <span className="text-sm font-black text-blue-800">
              {totals.totalBoxes} Boxes
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-sans font-bold block">
              Cumulative Total RMB
            </span>
            <span className="text-sm font-black text-teal-800">
              ¥{' '}
              {totals.totalRmb.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-sans font-bold block">
              Total Amount (BDT)
            </span>
            <span className="text-sm font-black text-emerald-700">
              {companyProfile.currency}{' '}
              {totals.totalAmountBDT.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('packing_form')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-teal-700" />
            <span>Open Packing List Data Entry Form</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('packing_db')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition cursor-pointer"
          >
            <Plane className="w-3.5 h-3.5 text-blue-700" />
            <span>Open Packing DB</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
