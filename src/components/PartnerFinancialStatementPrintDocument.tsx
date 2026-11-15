import React from 'react';
import { CompanyProfile } from '../types/index.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import { resolveCompanyLogoSrc } from '../utils/pdfGenerator.ts';
import { PartnerFinancialStatementData } from '../utils/partnerFinancialStatement.ts';

interface PartnerFinancialStatementPrintDocumentProps {
  statement: PartnerFinancialStatementData;
  companyProfile: CompanyProfile;
  elementId?: string;
}

export const PartnerFinancialStatementPrintDocument: React.FC<
  PartnerFinancialStatementPrintDocumentProps
> = ({
  statement,
  companyProfile,
  elementId = 'partner-financial-statement-printable',
}) => {
  const resolvedLogoSrc = resolveCompanyLogoSrc(companyProfile.logoUrl);
  const { summary, equityDistribution, currentDeposits, recentWithdrawals, currency } = statement;
  const recentWithdrawalsSubtotal = recentWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalEquityPct = equityDistribution.reduce((sum, e) => sum + e.equityPercent, 0);

  return (
    <div
      id={elementId}
      data-testid="partner-financial-statement-document"
      className="zsb-print-paper w-[760px] bg-white p-6 space-y-5 text-slate-900"
      style={{ backgroundColor: '#ffffff', color: '#000000' }}
    >
      {/* Official Corporate Letterhead */}
      <div
        style={{ borderBottom: '2px solid #0f172a' }}
        className="pb-4 text-center space-y-1.5"
      >
        <div className="flex justify-center mb-1">
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '2px solid #fbbf24',
              backgroundColor: '#ffffff',
              padding: '2px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={resolvedLogoSrc}
              alt={companyProfile.companyName}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith(COMPANY_LOGO_URL)) {
                  target.src = COMPANY_LOGO_URL;
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: '9999px',
                display: 'block',
              }}
            />
          </div>
        </div>

        <div
          className="zsb-3d-text-print text-3xl font-black tracking-widest uppercase"
          style={{
            color: '#f59e0b',
            fontFamily: "'Cinzel', Georgia, Cambria, 'Times New Roman', Times, serif",
            fontWeight: 900,
            letterSpacing: '0.09em',
            textShadow:
              '1px 1px 0px #b45309, 2px 2px 0px #92400e, 3px 3px 0px #78350f, 4px 4px 0px #451a03, 5px 5px 7px rgba(15, 23, 42, 0.35)',
          }}
        >
          {companyProfile.companyName}
        </div>

        <div style={{ color: '#000000' }} className="text-xs font-bold tracking-wide">
          Address: {companyProfile.address}
        </div>

        <div style={{ color: '#000000' }} className="text-xs font-bold font-mono">
          Mobile: {companyProfile.mobiles.join(' , ')} | EMAIL:{' '}
          {companyProfile.email && companyProfile.email !== 'www.zsbaquatics.com'
            ? companyProfile.email
            : 'zsbaquatics@gmail.com'}
          , Website: {companyProfile.website || 'www.zsbaquatics.com'}
        </div>

        <div
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
          className="inline-block mt-2 px-5 py-1.5 rounded text-xs font-bold tracking-widest uppercase"
        >
          PARTNER FINANCIAL STATEMENT — DEPOSITS, EQUITY &amp; WITHDRAWALS
        </div>

        <div className="pt-1 flex justify-center gap-6 text-[11px] font-mono font-semibold text-slate-600">
          <span>Statement Ref: {statement.statementRef}</span>
          <span>Statement Date: {formatDate(statement.generatedDate)}</span>
          <span>Partners: {summary.partnerCount}</span>
        </div>
      </div>

      {/* Executive Balance & Capital Position Strip */}
      <div
        style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
        className="grid grid-cols-3 gap-2.5 text-xs p-3 rounded border"
      >
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            Total Partner Deposits (+)
          </span>
          <span className="font-mono font-black text-emerald-800 text-sm tabular-nums">
            {formatCurrency(summary.totalPartnerDeposits, currency)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            Partner Withdrawals (&minus;)
          </span>
          <span className="font-mono font-black text-rose-800 text-sm tabular-nums">
            {formatCurrency(summary.totalPartnerWithdrawals, currency)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            Net Partner Equity Capital (=)
          </span>
          <span className="font-mono font-black text-slate-900 text-sm tabular-nums">
            {formatCurrency(summary.netPartnerCapital, currency)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            Export &amp; Other Income (+)
          </span>
          <span className="font-mono font-bold text-emerald-700 text-xs tabular-nums">
            {formatCurrency(summary.totalIncomeAdded, currency)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            Costing &amp; Profit Payouts (&minus;)
          </span>
          <span className="font-mono font-bold text-rose-700 text-xs tabular-nums">
            {formatCurrency(summary.totalCostingDeducted + summary.totalProfitDistributed, currency)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            Current Total Balance (=)
          </span>
          <span
            className={`font-mono font-black text-sm tabular-nums ${
              summary.totalBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            {formatCurrency(summary.totalBalance, currency)}
          </span>
        </div>
      </div>

      {/* Section 1: Partner Equity Distribution */}
      <div className="space-y-2">
        <div
          style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }}
          className="px-3 py-1.5 rounded border flex items-center justify-between gap-2"
        >
          <span className="font-black text-xs uppercase tracking-wide text-slate-900">
            1. Partner Equity Distribution Summary
          </span>
          <span className="font-mono text-[10px] font-semibold text-slate-600">
            {summary.fundedPartnerCount}/{summary.partnerCount} Funded Partner(s)
          </span>
        </div>

        <table
          data-testid="fs-equity-distribution-table"
          className="w-full text-[11px] border border-slate-300 border-collapse"
        >
          <thead>
            <tr
              style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}
              className="uppercase font-bold text-[10px] border-b border-slate-300"
            >
              <th className="p-1.5 border-r border-slate-300 text-center w-10">SL</th>
              <th className="p-1.5 border-r border-slate-300 text-left">PARTNER NAME</th>
              <th className="p-1.5 border-r border-slate-300 text-center">DEP / W/D</th>
              <th className="p-1.5 border-r border-slate-300 text-right">DEPOSITED ({currency})</th>
              <th className="p-1.5 border-r border-slate-300 text-right">WITHDRAWN ({currency})</th>
              <th className="p-1.5 border-r border-slate-300 text-right">NET CAPITAL ({currency})</th>
              <th className="p-1.5 text-right">EQUITY %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {equityDistribution.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  No registered partners recorded.
                </td>
              </tr>
            ) : (
              equityDistribution.map((partner, idx) => (
                <tr key={partner.partnerKey} className="font-medium">
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono">
                    <span className="zsb-sl-badge">{idx + 1}</span>
                  </td>
                  <td className="p-1.5 border-r border-slate-200 font-bold text-slate-900">
                    {partner.partnerName}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono">
                    {partner.depositCount} / {partner.withdrawalCount}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-right font-mono tabular-nums text-emerald-800">
                    {formatCurrency(partner.totalDeposited, '')}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-right font-mono tabular-nums text-rose-800">
                    {partner.totalWithdrawn > 0
                      ? formatCurrency(partner.totalWithdrawn, '')
                      : '0.00'}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold tabular-nums text-slate-900">
                    {formatCurrency(partner.netContribution, '')}
                  </td>
                  <td className="p-1.5 text-right font-mono font-black tabular-nums text-blue-900">
                    {partner.equityPercent.toFixed(2)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr
              style={{ backgroundColor: '#f1f5f9' }}
              className="font-bold border-t-2 border-slate-400 text-[11px]"
            >
              <td colSpan={2} className="p-1.5 border-r border-slate-300 text-right uppercase">
                Total Partner Capital &amp; Equity:
              </td>
              <td className="p-1.5 border-r border-slate-300 text-center font-mono">
                {summary.depositCount} / {summary.withdrawalCount}
              </td>
              <td className="p-1.5 border-r border-slate-300 text-right font-mono tabular-nums text-emerald-800 font-black">
                {formatCurrency(summary.totalPartnerDeposits, currency)}
              </td>
              <td className="p-1.5 border-r border-slate-300 text-right font-mono tabular-nums text-rose-800 font-black">
                {formatCurrency(summary.totalPartnerWithdrawals, currency)}
              </td>
              <td className="p-1.5 border-r border-slate-300 text-right font-mono tabular-nums text-slate-900 font-black">
                {formatCurrency(summary.netPartnerCapital, currency)}
              </td>
              <td className="p-1.5 text-right font-mono tabular-nums text-blue-900 font-black">
                {totalEquityPct.toFixed(2)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Section 2: All Current Partner Deposits */}
      <div className="space-y-2">
        <div
          style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }}
          className="px-3 py-1.5 rounded border flex items-center justify-between gap-2"
        >
          <span className="font-black text-xs uppercase tracking-wide text-slate-900">
            2. Current Partner Capital Deposits
          </span>
          <span className="font-mono text-[10px] font-semibold text-slate-600">
            {currentDeposits.length} Deposit Record(s)
          </span>
        </div>

        <table
          data-testid="fs-current-deposits-table"
          className="w-full text-[11px] border border-slate-300 border-collapse"
        >
          <thead>
            <tr
              style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}
              className="uppercase font-bold text-[10px] border-b border-slate-300"
            >
              <th className="p-1.5 border-r border-slate-300 text-center w-10">SL</th>
              <th className="p-1.5 border-r border-slate-300 text-center">DATE</th>
              <th className="p-1.5 border-r border-slate-300 text-left">PARTNER NAME</th>
              <th className="p-1.5 border-r border-slate-300 text-left">METHOD</th>
              <th className="p-1.5 border-r border-slate-300 text-left">REF / SLIP</th>
              <th className="p-1.5 border-r border-slate-300 text-left">NOTES</th>
              <th className="p-1.5 text-right">DEPOSIT ({currency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {currentDeposits.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  No partner deposits recorded yet.
                </td>
              </tr>
            ) : (
              currentDeposits.map((dep, idx) => (
                <tr key={dep.id} className="font-medium">
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono">
                    <span className="zsb-sl-badge">{idx + 1}</span>
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono whitespace-nowrap">
                    {formatDate(dep.date)}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 font-bold text-slate-900">
                    {dep.partnerName}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-slate-700">
                    {dep.paymentMethod}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 font-mono text-slate-700">
                    {dep.referenceNo}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-slate-600">{dep.notes}</td>
                  <td className="p-1.5 text-right font-mono font-bold tabular-nums text-emerald-800 whitespace-nowrap">
                    {formatCurrency(dep.amount, '')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr
              style={{ backgroundColor: '#f1f5f9' }}
              className="font-bold border-t-2 border-slate-400 text-[11px]"
            >
              <td colSpan={6} className="p-1.5 border-r border-slate-300 text-right uppercase">
                Total Current Partner Deposits:
              </td>
              <td className="p-1.5 text-right font-mono tabular-nums text-emerald-800 font-black whitespace-nowrap">
                {formatCurrency(summary.totalPartnerDeposits, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Section 3: Recent Partner Withdrawals */}
      <div className="space-y-2">
        <div
          style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }}
          className="px-3 py-1.5 rounded border flex items-center justify-between gap-2"
        >
          <span className="font-black text-xs uppercase tracking-wide text-slate-900">
            3. Recent Partner Withdrawals
          </span>
          <span className="font-mono text-[10px] font-semibold text-slate-600">
            Showing {recentWithdrawals.length} of {summary.withdrawalCount} Withdrawal(s)
          </span>
        </div>

        <table
          data-testid="fs-recent-withdrawals-table"
          className="w-full text-[11px] border border-slate-300 border-collapse"
        >
          <thead>
            <tr
              style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}
              className="uppercase font-bold text-[10px] border-b border-slate-300"
            >
              <th className="p-1.5 border-r border-slate-300 text-center w-10">SL</th>
              <th className="p-1.5 border-r border-slate-300 text-center">DATE</th>
              <th className="p-1.5 border-r border-slate-300 text-left">PARTNER NAME</th>
              <th className="p-1.5 border-r border-slate-300 text-left">METHOD</th>
              <th className="p-1.5 border-r border-slate-300 text-left">VOUCHER / REF</th>
              <th className="p-1.5 border-r border-slate-300 text-left">REASON / NOTES</th>
              <th className="p-1.5 text-right">WITHDRAWN ({currency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {recentWithdrawals.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  No partner withdrawals recorded.
                </td>
              </tr>
            ) : (
              recentWithdrawals.map((wdr, idx) => (
                <tr key={wdr.id} className="font-medium">
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono">
                    <span className="zsb-sl-badge">{idx + 1}</span>
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-mono whitespace-nowrap">
                    {formatDate(wdr.date)}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 font-bold text-slate-900">
                    {wdr.partnerName}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-slate-700">
                    {wdr.paymentMethod}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 font-mono text-slate-700">
                    {wdr.referenceNo}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-slate-600">{wdr.notes}</td>
                  <td className="p-1.5 text-right font-mono font-bold tabular-nums text-rose-800 whitespace-nowrap">
                    &minus;{formatCurrency(wdr.amount, '')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr
              style={{ backgroundColor: '#f1f5f9' }}
              className="font-bold border-t-2 border-slate-400 text-[11px]"
            >
              <td colSpan={6} className="p-1.5 border-r border-slate-300 text-right uppercase">
                Total Withdrawals (All-Time: {formatCurrency(summary.totalPartnerWithdrawals, currency)}):
              </td>
              <td className="p-1.5 text-right font-mono tabular-nums text-rose-800 font-black whitespace-nowrap">
                &minus;{formatCurrency(recentWithdrawalsSubtotal, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Authorized Signatories */}
      <div className="pt-10 grid grid-cols-2 gap-8 text-center text-xs">
        <div className="flex flex-col items-center">
          <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
            <div
              style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#0f172a' }}
              className="text-base font-bold tracking-wider"
            >
              {companyProfile.managingPartner}
            </div>
          </div>
          <div style={{ color: '#0f172a' }} className="mt-1.5 font-bold uppercase tracking-wider text-xs">
            Managing Partner
          </div>
          <div
            style={{ color: '#d97706', fontWeight: 800 }}
            className="text-[10px] uppercase font-extrabold text-amber-500 zsb-golden-brand-light"
          >
            {companyProfile.companyName}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
            <div
              style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#0f172a' }}
              className="text-base font-bold tracking-wider"
            >
              {companyProfile.partner}
            </div>
          </div>
          <div style={{ color: '#0f172a' }} className="mt-1.5 font-bold uppercase tracking-wider text-xs">
            Partner
          </div>
          <div
            style={{ color: '#d97706', fontWeight: 800 }}
            className="text-[10px] uppercase font-extrabold text-amber-500 zsb-golden-brand-light"
          >
            {companyProfile.companyName}
          </div>
        </div>
      </div>

      {/* Footer Validation */}
      <div
        style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
        className="text-center text-[10px] pt-4"
      >
        Official Partner Financial Statement from{' '}
        <strong
          style={{ color: '#d97706', fontWeight: 800 }}
          className="font-extrabold text-amber-500 zsb-golden-brand-light"
        >
          {companyProfile.companyName}
        </strong>{' '}
        · Ref: {statement.statementRef} · Validated and archived.
      </div>
    </div>
  );
};
