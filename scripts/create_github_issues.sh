#!/bin/bash

set -e

REPO="bobb-Rob/trace-qa-2nd"

if ! command -v gh &> /dev/null; then
  echo "GitHub CLI (gh) is not installed."
  exit 1
fi

if ! gh auth status &> /dev/null; then
  gh auth login
fi

TMP_DIR="$(mktemp -d)"
trap "rm -rf $TMP_DIR" EXIT

create_issue () {
  local title="$1"
  local label="$2"
  local priority="$3"
  local body="$4"

  echo "Creating: $title"

  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body-file "$body" \
    --label "$label" \
    --label "$priority"

  sleep 1
}

# -------------------------
# Issue 1
# -------------------------
cat > "$TMP_DIR/issue_01.md" << 'EOF'
### Description
Implement microphone audio capture during video recording. The UI toggle for microphone exists but is currently non-functional. Users need the ability to narrate their recordings for better bug reports and documentation.

Audio should come first before R2 upload as it's a fundamental recording capability that users will expect.

### Scope
- Included:
  - Request microphone permission via getUserMedia
  - Mix microphone audio with screen capture
  - Mute/unmute functionality
  - Audio level indicator
  - Persist audio settings
  - Graceful permission denial handling

- Excluded:
  - Tab audio capture
  - Audio editing
  - Multiple microphones

### Acceptance Criteria
- Microphone permission requested on first use
- Audio mixed with video stream
- Mute/unmute works during recording
- Settings persist across sessions
- Recording works without audio if denied

### Testing Requirements
- Unit tests for audio stream handling
- Integration test: audio present in final video
- Negative tests for permission denial
- Coverage ≥ 95%
EOF

create_issue "Add Audio Capture Support" "dev" "P0-Critical" "$TMP_DIR/issue_01.md"

# -------------------------
# Issue 2
# -------------------------
cat > "$TMP_DIR/issue_02.md" << 'EOF'
### Description
Implement video upload to Cloudflare R2 storage with chunked uploads, retry logic, and progress feedback.

### Scope
- Included:
  - R2 auth and configuration
  - Chunked uploads (>10MB)
  - Progress tracking
  - Retry with exponential backoff
  - Resume after service worker restart

- Excluded:
  - Transcoding
  - CDN optimizations

### Acceptance Criteria
- Upload starts automatically after recording
- Chunked uploads for large files
- Retry up to 3 times
- Shareable URL returned
- Local data cleaned up

### Testing Requirements
- Unit tests for chunking & retries
- Integration test for full upload
- Network failure tests
- Coverage ≥ 95%
EOF

create_issue "Implement R2 Upload Pipeline" "dev" "P0-Critical" "$TMP_DIR/issue_02.md"

# -------------------------
# Issue 3
# -------------------------
cat > "$TMP_DIR/issue_03.md" << 'EOF'
### Description
Allow users to trim video start and end points before upload.

### Scope
- Included:
  - Dual-handle trim slider
  - Duration preview
  - Apply trim before upload

- Excluded:
  - Mid-video cuts

### Acceptance Criteria
- Trim controls visible in preview
- Trimmed video plays correctly

### Testing Requirements
- Unit tests for trim logic
- Edge cases for short videos
- Coverage ≥ 95%
EOF

create_issue "Implement Video Trimming" "dev" "P1-High" "$TMP_DIR/issue_03.md"

# -------------------------
# Issue 4
# -------------------------
cat > "$TMP_DIR/issue_04.md" << 'EOF'
### Description
Allow users to blur sensitive areas in recordings.

### Scope
- Included:
  - Draw blur rectangles
  - Apply blur to final video

- Excluded:
  - Automatic detection

### Acceptance Criteria
- Blur applied correctly
- Multiple regions supported

### Testing Requirements
- Unit tests for coordinate mapping
- Performance tests
- Coverage ≥ 95%
EOF

create_issue "Implement Blur Regions" "dev" "P1-High" "$TMP_DIR/issue_04.md"

# -------------------------
# Issue 5
# -------------------------
cat > "$TMP_DIR/issue_05.md" << 'EOF'
### Description
Add retry logic for transient failures.

### Scope
- Included:
  - Exponential backoff
  - Manual retry button

- Excluded:
  - Retry for permission errors

### Acceptance Criteria
- Automatic retry works
- Retry state shown to user

### Testing Requirements
- Unit tests for retry logic
- Failure scenarios
- Coverage ≥ 95%
EOF

create_issue "Add Retry Mechanism for Failures" "dev" "P1-High" "$TMP_DIR/issue_05.md"

# -------------------------
# Issue 8
# -------------------------
cat > "$TMP_DIR/issue_08.md" << 'EOF'
### Description
Create a basic post-recording preview overlay for playback and sharing.

### Scope
- Included:
  - Video playback
  - Share button
  - Exit overlay

- Excluded:
  - Trim, blur, comments

### Acceptance Criteria
- Overlay appears after recording
- Playback controls work
- Share URL generated

### Testing Requirements
- Component tests
- Manual playback tests
- Coverage ≥ 95%
EOF

create_issue "Create Preview Overlay Component (Basic)" "dev" "P0-Critical" "$TMP_DIR/issue_08.md"

# -------------------------
# Issue 26
# -------------------------
cat > "$TMP_DIR/issue_26.md" << 'EOF'
### Description
Remove unused dependencies to reduce bundle size.

### Scope
- Included:
  - Remove @webext-core/messaging
  - Remove idb
  - Cleanup imports

### Acceptance Criteria
- Build succeeds
- Tests pass
- Bundle size reduced

### Testing Requirements
- Full test run
- Manual smoke test
EOF

create_issue "Remove Unused Dependencies" "refactor" "P1-High" "$TMP_DIR/issue_26.md"

echo ""
echo "✅ Sprint 1 issues created successfully."
echo "👉 https://github.com/$REPO/issues"