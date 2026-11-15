import {
  BusinessDocumentCategory,
  BusinessDocumentRecord,
  ExternalDebtRecord,
  OtherCostRecord,
  PaymentRecord,
  RecurringExpenseRecord,
} from '../types/index.ts';
import { toISODateString } from './dateFilters.ts';
import {
  calculateDaysUntilDue,
  scanUpcomingRecurringSupplierPayments,
  UpcomingRecurringPaymentItem,
} from './recurringPayments.ts';
import { getRecurringRuleStatus } from './recurringExpenses.ts';
import {
  addMonthsIso,
  diffDaysBetweenIso,
  generateExternalDebtSchedule,
  getFrequencyLabel,
} from './externalDebts.ts';

export const DEFAULT_MIN_TOTAL_BALANCE_THRESHOLD = 100000;
export const DEFAULT_DOCUMENT_ALERT_WINDOW_DAYS = 30;
export const DEFAULT_RECURRING_ALERT_WINDOW_DAYS = 14;

export const BUSINESS_DOCUMENT_CATEGORIES: readonly BusinessDocumentCategory[] = [
  'Export License',
  'Trade License',
  'Quarantine / Health Certificate',
  'Airline / Cargo Permit',
  'Customs Bond / Insurance',
  'Other Compliance Document',
] as const;

export type DashboardAlertCategory =
  | 'expiring_document'
  | 'recurring_payment'
  | 'low_balance';

export type DashboardAlertSeverity = 'critical' | 'warning';

export type RecurringDeadlineSource =
  | 'supplier_voucher'
  | 'recurring_expense'
  | 'external_debt';

export type TotalBalanceHealthStatus =
  | 'critical_deficit'
  | 'critical_low'
  | 'warning_low'
  | 'approaching_low'
  | 'healthy';

export interface DashboardAlertItem {
  id: string;
  category: DashboardAlertCategory;
  severity: DashboardAlertSeverity;
  title: string;
  subtitle: string;
  statusLabel: string;
  dueDate?: string; // YYYY-MM-DD
  daysRemaining?: number; // negative = overdue/expired
  amount?: number;
  currency?: string;
  reference?: string;
  documentId?: string;
  rawDocument?: BusinessDocumentRecord;
  recurringSource?: RecurringDeadlineSource;
  recurringPaymentItem?: UpcomingRecurringPaymentItem;
  recurringExpenseRuleId?: string;
  externalDebtId?: string;
}

export interface DocumentExpiryStatusInfo {
  doc: BusinessDocumentRecord;
  daysRemaining: number;
  status: 'expired' | 'expiring_critical' | 'expiring_soon' | 'valid';
  statusLabel: string;
}

export interface TotalBalanceHealthSnapshot {
  totalBalance: number;
  minThreshold: number;
  status: TotalBalanceHealthStatus;
  shortfallAmount: number;
  bufferAmount: number;
  headline: string;
  detail: string;
}

export interface DashboardAlertsSummaryCounts {
  total: number;
  critical: number;
  warning: number;
  expiringDocuments: number;
  recurringDeadlines: number;
  lowBalance: number;
}

export interface DashboardAlertsReport {
  referenceDate: string;
  items: DashboardAlertItem[];
  counts: DashboardAlertsSummaryCounts;
  balanceHealth: TotalBalanceHealthSnapshot;
  trackedDocumentsCount: number;
  expiredDocumentsCount: number;
}

export interface BusinessDocumentValidationResult {
  valid: boolean;
  error?: string;
  cleanTitle?: string;
  cleanCategory?: string;
  cleanReferenceNumber?: string;
  cleanIssueDate?: string;
  cleanExpiryDate?: string;
  cleanNotes?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function isValidIsoDateString(val?: string): boolean {
  if (!val || !ISO_DATE_RE.test(val.trim())) return false;
  const [y, m, d] = val.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function validateBusinessDocumentInput(input: {
  title: string;
  category: string;
  referenceNumber?: string;
  issueDate?: string;
  expiryDate: string;
  notes?: string;
}): BusinessDocumentValidationResult {
  const cleanTitle = (input.title || '').trim();
  if (cleanTitle.length < 2) {
    return {
      valid: false,
      error: 'Please enter a document name or title (min 2 characters).',
    };
  }

  const cleanCategory = (input.category || '').trim() || BUSINESS_DOCUMENT_CATEGORIES[0];
  const cleanExpiryDate = (input.expiryDate || '').trim().slice(0, 10);
  if (!isValidIsoDateString(cleanExpiryDate)) {
    return {
      valid: false,
      error: 'Please enter a valid document expiry date (YYYY-MM-DD).',
    };
  }

  const rawIssue = (input.issueDate || '').trim().slice(0, 10);
  if (rawIssue) {
    if (!isValidIsoDateString(rawIssue)) {
      return {
        valid: false,
        error: 'Issue date must be a valid calendar date (YYYY-MM-DD).',
      };
    }
    if (rawIssue > cleanExpiryDate) {
      return {
        valid: false,
        error: 'Document expiry date cannot be earlier than the issue date.',
      };
    }
  }

  return {
    valid: true,
    cleanTitle,
    cleanCategory,
    cleanReferenceNumber: (input.referenceNumber || '').trim() || undefined,
    cleanIssueDate: rawIssue || undefined,
    cleanExpiryDate,
    cleanNotes: (input.notes || '').trim() || undefined,
  };
}

export function extendDocumentExpiryByOneYear(
  currentExpiryDate: string,
  referenceDate: string = toISODateString(new Date())
): string {
  const base =
    isValidIsoDateString(currentExpiryDate) && currentExpiryDate >= referenceDate
      ? currentExpiryDate
      : isValidIsoDateString(referenceDate)
      ? referenceDate
      : toISODateString(new Date());
  return addMonthsIso(base, 12);
}

export function getDocumentExpiryStatus(
  doc: BusinessDocumentRecord,
  referenceDate: string = toISODateString(new Date()),
  windowDays: number = DEFAULT_DOCUMENT_ALERT_WINDOW_DAYS
): DocumentExpiryStatusInfo {
  const safeWindow = Math.max(1, Math.floor(Number(windowDays) || DEFAULT_DOCUMENT_ALERT_WINDOW_DAYS));
  const cleanExpiry = (doc.expiryDate || '').slice(0, 10);
  const daysRemaining = isValidIsoDateString(cleanExpiry)
    ? calculateDaysUntilDue(cleanExpiry, referenceDate)
    : 9999;

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      doc,
      daysRemaining,
      status: 'expired',
      statusLabel: `Expired ${overdueDays}d ago`,
    };
  }
  if (daysRemaining === 0) {
    return {
      doc,
      daysRemaining: 0,
      status: 'expiring_critical',
      statusLabel: 'Expires Today',
    };
  }
  if (daysRemaining === 1) {
    return {
      doc,
      daysRemaining: 1,
      status: 'expiring_critical',
      statusLabel: 'Expires Tomorrow',
    };
  }
  if (daysRemaining <= 7) {
    return {
      doc,
      daysRemaining,
      status: 'expiring_critical',
      statusLabel: `Expires in ${daysRemaining}d`,
    };
  }
  if (daysRemaining <= safeWindow) {
    return {
      doc,
      daysRemaining,
      status: 'expiring_soon',
      statusLabel: `Expires in ${daysRemaining}d`,
    };
  }
  return {
    doc,
    daysRemaining,
    status: 'valid',
    statusLabel: `Valid (${daysRemaining}d left)`,
  };
}

export function evaluateExpiringDocumentAlerts(
  documents: BusinessDocumentRecord[],
  referenceDate: string = toISODateString(new Date()),
  windowDays: number = DEFAULT_DOCUMENT_ALERT_WINDOW_DAYS
): DashboardAlertItem[] {
  const safeDocs = Array.isArray(documents) ? documents : [];
  const alerts: DashboardAlertItem[] = [];

  for (const doc of safeDocs) {
    if (!doc || !isValidIsoDateString(doc.expiryDate)) continue;
    const info = getDocumentExpiryStatus(doc, referenceDate, windowDays);
    if (info.status === 'valid') continue;

    const severity: DashboardAlertSeverity =
      info.status === 'expired' || info.status === 'expiring_critical' ? 'critical' : 'warning';

    const refPart = doc.referenceNumber ? `Ref: ${doc.referenceNumber} · ` : '';
    alerts.push({
      id: `doc-alert-${doc.id}`,
      category: 'expiring_document',
      severity,
      title: doc.title,
      subtitle: `${doc.category} · ${refPart}${doc.notes ? doc.notes : `Expiry: ${doc.expiryDate}`}`,
      statusLabel: info.statusLabel,
      dueDate: doc.expiryDate.slice(0, 10),
      daysRemaining: info.daysRemaining,
      reference: doc.referenceNumber,
      documentId: doc.id,
      rawDocument: doc,
    });
  }

  return alerts;
}

function formatDueDaysLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) return `Overdue ${Math.abs(daysUntilDue)}d`;
  if (daysUntilDue === 0) return 'Due Today';
  if (daysUntilDue === 1) return 'Due Tomorrow';
  return `Due in ${daysUntilDue}d`;
}

export function evaluateRecurringPaymentDeadlineAlerts(input: {
  payments: PaymentRecord[];
  recurringExpenses: RecurringExpenseRecord[];
  otherCosts: OtherCostRecord[];
  externalDebts: ExternalDebtRecord[];
  currency?: string;
  referenceDate?: Date;
  windowDays?: number;
}): DashboardAlertItem[] {
  const refDate = input.referenceDate ?? new Date();
  const refDateStr = toISODateString(refDate);
  const currency = input.currency || 'TK';
  const safeWindow = Math.max(
    1,
    Math.floor(Number(input.windowDays) || DEFAULT_RECURRING_ALERT_WINDOW_DAYS)
  );
  const alerts: DashboardAlertItem[] = [];

  // 1. Recurring Supplier Payment Vouchers
  const supplierItems = scanUpcomingRecurringSupplierPayments(input.payments || [], refDate);
  for (const item of supplierItems) {
    if (item.daysUntilDue > safeWindow) continue;
    const severity: DashboardAlertSeverity = item.daysUntilDue <= 3 ? 'critical' : 'warning';
    alerts.push({
      id: `rec-voucher-${item.id}`,
      category: 'recurring_payment',
      severity,
      title: `${item.supplierName} (${item.invoiceNumber})`,
      subtitle: `Supplier Recurring Voucher · ${item.frequencyLabel} · ${item.remarks}`,
      statusLabel: formatDueDaysLabel(item.daysUntilDue),
      dueDate: item.dueDate,
      daysRemaining: item.daysUntilDue,
      amount: round2(item.amountDue),
      currency,
      reference: item.invoiceNumber,
      recurringSource: 'supplier_voucher',
      recurringPaymentItem: item,
    });
  }

  // 2. Active Monthly Recurring Fixed Expenses
  for (const rule of input.recurringExpenses || []) {
    if (!rule.autoDeduct) continue;
    const snap = getRecurringRuleStatus(rule, input.otherCosts || [], refDateStr);
    if (!snap.nextBillingDate) continue;
    const daysUntilDue = diffDaysBetweenIso(refDateStr, snap.nextBillingDate);
    if (!snap.isDueTodayOrEarlier && daysUntilDue > safeWindow) continue;

    const severity: DashboardAlertSeverity =
      snap.isDueTodayOrEarlier || daysUntilDue <= 3 ? 'critical' : 'warning';
    alerts.push({
      id: `rec-expense-${rule.id}`,
      category: 'recurring_payment',
      severity,
      title: rule.title,
      subtitle: `Monthly Fixed Cost (${rule.category}) · Billing Day ${rule.billingDay}`,
      statusLabel: formatDueDaysLabel(daysUntilDue),
      dueDate: snap.nextBillingDate,
      daysRemaining: daysUntilDue,
      amount: round2(rule.amount),
      currency,
      recurringSource: 'recurring_expense',
      recurringExpenseRuleId: rule.id,
    });
  }

  // 3. Active External Debt Repayment Installments
  for (const debt of input.externalDebts || []) {
    const sched = generateExternalDebtSchedule(debt, refDateStr);
    if (sched.debtStatus === 'SETTLED' || !sched.nextDueInstallment) continue;
    const inst = sched.nextDueInstallment;
    const daysUntilDue = diffDaysBetweenIso(refDateStr, inst.dueDate);
    if (daysUntilDue > safeWindow) continue;

    const severity: DashboardAlertSeverity =
      daysUntilDue <= 3 ? 'critical' : 'warning';
    alerts.push({
      id: `rec-debt-${debt.id}-${inst.installmentNumber}`,
      category: 'recurring_payment',
      severity,
      title: `${debt.title} (${debt.lenderName})`,
      subtitle: `External Debt Installment #${inst.installmentNumber}/${inst.totalInstallments} · ${getFrequencyLabel(debt.frequency)}`,
      statusLabel: formatDueDaysLabel(daysUntilDue),
      dueDate: inst.dueDate,
      daysRemaining: daysUntilDue,
      amount: round2(inst.remainingAmount),
      currency,
      reference: debt.referenceNo,
      recurringSource: 'external_debt',
      externalDebtId: debt.id,
    });
  }

  return alerts;
}

export function evaluateTotalBalanceWarning(input: {
  totalBalance: number;
  minThreshold?: number;
  currency?: string;
}): {
  health: TotalBalanceHealthSnapshot;
  alert: DashboardAlertItem | null;
} {
  const totalBalance = round2(input.totalBalance);
  const minThreshold = round2(
    Math.max(
      0,
      input.minThreshold !== undefined && Number.isFinite(Number(input.minThreshold))
        ? Number(input.minThreshold)
        : DEFAULT_MIN_TOTAL_BALANCE_THRESHOLD
    )
  );
  const currency = input.currency || 'TK';
  const approachingCeiling = round2(minThreshold * 1.25);

  if (totalBalance <= 0) {
    const shortfall = round2(Math.max(0, minThreshold - totalBalance));
    const headline =
      totalBalance < 0 ? 'Total Balance in Deficit' : 'Total Balance Depleted (Zero)';
    const detail = `Current reserve is ${currency} ${totalBalance.toLocaleString()}, below your ${currency} ${minThreshold.toLocaleString()} minimum safety reserve.`;
    return {
      health: {
        totalBalance,
        minThreshold,
        status: 'critical_deficit',
        shortfallAmount: shortfall,
        bufferAmount: 0,
        headline,
        detail,
      },
      alert: {
        id: 'low-balance-total-reserve',
        category: 'low_balance',
        severity: 'critical',
        title: headline,
        subtitle: detail,
        statusLabel: totalBalance < 0 ? 'Overdrawn Deficit' : 'Zero Balance',
        amount: totalBalance,
        currency,
      },
    };
  }

  if (minThreshold > 0 && totalBalance < round2(minThreshold * 0.5)) {
    const shortfall = round2(minThreshold - totalBalance);
    const headline = 'Critical Low Total Balance';
    const detail = `Available Total Balance (${currency} ${totalBalance.toLocaleString()}) is under 50% of your ${currency} ${minThreshold.toLocaleString()} minimum reserve (shortfall: ${currency} ${shortfall.toLocaleString()}).`;
    return {
      health: {
        totalBalance,
        minThreshold,
        status: 'critical_low',
        shortfallAmount: shortfall,
        bufferAmount: 0,
        headline,
        detail,
      },
      alert: {
        id: 'low-balance-total-reserve',
        category: 'low_balance',
        severity: 'critical',
        title: headline,
        subtitle: detail,
        statusLabel: 'Below 50% Reserve',
        amount: totalBalance,
        currency,
      },
    };
  }

  if (minThreshold > 0 && totalBalance <= minThreshold) {
    const shortfall = round2(minThreshold - totalBalance);
    const headline = 'Low Total Balance Warning';
    const detail = `Total Balance (${currency} ${totalBalance.toLocaleString()}) has dropped at or below the ${currency} ${minThreshold.toLocaleString()} minimum threshold.`;
    return {
      health: {
        totalBalance,
        minThreshold,
        status: 'warning_low',
        shortfallAmount: shortfall,
        bufferAmount: 0,
        headline,
        detail,
      },
      alert: {
        id: 'low-balance-total-reserve',
        category: 'low_balance',
        severity: 'warning',
        title: headline,
        subtitle: detail,
        statusLabel: 'Below Threshold',
        amount: totalBalance,
        currency,
      },
    };
  }

  if (minThreshold > 0 && totalBalance <= approachingCeiling) {
    const bufferAmount = round2(totalBalance - minThreshold);
    const headline = 'Approaching Low Balance Threshold';
    const detail = `Total Balance (${currency} ${totalBalance.toLocaleString()}) is within 25% of your ${currency} ${minThreshold.toLocaleString()} minimum reserve (buffer: ${currency} ${bufferAmount.toLocaleString()}).`;
    return {
      health: {
        totalBalance,
        minThreshold,
        status: 'approaching_low',
        shortfallAmount: 0,
        bufferAmount,
        headline,
        detail,
      },
      alert: {
        id: 'low-balance-total-reserve',
        category: 'low_balance',
        severity: 'warning',
        title: headline,
        subtitle: detail,
        statusLabel: 'Approaching Reserve',
        amount: totalBalance,
        currency,
      },
    };
  }

  const bufferAmount = round2(totalBalance - minThreshold);
  return {
    health: {
      totalBalance,
      minThreshold,
      status: 'healthy',
      shortfallAmount: 0,
      bufferAmount,
      headline: 'Total Balance Reserve Healthy',
      detail: `Current Total Balance (${currency} ${totalBalance.toLocaleString()}) sits ${currency} ${bufferAmount.toLocaleString()} above the ${currency} ${minThreshold.toLocaleString()} threshold.`,
    },
    alert: null,
  };
}

export function buildDashboardAlertsReport(input: {
  documents: BusinessDocumentRecord[];
  payments: PaymentRecord[];
  recurringExpenses: RecurringExpenseRecord[];
  otherCosts: OtherCostRecord[];
  externalDebts: ExternalDebtRecord[];
  totalBalance: number;
  minTotalBalanceThreshold?: number;
  documentAlertWindowDays?: number;
  recurringAlertWindowDays?: number;
  currency?: string;
  referenceDate?: Date;
}): DashboardAlertsReport {
  const refDate = input.referenceDate ?? new Date();
  const refDateStr = toISODateString(refDate);
  const currency = input.currency || 'TK';

  const docAlerts = evaluateExpiringDocumentAlerts(
    input.documents || [],
    refDateStr,
    input.documentAlertWindowDays ?? DEFAULT_DOCUMENT_ALERT_WINDOW_DAYS
  );

  const recurringAlerts = evaluateRecurringPaymentDeadlineAlerts({
    payments: input.payments || [],
    recurringExpenses: input.recurringExpenses || [],
    otherCosts: input.otherCosts || [],
    externalDebts: input.externalDebts || [],
    currency,
    referenceDate: refDate,
    windowDays: input.recurringAlertWindowDays ?? DEFAULT_RECURRING_ALERT_WINDOW_DAYS,
  });

  const balanceEval = evaluateTotalBalanceWarning({
    totalBalance: input.totalBalance,
    minThreshold: input.minTotalBalanceThreshold,
    currency,
  });

  const combined: DashboardAlertItem[] = [
    ...(balanceEval.alert ? [balanceEval.alert] : []),
    ...docAlerts,
    ...recurringAlerts,
  ];

  combined.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    const aDays = a.daysRemaining ?? -9999;
    const bDays = b.daysRemaining ?? -9999;
    if (aDays !== bDays) {
      return aDays - bDays;
    }
    return (b.amount || 0) - (a.amount || 0);
  });

  let critical = 0;
  let warning = 0;
  for (const item of combined) {
    if (item.severity === 'critical') critical += 1;
    else warning += 1;
  }

  const expiredDocumentsCount = (input.documents || []).filter(
    (d) =>
      isValidIsoDateString(d.expiryDate) &&
      calculateDaysUntilDue(d.expiryDate, refDateStr) < 0
  ).length;

  return {
    referenceDate: refDateStr,
    items: combined,
    counts: {
      total: combined.length,
      critical,
      warning,
      expiringDocuments: docAlerts.length,
      recurringDeadlines: recurringAlerts.length,
      lowBalance: balanceEval.alert ? 1 : 0,
    },
    balanceHealth: balanceEval.health,
    trackedDocumentsCount: (input.documents || []).length,
    expiredDocumentsCount,
  };
}

export function filterDashboardAlerts(
  items: DashboardAlertItem[],
  filter: 'all' | DashboardAlertCategory
): DashboardAlertItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.category === filter);
}
