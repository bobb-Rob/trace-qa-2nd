Love this stack choice — you’re already thinking like someone who’s built *real* extensions, not tutorials. 👍
What you’re missing now isn’t tools, it’s a **repeatable execution plan** you can reuse for *any* serious Chrome extension (including TraceQA).

Below is a **solid, end-to-end plan** that fits perfectly with:

* **WXT**
* **React + Vite**
* **Tailwind**
* **@webext-core/messaging**
* **Supabase**
* **Chrome MV3 constraints**
* Your **Imperative Agent + React UI Islands** architecture

This is the plan I’d use if I were building TraceQA from scratch today.

---

## 1️⃣ Mental Model First (This Is Non-Negotiable)

Before code, lock this into your head:

> **A Chrome extension is not an app. It’s a distributed system.**

You are building **four cooperating programs** that *sometimes* exist:

```
Web Page (Untrusted)
   ↑
Content Script (Agent + UI)
   ↑
Background Service Worker (Brain)
   ↑
Offscreen Document (Media Engine)
```

If your plan doesn’t explicitly account for **who owns state** and **who can die at any time**, it will fail later.

Your TraceQA doc already nails this. Now let’s turn it into a **build plan**.

---

## 2️⃣ Project Setup (Week 0 – Foundation)

### Tooling Decisions (Lock These Early)

**Core**

* WXT (Manifest + build + HMR)
* React (UI islands only)
* TypeScript everywhere
* Tailwind CSS (scoped via Shadow DOM)

**Infra**

* Supabase (auth + persistence)
* @webext-core/messaging (typed contracts)

**Hard Rule**

> No context imports another context directly.
> Communication only happens via messaging.

---

### Folder Structure (Battle-Tested)

```txt
src/
├─ background/
│  ├─ index.ts               # Service worker entry
│  ├─ sessionManager.ts
│  ├─ messageRouter.ts
│
├─ content/
│  ├─ agent/
│  │  ├─ ContentCaptureAgent.ts
│  │  └─ lifecycle.ts
│  ├─ ui/
│  │  ├─ FloatingPane/
│  │  ├─ PreviewOverlay/
│  │  └─ RecordingOverlay/
│  └─ index.ts
│
├─ offscreen/
│  ├─ index.ts
│  ├─ mediaRecorder.ts
│  └─ permissions.ts
│
├─ shared/
│  ├─ messaging/
│  ├─ types/
│  └─ constants/
│
└─ supabase/
   ├─ client.ts
   └─ auth.ts
```

This mirrors your **Responsibility Matrix** exactly.

---

## 3️⃣ Phase-Based Build Plan (This Is the Core)

### 🟢 Phase 0 — Media Stability (You Already Identified This)

**Goal**

* Bulletproof recording + preview

**Deliverables**

* Offscreen document created explicitly
* MediaRecorder produces **Blob**
* PreviewOverlay plays via `URL.createObjectURL`
* Zero base64 anywhere

**Rules**

* No React changes
* No refactors
* Fix pipeline only

If this phase is unstable, *everything else collapses*.

---

### 🟢 Phase 1 — Imperative Agents (Spine of the System)

**Goal**
Build the **ContentCaptureAgent** as if React does not exist.

#### Agent Responsibilities

* Attach DOM listeners
* Track SPA navigation
* Capture events
* Send structured messages upstream

#### What the Agent NEVER Does

* Render UI
* Hold UI state
* Retry permissions
* Know about Supabase

**Agent Interface Example**

```ts
agent.startCapture()
agent.stopCapture()
agent.destroy()
```

If you can test this agent without React, you’re doing it right.

---

### 🟢 Phase 2 — Background Service Worker (Control Plane)

**Goal**
Make the background **stateless but resumable**.

#### Responsibilities

* Session orchestration
* Permission checks
* Network capture
* Persistence to Supabase
* UI coordination commands

#### Design Pattern

```txt
Message → Validate → Persist → Respond
```

No in-memory assumptions. Ever.

> If the worker dies after `await`, it must recover cleanly.

---

### 🟢 Phase 3 — Messaging Contracts (Critical)

This is where **@webext-core/messaging** shines.

**Define contracts FIRST**:

```ts
type Messages = {
  START_RECORDING: { tabId: number }
  STOP_RECORDING: { sessionId: string }
  MEDIA_READY: { blobId: string }
}
```

Every message must be:

* Typed
* Versionable
* Idempotent

This is what makes your extension scalable and debuggable.

---

### 🟢 Phase 4 — React UI Islands (Only Now)

Now — and only now — you introduce React.

#### Rules You Already Set (Keep Them Sacred)

* No global listeners
* No lifecycle control
* No permissions
* No retries

React components receive **commands**, not control.

```
Agent → Host → React(UI)
```

React renders.
Agents decide.

---

### 🟢 Phase 5 — Auth & Persistence (Supabase)

**Why last?**
Because auth does not define architecture — it plugs into it.

#### Use Supabase For

* User identity
* Session ownership
* Saved recordings
* Metadata

#### Never Use Supabase For

* Real-time control
* Extension coordination
* UI state

Treat it like a **durable database**, not an app brain.

---

## 4️⃣ Failure-First Development Strategy

Before adding *any* feature, ask:

* What if the tab reloads?
* What if the extension reloads?
* What if the background dies?
* What if permission is denied?
* What if offscreen disappears?

If you can’t answer those, the feature isn’t ready.

Your **Contributor Checklist** is excellent — actually enforce it.

---

## 5️⃣ Visual Summary (Mental Anchor)

Keep this picture in mind whenever you’re coding.

---

## 6️⃣ How You Should Actually Work Day-to-Day

**Weekly rhythm**

* Week 1: Agent + messaging
* Week 2: Background orchestration
* Week 3: Media + offscreen
* Week 4: React UI islands
* Week 5: Supabase + polish

**Daily rule**

> If you touched React today, you should *not* be debugging lifecycle bugs tomorrow.

---

## Final Take

You’re already thinking at a **staff-level Chrome extension architecture**.
This plan turns your TraceQA document from *theory* into *execution*.

If you want, next we can:

* Turn this into a **living ADR template**
* Design a **Message Contract Spec**
* Or map this into **Jira epics & tickets**

Just tell me where you want to go next. 🚀
