/**
 * Persistence Manager
 *
 * Centralized chrome.storage.local operations for session state persistence.
 * Provides type-safe access to stored recording state.
 *
 * @module background/persistence/persistenceManager
 */

/**
 * Persisted session state stored in chrome.storage.local
 */
export interface PersistedSessionState {
  sessionId: string | null;
  isRecording: boolean;
  startTime: number | null;
  lastError: string | null;
  sessionState?: string;
  fsmPauseStartTime: number | null;
  fsmTotalPausedTime: number;
}

/**
 * Update persisted session state fields.
 * @param updates - Partial fields to update
 */
export async function updateSessionState(updates: Partial<PersistedSessionState>): Promise<void> {
  try {
    await chrome.storage.local.set(updates);
  } catch (error) {
    console.error('[PersistenceManager] Failed to update session state:', error);
    throw error;
  }
}

/**
 * Get current persisted session state.
 */
export async function getSessionState(): Promise<PersistedSessionState> {
  try {
    const data = await chrome.storage.local.get([
      'sessionId',
      'isRecording',
      'startTime',
      'lastError',
      'sessionState',
      'fsmPauseStartTime',
      'fsmTotalPausedTime',
    ]);

    return {
      sessionId: data.sessionId ?? null,
      isRecording: data.isRecording ?? false,
      startTime: data.startTime ?? null,
      lastError: data.lastError ?? null,
      sessionState: data.sessionState ?? 'IDLE',
      fsmPauseStartTime: data.fsmPauseStartTime ?? null,
      fsmTotalPausedTime: data.fsmTotalPausedTime ?? 0,
    };
  } catch (error) {
    console.error('[PersistenceManager] Failed to get session state:', error);
    throw error;
  }
}

/**
 * Clear all session state from storage (reset to defaults).
 */
export async function clearSessionState(): Promise<void> {
  try {
    await chrome.storage.local.set({
      sessionId: null,
      isRecording: false,
      startTime: null,
      lastError: null,
      fsmPauseStartTime: null,
      fsmTotalPausedTime: 0,
    });
  } catch (error) {
    console.error('[PersistenceManager] Failed to clear session state:', error);
    throw error;
  }
}

/**
 * Initialize session with given ID.
 */
export async function initializeSession(sessionId: string): Promise<void> {
  await updateSessionState({
    sessionId,
    isRecording: false,
  });
}

/**
 * Mark recording as active.
 */
export async function markRecordingActive(startTime: number): Promise<void> {
  await updateSessionState({
    isRecording: true,
    startTime,
  });
}

/**
 * Mark recording as inactive.
 */
export async function markRecordingInactive(): Promise<void> {
  await updateSessionState({
    isRecording: false,
  });
}

/**
 * Persist pause timing data.
 */
export async function persistPauseTiming(pauseStartTime: number | null, totalPausedTime: number): Promise<void> {
  await updateSessionState({
    fsmPauseStartTime: pauseStartTime,
    fsmTotalPausedTime: totalPausedTime,
  });
}

/**
 * Persist error state.
 */
export async function persistError(error: string): Promise<void> {
  await updateSessionState({
    lastError: error,
  });
}

// ─────────────────────────────────────────────────────────────
// Audio Settings Persistence
// ─────────────────────────────────────────────────────────────

/**
 * Audio settings persisted in chrome.storage.local
 */
export interface AudioSettings {
  /** Whether audio capture is enabled (user preference) */
  audioEnabled: boolean;
  /** Whether audio is muted (user preference) */
  audioMuted: boolean;
  /** Preferred microphone device ID (null = system default) */
  preferredDeviceId: string | null;
}

/**
 * Default audio settings.
 */
const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  audioEnabled: false,
  audioMuted: false,
  preferredDeviceId: null,
};

/**
 * Get persisted audio settings.
 */
export async function getAudioSettings(): Promise<AudioSettings> {
  try {
    const data = await chrome.storage.local.get([
      'audioEnabled',
      'audioMuted',
      'preferredDeviceId',
    ]);

    return {
      audioEnabled: data.audioEnabled ?? DEFAULT_AUDIO_SETTINGS.audioEnabled,
      audioMuted: data.audioMuted ?? DEFAULT_AUDIO_SETTINGS.audioMuted,
      preferredDeviceId: data.preferredDeviceId ?? DEFAULT_AUDIO_SETTINGS.preferredDeviceId,
    };
  } catch (error) {
    console.error('[PersistenceManager] Failed to get audio settings:', error);
    return DEFAULT_AUDIO_SETTINGS;
  }
}

/**
 * Update audio settings.
 * @param updates - Partial audio settings to update
 */
export async function updateAudioSettings(updates: Partial<AudioSettings>): Promise<void> {
  try {
    await chrome.storage.local.set(updates);
  } catch (error) {
    console.error('[PersistenceManager] Failed to update audio settings:', error);
    throw error;
  }
}

/**
 * Reset audio settings to defaults.
 */
export async function resetAudioSettings(): Promise<void> {
  try {
    await chrome.storage.local.set(DEFAULT_AUDIO_SETTINGS);
  } catch (error) {
    console.error('[PersistenceManager] Failed to reset audio settings:', error);
    throw error;
  }
}
