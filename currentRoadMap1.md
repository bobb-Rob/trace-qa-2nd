# TraceQA Implementation Roadmap — Reality-Based Assessment

**Status**: ACTIVE  
**Date**: 2026-02-03  
**Phase**: Stabilization & Testing  

---

## 📋 Executive Summary

This document provides a **reality-based assessment** of the TraceQA Chrome Extension project, comparing the original plan.md against actual implementation, and establishing a testing-driven path forward.

### Key Deviations from Original Plan

| Original Plan | Current Reality |
|---------------|-----------------|
| WXT build system | **Webpack + vanilla Chrome APIs** |
| Vite for bundling | **Webpack 5** |
| @webext-core/messaging | **Installed but NOT used** — raw `chrome.runtime.sendMessage` |
| Phase-based delivery (5 phases) | **Phase 0 substantially complete, Phase 1-5 not started** |
| ContentCaptureAgent (imperative agent) | **Not implemented** — only FloatingPane controller exists |
| Supabase integration | **Not implemented** |
| R2 upload pipeline | **Not implemented** — local download only |

### What We Actually Built

A **working video recording pipeline** with:
- ✅ Finite State Machine (FSM) for session management
- ✅ Offscreen document with MediaRecorder
- ✅ Pause/Resume functionality
- ✅ External stop detection ("Stop sharing" button)
- ✅ IndexedDB blob storage
- ✅ Local file download (testing mode)
- ✅ FloatingPane UI for TAB recording mode
- ✅ Content script injection with handshake protocol
- ✅ Watchdog timer for state recovery

---

## 🏗️ Current Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              CHROME EXTENSION (MV3)                               │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐   ┌─────────────────────┐   ┌─────────────────────────┐    │
│  │     POPUP       │   │     BACKGROUND      │   │   OFFSCREEN DOCUMENT    │    │
│  │  (React 18)     │   │  (Service Worker)   │   │   (Media Engine)        │    │
│  ├─────────────────┤   ├─────────────────────┤   ├─────────────────────────┤    │
│  │ • Popup.tsx     │   │ • FSM Module        │   │ • MediaRecorder         │    │
│  │ • useRecording  │   │   ├─ executor.ts    │   │ • Chunk accumulation    │    │
│  │   State.ts      │   │   ├─ reducer.ts     │   │ • Blob finalization     │    │
│  │ • VideoSettings │   │   ├─ transitions.ts │   │ • IndexedDB storage     │    │
│  │ • RecordingInfo │   │   ├─ watchdog.ts    │   │ • Pause/Resume          │    │
│  └────────┬────────┘   │   └─ types.ts       │   └────────────┬────────────┘    │
│           │            │ • Message routing   │                 │                │
│           │            │ • State broadcast   │                 │                │
│           │            └──────────┬──────────┘                 │                │
│           │                       │                            │                │
│           └───────────────────────┴────────────────────────────┘                │
│                                   │                                              │
│  ┌────────────────────────────────┼────────────────────────────────────────┐    │
│  │                    CONTENT SCRIPT (TAB mode only)                        │    │
│  │  ┌─────────────────────────────┴─────────────────────────────────────┐  │    │
│  │  │ FloatingPane Controller                                            │  │    │
│  │  │ • createFloatingPaneRenderer.ts (imperative DOM injection)         │  │    │
│  │  │ • FloatingPaneView.tsx (React island in Shadow DOM)                │  │    │
│  │  │ • Handshake injection (PING/PONG protocol)                         │  │    │
│  │  └───────────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                     CHROME.STORAGE.LOCAL (Persistence)                   │    │
│  │  • sessionState (FSM state)                                              │    │
│  │  • sessionId, startTime, isRecording                                     │    │
│  │  • fsmLastTransition (for recovery)                                      │    │
│  │  • fsmPauseStartTime, fsmTotalPausedTime                                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Implementation Status

### Phase 0: Media Stability — **85% Complete**

| Component | Status | Details |
|-----------|--------|---------|
| Offscreen document creation | ✅ Complete | `chrome.offscreen.createDocument()` with USER_MEDIA reason |
| MediaRecorder pipeline | ✅ Complete | VP9 codec, configurable bitrate, 1s chunking |
| Blob accumulation | ✅ Complete | Size tracking, 80% warning, auto-stop at 100MB |
| IndexedDB storage | ✅ Complete | Using native IndexedDB (not `idb` library wrapper) |
| Local download | ✅ Complete | Anchor-based download from offscreen (workaround for no `chrome.downloads` in offscreen) |
| Pause/Resume | ✅ Complete | MediaRecorder.pause()/resume() with timing tracking |
| External stop detection | ✅ Complete | `track.onended` handler with separate message type |
| State persistence | ✅ Complete | FSM state persisted to chrome.storage.local |
| Watchdog timer | ✅ Complete | Auto-recovery for stuck states |
| **R2 upload** | ❌ Not Started | Currently downloads locally only |
| **Error recovery UI** | ⚠️ Partial | Errors shown but no retry mechanism |

### Phase 1: Imperative Agents — **0% Complete**

| Component | Status | Details |
|-----------|--------|---------|
| ContentCaptureAgent | ❌ Not Started | DOM event capture for bug reporting |
| SPA navigation tracking | ❌ Not Started | — |
| User interaction logging | ❌ Not Started | — |
| Network capture | ❌ Not Started | — |

### Phase 2-5: Not Started

- Background orchestration enhancements
- @webext-core/messaging integration
- React UI refinements
- Supabase authentication and persistence

---

## 📁 File Structure Analysis

### Actual Structure (Implemented)

```
apps/extension-trace-qa/
├── public/
│   ├── manifest.json          ✅ MV3 with offscreen, scripting, downloads
│   └── icons/
├── src/
│   ├── background/
│   │   ├── index.ts           ✅ 954 lines - message routing, orchestration
│   │   └── fsm/               ✅ Finite State Machine module
│   │       ├── index.ts       ✅ Public exports
│   │       ├── executor.ts    ✅ Side effects, persistence
│   │       ├── reducer.ts     ✅ Pure state reducer
│   │       ├── transitions.ts ✅ Transition table
│   │       ├── watchdog.ts    ✅ Timer-based recovery
│   │       ├── types.ts       ✅ TypeScript interfaces
│   │       └── __tests__/     ✅ Unit tests (3 files)
│   ├── content/
│   │   └── index.ts           ✅ FloatingPane controller only
│   ├── components/
│   │   ├── createFloatingPaneRenderer.ts  ✅ Imperative DOM injection
│   │   └── FloatingPaneView.tsx           ✅ React island
│   ├── offscreen/
│   │   ├── index.html         ✅ Minimal HTML shell
│   │   └── index.ts           ✅ 490 lines - MediaRecorder, IndexedDB
│   ├── popup/
│   │   ├── index.tsx          ✅ Entry point
│   │   ├── Popup.tsx          ✅ Main component
│   │   ├── components/        ✅ UI components
│   │   ├── hooks/             ✅ useRecordingState
│   │   └── styles/            ✅ Tailwind CSS
│   ├── shared/
│   │   └── types/
│   │       └── index.ts       ✅ 260 lines - all message types
│   └── FloatingPane.ts        ⚠️ Appears unused (legacy?)
├── package.json               ✅ Webpack, Vitest, React 18
├── webpack.config.js          ✅ Multi-entry build
├── tailwind.config.js         ✅ Configured
└── tsconfig.json              ✅ Strict mode
```

### Missing from Original Plan

```
src/
├─ content/
│  ├─ agent/                   ❌ NOT IMPLEMENTED
│  │  ├─ ContentCaptureAgent.ts
│  │  └─ lifecycle.ts
│  └─ ui/                      ⚠️ PARTIAL (only FloatingPane)
│     ├─ PreviewOverlay/
│     └─ RecordingOverlay/
├─ shared/
│  └─ messaging/               ❌ NOT IMPLEMENTED (@webext-core/messaging)
└─ supabase/                   ❌ NOT IMPLEMENTED
   ├─ client.ts
   └─ auth.ts
```

---

## 🔧 Technical Debt

### Critical

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| `@webext-core/messaging` installed but unused | Inconsistency, wasted dependency | Either integrate or remove |
| `idb` library installed but unused | Native IndexedDB used instead | Remove dependency |
| No unit tests for offscreen document | Core pipeline untested | Priority 1 testing |
| No unit tests for popup components | UI regressions undetected | Priority 2 testing |
| 954-line background/index.ts | Hard to maintain | Extract into modules |

### Moderate

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| FloatingPane.ts in src root | Unclear purpose, possible dead code | Verify and delete if unused |
| No E2E tests | Cannot verify full flow | Add Playwright or similar |
| Hardcoded download (no R2) | Cannot deploy to production | Implement R2 upload |
| No retry mechanism for failures | Poor UX on transient errors | Add retry with exponential backoff |

### Low

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| No audio capture | Feature gap | Planned for later phase |
| Keyboard shortcut not functional | Minor UX gap | Implement toggle logic |

---

## 🧪 Testing Assessment

### Current Test Coverage (Updated 2026-02-03)

| Module | Test Files | Tests | Coverage | Status |
|--------|------------|-------|----------|--------|
| FSM (transitions.ts) | 1 | 80 | **100%** | ✅ Excellent |
| FSM (reducer.ts) | 1 | 49 | **100%** | ✅ Excellent |
| FSM (recovery.test.ts) | 1 | 39 | ~90% | ✅ Excellent |
| FSM (executor.ts) | 1 | 41 | **100%** | ✅ **NEW** |
| FSM (watchdog.ts) | 1 | 23 | **97.77%** | ✅ **NEW** |
| Offscreen (mediaRecorder.test.ts) | 1 | 22 | N/A (mock-based) | ✅ **NEW** |
| Background (messageRouting.test.ts) | 1 | 24 | N/A (mock-based) | ✅ **NEW** |
| Popup components | 0 | 0 | 0% | ❌ Not tested |
| Content script | 0 | 0 | 0% | ❌ Not tested |
| Shared types | N/A | N/A | N/A | Type-only |

### Test Summary

```
 Test Files  7 passed (7)
      Tests  278 passed (278)
   Duration  3.25s
```

### FSM Module Coverage: **~95%**

| File | % Statements | % Branches | % Functions | % Lines |
|------|-------------|-----------|-------------|---------|
| executor.ts | 100% | 100% | 100% | 100% |
| reducer.ts | 100% | 100% | 100% | 100% |
| transitions.ts | 100% | 100% | 100% | 100% |
| watchdog.ts | 97.77% | 92.85% | 100% | 97.77% |

### Remaining Coverage Gaps

| Gap | Risk Level | Consequence of Failure |
|-----|------------|------------------------|
| Popup useRecordingState | 🟡 HIGH | UI shows wrong state |
| FloatingPane controller | 🟡 MEDIUM | TAB mode broken |
| React components | 🟢 LOW | Visual regressions |

---

## ✅ Path to 95% Test Coverage (Progress Update)

### Priority 1: Core Pipeline ✅ **COMPLETE** (Target: 60% overall → **Achieved: ~95% FSM**)

**Completed**: 2026-02-03  
**Effort**: ~2 hours (automated test generation)

#### 1.1 Offscreen Document Tests ✅ Created

**File**: `src/offscreen/__tests__/mediaRecorder.test.ts` (22 tests)

- MockMediaRecorder implementation
- Constructor and static methods
- Start/stop lifecycle
- Pause/resume functionality
- IndexedDB chunk storage
- Blob assembly
- Recording flow integration

#### 1.2 Background Service Worker Tests ✅ Created

**File**: `src/background/__tests__/messageRouting.test.ts` (24 tests)

- Message routing (GET_STATUS, START/STOP_RECORDING, PAUSE/RESUME)
- Offscreen document lifecycle
- Content script injection (PING/PONG)
- Session recovery

#### 1.3 FSM Executor/Watchdog Tests ✅ Created

**File**: `src/background/fsm/__tests__/executor.test.ts` (41 tests)

- transition() - state transitions, validation, persistence
- restoreFromStorage() - service worker wake recovery
- updateContext() - session context updates
- forceState() - emergency recovery
- Complete recording flows (success, error, pause/resume)

**File**: `src/background/fsm/__tests__/watchdog.test.ts` (23 tests)

- Watchdog timer per state
- validateStateOnWake() - orphan detection
- isMessageFresh() - stale message filtering
- initWatchdog() - integration

### Priority 2: UI Layer (Target: 80% overall) — **NOT STARTED**

**Estimated Effort**: 2-3 days

#### 2.1 Popup Hook Tests

```typescript
// Required test file: src/popup/hooks/__tests__/useRecordingState.test.ts

describe('useRecordingState', () => {
  it('should initialize with loading state');
  it('should load state from storage');
  it('should handle UI_STATE_UPDATE broadcasts');
  it('should handle UI_SESSION_ENDED broadcasts');
  it('should poll for recording state after start');
  it('should cleanup listeners on unmount');
});

describe('startRecording()', () => {
  it('should generate session ID');
  it('should get current tab ID');
  it('should send START_RECORDING message');
  it('should wait for RECORDING state');
  it('should handle user cancellation');
});

describe('stopRecording()', () => {
  it('should send STOP_RECORDING message');
  it('should reset state on success');
});
```

#### 2.2 React Component Tests

```typescript
// Required test files: src/popup/components/__tests__/*.test.tsx

describe('RecordingButton', () => {
  it('should show "Start Recording" when not recording');
  it('should show "Stop Recording" when recording');
  it('should be disabled when loading');
  it('should call onStart/onStop handlers');
});

describe('StatusIndicator', () => {
  it('should show idle state');
  it('should show recording state with animation');
  it('should show paused state');
});

describe('VideoSettings', () => {
  it('should render quality selector');
  it('should render capture mode selector');
  it('should call onConfigChange');
  it('should be disabled when specified');
});
```

### Priority 3: Integration & Edge Cases (Target: 95% overall)

**Estimated Effort**: 2-3 days

#### 3.1 Content Script Tests

```typescript
// Required test file: src/content/__tests__/floatingPane.test.ts

describe('FloatingPane lifecycle', () => {
  it('should create renderer on first show');
  it('should update state on CONTENT_UPDATE_FLOATING_PANE');
  it('should hide and cleanup on CONTENT_HIDE_FLOATING_PANE');
  it('should forward actions to background');
  it('should respond to PING with PONG');
});
```

#### 3.2 Edge Case Tests

```typescript
// Required test file: src/__tests__/edgeCases.test.ts

describe('Error scenarios', () => {
  it('should handle permission denied');
  it('should handle offscreen creation failure');
  it('should handle MediaRecorder error');
  it('should handle IndexedDB quota exceeded');
  it('should recover from orphaned state');
});

describe('Race conditions', () => {
  it('should handle rapid start/stop');
  it('should handle tab close during recording');
  it('should handle service worker termination');
  it('should handle duplicate messages');
});
```

---

## 📅 Testing Implementation Schedule

### Week 1: Core Pipeline

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | Offscreen tests | mediaRecorder.test.ts, indexedDB.test.ts |
| 3-4 | Background tests | messageRouting.test.ts |
| 5 | FSM completion | executor.test.ts, watchdog.test.ts |

### Week 2: UI & Integration

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | Popup tests | useRecordingState.test.ts, component tests |
| 3 | Content script | floatingPane.test.ts |
| 4-5 | Edge cases | edgeCases.test.ts, race conditions |

### Week 3: Stabilization

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | Coverage gaps | Fill remaining gaps to 95% |
| 3 | Documentation | Update test documentation |
| 4-5 | CI/CD | GitHub Actions test workflow |

---

## 🎯 Test Infrastructure Requirements

### Dependencies to Add

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@vitest/coverage-v8": "^1.1.0",
    "jsdom": "^23.0.0",
    "fake-indexeddb": "^5.0.0"
  }
}
```

### Vitest Configuration Update

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
});
```

### Chrome API Mocks

```typescript
// src/__tests__/setup.ts
import 'fake-indexeddb/auto';

// Mock chrome APIs
globalThis.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
    getContexts: vi.fn(),
    lastError: null,
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    query: vi.fn(),
  },
  offscreen: {
    createDocument: vi.fn(),
    closeDocument: vi.fn(),
    Reason: { USER_MEDIA: 'USER_MEDIA' },
  },
  scripting: {
    executeScript: vi.fn(),
  },
  downloads: {
    download: vi.fn(),
  },
} as unknown as typeof chrome;
```

---

## 📈 Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Line coverage | ~15% | 95% | 3 weeks |
| Branch coverage | ~10% | 90% | 3 weeks |
| Critical path tests | 0 | 100% | Week 1 |
| Test execution time | N/A | < 30s | Week 3 |
| Flaky test rate | N/A | < 1% | Week 3 |

---

## 🚫 What We Are NOT Doing (Until Testing Complete)

1. **No new features** — Focus on stabilization only
2. **No R2 integration** — Local download is sufficient for testing
3. **No Supabase** — Authentication deferred
4. **No ContentCaptureAgent** — Phase 1 work blocked on Phase 0 stability
5. **No @webext-core/messaging migration** — Current messaging works

---

## 📝 Next Steps (Immediate)

1. [ ] Add testing dependencies to package.json
2. [ ] Create vitest.config.ts with coverage thresholds
3. [ ] Create src/__tests__/setup.ts with Chrome mocks
4. [ ] Write first offscreen test (mediaRecorder.test.ts)
5. [ ] Run coverage report to establish baseline

---

## 📚 References

- [Original plan.md](./plan.md) — Original architecture vision
- [ADR-001-media-pipeline.md](./docs/ADR-001-media-pipeline.md) — Media pipeline decisions
- [COMPONENT-RESPONSIBILITIES.md](./docs/COMPONENT-RESPONSIBILITIES.md) — Component contracts
- [MESSAGE-CONTRACTS.md](./docs/MESSAGE-CONTRACTS.md) — Message specifications
