/**
 * Event buffer - collects telemetry events and flushes in batches.
 */

import type { CapturedEvent } from '../types';
import type { TelemetryEvent } from '../../shared/contracts/events';
import { sendTelemetryBatch, sendTelemetryBatchSync } from '../transport/backgroundBridge';
import { generateId } from '../utils/timing';

// ============================================
// TYPES
// ============================================

export interface EventBuffer {
  push(event: CapturedEvent): void;
  flush(isPartial?: boolean): Promise<void>;
  destroy(): void;
  getEventCount(): number;
}

export interface EventBufferConfig {
  sessionId: string;
  sessionStartTime: number;
  batchIntervalMs: number;
  maxBatchSize: number;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_BUFFER_SIZE_BYTES = 100_000; // ~100KB
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================
// FACTORY
// ============================================

export function createEventBuffer(config: EventBufferConfig): EventBuffer {
  let events: CapturedEvent[] = [];
  let byteSize = 0;
  let retryCount = 0;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  // Start periodic flush
  flushTimer = setInterval(() => {
    if (events.length > 0) {
      flush(false).catch(() => {});
    }
  }, config.batchIntervalMs);

  /**
   * Convert internal CapturedEvent to wire-format TelemetryEvent.
   */
  function toWireFormat(event: CapturedEvent): TelemetryEvent {
    return {
      type: event.type,
      timestamp: event.timestamp,
      data: {
        relativeTime: event.relativeTime,
        ...event.payload,
      },
    };
  }

  /**
   * Build batch payload for transport.
   */
  function buildBatchPayload(batch: CapturedEvent[], isPartial: boolean) {
    const wireEvents = batch.map(toWireFormat);
    return {
      sessionId: config.sessionId,
      batchId: generateId(),
      events: wireEvents,
      metadata: {
        capturedAt: Date.now(),
        eventCount: wireEvents.length,
        byteSize: JSON.stringify(wireEvents).length,
        url: location.href,
        isPartial,
      },
    };
  }

  /**
   * Push an event into the buffer.
   * Auto-flushes when count or size thresholds are exceeded.
   */
  function push(event: CapturedEvent): void {
    if (destroyed) return;

    events.push(event);
    byteSize += JSON.stringify(event).length;

    // Auto-flush on count threshold
    if (events.length >= config.maxBatchSize) {
      flush(false).catch(() => {});
      return;
    }

    // Auto-flush on size threshold
    if (byteSize >= MAX_BUFFER_SIZE_BYTES) {
      flush(false).catch(() => {});
    }
  }

  /**
   * Flush buffered events to background.
   */
  async function flush(isPartial: boolean = false): Promise<void> {
    if (events.length === 0) return;

    // Grab current buffer and clear immediately
    const batch = events;
    events = [];
    byteSize = 0;

    const payload = buildBatchPayload(batch, isPartial);
    const success = await sendTelemetryBatch(payload);

    if (success) {
      retryCount = 0;
      console.log(`[Telemetry] Batch sent: ${batch.length} events`);
    } else if (retryCount < MAX_RETRIES) {
      // Re-queue failed events
      retryCount++;
      events = batch.concat(events);
      byteSize = JSON.stringify(events).length;

      // Schedule retry
      setTimeout(() => {
        if (!destroyed && events.length > 0) {
          flush(false).catch(() => {});
        }
      }, RETRY_DELAY_MS);
    } else {
      console.warn(`[Telemetry] Dropped batch after ${MAX_RETRIES} retries (${batch.length} events)`);
      retryCount = 0;
    }
  }

  /**
   * Destroy the buffer: final sync flush, clear timer.
   */
  function destroy(): void {
    destroyed = true;

    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }

    // Best-effort sync flush of remaining events
    if (events.length > 0) {
      const payload = buildBatchPayload(events, true);
      sendTelemetryBatchSync(payload);
      events = [];
      byteSize = 0;
    }
  }

  function getEventCount(): number {
    return events.length;
  }

  return { push, flush, destroy, getEventCount };
}
