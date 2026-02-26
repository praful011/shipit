# ShipIt Verifier Spawn Template

Use this template when spawning a shipit-verifier agent after all tasks complete.

## Template

```
Task(
  subagent_type="shipit:shipit-verifier",
  prompt="First, read your agent definition at agents/shipit-verifier.md for your role and instructions.

## Your Assignment

Verify that the completed work achieves the original task.

## Original Task

$TASK_DESCRIPTION

## What to Verify

1. Run the FULL test suite (not just new tests)
2. Review git diff from before work started
3. Check every new function has a test
4. Verify the code does what was requested (intent check)
5. Check for leftover TODOs, debug code, console.logs

<files_to_read>
.shipit/PLAN.md
.shipit/STATE.md
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>

HANDOFF.md has the cumulative log of all task completions. Use it to understand what was built.
"
)
```

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `$TASK_DESCRIPTION` | User's chosen prompt (from Step 1.5) | The original task to verify against |
