/**
 * Capture Controller
 *
 * Orchestrates the media capture pipeline.
 * Coordinates stream acquisition, recording, chunk accumulation, and storage.
 * Manages audio capture, mixing, and level monitoring.
 *
 * @module offscreen/controllers/captureController
 */

import * as streamManager from '../media/streamManager';
import * as recorderManager from '../media/recorderManager';
import * as chunkManager from '../data/chunkManager';
import * as storageManager from '../data/storageManager';
import * as audioManager from '../media/audio/audioManager';
import * as audioMixer from '../media/audio/audioMixer';
import * as audioLevels from '../media/audio/audioLevels';

export interface CaptureConfig {
  mimeType: string;
  videoBitsPerSecond: number;
  width: number;
  height: number;
  frameRate: number;
  audioEnabled?: boolean; // Optional audio capture
}

export type CaptureCompleteCallback = (sessionId: string, blob: Blob) => void;
export type CaptureErrorCallback = (error: string) => void;
export type StreamEndedCallback = () => void;
export type AudioUnavailableCallback = (reason: string, message: string) => void;

let currentSessionId: string | null = null;
let currentMimeType: string | null = null;
let captureCompleteCallback: CaptureCompleteCallback | null = null;
let captureErrorCallback: CaptureErrorCallback | null = null;
let streamEndedCallback: StreamEndedCallback | null = null;
let audioUnavailableCallback: AudioUnavailableCallback | null = null;
let audioEnabled = false;
let audioInitialized = false;

/**
 * Start a new capture session.
 * Acquires stream, creates recorder, and starts recording.
 *
 * @param sessionId - Unique session identifier
 * @param config - Capture configuration
 */
export async function startCapture(
  sessionId: string,
  config: CaptureConfig
): Promise<void> {
  try {
    console.log('[CaptureController] Starting capture:', { sessionId, config });

    currentSessionId = sessionId;
    currentMimeType = config.mimeType;

    // Clear any previous chunks
    chunkManager.clearChunks();

    // 1. Acquire display stream (shows screen/tab/window picker)
    // The screen picker always appears — this is expected browser behavior.
    const stream = await streamManager.acquireStream({
      frameRate: { ideal: config.frameRate },
      width: { ideal: config.width },
      height: { ideal: config.height },
    });

    // Log actual vs requested stream quality for verification
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const actual = videoTrack.getSettings();
      console.log('[CaptureController] Quality verification:', {
        requested: { width: config.width, height: config.height, frameRate: config.frameRate, bitrate: config.videoBitsPerSecond },
        actual: { width: actual.width, height: actual.height, frameRate: actual.frameRate },
      });
      if (actual.width && actual.width < config.width * 0.8) {
        console.warn('[CaptureController] Width significantly below requested:', actual.width, 'vs', config.width);
      }
      if (actual.height && actual.height < config.height * 0.8) {
        console.warn('[CaptureController] Height significantly below requested:', actual.height, 'vs', config.height);
      }
    }

    // Register stream end handler
    streamManager.onStreamEnded(() => {
      console.log('[CaptureController] Stream ended externally');
      if (streamEndedCallback) {
        streamEndedCallback();
      }
    });

    // 2. Initialize audio pipeline if enabled.
    // IMPORTANT: Offscreen assumes mic permission was already granted by the popup.
    // getUserMedia() here should succeed silently (no prompt) because the popup
    // already triggered the browser permission dialog. If it fails for any reason,
    // we fall back to video-only — audio must never block recording.
    audioEnabled = config.audioEnabled ?? false;
    const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log('[MIC-PERM][OFFSCREEN] audioEnabled flag received:', audioEnabled);
    if (audioEnabled) {
      console.log(`[MIC-PERM][OFFSCREEN] Initializing audio pipeline at ${ts()}`);
      console.log('[MIC-PERM][OFFSCREEN] offscreen context URL:', window.location.href);

      try {
        // Initialize audio manager
        audioManager.initialize();

        // getUserMedia() — should auto-grant since popup already obtained permission
        const micStream = await audioManager.enable();

        if (!micStream) {
          console.warn('[CaptureController] Microphone unavailable, continuing video-only');
          if (audioUnavailableCallback) {
            audioUnavailableCallback('permission_denied', 'Microphone permission denied');
          }
          audioEnabled = false;
        } else {
          try {
            // Initialize mixer
            audioMixer.initialize();
            audioMixer.connectMic(micStream);

            // Get mixed audio track
            const audioTrack = audioMixer.getMixedTrack();
            if (audioTrack) {
              // Add audio track to video stream
              streamManager.addAudioTrack(audioTrack);

              // Attach level monitoring
              try {
                const context = new AudioContext();
                const source = context.createMediaStreamSource(micStream);
                audioLevels.attach(context, source);
              } catch (levelError) {
                console.warn('[CaptureController] Audio level monitoring failed (non-critical):', levelError);
              }

              audioInitialized = true;
              console.log('[CaptureController] Audio pipeline initialized successfully');
            } else {
              console.warn('[CaptureController] No mixed audio track available, continuing video-only');
              if (audioUnavailableCallback) {
                audioUnavailableCallback('initialization_failed', 'No mixed audio track available');
              }
              audioEnabled = false;
            }
          } catch (mixerError) {
            console.error('[CaptureController] Audio mixer initialization failed, continuing video-only:', mixerError);
            if (audioUnavailableCallback) {
              audioUnavailableCallback('initialization_failed', 'Audio mixer initialization failed');
            }
            audioEnabled = false;
            audioInitialized = false;

            // Cleanup partial audio state
            try {
              audioManager.disable();
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
          }
        }
      } catch (error) {
        console.error('[CaptureController] Audio initialization failed, continuing video-only:', error);
        if (audioUnavailableCallback) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          audioUnavailableCallback('unknown', errorMsg);
        }
        audioEnabled = false;
        audioInitialized = false;

        // Ensure audio state is clean
        try {
          audioManager.disable();
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    }

    // 3. Create MediaRecorder
    recorderManager.createRecorder(stream, {
      mimeType: config.mimeType,
      videoBitsPerSecond: config.videoBitsPerSecond,
    });

    // Register data available handler
    recorderManager.onDataAvailable((event) => {
      if (event.data && event.data.size > 0) {
        chunkManager.addChunk(event.data);
      }
    });

    // Register error handler
    recorderManager.onRecorderError((error) => {
      console.error('[CaptureController] Recorder error:', error);
      if (captureErrorCallback) {
        captureErrorCallback(error.message);
      }
    });

    // 3. Start recording (500ms timeslice)
    recorderManager.startRecording(500);

    console.log('[CaptureController] Capture started successfully');
  } catch (error) {
    console.error('[CaptureController] Failed to start capture:', error);
    throw error;
  }
}

/**
 * Stop the current capture session.
 * Finalizes recording, assembles blob, and stores in IndexedDB.
 */
export async function stopCapture(): Promise<void> {
  try {
    if (!currentSessionId || !currentMimeType) {
      throw new Error('No active capture session');
    }

    console.log('[CaptureController] Stopping capture:', currentSessionId);

    // Stop recording
    recorderManager.stopRecording();

    // Give recorder time to flush final chunks (brief delay)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assemble final blob
    const blob = chunkManager.assembleBlob(currentMimeType);

    if (blob.size === 0) {
      throw new Error('Recording produced empty blob');
    }

    // Store blob in IndexedDB
    await storageManager.storeBlob(currentSessionId, blob);

    // Notify completion
    if (captureCompleteCallback) {
      captureCompleteCallback(currentSessionId, blob);
    }

    // Cleanup
    cleanup();

    console.log('[CaptureController] Capture stopped successfully');
  } catch (error) {
    console.error('[CaptureController] Failed to stop capture:', error);
    cleanup();
    throw error;
  }
}

/**
 * Pause the current recording.
 */
export function pauseCapture(): void {
  try {
    recorderManager.pauseRecording();
    console.log('[CaptureController] Capture paused');
  } catch (error) {
    console.error('[CaptureController] Failed to pause capture:', error);
    throw error;
  }
}

/**
 * Resume the current recording.
 */
export function resumeCapture(): void {
  try {
    recorderManager.resumeRecording();
    console.log('[CaptureController] Capture resumed');
  } catch (error) {
    console.error('[CaptureController] Failed to resume capture:', error);
    throw error;
  }
}

/**
 * Download a stored blob (retrieve from IndexedDB and trigger download).
 * @param sessionId - Session identifier
 * @param filename - Download filename
 */
export async function downloadBlob(sessionId: string, filename: string): Promise<void> {
  try {
    const blob = await storageManager.retrieveBlob(sessionId);

    if (!blob) {
      throw new Error('Blob not found in storage');
    }

    // Create download URL and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    // Cleanup URL after download
    setTimeout(() => URL.revokeObjectURL(url), 100);

    // Delete blob from storage
    await storageManager.deleteBlob(sessionId);

    console.log('[CaptureController] Download completed:', { sessionId, filename });
  } catch (error) {
    console.error('[CaptureController] Failed to download blob:', error);
    throw error;
  }
}

/**
 * Register callback for capture completion.
 */
export function onCaptureComplete(callback: CaptureCompleteCallback): void {
  captureCompleteCallback = callback;
}

/**
 * Register callback for capture errors.
 */
export function onCaptureError(callback: CaptureErrorCallback): void {
  captureErrorCallback = callback;
}

/**
 * Register callback for external stream end.
 */
export function onStreamEnded(callback: StreamEndedCallback): void {
  streamEndedCallback = callback;
}

/**
 * Register callback for audio unavailability.
 */
export function onAudioUnavailable(callback: AudioUnavailableCallback): void {
  audioUnavailableCallback = callback;
}

/**
 * Mute audio (if audio is enabled).
 * Uses GainNode for instant, glitch-free muting.
 */
export function muteAudio(): void {
  if (!audioEnabled || !audioInitialized) {
    console.warn('[CaptureController] Cannot mute: audio not enabled');
    return;
  }

  audioMixer.setMuted(true);
  console.log('[CaptureController] Audio muted');
}

/**
 * Unmute audio (if audio is enabled).
 */
export function unmuteAudio(): void {
  if (!audioEnabled || !audioInitialized) {
    console.warn('[CaptureController] Cannot unmute: audio not enabled');
    return;
  }

  audioMixer.setMuted(false);
  console.log('[CaptureController] Audio unmuted');
}

/**
 * Get current audio level (0-1 normalized).
 * Returns 0 if audio not enabled or muted.
 */
export function getAudioLevel(): number {
  if (!audioEnabled || !audioInitialized) {
    return 0;
  }

  return audioLevels.getLevel();
}

/**
 * Get audio state (for diagnostics).
 */
export function getAudioState(): {
  enabled: boolean;
  initialized: boolean;
  muted: boolean;
  hasAudioTrack: boolean;
} {
  return {
    enabled: audioEnabled,
    initialized: audioInitialized,
    muted: audioMixer.getMuted(),
    hasAudioTrack: streamManager.hasAudioTrack(),
  };
}

/**
 * Cleanup resources after capture session.
 */
function cleanup(): void {
  // Stop stream
  streamManager.stopStream();
  streamManager.clearStreamEndedCallback();

  // Destroy recorder
  recorderManager.destroyRecorder();

  // Clear chunks
  chunkManager.clearChunks();

  // Cleanup audio pipeline
  if (audioInitialized) {
    audioLevels.detach();
    audioMixer.disconnectMic();
    audioMixer.destroy();
    audioManager.disable();
    audioManager.clearErrorCallback();
    audioInitialized = false;
  }

  // Reset state
  currentSessionId = null;
  currentMimeType = null;
  audioEnabled = false;
}

/**
 * Get current session ID (for diagnostics).
 */
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}
