/**
 * ErrorMessage Component Tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorMessage } from '../ErrorMessage';

describe('ErrorMessage', () => {
  describe('visibility', () => {
    it('should not render when message is null', () => {
      const { container } = render(
        <ErrorMessage message={null} onDismiss={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when message is provided', () => {
      render(<ErrorMessage message="Error occurred" onDismiss={vi.fn()} />);
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    it('should display the error message text', () => {
      render(<ErrorMessage message="Something went wrong" onDismiss={vi.fn()} />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('dismiss functionality', () => {
    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      render(<ErrorMessage message="Error" onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should have accessible dismiss button', () => {
      render(<ErrorMessage message="Error" onDismiss={vi.fn()} />);
      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      expect(dismissButton).toBeInTheDocument();
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error');
    });
  });

  describe('styling', () => {
    it('should have red error styling', () => {
      render(<ErrorMessage message="Error" onDismiss={vi.fn()} />);
      const container = screen.getByTestId('error-message');
      expect(container).toHaveClass('bg-red-50', 'border-red-200');
    });

    it('should have proper layout classes', () => {
      render(<ErrorMessage message="Error" onDismiss={vi.fn()} />);
      const container = screen.getByTestId('error-message');
      expect(container).toHaveClass('flex', 'items-start', 'gap-2');
    });
  });

  describe('different error messages', () => {
    it('should display long error messages', () => {
      const longMessage = 'This is a very long error message that provides detailed information about what went wrong in the application';
      render(<ErrorMessage message={longMessage} onDismiss={vi.fn()} />);
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should display short error messages', () => {
      render(<ErrorMessage message="Failed" onDismiss={vi.fn()} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should handle empty string message (not rendered)', () => {
      // Empty string is falsy, so component should not render
      const { container } = render(
        <ErrorMessage message="" onDismiss={vi.fn()} />
      );
      // Note: Empty string IS falsy in JS, but TypeScript types it as string
      // The component checks `if (!message)` which catches empty string
      expect(container.firstChild).toBeNull();
    });
  });

  describe('button attributes', () => {
    it('should have type="button" on dismiss button', () => {
      render(<ErrorMessage message="Error" onDismiss={vi.fn()} />);
      const dismissButton = screen.getByRole('button');
      expect(dismissButton).toHaveAttribute('type', 'button');
    });
  });
});
