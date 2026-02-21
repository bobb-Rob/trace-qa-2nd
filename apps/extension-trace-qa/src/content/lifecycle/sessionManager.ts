/**
 * Telemetry session lifecycle manager.
 * Activates/deactivates capture modules based on SESSION_STARTED/SESSION_ENDED broadcasts.
 */

import type { TelemetryConfig } from '../../shared/contracts/broadcasts';
import { createEventBuffer, type EventBuffer } from '../batching/eventBuffer';
import type { CaptureConfig } from '../types';
import { startClickCapture } from '../capture/clicks';
import { startInputCapture } from '../capture/inputs';
import { startScrollCapture } from '../capture/scroll';
import { startNavigationCapture } from '../capture/navigation';
import { startErrorCapture } from '../capture/errors';
import { startVisibilityCapture } from '../capture/visibility';
import { startConsoleCapture } from '../capture/console';
import { startDomSnapshotCapture } from '../capture/domSnapshots';
import { startNetworkCapture, getNetworkStats } from '../capture/network';
import type { AggregateAccumulator } from '../capture/network';

// ============================================
// STATE
// ============================================

let activeBuffer: EventBuffer | null = null;
let stopFunctions: Array<() => void> = [];
let sessionId: string | null = null;
let visibilityHandler: (() => void) | null = null;
let lastNetworkStats: { droppedCount: number; aggregated: Map<string, AggregateAccumulator> } | null = null;

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_CONFIG: TelemetryConfig = {
  captureClicks: true,
  captureInputs: true,
  captureScrolls: true,
  captureNavigation: true,
  captureErrors: true,
  captureNetwork: true,
  captureConsole: true,
  captureDomSnapshots: true,
  captureVisibility: true,
  batchIntervalMs: 5000,
  maxBatchSize: 50,
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Activate telemetry capture for a recording session.
 */
export function activateCapture(params: {
  sessionId: string;
  sessionStartTime: number;
  config?: TelemetryConfig;
}): void {
  // Handle re-entrant activation (e.g., tab re-injection)
  if (sessionId) {
    deactivateCapture();
  }

  const cfg = params.config ?? DEFAULT_CONFIG;
  sessionId = params.sessionId;

  console.log('[Telemetry] Activating capture for session:', sessionId);

  // Create event buffer
  activeBuffer = createEventBuffer({
    sessionId: params.sessionId,
    sessionStartTime: params.sessionStartTime,
    batchIntervalMs: cfg.batchIntervalMs,
    maxBatchSize: cfg.maxBatchSize,
  });

  // Build capture config
  const captureConfig: CaptureConfig = {
    sessionId: params.sessionId,
    sessionStartTime: params.sessionStartTime,
    buffer: activeBuffer,
  };

  // Activate the main world script (patches fetch/XHR/history in the page's world).
  // This must fire at the session level, not inside individual capture modules,
  // so that navigation capture works even if network capture is disabled.
  window.postMessage({ type: '__TRACEQA_CTRL__', payload: { active: true } }, '*');

  // Start enabled capture modules
  if (cfg.captureClicks) {
    stopFunctions.push(startClickCapture(captureConfig));
  }
  if (cfg.captureInputs) {
    stopFunctions.push(startInputCapture(captureConfig));
  }
  if (cfg.captureScrolls) {
    stopFunctions.push(startScrollCapture(captureConfig));
  }
  if (cfg.captureNavigation) {
    stopFunctions.push(startNavigationCapture(captureConfig));
  }
  if (cfg.captureErrors) {
    stopFunctions.push(startErrorCapture(captureConfig));
  }
  if (cfg.captureNetwork) {
    stopFunctions.push(startNetworkCapture(captureConfig));
  }
  if (cfg.captureConsole) {
    stopFunctions.push(startConsoleCapture(captureConfig));
  }
  if (cfg.captureDomSnapshots) {
    stopFunctions.push(startDomSnapshotCapture(captureConfig));
  }
  if (cfg.captureVisibility) {
    stopFunctions.push(startVisibilityCapture(captureConfig));
  }

  // Register visibility change handler for flush on tab hide
  visibilityHandler = () => {
    if (document.visibilityState === 'hidden' && activeBuffer) {
      activeBuffer.flush(true).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  console.log('[Telemetry] Capture active with', stopFunctions.length, 'modules');
}

/**
 * Deactivate telemetry capture and flush remaining events.
 */
export function deactivateCapture(): void {
  if (!sessionId) return;

  console.log('[Telemetry] Deactivating capture for session:', sessionId);

  // Capture network stats before stopping modules
  lastNetworkStats = getNetworkStats();

  // Deactivate the main world script
  window.postMessage({ type: '__TRACEQA_CTRL__', payload: { active: false } }, '*');

  // Stop all capture modules
  for (const stop of stopFunctions) {
    try {
      stop();
    } catch (error) {
      console.warn('[Telemetry] Error stopping capture module:', error);
    }
  }
  stopFunctions = [];

  // Destroy buffer (triggers final sync flush)
  if (activeBuffer) {
    activeBuffer.destroy();
    activeBuffer = null;
  }

  // Remove visibility handler
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  sessionId = null;
}

/**
 * Check if telemetry capture is currently active.
 */
export function isCapturing(): boolean {
  return sessionId !== null;
}

/**
 * Get the current telemetry session ID.
 */
export function getCurrentSessionId(): string | null {
  return sessionId;
}

/**
 * Get network stats from the last deactivated session.
 * Used by the consolidator to build aggregated network data.
 */
export function getLastNetworkStats(): { droppedCount: number; aggregated: Map<string, AggregateAccumulator> } | null {
  return lastNetworkStats;
}
