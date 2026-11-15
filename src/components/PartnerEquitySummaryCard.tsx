import React from 'react';
import { Users } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import { PartnerEquityRosterSummary } from '../utils/totalBalance.ts';

interface PartnerEquitySummaryCardProps {
  roster: PartnerEquityRosterSummary;
  currency: string;
}

export const PartnerEquitySummaryCard: React.FC<PartnerEquitySummaryCardProps> = ({
  roster,
  currency,
}) => {
  const {
    items,
    totalCapitalDeposited,
    totalCapitalWithdrawn,
    totalNetPartnerCapital,
    partnerCount,
    fundedPartnerCount,
  } = roster;

  const gridColsClass =
    items.length <= 1
      ? 'grid-cols-1'
      : items.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : items.length === 3
          ? 'grid-cols-1 sm:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';

  const getCellBorderClass = (index: number, total: number): string => {
    if (total <= 1) return '';
    if (total === 2) {
      return index === 0 ? 'border-b sm:border-b-0 sm:border-r border-slate-200' : '';
    }
    if (total === 3) {
      return index < 2 ? 'border-b sm:border-b-0 sm:border-r border-slate-200' : '';
    }
    const isFourthCol = (index + 1) % 4 === 0;
    const isSecondColOnSmall = (index + 1) % 2 === 0;
    return [
      'border-b border-slate-200',
      !isSecondColOnSmall ? 'sm:border-r' : 'sm:border-r-0',
      !isFourthCol ? 'xl:border-r' : 'xl:border-r-0',
    ].join(' ');
  };

  return (
    <section
      data-testid="partner-equity-summary-card"
      aria-label="Partner Equity and Deposit Summary"
      className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden"
    >
      <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#1D6CE0] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Partner Equity &amp; Deposit Summary
            </h2>
            <p className="text-[11px] text-slate-500">
              Each partner&apos;s cumulative deposit, withdrawals, net capital, and live equity percentage
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
          <span className="font-mono font-bold tabular-nums text-slate-900">
            Net Pool: {formatCurrency(totalNetPartnerCapital, currency)}
          </span>
          {totalCapitalWithdrawn > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-600">
                Deposited: {formatCurrency(totalCapitalDeposited, currency)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-rose-700">
                Withdrawn: &minus;{formatCurrency(totalCapitalWithdrawn, currency)}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>
            {fundedPartnerCount}/{partnerCount} Active
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono font-semibold text-[#1D6CE0]">
            {totalNetPartnerCapital > 0 ? '100.00% Equity Pool' : '0.00% Allocated'}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div
          data-testid="partner-equity-summary-empty"
          className="p-6 text-center text-xs text-slate-500"
        >
          No partners registered yet. Click &ldquo;ADD PARTNER&rdquo; or submit a deposit below to track partner deposits and equity percentages.
        </div>
      ) : (
        <div
          data-testid="partner-equity-summary-grid"
          className={`grid ${gridColsClass} ${items.length >= 4 ? '-mb-px' : ''}`}
        >
          {items.map((item, idx) => {
            const slug = item.partnerKey.replace(/[^a-z0-9]+/g, '-');
            return (
              <div
                key={item.partnerKey}
                data-testid={`partner-equity-item-${slug}`}
                className={`p-4 flex flex-col justify-between gap-2.5 bg-white ${getCellBorderClass(
                  idx,
                  items.length
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                      {item.partnerName}
                    </span>
                  </div>

                  <span
                    data-testid={`partner-equity-percent-${slug}`}
                    className={`text-base sm:text-lg font-extrabold font-mono tabular-nums shrink-0 leading-none ${
                      item.equityPercent > 0 ? 'text-[#1D6CE0]' : 'text-slate-400'
                    }`}
                  >
                    {item.equityPercent.toFixed(2)}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-500">Total Deposit</span>
                    <span
                      data-testid={`partner-equity-deposit-${slug}`}
                      className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900"
                    >
                      {formatCurrency(item.totalDeposited, currency)}
                    </span>
                  </div>

                  {item.totalWithdrawn > 0 && (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium text-rose-700">Withdrawn (&minus;)</span>
                        <span
                          data-testid={`partner-equity-withdrawn-${slug}`}
                          className="text-xs font-bold font-mono tabular-nums text-rose-700"
                        >
                          &minus;{formatCurrency(item.totalWithdrawn, currency)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 pt-0.5 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-700">Net Capital</span>
                        <span
                          data-testid={`partner-equity-net-${slug}`}
                          className={`text-xs font-bold font-mono tabular-nums ${
                            item.netContribution >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatCurrency(item.netContribution, currency)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, item.equityPercent)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
                    <span className="font-mono tabular-nums">
                      {item.depositCount} {item.depositCount === 1 ? 'deposit' : 'deposits'}
                      {item.withdrawalCount > 0
                        ? ` · ${item.withdrawalCount} w/d`
                        : ''}
                    </span>
                    <span>
                      {item.lastDepositDate
                        ? `Latest: ${formatDate(item.lastDepositDate)}`
                        : item.lastWithdrawalDate
                          ? `W/D: ${formatDate(item.lastWithdrawalDate)}`
                          : 'Awaiting deposit'}
                    </span>
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
