/**
 * FSM Watchdog Tests
 * Tests for watchdog timer, state validation, and message freshness.
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockInstance } from 'vitest';

// We need to mock the executor module before importing watchdog
vi.mock('../executor', () => ({
  getState: vi.fn(() => 'IDLE'),
  getSessionId: vi.fn(() => null),
  transition: vi.fn().mockResolvedValue(undefined),
  setStateChangeCallback: vi.fn(),
}));

import {
  startWatchdog,
  stopWatchdog,
  resetWatchdog,
  validateStateOnWake,
  isMessageFresh,
  hasOffscreenDocument,
  initWatchdog,
} from '../watchdog';

import { getState, getSessionId, transition, setStateChangeCallback } from '../executor';
import type { SessionState } from '../types';

// Mock chrome.runtime.getContexts
const mockGetContexts = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();

  // Reset mocks
  vi.mocked(getState).mockReturnValue('IDLE');
  vi.mocked(getSessionId).mockReturnValue(null);
  vi.mocked(transition).mockResolvedValue(undefined);

  // Mock chrome.runtime
  vi.stubGlobal('chrome', {
    runtime: {
      getContexts: mockGetContexts,
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      ContextType: {
        OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT',
      },
    },
  });

  // Default: no offscreen document
  mockGetContexts.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  stopWatchdog();
});

describe('Watchdog Timer', () => {
  describe('startWatchdog', () => {
    it('should not start timer for IDLE state', () => {
      startWatchdog('IDLE');

      // Advance time way past any timeout
      vi.advanceTimersByTime(120_000);

      // Should not have called transition
      expect(transition).not.toHaveBeenCalled();
    });

    it('should start 60s timer for REQUESTING_PERMISSION', () => {
      vi.mocked(getState).mockReturnValue('REQUESTING_PERMISSION');
      startWatchdog('REQUESTING_PERMISSION');

      // Just before timeout
      vi.advanceTimersByTime(59_999);
      expect(transition).not.toHaveBeenCalled();

      // At timeout
      vi.advanceTimersByTime(1);
      expect(transition).toHaveBeenCalledWith(
        { type: 'PERMISSION_DENIED' },
        expect.stringContaining('Watchdog timeout')
      );
    });

    it('should start 30s timer for STARTING', () => {
      vi.mocked(getState).mockReturnValue('STARTING');
      startWatchdog('STARTING');

      vi.advanceTimersByTime(30_000);

      expect(transition).toHaveBeenCalledWith(
        { type: 'CAPTURE_FAILED' },
        expect.stringContaining('STARTING')
      );
    });

    it('should start 30min timer for RECORDING', () => {
      vi.mocked(getState).mockReturnValue('RECORDING');
      startWatchdog('RECORDING');

      // Just before 30 minutes
      vi.advanceTimersByTime(30 * 60 * 1000 - 1);
      expect(transition).not.toHaveBeenCalled();

      // At 30 minutes
      vi.advanceTimersByTime(1);
      expect(transition).toHaveBeenCalledWith(
        { type: 'STOP_REQUESTED' },
        expect.stringContaining('RECORDING')
      );
    });

    it('should start 30min timer for PAUSED', () => {
      vi.mocked(getState).mockReturnValue('PAUSED');
      startWatchdog('PAUSED');

      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(transition).toHaveBeenCalledWith(
        { type: 'STOP_REQUESTED' },
        expect.stringContaining('PAUSED')
      );
    });

    it('should start 30s timer for STOPPING', () => {
      vi.mocked(getState).mockReturnValue('STOPPING');
      startWatchdog('STOPPING');

      vi.advanceTimersByTime(30_000);

      expect(transition).toHaveBeenCalledWith(
        { type: 'CAPTURE_FAILED' },
        expect.stringContaining('STOPPING')
      );
    });

    it('should start 2min timer for UPLOADING', () => {
      vi.mocked(getState).mockReturnValue('UPLOADING');
      startWatchdog('UPLOADING');

      vi.advanceTimersByTime(120_000);

      expect(transition).toHaveBeenCalledWith(
        { type: 'UPLOAD_FAILED' },
        expect.stringContaining('UPLOADING')
      );
    });
  });

  describe('stopWatchdog', () => {
    it('should cancel pending timer', () => {
      vi.mocked(getState).mockReturnValue('STARTING');
      startWatchdog('STARTING');

      // Stop before timeout
      stopWatchdog();

      // Advance past timeout
      vi.advanceTimersByTime(60_000);

      expect(transition).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      stopWatchdog();
      stopWatchdog();
      stopWatchdog();
      // No error thrown
    });
  });

  describe('resetWatchdog', () => {
    it('should stop current timer and start new one', () => {
      vi.mocked(getState).mockReturnValue('STARTING');
      startWatchdog('STARTING');

      // Advance partially
      vi.advanceTimersByTime(15_000);

      // Reset to RECORDING
      vi.mocked(getState).mockReturnValue('RECORDING');
      resetWatchdog('RECORDING');

      // Advance another 15s (would have triggered STARTING timeout)
      vi.advanceTimersByTime(15_000);
      expect(transition).not.toHaveBeenCalled();

      // Advance to full RECORDING timeout (30 min)
      vi.advanceTimersByTime(30 * 60 * 1000 - 15_000);
      expect(transition).toHaveBeenCalledWith(
        { type: 'STOP_REQUESTED' },
        expect.any(String)
      );
    });
  });

  describe('timeout state verification', () => {
    it('should ignore timeout if state changed', () => {
      vi.mocked(getState).mockReturnValue('STARTING');
      startWatchdog('STARTING');

      // State changes before timeout
      vi.mocked(getState).mockReturnValue('RECORDING');

      // Timeout fires but state is different
      vi.advanceTimersByTime(30_000);

      // Should NOT have called transition because state changed
      expect(transition).not.toHaveBeenCalled();
    });
  });

  describe('timeout error handling', () => {
    it('should attempt FORCE_RESET if transition fails', async () => {
      vi.mocked(getState).mockReturnValue('STARTING');
      vi.mocked(transition)
        .mockRejectedValueOnce(new Error('First transition failed'))
        .mockResolvedValueOnce(undefined);

      startWatchdog('STARTING');

      // Advance to trigger timeout
      vi.advanceTimersByTime(30_000);

      // Wait for promises
      await vi.runAllTimersAsync();

      // Should have attempted FORCE_RESET
      expect(transition).toHaveBeenCalledWith(
        { type: 'FORCE_RESET' },
        expect.stringContaining('Watchdog recovery')
      );
    });
  });
});

describe('hasOffscreenDocument', () => {
  it('should return true when offscreen document exists', async () => {
    mockGetContexts.mockResolvedValue([{ documentUrl: 'chrome-extension://test-id/offscreen/index.html' }]);

    const result = await hasOffscreenDocument();

    expect(result).toBe(true);
    expect(mockGetContexts).toHaveBeenCalledWith({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: ['chrome-extension://test-id/offscreen/index.html'],
    });
  });

  it('should return false when no offscreen document', async () => {
    mockGetContexts.mockResolvedValue([]);

    const result = await hasOffscreenDocument();

    expect(result).toBe(false);
  });
});

describe('validateStateOnWake', () => {
  it('should do nothing for IDLE state', async () => {
    vi.mocked(getState).mockReturnValue('IDLE');

    await validateStateOnWake();

    expect(mockGetContexts).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it('should reset to IDLE if non-IDLE but no offscreen document', async () => {
    vi.mocked(getState).mockReturnValue('RECORDING');
    mockGetContexts.mockResolvedValue([]);

    await validateStateOnWake();

    expect(transition).toHaveBeenCalledWith(
      { type: 'FORCE_RESET' },
      expect.stringContaining('Orphaned state')
    );
  });

  it('should restart watchdog if state is valid and offscreen exists', async () => {
    vi.mocked(getState).mockReturnValue('RECORDING');
    mockGetContexts.mockResolvedValue([{ documentUrl: 'chrome-extension://test-id/offscreen/index.html' }]);

    await validateStateOnWake();

    // Should NOT have reset
    expect(transition).not.toHaveBeenCalledWith(
      { type: 'FORCE_RESET' },
      expect.any(String)
    );
  });

  it('should handle transition failure during self-healing', async () => {
    vi.mocked(getState).mockReturnValue('STOPPING');
    mockGetContexts.mockResolvedValue([]);
    vi.mocked(transition).mockRejectedValue(new Error('Transition failed'));

    // Should not throw
    await expect(validateStateOnWake()).resolves.not.toThrow();
  });
});

describe('isMessageFresh', () => {
  it('should return true for messages without sessionId', () => {
    vi.mocked(getSessionId).mockReturnValue('current-session');

    expect(isMessageFresh(undefined)).toBe(true);
  });

  it('should return true when sessionId matches', () => {
    vi.mocked(getSessionId).mockReturnValue('session-123');

    expect(isMessageFresh('session-123')).toBe(true);
  });

  it('should return false when sessionId does not match', () => {
    vi.mocked(getSessionId).mockReturnValue('current-session');

    expect(isMessageFresh('old-session')).toBe(false);
  });

  it('should return true when no current session', () => {
    vi.mocked(getSessionId).mockReturnValue(null);

    // Messages to an IDLE state (no session) should be processed
    expect(isMessageFresh('any-session')).toBe(false);
  });
});

describe('initWatchdog', () => {
  it('should set state change callback', () => {
    initWatchdog();

    expect(setStateChangeCallback).toHaveBeenCalledWith(expect.any(Function));
  });
});
