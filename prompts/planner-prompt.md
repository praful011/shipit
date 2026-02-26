# ShipIt Planner Spawn Template

Use this template when spawning a shipit-planner agent from `/shipit:go` or `/shipit:plan`.

## Template

```
Task(
  subagent_type="shipit:shipit-planner",
  prompt="First, read your agent definition at agents/shipit-planner.md for your role and instructions.

## Your Assignment

Plan this task: $TASK_DESCRIPTION

## Codebase Context

$CODEBASE_CONTEXT

## Constraints

- Max 5 tasks (prefer 2-3)
- Each task must have: Files, Do, TDD, Verify fields
- Do fields must be imperative and specific (not vague)
- Verify fields must have exact commands
- Order by dependency (earlier tasks must not depend on later ones)

<files_to_read>
.shipit/PROJECT.md
.shipit/STATE.md
.shipit/config.json
./CLAUDE.md
</files_to_read>

Read ALL files above before planning. Discover project patterns, test runner, and conventions.
"
)
```

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `$TASK_DESCRIPTION` | User's chosen prompt (from Step 1.5) | The task to plan |
| `$CODEBASE_CONTEXT` | Orchestrator's Step 2 analysis | Key files found, patterns discovered, architecture notes. 3-5 bullet points. |

## For Revision Mode

When the plan-checker returns issues, re-spawn the planner with:

```
Task(
  subagent_type="shipit:shipit-planner",
  prompt="First, read your agent definition at agents/shipit-planner.md for your role and instructions.

## Your Assignment

Revise the existing plan in `.shipit/PLAN.md` to fix these issues:

<issues>
$PLAN_CHECKER_ISSUES
</issues>

<files_to_read>
.shipit/PLAN.md
.shipit/PROJECT.md
.shipit/config.json
./CLAUDE.md
</files_to_read>

Fix ONLY the listed issues. Do not restructure the entire plan.
"
)
```
