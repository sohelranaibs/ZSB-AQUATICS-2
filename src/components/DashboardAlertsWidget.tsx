import React, { useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Repeat,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  buildNextCyclePaymentPatch,
  UpcomingRecurringPaymentItem,
} from '../utils/recurringPayments.ts';
import {
  BUSINESS_DOCUMENT_CATEGORIES,
  buildDashboardAlertsReport,
  DashboardAlertCategory,
  DashboardAlertItem,
  DEFAULT_DOCUMENT_ALERT_WINDOW_DAYS,
  DEFAULT_MIN_TOTAL_BALANCE_THRESHOLD,
  extendDocumentExpiryByOneYear,
  filterDashboardAlerts,
  getDocumentExpiryStatus,
  validateBusinessDocumentInput,
} from '../utils/dashboardAlerts.ts';
import { BusinessDocumentRecord } from '../types/index.ts';

interface DashboardAlertsWidgetProps {
  totalBalance: number;
}

type AlertFilterTab = 'all' | DashboardAlertCategory;

export const DashboardAlertsWidget: React.FC<DashboardAlertsWidgetProps> = ({
  totalBalance,
}) => {
  const {
    companyProfile,
    updateCompanyProfile,
    businessDocuments,
    addBusinessDocument,
    updateBusinessDocument,
    deleteBusinessDocument,
    payments,
    updatePayment,
    recurringExpenses,
    otherCosts,
    externalDebts,
    deductRecurringExpenseNow,
    setActiveTab,
    showToast,
  } = useApp();

  const currency = companyProfile.currency || 'TK';
  const minThreshold =
    companyProfile.minTotalBalanceThreshold ?? DEFAULT_MIN_TOTAL_BALANCE_THRESHOLD;
  const docWindowDays =
    companyProfile.documentAlertWindowDays ?? DEFAULT_DOCUMENT_ALERT_WINDOW_DAYS;

  const [activeFilter, setActiveFilter] = useState<AlertFilterTab>('all');
  const [showAddDocPanel, setShowAddDocPanel] = useState(false);
  const [showDocsDrawer, setShowDocsDrawer] = useState(false);
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);

  // Add Document Form State
  const titleId = useId();
  const categoryId = useId();
  const refId = useId();
  const issueDateId = useId();
  const expiryDateId = useId();
  const notesId = useId();
  const thresholdInputId = useId();
  const windowInputId = useId();

  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<string>(BUSINESS_DOCUMENT_CATEGORIES[0]);
  const [docRefNumber, setDocRefNumber] = useState('');
  const [docIssueDate, setDocIssueDate] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docFormError, setDocFormError] = useState('');

  // Threshold Settings State
  const [thresholdDraft, setThresholdDraft] = useState<string>(() => String(minThreshold));
  const [windowDraft, setWindowDraft] = useState<string>(() => String(docWindowDays));
  const [thresholdError, setThresholdError] = useState('');

  const report = useMemo(
    () =>
      buildDashboardAlertsReport({
        documents: businessDocuments,
        payments,
        recurringExpenses,
        otherCosts,
        externalDebts,
        totalBalance,
        minTotalBalanceThreshold: minThreshold,
        documentAlertWindowDays: docWindowDays,
        currency,
      }),
    [
      businessDocuments,
      payments,
      recurringExpenses,
      otherCosts,
      externalDebts,
      totalBalance,
      minThreshold,
      docWindowDays,
      currency,
    ]
  );

  const visibleAlerts = useMemo(
    () => filterDashboardAlerts(report.items, activeFilter),
    [report.items, activeFilter]
  );

  const trackedDocumentsWithStatus = useMemo(
    () =>
      [...businessDocuments]
        .map((doc) => getDocumentExpiryStatus(doc, report.referenceDate, docWindowDays))
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [businessDocuments, report.referenceDate, docWindowDays]
  );

  const handleOpenThresholdEditor = () => {
    setThresholdDraft(String(minThreshold));
    setWindowDraft(String(docWindowDays));
    setThresholdError('');
    setShowThresholdEditor((prev) => !prev);
  };

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedThreshold = Number(thresholdDraft);
    const parsedWindow = Math.floor(Number(windowDraft));

    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      setThresholdError('Minimum Total Balance threshold must be 0 or greater.');
      return;
    }
    if (!Number.isFinite(parsedWindow) || parsedWindow < 1 || parsedWindow > 365) {
      setThresholdError('Document expiry alert window must be between 1 and 365 days.');
      return;
    }

    updateCompanyProfile({
      minTotalBalanceThreshold: Math.round(parsedThreshold * 100) / 100,
      documentAlertWindowDays: parsedWindow,
    });
    setThresholdError('');
    setShowThresholdEditor(false);
    showToast(
      `Updated alert thresholds: Min Total Balance ${formatCurrency(parsedThreshold, currency)} · Document window ${parsedWindow} days.`
    );
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateBusinessDocumentInput({
      title: docTitle,
      category: docCategory,
      referenceNumber: docRefNumber,
      issueDate: docIssueDate,
      expiryDate: docExpiryDate,
      notes: docNotes,
    });

    if (!validation.valid) {
      setDocFormError(validation.error || 'Please check document fields.');
      return;
    }

    addBusinessDocument({
      title: validation.cleanTitle!,
      category: validation.cleanCategory!,
      referenceNumber: validation.cleanReferenceNumber,
      issueDate: validation.cleanIssueDate,
      expiryDate: validation.cleanExpiryDate!,
      notes: validation.cleanNotes,
    });

    setDocTitle('');
    setDocCategory(BUSINESS_DOCUMENT_CATEGORIES[0]);
    setDocRefNumber('');
    setDocIssueDate('');
    setDocExpiryDate('');
    setDocNotes('');
    setDocFormError('');
    setShowAddDocPanel(false);
  };

  const handleRenewDocument = (doc: BusinessDocumentRecord) => {
    const nextExpiry = extendDocumentExpiryByOneYear(doc.expiryDate, report.referenceDate);
    updateBusinessDocument(doc.id, { expiryDate: nextExpiry });
  };

  const handleSettleSupplierVoucher = (item: UpcomingRecurringPaymentItem) => {
    const patch = buildNextCyclePaymentPatch(item);
    updatePayment(item.id, patch);
    showToast(
      `Settled ${item.supplierName} (${item.invoiceNumber}) for ${formatDate(item.dueDate)}. Next due date rolled to ${formatDate(item.nextProjectedDate)}.`
    );
  };

  const handleRunRecurringAlertAction = (alert: DashboardAlertItem) => {
    if (alert.category === 'expiring_document' && alert.rawDocument) {
      handleRenewDocument(alert.rawDocument);
      return;
    }
    if (alert.category === 'recurring_payment') {
      if (alert.recurringSource === 'supplier_voucher' && alert.recurringPaymentItem) {
        handleSettleSupplierVoucher(alert.recurringPaymentItem);
        return;
      }
      if (alert.recurringSource === 'recurring_expense' && alert.recurringExpenseRuleId) {
        deductRecurringExpenseNow(alert.recurringExpenseRuleId);
        return;
      }
      setActiveTab('total_balance');
      return;
    }
    if (alert.category === 'low_balance') {
      setActiveTab('total_balance');
    }
  };

  const renderAlertActionLabel = (alert: DashboardAlertItem): string => {
    if (alert.category === 'expiring_document') return 'Renew +1 Yr';
    if (alert.category === 'recurring_payment') {
      if (alert.recurringSource === 'supplier_voucher') return 'Settle & Roll';
      if (alert.recurringSource === 'recurring_expense') return 'Deduct Now';
      return 'Open Debts';
    }
    return 'Open Balance';
  };

  const filterTabs: Array<{
    id: AlertFilterTab;
    label: string;
    count: number;
    testId: string;
  }> = [
    {
      id: 'all',
      label: `All Alerts (${report.counts.total})`,
      count: report.counts.total,
      testId: 'alerts-filter-all',
    },
    {
      id: 'expiring_document',
      label: `Expiring Docs (${report.counts.expiringDocuments})`,
      count: report.counts.expiringDocuments,
      testId: 'alerts-filter-documents',
    },
    {
      id: 'recurring_payment',
      label: `Recurring Due (${report.counts.recurringDeadlines})`,
      count: report.counts.recurringDeadlines,
      testId: 'alerts-filter-recurring',
    },
    {
      id: 'low_balance',
      label: `Low Balance (${report.counts.lowBalance})`,
      count: report.counts.lowBalance,
      testId: 'alerts-filter-low-balance',
    },
  ];

  const isBalanceHealthy = report.balanceHealth.status === 'healthy';
  const isBalanceCritical =
    report.balanceHealth.status === 'critical_deficit' ||
    report.balanceHealth.status === 'critical_low';

  return (
    <section
      id="dashboard-alerts-widget"
      aria-label="Operational and Financial Alerts"
      data-testid="dashboard-alerts-widget"
      className="bg-white rounded-xl shadow-xs border border-[#CBD8E6] overflow-hidden"
    >
      {/* Top Dark Header Bar */}
      <div className="bg-[#273E56] text-white px-5 py-3.5 border-b border-[#1E3247] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <span
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              report.counts.critical > 0
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                : report.counts.warning > 0
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
            }`}
          >
            <Bell className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="text-sm font-bold tracking-wide text-white whitespace-nowrap">
                Alerts Center
              </h2>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span
                data-testid="alerts-total-summary-text"
                className="text-xs font-mono tabular-nums text-slate-200"
              >
                {report.counts.total === 0
                  ? 'All Clear (0 Active Alerts)'
                  : `${report.counts.total} Active (${report.counts.critical} Critical · ${report.counts.warning} Warning)`}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Monitors expiring trade documents ({docWindowDays}d window), recurring payment deadlines (14d), and Total Balance safety reserve
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="alerts-add-document-toggle-btn"
            aria-expanded={showAddDocPanel}
            onClick={() => {
              setShowAddDocPanel((prev) => !prev);
              setShowThresholdEditor(false);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Track Document</span>
          </button>

          <button
            type="button"
            data-testid="alerts-manage-docs-btn"
            aria-expanded={showDocsDrawer}
            onClick={() => setShowDocsDrawer((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg bg-[#1E3247] hover:bg-white/15 text-slate-100 border border-white/15 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            <span>Documents ({businessDocuments.length})</span>
          </button>

          <button
            type="button"
            data-testid="alerts-threshold-edit-btn"
            aria-expanded={showThresholdEditor}
            onClick={handleOpenThresholdEditor}
            className="px-2.5 py-1.5 rounded-lg bg-[#1E3247] hover:bg-white/15 text-slate-100 border border-white/15 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Thresholds</span>
          </button>
        </div>
      </div>

      {/* Three-Pillar Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/75">
        {/* Pillar 1: Expiring Documents */}
        <div className="p-3.5 px-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Expiring Documents
            </div>
            <div
              data-testid="alerts-kpi-expiring-docs"
              className={`text-lg font-black font-mono tabular-nums mt-0.5 ${
                report.counts.expiringDocuments > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {report.counts.expiringDocuments}{' '}
              <span className="text-xs font-semibold text-slate-500">
                of {report.trackedDocumentsCount} tracked
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {report.expiredDocumentsCount > 0
                ? `${report.expiredDocumentsCount} already expired · ${docWindowDays}d lookahead`
                : `Alerting within ${docWindowDays} days of expiry`}
            </div>
          </div>
          <FileText
            className={`w-5 h-5 shrink-0 ${
              report.counts.expiringDocuments > 0 ? 'text-rose-600' : 'text-slate-400'
            }`}
          />
        </div>

        {/* Pillar 2: Recurring Payment Deadlines */}
        <div className="p-3.5 px-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Recurring Payment Deadlines
            </div>
            <div
              data-testid="alerts-kpi-recurring-due"
              className={`text-lg font-black font-mono tabular-nums mt-0.5 ${
                report.counts.recurringDeadlines > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {report.counts.recurringDeadlines}{' '}
              <span className="text-xs font-semibold text-slate-500">due within 14d</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Supplier vouchers · Monthly costs · Loan installments
            </div>
          </div>
          <CalendarClock
            className={`w-5 h-5 shrink-0 ${
              report.counts.recurringDeadlines > 0 ? 'text-amber-600' : 'text-slate-400'
            }`}
          />
        </div>

        {/* Pillar 3: Total Balance Reserve Health */}
        <div className="p-3.5 px-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Balance Warning Level
            </div>
            <div
              data-testid="alerts-kpi-total-balance"
              className={`text-lg font-black font-mono tabular-nums mt-0.5 ${
                isBalanceCritical
                  ? 'text-rose-700'
                  : !isBalanceHealthy
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {formatCurrency(report.balanceHealth.totalBalance, currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
              Min Reserve: {formatCurrency(report.balanceHealth.minThreshold, currency)} ·{' '}
              <span
                className={`font-semibold ${
                  isBalanceCritical
                    ? 'text-rose-700'
                    : !isBalanceHealthy
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {isBalanceHealthy
                  ? 'Healthy'
                  : report.balanceHealth.status === 'critical_deficit'
                  ? 'Deficit'
                  : 'Low Warning'}
              </span>
            </div>
          </div>
          <Wallet
            className={`w-5 h-5 shrink-0 ${
              isBalanceCritical
                ? 'text-rose-600'
                : !isBalanceHealthy
                ? 'text-amber-600'
                : 'text-emerald-600'
            }`}
          />
        </div>
      </div>

      {/* Inline Threshold Settings Drawer */}
      {showThresholdEditor && (
        <form
          onSubmit={handleSaveThresholds}
          data-testid="alerts-threshold-form"
          className="p-4 sm:px-5 bg-amber-50/50 border-b border-amber-200 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <SlidersHorizontal className="w-4 h-4 text-amber-700" />
              <span>Configure Low-Balance &amp; Document Expiry Thresholds</span>
            </div>
            <button
              type="button"
              onClick={() => setShowThresholdEditor(false)}
              className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
              aria-label="Close threshold editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label
                htmlFor={thresholdInputId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Minimum Total Balance ({currency})
              </label>
              <input
                id={thresholdInputId}
                data-testid="alerts-min-balance-input"
                type="number"
                step="100"
                min="0"
                value={thresholdDraft}
                onChange={(e) => setThresholdDraft(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
                required
              />
            </div>

            <div>
              <label
                htmlFor={windowInputId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Document Expiry Warning Window (Days)
              </label>
              <input
                id={windowInputId}
                data-testid="alerts-doc-window-input"
                type="number"
                min="1"
                max="365"
                value={windowDraft}
                onChange={(e) => setWindowDraft(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                data-testid="alerts-save-thresholds-btn"
                className="px-4 py-1.5 rounded-lg bg-[#273E56] hover:bg-[#1E3247] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
              >
                Save Thresholds
              </button>
              <button
                type="button"
                onClick={() => setShowThresholdEditor(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>

          {thresholdError && (
            <p className="text-xs font-semibold text-rose-700">{thresholdError}</p>
          )}
        </form>
      )}

      {/* Inline Track Expiring Document Drawer */}
      {showAddDocPanel && (
        <form
          onSubmit={handleCreateDocument}
          data-testid="alerts-add-document-form"
          className="p-4 sm:px-5 bg-slate-50 border-b border-slate-200 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <FileText className="w-4 h-4 text-[#00897b]" />
              <span>Track Compliance or Trade Document Expiry</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDocPanel(false)}
              className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
              aria-label="Close document form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label
                htmlFor={titleId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Document Title *
              </label>
              <input
                id={titleId}
                data-testid="alerts-doc-title-input"
                type="text"
                placeholder="e.g. Export Registration Certificate"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
                required
              />
            </div>

            <div>
              <label
                htmlFor={categoryId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Document Type
              </label>
              <select
                id={categoryId}
                data-testid="alerts-doc-category-select"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                {BUSINESS_DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={refId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Ref / License No.
              </label>
              <input
                id={refId}
                data-testid="alerts-doc-ref-input"
                type="text"
                placeholder="e.g. ERC-2026-041"
                value={docRefNumber}
                onChange={(e) => setDocRefNumber(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor={issueDateId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Issue Date
              </label>
              <input
                id={issueDateId}
                data-testid="alerts-doc-issue-date-input"
                type="date"
                value={docIssueDate}
                onChange={(e) => setDocIssueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor={expiryDateId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Expiry Date *
              </label>
              <input
                id={expiryDateId}
                data-testid="alerts-doc-expiry-date-input"
                type="date"
                value={docExpiryDate}
                onChange={(e) => setDocExpiryDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1">
              <label
                htmlFor={notesId}
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Authority / Renewal Notes (Optional)
              </label>
              <input
                id={notesId}
                data-testid="alerts-doc-notes-input"
                type="text"
                placeholder="e.g. Ministry of Fisheries / Dhaka North City Corp renewal"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                data-testid="alerts-save-document-btn"
                className="px-4 py-1.5 rounded-lg bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
              >
                Save Document
              </button>
              <button
                type="button"
                onClick={() => setShowAddDocPanel(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>

          {docFormError && (
            <p className="text-xs font-semibold text-rose-700">{docFormError}</p>
          )}
        </form>
      )}

      {/* Collapsible Full Document Inventory Drawer */}
      {showDocsDrawer && (
        <div
          data-testid="alerts-tracked-docs-drawer"
          className="p-4 sm:px-5 bg-slate-50/70 border-b border-slate-200 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              All Tracked Business Documents ({businessDocuments.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowAddDocPanel(true);
              }}
              className="text-xs font-semibold text-[#00897b] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Document</span>
            </button>
          </div>

          {trackedDocumentsWithStatus.length === 0 ? (
            <div className="text-xs text-slate-500 py-3">
              No business licenses or compliance certificates tracked yet. Click{' '}
              <span className="font-semibold text-slate-700">Track Document</span> above to monitor expiry dates.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Document Title</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Ref No.</th>
                    <th className="px-3 py-2">Expiry Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {trackedDocumentsWithStatus.map(({ doc, status, statusLabel }) => (
                    <tr key={doc.id} data-testid={`tracked-doc-row-${doc.id}`}>
                      <td className="px-3 py-2 font-semibold text-slate-900">{doc.title}</td>
                      <td className="px-3 py-2 text-slate-600">{doc.category}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">
                        {doc.referenceNumber || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {formatDate(doc.expiryDate)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            status === 'expired' || status === 'expiring_critical'
                              ? 'text-rose-700'
                              : status === 'expiring_soon'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRenewDocument(doc)}
                            className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title={`Extend ${doc.title} expiry by 1 year`}
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>+1 Yr</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`delete-doc-btn-${doc.id}`}
                            onClick={() => deleteBusinessDocument(doc.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            aria-label={`Delete ${doc.title}`}
                            title={`Delete ${doc.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter dashboard alerts by category"
          className="flex flex-wrap items-center gap-1.5"
        >
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={tab.testId}
                aria-pressed={isActive}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-[#273E56] text-white border-[#273E56] shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('total_balance')}
          className="text-xs font-semibold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>Open Total Balance &amp; Debts</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Alert Feed */}
      {visibleAlerts.length === 0 ? (
        <div
          data-testid="alerts-empty-state"
          className="p-7 text-center space-y-2.5 bg-white"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-slate-900">
            {activeFilter === 'all'
              ? 'No Active Operational or Balance Alerts'
              : activeFilter === 'expiring_document'
              ? 'No Expiring Documents Within Window'
              : activeFilter === 'recurring_payment'
              ? 'No Recurring Payment Deadlines Within 14 Days'
              : 'Total Balance Above Minimum Safety Reserve'}
          </div>
          <p className="text-xs text-slate-500 max-w-xl mx-auto">
            {activeFilter === 'low_balance'
              ? report.balanceHealth.detail
              : `Tracked documents (${businessDocuments.length}), recurring supplier/expense deadlines, and Total Balance reserve are nominal.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddDocPanel(true)}
              className="px-3 py-1.5 rounded-lg bg-[#273E56] hover:bg-[#1E3247] text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              + Track Document Expiry
            </button>
            <button
              type="button"
              onClick={handleOpenThresholdEditor}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              Configure Thresholds
            </button>
          </div>
        </div>
      ) : (
        <div
          data-testid="alerts-feed-list"
          className="divide-y divide-slate-200/90 max-h-[380px] overflow-y-auto"
        >
          {visibleAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const CategoryIcon =
              alert.category === 'expiring_document'
                ? FileText
                : alert.category === 'recurring_payment'
                ? Repeat
                : Wallet;

            const categoryText =
              alert.category === 'expiring_document'
                ? 'Document Expiry'
                : alert.category === 'recurring_payment'
                ? 'Recurring Deadline'
                : 'Low Balance';

            return (
              <div
                key={alert.id}
                data-testid={`alert-row-${alert.id}`}
                className={`px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition ${
                  isCritical
                    ? 'bg-rose-50/35 hover:bg-rose-50/60'
                    : 'bg-amber-50/25 hover:bg-amber-50/50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                      isCritical
                        ? 'bg-rose-100 border-rose-200 text-rose-700'
                        : 'bg-amber-100 border-amber-200 text-amber-800'
                    }`}
                  >
                    {isCritical ? (
                      <ShieldAlert className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </span>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${
                          isCritical ? 'text-rose-700' : 'text-amber-800'
                        }`}
                      >
                        <CategoryIcon className="w-3 h-3 shrink-0" />
                        <span>{isCritical ? 'Critical' : 'Warning'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{categoryText}</span>
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        /
                      </span>
                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${
                          isCritical ? 'text-rose-700' : 'text-amber-800'
                        }`}
                      >
                        {alert.statusLabel}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900 truncate">
                      {alert.title}
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{alert.subtitle}</span>
                      {alert.dueDate && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono font-semibold text-slate-800 whitespace-nowrap">
                            Date: {formatDate(alert.dueDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/70">
                  {alert.amount !== undefined && (
                    <div className="text-left lg:text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {alert.category === 'low_balance' ? 'Current Balance' : 'Amount Due'}
                      </div>
                      <div
                        className={`text-sm font-black font-mono tabular-nums whitespace-nowrap ${
                          isCritical ? 'text-rose-700' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(alert.amount, alert.currency || currency)}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid={`alert-action-btn-${alert.id}`}
                      onClick={() => handleRunRecurringAlertAction(alert)}
                      className="px-3 py-1.5 rounded-lg bg-[#273E56] hover:bg-[#1E3247] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {renderAlertActionLabel(alert)}
                    </button>

                    {alert.category === 'expiring_document' && alert.rawDocument && (
                      <button
                        type="button"
                        data-testid={`alert-delete-doc-btn-${alert.rawDocument.id}`}
                        onClick={() => deleteBusinessDocument(alert.rawDocument!.id)}
                        className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-rose-700 hover:border-rose-300 transition cursor-pointer shrink-0"
                        aria-label={`Remove ${alert.rawDocument.title}`}
                        title={`Remove ${alert.rawDocument.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
