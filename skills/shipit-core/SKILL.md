---
name: shipit-core
description: Core ShipIt plugin awareness - injected at session start
---

# ShipIt

ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, smart task decomposition, prompt quality review, plan validation, per-task code review, model profiles, checkpoint/rollback, and rationalization prevention into 13 commands.

## Commands

| Command | Purpose |
|---------|---------|
| `/shipit:go <task>` | Smart router — auto-detects complexity, plans, validates, executes, reviews, loops until done |
| `/shipit:quick <task>` | Fast execution — skip optional agents, just TDD and commit (1-2 files only) |
| `/shipit:plan <desc>` | Quick brainstorm + plan — review before executing |
| `/shipit:init [name]` | Lightweight project setup — creates .shipit/ with PROJECT.md and config.json |
| `/shipit:resume` | Resume from last session — spawns conductor to continue from STATE.md |
| `/shipit:status` | Show current progress — tasks, completion %, blockers |
| `/shipit:debug <issue>` | Systematic debugging with persistent state |
| `/shipit:done` | Verify + finish — runs tests, reviews diff, offers commit/PR |
| `/shipit:health` | Diagnose and repair ShipIt state files |
| `/shipit:rollback` | Rollback to a previous task checkpoint |
| `/shipit:discuss <topic>` | Discussion mode — chat about project, no code changes |
| `/shipit:update` | Update ShipIt to latest version from remote |
| `/shipit:help` | Show usage guide |

## CRITICAL: How ShipIt Works

**When `/shipit:go` or `/shipit:plan` is invoked, you MUST follow the defined step sequence. This is NON-NEGOTIABLE.**

### Thin Orchestrator Architecture

The main conversation is a **thin orchestrator** that handles only the first steps, then delegates everything to a fresh-context **conductor agent**:

**Main orchestrator (~15% context):**
1. **Load context** — Read `.shipit/` state files, `CLAUDE.md`, and run mandatory discovery protocol
2. **Prompt review (MANDATORY)** — Score the prompt, generate improved version, present to user via AskUserQuestion. **You MUST call AskUserQuestion BEFORE exploring the codebase.**
3. **Analyze complexity** — Only AFTER prompt review, explore codebase and classify as quick/medium/large
4. **Branch isolation** — For medium/large tasks, create isolated feature branch
5. **Delegate to conductor** — Spawn shipit-conductor with task context and model profile

**Conductor agent (fresh 200k context):**
6. **Research** — For large tasks: spawn shipit-researcher to explore before planning
7. **Plan** — Spawn shipit-planner to write PLAN.md (2-5 tasks max)
8. **Validate plan** — Spawn shipit-plan-checker (8 dimensions, max 2 revision iterations)
9. **Execute waves** — Spawn shipit-executor agents (parallel within waves, sequential across waves)
10. **Review each task** — Spawn shipit-reviewer after each executor (spec compliance + code quality)
11. **Verify** — Spawn shipit-verifier to validate completed work
12. **Integration check** — Spawn shipit-integration-checker for cross-task E2E verification
13. **Return status** — Returns complete/incomplete/blocked/failed to main orchestrator

**If conductor returns "incomplete"** (context budget reached), main spawns a NEW conductor that reads STATE.md/HANDOFF.md and continues from where the previous one left off. Max 3 conductor spawns.

## Agents

| Agent | Purpose | Default Model (balanced) |
|-------|---------|------------------------|
| **shipit-conductor** | Orchestrates plan-to-completion in fresh context | sonnet |
| **shipit-researcher** | Researches how to implement before planning (large tasks) | sonnet |
| **shipit-planner** | Breaks tasks into atomic steps with Wave assignments | sonnet |
| **shipit-plan-checker** | Validates plans across 8 dimensions before execution | haiku |
| **shipit-executor** | Executes one task with TDD, creates checkpoints, commits atomically | sonnet |
| **shipit-reviewer** | Reviews each task: spec compliance + code quality | haiku |
| **shipit-verifier** | Validates all completed work against original intent | sonnet |
| **shipit-integration-checker** | Cross-task E2E verification | haiku |
| **shipit-debugger** | Scientific method debugging with persistent state | sonnet |

## Auto-Loop Signals

- `<shipit-done/>` — Output this when all work is complete to exit the loop
- `<shipit-blocked>description</shipit-blocked>` — Output this when you need user input

## State Files

- `.shipit/PROJECT.md` — What we're building
- `.shipit/STATE.md` — Current position and progress
- `.shipit/PLAN.md` — Active plan with tasks
- `.shipit/RESEARCH.md` — Pre-planning research (large tasks)
- `.shipit/HANDOFF.md` — Cumulative context from completed tasks
- `.shipit/handoffs/task-N.md` — Per-task handoff files (parallel-safe, merged by conductor)
- `.shipit/DEFERRED.md` — Out-of-scope issues found during execution
- `.shipit/config.json` — Preferences (TDD, model profile, parallel execution)
- `.shipit/loop.md` — Loop state (auto-managed)
- `.shipit/prompts/history.md` — Prompt review history log
- `.shipit/debug/DEBUG.md` — Debugging session state

## Principles

1. **TDD by default** — Write the failing test first, always. NO production code without a failing test.
2. **Atomic commits** — One commit per completed task. Stage files individually (NEVER `git add .`).
3. **Maximum autonomy** — Keep going until done or blocked.
4. **Flat state** — No deep hierarchies, just the files you need.
5. **Step gates** — Each step MUST complete before the next begins. NEVER skip steps.
6. **Plan validation** — Every plan is checked by plan-checker before execution. Bad plans get revised.
7. **Per-task review** — Every task is reviewed after execution. Issues caught early, not at the end.
8. **Scope boundaries** — Out-of-scope issues go to DEFERRED.md, not inline fixes. Max 3 auto-fix attempts.
9. **Rationalization prevention** — Explicit anti-rationalization tables in every agent. "This thought means STOP."
10. **Context budgets** — Max 5 tasks per plan. Each agent gets fresh 200k context. Keep plans lean.
11. **Thin orchestrator** — Main context stays under 20%. Conductor handles planning through verification in fresh context.
12. **Wave-based parallel execution** — Tasks grouped by Wave field. Same-wave tasks run in parallel, waves execute sequentially.
13. **Parallel-safe handoffs** — Executors write to `.shipit/handoffs/task-N.md`. Conductor merges into HANDOFF.md after each wave.
14. **Git checkpoints** — Executor tags HEAD before each task (`shipit/checkpoint-task-N`). Rollback with `/shipit:rollback`.
15. **Model profiles** — quality/balanced/budget profiles optimize cost and speed across agents.
16. **Research before planning** — Large tasks get a researcher agent before the planner to prevent bad assumptions.
