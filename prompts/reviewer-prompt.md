# ShipIt Reviewer Spawn Template

Use this template when spawning a shipit-reviewer agent after each executor completes.

## Template

```
Task(
  subagent_type="shipit:shipit-reviewer",
  prompt="First, read your agent definition at agents/shipit-reviewer.md for your role and instructions.

## Your Assignment

Review **Task $TASK_NUMBER: $TASK_NAME** that was just completed by the executor.

## What Was Done

$EXECUTOR_SUMMARY

## Review Focus

1. **Spec compliance:** Does the implementation match the task's Do field exactly?
2. **Code quality:** Security, error handling, patterns, testing, performance, cleanup
3. **TDD compliance:** If TDD was required, were tests written first?

<files_to_read>
.shipit/PLAN.md
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>

Read the task spec from PLAN.md, then read the actual files that were changed (listed in HANDOFF.md).
"
)
```

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `$TASK_NUMBER` | STATE.md `current_task` (before increment) | Which task was completed |
| `$TASK_NAME` | PLAN.md task heading | Name of the completed task |
| `$EXECUTOR_SUMMARY` | HANDOFF.md latest entry | What the executor reported doing (files changed, decisions, context) |
