/**
 * Curated CSS property subset and helpers for fast SVG <foreignObject> PDF/PNG exports.
 * Replaces full ~380-property getComputedStyle iteration (~5x-10x faster serialization).
 */

export const ESSENTIAL_EXPORT_CSS_PROPS: readonly string[] = [
  'box-sizing',
  'display',
  'visibility',
  'opacity',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'float',
  'clear',
  'overflow',
  'overflow-x',
  'overflow-y',
  // Box geometry & spacing
  'width',
  'min-width',
  'max-width',
  'height',
  'min-height',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  // Flexbox & Grid
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-items',
  'align-content',
  'align-self',
  'justify-content',
  'justify-items',
  'justify-self',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  // Table layout
  'table-layout',
  'border-collapse',
  'border-spacing',
  'vertical-align',
  'caption-side',
  // Typography
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant-numeric',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-style',
  'text-shadow',
  'white-space',
  'word-break',
  'overflow-wrap',
  // Color & Background
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  // Borders & Corners
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-right-width',
  'border-right-style',
  'border-right-color',
  'border-bottom-width',
  'border-bottom-style',
  'border-bottom-color',
  'border-left-width',
  'border-left-style',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  // Shadows, Images & SVG graphics
  'box-shadow',
  'object-fit',
  'object-position',
  'transform',
  'transform-origin',
  'list-style-type',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
] as const;

/**
 * Returns true if a CSS value requires conversion from oklch/oklab/color-mix/color()
 * into legacy rgb()/rgba() for canvas/SVG compatibility.
 */
export function needsLegacyColorConversion(value: string): boolean {
  if (!value) return false;
  return (
    value.includes('oklch') ||
    value.includes('oklab') ||
    value.includes('color-mix') ||
    value.includes('color(')
  );
}

/**
 * Skips redundant default/no-op computed CSS property values to keep serialized SVG small and fast.
 */
export function shouldSkipExportCssValue(prop: string, val: string): boolean {
  if (!val) return true;
  if (prop === 'background-image' && val.includes('url(') && !val.includes('data:image/')) {
    return true;
  }
  switch (prop) {
    case 'background-image':
    case 'box-shadow':
    case 'text-shadow':
    case 'transform':
    case 'text-decoration-line':
    case 'list-style-type':
      return val === 'none';
    case 'background-color':
      return val === 'rgba(0, 0, 0, 0)' || val === 'transparent';
    case 'position':
      return val === 'static';
    case 'top':
    case 'right':
    case 'bottom':
    case 'left':
    case 'z-index':
    case 'min-width':
    case 'min-height':
      return val === 'auto';
    case 'max-width':
    case 'max-height':
      return val === 'none';
    case 'opacity':
      return val === '1';
    case 'visibility':
      return val === 'visible';
    case 'overflow':
    case 'overflow-x':
    case 'overflow-y':
      return val === 'visible';
    case 'float':
    case 'clear':
      return val === 'none';
    case 'font-style':
    case 'letter-spacing':
    case 'word-break':
    case 'overflow-wrap':
      return val === 'normal';
    case 'text-transform':
      return val === 'none';
    case 'margin-top':
    case 'margin-right':
    case 'margin-bottom':
    case 'margin-left':
    case 'padding-top':
    case 'padding-right':
    case 'padding-bottom':
    case 'padding-left':
    case 'border-top-width':
    case 'border-right-width':
    case 'border-bottom-width':
    case 'border-left-width':
    case 'border-top-left-radius':
    case 'border-top-right-radius':
    case 'border-bottom-right-radius':
    case 'border-bottom-left-radius':
      return val === '0px';
    case 'border-top-style':
    case 'border-right-style':
    case 'border-bottom-style':
    case 'border-left-style':
      return val === 'none';
    case 'row-gap':
    case 'column-gap':
      return val === 'normal' || val === '0px';
    default:
      return false;
  }
}

/**
 * Infers jsPDF addImage format ('PNG' | 'JPEG') from a data URL.
 */
export function getJsPdfImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  const lower = (dataUrl || '').slice(0, 40).toLowerCase();
  if (lower.startsWith('data:image/jpeg') || lower.startsWith('data:image/jpg')) {
    return 'JPEG';
  }
  return 'PNG';
}

/**
 * Yields to a single browser animation frame (instead of fixed setTimeout sleeps)
 * so offscreen printable DOM nodes finish painting before capture.
 */
export function yieldForDomFrame(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return Promise.resolve();
}

/**
 * Computes proportional integer target dimensions bounded by maxDim
 * so embedded logos and signatures inside SVG/PDF exports stay compact and fast to serialize.
 */
export function getScaledDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxDim: number = 256
): { width: number; height: number } {
  const w = Math.max(1, Math.round(naturalWidth));
  const h = Math.max(1, Math.round(naturalHeight));
  const limit = Math.max(1, Math.round(maxDim));
  if (w <= limit && h <= limit) {
    return { width: w, height: h };
  }
  const ratio = Math.min(limit / w, limit / h);
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
  };
}

