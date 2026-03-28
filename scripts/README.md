# Scripts

This directory contains helper scripts for the TraceQA project.

## Available Scripts

### create_github_issues.sh

Creates GitHub issues from the GITHUB_ISSUES.md document using GitHub CLI.

**Prerequisites:**
- GitHub CLI (`gh`) installed: https://cli.github.com/
- Authenticated with GitHub: `gh auth login`

**Usage:**
```bash
# Make executable (if not already)
chmod +x scripts/create_github_issues.sh

# Run the script
./scripts/create_github_issues.sh
```

**What it does:**
- Creates 5 sample high-priority issues from GITHUB_ISSUES.md
- Issues include:
  - #1: Implement R2 Upload Pipeline (dev, P0)
  - #21: Add Popup Component Tests (test, P0)
  - #22: Add Content Script Tests (test, P0)
  - #25: Setup Coverage Reporting (test, P0)
  - #36: Remove Unused Dependencies (refactor, P1)

**To create all 42 issues:**
1. Option 1: Extend the script with all issue templates
2. Option 2: Use GitHub web UI and copy from GITHUB_ISSUES.md
3. Option 3: Create individual scripts for each sprint

## Notes

- The script includes rate limiting (1 second delay between issues)
- All issue bodies are created as temporary files
- Labels are automatically applied (dev/test/refactor, priority)
- Issues are created in the bobb-Rob/trace-qa-2nd repository
