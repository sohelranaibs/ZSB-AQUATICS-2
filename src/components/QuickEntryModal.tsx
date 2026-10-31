import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  DatasetKey,
  MultiSheetImportResult,
  parseSmartTextData,
  parseExcelOrCsvBuffer,
  parseMasterWorkbookBuffer,
  exportDatasetFile,
  generateMasterWorkbookBuffer,
  downloadExcelBuffer,
  downloadSampleExcelTemplate,
} from '../utils/excelDataHandler.ts';
import {
  downloadCsvFile,
  generateMonthlyExportsAndPurchasesSummaryCSV,
} from '../utils/csvExporter.ts';
import { ParseResult } from '../utils/csvParser.ts';
import {
  formatCurrency,
  formatDate,
  calculateAllMonthlyReports,
} from '../utils/calculations.ts';
import {
  FileSpreadsheet,
  X,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  Table,
  FileUp,
  Layers,
  FileText,
  Sparkles,
} from 'lucide-react';

interface QuickEntryModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type TargetSelection = DatasetKey | 'all';

const SAMPLE_TEMPLATES: Record<DatasetKey, string> = {
  purchase: `Supplier, Date, Item, Quantity, Rate, PreviousAmount, PaidAmount, ContactNumber
ABDULLAH VAI, 2026-10-21, FF1, 120, 460, 10000, 45000, +8801711223344
ABDULLAH VAI, 2026-10-21, F1, 80, 340, 0, 20000, +8801711223344
UZZAL VAI, 2026-10-21, F1, 150, 330, 0, 49500, +8801822334455
UZZAL VAI, 2026-10-21, 2F, 60, 380, 0, 22800, +8801822334455
NAPAL VAI, 2026-10-21, 2F, 80, 380, 15000, 30000, +8801933445566`,

  packing: `ShippingMark, Flight, Destination, Shipper, Date, Item, Box, Weight, Rate
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-21, 2F, 8, 15, 420
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-21, 3F, 6, 14, 400
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-21, XXL, 5, 16, 580
CHJ-22, YG CAN, KUNMING, SAJID INT., 2026-10-21, 3F, 6, 14, 400
CHJ-22, YG CAN, KUNMING, SAJID INT., 2026-10-21, 4F, 7, 15, 390`,

  payment: `Party, Date, DebitAmount, CreditAmount, Status, ReturnRMB, ExportRef
ABDULLAH VAI, 2026-10-21, 65000, 0, PAID, 3000, PKG-2026-0001
UZZAL VAI, 2026-10-21, 49500, 0, REPORT, 2500, PKG-2026-0002
NAPAL VAI, 2026-10-21, 30000, 0, PAID, 1800, PKG-2026-0003`,

  other_cost: `Date, Category, Amount, Description, RefInvoice
2026-10-21, AIR FREIGHT / CARGO BILL, 18500, Airport cargo handling & ice boxes, PKG-2026-0001
2026-10-22, LABOUR & PACKING, 6500, Night shift packing crew, PKG-2026-0002`,
};

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const {
    dataCenterModal,
    closeDataCenterModal,
    bulkImportPurchases,
    bulkImportPackings,
    bulkImportPayments,
    bulkImportOtherCosts,
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile,
    showToast,
  } = useApp();

  const isModalOpen = propIsOpen !== undefined ? propIsOpen : dataCenterModal.isOpen;
  const handleClose = () => {
    if (propOnClose) propOnClose();
    closeDataCenterModal();
  };

  const [activeMode, setActiveMode] = useState<'import' | 'export'>('import');
  const [activeType, setActiveType] = useState<TargetSelection>('purchase');
  const [importMethod, setImportMethod] = useState<'append' | 'replace'>('append');
  const [csvText, setCsvText] = useState<string>(SAMPLE_TEMPLATES.purchase);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileParseResult, setFileParseResult] = useState<ParseResult<any> | null>(null);
  const [multiSheetResult, setMultiSheetResult] = useState<MultiSheetImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dataCenterModal.isOpen) {
      setActiveMode(dataCenterModal.initialTab);
      setActiveType(dataCenterModal.initialDataset);
      const ds =
        dataCenterModal.initialDataset === 'all' ? 'purchase' : dataCenterModal.initialDataset;
      setCsvText(SAMPLE_TEMPLATES[ds]);
      setUploadedFileName(null);
      setFileParseResult(null);
      setMultiSheetResult(null);
    }
  }, [dataCenterModal.isOpen, dataCenterModal.initialTab, dataCenterModal.initialDataset]);

  if (!isModalOpen) return null;

  const singleDatasetKey: DatasetKey = activeType === 'all' ? 'purchase' : activeType;

  // Determine active parse result (from uploaded Excel/CSV file if present, otherwise from textarea)
  const startCount =
    singleDatasetKey === 'purchase'
      ? purchases.length
      : singleDatasetKey === 'packing'
      ? packings.length
      : singleDatasetKey === 'payment'
      ? payments.length
      : otherCosts.length;

  const currentParseResult: ParseResult<any> =
    fileParseResult || parseSmartTextData(singleDatasetKey, csvText, startCount);

  const totalMultiSheetCount = multiSheetResult
    ? multiSheetResult.purchases.records.length +
      multiSheetResult.packings.records.length +
      multiSheetResult.payments.records.length +
      multiSheetResult.otherCosts.records.length
    : 0;

  const handleTypeChange = (type: TargetSelection) => {
    setActiveType(type);
    setUploadedFileName(null);
    setFileParseResult(null);
    setMultiSheetResult(null);
    if (type !== 'all') {
      setCsvText(SAMPLE_TEMPLATES[type]);
    }
  };

  const handleLoadSample = () => {
    setUploadedFileName(null);
    setFileParseResult(null);
    setMultiSheetResult(null);
    setCsvText(SAMPLE_TEMPLATES[singleDatasetKey]);
  };

  const handleClear = () => {
    setUploadedFileName(null);
    setFileParseResult(null);
    setMultiSheetResult(null);
    setCsvText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt') || lowerName.endsWith('.tsv')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev.target?.result || '');
        setCsvText(text);
        setMultiSheetResult(null);
        const parsed = parseSmartTextData(singleDatasetKey, text, startCount);
        setFileParseResult(parsed);
        showToast(`Loaded ${parsed.records.length} row(s) from ${file.name}`);
      };
      reader.readAsText(file);
    } else {
      // Excel (.xlsx / .xls) binary workbook
      const reader = new FileReader();
      reader.onload = (ev) => {
        const arrayBuf = ev.target?.result as ArrayBuffer;
        if (!arrayBuf) return;

        if (activeType === 'all') {
          const multi = parseMasterWorkbookBuffer(arrayBuf, {
            purchases: purchases.length,
            packings: packings.length,
            payments: payments.length,
          });
          setMultiSheetResult(multi);
          setFileParseResult(null);
          const count =
            multi.purchases.records.length +
            multi.packings.records.length +
            multi.payments.records.length +
            multi.otherCosts.records.length;
          showToast(
            `Parsed ${count} record(s) across ${multi.detectedSheets.length} sheet(s) from ${file.name}`
          );
        } else {
          setMultiSheetResult(null);
          const parsed = parseExcelOrCsvBuffer(arrayBuf, singleDatasetKey, startCount);
          setFileParseResult(parsed);
          showToast(`Parsed ${parsed.records.length} ${singleDatasetKey} row(s) from ${file.name}`);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    e.target.value = '';
  };

  const handleDownloadSampleCSV = () => {
    const content = SAMPLE_TEMPLATES[singleDatasetKey];
    downloadCsvFile(content, `ZSB_Aquatics_${singleDatasetKey}_Sample_Template.csv`);
    showToast(`Downloaded ${singleDatasetKey.toUpperCase()} CSV template.`);
  };

  const handleDownloadSampleXLSX = () => {
    downloadSampleExcelTemplate(activeType);
    showToast(
      `Downloaded ${activeType === 'all' ? 'Master Multi-Sheet' : activeType.toUpperCase()} Excel (.xlsx) template.`
    );
  };

  const handleCommitImport = () => {
    if (activeType === 'all' && multiSheetResult) {
      if (totalMultiSheetCount === 0) {
        showToast('No valid records found in the uploaded multi-sheet workbook.');
        return;
      }
      const pCount = bulkImportPurchases(multiSheetResult.purchases.records, importMethod);
      const pkCount = bulkImportPackings(multiSheetResult.packings.records, importMethod);
      const pmCount = bulkImportPayments(multiSheetResult.payments.records, importMethod);
      const cCount = bulkImportOtherCosts(multiSheetResult.otherCosts.records, importMethod);
      showToast(
        `Imported Master Workbook: ${pCount} Purchases, ${pkCount} Packings, ${pmCount} Payments, ${cCount} Costs!`
      );
      handleClose();
      return;
    }

    if (!currentParseResult.success || currentParseResult.records.length === 0) {
      showToast('No valid records found to import. Please check your Excel/CSV file or text.');
      return;
    }

    const count = currentParseResult.records.length;
    if (singleDatasetKey === 'purchase') {
      bulkImportPurchases(currentParseResult.records, importMethod);
      showToast(`Successfully imported ${count} purchase record(s) (${importMethod.toUpperCase()})!`);
    } else if (singleDatasetKey === 'packing') {
      bulkImportPackings(currentParseResult.records, importMethod);
      showToast(`Successfully imported ${count} packing list record(s) (${importMethod.toUpperCase()})!`);
    } else if (singleDatasetKey === 'payment') {
      bulkImportPayments(currentParseResult.records, importMethod);
      showToast(`Successfully imported ${count} payment voucher record(s) (${importMethod.toUpperCase()})!`);
    } else {
      bulkImportOtherCosts(currentParseResult.records, importMethod);
      showToast(`Successfully imported ${count} expense record(s) (${importMethod.toUpperCase()})!`);
    }

    handleClose();
  };

  const handleExportMasterWorkbook = () => {
    const today = new Date().toISOString().slice(0, 10);
    const buf = generateMasterWorkbookBuffer({
      purchases,
      packings,
      payments,
      otherCosts,
    });
    const filename = `ZSB_Aquatics_Master_Workbook_${today}.xlsx`;
    downloadExcelBuffer(buf, filename);
    showToast(`Exported Master Multi-Sheet Excel Workbook (${filename})`);
  };

  const handleExportDataset = (type: DatasetKey, format: 'xlsx' | 'csv') => {
    const records =
      type === 'purchase'
        ? purchases
        : type === 'packing'
        ? packings
        : type === 'payment'
        ? payments
        : otherCosts;

    const filename = exportDatasetFile(type, format, records);
    showToast(`Exported ${records.length} ${type} record(s) to ${filename}`);
  };

  const handleExportMonthlySummaryCSV = () => {
    const { items, totals } = calculateAllMonthlyReports(
      purchases,
      packings,
      otherCosts,
      companyProfile.rmbExchangeRate
    );
    const csv = generateMonthlyExportsAndPurchasesSummaryCSV(
      items,
      totals,
      companyProfile.companyName
    );
    const filename = `ZSB_Aquatics_Monthly_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsvFile(csv, filename);
    showToast(`Exported Monthly Summary Report CSV (${filename})`);
  };

  const canCommitImport =
    activeType === 'all' ? totalMultiSheetCount > 0 : currentParseResult.records.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Excel and CSV Data Import and Export Center"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg font-black shrink-0">
              <FileSpreadsheet className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="zsb-3d-text text-lg sm:text-xl font-black">
                  {companyProfile.companyName}
                </span>
                <span className="text-slate-600">|</span>
                <h2 className="text-base sm:text-lg font-extrabold tracking-wide text-amber-400">
                  Excel (.XLSX) &amp; CSV Import / Export Center
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Import or export Purchases, Packing Lists, Payments &amp; Expenses in Microsoft Excel (.xlsx) or CSV (.csv) format
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher: Import vs Export */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                data-testid="datacenter-tab-import"
                onClick={() => setActiveMode('import')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeMode === 'import'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Import Data</span>
              </button>
              <button
                type="button"
                data-testid="datacenter-tab-export"
                onClick={() => setActiveMode('export')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeMode === 'export'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Data</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close Excel & CSV Data Center"
              aria-label="Close Excel & CSV Data Center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeMode === 'import' ? (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Step 1: Target Sheet & Import Mode */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase">1. Target Sheet:</span>
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('purchase')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                      activeType === 'purchase'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Purchases ({purchases.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('packing')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                      activeType === 'packing'
                        ? 'bg-teal-600 text-white shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Packing Lists ({packings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('payment')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                      activeType === 'payment'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Payments ({payments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('other_cost')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                      activeType === 'other_cost'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Expenses ({otherCosts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('all')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                      activeType === 'all'
                        ? 'bg-slate-900 text-amber-400 shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Sheets (.XLSX Workbook)
                  </button>
                </div>
              </div>

              {/* Append vs Replace */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Import Mode:</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setImportMethod('append')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      importMethod === 'append'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Append / Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMethod('replace')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      importMethod === 'replace'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Replace Existing
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: File Upload Box (.xlsx, .xls, .csv) + Sample Template Downloads */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 flex flex-col justify-between transition">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                    <FileUp className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-extrabold uppercase text-slate-900">
                      Upload Excel (.XLSX / .XLS) or CSV (.CSV) File
                    </h3>
                    <p className="text-xs text-slate-600">
                      Select an Excel workbook or CSV spreadsheet from your device. Exported files from ZSB AQUATICS can be re-imported directly.
                    </p>
                    {uploadedFileName && (
                      <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Loaded File: {uploadedFileName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Choose Excel / CSV File...</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {uploadedFileName && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer"
                    >
                      Clear File
                    </button>
                  )}
                </div>
              </div>

              {/* Template Download Box */}
              <div className="lg:col-span-5 bg-amber-50/60 border border-amber-200 rounded-xl p-4 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-xs font-extrabold uppercase text-amber-950 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Download Ready-to-Fill Templates</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Download pre-formatted Excel (.xlsx) or CSV templates with sample columns, fill your rows in Microsoft Excel, and upload here.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-amber-200/70">
                  <button
                    type="button"
                    onClick={handleDownloadSampleXLSX}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Template (.XLSX)</span>
                  </button>
                  {activeType !== 'all' && (
                    <button
                      type="button"
                      onClick={handleDownloadSampleCSV}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 text-slate-800 border border-amber-300 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Template (.CSV)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* If Single Sheet selected: Paste CSV / Excel Cells Textarea */}
            {activeType !== 'all' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <label
                      htmlFor="csv-paste-textarea"
                      className="font-bold text-slate-800 uppercase"
                    >
                      Or Paste Rows Directly from Excel / CSV ({singleDatasetKey.toUpperCase()}):
                    </label>
                    <span className="text-slate-500 ml-2 text-[11px]">
                      Supports comma-separated CSV or tab-separated copy-paste from Excel
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 rounded hover:bg-amber-100 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Load Sample Rows</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                    <span
                      data-testid="import-parsed-count-badge"
                      className={`font-mono font-bold px-2.5 py-1 rounded text-[11px] ${
                        currentParseResult.records.length > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {(singleDatasetKey === 'packing' || singleDatasetKey === 'purchase') &&
                      currentParseResult.totalParsedRows > currentParseResult.records.length
                        ? `${currentParseResult.totalParsedRows} Item Rows → ${currentParseResult.records.length} Invoice(s)`
                        : `${currentParseResult.records.length} Valid Row(s)`}
                    </span>
                  </div>
                </div>

                <textarea
                  id="csv-paste-textarea"
                  rows={5}
                  value={csvText}
                  onChange={(e) => {
                    setUploadedFileName(null);
                    setFileParseResult(null);
                    setCsvText(e.target.value);
                  }}
                  placeholder="Paste Excel cells or comma-separated CSV lines here..."
                  className="w-full bg-slate-900 text-amber-200 font-mono text-xs p-3.5 rounded-xl border border-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                />
              </div>
            )}

            {/* Multi-sheet Workbook Summary Preview */}
            {activeType === 'all' && multiSheetResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-emerald-950">
                    Multi-Sheet Workbook Detected ({multiSheetResult.detectedSheets.join(', ')})
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    Total Ready to Import: {totalMultiSheetCount} Records
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-emerald-200">
                    <div className="text-slate-500">Purchases</div>
                    <div className="text-lg font-black font-mono text-blue-900">
                      {multiSheetResult.purchases.records.length}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200">
                    <div className="text-slate-500">Packing Lists</div>
                    <div className="text-lg font-black font-mono text-teal-900">
                      {multiSheetResult.packings.records.length}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200">
                    <div className="text-slate-500">Payments</div>
                    <div className="text-lg font-black font-mono text-purple-900">
                      {multiSheetResult.payments.records.length}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200">
                    <div className="text-slate-500">Other Costs</div>
                    <div className="text-lg font-black font-mono text-amber-900">
                      {multiSheetResult.otherCosts.records.length}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Errors or Warnings */}
            {activeType !== 'all' && currentParseResult.errors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Format Warnings ({currentParseResult.errors.length}):</span>
                </div>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-20 overflow-y-auto">
                  {currentParseResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Live Parsed Preview Table */}
            {activeType !== 'all' && currentParseResult.records.length > 0 && (
              <div className="space-y-2">
                {singleDatasetKey === 'purchase' && (
                  <div
                    data-testid="purchase-merge-rule-banner"
                    className="bg-blue-50 border border-blue-300 text-blue-950 rounded-lg px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>
                        <strong>Auto-Merge Active:</strong> Rows with the same{' '}
                        <span className="font-mono font-bold">
                          Purchasing Supplier Name + Date
                        </span>{' '}
                        merge all items into <strong>1 Invoice &amp; Purchasing Invoice Number</strong>.
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[11px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-300">
                      {currentParseResult.totalParsedRows} Item Row(s) →{' '}
                      {currentParseResult.records.length} Purchase Invoice(s)
                    </span>
                  </div>
                )}

                {singleDatasetKey === 'packing' && (
                  <div
                    data-testid="packing-merge-rule-banner"
                    className="bg-teal-50 border border-teal-300 text-teal-950 rounded-lg px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>
                        <strong>Auto-Merge Active:</strong> Rows with the same{' '}
                        <span className="font-mono font-bold">
                          Shipping Mark + Flight + Destination + Shipper + Date
                        </span>{' '}
                        merge all items into <strong>1 Invoice &amp; Packing Number</strong>.
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[11px] bg-teal-100 text-teal-900 px-2 py-0.5 rounded border border-teal-300">
                      {currentParseResult.totalParsedRows} Item Row(s) →{' '}
                      {currentParseResult.records.length} Packing Invoice(s)
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase">
                  <span className="flex items-center space-x-1.5">
                    <Table className="w-4 h-4 text-blue-600" />
                    <span>
                      Live Parsed Preview ({currentParseResult.records.length}{' '}
                      {singleDatasetKey === 'packing'
                        ? 'Merged Packing Invoice(s)'
                        : singleDatasetKey === 'purchase'
                        ? 'Merged Purchase Invoice(s)'
                        : 'Records'}
                      ):
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Mode: {importMethod === 'append' ? 'Append to Database' : 'Replace Existing Sheet'}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-52">
                  <table className="w-full text-left text-xs" data-testid="import-preview-table">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-bold text-[10px] border-b">
                      <tr>
                        <th className="p-2 w-10 text-center">#</th>
                        <th className="p-2">DOC / REF NO</th>
                        <th className="p-2">DATE</th>
                        <th className="p-2">PARTY / MARK / CATEGORY</th>
                        <th className="p-2">DETAILS</th>
                        <th className="p-2 text-right">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentParseResult.records.map((rec: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2 font-mono font-bold text-blue-900 whitespace-nowrap">
                            {rec.invoiceNumber || rec.refInvoice || '-'}
                          </td>
                          <td className="p-2 font-mono text-slate-600 whitespace-nowrap">
                            {formatDate(rec.date || rec.packingDate)}
                          </td>
                          <td className="p-2 font-bold text-slate-800">
                            {singleDatasetKey === 'packing' ? (
                              <div>
                                <div>
                                  {rec.shippingMark} · {rec.flight} · {rec.destination}
                                </div>
                                <div className="text-[11px] font-normal text-slate-500">
                                  Shipper: {rec.shipper}
                                </div>
                              </div>
                            ) : singleDatasetKey === 'other_cost' ? (
                              rec.category
                            ) : (
                              rec.description
                            )}
                          </td>
                          <td className="p-2 text-slate-600">
                            {singleDatasetKey === 'purchase' && rec.items?.length > 0 && (
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300">
                                    {rec.items.length} {rec.items.length === 1 ? 'Item' : 'Items Merged'}
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    Total: {rec.totalQty} KG
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 font-mono">
                                  {rec.items
                                    .map(
                                      (it: any) =>
                                        `${it.item} (${it.quantity} KG @ ${it.rate})`
                                    )
                                    .join(' + ')}
                                </div>
                              </div>
                            )}
                            {singleDatasetKey === 'packing' && rec.items?.length > 0 && (
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-teal-100 text-teal-900 border border-teal-300">
                                    {rec.items.length} {rec.items.length === 1 ? 'Item' : 'Items Merged'}
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    Total: {rec.totalBox} Boxes ({rec.totalWeight} KG)
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 font-mono">
                                  {rec.items
                                    .map(
                                      (it: any) =>
                                        `${it.item} (${it.box} Box × ${it.weight} KG @ ¥${it.rate})`
                                    )
                                    .join(' + ')}
                                </div>
                              </div>
                            )}
                            {singleDatasetKey === 'payment' && (
                              <span>
                                Status: <strong>{rec.status}</strong>{' '}
                                {rec.returnRMB ? `| ¥${rec.returnRMB}` : ''}
                              </span>
                            )}
                            {singleDatasetKey === 'other_cost' && <span>{rec.description}</span>}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(
                              rec.totalAmount ?? rec.amount ?? 0,
                              singleDatasetKey === 'packing' ? 'RMB' : companyProfile.currency
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* EXPORT DATA TAB */
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Master Multi-Sheet Excel Workbook Card */}
            <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wide">
                  <Layers className="w-4 h-4" />
                  <span>Full Multi-Sheet Microsoft Excel Workbook (.XLSX)</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Export Complete ZSB AQUATICS Master Workbook
                </h3>
                <p className="text-xs text-slate-300">
                  Downloads a single native <code className="text-amber-300">.xlsx</code> Excel file with separate worksheet tabs for Purchases ({purchases.length}), Packing Lists ({packings.length}), Payments ({payments.length}), and Other Costs ({otherCosts.length}).
                </p>
              </div>

              <button
                type="button"
                data-testid="export-master-xlsx-btn"
                onClick={handleExportMasterWorkbook}
                className="inline-flex items-center space-x-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase rounded-xl shadow-lg transition cursor-pointer shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 stroke-[2.3]" />
                <span>Download Master Excel (.XLSX)</span>
              </button>
            </div>

            {/* Individual Sheet Export Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Purchases */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-blue-700">
                      Sheet 08 · Procurement Ledger
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                      Purchase Challan / Bills DB
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Supplier bills, quantities, rates, paid amounts, and balances.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold bg-blue-50 text-blue-900 px-2.5 py-1 rounded border border-blue-200 whitespace-nowrap shrink-0">
                    {purchases.length} Records
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    data-testid="export-purchases-xlsx-btn"
                    onClick={() => handleExportDataset('purchase', 'xlsx')}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Excel (.XLSX)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="export-purchases-csv-btn"
                    onClick={() => handleExportDataset('purchase', 'csv')}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-700" />
                    <span>Export CSV (.CSV)</span>
                  </button>
                </div>
              </div>

              {/* 2. Packing Lists */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-teal-700">
                      Sheet 09 · Air-Freight Export
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                      Export Packing Lists DB
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Shipping marks, flights, destinations, boxes, weights (KG), RMB &amp; BDT values.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold bg-teal-50 text-teal-900 px-2.5 py-1 rounded border border-teal-200 whitespace-nowrap shrink-0">
                    {packings.length} Records
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    data-testid="export-packings-xlsx-btn"
                    onClick={() => handleExportDataset('packing', 'xlsx')}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Excel (.XLSX)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="export-packings-csv-btn"
                    onClick={() => handleExportDataset('packing', 'csv')}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    <span>Export CSV (.CSV)</span>
                  </button>
                </div>
              </div>

              {/* 3. Payments */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-purple-700">
                      Sheet 10 · Settlement Ledger
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                      Supplier &amp; Exporter Payments DB
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Payment vouchers, supplier settlements, exporter RMB returns, and statuses.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold bg-purple-50 text-purple-900 px-2.5 py-1 rounded border border-purple-200 whitespace-nowrap shrink-0">
                    {payments.length} Records
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    data-testid="export-payments-xlsx-btn"
                    onClick={() => handleExportDataset('payment', 'xlsx')}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Excel (.XLSX)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="export-payments-csv-btn"
                    onClick={() => handleExportDataset('payment', 'csv')}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-700" />
                    <span>Export CSV (.CSV)</span>
                  </button>
                </div>
              </div>

              {/* 4. Other Costs & Monthly Summary */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-amber-700">
                      Sheet 07 · Expenses &amp; Monthly Rollup
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                      Operating Costs &amp; Monthly Summary
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cargo/operating expenses ({otherCosts.length}) and monthly trade profit summary.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold bg-amber-50 text-amber-900 px-2.5 py-1 rounded border border-amber-200 whitespace-nowrap shrink-0">
                    {otherCosts.length} Costs
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleExportDataset('other_cost', 'xlsx')}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Costs (.XLSX)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMonthlySummaryCSV}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Monthly Summary (.CSV)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Supports Microsoft Excel (<code className="font-mono text-slate-700">.xlsx</code>,{' '}
            <code className="font-mono text-slate-700">.xls</code>) and UTF-8 CSV (<code className="font-mono text-slate-700">.csv</code>) with full round-trip compatibility.
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              Close
            </button>
            {activeMode === 'import' && (
              <button
                type="button"
                data-testid="commit-excel-csv-import-btn"
                onClick={handleCommitImport}
                disabled={!canCommitImport}
                className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-extrabold uppercase shadow transition ${
                  canCommitImport
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  Import &amp; Save (
                  {activeType === 'all'
                    ? `${totalMultiSheetCount} Multi-Sheet`
                    : `${currentParseResult.records.length}`}{' '}
                  Records)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
