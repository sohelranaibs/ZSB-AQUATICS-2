import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  collectPackingManifestRecords,
  formatDate,
  formatYearMonthLabel,
} from '../utils/calculations.ts';
import { useRowScrollViewport } from '../hooks/useRowScrollViewport.ts';
import { useDebouncedStoreSave } from '../hooks/useDebouncedStoreSave.ts';
import { MAX_VISIBLE_TABLE_ROWS } from '../utils/tableScroll.ts';
import {
  AirWayBillRow,
  AirWayBillRowOverride,
  buildAirWayBillRows,
  calculateAirWayBillTotals,
  createInitialAirWayBillRows,
  extractAirWayBillFilterOptions,
  formatAirWayBillExportFilename,
  isCompleteIsoDateInput,
  isValidSignedDecimalDraft,
  mergeAirWayBillRows,
  normalizeAirWayBillDateKey,
  normalizeSignedZero,
  parseSignedNumber,
  resolveAirWayBillSelection,
  toggleAirWayBillRowSelection,
  toggleAllAirWayBillRowsSelection,
} from '../utils/airWayBill.ts';
import { isAirWayBillRowDataEqual } from '../utils/tableRowOptimization.ts';
import {
  exportElementToPdf,
  exportElementToPng,
  resolveCompanyLogoSrc,
} from '../utils/pdfGenerator.ts';
import { yieldForDomFrame } from '../utils/pdfExportStyles.ts';
import {
  ZSB_VIEW_SHORTCUT_EVENT,
  ViewShortcutEventDetail,
} from '../utils/keyboardShortcuts.ts';
import {
  Plane,
  Printer,
  FileDown,
  Image as ImageIcon,
  RotateCcw,
  Package,
  Loader2,
  ArrowUpRight,
  Check,
  Lock,
  X,
} from 'lucide-react';
import {
  PngShareModal,
  WeChatIcon,
} from './PngShareModal.tsx';
import { useTableColumnOrder } from '../hooks/useTableColumnOrder.ts';
import {
  ColumnReorderToolbar,
  ColumnDragGrip,
} from './ColumnReorderToolbar.tsx';

const AWB_DEFAULT_COLUMNS = [
  'date',
  'documentsHolder',
  'flight',
  'totalBox',
  'rmbPerBox',
  'totalRmb',
  'rate',
  'bdtAmount',
] as const;
type AwbColumnId = (typeof AWB_DEFAULT_COLUMNS)[number];

const AWB_COLUMN_WIDTHS: Record<AwbColumnId, string> = {
  date: '13%',
  documentsHolder: '18%',
  flight: '9%',
  totalBox: '8%',
  rmbPerBox: '9%',
  totalRmb: '10%',
  rate: '8%',
  bdtAmount: '13%',
};

const AWB_OVERRIDES_STORAGE_KEY = 'zsb_awb_row_overrides_v2';
const DEFAULT_BLANK_AWB_ROWS: AirWayBillRow[] = createInitialAirWayBillRows(4);

const formatAwbCellNumber = (val: number, showZero = false) => {
  const cleanVal = normalizeSignedZero(Number(val) || 0);
  if (cleanVal === 0 && !showZero) return '';
  return cleanVal.toLocaleString('en-US', {
    minimumFractionDigits: cleanVal % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const isEmptyOrSignOnlyDraft = (raw: string): boolean => {
  const t = raw.trim();
  return t === '' || t === '+' || t === '-' || t === '.' || t === '+.' || t === '-.';
};

interface AirWayBillTableRowProps {
  row: AirWayBillRow;
  rowIndex: number;
  columnOrder: readonly AwbColumnId[];
  isSelected: boolean;
  onToggleSelect: (rowId: string) => void;
  onRowEditableChange: (
    row: AirWayBillRow,
    field: 'date' | 'rmbPerBox' | 'rate',
    rawValue: string
  ) => void;
}

const areAirWayBillTableRowPropsEqual = (
  prev: AirWayBillTableRowProps,
  next: AirWayBillTableRowProps
): boolean =>
  prev.rowIndex === next.rowIndex &&
  prev.columnOrder === next.columnOrder &&
  prev.isSelected === next.isSelected &&
  prev.onToggleSelect === next.onToggleSelect &&
  prev.onRowEditableChange === next.onRowEditableChange &&
  isAirWayBillRowDataEqual(prev.row, next.row);

const AirWayBillTableRow: React.FC<AirWayBillTableRowProps> = memo(
  ({ row, rowIndex, columnOrder, isSelected, onToggleSelect, onRowEditableChange }) => {
    const rowNum = rowIndex + 1;
    const isFromPackingList = Boolean(row.packingId);
    const normalizedRowDate = normalizeAirWayBillDateKey(row.date || '');

    const [dateDraft, setDateDraft] = useState<string>(() => normalizedRowDate);
    const [rmbDraft, setRmbDraft] = useState<string>(() =>
      row.rmbPerBox !== 0 ? String(row.rmbPerBox) : ''
    );
    const [rateDraft, setRateDraft] = useState<string>(() =>
      row.rate !== 0 || row.rateSpecified ? String(row.rate) : ''
    );
    const isEditingDateRef = useRef(false);
    const isEditingRmbRef = useRef(false);
    const isEditingRateRef = useRef(false);

    useEffect(() => {
      if (!isEditingDateRef.current) {
        setDateDraft(normalizedRowDate);
      }
    }, [normalizedRowDate]);

    useEffect(() => {
      if (!isEditingRmbRef.current) {
        setRmbDraft(row.rmbPerBox !== 0 ? String(row.rmbPerBox) : '');
      }
    }, [row.rmbPerBox]);

    useEffect(() => {
      if (!isEditingRateRef.current) {
        setRateDraft(row.rate !== 0 || row.rateSpecified ? String(row.rate) : '');
      }
    }, [row.rate, row.rateSpecified]);

    const lockedHolderShipper = (row.documentsHolder || row.shipper || '').trim();

    const handleDateFocus = useCallback(() => {
      isEditingDateRef.current = true;
    }, []);

    const handleDateChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setDateDraft(raw);
        if (isCompleteIsoDateInput(raw)) {
          onRowEditableChange(row, 'date', raw);
        }
      },
      [onRowEditableChange, row]
    );

    const handleDateBlur = useCallback(() => {
      isEditingDateRef.current = false;
      if (isCompleteIsoDateInput(dateDraft)) {
        if (dateDraft !== normalizedRowDate) {
          onRowEditableChange(row, 'date', dateDraft);
        }
      } else {
        // Restore valid date if user left the input incomplete or blank
        setDateDraft(normalizedRowDate);
      }
    }, [dateDraft, normalizedRowDate, onRowEditableChange, row]);

    const handleDateKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDateDraft(normalizedRowDate);
          e.currentTarget.blur();
        }
      },
      [normalizedRowDate]
    );

    const handleRmbPerBoxChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (!isValidSignedDecimalDraft(raw)) return;
        setRmbDraft(raw);
        onRowEditableChange(row, 'rmbPerBox', raw);
      },
      [onRowEditableChange, row]
    );

    const handleRmbFocus = useCallback(() => {
      isEditingRmbRef.current = true;
    }, []);

    const handleRmbBlur = useCallback(() => {
      isEditingRmbRef.current = false;
      setRmbDraft((prev) => {
        if (isEmptyOrSignOnlyDraft(prev)) return '';
        const num = parseSignedNumber(prev);
        return num !== 0 ? String(num) : '';
      });
    }, []);

    const handleRateChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (!isValidSignedDecimalDraft(raw)) return;
        setRateDraft(raw);
        onRowEditableChange(row, 'rate', raw);
      },
      [onRowEditableChange, row]
    );

    const handleRateFocus = useCallback(() => {
      isEditingRateRef.current = true;
    }, []);

    const handleRateBlur = useCallback(() => {
      isEditingRateRef.current = false;
      setRateDraft((prev) => {
        const trimmed = prev.trim();
        if (isEmptyOrSignOnlyDraft(trimmed)) return '';
        if (trimmed === '-0' || trimmed === '+0' || trimmed === '0') {
          return trimmed;
        }
        return String(parseSignedNumber(trimmed));
      });
    }, []);

    const handleToggleCheckbox = useCallback(() => {
      onToggleSelect(row.id);
    }, [onToggleSelect, row.id]);

    return (
      <tr
        data-testid={`awb-table-row-${rowNum}`}
        data-packing-locked="true"
        data-selected={isSelected ? 'true' : 'false'}
        style={{
          backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
          color: '#000000',
        }}
        className="hover:bg-sky-50/60 transition"
      >
        {/* Select Row Checkbox */}
        <td
          style={{ border: '1.5px solid #000000', height: '36px' }}
          className="px-1.5 py-1 text-center print:hidden"
        >
          {isFromPackingList ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleToggleCheckbox}
              data-testid={`awb-row-${rowNum}-select`}
              aria-label={`Select row ${rowNum} (${lockedHolderShipper || 'Row'}${row.date ? ` ${formatDate(row.date)}` : ''})`}
              title={
                isSelected
                  ? 'Selected for Bill Invoice (click to unselect)'
                  : 'Select this row for an individual or multi-row Bill Invoice'
              }
              className="w-4 h-4 cursor-pointer accent-[#2f75b5] rounded align-middle"
            />
          ) : (
            <span className="text-slate-300 select-none" aria-hidden="true" />
          )}
        </td>

        {/* 0. SL # */}
        <td
          style={{ border: '1.5px solid #000000', height: '36px' }}
          className="px-1.5 py-1 text-center"
        >
          <span className="zsb-sl-badge">
            {String(rowNum).padStart(2, '0')}
          </span>
        </td>

        {columnOrder.map((colId) => {
          switch (colId) {
            case 'date':
              return (
                <td
                  key="date"
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className={`px-1 py-1 text-center font-mono font-semibold text-xs sm:text-sm whitespace-nowrap ${
                    row.isDateOverridden ? 'bg-amber-50/70' : ''
                  }`}
                >
                  {isFromPackingList ? (
                    <input
                      type="date"
                      aria-label={`Row ${rowNum} Date`}
                      data-testid={`awb-row-${rowNum}-date`}
                      data-date-overridden={row.isDateOverridden ? 'true' : 'false'}
                      title={
                        row.isDateOverridden && row.originalDate
                          ? `Adjusted Date (Original Packing List Date: ${formatDate(row.originalDate)}). Packing List remains unchanged.`
                          : 'Edit date to move/group this row onto a different date and combine Total Box'
                      }
                      value={dateDraft}
                      onFocus={handleDateFocus}
                      onChange={handleDateChange}
                      onBlur={handleDateBlur}
                      onKeyDown={handleDateKeyDown}
                      className="w-full h-full text-center font-mono font-semibold text-[11px] sm:text-xs bg-transparent focus:bg-amber-100/70 focus:outline-none px-0.5 rounded cursor-pointer"
                    />
                  ) : (
                    <span
                      data-testid={`awb-row-${rowNum}-date`}
                      className="text-slate-300 select-none"
                    />
                  )}
                </td>
              );
            case 'documentsHolder':
              return (
                <td
                  key="documentsHolder"
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className="px-2 py-1 text-center font-bold text-xs sm:text-[13px] select-none"
                >
                  <span
                    data-testid={`awb-row-${rowNum}-documents-holder`}
                    title={
                      lockedHolderShipper
                        ? `${lockedHolderShipper} (Locked — synced strictly from Packing List)`
                        : undefined
                    }
                    className="block truncate"
                  >
                    {lockedHolderShipper}
                  </span>
                </td>
              );
            case 'flight':
              return (
                <td
                  key="flight"
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className="px-2 py-1 text-center font-mono font-bold text-xs sm:text-sm whitespace-nowrap select-none"
                >
                  <span
                    data-testid={`awb-row-${rowNum}-flight`}
                    title={
                      row.flight
                        ? `${row.flight} (Locked — synced strictly from Packing List)`
                        : undefined
                    }
                  >
                    {row.flight}
                  </span>
                </td>
              );
            case 'totalBox':
              return (
                <td
                  key="totalBox"
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className="px-2 py-1 text-center font-mono font-bold text-xs sm:text-sm tabular-nums select-none"
                >
                  <span
                    data-testid={`awb-row-${rowNum}-box`}
                    title={
                      (row.mergedCount || 1) > 1
                        ? `Combined total boxes from ${row.mergedCount} Packing List entries (${formatDate(row.date)} · ${lockedHolderShipper} · ${row.flight})`
                        : row.totalBox !== 0
                        ? 'Locked — synced strictly from Packing List'
                        : undefined
                    }
                  >
                    {row.totalBox !== 0 ? row.totalBox : ''}
                  </span>
                </td>
              );
            case 'rmbPerBox':
              return (
                <td
                  key="rmbPerBox"
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className={`px-1.5 py-1 text-center font-mono font-bold text-xs sm:text-sm tabular-nums ${
                    isFromPackingList ? 'bg-amber-50/25' : ''
                  }`}
                >
                  {isFromPackingList ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Row ${rowNum} RMB/Per Box`}
                      data-testid={`awb-row-${rowNum}-rmb-per-box`}
                      value={rmbDraft}
                      onFocus={handleRmbFocus}
                      onBlur={handleRmbBlur}
                      onChange={handleRmbPerBoxChange}
                      className="w-full h-full text-center font-mono font-bold text-xs sm:text-sm bg-transparent focus:bg-amber-100/70 focus:outline-none px-1.5 py-0.5 rounded tabular-nums"
                    />
                  ) : null}
                </td>
              );
            case 'totalRmb':
              return (
                <td
                  key="totalRmb"
                  data-testid={`awb-row-${rowNum}-total-rmb`}
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className={`px-2 py-1 text-center font-mono font-bold text-xs sm:text-sm tabular-nums ${
                    row.totalRmb < 0 ? 'text-rose-700' : ''
                  }`}
                >
                  {formatAwbCellNumber(row.totalRmb)}
                </td>
              );
            case 'rate':
              return (
                <td
                  key="rate"
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className={`px-1.5 py-1 text-center font-mono font-bold text-xs sm:text-sm tabular-nums ${
                    isFromPackingList ? 'bg-amber-50/25' : ''
                  }`}
                >
                  {isFromPackingList ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Row ${rowNum} Rate`}
                      data-testid={`awb-row-${rowNum}-rate`}
                      value={rateDraft}
                      onFocus={handleRateFocus}
                      onBlur={handleRateBlur}
                      onChange={handleRateChange}
                      className={`w-full h-full text-center font-mono font-bold text-xs sm:text-sm bg-transparent focus:bg-amber-100/70 focus:outline-none px-1.5 py-0.5 rounded tabular-nums ${
                        row.rate < 0 ? 'text-rose-700' : ''
                      }`}
                    />
                  ) : null}
                </td>
              );
            case 'bdtAmount':
              return (
                <td
                  key="bdtAmount"
                  data-testid={`awb-row-${rowNum}-bdt-amount`}
                  style={{ border: '1.5px solid #000000', height: '36px' }}
                  className={`px-2 py-1 text-center font-mono font-extrabold text-xs sm:text-sm tabular-nums ${
                    row.bdtAmount < 0 ? 'text-rose-700' : ''
                  }`}
                >
                  {formatAwbCellNumber(row.bdtAmount, row.totalRmb !== 0 && Boolean(row.rateSpecified))}
                </td>
              );
            default:
              return null;
          }
        })}
      </tr>
    );
  },
  areAirWayBillTableRowPropsEqual
);

export const AirWayBillView: React.FC = () => {
  const awbColOrder = useTableColumnOrder('air_way_bill', AWB_DEFAULT_COLUMNS);

  const {
    companyProfile,
    packings,
    packingDraft,
    editingPackingId,
    dropdownOptions,
    openPrintModal,
    setActiveTab,
    showToast,
  } = useApp();

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedShipper, setSelectedShipper] = useState<string>('ALL');
  const [selectedDocumentsHolder, setSelectedDocumentsHolder] = useState<string>('ALL');
  const [selectedFlight, setSelectedFlight] = useState<string>('ALL');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const [rowOverrides, setRowOverrides] = useState<Record<string, AirWayBillRowOverride>>(() => {
    try {
      const saved = localStorage.getItem(AWB_OVERRIDES_STORAGE_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved) as Record<string, Record<string, unknown>>;
      if (!parsed || typeof parsed !== 'object') return {};
      // Strip any legacy documentsHolder overrides so table strictly mirrors Packing List
      const sanitized: Record<string, AirWayBillRowOverride> = {};
      for (const [id, entry] of Object.entries(parsed)) {
        if (!entry || typeof entry !== 'object') continue;
        const clean: AirWayBillRowOverride = {};
        if (typeof entry.date === 'string' && isCompleteIsoDateInput(entry.date)) {
          clean.date = entry.date;
        }
        if (typeof entry.rmbPerBox === 'number' && Number.isFinite(entry.rmbPerBox)) {
          clean.rmbPerBox = entry.rmbPerBox;
        }
        if (typeof entry.rate === 'number' && Number.isFinite(entry.rate)) {
          clean.rate = entry.rate;
        }
        if (typeof entry.rateSpecified === 'boolean') {
          clean.rateSpecified = entry.rateSpecified;
        }
        if (Object.keys(clean).length > 0) {
          sanitized[id] = clean;
        }
      }
      return sanitized;
    } catch {
      return {};
    }
  });

  const [bulkRmbPerBox, setBulkRmbPerBox] = useState<string>('');
  const [bulkRate, setBulkRate] = useState<string>(() =>
    String(companyProfile.rmbExchangeRate || 16.5)
  );

  const [isExporting, setIsExporting] = useState<'pdf' | 'png' | null>(null);
  const sheetCaptureRef = useRef<HTMLDivElement>(null);
  const awbScrollRef = useRef<HTMLDivElement>(null);

  const serializedAwbDraft = useMemo(
    () => JSON.stringify({ rowOverrides }),
    [rowOverrides]
  );

  useDebouncedStoreSave('Flight Return Bill', serializedAwbDraft, () => {
    localStorage.setItem(AWB_OVERRIDES_STORAGE_KEY, JSON.stringify(rowOverrides));
  });

  // Combine saved Packing List records with any active draft in Packing List Form
  const allManifestRecords = useMemo(
    () => collectPackingManifestRecords(packings, packingDraft, editingPackingId),
    [packings, packingDraft, editingPackingId]
  );

  const originalDateByPackingId = useMemo(() => {
    const map = new Map<string, string>();
    for (const pkg of allManifestRecords) {
      map.set(pkg.id, normalizeAirWayBillDateKey(pkg.packingDate || ''));
    }
    return map;
  }, [allManifestRecords]);

  const filterOptions = useMemo(
    () => extractAirWayBillFilterOptions(allManifestRecords),
    [allManifestRecords]
  );

  const dbRows = useMemo(
    () =>
      buildAirWayBillRows(allManifestRecords, rowOverrides, {
        yearMonth: selectedMonth,
        fromDate,
        toDate,
        shipper: selectedShipper,
        documentsHolder: selectedDocumentsHolder,
        flight: selectedFlight,
      }),
    [
      allManifestRecords,
      rowOverrides,
      selectedMonth,
      fromDate,
      toDate,
      selectedShipper,
      selectedDocumentsHolder,
      selectedFlight,
    ]
  );

  const displayRows = useMemo(
    () =>
      mergeAirWayBillRows(dbRows, DEFAULT_BLANK_AWB_ROWS, {
        yearMonth: selectedMonth,
        fromDate,
        toDate,
        shipper: selectedShipper,
        documentsHolder: selectedDocumentsHolder,
        flight: selectedFlight,
      }),
    [
      dbRows,
      selectedMonth,
      fromDate,
      toDate,
      selectedShipper,
      selectedDocumentsHolder,
      selectedFlight,
    ]
  );

  const hasDateOverrides = useMemo(
    () => Object.values(rowOverrides).some((entry) => Boolean(entry?.date)),
    [rowOverrides]
  );

  const selection = useMemo(
    () => resolveAirWayBillSelection(displayRows, selectedRowIds),
    [displayRows, selectedRowIds]
  );

  const selectedRowIdSet = useMemo(
    () => new Set(selection.selectedRowIds),
    [selection.selectedRowIds]
  );

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = selection.isIndeterminate;
    }
  }, [selection.isIndeterminate]);

  const activeInvoiceRows = selection.invoiceRows;
  const totals = selection.invoiceTotals;
  const fullStatementTotals = useMemo(
    () => calculateAirWayBillTotals(displayRows),
    [displayRows]
  );

  const activePeriodLabel = useMemo(() => {
    if (fromDate && toDate) return `${formatDate(fromDate)} to ${formatDate(toDate)}`;
    if (fromDate) return `From ${formatDate(fromDate)}`;
    if (toDate) return `Up to ${formatDate(toDate)}`;
    return selectedMonth !== 'all' ? formatYearMonthLabel(selectedMonth) : 'All Active Months';
  }, [fromDate, toDate, selectedMonth]);

  const invoiceDocumentBadge = useMemo(() => {
    if (selection.hasSelection) {
      if (selection.selectedRows.length === 1) {
        const onlyRow = selection.selectedRows[0];
        const holder = (onlyRow.documentsHolder || onlyRow.shipper || '').trim();
        const dateText = onlyRow.date ? formatDate(onlyRow.date) : '';
        const detail = [holder.toUpperCase(), dateText].filter(Boolean).join(' · ');
        return detail
          ? `FLIGHT RETURN BILL — BILL INVOICE (${detail})`
          : 'FLIGHT RETURN BILL — INDIVIDUAL BILL INVOICE';
      }
      return `FLIGHT RETURN BILL — SELECTED BILL INVOICE (${selection.selectedRows.length} ROWS)`;
    }
    return `FLIGHT RETURN BILL — MONTHLY STATEMENT (${activePeriodLabel.toUpperCase()})`;
  }, [selection.hasSelection, selection.selectedRows, activePeriodLabel]);

  const exportShipperLabel = useMemo(() => {
    if (selection.hasSelection) {
      const uniqueHolders = Array.from(
        new Set(
          selection.selectedRows
            .map((r) => (r.documentsHolder || r.shipper || '').trim())
            .filter(Boolean)
        )
      );
      if (uniqueHolders.length === 1) {
        return uniqueHolders[0];
      }
      return `SELECTED_${selection.selectedRows.length}_ROWS`;
    }
    return selectedShipper;
  }, [selection.hasSelection, selection.selectedRows, selectedShipper]);

  const handleToggleRowSelect = useCallback((rowId: string) => {
    setSelectedRowIds((prev) => toggleAirWayBillRowSelection(prev, rowId));
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedRowIds((prev) =>
      toggleAllAirWayBillRowsSelection(prev, selection.selectableRowIds)
    );
  }, [selection.selectableRowIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedRowIds([]);
  }, []);

  const { maxHeight: awbScrollMaxHeight, isCapped: isAwbScrollCapped } =
    useRowScrollViewport(awbScrollRef, displayRows.length, {
      maxVisibleRows: MAX_VISIBLE_TABLE_ROWS,
      enabled: isExporting === null,
      includeFooter: true,
      depsKey: `${selectedMonth}|${fromDate}|${toDate}|${selectedShipper}|${selectedDocumentsHolder}|${selectedFlight}`,
    });

  const handleRowEditableChange = useCallback(
    (
      row: AirWayBillRow,
      field: 'date' | 'rmbPerBox' | 'rate',
      rawValue: string
    ) => {
      const targetPackingIds =
        Array.isArray(row.packingIds) && row.packingIds.length > 0
          ? row.packingIds
          : row.packingId
          ? [row.packingId]
          : [];

      // Table is locked strictly to Packing List records; never mutate Packing List data
      if (targetPackingIds.length === 0) return;

      if (field === 'date') {
        if (!isCompleteIsoDateInput(rawValue)) return;
        const nextIsoDate = normalizeAirWayBillDateKey(rawValue);
        setRowOverrides((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const pid of targetPackingIds) {
            const existing = prev[pid] || {};
            const originalDate = originalDateByPackingId.get(pid) || '';
            if (nextIsoDate === originalDate) {
              if (existing.date !== undefined) {
                const rest = { ...existing };
                delete rest.date;
                if (Object.keys(rest).length > 0) {
                  next[pid] = rest;
                } else {
                  delete next[pid];
                }
                changed = true;
              }
            } else if (existing.date !== nextIsoDate) {
              next[pid] = {
                ...existing,
                date: nextIsoDate,
              };
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        return;
      }

      if (field === 'rmbPerBox' || field === 'rate') {
        const numVal = parseSignedNumber(rawValue);
        const isRateSpecified = field === 'rate' ? !isEmptyOrSignOnlyDraft(rawValue) : undefined;
        setRowOverrides((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const pid of targetPackingIds) {
            const existing = prev[pid];
            if (
              !existing ||
              existing[field] !== numVal ||
              (field === 'rate' && existing.rateSpecified !== isRateSpecified)
            ) {
              next[pid] = {
                ...existing,
                [field]: numVal,
                ...(field === 'rate' ? { rateSpecified: isRateSpecified } : {}),
              };
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    },
    [originalDateByPackingId]
  );

  const handleApplyBulkRates = () => {
    const hasBulkRmb = !isEmptyOrSignOnlyDraft(bulkRmbPerBox) && isValidSignedDecimalDraft(bulkRmbPerBox);
    const hasBulkRate = !isEmptyOrSignOnlyDraft(bulkRate) && isValidSignedDecimalDraft(bulkRate);
    if (!hasBulkRmb && !hasBulkRate) {
      showToast('Enter a default RMB/Per Box or Rate to apply to active rows.');
      return;
    }

    const rmbVal = hasBulkRmb ? parseSignedNumber(bulkRmbPerBox) : undefined;
    const rateVal = hasBulkRate ? parseSignedNumber(bulkRate) : undefined;

    const nextOverrides = { ...rowOverrides };
    const targetRows = selection.hasSelection ? selection.selectedRows : dbRows;
    for (const row of targetRows) {
      const targetPackingIds =
        Array.isArray(row.packingIds) && row.packingIds.length > 0
          ? row.packingIds
          : row.packingId
          ? [row.packingId]
          : [];
      for (const pid of targetPackingIds) {
        nextOverrides[pid] = {
          ...nextOverrides[pid],
          rmbPerBox: rmbVal !== undefined ? rmbVal : row.rmbPerBox,
          rate: rateVal !== undefined ? rateVal : row.rate,
          rateSpecified: rateVal !== undefined ? true : row.rateSpecified,
        };
      }
    }
    setRowOverrides(nextOverrides);
    showToast(
      selection.hasSelection
        ? `Applied RMB/Per Box and Rate to ${selection.selectedRows.length} selected row${selection.selectedRows.length === 1 ? '' : 's'}.`
        : 'Applied RMB/Per Box and Rate across active Flight Return Bill rows.'
    );
  };

  const handleRestoreOriginalDates = useCallback(() => {
    setRowOverrides((prev) => {
      let changed = false;
      const next: Record<string, AirWayBillRowOverride> = {};
      for (const [pid, entry] of Object.entries(prev)) {
        if (entry?.date !== undefined) {
          changed = true;
          const rest = { ...entry };
          delete rest.date;
          if (Object.keys(rest).length > 0) {
            next[pid] = rest;
          }
        } else {
          next[pid] = entry;
        }
      }
      return changed ? next : prev;
    });
    showToast('Restored original Packing List dates.');
  }, [showToast]);

  const handleResetFiltersAndOverrides = () => {
    setSelectedMonth('all');
    setFromDate('');
    setToDate('');
    setSelectedShipper('ALL');
    setSelectedDocumentsHolder('ALL');
    setSelectedFlight('ALL');
    setSelectedRowIds([]);
    setRowOverrides((prev) => {
      const next: Record<string, AirWayBillRowOverride> = {};
      for (const [pid, entry] of Object.entries(prev)) {
        const rest = { ...entry };
        delete rest.date;
        if (Object.keys(rest).length > 0) {
          next[pid] = rest;
        }
      }
      return next;
    });
    showToast('Reset Flight Return Bill filters, row selection, and Packing List dates.');
  };

  const handleOpenPrintPreview = () => {
    openPrintModal({
      type: 'air_way_bill',
      title: selection.hasSelection
        ? `FLIGHT RETURN BILL — Bill Invoice (${selection.selectedRows.length} Selected Row${selection.selectedRows.length === 1 ? '' : 's'})`
        : fromDate || toDate || selectedMonth !== 'all'
        ? `FLIGHT RETURN BILL — Monthly Statement (${activePeriodLabel})`
        : 'FLIGHT RETURN BILL — Monthly Statement',
      data: {
        yearMonth: selectedMonth,
        fromDate,
        toDate,
        monthLabel: activePeriodLabel,
        documentBadge: invoiceDocumentBadge,
        selectedRowCount: selection.selectedRows.length,
        shipper: exportShipperLabel,
        documentsHolder: selectedDocumentsHolder,
        flight: selectedFlight,
        rows: activeInvoiceRows,
        totals,
      },
    });
  };

  const handleDirectExport = async (format: 'pdf' | 'png') => {
    if (isExporting) return;
    setIsExporting(format);
    const filename = formatAirWayBillExportFilename(
      selectedMonth,
      exportShipperLabel,
      format,
      undefined,
      fromDate,
      toDate
    );
    try {
      await yieldForDomFrame();
      const targetEl =
        document.getElementById('awb-print-preview-document') || sheetCaptureRef.current;
      if (!targetEl) return;
      if (format === 'pdf') {
        await exportElementToPdf(targetEl, filename);
        showToast(`Saved Flight Return Bill PDF: ${filename}`);
      } else {
        await exportElementToPng(targetEl, filename);
        showToast(`Saved Flight Return Bill PNG: ${filename}`);
      }
    } catch {
      showToast(`Failed to export ${format.toUpperCase()}. Opening print preview...`);
      handleOpenPrintPreview();
    } finally {
      setIsExporting(null);
    }
  };

  const shortcutHandlerRef = useRef<(action: ViewShortcutEventDetail['action']) => void>(() => {});
  shortcutHandlerRef.current = (action) => {
    if (action === 'PRINT_ACTIVE_VIEW') {
      handleOpenPrintPreview();
    } else if (action === 'SAVE_ACTIVE_VIEW') {
      void handleDirectExport('pdf');
    } else if (action === 'RESET_FORM') {
      handleResetFiltersAndOverrides();
    }
  };

  useEffect(() => {
    const onShortcut = (e: Event) => {
      const customEvent = e as CustomEvent<ViewShortcutEventDetail>;
      const action = customEvent.detail?.action;
      if (
        action === 'PRINT_ACTIVE_VIEW' ||
        action === 'SAVE_ACTIVE_VIEW' ||
        action === 'RESET_FORM'
      ) {
        customEvent.detail.handled = true;
        shortcutHandlerRef.current(action);
      }
    };
    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
  }, []);

  useEffect(() => {
    const handleClearDb = () => {
      setRowOverrides({});
      setSelectedMonth('all');
      setFromDate('');
      setToDate('');
      setSelectedShipper('ALL');
      setSelectedDocumentsHolder('ALL');
      setSelectedFlight('ALL');
      setSelectedRowIds([]);
      try {
        localStorage.removeItem(AWB_OVERRIDES_STORAGE_KEY);
      } catch {
        // Ignore quota/access errors
      }
    };
    window.addEventListener('zsb-clear-all-db', handleClearDb);
    window.addEventListener('zsb-records-cleared', handleClearDb);
    return () => {
      window.removeEventListener('zsb-clear-all-db', handleClearDb);
      window.removeEventListener('zsb-records-cleared', handleClearDb);
    };
  }, []);

  return (
    <div
      className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5"
      data-testid="air-way-bill-view"
    >
      {/* Action Controls Bar */}
      <div className="bg-white px-4 py-2.5 rounded-xl shadow-xs border border-slate-200 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            data-testid="awb-save-pdf-btn"
            disabled={isExporting !== null}
            onClick={() => void handleDirectExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#00897b] hover:bg-[#00796b] text-white rounded-lg shadow-xs transition cursor-pointer"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1877d2] hover:bg-[#1465b5] text-white rounded-lg shadow-xs transition cursor-pointer"
          >
            {isExporting === 'png' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>SAVE .PNG</span>
          </button>

          {/* Share via WeChat (微信) Button */}
          <button
            type="button"
            data-testid="awb-share-wechat-btn"
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#07C160] hover:bg-[#06a853] text-white rounded-lg shadow-xs transition cursor-pointer"
            title="Share Flight Return Bill .PNG via WeChat (微信)"
          >
            <WeChatIcon className="w-3.5 h-3.5 text-white" />
            <span>WECHAT (微信)</span>
          </button>

          <button
            type="button"
            data-testid="awb-print-preview-btn"
            onClick={handleOpenPrintPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1c2a33] hover:bg-[#152028] text-white border border-[#334b59] rounded-lg shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#5eead4]" />
            <span>PRINT / PREVIEW</span>
          </button>
      </div>

      {/* Filter & Bulk Rate Toolbar */}
      <div
        data-testid="awb-filter-toolbar"
        className="bg-white rounded-xl shadow border border-slate-200 p-4 space-y-3 text-xs"
      >
        {/* Row 1: Statement Month, From Date, To Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {/* Month Statement Filter */}
          <div>
            <label
              htmlFor="awb-month-select"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1 whitespace-nowrap"
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

          {/* From Date Filter */}
          <div>
            <label
              htmlFor="awb-from-date"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1 whitespace-nowrap"
            >
              From Date
            </label>
            <input
              id="awb-from-date"
              type="date"
              aria-label="From Date"
              data-testid="awb-from-date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
            />
          </div>

          {/* To Date Filter */}
          <div>
            <label
              htmlFor="awb-to-date"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1 whitespace-nowrap"
            >
              To Date
            </label>
            <input
              id="awb-to-date"
              type="date"
              aria-label="To Date"
              data-testid="awb-to-date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
            />
          </div>
        </div>

        {/* Row 2: Shipper, Documents Holder, Flight (all from Packing List) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {/* Shipper Filter */}
          <div>
            <label
              htmlFor="awb-shipper-select"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1 whitespace-nowrap"
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

          {/* Documents Holder Filter */}
          <div>
            <label
              htmlFor="awb-documents-holder-select"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1 whitespace-nowrap"
            >
              Documents Holder (From Packing List)
            </label>
            <select
              id="awb-documents-holder-select"
              aria-label="Filter by Documents Holder"
              data-testid="awb-documents-holder-select"
              value={selectedDocumentsHolder}
              onChange={(e) => setSelectedDocumentsHolder(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900"
            >
              <option value="ALL">ALL DOCUMENTS HOLDERS</option>
              {Array.from(
                new Set([
                  ...filterOptions.documentsHolders,
                  ...(dropdownOptions.documentsHolders || []),
                ])
              ).map((dh) => (
                <option key={dh} value={dh}>
                  {dh}
                </option>
              ))}
            </select>
          </div>

          {/* Flight Filter */}
          <div>
            <label
              htmlFor="awb-flight-select"
              className="font-bold text-slate-700 uppercase text-[11px] block mb-1 whitespace-nowrap"
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

        {/* Row 2: Quick Default RMB/Per Box & Rate Apply + Row Actions */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-3">
          <div className="text-[11px] font-semibold text-slate-600">
            Active Period:{' '}
            <span className="font-mono font-bold text-slate-900" data-testid="awb-active-period">
              {activePeriodLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <label
                htmlFor="awb-bulk-rmb-input"
                className="font-bold text-slate-700 uppercase text-[10px] block mb-1"
              >
                Set RMB/Box
              </label>
              <input
                id="awb-bulk-rmb-input"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 120"
                value={bulkRmbPerBox}
                onChange={(e) => {
                  if (isValidSignedDecimalDraft(e.target.value)) {
                    setBulkRmbPerBox(e.target.value);
                  }
                }}
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
                type="text"
                inputMode="decimal"
                placeholder="16.5"
                value={bulkRate}
                onChange={(e) => {
                  if (isValidSignedDecimalDraft(e.target.value)) {
                    setBulkRate(e.target.value);
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>

            <button
              type="button"
              data-testid="awb-apply-bulk-btn"
              onClick={handleApplyBulkRates}
              className="px-3 py-1.5 bg-[#00897b] hover:bg-[#00796b] text-white font-bold rounded-lg shadow-2xs transition inline-flex items-center gap-1 cursor-pointer"
              title={
                selection.hasSelection
                  ? 'Apply RMB/Per Box and Rate to selected Flight Return Bill rows only'
                  : 'Apply RMB/Per Box and Rate to all active Packing List rows'
              }
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {selection.hasSelection
                  ? `Apply to Selected (${selection.selectedRows.length})`
                  : 'Apply to Rows'}
              </span>
            </button>

            {hasDateOverrides && (
              <button
                type="button"
                data-testid="awb-restore-dates-btn"
                onClick={handleRestoreOriginalDates}
                className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer border border-amber-300"
                title="Restore all rows back to their original Packing List dates"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Dates</span>
              </button>
            )}

            <button
              type="button"
              data-testid="awb-reset-btn"
              onClick={handleResetFiltersAndOverrides}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Printable FLIGHT RETURN BILL Sheet Card (Full Actual Size with Print Compatibility) */}
      <div
        id="awb-printable-sheet"
        ref={sheetCaptureRef}
        data-testid="awb-sheet-card"
        style={{ backgroundColor: '#ffffff', color: '#000000' }}
        className="zsb-print-paper w-full bg-white rounded-lg shadow-lg border border-slate-300 p-4 sm:p-6 space-y-4 overflow-x-auto print:max-w-[760px] print:mx-auto print:border-none print:shadow-none print:p-0"
      >
        {isAwbScrollCapped && (
          <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between px-1">
            <span>
              Viewport: <strong>{MAX_VISIBLE_TABLE_ROWS} Rows</strong> visible ({displayRows.length} total rows — scroll vertically to view more)
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div
              data-testid="awb-packing-lock-banner"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700"
            >
              <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
              <span>
                Locked to Packing List · Only <strong>Date</strong>, <strong>RMB/Box</strong> &amp; <strong>Rate</strong> can be adjusted here
              </span>
            </div>

            {selection.hasSelection && (
              <div
                data-testid="awb-selection-banner"
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-sky-300 bg-sky-50 text-[11px] font-bold text-sky-900"
              >
                <span>
                  {selection.selectedRows.length} row{selection.selectedRows.length === 1 ? '' : 's'} selected for Bill Invoice
                </span>
                <button
                  type="button"
                  data-testid="awb-clear-selection-btn"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white hover:bg-sky-100 border border-sky-300 text-[10px] font-bold text-sky-900 transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>
          <ColumnReorderToolbar
            tableId="air_way_bill"
            isCustomized={awbColOrder.isCustomized}
            onReset={awbColOrder.resetOrder}
            compact
          />
        </div>
        <div
          ref={awbScrollRef}
          data-testid="awb-statement-scroll-box"
          data-row-scroll-managed="true"
          data-visible-row-limit={MAX_VISIBLE_TABLE_ROWS}
          style={awbScrollMaxHeight ? { maxHeight: `${awbScrollMaxHeight}px` } : undefined}
          className="overflow-auto border-2 border-slate-800 rounded-lg bg-white my-1 print:!max-h-none print:!overflow-visible"
        >
        <table
          data-testid="awb-statement-table"
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            tableLayout: 'fixed',
          }}
          className="min-w-[1040px] w-full text-xs sm:text-sm font-sans select-none"
        >
          <colgroup>
            <col className="print:hidden" style={{ width: '7%' }} />
            <col style={{ width: '5%' }} />
            {awbColOrder.columnOrder.map((colId) => (
              <col key={colId} style={{ width: AWB_COLUMN_WIDTHS[colId] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            {/* Row 1: Deep Blue "FLIGHT RETURN BILL" Title Banner */}
            <tr>
              <th
                colSpan={10}
                style={{
                  backgroundColor: '#2f75b5',
                  color: '#ffffff',
                  border: '1.5px solid #000000',
                  letterSpacing: '0.04em',
                }}
                className="py-2 px-4 text-center text-lg sm:text-xl font-extrabold uppercase"
              >
                FLIGHT RETURN BILL
              </th>
            </tr>

            {/* Row 2: Light Blue Column Headers (Draggable & Dynamically Ordered) */}
            <tr
              style={{
                backgroundColor: '#bdd7ee',
                color: '#000000',
              }}
              className="text-xs sm:text-[13px] font-extrabold uppercase text-center leading-tight"
            >
              <th
                data-testid="awb-select-row-header"
                style={{ border: '1.5px solid #000000' }}
                className="py-2 px-1 print:hidden"
              >
                <div className="flex flex-col items-center justify-center gap-1">
                  <span className="text-[10px] sm:text-[11px] font-extrabold leading-none">
                    SELECT ROW
                  </span>
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    data-testid="awb-select-all-checkbox"
                    aria-label="Select all rows for bill invoice"
                    disabled={selection.selectableRowIds.length === 0}
                    checked={selection.allSelected}
                    onChange={handleToggleSelectAll}
                    title={
                      selection.allSelected
                        ? 'Unselect all rows'
                        : 'Select all rows for Bill Invoice'
                    }
                    className="w-3.5 h-3.5 cursor-pointer accent-[#2f75b5] disabled:opacity-40"
                  />
                </div>
              </th>
              <th style={{ border: '1.5px solid #000000' }} className="py-2.5 px-1.5">
                SL #
              </th>
              {awbColOrder.columnOrder.map((colId) => {
                const labelMap: Record<AwbColumnId, string> = {
                  date: 'DATE',
                  documentsHolder: 'DOCUMENTS HOLDER/SHIPPER',
                  flight: 'FLIGHT',
                  totalBox: 'TOTAL BOX',
                  rmbPerBox: 'RMB/PER BOX',
                  totalRmb: 'TOTAL RMB',
                  rate: 'RATE',
                  bdtAmount: 'BDT AMOUNT',
                };
                const label = labelMap[colId];
                return (
                  <th
                    key={colId}
                    {...awbColOrder.getHeaderDragProps(colId, label)}
                    style={{ border: '1.5px solid #000000' }}
                    className={`py-2.5 px-2 ${awbColOrder.getHeaderDragClassName(colId)}`}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <ColumnDragGrip className="w-2.5 h-2.5 opacity-55 shrink-0" />
                      <span>{label}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {displayRows.map((row, idx) => (
              <AirWayBillTableRow
                key={row.id}
                row={row}
                rowIndex={idx}
                columnOrder={awbColOrder.columnOrder}
                isSelected={selectedRowIdSet.has(row.id)}
                onToggleSelect={handleToggleRowSelect}
                onRowEditableChange={handleRowEditableChange}
              />
            ))}
          </tbody>

          {/* Footer: Shows calculated TOTAL BOX directly under TOTAL BOX column and TOTAL AMOUNT (BDT) under BDT AMOUNT */}
          <tfoot className="sticky bottom-0 z-10 bg-white">
            <tr>
              <td
                data-testid="awb-footer-selection-count"
                style={{
                  backgroundColor: '#bdd7ee',
                  color: '#000000',
                  border: '1.5px solid #000000',
                  height: '38px',
                }}
                className="py-1.5 px-1 text-center text-[10px] font-extrabold uppercase print:hidden"
              >
                {selection.hasSelection ? `${selection.selectedRows.length} SEL` : ''}
              </td>
              <td
                style={{
                  backgroundColor: '#bdd7ee',
                  color: '#000000',
                  border: '1.5px solid #000000',
                  height: '38px',
                }}
                className="py-1.5 px-1 text-center text-[11px] font-extrabold uppercase"
              >
                TOTAL
              </td>
              {(() => {
                const totalBoxIdx = awbColOrder.columnOrder.indexOf('totalBox');
                const bdtAmountIdx = awbColOrder.columnOrder.indexOf('bdtAmount');
                const totalBoxLabelIdx =
                  totalBoxIdx > 0 && totalBoxIdx - 1 !== bdtAmountIdx ? totalBoxIdx - 1 : -1;
                const bdtLabelIdx =
                  bdtAmountIdx > 0 && bdtAmountIdx - 1 !== totalBoxIdx ? bdtAmountIdx - 1 : -1;

                return awbColOrder.columnOrder.map((colId, colIdx) => {
                  if (colId === 'totalBox') {
                    return (
                      <td
                        key="totalBox"
                        data-testid="awb-grand-total-box"
                        style={{
                          backgroundColor: '#ffffff',
                          color: totals.totalBoxes < 0 ? '#be123c' : '#000000',
                          border: '1.5px solid #000000',
                          height: '38px',
                        }}
                        className="py-1.5 px-2 text-center font-mono font-black text-xs sm:text-sm tabular-nums"
                      >
                        {totalBoxLabelIdx === -1 && (
                          <span className="text-[10px] font-sans font-extrabold uppercase mr-1">
                            BOX:
                          </span>
                        )}
                        {normalizeSignedZero(totals.totalBoxes).toLocaleString('en-US', {
                          minimumFractionDigits: Number.isInteger(totals.totalBoxes) ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    );
                  }
                  if (colId === 'bdtAmount') {
                    return (
                      <td
                        key="bdtAmount"
                        data-testid="awb-grand-total-bdt"
                        style={{
                          backgroundColor: '#ffffff',
                          color: totals.totalAmountBDT < 0 ? '#be123c' : '#000000',
                          border: '1.5px solid #000000',
                          height: '38px',
                        }}
                        className="py-1.5 px-2.5 text-center font-mono font-black text-xs sm:text-sm tabular-nums"
                      >
                        {bdtLabelIdx === -1 && (
                          <span className="text-[10px] font-sans font-extrabold uppercase mr-1">
                            BDT:
                          </span>
                        )}
                        {normalizeSignedZero(totals.totalAmountBDT).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={colId}
                      style={{
                        backgroundColor: '#bdd7ee',
                        color: '#000000',
                        border: '1.5px solid #000000',
                        height: '38px',
                      }}
                      className="py-1.5 px-2 text-center text-[11px] font-extrabold uppercase tracking-wide"
                    >
                      {colIdx === totalBoxLabelIdx
                        ? 'TOTAL BOX'
                        : colIdx === bdtLabelIdx
                        ? 'TOTAL BDT'
                        : ''}
                    </td>
                  );
                });
              })()}
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* Bottom Summary Strip & Quick Link to Packing List Form */}
      <div className="bg-white rounded-xl shadow border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-6 font-mono">
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-sans font-bold block">
              {selection.hasSelection ? 'Selected For Invoice' : 'Synced Packing Manifests'}
            </span>
            <span className="text-sm font-black text-slate-900">
              {selection.hasSelection
                ? `${selection.selectedRows.length} of ${dbRows.length} Row${dbRows.length === 1 ? '' : 's'}`
                : `${dbRows.length} Summary Row${dbRows.length === 1 ? '' : 's'}${
                    dbRows.reduce((sum, r) => sum + (r.mergedCount || 1), 0) > dbRows.length
                      ? ` (${dbRows.reduce((sum, r) => sum + (r.mergedCount || 1), 0)} Manifests)`
                      : ''
                  }`}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-sans font-bold block">
              {selection.hasSelection ? 'Selected Total Box' : 'Cumulative Total Box'}
            </span>
            <span className="text-sm font-black text-blue-800">
              {totals.totalBoxes} Boxes
              {selection.hasSelection && fullStatementTotals.totalBoxes !== totals.totalBoxes
                ? ` / ${fullStatementTotals.totalBoxes}`
                : ''}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-sans font-bold block">
              {selection.hasSelection ? 'Selected Total RMB' : 'Cumulative Total RMB'}
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
              {selection.hasSelection ? 'Selected Amount (BDT)' : 'Total Amount (BDT)'}
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

      {/* Offscreen Print-Preview-Identical A4 Document for One-Click PDF/PNG Export */}
      {(isExporting !== null || isShareModalOpen) && (
        <div
          id="awb-print-preview-host"
          aria-hidden="true"
          className="fixed -left-[10000px] top-0 pointer-events-none print:hidden"
          style={{ width: '760px', zIndex: -1 }}
        >
          <div
            id="awb-print-preview-document"
            className="zsb-print-paper relative w-[760px] max-w-[760px] bg-white rounded-sm border border-slate-300 p-7 space-y-5 text-slate-900 overflow-hidden"
            style={{
              width: '760px',
              backgroundColor: '#ffffff',
              color: '#000000',
              position: 'relative',
            }}
          >
            {/* Centered Watermark Logo */}
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
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
                userSelect: 'none',
                zIndex: 0,
                opacity: 0.07,
              }}
            >
              <img
                src={resolveCompanyLogoSrc(companyProfile.logoUrl)}
                alt=""
                style={{
                  width: '340px',
                  height: '340px',
                  objectFit: 'contain',
                  borderRadius: '9999px',
                }}
              />
            </div>

            {/* Official Document Header (Identical to PrintPreviewModal) */}
            <div
              style={{ borderBottom: '2px solid #0f172a', position: 'relative', zIndex: 10 }}
              className="pb-3.5 text-center space-y-1 relative z-10"
            >
              <div className="flex items-center justify-center gap-3.5 mb-1">
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    border: '2px solid #fbbf24',
                    backgroundColor: '#ffffff',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={resolveCompanyLogoSrc(companyProfile.logoUrl)}
                    alt={companyProfile.companyName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '9999px',
                      display: 'block',
                    }}
                  />
                </div>
                <div
                  className="zsb-3d-text-print text-3xl sm:text-4xl font-black tracking-widest uppercase"
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
              </div>

              <div style={{ color: '#000000' }} className="text-xs sm:text-sm font-bold tracking-wide">
                Address: {companyProfile.address}
              </div>

              <div style={{ color: '#000000' }} className="text-xs sm:text-sm font-bold font-mono">
                Mobile: {companyProfile.mobiles.join(' , ')} | EMAIL:{' '}
                {companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com'
                  ? companyProfile.email
                  : 'zsbaquatics@gmail.com'}
                , Website : {companyProfile.website || 'www.zsbaquatics.com'}
              </div>

              <div
                style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                className="inline-block mt-2 px-5 py-1.5 rounded text-xs font-bold tracking-widest uppercase shadow-sm"
              >
                {invoiceDocumentBadge}
              </div>
            </div>

            {/* A4 Portrait Optimized Table (Identical to PrintPreviewModal type === 'air_way_bill') */}
            <div className="space-y-3 relative z-10">
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  tableLayout: 'fixed',
                }}
                className="text-[11px] font-sans"
              >
                <colgroup>
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      colSpan={8}
                      style={{
                        backgroundColor: '#2f75b5',
                        color: '#ffffff',
                        border: '1.5px solid #000000',
                        letterSpacing: '0.04em',
                      }}
                      className="py-1.5 px-3 text-center text-base font-extrabold uppercase"
                    >
                      FLIGHT RETURN BILL
                    </th>
                  </tr>
                  <tr
                    style={{
                      backgroundColor: '#bdd7ee',
                      color: '#000000',
                    }}
                    className="text-[10px] font-extrabold uppercase text-center leading-tight"
                  >
                    <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                      DATE
                    </th>
                    <th style={{ border: '1.5px solid #000000' }} className="py-1.5 px-1">
                      DOCUMENTS HOLDER/SHIPPER
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
                  {activeInvoiceRows.map((row, idx) => (
                    <tr key={row.id || idx} style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-0.5 text-center font-mono font-semibold text-[10px] whitespace-nowrap"
                      >
                        {row.date ? formatDate(row.date) : ''}
                      </td>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-1 text-center font-bold text-[10.5px] truncate"
                      >
                        {row.documentsHolder || row.shipper || ''}
                      </td>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-1 text-center font-mono font-bold text-[10.5px] truncate"
                      >
                        {row.flight || ''}
                      </td>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-1 text-center font-mono font-bold text-[10.5px] tabular-nums"
                      >
                        {row.totalBox !== 0 ? row.totalBox : ''}
                      </td>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-1 text-center font-mono font-bold text-[10.5px] tabular-nums"
                      >
                        {row.rmbPerBox !== 0 ? row.rmbPerBox : ''}
                      </td>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-1 text-center font-mono font-bold text-[10.5px] tabular-nums"
                      >
                        {formatAwbCellNumber(row.totalRmb)}
                      </td>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-1 text-center font-mono font-bold text-[10.5px] tabular-nums"
                      >
                        {row.rate !== 0 || row.rateSpecified ? row.rate : ''}
                      </td>
                      <td
                        style={{ border: '1.5px solid #000000', height: '27px' }}
                        className="py-1 px-1 text-center font-mono font-extrabold text-[10.5px] tabular-nums"
                      >
                        {formatAwbCellNumber(row.bdtAmount, row.totalRmb !== 0 && Boolean(row.rateSpecified))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        backgroundColor: '#bdd7ee',
                        color: '#000000',
                        border: '1.5px solid #000000',
                        height: '29px',
                      }}
                      className="py-1 px-2 text-center text-[10.5px] font-extrabold uppercase"
                    >
                      TOTAL BOX
                    </td>
                    <td
                      style={{
                        backgroundColor: '#ffffff',
                        color: totals.totalBoxes < 0 ? '#be123c' : '#000000',
                        border: '1.5px solid #000000',
                        height: '29px',
                      }}
                      className="py-1 px-1.5 text-center font-mono font-black text-[11px] tabular-nums"
                    >
                      {normalizeSignedZero(totals.totalBoxes || 0).toLocaleString('en-US', {
                        minimumFractionDigits: Number.isInteger(totals.totalBoxes || 0) ? 0 : 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      colSpan={3}
                      style={{
                        backgroundColor: '#bdd7ee',
                        color: '#000000',
                        border: '1.5px solid #000000',
                        height: '29px',
                      }}
                      className="py-1 px-2 text-center text-[10.5px] font-extrabold uppercase"
                    >
                      TOTAL AMOUNT (BDT)
                    </td>
                    <td
                      style={{
                        backgroundColor: '#ffffff',
                        color: totals.totalAmountBDT < 0 ? '#be123c' : '#000000',
                        border: '1.5px solid #000000',
                        height: '29px',
                      }}
                      className="py-1 px-1.5 text-center font-mono font-black text-[11px] tabular-nums"
                    >
                      {normalizeSignedZero(totals.totalAmountBDT || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Dual Official Signatures (Identical to PrintPreviewModal) */}
            <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs relative z-10">
              <div className="flex flex-col items-center">
                <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
                  <div
                    style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#0f172a' }}
                    className="text-base font-bold tracking-wider"
                  >
                    {companyProfile.managingPartner}
                  </div>
                </div>
                <div
                  style={{ color: '#0f172a' }}
                  className="mt-1.5 font-bold uppercase tracking-wider text-xs"
                >
                  Managing Partner
                </div>
                <div
                  style={{ color: '#d97706', fontWeight: 800 }}
                  className="text-[10px] uppercase font-extrabold text-amber-500 zsb-golden-brand-light"
                >
                  {companyProfile.companyName}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
                  <div
                    style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#0f172a' }}
                    className="text-base font-bold tracking-wider"
                  >
                    {companyProfile.partner}
                  </div>
                </div>
                <div
                  style={{ color: '#0f172a' }}
                  className="mt-1.5 font-bold uppercase tracking-wider text-xs"
                >
                  Partner
                </div>
                <div
                  style={{ color: '#d97706', fontWeight: 800 }}
                  className="text-[10px] uppercase font-extrabold text-amber-500 zsb-golden-brand-light"
                >
                  {companyProfile.companyName}
                </div>
              </div>
            </div>

            {/* Footer certification & dynamic A4 page counter */}
            <div
              style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
              className="flex justify-between items-center text-[10px] pt-4 mt-6 relative z-10"
            >
              <span>
                This is an official computer-generated document from{' '}
                <strong
                  style={{ color: '#d97706', fontWeight: 800 }}
                  className="font-extrabold text-amber-500 zsb-golden-brand-light"
                >
                  {companyProfile.companyName}
                </strong>{' '}
                System • Validated and archived.
              </span>
              <span className="print-page-number-counter font-mono font-bold text-slate-600">
                <span className="print:hidden">Page 1 of 1</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive PNG WeChat Share Modal */}
      {isShareModalOpen && (
        <PngShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title={
            selection.hasSelection
              ? `Flight Return Bill Invoice — ${selection.selectedRows.length} Selected Row${selection.selectedRows.length === 1 ? '' : 's'} (${exportShipperLabel})`
              : `Flight Return Bill Monthly Statement — ${activePeriodLabel} (${selectedShipper})`
          }
          documentType="air_way_bill"
          documentData={{
            yearMonth: selectedMonth,
            fromDate,
            toDate,
            monthLabel: activePeriodLabel,
            shipper: exportShipperLabel,
            documentsHolder: selectedDocumentsHolder,
            flight: selectedFlight,
            totals,
          }}
          targetElementId="awb-print-preview-document"
          defaultFilename={formatAirWayBillExportFilename(
            selectedMonth,
            exportShipperLabel,
            'png',
            undefined,
            fromDate,
            toDate
          )}
        />
      )}
    </div>
  );
};
