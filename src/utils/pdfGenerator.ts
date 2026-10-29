import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate } from './calculations.ts';

/**
 * Converts any modern CSS color string (oklab, oklch, color-mix, color) into
 * standard rgb()/rgba() using a 1x1 2D canvas context so html2canvas can parse it cleanly.
 */
function toLegacyRgbColor(cssValue: string, ctx: CanvasRenderingContext2D | null): string {
  if (
    !cssValue ||
    (!cssValue.includes('oklab') &&
      !cssValue.includes('oklch') &&
      !cssValue.includes('color-mix') &&
      !cssValue.includes('color('))
  ) {
    return cssValue;
  }
  if (!ctx) return '#1e293b';
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = cssValue;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return 'transparent';
    if (a === 255) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return '#1e293b';
  }
}

/**
 * Shared high-resolution html2canvas renderer that normalizes Tailwind v4 oklch()/oklab() colors,
 * strips interactive toolbar controls marked with [data-export-ignore="true"], and replaces
 * live <input>/<select> controls in the cloned DOM with crisp static text nodes.
 */
async function renderElementToHighResCanvas(
  elementId: string,
  targetWidth: number = 800
): Promise<HTMLCanvasElement | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found for export.`);
    return null;
  }

  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: Math.max(targetWidth + 50, 950),
    width: targetWidth,
    onclone: (clonedDoc) => {
      // 1. Replace modern oklch(), oklab(), and color-mix() in all <style> tags
      const styles = clonedDoc.querySelectorAll('style');
      styles.forEach((styleTag) => {
        if (
          styleTag.textContent &&
          (styleTag.textContent.includes('oklch') ||
            styleTag.textContent.includes('oklab') ||
            styleTag.textContent.includes('color-mix'))
        ) {
          styleTag.textContent = styleTag.textContent
            .replace(/color-mix\([^)]+\)/gi, 'rgba(15, 23, 42, 0.15)')
            .replace(/oklch\([^)]+\)/gi, '#1e293b')
            .replace(/oklab\([^)]+\)/gi, '#1e293b');
        }
      });

      const clonedTarget = clonedDoc.getElementById(elementId);
      if (clonedTarget) {
        // 2. Remove interactive controls marked to be ignored in exports
        clonedTarget.querySelectorAll('[data-export-ignore="true"]').forEach((node) => {
          node.remove();
        });

        // 3. Convert <input> and <select> elements inside the cloned slip into clean static text
        clonedTarget.querySelectorAll('input, select').forEach((ctrl) => {
          const el = ctrl as HTMLInputElement | HTMLSelectElement;
          let displayVal = el.value || '';
          if (el instanceof HTMLInputElement && el.type === 'date' && displayVal) {
            displayVal = formatDate(displayVal);
          }
          const span = clonedDoc.createElement('span');
          span.textContent = displayVal;
          span.className = el.className;
          span.style.display = 'inline-block';
          span.style.width = '100%';
          span.style.textAlign = 'center';
          span.style.verticalAlign = 'middle';
          span.style.lineHeight = '1.15';
          span.style.color = '#000000';
          span.style.border = 'none';
          span.style.background = 'transparent';
          el.replaceWith(span);
        });

        clonedTarget.style.width = `${targetWidth}px`;
        clonedTarget.style.minWidth = `${targetWidth}px`;
        clonedTarget.style.maxWidth = `${targetWidth}px`;
        clonedTarget.style.boxSizing = 'border-box';
        clonedTarget.style.backgroundColor = '#ffffff';
        clonedTarget.style.color = '#000000';
        if (elementId === 'printable-document' || elementId === 'global-printable-document') {
          clonedTarget.style.padding = '32px';
        }
        clonedTarget.style.margin = '0 auto';
        clonedTarget.style.borderRadius = '0px';
        clonedTarget.style.boxShadow = 'none';
      }

      // 4. Normalize any remaining computed oklab/oklch values across all elements in clonedDoc
      const helperCanvas = clonedDoc.createElement('canvas');
      helperCanvas.width = 1;
      helperCanvas.height = 1;
      const ctx = helperCanvas.getContext('2d', { willReadFrequently: true });
      const win = clonedDoc.defaultView || window;

      const colorProps = [
        'color',
        'backgroundColor',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'outlineColor',
        'textDecorationColor',
        'columnRuleColor',
        'fill',
        'stroke',
      ] as const;

      const allElements = [
        clonedDoc.documentElement,
        clonedDoc.body,
        ...Array.from(clonedDoc.querySelectorAll('*')),
      ];

      allElements.forEach((node) => {
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;
        const computed = win.getComputedStyle(node);
        for (const prop of colorProps) {
          const val = computed[prop];
          if (
            val &&
            (val.includes('oklab') ||
              val.includes('oklch') ||
              val.includes('color-mix') ||
              val.includes('color('))
          ) {
            (node.style as unknown as Record<string, string>)[prop] = toLegacyRgbColor(val, ctx);
          }
        }
        if (
          computed.boxShadow &&
          (computed.boxShadow.includes('oklab') || computed.boxShadow.includes('oklch'))
        ) {
          node.style.boxShadow = 'none';
        }
        if (
          computed.backgroundImage &&
          (computed.backgroundImage.includes('oklab') ||
            computed.backgroundImage.includes('oklch'))
        ) {
          node.style.backgroundImage = 'none';
        }
      });
    },
  });
}

/**
 * Exports a DOM element as a downloadable high-resolution .PNG image file
 */
export async function exportElementToPng(
  elementId: string,
  filename: string,
  targetWidth: number = 900
): Promise<boolean> {
  try {
    const canvas = await renderElementToHighResCanvas(elementId, targetWidth);
    if (!canvas) return false;

    const imgDataUrl = canvas.toDataURL('image/png', 1.0);
    const baseName = filename.replace(/\.(pdf|png)$/i, '');
    const cleanFilename = `${baseName}.png`;

    const link = document.createElement('a');
    link.href = imgDataUrl;
    link.download = cleanFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('PNG generation error:', error);
    return false;
  }
}

/**
 * Exports a DOM element as a downloadable PDF file
 * Handles Tailwind v4 modern oklch color parsing for html2canvas
 */
export async function exportElementToPdf(
  elementId: string,
  filename: string
): Promise<boolean> {
  try {
    const canvas = await renderElementToHighResCanvas(elementId, 800);
    if (!canvas) return false;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Standard A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10; // Standard 10mm paper margin on all sides matching Print Preview
    const printableWidth = pageWidth - margin * 2; // 190mm
    const printableHeight = pageHeight - margin * 2; // 277mm

    // Scale canvas to fit within 190mm width
    const totalImgHeightMm = (canvas.height * printableWidth) / canvas.width;

    if (totalImgHeightMm <= printableHeight) {
      // Single page voucher: perfectly centered with standard 10mm margins
      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, totalImgHeightMm);
    } else {
      // Multi-page document: slice canvas cleanly by page chunks
      const slicePixelHeight = (printableHeight * canvas.width) / printableWidth;
      let currentSourceY = 0;
      let pageIndex = 0;

      while (currentSourceY < canvas.height) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const currentSlicePixels = Math.min(slicePixelHeight, canvas.height - currentSourceY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSlicePixels;
        const sliceCtx = sliceCanvas.getContext('2d');

        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0,
            currentSourceY,
            canvas.width,
            currentSlicePixels,
            0,
            0,
            canvas.width,
            currentSlicePixels
          );

          const sliceData = sliceCanvas.toDataURL('image/png', 1.0);
          const currentSliceHeightMm = (currentSlicePixels * printableWidth) / canvas.width;
          pdf.addImage(sliceData, 'PNG', margin, margin, printableWidth, currentSliceHeightMm);
        }

        currentSourceY += currentSlicePixels;
        pageIndex++;
      }
    }

    const baseName = filename.replace(/\.(pdf|png)$/i, '');
    const cleanFilename = `${baseName}.pdf`;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__LAST_EXPORTED_PDF__ = {
        filename: cleanFilename,
        elementId,
        timestamp: new Date().toISOString(),
      };
    }
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('PDF generation error:', error);
    return false;
  }
}

/**
 * Opens a dedicated, clean printable window that is completely free from iframe restrictions,
 * with cloned document styles, an on-screen print button, and auto-print trigger.
 */
export function openPrintableDocumentWindow(
  elementId: string = 'printable-document',
  docTitle: string = 'Document'
): boolean {
  const element = document.getElementById(elementId);
  if (!element) return false;

  // Extract all stylesheets from current document to preserve exact fonts & styles
  const stylesHtml = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((s) => s.outerHTML)
    .join('\n');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} - ZSB AQUATICS</title>
  ${stylesHtml}
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      background-color: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 20px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 10px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .print-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .btn-print {
      background: #16a34a;
      color: #ffffff;
      border: none;
      padding: 9px 18px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .btn-print:hover { background: #15803d; }
    .btn-close {
      background: #334155;
      color: #ffffff;
      border: none;
      padding: 9px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-close:hover { background: #475569; }
    table { width: 100% !important; border-collapse: collapse !important; }
    th, td { border: 1px solid #cbd5e1 !important; padding: 6px 8px !important; }
    @media print {
      .print-bar { display: none !important; }
      body { padding: 0 !important; margin: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <span style="color:#ffe066;font-weight:900;font-size:18px;letter-spacing:0.08em;font-family:'Cinzel',Georgia,serif;text-shadow:0px 1px 0px #d97706,1px 2px 0px #b45309,2px 3px 0px #92400e,3px 4px 0px #78350f,4px 5px 6px rgba(0,0,0,0.7);">ZSB AQUATICS</span>
      <span style="color:#94a3b8;margin:0 8px;">|</span>
      <span style="font-weight:600;font-size:13px;color:#f8fafc;">Official Print Ready Document</span>
    </div>
    <div class="print-actions">
      <button class="btn-print" onclick="window.print()">🖨️ Click to Print Now (or Ctrl+P)</button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div id="print-root">
    ${element.innerHTML}
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (e) {
          console.warn('Auto print error:', e);
        }
      }, 400);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // Try opening standalone window
  const printWindow = window.open(blobUrl, '_blank');
  if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
    // If popup was blocked by browser, create link and trigger click
    const link = document.createElement('a');
    link.href = blobUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 500);
  }

  // Also trigger in-page window.print in case the current environment allows it directly
  try {
    window.print();
  } catch (e) {
    // Ignored in sandboxed iframes
  }

  return true;
}
