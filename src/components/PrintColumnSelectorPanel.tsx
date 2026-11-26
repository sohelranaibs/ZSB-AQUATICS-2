import React from 'react';
import { Columns3, Eye, Sparkles } from 'lucide-react';
import { PrintColumnDescriptor } from '../utils/printColumnConfig.ts';

interface PrintColumnSelectorPanelProps {
  columns: PrintColumnDescriptor[];
  hiddenColumnIds: string[];
  onToggleColumn: (columnId: string) => void;
  onApplyCleanA4Preset: () => void;
  onShowAllColumns: () => void;
}

export const PrintColumnSelectorPanel: React.FC<PrintColumnSelectorPanelProps> = ({
  columns,
  hiddenColumnIds,
  onToggleColumn,
  onApplyCleanA4Preset,
  onShowAllColumns,
}) => {
  const hiddenSet = new Set(hiddenColumnIds);
  const totalCount = columns.length;
  const visibleCount = columns.filter((c) => !hiddenSet.has(c.id)).length;
  const hiddenCount = totalCount - visibleCount;

  const hasHideableMetadataOrDebug = columns.some(
    (c) =>
      (c.category === 'debug' || c.category === 'metadata') &&
      !hiddenSet.has(c.id)
  );

  // Group columns by tableKey while preserving natural document order
  const groups: Array<{
    tableKey: string;
    tableTitle: string;
    cols: PrintColumnDescriptor[];
  }> = [];
  const groupIndexByKey = new Map<string, number>();

  for (const col of columns) {
    const existingIdx = groupIndexByKey.get(col.tableKey);
    if (existingIdx !== undefined) {
      groups[existingIdx].cols.push(col);
    } else {
      groupIndexByKey.set(col.tableKey, groups.length);
      groups.push({
        tableKey: col.tableKey,
        tableTitle: col.tableTitle,
        cols: [col],
      });
    }
  }

  return (
    <div
      data-testid="print-columns-panel"
      className="bg-[#1E3247] text-white px-5 py-3.5 border-b border-white/15 print:hidden space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-200">
          <Columns3 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>A4 PDF &amp; Print Column Visibility</span>
          <span
            data-testid="print-columns-summary-count"
            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#152536] border border-white/15 text-sky-200 normal-case"
          >
            {visibleCount} / {totalCount} visible
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="print-cols-clean-a4-btn"
            disabled={!hasHideableMetadataOrDebug}
            onClick={onApplyCleanA4Preset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-[#273E56] hover:bg-[#334b59] text-slate-100 border border-white/15 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Automatically hide debug and auxiliary metadata columns for a clean A4 layout"
          >
            <Sparkles className="w-3 h-3" />
            <span>Hide Metadata</span>
          </button>

          <button
            type="button"
            data-testid="print-cols-show-all-btn"
            disabled={hiddenCount === 0}
            onClick={onShowAllColumns}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-[#273E56] hover:bg-[#334b59] text-slate-100 border border-white/15 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Show all columns in the A4 export"
          >
            <Eye className="w-3 h-3" />
            <span>Show All</span>
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {groups.map((group) => {
          const groupVisibleCount = group.cols.filter(
            (c) => !hiddenSet.has(c.id)
          ).length;

          return (
            <div
              key={group.tableKey}
              className="bg-[#152536] border border-white/12 rounded-lg p-3 space-y-2"
            >
              {groups.length > 1 && (
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                    {group.tableTitle}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {groupVisibleCount} / {group.cols.length} shown
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {group.cols.map((col) => {
                  const isVisible = !hiddenSet.has(col.id);
                  const isLastVisible = isVisible && groupVisibleCount <= 1;

                  return (
                    <label
                      key={col.id}
                      title={
                        isLastVisible
                          ? 'At least one column must remain visible in this table'
                          : isVisible
                          ? `Hide "${col.label}" from PDF & print export`
                          : `Show "${col.label}" in PDF & print export`
                      }
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium select-none transition ${
                        isVisible
                          ? 'bg-[#21374d] border-sky-400/45 text-white'
                          : 'bg-[#0f1c29] border-white/10 text-slate-400 line-through'
                      } ${
                        isLastVisible
                          ? 'opacity-70 cursor-not-allowed'
                          : 'cursor-pointer hover:border-sky-300/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        data-testid={`print-col-checkbox-${col.colKey}`}
                        data-print-col-id={col.id}
                        checked={isVisible}
                        disabled={isLastVisible}
                        onChange={() => onToggleColumn(col.id)}
                        className="w-3.5 h-3.5 rounded accent-[#00897b] cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="leading-tight">{col.label}</span>
                      {col.category === 'debug' && (
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-400/40 text-rose-200 no-underline">
                          Debug
                        </span>
                      )}
                      {col.category === 'metadata' && (
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-300/35 text-amber-200 no-underline">
                          Meta
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-300">
        Unchecked columns are omitted from the live preview, A4 PDF download, PNG export, and browser printout while totals and column widths automatically rebalance to fit A4 cleanly.
      </p>
    </div>
  );
};
