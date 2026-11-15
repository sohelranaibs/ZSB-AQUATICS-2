import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionRecord,
} from '../types/index.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  PartnerTransactionType,
  buildPartnerTransactionLedger,
  buildTransactionLedgerCsv,
  filterPartnerTransactionLedger,
} from '../utils/transactionLedger.ts';

interface TransactionLedgerCardProps {
  currency: string;
  companyName?: string;
  partnerDirectory: string[];
  partnerDeposits: PartnerDepositRecord[];
  partnerWithdrawals: PartnerWithdrawalRecord[];
  profitDistributions: ProfitDistributionRecord[];
  onDeleteDeposit: (id: string) => void;
  onDeleteWithdrawal: (id: string) => void;
  onDeleteProfitDistribution: (id: string) => void;
  onExportAuditLog?: (exportedCount: number, filename: string) => void;
}

function formatAuditTime(isoString?: string): string {
  if (!isoString) return '';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const TransactionLedgerCard: React.FC<TransactionLedgerCardProps> = ({
  currency,
  companyName,
  partnerDirectory,
  partnerDeposits,
  partnerWithdrawals,
  profitDistributions,
  onDeleteDeposit,
  onDeleteWithdrawal,
  onDeleteProfitDistribution,
  onExportAuditLog,
}) => {
  const [typeFilter, setTypeFilter] = useState<PartnerTransactionType | 'all'>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'chronological' | 'newest'>('chronological');

  const ledgerData = useMemo(
    () =>
      buildPartnerTransactionLedger({
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
      }),
    [partnerDeposits, partnerWithdrawals, profitDistributions]
  );

  const filtered = useMemo(
    () =>
      filterPartnerTransactionLedger(ledgerData.entries, {
        typeFilter,
        partnerFilter,
        query: searchQuery,
        startDate,
        endDate,
        sortOrder,
      }),
    [ledgerData.entries, typeFilter, partnerFilter, searchQuery, startDate, endDate, sortOrder]
  );

  const partnerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    const add = (name?: string) => {
      const clean = (name || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) seen.set(key, clean);
    };
    partnerDirectory.forEach(add);
    ledgerData.entries.forEach((entry) => entry.involvedPartners.forEach(add));
    return Array.from(seen.values());
  }, [partnerDirectory, ledgerData.entries]);

  const hasActiveFilters =
    typeFilter !== 'all' ||
    partnerFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    startDate !== '' ||
    endDate !== '';

  const resetFilters = () => {
    setTypeFilter('all');
    setPartnerFilter('all');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCsv = () => {
    if (filtered.entries.length === 0) return;
    const csvContent = buildTransactionLedgerCsv(filtered.entries, currency);
    const cleanCompany = (companyName || 'ZSB_AQUATICS')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `${cleanCompany}_TRANSACTION_LEDGER_${dateSlug}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onExportAuditLog?.(filtered.entries.length, filename);
  };

  const handleDeleteTransaction = (type: PartnerTransactionType, sourceRecordId: string) => {
    if (type === 'partner_deposit') {
      onDeleteDeposit(sourceRecordId);
    } else if (type === 'partner_withdrawal') {
      onDeleteWithdrawal(sourceRecordId);
    } else {
      onDeleteProfitDistribution(sourceRecordId);
    }
  };

  return (
    <section
      data-testid="transaction-ledger-card"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <FileSpreadsheet className="w-4 h-4 text-[#1D6CE0] shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Transaction Ledger — Partner Equity &amp; Payout Audit Trail
            </h2>
            <p className="text-[11px] text-slate-500">
              Chronological record of all partner deposits, withdrawals, and equity profit payouts with sequential running balances
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="tx-ledger-sort-btn"
            aria-pressed={sortOrder === 'chronological'}
            onClick={() =>
              setSortOrder((prev) => (prev === 'chronological' ? 'newest' : 'chronological'))
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowDownUp className="w-3.5 h-3.5 shrink-0" />
            <span>
              {sortOrder === 'chronological' ? 'Chronological (Oldest → Newest)' : 'Newest First'}
            </span>
          </button>

          <button
            type="button"
            data-testid="tx-ledger-export-csv-btn"
            disabled={filtered.entries.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Audit Summary Divider Strip (Single-Elevation, Zero Nested Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/70 border-b border-slate-200">
        <div className="px-4 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Partner Deposits (+)</div>
          <div
            data-testid="tx-ledger-total-deposits"
            className="mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-700"
          >
            {formatCurrency(ledgerData.totals.totalDeposits, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {ledgerData.totals.depositCount} deposit transaction(s)
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Partner Withdrawals (−)</div>
          <div
            data-testid="tx-ledger-total-withdrawals"
            className="mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums text-rose-700"
          >
            {ledgerData.totals.totalWithdrawals > 0
              ? `−${formatCurrency(ledgerData.totals.totalWithdrawals, currency)}`
              : formatCurrency(0, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {ledgerData.totals.withdrawalCount} withdrawal(s)
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Profit Payouts Issued (−)</div>
          <div
            data-testid="tx-ledger-total-payouts"
            className="mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums text-rose-700"
          >
            {ledgerData.totals.totalProfitPayouts > 0
              ? `−${formatCurrency(ledgerData.totals.totalProfitPayouts, currency)}`
              : formatCurrency(0, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {ledgerData.totals.profitPayoutCount} distribution cycle(s)
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="text-[11px] font-semibold text-slate-500">Audited Ledger Balance (=)</div>
          <div
            data-testid="tx-ledger-ending-balance"
            className={`mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums ${
              ledgerData.totals.endingLedgerBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
            }`}
          >
            {formatCurrency(ledgerData.totals.endingLedgerBalance, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            Net Equity: {formatCurrency(ledgerData.totals.netPartnerEquity, currency)}
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 space-y-2.5 bg-white">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5">
          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All (${ledgerData.totals.totalCount})` },
                { id: 'partner_deposit', label: `Deposits (${ledgerData.totals.depositCount})` },
                {
                  id: 'partner_withdrawal',
                  label: `Withdrawals (${ledgerData.totals.withdrawalCount})`,
                },
                {
                  id: 'profit_distribution',
                  label: `Profit Payouts (${ledgerData.totals.profitPayoutCount})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`tx-ledger-filter-${tab.id}`}
                aria-pressed={typeFilter === tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Partner Select & Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              data-testid="tx-ledger-partner-select"
              aria-label="Filter transactions by partner"
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            >
              <option value="all">All Partners</option>
              {partnerOptions.map((pName) => (
                <option key={pName} value={pName}>
                  {pName}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                data-testid="tx-ledger-search-input"
                aria-label="Search transaction ledger"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search partner, ref, method, ID..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0] w-48"
              />
            </div>

            <input
              type="date"
              data-testid="tx-ledger-start-date"
              aria-label="Transaction ledger start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono"
            />
            <input
              type="date"
              data-testid="tx-ledger-end-date"
              aria-label="Transaction ledger end date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono"
            />

            {hasActiveFilters && (
              <button
                type="button"
                data-testid="tx-ledger-reset-filters-btn"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compact 8-Column Table (Fits cleanly within 1440px Desktop Viewport with zero truncation) */}
      {filtered.entries.length === 0 ? (
        <div
          data-testid="tx-ledger-empty-state"
          className="p-8 text-center text-xs text-slate-500"
        >
          {ledgerData.entries.length === 0
            ? 'No partner deposits, withdrawals, or profit payouts have been recorded yet. Log a deposit, withdrawal, or profit payout above to populate this audited transaction ledger.'
            : 'No partner transactions match your current filter or search criteria.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            data-testid="transaction-ledger-table"
            className="w-full text-xs text-left border-collapse"
          >
            <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-2.5 text-center w-10">Seq</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Type</th>
                <th className="py-2.5 px-2.5 min-w-[180px]">Partner / Payout Details</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Ref / Method</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                  Deposit (+)
                </th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                  Outflow (&minus;)
                </th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                  Balance ({currency})
                </th>
                <th className="py-2.5 px-2 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.entries.map((entry) => {
                const recordedTime = formatAuditTime(entry.createdAt);
                return (
                  <tr
                    key={entry.id}
                    data-testid={`tx-ledger-row-${entry.auditSequence}`}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="py-2.5 px-2.5 text-center font-mono tabular-nums text-slate-500 font-semibold">
                      #{entry.auditSequence}
                    </td>

                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="font-mono tabular-nums font-semibold text-slate-800">
                        {formatDate(entry.date)}
                      </div>
                      {recordedTime && (
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {recordedTime}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          entry.direction === 'credit' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        <ArrowUpRight
                          className={`w-3.5 h-3.5 shrink-0 ${
                            entry.direction === 'credit' ? '' : 'rotate-180'
                          }`}
                        />
                        <span>{entry.typeLabel}</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-2.5 min-w-[180px]">
                      <div className="font-semibold text-slate-900">{entry.partnerOrScope}</div>
                      {entry.allocations.length > 0 ? (
                        <div className="text-[11px] text-slate-600 mt-0.5 font-mono tabular-nums leading-snug">
                          {entry.allocations
                            .map(
                              (a) =>
                                `${a.partnerName}: ${formatCurrency(a.payoutAmount, currency)} (${a.equityPercent.toFixed(2)}%)`
                            )
                            .join(' · ')}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {entry.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-2.5">
                      <div className="font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {entry.referenceNo}
                      </div>
                      <div className="text-[11px] text-slate-500 whitespace-nowrap">
                        {entry.paymentMethod}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {entry.sourceRecordId.slice(0, 14)}
                      </div>
                    </td>

                    <td className="py-2.5 px-2.5 text-right font-mono font-bold tabular-nums text-emerald-700 whitespace-nowrap">
                      {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount, currency) : '—'}
                    </td>

                    <td className="py-2.5 px-2.5 text-right font-mono font-bold tabular-nums text-rose-700 whitespace-nowrap">
                      {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount, currency) : '—'}
                    </td>

                    <td
                      className={`py-2.5 px-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                        entry.runningNetBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                      }`}
                    >
                      {formatCurrency(entry.runningNetBalance, currency)}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        data-testid={`delete-tx-ledger-row-${entry.sourceRecordId}`}
                        onClick={() => handleDeleteTransaction(entry.type, entry.sourceRecordId)}
                        aria-label={`Delete ${entry.typeLabel} for ${entry.partnerOrScope} on ${formatDate(entry.date)}`}
                        title="Delete transaction (Super Admin verification required)"
                        className="inline-flex items-center justify-center p-1.5 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-[#CBD8E6] font-bold">
              <tr>
                <td colSpan={5} className="py-3 px-2.5 text-right text-slate-700">
                  {hasActiveFilters
                    ? `Filtered Totals (${filtered.entries.length} of ${ledgerData.totals.totalCount} transactions):`
                    : `Audited Totals (${ledgerData.totals.totalCount} transactions · Deposits − Withdrawals & Profit Payouts):`}
                </td>
                <td
                  data-testid="tx-ledger-footer-deposits"
                  className="py-3 px-2.5 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap"
                >
                  {formatCurrency(filtered.filteredDeposits, currency)}
                </td>
                <td
                  data-testid="tx-ledger-footer-outflows"
                  className="py-3 px-2.5 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap"
                >
                  {formatCurrency(filtered.filteredOutflows, currency)}
                </td>
                <td
                  data-testid="tx-ledger-footer-net-balance"
                  className={`py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                    (hasActiveFilters
                      ? filtered.filteredNetChange
                      : ledgerData.totals.endingLedgerBalance) >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(
                    hasActiveFilters
                      ? filtered.filteredNetChange
                      : ledgerData.totals.endingLedgerBalance,
                    currency
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
};
