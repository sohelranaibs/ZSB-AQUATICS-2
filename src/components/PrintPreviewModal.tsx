import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  formatCurrency,
  formatDate,
  formatRMB,
  formatExporterSlipExportFilename,
  formatPurchaseExportFilename,
  formatPackingExportFilename,
} from '../utils/calculations.ts';
import {
  exportElementToPdf,
  exportElementToPng,
  exportElementsToCombinedPdf,
  openPrintableDocumentWindow,
  resolveCompanyLogoSrc,
} from '../utils/pdfGenerator.ts';
import {
  Printer,
  X,
  Download,
  FileSpreadsheet,
  CheckCircle,
  ShieldCheck,
  Loader2,
  FileDown,
  ImageDown,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import { getPrintAllSequenceProgress } from '../utils/printAllSheets.ts';
import {
  GlobalViewTablePrintBody,
  GlobalOffscreenPrintHost,
} from './GlobalViewTablePrintBody.tsx';
import { formatMortalityReportFilename } from '../utils/mortalityReport.ts';
import { formatBatchPaymentSlipsPdfFilename } from '../utils/batchPaymentSlipPdf.ts';
import { formatAirWayBillExportFilename } from '../utils/airWayBill.ts';
import { PaymentSlipPrintCard } from './PaymentSlipPrintCard.tsx';
import { PaymentRecord } from '../types/index.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import {
  PngShareModal,
  WeChatIcon,
} from './PngShareModal.tsx';
import { PrintHeaderFooterConfigPanel } from './PrintHeaderFooterConfigPanel.tsx';
import {
  PrintHeaderFooterConfig,
  formatPrintHeaderDate,
  isPrintHeaderFooterCustomized,
  loadPrintHeaderFooterConfig,
  savePrintHeaderFooterConfig,
} from '../utils/printHeaderFooterConfig.ts';

export const PrintPreviewModal: React.FC = () => {
  const {
    printModalData,
    closePrintModal,
    companyProfile,
    showToast,
    globalViewReport,
    isExportingGlobalPdf,
    printAllSequence,
    nextPrintAllSheet,
    prevPrintAllSheet,
    jumpToPrintAllSheet,
    togglePrintAllAutoPlay,
    stopPrintAllActiveSheets,
  } = useApp();
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingPng, setIsSavingPng] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showHeaderFooterConfig, setShowHeaderFooterConfig] = useState(false);
  const [headerFooterConfig, setHeaderFooterConfig] = useState<PrintHeaderFooterConfig>(() =>
    loadPrintHeaderFooterConfig(typeof window !== 'undefined' ? window.localStorage : null)
  );
  const [printCurrentPageOnly, setPrintCurrentPageOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (!printModalData.isOpen) {
      setShowHeaderFooterConfig(false);
    }
  }, [printModalData.isOpen]);

  const handleHeaderFooterConfigChange = (next: PrintHeaderFooterConfig) => {
    setHeaderFooterConfig(next);
    savePrintHeaderFooterConfig(next, typeof window !== 'undefined' ? window.localStorage : null);
  };

  const isHeaderFooterCustomized = isPrintHeaderFooterCustomized(headerFooterConfig);
  const formattedPrintDate = formatPrintHeaderDate();

  const sequenceProgress = getPrintAllSequenceProgress(printAllSequence);

  if (!printModalData.isOpen) {
    if (isExportingGlobalPdf && globalViewReport) {
      return (
        <GlobalOffscreenPrintHost
          report={globalViewReport}
          companyProfile={companyProfile}
        />
      );
    }
    return null;
  }

  const { type, title, data, items, selectedIds } = printModalData;

  const packingItems =
    type === 'packing' ? (items && items.length > 0 ? items : data?.items || []) : [];
  const totalPages = Math.max(1, Math.ceil(packingItems.length / ITEMS_PER_PAGE));
  const displayPackingItems =
    type === 'packing' && printCurrentPageOnly
      ? packingItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
      : packingItems;

  const getCleanFilename = (ext: 'pdf' | 'png' = 'pdf') => {
    if (type === 'exporter_payment_slip') {
      return formatExporterSlipExportFilename(
        data?.shippingMark || 'ALL',
        data?.packingDate || 'ALL',
        ext
      );
    }
    if (type === 'purchase') {
      return formatPurchaseExportFilename(
        data?.invoiceNumber || 'PUR',
        data?.description || '',
        data?.date || '',
        ext
      );
    }
    if (type === 'packing') {
      return formatPackingExportFilename(
        data?.invoiceNumber || 'PKG',
        data?.shippingMark || '',
        data?.packingDate || '',
        ext
      );
    }
    if (type === 'air_way_bill') {
      return formatAirWayBillExportFilename(
        data?.yearMonth || 'all',
        data?.shipper || 'ALL',
        ext
      );
    }
    if (data?.filename) {
      const base = String(data.filename).replace(/\.(pdf|png)$/i, '');
      return `${base}.${ext}`;
    }
    if (type === 'monthly_statement') {
      const period = String(data?.statementMonth || data?.periodLabel || 'MONTHLY').replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      return `ZSB_AQUATICS_MONTHLY_STATEMENT_${period}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    }
    if (type === 'batch_print') {
      const period = String(data?.statementMonth || data?.periodLabel || 'REPORT').replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      return `ZSB_AQUATICS_CONSOLIDATED_REPORT_${period}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    }
    if (type === 'mortality_report') {
      return formatMortalityReportFilename(data?.targetMonth || '', ext);
    }
    if (type === 'batch_payment_slips') {
      const recs = data?.records || [];
      return formatBatchPaymentSlipsPdfFilename(recs.length, data?.categoryFilter || 'all');
    }
    const docNo = data?.invoiceNumber || (data?.records?.[0]?.invoiceNumber) || type;
    const cleanDoc = String(docNo).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `ZSB_AQUATICS_${cleanDoc}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  };

  const resolvedLogoSrc = resolveCompanyLogoSrc(companyProfile.logoUrl);

  const handleDirectSavePdf = async (allowFallback = true) => {
    if (printAllSequence.isAutoPlaying) {
      togglePrintAllAutoPlay(false);
    }
    setIsSavingPdf(true);
    const filename = getCleanFilename('pdf');
    try {
      let success = false;
      if (type === 'batch_payment_slips') {
        const recs = data?.records || [];
        const slipElementIds = recs.map((_: any, idx: number) => `batch-modal-slip-${idx}`);
        success = await exportElementsToCombinedPdf(slipElementIds, filename, 800);
      } else {
        success = await exportElementToPdf('printable-document', filename);
      }

      if (success) {
        showToast(`PDF downloaded: ${filename}`);
      } else if (allowFallback) {
        showToast('Direct PDF conversion failed, opening print dialogue...');
        handleBrowserPrint(false);
      } else {
        showToast('Unable to generate PDF or open print dialog. Please try Ctrl+P.');
      }
    } catch (e) {
      console.error(e);
      showToast('Error generating PDF file.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleDirectSavePng = async () => {
    if (printAllSequence.isAutoPlaying) {
      togglePrintAllAutoPlay(false);
    }
    setIsSavingPng(true);
    const filename = getCleanFilename('png');
    try {
      const success = await exportElementToPng('printable-document', filename, 800);
      if (success) {
        showToast(`PNG image downloaded: ${filename}`);
      } else {
        showToast('Error generating PNG image.');
      }
    } catch (e) {
      console.error(e);
      showToast('Error generating PNG image.');
    } finally {
      setIsSavingPng(false);
    }
  };

  const handleBrowserPrint = (allowFallback = true) => {
    if (printAllSequence.isAutoPlaying) {
      togglePrintAllAutoPlay(false);
    }
    try {
      const opened = openPrintableDocumentWindow('printable-document', title);
      if (opened) {
        showToast('Print document window opened! Press Ctrl+P or click Print Now.');
      } else if (allowFallback) {
        handleDirectSavePdf(false);
      } else {
        showToast('Print popup blocked by browser. Please allow popups or press Ctrl+P.');
      }
    } catch (err) {
      console.warn('Print error:', err);
      if (allowFallback) {
        handleDirectSavePdf(false);
      } else {
        showToast('Print dialog failed. Please try Ctrl+P.');
      }
    }
  };

  return (
    <div
      id="printable-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible"
    >
      <div
        id="printable-modal-card"
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:rounded-none"
      >
        {/* Modal Top Control Bar (Hidden in Print) */}
        <div className="bg-[#273E56] text-white px-5 py-3 space-y-2.5 border-b-2 border-[#1D6CE0] print:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    border: '1.5px solid #CBD8E6',
                    backgroundColor: '#ffffff',
                    padding: '1.5px',
                    flexShrink: 0,
                  }}
                  className="w-8 h-8 rounded-full overflow-hidden border border-[#CBD8E6] bg-white p-0.5 shrink-0 flex items-center justify-center"
                >
                  <img
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
                <FileSpreadsheet className="w-4 h-4 text-sky-300 shrink-0" />
                <span className="font-bold text-sm tracking-wide truncate max-w-xs sm:max-w-md">{title}</span>
              </div>

              {/* Toggle 'Print All Pages' or 'Print Current Page Only' for Packing Lists */}
              {type === 'packing' && (
                <div className="flex items-center space-x-2 bg-[#1c2a33] px-2.5 py-1.5 rounded-lg border border-[#334b59]">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      data-testid="print-page-mode-toggle"
                      checked={printCurrentPageOnly}
                      onChange={(e) => {
                        setPrintCurrentPageOnly(e.target.checked);
                        setCurrentPage(1);
                      }}
                      className="rounded border-[#334b59] text-[#00897b] focus:ring-[#00897b] w-4 h-4 cursor-pointer accent-[#00897b]"
                    />
                    <span className={printCurrentPageOnly ? 'text-[#5eead4] font-bold' : 'text-slate-200'}>
                      {printCurrentPageOnly ? 'Print Current Page Only' : 'Print All Pages'}
                    </span>
                  </label>

                  {printCurrentPageOnly && totalPages > 1 && (
                    <div className="flex items-center space-x-1 pl-2 border-l border-[#334b59] text-xs">
                      <button
                        type="button"
                        data-testid="print-prev-page-btn"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2 py-0.5 rounded bg-[#273E56] hover:bg-[#334b59] disabled:opacity-40 text-white font-bold cursor-pointer"
                        title="Previous Page"
                      >
                        &larr;
                      </button>
                      <span className="font-mono font-bold text-[#5eead4] px-1">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        data-testid="print-next-page-btn"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2 py-0.5 rounded bg-[#273E56] hover:bg-[#334b59] disabled:opacity-40 text-white font-bold cursor-pointer"
                        title="Next Page"
                      >
                        &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={closePrintModal}
              aria-label="Close Preview"
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-[#1c2a33] transition cursor-pointer shrink-0"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Direct Save as PDF Button */}
              <button
                onClick={() => handleDirectSavePdf()}
                disabled={isSavingPdf || isSavingPng}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#00897b] hover:bg-[#00796b] text-white rounded text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
                title="Download high-resolution PDF file directly"
              >
                {isSavingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Save as PDF (.pdf)</span>
                  </>
                )}
              </button>

              {/* Direct Save as PNG Button */}
              <button
                onClick={handleDirectSavePng}
                disabled={isSavingPng || isSavingPdf}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1877d2] hover:bg-[#1465b5] text-white rounded text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
                title="Download high-resolution .PNG image file directly"
              >
                {isSavingPng ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating PNG...</span>
                  </>
                ) : (
                  <>
                    <ImageDown className="w-4 h-4" />
                    <span>Save as PNG (.png)</span>
                  </>
                )}
              </button>

              {/* Share via WeChat (微信) Button */}
              <button
                type="button"
                data-testid="print-share-wechat-btn"
                onClick={() => {
                  if (printAllSequence.isAutoPlaying) {
                    togglePrintAllAutoPlay(false);
                  }
                  setIsShareModalOpen(true);
                }}
                disabled={isSavingPng || isSavingPdf}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#07C160] hover:bg-[#06a853] text-white rounded text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
                title="Share .PNG image via WeChat (微信)"
              >
                <WeChatIcon className="w-4 h-4 text-white" />
                <span>WeChat (微信)</span>
              </button>

              {/* Print Document Button */}
              <button
                onClick={() => handleBrowserPrint()}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1c2a33] hover:bg-[#152028] text-white rounded border border-[#334b59] text-xs font-bold shadow transition cursor-pointer"
                title="Open browser print dialogue"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>

            {/* Configure Header & Footer Button */}
            <button
              type="button"
              data-testid="print-header-footer-toggle-btn"
              aria-expanded={showHeaderFooterConfig}
              onClick={() => setShowHeaderFooterConfig((prev) => !prev)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold shadow transition cursor-pointer border ${
                showHeaderFooterConfig || isHeaderFooterCustomized
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-300'
                  : 'bg-[#1c2a33] hover:bg-[#152028] text-white border-[#334b59]'
              }`}
              title="Customize printed document header, date, signatures, and footer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Header &amp; Footer</span>
            </button>
          </div>
        </div>

        {/* Collapsible Header & Footer Customization Drawer (Hidden in Print) */}
        {showHeaderFooterConfig && (
          <PrintHeaderFooterConfigPanel
            config={headerFooterConfig}
            onChange={handleHeaderFooterConfigChange}
          />
        )}

        {/* Sequential Print All Active Sheets Bar (Visible only during batch Print All sequence, hidden in print) */}
        {printAllSequence.isActive && sequenceProgress.currentSheet && (
          <div
            data-testid="print-all-sequence-bar"
            className="bg-[#1E3247] text-white px-4 py-2.5 border-b border-white/15 print:hidden space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-mono font-bold">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span data-testid="print-all-progress-badge">
                    Sheet {sequenceProgress.currentStep} of {sequenceProgress.totalSteps}
                  </span>
                </div>

                <div className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                  <span className="font-mono text-sky-300 mr-1.5">
                    #{sequenceProgress.currentSheet.num}
                  </span>
                  <span>{sequenceProgress.currentSheet.label}</span>
                </div>

                <span
                  data-testid="print-all-status-pill"
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    printAllSequence.completedAll && sequenceProgress.isLast
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : printAllSequence.isAutoPlaying
                      ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                      : 'bg-slate-600/40 border-white/20 text-slate-200'
                  }`}
                >
                  {printAllSequence.completedAll && sequenceProgress.isLast
                    ? `Completed (${sequenceProgress.triggeredCount}/${sequenceProgress.totalSteps})`
                    : printAllSequence.isAutoPlaying
                    ? `Auto-Advancing (${sequenceProgress.triggeredCount}/${sequenceProgress.totalSteps})`
                    : `Paused (${sequenceProgress.triggeredCount}/${sequenceProgress.totalSteps})`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  aria-label="Jump to Active Sheet in Print All Sequence"
                  data-testid="print-all-sheet-jump-select"
                  value={printAllSequence.currentIndex}
                  onChange={(e) => jumpToPrintAllSheet(Number(e.target.value))}
                  className="bg-white text-slate-900 border border-[#CBD8E6] rounded-md px-2 py-1 text-[11px] font-mono font-bold focus:outline-none focus:border-[#1D6CE0] cursor-pointer max-w-[190px]"
                >
                  {printAllSequence.queue.map((sheetItem, idx) => (
                    <option key={sheetItem.id} value={idx}>
                      #{sheetItem.num} {sheetItem.shortLabel || sheetItem.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  data-testid="print-all-prev-btn"
                  aria-label="Previous Active Sheet"
                  onClick={prevPrintAllSheet}
                  disabled={!sequenceProgress.canStepBack}
                  className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-full shadow-2xs transition cursor-pointer disabled:opacity-45"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                {!sequenceProgress.isLast && (
                  <button
                    type="button"
                    data-testid="print-all-autoplay-toggle-btn"
                    aria-label={
                      printAllSequence.isAutoPlaying
                        ? 'Pause Sequential Print Preview'
                        : 'Resume Sequential Print Preview'
                    }
                    onClick={() => togglePrintAllAutoPlay()}
                    className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-full shadow-2xs transition cursor-pointer"
                  >
                    {printAllSequence.isAutoPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Auto-Play</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  data-testid="print-all-next-btn"
                  aria-label={
                    sequenceProgress.isLast
                      ? 'Finish Print All Active Sheets'
                      : 'Next Active Sheet'
                  }
                  onClick={nextPrintAllSheet}
                  className="flex items-center space-x-1 px-3 py-1 text-[11px] font-bold rounded-full shadow-2xs transition cursor-pointer"
                >
                  <span>{sequenceProgress.isLast ? 'Finish & Close' : 'Next Sheet'}</span>
                  {sequenceProgress.isLast ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  data-testid="print-all-stop-btn"
                  aria-label="Stop Print All Sequence"
                  onClick={() =>
                    stopPrintAllActiveSheets({
                      closeModal: true,
                      restoreOriginTab: true,
                      reason: printAllSequence.completedAll ? 'completed' : 'stopped',
                    })
                  }
                  className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-full shadow-2xs transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              </div>
            </div>

            <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
              <div
                data-testid="print-all-progress-bar"
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${sequenceProgress.percentComplete}%` }}
              />
            </div>
          </div>
        )}

        {/* Preview Paper Desk Workspace */}
        <div className="bg-slate-200/95 p-3 sm:p-6 overflow-y-auto flex justify-center items-start flex-1 min-h-0 print:p-0 print:bg-white">
          {/* Printable Voucher Paper Content (A4 Portrait Printable Width: 760px / 190mm) */}
          <div
            id="printable-document"
            className="zsb-print-paper relative w-full max-w-[760px] bg-white shadow-2xl rounded-sm border border-slate-300 p-5 sm:p-7 space-y-5 text-slate-900 print:shadow-none overflow-hidden"
            style={{ backgroundColor: '#ffffff', color: '#000000', position: 'relative' }}
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
                src={resolvedLogoSrc}
                alt=""
                style={{
                  width: '340px',
                  height: '340px',
                  objectFit: 'contain',
                  borderRadius: '9999px',
                }}
              />
            </div>

            {/* Official Document Header (Configurable via Header & Footer settings; skipped for exporter_payment_slip and batch_payment_slips which have custom headers) */}
            {type !== 'exporter_payment_slip' &&
              type !== 'batch_payment_slips' &&
              headerFooterConfig.showHeader && (
                <div
                  data-testid="print-doc-header"
                  style={{ borderBottom: '2px solid #0f172a', position: 'relative', zIndex: 10 }}
                  className="pb-3.5 text-center space-y-1 relative z-10"
                >
                  {/* Official Company Logo Emblem + Golden 3D Text Header */}
                  {headerFooterConfig.showCompanyName && (
                    <div
                      data-testid="print-doc-company-name"
                      className="flex items-center justify-center gap-3.5 mb-1"
                    >
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
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shadow-xs flex items-center justify-center shrink-0"
                      >
                        <img
                          data-testid="print-preview-company-logo"
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

                      {/* Golden 3D Company Name */}
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
                  )}

                  {/* Address & Contact strictly in font BLACK color */}
                  {headerFooterConfig.showCompanyContact && (
                    <div data-testid="print-doc-company-contact" className="space-y-1">
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
                    </div>
                  )}

                  <div
                    style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                    className="inline-block mt-2 px-5 py-1.5 rounded text-xs font-bold tracking-widest uppercase shadow-sm"
                  >
                    {type === 'purchase'
                      ? 'PURCHASE DATA ENTRY FORM (LIVE CRABS, EEL FISH & CHILLED FISH GRADES) — CHALLAN / BILL'
                      : type === 'packing'
                      ? 'EXPORT AIR PACKING LIST MANIFEST'
                      : type === 'air_way_bill'
                      ? data?.documentBadge ||
                        `FLIGHT RETURN BILL — MONTHLY STATEMENT (${data?.monthLabel || 'ALL MONTHS'})`
                      : type === 'payment'
                      ? data?.paymentCategory === 'exporter'
                        ? 'EXPORTER PAYMENT & RMB SETTLEMENT VOUCHER'
                        : data?.paymentCategory === 'supplier'
                        ? 'SUPPLIER PAYMENT VOUCHER'
                        : 'SUPPLIER & EXPORTER PAYMENT VOUCHER'
                      : type === 'monthly_statement'
                      ? 'MONTHLY BUSINESS & FINANCIAL STATEMENT REPORT'
                      : type === 'profit_loss'
                      ? data?.isSingleExpenseVoucher || (!data?.summary && data?.category)
                        ? 'OPERATIONAL EXPENSE & COSTING VOUCHER'
                        : 'LOSS & PROFIT STATEMENT'
                      : type === 'mortality_report'
                      ? `MONTHLY INVENTORY MORTALITY & STOCK LOSS REPORT (${data?.monthLabel || 'CURRENT MONTH'})`
                      : type === 'global_view_table'
                      ? data?.documentBadge || 'OFFICIAL VIEW TABLE REPORT'
                      : 'CONSOLIDATED FINANCIAL STATEMENT REPORT'}
                  </div>

                  {/* Optional Custom Header Note & Print Date Strip */}
                  {(headerFooterConfig.showDate ||
                    headerFooterConfig.customHeaderText.trim() !== '') && (
                    <div
                      data-testid="print-doc-custom-header-bar"
                      style={{ color: '#334155' }}
                      className="pt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold"
                    >
                      {headerFooterConfig.customHeaderText.trim() !== '' && (
                        <span
                          data-testid="print-doc-custom-header"
                          style={{ color: '#0f172a' }}
                          className="font-bold tracking-wide"
                        >
                          {headerFooterConfig.customHeaderText.trim()}
                        </span>
                      )}
                      {headerFooterConfig.showDate && (
                        <span
                          data-testid="print-doc-header-date"
                          className="font-mono font-bold text-slate-700"
                        >
                          Printed: {formattedPrintDate}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Type 1: Purchase Challan */}
            {type === 'purchase' && data && (
              <div className="space-y-4">
                <div
                  style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 rounded border"
                >
                <div>
                  <span className="text-slate-500 block">INVOICE NO:</span>
                  <span className="font-mono font-black text-slate-900 text-sm">{data.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DATE:</span>
                  <span className="font-semibold text-slate-800">{formatDate(data.date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SUPPLIER:</span>
                  <span className="font-black text-slate-900">{data.description}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">CONTACT:</span>
                  <span className="font-mono text-slate-800">{data.contactNumber || '-'}</span>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px] border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 text-center w-12">SL</th>
                    <th className="p-2 border-r border-slate-300 text-left">ITEM / GRADE</th>
                    <th className="p-2 border-r border-slate-300 text-right w-28">QUANTITY</th>
                    <th className="p-2 border-r border-slate-300 text-right w-32">RATE ({companyProfile.currency})</th>
                    <th className="p-2 text-right w-40">TOTAL AMOUNT ({companyProfile.currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items && items.length > 0 ? (
                    items.map((row: any, i: number) => (
                      <tr key={i} className="font-medium">
                        <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                          <span className="zsb-sl-badge">{String(i + 1).padStart(2, '0')}</span>
                        </td>
                        <td className="p-2 border-r border-slate-200 font-bold">{row.item}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono tabular-nums whitespace-nowrap">{row.quantity}</td>
                        <td className={`p-2 border-r border-slate-200 text-right font-mono tabular-nums whitespace-nowrap ${(Number(row.rate) || 0) < 0 ? 'text-rose-700' : ''}`}>
                          {formatCurrency(row.rate, '')}
                        </td>
                        <td className={`p-2 text-right font-mono font-bold tabular-nums whitespace-nowrap ${(Number(row.totalAmount) || 0) < 0 ? 'text-rose-700' : ''}`}>
                          {formatCurrency(row.totalAmount, '')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        No rows selected.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={2} className="p-2 text-right uppercase whitespace-nowrap">TOTAL QUANTITY:</td>
                    <td className="p-2 text-right font-mono tabular-nums text-blue-900 border-r border-slate-300 whitespace-nowrap">{data.totalQty}</td>
                    <td className="p-2 text-right uppercase border-r border-slate-300 whitespace-nowrap">BILL TOTAL:</td>
                    <td className={`p-2 text-right font-mono tabular-nums font-black whitespace-nowrap ${(Number(data.totalAmount) || 0) < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                      {formatCurrency(data.totalAmount, companyProfile.currency)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold text-[11px]">
                    <td colSpan={4} className="p-2 text-right text-slate-600 border-r border-slate-200">PREVIOUS BALANCE (BROUGHT FORWARD):</td>
                    <td className="p-2 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {formatCurrency(data.previousAmount, companyProfile.currency)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold text-[11px]">
                    <td colSpan={4} className="p-2 text-right text-slate-600 border-r border-slate-200">LESS: PAID AMOUNT (TODAY):</td>
                    <td className="p-2 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                      - {formatCurrency(data.paidAmount, companyProfile.currency)}
                    </td>
                  </tr>
                  <tr className="bg-slate-200 font-black text-xs border-t border-slate-400">
                    <td colSpan={4} className="p-2 text-right uppercase text-slate-900 border-r border-slate-300">NET CLOSING BALANCE:</td>
                    <td className="p-2 text-right font-mono tabular-nums text-rose-700 text-sm whitespace-nowrap">
                      {formatCurrency(data.balance, companyProfile.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {data.remarks && (
                <div className="text-xs p-2.5 bg-slate-50 rounded border border-slate-200">
                  <strong className="text-slate-700">Remarks:</strong> {data.remarks}
                </div>
              )}
            </div>
          )}

          {/* Type 2: Packing List */}
          {type === 'packing' && data && (
            <div className="space-y-4">
              {/* Manifest Metadata Box (2 rows: 3 items top row, 2 items bottom row, Shipper removed) */}
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-lg border-2 border-slate-300">
                {/* Row 1: Packing No, Shipment Date, Shipping Mark */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }} className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-0.5">PACKING NO:</span>
                    <span className="font-mono font-black text-slate-900 text-lg block">{data.invoiceNumber || '-'}</span>
                  </div>
                  <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">SHIPMENT DATE:</span>
                    <span className="font-mono font-black text-slate-950 text-2xl tracking-wide block">{formatDate(data.packingDate)}</span>
                  </div>
                  <div className="bg-blue-50/80 p-2.5 rounded border border-blue-200">
                    <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider block mb-0.5">SHIPPING MARK:</span>
                    <span className="font-black text-blue-950 text-2xl tracking-wide block">{data.shippingMark || '-'}</span>
                  </div>
                </div>

                {/* Row 2: Flight Destination, Destination, and optional Documents Holder */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: data.documentsHolder
                      ? 'repeat(3, minmax(0, 1fr))'
                      : 'repeat(2, minmax(0, 1fr))',
                    gap: '12px',
                  }}
                  className={data.documentsHolder ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}
                >
                  <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">FLIGHT DESTINATION:</span>
                    <span className="font-black text-slate-950 text-2xl tracking-wide block">{data.flight || '-'}</span>
                  </div>
                  <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">DESTINATION:</span>
                    <span className="font-black text-slate-950 text-2xl tracking-wide block">{data.destination || '-'}</span>
                  </div>
                  {data.documentsHolder && (
                    <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">DOCUMENTS HOLDER:</span>
                      <span className="font-black text-slate-950 text-xl tracking-wide block truncate">{data.documentsHolder}</span>
                    </div>
                  )}
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300 border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '15%' }} />
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
                  {displayPackingItems && displayPackingItems.length > 0 ? (
                    displayPackingItems.map((row: any, i: number) => {
                      const absoluteIndex = printCurrentPageOnly ? (currentPage - 1) * ITEMS_PER_PAGE + i : i;
                      const hasReportWt = (Number(row.reportWeight) || 0) > 0;
                      return (
                        <tr key={i} className="font-medium">
                          <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                            <span className="zsb-sl-badge">{String(absoluteIndex + 1).padStart(2, '0')}</span>
                          </td>
                          <td className="p-2 border-r border-slate-200 font-bold">{row.item}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono">{row.box}</td>
                          <td
                            className={`p-2 border-r border-slate-200 text-center font-mono ${
                              hasReportWt ? 'text-slate-400 line-through' : ''
                            }`}
                          >
                            {row.weight}
                          </td>
                          <td
                            className={`p-2 border-r border-slate-200 text-center font-mono ${
                              hasReportWt ? 'font-bold text-emerald-800' : 'text-slate-400'
                            }`}
                          >
                            {hasReportWt ? row.reportWeight : '-'}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-teal-800">
                            {row.totalWeight} KG
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold text-[10px]">
                            {row.unit || 'KG'}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono">
                            {formatCurrency(row.rate, '')}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(row.amount, '')}
                          </td>
                        </tr>
                      );
                    })
                  ) : null}
                </tbody>
                <tfoot>
                  {printCurrentPageOnly && totalPages > 1 && (
                    <tr className="bg-blue-50/70 font-bold border-t border-slate-300 text-[11px] text-blue-900">
                      <td colSpan={2} className="p-2 text-right uppercase">
                        PAGE {currentPage} SUBTOTAL ({displayPackingItems.length} items):
                      </td>
                      <td className="p-2 text-center font-mono">
                        {displayPackingItems.reduce((s: number, r: any) => s + (Number(r.box) || 0), 0)} Boxes
                      </td>
                      <td colSpan={2}></td>
                      <td className="p-2 text-right font-mono text-teal-800 font-bold">
                        {displayPackingItems
                          .reduce(
                            (s: number, r: any) =>
                              s +
                              (Number(r.totalWeight) ||
                                ((Number(r.reportWeight) || 0) > 0
                                  ? Number(r.reportWeight)
                                  : Number(r.weight)) *
                                  Number(r.box) ||
                                0),
                            0
                          )
                          .toFixed(2)}{' '}
                        KG
                      </td>
                      <td colSpan={2} className="p-2 text-right uppercase whitespace-nowrap">
                        SUBTOTAL:
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-blue-950 whitespace-nowrap tabular-nums">
                        {formatCurrency(
                          displayPackingItems.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0),
                          'RMB'
                        )}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={2} className="p-2 text-right uppercase whitespace-nowrap">
                      {printCurrentPageOnly ? 'GRAND TOTAL:' : 'TOTALS:'}
                    </td>
                    <td className="p-2 text-center font-mono text-slate-900 whitespace-nowrap tabular-nums">{data.totalBox} Boxes</td>
                    <td colSpan={2}></td>
                    <td className="p-2 text-right font-mono text-teal-800 font-black whitespace-nowrap tabular-nums">{data.totalWeight} KG</td>
                    <td colSpan={2} className="p-2 text-right uppercase whitespace-nowrap">TOTAL VALUE:</td>
                    <td className="p-2 text-right font-mono font-black text-slate-900 whitespace-nowrap tabular-nums">
                      {formatCurrency(data.totalAmount, 'RMB')}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {data.remarks && (
                <div className="text-xs p-2.5 bg-slate-50 rounded border border-slate-200">
                  <strong className="text-slate-700">Flight &amp; Handling Remarks:</strong> {data.remarks}
                </div>
              )}
            </div>
          )}

          {/* Type 2B: Air Way Bill Monthly Statement (A4 Portrait Optimized Column Widths & Print Area) */}
          {type === 'air_way_bill' && data && (
            <div className="space-y-3" data-testid="printable-air-way-bill">
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
                  {(data.rows || []).map((row: any, idx: number) => (
                    <tr
                      key={row.id || idx}
                      style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    >
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
                        {row.totalRmb !== 0
                          ? row.totalRmb.toLocaleString('en-US', {
                              minimumFractionDigits: row.totalRmb % 1 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            })
                          : ''}
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
                        {row.bdtAmount !== 0
                          ? row.bdtAmount.toLocaleString('en-US', {
                              minimumFractionDigits: row.bdtAmount % 1 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            })
                          : row.totalRmb !== 0 && row.rateSpecified
                          ? '0'
                          : ''}
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
                      data-testid="print-awb-grand-total-box"
                      style={{
                        backgroundColor: '#ffffff',
                        color: (data.totals?.totalBoxes || 0) < 0 ? '#be123c' : '#000000',
                        border: '1.5px solid #000000',
                        height: '29px',
                      }}
                      className="py-1 px-1.5 text-center font-mono font-black text-[11px] tabular-nums"
                    >
                      {(Object.is(data.totals?.totalBoxes, -0)
                        ? 0
                        : data.totals?.totalBoxes || 0
                      ).toLocaleString('en-US', {
                        minimumFractionDigits: Number.isInteger(data.totals?.totalBoxes || 0) ? 0 : 2,
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
                      data-testid="print-awb-grand-total-bdt"
                      style={{
                        backgroundColor: '#ffffff',
                        color: (data.totals?.totalAmountBDT || 0) < 0 ? '#be123c' : '#000000',
                        border: '1.5px solid #000000',
                        height: '29px',
                      }}
                      className="py-1 px-1.5 text-center font-mono font-black text-[11px] tabular-nums"
                    >
                      {(Object.is(data.totals?.totalAmountBDT, -0)
                        ? 0
                        : data.totals?.totalAmountBDT || 0
                      ).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Type 3: Payment Voucher */}
          {type === 'payment' && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500 block">VOUCHER NO:</span>
                  <span className="font-mono font-black text-slate-900 text-sm">{data.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DATE:</span>
                  <span className="font-semibold text-slate-800">{formatDate(data.date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    {data.paymentCategory === 'exporter' ? 'EXPORTER / MARK:' : 'SUPPLIER / PARTY:'}
                  </span>
                  <span className="font-black text-purple-900">{data.description}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    {data.paymentCategory === 'supplier' ? 'CONTACT NO:' : 'EXPORTER STATUS:'}
                  </span>
                  <span className="font-bold text-slate-800 font-mono">
                    {data.paymentCategory === 'supplier'
                      ? data.contactNumber || 'PAID'
                      : data.status}
                  </span>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px] border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 text-center w-12">SL</th>
                    <th className="p-2 border-r border-slate-300 text-left">PARTICULARS</th>
                    <th className="p-2 border-r border-slate-300 text-right w-28">
                      DEBIT ({data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency})
                    </th>
                    <th className="p-2 border-r border-slate-300 text-right w-28">
                      CREDIT ({data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency})
                    </th>
                    <th
                      className={`p-2 text-right w-28 ${
                        data.paymentCategory === 'exporter' ? 'border-r border-slate-300' : ''
                      }`}
                    >
                      BALANCE ({data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency})
                    </th>
                    {data.paymentCategory === 'exporter' && (
                      <th className="p-2 text-center w-28">STATUS</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items && items.length > 0 ? (
                    items.map((row: any, i: number) => (
                      <tr key={i} className="font-medium">
                        <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                          <span className="zsb-sl-badge">{String(i + 1).padStart(2, '0')}</span>
                        </td>
                        <td className="p-2 border-r border-slate-200">{row.description}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono">
                          {formatCurrency(row.debitAmount, '')}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono">
                          {formatCurrency(row.creditAmount, '')}
                        </td>
                        <td
                          className={`p-2 text-right font-mono font-bold ${
                            data.paymentCategory === 'exporter' ? 'border-r border-slate-200' : ''
                          }`}
                        >
                          {formatCurrency(row.balance, '')}
                        </td>
                        {data.paymentCategory === 'exporter' && (
                          <td className="p-2 text-center font-bold uppercase text-[10px]">
                            {row.status || data.status || 'REPORT'}
                          </td>
                        )}
                      </tr>
                    ))
                  ) : null}
                </tbody>
                <tfoot>
                  {(() => {
                    const rowDebitSum = Array.isArray(items)
                      ? items.reduce((s: number, r: any) => s + (Number(r.debitAmount) || 0), 0)
                      : 0;
                    const rowCreditSum = Array.isArray(items)
                      ? items.reduce((s: number, r: any) => s + (Number(r.creditAmount) || 0), 0)
                      : 0;
                    const displayDebit = Number(data.totalAmount) || rowDebitSum || 0;
                    const displayCredit = Number(data.paidAmount) || rowCreditSum || 0;
                    const displayBalance =
                      Number(data.balance) !== 0
                        ? Number(data.balance)
                        : Math.round((displayDebit - displayCredit) * 100) / 100;
                    const unit = data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency;
                    return (
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                        <td colSpan={2} className="p-2 text-right uppercase">TOTAL VOUCHER:</td>
                        <td className="p-2 text-right font-mono font-black">
                          {formatCurrency(displayDebit, unit)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-800">
                          {formatCurrency(displayCredit, unit)}
                        </td>
                        <td className="p-2 text-right font-mono text-purple-900 font-black">
                          {formatCurrency(displayBalance, unit)}
                        </td>
                        {data.paymentCategory === 'exporter' && (
                          <td className="p-2 text-center font-bold uppercase text-[10px]">
                            {data.status || 'REPORT'}
                          </td>
                        )}
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          )}

          {/* Type 4: Monthly Statement or Batch Print */}
          {(type === 'monthly_statement' || type === 'batch_print') && data && (() => {
            const fallbackMergedRecords = [
              ...(Array.isArray(data.purchases)
                ? data.purchases.map((p: any) => ({
                    ...p,
                    _kind: 'Purchase',
                    kind: 'purchase',
                    invoiceNumber: p.invoiceNumber,
                    date: p.date,
                    description: p.description,
                    secondaryInfo: `${p.items?.length || 0} line items (${p.totalQty || 0} KG)`,
                    totalAmountBDT: Number(p.totalAmount) || 0,
                    status: Number(p.balance) <= 0 ? 'PAID IN FULL' : `DUE: ${p.balance}`,
                  }))
                : []),
              ...(Array.isArray(data.packings)
                ? data.packings.map((pkg: any) => {
                    const rate = Number(pkg.rmbRate) || Number(companyProfile.rmbExchangeRate) || 16.5;
                    const bdt =
                      Number(pkg.totalAmountBDT) ||
                      Math.round((Number(pkg.totalAmount) || 0) * rate * 100) / 100;
                    return {
                      ...pkg,
                      _kind: 'Packing',
                      kind: 'packing',
                      invoiceNumber: pkg.invoiceNumber,
                      date: pkg.packingDate || pkg.date,
                      description: pkg.shippingMark || pkg.shipper || 'Export Cargo',
                      secondaryInfo: `${pkg.flight || 'Flight'} → ${pkg.destination || 'Dest'} (${pkg.totalBox || 0} boxes)`,
                      totalAmountBDT: bdt,
                      amountRMB: Number(pkg.totalAmount) || 0,
                      status: pkg.paymentStatus || pkg.exporterStatus || 'NO REPORT',
                    };
                  })
                : []),
              ...(Array.isArray(data.payments)
                ? data.payments.map((pm: any) => ({
                    ...pm,
                    _kind: 'Payment',
                    kind: 'payment',
                    invoiceNumber: pm.invoiceNumber,
                    date: pm.date,
                    description: pm.description || 'Party Voucher',
                    secondaryInfo: pm.exportGoodsRef
                      ? `Ref: ${pm.exportGoodsRef}`
                      : `${pm.items?.length || 0} allocation rows`,
                    totalAmountBDT: Number(pm.paidAmount) || Number(pm.totalAmount) || 0,
                    status: pm.status || 'PAID',
                  }))
                : []),
              ...(Array.isArray(data.otherCosts)
                ? data.otherCosts.map((c: any) => ({
                    ...c,
                    _kind: 'OtherCost',
                    kind: 'other_cost',
                    invoiceNumber: c.refInvoice || 'EXPENSE',
                    date: c.date,
                    description: c.category || 'Operational Cost',
                    secondaryInfo: c.description || 'Operational overhead',
                    totalAmount: Number(c.amount) || 0,
                    totalAmountBDT: Number(c.amount) || 0,
                    status: 'DISBURSED',
                  }))
                : []),
            ];

            const resolvedRecords: any[] =
              Array.isArray(data.records) && data.records.length > 0
                ? data.records
                : fallbackMergedRecords;

            const isConsolidatedStatement = Boolean(
              data.summary ||
                data.dbType === 'filtered_multi' ||
                data.dbType === 'monthly_statement' ||
                data.totalPurchases !== undefined ||
                data.totalExport !== undefined
            );

            const summaryPurchasesBDT =
              data.summary?.totalPurchasesBDT ??
              data.totalPurchases ??
              resolvedRecords
                .filter((r) => r._kind === 'Purchase' || r.kind === 'purchase')
                .reduce((s, r) => s + (Number(r.totalAmountBDT ?? r.totalAmount) || 0), 0);

            const summaryExportRMB =
              data.summary?.totalExportRMB ??
              data.totalExport ??
              resolvedRecords
                .filter((r) => r._kind === 'Packing' || r.kind === 'packing')
                .reduce((s, r) => s + (Number(r.amountRMB ?? r.totalAmount) || 0), 0);

            const summaryExportBDT =
              data.summary?.totalExportBDT ??
              data.totalExportBDT ??
              Math.round(summaryExportRMB * (Number(companyProfile.rmbExchangeRate) || 16.5) * 100) /
                100;

            const summaryWeightKG =
              data.summary?.totalExportWeightKG ??
              data.totalWeight ??
              resolvedRecords.reduce((s, r) => s + (Number(r.totalWeight) || 0), 0);

            const summaryPaymentsBDT =
              data.summary?.totalPaymentsBDT ??
              data.totalPayments ??
              resolvedRecords
                .filter((r) => r._kind === 'Payment' || r.kind === 'payment')
                .reduce((s, r) => s + (Number(r.totalAmountBDT ?? r.paidAmount ?? r.totalAmount) || 0), 0);

            const summaryOtherCostsBDT =
              data.summary?.totalOtherCostsBDT ??
              data.totalOtherCosts ??
              resolvedRecords
                .filter((r) => r._kind === 'OtherCost' || r.kind === 'other_cost')
                .reduce((s, r) => s + (Number(r.totalAmountBDT ?? r.amount ?? r.totalAmount) || 0), 0);

            const summaryNetMarginBDT =
              data.summary?.netOperatingMarginBDT ??
              data.netOperatingMarginBDT ??
              summaryExportBDT - summaryPurchasesBDT - summaryOtherCostsBDT;

            const grandTotalAmount = resolvedRecords.reduce((sum, rec) => {
              const amt =
                Number(
                  rec.totalAmountBDT ??
                    rec.totalAmount ??
                    rec.paidAmount ??
                    rec.amount ??
                    0
                ) || 0;
              return sum + amt;
            }, 0);

            const grandTotalWeightOrQty = resolvedRecords.reduce((sum, rec) => {
              const w = Number(rec.totalWeight || rec.totalQty || 0) || 0;
              return sum + w;
            }, 0);

            return (
              <div className="space-y-4" data-testid="printable-monthly-statement-report">
                {/* Statement Metadata Bar */}
                <div className="p-3 bg-slate-50 rounded border border-slate-300 text-xs flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <span className="font-bold text-slate-800 uppercase">
                      Statement Period / Selection:
                    </span>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {data.periodLabel || data.party || data.statementMonth || title}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {data.date && (
                      <div>
                        <span className="font-bold text-slate-700">Date:</span>{' '}
                        <span className="font-mono text-slate-900">{formatDate(data.date)}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-800 uppercase">Total Entries:</span>{' '}
                      <span
                        data-testid="statement-report-total-entries"
                        className="font-mono text-slate-950 font-black"
                      >
                        {resolvedRecords.length} Records
                      </span>
                    </div>
                  </div>
                </div>

                {/* Consolidated Executive Summary Cards (shown for Consolidated / Monthly Statements) */}
                {isConsolidatedStatement && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div className="p-2.5 rounded border border-blue-200 bg-blue-50/60">
                      <div className="text-[10px] font-bold uppercase text-blue-900">
                        Purchases ({companyProfile.currency})
                      </div>
                      <div className="font-mono font-black text-blue-800 text-xs mt-0.5">
                        {formatCurrency(summaryPurchasesBDT, companyProfile.currency)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded border border-teal-200 bg-teal-50/60">
                      <div className="text-[10px] font-bold uppercase text-teal-900">
                        Export Cargo ({companyProfile.currency})
                      </div>
                      <div className="font-mono font-black text-teal-800 text-xs mt-0.5">
                        {formatCurrency(summaryExportBDT, companyProfile.currency)}
                      </div>
                      <div className="text-[10px] font-mono text-amber-800 font-bold">
                        ¥{summaryExportRMB.toLocaleString()} RMB
                      </div>
                    </div>

                    <div className="p-2.5 rounded border border-amber-200 bg-amber-50/60">
                      <div className="text-[10px] font-bold uppercase text-amber-900">
                        Export Volume
                      </div>
                      <div className="font-mono font-black text-amber-800 text-xs mt-0.5">
                        {summaryWeightKG.toLocaleString()} KG
                      </div>
                    </div>

                    <div className="p-2.5 rounded border border-purple-200 bg-purple-50/60">
                      <div className="text-[10px] font-bold uppercase text-purple-900">
                        Payments Disbursed
                      </div>
                      <div className="font-mono font-black text-purple-800 text-xs mt-0.5">
                        {formatCurrency(summaryPaymentsBDT, companyProfile.currency)}
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded border ${
                        summaryNetMarginBDT >= 0
                          ? 'border-emerald-300 bg-emerald-50/60'
                          : 'border-rose-300 bg-rose-50/60'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase text-slate-800">
                        Net Operating Margin
                      </div>
                      <div
                        className={`font-mono font-black text-xs mt-0.5 ${
                          summaryNetMarginBDT >= 0 ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {formatCurrency(summaryNetMarginBDT, companyProfile.currency)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-600">
                        Costs: {formatCurrency(summaryOtherCostsBDT, companyProfile.currency)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Statement Records Table */}
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[10px] border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300 text-center w-10">SL</th>
                      <th className="p-2 border-r border-slate-300 text-left">DOC / REF NO</th>
                      <th className="p-2 border-r border-slate-300 text-center">DATE</th>
                      {isConsolidatedStatement && (
                        <th className="p-2 border-r border-slate-300 text-center">TYPE</th>
                      )}
                      <th className="p-2 border-r border-slate-300 text-left">PARTY / MARK</th>
                      <th className="p-2 border-r border-slate-300 text-right">WEIGHT / QTY</th>
                      <th className="p-2 border-r border-slate-300 text-right">
                        AMOUNT ({companyProfile.currency})
                      </th>
                      <th className="p-2 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {resolvedRecords.length > 0 ? (
                      resolvedRecords.map((rec: any, idx: number) => {
                        const rowDocNo = rec.invoiceNumber || rec.refInvoice || '-';
                        const rowDate = rec.date || rec.packingDate || '';
                        const rowParty =
                          rec.description || rec.shippingMark || rec.category || '-';
                        const rowType =
                          rec._kind === 'Packing' || rec.kind === 'packing'
                            ? 'EXPORT CARGO'
                            : rec._kind === 'Purchase' || rec.kind === 'purchase'
                            ? 'PURCHASE'
                            : rec._kind === 'Payment' || rec.kind === 'payment'
                            ? 'PAYMENT'
                            : rec._kind === 'OtherCost' || rec.kind === 'other_cost'
                            ? 'OTHER COST'
                            : rec.paymentCategory
                            ? String(rec.paymentCategory).toUpperCase()
                            : 'RECORD';
                        const rowWeightQty = rec.totalWeight
                          ? `${rec.totalWeight} KG`
                          : rec.totalQty
                          ? `${rec.totalQty} KG`
                          : rec.secondaryInfo || '-';
                        const rowAmount =
                          Number(
                            rec.totalAmountBDT ??
                              rec.totalAmount ??
                              rec.paidAmount ??
                              rec.amount ??
                              0
                          ) || 0;
                        const rowStatus =
                          rec.status ||
                          rec.paymentStatus ||
                          rec.exporterStatus ||
                          (rec.balance !== undefined
                            ? Number(rec.balance) <= 0
                              ? 'PAID'
                              : `DUE: ${rec.balance}`
                            : 'RECORDED');

                        return (
                          <tr key={rec.id || idx} className="font-medium">
                            <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                              <span className="zsb-sl-badge">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                            </td>
                            <td className="p-2 border-r border-slate-200 font-mono font-bold">
                              {rowDocNo}
                            </td>
                            <td className="p-2 border-r border-slate-200 font-mono text-center whitespace-nowrap">
                              {rowDate ? formatDate(rowDate) : '-'}
                            </td>
                            {isConsolidatedStatement && (
                              <td className="p-2 border-r border-slate-200 text-center font-bold text-[10px] whitespace-nowrap">
                                {rowType}
                              </td>
                            )}
                            <td className="p-2 border-r border-slate-200 font-semibold">
                              <div>{rowParty}</div>
                              {rec.secondaryInfo && (rec.totalWeight || rec.totalQty) && (
                                <div className="text-[10px] text-slate-500 font-normal">
                                  {rec.secondaryInfo}
                                </div>
                              )}
                            </td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">
                              <div>{rowWeightQty}</div>
                              {rec.amountRMB !== undefined && Number(rec.amountRMB) > 0 && (
                                <div className="text-[10px] text-amber-800 font-bold">
                                  ¥{Number(rec.amountRMB).toLocaleString()} RMB
                                </div>
                              )}
                            </td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                              {formatCurrency(rowAmount, '')}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-[10px] uppercase">
                              {rowStatus}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={isConsolidatedStatement ? 8 : 7}
                          className="p-6 text-center text-slate-500 font-medium"
                        >
                          No financial transactions recorded in the selected statement period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {resolvedRecords.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-400 text-xs">
                        <td
                          colSpan={isConsolidatedStatement ? 5 : 4}
                          className="p-2 text-right uppercase border-r border-slate-300"
                        >
                          STATEMENT GRAND TOTAL ({resolvedRecords.length} RECORDS):
                        </td>
                        <td className="p-2 text-right font-mono border-r border-slate-300 text-teal-900">
                          {grandTotalWeightOrQty > 0
                            ? `${grandTotalWeightOrQty.toLocaleString()} KG`
                            : '-'}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-950 border-r border-slate-300">
                          {formatCurrency(grandTotalAmount, companyProfile.currency)}
                        </td>
                        <td className="p-2 text-center font-mono text-[10px] text-emerald-800 uppercase">
                          VERIFIED
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            );
          })()}

          {/* Type 4B: Batch Payment Slips Combined Export */}
          {type === 'batch_payment_slips' && data?.records && (
            <div className="space-y-8" data-testid="batch-payment-slips-preview">
              <div className="p-3 bg-purple-50 rounded border border-purple-200 text-xs flex flex-wrap justify-between items-center gap-2 print:hidden">
                <div>
                  <span className="font-bold text-purple-950 uppercase">
                    Batch Payment Slips Combined Export:
                  </span>{' '}
                  <span className="font-mono text-purple-900 font-black">
                    {data.records.length} Payment Documents
                  </span>
                </div>
                <div className="text-[11px] text-purple-800">
                  Each selected voucher is exported on an independent page with full ledger &amp; signature blocks.
                </div>
              </div>

              {data.records.map((pm: PaymentRecord, idx: number) => (
                <div key={pm.id || idx} className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 print:hidden">
                    <span className="uppercase tracking-wider">
                      Slip {idx + 1} of {data.records.length}
                    </span>
                    <span className="font-mono text-purple-900 font-bold">{pm.invoiceNumber}</span>
                  </div>
                  <PaymentSlipPrintCard
                    id={`batch-modal-slip-${idx}`}
                    payment={pm}
                    companyProfile={companyProfile}
                    pageNumber={idx + 1}
                    totalPages={data.records.length}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Type 5: Profit & Loss Statement & Daily Report Details (or Single Operational Expense Voucher) */}
          {type === 'profit_loss' && data && (
            <div className="space-y-4 text-xs" data-testid="printable-profit-loss-report">
              {data.isSingleExpenseVoucher || (!data.summary && (data.category || data.amount !== undefined)) ? (
                <div className="space-y-4" data-testid="printable-expense-voucher">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-300">
                    <div>
                      <span className="text-slate-500 block">REF / INVOICE NO:</span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {data.refInvoice || 'EXPENSE'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">DATE:</span>
                      <span className="font-semibold text-slate-800">
                        {data.date ? formatDate(data.date) : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">COST CATEGORY:</span>
                      <span className="font-black text-amber-900">
                        {data.category || 'Operational Cost'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">VOUCHER STATUS:</span>
                      <span className="font-mono font-bold text-emerald-800">DISBURSED</span>
                    </div>
                  </div>

                  <table className="w-full text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px] border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300 text-center w-12">SL</th>
                        <th className="p-2 border-r border-slate-300 text-left">EXPENSE CATEGORY</th>
                        <th className="p-2 border-r border-slate-300 text-left">DESCRIPTION / PARTICULARS</th>
                        <th className="p-2 text-right w-36">AMOUNT ({companyProfile.currency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-medium">
                        <td className="p-2 border-r border-slate-200 text-center">
                          <span className="zsb-sl-badge">01</span>
                        </td>
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-900">
                          {data.category || 'Operational Cost'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-700">
                          {data.description || 'Operational overhead expense'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(Number(data.amount) || 0, '')}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                        <td colSpan={3} className="p-2 text-right uppercase border-r border-slate-300">
                          TOTAL OPERATIONAL EXPENSE DISBURSED:
                        </td>
                        <td className="p-2 text-right font-mono text-rose-700 text-sm">
                          {formatCurrency(Number(data.amount) || 0, companyProfile.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <>
                  {data.periodLabel && (
                    <div className="flex items-center justify-between bg-slate-100 px-3 py-2 rounded border border-slate-300 font-mono text-[11px]">
                      <span>
                        <strong>REPORT SCOPE:</strong> {data.periodLabel}
                      </span>
                      <span>
                        <strong>GENERATED:</strong> {formatDate(new Date().toISOString())}
                      </span>
                    </div>
                  )}

                  {/* Executive Summary Block */}
                  <div className="p-4 bg-slate-50 rounded border border-slate-300 text-xs space-y-2">
                    <div className="font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5">
                      Executive Profit &amp; Loss Summary
                    </div>
                    <div className="flex justify-between border-b pb-1.5 font-bold">
                      <span>Gross Export Sales / Invoiced Value (A)</span>
                      <span className="font-mono text-teal-800">
                        {formatCurrency(data.summary?.totalExportValue || 0, companyProfile.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 font-bold">
                      <span>Less: Total Purchase Cost — Live Fish (B)</span>
                      <span className="font-mono text-rose-700">
                        - {formatCurrency(data.summary?.totalPurchasing || 0, companyProfile.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 font-bold bg-amber-50/70 px-2 py-1 rounded">
                      <span>Gross Profit / Margin (A - B)</span>
                      <span className="font-mono text-slate-900">
                        {formatCurrency(data.summary?.grossProfit || 0, companyProfile.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 font-bold">
                      <span>Less: Total Other Operating Costs — Freight / Cargo / Customs (C)</span>
                      <span className="font-mono text-rose-700">
                        - {formatCurrency(data.summary?.totalOtherCosting || 0, companyProfile.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 font-black text-sm">
                      <span>NET BUSINESS PROFIT / (LOSS) (A - B - C)</span>
                      <span
                        className={`font-mono ${
                          (data.summary?.netProfit || 0) >= 0 ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {(data.summary?.netProfit || 0) >= 0 ? '+' : ''}
                        {formatCurrency(data.summary?.netProfit || 0, companyProfile.currency)} (
                        {data.summary?.marginPercent || 0}%)
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Daily Report Details of Profit & Loss Table */}
              {Array.isArray(data.dailyEntries) && data.dailyEntries.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center justify-between">
                    <span>Daily Report Details of Profit &amp; Loss</span>
                    <span className="font-mono text-[11px] text-slate-600">
                      {data.dailyEntries.length} Trading{' '}
                      {data.dailyEntries.length === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                  <table
                    className="w-full text-[10.5px] border border-slate-300 border-collapse font-mono tabular-nums"
                    style={{ tableLayout: 'fixed', width: '100%' }}
                  >
                    <colgroup>
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-800 text-white uppercase font-bold text-[9.5px] tracking-tight">
                        <th className="py-2 px-1.5 border-r border-slate-600 text-left font-sans whitespace-nowrap">
                          Date &amp; Day
                        </th>
                        <th className="py-2 px-1.5 border-r border-slate-600 text-right whitespace-nowrap">
                          Export Rev (RMB)
                        </th>
                        <th className="py-2 px-1.5 border-r border-slate-600 text-right whitespace-nowrap">
                          Purchase (B)
                        </th>
                        <th className="py-2 px-1.5 border-r border-slate-600 text-right whitespace-nowrap">
                          Gross Profit
                        </th>
                        <th className="py-2 px-1.5 border-r border-slate-600 text-right whitespace-nowrap">
                          Other Cost (C)
                        </th>
                        <th className="py-2 px-1.5 border-r border-slate-600 text-right whitespace-nowrap">
                          Net Profit / Loss
                        </th>
                        <th className="py-2 px-1 text-center font-sans whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.dailyEntries.map((d: any) => (
                        <tr key={d.date} className="hover:bg-slate-50">
                          <td className="py-1.5 px-1.5 border-r border-slate-200 font-sans">
                            <div className="font-mono font-bold text-slate-900 whitespace-nowrap">
                              {d.formattedDate} ({d.weekdayLabel})
                            </div>
                            <div className="text-[9.5px] text-slate-500 truncate">{d.topSummaryText}</div>
                          </td>
                          <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-bold text-teal-800 whitespace-nowrap">
                            {formatCurrency(d.exportAmountRMB ?? 0, 'RMB')}
                          </td>
                          <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-bold text-blue-800 whitespace-nowrap">
                            {formatCurrency(d.purchaseAmount, companyProfile.currency)}
                          </td>
                          <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-bold text-slate-800 whitespace-nowrap">
                            {d.grossProfit >= 0 ? '+' : ''}
                            {formatCurrency(d.grossProfit, companyProfile.currency)}
                          </td>
                          <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-bold text-amber-800 whitespace-nowrap">
                            {formatCurrency(d.otherCostAmount, companyProfile.currency)}
                          </td>
                          <td
                            className={`py-1.5 px-1.5 border-r border-slate-200 text-right font-black whitespace-nowrap ${
                              d.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {d.netProfit >= 0 ? '+' : ''}
                            {formatCurrency(d.netProfit, companyProfile.currency)}
                          </td>
                          <td className="py-1.5 px-1 text-center font-sans font-bold text-[9.5px] whitespace-nowrap">
                            {d.status} ({d.marginPercent}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const sumExportRMB = data.dailyEntries.reduce(
                          (s: number, r: any) => s + (Number(r.exportAmountRMB) || 0),
                          0
                        );
                        const sumPurchase =
                          data.summary?.totalPurchasing ??
                          data.dailyEntries.reduce(
                            (s: number, r: any) => s + (Number(r.purchaseAmount) || 0),
                            0
                          );
                        const sumGross =
                          data.summary?.grossProfit ??
                          data.dailyEntries.reduce(
                            (s: number, r: any) => s + (Number(r.grossProfit) || 0),
                            0
                          );
                        const sumOther =
                          data.summary?.totalOtherCosting ??
                          data.dailyEntries.reduce(
                            (s: number, r: any) => s + (Number(r.otherCostAmount) || 0),
                            0
                          );
                        const sumNet =
                          data.summary?.netProfit ??
                          data.dailyEntries.reduce(
                            (s: number, r: any) => s + (Number(r.netProfit) || 0),
                            0
                          );
                        const marginPct = data.summary?.marginPercent ?? 0;
                        return (
                          <tr className="bg-slate-900 text-white font-black text-[10px] border-t-2 border-amber-500">
                            <td className="py-2 px-1.5 border-r border-slate-700 font-sans uppercase whitespace-nowrap">
                              Σ TOTAL ({data.dailyEntries.length}{' '}
                              {data.dailyEntries.length === 1 ? 'DAY' : 'DAYS'}):
                            </td>
                            <td className="py-2 px-1.5 border-r border-slate-700 text-right text-teal-300 whitespace-nowrap">
                              {formatCurrency(sumExportRMB, 'RMB')}
                            </td>
                            <td className="py-2 px-1.5 border-r border-slate-700 text-right text-blue-300 whitespace-nowrap">
                              {formatCurrency(sumPurchase, companyProfile.currency)}
                            </td>
                            <td className="py-2 px-1.5 border-r border-slate-700 text-right text-amber-300 whitespace-nowrap">
                              {sumGross >= 0 ? '+' : ''}
                              {formatCurrency(sumGross, companyProfile.currency)}
                            </td>
                            <td className="py-2 px-1.5 border-r border-slate-700 text-right text-orange-300 whitespace-nowrap">
                              {formatCurrency(sumOther, companyProfile.currency)}
                            </td>
                            <td
                              className={`py-2 px-1.5 border-r border-slate-700 text-right whitespace-nowrap ${
                                sumNet >= 0 ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {sumNet >= 0 ? '+' : ''}
                              {formatCurrency(sumNet, companyProfile.currency)}
                            </td>
                            <td className="py-2 px-1 text-center font-sans text-slate-200 whitespace-nowrap">
                              Margin: {marginPct}%
                            </td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Type 5B: Global View Table Report */}
          {type === 'global_view_table' && data && (
            <GlobalViewTablePrintBody report={data} />
          )}

          {/* Type 5C: Monthly Inventory Mortality Report */}
          {type === 'mortality_report' && data && (
            <div data-testid="printable-mortality-report" className="space-y-4 text-xs">
              {/* Report Sub-Header */}
              <div
                style={{ backgroundColor: '#faf5ff', borderColor: '#d8b4fe' }}
                className="p-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-200/80 px-2 py-0.5 rounded">
                      Report Period:
                    </span>
                    <span className="text-sm font-black text-purple-950 font-mono">
                      {data.monthLabel || 'Current Month'}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-800 mt-1">
                    Monthly ledger audit of live seafood mortality losses, cause analysis, and inventory stock adjustments.
                  </p>
                </div>

                <div className="text-right text-[11px] text-purple-900 font-mono">
                  <div>Audit Month: <strong>{data.targetMonth}</strong></div>
                  <div>Generated: <strong>{formatDate(data.generatedAt || new Date().toISOString())}</strong></div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div style={{ backgroundColor: '#fff1f2', borderColor: '#fecdd3' }} className="p-3 rounded-lg border">
                  <div className="text-[10px] font-bold uppercase text-rose-800">Total Mortality Loss</div>
                  <div className="text-lg font-black font-mono text-rose-700 mt-0.5">
                    {data.totalLossKg} KG
                  </div>
                  <div className="text-[10px] text-rose-600 font-mono mt-0.5">
                    Deducted from Stock
                  </div>
                </div>

                <div style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }} className="p-3 rounded-lg border">
                  <div className="text-[10px] font-bold uppercase text-purple-800">Mortality Incidents</div>
                  <div className="text-lg font-black font-mono text-purple-900 mt-0.5">
                    {data.totalIncidents} Recorded
                  </div>
                  <div className="text-[10px] text-purple-700 font-mono mt-0.5">
                    Avg: {data.averageLossPerIncidentKg} KG/Incident
                  </div>
                </div>

                <div style={{ backgroundColor: '#fefce8', borderColor: '#fef08a' }} className="p-3 rounded-lg border">
                  <div className="text-[10px] font-bold uppercase text-amber-800">Primary Impact Species</div>
                  <div className="text-base font-black font-mono text-amber-900 mt-0.5 truncate">
                    {data.primarySpecies}
                  </div>
                  <div className="text-[10px] text-amber-700 font-mono mt-0.5 truncate">
                    Cause: {data.primaryCause}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }} className="p-3 rounded-lg border">
                  <div className="text-[10px] font-bold uppercase text-emerald-800">Est. Financial Loss</div>
                  <div className="text-lg font-black font-mono text-emerald-900 mt-0.5">
                    {formatCurrency(data.estimatedTotalLossBDT, companyProfile.currency)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                    At Average Procurement Rate
                  </div>
                </div>
              </div>

              {/* Table 1: Species & Grade Loss Distribution Breakdown */}
              <div className="space-y-1.5 pt-1">
                <div className="font-bold text-xs uppercase tracking-wide text-slate-800 flex items-center justify-between">
                  <span>Species &amp; Grade Loss Distribution</span>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    {data.speciesBreakdown?.length || 0} Species Impacted
                  </span>
                </div>
                <table style={{ border: '1px solid #cbd5e1' }} className="w-full text-left text-xs border-collapse">
                  <thead style={{ backgroundColor: '#581c87', color: '#ffffff' }} className="font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-2 w-10 text-center">SL</th>
                      <th className="p-2">SPECIES / GRADE</th>
                      <th className="p-2 text-right">LOSS QTY (KG)</th>
                      <th className="p-2 text-right">% OF MONTH LOSS</th>
                      <th className="p-2 text-center">INCIDENTS</th>
                      <th className="p-2 text-right">EST. PROCUREMENT RATE</th>
                      <th className="p-2 text-right">EST. LOSS AMOUNT (TK)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!data.speciesBreakdown || data.speciesBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          No mortality recorded for this month.
                        </td>
                      </tr>
                    ) : (
                      data.speciesBreakdown.map((row: any, idx: number) => (
                        <tr key={row.species} className="hover:bg-slate-50">
                          <td className="p-2 text-center whitespace-nowrap">
                            <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                          </td>
                          <td className="p-2 font-mono font-bold text-purple-950">{row.species}</td>
                          <td className="p-2 text-right font-mono font-black text-rose-700">
                            {row.totalLossKg} KG
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700">
                            {row.percentageOfTotal}%
                          </td>
                          <td className="p-2 text-center font-mono text-slate-700">{row.incidentCount}</td>
                          <td className="p-2 text-right font-mono text-slate-700">
                            {formatCurrency(row.estimatedRatePerKg, companyProfile.currency)}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(row.estimatedLossBDT, companyProfile.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.speciesBreakdown && data.speciesBreakdown.length > 0 && (
                    <tfoot style={{ backgroundColor: '#faf5ff', borderTop: '2px solid #a855f7' }}>
                      <tr className="font-black text-purple-950 text-xs">
                        <td colSpan={2} className="p-2 text-right uppercase">TOTAL MONTH LOSS:</td>
                        <td className="p-2 text-right font-mono text-rose-700">{data.totalLossKg} KG</td>
                        <td className="p-2 text-right font-mono">100%</td>
                        <td className="p-2 text-center font-mono">{data.totalIncidents}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right font-mono text-slate-950">
                          {formatCurrency(data.estimatedTotalLossBDT, companyProfile.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Table 2: Chronological Mortality Incident Ledger */}
              <div className="space-y-1.5 pt-2">
                <div className="font-bold text-xs uppercase tracking-wide text-slate-800 flex items-center justify-between">
                  <span>Detailed Mortality Event Log ({data.monthLabel})</span>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    {data.records?.length || 0} Incident Records
                  </span>
                </div>
                <table style={{ border: '1px solid #cbd5e1' }} className="w-full text-left text-xs border-collapse">
                  <thead style={{ backgroundColor: '#1e1b4b', color: '#ffffff' }} className="font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-2 w-10 text-center">SL</th>
                      <th className="p-2">DATE</th>
                      <th className="p-2">SPECIES / GRADE</th>
                      <th className="p-2 text-right">MORTALITY LOSS</th>
                      <th className="p-2">CAUSE / REASON</th>
                      <th className="p-2">NOTES / LOCATION</th>
                      <th className="p-2">STOCK ADJUSTMENT IMPACT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!data.records || data.records.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          No mortality events recorded in this month.
                        </td>
                      </tr>
                    ) : (
                      data.records.map((rec: any, idx: number) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="p-2 text-center whitespace-nowrap">
                            <span className="zsb-sl-badge">{String(idx + 1).padStart(2, '0')}</span>
                          </td>
                          <td className="p-2 font-mono text-slate-700">{formatDate(rec.date)}</td>
                          <td className="p-2 font-mono font-bold text-purple-950">{rec.species}</td>
                          <td className="p-2 text-right font-mono font-black text-rose-700">
                            -{rec.quantityKg} KG
                          </td>
                          <td className="p-2 text-slate-800 font-medium">{rec.cause || '-'}</td>
                          <td className="p-2 text-slate-600">{rec.notes || '-'}</td>
                          <td className="p-2 font-mono text-[10px] text-amber-800 font-bold">
                            Deducted {rec.quantityKg} KG from {rec.species} stock
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures & Verification Seal */}
              {headerFooterConfig.showFooter && headerFooterConfig.showSignatures && (
                <div className="pt-6 mt-4 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
                  <div>
                    <div className="border-b border-slate-400 pb-8 font-bold text-slate-800">
                      Inventory &amp; Depot Supervisor
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Physical Count Verified</div>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 pb-8 font-bold text-slate-800">
                      {companyProfile.partner || 'Md. Sohel Rana'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                      Partner • <span style={{ color: '#d97706', fontWeight: 800 }} className="font-extrabold text-amber-500 zsb-golden-brand-light">ZSB AQUATICS</span>
                    </div>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 pb-8 font-bold text-slate-800">
                      {companyProfile.managingPartner || 'Md. Mizanur Rahman'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                      Managing Partner • <span style={{ color: '#d97706', fontWeight: 800 }} className="font-extrabold text-amber-500 zsb-golden-brand-light">ZSB AQUATICS</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Type 6: Exporter Payment Slip (PAYMENT SLIP 付款单) */}
          {type === 'exporter_payment_slip' && data && (
            <div
              style={{ fontFamily: '"Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif' }}
              className="border-2 border-black overflow-hidden"
            >
              {headerFooterConfig.showHeader && (
                <>
                  {headerFooterConfig.showCompanyName && (
                    <div
                      data-testid="print-doc-company-name"
                      style={{ backgroundColor: '#98486f', color: '#ffffff' }}
                      className="py-3 px-4 flex items-center justify-center gap-3 border-b-2 border-black"
                    >
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '9999px',
                          overflow: 'hidden',
                          border: '2px solid #fcd34d',
                          backgroundColor: '#ffffff',
                          padding: '2px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-300 bg-white p-0.5 shrink-0 shadow-xs flex items-center justify-center"
                      >
                        <img
                          data-testid="print-preview-slip-logo"
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
                      <div
                        className="zsb-3d-text-lg text-3xl font-black tracking-wider uppercase"
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
                  )}
                  {headerFooterConfig.showCompanyContact && (
                    <div
                      data-testid="print-doc-company-contact"
                      style={{ backgroundColor: '#faefd0', color: '#000000' }}
                      className="text-center border-b-2 border-black divide-y divide-black/20"
                    >
                      <div className="py-1 px-3 text-xs sm:text-sm font-bold uppercase">
                        29/B, NISHATNAGAR, TARARTEK, TURAG, DHAKA-1230
                      </div>
                      <div className="py-1 px-3 text-xs sm:text-sm font-bold uppercase">
                        CONTACT NUMBER - +880 18411-65902, +880 1711 331545 | EMAIL:{' '}
                        <span className="normal-case">{companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com' ? companyProfile.email : 'zsbaquatics@gmail.com'}, Website : {companyProfile.website || 'www.zsbaquatics.com'}</span>
                      </div>
                    </div>
                  )}
                  <div
                    style={{ backgroundColor: '#faefd0', color: '#000000' }}
                    className="py-2 px-3 text-center border-b-2 border-black font-black text-lg sm:text-xl"
                  >
                    PAYMENT SLIP 付款单
                  </div>
                  {(headerFooterConfig.showDate ||
                    headerFooterConfig.customHeaderText.trim() !== '') && (
                    <div
                      data-testid="print-doc-custom-header-bar"
                      style={{ backgroundColor: '#faefd0', color: '#000000' }}
                      className="py-1 px-3 text-center border-b-2 border-black flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-xs font-bold"
                    >
                      {headerFooterConfig.customHeaderText.trim() !== '' && (
                        <span data-testid="print-doc-custom-header">
                          {headerFooterConfig.customHeaderText.trim()}
                        </span>
                      )}
                      {headerFooterConfig.showDate && (
                        <span data-testid="print-doc-header-date" className="font-mono">
                          Printed: {formattedPrintDate}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr
                    style={{ backgroundColor: '#98486f', color: '#ffffff' }}
                    className="font-bold uppercase border-b-2 border-black"
                  >
                    <th className="py-2 px-1.5 border-r-2 border-black">
                      <div>DATE</div>
                      <div className="text-[10px] font-normal">发货日期</div>
                    </th>
                    <th className="py-2 px-1.5 border-r-2 border-black">
                      <div>FLIGHT</div>
                      <div className="text-[10px] font-normal">航班名称</div>
                    </th>
                    <th className="py-2 px-1.5 border-r-2 border-black">MARK 标记</th>
                    <th className="py-2 px-1.5 border-r-2 border-black">
                      <div>BOX</div>
                      <div className="text-[10px] font-normal">箱数</div>
                    </th>
                    <th className="py-2 px-1.5 border-r-2 border-black">
                      <div>WEIGHT</div>
                      <div className="text-[10px] font-normal">/KG 重量</div>
                    </th>
                    <th className="py-2 px-1.5 border-r-2 border-black">
                      <div>AMOUNT</div>
                      <div className="text-[10px] font-normal">待结金额</div>
                    </th>
                    <th className="py-2 px-1.5">STATUS 地位</th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: '#faefd0', color: '#000000' }}>
                  {Array.from({ length: Math.max(3, (data.rows || []).length) }).map((_, i) => {
                    const row = (data.rows || [])[i];
                    return (
                      <tr key={i} className="border-b border-black h-11 font-bold align-middle">
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? formatDate(row.date) : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black align-middle">
                          {row ? row.flight : ''}
                        </td>
                        <td className="py-1 px-2 border-r-2 border-black font-black text-[20px] leading-none tracking-wider uppercase align-middle">
                          {row ? row.mark : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? row.box : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? row.weightKg : ''}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-2 border-black font-mono align-middle">
                          {row ? formatRMB(row.amount) : ''}
                        </td>
                        <td className="py-1.5 px-1.5 align-middle">{row ? row.status : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr
                    style={{ backgroundColor: '#98486f', color: '#ffffff' }}
                    className="border-t-2 border-b-2 border-black font-black text-xs sm:text-sm"
                  >
                    <td colSpan={3} className="py-2 px-3 border-r-2 border-black text-center uppercase">
                      GRAND TOTAL 累计
                    </td>
                    <td className="py-2 px-1.5 border-r-2 border-black font-mono">
                      {data.totals?.totalBox ?? 0}
                    </td>
                    <td className="py-2 px-1.5 border-r-2 border-black font-mono">
                      {data.totals?.totalWeightKg ? data.totals.totalWeightKg : ''}
                    </td>
                    <td className="py-2 px-1.5 border-r-2 border-black font-mono">
                      {formatRMB(data.totals?.totalAmount ?? 0)}
                    </td>
                    <td className="py-2 px-1.5"></td>
                  </tr>
                </tfoot>
              </table>
              {headerFooterConfig.showFooter && headerFooterConfig.showSignatures && (
                <div data-testid="print-doc-signatures" className="bg-white px-6 py-6 flex justify-end">
                  <div className="text-right space-y-0.5 flex flex-col items-end">
                    <div className="text-xs sm:text-sm font-bold text-black uppercase">
                      YOURS FAITHFULLY - 此致
                    </div>
                    <div className="py-1 flex justify-end">
                      <img
                        src="/assets/aistudio/Md._Sohel_Rana_38797da9.jpg"
                        alt="Md. Sohel Rana Signature"
                        className="h-12 sm:h-14 w-auto object-contain select-none"
                      />
                    </div>
                    <div className="text-xs sm:text-sm font-black text-black uppercase">
                      {companyProfile.partner || 'MD. SOHEL RANA'}
                    </div>
                    <div className="text-xs font-bold text-black uppercase">PARTNER</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Requirement: Signatures Like Managing Partner and Partner with Signature */}
          {type !== 'exporter_payment_slip' &&
            type !== 'batch_payment_slips' &&
            headerFooterConfig.showFooter &&
            headerFooterConfig.showSignatures && (
              <div
                data-testid="print-doc-signatures"
                className="pt-12 grid grid-cols-2 gap-8 text-center text-xs"
              >
                {/* Managing Partner Signature */}
                <div className="flex flex-col items-center">
                  {/* Signature Line */}
                  <div
                    style={{ borderBottom: '2px solid #0f172a' }}
                    className="w-52 pb-1.5"
                  >
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

                {/* Partner Signature */}
                <div className="flex flex-col items-center">
                  {/* Signature Line */}
                  <div
                    style={{ borderBottom: '2px solid #0f172a' }}
                    className="w-52 pb-1.5"
                  >
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
            )}

          {/* Footer certification & dynamic A4 page counter */}
          {headerFooterConfig.showFooter && (
            <div
              data-testid="print-doc-footer"
              style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
              className="flex justify-between items-center gap-3 text-[10px] pt-4 mt-6"
            >
              {headerFooterConfig.customFooterText.trim() !== '' ? (
                <span
                  data-testid="print-doc-custom-footer"
                  style={{ color: '#334155' }}
                  className="font-semibold"
                >
                  {headerFooterConfig.customFooterText.trim()}
                </span>
              ) : (
                <span>
                  This is an official computer-generated document from <strong style={{ color: '#d97706', fontWeight: 800 }} className="font-extrabold text-amber-500 zsb-golden-brand-light">{companyProfile.companyName}</strong> System • Validated and archived.
                </span>
              )}
              {headerFooterConfig.showPageNumber && (
                <span
                  data-testid="print-doc-page-number"
                  className="print-page-number-counter font-mono font-bold text-slate-600 shrink-0"
                >
                  <span className="print:hidden">
                    {type === 'packing' && printCurrentPageOnly
                      ? `Page ${currentPage} of ${totalPages}`
                      : 'Page 1 of 1'}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    {isExportingGlobalPdf && globalViewReport && (
      <GlobalOffscreenPrintHost
        report={globalViewReport}
        companyProfile={companyProfile}
      />
    )}

    {/* Interactive PNG WeChat Share Modal */}
    {isShareModalOpen && (
      <PngShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={title}
        documentType={type}
        documentData={data}
        targetElementId="printable-document"
        defaultFilename={getCleanFilename('png')}
      />
    )}
  </div>
);
};
