import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calculateProfitLoss, formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  DollarSign,
  Package,
  ShoppingCart,
  Receipt,
  Scale,
} from 'lucide-react';

export const ProfitLossView: React.FC = () => {
  const {
    companyProfile,
    purchases,
    packings,
    payments,
    otherCosts,
    addOtherCost,
    deleteOtherCost,
    dropdownOptions,
    openPrintModal,
  } = useApp();

  const [newCategory, setNewCategory] = useState<string>(dropdownOptions.costingCategories[0] || 'Air Freight & Cargo');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newRef, setNewRef] = useState<string>('');

  const summary = calculateProfitLoss(
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile.rmbExchangeRate
  );

  const handleAddCost = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!amt || amt <= 0) return;

    addOtherCost({
      date: new Date().toISOString().slice(0, 10),
      category: newCategory,
      amount: amt,
      description: newDesc.trim() || newCategory,
      refInvoice: newRef.trim() || undefined,
    });

    setNewAmount('');
    setNewDesc('');
    setNewRef('');
  };

  const handlePrintProfitLoss = () => {
    openPrintModal({
      type: 'profit_loss',
      title: 'Loss & Profit Financial Statement',
      data: {
        summary,
        purchases,
        packings,
        payments,
        otherCosts,
      },
    });
  };

  const isProfitable = summary.netProfit >= 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1b2b44] text-white px-5 py-3 rounded-lg shadow-md flex items-center justify-between border-b-2 border-amber-500">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-xl sm:text-2xl font-black tracking-wider text-amber-400 font-serif uppercase">
              {companyProfile.companyName}
            </span>
            <span className="text-lg text-slate-300">|</span>
            <span className="text-sm sm:text-base font-semibold text-slate-100 uppercase tracking-wide">
              Loss &amp; Profit Statement &amp; Other Costing
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Auto-consolidated from Total Purchasing, Export Revenues &amp; Other Costing
          </p>
        </div>

        <button
          onClick={handlePrintProfitLoss}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow transition"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print P&amp;L Statement</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Purchasing */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Total Purchasing Cost</span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-700 font-mono mt-2">
            {formatCurrency(summary.totalPurchasing, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">From {purchases.length} Purchase Invoices</div>
        </div>

        {/* Total Export Revenue */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Total Export Value</span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-teal-700 font-mono mt-2">
            {formatCurrency(summary.totalExportValue, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total {summary.totalWeightExported} KG live export
          </div>
        </div>

        {/* Total Other Costing */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Other Operating Costs</span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 font-mono mt-2">
            {formatCurrency(summary.totalOtherCosting, companyProfile.currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Freight, packing, customs &amp; labor
          </div>
        </div>

        {/* Net Profit / Loss */}
        <div
          className={`rounded-xl shadow border p-4 ${
            isProfitable
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-rose-50/70 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span className={isProfitable ? 'text-emerald-800' : 'text-rose-800'}>
              Net {isProfitable ? 'Profit' : 'Loss'}
            </span>
            {isProfitable ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div
            className={`text-2xl font-black font-mono mt-2 ${
              isProfitable ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(summary.netProfit, companyProfile.currency)}
          </div>
          <div
            className={`text-[11px] font-bold mt-1 ${
              isProfitable ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            Margin: {summary.marginPercent}%
          </div>
        </div>
      </div>

      {/* Grid: Financial Statement & Add Other Costing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Financial Statement Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="bg-[#1b2b44] text-white px-5 py-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
            <span>FINANCIAL SUMMARY LEDGER</span>
            <Scale className="w-4 h-4 text-amber-400" />
          </div>

          <div className="p-4">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-slate-50/80">
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    Gross Export Cargo Revenue (A)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800">
                    {formatCurrency(summary.totalExportValue, companyProfile.currency)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    Less: Live Fish Purchasing Cost (B)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                    - {formatCurrency(summary.totalPurchasing, companyProfile.currency)}
                  </td>
                </tr>
                <tr className="bg-amber-50/60 font-bold border-y-2 border-amber-300">
                  <td className="py-2.5 px-3 text-slate-900 uppercase">
                    GROSS MARGIN (A - B)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                    {formatCurrency(summary.grossProfit, companyProfile.currency)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    Less: Total Other Costing (C)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                    - {formatCurrency(summary.totalOtherCosting, companyProfile.currency)}
                  </td>
                </tr>
                <tr
                  className={`font-black text-sm border-t-2 ${
                    isProfitable ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-rose-100 text-rose-950 border-rose-400'
                  }`}
                >
                  <td className="py-3 px-3 uppercase">
                    NET {isProfitable ? 'PROFIT' : 'LOSS'} (A - B - C)
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatCurrency(summary.netProfit, companyProfile.currency)}
                  </td>
                </tr>
                <tr className="bg-slate-50 text-slate-600 text-[11px]">
                  <td className="py-2 px-3">
                    Total RMB Return Collected on Export Goods
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-purple-800">
                    ¥ {summary.totalReturnRMB.toLocaleString()} (≈ {formatCurrency(summary.totalReturnRMBInBDT, companyProfile.currency)})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Add Other Costing Form & List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Add Cost Form */}
          <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>ADD OTHER COSTING (EXPENSE)</span>
            </div>

            <form onSubmit={handleAddCost} className="space-y-2.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Expense Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800"
                >
                  {dropdownOptions.costingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Amount ({companyProfile.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Ref Invoice / Doc</label>
                  <input
                    type="text"
                    placeholder="e.g. PKG-2026-0001"
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Particulars</label>
                <input
                  type="text"
                  placeholder="Details of expense..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1b73b4] hover:bg-[#165f95] text-white py-2 rounded font-bold text-xs uppercase shadow transition flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Save Other Costing</span>
              </button>
            </form>
          </div>

          {/* List of Recent Other Costing Records */}
          <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
              <span>RECORDED EXPENSES ({otherCosts.length})</span>
              <span className="font-mono text-amber-700">
                {formatCurrency(summary.totalOtherCosting, companyProfile.currency)}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
              {otherCosts.length === 0 ? (
                <div className="p-4 text-center text-slate-400">No other costing recorded yet.</div>
              ) : (
                otherCosts.map((cost) => (
                  <div key={cost.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-800">{cost.category}</div>
                      <div className="text-[11px] text-slate-500">{cost.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatDate(cost.date)} {cost.refInvoice ? `• Ref: ${cost.refInvoice}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(cost.amount, companyProfile.currency)}
                      </span>
                      <button
                        onClick={() => deleteOtherCost(cost.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
