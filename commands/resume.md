---
name: shipit:resume
description: Resume from last session — reads STATE.md and continues
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
Resume work from a previous session by reading persistent state.
</objective>

<process>

## Step 1: Load State

Read `.shipit/STATE.md`. If it doesn't exist, tell the user "No previous session found. Run `/shipit:init` or `/shipit:go <task>` to start."

## Step 2: Show Summary

Display:
- Project name
- Last task status
- Tasks completed / total
- Last updated timestamp

## Step 3: Resume

If `status: executing` and PLAN.md exists:
- Show which task was in progress
- Ask: "Continue from task N?" (default: yes)
- On yes: activate loop and continue execution (same as `/shipit:go`)

If `status: complete`:
- Tell user: "Previous task is complete. Run `/shipit:go <new-task>` for the next one."

If `status: idle` or `status: planned`:
- If PLAN.md exists: "You have a pending plan. Run `/shipit:go` to execute it."
- Otherwise: "No active work. Run `/shipit:go <task>` to start."

</process>
