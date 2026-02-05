export type VideoQuality = 'SD' | 'HD';
export type CaptureMode = 'TAB' | 'DESKTOP' | 'WINDOW';
export type AudioSource = 'MICROPHONE' | 'NONE';

export interface VideoRecordingConfig {
  quality: VideoQuality;
  captureMode: CaptureMode;
  audioSource: AudioSource;
}

export interface RecordingState {
  isRecording: boolean;
  sessionId: string | null;
  startTime: number | null;
  error: string | null;
  isLoading: boolean;
}

// Note: No ERROR state - errors are events that lead back to IDLE
export type SessionState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'STARTING'
  | 'RECORDING'
  | 'PAUSED'
  | 'STOPPING'
  | 'UPLOADING';

export interface TraceQAStorage {
  isRecording: boolean;
  sessionId: string | null;
  sessionState: SessionState;
  startTime: number | null;
  currentTabId: number | null;
  videoConfig: VideoRecordingConfig;
  lastError: string | null;
}

export type StorageData = TraceQAStorage;

export const RECORDING_LIMITS = {
  MAX_DURATION_MS: 30 * 60 * 1000,
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,
  SIZE_WARNING_THRESHOLD: 0.8,
  CHUNK_INTERVAL_MS: 1000,
} as const;

export const SUPPORTED_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

// Recorder configuration by quality
export const RECORDER_CONFIG = {
  SD: {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 1_000_000, // 1 Mbps
    width: 854,
    height: 480,
    frameRate: 24,
  },
  HD: {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2_500_000, // 2.5 Mbps
    width: 1280,
    height: 720,
    frameRate: 30,
  },
} as const;

// Message types for Popup → Background (and FloatingPane via content script)
export type PopupToBackgroundMessage =
  | { type: 'START_RECORDING'; payload: StartRecordingPayload }
  | { type: 'STOP_RECORDING'; payload: StopRecordingPayload }
  | { type: 'GET_RECORDING_STATUS' }
  | { type: 'UI_PAUSE_REQUESTED'; payload: PauseResumePayload }
  | { type: 'UI_RESUME_REQUESTED'; payload: PauseResumePayload };

export interface PauseResumePayload {
  sessionId: string;
}

export interface StartRecordingPayload {
  sessionId: string;
  tabId: number;
  videoConfig: VideoRecordingConfig;
}

export interface StopRecordingPayload {
  sessionId: string;
}

// Message types for Background → Offscreen
export type BackgroundToOffscreenMessage =
  | { type: 'OFFSCREEN_START_CAPTURE'; payload: OffscreenStartPayload }
  | { type: 'OFFSCREEN_STOP_CAPTURE'; payload: OffscreenStopPayload }
  | { type: 'OFFSCREEN_PAUSE_RECORDING'; payload: OffscreenPauseResumePayload }
  | { type: 'OFFSCREEN_RESUME_RECORDING'; payload: OffscreenPauseResumePayload };

export interface OffscreenStartPayload {
  sessionId: string;
  streamId: string;
  config: {
    mimeType: string;
    videoBitsPerSecond: number;
  };
}

export interface OffscreenStopPayload {
  sessionId: string;
}

export interface OffscreenPauseResumePayload {
  sessionId: string;
}

// Message types for Offscreen → Background
export type OffscreenToBackgroundMessage =
  | { type: 'OFFSCREEN_CAPTURE_STARTED'; payload: { sessionId: string } }
  | { type: 'OFFSCREEN_CAPTURE_COMPLETE'; payload: OffscreenCaptureCompletePayload }
  | { type: 'OFFSCREEN_STREAM_ENDED'; payload: OffscreenStreamEndedPayload } // External stop (Stop sharing)
  | { type: 'OFFSCREEN_CAPTURE_ERROR'; payload: OffscreenErrorPayload }
  | { type: 'OFFSCREEN_SIZE_WARNING'; payload: { sessionId: string; currentSize: number } }
  | { type: 'OFFSCREEN_PAUSED'; payload: { sessionId: string } }
  | { type: 'OFFSCREEN_RESUMED'; payload: { sessionId: string } };

// Payload for external stream termination (user clicked Stop sharing)
export interface OffscreenStreamEndedPayload {
  sessionId: string;
  blobKey: string;
  size: number;
  duration: number;
}

export interface OffscreenCaptureCompletePayload {
  sessionId: string;
  blobKey: string;
  size: number;
  duration: number;
}

export interface OffscreenErrorPayload {
  sessionId: string;
  errorCode: ErrorCode;
  message: string;
}

// Error codes
export type ErrorCode =
  | 'PERMISSION_DENIED'
  | 'ALREADY_RECORDING'
  | 'NO_ACTIVE_RECORDING'
  | 'SESSION_MISMATCH'
  | 'OFFSCREEN_CREATION_FAILED'
  | 'ENCODER_ERROR'
  | 'STREAM_ENDED'
  | 'QUOTA_EXCEEDED'
  | 'UPLOAD_FAILED'
  | 'TIMEOUT';

// Message types for Background → Popup (broadcasts)
export type BackgroundToPopupMessage =
  | { type: 'UI_SESSION_ENDED'; payload: UISessionEndedPayload }
  | { type: 'UI_STATE_UPDATE'; payload: UIStateUpdatePayload };

export interface UISessionEndedPayload {
  sessionId: string;
  reason: 'completed' | 'external_stop' | 'error';
  error?: string;
}

/**
 * Periodic state broadcast from background to all UI components.
 * Sent every ~500ms during active recording.
 */
export interface UIStateUpdatePayload {
  sessionId: string;
  sessionState: SessionState;
  isPaused: boolean;
  duration: number; // Elapsed recording time in ms (excludes paused time)
  warning?: string | null;
}

// IndexedDB constants
export const IDB_CONFIG = {
  DB_NAME: 'traceqa-media',
  DB_VERSION: 1,
  STORE_NAME: 'blobs',
} as const;

// ─────────────────────────────────────────────────────────────
// FloatingPane Types (UI-only, intent-driven)
// ─────────────────────────────────────────────────────────────

/**
 * Payload to show the floating pane with initial state.
 */
export interface ShowFloatingPanePayload {
  isPaused: boolean;
  isMuted: boolean;
  duration: number;
  canPause: boolean; // v1: false (stop-only), future: true when pause is implemented
  audioUnavailable?: boolean;
  audioUnavailableReason?: AudioUnavailableReason;
}

/**
 * Payload to update the floating pane state.
 */
export interface UpdateFloatingPanePayload {
  isPaused?: boolean;
  isMuted?: boolean;
  duration?: number;
  warning?: string | null;
  audioUnavailable?: boolean;
  audioUnavailableReason?: AudioUnavailableReason;
}

/**
 * Reason why audio capture is unavailable.
 */
export type AudioUnavailableReason =
  | 'permission_denied'
  | 'no_device'
  | 'device_in_use'
  | 'unknown';

// ─────────────────────────────────────────────────────────────
// Content Script Message Types (Background ↔ ContentScript)
// ─────────────────────────────────────────────────────────────

/**
 * Payload for showing FloatingPane via content script (includes sessionId)
 */
export interface ContentShowFloatingPanePayload extends ShowFloatingPanePayload {
  sessionId: string;
}

/**
 * Messages from Background → Content Script (for FloatingPane control)
 */
export type BackgroundToContentMessage =
  | { type: 'PING' }  // Lightweight check if content script is loaded
  | { type: 'CONTENT_SHOW_FLOATING_PANE'; payload: ContentShowFloatingPanePayload }
  | { type: 'CONTENT_UPDATE_FLOATING_PANE'; payload: UpdateFloatingPanePayload }
  | { type: 'CONTENT_HIDE_FLOATING_PANE' };

/**
 * Messages from Content Script → Background (user intents from FloatingPane)
 */
export type ContentToBackgroundMessage =
  | { type: 'PONG' }  // Response to PING - content script is alive
  | { type: 'CONTENT_SCRIPT_READY' }  // Sent immediately when content script loads
  | { type: 'FLOATING_PANE_PAUSE'; payload: { sessionId: string } }
  | { type: 'FLOATING_PANE_RESUME'; payload: { sessionId: string } }
  | { type: 'FLOATING_PANE_STOP'; payload: { sessionId: string } }
  | { type: 'FLOATING_PANE_TOGGLE_MUTE'; payload: { sessionId: string } }
  | { type: 'FLOATING_PANE_POSITION_CHANGED'; payload: { x: number; y: number } };

// ─────────────────────────────────────────────────────────────
// Re-export from contracts module for gradual migration
// New code should import from '@/shared/contracts' directly
// ─────────────────────────────────────────────────────────────
export * from '../contracts';
