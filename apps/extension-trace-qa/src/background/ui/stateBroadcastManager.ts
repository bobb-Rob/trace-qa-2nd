/**
 * State Broadcast Manager
 *
 * Manages periodic UI state updates during active recording.
 * Calculates duration, handles pause timing, and broadcasts to all UI components.
 * Includes audio state for UI indicators.
 *
 * @module background/ui/stateBroadcastManager
 */

import { getContext } from '../fsm';
import { getAudioState } from '../controllers/audioController';

// Broadcast interval (500ms = 2Hz)
const STATE_BROADCAST_INTERVAL_MS = 500;

let stateBroadcastTimer: ReturnType<typeof setInterval> | null = null;
let broadcastCallback: ((state: BroadcastState) => void) | null = null;

export interface BroadcastState {
  sessionId: string;
  sessionState: string;
  isPaused: boolean;
  duration: number;
  // Audio state (Phase 6)
  isMuted: boolean;
  audioEnabled: boolean;
  audioLevel: number;
  audioAvailable: boolean;
  audioUnavailableReason?: string;
}

/**
 * Calculate the effective recording duration (excluding paused time).
 */
function calculateEffectiveDuration(): number {
  const ctx = getContext();

  if (ctx.recordingStartTime === null) {
    return 0;
  }

  const now = Date.now();
  const totalElapsed = now - ctx.recordingStartTime;

  // Subtract total paused time
  let pausedTime = ctx.totalPausedTime;

  // If currently paused, add the current pause duration
  if (ctx.pauseStartTime !== null) {
    pausedTime += now - ctx.pauseStartTime;
  }

  return Math.max(0, totalElapsed - pausedTime);
}

/**
 * Broadcast current state to callback (which handles UI updates).
 */
function broadcastStateUpdate(): void {
  const ctx = getContext();

  // Only broadcast during active recording states
  if (ctx.state !== 'RECORDING' && ctx.state !== 'PAUSED') {
    return;
  }

  if (!ctx.sessionId) {
    return;
  }

  const duration = calculateEffectiveDuration();
  const isPaused = ctx.state === 'PAUSED';

  // Get current audio state
  const audioState = getAudioState();

  const broadcastState: BroadcastState = {
    sessionId: ctx.sessionId,
    sessionState: ctx.state,
    isPaused,
    duration,
    // Audio state (Phase 6)
    isMuted: audioState.muted,
    audioEnabled: audioState.enabled,
    audioLevel: audioState.level,
    audioAvailable: audioState.available,
    audioUnavailableReason: audioState.unavailableReason,
  };

  // Call the registered callback
  if (broadcastCallback) {
    broadcastCallback(broadcastState);
  }
}

/**
 * Set the callback function that receives broadcast updates.
 * @param callback - Function to call with broadcast state
 */
export function setBroadcastCallback(callback: (state: BroadcastState) => void): void {
  broadcastCallback = callback;
}

/**
 * Start broadcasting state updates at regular intervals.
 */
export function startStateBroadcast(): void {
  if (stateBroadcastTimer !== null) {
    return; // Already running
  }

  console.log('[StateBroadcastManager] Starting state broadcast');
  stateBroadcastTimer = setInterval(broadcastStateUpdate, STATE_BROADCAST_INTERVAL_MS);

  // Send an immediate update
  broadcastStateUpdate();
}

/**
 * Stop broadcasting state updates.
 */
export function stopStateBroadcast(): void {
  if (stateBroadcastTimer !== null) {
    console.log('[StateBroadcastManager] Stopping state broadcast');
    clearInterval(stateBroadcastTimer);
    stateBroadcastTimer = null;
  }
}

/**
 * Check if broadcast is currently active.
 */
export function isBroadcasting(): boolean {
  return stateBroadcastTimer !== null;
}
