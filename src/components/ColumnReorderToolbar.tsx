import React from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';

interface ColumnReorderToolbarProps {
  tableId: string;
  isCustomized: boolean;
  onReset: () => void;
  compact?: boolean;
  className?: string;
}

export const ColumnReorderToolbar: React.FC<ColumnReorderToolbarProps> = ({
  tableId,
  isCustomized,
  onReset,
  compact = false,
  className = '',
}) => {
  if (compact) {
    return (
      <div
        data-testid={`${tableId}-column-order-bar`}
        className={`inline-flex items-center gap-1.5 print:hidden ${className}`}
      >
        <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 whitespace-nowrap">
          <GripVertical className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
          <span>Drag headers to reorder</span>
        </span>
        {isCustomized && (
          <button
            type="button"
            data-testid={`${tableId}-reset-columns-btn`}
            onClick={onReset}
            title="Restore default column order"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            <span>Reset Columns</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid={`${tableId}-column-order-bar`}
      className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/90 text-[11px] text-slate-600 print:hidden ${className}`}
    >
      <div className="inline-flex items-center gap-1.5 min-w-0">
        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        <span className="font-medium text-slate-600">
          Drag column headers to customize layout
        </span>
        {isCustomized && (
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
            Custom Order Saved
          </span>
        )}
      </div>
      {isCustomized && (
        <button
          type="button"
          data-testid={`${tableId}-reset-columns-btn`}
          onClick={onReset}
          title="Restore default column order"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 transition cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Reset Columns</span>
        </button>
      )}
    </div>
  );
};

export const ColumnDragGrip: React.FC<{ className?: string }> = ({
  className = 'w-3 h-3 opacity-75 shrink-0',
}) => <GripVertical className={className} aria-hidden="true" />;
