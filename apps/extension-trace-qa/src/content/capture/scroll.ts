/**
 * Scroll event capture module with throttling.
 */

import type { CaptureConfig, ScrollPayload } from '../types';
import { sessionRelativeTime, generateId } from '../utils/timing';
import { throttle } from '../utils/throttle';
import { debounce } from '../utils/throttle';

const THROTTLE_MS = 250;
const DEBOUNCE_MS = 150;
const MIN_SCROLL_DELTA = 100;

export function startScrollCapture(config: CaptureConfig): () => void {
  let lastScrollX = window.scrollX;
  let lastScrollY = window.scrollY;

  function emitScroll(): void {
    const currentX = window.scrollX;
    const currentY = window.scrollY;
    const deltaX = currentX - lastScrollX;
    const deltaY = currentY - lastScrollY;

    // Skip if below minimum delta
    if (Math.abs(deltaX) < MIN_SCROLL_DELTA && Math.abs(deltaY) < MIN_SCROLL_DELTA) {
      return;
    }

    // Determine primary direction
    let direction: ScrollPayload['direction'];
    if (Math.abs(deltaY) >= Math.abs(deltaX)) {
      direction = deltaY > 0 ? 'down' : 'up';
    } else {
      direction = deltaX > 0 ? 'right' : 'left';
    }

    const now = Date.now();
    const payload: ScrollPayload = {
      id: generateId(),
      scrollX: currentX,
      scrollY: currentY,
      maxScrollX: document.documentElement.scrollWidth - window.innerWidth,
      maxScrollY: document.documentElement.scrollHeight - window.innerHeight,
      direction,
      pageUrl: location.href,
    };

    config.buffer.push({
      type: 'scroll',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });

    lastScrollX = currentX;
    lastScrollY = currentY;
  }

  // Throttle for rate limiting, debounce to capture final position
  const throttledScroll = throttle(emitScroll, THROTTLE_MS);
  const debouncedFinal = debounce(emitScroll, DEBOUNCE_MS);

  function handleScroll(): void {
    throttledScroll();
    debouncedFinal();
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', handleScroll);
    throttledScroll.cancel();
    debouncedFinal.cancel();
  };
}
