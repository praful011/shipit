# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Multi-agent orchestration with thin orchestrator and fresh-context conductor. Implements progressive autonomy, confidence-aware execution, TDD enforcement, and learning-loop code review.

**Key Characteristics:**
- **Thin orchestrator + conductor agent split** — Main conversation stays lean (~15-20% context) handling Steps 1-2 (context loading, prompt review, complexity analysis), then delegates all heavy work to a fresh-context conductor
- **Wave-based parallel execution** — Independent tasks marked with Wave assignments execute simultaneously
- **State persistence** — `.shipit/` directory holds PLAN.md, STATE.md, HANDOFF.md, receipts/, config.json, and analytics.json across sessions
- **Confidence-aware execution** — Executors self-rate confidence (HIGH/MEDIUM/LOW) before implementing; LOW confidence triggers `<shipit-blocked>` signal
- **Learning-loop code review** — Reviewers extract patterns and lessons into LESSONS.md and skill files, preventing repeated mistakes
- **Gated workflow** — Hard gates (`<CRITICAL_GATE>`) and signal-based control flow (`<shipit-done/>`, `<shipit-blocked>`, `<shipit-replan>`) prevent skipping critical steps

## Layers

**Orchestrator Layer (Commands + Main):**
- Purpose: Entry point, context loading, prompt review, complexity analysis, conductor spawning, loop management
- Location: `commands/go.md`, `commands/init.md`, `commands/quick.md`, `commands/plan.md`, `commands/resume.md`
- Contains: Command definitions with YAML frontmatter, step sequences, hard gates, AskUserQuestion calls
- Depends on: `.shipit/` state files, `CLAUDE.md`, skills (prompt-review, requirement-discovery)
- Used by: User directly via `/shipit:go`, `/shipit:plan`, etc.

**Conductor Agent Layer:**
- Purpose: Fresh-context orchestrator managing planning, execution waves, review, verification, analytics
- Location: `agents/shipit-conductor.md`
- Contains: Planning spawn, wave management, executor spawning, review coordination, confidence tracking, analytics updates
- Depends on: Planner, Executor, Reviewer, Verifier agents; `.shipit/` state files; analytics.json
- Used by: Main orchestrator via Task(agent: "shipit-conductor")

**Planning Layer:**
- Purpose: Decompose user task into atomic, dependency-ordered steps with wave assignments and acceptance criteria
- Location: `agents/shipit-planner.md`
- Contains: Task breakdown logic, wave dependency analysis, TDD requirement extraction, PLAN.md generation
- Depends on: Codebase exploration (Glob/Grep), `CLAUDE.md`, `.shipit/PROJECT_CONTEXT.md`
- Used by: Conductor, main orchestrator via `/shipit:plan`

**Execution Layer:**
- Purpose: Execute one task at a time, enforce TDD (RED→GREEN→REFACTOR), create atomic commits, confidence-rate work
- Location: `agents/shipit-executor.md`
- Contains: Task implementation, test writing, confidence assessment, checkpoint creation, handoff logging, receipt generation
- Depends on: PLAN.md, STATE.md, HANDOFF.md, LESSONS.md, `.shipit/PROJECT_CONTEXT.md`
- Used by: Conductor (one task per agent spawn) with adaptive model selection

**Review Layer:**
- Purpose: Per-task code review for spec compliance, quality, and pattern consistency; extract lessons from findings
- Location: `agents/shipit-reviewer.md`
- Contains: Receipt validation, spec compliance check, code quality review, pattern consistency, LESSONS.md extraction
- Depends on: PLAN.md, task receipt JSON, HANDOFF.md, `.shipit/PROJECT_CONTEXT.md`, code changes via git diff
- Used by: Conductor after each executor completes

**Verification Layer:**
- Purpose: Epic-level validation that the completed work delivers on original user intent; integration checking
- Location: `agents/shipit-verifier.md`
- Contains: Original requirement parsing, test suite execution, diff review, coverage analysis, integration verification
- Depends on: PLAN.md (original task), HANDOFF.md, STATE.md, receipts/*, test output, git diff
- Used by: Conductor after all tasks; standalone via `/shipit:done`

**Specialized Agents:**
- **Researcher** (`agents/shipit-researcher.md`): Pre-planning research for large tasks
- **Debugger** (`agents/shipit-debugger.md`): Scientific debugging with persistent state via `/shipit:debug`
- **Peer Reviewer** (`agents/shipit-peer-reviewer.md`): GitLab MR review, pattern extraction, learning loop integration
- **Plan Checker** (`agents/shipit-plan-checker.md`): Validates plan quality before execution
- **Integration Checker** (`agents/shipit-integration-checker.md`): Cross-task dependency and integration validation

## Data Flow

**Main Orchestrator Flow (Steps 1-2.5):**

1. Load `.shipit/STATE.md`, `.shipit/config.json`, `./CLAUDE.md`
2. Prompt Review (AskUserQuestion with original/improved prompt choice)
3. [Optional] Requirement Discovery (if Specificity < 60%)
4. Complexity Analysis (Glob/Grep on relevant files)
5. [Optional] Branch isolation for medium/large tasks
6. Spawn shipit-conductor with task + context

**Conductor Internal Flow:**

1. Load analytics.json, trust_score calculation
2. Generate PROJECT_CONTEXT.md (code examples from codebase)
3. [Optional] Spawn researcher for large tasks
4. Spawn planner → receive PLAN.md
5. [Optional] Spawn plan-checker for validation
6. Loop over waves:
   - Spawn executor(s) in parallel (same wave)
   - Collect receipts
   - Spawn reviewer(s) after each executor
   - Handle `<shipit-blocked>` or `<shipit-replan>` signals
7. Spawn verifier for final validation
8. Update analytics.json (trust_score, code_health, failure patterns)
9. Return status (complete/incomplete/blocked/failed)

**State File Updates:**

- **STATE.md** updated by: Conductor (current_task, status), Executor (completed_tasks), Planner (total_tasks, branch)
- **HANDOFF.md** appended by: Executor (task completion summary)
- **PLAN.md** written by: Planner (tasks, waves, acceptance criteria)
- **receipts/task-N.json** written by: Executor (test results, checkpoint tag, confidence, self-review flag, verify output)
- **LESSONS.md** written by: Reviewer (extracted patterns, anti-patterns, review findings)
- **analytics.json** updated by: Conductor (trust_score, code_health_trend, cost_history, common_failures)

**Peer Review Learning Loop (Specialized):**

1. User runs `/shipit:peer-review` → select Jira ticket
2. Main extracts GitLab MR URL
3. Conductor spawns peer-reviewer agent
4. Peer-reviewer performs MR review via `/pr-review-toolkit:review-pr` skill
5. Peer-reviewer extracts CRITICAL + IMPORTANT patterns
6. Patterns written to PROJECT's `skills/pr-review-patterns/SKILL.md` (best-effort)
7. Future tasks in that project learn from extracted patterns via LESSONS.md

## Key Abstractions

**Task (Atomic Unit):**
- Purpose: Represents one implementation step from PLAN.md
- Examples: `commands/go.md` Task 1-5, `agents/shipit-executor.md` processes one task
- Pattern: Fully specified in PLAN.md with Files, Do, Verify, TDD flags; executed by single executor; receipted with proof-of-work

**Wave (Parallel Batch):**
- Purpose: Groups independent tasks that can run simultaneously
- Examples: `PLAN.md` shows Wave 1 and Wave 2 separation
- Pattern: Conductor spawns all Wave N tasks in parallel, collects results, gates on Wave N completion before Wave N+1

**Receipt (Proof-of-Work):**
- Purpose: JSON document proving task execution with evidence (test output, git tags, confidence, self-review)
- Location: `.shipit/receipts/task-N.json`
- Pattern: Generated by executor, validated by reviewer before code review proceeds; contains: tests_run (bool), verify_result (pass/fail), tdd_compliant, checkpoint_tag, confidence, self_review_done

**Lesson (Extracted Pattern):**
- Purpose: Generalized finding from code review to prevent repeated mistakes
- Location: `.shipit/LESSONS.md` (per-run) and skill files like `skills/pr-review-patterns/SKILL.md` (persistent)
- Pattern: Extracted by reviewer from CRITICAL/IMPORTANT findings, read by executor before implementation, written by peer-reviewer after MR review

**Autonomy Mode:**
- Purpose: Controls human oversight level based on trust score and task criticality
- Examples: `guided` (pause after each step), `supervised` (pause between waves), `autonomous` (no pauses except blockers)
- Pattern: Read from config.json, adjusted by trust_score, enforced by conductor via AskUserQuestion gates

## Entry Points

**`/shipit:go` Command (Main Orchestrator):**
- Location: `commands/go.md`
- Triggers: User types `/shipit:go <task description>`
- Responsibilities: Load context, prompt review (mandatory), complexity analysis, spawn conductor, loop until conductor returns status, manage autonomy mode gates

**`/shipit:plan` Command (Planning Only):**
- Location: `commands/plan.md`
- Triggers: User types `/shipit:plan <task description>`
- Responsibilities: Load context, prompt review, spawn planner, show PLAN.md, ask user to proceed (doesn't auto-execute)

**`/shipit:init` Command (Project Setup):**
- Location: `commands/init.md`
- Triggers: User types `/shipit:init [project-name]`
- Responsibilities: Scan codebase, detect tech stack, ask setup questions, create `.shipit/` with config.json, PROJECT.md, STATE.md

**`/shipit:resume` Command (Session Continuation):**
- Location: `commands/resume.md`
- Triggers: User types `/shipit:resume` when STATE.md shows incomplete work
- Responsibilities: Detect STATE.md status, skip planning steps if already executing, spawn conductor from current task

**`/shipit:done` Command (Verification):**
- Location: `commands/done.md`
- Triggers: User types `/shipit:done` when manually working or wanting final verification
- Responsibilities: Run full test suite, review diff, spawn verifier, offer commit or PR

**`/shipit:peer-review` Command (MR Review Loop):**
- Location: `commands/peer-review.md`
- Triggers: User types `/shipit:peer-review` with Jira ticket link
- Responsibilities: Parse Jira/GitLab URLs, git fetch hard gate, spawn peer-reviewer, post review comments, extract patterns

## Error Handling

**Strategy:** Signal-based control flow with hard gates and blocking semantics

**Patterns:**

- **`<CRITICAL_GATE>` XML tags** — Mark step as non-skippable; hard gate blocks forward progress; documented in gate body what violation causes
  - Example: `commands/go.md` "Prompt Review BEFORE exploring codebase" gate
  - Example: `commands/peer-review.md` Step 7 "git fetch origin" gate

- **`<shipit-blocked>` Signal** — Executor/agent can't continue; needs user input
  - Usage: `<shipit-blocked>Low confidence on task N: [reason]</shipit-blocked>` triggers conductor pause
  - Example: `agents/shipit-executor.md` Step 3.7 confidence assessment sends this signal on LOW confidence

- **`<shipit-replan>` Signal** — Planned approach failed mid-execution; remaining tasks need replanning
  - Usage: `<shipit-replan>reason: [what failed]</shipit-replan>` tells conductor to stop, replan remaining tasks, keep completed work
  - Example: `agents/shipit-executor.md` can signal this when implementation approach doesn't work

- **`<shipit-done/>` Signal** — All work complete; exit auto-loop
  - Usage: Verifier returns this when epic-level verification passes
  - Example: `agents/shipit-verifier.md` final step outputs this or failure summary

- **Error Handling Tables** — Agents include markdown tables mapping error conditions to responses
  - Example: `agents/shipit-conductor.md` Autonomy Modes table, `agents/shipit-executor.md` Confidence Assessment table
  - Pattern: Clear decision logic for what happens in each error scenario

- **Receipt Validation** — Reviewer checks receipt JSON fields before code review (prevents incomplete task execution)
  - Pattern: If required field missing or false, reviewer blocks and reports specifically which gate was skipped
  - Example: `agents/shipit-reviewer.md` Stage 0 validates tests_run, verify_result, checkpoint_tag

## Cross-Cutting Concerns

**Logging:** No explicit logging framework; agents use markdown tables and summary sections instead. State files serve as audit trail. Handoff.md is cumulative log of task progress.

**Validation:** Multiple gates: prompt review score (Specificity check), plan validation (self-validation in planner), receipt validation (reviewer checks proof-of-work), final verification (epic-level requirement review). Prevents accumulation of errors.

**Authentication:** Not directly handled by ShipIt core; delegates to external systems (GitLab API credentials for peer-review, git credentials for commits). Config.json may hold MCP connection strings.

**Code Quality:** Enforced through TDD (RED→GREEN→REFACTOR), per-task code review (spec + quality + patterns), LESSONS.md extraction (prevent repeated issues), and code health tracking (analytics.json tracks trend).

**Consistency:** Achieved through PROJECT_CONTEXT.md (shared codebase patterns), CLAUDE.md (project conventions), skill files (reusable workflows), and prompt engineering (agents share role/context/process sections).

**Adaptive Model Selection:** Conductor can use `adaptive_models: true` in config.json to select models per task based on complexity classification. Default uses config.json `model_profile` for all agents.

**Trust Scoring:** Progressive autonomy via analytics.json trust_score (starts 50, +5 per success, -10 per failure, -5 per review iteration). Affects autonomy_mode enforcement: score < 30 forces "guided", score > 70 allows "autonomous".

**Cost Tracking:** analytics.json persists cost_history array with per-task estimates and token counts, enabling budget tracking and cost trend analysis across runs.

---

*Architecture analysis: 2026-04-01*
