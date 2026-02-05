/**
 * Session Controller
 *
 * Manages recording session lifecycle (start/stop/pause/resume).
 * Coordinates FSM transitions, offscreen document, and validation.
 *
 * @module background/controllers/sessionController
 */

import {
  transition,
  getState,
  getContext,
  updateContext,
  isMessageFresh,
} from '../fsm';

import {
  createOffscreenDocument,
  startCapture,
  stopCapture,
  pauseRecording,
  resumeRecording,
  downloadBlob,
} from './offscreenController';

import {
  initializeSession,
  markRecordingActive,
  markRecordingInactive,
  persistPauseTiming,
  getSessionState,
} from '../persistence/persistenceManager';

import {
  RECORDER_CONFIG,
  type VideoRecordingConfig,
  type OffscreenCaptureCompletePayload,
  type OffscreenStreamEndedPayload,
  type OffscreenErrorPayload,
} from '../../shared/types';

// Session state
let recordingTabId: number | null = null;

/**
 * Get the current recording tab ID (for TAB mode).
 */
export function getRecordingTabId(): number | null {
  return recordingTabId;
}

/**
 * Start a new recording session.
 * @param payload - Session start parameters
 * @returns Success response or error
 */
export async function startRecordingSession(payload: {
  sessionId: string;
  tabId: number;
  videoConfig: VideoRecordingConfig;
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    console.log('[SessionController] Starting recording:', payload.sessionId);

    // Check current state via FSM
    if (getState() !== 'IDLE') {
      return { success: false, error: 'Already recording or busy' };
    }

    // Store tab ID for TAB recording mode (used for FloatingPane)
    if (payload.videoConfig.captureMode === 'TAB') {
      recordingTabId = payload.tabId;
    } else {
      recordingTabId = null; // DESKTOP/WINDOW modes don't use content script
    }

    // Update context with session info
    updateContext({ sessionId: payload.sessionId });

    // Transition: IDLE -> REQUESTING_PERMISSION
    await transition({ type: 'START_REQUESTED' }, 'User clicked start');

    // Persist session info to storage
    await initializeSession(payload.sessionId);

    // 1. Create offscreen document
    await createOffscreenDocument();

    // Transition: REQUESTING_PERMISSION -> STARTING
    await transition({ type: 'PERMISSION_GRANTED' }, 'Offscreen document created');

    // 2. Get recorder config based on quality setting
    const qualityConfig = RECORDER_CONFIG[payload.videoConfig.quality];

    // 3. Send message to offscreen to start capture
    // State stays STARTING until we receive OFFSCREEN_CAPTURE_STARTED
    startCapture(payload.sessionId, {
      mimeType: qualityConfig.mimeType,
      videoBitsPerSecond: qualityConfig.videoBitsPerSecond,
      width: qualityConfig.width,
      height: qualityConfig.height,
      frameRate: qualityConfig.frameRate,
      audioEnabled: true, // Phase 7: Enable audio capture by default
    });

    // Response is immediate - actual RECORDING state comes via OFFSCREEN_CAPTURE_STARTED
    return { success: true, sessionId: payload.sessionId };
  } catch (error) {
    console.error('[SessionController] Start recording error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Stop the current recording session.
 * @param payload - Session stop parameters
 * @returns Success response or error
 */
export async function stopRecordingSession(payload: {
  sessionId: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('[SessionController] Stopping recording:', payload.sessionId);

    const ctx = getContext();

    // Can stop from RECORDING or PAUSED state
    if (ctx.state !== 'RECORDING' && ctx.state !== 'PAUSED') {
      return { success: false, error: 'Not recording' };
    }

    if (payload.sessionId !== ctx.sessionId) {
      return { success: false, error: 'Session mismatch' };
    }

    // Transition: RECORDING/PAUSED -> STOPPING
    await transition({ type: 'STOP_REQUESTED' }, 'User clicked stop');

    // Persist state
    await markRecordingInactive();

    // Tell offscreen to stop and finalize
    stopCapture(payload.sessionId);

    // Response will come asynchronously via OFFSCREEN_CAPTURE_COMPLETE
    return { success: true, message: 'Stop initiated' };
  } catch (error) {
    console.error('[SessionController] Stop recording error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Pause the current recording session.
 * @param payload - Session pause parameters
 * @returns Success response or error
 */
export async function pauseRecordingSession(payload: {
  sessionId: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('[SessionController] Pause requested:', payload.sessionId);

    const ctx = getContext();

    // Can only pause from RECORDING state
    if (ctx.state !== 'RECORDING') {
      return { success: false, error: 'Not recording (cannot pause)' };
    }

    if (payload.sessionId !== ctx.sessionId) {
      return { success: false, error: 'Session mismatch' };
    }

    // Tell offscreen to pause the MediaRecorder
    pauseRecording(payload.sessionId);

    // Response is immediate - actual PAUSED state comes via OFFSCREEN_PAUSED
    return { success: true, message: 'Pause initiated' };
  } catch (error) {
    console.error('[SessionController] Pause error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resume the current recording session.
 * @param payload - Session resume parameters
 * @returns Success response or error
 */
export async function resumeRecordingSession(payload: {
  sessionId: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('[SessionController] Resume requested:', payload.sessionId);

    const ctx = getContext();

    // Can only resume from PAUSED state
    if (ctx.state !== 'PAUSED') {
      return { success: false, error: 'Not paused (cannot resume)' };
    }

    if (payload.sessionId !== ctx.sessionId) {
      return { success: false, error: 'Session mismatch' };
    }

    // Tell offscreen to resume the MediaRecorder
    resumeRecording(payload.sessionId);

    // Response is immediate - actual RECORDING state comes via OFFSCREEN_RESUMED
    return { success: true, message: 'Resume initiated' };
  } catch (error) {
    console.error('[SessionController] Resume error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle capture started confirmation from offscreen.
 * Transitions FSM to RECORDING state.
 */
export async function handleCaptureStarted(payload: { sessionId: string }): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[SessionController] Ignoring stale CAPTURE_STARTED message');
    return;
  }

  console.log('[SessionController] Capture started confirmed:', payload.sessionId);

  // Transition: STARTING -> RECORDING
  await transition({ type: 'CAPTURE_STARTED' }, 'Offscreen confirmed capture started');

  // Update context with recording start time
  const startTime = Date.now();
  updateContext({ recordingStartTime: startTime });

  // Persist recording state
  await markRecordingActive(startTime);
}

/**
 * Handle offscreen pause confirmation.
 * Transitions FSM to PAUSED state and tracks pause timing.
 */
export async function handleOffscreenPaused(payload: { sessionId: string }): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[SessionController] Ignoring stale OFFSCREEN_PAUSED message');
    return;
  }

  console.log('[SessionController] Pause confirmed:', payload.sessionId);

  // Transition: RECORDING -> PAUSED
  await transition({ type: 'PAUSE_REQUESTED' }, 'MediaRecorder paused');

  // Track when pause started for duration calculation
  const pauseStartTime = Date.now();
  const ctx = getContext();
  updateContext({ pauseStartTime });

  // Persist pause timing to storage
  await persistPauseTiming(pauseStartTime, ctx.totalPausedTime);
}

/**
 * Handle offscreen resume confirmation.
 * Transitions FSM back to RECORDING and accumulates paused time.
 */
export async function handleOffscreenResumed(payload: { sessionId: string }): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[SessionController] Ignoring stale OFFSCREEN_RESUMED message');
    return;
  }

  console.log('[SessionController] Resume confirmed:', payload.sessionId);

  const ctx = getContext();

  // Calculate how long we were paused and add to total
  if (ctx.pauseStartTime !== null) {
    const pauseDuration = Date.now() - ctx.pauseStartTime;
    const newTotalPausedTime = ctx.totalPausedTime + pauseDuration;
    updateContext({
      pauseStartTime: null,
      totalPausedTime: newTotalPausedTime,
    });

    // Persist updated pause timing to storage
    await persistPauseTiming(null, newTotalPausedTime);
  }

  // Transition: PAUSED -> RECORDING
  await transition({ type: 'RESUME_REQUESTED' }, 'MediaRecorder resumed');
}

/**
 * Handle capture complete from offscreen.
 * Transitions to UPLOADING and requests download.
 */
export async function handleCaptureComplete(payload: OffscreenCaptureCompletePayload): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[SessionController] Ignoring stale CAPTURE_COMPLETE message');
    return;
  }

  console.log('[SessionController] Capture complete:', payload);

  try {
    // Transition: STOPPING -> UPLOADING
    await transition({ type: 'CAPTURE_STOPPED' }, 'MediaRecorder stopped successfully');

    // Tell offscreen to trigger the download (it has DOM access for URL.createObjectURL)
    downloadBlob(payload.sessionId, payload.blobKey);

    // State will be updated when download completes via OFFSCREEN_DOWNLOAD_COMPLETE
  } catch (error) {
    console.error('[SessionController] Error handling capture complete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
  }
}

/**
 * Handle external stream termination (user clicked "Stop sharing" in browser UI).
 * This is semantically different from a user-initiated stop via the extension UI.
 */
export async function handleStreamEnded(payload: OffscreenStreamEndedPayload): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[SessionController] Ignoring stale STREAM_ENDED message');
    return;
  }

  console.log('[SessionController] Stream ended externally (Stop sharing):', payload);

  try {
    // Transition: RECORDING -> UPLOADING (via STREAM_ENDED event)
    // This preserves FSM semantics: external stop is different from requested stop
    await transition({ type: 'STREAM_ENDED' }, 'User clicked Stop sharing in browser UI');

    // Persist state
    await markRecordingInactive();

    // Tell offscreen to trigger the download (video data is still valid)
    downloadBlob(payload.sessionId, payload.blobKey);

    // State will be updated when download completes via OFFSCREEN_DOWNLOAD_COMPLETE
  } catch (error) {
    console.error('[SessionController] Error handling stream ended:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
  }
}

/**
 * Handle capture error from offscreen.
 * Transitions to IDLE via CAPTURE_FAILED.
 */
export async function handleCaptureError(payload: OffscreenErrorPayload): Promise<void> {
  console.error('[SessionController] Capture error:', payload);

  // Transition to IDLE via CAPTURE_FAILED
  await transition({ type: 'CAPTURE_FAILED' }, payload.message);
}

/**
 * Handle download complete from offscreen.
 * Transitions to IDLE (success or failure).
 */
export async function handleDownloadComplete(payload: {
  sessionId: string;
  success: boolean;
  error?: string;
}): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[SessionController] Ignoring stale DOWNLOAD_COMPLETE message');
    return;
  }

  console.log('[SessionController] Download complete:', payload);

  if (payload.success) {
    console.log('[SessionController] Recording saved successfully');
    // Transition: UPLOADING -> IDLE (success)
    await transition({ type: 'UPLOAD_COMPLETE' }, 'Download completed successfully');
  } else {
    // Transition: UPLOADING -> IDLE (failure)
    await transition({ type: 'UPLOAD_FAILED' }, payload.error || 'Download failed');
  }
}

/**
 * Get current recording status.
 * @returns Current recording state and session info
 */
export async function getRecordingStatus(): Promise<{
  success: boolean;
  isRecording: boolean;
  sessionId: string | null;
  startTime: number | null;
  sessionState: string;
}> {
  try {
    const state = await getSessionState();
    return {
      success: true,
      isRecording: state.isRecording,
      sessionId: state.sessionId,
      startTime: state.startTime,
      sessionState: state.sessionState ?? 'IDLE',
    };
  } catch (error) {
    console.error('[SessionController] Get status error:', error);
    throw error;
  }
}

/**
 * Reset recording tab ID (called during cleanup).
 */
export function resetRecordingTabId(): void {
  recordingTabId = null;
}
