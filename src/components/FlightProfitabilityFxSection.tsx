import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  RmbFxRateLogEntry,
  calculateFlightProfitabilityAndFx,
  loadRmbFxHistory,
  saveRmbFxHistory,
} from '../utils/flightProfitabilityFx.ts';
import { formatCurrency } from '../utils/calculations.ts';
import { ArrowLeftRight, Plane, PlusCircle, Trash2, TrendingDown, TrendingUp } from 'lucide-react';

export const FlightProfitabilityFxSection: React.FC = () => {
  const {
    packings,
    purchases,
    otherCosts,
    mortalities,
    companyProfile,
    updateCompanyProfile,
    showToast,
  } = useApp();

  const [fxHistory, setFxHistory] = useState<RmbFxRateLogEntry[]>(() =>
    loadRmbFxHistory(companyProfile.rmbExchangeRate || 16.5)
  );
  const [fxDate, setFxDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fxRateInput, setFxRateInput] = useState<string>(() =>
    String(companyProfile.rmbExchangeRate || 16.5)
  );
  const [fxSource, setFxSource] = useState<string>('Bank / Remittance Desk');
  const [applyAsActiveRate, setApplyAsActiveRate] = useState<boolean>(true);
  const [flightSearch, setFlightSearch] = useState<string>('');

  const summary = useMemo(
    () =>
      calculateFlightProfitabilityAndFx({
        packings,
        purchases,
        otherCosts,
        mortalities,
        fxHistory,
        currentRmbRate: companyProfile.rmbExchangeRate || 16.5,
      }),
    [packings, purchases, otherCosts, mortalities, fxHistory, companyProfile.rmbExchangeRate]
  );

  const visibleRows = useMemo(() => {
    const q = flightSearch.trim().toLowerCase();
    if (!q) return summary.rows;
    return summary.rows.filter(
      (r) =>
        r.flight.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        r.shippingMarks.some((m) => m.toLowerCase().includes(q))
    );
  }, [summary.rows, flightSearch]);

  const handleLogFxRate = (e: React.FormEvent) => {
    e.preventDefault();
    const numericRate = parseFloat(fxRateInput);
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      showToast('Enter a valid positive RMB to BDT exchange rate.');
      return;
    }

    const entry: RmbFxRateLogEntry = {
      id: `fx-${Date.now()}`,
      date: fxDate || new Date().toISOString().slice(0, 10),
      rateBdtPerRmb: Math.round(numericRate * 1000) / 1000,
      source: fxSource.trim() || 'Manual Desk Rate',
      createdAt: new Date().toISOString(),
    };

    const next = [entry, ...fxHistory.filter((item) => item.date !== entry.date)].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    setFxHistory(next);
    saveRmbFxHistory(next);

    if (applyAsActiveRate) {
      updateCompanyProfile({ rmbExchangeRate: entry.rateBdtPerRmb });
    }
    showToast(
      `Logged RMB rate 1 RMB = ${entry.rateBdtPerRmb} TK for ${entry.date}${
        applyAsActiveRate ? ' (Active company rate updated)' : ''
      }.`
    );
  };

  const handleDeleteFxEntry = (id: string) => {
    const next = fxHistory.filter((item) => item.id !== id);
    setFxHistory(next);
    saveRmbFxHistory(next);
    showToast('Removed exchange rate history entry.');
  };

  return (
    <section
      aria-label="Flight-by-Flight Net Profitability and RMB FX Gain/Loss Tracker"
      data-testid="flight-profitability-fx-section"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:break-inside-avoid"
    >
      {/* Header */}
      <div className="bg-[#273E56] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-400">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
            <Plane className="w-4 h-4 shrink-0" />
            <span>
              Shipment Margin &amp; Currency Variance · Active Rate: 1 RMB ={' '}
              {companyProfile.rmbExchangeRate || 16.5} TK
            </span>
          </div>
          <h2 className="text-base font-extrabold tracking-tight text-white">
            Flight-by-Flight Net Profitability &amp; RMB Exchange Rate (FX) Gain/Loss
          </h2>
        </div>

        <input
          type="text"
          value={flightSearch}
          onChange={(e) => setFlightSearch(e.target.value)}
          placeholder="Search flight, mark, or date..."
          aria-label="Search flight profitability"
          data-testid="flight-profit-search-input"
          className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 w-56"
        />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200 font-mono tabular-nums">
        <div className="p-3 rounded-xl bg-white border border-slate-200">
          <div className="text-[11px] font-sans font-bold text-slate-500">Tracked Flights</div>
          <div className="text-lg font-extrabold text-slate-900 mt-0.5">
            {summary.totalFlights}
          </div>
          <div className="text-[11px] font-sans text-slate-600">
            <span className="text-emerald-700 font-bold">{summary.profitableFlightsCount} Profit</span>{' '}
            ·{' '}
            <span className="text-rose-700 font-bold">{summary.lossMakingFlightsCount} Loss</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200">
          <div className="text-[11px] font-sans font-bold text-slate-500">
            Settlement Export Revenue
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-0.5">
            {formatCurrency(summary.totalSettlementRevenueBdt, 'Tk')}
          </div>
          <div className="text-[11px] text-slate-500">
            ¥{summary.totalExportRmb.toLocaleString('en-US', { minimumFractionDigits: 2 })} RMB
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200">
          <div className="text-[11px] font-sans font-bold text-slate-500">
            RMB FX Variance (Gain / Loss)
          </div>
          <div
            data-testid="flight-total-fx-variance"
            className={`text-lg font-extrabold mt-0.5 flex items-center gap-1 ${
              summary.totalFxGainLossBdt >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {summary.totalFxGainLossBdt >= 0 ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 shrink-0" />
            )}
            <span>
              {summary.totalFxGainLossBdt >= 0 ? '+' : ''}
              {formatCurrency(summary.totalFxGainLossBdt, 'Tk')}
            </span>
          </div>
          <div className="text-[11px] font-sans text-slate-500">
            Booked vs. Settlement Rate Delta
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200">
          <div className="text-[11px] font-sans font-bold text-slate-500">
            Net Flight Margin
          </div>
          <div
            data-testid="flight-total-net-profit"
            className={`text-lg font-extrabold mt-0.5 ${
              summary.totalNetProfitBdt >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(summary.totalNetProfitBdt, 'Tk')}
          </div>
          <div className="text-[11px] font-sans text-slate-600">
            Margin: <strong>{summary.overallMarginPercent.toFixed(2)}%</strong>
          </div>
        </div>
      </div>

      {/* Daily RMB FX Rate Logger */}
      <div className="p-4 border-b border-slate-200 bg-white space-y-3 print:hidden">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
          <ArrowLeftRight className="w-4 h-4 text-[#00897b]" />
          <span>Daily RMB → BDT Exchange Rate History Log</span>
        </div>

        <form
          onSubmit={handleLogFxRate}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
        >
          <div className="sm:col-span-3">
            <label htmlFor="fx-date-input" className="block text-[11px] font-bold text-slate-700 mb-1">
              Rate Date
            </label>
            <input
              id="fx-date-input"
              data-testid="fx-date-input"
              type="date"
              value={fxDate}
              onChange={(e) => setFxDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="fx-rate-input" className="block text-[11px] font-bold text-slate-700 mb-1">
              1 RMB = TK
            </label>
            <input
              id="fx-rate-input"
              data-testid="fx-rate-input"
              type="number"
              step="0.01"
              min="0.01"
              value={fxRateInput}
              onChange={(e) => setFxRateInput(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="fx-source-input" className="block text-[11px] font-bold text-slate-700 mb-1">
              Desk / Bank Reference
            </label>
            <input
              id="fx-source-input"
              data-testid="fx-source-input"
              type="text"
              value={fxSource}
              onChange={(e) => setFxSource(e.target.value)}
              placeholder="e.g. Dhaka Bank / WeChat Settlement"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div className="sm:col-span-2 flex items-center pb-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={applyAsActiveRate}
                onChange={(e) => setApplyAsActiveRate(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Set Active</span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              data-testid="log-fx-rate-btn"
              className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold text-black cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Rate</span>
            </button>
          </div>
        </form>

        {fxHistory.length > 0 && (
          <div
            data-testid="fx-history-list"
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 text-[11px] font-mono tabular-nums text-slate-600"
          >
            <span className="font-sans font-bold text-slate-700">Recent FX Logs:</span>
            {fxHistory.slice(0, 6).map((entry) => (
              <span key={entry.id} className="inline-flex items-center gap-1.5">
                <span>
                  {entry.date}: <strong className="text-slate-900">{entry.rateBdtPerRmb} TK</strong>{' '}
                  ({entry.source || 'Desk'})
                </span>
                <button
                  type="button"
                  aria-label={`Remove FX log for ${entry.date}`}
                  onClick={() => handleDeleteFxEntry(entry.id)}
                  className="p-0.5 text-black cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Per-Flight Profitability Table */}
      <div className="overflow-x-auto">
        {visibleRows.length === 0 ? (
          <div
            data-testid="flight-profitability-empty-state"
            className="p-8 text-center text-xs text-slate-500"
          >
            Log export packing manifests to view automatic Flight-by-Flight Net Profitability and RMB FX variance.
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                <th className="py-2.5 px-4">Date &amp; Flight</th>
                <th className="py-2.5 px-3 text-right">Load (Box / KG)</th>
                <th className="py-2.5 px-3 text-right">Export (RMB)</th>
                <th className="py-2.5 px-3 text-right">Rates (Book → Settle)</th>
                <th className="py-2.5 px-3 text-right">FX Gain/Loss</th>
                <th className="py-2.5 px-3 text-right">Matched Costs (TK)</th>
                <th className="py-2.5 px-4 text-right">Net Profit &amp; Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {visibleRows.map((row) => (
                <tr
                  key={row.flightKey}
                  data-testid={`flight-profit-row-${row.flight}`}
                  className={row.netProfitBdt < 0 ? 'bg-rose-50/40' : 'hover:bg-slate-50'}
                >
                  <td className="py-2.5 px-4 font-sans">
                    <div className="font-extrabold text-slate-900">
                      {row.flight} · {row.destination}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {row.date} · {row.shippingMarks.join(', ') || 'Direct'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700">
                    <div>{row.totalBox} Box</div>
                    <div className="text-[10px] text-slate-500">{row.totalWeightKg.toFixed(1)} KG</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    ¥{row.exportRmb.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600">
                    {row.bookedRmbRate.toFixed(2)} → <strong>{row.settlementRmbRate.toFixed(2)}</strong>
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      row.fxGainLossBdt >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {row.fxGainLossBdt >= 0 ? '+' : ''}
                    {formatCurrency(row.fxGainLossBdt, 'Tk')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700">
                    <div className="font-bold">{formatCurrency(row.totalCostBdt, 'Tk')}</div>
                    <div className="text-[10px] text-slate-500">
                      Pur {Math.round(row.allocatedPurchaseCostBdt).toLocaleString()} · Ops{' '}
                      {Math.round(row.allocatedOperatingCostBdt).toLocaleString()} · Mort{' '}
                      {Math.round(row.allocatedMortalityLossBdt).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div
                      className={`font-extrabold ${
                        row.netProfitBdt >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatCurrency(row.netProfitBdt, 'Tk')}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {row.netMarginPercent.toFixed(1)}% Margin
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
