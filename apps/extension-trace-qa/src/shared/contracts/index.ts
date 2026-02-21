/**
 * Message Contracts
 *
 * Centralized exports for all message contracts used in TraceQA.
 * This module provides typed message definitions and validation helpers
 * for communication between planes (Background, Offscreen, Content, Popup).
 *
 * @module contracts
 */

// ============================================
// COMMANDS
// ============================================
export {
  // Recording commands
  type StartRecordingCommand,
  type StartRecordingResponse,
  type StopRecordingCommand,
  type StopRecordingResponse,
  type PauseRequestedCommand,
  type PauseRequestedResponse,
  type ResumeRequestedCommand,
  type ResumeRequestedResponse,

  // FloatingPane commands
  type FloatingPanePauseCommand,
  type FloatingPaneResumeCommand,
  type FloatingPaneStopCommand,
  type FloatingPaneMuteCommand,
  type FloatingPaneUnmuteCommand,

  // Offscreen commands
  type OffscreenStartCaptureCommand,
  type OffscreenStopCaptureCommand,
  type OffscreenPauseRecordingCommand,
  type OffscreenResumeRecordingCommand,
  type OffscreenEnableAudioCommand,
  type OffscreenDisableAudioCommand,
  type OffscreenSetMutedCommand,

  // Content commands
  type ContentPingCommand,
  type ContentShowFloatingPaneCommand,
  type ContentUpdateFloatingPaneCommand,
  type ContentHideFloatingPaneCommand,

  // Command unions
  type PopupCommand,
  type FloatingPaneCommand,
  type OffscreenCommand,
  type ContentCommand,
  type AnyCommand,

  // Constants
  COMMAND_TYPES,
  type CommandType,
} from './commands';

// ============================================
// EVENTS
// ============================================
export {
  // Offscreen events
  type OffscreenStartedEvent,
  type OffscreenPausedEvent,
  type OffscreenResumedEvent,
  type OffscreenStoppedEvent,
  type OffscreenStreamEndedEvent,
  type OffscreenErrorEvent,
  type OffscreenChunkStoredEvent,
  type OffscreenAudioLevelEvent,
  type OffscreenSizeWarningEvent,

  // Content events
  type ContentScriptReadyEvent,
  type ContentPongEvent,
  type FloatingPanePositionChangedEvent,
  type ContentTelemetryBatchEvent,
  type TelemetryEvent,

  // Event unions
  type OffscreenEvent,
  type ContentEvent,
  type AnyEvent,

  // Constants
  EVENT_TYPES,
  type EventType,
} from './events';

// ============================================
// BROADCASTS
// ============================================
export {
  // UI broadcasts
  type UIStateUpdateBroadcast,
  type UISessionEndedBroadcast,

  // Session broadcasts
  type SessionStartedBroadcast,
  type SessionEndedBroadcast,
  type TelemetryConfig,

  // Broadcast unions
  type UIBroadcast,
  type SessionBroadcast,
  type AnyBroadcast,

  // Constants
  BROADCAST_TYPES,
  type BroadcastType,
} from './broadcasts';

// ============================================
// QUERIES
// ============================================
export {
  type GetRecordingStatusQuery,
  type GetRecordingStatusResponse,
  type AnyQuery,
  type AnyQueryResponse,
  QUERY_TYPES,
  type QueryType,
} from './queries';

// ============================================
// VALIDATION
// ============================================
export {
  // Type guards
  isMessage,
  hasPayload,
  isCommand,
  isEvent,
  isBroadcast,
  isQuery,

  // Session validation
  validateSessionId,
  type ValidationResult,

  // Freshness
  isFresh,
  withTimestamp,
  type MessageWithTimestamp,

  // Error handling
  ERROR_CODES,
  type ErrorCode,
  createErrorResponse,

  // Direction validation
  MESSAGE_DIRECTIONS,
  isValidDirection,
} from './validation';

// ============================================
// TELEMETRY PAYLOAD
// ============================================
export {
  type RecordedSession,
  type TimelineEvent,
  type InteractionEvent,
  type NavigationEvent as ConsolidatedNavigationEvent,
  type NetworkRequest,
  type AggregatedNetworkGroup,
  type ConsoleLogEntry,
  type ErrorEntry,
  type VisibilityEvent,
  type DOMSnapshot,
  type SessionMetrics,
  type DerivedInsights,
} from './telemetryPayload';

// ============================================
// AGGREGATE TYPES
// ============================================

import type { AnyCommand } from './commands';
import type { AnyEvent } from './events';
import type { AnyBroadcast } from './broadcasts';
import type { AnyQuery } from './queries';

/**
 * Union of all message types in the system.
 */
export type AnyMessage = AnyCommand | AnyEvent | AnyBroadcast | AnyQuery;

/**
 * Extract message type string from a message.
 */
export type MessageType<T extends { type: string }> = T['type'];

/**
 * Extract payload type from a message that has a payload.
 */
export type PayloadOf<T extends { payload?: unknown }> = T extends { payload: infer P } ? P : never;
