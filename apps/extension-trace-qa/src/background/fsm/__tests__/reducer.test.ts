import { describe, it, expect } from 'vitest';
import { reduce, reduceStrict } from '../reducer';
import type { SessionState, SessionEvent } from '../types';

describe('reduce (pure function)', () => {
  describe('happy path transitions', () => {
    it('should transition IDLE -> REQUESTING_PERMISSION on START_REQUESTED', () => {
      expect(reduce('IDLE', { type: 'START_REQUESTED' })).toBe('REQUESTING_PERMISSION');
    });

    it('should transition REQUESTING_PERMISSION -> STARTING on PERMISSION_GRANTED', () => {
      expect(reduce('REQUESTING_PERMISSION', { type: 'PERMISSION_GRANTED' })).toBe('STARTING');
    });

    it('should transition STARTING -> RECORDING on CAPTURE_STARTED', () => {
      expect(reduce('STARTING', { type: 'CAPTURE_STARTED' })).toBe('RECORDING');
    });

    it('should transition RECORDING -> STOPPING on STOP_REQUESTED', () => {
      expect(reduce('RECORDING', { type: 'STOP_REQUESTED' })).toBe('STOPPING');
    });

    it('should transition RECORDING -> UPLOADING on STREAM_ENDED (external stop)', () => {
      expect(reduce('RECORDING', { type: 'STREAM_ENDED' })).toBe('UPLOADING');
    });

    it('should transition STOPPING -> UPLOADING on CAPTURE_STOPPED', () => {
      expect(reduce('STOPPING', { type: 'CAPTURE_STOPPED' })).toBe('UPLOADING');
    });

    it('should transition UPLOADING -> IDLE on UPLOAD_COMPLETE', () => {
      expect(reduce('UPLOADING', { type: 'UPLOAD_COMPLETE' })).toBe('IDLE');
    });
  });

  describe('pause/resume transitions', () => {
    it('should transition RECORDING -> PAUSED on PAUSE_REQUESTED', () => {
      expect(reduce('RECORDING', { type: 'PAUSE_REQUESTED' })).toBe('PAUSED');
    });

    it('should transition PAUSED -> RECORDING on RESUME_REQUESTED', () => {
      expect(reduce('PAUSED', { type: 'RESUME_REQUESTED' })).toBe('RECORDING');
    });

    it('should transition PAUSED -> STOPPING on STOP_REQUESTED', () => {
      expect(reduce('PAUSED', { type: 'STOP_REQUESTED' })).toBe('STOPPING');
    });

    it('should transition PAUSED -> UPLOADING on STREAM_ENDED (external stop)', () => {
      expect(reduce('PAUSED', { type: 'STREAM_ENDED' })).toBe('UPLOADING');
    });
  });

  describe('error path transitions (all lead to IDLE)', () => {
    it('should transition REQUESTING_PERMISSION -> IDLE on PERMISSION_DENIED', () => {
      expect(reduce('REQUESTING_PERMISSION', { type: 'PERMISSION_DENIED' })).toBe('IDLE');
    });

    it('should transition STARTING -> IDLE on CAPTURE_FAILED', () => {
      expect(reduce('STARTING', { type: 'CAPTURE_FAILED' })).toBe('IDLE');
    });

    it('should transition RECORDING -> IDLE on CAPTURE_FAILED', () => {
      expect(reduce('RECORDING', { type: 'CAPTURE_FAILED' })).toBe('IDLE');
    });

    it('should transition STOPPING -> IDLE on CAPTURE_FAILED', () => {
      expect(reduce('STOPPING', { type: 'CAPTURE_FAILED' })).toBe('IDLE');
    });

    it('should transition UPLOADING -> IDLE on UPLOAD_FAILED', () => {
      expect(reduce('UPLOADING', { type: 'UPLOAD_FAILED' })).toBe('IDLE');
    });

    it('should transition PAUSED -> IDLE on CAPTURE_FAILED', () => {
      expect(reduce('PAUSED', { type: 'CAPTURE_FAILED' })).toBe('IDLE');
    });
  });

  describe('FORCE_RESET transitions (all lead to IDLE)', () => {
    const allStates: SessionState[] = [
      'IDLE',
      'REQUESTING_PERMISSION',
      'STARTING',
      'RECORDING',
      'PAUSED',
      'STOPPING',
      'UPLOADING',
    ];

    it.each(allStates)('should transition %s -> IDLE on FORCE_RESET', (state) => {
      expect(reduce(state, { type: 'FORCE_RESET' })).toBe('IDLE');
    });
  });

  describe('invalid transitions (return current state)', () => {
    it('should return IDLE for IDLE + CAPTURE_STARTED', () => {
      expect(reduce('IDLE', { type: 'CAPTURE_STARTED' })).toBe('IDLE');
    });

    it('should return IDLE for IDLE + STOP_REQUESTED', () => {
      expect(reduce('IDLE', { type: 'STOP_REQUESTED' })).toBe('IDLE');
    });

    it('should return RECORDING for RECORDING + START_REQUESTED', () => {
      expect(reduce('RECORDING', { type: 'START_REQUESTED' })).toBe('RECORDING');
    });

    it('should return RECORDING for RECORDING + CAPTURE_STARTED', () => {
      expect(reduce('RECORDING', { type: 'CAPTURE_STARTED' })).toBe('RECORDING');
    });

    it('should return UPLOADING for UPLOADING + STOP_REQUESTED', () => {
      expect(reduce('UPLOADING', { type: 'STOP_REQUESTED' })).toBe('UPLOADING');
    });

    it('should return STOPPING for STOPPING + START_REQUESTED', () => {
      expect(reduce('STOPPING', { type: 'START_REQUESTED' })).toBe('STOPPING');
    });

    it('should return IDLE for IDLE + STREAM_ENDED (only valid from RECORDING)', () => {
      expect(reduce('IDLE', { type: 'STREAM_ENDED' })).toBe('IDLE');
    });

    it('should return STOPPING for STOPPING + STREAM_ENDED (only valid from RECORDING/PAUSED)', () => {
      expect(reduce('STOPPING', { type: 'STREAM_ENDED' })).toBe('STOPPING');
    });

    // Pause/resume invalid transitions
    it('should return PAUSED for PAUSED + PAUSE_REQUESTED (already paused)', () => {
      expect(reduce('PAUSED', { type: 'PAUSE_REQUESTED' })).toBe('PAUSED');
    });

    it('should return RECORDING for RECORDING + RESUME_REQUESTED (already recording)', () => {
      expect(reduce('RECORDING', { type: 'RESUME_REQUESTED' })).toBe('RECORDING');
    });

    it('should return IDLE for IDLE + PAUSE_REQUESTED', () => {
      expect(reduce('IDLE', { type: 'PAUSE_REQUESTED' })).toBe('IDLE');
    });

    it('should return IDLE for IDLE + RESUME_REQUESTED', () => {
      expect(reduce('IDLE', { type: 'RESUME_REQUESTED' })).toBe('IDLE');
    });

    it('should return STOPPING for STOPPING + PAUSE_REQUESTED', () => {
      expect(reduce('STOPPING', { type: 'PAUSE_REQUESTED' })).toBe('STOPPING');
    });

    it('should return UPLOADING for UPLOADING + RESUME_REQUESTED', () => {
      expect(reduce('UPLOADING', { type: 'RESUME_REQUESTED' })).toBe('UPLOADING');
    });
  });

  describe('purity', () => {
    it('should return the same result for the same inputs', () => {
      const state: SessionState = 'IDLE';
      const event: SessionEvent = { type: 'START_REQUESTED' };

      const result1 = reduce(state, event);
      const result2 = reduce(state, event);
      const result3 = reduce(state, event);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should not mutate the event object', () => {
      const event: SessionEvent = { type: 'START_REQUESTED' };
      const eventCopy = { ...event };

      reduce('IDLE', event);

      expect(event).toEqual(eventCopy);
    });

    it('should be deterministic across multiple calls', () => {
      const states: SessionState[] = ['IDLE', 'RECORDING', 'STOPPING'];
      const events: SessionEvent[] = [
        { type: 'START_REQUESTED' },
        { type: 'STOP_REQUESTED' },
        { type: 'CAPTURE_STOPPED' },
      ];

      for (const state of states) {
        for (const event of events) {
          const result1 = reduce(state, event);
          const result2 = reduce(state, event);
          expect(result1).toBe(result2);
        }
      }
    });
  });
});

describe('reduceStrict', () => {
  it('should throw on invalid transitions', () => {
    expect(() => reduceStrict('IDLE', { type: 'CAPTURE_STARTED' })).toThrow(
      'Invalid state transition'
    );
  });

  it('should throw with descriptive error message', () => {
    expect(() => reduceStrict('RECORDING', { type: 'START_REQUESTED' })).toThrow(
      /RECORDING \+ START_REQUESTED/
    );
  });

  it('should work for valid transitions', () => {
    expect(reduceStrict('IDLE', { type: 'START_REQUESTED' })).toBe('REQUESTING_PERMISSION');
  });

  it('should work for error transitions', () => {
    expect(reduceStrict('RECORDING', { type: 'CAPTURE_FAILED' })).toBe('IDLE');
  });

  it('should work for FORCE_RESET', () => {
    expect(reduceStrict('STOPPING', { type: 'FORCE_RESET' })).toBe('IDLE');
  });

  it('should work for pause/resume transitions', () => {
    expect(reduceStrict('RECORDING', { type: 'PAUSE_REQUESTED' })).toBe('PAUSED');
    expect(reduceStrict('PAUSED', { type: 'RESUME_REQUESTED' })).toBe('RECORDING');
  });

  it('should throw for invalid pause from PAUSED', () => {
    expect(() => reduceStrict('PAUSED', { type: 'PAUSE_REQUESTED' })).toThrow(
      /PAUSED \+ PAUSE_REQUESTED/
    );
  });

  it('should throw for invalid resume from RECORDING', () => {
    expect(() => reduceStrict('RECORDING', { type: 'RESUME_REQUESTED' })).toThrow(
      /RECORDING \+ RESUME_REQUESTED/
    );
  });
});
