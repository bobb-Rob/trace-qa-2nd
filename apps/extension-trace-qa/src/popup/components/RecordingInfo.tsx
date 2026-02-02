import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface RecordingInfoProps {
  startTime: number | null;
  isVisible: boolean;
}

export function RecordingInfo({
  startTime,
  isVisible,
}: RecordingInfoProps): React.ReactElement | null {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isVisible || !startTime) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, startTime]);

  if (!isVisible) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      data-testid="recording-info"
      className="flex items-center justify-center gap-2 p-3 bg-red-50 rounded-lg"
    >
      <Clock size={16} className="text-red-500" />
      <span className="text-sm font-mono text-red-700">{formatTime(elapsed)}</span>
    </div>
  );
}
