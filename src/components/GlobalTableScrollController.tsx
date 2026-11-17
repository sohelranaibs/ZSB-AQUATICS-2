import React, { useEffect } from 'react';
import {
  MAX_VISIBLE_TABLE_ROWS,
  EXCLUDED_TABLE_CONTAINER_SELECTOR,
  calculateScrollViewportMaxHeight,
  computeTableScrollSignature,
  isOpaqueCssColor,
  resolveStickySectionBackground,
} from '../utils/tableScroll.ts';

function measureLocalHeight(el: HTMLElement | null): number {
  if (!el) return 0;
  return el.offsetHeight > 0 ? el.offsetHeight : el.getBoundingClientRect().height;
}

function ensureStickySectionOpacity(
  section: HTMLElement | null,
  edge: 'top' | 'bottom',
  fallbackBg: string
): void {
  if (!section) return;
  const rows = Array.from(section.querySelectorAll('tr')) as HTMLElement[];
  const stickySig = `${edge}:${rows.length}`;
  if (section.getAttribute('data-sticky-sig') === stickySig) {
    return;
  }

  const computedSection = window.getComputedStyle(section);
  if (computedSection.position !== 'sticky') {
    section.style.position = 'sticky';
  }
  if (edge === 'top') {
    section.style.top = '0px';
  } else {
    section.style.bottom = '0px';
  }
  if (!computedSection.zIndex || computedSection.zIndex === 'auto') {
    section.style.zIndex = '10';
  }

  for (const row of rows) {
    const rowBg = window.getComputedStyle(row).backgroundColor;
    const resolvedSectionBg = resolveStickySectionBackground(
      [rowBg, computedSection.backgroundColor],
      fallbackBg
    );
    const cells = Array.from(row.querySelectorAll('th, td')) as HTMLElement[];
    for (const cell of cells) {
      const cellBg = window.getComputedStyle(cell).backgroundColor;
      if (!isOpaqueCssColor(cellBg)) {
        cell.style.backgroundColor = resolvedSectionBg;
      }
    }
  }
  section.setAttribute('data-sticky-sig', stickySig);
}

function clearScrollCap(container: HTMLElement): void {
  if (container.getAttribute('data-ten-row-scroll') === 'active') {
    container.style.removeProperty('max-height');
    container.style.removeProperty('overflow-y');
    container.removeAttribute('data-ten-row-scroll');
    container.removeAttribute('data-visible-row-limit');
  }
  container.removeAttribute('data-ten-row-sig');
}

export const GlobalTableScrollController: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    let rafId = 0;

    const applyTenRowCapToAllTables = () => {
      const tables = Array.from(document.querySelectorAll('table'));

      for (const table of tables) {
        // Never touch nested tables
        if (table.parentElement?.closest('table')) {
          continue;
        }

        // Never touch print/PDF/hidden/manually managed tables
        if (table.closest(EXCLUDED_TABLE_CONTAINER_SELECTOR)) {
          continue;
        }

        const container = table.parentElement;
        if (!container || container.tagName !== 'DIV') {
          continue;
        }

        const tbodyRows = Array.from(
          table.querySelectorAll(':scope > tbody > tr')
        ) as HTMLElement[];

        if (tbodyRows.length <= MAX_VISIBLE_TABLE_ROWS) {
          clearScrollCap(container);
          continue;
        }

        const thead = table.querySelector(':scope > thead') as HTMLElement | null;
        const tfoot = table.querySelector(':scope > tfoot') as HTMLElement | null;
        const theadHeight = measureLocalHeight(thead);
        const tfootHeight = measureLocalHeight(tfoot);
        const nextSig = computeTableScrollSignature({
          rowCount: tbodyRows.length,
          containerWidth: container.clientWidth,
          theadHeight,
          tfootHeight,
        });

        if (
          container.getAttribute('data-ten-row-scroll') === 'active' &&
          container.getAttribute('data-ten-row-sig') === nextSig
        ) {
          continue;
        }

        const rowHeights = tbodyRows.slice(0, MAX_VISIBLE_TABLE_ROWS).map((tr) => measureLocalHeight(tr));
        // Push sentinel items to preserve row count > maxVisibleRows check
        while (rowHeights.length < tbodyRows.length) {
          rowHeights.push(0);
        }

        const nextMaxHeight = calculateScrollViewportMaxHeight({
          theadHeight,
          tfootHeight,
          rowHeights,
          maxVisibleRows: MAX_VISIBLE_TABLE_ROWS,
        });

        if (!nextMaxHeight || nextMaxHeight <= 0) {
          continue;
        }

        const targetMaxHeightCss = `${nextMaxHeight}px`;
        if (container.style.maxHeight !== targetMaxHeightCss) {
          container.style.maxHeight = targetMaxHeightCss;
        }
        if (container.style.overflowY !== 'auto') {
          container.style.overflowY = 'auto';
        }
        if (container.getAttribute('data-ten-row-scroll') !== 'active') {
          container.setAttribute('data-ten-row-scroll', 'active');
        }
        if (
          container.getAttribute('data-visible-row-limit') !==
          String(MAX_VISIBLE_TABLE_ROWS)
        ) {
          container.setAttribute(
            'data-visible-row-limit',
            String(MAX_VISIBLE_TABLE_ROWS)
          );
        }
        container.setAttribute('data-ten-row-sig', nextSig);

        ensureStickySectionOpacity(thead, 'top', '#f8fafc');
        ensureStickySectionOpacity(tfoot, 'bottom', '#f8fafc');
      }
    };

    const scheduleScan = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        applyTenRowCapToAllTables();
      });
    };

    // Initial pass
    applyTenRowCapToAllTables();

    // Re-evaluate only on structural DOM additions/removals (never attributes)
    const mutationObserver = new MutationObserver(() => {
      scheduleScan();
    });
    const rootNode = document.getElementById('root') || document.body;
    mutationObserver.observe(rootNode, {
      childList: true,
      subtree: true,
    });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleScan();
      });
      resizeObserver.observe(rootNode);
    }

    window.addEventListener('resize', scheduleScan, { passive: true });

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleScan);
    };
  }, []);

  return null;
};
