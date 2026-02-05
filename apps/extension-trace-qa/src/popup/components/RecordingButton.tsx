import React from 'react';
import { Play, Square } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface RecordingButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function RecordingButton({
  isRecording,
  isPaused,
  onStart,
  onStop,
  onResume,
  disabled = false,
  isLoading = false,
}: RecordingButtonProps): React.ReactElement {
  const handleClick = (): void => {
    if (disabled || isLoading) return;

    if (!isRecording) {
      onStart();
    } else if (isPaused) {
      onResume();
    } else {
      onStop();
    }
  };

  const getButtonText = (): string => {
    if (!isRecording) return 'Start Recording';
    if (isPaused) return 'Resume Recording';
    return 'Stop Recording';
  };

  const getIcon = (): React.ReactElement => {
    if (!isRecording) return <Play size={20} />;
    if (isPaused) return <Play size={20} />;  // Play icon for resume action
    return <Square size={20} />;
  };

  const getButtonStyles = (): string => {
    if (!isRecording) {
      return 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500';
    }
    if (isPaused) {
      return 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500';
    }
    return 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500';
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      data-testid={!isRecording ? 'start-recording-btn' : isPaused ? 'resume-recording-btn' : 'stop-recording-btn'}
      className={cn(
        'w-full flex items-center justify-center gap-3',
        'py-4 px-4 rounded-lg font-semibold',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        getButtonStyles(),
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        getIcon()
      )}
      <span className="text-base">{getButtonText()}</span>
    </button>
  );
}
