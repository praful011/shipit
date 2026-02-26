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
Execute a task end-to-end by following the ShipIt process steps in STRICT sequential order. Each step has a gate — you MUST complete it before moving to the next.

ShipIt spawns shipit-planner + shipit-executor agents, tracks state in `.shipit/`, enforces TDD, and loops until complete.
</objective>

<critical_rules>

**CRITICAL: You MUST follow the steps below ONE AT A TIME, IN ORDER. This is NON-NEGOTIABLE.**

**Your FIRST visible action** after loading context MUST be the Prompt Review (Step 1.5). You MUST call AskUserQuestion to present the prompt review BEFORE doing anything else.

## NEVER Do These Things Early

- NEVER use Glob, Grep, or Read on project source code before completing Step 1.5 (Prompt Review)
- NEVER spawn Task agents before Step 3 (Plan)
- NEVER write or edit any source files before Step 6 (Execute)
- NEVER start "exploring" or "understanding" the codebase before the prompt review is done
- NEVER skip the AskUserQuestion in Step 1.5 — the user MUST choose between original and improved prompt

## How To Know You Are Violating The Flow

If you find yourself reading source code files, exploring the codebase, or spawning Explore agents BEFORE you have called AskUserQuestion for the prompt review — STOP IMMEDIATELY. You are violating the ShipIt flow. Go back to Step 1.5.

</critical_rules>

<rationalization_prevention>

**CRITICAL: If you catch yourself thinking any of these, STOP. You are about to violate the ShipIt process.**

| Thought | Reality | Action |
|---------|---------|--------|
| "Let me explore the codebase first" | Step 1.5 (Prompt Review) comes BEFORE exploration. | STOP → Do prompt review first |
| "The prompt is clear enough, skip review" | Prompt review is MANDATORY. No exceptions. | STOP → Score and review the prompt |
| "This is too simple to need a plan" | Even simple tasks benefit from the review step. | STOP → Follow the steps in order |
| "I'll just start implementing" | Implementation is Step 6. You are not at Step 6 yet. | STOP → Complete the current step first |
| "The user wants speed, not process" | The user installed ShipIt because they WANT the process. Skipping steps wastes time on rework. | STOP → Follow the steps |
| "I already know what to do" | You might. But the process catches what you miss. | STOP → Follow the steps |
| "This plan doesn't need checking" | Plan-checker exists because bad plans waste execution time. Always check. | STOP → Run plan-checker |
| "The task is so small, skip the review" | Small tasks still get reviewed. The reviewer catches bugs you missed. | STOP → Run the reviewer |
| "I'll commit everything at the end" | Atomic commits per task. Not one big commit. | STOP → Commit after each task |

**The rule:** If a thought starts with "let me just", "skip", "too simple", "I already", or "I'll do it later" — that thought is a process violation. Stop and follow the current step.

</rationalization_prevention>

<process>

## Step 0.5: Branch Isolation (Medium/Large Tasks)

For medium and large tasks (determined after Step 2), create an isolated branch before execution:

```bash
# Create feature branch from current HEAD
git checkout -b shipit/<task-slug>-$(date +%s)
```

This ensures all work happens on an isolated branch. If anything goes wrong, the branch can be discarded without affecting the main branch.

**Note:** This step is executed AFTER Step 2 (complexity analysis) but BEFORE Step 3 (planning). For quick tasks, skip this step and work directly on the current branch.

**GATE: For medium/large tasks, feature branch MUST be created before planning begins.**

## Step 1: Load Context

**CRITICAL: Mandatory Initial Read**
You MUST read these files before any other action. If a file does not exist, note it and continue:
- `.shipit/PROJECT.md` — project context
- `.shipit/STATE.md` — current state
- `.shipit/config.json` — preferences

Also read `./CLAUDE.md` if it exists. Follow all project-specific guidelines.

**GATE: Context files read (or confirmed missing). Proceed to Step 1.5 immediately. Do NOT read any other files yet.**

## Step 1.5: Prompt Review

**CRITICAL: This step is MANDATORY. Do NOT skip it. Do NOT explore the codebase first.**

Your next action MUST be reviewing the user's prompt quality. Follow the prompt-review skill process:

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

## Step 2: Analyze Task Complexity

NOW you may examine the codebase. Use Glob and Grep to find relevant files. Read key files to understand the current state.

Classify complexity:
- **Quick** (1 file, simple change): Execute directly — skip to Step 6
- **Medium** (2-5 files, clear scope): Auto-plan into 2-3 tasks
- **Large** (6+ files, complex): Plan into 3-5 tasks (NEVER more than 5)

**GATE: Complexity MUST be classified as quick, medium, or large before proceeding.**

## Step 3: Plan (Medium/Large Only)

For medium and large tasks, spawn a shipit-planner agent:

```
Task(subagent_type="shipit:shipit-planner", prompt="First, read your agent definition at agents/shipit-planner.md for your role and instructions.\n\nPlan this task: $ARGUMENTS\n\n<files_to_read>\n.shipit/PROJECT.md\n.shipit/STATE.md\n.shipit/config.json\n</files_to_read>\n\nContext: [include relevant codebase context discovered in Step 2]")
```

Wait for the planner to write `.shipit/PLAN.md`.

**GATE: `.shipit/PLAN.md` MUST exist and have been written by the planner agent.**

## Step 3.5: Validate Plan (MANDATORY)

**CRITICAL: Do NOT execute a plan without validating it first.**

Spawn shipit-plan-checker agent to validate the plan:
```
Task(subagent_type="shipit:shipit-plan-checker", prompt="First, read your agent definition at agents/shipit-plan-checker.md for your role and instructions.\n\nValidate the plan in .shipit/PLAN.md against the original task: $ARGUMENTS\n\n<files_to_read>\n.shipit/PLAN.md\n.shipit/PROJECT.md\n.shipit/config.json\n</files_to_read>")
```

**If PASS:** Proceed to Step 4.
**If FAIL:** Send issues back to planner for revision:
```
Task(subagent_type="shipit:shipit-planner", prompt="First, read your agent definition at agents/shipit-planner.md for your role and instructions.\n\nRevise the plan based on these issues:\n\n<issues>\n[paste plan-checker issues]\n</issues>\n\n<files_to_read>\n.shipit/PLAN.md\n.shipit/PROJECT.md\n.shipit/config.json\n</files_to_read>")
```

Then re-check with plan-checker. **Max 2 revision iterations.** After 2 FAILs:
- Present remaining issues to user via AskUserQuestion
- Option 1: "Force proceed with warnings"
- Option 2: "Abort — rethink the task"

**GATE: Plan-checker MUST return PASS (or user forced proceed).**

## Step 4: Initialize State

If `.shipit/STATE.md` does not exist, create it:
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state init "<project-name>"
```

Update STATE.md with:
- `status: executing`
- `current_task: 1`
- `total_tasks: <from PLAN.md>`

**GATE: STATE.md MUST show status: executing with correct task counts.**

## Step 4.5: Initialize HANDOFF.md

Create (or reset) `.shipit/HANDOFF.md` for cross-task context sharing. This file is reset on every new plan so previous plan context does not leak:

```markdown
# ShipIt Handoff Log

> Cumulative context from completed tasks. Each executor reads this to understand what previous tasks did.

```

**GATE: HANDOFF.md MUST exist and be empty (or freshly reset).**

## Step 5: Activate Auto-Loop

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh "$ARGUMENTS" --max-iterations <from config or 50>
```

**GATE: Loop script MUST have executed successfully.**

## Step 6: Execute Tasks

**If quick task (no PLAN.md needed):**
- Apply TDD directly (if config.tdd is true and task involves code)
- Write failing test → implement → verify → commit
- Update STATE.md: `status: complete`
- Output `<shipit-done/>`

**If planned tasks — wave-based execution:**

Read PLAN.md and group tasks by their **Wave** field. Execute waves sequentially, but tasks WITHIN the same wave can run in parallel.

**For each wave:**

1. **Describe what's being built** (before spawning):
   - Read each task's Do field
   - Output: "Wave N: Building [description of what this wave delivers]"

2. **Spawn executor agents:**

   **If wave has 1 task:** Spawn single executor (see prompt template in `prompts/executor-prompt.md`):
   ```
   Task(subagent_type="shipit:shipit-executor", prompt="First, read your agent definition at agents/shipit-executor.md for your role and instructions.\n\nExecute task N from .shipit/PLAN.md\n\n## Scene Setting\n[what this task builds and why]\n\n<files_to_read>\n.shipit/PLAN.md\n.shipit/STATE.md\n.shipit/config.json\n.shipit/HANDOFF.md\n</files_to_read>")
   ```

   **If wave has 2+ tasks:** Spawn executors in PARALLEL (multiple Task calls in single message):
   ```
   # Spawn all wave tasks simultaneously
   Task(subagent_type="shipit:shipit-executor", prompt="...Execute task A...")
   Task(subagent_type="shipit:shipit-executor", prompt="...Execute task B...")
   ```

   **Parallel safety:** Tasks in the same wave MUST NOT modify the same files (planner guarantees this).

3. **After ALL executors in the wave complete:**

After each executor completes, spawn shipit-reviewer to review the task:
```
Task(subagent_type="shipit:shipit-reviewer", prompt="First, read your agent definition at agents/shipit-reviewer.md for your role and instructions.\n\nReview task N that was just completed.\n\n<files_to_read>\n.shipit/PLAN.md\n.shipit/HANDOFF.md\n</files_to_read>")
```

**If APPROVED:** Continue to next task.
**If NEEDS FIX:** Send fixes back to executor (re-spawn with fix instructions). Max 2 review iterations per task.
**If BLOCKED:** Stop and report critical issues to user.

Then:
1. Read STATE.md to check progress
2. If more tasks remain, spawn next executor agent
3. If all tasks done, proceed to Step 7

**GATE: All tasks in PLAN.md MUST be marked complete in STATE.md AND reviewed.**

## Step 7: Verify (After All Tasks)

When all tasks complete, spawn shipit-verifier:
```
Task(subagent_type="shipit:shipit-verifier", prompt="First, read your agent definition at agents/shipit-verifier.md for your role and instructions.\n\nVerify the completed work against the original task: $ARGUMENTS\n\n<files_to_read>\n.shipit/PLAN.md\n.shipit/STATE.md\n.shipit/HANDOFF.md\n</files_to_read>")
```

If verification passes: output `<shipit-done/>`
If verification fails: create fix tasks in PLAN.md and loop back to Step 6

</process>

<success_criteria>
- [ ] Step 1: Context files loaded (PROJECT.md, STATE.md, config.json, CLAUDE.md)
- [ ] Step 1: Mandatory discovery protocol completed (CLAUDE.md, project skills)
- [ ] Step 1.5: Prompt reviewed, AskUserQuestion called, user chose a prompt
- [ ] Step 1.5: Prompt saved to `.shipit/prompts/history.md`
- [ ] Step 2: Complexity classified (quick/medium/large)
- [ ] Step 0.5: Feature branch created (if medium/large)
- [ ] Step 3: PLAN.md written by planner agent (if medium/large)
- [ ] Step 3.5: Plan validated by plan-checker (PASS or user forced proceed)
- [ ] Step 4: STATE.md initialized with correct task counts
- [ ] Step 4.5: HANDOFF.md created/reset
- [ ] Step 5: Auto-loop activated
- [ ] Step 6: Each task executed with TDD, committed atomically, AND reviewed
- [ ] Step 6: All reviewer verdicts are APPROVED (or fixes applied)
- [ ] Step 6: Deferred items logged to `.shipit/DEFERRED.md` (if any)
- [ ] Step 7: Verification passed
- [ ] Final: `<shipit-done/>` output
</success_criteria>
