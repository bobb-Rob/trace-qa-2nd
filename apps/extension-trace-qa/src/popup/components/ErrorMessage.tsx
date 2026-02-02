import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorMessage({
  message,
  onDismiss,
}: ErrorMessageProps): React.ReactElement | null {
  if (!message) return null;

  return (
    <div
      data-testid="error-message"
      className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
    >
      <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-red-400 hover:text-red-600"
        aria-label="Dismiss error"
      >
        <X size={16} />
      </button>
    </div>
  );
}
