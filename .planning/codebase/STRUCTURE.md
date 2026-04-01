# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```
shipit/
├── agents/                 # Agent definitions (10 markdown files)
├── commands/               # Command definitions (14 markdown files)
├── skills/                 # Skill modules for reusable workflows
├── .shipit/                # Runtime state directory (created at runtime)
├── .claude/                # Claude Code plugin metadata
├── .claude-plugin/         # Plugin registration files
├── .planning/              # Analysis and planning docs (this directory)
├── docs/                   # Planning documents and design docs
├── prompts/                # Prompt templates (conductor, executor, planner, etc.)
├── templates/              # State file templates
├── scripts/                # Utility scripts
├── hooks/                  # Git hooks for ShipIt integration
├── bin/                    # Binary/executable files
├── CLAUDE.md               # Project conventions and guidelines (CRITICAL)
└── README.md               # Installation, quick start, architecture overview
```

## Directory Purposes

**agents/:**
- Purpose: Multi-agent orchestration definitions with YAML frontmatter + XML-tagged sections
- Contains: 10 markdown files, each defining one agent's role, context, process, and gates
- Key files:
  - `shipit-conductor.md` — Main orchestrator for plan-to-completion; wave management, autonomy enforcement
  - `shipit-planner.md` — Task decomposition, wave assignment, PLAN.md generation
  - `shipit-executor.md` — Task implementation with TDD, confidence rating, receipt generation
  - `shipit-reviewer.md` — Per-task code review (spec + quality), LESSONS.md extraction
  - `shipit-verifier.md` — Epic-level validation, integration checking, final verification
  - `shipit-peer-reviewer.md` — GitLab MR review, pattern extraction, learning loop
  - `shipit-debugger.md` — Scientific debugging workflow
  - `shipit-plan-checker.md` — Plan quality validation before execution
  - `shipit-researcher.md` — Pre-planning research for large tasks
  - `shipit-integration-checker.md` — Cross-task dependency validation

**commands/:**
- Purpose: User-facing command definitions triggered by `/shipit:command-name`
- Contains: 14 markdown files with YAML frontmatter (name, description, allowed-tools) + process steps
- Key files:
  - `go.md` — Main execution command (Steps 1-2.5: context load, prompt review, complexity, spawn conductor)
  - `init.md` — Project setup (codebase scan, model config, autonomy mode, create .shipit/)
  - `plan.md` — Planning only (prompt review → planner → show PLAN.md, don't execute)
  - `quick.md` — Fast execution for 1-2 file changes (skip optional agents)
  - `resume.md` — Continue from last session
  - `done.md` — Final verification (run tests, review diff, offer commit/PR)
  - `peer-review.md` — GitLab MR review workflow with pattern extraction
  - `debug.md`, `status.md`, `health.md`, `rollback.md`, `update.md`, `discuss.md`, `help.md`

**skills/:**
- Purpose: Reusable workflow modules for specialized tasks (detected auto-discovery)
- Location: `skills/[skill-name]/SKILL.md`
- Contains: 10 skill directories with workflows, components, examples
- Key files:
  - `shipit-core/SKILL.md` — Core awareness, commands list, agent list, state files, auto-loop signals
  - `prompt-review/SKILL.md` — Scoring (Clarity, Specificity, Actionability, Grammar, Scope), improvement generation
  - `requirement-discovery/SKILL.md` — Socratic questioning for vague tasks, decision point surfacing
  - `code-review/SKILL.md` — Multi-dimensional code review patterns, red flags, anti-patterns
  - `tdd/SKILL.md` — RED→GREEN→REFACTOR cycle, test structure, assertions
  - `git-workflow/SKILL.md` — Atomic commits, checkpoints, branching, tag management
  - `peer-review/SKILL.md` — GitLab API integration, pattern extraction, deduplication
  - `codebase-context/SKILL.md` — PROJECT_CONTEXT.md generation, code example extraction
  - `debugging-methodology/SKILL.md` — Hypothesis-driven debugging, instrumentation
  - `verification-standards/SKILL.md` — Evidence-based verification, requirement parsing

**.shipit/ (Runtime State):**
- Purpose: Persistent state directory created at first `/shipit:init` or auto-created by `/shipit:go`
- Contains: YAML + markdown state files, JSON configs, receipts, handoff logs, analytics
- Key files:
  - `STATE.md` — Current execution status (current_task, total_tasks, completed_tasks, status, branch, timestamps)
  - `PLAN.md` — Task breakdown with waves, acceptance criteria, files, TDD flags
  - `HANDOFF.md` — Cumulative log of completed tasks (what each task did, files modified)
  - `config.json` — Preferences (model_profile, autonomy_mode, tdd, adaptive_models, auto_commit)
  - `PROJECT.md` — Project context (name, description, tech stack notes)
  - `PROJECT_CONTEXT.md` — Generated codebase patterns (code examples, naming conventions, test patterns)
  - `LESSONS.md` — Review findings from this run (patterns, anti-patterns, repeated mistakes)
  - `analytics.json` — Persistent metrics (trust_score, failure patterns, cost history, code_health_trend)
  - `receipts/task-N.json` — Per-task proof-of-work (tests_run, verify_result, checkpoint_tag, confidence)
  - `prompts/history.md` — Prompt review history (original, improved, user choice)
  - `handoffs/task-N.md` — [Optional] Per-task handoff details
  - `receipts/` — Directory of JSON receipts, one per executed task

**.claude/ and .claude-plugin/:**
- Purpose: Plugin metadata and registration for Claude Code marketplace
- Contains: Plugin manifest, skill auto-discovery configuration, hooks setup

**.planning/codebase/ (Analysis Documents):**
- Purpose: GSD codebase analysis documents (written by `/gsd:map-codebase`)
- Contains: ARCHITECTURE.md, STRUCTURE.md, STACK.md, INTEGRATIONS.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Note: Documents are consumed by `/gsd:plan-phase` and `/gsd:execute-phase`

**docs/:**
- Purpose: Planning documents, design docs, historical analysis
- Contains: Subdirectory `plans/` with dated design documents explaining major features
- Examples: `2026-03-28-peer-review-learning-loop-v2-design.md`, `2026-02-24-shipit-plugin-design.md`

**prompts/:**
- Purpose: Prompt templates for agents (loaded at agent spawn time)
- Contains: Markdown files matching agent names (e.g., `conductor-prompt.md` for shipit-conductor)
- Pattern: Agents can be pre-loaded with context via prompt templates instead of inline role sections

**templates/:**
- Purpose: Markdown templates for state files (stamped at first init or auto-create)
- Contains: `state.md` (STATE.md template), `project.md` (PROJECT.md template)

**scripts/**
- Purpose: Utility scripts (bash, etc.) for ShipIt tasks
- Examples: setup, release, testing utilities

**hooks/**
- Purpose: Git hooks for ShipIt integration
- Pattern: Hooks prevent commits that don't follow ShipIt atomic commit rules
- Examples: pre-commit validations, post-merge notifications

**CLAUDE.md (CRITICAL):**
- Purpose: Project conventions, guidelines, and constraints
- Contains: File structure conventions, naming patterns, no build/test note, YAML frontmatter rules, error handling tables, tool call examples
- Read by: ALL agents at startup (mandatory discovery protocol)
- Example excerpt: "Kebab-case for all file names", "Process steps: ## Step N: Title format", "Hard gates: `<CRITICAL_GATE>` XML tags"

**README.md:**
- Purpose: Installation, quick start, commands reference, architecture explanation
- Contains: Badges, feature list, installation methods, quick start example, command table, updating instructions

## Key File Locations

**Entry Points:**
- `commands/go.md` — `/shipit:go` command handler; thin orchestrator (Steps 1-2.5)
- `commands/init.md` — `/shipit:init` command handler; project setup
- `commands/plan.md` — `/shipit:plan` command handler; planning-only workflow
- `commands/resume.md` — `/shipit:resume` command handler; continue from checkpoint

**Configuration:**
- `CLAUDE.md` — Project conventions, MUST read by all agents
- `.shipit/config.json` — User preferences (model_profile, autonomy_mode, tdd, adaptive_models)
- `.shipit/PROJECT.md` — Project metadata

**Core Logic:**
- `agents/shipit-conductor.md` — Wave-based execution orchestration, autonomy enforcement
- `agents/shipit-planner.md` — Task decomposition and dependency analysis
- `agents/shipit-executor.md` — TDD implementation, checkpoint creation, receipt generation
- `agents/shipit-reviewer.md` — Code review and pattern extraction
- `agents/shipit-verifier.md` — Final validation and requirement verification

**Testing & Quality:**
- `skills/tdd/SKILL.md` — TDD workflow (RED→GREEN→REFACTOR)
- `skills/code-review/SKILL.md` — Code review patterns and red flags

**State & Persistence:**
- `.shipit/STATE.md` — Current execution status (gate-checked before resuming)
- `.shipit/PLAN.md` — Task breakdown (read by executor, reviewer, verifier)
- `.shipit/HANDOFF.md` — Cumulative task history (read by each executor)
- `.shipit/LESSONS.md` — Review findings (read by executors to avoid repeating mistakes)
- `.shipit/analytics.json` — Trust score and failure patterns (affects autonomy_mode enforcement)

## Naming Conventions

**Files:**
- Kebab-case: `shipit-conductor.md`, `peer-review.md`, `tdd/SKILL.md`
- State files: Uppercase (STATE.md, PLAN.md, HANDOFF.md, LESSONS.md)
- JSON configs: lowercase (config.json, analytics.json)

**Directories:**
- Kebab-case for feature areas: `skills/codebase-context/`, `skills/peer-review/`
- Dot-prefixed for runtime: `.shipit/`, `.claude/`, `.claude-plugin/`, `.planning/`

**Markdown Sections:**
- Process steps: `## Step N: Title` format (sequential numbering)
- Subsections: `### N.A: Subtitle`, `### N.B: Subtitle` (letter suffixes for gated substeps)
- XML gates: `<CRITICAL_GATE>` for non-skippable, `<shipit-blocked>`, `<shipit-replan>`, `<shipit-done/>`
- YAML frontmatter: `name`, `description`, `allowed-tools` (optional for commands)
- Role sections: `<role>`, `<project_context>`, `<process>`, `<critical_rules>`

## Where to Add New Code

**New Command:**
- Location: `commands/[command-name].md`
- Template: YAML frontmatter (name, description, allowed-tools), `<objective>`, `<critical_rules>`, `<process>` with numbered steps
- References: Link to related agents/skills in process steps
- Example: `commands/peer-review.md` shows how to integrate external systems (GitLab API)

**New Agent:**
- Location: `agents/[agent-name].md`
- Template: YAML frontmatter (name, description), `<role>`, `<project_context>`, `<process>` with numbered steps, gates
- Key pattern: Mandatory initial read section (read files from `<files_to_read>` block), discovery protocol, hard gates
- Example: `agents/shipit-executor.md` shows full implementation with confidence assessment, checkpoint creation, receipt generation

**New Skill:**
- Location: `skills/[skill-name]/SKILL.md`
- Template: YAML frontmatter (name, description), Prerequisites section, Workflow section with process steps, Components section listing sub-agents
- Pattern: Reusable workflow invoked by agents via Skill tool call or inline reference
- Example: `skills/prompt-review/SKILL.md` shows how to structure scoring, improvement, and presentation

**New State File Type:**
- Location: `.shipit/[file-name].md` or `.shipit/[file-name].json`
- Pattern: Create template in `templates/` directory, then stamp at init time or auto-create during execution
- Example: `templates/state.md` is stamped to `.shipit/STATE.md` at init

**Utilities & Helpers:**
- Shared helpers: `scripts/` for bash utilities, `hooks/` for git integration
- Reusable patterns: Extract to `skills/` as new skill modules for multi-agent discovery

## Special Directories

**`.shipit/` (Runtime State):**
- Purpose: Execution state, persistence across sessions
- Generated: At `/shipit:init` (creates initial state) or auto-created by `/shipit:go`
- Committed: `.shipit/*.md` and `.shipit/config.json` are committed; `.shipit/receipts/` and `.shipit/prompts/history.md` are also committed; `.shipit/analytics.json` persists across runs
- Note: This is NOT a cache — it's the system-of-record for execution state

**`.planning/codebase/` (Analysis Documents):**
- Purpose: GSD codebase mapping analysis (written by `/gsd:map-codebase` commands)
- Generated: On-demand by developer or `/gsd:` commands
- Committed: Yes, analysis documents are version-controlled
- Contents: ARCHITECTURE.md, STRUCTURE.md, STACK.md, INTEGRATIONS.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**`.claude/` and `.claude-plugin/`:**
- Purpose: Claude Code plugin metadata and manifest
- Generated: Plugin framework (not user-generated)
- Committed: Yes
- Contains: Plugin manifest, skill registry, hooks configuration

**`skills/` (Skill Modules):**
- Purpose: Reusable workflow modules
- Generated: Some pre-built (shipped with ShipIt), some generated (e.g., `pr-review-patterns/SKILL.md` written by peer-reviewer)
- Committed: Yes, including generated patterns
- Auto-discovery: Claude Code scans `skills/*/SKILL.md` automatically

**`docs/`:**
- Purpose: Historical design documents and planning docs
- Generated: Created during design phases
- Committed: Yes
- Contents: Dated design docs explaining architecture decisions

## Code Organization Principles

**Separation of Concerns:**
- Commands define user-facing workflows (Steps 1-2.5)
- Conductor manages waves and orchestration
- Agents are specialized (planner, executor, reviewer, verifier)
- Skills are reusable modules (prompt-review, code-review, git-workflow)
- State files (PLAN.md, HANDOFF.md, LESSONS.md) are the data layer

**Process Gates Over Implementation Logic:**
- Hard gates (`<CRITICAL_GATE>`) prevent skipping required steps
- Signal-based control flow (`<shipit-blocked>`, `<shipit-replan>`, `<shipit-done/>`) for complex decisions
- Mandatory discovery protocols ensure agents find context before acting
- Receipt validation ensures proof-of-work before review

**Markdown as Code:**
- Agents and commands are executable markdown (YAML frontmatter + XML sections + markdown process)
- No source code (no .ts, .js, .py files) — purely documentation-driven
- Structural validation: proper frontmatter, process steps numbered, gates documented

**State Locality:**
- Each agent reads only the state files it needs (PLAN.md, HANDOFF.md, STATE.md)
- Atomic state updates (e.g., executor appends to HANDOFF.md, doesn't rewrite entire file)
- Versioning via git tags (checkpoint tags per task) and timestamps in state files

---

*Structure analysis: 2026-04-01*
