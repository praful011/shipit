# ShipIt Conductor Spawn Template

Use this template when spawning a shipit-conductor agent from `/shipit:go` or `/shipit:resume`.

## Fresh Start Template

```
Task(
  subagent_type="shipit:shipit-conductor",
  prompt="First, read your agent definition at agents/shipit-conductor.md for your role and instructions.

## Your Assignment

Execute this task end-to-end: $TASK_DESCRIPTION

## Context from Orchestrator

- **Complexity:** $COMPLEXITY (medium/large)
- **Key files identified:** $KEY_FILES
- **Relevant patterns:** $PATTERNS
- **Branch:** $BRANCH_NAME
- **Model profile:** $MODEL_PROFILE

<files_to_read>
.shipit/PROJECT.md
.shipit/STATE.md
.shipit/config.json
./CLAUDE.md
</files_to_read>

Read ALL files above before doing anything. Use the model profile to select appropriate models when spawning subagents.
"
)
```

## Continuation Template

Use when a previous conductor returned `"incomplete"` (context budget reached).

```
Task(
  subagent_type="shipit:shipit-conductor",
  prompt="First, read your agent definition at agents/shipit-conductor.md for your role and instructions.

## CONTINUATION

Resume executing the task: $TASK_DESCRIPTION

The previous conductor completed through wave $COMPLETED_WAVE. Continue from where it left off.

- **Model profile:** $MODEL_PROFILE

<files_to_read>
.shipit/PLAN.md
.shipit/STATE.md
.shipit/config.json
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>

Read ALL files above. STATE.md has your current position. HANDOFF.md has context from completed tasks.
"
)
```

## Resume Template

Use when `/shipit:resume` spawns a conductor to continue from a previous session.

```
Task(
  subagent_type="shipit:shipit-conductor",
  prompt="First, read your agent definition at agents/shipit-conductor.md for your role and instructions.

## CONTINUATION (Session Resume)

Resume executing the task from where the previous session left off.

The previous session completed tasks 1 through $LAST_COMPLETED. Continue from task $NEXT_TASK.

<files_to_read>
.shipit/PLAN.md
.shipit/STATE.md
.shipit/config.json
.shipit/HANDOFF.md
./CLAUDE.md
</files_to_read>

Read HANDOFF.md carefully — it contains what previous tasks accomplished.
"
)
```

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `$TASK_DESCRIPTION` | User's chosen prompt (from Step 1.5) | The task to execute |
| `$COMPLEXITY` | Step 2 analysis | medium or large |
| `$KEY_FILES` | Step 2 Glob/Grep results | List of relevant files found |
| `$PATTERNS` | Step 2 code reading | Patterns noticed (test framework, import style, etc.) |
| `$BRANCH_NAME` | Step 2.5 git checkout | Current feature branch |
| `$MODEL_PROFILE` | config.json `model_profile` | Which model profile to use for subagents |
| `$COMPLETED_WAVE` | Previous conductor return | Last wave completed |
| `$LAST_COMPLETED` | STATE.md `completed_tasks` | Last completed task number |
| `$NEXT_TASK` | STATE.md `current_task` | Next task to execute |

## Rules

- **Always include model profile** — conductor needs it to select models for subagents.
- **Always include complexity** — conductor uses it to decide if planning is needed.
- **For continuations, always include HANDOFF.md** — it has the context chain.
- **Keep the prompt under 500 words** — conductor reads state files for details.
