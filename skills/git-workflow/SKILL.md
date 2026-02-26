---
name: git-workflow
description: Git workflow conventions — branching, commits, staging, PR process
---

# Git Workflow

## Branch Strategy

| Task Type | Branch | Naming |
|-----------|--------|--------|
| **Quick** (1 file) | Work on current branch | No branch needed |
| **Medium** (2-5 files) | Feature branch | `shipit/<task-slug>` |
| **Large** (6+ files) | Feature branch | `shipit/<task-slug>` |

Create branches BEFORE execution. Delete after merge.

## Commit Conventions

### Atomic Commits

**One commit per completed task.** NOT one big commit at the end.

### Staging

**CRITICAL: Stage files individually. NEVER use `git add .` or `git add -A`.**

```bash
# CORRECT
git add src/auth/login.ts
git add src/auth/login.test.ts

# WRONG — stages secrets, build artifacts, unrelated changes
git add .
git add -A
```

### Commit Types

| Type | When | Example |
|------|------|---------|
| `feat` | New feature, endpoint, component | `feat: add user login endpoint` |
| `fix` | Bug fix, error correction | `fix: handle null user in auth middleware` |
| `test` | Test-only changes | `test: add login validation tests` |
| `refactor` | Code cleanup, no behavior change | `refactor: extract auth helper functions` |
| `chore` | Config, tooling, dependencies | `chore: update eslint config` |
| `docs` | Documentation only | `docs: add API endpoint documentation` |

### Commit Message Format

```
{type}: {concise description}

- {key change 1}
- {key change 2}
```

- First line: max 72 characters
- Body: what changed and WHY (not just what)
- Reference task number if applicable

## PR Process

When all tasks complete and verification passes:

1. Push the feature branch
2. Create PR with:
   - Title: concise description (under 70 chars)
   - Body: what was built, what was tested, any risks
3. Reference the original task description

## Rationalization Prevention

| Thought | Reality | Action |
|---------|---------|--------|
| "I'll commit at the end" | Atomic commits per task. Not one big commit. | STOP → Commit now |
| "git add . is faster" | It stages secrets, build artifacts, and junk | STOP → Stage individually |
| "The commit message isn't important" | Future you will need to understand this change | STOP → Write a clear message |
| "I'll push later" | The branch provides isolation. Push often. | Push after each task |
