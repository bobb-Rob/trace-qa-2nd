# TraceQA Extension - Manual Test Cases

**Version:** 1.0
**Last Updated:** 2026-02-02
**Author:** QA Team

---

## Table of Contents

1. [Happy Path Test Cases](#1-happy-path-test-cases)
2. [Negative Path Test Cases](#2-negative-path-test-cases)
3. [Edge Case & Boundary Test Cases](#3-edge-case--boundary-test-cases)
4. [State Machine Validation Tests](#4-state-machine-validation-tests)
5. [Error Guessing Test Cases](#5-error-guessing-test-cases)
6. [Observability & Debuggability Checks](#6-observability--debuggability-checks)
7. [Regression Test Checklist](#7-regression-test-checklist)

---

## 1. Happy Path Test Cases

### HP-001: Basic Tab Recording Flow

| Field | Description |
|-------|-------------|
| **Preconditions** | Extension installed, user on any web page, no active recording |
| **Steps** | 1. Click extension icon to open popup<br>2. Verify default settings (HD, TAB mode)<br>3. Click "Start Recording"<br>4. Select the current tab in the screen picker<br>5. Perform some actions on the page<br>6. Click extension icon and click "Stop Recording"<br>7. Wait for download to complete |
| **Expected Result** | - Popup shows loading state during permission request<br>- Recording UI appears only after screen selection<br>- Timer starts from 0:00<br>- Video file downloads successfully<br>- Popup returns to idle state |
| **State Transitions** | IDLE → REQUESTING_PERMISSION → STARTING → RECORDING → STOPPING → UPLOADING → IDLE |

### HP-002: Full Screen Recording Flow

| Field | Description |
|-------|-------------|
| **Preconditions** | Extension installed, user on any web page |
| **Steps** | 1. Open popup and start recording<br>2. Select "Entire Screen" in picker<br>3. Record for 30+ seconds<br>4. Stop recording |
| **Expected Result** | - Full screen is captured<br>- Video includes all display content<br>- File downloads correctly |

### HP-003: Window Recording Flow

| Field | Description |
|-------|-------------|
| **Preconditions** | Multiple browser windows open |
| **Steps** | 1. Start recording<br>2. Select a specific window in picker<br>3. Switch between windows during recording<br>4. Stop recording |
| **Expected Result** | - Only selected window content is captured<br>- Switching windows doesn't break recording |

### HP-004: Quality Settings Change

| Field | Description |
|-------|-------------|
| **Preconditions** | Not recording |
| **Steps** | 1. Open popup<br>2. Change quality from HD to SD<br>3. Start recording and complete flow<br>4. Verify settings persisted on popup reopen |
| **Expected Result** | - Settings saved to storage<br>- Recording uses SD quality (lower file size)<br>- Settings persist across popup opens |

### HP-005: Immediate Re-recording After Success

| Field | Description |
|-------|-------------|
| **Preconditions** | Just completed a successful recording |
| **Steps** | 1. Complete a recording successfully<br>2. Immediately start a new recording<br>3. Complete the second recording |
| **Expected Result** | - No "Already recording or busy" error<br>- Second recording works identically to first<br>- Both videos download correctly |

---

## 2. Negative Path Test Cases

### NP-001: User Denies Screen Permission

| Field | Description |
|-------|-------------|
| **Trigger** | Click "Cancel" or close the screen picker dialog |
| **Preconditions** | Started recording, screen picker is visible |
| **Steps** | 1. Click "Start Recording"<br>2. When screen picker appears, click "Cancel" |
| **Expected State Behavior** | REQUESTING_PERMISSION/STARTING → IDLE (via PERMISSION_DENIED or CAPTURE_FAILED) |
| **Expected UI Behavior** | - Popup returns to idle state<br>- No error message shown (user intentionally cancelled)<br>- "Start Recording" button is enabled |
| **Expected Logs** | `[TraceQA:FSM] Transition: { from: 'STARTING', to: 'IDLE', event: 'CAPTURE_FAILED' }` |
| **Auto-Recovery** | Yes - system returns to IDLE automatically |

### NP-002: Permission Revoked Mid-Recording

| Field | Description |
|-------|-------------|
| **Trigger** | Click "Stop sharing" button in browser UI during recording |
| **Preconditions** | Active recording in progress |
| **Steps** | 1. Start recording<br>2. Click browser's "Stop sharing" button (blue bar) |
| **Expected State Behavior** | RECORDING → IDLE (via CAPTURE_FAILED, stream ended) |
| **Expected UI Behavior** | - Recording stops<br>- Popup returns to idle on next open<br>- Partial video may or may not be saved |
| **Expected Logs** | `[TraceQA] Capture error: { errorCode: 'STREAM_ENDED' }`<br>`[TraceQA:FSM] Transition: RECORDING → IDLE` |
| **Auto-Recovery** | Yes - finalizeSession() called automatically |

### NP-003: Offscreen Document Creation Fails

| Field | Description |
|-------|-------------|
| **Trigger** | Simulate by having max offscreen documents already open (browser limit) |
| **Preconditions** | Browser at offscreen document limit |
| **Steps** | 1. Attempt to start recording |
| **Expected State Behavior** | REQUESTING_PERMISSION → IDLE (via CAPTURE_FAILED) |
| **Expected UI Behavior** | - Error message shown in popup<br>- Returns to idle state |
| **Expected Logs** | `[TraceQA] Start recording error: Failed to create offscreen document` |
| **Auto-Recovery** | Yes |

### NP-004: MediaRecorder Encoder Error

| Field | Description |
|-------|-------------|
| **Trigger** | Occurs rarely with certain codec/hardware combinations |
| **Preconditions** | Recording in progress |
| **Steps** | 1. Start recording<br>2. Wait for encoder error (or simulate via dev tools) |
| **Expected State Behavior** | RECORDING → IDLE (via CAPTURE_FAILED) |
| **Expected UI Behavior** | - Recording stops<br>- Error shown to user |
| **Expected Logs** | `OFFSCREEN_CAPTURE_ERROR: { errorCode: 'ENCODER_ERROR' }` |
| **Auto-Recovery** | Yes |

### NP-005: Download Fails

| Field | Description |
|-------|-------------|
| **Trigger** | Disk full, downloads folder permissions, or browser download blocked |
| **Preconditions** | Recording completed, in UPLOADING state |
| **Steps** | 1. Complete a recording<br>2. Block or cancel the download |
| **Expected State Behavior** | UPLOADING → IDLE (via UPLOAD_FAILED) |
| **Expected UI Behavior** | - Popup returns to idle<br>- lastError stored for debugging |
| **Expected Logs** | `[TraceQA:FSM] Transition: UPLOADING → IDLE, event: UPLOAD_FAILED` |
| **Auto-Recovery** | Yes |

### NP-006: Duplicate START_RECORDING Command

| Field | Description |
|-------|-------------|
| **Trigger** | Send START_RECORDING while already recording |
| **Preconditions** | Recording in progress |
| **Steps** | 1. Start recording<br>2. Via console, send another START_RECORDING message |
| **Expected State Behavior** | State unchanged (RECORDING) |
| **Expected UI Behavior** | Returns `{ success: false, error: 'Already recording or busy' }` |
| **Expected Logs** | No FSM transition logged (rejected at gate) |
| **Auto-Recovery** | N/A - request rejected |

### NP-007: STOP_RECORDING With Wrong Session ID

| Field | Description |
|-------|-------------|
| **Trigger** | Send STOP with mismatched sessionId |
| **Preconditions** | Recording in progress |
| **Steps** | 1. Start recording<br>2. Send STOP_RECORDING with different sessionId |
| **Expected State Behavior** | State unchanged (RECORDING) |
| **Expected UI Behavior** | Returns `{ success: false, error: 'Session mismatch' }` |
| **Expected Logs** | No FSM transition, rejection logged |
| **Auto-Recovery** | N/A |

### NP-008: Stale Message From Previous Session

| Field | Description |
|-------|-------------|
| **Trigger** | Offscreen sends message with old sessionId |
| **Preconditions** | New recording started after previous one |
| **Steps** | 1. Complete recording A<br>2. Start recording B<br>3. Simulate delayed message from session A |
| **Expected State Behavior** | Message ignored, state unchanged |
| **Expected UI Behavior** | No effect |
| **Expected Logs** | `[TraceQA:Watchdog] Stale message detected: expected X, got Y` |
| **Auto-Recovery** | N/A - message dropped |

### NP-009: Invalid/Malformed Message

| Field | Description |
|-------|-------------|
| **Trigger** | Send message with unknown type or missing payload |
| **Preconditions** | Extension running |
| **Steps** | 1. Send `{ type: 'UNKNOWN_TYPE' }` to background |
| **Expected State Behavior** | No state change |
| **Expected UI Behavior** | Returns `{ success: false, error: 'Unknown message type' }` |
| **Expected Logs** | Warning logged |
| **Auto-Recovery** | N/A |

### NP-010: STOP Before Recording Starts

| Field | Description |
|-------|-------------|
| **Trigger** | Send STOP_RECORDING while in STARTING state |
| **Preconditions** | Screen picker visible, state is STARTING |
| **Steps** | 1. Click Start Recording<br>2. Before selecting screen, send STOP command |
| **Expected State Behavior** | Returns error (not in RECORDING state) |
| **Expected UI Behavior** | Error response, no crash |
| **Expected Logs** | `Not recording` error returned |
| **Auto-Recovery** | N/A |

---

## 3. Edge Case & Boundary Test Cases

### EC-001: Double-Click Start Button Rapidly

| Field | Description |
|-------|-------------|
| **Scenario** | User clicks Start Recording twice in < 100ms |
| **Steps** | 1. Double-click "Start Recording" very quickly |
| **Expected Result** | - Only one recording session starts<br>- Second click ignored or returns "Already recording or busy"<br>- No duplicate offscreen documents created |
| **Risk** | Race condition, duplicate sessions |

### EC-002: Click Stop Before Screen Selection

| Field | Description |
|-------|-------------|
| **Scenario** | User clicks Start, then immediately tries to Stop before picker |
| **Steps** | 1. Click Start Recording<br>2. Immediately click Stop Recording (before picker appears) |
| **Expected Result** | - Stop returns "Not recording" error<br>- Screen picker continues to show<br>- If user cancels picker, returns to IDLE |

### EC-003: Close Tab During Recording

| Field | Description |
|-------|-------------|
| **Scenario** | Close the tab being recorded |
| **Steps** | 1. Start recording current tab<br>2. Close that tab |
| **Expected Result** | - Recording should detect stream ended<br>- Transition to IDLE via CAPTURE_FAILED<br>- Offscreen document closed |

### EC-004: Close Popup During Recording Start

| Field | Description |
|-------|-------------|
| **Scenario** | Close popup while waiting for screen selection |
| **Steps** | 1. Click Start Recording<br>2. Close popup before selecting screen<br>3. Select screen in picker<br>4. Reopen popup |
| **Expected Result** | - Recording starts normally<br>- Popup shows recording state when reopened |

### EC-005: Reload Extension During Recording

| Field | Description |
|-------|-------------|
| **Scenario** | Go to chrome://extensions and reload extension mid-recording |
| **Steps** | 1. Start recording<br>2. Reload extension via chrome://extensions |
| **Expected Result** | - Recording is lost (expected)<br>- On restart, self-healing detects orphaned state<br>- State resets to IDLE |

### EC-006: Browser Crash and Restart

| Field | Description |
|-------|-------------|
| **Scenario** | Browser crashes during recording |
| **Steps** | 1. Start recording<br>2. Force-kill browser process<br>3. Restart browser |
| **Expected Result** | - On wake, validateStateOnWake() runs<br>- Detects no offscreen document<br>- Resets to IDLE with "Session recovered" message |

### EC-007: Very Short Recording (< 1 second)

| Field | Description |
|-------|-------------|
| **Scenario** | User starts and immediately stops |
| **Steps** | 1. Start recording<br>2. Stop immediately after screen selection |
| **Expected Result** | - Should produce a valid (very short) video file<br>- No errors or crashes<br>- Clean return to IDLE |

### EC-008: Maximum Recording Duration (30 min)

| Field | Description |
|-------|-------------|
| **Scenario** | Recording reaches max duration limit |
| **Steps** | 1. Start recording<br>2. Wait 30 minutes (or set lower limit for testing) |
| **Expected Result** | - Watchdog fires STOP_REQUESTED<br>- Recording stops gracefully<br>- Video file saved |

### EC-009: Maximum File Size (100 MB)

| Field | Description |
|-------|-------------|
| **Scenario** | Recording reaches size limit |
| **Steps** | 1. Start HD recording<br>2. Record until size approaches 100 MB |
| **Expected Result** | - Size warning at 80% (80 MB)<br>- Auto-stop at 100 MB<br>- Partial video saved |

### EC-010: Switch Tabs While Recording

| Field | Description |
|-------|-------------|
| **Scenario** | User navigates away from recorded tab |
| **Steps** | 1. Start recording Tab A<br>2. Switch to Tab B<br>3. Return to Tab A<br>4. Stop recording |
| **Expected Result** | - Recording continues uninterrupted<br>- Tab switching doesn't affect capture<br>- Video includes all content from Tab A |

### EC-011: Multiple Windows

| Field | Description |
|-------|-------------|
| **Scenario** | User has multiple browser windows |
| **Steps** | 1. Open multiple Chrome windows<br>2. Start recording in Window 1<br>3. Select Window 2's tab in picker<br>4. Work in Window 1<br>5. Stop recording |
| **Expected Result** | - Records Window 2's content<br>- Popup in Window 1 shows recording state<br>- No confusion between windows |

### EC-012: SPA Navigation During Recording

| Field | Description |
|-------|-------------|
| **Scenario** | Single Page App navigation (React Router, etc.) |
| **Steps** | 1. Start recording on SPA<br>2. Navigate within SPA (client-side routing)<br>3. Stop recording |
| **Expected Result** | - Recording continues through navigation<br>- All pages captured<br>- No interruption |

### EC-013: Full Page Reload During Recording

| Field | Description |
|-------|-------------|
| **Scenario** | User refreshes the page being recorded |
| **Steps** | 1. Start recording Tab A<br>2. Press F5 to refresh Tab A |
| **Expected Result** | - Tab capture mode: Recording may stop (stream ends)<br>- Window/Screen mode: Recording continues |

### EC-014: Service Worker Suspension

| Field | Description |
|-------|-------------|
| **Scenario** | Chrome suspends service worker during recording |
| **Steps** | 1. Start recording<br>2. Wait for SW suspension (30s inactivity)<br>3. Stop recording |
| **Expected Result** | - Recording continues (offscreen handles it)<br>- SW wakes on stop message<br>- State restored correctly |

### EC-015: Open Popup Multiple Times During Recording

| Field | Description |
|-------|-------------|
| **Scenario** | Repeatedly open/close popup |
| **Steps** | 1. Start recording<br>2. Close popup<br>3. Open popup<br>4. Repeat 10 times |
| **Expected Result** | - Timer continues accurately<br>- State always shows RECORDING<br>- No memory leaks |

---

## 4. State Machine Validation Tests

### SM-001: Verify All Legal Transitions

| Current State | Event | Expected Next State | Test |
|--------------|-------|---------------------|------|
| IDLE | START_REQUESTED | REQUESTING_PERMISSION | Start recording |
| REQUESTING_PERMISSION | PERMISSION_GRANTED | STARTING | Offscreen created |
| REQUESTING_PERMISSION | PERMISSION_DENIED | IDLE | User cancels picker |
| STARTING | CAPTURE_STARTED | RECORDING | MediaRecorder started |
| STARTING | CAPTURE_FAILED | IDLE | Error during start |
| RECORDING | STOP_REQUESTED | STOPPING | User stops |
| RECORDING | CAPTURE_FAILED | IDLE | Stream ends unexpectedly |
| STOPPING | CAPTURE_STOPPED | UPLOADING | MediaRecorder stopped |
| STOPPING | CAPTURE_FAILED | IDLE | Error during stop |
| UPLOADING | UPLOAD_COMPLETE | IDLE | Download successful |
| UPLOADING | UPLOAD_FAILED | IDLE | Download failed |
| ANY | FORCE_RESET | IDLE | Manual/watchdog reset |

### SM-002: Verify Illegal Transitions Are Blocked

| Current State | Illegal Event | Expected Behavior |
|--------------|---------------|-------------------|
| IDLE | CAPTURE_STARTED | Ignored, state unchanged |
| IDLE | STOP_REQUESTED | Ignored, returns "Not recording" |
| RECORDING | START_REQUESTED | Returns "Already recording or busy" |
| RECORDING | PERMISSION_GRANTED | Ignored |
| UPLOADING | STOP_REQUESTED | Ignored |
| STOPPING | START_REQUESTED | Ignored |

**Verification Method:** Check console logs for `Invalid transition rejected` warnings.

### SM-003: Duplicate Events Don't Break State

| Test | Steps | Expected |
|------|-------|----------|
| Double STOP | Send STOP_REQUESTED twice while RECORDING | First succeeds, second ignored (not in RECORDING) |
| Double START | Send START_REQUESTED twice from IDLE | First succeeds, second returns "busy" |
| Multiple FORCE_RESET | Send FORCE_RESET 3 times | All succeed, state remains IDLE |

### SM-004: Every Failure Path Returns to IDLE

| Failure Point | Trigger | Verify Returns to IDLE |
|--------------|---------|------------------------|
| REQUESTING_PERMISSION | Cancel picker | ✓ Check state is IDLE |
| STARTING | Offscreen error | ✓ Check state is IDLE |
| RECORDING | Stream ended | ✓ Check state is IDLE |
| STOPPING | Finalization error | ✓ Check state is IDLE |
| UPLOADING | Download cancelled | ✓ Check state is IDLE |

### SM-005: "Already Recording or Busy" Never Persists After Failure

| Test | Steps | Expected |
|------|-------|----------|
| Cancel and retry | 1. Start recording<br>2. Cancel picker<br>3. Try start again | Second attempt works |
| Error and retry | 1. Start recording<br>2. Force an error<br>3. Try start again | Second attempt works |
| Crash and retry | 1. Kill offscreen<br>2. Try start | Self-heals, start works |

### SM-006: Watchdog Timeout Tests

| State | Timeout | Expected Event | Test Method |
|-------|---------|----------------|-------------|
| REQUESTING_PERMISSION | 60s | PERMISSION_DENIED | Leave picker open for 60s |
| STARTING | 30s | CAPTURE_FAILED | Prevent CAPTURE_STARTED message |
| RECORDING | 30min | STOP_REQUESTED | Wait or reduce timeout |
| STOPPING | 30s | CAPTURE_FAILED | Prevent CAPTURE_STOPPED message |
| UPLOADING | 120s | UPLOAD_FAILED | Prevent download complete |

### SM-007: Self-Healing on Service Worker Wake

| Scenario | Stored State | Offscreen Exists | Expected Action |
|----------|-------------|------------------|-----------------|
| Clean wake | IDLE | No | No action needed |
| Valid recording | RECORDING | Yes | Restore state, start watchdog |
| Orphaned state | RECORDING | No | Reset to IDLE, log warning |
| Orphaned state | STOPPING | No | Reset to IDLE |
| Orphaned state | UPLOADING | No | Reset to IDLE |

---

## 5. Error Guessing Test Cases

### EG-001: Race Between Stop and Stream End

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Two async events compete to finalize the session |
| **Scenario** | User clicks Stop at exact moment stream ends naturally |
| **Test Steps** | 1. Start recording<br>2. Click "Stop sharing" in browser UI<br>3. Simultaneously click Stop in popup |
| **Expected** | One event wins, session ends cleanly, no double-finalization |
| **Risk** | Double cleanup, state corruption, duplicate IDLE transitions |

### EG-002: Message Arrival During State Transition

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Async messages may arrive during transition execution |
| **Scenario** | CAPTURE_STARTED arrives while still processing PERMISSION_GRANTED |
| **Test Steps** | Reduce artificial delays, stress test with rapid state changes |
| **Expected** | Messages queued or handled in order |
| **Risk** | State machine gets into invalid state |

### EG-003: Service Worker Killed Mid-Transition

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | MV3 can terminate SW at any time |
| **Scenario** | SW terminated between in-memory update and storage.set |
| **Test Steps** | 1. Start recording<br>2. Use chrome://serviceworker-internals to stop SW<br>3. Check state on wake |
| **Expected** | Self-healing detects inconsistency, resets to IDLE |
| **Risk** | In-memory and storage state diverge permanently |

### EG-004: Offscreen Document Zombie

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Offscreen may survive after session ends |
| **Scenario** | closeOffscreenDocument fails silently |
| **Test Steps** | 1. Complete recording<br>2. Check chrome://extensions for offscreen<br>3. Try to start new recording |
| **Expected** | Either reuses existing offscreen or closes and creates new |
| **Risk** | "Offscreen document already exists" blocks new recordings |

### EG-005: IndexedDB Quota Exceeded

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Blob storage can fill up |
| **Scenario** | Multiple failed recordings leave orphaned blobs |
| **Test Steps** | 1. Start/cancel 50 recordings<br>2. Check IndexedDB size<br>3. Record until quota error |
| **Expected** | Graceful error handling, user notified |
| **Risk** | Silent failure, extension becomes unusable |

### EG-006: getDisplayMedia Returns Null Stream

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Rare browser bug or permission edge case |
| **Scenario** | getDisplayMedia resolves but stream is null/empty |
| **Test Steps** | Mock navigator.mediaDevices in tests |
| **Expected** | Handled as CAPTURE_FAILED, not null pointer exception |
| **Risk** | Uncaught exception crashes offscreen |

### EG-007: MediaRecorder Unsupported Codec

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | VP9 not supported on all systems |
| **Scenario** | Hardware doesn't support requested codec |
| **Test Steps** | Test on older machines or Linux without VP9 |
| **Expected** | Falls back to VP8 or shows clear error |
| **Risk** | Recording starts but produces corrupt file |

### EG-008: Popup Opened During Transition

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Popup reads state that's mid-transition |
| **Scenario** | Open popup while transitioning from STARTING to RECORDING |
| **Test Steps** | Use timing to open popup during transition |
| **Expected** | Popup polls until state settles, shows correct UI |
| **Risk** | Shows wrong UI state, confuses user |

### EG-009: Chrome.runtime.sendMessage Fails

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Extension context can be invalidated |
| **Scenario** | Extension updated while popup is open |
| **Test Steps** | 1. Open popup<br>2. Update extension<br>3. Click Start |
| **Expected** | Error caught, user prompted to refresh |
| **Risk** | Uncaught promise rejection, broken state |

### EG-010: Blob URL Revoked Before Download

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | URL.revokeObjectURL called too early |
| **Scenario** | Blob URL revoked before download initiates |
| **Test Steps** | Simulate network slowdown during download |
| **Expected** | Download completes or fails gracefully |
| **Risk** | Corrupt or empty file downloaded |

### EG-011: Storage.local.set Exceeds Quota

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Chrome storage has 10 MB limit |
| **Scenario** | Too much data stored (unlikely but possible) |
| **Test Steps** | Fill storage.local with test data, then record |
| **Expected** | Error handled, state not corrupted |
| **Risk** | State persistence fails silently |

### EG-012: Concurrent Recordings From Different Windows

| Field | Description |
|-------|-------------|
| **Why Likely to Find Defects** | Each window shares same background worker |
| **Scenario** | Two windows try to start recording simultaneously |
| **Test Steps** | Open two popups, click Start at same time |
| **Expected** | One succeeds, one gets "Already recording or busy" |
| **Risk** | Race condition creates two sessions |

---

## 6. Observability & Debuggability Checks

### OB-001: FSM Transition Logging

| Check | Verification |
|-------|--------------|
| Every transition logged | Console shows `[TraceQA:FSM] Transition: { from, to, event, reason }` |
| Invalid transitions logged | Console shows `Invalid transition rejected` with details |
| Reason is meaningful | Reason string explains why transition occurred |

### OB-002: Session ID Traceability

| Check | Verification |
|-------|--------------|
| Session ID in all messages | Check payload contains sessionId |
| Session ID in logs | Search logs for session ID, find full history |
| Stale session detection | Logs warn when sessionId mismatch detected |

### OB-003: Error Messages Are Actionable

| Error | Should Include |
|-------|----------------|
| Permission denied | Clear indication user cancelled |
| Stream ended | Explains user stopped sharing |
| Encoder error | Codec information, device info |
| Download failed | File path or browser error |

### OB-004: No Silent Failures

| Scenario | Verification |
|----------|--------------|
| All catch blocks log | Search for `catch` blocks, verify console.error |
| Promise rejections handled | No unhandled rejection warnings |
| Fallback logging | Even finalizeSession logs errors |

### OB-005: State Persistence Verification

| Check | How to Verify |
|-------|---------------|
| State saved to storage | `chrome.storage.local.get(['sessionState'])` |
| Transition context saved | `chrome.storage.local.get(['fsmLastTransition'])` |
| Last error saved | `chrome.storage.local.get(['lastError'])` |

### OB-006: Watchdog Activity Logging

| Event | Expected Log |
|-------|--------------|
| Watchdog started | `[TraceQA:Watchdog] Started timer for STATE: Xms` |
| Watchdog timeout | `[TraceQA:Watchdog] Timeout in state STATE` |
| Self-healing triggered | `[TraceQA:Watchdog] Self-healing: ...` |

### OB-007: Diagnose From Logs Alone

**Test:** Given only console logs, can you determine:
- What state the session was in?
- What event caused the failure?
- What the session ID was?
- When the failure occurred?

All answers should be YES.

---

## 7. Regression Test Checklist

### After Any Messaging Change

- [ ] Start recording works (full happy path)
- [ ] Stop recording works
- [ ] Cancel permission returns to IDLE
- [ ] Error during recording returns to IDLE
- [ ] Stale messages are rejected
- [ ] Invalid messages return error
- [ ] Session ID matches in all messages

### After Any State Machine Change

- [ ] All legal transitions work (see SM-001)
- [ ] All illegal transitions rejected (see SM-002)
- [ ] FORCE_RESET from every state
- [ ] Watchdog timeouts fire correctly
- [ ] Self-healing on wake works
- [ ] "Already recording" never persists after failure
- [ ] Re-recording after failure works immediately

### After Any Media-Related Fix

- [ ] Tab capture works
- [ ] Window capture works
- [ ] Full screen capture works
- [ ] Short recording (< 5s) works
- [ ] Long recording (5+ min) works
- [ ] Stream ended detection works
- [ ] Size warning at 80% works
- [ ] Auto-stop at size limit works
- [ ] Video file plays correctly

### After Any UI Refactor

- [ ] Popup shows correct state on open
- [ ] Timer updates correctly
- [ ] Loading state shown during permission
- [ ] Recording UI only after screen selection
- [ ] Settings persist
- [ ] Error messages display
- [ ] Stop button works
- [ ] Multiple popup opens/closes work

### Quick Smoke Test (5 min)

1. [ ] Open popup, verify idle state
2. [ ] Start recording, select screen
3. [ ] Verify timer running
4. [ ] Stop recording
5. [ ] Verify video downloads
6. [ ] Start new recording immediately
7. [ ] Cancel at screen picker
8. [ ] Verify returns to idle
9. [ ] Check console for errors

---

## Appendix: Test Environment Setup

### Browser Versions to Test
- Chrome Stable (latest)
- Chrome Beta
- Chrome Canary (for early MV3 issues)

### OS Configurations
- Windows 10/11
- macOS (latest)
- Linux (Ubuntu latest)

### Display Configurations
- Single monitor
- Dual monitor
- High DPI (4K)
- Mixed DPI monitors

### Hardware Considerations
- With/without hardware video encoding
- Low memory conditions
- High CPU load conditions

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-02 | QA Team | Initial test plan |
