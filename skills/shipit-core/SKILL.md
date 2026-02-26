---
name: shipit-core
description: Core ShipIt plugin awareness - injected at session start
---

# ShipIt

ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, smart task decomposition, and prompt quality review into 10 commands.

## Commands

| Command | Purpose |
|---------|---------|
| `/shipit:go <task>` | Smart router — auto-detects complexity, plans, executes, loops until done |
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

1. **Load context** — Read `.shipit/` state files and `CLAUDE.md`
2. **Prompt review (MANDATORY)** — Score the prompt, generate improved version, present to user via AskUserQuestion. **You MUST call AskUserQuestion BEFORE exploring the codebase.**
3. **Analyze complexity** — Only AFTER prompt review, explore codebase and classify as quick/medium/large
4. **Plan** — For medium/large tasks, spawn shipit-planner agent to write PLAN.md
5. **Execute** — Spawn shipit-executor agents with TDD enforcement
6. **Verify** — Spawn shipit-verifier to validate completed work
7. **Loop** — Auto-loop keeps going until all tasks complete or a blocker is hit

## Auto-Loop Signals

- `<shipit-done/>` — Output this when all work is complete to exit the loop
- `<shipit-blocked>description</shipit-blocked>` — Output this when you need user input

## State Files

- `.shipit/PROJECT.md` — What we're building
- `.shipit/STATE.md` — Current position and progress
- `.shipit/PLAN.md` — Active plan with tasks
- `.shipit/HANDOFF.md` — Cumulative context from completed tasks
- `.shipit/config.json` — Preferences
- `.shipit/loop.md` — Loop state (auto-managed)
- `.shipit/prompts/history.md` — Prompt review history log

## Principles

1. **TDD by default** — Write the failing test first, always. NO production code without a failing test.
2. **Atomic commits** — One commit per completed task. Stage files individually (NEVER `git add .`).
3. **Maximum autonomy** — Keep going until done or blocked
4. **Flat state** — No deep hierarchies, just the files you need
5. **Step gates** — Each step MUST complete before the next begins. NEVER skip steps.
