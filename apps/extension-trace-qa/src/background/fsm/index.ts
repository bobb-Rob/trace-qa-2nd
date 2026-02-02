/**
 * FSM Module
 * Finite State Machine for recording session management.
 *
 * Usage:
 *   import { transition, getState, initWatchdog } from './fsm';
 *
 *   // Initialize on service worker start
 *   await restoreFromStorage();
 *   setTerminalCallback(finalizeSession);
 *   initWatchdog();
 *   await validateStateOnWake();
 *
 *   // Trigger state transitions
 *   await transition({ type: 'START_REQUESTED' }, 'User clicked start');
 */

// Types
export type {
  SessionState,
  SessionEvent,
  SessionEventType,
  TransitionContext,
  WatchdogConfig,
  FSMContext,
} from './types';

// Transition logic (pure functions)
export {
  TRANSITION_TABLE,
  ERROR_EVENTS,
  isValidTransition,
  getNextState,
  isTerminalEvent,
  isErrorEvent,
} from './transitions';

// Pure reducer
export { reduce, reduceStrict } from './reducer';

// Executor (side effects)
export {
  transition,
  getState,
  getSessionId,
  getContext,
  updateContext,
  resetContext,
  restoreFromStorage,
  forceState,
  setTerminalCallback,
  setStateChangeCallback,
} from './executor';

// Watchdog and self-healing
export {
  startWatchdog,
  stopWatchdog,
  resetWatchdog,
  hasOffscreenDocument,
  validateStateOnWake,
  isMessageFresh,
  initWatchdog,
} from './watchdog';
