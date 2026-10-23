import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  Search,
  Calendar,
  Filter,
  Printer,
  FileText,
  RotateCcw,
  Package,
  ShoppingCart,
  CreditCard,
  Building2,
} from 'lucide-react';

export const SearchReportsView: React.FC = () => {
  const {
    companyProfile,
    purchases,
    packings,
    payments,
    dropdownOptions,
    openPrintModal,
  } = useApp();

  // Filter States
  const [shipperFilter, setShipperFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [shippingMarkFilter, setShippingMarkFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statementMonth, setStatementMonth] = useState<string>(
    () => new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  const handleResetFilters = () => {
    setShipperFilter('ALL');
    setSupplierFilter('ALL');
    setShippingMarkFilter('ALL');
    setFromDate('');
    setToDate('');
  };

  // Filter matching
  const dateInRange = (dateStr: string) => {
    if (!fromDate && !toDate) return true;
    const target = new Date(dateStr).getTime();
    if (fromDate && new Date(fromDate).getTime() > target) return false;
    if (toDate && new Date(toDate).getTime() < target) return false;
    return true;
  };

  // Filter Purchases
  const filteredPurchases = purchases.filter((p) => {
    if (supplierFilter !== 'ALL' && p.description !== supplierFilter) return false;
    if (!dateInRange(p.date)) return false;
    return true;
  });

  // Filter Packings
  const filteredPackings = packings.filter((pkg) => {
    if (shipperFilter !== 'ALL' && pkg.shipper !== shipperFilter) return false;
    if (shippingMarkFilter !== 'ALL' && pkg.shippingMark !== shippingMarkFilter) return false;
    if (!dateInRange(pkg.packingDate)) return false;
    return true;
  });

  // Filter Payments
  const filteredPayments = payments.filter((pm) => {
    if (supplierFilter !== 'ALL' && pm.description !== supplierFilter) return false;
    if (!dateInRange(pm.date)) return false;
    return true;
  });

  // Totals of filtered results
  const totalFilteredPurchase = filteredPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalFilteredExport = filteredPackings.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalFilteredWeight = filteredPackings.reduce((acc, p) => acc + p.totalWeight, 0);
  const totalFilteredPayment = filteredPayments.reduce((acc, p) => acc + p.paidAmount, 0);

  const handleGenerateMonthlyStatement = () => {
    // Collect records matching statement month (YYYY-MM)
    const monthPurchases = purchases.filter((p) => p.date.startsWith(statementMonth));
    const monthPackings = packings.filter((p) => p.packingDate.startsWith(statementMonth));
    const monthPayments = payments.filter((p) => p.date.startsWith(statementMonth));

    openPrintModal({
      type: 'monthly_statement',
      title: `Monthly Business & Export Statement - ${statementMonth}`,
      data: {
        statementMonth,
        purchases: monthPurchases,
        packings: monthPackings,
        payments: monthPayments,
        totalPurchases: monthPurchases.reduce((a, b) => a + b.totalAmount, 0),
        totalExport: monthPackings.reduce((a, b) => a + b.totalAmount, 0),
        totalWeight: monthPackings.reduce((a, b) => a + b.totalWeight, 0),
        totalPayments: monthPayments.reduce((a, b) => a + b.paidAmount, 0),
      },
    });
  };

  const handlePrintFilteredReport = () => {
    openPrintModal({
      type: 'batch_print',
      title: `Consolidated Filtered Report (${fromDate || 'Start'} to ${toDate || 'End'})`,
      data: {
        dbType: 'filtered_multi',
        records: [
          ...filteredPurchases.map((p) => ({ ...p, _kind: 'Purchase' })),
          ...filteredPackings.map((p) => ({ ...p, _kind: 'Packing' })),
          ...filteredPayments.map((p) => ({ ...p, _kind: 'Payment' })),
        ],
        filters: {
          shipper: shipperFilter,
          supplier: supplierFilter,
          shippingMark: shippingMarkFilter,
          fromDate,
          toDate,
        },
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1b2b44] text-white px-5 py-3 rounded-lg shadow-md flex flex-wrap items-center justify-between gap-4 border-b-2 border-amber-500">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-xl sm:text-2xl font-black tracking-wider text-amber-400 font-serif uppercase">
              {companyProfile.companyName}
            </span>
            <span className="text-lg text-slate-300">|</span>
            <span className="text-sm sm:text-base font-semibold text-slate-100 uppercase tracking-wide">
              Advanced Multi-Field Search &amp; Monthly Statement
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Query transactions by Shipper, Supplier Name, Shipping Mark &amp; Date Range
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrintFilteredReport}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded shadow transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Filtered Report</span>
          </button>
        </div>
      </div>

      {/* Main Filter Control Box */}
      <div className="bg-white p-5 rounded-xl shadow border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>SEARCH PARAMETERS</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-500 hover:text-rose-600 flex items-center space-x-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* Shipper */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">SHIPPER</label>
            <select
              value={shipperFilter}
              onChange={(e) => setShipperFilter(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-semibold"
            >
              <option value="ALL">All Shippers</option>
              {dropdownOptions.shippers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Name */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">SUPPLIER NAME</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-semibold"
            >
              <option value="ALL">All Suppliers</option>
              {dropdownOptions.suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Shipping Mark */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">SHIPPING MARK</label>
            <select
              value={shippingMarkFilter}
              onChange={(e) => setShippingMarkFilter(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-bold"
            >
              <option value="ALL">All Shipping Marks</option>
              {dropdownOptions.shippingMarks.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">FROM DATE</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-medium"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">TO DATE</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-medium"
            />
          </div>
        </div>

        {/* Monthly Statement Bar */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-purple-50/60 p-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-purple-700" />
            <span className="text-xs font-bold text-purple-950 uppercase">
              GENERATE MONTHLY STATEMENT:
            </span>
            <input
              type="month"
              value={statementMonth}
              onChange={(e) => setStatementMonth(e.target.value)}
              className="border border-purple-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-purple-900 bg-white"
            />
          </div>

          <button
            onClick={handleGenerateMonthlyStatement}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#6d28d9] hover:bg-[#5b21b6] text-white rounded text-xs font-bold uppercase shadow transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Monthly Statement (PDF)</span>
          </button>
        </div>
      </div>

      {/* Filtered Rollup Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Filtered Purchases</div>
          <div className="text-lg font-black text-blue-700 font-mono mt-1">
            {formatCurrency(totalFilteredPurchase, companyProfile.currency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{filteredPurchases.length} Invoices</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Filtered Export Cargo</div>
          <div className="text-lg font-black text-teal-700 font-mono mt-1">
            {formatCurrency(totalFilteredExport, companyProfile.currency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{filteredPackings.length} Manifests</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Filtered Total Weight</div>
          <div className="text-lg font-black text-amber-600 font-mono mt-1">
            {totalFilteredWeight} KG
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Live Eel Fish Weight</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Filtered Payments</div>
          <div className="text-lg font-black text-purple-700 font-mono mt-1">
            {formatCurrency(totalFilteredPayment, companyProfile.currency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{filteredPayments.length} Vouchers</div>
        </div>
      </div>

      {/* Unified Search Results List */}
      <div className="space-y-4">
        {/* Packings Found */}
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#12776c] text-white font-bold text-xs uppercase flex items-center justify-between">
            <span>PACKING LISTS MATCHING SEARCH ({filteredPackings.length})</span>
            <Package className="w-4 h-4 text-teal-200" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b">
                <tr>
                  <th className="p-2.5">DOC NO</th>
                  <th className="p-2.5">MARK</th>
                  <th className="p-2.5">FLIGHT</th>
                  <th className="p-2.5">DESTINATION</th>
                  <th className="p-2.5">SHIPPER</th>
                  <th className="p-2.5">DATE</th>
                  <th className="p-2.5 text-right">WEIGHT</th>
                  <th className="p-2.5 text-right">VALUE</th>
                  <th className="p-2.5 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPackings.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-teal-900">{pkg.invoiceNumber}</td>
                    <td className="p-2.5 font-black text-blue-900">{pkg.shippingMark}</td>
                    <td className="p-2.5 font-mono text-slate-700">{pkg.flight}</td>
                    <td className="p-2.5 font-semibold text-slate-800">{pkg.destination}</td>
                    <td className="p-2.5 text-slate-700">{pkg.shipper}</td>
                    <td className="p-2.5 font-mono text-slate-500">{formatDate(pkg.packingDate)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-teal-800">{pkg.totalWeight} KG</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(pkg.totalAmount, companyProfile.currency)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() =>
                          openPrintModal({
                            type: 'packing',
                            title: `Packing List - ${pkg.invoiceNumber}`,
                            data: pkg,
                            items: pkg.items,
                          })
                        }
                        className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded hover:bg-teal-200"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purchases Found */}
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#1b73b4] text-white font-bold text-xs uppercase flex items-center justify-between">
            <span>PURCHASE INVOICES MATCHING SEARCH ({filteredPurchases.length})</span>
            <ShoppingCart className="w-4 h-4 text-blue-200" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b">
                <tr>
                  <th className="p-2.5">INVOICE NO</th>
                  <th className="p-2.5">SUPPLIER</th>
                  <th className="p-2.5">DATE</th>
                  <th className="p-2.5 text-right">TOTAL QTY</th>
                  <th className="p-2.5 text-right">TOTAL AMOUNT</th>
                  <th className="p-2.5 text-right">BALANCE</th>
                  <th className="p-2.5 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-blue-900">{p.invoiceNumber}</td>
                    <td className="p-2.5 font-bold text-slate-800">{p.description}</td>
                    <td className="p-2.5 font-mono text-slate-500">{formatDate(p.date)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-700">{p.totalQty}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(p.totalAmount, companyProfile.currency)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                      {formatCurrency(p.balance, companyProfile.currency)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() =>
                          openPrintModal({
                            type: 'purchase',
                            title: `Purchase Challan - ${p.invoiceNumber}`,
                            data: p,
                            items: p.items,
                          })
                        }
                        className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
