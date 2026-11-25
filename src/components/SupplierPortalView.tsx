import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { PurchaseRecord, PaymentRecord } from '../types/index.ts';
import {
  SupplierPortalSession,
  getSupplierPortalStatement,
  getSupplierInvoiceById,
  getSupplierPaymentVoucherById,
  generateSupplierStatementCSV,
  formatSupplierRecordTypeLabel,
  formatSupplierStatementPdfFilename,
  formatSupplierInvoicePdfFilename,
  formatSupplierReceiptPdfFilename,
} from '../utils/supplierPortal.ts';
import { SupplierRecordType } from '../utils/supplierHistory.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import { yieldForDomFrame } from '../utils/pdfExportStyles.ts';
import {
  exportElementToPdf,
  openPrintableDocumentWindow,
  resolveCompanyLogoSrc,
} from '../utils/pdfGenerator.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import {
  LogOut,
  FileText,
  Receipt,
  Download,
  Printer,
  Search,
  Calendar,
  RotateCcw,
  X,
  Phone,
  Eye,
  BookOpen,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';

interface SupplierPortalViewProps {
  session: SupplierPortalSession;
  onSignOut: () => void;
}

type PortalTab = 'statement' | 'invoices' | 'receipts';

export const SupplierPortalView: React.FC<SupplierPortalViewProps> = ({
  session,
  onSignOut,
}) => {
  const { purchases, payments, supplierCredits, companyProfile } = useApp();

  const [activeTab, setActiveTab] = useState<PortalTab>('statement');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'ALL' | SupplierRecordType>('ALL');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [offscreenPdfMode, setOffscreenPdfMode] = useState<
    { kind: 'statement' } | { kind: 'invoice'; invoice: PurchaseRecord } | null
  >(null);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);

  const currency = companyProfile.currency || 'TK';
  const resolvedLogoSrc = resolveCompanyLogoSrc(companyProfile.logoUrl);

  // Strictly scoped to the authenticated supplier session
  const statement = useMemo(
    () =>
      getSupplierPortalStatement(
        session.supplierName,
        { purchases, payments, supplierCredits },
        {
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          search: searchQuery || undefined,
          recordType: recordTypeFilter,
          sortDirection: 'desc',
        }
      ),
    [session.supplierName, purchases, payments, supplierCredits, fromDate, toDate, searchQuery, recordTypeFilter]
  );

  // Owner-verified single invoice lookup
  const selectedInvoice: PurchaseRecord | null = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return getSupplierInvoiceById(session.supplierName, selectedInvoiceId, purchases);
  }, [session.supplierName, selectedInvoiceId, purchases]);

  // Owner-verified single payment voucher lookup
  const selectedPayment: PaymentRecord | null = useMemo(() => {
    if (!selectedPaymentId) return null;
    return getSupplierPaymentVoucherById(session.supplierName, selectedPaymentId, payments);
  }, [session.supplierName, selectedPaymentId, payments]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || fromDate || toDate || recordTypeFilter !== 'ALL'
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setRecordTypeFilter('ALL');
  };

  const handleDownloadStatementCSV = () => {
    const csv = generateSupplierStatementCSV(
      statement.supplierName,
      statement.rows,
      statement.filteredTotals,
      companyProfile.companyName || 'ZSB AQUATICS',
      currency
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = statement.supplierName.replace(/[^a-zA-Z0-9_-]+/g, '_');
    link.href = url;
    link.download = `${safeName}_Ledger_Statement_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintElement = (elementId: string, docTitle: string) => {
    const opened = openPrintableDocumentWindow(elementId, docTitle);
    if (!opened) {
      window.print();
    }
  };

  const showPdfFeedback = (message: string) => {
    setPdfFeedback(message);
    window.setTimeout(() => {
      setPdfFeedback((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  const handleExportPdfElement = async (
    elementId: string,
    filename: string,
    targetKey: string = elementId
  ) => {
    setIsDownloadingPdf(true);
    setDownloadingTarget(targetKey);
    try {
      const ok = await exportElementToPdf(elementId, filename);
      if (ok) {
        showPdfFeedback(`Downloaded ${filename}`);
      } else {
        handlePrintElement(elementId, filename.replace(/\.pdf$/i, ''));
      }
    } finally {
      setIsDownloadingPdf(false);
      setDownloadingTarget(null);
    }
  };

  const handleDownloadStatementPdf = async () => {
    if (statement.rows.length === 0 || isDownloadingPdf) return;
    const filename = formatSupplierStatementPdfFilename(statement.supplierName);
    setIsDownloadingPdf(true);
    setDownloadingTarget('statement');
    setOffscreenPdfMode({ kind: 'statement' });
    try {
      await yieldForDomFrame();
      await yieldForDomFrame();
      const ok = await exportElementToPdf('supplier-portal-offscreen-pdf-sheet', filename);
      if (ok) {
        showPdfFeedback(`Downloaded ${filename}`);
      } else {
        handlePrintElement(
          'supplier-portal-printable-statement',
          `${statement.supplierName} - Account Statement`
        );
      }
    } finally {
      setOffscreenPdfMode(null);
      setIsDownloadingPdf(false);
      setDownloadingTarget(null);
    }
  };

  const handleDirectDownloadInvoicePdf = async (invoiceId: string) => {
    if (isDownloadingPdf) return;
    // Always re-verify strict supplier ownership before exporting
    const ownedInvoice = getSupplierInvoiceById(session.supplierName, invoiceId, purchases);
    if (!ownedInvoice) return;

    const filename = formatSupplierInvoicePdfFilename(
      ownedInvoice.invoiceNumber,
      statement.supplierName
    );
    setIsDownloadingPdf(true);
    setDownloadingTarget(ownedInvoice.id);
    setOffscreenPdfMode({ kind: 'invoice', invoice: ownedInvoice });
    try {
      await yieldForDomFrame();
      await yieldForDomFrame();
      const ok = await exportElementToPdf('supplier-portal-offscreen-pdf-sheet', filename);
      if (ok) {
        showPdfFeedback(`Downloaded ${filename}`);
      } else {
        setSelectedPaymentId(null);
        setSelectedInvoiceId(ownedInvoice.id);
      }
    } finally {
      setOffscreenPdfMode(null);
      setIsDownloadingPdf(false);
      setDownloadingTarget(null);
    }
  };

  const handleOpenRowDocument = (recordType: SupplierRecordType, invoiceNumber: string, paymentId?: string) => {
    if (recordType === 'PURCHASE_BILL') {
      const match = getSupplierInvoiceById(session.supplierName, invoiceNumber, purchases);
      if (match) {
        setSelectedPaymentId(null);
        setSelectedInvoiceId(match.id);
      }
    } else if (recordType === 'PAYMENT_VOUCHER') {
      const match = getSupplierPaymentVoucherById(
        session.supplierName,
        paymentId || invoiceNumber,
        payments
      );
      if (match) {
        setSelectedInvoiceId(null);
        setSelectedPaymentId(match.id);
      }
    }
  };

  const overallDue = statement.overallTotals.totalBalance;

  return (
    <div
      data-testid="supplier-portal-workspace"
      className="min-h-screen bg-[#EDF2F7] text-[#0F172A] flex flex-col"
    >
      {/* Top Corporate Header Bar */}
      <header className="bg-[#273E56] text-white border-b border-[#1E3247] print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#5eead4] bg-white p-0.5 shrink-0 flex items-center justify-center">
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
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-black tracking-tight text-amber-400">
                  {companyProfile.companyName}
                </span>
                <span className="text-slate-400 text-sm">/</span>
                <span className="text-xs sm:text-sm font-semibold text-sky-100">
                  Supplier Statement &amp; Invoices
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {companyProfile.address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div
                data-testid="supplier-portal-active-name"
                className="text-sm font-bold text-white leading-tight"
              >
                {statement.supplierName}
              </div>
              {statement.contactNumber ? (
                <div className="text-[11px] text-slate-300 font-mono flex items-center justify-end gap-1">
                  <Phone className="w-3 h-3 text-[#5eead4]" aria-hidden="true" />
                  <span>{statement.contactNumber}</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-300">Verified Supplier Account</div>
              )}
            </div>
            <button
              type="button"
              data-testid="supplier-portal-signout-btn"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E3247] hover:bg-rose-700 text-white border border-slate-500/40 text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Mobile Supplier Identity Strip */}
        <div className="sm:hidden bg-white border border-[#CBD8E6] rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Supplier Account
            </div>
            <div className="text-sm font-bold text-[#0F172A]">{statement.supplierName}</div>
          </div>
          {statement.contactNumber && (
            <span className="text-xs font-mono text-slate-600">{statement.contactNumber}</span>
          )}
        </div>

        {/* Summary KPI Strip — Single Elevation, Tabular Numerals */}
        <section
          aria-label="Account Financial Summary"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
        >
          <div className="bg-white border border-[#CBD8E6] rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Purchased (Debit)
            </div>
            <div
              data-testid="supplier-kpi-debit"
              className="mt-1.5 text-xl font-black text-[#0F172A] tabular-nums font-mono"
            >
              {formatCurrency(statement.overallTotals.totalDebit, currency)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {statement.invoices.length} purchase invoice{statement.invoices.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="bg-white border border-[#CBD8E6] rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Paid &amp; Credited
            </div>
            <div
              data-testid="supplier-kpi-credit"
              className="mt-1.5 text-xl font-black text-emerald-700 tabular-nums font-mono"
            >
              {formatCurrency(statement.overallTotals.totalCredit, currency)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {statement.paymentVouchers.length} voucher{statement.paymentVouchers.length === 1 ? '' : 's'}
              {statement.creditNotes.length > 0 ? ` · ${statement.creditNotes.length} credit note${statement.creditNotes.length === 1 ? '' : 's'}` : ''}
            </div>
          </div>

          <div className="bg-white border border-[#CBD8E6] rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Closing / Due Balance
            </div>
            <div
              data-testid="supplier-kpi-balance"
              className={`mt-1.5 text-xl font-black tabular-nums font-mono ${
                overallDue > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(overallDue, currency)}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {overallDue > 0 ? 'Payable Balance Remaining' : overallDue < 0 ? 'Advance / Overpaid Credit' : 'Account Fully Settled'}
            </div>
          </div>

          <div className="bg-white border border-[#CBD8E6] rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Ledger Entries
            </div>
            <div
              data-testid="supplier-kpi-entries"
              className="mt-1.5 text-xl font-black text-[#273E56] tabular-nums font-mono"
            >
              {statement.overallTotals.recordCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Status:{' '}
              <span className="font-bold text-slate-800">
                {statement.overallTotals.computedOverallStatus}
              </span>
            </div>
          </div>
        </section>

        {/* Primary View Tabs + Export Actions */}
        <section className="bg-white border border-[#CBD8E6] rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 pt-3 border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] print:hidden">
            <nav aria-label="Supplier Portal Sections" className="flex items-center gap-2 pb-2.5">
              <button
                type="button"
                data-testid="supplier-tab-statement"
                onClick={() => setActiveTab('statement')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'statement'
                    ? 'ring-2 ring-[#273E56] ring-offset-1 shadow-md'
                    : 'opacity-55 hover:opacity-85'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ledger Statement ({statement.rows.length})</span>
              </button>

              <button
                type="button"
                data-testid="supplier-tab-invoices"
                onClick={() => setActiveTab('invoices')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'invoices'
                    ? 'ring-2 ring-[#273E56] ring-offset-1 shadow-md'
                    : 'opacity-55 hover:opacity-85'
                }`}
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Invoices &amp; Bills ({statement.invoices.length})</span>
              </button>

              <button
                type="button"
                data-testid="supplier-tab-receipts"
                onClick={() => setActiveTab('receipts')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'receipts'
                    ? 'ring-2 ring-[#273E56] ring-offset-1 shadow-md'
                    : 'opacity-55 hover:opacity-85'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Payment Receipts ({statement.paymentVouchers.length})</span>
              </button>
            </nav>

            {activeTab === 'statement' && (
              <div className="flex flex-wrap items-center gap-2 pb-2.5">
                <button
                  type="button"
                  data-testid="supplier-download-statement-pdf-btn"
                  onClick={handleDownloadStatementPdf}
                  disabled={statement.rows.length === 0 || isDownloadingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00897b] hover:bg-[#007367] text-white text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-40 transition cursor-pointer"
                >
                  {downloadingTarget === 'statement' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{downloadingTarget === 'statement' ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  data-testid="supplier-export-csv-btn"
                  onClick={handleDownloadStatementCSV}
                  disabled={statement.rows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-[#CBD8E6] text-[#0F172A] text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-40 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  data-testid="supplier-print-statement-btn"
                  onClick={() =>
                    handlePrintElement(
                      'supplier-portal-printable-statement',
                      `${statement.supplierName} - Ledger Statement`
                    )
                  }
                  disabled={statement.rows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#273E56] hover:bg-[#1E3247] text-white text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-40 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print Statement</span>
                </button>
              </div>
            )}
          </div>

          {pdfFeedback && (
            <div
              role="status"
              aria-live="polite"
              data-testid="supplier-pdf-export-status"
              className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 print:hidden"
            >
              <span>{pdfFeedback}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setPdfFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* TAB 1: LEDGER STATEMENT */}
          {activeTab === 'statement' && (
            <div>
              {/* Filter Bar */}
              <div className="p-4 border-b border-[#CBD8E6] bg-white flex flex-wrap items-end gap-3 print:hidden">
                <div className="flex-1 min-w-[200px]">
                  <label
                    htmlFor="supplier-ledger-search"
                    className="block text-[11px] font-bold text-slate-600 mb-1"
                  >
                    Search Invoice or Reference
                  </label>
                  <div className="relative">
                    <Search
                      className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="supplier-ledger-search"
                      data-testid="supplier-ledger-search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter by invoice number or details..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD8E6] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D6CE0]"
                    />
                  </div>
                </div>

                <div className="w-36">
                  <label
                    htmlFor="supplier-ledger-from-date"
                    className="block text-[11px] font-bold text-slate-600 mb-1"
                  >
                    From Date
                  </label>
                  <div className="relative">
                    <input
                      id="supplier-ledger-from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[#F8FAFC] border border-[#CBD8E6] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D6CE0]"
                    />
                  </div>
                </div>

                <div className="w-36">
                  <label
                    htmlFor="supplier-ledger-to-date"
                    className="block text-[11px] font-bold text-slate-600 mb-1"
                  >
                    To Date
                  </label>
                  <input
                    id="supplier-ledger-to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-[#F8FAFC] border border-[#CBD8E6] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D6CE0]"
                  />
                </div>

                <div className="w-40">
                  <label
                    htmlFor="supplier-ledger-type"
                    className="block text-[11px] font-bold text-slate-600 mb-1"
                  >
                    Entry Type
                  </label>
                  <select
                    id="supplier-ledger-type"
                    value={recordTypeFilter}
                    onChange={(e) =>
                      setRecordTypeFilter(e.target.value as 'ALL' | SupplierRecordType)
                    }
                    className="w-full px-2.5 py-2 text-xs bg-[#F8FAFC] border border-[#CBD8E6] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D6CE0]"
                  >
                    <option value="ALL">All Transactions</option>
                    <option value="PURCHASE_BILL">Purchase Invoices</option>
                    <option value="PAYMENT_VOUCHER">Payment Vouchers</option>
                    <option value="CREDIT_NOTE">Credit Notes</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Printable Statement Area */}
              <div id="supplier-portal-printable-statement" className="bg-white">
                {/* Print-only Company Letterhead */}
                <div className="hidden print:block p-5 border-b border-slate-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#273E56]">
                        {companyProfile.companyName}
                      </h2>
                      <p className="text-xs text-slate-600">{companyProfile.address}</p>
                      <p className="text-xs text-slate-600">
                        Tel: {(companyProfile.mobiles || []).join(', ')}
                        {companyProfile.email ? ` | ${companyProfile.email}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black uppercase text-[#273E56]">
                        Supplier Ledger Statement
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-1">
                        Supplier: {statement.supplierName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Printed: {formatDate(new Date().toISOString().slice(0, 10))}
                      </div>
                    </div>
                  </div>
                </div>

                {statement.rows.length === 0 ? (
                  <div
                    data-testid="supplier-statement-empty"
                    className="py-12 px-6 text-center space-y-2"
                  >
                    <Calendar className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-700">
                      {hasActiveFilters
                        ? 'No ledger entries match your current filter'
                        : 'No transactions recorded yet'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {hasActiveFilters
                        ? 'Try widening your date range or clearing the search term to view all transactions.'
                        : 'Your purchase invoices and payment settlements will appear here automatically once recorded.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#273E56] text-white text-xs font-bold cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Clear Filters</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table
                      data-testid="supplier-ledger-table"
                      className="w-full text-left border-collapse text-xs"
                    >
                      <thead>
                        <tr className="bg-[#273E56] text-white text-[10px] uppercase tracking-wider">
                          <th className="py-2.5 px-2 font-bold text-center w-10">#</th>
                          <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">Date</th>
                          <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">Invoice / Ref</th>
                          <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">Type</th>
                          <th className="py-2.5 px-2.5 font-bold">Details</th>
                          <th className="py-2.5 px-2.5 font-bold text-right whitespace-nowrap">
                            Purchase ({currency})
                          </th>
                          <th className="py-2.5 px-2.5 font-bold text-right whitespace-nowrap">
                            Paid ({currency})
                          </th>
                          <th className="py-2.5 px-2.5 font-bold text-right whitespace-nowrap">
                            Running Bal. ({currency})
                          </th>
                          <th className="py-2.5 px-2 font-bold text-center whitespace-nowrap">
                            Status
                          </th>
                          <th className="py-2.5 px-2.5 font-bold text-center whitespace-nowrap print:hidden">
                            Document
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {statement.rows.map((row, index) => {
                          const canOpenDoc =
                            row.recordType === 'PURCHASE_BILL' ||
                            row.recordType === 'PAYMENT_VOUCHER';
                          return (
                            <tr
                              key={row.id}
                              data-testid="supplier-ledger-row"
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-500">
                                {index + 1}
                              </td>
                              <td className="py-2 px-2.5 font-mono tabular-nums whitespace-nowrap text-slate-700">
                                {formatDate(row.date)}
                              </td>
                              <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap text-[#273E56]">
                                {row.invoiceNumber}
                              </td>
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    row.recordType === 'PURCHASE_BILL'
                                      ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                      : row.recordType === 'PAYMENT_VOUCHER'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {formatSupplierRecordTypeLabel(row.recordType)}
                                </span>
                              </td>
                              <td
                                title={row.description}
                                className="py-2 px-2.5 text-slate-700 max-w-[180px] truncate"
                              >
                                {row.description}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                {row.debitAmount > 0 ? formatCurrency(row.debitAmount, currency) : '—'}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                                {row.creditAmount > 0
                                  ? formatCurrency(row.creditAmount, currency)
                                  : '—'}
                              </td>
                              <td
                                className={`py-2 px-2.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                  row.runningBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                                }`}
                              >
                                {formatCurrency(row.runningBalance, currency)}
                              </td>
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    row.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-center whitespace-nowrap print:hidden">
                                {canOpenDoc ? (
                                  <button
                                    type="button"
                                    data-testid={`open-doc-${row.invoiceNumber}`}
                                    onClick={() =>
                                      handleOpenRowDocument(
                                        row.recordType,
                                        row.invoiceNumber,
                                        row.paymentId
                                      )
                                    }
                                    className="inline-flex items-center gap-1 !px-2.5 !py-1 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    <span>View</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#F8FAFC] border-t-2 border-[#273E56] font-bold text-xs">
                          <td colSpan={5} className="py-3 px-2.5 text-right uppercase text-slate-700">
                            Period Totals ({statement.filteredTotals.recordCount} entries)
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono tabular-nums text-[#0F172A] whitespace-nowrap">
                            {formatCurrency(statement.filteredTotals.totalDebit, currency)}
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                            {formatCurrency(statement.filteredTotals.totalCredit, currency)}
                          </td>
                          <td
                            className={`py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                              statement.filteredTotals.totalBalance > 0
                                ? 'text-rose-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatCurrency(statement.filteredTotals.totalBalance, currency)}
                          </td>
                          <td colSpan={2} className="py-3 px-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INVOICES & BILLS */}
          {activeTab === 'invoices' && (
            <div className="p-4 sm:p-5">
              {statement.invoices.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-700">No purchase invoices yet</h3>
                  <p className="text-xs text-slate-500">
                    When purchase bills are issued for {statement.supplierName}, you can inspect and download every itemized invoice here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    data-testid="supplier-invoices-table"
                    className="w-full text-left border-collapse text-xs"
                  >
                    <thead>
                      <tr className="bg-[#273E56] text-white text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 font-bold text-center w-12">S. No.</th>
                        <th className="py-2.5 px-3 font-bold">Date</th>
                        <th className="py-2.5 px-3 font-bold">Invoice No</th>
                        <th className="py-2.5 px-3 font-bold">Items / Grades</th>
                        <th className="py-2.5 px-3 font-bold text-right">Qty (KG)</th>
                        <th className="py-2.5 px-3 font-bold text-right">Bill Amount ({currency})</th>
                        <th className="py-2.5 px-3 font-bold text-right">Paid ({currency})</th>
                        <th className="py-2.5 px-3 font-bold text-right">Balance ({currency})</th>
                        <th className="py-2.5 px-3 font-bold text-center">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {statement.invoices.map((inv, idx) => {
                        const itemsSummary = (inv.items || [])
                          .map((it) => `${it.item || 'Item'} (${it.quantity} KG)`)
                          .join(', ');
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                              {formatDate(inv.date)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#273E56] whitespace-nowrap">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                              {itemsSummary || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {Number(inv.totalQty || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#0F172A]">
                              {formatCurrency(inv.totalAmount, currency)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                              {formatCurrency(inv.paidAmount, currency)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                                inv.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                              }`}
                            >
                              {formatCurrency(inv.balance, currency)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={`view-invoice-${inv.invoiceNumber}`}
                                  onClick={() => {
                                    setSelectedPaymentId(null);
                                    setSelectedInvoiceId(inv.id);
                                  }}
                                  className="inline-flex items-center gap-1 !px-2.5 !py-1 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  data-testid={`download-invoice-pdf-${inv.invoiceNumber}`}
                                  disabled={isDownloadingPdf}
                                  onClick={() => handleDirectDownloadInvoicePdf(inv.id)}
                                  className="inline-flex items-center gap-1 !px-2.5 !py-1 text-[10px] font-bold whitespace-nowrap disabled:opacity-50 transition cursor-pointer"
                                >
                                  {downloadingTarget === inv.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />
                                  ) : (
                                    <Download className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  )}
                                  <span>Download PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAYMENT RECEIPTS */}
          {activeTab === 'receipts' && (
            <div className="p-4 sm:p-5">
              {statement.paymentVouchers.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-700">No payment vouchers yet</h3>
                  <p className="text-xs text-slate-500">
                    Standalone supplier payment vouchers recorded for your account will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#273E56] text-white text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 font-bold text-center w-12">S. No.</th>
                        <th className="py-2.5 px-3 font-bold">Date</th>
                        <th className="py-2.5 px-3 font-bold">Voucher No</th>
                        <th className="py-2.5 px-3 font-bold text-right">Paid Amount ({currency})</th>
                        <th className="py-2.5 px-3 font-bold text-center">Status</th>
                        <th className="py-2.5 px-3 font-bold">Remarks</th>
                        <th className="py-2.5 px-3 font-bold text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {statement.paymentVouchers.map((pm, idx) => (
                        <tr key={pm.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                            {formatDate(pm.date)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#273E56]">
                            {pm.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                            {formatCurrency(pm.paidAmount, currency)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {pm.status || 'PAID'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {pm.remarks || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              data-testid={`view-receipt-${pm.invoiceNumber}`}
                              onClick={() => {
                                setSelectedInvoiceId(null);
                                setSelectedPaymentId(pm.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#273E56] hover:bg-[#1D6CE0] text-white text-[11px] font-bold transition cursor-pointer"
                            >
                              <Eye className="w-3 h-3" aria-hidden="true" />
                              <span>View Receipt</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ITEMIZED PURCHASE INVOICE MODAL */}
      {selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-invoice-modal-title"
          data-testid="supplier-invoice-modal"
          className="fixed inset-0 z-50 bg-slate-950/75 overflow-y-auto flex items-center justify-center p-3 sm:p-6"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[94vh]">
            <div className="bg-[#273E56] text-white px-5 py-3.5 flex items-center justify-between gap-3 border-b border-[#1E3247]">
              <h2 id="supplier-invoice-modal-title" className="text-sm font-bold tracking-tight">
                Purchase Invoice · {selectedInvoice.invoiceNumber}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="supplier-invoice-download-pdf-btn"
                  disabled={isDownloadingPdf}
                  onClick={() =>
                    handleExportPdfElement(
                      'supplier-portal-printable-invoice',
                      formatSupplierInvoicePdfFilename(
                        selectedInvoice.invoiceNumber,
                        statement.supplierName
                      ),
                      `modal-${selectedInvoice.id}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00897b] hover:bg-[#007367] text-white text-xs font-bold whitespace-nowrap disabled:opacity-50 transition cursor-pointer"
                >
                  {downloadingTarget === `modal-${selectedInvoice.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  data-testid="supplier-invoice-print-btn"
                  onClick={() =>
                    handlePrintElement(
                      'supplier-portal-printable-invoice',
                      `Invoice ${selectedInvoice.invoiceNumber}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D6CE0] hover:bg-[#1558BA] text-white text-xs font-bold whitespace-nowrap transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  data-testid="supplier-invoice-close-btn"
                  aria-label="Close invoice viewer"
                  onClick={() => setSelectedInvoiceId(null)}
                  className="p-1.5 rounded-lg bg-[#1E3247] hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-7 overflow-y-auto bg-white">
              <div id="supplier-portal-printable-invoice" className="bg-white text-slate-900 space-y-5">
                {/* Company & Invoice Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#273E56] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-300 bg-white p-0.5 shrink-0">
                      <img
                        src={resolvedLogoSrc}
                        alt={companyProfile.companyName}
                        className="w-full h-full object-contain rounded-full"
                      />
                    </div>
                    <div>
                      <div className="text-lg font-black text-[#273E56]">
                        {companyProfile.companyName}
                      </div>
                      <div className="text-xs text-slate-600">{companyProfile.address}</div>
                      <div className="text-[11px] text-slate-500">
                        {(companyProfile.mobiles || []).join(', ')}
                        {companyProfile.email ? ` · ${companyProfile.email}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Purchase Challan / Invoice
                    </div>
                    <div className="text-base font-black font-mono text-[#273E56]">
                      {selectedInvoice.invoiceNumber}
                    </div>
                    <div className="text-xs font-mono text-slate-600 mt-0.5">
                      Date: {formatDate(selectedInvoice.date)}
                    </div>
                  </div>
                </div>

                {/* Supplier Meta Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8FAFC] border border-slate-200 rounded-lg p-3.5 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Supplier Name</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {selectedInvoice.description}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Contact Number
                    </div>
                    <div className="font-mono font-semibold text-slate-800 mt-0.5">
                      {selectedInvoice.contactNumber || statement.contactNumber || '—'}
                    </div>
                  </div>
                </div>

                {/* Itemized Lines Table */}
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#273E56] text-white text-[11px] uppercase">
                        <th className="py-2 px-3 text-center w-12">S. No.</th>
                        <th className="py-2 px-3">Item / Grade</th>
                        <th className="py-2 px-3 text-right">Qty (KG)</th>
                        <th className="py-2 px-3 text-right">Rate ({currency})</th>
                        <th className="py-2 px-3 text-right">Amount ({currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(selectedInvoice.items || []).map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">{item.item || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {Number(item.quantity || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatCurrency(item.rate, currency)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-bold">
                            {formatCurrency(item.totalAmount, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Totals Breakdown */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-1">
                  <div className="flex-1 text-xs">
                    {selectedInvoice.remarks && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Remarks / Notes
                        </div>
                        <p className="text-slate-700">{selectedInvoice.remarks}</p>
                      </div>
                    )}
                  </div>

                  <div className="w-full sm:w-72 border border-slate-300 rounded-lg divide-y divide-slate-200 text-xs">
                    <div className="px-3.5 py-2 flex items-center justify-between">
                      <span className="text-slate-600 font-semibold">Total Quantity</span>
                      <span className="font-mono tabular-nums font-bold">
                        {Number(selectedInvoice.totalQty || 0).toLocaleString()} KG
                      </span>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between">
                      <span className="text-slate-600 font-semibold">Current Bill Total</span>
                      <span className="font-mono tabular-nums font-bold">
                        {formatCurrency(selectedInvoice.totalAmount, currency)}
                      </span>
                    </div>
                    {Number(selectedInvoice.previousAmount || 0) !== 0 && (
                      <div className="px-3.5 py-2 flex items-center justify-between">
                        <span className="text-slate-600 font-semibold">Previous Balance</span>
                        <span className="font-mono tabular-nums font-semibold">
                          {formatCurrency(selectedInvoice.previousAmount, currency)}
                        </span>
                      </div>
                    )}
                    <div className="px-3.5 py-2 flex items-center justify-between text-emerald-700">
                      <span className="font-semibold">Paid on Invoice</span>
                      <span className="font-mono tabular-nums font-bold">
                        {formatCurrency(selectedInvoice.paidAmount, currency)}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between bg-[#F8FAFC] font-black text-sm">
                      <span className="text-[#273E56]">Invoice Balance</span>
                      <span
                        className={`font-mono tabular-nums ${
                          selectedInvoice.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(selectedInvoice.balance, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT VOUCHER RECEIPT MODAL */}
      {selectedPayment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-receipt-modal-title"
          data-testid="supplier-receipt-modal"
          className="fixed inset-0 z-50 bg-slate-950/75 overflow-y-auto flex items-center justify-center p-3 sm:p-6"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[94vh]">
            <div className="bg-[#273E56] text-white px-5 py-3.5 flex items-center justify-between gap-3 border-b border-[#1E3247]">
              <h2 id="supplier-receipt-modal-title" className="text-sm font-bold tracking-tight">
                Payment Receipt · {selectedPayment.invoiceNumber}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="supplier-receipt-download-pdf-btn"
                  disabled={isDownloadingPdf}
                  onClick={() =>
                    handleExportPdfElement(
                      'supplier-portal-printable-receipt',
                      formatSupplierReceiptPdfFilename(
                        selectedPayment.invoiceNumber,
                        statement.supplierName
                      ),
                      `receipt-${selectedPayment.id}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00897b] hover:bg-[#007367] text-white text-xs font-bold whitespace-nowrap disabled:opacity-50 transition cursor-pointer"
                >
                  {downloadingTarget === `receipt-${selectedPayment.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePrintElement(
                      'supplier-portal-printable-receipt',
                      `Payment Receipt ${selectedPayment.invoiceNumber}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D6CE0] hover:bg-[#1558BA] text-white text-xs font-bold whitespace-nowrap transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  aria-label="Close payment receipt viewer"
                  onClick={() => setSelectedPaymentId(null)}
                  className="p-1.5 rounded-lg bg-[#1E3247] hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-7 overflow-y-auto bg-white">
              <div id="supplier-portal-printable-receipt" className="bg-white text-slate-900 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#273E56] pb-4">
                  <div>
                    <div className="text-lg font-black text-[#273E56]">
                      {companyProfile.companyName}
                    </div>
                    <div className="text-xs text-slate-600">{companyProfile.address}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Supplier Payment Voucher
                    </div>
                    <div className="text-base font-black font-mono text-[#273E56]">
                      {selectedPayment.invoiceNumber}
                    </div>
                    <div className="text-xs font-mono text-slate-600 mt-0.5">
                      Date: {formatDate(selectedPayment.date)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8FAFC] border border-slate-200 rounded-lg p-4 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Paid To Supplier</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {selectedPayment.description}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Status</div>
                    <div className="font-bold text-emerald-700 mt-0.5">
                      {selectedPayment.status || 'PAID'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Amount Paid</div>
                    <div className="text-lg font-black font-mono tabular-nums text-emerald-700 mt-0.5">
                      {formatCurrency(selectedPayment.paidAmount, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Remaining Balance at Voucher Date
                    </div>
                    <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {formatCurrency(selectedPayment.balance, currency)}
                    </div>
                  </div>
                </div>

                {selectedPayment.remarks && (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Payment Remarks
                    </div>
                    <p className="text-slate-700">{selectedPayment.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* OFFSCREEN CLEAN A4 PDF DOCUMENT HOST (Mounted only during PDF export) */}
      {offscreenPdfMode && (
        <div
          aria-hidden="true"
          className="fixed -left-[99999px] top-0 pointer-events-none select-none z-[-1]"
        >
          <div
            id="supplier-portal-offscreen-pdf-sheet"
            className="w-[820px] bg-white text-slate-900 p-7 space-y-5 font-sans"
          >
            {/* Official Company Letterhead */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-[#273E56] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-300 bg-white p-0.5 shrink-0">
                  <img
                    src={resolvedLogoSrc}
                    alt={companyProfile.companyName}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div>
                  <div className="text-lg font-black text-[#273E56]">
                    {companyProfile.companyName}
                  </div>
                  <div className="text-xs text-slate-600">{companyProfile.address}</div>
                  <div className="text-[11px] text-slate-500">
                    {(companyProfile.mobiles || []).join(', ')}
                    {companyProfile.email ? ` · ${companyProfile.email}` : ''}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {offscreenPdfMode.kind === 'statement'
                    ? 'Supplier Account Ledger Statement'
                    : 'Purchase Challan / Invoice'}
                </div>
                <div className="text-base font-black text-[#273E56]">
                  {offscreenPdfMode.kind === 'statement'
                    ? statement.supplierName
                    : offscreenPdfMode.invoice.invoiceNumber}
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                  {offscreenPdfMode.kind === 'statement'
                    ? `Generated: ${formatDate(new Date().toISOString().slice(0, 10))}`
                    : `Date: ${formatDate(offscreenPdfMode.invoice.date)}`}
                </div>
              </div>
            </div>

            {offscreenPdfMode.kind === 'statement' ? (
              <>
                {/* Statement Metadata & Summary Totals */}
                <div className="grid grid-cols-4 gap-3 bg-[#F8FAFC] border border-slate-200 rounded-lg p-3.5 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Supplier</div>
                    <div className="font-bold text-slate-900 mt-0.5">{statement.supplierName}</div>
                    {statement.contactNumber && (
                      <div className="text-[10px] font-mono text-slate-600">
                        {statement.contactNumber}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Total Purchased
                    </div>
                    <div className="font-mono font-black text-slate-900 mt-0.5">
                      {formatCurrency(statement.filteredTotals.totalDebit, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Total Paid / Credit
                    </div>
                    <div className="font-mono font-black text-emerald-700 mt-0.5">
                      {formatCurrency(statement.filteredTotals.totalCredit, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Closing Balance
                    </div>
                    <div
                      className={`font-mono font-black mt-0.5 ${
                        statement.overallTotals.totalBalance > 0
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(statement.overallTotals.totalBalance, currency)}
                    </div>
                  </div>
                </div>

                {(fromDate || toDate || recordTypeFilter !== 'ALL' || searchQuery.trim()) && (
                  <div className="text-[11px] text-slate-600 font-medium">
                    Applied Filter:{' '}
                    {fromDate ? `From ${formatDate(fromDate)} ` : ''}
                    {toDate ? `To ${formatDate(toDate)} ` : ''}
                    {recordTypeFilter !== 'ALL'
                      ? `Type: ${formatSupplierRecordTypeLabel(recordTypeFilter)} `
                      : ''}
                    {searchQuery.trim() ? `Search: "${searchQuery.trim()}"` : ''}
                  </div>
                )}

                <table className="w-full text-left border-collapse text-[11px] border border-slate-300">
                  <thead>
                    <tr className="bg-[#273E56] text-white text-[10px] uppercase">
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Invoice / Ref</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">Details</th>
                      <th className="py-2 px-2 text-right">Purchase ({currency})</th>
                      <th className="py-2 px-2 text-right">Paid ({currency})</th>
                      <th className="py-2 px-2 text-right">Running Bal. ({currency})</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {statement.rows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="py-2 px-2 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2 font-mono whitespace-nowrap">
                          {formatDate(row.date)}
                        </td>
                        <td className="py-2 px-2 font-mono font-bold whitespace-nowrap text-[#273E56]">
                          {row.invoiceNumber}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap font-semibold">
                          {formatSupplierRecordTypeLabel(row.recordType)}
                        </td>
                        <td className="py-2 px-2 text-slate-700">{row.description}</td>
                        <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                          {row.debitAmount > 0 ? formatCurrency(row.debitAmount, currency) : '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono whitespace-nowrap text-emerald-700">
                          {row.creditAmount > 0 ? formatCurrency(row.creditAmount, currency) : '—'}
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-mono font-bold whitespace-nowrap ${
                            row.runningBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatCurrency(row.runningBalance, currency)}
                        </td>
                        <td className="py-2 px-2 text-center font-bold whitespace-nowrap">
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#F8FAFC] border-t-2 border-[#273E56] font-bold">
                      <td colSpan={5} className="py-2.5 px-2 text-right uppercase">
                        Period Totals ({statement.filteredTotals.recordCount} entries)
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                        {formatCurrency(statement.filteredTotals.totalDebit, currency)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap text-emerald-700">
                        {formatCurrency(statement.filteredTotals.totalCredit, currency)}
                      </td>
                      <td
                        className={`py-2.5 px-2 text-right font-mono whitespace-nowrap ${
                          statement.filteredTotals.totalBalance > 0
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(statement.filteredTotals.totalBalance, currency)}
                      </td>
                      <td className="py-2.5 px-2" />
                    </tr>
                  </tfoot>
                </table>
              </>
            ) : (
              <>
                {/* Direct Invoice Export Content */}
                <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] border border-slate-200 rounded-lg p-3.5 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Supplier Name</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {offscreenPdfMode.invoice.description}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Contact Number</div>
                    <div className="font-mono font-semibold text-slate-800 mt-0.5">
                      {offscreenPdfMode.invoice.contactNumber || statement.contactNumber || '—'}
                    </div>
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-[#273E56] text-white text-[11px] uppercase">
                      <th className="py-2 px-3 text-center w-12">S. No.</th>
                      <th className="py-2 px-3">Item / Grade</th>
                      <th className="py-2 px-3 text-right">Qty (KG)</th>
                      <th className="py-2 px-3 text-right">Rate ({currency})</th>
                      <th className="py-2 px-3 text-right">Amount ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(offscreenPdfMode.invoice.items || []).map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{item.item || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {Number(item.quantity || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(item.rate, currency)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {formatCurrency(item.totalAmount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 text-xs">
                    {offscreenPdfMode.invoice.remarks && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Remarks / Notes
                        </div>
                        <p className="text-slate-700">{offscreenPdfMode.invoice.remarks}</p>
                      </div>
                    )}
                  </div>
                  <div className="w-72 border border-slate-300 rounded-lg divide-y divide-slate-200 text-xs">
                    <div className="px-3.5 py-2 flex items-center justify-between">
                      <span className="text-slate-600 font-semibold">Total Quantity</span>
                      <span className="font-mono font-bold">
                        {Number(offscreenPdfMode.invoice.totalQty || 0).toLocaleString()} KG
                      </span>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between">
                      <span className="text-slate-600 font-semibold">Current Bill Total</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(offscreenPdfMode.invoice.totalAmount, currency)}
                      </span>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between text-emerald-700">
                      <span className="font-semibold">Paid on Invoice</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(offscreenPdfMode.invoice.paidAmount, currency)}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between bg-[#F8FAFC] font-black text-sm">
                      <span className="text-[#273E56]">Invoice Balance</span>
                      <span
                        className={`font-mono ${
                          offscreenPdfMode.invoice.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(offscreenPdfMode.invoice.balance, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
