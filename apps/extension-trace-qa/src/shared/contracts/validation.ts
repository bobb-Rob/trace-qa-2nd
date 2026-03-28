/**
 * Message Validation Helpers
 *
 * Runtime validation and type guards for message contracts.
 * These helpers ensure type safety at runtime boundaries.
 *
 * @module contracts/validation
 */

import { COMMAND_TYPES, type CommandType, type AnyCommand } from './commands';
import { EVENT_TYPES, type EventType, type AnyEvent } from './events';
import { BROADCAST_TYPES, type BroadcastType, type AnyBroadcast } from './broadcasts';
import { QUERY_TYPES, type QueryType, type AnyQuery } from './queries';

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if a value is a valid message object.
 */
export function isMessage(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && 'type' in value && typeof (value as { type: unknown }).type === 'string';
}

/**
 * Check if a message has a payload.
 */
export function hasPayload<T extends { type: string; payload?: unknown }>(
  msg: T
): msg is T & { payload: NonNullable<T['payload']> } {
  return 'payload' in msg && msg.payload !== undefined;
}

/**
 * Check if a value is a command message.
 */
export function isCommand(value: unknown): value is AnyCommand {
  if (!isMessage(value)) return false;
  return Object.values(COMMAND_TYPES).includes(value.type as CommandType);
}

/**
 * Check if a value is an event message.
 */
export function isEvent(value: unknown): value is AnyEvent {
  if (!isMessage(value)) return false;
  return Object.values(EVENT_TYPES).includes(value.type as EventType);
}

/**
 * Check if a value is a broadcast message.
 */
export function isBroadcast(value: unknown): value is AnyBroadcast {
  if (!isMessage(value)) return false;
  return Object.values(BROADCAST_TYPES).includes(value.type as BroadcastType);
}

/**
 * Check if a value is a query message.
 */
export function isQuery(value: unknown): value is AnyQuery {
  if (!isMessage(value)) return false;
  return Object.values(QUERY_TYPES).includes(value.type as QueryType);
}

// ============================================
// SESSION ID VALIDATION
// ============================================

/**
 * Validate that a session ID is present and matches the current session.
 */
export function validateSessionId(
  providedId: string | undefined | null,
  currentId: string | null
): ValidationResult {
  if (!providedId) {
    return { valid: false, reason: 'Session ID is required' };
  }

  if (currentId === null) {
    return { valid: false, reason: 'No active session' };
  }

  if (providedId !== currentId) {
    return { valid: false, reason: 'Session ID mismatch (stale request)' };
  }

  return { valid: true };
}

/**
 * Result of a validation check.
 */
export type ValidationResult = { valid: true } | { valid: false; reason: string };

// ============================================
// MESSAGE FRESHNESS
// ============================================

/**
 * Message with optional timestamp for freshness checking.
 */
export interface MessageWithTimestamp {
  timestamp?: number;
}

/**
 * Check if a message is fresh (not stale).
 * @param message - Message to check
 * @param maxAgeMs - Maximum age in milliseconds (default: 5000ms)
 */
export function isFresh(message: MessageWithTimestamp, maxAgeMs = 5000): boolean {
  if (message.timestamp === undefined) {
    // Messages without timestamps are considered fresh
    return true;
  }
  return Date.now() - message.timestamp < maxAgeMs;
}

/**
 * Add a timestamp to a message.
 */
export function withTimestamp<T extends object>(message: T): T & { timestamp: number } {
  return { ...message, timestamp: Date.now() };
}

// ============================================
// ERROR CODES
// ============================================

/**
 * Standard error codes for message handling.
 */
export const ERROR_CODES = {
  // State errors
  INVALID_STATE: 'INVALID_STATE',
  SESSION_MISMATCH: 'SESSION_MISMATCH',
  NO_ACTIVE_SESSION: 'NO_ACTIVE_SESSION',
  ALREADY_RECORDING: 'ALREADY_RECORDING',
  NOT_PAUSED: 'NOT_PAUSED',
  ALREADY_PAUSED: 'ALREADY_PAUSED',

  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // Capture errors
  CAPTURE_FAILED: 'CAPTURE_FAILED',
  OFFSCREEN_ERROR: 'OFFSCREEN_ERROR',
  OFFSCREEN_CREATION_FAILED: 'OFFSCREEN_CREATION_FAILED',
  ENCODER_ERROR: 'ENCODER_ERROR',
  STREAM_ENDED: 'STREAM_ENDED',

  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Upload errors
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Create a standardized error response.
 */
export function createErrorResponse(code: ErrorCode, message?: string): { success: false; error: string; errorCode: ErrorCode } {
  return {
    success: false,
    error: message || getDefaultErrorMessage(code),
    errorCode: code,
  };
}

/**
 * Get default error message for an error code.
 */
function getDefaultErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    INVALID_STATE: 'Operation not valid in current state',
    SESSION_MISMATCH: 'Session ID does not match active session',
    NO_ACTIVE_SESSION: 'No active recording session',
    ALREADY_RECORDING: 'Cannot start: already recording',
    NOT_PAUSED: 'Cannot resume: not paused',
    ALREADY_PAUSED: 'Cannot pause: already paused',
    PERMISSION_DENIED: 'Permission denied',
    CAPTURE_FAILED: 'Failed to start capture',
    OFFSCREEN_ERROR: 'Offscreen document error',
    OFFSCREEN_CREATION_FAILED: 'Failed to create offscreen document',
    ENCODER_ERROR: 'Media encoder error',
    STREAM_ENDED: 'Media stream ended unexpectedly',
    STORAGE_ERROR: 'Storage operation failed',
    QUOTA_EXCEEDED: 'Storage quota exceeded',
    UPLOAD_FAILED: 'Upload failed',
    TIMEOUT: 'Operation timed out',
  };
  return messages[code];
}

// ============================================
// MESSAGE DIRECTION HELPERS
// ============================================

/**
 * All message types organized by direction.
 */
export const MESSAGE_DIRECTIONS = {
  POPUP_TO_BACKGROUND: [
    'START_RECORDING',
    'STOP_RECORDING',
    'UI_PAUSE_REQUESTED',
    'UI_RESUME_REQUESTED',
    'GET_RECORDING_STATUS',
  ],
  CONTENT_TO_BACKGROUND: [
    'FLOATING_PANE_PAUSE',
    'FLOATING_PANE_RESUME',
    'FLOATING_PANE_STOP',
    'FLOATING_PANE_MUTE',
    'FLOATING_PANE_UNMUTE',
    'FLOATING_PANE_POSITION_CHANGED',
    'CONTENT_SCRIPT_READY',
    'PONG',
    'CONTENT_TELEMETRY_BATCH',
  ],
  BACKGROUND_TO_OFFSCREEN: [
    'OFFSCREEN_START_CAPTURE',
    'OFFSCREEN_STOP_CAPTURE',
    'OFFSCREEN_PAUSE_RECORDING',
    'OFFSCREEN_RESUME_RECORDING',
    'OFFSCREEN_ENABLE_AUDIO',
    'OFFSCREEN_DISABLE_AUDIO',
    'OFFSCREEN_SET_MUTED',
  ],
  OFFSCREEN_TO_BACKGROUND: [
    'OFFSCREEN_CAPTURE_STARTED',
    'OFFSCREEN_PAUSED',
    'OFFSCREEN_RESUMED',
    'OFFSCREEN_CAPTURE_COMPLETE',
    'OFFSCREEN_STREAM_ENDED',
    'OFFSCREEN_CAPTURE_ERROR',
    'OFFSCREEN_CHUNK_STORED',
    'OFFSCREEN_AUDIO_LEVEL',
    'OFFSCREEN_SIZE_WARNING',
  ],
  BACKGROUND_TO_CONTENT: [
    'PING',
    'CONTENT_SHOW_FLOATING_PANE',
    'CONTENT_UPDATE_FLOATING_PANE',
    'CONTENT_HIDE_FLOATING_PANE',
    'SESSION_STARTED',
    'SESSION_ENDED',
  ],
  BACKGROUND_TO_UI: ['UI_STATE_UPDATE', 'UI_SESSION_ENDED'],
} as const;

/**
 * Check if a message type is valid for a given direction.
 */
export function isValidDirection(
  messageType: string,
  direction: keyof typeof MESSAGE_DIRECTIONS
): boolean {
  return MESSAGE_DIRECTIONS[direction].includes(messageType as never);
}
