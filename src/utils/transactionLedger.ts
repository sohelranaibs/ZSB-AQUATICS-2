import {
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionPayoutLine,
  ProfitDistributionRecord,
} from '../types/index.ts';
import { formatYearMonthLabel } from './calculations.ts';

export type PartnerTransactionType =
  | 'partner_deposit'
  | 'partner_withdrawal'
  | 'profit_distribution';

export interface PartnerTransactionLedgerEntry {
  id: string;
  sourceRecordId: string;
  auditSequence: number;
  date: string;
  createdAt: string;
  type: PartnerTransactionType;
  typeLabel: string;
  direction: 'credit' | 'debit';
  partnerOrScope: string;
  involvedPartners: string[];
  paymentMethod: string;
  referenceNo: string;
  notes: string;
  allocations: ProfitDistributionPayoutLine[];
  creditAmount: number;
  debitAmount: number;
  runningNetBalance: number;
  runningPartnerEquity: number;
}

export interface PartnerTransactionLedgerTotals {
  totalCount: number;
  depositCount: number;
  withdrawalCount: number;
  profitPayoutCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalProfitPayouts: number;
  totalOutflows: number;
  netPartnerEquity: number;
  endingLedgerBalance: number;
}

export interface PartnerTransactionLedgerResult {
  entries: PartnerTransactionLedgerEntry[];
  totals: PartnerTransactionLedgerTotals;
}

export interface PartnerTransactionFilterOptions {
  typeFilter?: PartnerTransactionType | 'all';
  partnerFilter?: string;
  query?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: 'chronological' | 'newest';
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sortTieBreakPriority(type: PartnerTransactionType): number {
  if (type === 'partner_deposit') return 0;
  if (type === 'partner_withdrawal') return 1;
  return 2;
}

/**
 * Builds the chronological (oldest -> newest) audited Transaction Ledger
 * covering all Partner Deposits (+), Partner Withdrawals (-), and Profit Payouts (-).
 */
export function buildPartnerTransactionLedger(input: {
  partnerDeposits: PartnerDepositRecord[];
  partnerWithdrawals: PartnerWithdrawalRecord[];
  profitDistributions: ProfitDistributionRecord[];
}): PartnerTransactionLedgerResult {
  type RawTx = Omit<
    PartnerTransactionLedgerEntry,
    'auditSequence' | 'runningNetBalance' | 'runningPartnerEquity'
  >;

  const raw: RawTx[] = [];

  for (const dep of input.partnerDeposits || []) {
    const amount = round2(Math.max(0, Number(dep.amount) || 0));
    if (amount <= 0) continue;
    const partnerName = (dep.partnerName || '').trim() || 'Unnamed Partner';
    raw.push({
      id: `tx_dep_${dep.id}`,
      sourceRecordId: dep.id,
      date: (dep.date || '').trim(),
      createdAt: dep.createdAt || '',
      type: 'partner_deposit',
      typeLabel: 'Deposit (+)',
      direction: 'credit',
      partnerOrScope: partnerName,
      involvedPartners: [partnerName],
      paymentMethod: (dep.paymentMethod || '').trim() || 'Bank Transfer',
      referenceNo: (dep.referenceNo || '').trim() || '-',
      notes: (dep.notes || '').trim() || 'Partner capital share deposit',
      allocations: [],
      creditAmount: amount,
      debitAmount: 0,
    });
  }

  for (const wdr of input.partnerWithdrawals || []) {
    const amount = round2(Math.max(0, Number(wdr.amount) || 0));
    if (amount <= 0) continue;
    const partnerName = (wdr.partnerName || '').trim() || 'Unnamed Partner';
    raw.push({
      id: `tx_wdr_${wdr.id}`,
      sourceRecordId: wdr.id,
      date: (wdr.date || '').trim(),
      createdAt: wdr.createdAt || '',
      type: 'partner_withdrawal',
      typeLabel: 'Withdrawal (−)',
      direction: 'debit',
      partnerOrScope: partnerName,
      involvedPartners: [partnerName],
      paymentMethod: (wdr.paymentMethod || '').trim() || 'Bank Transfer',
      referenceNo: (wdr.referenceNo || '').trim() || '-',
      notes: (wdr.notes || '').trim() || 'Partner capital equity withdrawal',
      allocations: [],
      creditAmount: 0,
      debitAmount: amount,
    });
  }

  for (const dist of input.profitDistributions || []) {
    const amount = round2(Math.max(0, Number(dist.distributedAmount) || 0));
    if (amount <= 0) continue;
    const monthLabel = formatYearMonthLabel(dist.targetYearMonth);
    const activeAllocations = (dist.allocations || []).filter(
      (a) => Number(a.payoutAmount) > 0
    );
    const involvedPartners = activeAllocations
      .map((a) => (a.partnerName || '').trim())
      .filter(Boolean);

    raw.push({
      id: `tx_pdist_${dist.id}`,
      sourceRecordId: dist.id,
      date: (dist.payoutDate || '').trim(),
      createdAt: dist.createdAt || '',
      type: 'profit_distribution',
      typeLabel: 'Profit Payout (−)',
      direction: 'debit',
      partnerOrScope: `Profit Payout · ${monthLabel}`,
      involvedPartners,
      paymentMethod: (dist.paymentMethod || '').trim() || 'Bank Transfer',
      referenceNo: (dist.referenceNo || '').trim() || dist.targetYearMonth || '-',
      notes:
        (dist.notes || '').trim() ||
        `${monthLabel} net profit distribution (${involvedPartners.length} partner${
          involvedPartners.length === 1 ? '' : 's'
        })`,
      allocations: activeAllocations,
      creditAmount: 0,
      debitAmount: amount,
    });
  }

  // Chronological ascending order for accurate sequential audit trail & running balances
  raw.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const createdCmp = a.createdAt.localeCompare(b.createdAt);
    if (createdCmp !== 0) return createdCmp;
    const typeDiff = sortTieBreakPriority(a.type) - sortTieBreakPriority(b.type);
    if (typeDiff !== 0) return typeDiff;
    return a.sourceRecordId.localeCompare(b.sourceRecordId);
  });

  let runningNetBalance = 0;
  let runningPartnerEquity = 0;
  let depositCount = 0;
  let withdrawalCount = 0;
  let profitPayoutCount = 0;
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalProfitPayouts = 0;

  const entries: PartnerTransactionLedgerEntry[] = raw.map((tx, idx) => {
    if (tx.type === 'partner_deposit') {
      depositCount += 1;
      totalDeposits += tx.creditAmount;
      runningPartnerEquity = round2(runningPartnerEquity + tx.creditAmount);
      runningNetBalance = round2(runningNetBalance + tx.creditAmount);
    } else if (tx.type === 'partner_withdrawal') {
      withdrawalCount += 1;
      totalWithdrawals += tx.debitAmount;
      runningPartnerEquity = round2(runningPartnerEquity - tx.debitAmount);
      runningNetBalance = round2(runningNetBalance - tx.debitAmount);
    } else {
      profitPayoutCount += 1;
      totalProfitPayouts += tx.debitAmount;
      runningNetBalance = round2(runningNetBalance - tx.debitAmount);
    }

    return {
      ...tx,
      auditSequence: idx + 1,
      runningNetBalance,
      runningPartnerEquity,
    };
  });

  const roundedDeposits = round2(totalDeposits);
  const roundedWithdrawals = round2(totalWithdrawals);
  const roundedProfitPayouts = round2(totalProfitPayouts);

  return {
    entries,
    totals: {
      totalCount: entries.length,
      depositCount,
      withdrawalCount,
      profitPayoutCount,
      totalDeposits: roundedDeposits,
      totalWithdrawals: roundedWithdrawals,
      totalProfitPayouts: roundedProfitPayouts,
      totalOutflows: round2(roundedWithdrawals + roundedProfitPayouts),
      netPartnerEquity: round2(roundedDeposits - roundedWithdrawals),
      endingLedgerBalance: round2(roundedDeposits - roundedWithdrawals - roundedProfitPayouts),
    },
  };
}

export function filterPartnerTransactionLedger(
  entries: PartnerTransactionLedgerEntry[],
  options: PartnerTransactionFilterOptions = {}
): {
  entries: PartnerTransactionLedgerEntry[];
  filteredDeposits: number;
  filteredOutflows: number;
  filteredNetChange: number;
} {
  const typeFilter = options.typeFilter || 'all';
  const partnerKey = (options.partnerFilter || 'all').trim().toLowerCase();
  const query = (options.query || '').trim().toLowerCase();
  const startDate = (options.startDate || '').trim();
  const endDate = (options.endDate || '').trim();
  const sortOrder = options.sortOrder || 'chronological';

  const matched = (entries || []).filter((entry) => {
    if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
    if (partnerKey !== 'all' && partnerKey !== '') {
      const hasPartner = entry.involvedPartners.some(
        (name) => name.trim().toLowerCase() === partnerKey
      );
      if (!hasPartner) return false;
    }
    if (startDate && entry.date && entry.date < startDate) return false;
    if (endDate && entry.date && entry.date > endDate) return false;
    if (!query) return true;

    const allocationText = entry.allocations
      .map((a) => `${a.partnerName} ${a.equityPercent}% ${a.payoutAmount}`)
      .join(' ');
    const haystack = [
      entry.sourceRecordId,
      entry.typeLabel,
      entry.partnerOrScope,
      entry.paymentMethod,
      entry.referenceNo,
      entry.notes,
      allocationText,
      entry.date,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  const ordered = sortOrder === 'newest' ? [...matched].reverse() : matched;

  let filteredDeposits = 0;
  let filteredOutflows = 0;
  for (const row of ordered) {
    filteredDeposits += row.creditAmount;
    filteredOutflows += row.debitAmount;
  }

  return {
    entries: ordered,
    filteredDeposits: round2(filteredDeposits),
    filteredOutflows: round2(filteredOutflows),
    filteredNetChange: round2(filteredDeposits - filteredOutflows),
  };
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildTransactionLedgerCsv(
  entries: PartnerTransactionLedgerEntry[],
  currency: string = 'TK'
): string {
  const headers = [
    'Audit Seq',
    'Date',
    'Recorded Timestamp',
    'Transaction Type',
    'Partner / Payout Scope',
    'Allocation Breakdown',
    'Payment Method',
    'Reference / Voucher',
    'Audit Record ID',
    'Notes',
    `Deposit (+ ${currency})`,
    `Withdrawal / Payout (- ${currency})`,
    `Running Net Balance (${currency})`,
    `Running Partner Equity (${currency})`,
  ];

  const rows = (entries || []).map((entry) => {
    const allocationSummary =
      entry.allocations.length > 0
        ? entry.allocations
            .map(
              (a) =>
                `${a.partnerName}: ${currency} ${a.payoutAmount.toFixed(2)} (${a.equityPercent.toFixed(2)}%)`
            )
            .join(' | ')
        : entry.partnerOrScope;

    return [
      entry.auditSequence,
      entry.date,
      entry.createdAt,
      entry.typeLabel,
      entry.partnerOrScope,
      allocationSummary,
      entry.paymentMethod,
      entry.referenceNo,
      entry.sourceRecordId,
      entry.notes,
      entry.creditAmount.toFixed(2),
      entry.debitAmount.toFixed(2),
      entry.runningNetBalance.toFixed(2),
      entry.runningPartnerEquity.toFixed(2),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}
