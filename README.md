<p align="center">
  <h1 align="center">ShipIt</h1>
  <p align="center">
    <strong>One command to ship features. Plan, Execute, Loop, Done.</strong>
  </p>
  <p align="center">
    <a href="#installation">Install</a> · <a href="#quick-start">Quick Start</a> · <a href="#commands">Commands</a> · <a href="#how-it-works">How It Works</a> · <a href="#architecture">Architecture</a> · <a href="#updating">Update</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
    <img src="https://img.shields.io/badge/version-2.0.0-green.svg" alt="Version: 2.0.0">
    <img src="https://img.shields.io/badge/claude--code-plugin-purple.svg" alt="Claude Code Plugin">
  </p>
</p>

---

ShipIt is a **Claude Code plugin** that turns a single sentence into shipped code. It combines smart task decomposition, TDD enforcement, multi-agent orchestration, wave-based parallel execution, per-task code review, and auto-looping into one seamless workflow.

> **No more babysitting.** Tell Claude what to build. ShipIt plans it, tests it, reviews it, loops until it's done, and persists state across sessions.

### Why ShipIt?

- **Thin Orchestrator** — Main context stays lean (~15%). Heavy work happens in fresh-context agents.
- **Prompt Review** — Scores your prompt quality, suggests an improved version, and lets you choose.
- **Smart Routing** — Auto-detects task complexity (quick/medium/large) and routes accordingly.
- **Research-First Planning** — Large tasks get a researcher agent before planning to prevent bad assumptions.
- **Plan Validation** — Every plan is checked across 8 dimensions before execution. Bad plans get revised.
- **TDD by Default** — Every code change goes through RED, GREEN, REFACTOR.
- **Wave-Based Parallel Execution** — Independent tasks run in parallel within waves.
- **Per-Task Code Review** — Every task is reviewed for spec compliance + code quality immediately after execution.
- **Integration Checking** — Cross-task E2E verification after all tasks complete.
- **Auto-Loop** — Keeps working autonomously until all tasks complete or a blocker is hit.
- **Git Checkpoints** — Every task creates a checkpoint tag for safe rollback.
- **Model Profiles** — quality/balanced/budget modes optimize cost and speed across agents.
- **Session Persistence** — Resume across sessions with `.shipit/` state files.
- **Atomic Commits** — One commit per completed task, clean git history.

---

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI (latest version)
- Git (for atomic commits, checkpoints, and PR workflows)

---

## Installation

### Quick Install (2 commands)

Run these inside Claude Code:

```
/plugin marketplace add praful011/shipit
```

```
/plugin install shipit@shipit-marketplace
```

Restart Claude Code. Done! You now have `/shipit:go` and all other commands.

### Alternative: Direct from Git (Development)

Load ShipIt without installing — great for development or trying it out:

```bash
claude --plugin-dir /path/to/shipit
```

Or clone and load:

```bash
git clone https://github.com/praful011/shipit.git
claude --plugin-dir ./shipit
```

### Alternative: Add to Your Own Marketplace

If you maintain a custom marketplace, add ShipIt as a plugin source:

```json
{
  "name": "shipit",
  "source": {
    "source": "url",
    "url": "https://github.com/praful011/shipit.git"
  },
  "description": "One command to ship features.",
  "version": "2.0.0"
}
```

Then install:

```
/plugin install shipit@your-marketplace
```

---

## Updating

Already have ShipIt installed? Update to the latest version:

```
/shipit:update
```

This will:
1. Check for new commits on the remote
2. Show you what changed (from CHANGELOG.md)
3. Ask for confirmation before pulling
4. Remind you to restart Claude Code to load the update

---

## Quick Start

### Ship a feature in one command

```
/shipit:go add user authentication with JWT tokens
```

That's it. ShipIt will:
1. **Review** your prompt — score quality, suggest an improved version, let you choose
2. **Analyze** complexity — classify as quick/medium/large
3. **Branch** — create isolated feature branch (medium/large)
4. **Research** — explore the codebase to understand patterns (large tasks)
5. **Plan** — decompose into atomic tasks with wave assignments
6. **Validate** — check the plan across 8 dimensions
7. **Execute** — run each task with TDD in fresh context, parallel within waves
8. **Review** — spec compliance + code quality after each task
9. **Verify** — check the result matches original intent
10. **Integration check** — verify cross-task E2E flows

### Quick tasks (skip the overhead)

```
/shipit:quick fix the typo in the login error message
```

Skips prompt review, planning, and agents. Just: understand, test, implement, commit.

### Plan first, then execute

```
/shipit:plan redesign the database schema for multi-tenancy
```

Review the plan, then approve to start execution.

### Debug systematically

```
/shipit:debug users get 403 after password reset
```

Uses the scientific method: reproduce, hypothesize, test, fix.

### Discuss without changing code

```
/shipit:discuss should we use WebSockets or SSE for real-time updates?
```

Chat about architecture, approaches, or ideas — ShipIt reads your codebase to give informed answers but won't modify anything.

### Check state health

```
/shipit:health
```

Diagnose and repair corrupted or inconsistent state files.

### Rollback if something goes wrong

```
/shipit:rollback
```

Revert to a previous task checkpoint (creates backup branch first).

---

## Commands

| Command | Purpose |
|---------|---------|
| `/shipit:go <task>` | Smart router — reviews prompt, plans, validates, executes, reviews, loops |
| `/shipit:quick <task>` | Fast execution — TDD and commit, skip optional agents (1-2 files) |
| `/shipit:plan <desc>` | Brainstorm + plan — review before executing |
| `/shipit:init [name]` | Project setup — creates .shipit/ with PROJECT.md and config.json |
| `/shipit:resume` | Resume from last session — spawns conductor to continue |
| `/shipit:status` | Progress dashboard — tasks, completion %, blockers |
| `/shipit:debug <issue>` | Systematic debugging with persistent state |
| `/shipit:done` | Verify + finish — runs tests, offers commit/PR |
| `/shipit:health` | Diagnose and repair state files |
| `/shipit:rollback` | Rollback to a task checkpoint |
| `/shipit:discuss <topic>` | Discussion mode — no code changes |
| `/shipit:update` | Update to latest version |
| `/shipit:help` | Show usage guide |

---

## Configuration

ShipIt stores configuration in `.shipit/config.json`. Created by `/shipit:init` with sensible defaults:

```json
{
  "tdd": true,
  "auto_loop": true,
  "max_iterations": 50,
  "auto_commit": true,
  "parallel_execution": true,
  "max_parallel_agents": 3,
  "model_profile": "balanced",
  "model_overrides": {}
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `tdd` | `true` | Enforce TDD (RED, GREEN, REFACTOR) for code changes |
| `auto_loop` | `true` | Keep working autonomously until done or blocked |
| `max_iterations` | `50` | Maximum loop iterations before stopping |
| `auto_commit` | `true` | Commit after each completed task |
| `parallel_execution` | `true` | Allow parallel agent execution within waves |
| `max_parallel_agents` | `3` | Maximum concurrent agents per wave |
| `model_profile` | `"balanced"` | Agent model selection (see Model Profiles) |
| `model_overrides` | `{}` | Override specific agent models |

### Model Profiles

Control cost and speed by choosing which models agents use:

| Profile | Best For | Cost |
|---------|----------|------|
| `"quality"` | Critical production code, complex features | Highest |
| `"balanced"` | Day-to-day development (default) | Medium |
| `"budget"` | Simple tasks, prototyping, learning | Lowest |

**Agent model assignments by profile:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| Planner | opus | sonnet | sonnet |
| Plan Checker | sonnet | haiku | haiku |
| Executor | opus | sonnet | haiku |
| Reviewer | sonnet | haiku | haiku |
| Verifier | opus | sonnet | haiku |
| Researcher | opus | sonnet | haiku |
| Integration Checker | sonnet | haiku | haiku |

**Override specific agents:**

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "executor": "opus",
    "reviewer": "sonnet"
  }
}
```

---

## State Files

ShipIt persists all state in the `.shipit/` directory:

```
.shipit/
├── PROJECT.md         # What the project is about
├── STATE.md           # Current progress and position
├── PLAN.md            # Active plan with tasks and waves
├── RESEARCH.md        # Pre-planning research (large tasks)
├── HANDOFF.md         # Cumulative context from completed tasks
├── DEFERRED.md        # Out-of-scope issues for later
├── config.json        # Preferences and model profile
├── loop.md            # Auto-loop state (managed automatically)
├── handoffs/          # Per-task handoff files (parallel-safe)
│   ├── task-1.md
│   ├── task-2.md
│   └── ...
├── prompts/
│   └── history.md     # Prompt review history log
└── debug/
    └── DEBUG.md       # Debugging session state
```

| File | Purpose | Created by |
|------|---------|------------|
| `PROJECT.md` | Project description, tech stack, constraints | `/shipit:init` |
| `STATE.md` | Status, current task number, timestamps | `/shipit:go` |
| `PLAN.md` | Task list with Do/Verify, Waves, Dependencies | Planner agent |
| `RESEARCH.md` | Codebase analysis and approach recommendations | Researcher agent |
| `HANDOFF.md` | Cumulative log of completed tasks with context | Conductor (merged) |
| `DEFERRED.md` | Out-of-scope issues found during execution | Executor agent |
| `config.json` | User preferences and model profile | `/shipit:init` |
| `loop.md` | Loop iteration counter, active flag | Stop hook |
| `handoffs/task-N.md` | Individual task handoff (parallel-safe) | Executor agent |
| `prompts/history.md` | Prompt review log (original, improved, scores) | `/shipit:go`, `/shipit:plan` |
| `debug/DEBUG.md` | Hypotheses, test results, root cause | Debugger agent |

> **Tip:** Add `.shipit/` to your `.gitignore` — it's session state, not source code.

---

## How It Works

### The Main Flow (`/shipit:go`)

```
User: /shipit:go add user authentication
         │
         ▼
┌─── THIN ORCHESTRATOR (~15% context) ────┐
│                                          │
│  1. Load context (.shipit/ files)        │
│  2. Score & review prompt (AskUser)      │
│  3. Analyze complexity → medium          │
│  4. Create feature branch                │
│  5. Spawn conductor ──────────────────┐  │
│                                       │  │
└───────────────────────────────────────┘  │
                                           │
┌─── CONDUCTOR (fresh 200k context) ───────┘
│
│  6. [Large only] Spawn RESEARCHER
│     └── Writes RESEARCH.md
│
│  7. Spawn PLANNER
│     └── Writes PLAN.md (3 tasks, 2 waves)
│
│  8. Spawn PLAN-CHECKER
│     └── Validates 8 dimensions → PASS
│
│  9. Initialize STATE.md + HANDOFF.md
│
│  WAVE 1 (parallel):
│  ├── Spawn EXECUTOR (Task 1) ──► checkpoint ──► TDD ──► commit
│  └── Spawn EXECUTOR (Task 2) ──► checkpoint ──► TDD ──► commit
│  │
│  ├── Merge handoffs into HANDOFF.md
│  ├── Spawn REVIEWER (Task 1) → APPROVED
│  └── Spawn REVIEWER (Task 2) → APPROVED
│
│  WAVE 2 (sequential):
│  └── Spawn EXECUTOR (Task 3) ──► checkpoint ──► TDD ──► commit
│  │
│  ├── Merge handoff
│  └── Spawn REVIEWER (Task 3) → APPROVED
│
│  10. Spawn VERIFIER → PASS
│  11. Spawn INTEGRATION-CHECKER → SHIP IT
│  12. Return "complete"
│
└──────────────────────────────────────────

Orchestrator: ✅ <shipit-done/>
```

### Task Handoff System

Each executor runs in a **fresh context window** (200k tokens). Fresh context means no overflow, but also no knowledge of previous work. **HANDOFF.md** solves this:

```markdown
# ShipIt Handoff Log

## Task 1: Set up Stripe SDK
- **Files changed:** src/config/stripe.ts, package.json
- **What was done:** Installed stripe@14, created config with env var
- **Key decisions:** Used STRIPE_SECRET_KEY env var
- **Context for next tasks:** Import stripe config from src/config/stripe.ts

## Task 2: Create payment endpoint
- **Files changed:** src/api/payments.ts, src/api/payments.test.ts
- **What was done:** POST /api/payments creates payment intent
- **Key decisions:** Returns client_secret directly, validates amount > 0
- **Context for next tasks:** Endpoint expects {amount, currency} body
```

**Parallel safety:** When multiple executors run in the same wave, each writes to `.shipit/handoffs/task-N.md`. The conductor merges them into HANDOFF.md after the wave completes, preventing write conflicts.

### Git Checkpoint System

Every executor creates a git tag before making changes:

```
shipit/checkpoint-task-1  →  commit abc1234 (before Task 1)
shipit/checkpoint-task-2  →  commit def5678 (before Task 2)
shipit/checkpoint-task-3  →  commit ghi9012 (before Task 3)
```

If Task 3 breaks everything, run `/shipit:rollback` to revert to any checkpoint. ShipIt creates a backup branch first, so nothing is ever lost.

### TDD Cycle

Every code task follows the RED, GREEN, REFACTOR cycle:

```
🔴 RED       → Write a failing test. Run it. Confirm FAIL.
🟢 GREEN     → Write minimal code to pass. Run tests. All PASS.
🔵 REFACTOR  → Clean up. Tests still PASS.
📦 COMMIT    → Atomic commit with proper type prefix.
```

> **Hard gate:** If TDD is enabled, the executor CANNOT mark a task complete without test output showing PASS. Wrote code before the test? Delete it. Start over.

### Auto-Loop Mechanism

The auto-loop uses Claude Code's **Stop hook** to keep execution going. When Claude tries to stop, the hook checks `.shipit/loop.md` and injects a continuation prompt if tasks remain.

### Session Persistence

State files in `.shipit/` allow work to survive across sessions:

```
Session 1: /shipit:go add auth
  → Completes tasks 1-2, saves STATE.md (task 3/5)

Session 2: /shipit:resume
  → Reads STATE.md, spawns conductor in CONTINUATION mode
  → Conductor reads HANDOFF.md for tasks 1-2 context
  → Continues from task 3 with full context
```

### Conductor Continuation

If the conductor's context fills up mid-execution:

1. Conductor saves progress to STATE.md and HANDOFF.md
2. Returns `"incomplete"` to main orchestrator
3. Main spawns a NEW conductor with fresh 200k context
4. New conductor reads STATE.md/HANDOFF.md and continues
5. Max 3 conductor spawns per `/shipit:go` invocation

---

## Architecture

### Agent System

ShipIt uses 9 specialized agents, each spawned on demand in fresh context windows:

| Agent | Role | When Spawned |
|-------|------|-------------|
| **Conductor** | Orchestrates the full pipeline | By main orchestrator for medium/large tasks |
| **Researcher** | Explores codebase before planning | By conductor for large tasks |
| **Planner** | Creates PLAN.md with atomic tasks | By conductor |
| **Plan Checker** | Validates plan quality (8 dimensions) | By conductor after planner |
| **Executor** | Implements one task with TDD | By conductor for each task |
| **Reviewer** | Reviews spec compliance + code quality | By conductor after each executor |
| **Verifier** | Validates all work against original intent | By conductor after all tasks |
| **Integration Checker** | Checks cross-task E2E flows | By conductor for multi-task plans |
| **Debugger** | Scientific method debugging | By `/shipit:debug` |

### Plan Validation (8 Dimensions)

Every plan is validated before execution:

| Dimension | What It Checks |
|-----------|---------------|
| Task Coverage | Does the plan cover ALL aspects of the original task? |
| Task Completeness | Every task has Files, Do, TDD, Verify, Wave, Depends? |
| Dependency Ordering | No circular deps, correct execution order? |
| Scope Sanity | 2-5 tasks, each completable in one atomic commit? |
| Specificity Check | Do fields are imperative and specific, not vague? |
| TDD Correctness | Code tasks have TDD:yes, config tasks have TDD:no? |
| Risk Assessment | Destructive operations identified and mitigated? |
| Context Budget | Plan fits within agent context limits? |

### Per-Task Code Review (2 Stages)

Every task is reviewed immediately after execution:

**Stage 1: Spec Compliance** — Does code match exactly what was specified?
- Completeness, accuracy, correct files, no over/under-engineering, TDD compliance

**Stage 2: Code Quality** — Is the code good?
- Security, error handling, patterns, testing, performance, cleanup

**Severities:** CRITICAL (block), IMPORTANT (fix), MINOR (note)

### Skills

ShipIt includes 7 reference skills that agents consult:

| Skill | Purpose |
|-------|---------|
| `shipit-core` | Core architecture awareness (injected at session start) |
| `prompt-review` | Prompt scoring criteria and improvement process |
| `tdd` | RED-GREEN-REFACTOR cycle, hard gates, anti-rationalization |
| `debugging-methodology` | Scientific debugging (Iron Law, phases, anti-patterns) |
| `code-review` | Review guidelines, severity levels, evidence requirements |
| `git-workflow` | Branching, atomic commits, staging rules |
| `verification-standards` | What "verified" means, forbidden language, evidence |

---

## Comparison

How ShipIt compares to other Claude Code plugins:

| Feature | ShipIt | [Superpowers](https://github.com/obra/superpowers) | [GSD](https://github.com/get-shit-done) |
|---------|--------|-------------|-----|
| Thin orchestrator | Fresh-context conductor | No | No |
| Prompt quality review | Auto-score + improve | No | No |
| One-command execution | `/shipit:go` | Manual | Multi-step |
| Task decomposition | Auto-detect complexity | Manual planning | Phase-based roadmap |
| Plan validation | 8-dimension checker | No | No |
| Research before planning | Researcher agent | No | Phase researcher |
| TDD enforcement | Built-in hard gate | Skill (optional) | No |
| Per-task code review | 2-stage reviewer | No | No |
| Integration checking | E2E checker agent | No | Integration checker |
| Wave-based parallel | Yes (within waves) | No | Yes (within phases) |
| Auto-loop | Stop hook based | No | No |
| Fresh executor context | Yes (Task subagents) | No | Yes |
| Cross-task context | HANDOFF.md + handoffs/ | No | No |
| Git checkpoints | Tag per task + rollback | No | No |
| Model profiles | quality/balanced/budget | No | quality/balanced/budget |
| Multi-agent | 9 specialized agents | Subagent dispatch | 10+ agents |
| Session persistence | `.shipit/` flat files | No | `.planning/` directory |
| Context window display | Statusline with % bar | No | No |
| Health check | `/shipit:health` | No | `/gsd:health` |
| Quick mode | `/shipit:quick` | No | `/gsd:quick` |
| Discussion mode | `/shipit:discuss` | No | No |
| Self-update | `/shipit:update` | No | `/gsd:update` |
| Debugging workflow | Scientific method | Systematic skill | Debug agent |
| Version tracking | VERSION + CHANGELOG | No | No |
| Setup complexity | Zero config | Zero config | PROJECT.md + roadmap |
| Rationalization prevention | Every agent | No | Every agent |

---

## Plugin Structure

```
shipit/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── agents/
│   ├── shipit-conductor.md   # Pipeline orchestrator (fresh context)
│   ├── shipit-researcher.md  # Pre-planning codebase research
│   ├── shipit-planner.md     # Task decomposition + wave assignment
│   ├── shipit-plan-checker.md # 8-dimension plan validation
│   ├── shipit-executor.md    # TDD execution + checkpoints
│   ├── shipit-reviewer.md    # Per-task code review (2-stage)
│   ├── shipit-verifier.md    # Final verification
│   ├── shipit-integration-checker.md # Cross-task E2E check
│   └── shipit-debugger.md    # Scientific debugging
├── commands/
│   ├── go.md                 # /shipit:go — main command
│   ├── quick.md              # /shipit:quick — fast execution
│   ├── plan.md               # /shipit:plan — plan + review
│   ├── init.md               # /shipit:init — project setup
│   ├── resume.md             # /shipit:resume — continue work
│   ├── status.md             # /shipit:status — progress dashboard
│   ├── debug.md              # /shipit:debug — systematic debugging
│   ├── done.md               # /shipit:done — verify + finish
│   ├── health.md             # /shipit:health — state diagnosis
│   ├── rollback.md           # /shipit:rollback — checkpoint rollback
│   ├── discuss.md            # /shipit:discuss — discussion mode
│   ├── update.md             # /shipit:update — update plugin
│   └── help.md               # /shipit:help — usage guide
├── prompts/
│   ├── conductor-prompt.md   # Conductor spawn templates
│   ├── executor-prompt.md    # Executor spawn template
│   ├── planner-prompt.md     # Planner spawn template
│   ├── reviewer-prompt.md    # Reviewer spawn template
│   ├── plan-checker-prompt.md # Plan checker spawn template
│   └── verifier-prompt.md    # Verifier spawn template
├── hooks/
│   ├── hooks.json            # Hook configuration
│   ├── session-start.sh      # Injects ShipIt awareness
│   ├── stop-hook.sh          # Auto-loop mechanism
│   └── statusline.js         # Custom status line
├── skills/
│   ├── shipit-core/          # Core architecture skill
│   ├── prompt-review/        # Prompt quality review
│   ├── tdd/                  # TDD reference
│   ├── debugging-methodology/ # Scientific debugging
│   ├── code-review/          # Review guidelines
│   ├── git-workflow/         # Git conventions
│   └── verification-standards/ # Verification standards
├── scripts/
│   └── setup-loop.sh         # Loop initialization
├── bin/
│   ├── shipit-tools.cjs      # CLI utilities
│   └── shipit-tools.test.cjs # CLI tests
├── templates/
│   ├── project.md            # PROJECT.md template
│   └── state.md              # STATE.md template
├── settings.json             # Plugin settings (statusline)
├── VERSION                   # Current version number
├── CHANGELOG.md              # Version history
├── LICENSE
└── README.md
```

---

## Principles

1. **TDD by default** — Write the failing test first, always.
2. **Atomic commits** — One commit per task. Stage files individually.
3. **Maximum autonomy** — Keep going until done or blocked.
4. **Flat state** — No deep hierarchies. Just files.
5. **Step gates** — Each step must complete before the next begins.
6. **Plan validation** — Check plans before executing. Bad plans waste time.
7. **Per-task review** — Catch bugs after 1 task, not after 5.
8. **Scope boundaries** — Out-of-scope issues go to DEFERRED.md.
9. **Rationalization prevention** — "This thought means STOP."
10. **Context budgets** — Max 5 tasks per plan. Fresh context per agent.
11. **Thin orchestrator** — Main context stays under 20%.
12. **Wave-based parallel** — Same-wave tasks run simultaneously.
13. **Parallel-safe handoffs** — Individual files, merged after waves.
14. **Git checkpoints** — Tag before each task. Rollback anytime.
15. **Model profiles** — Right model for each agent role.
16. **Research before planning** — Explore before decomposing.

---

## Author

**Praful** — [@praful011](https://github.com/praful011)

---

## License

[MIT](LICENSE) — Use it, fork it, ship with it.
