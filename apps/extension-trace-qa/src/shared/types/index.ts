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
