import React from 'react';
import { CompanyProfile, PaymentRecord } from '../types/index.ts';
import {
  formatCurrency,
  formatDate,
  formatRMB,
  classifyPaymentCategory,
} from '../utils/calculations.ts';

interface PaymentSlipPrintCardProps {
  payment: PaymentRecord;
  companyProfile: CompanyProfile;
  pageNumber?: number;
  totalPages?: number;
  id?: string;
}

export const PaymentSlipPrintCard: React.FC<PaymentSlipPrintCardProps> = ({
  payment,
  companyProfile,
  pageNumber,
  totalPages,
  id,
}) => {
  const category = classifyPaymentCategory(payment);
  const isExporter = category === 'exporter';
  const currency = isExporter ? 'RMB' : companyProfile.currency;

  const items =
    payment.items && payment.items.length > 0
      ? payment.items
      : [
          {
            id: 'default-row',
            description: payment.description || (isExporter ? 'Exporter Fish Settlement' : 'Fish Procurement Payment'),
            debitAmount: payment.totalAmount || 0,
            creditAmount: payment.paidAmount || 0,
            balance: payment.balance || 0,
            status: payment.status,
          },
        ];

  return (
    <div
      id={id}
      data-testid={id ? `payment-slip-card-${payment.id}` : undefined}
      className="batch-payment-slip-page bg-white p-6 sm:p-8 space-y-5 text-slate-900 border border-slate-300 rounded-sm shadow-sm print:border-none print:shadow-none print:p-0"
      style={{
        backgroundColor: '#ffffff',
        color: '#000000',
        pageBreakAfter: 'always',
        breakAfter: 'page',
      }}
    >
      {/* 1. Official Header */}
      <div
        style={{ borderBottom: '2px solid #0f172a' }}
        className="pb-4 text-center space-y-1.5"
      >
        {/* Company Logo Emblem */}
        <div className="flex justify-center mb-1">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 bg-white p-0.5 shadow-xs">
            <img
              src={
                companyProfile.logoUrl ||
                '/assets/aistudio/Gemini_Generated_Image_x7u4nx7u4nx7u4nx_2672ff47.jpg'
              }
              alt={companyProfile.companyName}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
        </div>

        {/* Golden 3D Company Name */}
        <div
          className="zsb-3d-text-print text-3xl sm:text-4xl font-black tracking-widest uppercase"
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

        <div style={{ color: '#000000' }} className="text-xs sm:text-sm font-bold tracking-wide">
          Address: {companyProfile.address}
        </div>

        <div style={{ color: '#000000' }} className="text-xs sm:text-sm font-bold font-mono">
          Mobile: {companyProfile.mobiles.join(' , ')} | EMAIL:{' '}
          {companyProfile.email || 'www.zsbaquatics.com'}
        </div>

        <div
          style={{
            backgroundColor: isExporter ? '#126b62' : '#0f172a',
            color: '#ffffff',
          }}
          className="inline-block mt-2 px-5 py-1.5 rounded text-xs font-bold tracking-widest uppercase shadow-sm"
        >
          {isExporter
            ? 'EXPORTER PAYMENT SLIP & RMB SETTLEMENT VOUCHER (付款单)'
            : 'SUPPLIER PAYMENT VOUCHER — OFFICIAL PAYMENT SLIP'}
        </div>
      </div>

      {/* 2. Metadata Grid */}
      <div
        style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs p-3 rounded border"
      >
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            VOUCHER / SLIP NO:
          </span>
          <span className="font-mono font-black text-slate-900 text-sm">
            {payment.invoiceNumber}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            DATE:
          </span>
          <span className="font-semibold text-slate-800 font-mono">
            {formatDate(payment.date)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            {isExporter ? 'EXPORTER / MARK:' : 'SUPPLIER / BENEFICIARY:'}
          </span>
          <span className="font-black text-purple-950 truncate block">
            {payment.description}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
            {isExporter ? 'EXPORTER STATUS:' : 'CONTACT / PHONE:'}
          </span>
          <span className="font-bold text-slate-800 font-mono">
            {isExporter ? (
              <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-black text-[10px]">
                {payment.status || 'REPORT'}
              </span>
            ) : (
              payment.contactNumber || 'VERIFIED SUPPLIER'
            )}
          </span>
        </div>
      </div>

      {/* Secondary Meta Row if Shipping Mark or Export Reference Exists */}
      {(payment.shippingMark || payment.exportGoodsRef) && (
        <div
          style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }}
          className="flex flex-wrap items-center justify-between px-3 py-1.5 rounded border text-[11px]"
        >
          {payment.shippingMark && (
            <div>
              <span className="text-slate-500 font-bold uppercase">Shipping Mark:</span>{' '}
              <strong className="font-mono text-purple-900 font-black">
                {payment.shippingMark}
              </strong>
            </div>
          )}
          {payment.exportGoodsRef && (
            <div>
              <span className="text-slate-500 font-bold uppercase">Export Consignment Ref:</span>{' '}
              <strong className="font-mono text-slate-800">{payment.exportGoodsRef}</strong>
            </div>
          )}
          <div>
            <span className="text-slate-500 font-bold uppercase">Payment Type:</span>{' '}
            <strong className="uppercase font-bold text-teal-900">
              {isExporter ? 'Overseas Exporter Settlement' : 'Local Fish Supplier Disbursement'}
            </strong>
          </div>
        </div>
      )}

      {/* 3. Items & Particulars Ledger Table */}
      <table className="w-full text-xs border border-slate-300 border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px] border-b border-slate-300">
            <th className="p-2 border-r border-slate-300 text-center w-12">SL</th>
            <th className="p-2 border-r border-slate-300 text-left">PARTICULARS / DESCRIPTION</th>
            <th className="p-2 border-r border-slate-300 text-right w-32">
              DEBIT ({currency})
            </th>
            <th className="p-2 border-r border-slate-300 text-right w-32">
              CREDIT / PAID ({currency})
            </th>
            <th
              className={`p-2 text-right w-32 ${
                isExporter ? 'border-r border-slate-300' : ''
              }`}
            >
              BALANCE ({currency})
            </th>
            {isExporter && <th className="p-2 text-center w-28">STATUS</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((row: any, i: number) => (
            <tr key={i} className="font-medium">
              <td className="p-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
              <td className="p-2 border-r border-slate-200 font-semibold">{row.description}</td>
              <td className="p-2 border-r border-slate-200 text-right font-mono tabular-nums">
                {formatCurrency(row.debitAmount, '')}
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono tabular-nums text-emerald-800 font-bold">
                {formatCurrency(row.creditAmount, '')}
              </td>
              <td
                className={`p-2 text-right font-mono tabular-nums font-bold ${
                  Number(row.balance) > 0 ? 'text-rose-700' : 'text-slate-800'
                } ${isExporter ? 'border-r border-slate-200' : ''}`}
              >
                {formatCurrency(row.balance, '')}
              </td>
              {isExporter && (
                <td className="p-2 text-center font-bold uppercase text-[10px]">
                  {row.status || payment.status || 'REPORT'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
            <td colSpan={2} className="p-2 text-right uppercase text-slate-900 border-r border-slate-300">
              VOUCHER GRAND TOTAL:
            </td>
            <td className="p-2 text-right font-mono font-black tabular-nums border-r border-slate-300">
              {formatCurrency(payment.totalAmount, currency)}
            </td>
            <td className="p-2 text-right font-mono font-black tabular-nums text-emerald-800 border-r border-slate-300">
              {formatCurrency(payment.paidAmount, currency)}
            </td>
            <td
              className={`p-2 text-right font-mono tabular-nums text-sm font-black text-rose-700 ${
                isExporter ? 'border-r border-slate-300' : ''
              }`}
            >
              {formatCurrency(payment.balance, currency)}
            </td>
            {isExporter && (
              <td className="p-2 text-center font-bold uppercase text-[10px]">
                {payment.status || 'REPORT'}
              </td>
            )}
          </tr>
        </tfoot>
      </table>

      {/* 4. Remarks (if any) */}
      {payment.remarks && (
        <div className="text-xs p-2.5 bg-slate-50 rounded border border-slate-200">
          <strong className="text-slate-700">Remarks / Transaction Memo:</strong>{' '}
          <span className="text-slate-900">{payment.remarks}</span>
        </div>
      )}

      {/* 5. Bottom Signatures Block */}
      <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
        {/* Managing Partner Signature */}
        <div className="flex flex-col items-center">
          <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1.5">
            <div
              style={{
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                color: '#0f172a',
              }}
              className="text-base font-bold tracking-wider"
            >
              {companyProfile.managingPartner}
            </div>
          </div>
          <div
            style={{ color: '#0f172a' }}
            className="mt-1.5 font-bold uppercase tracking-wider text-xs"
          >
            Managing Partner
          </div>
          <div style={{ color: '#64748b' }} className="text-[10px] uppercase font-semibold">
            {companyProfile.companyName}
          </div>
        </div>

        {/* Partner Signature with Handwritten Signature Image */}
        <div className="flex flex-col items-center">
          <div className="text-right space-y-0.5 flex flex-col items-center">
            <div className="text-[10px] font-bold text-black uppercase tracking-wider">
              YOURS FAITHFULLY - 此致
            </div>
            <div className="py-1 flex justify-center">
              <img
                src="/assets/aistudio/Md._Sohel_Rana_38797da9.jpg"
                alt="Md. Sohel Rana Signature"
                className="h-12 w-auto object-contain select-none"
              />
            </div>
            <div style={{ borderBottom: '2px solid #0f172a' }} className="w-52 pb-1 text-center">
              <span className="text-xs font-black text-black uppercase tracking-wider">
                {companyProfile.partner || 'MD. SOHEL RANA'}
              </span>
            </div>
            <div className="text-[11px] font-bold text-black uppercase tracking-widest mt-1">
              PARTNER
            </div>
            <div style={{ color: '#64748b' }} className="text-[10px] uppercase font-semibold">
              {companyProfile.companyName}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Footer Certification & Page Indicator */}
      <div
        style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
        className="text-center text-[10px] pt-3 flex flex-wrap items-center justify-between"
      >
        <span>
          Official computer-generated payment voucher from {companyProfile.companyName} • Voucher{' '}
          {payment.invoiceNumber}
        </span>
        {pageNumber && totalPages && (
          <span className="font-mono font-bold text-slate-600">
            Page {pageNumber} of {totalPages}
          </span>
        )}
      </div>
    </div>
  );
};
