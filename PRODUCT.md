# TraceQA Product Vision

TraceQA is a **lifecycle-wide QA platform** that supports quality assurance from spec to production.

---

## What TraceQA Is

TraceQA captures **intent** — what should happen, what did happen, and what went wrong — and converts that intent into actionable QA artifacts:

- **WorkItems**: Structured objects representing bugs or test cases
- **Bug Reports**: Shareable, developer-friendly collaboration artifacts
- **Test Cases**: Automated regression tests generated from captured behavior
- **Video Recordings**: Full session capture with timeline, comments, and sharing

TraceQA is **intent-first**, not UI-first. The UI recording is one of multiple ways to capture intent.

---

## The QA Lifecycle Model

TraceQA supports the entire QA lifecycle, not just one phase:

### Shift-Left (Early Development)
- Test cases authored from specs and requirements
- Stored as structured WorkItems
- Automation stubs generated before UI exists

### Mid-Development
- UI exists and is testable
- User sessions recorded via browser extension with **video capture**
- Recordings bound to existing test cases
- Steps validated or refined based on actual behavior

### Shift-Right (Production)
- Sessions recorded from real user activity
- Failures identified and marked with **session flags**
- **Structured bug reports generated** as shareable artifacts
- Bug WorkItems converted into regression test cases
- Knowledge fed back to earlier phases

---

## Core Concepts

### WorkItem

The fundamental unit in TraceQA. A WorkItem represents either:

| Type | Description |
|------|-------------|
| **Bug** | A captured failure with reproduction steps, evidence, and context |
| **TestCase** | A structured verification of expected behavior |

Both share the same underlying structure:
- Triggering action or precondition
- Expected behavior
- Actual behavior (for bugs) or assertion (for test cases)
- Evidence (screenshots, video, logs, network data)
- Environment context

A Bug can be **promoted** to a TestCase. This is the core value loop.

### Session

A recording session captures:
- **Video recording** (tab or desktop, with optional microphone audio)
- User interactions (clicks, inputs, navigation)
- Console output (logs, warnings, errors)
- Network traffic (requests, responses, failures)
- DOM state snapshots
- Screenshots (automatic on error, manual via flags)
- **Session flags** (user-marked moments: issue, success, important)
- **Blur regions** (privacy protection for sensitive data)

Sessions can be:
- Exploratory (no pre-existing test case)
- Bound (linked to an existing test case for validation)

### Bug Report (View)

A Bug Report is a **read-only view** of a Bug WorkItem, optimized for:
- Sharing with developers via **shareable links**
- Linking in issue trackers
- **Timestamped comments** for collaboration
- **Video playback** with event timeline

A Bug Report contains:
- Clear reproduction steps
- Expected vs actual behavior
- Evidence (video, screenshots, console logs, network errors)
- Environment fingerprint
- Linkable URL with **timestamp deep links**

The Bug Report is a **first-class output**, not an internal object.

---

## Intent Sources

TraceQA accepts intent from multiple sources:

| Source | Description | Phase |
|--------|-------------|-------|
| **Spec/Requirement** | Test case authored before UI exists | Shift-left |
| **Browser Recording** | Session captured via Chrome extension with video | Mid / Shift-right |
| **CI Failure** | Test failure correlated to behavior | Shift-right |
| **Manual Entry** | Bug or test case written directly | Any |
| **Recording Request** | Another user requests you to record | Any |

The browser extension is one input method, not the only one.

---

## Capture Features

### Video Recording
- **Tab capture**: Record the current browser tab
- **Desktop capture**: Record entire screen or window
- **Quality options**: 480p (SD) or 720p (HD)
- **Max duration**: 30 minutes per session
- **Audio**: Optional microphone narration

### Privacy & Blur
- **Real-time blur**: Draw rectangles to blur sensitive areas during recording
- **Post-recording blur**: Add blur regions after capture before saving
- **Gaussian blur effect**: Professional privacy protection
- **PII redaction**: Automatic detection and masking

### Session Flags
During recording, users can flag moments:
- **Issue flag**: Mark where something went wrong
- **Success flag**: Mark expected behavior working
- **Important flag**: Highlight key moments
- **Note flag**: Add context with text

### Post-Recording Preview
- **Video preview**: Review recording before saving
- **Timeline markers**: See errors and flags visualized
- **Trim controls**: Remove beginning/end of recording
- **Timestamped comments**: Add notes at specific moments
- **Share & save**: Generate link and open in dashboard

---

## Collaboration Features

### Sharing
- **Shareable links**: Anyone with link can view session
- **Timestamp links**: Deep link to specific moment (e.g., `?t=135`)
- **Password protection**: Optional access control
- **Link expiration**: Set auto-expire time
- **View tracking**: See how many times link was accessed

### Comments
- **Timestamped comments**: Add comments at specific video moments
- **Team collaboration**: Multiple users can comment
- **Jump-to-timestamp**: Click comment to seek video
- **Timeline markers**: Comments shown on video timeline

### Request Recording
- **Create request**: Specify URL, instructions, deadline
- **Share request link**: Send to anyone to record
- **Track submissions**: See when recordings are submitted
- **Notifications**: Get notified when request is fulfilled

---

## What TraceQA Is NOT

- **Not a screen recorder** — Structure beats raw media; video enhances context
- **Not a bug tracker** — Bug reports are outputs, not the system of record
- **Not Jira/Linear** — TraceQA generates artifacts for issue trackers, not replaces them
- **Not UI-first** — Recording is optional; intent can come from specs
- **Not Loom/Jam only** — Video is one part; test generation is the differentiator

---

## Value Proposition

### For QA Engineers
- Capture bugs with full technical context **and video evidence**
- Generate test cases from captured behavior
- Track coverage across the QA lifecycle
- Reduce time spent writing reproduction steps
- **Collaborate with timestamped comments**

### For Developers
- Receive clear, actionable bug reports **with video playback**
- Get reproduction steps that actually work
- See exact environment and state at failure time
- Review auto-generated tests for accuracy
- **Jump to exact moment of failure via timestamp links**

### For Engineering Leaders
- Measure QA coverage from spec to production
- Reduce escaped bugs through systematic test generation
- Build institutional knowledge from every failure
- **Request recordings from team members**

---

## Key Differentiators

| Traditional Tools | Jam.dev | TraceQA |
|-------------------|---------|---------|
| Bug capture only | Bug capture + video | Bug capture + video + **test generation** |
| No video | Video recording | Video + events + console + network |
| Manual reproduction | Visual reproduction | **Automated script generation** |
| Reports as endpoints | Shareable reports | Reports + **WorkItem model** |
| Siloed workflow | Bug-focused | **Full QA lifecycle** |
| No test output | No test output | **Playwright/Cypress code generation** |

---

## Success Metrics

- **Coverage**: Percentage of features with test cases
- **Conversion Rate**: Bugs promoted to test cases
- **Escaped Bugs**: Production failures not covered by tests
- **Time to Test**: Duration from bug capture to test creation
- **Report Quality**: Developer satisfaction with bug reports
- **Collaboration**: Comments and shares per session

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Technical system design
- [FEATURES.md](FEATURES.md) — Complete feature specifications
- [DEVELOPMENT_PLAN.md](../implementation/DEVELOPMENT_PLAN.md) — Implementation phases
