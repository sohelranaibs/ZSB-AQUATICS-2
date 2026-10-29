/**
 * Utilities for date range filtering, presets, and consolidated financial analysis
 */

import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
} from '../types/index.ts';

export interface DateRangeState {
  startDate: string; // YYYY-MM-DD or empty
  endDate: string;   // YYYY-MM-DD or empty
}

export type DatePresetKey =
  | 'all'
  | 'today'
  | 'last_7_days'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_30_days'
  | 'this_year'
  | 'custom';

export const DATE_PRESET_OPTIONS: { key: DatePresetKey; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year', label: 'This Year' },
];

/**
 * Checks if a given ISO date string (YYYY-MM-DD...) falls within the [startDate, endDate] window inclusive.
 * Handles missing dates safely. If both start and end are empty, returns true (all-time).
 */
export function isDateInRange(
  dateStr: string | null | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (!startDate && !endDate) return true;
  if (!dateStr) return false;
  const target = dateStr.slice(0, 10);
  if (startDate && target < startDate) {
    return false;
  }
  if (endDate && target > endDate) {
    return false;
  }
  return true;
}

/**
 * Helper to format a Date into YYYY-MM-DD string in local calendar time
 */
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns startDate and endDate strings for a given preset
 */
export function getDateRangePreset(
  preset: DatePresetKey,
  referenceDate: Date = new Date()
): DateRangeState {
  const todayStr = toISODateString(referenceDate);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'last_7_days': {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 6);
      return {
        startDate: toISODateString(d),
        endDate: todayStr,
      };
    }

    case 'this_week': {
      // Start of current week (Monday)
      const d = new Date(referenceDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      d.setDate(diff);
      return { startDate: toISODateString(d), endDate: todayStr };
    }

    case 'this_month': {
      const monthStr = String(month + 1).padStart(2, '0');
      return {
        startDate: `${year}-${monthStr}-01`,
        endDate: todayStr,
      };
    }

    case 'last_month': {
      const prevMonthDate = new Date(year, month - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth();
      const prevMonthStr = String(prevMonth + 1).padStart(2, '0');
      const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      return {
        startDate: `${prevYear}-${prevMonthStr}-01`,
        endDate: `${prevYear}-${prevMonthStr}-${String(lastDay).padStart(2, '0')}`,
      };
    }

    case 'this_quarter': {
      const quarterIndex = Math.floor(month / 3); // 0, 1, 2, 3
      const quarterStartMonth = quarterIndex * 3;
      const startMonthStr = String(quarterStartMonth + 1).padStart(2, '0');
      return {
        startDate: `${year}-${startMonthStr}-01`,
        endDate: todayStr,
      };
    }

    case 'last_30_days': {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - 30);
      return {
        startDate: toISODateString(d),
        endDate: todayStr,
      };
    }

    case 'this_year': {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }

    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
}

/**
 * Detects whether the active startDate & endDate match any predefined preset.
 * Returns 'custom' if neither empty nor matching a standard preset.
 */
export function detectMatchingPreset(
  startDate?: string,
  endDate?: string,
  referenceDate: Date = new Date()
): DatePresetKey {
  if (!startDate && !endDate) return 'all';

  const presetsToCheck: DatePresetKey[] = [
    'today',
    'last_7_days',
    'this_week',
    'this_month',
    'last_month',
    'this_quarter',
    'this_year',
  ];

  for (const preset of presetsToCheck) {
    const range = getDateRangePreset(preset, referenceDate);
    if (range.startDate === startDate && range.endDate === endDate) {
      return preset;
    }
  }

  return 'custom';
}

/**
 * Calculates the inclusive number of days between two YYYY-MM-DD date strings.
 */
export function getDaysInDateRange(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  const diffTime = end - start;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays >= 0 ? diffDays : null;
}

/**
 * Formats a user-friendly label for the current date range.
 */
export function formatDateRangeLabel(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) {
    return 'All Time (No Date Constraints)';
  }
  if (startDate && endDate) {
    if (startDate === endDate) {
      return `Single Day: ${startDate}`;
    }
    const days = getDaysInDateRange(startDate, endDate);
    const daysSuffix = days !== null ? ` (${days} days)` : '';
    return `${startDate} to ${endDate}${daysSuffix}`;
  }
  if (startDate && !endDate) {
    return `From ${startDate} onward`;
  }
  return `Up to ${endDate}`;
}

export type TransactionKind = 'purchase' | 'packing' | 'payment' | 'other_cost';

export interface UnifiedTransactionItem {
  id: string;
  kind: TransactionKind;
  date: string;
  referenceNo: string;
  primaryParty: string;
  secondaryInfo: string;
  amountBDT: number;
  amountRMB?: number;
  weightKG?: number;
  status?: string;
  rawRecord: PurchaseRecord | PackingRecord | PaymentRecord | OtherCostRecord;
}

export interface FinancialFilterParams {
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  shipper?: string;
  supplier?: string;
  shippingMark?: string;
  kind?: TransactionKind | 'all';
}

export interface ConsolidatedFinancialSummary {
  totalPurchasesBDT: number;
  purchasesPaidBDT: number;
  purchasesBalanceBDT: number;
  purchasesCount: number;

  totalExportBDT: number;
  totalExportRMB: number;
  totalExportWeightKG: number;
  totalExportBoxes: number;
  packingsCount: number;

  totalPaymentsBDT: number;
  paymentsCount: number;

  totalOtherCostsBDT: number;
  otherCostsCount: number;

  netOperatingMarginBDT: number;
  totalTransactionsCount: number;
}

/**
 * Unified filter function for all four financial transaction types
 */
export function filterFinancialTransactions(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  params: FinancialFilterParams,
  rmbExchangeRate: number = 18.0
): {
  filteredPurchases: PurchaseRecord[];
  filteredPackings: PackingRecord[];
  filteredPayments: PaymentRecord[];
  filteredOtherCosts: OtherCostRecord[];
  unifiedTransactions: UnifiedTransactionItem[];
} {
  const {
    startDate = '',
    endDate = '',
    searchQuery = '',
    shipper = 'ALL',
    supplier = 'ALL',
    shippingMark = 'ALL',
    kind = 'all',
  } = params;

  const q = searchQuery.trim().toLowerCase();

  // 1. Filter Purchases
  const filteredPurchases =
    kind !== 'all' && kind !== 'purchase'
      ? []
      : purchases.filter((p) => {
          if (!isDateInRange(p.date, startDate, endDate)) return false;
          if (supplier !== 'ALL' && p.description !== supplier) return false;
          if (q) {
            const matchesInvoice = (p.invoiceNumber || '').toLowerCase().includes(q);
            const matchesSupplier = (p.description || '').toLowerCase().includes(q);
            const matchesRemarks = (p.remarks || '').toLowerCase().includes(q);
            const matchesItems = (p.items || []).some((it) =>
              (it.item || '').toLowerCase().includes(q)
            );
            if (!matchesInvoice && !matchesSupplier && !matchesRemarks && !matchesItems) {
              return false;
            }
          }
          return true;
        });

  // 2. Filter Packings (Exports)
  const filteredPackings =
    kind !== 'all' && kind !== 'packing'
      ? []
      : packings.filter((pkg) => {
          if (!isDateInRange(pkg.packingDate, startDate, endDate)) return false;
          if (shipper !== 'ALL' && pkg.shipper !== shipper) return false;
          if (shippingMark !== 'ALL' && pkg.shippingMark !== shippingMark) return false;
          if (q) {
            const matchesInvoice = (pkg.invoiceNumber || '').toLowerCase().includes(q);
            const matchesMark = (pkg.shippingMark || '').toLowerCase().includes(q);
            const matchesFlight = (pkg.flight || '').toLowerCase().includes(q);
            const matchesDest = (pkg.destination || '').toLowerCase().includes(q);
            const matchesShipper = (pkg.shipper || '').toLowerCase().includes(q);
            const matchesRemarks = (pkg.remarks || '').toLowerCase().includes(q);
            if (
              !matchesInvoice &&
              !matchesMark &&
              !matchesFlight &&
              !matchesDest &&
              !matchesShipper &&
              !matchesRemarks
            ) {
              return false;
            }
          }
          return true;
        });

  // 3. Filter Payments
  const filteredPayments =
    kind !== 'all' && kind !== 'payment'
      ? []
      : payments.filter((pm) => {
          if (!isDateInRange(pm.date, startDate, endDate)) return false;
          if (supplier !== 'ALL' && pm.description !== supplier) return false;
          if (shippingMark !== 'ALL' && pm.shippingMark && pm.shippingMark !== shippingMark) {
            return false;
          }
          if (q) {
            const matchesInvoice = (pm.invoiceNumber || '').toLowerCase().includes(q);
            const matchesParty = (pm.description || '').toLowerCase().includes(q);
            const matchesRef = (pm.exportGoodsRef || '').toLowerCase().includes(q);
            const matchesRemarks = (pm.remarks || '').toLowerCase().includes(q);
            if (!matchesInvoice && !matchesParty && !matchesRef && !matchesRemarks) {
              return false;
            }
          }
          return true;
        });

  // 4. Filter Other Costs
  const filteredOtherCosts =
    kind !== 'all' && kind !== 'other_cost'
      ? []
      : otherCosts.filter((c) => {
          if (!isDateInRange(c.date, startDate, endDate)) return false;
          if (q) {
            const matchesCat = (c.category || '').toLowerCase().includes(q);
            const matchesDesc = (c.description || '').toLowerCase().includes(q);
            const matchesRef = (c.refInvoice || '').toLowerCase().includes(q);
            if (!matchesCat && !matchesDesc && !matchesRef) return false;
          }
          return true;
        });

  // Build unified transaction feed sorted chronologically descending
  const unifiedTransactions: UnifiedTransactionItem[] = [];

  for (const p of filteredPurchases) {
    unifiedTransactions.push({
      id: `p-${p.id}`,
      kind: 'purchase',
      date: p.date,
      referenceNo: p.invoiceNumber,
      primaryParty: p.description || 'Supplier',
      secondaryInfo: `${p.items?.length || 0} line items (${p.totalQty} pcs/kg)`,
      amountBDT: p.totalAmount,
      status: p.balance <= 0 ? 'PAID IN FULL' : `DUE: ${p.balance}`,
      rawRecord: p,
    });
  }

  for (const pkg of filteredPackings) {
    const rate = Number(pkg.rmbRate) || rmbExchangeRate;
    const bdtAmount =
      pkg.totalAmountBDT ||
      Math.round((Number(pkg.totalAmount) || 0) * rate * 100) / 100;

    unifiedTransactions.push({
      id: `pkg-${pkg.id}`,
      kind: 'packing',
      date: pkg.packingDate,
      referenceNo: pkg.invoiceNumber,
      primaryParty: pkg.shippingMark || pkg.shipper || 'Export Cargo',
      secondaryInfo: `${pkg.flight || 'Flight'} → ${pkg.destination || 'Dest'} (${pkg.totalBox || 0} boxes, ${pkg.totalWeight || 0} kg)`,
      amountBDT: bdtAmount,
      amountRMB: pkg.totalAmount,
      weightKG: pkg.totalWeight,
      status: pkg.paymentStatus || pkg.exporterStatus || 'NO REPORT',
      rawRecord: pkg,
    });
  }

  for (const pm of filteredPayments) {
    unifiedTransactions.push({
      id: `pm-${pm.id}`,
      kind: 'payment',
      date: pm.date,
      referenceNo: pm.invoiceNumber,
      primaryParty: pm.description || 'Party Voucher',
      secondaryInfo: pm.exportGoodsRef
        ? `Ref: ${pm.exportGoodsRef}`
        : `${pm.items?.length || 0} allocation rows`,
      amountBDT: pm.paidAmount || pm.totalAmount,
      status: pm.status || 'PAID',
      rawRecord: pm,
    });
  }

  for (const c of filteredOtherCosts) {
    unifiedTransactions.push({
      id: `c-${c.id}`,
      kind: 'other_cost',
      date: c.date,
      referenceNo: c.refInvoice || 'EXPENSE',
      primaryParty: c.category || 'Operational Cost',
      secondaryInfo: c.description || 'Operational overhead',
      amountBDT: c.amount,
      status: 'DISBURSED',
      rawRecord: c,
    });
  }

  // Sort descending by date, then by referenceNo
  unifiedTransactions.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.referenceNo.localeCompare(a.referenceNo);
  });

  return {
    filteredPurchases,
    filteredPackings,
    filteredPayments,
    filteredOtherCosts,
    unifiedTransactions,
  };
}

/**
 * Calculates consolidated rollup metrics for all financial transactions
 */
export function calculateConsolidatedFinancials(
  purchases: PurchaseRecord[],
  packings: PackingRecord[],
  payments: PaymentRecord[],
  otherCosts: OtherCostRecord[],
  rmbExchangeRate: number = 18.0
): ConsolidatedFinancialSummary {
  const totalPurchasesBDT = purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const purchasesPaidBDT = purchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const purchasesBalanceBDT = purchases.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);

  let totalExportBDT = 0;
  let totalExportRMB = 0;
  let totalExportWeightKG = 0;
  let totalExportBoxes = 0;

  for (const pkg of packings) {
    const rate = Number(pkg.rmbRate) || rmbExchangeRate;
    const rmb = Number(pkg.totalAmount) || 0;
    const bdt =
      pkg.totalAmountBDT || Math.round(rmb * rate * 100) / 100;
    totalExportBDT += bdt;
    totalExportRMB += rmb;
    totalExportWeightKG += Number(pkg.totalWeight) || 0;
    totalExportBoxes += Number(pkg.totalBox) || 0;
  }

  const totalPaymentsBDT = payments.reduce(
    (sum, pm) => sum + (Number(pm.paidAmount) || Number(pm.totalAmount) || 0),
    0
  );

  const totalOtherCostsBDT = otherCosts.reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );

  const netOperatingMarginBDT = totalExportBDT - totalPurchasesBDT - totalOtherCostsBDT;

  return {
    totalPurchasesBDT,
    purchasesPaidBDT,
    purchasesBalanceBDT,
    purchasesCount: purchases.length,

    totalExportBDT,
    totalExportRMB,
    totalExportWeightKG,
    totalExportBoxes,
    packingsCount: packings.length,

    totalPaymentsBDT,
    paymentsCount: payments.length,

    totalOtherCostsBDT,
    otherCostsCount: otherCosts.length,

    netOperatingMarginBDT,
    totalTransactionsCount:
      purchases.length + packings.length + payments.length + otherCosts.length,
  };
}
