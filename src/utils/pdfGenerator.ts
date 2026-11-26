import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate } from './calculations.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import {
  getScaledDimensions,
  needsLegacyColorConversion,
} from './pdfExportStyles.ts';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  A4_CONTENT_MARGIN_X_MM,
  A4_CONTENT_WIDTH_MM,
  A4_PAD_CONTENT_TOP_Y_MM,
  A4_PAD_CONTENT_HEIGHT_MM,
  drawPdfCompanyPadFrame,
  resolveCompanyPadMetadata,
} from './companyPadLayout.ts';

let cachedCompanyLogoDataUrl: string | null = null;
let cachedSignatureDataUrl: string | null = null;
const legacyColorCache = new Map<string, string>();
let sharedHelperCtx: CanvasRenderingContext2D | null = null;

function getLegacyColorHelperCtx(): CanvasRenderingContext2D | null {
  if (sharedHelperCtx || typeof document === 'undefined') return sharedHelperCtx;
  const helperCanvas = document.createElement('canvas');
  helperCanvas.width = 1;
  helperCanvas.height = 1;
  sharedHelperCtx = helperCanvas.getContext('2d', { willReadFrequently: true });
  return sharedHelperCtx;
}

function compactDataUrl(rawDataUrl: string, maxDim: number = 256): Promise<string> {
  if (typeof window === 'undefined' || !rawDataUrl.startsWith('data:image/')) {
    return Promise.resolve(rawDataUrl);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        if (w <= 0 || h <= 0) {
          resolve(rawDataUrl);
          return;
        }
        const scaled = getScaledDimensions(w, h, maxDim);
        if (scaled.width === w && scaled.height === h && rawDataUrl.length < 40000) {
          resolve(rawDataUrl);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = scaled.width;
        canvas.height = scaled.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export function getCachedCompanyLogoDataUrl(): string | null {
  return cachedCompanyLogoDataUrl;
}

async function ensureCompanyLogoDataUrl(): Promise<string | null> {
  if (cachedCompanyLogoDataUrl) return cachedCompanyLogoDataUrl;
  const pad = resolveCompanyPadMetadata();
  if (pad.logoUrl && pad.logoUrl.startsWith('data:image/')) {
    return pad.logoUrl;
  }
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return null;
  }
  try {
    const src = pad.logoUrl || COMPANY_LOGO_URL;
    const absUrl = new URL(src, window.location.origin).href;
    const res = await fetch(absUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const rawDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
    if (rawDataUrl.startsWith('data:image/')) {
      const compacted = await compactDataUrl(rawDataUrl, 256);
      cachedCompanyLogoDataUrl = compacted;
      return compacted;
    }
  } catch {
    // Graceful fallback if logo fetch fails
  }
  return cachedCompanyLogoDataUrl;
}

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
            compactDataUrl(reader.result, 256).then(onLoaded);
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
  if (
    cachedCompanyLogoDataUrl &&
    (!logoUrl ||
      logoUrl === COMPANY_LOGO_URL ||
      logoUrl.includes('Gemini_Generated_Image_x7u4nx') ||
      logoUrl.includes('Image_20260915140835'))
  ) {
    return cachedCompanyLogoDataUrl;
  }
  const raw =
    logoUrl &&
    (logoUrl.startsWith('data:image/') ||
      logoUrl.includes('Image_20260915140835'))
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
  if (
    cachedCompanyLogoDataUrl &&
    (rawSrc.includes('Gemini_Generated_Image_x7u4nx') ||
      rawSrc.includes('Image_20260915140835') ||
      rawSrc === COMPANY_LOGO_URL)
  ) {
    return cachedCompanyLogoDataUrl;
  }
  if (cachedSignatureDataUrl && rawSrc.includes('Md._Sohel_Rana')) {
    return cachedSignatureDataUrl;
  }
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
    try {
      const scaled = getScaledDimensions(img.naturalWidth, img.naturalHeight, 256);
      const canvas = document.createElement('canvas');
      canvas.width = scaled.width;
      canvas.height = scaled.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
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
  if (!needsLegacyColorConversion(cssValue)) {
    return cssValue;
  }
  const cached = legacyColorCache.get(cssValue);
  if (cached !== undefined) return cached;
  const activeCtx = ctx || getLegacyColorHelperCtx();
  if (!activeCtx) return '#1e293b';
  try {
    activeCtx.clearRect(0, 0, 1, 1);
    activeCtx.fillStyle = '#000000';
    activeCtx.fillStyle = cssValue;
    activeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = activeCtx.getImageData(0, 0, 1, 1).data;
    const result =
      a === 0
        ? 'transparent'
        : a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    legacyColorCache.set(cssValue, result);
    return result;
  } catch {
    return '#1e293b';
  }
}

/**
 * Ensures an HTMLImageElement is converted into a self-contained data:image/... URL
 * so SVG foreignObject and canvas exports never fail or taint on external URLs.
 */
async function ensureSelfContainedImageDataUrl(img: HTMLImageElement): Promise<string> {
  const syncResult = imageElementToDataUrlOrAbsolute(img);
  if (syncResult.startsWith('data:image/')) {
    return syncResult;
  }
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined' && syncResult) {
    try {
      const absUrl = new URL(syncResult, window.location.origin).href;
      const res = await fetch(absUrl);
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(typeof reader.result === 'string' ? reader.result : '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
        if (dataUrl.startsWith('data:image/')) {
          return dataUrl;
        }
      }
    } catch {
      // Fall through
    }
  }
  return cachedCompanyLogoDataUrl || syncResult;
}

function getCollectedDocumentCss(): string {
  if (typeof document === 'undefined') return '';
  const chunks: string[] = [];
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i];
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        const cssText = rules[j].cssText;
        if (cssText.startsWith('@import')) continue;
        // Strip external url(...) references (e.g. remote font files) so SVG <image> loader never blocks or taints
        const sanitizedRule = cssText.replace(
          /url\((?!['"]?data:)[^)]+\)/gi,
          'none'
        );
        chunks.push(sanitizedRule);
      }
    } catch {
      // Ignore cross-origin stylesheets
    }
  }
  return chunks.join('\n');
}

/**
 * Renders a live DOM element to a 2x high-resolution canvas using the browser's native
 * SVG <foreignObject> engine (with all document stylesheets and base64 images embedded),
 * ensuring 100% pixel-for-pixel fidelity with the Print Preview Modal.
 */
async function renderElementViaSvgForeignObject(
  element: HTMLElement,
  resolvedImgSrcs: string[],
  targetWidth: number,
  borderless: boolean = false
): Promise<HTMLCanvasElement | null> {
  if (typeof window === 'undefined' || typeof XMLSerializer === 'undefined') return null;

  const exportWidth = targetWidth || 760;

  // Temporarily normalize any ancestor CSS zoom (e.g. main[data-testid="sheet-zoom-canvas"])
  // and lock element width to exportWidth so measurements match A4 Print Preview geometry.
  const zoomedAncestors: Array<{ el: HTMLElement; prevZoom: string }> = [];
  let parentCursor: HTMLElement | null = element.parentElement;
  while (parentCursor) {
    const inlineZoom = (parentCursor.style as unknown as Record<string, string>).zoom || '';
    const computedZoom =
      (window.getComputedStyle(parentCursor) as unknown as Record<string, string>).zoom || '';
    if (inlineZoom || (computedZoom && computedZoom !== '1' && computedZoom !== 'normal')) {
      zoomedAncestors.push({ el: parentCursor, prevZoom: inlineZoom });
      (parentCursor.style as unknown as Record<string, string>).zoom = '1';
    }
    parentCursor = parentCursor.parentElement;
  }

  const prevElStyles = {
    width: element.style.width,
    minWidth: element.style.minWidth,
    maxWidth: element.style.maxWidth,
    maxHeight: element.style.maxHeight,
  };

  let width = exportWidth;
  let height = 0;
  let rootFontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const clone = element.cloneNode(true) as HTMLElement;

  try {
    element.style.width = `${exportWidth}px`;
    element.style.minWidth = `${exportWidth}px`;
    element.style.maxWidth = `${exportWidth}px`;
    element.style.maxHeight = 'none';

    const rootCs = window.getComputedStyle(element);
    if (rootCs.fontFamily) {
      rootFontFamily = rootCs.fontFamily;
    }

    const rect = element.getBoundingClientRect();
    width = Math.round(rect.width) || element.offsetWidth || exportWidth;
    height = Math.max(Math.round(rect.height), element.scrollHeight, element.offsetHeight);
    if (width <= 0 || height <= 0) return null;
  } finally {
    element.style.width = prevElStyles.width;
    element.style.minWidth = prevElStyles.minWidth;
    element.style.maxWidth = prevElStyles.maxWidth;
    element.style.maxHeight = prevElStyles.maxHeight;
    for (let i = 0; i < zoomedAncestors.length; i++) {
      const item = zoomedAncestors[i];
      (item.el.style as unknown as Record<string, string>).zoom = item.prevZoom;
    }
  }

  // Uncap any scroll-managed containers inside the clone so all rows render without scrollbars
  clone.querySelectorAll('[data-row-scroll-managed="true"]').forEach((node) => {
    if (node instanceof HTMLElement) {
      node.style.maxHeight = 'none';
      node.style.overflow = 'visible';
    }
  });

  // Replace all cloned <img> sources with self-contained base64 data URLs
  const clonedImages = Array.from(clone.querySelectorAll('img'));
  clonedImages.forEach((cImg, idx) => {
    const dataSrc = resolvedImgSrcs[idx] || cachedCompanyLogoDataUrl || '';
    if (dataSrc) {
      cImg.setAttribute('src', dataSrc);
    }
    cImg.removeAttribute('srcset');
    cImg.removeAttribute('crossorigin');
  });

  // Remove interactive toolbar elements marked to be ignored in exports
  clone.querySelectorAll('[data-export-ignore="true"]').forEach((node) => {
    node.remove();
  });

  // Convert <input>, <select>, and <textarea> elements into crisp static text nodes
  clone.querySelectorAll('input, select, textarea').forEach((ctrl) => {
    const el = ctrl as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      const span = document.createElement('span');
      span.textContent = el.checked ? '☑' : '☐';
      span.className = el.className;
      span.style.display = 'inline-block';
      span.style.textAlign = 'center';
      el.replaceWith(span);
      return;
    }
    let displayVal =
      el instanceof HTMLSelectElement
        ? el.selectedOptions?.[0]?.textContent?.trim() || el.value || ''
        : el.value || '';
    if (el instanceof HTMLInputElement && el.type === 'date' && displayVal) {
      displayVal = formatDate(displayVal);
    }
    const span = document.createElement('span');
    span.textContent = displayVal;
    span.className = el.className;
    if (el.getAttribute('style')) {
      span.setAttribute('style', el.getAttribute('style') || '');
    }
    span.style.display = 'inline-block';
    span.style.width = '100%';
    if (!span.style.textAlign) {
      span.style.textAlign = el.tagName === 'TEXTAREA' ? 'left' : 'center';
    }
    span.style.verticalAlign = 'middle';
    span.style.color = '#000000';
    span.style.border = 'none';
    span.style.background = 'transparent';
    el.replaceWith(span);
  });

  // Normalize root clone positioning for foreignObject viewport while preserving its classes & padding
  clone.style.margin = '0px';
  clone.style.position = 'relative';
  clone.style.left = '0px';
  clone.style.top = '0px';
  clone.style.transform = 'none';
  clone.style.width = `${width}px`;
  clone.style.minWidth = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.minHeight = `${height}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';
  clone.style.fontFamily = rootFontFamily;
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = borderless ? '0px' : '2px';
  clone.style.border = borderless ? 'none' : '1px solid #cbd5e1';
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const collectedCss = getCollectedDocumentCss().replace(/\]\]>/g, '');
  const extraExportCss = `
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print\\:hidden {
      display: none !important;
    }
  `;
  const serialized = new XMLSerializer().serializeToString(clone);
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style><![CDATA[${collectedCss}\n${extraExportCss}]]></style><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (err) => reject(err);
    img.src = svgDataUrl;
  });

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  // Fast O(1) SecurityError check to verify the canvas is not tainted (avoids extra full-frame PNG encode)
  ctx.getImageData(0, 0, 1, 1);
  return canvas;
}

/**
 * Shared high-resolution renderer that produces pixel-identical output matching Print Preview.
 * Uses native SVG <foreignObject> rendering first for 100% CSS fidelity, falling back to
 * html2canvas with pre-inlined RGB colors if needed.
 */
export async function renderElementToHighResCanvas(
  elementOrId: string | HTMLElement,
  targetWidth: number = 760,
  options?: { borderless?: boolean }
): Promise<HTMLCanvasElement | null> {
  const borderless = Boolean(options?.borderless);
  const element =
    typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!element) {
    console.error(`Element not found for export:`, elementOrId);
    return null;
  }

  // Pre-capture inline base64 data URLs for all images inside the live element
  const liveImages = Array.from(element.querySelectorAll('img'));
  const resolvedImgSrcs = await Promise.all(
    liveImages.map((img) => ensureSelfContainedImageDataUrl(img))
  );

  // Primary renderer: Native SVG <foreignObject> (100% identical to Print Preview in browser)
  try {
    const nativeCanvas = await renderElementViaSvgForeignObject(
      element,
      resolvedImgSrcs,
      targetWidth,
      borderless
    );
    if (nativeCanvas) {
      return nativeCanvas;
    }
  } catch (svgErr) {
    console.warn('SVG foreignObject render fallback to html2canvas:', svgErr);
  }

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
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(targetWidth + 50, 950),
      width: targetWidth,
      onclone: (clonedDoc) => {
        // 1. FIRST (before altering <style> tags!), read true computed colors and inline them as RGB/RGBA
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

        const clonedTargetScope =
          (elementId ? clonedDoc.getElementById(elementId) : null) ||
          (clonedDoc.querySelector(`[${tempExportAttr}="true"]`) as HTMLElement | null);

        const scopedChildren = clonedTargetScope
          ? [clonedTargetScope, ...Array.from(clonedTargetScope.querySelectorAll('*'))]
          : Array.from(clonedDoc.querySelectorAll('*'));

        const allElements = [
          clonedDoc.documentElement,
          clonedDoc.body,
          ...scopedChildren,
        ];

        allElements.forEach((node) => {
          if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;
          const computed = win.getComputedStyle(node);
          for (const prop of colorProps) {
            const val = computed[prop];
            if (val) {
              (node.style as unknown as Record<string, string>)[prop] = toLegacyRgbColor(val, ctx);
            }
          }
          if (
            computed.boxShadow &&
            (computed.boxShadow.includes('oklab') ||
              computed.boxShadow.includes('oklch') ||
              computed.boxShadow.includes('color-mix'))
          ) {
            node.style.boxShadow = 'none';
          }
          if (
            computed.backgroundImage &&
            (computed.backgroundImage.includes('oklab') ||
              computed.backgroundImage.includes('oklch') ||
              computed.backgroundImage.includes('color-mix'))
          ) {
            node.style.backgroundImage = 'none';
          }
        });

        // 2. Now sanitize <style> tags so html2canvas CSS parser does not choke on oklch/oklab/color-mix
        const styles = clonedDoc.querySelectorAll('style');
        styles.forEach((styleTag) => {
          if (
            styleTag.textContent &&
            (styleTag.textContent.includes('oklch') ||
              styleTag.textContent.includes('oklab') ||
              styleTag.textContent.includes('color-mix'))
          ) {
            styleTag.textContent = styleTag.textContent
              .replace(/color-mix\([^;{}]+\)/gi, 'transparent')
              .replace(/oklch\([^)]+\)/gi, (m) => toLegacyRgbColor(m, ctx))
              .replace(/oklab\([^)]+\)/gi, (m) => toLegacyRgbColor(m, ctx));
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

          // Remove interactive controls marked to be ignored in exports
          clonedTarget.querySelectorAll('[data-export-ignore="true"]').forEach((node) => {
            node.remove();
          });

          // Convert <input> and <select> elements inside the cloned slip into clean static text
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
          clonedTarget.style.position = 'relative';
          clonedTarget.style.overflow = 'hidden';
          if (
            elementId === 'printable-document' ||
            elementId === 'global-printable-document' ||
            elementId === 'awb-printable-sheet'
          ) {
            clonedTarget.style.padding = '28px';
          }
          clonedTarget.style.margin = '0 auto';
          clonedTarget.style.borderRadius = borderless ? '0px' : '2px';
          clonedTarget.style.border = borderless ? 'none' : '1px solid #cbd5e1';
          clonedTarget.style.boxShadow = 'none';
        }
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
 * Exports a DOM element as a downloadable ISO A4 PDF file with the official
 * Company Pad letterhead, corporate border frame, watermark, and Page X of Y footer on EVERY page.
 */
export async function exportElementToPdf(
  elementOrId: string | HTMLElement,
  filename: string
): Promise<boolean> {
  try {
    const [canvas, logoDataUrl] = await Promise.all([
      renderElementToHighResCanvas(elementOrId, 760, { borderless: true }),
      ensureCompanyLogoDataUrl(),
    ]);
    if (!canvas) return false;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // Strictly ISO A4 portrait content box nested cleanly inside the Company Pad header & footer bands
    const contentX = A4_CONTENT_MARGIN_X_MM; // 10mm
    const contentY = A4_PAD_CONTENT_TOP_Y_MM; // 34mm
    const printableWidth = A4_CONTENT_WIDTH_MM; // 190mm
    const printableHeight = A4_PAD_CONTENT_HEIGHT_MM; // 246.5mm

    const totalImgHeightMm = (canvas.height * printableWidth) / canvas.width;

    if (totalImgHeightMm <= printableHeight) {
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(
        imgData,
        'JPEG',
        contentX,
        contentY,
        printableWidth,
        totalImgHeightMm,
        undefined,
        'FAST'
      );
    } else {
      const slicePixelHeight = (printableHeight * canvas.width) / printableWidth;
      let currentSourceY = 0;
      let pageIndex = 0;

      while (currentSourceY < canvas.height) {
        if (pageIndex > 0) {
          pdf.addPage('a4', 'portrait');
        }

        const currentSlicePixels = Math.min(slicePixelHeight, canvas.height - currentSourceY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.max(1, Math.ceil(currentSlicePixels));
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

          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          const currentSliceHeightMm = (currentSlicePixels * printableWidth) / canvas.width;
          pdf.addImage(
            sliceData,
            'JPEG',
            contentX,
            contentY,
            printableWidth,
            currentSliceHeightMm,
            undefined,
            'FAST'
          );
        }

        currentSourceY += currentSlicePixels;
        pageIndex++;
      }
    }

    const baseName = filename.replace(/\.(pdf|png)$/i, '');
    const cleanFilename = `${baseName}.pdf`;
    const documentLabel = baseName.replace(/[_-]+/g, ' ').trim().slice(0, 36);

    // Stamp the Official A4 Company Pad letterhead, frame, watermark & footer on EVERY page
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      drawPdfCompanyPadFrame(pdf, {
        pageNumber: p,
        totalPages,
        logoDataUrl,
        documentLabel,
        drawWatermark: true,
      });
    }

    const elementId = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__LAST_EXPORTED_PDF__ = {
        filename: cleanFilename,
        elementId,
        paperSize: 'A4',
        widthMm: A4_PAGE_WIDTH_MM,
        heightMm: A4_PAGE_HEIGHT_MM,
        companyPadOnEveryPage: true,
        pageCount: totalPages,
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
 * Exports multiple DOM elements (e.g., individual payment slips) as a single combined multi-page
 * ISO A4 PDF document with the Official Company Pad rendered on EVERY page.
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
      compress: true,
    });

    const contentX = A4_CONTENT_MARGIN_X_MM; // 10mm
    const contentY = A4_PAD_CONTENT_TOP_Y_MM; // 34mm
    const printableWidth = A4_CONTENT_WIDTH_MM; // 190mm
    const printableHeight = A4_PAD_CONTENT_HEIGHT_MM; // 246.5mm

    let pagesAdded = 0;
    const [renderedCanvases, logoDataUrl] = await Promise.all([
      Promise.all(
        targets.map((target) =>
          renderElementToHighResCanvas(target, targetWidth, { borderless: true })
        )
      ),
      ensureCompanyLogoDataUrl(),
    ]);

    for (let i = 0; i < renderedCanvases.length; i++) {
      const canvas = renderedCanvases[i];
      if (!canvas) continue;

      if (pagesAdded > 0) {
        pdf.addPage('a4', 'portrait');
      }
      pagesAdded++;

      const totalImgHeightMm = (canvas.height * printableWidth) / canvas.width;

      if (totalImgHeightMm <= printableHeight) {
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(
          imgData,
          'JPEG',
          contentX,
          contentY,
          printableWidth,
          totalImgHeightMm,
          undefined,
          'FAST'
        );
      } else {
        const slicePixelHeight = (printableHeight * canvas.width) / printableWidth;
        let currentSourceY = 0;
        let subPageIndex = 0;

        while (currentSourceY < canvas.height) {
          if (subPageIndex > 0) {
            pdf.addPage('a4', 'portrait');
          }

          const currentSlicePixels = Math.min(slicePixelHeight, canvas.height - currentSourceY);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.max(1, Math.ceil(currentSlicePixels));
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

            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
            const currentSliceHeightMm = (currentSlicePixels * printableWidth) / canvas.width;
            pdf.addImage(
              sliceData,
              'JPEG',
              contentX,
              contentY,
              printableWidth,
              currentSliceHeightMm,
              undefined,
              'FAST'
            );
          }

          currentSourceY += currentSlicePixels;
          subPageIndex++;
        }
      }
    }

    if (pagesAdded === 0) return false;

    const baseName = filename.replace(/\.(pdf|png)$/i, '');
    const cleanFilename = `${baseName}.pdf`;
    const documentLabel = baseName.replace(/[_-]+/g, ' ').trim().slice(0, 36);

    // Stamp Official A4 Company Pad letterhead, frame, watermark & footer on EVERY page
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      drawPdfCompanyPadFrame(pdf, {
        pageNumber: p,
        totalPages,
        logoDataUrl,
        documentLabel,
        drawWatermark: true,
      });
    }

    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__LAST_EXPORTED_PDF__ = {
        filename: cleanFilename,
        type: 'batch_payment_slips_combined',
        paperSize: 'A4',
        widthMm: A4_PAGE_WIDTH_MM,
        heightMm: A4_PAGE_HEIGHT_MM,
        companyPadOnEveryPage: true,
        pageCount: totalPages,
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
  const pad = resolveCompanyPadMetadata();
  const escapeHtml = (val: string) =>
    String(val || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const todayFormatted = formatDate(new Date().toISOString().slice(0, 10));

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <base href="${baseOrigin}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle)} - ${escapeHtml(pad.companyName)}</title>
  ${stylesHtml}
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 9px;
        font-weight: 700;
        color: #1e293b;
      }
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
    .zsb-a4-pad-shell {
      width: 100% !important;
      max-width: 194mm;
      margin: 0 auto;
      border-collapse: collapse !important;
      table-layout: auto !important;
      border: 1.5px solid #273E56 !important;
      background: #ffffff;
    }
    .zsb-a4-pad-shell > thead { display: table-header-group; }
    .zsb-a4-pad-shell > tfoot { display: table-footer-group; }
    .zsb-a4-pad-shell > thead > tr > td,
    .zsb-a4-pad-shell > tbody > tr > td,
    .zsb-a4-pad-shell > tfoot > tr > td {
      border: none !important;
      padding: 0 !important;
    }
    .zsb-pad-top-bar {
      height: 7px;
      background: #273E56;
      border-bottom: 3px solid #D4AF37;
    }
    .zsb-pad-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 14px 7px 14px;
      border-bottom: 2px solid #273E56;
      box-shadow: inset 0 -1px 0 #D4AF37;
      background: #ffffff;
    }
    .zsb-pad-header-logo {
      width: 48px;
      height: 48px;
      border-radius: 9999px;
      border: 2px solid #D4AF37;
      background: #ffffff;
      padding: 2px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zsb-pad-header-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 9999px;
      display: block;
    }
    .zsb-pad-header-center {
      text-align: center;
      flex: 1;
      min-width: 0;
    }
    .zsb-pad-company-name {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20px;
      font-weight: 900;
      color: #273E56;
      letter-spacing: 0.06em;
      line-height: 1.1;
    }
    .zsb-pad-tagline {
      font-size: 8.5px;
      font-weight: 800;
      color: #b45309;
      letter-spacing: 0.08em;
      margin-top: 2px;
    }
    .zsb-pad-address {
      font-size: 9.5px;
      color: #1e293b;
      margin-top: 2px;
    }
    .zsb-pad-contact {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9px;
      font-weight: 700;
      color: #334155;
      margin-top: 1px;
    }
    .zsb-pad-stamp {
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      border-radius: 4px;
      padding: 5px 8px;
      text-align: center;
      flex-shrink: 0;
    }
    .zsb-pad-stamp-title {
      font-size: 8px;
      font-weight: 800;
      color: #273E56;
      letter-spacing: 0.04em;
    }
    .zsb-pad-stamp-meta {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8.5px;
      font-weight: 700;
      color: #b45309;
      margin-top: 2px;
    }
    .zsb-pad-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 14px;
      border-top: 2px solid #273E56;
      border-bottom: 5px solid #273E56;
      font-size: 9px;
      color: #334155;
      background: #ffffff;
    }
    #print-root {
      padding: 10px 12px;
      background: #ffffff;
    }
    .print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 10px;
      margin: 0 auto 16px auto;
      max-width: 194mm;
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
    #print-root table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; font-variant-numeric: tabular-nums !important; }
    #print-root th, #print-root td { vertical-align: middle !important; box-sizing: border-box !important; }
    @media print {
      .print-bar { display: none !important; }
      body { padding: 0 !important; margin: 0 !important; }
      .zsb-a4-pad-shell { max-width: 100% !important; width: 100% !important; }
      .print-page-number-counter {
        position: fixed;
        bottom: 2mm;
        right: 5mm;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        font-weight: 800;
        color: #334155;
        background: #ffffff;
        padding: 2px 6px;
        border-radius: 4px;
        z-index: 9999;
      }
      .print-page-number-counter * { display: none !important; }
      .print-page-number-counter::after {
        content: "Page " counter(page) " of " counter(pages);
        display: inline !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div class="print-brand">
      <div class="print-brand-logo">
        <img src="${topBarLogoSrc}" alt="${escapeHtml(pad.companyName)}" />
      </div>
      <div>
        <span style="color:#ffe066;font-weight:900;font-size:18px;letter-spacing:0.08em;font-family:'Cinzel',Georgia,serif;">${escapeHtml(pad.companyName)}</span>
        <span style="color:#94a3b8;margin:0 8px;">|</span>
        <span style="font-weight:600;font-size:13px;color:#f8fafc;">Official A4 Company Pad Document</span>
      </div>
    </div>
    <div class="print-actions">
      <button class="btn-print" onclick="window.print()">Print Now (A4 Company Pad)</button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <table class="zsb-a4-pad-shell">
    <thead>
      <tr>
        <td>
          <div class="zsb-pad-top-bar"></div>
          <div class="zsb-pad-header">
            <div class="zsb-pad-header-logo">
              <img src="${topBarLogoSrc}" alt="${escapeHtml(pad.companyName)}" />
            </div>
            <div class="zsb-pad-header-center">
              <div class="zsb-pad-company-name">${escapeHtml(pad.companyName.toUpperCase())}</div>
              <div class="zsb-pad-tagline">${escapeHtml(pad.tagline)}</div>
              ${pad.address ? `<div class="zsb-pad-address">Address: ${escapeHtml(pad.address)}</div>` : ''}
              ${pad.contactLine ? `<div class="zsb-pad-contact">${escapeHtml(pad.contactLine)}</div>` : ''}
            </div>
            <div class="zsb-pad-stamp">
              <div class="zsb-pad-stamp-title">OFFICIAL COMPANY PAD</div>
              <div class="zsb-pad-stamp-meta">A4 · ${escapeHtml(todayFormatted)}</div>
            </div>
          </div>
        </td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div id="print-root">
            ${clonedElement.outerHTML}
          </div>
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td>
          <div class="zsb-pad-footer">
            <strong style="color:#273E56;">${escapeHtml(pad.footerLeft)}</strong>
            <span>${escapeHtml(pad.footerCenter)}</span>
            <strong style="color:#0f172a;">ISO A4 · Official Pad</strong>
          </div>
        </td>
      </tr>
    </tfoot>
  </table>

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

  // Print using an isolated hidden iframe so printing works cleanly inside sandboxed iframes without window.open popups
  const existingFrame = document.getElementById('zsb-hidden-print-frame');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'zsb-hidden-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.srcdoc = htmlContent;
  document.body.appendChild(iframe);

  const cleanupFrame = () => {
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1500);
  };

  iframe.addEventListener('load', () => {
    try {
      iframe.contentWindow?.addEventListener('afterprint', cleanupFrame, { once: true });
    } catch {
      // ignore cross-context listener errors
    }
    setTimeout(cleanupFrame, 15000);
  });

  return true;
}

