/**
 * DOM snapshot capture module.
 * Periodically captures important interactive/semantic elements on the page.
 */

import type { CaptureConfig, DomSnapshotPayload } from '../types';
import { sessionRelativeTime, generateId } from '../utils/timing';
import { generateSelector } from '../utils/selectors';
import { truncate } from '../utils/sanitization';

const SNAPSHOT_INTERVAL_MS = 10_000; // 10 seconds
const MAX_ELEMENTS = 100;
const MAX_TEXT_LENGTH = 100;

const IMPORTANT_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="link"], form, dialog, [aria-modal]';

export function startDomSnapshotCapture(config: CaptureConfig): () => void {
  function takeSnapshot(): void {
    const now = Date.now();
    const elements = document.querySelectorAll(IMPORTANT_SELECTOR);

    const importantElements: DomSnapshotPayload['importantElements'] = [];
    const count = Math.min(elements.length, MAX_ELEMENTS);

    for (let i = 0; i < count; i++) {
      const el = elements[i];
      const text = el.textContent?.trim();
      const role = el.getAttribute('role') || el.tagName.toLowerCase();

      importantElements.push({
        selector: generateSelector(el),
        text: text ? truncate(text, MAX_TEXT_LENGTH) : undefined,
        role,
      });
    }

    const payload: DomSnapshotPayload = {
      id: generateId(),
      url: location.href,
      importantElements,
    };

    config.buffer.push({
      type: 'domSnapshot',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });
  }

  // Take initial snapshot
  takeSnapshot();

  // Periodic snapshots
  const timer = setInterval(takeSnapshot, SNAPSHOT_INTERVAL_MS);

  return () => {
    clearInterval(timer);
  };
}
