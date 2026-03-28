/**
 * Audio Controller
 *
 * Manages audio state and policy in the background service worker.
 * Phase 6: Control plane only - no actual audio capture (that's Phase 7).
 *
 * Responsibilities:
 * - Track audio enabled/disabled state
 * - Track mute/unmute state
 * - Persist audio preferences
 * - Coordinate audio state with session lifecycle
 * - Provide audio state for UI broadcasts
 *
 * @module background/controllers/audioController
 */

import {
  getAudioSettings,
  updateAudioSettings,
} from '../persistence/persistenceManager';

// ============================================
// TYPES
// ============================================

/**
 * Audio state that's tracked during a session.
 * This is separate from persisted preferences.
 */
export interface AudioState {
  /** Whether audio capture is enabled for this session */
  enabled: boolean;
  /** Whether audio is currently muted */
  muted: boolean;
  /** Current audio level (0-100) for UI indicator */
  level: number;
  /** Whether audio is available (device exists, permission granted) */
  available: boolean;
  /** Reason why audio is unavailable, if applicable */
  unavailableReason?: AudioUnavailableReason;
  /** Preferred microphone device ID */
  deviceId?: string;
}

export type AudioUnavailableReason =
  | 'permission_denied'
  | 'no_device'
  | 'device_in_use'
  | 'not_supported'
  | 'unknown';

/**
 * Audio configuration for starting a recording session.
 */
export interface AudioConfig {
  /** Whether to include audio in the recording */
  enabled: boolean;
  /** Preferred microphone device ID (null = system default) */
  deviceId: string | null;
}

// ============================================
// STATE
// ============================================

/**
 * Current audio state during recording.
 * Reset when session ends.
 */
let currentState: AudioState = {
  enabled: false,
  muted: false,
  level: 0,
  available: true,
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize audio controller.
 * Loads persisted audio preferences.
 */
export async function initAudioController(): Promise<void> {
  console.log('[AudioController] Initializing');

  try {
    const settings = await getAudioSettings();
    currentState = {
      enabled: settings.audioEnabled,
      muted: settings.audioMuted,
      level: 0,
      available: true,
      deviceId: settings.preferredDeviceId ?? undefined,
    };
    console.log('[AudioController] Loaded settings:', currentState);
  } catch (error) {
    console.error('[AudioController] Failed to load settings:', error);
    // Use defaults on error
    currentState = {
      enabled: false,
      muted: false,
      level: 0,
      available: true,
    };
  }
}

// ============================================
// SESSION LIFECYCLE
// ============================================

/**
 * Prepare audio for a new recording session.
 * Called by sessionController before starting capture.
 *
 * @param config - Audio configuration for this session
 * @returns Audio state indicating readiness
 */
export async function prepareAudioForSession(
  config: AudioConfig
): Promise<{ ready: boolean; state: AudioState }> {
  console.log('[AudioController] Preparing audio for session:', config);

  currentState = {
    enabled: config.enabled,
    muted: false, // Start unmuted
    level: 0,
    available: true, // Assume available until Phase 7 checks
    deviceId: config.deviceId ?? undefined,
  };

  // Persist preference
  await updateAudioSettings({
    audioEnabled: config.enabled,
    preferredDeviceId: config.deviceId,
  });

  // Phase 6: Always report ready since we're not actually capturing yet
  // Phase 7 will add actual device availability checks
  return {
    ready: true,
    state: currentState,
  };
}

/**
 * Reset audio state when session ends.
 * Called by sessionController when recording stops.
 */
export function resetAudioForSession(): void {
  console.log('[AudioController] Resetting audio state for session end');

  currentState = {
    ...currentState,
    level: 0,
    available: true,
    unavailableReason: undefined,
  };
}

// ============================================
// MUTE CONTROL
// ============================================

/**
 * Set audio mute state explicitly.
 * NOT a toggle - takes explicit boolean value.
 *
 * @param muted - Whether audio should be muted
 * @returns Updated audio state
 */
export async function setMuted(muted: boolean): Promise<AudioState> {
  console.log('[AudioController] Setting muted:', muted);

  if (currentState.muted === muted) {
    console.log('[AudioController] Mute state unchanged');
    return currentState;
  }

  currentState = {
    ...currentState,
    muted,
  };

  // Persist preference
  await updateAudioSettings({ audioMuted: muted });

  // Phase 7: Will send OFFSCREEN_SET_MUTED command here
  console.log('[AudioController] Mute state updated:', currentState.muted);

  return currentState;
}

/**
 * Mute audio (explicit action, NOT toggle).
 */
export async function mute(): Promise<AudioState> {
  return setMuted(true);
}

/**
 * Unmute audio (explicit action, NOT toggle).
 */
export async function unmute(): Promise<AudioState> {
  return setMuted(false);
}

// ============================================
// ENABLE/DISABLE CONTROL
// ============================================

/**
 * Enable audio capture.
 *
 * @param deviceId - Optional specific device ID
 * @returns Updated audio state
 */
export async function enableAudio(deviceId?: string): Promise<AudioState> {
  console.log('[AudioController] Enabling audio, deviceId:', deviceId);

  currentState = {
    ...currentState,
    enabled: true,
    deviceId,
    available: true,
    unavailableReason: undefined,
  };

  await updateAudioSettings({
    audioEnabled: true,
    preferredDeviceId: deviceId ?? null,
  });

  // Phase 7: Will send OFFSCREEN_ENABLE_AUDIO command here

  return currentState;
}

/**
 * Disable audio capture.
 *
 * @returns Updated audio state
 */
export async function disableAudio(): Promise<AudioState> {
  console.log('[AudioController] Disabling audio');

  currentState = {
    ...currentState,
    enabled: false,
    level: 0,
  };

  await updateAudioSettings({ audioEnabled: false });

  // Phase 7: Will send OFFSCREEN_DISABLE_AUDIO command here

  return currentState;
}

// ============================================
// AUDIO LEVEL (Phase 7)
// ============================================

/**
 * Update audio level from offscreen.
 * Called when receiving OFFSCREEN_AUDIO_LEVEL events.
 *
 * @param level - Audio level (0-100)
 */
export function updateAudioLevel(level: number): void {
  // Clamp to valid range
  currentState = {
    ...currentState,
    level: Math.max(0, Math.min(100, level)),
  };
}

// ============================================
// AVAILABILITY (Phase 7)
// ============================================

/**
 * Mark audio as unavailable with a reason.
 * Called when audio device/permission issues occur.
 *
 * @param reason - Why audio is unavailable
 */
export function markAudioUnavailable(reason: AudioUnavailableReason): void {
  console.warn('[AudioController] Audio unavailable:', reason);

  currentState = {
    ...currentState,
    available: false,
    unavailableReason: reason,
    level: 0,
  };
}

/**
 * Mark audio as available again.
 */
export function markAudioAvailable(): void {
  console.log('[AudioController] Audio available');

  currentState = {
    ...currentState,
    available: true,
    unavailableReason: undefined,
  };
}

// ============================================
// STATE ACCESS
// ============================================

/**
 * Get current audio state.
 * Used by stateBroadcastManager for UI updates.
 */
export function getAudioState(): AudioState {
  return { ...currentState };
}

/**
 * Check if audio is enabled and not muted.
 * Useful for quick checks.
 */
export function isAudioActive(): boolean {
  return currentState.enabled && !currentState.muted && currentState.available;
}

/**
 * Get audio configuration for session start.
 * Used by sessionController when starting a recording.
 */
export function getAudioConfig(): AudioConfig {
  return {
    enabled: currentState.enabled,
    deviceId: currentState.deviceId ?? null,
  };
}

// ============================================
// MESSAGE HANDLERS (Phase 7)
// ============================================

/**
 * Handle mute command from FloatingPane.
 * Explicit mute, NOT toggle.
 */
export async function handleFloatingPaneMute(
  _payload: { sessionId: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await mute();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mute',
    };
  }
}

/**
 * Handle unmute command from FloatingPane.
 * Explicit unmute, NOT toggle.
 */
export async function handleFloatingPaneUnmute(
  _payload: { sessionId: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await unmute();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unmute',
    };
  }
}

/**
 * Handle audio level event from offscreen.
 * Phase 7: Will receive actual levels from AudioContext analyser.
 */
export function handleAudioLevelEvent(payload: { level: number }): void {
  updateAudioLevel(payload.level);
}
