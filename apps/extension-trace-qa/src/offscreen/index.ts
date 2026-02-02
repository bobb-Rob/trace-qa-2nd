/**
 * Offscreen Document - Media Engine
 * Responsibilities: MediaRecorder, blob management, chunk accumulation
 */

let mediaRecorder: MediaRecorder | null = null;
let currentSessionId: string | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[TraceQA:Offscreen] Received message:', message.type);

  switch (message.type) {
    case 'OFFSCREEN_START_CAPTURE':
      handleStartCapture(message.payload, sendResponse);
      return true;

    case 'OFFSCREEN_STOP_CAPTURE':
      handleStopCapture(message.payload, sendResponse);
      return true;

    default:
      return false;
  }
});

async function handleStartCapture(
  payload: {
    sessionId: string;
    streamId: string;
    config: { mimeType: string; videoBitsPerSecond: number };
  },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      sendResponse({ success: false, error: 'Already recording' });
      return;
    }

    currentSessionId = payload.sessionId;

    // TODO: Get stream from streamId and start recording
    // const stream = await getMediaStream(payload.streamId);

    sendResponse({ success: true });
  } catch (error) {
    console.error('[TraceQA:Offscreen] Start capture error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleStopCapture(
  payload: { sessionId: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    if (!mediaRecorder || payload.sessionId !== currentSessionId) {
      sendResponse({ success: false, error: 'No matching recording' });
      return;
    }

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('[TraceQA:Offscreen] Stop capture error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

console.log('[TraceQA:Offscreen] Offscreen document loaded');
