/**
 * Pure Reducer Function
 * Computes the next state given current state and event.
 *
 * CRITICAL: This module must be PURE - no side effects.
 * - No logging
 * - No storage access
 * - No async operations
 * - No mutations
 */

import type { SessionState, SessionEvent } from './types';
import { getNextState, isValidTransition } from './transitions';

/**
 * Pure reducer function for state transitions.
 * Given a current state and an event, returns the new state.
 *
 * Invalid transitions return the current state unchanged (silent ignore).
 *
 * @param state - Current session state
 * @param event - Event to process
 * @returns New state after transition (or current state if invalid)
 */
export function reduce(state: SessionState, event: SessionEvent): SessionState {
  const nextState = getNextState(state, event.type);

  // Invalid transition - return current state
  if (nextState === null) {
    return state;
  }

  return nextState;
}

/**
 * Strict variant that throws on invalid transitions.
 * Useful for catching programming errors during development.
 *
 * @param state - Current session state
 * @param event - Event to process
 * @returns New state after transition
 * @throws Error if the transition is invalid
 */
export function reduceStrict(
  state: SessionState,
  event: SessionEvent
): SessionState {
  if (!isValidTransition(state, event.type)) {
    throw new Error(
      `Invalid state transition: ${state} + ${event.type}. ` +
        `This indicates a bug in the state machine logic.`
    );
  }

  return reduce(state, event);
}
