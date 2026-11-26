import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  MAX_VISIBLE_TABLE_ROWS,
  EXCLUDED_TABLE_CONTAINER_SELECTOR,
  calculateScrollViewportMaxHeight,
  computeTableScrollSignature,
  isOpaqueCssColor,
  resolveStickySectionBackground,
} from '../utils/tableScroll.ts';
import {
  COL_RESIZE_EXCLUDED_SELECTOR,
  KEYBOARD_RESIZE_FAST_STEP_PX,
  KEYBOARD_RESIZE_STEP_PX,
  MAX_COLUMN_WIDTH_PX,
  MIN_COLUMN_WIDTH_PX,
  RESIZE_GUIDE_OVERLAY_ID,
  RESIZE_HANDLE_ATTR,
  UserTableColumnWidths,
  clampColumnWidth,
  computeResizedColumnWidth,
  deriveColumnResizeKey,
  deriveTableResizeKey,
  loadUserColumnWidths,
  normalizeUserColumnWidthKey,
  removeColumnWidthForUser,
  saveColumnWidthForUser,
} from '../utils/tableColumnWidths.ts';

function measureLocalHeight(el: HTMLElement | null): number {
  if (!el) return 0;
  return el.offsetHeight > 0 ? el.offsetHeight : el.getBoundingClientRect().height;
}

function getEffectiveZoomFactor(el: HTMLElement): number {
  let factor = 1;
  let current: HTMLElement | null = el;
  while (current && current !== document.documentElement) {
    const rawZoom = window.getComputedStyle(current).getPropertyValue('zoom');
    if (rawZoom && rawZoom !== 'normal' && rawZoom !== '1') {
      const parsed = parseFloat(rawZoom);
      if (Number.isFinite(parsed) && parsed > 0.1) {
        factor *= parsed;
      }
    }
    current = current.parentElement;
  }
  return factor > 0.1 ? factor : 1;
}

function getCleanHeaderLabel(th: HTMLTableCellElement, fallbackIdx: number): string {
  const raw = (th.textContent || '')
    .replace(/[▲▼↕↑↓⇅]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return raw || `Column ${fallbackIdx + 1}`;
}

function getPrimaryHeaderRow(table: HTMLTableElement): HTMLTableRowElement | null {
  const thead = table.tHead;
  if (!thead || thead.rows.length === 0) return null;

  let bestRow: HTMLTableRowElement | null = null;
  let bestCount = 0;
  for (let i = 0; i < thead.rows.length; i++) {
    const row = thead.rows[i];
    const thCells = Array.from(row.cells).filter(
      (cell) => cell.tagName === 'TH'
    );
    if (thCells.length >= bestCount && thCells.length > 0) {
      bestCount = thCells.length;
      bestRow = row;
    }
  }
  return bestRow;
}

function getDirectResizeHandle(th: HTMLTableCellElement): HTMLElement | null {
  for (let i = 0; i < th.children.length; i++) {
    const child = th.children[i] as HTMLElement;
    if (child.getAttribute(RESIZE_HANDLE_ATTR) === 'true') {
      return child;
    }
  }
  return null;
}

function isResizableTable(table: HTMLTableElement): boolean {
  if (table.parentElement?.closest('table')) return false;
  if (table.closest(COL_RESIZE_EXCLUDED_SELECTOR)) return false;
  const headerRow = getPrimaryHeaderRow(table);
  if (!headerRow) return false;
  let singleSpanThCount = 0;
  for (let i = 0; i < headerRow.cells.length; i++) {
    const cell = headerRow.cells[i];
    if (cell.tagName === 'TH' && cell.colSpan <= 1) {
      singleSpanThCount += 1;
    }
  }
  return singleSpanThCount >= 2;
}

function clearTableResizeStyles(table: HTMLTableElement): void {
  if (table.getAttribute('data-col-resized') === 'true') {
    table.style.removeProperty('table-layout');
    table.style.removeProperty('width');
    table.style.removeProperty('min-width');
    table.removeAttribute('data-col-resized');
  }
  const headerRow = getPrimaryHeaderRow(table);
  if (!headerRow) return;
  for (let i = 0; i < headerRow.cells.length; i++) {
    const cell = headerRow.cells[i] as HTMLTableCellElement;
    if (cell.tagName !== 'TH') continue;
    if (
      cell.hasAttribute('data-resize-custom-width') ||
      cell.hasAttribute('data-resize-auto-width')
    ) {
      cell.style.removeProperty('width');
      cell.style.removeProperty('min-width');
      cell.style.removeProperty('max-width');
      cell.removeAttribute('data-resize-custom-width');
      cell.removeAttribute('data-resize-auto-width');
    }
    const handle = getDirectResizeHandle(cell);
    if (handle) {
      handle.removeAttribute('aria-valuenow');
    }
  }
}

function clearAllTableResizeStyles(): void {
  const tables = document.getElementsByTagName('table');
  for (let i = 0; i < tables.length; i++) {
    clearTableResizeStyles(tables[i]);
  }
}

function ensureContainerAllowsHorizontalScroll(table: HTMLTableElement): void {
  const container = table.parentElement;
  if (!container || container.tagName !== 'DIV') return;
  const computedOverflowX = window.getComputedStyle(container).overflowX;
  if (computedOverflowX === 'visible' || computedOverflowX === 'clip') {
    container.style.overflowX = 'auto';
  }
}

function createOrUpdateGuideOverlay(
  table: HTMLTableElement,
  th: HTMLTableCellElement,
  widthPx: number
): HTMLElement {
  let overlay = document.getElementById(RESIZE_GUIDE_OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = RESIZE_GUIDE_OVERLAY_ID;
    overlay.setAttribute('data-export-ignore', 'true');
    overlay.setAttribute('aria-hidden', 'true');

    const badge = document.createElement('span');
    badge.className = 'zsb-col-resize-badge';
    overlay.appendChild(badge);

    document.body.appendChild(overlay);
  }

  const thRect = th.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const top = Math.max(28, tableRect.top);
  const bottom = Math.min(window.innerHeight - 4, tableRect.bottom);
  const height = Math.max(40, bottom - top);
  const clampedLeft = Math.max(2, Math.min(window.innerWidth - 4, thRect.right));

  overlay.style.left = `${Math.round(clampedLeft)}px`;
  overlay.style.top = `${Math.round(top)}px`;
  overlay.style.height = `${Math.round(height)}px`;

  const badge = overlay.firstElementChild as HTMLElement | null;
  if (badge) {
    badge.textContent = `${widthPx}px`;
  }

  return overlay;
}

function removeGuideOverlay(): void {
  const overlay = document.getElementById(RESIZE_GUIDE_OVERLAY_ID);
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
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

function isManagedResizeNode(node: Node | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return (
    node.getAttribute(RESIZE_HANDLE_ATTR) === 'true' ||
    node.id === RESIZE_GUIDE_OVERLAY_ID
  );
}

function isNonTableChromeMutationTarget(node: Node | null): boolean {
  const el = node instanceof HTMLElement ? node : node?.parentElement;
  if (!el) return false;
  return Boolean(
    el.closest(
      `header, nav, aside, [data-testid="global-toast-banner"], #global-pdf-export-host, #${RESIZE_GUIDE_OVERLAY_ID}`
    )
  );
}

const TABLE_STRUCTURAL_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR']);

function nodeContainsTableStructure(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (isManagedResizeNode(node)) return false;
  if (TABLE_STRUCTURAL_TAGS.has(node.tagName) || node.tagName === 'TH') {
    return true;
  }
  return Boolean(node.querySelector('table, tr'));
}

function isTableStructuralMutation(m: MutationRecord): boolean {
  if (isNonTableChromeMutationTarget(m.target)) {
    return false;
  }

  // Ignore our own resize handle/guide DOM mutations to avoid observer feedback loops
  const totalMutatedNodes = m.addedNodes.length + m.removedNodes.length;
  if (totalMutatedNodes > 0) {
    let allManaged = true;
    for (let i = 0; i < m.addedNodes.length; i++) {
      if (!isManagedResizeNode(m.addedNodes[i])) {
        allManaged = false;
        break;
      }
    }
    if (allManaged) {
      for (let i = 0; i < m.removedNodes.length; i++) {
        if (!isManagedResizeNode(m.removedNodes[i])) {
          allManaged = false;
          break;
        }
      }
    }
    if (allManaged) {
      return false;
    }
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
  const { currentUser } = useApp();
  const activeUserKey = normalizeUserColumnWidthKey(
    currentUser?.username || currentUser?.email || 'guest'
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    let rafId = 0;
    let isDraggingResize = false;
    let activeDragCleanup: (() => void) | null = null;
    let clickSuppressCleanup: (() => void) | null = null;

    // Load this user's persisted column widths from localStorage
    let userWidths: UserTableColumnWidths = loadUserColumnWidths(activeUserKey);

    // Clear any previously applied inline column widths (e.g., from a previous logged-in user)
    clearAllTableResizeStyles();

    const suppressNextClickBriefly = () => {
      if (clickSuppressCleanup) {
        clickSuppressCleanup();
        clickSuppressCleanup = null;
      }
      const onClickCapture = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (clickSuppressCleanup) {
          clickSuppressCleanup();
          clickSuppressCleanup = null;
        }
      };
      const timerId = window.setTimeout(() => {
        if (clickSuppressCleanup) {
          clickSuppressCleanup();
          clickSuppressCleanup = null;
        }
      }, 250);

      window.addEventListener('click', onClickCapture, true);
      clickSuppressCleanup = () => {
        window.clearTimeout(timerId);
        window.removeEventListener('click', onClickCapture, true);
      };
    };

    const applySavedWidthsToTable = (
      table: HTMLTableElement,
      headerRow: HTMLTableRowElement,
      tableKey: string
    ) => {
      const savedMap = userWidths[tableKey];
      const headerCells = Array.from(headerRow.cells).filter(
        (cell): cell is HTMLTableCellElement => cell.tagName === 'TH'
      );

      if (!savedMap || Object.keys(savedMap).length === 0) {
        if (table.getAttribute('data-col-resized') === 'true') {
          clearTableResizeStyles(table);
        }
        return;
      }

      const hasMatchingColumn = headerCells.some((th) => {
        const colKey = th.getAttribute('data-resize-col-key');
        return Boolean(colKey && savedMap[colKey] !== undefined);
      });

      if (!hasMatchingColumn) {
        if (table.getAttribute('data-col-resized') === 'true') {
          clearTableResizeStyles(table);
        }
        return;
      }

      // Defer locking column widths if the table is currently hidden (0px width)
      const tableRect = table.getBoundingClientRect();
      if (tableRect.width <= 0) {
        return;
      }

      const zoomFactor = getEffectiveZoomFactor(table);

      // Phase 1: Measure all header cells before mutating layout
      const measuredWidths = headerCells.map((th) => {
        const colKey = th.getAttribute('data-resize-col-key') || '';
        const saved = savedMap[colKey];
        if (typeof saved === 'number' && Number.isFinite(saved)) {
          return { th, colKey, width: clampColumnWidth(saved), isCustom: true };
        }
        const existingInline = parseFloat(th.style.width);
        const naturalWidth =
          th.hasAttribute('data-resize-auto-width') &&
          Number.isFinite(existingInline) &&
          existingInline > 0
            ? existingInline
            : th.getBoundingClientRect().width / zoomFactor;

        return {
          th,
          colKey,
          width: clampColumnWidth(
            naturalWidth > 0 ? naturalWidth : MIN_COLUMN_WIDTH_PX
          ),
          isCustom: false,
        };
      });

      // Phase 2: Write widths atomically
      let totalTableWidth = 0;
      for (const item of measuredWidths) {
        totalTableWidth += item.width;
        const widthCss = `${item.width}px`;
        item.th.style.width = widthCss;
        item.th.style.minWidth = widthCss;
        item.th.style.maxWidth = widthCss;
        if (item.isCustom) {
          item.th.setAttribute('data-resize-custom-width', 'true');
          item.th.removeAttribute('data-resize-auto-width');
        } else {
          item.th.setAttribute('data-resize-auto-width', 'true');
          item.th.removeAttribute('data-resize-custom-width');
        }
        const handle = getDirectResizeHandle(item.th);
        if (handle) {
          handle.setAttribute('aria-valuenow', String(item.width));
        }
      }

      const totalWidthCss = `${Math.round(totalTableWidth)}px`;
      table.style.tableLayout = 'fixed';
      table.style.width = totalWidthCss;
      table.style.minWidth = totalWidthCss;
      table.setAttribute('data-col-resized', 'true');
      ensureContainerAllowsHorizontalScroll(table);
    };

    const enhanceResizableTables = () => {
      if (isDraggingResize) return;
      const tables = document.getElementsByTagName('table');
      if (tables.length === 0) return;

      for (let tIdx = 0; tIdx < tables.length; tIdx++) {
        const table = tables[tIdx];
        if (!isResizableTable(table)) continue;

        const headerRow = getPrimaryHeaderRow(table);
        if (!headerRow) continue;

        const thCells = Array.from(headerRow.cells).filter(
          (cell): cell is HTMLTableCellElement => cell.tagName === 'TH'
        );

        const firstHeaderWithTableId = thCells.find((th) =>
          Boolean(th.getAttribute('data-table-id'))
        );

        const tableKey = deriveTableResizeKey({
          tableIdAttr: table.getAttribute('data-table-id'),
          firstHeaderTableId:
            firstHeaderWithTableId?.getAttribute('data-table-id') || null,
          tableTestId: table.getAttribute('data-testid'),
          tableDomId: table.id || null,
          headerTexts: thCells.map((th, idx) => getCleanHeaderLabel(th, idx)),
        });
        table.setAttribute('data-resize-table-key', tableKey);

        const usedColKeys = new Set<string>();
        const cellsNeedingPositionRelative: HTMLTableCellElement[] = [];

        // Phase 1: Assign keys and check positioning
        const preparedHeaders: Array<{
          th: HTMLTableCellElement;
          colKey: string;
          label: string;
          needsHandle: boolean;
        }> = [];

        for (let cIdx = 0; cIdx < thCells.length; cIdx++) {
          const th = thCells[cIdx];
          if (th.colSpan > 1) continue;

          const label = getCleanHeaderLabel(th, cIdx);
          const colKey = deriveColumnResizeKey({
            columnIdAttr: th.getAttribute('data-column-id'),
            colKeyAttr: th.getAttribute('data-col-key'),
            headerText: label,
            columnIndex: cIdx,
            usedKeys: usedColKeys,
          });
          th.setAttribute('data-resize-col-key', colKey);

          const existingHandle = getDirectResizeHandle(th);
          if (!existingHandle) {
            const computedPos = window.getComputedStyle(th).position;
            if (computedPos === 'static') {
              cellsNeedingPositionRelative.push(th);
            }
          }

          preparedHeaders.push({
            th,
            colKey,
            label,
            needsHandle: !existingHandle,
          });
        }

        // Phase 2: Mount resize handles where needed
        for (const th of cellsNeedingPositionRelative) {
          th.style.position = 'relative';
        }

        for (const item of preparedHeaders) {
          if (!item.needsHandle) continue;
          const handle = document.createElement('span');
          handle.className = 'zsb-col-resize-handle';
          handle.setAttribute(RESIZE_HANDLE_ATTR, 'true');
          handle.setAttribute('data-export-ignore', 'true');
          handle.setAttribute('role', 'separator');
          handle.setAttribute('aria-orientation', 'vertical');
          handle.setAttribute('aria-valuemin', String(MIN_COLUMN_WIDTH_PX));
          handle.setAttribute('aria-valuemax', String(MAX_COLUMN_WIDTH_PX));
          handle.setAttribute('aria-label', `Resize ${item.label} column`);
          handle.setAttribute('tabindex', '0');
          handle.title = 'Drag to resize column • Double-click to reset width';
          item.th.appendChild(handle);
        }

        // Phase 3: Apply persisted per-user column widths
        applySavedWidthsToTable(table, headerRow, tableKey);
      }
    };

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

    const runAllTableEnhancements = () => {
      enhanceResizableTables();
      applyTenRowCapToAllTables();
    };

    const scheduleScan = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        runAllTableEnhancements();
      });
    };

    const resetSingleColumnWidth = (
      table: HTMLTableElement,
      headerRow: HTMLTableRowElement,
      tableKey: string,
      colKey: string
    ) => {
      userWidths = removeColumnWidthForUser(activeUserKey, tableKey, colKey);
      // Reset table inline styles first so untouched/reset column regains true natural width
      clearTableResizeStyles(table);
      applySavedWidthsToTable(table, headerRow, tableKey);
      applyTenRowCapToAllTables();
    };

    const commitColumnWidth = (
      table: HTMLTableElement,
      headerRow: HTMLTableRowElement,
      tableKey: string,
      colKey: string,
      widthPx: number
    ) => {
      userWidths = saveColumnWidthForUser(
        activeUserKey,
        tableKey,
        colKey,
        widthPx
      );
      applySavedWidthsToTable(table, headerRow, tableKey);
      applyTenRowCapToAllTables();
    };

    const resolveHandleContext = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return null;
      const handle = target.closest(
        `[${RESIZE_HANDLE_ATTR}="true"]`
      ) as HTMLElement | null;
      if (!handle) return null;
      const th = handle.closest('th') as HTMLTableCellElement | null;
      const table = handle.closest('table') as HTMLTableElement | null;
      if (!th || !table) return null;
      const headerRow = getPrimaryHeaderRow(table);
      if (!headerRow) return null;
      const tableKey = table.getAttribute('data-resize-table-key');
      const colKey = th.getAttribute('data-resize-col-key');
      if (!tableKey || !colKey) return null;
      return { handle, th, table, headerRow, tableKey, colKey };
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const ctx = resolveHandleContext(e.target);
      if (!ctx) return;

      e.preventDefault();
      e.stopPropagation();

      if (activeDragCleanup) {
        activeDragCleanup();
        activeDragCleanup = null;
      }

      const { handle, th, table, headerRow, tableKey, colKey } = ctx;
      const hadPriorCustomWidths =
        Boolean(userWidths[tableKey]) &&
        Object.keys(userWidths[tableKey]).length > 0;

      const zoomFactor = getEffectiveZoomFactor(table);
      const headerCells = Array.from(headerRow.cells).filter(
        (cell): cell is HTMLTableCellElement => cell.tagName === 'TH'
      );

      // Measure all columns before locking layout
      const measuredMap = new Map<HTMLTableCellElement, number>();
      let otherColumnsWidthSum = 0;
      let startWidth = MIN_COLUMN_WIDTH_PX;

      for (const cell of headerCells) {
        const w = clampColumnWidth(
          cell.getBoundingClientRect().width / zoomFactor
        );
        measuredMap.set(cell, w);
        if (cell === th) {
          startWidth = w;
        } else {
          otherColumnsWidthSum += w;
        }
      }

      // Lock all columns at their current widths so only the dragged column moves
      for (const cell of headerCells) {
        const w = measuredMap.get(cell) || MIN_COLUMN_WIDTH_PX;
        const wCss = `${w}px`;
        cell.style.width = wCss;
        cell.style.minWidth = wCss;
        cell.style.maxWidth = wCss;
        if (!cell.hasAttribute('data-resize-custom-width')) {
          cell.setAttribute('data-resize-auto-width', 'true');
        }
      }

      const initialTableWidth = otherColumnsWidthSum + startWidth;
      table.style.tableLayout = 'fixed';
      table.style.width = `${initialTableWidth}px`;
      table.style.minWidth = `${initialTableWidth}px`;
      table.setAttribute('data-col-resized', 'true');
      ensureContainerAllowsHorizontalScroll(table);

      // Temporarily disable native HTML5 column-reorder dragging on this header
      const prevDraggableAttr = th.getAttribute('draggable');
      th.draggable = false;

      isDraggingResize = true;
      handle.setAttribute('data-resizing', 'true');
      document.body.classList.add('zsb-col-resizing-active');

      const startClientX = e.clientX;
      let currentWidth = startWidth;
      let didMove = false;

      createOrUpdateGuideOverlay(table, th, currentWidth);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startClientX;
        if (Math.abs(deltaX) >= 2) {
          didMove = true;
        }
        const nextWidth = computeResizedColumnWidth(
          startWidth,
          deltaX,
          zoomFactor
        );
        if (nextWidth !== currentWidth) {
          currentWidth = nextWidth;
          const widthCss = `${currentWidth}px`;
          th.style.width = widthCss;
          th.style.minWidth = widthCss;
          th.style.maxWidth = widthCss;

          const totalWidthCss = `${otherColumnsWidthSum + currentWidth}px`;
          table.style.width = totalWidthCss;
          table.style.minWidth = totalWidthCss;
          handle.setAttribute('aria-valuenow', String(currentWidth));
        }
        createOrUpdateGuideOverlay(table, th, currentWidth);
      };

      const finishDrag = (commit: boolean) => {
        if (activeDragCleanup) {
          activeDragCleanup();
          activeDragCleanup = null;
        }

        if (commit && didMove) {
          th.setAttribute('data-resize-custom-width', 'true');
          th.removeAttribute('data-resize-auto-width');
          userWidths = saveColumnWidthForUser(
            activeUserKey,
            tableKey,
            colKey,
            currentWidth
          );
          suppressNextClickBriefly();
          applyTenRowCapToAllTables();
        } else if (!commit) {
          // Cancelled drag: restore saved widths or natural layout
          clearTableResizeStyles(table);
          applySavedWidthsToTable(table, headerRow, tableKey);
        } else if (!didMove && !hadPriorCustomWidths) {
          // Simple click without dragging on an unresized table: do not lock fixed layout
          clearTableResizeStyles(table);
        }
      };

      const onPointerUp = () => finishDrag(true);
      const onPointerCancel = () => finishDrag(false);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);

      activeDragCleanup = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        isDraggingResize = false;
        handle.removeAttribute('data-resizing');
        document.body.classList.remove('zsb-col-resizing-active');
        removeGuideOverlay();
        if (prevDraggableAttr === null) {
          th.removeAttribute('draggable');
        } else {
          th.setAttribute('draggable', prevDraggableAttr);
        }
      };
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) return;
      if (e.target.closest(`[${RESIZE_HANDLE_ATTR}="true"]`)) {
        // Never allow clicking a resize grip to trigger parent <th> sort click handlers
        e.stopPropagation();
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const ctx = resolveHandleContext(e.target);
      if (!ctx) return;
      e.preventDefault();
      e.stopPropagation();
      resetSingleColumnWidth(ctx.table, ctx.headerRow, ctx.tableKey, ctx.colKey);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctx = resolveHandleContext(e.target);
      if (!ctx) return;

      const { th, table, headerRow, tableKey, colKey } = ctx;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const zoomFactor = getEffectiveZoomFactor(table);
        const currentWidth = clampColumnWidth(
          th.getBoundingClientRect().width / zoomFactor
        );
        const step = e.shiftKey
          ? KEYBOARD_RESIZE_FAST_STEP_PX
          : KEYBOARD_RESIZE_STEP_PX;
        const delta = e.key === 'ArrowRight' ? step : -step;
        const nextWidth = clampColumnWidth(currentWidth + delta);
        commitColumnWidth(table, headerRow, tableKey, colKey, nextWidth);
      } else if (
        e.key === 'Home' ||
        e.key === 'Backspace' ||
        e.key === 'Delete'
      ) {
        e.preventDefault();
        e.stopPropagation();
        resetSingleColumnWidth(table, headerRow, tableKey, colKey);
      }
    };

    // Initial pass
    runAllTableEnhancements();

    // Re-evaluate when tables or table rows/headers are structurally added or removed
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

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('click', handleClickCapture, true);
    document.addEventListener('dblclick', handleDoubleClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', scheduleScan, { passive: true });

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (activeDragCleanup) {
        activeDragCleanup();
        activeDragCleanup = null;
      }
      if (clickSuppressCleanup) {
        clickSuppressCleanup();
        clickSuppressCleanup = null;
      }
      removeGuideOverlay();
      mutationObserver.disconnect();
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('click', handleClickCapture, true);
      document.removeEventListener('dblclick', handleDoubleClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', scheduleScan);
    };
  }, [activeUserKey]);

  return null;
};
