import { describe, it, expect } from 'vitest';
import { reduce } from '../reducer';
import { TRANSITION_TABLE } from '../transitions';
import type { SessionState, SessionEvent, SessionEventType } from '../types';

describe('recovery guarantees', () => {
  const allStates: SessionState[] = [
    'IDLE',
    'REQUESTING_PERMISSION',
    'STARTING',
    'RECORDING',
    'STOPPING',
    'UPLOADING',
  ];

  const failureEvents: SessionEventType[] = [
    'PERMISSION_DENIED',
    'CAPTURE_FAILED',
    'UPLOAD_FAILED',
  ];

  describe('all failure events lead to IDLE when valid', () => {
    for (const state of allStates) {
      for (const eventType of failureEvents) {
        const transitions = TRANSITION_TABLE[state];
        if (eventType in transitions) {
          it(`${state} + ${eventType} should lead to IDLE`, () => {
            const event: SessionEvent = { type: eventType };
            expect(reduce(state, event)).toBe('IDLE');
          });
        }
      }
    }
  });

  describe('FORCE_RESET always leads to IDLE', () => {
    for (const state of allStates) {
      it(`FORCE_RESET from ${state} should lead to IDLE`, () => {
        expect(reduce(state, { type: 'FORCE_RESET' })).toBe('IDLE');
      });
    }
  });

  describe('no dead-end states', () => {
    it('every non-IDLE state has at least one path to IDLE', () => {
      for (const state of allStates) {
        if (state === 'IDLE') continue;

        const transitions = TRANSITION_TABLE[state];
        const hasPathToIdle = Object.values(transitions).includes('IDLE');

        expect(hasPathToIdle).toBe(true);
      }
    });
  });

  describe('happy path reaches IDLE', () => {
    it('should complete full cycle: IDLE -> ... -> IDLE', () => {
      let state: SessionState = 'IDLE';

      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');

      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      expect(state).toBe('STARTING');

      state = reduce(state, { type: 'CAPTURE_STARTED' });
      expect(state).toBe('RECORDING');

      state = reduce(state, { type: 'STOP_REQUESTED' });
      expect(state).toBe('STOPPING');

      state = reduce(state, { type: 'CAPTURE_STOPPED' });
      expect(state).toBe('UPLOADING');

      state = reduce(state, { type: 'UPLOAD_COMPLETE' });
      expect(state).toBe('IDLE');
    });

    it('should complete external stop path: IDLE -> ... -> IDLE via STREAM_ENDED', () => {
      let state: SessionState = 'IDLE';

      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');

      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      expect(state).toBe('STARTING');

      state = reduce(state, { type: 'CAPTURE_STARTED' });
      expect(state).toBe('RECORDING');

      // User clicks "Stop sharing" in browser UI (external stop)
      state = reduce(state, { type: 'STREAM_ENDED' });
      expect(state).toBe('UPLOADING');

      state = reduce(state, { type: 'UPLOAD_COMPLETE' });
      expect(state).toBe('IDLE');
    });
  });

  describe('failure at any point recovers to IDLE', () => {
    it('should recover from REQUESTING_PERMISSION failure', () => {
      let state: SessionState = 'IDLE';
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');

      state = reduce(state, { type: 'PERMISSION_DENIED' });
      expect(state).toBe('IDLE');
    });

    it('should recover from STARTING failure', () => {
      let state: SessionState = 'IDLE';
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      expect(state).toBe('STARTING');

      state = reduce(state, { type: 'CAPTURE_FAILED' });
      expect(state).toBe('IDLE');
    });

    it('should recover from RECORDING failure (stream ended)', () => {
      let state: SessionState = 'IDLE';
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      state = reduce(state, { type: 'CAPTURE_STARTED' });
      expect(state).toBe('RECORDING');

      state = reduce(state, { type: 'CAPTURE_FAILED' });
      expect(state).toBe('IDLE');
    });

    it('should recover from STOPPING failure', () => {
      let state: SessionState = 'IDLE';
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      state = reduce(state, { type: 'CAPTURE_STARTED' });
      state = reduce(state, { type: 'STOP_REQUESTED' });
      expect(state).toBe('STOPPING');

      state = reduce(state, { type: 'CAPTURE_FAILED' });
      expect(state).toBe('IDLE');
    });

    it('should recover from UPLOADING failure', () => {
      let state: SessionState = 'IDLE';
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      state = reduce(state, { type: 'CAPTURE_STARTED' });
      state = reduce(state, { type: 'STOP_REQUESTED' });
      state = reduce(state, { type: 'CAPTURE_STOPPED' });
      expect(state).toBe('UPLOADING');

      state = reduce(state, { type: 'UPLOAD_FAILED' });
      expect(state).toBe('IDLE');
    });
  });

  describe('re-recording after failure', () => {
    it('should allow immediate re-recording after PERMISSION_DENIED', () => {
      let state: SessionState = 'IDLE';

      // First attempt - denied
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_DENIED' });
      expect(state).toBe('IDLE');

      // Second attempt - should work
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');
    });

    it('should allow immediate re-recording after CAPTURE_FAILED', () => {
      let state: SessionState = 'IDLE';

      // First attempt - failed during recording
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      state = reduce(state, { type: 'CAPTURE_STARTED' });
      state = reduce(state, { type: 'CAPTURE_FAILED' });
      expect(state).toBe('IDLE');

      // Second attempt - should work
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');
    });

    it('should allow immediate re-recording after UPLOAD_FAILED', () => {
      let state: SessionState = 'IDLE';

      // First attempt - upload failed
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      state = reduce(state, { type: 'CAPTURE_STARTED' });
      state = reduce(state, { type: 'STOP_REQUESTED' });
      state = reduce(state, { type: 'CAPTURE_STOPPED' });
      state = reduce(state, { type: 'UPLOAD_FAILED' });
      expect(state).toBe('IDLE');

      // Second attempt - should work
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');
    });

    it('should allow immediate re-recording after FORCE_RESET', () => {
      let state: SessionState = 'IDLE';

      // Started recording, then force reset
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      state = reduce(state, { type: 'CAPTURE_STARTED' });
      expect(state).toBe('RECORDING');

      state = reduce(state, { type: 'FORCE_RESET' });
      expect(state).toBe('IDLE');

      // Should be able to start again
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');
    });

    it('should allow immediate re-recording after external stop (STREAM_ENDED)', () => {
      let state: SessionState = 'IDLE';

      // First attempt - user clicks "Stop sharing"
      state = reduce(state, { type: 'START_REQUESTED' });
      state = reduce(state, { type: 'PERMISSION_GRANTED' });
      state = reduce(state, { type: 'CAPTURE_STARTED' });
      state = reduce(state, { type: 'STREAM_ENDED' });
      expect(state).toBe('UPLOADING');

      state = reduce(state, { type: 'UPLOAD_COMPLETE' });
      expect(state).toBe('IDLE');

      // Second attempt - should work
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');
    });
  });

  describe('duplicate event handling', () => {
    it('should handle duplicate STOP_REQUESTED gracefully', () => {
      let state: SessionState = 'RECORDING';

      // First stop
      state = reduce(state, { type: 'STOP_REQUESTED' });
      expect(state).toBe('STOPPING');

      // Duplicate stop - should be ignored (invalid transition)
      state = reduce(state, { type: 'STOP_REQUESTED' });
      expect(state).toBe('STOPPING'); // State unchanged
    });

    it('should handle duplicate START_REQUESTED gracefully', () => {
      let state: SessionState = 'IDLE';

      // First start
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION');

      // Duplicate start - should be ignored
      state = reduce(state, { type: 'START_REQUESTED' });
      expect(state).toBe('REQUESTING_PERMISSION'); // State unchanged
    });

    it('should handle multiple FORCE_RESET gracefully', () => {
      let state: SessionState = 'RECORDING';

      // Multiple resets
      state = reduce(state, { type: 'FORCE_RESET' });
      expect(state).toBe('IDLE');

      state = reduce(state, { type: 'FORCE_RESET' });
      expect(state).toBe('IDLE'); // Still IDLE

      state = reduce(state, { type: 'FORCE_RESET' });
      expect(state).toBe('IDLE'); // Still IDLE
    });
  });

  describe('state machine invariants', () => {
    it('should never have undefined next state for valid transitions', () => {
      for (const state of allStates) {
        const transitions = TRANSITION_TABLE[state];
        for (const eventType of Object.keys(transitions) as SessionEventType[]) {
          const nextState = reduce(state, { type: eventType } as SessionEvent);
          expect(nextState).toBeDefined();
          expect(allStates).toContain(nextState);
        }
      }
    });

    it('should always return a valid SessionState', () => {
      const allEvents: SessionEvent[] = [
        { type: 'START_REQUESTED' },
        { type: 'PERMISSION_GRANTED' },
        { type: 'PERMISSION_DENIED' },
        { type: 'CAPTURE_STARTED' },
        { type: 'CAPTURE_FAILED' },
        { type: 'STOP_REQUESTED' },
        { type: 'CAPTURE_STOPPED' },
        { type: 'STREAM_ENDED' },
        { type: 'UPLOAD_COMPLETE' },
        { type: 'UPLOAD_FAILED' },
        { type: 'FORCE_RESET' },
      ];

      for (const state of allStates) {
        for (const event of allEvents) {
          const nextState = reduce(state, event);
          expect(allStates).toContain(nextState);
        }
      }
    });
  });
});
