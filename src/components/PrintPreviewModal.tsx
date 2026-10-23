import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  formatCurrency,
  formatDate,
  formatRMB,
  formatExporterSlipExportFilename,
  formatPurchaseExportFilename,
} from '../utils/calculations.ts';
import {
  exportElementToPdf,
  exportElementToPng,
  openPrintableDocumentWindow,
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
} from 'lucide-react';

export const PrintPreviewModal: React.FC = () => {
  const { printModalData, closePrintModal, companyProfile, showToast } = useApp();
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingPng, setIsSavingPng] = useState(false);

  if (!printModalData.isOpen) return null;

  const { type, title, data, items, selectedIds } = printModalData;

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
    const docNo = data?.invoiceNumber || (data?.records?.[0]?.invoiceNumber) || type;
    const cleanDoc = String(docNo).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `ZSB_AQUATICS_${cleanDoc}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  };

  const handleDirectSavePdf = async () => {
    setIsSavingPdf(true);
    const filename = getCleanFilename('pdf');
    try {
      const success = await exportElementToPdf('printable-document', filename);
      if (success) {
        showToast(`PDF downloaded: ${filename}`);
      } else {
        showToast('Direct PDF conversion failed, opening print dialogue...');
        handleBrowserPrint();
      }
    } catch (e) {
      console.error(e);
      showToast('Error generating PDF file.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleDirectSavePng = async () => {
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

  const handleBrowserPrint = () => {
    try {
      const opened = openPrintableDocumentWindow('printable-document', title);
      if (opened) {
        showToast('Print document window opened! Press Ctrl+P or click Print Now.');
      } else {
        handleDirectSavePdf();
      }
    } catch (err) {
      console.warn('Print error:', err);
      handleDirectSavePdf();
    }
  };

  return (
    <div
      id="printable-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible"
    >
      <div
        id="printable-modal-card"
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:rounded-none"
      >
        {/* Modal Top Control Bar (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm tracking-wide truncate max-w-xs sm:max-w-md">{title}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Save as PDF Button */}
            <button
              onClick={handleDirectSavePdf}
              disabled={isSavingPdf || isSavingPng}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
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
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
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

            {/* Print Document Button */}
            <button
              onClick={handleBrowserPrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold shadow transition cursor-pointer"
              title="Open browser print dialogue"
            >
              <Printer className="w-4 h-4" />
              <span>Print Document</span>
            </button>

            <button
              onClick={closePrintModal}
              aria-label="Close Preview"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Paper Desk Workspace */}
        <div className="bg-slate-200/80 p-3 sm:p-6 overflow-y-auto flex justify-center items-start flex-1 min-h-0 print:p-0 print:bg-white">
          {/* Printable Voucher Paper Content (Matches 800px PDF export width) */}
          <div
            id="printable-document"
            className="w-full max-w-[800px] bg-white shadow-2xl rounded-sm border border-slate-300 p-6 sm:p-8 space-y-6 text-slate-900 print:shadow-none print:border-none print:p-0 print:max-w-none"
            style={{ backgroundColor: '#ffffff', color: '#000000' }}
          >
            {/* Official Document Header (Hidden for exporter_payment_slip which has its own custom plum/cream header) */}
            {type !== 'exporter_payment_slip' && (
              <div
                style={{ borderBottom: '2px solid #0f172a' }}
                className="pb-4 text-center space-y-1.5"
              >
                {/* Golden Company Name (Requirement: Should be GOLDEN COLOR in every place) */}
                <div
                  style={{
                    color: '#d4af37',
                    fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
                    textShadow: '0 1px 2px rgba(212,175,55,0.25)',
                  }}
                  className="text-3xl sm:text-4xl font-black tracking-widest uppercase"
                >
                  {companyProfile.companyName}
                </div>

                {/* Address strictly in font BLACK color */}
                <div
                  style={{ color: '#000000' }}
                  className="text-xs sm:text-sm font-bold tracking-wide"
                >
                  Address: {companyProfile.address}
                </div>

                {/* Mobile Numbers strictly in font BLACK color */}
                <div
                  style={{ color: '#000000' }}
                  className="text-xs sm:text-sm font-bold font-mono"
                >
                  Mobile: {companyProfile.mobiles.join(' , ')}
                </div>

                <div
                  style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                  className="inline-block mt-2 px-5 py-1.5 rounded text-xs font-bold tracking-widest uppercase shadow-sm"
                >
                  {type === 'purchase'
                    ? 'PURCHASE DATA ENTRY FORM (LIVE CRABS, EEL FISH & CHILLED FISH GRADES) — CHALLAN / BILL'
                    : type === 'packing'
                    ? 'EXPORT AIR PACKING LIST MANIFEST'
                    : type === 'payment'
                    ? data?.paymentCategory === 'exporter'
                      ? 'EXPORTER PAYMENT & RMB SETTLEMENT VOUCHER'
                      : data?.paymentCategory === 'supplier'
                      ? 'SUPPLIER PAYMENT VOUCHER'
                      : 'SUPPLIER & EXPORTER PAYMENT VOUCHER'
                    : type === 'monthly_statement'
                    ? 'MONTHLY STATEMENT REPORT'
                    : type === 'profit_loss'
                    ? 'LOSS & PROFIT STATEMENT'
                    : 'CONSOLIDATED BATCH REPORT'}
                </div>
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
                    <th className="p-2 text-right w-36">TOTAL AMOUNT ({companyProfile.currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items && items.length > 0 ? (
                    items.map((row: any, i: number) => (
                      <tr key={i} className="font-medium">
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                        <td className="p-2 border-r border-slate-200 font-bold">{row.item}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono tabular-nums">{row.quantity}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono tabular-nums">
                          {formatCurrency(row.rate, '')}
                        </td>
                        <td className="p-2 text-right font-mono font-bold tabular-nums">
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
                    <td colSpan={2} className="p-2 text-right uppercase">TOTAL QUANTITY:</td>
                    <td className="p-2 text-right font-mono tabular-nums text-blue-900 border-r border-slate-300">{data.totalQty}</td>
                    <td className="p-2 text-right uppercase border-r border-slate-300">CURRENT BILL TOTAL:</td>
                    <td className="p-2 text-right font-mono tabular-nums font-black text-slate-900">
                      {formatCurrency(data.totalAmount, companyProfile.currency)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold text-[11px]">
                    <td colSpan={4} className="p-2 text-right text-slate-600 border-r border-slate-200">PREVIOUS BALANCE (BROUGHT FORWARD):</td>
                    <td className="p-2 text-right font-mono tabular-nums text-slate-800">
                      {formatCurrency(data.previousAmount, companyProfile.currency)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold text-[11px]">
                    <td colSpan={4} className="p-2 text-right text-slate-600 border-r border-slate-200">LESS: PAID AMOUNT (TODAY):</td>
                    <td className="p-2 text-right font-mono tabular-nums text-emerald-700">
                      - {formatCurrency(data.paidAmount, companyProfile.currency)}
                    </td>
                  </tr>
                  <tr className="bg-slate-200 font-black text-xs border-t border-slate-400">
                    <td colSpan={4} className="p-2 text-right uppercase text-slate-900 border-r border-slate-300">NET CLOSING BALANCE:</td>
                    <td className="p-2 text-right font-mono tabular-nums text-rose-700 text-sm">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500 block">PACKING NO:</span>
                  <span className="font-mono font-black text-slate-900 text-sm">{data.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SHIPPING MARK:</span>
                  <span className="font-black text-blue-900 text-sm">{data.shippingMark}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">PACKING DATE:</span>
                  <span className="font-mono font-bold text-slate-900">{formatDate(data.packingDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">FLIGHT:</span>
                  <span className="font-semibold text-slate-900">{data.flight}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DESTINATION:</span>
                  <span className="font-bold text-slate-900">{data.destination}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SHIPPER:</span>
                  <span className="font-semibold text-slate-800">{data.shipper}</span>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px] border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 text-center w-12">SL</th>
                    <th className="p-2 border-r border-slate-300 text-left">ITEM / SIZE</th>
                    <th className="p-2 border-r border-slate-300 text-center w-20">BOX</th>
                    <th className="p-2 border-r border-slate-300 text-center w-20">WEIGHT (KG)</th>
                    <th className="p-2 border-r border-slate-300 text-right w-28">TOTAL WEIGHT</th>
                    <th className="p-2 border-r border-slate-300 text-center w-16">UNIT</th>
                    <th className="p-2 border-r border-slate-300 text-right w-24">RATE (RMB)</th>
                    <th className="p-2 text-right w-32">AMOUNT (RMB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items && items.length > 0 ? (
                    items.map((row: any, i: number) => (
                      <tr key={i} className="font-medium">
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                        <td className="p-2 border-r border-slate-200 font-bold">{row.item}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{row.box}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{row.weight}</td>
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
                    ))
                  ) : null}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={2} className="p-2 text-right uppercase">TOTALS:</td>
                    <td className="p-2 text-center font-mono text-slate-900">{data.totalBox} Boxes</td>
                    <td></td>
                    <td className="p-2 text-right font-mono text-teal-800 font-black">{data.totalWeight} KG</td>
                    <td colSpan={2} className="p-2 text-right uppercase">TOTAL INVOICE VALUE:</td>
                    <td className="p-2 text-right font-mono font-black text-slate-900">
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
                    <th className="p-2 border-r border-slate-300 text-right w-32">
                      DEBIT ({data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency})
                    </th>
                    <th className="p-2 border-r border-slate-300 text-right w-32">
                      CREDIT ({data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency})
                    </th>
                    <th className="p-2 text-right w-32">
                      BALANCE ({data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items && items.length > 0 ? (
                    items.map((row: any, i: number) => (
                      <tr key={i} className="font-medium">
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                        <td className="p-2 border-r border-slate-200">{row.description}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono">
                          {formatCurrency(row.debitAmount, '')}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono">
                          {formatCurrency(row.creditAmount, '')}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatCurrency(row.balance, '')}
                        </td>
                      </tr>
                    ))
                  ) : null}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={2} className="p-2 text-right uppercase">TOTAL VOUCHER:</td>
                    <td className="p-2 text-right font-mono font-black">
                      {formatCurrency(
                        data.totalAmount,
                        data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency
                      )}
                    </td>
                    <td></td>
                    <td className="p-2 text-right font-mono text-purple-900 font-black">
                      {formatCurrency(
                        data.balance,
                        data.paymentCategory === 'exporter' ? 'RMB' : companyProfile.currency
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Type 4: Monthly Statement or Batch Print */}
          {(type === 'monthly_statement' || type === 'batch_print') && data && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-800">Statement Period / Selection:</span>{' '}
                  <span className="font-mono text-slate-600">{data.statementMonth || title}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">Total Entries:</span>{' '}
                  <span className="font-mono text-slate-900 font-bold">
                    {data.records?.length || 0} Records
                  </span>
                </div>
              </div>

              {data.records && data.records.length > 0 ? (
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[10px] border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300 text-center w-10">SL</th>
                      <th className="p-2 border-r border-slate-300">DOC NO</th>
                      <th className="p-2 border-r border-slate-300">DATE</th>
                      <th className="p-2 border-r border-slate-300">PARTY / MARK</th>
                      <th className="p-2 border-r border-slate-300 text-right">WEIGHT / QTY</th>
                      <th className="p-2 text-right">AMOUNT ({companyProfile.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.records.map((rec: any, idx: number) => (
                      <tr key={idx} className="font-medium">
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold">{rec.invoiceNumber}</td>
                        <td className="p-2 border-r border-slate-200 font-mono">{formatDate(rec.date || rec.packingDate)}</td>
                        <td className="p-2 border-r border-slate-200 font-semibold">{rec.description || rec.shippingMark}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono">
                          {rec.totalWeight ? `${rec.totalWeight} KG` : rec.totalQty || '-'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatCurrency(rec.totalAmount || rec.paidAmount, '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          )}

          {/* Type 5: Profit & Loss Statement */}
          {type === 'profit_loss' && data && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between border-b pb-1.5 font-bold">
                  <span>Gross Export Sales / Invoiced Value</span>
                  <span className="font-mono text-teal-800">
                    {formatCurrency(data.summary.totalExportValue, companyProfile.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5 font-bold">
                  <span>Less: Total Purchase Cost (Live Fish)</span>
                  <span className="font-mono text-rose-700">
                    - {formatCurrency(data.summary.totalPurchasing, companyProfile.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5 font-bold">
                  <span>Less: Total Other Operating Costs (Freight/Cargo/Customs)</span>
                  <span className="font-mono text-rose-700">
                    - {formatCurrency(data.summary.totalOtherCosting, companyProfile.currency)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-black text-sm">
                  <span>NET BUSINESS PROFIT / (LOSS)</span>
                  <span className="font-mono text-emerald-800">
                    {formatCurrency(data.summary.netProfit, companyProfile.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Type 6: Exporter Payment Slip (PAYMENT SLIP 付款单) */}
          {type === 'exporter_payment_slip' && data && (
            <div
              style={{ fontFamily: '"Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif' }}
              className="border-2 border-black overflow-hidden"
            >
              <div
                style={{ backgroundColor: '#98486f', color: '#ffffff' }}
                className="py-3 px-4 text-center border-b-2 border-black"
              >
                <div className="text-3xl font-black tracking-wider uppercase font-sans">
                  {companyProfile.companyName}
                </div>
              </div>
              <div
                style={{ backgroundColor: '#faefd0', color: '#000000' }}
                className="text-center border-b-2 border-black divide-y divide-black/20"
              >
                <div className="py-1 px-3 text-xs sm:text-sm font-bold uppercase">
                  29/B, NISHATNAGAR, TARARTEK, TURAG, DHAKA-1230
                </div>
                <div className="py-1 px-3 text-xs sm:text-sm font-bold uppercase">
                  CONTACT NUMBER - +880 18411-65902, +880 1711 331545
                </div>
              </div>
              <div
                style={{ backgroundColor: '#faefd0', color: '#000000' }}
                className="py-2 px-3 text-center border-b-2 border-black font-black text-lg sm:text-xl uppercase"
              >
                PAYMENT SLIP 付款单
              </div>
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
                        <td className="py-1 px-2 border-r-2 border-black font-black text-2xl leading-none tracking-wider uppercase align-middle">
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
              <div className="bg-white px-6 py-6 flex justify-end">
                <div className="text-right space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-black uppercase">
                    YOURS FAITHFULLY - 此致
                  </div>
                  <div
                    style={{
                      fontFamily: '"Caveat", "Brush Script MT", "Segoe Script", Georgia, cursive',
                    }}
                    className="text-3xl font-bold text-slate-900 py-0.5"
                  >
                    Md. Sohel Rana
                  </div>
                  <div className="text-xs sm:text-sm font-black text-black uppercase">
                    {companyProfile.partner || 'MD. SOHEL RANA'}
                  </div>
                  <div className="text-xs font-bold text-black uppercase">PARTNER</div>
                </div>
              </div>
            </div>
          )}

          {/* User Requirement: Signatures Like Managing Partner and Partner with Signature */}
          {type !== 'exporter_payment_slip' && (
            <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
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
                  style={{ color: '#64748b' }}
                  className="text-[10px] uppercase font-semibold"
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
                  style={{ color: '#64748b' }}
                  className="text-[10px] uppercase font-semibold"
                >
                  {companyProfile.companyName}
                </div>
              </div>
            </div>
          )}

          {/* Footer certification */}
          <div
            style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
            className="text-center text-[10px] pt-4"
          >
            This is an official computer-generated document from {companyProfile.companyName} System • Validated and archived.
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
