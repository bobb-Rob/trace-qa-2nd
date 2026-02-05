/**
 * Event Message Types
 *
 * Events report outcomes from the executor. They:
 * - Are sent by the component that performed an action
 * - Are fire-and-forget (no response expected)
 * - Report what happened, not what should happen
 *
 * @module contracts/events
 */

// ============================================
// OFFSCREEN EVENTS (Offscreen → Background)
// ============================================

/**
 * Capture successfully started.
 * Sent after MediaRecorder.start() succeeds.
 */
export interface OffscreenStartedEvent {
  type: 'OFFSCREEN_CAPTURE_STARTED';
  payload: {
    sessionId: string;
    hasAudio?: boolean;
    mimeType?: string;
  };
}

/**
 * Recording paused.
 * Sent after MediaRecorder.pause() succeeds.
 */
export interface OffscreenPausedEvent {
  type: 'OFFSCREEN_PAUSED';
  payload: {
    sessionId: string;
  };
}

/**
 * Recording resumed.
 * Sent after MediaRecorder.resume() succeeds.
 */
export interface OffscreenResumedEvent {
  type: 'OFFSCREEN_RESUMED';
  payload: {
    sessionId: string;
  };
}

/**
 * Recording stopped (by command).
 * Sent after MediaRecorder.stop() completes and data is ready.
 */
export interface OffscreenStoppedEvent {
  type: 'OFFSCREEN_CAPTURE_COMPLETE';
  payload: {
    sessionId: string;
    blobKey: string;
    size: number;
    duration: number;
    chunkCount?: number;
  };
}

/**
 * Recording stopped externally (tab closed, user stopped sharing).
 * Sent when the stream ends unexpectedly.
 */
export interface OffscreenStreamEndedEvent {
  type: 'OFFSCREEN_STREAM_ENDED';
  payload: {
    sessionId: string;
    blobKey: string;
    size: number;
    duration: number;
    reason?: 'track_ended' | 'tab_closed' | 'permission_revoked';
  };
}

/**
 * An error occurred in the offscreen document.
 */
export interface OffscreenErrorEvent {
  type: 'OFFSCREEN_CAPTURE_ERROR';
  payload: {
    sessionId: string;
    errorCode: string;
    message: string;
    recoverable?: boolean;
  };
}

/**
 * A chunk was written to IndexedDB.
 * Sent periodically during recording for progress tracking.
 */
export interface OffscreenChunkStoredEvent {
  type: 'OFFSCREEN_CHUNK_STORED';
  payload: {
    sessionId: string;
    index: number;
    size: number;
    totalSize: number;
  };
}

/**
 * Audio level update (for UI visualization).
 * Sent periodically when audio is being captured.
 */
export interface OffscreenAudioLevelEvent {
  type: 'OFFSCREEN_AUDIO_LEVEL';
  payload: {
    level: number; // 0-100
  };
}

/**
 * Audio unavailable notification.
 * Sent when audio capture fails but video continues.
 */
export interface OffscreenAudioUnavailableEvent {
  type: 'OFFSCREEN_AUDIO_UNAVAILABLE';
  payload: {
    sessionId: string;
    reason: 'permission_denied' | 'no_device' | 'initialization_failed' | 'unknown';
    message: string;
  };
}

/**
 * Size warning threshold reached.
 * Sent when recording size approaches limit.
 */
export interface OffscreenSizeWarningEvent {
  type: 'OFFSCREEN_SIZE_WARNING';
  payload: {
    sessionId: string;
    currentSize: number;
  };
}

// ============================================
// CONTENT EVENTS (Content → Background)
// ============================================

/**
 * Content script is ready and loaded.
 */
export interface ContentScriptReadyEvent {
  type: 'CONTENT_SCRIPT_READY';
}

/**
 * Response to PING command.
 */
export interface ContentPongEvent {
  type: 'PONG';
}

/**
 * FloatingPane position changed by user dragging.
 */
export interface FloatingPanePositionChangedEvent {
  type: 'FLOATING_PANE_POSITION_CHANGED';
  payload: {
    x: number;
    y: number;
  };
}

/**
 * Batch of telemetry events from content script.
 * Future: Phase 6-7 Telemetry Implementation
 */
export interface ContentTelemetryBatchEvent {
  type: 'CONTENT_TELEMETRY_BATCH';
  payload: {
    sessionId: string;
    batchId: string;
    events: TelemetryEvent[];
    metadata: {
      capturedAt: number;
      eventCount: number;
      byteSize: number;
      url: string;
      isPartial: boolean;
    };
  };
}

/**
 * Individual telemetry event structure.
 * Future: Will be expanded in Phase 6-7
 */
export interface TelemetryEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

// ============================================
// EVENT TYPE UNIONS
// ============================================

/**
 * All events from Offscreen to Background.
 */
export type OffscreenEvent =
  | OffscreenStartedEvent
  | OffscreenPausedEvent
  | OffscreenResumedEvent
  | OffscreenStoppedEvent
  | OffscreenStreamEndedEvent
  | OffscreenErrorEvent
  | OffscreenChunkStoredEvent
  | OffscreenAudioLevelEvent
  | OffscreenSizeWarningEvent;

/**
 * All events from Content to Background.
 */
export type ContentEvent =
  | ContentScriptReadyEvent
  | ContentPongEvent
  | FloatingPanePositionChangedEvent
  | ContentTelemetryBatchEvent;

/**
 * Union of all event message types.
 */
export type AnyEvent = OffscreenEvent | ContentEvent;

// ============================================
// EVENT TYPE CONSTANTS
// ============================================

/**
 * All event type strings for runtime checking.
 */
export const EVENT_TYPES = {
  // Offscreen → Background
  OFFSCREEN_CAPTURE_STARTED: 'OFFSCREEN_CAPTURE_STARTED',
  OFFSCREEN_PAUSED: 'OFFSCREEN_PAUSED',
  OFFSCREEN_RESUMED: 'OFFSCREEN_RESUMED',
  OFFSCREEN_CAPTURE_COMPLETE: 'OFFSCREEN_CAPTURE_COMPLETE',
  OFFSCREEN_STREAM_ENDED: 'OFFSCREEN_STREAM_ENDED',
  OFFSCREEN_CAPTURE_ERROR: 'OFFSCREEN_CAPTURE_ERROR',
  OFFSCREEN_CHUNK_STORED: 'OFFSCREEN_CHUNK_STORED',
  OFFSCREEN_AUDIO_LEVEL: 'OFFSCREEN_AUDIO_LEVEL',
  OFFSCREEN_AUDIO_UNAVAILABLE: 'OFFSCREEN_AUDIO_UNAVAILABLE',
  OFFSCREEN_SIZE_WARNING: 'OFFSCREEN_SIZE_WARNING',

  // Content → Background
  CONTENT_SCRIPT_READY: 'CONTENT_SCRIPT_READY',
  PONG: 'PONG',
  FLOATING_PANE_POSITION_CHANGED: 'FLOATING_PANE_POSITION_CHANGED',
  CONTENT_TELEMETRY_BATCH: 'CONTENT_TELEMETRY_BATCH',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
