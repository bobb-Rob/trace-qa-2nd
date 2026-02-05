/**
 * Recorder Manager
 *
 * Manages MediaRecorder lifecycle and state.
 * Handles start/stop/pause/resume operations and data events.
 *
 * @module offscreen/media/recorderManager
 */

export interface RecorderConfig {
  mimeType: string;
  videoBitsPerSecond: number;
}

export type DataAvailableCallback = (event: BlobEvent) => void;
export type RecorderErrorCallback = (error: Error) => void;

let currentRecorder: MediaRecorder | null = null;
let dataAvailableCallback: DataAvailableCallback | null = null;
let errorCallback: RecorderErrorCallback | null = null;

/**
 * Create and start a MediaRecorder for the given stream.
 * @param stream - The MediaStream to record
 * @param config - Recorder configuration
 */
export function createRecorder(
  stream: MediaStream,
  config: RecorderConfig
): void {
  try {
    const options = {
      mimeType: config.mimeType,
      videoBitsPerSecond: config.videoBitsPerSecond,
    };

    currentRecorder = new MediaRecorder(stream, options);

    // Register event handlers
    currentRecorder.ondataavailable = (event) => {
      if (dataAvailableCallback) {
        dataAvailableCallback(event);
      }
    };

    currentRecorder.onerror = (event) => {
      console.error('[RecorderManager] MediaRecorder error:', event);
      if (errorCallback) {
        errorCallback(new Error('MediaRecorder error'));
      }
    };

    currentRecorder.onstop = () => {
      console.log('[RecorderManager] MediaRecorder stopped');
    };

    console.log('[RecorderManager] MediaRecorder created:', {
      state: currentRecorder.state,
      mimeType: config.mimeType,
      videoBitsPerSecond: config.videoBitsPerSecond,
    });
  } catch (error) {
    console.error('[RecorderManager] Failed to create MediaRecorder:', error);
    throw error;
  }
}

/**
 * Start recording with the specified time slice interval.
 * @param timeslice - Interval in ms for ondataavailable events
 */
export function startRecording(timeslice: number): void {
  if (!currentRecorder) {
    throw new Error('No recorder created');
  }

  if (currentRecorder.state !== 'inactive') {
    throw new Error(`Cannot start recording in state: ${currentRecorder.state}`);
  }

  currentRecorder.start(timeslice);
  console.log('[RecorderManager] Recording started with timeslice:', timeslice);
}

/**
 * Stop the current recording.
 */
export function stopRecording(): void {
  if (!currentRecorder) {
    console.warn('[RecorderManager] No recorder to stop');
    return;
  }

  if (currentRecorder.state === 'inactive') {
    console.warn('[RecorderManager] Recorder already inactive');
    return;
  }

  currentRecorder.stop();
  console.log('[RecorderManager] Recording stopped');
}

/**
 * Pause the current recording.
 */
export function pauseRecording(): void {
  if (!currentRecorder) {
    throw new Error('No recorder to pause');
  }

  if (currentRecorder.state !== 'recording') {
    throw new Error(`Cannot pause recording in state: ${currentRecorder.state}`);
  }

  currentRecorder.pause();
  console.log('[RecorderManager] Recording paused');
}

/**
 * Resume the current recording.
 */
export function resumeRecording(): void {
  if (!currentRecorder) {
    throw new Error('No recorder to resume');
  }

  if (currentRecorder.state !== 'paused') {
    throw new Error(`Cannot resume recording in state: ${currentRecorder.state}`);
  }

  currentRecorder.resume();
  console.log('[RecorderManager] Recording resumed');
}

/**
 * Get the current recorder state.
 */
export function getRecorderState(): RecordingState | null {
  return currentRecorder ? currentRecorder.state : null;
}

/**
 * Register a callback for ondataavailable events.
 */
export function onDataAvailable(callback: DataAvailableCallback): void {
  dataAvailableCallback = callback;
}

/**
 * Register a callback for recorder errors.
 */
export function onRecorderError(callback: RecorderErrorCallback): void {
  errorCallback = callback;
}

/**
 * Clean up the current recorder instance.
 */
export function destroyRecorder(): void {
  if (currentRecorder) {
    // Clear event handlers
    currentRecorder.ondataavailable = null;
    currentRecorder.onerror = null;
    currentRecorder.onstop = null;

    currentRecorder = null;
    dataAvailableCallback = null;
    errorCallback = null;

    console.log('[RecorderManager] Recorder destroyed');
  }
}
