import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ColumnDropSide,
  loadTableColumnOrder,
  saveTableColumnOrder,
  resetTableColumnOrder,
  reorderColumns,
  moveColumnByOffset,
  isCustomColumnOrder,
  sanitizeColumnOrder,
} from '../utils/tableColumnOrder.ts';

const DRAG_MIME_TYPE = 'application/x-zsb-table-column';

export interface TableColumnDragHeaderProps {
  draggable: boolean;
  'data-column-id': string;
  'data-table-id': string;
  'data-dragging': 'true' | 'false';
  'data-drop-side'?: ColumnDropSide;
  onDragStart: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDrop: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTableCellElement>) => void;
  tabIndex: number;
  title: string;
}

export interface UseTableColumnOrderResult<T extends string = string> {
  columnOrder: T[];
  isCustomized: boolean;
  draggingColumnId: T | null;
  dragOverColumnId: T | null;
  dragOverSide: ColumnDropSide | null;
  reorderColumn: (sourceId: T, targetId: T, dropSide?: ColumnDropSide) => void;
  moveColumn: (columnId: T, delta: -1 | 1) => void;
  resetOrder: () => void;
  getHeaderDragProps: (columnId: T, label?: string) => TableColumnDragHeaderProps;
  getHeaderDragClassName: (columnId: T) => string;
}

export function useTableColumnOrder<T extends string>(
  tableId: string,
  defaultOrder: readonly T[]
): UseTableColumnOrderResult<T> {
  const defaultOrderKey = defaultOrder.join('|');
  const stableDefaultOrder = useMemo(
    () => [...defaultOrder] as T[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultOrderKey]
  );

  const [columnOrder, setColumnOrder] = useState<T[]>(() =>
    loadTableColumnOrder(tableId, stableDefaultOrder) as T[]
  );
  const [draggingColumnId, setDraggingColumnId] = useState<T | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<T | null>(null);
  const [dragOverSide, setDragOverSide] = useState<ColumnDropSide | null>(null);

  // Ref keeps the latest dragging column ID available synchronously during dragOver/drop
  const draggingRef = useRef<T | null>(null);

  // Sync if tableId or default columns change (e.g., permission-gated columns)
  useEffect(() => {
    setColumnOrder(loadTableColumnOrder(tableId, stableDefaultOrder) as T[]);
    setDraggingColumnId(null);
    setDragOverColumnId(null);
    setDragOverSide(null);
    draggingRef.current = null;
  }, [tableId, stableDefaultOrder]);

  const sanitizedOrder = useMemo(
    () => sanitizeColumnOrder(columnOrder, stableDefaultOrder) as T[],
    [columnOrder, stableDefaultOrder]
  );

  const isCustomized = useMemo(
    () => isCustomColumnOrder(sanitizedOrder, stableDefaultOrder),
    [sanitizedOrder, stableDefaultOrder]
  );

  const commitOrder = useCallback(
    (updater: (prev: T[]) => T[]) => {
      setColumnOrder((prev) => {
        const base = sanitizeColumnOrder(prev, stableDefaultOrder) as T[];
        const next = updater(base);
        if (next === base) return prev;
        saveTableColumnOrder(tableId, next, stableDefaultOrder);
        return next;
      });
    },
    [tableId, stableDefaultOrder]
  );

  const reorderColumn = useCallback(
    (sourceId: T, targetId: T, dropSide?: ColumnDropSide) => {
      commitOrder(
        (prev) => reorderColumns(prev, sourceId, targetId, dropSide) as T[]
      );
    },
    [commitOrder]
  );

  const moveColumn = useCallback(
    (columnId: T, delta: -1 | 1) => {
      commitOrder((prev) => moveColumnByOffset(prev, columnId, delta) as T[]);
    },
    [commitOrder]
  );

  const resetOrder = useCallback(() => {
    resetTableColumnOrder(tableId);
    setColumnOrder(stableDefaultOrder);
  }, [tableId, stableDefaultOrder]);

  const clearDragState = useCallback(() => {
    draggingRef.current = null;
    setDraggingColumnId(null);
    setDragOverColumnId(null);
    setDragOverSide(null);
  }, []);

  const getHeaderDragProps = useCallback(
    (columnId: T, label?: string): TableColumnDragHeaderProps => {
      const isDragging = draggingColumnId === columnId;
      const isDropTarget =
        dragOverColumnId === columnId && draggingColumnId !== columnId;

      return {
        draggable: true,
        'data-column-id': columnId,
        'data-table-id': tableId,
        'data-dragging': isDragging ? 'true' : 'false',
        ...(isDropTarget && dragOverSide ? { 'data-drop-side': dragOverSide } : {}),
        tabIndex: 0,
        title: label
          ? `${label} — Drag header to reorder column (or press Alt+Left / Alt+Right)`
          : 'Drag header to reorder column (or press Alt+Left / Alt+Right)',
        onDragStart: (e) => {
          // Do not hijack drag if user is interacting with a nested input/select
          const targetEl = e.target as HTMLElement | null;
          if (targetEl && targetEl.closest('input, select, textarea')) {
            e.preventDefault();
            return;
          }
          draggingRef.current = columnId;
          setDraggingColumnId(columnId);
          try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(
              DRAG_MIME_TYPE,
              JSON.stringify({ tableId, columnId })
            );
            e.dataTransfer.setData('text/plain', columnId);
          } catch {
            // Synthetic drag events in some headless environments may restrict setData
          }
        },
        onDragOver: (e) => {
          const activeSource = draggingRef.current;
          if (!activeSource || activeSource === columnId) {
            if (activeSource === columnId) {
              setDragOverColumnId(null);
              setDragOverSide(null);
            }
            return;
          }
          e.preventDefault();
          try {
            e.dataTransfer.dropEffect = 'move';
          } catch {
            // Ignore in synthetic events
          }
          const rect = e.currentTarget.getBoundingClientRect();
          const midpoint = rect.left + rect.width / 2;
          const side: ColumnDropSide = e.clientX < midpoint ? 'before' : 'after';
          setDragOverColumnId(columnId);
          setDragOverSide(side);
        },
        onDragLeave: (e) => {
          const related = e.relatedTarget as Node | null;
          if (related && e.currentTarget.contains(related)) {
            return;
          }
          setDragOverColumnId((prev) => (prev === columnId ? null : prev));
          setDragOverSide((prev) => (dragOverColumnId === columnId ? null : prev));
        },
        onDrop: (e) => {
          e.preventDefault();
          let sourceId: T | null = draggingRef.current;

          if (!sourceId) {
            try {
              const rawPayload = e.dataTransfer.getData(DRAG_MIME_TYPE);
              if (rawPayload) {
                const parsed = JSON.parse(rawPayload) as {
                  tableId?: string;
                  columnId?: T;
                };
                if (parsed.tableId === tableId && parsed.columnId) {
                  sourceId = parsed.columnId;
                }
              }
            } catch {
              // Fallback below
            }
          }

          if (!sourceId) {
            try {
              const fallbackText = e.dataTransfer.getData('text/plain') as T;
              if (fallbackText && stableDefaultOrder.includes(fallbackText)) {
                sourceId = fallbackText;
              }
            } catch {
              // Ignore
            }
          }

          if (sourceId && sourceId !== columnId) {
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            // For synthetic drop events with clientX === 0, infer natural direction
            const side: ColumnDropSide | undefined =
              e.clientX > 0
                ? e.clientX < midpoint
                  ? 'before'
                  : 'after'
                : undefined;
            reorderColumn(sourceId, columnId, side);
          }

          clearDragState();
        },
        onDragEnd: clearDragState,
        onKeyDown: (e) => {
          if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            moveColumn(columnId, -1);
          } else if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            moveColumn(columnId, 1);
          }
        },
      };
    },
    [
      tableId,
      draggingColumnId,
      dragOverColumnId,
      dragOverSide,
      stableDefaultOrder,
      reorderColumn,
      moveColumn,
      clearDragState,
    ]
  );

  const getHeaderDragClassName = useCallback(
    (columnId: T): string => {
      const classes = [
        'cursor-grab active:cursor-grabbing select-none transition-shadow duration-150',
      ];
      if (draggingColumnId === columnId) {
        classes.push('opacity-45 ring-1 ring-inset ring-amber-300');
      } else if (dragOverColumnId === columnId && draggingColumnId !== null) {
        if (dragOverSide === 'before') {
          classes.push('shadow-[inset_3px_0_0_0_#f59e0b] bg-sky-900/40');
        } else {
          classes.push('shadow-[inset_-3px_0_0_0_#f59e0b] bg-sky-900/40');
        }
      }
      return classes.join(' ');
    },
    [draggingColumnId, dragOverColumnId, dragOverSide]
  );

  return {
    columnOrder: sanitizedOrder,
    isCustomized,
    draggingColumnId,
    dragOverColumnId,
    dragOverSide,
    reorderColumn,
    moveColumn,
    resetOrder,
    getHeaderDragProps,
    getHeaderDragClassName,
  };
}
