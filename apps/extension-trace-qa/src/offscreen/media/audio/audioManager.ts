/**
 * Audio Manager
 *
 * Manages microphone capture and permission lifecycle.
 * Handles device availability and permission changes.
 *
 * @module offscreen/media/audio/audioManager
 */

export type AudioErrorCallback = (error: string) => void;

let micStream: MediaStream | null = null;
let enabled = false;
let errorCallback: AudioErrorCallback | null = null;

/**
 * Initialize audio manager.
 * Prepares for audio capture but doesn't request permissions yet.
 */
export function initialize(): void {
  micStream = null;
  enabled = false;
  console.log('[AudioManager] Initialized');
}

/**
 * Enable microphone capture and request permissions.
 * @returns MediaStream if successful, null if denied/unavailable
 */
export async function enable(): Promise<MediaStream | null> {
  if (micStream && enabled) {
    console.log('[AudioManager] Already enabled, returning existing stream');
    return micStream;
  }

  try {
    console.log('[AudioManager] Requesting microphone access');
    
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false, // Explicit: avoid browser heuristics
        autoGainControl: false,  // Deterministic gain control
        sampleRate: 48000,       // Standard for video
      },
    });

    enabled = true;

    // Monitor track ending (device unplugged, permission revoked)
    const audioTrack = micStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.addEventListener('ended', () => {
        console.warn('[AudioManager] Microphone track ended (device lost or permission revoked)');
        enabled = false;
        micStream = null;
        
        if (errorCallback) {
          errorCallback('Microphone access lost');
        }
      });
    }

    console.log('[AudioManager] Microphone enabled:', {
      trackId: audioTrack?.id,
      label: audioTrack?.label,
      settings: audioTrack?.getSettings(),
    });

    return micStream;
  } catch (err) {
    console.warn('[AudioManager] Microphone permission denied or unavailable:', err);
    enabled = false;
    micStream = null;
    
    if (errorCallback) {
      const errorMsg = err instanceof Error ? err.message : 'Microphone access denied';
      errorCallback(errorMsg);
    }
    
    return null;
  }
}

/**
 * Disable microphone capture and stop all tracks.
 */
export function disable(): void {
  if (micStream) {
    console.log('[AudioManager] Disabling microphone');
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  enabled = false;
}

/**
 * Get the current microphone stream.
 * @returns MediaStream if available, null otherwise
 */
export function getStream(): MediaStream | null {
  return micStream;
}

/**
 * Check if microphone is currently enabled.
 */
export function isEnabled(): boolean {
  return enabled && micStream !== null;
}

/**
 * Register callback for audio errors.
 * @param callback - Function to call on audio errors
 */
export function onAudioError(callback: AudioErrorCallback): void {
  errorCallback = callback;
}

/**
 * Clear the error callback.
 */
export function clearErrorCallback(): void {
  errorCallback = null;
}

/**
 * Get microphone device info (for diagnostics).
 */
export function getDeviceInfo(): { enabled: boolean; hasStream: boolean; trackCount: number } {
  return {
    enabled,
    hasStream: micStream !== null,
    trackCount: micStream?.getAudioTracks().length ?? 0,
  };
}
