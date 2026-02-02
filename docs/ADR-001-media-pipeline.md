# ADR-001: Media Pipeline Architecture

**Status**: DRAFT
**Date**: 2026-02-02
**Decision Makers**: Engineering Team
**Phase**: 0 (Media Stability)

---

## Context

TraceQA requires video recording capability in a Chrome Manifest V3 extension. MV3 enforces strict constraints:

1. **Service workers are ephemeral** — Background scripts can terminate at any time
2. **No DOM access in background** — Cannot use MediaRecorder directly in service worker
3. **Offscreen documents required** — Media APIs only available in offscreen context

The existing popup code sends `START_RECORDING` / `STOP_RECORDING` messages to background, but no backend exists to handle them.

---

## Decision

### Architecture: Offscreen-Centric Media Pipeline

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐     ┌─────────┐
│   Popup     │────▶│  Background SW   │────▶│ Offscreen Document │────▶│   R2    │
│  (React)    │     │  (Orchestrator)  │     │  (MediaRecorder)   │     │ Storage │
└─────────────┘     └──────────────────┘     └────────────────────┘     └─────────┘
      │                     │                         │
      │                     │                         │
      ▼                     ▼                         ▼
 User clicks          Routes messages            Holds MediaStream
 Start/Stop           Creates offscreen          Records to Blob
                      Manages lifecycle          Uploads to R2
```

### Component Responsibilities

| Component | Owns | Never Does |
|-----------|------|------------|
| **Popup** | UI state, user input, display recording status | Media capture, permission requests, upload |
| **Background** | Session orchestration, offscreen lifecycle, R2 upload coordination | Hold media blobs, render UI, assume memory persists |
| **Offscreen** | MediaRecorder, Blob accumulation, stream management | UI, user prompts, direct R2 upload |

### Data Flow

1. **Start Recording**
   - Popup sends `START_RECORDING` with config
   - Background creates offscreen document (if not exists)
   - Background requests `getDisplayMedia()` (triggers Chrome picker)
   - Background sends stream to offscreen via message
   - Offscreen starts MediaRecorder

2. **During Recording**
   - Offscreen accumulates chunks in memory
   - Background periodically persists state to `chrome.storage.local`
   - Popup reads state from storage (survives popup close)

3. **Stop Recording**
   - Popup sends `STOP_RECORDING`
   - Background forwards to offscreen
   - Offscreen stops MediaRecorder, finalizes Blob
   - Offscreen sends Blob reference to background
   - Background uploads to R2
   - Background returns share URL to popup

---

## Constraints (Non-Negotiable)

| Constraint | Rationale |
|------------|-----------|
| **Offscreen for MediaRecorder** | MV3 requirement — no DOM APIs in service worker |
| **Blob storage only** | Base64 encoding doubles memory, causes OOM on long recordings |
| **100MB max file size** | R2 single-part upload limit without multipart |
| **30 min max duration** | Prevents runaway recordings, keeps file sizes manageable |
| **Chrome only** | MV3 offscreen API is Chrome-specific |

---

## Alternatives Considered

### Alternative 1: Content Script MediaRecorder

**Rejected** because:
- Content script dies on navigation
- Cannot capture desktop/other tabs
- Permission UX is worse

### Alternative 2: Chunked Upload During Recording

**Deferred** to Phase 2 because:
- Adds complexity (resumable uploads)
- Requires server-side stitching
- Phase 0 goal is stability, not optimization

### Alternative 3: IndexedDB for Blob Storage

**Considered** for:
- Survives service worker termination
- Could enable "resume after crash"

**Decision**: Include as fallback, not primary path. Primary path is memory → R2.

---

## What Could Go Wrong?

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Service worker dies mid-recording | Medium | High | Offscreen continues independently; recovery via `chrome.storage` |
| User closes popup during recording | High | Low | State in storage; popup re-reads on open |
| Offscreen document crashes | Low | High | Detect via message timeout; show error in popup |
| R2 upload fails | Medium | Medium | Retry with exponential backoff; save blob to IndexedDB as fallback |
| User denies screen permission | High | Medium | Clear error message; reset state; allow retry |
| Recording exceeds 100MB | Medium | High | Monitor size during recording; warn at 80MB; auto-stop at 100MB |

---

## Implementation Checklist

### Phase 0 Deliverables

- [ ] Offscreen document with MediaRecorder
- [ ] Background service worker with message routing
- [ ] `getDisplayMedia()` with Chrome screen picker
- [ ] Blob → R2 upload pipeline
- [ ] Error handling for permission denial
- [ ] State persistence in `chrome.storage.local`
- [ ] Recording duration/size limits enforced

### Out of Scope (Phase 0)

- [ ] Microphone audio (deferred — add if trivial)
- [ ] Blur regions
- [ ] Trim controls
- [ ] Preview overlay
- [ ] Supabase session persistence
- [ ] Floating recording pane

---

## References

- [Chrome Offscreen Documents](https://developer.chrome.com/docs/extensions/reference/offscreen/)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [FEATURES.md](../FEATURES.md) — Full feature specifications
