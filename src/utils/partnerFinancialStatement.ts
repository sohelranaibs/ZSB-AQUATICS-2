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
  PartnerEquitySummaryItem,
  buildPartnerDirectory,
  buildPartnerEquityRoster,
  calculateTotalBalanceSummary,
} from './totalBalance.ts';

export interface PartnerFinancialStatementDepositRow {
  id: string;
  date: string;
  partnerName: string;
  paymentMethod: string;
  referenceNo: string;
  notes: string;
  amount: number;
}

export interface PartnerFinancialStatementWithdrawalRow {
  id: string;
  date: string;
  partnerName: string;
  paymentMethod: string;
  referenceNo: string;
  notes: string;
  amount: number;
}

export interface PartnerFinancialStatementData {
  statementRef: string;
  generatedDate: string;
  filename: string;
  companyName: string;
  currency: string;
  summary: {
    totalPartnerDeposits: number;
    totalPartnerWithdrawals: number;
    netPartnerCapital: number;
    totalIncomeAdded: number;
    totalCostingDeducted: number;
    totalProfitDistributed: number;
    totalBalance: number;
    partnerCount: number;
    fundedPartnerCount: number;
    depositCount: number;
    withdrawalCount: number;
    recentWithdrawalCount: number;
  };
  equityDistribution: PartnerEquitySummaryItem[];
  currentDeposits: PartnerFinancialStatementDepositRow[];
  recentWithdrawals: PartnerFinancialStatementWithdrawalRow[];
}

export interface BuildPartnerFinancialStatementInput {
  companyProfile: CompanyProfile;
  partnerDeposits: PartnerDepositRecord[];
  partnerWithdrawals: PartnerWithdrawalRecord[];
  profitDistributions: ProfitDistributionRecord[];
  externalDebts?: ExternalDebtRecord[];
  balanceIncomes: BalanceIncomeRecord[];
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  otherCosts: OtherCostRecord[];
  referenceDate?: string;
  recentWithdrawalsLimit?: number;
}

export function formatFinancialStatementFilename(referenceDate?: string): string {
  const datePart =
    (referenceDate || new Date().toISOString().slice(0, 10))
      .trim()
      .replace(/[^0-9-]/g, '') || new Date().toISOString().slice(0, 10);
  return `ZSB_AQUATICS_FINANCIAL_STATEMENT_${datePart}.pdf`;
}

function compareByDateDesc(
  a: { date: string; createdAt?: string; id: string },
  b: { date: string; createdAt?: string; id: string }
): number {
  const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
  if (dateCmp !== 0) return dateCmp;
  const createdCmp = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  if (createdCmp !== 0) return createdCmp;
  return String(b.id || '').localeCompare(String(a.id || ''));
}

export function buildPartnerFinancialStatementData(
  input: BuildPartnerFinancialStatementInput
): PartnerFinancialStatementData {
  const generatedDate =
    (input.referenceDate || new Date().toISOString().slice(0, 10)).trim();
  const compactDate = generatedDate.replace(/-/g, '') || 'STATEMENT';
  const currency = (input.companyProfile.currency || 'TK').trim() || 'TK';
  const companyName = (input.companyProfile.companyName || 'ZSB AQUATICS').trim() || 'ZSB AQUATICS';

  const summary = calculateTotalBalanceSummary({
    partnerDeposits: input.partnerDeposits || [],
    partnerWithdrawals: input.partnerWithdrawals || [],
    profitDistributions: input.profitDistributions || [],
    externalDebts: input.externalDebts || [],
    balanceIncomes: input.balanceIncomes || [],
    purchases: input.purchases || [],
    packings: input.packings || [],
    otherCosts: input.otherCosts || [],
  });

  const directory = buildPartnerDirectory(
    input.companyProfile,
    input.partnerDeposits || [],
    input.partnerWithdrawals || []
  );
  const equityRoster = buildPartnerEquityRoster(directory, summary.partnerShares);

  const currentDeposits: PartnerFinancialStatementDepositRow[] = [
    ...(input.partnerDeposits || []),
  ]
    .sort(compareByDateDesc)
    .map((d) => ({
      id: d.id,
      date: d.date,
      partnerName: d.partnerName,
      paymentMethod: d.paymentMethod?.trim() || 'Bank Transfer',
      referenceNo: d.referenceNo?.trim() || '—',
      notes: d.notes?.trim() || 'Partner Share Capital Deposit',
      amount: Math.max(0, Number(d.amount) || 0),
    }));

  const limit =
    typeof input.recentWithdrawalsLimit === 'number' && input.recentWithdrawalsLimit > 0
      ? Math.floor(input.recentWithdrawalsLimit)
      : 25;

  const sortedWithdrawals = [...(input.partnerWithdrawals || [])].sort(compareByDateDesc);
  const recentWithdrawals: PartnerFinancialStatementWithdrawalRow[] = sortedWithdrawals
    .slice(0, limit)
    .map((w) => ({
      id: w.id,
      date: w.date,
      partnerName: w.partnerName,
      paymentMethod: w.paymentMethod?.trim() || 'Bank Transfer',
      referenceNo: w.referenceNo?.trim() || '—',
      notes: w.notes?.trim() || 'Partner Capital Withdrawal',
      amount: Math.max(0, Number(w.amount) || 0),
    }));

  return {
    statementRef: `FS-${compactDate}`,
    generatedDate,
    filename: formatFinancialStatementFilename(generatedDate),
    companyName,
    currency,
    summary: {
      totalPartnerDeposits: summary.totalPartnerDeposit,
      totalPartnerWithdrawals: summary.totalPartnerWithdrawal,
      netPartnerCapital: summary.netPartnerCapital,
      totalIncomeAdded: summary.totalIncomeAdded,
      totalCostingDeducted: summary.totalCostingDeducted,
      totalProfitDistributed: summary.totalProfitDistributed,
      totalBalance: summary.totalBalance,
      partnerCount: equityRoster.partnerCount,
      fundedPartnerCount: equityRoster.fundedPartnerCount,
      depositCount: currentDeposits.length,
      withdrawalCount: sortedWithdrawals.length,
      recentWithdrawalCount: recentWithdrawals.length,
    },
    equityDistribution: equityRoster.items,
    currentDeposits,
    recentWithdrawals,
  };
}
