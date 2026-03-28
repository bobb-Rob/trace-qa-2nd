# TraceQA Architecture Documentation

**Last Updated:** 2026-02-05
**Status:** Draft - Pending Review

---

## Overview

This directory contains the complete architecture specification for TraceQA's platform realignment. The goal is to transform TraceQA into a **deterministic capture engine** with clear contracts and boundaries between three planes.

```
┌──────────────┐
│ Content Tab  │  ← User behavior + telemetry
└─────▲────────┘
      │
┌─────┴────────┐
│ Background   │  ← Orchestration + FSM + policy
└─────▲────────┘
      │
┌─────┴────────┐
│ Offscreen    │  ← Media engine (video + audio)
└──────────────┘
```

---

## Document Index

| # | Document | Purpose | Status |
|---|----------|---------|--------|
| 01 | [Migration Plan](01-migration-plan.md) | Phased rollout with 10 phases | Draft |
| 02 | [Background Plane Design](02-background-plane-design.md) | Orchestration layer specification | Draft |
| 03 | [Offscreen Plane Design](03-offscreen-plane-design.md) | Media pipeline specification | Draft |
| 04 | [Content Telemetry Design](04-content-telemetry-design.md) | Telemetry capture system | Draft |
| 05 | [Message Contracts](05-message-contracts.md) | All messages & FSM transitions | Draft |
| 06 | [Logging & Observability](06-logging-observability-design.md) | Cross-plane logging system | Draft |

---

## Quick Reference

### Non-Negotiable Principles

1. **Background never touches media APIs**
2. **Offscreen never knows about UI or FSM**
3. **Content scripts never manage state**
4. **Audio is treated as a first-class media stream**
5. **Everything communicates via explicit messages**
6. **FSM is authoritative for lifecycle**
7. **No toggle behavior** - Every action is explicit

### State Machine

```
IDLE → REQUESTING_PERMISSION → STARTING → RECORDING ↔ PAUSED → STOPPING → UPLOADING → IDLE
```

### Message Categories

| Category | Direction | Example |
|----------|-----------|---------|
| Commands | UI → Background | `START_RECORDING`, `UI_PAUSE_REQUESTED` |
| Events | Offscreen → Background | `OFFSCREEN_STARTED`, `OFFSCREEN_ERROR` |
| Broadcasts | Background → All | `UI_STATE_UPDATE`, `SESSION_ENDED` |
| Queries | Any → Background | `GET_RECORDING_STATUS` |

---

## Reading Order

### For Understanding the System
1. Start with [Message Contracts](05-message-contracts.md) for the vocabulary
2. Read [Background Plane Design](02-background-plane-design.md) for orchestration
3. Read [Offscreen Plane Design](03-offscreen-plane-design.md) for media
4. Read [Content Telemetry Design](04-content-telemetry-design.md) for capture

### For Implementation
1. Start with [Migration Plan](01-migration-plan.md) for phases
2. Reference specific plane documents as needed
3. Use [Message Contracts](05-message-contracts.md) for message types
4. Use [Logging & Observability](06-logging-observability-design.md) for debugging

---

## Target File Structure

After migration, the codebase will be organized as:

```
src/
├── background/
│   ├── index.ts                      # Composition root
│   ├── fsm/                          # State machine
│   ├── routing/                      # Message dispatch
│   ├── controllers/                  # Session, Offscreen, Audio, Telemetry
│   ├── ui/                           # State broadcast, FloatingPane
│   ├── persistence/                  # chrome.storage
│   └── logging/                      # Log collector
│
├── offscreen/
│   ├── index.ts                      # Entry point
│   ├── routing/                      # Message dispatch
│   ├── controllers/                  # Capture controller
│   ├── media/                        # Stream, Recorder, Audio
│   ├── data/                         # Chunk, Storage
│   └── output/                       # Download
│
├── content/
│   ├── index.ts                      # Entry point
│   ├── lifecycle/                    # Session awareness
│   ├── capture/                      # Click, Input, Scroll, etc.
│   ├── batching/                     # Event buffer
│   ├── transport/                    # Background bridge
│   └── schema/                       # Event types
│
├── popup/                            # (existing, minimal changes)
│
├── shared/
│   ├── contracts/                    # Message types
│   ├── types/                        # Shared types
│   └── logging/                      # Logger factory
│
└── components/                       # (existing UI components)
```

---

## Key Decisions

### Why Explicit Commands Over Toggles?

Toggle behavior is ambiguous:
```typescript
// BAD: What does this do? Depends on hidden state
handleTogglePause()

// GOOD: Intent is clear
handlePause()   // Only valid from RECORDING
handleResume()  // Only valid from PAUSED
```

### Why FSM is Pure?

The FSM is a pure function with no side effects:
- Easy to test (just input → output)
- Easy to reason about
- Side effects are handled by controllers

### Why Audio is "Just Another Stream"?

Audio follows the same pattern as video:
1. Acquire stream (`getUserMedia`)
2. Process (AudioContext mixer)
3. Output track added to recording stream

This makes the architecture consistent and extensible.

---

## Open Questions

These questions need answers before implementation:

1. **Audio priority vs Telemetry priority** - Which Phase 6-7 track first?
2. **Telemetry storage** - Same IndexedDB as video or separate?
3. **Tab audio capture** - Support system audio in addition to mic?
4. **Log streaming** - Send logs to external service in production?
5. **iFrame handling** - How to capture telemetry in iframes?

---

## Review Checklist

Before approving each document:

- [ ] No ambiguity in message types
- [ ] No toggle behavior anywhere
- [ ] Clear ownership boundaries
- [ ] Testability addressed
- [ ] Error handling specified
- [ ] Performance considerations noted
- [ ] Security/privacy addressed

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-05 | Claude | Initial documentation set |
