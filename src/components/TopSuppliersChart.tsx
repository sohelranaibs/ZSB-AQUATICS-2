import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  getTopSuppliersByVolume,
  TopSupplierStat,
  formatCurrency,
  getCurrentYearMonth,
  formatYearMonthLabel,
} from '../utils/calculations.ts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Users, Award, Plus, ArrowUpRight } from 'lucide-react';

const BAR_COLORS = ['#0284c7', '#0d9488', '#d97706', '#4f46e5', '#475569'];

export const TopSuppliersChart: React.FC = () => {
  const { purchases, dropdownOptions, companyProfile, setActiveTab } = useApp();

  const currentYearMonth = useMemo(() => getCurrentYearMonth(), []);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'volume_only' | 'volume_and_value'>('volume_only');

  // Available months from purchase records + current month
  const availableMonths = useMemo(() => {
    const set = new Set<string>([currentYearMonth]);
    for (const p of purchases) {
      if (p.date && p.date.length >= 7) {
        set.add(p.date.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [purchases, currentYearMonth]);

  // Ranked top 5 suppliers from actual purchase records
  const rankedSuppliers = useMemo(() => {
    return getTopSuppliersByVolume(purchases, 5, selectedPeriod);
  }, [purchases, selectedPeriod]);

  // Ensure 5 supplier slots are always represented on the chart axis (padding with master supplier list when < 5 records exist)
  const chartData: TopSupplierStat[] = useMemo(() => {
    const list = [...rankedSuppliers];
    const existingNames = new Set(list.map((s) => s.supplierName.toLowerCase()));

    for (const candidate of dropdownOptions.suppliers) {
      if (list.length >= 5) break;
      const clean = (candidate || '').trim();
      if (!clean || existingNames.has(clean.toLowerCase())) continue;
      existingNames.add(clean.toLowerCase());
      list.push({
        rank: list.length + 1,
        supplierName: clean,
        shortName: clean.length > 16 ? `${clean.slice(0, 14).trim()}…` : clean,
        totalVolume: 0,
        totalAmount: 0,
        invoiceCount: 0,
        avgRatePerUnit: 0,
        volumeSharePercent: 0,
        latestDate: '',
      });
    }

    return list.slice(0, 5);
  }, [rankedSuppliers, dropdownOptions.suppliers]);

  const top5TotalVolume = useMemo(
    () => rankedSuppliers.reduce((acc, s) => acc + s.totalVolume, 0),
    [rankedSuppliers]
  );
  const top5TotalValue = useMemo(
    () => rankedSuppliers.reduce((acc, s) => acc + s.totalAmount, 0),
    [rankedSuppliers]
  );
  const top5InvoiceCount = useMemo(
    () => rankedSuppliers.reduce((acc, s) => acc + s.invoiceCount, 0),
    [rankedSuppliers]
  );

  const leadSupplier = rankedSuppliers[0];

  return (
    <section
      aria-label="Top 5 Suppliers by Purchase Volume"
      data-testid="top-suppliers-summary"
      className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden"
    >
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-5 py-3.5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Users className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="text-sm font-bold tracking-wide text-white">
            Top 5 Suppliers by Purchase Volume
          </h2>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-300 font-mono tabular-nums">
            {selectedPeriod === 'all' ? 'All-Time Procurement' : formatYearMonthLabel(selectedPeriod)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Display Mode Toggle */}
          <div
            role="group"
            aria-label="Supplier Chart Mode"
            className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700"
          >
            <button
              type="button"
              data-testid="top-suppliers-mode-volume"
              onClick={() => setDisplayMode('volume_only')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                displayMode === 'volume_only'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Volume (KG)
            </button>
            <button
              type="button"
              data-testid="top-suppliers-mode-dual"
              onClick={() => setDisplayMode('volume_and_value')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                displayMode === 'volume_and_value'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Volume &amp; Value ({companyProfile.currency})
            </button>
          </div>

          {/* Period Filter Select */}
          <select
            aria-label="Filter Top Suppliers Period"
            data-testid="top-suppliers-period-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer font-mono"
          >
            <option value="all">Period: All Time</option>
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>
                {formatYearMonthLabel(ym)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setActiveTab('purchase_form')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bill</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/80 border-b border-slate-200">
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500">Top 5 Combined Volume</div>
          <div
            data-testid="top-suppliers-total-volume"
            className="text-sm sm:text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5"
          >
            {top5TotalVolume.toLocaleString()} KG
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500">Top 5 Procurement Value</div>
          <div
            data-testid="top-suppliers-total-value"
            className="text-sm sm:text-base font-bold text-sky-800 font-mono tabular-nums mt-0.5"
          >
            {formatCurrency(top5TotalValue, companyProfile.currency)}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500">Leading Supplier (#1)</div>
          <div
            data-testid="top-suppliers-leader"
            className="text-sm sm:text-base font-bold text-teal-800 font-mono tabular-nums mt-0.5 truncate"
          >
            {leadSupplier
              ? `${leadSupplier.supplierName} (${leadSupplier.totalVolume.toLocaleString()} KG)`
              : 'No bills recorded'}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500">Active Top Suppliers</div>
          <div className="text-sm sm:text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {rankedSuppliers.length} / 5 ({top5InvoiceCount} Bills)
          </div>
        </div>
      </div>

      {/* Main Content Split: Recharts BarChart (7 Cols) + Top 5 Ranked Breakdown Table (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left: Recharts Bar Chart */}
        <div className="lg:col-span-7 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Supplier Volume Comparison (KG)
              </h3>
              <p className="text-[11px] text-slate-500">
                Ranked descending by total live fish &amp; seafood weight supplied
              </p>
            </div>
            {rankedSuppliers.length === 0 && (
              <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                Awaiting purchase bills — showing registered suppliers
              </span>
            )}
          </div>

          <div className="w-full h-[270px]" data-testid="top-suppliers-barchart">
            <ResponsiveContainer width="100%" height={270}>
              {displayMode === 'volume_only' ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                  barSize={42}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(val: number) =>
                      val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`
                    }
                    tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: any, name: any, props: any) => {
                      const payload: TopSupplierStat | undefined = props?.payload;
                      const formattedVol = `${Number(value || 0).toLocaleString()} KG`;
                      if (payload && payload.totalAmount > 0) {
                        return [
                          `${formattedVol} (${formatCurrency(payload.totalAmount, companyProfile.currency)})`,
                          String(name),
                        ];
                      }
                      return [formattedVol, String(name)];
                    }}
                    labelFormatter={(_label: any, payload: any) => {
                      const item = payload?.[0]?.payload as TopSupplierStat | undefined;
                      return item
                        ? `#${item.rank} ${item.supplierName} (${item.invoiceCount} Bills)`
                        : String(_label);
                    }}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                    labelStyle={{ color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                  />
                  <Bar
                    dataKey="totalVolume"
                    name="Total Purchase Volume (KG)"
                    fill="#0284c7"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.supplierName}-${index}`}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(val: number) => `${val}kg`}
                    tick={{ fill: '#0284c7', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#93c5fd' }}
                    tickLine={false}
                    width={54}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(val: number) =>
                      val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)
                    }
                    tick={{ fill: '#0d9488', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#5eead4' }}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const label = String(name);
                      if (label.includes(companyProfile.currency)) {
                        return [formatCurrency(Number(value) || 0, companyProfile.currency), label];
                      }
                      return [`${Number(value || 0).toLocaleString()} KG`, label];
                    }}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                    labelStyle={{ color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="totalVolume"
                    name="Total Purchase Volume (KG)"
                    fill="#0284c7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="totalAmount"
                    name={`Total Purchase Value (${companyProfile.currency})`}
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Top 5 Supplier Leaderboard Table */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50/40">
          <div>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Supplier Volume Leaderboard
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Top 5 Ranked</span>
            </div>

            <div className="divide-y divide-slate-200/80 text-xs">
              {chartData.map((sup, idx) => {
                const isRecorded = sup.totalVolume > 0;
                return (
                  <div
                    key={`${sup.supplierName}-${idx}`}
                    data-testid={`top-supplier-row-${idx + 1}`}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-md font-mono font-bold text-[11px] flex items-center justify-center text-white shrink-0 ${
                          idx === 0
                            ? 'bg-sky-600'
                            : idx === 1
                            ? 'bg-teal-600'
                            : idx === 2
                            ? 'bg-amber-600'
                            : idx === 3
                            ? 'bg-indigo-600'
                            : 'bg-slate-600'
                        }`}
                      >
                        0{sup.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {sup.supplierName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {isRecorded
                            ? `${sup.invoiceCount} Bill(s) · Avg ${formatCurrency(
                                sup.avgRatePerUnit,
                                companyProfile.currency
                              )}/KG`
                            : '0 Bills recorded'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div className="font-bold text-slate-900 text-xs">
                        {sup.totalVolume.toLocaleString()} KG
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isRecorded
                          ? `${sup.volumeSharePercent}% · ${formatCurrency(
                              sup.totalAmount,
                              companyProfile.currency
                            )}`
                          : formatCurrency(0, companyProfile.currency)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Full supplier history in Purchase DB</span>
            <button
              type="button"
              onClick={() => setActiveTab('purchase_db')}
              className="text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Open Purchase DB</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
