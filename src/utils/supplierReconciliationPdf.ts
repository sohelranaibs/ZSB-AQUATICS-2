import { jsPDF } from 'jspdf';
import { CompanyProfile } from '../types/index.ts';
import {
  formatCurrency,
  formatDate,
  formatDateImageStyle,
} from './calculations.ts';
import { SupplierRecordHistoryRow } from './supplierHistory.ts';
import { getCachedCompanyLogoDataUrl } from './pdfGenerator.ts';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  A4_PAD_CONTENT_TOP_Y_MM,
  A4_PAD_CONTENT_BOTTOM_Y_MM,
  drawPdfCompanyPadFrame,
} from './companyPadLayout.ts';

export interface SupplierReconciliationPdfInput {
  companyProfile: CompanyProfile;
  supplierFilter: string;
  fromDate: string;
  toDate: string;
  sortDirection: 'asc' | 'desc';
  rows: SupplierRecordHistoryRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    netEndingBalance: number;
  };
  todayIso?: string;
}

export interface SupplierReconciliationPdfRowData {
  sl: string;
  dateFormatted: string;
  supplierName: string;
  debitFormatted: string;
  creditFormatted: string;
  balanceFormatted: string;
}

export interface SupplierReconciliationPdfPayload {
  filename: string;
  companyName: string;
  address: string;
  contactLine: string;
  supplierLabel: string;
  periodLabel: string;
  orderLabel: string;
  netBalanceFormatted: string;
  totalDebitFormatted: string;
  totalCreditFormatted: string;
  rows: SupplierReconciliationPdfRowData[];
  entryCount: number;
}

export function buildSupplierReconciliationPdfPayload(
  input: SupplierReconciliationPdfInput
): SupplierReconciliationPdfPayload {
  const safeSupplier =
    input.supplierFilter === 'ALL'
      ? 'ALL_SUPPLIERS'
      : input.supplierFilter.replace(/[^a-zA-Z0-9_-]/g, '_');
  const todaySlug = input.todayIso || new Date().toISOString().slice(0, 10);
  const dateTag =
    input.fromDate || input.toDate
      ? `${input.fromDate || 'START'}_to_${input.toDate || 'END'}`
      : todaySlug;
  const filename = `ZSB_AQUATICS_SUPPLIER_RECONCILIATION_LEDGER_${safeSupplier}_${dateTag}.pdf`;

  const currency = input.companyProfile.currency || 'TK';
  const rows: SupplierReconciliationPdfRowData[] = input.rows.map((row, idx) => ({
    sl: String(idx + 1).padStart(2, '0'),
    dateFormatted: formatDateImageStyle(row.date),
    supplierName: (row.supplierName || '-').trim(),
    debitFormatted: row.debitAmount !== 0 ? formatCurrency(row.debitAmount, '').trim() : '',
    creditFormatted: row.creditAmount !== 0 ? formatCurrency(row.creditAmount, '').trim() : '',
    balanceFormatted: formatCurrency(row.balance, '').trim(),
  }));

  return {
    filename,
    companyName: input.companyProfile.companyName || 'ZSB AQUATICS',
    address: `Address: ${input.companyProfile.address || ''}`,
    contactLine: `Mobile: ${(input.companyProfile.mobiles || []).join(' , ')} | Email: ${
      input.companyProfile.email || 'zsbaquatics@gmail.com'
    }`,
    supplierLabel:
      input.supplierFilter === 'ALL' ? 'ALL SUPPLIERS' : input.supplierFilter,
    periodLabel: `${input.fromDate ? formatDate(input.fromDate) : 'All'} -> ${
      input.toDate ? formatDate(input.toDate) : 'Latest'
    }`,
    orderLabel: `${input.sortDirection === 'asc' ? 'Oldest First' : 'Newest First'} (${rows.length})`,
    netBalanceFormatted: formatCurrency(input.totals.netEndingBalance, currency).trim(),
    totalDebitFormatted: formatCurrency(input.totals.totalDebit, '').trim(),
    totalCreditFormatted: formatCurrency(input.totals.totalCredit, '').trim(),
    rows,
    entryCount: rows.length,
  };
}

function drawTableHeader(
  pdf: jsPDF,
  margin: number,
  y: number,
  colWidths: number[]
): number {
  const headerHeight = 8;
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);

  pdf.setFillColor(39, 62, 86); // #273E56
  pdf.rect(margin, y, totalWidth, headerHeight, 'F');

  pdf.setDrawColor(100, 116, 139);
  pdf.setLineWidth(0.2);

  let x = margin;
  const headers: { label: string; align: 'center' | 'left' | 'right' }[] = [
    { label: 'SL #', align: 'center' },
    { label: 'DATE', align: 'center' },
    { label: 'SUPPLIER NAME', align: 'left' },
    { label: 'DEBIT AMOUNT', align: 'right' },
    { label: 'CREDIT AMOUNT', align: 'right' },
    { label: 'BALANCE', align: 'right' },
  ];

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);

  headers.forEach((h, idx) => {
    const w = colWidths[idx];
    pdf.rect(x, y, w, headerHeight, 'S');
    const textY = y + 5.3;
    if (h.align === 'center') {
      pdf.text(h.label, x + w / 2, textY, { align: 'center' });
    } else if (h.align === 'right') {
      pdf.text(h.label, x + w - 2.5, textY, { align: 'right' });
    } else {
      pdf.text(h.label, x + 2.5, textY, { align: 'left' });
    }
    x += w;
  });

  return y + headerHeight;
}

export function buildSupplierReconciliationPdfDocument(
  input: SupplierReconciliationPdfInput
): { pdf: jsPDF; payload: SupplierReconciliationPdfPayload } {
  const payload = buildSupplierReconciliationPdfPayload(input);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = A4_PAGE_WIDTH_MM;
  const pageHeight = A4_PAGE_HEIGHT_MM;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  const contentTopY = A4_PAD_CONTENT_TOP_Y_MM + 2; // 36mm (below A4 Company Pad letterhead)
  const bottomSafeY = A4_PAD_CONTENT_BOTTOM_Y_MM - 2; // 278.5mm (above A4 Company Pad footer)

  // Column widths summing to 186mm
  const colWidths = [14, 26, 56, 30, 30, 30];

  const logoDataUrl = getCachedCompanyLogoDataUrl();

  // Start right below the Official A4 Company Pad letterhead band (which is drawn on EVERY page)
  let y = contentTopY;

  // Title Pill Banner
  const titleBadgeW = 94;
  const titleBadgeH = 6.8;
  pdf.setFillColor(39, 62, 86);
  pdf.roundedRect((pageWidth - titleBadgeW) / 2, y, titleBadgeW, titleBadgeH, 1.2, 1.2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('SUPPLIER ACCOUNT RECONCILIATION LEDGER', pageWidth / 2, y + 4.6, {
    align: 'center',
  });
  y += titleBadgeH + 3.5;

  // 4-Column Metadata Summary Box
  const metaH = 13;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(margin, y, contentWidth, metaH, 1.2, 1.2, 'FD');

  const metaCols = contentWidth / 4;
  const metaItems: { label: string; value: string; align: 'left' | 'right' }[] = [
    { label: 'SUPPLIER', value: payload.supplierLabel, align: 'left' },
    { label: 'DATE PERIOD', value: payload.periodLabel, align: 'left' },
    { label: 'ORDER / ENTRIES', value: payload.orderLabel, align: 'left' },
    { label: 'NET BALANCE', value: payload.netBalanceFormatted, align: 'right' },
  ];

  metaItems.forEach((item, idx) => {
    const baseX =
      item.align === 'right' ? margin + contentWidth - 3 : margin + idx * metaCols + 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(item.label, baseX, y + 4.3, { align: item.align });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(15, 23, 42);
    const maxW = metaCols - 5;
    const clipped = pdf.splitTextToSize(item.value, maxW)[0] || item.value;
    pdf.text(clipped, baseX, y + 9.8, { align: item.align });
  });

  y += metaH + 4;

  // Draw Table Header
  y = drawTableHeader(pdf, margin, y, colWidths);

  if (payload.rows.length === 0) {
    const emptyH = 12;
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, y, contentWidth, emptyH, 'S');
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      'No reconciliation records found for the selected filter criteria.',
      pageWidth / 2,
      y + 7.2,
      { align: 'center' }
    );
    y += emptyH;
  } else {
    payload.rows.forEach((row, idx) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      const supplierLines = pdf.splitTextToSize(row.supplierName, colWidths[2] - 5) as string[];
      const rowHeight = Math.max(6.8, supplierLines.length * 4 + 2.8);

      if (y + rowHeight > bottomSafeY) {
        pdf.addPage('a4', 'portrait');
        y = contentTopY;
        y = drawTableHeader(pdf, margin, y, colWidths);
      }

      if (idx % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentWidth, rowHeight, 'F');
      }

      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.18);

      let x = margin;
      const textY = y + 4.6;

      // SL #
      pdf.rect(x, y, colWidths[0], rowHeight, 'S');
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(row.sl, x + colWidths[0] / 2, textY, { align: 'center' });
      x += colWidths[0];

      // DATE
      pdf.rect(x, y, colWidths[1], rowHeight, 'S');
      pdf.setTextColor(30, 41, 59);
      pdf.text(row.dateFormatted, x + colWidths[1] / 2, textY, { align: 'center' });
      x += colWidths[1];

      // SUPPLIER NAME
      pdf.rect(x, y, colWidths[2], rowHeight, 'S');
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(supplierLines, x + 2.5, textY, { align: 'left' });
      x += colWidths[2];

      // DEBIT AMOUNT
      pdf.rect(x, y, colWidths[3], rowHeight, 'S');
      pdf.setFont('courier', 'bold');
      pdf.text(row.debitFormatted, x + colWidths[3] - 2.5, textY, { align: 'right' });
      x += colWidths[3];

      // CREDIT AMOUNT
      pdf.rect(x, y, colWidths[4], rowHeight, 'S');
      pdf.text(row.creditFormatted, x + colWidths[4] - 2.5, textY, { align: 'right' });
      x += colWidths[4];

      // BALANCE
      pdf.rect(x, y, colWidths[5], rowHeight, 'S');
      pdf.setTextColor(2, 6, 23);
      pdf.text(row.balanceFormatted, x + colWidths[5] - 2.5, textY, { align: 'right' });

      y += rowHeight;
    });

    // Totals Row
    const totalsH = 8;
    if (y + totalsH + 22 > bottomSafeY) {
      pdf.addPage('a4', 'portrait');
      y = contentTopY;
      y = drawTableHeader(pdf, margin, y, colWidths);
    }

    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y, contentWidth, totalsH, 'F');
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.25);

    const firstThreeW = colWidths[0] + colWidths[1] + colWidths[2];
    let x = margin;
    const totY = y + 5.3;

    pdf.rect(x, y, firstThreeW, totalsH, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`TOTALS (${payload.entryCount} ENTRIES):`, x + firstThreeW - 2.5, totY, {
      align: 'right',
    });
    x += firstThreeW;

    pdf.rect(x, y, colWidths[3], totalsH, 'S');
    pdf.setFont('courier', 'bold');
    pdf.text(payload.totalDebitFormatted, x + colWidths[3] - 2.5, totY, { align: 'right' });
    x += colWidths[3];

    pdf.rect(x, y, colWidths[4], totalsH, 'S');
    pdf.setTextColor(6, 95, 70);
    pdf.text(payload.totalCreditFormatted, x + colWidths[4] - 2.5, totY, { align: 'right' });
    x += colWidths[4];

    pdf.rect(x, y, colWidths[5], totalsH, 'S');
    pdf.setTextColor(2, 6, 23);
    pdf.text(payload.netBalanceFormatted, x + colWidths[5] - 2.5, totY, { align: 'right' });

    // Top bold rule on totals row
    pdf.setDrawColor(51, 65, 85);
    pdf.setLineWidth(0.45);
    pdf.line(margin, y, pageWidth - margin, y);

    y += totalsH;
  }

  // Signature Footer
  if (y + 22 > bottomSafeY) {
    pdf.addPage('a4', 'portrait');
    y = contentTopY + 4;
  }
  const sigY = y + 14;
  const sigColW = (contentWidth - 20) / 3;
  const sigLabels = ['Prepared By', 'Accounts & Audit', 'Managing Director'];
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.3);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(51, 65, 85);

  sigLabels.forEach((label, idx) => {
    const startX = margin + idx * (sigColW + 10);
    pdf.line(startX, sigY, startX + sigColW, sigY);
    pdf.text(label.toUpperCase(), startX + sigColW / 2, sigY + 4, { align: 'center' });
  });

  // Stamp Official A4 Company Pad letterhead, frame, watermark & Page X of Y footer on EVERY page
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawPdfCompanyPadFrame(pdf, {
      pageNumber: p,
      totalPages,
      profile: input.companyProfile,
      logoDataUrl,
      documentLabel: 'Supplier Reconciliation Ledger',
      exportDateIso: input.todayIso,
      drawWatermark: true,
    });
  }

  return { pdf, payload };
}

export function exportSupplierReconciliationLedgerPdf(
  input: SupplierReconciliationPdfInput
): { ok: boolean; filename: string } {
  const { payload, pdf } = buildSupplierReconciliationPdfDocument(input);
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__LAST_EXPORTED_PDF__ = {
      filename: payload.filename,
      elementId: 'supplier-reconciliation-ledger-pdf-canvas',
      paperSize: 'A4',
      widthMm: A4_PAGE_WIDTH_MM,
      heightMm: A4_PAGE_HEIGHT_MM,
      companyPadOnEveryPage: true,
      pageCount: pdf.getNumberOfPages(),
      timestamp: new Date().toISOString(),
    };
  }
  pdf.save(payload.filename);
  return { ok: true, filename: payload.filename };
}
