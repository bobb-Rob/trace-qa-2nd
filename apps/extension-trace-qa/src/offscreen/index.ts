/**
 * Offscreen Document - Media Capture Orchestration
 *
 * Thin orchestration layer that wires together modular components:
 * - Media modules (stream, recorder)
 * - Data modules (chunks, storage)
 * - Message routing
 *
 * This file delegates to specialized modules and coordinates message handling.
 */

import { SUPPORTED_MIME_TYPES } from '../shared/types';
import * as storageManager from './data/storageManager';
import * as captureController from './controllers/captureController';
import { registerHandler, initializeRouter } from './routing/messageRouter';

console.log('[Offscreen] Initializing offscreen document');

// Initialize storage on load
storageManager.initializeDatabase()
  .then(() => {
    console.log('[Offscreen] Storage initialized');
  })
  .catch((error) => {
    console.error('[Offscreen] Failed to initialize storage:', error);
  });

/**
 * Get supported MIME type, falling back to best available.
 */
function getSupportedMimeType(preferredMimeType: string): string {
  if (MediaRecorder.isTypeSupported(preferredMimeType)) {
    return preferredMimeType;
  }

  for (const mimeType of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      console.log(`[Offscreen] Using fallback MIME type: ${mimeType}`);
      return mimeType;
    }
  }

  throw new Error('No supported video MIME type found');
}

// ─────────────────────────────────────────────────────────────
// Message Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handle OFFSCREEN_START_CAPTURE
 */
registerHandler('OFFSCREEN_START_CAPTURE', (message, _sender, sendResponse) => {
  (async () => {
    try {
      const { sessionId, config } = message.payload;

      // Validate MIME type support
      const mimeType = getSupportedMimeType(config.mimeType);

      // Start capture with validated config
      await captureController.startCapture(sessionId, {
        mimeType,
        videoBitsPerSecond: config.videoBitsPerSecond,
        width: config.width,
        height: config.height,
        frameRate: config.frameRate,
        audioEnabled: config.audioEnabled ?? false, // Phase 7: Audio support
      });

      // Notify background of successful start
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_CAPTURE_STARTED',
        payload: { sessionId },
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error('[Offscreen] Start capture error:', error);

      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_CAPTURE_ERROR',
        payload: {
          sessionId: message.payload.sessionId,
          errorCode: 'ENCODER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return true;
});

/**
 * Handle OFFSCREEN_STOP_CAPTURE
 */
registerHandler('OFFSCREEN_STOP_CAPTURE', (_message, _sender, sendResponse) => {
  (async () => {
    try {
      await captureController.stopCapture();

      sendResponse({ success: true });
    } catch (error) {
      console.error('[Offscreen] Stop capture error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return true;
});

/**
 * Handle OFFSCREEN_PAUSE_RECORDING
 */
registerHandler('OFFSCREEN_PAUSE_RECORDING', (message, _sender, sendResponse) => {
  (async () => {
    try {
      const { sessionId } = message.payload;

      captureController.pauseCapture();

      // Notify background of successful pause
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_PAUSED',
        payload: { sessionId },
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error('[Offscreen] Pause recording error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return true;
});

/**
 * Handle OFFSCREEN_RESUME_RECORDING
 */
registerHandler('OFFSCREEN_RESUME_RECORDING', (message, _sender, sendResponse) => {
  (async () => {
    try {
      const { sessionId } = message.payload;

      captureController.resumeCapture();

      // Notify background of successful resume
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_RESUMED',
        payload: { sessionId },
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error('[Offscreen] Resume recording error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return true;
});

/**
 * Handle OFFSCREEN_DOWNLOAD_BLOB
 */
registerHandler('OFFSCREEN_DOWNLOAD_BLOB', (message, _sender, sendResponse) => {
  (async () => {
    try {
      const { sessionId } = message.payload;
      const filename = `traceqa-${sessionId}-${Date.now()}.webm`;

      await captureController.downloadBlob(sessionId, filename);

      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_DOWNLOAD_COMPLETE',
        payload: { sessionId, success: true },
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error('[Offscreen] Download blob error:', error);

      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_DOWNLOAD_COMPLETE',
        payload: {
          sessionId: message.payload.sessionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return true;
});

// ─────────────────────────────────────────────────────────────
// Audio Handlers (Phase 7)
// ─────────────────────────────────────────────────────────────

/**
 * Handle OFFSCREEN_ENABLE_AUDIO
 * Note: Audio is typically enabled during startCapture via config.audioEnabled
 * This handler exists for explicit runtime enable (if needed).
 */
registerHandler('OFFSCREEN_ENABLE_AUDIO', (_message, _sender, sendResponse) => {
  try {
    console.log('[Offscreen] Explicit audio enable requested (no-op - audio enabled during capture start)');
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Offscreen] Enable audio error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return false;
});

/**
 * Handle OFFSCREEN_DISABLE_AUDIO
 * Note: Audio is typically disabled during stopCapture cleanup.
 * This handler exists for explicit runtime disable (if needed).
 */
registerHandler('OFFSCREEN_DISABLE_AUDIO', (_message, _sender, sendResponse) => {
  try {
    console.log('[Offscreen] Explicit audio disable requested (no-op - audio cleaned up on capture stop)');
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Offscreen] Disable audio error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return false;
});

/**
 * Handle OFFSCREEN_SET_MUTED
 */
registerHandler('OFFSCREEN_SET_MUTED', (message, _sender, sendResponse) => {
  try {
    const { muted } = message.payload;

    if (muted) {
      captureController.muteAudio();
    } else {
      captureController.unmuteAudio();
    }

    console.log('[Offscreen] Audio mute state changed:', { muted });
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Offscreen] Set muted error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return false;
});

// ─────────────────────────────────────────────────────────────
// Capture Event Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Register capture completion callback
 */
captureController.onCaptureComplete((sessionId, blob) => {
  const blobKey = `recording-${sessionId}`;

  console.log('[Offscreen] Capture complete:', {
    sessionId,
    size: blob.size,
    blobKey,
  });

  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_CAPTURE_COMPLETE',
    payload: {
      sessionId,
      blobKey,
      size: blob.size,
      duration: 0, // Duration tracking removed (handled by FSM context)
    },
  });
});

/**
 * Register capture error callback
 */
captureController.onCaptureError((error) => {
  console.error('[Offscreen] Capture error:', error);

  const sessionId = captureController.getCurrentSessionId();
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_CAPTURE_ERROR',
    payload: {
      sessionId,
      errorCode: 'ENCODER_ERROR',
      message: error,
    },
  });
});

/**
 * Register stream ended callback (user clicked browser's "Stop sharing")
 */
captureController.onStreamEnded(() => {
  console.log('[Offscreen] Stream ended externally');

  const sessionId = captureController.getCurrentSessionId();

  // Attempt to finalize capture
  captureController.stopCapture().catch((error) => {
    console.error('[Offscreen] Failed to finalize after stream end:', error);
  });

  // Notify background via STREAM_ENDED message
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_STREAM_ENDED',
    payload: {
      sessionId,
      reason: 'User stopped sharing',
    },
  });
});

/**
 * Register audio unavailable callback
 */
captureController.onAudioUnavailable((reason, message) => {
  console.warn('[Offscreen] Audio unavailable:', { reason, message });

  const sessionId = captureController.getCurrentSessionId();
  
  // Notify background that audio is unavailable but video continues
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_AUDIO_UNAVAILABLE',
    payload: {
      sessionId,
      reason,
      message,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Initialize Router
// ─────────────────────────────────────────────────────────────

initializeRouter();

console.log('[Offscreen] Offscreen document ready');

