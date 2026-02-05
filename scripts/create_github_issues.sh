#!/bin/bash

# GitHub Issues Creation Script for TraceQA
# This script creates sample issues from GITHUB_ISSUES.md
# Prerequisites: GitHub CLI (gh) must be installed and authenticated

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub. Running 'gh auth login'...${NC}"
    gh auth login
fi

echo -e "${GREEN}Creating GitHub Issues for TraceQA...${NC}"
echo ""

# Function to create an issue
create_issue() {
    local number=$1
    local title=$2
    local label_type=$3
    local priority=$4
    local body_file=$5
    
    echo -e "${YELLOW}Creating Issue #${number}: ${title}${NC}"
    
    # Create the issue
    gh issue create \
        --title "${title}" \
        --body-file "${body_file}" \
        --label "${label_type}" \
        --label "${priority}" \
        --repo bobb-Rob/trace-qa-2nd
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Issue #${number} created successfully${NC}"
    else
        echo -e "${RED}✗ Failed to create Issue #${number}${NC}"
        return 1
    fi
    
    echo ""
    sleep 1  # Rate limiting
}

# Create temporary directory for issue bodies
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

echo "Temporary directory: ${TEMP_DIR}"
echo ""

# Issue #1: Implement R2 Upload Pipeline
cat > "${TEMP_DIR}/issue_01.md" << 'EOF'
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
- [ ] R2 bucket is configured with proper CORS and permissions
- [ ] Upload initiates automatically after recording stops
- [ ] Large files (>10MB) are uploaded in chunks
- [ ] Upload progress is displayed to user in real-time
- [ ] Failed uploads are retried up to 3 times with exponential backoff
- [ ] Successful upload returns shareable video URL
- [ ] Local IndexedDB blob is deleted after successful upload
- [ ] Upload survives service worker termination

### Testing Requirements
- [ ] Unit tests for upload chunking logic
- [ ] Unit tests for retry mechanism
- [ ] Integration test for full upload flow
- [ ] Test coverage is ≥ 95% for R2 upload module
- [ ] Negative test: network failure during upload
- [ ] Negative test: R2 authentication failure
- [ ] Negative test: storage quota exceeded
- [ ] Edge case: service worker terminates during upload

### Dependencies
- R2 bucket provisioned and credentials available
- Backend API endpoint for pre-signed URL generation
- Issue #26 (Test R2 Upload Pipeline) must be completed after

### Notes
- Use multipart upload for files >10MB
- Store upload state in chrome.storage.local for recovery
- Consider using tus protocol for resumable uploads
EOF

create_issue "1" "Implement R2 Upload Pipeline" "dev" "P0-Critical" "${TEMP_DIR}/issue_01.md"

# Issue #21: Add Popup Component Tests
cat > "${TEMP_DIR}/issue_21.md" << 'EOF'
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
- [ ] All popup components have tests
- [ ] useRecordingState hook has complete test coverage
- [ ] Component interaction tests pass
- [ ] Visual regression tests pass
- [ ] Test coverage is ≥ 95% for popup module
- [ ] Tests run in <10 seconds
- [ ] All tests pass consistently (no flakes)

### Testing Requirements
- [ ] Unit tests are added or updated
- [ ] Test coverage is ≥ 95% for affected code
- [ ] Negative and failure paths are covered
- [ ] Edge cases: loading states, error states, disabled states
- [ ] Mock chrome APIs correctly
- [ ] Use @testing-library/react for component tests
EOF

create_issue "21" "Add Popup Component Tests" "test" "P0-Critical" "${TEMP_DIR}/issue_21.md"

# Issue #22: Add Content Script Tests
cat > "${TEMP_DIR}/issue_22.md" << 'EOF'
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
- [ ] FloatingPane controller has complete test coverage
- [ ] PING/PONG protocol is tested
- [ ] Message routing is tested
- [ ] State update handling is tested
- [ ] Cleanup logic is tested
- [ ] Test coverage is ≥ 95% for content module
- [ ] All tests pass consistently

### Testing Requirements
- [ ] Unit tests are added or updated
- [ ] Test coverage is ≥ 95% for affected code
- [ ] Negative and failure paths are covered
- [ ] Edge cases: rapid show/hide, navigation, multiple calls
- [ ] Mock chrome APIs and DOM correctly
EOF

create_issue "22" "Add Content Script Tests" "test" "P0-Critical" "${TEMP_DIR}/issue_22.md"

# Issue #25: Setup Coverage Reporting
cat > "${TEMP_DIR}/issue_25.md" << 'EOF'
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
- [ ] Coverage reporter is configured in vitest.config.ts
- [ ] Thresholds are set: branches 90%, functions 90%, lines 90%, statements 90%
- [ ] HTML reports are generated in coverage/ directory
- [ ] README shows coverage badge
- [ ] CI fails when coverage drops below threshold
- [ ] Coverage report excludes test files and generated code

### Testing Requirements
- [ ] Coverage reports generate correctly
- [ ] Thresholds are enforced
- [ ] Badge updates automatically
EOF

create_issue "25" "Setup Coverage Reporting" "test" "P0-Critical" "${TEMP_DIR}/issue_25.md"

# Issue #36: Remove Unused Dependencies
cat > "${TEMP_DIR}/issue_36.md" << 'EOF'
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
- [ ] @webext-core/messaging is removed (not used)
- [ ] idb is removed (using native IndexedDB)
- [ ] No unused imports remain
- [ ] Build succeeds
- [ ] All tests pass
- [ ] Bundle size is reduced

### Testing Requirements
- [ ] All tests pass after removal
- [ ] Build verification
- [ ] Manual smoke test
EOF

create_issue "36" "Remove Unused Dependencies" "refactor" "P1-High" "${TEMP_DIR}/issue_36.md"

echo ""
echo -e "${GREEN}Sample issues created successfully!${NC}"
echo ""
echo "Note: This script created only 5 sample issues as examples."
echo "To create all 42 issues, you can:"
echo "  1. Use the GitHub web UI and copy from GITHUB_ISSUES.md"
echo "  2. Extend this script to include all 42 issues"
echo "  3. Use the individual issue templates from GITHUB_ISSUES.md"
echo ""
echo "View all issues: https://github.com/bobb-Rob/trace-qa-2nd/issues"
