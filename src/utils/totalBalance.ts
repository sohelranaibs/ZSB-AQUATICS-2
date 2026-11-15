import {
  BalanceIncomeRecord,
  CompanyProfile,
  ExternalDebtRecord,
  OtherCostRecord,
  PackingRecord,
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionRecord,
  PurchaseRecord,
} from '../types/index.ts';
import {
  calculatePackingTotalAmountBDT,
  formatShortYearMonthLabel,
  formatYearMonthLabel,
  getCurrentYearMonth,
} from './calculations.ts';
import {
  calculateExternalDebtsSummary,
  generateExternalDebtSchedule,
  getFrequencyLabel,
} from './externalDebts.ts';
import { buildRollingMonthWindow } from './supplierPerformance.ts';

export type BalanceLedgerEntryType =
  | 'partner_deposit'
  | 'partner_withdrawal'
  | 'profit_distribution'
  | 'external_debt'
  | 'export_income'
  | 'other_income'
  | 'purchase_cost'
  | 'other_cost';

export interface PartnerShareSummary {
  partnerKey: string;
  partnerName: string;
  totalDeposited: number;
  totalWithdrawn: number;
  netContribution: number;
  depositCount: number;
  withdrawalCount: number;
  sharePercent: number;
  lastDepositDate: string;
  lastWithdrawalDate: string;
}

export interface CostingCategorySummary {
  category: string;
  sourceType: 'purchase' | 'other_cost';
  entryCount: number;
  totalAmount: number;
  sharePercent: number;
}

export interface PartnerCapitalChartDatum {
  partnerKey: string;
  partnerName: string;
  shortName: string;
  totalDeposited: number;
  totalWithdrawn: number;
  netContribution: number;
  sharePercent: number;
  depositCount: number;
  withdrawalCount: number;
  lastDepositDate: string;
  color: string;
}

export interface PartnerEquitySummaryItem {
  partnerKey: string;
  partnerName: string;
  totalDeposited: number;
  totalWithdrawn: number;
  netContribution: number;
  equityPercent: number;
  depositCount: number;
  withdrawalCount: number;
  lastDepositDate: string;
  lastWithdrawalDate: string;
  hasDeposited: boolean;
  color: string;
}

export interface PartnerEquityRosterSummary {
  items: PartnerEquitySummaryItem[];
  totalCapitalDeposited: number;
  totalCapitalWithdrawn: number;
  totalNetPartnerCapital: number;
  partnerCount: number;
  fundedPartnerCount: number;
  totalEquityPercent: number;
}

export const PARTNER_CAPITAL_CHART_COLORS = [
  '#1D6CE0', // Corporate Royal Blue
  '#16A34A', // Emerald Green
  '#D97706', // Warm Amber Gold
  '#7C3AED', // Deep Violet
  '#089BC4', // Cyan Teal
  '#E11D48', // Crimson Rose
  '#0F766E', // Slate Teal
  '#EA580C', // Burnt Orange
] as const;

export interface TotalBalanceMonthlyTrendPoint {
  yearMonth: string;
  shortMonthLabel: string;
  monthLabel: string;
  partnerDeposit: number;
  partnerWithdrawal: number;
  profitDistribution: number;
  externalDebtDeducted: number;
  incomeAdded: number;
  costingDeducted: number;
  monthlyNetChange: number;
  endingTotalBalance: number;
  entryCount: number;
}

export interface TotalBalanceMonthlyTrendSummary {
  monthsCount: number;
  startYearMonth: string;
  endYearMonth: string;
  windowRangeLabel: string;
  openingBalance: number;
  currentBalance: number;
  netPeriodChange: number;
  growthPercent: number | null;
  peakBalance: number;
  peakMonthLabel: string;
  activeMonthsCount: number;
  hasAnyActivity: boolean;
  points: TotalBalanceMonthlyTrendPoint[];
}

export interface TotalBalanceSummary {
  totalPartnerDeposit: number;
  partnerDepositCount: number;
  totalPartnerWithdrawal: number;
  partnerWithdrawalCount: number;
  netPartnerCapital: number;
  totalProfitDistributed: number;
  profitDistributionCount: number;
  totalExternalDebtPrincipal: number;
  totalExternalDebtObligation: number;
  totalExternalDebtPaid: number;
  totalExternalDebtOutstanding: number;
  externalDebtCount: number;
  activeExternalDebtCount: number;
  exportValueIncome: number;
  exportCount: number;
  manualIncome: number;
  manualIncomeCount: number;
  totalIncomeAdded: number;
  totalPurchasingCost: number;
  purchaseCount: number;
  totalOtherCosting: number;
  otherCostCount: number;
  totalCostingDeducted: number;
  totalBalance: number;
  partnerShares: PartnerShareSummary[];
  costingCategories: CostingCategorySummary[];
}

export interface BalanceLedgerEntry {
  id: string;
  sourceRecordId: string;
  date: string;
  createdAt: string;
  type: BalanceLedgerEntryType;
  effect: 'credit' | 'debit';
  effectLabel: string;
  title: string;
  categoryOrSource: string;
  reference: string;
  notes: string;
  creditAmount: number;
  debitAmount: number;
  runningBalance: number;
  deletableType?:
    | 'partner_deposit'
    | 'partner_withdrawal'
    | 'profit_distribution'
    | 'external_debt'
    | 'other_income'
    | 'other_cost';
}

export interface BalanceValidationResult {
  valid: boolean;
  error?: string;
  cleanAmount?: number;
}

export const PARTNER_PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash Deposit',
  'Cheque',
  'Mobile Banking (bKash / Nagad)',
  'WeChat / RMB Remittance',
] as const;

export const INCOME_SOURCE_PRESETS = [
  'Export Settlement Bonus / Remittance',
  'Airline / Cargo Claim Recovery',
  'Supplier Rebate / Cashback',
  'Commission / Brokerage Income',
  'Local Fish / Reject Lot Sale',
  'Other Business Income',
] as const;

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function resolvePackingIncomeBDT(
  pkg: Pick<PackingRecord, 'totalAmount' | 'rmbRate' | 'totalAmountBDT'>,
  fallbackRmbRate: number = 0
): number {
  const val = Number(pkg.totalAmount) || 0;
  const rate = Number(pkg.rmbRate) || 0;
  if (rate > 0) {
    return calculatePackingTotalAmountBDT(val, rate);
  }
  if (pkg.totalAmountBDT !== undefined && Number(pkg.totalAmountBDT) > 0) {
    return round2(Number(pkg.totalAmountBDT));
  }
  if (fallbackRmbRate > 0 && val > 0) {
    return calculatePackingTotalAmountBDT(val, fallbackRmbRate);
  }
  return round2(val);
}

export function validatePartnerDepositInput(input: {
  date: string;
  partnerName: string;
  amount: number | string;
}): BalanceValidationResult {
  if (!input.date || !input.date.trim()) {
    return { valid: false, error: 'Please select a valid deposit date.' };
  }
  if (!input.partnerName || !input.partnerName.trim()) {
    return { valid: false, error: 'Please enter or select a partner name.' };
  }
  const num = Number(input.amount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Deposit share amount must be greater than 0.' };
  }
  return { valid: true, cleanAmount: round2(num) };
}

export function validatePartnerWithdrawalInput(input: {
  date: string;
  partnerName: string;
  amount: number | string;
}): BalanceValidationResult {
  if (!input.date || !input.date.trim()) {
    return { valid: false, error: 'Please select a valid withdrawal date.' };
  }
  if (!input.partnerName || !input.partnerName.trim()) {
    return { valid: false, error: 'Please enter or select a partner name.' };
  }
  const num = Number(input.amount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Withdrawal amount must be greater than 0.' };
  }
  return { valid: true, cleanAmount: round2(num) };
}

export function validateBalanceIncomeInput(input: {
  date: string;
  source: string;
  amount: number | string;
}): BalanceValidationResult {
  if (!input.date || !input.date.trim()) {
    return { valid: false, error: 'Please select a valid income date.' };
  }
  if (!input.source || !input.source.trim()) {
    return { valid: false, error: 'Please specify an income source.' };
  }
  const num = Number(input.amount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Income amount must be greater than 0.' };
  }
  return { valid: true, cleanAmount: round2(num) };
}

export function validateBalanceCostInput(input: {
  date: string;
  category: string;
  amount: number | string;
}): BalanceValidationResult {
  if (!input.date || !input.date.trim()) {
    return { valid: false, error: 'Please select a valid costing date.' };
  }
  if (!input.category || !input.category.trim()) {
    return { valid: false, error: 'Please choose a costing category.' };
  }
  const num = Number(input.amount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Costing deduction amount must be greater than 0.' };
  }
  return { valid: true, cleanAmount: round2(num) };
}

export const DEFAULT_TARGET_PARTNER_COUNT = 4;

export function buildPartnerDirectory(
  companyProfile: Pick<CompanyProfile, 'managingPartner' | 'partner' | 'partners'>,
  deposits: PartnerDepositRecord[],
  withdrawals: PartnerWithdrawalRecord[] = []
): string[] {
  const seen = new Map<string, string>();
  const register = (raw?: string) => {
    const clean = (raw || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, clean);
    }
  };
  register(companyProfile.managingPartner);
  register(companyProfile.partner);
  if (Array.isArray(companyProfile.partners)) {
    companyProfile.partners.forEach((p) => register(p));
  }
  deposits.forEach((d) => register(d.partnerName));
  withdrawals.forEach((w) => register(w.partnerName));
  return Array.from(seen.values());
}

export function validateAddPartnerName(
  rawName: string,
  existingPartners: string[]
): { valid: boolean; error?: string; cleanName?: string } {
  const cleanName = (rawName || '').replace(/\s+/g, ' ').trim();
  if (!cleanName) {
    return { valid: false, error: 'Please enter the new partner name.' };
  }
  if (cleanName.length < 2) {
    return { valid: false, error: 'Partner name must be at least 2 characters long.' };
  }
  const normalizedKey = cleanName.toLowerCase();
  const exists = (existingPartners || []).some(
    (p) => (p || '').trim().toLowerCase() === normalizedKey
  );
  if (exists) {
    return { valid: false, error: `"${cleanName}" is already registered as a partner.` };
  }
  return { valid: true, cleanName };
}

export function addPartnerToCompanyList(
  companyProfile: Pick<CompanyProfile, 'managingPartner' | 'partner' | 'partners'>,
  newPartnerName: string
): string[] {
  const existing = buildPartnerDirectory(companyProfile, []);
  const check = validateAddPartnerName(newPartnerName, existing);
  if (!check.valid || !check.cleanName) {
    return existing;
  }
  return [...existing, check.cleanName];
}

export function removePartnerFromCompanyList(
  companyProfile: Pick<CompanyProfile, 'managingPartner' | 'partner' | 'partners'>,
  targetPartnerName: string
): string[] {
  const targetKey = (targetPartnerName || '').trim().toLowerCase();
  const current = buildPartnerDirectory(companyProfile, []);
  const primaryKeys = new Set(
    [companyProfile.managingPartner, companyProfile.partner]
      .map((p) => (p || '').trim().toLowerCase())
      .filter(Boolean)
  );
  if (primaryKeys.has(targetKey)) {
    return current;
  }
  return current.filter((p) => p.trim().toLowerCase() !== targetKey);
}

export function aggregatePartnerShares(
  deposits: PartnerDepositRecord[],
  withdrawals: PartnerWithdrawalRecord[] = []
): {
  totalPartnerDeposit: number;
  totalPartnerWithdrawal: number;
  netPartnerCapital: number;
  partnerShares: PartnerShareSummary[];
} {
  const map = new Map<
    string,
    {
      partnerName: string;
      totalDeposited: number;
      totalWithdrawn: number;
      depositCount: number;
      withdrawalCount: number;
      lastDepositDate: string;
      lastWithdrawalDate: string;
    }
  >();

  let totalPartnerDeposit = 0;
  let totalPartnerWithdrawal = 0;

  for (const dep of deposits || []) {
    const cleanName = (dep.partnerName || '').trim() || 'Unnamed Partner';
    const key = cleanName.toLowerCase();
    const amount = Math.max(0, Number(dep.amount) || 0);
    totalPartnerDeposit += amount;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        partnerName: cleanName,
        totalDeposited: amount,
        totalWithdrawn: 0,
        depositCount: 1,
        withdrawalCount: 0,
        lastDepositDate: dep.date || '',
        lastWithdrawalDate: '',
      });
    } else {
      existing.totalDeposited += amount;
      existing.depositCount += 1;
      if ((dep.date || '') > existing.lastDepositDate) {
        existing.lastDepositDate = dep.date || '';
      }
    }
  }

  for (const wdr of withdrawals || []) {
    const cleanName = (wdr.partnerName || '').trim() || 'Unnamed Partner';
    const key = cleanName.toLowerCase();
    const amount = Math.max(0, Number(wdr.amount) || 0);
    totalPartnerWithdrawal += amount;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        partnerName: cleanName,
        totalDeposited: 0,
        totalWithdrawn: amount,
        depositCount: 0,
        withdrawalCount: 1,
        lastDepositDate: '',
        lastWithdrawalDate: wdr.date || '',
      });
    } else {
      existing.totalWithdrawn += amount;
      existing.withdrawalCount += 1;
      if ((wdr.date || '') > existing.lastWithdrawalDate) {
        existing.lastWithdrawalDate = wdr.date || '';
      }
    }
  }

  const roundedDeposits = round2(totalPartnerDeposit);
  const roundedWithdrawals = round2(totalPartnerWithdrawal);
  const netPartnerCapital = round2(roundedDeposits - roundedWithdrawals);

  const interim = Array.from(map.entries()).map(([partnerKey, val]) => {
    const deposited = round2(val.totalDeposited);
    const withdrawn = round2(val.totalWithdrawn);
    const netContribution = round2(deposited - withdrawn);
    return {
      partnerKey,
      partnerName: val.partnerName,
      totalDeposited: deposited,
      totalWithdrawn: withdrawn,
      netContribution,
      effectiveEquityCapital: Math.max(0, netContribution),
      depositCount: val.depositCount,
      withdrawalCount: val.withdrawalCount,
      lastDepositDate: val.lastDepositDate,
      lastWithdrawalDate: val.lastWithdrawalDate,
    };
  });

  const totalPositiveNetCapital = round2(
    interim.reduce((sum, p) => sum + p.effectiveEquityCapital, 0)
  );

  const partnerShares: PartnerShareSummary[] = interim
    .map(({ effectiveEquityCapital, ...rest }) => ({
      ...rest,
      sharePercent:
        totalPositiveNetCapital > 0
          ? Math.round((effectiveEquityCapital / totalPositiveNetCapital) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => {
      const netDiff = b.netContribution - a.netContribution;
      if (netDiff !== 0) return netDiff;
      return b.totalDeposited - a.totalDeposited;
    });

  return {
    totalPartnerDeposit: roundedDeposits,
    totalPartnerWithdrawal: roundedWithdrawals,
    netPartnerCapital,
    partnerShares,
  };
}

export function buildPartnerCapitalChartData(
  partnerShares: PartnerShareSummary[]
): PartnerCapitalChartDatum[] {
  return (partnerShares || [])
    .filter((share) => share.netContribution > 0)
    .map((share, idx) => {
      const cleanName = (share.partnerName || '').trim() || 'Unnamed Partner';
      const shortName =
        cleanName.length > 16 ? `${cleanName.slice(0, 14).trim()}…` : cleanName;
      return {
        partnerKey: share.partnerKey,
        partnerName: cleanName,
        shortName,
        totalDeposited: round2(share.totalDeposited),
        totalWithdrawn: round2(share.totalWithdrawn),
        netContribution: round2(share.netContribution),
        sharePercent: round2(share.sharePercent),
        depositCount: share.depositCount,
        withdrawalCount: share.withdrawalCount,
        lastDepositDate: share.lastDepositDate,
        color: PARTNER_CAPITAL_CHART_COLORS[idx % PARTNER_CAPITAL_CHART_COLORS.length],
      };
    });
}

export function getUnfundedRegisteredPartners(
  partnerDirectory: string[],
  partnerShares: PartnerShareSummary[]
): string[] {
  const fundedKeys = new Set(
    (partnerShares || [])
      .filter((s) => s.netContribution > 0)
      .map((s) => (s.partnerKey || s.partnerName || '').trim().toLowerCase())
      .filter(Boolean)
  );
  return (partnerDirectory || []).filter((name) => {
    const key = (name || '').trim().toLowerCase();
    return key !== '' && !fundedKeys.has(key);
  });
}

export function buildPartnerEquityRoster(
  partnerDirectory: string[],
  partnerShares: PartnerShareSummary[]
): PartnerEquityRosterSummary {
  const items: PartnerEquitySummaryItem[] = [];
  const seenKeys = new Set<string>();
  let totalCapitalDeposited = 0;
  let totalCapitalWithdrawn = 0;
  let fundedPartnerCount = 0;
  let colorCursor = 0;

  (partnerShares || []).forEach((share) => {
    const cleanName = (share.partnerName || '').trim() || 'Unnamed Partner';
    const key = (share.partnerKey || cleanName).trim().toLowerCase();
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);

    const deposited = round2(Math.max(0, Number(share.totalDeposited) || 0));
    const withdrawn = round2(Math.max(0, Number(share.totalWithdrawn) || 0));
    const netContribution = round2(deposited - withdrawn);
    const hasPositiveEquity = netContribution > 0;
    const equityPercent = hasPositiveEquity
      ? round2(Math.max(0, Number(share.sharePercent) || 0))
      : 0;

    totalCapitalDeposited = round2(totalCapitalDeposited + deposited);
    totalCapitalWithdrawn = round2(totalCapitalWithdrawn + withdrawn);

    const assignedColor = hasPositiveEquity
      ? PARTNER_CAPITAL_CHART_COLORS[colorCursor % PARTNER_CAPITAL_CHART_COLORS.length]
      : '#94A3B8';
    if (hasPositiveEquity) {
      fundedPartnerCount += 1;
      colorCursor += 1;
    }

    items.push({
      partnerKey: key,
      partnerName: cleanName,
      totalDeposited: deposited,
      totalWithdrawn: withdrawn,
      netContribution,
      equityPercent,
      depositCount: Number(share.depositCount) || 0,
      withdrawalCount: Number(share.withdrawalCount) || 0,
      lastDepositDate: share.lastDepositDate || '',
      lastWithdrawalDate: share.lastWithdrawalDate || '',
      hasDeposited: hasPositiveEquity || deposited > 0,
      color: assignedColor,
    });
  });

  (partnerDirectory || []).forEach((rawName) => {
    const cleanName = (rawName || '').trim();
    if (!cleanName) return;
    const key = cleanName.toLowerCase();
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    items.push({
      partnerKey: key,
      partnerName: cleanName,
      totalDeposited: 0,
      totalWithdrawn: 0,
      netContribution: 0,
      equityPercent: 0,
      depositCount: 0,
      withdrawalCount: 0,
      lastDepositDate: '',
      lastWithdrawalDate: '',
      hasDeposited: false,
      color: '#94A3B8',
    });
  });

  const totalEquityPercent = round2(items.reduce((sum, item) => sum + item.equityPercent, 0));
  const totalNetPartnerCapital = round2(totalCapitalDeposited - totalCapitalWithdrawn);

  return {
    items,
    totalCapitalDeposited,
    totalCapitalWithdrawn,
    totalNetPartnerCapital,
    partnerCount: items.length,
    fundedPartnerCount,
    totalEquityPercent,
  };
}

export function aggregateAllCostings(input: {
  purchases: PurchaseRecord[];
  otherCosts: OtherCostRecord[];
}): {
  totalPurchasingCost: number;
  totalOtherCosting: number;
  totalCostingDeducted: number;
  costingCategories: CostingCategorySummary[];
} {
  const purchases = input.purchases || [];
  const otherCosts = input.otherCosts || [];

  const totalPurchasingCost = round2(
    purchases.reduce((sum, p) => sum + Math.max(0, Number(p.totalAmount) || 0), 0)
  );

  const catMap = new Map<string, { category: string; entryCount: number; totalAmount: number }>();
  let totalOtherCosting = 0;

  for (const cost of otherCosts) {
    const cleanCat = (cost.category || '').trim() || 'Uncategorized Costing';
    const key = cleanCat.toLowerCase();
    const amt = Math.max(0, Number(cost.amount) || 0);
    totalOtherCosting += amt;

    const existing = catMap.get(key);
    if (!existing) {
      catMap.set(key, { category: cleanCat, entryCount: 1, totalAmount: amt });
    } else {
      existing.entryCount += 1;
      existing.totalAmount += amt;
    }
  }

  const roundedOther = round2(totalOtherCosting);
  const totalCostingDeducted = round2(totalPurchasingCost + roundedOther);

  const rawCategories: Array<{
    category: string;
    sourceType: 'purchase' | 'other_cost';
    entryCount: number;
    totalAmount: number;
  }> = [];

  if (purchases.length > 0 || totalPurchasingCost > 0) {
    rawCategories.push({
      category: 'Procurement & Live Seafood Purchasing Bills',
      sourceType: 'purchase',
      entryCount: purchases.length,
      totalAmount: totalPurchasingCost,
    });
  }

  for (const item of catMap.values()) {
    rawCategories.push({
      category: item.category,
      sourceType: 'other_cost',
      entryCount: item.entryCount,
      totalAmount: round2(item.totalAmount),
    });
  }

  const costingCategories: CostingCategorySummary[] = rawCategories
    .map((c) => ({
      ...c,
      sharePercent:
        totalCostingDeducted > 0
          ? Math.round((c.totalAmount / totalCostingDeducted) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    totalPurchasingCost,
    totalOtherCosting: roundedOther,
    totalCostingDeducted,
    costingCategories,
  };
}

export function calculateTotalBalanceSummary(input: {
  partnerDeposits: PartnerDepositRecord[];
  partnerWithdrawals?: PartnerWithdrawalRecord[];
  profitDistributions?: ProfitDistributionRecord[];
  externalDebts?: ExternalDebtRecord[];
  balanceIncomes: BalanceIncomeRecord[];
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  otherCosts: OtherCostRecord[];
}): TotalBalanceSummary {
  const partnerDeposits = input.partnerDeposits || [];
  const partnerWithdrawals = input.partnerWithdrawals || [];
  const profitDistributions = input.profitDistributions || [];
  const externalDebts = input.externalDebts || [];
  const balanceIncomes = input.balanceIncomes || [];
  const purchases = input.purchases || [];
  const packings = input.packings || [];
  const otherCosts = input.otherCosts || [];

  const {
    totalPartnerDeposit,
    totalPartnerWithdrawal,
    netPartnerCapital,
    partnerShares,
  } = aggregatePartnerShares(partnerDeposits, partnerWithdrawals);

  const exportValueIncome = round2(
    packings.reduce((sum, pkg) => sum + Math.max(0, resolvePackingIncomeBDT(pkg)), 0)
  );

  const manualIncome = round2(
    balanceIncomes.reduce((sum, inc) => sum + Math.max(0, Number(inc.amount) || 0), 0)
  );

  const totalIncomeAdded = round2(exportValueIncome + manualIncome);

  const {
    totalPurchasingCost,
    totalOtherCosting,
    totalCostingDeducted,
    costingCategories,
  } = aggregateAllCostings({ purchases, otherCosts });

  const totalProfitDistributed = round2(
    profitDistributions.reduce((sum, dist) => sum + Math.max(0, Number(dist.distributedAmount) || 0), 0)
  );

  const debtSummary = calculateExternalDebtsSummary(externalDebts);

  const totalBalance = round2(
    netPartnerCapital +
      totalIncomeAdded -
      totalCostingDeducted -
      totalProfitDistributed -
      debtSummary.totalObligation
  );

  return {
    totalPartnerDeposit,
    partnerDepositCount: partnerDeposits.length,
    totalPartnerWithdrawal,
    partnerWithdrawalCount: partnerWithdrawals.length,
    netPartnerCapital,
    totalProfitDistributed,
    profitDistributionCount: profitDistributions.length,
    totalExternalDebtPrincipal: debtSummary.totalPrincipal,
    totalExternalDebtObligation: debtSummary.totalObligation,
    totalExternalDebtPaid: debtSummary.totalPaid,
    totalExternalDebtOutstanding: debtSummary.totalRemaining,
    externalDebtCount: debtSummary.totalCount,
    activeExternalDebtCount: debtSummary.activeCount,
    exportValueIncome,
    exportCount: packings.length,
    manualIncome,
    manualIncomeCount: balanceIncomes.length,
    totalIncomeAdded,
    totalPurchasingCost,
    purchaseCount: purchases.length,
    totalOtherCosting,
    otherCostCount: otherCosts.length,
    totalCostingDeducted,
    totalBalance,
    partnerShares,
    costingCategories,
  };
}

export function buildTotalBalanceLedgerEntries(input: {
  partnerDeposits: PartnerDepositRecord[];
  partnerWithdrawals?: PartnerWithdrawalRecord[];
  profitDistributions?: ProfitDistributionRecord[];
  externalDebts?: ExternalDebtRecord[];
  balanceIncomes: BalanceIncomeRecord[];
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  otherCosts: OtherCostRecord[];
  order?: 'newest' | 'chronological';
}): BalanceLedgerEntry[] {
  const raw: Omit<BalanceLedgerEntry, 'runningBalance'>[] = [];

  for (const dep of input.partnerDeposits || []) {
    const amt = round2(Math.max(0, Number(dep.amount) || 0));
    raw.push({
      id: `dep_${dep.id}`,
      sourceRecordId: dep.id,
      date: dep.date || '',
      createdAt: dep.createdAt || '',
      type: 'partner_deposit',
      effect: 'credit',
      effectLabel: 'Partner Deposit (+)',
      title: dep.partnerName,
      categoryOrSource: dep.paymentMethod || 'Partner Capital Share',
      reference: dep.referenceNo || '-',
      notes: dep.notes || 'Partner capital share deposit',
      creditAmount: amt,
      debitAmount: 0,
      deletableType: 'partner_deposit',
    });
  }

  for (const wdr of input.partnerWithdrawals || []) {
    const amt = round2(Math.max(0, Number(wdr.amount) || 0));
    if (amt <= 0) continue;
    raw.push({
      id: `wdr_${wdr.id}`,
      sourceRecordId: wdr.id,
      date: wdr.date || '',
      createdAt: wdr.createdAt || '',
      type: 'partner_withdrawal',
      effect: 'debit',
      effectLabel: 'Partner Withdrawal (-)',
      title: wdr.partnerName,
      categoryOrSource: wdr.paymentMethod || 'Partner Equity Withdrawal',
      reference: wdr.referenceNo || '-',
      notes: wdr.notes || 'Partner capital withdrawal',
      creditAmount: 0,
      debitAmount: amt,
      deletableType: 'partner_withdrawal',
    });
  }

  for (const dist of input.profitDistributions || []) {
    const amt = round2(Math.max(0, Number(dist.distributedAmount) || 0));
    if (amt <= 0) continue;
    const monthLabel = formatYearMonthLabel(dist.targetYearMonth);
    const splitSummary = (dist.allocations || [])
      .filter((a) => Number(a.payoutAmount) > 0)
      .map((a) => `${a.partnerName}: ${Number(a.payoutAmount).toLocaleString()} (${a.equityPercent.toFixed(2)}%)`)
      .join(' · ');
    raw.push({
      id: `pdist_${dist.id}`,
      sourceRecordId: dist.id,
      date: dist.payoutDate || '',
      createdAt: dist.createdAt || '',
      type: 'profit_distribution',
      effect: 'debit',
      effectLabel: 'Profit Payout (-)',
      title: `Profit Distribution — ${monthLabel}`,
      categoryOrSource: dist.paymentMethod || 'Partner Profit Payout',
      reference: dist.referenceNo || dist.targetYearMonth || '-',
      notes: [splitSummary, dist.notes].filter(Boolean).join(' · ') || `${monthLabel} equity profit payout`,
      creditAmount: 0,
      debitAmount: amt,
      deletableType: 'profit_distribution',
    });
  }

  for (const inc of input.balanceIncomes || []) {
    const amt = round2(Math.max(0, Number(inc.amount) || 0));
    raw.push({
      id: `inc_${inc.id}`,
      sourceRecordId: inc.id,
      date: inc.date || '',
      createdAt: inc.createdAt || '',
      type: 'other_income',
      effect: 'credit',
      effectLabel: 'Income Added (+)',
      title: inc.source,
      categoryOrSource: 'Direct Income',
      reference: inc.refInvoice || '-',
      notes: inc.description || inc.source,
      creditAmount: amt,
      debitAmount: 0,
      deletableType: 'other_income',
    });
  }

  for (const pkg of input.packings || []) {
    const amtBDT = resolvePackingIncomeBDT(pkg);
    if (amtBDT <= 0) continue;
    raw.push({
      id: `pkg_${pkg.id}`,
      sourceRecordId: pkg.id,
      date: pkg.packingDate || '',
      createdAt: pkg.createdAt || '',
      type: 'export_income',
      effect: 'credit',
      effectLabel: 'Export Income (+)',
      title: `${pkg.shippingMark || 'Export Shipment'} (${pkg.totalWeight || 0} KG)`,
      categoryOrSource: 'Export Packing Revenue',
      reference: pkg.invoiceNumber || '-',
      notes: `${pkg.destination || 'Export'} · ${pkg.totalBox || 0} Box · RMB ${(Number(pkg.totalAmount) || 0).toLocaleString()}`,
      creditAmount: amtBDT,
      debitAmount: 0,
    });
  }

  for (const pur of input.purchases || []) {
    const amt = round2(Math.max(0, Number(pur.totalAmount) || 0));
    if (amt <= 0) continue;
    raw.push({
      id: `pur_${pur.id}`,
      sourceRecordId: pur.id,
      date: pur.date || '',
      createdAt: pur.createdAt || '',
      type: 'purchase_cost',
      effect: 'debit',
      effectLabel: 'Purchase Cost (-)',
      title: pur.description || 'Supplier Purchase',
      categoryOrSource: 'Procurement Bill',
      reference: pur.invoiceNumber || '-',
      notes: `${pur.totalQty || 0} KG across ${pur.items?.length || 0} item(s)`,
      creditAmount: 0,
      debitAmount: amt,
    });
  }

  for (const cost of input.otherCosts || []) {
    const amt = round2(Math.max(0, Number(cost.amount) || 0));
    if (amt <= 0) continue;
    raw.push({
      id: `cost_${cost.id}`,
      sourceRecordId: cost.id,
      date: cost.date || '',
      createdAt: cost.createdAt || '',
      type: 'other_cost',
      effect: 'debit',
      effectLabel: 'Costing Deducted (-)',
      title: cost.category || 'Operating Costing',
      categoryOrSource: 'Operating Cost',
      reference: cost.refInvoice || '-',
      notes: cost.description || cost.category,
      creditAmount: 0,
      debitAmount: amt,
      deletableType: 'other_cost',
    });
  }

  for (const debt of input.externalDebts || []) {
    const sched = generateExternalDebtSchedule(debt);
    if (sched.totalObligation <= 0) continue;
    raw.push({
      id: `debt_${debt.id}`,
      sourceRecordId: debt.id,
      date: debt.originationDate || '',
      createdAt: debt.createdAt || '',
      type: 'external_debt',
      effect: 'debit',
      effectLabel: 'External Debt (-)',
      title: `${debt.title} (${debt.lenderName})`,
      categoryOrSource: debt.category || 'External Debt',
      reference: debt.referenceNo || `${sched.installments.length}x ${getFrequencyLabel(debt.frequency)}`,
      notes: `Obligation: ${sched.totalObligation.toLocaleString()} · Repaid: ${sched.totalPaid.toLocaleString()} · Remaining: ${sched.remainingBalance.toLocaleString()}`,
      creditAmount: 0,
      debitAmount: sched.totalObligation,
      deletableType: 'external_debt',
    });
  }

  // Sort chronologically ascending to compute exact running balance
  const ascending = [...raw].sort((a, b) => {
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) return dateCmp;
    const createdCmp = (a.createdAt || '').localeCompare(b.createdAt || '');
    if (createdCmp !== 0) return createdCmp;
    // On identical date + timestamp, deposits & incomes apply before costs
    if (a.effect !== b.effect) return a.effect === 'credit' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  let running = 0;
  const withRunning: BalanceLedgerEntry[] = ascending.map((entry) => {
    running = round2(running + entry.creditAmount - entry.debitAmount);
    return {
      ...entry,
      runningBalance: running,
    };
  });

  if (input.order === 'chronological') {
    return withRunning;
  }
  return [...withRunning].reverse();
}

export function filterBalanceLedgerEntries(
  entries: BalanceLedgerEntry[],
  filters: {
    query?: string;
    typeFilter?: BalanceLedgerEntryType | 'all';
    startDate?: string;
    endDate?: string;
  }
): BalanceLedgerEntry[] {
  const q = (filters.query || '').trim().toLowerCase();
  const typeFilter = filters.typeFilter || 'all';
  const start = (filters.startDate || '').trim();
  const end = (filters.endDate || '').trim();

  return entries.filter((entry) => {
    if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
    if (start && entry.date && entry.date < start) return false;
    if (end && entry.date && entry.date > end) return false;
    if (!q) return true;
    const haystack = [
      entry.title,
      entry.categoryOrSource,
      entry.reference,
      entry.notes,
      entry.effectLabel,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function buildMonthlyTotalBalanceTrend(input: {
  partnerDeposits: PartnerDepositRecord[];
  partnerWithdrawals?: PartnerWithdrawalRecord[];
  profitDistributions?: ProfitDistributionRecord[];
  externalDebts?: ExternalDebtRecord[];
  balanceIncomes: BalanceIncomeRecord[];
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  otherCosts: OtherCostRecord[];
  endYearMonth?: string;
  monthsCount?: number;
}): TotalBalanceMonthlyTrendSummary {
  const monthsCount = Math.max(1, Math.floor(Number(input.monthsCount) || 12));
  const entries = buildTotalBalanceLedgerEntries({
    partnerDeposits: input.partnerDeposits || [],
    partnerWithdrawals: input.partnerWithdrawals || [],
    profitDistributions: input.profitDistributions || [],
    externalDebts: input.externalDebts || [],
    balanceIncomes: input.balanceIncomes || [],
    purchases: input.purchases || [],
    packings: input.packings || [],
    otherCosts: input.otherCosts || [],
    order: 'chronological',
  });

  const currentYm = getCurrentYearMonth();
  let resolvedEndMonth = (input.endYearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(resolvedEndMonth)) {
    resolvedEndMonth = currentYm;
    for (const entry of entries) {
      const ym = (entry.date || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym) && ym > resolvedEndMonth) {
        resolvedEndMonth = ym;
      }
    }
  }

  const targetMonths = buildRollingMonthWindow(resolvedEndMonth, monthsCount);
  const startYearMonth = targetMonths[0];
  const endYearMonth = targetMonths[targetMonths.length - 1];

  const monthlyBuckets = new Map<
    string,
    {
      partnerDeposit: number;
      partnerWithdrawal: number;
      profitDistribution: number;
      externalDebtDeducted: number;
      incomeAdded: number;
      costingDeducted: number;
      entryCount: number;
    }
  >();
  for (const ym of targetMonths) {
    monthlyBuckets.set(ym, {
      partnerDeposit: 0,
      partnerWithdrawal: 0,
      profitDistribution: 0,
      externalDebtDeducted: 0,
      incomeAdded: 0,
      costingDeducted: 0,
      entryCount: 0,
    });
  }

  let openingBalance = 0;
  for (const entry of entries) {
    const ym = (entry.date || '').slice(0, 7);
    const isValidYm = /^\d{4}-\d{2}$/.test(ym);
    if (!isValidYm || ym < startYearMonth) {
      openingBalance = round2(openingBalance + entry.creditAmount - entry.debitAmount);
      continue;
    }
    if (ym > endYearMonth) {
      continue;
    }
    const bucket = monthlyBuckets.get(ym);
    if (!bucket) continue;
    if (entry.type === 'partner_deposit') {
      bucket.partnerDeposit += entry.creditAmount;
    } else if (entry.effect === 'credit') {
      bucket.incomeAdded += entry.creditAmount;
    }
    if (entry.type === 'partner_withdrawal') {
      bucket.partnerWithdrawal += entry.debitAmount;
    } else if (entry.type === 'profit_distribution') {
      bucket.profitDistribution += entry.debitAmount;
    } else if (entry.type === 'external_debt') {
      bucket.externalDebtDeducted += entry.debitAmount;
    } else if (entry.effect === 'debit') {
      bucket.costingDeducted += entry.debitAmount;
    }
    bucket.entryCount += 1;
  }

  let running = round2(openingBalance);
  let activeMonthsCount = 0;
  let peakBalance = Number.NEGATIVE_INFINITY;
  let peakMonthLabel = formatYearMonthLabel(endYearMonth);

  const points: TotalBalanceMonthlyTrendPoint[] = targetMonths.map((ym) => {
    const bucket = monthlyBuckets.get(ym)!;
    const partnerDeposit = round2(bucket.partnerDeposit);
    const partnerWithdrawal = round2(bucket.partnerWithdrawal);
    const profitDistribution = round2(bucket.profitDistribution);
    const externalDebtDeducted = round2(bucket.externalDebtDeducted);
    const incomeAdded = round2(bucket.incomeAdded);
    const costingDeducted = round2(bucket.costingDeducted);
    const monthlyNetChange = round2(
      partnerDeposit +
        incomeAdded -
        partnerWithdrawal -
        profitDistribution -
        externalDebtDeducted -
        costingDeducted
    );
    running = round2(running + monthlyNetChange);

    if (bucket.entryCount > 0) {
      activeMonthsCount += 1;
    }
    const monthLabel = formatYearMonthLabel(ym);
    if (running > peakBalance) {
      peakBalance = running;
      peakMonthLabel = monthLabel;
    }

    return {
      yearMonth: ym,
      shortMonthLabel: formatShortYearMonthLabel(ym),
      monthLabel,
      partnerDeposit,
      partnerWithdrawal,
      profitDistribution,
      externalDebtDeducted,
      incomeAdded,
      costingDeducted,
      monthlyNetChange,
      endingTotalBalance: running,
      entryCount: bucket.entryCount,
    };
  });

  if (!Number.isFinite(peakBalance)) {
    peakBalance = 0;
  }

  const currentBalance = points.length > 0 ? points[points.length - 1].endingTotalBalance : openingBalance;
  const netPeriodChange = round2(currentBalance - openingBalance);
  const growthPercent =
    openingBalance !== 0
      ? Math.round((netPeriodChange / Math.abs(openingBalance)) * 10000) / 100
      : null;

  return {
    monthsCount,
    startYearMonth,
    endYearMonth,
    windowRangeLabel: `${formatShortYearMonthLabel(startYearMonth)} – ${formatShortYearMonthLabel(endYearMonth)}`,
    openingBalance: round2(openingBalance),
    currentBalance: round2(currentBalance),
    netPeriodChange,
    growthPercent,
    peakBalance: round2(peakBalance),
    peakMonthLabel,
    activeMonthsCount,
    hasAnyActivity: entries.length > 0,
    points,
  };
}

export interface MonthlyNetProfitBreakdown {
  yearMonth: string;
  monthLabel: string;
  exportRevenue: number;
  directIncome: number;
  totalMonthlyIncome: number;
  purchasingCost: number;
  operatingCost: number;
  totalMonthlyCost: number;
  netMonthlyProfit: number;
  alreadyDistributedForMonth: number;
  remainingDistributableProfit: number;
}

export interface PartnerProfitAllocationItem {
  partnerKey: string;
  partnerName: string;
  equityPercent: number;
  netCapital: number;
  payoutAmount: number;
  color: string;
}

export interface ProfitDistributionAllocationSummary {
  distributableAmount: number;
  totalAllocated: number;
  hasEligiblePartners: boolean;
  allocations: PartnerProfitAllocationItem[];
}

export function calculateMonthlyNetProfitForDistribution(input: {
  yearMonth: string;
  packings: PackingRecord[];
  balanceIncomes: BalanceIncomeRecord[];
  purchases: PurchaseRecord[];
  otherCosts: OtherCostRecord[];
  profitDistributions?: ProfitDistributionRecord[];
}): MonthlyNetProfitBreakdown {
  const ym = (input.yearMonth || '').trim().slice(0, 7);
  const matchesYm = (dateStr?: string) => ym !== '' && (dateStr || '').slice(0, 7) === ym;

  const exportRevenue = round2(
    (input.packings || [])
      .filter((pkg) => matchesYm(pkg.packingDate))
      .reduce((sum, pkg) => sum + Math.max(0, resolvePackingIncomeBDT(pkg)), 0)
  );

  const directIncome = round2(
    (input.balanceIncomes || [])
      .filter((inc) => matchesYm(inc.date))
      .reduce((sum, inc) => sum + Math.max(0, Number(inc.amount) || 0), 0)
  );

  const totalMonthlyIncome = round2(exportRevenue + directIncome);

  const purchasingCost = round2(
    (input.purchases || [])
      .filter((pur) => matchesYm(pur.date))
      .reduce((sum, pur) => sum + Math.max(0, Number(pur.totalAmount) || 0), 0)
  );

  const operatingCost = round2(
    (input.otherCosts || [])
      .filter((cost) => matchesYm(cost.date))
      .reduce((sum, cost) => sum + Math.max(0, Number(cost.amount) || 0), 0)
  );

  const totalMonthlyCost = round2(purchasingCost + operatingCost);
  const netMonthlyProfit = round2(totalMonthlyIncome - totalMonthlyCost);

  const alreadyDistributedForMonth = round2(
    (input.profitDistributions || [])
      .filter((d) => (d.targetYearMonth || '').slice(0, 7) === ym)
      .reduce((sum, d) => sum + Math.max(0, Number(d.distributedAmount) || 0), 0)
  );

  const remainingDistributableProfit = round2(
    Math.max(0, netMonthlyProfit - alreadyDistributedForMonth)
  );

  return {
    yearMonth: ym,
    monthLabel: formatYearMonthLabel(ym),
    exportRevenue,
    directIncome,
    totalMonthlyIncome,
    purchasingCost,
    operatingCost,
    totalMonthlyCost,
    netMonthlyProfit,
    alreadyDistributedForMonth,
    remainingDistributableProfit,
  };
}

export function calculateProfitDistributionAllocation(
  distributableAmountInput: number,
  roster: PartnerEquityRosterSummary
): ProfitDistributionAllocationSummary {
  const distributableAmount = round2(Math.max(0, Number(distributableAmountInput) || 0));
  const items = roster?.items || [];

  const eligible = items.filter((item) => item.equityPercent > 0);
  if (eligible.length === 0) {
    return {
      distributableAmount,
      totalAllocated: 0,
      hasEligiblePartners: false,
      allocations: items.map((item) => ({
        partnerKey: item.partnerKey,
        partnerName: item.partnerName,
        equityPercent: item.equityPercent,
        netCapital: item.netContribution,
        payoutAmount: 0,
        color: item.color,
      })),
    };
  }

  const totalNetWeight = eligible.reduce(
    (sum, item) => sum + Math.max(0, Number(item.netContribution) || 0),
    0
  );
  const totalPctWeight = eligible.reduce(
    (sum, item) => sum + Math.max(0, Number(item.equityPercent) || 0),
    0
  );

  const rawByPartnerKey = new Map<string, number>();
  let runningAllocated = 0;

  // Allocate proportional amounts, reserving cent reconciliation for top equity holder
  const sortedEligibleKeys = [...eligible]
    .sort((a, b) => b.equityPercent - a.equityPercent)
    .map((e) => e.partnerKey);
  const primaryReconcileKey = sortedEligibleKeys[0];

  eligible.forEach((item) => {
    const ratio =
      totalNetWeight > 0
        ? Math.max(0, Number(item.netContribution) || 0) / totalNetWeight
        : totalPctWeight > 0
          ? Math.max(0, Number(item.equityPercent) || 0) / totalPctWeight
          : 0;
    const allocated = round2(distributableAmount * ratio);
    rawByPartnerKey.set(item.partnerKey, allocated);
    runningAllocated = round2(runningAllocated + allocated);
  });

  if (distributableAmount > 0 && primaryReconcileKey) {
    const centDiff = round2(distributableAmount - runningAllocated);
    if (centDiff !== 0) {
      const currentVal = rawByPartnerKey.get(primaryReconcileKey) || 0;
      rawByPartnerKey.set(primaryReconcileKey, round2(Math.max(0, currentVal + centDiff)));
    }
  }

  const allocations: PartnerProfitAllocationItem[] = items.map((item) => ({
    partnerKey: item.partnerKey,
    partnerName: item.partnerName,
    equityPercent: item.equityPercent,
    netCapital: item.netContribution,
    payoutAmount:
      distributableAmount > 0 && item.equityPercent > 0
        ? rawByPartnerKey.get(item.partnerKey) ?? 0
        : 0,
    color: item.color,
  }));

  const totalAllocated = round2(
    allocations.reduce((sum, item) => sum + item.payoutAmount, 0)
  );

  return {
    distributableAmount,
    totalAllocated,
    hasEligiblePartners: true,
    allocations,
  };
}

export function validateProfitDistributionInput(input: {
  targetYearMonth: string;
  payoutDate: string;
  totalAmount: number | string;
  allocations: Array<{ partnerName: string; equityPercent: number; payoutAmount: number }>;
}): BalanceValidationResult {
  if (!input.targetYearMonth || !/^\d{4}-\d{2}$/.test(input.targetYearMonth.trim())) {
    return { valid: false, error: 'Please select a valid profit month (YYYY-MM).' };
  }
  if (!input.payoutDate || !input.payoutDate.trim()) {
    return { valid: false, error: 'Please select a valid payout issue date.' };
  }
  const num = Number(input.totalAmount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Distributable profit payout amount must be greater than 0.' };
  }
  const positivePayouts = (input.allocations || []).filter((a) => Number(a.payoutAmount) > 0);
  if (positivePayouts.length === 0) {
    return {
      valid: false,
      error: 'At least one partner must hold positive equity (> 0%) to receive a profit payout.',
    };
  }
  return { valid: true, cleanAmount: round2(num) };
}


