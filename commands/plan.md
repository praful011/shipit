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

## Step 1.5: Prompt Review

Review and improve the user's task prompt before proceeding.

Follow the process defined in the `prompt-review` skill (`skills/prompt-review/SKILL.md`):

1. **Score the original prompt** on Clarity (25%), Specificity (25%), Actionability (25%), Grammar (15%), Scope (10%)
2. **Generate an improved version** — fix spelling, expand vague terms, add implicit requirements, use imperative language
3. **Score the improved version** using the same criteria
4. **Present both to the user** using AskUserQuestion:
   - Show original prompt and its score
   - Show improved prompt and its score
   - Option 1: "Continue with improved prompt (Recommended)"
   - Option 2: "Keep my original prompt"
5. **Save to history** — Append the entry to `.shipit/prompts/history.md` (create file and directory if needed)
6. **Use the chosen prompt** as `$ARGUMENTS` for all subsequent steps

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
