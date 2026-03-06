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

**You are a THIN ORCHESTRATOR.** Your job is to handle Steps 1-2 (context loading, prompt review, complexity analysis) and then DELEGATE everything else to the conductor agent. Keep your context lean.

ShipIt spawns shipit-conductor + shipit-planner + shipit-executor + shipit-reviewer + shipit-verifier agents, tracks state in `.shipit/`, enforces TDD, and loops until complete.
</objective>

<critical_rules>

**CRITICAL: You MUST follow the steps below ONE AT A TIME, IN ORDER. This is NON-NEGOTIABLE.**

**Your FIRST visible action** after loading context MUST be the Prompt Review (Step 1.5). You MUST call AskUserQuestion to present the prompt review BEFORE doing anything else.

## NEVER Do These Things Early

- NEVER use Glob, Grep, or Read on project source code before completing Step 1.5 (Prompt Review)
- NEVER spawn Task agents before Step 3 (which the conductor handles)
- NEVER write or edit any source files — that is the executor's job, not yours
- NEVER start "exploring" or "understanding" the codebase before the prompt review is done
- NEVER skip the AskUserQuestion in Step 1.5 — the user MUST choose between original and improved prompt

## Context Budget

You are the THIN orchestrator. Your context budget is ~15-20% of the window. You handle:
- Step 1: Load context (read 3-4 small state files)
- Step 1.5: Prompt review (AskUserQuestion)
- Step 2: Complexity analysis (Glob/Grep/Read on relevant files)
- Step 2.5: Branch isolation (one git command)
- Delegation: Spawn conductor agent(s)
- Loop management: Re-spawn conductor if it returns "incomplete"

Everything else (planning, plan-checking, execution, review, verification) happens inside the conductor agent's FRESH context window.

## How To Know You Are Violating The Flow

If you find yourself reading source code files, exploring the codebase, or spawning Explore agents BEFORE you have called AskUserQuestion for the prompt review — STOP IMMEDIATELY. You are violating the ShipIt flow. Go back to Step 1.5.

If you find yourself spawning shipit-planner, shipit-executor, or shipit-verifier agents directly — STOP. That is the conductor's job. Spawn the conductor instead.

</critical_rules>

<rationalization_prevention>

**STOP RULE:** If your next thought starts with "let me just", "skip", "too simple", "I already know", or "I'll handle it myself" — that thought is a process violation. Stop. Follow the current step.

**Orchestrator rule:** You NEVER implement, plan, or review. You delegate to the conductor. You only handle Steps 1-2.
**Sequence rule:** Prompt review BEFORE exploration. Always. No exceptions.

</rationalization_prevention>

<process>

## Step 1: Load Context

**CRITICAL: Mandatory Initial Read**
You MUST read these files before any other action. If a file does not exist, note it and continue:
- `.shipit/PROJECT.md` — project context
- `.shipit/STATE.md` — current state
- `.shipit/config.json` — preferences

Also read `./CLAUDE.md` if it exists. Follow all project-specific guidelines.

**Continuation detection:** If STATE.md shows `status: executing` and `current_task > 1`, this is a CONTINUATION. Skip to the Continuation Protocol section below.

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

### Step 1.7: Requirement Discovery (Low Specificity Only)

**If the Specificity score from Step 1.5 was < 60%**, the task may have hidden requirements. Before analyzing complexity, surface them:

Follow the `requirement-discovery` skill (`skills/requirement-discovery/SKILL.md`):

1. Parse the chosen prompt — identify explicit vs implicit requirements
2. Identify decision points the user hasn't resolved (technology choices, behavior on edge cases, scope boundaries)
3. Ask 2-4 focused questions using AskUserQuestion (concrete options, recommended defaults)
4. Enrich the prompt with user's answers — this becomes the final `$ARGUMENTS` for all subsequent steps

**Skip if:** Specificity score was >= 60%. The prompt is specific enough.

**GATE: Prompt enriched with user's answers (or skipped for specific prompts).**

### Step 1.8: Design Exploration (Non-Trivial Tasks)

**HARD GATE: No planning without design approval for non-trivial tasks.**

Before analyzing complexity in detail, do a quick scope check. If the task likely touches 2+ files:

1. **Explore project context** — Use Glob/Grep to find relevant code, check recent commits with `git log --oneline -10`
2. **Propose 2-3 approaches** — Present approaches with trade-offs:
   - Approach A: [description] — Pros: ... Cons: ...
   - Approach B: [description] — Pros: ... Cons: ...
   - **Recommended:** [which and why]
3. **Get user approval** — Use AskUserQuestion:
   - Present approaches with your recommendation
   - "Which approach? (1) Approach A, (2) Approach B, (3) Recommended [default]"
4. **Record chosen approach** — Save to `.shipit/DESIGN.md`:
   ```markdown
   # Design Decision — <timestamp>
   ## Task: <task description>
   ## Approaches Considered
   1. <approach A> — rejected because ...
   2. <approach B> — chosen because ...
   ## Decision: <chosen approach>
   ```
5. **Pass to conductor** — Include chosen approach in conductor prompt so planner builds the RIGHT thing

**Skip if:**
- Task is obviously quick (single file, config change, typo fix)
- User explicitly says "just do it" or "skip design"

**GATE: User has approved an approach (or task confirmed as quick). Do NOT proceed to planning without design approval for non-trivial tasks.**

## Step 2: Analyze Task Complexity

NOW you may examine the codebase. Use Glob and Grep to find relevant files. Read key files to understand the current state.

Classify complexity:
- **Quick** (1 file, simple change): Execute directly — skip to Quick Execution below
- **Medium** (2-5 files, clear scope): Delegate to conductor
- **Large** (6+ files, complex): Delegate to conductor

**GATE: Complexity MUST be classified as quick, medium, or large before proceeding.**

## Step 2.5: Branch Isolation (Medium/Large Only)

For medium and large tasks, create an isolated branch before delegating to conductor:

```bash
git checkout -b shipit/<task-slug>-$(date +%s)
```

**GATE: For medium/large tasks, feature branch MUST be created before spawning conductor.**

## Step 3: Delegate to Conductor (Medium/Large)

**This is where YOU hand off control.** Spawn the shipit-conductor agent with the full task context. The conductor will handle: codebase context generation, auto-CLAUDE.md (if missing), requirement discovery (if needed), planning, plan-checking, state initialization, wave-based execution, per-task review, lessons extraction, and verification — all in a FRESH context window.

**Include specificity score** in the conductor prompt so it knows whether to trigger requirement discovery.

```
Task(
  subagent_type="shipit:shipit-conductor",
  prompt="First, read your agent definition at agents/shipit-conductor.md for your role and instructions.

Execute this task end-to-end: $ARGUMENTS

<files_to_read>
.shipit/PROJECT.md
.shipit/STATE.md
.shipit/config.json
./CLAUDE.md
</files_to_read>

Codebase context from orchestrator analysis:
- Complexity: [medium/large]
- Key files identified: [list from Step 2]
- Relevant patterns: [any patterns noticed in Step 2]
- Branch: [current branch name]
- Specificity score: [score from Step 1.5, e.g. 45% — conductor uses this to decide on requirement discovery]
- Design approach: [chosen approach from Step 1.8, or 'quick task — skipped']
"
)
```

**Wait for the conductor to return.** It will return one of:
- `"complete"` — All tasks done, verified. Proceed to Finalize.
- `"incomplete"` — Context budget reached, needs continuation. Re-spawn conductor.
- `"blocked"` — Hit a blocker needing user input. Present to user.
- `"failed"` — Verification failed after fix attempts. Report to user.

### Handle Conductor Results

**If "complete":**
- Read `.shipit/STATE.md` to confirm `status: complete`
- Proceed to Finalize

**If "incomplete":**
- Read `.shipit/STATE.md` and `.shipit/HANDOFF.md` to understand progress
- Spawn a NEW conductor to continue:
```
Task(
  subagent_type="shipit:shipit-conductor",
  prompt="First, read your agent definition at agents/shipit-conductor.md for your role and instructions.

CONTINUATION: Resume executing the task: $ARGUMENTS

The previous conductor completed through wave N. Continue from where it left off.

<files_to_read>
.shipit/PLAN.md
.shipit/STATE.md
.shipit/config.json
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>
"
)
```
- Repeat until conductor returns "complete" or "failed"
- **Max 3 conductor spawns.** After 3, report to user.

**If "blocked":**
- Present the blocker to the user via AskUserQuestion
- Based on user's response, either re-spawn conductor with unblock instructions or abort

**If "failed":**
- Report failure details to the user
- Ask whether to retry with different approach or abort

**GATE: Conductor MUST return a final status.**

## Quick Execution (Quick Tasks Only)

For quick tasks (1 file, simple change), execute directly without spawning conductor:

1. Apply TDD if config.tdd is true and task involves code:
   - Write failing test → Run test (MUST fail) → Implement → Run test (MUST pass)
2. If no TDD: make the change, verify it works
3. Stage files individually (NEVER `git add .`)
4. Commit with proper type prefix
5. Update STATE.md: `status: complete`
6. Proceed to Finalize

**GATE: Change verified and committed.**

## Finalize

1. Activate auto-loop (for session continuity):
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh "$ARGUMENTS" --max-iterations <from config or 50>
```

2. Output completion:
```
<shipit-done/>
```

</process>

<continuation_protocol>

## Continuation (STATE.md shows executing)

If Step 1 revealed that STATE.md has `status: executing` and `current_task > 1`:

1. Skip prompt review (already done in original session)
2. Read `.shipit/PLAN.md` to understand the plan
3. Spawn conductor in CONTINUATION mode:

```
Task(
  subagent_type="shipit:shipit-conductor",
  prompt="First, read your agent definition at agents/shipit-conductor.md for your role and instructions.

CONTINUATION: Resume executing the task: $ARGUMENTS

<files_to_read>
.shipit/PLAN.md
.shipit/STATE.md
.shipit/config.json
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>
"
)
```

4. Handle conductor result as described in Step 3.

</continuation_protocol>

<success_criteria>
- [ ] Step 1: Context files loaded (PROJECT.md, STATE.md, config.json, CLAUDE.md)
- [ ] Step 1.5: Prompt reviewed, AskUserQuestion called, user chose a prompt
- [ ] Step 1.5: Prompt saved to `.shipit/prompts/history.md`
- [ ] Step 1.7: Requirement discovery triggered if Specificity < 60% (or skipped)
- [ ] Step 1.8: Design exploration completed for non-trivial tasks (or skipped for quick)
- [ ] Step 1.8: Chosen approach saved to `.shipit/DESIGN.md` (if applicable)
- [ ] Step 2: Complexity classified (quick/medium/large)
- [ ] Step 2.5: Feature branch created (if medium/large)
- [ ] Step 3: Conductor agent spawned with full context + specificity score (if medium/large)
- [ ] Step 3: Conductor result handled (complete/incomplete/blocked/failed)
- [ ] Step 3: Continuation conductors spawned if needed (max 3)
- [ ] Quick: TDD enforced for quick tasks (if applicable)
- [ ] Quick: Atomic commit created with proper type prefix
- [ ] Finalize: `<shipit-done/>` output
- [ ] Context budget: Main orchestrator stayed under ~20% context usage
</success_criteria>
