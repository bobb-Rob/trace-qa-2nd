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
  type OffscreenStreamEndedPayload,
  type OffscreenErrorPayload,
  type ContentShowFloatingPanePayload,
  type UpdateFloatingPanePayload,
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

import {
  registerHandler,
  initializeRouter,
} from './routing';

console.log('[TraceQA] Background service worker started');

// State broadcast configuration
const STATE_BROADCAST_INTERVAL_MS = 500;
let stateBroadcastTimer: ReturnType<typeof setInterval> | null = null;

// Track the tab ID for content script communication (TAB recording mode)
let recordingTabId: number | null = null;

/**
 * Calculate the effective recording duration (excluding paused time).
 */
function calculateEffectiveDuration(): number {
  const ctx = getContext();

  if (ctx.recordingStartTime === null) {
    return 0;
  }

  const now = Date.now();
  const totalElapsed = now - ctx.recordingStartTime;

  // Subtract total paused time
  let pausedTime = ctx.totalPausedTime;

  // If currently paused, add the current pause duration
  if (ctx.pauseStartTime !== null) {
    pausedTime += now - ctx.pauseStartTime;
  }

  return Math.max(0, totalElapsed - pausedTime);
}

/**
 * Broadcast current state to all UI components (popup, floating pane).
 * Sent periodically during active recording.
 */
function broadcastStateUpdate(): void {
  const ctx = getContext();

  // Only broadcast during active recording states
  if (ctx.state !== 'RECORDING' && ctx.state !== 'PAUSED') {
    return;
  }

  if (!ctx.sessionId) {
    return;
  }

  const duration = calculateEffectiveDuration();
  const isPaused = ctx.state === 'PAUSED';

  // Broadcast to popup and other extension pages
  chrome.runtime.sendMessage({
    type: 'UI_STATE_UPDATE',
    payload: {
      sessionId: ctx.sessionId,
      sessionState: ctx.state,
      isPaused,
      duration,
    },
  }).catch(() => {
    // Ignore errors if no listeners (popup might be closed)
  });

  // Update FloatingPane in content script (TAB mode only)
  if (recordingTabId !== null) {
    updateFloatingPane(recordingTabId, {
      isPaused,
      duration,
    });
  }
}

/**
 * Start broadcasting state updates at regular intervals.
 */
function startStateBroadcast(): void {
  if (stateBroadcastTimer !== null) {
    return; // Already running
  }

  console.log('[TraceQA] Starting state broadcast');
  stateBroadcastTimer = setInterval(broadcastStateUpdate, STATE_BROADCAST_INTERVAL_MS);

  // Send an immediate update
  broadcastStateUpdate();
}

/**
 * Stop broadcasting state updates.
 */
function stopStateBroadcast(): void {
  if (stateBroadcastTimer !== null) {
    console.log('[TraceQA] Stopping state broadcast');
    clearInterval(stateBroadcastTimer);
    stateBroadcastTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────
// Content Script Injection (Handshake-based, deterministic)
// ─────────────────────────────────────────────────────────────

// Timeout for waiting for CONTENT_SCRIPT_READY after injection
const INJECTION_READY_TIMEOUT_MS = 5000;

// Track tabs with confirmed content script presence (reset on extension reload)
const confirmedTabs = new Set<number>();

/**
 * Ensure content script is injected and ready in the target tab.
 * Uses a deterministic handshake:
 * 1. PING to check if already loaded (fast path)
 * 2. If not, inject via chrome.scripting.executeScript()
 * 3. Wait for CONTENT_SCRIPT_READY signal (no arbitrary delays)
 *
 * @returns true if content script is confirmed ready, false if injection failed
 */
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  // Fast path: already confirmed in this session
  if (confirmedTabs.has(tabId)) {
    return true;
  }

  // Try PING first (content script may already be loaded)
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (response?.type === 'PONG') {
      console.log('[TraceQA:Injection] Content script already present in tab:', tabId);
      confirmedTabs.add(tabId);
      return true;
    }
  } catch {
    // PING failed - content script not loaded, proceed to injection
    console.log('[TraceQA:Injection] PING failed, injecting content script into tab:', tabId);
  }

  // Inject content script and wait for READY signal
  return new Promise<boolean>((resolve) => {
    let resolved = false;

    // One-shot listener for CONTENT_SCRIPT_READY
    const readyListener = (
      message: { type: string },
      sender: chrome.runtime.MessageSender
    ) => {
      if (
        message.type === 'CONTENT_SCRIPT_READY' &&
        sender.tab?.id === tabId &&
        !resolved
      ) {
        resolved = true;
        chrome.runtime.onMessage.removeListener(readyListener);
        clearTimeout(timeoutId);
        console.log('[TraceQA:Injection] Content script ready in tab:', tabId);
        confirmedTabs.add(tabId);
        resolve(true);
      }
    };

    // Timeout handler
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.runtime.onMessage.removeListener(readyListener);
        console.warn('[TraceQA:Injection] Timeout waiting for CONTENT_SCRIPT_READY in tab:', tabId);
        resolve(false);
      }
    }, INJECTION_READY_TIMEOUT_MS);

    // Register listener before injection
    chrome.runtime.onMessage.addListener(readyListener);

    // Inject the content script
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js'],
    }).catch((error) => {
      if (!resolved) {
        resolved = true;
        chrome.runtime.onMessage.removeListener(readyListener);
        clearTimeout(timeoutId);
        console.error('[TraceQA:Injection] Failed to inject content script:', error);
        resolve(false);
      }
    });
  });
}

/**
 * Remove tab from confirmed set when tab is closed or navigated.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  confirmedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Clear confirmation on navigation (content script may be unloaded)
  if (changeInfo.status === 'loading') {
    confirmedTabs.delete(tabId);
  }
});

// ─────────────────────────────────────────────────────────────
// FloatingPane Control (Content Script Communication)
// ─────────────────────────────────────────────────────────────

/**
 * Show the FloatingPane in the content script for TAB recording mode.
 * Ensures content script is injected before sending message.
 */
async function showFloatingPane(tabId: number, payload: ContentShowFloatingPanePayload): Promise<void> {
  // Ensure content script is present
  const ready = await ensureContentScriptInjected(tabId);
  if (!ready) {
    console.warn('[TraceQA] Cannot show FloatingPane - content script injection failed');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CONTENT_SHOW_FLOATING_PANE',
      payload,
    });
    console.log('[TraceQA] FloatingPane shown in tab:', tabId);
  } catch (error) {
    console.warn('[TraceQA] Failed to show FloatingPane:', error);
  }
}

/**
 * Update the FloatingPane state in the content script.
 */
async function updateFloatingPane(tabId: number, payload: UpdateFloatingPanePayload): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CONTENT_UPDATE_FLOATING_PANE',
      payload,
    });
  } catch {
    // Ignore errors - tab might be closed or content script not loaded
  }
}

/**
 * Hide the FloatingPane in the content script.
 */
async function hideFloatingPane(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CONTENT_HIDE_FLOATING_PANE',
    });
    console.log('[TraceQA] FloatingPane hidden in tab:', tabId);
  } catch {
    // Ignore errors - tab might be closed or content script not loaded
  }
}

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

  // Hide FloatingPane if showing (TAB mode)
  if (recordingTabId !== null) {
    await hideFloatingPane(recordingTabId);
    recordingTabId = null;
  }

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
    await chrome.storage.local.set({
      isRecording: false,
      sessionId: null,
      startTime: null,
      lastError: error ?? null,
      fsmPauseStartTime: null,
      fsmTotalPausedTime: 0,
    });
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
    handleStartRecording(message.payload, sendResponse);
    return true;
  });

  registerHandler('STOP_RECORDING', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleStopRecording(message.payload, sendResponse);
    return true;
  });

  registerHandler('GET_RECORDING_STATUS', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleGetStatus(sendResponse);
    return true;
  });

  // Messages from offscreen
  registerHandler('OFFSCREEN_CAPTURE_STARTED', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleCaptureStarted(message.payload);
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
    handleCaptureError(message.payload);
    return false;
  });

  registerHandler('OFFSCREEN_SIZE_WARNING', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    console.warn('[TraceQA] Size warning:', message.payload.currentSize);
    return false;
  });

  registerHandler('OFFSCREEN_DOWNLOAD_COMPLETE', (message, _sender, _sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleDownloadComplete(message.payload);
    return false;
  });

  // Pause/resume messages from UI (popup, floating pane)
  registerHandler('UI_PAUSE_REQUESTED', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handlePauseRequested(message.payload, sendResponse);
    return true;
  });

  registerHandler('UI_RESUME_REQUESTED', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleResumeRequested(message.payload, sendResponse);
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
    handlePauseRequested(message.payload, sendResponse);
    return true;
  });

  registerHandler('FLOATING_PANE_RESUME', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleResumeRequested(message.payload, sendResponse);
    return true;
  });

  registerHandler('FLOATING_PANE_STOP', (message, _sender, sendResponse) => {
    console.log('[TraceQA] Received message:', message.type);
    handleStopRecording(message.payload, sendResponse);
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

  console.log('[TraceQA] All message handlers registered');
}

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

    // Can stop from RECORDING or PAUSED state
    if (ctx.state !== 'RECORDING' && ctx.state !== 'PAUSED') {
      sendResponse({ success: false, error: 'Not recording' });
      return;
    }

    if (payload.sessionId !== ctx.sessionId) {
      sendResponse({ success: false, error: 'Session mismatch' });
      return;
    }

    // Transition: RECORDING/PAUSED -> STOPPING
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
 * Handle pause request from UI.
 * Validates state and forwards to offscreen for MediaRecorder.pause()
 */
async function handlePauseRequested(
  payload: { sessionId: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    console.log('[TraceQA] Pause requested:', payload.sessionId);

    const ctx = getContext();

    // Can only pause from RECORDING state
    if (ctx.state !== 'RECORDING') {
      sendResponse({ success: false, error: 'Not recording (cannot pause)' });
      return;
    }

    if (payload.sessionId !== ctx.sessionId) {
      sendResponse({ success: false, error: 'Session mismatch' });
      return;
    }

    // Tell offscreen to pause the MediaRecorder
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_PAUSE_RECORDING',
      payload: { sessionId: payload.sessionId },
    });

    // Response is immediate - actual PAUSED state comes via OFFSCREEN_PAUSED
    sendResponse({ success: true, message: 'Pause initiated' });
  } catch (error) {
    console.error('[TraceQA] Pause error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle resume request from UI.
 * Validates state and forwards to offscreen for MediaRecorder.resume()
 */
async function handleResumeRequested(
  payload: { sessionId: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    console.log('[TraceQA] Resume requested:', payload.sessionId);

    const ctx = getContext();

    // Can only resume from PAUSED state
    if (ctx.state !== 'PAUSED') {
      sendResponse({ success: false, error: 'Not paused (cannot resume)' });
      return;
    }

    if (payload.sessionId !== ctx.sessionId) {
      sendResponse({ success: false, error: 'Session mismatch' });
      return;
    }

    // Tell offscreen to resume the MediaRecorder
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_RESUME_RECORDING',
      payload: { sessionId: payload.sessionId },
    });

    // Response is immediate - actual RECORDING state comes via OFFSCREEN_RESUMED
    sendResponse({ success: true, message: 'Resume initiated' });
  } catch (error) {
    console.error('[TraceQA] Resume error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle pause confirmation from offscreen.
 * Transition FSM to PAUSED and track pause timing.
 */
async function handleOffscreenPaused(payload: { sessionId: string }): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[TraceQA] Ignoring stale OFFSCREEN_PAUSED message');
    return;
  }

  console.log('[TraceQA] Pause confirmed:', payload.sessionId);

  // Transition: RECORDING -> PAUSED
  await transition({ type: 'PAUSE_REQUESTED' }, 'MediaRecorder paused');

  // Track when pause started for duration calculation
  const pauseStartTime = Date.now();
  updateContext({ pauseStartTime });

  // Persist pause timing to storage
  await chrome.storage.local.set({ fsmPauseStartTime: pauseStartTime });
}

/**
 * Handle mute toggle request from FloatingPane.
 * TODO: Implement actual mute functionality via offscreen document.
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

  // TODO: Send message to offscreen to toggle audio track
  // For now, just acknowledge the request
  console.warn('[TraceQA] Mute toggle not yet implemented');
  sendResponse({ success: true, message: 'Mute toggle acknowledged (not implemented)' });
}

/**
 * Handle resume confirmation from offscreen.
 * Transition FSM back to RECORDING and accumulate paused time.
 */
async function handleOffscreenResumed(payload: { sessionId: string }): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[TraceQA] Ignoring stale OFFSCREEN_RESUMED message');
    return;
  }

  console.log('[TraceQA] Resume confirmed:', payload.sessionId);

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
    await chrome.storage.local.set({
      fsmPauseStartTime: null,
      fsmTotalPausedTime: newTotalPausedTime,
    });
  }

  // Transition: PAUSED -> RECORDING
  await transition({ type: 'RESUME_REQUESTED' }, 'MediaRecorder resumed');
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

  // Start broadcasting state updates to UI
  startStateBroadcast();

  // Show FloatingPane for TAB recording mode
  if (recordingTabId !== null) {
    await showFloatingPane(recordingTabId, {
      sessionId: payload.sessionId,
      isPaused: false,
      isMuted: false, // TODO: Track actual mute state
      duration: 0,
      canPause: true, // Pause is now implemented
    });
  }
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

/**
 * Handle external stream termination (user clicked "Stop sharing" in browser UI).
 * This is semantically different from a user-initiated stop via the extension UI.
 */
async function handleStreamEnded(payload: OffscreenStreamEndedPayload): Promise<void> {
  // Validate message freshness
  if (!isMessageFresh(payload.sessionId)) {
    console.warn('[TraceQA] Ignoring stale STREAM_ENDED message');
    return;
  }

  console.log('[TraceQA] Stream ended externally (Stop sharing):', payload);

  try {
    // Transition: RECORDING -> UPLOADING (via STREAM_ENDED event)
    // This preserves FSM semantics: external stop is different from requested stop
    await transition({ type: 'STREAM_ENDED' }, 'User clicked Stop sharing in browser UI');

    // Persist state
    await chrome.storage.local.set({ isRecording: false });

    // Tell offscreen to trigger the download (video data is still valid)
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_DOWNLOAD_BLOB',
      payload: {
        sessionId: payload.sessionId,
        blobKey: payload.blobKey,
      },
    });

    // State will be updated when download completes via OFFSCREEN_DOWNLOAD_COMPLETE
  } catch (error) {
    console.error('[TraceQA] Error handling stream ended:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await transition({ type: 'CAPTURE_FAILED' }, errorMessage);
  }
}

async function handleCaptureError(payload: OffscreenErrorPayload): Promise<void> {
  console.error('[TraceQA] Capture error:', payload);

  // Transition to IDLE via CAPTURE_FAILED
  await transition({ type: 'CAPTURE_FAILED' }, payload.message);

  // Notify popup that session ended with error
  broadcastSessionEnded(payload.sessionId, 'error', payload.message);
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

    // Notify popup that session ended successfully
    broadcastSessionEnded(payload.sessionId, 'completed');
  } else {
    // Transition: UPLOADING -> IDLE (failure)
    await transition({ type: 'UPLOAD_FAILED' }, payload.error || 'Download failed');

    // Notify popup that session ended with error
    broadcastSessionEnded(payload.sessionId, 'error', payload.error);
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
