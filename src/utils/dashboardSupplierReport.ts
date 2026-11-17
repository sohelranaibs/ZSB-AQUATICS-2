import {
  PurchaseRecord,
  PaymentRecord,
  SupplierCreditRecord,
} from '../types/index.ts';
import {
  classifyPaymentCategory,
  formatCurrency,
  formatDate,
} from './calculations.ts';
import { analyzePurchasePaymentReconciliation } from './smartDataSync.ts';
import {
  buildSupplierRecordHistory,
  SupplierRecordHistoryRow,
} from './supplierHistory.ts';
import { getSupplierCreditProfile } from './supplierCredits.ts';

export type SupplierAccountStatus = 'DUE' | 'SETTLED' | 'OVERPAID' | 'NO_ACTIVITY';

export type DashboardSupplierStatusFilter =
  | 'all'
  | 'due'
  | 'settled'
  | 'no_activity';

export type DashboardSupplierSortBy =
  | 'due_desc'
  | 'purchase_desc'
  | 'paid_desc'
  | 'name_asc'
  | 'latest_desc';

export interface DashboardSupplierSummaryRow {
  supplierKey: string;
  supplierName: string;
  slug: string;
  contactNumber: string;
  purchaseBillCount: number;
  paymentVoucherCount: number;
  creditNoteCount: number;
  historyCount: number;
  totalQtyKg: number;
  totalPurchaseAmount: number;
  totalPaidAmount: number;
  totalCreditIssued: number;
  openCreditBalance: number;
  totalDueAmount: number;
  paidPercent: number;
  status: SupplierAccountStatus;
  latestDate: string;
  latestRef: string;
  historyRows: SupplierRecordHistoryRow[];
}

export interface DashboardAllSuppliersTotals {
  totalSuppliersCount: number;
  activeSuppliersCount: number;
  suppliersWithDueCount: number;
  settledSuppliersCount: number;
  noActivitySuppliersCount: number;
  totalPurchaseBillsCount: number;
  totalPaymentVouchersCount: number;
  totalCreditNotesCount: number;
  totalPurchaseQtyKg: number;
  totalPurchaseAmount: number;
  totalPaidAmount: number;
  totalOpenCreditsAmount: number;
  totalDueAmount: number;
}

export interface DashboardAllSuppliersReport {
  allSuppliers: DashboardSupplierSummaryRow[];
  filteredSuppliers: DashboardSupplierSummaryRow[];
  totals: DashboardAllSuppliersTotals;
  filteredTotals: DashboardAllSuppliersTotals;
}

export interface BuildDashboardSuppliersReportOptions {
  purchases?: PurchaseRecord[];
  payments?: PaymentRecord[];
  supplierCredits?: SupplierCreditRecord[];
  registeredSuppliers?: string[];
  searchTerm?: string;
  statusFilter?: DashboardSupplierStatusFilter;
  sortBy?: DashboardSupplierSortBy;
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export function toSupplierSlug(name: string): string {
  return (name || 'supplier')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'supplier';
}

function computeTotalsFromRows(
  rows: DashboardSupplierSummaryRow[]
): DashboardAllSuppliersTotals {
  let activeSuppliersCount = 0;
  let suppliersWithDueCount = 0;
  let settledSuppliersCount = 0;
  let noActivitySuppliersCount = 0;
  let totalPurchaseBillsCount = 0;
  let totalPaymentVouchersCount = 0;
  let totalCreditNotesCount = 0;
  let totalPurchaseQtyKg = 0;
  let totalPurchaseAmount = 0;
  let totalPaidAmount = 0;
  let totalOpenCreditsAmount = 0;
  let totalDueAmount = 0;

  for (const r of rows) {
    if (r.status !== 'NO_ACTIVITY') {
      activeSuppliersCount += 1;
    }
    if (r.status === 'DUE') suppliersWithDueCount += 1;
    else if (r.status === 'SETTLED' || r.status === 'OVERPAID') settledSuppliersCount += 1;
    else noActivitySuppliersCount += 1;

    totalPurchaseBillsCount += r.purchaseBillCount;
    totalPaymentVouchersCount += r.paymentVoucherCount;
    totalCreditNotesCount += r.creditNoteCount;
    totalPurchaseQtyKg += r.totalQtyKg;
    totalPurchaseAmount += r.totalPurchaseAmount;
    totalPaidAmount += r.totalPaidAmount;
    totalOpenCreditsAmount += r.openCreditBalance;
    totalDueAmount += r.totalDueAmount;
  }

  return {
    totalSuppliersCount: rows.length,
    activeSuppliersCount,
    suppliersWithDueCount,
    settledSuppliersCount,
    noActivitySuppliersCount,
    totalPurchaseBillsCount,
    totalPaymentVouchersCount,
    totalCreditNotesCount,
    totalPurchaseQtyKg: round2(totalPurchaseQtyKg),
    totalPurchaseAmount: round2(totalPurchaseAmount),
    totalPaidAmount: round2(totalPaidAmount),
    totalOpenCreditsAmount: round2(totalOpenCreditsAmount),
    totalDueAmount: round2(totalDueAmount),
  };
}

/**
 * Aggregates EVERY supplier across Purchases, Supplier Payments, Credit Notes,
 * and registered dropdown suppliers without double-counting linked/synced vouchers.
 */
export function buildAllSuppliersDashboardReport(
  options: BuildDashboardSuppliersReportOptions = {}
): DashboardAllSuppliersReport {
  const purchases = Array.isArray(options.purchases) ? options.purchases : [];
  const payments = Array.isArray(options.payments) ? options.payments : [];
  const supplierCredits = Array.isArray(options.supplierCredits)
    ? options.supplierCredits
    : [];
  const registeredSuppliers = Array.isArray(options.registeredSuppliers)
    ? options.registeredSuppliers
    : [];

  const searchTerm = (options.searchTerm || '').trim().toLowerCase();
  const statusFilter: DashboardSupplierStatusFilter = options.statusFilter || 'all';
  const sortBy: DashboardSupplierSortBy = options.sortBy || 'due_desc';

  const supplierPayments = payments.filter(
    (pm) => classifyPaymentCategory(pm) === 'supplier'
  );

  // Cross-reference bills and vouchers to avoid double-counting matched/auto-synced vouchers
  const reconciliation = analyzePurchasePaymentReconciliation(purchases, payments);

  const canonicalNames = new Map<string, string>();
  const registerName = (rawName?: string) => {
    const clean = (rawName || '').trim();
    if (!clean) return;
    const key = clean.toUpperCase();
    if (!canonicalNames.has(key)) {
      canonicalNames.set(key, clean);
    }
  };

  for (const s of registeredSuppliers) registerName(s);
  for (const p of purchases) registerName(p.description);
  for (const pm of supplierPayments) registerName(pm.description);
  for (const cn of supplierCredits) registerName(cn.supplierName);

  // Bucket purchases & supplier payments by normalized supplier key
  const purchasesByKey = new Map<string, PurchaseRecord[]>();
  for (const p of purchases) {
    const key = (p.description || '').trim().toUpperCase();
    if (!key) continue;
    const list = purchasesByKey.get(key) || [];
    list.push(p);
    purchasesByKey.set(key, list);
  }

  const paymentsByKey = new Map<string, PaymentRecord[]>();
  for (const pm of supplierPayments) {
    const key = (pm.description || '').trim().toUpperCase();
    if (!key) continue;
    const list = paymentsByKey.get(key) || [];
    list.push(pm);
    paymentsByKey.set(key, list);
  }

  const allSuppliers: DashboardSupplierSummaryRow[] = [];

  for (const [key, displayName] of canonicalNames.entries()) {
    const supplierPurchases = purchasesByKey.get(key) || [];
    const supplierVouchers = paymentsByKey.get(key) || [];
    const creditProfile = getSupplierCreditProfile(supplierCredits, displayName);

    let totalQtyKg = 0;
    let totalPurchaseAmount = 0;
    let purchaseAndLinkedPaid = 0;
    let contactNumber = '';
    let latestDate = '';
    let latestRef = '';

    const considerLatest = (dateStr?: string, ref?: string, phone?: string) => {
      const d = (dateStr || '').trim();
      if (phone && phone.trim() && !contactNumber) {
        contactNumber = phone.trim();
      }
      if (d && (!latestDate || d > latestDate)) {
        latestDate = d;
        latestRef = (ref || '').trim();
        if (phone && phone.trim()) {
          contactNumber = phone.trim();
        }
      }
    };

    for (const p of supplierPurchases) {
      totalQtyKg += Number(p.totalQty) || 0;
      totalPurchaseAmount += Number(p.totalAmount) || 0;

      const purRec = reconciliation.purchaseReconciliations[p.id];
      const challanPaid = Number(p.paidAmount) || 0;
      const linkedVoucherPaid = purRec ? Number(purRec.voucherPaidAmount) || 0 : 0;
      // Avoid double counting mirrored/synced voucher amounts while capturing extra linked installments
      purchaseAndLinkedPaid += Math.max(challanPaid, linkedVoucherPaid);

      considerLatest(p.date, p.invoiceNumber, p.contactNumber);
    }

    // Track standalone unlinked supplier payment vouchers (not matched to any purchase bill)
    let unlinkedVoucherPaid = 0;
    for (const pm of supplierVouchers) {
      const pmRec = reconciliation.paymentReconciliations[pm.id];
      const isLinkedToPurchase =
        pm.id.startsWith('pay-sync-') ||
        Boolean(pmRec && pmRec.matchedPurchaseId && pmRec.status !== 'UNLINKED_VOUCHER');

      if (!isLinkedToPurchase) {
        unlinkedVoucherPaid += Number(pm.paidAmount) || 0;
      }

      considerLatest(pm.date, pm.invoiceNumber, pm.contactNumber);
    }

    for (const cn of creditProfile.allCreditNotes) {
      considerLatest(cn.date, cn.creditNoteNumber);
    }

    const totalPaidAmount = round2(purchaseAndLinkedPaid + unlinkedVoucherPaid);
    const totalPurchaseRounded = round2(totalPurchaseAmount);
    const openCreditBalance = round2(creditProfile.availableBalance);
    const totalDueAmount = round2(
      totalPurchaseRounded - totalPaidAmount - openCreditBalance
    );

    const hasActivity =
      supplierPurchases.length > 0 ||
      supplierVouchers.length > 0 ||
      creditProfile.totalNotesCount > 0;

    let status: SupplierAccountStatus = 'NO_ACTIVITY';
    if (hasActivity) {
      if (totalDueAmount > 0.01) status = 'DUE';
      else if (totalDueAmount < -0.01) status = 'OVERPAID';
      else status = 'SETTLED';
    }

    const paidPercent =
      totalPurchaseRounded > 0
        ? Math.min(
            100,
            Math.max(
              0,
              round2(((totalPaidAmount + openCreditBalance) / totalPurchaseRounded) * 100)
            )
          )
        : status === 'SETTLED' || status === 'OVERPAID'
        ? 100
        : 0;

    const historyRows = buildSupplierRecordHistory(
      purchases,
      payments,
      supplierCredits,
      {
        supplierName: displayName,
        sortDirection: 'desc',
      }
    );

    allSuppliers.push({
      supplierKey: key,
      supplierName: displayName,
      slug: toSupplierSlug(displayName),
      contactNumber,
      purchaseBillCount: supplierPurchases.length,
      paymentVoucherCount: supplierVouchers.length,
      creditNoteCount: creditProfile.totalNotesCount,
      historyCount: historyRows.length,
      totalQtyKg: round2(totalQtyKg),
      totalPurchaseAmount: totalPurchaseRounded,
      totalPaidAmount,
      totalCreditIssued: round2(creditProfile.totalIssued),
      openCreditBalance,
      totalDueAmount,
      paidPercent,
      status,
      latestDate,
      latestRef,
      historyRows,
    });
  }

  // Filter rows
  const filteredSuppliers = allSuppliers.filter((row) => {
    if (statusFilter === 'due' && row.status !== 'DUE') return false;
    if (
      statusFilter === 'settled' &&
      row.status !== 'SETTLED' &&
      row.status !== 'OVERPAID'
    ) {
      return false;
    }
    if (statusFilter === 'no_activity' && row.status !== 'NO_ACTIVITY') {
      return false;
    }

    if (searchTerm) {
      const hay = `${row.supplierName} ${row.contactNumber} ${row.latestRef}`.toLowerCase();
      if (!hay.includes(searchTerm)) return false;
    }

    return true;
  });

  // Sort rows deterministically
  const compareRows = (
    a: DashboardSupplierSummaryRow,
    b: DashboardSupplierSummaryRow
  ): number => {
    switch (sortBy) {
      case 'purchase_desc': {
        if (b.totalPurchaseAmount !== a.totalPurchaseAmount) {
          return b.totalPurchaseAmount - a.totalPurchaseAmount;
        }
        if (b.totalDueAmount !== a.totalDueAmount) {
          return b.totalDueAmount - a.totalDueAmount;
        }
        return a.supplierName.localeCompare(b.supplierName);
      }
      case 'paid_desc': {
        if (b.totalPaidAmount !== a.totalPaidAmount) {
          return b.totalPaidAmount - a.totalPaidAmount;
        }
        return a.supplierName.localeCompare(b.supplierName);
      }
      case 'latest_desc': {
        if (b.latestDate !== a.latestDate) {
          return (b.latestDate || '').localeCompare(a.latestDate || '');
        }
        return b.totalPurchaseAmount - a.totalPurchaseAmount;
      }
      case 'name_asc': {
        return a.supplierName.localeCompare(b.supplierName);
      }
      case 'due_desc':
      default: {
        if (b.totalDueAmount !== a.totalDueAmount) {
          return b.totalDueAmount - a.totalDueAmount;
        }
        if (b.totalPurchaseAmount !== a.totalPurchaseAmount) {
          return b.totalPurchaseAmount - a.totalPurchaseAmount;
        }
        return a.supplierName.localeCompare(b.supplierName);
      }
    }
  };

  allSuppliers.sort(compareRows);
  filteredSuppliers.sort(compareRows);

  return {
    allSuppliers,
    filteredSuppliers,
    totals: computeTotalsFromRows(allSuppliers),
    filteredTotals: computeTotalsFromRows(filteredSuppliers),
  };
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildAllSuppliersReportCsvFilename(todayIso?: string): string {
  const cleanDate =
    (todayIso || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, '') ||
    new Date().toISOString().slice(0, 10);
  return `ZSB_AQUATICS_ALL_SUPPLIERS_PURCHASE_DUE_REPORT_${cleanDate}.csv`;
}

export function generateAllSuppliersReportCSV(
  report: DashboardAllSuppliersReport,
  currency: string = 'TK'
): string {
  const headers = [
    'SL',
    'Supplier Name',
    'Contact Number',
    'Purchase Bills',
    'Payment Vouchers',
    'Credit Notes',
    'Total Qty (KG)',
    `Total Purchase (${currency})`,
    `Total Paid (${currency})`,
    `Open Credits (${currency})`,
    `Total Due (${currency})`,
    'Status',
    'Latest Date',
    'Latest Reference',
  ];

  const lines: string[] = [headers.map(escapeCsvCell).join(',')];

  report.filteredSuppliers.forEach((row, idx) => {
    lines.push(
      [
        idx + 1,
        row.supplierName,
        row.contactNumber || '-',
        row.purchaseBillCount,
        row.paymentVoucherCount,
        row.creditNoteCount,
        row.totalQtyKg.toFixed(2),
        row.totalPurchaseAmount.toFixed(2),
        row.totalPaidAmount.toFixed(2),
        row.openCreditBalance.toFixed(2),
        row.totalDueAmount.toFixed(2),
        row.status,
        row.latestDate ? formatDate(row.latestDate) : '-',
        row.latestRef || '-',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  });

  const t = report.filteredTotals;
  lines.push(
    [
      'GRAND TOTAL',
      `${t.totalSuppliersCount} Suppliers (${t.suppliersWithDueCount} With Due)`,
      '',
      t.totalPurchaseBillsCount,
      t.totalPaymentVouchersCount,
      t.totalCreditNotesCount,
      t.totalPurchaseQtyKg.toFixed(2),
      t.totalPurchaseAmount.toFixed(2),
      t.totalPaidAmount.toFixed(2),
      t.totalOpenCreditsAmount.toFixed(2),
      t.totalDueAmount.toFixed(2),
      t.totalDueAmount > 0 ? 'DUE' : 'SETTLED',
      '',
      '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return lines.join('\r\n');
}

export function formatSupplierStatusLabel(status: SupplierAccountStatus): string {
  switch (status) {
    case 'DUE':
      return 'Due Balance';
    case 'SETTLED':
      return 'Settled';
    case 'OVERPAID':
      return 'Advance / Credit';
    case 'NO_ACTIVITY':
    default:
      return 'No Activity';
  }
}

export function formatCompactTk(val: number, currency: string = 'TK'): string {
  return formatCurrency(val, currency);
}
