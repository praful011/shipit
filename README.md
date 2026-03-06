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
    <img src="https://img.shields.io/badge/version-3.0.0-green.svg" alt="Version: 3.0.0">
    <img src="https://img.shields.io/badge/claude--code-plugin-purple.svg" alt="Claude Code Plugin">
  </p>
</p>

---

ShipIt is a **Claude Code plugin** that turns a single sentence into shipped code. It combines confidence-aware execution, adaptive model selection, progressive autonomy, TDD enforcement, multi-agent orchestration, wave-based parallel execution, code health tracking, and auto-looping into one seamless workflow.

> **No more babysitting.** Tell Claude what to build. ShipIt plans it, tests it, reviews it, loops until it's done, and persists state across sessions.

### Why ShipIt?

**Intelligence & Awareness:**
- **Confidence-Aware Execution** — Executor self-rates confidence before implementing. Low confidence = stop and ask human, not guess.
- **Adaptive Model Selection** — Dynamically picks haiku/sonnet/opus per task based on complexity. Simple fix? Haiku. Complex auth? Opus.
- **Progressive Autonomy** — Trust score builds over sessions. Start guided, earn autonomous mode.
- **Supervised Autonomy** — Three modes (guided/supervised/autonomous) control oversight level.

**Quality Pipeline:**
- **Mandatory Design Gate** — Non-trivial tasks require design approval before planning. 2-3 approaches proposed, user chooses, decision saved to `DESIGN.md`.
- **TDD by Default** — Every code change goes through RED, GREEN, REFACTOR.
- **Self-Validating Plans** — Planner checks 8 dimensions internally, dependency-aware wave safety.
- **Re-Anchoring** — Every executor re-reads the original task to prevent scope drift.
- **Self-Review** — Executors review their own `git diff` before committing.
- **Evidence-Based Receipts** — JSON receipts require raw test/verify output, not summaries. Receipts without evidence are rejected.
- **Per-Task Code Review** — Spec compliance + quality + pattern compliance after each task.
- **Learning Loop** — Review findings propagate via `LESSONS.md`. Same mistake never twice.
- **Epic-Level Verification** — Verifier checks ALL original requirements with evidence + cross-task integration.
- **Code Health Tracking** — Tracks if codebase gets better or worse with each task.
- **Deep Rationalization Prevention** — Superpowers-style "Red Flags" tables in executor, planner, and conductor catch 41 specific excuses for skipping process steps.

**Architecture:**
- **Thin Orchestrator** — Main context stays lean (~15%). Heavy work in fresh-context agents.
- **Wave-Based Parallel** — Independent tasks run simultaneously within waves.
- **Adaptive Re-Planning** — When approach fails mid-execution, replan remaining tasks (keep completed work).
- **Shared Codebase Context** — `PROJECT_CONTEXT.md` with real code examples ensures consistent style.
- **MCP Integration Hooks** — Optional blast radius (Engram), dependency graph (Depwire), docs (Context7).

**Developer Experience:**
- **Prompt Review** — Scores prompt quality, suggests improved version.
- **Requirement Discovery** — Vague tasks trigger Socratic questioning before planning.
- **Failure Analytics** — Persistent learning from failures across sessions.
- **Cost Tracking** — Track token cost per task, set budget limits.
- **Git Checkpoints** — Every task creates a tag for safe rollback.
- **Session Persistence** — Resume across sessions with `.shipit/` state files.
- **Auto-Loop** — Keeps working until done or blocked.

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
2. **Discover** hidden requirements — ask focused questions if your prompt is vague
3. **Design** — propose 2-3 approaches with trade-offs, get your approval, save decision to `DESIGN.md`
4. **Analyze** complexity — classify as quick/medium/large
5. **Branch** — create isolated feature branch (medium/large)
6. **Context** — generate shared codebase patterns doc (PROJECT_CONTEXT.md)
7. **Research** — explore the codebase to understand patterns (large tasks)
8. **Plan** — decompose into atomic tasks with wave assignments
9. **Validate** — check the plan across 8 dimensions
10. **Execute** — run each task with TDD, self-review, and evidence-based receipt generation
11. **Review** — spec + quality + pattern compliance after each task, lessons extracted
12. **Verify** — epic-level requirement review (every original requirement, with evidence)
13. **Integration check** — verify cross-task E2E flows

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
  "model_overrides": {},
  "autonomy_mode": "supervised",
  "adaptive_models": true,
  "mcp_integrations": {},
  "cost_budget": null
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
| `model_profile` | `"balanced"` | Base agent model selection (see Model Profiles) |
| `model_overrides` | `{}` | Override specific agent models |
| `autonomy_mode` | `"supervised"` | Oversight: "guided" / "supervised" / "autonomous" |
| `adaptive_models` | `true` | Dynamic per-task model selection based on complexity |
| `mcp_integrations` | `{}` | Optional MCP servers (blast_radius, dependency_graph, docs) |
| `cost_budget` | `null` | Max cost in $ per run. null = unlimited |

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

### Supervised Autonomy

Three oversight modes that adapt to your trust level:

| Mode | Behavior | Best For |
|------|----------|----------|
| `"guided"` | Pause after each step for confirmation | New projects, critical code |
| `"supervised"` | Auto-execute within waves, pause between waves | Default. Day-to-day dev |
| `"autonomous"` | Full autopilot, only stop on errors/blockers | Trusted projects, high trust score |

The trust score (tracked in `analytics.json`) can automatically adjust the mode:
- Trust < 30: Forces guided mode
- Trust 30-70: Respects your config
- Trust > 70: Allows autonomous even if config says supervised

### Confidence-Aware Execution

Before implementing each task, the executor self-rates confidence:

| Level | Action |
|-------|--------|
| **HIGH** (80-100%) | Execute normally |
| **MEDIUM** (50-79%) | Execute but flag for stricter review |
| **LOW** (0-49%) | **STOP.** Ask human for guidance |

This prevents the AI from guessing on tasks it's uncertain about — a problem no other plugin addresses.

### Adaptive Re-Planning

When an executor discovers the planned approach won't work (API incompatible, library doesn't support it, wrong assumption), it signals `<shipit-replan>`. The conductor:
1. Keeps all completed tasks
2. Re-spawns the planner for remaining tasks only
3. Resumes execution with the new plan

No more "everything breaks because step 3 was wrong."

### MCP Integration Hooks

ShipIt optionally integrates with MCP servers for enhanced capabilities:

```json
{
  "mcp_integrations": {
    "blast_radius": "engram",
    "dependency_graph": "depwire",
    "docs": "context7"
  }
}
```

| MCP Server | What It Adds |
|-----------|-------------|
| [Engram](https://github.com/spectra-g/engram) | Blast radius detection via git history — what usually breaks when this file changes? |
| [Depwire](https://github.com/depwire/depwire) | Dependency graph — prevent wave conflicts, understand import chains |
| [Context7](https://github.com/upstash/context7) | Up-to-date API documentation for libraries being used |

These are optional. ShipIt works without them but gets smarter with them.

---

## State Files

ShipIt persists all state in the `.shipit/` directory:

```
.shipit/
├── PROJECT.md           # What the project is about
├── DESIGN.md            # Design decision and chosen approach
├── STATE.md             # Current progress and position
├── PLAN.md              # Active plan with tasks and waves
├── RESEARCH.md          # Pre-planning research (large tasks)
├── PROJECT_CONTEXT.md   # Shared codebase patterns (all agents read)
├── LESSONS.md           # Review findings for future executors
├── HANDOFF.md           # Cumulative context from completed tasks
├── DEFERRED.md          # Out-of-scope issues for later
├── config.json          # Preferences and model profile
├── loop.md              # Auto-loop state (managed automatically)
├── handoffs/            # Per-task handoff files (parallel-safe)
│   ├── task-1.md
│   ├── task-2.md
│   └── ...
├── receipts/            # Machine-verifiable proof of execution
│   ├── task-1.json
│   ├── task-2.json
│   └── ...
├── analytics.json       # Persistent analytics (trust, cost, health)
├── prompts/
│   └── history.md       # Prompt review history log
└── debug/
    └── DEBUG.md         # Debugging session state
```

| File | Purpose | Created by |
|------|---------|------------|
| `PROJECT.md` | Project description, tech stack, constraints | `/shipit:init` |
| `DESIGN.md` | Design decision — approaches considered, chosen approach, rationale | `/shipit:go` (Step 1.8) |
| `STATE.md` | Status, current task number, timestamps | `/shipit:go` |
| `PLAN.md` | Task list with Do/Verify, Waves, Dependencies | Planner agent |
| `RESEARCH.md` | Codebase analysis and approach recommendations | Researcher agent |
| `PROJECT_CONTEXT.md` | Real code examples and conventions for all agents | Conductor |
| `LESSONS.md` | Review findings — future executors avoid past mistakes | Reviewer agent |
| `HANDOFF.md` | Cumulative log of completed tasks with context | Conductor (merged) |
| `DEFERRED.md` | Out-of-scope issues found during execution | Executor agent |
| `config.json` | User preferences and model profile | `/shipit:init` |
| `loop.md` | Loop iteration counter, active flag | Stop hook |
| `handoffs/task-N.md` | Individual task handoff (parallel-safe) | Executor agent |
| `receipts/task-N.json` | Machine-verifiable proof of task execution | Executor agent |
| `analytics.json` | Trust score, cost history, failure patterns, health trend | Conductor |
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
┌─── THIN ORCHESTRATOR (~15% context) ──────────────┐
│                                                     │
│  1. Load context + analytics.json (trust score)     │
│  2. Score & review prompt (AskUser)                 │
│  3. Requirement discovery (if vague prompt)         │
│  4. Design exploration (non-trivial tasks):         │
│     ├── Propose 2-3 approaches with trade-offs      │
│     ├── Get user approval (AskUser)                 │
│     └── Save decision to .shipit/DESIGN.md          │
│  5. Analyze complexity → medium                     │
│  6. Create feature branch                           │
│  7. Spawn conductor (+ design approach) ─────┐      │
│                                              │      │
└──────────────────────────────────────────────┘      │
                                                      │
┌─── CONDUCTOR (fresh 200k context) ──────────────────┘
│
│  8. Load analytics (trust score, failure patterns)
│  9. Generate PROJECT_CONTEXT.md (codebase patterns)
│  10. Auto-generate CLAUDE.md (if missing)
│  11. [Large only] Spawn RESEARCHER → RESEARCH.md
│
│  12. Spawn PLANNER → self-validates 8 dimensions → PLAN.md
│  13. Initialize STATE.md + HANDOFF.md
│
│  WAVE 1 (parallel, model chosen adaptively):
│  ├── EXECUTOR (Task 1) ──► confidence: HIGH ──► checkpoint ──► TDD ──► self-review ──► receipt (raw output) ──► commit
│  └── EXECUTOR (Task 2) ──► confidence: MEDIUM ──► checkpoint ──► TDD ──► receipt (raw output) ──► commit
│  │
│  ├── Verify receipts (reject if missing raw test/verify output)
│  ├── Merge handoffs into HANDOFF.md
│  ├── REVIEWER (Task 1) → APPROVED
│  └── REVIEWER (Task 2) → NEEDS FIX (medium confidence) → extract lesson → re-execute
│  │
│  [supervised mode: "Wave 1 done. Continue?"]
│
│  WAVE 2:
│  └── EXECUTOR (Task 3) ──► reads LESSONS.md ──► confidence: HIGH ──► TDD ──► receipt ──► commit
│  │  (or: ──► confidence: LOW ──► <shipit-blocked> ──► ask human)
│  │  (or: ──► approach fails ──► <shipit-replan> ──► conductor replans remaining tasks)
│  │
│  ├── Verify receipt, merge handoff
│  └── REVIEWER (Task 3) → APPROVED
│
│  14. VERIFIER → epic-level requirements + integration check → PASS
│  15. Code health delta: +3 (codebase improved)
│  16. Update analytics.json (trust +5, cost $0.85)
│  17. Return "complete"
│
└─────────────────────────────────────────────────────

Orchestrator: <shipit-done/>
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

> **Hard gate:** If TDD is enabled, the executor CANNOT mark a task complete without test output showing PASS. Wrote code before the test? Delete it. Start over. Receipts must include raw test output — summaries are rejected.

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

ShipIt uses 7 specialized agents, each spawned on demand in fresh context windows:

| Agent | Role | When Spawned |
|-------|------|-------------|
| **Conductor** | Orchestrates pipeline with autonomy management, analytics, MCP hooks | By main orchestrator for medium/large tasks |
| **Researcher** | Explores codebase before planning | By conductor for large tasks |
| **Planner** | Creates PLAN.md with self-validation (8 dimensions) + dependency-aware waves | By conductor |
| **Executor** | Implements one task with TDD, confidence scoring, receipts | By conductor (model chosen adaptively) |
| **Reviewer** | Receipt verification + spec + quality + pattern review, extracts lessons | By conductor after each executor |
| **Verifier** | Epic-level requirements + integration check (merged) | By conductor after all tasks |
| **Debugger** | Scientific method debugging | By `/shipit:debug` |

**Note:** Plan-checker merged into planner (self-validation). Integration-checker merged into verifier. 9 agents → 7 agents = faster, cheaper, simpler.

### Self-Validating Plans (8 Dimensions)

Every plan is self-validated by the planner before output (no separate checker agent needed):

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

### Quality Assurance Pipeline

ShipIt has a multi-layered quality assurance system that catches issues at every stage:

```
┌─ BEFORE PLANNING ──────────────────────────────────┐
│  Prompt Review ──► Requirement Discovery            │
│  Design Exploration (2-3 approaches → user approves)│  ◄── NEW
│  PROJECT_CONTEXT.md ──► Auto-CLAUDE.md              │
└─────────────────────────────────────────────────────┘
         │
┌─ DURING PLANNING ─────────────────────────────────┐
│  Planner explores codebase (MUST, not optional)     │
│  8-dimension self-validation                        │
│  Red Flags tables catch planning rationalizations   │  ◄── ENHANCED
└─────────────────────────────────────────────────────┘
         │
┌─ DURING EXECUTION ─────────────────────────────────┐
│  Re-anchor to original task                         │
│  Read LESSONS.md (avoid past mistakes)              │
│  Follow PROJECT_CONTEXT.md patterns                 │
│  Red Flags tables catch TDD/process rationalizations│  ◄── ENHANCED
│  TDD: RED → GREEN → REFACTOR                        │
│  Self-review own diff                               │
│  Capture RAW test/verify output (not summaries)     │  ◄── NEW
│  Generate evidence-based receipt                    │
│  Atomic commit                                      │
└─────────────────────────────────────────────────────┘
         │
┌─ AFTER EXECUTION ──────────────────────────────────┐
│  Receipt verification — REJECT if missing raw output│  ◄── ENHANCED
│  Red Flags tables catch review-skipping excuses     │  ◄── ENHANCED
│  Code review: spec compliance + quality + patterns  │
│  Extract lessons → LESSONS.md (learning loop)       │
└─────────────────────────────────────────────────────┘
         │
┌─ AFTER ALL TASKS ──────────────────────────────────┐
│  Epic-level requirement review (with evidence)      │
│  Integration check (cross-task E2E flows)           │
└─────────────────────────────────────────────────────┘
```

**Key quality files:**

| File | Purpose | Who Writes | Who Reads |
|------|---------|-----------|-----------|
| `PROJECT_CONTEXT.md` | Codebase patterns with real code examples | Conductor | All agents |
| `LESSONS.md` | Review findings to avoid in future tasks | Reviewer | Executor |
| `receipts/task-N.json` | Machine-verifiable proof of execution | Executor | Conductor, Reviewer, Verifier |

### Skills

ShipIt includes 9 reference skills that agents consult:

| Skill | Purpose |
|-------|---------|
| `shipit-core` | Core architecture awareness (injected at session start) |
| `prompt-review` | Prompt scoring criteria and improvement process |
| `requirement-discovery` | Socratic questioning to surface hidden requirements |
| `codebase-context` | Shared PROJECT_CONTEXT.md generation from real code examples |
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
| **Confidence-aware execution** | **Self-rates HIGH/MED/LOW per task** | **No** | **No** |
| **Adaptive model selection** | **Dynamic per-task (haiku→opus)** | **No** | **No** |
| **Progressive autonomy** | **Trust score across sessions** | **No** | **No** |
| **Supervised autonomy modes** | **guided/supervised/autonomous** | **No** | **No** |
| **Code health tracking** | **Trend analysis per task** | **No** | **No** |
| **Failure analytics** | **Persistent learning** | **No** | **No** |
| **Cost tracking** | **Per-task + budget limits** | **No** | **No** |
| **MCP integration hooks** | **Engram, Depwire, Context7** | **No** | **No** |
| **Adaptive re-planning** | **Replan remaining on failure** | **No** | **No** |
| Thin orchestrator | Fresh-context conductor | No | No |
| Prompt quality review | Auto-score + improve | No | No |
| Requirement discovery | Socratic questioning | No | Phase discussion |
| Self-validating plans | 8 dimensions + dep-aware waves | No | No |
| Research before planning | Researcher agent | No | Phase researcher |
| Shared codebase context | PROJECT_CONTEXT.md (real code) | No | Codebase mapper |
| **Mandatory design gate** | **2-3 approaches → user approval → DESIGN.md** | **Hard gate (brainstorming skill)** | **No** |
| **Deep rationalization prevention** | **41-row Red Flags tables (executor/planner/conductor)** | **Red Flags tables (skills)** | **No** |
| **Evidence-based receipts** | **Raw test/verify output required, summaries rejected** | **No** | **No** |
| TDD enforcement | Built-in hard gate | Skill (optional) | No |
| Re-anchoring / drift prevention | Every executor | No | No |
| Receipt-based proof | JSON receipts with confidence + raw output | No | No |
| Per-task code review | Receipt + spec + quality | No | No |
| Learning loop (LESSONS.md) | Review findings → future executors | No | No |
| Epic-level verification + integration | Merged verifier (requirements + E2E) | No | Goal-backward verify |
| Wave-based parallel | Yes (within waves) | No | Yes (within phases) |
| Auto-loop | Stop hook based | No | No |
| Git checkpoints | Tag per task + rollback | No | No |
| Multi-agent | 7 specialized agents | Subagent dispatch | 10+ agents |
| Session persistence | `.shipit/` flat files | No | `.planning/` directory |
| Setup complexity | Zero config | Zero config | PROJECT.md + roadmap |

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
│   ├── requirement-discovery/ # Socratic requirement discovery
│   ├── codebase-context/     # Shared PROJECT_CONTEXT.md generation
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
3. **Supervised autonomy** — Three modes. Trust score builds over sessions.
4. **Confidence-aware execution** — LOW confidence = stop and ask, not guess.
5. **Step gates** — Each step must complete before the next begins.
6. **Self-validating plans** — Planner checks 8 dimensions + dependency-aware wave safety.
7. **Per-task review** — Catch bugs after 1 task, not after 5. Extract lessons.
8. **Scope boundaries** — Out-of-scope issues go to DEFERRED.md.
9. **Context budgets** — Max 5 tasks per plan. Fresh context per agent.
10. **Thin orchestrator** — Main context stays under 20%.
11. **Wave-based parallel** — Same-wave tasks run simultaneously.
12. **Adaptive model selection** — Dynamic per-task model choice based on complexity.
13. **Git checkpoints** — Tag before each task. Rollback anytime.
14. **Re-anchoring** — Every executor re-reads original task to prevent drift.
15. **Evidence-based receipts** — JSON receipts with raw test/verify output. Summaries rejected.
16. **Learning loop** — LESSONS.md propagates review findings.
17. **Adaptive re-planning** — When approach fails, replan remaining (keep completed).
18. **Epic-level verification** — ALL original requirements with evidence + integration.
19. **Progressive autonomy** — Trust score tracks success rate across sessions.
20. **Code health tracking** — Track if codebase improves or degrades.
21. **Failure analytics** — Learn from failures across sessions.
22. **Cost awareness** — Track cost per task. Respect budget limits.
23. **MCP hooks** — Optional blast radius, dependency graph, docs integration.
24. **Requirement discovery** — Vague prompts trigger Socratic questioning.
25. **Design before planning** — Non-trivial tasks require design approval. Prevents building the wrong thing faster.
26. **Deep rationalization prevention** — Red Flags tables catch 41 specific excuses across executor, planner, and conductor.
27. **Evidence over claims** — Raw output required in receipts. No paraphrasing. Conductor rejects receipts without proof.

---

## Author

**Praful** — [@praful011](https://github.com/praful011)

---

## License

[MIT](LICENSE) — Use it, fork it, ship with it.
