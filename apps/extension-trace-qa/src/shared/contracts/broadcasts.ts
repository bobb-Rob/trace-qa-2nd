/**
 * Broadcast Message Types
 *
 * Broadcasts are one-to-many messages. They:
 * - Are sent by Background to all listeners
 * - Do not expect a response
 * - Communicate state updates
 *
 * @module contracts/broadcasts
 */

import type { SessionState } from '../types';

// ============================================
// UI STATE BROADCASTS (Background → All UI)
// ============================================

/**
 * Periodic state update during recording.
 * Sent every ~500-1000ms while recording is active.
 */
export interface UIStateUpdateBroadcast {
  type: 'UI_STATE_UPDATE';
  payload: {
    sessionId: string;
    sessionState: SessionState;
    isPaused: boolean;
    duration: number; // ms (excludes paused time)
    isMuted?: boolean;
    audioLevel?: number; // 0-100
    audioEnabled?: boolean;
    warning?: string | null;
  };
}

/**
 * Session has ended (success or error).
 * Sent once when a session terminates for any reason.
 */
export interface UISessionEndedBroadcast {
  type: 'UI_SESSION_ENDED';
  payload: {
    sessionId: string;
    reason: 'completed' | 'stopped' | 'error' | 'stream_ended' | 'external_stop';
    error?: string;
    downloadUrl?: string;
    duration?: number;
    chunkCount?: number;
    totalSize?: number;
  };
}

// ============================================
// SESSION LIFECYCLE BROADCASTS (Background → Content)
// ============================================

/**
 * Notify content script that recording has started.
 * Content script should start telemetry capture.
 */
export interface SessionStartedBroadcast {
  type: 'SESSION_STARTED';
  payload: {
    sessionId: string;
    startTime: number;
    tabId: number;
    telemetryConfig?: TelemetryConfig;
  };
}

/**
 * Notify content script that recording has ended.
 * Content script should stop telemetry capture and flush buffers.
 */
export interface SessionEndedBroadcast {
  type: 'SESSION_ENDED';
  payload: {
    sessionId: string;
  };
}

/**
 * Configuration for telemetry capture.
 * Future: Will be expanded in Phase 6-7
 */
export interface TelemetryConfig {
  captureClicks: boolean;
  captureInputs: boolean;
  captureScrolls: boolean;
  captureNavigation: boolean;
  captureErrors: boolean;
  captureNetwork: boolean;
  captureConsole: boolean;
  captureDomSnapshots: boolean;
  captureVisibility: boolean;
  batchIntervalMs: number;
  maxBatchSize: number;
}

// ============================================
// BROADCAST TYPE UNIONS
// ============================================

/**
 * All broadcasts to UI (Popup, FloatingPane).
 */
export type UIBroadcast = UIStateUpdateBroadcast | UISessionEndedBroadcast;

/**
 * All broadcasts to Content scripts.
 */
export type SessionBroadcast = SessionStartedBroadcast | SessionEndedBroadcast;

/**
 * Union of all broadcast message types.
 */
export type AnyBroadcast = UIBroadcast | SessionBroadcast;

// ============================================
// BROADCAST TYPE CONSTANTS
// ============================================

/**
 * All broadcast type strings for runtime checking.
 */
export const BROADCAST_TYPES = {
  // UI broadcasts
  UI_STATE_UPDATE: 'UI_STATE_UPDATE',
  UI_SESSION_ENDED: 'UI_SESSION_ENDED',

  // Session lifecycle broadcasts
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',
} as const;

export type BroadcastType = (typeof BROADCAST_TYPES)[keyof typeof BROADCAST_TYPES];
