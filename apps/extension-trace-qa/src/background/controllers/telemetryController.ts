/**
 * Telemetry Controller
 *
 * Handles incoming telemetry batches from content scripts
 * and manages SESSION_STARTED/SESSION_ENDED broadcasts.
 *
 * @module background/controllers/telemetryController
 */

import type { ContentTelemetryBatchEvent } from '../../shared/contracts/events';
import type { TelemetryConfig } from '../../shared/contracts/broadcasts';
import type { CaptureMode } from '../../shared/types';
import { storeTelemetryBatch } from '../persistence/telemetryStore';
import { consolidateSession, type ConsolidationParams } from '../persistence/sessionConsolidator';

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
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
// BATCH HANDLER
// ============================================

/**
 * Handle an incoming telemetry batch from a content script.
 */
export async function handleTelemetryBatch(
  message: ContentTelemetryBatchEvent,
  _sender: chrome.runtime.MessageSender
): Promise<void> {
  const { sessionId, batchId, events, metadata } = message.payload;

  await storeTelemetryBatch({
    key: `${sessionId}:${batchId}`,
    sessionId,
    batchId,
    events,
    metadata,
    storedAt: Date.now(),
  });

  console.log('[TelemetryController] Stored batch:', batchId, 'events:', events.length);
}

// ============================================
// SESSION LIFECYCLE BROADCASTS
// ============================================

/**
 * Broadcast SESSION_STARTED to a content script tab to activate telemetry capture.
 */
export async function broadcastSessionStarted(
  sessionId: string,
  startTime: number,
  tabId: number,
  config?: TelemetryConfig
): Promise<void> {
  const message = {
    type: 'SESSION_STARTED' as const,
    payload: {
      sessionId,
      startTime,
      tabId,
      telemetryConfig: config ?? DEFAULT_TELEMETRY_CONFIG,
    },
  };

  try {
    await chrome.tabs.sendMessage(tabId, message);
    console.log('[TelemetryController] SESSION_STARTED sent to tab:', tabId);
  } catch {
    console.warn('[TelemetryController] Failed to send SESSION_STARTED to tab:', tabId);
  }
}

/**
 * Broadcast SESSION_ENDED to all content script tabs to deactivate telemetry.
 */
export async function broadcastSessionEnded(sessionId: string): Promise<void> {
  const message = {
    type: 'SESSION_ENDED' as const,
    payload: { sessionId },
  };

  try {
    const tabs = await chrome.tabs.query({});
    const sendPromises = tabs
      .filter((tab) => tab.id !== undefined)
      .map((tab) =>
        chrome.tabs.sendMessage(tab.id!, message).catch(() => {
          // Tab may not have content script - ignore
        })
      );
    await Promise.allSettled(sendPromises);
    console.log('[TelemetryController] SESSION_ENDED broadcast to', tabs.length, 'tabs');
  } catch {
    console.warn('[TelemetryController] Failed to broadcast SESSION_ENDED');
  }
}

/**
 * Broadcast SESSION_STARTED to all tabs in scope for the given capture mode.
 * - TAB: single tab
 * - WINDOW: all tabs in the specified window
 * - DESKTOP: all tabs across all windows
 */
export async function broadcastSessionStartedToAll(
  sessionId: string,
  startTime: number,
  captureMode: CaptureMode | null,
  tabId: number | null,
  windowId: number | null,
  config?: TelemetryConfig,
): Promise<void> {
  if (captureMode === 'TAB' && tabId) {
    await broadcastSessionStarted(sessionId, startTime, tabId, config);
    return;
  }

  let targetTabs: chrome.tabs.Tab[] = [];

  if (captureMode === 'WINDOW' && windowId) {
    targetTabs = await chrome.tabs.query({ windowId });
  } else if (captureMode === 'DESKTOP') {
    targetTabs = await chrome.tabs.query({});
  }

  const sendPromises = targetTabs
    .filter((tab) => tab.id && tab.url?.match(/^https?:\/\//))
    .map((tab) =>
      broadcastSessionStarted(sessionId, startTime, tab.id!, config).catch(() => {})
    );

  await Promise.allSettled(sendPromises);
  console.log('[TelemetryController] SESSION_STARTED broadcast to', sendPromises.length, 'tabs');
}

// ============================================
// SESSION CONSOLIDATION
// ============================================

/**
 * Consolidate all telemetry batches into a single RecordedSession.
 * Called at session end from finalizeSession().
 */
export async function consolidateSessionTelemetry(params: ConsolidationParams): Promise<void> {
  const session = await consolidateSession(params);
  console.log('[TelemetryController] Session consolidated:', params.sessionId,
    'events:', session.timeline.length, 'network:', session.network.important.length);
}
