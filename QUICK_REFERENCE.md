# GitHub Issues Quick Reference

This document provides a quick reference for the 42 GitHub issues defined in GITHUB_ISSUES.md.

## Sprint 1: Foundation & Testing (Week 1)
**Focus:** Test coverage and cleanup

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 21 | Add Popup Component Tests | test | P0 | 3 days |
| 22 | Add Content Script Tests | test | P0 | 2 days |
| 23 | Add Integration Tests | test | P0 | 4 days |
| 24 | Add Edge Case Tests | test | P1 | 3 days |
| 25 | Setup Coverage Reporting | test | P0 | 1 day |
| 36 | Remove Unused Dependencies | refactor | P1 | 1 day |

**Total:** 6 issues, 14 days

## Sprint 2: Critical Features (Week 2)
**Focus:** Core functionality implementation

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 1 | Implement R2 Upload Pipeline | dev | P0 | 5 days |
| 2 | Add Audio Capture Support | dev | P1 | 3 days |
| 26 | Test R2 Upload Pipeline | test | P1 | 2 days |
| 27 | Test Audio Capture | test | P1 | 2 days |
| 6 | Add Retry Mechanism for Failures | dev | P1 | 2 days |

**Total:** 5 issues, 14 days

## Sprint 3: UI Enhancement (Week 3)
**Focus:** User experience improvements

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 3 | Implement Video Trimming | dev | P1 | 4 days |
| 4 | Implement Blur Regions | dev | P1 | 5 days |
| 9 | Enhance Floating Pane Controls | dev | P1 | 2 days |
| 28 | Test Video Trimming & Blur | test | P1 | 2 days |
| 10 | Add Keyboard Shortcuts | dev | P2 | 2 days |

**Total:** 5 issues, 15 days

## Sprint 4: Polish & Documentation (Week 4)
**Focus:** Code quality and documentation

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 37 | Refactor Background Service Worker | refactor | P2 | 3 days |
| 38 | Add Structured Logging | refactor | P2 | 2 days |
| 35 | Improve Error Messages | refactor | P2 | 2 days |
| 41 | Update User Documentation | dev | P3 | 2 days |
| 42 | Create Testing Documentation | dev | P3 | 1 day |

**Total:** 5 issues, 10 days

## All Issues by Type

### Development (18 issues)
1. Implement R2 Upload Pipeline (P0, 5d)
2. Add Audio Capture Support (P1, 3d)
3. Implement Video Trimming (P1, 4d)
4. Implement Blur Regions (P1, 5d)
5. Implement Session Flags (P2, 3d)
6. Add Retry Mechanism for Failures (P1, 2d)
7. Implement Console/Network Capture (P2, 4d)
8. Implement WorkItem Model (P2, 5d)
9. Enhance Floating Pane Controls (P1, 2d)
10. Add Keyboard Shortcuts (P2, 2d)
11. Create Preview Overlay Component (P1, 4d)
12. Implement Shareable Links (P1, 3d)
13. Add Timestamped Comments (P1, 3d)
14. Implement Recording Requests (P2, 4d)
15. Create Dashboard Views (P1, 5d)
16. Implement State Persistence (P0, 2d)
17. Add Service Worker Recovery (P0, 3d)
18. Implement Watchdog Timer (P1, 2d)

Plus 6 more dev/error-handling issues...

### Testing (19 issues)
21. Add Popup Component Tests (P0, 3d)
22. Add Content Script Tests (P0, 2d)
23. Add Integration Tests (P0, 4d)
24. Add Edge Case Tests (P1, 3d)
25. Setup Coverage Reporting (P0, 1d)
26. Test R2 Upload Pipeline (P1, 2d)
27. Test Audio Capture (P1, 2d)
28. Test Video Trimming & Blur (P1, 2d)

Plus 11 more testing issues...

### Refactoring (5 issues)
35. Improve Error Messages (P2, 2d)
36. Remove Unused Dependencies (P1, 1d)
37. Refactor Background Service Worker (P2, 3d)
38. Add Structured Logging (P2, 2d)
39. Add TypeScript Strict Mode (P3, 2d)
40. Optimize Bundle Size (P3, 2d)

## Priority Breakdown

- **P0 (Critical):** 8 issues - Must complete first
- **P1 (High):** 15 issues - Important features
- **P2 (Medium):** 14 issues - Nice to have
- **P3 (Low):** 5 issues - Can defer

## Key Dependencies

```
Testing Foundation (Sprint 1)
├─ #21 → Enables popup development
├─ #22 → Enables content script development
├─ #23 → Validates integration
├─ #24 → Validates edge cases
├─ #25 → Enforces quality
└─ #36 → Cleans tech debt

Core Features (Sprint 2)
├─ #1 → #26 (R2 tests)
├─ #2 → #27 (Audio tests)
└─ #6 → Improves reliability

UI Features (Sprint 3)
├─ #3 + #4 → #28 (Trim/blur tests)
├─ #9 → Improves UX
└─ #10 → Power user features
```

## Coverage Requirements

All code must meet these thresholds:
- **Line Coverage:** ≥ 95%
- **Branch Coverage:** ≥ 95%
- **Function Coverage:** ≥ 95%
- **Statement Coverage:** ≥ 95%

## Labels to Create in GitHub

### Type Labels
- `dev` - Green (#0E8A16)
- `test` - Blue (#1D76DB)
- `refactor` - Yellow (#FBCA04)

### Priority Labels
- `P0-Critical` - Red (#D73A4A)
- `P1-High` - Light Red (#E99695)
- `P2-Medium` - Light Yellow (#FEF2C0)
- `P3-Low` - Light Blue (#C5DEF5)

## Issue Template Format

All issues follow this exact structure:

```markdown
### Description
[Clear description of what needs to be done and why]

### Scope
- Included:
  [List of what's in scope]
  
- Excluded:
  [List of what's explicitly out of scope]

### Acceptance Criteria
- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]
...

### Testing Requirements
- [ ] [Test requirement 1]
- [ ] [Test requirement 2]
- [ ] Test coverage is ≥ 95% for affected code
...

### Dependencies
[Any blocking dependencies]

### Notes
[Additional context or technical notes]
```

## Next Steps

1. **Create labels in GitHub** (one-time setup)
2. **Run `scripts/create_github_issues.sh`** to create sample issues
3. **Review and adjust** created issues
4. **Create remaining issues** via web UI or extended script
5. **Assign to team members** and set milestones
6. **Start with Sprint 1** issues

## Resources

- Full issue details: [GITHUB_ISSUES.md](../GITHUB_ISSUES.md)
- Creation script: [scripts/create_github_issues.sh](../scripts/create_github_issues.sh)
- GitHub CLI: https://cli.github.com/
