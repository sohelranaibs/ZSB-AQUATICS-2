import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  MAX_VISIBLE_TABLE_ROWS,
  calculateScrollViewportMaxHeight,
  computeTableScrollSignature,
} from '../utils/tableScroll.ts';

export interface UseRowScrollViewportOptions {
  maxVisibleRows?: number;
  enabled?: boolean;
  includeFooter?: boolean;
  depsKey?: unknown;
}

function measureElementHeight(el: HTMLElement | null): number {
  if (!el) return 0;
  return el.offsetHeight > 0 ? el.offsetHeight : el.getBoundingClientRect().height;
}

/**
 * Dynamically locks a scrollable table container's maxHeight to display `maxVisibleRows` (10)
 * body rows + sticky thead (+ optional sticky tfoot), enabling vertical scroll when rowCount > 10.
 */
export function useRowScrollViewport(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  rowCount: number,
  options: UseRowScrollViewportOptions = {}
): { maxHeight: number | undefined; isCapped: boolean } {
  const {
    maxVisibleRows = MAX_VISIBLE_TABLE_ROWS,
    enabled = true,
    includeFooter = true,
    depsKey,
  } = options;

  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const lastSigRef = useRef<string>('');

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!enabled || !container || rowCount <= maxVisibleRows) {
      lastSigRef.current = '';
      setMaxHeight(undefined);
      return;
    }

    const measure = () => {
      const table = container.querySelector('table');
      if (!table) {
        lastSigRef.current = '';
        setMaxHeight(undefined);
        return;
      }

      const thead = table.tHead as HTMLElement | null;
      const tfoot = includeFooter ? (table.tFoot as HTMLElement | null) : null;
      const tbody = table.tBodies[0];
      const tbodyRows = tbody ? tbody.rows : null;
      const actualRowCount = tbodyRows ? tbodyRows.length : 0;

      if (!tbodyRows || actualRowCount <= maxVisibleRows) {
        lastSigRef.current = '';
        setMaxHeight(undefined);
        return;
      }

      const theadHeight = measureElementHeight(thead);
      const tfootHeight = measureElementHeight(tfoot);
      const sig = computeTableScrollSignature({
        rowCount: actualRowCount,
        containerWidth: container.clientWidth,
        theadHeight,
        tfootHeight,
      });

      if (lastSigRef.current === sig) {
        return;
      }

      const rowHeights: number[] = [];
      for (let i = 0; i < maxVisibleRows; i++) {
        rowHeights.push(measureElementHeight(tbodyRows[i] as HTMLElement));
      }
      rowHeights.push(0);

      const nextHeight = calculateScrollViewportMaxHeight({
        theadHeight,
        tfootHeight,
        rowHeights,
        maxVisibleRows,
      });

      lastSigRef.current = sig;
      setMaxHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    measure();

    let rafId = 0;
    const table = container.querySelector('table');
    if (typeof ResizeObserver !== 'undefined' && table) {
      const observer = new ResizeObserver(() => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          measure();
        });
      });
      observer.observe(table);
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        observer.disconnect();
      };
    }
    return undefined;
  }, [scrollContainerRef, rowCount, maxVisibleRows, enabled, includeFooter, depsKey]);

  return {
    maxHeight,
    isCapped: enabled && rowCount > maxVisibleRows,
  };
}
