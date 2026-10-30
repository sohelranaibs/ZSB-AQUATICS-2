import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate } from './calculations.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';

let cachedCompanyLogoDataUrl: string | null = null;
let cachedSignatureDataUrl: string | null = null;

function preloadAssetAsDataUrl(assetPath: string, onLoaded: (dataUrl: string) => void): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const absUrl = new URL(assetPath, window.location.origin).href;
    fetch(absUrl)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('Failed to fetch asset'))))
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
            onLoaded(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        // Fallback ignored; absolute URL will still be used
      });
  } catch {
    // Ignore in non-browser test environments
  }
}

if (typeof window !== 'undefined') {
  preloadAssetAsDataUrl(COMPANY_LOGO_URL, (dataUrl) => {
    cachedCompanyLogoDataUrl = dataUrl;
  });
  preloadAssetAsDataUrl('/assets/aistudio/Md._Sohel_Rana_38797da9.jpg', (dataUrl) => {
    cachedSignatureDataUrl = dataUrl;
  });
}

/**
 * Resolves the official company logo URL to a preloaded data URL or full absolute URL
 * so it works reliably in Print Preview modals, blob: print windows, and PDF/PNG exports.
 */
export function resolveCompanyLogoSrc(logoUrl?: string): string {
  if (cachedCompanyLogoDataUrl && (!logoUrl || logoUrl === COMPANY_LOGO_URL || logoUrl.includes('Gemini_Generated_Image_x7u4nx'))) {
    return cachedCompanyLogoDataUrl;
  }
  const raw =
    logoUrl && (logoUrl.startsWith('data:image/') || logoUrl.includes('Gemini_Generated_Image_x7u4nx'))
      ? logoUrl
      : COMPANY_LOGO_URL;
  if (raw.startsWith('data:image/') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(raw, window.location.origin).href;
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Converts a live loaded HTMLImageElement into a base64 data URL using an offscreen canvas,
 * falling back to preloaded cache or full absolute URL.
 */
function imageElementToDataUrlOrAbsolute(img: HTMLImageElement): string {
  const rawSrc = img.getAttribute('src') || img.src || '';
  if (rawSrc.startsWith('data:image/')) {
    return rawSrc;
  }
  if (cachedCompanyLogoDataUrl && (rawSrc.includes('Gemini_Generated_Image_x7u4nx') || rawSrc === COMPANY_LOGO_URL)) {
    return cachedCompanyLogoDataUrl;
  }
  if (cachedSignatureDataUrl && rawSrc.includes('Md._Sohel_Rana')) {
    return cachedSignatureDataUrl;
  }
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
      }
    } catch {
      // Fall through to absolute URL
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin && rawSrc) {
    try {
      return new URL(rawSrc, window.location.origin).href;
    } catch {
      return rawSrc;
    }
  }
  return rawSrc || resolveCompanyLogoSrc();
}

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
export async function renderElementToHighResCanvas(
  elementOrId: string | HTMLElement,
  targetWidth: number = 800
): Promise<HTMLCanvasElement | null> {
  const element =
    typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!element) {
    console.error(`Element not found for export:`, elementOrId);
    return null;
  }

  // Pre-capture inline data URLs for all images inside the live element
  const liveImages = Array.from(element.querySelectorAll('img'));
  const resolvedImgSrcs = liveImages.map((img) => imageElementToDataUrlOrAbsolute(img));

  const elementId = typeof elementOrId === 'string' ? elementOrId : element.id;
  const tempExportAttr = 'data-active-export-root';
  element.setAttribute(tempExportAttr, 'true');

  try {
    return await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
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

        const clonedTarget =
          (elementId ? clonedDoc.getElementById(elementId) : null) ||
          (clonedDoc.querySelector(`[${tempExportAttr}="true"]`) as HTMLElement | null);

        if (clonedTarget) {
          // Ensure all cloned images have resolved data/absolute URLs
          const clonedImages = Array.from(clonedTarget.querySelectorAll('img'));
          clonedImages.forEach((cImg, idx) => {
            if (resolvedImgSrcs[idx]) {
              cImg.src = resolvedImgSrcs[idx];
            } else {
              cImg.src = imageElementToDataUrlOrAbsolute(cImg);
            }
          });

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
          if (
            elementId === 'printable-document' ||
            elementId === 'global-printable-document' ||
            elementId === 'awb-printable-sheet'
          ) {
            clonedTarget.style.padding = '24px';
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
  } finally {
    element.removeAttribute(tempExportAttr);
  }
}

/**
 * Exports a DOM element as a downloadable high-resolution .PNG image file
 */
export async function exportElementToPng(
  elementOrId: string | HTMLElement,
  filename: string,
  targetWidth: number = 760
): Promise<boolean> {
  try {
    const canvas = await renderElementToHighResCanvas(elementOrId, targetWidth);
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
  elementOrId: string | HTMLElement,
  filename: string
): Promise<boolean> {
  try {
    const canvas = await renderElementToHighResCanvas(elementOrId, 760);
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
    const elementId = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
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
 * Exports multiple DOM elements (e.g., individual payment slips) as a single combined multi-page PDF document.
 * Each element is rendered onto its own discrete A4 page with standard 10mm margins.
 */
export async function exportElementsToCombinedPdf(
  targets: (string | HTMLElement)[],
  filename: string,
  targetWidth: number = 760
): Promise<boolean> {
  if (!targets || targets.length === 0) return false;

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const printableWidth = pageWidth - margin * 2; // 190mm
    const printableHeight = pageHeight - margin * 2; // 277mm

    let pagesAdded = 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const canvas = await renderElementToHighResCanvas(target, targetWidth);
      if (!canvas) continue;

      if (pagesAdded > 0) {
        pdf.addPage();
      }
      pagesAdded++;

      const totalImgHeightMm = (canvas.height * printableWidth) / canvas.width;

      if (totalImgHeightMm <= printableHeight) {
        const imgData = canvas.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, totalImgHeightMm);
      } else {
        const slicePixelHeight = (printableHeight * canvas.width) / printableWidth;
        let currentSourceY = 0;
        let subPageIndex = 0;

        while (currentSourceY < canvas.height) {
          if (subPageIndex > 0) {
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
          subPageIndex++;
        }
      }
    }

    if (pagesAdded === 0) return false;

    const baseName = filename.replace(/\.(pdf|png)$/i, '');
    const cleanFilename = `${baseName}.pdf`;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__LAST_EXPORTED_PDF__ = {
        filename: cleanFilename,
        type: 'batch_payment_slips_combined',
        pageCount: targets.length,
        timestamp: new Date().toISOString(),
      };
    }
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Combined PDF generation error:', error);
    return false;
  }
}

/**
 * Opens a dedicated, clean printable window that is completely free from iframe restrictions,
 * with embedded base64 images (so the company logo and signatures never break inside blob: URLs),
 * cloned document styles, an on-screen print button, and auto-print trigger.
 */
export function openPrintableDocumentWindow(
  elementId: string = 'printable-document',
  docTitle: string = 'Document'
): boolean {
  const element = document.getElementById(elementId);
  if (!element) return false;

  const baseOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/`
      : '/';

  // Clone element so we can embed data URLs for all <img> tags and replace <input>/<select> controls
  const clonedElement = element.cloneNode(true) as HTMLElement;
  const liveImgs = Array.from(element.querySelectorAll('img'));
  const clonedImgs = Array.from(clonedElement.querySelectorAll('img'));

  clonedImgs.forEach((cImg, index) => {
    const liveImg = liveImgs[index] || cImg;
    cImg.src = imageElementToDataUrlOrAbsolute(liveImg);
    if (!cImg.style.maxWidth) {
      cImg.style.maxWidth = '100%';
    }
    if (!cImg.style.maxHeight) {
      cImg.style.maxHeight = '100%';
    }
    if (!cImg.style.objectFit) {
      cImg.style.objectFit = 'contain';
    }
  });

  // Remove export-ignored elements and replace inputs/selects with static text
  clonedElement.querySelectorAll('[data-export-ignore="true"]').forEach((node) => node.remove());
  clonedElement.querySelectorAll('input, select').forEach((ctrl) => {
    const el = ctrl as HTMLInputElement | HTMLSelectElement;
    let displayVal = el.value || '';
    if (el instanceof HTMLInputElement && el.type === 'date' && displayVal) {
      displayVal = formatDate(displayVal);
    }
    const span = document.createElement('span');
    span.textContent = displayVal;
    span.className = el.className;
    span.style.display = 'inline-block';
    span.style.width = '100%';
    span.style.textAlign = 'center';
    span.style.color = '#000000';
    el.replaceWith(span);
  });

  // Extract all stylesheets and convert relative <link> hrefs to absolute URLs
  const stylesHtml = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => {
      if (node.tagName.toLowerCase() === 'link') {
        const linkEl = node as HTMLLinkElement;
        const cloneLink = linkEl.cloneNode(true) as HTMLLinkElement;
        if (linkEl.href) {
          cloneLink.setAttribute('href', linkEl.href);
        }
        return cloneLink.outerHTML;
      }
      return node.outerHTML;
    })
    .join('\n');

  const topBarLogoSrc = resolveCompanyLogoSrc();

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <base href="${baseOrigin}">
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
      padding: 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #print-root {
      max-width: 190mm;
      margin: 0 auto;
      background: #ffffff;
    }
    .print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 10px;
      margin: 0 auto 20px auto;
      max-width: 190mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .print-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .print-brand-logo {
      width: 38px;
      height: 38px;
      border-radius: 9999px;
      overflow: hidden;
      border: 2px solid #fbbf24;
      background: #ffffff;
      padding: 2px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .print-brand-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 9999px;
      display: block;
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
    table { width: 100%; border-collapse: collapse; }
    @media print {
      .print-bar { display: none !important; }
      body { padding: 0 !important; margin: 0 !important; }
      #print-root { max-width: 100% !important; width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div class="print-brand">
      <div class="print-brand-logo">
        <img src="${topBarLogoSrc}" alt="ZSB AQUATICS" />
      </div>
      <div>
        <span style="color:#ffe066;font-weight:900;font-size:18px;letter-spacing:0.08em;font-family:'Cinzel',Georgia,serif;text-shadow:0px 1px 0px #d97706,1px 2px 0px #b45309,2px 3px 0px #92400e,3px 4px 0px #78350f,4px 5px 6px rgba(0,0,0,0.7);">ZSB AQUATICS</span>
        <span style="color:#94a3b8;margin:0 8px;">|</span>
        <span style="font-weight:600;font-size:13px;color:#f8fafc;">Official A4 Print Ready Document</span>
      </div>
    </div>
    <div class="print-actions">
      <button class="btn-print" onclick="window.print()">🖨️ Click to Print Now (or Ctrl+P)</button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div id="print-root">
    ${clonedElement.innerHTML}
  </div>

  <script>
    (function() {
      function triggerPrintWhenReady() {
        var imgs = Array.prototype.slice.call(document.images || []);
        var pending = imgs.filter(function(img) { return !img.complete; });
        if (pending.length === 0) {
          setTimeout(function() {
            try { window.print(); } catch (e) {}
          }, 250);
          return;
        }
        var remaining = pending.length;
        var done = false;
        function checkDone() {
          if (done) return;
          remaining--;
          if (remaining <= 0) {
            done = true;
            setTimeout(function() {
              try { window.print(); } catch (e) {}
            }, 200);
          }
        }
        pending.forEach(function(img) {
          img.addEventListener('load', checkDone);
          img.addEventListener('error', checkDone);
        });
        setTimeout(function() {
          if (!done) {
            done = true;
            try { window.print(); } catch (e) {}
          }
        }, 1200);
      }
      if (document.readyState === 'complete') {
        triggerPrintWhenReady();
      } else {
        window.addEventListener('load', triggerPrintWhenReady);
      }
    })();
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

  return true;
}

