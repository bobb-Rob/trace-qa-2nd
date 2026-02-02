import React from 'react';
import { Video, Mic, MicOff, Monitor } from 'lucide-react';
import type { VideoRecordingConfig, VideoQuality, AudioSource } from '@shared/types';

interface VideoSettingsProps {
  config: VideoRecordingConfig;
  onConfigChange: (config: VideoRecordingConfig) => void;
  disabled: boolean;
}

export function VideoSettings({
  config,
  onConfigChange,
  disabled,
}: VideoSettingsProps): React.ReactElement {
  const handleQualityChange = (quality: VideoQuality): void => {
    onConfigChange({ ...config, quality });
  };

  const handleAudioToggle = (): void => {
    const newAudioSource: AudioSource = config.audioSource === 'MICROPHONE' ? 'NONE' : 'MICROPHONE';
    onConfigChange({ ...config, audioSource: newAudioSource });
  };

  const isMicrophoneEnabled = config.audioSource === 'MICROPHONE';

  return (
    <div
      data-testid="video-settings"
      className={`p-4 bg-white rounded-lg border border-gray-200 space-y-4 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center gap-2 text-gray-700">
        <Video size={18} />
        <span className="font-medium text-sm">Video Recording Settings</span>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-gray-500 font-medium">Quality</label>
        <div className="flex gap-2">
          <QualityButton
            quality="SD"
            label="SD (480p)"
            description="Smaller file size"
            isSelected={config.quality === 'SD'}
            onClick={() => handleQualityChange('SD')}
            disabled={disabled}
          />
          <QualityButton
            quality="HD"
            label="HD (720p)"
            description="Better quality"
            isSelected={config.quality === 'HD'}
            onClick={() => handleQualityChange('HD')}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Monitor size={14} />
        <span>Captures current tab</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isMicrophoneEnabled ? (
            <Mic size={18} className="text-green-600" />
          ) : (
            <MicOff size={18} className="text-gray-400" />
          )}
          <span className="text-sm text-gray-700">Microphone</span>
        </div>
        <button
          type="button"
          onClick={handleAudioToggle}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isMicrophoneEnabled ? 'bg-green-500' : 'bg-gray-300'
          }`}
          role="switch"
          aria-checked={isMicrophoneEnabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              isMicrophoneEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {isMicrophoneEnabled
          ? 'Voice narration will be recorded'
          : 'No audio will be recorded'}
      </p>
    </div>
  );
}

interface QualityButtonProps {
  quality: VideoQuality;
  label: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  disabled: boolean;
}

function QualityButton({
  quality,
  label,
  description,
  isSelected,
  onClick,
  disabled,
}: QualityButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={`quality-${quality.toLowerCase()}`}
      className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
        {label}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{description}</div>
    </button>
  );
}
