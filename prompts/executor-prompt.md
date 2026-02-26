# ShipIt Executor Spawn Template

Use this template when spawning a shipit-executor agent from `/shipit:go`.

## Template

```
Task(
  subagent_type="shipit:shipit-executor",
  prompt="First, read your agent definition at agents/shipit-executor.md for your role and instructions.

## Your Assignment

Execute **Task $TASK_NUMBER** from `.shipit/PLAN.md`.

## Scene Setting

$SCENE_CONTEXT

This is task $TASK_NUMBER of $TOTAL_TASKS. $PREVIOUS_CONTEXT

## Mandatory Reads

<files_to_read>
.shipit/PLAN.md
.shipit/STATE.md
.shipit/config.json
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>

Read ALL files above before doing anything. HANDOFF.md contains what previous tasks did — read it carefully to avoid conflicts.

## After Completion

1. Commit atomically (stage files individually, NEVER git add .)
2. Append task summary to HANDOFF.md
3. Update STATE.md with incremented task counts
4. If last task: output <shipit-done/>
5. If blocker: output <shipit-blocked>description</shipit-blocked>
"
)
```

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `$TASK_NUMBER` | STATE.md `current_task` | Which task to execute |
| `$TOTAL_TASKS` | PLAN.md frontmatter | Total tasks in plan |
| `$SCENE_CONTEXT` | Orchestrator knowledge | 2-3 sentences about what this task builds and why it matters |
| `$PREVIOUS_CONTEXT` | HANDOFF.md summary | Brief note about what previous tasks accomplished (e.g., "Tasks 1-2 set up the database schema and API routes.") |

## Rules

- **Always provide scene context** — don't just say "execute task 3". Explain what the task builds.
- **Always reference previous work** — the executor needs to know what already exists.
- **Never embed large code blocks** — let the executor read files themselves.
- **Keep the prompt under 500 words** — the executor has its own 200k context for reading files.
