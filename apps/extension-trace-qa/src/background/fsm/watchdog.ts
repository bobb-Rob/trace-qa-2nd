/**
 * Watchdog Timer and Self-Healing
 * Provides timeout handling and state validation for recovery.
 */

import type { SessionState, SessionEvent, WatchdogConfig } from './types';
import { getState, getSessionId, transition, setStateChangeCallback } from './executor';

/**
 * Watchdog configuration for each non-IDLE state.
 * Defines timeouts and the event to fire on timeout.
 */
const WATCHDOG_CONFIGS: WatchdogConfig[] = [
  {
    state: 'REQUESTING_PERMISSION',
    timeoutMs: 60_000, // 60 seconds for user to grant permission
    onTimeout: 'PERMISSION_DENIED',
  },
  {
    state: 'STARTING',
    timeoutMs: 30_000, // 30 seconds to start capture
    onTimeout: 'CAPTURE_FAILED',
  },
  {
    state: 'RECORDING',
    timeoutMs: 30 * 60 * 1000, // 30 minutes max recording
    onTimeout: 'STOP_REQUESTED',
  },
  {
    state: 'PAUSED',
    timeoutMs: 30 * 60 * 1000, // 30 minutes max pause time (same as recording)
    onTimeout: 'STOP_REQUESTED', // Auto-stop if paused too long
  },
  {
    state: 'STOPPING',
    timeoutMs: 30_000, // 30 seconds to stop and finalize
    onTimeout: 'CAPTURE_FAILED',
  },
  {
    state: 'UPLOADING',
    timeoutMs: 120_000, // 2 minutes for upload/download
    onTimeout: 'UPLOAD_FAILED',
  },
];

/**
 * Offscreen document path for existence checks.
 */
const OFFSCREEN_DOCUMENT_PATH = 'offscreen/index.html';

// Active watchdog timer
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogState: SessionState | null = null;

/**
 * Start the watchdog timer for the given state.
 * Clears any existing timer first.
 *
 * @param currentState - The state to monitor
 */
export function startWatchdog(currentState: SessionState): void {
  // Clear any existing timer
  stopWatchdog();

  // IDLE doesn't need a watchdog
  if (currentState === 'IDLE') {
    return;
  }

  // Find config for this state
  const config = WATCHDOG_CONFIGS.find((c) => c.state === currentState);
  if (!config) {
    console.warn(`[TraceQA:Watchdog] No config for state: ${currentState}`);
    return;
  }

  watchdogState = currentState;

  console.log(
    `[TraceQA:Watchdog] Started timer for ${currentState}: ${config.timeoutMs}ms`
  );

  watchdogTimer = setTimeout(async () => {
    // Verify we're still in the same state
    const actualState = getState();
    if (actualState !== watchdogState) {
      console.log(
        `[TraceQA:Watchdog] State changed from ${watchdogState} to ${actualState}, ignoring timeout`
      );
      return;
    }

    console.warn(
      `[TraceQA:Watchdog] Timeout in state ${watchdogState}, firing ${config.onTimeout}`
    );

    try {
      await transition(
        { type: config.onTimeout } as SessionEvent,
        `Watchdog timeout after ${config.timeoutMs}ms in ${watchdogState}`
      );
    } catch (error) {
      console.error('[TraceQA:Watchdog] Failed to handle timeout:', error);
      // Force reset as last resort
      try {
        await transition(
          { type: 'FORCE_RESET' },
          'Watchdog recovery after timeout handling failure'
        );
      } catch {
        console.error('[TraceQA:Watchdog] FORCE_RESET also failed');
      }
    }
  }, config.timeoutMs);
}

/**
 * Stop the watchdog timer.
 */
export function stopWatchdog(): void {
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
    watchdogState = null;
  }
}

/**
 * Reset watchdog when state changes.
 * Called automatically via setStateChangeCallback.
 *
 * @param newState - The new state after transition
 */
export function resetWatchdog(newState: SessionState): void {
  stopWatchdog();
  startWatchdog(newState);
}

/**
 * Check if offscreen document exists.
 *
 * @returns Promise resolving to true if offscreen document exists
 */
export async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return contexts.length > 0;
}

/**
 * Self-healing on service worker wake.
 * Validates that the persisted state is consistent with reality.
 * If state is non-IDLE but no offscreen document exists, resets to IDLE.
 */
export async function validateStateOnWake(): Promise<void> {
  const currentState = getState();

  console.log(`[TraceQA:Watchdog] Validating state on wake: ${currentState}`);

  // IDLE is always valid
  if (currentState === 'IDLE') {
    return;
  }

  // For non-IDLE states, verify offscreen document exists
  const hasOffscreen = await hasOffscreenDocument();

  if (!hasOffscreen) {
    console.warn(
      `[TraceQA:Watchdog] Self-healing: State is ${currentState} but no offscreen document exists`
    );

    try {
      await transition(
        { type: 'FORCE_RESET' },
        'Self-healing: Orphaned state without offscreen document'
      );
    } catch (error) {
      console.error('[TraceQA:Watchdog] Self-healing transition failed:', error);
    }
    return;
  }

  // Offscreen exists - restart watchdog for current state
  console.log(
    `[TraceQA:Watchdog] State ${currentState} validated, restarting watchdog`
  );
  startWatchdog(currentState);
}

/**
 * Handle stale messages from previous sessions.
 * Returns true if the message should be processed, false if stale.
 *
 * @param messageSessionId - Session ID from the message
 * @returns true if the message should be processed
 */
export function isMessageFresh(messageSessionId: string | undefined): boolean {
  const currentSessionId = getSessionId();

  if (!messageSessionId) {
    // Messages without sessionId are always processed (e.g., status queries)
    return true;
  }

  if (messageSessionId !== currentSessionId) {
    console.warn(
      `[TraceQA:Watchdog] Stale message detected: expected ${currentSessionId}, got ${messageSessionId}`
    );
    return false;
  }

  return true;
}

/**
 * Initialize watchdog integration with executor.
 * Must be called once during service worker startup.
 */
export function initWatchdog(): void {
  setStateChangeCallback(resetWatchdog);
  console.log('[TraceQA:Watchdog] Initialized');
}
