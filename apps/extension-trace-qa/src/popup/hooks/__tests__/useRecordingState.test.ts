/**
 * useRecordingState Hook Tests
 * Tests for popup recording state management, message listeners, and actions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecordingState } from '../useRecordingState';
import type { VideoRecordingConfig, UISessionEndedPayload, UIStateUpdatePayload } from '@shared/types';

// Mock chrome APIs
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockSendMessage = vi.fn();
const mockTabsQuery = vi.fn();
const mockOnMessageListeners: Array<(message: any, sender: any, sendResponse: any) => void> = [];

beforeEach(() => {
  vi.clearAllMocks();
  mockOnMessageListeners.length = 0;

  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: mockStorageGet.mockImplementation((_keys, callback) => {
          callback?.({});
          return Promise.resolve({});
        }),
        set: mockStorageSet.mockResolvedValue(undefined),
      },
    },
    runtime: {
      sendMessage: mockSendMessage,
      onMessage: {
        addListener: vi.fn((listener) => {
          mockOnMessageListeners.push(listener);
        }),
        removeListener: vi.fn((listener) => {
          const index = mockOnMessageListeners.indexOf(listener);
          if (index > -1) {
            mockOnMessageListeners.splice(index, 1);
          }
        }),
      },
    },
    tabs: {
      query: mockTabsQuery,
    },
  });

  // Mock Date for consistent sessionId generation
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-03T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to simulate incoming chrome.runtime messages
function simulateRuntimeMessage(message: any) {
  mockOnMessageListeners.forEach(listener => listener(message, {}, vi.fn()));
}

describe('useRecordingState', () => {
  describe('initialization', () => {
    it('should initialize with default state', () => {
      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({});
        return Promise.resolve({});
      });

      const { result } = renderHook(() => useRecordingState());

      expect(result.current.state).toEqual({
        isRecording: false,
        isPaused: false,
        duration: 0,
        sessionId: null,
        startTime: null,
        error: null,
        isLoading: false,
      });
    });

    it('should restore state from storage', async () => {
      // Use real timers for this test since waitFor depends on timers
      vi.useRealTimers();

      const savedState = {
        isRecording: true,
        sessionId: 'session-123',
        startTime: 1234567890,
      };

      mockStorageGet.mockImplementation((_keys, callback) => {
        // Immediately invoke callback to simulate synchronous behavior
        if (callback) {
          callback(savedState);
        }
        return Promise.resolve(savedState);
      });

      const { result } = renderHook(() => useRecordingState());

      // Wait for the useEffect to run and state to update
      await waitFor(() => {
        expect(result.current.state.isRecording).toBe(true);
      });

      expect(result.current.state.sessionId).toBe('session-123');
      expect(result.current.state.startTime).toBe(1234567890);

      // Restore fake timers for other tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-03T12:00:00.000Z'));
    });

    it('should restore video config from storage', async () => {
      const savedConfig: VideoRecordingConfig = {
        quality: 'HD',
        captureMode: 'DESKTOP',
        audioSource: 'NONE',
      };

      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({ videoConfig: savedConfig });
        return Promise.resolve({ videoConfig: savedConfig });
      });

      const { result } = renderHook(() => useRecordingState());

      await waitFor(() => {
        expect(result.current.videoConfig).toEqual(savedConfig);
      });
    });

    it('should use default video config if none in storage', () => {
      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({});
        return Promise.resolve({});
      });

      const { result } = renderHook(() => useRecordingState());

      expect(result.current.videoConfig).toEqual({
        quality: 'HD',
        captureMode: 'TAB',
        audioSource: 'MICROPHONE',
      });
    });
  });

  describe('message listeners', () => {
    it('should register message listener on mount', () => {
      renderHook(() => useRecordingState());

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(mockOnMessageListeners.length).toBe(1);
    });

    it('should unregister message listener on unmount', () => {
      const { unmount } = renderHook(() => useRecordingState());

      unmount();

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    });

    it('should handle UI_SESSION_ENDED with success', async () => {
      const { result } = renderHook(() => useRecordingState());

      // Set to recording state first
      act(() => {
        result.current.state.isRecording = true;
        result.current.state.sessionId = 'session-123';
      });

      // Simulate session ended message
      act(() => {
        const payload: UISessionEndedPayload = {
          sessionId: 'session-123',
          reason: 'completed',
        };
        simulateRuntimeMessage({ type: 'UI_SESSION_ENDED', payload });
      });

      await waitFor(() => {
        expect(result.current.state.isRecording).toBe(false);
        expect(result.current.state.sessionId).toBe(null);
        expect(result.current.state.error).toBe(null);
      });
    });

    it('should handle UI_SESSION_ENDED with error', async () => {
      const { result } = renderHook(() => useRecordingState());

      act(() => {
        const payload: UISessionEndedPayload = {
          sessionId: 'session-123',
          reason: 'error',
          error: 'Recording failed',
        };
        simulateRuntimeMessage({ type: 'UI_SESSION_ENDED', payload });
      });

      await waitFor(() => {
        expect(result.current.state.isRecording).toBe(false);
        expect(result.current.state.error).toBe('Recording failed');
      });
    });

    it('should handle UI_STATE_UPDATE for pause', async () => {
      const { result } = renderHook(() => useRecordingState());

      act(() => {
        const payload: UIStateUpdatePayload = {
          sessionId: 'session-123',
          sessionState: 'PAUSED',
          isPaused: true,
          duration: 15000,
        };
        simulateRuntimeMessage({ type: 'UI_STATE_UPDATE', payload });
      });

      await waitFor(() => {
        expect(result.current.state.isPaused).toBe(true);
        expect(result.current.state.duration).toBe(15000);
      });
    });

    it('should handle UI_STATE_UPDATE for resume', async () => {
      const { result } = renderHook(() => useRecordingState());

      // First pause
      act(() => {
        simulateRuntimeMessage({ 
          type: 'UI_STATE_UPDATE', 
          payload: { sessionId: 'session-123', sessionState: 'PAUSED', isPaused: true, duration: 10000 } 
        });
      });

      // Then resume
      act(() => {
        simulateRuntimeMessage({ 
          type: 'UI_STATE_UPDATE', 
          payload: { sessionId: 'session-123', sessionState: 'RECORDING', isPaused: false, duration: 10000 } 
        });
      });

      await waitFor(() => {
        expect(result.current.state.isPaused).toBe(false);
      });
    });

    it('should ignore unknown message types', async () => {
      const { result } = renderHook(() => useRecordingState());

      const initialState = { ...result.current.state };

      act(() => {
        simulateRuntimeMessage({ type: 'UNKNOWN_MESSAGE', payload: {} });
      });

      // State should remain unchanged
      expect(result.current.state).toEqual(initialState);
    });
  });

  describe('setVideoConfig', () => {
    it('should update video config', () => {
      const { result } = renderHook(() => useRecordingState());

      const newConfig: VideoRecordingConfig = {
        quality: 'HD',
        captureMode: 'DESKTOP',
        audioSource: 'NONE',
      };

      act(() => {
        result.current.setVideoConfig(newConfig);
      });

      expect(result.current.videoConfig).toEqual(newConfig);
    });

    it('should persist video config to storage', () => {
      const { result } = renderHook(() => useRecordingState());

      const newConfig: VideoRecordingConfig = {
        quality: 'HD',
        captureMode: 'TAB',
        audioSource: 'MICROPHONE',
      };

      act(() => {
        result.current.setVideoConfig(newConfig);
      });

      expect(mockStorageSet).toHaveBeenCalledWith({ videoConfig: newConfig });
    });
  });

  describe('startRecording', () => {
    it('should set loading state while starting', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 123 }]);
      mockSendMessage.mockResolvedValue({ success: true });

      // Mock waitForRecordingState polling
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'START_RECORDING') {
          return Promise.resolve({ success: true });
        }
        if (message.type === 'GET_RECORDING_STATUS') {
          return Promise.resolve({
            success: true,
            sessionState: 'RECORDING',
            sessionId: expect.any(String),
          });
        }
        return Promise.resolve({ success: false });
      });

      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({ startTime: Date.now() });
        return Promise.resolve({ startTime: Date.now() });
      });

      const { result } = renderHook(() => useRecordingState());

      let startPromise: Promise<void>;
      act(() => {
        startPromise = result.current.startRecording();
      });

      // Should be loading
      expect(result.current.state.isLoading).toBe(true);

      await act(async () => {
        await vi.runAllTimersAsync(); // Advance timers for polling
        await startPromise!;
      });

      // Should complete
      expect(result.current.state.isLoading).toBe(false);
    });

    it('should get active tab', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 456 }]);
      mockSendMessage.mockResolvedValue({ success: true });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_RECORDING_STATUS') {
          return Promise.resolve({
            success: true,
            sessionState: 'RECORDING',
            sessionId: expect.any(String),
          });
        }
        return Promise.resolve({ success: true });
      });

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        const promise = result.current.startRecording();
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(mockTabsQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
    });

    it('should generate session ID with timestamp', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 789 }]);
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'START_RECORDING') {
          // Be flexible with hour format (12-00 or 1-00 depending on timer state)
          expect(message.payload.sessionId).toMatch(/^session_[a-z0-9]+_feb_3_2026_1?\d-\d{2}_(am|pm)$/);
          return Promise.resolve({ success: true });
        }
        if (message.type === 'GET_RECORDING_STATUS') {
          return Promise.resolve({
            success: true,
            sessionState: 'RECORDING',
            sessionId: message.sessionId,
          });
        }
        return Promise.resolve({ success: true });
      });

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        const promise = result.current.startRecording();
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START_RECORDING',
          payload: expect.objectContaining({
            sessionId: expect.stringContaining('session_'),
          }),
        })
      );
    });

    it('should send START_RECORDING message with video config', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 123 }]);
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_RECORDING_STATUS') {
          return Promise.resolve({
            success: true,
            sessionState: 'RECORDING',
            sessionId: expect.any(String),
          });
        }
        return Promise.resolve({ success: true });
      });

      const customConfig: VideoRecordingConfig = {
        quality: 'HD',
        captureMode: 'WINDOW',
        audioSource: 'MICROPHONE',
      };

      const { result } = renderHook(() => useRecordingState());

      act(() => {
        result.current.setVideoConfig(customConfig);
      });

      await act(async () => {
        const promise = result.current.startRecording();
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START_RECORDING',
          payload: expect.objectContaining({
            videoConfig: customConfig,
          }),
        })
      );
    });

    it('should wait for RECORDING state', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 123 }]);

      let statusCallCount = 0;
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'START_RECORDING') {
          return Promise.resolve({ success: true });
        }
        if (message.type === 'GET_RECORDING_STATUS') {
          statusCallCount++;
          // Return REQUESTING_PERMISSION first, then RECORDING
          if (statusCallCount === 1) {
            return Promise.resolve({
              success: true,
              sessionState: 'REQUESTING_PERMISSION',
              sessionId: expect.any(String),
            });
          }
          return Promise.resolve({
            success: true,
            sessionState: 'RECORDING',
            sessionId: expect.any(String),
          });
        }
        return Promise.resolve({ success: false });
      });

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        const promise = result.current.startRecording();
        // Advance timer for the first poll that returns REQUESTING_PERMISSION
        await vi.advanceTimersByTimeAsync(1000);
        // Advance timer for the second poll that returns RECORDING
        await vi.advanceTimersByTimeAsync(1000);
        await promise;
      });

      // Should have polled at least twice
      expect(statusCallCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle user cancellation (IDLE state)', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 123 }]);
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'START_RECORDING') {
          return Promise.resolve({ success: true });
        }
        if (message.type === 'GET_RECORDING_STATUS') {
          // User cancelled - state went back to IDLE
          return Promise.resolve({
            success: true,
            sessionState: 'IDLE',
          });
        }
        return Promise.resolve({ success: false });
      });

      const { result } = renderHook(() => useRecordingState());

      // Start recording returns immediately since status check returns IDLE
      await act(async () => {
        const promise = result.current.startRecording();
        await vi.runAllTimersAsync(); // Let the polling setTimeout complete
        await promise;
      });

      expect(result.current.state.isRecording).toBe(false);
      expect(result.current.state.error).toBeTruthy();
    });

    it('should handle no active tab error', async () => {
      mockTabsQuery.mockResolvedValue([{}]); // No tab.id

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        try {
          await result.current.startRecording();
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.state.error).toBe('No active tab found');
      expect(result.current.state.isLoading).toBe(false);
    });

    it('should handle backend failure', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 123 }]);
      mockSendMessage.mockResolvedValue({ success: false, error: 'Backend error' });

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        try {
          await result.current.startRecording();
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.state.error).toBe('Backend error');
    });

    it('should update state on successful start', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 123 }]);
      const sessionId = 'session_abc_feb_3_2026_12-00_pm';
      const startTime = Date.now();

      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_RECORDING_STATUS') {
          return Promise.resolve({
            success: true,
            sessionState: 'RECORDING',
            sessionId: sessionId,
          });
        }
        return Promise.resolve({ success: true });
      });

      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({ startTime });
        return Promise.resolve({ startTime });
      });

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        const promise = result.current.startRecording();
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(result.current.state.isRecording).toBe(true);
      expect(result.current.state.sessionId).toBeTruthy();
      expect(result.current.state.startTime).toBe(startTime);
      expect(result.current.state.error).toBe(null);
    });
  });

  describe('stopRecording', () => {
    it('should set loading state while stopping', async () => {
      // Initialize with recording state via storage
      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({ isRecording: true, sessionId: 'session-123', startTime: Date.now() });
        return Promise.resolve({ isRecording: true, sessionId: 'session-123', startTime: Date.now() });
      });
      mockSendMessage.mockResolvedValue({ success: true });

      let result: any;
      await act(async () => {
        result = renderHook(() => useRecordingState()).result;
        await Promise.resolve(); // Wait for useEffect to run
      });

      let stopPromise: Promise<void>;
      act(() => {
        stopPromise = result.current.stopRecording();
      });

      // Should be loading
      expect(result.current.state.isLoading).toBe(true);

      await act(async () => {
        await stopPromise!;
      });

      // Should complete
      expect(result.current.state.isLoading).toBe(false);
    });

    it('should send STOP_RECORDING message', async () => {
      // Initialize with recording state
      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({ isRecording: true, sessionId: 'session-456', startTime: Date.now() });
        return Promise.resolve({ isRecording: true, sessionId: 'session-456', startTime: Date.now() });
      });
      mockSendMessage.mockResolvedValue({ success: true });

      let result: any;
      await act(async () => {
        result = renderHook(() => useRecordingState()).result;
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'STOP_RECORDING',
        payload: { sessionId: 'session-456' },
      });
    });

    it('should clear storage on stop', async () => {
      mockSendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(mockStorageSet).toHaveBeenCalledWith({
        isRecording: false,
        startTime: null,
        sessionId: null,
        currentTabId: null,
      });
    });

    it('should reset state on successful stop', async () => {
      // Initialize with recording state
      mockStorageGet.mockImplementation((_keys, callback) => {
        callback?.({ isRecording: true, sessionId: 'session-123', startTime: Date.now() });
        return Promise.resolve({ isRecording: true, sessionId: 'session-123', startTime: Date.now() });
      });
      mockSendMessage.mockResolvedValue({ success: true });

      let result: any;
      await act(async () => {
        result = renderHook(() => useRecordingState()).result;
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(result.current.state).toEqual({
        isRecording: false,
        isPaused: false,
        duration: 0,
        sessionId: null,
        startTime: null,
        error: null,
        isLoading: false,
      });
    });

    it('should handle backend failure', async () => {
      mockSendMessage.mockResolvedValue({ success: false, error: 'Stop failed' });

      const { result } = renderHook(() => useRecordingState());

      await act(async () => {
        try {
          await result.current.stopRecording();
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.state.error).toBe('Stop failed');
      expect(result.current.state.isLoading).toBe(false);
    });
  });
});


