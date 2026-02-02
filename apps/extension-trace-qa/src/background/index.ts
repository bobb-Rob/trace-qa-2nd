/**
 * Background Service Worker
 * Responsibilities: Session orchestration, permissions, message routing, state persistence
 */

import {
  RECORDER_CONFIG,
  type VideoRecordingConfig,
  type SessionState,
  type OffscreenCaptureCompletePayload,
  type OffscreenErrorPayload,
} from '../shared/types';

console.log('[TraceQA] Background service worker started');

// State
let currentSessionId: string | null = null;
let currentSessionState: SessionState = 'IDLE';
let recordingStartTime: number | null = null;

// Offscreen document management
const OFFSCREEN_DOCUMENT_PATH = 'offscreen/index.html';

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return contexts.length > 0;
}

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

// State persistence
async function updateState(
  state: SessionState,
  extra: Partial<{
    isRecording: boolean;
    sessionId: string | null;
    startTime: number | null;
    lastError: string | null;
  }> = {}
): Promise<void> {
  currentSessionState = state;
  await chrome.storage.local.set({
    sessionState: state,
    ...extra,
  });
  console.log('[TraceQA] State updated:', state, extra);
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

    if (currentSessionState !== 'IDLE') {
      sendResponse({ success: false, error: 'Already recording or busy' });
      return;
    }

    currentSessionId = payload.sessionId;
    await updateState('REQUESTING_PERMISSION', {
      sessionId: payload.sessionId,
      isRecording: false,
    });

    // 1. Create offscreen document
    await createOffscreenDocument();

    // 2. Get recorder config based on quality setting
    const qualityConfig = RECORDER_CONFIG[payload.videoConfig.quality];

    await updateState('STARTING', { isRecording: false });

    // 3. Send message to offscreen to start capture
    // The offscreen document will call getDisplayMedia() since service workers can't access DOM APIs
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

    recordingStartTime = Date.now();
    await updateState('RECORDING', {
      isRecording: true,
      startTime: recordingStartTime,
    });

    sendResponse({ success: true, sessionId: payload.sessionId });
  } catch (error) {
    console.error('[TraceQA] Start recording error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await finalizeSession(errorMessage);
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

    if (currentSessionState !== 'RECORDING') {
      sendResponse({ success: false, error: 'Not recording' });
      return;
    }

    if (payload.sessionId !== currentSessionId) {
      sendResponse({ success: false, error: 'Session mismatch' });
      return;
    }

    await updateState('STOPPING', { isRecording: false });

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
    await finalizeSession(errorMessage);
    sendResponse({
      success: false,
      error: errorMessage,
    });
  }
}

function handleCaptureStarted(payload: { sessionId: string }): void {
  console.log('[TraceQA] Capture started confirmed:', payload.sessionId);
}

async function handleCaptureComplete(payload: OffscreenCaptureCompletePayload): Promise<void> {
  console.log('[TraceQA] Capture complete:', payload);

  try {
    await updateState('UPLOADING');

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
    await finalizeSession(errorMessage);
  }
}

async function handleCaptureError(payload: OffscreenErrorPayload): Promise<void> {
  console.error('[TraceQA] Capture error:', payload);
  await finalizeSession(payload.message);
}

async function handleDownloadComplete(payload: { sessionId: string; success: boolean; error?: string }): Promise<void> {
  console.log('[TraceQA] Download complete:', payload);

  if (payload.success) {
    console.log('[TraceQA] Recording saved successfully');
    await finalizeSession();
  } else {
    await finalizeSession(payload.error || 'Download failed');
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

/**
 * Centralized cleanup function - MUST be called at ALL terminal paths (success or failure).
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
    // Reset in-memory state
    currentSessionId = null;
    recordingStartTime = null;

    // Persist IDLE state - this MUST succeed for recovery
    await updateState('IDLE', {
      isRecording: false,
      sessionId: null,
      startTime: null,
      lastError: error ?? null,
    });
  }
}

// Restore state on service worker wake with self-healing
(async () => {
  const data = await chrome.storage.local.get(['sessionState', 'sessionId', 'isRecording', 'startTime']);
  const restoredState = data.sessionState ?? 'IDLE';
  const restoredSessionId = data.sessionId ?? null;

  console.log('[TraceQA] Restored state:', restoredState, restoredSessionId);

  // Self-healing: If state is non-IDLE, verify the recording is still valid
  if (restoredState !== 'IDLE') {
    const hasOffscreen = await hasOffscreenDocument();

    // If no offscreen document exists, the recording session is orphaned - reset to IDLE
    if (!hasOffscreen) {
      console.warn('[TraceQA] Self-healing: Found stale non-IDLE state without offscreen document, resetting to IDLE');
      await finalizeSession('Session recovered after service worker restart');
      return;
    }

    // Offscreen exists - restore in-memory state
    currentSessionState = restoredState;
    currentSessionId = restoredSessionId;
    recordingStartTime = data.startTime ?? null;
  } else {
    // State is IDLE - just restore it
    currentSessionState = 'IDLE';
    currentSessionId = null;
    recordingStartTime = null;
  }
})();
