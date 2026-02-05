/**
 * Popup Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Popup } from '../Popup';
import * as useRecordingStateModule from '../hooks/useRecordingState';

// Mock the useRecordingState hook
vi.mock('../hooks/useRecordingState', () => ({
  useRecordingState: vi.fn(),
}));

const mockUseRecordingState = vi.mocked(useRecordingStateModule.useRecordingState);

describe('Popup', () => {
  const defaultState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    sessionId: null,
    startTime: null,
    error: null,
    isLoading: false,
  };

  const defaultVideoConfig = {
    quality: 'HD' as const,
    captureMode: 'TAB' as const,
    audioSource: 'MICROPHONE' as const,
  };

  const mockStartRecording = vi.fn();
  const mockStopRecording = vi.fn();
  const mockSetVideoConfig = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRecordingState.mockReturnValue({
      state: defaultState,
      videoConfig: defaultVideoConfig,
      setVideoConfig: mockSetVideoConfig,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
    });
  });

  describe('rendering', () => {
    it('should render popup container', () => {
      render(<Popup />);
      expect(screen.getByTestId('popup-container')).toBeInTheDocument();
    });

    it('should render header with title', () => {
      render(<Popup />);
      expect(screen.getByTestId('popup-header')).toBeInTheDocument();
      expect(screen.getByTestId('app-title')).toHaveTextContent('TraceQA');
    });

    it('should render subtitle', () => {
      render(<Popup />);
      expect(screen.getByText('Smart Bug Capture')).toBeInTheDocument();
    });

    it('should render footer', () => {
      render(<Popup />);
      expect(screen.getByTestId('popup-footer')).toBeInTheDocument();
    });

    it('should render StatusIndicator', () => {
      render(<Popup />);
      expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
    });

    it('should render RecordingButton', () => {
      render(<Popup />);
      expect(screen.getByTestId('start-recording-btn')).toBeInTheDocument();
    });

    it('should render View Captured Bugs button', () => {
      render(<Popup />);
      expect(screen.getByTestId('view-bugs-btn')).toBeInTheDocument();
      expect(screen.getByText('View Captured Bugs')).toBeInTheDocument();
    });

    it('should render Open Dashboard button', () => {
      render(<Popup />);
      expect(screen.getByText('Open Dashboard')).toBeInTheDocument();
    });
  });

  describe('VideoSettings visibility', () => {
    it('should show VideoSettings when not recording', () => {
      render(<Popup />);
      expect(screen.getByTestId('video-settings')).toBeInTheDocument();
    });

    it('should hide VideoSettings when recording', () => {
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, isRecording: true },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);
      expect(screen.queryByTestId('video-settings')).not.toBeInTheDocument();
    });
  });

  describe('RecordingInfo visibility', () => {
    it('should hide RecordingInfo when not recording', () => {
      render(<Popup />);
      expect(screen.queryByTestId('recording-info')).not.toBeInTheDocument();
    });

    it('should show RecordingInfo when recording', () => {
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, isRecording: true, duration: 5000 },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);
      expect(screen.getByTestId('recording-info')).toBeInTheDocument();
    });
  });

  describe('recording actions', () => {
    it('should call startRecording when start button clicked', async () => {
      mockStartRecording.mockResolvedValue(undefined);
      render(<Popup />);

      fireEvent.click(screen.getByTestId('start-recording-btn'));

      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should call stopRecording when stop button clicked', async () => {
      mockStopRecording.mockResolvedValue(undefined);
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, isRecording: true },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);

      fireEvent.click(screen.getByTestId('stop-recording-btn'));

      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error when startRecording fails', async () => {
      mockStartRecording.mockRejectedValue(new Error('Start failed'));
      render(<Popup />);

      fireEvent.click(screen.getByTestId('start-recording-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText('Start failed')).toBeInTheDocument();
      });
    });

    it('should show error when stopRecording fails', async () => {
      mockStopRecording.mockRejectedValue(new Error('Stop failed'));
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, isRecording: true },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);

      fireEvent.click(screen.getByTestId('stop-recording-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText('Stop failed')).toBeInTheDocument();
      });
    });

    it('should handle unknown error type', async () => {
      mockStartRecording.mockRejectedValue('string error');
      render(<Popup />);

      fireEvent.click(screen.getByTestId('start-recording-btn'));

      await waitFor(() => {
        expect(screen.getByText('Unknown error')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should display error from state', () => {
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, error: 'State error' },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);
      expect(screen.getByText('State error')).toBeInTheDocument();
    });

    it('should dismiss local error when dismiss clicked', async () => {
      mockStartRecording.mockRejectedValue(new Error('Error message'));
      render(<Popup />);

      // Trigger error
      fireEvent.click(screen.getByTestId('start-recording-btn'));

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      // Dismiss error
      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
      });
    });
  });

  describe('external links', () => {
    it('should open bugs page when View Captured Bugs clicked', () => {
      const mockCreate = vi.fn();
      vi.stubGlobal('chrome', {
        ...globalThis.chrome,
        tabs: {
          ...globalThis.chrome.tabs,
          create: mockCreate,
        },
      });

      render(<Popup />);
      fireEvent.click(screen.getByTestId('view-bugs-btn'));

      expect(mockCreate).toHaveBeenCalledWith({ url: 'https://app.traceqa.com/bugs' });
    });

    it('should open dashboard when Open Dashboard clicked', () => {
      const mockCreate = vi.fn();
      vi.stubGlobal('chrome', {
        ...globalThis.chrome,
        tabs: {
          ...globalThis.chrome.tabs,
          create: mockCreate,
        },
      });

      render(<Popup />);
      fireEvent.click(screen.getByText('Open Dashboard'));

      expect(mockCreate).toHaveBeenCalledWith({ url: 'https://app.traceqa.com' });
    });
  });

  describe('video config', () => {
    it('should pass setVideoConfig to VideoSettings', () => {
      render(<Popup />);

      // Click on SD quality to trigger config change
      fireEvent.click(screen.getByTestId('quality-sd'));

      expect(mockSetVideoConfig).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should disable VideoSettings when loading', () => {
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, isLoading: true },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);
      const settings = screen.getByTestId('video-settings');
      expect(settings).toHaveClass('opacity-50');
    });

    it('should disable RecordingButton when loading', () => {
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, isLoading: true },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);
      expect(screen.getByTestId('start-recording-btn')).toBeDisabled();
    });
  });

  describe('paused state', () => {
    it('should show paused state in RecordingInfo', () => {
      mockUseRecordingState.mockReturnValue({
        state: { ...defaultState, isRecording: true, isPaused: true, duration: 10000 },
        videoConfig: defaultVideoConfig,
        setVideoConfig: mockSetVideoConfig,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<Popup />);
      expect(screen.getByText('PAUSED')).toBeInTheDocument();
    });
  });
});
