import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRippleGeometry,
  isEligibleTouchFeedbackButton,
  isSmartMobileModeActive,
  SMART_MOBILE_MODE_VALUE,
} from './mobileTouchFeedback.ts';

class FakeEl {
  private attrs: Record<string, string>;
  disabled: boolean;
  private parentMode: string | null;

  constructor(
    attrs: Record<string, string> = {},
    options: { disabled?: boolean; parentMode?: string | null } = {}
  ) {
    this.attrs = { ...attrs };
    this.disabled = Boolean(options.disabled);
    this.parentMode = options.parentMode ?? null;
  }

  getAttribute(name: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }

  closest(selector: string): FakeEl | null {
    if (selector === '[data-display-mode]' && this.parentMode) {
      return new FakeEl({ 'data-display-mode': this.parentMode });
    }
    return null;
  }
}

describe('mobileTouchFeedback utility', () => {
  it('activates only in smart_mobile display mode and rejects desktop_full mode', () => {
    const mobileBtn = new FakeEl({}, { parentMode: SMART_MOBILE_MODE_VALUE }) as unknown as Element;
    const desktopBtn = new FakeEl({}, { parentMode: 'desktop_full' }) as unknown as Element;

    assert.equal(isSmartMobileModeActive(mobileBtn), true);
    assert.equal(isSmartMobileModeActive(desktopBtn), false);

    const mockDocMobile = {
      querySelector: () => new FakeEl({ 'data-display-mode': 'smart_mobile' }),
      documentElement: new FakeEl({ 'data-display-mode': 'smart_mobile' }),
    } as unknown as Document;

    const mockDocDesktop = {
      querySelector: () => new FakeEl({ 'data-display-mode': 'desktop_full' }),
      documentElement: new FakeEl({ 'data-display-mode': 'desktop_full' }),
    } as unknown as Document;

    assert.equal(isSmartMobileModeActive(null, mockDocMobile), true);
    assert.equal(isSmartMobileModeActive(null, mockDocDesktop), false);
  });

  it('filters out disabled buttons, cell triggers, and column resize handles', () => {
    const normalBtn = new FakeEl({ 'data-testid': 'save-btn' }) as unknown as Element;
    const mobileNavBtn = new FakeEl({ 'data-mobile-chrome-btn': 'true' }) as unknown as Element;
    const disabledBtn = new FakeEl({ 'data-testid': 'save-btn' }, { disabled: true }) as unknown as Element;
    const ariaDisabledBtn = new FakeEl({ 'aria-disabled': 'true' }) as unknown as Element;
    const cellTrigger = new FakeEl({ 'data-testid': 'db-cell-trigger-row-1' }) as unknown as Element;
    const resizeHandle = new FakeEl({ 'data-col-resize-handle': 'true' }) as unknown as Element;

    assert.equal(isEligibleTouchFeedbackButton(normalBtn), true);
    assert.equal(isEligibleTouchFeedbackButton(mobileNavBtn), true);
    assert.equal(isEligibleTouchFeedbackButton(disabledBtn), false);
    assert.equal(isEligibleTouchFeedbackButton(ariaDisabledBtn), false);
    assert.equal(isEligibleTouchFeedbackButton(cellTrigger), false);
    assert.equal(isEligibleTouchFeedbackButton(resizeHandle), false);
    assert.equal(isEligibleTouchFeedbackButton(null), false);
  });

  it('computes ripple coordinates and diameter covering the farthest corner', () => {
    const rect = { left: 100, top: 200, width: 120, height: 40 };

    // Center tap
    const center = computeRippleGeometry(rect, 160, 220);
    assert.equal(center.x, 60);
    assert.equal(center.y, 20);
    // Distance from center (60, 20) to corner is hypot(60, 20) = 63.245 -> diameter ~ 126
    assert.equal(center.diameter, 126);

    // Edge tap (left edge) needs larger diameter to reach right corner
    const edge = computeRippleGeometry(rect, 100, 220);
    assert.equal(edge.x, 0);
    assert.equal(edge.y, 20);
    assert.ok(edge.diameter > center.diameter);
    assert.equal(edge.diameter, Math.round(Math.hypot(120, 20) * 2));

    // Synthetic (0, 0) tap falls back to center
    const synthetic = computeRippleGeometry(rect, 0, 0);
    assert.equal(synthetic.x, 60);
    assert.equal(synthetic.y, 20);
  });

  it('clamps ripple diameter for very small and very wide buttons', () => {
    const tiny = computeRippleGeometry({ left: 0, top: 0, width: 8, height: 8 }, 4, 4);
    assert.equal(tiny.diameter, 24);

    const huge = computeRippleGeometry({ left: 0, top: 0, width: 900, height: 60 }, 0, 30);
    assert.equal(huge.diameter, 420);
  });
});
