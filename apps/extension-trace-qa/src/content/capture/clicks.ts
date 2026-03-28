/**
 * Click event capture module.
 */

import type { CaptureConfig, ClickPayload } from '../types';
import { generateSelector } from '../utils/selectors';
import { truncate } from '../utils/sanitization';
import { sessionRelativeTime, generateId } from '../utils/timing';
import { debounce } from '../utils/throttle';

const DEBOUNCE_MS = 50;
const MAX_TEXT_CONTENT = 100;
const DOUBLE_CLICK_WINDOW_MS = 300;
const IGNORE_SELECTOR = '[data-telemetry-ignore], .telemetry-ignore';

export function startClickCapture(config: CaptureConfig): () => void {
  let lastClickTime = 0;
  let lastClickTarget: EventTarget | null = null;

  const handleClick = debounce((e: MouseEvent) => {
    const target = e.target as Element;
    if (!target || !(target instanceof Element)) return;

    // Ignore telemetry-excluded elements
    if (target.closest(IGNORE_SELECTOR)) return;

    const now = Date.now();
    const isDoubleClick =
      now - lastClickTime < DOUBLE_CLICK_WINDOW_MS && lastClickTarget === target;
    lastClickTime = now;
    lastClickTarget = target;

    const payload: ClickPayload = {
      id: generateId(),
      x: e.clientX,
      y: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
      selector: generateSelector(target),
      tagName: target.tagName,
      textContent: truncate(target.textContent?.trim() || '', MAX_TEXT_CONTENT),
      ariaLabel: target.getAttribute('aria-label') ?? undefined,
      role: target.getAttribute('role') ?? undefined,
      pageUrl: location.href,
      button: e.button,
      isDoubleClick,
      modifiers: {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      },
    };

    config.buffer.push({
      type: 'click',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });
  }, DEBOUNCE_MS);

  document.addEventListener('click', handleClick, true);

  return () => {
    document.removeEventListener('click', handleClick, true);
    handleClick.cancel();
  };
}
