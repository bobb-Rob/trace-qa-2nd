import React from 'react';
import { cn } from '@shared/utils/cn';

interface StatusIndicatorProps {
  isRecording: boolean;
  statusText?: string;
}

export function StatusIndicator({
  isRecording,
  statusText,
}: StatusIndicatorProps): React.ReactElement {
  const defaultText = isRecording ? 'Recording in progress' : 'Ready to capture';

  return (
    <div
      data-testid="status-indicator"
      className="flex items-center justify-center gap-2 p-3 bg-white rounded-lg shadow-sm"
    >
      <div
        data-testid="status-dot"
        className={cn(
          'w-3 h-3 rounded-full transition-colors',
          isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
        )}
      />
      <span className="text-sm text-gray-600">{statusText ?? defaultText}</span>
    </div>
  );
}
