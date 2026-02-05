/**
 * RecordingButton Component Tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordingButton } from '../RecordingButton';

describe('RecordingButton', () => {
  const defaultProps = {
    isRecording: false,
    isPaused: false,
    onStart: vi.fn(),
    onStop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('button text', () => {
    it('should show "Start Recording" when not recording', () => {
      render(<RecordingButton {...defaultProps} />);
      expect(screen.getByText('Start Recording')).toBeInTheDocument();
    });

    it('should show "Stop Recording" when recording', () => {
      render(<RecordingButton {...defaultProps} isRecording={true} />);
      expect(screen.getByText('Stop Recording')).toBeInTheDocument();
    });

    it('should show "Recording Paused" when paused', () => {
      render(<RecordingButton {...defaultProps} isRecording={true} isPaused={true} />);
      expect(screen.getByText('Recording Paused')).toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('should call onStart when clicked and not recording', () => {
      const onStart = vi.fn();
      render(<RecordingButton {...defaultProps} onStart={onStart} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('should call onStop when clicked and recording', () => {
      const onStop = vi.fn();
      render(<RecordingButton {...defaultProps} isRecording={true} onStop={onStop} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('should not call any handler when disabled', () => {
      const onStart = vi.fn();
      const onStop = vi.fn();
      render(
        <RecordingButton
          {...defaultProps}
          onStart={onStart}
          onStop={onStop}
          disabled={true}
        />
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onStart).not.toHaveBeenCalled();
      expect(onStop).not.toHaveBeenCalled();
    });

    it('should not call any handler when loading', () => {
      const onStart = vi.fn();
      render(
        <RecordingButton
          {...defaultProps}
          onStart={onStart}
          isLoading={true}
        />
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onStart).not.toHaveBeenCalled();
    });
  });

  describe('button styling', () => {
    it('should have blue styling when not recording', () => {
      render(<RecordingButton {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-500');
    });

    it('should have red styling when recording', () => {
      render(<RecordingButton {...defaultProps} isRecording={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-500');
    });

    it('should have amber styling when paused', () => {
      render(<RecordingButton {...defaultProps} isRecording={true} isPaused={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-amber-500');
    });

    it('should have opacity when disabled', () => {
      render(<RecordingButton {...defaultProps} disabled={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
    });

    it('should have opacity when loading', () => {
      render(<RecordingButton {...defaultProps} isLoading={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
    });
  });

  describe('loading state', () => {
    it('should show spinner when loading', () => {
      render(<RecordingButton {...defaultProps} isLoading={true} />);
      const spinner = screen.getByRole('button').querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show spinner when not loading', () => {
      render(<RecordingButton {...defaultProps} />);
      const spinner = screen.getByRole('button').querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('test ids', () => {
    it('should have start-recording-btn test id when not recording', () => {
      render(<RecordingButton {...defaultProps} />);
      expect(screen.getByTestId('start-recording-btn')).toBeInTheDocument();
    });

    it('should have stop-recording-btn test id when recording', () => {
      render(<RecordingButton {...defaultProps} isRecording={true} />);
      expect(screen.getByTestId('stop-recording-btn')).toBeInTheDocument();
    });
  });

  describe('button attributes', () => {
    it('should have type="button" attribute', () => {
      render(<RecordingButton {...defaultProps} />);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<RecordingButton {...defaultProps} disabled={true} />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should be disabled when loading', () => {
      render(<RecordingButton {...defaultProps} isLoading={true} />);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
