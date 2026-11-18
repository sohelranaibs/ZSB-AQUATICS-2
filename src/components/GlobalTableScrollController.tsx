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

  // Batch style reads before writes
  const computedSection = window.getComputedStyle(section);
  const needsPositionSticky = computedSection.position !== 'sticky';
  const needsZIndex = !computedSection.zIndex || computedSection.zIndex === 'auto';
  const cellsToPaint: Array<{ cell: HTMLElement; color: string }> = [];

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
        cellsToPaint.push({ cell, color: resolvedSectionBg });
      }
    }
  }

  // Apply writes together
  if (needsPositionSticky) {
    section.style.position = 'sticky';
  }
  if (edge === 'top') {
    section.style.top = '0px';
  } else {
    section.style.bottom = '0px';
  }
  if (needsZIndex) {
    section.style.zIndex = '10';
  }
  for (const entry of cellsToPaint) {
    entry.cell.style.backgroundColor = entry.color;
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

function isNonTableChromeMutationTarget(node: Node | null): boolean {
  const el = node instanceof HTMLElement ? node : node?.parentElement;
  if (!el) return false;
  return Boolean(
    el.closest('header, nav, aside, [data-testid="global-toast-banner"], #global-pdf-export-host')
  );
}

const TABLE_STRUCTURAL_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR']);

function nodeContainsTableStructure(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (TABLE_STRUCTURAL_TAGS.has(node.tagName)) return true;
  return Boolean(node.querySelector('table, tr'));
}

function isTableStructuralMutation(m: MutationRecord): boolean {
  if (isNonTableChromeMutationTarget(m.target)) {
    return false;
  }
  const targetEl = m.target instanceof HTMLElement ? m.target : m.target?.parentElement;
  if (targetEl && TABLE_STRUCTURAL_TAGS.has(targetEl.tagName)) {
    return true;
  }
  for (let i = 0; i < m.addedNodes.length; i++) {
    if (nodeContainsTableStructure(m.addedNodes[i])) return true;
  }
  for (let i = 0; i < m.removedNodes.length; i++) {
    if (nodeContainsTableStructure(m.removedNodes[i])) return true;
  }
  return false;
}

export const GlobalTableScrollController: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    let rafId = 0;

    const applyTenRowCapToAllTables = () => {
      const tables = document.getElementsByTagName('table');
      if (tables.length === 0) return;

      // Phase 1: Batch all layout reads first to avoid read/write thrashing
      const clearOps: HTMLElement[] = [];
      const updateOps: Array<{
        container: HTMLElement;
        thead: HTMLElement | null;
        tfoot: HTMLElement | null;
        nextSig: string;
        nextMaxHeight: number;
      }> = [];

      for (let tIdx = 0; tIdx < tables.length; tIdx++) {
        const table = tables[tIdx];
        if (table.parentElement?.closest('table')) {
          continue;
        }
        if (table.closest(EXCLUDED_TABLE_CONTAINER_SELECTOR)) {
          continue;
        }

        const container = table.parentElement;
        if (!container || container.tagName !== 'DIV') {
          continue;
        }

        const tbody = table.tBodies[0];
        const tbodyRows = tbody ? tbody.rows : null;
        const rowCount = tbodyRows ? tbodyRows.length : 0;

        if (!tbodyRows || rowCount <= MAX_VISIBLE_TABLE_ROWS) {
          if (
            container.getAttribute('data-ten-row-scroll') === 'active' ||
            container.hasAttribute('data-ten-row-sig')
          ) {
            clearOps.push(container);
          }
          continue;
        }

        const thead = table.tHead as HTMLElement | null;
        const tfoot = table.tFoot as HTMLElement | null;
        const theadHeight = measureLocalHeight(thead);
        const tfootHeight = measureLocalHeight(tfoot);
        const nextSig = computeTableScrollSignature({
          rowCount,
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

        const rowHeights: number[] = [];
        for (let rIdx = 0; rIdx < MAX_VISIBLE_TABLE_ROWS; rIdx++) {
          rowHeights.push(measureLocalHeight(tbodyRows[rIdx] as HTMLElement));
        }
        rowHeights.push(0);

        const nextMaxHeight = calculateScrollViewportMaxHeight({
          theadHeight,
          tfootHeight,
          rowHeights,
          maxVisibleRows: MAX_VISIBLE_TABLE_ROWS,
        });

        if (!nextMaxHeight || nextMaxHeight <= 0) {
          continue;
        }

        updateOps.push({ container, thead, tfoot, nextSig, nextMaxHeight });
      }

      // Phase 2: Perform DOM style and attribute writes
      for (const container of clearOps) {
        clearScrollCap(container);
      }

      for (const op of updateOps) {
        const { container, thead, tfoot, nextSig, nextMaxHeight } = op;
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

    // Re-evaluate only when tables or table rows are structurally added or removed
    const mutationObserver = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        if (isTableStructuralMutation(mutations[i])) {
          scheduleScan();
          break;
        }
      }
    });
    const rootNode = document.getElementById('root') || document.body;
    mutationObserver.observe(rootNode, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('resize', scheduleScan, { passive: true });

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleScan);
    };
  }, []);

  return null;
};
