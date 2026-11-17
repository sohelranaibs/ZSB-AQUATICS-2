/**
 * Global Clicked Button Golden Highlight Utility
 * Tracks the currently clicked button across the application so any button
 * turns Golden (#fbbf24) when clicked.
 */

export const GOLDEN_BUTTON_HEX = '#fbbf24';
export const GOLDEN_BUTTON_RGB = 'rgb(251, 191, 36)';
export const CLICKED_BUTTON_ATTR = 'data-zsb-clicked';

export const INTERACTIVE_BUTTON_SELECTOR = [
  'button:not([data-testid^="db-cell-trigger-"])',
  '[type="button"]:not([data-testid^="db-cell-trigger-"])',
  '[type="submit"]',
  '[type="reset"]',
  '[role="button"]:not([data-testid^="db-cell-trigger-"])',
].join(', ');

export function isEligibleClickedButton(el: Element | null): el is HTMLElement {
  if (!el || typeof (el as HTMLElement).getAttribute !== 'function') {
    return false;
  }
  const testId = el.getAttribute('data-testid') || '';
  if (testId.startsWith('db-cell-trigger-')) {
    return false;
  }
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  return true;
}

const lastClickedByRoot = new WeakMap<object, HTMLElement>();

export function markButtonAsClicked(
  targetButton: HTMLElement | null,
  rootDoc: Document | HTMLElement = document
): HTMLElement | null {
  if (!isEligibleClickedButton(targetButton)) {
    return null;
  }

  const cachedPrev = lastClickedByRoot.get(rootDoc);
  if (
    cachedPrev === targetButton &&
    targetButton.getAttribute(CLICKED_BUTTON_ATTR) === 'true'
  ) {
    return targetButton;
  }

  if (cachedPrev) {
    if (cachedPrev !== targetButton) {
      cachedPrev.removeAttribute(CLICKED_BUTTON_ATTR);
    }
  } else if (typeof rootDoc.querySelectorAll === 'function') {
    const previousClicked = rootDoc.querySelectorAll(`[${CLICKED_BUTTON_ATTR}="true"]`);
    previousClicked.forEach((el) => {
      if (el !== targetButton) {
        el.removeAttribute(CLICKED_BUTTON_ATTR);
      }
    });
  }

  targetButton.setAttribute(CLICKED_BUTTON_ATTR, 'true');
  lastClickedByRoot.set(rootDoc, targetButton);
  return targetButton;
}

export function bindGlobalButtonGoldenClickHandler(rootDoc: Document = document): () => void {
  const handleActivate = (event: Event) => {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;

    const btn = target.closest(INTERACTIVE_BUTTON_SELECTOR) as HTMLElement | null;
    if (!isEligibleClickedButton(btn)) return;

    const testId = btn.getAttribute('data-testid');
    const ariaLabel = btn.getAttribute('aria-label');

    markButtonAsClicked(btn, rootDoc);

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        if (btn.isConnected) {
          if (
            btn.getAttribute(CLICKED_BUTTON_ATTR) !== 'true' ||
            lastClickedByRoot.get(rootDoc) !== btn
          ) {
            markButtonAsClicked(btn, rootDoc);
          }
          return;
        }
        if (testId) {
          const replacement = rootDoc.querySelector(
            `[data-testid="${CSS.escape(testId)}"]`
          ) as HTMLElement | null;
          if (isEligibleClickedButton(replacement)) {
            markButtonAsClicked(replacement, rootDoc);
            return;
          }
        }
        if (ariaLabel) {
          const replacement = rootDoc.querySelector(
            `[aria-label="${CSS.escape(ariaLabel)}"]`
          ) as HTMLElement | null;
          if (isEligibleClickedButton(replacement)) {
            markButtonAsClicked(replacement, rootDoc);
          }
        }
      });
    }
  };

  rootDoc.addEventListener('pointerdown', handleActivate, true);
  rootDoc.addEventListener('click', handleActivate, true);

  return () => {
    rootDoc.removeEventListener('pointerdown', handleActivate, true);
    rootDoc.removeEventListener('click', handleActivate, true);
  };
}
