/**
 * Controllers Module
 *
 * Exports for background service worker controllers.
 * Controllers handle coordination logic and orchestrate FSM, offscreen, and UI.
 *
 * @module background/controllers
 */

// Offscreen Controller
export {
  createOffscreenDocument,
  closeOffscreenDocument,
  startCapture,
  stopCapture,
  pauseRecording,
  resumeRecording,
  downloadBlob,
} from './offscreenController';

// Session Controller
export {
  getRecordingTabId,
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
} from './sessionController';

// Audio Controller (Phase 6)
export {
  initAudioController,
  prepareAudioForSession,
  resetAudioForSession,
  setMuted,
  mute,
  unmute,
  enableAudio,
  disableAudio,
  updateAudioLevel,
  markAudioUnavailable,
  markAudioAvailable,
  getAudioState,
  isAudioActive,
  getAudioConfig,
  handleFloatingPaneMute,
  handleFloatingPaneUnmute,
  handleAudioLevelEvent,
  type AudioState,
  type AudioConfig,
  type AudioUnavailableReason,
} from './audioController';
