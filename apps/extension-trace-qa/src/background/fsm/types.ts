/**
 * FSM Type Definitions
 * Defines the state machine types for session management.
 */

/**
 * Valid session states.
 * Note: No ERROR state - errors are events that lead back to IDLE.
 */
export type SessionState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'STARTING'
  | 'RECORDING'
  | 'PAUSED'
  | 'STOPPING'
  | 'UPLOADING';

/**
 * Events that trigger state transitions.
 * Each event represents a discrete occurrence in the recording lifecycle.
 */
export type SessionEvent =
  | { type: 'START_REQUESTED' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'CAPTURE_STARTED' }
  | { type: 'CAPTURE_FAILED' }
  | { type: 'STOP_REQUESTED' }
  | { type: 'CAPTURE_STOPPED' }
  | { type: 'STREAM_ENDED' }      // External termination (user clicked "Stop sharing")
  | { type: 'PAUSE_REQUESTED' }   // User requested pause
  | { type: 'RESUME_REQUESTED' }  // User requested resume
  | { type: 'UPLOAD_COMPLETE' }
  | { type: 'UPLOAD_FAILED' }
  | { type: 'FORCE_RESET' };

/**
 * Event type string literal for type-safe lookups.
 */
export type SessionEventType = SessionEvent['type'];

/**
 * Context for logging and debugging transitions.
 */
export interface TransitionContext {
  from: SessionState;
  to: SessionState;
  event: SessionEventType;
  reason: string;
  timestamp: number;
  sessionId?: string;
}

/**
 * Watchdog configuration for a specific state.
 */
export interface WatchdogConfig {
  state: SessionState;
  timeoutMs: number;
  onTimeout: SessionEventType;
}

/**
 * Full FSM context including session metadata.
 */
export interface FSMContext {
  state: SessionState;
  sessionId: string | null;
  recordingStartTime: number | null;
  lastTransition: TransitionContext | null;
  // Pause-related timing (background owns duration tracking)
  pauseStartTime: number | null;      // When pause started (null if not paused)
  totalPausedTime: number;            // Accumulated paused milliseconds
}
