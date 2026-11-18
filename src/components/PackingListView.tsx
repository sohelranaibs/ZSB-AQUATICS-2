import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
import {
  isPackingRowDataEqual,
  updatePackingRowById,
} from '../utils/tableRowOptimization.ts';
import { validatePackingForm } from '../utils/validation.ts';
import { generateRecordId } from '../utils/idGenerator.ts';
import {
  REPORT_WEIGHT_DEBOUNCE_MS,
  parseReportWeightInput,
  formatReportWeightDraft,
  applyReportWeightToRow,
  reconcilePackingRowsWithReportDrafts,
} from '../utils/packingReportWeight.ts';
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
  UploadCloud,
  HelpCircle,
} from 'lucide-react';
import {
  PngShareModal,
  WeChatIcon,
} from './PngShareModal.tsx';

interface ReportWeightCellInputProps {
  rowId: string;
  rowIndex: number;
  committedValue: number;
  hasError: boolean;
  resetToken: number;
  onScheduleDraft: (rowId: string, rawValue: string) => void;
  onCommitImmediate: (rowId: string, rawValue: string) => void;
}

const areReportWeightCellPropsEqual = (
  prev: ReportWeightCellInputProps,
  next: ReportWeightCellInputProps
): boolean =>
  prev.rowId === next.rowId &&
  prev.rowIndex === next.rowIndex &&
  prev.committedValue === next.committedValue &&
  prev.hasError === next.hasError &&
  prev.resetToken === next.resetToken &&
  prev.onScheduleDraft === next.onScheduleDraft &&
  prev.onCommitImmediate === next.onCommitImmediate;

const ReportWeightCellInput: React.FC<ReportWeightCellInputProps> = memo(
  ({
    rowId,
    rowIndex,
    committedValue,
    hasError,
    resetToken,
    onScheduleDraft,
    onCommitImmediate,
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const prevResetTokenRef = useRef<number>(resetToken);
    const [localDraft, setLocalDraft] = useState<string>(() =>
      formatReportWeightDraft(committedValue)
    );

    useEffect(() => {
      const resetChanged = prevResetTokenRef.current !== resetToken;
      prevResetTokenRef.current = resetToken;
      const isFocused =
        typeof document !== 'undefined' && document.activeElement === inputRef.current;
      if (resetChanged || !isFocused) {
        setLocalDraft(formatReportWeightDraft(committedValue));
      }
    }, [committedValue, resetToken]);

    const handleDraftChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalDraft(raw);
        onScheduleDraft(rowId, raw);
      },
      [onScheduleDraft, rowId]
    );

    const handleDraftBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        onCommitImmediate(rowId, raw);
        setLocalDraft(formatReportWeightDraft(parseReportWeightInput(raw)));
      },
      [onCommitImmediate, rowId]
    );

    const isDraftActive = parseReportWeightInput(localDraft) > 0;

    return (
      <>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          aria-label={`Row ${rowIndex + 1} Report Weight (KG)`}
          data-testid={`packing-row-${rowIndex + 1}-report-weight`}
          aria-invalid={hasError}
          value={localDraft}
          onChange={handleDraftChange}
          onBlur={handleDraftBlur}
          placeholder="0.00"
          title={
            isDraftActive
              ? 'Active: Calculation uses Report Weight (KG)'
              : 'Enter Report Weight (KG) to override Weight (KG)'
          }
          className={`w-full border rounded-md px-2 py-1.5 text-right font-mono tabular-nums focus:outline-none focus:ring-2 transition ${
            isDraftActive
              ? 'bg-white border-emerald-500 ring-1 ring-emerald-300 text-emerald-950 font-black focus:ring-emerald-600'
              : hasError
              ? 'bg-white border-rose-400 text-slate-800 focus:ring-rose-500'
              : 'bg-white border-slate-200 text-slate-700 font-semibold focus:ring-amber-500'
          }`}
        />
        {isDraftActive && (
          <div className="text-[9px] font-extrabold text-emerald-700 text-center uppercase mt-0.5 tracking-tight">
            Active
          </div>
        )}
      </>
    );
  },
  areReportWeightCellPropsEqual
);

const createEmptyPackingRow = (id: string): PackingItemRow => ({
  id,
  item: '',
  box: 0,
  weight: 0,
  reportWeight: 0,
  totalWeight: 0,
  unit: 'KG',
  rate: 0,
  amount: 0,
});

interface PackingItemTableRowProps {
  row: PackingItemRow;
  rowIndex: number;
  exportItemOptions: React.ReactNode;
  boxPresets: string[];
  boxOptions: React.ReactNode;
  weightPresets: string[];
  weightOptions: React.ReactNode;
  unitOptions: React.ReactNode;
  paymentStatus: 'PAID' | 'UNPAID';
  hasItemError: boolean;
  hasBoxError: boolean;
  hasWeightError: boolean;
  hasRateError: boolean;
  hasAnyRowError: boolean;
  reportWeightResetToken: number;
  onRowChange: (
    id: string,
    field: keyof PackingItemRow,
    value: string | number
  ) => void;
  onClearRow: (id: string) => void;
  onScheduleReportWeightDraft: (rowId: string, rawValue: string) => void;
  onCommitReportWeightImmediate: (rowId: string, rawValue: string) => void;
}

const arePackingItemTableRowPropsEqual = (
  prev: PackingItemTableRowProps,
  next: PackingItemTableRowProps
): boolean =>
  prev.rowIndex === next.rowIndex &&
  prev.exportItemOptions === next.exportItemOptions &&
  prev.boxPresets === next.boxPresets &&
  prev.boxOptions === next.boxOptions &&
  prev.weightPresets === next.weightPresets &&
  prev.weightOptions === next.weightOptions &&
  prev.unitOptions === next.unitOptions &&
  prev.paymentStatus === next.paymentStatus &&
  prev.hasItemError === next.hasItemError &&
  prev.hasBoxError === next.hasBoxError &&
  prev.hasWeightError === next.hasWeightError &&
  prev.hasRateError === next.hasRateError &&
  prev.hasAnyRowError === next.hasAnyRowError &&
  prev.reportWeightResetToken === next.reportWeightResetToken &&
  prev.onRowChange === next.onRowChange &&
  prev.onClearRow === next.onClearRow &&
  prev.onScheduleReportWeightDraft === next.onScheduleReportWeightDraft &&
  prev.onCommitReportWeightImmediate === next.onCommitReportWeightImmediate &&
  isPackingRowDataEqual(prev.row, next.row);

const PackingItemTableRow: React.FC<PackingItemTableRowProps> = memo(
  ({
    row,
    rowIndex,
    exportItemOptions,
    boxPresets,
    boxOptions,
    weightPresets,
    weightOptions,
    unitOptions,
    paymentStatus,
    hasItemError,
    hasBoxError,
    hasWeightError,
    hasRateError,
    hasAnyRowError,
    reportWeightResetToken,
    onRowChange,
    onClearRow,
    onScheduleReportWeightDraft,
    onCommitReportWeightImmediate,
  }) => {
    const reportWeightVal = Number(row.reportWeight) || 0;
    const isReportWeightActive = reportWeightVal > 0;
    const isFilled =
      row.item.trim() !== '' ||
      row.box !== 0 ||
      row.weight !== 0 ||
      isReportWeightActive ||
      row.rate !== 0;

    const handleItemChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onRowChange(row.id, 'item', e.target.value);
      },
      [onRowChange, row.id]
    );

    const handleBoxChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onRowChange(row.id, 'box', parseFloat(e.target.value) || 0);
      },
      [onRowChange, row.id]
    );

    const handleWeightChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onRowChange(row.id, 'weight', parseFloat(e.target.value) || 0);
      },
      [onRowChange, row.id]
    );

    const handleUnitChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onRowChange(row.id, 'unit', e.target.value);
      },
      [onRowChange, row.id]
    );

    const handleRateChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onRowChange(row.id, 'rate', parseFloat(e.target.value) || 0);
      },
      [onRowChange, row.id]
    );

    const handleClearClick = useCallback(() => {
      onClearRow(row.id);
    }, [onClearRow, row.id]);

    return (
      <tr
        className={`transition-colors ${
          hasAnyRowError
            ? 'bg-rose-50/60 hover:bg-rose-50'
            : isFilled
            ? 'bg-amber-50/25 hover:bg-amber-50/60'
            : rowIndex % 2 === 0
            ? 'bg-white hover:bg-slate-50'
            : 'bg-slate-50/50 hover:bg-slate-100/60'
        }`}
      >
        {/* Row Number */}
        <td className="px-2 py-1.5 border-r border-slate-200 text-center">
          <span className="zsb-sl-badge">
            {String(rowIndex + 1).padStart(2, '0')}
          </span>
        </td>

        {/* Item Dropdown */}
        <td className="p-1.5 border-r border-slate-200">
          <select
            aria-label={`Row ${rowIndex + 1} Export Item`}
            aria-invalid={hasItemError}
            value={row.item}
            onChange={handleItemChange}
            className={`w-full border rounded-md px-2 py-1.5 font-semibold focus:bg-white focus:outline-none focus:ring-2 ${
              hasItemError
                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                : row.item
                ? 'bg-white border-slate-300 text-slate-900 focus:ring-amber-500'
                : 'bg-slate-50 border-slate-200 text-slate-500 focus:ring-amber-500'
            }`}
          >
            <option value="">-- Select Grade / Size --</option>
            {exportItemOptions}
          </select>
        </td>

        {/* Box Dropdown */}
        <td className="p-1.5 border-r border-slate-200">
          <select
            aria-label={`Row ${rowIndex + 1} Box`}
            aria-invalid={hasBoxError}
            value={row.box || ''}
            onChange={handleBoxChange}
            className={`w-full bg-white border rounded-md px-2 py-1.5 text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 ${
              hasBoxError
                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                : 'border-slate-200 focus:ring-amber-500'
            }`}
          >
            <option value="0">-</option>
            {row.box > 0 && !boxPresets.includes(String(row.box)) && (
              <option value={row.box}>{row.box}</option>
            )}
            {boxOptions}
          </select>
        </td>

        {/* Weight Dropdown (Inactive when Report Weight (KG) is active) */}
        <td
          className={`p-1.5 border-r border-slate-200 transition-colors ${
            isReportWeightActive ? 'bg-slate-100/80' : ''
          }`}
        >
          <select
            aria-label={`Row ${rowIndex + 1} Weight`}
            data-testid={`packing-row-${rowIndex + 1}-weight-select`}
            aria-invalid={hasWeightError}
            disabled={isReportWeightActive}
            title={
              isReportWeightActive
                ? 'Inactive: Report Weight (KG) is active for calculation'
                : 'Active Weight (KG) per box'
            }
            value={row.weight || ''}
            onChange={handleWeightChange}
            className={`w-full border rounded-md px-2 py-1.5 text-center font-mono font-bold focus:outline-none focus:ring-2 transition ${
              isReportWeightActive
                ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed line-through'
                : hasWeightError
                ? 'bg-rose-50/40 border-rose-500 ring-1 ring-rose-300 text-slate-800 focus:ring-rose-500'
                : 'bg-white border-slate-200 text-slate-800 focus:ring-amber-500'
            }`}
          >
            <option value="0">-</option>
            {row.weight > 0 && !weightPresets.includes(String(row.weight)) && (
              <option value={row.weight}>{row.weight} KG</option>
            )}
            {weightOptions}
          </select>
          {isReportWeightActive && (
            <div className="text-[9px] font-bold text-slate-400 text-center uppercase mt-0.5 tracking-tight">
              Inactive
            </div>
          )}
        </td>

        {/* Editable Report Weight (KG) Input (Debounced onChange + active override over Weight (KG)) */}
        <td
          className={`p-1.5 border-r border-slate-200 transition-colors ${
            isReportWeightActive ? 'bg-emerald-50/60' : 'bg-slate-50/30'
          }`}
        >
          <ReportWeightCellInput
            rowId={row.id}
            rowIndex={rowIndex}
            committedValue={reportWeightVal}
            hasError={hasWeightError}
            resetToken={reportWeightResetToken}
            onScheduleDraft={onScheduleReportWeightDraft}
            onCommitImmediate={onCommitReportWeightImmediate}
          />
        </td>

        {/* Total Weight (Box * Active Weight) */}
        <td
          data-testid={`packing-row-${rowIndex + 1}-weight`}
          className="p-1.5 border-r border-slate-200 bg-amber-50/40 text-right font-mono font-bold tabular-nums text-teal-800 pr-2.5"
        >
          {row.totalWeight > 0 ? `${row.totalWeight} KG` : '0'}
        </td>

        {/* Unit Dropdown */}
        <td className="p-1.5 border-r border-slate-200">
          <select
            aria-label={`Row ${rowIndex + 1} Unit`}
            value={row.unit}
            onChange={handleUnitChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-1 py-1.5 text-center text-[11px] font-bold text-slate-700"
          >
            {unitOptions}
          </select>
        </td>

        {/* Rate Input */}
        <td className="p-1.5 border-r border-slate-200">
          <input
            aria-label={`Row ${rowIndex + 1} Rate`}
            aria-invalid={hasRateError}
            type="number"
            min="0"
            step="0.01"
            value={row.rate || ''}
            onChange={handleRateChange}
            className={`w-full bg-white border rounded-md px-2 py-1.5 text-right font-mono tabular-nums text-slate-800 focus:outline-none focus:ring-2 ${
              hasRateError
                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40 focus:ring-rose-500'
                : 'border-slate-200 focus:ring-amber-500'
            }`}
            placeholder={paymentStatus === 'UNPAID' ? '0.00' : 'Rate > 0'}
          />
        </td>

        {/* Amount (Total Weight * Rate) */}
        <td
          data-testid={`packing-row-${rowIndex + 1}-total`}
          className="p-1.5 border-r border-slate-200 text-right font-mono font-bold tabular-nums text-slate-900 pr-2.5 bg-slate-50/40"
        >
          {row.amount > 0 ? formatCurrency(row.amount, '') : '0.00'}
        </td>

        {/* Single Row Clear Button */}
        <td className="p-1 text-center">
          <button
            type="button"
            onClick={handleClearClick}
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
  },
  arePackingItemTableRowPropsEqual
);

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
    openDataCenterModal,
    setActiveTab,
    showToast,
    requestSuperAdminSingleDelete,
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
  const [showReportWeightHelp, setShowReportWeightHelp] = useState<boolean>(false);

  const [rows, setRows] = useState<PackingItemRow[]>(() => [
    createEmptyPackingRow('1'),
    createEmptyPackingRow('2'),
    createEmptyPackingRow('3'),
    createEmptyPackingRow('4'),
    createEmptyPackingRow('5'),
  ]);
  const rowsRef = useRef<PackingItemRow[]>(rows);
  rowsRef.current = rows;

  // Search by dropdowns
  const [searchShippingMark, setSearchShippingMark] = useState<string>('ALL');
  const [searchDestination, setSearchDestination] = useState<string>('ALL');

  // Quick Inline Add Modal States
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState<string>('');
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);
  const [reportWeightResetToken, setReportWeightResetToken] = useState<number>(0);

  // Per-row debounce timers and pending drafts for (REPORT WEIGHT (KG))
  const reportWeightTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingReportWeightDraftsRef = useRef<Record<string, string>>({});

  const clearPendingReportWeights = useCallback((targetRowId?: string) => {
    if (targetRowId) {
      const existingTimer = reportWeightTimersRef.current[targetRowId];
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        delete reportWeightTimersRef.current[targetRowId];
      }
      delete pendingReportWeightDraftsRef.current[targetRowId];
      return;
    }
    Object.values(reportWeightTimersRef.current).forEach((timerId) => {
      clearTimeout(timerId);
    });
    reportWeightTimersRef.current = {};
    pendingReportWeightDraftsRef.current = {};
  }, []);

  useEffect(() => {
    return () => {
      clearPendingReportWeights();
    };
  }, [clearPendingReportWeights]);

  const commitReportWeightForRow = useCallback(
    (id: string, rawValue: string) => {
      clearPendingReportWeights(id);
      const numericWeight = parseReportWeightInput(rawValue);
      setRows((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.id !== id) return row;
          const updated = applyReportWeightToRow(row, numericWeight);
          if (updated !== row) changed = true;
          return updated;
        });
        return changed ? next : prev;
      });
    },
    [clearPendingReportWeights]
  );

  const scheduleReportWeightCommit = useCallback(
    (id: string, rawValue: string) => {
      pendingReportWeightDraftsRef.current[id] = rawValue;
      const existingTimer = reportWeightTimersRef.current[id];
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
      }
      reportWeightTimersRef.current[id] = setTimeout(() => {
        commitReportWeightForRow(id, pendingReportWeightDraftsRef.current[id] ?? rawValue);
      }, REPORT_WEIGHT_DEBOUNCE_MS);
    },
    [commitReportWeightForRow]
  );

  const flushPendingReportWeights = useCallback((): PackingItemRow[] => {
    const draftsSnapshot = { ...pendingReportWeightDraftsRef.current };
    clearPendingReportWeights();
    const reconciled = reconcilePackingRowsWithReportDrafts(rows, draftsSnapshot);
    if (reconciled !== rows) {
      setRows(reconciled);
    }
    return reconciled;
  }, [clearPendingReportWeights, rows]);

  const validation = useMemo(
    () =>
      validatePackingForm({
        invoiceNumber,
        packingDate,
        shippingMark,
        flight,
        destination,
        shipper,
        paymentStatus,
        rows,
      }),
    [
      invoiceNumber,
      packingDate,
      shippingMark,
      flight,
      destination,
      shipper,
      paymentStatus,
      rows,
    ]
  );

  const exportItemOptionElements = useMemo(
    () =>
      dropdownOptions.exportItems.map((it) => (
        <option key={it} value={it}>
          {it}
        </option>
      )),
    [dropdownOptions.exportItems]
  );

  const boxOptionElements = useMemo(
    () =>
      dropdownOptions.boxes.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      )),
    [dropdownOptions.boxes]
  );

  const weightOptionElements = useMemo(
    () =>
      dropdownOptions.weights.map((w) => (
        <option key={w} value={w}>
          {w} KG
        </option>
      )),
    [dropdownOptions.weights]
  );

  const unitOptionElements = useMemo(
    () =>
      dropdownOptions.units.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      )),
    [dropdownOptions.units]
  );

  const shippingMarkOptionElements = useMemo(
    () =>
      dropdownOptions.shippingMarks.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      )),
    [dropdownOptions.shippingMarks]
  );

  const flightOptionElements = useMemo(
    () =>
      dropdownOptions.flights.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      )),
    [dropdownOptions.flights]
  );

  const destinationOptionElements = useMemo(
    () =>
      dropdownOptions.destinations.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      )),
    [dropdownOptions.destinations]
  );

  const shipperOptionElements = useMemo(
    () =>
      dropdownOptions.shippers.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      )),
    [dropdownOptions.shippers]
  );

  const savedManifestOptionElements = useMemo(
    () =>
      packings.map((p) => (
        <option key={p.id} value={p.id}>
          {p.invoiceNumber} — {p.shippingMark} (
          {p.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'})
        </option>
      )),
    [packings]
  );

  // Load a previously saved manifest into form for editing
  const handleLoadForEdit = (idToEdit: string) => {
    const found = packings.find((p) => p.id === idToEdit);
    if (!found) return;
    clearPendingReportWeights();
    setReportWeightResetToken((t) => t + 1);
    setEditingPackingId(found.id);
    setInvoiceNumber(found.invoiceNumber);
    setPackingDate(found.packingDate);
    setShippingMark(found.shippingMark);
    setFlight(found.flight);
    setDestination(found.destination);
    setShipper(found.shipper);
    setPaymentStatus(found.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID');
    setRemarks(found.remarks || '');

    const loadedRows: PackingItemRow[] = found.items.map((it) => {
      const reportWeightVal = Number(it.reportWeight) || 0;
      const calcs = calculatePackingRow(it.box, it.weight, it.rate, reportWeightVal);
      return {
        ...it,
        reportWeight: reportWeightVal,
        totalWeight: calcs.totalWeight,
        amount: calcs.amount,
      };
    });
    while (loadedRows.length < 5) {
      loadedRows.push(createEmptyPackingRow(generateRecordId('pkgrow')));
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
  const lastLoadedEditingPackingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editingPackingId) {
      lastLoadedEditingPackingIdRef.current = null;
      return;
    }
    if (lastLoadedEditingPackingIdRef.current !== editingPackingId) {
      lastLoadedEditingPackingIdRef.current = editingPackingId;
      handleLoadForEdit(editingPackingId);
    }
  }, [editingPackingId]);

  // Row update logic (Box, Weight, Report Weight, Rate)
  const handleRowChange = useCallback(
    (
      id: string,
      field: keyof PackingItemRow,
      value: string | number
    ) => {
      setRows((prev) => updatePackingRowById(prev, id, field, value));
    },
    []
  );

  // Clear single row (Requires Super Admin Permission)
  const handleClearRow = useCallback(
    (id: string) => {
      const targetRow = rowsRef.current.find((r) => r.id === id);
      requestSuperAdminSingleDelete(
        {
          recordType: 'custom_row',
          recordId: id,
          recordTitle: targetRow?.item
            ? `Packing Item Row — ${targetRow.item}`
            : `Packing Line Item Row`,
          recordSubtitle: targetRow
            ? `Box: ${targetRow.box} · Weight: ${targetRow.totalWeight} KG · Amount: RMB ${targetRow.amount}`
            : undefined,
        },
        () => {
          clearPendingReportWeights(id);
          setReportWeightResetToken((t) => t + 1);
          setRows((prev) =>
            prev.map((row) =>
              row.id === id ? createEmptyPackingRow(row.id) : row
            )
          );
          showToast('Super Admin verified: Packing line item row deleted.');
        }
      );
    },
    [clearPendingReportWeights, requestSuperAdminSingleDelete, showToast]
  );

  // Add a new blank row at the bottom
  const handleAddRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      createEmptyPackingRow(generateRecordId('pkgrow')),
    ]);
  }, []);

  const resetFormFields = () => {
    clearPendingReportWeights();
    setReportWeightResetToken((t) => t + 1);
    setShippingMark('');
    setFlight('');
    setDestination('');
    setShipper('');
    setRemarks('');
    setPaymentStatus('UNPAID');
    setPackingDate(new Date().toISOString().slice(0, 10));
    setRows([
      createEmptyPackingRow('1'),
      createEmptyPackingRow('2'),
      createEmptyPackingRow('3'),
      createEmptyPackingRow('4'),
      createEmptyPackingRow('5'),
    ]);
    setValidationAttempted(false);
  };

  const handleClear = () => {
    setEditingPackingId(null);
    resetFormFields();
    setInvoiceNumber(generateInvoiceNumber('PKG', packings.length + 1));
    showToast('Packing list form cleared and all cells reset.');
  };

  const { totalBox, totalWeight, totalAmount, populatedRowCount, avgRatePerKg } =
    useMemo(() => {
      const totals = calculatePackingTotals(rows);
      const populatedCount = rows.filter(
        (r) =>
          r.item.trim() !== '' ||
          r.box !== 0 ||
          r.weight !== 0 ||
          (Number(r.reportWeight) || 0) !== 0 ||
          r.rate !== 0
      ).length;
      const avgRate =
        totals.totalWeight > 0
          ? Math.round((totals.totalAmount / totals.totalWeight) * 100) / 100
          : 0;
      return {
        ...totals,
        populatedRowCount: populatedCount,
        avgRatePerKg: avgRate,
      };
    }, [rows]);

  // Historical stats for the currently selected Shipping Mark
  const { markShipments, markTotalBoxes, markTotalWeight } = useMemo(() => {
    const normalizedMark = shippingMark.toUpperCase();
    const matched = packings.filter(
      (p) => p.shippingMark.toUpperCase() === normalizedMark
    );
    return {
      markShipments: matched,
      markTotalBoxes: matched.reduce((acc, p) => acc + p.totalBox, 0),
      markTotalWeight: matched.reduce((acc, p) => acc + p.totalWeight, 0),
    };
  }, [packings, shippingMark]);

  // Live filtered search results for the right-hand Search By panel
  const filteredSearchRecords = useMemo(
    () =>
      packings.filter((p) => {
        const matchMark =
          searchShippingMark === 'ALL' || p.shippingMark === searchShippingMark;
        const matchDest =
          searchDestination === 'ALL' || p.destination === searchDestination;
        return matchMark && matchDest;
      }),
    [packings, searchShippingMark, searchDestination]
  );

  const handleSavePDF = () => {
    const resolvedRows = flushPendingReportWeights();
    const resolvedTotals = calculatePackingTotals(resolvedRows);
    const check = validatePackingForm({
      invoiceNumber,
      packingDate,
      shippingMark,
      flight,
      destination,
      shipper,
      paymentStatus,
      rows: resolvedRows,
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
        totalBox: resolvedTotals.totalBox,
        totalWeight: resolvedTotals.totalWeight,
        totalAmount: resolvedTotals.totalAmount,
        rmbRate: preservedRmbRate,
        totalAmountBDT: calculatePackingTotalAmountBDT(resolvedTotals.totalAmount, preservedRmbRate),
        rmbAmount:
          resolvedTotals.totalWeight > 0
            ? Math.round((resolvedTotals.totalAmount / resolvedTotals.totalWeight) * 100) / 100
            : 0,
        settledAmount: resolvedTotals.totalAmount,
        exporterStatus: paymentStatus,
        remarks,
        paymentDate: paymentStatus === 'PAID' ? packingDate : '',
        paymentStatus,
        billSite: destination,
        calculationPending: false,
        pendingFields: undefined,
        rawValues: undefined,
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
      totalBox: resolvedTotals.totalBox,
      totalWeight: resolvedTotals.totalWeight,
      totalAmount: resolvedTotals.totalAmount,
      rmbAmount:
        resolvedTotals.totalWeight > 0
          ? Math.round((resolvedTotals.totalAmount / resolvedTotals.totalWeight) * 100) / 100
          : 0,
      settledAmount: resolvedTotals.totalAmount,
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

  const exportableRows = useMemo(() => {
    const validItems = rows.filter(
      (r) =>
        r.item.trim() !== '' ||
        r.box > 0 ||
        r.weight > 0 ||
        (Number(r.reportWeight) || 0) > 0 ||
        r.rate > 0
    );
    return validItems.length > 0 ? validItems : rows.slice(0, 5);
  }, [rows]);

  const handlePrintSelected = () => {
    const resolvedRows = flushPendingReportWeights();
    const resolvedTotals = calculatePackingTotals(resolvedRows);
    const activeItems = resolvedRows.filter(
      (r) =>
        r.item.trim() !== '' ||
        r.box > 0 ||
        r.weight > 0 ||
        (Number(r.reportWeight) || 0) > 0 ||
        r.rate > 0
    );
    const itemsToExport = activeItems.length > 0 ? activeItems : resolvedRows.slice(0, 5);
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
        items: itemsToExport,
        totalBox: resolvedTotals.totalBox,
        totalWeight: resolvedTotals.totalWeight,
        totalAmount: resolvedTotals.totalAmount,
        remarks,
      },
      items: itemsToExport,
    });
  };

  const shortcutHandlerRef = useRef<(action: ViewShortcutEventDetail['action']) => void>(() => {});
  shortcutHandlerRef.current = (action) => {
    if (action === 'SAVE_ACTIVE_VIEW') {
      handleSavePDF();
    } else if (action === 'PRINT_ACTIVE_VIEW') {
      handlePrintSelected();
    } else if (action === 'ADD_FORM_ROW') {
      handleAddRow();
      showToast('Added new line item row to Export Packing List (Alt+N).');
    } else if (action === 'RESET_FORM') {
      handleClear();
    }
  };

  useEffect(() => {
    const onShortcut = (event: Event) => {
      const customEvent = event as CustomEvent<ViewShortcutEventDetail>;
      const action = customEvent.detail?.action;
      if (!action) return;
      customEvent.detail.handled = true;
      shortcutHandlerRef.current(action);
    };

    window.addEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZSB_VIEW_SHORTCUT_EVENT, onShortcut);
  }, []);



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
      <div className="bg-[#273E56] text-white px-5 py-3.5 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#00897b]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#5eead4] bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-amber-400 zsb-golden-brand">
                {companyProfile.companyName}
              </span>
              <span className="text-slate-400 hidden sm:inline">·</span>
              <span className="text-sm sm:text-base font-semibold text-[#80cbc4] tracking-wide">
                Export Packing List — Manifest Entry Form
              </span>
            </div>
            <div className="mt-1 inline-flex flex-wrap items-center gap-2 bg-[#1c2a33] border border-[#334b59] px-2.5 py-0.5 rounded text-[11px] font-medium text-slate-200">
              <span>{companyProfile.address}</span>
              <span className="text-slate-500">|</span>
              <span className="font-mono">
                Mob: {companyProfile.mobiles.join(', ')}
              </span>
              <span className="text-slate-500">|</span>
              <span className="font-mono">
                EMAIL: {companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com' ? companyProfile.email : 'zsbaquatics@gmail.com'}, Website : {companyProfile.website || 'www.zsbaquatics.com'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200 font-mono tabular-nums">
          <span>
            Active Rows: <strong>{populatedRowCount}</strong>/{rows.length}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[#5eead4] font-bold">
            {totalBox} Boxes ({totalWeight.toFixed(2)} KG)
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-white font-bold">
            {formatCurrency(totalAmount, 'RMB')}
          </span>
          <span aria-hidden="true">·</span>
          <span className="bg-[#00897b]/25 text-[#5eead4] px-2.5 py-0.5 rounded border border-[#00897b]/50 font-bold">
            Sheet #03
          </span>
        </div>
      </div>

      {/* Main Grid: Redesigned Packing List Voucher (Left 9 Cols) + Action & Search Controls (Right 3 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Packing List Data Entry Sheet (9 Cols) */}
        <div className="lg:col-span-9 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Sheet Title Header */}
            <div className="bg-[#273E56] text-white py-3 px-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#1d2c35]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#5eead4] bg-white p-0.5 shrink-0 shadow-xs flex items-center justify-center">
                  <img
                    src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                    alt={companyProfile.companyName}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-black tracking-tight text-amber-400 zsb-golden-brand">
                    {companyProfile.companyName}
                  </div>
                  <div className="text-xs font-semibold tracking-wider uppercase text-[#80cbc4]">
                    PACKING LIST DATA ENTRY FORM (AIR FREIGHT EXPORT MANIFEST)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
                  <div className="text-[11px] text-[#80cbc4] uppercase">Manifest Ref</div>
                  <div className="font-bold text-white text-sm">{invoiceNumber}</div>
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
                    {shippingMarkOptionElements}
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
                    {flightOptionElements}
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
                    {destinationOptionElements}
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
                    {shipperOptionElements}
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
            <div className="p-2.5 bg-slate-50/70">
              <div
                data-testid="packing-entry-scroll-box"
                className="overflow-x-auto border border-slate-200 rounded-lg bg-white"
              >
              <table
                className="w-full border-collapse text-xs"
                data-testid="packing-entry-table"
              >
                <thead>
                  <tr className="bg-[#273E56] text-white uppercase text-[10.5px] font-bold tracking-wide border-b border-[#1d2c35]">
                    <th className="px-1.5 py-2.5 border-r border-[#334b59] w-10 min-w-[40px] text-center">
                      SL #
                    </th>
                    <th className="px-2 py-2.5 border-r border-[#334b59] text-left min-w-[126px]">
                      <div className="flex items-center justify-between gap-1">
                        <span>ITEM / SIZE</span>
                        <button
                          type="button"
                          onClick={() => setAddingCategory('exportItems')}
                          className="text-[9px] bg-[#00897b] hover:bg-[#00796b] px-1.5 py-0.5 rounded text-white font-bold cursor-pointer shrink-0"
                          title="Add new export item"
                        >
                          +New
                        </button>
                      </div>
                    </th>
                    <th className="px-1 py-2.5 border-r border-[#334b59] min-w-[58px] text-center">
                      <div className="flex items-center justify-between px-0.5 gap-1">
                        <span>BOX</span>
                        <button
                          type="button"
                          onClick={() => setAddingCategory('boxes')}
                          className="text-[9px] bg-[#00897b] hover:bg-[#00796b] px-1 py-0.5 rounded text-white cursor-pointer shrink-0"
                          title="Add box preset"
                        >
                          +
                        </button>
                      </div>
                    </th>
                    <th className="px-1 py-2.5 border-r border-[#334b59] min-w-[80px] text-center">
                      <div className="flex items-center justify-between px-0.5 gap-1">
                        <span>WEIGHT (KG)</span>
                        <button
                          type="button"
                          onClick={() => setAddingCategory('weights')}
                          className="text-[9px] bg-[#00897b] hover:bg-[#00796b] px-1 py-0.5 rounded text-white cursor-pointer shrink-0"
                          title="Add weight preset"
                        >
                          +
                        </button>
                      </div>
                    </th>
                    <th
                      data-testid="packing-col-report-weight"
                      className="relative px-1.5 py-2.5 border-r border-[#334b59] min-w-[96px] text-center"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>REPORT WEIGHT (KG)</span>
                        <span className="relative inline-flex items-center group">
                          <button
                            type="button"
                            data-testid="report-weight-help-btn"
                            aria-label="Report Weight (KG) Help"
                            aria-describedby="report-weight-tooltip"
                            aria-expanded={showReportWeightHelp}
                            title="When this field is populated, it overrides the standard weight for final report calculations."
                            onClick={() => setShowReportWeightHelp((prev) => !prev)}
                            onBlur={() => setShowReportWeightHelp(false)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setShowReportWeightHelp(false);
                            }}
                            className="zsb-help-icon-btn inline-flex items-center justify-center rounded-full text-[#80cbc4] hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors cursor-help shrink-0"
                          >
                            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <div
                            id="report-weight-tooltip"
                            role="tooltip"
                            data-testid="report-weight-tooltip"
                            className={`pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-60 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-left leading-relaxed text-slate-100 shadow-xl z-30 transition-all duration-150 ${
                              showReportWeightHelp
                                ? 'opacity-100 visible translate-y-0'
                                : 'opacity-0 invisible -translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-slate-900 border-l border-t border-slate-700"
                            />
                            When this field is populated, it overrides the standard weight for final report calculations.
                          </div>
                        </span>
                      </div>
                      <div className="text-[9px] font-normal lowercase tracking-normal text-[#80cbc4]">
                        editable override
                      </div>
                    </th>
                    <th className="px-1.5 py-2.5 border-r border-[#334b59] min-w-[74px] text-right">
                      TOTAL WEIGHT
                    </th>
                    <th className="px-1 py-2.5 border-r border-[#334b59] min-w-[66px] text-center">
                      UNIT
                    </th>
                    <th className="px-1.5 py-2.5 border-r border-[#334b59] min-w-[76px] text-right">
                      <div>RATE (RMB)</div>
                      <div className="text-[9px] font-normal lowercase tracking-normal text-[#80cbc4]">
                        {paymentStatus === 'UNPAID' ? '≥ 0 (Unpaid)' : '> 0 (Required)'}
                      </div>
                    </th>
                    <th className="px-1.5 py-2.5 border-r border-[#334b59] min-w-[88px] text-right">
                      TOTAL AMOUNT (RMB)
                    </th>
                    <th className="px-1 py-2.5 w-10 min-w-[40px] text-center">CLR</th>
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
                      <PackingItemTableRow
                        key={row.id}
                        row={row}
                        rowIndex={idx}
                        exportItemOptions={exportItemOptionElements}
                        boxPresets={dropdownOptions.boxes}
                        boxOptions={boxOptionElements}
                        weightPresets={dropdownOptions.weights}
                        weightOptions={weightOptionElements}
                        unitOptions={unitOptionElements}
                        paymentStatus={paymentStatus}
                        hasItemError={Boolean(rowErr?.item || highlightFirstEmptyRow)}
                        hasBoxError={Boolean(rowErr?.box || highlightFirstEmptyRow)}
                        hasWeightError={Boolean(rowErr?.weight || highlightFirstEmptyRow)}
                        hasRateError={Boolean(rowErr?.rate || highlightFirstEmptyRow)}
                        hasAnyRowError={Boolean(rowErr || highlightFirstEmptyRow)}
                        reportWeightResetToken={reportWeightResetToken}
                        onRowChange={handleRowChange}
                        onClearRow={handleClearRow}
                        onScheduleReportWeightDraft={scheduleReportWeightCommit}
                        onCommitReportWeightImmediate={commitReportWeightForRow}
                      />
                    );
                  })}
                </tbody>

                {/* Subtotals & Instant Automatic Summation Rows */}
                <tfoot>
                  {/* Row 1: Direct Column-Aligned Subtotals */}
                  <tr className="bg-[#1c2a33] text-white font-bold border-t-2 border-[#00897b] text-xs">
                    <td
                      colSpan={2}
                      className="px-3 py-2.5 text-right uppercase tracking-wider border-r border-[#334b59]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-semibold text-[#5eead4] bg-[#273E56] px-1.5 py-0.5 rounded">
                          {populatedRowCount} {populatedRowCount === 1 ? 'Item' : 'Items'}
                        </span>
                        <span className="font-extrabold">TOTAL QUANTITY:</span>
                      </div>
                    </td>
                    <td
                      data-testid="packing-footer-box"
                      className="px-2 py-2.5 text-center font-mono tabular-nums text-[#5eead4] text-sm font-black border-r border-[#334b59] bg-[#273E56]/70 whitespace-nowrap"
                    >
                      {totalBox} Boxes
                    </td>
                    <td
                      colSpan={2}
                      className="px-2 py-2.5 text-right uppercase text-[11px] font-bold border-r border-[#334b59] whitespace-nowrap"
                    >
                      TOTAL WT:
                    </td>
                    <td
                      data-testid="packing-footer-weight"
                      className="px-2.5 py-2.5 text-right font-mono tabular-nums text-[#5eead4] text-sm font-black border-r border-[#334b59] bg-[#273E56]/70 whitespace-nowrap"
                    >
                      {totalWeight.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      KG
                    </td>
                    <td
                      colSpan={2}
                      className="px-2.5 py-2.5 text-right uppercase text-[11px] font-bold border-r border-[#334b59] whitespace-nowrap"
                    >
                      TOTAL VALUE:
                    </td>
                    <td
                      colSpan={2}
                      data-testid="packing-footer-total"
                      className="px-2.5 py-2.5 text-right font-mono tabular-nums text-white text-sm font-black pr-3 bg-[#00897b]/30 whitespace-nowrap"
                    >
                      {formatCurrency(totalAmount, 'RMB')}
                    </td>
                  </tr>

                  {/* Row 2: Prominent Shipment Totals Live Summation Banner */}
                  <tr className="bg-[#273E56] text-white border-t border-[#334b59]">
                    <td colSpan={10} className="p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-[#00897b] text-white font-black text-xs uppercase tracking-wider shadow-xs">
                            SHIPMENT TOTALS
                          </span>
                          <span className="text-slate-300 text-xs font-medium hidden sm:inline">
                            Live automatic summation of cartons and net cargo weight
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-5 font-mono text-xs">
                          {/* Total Quantity */}
                          <div className="flex items-center gap-1.5 bg-[#1c2a33] px-3 py-1.5 rounded-lg border border-[#334b59]">
                            <span className="text-slate-400 font-bold uppercase text-[10.5px]">
                              Total Quantity:
                            </span>
                            <span
                              data-testid="packing-shipment-total-qty"
                              className="font-black text-white text-sm tabular-nums"
                            >
                              {totalBox} Cartons / Boxes
                            </span>
                          </div>

                          {/* Total Net Weight */}
                          <div className="flex items-center gap-1.5 bg-[#1c2a33] px-3 py-1.5 rounded-lg border border-[#334b59]">
                            <span className="text-slate-400 font-bold uppercase text-[10.5px]">
                              Total Weight:
                            </span>
                            <span
                              data-testid="packing-shipment-total-weight"
                              className="font-black text-[#5eead4] text-sm tabular-nums"
                            >
                              {totalWeight.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              KG
                            </span>
                          </div>

                          {/* Total Value */}
                          <div className="flex items-center gap-1.5 bg-[#1c2a33] px-3 py-1.5 rounded-lg border border-[#334b59]">
                            <span className="text-slate-400 font-bold uppercase text-[10.5px]">
                              Shipment Value:
                            </span>
                            <span
                              data-testid="packing-shipment-total-val"
                              className="font-black text-emerald-300 text-sm tabular-nums"
                            >
                              {formatCurrency(totalAmount, 'RMB')}
                            </span>
                            {companyProfile.rmbExchangeRate > 0 && (
                              <span className="text-[11px] text-[#80cbc4]">
                                (≈{' '}
                                {formatCurrency(
                                  Math.round(totalAmount * companyProfile.rmbExchangeRate),
                                  companyProfile.currency
                                )}
                                )
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
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
                Formula: <strong>Total Weight = Box × (Report Weight if entered, else Weight)</strong> ·{' '}
                <strong>Total Amount = Total Weight × Rate</strong>
              </div>
            </div>

            {/* Manifest KPI Summary Strip & Remarks */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-between">
                    <span>TOTAL QUANTITY</span>
                    <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded font-mono">Auto-Sum</span>
                  </div>
                  <div
                    data-testid="packing-kpi-total-box"
                    className="text-base font-black font-mono tabular-nums text-slate-900 mt-0.5"
                  >
                    {totalBox} <span className="text-xs font-semibold text-slate-500">Boxes</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-between">
                    <span>TOTAL SHIPMENT WEIGHT</span>
                    <span className="text-[9px] text-teal-700 bg-teal-50 px-1 rounded font-mono">Auto-Sum</span>
                  </div>
                  <div
                    data-testid="packing-kpi-total-weight"
                    className="text-base font-black font-mono tabular-nums text-teal-800 mt-0.5"
                  >
                    {totalWeight.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
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

                <div className="bg-teal-50/70 p-3 rounded-lg border border-teal-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-[#273E56] flex items-center justify-between">
                    <span>TOTAL MANIFEST VALUE</span>
                    <span className="text-[9px] text-[#00897b] bg-teal-100 px-1 rounded font-mono">RMB</span>
                  </div>
                  <div
                    data-testid="packing-summary-total"
                    className="text-base font-black font-mono tabular-nums text-[#273E56] mt-0.5"
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
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897b]"
                />
              </div>
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
                  className="w-full bg-[#00897b] hover:bg-[#00796b] text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <Edit3 className="w-4 h-4 text-[#80cbc4] shrink-0" />
                  <span>UPDATE MANIFEST (SAVE)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-[#273E56] hover:bg-[#1c2a33] text-white py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span>CANCEL EDIT (NEW MANIFEST)</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSavePDF}
                className="w-full text-white py-2.5 px-4 rounded-lg font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer bg-[#00897b] hover:bg-[#00796b] whitespace-nowrap"
                title="Save Manifest (Shortcut: Ctrl+S)"
              >
                <Save className="w-5 h-5 shrink-0" />
                <span>SAVE MANIFEST</span>
                <span className="text-[10px] font-mono bg-black/25 px-1.5 py-0.5 rounded text-[#80cbc4]">
                  Ctrl+S
                </span>
              </button>
            )}

            {/* Share via WeChat (.PNG) */}
            <button
              type="button"
              data-testid="packing-share-wechat-btn"
              onClick={() => setIsShareModalOpen(true)}
              className="w-full bg-[#07C160] hover:bg-[#06a853] text-white py-2.5 px-3 rounded-lg font-bold text-xs shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              title="Share Packing List Manifest .PNG to WeChat (微信)"
            >
              <WeChatIcon className="w-4 h-4 shrink-0" />
              <span>SHARE VIA WECHAT (微信)</span>
            </button>

            {/* FLIGHT RETURN BILL Monthly Statement Button */}
            <button
              type="button"
              data-testid="packing-open-awb-btn"
              onClick={() => setActiveTab('air_way_bill')}
              className="w-full bg-[#1877d2] hover:bg-[#1465b5] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>FLIGHT RETURN BILL STATEMENT</span>
            </button>

            <button
              type="button"
              data-testid="packing-import-excel-csv-btn"
              onClick={() => openDataCenterModal('import', 'packing')}
              className="w-full bg-[#273E56] hover:bg-[#1c2a33] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              title="Import Packing List rows from Excel (.xlsx) or CSV (.csv) — same Mark, Flight, Destination, Shipper & Date automatically merge into 1 Invoice & Packing No"
            >
              <UploadCloud className="w-4 h-4 stroke-[2.2] text-[#5eead4]" />
              <span>IMPORT EXCEL / CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('packing_db')}
              className="w-full bg-[#089bc4] hover:bg-[#0782a5] text-white py-2.5 px-4 rounded-lg font-bold text-xs uppercase shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
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
                {savedManifestOptionElements}
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
                  {shippingMarkOptionElements}
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
                  {destinationOptionElements}
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

      {/* Offscreen Printable / Exportable Packing Manifest Canvas for Share Export (Mounted Only On Demand) */}
      {isShareModalOpen && (
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div
          id="packing-manifest-export-canvas"
          className="zsb-print-paper relative w-[760px] max-w-[760px] bg-white rounded-sm border border-slate-300 p-7 space-y-5 text-slate-900 overflow-hidden"
          style={{ width: '760px', backgroundColor: '#ffffff', color: '#000000', position: 'relative' }}
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
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt=""
              style={{
                width: '340px',
                height: '340px',
                objectFit: 'contain',
                borderRadius: '9999px',
              }}
            />
          </div>

          {/* Official Document Header (Logo on Left side of ZSB AQUATICS) */}
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
                className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shadow-xs flex items-center justify-center shrink-0"
              >
                <img
                  src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                  alt={companyProfile.companyName}
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

            <div
              style={{ color: '#000000' }}
              className="text-xs sm:text-sm font-bold tracking-wide"
            >
              Address: {companyProfile.address}
            </div>

            <div
              style={{ color: '#000000' }}
              className="text-xs sm:text-sm font-bold font-mono"
            >
              Mobile: {companyProfile.mobiles.join(' , ')} | EMAIL: {companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com' ? companyProfile.email : 'zsbaquatics@gmail.com'}, Website : {companyProfile.website || 'www.zsbaquatics.com'}
            </div>

            <div
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              className="inline-block mt-2 px-5 py-1.5 rounded text-xs font-bold tracking-widest uppercase shadow-sm"
            >
              EXPORT AIR PACKING LIST MANIFEST
            </div>
          </div>

          {/* Packing List Content matching PrintPreviewModal */}
          <div className="space-y-4">
            {/* Manifest Metadata Box (2 rows: 3 items top row, 2 items bottom row, Shipper removed) */}
            <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-lg border-2 border-slate-300">
              {/* Row 1: Packing No, Shipment Date, Shipping Mark */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }} className="grid grid-cols-3 gap-3">
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-0.5">PACKING NO:</span>
                  <span className="font-mono font-black text-slate-900 text-lg block">{invoiceNumber || '-'}</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">SHIPMENT DATE:</span>
                  <span className="font-mono font-black text-slate-950 text-2xl tracking-wide block">{formatDate(packingDate)}</span>
                </div>
                <div className="bg-blue-50/80 p-2.5 rounded border border-blue-200">
                  <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider block mb-0.5">SHIPPING MARK:</span>
                  <span className="font-black text-blue-950 text-2xl tracking-wide block">{shippingMark || '-'}</span>
                </div>
              </div>

              {/* Row 2: Flight Destination, Destination */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }} className="grid grid-cols-2 gap-3">
                <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">FLIGHT DESTINATION:</span>
                  <span className="font-black text-slate-950 text-2xl tracking-wide block">{flight || '-'}</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">DESTINATION:</span>
                  <span className="font-black text-slate-950 text-2xl tracking-wide block">{destination || '-'}</span>
                </div>
              </div>
            </div>

            <table className="w-full text-xs border border-slate-300 border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[10px] border-b border-slate-300">
                  <th className="p-2 border-r border-slate-300 text-center">SL</th>
                  <th className="p-2 border-r border-slate-300 text-left">ITEM / SIZE</th>
                  <th className="p-2 border-r border-slate-300 text-center">BOX</th>
                  <th className="p-2 border-r border-slate-300 text-center">WEIGHT (KG)</th>
                  <th className="p-2 border-r border-slate-300 text-center">REPORT WT (KG)</th>
                  <th className="p-2 border-r border-slate-300 text-right">TOTAL WEIGHT</th>
                  <th className="p-2 border-r border-slate-300 text-center">UNIT</th>
                  <th className="p-2 border-r border-slate-300 text-right">RATE (RMB)</th>
                  <th className="p-2 text-right">AMOUNT (RMB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {exportableRows.map((row, idx) => {
                  const hasReportWt = (Number(row.reportWeight) || 0) > 0;
                  return (
                    <tr key={row.id || idx} className="font-medium">
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                      </td>
                      <td className="p-2 border-r border-slate-200 font-bold">{row.item || '-'}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono">{row.box || 0}</td>
                      <td
                        className={`p-2 border-r border-slate-200 text-center font-mono ${
                          hasReportWt ? 'text-slate-400 line-through' : ''
                        }`}
                      >
                        {row.weight || 0}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 text-center font-mono ${
                          hasReportWt ? 'font-bold text-emerald-800' : 'text-slate-400'
                        }`}
                      >
                        {hasReportWt ? row.reportWeight : '-'}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-teal-800">
                        {row.totalWeight || 0} KG
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold text-[10px]">
                        {row.unit || 'KG'}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">
                        {formatCurrency(row.rate || 0, '')}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.amount || 0, '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <td colSpan={2} className="p-2 text-right uppercase">TOTALS:</td>
                  <td className="p-2 text-center font-mono text-slate-900">{totalBox} Boxes</td>
                  <td colSpan={2}></td>
                  <td className="p-2 text-right font-mono text-teal-800 font-black">{totalWeight} KG</td>
                  <td colSpan={2} className="p-2 text-right uppercase">TOTAL INVOICE VALUE:</td>
                  <td className="p-2 text-right font-mono font-black text-slate-900">
                    {formatCurrency(totalAmount, 'RMB')}
                  </td>
                </tr>
              </tfoot>
            </table>

            {remarks && (
              <div className="text-xs p-2.5 bg-slate-50 rounded border border-slate-200">
                <strong className="text-slate-700">Flight &amp; Handling Remarks:</strong> {remarks}
              </div>
            )}
          </div>

          {/* Dual Official Signatures */}
          <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="flex flex-col items-center">
              <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
                <div
                  style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#0f172a' }}
                  className="text-base font-bold tracking-wider"
                >
                  {companyProfile.managingPartner}
                </div>
              </div>
              <div style={{ color: '#0f172a' }} className="mt-1.5 font-bold uppercase tracking-wider text-xs">
                Managing Partner
              </div>
              <div style={{ color: '#d97706', fontWeight: 800 }} className="text-[10px] uppercase font-extrabold text-amber-500 zsb-golden-brand-light">
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
              <div style={{ color: '#0f172a' }} className="mt-1.5 font-bold uppercase tracking-wider text-xs">
                Partner
              </div>
              <div style={{ color: '#d97706', fontWeight: 800 }} className="text-[10px] uppercase font-extrabold text-amber-500 zsb-golden-brand-light">
                {companyProfile.companyName}
              </div>
            </div>
          </div>

          {/* Footer certification & dynamic A4 page counter */}
          <div
            style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
            className="flex justify-between items-center text-[10px] pt-4 mt-6"
          >
            <span>
              This is an official computer-generated document from <strong style={{ color: '#d97706', fontWeight: 800 }} className="font-extrabold text-amber-500 zsb-golden-brand-light">{companyProfile.companyName}</strong> System • Validated and archived.
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
        />
      )}
    </div>
  );
};
