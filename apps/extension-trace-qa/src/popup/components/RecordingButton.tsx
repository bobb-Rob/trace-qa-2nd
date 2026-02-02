import React from 'react';
import { Play, Square } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface RecordingButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function RecordingButton({
  isRecording,
  onStart,
  onStop,
  disabled = false,
  isLoading = false,
}: RecordingButtonProps): React.ReactElement {
  const handleClick = (): void => {
    if (disabled || isLoading) return;
    isRecording ? onStop() : onStart();
  };

  const buttonText = isRecording ? 'Stop Recording' : 'Start Recording';
  const Icon = isRecording ? Square : Play;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      data-testid={isRecording ? 'stop-recording-btn' : 'start-recording-btn'}
      className={cn(
        'w-full flex items-center justify-center gap-3',
        'py-4 px-4 rounded-lg font-semibold',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        isRecording
          ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500'
          : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500',
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon size={20} />
      )}
      <span className="text-base">{buttonText}</span>
    </button>
  );
}
