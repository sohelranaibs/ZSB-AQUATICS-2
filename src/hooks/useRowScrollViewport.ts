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

      const thead = table.querySelector('thead') as HTMLElement | null;
      const tfoot = includeFooter ? (table.querySelector('tfoot') as HTMLElement | null) : null;
      const tbodyRows = Array.from(table.querySelectorAll('tbody > tr')) as HTMLElement[];

      if (tbodyRows.length <= maxVisibleRows) {
        setMaxHeight(undefined);
        return;
      }

      const rowHeights = tbodyRows.map((tr) => measureElementHeight(tr));
      const nextHeight = calculateScrollViewportMaxHeight({
        theadHeight: measureElementHeight(thead),
        tfootHeight: measureElementHeight(tfoot),
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
