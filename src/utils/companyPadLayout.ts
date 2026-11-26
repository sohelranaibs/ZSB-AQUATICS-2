import type jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { CompanyProfile } from '../types/index.ts';
import { initialCompanyProfile } from '../context/initialData.ts';
import { getJsPdfImageFormat } from './pdfExportStyles.ts';

/**
 * Standard ISO A4 Paper Constants (210mm x 297mm) for PDF & Excel Company Pad Exports
 */
export const A4_PAGE_WIDTH_MM = 210;
export const A4_PAGE_HEIGHT_MM = 297;
export const A4_PAD_BORDER_INSET_MM = 6;
export const A4_CONTENT_MARGIN_X_MM = 10;
export const A4_CONTENT_WIDTH_MM = A4_PAGE_WIDTH_MM - A4_CONTENT_MARGIN_X_MM * 2; // 190mm
export const A4_PAD_HEADER_BOTTOM_Y_MM = 31.5;
export const A4_PAD_CONTENT_TOP_Y_MM = 34;
export const A4_PAD_FOOTER_TOP_Y_MM = 282.5;
export const A4_PAD_CONTENT_BOTTOM_Y_MM = 280.5;
export const A4_PAD_CONTENT_HEIGHT_MM = A4_PAD_CONTENT_BOTTOM_Y_MM - A4_PAD_CONTENT_TOP_Y_MM; // 246.5mm

/**
 * OOXML Paper Size code for ISO A4 (210mm x 297mm) per ECMA-376 ST_PaperSize.
 */
export const EXCEL_A4_PAPER_SIZE = 9;

/**
 * Number of rows reserved at the top of every exported Excel worksheet for the Company Pad letterhead.
 * Row 1: Company Name
 * Row 2: Tagline / Business Scope
 * Row 3: Office Address
 * Row 4: Contact Mobiles, Email & Website
 * Row 5: Report Title, Export Date & Official A4 Company Pad stamp
 * Row 6: Table Column Headers (also included in _xlnm.Print_Titles $1:$6 so every printed A4 page repeats pad + column headers)
 */
export const EXCEL_COMPANY_PAD_ROW_COUNT = 5;

export interface CompanyPadMetadata {
  companyName: string;
  tagline: string;
  address: string;
  mobilesText: string;
  email: string;
  website: string;
  contactLine: string;
  footerLeft: string;
  footerCenter: string;
  logoUrl?: string;
}

let activeCompanyPadProfile: Partial<CompanyProfile> | null = null;

/**
 * Registers the live CompanyProfile from AppContext so every PDF & Excel export
 * automatically reflects the user's current company name, address, phone, email, and website.
 */
export function setActiveCompanyPadProfile(profile: Partial<CompanyProfile> | null): void {
  activeCompanyPadProfile = profile ? { ...profile } : null;
}

export function getActiveCompanyPadProfile(): Partial<CompanyProfile> | null {
  return activeCompanyPadProfile;
}

/**
 * Resolves normalized Company Pad metadata from an optional profile override,
 * the active AppContext profile, or the default ZSB AQUATICS profile.
 */
export function resolveCompanyPadMetadata(
  profile?: Partial<CompanyProfile> | null
): CompanyPadMetadata {
  const src = profile || activeCompanyPadProfile || initialCompanyProfile;
  const companyName = (src.companyName || initialCompanyProfile.companyName || 'ZSB AQUATICS').trim();
  const address = (src.address || initialCompanyProfile.address || '').trim();
  const mobilesArr =
    Array.isArray(src.mobiles) && src.mobiles.length > 0
      ? src.mobiles.filter((m) => Boolean(m && String(m).trim()))
      : initialCompanyProfile.mobiles || [];
  const mobilesText = mobilesArr.join(', ');
  const email = (src.email || initialCompanyProfile.email || 'zsbaquatics@gmail.com').trim();
  const website = (src.website || initialCompanyProfile.website || 'www.zsbaquatics.com').trim();
  const tagline = 'LIVE SEAFOOD PROCUREMENT, AIR-FREIGHT EXPORT & INTERNATIONAL TRADE LEDGER';

  const contactParts: string[] = [];
  if (mobilesText) contactParts.push(`Mobile: ${mobilesText}`);
  if (email) contactParts.push(`Email: ${email}`);
  if (website) contactParts.push(`Web: ${website}`);
  const contactLine = contactParts.join('  |  ');

  const footerLeft = address ? `${companyName} · ${address}` : companyName;
  const footerCenter = [website, email].filter(Boolean).join(' · ');

  return {
    companyName,
    tagline,
    address,
    mobilesText,
    email,
    website,
    contactLine,
    footerLeft,
    footerCenter,
    logoUrl: src.logoUrl || initialCompanyProfile.logoUrl,
  };
}

function formatPadDateDDMMYYYY(isoOrDate?: string): string {
  if (isoOrDate && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    const [y, m, d] = isoOrDate.split('-');
    return `${d}/${m}/${y}`;
  }
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export interface DrawPdfCompanyPadOptions {
  pageNumber: number;
  totalPages: number;
  profile?: Partial<CompanyProfile> | null;
  logoDataUrl?: string | null;
  documentLabel?: string;
  exportDateIso?: string;
  drawWatermark?: boolean;
}

/**
 * Draws the official ZSB AQUATICS A4 Company Pad letterhead, corporate border frame,
 * optional centered logo watermark, and bottom company pad footer + page number on the CURRENT PDF page.
 * Safe to invoke on EVERY page (page 1 .. totalPages) of any jsPDF A4 portrait document.
 */
export function drawPdfCompanyPadFrame(
  pdf: jsPDF,
  options: DrawPdfCompanyPadOptions
): void {
  const pad = resolveCompanyPadMetadata(options.profile);
  const pageWidth = A4_PAGE_WIDTH_MM;
  const pageHeight = A4_PAGE_HEIGHT_MM;
  const inset = A4_PAD_BORDER_INSET_MM;
  const innerWidth = pageWidth - inset * 2; // 198mm
  const innerHeight = pageHeight - inset * 2; // 285mm
  const logoDataUrl = options.logoDataUrl || null;
  const logoFormat = logoDataUrl ? getJsPdfImageFormat(logoDataUrl) : 'PNG';
  const dateLabel = formatPadDateDDMMYYYY(options.exportDateIso);

  // 1. Subtle centered watermark (drawn only if requested and logo is available)
  if (options.drawWatermark && logoDataUrl) {
    try {
      const pdfAny = pdf as unknown as {
        saveGraphicsState?: () => void;
        restoreGraphicsState?: () => void;
        setGState?: (state: unknown) => void;
        GState?: new (opts: { opacity: number }) => unknown;
      };
      if (pdfAny.saveGraphicsState && pdfAny.setGState && pdfAny.GState) {
        pdfAny.saveGraphicsState();
        pdfAny.setGState(new pdfAny.GState({ opacity: 0.045 }));
        pdf.addImage(
          logoDataUrl,
          logoFormat,
          (pageWidth - 70) / 2,
          (pageHeight - 70) / 2 + 4,
          70,
          70,
          'zsb-pad-watermark-logo',
          'FAST'
        );
        pdfAny.restoreGraphicsState?.();
      }
    } catch {
      // Optional watermark gracefully skipped if graphics state unavailable
    }
  }

  // 2. Clean white header & footer masks so underlying sliced edges never bleed into the Company Pad bands
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, A4_PAD_CONTENT_TOP_Y_MM - 0.5, 'F');
  pdf.rect(0, A4_PAD_FOOTER_TOP_Y_MM - 0.5, pageWidth, pageHeight - A4_PAD_FOOTER_TOP_Y_MM + 1, 'F');

  // 3. Official A4 Company Pad Outer Border Frame (Navy hairline + Top Gold & Navy Accent Bars)
  pdf.setDrawColor(39, 62, 86); // #273E56
  pdf.setLineWidth(0.45);
  pdf.rect(inset, inset, innerWidth, innerHeight, 'S');

  // Top solid corporate navy accent strip + gold trim
  pdf.setFillColor(39, 62, 86);
  pdf.rect(inset, inset, innerWidth, 2.2, 'F');
  pdf.setFillColor(212, 175, 55); // Official Gold
  pdf.rect(inset, inset + 2.2, innerWidth, 0.85, 'F');

  // 4. Company Pad Header Content (y = 10mm .. 30.5mm)
  const headerTopY = inset + 4.2; // 10.2mm
  const logoSize = 15.2;
  const logoX = inset + 4.5;
  const logoY = headerTopY + 1.4;

  if (logoDataUrl) {
    try {
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(212, 175, 55);
      pdf.setLineWidth(0.55);
      pdf.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 0.8, 'FD');
      pdf.addImage(
        logoDataUrl,
        logoFormat,
        logoX + 0.6,
        logoY + 0.6,
        logoSize - 1.2,
        logoSize - 1.2,
        'zsb-pad-header-logo',
        'FAST'
      );
    } catch {
      // Fallback gracefully to text-only pad header
    }
  }

  // Right-side Official A4 Pad Stamp
  const stampX = pageWidth - inset - 4;
  pdf.setFillColor(241, 245, 249);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(stampX - 31, headerTopY + 1.5, 31, 13.8, 1.2, 1.2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.2);
  pdf.setTextColor(39, 62, 86);
  pdf.text('OFFICIAL COMPANY PAD', stampX - 15.5, headerTopY + 5.6, { align: 'center' });

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(180, 83, 9);
  pdf.text(`A4 · ${dateLabel}`, stampX - 15.5, headerTopY + 9.7, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.2);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`PAGE ${options.pageNumber} / ${options.totalPages}`, stampX - 15.5, headerTopY + 13.5, {
    align: 'center',
  });

  // Centered Company Name, Tagline, Address & Contact Lines
  const centerX = pageWidth / 2;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(17.5);
  pdf.setTextColor(39, 62, 86);
  pdf.text(pad.companyName.toUpperCase(), centerX, headerTopY + 6.2, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.6);
  pdf.setTextColor(180, 83, 9); // Rich corporate amber/gold readable on white
  pdf.text(pad.tagline, centerX, headerTopY + 10.2, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(30, 41, 59);
  if (pad.address) {
    pdf.text(`Address: ${pad.address}`, centerX, headerTopY + 14.1, { align: 'center' });
  }

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(6.9);
  pdf.setTextColor(51, 65, 85);
  const contactDisplay = pad.contactLine;
  if (contactDisplay) {
    pdf.text(contactDisplay, centerX, headerTopY + 17.8, { align: 'center' });
  }

  // Crisp double rule separating Company Pad Letterhead from Page Content
  pdf.setDrawColor(39, 62, 86);
  pdf.setLineWidth(0.55);
  pdf.line(inset + 2, A4_PAD_HEADER_BOTTOM_Y_MM - 1.0, pageWidth - inset - 2, A4_PAD_HEADER_BOTTOM_Y_MM - 1.0);
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.35);
  pdf.line(inset + 2, A4_PAD_HEADER_BOTTOM_Y_MM, pageWidth - inset - 2, A4_PAD_HEADER_BOTTOM_Y_MM);

  // 5. Official Company Pad Bottom Footer Band (on EVERY page)
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.3);
  pdf.line(inset + 2, A4_PAD_FOOTER_TOP_Y_MM, pageWidth - inset - 2, A4_PAD_FOOTER_TOP_Y_MM);
  pdf.setDrawColor(39, 62, 86);
  pdf.setLineWidth(0.45);
  pdf.line(inset + 2, A4_PAD_FOOTER_TOP_Y_MM + 0.9, pageWidth - inset - 2, A4_PAD_FOOTER_TOP_Y_MM + 0.9);

  // Bottom solid navy bar along frame base
  pdf.setFillColor(39, 62, 86);
  pdf.rect(inset, pageHeight - inset - 1.6, innerWidth, 1.6, 'F');

  const footerTextY = A4_PAD_FOOTER_TOP_Y_MM + 4.8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  pdf.setTextColor(39, 62, 86);
  const leftLabel =
    pad.footerLeft.length > 58 ? `${pad.footerLeft.slice(0, 57)}…` : pad.footerLeft;
  pdf.text(leftLabel, inset + 3.5, footerTextY, { align: 'left' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.7);
  pdf.setTextColor(71, 85, 105);
  const centerLabel = options.documentLabel
    ? `${pad.footerCenter} · ${options.documentLabel}`
    : pad.footerCenter;
  const clippedCenter = centerLabel.length > 52 ? pad.footerCenter : centerLabel;
  pdf.text(clippedCenter, centerX, footerTextY, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.4);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`Page ${options.pageNumber} of ${options.totalPages}`, pageWidth - inset - 3.5, footerTextY, {
    align: 'right',
  });
}

function escapeXmlAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeExcelHeaderFooterText(str: string): string {
  // Excel header/footer uses '&' as a control escape prefix, so literal '&' must be doubled as '&&'
  return String(str || '').replace(/&/g, '&&');
}

export interface ExcelCompanyPadSheetOptions {
  reportTitle: string;
  headers: string[];
  rows: Record<string, any>[];
  profile?: Partial<CompanyProfile> | null;
  exportDateIso?: string;
}

/**
 * Builds an XLSX.WorkSheet prefixed with the 5-row ZSB AQUATICS Official A4 Company Pad letterhead,
 * followed by the table column headers on Row 6 and data starting on Row 7.
 * Configures merged letterhead rows, comfortable row heights, auto-sized column widths,
 * and A4 print margins.
 */
export function buildCompanyPadWorksheet(options: ExcelCompanyPadSheetOptions): XLSX.WorkSheet {
  const pad = resolveCompanyPadMetadata(options.profile);
  const dateStr = formatPadDateDDMMYYYY(options.exportDateIso);

  const headers =
    options.headers.length > 0
      ? options.headers
      : options.rows.length > 0
      ? Object.keys(options.rows[0])
      : ['Column 1'];

  const colCount = Math.max(headers.length, 4);

  const padRow1: any[] = [pad.companyName.toUpperCase()];
  const padRow2: any[] = [pad.tagline];
  const padRow3: any[] = [pad.address ? `Address: ${pad.address}` : ''];
  const padRow4: any[] = [pad.contactLine];
  const padRow5: any[] = [
    `${options.reportTitle.toUpperCase()}  |  OFFICIAL COMPANY PAD (A4)  |  Exported: ${dateStr}`,
  ];

  const dataMatrix: any[][] = options.rows.map((row) =>
    headers.map((headerKey) => {
      const val = row[headerKey];
      return val === undefined || val === null ? '' : val;
    })
  );

  const aoa: any[][] = [
    padRow1,
    padRow2,
    padRow3,
    padRow4,
    padRow5,
    headers,
    ...dataMatrix,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge each of the 5 Company Pad letterhead rows across the full table width
  const lastColIdx = colCount - 1;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIdx } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastColIdx } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: lastColIdx } },
  ];

  // Auto-size columns so data fits cleanly on A4 width without truncated numbers
  ws['!cols'] = headers.map((h) => {
    let maxLen = String(h).length;
    for (let i = 0; i < Math.min(options.rows.length, 200); i++) {
      const cellStr = String(options.rows[i]?.[h] ?? '');
      if (cellStr.length > maxLen) {
        maxLen = cellStr.length;
      }
    }
    return { wch: Math.max(11, Math.min(34, maxLen + 3)) };
  });

  // Set clean row heights for the 5-row Company Pad letterhead + Header row
  ws['!rows'] = [
    { hpt: 24 }, // Row 1: Company Name
    { hpt: 15 }, // Row 2: Tagline
    { hpt: 16 }, // Row 3: Address
    { hpt: 16 }, // Row 4: Contact Mobiles / Email / Website
    { hpt: 18 }, // Row 5: Document Title & A4 Company Pad Stamp
    { hpt: 21 }, // Row 6: Table Column Headers
  ];

  // Standard A4 margins (inches) leaving room for running Company Pad header & footer
  ws['!margins'] = {
    left: 0.35,
    right: 0.35,
    top: 0.85,
    bottom: 0.7,
    header: 0.25,
    footer: 0.25,
  };

  return ws;
}

function resolveXlsxCfb(): typeof XLSX.CFB | null {
  const xlsxAny = XLSX as unknown as {
    CFB?: typeof XLSX.CFB;
    default?: { CFB?: typeof XLSX.CFB };
  };
  const cfb = xlsxAny.CFB || xlsxAny.default?.CFB;
  if (!cfb || typeof cfb.read !== 'function' || typeof cfb.write !== 'function') {
    return null;
  }
  return cfb;
}

/**
 * Post-processes an XLSX workbook binary buffer (ZIP/OOXML) so EVERY worksheet has:
 * 1. Strictly ISO A4 Paper Size (`paperSize="9"`, portrait, fitToWidth="1", fitToHeight="0", fitToPage="1")
 * 2. Page Layout view (`view="pageLayout"`) so A4 pages & Company Pad headers appear immediately in Excel
 * 3. Centered gridlines print options (`<printOptions horizontalCentered="1" gridLines="1"/>`)
 * 4. Running Company Pad `<headerFooter>` on EVERY printed A4 page (`Page &P of &N`)
 * 5. Workbook `<definedNames>` setting `_xlnm.Print_Titles` (`$1:$6`) on EVERY sheet so the 5-row
 *    Company Pad letterhead + column header row automatically repeat on Page 1, Page 2, ..., Page N!
 */
export function applyA4CompanyPadToXlsxBuffer(
  xlsxBuffer: Uint8Array,
  sheetNames: string[],
  profile?: Partial<CompanyProfile> | null
): Uint8Array {
  if (!xlsxBuffer || xlsxBuffer.byteLength === 0 || sheetNames.length === 0) {
    return xlsxBuffer;
  }

  const cfbLib = resolveXlsxCfb();
  if (!cfbLib) {
    return xlsxBuffer;
  }

  const pad = resolveCompanyPadMetadata(profile);
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  const headerText = `&C&B&11${sanitizeExcelHeaderFooterText(
    pad.companyName.toUpperCase()
  )}&B&8 — Official Company Pad (A4)`;
  const footerText = `&L&8${sanitizeExcelHeaderFooterText(
    pad.footerLeft
  )}&C&8${sanitizeExcelHeaderFooterText(
    pad.footerCenter
  )}&R&B&8Page &P of &N`;

  const printOptionsXml = `<printOptions horizontalCentered="1" gridLines="1"/>`;
  const pageSetupXml = `<pageSetup paperSize="${EXCEL_A4_PAPER_SIZE}" orientation="portrait" fitToWidth="1" fitToHeight="0"/>`;
  const headerFooterXml = `<headerFooter><oddHeader>${escapeXmlAttr(
    headerText
  )}</oddHeader><oddFooter>${escapeXmlAttr(footerText)}</oddFooter></headerFooter>`;

  const cfb = cfbLib.read(xlsxBuffer, { type: 'array' });

  // 1. Patch each worksheet XML in strict ECMA-376 element order
  for (let i = 0; i < sheetNames.length; i++) {
    const sheetPath = `/xl/worksheets/sheet${i + 1}.xml`;
    const sheetEntry = cfbLib.find(cfb, sheetPath);
    if (!sheetEntry || !sheetEntry.content) continue;

    let xml = decoder.decode(new Uint8Array(sheetEntry.content));

    // Inject <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr> right before <dimension>
    if (xml.includes('<sheetPr')) {
      if (!xml.includes('fitToPage')) {
        xml = xml.replace(
          /<sheetPr([^>]*)>/,
          '<sheetPr$1><pageSetUpPr fitToPage="1"/>'
        );
      }
    } else if (xml.includes('<dimension ')) {
      xml = xml.replace(
        '<dimension ',
        '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension '
      );
    }

    // Set sheetView to pageLayout so Excel shows A4 pages & Company Pad header/footer immediately
    if (xml.includes('<sheetView ') && !xml.includes('view=')) {
      xml = xml.replace('<sheetView ', '<sheetView view="pageLayout" ');
    }

    // Remove any existing printOptions / pageSetup / headerFooter to avoid duplicates
    xml = xml
      .replace(/<printOptions[^>]*\/>/g, '')
      .replace(/<pageSetup[^>]*\/>/g, '')
      .replace(/<headerFooter>[\s\S]*?<\/headerFooter>/g, '');

    // Insert <printOptions> before <pageMargins>, and <pageSetup> + <headerFooter> right after <pageMargins>
    const marginsRegex = /<pageMargins[^>]*\/>/;
    if (marginsRegex.test(xml)) {
      xml = xml.replace(
        marginsRegex,
        (match) => `${printOptionsXml}${match}${pageSetupXml}${headerFooterXml}`
      );
    } else {
      const defaultMargins = `<pageMargins left="0.35" right="0.35" top="0.85" bottom="0.7" header="0.25" footer="0.25"/>`;
      if (xml.includes('<ignoredErrors')) {
        xml = xml.replace(
          '<ignoredErrors',
          `${printOptionsXml}${defaultMargins}${pageSetupXml}${headerFooterXml}<ignoredErrors`
        );
      } else {
        xml = xml.replace(
          '</worksheet>',
          `${printOptionsXml}${defaultMargins}${pageSetupXml}${headerFooterXml}</worksheet>`
        );
      }
    }

    const encoded = encoder.encode(xml);
    sheetEntry.content = Array.from(encoded);
    sheetEntry.size = encoded.length;
  }

  // 2. Patch xl/workbook.xml to add _xlnm.Print_Titles ($1:$6) for EVERY sheet
  const wbEntry = cfbLib.find(cfb, '/xl/workbook.xml');
  if (wbEntry && wbEntry.content) {
    let wbXml = decoder.decode(new Uint8Array(wbEntry.content));
    const titleEndRow = EXCEL_COMPANY_PAD_ROW_COUNT + 1; // Row 6 (5 pad rows + table header row)

    const printTitleDefs = sheetNames
      .map((name, idx) => {
        const escapedSheetName = String(name).replace(/'/g, "''");
        return `<definedName name="_xlnm.Print_Titles" localSheetId="${idx}">'${escapeXmlAttr(
          escapedSheetName
        )}'!$1:$${titleEndRow}</definedName>`;
      })
      .join('');

    if (wbXml.includes('</definedNames>')) {
      wbXml = wbXml.replace('</definedNames>', `${printTitleDefs}</definedNames>`);
    } else if (wbXml.includes('</sheets>')) {
      wbXml = wbXml.replace('</sheets>', `</sheets><definedNames>${printTitleDefs}</definedNames>`);
    }

    const encodedWb = encoder.encode(wbXml);
    wbEntry.content = Array.from(encodedWb);
    wbEntry.size = encodedWb.length;
  }

  const out = cfbLib.write(cfb, { type: 'array', fileType: 'zip' });
  return new Uint8Array(out);
}
