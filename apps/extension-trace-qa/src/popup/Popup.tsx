import React, { useState } from 'react';
import { StatusIndicator } from './components/StatusIndicator';
import { RecordingButton } from './components/RecordingButton';
import { RecordingInfo } from './components/RecordingInfo';
import { ErrorMessage } from './components/ErrorMessage';
import { VideoSettings } from './components/VideoSettings';
import { useRecordingState } from './hooks/useRecordingState';

export function Popup(): React.ReactElement {
  const { state, videoConfig, setVideoConfig, startRecording, stopRecording, resumeRecording } = useRecordingState();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStart = async (): Promise<void> => {
    const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`[MIC-PERM][POPUP] handleStart entered at ${ts()} (async function, sync portion)`);
    try {
      console.log(`[MIC-PERM][POPUP] about to await startRecording() at ${ts()}`);
      await startRecording();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLocalError(errorMessage);
    }
  };

  const handleStop = async (): Promise<void> => {
    try {
      await stopRecording();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLocalError(errorMessage);
    }
  };

  const handleResume = async (): Promise<void> => {
    try {
      await resumeRecording();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLocalError(errorMessage);
    }
  };

  const handleDismissError = (): void => {
    setLocalError(null);
  };

  const displayError = localError ?? state.error;

  return (
    <div data-testid="popup-container" className="w-80 min-h-[320px] p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header data-testid="popup-header" className="text-center mb-5">
        <h1 data-testid="app-title" className="text-xl font-bold text-gray-900">TraceQA</h1>
        <p className="text-xs text-gray-500 mt-1">Smart Bug Capture</p>
      </header>

      {/* Main Content */}
      <main className="space-y-4">
        <StatusIndicator isRecording={state.isRecording} isPaused={state.isPaused} />
        <ErrorMessage message={displayError} onDismiss={handleDismissError} />

        {!state.isRecording && (
          <VideoSettings
            config={videoConfig}
            onConfigChange={setVideoConfig}
            disabled={state.isLoading}
          />
        )}

        <RecordingButton
          isRecording={state.isRecording}
          isPaused={state.isPaused}
          onStart={handleStart}
          onStop={handleStop}
          onResume={handleResume}
          isLoading={state.isLoading}
          disabled={state.isLoading}
        />

        <RecordingInfo
          isVisible={state.isRecording}
          duration={state.duration}
          isPaused={state.isPaused}
        />

      </main>

      {/* Footer */}
      <footer data-testid="popup-footer" className="mt-6 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => chrome.tabs.create({ url: 'https://app.traceqa.com' })}
          className="w-full text-center text-sm text-blue-600 hover:text-blue-700"
        >
          Open Dashboard
        </button>
      </footer>
    </div>
  );
}
