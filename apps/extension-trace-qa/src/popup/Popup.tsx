import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { StatusIndicator } from './components/StatusIndicator';
import { RecordingButton } from './components/RecordingButton';
import { RecordingInfo } from './components/RecordingInfo';
import { ErrorMessage } from './components/ErrorMessage';
import { VideoSettings } from './components/VideoSettings';
import { useRecordingState } from './hooks/useRecordingState';

export function Popup(): React.ReactElement {
  const { state, videoConfig, setVideoConfig, startRecording, stopRecording } = useRecordingState();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStart = async (): Promise<void> => {
    try {
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

  const handleViewBugs = (): void => {
    chrome.tabs.create({ url: 'https://app.traceqa.com/bugs' });
  };

  const handleDismissError = (): void => {
    setLocalError(null);
  };

  const displayError = localError ?? state.error;

  return (
    <div data-testid="popup-container" className="w-80 min-h-[400px] p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header data-testid="popup-header" className="text-center mb-5">
        <h1 data-testid="app-title" className="text-xl font-bold text-gray-900">TraceQA</h1>
        <p className="text-xs text-gray-500 mt-1">Smart Bug Capture</p>
      </header>

      {/* Main Content */}
      <main className="space-y-4">
        <StatusIndicator isRecording={state.isRecording} />
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
          onStart={handleStart}
          onStop={handleStop}
          isLoading={state.isLoading}
          disabled={state.isLoading}
        />

        <RecordingInfo
          startTime={state.startTime}
          isVisible={state.isRecording}
        />

        <button
          type="button"
          onClick={handleViewBugs}
          data-testid="view-bugs-btn"
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          <span>View Captured Bugs</span>
          <ExternalLink size={16} />
        </button>
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
