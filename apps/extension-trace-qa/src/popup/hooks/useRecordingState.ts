import { useState, useEffect, useCallback } from 'react';
import type { RecordingState, VideoRecordingConfig, SessionState } from '@shared/types';

const initialState: RecordingState = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  error: null,
  isLoading: true,
};

/**
 * Poll for recording status until state becomes RECORDING or fails.
 * Returns true if recording started successfully, false otherwise.
 */
async function waitForRecordingState(
  sessionId: string,
  maxAttempts = 60, // 60 seconds max wait
  intervalMs = 1000
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });

    if (!response?.success) {
      return { success: false, error: 'Failed to get recording status' };
    }

    const state = response.sessionState as SessionState;

    // Success: recording has started
    if (state === 'RECORDING' && response.sessionId === sessionId) {
      return { success: true };
    }

    // Failure: returned to IDLE (user cancelled or error occurred)
    if (state === 'IDLE') {
      return { success: false, error: 'Recording was cancelled or failed to start' };
    }

    // Still pending (REQUESTING_PERMISSION or STARTING) - wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { success: false, error: 'Timed out waiting for recording to start' };
}

const defaultVideoConfig: VideoRecordingConfig = {
  quality: 'HD',
  captureMode: 'TAB',
  audioSource: 'MICROPHONE',
};

export function useRecordingState(): {
  state: RecordingState;
  videoConfig: VideoRecordingConfig;
  setVideoConfig: (config: VideoRecordingConfig) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
} {
  const [state, setState] = useState<RecordingState>(initialState);
  const [videoConfig, setVideoConfigState] = useState<VideoRecordingConfig>(defaultVideoConfig);

  useEffect(() => {
    chrome.storage.local.get(
      ['isRecording', 'startTime', 'sessionId', 'videoConfig'],
      (result) => {
        setState({
          isRecording: result.isRecording ?? false,
          sessionId: result.sessionId ?? null,
          startTime: result.startTime ?? null,
          error: null,
          isLoading: false,
        });

        if (result.videoConfig) {
          setVideoConfigState(result.videoConfig as VideoRecordingConfig);
        }
      }
    );
  }, []);

  const setVideoConfig = useCallback((config: VideoRecordingConfig): void => {
    setVideoConfigState(config);
    chrome.storage.local.set({ videoConfig: config });
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.id) {
        throw new Error('No active tab found');
      }

      const randomId = Math.random().toString(36).substring(2, 11);
      const now = new Date();
      const formattedDate = now
        .toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
        .toLowerCase()
        .replace(/[, ]+/g, '_')
        .replace(':', '-');

      const sessionId = `session_${randomId}_${formattedDate}`;

      // Send start request to background - this initiates the screen picker
      const response = await chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        payload: { sessionId, tabId: tab.id, videoConfig },
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to start recording');
      }

      // Wait for user to select screen/tab and recording to actually start
      // This polls until state becomes RECORDING or fails
      const result = await waitForRecordingState(sessionId);

      if (!result.success) {
        // User cancelled or error occurred - reset state
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || null,
        }));
        return;
      }

      // Recording has actually started - now get the real start time from storage
      const storageData = await chrome.storage.local.get(['startTime']);
      const startTime = storageData.startTime ?? Date.now();

      setState({
        isRecording: true,
        sessionId,
        startTime,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setState((prev) => ({ ...prev, error: errorMessage, isLoading: false }));
      throw error;
    }
  }, [videoConfig]);

  const stopRecording = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_RECORDING',
        payload: { sessionId: state.sessionId },
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to stop recording');
      }

      await chrome.storage.local.set({
        isRecording: false,
        startTime: null,
        sessionId: null,
        currentTabId: null,
      });

      setState({
        isRecording: false,
        sessionId: null,
        startTime: null,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      setState((prev) => ({ ...prev, error: errorMessage, isLoading: false }));
      throw error;
    }
  }, [state.sessionId]);

  return { state, videoConfig, setVideoConfig, startRecording, stopRecording };
}
