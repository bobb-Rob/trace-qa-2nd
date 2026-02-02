/**
 * Offscreen Document - Media Engine
 * Responsibilities: MediaRecorder, blob management, chunk accumulation
 */

import { RECORDING_LIMITS, IDB_CONFIG, SUPPORTED_MIME_TYPES } from '../shared/types';

let mediaRecorder: MediaRecorder | null = null;
let currentSessionId: string | null = null;
let recordedChunks: Blob[] = [];
let currentSize = 0;
let recordingStartTime: number | null = null;

// Initialize IndexedDB
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
        db.createObjectStore(IDB_CONFIG.STORE_NAME);
      }
    };
  });
}

// Store blob in IndexedDB
async function storeBlob(key: string, blob: Blob): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
    const store = transaction.objectStore(IDB_CONFIG.STORE_NAME);
    const request = store.put(blob, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get supported MIME type
function getSupportedMimeType(preferredMimeType: string): string {
  if (MediaRecorder.isTypeSupported(preferredMimeType)) {
    return preferredMimeType;
  }

  for (const mimeType of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      console.log(`[TraceQA:Offscreen] Using fallback MIME type: ${mimeType}`);
      return mimeType;
    }
  }

  throw new Error('No supported video MIME type found');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[TraceQA:Offscreen] Received message:', message.type);

  switch (message.type) {
    case 'OFFSCREEN_START_CAPTURE':
      handleStartCapture(message.payload, sendResponse);
      return true;

    case 'OFFSCREEN_STOP_CAPTURE':
      handleStopCapture(message.payload, sendResponse);
      return true;

    case 'OFFSCREEN_DOWNLOAD_BLOB':
      handleDownloadBlob(message.payload, sendResponse);
      return true;

    default:
      return false;
  }
});

async function handleStartCapture(
  payload: {
    sessionId: string;
    config: {
      mimeType: string;
      videoBitsPerSecond: number;
      width: number;
      height: number;
      frameRate: number;
    };
  },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      sendResponse({ success: false, error: 'Already recording' });
      return;
    }

    currentSessionId = payload.sessionId;
    recordedChunks = [];
    currentSize = 0;
    recordingStartTime = Date.now();

    // Request screen capture from the offscreen document
    // Since we're in offscreen context, we can call getDisplayMedia
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: payload.config.width },
          height: { ideal: payload.config.height },
          frameRate: { ideal: payload.config.frameRate },
        },
        audio: false,
      });
    } catch (err) {
      console.error('[TraceQA:Offscreen] getDisplayMedia failed:', err);
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_CAPTURE_ERROR',
        payload: {
          sessionId: currentSessionId,
          errorCode: 'PERMISSION_DENIED',
          message: 'Failed to get display media',
        },
      });
      sendResponse({ success: false, error: 'Permission denied' });
      return;
    }

    // Get supported MIME type
    const mimeType = getSupportedMimeType(payload.config.mimeType);

    // Create MediaRecorder
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: payload.config.videoBitsPerSecond,
    });

    // Handle data available (chunk accumulation)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
        currentSize += event.data.size;

        console.log(`[TraceQA:Offscreen] Chunk received: ${event.data.size} bytes, total: ${currentSize} bytes`);

        // Check size limits
        const warningThreshold = RECORDING_LIMITS.MAX_FILE_SIZE_BYTES * RECORDING_LIMITS.SIZE_WARNING_THRESHOLD;
        if (currentSize >= warningThreshold && currentSize < RECORDING_LIMITS.MAX_FILE_SIZE_BYTES) {
          chrome.runtime.sendMessage({
            type: 'OFFSCREEN_SIZE_WARNING',
            payload: { sessionId: currentSessionId, currentSize },
          });
        }

        // Auto-stop if exceeding max size
        if (currentSize >= RECORDING_LIMITS.MAX_FILE_SIZE_BYTES) {
          console.warn('[TraceQA:Offscreen] Max size reached, auto-stopping');
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        }
      }
    };

    // Handle recording stop
    mediaRecorder.onstop = async () => {
      console.log('[TraceQA:Offscreen] MediaRecorder stopped');

      try {
        // Finalize blob
        const blob = new Blob(recordedChunks, { type: mimeType });
        const blobKey = `recording-${currentSessionId}`;
        const duration = recordingStartTime ? Date.now() - recordingStartTime : 0;

        // Store in IndexedDB
        await storeBlob(blobKey, blob);

        console.log(`[TraceQA:Offscreen] Blob stored: ${blob.size} bytes, key: ${blobKey}`);

        // Notify background
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_CAPTURE_COMPLETE',
          payload: {
            sessionId: currentSessionId,
            blobKey,
            size: blob.size,
            duration,
          },
        });

        // Cleanup
        recordedChunks = [];
        currentSize = 0;
        recordingStartTime = null;
      } catch (error) {
        console.error('[TraceQA:Offscreen] Error finalizing recording:', error);
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_CAPTURE_ERROR',
          payload: {
            sessionId: currentSessionId,
            errorCode: 'ENCODER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    };

    // Handle errors
    mediaRecorder.onerror = (event) => {
      console.error('[TraceQA:Offscreen] MediaRecorder error:', event);
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_CAPTURE_ERROR',
        payload: {
          sessionId: currentSessionId,
          errorCode: 'ENCODER_ERROR',
          message: 'MediaRecorder error',
        },
      });
    };

    // Handle stream ending (user stopped sharing)
    stream.getVideoTracks()[0].onended = () => {
      console.log('[TraceQA:Offscreen] Stream ended by user');
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };

    // Start recording with timeslice for chunking
    mediaRecorder.start(RECORDING_LIMITS.CHUNK_INTERVAL_MS);
    console.log('[TraceQA:Offscreen] MediaRecorder started');

    // Notify background
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_CAPTURE_STARTED',
      payload: { sessionId: currentSessionId },
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('[TraceQA:Offscreen] Start capture error:', error);
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_CAPTURE_ERROR',
      payload: {
        sessionId: currentSessionId,
        errorCode: 'ENCODER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleStopCapture(
  payload: { sessionId: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    if (!mediaRecorder || payload.sessionId !== currentSessionId) {
      sendResponse({ success: false, error: 'No matching recording' });
      return;
    }

    if (mediaRecorder.state !== 'inactive') {
      // Stop the media recorder - this will trigger onstop
      mediaRecorder.stop();

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('[TraceQA:Offscreen] Stop capture error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDownloadBlob(
  payload: { sessionId: string; blobKey: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    console.log('[TraceQA:Offscreen] Downloading blob:', payload.blobKey);

    // Open IndexedDB and retrieve the blob
    const db = await initDB();
    const transaction = db.transaction(IDB_CONFIG.STORE_NAME, 'readonly');
    const store = transaction.objectStore(IDB_CONFIG.STORE_NAME);

    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = store.get(payload.blobKey);
      request.onerror = () => reject(new Error('Failed to retrieve blob'));
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as Blob);
        } else {
          reject(new Error('Blob not found'));
        }
      };
    });

    // Create a download URL (offscreen has DOM access)
    const url = URL.createObjectURL(blob);
    const filename = `traceqa-${payload.sessionId}-${Date.now()}.webm`;

    // Use anchor element to trigger download (chrome.downloads not available in offscreen)
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    console.log('[TraceQA:Offscreen] Download triggered:', filename);

    // Clean up blob from IndexedDB
    const deleteTransaction = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
    deleteTransaction.objectStore(IDB_CONFIG.STORE_NAME).delete(payload.blobKey);

    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_DOWNLOAD_COMPLETE',
      payload: {
        sessionId: payload.sessionId,
        success: true,
      },
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('[TraceQA:Offscreen] Download blob error:', error);
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_DOWNLOAD_COMPLETE',
      payload: {
        sessionId: payload.sessionId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

console.log('[TraceQA:Offscreen] Offscreen document loaded');
