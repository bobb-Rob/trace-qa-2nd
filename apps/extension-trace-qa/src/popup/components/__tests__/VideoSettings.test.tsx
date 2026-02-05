/**
 * VideoSettings Component Tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoSettings } from '../VideoSettings';
import type { VideoRecordingConfig } from '@shared/types';

describe('VideoSettings', () => {
  const defaultConfig: VideoRecordingConfig = {
    quality: 'HD',
    captureMode: 'TAB',
    audioSource: 'MICROPHONE',
  };

  const defaultProps = {
    config: defaultConfig,
    onConfigChange: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render video settings container', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByTestId('video-settings')).toBeInTheDocument();
    });

    it('should show settings title', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByText('Video Recording Settings')).toBeInTheDocument();
    });

    it('should show quality label', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });
  });

  describe('quality selection', () => {
    it('should show SD quality button', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByTestId('quality-sd')).toBeInTheDocument();
      expect(screen.getByText('SD (480p)')).toBeInTheDocument();
      expect(screen.getByText('Smaller file size')).toBeInTheDocument();
    });

    it('should show HD quality button', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByTestId('quality-hd')).toBeInTheDocument();
      expect(screen.getByText('HD (720p)')).toBeInTheDocument();
      expect(screen.getByText('Better quality')).toBeInTheDocument();
    });

    it('should highlight selected quality (HD)', () => {
      render(<VideoSettings {...defaultProps} config={{ ...defaultConfig, quality: 'HD' }} />);
      const hdButton = screen.getByTestId('quality-hd');
      expect(hdButton).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('should highlight selected quality (SD)', () => {
      render(<VideoSettings {...defaultProps} config={{ ...defaultConfig, quality: 'SD' }} />);
      const sdButton = screen.getByTestId('quality-sd');
      expect(sdButton).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('should call onConfigChange with SD when SD button clicked', () => {
      const onConfigChange = vi.fn();
      render(<VideoSettings {...defaultProps} onConfigChange={onConfigChange} />);

      fireEvent.click(screen.getByTestId('quality-sd'));
      expect(onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        quality: 'SD',
      });
    });

    it('should call onConfigChange with HD when HD button clicked', () => {
      const onConfigChange = vi.fn();
      render(
        <VideoSettings
          {...defaultProps}
          config={{ ...defaultConfig, quality: 'SD' }}
          onConfigChange={onConfigChange}
        />
      );

      fireEvent.click(screen.getByTestId('quality-hd'));
      expect(onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        quality: 'HD',
      });
    });
  });

  describe('microphone toggle', () => {
    it('should show microphone toggle', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByText('Microphone')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should show enabled state when microphone is on', () => {
      render(<VideoSettings {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).toHaveClass('bg-green-500');
    });

    it('should show disabled state when microphone is off', () => {
      render(
        <VideoSettings
          {...defaultProps}
          config={{ ...defaultConfig, audioSource: 'NONE' }}
        />
      );
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveClass('bg-gray-300');
    });

    it('should toggle microphone off when clicked while on', () => {
      const onConfigChange = vi.fn();
      render(<VideoSettings {...defaultProps} onConfigChange={onConfigChange} />);

      fireEvent.click(screen.getByRole('switch'));
      expect(onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        audioSource: 'NONE',
      });
    });

    it('should toggle microphone on when clicked while off', () => {
      const onConfigChange = vi.fn();
      render(
        <VideoSettings
          {...defaultProps}
          config={{ ...defaultConfig, audioSource: 'NONE' }}
          onConfigChange={onConfigChange}
        />
      );

      fireEvent.click(screen.getByRole('switch'));
      expect(onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        audioSource: 'MICROPHONE',
      });
    });

    it('should show "Voice narration will be recorded" when mic enabled', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByText('Voice narration will be recorded')).toBeInTheDocument();
    });

    it('should show "No audio will be recorded" when mic disabled', () => {
      render(
        <VideoSettings
          {...defaultProps}
          config={{ ...defaultConfig, audioSource: 'NONE' }}
        />
      );
      expect(screen.getByText('No audio will be recorded')).toBeInTheDocument();
    });
  });

  describe('capture mode info', () => {
    it('should show capture mode info', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByText('Captures current tab')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should apply disabled styling', () => {
      render(<VideoSettings {...defaultProps} disabled={true} />);
      const container = screen.getByTestId('video-settings');
      expect(container).toHaveClass('opacity-50', 'pointer-events-none');
    });

    it('should disable quality buttons when disabled', () => {
      render(<VideoSettings {...defaultProps} disabled={true} />);
      expect(screen.getByTestId('quality-sd')).toBeDisabled();
      expect(screen.getByTestId('quality-hd')).toBeDisabled();
    });

    it('should disable microphone toggle when disabled', () => {
      render(<VideoSettings {...defaultProps} disabled={true} />);
      expect(screen.getByRole('switch')).toBeDisabled();
    });
  });

  describe('button attributes', () => {
    it('should have type="button" on quality buttons', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByTestId('quality-sd')).toHaveAttribute('type', 'button');
      expect(screen.getByTestId('quality-hd')).toHaveAttribute('type', 'button');
    });

    it('should have type="button" on microphone toggle', () => {
      render(<VideoSettings {...defaultProps} />);
      expect(screen.getByRole('switch')).toHaveAttribute('type', 'button');
    });
  });
});
