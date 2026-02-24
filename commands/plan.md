---
name: shipit:plan
description: Quick brainstorm + plan — review before executing
argument-hint: "<task description>"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Create a plan for a task and present it for user approval before execution.
</objective>

<process>

## Step 1: Load Context

Read `.shipit/PROJECT.md`, `.shipit/STATE.md`, `.shipit/config.json` if they exist.

## Step 2: Quick Brainstorm

Ask the user at most 1-2 clarifying questions if the task is ambiguous. Use AskUserQuestion with multiple-choice options. If the task is clear, skip questions entirely.

## Step 3: Analyze Codebase

Use Glob and Grep to find relevant files. Read key files to understand existing patterns and architecture.

## Step 4: Create Plan

Spawn `shipit-planner` agent:
```
Task(subagent_type="shipit-planner", prompt="Plan this task: $ARGUMENTS\n\n[Include codebase context]")
```

## Step 5: Present Plan

Read `.shipit/PLAN.md` and present a summary to the user:
- Number of tasks
- Key files to modify
- Estimated complexity
- Any risks or trade-offs

Ask: "Ready to execute? Or want changes?"

## Step 6: On Approval

Route to `/shipit:go` with the existing plan:
- The plan is already in `.shipit/PLAN.md`
- `/shipit:go` will detect the existing plan and execute it

</process>
