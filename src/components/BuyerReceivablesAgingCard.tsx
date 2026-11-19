import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  AgingBucketKey,
  BuyerAgingSummaryRow,
  buildBuyerAgingCsv,
  calculateBuyerReceivablesAging,
  formatBilingualBuyerStatement,
} from '../utils/buyerReceivablesAging.ts';
import { formatCurrency } from '../utils/calculations.ts';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Globe,
  X,
} from 'lucide-react';

export const BuyerReceivablesAgingCard: React.FC = () => {
  const { packings, payments, companyProfile, showToast } = useApp();

  const [bucketFilter, setBucketFilter] = useState<'all' | AgingBucketKey>('all');
  const [searchMark, setSearchMark] = useState('');
  const [expandedBuyerKey, setExpandedBuyerKey] = useState<string | null>(null);
  const [statementBuyer, setStatementBuyer] = useState<BuyerAgingSummaryRow | null>(null);
  const [copiedStatement, setCopiedStatement] = useState(false);

  const agingReport = useMemo(
    () =>
      calculateBuyerReceivablesAging(packings, payments, {
        defaultRmbRate: companyProfile.rmbExchangeRate || 16.5,
      }),
    [packings, payments, companyProfile.rmbExchangeRate]
  );

  const filteredBuyers = useMemo(() => {
    const q = searchMark.trim().toLowerCase();
    return agingReport.buyers.filter((buyer) => {
      const matchesSearch =
        !q ||
        buyer.shippingMark.toLowerCase().includes(q) ||
        buyer.destinations.some((d) => d.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (bucketFilter === 'all') return true;
      if (bucketFilter === '0_7') return buyer.bucket0To7Rmb > 0;
      if (bucketFilter === '8_15') return buyer.bucket8To15Rmb > 0;
      if (bucketFilter === '16_30') return buyer.bucket16To30Rmb > 0;
      return buyer.bucketOver30Rmb > 0;
    });
  }, [agingReport.buyers, bucketFilter, searchMark]);

  const handleDownloadCsv = () => {
    const csv = buildBuyerAgingCsv(agingReport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZSB_Buyer_Receivables_Aging_${agingReport.asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded Buyer Receivables Aging CSV report.');
  };

  const handleCopyBilingualStatement = async (buyer: BuyerAgingSummaryRow) => {
    const text = formatBilingualBuyerStatement(
      buyer,
      companyProfile.companyName || 'ZSB AQUATICS',
      agingReport.asOfDate
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStatement(true);
      showToast(`Copied bilingual WeChat/PDF statement for ${buyer.shippingMark}.`);
      setTimeout(() => setCopiedStatement(false), 2000);
    } catch {
      setStatementBuyer(buyer);
    }
  };

  return (
    <section
      aria-label="Importer and Shipping Mark Receivables Aging"
      data-testid="buyer-receivables-aging-section"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="bg-[#273E56] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#00897b]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-mono text-[#5eead4]">
            <Globe className="w-4 h-4 shrink-0" />
            <span>Export Receivables Intelligence · As of {agingReport.asOfDate}</span>
          </div>
          <h2 className="text-base font-extrabold tracking-tight text-white">
            Chinese Importer / Shipping Mark Receivables Aging &amp; Bilingual Statements
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchMark}
            onChange={(e) => setSearchMark(e.target.value)}
            placeholder="Filter shipping mark or city..."
            aria-label="Filter shipping mark or destination"
            data-testid="buyer-aging-search-input"
            className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 w-52"
          />
          <button
            type="button"
            onClick={handleDownloadCsv}
            data-testid="buyer-aging-export-csv-btn"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-black cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Aging CSV</span>
          </button>
        </div>
      </div>

      {/* Aging Buckets Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-slate-50 border-b border-slate-200">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setBucketFilter('all')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setBucketFilter('all');
            }
          }}
          data-testid="aging-bucket-all"
          className={`text-left p-3.5 rounded-xl bg-white border border-slate-200 border-t-4 border-t-[#273E56] shadow-2xs hover:shadow-sm transition cursor-pointer ${
            bucketFilter === 'all' ? 'ring-2 ring-[#273E56]/80 bg-slate-50/70' : ''
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Total Unpaid Receivables
          </div>
          <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
            ¥{agingReport.totalOutstandingRmb.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {formatCurrency(agingReport.totalOutstandingBdt, 'Tk')} · {agingReport.totalBuyersWithDue} Marks
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setBucketFilter('0_7')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setBucketFilter('0_7');
            }
          }}
          data-testid="aging-bucket-0-7"
          className={`text-left p-3.5 rounded-xl bg-white border border-slate-200 border-t-4 border-t-emerald-500 shadow-2xs hover:shadow-sm transition cursor-pointer ${
            bucketFilter === '0_7' ? 'ring-2 ring-emerald-600 bg-emerald-50/40' : ''
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
            0–7 Days (Current)
          </div>
          <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
            ¥{agingReport.bucketTotalsRmb['0_7'].toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {agingReport.bucketCounts['0_7']} Shipments
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setBucketFilter('8_15')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setBucketFilter('8_15');
            }
          }}
          data-testid="aging-bucket-8-15"
          className={`text-left p-3.5 rounded-xl bg-white border border-slate-200 border-t-4 border-t-sky-500 shadow-2xs hover:shadow-sm transition cursor-pointer ${
            bucketFilter === '8_15' ? 'ring-2 ring-sky-600 bg-sky-50/40' : ''
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-sky-800">
            8–15 Days Due
          </div>
          <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
            ¥{agingReport.bucketTotalsRmb['8_15'].toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {agingReport.bucketCounts['8_15']} Shipments
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setBucketFilter('16_30')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setBucketFilter('16_30');
            }
          }}
          data-testid="aging-bucket-16-30"
          className={`text-left p-3.5 rounded-xl bg-white border border-slate-200 border-t-4 border-t-amber-500 shadow-2xs hover:shadow-sm transition cursor-pointer ${
            bucketFilter === '16_30' ? 'ring-2 ring-amber-600 bg-amber-50/40' : ''
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
            16–30 Days Late
          </div>
          <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
            ¥{agingReport.bucketTotalsRmb['16_30'].toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {agingReport.bucketCounts['16_30']} Shipments
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setBucketFilter('over_30')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setBucketFilter('over_30');
            }
          }}
          data-testid="aging-bucket-over-30"
          className={`text-left p-3.5 rounded-xl bg-white border border-slate-200 border-t-4 border-t-rose-600 shadow-2xs hover:shadow-sm transition cursor-pointer ${
            bucketFilter === 'over_30' ? 'ring-2 ring-rose-600 bg-rose-50/40' : ''
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-rose-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>30+ Days Overdue</span>
          </div>
          <div className="text-lg font-extrabold font-mono tabular-nums text-rose-800 mt-1">
            ¥{agingReport.bucketTotalsRmb.over_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {agingReport.bucketCounts.over_30} Critical Shipments
          </div>
        </div>
      </div>

      {/* Buyer Table */}
      <div className="overflow-x-auto">
        {filteredBuyers.length === 0 ? (
          <div
            data-testid="buyer-aging-empty-state"
            className="p-8 text-center text-xs text-slate-500 space-y-1"
          >
            <p className="font-bold text-slate-700">
              No Unpaid Buyer Receivables Match This Filter
            </p>
            <p>
              All export manifests for this filter window are either marked PAID or have zero remaining RMB balance.
            </p>
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                <th className="py-2.5 px-4">Shipping Mark / Buyer</th>
                <th className="py-2.5 px-3 text-right">Unpaid</th>
                <th className="py-2.5 px-3 text-right">0–7d (¥)</th>
                <th className="py-2.5 px-3 text-right">8–15d (¥)</th>
                <th className="py-2.5 px-3 text-right">16–30d (¥)</th>
                <th className="py-2.5 px-3 text-right text-rose-700">30+d Overdue (¥)</th>
                <th className="py-2.5 px-3 text-right">Total Due (¥ / BDT)</th>
                <th className="py-2.5 px-4 text-right">Bilingual Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {filteredBuyers.map((buyer) => {
                const isExpanded = expandedBuyerKey === buyer.buyerKey;
                return (
                  <React.Fragment key={buyer.buyerKey}>
                    <tr
                      data-testid={`buyer-aging-row-${buyer.buyerKey}`}
                      className={
                        buyer.bucketOver30Rmb > 0
                          ? 'bg-rose-50/40 hover:bg-rose-50/80'
                          : 'hover:bg-slate-50'
                      }
                    >
                      <td className="py-3 px-4 font-sans">
                        <div className="font-extrabold text-slate-900">{buyer.shippingMark}</div>
                        <div className="text-[11px] text-slate-500">
                          {buyer.destinations.join(' / ') || 'China Export'} · Max Age:{' '}
                          <strong
                            className={
                              buyer.maxDaysOverdue > 30 ? 'text-rose-700' : 'text-slate-700'
                            }
                          >
                            {buyer.maxDaysOverdue}d
                          </strong>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        {buyer.unpaidShipmentsCount}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">
                        {buyer.bucket0To7Rmb > 0 ? buyer.bucket0To7Rmb.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-800">
                        {buyer.bucket8To15Rmb > 0 ? buyer.bucket8To15Rmb.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-orange-800 font-semibold">
                        {buyer.bucket16To30Rmb > 0 ? buyer.bucket16To30Rmb.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700 font-extrabold">
                        {buyer.bucketOver30Rmb > 0 ? buyer.bucketOver30Rmb.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="font-extrabold text-slate-900">
                          ¥{buyer.outstandingRmb.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {formatCurrency(buyer.outstandingBdt, 'Tk')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`buyer-statement-btn-${buyer.buyerKey}`}
                            onClick={() => setStatementBuyer(buyer)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-3 h-3" />
                            <span>CN/EN Slip</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Toggle shipments for ${buyer.shippingMark}`}
                            onClick={() =>
                              setExpandedBuyerKey(isExpanded ? null : buyer.buyerKey)
                            }
                            className="p-1 text-black cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="text-[11px] font-sans font-bold text-slate-700 mb-2">
                            Unpaid Manifests for {buyer.shippingMark} ({buyer.shipments.length})
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {buyer.shipments.map((s) => (
                              <div
                                key={s.packingId}
                                className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-[11px]"
                              >
                                <div>
                                  <div className="font-bold text-slate-900">
                                    {s.invoiceNumber} · Flight {s.flight}
                                  </div>
                                  <div className="text-slate-500">
                                    {s.packingDate} · {s.totalBox} Box · {s.totalWeightKg} KG ·{' '}
                                    <span
                                      className={
                                        s.daysOutstanding > 30
                                          ? 'text-rose-700 font-bold'
                                          : 'text-slate-700 font-semibold'
                                      }
                                    >
                                      {s.daysOutstanding} days old
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-extrabold text-slate-900">
                                    ¥{s.outstandingRmb.toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {formatCurrency(s.outstandingBdt, 'Tk')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bilingual Statement Preview Modal */}
      {statementBuyer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bilingual Importer Receivable Statement"
          data-testid="buyer-bilingual-statement-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 print:hidden"
        >
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#273E56] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono text-[#5eead4]">
                  WeChat / WhatsApp Ready · English + 中文
                </div>
                <h3 className="text-sm font-extrabold">
                  Receivables Statement — {statementBuyer.shippingMark}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close statement preview"
                onClick={() => setStatementBuyer(null)}
                className="p-1 text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <pre
                data-testid="buyer-bilingual-statement-text"
                className="p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed"
              >
                {formatBilingualBuyerStatement(
                  statementBuyer,
                  companyProfile.companyName || 'ZSB AQUATICS',
                  agingReport.asOfDate
                )}
              </pre>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="copy-bilingual-statement-btn"
                  onClick={() => handleCopyBilingualStatement(statementBuyer)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black cursor-pointer"
                >
                  {copiedStatement ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy For WeChat</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStatementBuyer(null)}
                  className="px-4 py-2 text-xs font-bold text-black cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
