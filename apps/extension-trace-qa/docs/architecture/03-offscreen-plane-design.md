# Offscreen Plane Design Specification

**Document Version:** 1.0
**Date:** 2026-02-05
**Status:** Draft

---

## Overview

The Offscreen plane is a **pure media execution engine**. It runs in an offscreen document (a hidden DOM context) and is responsible for:

- Acquiring display and audio streams
- Mixing audio sources into a single track
- Recording via MediaRecorder
- Chunking and storing video data
- Reporting events back to the orchestrator

**Critical Constraints:**
- The Offscreen plane **never** knows about FSM states
- The Offscreen plane **never** makes policy decisions
- The Offscreen plane **never** interacts with UI
- Audio is **just another stream** in the pipeline

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OFFSCREEN DOCUMENT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        CAPTURE CONTROLLER                               │ │
│  │  Coordinates modules, handles commands, reports events                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│            ┌─────────────────────────┼─────────────────────────┐            │
│            │                         │                         │            │
│            ▼                         ▼                         ▼            │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │  STREAM MANAGER  │     │ RECORDER MANAGER │     │  CHUNK MANAGER   │    │
│  │                  │     │                  │     │                  │    │
│  │ • getDisplayMedia│     │ • MediaRecorder  │     │ • ondataavailable│    │
│  │ • track lifecycle│     │ • pause/resume   │     │ • blob handling  │    │
│  │ • audio mixing   │     │ • error handling │     │ • size tracking  │    │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘    │
│           │                        │                        │               │
│           │                        │                        ▼               │
│           │                        │               ┌──────────────────┐    │
│           │                        │               │ STORAGE MANAGER  │    │
│           │                        │               │                  │    │
│           │                        │               │ • IndexedDB ops  │    │
│           │                        │               │ • chunk writes   │    │
│           │                        │               │ • finalization   │    │
│           │                        │               └──────────────────┘    │
│           │                        │                                        │
│           │    ┌───────────────────┘                                        │
│           │    │                                                            │
│           ▼    ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AUDIO SUBSYSTEM                              │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │   │
│  │  │   AUDIO     │    │   AUDIO     │    │   AUDIO     │              │   │
│  │  │  MANAGER    │───►│   MIXER     │───►│   LEVELS    │              │   │
│  │  │             │    │             │    │             │              │   │
│  │  │ getUserMedia│    │ AudioContext│    │AnalyserNode │              │   │
│  │  │ mic stream  │    │ GainNodes   │    │ level data  │              │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Media Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MEDIA PIPELINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    getDisplayMedia()                getUserMedia({ audio: true })           │
│          │                                    │                              │
│          ▼                                    ▼                              │
│    ┌───────────┐                       ┌───────────┐                        │
│    │   VIDEO   │                       │   MIC     │                        │
│    │   TRACK   │                       │   TRACK   │                        │
│    └─────┬─────┘                       └─────┬─────┘                        │
│          │                                   │                               │
│          │         ┌─────────────────────────┘                              │
│          │         │                                                        │
│          │         ▼                                                        │
│          │    ┌─────────────────────────────────────────┐                  │
│          │    │            AUDIO MIXER                   │                  │
│          │    │                                          │                  │
│          │    │  AudioContext                            │                  │
│          │    │       │                                  │                  │
│          │    │       ▼                                  │                  │
│          │    │  createMediaStreamSource(micTrack)       │                  │
│          │    │       │                                  │                  │
│          │    │       ▼                                  │                  │
│          │    │  ┌──────────┐                           │                  │
│          │    │  │ GainNode │ ◄── mute control (0 or 1) │                  │
│          │    │  └────┬─────┘                           │                  │
│          │    │       │                                  │                  │
│          │    │       ▼                                  │                  │
│          │    │  ┌─────────────┐    ┌─────────────┐     │                  │
│          │    │  │ Destination │    │AnalyserNode │     │ ──► level data   │
│          │    │  │   Node      │    │             │     │                  │
│          │    │  └──────┬──────┘    └─────────────┘     │                  │
│          │    │         │                                │                  │
│          │    │         ▼                                │                  │
│          │    │  MediaStreamDestination                  │                  │
│          │    │         │                                │                  │
│          │    │         ▼                                │                  │
│          │    │    MIXED AUDIO TRACK                     │                  │
│          │    └─────────┬───────────────────────────────┘                  │
│          │              │                                                   │
│          │    ┌─────────┘                                                   │
│          │    │                                                             │
│          ▼    ▼                                                             │
│    ┌─────────────────────────────────────────┐                             │
│    │         COMBINED MEDIA STREAM            │                             │
│    │                                          │                             │
│    │  tracks: [videoTrack, mixedAudioTrack]   │                             │
│    └────────────────────┬────────────────────┘                             │
│                         │                                                   │
│                         ▼                                                   │
│    ┌─────────────────────────────────────────┐                             │
│    │           MEDIA RECORDER                 │                             │
│    │                                          │                             │
│    │  mimeType: 'video/webm; codecs=vp9'     │                             │
│    │  videoBitsPerSecond: based on quality    │                             │
│    └────────────────────┬────────────────────┘                             │
│                         │                                                   │
│                         │ ondataavailable                                   │
│                         ▼                                                   │
│    ┌─────────────────────────────────────────┐                             │
│    │           CHUNK MANAGER                  │                             │
│    │                                          │                             │
│    │  • Receives Blob chunks                  │                             │
│    │  • Tracks chunk index                    │                             │
│    │  • Forwards to storage                   │                             │
│    └────────────────────┬────────────────────┘                             │
│                         │                                                   │
│                         ▼                                                   │
│    ┌─────────────────────────────────────────┐                             │
│    │          STORAGE MANAGER                 │                             │
│    │                                          │                             │
│    │  • IndexedDB writes                      │                             │
│    │  • Chunk retrieval                       │                             │
│    │  • Finalization (Blob assembly)          │                             │
│    └─────────────────────────────────────────┘                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

---

### 1. Capture Controller

#### Purpose
Top-level coordinator for the offscreen document. Receives commands, orchestrates modules, reports events.

#### What It Owns
- Session flags (sessionId, isCapturing, isPaused)
- Stop reason tracking (requested vs external)
- Module coordination sequence
- Command validation
- Event emission

#### What It Does NOT Own
- MediaRecorder instance (delegates to recorderManager)
- MediaStream instance (delegates to streamManager)
- IndexedDB operations (delegates to storageManager)
- Audio processing (delegates to audio subsystem)
- FSM state or transitions
- Policy decisions

#### Command Handling

| Command | Action |
|---------|--------|
| `START_CAPTURE` | Acquire streams → setup mixer → start recorder |
| `STOP_CAPTURE` | Stop recorder → finalize chunks → cleanup streams |
| `PAUSE_RECORDING` | Pause recorder (if supported) |
| `RESUME_RECORDING` | Resume recorder |
| `ENABLE_AUDIO` | Initialize audio subsystem |
| `DISABLE_AUDIO` | Tear down audio subsystem |
| `SET_MUTED` | Forward to audio mixer |

#### Events Emitted

| Event | Trigger |
|-------|---------|
| `STARTED` | Recorder successfully started |
| `PAUSED` | Recorder paused |
| `RESUMED` | Recorder resumed |
| `STOPPED` | Recorder stopped (by command) |
| `STREAM_ENDED` | Video track ended externally |
| `ERROR` | Any capture/storage error |
| `CHUNK_STORED` | Chunk successfully written to IndexedDB |
| `AUDIO_LEVEL` | Periodic audio level update |

#### Interface Contract

```
// Commands (called by message handler)
start(config: CaptureConfig): Promise<void>
stop(sessionId: string): Promise<void>
pause(sessionId: string): Promise<void>
resume(sessionId: string): Promise<void>

// Audio commands
enableAudio(config: AudioConfig): Promise<void>
disableAudio(): Promise<void>
setMuted(muted: boolean): void

// Queries
isCapturing(): boolean
isPaused(): boolean
getSessionId(): string | null
```

---

### 2. Stream Manager

#### Purpose
Handles all MediaStream acquisition and lifecycle. This is where video and audio come together.

#### What It Owns
- `getDisplayMedia` calls
- Video track lifecycle
- `track.onended` handling
- Stream composition (combining video + audio)

#### What It Does NOT Own
- Recording (that's recorderManager)
- Audio acquisition (that's audioManager)
- Audio processing (that's audioMixer)

#### Stream Composition Strategy

```typescript
// Video-only capture
function createVideoOnlyStream(displayStream: MediaStream): MediaStream {
  return displayStream; // Pass through
}

// Video + Audio capture
function createCombinedStream(
  displayStream: MediaStream,
  mixedAudioTrack: MediaStreamTrack | null
): MediaStream {
  const tracks = [...displayStream.getVideoTracks()];

  if (mixedAudioTrack) {
    tracks.push(mixedAudioTrack);
  }

  return new MediaStream(tracks);
}
```

#### External Stop Detection

```typescript
videoTrack.onended = () => {
  // User stopped sharing, or tab was closed
  // Report event, don't make decisions
  emit('STREAM_ENDED', { reason: 'track_ended' });
};
```

#### Interface Contract

```
// Acquisition
acquireDisplayStream(constraints: DisplayMediaStreamConstraints): Promise<MediaStream>

// Composition
createRecordingStream(
  displayStream: MediaStream,
  audioTrack: MediaStreamTrack | null
): MediaStream

// Lifecycle
getVideoTrack(): MediaStreamTrack | null
stopAllTracks(): void
onStreamEnded(callback: () => void): void
```

---

### 3. Recorder Manager

#### Purpose
Owns the MediaRecorder lifecycle. Knows nothing about why it's recording or what's being recorded.

#### What It Owns
- MediaRecorder instance
- Recorder state (inactive, recording, paused)
- `ondataavailable` forwarding
- `onerror` handling
- MIME type selection

#### What It Does NOT Own
- MediaStream creation
- Chunk storage
- Stop decisions
- Audio processing

#### MIME Type Selection

```typescript
function selectMimeType(): string {
  const candidates = [
    'video/webm; codecs=vp9,opus',
    'video/webm; codecs=vp9',
    'video/webm; codecs=vp8,opus',
    'video/webm; codecs=vp8',
    'video/webm',
  ];

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  throw new Error('No supported video MIME type found');
}
```

#### Bitrate Configuration

| Quality | Video Bitrate | Description |
|---------|---------------|-------------|
| SD | 1,000,000 bps | 480p equivalent |
| HD | 2,500,000 bps | 720p equivalent |
| FHD | 5,000,000 bps | 1080p equivalent |

#### Interface Contract

```
// Lifecycle
start(stream: MediaStream, config: RecorderConfig): void
stop(): Promise<Blob[]>  // Returns any final chunks
pause(): void
resume(): void

// State
isRecording(): boolean
isPaused(): boolean

// Events
onDataAvailable(callback: (blob: Blob) => void): void
onError(callback: (error: Error) => void): void
onStop(callback: () => void): void
```

---

### 4. Audio Manager

#### Purpose
Handles microphone acquisition only. Returns a raw mic MediaStream.

#### What It Owns
- `getUserMedia({ audio })` calls
- Microphone permissions
- Device enumeration
- Mic stream lifecycle

#### What It Does NOT Own
- Audio processing
- Mixing
- Gain control
- Level analysis

#### Permission Handling

```
1. Request permission via getUserMedia
2. If denied, return null (audio disabled, not an error)
3. If granted, return mic MediaStream
4. Track can be stopped independently of video
```

#### Interface Contract

```
// Acquisition
acquireMicStream(deviceId?: string): Promise<MediaStream | null>

// Lifecycle
stopMicStream(): void
getMicTrack(): MediaStreamTrack | null

// Device
getAvailableDevices(): Promise<MediaDeviceInfo[]>
```

---

### 5. Audio Mixer

#### Purpose
Combines and processes audio using Web Audio API. Currently handles single source (mic), designed for future multi-source mixing.

#### What It Owns
- AudioContext
- MediaStreamAudioSourceNode (per source)
- GainNode (for mute/volume)
- MediaStreamAudioDestinationNode (output)
- Source routing

#### What It Does NOT Own
- Stream acquisition
- Level reporting (that's audioLevels)
- Permission handling

#### Audio Graph

```
                    ┌─────────────────────────────────────────┐
                    │              AudioContext                │
                    │                                          │
  Mic Stream ──────►│  MediaStreamSource ──► GainNode ──┬───► │ ──► Mixed Output
                    │                                   │     │
                    │                         (0 = mute)│     │
                    │                         (1 = on)  │     │
                    │                                   │     │
  [Future: Tab     │  MediaStreamSource ──► GainNode ──┤     │
   Audio]          │                                   │     │
                    │                                   ▼     │
                    │                           Destination   │
                    │                              Node       │
                    └─────────────────────────────────────────┘
```

#### Mute Implementation

```typescript
// Mute = set gain to 0 (not disconnect)
// This preserves the audio graph and allows instant unmute
function setMuted(muted: boolean): void {
  gainNode.gain.setValueAtTime(muted ? 0 : 1, audioContext.currentTime);
}
```

#### Interface Contract

```
// Lifecycle
init(): void
dispose(): void

// Sources
addSource(id: string, stream: MediaStream): void
removeSource(id: string): void

// Control
setMuted(muted: boolean): void
setVolume(volume: number): void  // 0.0 - 1.0

// Output
getMixedTrack(): MediaStreamTrack | null
```

---

### 6. Audio Levels

#### Purpose
Analyzes audio levels for UI visualization. Completely optional—can be disabled without affecting recording.

#### What It Owns
- AnalyserNode
- Level calculation
- Periodic sampling

#### What It Does NOT Own
- Audio routing
- Gain control
- Stream management

#### Level Calculation

```typescript
function calculateLevel(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  // RMS calculation
  const sum = data.reduce((acc, val) => acc + val * val, 0);
  const rms = Math.sqrt(sum / data.length);

  // Normalize to 0-100
  return Math.min(100, Math.round((rms / 128) * 100));
}
```

#### Interface Contract

```
// Setup
attachTo(audioContext: AudioContext, sourceNode: AudioNode): void
detach(): void

// Sampling
getLevel(): number  // 0-100
startSampling(intervalMs: number, callback: (level: number) => void): void
stopSampling(): void
```

---

### 7. Chunk Manager

#### Purpose
Handles the output of MediaRecorder's `ondataavailable` event. Prepares chunks for storage.

#### What It Owns
- Chunk indexing
- Chunk metadata (timestamp, size, index)
- Forwarding to storage

#### What It Does NOT Own
- MediaRecorder
- IndexedDB operations
- Blob assembly

#### Chunk Structure

```typescript
interface VideoChunk {
  sessionId: string;
  index: number;
  timestamp: number;  // When chunk was created
  size: number;       // Blob size in bytes
  blob: Blob;
}
```

#### Interface Contract

```
// Lifecycle
startSession(sessionId: string): void
endSession(): void

// Chunks
handleChunk(blob: Blob): Promise<void>
getChunkCount(): number
getTotalSize(): number
```

---

### 8. Storage Manager

#### Purpose
Handles all IndexedDB operations for video chunks. Pure storage, no business logic.

#### What It Owns
- IndexedDB database lifecycle
- Object store operations
- Chunk retrieval
- Blob assembly for download

#### What It Does NOT Own
- Chunk creation
- Recording logic
- Upload logic

#### IndexedDB Schema

```
Database: "traceqa-recordings"
Version: 1

Object Stores:
  - "chunks"
    - keyPath: ["sessionId", "index"]
    - indexes:
      - "by-session": sessionId
      - "by-timestamp": timestamp

  - "sessions"
    - keyPath: "sessionId"
    - data: { sessionId, startTime, chunkCount, totalSize, status }
```

#### Interface Contract

```
// Database
open(): Promise<IDBDatabase>
close(): void

// Chunks
storeChunk(chunk: VideoChunk): Promise<void>
getChunks(sessionId: string): Promise<VideoChunk[]>
deleteChunks(sessionId: string): Promise<void>

// Assembly
assembleBlob(sessionId: string): Promise<Blob>

// Sessions
createSession(sessionId: string): Promise<void>
updateSession(sessionId: string, updates: Partial<SessionMeta>): Promise<void>
getSession(sessionId: string): Promise<SessionMeta | null>
```

---

## Error Handling

### Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Permission | getUserMedia denied | Report, don't fail capture |
| Stream | Track ended unexpectedly | Report STREAM_ENDED event |
| Recorder | MediaRecorder error | Report ERROR event |
| Storage | IndexedDB write failed | Report ERROR event, attempt retry |
| Audio | AudioContext suspended | Attempt resume, fallback to no audio |

### Error Propagation

All errors are converted to events and sent to the orchestrator. The offscreen document never decides how to handle errors—it just reports them.

```typescript
// Error handling pattern
try {
  await someOperation();
} catch (error) {
  emit('ERROR', {
    code: 'OPERATION_FAILED',
    message: error.message,
    recoverable: true,  // Hint for orchestrator
  });
}
```

---

## Lifecycle Sequences

### Start Capture (with Audio)

```
1. Receive START_CAPTURE command
2. Validate no active session
3. Acquire display stream (getDisplayMedia)
4. Set up video track.onended handler
5. If audio enabled:
   a. Acquire mic stream (getUserMedia)
   b. Initialize AudioContext
   c. Create audio graph (source → gain → destination)
   d. Get mixed audio track
6. Create combined MediaStream (video + mixed audio)
7. Create MediaRecorder with combined stream
8. Set up ondataavailable → chunkManager
9. Create session in IndexedDB
10. Start MediaRecorder
11. Emit STARTED event
12. Start audio level sampling (if enabled)
```

### Stop Capture

```
1. Receive STOP_CAPTURE command
2. Validate session ID matches
3. Mark stop as "requested" (not external)
4. Stop audio level sampling
5. Stop MediaRecorder
6. Wait for final ondataavailable
7. Finalize all chunks to IndexedDB
8. Stop and release all media tracks
9. Dispose AudioContext
10. Update session status in IndexedDB
11. Emit STOPPED event
```

### External Stop (Stream Ended)

```
1. Video track.onended fires
2. Mark stop as "external"
3. Emit STREAM_ENDED event immediately
4. Wait for orchestrator to send STOP_CAPTURE
5. Continue with normal stop sequence
```

### Pause/Resume

```
Pause:
1. Receive PAUSE_RECORDING command
2. Call mediaRecorder.pause()
3. Emit PAUSED event
4. (Audio continues, duration tracking is orchestrator's job)

Resume:
1. Receive RESUME_RECORDING command
2. Call mediaRecorder.resume()
3. Emit RESUMED event
```

---

## Audio as Just Another Stream

The key architectural insight is that **audio is not special**. It follows the same pattern as video:

| Aspect | Video | Audio |
|--------|-------|-------|
| Acquisition | `getDisplayMedia()` | `getUserMedia()` |
| Track type | `MediaStreamTrack` (video) | `MediaStreamTrack` (audio) |
| Processing | None (pass-through) | AudioContext (mixing, gain) |
| Output | Track added to stream | Track added to stream |
| Lifecycle | Stop when capture ends | Stop when capture ends |

The mixer is just a transform that takes one or more audio inputs and produces one audio output. The output is a standard `MediaStreamTrack` that gets added to the recording stream just like the video track.

---

## Message Protocol

### Inbound Messages (from Background)

| Message Type | Payload | Response |
|--------------|---------|----------|
| `OFFSCREEN_START_CAPTURE` | `{ sessionId, tabId, videoConfig, audioConfig }` | `{ success, error? }` |
| `OFFSCREEN_STOP_CAPTURE` | `{ sessionId }` | `{ success, error? }` |
| `OFFSCREEN_PAUSE_RECORDING` | `{ sessionId }` | `{ success, error? }` |
| `OFFSCREEN_RESUME_RECORDING` | `{ sessionId }` | `{ success, error? }` |
| `OFFSCREEN_ENABLE_AUDIO` | `{ deviceId? }` | `{ success, error? }` |
| `OFFSCREEN_DISABLE_AUDIO` | `{}` | `{ success }` |
| `OFFSCREEN_SET_MUTED` | `{ muted: boolean }` | `{ success }` |

### Outbound Messages (to Background)

| Message Type | Payload | Trigger |
|--------------|---------|---------|
| `OFFSCREEN_STARTED` | `{ sessionId }` | Recorder started |
| `OFFSCREEN_PAUSED` | `{ sessionId }` | Recorder paused |
| `OFFSCREEN_RESUMED` | `{ sessionId }` | Recorder resumed |
| `OFFSCREEN_STOPPED` | `{ sessionId, chunkCount, totalSize }` | Recorder stopped |
| `OFFSCREEN_STREAM_ENDED` | `{ sessionId, reason }` | External stop |
| `OFFSCREEN_ERROR` | `{ sessionId?, code, message, recoverable }` | Any error |
| `OFFSCREEN_CHUNK_STORED` | `{ sessionId, index, size }` | Chunk written |
| `OFFSCREEN_AUDIO_LEVEL` | `{ level: number }` | Periodic (100ms) |

---

## File Structure (Target)

```
offscreen/
├── index.ts                      # Entry, message listener only
├── routing/
│   └── messageRouter.ts          # Command dispatch
├── controllers/
│   └── captureController.ts      # Top-level coordination
├── media/
│   ├── streamManager.ts          # Stream acquisition & composition
│   ├── recorderManager.ts        # MediaRecorder lifecycle
│   └── audio/
│       ├── audioManager.ts       # Mic acquisition
│       ├── audioMixer.ts         # Web Audio processing
│       └── audioLevels.ts        # Level analysis
├── data/
│   ├── chunkManager.ts           # Chunk handling
│   └── storageManager.ts         # IndexedDB operations
└── output/
    └── downloadManager.ts        # Blob download (if needed here)
```

---

## Testing Strategy

### Unit Tests

| Module | Test Focus |
|--------|------------|
| streamManager | Stream acquisition mocking, track lifecycle |
| recorderManager | State transitions, MIME type selection |
| audioMixer | Gain control, mute behavior |
| chunkManager | Indexing, size tracking |
| storageManager | IndexedDB operations (with fake-indexeddb) |

### Integration Tests

| Scenario | Modules Involved |
|----------|------------------|
| Video-only capture | stream + recorder + chunk + storage |
| Video + Audio capture | All modules |
| Pause/Resume | recorder + chunk |
| External stop | stream + captureController |
| Audio mute toggle | audioMixer |

### Manual Testing Checklist

- [ ] Screen sharing permission flow
- [ ] Microphone permission flow
- [ ] Recording produces playable video
- [ ] Audio is audible in recording
- [ ] Mute actually silences audio
- [ ] Pause/resume maintains continuity
- [ ] Tab close triggers proper cleanup
- [ ] Long recordings (10+ minutes) work
- [ ] Large files don't crash IndexedDB

---

## Performance Considerations

1. **Chunk Size**: Use timeslice of 1000ms for ondataavailable. Smaller = more overhead, larger = more data loss on crash.

2. **Audio Sampling**: Sample levels at 100ms. Faster polling wastes CPU.

3. **IndexedDB Writes**: Batch writes if needed. Single chunk writes are usually fine.

4. **AudioContext**: Reuse context if possible. Creation is expensive.

5. **Memory**: Don't hold Blobs in memory. Write to IndexedDB immediately.

---

## Open Questions

1. Should we support tab audio capture in addition to microphone?

2. Should chunk size be configurable based on quality setting?

3. Should we implement a "draft" save that writes incomplete recordings?

4. How should we handle AudioContext suspension on mobile/background?
