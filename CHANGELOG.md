# Changelog

All notable changes to ShipIt are documented in this file.

## [2.0.0] - 2026-02-26

### Architecture
- **Thin orchestrator pattern** — Main context handles only prompt review + complexity analysis (~15%), delegates everything else to fresh-context conductor agent
- **Wave-based parallel execution** — Tasks grouped by Wave field, same-wave tasks run in parallel, waves execute sequentially
- **Parallel-safe handoffs** — Executors write to `.shipit/handoffs/task-N.md`, conductor merges after each wave
- **Conductor continuation** — When context fills, conductor returns "incomplete", main spawns new conductor to continue

### New Agents
- **shipit-conductor** — Orchestrates plan-to-completion in fresh context (planning, validation, execution, review, verification)
- **shipit-plan-checker** — Validates plans across 8 dimensions before execution
- **shipit-reviewer** — Per-task code review (spec compliance + code quality) after each executor
- **shipit-researcher** — Researches how to implement before planning (for large tasks)
- **shipit-integration-checker** — Cross-task E2E verification after all tasks complete

### New Commands
- `/shipit:quick` — Fast execution for simple tasks (skip optional agents, just TDD and commit)
- `/shipit:health` — Diagnose and repair ShipIt state files
- `/shipit:rollback` — Rollback to a previous task checkpoint via git tags

### New Skills
- **debugging-methodology** — Scientific debugging reference (Iron Law, phases, anti-patterns)
- **code-review** — Review guidelines, severity levels, evidence requirements
- **git-workflow** — Branching strategy, atomic commits, staging rules
- **verification-standards** — What "verified" means, forbidden language, evidence

### New Features
- **Model profiles** — quality/balanced/budget profiles for agent model selection (config.json `model_profile`)
- **Git checkpoints** — Executor creates `shipit/checkpoint-task-N` tag before each task for safe rollback
- **Config defaults and validation** — `/shipit:health` checks and repairs config
- **Version tracking** — VERSION file and CHANGELOG.md for update tracking
- **Prompt templates** — Standardized spawn templates for all agents (prompts/ directory)
- **Conductor prompt template** — Fresh start, continuation, and resume templates

### Improvements
- **Strong enforcement language** — CRITICAL/MUST/NEVER gates on every step (GSD-style enforcement)
- **Rationalization prevention** — Anti-rationalization tables in every agent
- **Scope boundaries** — DEFERRED.md for out-of-scope issues, max 3 auto-fix attempts
- **Context budgets** — Max 5 tasks per plan, agent context caps, conductor self-assessment
- **Mandatory discovery protocol** — CLAUDE.md + project skills read before any work
- **Resume uses conductor** — `/shipit:resume` spawns fresh conductor instead of inline continuation

### Breaking Changes
- `/shipit:go` now delegates to conductor agent for medium/large tasks (was inline execution)
- `/shipit:resume` now spawns conductor (was loop re-activation)
- PLAN.md format now requires Wave and Depends fields
- Executors write to `.shipit/handoffs/task-N.md` instead of directly to HANDOFF.md

## [1.0.0] - Initial Release

### Features
- `/shipit:go` — Smart router with auto-complexity detection
- `/shipit:plan` — Plan before executing
- `/shipit:init` — Project setup
- `/shipit:resume` — Session persistence
- `/shipit:status` — Progress dashboard
- `/shipit:debug` — Scientific debugging
- `/shipit:done` — Verify and finish
- `/shipit:discuss` — Discussion mode
- `/shipit:update` — Self-update
- `/shipit:help` — Usage guide
- TDD enforcement (RED → GREEN → REFACTOR)
- Auto-loop via stop hook
- HANDOFF.md cross-task context
- 4 agents (planner, executor, debugger, verifier)
