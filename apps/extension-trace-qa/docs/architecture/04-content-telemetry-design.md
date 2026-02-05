# Content Script Telemetry Design Specification

**Document Version:** 1.0
**Date:** 2026-02-05
**Status:** Draft

---

## Overview

The Content Script telemetry system captures **user intent and context**, not raw noise. It runs in the user's webpage context and is designed to be:

- **Performance-safe** – Never blocks user interaction
- **Session-aware** – Knows which session events belong to
- **Stateless** – No local state management
- **Batched** – Events are buffered and sent in batches

**Critical Constraints:**
- Content scripts **never** manage recording state
- Content scripts **never** interpret event meaning
- Content scripts **never** block the main thread
- All events are **timestamped relative to session start**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTENT SCRIPT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         LIFECYCLE MANAGER                               │ │
│  │  • Receives session start/end from background                          │ │
│  │  • Coordinates capture module activation                               │ │
│  │  • Handles page unload gracefully                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│         ┌────────────────────────────┼────────────────────────────┐         │
│         │                            │                            │         │
│         ▼                            ▼                            ▼         │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐      │
│  │   CLICKS    │            │   INPUTS    │            │   SCROLL    │      │
│  │   CAPTURE   │            │   CAPTURE   │            │   CAPTURE   │      │
│  └──────┬──────┘            └──────┬──────┘            └──────┬──────┘      │
│         │                          │                          │             │
│         │    ┌─────────────┐       │    ┌─────────────┐      │             │
│         │    │  NAVIGATION │       │    │   NETWORK   │      │             │
│         │    │   CAPTURE   │       │    │   CAPTURE   │      │             │
│         │    └──────┬──────┘       │    └──────┬──────┘      │             │
│         │           │              │           │              │             │
│         │           │    ┌─────────────┐       │              │             │
│         │           │    │   CONSOLE   │       │              │             │
│         │           │    │   CAPTURE   │       │              │             │
│         │           │    └──────┬──────┘       │              │             │
│         │           │           │              │              │             │
│         │           │           │    ┌─────────────┐          │             │
│         │           │           │    │    DOM      │          │             │
│         │           │           │    │  SNAPSHOTS  │          │             │
│         │           │           │    └──────┬──────┘          │             │
│         │           │           │           │                 │             │
│         └───────────┴───────────┴───────────┴─────────────────┘             │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          EVENT BUFFER                                   │ │
│  │  • Collects events from all capture modules                            │ │
│  │  • Applies filtering and throttling                                    │ │
│  │  • Triggers flush on threshold or interval                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       BACKGROUND BRIDGE                                 │ │
│  │  • Sends batched events to background                                  │ │
│  │  • Handles message failures gracefully                                 │ │
│  │  • Flushes on page unload                                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
                              [ BACKGROUND ]
```

---

## Event Schema

### Base Event Structure

All telemetry events share a common base structure:

```typescript
interface TelemetryEvent {
  // Identity
  id: string;              // Unique event ID (UUID v4)
  sessionId: string;       // Recording session this belongs to

  // Timing
  timestamp: number;       // ms since Unix epoch
  relativeTime: number;    // ms since session start (for alignment with video)

  // Type
  type: TelemetryEventType;

  // Payload (type-specific)
  payload: TelemetryPayload;

  // Context (optional)
  context?: EventContext;
}

type TelemetryEventType =
  | 'click'
  | 'input'
  | 'scroll'
  | 'navigation'
  | 'network'
  | 'console'
  | 'dom_snapshot'
  | 'error'
  | 'visibility';

interface EventContext {
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
}
```

### Event Type Payloads

#### Click Event

```typescript
interface ClickPayload {
  // Position
  x: number;              // Viewport X coordinate
  y: number;              // Viewport Y coordinate
  pageX: number;          // Document X coordinate
  pageY: number;          // Document Y coordinate

  // Target
  selector: string;       // CSS selector (simplified)
  tagName: string;        // Element tag name
  textContent: string;    // Truncated text (max 100 chars)

  // Metadata
  button: number;         // 0=left, 1=middle, 2=right
  isDoubleClick: boolean;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}
```

#### Input Event

```typescript
interface InputPayload {
  // Target
  selector: string;
  tagName: string;        // 'INPUT' | 'TEXTAREA' | 'SELECT' | etc.
  inputType: string;      // 'text' | 'email' | 'password' | etc.
  name: string;           // Input name attribute

  // Value (sanitized)
  value: string;          // REDACTED for password fields
  previousValue: string;  // REDACTED for password fields

  // Metadata
  isFocused: boolean;
  isBlur: boolean;
}
```

#### Scroll Event

```typescript
interface ScrollPayload {
  // Position
  scrollX: number;
  scrollY: number;
  maxScrollX: number;
  maxScrollY: number;

  // Direction
  direction: 'up' | 'down' | 'left' | 'right';

  // Target (if not window)
  selector?: string;      // Only if scrolling within element
}
```

#### Navigation Event

```typescript
interface NavigationPayload {
  // URLs
  from: string;
  to: string;

  // Type
  navigationType: 'push' | 'replace' | 'pop' | 'reload';

  // Timing
  loadTime?: number;      // ms to load (if available)
}
```

#### Network Event

```typescript
interface NetworkPayload {
  // Request
  method: string;         // GET, POST, etc.
  url: string;
  requestHeaders: Record<string, string>;  // Filtered
  requestBody?: string;   // Truncated, sanitized

  // Response
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;  // Filtered
  responseSize: number;   // bytes

  // Timing
  duration: number;       // ms

  // Type
  resourceType: 'fetch' | 'xhr' | 'script' | 'style' | 'image' | 'other';
}
```

#### Console Event

```typescript
interface ConsolePayload {
  // Level
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';

  // Content
  message: string;        // Truncated (max 1000 chars)
  args: string[];         // Serialized arguments (truncated)

  // Source
  source?: string;        // File URL
  lineNumber?: number;
  columnNumber?: number;

  // Stack (for errors)
  stack?: string;         // Truncated (max 2000 chars)
}
```

#### DOM Snapshot Event

```typescript
interface DomSnapshotPayload {
  // Trigger
  trigger: 'mutation' | 'interval' | 'navigation' | 'manual';

  // Content (lightweight)
  visibleText: string;    // Truncated visible text
  formState: Record<string, string>;  // Form field values (sanitized)

  // Structure (optional, expensive)
  structure?: {
    nodeCount: number;
    depth: number;
    interactiveElements: number;
  };
}
```

#### Error Event

```typescript
interface ErrorPayload {
  // Error info
  message: string;
  name: string;           // Error type name
  stack?: string;

  // Source
  filename?: string;
  lineno?: number;
  colno?: number;

  // Type
  errorType: 'uncaught' | 'unhandledrejection' | 'resource';
}
```

#### Visibility Event

```typescript
interface VisibilityPayload {
  // State
  state: 'visible' | 'hidden';

  // Duration (on hide)
  visibleDuration?: number;  // ms since last visible
}
```

---

## Capture Rules

### Global Rules (Apply to All Capture Modules)

| Rule | Description | Rationale |
|------|-------------|-----------|
| No sync heavy work | All capture must be async or use requestIdleCallback | Never block user |
| Timestamp everything | All events get timestamp on capture | Alignment with video |
| Sanitize PII | Redact passwords, filter sensitive headers | Privacy |
| Truncate large data | Max sizes for all string fields | Memory safety |
| Debounce rapid events | Scroll, input use debouncing | Reduce noise |
| Check session active | Don't capture if no active session | Efficiency |

### Module-Specific Rules

#### Clicks Capture

```typescript
// Capture rules for clicks
const clickRules = {
  // Debounce rapid clicks (spam protection)
  debounceMs: 50,

  // Ignore clicks on certain elements
  ignoreSelectors: [
    '[data-telemetry-ignore]',
    '.telemetry-ignore',
  ],

  // Selector generation
  maxSelectorDepth: 5,
  preferIds: true,
  preferDataTestId: true,

  // Text truncation
  maxTextContent: 100,
};
```

#### Inputs Capture

```typescript
// Capture rules for inputs
const inputRules = {
  // Debounce input changes
  debounceMs: 300,

  // Sensitive field detection
  sensitiveTypes: ['password', 'credit-card', 'ssn'],
  sensitiveNames: [/password/i, /secret/i, /token/i, /credit/i, /ssn/i],
  sensitiveAutocomplete: ['current-password', 'new-password', 'cc-number'],

  // Value handling
  redactedPlaceholder: '[REDACTED]',
  maxValueLength: 500,

  // Capture on
  events: ['change', 'blur'],  // NOT 'input' (too noisy)
};
```

#### Scroll Capture

```typescript
// Capture rules for scroll
const scrollRules = {
  // Aggressive debouncing
  debounceMs: 150,

  // Minimum scroll distance to capture
  minScrollDelta: 100,  // pixels

  // Throttle scroll events
  maxEventsPerSecond: 4,

  // Only capture end position, not intermediate
  captureStrategy: 'end',
};
```

#### Navigation Capture

```typescript
// Capture rules for navigation
const navigationRules = {
  // Capture types
  captureTypes: ['pushState', 'replaceState', 'popstate', 'hashchange'],

  // URL sanitization
  stripQueryParams: ['token', 'key', 'secret', 'password'],
  stripHashParams: true,

  // Don't capture anchor-only changes
  ignoreAnchorOnly: true,
};
```

#### Network Capture

```typescript
// Capture rules for network
const networkRules = {
  // Resource types to capture
  captureTypes: ['fetch', 'xhr'],
  ignoreTypes: ['image', 'font', 'style'],  // Too noisy

  // URL filtering
  ignoreUrls: [
    /google-analytics\.com/,
    /doubleclick\.net/,
    /facebook\.com\/tr/,
    /hotjar\.com/,
    /segment\.io/,
  ],

  // Header filtering (remove sensitive)
  filterHeaders: [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
  ],

  // Body handling
  maxBodySize: 10000,  // bytes
  captureRequestBody: false,  // Opt-in
  captureResponseBody: false, // Opt-in

  // Only capture failures by default
  captureSuccessful: true,
  captureErrors: true,
};
```

#### Console Capture

```typescript
// Capture rules for console
const consoleRules = {
  // Levels to capture
  captureLevels: ['warn', 'error'],  // NOT log/info/debug by default

  // Message filtering
  ignorePatterns: [
    /^\[HMR\]/,           // Hot module reload
    /^\[webpack/,         // Webpack dev
    /DevTools/,           // DevTools messages
  ],

  // Truncation
  maxMessageLength: 1000,
  maxStackLength: 2000,
  maxArgs: 5,

  // Rate limiting
  maxEventsPerSecond: 10,
};
```

#### DOM Snapshot Capture

```typescript
// Capture rules for DOM snapshots
const domSnapshotRules = {
  // Trigger conditions
  triggers: {
    onNavigation: true,
    onMutation: false,    // Too expensive
    interval: 0,          // Disabled (0 = off)
  },

  // Content limits
  maxVisibleText: 5000,
  maxFormFields: 50,

  // Performance
  useIdleCallback: true,
  maxExecutionTime: 50,   // ms, abort if exceeded
};
```

---

## Event Buffer

### Buffer Configuration

```typescript
interface BufferConfig {
  // Flush triggers
  maxEvents: 50;           // Flush when buffer has this many events
  maxAgeMs: 5000;          // Flush after this time regardless of count
  flushOnUnload: true;     // Flush when page is unloading

  // Memory limits
  maxBufferSizeBytes: 100000;  // ~100KB max buffer

  // Retry
  retryOnFailure: true;
  maxRetries: 3;
  retryDelayMs: 1000;
}
```

### Buffer Implementation Strategy

```
                         ┌─────────────────────┐
                         │    EVENT BUFFER     │
                         ├─────────────────────┤
   Capture Modules ────► │ events: Event[]     │
                         │ byteSize: number    │
                         │ oldestTimestamp: ms │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
      ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
      │ Count Check   │    │ Age Check     │    │ Unload Check  │
      │ events >= 50  │    │ age >= 5000ms │    │ beforeunload  │
      └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       FLUSH         │
                         │  Send to background │
                         │  Clear buffer       │
                         │  Reset timer        │
                         └─────────────────────┘
```

### Flush Strategy

```typescript
// Pseudo-code for flush logic
async function flush(): Promise<void> {
  if (events.length === 0) return;

  const batch = {
    sessionId: currentSessionId,
    events: [...events],
    batchId: generateId(),
    timestamp: Date.now(),
  };

  // Clear buffer immediately (don't wait for send)
  events.length = 0;
  byteSize = 0;

  try {
    await sendToBackground(batch);
  } catch (error) {
    // Re-add events if send failed (up to retry limit)
    if (retryCount < maxRetries) {
      events.unshift(...batch.events);
      scheduleRetry();
    } else {
      // Drop events after max retries (log locally)
      console.warn('[TraceQA] Dropped telemetry batch after max retries');
    }
  }
}
```

---

## Transport Strategy

### Message Format

```typescript
interface TelemetryBatchMessage {
  type: 'CONTENT_TELEMETRY_BATCH';
  payload: {
    sessionId: string;
    batchId: string;
    events: TelemetryEvent[];
    metadata: {
      capturedAt: number;     // When batch was created
      eventCount: number;
      byteSize: number;
      url: string;
      isPartial: boolean;     // True if flush was due to unload
    };
  };
}
```

### Transport Flow

```
Content Script                    Background
      │                               │
      │  CONTENT_TELEMETRY_BATCH      │
      │──────────────────────────────►│
      │                               │
      │      { success: true }        │
      │◄──────────────────────────────│
      │                               │
```

### Failure Handling

| Scenario | Handling |
|----------|----------|
| Background not responding | Queue locally, retry with backoff |
| Session ended | Drop events, clear buffer |
| Page unloading | Sync flush via sendBeacon |
| Extension context invalidated | Drop events, stop capture |

### Page Unload Handling

```typescript
// Use sendBeacon for reliable delivery on unload
window.addEventListener('beforeunload', () => {
  if (events.length > 0) {
    // sendBeacon is fire-and-forget, survives page close
    navigator.sendBeacon(
      chrome.runtime.getURL('/_telemetry'),
      JSON.stringify({
        type: 'CONTENT_TELEMETRY_BATCH',
        payload: { sessionId, events, isPartial: true }
      })
    );
  }
});

// Also try chrome.runtime.sendMessage (may fail on unload)
window.addEventListener('pagehide', () => {
  flush(); // Best-effort
});
```

---

## Lifecycle Management

### Session Activation

```typescript
// Content script receives session start
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SESSION_STARTED') {
    activateCapture({
      sessionId: message.payload.sessionId,
      sessionStartTime: message.payload.startTime,
      config: message.payload.telemetryConfig,
    });
  }

  if (message.type === 'SESSION_ENDED') {
    deactivateCapture();
  }
});
```

### Activation Sequence

```
1. Receive SESSION_STARTED message
2. Store sessionId and startTime
3. Initialize event buffer
4. Start capture modules (based on config)
5. Begin collecting events
```

### Deactivation Sequence

```
1. Receive SESSION_ENDED message
2. Flush remaining events (final batch)
3. Stop all capture modules
4. Remove event listeners
5. Clear buffer and session info
```

---

## Performance Budgets

### CPU Budget

| Operation | Max Time | Strategy |
|-----------|----------|----------|
| Event capture | 1ms | Minimal processing |
| Selector generation | 5ms | Cache selectors |
| Buffer flush | 10ms | Async, off main thread |
| DOM snapshot | 50ms | requestIdleCallback |

### Memory Budget

| Resource | Max Size | Strategy |
|----------|----------|----------|
| Event buffer | 100KB | Flush at threshold |
| Single event | 2KB | Truncate strings |
| Selector cache | 50KB | LRU eviction |

### Event Rate Limits

| Event Type | Max Rate | Enforcement |
|------------|----------|-------------|
| Click | 20/sec | Debounce |
| Input | 10/sec | Debounce |
| Scroll | 4/sec | Throttle |
| Network | 50/sec | Sample |
| Console | 10/sec | Throttle |

---

## File Structure (Target)

```
content/
├── index.ts                      # Entry, lifecycle management
├── lifecycle/
│   ├── init.ts                   # Initialization
│   └── sessionManager.ts         # Session state (minimal)
├── capture/
│   ├── clicks.ts                 # Click capture
│   ├── inputs.ts                 # Input capture
│   ├── scroll.ts                 # Scroll capture
│   ├── navigation.ts             # Navigation capture
│   ├── network.ts                # Network capture
│   ├── console.ts                # Console capture
│   ├── domSnapshots.ts           # DOM snapshot capture
│   ├── errors.ts                 # Error capture
│   └── visibility.ts             # Visibility capture
├── batching/
│   ├── eventBuffer.ts            # Event buffering
│   └── flushStrategy.ts          # Flush logic
├── transport/
│   └── backgroundBridge.ts       # Message sending
├── utils/
│   ├── selectors.ts              # CSS selector generation
│   ├── sanitization.ts           # PII filtering
│   ├── throttle.ts               # Debounce/throttle helpers
│   └── timing.ts                 # Timestamp utilities
└── schema/
    ├── events.ts                 # Event type definitions
    └── validation.ts             # Runtime validation
```

---

## Testing Strategy

### Unit Tests

| Module | Test Focus |
|--------|------------|
| eventBuffer | Flush triggers, size limits, retry |
| clicks | Selector generation, debouncing |
| inputs | Sanitization, sensitive field detection |
| scroll | Throttling, direction detection |
| network | URL filtering, header filtering |
| console | Level filtering, truncation |

### Integration Tests

| Scenario | Approach |
|----------|----------|
| Full capture flow | Inject test page, verify events |
| Batch delivery | Mock background, verify batches |
| Page unload | Verify sendBeacon called |
| Performance | Measure CPU/memory during capture |

### Manual Testing Checklist

- [ ] Events captured during recording
- [ ] Events NOT captured when not recording
- [ ] Passwords are redacted
- [ ] Sensitive headers filtered
- [ ] Scroll events throttled (not flooding)
- [ ] Page remains responsive during capture
- [ ] Events survive page navigation
- [ ] Events flush on tab close

---

## Security Considerations

### PII Protection

| Data Type | Protection |
|-----------|------------|
| Passwords | Always redacted |
| Credit cards | Pattern-matched and redacted |
| Auth headers | Filtered from network events |
| Cookies | Never captured |
| Local storage | Never captured |

### Injection Prevention

- All captured text is treated as data, never executed
- Selectors are generated, never from user input
- No eval() or dynamic script execution

### Data Minimization

- Only capture what's needed for bug reproduction
- Truncate all strings to reasonable limits
- Don't capture images, fonts, or media content

---

## Open Questions

1. Should we capture mouse movement (hover paths)?

2. Should DOM snapshots be opt-in due to performance cost?

3. Should we support custom event capture via API?

4. How should we handle iframes (same-origin vs cross-origin)?
