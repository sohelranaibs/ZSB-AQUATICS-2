import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  MAX_VISIBLE_TABLE_ROWS,
  calculateScrollViewportMaxHeight,
} from '../utils/tableScroll.ts';

export interface UseRowScrollViewportOptions {
  maxVisibleRows?: number;
  enabled?: boolean;
  includeFooter?: boolean;
  depsKey?: unknown;
}

/**
 * Dynamically locks a scrollable table container's maxHeight to display `maxVisibleRows` (31)
 * body rows + sticky thead (+ optional sticky tfoot), enabling vertical scroll when rowCount > 31.
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

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!enabled || !container || rowCount <= maxVisibleRows) {
      setMaxHeight(undefined);
      return;
    }

    const measure = () => {
      const table = container.querySelector('table');
      if (!table) {
        setMaxHeight(undefined);
        return;
      }

      const thead = table.querySelector('thead');
      const tfoot = includeFooter ? table.querySelector('tfoot') : null;
      const tbodyRows = Array.from(table.querySelectorAll('tbody > tr'));

      if (tbodyRows.length <= maxVisibleRows) {
        setMaxHeight(undefined);
        return;
      }

      const rowHeights = tbodyRows.map((tr) => tr.getBoundingClientRect().height);
      const nextHeight = calculateScrollViewportMaxHeight({
        theadHeight: thead ? thead.getBoundingClientRect().height : 0,
        tfootHeight: tfoot ? tfoot.getBoundingClientRect().height : 0,
        rowHeights,
        maxVisibleRows,
      });

      setMaxHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    measure();

    const table = container.querySelector('table');
    if (typeof ResizeObserver !== 'undefined' && table) {
      const observer = new ResizeObserver(() => {
        measure();
      });
      observer.observe(table);
      return () => observer.disconnect();
    }
    return undefined;
  }, [scrollContainerRef, rowCount, maxVisibleRows, enabled, includeFooter, depsKey]);

  return {
    maxHeight,
    isCapped: enabled && rowCount > maxVisibleRows,
  };
}
