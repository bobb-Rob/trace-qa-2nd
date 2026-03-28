/**
 * Content Script - FloatingPane Controller
 *
 * This script runs in the context of web pages during TAB recording.
 * It handles communication with the background service worker and
 * manages the FloatingPane lifecycle.
 *
 * Responsibilities:
 * - Listen for messages from background to show/update/hide FloatingPane
 * - Forward user intents from FloatingPane to background
 * - Maintain session context for message routing
 */

import { createFloatingPaneRenderer } from '../components/createFloatingPaneRenderer';
import { activateCapture, deactivateCapture } from './lifecycle/sessionManager';
import type {
  BackgroundToContentMessage,
  ContentToBackgroundMessage,
  ContentShowFloatingPanePayload,
  UpdateFloatingPanePayload,
} from '../shared/types';

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

let currentSessionId: string | null = null;
let floatingPaneRenderer: ReturnType<typeof createFloatingPaneRenderer> | null = null;

// ─────────────────────────────────────────────────────────────
// FloatingPane Actions → Background Messages
// ─────────────────────────────────────────────────────────────

function sendToBackground(message: ContentToBackgroundMessage): void {
  chrome.runtime.sendMessage(message).catch((error) => {
    console.warn('[ContentScript] Failed to send message to background:', error);
  });
}

function handleAction(action: 'pause' | 'resume' | 'stop' | 'toggleMute'): void {
  if (!currentSessionId) {
    console.warn('[ContentScript] No session ID for action:', action);
    return;
  }

  const payload = { sessionId: currentSessionId };

  switch (action) {
    case 'pause':
      sendToBackground({ type: 'FLOATING_PANE_PAUSE', payload });
      break;
    case 'resume':
      sendToBackground({ type: 'FLOATING_PANE_RESUME', payload });
      break;
    case 'stop':
      sendToBackground({ type: 'FLOATING_PANE_STOP', payload });
      break;
    case 'toggleMute':
      sendToBackground({ type: 'FLOATING_PANE_TOGGLE_MUTE', payload });
      break;
  }
}

function handlePositionChange(position: { x: number; y: number }): void {
  sendToBackground({ type: 'FLOATING_PANE_POSITION_CHANGED', payload: position });
}

// ─────────────────────────────────────────────────────────────
// FloatingPane Lifecycle
// ─────────────────────────────────────────────────────────────

function ensureRenderer(): ReturnType<typeof createFloatingPaneRenderer> {
  if (!floatingPaneRenderer) {
    floatingPaneRenderer = createFloatingPaneRenderer({
      onAction: handleAction,
      onPositionChange: handlePositionChange,
    });
  }
  return floatingPaneRenderer;
}

function showFloatingPane(payload: ContentShowFloatingPanePayload): void {
  currentSessionId = payload.sessionId;
  const renderer = ensureRenderer();
  renderer.show(payload);
  console.log('[ContentScript] FloatingPane shown for session:', payload.sessionId);
}

function updateFloatingPane(payload: UpdateFloatingPanePayload): void {
  if (!floatingPaneRenderer) {
    console.warn('[ContentScript] Cannot update - FloatingPane not shown');
    return;
  }
  floatingPaneRenderer.update(payload);
}

function hideFloatingPane(): void {
  if (floatingPaneRenderer) {
    floatingPaneRenderer.hide();
    console.log('[ContentScript] FloatingPane hidden');
  }
  currentSessionId = null;
}

// ─────────────────────────────────────────────────────────────
// Message Handling
// ─────────────────────────────────────────────────────────────

function handleMessage(
  message: BackgroundToContentMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  // Only log non-PING messages to reduce noise
  if (message.type !== 'PING') {
    console.log('[ContentScript] Received message:', message.type);
  }

  switch (message.type) {
    // Injection handshake: respond to PING with PONG
    case 'PING':
      sendResponse({ type: 'PONG' });
      return false; // Synchronous response

    case 'CONTENT_SHOW_FLOATING_PANE': {
      showFloatingPane(message.payload);
      sendResponse({ success: true });
      break;
    }

    case 'CONTENT_UPDATE_FLOATING_PANE':
      updateFloatingPane(message.payload);
      sendResponse({ success: true });
      break;

    case 'CONTENT_HIDE_FLOATING_PANE':
      hideFloatingPane();
      sendResponse({ success: true });
      break;

    case 'SESSION_STARTED':
      activateCapture({
        sessionId: message.payload.sessionId,
        sessionStartTime: message.payload.startTime,
        config: message.payload.telemetryConfig,
      });
      sendResponse({ success: true });
      break;

    case 'SESSION_ENDED':
      deactivateCapture();
      sendResponse({ success: true });
      break;

    default:
      // Unknown message type - ignore
      return false;
  }

  return true; // Indicates async response
}

// ─────────────────────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(handleMessage);

// Signal to background that content script is ready
// This is used by ensureContentScriptInjected() handshake
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {
  // Ignore errors - background may not be listening if script was auto-loaded
});

console.log('[ContentScript] TraceQA content script loaded');
