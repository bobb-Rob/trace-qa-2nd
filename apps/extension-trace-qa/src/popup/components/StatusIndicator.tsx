import React from 'react';
import { cn } from '@shared/utils/cn';

interface StatusIndicatorProps {
  isRecording: boolean;
  isPaused: boolean;
  statusText?: string;
}

export function StatusIndicator({
  isRecording,
  isPaused,
  statusText,
}: StatusIndicatorProps): React.ReactElement {
  const getDefaultText = (): string => {
    if (!isRecording) return 'Ready to capture';
    if (isPaused) return 'Recording paused';
    return 'Recording in progress';
  };

  const getDotClass = (): string => {
    if (!isRecording) return 'bg-gray-300';
    if (isPaused) return 'bg-amber-500'; // Amber, no pulse when paused
    return 'bg-red-500 animate-pulse'; // Red, pulsing when recording
  };

  return (
    <div
      data-testid="status-indicator"
      className="flex items-center justify-center gap-2 p-3 bg-white rounded-lg shadow-sm"
    >
      <div
        data-testid="status-dot"
        className={cn('w-3 h-3 rounded-full transition-colors', getDotClass())}
      />
      <span className="text-sm text-gray-600">{statusText ?? getDefaultText()}</span>
    </div>
  );
}
