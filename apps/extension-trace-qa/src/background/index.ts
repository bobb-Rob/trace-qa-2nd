/**
 * Background Service Worker
 * Responsibilities: Session orchestration, permissions, message routing, state persistence
 *
 * Uses a finite state machine (FSM) for deterministic, self-healing state management.
 */

import {
  // FSM core
  getState,
  getContext,
  updateContext,
  restoreFromStorage,
  setTerminalCallback,
  // Watchdog
  initWatchdog,
  validateStateOnWake,
} from './fsm';

import {
  registerHandler,
  initializeRouter,
} from './routing';

import {
  getRecordingTabId,
  getRecordingWindowId,
  getRecordingCaptureMode,
  resetRecordingTabId,
  startRecordingSession,
  stopRecordingSession,
  pauseRecordingSession,
  resumeRecordingSession,
  handleCaptureStarted,
  handleOffscreenPaused,
  handleOffscreenResumed,
  handleCaptureComplete,
  handleStreamEnded,
  handleCaptureError,
  handleDownloadComplete,
  getRecordingStatus,
  handleMicPermissionResult,
  getAudioState,
  setMuted,
} from './controllers';

import { closeOffscreenDocument } from './controllers/offscreenController';

// UI Managers
import {
  startStateBroadcast,
  stopStateBroadcast,
  setBroadcastCallback,
  type BroadcastState,
} from './ui/stateBroadcastManager';

import {
  showFloatingPaneForMode,
  updateAllFloatingPanes,
  hideAllFloatingPanes,
  initializeTabTracking,
} from './ui/floatingPaneController';

import {
  clearSessionState,
} from './persistence/persistenceManager';

console.log('[TraceQA] Background service worker started');

// ─────────────────────────────────────────────────────────────
// State Broadcast Callback
// ─────────────────────────────────────────────────────────────

/**
 * Handle state broadcast updates from stateBroadcastManager.
 * Forwards updates to popup and FloatingPane.
 */
function handleStateBroadcast(state: BroadcastState): void {
  // Broadcast to popup and other extension pages
  chrome.runtime.sendMessage({
    type: 'UI_STATE_UPDATE',
    payload: {
      sessionId: state.sessionId,
      sessionState: state.sessionState,
      isPaused: state.isPaused,
      duration: state.duration,
    },
  }).catch(() => {
    // Ignore errors if no listeners (popup might be closed)
  });

  // Update FloatingPane in all active tabs
  updateAllFloatingPanes({
    isPaused: state.isPaused,
    duration: state.duration,
    isMuted: state.isMuted,
  });
}

// Register broadcast callback with stateBroadcastManager
setBroadcastCallback(handleStateBroadcast);

// Initialize FloatingPane tab tracking
initializeTabTracking();

// ─────────────────────────────────────────────────────────────
// Session Ended Broadcasting
// ─────────────────────────────────────────────────────────────

/**
 * Broadcast session ended notification to all extension pages (popup, etc.)
 * This allows the UI to update immediately without polling.
 */
function broadcastSessionEnded(
  sessionId: string,
  reason: 'completed' | 'external_stop' | 'error',
  error?: string
): void {
  console.log('[TraceQA] Broadcasting UI_SESSION_ENDED:', { sessionId, reason, error });

  chrome.runtime.sendMessage({
    type: 'UI_SESSION_ENDED',
    payload: { sessionId, reason, error },
  }).catch(() => {
    // Ignore errors if no listeners (popup might be closed)
  });
}

/**
 * Centralized cleanup function - called by FSM on terminal transitions.
 * This ensures the state machine is always reset to IDLE after any session ends.
 */
async function finalizeSession(error?: string): Promise<void> {
  console.log('[TraceQA] Finalizing session', error ? `(error: ${error})` : '(success)');

  // Stop state broadcast immediately
  stopStateBroadcast();

  // Hide FloatingPane in all active tabs
  await hideAllFloatingPanes();
  resetRecordingTabId();

  try {
    // Always close offscreen document first (best effort)
    await closeOffscreenDocument().catch((e) => {
      console.warn('[TraceQA] Failed to close offscreen document:', e);
    });
  } finally {
    // Reset context (including pause timing)
    updateContext({
      sessionId: null,
      recordingStartTime: null,
      pauseStartTime: null,
      totalPausedTime: 0,
    });

    // Persist cleanup state
    await clearSessionState();
  }
}

/**
 * Register all message handlers with the router.
 * This centralizes handler registration for clarity and maintainability.
 */
function registerMessageHandlers(): void {
  // Recording control messages
  registerHandler('START_RECORDING', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    startRecordingSession(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  registerHandler('STOP_RECORDING', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    stopRecordingSession(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  registerHandler('GET_RECORDING_STATUS', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    getRecordingStatus()
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  // Messages from offscreen
  registerHandler('OFFSCREEN_CAPTURE_STARTED', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleCaptureStarted(message.payload).then(() => {
      // Start broadcasting state updates to UI
      startStateBroadcast();

      // Show FloatingPane based on capture mode
      const captureMode = getRecordingCaptureMode();
      const panePayload = {
        sessionId: message.payload.sessionId,
        isPaused: false,
        isMuted: getAudioState().muted,
        duration: 0,
        canPause: true,
      };
      showFloatingPaneForMode(
        captureMode,
        panePayload,
        getRecordingTabId(),
        getRecordingWindowId()
      );
    });
    return false;
  });

  registerHandler('OFFSCREEN_CAPTURE_COMPLETE', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleCaptureComplete(message.payload);
    return false;
  });

  registerHandler('OFFSCREEN_STREAM_ENDED', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleStreamEnded(message.payload);
    return false;
  });

  registerHandler('OFFSCREEN_CAPTURE_ERROR', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleCaptureError(message.payload).then(() => {
      // Notify popup that session ended with error
      broadcastSessionEnded(message.payload.sessionId, 'error', message.payload.message);
    });
    return false;
  });

  registerHandler('OFFSCREEN_SIZE_WARNING', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    console.warn('[TraceQA] Size warning:', message.payload.currentSize);
    return false;
  });

  registerHandler('OFFSCREEN_AUDIO_UNAVAILABLE', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    const { reason, message: errorMsg } = message.payload;
    
    console.warn('[TraceQA] Audio unavailable, continuing video-only:', { reason, errorMsg });
    
    // Show notification to user
    const notificationMessage = reason === 'permission_denied' 
      ? 'Microphone access denied. Recording video only.'
      : 'Audio unavailable. Recording video only.';
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'), // Fixed: removed hyphen
      title: 'TraceQA Recording',
      message: notificationMessage,
      priority: 1,
    });
    
    return false;
  });

  registerHandler('OFFSCREEN_DOWNLOAD_COMPLETE', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleDownloadComplete(message.payload).then(() => {
      // Notify popup based on success/failure
      if (message.payload.success) {
        broadcastSessionEnded(message.payload.sessionId, 'completed');
      } else {
        broadcastSessionEnded(message.payload.sessionId, 'error', message.payload.error);
      }
    });
    return false;
  });

  // Pause/resume messages from UI (popup, floating pane)
  registerHandler('UI_PAUSE_REQUESTED', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    pauseRecordingSession(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  registerHandler('UI_RESUME_REQUESTED', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    resumeRecordingSession(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  // Pause/resume acknowledgments from offscreen
  registerHandler('OFFSCREEN_PAUSED', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleOffscreenPaused(message.payload);
    return false;
  });

  registerHandler('OFFSCREEN_RESUMED', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleOffscreenResumed(message.payload);
    return false;
  });

  // Messages from content script (FloatingPane actions)
  registerHandler('FLOATING_PANE_PAUSE', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    pauseRecordingSession(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  registerHandler('FLOATING_PANE_RESUME', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    resumeRecordingSession(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  registerHandler('FLOATING_PANE_STOP', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    stopRecordingSession(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true;
  });

  registerHandler('FLOATING_PANE_TOGGLE_MUTE', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleToggleMute(message.payload, sendResponse);
    return true;
  });

  registerHandler('FLOATING_PANE_POSITION_CHANGED', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    // Position changes are handled by the content script itself (saves to storage)
    // No action needed in background
    sendResponse({ success: true });
    return false;
  });

  // Content script injection handshake
  // Note: Also handled by one-shot listener in ensureContentScriptInjected()
  registerHandler('CONTENT_SCRIPT_READY', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    // Acknowledge silently - the one-shot listener handles the actual handshake
    return false;
  });

  // Microphone permission result from permission popup window
  registerHandler('MIC_PERMISSION_RESULT', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleMicPermissionResult(message.payload);
    return false;
  });

  console.log('[TraceQA] All message handlers registered');
}

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
  if (command === 'start-recording') {
    console.log('[TraceQA] Keyboard shortcut triggered');
  }
});



/**
 * Handle mute toggle request from FloatingPane.
 * Toggles audioController state and forwards to offscreen document.
 */
async function handleToggleMute(
  payload: { sessionId: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  console.log('[TraceQA] Toggle mute requested:', payload.sessionId);

  const ctx = getContext();

  // Can only toggle mute during recording or paused states
  if (ctx.state !== 'RECORDING' && ctx.state !== 'PAUSED') {
    sendResponse({ success: false, error: 'Not recording (cannot toggle mute)' });
    return;
  }

  if (payload.sessionId !== ctx.sessionId) {
    sendResponse({ success: false, error: 'Session mismatch' });
    return;
  }

  const audioState = getAudioState();

  // Guard: audio must be enabled and available for this session
  if (!audioState.enabled) {
    sendResponse({ success: false, error: 'Audio not enabled for this session' });
    return;
  }

  const newMuted = !audioState.muted;

  // Update audioController state (persists preference)
  await setMuted(newMuted);

  // Forward to offscreen document to apply GainNode change
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_SET_MUTED',
    payload: { muted: newMuted },
  }).catch(() => {
    // Offscreen might not exist if recording just ended
  });

  console.log('[TraceQA] Mute toggled:', { muted: newMuted });
  sendResponse({ success: true, muted: newMuted });
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

    // Step 5: Initialize message router and register handlers
    initializeRouter();
    registerMessageHandlers();

    console.log('[TraceQA] FSM initialized, state:', getState());
  } catch (error) {
    console.error('[TraceQA] FSM initialization failed:', error);
    // Force reset to IDLE as fallback
    await finalizeSession('FSM initialization failed');
  }
})();
