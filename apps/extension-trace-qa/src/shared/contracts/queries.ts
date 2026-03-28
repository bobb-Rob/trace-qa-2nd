/**
 * Query Message Types
 *
 * Queries request data without side effects. They:
 * - Request current state or data
 * - Always expect a response
 * - Do not modify state
 *
 * @module contracts/queries
 */

import type { SessionState } from '../types';

// ============================================
// STATUS QUERIES (Any → Background)
// ============================================

/**
 * Query current recording status.
 * Can be sent from Popup, FloatingPane, or Content scripts.
 */
export interface GetRecordingStatusQuery {
  type: 'GET_RECORDING_STATUS';
}

/**
 * Response to GET_RECORDING_STATUS query.
 */
export interface GetRecordingStatusResponse {
  success: boolean;
  sessionState: SessionState;
  sessionId: string | null;
  isPaused: boolean;
  duration: number;
  isMuted?: boolean;
  audioEnabled?: boolean;
  error?: string;
}

// ============================================
// QUERY TYPE UNIONS
// ============================================

/**
 * Union of all query message types.
 */
export type AnyQuery = GetRecordingStatusQuery;

/**
 * Union of all query response types.
 */
export type AnyQueryResponse = GetRecordingStatusResponse;

// ============================================
// QUERY TYPE CONSTANTS
// ============================================

/**
 * All query type strings for runtime checking.
 */
export const QUERY_TYPES = {
  GET_RECORDING_STATUS: 'GET_RECORDING_STATUS',
} as const;

export type QueryType = (typeof QUERY_TYPES)[keyof typeof QUERY_TYPES];
