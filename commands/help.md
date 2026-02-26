---
name: shipit:help
description: Show ShipIt usage guide and available commands
allowed-tools: []
---

Display this help text to the user:

```
# ShipIt v2.0 — Unified Development Plugin

## Commands

### Core Workflow
  /shipit:go <task>       The main command. Reviews prompt, plans, executes with TDD, loops until done.
  /shipit:quick <task>    Fast execution for simple tasks (1-2 files). Skip agents, just TDD and commit.
  /shipit:plan <desc>     Create and review a plan before executing.

### Session Management
  /shipit:init [name]     Set up a new project. Creates .shipit/ with PROJECT.md and config.json.
  /shipit:resume          Resume work from a previous session. Spawns conductor to continue.
  /shipit:status          Show current progress dashboard.
  /shipit:done            Verify work and finish (commit, PR, or report).

### Safety & Debugging
  /shipit:debug <issue>   Systematic debugging with persistent state.
  /shipit:health          Diagnose and repair ShipIt state files.
  /shipit:rollback        Rollback to a previous task checkpoint.

### Other
  /shipit:discuss <topic> Chat about your project without code changes.
  /shipit:update          Update ShipIt to the latest version.
  /shipit:help            This help text.

## Examples

  /shipit:go add user authentication with JWT tokens
  /shipit:go fix the cart total not updating on item removal
  /shipit:quick fix the typo in the login error message
  /shipit:plan redesign the database schema for multi-tenancy
  /shipit:debug login returns 403 after password reset
  /shipit:discuss should we use WebSockets or SSE for real-time?
  /shipit:health
  /shipit:rollback

## How /shipit:go Works (Thin Orchestrator)

  Main (~15% context):
    1. Load context → 2. Review prompt → 3. Analyze complexity → 4. Branch → 5. Spawn conductor

  Conductor (fresh 200k context):
    6. Research (large only) → 7. Plan → 8. Validate plan → 9. Execute waves
    → 10. Review each task → 11. Verify → 12. Integration check → Done!

## Model Profiles (config.json)

  "quality"   — Best output, higher cost (opus for key agents)
  "balanced"  — Good quality, reasonable cost (default, sonnet + haiku)
  "budget"    — Fastest, lowest cost (haiku for most agents)

  Set in .shipit/config.json: "model_profile": "balanced"
  Override specific agents: "model_overrides": {"executor": "opus"}

## Agents (9 total)

  Conductor          Orchestrates plan-to-completion in fresh context
  Researcher         Explores codebase before planning (large tasks)
  Planner            Creates atomic tasks with wave assignments
  Plan Checker       Validates plan across 8 dimensions
  Executor           Implements task with TDD + git checkpoints
  Reviewer           Per-task code review (spec + quality)
  Verifier           Validates completed work against intent
  Integration Checker Checks cross-task E2E flows
  Debugger           Scientific debugging with persistent state

## State Files (.shipit/)

  PROJECT.md          What the project is about
  STATE.md            Current progress and position
  PLAN.md             Active plan with tasks and waves
  RESEARCH.md         Pre-planning research (large tasks)
  HANDOFF.md          Cumulative context from completed tasks
  DEFERRED.md         Out-of-scope issues for later
  config.json         Preferences, model profile, parallelism
  loop.md             Auto-loop state (managed automatically)
  handoffs/task-N.md  Per-task handoff files (parallel-safe)
  prompts/history.md  Prompt review history log
  debug/DEBUG.md      Debugging session state

## Git Checkpoints

  Each task creates: shipit/checkpoint-task-N
  Rollback anytime: /shipit:rollback
  Backup branch created before any rollback.

## Configuration (.shipit/config.json)

  tdd: true                    Enforce TDD (default: true)
  auto_loop: true              Enable auto-loop (default: true)
  max_iterations: 50           Max loop iterations (default: 50)
  auto_commit: true            Commit after each task (default: true)
  parallel_execution: true     Allow parallel agents (default: true)
  max_parallel_agents: 3       Max concurrent agents (default: 3)
  model_profile: "balanced"    Agent model selection
  model_overrides: {}          Override specific agent models
```
