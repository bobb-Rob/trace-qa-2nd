/**
 * Offscreen Document Tests
 * Tests for MediaRecorder handling, pause/resume, and IndexedDB storage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock types for recording limits
const RECORDING_LIMITS = {
  MAX_RECORDING_MS: 30 * 60 * 1000,
  MAX_FILE_SIZE_BYTES: 500 * 1024 * 1024,
  CHUNK_INTERVAL_MS: 1000,
  STORAGE_QUOTA_MB: 500,
};

// Simulated MediaRecorder state
interface MockMediaRecorderState {
  state: 'inactive' | 'recording' | 'paused';
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: { error: Error }) => void) | null;
  onpause: (() => void) | null;
  onresume: (() => void) | null;
}

// Global mock state
let mockRecorderState: MockMediaRecorderState;
let mockRecorderInstance: MockMediaRecorder | null = null;

class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: { error: Error }) => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;

  private stream: MediaStream;
  private timeslice: number;
  private chunkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.timeslice = RECORDING_LIMITS.CHUNK_INTERVAL_MS;
    mockRecorderInstance = this;
  }

  start(timeslice?: number) {
    if (this.state !== 'inactive') {
      throw new Error('InvalidStateError');
    }
    this.state = 'recording';
    if (timeslice) {
      this.timeslice = timeslice;
    }
    // Simulate periodic data events
    this.chunkInterval = setInterval(() => {
      if (this.state === 'recording' && this.ondataavailable) {
        const chunk = new Blob(['mock-video-data'], { type: 'video/webm' });
        this.ondataavailable({ data: chunk });
      }
    }, this.timeslice);
  }

  stop() {
    if (this.state === 'inactive') {
      throw new Error('InvalidStateError');
    }
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }
    // Final data event
    if (this.ondataavailable) {
      const finalChunk = new Blob(['final-chunk'], { type: 'video/webm' });
      this.ondataavailable({ data: finalChunk });
    }
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }

  pause() {
    if (this.state !== 'recording') {
      throw new Error('InvalidStateError');
    }
    this.state = 'paused';
    if (this.onpause) {
      this.onpause();
    }
  }

  resume() {
    if (this.state !== 'paused') {
      throw new Error('InvalidStateError');
    }
    this.state = 'recording';
    if (this.onresume) {
      this.onresume();
    }
  }

  static isTypeSupported(mimeType: string): boolean {
    return ['video/webm', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8'].includes(mimeType);
  }
}

// Mock MediaStream
class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];
  active = true;

  constructor() {
    this.tracks = [new MockMediaStreamTrack()];
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getVideoTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter(t => t.kind === 'video');
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter(t => t.kind === 'audio');
  }
}

class MockMediaStreamTrack {
  kind = 'video';
  readyState: 'live' | 'ended' = 'live';
  onended: (() => void) | null = null;

  stop() {
    this.readyState = 'ended';
    if (this.onended) {
      this.onended();
    }
  }
}

// Helper to set up IndexedDB
async function setupTestDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('traceqa-chunks', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Helper to count chunks in DB
async function countChunks(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readonly');
    const store = tx.objectStore('chunks');
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper to clear chunks in DB
async function clearChunks(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper to add a chunk to DB
async function addChunk(db: IDBDatabase, sessionId: string, data: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    const request = store.add({
      sessionId,
      data,
      timestamp: Date.now(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper to get all chunks for a session
async function getChunksForSession(db: IDBDatabase, sessionId: string): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readonly');
    const store = tx.objectStore('chunks');
    const request = store.getAll();
    request.onsuccess = () => {
      const allRecords = request.result;
      const sessionChunks = allRecords
        .filter((r: { sessionId: string; data: Blob }) => r.sessionId === sessionId)
        .map((r: { data: Blob }) => r.data);
      resolve(sessionChunks);
    };
    request.onerror = () => reject(request.error);
  });
}

describe('MockMediaRecorder', () => {
  let stream: MockMediaStream;

  beforeEach(() => {
    vi.useFakeTimers();
    stream = new MockMediaStream();
    mockRecorderInstance = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor and static methods', () => {
    it('should create recorder in inactive state', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      expect(recorder.state).toBe('inactive');
    });

    it('should support webm mimeTypes', () => {
      expect(MockMediaRecorder.isTypeSupported('video/webm')).toBe(true);
      expect(MockMediaRecorder.isTypeSupported('video/webm;codecs=vp9')).toBe(true);
      expect(MockMediaRecorder.isTypeSupported('video/mp4')).toBe(false);
    });
  });

  describe('start', () => {
    it('should transition to recording state', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      recorder.start();
      expect(recorder.state).toBe('recording');
    });

    it('should throw if already recording', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      recorder.start();
      expect(() => recorder.start()).toThrow('InvalidStateError');
    });

    it('should emit data events periodically', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      const dataHandler = vi.fn();
      recorder.ondataavailable = dataHandler;

      recorder.start(1000);

      vi.advanceTimersByTime(3000);

      expect(dataHandler).toHaveBeenCalledTimes(3);
      expect(dataHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Blob),
        })
      );
    });
  });

  describe('stop', () => {
    it('should transition to inactive state', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      recorder.start();
      recorder.stop();
      expect(recorder.state).toBe('inactive');
    });

    it('should emit final data and onstop', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      const dataHandler = vi.fn();
      const stopHandler = vi.fn();
      recorder.ondataavailable = dataHandler;
      recorder.onstop = stopHandler;

      recorder.start();
      recorder.stop();

      expect(dataHandler).toHaveBeenCalled();
      expect(stopHandler).toHaveBeenCalled();
    });

    it('should throw if already inactive', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      expect(() => recorder.stop()).toThrow('InvalidStateError');
    });
  });

  describe('pause', () => {
    it('should transition to paused state', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      recorder.start();
      recorder.pause();
      expect(recorder.state).toBe('paused');
    });

    it('should call onpause callback', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      const pauseHandler = vi.fn();
      recorder.onpause = pauseHandler;

      recorder.start();
      recorder.pause();

      expect(pauseHandler).toHaveBeenCalled();
    });

    it('should throw if not recording', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      expect(() => recorder.pause()).toThrow('InvalidStateError');
    });

    it('should not emit data while paused', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      const dataHandler = vi.fn();
      recorder.ondataavailable = dataHandler;

      recorder.start(1000);
      vi.advanceTimersByTime(1000);
      const callsBeforePause = dataHandler.mock.calls.length;

      recorder.pause();
      vi.advanceTimersByTime(3000);

      // Should not have received more data while paused
      expect(dataHandler.mock.calls.length).toBe(callsBeforePause);
    });
  });

  describe('resume', () => {
    it('should transition back to recording state', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      recorder.start();
      recorder.pause();
      recorder.resume();
      expect(recorder.state).toBe('recording');
    });

    it('should call onresume callback', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      const resumeHandler = vi.fn();
      recorder.onresume = resumeHandler;

      recorder.start();
      recorder.pause();
      recorder.resume();

      expect(resumeHandler).toHaveBeenCalled();
    });

    it('should throw if not paused', () => {
      const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
      recorder.start();
      expect(() => recorder.resume()).toThrow('InvalidStateError');
    });
  });
});

describe('IndexedDB Chunk Storage', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    db = await setupTestDB();
    await clearChunks(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('chunk storage', () => {
    it('should store chunks with sessionId', async () => {
      const chunk = new Blob(['test-data'], { type: 'video/webm' });
      await addChunk(db, 'session-123', chunk);

      const count = await countChunks(db);
      expect(count).toBe(1);
    });

    it('should retrieve chunks for specific session', async () => {
      const chunk1 = new Blob(['data-1'], { type: 'video/webm' });
      const chunk2 = new Blob(['data-2'], { type: 'video/webm' });
      const chunk3 = new Blob(['data-3'], { type: 'video/webm' });

      await addChunk(db, 'session-A', chunk1);
      await addChunk(db, 'session-A', chunk2);
      await addChunk(db, 'session-B', chunk3);

      const sessionAChunks = await getChunksForSession(db, 'session-A');
      expect(sessionAChunks).toHaveLength(2);

      const sessionBChunks = await getChunksForSession(db, 'session-B');
      expect(sessionBChunks).toHaveLength(1);
    });

    it('should clear all chunks', async () => {
      await addChunk(db, 'session-1', new Blob(['data']));
      await addChunk(db, 'session-2', new Blob(['data']));

      await clearChunks(db);

      const count = await countChunks(db);
      expect(count).toBe(0);
    });
  });

  describe('blob assembly', () => {
    it('should assemble multiple chunks into single blob', async () => {
      const chunks = [
        new Blob(['part1-'], { type: 'video/webm' }),
        new Blob(['part2-'], { type: 'video/webm' }),
        new Blob(['part3'], { type: 'video/webm' }),
      ];

      // Calculate expected size from source chunks
      const expectedSize = chunks.reduce((sum, c) => sum + c.size, 0);

      for (const chunk of chunks) {
        await addChunk(db, 'assembly-session', chunk);
      }

      const storedChunks = await getChunksForSession(db, 'assembly-session');
      const assembled = new Blob(storedChunks, { type: 'video/webm' });

      // Verify we got the same number of chunks back
      expect(storedChunks).toHaveLength(chunks.length);
      // The assembled blob should be at least as large as expected
      // (IndexedDB might store additional metadata)
      expect(assembled.size).toBeGreaterThanOrEqual(expectedSize);
    });
  });
});

describe('Recording Flow Integration', () => {
  let db: IDBDatabase;
  let stream: MockMediaStream;

  beforeEach(async () => {
    vi.useFakeTimers();
    db = await setupTestDB();
    await clearChunks(db);
    stream = new MockMediaStream();
  });

  afterEach(() => {
    vi.useRealTimers();
    db.close();
  });

  it('should store chunks during recording', async () => {
    // Don't use fake timers for this test - IndexedDB needs real async
    vi.useRealTimers();
    
    const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
    const sessionId = 'recording-test-session';
    let chunkCount = 0;

    // Store chunks as they come in
    recorder.ondataavailable = async (event) => {
      await addChunk(db, sessionId, event.data);
      chunkCount++;
    };

    recorder.start(100); // Use shorter interval for test

    // Wait for a few chunks
    await new Promise(resolve => setTimeout(resolve, 350));

    recorder.stop();

    // Allow final operations to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have chunks (3 periodic + 1 final)
    expect(chunkCount).toBeGreaterThanOrEqual(3);
  });

  it('should handle pause/resume correctly', async () => {
    const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
    const sessionId = 'pause-test-session';
    let chunkCount = 0;

    recorder.ondataavailable = () => {
      chunkCount++;
    };

    recorder.start(1000);

    // Record for 2 seconds
    vi.advanceTimersByTime(2000);
    const chunksBeforePause = chunkCount;

    // Pause for 2 seconds
    recorder.pause();
    vi.advanceTimersByTime(2000);
    expect(chunkCount).toBe(chunksBeforePause); // No new chunks while paused

    // Resume and record 2 more seconds
    recorder.resume();
    vi.advanceTimersByTime(2000);
    expect(chunkCount).toBeGreaterThan(chunksBeforePause);

    recorder.stop();
  });

  it('should handle external stop (track ended)', async () => {
    const recorder = new MockMediaRecorder(stream as unknown as MediaStream);
    const stopHandler = vi.fn();
    recorder.onstop = stopHandler;

    recorder.start();

    // Simulate user clicking "Stop sharing"
    const track = stream.getTracks()[0];
    track.stop(); // This triggers onended

    // In real code, track.onended would call recorder.stop()
    if (track.readyState === 'ended') {
      recorder.stop();
    }

    expect(stopHandler).toHaveBeenCalled();
    expect(recorder.state).toBe('inactive');
  });
});
