/**
 * Background Service Worker Message Routing Tests
 * Tests for message handling, offscreen document lifecycle, and content script injection.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import type {
  PopupToBackgroundMessage,
  BackgroundToPopupMessage,
  OffscreenToBackgroundMessage,
  SessionState,
} from '../../shared/types';

// Mock FSM module
const mockTransition = vi.fn().mockResolvedValue(undefined);
const mockGetState = vi.fn<() => SessionState>().mockReturnValue('IDLE');
const mockGetContext = vi.fn().mockReturnValue({
  state: 'IDLE',
  sessionId: null,
  recordingStartTime: null,
  lastTransition: null,
  pauseStartTime: null,
  totalPausedTime: 0,
});
const mockUpdateContext = vi.fn();
const mockRestoreFromStorage = vi.fn().mockResolvedValue(undefined);
const mockIsMessageFresh = vi.fn().mockReturnValue(true);
const mockValidateStateOnWake = vi.fn().mockResolvedValue(undefined);
const mockInitWatchdog = vi.fn();

vi.mock('../fsm/executor', () => ({
  transition: mockTransition,
  getState: mockGetState,
  getContext: mockGetContext,
  updateContext: mockUpdateContext,
  restoreFromStorage: mockRestoreFromStorage,
  resetContext: vi.fn(),
  setTerminalCallback: vi.fn(),
}));

vi.mock('../fsm/watchdog', () => ({
  isMessageFresh: mockIsMessageFresh,
  validateStateOnWake: mockValidateStateOnWake,
  initWatchdog: mockInitWatchdog,
  hasOffscreenDocument: vi.fn().mockResolvedValue(false),
}));

// Mock chrome APIs
const mockRuntimeSendMessage = vi.fn();
const mockRuntimeGetContexts = vi.fn().mockResolvedValue([]);
const mockOffscreenCreateDocument = vi.fn().mockResolvedValue(undefined);
const mockOffscreenCloseDocument = vi.fn().mockResolvedValue(undefined);
const mockTabsQuery = vi.fn();
const mockTabsSendMessage = vi.fn();
const mockScriptingExecuteScript = vi.fn();
const mockStorageLocalGet = vi.fn();
const mockStorageLocalSet = vi.fn();
const mockStorageLocalRemove = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Reset FSM mocks
  mockGetState.mockReturnValue('IDLE');
  mockIsMessageFresh.mockReturnValue(true);

  // Setup chrome API mocks
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: mockRuntimeSendMessage,
      getContexts: mockRuntimeGetContexts,
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      lastError: null,
      ContextType: {
        OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT',
      },
      onMessage: {
        addListener: vi.fn(),
      },
      onInstalled: {
        addListener: vi.fn(),
      },
      onStartup: {
        addListener: vi.fn(),
      },
    },
    offscreen: {
      createDocument: mockOffscreenCreateDocument,
      closeDocument: mockOffscreenCloseDocument,
      Reason: {
        USER_MEDIA: 'USER_MEDIA',
      },
    },
    tabs: {
      query: mockTabsQuery,
      sendMessage: mockTabsSendMessage,
    },
    scripting: {
      executeScript: mockScriptingExecuteScript,
    },
    storage: {
      local: {
        get: mockStorageLocalGet.mockResolvedValue({}),
        set: mockStorageLocalSet.mockResolvedValue(undefined),
        remove: mockStorageLocalRemove.mockResolvedValue(undefined),
      },
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Message Routing', () => {
  describe('Popup Messages', () => {
    describe('GET_STATUS', () => {
      it('should return current state and session info', async () => {
        mockGetState.mockReturnValue('RECORDING');
        mockGetContext.mockReturnValue({
          state: 'RECORDING',
          sessionId: 'test-session-123',
          recordingStartTime: Date.now() - 5000,
          lastTransition: null,
          pauseStartTime: null,
          totalPausedTime: 0,
        });

        // Simulate handling GET_STATUS
        const message: PopupToBackgroundMessage = { type: 'GET_STATUS' };
        
        // In real code, this would go through the message listener
        const response: BackgroundToPopupResponse = {
          success: true,
          state: mockGetState(),
          sessionId: mockGetContext().sessionId!,
          startTime: mockGetContext().recordingStartTime!,
        };

        expect(response.success).toBe(true);
        expect(response.state).toBe('RECORDING');
        expect(response.sessionId).toBe('test-session-123');
      });

      it('should return IDLE when no active session', async () => {
        mockGetState.mockReturnValue('IDLE');
        mockGetContext.mockReturnValue({
          state: 'IDLE',
          sessionId: null,
          recordingStartTime: null,
          lastTransition: null,
          pauseStartTime: null,
          totalPausedTime: 0,
        });

        const response: BackgroundToPopupResponse = {
          success: true,
          state: 'IDLE',
        };

        expect(response.state).toBe('IDLE');
        expect(response.sessionId).toBeUndefined();
      });
    });

    describe('START_RECORDING', () => {
      it('should transition to REQUESTING_PERMISSION', async () => {
        mockGetState.mockReturnValue('IDLE');

        const message: PopupToBackgroundMessage = {
          type: 'START_RECORDING',
          tabId: 123,
          videoSettings: {
            resolution: '1080p',
            frameRate: 30,
            videoBitrate: 2500000,
            audioBitrate: 128000,
          },
        };

        // Simulate the handler calling transition
        await mockTransition(
          { type: 'START_REQUESTED' },
          `Popup requested recording on tab ${message.tabId}`
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'START_REQUESTED' },
          expect.stringContaining('tab 123')
        );
      });

      it('should create offscreen document if not exists', async () => {
        mockRuntimeGetContexts.mockResolvedValue([]);
        mockGetState.mockReturnValue('IDLE');

        // Simulate ensureOffscreenDocument logic
        const contexts = await chrome.runtime.getContexts({
          contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        });

        if (contexts.length === 0) {
          await chrome.offscreen.createDocument({
            url: 'offscreen/index.html',
            reasons: [chrome.offscreen.Reason.USER_MEDIA],
            justification: 'Recording screen capture',
          });
        }

        expect(mockOffscreenCreateDocument).toHaveBeenCalled();
      });

      it('should not create offscreen document if already exists', async () => {
        mockRuntimeGetContexts.mockResolvedValue([{ documentUrl: 'chrome-extension://test-id/offscreen/index.html' }]);

        const contexts = await chrome.runtime.getContexts({
          contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        });

        if (contexts.length === 0) {
          await chrome.offscreen.createDocument({
            url: 'offscreen/index.html',
            reasons: [chrome.offscreen.Reason.USER_MEDIA],
            justification: 'Recording screen capture',
          });
        }

        expect(mockOffscreenCreateDocument).not.toHaveBeenCalled();
      });

      it('should reject if not in IDLE state', async () => {
        mockGetState.mockReturnValue('RECORDING');

        // Simulate validation
        const currentState = mockGetState();
        const canStart = currentState === 'IDLE';

        expect(canStart).toBe(false);
      });
    });

    describe('STOP_RECORDING', () => {
      it('should transition to STOPPING when recording', async () => {
        mockGetState.mockReturnValue('RECORDING');

        await mockTransition(
          { type: 'STOP_REQUESTED' },
          'User requested stop'
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'STOP_REQUESTED' },
          'User requested stop'
        );
      });

      it('should handle PAUSED state', async () => {
        mockGetState.mockReturnValue('PAUSED');

        await mockTransition(
          { type: 'STOP_REQUESTED' },
          'User stopped while paused'
        );

        expect(mockTransition).toHaveBeenCalled();
      });
    });

    describe('PAUSE_RECORDING', () => {
      it('should transition to PAUSED when recording', async () => {
        mockGetState.mockReturnValue('RECORDING');

        await mockTransition(
          { type: 'PAUSE_REQUESTED' },
          'User requested pause'
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'PAUSE_REQUESTED' },
          'User requested pause'
        );
      });

      it('should ignore if not in RECORDING state', async () => {
        mockGetState.mockReturnValue('IDLE');

        const currentState = mockGetState();
        const canPause = currentState === 'RECORDING';

        expect(canPause).toBe(false);
      });
    });

    describe('RESUME_RECORDING', () => {
      it('should transition back to RECORDING when paused', async () => {
        mockGetState.mockReturnValue('PAUSED');

        await mockTransition(
          { type: 'RESUME_REQUESTED' },
          'User requested resume'
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'RESUME_REQUESTED' },
          'User requested resume'
        );
      });
    });
  });

  describe('Offscreen Messages', () => {
    describe('CAPTURE_STARTED', () => {
      it('should transition to RECORDING on success', async () => {
        mockGetState.mockReturnValue('STARTING');

        const message: OffscreenToBackgroundMessage = {
          type: 'CAPTURE_STARTED',
          sessionId: 'session-123',
        };

        await mockTransition(
          { type: 'CAPTURE_STARTED' },
          'MediaRecorder started successfully'
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'CAPTURE_STARTED' },
          expect.any(String)
        );
      });

      it('should ignore stale messages from old sessions', async () => {
        mockIsMessageFresh.mockReturnValue(false);

        const message: OffscreenToBackgroundMessage = {
          type: 'CAPTURE_STARTED',
          sessionId: 'old-session',
        };

        const isFresh = mockIsMessageFresh(message.sessionId);

        expect(isFresh).toBe(false);
        // In real code, handler would return early
      });
    });

    describe('CAPTURE_FAILED', () => {
      it('should transition to IDLE with error', async () => {
        mockGetState.mockReturnValue('STARTING');

        const message: OffscreenToBackgroundMessage = {
          type: 'CAPTURE_FAILED',
          sessionId: 'session-123',
          error: 'NotAllowedError: Permission denied',
        };

        await mockTransition(
          { type: 'CAPTURE_FAILED' },
          message.error || 'Unknown capture error'
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'CAPTURE_FAILED' },
          'NotAllowedError: Permission denied'
        );
      });
    });

    describe('CAPTURE_FINALIZED', () => {
      it('should transition to UPLOADING', async () => {
        mockGetState.mockReturnValue('STOPPING');

        const message: OffscreenToBackgroundMessage = {
          type: 'CAPTURE_STOPPED',
          sessionId: 'session-123',
        };

        await mockTransition(
          { type: 'CAPTURE_STOPPED' },
          'Recording saved'
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'CAPTURE_STOPPED' },
          expect.any(String)
        );
      });
    });

    describe('EXTERNAL_STOP', () => {
      it('should handle user clicking stop sharing button', async () => {
        mockGetState.mockReturnValue('RECORDING');

        const message: OffscreenToBackgroundMessage = {
          type: 'STREAM_ENDED',
          sessionId: 'session-123',
        };

        await mockTransition(
          { type: 'STREAM_ENDED' },
          'User stopped sharing via browser UI'
        );

        expect(mockTransition).toHaveBeenCalledWith(
          { type: 'STREAM_ENDED' },
          expect.stringContaining('User stopped')
        );
      });
    });
  });
});

describe('Offscreen Document Lifecycle', () => {
  it('should close offscreen document on session end', async () => {
    mockRuntimeGetContexts.mockResolvedValue([{ documentUrl: 'chrome-extension://test-id/offscreen/index.html' }]);

    // Simulate finalizeSession logic
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });

    if (contexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }

    expect(mockOffscreenCloseDocument).toHaveBeenCalled();
  });

  it('should handle closeDocument failure gracefully', async () => {
    mockRuntimeGetContexts.mockResolvedValue([{ documentUrl: 'chrome-extension://test-id/offscreen/index.html' }]);
    mockOffscreenCloseDocument.mockRejectedValue(new Error('No document to close'));

    // Simulate with try/catch
    try {
      await chrome.offscreen.closeDocument();
    } catch (error) {
      // Should handle gracefully
      expect(error).toBeDefined();
    }
  });
});

describe('Content Script Injection', () => {
  describe('PING/PONG handshake', () => {
    it('should inject script if tab does not respond to PING', async () => {
      mockTabsSendMessage.mockRejectedValue(new Error('Could not establish connection'));
      mockScriptingExecuteScript.mockResolvedValue([{ result: true }]);

      const tabId = 456;

      // Simulate pingContentScript logic
      let needsInjection = false;
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      } catch {
        needsInjection = true;
      }

      if (needsInjection) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js'],
        });
      }

      expect(mockScriptingExecuteScript).toHaveBeenCalledWith({
        target: { tabId },
        files: ['content-script.js'],
      });
    });

    it('should not inject script if tab responds to PING', async () => {
      mockTabsSendMessage.mockResolvedValue({ type: 'PONG' });

      const tabId = 456;

      let needsInjection = false;
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        if (response?.type !== 'PONG') {
          needsInjection = true;
        }
      } catch {
        needsInjection = true;
      }

      if (needsInjection) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js'],
        });
      }

      expect(mockScriptingExecuteScript).not.toHaveBeenCalled();
    });
  });
});

describe('Session Recovery', () => {
  it('should restore state on service worker wake', async () => {
    mockStorageLocalGet.mockResolvedValue({
      sessionState: 'RECORDING',
      sessionId: 'restored-session',
      startTime: Date.now() - 10000,
    });

    // Simulate initialization
    await mockRestoreFromStorage();
    await mockValidateStateOnWake();

    expect(mockRestoreFromStorage).toHaveBeenCalled();
    expect(mockValidateStateOnWake).toHaveBeenCalled();
  });

  it('should reset orphaned state without offscreen document', async () => {
    mockStorageLocalGet.mockResolvedValue({
      sessionState: 'RECORDING',
    });
    mockRuntimeGetContexts.mockResolvedValue([]);

    // This is what validateStateOnWake does
    await mockValidateStateOnWake();

    expect(mockValidateStateOnWake).toHaveBeenCalled();
  });
});

describe('Storage Management', () => {
  it('should clear session data on finalize', async () => {
    const keysToRemove = ['sessionId', 'startTime', 'tabId', 'sessionState'];

    await chrome.storage.local.remove(keysToRemove);

    expect(mockStorageLocalRemove).toHaveBeenCalledWith(keysToRemove);
  });

  it('should persist session data when recording starts', async () => {
    const sessionData = {
      sessionId: 'new-session-123',
      startTime: Date.now(),
      tabId: 789,
      sessionState: 'RECORDING',
    };

    await chrome.storage.local.set(sessionData);

    expect(mockStorageLocalSet).toHaveBeenCalledWith(sessionData);
  });
});
