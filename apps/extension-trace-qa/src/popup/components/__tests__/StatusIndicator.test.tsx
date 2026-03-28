/**
 * StatusIndicator Component Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIndicator } from '../StatusIndicator';

describe('StatusIndicator', () => {
  describe('default text', () => {
    it('should show "Ready to capture" when not recording', () => {
      render(<StatusIndicator isRecording={false} isPaused={false} />);
      expect(screen.getByText('Ready to capture')).toBeInTheDocument();
    });

    it('should show "Recording in progress" when recording', () => {
      render(<StatusIndicator isRecording={true} isPaused={false} />);
      expect(screen.getByText('Recording in progress')).toBeInTheDocument();
    });

    it('should show "Recording paused" when paused', () => {
      render(<StatusIndicator isRecording={true} isPaused={true} />);
      expect(screen.getByText('Recording paused')).toBeInTheDocument();
    });
  });

  describe('custom status text', () => {
    it('should show custom text when provided', () => {
      render(
        <StatusIndicator
          isRecording={false}
          isPaused={false}
          statusText="Custom status"
        />
      );
      expect(screen.getByText('Custom status')).toBeInTheDocument();
    });

    it('should override default text with custom text', () => {
      render(
        <StatusIndicator
          isRecording={true}
          isPaused={false}
          statusText="Override text"
        />
      );
      expect(screen.getByText('Override text')).toBeInTheDocument();
      expect(screen.queryByText('Recording in progress')).not.toBeInTheDocument();
    });
  });

  describe('status dot styling', () => {
    it('should have gray dot when not recording', () => {
      render(<StatusIndicator isRecording={false} isPaused={false} />);
      const dot = screen.getByTestId('status-dot');
      expect(dot).toHaveClass('bg-gray-300');
      expect(dot).not.toHaveClass('animate-pulse');
    });

    it('should have red pulsing dot when recording', () => {
      render(<StatusIndicator isRecording={true} isPaused={false} />);
      const dot = screen.getByTestId('status-dot');
      expect(dot).toHaveClass('bg-red-500');
      expect(dot).toHaveClass('animate-pulse');
    });

    it('should have amber dot without pulse when paused', () => {
      render(<StatusIndicator isRecording={true} isPaused={true} />);
      const dot = screen.getByTestId('status-dot');
      expect(dot).toHaveClass('bg-amber-500');
      expect(dot).not.toHaveClass('animate-pulse');
    });
  });

  describe('accessibility', () => {
    it('should have status-indicator test id', () => {
      render(<StatusIndicator isRecording={false} isPaused={false} />);
      expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
    });

    it('should have proper structure', () => {
      render(<StatusIndicator isRecording={true} isPaused={false} />);
      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('flex', 'items-center');
    });
  });
});
