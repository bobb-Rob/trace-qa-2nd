# Logging & Observability Design Specification

**Document Version:** 1.0
**Date:** 2026-02-05
**Status:** Draft

---

## Overview

This document defines a **dual-channel logging system** for TraceQA that provides both human-readable diagnostics and machine-readable event logs across all three planes (Background, Offscreen, Content).

**Key Requirements:**
- Logs survive DevTools closure
- Logs are correlated by sessionId, component, and subsystem
- Low overhead, production-safe
- No console.log dependency
- No global singletons with hidden state

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOGGING ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                 │
│  │   CONTENT     │   │   OFFSCREEN   │   │   BACKGROUND  │                 │
│  │   SCRIPT      │   │   DOCUMENT    │   │   SERVICE     │                 │
│  │               │   │               │   │   WORKER      │                 │
│  │ ┌───────────┐ │   │ ┌───────────┐ │   │ ┌───────────┐ │                 │
│  │ │  Logger   │ │   │ │  Logger   │ │   │ │  Logger   │ │                 │
│  │ │ Instance  │ │   │ │ Instance  │ │   │ │ Instance  │ │                 │
│  │ └─────┬─────┘ │   │ └─────┬─────┘ │   │ └─────┬─────┘ │                 │
│  └───────┼───────┘   └───────┼───────┘   └───────┼───────┘                 │
│          │                   │                   │                          │
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     LOG TRANSPORT LAYER                              │   │
│  │                                                                      │   │
│  │   Content ──► chrome.runtime.sendMessage ──► Background             │   │
│  │   Offscreen ──► chrome.runtime.sendMessage ──► Background           │   │
│  │   Background ──► Direct write                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     LOG COLLECTOR (Background)                       │   │
│  │                                                                      │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │   │
│  │   │   BUFFER    │    │  PROCESSOR  │    │   WRITER    │            │   │
│  │   │             │───►│             │───►│             │            │   │
│  │   │ In-memory   │    │ Enrich      │    │ IndexedDB   │            │   │
│  │   │ ring buffer │    │ Correlate   │    │ or          │            │   │
│  │   │ (1000 max)  │    │ Filter      │    │ File System │            │   │
│  │   └─────────────┘    └─────────────┘    └─────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                    ┌─────────────────┼─────────────────┐                   │
│                    │                 │                 │                   │
│                    ▼                 ▼                 ▼                   │
│             ┌───────────┐     ┌───────────┐     ┌───────────┐             │
│             │ IndexedDB │     │  Export   │     │  DevTools │             │
│             │  Storage  │     │  (JSON)   │     │ (optional)│             │
│             └───────────┘     └───────────┘     └───────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dual-Channel Logging

### Channel 1: Human-Facing Diagnostic Logs

For developer debugging during development and troubleshooting.

```typescript
// Example output format
[2026-02-05T14:32:15.123Z] [INFO] [background:fsm]
  State transition: RECORDING → PAUSED
  sessionId: session_abc123
  trigger: PAUSE_REQUESTED
  duration: 15234ms
```

**Characteristics:**
- Formatted for readability
- Includes context inline
- Timestamp is human-readable
- Can be written to console in development mode

### Channel 2: System-Facing Event Logs

For machine processing, replay, audit, and upload.

```typescript
// Example structured format
{
  "id": "log_7f3a2b1c",
  "timestamp": 1738766535123,
  "level": "info",
  "component": "background",
  "subsystem": "fsm",
  "sessionId": "session_abc123",
  "event": "state_transition",
  "data": {
    "from": "RECORDING",
    "to": "PAUSED",
    "trigger": "PAUSE_REQUESTED",
    "duration": 15234
  },
  "correlationId": "corr_xyz789"
}
```

**Characteristics:**
- JSON structured
- Machine-parseable
- Fixed schema
- Suitable for indexing and querying

---

## Log Schema Definition

### Base Log Entry

```typescript
interface LogEntry {
  // Identity
  id: string;                    // Unique log ID (UUID)
  correlationId?: string;        // Links related logs across planes

  // Timing
  timestamp: number;             // Unix epoch ms
  relativeTime?: number;         // ms since session start (if in session)

  // Classification
  level: LogLevel;
  component: LogComponent;
  subsystem: LogSubsystem;

  // Context
  sessionId?: string;            // Current recording session (if any)

  // Content
  event: string;                 // Event name (snake_case)
  message: string;               // Human-readable message
  data?: Record<string, unknown>;// Structured payload

  // Error info (if applicable)
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogComponent =
  | 'background'
  | 'offscreen'
  | 'content'
  | 'popup'
  | 'floating_pane';

type LogSubsystem =
  | 'fsm'           // State machine
  | 'session'       // Session controller
  | 'media'         // Stream/recorder management
  | 'audio'         // Audio capture/mixing
  | 'storage'       // IndexedDB operations
  | 'transport'     // Message passing
  | 'telemetry'     // User event capture
  | 'ui'            // UI state/rendering
  | 'lifecycle'     // Component lifecycle
  | 'network'       // Network operations
  | 'permission';   // Permission handling
```

### Specialized Log Types

#### FSM Transition Log

```typescript
interface FsmTransitionLog extends LogEntry {
  event: 'state_transition';
  subsystem: 'fsm';
  data: {
    from: SessionState;
    to: SessionState;
    trigger: SessionEventType;
    context?: Partial<SessionContext>;
    valid: boolean;
    rejectionReason?: string;
  };
}
```

#### Media Lifecycle Log

```typescript
interface MediaLifecycleLog extends LogEntry {
  event: 'media_lifecycle';
  subsystem: 'media';
  data: {
    action: 'stream_acquired' | 'stream_ended' | 'recorder_started' |
            'recorder_paused' | 'recorder_resumed' | 'recorder_stopped' |
            'chunk_created' | 'chunk_stored';
    streamId?: string;
    trackCount?: number;
    hasAudio?: boolean;
    hasVideo?: boolean;
    chunkIndex?: number;
    chunkSize?: number;
    duration?: number;
    mimeType?: string;
    reason?: string;
  };
}
```

#### Audio Log

```typescript
interface AudioLog extends LogEntry {
  event: 'audio_event';
  subsystem: 'audio';
  data: {
    action: 'mic_acquired' | 'mic_denied' | 'mixer_initialized' |
            'mute_changed' | 'level_update' | 'audio_error';
    deviceId?: string;
    muted?: boolean;
    level?: number;
    previousState?: string;
    newState?: string;
  };
}
```

#### Telemetry Batch Log

```typescript
interface TelemetryBatchLog extends LogEntry {
  event: 'telemetry_batch';
  subsystem: 'telemetry';
  data: {
    action: 'batch_created' | 'batch_sent' | 'batch_failed' | 'batch_dropped';
    batchId: string;
    eventCount: number;
    byteSize: number;
    eventTypes: Record<string, number>;  // Count by type
    oldestEvent: number;  // Timestamp
    newestEvent: number;  // Timestamp
    retryCount?: number;
    error?: string;
  };
}
```

---

## Logging Responsibilities Per Plane

### Background Service Worker

**Role:** Log collector and primary storage

| Responsibility | Details |
|----------------|---------|
| Collect logs from all planes | Receives logs via message passing |
| Enrich logs | Add correlationId, normalize timestamps |
| Buffer logs | In-memory ring buffer (1000 entries) |
| Persist logs | Write to IndexedDB periodically |
| Export logs | Generate downloadable JSON |
| Filter by level | Apply production log level |

**What It Logs:**
- FSM transitions (all)
- Session lifecycle events
- Message routing
- Offscreen document lifecycle
- UI state broadcasts
- Errors from all sources

### Offscreen Document

**Role:** Media operation logging

| Responsibility | Details |
|----------------|---------|
| Generate logs | Create log entries for media operations |
| Buffer locally | Small buffer (100 entries) before send |
| Send to background | Batch send every 1 second or on flush |
| Handle send failure | Retry with backoff, drop after 3 failures |

**What It Logs:**
- Stream acquisition
- MediaRecorder lifecycle
- Chunk creation and storage
- Audio mixer operations
- Audio level samples (sampled, not every update)
- Errors

### Content Script

**Role:** Telemetry and UI logging

| Responsibility | Details |
|----------------|---------|
| Generate logs | Create log entries for capture operations |
| Minimal buffering | Send immediately or buffer max 50 entries |
| Send to background | Via chrome.runtime.sendMessage |
| Survive page unload | Flush on beforeunload |

**What It Logs:**
- Capture module activation/deactivation
- Telemetry batch creation and send
- FloatingPane interactions
- Page lifecycle events
- Errors

---

## Log Transport Strategy

### Message Format

```typescript
interface LogTransportMessage {
  type: 'LOG_ENTRIES';
  payload: {
    source: LogComponent;
    entries: LogEntry[];
    metadata: {
      batchId: string;
      timestamp: number;
      entryCount: number;
    };
  };
}
```

### Transport Flow

```
┌─────────────┐                    ┌─────────────┐
│   Content   │                    │  Background │
│   Script    │                    │             │
│             │  LOG_ENTRIES       │             │
│  buffer[]   │───────────────────►│  collector  │
│             │                    │             │
└─────────────┘                    └─────────────┘

┌─────────────┐                    ┌─────────────┐
│  Offscreen  │                    │  Background │
│             │                    │             │
│             │  LOG_ENTRIES       │             │
│  buffer[]   │───────────────────►│  collector  │
│             │                    │             │
└─────────────┘                    └─────────────┘

┌─────────────┐
│  Background │
│             │
│   logger    │──► direct write to collector
│             │
└─────────────┘
```

### Batching Strategy

| Plane | Buffer Size | Flush Interval | Flush Triggers |
|-------|-------------|----------------|----------------|
| Background | 100 | 5 seconds | Error, session end, export |
| Offscreen | 100 | 1 second | Stop capture, error |
| Content | 50 | 2 seconds | Page unload, session end |

---

## Log Storage Strategy

### Primary Storage: IndexedDB

```typescript
// Database: "traceqa-logs"
// Version: 1

interface LogStore {
  // Object store: "logs"
  keyPath: 'id';
  indexes: [
    { name: 'by-session', keyPath: 'sessionId' },
    { name: 'by-timestamp', keyPath: 'timestamp' },
    { name: 'by-level', keyPath: 'level' },
    { name: 'by-component', keyPath: 'component' },
    { name: 'by-subsystem', keyPath: 'subsystem' },
  ];
}
```

### Storage Limits

| Limit | Value | Action When Exceeded |
|-------|-------|---------------------|
| Max entries per session | 10,000 | Drop oldest debug logs |
| Max total entries | 50,000 | Drop oldest sessions |
| Max entry size | 10KB | Truncate data field |
| Max storage size | 50MB | Prune oldest entries |

### Retention Policy

| Log Level | Retention |
|-----------|-----------|
| Error | 30 days |
| Warn | 14 days |
| Info | 7 days |
| Debug | 24 hours (dev only) |

---

## Log Level Management

### Level Hierarchy

```
ERROR > WARN > INFO > DEBUG

Production default: INFO
Development default: DEBUG
```

### Per-Subsystem Levels

```typescript
interface LogConfig {
  globalLevel: LogLevel;
  subsystemLevels: Partial<Record<LogSubsystem, LogLevel>>;
}

// Example production config
const productionConfig: LogConfig = {
  globalLevel: 'info',
  subsystemLevels: {
    fsm: 'info',        // Always log state transitions
    media: 'warn',      // Only problems
    audio: 'warn',      // Only problems
    telemetry: 'info',  // Batch summaries
    storage: 'warn',    // Only problems
  }
};

// Example development config
const developmentConfig: LogConfig = {
  globalLevel: 'debug',
  subsystemLevels: {
    // All subsystems at debug in dev
  }
};
```

### Runtime Level Adjustment

```typescript
// Can be adjusted via extension options or debug command
function setLogLevel(level: LogLevel, subsystem?: LogSubsystem): void;
function getLogLevel(subsystem?: LogSubsystem): LogLevel;
```

---

## Correlation Strategy

### Session Correlation

All logs within a recording session share the same `sessionId`:

```typescript
// Log from background
{ sessionId: "session_abc123", component: "background", ... }

// Log from offscreen (same session)
{ sessionId: "session_abc123", component: "offscreen", ... }

// Log from content (same session)
{ sessionId: "session_abc123", component: "content", ... }
```

### Operation Correlation

Related operations across planes share a `correlationId`:

```typescript
// Start recording flow - all share correlationId
{ correlationId: "corr_xyz", event: "start_requested", component: "background" }
{ correlationId: "corr_xyz", event: "offscreen_created", component: "background" }
{ correlationId: "corr_xyz", event: "capture_starting", component: "offscreen" }
{ correlationId: "corr_xyz", event: "stream_acquired", component: "offscreen" }
{ correlationId: "corr_xyz", event: "capture_started", component: "background" }
```

### Correlation ID Generation

```typescript
// Background generates correlationId for operations
function generateCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Passed to other planes in command payloads
interface CommandWithCorrelation {
  type: string;
  payload: {
    correlationId: string;
    // ... other fields
  };
}
```

---

## Failure Handling

### Quota Exceeded

```
1. Stop writing new logs to IndexedDB
2. Log error to in-memory buffer only
3. Attempt to prune old logs (oldest debug first)
4. If prune succeeds, resume writing
5. If prune fails, continue with in-memory only
6. On next session start, attempt recovery
```

### Transport Failure

```
1. Content/Offscreen cannot reach background
2. Buffer logs locally (up to limit)
3. Retry with exponential backoff (1s, 2s, 4s)
4. After 3 failures, mark logs as "undelivered"
5. On reconnect, attempt to send buffered logs
6. Drop oldest if buffer exceeds limit
```

### Service Worker Termination

```
1. Background service worker may terminate
2. In-memory buffer is lost
3. IndexedDB persists
4. On wake, collector resumes from persisted state
5. Logs from other planes queue until background wakes
```

---

## Log Examples

### FSM Transition Log

**Human-facing:**
```
[2026-02-05T14:32:15.123Z] [INFO] [background:fsm]
  State transition: RECORDING → PAUSED
  Session: session_abc123
  Trigger: PAUSE_REQUESTED
  Recording duration: 15.2s
```

**System-facing:**
```json
{
  "id": "log_a1b2c3d4",
  "timestamp": 1738766535123,
  "level": "info",
  "component": "background",
  "subsystem": "fsm",
  "sessionId": "session_abc123",
  "correlationId": "corr_pause_001",
  "event": "state_transition",
  "message": "State transition: RECORDING → PAUSED",
  "data": {
    "from": "RECORDING",
    "to": "PAUSED",
    "trigger": "PAUSE_REQUESTED",
    "duration": 15234,
    "valid": true
  }
}
```

### Media Lifecycle Log

**Human-facing:**
```
[2026-02-05T14:32:00.456Z] [INFO] [offscreen:media]
  MediaRecorder started
  Session: session_abc123
  MIME: video/webm; codecs=vp9,opus
  Tracks: 2 (video: 1, audio: 1)
```

**System-facing:**
```json
{
  "id": "log_e5f6g7h8",
  "timestamp": 1738766520456,
  "level": "info",
  "component": "offscreen",
  "subsystem": "media",
  "sessionId": "session_abc123",
  "correlationId": "corr_start_001",
  "event": "media_lifecycle",
  "message": "MediaRecorder started",
  "data": {
    "action": "recorder_started",
    "mimeType": "video/webm; codecs=vp9,opus",
    "trackCount": 2,
    "hasVideo": true,
    "hasAudio": true,
    "videoBitsPerSecond": 2500000
  }
}
```

### Audio Pause/Resume Log

**Human-facing:**
```
[2026-02-05T14:32:20.789Z] [INFO] [offscreen:audio]
  Audio mute changed: unmuted → muted
  Session: session_abc123
```

**System-facing:**
```json
{
  "id": "log_i9j0k1l2",
  "timestamp": 1738766540789,
  "level": "info",
  "component": "offscreen",
  "subsystem": "audio",
  "sessionId": "session_abc123",
  "correlationId": "corr_mute_001",
  "event": "audio_event",
  "message": "Audio mute changed: unmuted → muted",
  "data": {
    "action": "mute_changed",
    "muted": true,
    "previousState": "unmuted",
    "newState": "muted"
  }
}
```

### Telemetry Batch Log

**Human-facing:**
```
[2026-02-05T14:32:25.012Z] [INFO] [content:telemetry]
  Telemetry batch sent
  Session: session_abc123
  Events: 47 (click: 12, scroll: 30, input: 5)
  Size: 15.2KB
```

**System-facing:**
```json
{
  "id": "log_m3n4o5p6",
  "timestamp": 1738766545012,
  "level": "info",
  "component": "content",
  "subsystem": "telemetry",
  "sessionId": "session_abc123",
  "event": "telemetry_batch",
  "message": "Telemetry batch sent",
  "data": {
    "action": "batch_sent",
    "batchId": "batch_xyz789",
    "eventCount": 47,
    "byteSize": 15565,
    "eventTypes": {
      "click": 12,
      "scroll": 30,
      "input": 5
    },
    "oldestEvent": 1738766540000,
    "newestEvent": 1738766544999
  }
}
```

### Error Log

**Human-facing:**
```
[2026-02-05T14:32:30.345Z] [ERROR] [offscreen:storage]
  Failed to write chunk to IndexedDB
  Session: session_abc123
  Chunk: 15
  Error: QuotaExceededError: The quota has been exceeded
```

**System-facing:**
```json
{
  "id": "log_q7r8s9t0",
  "timestamp": 1738766550345,
  "level": "error",
  "component": "offscreen",
  "subsystem": "storage",
  "sessionId": "session_abc123",
  "correlationId": "corr_chunk_015",
  "event": "storage_error",
  "message": "Failed to write chunk to IndexedDB",
  "data": {
    "action": "chunk_write_failed",
    "chunkIndex": 15,
    "chunkSize": 1048576
  },
  "error": {
    "name": "QuotaExceededError",
    "message": "The quota has been exceeded",
    "stack": "QuotaExceededError: The quota has been exceeded\n    at IDBObjectStore.add..."
  }
}
```

---

## Logger Interface (No Global Singleton)

### Factory Pattern

```typescript
// Each plane creates its own logger instance
// No shared global state

interface LoggerConfig {
  component: LogComponent;
  defaultSubsystem: LogSubsystem;
  sessionProvider: () => string | null;
  transport: LogTransport;
  level: LogLevel;
}

interface LogTransport {
  send(entries: LogEntry[]): Promise<void>;
  flush(): Promise<void>;
}

// Usage in background
const backgroundLogger = createLogger({
  component: 'background',
  defaultSubsystem: 'session',
  sessionProvider: () => fsmManager.getContext().sessionId,
  transport: directWriteTransport,
  level: getConfiguredLevel(),
});

// Usage in offscreen
const offscreenLogger = createLogger({
  component: 'offscreen',
  defaultSubsystem: 'media',
  sessionProvider: () => captureController.getSessionId(),
  transport: messagePassingTransport,
  level: getConfiguredLevel(),
});

// Usage in content
const contentLogger = createLogger({
  component: 'content',
  defaultSubsystem: 'telemetry',
  sessionProvider: () => sessionManager.getSessionId(),
  transport: messagePassingTransport,
  level: getConfiguredLevel(),
});
```

### Logger Methods

```typescript
interface Logger {
  // Standard levels
  debug(event: string, message: string, data?: unknown): void;
  info(event: string, message: string, data?: unknown): void;
  warn(event: string, message: string, data?: unknown): void;
  error(event: string, message: string, error?: Error, data?: unknown): void;

  // Scoped logger for subsystem
  forSubsystem(subsystem: LogSubsystem): Logger;

  // Correlation
  withCorrelation(correlationId: string): Logger;

  // Control
  setLevel(level: LogLevel): void;
  flush(): Promise<void>;
}
```

### Usage Example

```typescript
// In sessionController.ts
const log = backgroundLogger.forSubsystem('session');

async function handleStartRecording(payload: StartPayload): Promise<void> {
  const correlationId = generateCorrelationId();
  const scopedLog = log.withCorrelation(correlationId);

  scopedLog.info('start_requested', 'Recording start requested', {
    sessionId: payload.sessionId,
    tabId: payload.tabId,
  });

  try {
    await offscreenController.startCapture({
      ...payload,
      correlationId,  // Pass to offscreen
    });

    scopedLog.info('start_complete', 'Recording started successfully');
  } catch (error) {
    scopedLog.error('start_failed', 'Failed to start recording', error);
    throw error;
  }
}
```

---

## Export and Debug Features

### Log Export

```typescript
interface LogExportOptions {
  sessionId?: string;      // Filter by session
  startTime?: number;      // Filter by time range
  endTime?: number;
  levels?: LogLevel[];     // Filter by level
  components?: LogComponent[];
  subsystems?: LogSubsystem[];
  format: 'json' | 'ndjson';
}

async function exportLogs(options: LogExportOptions): Promise<Blob>;
```

### Debug Commands (Development Only)

```typescript
// Available via extension debug page or console (dev builds only)

// View recent logs
__traceqa_logs.recent(count?: number): LogEntry[];

// Filter logs
__traceqa_logs.filter(options: FilterOptions): LogEntry[];

// Export to console (formatted)
__traceqa_logs.print(options?: PrintOptions): void;

// Clear logs
__traceqa_logs.clear(options?: ClearOptions): Promise<void>;

// Set log level at runtime
__traceqa_logs.setLevel(level: LogLevel, subsystem?: LogSubsystem): void;
```

---

## Production vs Development

### Production Mode

| Aspect | Behavior |
|--------|----------|
| Default level | INFO |
| Console output | Disabled |
| Debug logs | Not stored |
| Stack traces | Truncated (500 chars) |
| Data payloads | Truncated (1KB) |
| Retention | Standard policy |

### Development Mode

| Aspect | Behavior |
|--------|----------|
| Default level | DEBUG |
| Console output | Enabled (formatted) |
| Debug logs | Stored |
| Stack traces | Full |
| Data payloads | Full (up to 10KB) |
| Retention | 24 hours |

### Mode Detection

```typescript
function isDevMode(): boolean {
  // Check manifest, build flag, or storage setting
  return chrome.runtime.getManifest().version_name?.includes('dev') ?? false;
}
```

---

## File Structure

```
shared/
├── logging/
│   ├── index.ts              # Public exports
│   ├── types.ts              # LogEntry, LogLevel, etc.
│   ├── factory.ts            # createLogger factory
│   ├── formatter.ts          # Human-readable formatting
│   └── transports/
│       ├── direct.ts         # For background
│       └── message.ts        # For content/offscreen

background/
├── logging/
│   ├── collector.ts          # Log collector
│   ├── storage.ts            # IndexedDB operations
│   ├── pruner.ts             # Retention/cleanup
│   └── exporter.ts           # Export functionality
```

---

## Constraints Verification

| Constraint | How Addressed |
|------------|---------------|
| No global singleton with hidden state | Factory pattern, explicit dependencies |
| No direct chrome.storage abuse | IndexedDB for logs, not chrome.storage |
| No console.log as primary | Disabled in production, optional in dev |
| Works even if UI is closed | Background collector persists to IndexedDB |
| No circular dependencies | Logger is leaf dependency, imports nothing |
| Survives DevTools closure | IndexedDB persists independently |

---

## Open Questions

1. Should we support streaming logs to an external service in production?

2. Should we implement log sampling for high-frequency events (e.g., audio levels)?

3. Should we include performance metrics (memory, CPU) in logs?

4. Should we support log redaction for sensitive session data before export?
