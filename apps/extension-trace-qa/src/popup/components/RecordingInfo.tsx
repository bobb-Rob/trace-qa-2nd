import React from 'react';
import { Clock, Pause } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface RecordingInfoProps {
  isVisible: boolean;
  duration: number; // ms from background (authoritative)
  isPaused: boolean;
}

export function RecordingInfo({
  isVisible,
  duration,
  isPaused,
}: RecordingInfoProps): React.ReactElement | null {
  if (!isVisible) return null;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      data-testid="recording-info"
      className={cn(
        'flex items-center justify-center gap-2 p-3 rounded-lg',
        isPaused ? 'bg-amber-50' : 'bg-red-50'
      )}
    >
      {isPaused ? (
        <Pause size={16} className="text-amber-500" />
      ) : (
        <Clock size={16} className="text-red-500" />
      )}
      <span
        className={cn(
          'text-sm font-mono',
          isPaused ? 'text-amber-700' : 'text-red-700'
        )}
      >
        {formatTime(duration)}
      </span>
      {isPaused && (
        <span className="text-xs text-amber-600 font-medium ml-1">PAUSED</span>
      )}
    </div>
  );
}
