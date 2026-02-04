# Copilot Instructions for TraceQA

This document provides guidelines for GitHub Copilot when working on the TraceQA repository.

## Project Overview

TraceQA is a lifecycle-wide QA platform that supports quality assurance from specification to production. It captures user intent through browser recordings with video, converts that into actionable QA artifacts (bugs, test cases, test automation code), and supports the entire QA lifecycle.

### Key Concepts
- **WorkItem**: The fundamental unit representing either a Bug or TestCase
- **Session**: A recording that captures video, user interactions, console output, network traffic, and DOM state
- **Bug Report**: A shareable, developer-friendly view of a Bug WorkItem
- **Test Generation**: Automated generation of Playwright/Cypress tests from recorded sessions

## Architecture

This is a Chrome extension with three main components:

```
┌──────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION                      │
├──────────────────────────────────────────────────────────┤
│  POPUP (React)  ←→  BACKGROUND (Service Worker)          │
│                           ↕                               │
│                  OFFSCREEN DOCUMENT                       │
│                  (Media Recording)                        │
├──────────────────────────────────────────────────────────┤
│              CHROME.STORAGE.LOCAL (Shared State)          │
└──────────────────────────────────────────────────────────┘
                           ↓
                    Cloudflare R2 (Video Storage)
```

### Component Responsibilities

**Popup (React UI)**
- Display recording status and duration
- Collect user configuration (video quality, mode)
- Trigger start/stop recording via messages
- Display errors to user
- NEVER: Call `getDisplayMedia()`, hold MediaStreams, upload to R2, create offscreen documents

**Background Service Worker**
- Route messages between components
- Manage offscreen document lifecycle
- Request screen capture permissions
- Persist session state to `chrome.storage.local`
- Upload completed recordings to R2
- Enforce recording limits (30min, 100MB)
- NEVER: Hold video blobs in memory, render UI, assume state persists

**Offscreen Document**
- Run MediaRecorder API
- Accumulate video chunks
- Track recording size and duration
- Store completed blobs in IndexedDB
- NEVER: Show UI, request permissions, upload directly, handle multiple recordings

## Technology Stack

- **Language**: TypeScript
- **UI Framework**: React 18
- **Build Tool**: Webpack 5
- **Styling**: Tailwind CSS
- **Testing**: Vitest + @testing-library/react
- **Package Manager**: npm
- **Browser API**: Chrome Extension Manifest V3
- **Message Passing**: @webext-core/messaging
- **Storage**: IndexedDB (via `idb` library)

## Coding Standards

### TypeScript
- Use strict mode (enabled in tsconfig.json)
- Prefer interfaces over types for object shapes
- Use explicit return types for functions
- No `any` types unless absolutely necessary
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### React
- Use functional components with hooks
- Use custom hooks for shared logic (prefix with `use`)
- Keep components focused on single responsibility
- Prefer composition over prop drilling
- Use React Context for cross-component state (avoid prop drilling)

### File Organization
```
src/
├── popup/           # React UI for extension popup
│   ├── components/  # Reusable UI components
│   └── hooks/       # Custom React hooks
├── background/      # Service worker logic
│   └── fsm/         # Finite state machine for recording
├── offscreen/       # Offscreen document for media recording
├── content/         # Content script (if needed)
├── shared/          # Shared utilities and types
│   ├── types/       # TypeScript type definitions
│   ├── utils/       # Utility functions
│   └── constants/   # Constants
└── components/      # Shared React components
```

### Naming Conventions
- **Files**: camelCase for utilities, PascalCase for components (e.g., `RecordingButton.tsx`, `messageRouter.ts`)
- **Components**: PascalCase (e.g., `RecordingButton`, `StatusIndicator`)
- **Functions**: camelCase (e.g., `startRecording`, `handleMessage`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RECORDING_DURATION`, `VIDEO_QUALITY`)
- **Interfaces/Types**: PascalCase (e.g., `SessionState`, `VideoConfig`)

### Chrome Extension Patterns

**Message Passing**
```typescript
// Use @webext-core/messaging for type-safe messages
import { defineExtensionMessaging } from '@webext-core/messaging';

// Define message types
interface Messages {
  startRecording: { payload: StartRecordingPayload; response: void };
  stopRecording: { payload: void; response: StopRecordingResponse };
}

const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();

// Send message
await sendMessage('startRecording', payload);

// Handle message
onMessage('startRecording', async (payload) => {
  // Handle the message
});
```

**Storage Access**
```typescript
// Always read from storage on component mount
// Don't assume state persists across popup opens
useEffect(() => {
  chrome.storage.local.get(['isRecording', 'sessionId'], (data) => {
    setState(data);
  });
}, []);
```

**State Persistence**
```typescript
// Background must persist state on every transition
async function transitionState(newState: SessionState, data: any) {
  await chrome.storage.local.set({
    sessionState: newState,
    ...data
  });
}
```

## State Management

### Chrome Storage Schema
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

### State Machine (Background)
```
IDLE → REQUESTING_PERMISSION → STARTING → RECORDING → STOPPING → UPLOADING → IDLE
                                                ↓
                                             ERROR
```

## Testing

### Test Structure
- Unit tests for pure functions and utilities
- Component tests for React components using @testing-library/react
- Integration tests for message passing between components
- Mock Chrome APIs using vitest's mocking capabilities

### Test Naming
```typescript
describe('ComponentName', () => {
  it('should do something when condition', () => {
    // test
  });
});
```

### Running Tests
- `npm run test` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## Common Pitfalls & Best Practices

### Chrome Extension Limitations
1. **Service Workers are ephemeral**: Always persist state to storage, never assume variables persist
2. **No DOM in Service Worker**: Cannot use `document`, `window`, or DOM APIs
3. **Blob Transfer**: Cannot send Blobs via `chrome.runtime.sendMessage`, use IndexedDB
4. **Popup can close**: Popup loses state when closed, always read from storage on mount
5. **Offscreen is invisible**: Cannot show UI or interact with user

### Video Recording
1. **Stream Management**: Always clean up MediaStreams with `getTracks().forEach(track => track.stop())`
2. **Chunk Size**: Use 1-second timeslice for MediaRecorder to track size incrementally
3. **Size Limits**: Warn at 80MB, stop at 100MB
4. **Duration Limits**: Warn at 25min, stop at 30min
5. **Codec**: Prefer VP9 in WebM container for best compatibility

### Error Handling
1. **User-Friendly Messages**: Convert technical errors to user-friendly messages
2. **Recovery Actions**: Always provide a way to recover (retry button, manual save)
3. **State Cleanup**: On error, always clean up state (streams, storage, IndexedDB)
4. **Error Persistence**: Store errors in storage so they persist across popup closes

### Performance
1. **Lazy Load**: Don't load unnecessary code in popup (keep bundle small)
2. **Debounce**: Debounce user input that triggers expensive operations
3. **Chunk Processing**: Process video chunks incrementally, don't wait for full blob
4. **IndexedDB**: Use IndexedDB for large data, not chrome.storage

## Documentation References

Key documentation files in the repository:
- `PRODUCT.md` - Product vision and concepts
- `FEATURES.md` - Complete feature specifications
- `docs/COMPONENT-RESPONSIBILITIES.md` - Component architecture details
- `docs/MESSAGE-CONTRACTS.md` - Message passing contracts
- `docs/ADR-001-media-pipeline.md` - Architecture decision record for media pipeline

## Development Workflow

1. **Type Checking**: Run `npm run typecheck` before committing
2. **Building**: `npm run build` for production, `npm run dev` for development with watch mode
3. **Testing**: Write tests alongside new features, maintain test coverage
4. **Code Style**: Follow existing patterns in the codebase

## When Working on New Features

1. Read relevant documentation in `docs/` and product specs in `PRODUCT.md` and `FEATURES.md`
2. Understand which component owns the responsibility
3. Follow the message passing contracts in `docs/MESSAGE-CONTRACTS.md`
4. Update tests alongside code changes
5. Consider error scenarios and recovery paths
6. Update documentation if adding new patterns or changing architecture

## Security Considerations

1. **Permissions**: Request only necessary permissions in manifest.json
2. **Data Privacy**: Implement blur regions for sensitive data
3. **Storage**: Never store sensitive data in chrome.storage.local (not encrypted)
4. **Network**: Use HTTPS for all external communications
5. **User Data**: Get explicit consent before recording

## AI-Specific Guidance

When generating code for this project:
1. Always check component responsibilities before adding code
2. Use the existing message passing patterns (@webext-core/messaging)
3. Follow the established file organization
4. Consider Chrome extension limitations (especially for Service Workers)
5. Add appropriate error handling and user feedback
6. Write tests for new functionality
7. Use TypeScript strictly (no implicit any)
8. Follow React best practices (hooks, functional components)
