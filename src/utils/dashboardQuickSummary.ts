import type {
  PackingRecord,
  PaymentRecord,
  PurchaseRecord,
  SupplierCreditRecord,
} from '../types/index.ts';
import {
  calculatePackingTotalAmountBDT,
  classifyPaymentCategory,
} from './calculations.ts';
import {
  calculateDailyFinancialSummary,
  normalizeToIsoDate,
  toLocalIsoDate,
} from './dailyFinancialSummary.ts';
import { buildAllSuppliersDashboardReport } from './dashboardSupplierReport.ts';

export interface DashboardQuickSummaryInput {
  purchases?: PurchaseRecord[];
  payments?: PaymentRecord[];
  packings?: PackingRecord[];
  supplierCredits?: SupplierCreditRecord[];
  targetDate?: string;
  referenceToday?: Date;
}

export interface DashboardQuickSummaryResult {
  targetDate: string;
  isToday: boolean;
  // Mini-Card 1: Total Purchases Today
  totalPurchasesTodayAmount: number;
  todayPurchaseBillsCount: number;
  todayPurchaseQtyKg: number;
  todayPurchasePaidAmount: number;
  todayPurchaseUnpaidBalance: number;
  todaySettlementPercent: number;
  latestPurchaseDate: string;
  // Mini-Card 2: Total Pending Payments
  totalPendingPaymentsAmount: number;
  supplierPendingAmount: number;
  standalonePendingVoucherAmount: number;
  suppliersWithDueCount: number;
  pendingVoucherCount: number;
  pendingPartiesCount: number;
  todayPendingPurchaseBalance: number;
  unpaidPackingCount: number;
  unpaidPackingAmountBDT: number;
  hasPendingPayments: boolean;
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Calculates daily-updated metrics for the Dashboard 'Quick Summary' widget:
 * 1. 'Total Purchases Today' (amount, bill count, KG volume, paid vs unpaid balance today)
 * 2. 'Total Pending Payments' (outstanding supplier dues, unpaid payment vouchers, and today's unpaid balance)
 */
export function calculateDashboardQuickSummary(
  input: DashboardQuickSummaryInput
): DashboardQuickSummaryResult {
  const safePurchases = Array.isArray(input.purchases) ? input.purchases : [];
  const safePayments = Array.isArray(input.payments) ? input.payments : [];
  const safePackings = Array.isArray(input.packings) ? input.packings : [];
  const safeCredits = Array.isArray(input.supplierCredits)
    ? input.supplierCredits
    : [];

  const referenceToday = input.referenceToday ?? new Date();
  const todayIso = toLocalIsoDate(referenceToday);
  const resolvedTargetDate = input.targetDate
    ? normalizeToIsoDate(input.targetDate)
    : todayIso;

  // 1. Daily purchase & payment calculation for resolvedTargetDate
  const dailySummary = calculateDailyFinancialSummary(
    safePurchases,
    safePayments,
    resolvedTargetDate,
    referenceToday
  );

  const totalPurchasesTodayAmount = round2(dailySummary.totalPurchases);
  const todayPurchaseBillsCount = dailySummary.purchaseCount;
  const todayPurchaseQtyKg = round2(dailySummary.totalPurchaseQty);
  const todayPurchasePaidAmount = round2(dailySummary.totalPurchasePaid);
  const todayPurchaseUnpaidBalance = round2(
    Math.max(0, dailySummary.totalPurchaseBalance)
  );
  const todaySettlementPercent =
    totalPurchasesTodayAmount > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((todayPurchasePaidAmount / totalPurchasesTodayAmount) * 100)
          )
        )
      : 0;

  let latestPurchaseDate = '';
  for (const p of safePurchases) {
    const norm = normalizeToIsoDate(p.date);
    if (norm && norm > latestPurchaseDate) {
      latestPurchaseDate = norm;
    }
  }

  // 2. Total Pending Payments across suppliers & open vouchers
  const supplierReport = buildAllSuppliersDashboardReport({
    purchases: safePurchases,
    payments: safePayments,
    supplierCredits: safeCredits,
  });

  const supplierPendingAmount = round2(supplierReport.totals.totalDueAmount);
  const suppliersWithDueCount = supplierReport.totals.suppliersWithDueCount;

  const suppliersInReport = new Set(
    supplierReport.allSuppliers
      .filter((s) => s.purchaseBillCount > 0 || s.paymentVoucherCount > 0)
      .map((s) => s.supplierKey.trim().toUpperCase())
  );

  // Also check any payment vouchers explicitly marked UNPAID or PARTIAL with positive balance
  // that are not already rolled into a supplier's purchase ledger balance
  let standalonePendingVoucherAmount = 0;
  let pendingVoucherCount = 0;
  const standaloneParties = new Set<string>();

  for (const pm of safePayments) {
    const statusUpper = String(pm.status || '').trim().toUpperCase();
    const balanceVal = round2(Math.max(0, Number(pm.balance) || 0));
    const isPendingVoucher =
      statusUpper === 'UNPAID' || statusUpper === 'PARTIAL' || balanceVal > 0;

    if (!isPendingVoucher) continue;

    pendingVoucherCount += 1;
    const category = classifyPaymentCategory(pm);
    const partyKey = String(pm.description || '').trim().toUpperCase();

    if (category === 'exporter' || !suppliersInReport.has(partyKey)) {
      if (balanceVal > 0) {
        standalonePendingVoucherAmount = round2(
          standalonePendingVoucherAmount + balanceVal
        );
        if (partyKey) {
          standaloneParties.add(partyKey);
        }
      }
    }
  }

  // Count unpaid export packing manifests for supplementary visibility
  let unpaidPackingCount = 0;
  let unpaidPackingAmountBDT = 0;
  for (const pk of safePackings) {
    const statusUpper = String(pk.paymentStatus || pk.exporterStatus || 'UNPAID')
      .trim()
      .toUpperCase();
    if (statusUpper !== 'PAID') {
      unpaidPackingCount += 1;
      unpaidPackingAmountBDT = round2(
        unpaidPackingAmountBDT +
          calculatePackingTotalAmountBDT(pk.totalAmount, pk.rmbRate)
      );
    }
  }

  const totalPendingPaymentsAmount = round2(
    supplierPendingAmount + standalonePendingVoucherAmount
  );
  const pendingPartiesCount = suppliersWithDueCount + standaloneParties.size;

  return {
    targetDate: resolvedTargetDate,
    isToday: resolvedTargetDate === todayIso,
    totalPurchasesTodayAmount,
    todayPurchaseBillsCount,
    todayPurchaseQtyKg,
    todayPurchasePaidAmount,
    todayPurchaseUnpaidBalance,
    todaySettlementPercent,
    latestPurchaseDate,
    totalPendingPaymentsAmount,
    supplierPendingAmount,
    standalonePendingVoucherAmount,
    suppliersWithDueCount,
    pendingVoucherCount,
    pendingPartiesCount,
    todayPendingPurchaseBalance: todayPurchaseUnpaidBalance,
    unpaidPackingCount,
    unpaidPackingAmountBDT,
    hasPendingPayments: totalPendingPaymentsAmount > 0,
  };
}
