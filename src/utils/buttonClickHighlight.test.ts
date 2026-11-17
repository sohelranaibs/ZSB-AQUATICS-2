import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOLDEN_BUTTON_HEX,
  GOLDEN_BUTTON_RGB,
  CLICKED_BUTTON_ATTR,
  isEligibleClickedButton,
  markButtonAsClicked,
} from './buttonClickHighlight.ts';

class MockElement {
  attrs = new Map<string, string>();
  disabled = false;

  constructor(initialAttrs: Record<string, string> = {}, disabled = false) {
    Object.entries(initialAttrs).forEach(([k, v]) => this.attrs.set(k, v));
    this.disabled = disabled;
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
}

describe('buttonClickHighlight utility', () => {
  it('exports the canonical Golden color constants (#fbbf24)', () => {
    assert.equal(GOLDEN_BUTTON_HEX, '#fbbf24');
    assert.equal(GOLDEN_BUTTON_RGB, 'rgb(251, 191, 36)');
  });

  it('rejects disabled buttons and inline database cell triggers', () => {
    const normalBtn = new MockElement({ 'data-testid': 'sidebar-nav-dashboard' }) as unknown as Element;
    const cellTrigger = new MockElement({ 'data-testid': 'db-cell-trigger-pkg-1' }) as unknown as Element;
    const disabledBtn = new MockElement({ 'data-testid': 'save-btn' }, true) as unknown as Element;

    assert.equal(isEligibleClickedButton(normalBtn), true);
    assert.equal(isEligibleClickedButton(cellTrigger), false);
    assert.equal(isEligibleClickedButton(disabledBtn), false);
    assert.equal(isEligibleClickedButton(null), false);
  });

  it('marks the newly clicked button and clears the previous clicked button', () => {
    const btnA = new MockElement({ 'data-testid': 'btn-a' });
    const btnB = new MockElement({ 'data-testid': 'btn-b' });
    const allElements = [btnA, btnB];

    const mockRoot = {
      querySelectorAll: () =>
        allElements.filter((el) => el.getAttribute(CLICKED_BUTTON_ATTR) === 'true'),
    } as unknown as HTMLElement;

    markButtonAsClicked(btnA as unknown as HTMLElement, mockRoot);
    assert.equal(btnA.getAttribute(CLICKED_BUTTON_ATTR), 'true');
    assert.equal(btnB.getAttribute(CLICKED_BUTTON_ATTR), null);

    markButtonAsClicked(btnB as unknown as HTMLElement, mockRoot);
    assert.equal(btnA.getAttribute(CLICKED_BUTTON_ATTR), null);
    assert.equal(btnB.getAttribute(CLICKED_BUTTON_ATTR), 'true');
  });

  it('handles repeated clicks on the same button and switches cleanly back and forth', () => {
    const btnA = new MockElement({ 'data-testid': 'btn-repeat-a' });
    const btnB = new MockElement({ 'data-testid': 'btn-repeat-b' });
    let scanCount = 0;
    const mockRoot = {
      querySelectorAll: () => {
        scanCount += 1;
        return [];
      },
    } as unknown as HTMLElement;

    // Initial priming click scans once if no cached button exists for this root
    markButtonAsClicked(btnA as unknown as HTMLElement, mockRoot);
    assert.equal(btnA.getAttribute(CLICKED_BUTTON_ATTR), 'true');
    assert.equal(scanCount, 1);

    // Second click on same button hits O(1) fast path without touching DOM queries
    markButtonAsClicked(btnA as unknown as HTMLElement, mockRoot);
    assert.equal(btnA.getAttribute(CLICKED_BUTTON_ATTR), 'true');
    assert.equal(scanCount, 1);

    // Switch to btnB uses WeakMap previous reference without querySelectorAll
    markButtonAsClicked(btnB as unknown as HTMLElement, mockRoot);
    assert.equal(btnA.getAttribute(CLICKED_BUTTON_ATTR), null);
    assert.equal(btnB.getAttribute(CLICKED_BUTTON_ATTR), 'true');
    assert.equal(scanCount, 1);
  });
});
