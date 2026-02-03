import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  getNextState,
  isTerminalEvent,
  isErrorEvent,
  TRANSITION_TABLE,
} from '../transitions';
import type { SessionState, SessionEventType } from '../types';

describe('isValidTransition', () => {
  describe('from IDLE state', () => {
    it('should allow START_REQUESTED', () => {
      expect(isValidTransition('IDLE', 'START_REQUESTED')).toBe(true);
    });

    it('should allow FORCE_RESET', () => {
      expect(isValidTransition('IDLE', 'FORCE_RESET')).toBe(true);
    });

    it('should reject CAPTURE_STARTED', () => {
      expect(isValidTransition('IDLE', 'CAPTURE_STARTED')).toBe(false);
    });

    it('should reject STOP_REQUESTED', () => {
      expect(isValidTransition('IDLE', 'STOP_REQUESTED')).toBe(false);
    });

    it('should reject PERMISSION_GRANTED', () => {
      expect(isValidTransition('IDLE', 'PERMISSION_GRANTED')).toBe(false);
    });
  });

  describe('from REQUESTING_PERMISSION state', () => {
    it('should allow PERMISSION_GRANTED', () => {
      expect(isValidTransition('REQUESTING_PERMISSION', 'PERMISSION_GRANTED')).toBe(true);
    });

    it('should allow PERMISSION_DENIED', () => {
      expect(isValidTransition('REQUESTING_PERMISSION', 'PERMISSION_DENIED')).toBe(true);
    });

    it('should allow FORCE_RESET', () => {
      expect(isValidTransition('REQUESTING_PERMISSION', 'FORCE_RESET')).toBe(true);
    });

    it('should reject START_REQUESTED', () => {
      expect(isValidTransition('REQUESTING_PERMISSION', 'START_REQUESTED')).toBe(false);
    });

    it('should reject CAPTURE_STARTED', () => {
      expect(isValidTransition('REQUESTING_PERMISSION', 'CAPTURE_STARTED')).toBe(false);
    });
  });

  describe('from STARTING state', () => {
    it('should allow CAPTURE_STARTED', () => {
      expect(isValidTransition('STARTING', 'CAPTURE_STARTED')).toBe(true);
    });

    it('should allow CAPTURE_FAILED', () => {
      expect(isValidTransition('STARTING', 'CAPTURE_FAILED')).toBe(true);
    });

    it('should allow FORCE_RESET', () => {
      expect(isValidTransition('STARTING', 'FORCE_RESET')).toBe(true);
    });

    it('should reject STOP_REQUESTED', () => {
      expect(isValidTransition('STARTING', 'STOP_REQUESTED')).toBe(false);
    });
  });

  describe('from RECORDING state', () => {
    it('should allow STOP_REQUESTED', () => {
      expect(isValidTransition('RECORDING', 'STOP_REQUESTED')).toBe(true);
    });

    it('should allow STREAM_ENDED for external stop (Stop sharing button)', () => {
      expect(isValidTransition('RECORDING', 'STREAM_ENDED')).toBe(true);
    });

    it('should allow CAPTURE_FAILED for unexpected stream end', () => {
      expect(isValidTransition('RECORDING', 'CAPTURE_FAILED')).toBe(true);
    });

    it('should allow FORCE_RESET', () => {
      expect(isValidTransition('RECORDING', 'FORCE_RESET')).toBe(true);
    });

    it('should reject CAPTURE_STARTED', () => {
      expect(isValidTransition('RECORDING', 'CAPTURE_STARTED')).toBe(false);
    });

    it('should reject START_REQUESTED', () => {
      expect(isValidTransition('RECORDING', 'START_REQUESTED')).toBe(false);
    });
  });

  describe('from STOPPING state', () => {
    it('should allow CAPTURE_STOPPED', () => {
      expect(isValidTransition('STOPPING', 'CAPTURE_STOPPED')).toBe(true);
    });

    it('should allow CAPTURE_FAILED', () => {
      expect(isValidTransition('STOPPING', 'CAPTURE_FAILED')).toBe(true);
    });

    it('should allow FORCE_RESET', () => {
      expect(isValidTransition('STOPPING', 'FORCE_RESET')).toBe(true);
    });

    it('should reject STOP_REQUESTED', () => {
      expect(isValidTransition('STOPPING', 'STOP_REQUESTED')).toBe(false);
    });
  });

  describe('from UPLOADING state', () => {
    it('should allow UPLOAD_COMPLETE', () => {
      expect(isValidTransition('UPLOADING', 'UPLOAD_COMPLETE')).toBe(true);
    });

    it('should allow UPLOAD_FAILED', () => {
      expect(isValidTransition('UPLOADING', 'UPLOAD_FAILED')).toBe(true);
    });

    it('should allow FORCE_RESET', () => {
      expect(isValidTransition('UPLOADING', 'FORCE_RESET')).toBe(true);
    });

    it('should reject STOP_REQUESTED', () => {
      expect(isValidTransition('UPLOADING', 'STOP_REQUESTED')).toBe(false);
    });
  });

  describe('FORCE_RESET from any state', () => {
    const allStates: SessionState[] = [
      'IDLE',
      'REQUESTING_PERMISSION',
      'STARTING',
      'RECORDING',
      'STOPPING',
      'UPLOADING',
    ];

    it.each(allStates)('should allow FORCE_RESET from %s', (state) => {
      expect(isValidTransition(state, 'FORCE_RESET')).toBe(true);
    });
  });
});

describe('getNextState', () => {
  it('should return REQUESTING_PERMISSION for IDLE + START_REQUESTED', () => {
    expect(getNextState('IDLE', 'START_REQUESTED')).toBe('REQUESTING_PERMISSION');
  });

  it('should return STARTING for REQUESTING_PERMISSION + PERMISSION_GRANTED', () => {
    expect(getNextState('REQUESTING_PERMISSION', 'PERMISSION_GRANTED')).toBe('STARTING');
  });

  it('should return IDLE for REQUESTING_PERMISSION + PERMISSION_DENIED', () => {
    expect(getNextState('REQUESTING_PERMISSION', 'PERMISSION_DENIED')).toBe('IDLE');
  });

  it('should return RECORDING for STARTING + CAPTURE_STARTED', () => {
    expect(getNextState('STARTING', 'CAPTURE_STARTED')).toBe('RECORDING');
  });

  it('should return STOPPING for RECORDING + STOP_REQUESTED', () => {
    expect(getNextState('RECORDING', 'STOP_REQUESTED')).toBe('STOPPING');
  });

  it('should return UPLOADING for RECORDING + STREAM_ENDED (external stop)', () => {
    expect(getNextState('RECORDING', 'STREAM_ENDED')).toBe('UPLOADING');
  });

  it('should return UPLOADING for STOPPING + CAPTURE_STOPPED', () => {
    expect(getNextState('STOPPING', 'CAPTURE_STOPPED')).toBe('UPLOADING');
  });

  it('should return IDLE for UPLOADING + UPLOAD_COMPLETE', () => {
    expect(getNextState('UPLOADING', 'UPLOAD_COMPLETE')).toBe('IDLE');
  });

  it('should return null for invalid transitions', () => {
    expect(getNextState('IDLE', 'CAPTURE_STARTED')).toBe(null);
    expect(getNextState('RECORDING', 'PERMISSION_GRANTED')).toBe(null);
    expect(getNextState('UPLOADING', 'STOP_REQUESTED')).toBe(null);
  });
});

describe('isTerminalEvent', () => {
  it('should identify terminal events', () => {
    expect(isTerminalEvent('PERMISSION_DENIED')).toBe(true);
    expect(isTerminalEvent('CAPTURE_FAILED')).toBe(true);
    expect(isTerminalEvent('UPLOAD_COMPLETE')).toBe(true);
    expect(isTerminalEvent('UPLOAD_FAILED')).toBe(true);
    expect(isTerminalEvent('FORCE_RESET')).toBe(true);
  });

  it('should not identify non-terminal events', () => {
    expect(isTerminalEvent('START_REQUESTED')).toBe(false);
    expect(isTerminalEvent('PERMISSION_GRANTED')).toBe(false);
    expect(isTerminalEvent('CAPTURE_STARTED')).toBe(false);
    expect(isTerminalEvent('STOP_REQUESTED')).toBe(false);
    expect(isTerminalEvent('CAPTURE_STOPPED')).toBe(false);
    expect(isTerminalEvent('STREAM_ENDED')).toBe(false); // Goes to UPLOADING, not IDLE
  });
});

describe('isErrorEvent', () => {
  it('should identify error events', () => {
    expect(isErrorEvent('PERMISSION_DENIED')).toBe(true);
    expect(isErrorEvent('CAPTURE_FAILED')).toBe(true);
    expect(isErrorEvent('UPLOAD_FAILED')).toBe(true);
  });

  it('should not identify non-error events', () => {
    expect(isErrorEvent('START_REQUESTED')).toBe(false);
    expect(isErrorEvent('UPLOAD_COMPLETE')).toBe(false);
    expect(isErrorEvent('FORCE_RESET')).toBe(false);
    expect(isErrorEvent('STREAM_ENDED')).toBe(false); // External stop is not an error
  });
});

describe('transition table completeness', () => {
  it('should have all error paths lead to IDLE', () => {
    const errorEvents: SessionEventType[] = [
      'PERMISSION_DENIED',
      'CAPTURE_FAILED',
      'UPLOAD_FAILED',
    ];

    for (const state of Object.keys(TRANSITION_TABLE) as SessionState[]) {
      for (const event of errorEvents) {
        const nextState = getNextState(state, event);
        if (nextState !== null) {
          expect(nextState).toBe('IDLE');
        }
      }
    }
  });

  it('should have FORCE_RESET lead to IDLE from all states', () => {
    for (const state of Object.keys(TRANSITION_TABLE) as SessionState[]) {
      expect(getNextState(state, 'FORCE_RESET')).toBe('IDLE');
    }
  });

  it('should have no dead-end states (every non-IDLE state has path to IDLE)', () => {
    const allStates: SessionState[] = [
      'IDLE',
      'REQUESTING_PERMISSION',
      'STARTING',
      'RECORDING',
      'STOPPING',
      'UPLOADING',
    ];

    for (const state of allStates) {
      if (state === 'IDLE') continue;

      const transitions = TRANSITION_TABLE[state];
      const hasPathToIdle = Object.values(transitions).includes('IDLE');

      expect(hasPathToIdle).toBe(true);
    }
  });
});
