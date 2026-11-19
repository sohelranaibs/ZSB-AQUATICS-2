import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESSENTIAL_EXPORT_CSS_PROPS,
  buildInlineExportStyleText,
  needsLegacyColorConversion,
  shouldSkipExportCssValue,
  getJsPdfImageFormat,
  getScaledDimensions,
} from './pdfExportStyles.ts';

describe('pdfExportStyles pure optimization helpers', () => {
  it('keeps essential layout, table, typography, flex, grid, and svg CSS properties concise', () => {
    assert.ok(ESSENTIAL_EXPORT_CSS_PROPS.length >= 60 && ESSENTIAL_EXPORT_CSS_PROPS.length <= 120);
    assert.ok(ESSENTIAL_EXPORT_CSS_PROPS.includes('display'));
    assert.ok(ESSENTIAL_EXPORT_CSS_PROPS.includes('border-collapse'));
    assert.ok(ESSENTIAL_EXPORT_CSS_PROPS.includes('grid-template-columns'));
    assert.ok(ESSENTIAL_EXPORT_CSS_PROPS.includes('font-variant-numeric'));
    assert.ok(ESSENTIAL_EXPORT_CSS_PROPS.includes('text-overflow'));
    assert.ok(ESSENTIAL_EXPORT_CSS_PROPS.includes('fill'));
  });

  it('skips redundant default computed values and unsafe external url() backgrounds', () => {
    assert.equal(shouldSkipExportCssValue('box-shadow', 'none'), true);
    assert.equal(shouldSkipExportCssValue('box-shadow', '0px 1px 2px rgba(0,0,0,0.1)'), false);
    assert.equal(shouldSkipExportCssValue('background-color', 'rgba(0, 0, 0, 0)'), true);
    assert.equal(shouldSkipExportCssValue('background-color', 'rgb(255, 255, 255)'), false);
    assert.equal(shouldSkipExportCssValue('border-top-width', '0px'), true);
    assert.equal(shouldSkipExportCssValue('border-top-width', '1px'), false);
    assert.equal(shouldSkipExportCssValue('opacity', '1'), true);
    assert.equal(shouldSkipExportCssValue('opacity', '0.5'), false);
    assert.equal(
      shouldSkipExportCssValue('background-image', 'url("https://example.com/bg.png")'),
      true
    );
    assert.equal(
      shouldSkipExportCssValue('background-image', 'url("data:image/png;base64,AAA")'),
      false
    );
  });

  it('prevents orphan border-*-style:solid when border-*-width is 0px (Tailwind Preflight)', () => {
    const mockStyles: Record<string, string> = {
      display: 'block',
      'border-top-width': '0px',
      'border-top-style': 'solid',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-width': '0px',
      'border-right-style': 'solid',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-width': '2px',
      'border-bottom-style': 'solid',
      'border-bottom-color': 'rgb(15, 23, 42)',
      'border-left-width': '0px',
      'border-left-style': 'solid',
      'border-left-color': 'rgb(0, 0, 0)',
      'border-top-left-radius': '4px',
    };
    const cssText = buildInlineExportStyleText((prop) => mockStyles[prop] || '');
    assert.equal(cssText.includes('border-top-style'), false);
    assert.equal(cssText.includes('border-top-color'), false);
    assert.equal(cssText.includes('border-right-style'), false);
    assert.equal(cssText.includes('border-left-style'), false);
    assert.equal(cssText.includes('border-bottom-width:2px;'), true);
    assert.equal(cssText.includes('border-bottom-style:solid;'), true);
    assert.equal(cssText.includes('border-bottom-color:rgb(15, 23, 42);'), true);
    assert.equal(cssText.includes('border-top-left-radius:4px;'), true);
  });

  it('detects modern color functions requiring rgb conversion', () => {
    assert.equal(needsLegacyColorConversion('oklch(0.5 0.2 240)'), true);
    assert.equal(needsLegacyColorConversion('oklab(0.6 0.1 -0.1)'), true);
    assert.equal(needsLegacyColorConversion('color-mix(in oklab, red, blue)'), true);
    assert.equal(needsLegacyColorConversion('rgb(39, 62, 86)'), false);
  });

  it('detects jsPDF image format from data URLs', () => {
    assert.equal(getJsPdfImageFormat('data:image/jpeg;base64,/9j/4AAQ'), 'JPEG');
    assert.equal(getJsPdfImageFormat('data:image/jpg;base64,/9j/4AAQ'), 'JPEG');
    assert.equal(getJsPdfImageFormat('data:image/png;base64,iVBORw0KGgo'), 'PNG');
  });

  it('scales oversized asset dimensions proportionally within maxDim', () => {
    assert.deepEqual(getScaledDimensions(2000, 1000, 256), { width: 256, height: 128 });
    assert.deepEqual(getScaledDimensions(100, 200, 256), { width: 100, height: 200 });
    assert.deepEqual(getScaledDimensions(1024, 1024, 256), { width: 256, height: 256 });
  });
});
