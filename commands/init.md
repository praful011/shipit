---
name: shipit:init
description: Lightweight project setup — creates .shipit/ with PROJECT.md
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
Initialize a project with minimal ceremony. Create .shipit/ directory with PROJECT.md and config.
</objective>

<process>

## Step 1: Scan Existing Codebase

If there are existing files in the working directory:
- Use Glob to find package.json, Cargo.toml, go.mod, requirements.txt, etc.
- Read them to detect tech stack
- Look at directory structure (src/, lib/, app/, etc.)

## Step 2: Ask Essential Questions

Use AskUserQuestion to ask at most 2-3 questions:

1. "What does this project do?" (open-ended, or skip if obvious from README/package.json)
2. "What's the core value — the ONE thing that matters most?" (open-ended)
3. "Any constraints I should know about?" (optional, skip if none obvious)

## Step 3: Create State

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state init "$ARGUMENTS"
```

## Step 4: Write PROJECT.md

Create `.shipit/PROJECT.md` (under 50 lines) with:
- Project name
- What it does (1-2 sentences)
- Core value
- Tech stack (detected + confirmed)
- Constraints (if any)

## Step 5: Create Default Config

Create `.shipit/config.json` with defaults:

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

**Config Schema:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tdd` | boolean | `true` | Enforce TDD (RED-GREEN-REFACTOR) for code changes |
| `auto_loop` | boolean | `true` | Keep working autonomously until done or blocked |
| `max_iterations` | number (1-200) | `50` | Maximum loop iterations before stopping |
| `auto_commit` | boolean | `true` | Commit after each completed task |
| `parallel_execution` | boolean | `true` | Allow parallel agent execution within waves |
| `max_parallel_agents` | number (1-5) | `3` | Maximum concurrent agents per wave |
| `model_profile` | string | `"balanced"` | Agent model selection: "quality", "balanced", or "budget" |
| `model_overrides` | object | `{}` | Override specific agent models (e.g., `{"executor": "opus"}`) |

## Step 6: Confirm

Tell the user:
- Project initialized at `.shipit/`
- Show what was created (PROJECT.md, STATE.md, config.json)
- Show model profile setting and what it means
- Suggest: "Run `/shipit:go <task>` to start working"

</process>
