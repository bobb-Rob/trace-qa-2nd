/**
 * Command Message Types
 *
 * Commands request an action from the receiver. They:
 * - Are sent by the caller
 * - Expect a response
 * - Have explicit intent (no toggle behavior)
 *
 * @module contracts/commands
 */

import type { VideoRecordingConfig } from '../types';

// ============================================
// RECORDING COMMANDS (UI → Background)
// ============================================

/**
 * Initiates a new recording session.
 * Valid from: IDLE
 * Triggers: START_REQUESTED
 */
export interface StartRecordingCommand {
  type: 'START_RECORDING';
  payload: {
    sessionId: string;
    tabId: number;
    videoConfig: VideoRecordingConfig;
  };
}

export interface StartRecordingResponse {
  success: boolean;
  error?: string;
  sessionId?: string;
}

/**
 * Stops the current recording session.
 * Valid from: RECORDING, PAUSED
 * Triggers: STOP_REQUESTED
 */
export interface StopRecordingCommand {
  type: 'STOP_RECORDING';
  payload: {
    sessionId: string;
  };
}

export interface StopRecordingResponse {
  success: boolean;
  error?: string;
}

/**
 * Requests to pause the current recording.
 * NOT a toggle - only pauses, never resumes.
 * Valid from: RECORDING only
 * Triggers: PAUSE_REQUESTED
 * Rejection: If already paused, returns { success: false, error: 'Already paused' }
 */
export interface PauseRequestedCommand {
  type: 'UI_PAUSE_REQUESTED';
  payload: {
    sessionId: string;
  };
}

export interface PauseRequestedResponse {
  success: boolean;
  error?: string;
}

/**
 * Requests to resume a paused recording.
 * NOT a toggle - only resumes, never pauses.
 * Valid from: PAUSED only
 * Triggers: RESUME_REQUESTED
 * Rejection: If not paused, returns { success: false, error: 'Not paused' }
 */
export interface ResumeRequestedCommand {
  type: 'UI_RESUME_REQUESTED';
  payload: {
    sessionId: string;
  };
}

export interface ResumeRequestedResponse {
  success: boolean;
  error?: string;
}

// ============================================
// FLOATING PANE COMMANDS (Content → Background)
// ============================================

/**
 * Pause command from FloatingPane.
 * Explicit pause, NOT a toggle.
 * Behavior: Same as UI_PAUSE_REQUESTED
 */
export interface FloatingPanePauseCommand {
  type: 'FLOATING_PANE_PAUSE';
  payload: {
    sessionId: string;
  };
}

/**
 * Resume command from FloatingPane.
 * Explicit resume, NOT a toggle.
 * Behavior: Same as UI_RESUME_REQUESTED
 */
export interface FloatingPaneResumeCommand {
  type: 'FLOATING_PANE_RESUME';
  payload: {
    sessionId: string;
  };
}

/**
 * Stop command from FloatingPane.
 * Behavior: Same as STOP_RECORDING
 */
export interface FloatingPaneStopCommand {
  type: 'FLOATING_PANE_STOP';
  payload: {
    sessionId: string;
  };
}

/**
 * Mute audio from FloatingPane.
 * Explicit mute, NOT a toggle.
 */
export interface FloatingPaneMuteCommand {
  type: 'FLOATING_PANE_MUTE';
  payload: {
    sessionId: string;
  };
}

/**
 * Unmute audio from FloatingPane.
 * Explicit unmute, NOT a toggle.
 */
export interface FloatingPaneUnmuteCommand {
  type: 'FLOATING_PANE_UNMUTE';
  payload: {
    sessionId: string;
  };
}

// ============================================
// OFFSCREEN COMMANDS (Background → Offscreen)
// ============================================

/**
 * Start media capture in offscreen document.
 */
export interface OffscreenStartCaptureCommand {
  type: 'OFFSCREEN_START_CAPTURE';
  payload: {
    sessionId: string;
    streamId: string;
    config: {
      mimeType: string;
      videoBitsPerSecond: number;
    };
  };
}

/**
 * Stop media capture in offscreen document.
 */
export interface OffscreenStopCaptureCommand {
  type: 'OFFSCREEN_STOP_CAPTURE';
  payload: {
    sessionId: string;
  };
}

/**
 * Pause MediaRecorder in offscreen document.
 */
export interface OffscreenPauseRecordingCommand {
  type: 'OFFSCREEN_PAUSE_RECORDING';
  payload: {
    sessionId: string;
  };
}

/**
 * Resume MediaRecorder in offscreen document.
 */
export interface OffscreenResumeRecordingCommand {
  type: 'OFFSCREEN_RESUME_RECORDING';
  payload: {
    sessionId: string;
  };
}

// ============================================
// AUDIO COMMANDS (Background → Offscreen)
// Future: Phase 6-7 Audio Implementation
// ============================================

/**
 * Enable audio capture.
 */
export interface OffscreenEnableAudioCommand {
  type: 'OFFSCREEN_ENABLE_AUDIO';
  payload: {
    deviceId?: string; // Preferred microphone
  };
}

/**
 * Disable audio capture.
 */
export interface OffscreenDisableAudioCommand {
  type: 'OFFSCREEN_DISABLE_AUDIO';
  payload: Record<string, never>;
}

/**
 * Set mute state explicitly.
 * NOT a toggle - takes explicit boolean value.
 */
export interface OffscreenSetMutedCommand {
  type: 'OFFSCREEN_SET_MUTED';
  payload: {
    muted: boolean; // true = muted, false = unmuted
  };
}

// ============================================
// CONTENT COMMANDS (Background → Content)
// ============================================

/**
 * Ping command to check if content script is loaded.
 */
export interface ContentPingCommand {
  type: 'PING';
}

/**
 * Show the floating pane in content script.
 */
export interface ContentShowFloatingPaneCommand {
  type: 'CONTENT_SHOW_FLOATING_PANE';
  payload: {
    sessionId: string;
    isPaused: boolean;
    isMuted: boolean;
    duration: number;
    canPause: boolean;
    audioUnavailable?: boolean;
    audioUnavailableReason?: 'permission_denied' | 'no_device' | 'device_in_use' | 'unknown';
  };
}

/**
 * Update the floating pane state.
 */
export interface ContentUpdateFloatingPaneCommand {
  type: 'CONTENT_UPDATE_FLOATING_PANE';
  payload: {
    isPaused?: boolean;
    isMuted?: boolean;
    duration?: number;
    warning?: string | null;
    audioUnavailable?: boolean;
    audioUnavailableReason?: 'permission_denied' | 'no_device' | 'device_in_use' | 'unknown';
  };
}

/**
 * Hide the floating pane.
 */
export interface ContentHideFloatingPaneCommand {
  type: 'CONTENT_HIDE_FLOATING_PANE';
}

// ============================================
// COMMAND TYPE UNIONS
// ============================================

/**
 * All commands from Popup/UI to Background.
 */
export type PopupCommand =
  | StartRecordingCommand
  | StopRecordingCommand
  | PauseRequestedCommand
  | ResumeRequestedCommand;

/**
 * All commands from Content/FloatingPane to Background.
 */
export type FloatingPaneCommand =
  | FloatingPanePauseCommand
  | FloatingPaneResumeCommand
  | FloatingPaneStopCommand
  | FloatingPaneMuteCommand
  | FloatingPaneUnmuteCommand;

/**
 * All commands from Background to Offscreen.
 */
export type OffscreenCommand =
  | OffscreenStartCaptureCommand
  | OffscreenStopCaptureCommand
  | OffscreenPauseRecordingCommand
  | OffscreenResumeRecordingCommand
  | OffscreenEnableAudioCommand
  | OffscreenDisableAudioCommand
  | OffscreenSetMutedCommand;

/**
 * All commands from Background to Content.
 */
export type ContentCommand =
  | ContentPingCommand
  | ContentShowFloatingPaneCommand
  | ContentUpdateFloatingPaneCommand
  | ContentHideFloatingPaneCommand;

/**
 * Union of all command message types.
 */
export type AnyCommand =
  | PopupCommand
  | FloatingPaneCommand
  | OffscreenCommand
  | ContentCommand;

// ============================================
// COMMAND TYPE CONSTANTS
// ============================================

/**
 * All command type strings for runtime checking.
 */
export const COMMAND_TYPES = {
  // Popup → Background
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  UI_PAUSE_REQUESTED: 'UI_PAUSE_REQUESTED',
  UI_RESUME_REQUESTED: 'UI_RESUME_REQUESTED',

  // FloatingPane → Background
  FLOATING_PANE_PAUSE: 'FLOATING_PANE_PAUSE',
  FLOATING_PANE_RESUME: 'FLOATING_PANE_RESUME',
  FLOATING_PANE_STOP: 'FLOATING_PANE_STOP',
  FLOATING_PANE_MUTE: 'FLOATING_PANE_MUTE',
  FLOATING_PANE_UNMUTE: 'FLOATING_PANE_UNMUTE',

  // Background → Offscreen
  OFFSCREEN_START_CAPTURE: 'OFFSCREEN_START_CAPTURE',
  OFFSCREEN_STOP_CAPTURE: 'OFFSCREEN_STOP_CAPTURE',
  OFFSCREEN_PAUSE_RECORDING: 'OFFSCREEN_PAUSE_RECORDING',
  OFFSCREEN_RESUME_RECORDING: 'OFFSCREEN_RESUME_RECORDING',
  OFFSCREEN_ENABLE_AUDIO: 'OFFSCREEN_ENABLE_AUDIO',
  OFFSCREEN_DISABLE_AUDIO: 'OFFSCREEN_DISABLE_AUDIO',
  OFFSCREEN_SET_MUTED: 'OFFSCREEN_SET_MUTED',

  // Background → Content
  PING: 'PING',
  CONTENT_SHOW_FLOATING_PANE: 'CONTENT_SHOW_FLOATING_PANE',
  CONTENT_UPDATE_FLOATING_PANE: 'CONTENT_UPDATE_FLOATING_PANE',
  CONTENT_HIDE_FLOATING_PANE: 'CONTENT_HIDE_FLOATING_PANE',
} as const;

export type CommandType = (typeof COMMAND_TYPES)[keyof typeof COMMAND_TYPES];
