---
name: shipit:debug
description: Systematic debugging with persistent state across sessions
argument-hint: "<issue description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

<objective>
Debug an issue using the scientific method with state that persists across context resets.
</objective>

<process>

## Step 1: Check for Existing Debug Session

Read `.shipit/debug/DEBUG.md` if it exists. If it has an active investigation, resume from where it left off.

## Step 2: Initialize Debug State

If no existing session, create `.shipit/debug/DEBUG.md`:

```bash
mkdir -p .shipit/debug
```

Write DEBUG.md with:
- Issue description from $ARGUMENTS
- Status: investigating
- Empty hypotheses, tested, root cause sections

## Step 3: Spawn Debugger

Spawn `shipit-debugger` agent:
```
Task(subagent_type="shipit-debugger", prompt="Debug this issue: $ARGUMENTS")
```

The debugger will:
1. Reproduce the issue
2. Form hypotheses
3. Test them systematically
4. Find root cause
5. Fix with TDD
6. Update DEBUG.md throughout

## Step 4: Activate Loop (Optional)

If auto_loop is enabled in config, activate the loop so debugging continues autonomously:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh "Debug: $ARGUMENTS" --max-iterations 30
```

</process>
