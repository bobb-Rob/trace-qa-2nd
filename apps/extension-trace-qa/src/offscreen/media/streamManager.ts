/**
 * Stream Manager
 *
 * Manages MediaStream lifecycle for screen capture.
 * Handles getDisplayMedia, track cleanup, and stream lifecycle events.
 * Supports audio track injection for mixed recording.
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
 * Add audio track to the current video stream.
 * This allows MediaRecorder to capture both video and audio in one stream.
 * 
 * @param audioTrack - Mixed audio track from audioMixer
 */
export function addAudioTrack(audioTrack: MediaStreamTrack): void {
  if (!currentStream) {
    console.warn('[StreamManager] Cannot add audio track: no active stream');
    return;
  }

  // Remove existing audio tracks first
  currentStream.getAudioTracks().forEach((track) => {
    currentStream!.removeTrack(track);
    track.stop();
  });

  // Add new audio track
  currentStream.addTrack(audioTrack);

  console.log('[StreamManager] Audio track added:', {
    trackId: audioTrack.id,
    trackLabel: audioTrack.label,
    totalTracks: currentStream.getTracks().length,
  });
}

/**
 * Remove audio track from the stream.
 */
export function removeAudioTrack(): void {
  if (!currentStream) {
    return;
  }

  currentStream.getAudioTracks().forEach((track) => {
    currentStream!.removeTrack(track);
    track.stop();
  });

  console.log('[StreamManager] Audio track removed');
}

/**
 * Check if stream has audio track.
 */
export function hasAudioTrack(): boolean {
  const trackCount = currentStream?.getAudioTracks().length ?? 0;
  return trackCount > 0;
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
