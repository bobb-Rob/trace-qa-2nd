/**
 * Test Setup File
 * Configures global mocks for Chrome APIs and other browser APIs.
 */

import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Chrome API Mocks
// ─────────────────────────────────────────────────────────────

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

const messageListeners: MessageListener[] = [];

const mockChrome = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    onMessage: {
      addListener: vi.fn((listener: MessageListener) => {
        messageListeners.push(listener);
      }),
      removeListener: vi.fn((listener: MessageListener) => {
        const index = messageListeners.indexOf(listener);
        if (index > -1) {
          messageListeners.splice(index, 1);
        }
      }),
    },
    getURL: vi.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
    getContexts: vi.fn().mockResolvedValue([]),
    lastError: null as chrome.runtime.LastError | null,
    id: 'mock-extension-id',
  },
  storage: {
    local: {
      get: vi.fn().mockImplementation((keys: string | string[] | null) => {
        return Promise.resolve({});
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  offscreen: {
    createDocument: vi.fn().mockResolvedValue(undefined),
    closeDocument: vi.fn().mockResolvedValue(undefined),
    Reason: {
      USER_MEDIA: 'USER_MEDIA',
      AUDIO_PLAYBACK: 'AUDIO_PLAYBACK',
      CLIPBOARD: 'CLIPBOARD',
    },
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([{ result: undefined }]),
  },
  downloads: {
    download: vi.fn().mockImplementation((options, callback) => {
      if (callback) {
        callback(1); // downloadId
      }
      return 1;
    }),
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// Assign to globalThis
globalThis.chrome = mockChrome as unknown as typeof chrome;

// ─────────────────────────────────────────────────────────────
// MediaRecorder Mock
// ─────────────────────────────────────────────────────────────

interface MockMediaRecorderOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
}

class MockMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);

  stream: MediaStream;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  videoBitsPerSecond: number;

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: { error: Error }) => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;

  private timeslice: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(stream: MediaStream, options?: MockMediaRecorderOptions) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? 'video/webm';
    this.videoBitsPerSecond = options?.videoBitsPerSecond ?? 2500000;
  }

  start(timeslice?: number): void {
    this.state = 'recording';
    this.timeslice = timeslice ?? null;

    if (this.timeslice) {
      this.intervalId = setInterval(() => {
        if (this.state === 'recording' && this.ondataavailable) {
          // Simulate a chunk of data
          const chunk = new Blob(['mock-video-data'], { type: this.mimeType });
          this.ondataavailable({ data: chunk });
        }
      }, this.timeslice);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Emit final chunk
    if (this.ondataavailable) {
      const chunk = new Blob(['mock-final-data'], { type: this.mimeType });
      this.ondataavailable({ data: chunk });
    }

    this.state = 'inactive';

    if (this.onstop) {
      this.onstop();
    }
  }

  pause(): void {
    if (this.state === 'recording') {
      this.state = 'paused';
      if (this.onpause) {
        this.onpause();
      }
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'recording';
      if (this.onresume) {
        this.onresume();
      }
    }
  }

  requestData(): void {
    if (this.ondataavailable) {
      const chunk = new Blob(['mock-requested-data'], { type: this.mimeType });
      this.ondataavailable({ data: chunk });
    }
  }
}

globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

// ─────────────────────────────────────────────────────────────
// MediaStream Mock
// ─────────────────────────────────────────────────────────────

class MockMediaStreamTrack {
  kind: 'video' | 'audio';
  id: string;
  enabled = true;
  readyState: 'live' | 'ended' = 'live';
  onended: (() => void) | null = null;

  constructor(kind: 'video' | 'audio') {
    this.kind = kind;
    this.id = `mock-track-${kind}-${Math.random().toString(36).substr(2, 9)}`;
  }

  stop(): void {
    this.readyState = 'ended';
    if (this.onended) {
      this.onended();
    }
  }

  clone(): MockMediaStreamTrack {
    return new MockMediaStreamTrack(this.kind);
  }
}

class MockMediaStream {
  id: string;
  private tracks: MockMediaStreamTrack[];

  constructor(tracks?: MockMediaStreamTrack[]) {
    this.id = `mock-stream-${Math.random().toString(36).substr(2, 9)}`;
    this.tracks = tracks ?? [new MockMediaStreamTrack('video')];
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getVideoTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }

  addTrack(track: MockMediaStreamTrack): void {
    this.tracks.push(track);
  }

  removeTrack(track: MockMediaStreamTrack): void {
    const index = this.tracks.indexOf(track);
    if (index > -1) {
      this.tracks.splice(index, 1);
    }
  }
}

globalThis.MediaStream = MockMediaStream as unknown as typeof MediaStream;

// ─────────────────────────────────────────────────────────────
// navigator.mediaDevices Mock
// ─────────────────────────────────────────────────────────────

const mockMediaDevices = {
  getDisplayMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
  getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
  enumerateDevices: vi.fn().mockResolvedValue([]),
};

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true,
  configurable: true,
});

// ─────────────────────────────────────────────────────────────
// URL Mock
// ─────────────────────────────────────────────────────────────

const originalURL = globalThis.URL;
const blobUrls = new Map<string, Blob>();

globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
  const url = `blob:mock-${Math.random().toString(36).substr(2, 9)}`;
  blobUrls.set(url, blob);
  return url;
});

globalThis.URL.revokeObjectURL = vi.fn((url: string) => {
  blobUrls.delete(url);
});

// ─────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Simulate sending a message to all registered listeners.
 * Useful for testing message handlers.
 */
export function simulateMessage(
  message: unknown,
  sender: Partial<chrome.runtime.MessageSender> = {}
): Promise<unknown> {
  return new Promise((resolve) => {
    const fullSender: chrome.runtime.MessageSender = {
      id: 'mock-extension-id',
      ...sender,
    };

    let responded = false;
    const sendResponse = (response?: unknown) => {
      if (!responded) {
        responded = true;
        resolve(response);
      }
    };

    for (const listener of messageListeners) {
      const result = listener(message, fullSender, sendResponse);
      if (result === true) {
        // Async response expected
        return;
      }
    }

    // If no async response, resolve immediately
    if (!responded) {
      resolve(undefined);
    }
  });
}

/**
 * Reset all Chrome API mocks.
 */
export function resetChromeMocks(): void {
  vi.clearAllMocks();
  messageListeners.length = 0;
}

/**
 * Get the mock chrome object for direct manipulation in tests.
 */
export function getMockChrome(): typeof mockChrome {
  return mockChrome;
}

/**
 * Get the mock MediaRecorder class.
 */
export function getMockMediaRecorder(): typeof MockMediaRecorder {
  return MockMediaRecorder;
}

/**
 * Create a mock MediaStream.
 */
export function createMockMediaStream(): MockMediaStream {
  return new MockMediaStream();
}

/**
 * Simulate a MediaStream track ending (user clicked "Stop sharing").
 */
export function simulateTrackEnded(stream: MockMediaStream): void {
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.stop();
  }
}
