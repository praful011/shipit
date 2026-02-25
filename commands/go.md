---
name: shipit:go
description: Smart router — auto-detects task complexity, plans, executes with TDD, loops until done
argument-hint: "<task description> [--max-iterations N]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Execute a task end-to-end with maximum autonomy. Auto-detect complexity, plan if needed, execute with TDD, loop until complete.
</objective>

<process>

## Step 1: Load Context

Read these files if they exist (silently skip if missing):
- `.shipit/PROJECT.md`
- `.shipit/STATE.md`
- `.shipit/config.json`

## Step 2: Analyze Task Complexity

Examine the codebase to understand what the task requires:
- Use Glob and Grep to find relevant files
- Read key files to understand the current state
- Classify complexity:
  - **Quick** (1 file, simple change): Execute directly
  - **Medium** (2-5 files, clear scope): Auto-plan into 2-4 tasks
  - **Large** (6+ files, complex): Plan into 4-8 tasks, consider parallel execution

## Step 3: Plan (Medium/Large Only)

For medium and large tasks, spawn a `shipit-planner` agent:

```
Task(subagent_type="shipit-planner", prompt="Plan this task: $ARGUMENTS\n\nContext from STATE.md and PROJECT.md: [include relevant context]")
```

Wait for the planner to write `.shipit/PLAN.md`.

## Step 4: Initialize State

If `.shipit/STATE.md` doesn't exist, create it:
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state init "<project-name>"
```

Update STATE.md with:
- `status: executing`
- `current_task: 1`
- `total_tasks: <from PLAN.md>`

## Step 4.5: Initialize HANDOFF.md

Create (or reset) `.shipit/HANDOFF.md` for cross-task context sharing. This file is reset on every new plan so previous plan context doesn't leak:

```markdown
# ShipIt Handoff Log

> Cumulative context from completed tasks. Each executor reads this to understand what previous tasks did.

```

This file will be appended to by each executor agent after completing a task.

## Step 5: Activate Auto-Loop

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh "$ARGUMENTS" --max-iterations <from config or 50>
```

## Step 6: Execute Tasks

For each task in PLAN.md:

**If quick task (no PLAN.md needed):**
- Apply TDD directly (if config.tdd is true and task involves code)
- Write failing test → implement → verify → commit
- Update STATE.md: `status: complete`
- Output `<shipit-done/>`

**If planned tasks:**
Spawn `shipit-executor` agent for the current task:
```
Task(subagent_type="shipit-executor", prompt="Execute task N from .shipit/PLAN.md")
```

After executor completes, check STATE.md. If more tasks remain, continue (the loop will handle re-entry).

## Step 7: Verify (After All Tasks)

When all tasks complete, spawn `shipit-verifier`:
```
Task(subagent_type="shipit-verifier", prompt="Verify the completed work against the original task: $ARGUMENTS")
```

If verification passes: output `<shipit-done/>`
If verification fails: create fix tasks in PLAN.md and continue

</process>
