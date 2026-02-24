---
name: shipit-core
description: Core ShipIt plugin awareness - injected at session start
---

# ShipIt

ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, and smart task decomposition into 8 commands.

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
| `/shipit:help` | Show usage guide |

## How It Works

1. **`/shipit:go`** is the main command. Use it for 90% of work.
2. It auto-detects task complexity (quick/medium/large) and routes accordingly.
3. For medium/large tasks, it spawns a planner agent to break work into atomic steps.
4. Each step is executed with TDD (test first, then implement, then verify).
5. An auto-loop keeps Claude working until all tasks complete or a blocker is hit.
6. State persists in `.shipit/` so you can resume across sessions.

## Auto-Loop Signals

- `<shipit-done/>` — Output this when all work is complete to exit the loop
- `<shipit-blocked>description</shipit-blocked>` — Output this when you need user input

## State Files

- `.shipit/PROJECT.md` — What we're building
- `.shipit/STATE.md` — Current position and progress
- `.shipit/PLAN.md` — Active plan with tasks
- `.shipit/config.json` — Preferences
- `.shipit/loop.md` — Loop state (auto-managed)

## Principles

1. **TDD by default** — Write the failing test first, always
2. **Atomic commits** — One commit per completed task
3. **Maximum autonomy** — Keep going until done or blocked
4. **Flat state** — No deep hierarchies, just the files you need
