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
Create a plan for a task and present it for user approval before execution. Follow the steps below in STRICT sequential order.
</objective>

<critical_rules>

**CRITICAL: You MUST follow the steps below ONE AT A TIME, IN ORDER. This is NON-NEGOTIABLE.**

**Your FIRST visible action** after loading context MUST be the Prompt Review (Step 1.5). You MUST call AskUserQuestion for the prompt review BEFORE exploring the codebase.

- NEVER use Glob, Grep, or Read on project source code before completing Step 1.5
- NEVER skip the AskUserQuestion in Step 1.5

</critical_rules>

<process>

## Step 1: Load Context

**CRITICAL: Mandatory Initial Read**
You MUST read these files before any other action:
- `.shipit/PROJECT.md` — project context
- `.shipit/STATE.md` — current state
- `.shipit/config.json` — preferences

Also read `./CLAUDE.md` if it exists.

**GATE: Context files read (or confirmed missing). Proceed to Step 1.5. Do NOT read any other files yet.**

## Step 1.5: Prompt Review

**CRITICAL: This step is MANDATORY. Do NOT skip it.**

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

**GATE: AskUserQuestion has been called AND the user has chosen a prompt. Do NOT proceed until you have the user's choice.**

## Step 2: Quick Brainstorm

Ask the user at most 1-2 clarifying questions if the task is ambiguous. Use AskUserQuestion with multiple-choice options. If the task is clear, skip questions entirely.

**GATE: Ambiguities resolved (or task is clear enough to proceed).**

## Step 3: Analyze Codebase

NOW you may explore. Use Glob and Grep to find relevant files. Read key files to understand existing patterns and architecture.

**GATE: Relevant files identified and read.**

## Step 4: Create Plan

Spawn shipit-planner agent:
```
Task(subagent_type="shipit:shipit-planner", prompt="First, read your agent definition at agents/shipit-planner.md for your role and instructions.\n\nPlan this task: $ARGUMENTS\n\n<files_to_read>\n.shipit/PROJECT.md\n.shipit/STATE.md\n.shipit/config.json\n</files_to_read>\n\nContext: [include codebase context from Step 3]")
```

**GATE: `.shipit/PLAN.md` MUST exist.**

## Step 5: Present Plan

Read `.shipit/PLAN.md` and present a summary to the user:
- Number of tasks
- Key files to modify
- Complexity classification
- Any risks or trade-offs

Ask using AskUserQuestion: "Ready to execute? Or want changes?"

**GATE: User has approved the plan or requested changes.**

## Step 6: On Approval

Route to `/shipit:go` with the existing plan:
- The plan is already in `.shipit/PLAN.md`
- `/shipit:go` will detect the existing plan and execute it

</process>

<success_criteria>
- [ ] Step 1: Context files loaded
- [ ] Step 1.5: Prompt reviewed, AskUserQuestion called, user chose a prompt
- [ ] Step 1.5: Prompt saved to history
- [ ] Step 2: Clarifying questions asked (if needed)
- [ ] Step 3: Codebase analyzed, relevant files read
- [ ] Step 4: PLAN.md written by planner agent
- [ ] Step 5: Plan summary presented to user
- [ ] Step 6: User approved and routed to execution
</success_criteria>
