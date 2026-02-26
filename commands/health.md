---
name: shipit:health
description: Diagnose ShipIt state health and optionally repair issues
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Bash
  - AskUserQuestion
---

<objective>
Diagnose the health of ShipIt state files in `.shipit/`. Detect corruption, inconsistencies, and orphaned files. Offer to repair automatically.
</objective>

<process>

## Step 1: Check Directory Exists

```bash
ls -la .shipit/ 2>/dev/null
```

If `.shipit/` does not exist:
> "No ShipIt state found. Run `/shipit:init` to set up, or `/shipit:go <task>` to start."

**GATE: .shipit/ directory exists.**

## Step 2: Run Health Checks

### Check 1: Required Files
Verify these files exist:
- `.shipit/PROJECT.md` — project context
- `.shipit/config.json` — preferences

Report: Present / Missing for each.

### Check 2: Config Validation
If `config.json` exists, validate:
- `tdd` is boolean (default: true)
- `auto_loop` is boolean (default: true)
- `max_iterations` is number 1-200 (default: 50)
- `auto_commit` is boolean (default: true)
- `parallel_execution` is boolean (default: true)
- `max_parallel_agents` is number 1-5 (default: 3)
- `model_profile` is string: "quality" | "balanced" | "budget" (default: "balanced")

Report: Valid / Invalid (with details) / Missing keys (with defaults).

### Check 3: STATE.md Consistency
If `STATE.md` exists:
- `status` is one of: idle, planned, executing, complete
- `current_task` is a valid number
- `completed_tasks` is a valid number
- `completed_tasks` <= `total_tasks`
- `current_task` = `completed_tasks` + 1 (unless complete)
- If `status: executing`, PLAN.md MUST exist

Report: Consistent / Inconsistencies found (with details).

### Check 4: PLAN.md Integrity
If `PLAN.md` exists:
- Has valid frontmatter (task, total_tasks, status)
- Each task has required fields: Files, Do, TDD, Verify, Wave, Depends
- Task count matches frontmatter `total_tasks`
- Wave ordering is valid (no wave N+1 before wave N)
- Dependencies reference valid task numbers

Report: Valid / Issues found (with details).

### Check 5: HANDOFF.md Consistency
If `HANDOFF.md` exists and `STATE.md` exists:
- Number of task entries in HANDOFF.md should match `completed_tasks` in STATE.md
- Task entries should be in order (Task 1, Task 2, ...)
- Each entry should have: Files changed, What was done, Key decisions, Context

Report: Consistent / Inconsistencies found.

### Check 6: Orphaned Handoff Files
Check for leftover files in `.shipit/handoffs/`:
```bash
ls .shipit/handoffs/ 2>/dev/null
```

If handoff files exist but the corresponding tasks are already in HANDOFF.md, they are orphaned.

Report: Clean / Orphaned files found (list them).

### Check 7: Loop State
If `.shipit/loop.md` exists:
- `active` is boolean
- `iteration` <= `max_iterations`
- If STATE.md shows `status: complete`, loop should NOT be active

Report: Healthy / Issues found.

### Check 8: Git Checkpoints
Check for ShipIt checkpoint tags:
```bash
git tag -l "shipit/checkpoint-*" 2>/dev/null
```

Report: N checkpoints found / No checkpoints.

## Step 3: Display Report

```
## ShipIt Health Report

| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | Required Files | OK/WARN | ... |
| 2 | Config Validation | OK/WARN/FAIL | ... |
| 3 | STATE.md Consistency | OK/WARN/FAIL | ... |
| 4 | PLAN.md Integrity | OK/WARN/FAIL | ... |
| 5 | HANDOFF.md Consistency | OK/WARN | ... |
| 6 | Orphaned Handoffs | OK/WARN | ... |
| 7 | Loop State | OK/WARN | ... |
| 8 | Git Checkpoints | INFO | ... |

**Overall: HEALTHY / NEEDS REPAIR / CRITICAL**
```

## Step 4: Offer Repair (if issues found)

If any checks failed or warned:

```
AskUserQuestion: "Found N issues. Auto-repair?"
- Option 1: "Yes, fix all issues (Recommended)"
- Option 2: "Fix critical only"
- Option 3: "No, just show me the report"
```

### Auto-Repair Actions

| Issue | Repair |
|-------|--------|
| Missing config.json | Create with defaults |
| Invalid config keys | Add missing keys with defaults |
| STATE.md inconsistency | Recalculate from PLAN.md + HANDOFF.md |
| Orphaned handoff files | Merge into HANDOFF.md (or delete if already merged) |
| Stale loop.md | Delete if status is complete/idle |
| Missing PROJECT.md | Create minimal from directory name |

**Never auto-repair:**
- PLAN.md issues (needs re-planning)
- Missing HANDOFF.md entries (data loss — cannot reconstruct)

</process>

<success_criteria>
- [ ] All 8 health checks performed
- [ ] Report displayed in table format
- [ ] Repair offered if issues found
- [ ] Only safe repairs auto-applied
- [ ] Unsafe issues clearly flagged for manual intervention
</success_criteria>
