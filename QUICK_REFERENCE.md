# GitHub Issues Quick Reference

This document provides a quick reference for the 34 GitHub issues defined in GITHUB_ISSUES.md.

**Note:** Testing requirements have been integrated into each dev issue. All issues now include comprehensive testing sections.

## Sprint 1: Foundation & Critical Features (Week 1-2)
**Focus:** Audio, Upload, Core Features

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 1 | Add Audio Capture Support | dev | P0 | 3 days |
| 2 | Implement R2 Upload Pipeline | dev | P0 | 5 days |
| 3 | Implement Video Trimming | dev | P1 | 4 days |
| 4 | Implement Blur Regions | dev | P1 | 5 days |
| 5 | Add Retry Mechanism for Failures | dev | P1 | 2 days |
| 8 | Create Preview Overlay (Basic) | dev | P0 | 2 days |
| 26 | Remove Unused Dependencies | refactor | P1 | 1 day |

**Total:** 7 issues, 22 days

## Sprint 2: State Management & UI (Week 3)
**Focus:** Persistence and controls

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 14 | Implement State Persistence | dev | P0 | 2 days |
| 15 | Add Service Worker Recovery | dev | P0 | 3 days |
| 9 | Enhance Floating Pane Controls | dev | P1 | 2 days |
| 10 | Add Keyboard Shortcuts | dev | P2 | 2 days |
| 16 | Implement Watchdog Timer | dev | P1 | 2 days |

**Total:** 5 issues, 11 days

## Sprint 3: Collaboration Features (Week 4)
**Focus:** Sharing and dashboard

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 11 | Implement Shareable Links | dev | P1 | 3 days |
| 12 | Add Timestamped Comments | dev | P1 | 3 days |
| 13 | Create Dashboard Views | dev | P1 | 5 days |
| 6 | Implement Session Flags | dev | P2 | 3 days |

**Total:** 4 issues, 14 days

## Sprint 4: Polish & Documentation (Week 5)
**Focus:** Code quality and documentation

| # | Title | Type | Priority | Estimate |
|---|-------|------|----------|----------|
| 27 | Refactor Background Service Worker | refactor | P2 | 3 days |
| 28 | Add Structured Logging | refactor | P2 | 2 days |
| 32 | Update User Documentation | dev | P3 | 2 days |
| 33 | Create Testing Documentation | dev | P3 | 1 day |

**Total:** 4 issues, 8 days

## All Issues by Type

### Development (34 issues)
All development issues now include comprehensive testing requirements:

**P0 (Critical) - 8 issues:**
1. Add Audio Capture Support (3d)
2. Implement R2 Upload Pipeline (5d)
8. Create Preview Overlay Component - Basic (2d)
14. Implement State Persistence (2d)
15. Add Service Worker Recovery (3d)
17. Implement Recording Requests (4d)
19. Handle Permission Denied Gracefully (1d)
20. Handle Offscreen Document Failures (1d)

**P1 (High) - 13 issues:**
3. Implement Video Trimming (4d)
4. Implement Blur Regions (5d)
5. Add Retry Mechanism for Failures (2d)
9. Enhance Floating Pane Controls (2d)
11. Implement Shareable Links (3d)
12. Add Timestamped Comments (3d)
13. Create Dashboard Views (5d)
16. Implement Watchdog Timer (2d)
18. Add Version Migration (2d)
21. Add Loading States for All Actions (2d)
26. Remove Unused Dependencies (1d)
29. Add TypeScript Strict Mode (2d)
30. Optimize Bundle Size (2d)

**P2 (Medium) - 10 issues:**
6. Implement Session Flags (3d)
7. Implement Console/Network Capture (4d)
10. Add Keyboard Shortcuts (2d)
22. Handle IndexedDB Quota Exceeded (1d)
23. Handle Tab Navigation During Recording (2d)
25. Improve Error Messages (2d)
27. Refactor Background Service Worker (3d)
28. Add Structured Logging (2d)
31. Create API Documentation (2d)
34. Add Security Best Practices Guide (1d)

**P3 (Low) - 3 issues:**
24. Handle Chrome Crash/Force Quit (2d)
32. Update User Documentation (2d)
33. Create Testing Documentation (1d)

## Priority Breakdown

- **P0 (Critical):** 8 issues - Must complete first
- **P1 (High):** 13 issues - Important features
- **P2 (Medium):** 10 issues - Nice to have
- **P3 (Low):** 3 issues - Can defer

## Key Dependencies

```
Sprint 1: Foundation & Critical Features
├─ #1 (Audio) → Must complete first, foundational
├─ #2 (R2 Upload) → Depends on #1 for audio mixing
├─ #8 (Preview Overlay) → Needs #1, #2 for complete flow
├─ #3 (Trim) + #4 (Blur) → Enhance preview
├─ #5 (Retry) → Reliability layer for #2
└─ #26 (Remove deps) → Tech debt cleanup

Sprint 2: State Management
├─ #14 (State Persistence) → Foundation for recovery
├─ #15 (Service Worker Recovery) → Depends on #14
├─ #16 (Watchdog) → Monitors state from #14, #15
└─ #9, #10 → UI enhancements (parallel)

Sprint 3: Collaboration
├─ #11 (Shareable Links) → Requires #2 (R2 Upload)
├─ #12 (Comments) → Enhances #11
└─ #13 (Dashboard) → Displays all features
```

## Coverage Requirements

Each dev issue now includes comprehensive testing requirements:
- **Unit Tests:** All modules ≥ 95% coverage
- **Integration Tests:** Cross-component flows
- **Edge Case Tests:** Error scenarios, race conditions  
- **Negative Tests:** Failure paths
- **Performance Tests:** Where applicable

**Coverage Thresholds:**
- **Line Coverage:** ≥ 95%
- **Branch Coverage:** ≥ 95%
- **Function Coverage:** ≥ 95%
- **Statement Coverage:** ≥ 95%

## Labels to Create in GitHub

### Type Labels
- `dev` - Green (#0E8A16) - All issues are now dev issues with integrated testing
- `refactor` - Yellow (#FBCA04) - Code quality improvements

**Note:** `test` label has been removed. Testing is now integrated into all dev issues.

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
