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

export type SessionState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'STARTING'
  | 'RECORDING'
  | 'STOPPING'
  | 'UPLOADING'
  | 'ERROR';

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

// Message types for Popup → Background
export type PopupToBackgroundMessage =
  | { type: 'START_RECORDING'; payload: StartRecordingPayload }
  | { type: 'STOP_RECORDING'; payload: StopRecordingPayload }
  | { type: 'GET_RECORDING_STATUS' };

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
  | { type: 'OFFSCREEN_STOP_CAPTURE'; payload: OffscreenStopPayload };

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

// Message types for Offscreen → Background
export type OffscreenToBackgroundMessage =
  | { type: 'OFFSCREEN_CAPTURE_STARTED'; payload: { sessionId: string } }
  | { type: 'OFFSCREEN_CAPTURE_COMPLETE'; payload: OffscreenCaptureCompletePayload }
  | { type: 'OFFSCREEN_CAPTURE_ERROR'; payload: OffscreenErrorPayload }
  | { type: 'OFFSCREEN_SIZE_WARNING'; payload: { sessionId: string; currentSize: number } };

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

// IndexedDB constants
export const IDB_CONFIG = {
  DB_NAME: 'traceqa-media',
  DB_VERSION: 1,
  STORE_NAME: 'blobs',
} as const;
