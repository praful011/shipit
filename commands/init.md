---
name: shipit:init
description: Guided project setup — scans codebase, configures model profile, autonomy, MCP integrations, and creates .shipit/
argument-hint: "[project-name]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

<objective>
Initialize a project with guided setup. Scan the codebase, ask essential questions, configure model profile, autonomy mode, MCP integrations, and create `.shipit/` directory with all state files. Walk the user through every decision so they understand what ShipIt does.
</objective>

<process>

## Step 0: Verify Installation

**Before anything else, confirm ShipIt is working:**

1. Check that this command is running (if you're reading this, it is)
2. Verify hooks are active:
```bash
ls ${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json
```
3. If this is the user's first time, show a brief welcome:

```
Welcome to ShipIt! Let's set up your project.

ShipIt is an autonomous development engine. You give it a task,
it plans, executes with TDD, reviews, and loops until done.

This setup will:
  1. Scan your codebase to detect tech stack
  2. Ask about your project
  3. Configure how ShipIt works for you
  4. Create .shipit/ state directory

Let's get started.
```

**GATE: Installation verified. Proceed to codebase scan.**

## Step 1: Scan Existing Codebase

Automatically detect project details:

1. **Package managers** — Use Glob to find `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`
2. **Read detected files** — Extract project name, dependencies, scripts (especially test commands)
3. **Directory structure** — Check for `src/`, `lib/`, `app/`, `tests/`, `__tests__/`, `spec/`
4. **Existing config** — Check for `CLAUDE.md`, `.eslintrc`, `tsconfig.json`, `.prettierrc`, `Makefile`
5. **Git state** — Check if git is initialized, current branch, recent commits
6. **Test runner** — Detect test command from package.json scripts, Makefile, or conventions

**Present findings to user:**
```
Detected:
  - Tech stack: [language] + [framework]
  - Package manager: [npm/yarn/pnpm/cargo/pip/etc.]
  - Test command: [detected command]
  - Directory structure: [src/ layout]
  - Git: [initialized/not initialized]
```

**GATE: Codebase scanned. Findings presented.**

## Step 2: Ask About the Project

Use AskUserQuestion to ask 2-3 questions. **Skip questions where the answer is obvious from codebase scan.**

**Question 1: What does this project do?**
- Skip if README.md or package.json description makes it clear
- Otherwise ask: "What does this project do? (1-2 sentences)"

**Question 2: Core value**
- "What's the ONE thing that matters most about this project?"
- Options: "Reliability", "Speed", "Security", "User experience", "Other"

**Question 3: Constraints** (optional)
- "Any constraints I should know? (e.g., no external APIs, must support Node 18, monorepo)"
- Skip if none obvious

**GATE: Project context understood.**

## Step 3: Configure Model Profile

Use AskUserQuestion:

```
How should ShipIt balance cost vs quality?

1. Quality (Recommended for production code)
   - Uses Opus for planning and execution
   - Best output, higher cost (~$2-5 per feature)

2. Balanced (Recommended for most development)
   - Uses Sonnet for planning/execution, Haiku for reviews
   - Good quality, reasonable cost (~$0.50-2 per feature)

3. Budget (Recommended for prototyping/learning)
   - Uses Haiku for most agents
   - Fastest, lowest cost (~$0.10-0.50 per feature)
```

Record choice for config.json.

**GATE: Model profile chosen.**

## Step 4: Configure Autonomy Mode

Use AskUserQuestion:

```
How much oversight do you want?

1. Guided (Recommended for first-time users)
   - ShipIt pauses after EACH step for your confirmation
   - You see the plan before execution, approve each task
   - Best for: learning how ShipIt works, critical code

2. Supervised (Recommended for most development)
   - ShipIt auto-executes within waves, pauses BETWEEN waves
   - You see progress summaries, can stop between groups of tasks
   - Best for: day-to-day development

3. Autonomous (Recommended for experienced users)
   - ShipIt runs end-to-end without pausing
   - Only stops on errors, blockers, or low-confidence tasks
   - Best for: trusted projects, high confidence tasks
```

Record choice for config.json.

**Note:** ShipIt's trust score will adjust this over time. Start guided, earn autonomous.

**GATE: Autonomy mode chosen.**

## Step 5: Configure MCP Integrations (Optional)

Use AskUserQuestion:

```
ShipIt can optionally connect to MCP servers for enhanced capabilities.
These are NOT required — ShipIt works great without them.

Do you want to configure any MCP integrations?

1. Skip MCP setup (Recommended — configure later if needed)
   - ShipIt works fully without MCP
   - You can add these anytime by editing .shipit/config.json

2. Configure MCP integrations
   - Blast radius detection (Engram) — what files usually break together?
   - Dependency graph (Depwire) — prevent parallel task conflicts
   - Live API docs (Context7) — up-to-date library documentation
```

**If user chooses "Configure MCP integrations":**

Ask which ones with multiSelect:

```
Which MCP servers do you have installed?

[ ] Engram (blast radius — what files change together)
    - Helps ShipIt understand impact of changes
    - Install: https://github.com/spectra-g/engram

[ ] Depwire (dependency graph — import chain analysis)
    - Helps planner assign safe parallel waves
    - Install: https://github.com/depwire/depwire

[ ] Context7 (live docs — up-to-date API documentation)
    - Helps researcher find correct API usage
    - Install: https://github.com/upstash/context7
```

**For each selected MCP server, verify it's accessible:**
```bash
# Check if MCP server is available (non-blocking, 3s timeout)
# This is best-effort — if not available, log warning and continue
```

Record selections for config.json `mcp_integrations` field.

**GATE: MCP configuration complete (or skipped).**

## Step 6: Configure TDD Preference

Use AskUserQuestion:

```
Should ShipIt enforce Test-Driven Development?

1. Yes, enforce TDD (Recommended)
   - Every code change: write failing test FIRST, then implement
   - ShipIt will reject code written without a test
   - Best for: production code, long-term projects

2. No, skip TDD enforcement
   - ShipIt will still run tests if they exist
   - But won't require test-first development
   - Best for: prototyping, scripts, one-off tools
```

Record choice for config.json.

**GATE: TDD preference set.**

## Step 7: Create State Files

```bash
mkdir -p .shipit/handoffs .shipit/receipts .shipit/prompts .shipit/debug
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state init "$ARGUMENTS"
```

## Step 8: Write PROJECT.md

Create `.shipit/PROJECT.md` (under 50 lines) with:
- Project name
- What it does (1-2 sentences)
- Core value
- Tech stack (detected + confirmed)
- Test command (detected)
- Constraints (if any)

## Step 9: Write config.json

Create `.shipit/config.json` with user's choices:

```json
{
  "tdd": <from Step 6>,
  "auto_loop": true,
  "max_iterations": 50,
  "auto_commit": true,
  "parallel_execution": true,
  "max_parallel_agents": 3,
  "model_profile": "<from Step 3>",
  "model_overrides": {},
  "autonomy_mode": "<from Step 4>",
  "adaptive_models": true,
  "mcp_integrations": <from Step 5>,
  "cost_budget": null
}
```

## Step 10: Write analytics.json

Create `.shipit/analytics.json` with initial values:

```json
{
  "trust_score": 50,
  "total_runs": 0,
  "successful_runs": 0,
  "failed_runs": 0,
  "total_tasks_executed": 0,
  "common_failures": [],
  "avg_review_iterations": 0,
  "cost_history": [],
  "code_health_trend": []
}
```

## Step 11: Add .shipit/ to .gitignore

Check if `.gitignore` exists. If so, check if `.shipit/` is already listed. If not, append:

```bash
echo "" >> .gitignore
echo "# ShipIt state (session data, not source code)" >> .gitignore
echo ".shipit/" >> .gitignore
```

If no `.gitignore` exists, create one with `.shipit/`.

## Step 12: Present Summary and Next Steps

Show the user everything that was created and what to do next:

```
Project initialized! Here's what was set up:

  .shipit/
  ├── PROJECT.md           Your project context
  ├── STATE.md             Progress tracking (auto-managed)
  ├── config.json          Your preferences
  ├── analytics.json       Trust score & metrics (starts at 50)
  ├── handoffs/            Task context sharing (auto-managed)
  ├── receipts/            Execution proof (auto-managed)
  ├── prompts/             Prompt review history (auto-managed)
  └── debug/               Debug session state (auto-managed)

  Configuration:
  ├── Model profile:       <chosen profile> (<what it means>)
  ├── Autonomy mode:       <chosen mode> (<what it means>)
  ├── TDD enforcement:     <yes/no>
  ├── MCP integrations:    <list or "none">
  └── Trust score:         50 (neutral — builds over time)

  .gitignore updated to exclude .shipit/

Ready to go! Here's what to try:

  /shipit:go <describe a feature>     Ship a feature end-to-end
  /shipit:quick <simple change>       Quick fix (skip agents)
  /shipit:debug <describe a bug>      Debug systematically
  /shipit:discuss <topic>             Chat about architecture

Example:
  /shipit:go add user authentication with JWT tokens

Tip: Start with a small task to see how ShipIt works.
     Your first run uses "guided" checkpoints so you can
     see each step. Trust score builds over time — after a
     few successful runs, ShipIt earns more autonomy.
```

</process>

<config_reference>

**Config Schema (for reference):**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tdd` | boolean | `true` | Enforce TDD (RED-GREEN-REFACTOR) for code changes |
| `auto_loop` | boolean | `true` | Keep working autonomously until done or blocked |
| `max_iterations` | number (1-200) | `50` | Maximum loop iterations before stopping |
| `auto_commit` | boolean | `true` | Commit after each completed task |
| `parallel_execution` | boolean | `true` | Allow parallel agent execution within waves |
| `max_parallel_agents` | number (1-5) | `3` | Maximum concurrent agents per wave |
| `model_profile` | string | `"balanced"` | Base agent model selection: "quality", "balanced", or "budget" |
| `model_overrides` | object | `{}` | Override specific agent models (e.g., `{"executor": "opus"}`) |
| `autonomy_mode` | string | `"supervised"` | Oversight level: "guided", "supervised", or "autonomous" |
| `adaptive_models` | boolean | `true` | Dynamically select model per task based on complexity |
| `mcp_integrations` | object | `{}` | Optional MCP servers: `{"blast_radius": "engram", "dependency_graph": "depwire", "docs": "context7"}` |
| `cost_budget` | number\|null | `null` | Max cost in dollars per `/shipit:go` run. null = unlimited |

</config_reference>

<success_criteria>
- [ ] Installation verified (hooks exist)
- [ ] Codebase scanned (tech stack, test runner, directory structure detected)
- [ ] Project questions answered (what, core value, constraints)
- [ ] Model profile chosen (quality/balanced/budget)
- [ ] Autonomy mode chosen (guided/supervised/autonomous)
- [ ] MCP integrations configured (or explicitly skipped)
- [ ] TDD preference set
- [ ] .shipit/ directory created with all subdirectories
- [ ] PROJECT.md written with project context
- [ ] config.json written with user's choices
- [ ] analytics.json initialized with trust_score: 50
- [ ] .gitignore updated to exclude .shipit/
- [ ] Summary shown with next steps and example commands
</success_criteria>
