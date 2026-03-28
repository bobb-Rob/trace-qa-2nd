/**
 * State Transition Table and Validation
 * Defines the legal state transitions for the recording session FSM.
 */

import type { SessionState, SessionEventType } from './types';

/**
 * Transition table defining valid state transitions.
 * Key: current state
 * Value: Map of event types to next states
 *
 * INVARIANT: All failure events (PERMISSION_DENIED, CAPTURE_FAILED, UPLOAD_FAILED)
 * must transition to IDLE to ensure recovery.
 */
export const TRANSITION_TABLE: Record<
  SessionState,
  Partial<Record<SessionEventType, SessionState>>
> = {
  IDLE: {
    START_REQUESTED: 'REQUESTING_PERMISSION',
    FORCE_RESET: 'IDLE', // No-op but valid
  },
  REQUESTING_PERMISSION: {
    PERMISSION_GRANTED: 'STARTING',
    PERMISSION_DENIED: 'IDLE', // Error -> IDLE
    FORCE_RESET: 'IDLE',
  },
  STARTING: {
    CAPTURE_STARTED: 'RECORDING',
    CAPTURE_FAILED: 'IDLE', // Error -> IDLE
    FORCE_RESET: 'IDLE',
  },
  RECORDING: {
    STOP_REQUESTED: 'STOPPING',
    STREAM_ENDED: 'UPLOADING', // External termination (Stop sharing) - still save video
    CAPTURE_STOPPED: 'UPLOADING', // External stop finalized (blob stored, ready for download)
    PAUSE_REQUESTED: 'PAUSED', // User requested pause
    CAPTURE_FAILED: 'IDLE', // Error with no salvageable data -> IDLE
    FORCE_RESET: 'IDLE',
  },
  PAUSED: {
    RESUME_REQUESTED: 'RECORDING', // User requested resume
    STOP_REQUESTED: 'STOPPING',    // Can stop while paused
    STREAM_ENDED: 'UPLOADING',     // External stop while paused - still save video
    CAPTURE_STOPPED: 'UPLOADING',  // External stop finalized while paused
    CAPTURE_FAILED: 'IDLE',        // Error while paused -> IDLE
    FORCE_RESET: 'IDLE',
  },
  STOPPING: {
    CAPTURE_STOPPED: 'UPLOADING',
    CAPTURE_FAILED: 'IDLE', // Error during stop -> IDLE
    FORCE_RESET: 'IDLE',
  },
  UPLOADING: {
    UPLOAD_COMPLETE: 'IDLE', // Success -> IDLE
    UPLOAD_FAILED: 'IDLE', // Failure -> IDLE
    FORCE_RESET: 'IDLE',
  },
};

/**
 * Terminal events that lead to IDLE state.
 */
const TERMINAL_EVENTS: SessionEventType[] = [
  'PERMISSION_DENIED',
  'CAPTURE_FAILED',
  'UPLOAD_COMPLETE',
  'UPLOAD_FAILED',
  'FORCE_RESET',
];

/**
 * Error events that indicate a failure (subset of terminal events).
 */
export const ERROR_EVENTS: SessionEventType[] = [
  'PERMISSION_DENIED',
  'CAPTURE_FAILED',
  'UPLOAD_FAILED',
];

/**
 * Pure function to validate if a transition is allowed.
 * This function has NO side effects.
 *
 * @param from - Current state
 * @param event - Event type to process
 * @returns true if the transition is valid
 */
export function isValidTransition(
  from: SessionState,
  event: SessionEventType
): boolean {
  const allowedTransitions = TRANSITION_TABLE[from];
  return event in allowedTransitions;
}

/**
 * Get the next state for a given current state and event.
 *
 * @param from - Current state
 * @param event - Event type to process
 * @returns Next state, or null if the transition is invalid
 */
export function getNextState(
  from: SessionState,
  event: SessionEventType
): SessionState | null {
  const allowedTransitions = TRANSITION_TABLE[from];
  return allowedTransitions[event] ?? null;
}

/**
 * Check if an event is a terminal event (leads to IDLE).
 *
 * @param event - Event type to check
 * @returns true if this event leads to IDLE
 */
export function isTerminalEvent(event: SessionEventType): boolean {
  return TERMINAL_EVENTS.includes(event);
}

/**
 * Check if an event is an error event.
 *
 * @param event - Event type to check
 * @returns true if this event represents an error
 */
export function isErrorEvent(event: SessionEventType): boolean {
  return ERROR_EVENTS.includes(event);
}
