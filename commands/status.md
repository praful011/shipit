---
name: shipit:status
description: Show current progress — tasks, completion percentage, blockers
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Display a quick progress dashboard.
</objective>

<process>

## Step 1: Load State

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state load
```

If no state exists, show: "No active project. Run `/shipit:init` to set up."

## Step 2: Display Dashboard

Format as:

```
## ShipIt Status

**Project:** <name>
**Status:** <idle | planned | executing | complete>
**Progress:** <completed>/<total> tasks (<percentage>%)
**Last Updated:** <timestamp>

### Active Plan
<task description from PLAN.md or "No active plan">

### Current Task
Task <N>: <description> [<status>]

### Recent Commits
<last 3 git commits, one-line format>

### Loop
<active (iteration N/max) | inactive>
```

Use `git log --oneline -3` for recent commits.
Check `.shipit/loop.md` for loop status.

</process>
