# TraceQA - GitHub Issues for Implementation

**Generated:** 2026-02-04  
**Source Documents:** currentRoadMap1.md, PRD.doc, FEATURES.md, PRODUCT.md, README.md  
**Status:** Ready for Issue Creation  

---

## Executive Summary

This document contains **GitHub issue drafts** for the TraceQA Chrome Extension project, organized by priority and grouped by feature area. Each issue follows the standardized template and enforces a **testing-first workflow**.

### Overview Statistics

- **Total Issues:** 42
- **Dev Tasks:** 18
- **Test Tasks:** 19
- **Refactor Tasks:** 5
- **Priority P0 (Critical):** 8
- **Priority P1 (High):** 15
- **Priority P2 (Medium):** 14
- **Priority P3 (Low):** 5

---

## Issue Organization

### Group 1: Core Media Pipeline (P0 - Critical)
Issues 1-8: Core video recording functionality

### Group 2: UI Components (P1 - High)  
Issues 9-15: User interface and controls

### Group 3: State Management (P1 - High)
Issues 16-20: State persistence and recovery

### Group 4: Testing Infrastructure (P0 - Critical)
Issues 21-28: Test coverage for existing code

### Group 5: Edge Cases & Error Handling (P2 - Medium)
Issues 29-35: Robustness and error scenarios

### Group 6: Technical Debt (P2 - Medium)
Issues 36-40: Code quality and maintainability

### Group 7: Documentation (P3 - Low)
Issues 41-42: Documentation updates

---

## Priority Order (Implementation Sequence)

### Sprint 1: Foundation & Testing (Week 1)
1. Issue #21 - Add Popup Component Tests (test)
2. Issue #22 - Add Content Script Tests (test)
3. Issue #23 - Add Integration Tests (test)
4. Issue #24 - Add Edge Case Tests (test)
5. Issue #25 - Setup Coverage Reporting (test)
6. Issue #36 - Remove Unused Dependencies (refactor)

### Sprint 2: Critical Features (Week 2)
7. Issue #1 - Implement R2 Upload Pipeline (dev)
8. Issue #2 - Add Audio Capture Support (dev)
9. Issue #26 - Test R2 Upload Pipeline (test)
10. Issue #27 - Test Audio Capture (test)
11. Issue #6 - Add Retry Mechanism for Failures (dev)

### Sprint 3: UI Enhancement (Week 3)
12. Issue #3 - Implement Video Trimming (dev)
13. Issue #4 - Implement Blur Regions (dev)
14. Issue #9 - Enhance Floating Pane Controls (dev)
15. Issue #28 - Test Video Trimming & Blur (test)
16. Issue #10 - Add Keyboard Shortcuts (dev)

### Sprint 4: Polish & Documentation (Week 4)
17. Issue #37 - Refactor Background Service Worker (refactor)
18. Issue #38 - Improve Error Messages (refactor)
19. Issue #41 - Update User Documentation (dev)
20. Issue #42 - Create Testing Documentation (dev)

---

# GitHub Issue Drafts

---

## Issue #1: Implement R2 Upload Pipeline

**Label:** `dev`  
**Priority:** `P0 - Critical`  
**Estimate:** 5 days  
**Group:** Core Media Pipeline

### Description
Implement video upload to Cloudflare R2 storage to enable cloud-based video sharing. Currently, recordings are only downloaded locally. This feature is essential for collaboration and sharing capabilities.

The upload pipeline should handle chunked uploads for large files, provide progress feedback, and gracefully handle network failures with retry logic.

### Scope
- Included:
  - R2 bucket configuration and authentication
  - Chunked upload implementation (for files >10MB)
  - Upload progress tracking
  - Pre-signed URL generation for uploads
  - Post-upload video URL generation
  - IndexedDB cleanup after successful upload
  - Background upload continuation (survives service worker restart)
  
- Excluded:
  - Video transcoding or format conversion
  - CDN caching configuration
  - Video streaming optimizations
  - Thumbnail generation

### Acceptance Criteria
- [x] R2 bucket is configured with proper CORS and permissions
- [x] Upload initiates automatically after recording stops
- [x] Large files (>10MB) are uploaded in chunks
- [x] Upload progress is displayed to user in real-time
- [x] Failed uploads are retried up to 3 times with exponential backoff
- [x] Successful upload returns shareable video URL
- [x] Local IndexedDB blob is deleted after successful upload
- [x] Upload survives service worker termination

### Testing Requirements
- [x] Unit tests for upload chunking logic
- [x] Unit tests for retry mechanism
- [x] Integration test for full upload flow
- [x] Test coverage is ≥ 95% for R2 upload module
- [x] Negative test: network failure during upload
- [x] Negative test: R2 authentication failure
- [x] Negative test: storage quota exceeded
- [x] Edge case: service worker terminates during upload

### Dependencies
- R2 bucket provisioned and credentials available
- Backend API endpoint for pre-signed URL generation
- Issue #26 (Test R2 Upload Pipeline) must be completed after

### Notes
- Use multipart upload for files >10MB
- Store upload state in chrome.storage.local for recovery
- Consider using tus protocol for resumable uploads

---

## Issue #2: Add Audio Capture Support

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 3 days  
**Group:** Core Media Pipeline

### Description
Implement microphone audio capture during video recording. The UI toggle for microphone exists but is currently non-functional. Users need the ability to narrate their recordings for better bug reports and documentation.

### Scope
- Included:
  - Request microphone permission via getUserMedia
  - Mix microphone audio with screen capture
  - Mute/unmute functionality during recording
  - Audio level indicator
  - Persist audio settings in chrome.storage
  - Handle permission denial gracefully
  
- Excluded:
  - Tab audio capture (requires different API)
  - Audio editing or noise cancellation
  - Multiple microphone selection
  - Audio-only recording mode

### Acceptance Criteria
- [x] Microphone permission is requested on first use
- [x] Audio is captured and mixed with video stream
- [x] Mute/unmute toggle works during recording
- [x] Audio level indicator shows input activity
- [x] Audio settings persist across sessions
- [x] Permission denial shows helpful error message
- [x] Recording works without audio if permission denied

### Testing Requirements
- [x] Unit tests for audio stream management
- [x] Test coverage is ≥ 95% for audio module
- [x] Manual test: verify audio in downloaded video
- [x] Negative test: permission denied
- [x] Negative test: microphone disconnected during recording
- [x] Edge case: mute/unmute rapid toggling

### Dependencies
- Issue #27 (Test Audio Capture) must be completed after

---

## Issue #3: Implement Video Trimming

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 4 days  
**Group:** Core Media Pipeline

### Description
Add video trimming capability in the post-recording preview overlay. Users should be able to remove unwanted portions from the beginning or end of their recordings before upload.

### Scope
- Included:
  - Dual-handle range slider for trim points
  - Real-time preview of trim boundaries
  - Duration display showing trimmed length
  - Apply trim before upload (server-side or client-side)
  - Quick trim presets: "Remove first 5s", "Remove last 10s"
  
- Excluded:
  - Mid-video cuts (removing sections from middle)
  - Frame-accurate trimming
  - Audio-only trimming
  - Trim undo/redo after save

### Acceptance Criteria
- [x] Trim slider appears in preview overlay
- [x] Start and end handles are independently draggable
- [x] Video preview updates when handles move
- [x] Trimmed duration is displayed
- [x] Quick trim buttons work correctly
- [x] Trim is applied before upload
- [x] Original recording is discarded after trim

### Testing Requirements
- [x] Unit tests for trim calculation logic
- [x] Test coverage is ≥ 95% for trim module
- [x] Manual test: verify trimmed video plays correctly
- [x] Edge case: trim entire video (error handling)
- [x] Edge case: trim handles at same position
- [x] Edge case: very short video (<2 seconds)

### Dependencies
- Requires preview overlay component
- Issue #28 (Test Video Trimming & Blur) must be completed after

---

## Issue #4: Implement Blur Regions

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 5 days  
**Group:** Core Media Pipeline

### Description
Implement privacy protection by allowing users to blur sensitive areas of their recordings. Users should be able to draw rectangles over parts of the video to apply Gaussian blur, both during and after recording.

### Scope
- Included:
  - Click-drag rectangle selection for blur regions
  - Real-time blur preview during recording
  - Post-recording blur region addition
  - Blur region removal (delete individual regions)
  - Blur regions stored as percentage coordinates (viewport-relative)
  - Apply blur during video processing
  
- Excluded:
  - Automatic PII detection
  - Blur region editing (resize/reposition after creation)
  - Different blur intensities
  - Blur region animation or tracking

### Acceptance Criteria
- [x] Blur button toggles blur drawing mode
- [x] Cursor changes to crosshair in blur mode
- [x] Click-drag creates blur rectangle
- [x] Blur is applied to selected region immediately
- [x] Each blur region has a delete (×) button
- [x] Blur regions survive page navigation (TAB mode)
- [x] Blur is baked into final video before upload

### Testing Requirements
- [x] Unit tests for blur region calculations
- [x] Unit tests for coordinate transformation (viewport to video)
- [x] Test coverage is ≥ 95% for blur module
- [x] Manual test: verify blur appears in final video
- [x] Edge case: blur region outside viewport
- [x] Edge case: overlapping blur regions
- [x] Edge case: blur during page scroll

### Dependencies
- Requires canvas or video processing capability
- Issue #28 (Test Video Trimming & Blur) must be completed after

---

## Issue #5: Implement Session Flags

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 3 days  
**Group:** Core Media Pipeline

### Description
Allow users to flag important moments during recording with different flag types (Issue, Success, Important, Note). Flags should appear as timeline markers in the preview overlay and dashboard.

### Scope
- Included:
  - Flag button in floating pane with type selector
  - Flag types: Issue (🐛), Success (✅), Important (⭐), Note (📝)
  - Optional text note for each flag
  - Automatic screenshot capture on flag
  - Flags displayed on timeline with icons
  - Click flag to seek video to that timestamp
  
- Excluded:
  - Flag editing after creation
  - Flag categories or custom types
  - Flag sharing or export
  - AI-generated flags

### Acceptance Criteria
- [x] Flag button opens type selector menu
- [x] Each flag type has distinct icon and color
- [x] Flag is created with current timestamp
- [x] Optional text note can be added
- [x] Screenshot is captured automatically
- [x] Flags appear on timeline in preview overlay
- [x] Clicking flag seeks video to timestamp

### Testing Requirements
- [x] Unit tests for flag creation and storage
- [x] Test coverage is ≥ 95% for flag module
- [x] Edge case: flag at same timestamp (duplicate)
- [x] Edge case: flag during pause
- [x] Edge case: 100+ flags in single session

### Dependencies
- Requires timeline component in preview overlay

---

## Issue #6: Add Retry Mechanism for Failures

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 2 days  
**Group:** Error Handling

### Description
Implement automatic retry logic for transient failures (network errors, temporary service unavailability). Currently, errors are shown but no retry is attempted, leading to poor user experience.

### Scope
- Included:
  - Exponential backoff retry strategy
  - Maximum 3 retry attempts
  - Retry for: R2 upload, API calls, IndexedDB operations
  - User feedback showing retry progress
  - Manual retry button for failed operations
  
- Excluded:
  - Retry for permission failures (non-retryable)
  - Retry for invalid data errors
  - Persistent retry queue across sessions

### Acceptance Criteria
- [x] Failed operations retry automatically up to 3 times
- [x] Retry uses exponential backoff (1s, 2s, 4s)
- [x] User sees "Retrying... (attempt 2/3)" message
- [x] Manual retry button appears after all attempts fail
- [x] Non-retryable errors skip retry logic
- [x] Retry state is logged for debugging

### Testing Requirements
- [x] Unit tests for retry logic with mocked failures
- [x] Test coverage is ≥ 95% for retry module
- [x] Negative test: all retries fail
- [x] Negative test: non-retryable error
- [x] Edge case: success on 3rd retry

---

## Issue #7: Implement Console/Network Capture

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 4 days  
**Group:** Session Capture

### Description
Capture console logs and network requests during recording sessions. This data provides crucial debugging context for bug reports.

### Scope
- Included:
  - Console capture: log, warn, error, info levels
  - Network capture: URL, method, status, timing, headers
  - Store data in IndexedDB during session
  - Display in session detail view
  - Filter by level/status in UI
  
- Excluded:
  - Request/response body capture (size concerns)
  - WebSocket capture
  - Service worker network requests
  - Live network panel (only post-recording view)

### Acceptance Criteria
- [x] Console logs are captured from content script
- [x] Network requests are captured via webRequest API
- [x] Data is stored in IndexedDB with timestamps
- [x] Console and network tabs in preview overlay
- [x] Errors show count on timeline
- [x] Filter controls work correctly
- [x] Data is included in session export

### Testing Requirements
- [x] Unit tests for data capture and storage
- [x] Test coverage is ≥ 95% for capture module
- [x] Edge case: high-frequency events (100+ per second)
- [x] Edge case: large console messages (>10KB)
- [x] Performance test: 1000+ network requests

---

## Issue #8: Implement WorkItem Model

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 5 days  
**Group:** Core Logic

### Description
Create the WorkItem data model representing bugs and test cases. WorkItems are the fundamental unit in TraceQA's workflow.

### Scope
- Included:
  - WorkItem TypeScript interfaces and types
  - Status flow state machine
  - Bug and TestCase subtypes
  - Promotion logic (Bug → TestCase)
  - CRUD operations
  - Database schema (PostgreSQL)
  
- Excluded:
  - AI enrichment pipeline
  - External integrations (Jira, Linear)
  - WorkItem templates
  - Bulk operations

### Acceptance Criteria
- [x] WorkItem type definition matches spec
- [x] Status flow is enforced by state machine
- [x] Bug type has all required fields
- [x] TestCase type has all required fields
- [x] Promotion creates new TestCase from Bug
- [x] Database schema is created
- [x] CRUD API endpoints work

### Testing Requirements
- [x] Unit tests for status flow transitions
- [x] Unit tests for promotion logic
- [x] Test coverage is ≥ 95% for WorkItem module
- [x] Edge case: invalid status transition
- [x] Edge case: promote already-promoted bug

---

## Issue #9: Enhance Floating Pane Controls

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 2 days  
**Group:** UI Components

### Description
Improve the floating control pane with better visual feedback, animations, and additional controls (flag button, mute indicator).

### Scope
- Included:
  - Improved visual design with animations
  - Flag button with type selector
  - Mute indicator (microphone icon with status)
  - Size limit warning indicator
  - Keyboard focus management
  
- Excluded:
  - Minimizable pane
  - Multiple pane instances
  - Pane settings/customization

### Acceptance Criteria
- [x] Pane design matches mockups
- [x] Animations are smooth (60fps)
- [x] Flag button opens menu correctly
- [x] Mute indicator updates in real-time
- [x] Size warning appears at 80MB
- [x] Keyboard navigation works
- [x] Visual state matches recording state

### Testing Requirements
- [x] Component tests for all controls
- [x] Visual regression tests (snapshots)
- [x] Manual test: animations are smooth
- [x] Accessibility test: keyboard navigation
- [x] Accessibility test: screen reader support

---

## Issue #10: Add Keyboard Shortcuts

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 2 days  
**Group:** UI Components

### Description
Implement keyboard shortcuts for common actions. Listener infrastructure exists but functionality is not implemented.

### Scope
- Included:
  - Start/Stop recording (Ctrl+Shift+R)
  - Pause/Resume (Ctrl+Shift+P)
  - Add flag (Ctrl+Shift+F)
  - Show/Hide floating pane (Ctrl+Shift+H)
  - Configurable shortcuts in options page
  
- Excluded:
  - Global shortcuts (outside browser)
  - Shortcut conflicts detection
  - Shortcut help overlay

### Acceptance Criteria
- [x] Default shortcuts work correctly
- [x] Shortcuts are documented
- [x] Options page allows customization
- [x] Shortcuts don't conflict with browser/page shortcuts
- [x] Shortcuts work across all recording modes
- [x] Shortcuts respect recording state

### Testing Requirements
- [x] Unit tests for shortcut handling
- [x] Manual test: all shortcuts work
- [x] Edge case: shortcut while popup is open
- [x] Edge case: shortcut on page with conflicting keys

---

## Issue #11: Create Preview Overlay Component

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 4 days  
**Group:** UI Components

### Description
Build the post-recording preview overlay that appears after stopping a recording. This is a critical UX component for reviewing and saving recordings.

### Scope
- Included:
  - Full-page modal overlay
  - Video player with controls
  - Timeline with markers
  - Comments panel
  - Trim controls
  - Blur region editor
  - Save and Share buttons
  
- Excluded:
  - Advanced video effects
  - Collaborative editing
  - Version history

### Acceptance Criteria
- [x] Overlay appears immediately after recording stops
- [x] Video plays in player
- [x] Timeline shows all markers
- [x] Comments can be added at current timestamp
- [x] Trim controls update preview
- [x] Blur editor works correctly
- [x] Save button uploads video
- [x] Share button generates link

### Testing Requirements
- [x] Component tests for all UI elements
- [x] Integration test for save flow
- [x] Visual regression tests
- [x] Manual test: full user journey
- [x] Edge case: close without saving (confirmation)
- [x] Performance test: large videos (>50MB)

---

## Issue #12: Implement Shareable Links

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 3 days  
**Group:** Collaboration

### Description
Generate shareable links for recordings that allow anyone with the link to view the session.

### Scope
- Included:
  - Short URL generation (e.g., /s/abc123)
  - Link-only access (no authentication required)
  - Optional password protection
  - Optional expiration time
  - View count tracking
  - Link revocation
  - Timestamp deep links (e.g., ?t=135)
  
- Excluded:
  - Email notifications
  - Link analytics (detailed viewer data)
  - Multiple access levels (view/edit)

### Acceptance Criteria
- [x] Share link is generated after video upload
- [x] Link uses short, URL-safe ID
- [x] Public view page displays video correctly
- [x] Password protection works (if enabled)
- [x] Expired links show appropriate message
- [x] View count increments on access
- [x] Timestamp links seek to correct position

### Testing Requirements
- [x] Unit tests for link generation
- [x] Integration test for full share flow
- [x] Test coverage is ≥ 95% for share module
- [x] Negative test: invalid share ID
- [x] Negative test: expired link
- [x] Negative test: wrong password
- [x] Edge case: same session shared multiple times

---

## Issue #13: Add Timestamped Comments

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 3 days  
**Group:** Collaboration

### Description
Allow users to add timestamped comments to recordings for collaboration with team members.

### Scope
- Included:
  - Add comment at current video timestamp
  - Edit and delete own comments
  - Display comments in sidebar
  - Show comments as markers on timeline
  - Click comment to seek video
  - Comment author display (name/avatar)
  
- Excluded:
  - Comment threading/replies
  - @mentions or notifications
  - Comment reactions
  - Rich text formatting

### Acceptance Criteria
- [x] Comment can be added at any timestamp
- [x] Comment input appears in sidebar
- [x] Comments display with timestamp and author
- [x] Clicking comment seeks video
- [x] Edit/delete buttons work for own comments
- [x] Comments appear as timeline markers
- [x] Comments persist across sessions

### Testing Requirements
- [x] Unit tests for comment operations
- [x] Test coverage is ≥ 95% for comment module
- [x] Edge case: 100+ comments on single video
- [x] Edge case: comment at timestamp 0:00
- [x] Edge case: long comment text (>1000 chars)

---

## Issue #14: Implement Recording Requests

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 4 days  
**Group:** Collaboration

### Description
Allow users to request recordings from others by creating a recording request with instructions and sharing a link.

### Scope
- Included:
  - Create request form (URL, instructions, deadline)
  - Generate unique request link
  - Request view page for recorder
  - Link session to request
  - Status tracking (Pending, In Progress, Completed)
  - Email notification when completed
  
- Excluded:
  - Multiple recorders per request
  - Request templates
  - Request approval workflow

### Acceptance Criteria
- [x] Request form validates all fields
- [x] Request link is generated
- [x] Recorder sees instructions on request page
- [x] Recorder can start recording from request page
- [x] Session is linked to request automatically
- [x] Requester is notified when completed
- [x] Request list shows status

### Testing Requirements
- [x] Unit tests for request lifecycle
- [x] Integration test for full request flow
- [x] Test coverage is ≥ 95% for request module
- [x] Edge case: expired deadline
- [x] Edge case: multiple sessions for same request

---

## Issue #15: Create Dashboard Views

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 5 days  
**Group:** UI Components

### Description
Build the main dashboard with session list, session detail, and WorkItem views.

### Scope
- Included:
  - Session list with grid/list toggle
  - Session detail view with video player
  - WorkItem list with filtering
  - WorkItem detail view
  - Navigation and routing
  - Search functionality
  
- Excluded:
  - Advanced analytics
  - Bulk operations
  - Custom views/saved filters
  - Export functionality

### Acceptance Criteria
- [x] Session list displays all user sessions
- [x] Grid/list toggle works
- [x] Clicking session opens detail view
- [x] Video player works in detail view
- [x] WorkItem list shows all items
- [x] Filter controls work correctly
- [x] Search returns relevant results

### Testing Requirements
- [x] Component tests for all views
- [x] Integration test for navigation
- [x] Visual regression tests
- [x] Performance test: 1000+ sessions
- [x] Accessibility tests

---

## Issue #16: Implement State Persistence

**Label:** `dev`  
**Priority:** `P0 - Critical`  
**Estimate:** 2 days  
**Group:** State Management

### Description
Ensure recording state persists correctly across popup close, service worker restarts, and browser restarts. This is critical for reliability.

### Scope
- Included:
  - Save FSM state to chrome.storage.local on every transition
  - Restore state on service worker wake
  - Restore state on popup open
  - Handle orphaned states (stale sessions)
  - Watchdog timer for state validation
  
- Excluded:
  - Cloud state synchronization
  - State history/undo
  - Cross-device state sync

### Acceptance Criteria
- [x] State persists across popup close
- [x] State persists across service worker restart
- [x] Orphaned states are detected and cleaned up
- [x] Watchdog timer validates state periodically
- [x] Recovery from invalid states is automatic
- [x] No state corruption from race conditions

### Testing Requirements
- [x] Unit tests for persistence logic
- [x] Integration test: popup close/open during recording
- [x] Integration test: service worker termination
- [x] Test coverage is ≥ 95% for persistence module
- [x] Edge case: state corruption
- [x] Edge case: version mismatch (migration)

---

## Issue #17: Add Service Worker Recovery

**Label:** `dev`  
**Priority:** `P0 - Critical`  
**Estimate:** 3 days  
**Group:** State Management

### Description
Implement robust service worker recovery mechanisms to handle termination and restart gracefully without losing recordings.

### Scope
- Included:
  - Detect service worker wake from termination
  - Restore FSM context from storage
  - Reconnect to offscreen document
  - Resume state broadcasts
  - Handle stale messages
  
- Excluded:
  - Prevent termination (not possible)
  - State migration between versions

### Acceptance Criteria
- [x] Service worker wake is detected
- [x] FSM context is restored correctly
- [x] Offscreen document is reconnected
- [x] Recording continues after wake
- [x] Stale messages are filtered
- [x] Recovery is logged for debugging

### Testing Requirements
- [x] Unit tests for recovery logic
- [x] Manual test: terminate and wake service worker
- [x] Test coverage is ≥ 95% for recovery module
- [x] Edge case: wake during state transition
- [x] Edge case: multiple rapid wakes

---

## Issue #18: Implement Watchdog Timer

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 2 days  
**Group:** State Management

### Description
Already implemented but needs enhancement. Add per-state timeout validation and automatic recovery for stuck states.

### Scope
- Included:
  - Per-state timeout configuration
  - Automatic state validation on timeout
  - Recovery actions for stuck states
  - Logging of watchdog events
  
- Excluded:
  - User-configurable timeouts
  - Watchdog disable option

### Acceptance Criteria
- [x] Watchdog runs on appropriate interval
- [x] Each state has configured timeout
- [x] Timeout triggers state validation
- [x] Stuck states trigger recovery
- [x] Recovery actions are appropriate per state
- [x] All events are logged

### Testing Requirements
- [x] Unit tests for watchdog logic (already exist, enhance)
- [x] Test coverage is ≥ 95%
- [x] Manual test: force stuck state
- [x] Edge case: watchdog fires during valid long operation

---

## Issue #19: Add Version Migration

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 2 days  
**Group:** State Management

### Description
Implement version migration for chrome.storage.local data when state schema changes between extension versions.

### Scope
- Included:
  - Version field in stored state
  - Migration functions for each version bump
  - Automatic migration on extension update
  - Fallback to defaults if migration fails
  
- Excluded:
  - Rollback capability
  - Cross-device migration
  - User notification of migration

### Acceptance Criteria
- [x] Version field is stored with state
- [x] Migration runs automatically on version change
- [x] All data is migrated correctly
- [x] Failed migration resets to defaults
- [x] Migration is logged

### Testing Requirements
- [x] Unit tests for each migration function
- [x] Test coverage is ≥ 95%
- [x] Manual test: install old version, update to new
- [x] Edge case: skip multiple versions

---

## Issue #20: Implement State Synchronization

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 3 days  
**Group:** State Management

### Description
Ensure all extension contexts (popup, background, content) stay synchronized with current recording state.

### Scope
- Included:
  - Broadcast state updates every 500ms
  - Subscribe to state updates in all contexts
  - Handle late subscribers (already-running recording)
  - Debounce rapid state changes
  
- Excluded:
  - Real-time synchronization (<100ms latency)
  - Peer-to-peer sync between contexts

### Acceptance Criteria
- [x] State broadcasts work from background
- [x] All contexts receive state updates
- [x] Updates are received within 500ms
- [x] Late subscribers get current state immediately
- [x] Rapid state changes are debounced
- [x] No memory leaks from listeners

### Testing Requirements
- [x] Unit tests for broadcast logic
- [x] Integration test: multiple contexts
- [x] Test coverage is ≥ 95%
- [x] Performance test: 100+ rapid state changes

---

## Issue #21: Add Popup Component Tests

**Label:** `test`  
**Priority:** `P0 - Critical`  
**Estimate:** 3 days  
**Group:** Testing Infrastructure

### Description
Create comprehensive unit and integration tests for all popup React components. Currently, popup components have 0% test coverage.

### Scope
- Included:
  - Tests for RecordingButton component
  - Tests for StatusIndicator component
  - Tests for VideoSettings component
  - Tests for RecordingInfo component
  - Tests for ErrorMessage component
  - Tests for useRecordingState hook
  - Visual regression tests with snapshots
  
- Excluded:
  - E2E tests (separate issue)
  - Performance tests
  - Accessibility tests (separate issue)

### Acceptance Criteria
- [x] All popup components have tests
- [x] useRecordingState hook has complete test coverage
- [x] Component interaction tests pass
- [x] Visual regression tests pass
- [x] Test coverage is ≥ 95% for popup module
- [x] Tests run in <10 seconds
- [x] All tests pass consistently (no flakes)

### Testing Requirements
- [x] Unit tests are added or updated
- [x] Test coverage is ≥ 95% for affected code
- [x] Negative and failure paths are covered
- [x] Edge cases: loading states, error states, disabled states
- [x] Mock chrome APIs correctly
- [x] Use @testing-library/react for component tests

---

## Issue #22: Add Content Script Tests

**Label:** `test`  
**Priority:** `P0 - Critical`  
**Estimate:** 2 days  
**Group:** Testing Infrastructure

### Description
Create tests for content script functionality, especially FloatingPane controller. Currently has 0% test coverage.

### Scope
- Included:
  - Tests for FloatingPane lifecycle
  - Tests for PING/PONG handshake
  - Tests for message forwarding
  - Tests for state updates
  - Tests for cleanup on hide
  
- Excluded:
  - React component tests (separate from controller)
  - Performance tests
  - Cross-page navigation tests (E2E)

### Acceptance Criteria
- [x] FloatingPane controller has complete test coverage
- [x] PING/PONG protocol is tested
- [x] Message routing is tested
- [x] State update handling is tested
- [x] Cleanup logic is tested
- [x] Test coverage is ≥ 95% for content module
- [x] All tests pass consistently

### Testing Requirements
- [x] Unit tests are added or updated
- [x] Test coverage is ≥ 95% for affected code
- [x] Negative and failure paths are covered
- [x] Edge cases: rapid show/hide, navigation, multiple calls
- [x] Mock chrome APIs and DOM correctly

---

## Issue #23: Add Integration Tests

**Label:** `test`  
**Priority:** `P0 - Critical`  
**Estimate:** 4 days  
**Group:** Testing Infrastructure

### Description
Create integration tests that verify end-to-end flows across multiple components. Currently no integration tests exist.

### Scope
- Included:
  - Test: Complete recording flow (start → record → stop → download)
  - Test: Pause/resume flow
  - Test: External stop flow
  - Test: State persistence across contexts
  - Test: Service worker recovery
  - Test: Upload flow (when implemented)
  
- Excluded:
  - E2E tests with real browser
  - Performance benchmarks
  - Load testing

### Acceptance Criteria
- [x] All critical flows have integration tests
- [x] Tests verify cross-component communication
- [x] Tests use realistic timing and async behavior
- [x] Tests clean up after themselves
- [x] All tests pass consistently (no flakes)
- [x] Tests run in <30 seconds total

### Testing Requirements
- [x] Integration tests are added
- [x] Tests cover positive and negative paths
- [x] Edge cases are covered
- [x] Mock external services (R2, API)
- [x] Use Vitest for test framework

---

## Issue #24: Add Edge Case Tests

**Label:** `test`  
**Priority:** `P1 - High`  
**Estimate:** 3 days  
**Group:** Testing Infrastructure

### Description
Create tests specifically for edge cases and error scenarios. These are critical for reliability but often overlooked.

### Scope
- Included:
  - Test: Rapid start/stop/start cycles
  - Test: Very short recordings (<1 second)
  - Test: Size limit edge cases (exactly 100MB)
  - Test: Permission denied scenarios
  - Test: IndexedDB quota exceeded
  - Test: Network failures during upload
  - Test: Tab close during recording
  - Test: Multiple rapid pause/resume
  
- Excluded:
  - Performance degradation tests
  - Fuzzing
  - Security testing

### Acceptance Criteria
- [x] All edge cases have explicit tests
- [x] Error scenarios are covered
- [x] Race conditions are tested
- [x] All tests pass consistently
- [x] Tests document expected behavior clearly

### Testing Requirements
- [x] Edge case tests are added
- [x] Negative paths are tested
- [x] Error handling is verified
- [x] Tests are well-documented with comments

---

## Issue #25: Setup Coverage Reporting

**Label:** `test`  
**Priority:** `P0 - Critical`  
**Estimate:** 1 day  
**Group:** Testing Infrastructure

### Description
Configure test coverage reporting and enforcement to ensure quality standards are maintained.

### Scope
- Included:
  - Configure @vitest/coverage-v8
  - Set coverage thresholds (90% minimum)
  - Generate HTML coverage reports
  - Add coverage badge to README
  - Fail CI if coverage drops below threshold
  
- Excluded:
  - Branch-specific coverage requirements
  - Coverage trend tracking over time
  - Integration with external services (Codecov)

### Acceptance Criteria
- [x] Coverage reporter is configured in vitest.config.ts
- [x] Thresholds are set: branches 90%, functions 90%, lines 90%, statements 90%
- [x] HTML reports are generated in coverage/ directory
- [x] README shows coverage badge
- [x] CI fails when coverage drops below threshold
- [x] Coverage report excludes test files and generated code

### Testing Requirements
- [x] Coverage reports generate correctly
- [x] Thresholds are enforced
- [x] Badge updates automatically

---

## Issue #26: Test R2 Upload Pipeline

**Label:** `test`  
**Priority:** `P1 - High`  
**Estimate:** 2 days  
**Group:** Testing Infrastructure

### Description
Create comprehensive tests for R2 upload functionality once it's implemented.

### Scope
- Included:
  - Unit tests for chunking logic
  - Unit tests for retry mechanism
  - Integration tests for full upload flow
  - Tests for upload progress tracking
  - Tests for IndexedDB cleanup after upload
  
- Excluded:
  - Real R2 bucket tests (use mocks)
  - Performance testing
  - Load testing

### Acceptance Criteria
- [x] All upload code has ≥95% coverage
- [x] Chunking logic is thoroughly tested
- [x] Retry logic is tested with various failure scenarios
- [x] Integration test verifies end-to-end upload
- [x] Progress tracking is tested
- [x] Cleanup is verified

### Testing Requirements
- [x] Unit tests are added
- [x] Integration tests are added
- [x] Test coverage is ≥ 95%
- [x] Negative paths are covered
- [x] Mock R2 API correctly

### Dependencies
- Issue #1 (Implement R2 Upload Pipeline) must be completed first

---

## Issue #27: Test Audio Capture

**Label:** `test`  
**Priority:** `P1 - High`  
**Estimate:** 2 days  
**Group:** Testing Infrastructure

### Description
Create tests for audio capture functionality once it's implemented.

### Scope
- Included:
  - Unit tests for audio stream management
  - Tests for mute/unmute functionality
  - Tests for audio level detection
  - Tests for permission handling
  - Integration test: audio in final video
  
- Excluded:
  - Audio quality testing
  - Real microphone tests

### Acceptance Criteria
- [x] All audio code has ≥95% coverage
- [x] Stream management is tested
- [x] Mute/unmute is tested
- [x] Permission scenarios are tested
- [x] Integration test verifies audio in output

### Testing Requirements
- [x] Unit tests are added
- [x] Test coverage is ≥ 95%
- [x] Negative paths are covered
- [x] Mock getUserMedia correctly

### Dependencies
- Issue #2 (Add Audio Capture Support) must be completed first

---

## Issue #28: Test Video Trimming & Blur

**Label:** `test`  
**Priority:** `P1 - High`  
**Estimate:** 2 days  
**Group:** Testing Infrastructure

### Description
Create tests for video trimming and blur functionality once implemented.

### Scope
- Included:
  - Unit tests for trim calculation
  - Unit tests for blur region calculations
  - Tests for coordinate transformation
  - Integration tests: trim and blur applied to video
  
- Excluded:
  - Visual quality verification
  - Performance testing

### Acceptance Criteria
- [x] All trim/blur code has ≥95% coverage
- [x] Calculation logic is thoroughly tested
- [x] Edge cases are covered
- [x] Integration tests verify output

### Testing Requirements
- [x] Unit tests are added
- [x] Test coverage is ≥ 95%
- [x] Edge cases are covered

### Dependencies
- Issue #3 (Implement Video Trimming) must be completed first
- Issue #4 (Implement Blur Regions) must be completed first

---

## Issue #29: Handle Permission Denied Gracefully

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 1 day  
**Group:** Error Handling

### Description
Improve error messaging and recovery when user denies screen capture or microphone permissions.

### Scope
- Included:
  - Clear error message explaining what went wrong
  - Instructions for granting permission
  - Link to browser settings
  - Graceful fallback (continue without audio if mic denied)
  
- Excluded:
  - Automatic permission retry
  - Custom permission dialog

### Acceptance Criteria
- [x] Permission denial shows helpful error message
- [x] Error message includes recovery instructions
- [x] Link to settings works correctly
- [x] State returns to IDLE after denial
- [x] User can retry after fixing permissions
- [x] Audio denial allows video-only recording

### Testing Requirements
- [x] Manual test: deny permissions
- [x] Test coverage is ≥ 95% for error handling
- [x] Edge case: deny after previously granting

---

## Issue #30: Handle Offscreen Document Failures

**Label:** `dev`  
**Priority:** `P1 - High`  
**Estimate:** 1 day  
**Group:** Error Handling

### Description
Handle cases where offscreen document fails to create or crashes unexpectedly.

### Scope
- Included:
  - Detect offscreen creation failure
  - Show appropriate error message
  - Automatic retry (once)
  - Fallback to error state if retry fails
  - Detect offscreen crash during recording
  
- Excluded:
  - Prevent crashes (not possible)
  - Offscreen document debugging tools

### Acceptance Criteria
- [x] Creation failure is detected
- [x] Error message is shown to user
- [x] Automatic retry is attempted
- [x] State returns to IDLE if retry fails
- [x] Crash during recording is detected
- [x] Partial recording is saved if possible

### Testing Requirements
- [x] Unit tests for error detection
- [x] Test coverage is ≥ 95%
- [x] Manual test: force offscreen failure

---

## Issue #31: Handle IndexedDB Quota Exceeded

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 1 day  
**Group:** Error Handling

### Description
Handle IndexedDB quota exceeded errors gracefully by showing clear error and suggesting solutions.

### Scope
- Included:
  - Detect quota exceeded error
  - Show error with suggested fixes
  - Link to Chrome storage management
  - Automatic cleanup of old recordings
  
- Excluded:
  - Quota monitoring/prediction
  - User-configurable quota management

### Acceptance Criteria
- [x] Quota error is detected and shown
- [x] Error message suggests clearing old recordings
- [x] Link to storage management works
- [x] Old recordings can be deleted from extension
- [x] Recording stops gracefully on quota error

### Testing Requirements
- [x] Unit test: simulate quota exceeded
- [x] Test coverage is ≥ 95%
- [x] Manual test: fill quota and record

---

## Issue #32: Handle Tab Navigation During Recording

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 2 days  
**Group:** Error Handling

### Description
Handle tab navigation during TAB mode recording by re-injecting content script and maintaining state.

### Scope
- Included:
  - Detect tab navigation (URL change)
  - Re-inject content script on new page
  - Restore FloatingPane state
  - Maintain recording session
  
- Excluded:
  - Prevent navigation
  - Track navigation history
  - Capture navigation timing

### Acceptance Criteria
- [x] Navigation is detected
- [x] Content script is re-injected automatically
- [x] FloatingPane reappears with correct state
- [x] Recording continues without interruption
- [x] No duplicate script injection

### Testing Requirements
- [x] Integration test: navigate during recording
- [x] Test coverage is ≥ 95%
- [x] Edge case: rapid navigation
- [x] Edge case: navigation to restricted page (chrome://)

---

## Issue #33: Handle Chrome Crash/Force Quit

**Label:** `dev`  
**Priority:** `P3 - Low`  
**Estimate:** 2 days  
**Group:** Error Handling

### Description
Document limitations and handle best-effort recovery when Chrome crashes or is force-quit during recording.

### Scope
- Included:
  - Detect incomplete session on next launch
  - Offer recovery attempt
  - Mark session as incomplete if not recoverable
  - Clear IndexedDB of corrupt data
  
- Excluded:
  - Prevent data loss (not possible)
  - Cloud backup during recording

### Acceptance Criteria
- [x] Incomplete session is detected on launch
- [x] Recovery is attempted automatically
- [x] User is notified of recovery result
- [x] Corrupt data is cleaned up
- [x] Extension continues to work after recovery

### Testing Requirements
- [x] Manual test: force quit during recording
- [x] Test coverage for recovery logic ≥ 95%

---

## Issue #34: Add Loading States for All Actions

**Label:** `dev`  
**Priority:** `P2 - Medium`  
**Estimate:** 2 days  
**Group:** UX Improvements

### Description
Add proper loading indicators for all async actions to improve user experience.

### Scope
- Included:
  - Loading spinner for start recording
  - Loading state for stop recording
  - Upload progress indicator
  - Disable buttons during loading
  - Timeout indicators for long operations
  
- Excluded:
  - Skeleton screens
  - Optimistic UI updates

### Acceptance Criteria
- [x] All async actions show loading state
- [x] Buttons are disabled during operations
- [x] Spinners appear within 100ms
- [x] Loading states have timeout (show error after 30s)
- [x] Loading text describes current action

### Testing Requirements
- [x] Component tests verify loading states
- [x] Manual test: all actions show loading
- [x] Edge case: extremely slow network

---

## Issue #35: Improve Error Messages

**Label:** `refactor`  
**Priority:** `P2 - Medium`  
**Estimate:** 2 days  
**Group:** Technical Debt

### Description
Improve error messages throughout the extension to be more user-friendly and actionable.

### Scope
- Included:
  - Audit all error messages
  - Rewrite with clear language
  - Add suggested actions
  - Include error codes for debugging
  - Consistent error message format
  
- Excluded:
  - Automatic error reporting
  - Error message translations

### Acceptance Criteria
- [x] All error messages are audited
- [x] Error messages are clear and actionable
- [x] Each error has suggested fix
- [x] Error codes are included
- [x] Format is consistent
- [x] Technical jargon is minimized

### Testing Requirements
- [x] Manual review of all error paths
- [x] User feedback on error clarity

---

## Issue #36: Remove Unused Dependencies

**Label:** `refactor`  
**Priority:** `P1 - High`  
**Estimate:** 1 day  
**Group:** Technical Debt

### Description
Remove unused dependencies (@webext-core/messaging, idb) to reduce bundle size and eliminate confusion.

### Scope
- Included:
  - Identify all unused dependencies
  - Remove from package.json
  - Remove any unused imports
  - Update documentation
  - Verify build still works
  
- Excluded:
  - Dev dependencies cleanup
  - Transitive dependency optimization

### Acceptance Criteria
- [x] @webext-core/messaging is removed (not used)
- [x] idb is removed (using native IndexedDB)
- [x] No unused imports remain
- [x] Build succeeds
- [x] All tests pass
- [x] Bundle size is reduced

### Testing Requirements
- [x] All tests pass after removal
- [x] Build verification
- [x] Manual smoke test

---

## Issue #37: Refactor Background Service Worker

**Label:** `refactor`  
**Priority:** `P2 - Medium`  
**Estimate:** 3 days  
**Group:** Technical Debt

### Description
Break down the 954-line background/index.ts into smaller, more maintainable modules.

### Scope
- Included:
  - Extract message routing to separate module
  - Extract offscreen lifecycle to separate module
  - Extract content script injection to separate module
  - Extract storage operations to separate module
  - Keep FSM module as-is (already well-structured)
  
- Excluded:
  - Rewrite FSM (already good)
  - Change message contracts
  - Introduce new patterns

### Acceptance Criteria
- [x] background/index.ts is <300 lines
- [x] Message routing is in separate module
- [x] Offscreen lifecycle is in separate module
- [x] Content script injection is in separate module
- [x] Storage operations are in separate module
- [x] All functionality remains the same
- [x] All tests pass

### Testing Requirements
- [x] All existing tests pass
- [x] Test coverage remains ≥ 95%
- [x] No behavioral changes

---

## Issue #38: Add Structured Logging

**Label:** `refactor`  
**Priority:** `P2 - Medium`  
**Estimate:** 2 days  
**Group:** Technical Debt

### Description
Replace ad-hoc console.log statements with structured logging for better debugging.

### Scope
- Included:
  - Create logger utility with log levels
  - Add context to log messages
  - Include timestamps
  - Add log filtering
  - Enable/disable logs via options
  
- Excluded:
  - Remote logging
  - Log aggregation
  - Log analytics

### Acceptance Criteria
- [x] Logger utility is created
- [x] Log levels: debug, info, warn, error
- [x] All console.log replaced with logger
- [x] Logs include context (component, action)
- [x] Logs include timestamps
- [x] Logs can be filtered by level
- [x] Logs can be disabled in production

### Testing Requirements
- [x] Unit tests for logger utility
- [x] Manual test: logs appear in console
- [x] Manual test: filtering works

---

## Issue #39: Add TypeScript Strict Mode

**Label:** `refactor`  
**Priority:** `P3 - Low`  
**Estimate:** 2 days  
**Group:** Technical Debt

### Description
Enable TypeScript strict mode and fix all resulting type errors for better type safety.

### Scope
- Included:
  - Enable strict mode in tsconfig.json
  - Fix all type errors
  - Add missing type annotations
  - Remove any types
  
- Excluded:
  - Rewrite existing code
  - Add runtime type checking

### Acceptance Criteria
- [x] Strict mode is enabled
- [x] All type errors are fixed
- [x] No any types remain (except where necessary)
- [x] Build succeeds
- [x] All tests pass

### Testing Requirements
- [x] TypeScript compilation succeeds
- [x] All tests pass

---

## Issue #40: Optimize Bundle Size

**Label:** `refactor`  
**Priority:** `P3 - Low`  
**Estimate:** 2 days  
**Group:** Technical Debt

### Description
Analyze and optimize bundle size to improve extension load time and performance.

### Scope
- Included:
  - Run bundle analyzer
  - Identify large dependencies
  - Use dynamic imports where appropriate
  - Remove dead code
  - Optimize React imports
  
- Excluded:
  - Minification (already done by Webpack)
  - Code splitting for background worker
  - Tree shaking improvements

### Acceptance Criteria
- [x] Bundle size is analyzed
- [x] Large dependencies are identified
- [x] Dynamic imports are used for rarely-used code
- [x] Dead code is removed
- [x] React imports are optimized
- [x] Bundle size is reduced by at least 20%

### Testing Requirements
- [x] Build verification
- [x] All tests pass
- [x] Manual smoke test
- [x] Load time measurement

---

## Issue #41: Update User Documentation

**Label:** `dev`  
**Priority:** `P3 - Low`  
**Estimate:** 2 days  
**Group:** Documentation

### Description
Create comprehensive user-facing documentation for the extension including user guide, FAQ, and troubleshooting.

### Scope
- Included:
  - User guide with screenshots
  - FAQ for common questions
  - Troubleshooting guide
  - Keyboard shortcuts reference
  - Privacy policy
  
- Excluded:
  - Video tutorials
  - Interactive guides
  - Translations

### Acceptance Criteria
- [x] User guide is complete with screenshots
- [x] FAQ covers common scenarios
- [x] Troubleshooting guide addresses known issues
- [x] Keyboard shortcuts are documented
- [x] Privacy policy is clear
- [x] Documentation is accessible from extension

### Testing Requirements
- [x] Documentation is reviewed for accuracy
- [x] Links work correctly
- [x] Screenshots are up-to-date

---

## Issue #42: Create Testing Documentation

**Label:** `dev`  
**Priority:** `P3 - Low`  
**Estimate:** 1 day  
**Group:** Documentation

### Description
Document testing approach, conventions, and guidelines for contributors.

### Scope
- Included:
  - Testing philosophy
  - How to run tests
  - How to write tests
  - Mocking guidelines
  - Coverage requirements
  
- Excluded:
  - Detailed test examples (in code)
  - Testing tools comparison

### Acceptance Criteria
- [x] Testing documentation is complete
- [x] Examples are provided
- [x] Guidelines are clear
- [x] Coverage requirements are documented
- [x] Mocking approach is explained

### Testing Requirements
- [x] Documentation is reviewed by team

---

# Testing Gaps Analysis

## High-Risk Areas Requiring Additional Testing

### 1. Race Conditions
- **Risk:** Multiple async operations could interfere
- **Missing Tests:**
  - Rapid start/stop/start cycles
  - Concurrent message handling
  - Parallel state updates from different contexts
- **Recommendation:** Add stress tests with timing manipulation

### 2. Edge Cases in MediaRecorder
- **Risk:** Browser API behavior varies
- **Missing Tests:**
  - Very short recordings (<100ms)
  - Extremely long recordings (near timeout)
  - Unusual resolutions or framerates
- **Recommendation:** Add browser compatibility tests

### 3. Content Script Lifecycle
- **Risk:** Complex injection and cleanup logic
- **Missing Tests:**
  - Multiple rapid injections
  - Script injection on restricted pages
  - Shadow DOM conflicts
- **Recommendation:** Add comprehensive content script tests (Issue #22)

### 4. Storage Corruption
- **Risk:** Power loss or crash during write
- **Missing Tests:**
  - Partial writes to chrome.storage
  - IndexedDB transaction failures
  - Version mismatch after update
- **Recommendation:** Add storage corruption recovery tests

### 5. Network Failures
- **Risk:** Upload failures affect user experience
- **Missing Tests:**
  - Various HTTP error codes
  - Timeout scenarios
  - Retry exhaustion
- **Recommendation:** Add network failure simulation tests (Issue #26)

---

# Traceability Matrix

## Feature → Issue Mapping

| Feature | Development Issue | Test Issue | Refactor Issue |
|---------|-------------------|------------|----------------|
| R2 Upload | #1 | #26 | - |
| Audio Capture | #2 | #27 | - |
| Video Trimming | #3 | #28 | - |
| Blur Regions | #4 | #28 | - |
| Session Flags | #5 | - | - |
| Retry Mechanism | #6 | #24 | - |
| Console/Network Capture | #7 | - | - |
| WorkItem Model | #8 | - | - |
| Floating Pane | #9 | #22 | - |
| Keyboard Shortcuts | #10 | #24 | - |
| Preview Overlay | #11 | #23 | - |
| Shareable Links | #12 | #23 | - |
| Timestamped Comments | #13 | - | - |
| Recording Requests | #14 | - | - |
| Dashboard Views | #15 | - | - |
| State Persistence | #16 | #23 | - |
| Service Worker Recovery | #17 | #23 | - |
| Watchdog Timer | #18 | - | - |
| Version Migration | #19 | - | - |
| State Synchronization | #20 | #23 | - |
| Popup Components | - | #21 | - |
| Integration Tests | - | #23 | - |
| Edge Cases | - | #24 | - |
| Coverage Reporting | - | #25 | - |
| Permission Handling | #29 | #24 | - |
| Offscreen Failures | #30 | #24 | - |
| IndexedDB Quota | #31 | #24 | - |
| Tab Navigation | #32 | #24 | - |
| Crash Recovery | #33 | - | - |
| Loading States | #34 | - | - |
| Error Messages | #35 | - | - |
| Unused Dependencies | - | - | #36 |
| Background Refactor | - | - | #37 |
| Structured Logging | - | - | #38 |
| TypeScript Strict | - | - | #39 |
| Bundle Optimization | - | - | #40 |
| User Documentation | #41 | - | - |
| Testing Documentation | #42 | - | - |

---

# Issue Creation Instructions

## Using GitHub CLI (gh)

```bash
# Authenticate (if not already)
gh auth login

# Create issues from this document
# For each issue, run:
gh issue create \
  --title "Issue Title Here" \
  --body "$(cat issue_body.md)" \
  --label "dev" \
  --label "P0-Critical" \
  --assignee "your-username"

# Example for Issue #1:
gh issue create \
  --title "Implement R2 Upload Pipeline" \
  --body "$(cat issue_01_body.md)" \
  --label "dev" \
  --label "P0-Critical"
```

## Using GitHub Web UI

1. Navigate to repository: https://github.com/bobb-Rob/trace-qa-2nd/issues
2. Click "New Issue"
3. Copy title from this document
4. Copy issue body (Description through Dependencies)
5. Add appropriate labels (dev/test/refactor, priority)
6. Click "Submit new issue"
7. Repeat for all 42 issues

## Bulk Creation Script

A script has been prepared to create all issues programmatically. See `/scripts/create_issues.sh` for automation.

---

# Appendix A: Label Definitions

## Task Type Labels

| Label | Description | Color |
|-------|-------------|-------|
| `dev` | New implementation or feature completion | `#0E8A16` (green) |
| `test` | Unit, integration, or edge-case testing | `#1D76DB` (blue) |
| `refactor` | Cleanup, restructuring, or technical debt | `#FBCA04` (yellow) |

## Priority Labels

| Label | Description | Color |
|-------|-------------|-------|
| `P0-Critical` | Release blockers, must be completed first | `#D73A4A` (red) |
| `P1-High` | Important features, should be completed soon | `#E99695` (light red) |
| `P2-Medium` | Nice-to-have improvements | `#FEF2C0` (light yellow) |
| `P3-Low` | Low priority, can be deferred | `#C5DEF5` (light blue) |

## Status Labels (Optional)

| Label | Description |
|-------|-------------|
| `in-progress` | Currently being worked on |
| `blocked` | Blocked by dependencies |
| `needs-review` | Ready for code review |
| `needs-testing` | Ready for QA testing |

---

# Appendix B: Issue Dependencies Graph

```
Critical Path (Must Complete First):
#21 (Popup Tests) ─┐
#22 (Content Tests) ├─→ #25 (Coverage) ─→ Sprint 1 Complete
#36 (Remove Deps) ─┘

Feature Development Path:
#1 (R2 Upload) ──→ #26 (Test R2)
#2 (Audio) ──→ #27 (Test Audio)
#3 (Trim) ─┐
#4 (Blur) ─┴→ #28 (Test Trim/Blur)

Testing Path:
#23 (Integration Tests) depends on most dev issues
#24 (Edge Cases) can run parallel

Refactoring Path (Low Risk):
#37 (Refactor Background) - independent
#38 (Logging) - independent
#39 (Strict Mode) - independent
#40 (Bundle Size) - independent
```

---

**Document End**

*This document is ready for issue creation. All 42 issues follow the standardized template and enforce testing-first workflow.*
