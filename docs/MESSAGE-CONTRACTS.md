# Message Contract Specification — Phase 0

**Status**: DRAFT
**Version**: 0.1.0
**Date**: 2026-02-02

---

## Overview

All inter-context communication in TraceQA uses typed message passing. This document defines the contracts for Phase 0 (Media Stability).

### Design Principles

1. **Typed** — Every message has a TypeScript interface
2. **Versionable** — Messages include version for future migration
3. **Idempotent** — Handlers must tolerate duplicate messages
4. **Unidirectional** — Request/Response pattern, no bidirectional streams

---

## Message Flow Diagram

```
┌─────────┐                    ┌────────────┐                    ┌────────────┐
│  Popup  │                    │ Background │                    │ Offscreen  │
└────┬────┘                    └─────┬──────┘                    └─────┬──────┘
     │                               │                                 │
     │  START_RECORDING              │                                 │
     │──────────────────────────────▶│                                 │
     │                               │  (creates offscreen if needed)  │
     │                               │                                 │
     │                               │  OFFSCREEN_START_CAPTURE        │
     │                               │────────────────────────────────▶│
     │                               │                                 │
     │                               │  OFFSCREEN_CAPTURE_STARTED      │
     │                               │◀────────────────────────────────│
     │                               │                                 │
     │  { success: true }            │                                 │
     │◀──────────────────────────────│                                 │
     │                               │                                 │
     │  STOP_RECORDING               │                                 │
     │──────────────────────────────▶│                                 │
     │                               │                                 │
     │                               │  OFFSCREEN_STOP_CAPTURE         │
     │                               │────────────────────────────────▶│
     │                               │                                 │
     │                               │  OFFSCREEN_CAPTURE_COMPLETE     │
     │                               │◀────────────────────────────────│
     │                               │                                 │
     │                               │  (uploads blob to R2)           │
     │                               │                                 │
     │  { success: true, url }       │                                 │
     │◀──────────────────────────────│                                 │
     │                               │                                 │
```

---

## Popup → Background Messages

### START_RECORDING

Initiates a new recording session.

```typescript
interface StartRecordingMessage {
  type: 'START_RECORDING';
  payload: {
    sessionId: string;
    tabId: number;
    videoConfig: {
      quality: 'SD' | 'HD';
      captureMode: 'TAB' | 'DESKTOP' | 'WINDOW';
      audioSource: 'MICROPHONE' | 'NONE';
    };
  };
}

interface StartRecordingResponse {
  success: boolean;
  error?: string;
  sessionId?: string;
}
```

**Behavior**:
1. Background validates config
2. Creates offscreen document if not exists
3. Calls `getDisplayMedia()` with appropriate constraints
4. Forwards stream to offscreen
5. Returns success/failure

**Error Cases**:
- `PERMISSION_DENIED` — User cancelled screen picker
- `OFFSCREEN_CREATION_FAILED` — Could not create offscreen document
- `ALREADY_RECORDING` — Another session is active
- `INVALID_TAB` — Tab ID does not exist

---

### STOP_RECORDING

Stops the active recording and triggers upload.

```typescript
interface StopRecordingMessage {
  type: 'STOP_RECORDING';
  payload: {
    sessionId: string;
  };
}

interface StopRecordingResponse {
  success: boolean;
  error?: string;
  videoUrl?: string;
  duration?: number;
  fileSize?: number;
}
```

**Behavior**:
1. Background validates sessionId matches active session
2. Forwards stop command to offscreen
3. Waits for blob from offscreen
4. Uploads blob to R2
5. Returns video URL

**Error Cases**:
- `NO_ACTIVE_RECORDING` — No recording in progress
- `SESSION_MISMATCH` — sessionId doesn't match active session
- `UPLOAD_FAILED` — R2 upload failed (blob saved to IndexedDB)

---

### GET_RECORDING_STATUS

Query current recording state (used when popup opens).

```typescript
interface GetRecordingStatusMessage {
  type: 'GET_RECORDING_STATUS';
}

interface GetRecordingStatusResponse {
  isRecording: boolean;
  sessionId: string | null;
  startTime: number | null;
  duration: number | null;
  estimatedSize: number | null;
}
```

---

## Background → Offscreen Messages

### OFFSCREEN_START_CAPTURE

Instructs offscreen to begin MediaRecorder.

```typescript
interface OffscreenStartCaptureMessage {
  type: 'OFFSCREEN_START_CAPTURE';
  payload: {
    sessionId: string;
    streamId: string;  // From getDisplayMedia
    config: {
      mimeType: string;
      videoBitsPerSecond: number;
      audioBitsPerSecond?: number;
    };
  };
}

interface OffscreenStartCaptureResponse {
  success: boolean;
  error?: string;
}
```

---

### OFFSCREEN_STOP_CAPTURE

Instructs offscreen to stop and return blob.

```typescript
interface OffscreenStopCaptureMessage {
  type: 'OFFSCREEN_STOP_CAPTURE';
  payload: {
    sessionId: string;
  };
}

interface OffscreenStopCaptureResponse {
  success: boolean;
  error?: string;
  blobSize?: number;
}
```

---

## Offscreen → Background Messages

### OFFSCREEN_CAPTURE_STARTED

Confirms recording has begun.

```typescript
interface OffscreenCaptureStartedMessage {
  type: 'OFFSCREEN_CAPTURE_STARTED';
  payload: {
    sessionId: string;
    actualMimeType: string;
    startTime: number;
  };
}
```

---

### OFFSCREEN_CAPTURE_COMPLETE

Signals recording finished with blob ready.

```typescript
interface OffscreenCaptureCompleteMessage {
  type: 'OFFSCREEN_CAPTURE_COMPLETE';
  payload: {
    sessionId: string;
    blobSize: number;
    duration: number;
    // Blob transferred via different mechanism (see below)
  };
}
```

**Note**: Blobs cannot be sent via `chrome.runtime.sendMessage`. Use one of:
- `chrome.runtime.getURL()` + fetch from offscreen
- Store in IndexedDB, send key
- Use `MessageChannel` with transferable

---

### OFFSCREEN_CAPTURE_ERROR

Reports an error during capture.

```typescript
interface OffscreenCaptureErrorMessage {
  type: 'OFFSCREEN_CAPTURE_ERROR';
  payload: {
    sessionId: string;
    error: string;
    errorCode: 'ENCODER_ERROR' | 'STREAM_ENDED' | 'QUOTA_EXCEEDED' | 'UNKNOWN';
    recoverable: boolean;
  };
}
```

---

### OFFSCREEN_SIZE_WARNING

Warns when recording approaches size limit.

```typescript
interface OffscreenSizeWarningMessage {
  type: 'OFFSCREEN_SIZE_WARNING';
  payload: {
    sessionId: string;
    currentSize: number;
    maxSize: number;
    percentUsed: number;
  };
}
```

Sent at 80% of 100MB limit.

---

## Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `PERMISSION_DENIED` | User denied screen access | Yes (retry) |
| `ALREADY_RECORDING` | Recording already active | No |
| `NO_ACTIVE_RECORDING` | No recording to stop | No |
| `SESSION_MISMATCH` | Wrong session ID | No |
| `OFFSCREEN_CREATION_FAILED` | Could not create offscreen | Yes (retry) |
| `ENCODER_ERROR` | MediaRecorder failed | No |
| `STREAM_ENDED` | Screen share stopped externally | No |
| `QUOTA_EXCEEDED` | Recording too large | No |
| `UPLOAD_FAILED` | R2 upload failed | Yes (retry) |
| `TIMEOUT` | Operation timed out | Yes (retry) |

---

## TypeScript Definitions

```typescript
// shared/types/messages.ts

export type MessageType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'GET_RECORDING_STATUS'
  | 'OFFSCREEN_START_CAPTURE'
  | 'OFFSCREEN_STOP_CAPTURE'
  | 'OFFSCREEN_CAPTURE_STARTED'
  | 'OFFSCREEN_CAPTURE_COMPLETE'
  | 'OFFSCREEN_CAPTURE_ERROR'
  | 'OFFSCREEN_SIZE_WARNING';

export interface BaseMessage<T extends MessageType, P = void> {
  type: T;
  payload: P;
  version?: string;
  timestamp?: number;
}

export interface BaseResponse {
  success: boolean;
  error?: string;
}

// ... (full types from above)
```

---

## What Could Go Wrong?

| Risk | Mitigation |
|------|------------|
| Message lost if SW terminates during send | Use `chrome.storage` as source of truth; messages trigger storage updates |
| Duplicate messages sent | All handlers are idempotent; use sessionId to dedupe |
| Version mismatch after extension update | Include version field; background validates before processing |
| Blob too large to transfer | Use IndexedDB as intermediary; send reference only |

---

## Future Messages (Not Phase 0)

Reserved for later phases:
- `PAUSE_RECORDING` / `RESUME_RECORDING`
- `ADD_BLUR_REGION`
- `CAPTURE_SCREENSHOT`
- `ADD_SESSION_FLAG`
