/**
 * Transition Executor
 * Handles state transitions with side effects (logging, persistence, callbacks).
 */

import type {
  SessionState,
  SessionEvent,
  TransitionContext,
  FSMContext,
} from './types';
import { reduce } from './reducer';
import { isValidTransition, isTerminalEvent, isErrorEvent } from './transitions';

/**
 * In-memory FSM context.
 * This is the single source of truth for the current state.
 */
let fsmContext: FSMContext = {
  state: 'IDLE',
  sessionId: null,
  recordingStartTime: null,
  lastTransition: null,
  pauseStartTime: null,
  totalPausedTime: 0,
};

/**
 * Callback for terminal transitions (cleanup).
 * Set by the background service worker to wire up finalizeSession.
 */
let onTerminalTransition: ((error?: string) => Promise<void>) | null = null;

/**
 * Callback to reset watchdog timer after state change.
 * Set by watchdog module to avoid circular dependency.
 */
let onStateChange: ((newState: SessionState) => void) | null = null;

/**
 * Set the terminal transition callback.
 * This is called whenever a transition leads to IDLE.
 *
 * @param callback - Function to call on terminal transitions
 */
export function setTerminalCallback(
  callback: (error?: string) => Promise<void>
): void {
  onTerminalTransition = callback;
}

/**
 * Set the state change callback (for watchdog integration).
 *
 * @param callback - Function to call after each state change
 */
export function setStateChangeCallback(
  callback: (newState: SessionState) => void
): void {
  onStateChange = callback;
}

/**
 * Get the current FSM state (read-only).
 */
export function getState(): SessionState {
  return fsmContext.state;
}

/**
 * Get the current session ID.
 */
export function getSessionId(): string | null {
  return fsmContext.sessionId;
}

/**
 * Get the full FSM context (read-only copy).
 */
export function getContext(): Readonly<FSMContext> {
  return { ...fsmContext };
}

/**
 * Main transition function with side effects.
 *
 * Responsibilities:
 * 1. Validate the transition is allowed
 * 2. Log the transition with full context
 * 3. Update in-memory state
 * 4. Persist to chrome.storage.local
 * 5. Notify watchdog of state change
 * 6. Call finalizeSession for terminal transitions
 *
 * @param event - The event triggering the transition
 * @param reason - Human-readable reason for debugging
 * @returns Promise that resolves when transition is complete
 */
export async function transition(
  event: SessionEvent,
  reason: string
): Promise<void> {
  const from = fsmContext.state;
  const eventType = event.type;

  // Step 1: Validate transition
  if (!isValidTransition(from, eventType)) {
    console.warn(
      `[TraceQA:FSM] Invalid transition rejected: ${from} + ${eventType}`,
      { reason }
    );
    // Don't throw - just ignore invalid transitions
    return;
  }

  // Step 2: Calculate next state
  const to = reduce(from, event);

  // Step 3: Create transition context for logging
  const transitionCtx: TransitionContext = {
    from,
    to,
    event: eventType,
    reason,
    timestamp: Date.now(),
    sessionId: fsmContext.sessionId ?? undefined,
  };

  // Step 4: Log the transition
  console.log('[TraceQA:FSM] Transition:', {
    from,
    to,
    event: eventType,
    reason,
  });

  // Step 5: Update in-memory state
  fsmContext = {
    ...fsmContext,
    state: to,
    lastTransition: transitionCtx,
  };

  // Step 6: Persist to storage
  await chrome.storage.local.set({
    sessionState: to,
    fsmLastTransition: transitionCtx,
  });

  // Step 7: Notify watchdog of state change
  if (onStateChange) {
    onStateChange(to);
  }

  // Step 8: Handle terminal transitions
  if (to === 'IDLE' && isTerminalEvent(eventType)) {
    if (onTerminalTransition) {
      const errorReason = isErrorEvent(eventType) ? reason : undefined;
      await onTerminalTransition(errorReason);
    }
  }
}

/**
 * Update session context without changing state.
 * Used for setting sessionId, recordingStartTime, pause timing, etc.
 *
 * @param updates - Partial context updates
 */
export function updateContext(
  updates: Partial<Pick<FSMContext, 'sessionId' | 'recordingStartTime' | 'pauseStartTime' | 'totalPausedTime'>>
): void {
  fsmContext = { ...fsmContext, ...updates };
}

/**
 * Reset the FSM to initial state.
 * Used during initialization and recovery.
 * Does NOT trigger callbacks - use transition({ type: 'FORCE_RESET' }) for that.
 */
export function resetContext(): void {
  fsmContext = {
    state: 'IDLE',
    sessionId: null,
    recordingStartTime: null,
    lastTransition: null,
    pauseStartTime: null,
    totalPausedTime: 0,
  };
}

/**
 * Restore FSM context from storage (for service worker wake).
 * Does NOT validate state - call validateStateOnWake() after this.
 */
export async function restoreFromStorage(): Promise<void> {
  const data = await chrome.storage.local.get([
    'sessionState',
    'sessionId',
    'startTime',
    'fsmLastTransition',
    'fsmPauseStartTime',
    'fsmTotalPausedTime',
  ]);

  fsmContext = {
    state: (data.sessionState as SessionState) ?? 'IDLE',
    sessionId: data.sessionId ?? null,
    recordingStartTime: data.startTime ?? null,
    lastTransition: data.fsmLastTransition ?? null,
    pauseStartTime: data.fsmPauseStartTime ?? null,
    totalPausedTime: data.fsmTotalPausedTime ?? 0,
  };

  console.log('[TraceQA:FSM] Restored context from storage:', {
    state: fsmContext.state,
    sessionId: fsmContext.sessionId,
  });
}

/**
 * Force state to a specific value (for recovery only).
 * Bypasses normal transition validation.
 * Use with caution - prefer transition({ type: 'FORCE_RESET' }).
 *
 * @param state - State to force
 */
export async function forceState(state: SessionState): Promise<void> {
  console.warn('[TraceQA:FSM] Force state:', { from: fsmContext.state, to: state });

  fsmContext = {
    ...fsmContext,
    state,
    lastTransition: {
      from: fsmContext.state,
      to: state,
      event: 'FORCE_RESET',
      reason: 'Forced state recovery',
      timestamp: Date.now(),
    },
  };

  await chrome.storage.local.set({
    sessionState: state,
    fsmLastTransition: fsmContext.lastTransition,
  });

  if (onStateChange) {
    onStateChange(state);
  }
}
