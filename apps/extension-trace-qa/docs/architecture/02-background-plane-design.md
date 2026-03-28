# Background Plane Design Specification

**Document Version:** 1.0
**Date:** 2026-02-05
**Status:** Draft

---

## Overview

The Background plane is the **orchestration and policy layer** of TraceQA. It runs in the Chrome extension service worker and is responsible for:

- Maintaining the authoritative recording state (FSM)
- Coordinating between all other planes (Content, Offscreen, UI)
- Making policy decisions (what to do, when)
- Broadcasting state to UI consumers

**Critical Constraint:** The Background plane **never** touches media APIs directly.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKGROUND SERVICE WORKER                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      MESSAGE ROUTER                               │   │
│  │  chrome.runtime.onMessage → dispatch to registered handlers       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│         ┌──────────────────────────┼──────────────────────────┐         │
│         │                          │                          │         │
│         ▼                          ▼                          ▼         │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐   │
│  │   SESSION   │           │    AUDIO    │           │  TELEMETRY  │   │
│  │ CONTROLLER  │           │ CONTROLLER  │           │ CONTROLLER  │   │
│  └──────┬──────┘           └──────┬──────┘           └─────────────┘   │
│         │                         │                                     │
│         │    ┌────────────────────┘                                     │
│         │    │                                                          │
│         ▼    ▼                                                          │
│  ┌─────────────────┐       ┌─────────────────┐                         │
│  │   OFFSCREEN     │       │   PERSISTENCE   │                         │
│  │   CONTROLLER    │       │   MANAGER       │                         │
│  └────────┬────────┘       └─────────────────┘                         │
│           │                                                             │
│           │         ┌─────────────────┐                                │
│           │         │      FSM        │ ◄── Single source of truth     │
│           │         │    MANAGER      │                                │
│           │         └─────────────────┘                                │
│           │                                                             │
│           │         ┌─────────────────┐                                │
│           │         │  STATE BROADCAST│ ──► Popup, FloatingPane        │
│           │         │    MANAGER      │                                │
│           │         └─────────────────┘                                │
│           │                                                             │
└───────────┼─────────────────────────────────────────────────────────────┘
            │
            ▼
    [ OFFSCREEN DOCUMENT ]
```

---

## Component Specifications

---

### 1. FSM Manager

#### Purpose
Maintains the authoritative state machine for recording lifecycle. All state transitions flow through this component.

#### What It Owns
- Current session state (`IDLE`, `REQUESTING_PERMISSION`, `STARTING`, `RECORDING`, `PAUSED`, `STOPPING`, `UPLOADING`)
- Session context (sessionId, tabId, startTime, configuration)
- Transition validation rules
- State history (for debugging)

#### What It Does NOT Own
- Chrome API calls
- Message sending/receiving
- Side effects of any kind
- Timer management

#### State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
┌──────┐    ┌──────────────────┐    ┌──────────┐    ┌──────────┐ │
│ IDLE │───►│REQUESTING_PERMIS.│───►│ STARTING │───►│RECORDING │ │
└──────┘    └──────────────────┘    └──────────┘    └────┬─────┘ │
    ▲                │                                    │       │
    │                │ (user cancelled)                   │       │
    │                ▼                                    ▼       │
    │           ┌────────┐                          ┌─────────┐  │
    │           │  IDLE  │                          │ PAUSED  │  │
    │           └────────┘                          └────┬────┘  │
    │                                                    │       │
    │         ┌──────────────────────────────────────────┘       │
    │         │                                                   │
    │         ▼                                                   │
    │    ┌──────────┐    ┌───────────┐                           │
    └────│ STOPPING │───►│ UPLOADING │───────────────────────────┘
         └──────────┘    └───────────┘
```

#### Valid Transitions

| From State | Event | To State |
|------------|-------|----------|
| IDLE | START_REQUESTED | REQUESTING_PERMISSION |
| REQUESTING_PERMISSION | PERMISSION_GRANTED | STARTING |
| REQUESTING_PERMISSION | PERMISSION_DENIED | IDLE |
| REQUESTING_PERMISSION | USER_CANCELLED | IDLE |
| STARTING | CAPTURE_STARTED | RECORDING |
| STARTING | CAPTURE_FAILED | IDLE |
| RECORDING | PAUSE_REQUESTED | PAUSED |
| RECORDING | STOP_REQUESTED | STOPPING |
| RECORDING | STREAM_ENDED | UPLOADING |
| PAUSED | RESUME_REQUESTED | RECORDING |
| PAUSED | STOP_REQUESTED | STOPPING |
| PAUSED | STREAM_ENDED | UPLOADING |
| STOPPING | CHUNKS_FINALIZED | UPLOADING |
| UPLOADING | UPLOAD_COMPLETE | IDLE |
| UPLOADING | UPLOAD_FAILED | IDLE |
| * | FORCE_RESET | IDLE |

#### Interface Contract

```
// Pure functions - no side effects
getState(): SessionState
getContext(): SessionContext
canTransition(event: SessionEvent): boolean
transition(event: SessionEvent): { state: SessionState, context: SessionContext }
```

#### Messages

| Direction | Message Type | Purpose |
|-----------|--------------|---------|
| None | — | FSM is pure; it doesn't send/receive messages directly |

---

### 2. Message Router

#### Purpose
Central dispatch point for all incoming messages. Decouples message reception from handling logic.

#### What It Owns
- `chrome.runtime.onMessage` listener registration
- Handler registration table
- Message validation
- Session ID freshness checking

#### What It Does NOT Own
- Handler implementation
- Business logic
- State management

#### Registration Pattern

```
router.register('START_RECORDING', sessionController.handleStart);
router.register('STOP_RECORDING', sessionController.handleStop);
router.register('UI_PAUSE_REQUESTED', sessionController.handlePause);
router.register('UI_RESUME_REQUESTED', sessionController.handleResume);
router.register('AUDIO_MUTE_TOGGLE', audioController.handleMuteToggle);
// etc.
```

#### Message Categories

| Category | Prefix | Source | Example |
|----------|--------|--------|---------|
| UI Commands | `UI_*` | Popup, FloatingPane | `UI_PAUSE_REQUESTED` |
| Offscreen Events | `OFFSCREEN_*` | Offscreen document | `OFFSCREEN_STARTED` |
| Content Events | `CONTENT_*` | Content scripts | `CONTENT_TELEMETRY_BATCH` |
| Internal | (none) | Background | `START_RECORDING` |
| FloatingPane | `FLOATING_PANE_*` | Content script | `FLOATING_PANE_STOP` |

#### Messages Received (Inbound)

| Message Type | Source | Routed To |
|--------------|--------|-----------|
| `START_RECORDING` | Popup | sessionController |
| `STOP_RECORDING` | Popup | sessionController |
| `GET_RECORDING_STATUS` | Popup | sessionController |
| `UI_PAUSE_REQUESTED` | Popup | sessionController |
| `UI_RESUME_REQUESTED` | Popup | sessionController |
| `FLOATING_PANE_PAUSE` | Content | sessionController |
| `FLOATING_PANE_RESUME` | Content | sessionController |
| `FLOATING_PANE_STOP` | Content | sessionController |
| `FLOATING_PANE_MUTE_TOGGLE` | Content | audioController |
| `OFFSCREEN_STARTED` | Offscreen | sessionController |
| `OFFSCREEN_PAUSED` | Offscreen | sessionController |
| `OFFSCREEN_RESUMED` | Offscreen | sessionController |
| `OFFSCREEN_STOPPED` | Offscreen | sessionController |
| `OFFSCREEN_ERROR` | Offscreen | sessionController |
| `OFFSCREEN_STREAM_ENDED` | Offscreen | sessionController |
| `OFFSCREEN_CHUNK_STORED` | Offscreen | sessionController |
| `OFFSCREEN_AUDIO_LEVEL` | Offscreen | audioController |
| `CONTENT_TELEMETRY_BATCH` | Content | telemetryController |

---

### 3. Session Controller

#### Purpose
The "brain" of recording operations. Orchestrates the full recording lifecycle by coordinating FSM, offscreen, UI, and audio.

#### What It Owns
- Start/stop/pause/resume semantics
- Session ID validation
- FSM transition triggering
- Coordination sequence (what order to call things)
- Error handling and recovery

#### What It Does NOT Own
- FSM state (delegates to fsmManager)
- Offscreen document lifecycle (delegates to offscreenController)
- UI updates (delegates to stateBroadcastManager)
- Audio state (delegates to audioController)
- Persistence (delegates to persistenceManager)

#### Operation Sequences

**Start Recording:**
```
1. Validate no active session
2. Generate sessionId
3. Trigger FSM: START_REQUESTED
4. Create offscreen document (via offscreenController)
5. Send start command to offscreen
6. Wait for OFFSCREEN_STARTED
7. Trigger FSM: CAPTURE_STARTED
8. Start UI broadcast timer
9. Inject FloatingPane into tab
10. Persist session state
```

**Pause Recording:**
```
1. Validate current state is RECORDING
2. Validate sessionId matches
3. Send pause command to offscreen
4. Wait for OFFSCREEN_PAUSED
5. Trigger FSM: PAUSE_REQUESTED
6. Broadcast UI update (isPaused: true)
```

**Resume Recording:**
```
1. Validate current state is PAUSED
2. Validate sessionId matches
3. Send resume command to offscreen
4. Wait for OFFSCREEN_RESUMED
5. Trigger FSM: RESUME_REQUESTED
6. Broadcast UI update (isPaused: false)
```

**Stop Recording:**
```
1. Validate current state is RECORDING or PAUSED
2. Trigger FSM: STOP_REQUESTED
3. Send stop command to offscreen
4. Wait for OFFSCREEN_STOPPED
5. Trigger FSM: CHUNKS_FINALIZED
6. Remove FloatingPane from tab
7. Stop UI broadcast timer
8. Close offscreen document
9. Initiate upload or download
10. Trigger FSM: UPLOAD_COMPLETE or UPLOAD_FAILED
11. Clear session state
```

#### Messages Sent (Outbound)

| Message Type | Destination | Trigger |
|--------------|-------------|---------|
| `OFFSCREEN_START_CAPTURE` | Offscreen | Start command |
| `OFFSCREEN_STOP_CAPTURE` | Offscreen | Stop command |
| `OFFSCREEN_PAUSE_RECORDING` | Offscreen | Pause command |
| `OFFSCREEN_RESUME_RECORDING` | Offscreen | Resume command |
| `INJECT_FLOATING_PANE` | Content | Recording started |
| `REMOVE_FLOATING_PANE` | Content | Recording stopped |
| `UI_STATE_UPDATE` | Popup, FloatingPane | State changed |
| `UI_SESSION_ENDED` | Popup, FloatingPane | Session ended |

#### Messages Received (Inbound)

| Message Type | Source | Action |
|--------------|--------|--------|
| `START_RECORDING` | Popup | Begin start sequence |
| `STOP_RECORDING` | Popup | Begin stop sequence |
| `UI_PAUSE_REQUESTED` | Popup | Begin pause sequence |
| `UI_RESUME_REQUESTED` | Popup | Begin resume sequence |
| `FLOATING_PANE_*` | Content | Delegate to appropriate sequence |
| `OFFSCREEN_STARTED` | Offscreen | Complete start sequence |
| `OFFSCREEN_PAUSED` | Offscreen | Complete pause sequence |
| `OFFSCREEN_RESUMED` | Offscreen | Complete resume sequence |
| `OFFSCREEN_STOPPED` | Offscreen | Complete stop sequence |
| `OFFSCREEN_STREAM_ENDED` | Offscreen | Handle external stop |
| `OFFSCREEN_ERROR` | Offscreen | Handle error, trigger recovery |

---

### 4. Offscreen Controller

#### Purpose
Abstracts offscreen document lifecycle and provides semantic methods for capture operations.

#### What It Owns
- Offscreen document creation/destruction
- Offscreen readiness tracking
- Command abstraction (semantic methods → raw messages)
- Message correlation (request → response)

#### What It Does NOT Own
- Media capture logic
- Chunk management
- Audio processing
- IndexedDB operations

#### Interface Contract

```
// Lifecycle
ensureDocument(): Promise<void>
closeDocument(): Promise<void>
isDocumentReady(): boolean

// Capture commands (semantic)
startCapture(config: CaptureConfig): Promise<void>
stopCapture(sessionId: string): Promise<void>
pauseCapture(sessionId: string): Promise<void>
resumeCapture(sessionId: string): Promise<void>

// Audio commands
setAudioEnabled(enabled: boolean): Promise<void>
setAudioMuted(muted: boolean): Promise<void>
```

#### Messages Sent (Outbound to Offscreen)

| Message Type | Purpose |
|--------------|---------|
| `OFFSCREEN_START_CAPTURE` | Begin capture with config |
| `OFFSCREEN_STOP_CAPTURE` | Stop capture gracefully |
| `OFFSCREEN_PAUSE_RECORDING` | Pause MediaRecorder |
| `OFFSCREEN_RESUME_RECORDING` | Resume MediaRecorder |
| `OFFSCREEN_ENABLE_AUDIO` | Enable audio capture |
| `OFFSCREEN_DISABLE_AUDIO` | Disable audio capture |
| `OFFSCREEN_SET_MUTED` | Set mute state |

---

### 5. Audio Controller

#### Purpose
Manages audio policy, state, and settings. Does NOT handle actual audio processing.

#### What It Owns
- Audio enabled/disabled state
- Mute state
- Audio device preference
- Audio settings persistence
- Audio level forwarding to UI

#### What It Does NOT Own
- AudioContext
- MediaStream
- Mixing
- getUserMedia calls

#### Audio States

```
┌─────────────────────────────────────────┐
│            AUDIO CONTROLLER             │
├─────────────────────────────────────────┤
│ enabled: boolean      (audio capture)   │
│ muted: boolean        (gain = 0)        │
│ deviceId: string|null (preferred mic)   │
│ level: number         (0-100, from UI)  │
└─────────────────────────────────────────┘
```

#### Interface Contract

```
// State
isEnabled(): boolean
isMuted(): boolean
getLevel(): number

// Commands
enable(): Promise<void>
disable(): Promise<void>
toggleMute(): Promise<void>
setMuted(muted: boolean): Promise<void>

// Device
setPreferredDevice(deviceId: string): Promise<void>
getPreferredDevice(): string | null
```

#### Messages Sent (Outbound)

| Message Type | Destination | Purpose |
|--------------|-------------|---------|
| `OFFSCREEN_ENABLE_AUDIO` | Offscreen | Enable mic capture |
| `OFFSCREEN_DISABLE_AUDIO` | Offscreen | Disable mic capture |
| `OFFSCREEN_SET_MUTED` | Offscreen | Control gain node |

#### Messages Received (Inbound)

| Message Type | Source | Action |
|--------------|--------|--------|
| `FLOATING_PANE_MUTE_TOGGLE` | Content | Toggle mute |
| `OFFSCREEN_AUDIO_LEVEL` | Offscreen | Update level for UI |

---

### 6. State Broadcast Manager

#### Purpose
Responsible for pushing state updates to all UI consumers (Popup, FloatingPane).

#### What It Owns
- Duration calculation timer
- UI update interval (e.g., every 1000ms)
- Broadcast message formatting
- Pause-aware duration tracking

#### What It Does NOT Own
- FSM state (reads from fsmManager)
- Audio state (reads from audioController)
- Message receiving

#### Broadcast Payload

```typescript
interface UIStateUpdate {
  sessionId: string;
  sessionState: SessionState;
  isPaused: boolean;
  duration: number;        // ms since start (pauses excluded)
  isMuted: boolean;
  audioLevel: number;      // 0-100
}
```

#### Duration Calculation

```
Total Duration = (now - startTime) - totalPausedTime

Where:
- startTime: when RECORDING state was first entered
- totalPausedTime: sum of all (resumeTime - pauseTime) intervals
```

#### Messages Sent (Outbound)

| Message Type | Destination | Frequency |
|--------------|-------------|-----------|
| `UI_STATE_UPDATE` | All tabs + runtime | Every 1000ms while recording |
| `UI_SESSION_ENDED` | All tabs + runtime | Once when session ends |

---

### 7. Persistence Manager

#### Purpose
Abstracts all chrome.storage interactions for session state recovery.

#### What It Owns
- Session state persistence
- Audio preferences persistence
- Video configuration persistence
- Recovery on service worker restart

#### What It Does NOT Own
- IndexedDB (that's offscreen's domain)
- Chunk storage
- Video files

#### Persisted Data

```typescript
interface PersistedState {
  // Session recovery
  isRecording: boolean;
  sessionId: string | null;
  tabId: number | null;
  startTime: number | null;
  pausedTime: number | null;  // when pause started
  totalPausedDuration: number;

  // Configuration
  videoConfig: VideoRecordingConfig;
  audioEnabled: boolean;
  audioMuted: boolean;
  audioDeviceId: string | null;
}
```

#### Interface Contract

```
// Session
saveSession(state: SessionState, context: SessionContext): Promise<void>
loadSession(): Promise<PersistedSession | null>
clearSession(): Promise<void>

// Config
saveVideoConfig(config: VideoRecordingConfig): Promise<void>
loadVideoConfig(): Promise<VideoRecordingConfig>
saveAudioPrefs(prefs: AudioPrefs): Promise<void>
loadAudioPrefs(): Promise<AudioPrefs>
```

---

### 8. Telemetry Controller

#### Purpose
Receives and stores telemetry events from content scripts.

#### What It Owns
- Telemetry event validation
- Event storage (in memory or IndexedDB)
- Session association
- Timestamp normalization

#### What It Does NOT Own
- Event capture (content scripts do this)
- Event interpretation
- UI display

#### Messages Received (Inbound)

| Message Type | Source | Action |
|--------------|--------|--------|
| `CONTENT_TELEMETRY_BATCH` | Content | Store events |

#### Event Storage Strategy

```
Option A: In-memory buffer → flush to IndexedDB on stop
Option B: Direct IndexedDB writes (batched)
Option C: Append to separate telemetry store

Recommendation: Option A for V1 (simpler, less I/O)
```

---

## Message Flow Diagrams

### Start Recording Flow

```
Popup                 Background                    Offscreen
  │                       │                            │
  │ START_RECORDING       │                            │
  │──────────────────────►│                            │
  │                       │ ensureDocument()           │
  │                       │───────────────────────────►│
  │                       │                            │
  │                       │ OFFSCREEN_START_CAPTURE    │
  │                       │───────────────────────────►│
  │                       │                            │
  │                       │      OFFSCREEN_STARTED     │
  │                       │◄───────────────────────────│
  │                       │                            │
  │   { success: true }   │                            │
  │◄──────────────────────│                            │
  │                       │                            │
  │   UI_STATE_UPDATE     │                            │
  │◄──────────────────────│ (broadcast every 1s)      │
```

### Pause/Resume Flow

```
FloatingPane          Background                    Offscreen
  │                       │                            │
  │ FLOATING_PANE_PAUSE   │                            │
  │──────────────────────►│                            │
  │                       │ OFFSCREEN_PAUSE_RECORDING  │
  │                       │───────────────────────────►│
  │                       │                            │
  │                       │      OFFSCREEN_PAUSED      │
  │                       │◄───────────────────────────│
  │                       │                            │
  │   UI_STATE_UPDATE     │ (isPaused: true)          │
  │◄──────────────────────│                            │
  │                       │                            │
  │ FLOATING_PANE_RESUME  │                            │
  │──────────────────────►│                            │
  │                       │ OFFSCREEN_RESUME_RECORDING │
  │                       │───────────────────────────►│
  │                       │                            │
  │                       │      OFFSCREEN_RESUMED     │
  │                       │◄───────────────────────────│
  │                       │                            │
  │   UI_STATE_UPDATE     │ (isPaused: false)         │
  │◄──────────────────────│                            │
```

### External Stop Flow (Tab Closed)

```
                      Background                    Offscreen
                          │                            │
                          │      OFFSCREEN_STREAM_ENDED│
                          │◄───────────────────────────│
                          │                            │
                          │ (FSM: STREAM_ENDED)        │
                          │                            │
                          │ OFFSCREEN_STOP_CAPTURE     │
                          │───────────────────────────►│
                          │                            │
                          │      OFFSCREEN_STOPPED     │
                          │◄───────────────────────────│
                          │                            │
Popup ◄───────────────────│ UI_SESSION_ENDED          │
                          │ (reason: 'stream_ended')   │
```

---

## Error Handling Strategy

### Error Categories

| Category | Example | Recovery |
|----------|---------|----------|
| Recoverable | Offscreen message timeout | Retry with backoff |
| User-caused | Permission denied | Reset to IDLE, show message |
| System | Offscreen crash | Reset to IDLE, show message |
| Data | Chunk write failed | Log, continue recording |

### Error Propagation

```
Offscreen Error → OFFSCREEN_ERROR message → sessionController
    → FSM: CAPTURE_FAILED or error state
    → UI_SESSION_ENDED with error reason
    → Cleanup (close offscreen, remove FloatingPane)
```

---

## Testing Strategy

### Unit Tests

| Component | Test Focus |
|-----------|------------|
| FSM Manager | All transitions, invalid transition rejection |
| Message Router | Handler registration, dispatch, validation |
| Session Controller | Sequence orchestration, error handling |
| Audio Controller | State management, persistence |
| State Broadcast Manager | Duration calculation, pause handling |

### Integration Tests

| Scenario | Components |
|----------|------------|
| Full recording cycle | All controllers + FSM |
| Pause/resume | Session + Offscreen + Broadcast |
| External stop | Session + FSM + Broadcast |
| Service worker restart | Persistence + Recovery |

---

## File Structure (Target)

```
background/
├── index.ts                      # Composition root, wiring only
├── fsm/
│   ├── fsmManager.ts             # State machine
│   ├── transitions.ts            # Transition definitions
│   ├── reducer.ts                # Pure state reducer
│   └── __tests__/
├── routing/
│   ├── messageRouter.ts          # Message dispatch
│   ├── index.ts
│   └── __tests__/
├── controllers/
│   ├── sessionController.ts      # Recording lifecycle
│   ├── offscreenController.ts    # Offscreen abstraction
│   ├── audioController.ts        # Audio policy
│   ├── telemetryController.ts    # Event storage
│   ├── index.ts
│   └── __tests__/
├── ui/
│   ├── stateBroadcastManager.ts  # UI updates
│   ├── floatingPaneController.ts # Pane injection
│   └── __tests__/
├── persistence/
│   ├── persistenceManager.ts     # chrome.storage
│   └── __tests__/
└── contracts/
    └── messages.ts               # (or in shared/)
```

---

## Dependencies Between Components

```
                    ┌─────────────┐
                    │   index.ts  │  (composition root)
                    └──────┬──────┘
                           │ wires
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Router    │ │ Persistence │ │  Broadcast  │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           │      ┌────────┴────────┐      │
           │      │                 │      │
           ▼      ▼                 ▼      ▼
    ┌─────────────────────────────────────────────┐
    │              SESSION CONTROLLER              │
    └──────┬────────────────┬─────────────────────┘
           │                │
           ▼                ▼
    ┌─────────────┐  ┌─────────────┐
    │  Offscreen  │  │    Audio    │
    │ Controller  │  │ Controller  │
    └─────────────┘  └─────────────┘
           │                │
           │       ┌────────┘
           ▼       ▼
    ┌─────────────────┐
    │   FSM MANAGER   │  (no dependencies - pure)
    └─────────────────┘
```

---

## Open Questions

1. Should `offscreenController` queue commands if document isn't ready, or reject immediately?

2. Should `audioController` be a peer of `sessionController`, or nested within it?

3. How should we handle the case where service worker restarts mid-recording?

4. Should telemetry events be stored in the same IndexedDB as video chunks?
