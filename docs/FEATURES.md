# TraceQA Feature Specifications

Complete feature specifications for the TraceQA platform. This document is the **source of truth** for all features.

---

## Feature Overview

| Category | Features | Status |
|----------|----------|--------|
| **Video Capture** | Tab/Desktop recording, audio, blur, trim | Planned |
| **Session Capture** | Events, console, network, screenshots, flags | Partial |
| **Collaboration** | Comments, sharing, request recording | Planned |
| **WorkItems** | Bug/TestCase model, status flow, promotion | Partial |
| **Test Generation** | Playwright/Cypress code generation | Planned |
| **Integrations** | Jira, Linear, GitHub | Planned |
| **AI Pipeline** | Enrichment, summary, step generation | Planned |

---

## 1. Video Capture

### 1.1 Recording Modes

| Mode | Description | Implementation |
|------|-------------|----------------|
| **Record Tab** | Capture current browser tab using `getDisplayMedia()` | MediaRecorder API |
| **Record Desktop** | Capture entire screen or window | MediaRecorder API |
| **No Video** | Events-only capture (existing behavior) | Content script |

**User Selection**: Dropdown in extension popup before capture starts.

### 1.2 Video Quality

| Quality | Resolution | Bitrate | Frame Rate | ~Size/min |
|---------|------------|---------|------------|-----------|
| **SD** | 854×480 | 1 Mbps | 24 fps | 3 MB |
| **HD** | 1280×720 | 2.5 Mbps | 30 fps | 5 MB |

**Max Duration**: 30 minutes (with warning at 25 min)

### 1.3 Audio Capture

| Source | Description | Implementation |
|--------|-------------|----------------|
| **Microphone** | User narration | `getUserMedia({ audio: true })` |
| **None** | Silent recording | Default |

**Note**: Tab audio capture is not included in MVP.

### 1.4 Floating Recording Pane

During recording, a draggable floating pane appears at bottom-center:

```
┌─────────────────────────────────────────────────────────────────────┐
│   🔴 02:15:34   │  ⏸️ Pause  │  ⏹️ Stop  │  🎤 │  🔲 Blur  │  ⋮  │
└─────────────────────────────────────────────────────────────────────┘
```

**Controls**:
| Control | Function |
|---------|----------|
| Timer | Elapsed time with pulsing red indicator |
| Pause/Resume | Toggle recording pause |
| Stop | End recording, open preview overlay |
| Audio Mute | Toggle microphone on/off |
| Blur | Enter blur drawing mode |
| Menu | Discard, settings, help |

**Behavior**:
- Draggable to any position
- Always visible (not minimizable)
- Persists across page navigations
- Z-index: maximum (above all page content)

### 1.5 Blur Feature

**Purpose**: Protect sensitive information (passwords, PII, etc.)

**Selection Method**: Draw rectangles on screen

**Blur Effect**: Gaussian blur (frosted glass)

**Timing**: Both real-time during recording AND post-recording

**Workflow**:
1. Click blur button on floating pane
2. Cursor changes to crosshair
3. Click-drag to draw rectangle
4. Area is immediately blurred
5. Small × button to remove region
6. Click "Done" to exit blur mode

**Data Structure**:
```typescript
interface BlurRegion {
  id: string;
  x: number;      // % of viewport
  y: number;      // % of viewport
  width: number;  // % of viewport
  height: number; // % of viewport
  createdAt: number;
}
```

### 1.6 Video Trimming

**Available**: In post-recording preview overlay

**Controls**:
- Dual-handle range slider for start/end
- Quick trim buttons: "First 5 seconds", "Last 10 seconds"
- Preview of trimmed duration

**Implementation**: Applied before upload using canvas compositing or server-side FFmpeg.

---

## 2. Post-Recording Preview

### 2.1 Overlay Layout

Full-page dark overlay with centered modal (~900×700px):

```
┌─────────────────────────────────────────────────────────────────────┐
│  Recording Preview                                             [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │ Comments                    │  │
│  │      VIDEO PLAYER           │  │                             │  │
│  │                             │  │ @ 0:32 "Bug is here"   [×]  │  │
│  │  ▶️ ━━━●━━━━━━ 02:15/05:30  │  │ @ 1:45 "Form error"    [×]  │  │
│  │                             │  │                             │  │
│  └─────────────────────────────┘  │ [Add comment at 2:15...]    │  │
│                                   └─────────────────────────────┘  │
│  Timeline                                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 0:00    1:00    2:00    3:00    4:00    5:00    5:30        │  │
│  │   ●       🚩      ●       🚩                                 │  │
│  │ Legend: ● Error  🚩 Flag                                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Trim: [|━━━━━━━━━━━━━━━━━━━━━━━━|] 0:00 - 5:30                   │
│                                                                     │
│  [+ Add Blur Region]                                               │
│                                                                     │
│       [ 🔗 Share Link ]              [ 💾 Save & Copy Link ]       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Components

| Component | Function |
|-----------|----------|
| Video Player | Preview recording with play/pause/seek |
| Timeline | Visual markers for errors and flags |
| Comments | Add timestamped comments before saving |
| Trim Controls | Remove beginning/end of recording |
| Blur Editor | Add additional blur regions |
| Share Link | Auto-save then generate shareable link |
| Save & Copy | Save session, copy link, open dashboard |

### 2.3 Timeline Markers

| Marker | Icon | Color | Source |
|--------|------|-------|--------|
| Error | ● | Red | Console errors |
| Flag | 🚩 | Yellow | User-flagged moments |

**Interaction**: Click marker to seek video to that moment.

### 2.4 Save Flow

**"Share Link" Button**:
1. Show loading state
2. Upload video to R2
3. Create session in database
4. Generate share link
5. Copy to clipboard
6. Show confirmation

**"Save & Copy Link" Button**:
1. Apply video trimming
2. Apply blur regions
3. Upload video to R2
4. Create session with all data
5. Generate share link
6. Copy to clipboard
7. Close overlay
8. Open session in dashboard (new tab)

### 2.5 Close Without Saving

Confirmation dialog:
```
"Discard this recording?"

Your recording has not been saved.
This action cannot be undone.

[Cancel]        [Discard]
```

---

## 3. Session Capture

### 3.1 Captured Data

| Data Type | Description | Storage |
|-----------|-------------|---------|
| **Events** | Click, input, navigation, scroll | PostgreSQL (JSON) |
| **Console Logs** | log, warn, error, info | PostgreSQL (JSON) |
| **Network Requests** | URL, method, status, timing, body | PostgreSQL (JSON) |
| **Screenshots** | Auto on error, manual via flag | PostgreSQL (base64) |
| **DOM Snapshots** | HTML at key moments | PostgreSQL (JSON) |
| **Session Flags** | User-marked moments | PostgreSQL (JSON) |
| **Video** | Full recording | Cloudflare R2 |

### 3.2 Session Flags

Users can flag moments during recording:

| Flag Type | Icon | Purpose |
|-----------|------|---------|
| Issue | 🐛 | Mark where something went wrong |
| Success | ✅ | Mark expected behavior working |
| Important | ⭐ | Highlight key moment |
| Note | 📝 | Add text annotation |

**Data Structure**:
```typescript
interface SessionFlag {
  id: string;
  timestamp: number;
  type: 'issue' | 'success' | 'important' | 'note';
  note: string | null;
  screenshotId: string | null;
  domSnapshotId: string | null;
}
```

### 3.3 Capture Intent

User selects intent before capture:

| Intent | Description | WorkItem Type |
|--------|-------------|---------------|
| Bug Report | Capturing a bug/issue | BUG |
| Test Case | Recording expected behavior | TEST_CASE |
| Explore | General exploration, decide later | null |

---

## 4. Collaboration

### 4.1 Timestamped Comments

**Purpose**: Allow team collaboration on session recordings.

**Features**:
- Add comments at specific video timestamps
- Click comment to seek video
- Edit/delete own comments
- Comments shown as markers on timeline

**Data Structure**:
```typescript
interface SessionComment {
  id: string;
  sessionId: string;
  timestamp: number;      // Video time in ms
  content: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 Sharing

**Share Link Format**:
```
https://app.traceqa.io/s/{shareId}
https://app.traceqa.io/s/{shareId}?t=135  (with timestamp)
```

**Features**:
| Feature | Description |
|---------|-------------|
| Link-only access | Anyone with link can view |
| Password protection | Requires password to view |
| Expiration | Auto-expire after set time |
| View tracking | Count of link accesses |
| Timestamp links | Deep link to specific moment |
| Revocation | Delete share link |

**Data Structure**:
```typescript
interface ShareLink {
  id: string;
  shareId: string;        // Short URL-safe ID
  sessionId: string;
  visibility: 'LINK_ONLY' | 'PASSWORD';
  password: string | null; // Hashed
  expiresAt: Date | null;
  viewCount: number;
  createdBy: string | null;
  createdAt: Date;
}
```

### 4.3 Request Recording

**Purpose**: Allow users to request recordings from others.

**Flow**:
1. Requester creates request with URL, instructions, deadline
2. System generates unique request link
3. Requester shares link with recorder
4. Recorder clicks link, sees instructions
5. Recorder captures session (linked to request)
6. Requester notified when complete

**Data Structure**:
```typescript
interface RecordingRequest {
  id: string;
  requestId: string;      // Short URL-safe ID
  title: string;
  description: string | null;
  targetUrl: string;
  instructions: string | null;
  requesterId: string | null;
  requesterEmail: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  deadline: Date | null;
  sessions: Session[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. WorkItems

### 5.1 WorkItem Model

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (cuid) |
| type | enum | BUG or TEST_CASE |
| status | enum | Status in workflow |
| title | string | Short description |
| description | string | Detailed description |
| expectedBehavior | string | What should happen |
| actualBehavior | string | What actually happened (bugs) |
| steps | Step[] | Reproduction/test steps |
| evidence | Evidence | Screenshots, video, logs |
| environment | Environment | Browser, OS, viewport |
| sessionId | string? | Linked session |
| parentId | string? | Parent WorkItem (for promotion) |

### 5.2 Status Flow

```
DRAFT → CAPTURED/AUTHORED/IMPORTED → PROCESSING → READY → EXPORTED/PROMOTED/ARCHIVED
```

| Status | Description |
|--------|-------------|
| DRAFT | Created but incomplete |
| CAPTURED | Created from session capture |
| AUTHORED | Manually written |
| IMPORTED | Imported from external source |
| PROCESSING | AI enrichment in progress |
| READY | Complete and actionable |
| EXPORTED | Sent to issue tracker |
| PROMOTED | Bug converted to test case |
| ARCHIVED | Closed or stale |

### 5.3 Bug → Test Case Promotion

A Bug WorkItem can be **promoted** to a Test Case:

1. User clicks "Promote to Test Case"
2. System copies relevant fields
3. `actualBehavior` → `expectedBehavior`
4. Steps converted to test steps with assertions
5. New TEST_CASE WorkItem created
6. Parent link maintained for traceability

---

## 6. Test Generation

### 6.1 Supported Frameworks

| Framework | Format | Priority |
|-----------|--------|----------|
| Playwright | TypeScript | P0 |
| Cypress | TypeScript | P1 |

### 6.2 Generation Flow

```
Session Data + Video
       │
       ▼
┌─────────────────┐
│ Event Analysis  │  Identify user actions
└────────┬────────┘
         ▼
┌─────────────────┐
│ Selector Gen    │  Generate stable selectors
└────────┬────────┘
         ▼
┌─────────────────┐
│ Assertion Gen   │  Infer expected outcomes
└────────┬────────┘
         ▼
┌─────────────────┐
│ Code Generation │  Output framework-specific code
└────────┬────────┘
         ▼
   Test Code (Playwright/Cypress)
```

### 6.3 Video-Enhanced Features

With video, test generation can:
- **Visual assertions**: Take screenshots at assertion points
- **Stable selectors**: See actual UI state for better selectors
- **Timing**: Understand wait requirements from video
- **Edge cases**: Detect loading states, animations

---

## 7. Dashboard Features

### 7.1 Session Views

| View | Description |
|------|-------------|
| Session List | Grid/list of captured sessions with thumbnails |
| Session Detail | Video player + timeline + events + comments |
| Public Share View | Simplified view for shared links |

### 7.2 WorkItem Views

| View | Description |
|------|-------------|
| WorkItem List | Filterable list of bugs and test cases |
| WorkItem Detail | Edit interface with evidence display |
| Bug Report | Shareable formatted bug report |

### 7.3 Video Player Features

| Feature | Description |
|---------|-------------|
| Play/Pause | Standard playback controls |
| Seek | Click timeline or drag scrubber |
| Playback Speed | 0.5x, 1x, 1.5x, 2x |
| Fullscreen | Expand to full screen |
| Picture-in-Picture | Float player while navigating |
| Keyboard Shortcuts | Space=play, arrows=seek |

### 7.4 Timeline Features

| Feature | Description |
|---------|-------------|
| Marker Display | Visual dots for events/errors/flags |
| Color Coding | Different colors by marker type |
| Click to Seek | Jump video to marker time |
| Zoom | Adjust timeline density |
| Tooltip | Hover for marker details |

---

## 8. API Endpoints

### 8.1 Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions` | Create session |
| GET | `/api/v1/sessions/:id` | Get session |
| GET | `/api/v1/sessions` | List sessions |
| DELETE | `/api/v1/sessions/:id` | Delete session |
| GET | `/api/v1/sessions/:id/timeline` | Get timeline markers |

### 8.2 Video

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions/:id/video/init` | Get upload URL |
| PUT | `/api/v1/sessions/:id/video/complete` | Mark upload complete |
| GET | `/api/v1/sessions/:id/video` | Get video details |
| DELETE | `/api/v1/sessions/:id/video` | Delete video |

### 8.3 Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions/:id/comments` | Add comment |
| GET | `/api/v1/sessions/:id/comments` | List comments |
| PATCH | `/api/v1/sessions/:id/comments/:cid` | Update comment |
| DELETE | `/api/v1/sessions/:id/comments/:cid` | Delete comment |

### 8.4 Sharing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions/:id/share` | Create share link |
| GET | `/api/v1/share/:shareId` | Get shared session (public) |
| POST | `/api/v1/share/:shareId/verify` | Verify password |
| DELETE | `/api/v1/sessions/:id/share/:sid` | Revoke share link |

### 8.5 Recording Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/recording-requests` | Create request |
| GET | `/api/v1/recording-requests/:id` | Get request (public) |
| GET | `/api/v1/recording-requests` | List own requests |
| POST | `/api/v1/recording-requests/:id/sessions` | Link session |
| PATCH | `/api/v1/recording-requests/:id/status` | Update status |

### 8.6 WorkItems

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/workitems` | Create WorkItem |
| GET | `/api/v1/workitems/:id` | Get WorkItem |
| GET | `/api/v1/workitems` | List WorkItems |
| PATCH | `/api/v1/workitems/:id` | Update WorkItem |
| POST | `/api/v1/workitems/:id/promote` | Promote to test case |
| POST | `/api/v1/workitems/from-session` | Create from session |

---

## 9. Future Features (Not MVP)

### 9.1 Share Last Minute

**Purpose**: Capture last 60 seconds without starting recording first.

**Implementation**: Rolling buffer that continuously records, user can "share last minute" at any time.

**Status**: Planned for future phase.

### 9.2 Tab Audio

**Purpose**: Capture sound from browser tab (videos, audio players).

**Status**: Planned for future phase.

### 9.3 Backend Integrations

**Purpose**: Correlate with backend error tracking (Sentry, etc.).

**Status**: Planned for future phase.

### 9.4 Team Workspaces

**Purpose**: Team-based organization with permissions.

**Status**: Planned for Phase 4.

---

## Related Documentation

- [PRODUCT.md](PRODUCT.md) — Product vision
- [ARCHITECTURE.md](ARCHITECTURE.md) — Technical architecture
- [DEVELOPMENT_PLAN.md](../implementation/DEVELOPMENT_PLAN.md) — Implementation phases
