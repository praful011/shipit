# ShipIt Plugin Design

**Date:** 2026-02-24
**Status:** Approved

## Problem

Using superpowers, GSD, and Ralph Loop as separate plugins creates friction:
- Too many slash commands to remember (31 GSD + superpowers skills + Ralph Loop)
- Too much ceremony for typical tasks (GSD's full project lifecycle)
- No integration between plugins (GSD doesn't enforce TDD, superpowers don't persist state)
- Context-switching between plugin paradigms slows development

## Solution

**ShipIt** — a standalone Claude Code plugin that cherry-picks the best patterns from each:
- **From GSD:** State persistence, task decomposition, parallel agent execution
- **From Superpowers:** TDD enforcement, systematic debugging, verification-before-completion
- **From Ralph Loop:** Stop hook auto-loop for autonomous execution

## Design Principles

1. **Maximum autonomy** — Claude makes decisions and keeps going; user reviews at the end
2. **One command for 90% of work** — `/shipit:go` auto-detects complexity and routes
3. **TDD by default** — baked into the executor, not a separate skill to remember
4. **Flat state** — `.shipit/` with 4-5 files, no deep directory hierarchies
5. **Works for both greenfield and existing codebases**

## Architecture

### Plugin Structure

```
shipit/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── hooks/
│   ├── hooks.json               # SessionStart + Stop hooks
│   ├── session-start.sh         # Inject shipit awareness
│   └── stop-hook.sh             # Auto-loop mechanism
├── commands/
│   ├── go.md                    # Smart router (main command)
│   ├── plan.md                  # Quick brainstorm + plan
│   ├── init.md                  # Lightweight project setup
│   ├── resume.md                # Resume from last session
│   ├── status.md                # Show progress
│   ├── debug.md                 # Systematic debugging
│   ├── done.md                  # Verify + finish + cleanup
│   └── help.md                  # Usage guide
├── agents/
│   ├── shipit-planner.md        # Task decomposition
│   ├── shipit-executor.md       # TDD-enforced execution
│   ├── shipit-verifier.md       # Work validation
│   └── shipit-debugger.md       # Root cause analysis
├── skills/
│   ├── shipit-core/
│   │   └── SKILL.md             # Core skill (SessionStart injection)
│   └── tdd/
│       └── SKILL.md             # TDD reference
├── bin/
│   └── shipit-tools.cjs         # CLI for state management
├── templates/
│   ├── project.md               # PROJECT.md template
│   └── state.md                 # STATE.md template
├── scripts/
│   └── setup-loop.sh            # Loop initialization
├── README.md
└── LICENSE
```

### Per-Project State (`.shipit/`)

```
.shipit/
├── PROJECT.md                   # What we're building (< 50 lines)
├── STATE.md                     # Current position + context
├── PLAN.md                      # Active plan (if any)
├── config.json                  # Preferences
├── loop.md                      # Active loop state
└── debug/
    └── DEBUG.md                 # Persistent debug state
```

## Commands

### `/shipit:go <task>` — Smart Router (Main Command)

Auto-detects task complexity and routes:
- **Quick** (single file, < 30 min): Execute directly with TDD
- **Medium** (2-5 files): Auto-plan 2-4 tasks, execute sequentially with TDD
- **Large** (6+ files): Plan tasks, parallel agent execution, auto-loop

Internal flow:
1. Read `.shipit/PROJECT.md` and `.shipit/STATE.md` for context
2. Analyze codebase (quick grep/glob for relevant files)
3. Classify task complexity
4. For medium/large: spawn `shipit-planner` → `.shipit/PLAN.md`
5. Spawn `shipit-executor` agent(s) — TDD enforced
6. Activate auto-loop (Stop hook)
7. Update `.shipit/STATE.md` after each task
8. Run `shipit-verifier` when all tasks complete

### `/shipit:plan <description>` — Quick Design + Plan

1. Quick brainstorm (1-2 questions max)
2. Analyze codebase for relevant files
3. Produce `.shipit/PLAN.md` with atomic tasks
4. Show plan summary, ask for approval
5. On approval: route to `/shipit:go`

### `/shipit:init [name]` — Lightweight Project Setup

1. Scan existing codebase for tech stack/structure
2. Ask 2-3 essential questions
3. Create `.shipit/PROJECT.md` (< 50 lines) and `.shipit/config.json`

### `/shipit:resume` — Resume From Last Session

1. Read `.shipit/STATE.md` for last position
2. Read `.shipit/PLAN.md` if active plan exists
3. Show summary and auto-continue

### `/shipit:status` — Show Progress

Quick dashboard: current task, completion %, recent commits, blockers.

### `/shipit:debug <issue>` — Systematic Debugging

1. Create `.shipit/debug/DEBUG.md` with hypotheses
2. Scientific method: hypothesize, test, narrow down
3. Persists across context resets
4. Auto-loops until root cause found and fixed

### `/shipit:done` — Verify + Finish

1. Run all tests
2. Verify TDD coverage
3. Quick self-review (diff-based)
4. Offer: commit / create PR / create branch
5. Clean up loop state

### `/shipit:help` — Usage Guide

## Auto-Loop Mechanism

### State File (`.shipit/loop.md`)

```yaml
---
active: true
iteration: 1
max_iterations: 50
task: "description"
started_at: "ISO timestamp"
tasks_total: 5
tasks_completed: 0
---
```

### Stop Hook Behavior

1. Read `.shipit/loop.md` — if not active, exit normally
2. Read `.shipit/STATE.md` — check task completion
3. If tasks remain: increment iteration, feed continuation prompt
4. If all done: deactivate loop, exit
5. If max iterations: deactivate, report status

### Continuation Prompt

```
Continue executing .shipit/PLAN.md. Read .shipit/STATE.md for current position.
Use TDD for all implementation tasks. Update STATE.md after each task.
```

### Escape Hatches

- `/shipit:done` — graceful completion
- Ctrl+C — state preserved, resume later
- Max iterations — stops with report
- Blocker detected — asks user for help

## TDD Integration

Baked into `shipit-executor` agent. For every implementation task:

1. **RED** — Write failing test. Run it. Confirm failure.
2. **GREEN** — Write minimal code to pass. Run tests. Confirm pass.
3. **REFACTOR** — Clean up. Run tests. Confirm still passing.
4. **COMMIT** — Atomic commit: `feat: <task-name>`

**Exceptions:**
- Config/docs/infrastructure tasks: skip TDD, still verify
- No test framework detected: warn once, proceed without

**Enforcement:** Hard gate in executor — cannot mark task complete without test evidence.

## Agents

### `shipit-planner` (Model: opus)

- **Input:** Task description + codebase context
- **Output:** `.shipit/PLAN.md` with 2-8 atomic tasks
- **Each task:** description, files to modify, acceptance criteria, complexity estimate

### `shipit-executor` (Model: sonnet or opus for complex tasks)

- **Input:** Single task from PLAN.md
- **Output:** Code changes + tests + atomic commit
- **Behavior:** TDD enforced, reads existing patterns, minimal changes

### `shipit-verifier` (Model: sonnet)

- **Input:** Original task description + codebase state
- **Output:** Pass/fail with specific issues
- **Behavior:** Runs tests, checks diff against intent

### `shipit-debugger` (Model: opus)

- **Input:** Bug description + DEBUG.md
- **Output:** Root cause + fix
- **Behavior:** Scientific method, persistent hypotheses, auto-loop

## Config (`.shipit/config.json`)

```json
{
  "tdd": true,
  "auto_loop": true,
  "max_iterations": 50,
  "model_preference": "balanced",
  "auto_commit": true,
  "parallel_execution": true,
  "max_parallel_agents": 3
}
```
