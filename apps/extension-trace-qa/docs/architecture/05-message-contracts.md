# Message Contracts & State Transitions Specification

**Document Version:** 1.0
**Date:** 2026-02-05
**Status:** Draft

---

## Overview

This document defines **all message contracts** and **state transitions** in TraceQA. It serves as the authoritative reference for inter-plane communication.

**Key Principles:**
- **Explicit commands over toggles** – No "toggle" behavior anywhere
- **Single responsibility** – Each message does one thing
- **Validated transitions** – FSM rejects invalid state changes
- **Typed contracts** – All messages are fully typed

---

## Message Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MESSAGE TAXONOMY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │   COMMAND MESSAGES  │    │   EVENT MESSAGES    │                         │
│  │                     │    │                     │                         │
│  │  • Request action   │    │  • Report outcome   │                         │
│  │  • Sent by caller   │    │  • Sent by executor │                         │
│  │  • Expect response  │    │  • Fire-and-forget  │                         │
│  └─────────────────────┘    └─────────────────────┘                         │
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │  BROADCAST MESSAGES │    │   QUERY MESSAGES    │                         │
│  │                     │    │                     │                         │
│  │  • One-to-many      │    │  • Request data     │                         │
│  │  • No response      │    │  • Expect response  │                         │
│  │  • State updates    │    │  • No side effects  │                         │
│  └─────────────────────┘    └─────────────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Command Messages

### Recording Commands (UI → Background)

#### START_RECORDING

Initiates a new recording session.

```typescript
interface StartRecordingCommand {
  type: 'START_RECORDING';
  payload: {
    sessionId: string;
    tabId: number;
    videoConfig: {
      quality: 'SD' | 'HD' | 'FHD';
      captureMode: 'TAB' | 'WINDOW' | 'DESKTOP';
      audioSource: 'NONE' | 'MICROPHONE' | 'SYSTEM' | 'BOTH';
    };
  };
}

interface StartRecordingResponse {
  success: boolean;
  error?: string;
  sessionId?: string;
}
```

**Valid From States:** `IDLE`
**Triggers Transition:** `START_REQUESTED`

---

#### STOP_RECORDING

Stops the current recording session.

```typescript
interface StopRecordingCommand {
  type: 'STOP_RECORDING';
  payload: {
    sessionId: string;
  };
}

interface StopRecordingResponse {
  success: boolean;
  error?: string;
}
```

**Valid From States:** `RECORDING`, `PAUSED`
**Triggers Transition:** `STOP_REQUESTED`

---

#### UI_PAUSE_REQUESTED

Requests to pause the current recording. **NOT a toggle.**

```typescript
interface PauseRequestedCommand {
  type: 'UI_PAUSE_REQUESTED';
  payload: {
    sessionId: string;
  };
}

interface PauseRequestedResponse {
  success: boolean;
  error?: string;
}
```

**Valid From States:** `RECORDING` only
**Triggers Transition:** `PAUSE_REQUESTED`
**Rejection:** If already paused, returns `{ success: false, error: 'Already paused' }`

---

#### UI_RESUME_REQUESTED

Requests to resume a paused recording. **NOT a toggle.**

```typescript
interface ResumeRequestedCommand {
  type: 'UI_RESUME_REQUESTED';
  payload: {
    sessionId: string;
  };
}

interface ResumeRequestedResponse {
  success: boolean;
  error?: string;
}
```

**Valid From States:** `PAUSED` only
**Triggers Transition:** `RESUME_REQUESTED`
**Rejection:** If not paused, returns `{ success: false, error: 'Not paused' }`

---

### FloatingPane Commands (Content → Background)

#### FLOATING_PANE_PAUSE

Pause command from FloatingPane. **Explicit pause, not toggle.**

```typescript
interface FloatingPanePauseCommand {
  type: 'FLOATING_PANE_PAUSE';
  payload: {
    sessionId: string;
  };
}
```

**Behavior:** Same as `UI_PAUSE_REQUESTED`

---

#### FLOATING_PANE_RESUME

Resume command from FloatingPane. **Explicit resume, not toggle.**

```typescript
interface FloatingPaneResumeCommand {
  type: 'FLOATING_PANE_RESUME';
  payload: {
    sessionId: string;
  };
}
```

**Behavior:** Same as `UI_RESUME_REQUESTED`

---

#### FLOATING_PANE_STOP

Stop command from FloatingPane.

```typescript
interface FloatingPaneStopCommand {
  type: 'FLOATING_PANE_STOP';
  payload: {
    sessionId: string;
  };
}
```

**Behavior:** Same as `STOP_RECORDING`

---

#### FLOATING_PANE_MUTE

Mute audio. **Explicit mute, not toggle.**

```typescript
interface FloatingPaneMuteCommand {
  type: 'FLOATING_PANE_MUTE';
  payload: {
    sessionId: string;
  };
}
```

---

#### FLOATING_PANE_UNMUTE

Unmute audio. **Explicit unmute, not toggle.**

```typescript
interface FloatingPaneUnmuteCommand {
  type: 'FLOATING_PANE_UNMUTE';
  payload: {
    sessionId: string;
  };
}
```

---

### Audio Commands (Background → Offscreen)

#### OFFSCREEN_ENABLE_AUDIO

Enable audio capture.

```typescript
interface EnableAudioCommand {
  type: 'OFFSCREEN_ENABLE_AUDIO';
  payload: {
    deviceId?: string;  // Preferred microphone
  };
}
```

---

#### OFFSCREEN_DISABLE_AUDIO

Disable audio capture.

```typescript
interface DisableAudioCommand {
  type: 'OFFSCREEN_DISABLE_AUDIO';
  payload: {};
}
```

---

#### OFFSCREEN_SET_MUTED

Set mute state. **Explicit value, not toggle.**

```typescript
interface SetMutedCommand {
  type: 'OFFSCREEN_SET_MUTED';
  payload: {
    muted: boolean;  // true = muted, false = unmuted
  };
}
```

---

### Offscreen Commands (Background → Offscreen)

#### OFFSCREEN_START_CAPTURE

Start media capture.

```typescript
interface StartCaptureCommand {
  type: 'OFFSCREEN_START_CAPTURE';
  payload: {
    sessionId: string;
    tabId: number;
    videoConfig: VideoConfig;
    audioConfig: AudioConfig;
  };
}
```

---

#### OFFSCREEN_STOP_CAPTURE

Stop media capture.

```typescript
interface StopCaptureCommand {
  type: 'OFFSCREEN_STOP_CAPTURE';
  payload: {
    sessionId: string;
  };
}
```

---

#### OFFSCREEN_PAUSE_RECORDING

Pause MediaRecorder.

```typescript
interface PauseRecordingCommand {
  type: 'OFFSCREEN_PAUSE_RECORDING';
  payload: {
    sessionId: string;
  };
}
```

---

#### OFFSCREEN_RESUME_RECORDING

Resume MediaRecorder.

```typescript
interface ResumeRecordingCommand {
  type: 'OFFSCREEN_RESUME_RECORDING';
  payload: {
    sessionId: string;
  };
}
```

---

## Event Messages

### Offscreen Events (Offscreen → Background)

#### OFFSCREEN_STARTED

Capture successfully started.

```typescript
interface OffscreenStartedEvent {
  type: 'OFFSCREEN_STARTED';
  payload: {
    sessionId: string;
    hasAudio: boolean;
    mimeType: string;
  };
}
```

---

#### OFFSCREEN_PAUSED

Recording paused.

```typescript
interface OffscreenPausedEvent {
  type: 'OFFSCREEN_PAUSED';
  payload: {
    sessionId: string;
  };
}
```

---

#### OFFSCREEN_RESUMED

Recording resumed.

```typescript
interface OffscreenResumedEvent {
  type: 'OFFSCREEN_RESUMED';
  payload: {
    sessionId: string;
  };
}
```

---

#### OFFSCREEN_STOPPED

Recording stopped (by command).

```typescript
interface OffscreenStoppedEvent {
  type: 'OFFSCREEN_STOPPED';
  payload: {
    sessionId: string;
    chunkCount: number;
    totalSize: number;
    duration: number;
  };
}
```

---

#### OFFSCREEN_STREAM_ENDED

Recording stopped externally (tab closed, user stopped sharing).

```typescript
interface OffscreenStreamEndedEvent {
  type: 'OFFSCREEN_STREAM_ENDED';
  payload: {
    sessionId: string;
    reason: 'track_ended' | 'tab_closed' | 'permission_revoked';
  };
}
```

---

#### OFFSCREEN_ERROR

An error occurred.

```typescript
interface OffscreenErrorEvent {
  type: 'OFFSCREEN_ERROR';
  payload: {
    sessionId?: string;
    code: string;
    message: string;
    recoverable: boolean;
  };
}
```

---

#### OFFSCREEN_CHUNK_STORED

A chunk was written to IndexedDB.

```typescript
interface OffscreenChunkStoredEvent {
  type: 'OFFSCREEN_CHUNK_STORED';
  payload: {
    sessionId: string;
    index: number;
    size: number;
    totalSize: number;
  };
}
```

---

#### OFFSCREEN_AUDIO_LEVEL

Audio level update (for UI visualization).

```typescript
interface OffscreenAudioLevelEvent {
  type: 'OFFSCREEN_AUDIO_LEVEL';
  payload: {
    level: number;  // 0-100
  };
}
```

---

### Content Events (Content → Background)

#### CONTENT_TELEMETRY_BATCH

Batch of telemetry events.

```typescript
interface ContentTelemetryBatchEvent {
  type: 'CONTENT_TELEMETRY_BATCH';
  payload: {
    sessionId: string;
    batchId: string;
    events: TelemetryEvent[];
    metadata: {
      capturedAt: number;
      eventCount: number;
      byteSize: number;
      url: string;
      isPartial: boolean;
    };
  };
}
```

---

## Broadcast Messages

### UI State Updates (Background → All UI)

#### UI_STATE_UPDATE

Periodic state update during recording.

```typescript
interface UIStateUpdateBroadcast {
  type: 'UI_STATE_UPDATE';
  payload: {
    sessionId: string;
    sessionState: SessionState;
    isPaused: boolean;
    duration: number;      // ms (excludes paused time)
    isMuted: boolean;
    audioLevel: number;    // 0-100
    audioEnabled: boolean;
  };
}
```

**Broadcast Frequency:** Every 1000ms while recording

---

#### UI_SESSION_ENDED

Session has ended (success or error).

```typescript
interface UISessionEndedBroadcast {
  type: 'UI_SESSION_ENDED';
  payload: {
    sessionId: string;
    reason: 'completed' | 'stopped' | 'error' | 'stream_ended';
    error?: string;
    downloadUrl?: string;
    duration: number;
    chunkCount: number;
    totalSize: number;
  };
}
```

---

### Session Lifecycle (Background → Content)

#### SESSION_STARTED

Notify content script that recording has started.

```typescript
interface SessionStartedBroadcast {
  type: 'SESSION_STARTED';
  payload: {
    sessionId: string;
    startTime: number;
    tabId: number;
    telemetryConfig: TelemetryConfig;
  };
}
```

---

#### SESSION_ENDED

Notify content script that recording has ended.

```typescript
interface SessionEndedBroadcast {
  type: 'SESSION_ENDED';
  payload: {
    sessionId: string;
  };
}
```

---

## Query Messages

#### GET_RECORDING_STATUS

Query current recording status.

```typescript
interface GetRecordingStatusQuery {
  type: 'GET_RECORDING_STATUS';
}

interface GetRecordingStatusResponse {
  success: boolean;
  sessionState: SessionState;
  sessionId: string | null;
  isPaused: boolean;
  duration: number;
  isMuted: boolean;
  audioEnabled: boolean;
  error?: string;
}
```

---

## State Machine Definition

### Session States

```typescript
type SessionState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'STARTING'
  | 'RECORDING'
  | 'PAUSED'
  | 'STOPPING'
  | 'UPLOADING';
```

### State Descriptions

| State | Description |
|-------|-------------|
| `IDLE` | No active session. Ready to start. |
| `REQUESTING_PERMISSION` | Waiting for user to grant screen share permission. |
| `STARTING` | Permission granted, initializing capture. |
| `RECORDING` | Actively recording. |
| `PAUSED` | Recording paused, can resume. |
| `STOPPING` | Stop requested, finalizing chunks. |
| `UPLOADING` | Chunks finalized, preparing for download/upload. |

### State Diagram

```
                        ┌─────────────────────────────────────────────────────┐
                        │                                                     │
                        ▼                                                     │
┌────────┐      ┌──────────────────┐      ┌──────────┐      ┌───────────┐   │
│  IDLE  │─────►│REQUESTING_PERMIS.│─────►│ STARTING │─────►│ RECORDING │   │
└────────┘      └──────────────────┘      └──────────┘      └─────┬─────┘   │
    ▲                   │                       │                  │         │
    │                   │ (denied/cancelled)    │ (failed)         │         │
    │                   ▼                       ▼                  ▼         │
    │              ┌────────┐              ┌────────┐         ┌────────┐    │
    │              │  IDLE  │              │  IDLE  │         │ PAUSED │    │
    │              └────────┘              └────────┘         └────┬───┘    │
    │                                                              │         │
    │                  ┌───────────────────────────────────────────┘         │
    │                  │                                                     │
    │                  ▼                                                     │
    │           ┌──────────┐      ┌───────────┐                             │
    └───────────│ STOPPING │─────►│ UPLOADING │─────────────────────────────┘
                └──────────┘      └───────────┘
```

---

## FSM Transition Table

### Valid Transitions

| From State | Event | To State | Side Effects |
|------------|-------|----------|--------------|
| `IDLE` | `START_REQUESTED` | `REQUESTING_PERMISSION` | Create offscreen, request permission |
| `REQUESTING_PERMISSION` | `PERMISSION_GRANTED` | `STARTING` | Start capture |
| `REQUESTING_PERMISSION` | `PERMISSION_DENIED` | `IDLE` | Close offscreen, notify UI |
| `REQUESTING_PERMISSION` | `USER_CANCELLED` | `IDLE` | Close offscreen, notify UI |
| `STARTING` | `CAPTURE_STARTED` | `RECORDING` | Start UI timer, inject pane |
| `STARTING` | `CAPTURE_FAILED` | `IDLE` | Close offscreen, notify UI |
| `RECORDING` | `PAUSE_REQUESTED` | `PAUSED` | Pause recorder |
| `RECORDING` | `STOP_REQUESTED` | `STOPPING` | Stop recorder |
| `RECORDING` | `STREAM_ENDED` | `UPLOADING` | Handle external stop |
| `RECORDING` | `CAPTURE_FAILED` | `IDLE` | Error recovery |
| `PAUSED` | `RESUME_REQUESTED` | `RECORDING` | Resume recorder |
| `PAUSED` | `STOP_REQUESTED` | `STOPPING` | Stop recorder |
| `PAUSED` | `STREAM_ENDED` | `UPLOADING` | Handle external stop |
| `STOPPING` | `CHUNKS_FINALIZED` | `UPLOADING` | Prepare download |
| `UPLOADING` | `UPLOAD_COMPLETE` | `IDLE` | Cleanup, notify UI |
| `UPLOADING` | `UPLOAD_FAILED` | `IDLE` | Cleanup, notify UI with error |
| `*` | `FORCE_RESET` | `IDLE` | Emergency cleanup |

---

### Invalid Transitions (Rejected)

| From State | Attempted Event | Rejection Reason |
|------------|-----------------|------------------|
| `IDLE` | `PAUSE_REQUESTED` | "Cannot pause: not recording" |
| `IDLE` | `RESUME_REQUESTED` | "Cannot resume: not recording" |
| `IDLE` | `STOP_REQUESTED` | "Cannot stop: not recording" |
| `REQUESTING_PERMISSION` | `PAUSE_REQUESTED` | "Cannot pause: still requesting permission" |
| `REQUESTING_PERMISSION` | `STOP_REQUESTED` | "Cannot stop: still requesting permission" |
| `STARTING` | `PAUSE_REQUESTED` | "Cannot pause: still starting" |
| `STARTING` | `STOP_REQUESTED` | "Cannot stop: still starting" |
| `RECORDING` | `RESUME_REQUESTED` | "Cannot resume: not paused" |
| `RECORDING` | `START_REQUESTED` | "Cannot start: already recording" |
| `PAUSED` | `PAUSE_REQUESTED` | "Cannot pause: already paused" |
| `PAUSED` | `START_REQUESTED` | "Cannot start: session active" |
| `STOPPING` | `*` (any) | "Cannot perform action: stopping in progress" |
| `UPLOADING` | `*` (any) | "Cannot perform action: upload in progress" |

---

## Transition Implementation

### Reducer Pattern

```typescript
interface SessionContext {
  sessionId: string | null;
  tabId: number | null;
  startTime: number | null;
  pauseStartTime: number | null;
  totalPausedDuration: number;
  error: string | null;
}

interface SessionEvent {
  type: SessionEventType;
  payload?: unknown;
}

type SessionEventType =
  | 'START_REQUESTED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'USER_CANCELLED'
  | 'CAPTURE_STARTED'
  | 'CAPTURE_FAILED'
  | 'PAUSE_REQUESTED'
  | 'RESUME_REQUESTED'
  | 'STOP_REQUESTED'
  | 'STREAM_ENDED'
  | 'CHUNKS_FINALIZED'
  | 'UPLOAD_COMPLETE'
  | 'UPLOAD_FAILED'
  | 'FORCE_RESET';

// Pure function - no side effects
function reduce(
  state: SessionState,
  context: SessionContext,
  event: SessionEvent
): { state: SessionState; context: SessionContext } | null {

  const nextState = transitions[state]?.[event.type];

  if (!nextState) {
    // Invalid transition
    return null;
  }

  // Context updates based on transition
  const nextContext = updateContext(context, state, nextState, event);

  return { state: nextState, context: nextContext };
}
```

### Transition Validation

```typescript
function canTransition(
  currentState: SessionState,
  event: SessionEventType
): boolean {
  return transitions[currentState]?.[event] !== undefined;
}

function validateTransition(
  currentState: SessionState,
  event: SessionEventType
): { valid: true } | { valid: false; reason: string } {

  if (canTransition(currentState, event)) {
    return { valid: true };
  }

  // Generate human-readable rejection reason
  const reason = getTransitionRejectionReason(currentState, event);
  return { valid: false, reason };
}
```

---

## Eliminating Toggle Behavior

### Problem: Toggle Behavior

Toggle behavior is ambiguous and leads to race conditions:

```typescript
// BAD: Toggle behavior
function handlePauseToggle() {
  if (isPaused) {
    resume();  // Intent unclear from call site
  } else {
    pause();   // Caller doesn't know what will happen
  }
}
```

### Solution: Explicit Commands

Every action is explicit about intent:

```typescript
// GOOD: Explicit commands
function handlePause() {
  sendCommand({ type: 'UI_PAUSE_REQUESTED', payload: { sessionId } });
}

function handleResume() {
  sendCommand({ type: 'UI_RESUME_REQUESTED', payload: { sessionId } });
}
```

### UI Implementation

The UI determines which button to show based on state, but each button sends a specific command:

```typescript
// RecordingButton.tsx (already implemented)
const handleClick = (): void => {
  if (!isRecording) {
    onStart();      // Explicit start
  } else if (isPaused) {
    onResume();     // Explicit resume (NOT toggle)
  } else {
    onStop();       // Explicit stop
  }
};
```

### FloatingPane Implementation

FloatingPane shows different buttons for pause vs resume:

```typescript
// FloatingPane pause button
if (isPaused) {
  // Show resume button
  onAction('resume');  // Sends FLOATING_PANE_RESUME
} else {
  // Show pause button
  onAction('pause');   // Sends FLOATING_PANE_PAUSE
}
```

### Mute/Unmute

Audio mute is also explicit, not a toggle:

```typescript
// Mute button
if (isMuted) {
  onAction('unmute');  // Sends FLOATING_PANE_UNMUTE
} else {
  onAction('mute');    // Sends FLOATING_PANE_MUTE
}
```

---

## Message Flow Examples

### Start Recording (Success)

```
┌────────┐     ┌────────────┐     ┌───────────┐
│ Popup  │     │ Background │     │ Offscreen │
└───┬────┘     └─────┬──────┘     └─────┬─────┘
    │                │                   │
    │ START_RECORDING│                   │
    │───────────────►│                   │
    │                │                   │
    │                │ (create document) │
    │                │──────────────────►│
    │                │                   │
    │                │ OFFSCREEN_START   │
    │                │──────────────────►│
    │                │                   │
    │                │ OFFSCREEN_STARTED │
    │                │◄──────────────────│
    │                │                   │
    │ { success }    │                   │
    │◄───────────────│                   │
    │                │                   │
    │ UI_STATE_UPDATE│                   │
    │◄───────────────│ (periodic)        │
```

### Pause/Resume (Explicit)

```
┌──────────────┐     ┌────────────┐     ┌───────────┐
│ FloatingPane │     │ Background │     │ Offscreen │
└──────┬───────┘     └─────┬──────┘     └─────┬─────┘
       │                   │                   │
       │ FLOATING_PANE_PAUSE                   │
       │──────────────────►│                   │
       │                   │                   │
       │                   │ OFFSCREEN_PAUSE   │
       │                   │──────────────────►│
       │                   │                   │
       │                   │ OFFSCREEN_PAUSED  │
       │                   │◄──────────────────│
       │                   │                   │
       │ UI_STATE_UPDATE   │                   │
       │◄──────────────────│ (isPaused: true)  │
       │                   │                   │
       │ FLOATING_PANE_RESUME                  │
       │──────────────────►│                   │
       │                   │                   │
       │                   │ OFFSCREEN_RESUME  │
       │                   │──────────────────►│
       │                   │                   │
       │                   │ OFFSCREEN_RESUMED │
       │                   │◄──────────────────│
       │                   │                   │
       │ UI_STATE_UPDATE   │                   │
       │◄──────────────────│ (isPaused: false) │
```

### Invalid Transition (Rejection)

```
┌────────┐     ┌────────────┐
│ Popup  │     │ Background │
└───┬────┘     └─────┬──────┘
    │                │
    │ UI_RESUME_REQUESTED (but state is RECORDING, not PAUSED)
    │───────────────►│
    │                │
    │                │ (validate transition)
    │                │ (RECORDING → RESUME_REQUESTED: INVALID)
    │                │
    │ { success: false, error: "Cannot resume: not paused" }
    │◄───────────────│
```

---

## Type Definitions (Complete)

```typescript
// ============================================
// MESSAGE TYPE UNION
// ============================================

type PopupToBackgroundMessage =
  | StartRecordingCommand
  | StopRecordingCommand
  | PauseRequestedCommand
  | ResumeRequestedCommand
  | GetRecordingStatusQuery;

type ContentToBackgroundMessage =
  | FloatingPanePauseCommand
  | FloatingPaneResumeCommand
  | FloatingPaneStopCommand
  | FloatingPaneMuteCommand
  | FloatingPaneUnmuteCommand
  | ContentTelemetryBatchEvent;

type BackgroundToOffscreenMessage =
  | StartCaptureCommand
  | StopCaptureCommand
  | PauseRecordingCommand
  | ResumeRecordingCommand
  | EnableAudioCommand
  | DisableAudioCommand
  | SetMutedCommand;

type OffscreenToBackgroundMessage =
  | OffscreenStartedEvent
  | OffscreenPausedEvent
  | OffscreenResumedEvent
  | OffscreenStoppedEvent
  | OffscreenStreamEndedEvent
  | OffscreenErrorEvent
  | OffscreenChunkStoredEvent
  | OffscreenAudioLevelEvent;

type BackgroundBroadcastMessage =
  | UIStateUpdateBroadcast
  | UISessionEndedBroadcast
  | SessionStartedBroadcast
  | SessionEndedBroadcast;

// ============================================
// MESSAGE DISCRIMINATORS
// ============================================

function isCommand(msg: unknown): msg is { type: string; payload: unknown } {
  return typeof msg === 'object' && msg !== null && 'type' in msg && 'payload' in msg;
}

function isEvent(msg: unknown): msg is { type: string; payload: unknown } {
  return typeof msg === 'object' && msg !== null && 'type' in msg;
}
```

---

## Validation Rules

### Session ID Validation

All commands that reference a session must include a valid sessionId:

```typescript
function validateSessionId(
  providedId: string,
  currentId: string | null
): { valid: true } | { valid: false; reason: string } {

  if (!providedId) {
    return { valid: false, reason: 'Session ID is required' };
  }

  if (currentId === null) {
    return { valid: false, reason: 'No active session' };
  }

  if (providedId !== currentId) {
    return { valid: false, reason: 'Session ID mismatch (stale request)' };
  }

  return { valid: true };
}
```

### Freshness Check

Prevent stale messages from affecting state:

```typescript
interface MessageWithTimestamp {
  timestamp: number;
}

function isFresh(message: MessageWithTimestamp, maxAgeMs = 5000): boolean {
  return Date.now() - message.timestamp < maxAgeMs;
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_STATE` | Operation not valid in current state |
| `SESSION_MISMATCH` | Session ID doesn't match active session |
| `NO_ACTIVE_SESSION` | Operation requires active session |
| `ALREADY_RECORDING` | Cannot start: already recording |
| `NOT_PAUSED` | Cannot resume: not paused |
| `ALREADY_PAUSED` | Cannot pause: already paused |
| `PERMISSION_DENIED` | User denied screen share permission |
| `CAPTURE_FAILED` | Media capture failed to start |
| `OFFSCREEN_ERROR` | Offscreen document error |
| `STORAGE_ERROR` | IndexedDB operation failed |

---

## File Location

```
shared/
├── contracts/
│   ├── index.ts              # Re-exports all contracts
│   ├── messages.ts           # All message type definitions
│   ├── commands.ts           # Command message types
│   ├── events.ts             # Event message types
│   ├── broadcasts.ts         # Broadcast message types
│   ├── queries.ts            # Query message types
│   └── validation.ts         # Validation helpers
└── types/
    ├── index.ts              # Re-exports
    ├── session.ts            # SessionState, SessionContext
    └── fsm.ts                # FSM types, transition table
```

---

## Migration Notes

### Removing Toggle Behavior

If any existing code uses toggle patterns, refactor to explicit commands:

```typescript
// Before (BAD)
case 'TOGGLE_PAUSE':
  if (state === 'PAUSED') {
    return 'RECORDING';
  } else if (state === 'RECORDING') {
    return 'PAUSED';
  }

// After (GOOD)
case 'PAUSE_REQUESTED':
  if (state === 'RECORDING') {
    return 'PAUSED';
  }
  return null; // Invalid transition

case 'RESUME_REQUESTED':
  if (state === 'PAUSED') {
    return 'RECORDING';
  }
  return null; // Invalid transition
```

### Updating UI Components

Ensure UI sends correct command based on state:

```typescript
// Before (BAD)
onClick={() => togglePause()}

// After (GOOD)
onClick={() => isPaused ? onResume() : onPause()}
```
