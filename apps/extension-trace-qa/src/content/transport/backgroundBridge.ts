/**
 * Transport layer for sending telemetry batches to background service worker.
 */

import type { ContentTelemetryBatchEvent } from '../../shared/contracts/events';

type BatchPayload = ContentTelemetryBatchEvent['payload'];

/**
 * Send a telemetry batch to the background service worker.
 * Returns true on success, false on failure.
 */
export async function sendTelemetryBatch(payload: BatchPayload): Promise<boolean> {
  try {
    await chrome.runtime.sendMessage({
      type: 'CONTENT_TELEMETRY_BATCH',
      payload,
    });
    return true;
  } catch (error) {
    console.warn('[Telemetry] Failed to send batch:', error);
    return false;
  }
}

/**
 * Best-effort fire-and-forget send for page unload scenarios.
 * chrome.runtime.sendMessage may fail during unload, but it's the best option
 * (navigator.sendBeacon cannot target extension service workers).
 */
export function sendTelemetryBatchSync(payload: BatchPayload): void {
  chrome.runtime.sendMessage({
    type: 'CONTENT_TELEMETRY_BATCH',
    payload,
  }).catch(() => {
    // Best effort - page is unloading
  });
}
