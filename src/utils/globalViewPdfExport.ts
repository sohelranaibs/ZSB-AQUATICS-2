import {
  ActiveTab,
  CompanyProfile,
  DropdownOptions,
  OtherCostRecord,
  PackingFormDraft,
  PackingRecord,
  PaymentRecord,
  PurchaseRecord,
  SupplierCreditRecord,
  ExporterPaymentSlipRow,
} from '../types/index.ts';
import {
  buildExporterPaymentSlipRows,
  calculateAllMonthlyReports,
  calculateExporterSlipTotals,
  calculatePackingTotalAmountBDT,
  calculatePackingTotals,
  calculateProfitLoss,
  classifyPaymentCategory,
  collectPackingManifestRecords,
  formatCurrency,
  formatDate,
  formatRMB,
  getTopSuppliersByVolume,
} from './calculations.ts';
import {
  buildExporterRecordHistory,
  calculateExporterHistoryTotals,
} from './exporterHistory.ts';

export interface GlobalTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

export interface GlobalTableFooterCell {
  value: string;
  colSpan?: number;
  align?: 'left' | 'center' | 'right';
  tone?: 'default' | 'emerald' | 'rose' | 'blue' | 'purple' | 'amber';
}

export interface GlobalTableSection {
  id: string;
  title: string;
  subtitle?: string;
  columns: GlobalTableColumn[];
  rows: Record<string, string | number>[];
  footerRows?: { cells: GlobalTableFooterCell[] }[];
}

export interface ExtractedDomTable {
  title?: string;
  headers: string[];
  rows: string[][];
  footers?: string[][];
}

export interface GlobalViewTableReport {
  activeTab: ActiveTab;
  viewLabel: string;
  documentTitle: string;
  documentBadge: string;
  sheetReference: string;
  generatedDate: string;
  filename: string;
  metadataGrid: { label: string; value: string }[];
  sections: GlobalTableSection[];
  exporterSlipPayload?: {
    shippingMark: string;
    packingDate: string;
    rows: ExporterPaymentSlipRow[];
    totals: ReturnType<typeof calculateExporterSlipTotals>;
  };
}

export interface GlobalViewReportInput {
  activeTab: ActiveTab;
  companyProfile: CompanyProfile;
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts: OtherCostRecord[];
  supplierCredits?: SupplierCreditRecord[];
  packingDraft?: PackingFormDraft | null;
  dropdownOptions?: DropdownOptions;
  domTables?: ExtractedDomTable[];
  referenceDate?: string;
}

const TAB_METADATA: Record<
  ActiveTab,
  {
    viewLabel: string;
    documentTitle: string;
    documentBadge: string;
    sheetReference: string;
    slug: string;
  }
> = {
  dashboard: {
    viewLabel: 'Dashboard',
    documentTitle: 'Executive Dashboard — Ledger Summary & Recent Transactions',
    documentBadge: 'EXECUTIVE DASHBOARD SUMMARY & LEDGER TABLE REPORT',
    sheetReference: 'A1:D10',
    slug: 'DASHBOARD_TABLE',
  },
  purchase_form: {
    viewLabel: 'Purchase Challan / Bill',
    documentTitle: 'Purchase Challan / Bill — Data Entry & Recent Bills Table',
    documentBadge:
      'PURCHASE DATA ENTRY FORM (LIVE CRABS, EEL FISH & CHILLED FISH GRADES) — TABLE REPORT',
    sheetReference: 'CHALLAN_R1',
    slug: 'PURCHASE_FORM_TABLE',
  },
  packing_form: {
    viewLabel: 'Packing List Form',
    documentTitle: 'Export Air Packing List Manifest — Consignment Table Report',
    documentBadge: 'EXPORT AIR PACKING LIST MANIFEST — TABLE REPORT',
    sheetReference: 'PACK_R1',
    slug: 'PACKING_FORM_TABLE',
  },
  air_way_bill: {
    viewLabel: 'FLIGHT RETURN BILL',
    documentTitle: 'FLIGHT RETURN BILL — Monthly Statement Report',
    documentBadge: 'FLIGHT RETURN BILL — MONTHLY STATEMENT REPORT',
    sheetReference: 'FRB_A1:H10',
    slug: 'FLIGHT_RETURN_BILL_TABLE',
  },
  payment_form: {
    viewLabel: 'Supplier Payment Form',
    documentTitle: 'Supplier Payment Voucher & Credit Ledger — Table Report',
    documentBadge: 'SUPPLIER PAYMENT & CREDIT APPLICATION LEDGER — TABLE REPORT',
    sheetReference: 'SUP_PAY_R1',
    slug: 'SUPPLIER_PAYMENT_TABLE',
  },
  exporter_payment_form: {
    viewLabel: 'Exporter Payment Form',
    documentTitle:
      'Exporter Payment Data Entry & Record History (Debit, Credit, Balance & Status)',
    documentBadge:
      'EXPORTER PAYMENT DATA ENTRY & RECORD HISTORY (DEBIT, CREDIT, BALANCE & STATUS)',
    sheetReference: 'EXP_PAY_R1',
    slug: 'EXPORTER_PAYMENT_HISTORY_TABLE',
  },
  exporter_payment_slip: {
    viewLabel: 'Exporter Payment Slip',
    documentTitle: 'PAYMENT SLIP 付款单 — Exporter Settlement Table',
    documentBadge: 'PAYMENT SLIP 付款单 — EXPORTER TABLE REPORT',
    sheetReference: 'SLIP_A1:H10',
    slug: 'PAYMENT_SLIP_TABLE',
  },
  profit_loss: {
    viewLabel: 'Loss & Profit Analysis',
    documentTitle: 'Loss & Profit Analysis, Monthly Trends & Supplier Performance',
    documentBadge: 'LOSS & PROFIT FINANCIAL ANALYSIS — TABLE REPORT',
    sheetReference: 'PL_SUMMARY',
    slug: 'PROFIT_LOSS_TABLE',
  },
  purchase_db: {
    viewLabel: 'Purchase DB',
    documentTitle: 'Master Purchase Database Ledger — Complete Table Report',
    documentBadge: 'MASTER PURCHASE DATABASE LEDGER — TABLE REPORT',
    sheetReference: 'PURCHASE_DB',
    slug: 'PURCHASE_DB_TABLE',
  },
  packing_db: {
    viewLabel: 'Packing DB',
    documentTitle: 'Master Export Packing List Database — Complete Table Report',
    documentBadge: 'MASTER EXPORT PACKING DATABASE LEDGER — TABLE REPORT',
    sheetReference: 'PACKING_DB',
    slug: 'PACKING_DB_TABLE',
  },
  payment_db: {
    viewLabel: 'Payment DB',
    documentTitle: 'Master Payment Voucher Database — Supplier & Exporter Ledger',
    documentBadge: 'MASTER PAYMENT VOUCHER DATABASE LEDGER — TABLE REPORT',
    sheetReference: 'PAYMENT_DB',
    slug: 'PAYMENT_DB_TABLE',
  },
  search_reports: {
    viewLabel: 'Search & Reports',
    documentTitle: 'Consolidated Multi-Ledger Search & Monthly Financial Report',
    documentBadge: 'CONSOLIDATED SEARCH & FINANCIAL STATEMENT — TABLE REPORT',
    sheetReference: 'REPORTS_ALL',
    slug: 'SEARCH_REPORTS_TABLE',
  },
  audit_logs: {
    viewLabel: 'Audit Logs',
    documentTitle: 'System Audit Logs — Entries, Edits & Deletions Activity Report',
    documentBadge: 'SYSTEM AUDIT TRAIL & ADMINISTRATOR ACTIVITY LOG — TABLE REPORT',
    sheetReference: 'AUDIT_LOG_DB',
    slug: 'AUDIT_LOGS_TABLE',
  },
  settings: {
    viewLabel: 'Settings & Config',
    documentTitle: 'System Configuration & Master Dropdown Lists Table Report',
    documentBadge: 'SYSTEM CONFIGURATION & MASTER DROPDOWN LISTS — TABLE REPORT',
    sheetReference: 'CONFIG_DB',
    slug: 'SETTINGS_CONFIG_TABLE',
  },
  administration: {
    viewLabel: 'Accounts & Administration',
    documentTitle: 'Accounts & Administration — Security, Team & Backup Report',
    documentBadge: 'ACCOUNTS & ADMINISTRATION — SECURITY & GOVERNANCE REPORT',
    sheetReference: 'ADMIN_VAULT',
    slug: 'ADMINISTRATION_REPORT',
  },
};

/**
 * Generates a clean, deterministic filename for the global view PDF export.
 */
export function formatGlobalViewPdfFilename(
  activeTab: ActiveTab,
  referenceDate?: string
): string {
  const meta = TAB_METADATA[activeTab] || TAB_METADATA.dashboard;
  const datePart = (referenceDate || new Date().toISOString().slice(0, 10))
    .trim()
    .replace(/[^0-9-]/g, '');
  const safeDate = datePart || '2026-10-29';
  return `ZSB_AQUATICS_${meta.slug}_${safeDate}.pdf`;
}

/**
 * Detects column alignment from header label text.
 */
export function inferColumnAlignment(headerLabel: string): 'left' | 'center' | 'right' {
  const upper = (headerLabel || '').trim().toUpperCase();
  if (
    upper === 'SL' ||
    upper === '#' ||
    upper === 'NO' ||
    upper === 'RANK' ||
    upper === 'STATUS' ||
    upper === 'STATUS 地位' ||
    upper === 'UNIT' ||
    upper === 'BOX' ||
    upper.startsWith('BOX ') ||
    upper === 'DATE' ||
    upper.startsWith('DATE ') ||
    upper === 'PACKING DATE'
  ) {
    return 'center';
  }
  if (
    upper.includes('AMOUNT') ||
    upper.includes('TOTAL') ||
    upper.includes('RATE') ||
    upper.includes('QTY') ||
    upper.includes('QUANTITY') ||
    upper.includes('WEIGHT') ||
    upper.includes('DEBIT') ||
    upper.includes('CREDIT') ||
    upper.includes('BALANCE') ||
    upper.includes('RMB') ||
    upper.includes('BDT') ||
    upper.includes('TK') ||
    upper.includes('PROFIT') ||
    upper.includes('COST') ||
    upper.includes('VALUE') ||
    upper.includes('MARGIN') ||
    upper.includes('SHARE') ||
    upper.includes('PAID') ||
    upper.includes('PREVIOUS') ||
    upper.includes('OUTFLOW') ||
    upper.includes('REVENUE')
  ) {
    return 'right';
  }
  return 'left';
}

const IGNORED_COLUMN_HEADERS = new Set([
  '',
  'ACTION',
  'ACTIONS',
  'SELECT',
  'PRINT',
  'DELETE',
  'DEL',
  'CLR',
  'CLEAR',
  'EDIT',
  'QR',
  'QR CODE',
  'OPTIONS',
  'REMOVE',
]);

/**
 * Converts live DOM table structures extracted from the active view into normalized GlobalTableSections.
 * Automatically strips action/button columns and blank template rows.
 */
export function convertExtractedDomTablesToSections(
  domTables: ExtractedDomTable[],
  defaultTitle: string = 'Current View Table Data'
): GlobalTableSection[] {
  if (!Array.isArray(domTables) || domTables.length === 0) return [];

  const sections: GlobalTableSection[] = [];

  domTables.forEach((tbl, idx) => {
    const rawHeaders = Array.isArray(tbl.headers) ? tbl.headers : [];
    if (rawHeaders.length === 0) return;

    // Identify valid data column indices (skipping pure action/checkbox columns)
    const keptColumnIndices: number[] = [];
    const columns: GlobalTableColumn[] = [];

    rawHeaders.forEach((rawH, colIdx) => {
      const cleaned = (rawH || '').replace(/\s+/g, ' ').trim();
      const upper = cleaned.toUpperCase();
      if (colIdx === 0 && cleaned === '') {
        // Checkbox column at index 0
        return;
      }
      if (IGNORED_COLUMN_HEADERS.has(upper)) {
        return;
      }
      keptColumnIndices.push(colIdx);
      columns.push({
        key: `col_${colIdx}`,
        label: cleaned || `COL ${colIdx + 1}`,
        align: inferColumnAlignment(cleaned),
      });
    });

    if (columns.length === 0) return;

    // Filter out empty template rows or "no records" placeholder rows
    const validRows: Record<string, string | number>[] = [];
    (tbl.rows || []).forEach((rawRow) => {
      if (!Array.isArray(rawRow) || rawRow.length === 0) return;

      const projected = keptColumnIndices.map((colIdx) =>
        (rawRow[colIdx] ?? '').replace(/\s+/g, ' ').trim()
      );

      // Check if row has meaningful non-zero / non-empty content beyond a serial number in col 0
      const meaningfulCells = projected.filter((cell, i) => {
        if (!cell || cell === '-' || cell === '—') return false;
        if (i === 0 && /^\d+$/.test(cell)) return false;
        // Ignore pure zero placeholders on blank entry rows if other text columns are empty
        if (/^(0|0\.00|TK\s*0\.00|¥0\.00|RMB\s*0\.00|0\s*KG)$/i.test(cell)) return false;
        return true;
      });

      if (meaningfulCells.length === 0) return;

      const rowObj: Record<string, string | number> = {};
      columns.forEach((col, i) => {
        rowObj[col.key] = projected[i] ?? '';
      });
      validRows.push(rowObj);
    });

    if (validRows.length === 0) return;

    const footerRows: { cells: GlobalTableFooterCell[] }[] = [];
    if (Array.isArray(tbl.footers)) {
      tbl.footers.forEach((fRow) => {
        const cleanedCells = fRow
          .map((c) => (c || '').replace(/\s+/g, ' ').trim())
          .filter((_, i) => keptColumnIndices.includes(i) || fRow.length < rawHeaders.length);
        if (cleanedCells.some(Boolean)) {
          footerRows.push({
            cells: cleanedCells.map((val, cIdx) => ({
              value: val,
              align: cIdx === 0 ? 'left' : 'right',
              tone: 'default',
            })),
          });
        }
      });
    }

    const fallbackSectionTitle =
      domTables.length === 1 ? defaultTitle : `${defaultTitle} — Table ${idx + 1}`;
    const resolvedTitle =
      tbl.title && !/^Table\s+\d+$/i.test(tbl.title.trim())
        ? tbl.title
        : fallbackSectionTitle;

    sections.push({
      id: `dom-table-${idx + 1}`,
      title: resolvedTitle,
      subtitle: `${validRows.length} Record(s)`,
      columns,
      rows: validRows,
      footerRows: footerRows.length > 0 ? footerRows : undefined,
    });
  });

  return sections;
}

/**
 * Extracts visible HTML <table> data from a live DOM container (browser environment).
 * Safely converts live <input> and <select> elements into their current displayed values.
 */
export function extractLiveDomTablesFromContainer(
  container: HTMLElement | null
): ExtractedDomTable[] {
  if (!container || typeof document === 'undefined') return [];

  const tables = Array.from(container.querySelectorAll('table'));
  const results: ExtractedDomTable[] = [];

  const extractCellText = (cell: Element): string => {
    const clone = cell.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-export-ignore="true"], button, svg').forEach((n) => n.remove());

    const liveInputs = Array.from(cell.querySelectorAll('input, select, textarea'));
    const clonedInputs = Array.from(clone.querySelectorAll('input, select, textarea'));

    clonedInputs.forEach((clonedCtrl, idx) => {
      const liveCtrl = liveInputs[idx] as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | undefined;
      let val = '';
      if (liveCtrl) {
        if (liveCtrl instanceof HTMLInputElement && liveCtrl.type === 'checkbox') {
          val = '';
        } else if (liveCtrl instanceof HTMLSelectElement) {
          const selectedOpt = liveCtrl.options[liveCtrl.selectedIndex];
          val = selectedOpt ? selectedOpt.text : liveCtrl.value;
        } else {
          val = liveCtrl.value || '';
        }
      }
      const span = document.createElement('span');
      span.textContent = val ? ` ${val} ` : '';
      clonedCtrl.replaceWith(span);
    });

    // Ensure block-level child divs inside a cell are separated by a space
    clone.querySelectorAll('div').forEach((divEl) => {
      divEl.insertAdjacentText('afterend', ' ');
    });

    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  tables.forEach((table) => {
    // Skip tables inside hidden modals or print containers
    if (table.closest('#printable-modal-backdrop, #global-pdf-export-host')) {
      return;
    }

    // Find nearest section heading if available
    let sectionTitle = '';
    const parentCard = table.closest('section, .rounded-xl, .rounded-lg, .border');
    if (parentCard) {
      const heading = parentCard.querySelector('h2, h3, h4');
      if (heading && heading.textContent) {
        sectionTitle = heading.textContent.replace(/\s+/g, ' ').trim();
      }
    }

    const headerCells = Array.from(table.querySelectorAll('thead tr th, thead tr td'));
    const headers = headerCells.map((th) => extractCellText(th));
    if (headers.length === 0) return;

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const rows: string[][] = [];

    bodyRows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td, th'));
      if (cells.length <= 1) return; // Skip colspan empty state row
      rows.push(cells.map((td) => extractCellText(td)));
    });

    if (rows.length === 0) return;

    const footerTrs = Array.from(table.querySelectorAll('tfoot tr'));
    const footers: string[][] = [];
    footerTrs.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td, th'));
      if (cells.length === 0) return;
      const expandedRow: string[] = [];
      cells.forEach((td) => {
        const text = extractCellText(td);
        const span = Math.max(1, Number((td as HTMLTableCellElement).colSpan) || 1);
        for (let s = 0; s < span - 1; s++) {
          expandedRow.push('');
        }
        expandedRow.push(text);
      });
      footers.push(expandedRow);
    });

    results.push({
      title: sectionTitle,
      headers,
      rows,
      footers: footers.length > 0 ? footers : undefined,
    });
  });

  return results;
}

/**
 * Builds the complete, structured GlobalViewTableReport for the current active view.
 */
export function buildGlobalViewTableReport(
  input: GlobalViewReportInput
): GlobalViewTableReport {
  const {
    activeTab,
    companyProfile,
    purchases = [],
    packings = [],
    payments = [],
    otherCosts = [],
    supplierCredits = [],
    packingDraft = null,
    dropdownOptions,
    domTables,
    referenceDate,
  } = input;

  const meta = TAB_METADATA[activeTab] || TAB_METADATA.dashboard;
  const currency = companyProfile?.currency || 'TK';
  const rmbRate = Number(companyProfile?.rmbExchangeRate) || 16.5;
  const generatedDate = referenceDate || new Date().toISOString().slice(0, 10);
  const filename = formatGlobalViewPdfFilename(activeTab, generatedDate);

  const pl = calculateProfitLoss(purchases, packings, payments, otherCosts, rmbRate);
  const allPackings = collectPackingManifestRecords(packings, packingDraft);

  const buildPurchaseSection = (
    records: PurchaseRecord[],
    title: string = 'Purchase Challan / Bill Ledger'
  ): GlobalTableSection => {
    const totalQty = records.reduce((s, r) => s + (Number(r.totalQty) || 0), 0);
    const totalBill = records.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
    const totalPaid = records.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
    const totalBal = records.reduce((s, r) => s + (Number(r.balance) || 0), 0);

    return {
      id: 'purchase-ledger',
      title,
      subtitle: `${records.length} Purchase Challan Record(s)`,
      columns: [
        { key: 'sl', label: 'SL', align: 'center' },
        { key: 'invoiceNumber', label: 'INVOICE NO', align: 'left' },
        { key: 'date', label: 'DATE', align: 'center' },
        { key: 'supplier', label: 'SUPPLIER NAME', align: 'left' },
        { key: 'itemsSummary', label: 'ITEMS / GRADES', align: 'left' },
        { key: 'totalQty', label: 'TOTAL QTY (KG)', align: 'right' },
        { key: 'totalAmount', label: `BILL AMOUNT (${currency})`, align: 'right' },
        { key: 'paidAmount', label: `PAID (${currency})`, align: 'right' },
        { key: 'balance', label: `BALANCE (${currency})`, align: 'right' },
      ],
      rows: records.map((rec, i) => ({
        sl: i + 1,
        invoiceNumber: rec.invoiceNumber,
        date: formatDate(rec.date),
        supplier: rec.description,
        itemsSummary:
          Array.isArray(rec.items) && rec.items.length > 0
            ? rec.items.map((it) => `${it.item} (${it.quantity})`).join(', ')
            : '-',
        totalQty: `${(Number(rec.totalQty) || 0).toLocaleString('en-US')} KG`,
        totalAmount: formatCurrency(rec.totalAmount, ''),
        paidAmount: formatCurrency(rec.paidAmount, ''),
        balance: formatCurrency(rec.balance, ''),
      })),
      footerRows: [
        {
          cells: [
            { value: 'GRAND TOTAL', colSpan: 5, align: 'right' },
            { value: `${totalQty.toLocaleString('en-US')} KG`, align: 'right', tone: 'blue' },
            { value: formatCurrency(totalBill, currency), align: 'right', tone: 'default' },
            { value: formatCurrency(totalPaid, currency), align: 'right', tone: 'emerald' },
            { value: formatCurrency(totalBal, currency), align: 'right', tone: 'rose' },
          ],
        },
      ],
    };
  };

  const buildPackingSection = (
    records: PackingRecord[],
    title: string = 'Export Air Packing List Ledger'
  ): GlobalTableSection => {
    const totalBoxes = records.reduce((s, r) => s + (Number(r.totalBox) || 0), 0);
    const totalWeight = records.reduce((s, r) => s + (Number(r.totalWeight) || 0), 0);
    const totalRmb = records.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
    const totalBdt = records.reduce((s, r) => {
      const rate = Number(r.rmbRate) > 0 ? Number(r.rmbRate) : rmbRate;
      return s + calculatePackingTotalAmountBDT(Number(r.totalAmount) || 0, rate);
    }, 0);

    return {
      id: 'packing-ledger',
      title,
      subtitle: `${records.length} Export Consignment(s)`,
      columns: [
        { key: 'sl', label: 'SL', align: 'center' },
        { key: 'invoiceNumber', label: 'PACKING NO', align: 'left' },
        { key: 'packingDate', label: 'DATE', align: 'center' },
        { key: 'shippingMark', label: 'SHIPPING MARK', align: 'left' },
        { key: 'flight', label: 'FLIGHT', align: 'left' },
        { key: 'destination', label: 'DESTINATION', align: 'left' },
        { key: 'totalBox', label: 'BOX', align: 'center' },
        { key: 'totalWeight', label: 'WEIGHT (KG)', align: 'right' },
        { key: 'totalAmountRmb', label: 'VALUE (RMB)', align: 'right' },
        { key: 'totalAmountBdt', label: `TOTAL (${currency})`, align: 'right' },
        { key: 'status', label: 'STATUS', align: 'center' },
      ],
      rows: records.map((rec, i) => {
        const rate = Number(rec.rmbRate) > 0 ? Number(rec.rmbRate) : rmbRate;
        const bdtVal = calculatePackingTotalAmountBDT(Number(rec.totalAmount) || 0, rate);
        return {
          sl: i + 1,
          invoiceNumber: rec.invoiceNumber,
          packingDate: formatDate(rec.packingDate),
          shippingMark: rec.shippingMark,
          flight: rec.flight || '-',
          destination: rec.destination || '-',
          totalBox: rec.totalBox,
          totalWeight: `${rec.totalWeight} KG`,
          totalAmountRmb: formatRMB(rec.totalAmount),
          totalAmountBdt: formatCurrency(bdtVal, ''),
          status: rec.exporterStatus || rec.paymentStatus || 'REPORT',
        };
      }),
      footerRows: [
        {
          cells: [
            { value: 'GRAND TOTAL', colSpan: 6, align: 'right' },
            { value: `${totalBoxes} Boxes`, align: 'center', tone: 'blue' },
            { value: `${Math.round(totalWeight * 100) / 100} KG`, align: 'right', tone: 'emerald' },
            { value: formatRMB(totalRmb), align: 'right', tone: 'amber' },
            { value: formatCurrency(totalBdt, currency), align: 'right', tone: 'default' },
            { value: '', align: 'center' },
          ],
        },
      ],
    };
  };

  const buildPaymentSection = (
    records: PaymentRecord[],
    title: string = 'Payment Voucher Ledger'
  ): GlobalTableSection => {
    const totalDebit = records.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
    const totalPaid = records.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
    const totalBal = records.reduce((s, r) => s + (Number(r.balance) || 0), 0);

    return {
      id: 'payment-ledger',
      title,
      subtitle: `${records.length} Payment Voucher Record(s)`,
      columns: [
        { key: 'sl', label: 'SL', align: 'center' },
        { key: 'invoiceNumber', label: 'VOUCHER NO', align: 'left' },
        { key: 'date', label: 'DATE', align: 'center' },
        { key: 'category', label: 'CATEGORY', align: 'center' },
        { key: 'party', label: 'SUPPLIER / SHIPPING MARK', align: 'left' },
        { key: 'totalAmount', label: 'DEBIT / BILL', align: 'right' },
        { key: 'paidAmount', label: 'CREDIT / PAID', align: 'right' },
        { key: 'balance', label: 'BALANCE', align: 'right' },
        { key: 'status', label: 'STATUS', align: 'center' },
      ],
      rows: records.map((rec, i) => {
        const cat = classifyPaymentCategory(rec);
        const unit = cat === 'exporter' ? 'RMB' : currency;
        return {
          sl: i + 1,
          invoiceNumber: rec.invoiceNumber,
          date: formatDate(rec.date),
          category: cat.toUpperCase(),
          party: rec.description || rec.shippingMark || '-',
          totalAmount: `${unit} ${(Number(rec.totalAmount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          paidAmount: `${unit} ${(Number(rec.paidAmount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          balance: `${unit} ${(Number(rec.balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          status: rec.status || 'PAID',
        };
      }),
      footerRows: [
        {
          cells: [
            { value: 'TOTALS', colSpan: 5, align: 'right' },
            { value: formatCurrency(totalDebit, ''), align: 'right', tone: 'default' },
            { value: formatCurrency(totalPaid, ''), align: 'right', tone: 'emerald' },
            { value: formatCurrency(totalBal, ''), align: 'right', tone: 'purple' },
            { value: '', align: 'center' },
          ],
        },
      ],
    };
  };

  let metadataGrid: { label: string; value: string }[] = [
    { label: 'ACTIVE WORKSHEET', value: `${meta.viewLabel} (${meta.sheetReference})` },
    { label: 'REPORT DATE', value: formatDate(generatedDate) },
    { label: 'EXCHANGE RATE', value: `1 RMB = ${rmbRate} ${currency}` },
    {
      label: 'TOTAL RECORDS',
      value: `${purchases.length + packings.length + payments.length + otherCosts.length} Entries`,
    },
  ];

  let stateSections: GlobalTableSection[] = [];
  let exporterSlipPayload: GlobalViewTableReport['exporterSlipPayload'] = undefined;

  switch (activeTab) {
    case 'dashboard': {
      metadataGrid = [
        { label: 'TOTAL PURCHASES', value: formatCurrency(pl.totalPurchasing, currency) },
        { label: 'TOTAL EXPORT VALUE', value: formatCurrency(pl.totalExportValue, currency) },
        { label: 'EXPORT WEIGHT', value: `${pl.totalWeightExported} KG` },
        { label: 'NET PROFIT', value: formatCurrency(pl.netProfit, currency) },
      ];
      stateSections = [
        buildPurchaseSection(purchases.slice(0, 10), 'Recent Purchase Challans (Dashboard Rollup)'),
        buildPackingSection(allPackings.slice(0, 10), 'Recent Export Packing Manifests'),
      ];
      break;
    }

    case 'purchase_form': {
      const latestPurchase = purchases[0];
      const itemRowsSection: GlobalTableSection | null = latestPurchase
        ? {
            id: 'latest-purchase-items',
            title: `Purchase Challan Line Items — ${latestPurchase.invoiceNumber} (${latestPurchase.description})`,
            subtitle: `Invoice Date: ${formatDate(latestPurchase.date)} | Contact: ${latestPurchase.contactNumber || '-'}`,
            columns: [
              { key: 'sl', label: 'SL', align: 'center' },
              { key: 'item', label: 'ITEM / FISH GRADE', align: 'left' },
              { key: 'quantity', label: 'QUANTITY (KG)', align: 'right' },
              { key: 'rate', label: `RATE (${currency})`, align: 'right' },
              { key: 'totalAmount', label: `TOTAL AMOUNT (${currency})`, align: 'right' },
            ],
            rows: (latestPurchase.items || []).map((it, i) => ({
              sl: i + 1,
              item: it.item,
              quantity: it.quantity,
              rate: formatCurrency(it.rate, ''),
              totalAmount: formatCurrency(it.totalAmount, ''),
            })),
            footerRows: [
              {
                cells: [
                  { value: 'CHALLAN TOTAL', colSpan: 2, align: 'right' },
                  { value: `${latestPurchase.totalQty} KG`, align: 'right', tone: 'blue' },
                  { value: 'CLOSING BALANCE:', align: 'right' },
                  {
                    value: formatCurrency(latestPurchase.balance, currency),
                    align: 'right',
                    tone: 'rose',
                  },
                ],
              },
            ],
          }
        : null;

      stateSections = [
        ...(itemRowsSection ? [itemRowsSection] : []),
        buildPurchaseSection(purchases, 'Saved Purchase Challan / Bill History'),
      ];
      break;
    }

    case 'packing_form': {
      const targetPacking = allPackings[0];
      const packingItemsSection: GlobalTableSection | null = targetPacking
        ? {
            id: 'packing-manifest-items',
            title: `Export Packing Manifest Items — ${targetPacking.invoiceNumber} (Mark: ${targetPacking.shippingMark})`,
            subtitle: `Flight: ${targetPacking.flight || '-'} | Destination: ${targetPacking.destination || '-'} | Date: ${formatDate(targetPacking.packingDate)}`,
            columns: [
              { key: 'sl', label: 'SL', align: 'center' },
              { key: 'item', label: 'ITEM / SIZE GRADE', align: 'left' },
              { key: 'box', label: 'BOX', align: 'center' },
              { key: 'weight', label: 'WEIGHT/BOX (KG)', align: 'right' },
              { key: 'totalWeight', label: 'TOTAL WEIGHT (KG)', align: 'right' },
              { key: 'unit', label: 'UNIT', align: 'center' },
              { key: 'rate', label: 'RATE (RMB)', align: 'right' },
              { key: 'amount', label: 'AMOUNT (RMB)', align: 'right' },
            ],
            rows: (targetPacking.items || []).map((it, i) => ({
              sl: i + 1,
              item: it.item,
              box: it.box,
              weight: it.weight,
              totalWeight: `${it.totalWeight} KG`,
              unit: it.unit || 'KG',
              rate: formatRMB(it.rate),
              amount: formatRMB(it.amount),
            })),
            footerRows: [
              {
                cells: [
                  { value: 'MANIFEST TOTALS', colSpan: 2, align: 'right' },
                  { value: `${targetPacking.totalBox} Boxes`, align: 'center', tone: 'blue' },
                  { value: '', align: 'right' },
                  {
                    value: `${targetPacking.totalWeight} KG`,
                    align: 'right',
                    tone: 'emerald',
                  },
                  { value: 'TOTAL RMB:', colSpan: 2, align: 'right' },
                  {
                    value: formatRMB(targetPacking.totalAmount),
                    align: 'right',
                    tone: 'amber',
                  },
                ],
              },
            ],
          }
        : null;

      stateSections = [
        ...(packingItemsSection ? [packingItemsSection] : []),
        buildPackingSection(allPackings, 'Saved Export Packing Manifest Ledger'),
      ];
      break;
    }

    case 'payment_form': {
      const supplierPayments = payments.filter(
        (pm) => classifyPaymentCategory(pm) === 'supplier'
      );
      const creditsSection: GlobalTableSection = {
        id: 'supplier-credits-table',
        title: 'Supplier Credit Notes & Rebate Balance Table',
        subtitle: `${supplierCredits.length} Credit Note(s)`,
        columns: [
          { key: 'sl', label: 'SL', align: 'center' },
          { key: 'creditNoteNumber', label: 'CREDIT NOTE NO', align: 'left' },
          { key: 'date', label: 'DATE', align: 'center' },
          { key: 'supplierName', label: 'SUPPLIER', align: 'left' },
          { key: 'reason', label: 'REASON', align: 'left' },
          { key: 'amount', label: `ISSUED (${currency})`, align: 'right' },
          { key: 'appliedAmount', label: `APPLIED (${currency})`, align: 'right' },
          { key: 'remainingAmount', label: `AVAILABLE (${currency})`, align: 'right' },
          { key: 'status', label: 'STATUS', align: 'center' },
        ],
        rows: supplierCredits.map((cn, i) => ({
          sl: i + 1,
          creditNoteNumber: cn.creditNoteNumber,
          date: formatDate(cn.date),
          supplierName: cn.supplierName,
          reason: cn.reason,
          amount: formatCurrency(cn.amount, ''),
          appliedAmount: formatCurrency(cn.appliedAmount, ''),
          remainingAmount: formatCurrency(cn.remainingAmount, ''),
          status: cn.status,
        })),
      };

      stateSections = [
        buildPaymentSection(supplierPayments, 'Supplier Payment Voucher Ledger'),
        ...(supplierCredits.length > 0 ? [creditsSection] : []),
      ];
      break;
    }

    case 'exporter_payment_form': {
      const historyRows = buildExporterRecordHistory(allPackings, payments, {
        shippingMark: 'ALL',
        packingDate: 'ALL',
        rmbExchangeRate: rmbRate,
      });
      const historyTotals = calculateExporterHistoryTotals(historyRows);

      metadataGrid = [
        { label: 'TOTAL HISTORY RECORDS', value: `${historyTotals.recordCount} Shipments` },
        { label: 'TOTAL DEBIT (RMB)', value: formatRMB(historyTotals.totalDebit) },
        { label: 'TOTAL CREDIT (RMB)', value: formatRMB(historyTotals.totalCredit) },
        { label: 'NET BALANCE (RMB)', value: formatRMB(historyTotals.totalBalance) },
      ];

      stateSections = [
        {
          id: 'exporter-record-history',
          title: 'Exporter Payment Data Entry & Record History (Debit, Credit, Balance & Status)',
          subtitle: `Complete Shipment & Settlement History (${historyTotals.recordCount} Records)`,
          columns: [
            { key: 'sl', label: 'SL', align: 'center' },
            { key: 'date', label: 'PACKING DATE', align: 'center' },
            { key: 'shippingMark', label: 'SHIPPING MARK', align: 'left' },
            { key: 'flight', label: 'FLIGHT', align: 'left' },
            { key: 'box', label: 'BOX', align: 'center' },
            { key: 'weightKg', label: 'WEIGHT (KG)', align: 'right' },
            { key: 'description', label: 'PARTICULARS / REF', align: 'left' },
            { key: 'debitAmount', label: 'DEBIT (RMB)', align: 'right' },
            { key: 'creditAmount', label: 'CREDIT (RMB)', align: 'right' },
            { key: 'balance', label: 'BALANCE (RMB)', align: 'right' },
            { key: 'status', label: 'STATUS', align: 'center' },
          ],
          rows: historyRows.map((r, i) => ({
            sl: i + 1,
            date: formatDate(r.date),
            shippingMark: r.shippingMark || '-',
            flight: r.flight || '-',
            box: r.box,
            weightKg: `${r.weightKg} KG`,
            description: r.description,
            debitAmount: formatRMB(r.debitAmount),
            creditAmount: formatRMB(r.creditAmount),
            balance: formatRMB(r.balance),
            status: r.status || 'REPORT',
          })),
          footerRows: [
            {
              cells: [
                { value: 'GRAND TOTAL', colSpan: 4, align: 'right' },
                { value: `${historyTotals.totalBox}`, align: 'center', tone: 'blue' },
                {
                  value: `${historyTotals.totalWeightKg} KG`,
                  align: 'right',
                  tone: 'emerald',
                },
                { value: 'TOTALS (RMB):', align: 'right' },
                {
                  value: formatRMB(historyTotals.totalDebit),
                  align: 'right',
                  tone: 'default',
                },
                {
                  value: formatRMB(historyTotals.totalCredit),
                  align: 'right',
                  tone: 'emerald',
                },
                {
                  value: formatRMB(historyTotals.totalBalance),
                  align: 'right',
                  tone: 'purple',
                },
                {
                  value: `PAID: ${historyTotals.paidCount}`,
                  align: 'center',
                  tone: 'emerald',
                },
              ],
            },
          ],
        },
      ];
      break;
    }

    case 'exporter_payment_slip': {
      const slipRows = buildExporterPaymentSlipRows(allPackings, payments, {
        shippingMark: 'ALL',
        packingDate: 'ALL',
        rmbExchangeRate: rmbRate,
      });
      const slipTotals = calculateExporterSlipTotals(slipRows);

      exporterSlipPayload = {
        shippingMark: 'ALL',
        packingDate: 'ALL',
        rows: slipRows,
        totals: slipTotals,
      };

      stateSections = [
        {
          id: 'exporter-payment-slip-table',
          title: 'PAYMENT SLIP 付款单',
          subtitle: `${slipRows.length} Consignment Row(s)`,
          columns: [
            { key: 'date', label: 'DATE 发货日期', align: 'center' },
            { key: 'flight', label: 'FLIGHT 航班名称', align: 'center' },
            { key: 'mark', label: 'MARK 标记', align: 'center' },
            { key: 'box', label: 'BOX 箱数', align: 'center' },
            { key: 'weightKg', label: 'WEIGHT /KG 重量', align: 'right' },
            { key: 'amount', label: 'AMOUNT 待结金额', align: 'right' },
            { key: 'status', label: 'STATUS 地位', align: 'center' },
          ],
          rows: slipRows.map((r) => ({
            date: formatDate(r.date),
            flight: r.flight || '-',
            mark: r.mark || '-',
            box: r.box,
            weightKg: r.weightKg,
            amount: formatRMB(r.amount),
            status: r.status,
          })),
          footerRows: [
            {
              cells: [
                { value: 'GRAND TOTAL 累计', colSpan: 3, align: 'center' },
                { value: `${slipTotals.totalBox}`, align: 'center', tone: 'blue' },
                { value: `${slipTotals.totalWeightKg}`, align: 'right', tone: 'emerald' },
                { value: formatRMB(slipTotals.totalAmount), align: 'right', tone: 'amber' },
                { value: '', align: 'center' },
              ],
            },
          ],
        },
      ];
      break;
    }

    case 'profit_loss': {
      const monthlyReport = calculateAllMonthlyReports(
        purchases,
        allPackings,
        otherCosts,
        rmbRate
      );
      const topSuppliers = getTopSuppliersByVolume(purchases, 5, 'all');

      metadataGrid = [
        { label: 'GROSS EXPORT REVENUE', value: formatCurrency(pl.totalExportValue, currency) },
        { label: 'TOTAL PURCHASE COST', value: formatCurrency(pl.totalPurchasing, currency) },
        { label: 'OPERATING EXPENSES', value: formatCurrency(pl.totalOtherCosting, currency) },
        {
          label: 'NET BUSINESS PROFIT',
          value: `${formatCurrency(pl.netProfit, currency)} (${pl.marginPercent}%)`,
        },
      ];

      stateSections = [
        {
          id: 'profit-loss-monthly-table',
          title: 'Monthly Export Revenue, Purchase Cost & Net Profit Statement',
          subtitle: `${monthlyReport.items.length} Active Accounting Month(s)`,
          columns: [
            { key: 'monthLabel', label: 'MONTH', align: 'left' },
            { key: 'purchaseVolume', label: 'PURCHASE QTY (KG)', align: 'right' },
            { key: 'purchaseValue', label: `PURCHASE COST (${currency})`, align: 'right' },
            { key: 'exportWeight', label: 'EXPORT WEIGHT (KG)', align: 'right' },
            { key: 'exportValueRMB', label: 'EXPORT (RMB)', align: 'right' },
            { key: 'exportValueBDT', label: `EXPORT VALUE (${currency})`, align: 'right' },
            { key: 'otherCosts', label: `OTHER COSTS (${currency})`, align: 'right' },
            { key: 'netProfit', label: `NET PROFIT (${currency})`, align: 'right' },
          ],
          rows: monthlyReport.items.map((m) => ({
            monthLabel: m.monthLabel,
            purchaseVolume: `${m.purchaseVolume} KG`,
            purchaseValue: formatCurrency(m.purchaseValue, ''),
            exportWeight: `${m.exportWeight} KG`,
            exportValueRMB: formatRMB(m.exportValueRMB),
            exportValueBDT: formatCurrency(m.exportValueBDT, ''),
            otherCosts: formatCurrency(m.otherCosts, ''),
            netProfit: formatCurrency(m.netProfit, ''),
          })),
          footerRows: [
            {
              cells: [
                { value: 'CUMULATIVE TOTAL', align: 'left' },
                {
                  value: `${monthlyReport.totals.totalPurchaseVolume} KG`,
                  align: 'right',
                  tone: 'blue',
                },
                {
                  value: formatCurrency(monthlyReport.totals.totalPurchaseValue, currency),
                  align: 'right',
                  tone: 'rose',
                },
                {
                  value: `${monthlyReport.totals.totalExportWeight} KG`,
                  align: 'right',
                  tone: 'emerald',
                },
                {
                  value: formatRMB(monthlyReport.totals.totalExportValueRMB),
                  align: 'right',
                  tone: 'amber',
                },
                {
                  value: formatCurrency(monthlyReport.totals.totalExportValueBDT, currency),
                  align: 'right',
                  tone: 'emerald',
                },
                {
                  value: formatCurrency(monthlyReport.totals.totalOtherCosts, currency),
                  align: 'right',
                  tone: 'rose',
                },
                {
                  value: formatCurrency(monthlyReport.totals.totalNetProfit, currency),
                  align: 'right',
                  tone: 'emerald',
                },
              ],
            },
          ],
        },
        {
          id: 'top-suppliers-performance',
          title: 'Top 5 Suppliers Performance Ranking',
          columns: [
            { key: 'rank', label: 'RANK', align: 'center' },
            { key: 'supplierName', label: 'SUPPLIER NAME', align: 'left' },
            { key: 'invoiceCount', label: 'CHALLANS', align: 'center' },
            { key: 'totalVolume', label: 'VOLUME (KG)', align: 'right' },
            { key: 'avgRatePerUnit', label: `AVG RATE (${currency})`, align: 'right' },
            { key: 'totalAmount', label: `TOTAL VALUE (${currency})`, align: 'right' },
            { key: 'volumeSharePercent', label: 'SHARE %', align: 'right' },
          ],
          rows: topSuppliers.map((sup) => ({
            rank: `#${sup.rank}`,
            supplierName: sup.supplierName,
            invoiceCount: sup.invoiceCount,
            totalVolume: `${sup.totalVolume} KG`,
            avgRatePerUnit: formatCurrency(sup.avgRatePerUnit, ''),
            totalAmount: formatCurrency(sup.totalAmount, ''),
            volumeSharePercent: `${sup.volumeSharePercent}%`,
          })),
        },
        {
          id: 'operating-cost-ledger',
          title: 'Operating & Overhead Costing Breakdown',
          columns: [
            { key: 'sl', label: 'SL', align: 'center' },
            { key: 'date', label: 'DATE', align: 'center' },
            { key: 'category', label: 'COST CATEGORY', align: 'left' },
            { key: 'description', label: 'PARTICULARS', align: 'left' },
            { key: 'refInvoice', label: 'REF INVOICE', align: 'left' },
            { key: 'amount', label: `AMOUNT (${currency})`, align: 'right' },
          ],
          rows: otherCosts.map((c, i) => ({
            sl: i + 1,
            date: formatDate(c.date),
            category: c.category,
            description: c.description,
            refInvoice: c.refInvoice || '-',
            amount: formatCurrency(c.amount, ''),
          })),
        },
      ];
      break;
    }

    case 'purchase_db': {
      stateSections = [buildPurchaseSection(purchases, 'Master Purchase Database Ledger')];
      break;
    }

    case 'packing_db': {
      stateSections = [buildPackingSection(allPackings, 'Master Export Packing List Database')];
      break;
    }

    case 'payment_db': {
      stateSections = [buildPaymentSection(payments, 'Master Payment Voucher Database')];
      break;
    }

    case 'search_reports': {
      const monthlyReport = calculateAllMonthlyReports(
        purchases,
        allPackings,
        otherCosts,
        rmbRate
      );
      stateSections = [
        {
          id: 'consolidated-monthly-summary',
          title: 'Consolidated Monthly Exports & Purchases Summary Table',
          columns: [
            { key: 'monthLabel', label: 'MONTH', align: 'left' },
            { key: 'purchaseCount', label: 'BILLS', align: 'center' },
            { key: 'purchaseVolume', label: 'PURCHASE (KG)', align: 'right' },
            { key: 'purchaseValue', label: `PURCHASE (${currency})`, align: 'right' },
            { key: 'exportCount', label: 'SHIPMENTS', align: 'center' },
            { key: 'exportWeight', label: 'EXPORT (KG)', align: 'right' },
            { key: 'exportValueBDT', label: `EXPORT (${currency})`, align: 'right' },
            { key: 'netProfit', label: `NET PROFIT (${currency})`, align: 'right' },
          ],
          rows: monthlyReport.items.map((m) => ({
            monthLabel: m.monthLabel,
            purchaseCount: m.purchaseCount,
            purchaseVolume: `${m.purchaseVolume} KG`,
            purchaseValue: formatCurrency(m.purchaseValue, ''),
            exportCount: m.exportCount,
            exportWeight: `${m.exportWeight} KG`,
            exportValueBDT: formatCurrency(m.exportValueBDT, ''),
            netProfit: formatCurrency(m.netProfit, ''),
          })),
        },
        buildPurchaseSection(purchases, 'Filtered Purchase Transactions'),
        buildPackingSection(allPackings, 'Filtered Export Packing Transactions'),
        buildPaymentSection(payments, 'Filtered Payment Voucher Transactions'),
      ];
      break;
    }

    case 'settings': {
      const opts = dropdownOptions;
      const configRows: Record<string, string | number>[] = [
        {
          sl: 1,
          category: 'Company Name',
          count: 1,
          values: companyProfile.companyName,
        },
        {
          sl: 2,
          category: 'Corporate Address',
          count: 1,
          values: companyProfile.address,
        },
        {
          sl: 3,
          category: 'Managing Partner & Partner',
          count: 2,
          values: `${companyProfile.managingPartner} | ${companyProfile.partner}`,
        },
        {
          sl: 4,
          category: 'Currency & RMB Exchange Rate',
          count: 2,
          values: `Base: ${currency} | 1 RMB = ${rmbRate} ${currency}`,
        },
      ];

      if (opts) {
        const categories: { label: string; list: string[] }[] = [
          { label: 'Purchase Fish Grades', list: opts.purchaseItems || [] },
          { label: 'Registered Suppliers', list: opts.suppliers || [] },
          { label: 'Export Shipping Marks', list: opts.shippingMarks || [] },
          { label: 'Airlines / Flights', list: opts.flights || [] },
          { label: 'Export Destinations', list: opts.destinations || [] },
          { label: 'Registered Shippers', list: opts.shippers || [] },
          { label: 'Export Packing Sizes', list: opts.exportItems || [] },
          { label: 'Payment Statuses', list: opts.paymentStatuses || [] },
          { label: 'Costing Categories', list: opts.costingCategories || [] },
        ];
        categories.forEach((c, idx) => {
          configRows.push({
            sl: idx + 5,
            category: c.label,
            count: c.list.length,
            values: c.list.join(', '),
          });
        });
      }

      stateSections = [
        {
          id: 'settings-master-table',
          title: 'System Configuration & Master Dropdown Lists',
          columns: [
            { key: 'sl', label: 'SL', align: 'center' },
            { key: 'category', label: 'CONFIGURATION / MASTER LIST', align: 'left' },
            { key: 'count', label: 'ITEMS', align: 'center' },
            { key: 'values', label: 'CONFIGURED VALUES', align: 'left' },
          ],
          rows: configRows,
        },
      ];
      break;
    }
  }

  // If live DOM tables were extracted from the current view (e.g. reflecting active search/date filters),
  // convert them into sections. If valid DOM table sections exist and activeTab is not exporter_payment_slip,
  // use the live DOM sections first or fall back to stateSections when DOM tables have no populated rows.
  const domSections =
    domTables && domTables.length > 0 && activeTab !== 'exporter_payment_slip'
      ? convertExtractedDomTablesToSections(domTables, meta.documentTitle)
      : [];

  const finalSections = domSections.length > 0 ? domSections : stateSections;

  return {
    activeTab,
    viewLabel: meta.viewLabel,
    documentTitle: meta.documentTitle,
    documentBadge: meta.documentBadge,
    sheetReference: meta.sheetReference,
    generatedDate,
    filename,
    metadataGrid,
    sections: finalSections,
    exporterSlipPayload,
  };
}
