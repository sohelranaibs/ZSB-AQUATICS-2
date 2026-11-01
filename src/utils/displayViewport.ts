export type DisplayMode = 'smart_mobile' | 'desktop_full';

export const MIN_ZOOM_PERCENT = 40;
export const MAX_ZOOM_PERCENT = 200;
export const DEFAULT_ZOOM_PERCENT = 100;
export const ZOOM_STEP_PERCENT = 10;
export const DESKTOP_VIEW_WIDTH_PX = 1440;
export const MOBILE_BREAKPOINT_PX = 768;
export const TABLET_BREAKPOINT_PX = 1024;

export const ZOOM_PRESETS: readonly number[] = [50, 75, 90, 100, 110, 125, 150, 175, 200];

export interface DisplayPreferences {
  displayMode: DisplayMode;
  zoomPercent: number;
  smartMobileCompactHeader: boolean;
}

export interface ViewportLayoutMetrics {
  isMobileViewport: boolean;
  isTabletViewport: boolean;
  displayMode: DisplayMode;
  userZoomPercent: number;
  effectiveScale: number;
  effectivePercentLabel: string;
  canvasMinWidthPx: number | null;
  modeBadgeText: string;
  viewportMetaContent: string;
}

const STORAGE_KEY = 'zsb_aquatics_display_prefs_v1';

export function clampZoomPercent(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return DEFAULT_ZOOM_PERCENT;
  }
  const rounded = Math.round(zoom);
  return Math.max(MIN_ZOOM_PERCENT, Math.min(MAX_ZOOM_PERCENT, rounded));
}

export function stepZoomPercent(
  currentZoom: number,
  direction: 'in' | 'out' | 'reset',
  step: number = ZOOM_STEP_PERCENT
): number {
  if (direction === 'reset') {
    return DEFAULT_ZOOM_PERCENT;
  }
  const safeCurrent = clampZoomPercent(currentZoom);
  const safeStep = Number.isFinite(step) && step > 0 ? Math.round(step) : ZOOM_STEP_PERCENT;
  if (direction === 'in') {
    return clampZoomPercent(safeCurrent + safeStep);
  }
  return clampZoomPercent(safeCurrent - safeStep);
}

export function computeViewportLayoutMetrics(params: {
  viewportWidth: number;
  viewportHeight?: number;
  displayMode: DisplayMode;
  zoomPercent: number;
}): ViewportLayoutMetrics {
  const safeWidth =
    Number.isFinite(params.viewportWidth) && params.viewportWidth > 0
      ? params.viewportWidth
      : 1280;
  const isMobileViewport = safeWidth < MOBILE_BREAKPOINT_PX;
  const isTabletViewport = safeWidth >= MOBILE_BREAKPOINT_PX && safeWidth < TABLET_BREAKPOINT_PX;
  const userZoomPercent = clampZoomPercent(params.zoomPercent);
  const userScale = userZoomPercent / 100;

  if (params.displayMode === 'desktop_full') {
    // In Desktop Full View, render the full 1440px desktop workbook layout.
    // On screens narrower than 1440px, automatically fit the 1440px sheet into the viewport width,
    // then multiply by the user's manual zoom adjustment so they can zoom in/out smoothly.
    const desktopFitRatio =
      safeWidth < DESKTOP_VIEW_WIDTH_PX
        ? Math.max(0.26, Math.min(1, safeWidth / DESKTOP_VIEW_WIDTH_PX))
        : 1;
    const rawEffectiveScale = Number((desktopFitRatio * userScale).toFixed(3));
    const effectiveScale = Math.max(0.25, Math.min(2.5, rawEffectiveScale));
    const effectivePercent = Math.round(effectiveScale * 100);

    return {
      isMobileViewport,
      isTabletViewport,
      displayMode: 'desktop_full',
      userZoomPercent,
      effectiveScale,
      effectivePercentLabel:
        safeWidth < DESKTOP_VIEW_WIDTH_PX && userZoomPercent === 100
          ? `Fit (${effectivePercent}%)`
          : `${userZoomPercent}%`,
      canvasMinWidthPx: DESKTOP_VIEW_WIDTH_PX,
      modeBadgeText: 'Desktop View (1440px)',
      viewportMetaContent:
        'width=device-width, initial-scale=1.0, minimum-scale=0.25, maximum-scale=5.0, user-scalable=yes',
    };
  }

  // Smart Mobile Display Adjust mode
  const effectiveScale = Number(userScale.toFixed(3));
  return {
    isMobileViewport,
    isTabletViewport,
    displayMode: 'smart_mobile',
    userZoomPercent,
    effectiveScale,
    effectivePercentLabel: `${userZoomPercent}%`,
    canvasMinWidthPx: null,
    modeBadgeText: isMobileViewport
      ? 'Smart Mobile Auto-Fit'
      : isTabletViewport
      ? 'Smart Tablet Adjust'
      : 'Smart Display',
    viewportMetaContent:
      'width=device-width, initial-scale=1.0, minimum-scale=0.25, maximum-scale=5.0, user-scalable=yes',
  };
}

export const SWIPE_LOCK_THRESHOLD_PX = 6;
export const SWIPE_AXIS_DOMINANCE_RATIO = 1.1;
export const SWIPE_SCROLL_MULTIPLIER = 1.35;
export const SWIPE_MOMENTUM_DURATION_MS = 380;
export const SWIPE_MOMENTUM_VELOCITY_MULTIPLIER = 1.65;
export const SWIPE_MOMENTUM_MIN_VELOCITY = 0.04;

export interface HorizontalScrollState {
  scrollLeft: number;
  maxScrollLeft: number;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollProgressPercent: number;
}

/**
 * Determines whether a touch/pointer movement should lock into a horizontal swipe-to-scroll gesture
 * rather than a vertical page scroll or accidental tap jitter.
 */
export function shouldLockHorizontalSwipe(
  deltaX: number,
  deltaY: number,
  thresholdPx: number = SWIPE_LOCK_THRESHOLD_PX
): boolean {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    return false;
  }
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const safeThreshold = Number.isFinite(thresholdPx) && thresholdPx > 0 ? thresholdPx : SWIPE_LOCK_THRESHOLD_PX;
  return absX >= safeThreshold && absX >= absY * SWIPE_AXIS_DOMINANCE_RATIO;
}

/**
 * Computes the clamped horizontal `scrollLeft` position resulting from a swipe delta.
 * Swiping left (negative deltaX) advances scrollLeft to the right (positive increase).
 */
export function computeSwipeScrollLeft(params: {
  startScrollLeft: number;
  deltaX: number;
  maxScrollLeft: number;
  multiplier?: number;
}): number {
  const safeStart = Number.isFinite(params.startScrollLeft) ? params.startScrollLeft : 0;
  const safeDeltaX = Number.isFinite(params.deltaX) ? params.deltaX : 0;
  const safeMax = Number.isFinite(params.maxScrollLeft) ? Math.max(0, Math.round(params.maxScrollLeft)) : 0;
  const safeMultiplier =
    typeof params.multiplier === 'number' && Number.isFinite(params.multiplier) && params.multiplier > 0
      ? params.multiplier
      : SWIPE_SCROLL_MULTIPLIER;

  const rawTarget = Math.round(safeStart - safeDeltaX * safeMultiplier);
  return Math.max(0, Math.min(safeMax, rawTarget));
}

/**
 * Computes the projected horizontal `scrollLeft` after release based on swipe velocity (px/ms),
 * tuned with a higher velocity multiplier and lower sensitivity threshold for fluid low-friction mobile touch screens.
 */
export function computeMomentumScrollLeft(params: {
  currentScrollLeft: number;
  velocityXPerMs: number;
  maxScrollLeft: number;
  durationMs?: number;
  velocityMultiplier?: number;
  minVelocityThreshold?: number;
}): number {
  const safeCurrent = Number.isFinite(params.currentScrollLeft) ? params.currentScrollLeft : 0;
  const safeVelocity = Number.isFinite(params.velocityXPerMs) ? params.velocityXPerMs : 0;
  const safeMax = Number.isFinite(params.maxScrollLeft) ? Math.max(0, Math.round(params.maxScrollLeft)) : 0;
  const safeDuration =
    typeof params.durationMs === 'number' && Number.isFinite(params.durationMs) && params.durationMs >= 0
      ? params.durationMs
      : SWIPE_MOMENTUM_DURATION_MS;
  const safeVelocityMultiplier =
    typeof params.velocityMultiplier === 'number' &&
    Number.isFinite(params.velocityMultiplier) &&
    params.velocityMultiplier > 0
      ? params.velocityMultiplier
      : SWIPE_MOMENTUM_VELOCITY_MULTIPLIER;
  const safeMinThreshold =
    typeof params.minVelocityThreshold === 'number' &&
    Number.isFinite(params.minVelocityThreshold) &&
    params.minVelocityThreshold >= 0
      ? params.minVelocityThreshold
      : SWIPE_MOMENTUM_MIN_VELOCITY;

  // Ignore micro-jitter below sensitivity threshold while allowing gentle low-friction touch flicks
  if (Math.abs(safeVelocity) < safeMinThreshold) {
    return Math.max(0, Math.min(safeMax, Math.round(safeCurrent)));
  }

  const momentumDelta = safeVelocity * safeVelocityMultiplier * safeDuration;
  const rawTarget = Math.round(safeCurrent - momentumDelta);
  return Math.max(0, Math.min(safeMax, rawTarget));
}

/**
 * Computes normalized horizontal scroll metrics for the sheet viewport wrapper.
 */
export function computeHorizontalScrollState(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number
): HorizontalScrollState {
  const safeScrollWidth = Number.isFinite(scrollWidth) && scrollWidth > 0 ? scrollWidth : 0;
  const safeClientWidth = Number.isFinite(clientWidth) && clientWidth > 0 ? clientWidth : 0;
  const maxScrollLeft = Math.max(0, Math.round(safeScrollWidth - safeClientWidth));
  const safeScrollLeft = Number.isFinite(scrollLeft) ? Math.round(scrollLeft) : 0;
  const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, safeScrollLeft));

  return {
    scrollLeft: clampedScrollLeft,
    maxScrollLeft,
    canScrollLeft: clampedScrollLeft > 1,
    canScrollRight: maxScrollLeft - clampedScrollLeft > 1,
    scrollProgressPercent:
      maxScrollLeft > 0 ? Math.min(100, Math.max(0, Math.round((clampedScrollLeft / maxScrollLeft) * 100))) : 0,
  };
}

export function loadDisplayPreferences(): DisplayPreferences {
  const fallback: DisplayPreferences = {
    displayMode: 'smart_mobile',
    zoomPercent: DEFAULT_ZOOM_PERCENT,
    smartMobileCompactHeader: true,
  };
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DisplayPreferences>;
    return {
      displayMode:
        parsed.displayMode === 'desktop_full' || parsed.displayMode === 'smart_mobile'
          ? parsed.displayMode
          : 'smart_mobile',
      zoomPercent: clampZoomPercent(
        typeof parsed.zoomPercent === 'number' ? parsed.zoomPercent : DEFAULT_ZOOM_PERCENT
      ),
      smartMobileCompactHeader:
        typeof parsed.smartMobileCompactHeader === 'boolean'
          ? parsed.smartMobileCompactHeader
          : true,
    };
  } catch {
    return fallback;
  }
}

export function saveDisplayPreferences(prefs: DisplayPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        displayMode: prefs.displayMode,
        zoomPercent: clampZoomPercent(prefs.zoomPercent),
        smartMobileCompactHeader: Boolean(prefs.smartMobileCompactHeader),
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

