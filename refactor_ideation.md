
Perfect timing for this question. What you’re asking for is not a refactor, it’s a **platform realignment**. You’re essentially turning TraceQA into a **deterministic capture engine** (media + telemetry), and the only way that scales is with **clear contracts and boundaries**.

Below is a **staff-level, step-by-step refactoring and evolution plan**, covering:

* Background service worker
* Offscreen media engine
* Content script (telemetry capture)
* Audio capture & mixing API
* Message contracts and sequencing
* Incremental execution order (so you don’t destabilize prod)

No hand-waving, no “utils” dumping grounds.

---

# 🧭 OVERALL TARGET ARCHITECTURE

Think in **three planes**, each with a single responsibility:

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

No plane leaks implementation details to another.

---

# PHASE 0 — NON-NEGOTIABLE PRINCIPLES

These guide *every* decision below:

1. **Background never touches media APIs**
2. **Offscreen never knows about UI or FSM**
3. **Content scripts never manage state**
4. **Audio is treated as a first-class media stream**
5. **Everything communicates via explicit messages**
6. **FSM is authoritative for lifecycle**

---

# PHASE 1 — BACKGROUND REFACTOR PLAN

## 🎯 Goal

Turn the background from a monolith into a **policy + orchestration layer**.

---

## 1️⃣ Background Folder Structure (Target)

```txt
background/
├── index.ts                  # Entry / composition root
├── fsm/
│   ├── fsmManager.ts
│   └── watchdog.ts
├── routing/
│   ├── messageRouter.ts
│   └── commandRouter.ts
├── controllers/
│   ├── sessionController.ts
│   ├── offscreenController.ts
│   ├── audioController.ts     ← NEW
│   └── telemetryController.ts ← FUTURE
├── ui/
│   ├── floatingPaneController.ts
│   └── stateBroadcastManager.ts
├── persistence/
│   └── persistenceManager.ts
└── contracts/
    └── messages.ts
```

---

## 2️⃣ Responsibilities Split

### `fsmManager.ts`

**Owns**

* State
* Context
* Transitions
* Terminal cleanup callback

**Does NOT**

* Call chrome APIs
* Send messages
* Touch media

---

### `messageRouter.ts`

**Owns**

* `chrome.runtime.onMessage`
* Message validation
* Freshness checks

**Pattern**

```ts
router.register(type, handler);
```

No logic. No state.

---

### `sessionController.ts`

**This is the brain**

**Owns**

* Start / stop / pause / resume semantics
* Validation of sessionId
* FSM transitions
* Coordination between:

  * offscreen
  * UI
  * audio

This is where “what happens” lives.

---

### `offscreenController.ts`

**Owns**

* Creating / closing offscreen documents
* Sending commands to offscreen
* Abstracting message types

Background never sends raw `OFFSCREEN_*` messages anymore.

---

### `audioController.ts` (NEW)

**Owns**

* Audio enable/disable state
* Mute state
* Persistence
* Forwarding audio commands to offscreen

**Does NOT**

* Touch AudioContext
* Touch MediaStream

This controller exists *before* audio lands in offscreen.

---

### `stateBroadcastManager.ts`

**Owns**

* Duration calculation
* Timers
* UI updates

FSM-aware, FSM-agnostic.

---

# PHASE 2 — OFFSCREEN REFACTOR PLAN

## 🎯 Goal

Turn offscreen into a **media pipeline**, not a script.

---

## 1️⃣ Offscreen Folder Structure (Target)

```txt
offscreen/
├── index.ts                  # Entry only
├── routing/
│   └── messageRouter.ts
├── controllers/
│   └── captureController.ts
├── media/
│   ├── streamManager.ts
│   ├── recorderManager.ts
│   └── audio/
│       ├── audioManager.ts
│       ├── audioMixer.ts
│       └── audioLevels.ts
├── data/
│   ├── chunkManager.ts
│   └── storageManager.ts
└── output/
    └── downloadManager.ts
```

---

## 2️⃣ Media Pipeline (Critical Concept)

```txt
getDisplayMedia (video)
        │
        ├──► audioMixer ◄── getUserMedia (mic)
        │
   mixed MediaStream
        │
   MediaRecorder
        │
   chunkManager
        │
   storageManager
```

Audio is **not special**. It’s just another stream.

---

## 3️⃣ Offscreen Module Responsibilities

### `captureController.ts`

**Owns**

* Session flags
* Stop semantics (requested vs external)
* Coordination between submodules

**Does NOT**

* Handle MediaRecorder directly
* Handle IndexedDB directly

---

### `streamManager.ts`

**Owns**

* `getDisplayMedia`
* Track lifecycle
* `track.onended`

This is where **audio mixing plugs in**.

---

### `recorderManager.ts`

**Owns**

* MediaRecorder lifecycle
* Pause / resume
* Error handling

Recorder never knows *why* it stopped.

---

### `audioManager.ts`

**Owns**

* Microphone permission
* getUserMedia({ audio })
* Device availability

Returns a **mic MediaStream** only.

---

### `audioMixer.ts`

**Owns**

* AudioContext
* MediaStreamAudioSourceNode
* GainNode (mute)
* MediaStreamDestination

Returns a **single mixed audio track**.

---

### `audioLevels.ts`

**Owns**

* AnalyserNode
* Audio level data

Feeds UI indicators only.

---

## 4️⃣ Audio API Contract (Offscreen)

```ts
audio.init()
audio.enable()
audio.disable()
audio.setMuted(boolean)
audio.getMixedTrack(): MediaStreamTrack | null
audio.getLevel(): number
```

Offscreen owns the truth.

---

# PHASE 3 — CONTENT SCRIPT (Telemetry Capture Plan)

## 🎯 Goal

Capture **user intent & context**, not raw noise.

---

## 1️⃣ Content Script Folder Structure

```txt
content/
├── index.ts
├── lifecycle/
│   └── init.ts
├── capture/
│   ├── clicks.ts
│   ├── inputs.ts
│   ├── scroll.ts
│   ├── navigation.ts
│   ├── network.ts
│   ├── console.ts
│   └── domSnapshots.ts
├── batching/
│   └── eventBuffer.ts
├── transport/
│   └── backgroundBridge.ts
└── schema/
    └── events.ts
```

---

## 2️⃣ Telemetry Capture Rules (Very Important)

* **No global listeners without filters**
* **No synchronous DOM heavy work**
* **All events timestamped**
* **Everything buffered**
* **Never block user interaction**

---

## 3️⃣ Event Schema (Example)

```ts
interface TelemetryEvent {
  sessionId: string;
  type: 'click' | 'network' | 'console';
  timestamp: number;
  payload: unknown;
}
```

Content scripts **never interpret meaning**.

---

## 4️⃣ Transport Strategy

* Batch events (e.g. every 500ms or 50 events)
* Send to background via `chrome.runtime.sendMessage`
* Background just stores / forwards later

No FSM logic in content.

---

# PHASE 4 — AUDIO + TELEMETRY SYNCHRONIZATION

## 🎯 Goal

Make replay & debugging possible later.

---

## Synchronization Strategy

* Background generates **session start timestamp**
* Offscreen uses same sessionId
* Content timestamps events relative to session start
* Audio/video timestamps are implicit via MediaRecorder

This lets you align:

* “user clicked”
* “console error”
* “audio narration”
* “screen frame”

---

# PHASE 5 — EXECUTION ORDER (SAFE & INCREMENTAL)

### Recommended sequence

1. Refactor **background routing + controllers**
2. Refactor **offscreen storage + chunk manager**
3. Introduce **offscreen streamManager**
4. Add **audioManager + audioMixer**
5. Wire **audioController (background)**
6. Add **basic content telemetry (clicks + console)**
7. Expand telemetry capture gradually

At no point do you break recording.

---

# 🧠 Final Verdict

You’re not just refactoring — you’re laying the foundation for:

* Audio narration
* Full repro context
* Deterministic replay
* Post-processing (R2, AI, annotations)



