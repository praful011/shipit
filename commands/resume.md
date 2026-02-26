---
name: shipit:resume
description: Resume from last session — reads STATE.md, spawns conductor to continue
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
Resume work from a previous session by reading persistent state and spawning a fresh conductor agent to continue execution. Uses the thin orchestrator pattern — main context stays lean.
</objective>

<process>

## Step 1: Load State

Read these files (all required):
- `.shipit/STATE.md` — current position
- `.shipit/PLAN.md` — the plan
- `.shipit/HANDOFF.md` — what previous tasks did
- `.shipit/config.json` — preferences
- `.shipit/PROJECT.md` — project context

If STATE.md does not exist, tell the user: "No previous session found. Run `/shipit:init` or `/shipit:go <task>` to start."

Also read `./CLAUDE.md` if it exists.

**GATE: All state files read (or confirmed missing).**

## Step 2: Show Summary

Display:
- Project name
- Last task status
- Tasks completed / total
- Last updated timestamp
- If HANDOFF.md has entries: brief summary of what previous tasks accomplished

## Step 3: Route by Status

### If `status: executing` and PLAN.md exists:

Show which task was in progress and what has been completed so far (from HANDOFF.md).

Ask the user:
```
AskUserQuestion: "Continue from task N?"
- Option 1: "Yes, continue (Recommended)"
- Option 2: "No, start fresh with a new task"
```

**If user says continue:**

Spawn a conductor agent in CONTINUATION mode:

```
Task(
  subagent_type="shipit:shipit-conductor",
  prompt="First, read your agent definition at agents/shipit-conductor.md for your role and instructions.

CONTINUATION: Resume executing the task from where the previous session left off.

<files_to_read>
.shipit/PLAN.md
.shipit/STATE.md
.shipit/config.json
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>

The previous session completed tasks 1 through [N-1]. Continue from task N.
Read HANDOFF.md carefully — it contains what previous tasks accomplished.
"
)
```

Handle conductor results:
- `"complete"` → Confirm STATE.md shows `status: complete`. Output `<shipit-done/>`
- `"incomplete"` → Spawn new conductor for continuation (max 3 total)
- `"blocked"` → Present blocker to user via AskUserQuestion
- `"failed"` → Report failure details to user

**If user says start fresh:**
- Reset STATE.md to `status: idle`
- Tell user: "Ready for a new task. Run `/shipit:go <task>` to start."

### If `status: complete`:

Tell user: "Previous task is complete. Run `/shipit:go <new-task>` for the next one."

### If `status: idle` or `status: planned`:

If PLAN.md exists: "You have a pending plan. Run `/shipit:go` to execute it, or `/shipit:plan` to review it first."

Otherwise: "No active work. Run `/shipit:go <task>` to start."

</process>

<success_criteria>
- [ ] STATE.md read and status determined
- [ ] HANDOFF.md read for context (if exists)
- [ ] Summary shown to user
- [ ] For executing status: AskUserQuestion called before spawning conductor
- [ ] Conductor spawned in CONTINUATION mode (not inline execution)
- [ ] Conductor result handled (complete/incomplete/blocked/failed)
- [ ] Main context stayed lean (thin orchestrator pattern)
</success_criteria>
