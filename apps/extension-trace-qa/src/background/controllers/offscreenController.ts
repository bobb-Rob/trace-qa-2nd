/**
 * Offscreen Controller
 *
 * Manages offscreen document lifecycle and commands.
 * Provides semantic methods for background to interact with offscreen plane
 * without dealing with raw message passing or document lifecycle.
 *
 * @module background/controllers/offscreenController
 */

import { hasOffscreenDocument } from '../fsm';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen/index.html';

/**
 * Create the offscreen document if it doesn't already exist.
 * Idempotent - safe to call multiple times.
 */
export async function createOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log('[OffscreenController] Offscreen document already exists');
    return;
  }

  console.log('[OffscreenController] Creating offscreen document');
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
    justification: 'Recording screen capture with microphone audio using MediaRecorder',
  });
}

/**
 * Close the offscreen document if it exists.
 * Idempotent - safe to call even if document doesn't exist.
 */
export async function closeOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log('[OffscreenController] Closing offscreen document');
    await chrome.offscreen.closeDocument();
  }
}

/**
 * Start capture in the offscreen document.
 * @param sessionId - The session ID for this recording
 * @param config - The recording configuration (codec, bitrate, etc.)
 */
export function startCapture(sessionId: string, config: {
  mimeType: string;
  videoBitsPerSecond: number;
  width: number;
  height: number;
  frameRate: number;
  audioEnabled?: boolean;
}): void {
  console.log('[OffscreenController] Starting capture:', { sessionId, audioEnabled: config.audioEnabled });
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_START_CAPTURE',
    payload: {
      sessionId,
      config: {
        mimeType: config.mimeType,
        videoBitsPerSecond: config.videoBitsPerSecond,
        width: config.width,
        height: config.height,
        frameRate: config.frameRate,
        audioEnabled: config.audioEnabled ?? false, // Default to false if not specified
      },
    },
  });
}

/**
 * Stop capture in the offscreen document.
 * @param sessionId - The session ID for verification
 */
export function stopCapture(sessionId: string): void {
  console.log('[OffscreenController] Stopping capture:', sessionId);
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_STOP_CAPTURE',
    payload: { sessionId },
  });
}

/**
 * Pause recording in the offscreen document.
 * @param sessionId - The session ID for verification
 */
export function pauseRecording(sessionId: string): void {
  console.log('[OffscreenController] Pausing recording:', sessionId);
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_PAUSE_RECORDING',
    payload: { sessionId },
  });
}

/**
 * Resume recording in the offscreen document.
 * @param sessionId - The session ID for verification
 */
export function resumeRecording(sessionId: string): void {
  console.log('[OffscreenController] Resuming recording:', sessionId);
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_RESUME_RECORDING',
    payload: { sessionId },
  });
}

/**
 * Request download of the recorded blob.
 * @param sessionId - The session ID for verification
 * @param blobKey - The key to retrieve the blob from storage
 */
export function downloadBlob(sessionId: string, blobKey: string): void {
  console.log('[OffscreenController] Requesting download:', sessionId);
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_DOWNLOAD_BLOB',
    payload: {
      sessionId,
      blobKey,
    },
  });
}
