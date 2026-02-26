---
name: shipit-core
description: Core ShipIt plugin awareness - injected at session start
---

# ShipIt

ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, smart task decomposition, prompt quality review, plan validation, per-task code review, and rationalization prevention into 10 commands.

## Commands

| Command | Purpose |
|---------|---------|
| `/shipit:go <task>` | Smart router — auto-detects complexity, plans, validates, executes, reviews, loops until done |
| `/shipit:plan <desc>` | Quick brainstorm + plan — review before executing |
| `/shipit:init [name]` | Lightweight project setup — creates .shipit/ with PROJECT.md |
| `/shipit:resume` | Resume from last session — reads STATE.md and continues |
| `/shipit:status` | Show current progress — tasks, completion %, blockers |
| `/shipit:debug <issue>` | Systematic debugging with persistent state |
| `/shipit:done` | Verify + finish — runs tests, reviews diff, offers commit/PR |
| `/shipit:discuss <topic>` | Discussion mode — chat about project, no code changes |
| `/shipit:update` | Update ShipIt to latest version from remote |
| `/shipit:help` | Show usage guide |

## CRITICAL: How ShipIt Works

**When `/shipit:go` or `/shipit:plan` is invoked, you MUST follow the defined step sequence. This is NON-NEGOTIABLE.**

1. **Load context** — Read `.shipit/` state files, `CLAUDE.md`, and run mandatory discovery protocol
2. **Prompt review (MANDATORY)** — Score the prompt, generate improved version, present to user via AskUserQuestion. **You MUST call AskUserQuestion BEFORE exploring the codebase.**
3. **Analyze complexity** — Only AFTER prompt review, explore codebase and classify as quick/medium/large
4. **Branch isolation** — For medium/large tasks, create isolated feature branch
5. **Plan** — Spawn shipit-planner agent to write PLAN.md (2-5 tasks max)
6. **Validate plan** — Spawn shipit-plan-checker to verify plan quality (8 dimensions). Revision loop max 2 iterations.
7. **Execute** — Spawn shipit-executor agents with TDD enforcement
8. **Review each task** — Spawn shipit-reviewer after each executor (spec compliance + code quality)
9. **Verify** — Spawn shipit-verifier to validate completed work
10. **Loop** — Auto-loop keeps going until all tasks complete or a blocker is hit

## Agents

| Agent | Purpose |
|-------|---------|
| **shipit-planner** | Breaks tasks into atomic steps with exact file paths, Do/Verify fields |
| **shipit-plan-checker** | Validates plans across 8 dimensions before execution |
| **shipit-executor** | Executes one task with TDD, commits atomically |
| **shipit-reviewer** | Reviews each task: spec compliance + code quality |
| **shipit-verifier** | Validates all completed work against original intent |
| **shipit-debugger** | Scientific method debugging with persistent state |

## Auto-Loop Signals

- `<shipit-done/>` — Output this when all work is complete to exit the loop
- `<shipit-blocked>description</shipit-blocked>` — Output this when you need user input

## State Files

- `.shipit/PROJECT.md` — What we're building
- `.shipit/STATE.md` — Current position and progress
- `.shipit/PLAN.md` — Active plan with tasks
- `.shipit/HANDOFF.md` — Cumulative context from completed tasks
- `.shipit/DEFERRED.md` — Out-of-scope issues found during execution
- `.shipit/config.json` — Preferences
- `.shipit/loop.md` — Loop state (auto-managed)
- `.shipit/prompts/history.md` — Prompt review history log

## Principles

1. **TDD by default** — Write the failing test first, always. NO production code without a failing test.
2. **Atomic commits** — One commit per completed task. Stage files individually (NEVER `git add .`).
3. **Maximum autonomy** — Keep going until done or blocked
4. **Flat state** — No deep hierarchies, just the files you need
5. **Step gates** — Each step MUST complete before the next begins. NEVER skip steps.
6. **Plan validation** — Every plan is checked by plan-checker before execution. Bad plans get revised.
7. **Per-task review** — Every task is reviewed after execution. Issues caught early, not at the end.
8. **Scope boundaries** — Out-of-scope issues go to DEFERRED.md, not inline fixes. Max 3 auto-fix attempts.
9. **Rationalization prevention** — Explicit anti-rationalization tables in every agent. "This thought means STOP."
10. **Context budgets** — Max 5 tasks per plan. Each agent gets fresh 200k context. Keep plans lean.
