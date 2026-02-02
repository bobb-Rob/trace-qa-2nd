# Component Responsibility Specification — Phase 0

**Status**: DRAFT
**Date**: 2026-02-02

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CHROME EXTENSION                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐   │
│  │     POPUP       │   │   BACKGROUND    │   │   OFFSCREEN DOCUMENT    │   │
│  │  (React UI)     │   │ (Service Worker)│   │   (Media Engine)        │   │
│  ├─────────────────┤   ├─────────────────┤   ├─────────────────────────┤   │
│  │ • Display state │   │ • Orchestration │   │ • MediaRecorder         │   │
│  │ • User input    │   │ • Permissions   │   │ • Blob management       │   │
│  │ • Error display │   │ • Message route │   │ • Stream handling       │   │
│  │ • Config UI     │   │ • State persist │   │                         │   │
│  └────────┬────────┘   └────────┬────────┘   └────────────┬────────────┘   │
│           │                     │                          │                │
│           │    Messages         │       Messages           │                │
│           └─────────────────────┴──────────────────────────┘                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     CHROME.STORAGE.LOCAL                             │    │
│  │  (Shared State - Source of Truth for Recording Status)               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
                        ┌─────────────────────┐
                        │   CLOUDFLARE R2     │
                        │   (Video Storage)   │
                        └─────────────────────┘
```

---

## Component: Popup (React UI)

### File Location
```
src/popup/
├── index.tsx
├── Popup.tsx
├── components/
│   ├── RecordingButton.tsx
│   ├── StatusIndicator.tsx
│   ├── ErrorMessage.tsx
│   ├── RecordingInfo.tsx
│   └── VideoSettings.tsx
└── hooks/
    ├── useRecordingState.ts
    └── useChromeStorage.ts
```

### Responsibilities

| Responsibility | Implementation |
|----------------|----------------|
| Display recording status | Read from `chrome.storage.local`, show indicator |
| Collect user configuration | VideoSettings component with quality/mode selection |
| Trigger start/stop | Send messages to background via `chrome.runtime.sendMessage` |
| Display errors | Show user-friendly error messages with retry option |
| Show recording duration | Calculate from `startTime` in storage |

### Interface Contract

```typescript
// What Popup sends to Background
type PopupOutboundMessages =
  | StartRecordingMessage
  | StopRecordingMessage
  | GetRecordingStatusMessage;

// What Popup reads from Storage
interface PopupStorageState {
  isRecording: boolean;
  sessionId: string | null;
  startTime: number | null;
  videoConfig: VideoRecordingConfig;
  lastError: string | null;
}
```

### NEVER Does

| Forbidden Action | Why |
|------------------|-----|
| Call `getDisplayMedia()` | Permissions belong to background |
| Hold MediaStream | Cannot transfer streams across contexts |
| Upload to R2 | Network operations belong to background |
| Create offscreen document | Lifecycle belongs to background |
| Assume memory persists | Popup can close at any time |

### Error Handling

| Error | User Message | Recovery Action |
|-------|--------------|-----------------|
| `PERMISSION_DENIED` | "Screen access denied. Click to try again." | Show retry button |
| `ALREADY_RECORDING` | "Recording already in progress" | Show stop button |
| `UPLOAD_FAILED` | "Upload failed. Your recording is saved locally." | Show retry upload button |
| `QUOTA_EXCEEDED` | "Recording stopped: file size limit reached" | Show preview anyway |

---

## Component: Background Service Worker

### File Location
```
src/background/
├── index.ts              # Entry point, message listener setup
├── messageRouter.ts      # Routes messages to handlers
├── sessionManager.ts     # Recording session state machine
├── offscreenManager.ts   # Offscreen document lifecycle
├── permissionManager.ts  # getDisplayMedia handling
└── uploadManager.ts      # R2 upload logic
```

### Responsibilities

| Responsibility | Implementation |
|----------------|----------------|
| Route messages | Listen to `chrome.runtime.onMessage`, dispatch to handlers |
| Manage offscreen lifecycle | Create/destroy offscreen document as needed |
| Request screen capture | Call `getDisplayMedia()` with user-selected source |
| Persist session state | Write to `chrome.storage.local` on every state change |
| Upload completed recordings | POST blob to R2 presigned URL |
| Enforce limits | Stop recording at 30min or 100MB |

### Interface Contract

```typescript
// Message Router
interface MessageRouter {
  handleMessage(
    message: AnyMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void
  ): boolean; // Return true to indicate async response
}

// Session Manager State Machine
type SessionState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'STARTING'
  | 'RECORDING'
  | 'STOPPING'
  | 'UPLOADING'
  | 'ERROR';

interface SessionManager {
  getState(): SessionState;
  startRecording(config: StartRecordingPayload): Promise<void>;
  stopRecording(): Promise<StopRecordingResponse>;
  getCurrentSession(): SessionInfo | null;
}
```

### NEVER Does

| Forbidden Action | Why |
|------------------|-----|
| Hold video blob in memory | SW can terminate; use offscreen + IndexedDB |
| Render UI | No DOM in service worker |
| Assume state persists | Always read from `chrome.storage` |
| Block on long operations | Use async patterns, persist intermediate state |

### State Persistence Strategy

```typescript
// On every state transition, persist to storage
async function transitionState(newState: SessionState, data: Partial<SessionData>) {
  await chrome.storage.local.set({
    sessionState: newState,
    sessionId: data.sessionId,
    startTime: data.startTime,
    // ... other fields
  });
}

// On service worker wake, restore from storage
async function restoreState(): Promise<SessionState> {
  const data = await chrome.storage.local.get(['sessionState', 'sessionId', ...]);
  return data.sessionState ?? 'IDLE';
}
```

### Recovery Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| SW dies during recording | State is `RECORDING` but offscreen exists | Re-establish communication with offscreen |
| SW dies during upload | State is `UPLOADING`, blob in IndexedDB | Retry upload on wake |
| Offscreen dies during recording | Message timeout | Report error, clean up state |
| User closes Chrome during recording | State is `RECORDING` on next launch | Show "recording interrupted" message |

---

## Component: Offscreen Document

### File Location
```
src/offscreen/
├── index.html            # Minimal HTML shell
├── index.ts              # Entry point
├── mediaRecorder.ts      # MediaRecorder wrapper
├── blobManager.ts        # Chunk accumulation, size tracking
└── messageHandler.ts     # Handle messages from background
```

### Responsibilities

| Responsibility | Implementation |
|----------------|----------------|
| Run MediaRecorder | Create and control MediaRecorder instance |
| Accumulate chunks | Collect `ondataavailable` chunks into array |
| Track recording size | Sum chunk sizes, emit warning at 80MB |
| Finalize blob | Combine chunks into single Blob on stop |
| Store blob temporarily | Write to IndexedDB for background to retrieve |

### Interface Contract

```typescript
// Offscreen API
interface OffscreenRecorder {
  start(streamId: string, config: MediaRecorderConfig): Promise<void>;
  stop(): Promise<{ blobKey: string; size: number; duration: number }>;
  getStatus(): RecorderStatus;
}

interface RecorderStatus {
  isRecording: boolean;
  duration: number;
  currentSize: number;
  mimeType: string;
}
```

### NEVER Does

| Forbidden Action | Why |
|------------------|-----|
| Show UI to user | Offscreen documents are invisible |
| Request permissions | Must go through background |
| Upload to R2 directly | Network coordination belongs to background |
| Hold more than one recording | One session at a time |

### MediaRecorder Configuration

```typescript
const RECORDER_CONFIG = {
  SD: {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 1_000_000,  // 1 Mbps
  },
  HD: {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2_500_000,  // 2.5 Mbps
  },
};

// Chunk interval: 1 second
// Allows size tracking without waiting for stop
const TIMESLICE_MS = 1000;
```

### Blob Transfer Strategy

Blobs cannot be sent via `chrome.runtime.sendMessage`. Strategy:

```typescript
// In offscreen: store blob in IndexedDB
async function storeBlob(sessionId: string, blob: Blob): Promise<string> {
  const db = await openDB('traceqa-media', 1);
  const key = `recording-${sessionId}`;
  await db.put('blobs', blob, key);
  return key;
}

// In background: retrieve blob from IndexedDB
async function retrieveBlob(key: string): Promise<Blob> {
  const db = await openDB('traceqa-media', 1);
  return await db.get('blobs', key);
}
```

---

## Component: Chrome Storage (Shared State)

### Schema

```typescript
interface TraceQAStorage {
  // Recording state
  isRecording: boolean;
  sessionId: string | null;
  sessionState: SessionState;
  startTime: number | null;
  currentTabId: number | null;

  // User preferences
  videoConfig: VideoRecordingConfig;

  // Error state
  lastError: string | null;
  lastErrorTime: number | null;

  // Upload state (for recovery)
  pendingUpload: {
    blobKey: string;
    sessionId: string;
    retryCount: number;
  } | null;
}
```

### Access Patterns

| Component | Reads | Writes |
|-----------|-------|--------|
| Popup | All fields | `videoConfig` only |
| Background | All fields | All fields |
| Offscreen | None | None (uses IndexedDB for blobs) |

---

## Existing Code Assessment

### Current State (from your popup folder)

| File | Status | Phase 0 Changes Needed |
|------|--------|------------------------|
| `Popup.tsx` | Usable | Add screen picker trigger |
| `RecordingButton.tsx` | Usable | No changes |
| `StatusIndicator.tsx` | Usable | No changes |
| `ErrorMessage.tsx` | Usable | No changes |
| `VideoSettings.tsx` | Needs update | Add capture mode selector (Tab/Desktop/Window) |
| `useRecordingState.ts` | Needs update | Types exist but backend doesn't |
| `useChromeStorage.ts` | Usable | No changes |

### Missing Components

| Component | Priority | Description |
|-----------|----------|-------------|
| `src/background/index.ts` | P0 | Service worker entry point |
| `src/background/messageRouter.ts` | P0 | Message dispatch |
| `src/background/sessionManager.ts` | P0 | State machine |
| `src/background/offscreenManager.ts` | P0 | Offscreen lifecycle |
| `src/offscreen/index.ts` | P0 | Offscreen entry |
| `src/offscreen/mediaRecorder.ts` | P0 | MediaRecorder wrapper |
| ~~`src/shared/types/index.ts`~~ | ✅ Done | Shared type definitions |
| ~~`src/shared/utils/cn.ts`~~ | ✅ Done | Utility functions |

---

## What Could Go Wrong?

| Component | Risk | Mitigation |
|-----------|------|------------|
| Popup | User spams start/stop | Disable button during loading state |
| Background | Loses track of offscreen | Keep offscreen reference in closure; recreate if needed |
| Background | Dies mid-upload | Store blob key in storage; retry on wake |
| Offscreen | MediaRecorder error | Catch error, notify background, clean up |
| Storage | Quota exceeded | Clear old sessions; warn user |
| All | Version mismatch after update | Include version in messages; validate |
