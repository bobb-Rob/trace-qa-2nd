/**
 * Visibility change capture module.
 * Tracks when the page becomes visible or hidden.
 */

import type { CaptureConfig, VisibilityPayload } from '../types';
import { sessionRelativeTime, generateId } from '../utils/timing';

export function startVisibilityCapture(config: CaptureConfig): () => void {
  function handleVisibilityChange(): void {
    const now = Date.now();
    const payload: VisibilityPayload = {
      id: generateId(),
      state: document.visibilityState as 'visible' | 'hidden',
    };

    config.buffer.push({
      type: 'visibility',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
