---
name: shipit:help
description: Show ShipIt usage guide and available commands
allowed-tools: []
---

Display this help text to the user:

```
# ShipIt — Unified Development Plugin

## Commands

### /shipit:go <task>
The main command. Auto-detects task complexity and executes with TDD.
Examples:
  /shipit:go add user authentication with JWT
  /shipit:go fix the login bug where sessions expire early
  /shipit:go refactor the payment module to use Stripe SDK v3

### /shipit:plan <description>
Create a plan and review it before executing.
Examples:
  /shipit:plan redesign the database schema for multi-tenancy

### /shipit:init [name]
Set up a new project. Creates .shipit/ with PROJECT.md and config.
Examples:
  /shipit:init my-saas-app

### /shipit:resume
Resume work from a previous session.

### /shipit:status
Show current progress dashboard.

### /shipit:debug <issue>
Systematic debugging with persistent state.
Examples:
  /shipit:debug login returns 403 after password reset

### /shipit:done
Verify work and finish (commit, PR, or just report).

### /shipit:discuss <topic>
Discussion mode — chat about your project without code changes.
Examples:
  /shipit:discuss should we use Redis or Memcached for caching?
  /shipit:discuss walk me through the auth flow
  /shipit:discuss what's the best way to handle file uploads?

### /shipit:update
Update ShipIt to the latest version from remote.

### /shipit:help
This help text.

## How It Works

1. /shipit:go auto-detects task complexity (quick/medium/large)
2. For medium/large tasks, it creates a plan with atomic steps
3. Each step is executed with TDD (test first, then implement)
4. An auto-loop keeps going until all tasks complete
5. State persists in .shipit/ so you can resume across sessions

## State Files (.shipit/)

- PROJECT.md — What the project is about
- STATE.md — Current progress and position
- PLAN.md — Active plan with tasks
- HANDOFF.md — Cumulative context from completed tasks
- config.json — Preferences (TDD, loop, parallelism)
- loop.md — Auto-loop state (managed automatically)
- debug/DEBUG.md — Debugging session state

## Configuration (.shipit/config.json)

  tdd: true          — Enforce TDD (default: true)
  auto_loop: true    — Enable auto-loop (default: true)
  max_iterations: 50 — Max loop iterations (default: 50)
  auto_commit: true  — Commit after each task (default: true)
```
