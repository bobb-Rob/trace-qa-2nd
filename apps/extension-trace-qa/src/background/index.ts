/**
 * Background Service Worker
 * Responsibilities: Session orchestration, permissions, message routing, state persistence
 *
 * Uses a finite state machine (FSM) for deterministic, self-healing state management.
 */

import {
  RECORDER_CONFIG,
  type VideoRecordingConfig,
  type OffscreenCaptureCompletePayload,
  type OffscreenErrorPayload,
} from '../shared/types';

import {
  // FSM core
  transition,
  getState,
  getContext,
  updateContext,
  restoreFromStorage,
  setTerminalCallback,
  // Watchdog
  initWatchdog,
  validateStateOnWake,
  isMessageFresh,
  hasOffscreenDocument,
} from './fsm';

console.log('[TraceQA] Background service worker started');

// Offscreen document management
const OFFSCREEN_DOCUMENT_PATH = 'offscreen/index.html';

async function createOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log('[TraceQA] Offscreen document already exists');
    return;
  }

  console.log('[TraceQA] Creating offscreen document');
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Recording screen capture with MediaRecorder',
  });
}

async function closeOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log('[TraceQA] Closing offscreen document');
    await chrome.offscreen.closeDocument();
  }
}

/**
 * Centralized cleanup function - called by FSM on terminal transitions.
 * This ensures the state machine is always reset to IDLE after any session ends.
 */
async function finalizeSession(error?: string): Promise<void> {
  console.log('[TraceQA] Finalizing session', error ? `(error: ${error})` : '(success)');

  try {
    // Always close offscreen document first (best effort)
    await closeOffscreenDocument().catch((e) => {
      console.warn('[TraceQA] Failed to close offscreen document:', e);
    });
  } finally {
    // Reset context
    updateContext({ sessionId: null, recordingStartTime: null });

    // Persist cleanup state
    await chrome.storage.local.set({
      isRecording: false,
      sessionId: null,
      startTime: null,
      lastError: error ?? null,
    });
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[TraceQA] Received message:', message.type);

  switch (message.type) {
    case 'START_RECORDING':
      handleStartRecording(message.payload, sendResponse);
      return true;

    case 'STOP_RECORDING':
      handleStopRecording(message.payload, sendResponse);
      return true;

    case 'GET_RECORDING_STATUS':
      handleGetStatus(sendResponse);
      return true;

    // Messages from offscreen
    case 'OFFSCREEN_CAPTURE_STARTED':
      handleCaptureStarted(message.payload);
      return false;

    case 'OFFSCREEN_CAPTURE_COMPLETE':
      handleCaptureComplete(message.payload);
      return false;

    case 'OFFSCREEN_CAPTURE_ERROR':
      handleCaptureError(message.payload);
      return false;

    case 'OFFSCREEN_SIZE_WARNING':
      console.warn('[TraceQA] Size warning:', message.payload.currentSize);
      return false;

    case 'OFFSCREEN_DOWNLOAD_COMPLETE':
      handleDownloadComplete(message.payload);
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
  if (command === 'start-recording') {
    console.log('[TraceQA] Keyboard shortcut triggered');
  }
});

async function handleStartRecording(
  payload: { sessionId: string; tabId: number; videoConfig: VideoRecordingConfig },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    console.log('[TraceQA] Starting recording:', payload.sessionId);

    // Check current state via FSM
    if (getState() !== 'IDLE') {
      sendResponse({ success: false, error: 'Already recording or busy' });
      return;
    }

    // Update context with session info
    updateContext({ sessionId: payload.sessionId });

    // Transition: IDLE -> REQUESTING_PERMISSION
    await transition({ type: 'START_REQUESTED' }, 'User clicked start');

    // Persist session info to storage
    await chrome.storage.local.set({
      sessionId: payload.sessionId,
      isRecording: false,
    });

    // 1. Create offscreen document
    await createOffscreenDocument();

    // Transition: REQUESTING_PERMISSION -> STARTING
    await transition({ type: 'PERMISSION_GRANTED' }, 'Offscreen document created');

    // 2. Get recorder config based on quality setting
    const qualityConfig = RECORDER_CONFIG[payload.videoConfig.quality];

    // 3. Send message to offscreen to start capture
    // State stays STARTING until we receive OFFSCREEN_CAPTURE_STARTED
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_START_CAPTURE',
      payload: {
        sessionId: payload.sessionId,
        config: {
          mimeType: qualityConfig.mimeType,
          videoBitsPerSecond: qualityConfig.videoBitsPerSecond,
          width: qualityConfig.width,
          height: qualityConfig.height,
          frameRate: qualityConfig.frameRate,
        },
      },
    });

    // Response is immediate - actual RECORDING state comes via OFFSCREEN_CAPTURE_STARTED
    sendResponse({ success: true, sessionId: payload.sessionId });
  } catch (error) {
    console.error('[TraceQA] Start recording error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
    sendResponse({
      success: false,
      error: errorMessage,
    });
  }
}

async function handleStopRecording(
  payload: { sessionId: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    console.log('[TraceQA] Stopping recording:', payload.sessionId);

    const ctx = getContext();

    if (ctx.state !== 'RECORDING') {
      sendResponse({ success: false, error: 'Not recording' });
      return;
    }

    if (payload.sessionId !== ctx.sessionId) {
      sendResponse({ success: false, error: 'Session mismatch' });
      return;
    }

    // Transition: RECORDING -> STOPPING
    await transition({ type: 'STOP_REQUESTED' }, 'User clicked stop');

    // Persist state
    await chrome.storage.local.set({ isRecording: false });

    // Tell offscreen to stop and finalize
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_STOP_CAPTURE',
      payload: { sessionId: payload.sessionId },
    });

    // Response will come asynchronously via OFFSCREEN_CAPTURE_COMPLETE
    sendResponse({ success: true, message: 'Stop initiated' });
  } catch (error) {
    console.error('[TraceQA] Stop recording error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
    sendResponse({
      success: false,
      error: errorMessage,
    });
  }
}

/**
 * Handle capture started confirmation from offscreen.
 * This is where we actually transition to RECORDING state.
 */
async function handleCaptureStarted(payload: { sessionId: string }): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[TraceQA] Ignoring stale CAPTURE_STARTED message');
    return;
  }

  console.log('[TraceQA] Capture started confirmed:', payload.sessionId);

  // Transition: STARTING -> RECORDING
  await transition({ type: 'CAPTURE_STARTED' }, 'Offscreen confirmed capture started');

  // Update context with recording start time
  const startTime = Date.now();
  updateContext({ recordingStartTime: startTime });

  // Persist recording state
  await chrome.storage.local.set({
    isRecording: true,
    startTime,
  });
}

async function handleCaptureComplete(payload: OffscreenCaptureCompletePayload): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[TraceQA] Ignoring stale CAPTURE_COMPLETE message');
    return;
  }

  console.log('[TraceQA] Capture complete:', payload);

  try {
    // Transition: STOPPING -> UPLOADING
    await transition({ type: 'CAPTURE_STOPPED' }, 'MediaRecorder stopped successfully');

    // Tell offscreen to trigger the download (it has DOM access for URL.createObjectURL)
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_DOWNLOAD_BLOB',
      payload: {
        sessionId: payload.sessionId,
        blobKey: payload.blobKey,
      },
    });

    // State will be updated when download completes via OFFSCREEN_DOWNLOAD_COMPLETE
  } catch (error) {
    console.error('[TraceQA] Error handling capture complete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
  }
}

async function handleCaptureError(payload: OffscreenErrorPayload): Promise<void> {
  console.error('[TraceQA] Capture error:', payload);

  // Transition to IDLE via CAPTURE_FAILED
  await transition({ type: 'CAPTURE_FAILED' }, payload.message);
}

async function handleDownloadComplete(payload: { sessionId: string; success: boolean; error?: string }): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[TraceQA] Ignoring stale DOWNLOAD_COMPLETE message');
    return;
  }

  console.log('[TraceQA] Download complete:', payload);

  if (payload.success) {
    console.log('[TraceQA] Recording saved successfully');
    // Transition: UPLOADING -> IDLE (success)
    await transition({ type: 'UPLOAD_COMPLETE' }, 'Download completed successfully');
  } else {
    // Transition: UPLOADING -> IDLE (failure)
    await transition({ type: 'UPLOAD_FAILED' }, payload.error || 'Download failed');
  }
}

async function handleGetStatus(sendResponse: (response: unknown) => void): Promise<void> {
  try {
    const data = await chrome.storage.local.get([
      'isRecording',
      'sessionId',
      'startTime',
      'sessionState',
    ]);
    sendResponse({
      success: true,
      isRecording: data.isRecording ?? false,
      sessionId: data.sessionId ?? null,
      startTime: data.startTime ?? null,
      sessionState: data.sessionState ?? 'IDLE',
    });
  } catch (error) {
    console.error('[TraceQA] Get status error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Initialize FSM on service worker wake
(async () => {
  try {
    // Step 1: Restore FSM context from storage
    await restoreFromStorage();

    // Step 2: Set terminal callback (for cleanup on IDLE transitions)
    setTerminalCallback(finalizeSession);

    // Step 3: Initialize watchdog integration
    initWatchdog();

    // Step 4: Validate state (self-healing)
    await validateStateOnWake();

    console.log('[TraceQA] FSM initialized, state:', getState());
  } catch (error) {
    console.error('[TraceQA] FSM initialization failed:', error);
    // Force reset to IDLE as fallback
    await finalizeSession('FSM initialization failed');
  }
})();
