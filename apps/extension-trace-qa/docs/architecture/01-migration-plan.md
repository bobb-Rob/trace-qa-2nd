# TraceQA Architecture Migration Plan

**Document Version:** 1.0
**Date:** 2026-02-05
**Status:** Draft - Pending Approval

---

## Executive Summary

This document outlines the phased migration from TraceQA's current monolithic architecture to a deterministic, three-plane capture engine. The migration is designed to be incremental, with each phase independently deployable and testable, ensuring no disruption to existing recording functionality.

---

## Current State vs Target State

```
Current State                          Target State
-------------------------------------------------------------
background/index.ts (800+ lines)  →    background/controllers/* + routing/*
offscreen/index.ts (monolithic)   →    offscreen/media/* + data/*
content/index.ts (minimal)        →    content/capture/* + batching/*
No audio capture                  →    Full audio pipeline with mixing
No telemetry capture              →    Click, console, network, DOM events
```

---

## Guiding Principles

1. **Background never touches media APIs**
2. **Offscreen never knows about UI or FSM**
3. **Content scripts never manage state**
4. **Audio is treated as a first-class media stream**
5. **Everything communicates via explicit messages**
6. **FSM is authoritative for lifecycle**

---

## Phase 0: Message Contracts Foundation

### Goal
Establish a single source of truth for all inter-plane communication contracts.

### Scope
- Define all message types in one centralized location
- Add runtime validation helpers
- No behavior changes—purely additive

### Files Touched

| Action | File |
|--------|------|
| CREATE | `shared/contracts/messages.ts` |
| CREATE | `shared/contracts/backgroundMessages.ts` |
| CREATE | `shared/contracts/offscreenMessages.ts` |
| CREATE | `shared/contracts/contentMessages.ts` |
| CREATE | `shared/contracts/validators.ts` |
| UPDATE | `shared/types/index.ts` (re-export contracts) |

### What Remains Unchanged
- All existing message handlers
- All existing behavior
- Runtime execution paths

### Rollback Strategy
Delete new files. No other changes required.

### Validation Criteria
- [ ] TypeScript compiles
- [ ] All existing tests pass
- [ ] New contracts match existing message shapes exactly

---

## Phase 1: Background Routing Extraction

### Goal
Extract message routing from `background/index.ts` into a dedicated router that handlers can register with.

### Scope
- Create `messageRouter.ts` with registration pattern
- Migrate `chrome.runtime.onMessage` handling
- Keep all handler logic in place (just move the dispatch)

### Files Touched

| Action | File |
|--------|------|
| CREATE | `background/routing/messageRouter.ts` |
| CREATE | `background/routing/index.ts` |
| UPDATE | `background/index.ts` (use router, remove direct listener) |

### What Remains Unchanged
- All handler implementations (stay in index.ts for now)
- FSM logic
- Offscreen communication
- UI broadcasts

### Rollback Strategy
Revert `background/index.ts` to use direct `chrome.runtime.onMessage`.

### Validation Criteria
- [ ] All message types still handled
- [ ] Recording start/stop/pause/resume works
- [ ] FloatingPane actions work
- [ ] All background tests pass

---

## Phase 2: Session Controller Extraction

### Goal
Extract session lifecycle logic (start/stop/pause/resume) into a dedicated controller.

### Scope
- Create `sessionController.ts` owning session semantics
- Move validation, FSM transitions, coordination logic
- Background index.ts becomes thin orchestration

### Files Touched

| Action | File |
|--------|------|
| CREATE | `background/controllers/sessionController.ts` |
| CREATE | `background/controllers/index.ts` |
| UPDATE | `background/index.ts` (delegate to sessionController) |
| UPDATE | `background/routing/messageRouter.ts` (register session handlers) |

### What Remains Unchanged
- FSM implementation (`background/fsm/*`)
- Offscreen document management
- UI broadcast logic
- Persistence logic

### Rollback Strategy
Inline sessionController logic back into index.ts handlers.

### Validation Criteria
- [ ] Full recording cycle works (start → pause → resume → stop)
- [ ] Session ID validation works
- [ ] FSM transitions are correct
- [ ] Error states handled properly

---

## Phase 3: Offscreen Controller Extraction

### Goal
Abstract offscreen document lifecycle and command sending behind a clean interface.

### Scope
- Create `offscreenController.ts` owning document lifecycle
- Background never sends raw `OFFSCREEN_*` messages directly
- Offscreen controller provides semantic methods: `startCapture()`, `stopCapture()`, etc.

### Files Touched

| Action | File |
|--------|------|
| CREATE | `background/controllers/offscreenController.ts` |
| UPDATE | `background/controllers/sessionController.ts` (use offscreenController) |
| UPDATE | `background/index.ts` (remove direct offscreen calls) |

### What Remains Unchanged
- Offscreen document implementation
- Actual media capture logic
- Message types (offscreenController just wraps them)

### Rollback Strategy
Revert sessionController to send messages directly.

### Validation Criteria
- [ ] Offscreen document created/closed correctly
- [ ] All capture commands forwarded properly
- [ ] Stream end detection works
- [ ] Error propagation works

---

## Phase 4: UI & Persistence Extraction

### Goal
Extract UI broadcast and persistence concerns from background index.ts.

### Scope
- Create `stateBroadcastManager.ts` owning duration/UI updates
- Create `persistenceManager.ts` owning chrome.storage interactions
- Background index.ts approaches minimal orchestration

### Files Touched

| Action | File |
|--------|------|
| CREATE | `background/ui/stateBroadcastManager.ts` |
| CREATE | `background/ui/floatingPaneController.ts` |
| CREATE | `background/persistence/persistenceManager.ts` |
| UPDATE | `background/controllers/sessionController.ts` (use new managers) |
| UPDATE | `background/index.ts` (wire managers) |

### What Remains Unchanged
- Popup/FloatingPane implementations
- Message types
- FSM logic

### Rollback Strategy
Inline broadcast/persistence logic back into sessionController.

### Validation Criteria
- [ ] UI receives state updates
- [ ] Duration timer works correctly
- [ ] Pause freezes duration display
- [ ] State persists across service worker restart

---

## Phase 5: Offscreen Media Module Extraction

### Goal
Split offscreen monolith into focused media pipeline modules.

### Scope
- Extract `streamManager.ts` (getDisplayMedia, track lifecycle)
- Extract `recorderManager.ts` (MediaRecorder lifecycle)
- Extract `chunkManager.ts` (ondataavailable handling)
- Offscreen index.ts becomes thin coordination

### Files Touched

| Action | File |
|--------|------|
| CREATE | `offscreen/media/streamManager.ts` |
| CREATE | `offscreen/media/recorderManager.ts` |
| CREATE | `offscreen/data/chunkManager.ts` |
| CREATE | `offscreen/data/storageManager.ts` |
| CREATE | `offscreen/controllers/captureController.ts` |
| CREATE | `offscreen/routing/messageRouter.ts` |
| UPDATE | `offscreen/index.ts` (wire modules) |

### What Remains Unchanged
- Background controllers
- Message contracts
- IndexedDB schema
- Download logic

### Rollback Strategy
Revert offscreen/index.ts to monolithic implementation.

### Validation Criteria
- [ ] Video capture works
- [ ] Pause/resume works
- [ ] Chunks stored correctly
- [ ] Download produces valid video
- [ ] External stop (tab close) detected

---

## Phase 6: Audio Controller (Background)

### Goal
Add audio control plane in background—no actual audio capture yet.

### Scope
- Create `audioController.ts` managing audio state/policy
- Add audio-related message types to contracts
- Add audio settings to persistence
- Wire to UI (mute button state)

### Files Touched

| Action | File |
|--------|------|
| CREATE | `background/controllers/audioController.ts` |
| UPDATE | `shared/contracts/messages.ts` (audio messages) |
| UPDATE | `shared/types/index.ts` (audio config types) |
| UPDATE | `background/persistence/persistenceManager.ts` (audio prefs) |
| UPDATE | `background/controllers/sessionController.ts` (coordinate audio) |
| UPDATE | `background/ui/stateBroadcastManager.ts` (audio state in UI updates) |

### What Remains Unchanged
- Offscreen implementation (no audio yet)
- Actual media capture
- Existing recording flow

### Rollback Strategy
Remove audioController references, revert message types.

### Validation Criteria
- [ ] Audio settings persist
- [ ] Audio state included in UI broadcasts
- [ ] Mute toggle state tracked
- [ ] Recording still works (without audio)

---

## Phase 7: Audio Pipeline (Offscreen)

### Goal
Implement actual audio capture and mixing in offscreen.

### Scope
- Create `audioManager.ts` (getUserMedia for mic)
- Create `audioMixer.ts` (AudioContext, mixing, gain)
- Create `audioLevels.ts` (AnalyserNode for UI)
- Integrate mixed audio into MediaRecorder stream

### Files Touched

| Action | File |
|--------|------|
| CREATE | `offscreen/media/audio/audioManager.ts` |
| CREATE | `offscreen/media/audio/audioMixer.ts` |
| CREATE | `offscreen/media/audio/audioLevels.ts` |
| UPDATE | `offscreen/media/streamManager.ts` (integrate audio track) |
| UPDATE | `offscreen/controllers/captureController.ts` (audio lifecycle) |
| UPDATE | `offscreen/routing/messageRouter.ts` (audio commands) |

### What Remains Unchanged
- Background controllers (already wired)
- Video capture logic
- Chunk/storage management

### Rollback Strategy
Remove audio modules, revert streamManager to video-only.

### Validation Criteria
- [ ] Microphone permission requested correctly
- [ ] Audio mixed into recording
- [ ] Mute actually silences audio (gain = 0)
- [ ] Audio levels reported for UI indicator
- [ ] Recording works with audio disabled
- [ ] Recording works with no microphone available

---

## Phase 8: Content Telemetry Foundation

### Goal
Add basic telemetry capture infrastructure in content scripts.

### Scope
- Create capture modules: clicks, console
- Create event batching/buffering
- Create transport to background
- Background stores events (no processing yet)

### Files Touched

| Action | File |
|--------|------|
| CREATE | `content/capture/clicks.ts` |
| CREATE | `content/capture/console.ts` |
| CREATE | `content/batching/eventBuffer.ts` |
| CREATE | `content/transport/backgroundBridge.ts` |
| CREATE | `content/schema/events.ts` |
| CREATE | `background/controllers/telemetryController.ts` |
| UPDATE | `content/index.ts` (wire capture modules) |
| UPDATE | `shared/contracts/contentMessages.ts` (telemetry events) |

### What Remains Unchanged
- Recording flow
- Audio pipeline
- FloatingPane functionality

### Rollback Strategy
Remove content capture modules, revert content/index.ts.

### Validation Criteria
- [ ] Click events captured with timestamps
- [ ] Console logs captured
- [ ] Events batched (not sent individually)
- [ ] Background receives and stores events
- [ ] No performance impact on user page
- [ ] Recording works without telemetry (graceful degradation)

---

## Phase 9: Content Telemetry Expansion

### Goal
Complete telemetry capture with remaining modules.

### Scope
- Add: inputs, scroll, navigation, network, DOM snapshots
- Add filtering/throttling where needed
- Synchronize timestamps with session start

### Files Touched

| Action | File |
|--------|------|
| CREATE | `content/capture/inputs.ts` |
| CREATE | `content/capture/scroll.ts` |
| CREATE | `content/capture/navigation.ts` |
| CREATE | `content/capture/network.ts` |
| CREATE | `content/capture/domSnapshots.ts` |
| UPDATE | `content/index.ts` (wire new modules) |
| UPDATE | `content/batching/eventBuffer.ts` (filtering rules) |

### What Remains Unchanged
- All background logic
- All offscreen logic
- Audio pipeline

### Rollback Strategy
Remove new capture modules, keep clicks/console.

### Validation Criteria
- [ ] All event types captured
- [ ] Input values sanitized (no passwords)
- [ ] Scroll events throttled
- [ ] Network requests captured (excluding sensitive headers)
- [ ] DOM snapshots don't block UI
- [ ] Timestamps aligned with session start

---

## Phase Summary

| Phase | Focus | Risk Level | Dependencies | Est. Effort |
|-------|-------|------------|--------------|-------------|
| 0 | Message Contracts | Low | — | Small |
| 1 | Background Routing | Low | Phase 0 | Small |
| 2 | Session Controller | Medium | Phase 1 | Medium |
| 3 | Offscreen Controller | Medium | Phase 2 | Medium |
| 4 | UI & Persistence | Low | Phase 3 | Medium |
| 5 | Offscreen Modules | Medium | Phase 4 | Large |
| 6 | Audio Controller | Low | Phase 5 | Small |
| 7 | Audio Pipeline | High | Phase 6 | Large |
| 8 | Telemetry Foundation | Medium | Phase 5 | Medium |
| 9 | Telemetry Expansion | Low | Phase 8 | Medium |

---

## Parallel Execution Opportunities

After Phase 5 (Offscreen Modules), the following can proceed in parallel:

```
Phase 5 (Offscreen Modules)
         │
         ├──► Phase 6 → Phase 7 (Audio track)
         │
         └──► Phase 8 → Phase 9 (Telemetry track)
```

---

## Risk Mitigation

### High-Risk Areas

1. **Phase 7 (Audio Pipeline)**: Complex Web Audio API integration
   - Mitigation: Extensive manual testing, feature flag for rollback

2. **Phase 5 (Offscreen Modules)**: Core recording path
   - Mitigation: Comprehensive test coverage before refactor

### Testing Strategy

Each phase requires:
1. All existing unit tests pass
2. Manual smoke test of full recording cycle
3. Edge case testing (tab close, permission denial, etc.)

---

## Open Questions

1. **Audio priority**: Should Phase 6-7 (Audio) be prioritized over Phase 8-9 (Telemetry)?

2. **Telemetry storage**: Should telemetry events be stored in IndexedDB alongside video chunks, or separately?

3. **Audio source options**: Should we support system audio (tab audio) in addition to microphone, or mic-only for V1?

4. **Phase 0 strictness**: Should message contracts be enforced at runtime (validation errors) or just compile-time (TypeScript only)?

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| Product Owner | | | |
| QA Lead | | | |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-05 | Claude | Initial draft |
