/**
 * RecordingInfo Component Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecordingInfo } from '../RecordingInfo';

describe('RecordingInfo', () => {
  describe('visibility', () => {
    it('should not render when isVisible is false', () => {
      const { container } = render(
        <RecordingInfo isVisible={false} duration={0} isPaused={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when isVisible is true', () => {
      render(<RecordingInfo isVisible={true} duration={0} isPaused={false} />);
      expect(screen.getByTestId('recording-info')).toBeInTheDocument();
    });
  });

  describe('duration formatting', () => {
    it('should format 0ms as 00:00', () => {
      render(<RecordingInfo isVisible={true} duration={0} isPaused={false} />);
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('should format 5000ms as 00:05', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={false} />);
      expect(screen.getByText('00:05')).toBeInTheDocument();
    });

    it('should format 65000ms as 01:05', () => {
      render(<RecordingInfo isVisible={true} duration={65000} isPaused={false} />);
      expect(screen.getByText('01:05')).toBeInTheDocument();
    });

    it('should format 3600000ms (1 hour) as 60:00', () => {
      render(<RecordingInfo isVisible={true} duration={3600000} isPaused={false} />);
      expect(screen.getByText('60:00')).toBeInTheDocument();
    });

    it('should format 90000ms as 01:30', () => {
      render(<RecordingInfo isVisible={true} duration={90000} isPaused={false} />);
      expect(screen.getByText('01:30')).toBeInTheDocument();
    });
  });

  describe('paused state', () => {
    it('should show PAUSED label when paused', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={true} />);
      expect(screen.getByText('PAUSED')).toBeInTheDocument();
    });

    it('should not show PAUSED label when not paused', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={false} />);
      expect(screen.queryByText('PAUSED')).not.toBeInTheDocument();
    });

    it('should have amber background when paused', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={true} />);
      const info = screen.getByTestId('recording-info');
      expect(info).toHaveClass('bg-amber-50');
    });

    it('should have red background when not paused', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={false} />);
      const info = screen.getByTestId('recording-info');
      expect(info).toHaveClass('bg-red-50');
    });
  });

  describe('text styling', () => {
    it('should have amber text color when paused', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={true} />);
      const timeText = screen.getByText('00:05');
      expect(timeText).toHaveClass('text-amber-700');
    });

    it('should have red text color when not paused', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={false} />);
      const timeText = screen.getByText('00:05');
      expect(timeText).toHaveClass('text-red-700');
    });

    it('should have monospace font for time display', () => {
      render(<RecordingInfo isVisible={true} duration={5000} isPaused={false} />);
      const timeText = screen.getByText('00:05');
      expect(timeText).toHaveClass('font-mono');
    });
  });
});
