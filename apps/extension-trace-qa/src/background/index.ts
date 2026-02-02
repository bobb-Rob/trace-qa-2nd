/**
 * Background Service Worker
 * Responsibilities: Session orchestration, permissions, message routing, state persistence
 */

console.log('[TraceQA] Background service worker started');

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[TraceQA] Received message:', message.type);

  switch (message.type) {
    case 'START_RECORDING':
      handleStartRecording(message.payload, sendResponse);
      return true;

    case 'STOP_RECORDING':
      handleStopRecording(message.payload, sendResponse);
      return true;

    case 'GET_RECORDING_STATUS':
      handleGetStatus(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
  if (command === 'start-recording') {
    console.log('[TraceQA] Keyboard shortcut triggered');
  }
});

async function handleStartRecording(
  payload: { sessionId: string; tabId: number; videoConfig: unknown },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    console.log('[TraceQA] Starting recording:', payload.sessionId);

    // TODO: Implement actual recording logic
    // 1. Create offscreen document
    // 2. Request getDisplayMedia
    // 3. Send stream to offscreen
    // 4. Update storage state

    sendResponse({ success: true, sessionId: payload.sessionId });
  } catch (error) {
    console.error('[TraceQA] Start recording error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleStopRecording(
  payload: { sessionId: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    console.log('[TraceQA] Stopping recording:', payload.sessionId);

    // TODO: Implement actual stop logic
    // 1. Send stop to offscreen
    // 2. Get blob from IndexedDB
    // 3. Upload to R2
    // 4. Return video URL

    sendResponse({ success: true, videoUrl: 'https://example.com/placeholder.webm' });
  } catch (error) {
    console.error('[TraceQA] Stop recording error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleGetStatus(sendResponse: (response: unknown) => void): Promise<void> {
  try {
    const data = await chrome.storage.local.get(['isRecording', 'sessionId', 'startTime']);
    sendResponse({
      success: true,
      isRecording: data.isRecording ?? false,
      sessionId: data.sessionId ?? null,
      startTime: data.startTime ?? null,
    });
  } catch (error) {
    console.error('[TraceQA] Get status error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
