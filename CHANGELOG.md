# Changelog

All notable changes to ShipIt are documented in this file.

## [3.0.0] - 2026-02-27

### Intelligence & Awareness (NEW — no other plugin has these)
- **Confidence-aware execution** — Executor self-rates confidence (HIGH/MEDIUM/LOW) before implementing. LOW = stop and ask human. MEDIUM = stricter review. Confidence recorded in receipt.
- **Adaptive model selection** — Dynamic per-task model choice based on complexity. Simple fix → haiku. Complex auth → opus. Overrides static profiles.
- **Progressive autonomy / trust score** — Persistent trust score in `analytics.json`. Builds over sessions (+5 per success, -10 per failure). Affects autonomy mode.
- **Supervised autonomy modes** — Three modes: guided (confirm all), supervised (pause per wave), autonomous (full autopilot). Trust score can auto-adjust mode.
- **Code health tracking** — Tracks if codebase gets better or worse per task. Health trend in analytics.json.
- **Failure analytics** — Persistent `analytics.json` tracks: total runs, success rate, common failures, avg review iterations, cost history.
- **Cost tracking** — Estimate token cost per agent spawn. Accumulate per run. Respect `cost_budget` config.

### Quality Pipeline (NEW)
- **Shared codebase context** — `PROJECT_CONTEXT.md` generated before planning with real code examples. All agents read it.
- **Auto-CLAUDE.md** — If no CLAUDE.md exists, generate one from codebase analysis for consistent agent behavior.
- **Requirement discovery** — When prompt Specificity < 60%, trigger Socratic questioning (2-4 focused questions) before planning.
- **Re-anchoring / drift prevention** — Every executor re-reads original task from PLAN.md frontmatter before implementing.
- **Self-review before commit** — Executor reviews own `git diff` for debug code, TODOs, unnecessary changes.
- **Receipt-based proof** — `.shipit/receipts/task-N.json` with confidence, tests_run, verify_result, self_review. Machine-verifiable.
- **Learning loop** — Reviewer extracts IMPORTANT/CRITICAL findings to `LESSONS.md`. Future executors read and avoid past mistakes.
- **Epic-level verification** — Verifier parses EVERY requirement from original task, verifies each with evidence (file:line or test name).

### Architecture Changes
- **Adaptive re-planning** — When executor signals `<shipit-replan>`, conductor re-plans remaining tasks (keeps completed work).
- **Self-validating plans** — Planner checks 8 dimensions internally. Plan-checker agent merged into planner.
- **Merged verifier** — Integration-checker merged into verifier. One agent does epic-level requirements + cross-task integration.
- **Agents reduced 9 → 7** — Plan-checker merged into planner, integration-checker merged into verifier. Faster, cheaper.
- **Dependency-aware wave safety** — Planner analyzes import graph before wave assignment. Shared dependencies = different waves.
- **Incremental testing** — Executor runs only affected tests during RED/GREEN. Full suite at verification.
- **MCP integration hooks** — Optional: Engram (blast radius), Depwire (dependency graph), Context7 (API docs).
- **Trimmed rationalization tables** — 20-line tables → 3-line rules per agent. Saves ~100 lines of agent context.

### New Skills
- **requirement-discovery** — Socratic requirement discovery (2-4 focused questions, concrete options)
- **codebase-context** — PROJECT_CONTEXT.md generation from real code examples

### New Config Options
- `autonomy_mode` — "guided" / "supervised" / "autonomous"
- `adaptive_models` — Dynamic per-task model selection
- `mcp_integrations` — Optional MCP server hooks
- `cost_budget` — Max cost per run in dollars

### New State Files
- `.shipit/PROJECT_CONTEXT.md` — Shared codebase patterns for all agents
- `.shipit/LESSONS.md` — Review findings for future executors
- `.shipit/receipts/task-N.json` — Machine-verifiable proof of execution
- `.shipit/analytics.json` — Persistent analytics (trust, cost, health)

### Breaking Changes
- Plan-checker agent removed (merged into planner self-validation)
- Integration-checker agent removed (merged into verifier)
- Receipt file now required — conductor verifies receipts before reviews
- Confidence field added to receipt format
- Config schema expanded with 4 new fields

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
