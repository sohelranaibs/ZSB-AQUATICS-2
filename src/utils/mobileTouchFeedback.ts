/**
 * Smart Mobile Button Tactile Touch Feedback (Subtle Ripple + Scale-Down)
 *
 * Activates ONLY when the application is in `'smart_mobile'` display mode
 * (`data-display-mode="smart_mobile"`). Provides immediate physical confirmation
 * when touching buttons via:
 *   1. Subtle GPU-accelerated scale-down (`data-zsb-touch-pressed="true"`)
 *   2. Clipped radial touch ripple inside `.zsb-touch-ripple-host` (so protruding
 *      button icon medallions remain unclipped)
 */

import { INTERACTIVE_BUTTON_SELECTOR, isEligibleClickedButton } from './buttonClickHighlight.ts';

export const TOUCH_PRESSED_ATTR = 'data-zsb-touch-pressed';
export const RIPPLE_POS_ATTR = 'data-zsb-ripple-pos';
export const RIPPLE_HOST_CLASS = 'zsb-touch-ripple-host';
export const RIPPLE_WAVE_CLASS = 'zsb-touch-ripple-wave';
export const SMART_MOBILE_MODE_VALUE = 'smart_mobile';
export const TOUCH_PRESS_SAFETY_RELEASE_MS = 450;
export const RIPPLE_CLEANUP_FALLBACK_MS = 520;

export interface ButtonRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RippleGeometry {
  x: number;
  y: number;
  diameter: number;
}

/**
 * Checks whether the current DOM is actively in `'smart_mobile'` display mode.
 */
export function isSmartMobileModeActive(
  targetEl: Element | null,
  rootDoc?: Document | null
): boolean {
  if (targetEl && typeof targetEl.closest === 'function') {
    const modeContainer = targetEl.closest('[data-display-mode]');
    if (modeContainer) {
      return modeContainer.getAttribute('data-display-mode') === SMART_MOBILE_MODE_VALUE;
    }
  }
  const doc = rootDoc ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return false;

  const workspace =
    typeof doc.querySelector === 'function'
      ? doc.querySelector('[data-display-mode]')
      : null;
  if (workspace) {
    return workspace.getAttribute('data-display-mode') === SMART_MOBILE_MODE_VALUE;
  }

  const docEl = doc.documentElement;
  if (docEl && typeof docEl.getAttribute === 'function') {
    return docEl.getAttribute('data-display-mode') === SMART_MOBILE_MODE_VALUE;
  }
  return false;
}

/**
 * Determines whether an element should receive tactile press/ripple feedback.
 */
export function isEligibleTouchFeedbackButton(el: Element | null): el is HTMLElement {
  if (!isEligibleClickedButton(el)) {
    return false;
  }
  // Skip table column resize handles
  if (el.getAttribute('data-col-resize-handle') === 'true') {
    return false;
  }
  return true;
}

/**
 * Computes exact ripple origin (relative to button top-left) and diameter to
 * reach the farthest corner of the button smoothly.
 */
export function computeRippleGeometry(
  rect: ButtonRectLike,
  clientX: number,
  clientY: number
): RippleGeometry {
  const width = Math.max(0, Number.isFinite(rect.width) ? rect.width : 0);
  const height = Math.max(0, Number.isFinite(rect.height) ? rect.height : 0);

  const hasValidPoint =
    Number.isFinite(clientX) &&
    Number.isFinite(clientY) &&
    !(clientX === 0 && clientY === 0);

  const rawX = hasValidPoint ? clientX - rect.left : width / 2;
  const rawY = hasValidPoint ? clientY - rect.top : height / 2;

  const x = Math.max(0, Math.min(width, rawX));
  const y = Math.max(0, Math.min(height, rawY));

  const distX = Math.max(x, width - x);
  const distY = Math.max(y, height - y);
  const radius = Math.hypot(distX, distY);
  const diameter = Math.round(Math.max(24, Math.min(420, radius * 2)));

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    diameter,
  };
}

/**
 * Returns true if the user's OS/browser requests reduced motion.
 */
export function prefersReducedMotion(win?: Window | null): boolean {
  const targetWin = win ?? (typeof window !== 'undefined' ? window : null);
  if (!targetWin || typeof targetWin.matchMedia !== 'function') {
    return false;
  }
  try {
    return targetWin.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Spawns a clipped radial ripple inside `btn` without altering `btn`'s overflow
 * (preserving protruding icon medallions) or overwriting `fixed`/`absolute`/`sticky` positioning.
 */
export function spawnButtonTouchRipple(
  btn: HTMLElement,
  clientX: number,
  clientY: number,
  doc: Document = document
): HTMLElement | null {
  if (prefersReducedMotion()) return null;

  const rect = btn.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return null;

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const computedPos = window.getComputedStyle(btn).position;
    if (computedPos === 'static') {
      btn.setAttribute(RIPPLE_POS_ATTR, 'relative');
    }
  }

  let host = btn.querySelector(`:scope > .${RIPPLE_HOST_CLASS}`) as HTMLElement | null;
  if (!host) {
    host = doc.createElement('span');
    host.className = RIPPLE_HOST_CLASS;
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('data-export-ignore', 'true');
    btn.appendChild(host);
  }

  const { x, y, diameter } = computeRippleGeometry(rect, clientX, clientY);
  const wave = doc.createElement('span');
  wave.className = RIPPLE_WAVE_CLASS;
  wave.setAttribute('aria-hidden', 'true');
  wave.style.width = `${diameter}px`;
  wave.style.height = `${diameter}px`;
  wave.style.left = `${x - diameter / 2}px`;
  wave.style.top = `${y - diameter / 2}px`;

  host.appendChild(wave);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    wave.remove();
    if (host && host.childElementCount === 0) {
      host.remove();
      if (btn.getAttribute(RIPPLE_POS_ATTR) === 'relative') {
        btn.removeAttribute(RIPPLE_POS_ATTR);
      }
    }
  };

  wave.addEventListener('animationend', cleanup, { once: true });
  if (typeof window !== 'undefined') {
    window.setTimeout(cleanup, RIPPLE_CLEANUP_FALLBACK_MS);
  }

  return wave;
}

/**
 * Binds global delegated tactile touch feedback (scale-down + ripple) for all buttons
 * whenever the app is in `'smart_mobile'` display mode.
 */
export function bindSmartMobileButtonTouchFeedback(rootDoc: Document = document): () => void {
  let activePressedBtn: HTMLElement | null = null;
  let releaseTimerId: number | null = null;
  let lastTouchStamp = 0;

  const clearPressedState = () => {
    if (releaseTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(releaseTimerId);
      releaseTimerId = null;
    }
    if (activePressedBtn) {
      activePressedBtn.removeAttribute(TOUCH_PRESSED_ATTR);
      activePressedBtn = null;
    }
  };

  const triggerPress = (target: EventTarget | null, clientX: number, clientY: number) => {
    if (!(target instanceof Element) || typeof target.closest !== 'function') return;

    const btn = target.closest(INTERACTIVE_BUTTON_SELECTOR) as HTMLElement | null;
    if (!isEligibleTouchFeedbackButton(btn)) return;
    if (!isSmartMobileModeActive(btn, rootDoc)) return;

    clearPressedState();
    btn.setAttribute(TOUCH_PRESSED_ATTR, 'true');
    activePressedBtn = btn;

    spawnButtonTouchRipple(btn, clientX, clientY, rootDoc);

    if (typeof window !== 'undefined') {
      releaseTimerId = window.setTimeout(() => {
        clearPressedState();
      }, TOUCH_PRESS_SAFETY_RELEASE_MS);
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    lastTouchStamp = Date.now();
    triggerPress(event.target, event.clientX, event.clientY);
  };

  const handleTouchStart = (event: TouchEvent) => {
    // Avoid double-triggering when PointerEvent already handled the touch
    if (Date.now() - lastTouchStamp < 50) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    triggerPress(event.target, touch.clientX, touch.clientY);
  };

  const handleRelease = () => {
    clearPressedState();
  };

  const handleVisibilityChange = () => {
    if (rootDoc.hidden) {
      clearPressedState();
    }
  };

  rootDoc.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
  rootDoc.addEventListener('pointerup', handleRelease, { capture: true, passive: true });
  rootDoc.addEventListener('pointercancel', handleRelease, { capture: true, passive: true });
  rootDoc.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
  rootDoc.addEventListener('touchend', handleRelease, { capture: true, passive: true });
  rootDoc.addEventListener('touchcancel', handleRelease, { capture: true, passive: true });
  rootDoc.addEventListener('visibilitychange', handleVisibilityChange);
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', handleRelease);
  }

  return () => {
    clearPressedState();
    rootDoc.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    rootDoc.removeEventListener('pointerup', handleRelease, { capture: true });
    rootDoc.removeEventListener('pointercancel', handleRelease, { capture: true });
    rootDoc.removeEventListener('touchstart', handleTouchStart, { capture: true });
    rootDoc.removeEventListener('touchend', handleRelease, { capture: true });
    rootDoc.removeEventListener('touchcancel', handleRelease, { capture: true });
    rootDoc.removeEventListener('visibilitychange', handleVisibilityChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', handleRelease);
    }
  };
}
