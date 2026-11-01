import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampZoomPercent,
  stepZoomPercent,
  computeViewportLayoutMetrics,
  shouldLockHorizontalSwipe,
  computeSwipeScrollLeft,
  computeMomentumScrollLeft,
  computeHorizontalScrollState,
  MIN_ZOOM_PERCENT,
  MAX_ZOOM_PERCENT,
  DEFAULT_ZOOM_PERCENT,
  DESKTOP_VIEW_WIDTH_PX,
  SWIPE_MOMENTUM_VELOCITY_MULTIPLIER,
  SWIPE_MOMENTUM_MIN_VELOCITY,
  PASSIVE_TOUCH_LISTENER_OPTIONS,
  bindPassiveTouchListeners,
} from './displayViewport.ts';

describe('displayViewport utilities', () => {
  it('clamps zoom percentage within [MIN_ZOOM_PERCENT, MAX_ZOOM_PERCENT]', () => {
    assert.equal(clampZoomPercent(100), 100);
    assert.equal(clampZoomPercent(10), MIN_ZOOM_PERCENT);
    assert.equal(clampZoomPercent(350), MAX_ZOOM_PERCENT);
    assert.equal(clampZoomPercent(Number.NaN), DEFAULT_ZOOM_PERCENT);
  });

  it('steps zoom in, out, and resets accurately', () => {
    assert.equal(stepZoomPercent(100, 'in', 10), 110);
    assert.equal(stepZoomPercent(100, 'out', 10), 90);
    assert.equal(stepZoomPercent(145, 'reset'), 100);
    assert.equal(stepZoomPercent(200, 'in', 10), MAX_ZOOM_PERCENT);
    assert.equal(stepZoomPercent(40, 'out', 10), MIN_ZOOM_PERCENT);
  });

  it('computes Smart Mobile Auto-Fit metrics on mobile viewports (< 768px)', () => {
    const metrics = computeViewportLayoutMetrics({
      viewportWidth: 390,
      viewportHeight: 844,
      displayMode: 'smart_mobile',
      zoomPercent: 100,
    });
    assert.equal(metrics.isMobileViewport, true);
    assert.equal(metrics.isTabletViewport, false);
    assert.equal(metrics.displayMode, 'smart_mobile');
    assert.equal(metrics.effectiveScale, 1);
    assert.equal(metrics.canvasMinWidthPx, null);
    assert.equal(metrics.modeBadgeText, 'Smart Mobile Auto-Fit');
  });

  it('computes Desktop View (1440px) auto-fit scaling on mobile viewports and supports zoom in/out', () => {
    const mobileDesktopFit = computeViewportLayoutMetrics({
      viewportWidth: 390,
      viewportHeight: 844,
      displayMode: 'desktop_full',
      zoomPercent: 100,
    });
    assert.equal(mobileDesktopFit.isMobileViewport, true);
    assert.equal(mobileDesktopFit.displayMode, 'desktop_full');
    assert.equal(mobileDesktopFit.canvasMinWidthPx, DESKTOP_VIEW_WIDTH_PX);
    assert.ok(mobileDesktopFit.effectiveScale < 0.35 && mobileDesktopFit.effectiveScale >= 0.26);
    assert.match(mobileDesktopFit.effectivePercentLabel, /^Fit \(\d+%\)$/);

    const zoomedInDesktopOnMobile = computeViewportLayoutMetrics({
      viewportWidth: 390,
      viewportHeight: 844,
      displayMode: 'desktop_full',
      zoomPercent: 150,
    });
    assert.ok(zoomedInDesktopOnMobile.effectiveScale > mobileDesktopFit.effectiveScale);
    assert.equal(zoomedInDesktopOnMobile.effectivePercentLabel, '150%');
  });

  it('computes 1:1 scale on 1440px+ desktop viewports at 100% zoom', () => {
    const desktopMetrics = computeViewportLayoutMetrics({
      viewportWidth: 1440,
      viewportHeight: 900,
      displayMode: 'desktop_full',
      zoomPercent: 100,
    });
    assert.equal(desktopMetrics.isMobileViewport, false);
    assert.equal(desktopMetrics.effectiveScale, 1);
    assert.equal(desktopMetrics.canvasMinWidthPx, DESKTOP_VIEW_WIDTH_PX);
  });

  it('detects horizontal swipe lock accurately while ignoring vertical scrolling or tiny taps', () => {
    assert.equal(shouldLockHorizontalSwipe(-32, 4), true);
    assert.equal(shouldLockHorizontalSwipe(24, -6), true);
    assert.equal(shouldLockHorizontalSwipe(4, 1), false); // below threshold
    assert.equal(shouldLockHorizontalSwipe(15, 25), false); // predominantly vertical
  });

  it('computes clamped horizontal scrollLeft for swipe gestures and momentum', () => {
    // Swiping left (deltaX = -100) scrolls right (increases scrollLeft)
    const scrolledRight = computeSwipeScrollLeft({
      startScrollLeft: 50,
      deltaX: -100,
      maxScrollLeft: 600,
      multiplier: 1,
    });
    assert.equal(scrolledRight, 150);

    // Clamps to maxScrollLeft
    const clampedMax = computeSwipeScrollLeft({
      startScrollLeft: 550,
      deltaX: -200,
      maxScrollLeft: 600,
      multiplier: 1,
    });
    assert.equal(clampedMax, 600);

    // Clamps to 0 when swiping right past start
    const clampedZero = computeSwipeScrollLeft({
      startScrollLeft: 40,
      deltaX: 120,
      maxScrollLeft: 600,
      multiplier: 1,
    });
    assert.equal(clampedZero, 0);

    // Momentum projection with increased velocity multiplier (1.65)
    assert.equal(SWIPE_MOMENTUM_VELOCITY_MULTIPLIER, 1.65);
    assert.equal(SWIPE_MOMENTUM_MIN_VELOCITY, 0.04);
    const momentumRight = computeMomentumScrollLeft({
      currentScrollLeft: 150,
      velocityXPerMs: -0.8,
      maxScrollLeft: 600,
      durationMs: 250,
    });
    assert.equal(momentumRight, 480);

    // Gentle low-friction touch flick (|velocity| = 0.05 >= 0.04 threshold) triggers fluid momentum
    const gentleFlickRight = computeMomentumScrollLeft({
      currentScrollLeft: 150,
      velocityXPerMs: -0.05,
      maxScrollLeft: 600,
      durationMs: 380,
    });
    assert.equal(gentleFlickRight, 181);

    // Sub-threshold micro-jitter (|velocity| = 0.02 < 0.04 threshold) does not move scrollLeft
    const microJitter = computeMomentumScrollLeft({
      currentScrollLeft: 150,
      velocityXPerMs: -0.02,
      maxScrollLeft: 600,
    });
    assert.equal(microJitter, 150);
  });

  it('computes horizontal scroll state and progress percentage accurately', () => {
    const atStart = computeHorizontalScrollState(0, 1000, 400);
    assert.equal(atStart.maxScrollLeft, 600);
    assert.equal(atStart.canScrollLeft, false);
    assert.equal(atStart.canScrollRight, true);
    assert.equal(atStart.scrollProgressPercent, 0);

    const midScroll = computeHorizontalScrollState(300, 1000, 400);
    assert.equal(midScroll.scrollLeft, 300);
    assert.equal(midScroll.canScrollLeft, true);
    assert.equal(midScroll.canScrollRight, true);
    assert.equal(midScroll.scrollProgressPercent, 50);

    const atEnd = computeHorizontalScrollState(600, 1000, 400);
    assert.equal(atEnd.canScrollLeft, true);
    assert.equal(atEnd.canScrollRight, false);
    assert.equal(atEnd.scrollProgressPercent, 100);
  });

  it('registers and cleans up passive touchstart and touchmove listeners with { passive: true }', () => {
    assert.equal(PASSIVE_TOUCH_LISTENER_OPTIONS.passive, true);
    assert.equal(PASSIVE_TOUCH_LISTENER_OPTIONS.capture, false);

    const added: Array<{ type: string; options: unknown }> = [];
    const removed: Array<{ type: string; options: unknown }> = [];
    const listeners = new Map<string, (event: TouchEvent) => void>();

    const mockTarget = {
      addEventListener(type: string, listener: (event: TouchEvent) => void, options?: unknown) {
        added.push({ type, options });
        listeners.set(type, listener);
      },
      removeEventListener(type: string, _listener: (event: TouchEvent) => void, options?: unknown) {
        removed.push({ type, options });
        listeners.delete(type);
      },
    };

    let startCalls = 0;
    let moveCalls = 0;
    let endCalls = 0;

    const unbind = bindPassiveTouchListeners(mockTarget, {
      onTouchStart: () => {
        startCalls += 1;
      },
      onTouchMove: () => {
        moveCalls += 1;
      },
      onTouchEnd: () => {
        endCalls += 1;
      },
    });

    assert.equal(added.length, 4);
    for (const entry of added) {
      assert.deepEqual(entry.options, { passive: true, capture: false });
    }
    assert.deepEqual(
      added.map((e) => e.type),
      ['touchstart', 'touchmove', 'touchend', 'touchcancel']
    );

    listeners.get('touchstart')?.({} as TouchEvent);
    listeners.get('touchmove')?.({} as TouchEvent);
    listeners.get('touchend')?.({} as TouchEvent);
    assert.equal(startCalls, 1);
    assert.equal(moveCalls, 1);
    assert.equal(endCalls, 1);

    unbind();
    assert.equal(removed.length, 4);
    assert.equal(listeners.size, 0);
  });
});

