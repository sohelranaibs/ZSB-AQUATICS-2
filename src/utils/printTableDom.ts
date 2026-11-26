import {
  PrintColumnDescriptor,
  buildPrintColumnId,
  classifyPrintColumn,
  computeAdjustedCellSpan,
  computeNormalizedColWidths,
  normalizePrintColToken,
} from './printColumnConfig.ts';

function getPrimaryTableHeaderRow(
  table: HTMLTableElement
): HTMLTableRowElement | null {
  const thead = table.tHead;
  if (!thead || thead.rows.length === 0) return null;

  let bestRow: HTMLTableRowElement | null = null;
  let bestCount = 0;

  for (let i = 0; i < thead.rows.length; i++) {
    const row = thead.rows[i];
    let singleSpanThCount = 0;
    for (let c = 0; c < row.cells.length; c++) {
      const cell = row.cells[c];
      if (cell.tagName === 'TH' && (cell.colSpan || 1) <= 1) {
        singleSpanThCount += 1;
      }
    }
    if (singleSpanThCount >= bestCount && singleSpanThCount > 0) {
      bestCount = singleSpanThCount;
      bestRow = row;
    }
  }

  return bestRow;
}

function resolveTableDisplayTitle(
  table: HTMLTableElement,
  tableIndex: number,
  totalTables: number
): string {
  // Check for a banner header row inside thead (e.g. FLIGHT RETURN BILL)
  if (table.tHead && table.tHead.rows.length > 1) {
    const firstRowText = (table.tHead.rows[0].textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (firstRowText && firstRowText.length <= 64) {
      return firstRowText;
    }
  }

  // Check immediate previous sibling heading inside the table's section wrapper
  const prevSibling = table.previousElementSibling as HTMLElement | null;
  if (prevSibling) {
    const firstSpan = prevSibling.querySelector('span');
    const headingText = (firstSpan?.textContent || prevSibling.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (headingText && headingText.length <= 64) {
      return headingText;
    }
  }

  return totalTables > 1 ? `Table ${tableIndex + 1}` : 'Document Table';
}

function getTopLevelTables(container: HTMLElement): HTMLTableElement[] {
  const all = Array.from(container.querySelectorAll('table'));
  return all.filter((table) => {
    const parentTable = table.parentElement?.closest('table');
    return !parentTable || !container.contains(parentTable);
  });
}

/**
 * Discovers all toggleable table columns rendered inside `#printable-document`.
 * When `deduplicateByIndex` is true (e.g. batch payment slips), identical slip tables
 * share a single logical column group so toggling a column updates every slip uniformly.
 */
export function scanPrintDocumentTables(
  container: HTMLElement | null,
  deduplicateByIndex: boolean = false
): PrintColumnDescriptor[] {
  if (!container) return [];

  const tables = getTopLevelTables(container);
  if (tables.length === 0) return [];

  const descriptors: PrintColumnDescriptor[] = [];
  const tablesToScan = deduplicateByIndex ? [tables[0]] : tables;

  for (let tIdx = 0; tIdx < tablesToScan.length; tIdx++) {
    const table = tablesToScan[tIdx];
    const headerRow = getPrimaryTableHeaderRow(table);
    if (!headerRow) continue;

    const thCells = Array.from(headerRow.cells).filter(
      (c): c is HTMLTableCellElement => c.tagName === 'TH'
    );
    if (thCells.length < 2) continue;

    const tableKey = deduplicateByIndex ? 'batch_slips' : `t${tIdx}`;
    const tableTitle = deduplicateByIndex
      ? 'Payment Slip Columns (All Slips)'
      : resolveTableDisplayTitle(table, tIdx, tablesToScan.length);

    const usedKeys = new Set<string>();
    let colCursor = 0;

    for (let cIdx = 0; cIdx < thCells.length; cIdx++) {
      const th = thCells[cIdx];
      const origSpan = Number(th.getAttribute('data-orig-colspan')) || th.colSpan || 1;
      const rawText = (th.textContent || '').replace(/\s+/g, ' ').trim();
      const label = rawText || `Column ${colCursor + 1}`;
      const explicitColKey =
        th.getAttribute('data-column-id') || th.getAttribute('data-col-key') || '';
      const baseKey = explicitColKey || normalizePrintColToken(label, colCursor);

      let colKey = baseKey;
      let suffix = 2;
      while (usedKeys.has(colKey)) {
        colKey = `${baseKey}__${suffix}`;
        suffix += 1;
      }
      usedKeys.add(colKey);

      const { category, defaultHidden } = classifyPrintColumn(label, colKey);
      descriptors.push({
        id: buildPrintColumnId(tableKey, colKey),
        tableKey,
        tableIndex: tIdx,
        tableTitle,
        colIndex: colCursor,
        colKey,
        label,
        category,
        defaultHidden,
      });

      colCursor += origSpan;
    }
  }

  return descriptors;
}

function parsePercentWidth(rawWidth: string | null | undefined): number | null {
  if (!rawWidth) return null;
  const trimmed = rawWidth.trim();
  if (!trimmed.endsWith('%')) return null;
  const parsed = parseFloat(trimmed.slice(0, -1));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function applyHiddenIndicesToSingleTable(
  table: HTMLTableElement,
  hiddenIndices: ReadonlySet<number>
): void {
  const hasAnyHidden = hiddenIndices.size > 0;

  // 1. Adjust <colgroup><col> widths proportionally so remaining columns span full A4 width
  const colgroup = table.querySelector(':scope > colgroup');
  if (colgroup) {
    const cols = Array.from(colgroup.querySelectorAll('col'));
    const origPercents: Array<number | null> = cols.map((col) => {
      if (!col.hasAttribute('data-orig-col-width')) {
        col.setAttribute('data-orig-col-width', col.style.width || '');
      }
      return parsePercentWidth(col.getAttribute('data-orig-col-width'));
    });

    if (!hasAnyHidden) {
      cols.forEach((col) => {
        const origW = col.getAttribute('data-orig-col-width') || '';
        col.style.width = origW;
        col.style.removeProperty('display');
        col.removeAttribute('data-print-col-hidden');
        col.removeAttribute('data-export-ignore');
      });
    } else {
      const normalized = computeNormalizedColWidths(origPercents, hiddenIndices);
      cols.forEach((col, idx) => {
        if (hiddenIndices.has(idx)) {
          col.setAttribute('data-print-col-hidden', 'true');
          col.setAttribute('data-export-ignore', 'true');
          col.style.display = 'none';
          col.style.width = '0%';
        } else {
          col.removeAttribute('data-print-col-hidden');
          col.removeAttribute('data-export-ignore');
          col.style.removeProperty('display');
          const nextW = normalized[idx];
          if (nextW) {
            col.style.width = nextW;
          } else {
            const origW = col.getAttribute('data-orig-col-width') || '';
            col.style.width = origW;
          }
        }
      });
    }
  }

  // 2. Adjust every row across thead, tbody, and tfoot with exact colSpan recalculation
  const sections: Array<HTMLTableSectionElement | null> = [
    table.tHead,
    ...Array.from(table.tBodies),
    table.tFoot,
  ];

  for (const section of sections) {
    if (!section) continue;
    const rows = Array.from(section.rows);

    for (const row of rows) {
      const cells = Array.from(row.cells);
      let colCursor = 0;
      const visibleCells: HTMLTableCellElement[] = [];

      for (const cell of cells) {
        if (!cell.hasAttribute('data-orig-colspan')) {
          cell.setAttribute('data-orig-colspan', String(cell.colSpan || 1));
        }
        const origSpan =
          Number(cell.getAttribute('data-orig-colspan')) || 1;

        cell.removeAttribute('data-print-col-last-visible');

        if (!hasAnyHidden) {
          cell.removeAttribute('data-print-col-hidden');
          cell.removeAttribute('data-export-ignore');
          cell.style.removeProperty('display');
          if (cell.colSpan !== origSpan) {
            cell.colSpan = origSpan;
          }
          visibleCells.push(cell);
        } else {
          const nextSpan = computeAdjustedCellSpan(
            colCursor,
            origSpan,
            hiddenIndices
          );
          if (nextSpan <= 0) {
            cell.setAttribute('data-print-col-hidden', 'true');
            cell.setAttribute('data-export-ignore', 'true');
            cell.style.display = 'none';
          } else {
            cell.removeAttribute('data-print-col-hidden');
            cell.removeAttribute('data-export-ignore');
            cell.style.removeProperty('display');
            if (cell.colSpan !== nextSpan) {
              cell.colSpan = nextSpan;
            }
            visibleCells.push(cell);
          }
        }

        colCursor += origSpan;
      }

      // Remove trailing right border on the last visible cell when columns are hidden
      if (hasAnyHidden && visibleCells.length > 0) {
        visibleCells[visibleCells.length - 1].setAttribute(
          'data-print-col-last-visible',
          'true'
        );
      }
    }
  }
}

/**
 * Applies the selected hidden column IDs directly to every table inside `#printable-document`
 * so the live preview, A4 PDF, PNG, and Browser Print output match 100%.
 */
export function applyPrintColumnVisibilityToDom(
  container: HTMLElement | null,
  columns: PrintColumnDescriptor[],
  hiddenColumnIds: ReadonlySet<string>,
  deduplicateByIndex: boolean = false
): void {
  if (!container) return;

  const tables = getTopLevelTables(container);
  if (tables.length === 0) return;

  if (deduplicateByIndex) {
    const sharedHidden = new Set<number>();
    for (const col of columns) {
      if (hiddenColumnIds.has(col.id)) {
        sharedHidden.add(col.colIndex);
      }
    }
    for (const table of tables) {
      applyHiddenIndicesToSingleTable(table, sharedHidden);
    }
    return;
  }

  const hiddenByTableIndex = new Map<number, Set<number>>();
  for (const col of columns) {
    if (!hiddenColumnIds.has(col.id)) continue;
    const set = hiddenByTableIndex.get(col.tableIndex) || new Set<number>();
    set.add(col.colIndex);
    hiddenByTableIndex.set(col.tableIndex, set);
  }

  for (let tIdx = 0; tIdx < tables.length; tIdx++) {
    const hiddenIndices = hiddenByTableIndex.get(tIdx) || new Set<number>();
    applyHiddenIndicesToSingleTable(tables[tIdx], hiddenIndices);
  }
}
