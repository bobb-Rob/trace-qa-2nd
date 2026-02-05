/**
 * Capture Controller
 *
 * Orchestrates the media capture pipeline.
 * Coordinates stream acquisition, recording, chunk accumulation, and storage.
 *
 * @module offscreen/controllers/captureController
 */

import * as streamManager from '../media/streamManager';
import * as recorderManager from '../media/recorderManager';
import * as chunkManager from '../data/chunkManager';
import * as storageManager from '../data/storageManager';

export interface CaptureConfig {
  mimeType: string;
  videoBitsPerSecond: number;
  width: number;
  height: number;
  frameRate: number;
}

export type CaptureCompleteCallback = (sessionId: string, blob: Blob) => void;
export type CaptureErrorCallback = (error: string) => void;
export type StreamEndedCallback = () => void;

let currentSessionId: string | null = null;
let currentMimeType: string | null = null;
let captureCompleteCallback: CaptureCompleteCallback | null = null;
let captureErrorCallback: CaptureErrorCallback | null = null;
let streamEndedCallback: StreamEndedCallback | null = null;

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

    // 1. Acquire display stream
    const stream = await streamManager.acquireStream({
      frameRate: { ideal: config.frameRate },
      width: { ideal: config.width },
      height: { ideal: config.height },
    });

    // Register stream end handler
    streamManager.onStreamEnded(() => {
      console.log('[CaptureController] Stream ended externally');
      if (streamEndedCallback) {
        streamEndedCallback();
      }
    });

    // 2. Create MediaRecorder
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

  // Reset state
  currentSessionId = null;
  currentMimeType = null;
}

/**
 * Get current session ID (for diagnostics).
 */
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}
