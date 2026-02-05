# TraceQA - Smart Bug Capture Extension

## Product Overview

### What This Solution Does

TraceQA is a Chrome extension that enables video-based bug capture for QA engineers, developers, and testers. The extension records screen activity (tab or desktop), captures the recording as a video file, and provides an in-page floating control pane during recording sessions.

### The Problem It Solves

Traditional bug reporting requires manual screenshots, written reproduction steps, and environment descriptions. TraceQA automates this by capturing full video sessions that can be shared with developers, providing complete context for bug reproduction without lengthy written explanations.

### Primary User Personas

| Persona | Use Case |
|---------|----------|
| **QA Engineer** | Capture bugs with full video evidence during exploratory testing |
| **Developer** | Record reproduction steps when debugging issues |
| **Product Tester** | Document UI/UX issues with visual context |

### High-Level Goals

- Reliable video recording of browser tabs and desktop
- Minimal UI friction to start/stop recordings
- Download recordings as shareable video files
- Pause/resume capability for controlled capture sessions

### Non-Goals (Current Phase)

- Cloud upload and sharing (deferred to future phase)
- Video editing/trimming
- Blur regions for privacy
- Test code generation
- Integration with issue trackers (Jira, Linear)

---

## Feature Overview

### Implemented Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Video Recording** | Complete | Record tab, window, or full desktop via MediaRecorder API |
| **Quality Settings** | Complete | SD (480p, 1 Mbps) or HD (720p, 2.5 Mbps) options |
| **Start/Stop Controls** | Complete | Popup UI and floating pane controls |
| **Pause/Resume** | Complete | Pause recording, then resume without creating new session |
| **Floating Control Pane** | Complete | Draggable overlay during TAB recording with timer and controls |
| **Recording Timer** | Complete | Real-time duration display (excludes paused time) |
| **Download on Stop** | Complete | Automatic .webm file download when recording ends |
| **State Persistence** | Complete | Recording state survives popup close and service worker restarts |
| **External Stop Handling** | Complete | Graceful handling when user clicks "Stop sharing" in browser UI |
| **Size Limits** | Complete | 100MB max, warning at 80%, auto-stop at limit |

### Feature Boundaries (What the System Does NOT Do)

- Does not upload to cloud storage (R2/S3)
- Does not generate shareable links
- Does not capture microphone audio (UI present but not functional)
- Does not support video trimming or editing
- Does not capture console logs, network traffic, or DOM snapshots
- Does not integrate with external systems (Jira, Linear, GitHub)
- Does not generate test code (Playwright/Cypress)

### Known Constraints and Assumptions

1. **Chrome Only** - Uses Chrome-specific MV3 offscreen document API
2. **Max 30 minutes** - Recording duration limit (enforced in code constants)
3. **Max 100MB** - File size limit for single-part downloads
4. **Tab recording only shows floating pane** - Desktop/window modes do not inject content script
5. **No audio capture** - Microphone toggle is present but functionality is not implemented

---

## Architecture Overview

### High-Level Architecture

```
+------------------+     +----------------------+     +---------------------+
|     Popup        |     |   Background         |     |    Offscreen        |
|   (React UI)     |<--->|  Service Worker      |<--->|    Document         |
|                  |     |   (Orchestrator)     |     |  (MediaRecorder)    |
+------------------+     +----------------------+     +---------------------+
                                  ^
                                  |
                                  v
                         +------------------+
                         |  Content Script  |
                         | (Floating Pane)  |
                         +------------------+
                                  |
                                  v
                         +------------------+
                         | chrome.storage   |
                         |     .local       |
                         +------------------+
```

### Component Responsibilities

| Component | Location | Responsibilities |
|-----------|----------|------------------|
| **Popup** | `src/popup/` | User interface, configuration, start/stop triggers |
| **Background** | `src/background/` | FSM orchestration, message routing, state persistence, offscreen lifecycle |
| **Offscreen** | `src/offscreen/` | MediaRecorder, blob accumulation, getDisplayMedia, IndexedDB storage |
| **Content Script** | `src/content/` | FloatingPane injection and control in TAB recording mode |
| **Shared Types** | `src/shared/types/` | TypeScript interfaces for messages and state |

### Finite State Machine (FSM)

The background service worker uses a deterministic FSM for session management:

```
IDLE
  |-- START_REQUESTED --> REQUESTING_PERMISSION
                              |-- PERMISSION_GRANTED --> STARTING
                              |-- PERMISSION_DENIED --> IDLE
                                                            |
STARTING                                                    |
  |-- CAPTURE_STARTED --> RECORDING                         |
  |-- CAPTURE_FAILED --> IDLE <-----------------------------|
                              ^
RECORDING                     |
  |-- PAUSE_REQUESTED --> PAUSED                            |
  |-- STOP_REQUESTED --> STOPPING                           |
  |-- STREAM_ENDED --> UPLOADING                            |
  |-- CAPTURE_FAILED --> IDLE                               |
                                                            |
PAUSED                                                      |
  |-- RESUME_REQUESTED --> RECORDING                        |
  |-- STOP_REQUESTED --> STOPPING                           |
  |-- STREAM_ENDED --> UPLOADING                            |
                                                            |
STOPPING                                                    |
  |-- CAPTURE_STOPPED --> UPLOADING                         |
  |-- CAPTURE_FAILED --> IDLE                               |
                                                            |
UPLOADING                                                   |
  |-- UPLOAD_COMPLETE --> IDLE                              |
  |-- UPLOAD_FAILED --> IDLE                                |
```

### Key Data Flows

**Start Recording:**
1. User clicks "Start Recording" in popup
2. Popup sends `START_RECORDING` message to background
3. Background creates offscreen document
4. Background sends `OFFSCREEN_START_CAPTURE` to offscreen
5. Offscreen calls `getDisplayMedia()` (triggers Chrome picker)
6. User selects screen/tab to share
7. Offscreen starts MediaRecorder, sends `OFFSCREEN_CAPTURE_STARTED`
8. Background transitions to RECORDING, shows FloatingPane (TAB mode)
9. Background broadcasts state updates every 500ms

**Stop Recording:**
1. User clicks "Stop" in popup or floating pane
2. Background sends `OFFSCREEN_STOP_CAPTURE` to offscreen
3. Offscreen stops MediaRecorder, stores blob in IndexedDB
4. Offscreen sends `OFFSCREEN_CAPTURE_COMPLETE` with blob reference
5. Background sends `OFFSCREEN_DOWNLOAD_BLOB` to trigger download
6. Offscreen creates download via anchor element
7. Background transitions to IDLE, hides FloatingPane

---

## Current State

### Fully Implemented

- [x] Popup UI with Start/Stop recording
- [x] Video settings (quality, capture mode)
- [x] Background service worker with FSM
- [x] Offscreen document with MediaRecorder
- [x] Pause/Resume functionality
- [x] Floating control pane (TAB mode)
- [x] Duration tracking (excludes paused time)
- [x] State persistence across popup close
- [x] External stop handling ("Stop sharing" button)
- [x] Size limit enforcement with warnings
- [x] Download recording as .webm file
- [x] Content script injection with handshake
- [x] Unit tests for FSM, hooks, and offscreen

### Partially Implemented

- [ ] Microphone audio capture (UI exists, backend not connected)
- [ ] Mute toggle (sends message but no actual functionality)
- [ ] Keyboard shortcuts (listener exists but no action)

### Out of Scope / Deferred

- Cloud upload (R2/S3)
- Shareable links
- Video trimming/editing
- Blur regions
- Session flags (issue, success, important markers)
- Console/network capture
- WorkItem model (bugs, test cases)
- Test code generation
- Dashboard integration
- Backend API integration
- Collaboration features
- Recording requests

---

## How to Run / Use

### Prerequisites

- Node.js 18+
- npm or yarn
- Chrome browser (for testing the extension)

### Setup and Build

```bash
# Navigate to extension directory
cd apps/extension-trace-qa

# Install dependencies
npm install

# Build for development (with watch)
npm run dev

# Build for production
npm run build
```

### Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `apps/extension-trace-qa/dist` folder
5. The TraceQA extension should appear in your toolbar

### Basic Usage

1. Click the TraceQA extension icon to open the popup
2. Configure video settings (quality, capture mode)
3. Click "Start Recording"
4. Select the tab/window/screen to record in Chrome's picker
5. Perform the actions you want to capture
6. Click "Stop Recording" (in popup or floating pane)
7. The recording will automatically download as a .webm file

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking only
npm run typecheck
```

### Entry Points

| Entry Point | Location | Purpose |
|-------------|----------|---------|
| Popup | `src/popup/index.tsx` | Extension popup UI |
| Background | `src/background/index.ts` | Service worker |
| Offscreen | `src/offscreen/index.ts` | Media recording engine |
| Content Script | `src/content/index.ts` | In-page floating pane |

---

## Known Limitations & Risks

### Technical Limitations

| Limitation | Impact | Notes |
|------------|--------|-------|
| Chrome-only | Cannot run on Firefox/Safari | Uses MV3 offscreen API |
| No audio capture | Silent recordings | Microphone UI exists but is non-functional |
| Local download only | No cloud sharing | Upload to R2 deferred |
| Single session | Cannot record multiple tabs | One active session at a time |
| Max 100MB | Long recordings may hit limit | Auto-stop at limit |

### Areas Requiring Extra Testing Attention

1. **Service Worker Recovery** - Background can terminate; FSM must self-heal
2. **External Stop Handling** - User clicking "Stop sharing" must save recording
3. **Pause/Resume Timing** - Duration calculation must exclude paused periods
4. **Content Script Injection** - Must handle tab navigation and reload
5. **State Persistence** - Recording state must survive popup close
6. **Size Limit Enforcement** - 80% warning and 100% auto-stop
7. **Offscreen Document Lifecycle** - Creation and cleanup

### Known Fragile or Complex Parts

| Component | Complexity | Risk |
|-----------|------------|------|
| FSM Transitions | High | Invalid transitions could leave system in stuck state |
| Blob Transfer | Medium | IndexedDB coordination between offscreen and background |
| Content Script Injection | Medium | Must handle timing and navigation edge cases |
| Duration Calculation | Medium | Pause timing accumulation must be accurate |
| Watchdog/Self-Healing | High | Recovery logic is complex and hard to test fully |

---

## Project Structure

```
apps/extension-trace-qa/
├── public/
│   ├── manifest.json       # Chrome extension manifest (MV3)
│   └── icons/              # Extension icons
├── src/
│   ├── background/
│   │   ├── index.ts        # Service worker entry point
│   │   └── fsm/            # Finite state machine
│   │       ├── index.ts    # FSM exports
│   │       ├── types.ts    # State and event types
│   │       ├── transitions.ts  # Transition table
│   │       ├── reducer.ts  # Pure state reducer
│   │       ├── executor.ts # Side-effect executor
│   │       └── watchdog.ts # Self-healing logic
│   ├── content/
│   │   └── index.ts        # Content script for FloatingPane
│   ├── components/
│   │   ├── FloatingPaneView.tsx    # Draggable recording control
│   │   └── createFloatingPaneRenderer.ts  # Shadow DOM renderer
│   ├── offscreen/
│   │   ├── index.html      # Offscreen document shell
│   │   └── index.ts        # MediaRecorder logic
│   ├── popup/
│   │   ├── index.tsx       # Popup entry point
│   │   ├── Popup.tsx       # Main popup component
│   │   ├── components/     # Popup UI components
│   │   │   ├── RecordingButton.tsx
│   │   │   ├── StatusIndicator.tsx
│   │   │   ├── RecordingInfo.tsx
│   │   │   ├── VideoSettings.tsx
│   │   │   └── ErrorMessage.tsx
│   │   └── hooks/
│   │       └── useRecordingState.ts  # Recording state hook
│   └── shared/
│       ├── types/
│       │   └── index.ts    # Shared TypeScript types
│       └── utils/
│           └── cn.ts       # Classname utility
├── package.json
├── tsconfig.json
├── webpack.config.js
└── vitest.config.ts
```

---

## Related Documentation

- [PRODUCT.md](PRODUCT.md) - Full product vision and lifecycle model
- [FEATURES.md](FEATURES.md) - Complete feature specifications
- [docs/COMPONENT-RESPONSIBILITIES.md](docs/COMPONENT-RESPONSIBILITIES.md) - Component contracts
- [docs/MESSAGE-CONTRACTS.md](docs/MESSAGE-CONTRACTS.md) - Message protocols
- [docs/ADR-001-media-pipeline.md](docs/ADR-001-media-pipeline.md) - Architecture decision record
