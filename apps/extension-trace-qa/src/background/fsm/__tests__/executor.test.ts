/**
 * FSM Executor Tests
 * Tests for transition(), restoreFromStorage(), updateContext(), and callbacks.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
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
} from '../executor';
import type { SessionState, SessionEvent } from '../types';

// Chrome storage mock data
let mockStorage: Record<string, unknown> = {};

// Setup Chrome API mocks before tests
beforeEach(() => {
  // Reset storage
  mockStorage = {};

  // Mock chrome.storage.local
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn((keys: string[]) => {
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in mockStorage) {
              result[key] = mockStorage[key];
            }
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((items: Record<string, unknown>) => {
          Object.assign(mockStorage, items);
          return Promise.resolve();
        }),
        remove: vi.fn((keys: string[]) => {
          for (const key of keys) {
            delete mockStorage[key];
          }
          return Promise.resolve();
        }),
      },
    },
  });

  // Reset FSM context to IDLE
  resetContext();

  // Clear any callbacks
  setTerminalCallback(async () => {});
  setStateChangeCallback(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('FSM Executor', () => {
  describe('getState / getSessionId / getContext', () => {
    it('should return IDLE as initial state', () => {
      expect(getState()).toBe('IDLE');
    });

    it('should return null as initial sessionId', () => {
      expect(getSessionId()).toBe(null);
    });

    it('should return full context with initial values', () => {
      const ctx = getContext();
      expect(ctx).toEqual({
        state: 'IDLE',
        sessionId: null,
        recordingStartTime: null,
        lastTransition: null,
        pauseStartTime: null,
        totalPausedTime: 0,
      });
    });

    it('getContext should return a copy (immutable)', () => {
      const ctx1 = getContext();
      const ctx2 = getContext();
      expect(ctx1).not.toBe(ctx2);
      expect(ctx1).toEqual(ctx2);
    });
  });

  describe('updateContext', () => {
    it('should update sessionId', () => {
      updateContext({ sessionId: 'test-session-123' });
      expect(getSessionId()).toBe('test-session-123');
    });

    it('should update recordingStartTime', () => {
      const now = Date.now();
      updateContext({ recordingStartTime: now });
      expect(getContext().recordingStartTime).toBe(now);
    });

    it('should update pauseStartTime', () => {
      const now = Date.now();
      updateContext({ pauseStartTime: now });
      expect(getContext().pauseStartTime).toBe(now);
    });

    it('should update totalPausedTime', () => {
      updateContext({ totalPausedTime: 5000 });
      expect(getContext().totalPausedTime).toBe(5000);
    });

    it('should update multiple fields at once', () => {
      const now = Date.now();
      updateContext({
        sessionId: 'session-abc',
        recordingStartTime: now,
        totalPausedTime: 1000,
      });

      const ctx = getContext();
      expect(ctx.sessionId).toBe('session-abc');
      expect(ctx.recordingStartTime).toBe(now);
      expect(ctx.totalPausedTime).toBe(1000);
    });

    it('should preserve other fields when updating', () => {
      updateContext({ sessionId: 'first-session' });
      updateContext({ recordingStartTime: 12345 });

      const ctx = getContext();
      expect(ctx.sessionId).toBe('first-session');
      expect(ctx.recordingStartTime).toBe(12345);
    });
  });

  describe('resetContext', () => {
    it('should reset all fields to initial values', () => {
      // First, modify context
      updateContext({
        sessionId: 'some-session',
        recordingStartTime: Date.now(),
        pauseStartTime: Date.now(),
        totalPausedTime: 5000,
      });

      // Reset
      resetContext();

      // Verify all reset
      const ctx = getContext();
      expect(ctx).toEqual({
        state: 'IDLE',
        sessionId: null,
        recordingStartTime: null,
        lastTransition: null,
        pauseStartTime: null,
        totalPausedTime: 0,
      });
    });
  });

  describe('transition', () => {
    it('should transition from IDLE to REQUESTING_PERMISSION', async () => {
      await transition({ type: 'START_REQUESTED' }, 'User clicked record');

      expect(getState()).toBe('REQUESTING_PERMISSION');
    });

    it('should transition from REQUESTING_PERMISSION to STARTING', async () => {
      await transition({ type: 'START_REQUESTED' }, 'User clicked record');
      await transition({ type: 'PERMISSION_GRANTED' }, 'User granted permission');

      expect(getState()).toBe('STARTING');
    });

    it('should transition from STARTING to RECORDING', async () => {
      await transition({ type: 'START_REQUESTED' }, 'User clicked record');
      await transition({ type: 'PERMISSION_GRANTED' }, 'User granted permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'MediaRecorder started');

      expect(getState()).toBe('RECORDING');
    });

    it('should transition from RECORDING to PAUSED', async () => {
      // Setup: get to RECORDING
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');

      // Test: pause
      await transition({ type: 'PAUSE_REQUESTED' }, 'User paused');

      expect(getState()).toBe('PAUSED');
    });

    it('should transition from PAUSED to RECORDING', async () => {
      // Setup: get to PAUSED
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'PAUSE_REQUESTED' }, 'Pause');

      // Test: resume
      await transition({ type: 'RESUME_REQUESTED' }, 'User resumed');

      expect(getState()).toBe('RECORDING');
    });

    it('should transition from RECORDING to STOPPING', async () => {
      // Setup: get to RECORDING
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');

      // Test: stop
      await transition({ type: 'STOP_REQUESTED' }, 'User stopped');

      expect(getState()).toBe('STOPPING');
    });

    it('should transition from STOPPING to UPLOADING', async () => {
      // Setup: get to STOPPING
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'STOP_REQUESTED' }, 'Stop');

      // Test: capture stopped
      await transition({ type: 'CAPTURE_STOPPED' }, 'Video saved');

      expect(getState()).toBe('UPLOADING');
    });

    it('should transition from UPLOADING to IDLE', async () => {
      // Setup: get to UPLOADING
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'STOP_REQUESTED' }, 'Stop');
      await transition({ type: 'CAPTURE_STOPPED' }, 'Stopped');

      // Test: upload complete
      await transition({ type: 'UPLOAD_COMPLETE' }, 'Upload done');

      expect(getState()).toBe('IDLE');
    });

    it('should reject invalid transitions silently', async () => {
      // From IDLE, STOP_REQUESTED is invalid
      await transition({ type: 'STOP_REQUESTED' }, 'Invalid stop from idle');

      // Should still be IDLE
      expect(getState()).toBe('IDLE');
    });

    it('should handle PERMISSION_DENIED from REQUESTING_PERMISSION', async () => {
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_DENIED' }, 'User denied');

      expect(getState()).toBe('IDLE');
    });

    it('should handle CAPTURE_FAILED from STARTING', async () => {
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_FAILED' }, 'MediaRecorder failed');

      expect(getState()).toBe('IDLE');
    });

    it('should handle FORCE_RESET from any state', async () => {
      // Get to RECORDING
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');

      // Force reset
      await transition({ type: 'FORCE_RESET' }, 'Emergency reset');

      expect(getState()).toBe('IDLE');
    });

    it('should persist state to chrome.storage.local', async () => {
      await transition({ type: 'START_REQUESTED' }, 'Start');

      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(mockStorage.sessionState).toBe('REQUESTING_PERMISSION');
    });

    it('should store lastTransition with full context', async () => {
      await transition({ type: 'START_REQUESTED' }, 'User initiated');

      const ctx = getContext();
      expect(ctx.lastTransition).toBeDefined();
      expect(ctx.lastTransition?.from).toBe('IDLE');
      expect(ctx.lastTransition?.to).toBe('REQUESTING_PERMISSION');
      expect(ctx.lastTransition?.event).toBe('START_REQUESTED');
      expect(ctx.lastTransition?.reason).toBe('User initiated');
      expect(ctx.lastTransition?.timestamp).toBeGreaterThan(0);
    });
  });

  describe('callbacks', () => {
    it('should call onStateChange callback after transition', async () => {
      const stateChangeSpy = vi.fn();
      setStateChangeCallback(stateChangeSpy);

      await transition({ type: 'START_REQUESTED' }, 'Test');

      expect(stateChangeSpy).toHaveBeenCalledWith('REQUESTING_PERMISSION');
    });

    it('should call terminal callback when transitioning to IDLE', async () => {
      const terminalSpy = vi.fn().mockResolvedValue(undefined);
      setTerminalCallback(terminalSpy);

      // Full cycle to IDLE
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'STOP_REQUESTED' }, 'Stop');
      await transition({ type: 'CAPTURE_STOPPED' }, 'Stopped');
      await transition({ type: 'UPLOAD_COMPLETE' }, 'Upload done');

      expect(terminalSpy).toHaveBeenCalled();
    });

    it('should pass error reason to terminal callback on error events', async () => {
      const terminalSpy = vi.fn().mockResolvedValue(undefined);
      setTerminalCallback(terminalSpy);

      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_DENIED' }, 'User denied access');

      expect(terminalSpy).toHaveBeenCalledWith('User denied access');
    });

    it('should not pass error for normal completion', async () => {
      const terminalSpy = vi.fn().mockResolvedValue(undefined);
      setTerminalCallback(terminalSpy);

      // Full successful cycle
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'STOP_REQUESTED' }, 'Stop');
      await transition({ type: 'CAPTURE_STOPPED' }, 'Stopped');
      await transition({ type: 'UPLOAD_COMPLETE' }, 'Done');

      expect(terminalSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('restoreFromStorage', () => {
    it('should restore state from storage', async () => {
      mockStorage = {
        sessionState: 'RECORDING',
        sessionId: 'restored-session',
        startTime: 1234567890,
      };

      await restoreFromStorage();

      expect(getState()).toBe('RECORDING');
      expect(getSessionId()).toBe('restored-session');
      expect(getContext().recordingStartTime).toBe(1234567890);
    });

    it('should default to IDLE if no state in storage', async () => {
      mockStorage = {};

      await restoreFromStorage();

      expect(getState()).toBe('IDLE');
    });

    it('should restore pause timing', async () => {
      mockStorage = {
        sessionState: 'PAUSED',
        fsmPauseStartTime: 1000000,
        fsmTotalPausedTime: 5000,
      };

      await restoreFromStorage();

      const ctx = getContext();
      expect(ctx.pauseStartTime).toBe(1000000);
      expect(ctx.totalPausedTime).toBe(5000);
    });

    it('should restore lastTransition', async () => {
      const lastTransition = {
        from: 'RECORDING' as SessionState,
        to: 'PAUSED' as SessionState,
        event: 'PAUSE_REQUESTED',
        reason: 'Test pause',
        timestamp: 1234567890,
      };

      mockStorage = {
        sessionState: 'PAUSED',
        fsmLastTransition: lastTransition,
      };

      await restoreFromStorage();

      expect(getContext().lastTransition).toEqual(lastTransition);
    });
  });

  describe('forceState', () => {
    it('should force state without validation', async () => {
      // Start in IDLE, force to RECORDING (normally invalid)
      await forceState('RECORDING');

      expect(getState()).toBe('RECORDING');
    });

    it('should persist forced state to storage', async () => {
      await forceState('UPLOADING');

      expect(mockStorage.sessionState).toBe('UPLOADING');
    });

    it('should record the force as lastTransition', async () => {
      await forceState('STOPPING');

      const ctx = getContext();
      expect(ctx.lastTransition?.event).toBe('FORCE_RESET');
      expect(ctx.lastTransition?.reason).toBe('Forced state recovery');
    });

    it('should call stateChange callback', async () => {
      const stateChangeSpy = vi.fn();
      setStateChangeCallback(stateChangeSpy);

      await forceState('PAUSED');

      expect(stateChangeSpy).toHaveBeenCalledWith('PAUSED');
    });
  });

  describe('complete recording flows', () => {
    it('should handle full successful recording flow', async () => {
      const states: SessionState[] = [];
      setStateChangeCallback((s) => states.push(s));

      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'STOP_REQUESTED' }, 'Stop');
      await transition({ type: 'CAPTURE_STOPPED' }, 'Stopped');
      await transition({ type: 'UPLOAD_COMPLETE' }, 'Done');

      expect(states).toEqual([
        'REQUESTING_PERMISSION',
        'STARTING',
        'RECORDING',
        'STOPPING',
        'UPLOADING',
        'IDLE',
      ]);
    });

    it('should handle recording with pause/resume', async () => {
      const states: SessionState[] = [];
      setStateChangeCallback((s) => states.push(s));

      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'PAUSE_REQUESTED' }, 'Pause');
      await transition({ type: 'RESUME_REQUESTED' }, 'Resume');
      await transition({ type: 'STOP_REQUESTED' }, 'Stop');
      await transition({ type: 'CAPTURE_STOPPED' }, 'Stopped');
      await transition({ type: 'UPLOAD_COMPLETE' }, 'Done');

      expect(states).toEqual([
        'REQUESTING_PERMISSION',
        'STARTING',
        'RECORDING',
        'PAUSED',
        'RECORDING',
        'STOPPING',
        'UPLOADING',
        'IDLE',
      ]);
    });

    it('should handle permission denied flow', async () => {
      const terminalSpy = vi.fn().mockResolvedValue(undefined);
      setTerminalCallback(terminalSpy);

      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_DENIED' }, 'User said no');

      expect(getState()).toBe('IDLE');
      expect(terminalSpy).toHaveBeenCalledWith('User said no');
    });

    it('should handle external stop (user clicks stop sharing)', async () => {
      await transition({ type: 'START_REQUESTED' }, 'Start');
      await transition({ type: 'PERMISSION_GRANTED' }, 'Permission');
      await transition({ type: 'CAPTURE_STARTED' }, 'Capture');
      await transition({ type: 'STREAM_ENDED' }, 'User stopped sharing');

      expect(getState()).toBe('UPLOADING');
    });
  });
});
