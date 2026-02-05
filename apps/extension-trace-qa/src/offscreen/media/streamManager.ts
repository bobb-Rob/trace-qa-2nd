/**
 * Stream Manager
 *
 * Manages MediaStream lifecycle for screen capture.
 * Handles getDisplayMedia, track cleanup, and stream lifecycle events.
 *
 * @module offscreen/media/streamManager
 */

export type StreamEndedCallback = () => void;

let currentStream: MediaStream | null = null;
let streamEndedCallback: StreamEndedCallback | null = null;

/**
 * Acquire a display media stream.
 * @param video - Video constraints configuration
 * @returns The captured MediaStream
 */
export async function acquireStream(video: {
  frameRate: { ideal: number };
  width: { ideal: number };
  height: { ideal: number };
  displaySurface?: 'monitor' | 'window' | 'browser';
}): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video,
      audio: false,
    });

    currentStream = stream;

    // Register stream end handler (user clicked browser's "Stop sharing" button)
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      console.log('[StreamManager] Stream ended by user');
      if (streamEndedCallback) {
        streamEndedCallback();
      }
    });

    console.log('[StreamManager] Stream acquired:', {
      trackCount: stream.getTracks().length,
      videoTrackLabel: stream.getVideoTracks()[0]?.label,
    });

    return stream;
  } catch (error) {
    console.error('[StreamManager] Failed to acquire stream:', error);
    throw error;
  }
}

/**
 * Stop all tracks in the current stream.
 */
export function stopStream(): void {
  if (currentStream) {
    console.log('[StreamManager] Stopping all tracks');
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
}

/**
 * Get the current active stream (if any).
 */
export function getCurrentStream(): MediaStream | null {
  return currentStream;
}

/**
 * Register a callback to be invoked when the stream ends externally.
 * @param callback - Function to call when stream ends
 */
export function onStreamEnded(callback: StreamEndedCallback): void {
  streamEndedCallback = callback;
}

/**
 * Clear the stream ended callback.
 */
export function clearStreamEndedCallback(): void {
  streamEndedCallback = null;
}
