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

## Step 5: Confirm

Tell the user:
- Project initialized at `.shipit/`
- Show what was created
- Suggest: "Run `/shipit:go <task>` to start working"

</process>
