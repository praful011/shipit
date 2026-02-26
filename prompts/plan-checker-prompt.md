# ShipIt Plan-Checker Spawn Template

Use this template when spawning a shipit-plan-checker agent after the planner writes PLAN.md.

## Template

```
Task(
  subagent_type="shipit:shipit-plan-checker",
  prompt="First, read your agent definition at agents/shipit-plan-checker.md for your role and instructions.

## Your Assignment

Validate the plan in `.shipit/PLAN.md` against the original task.

## Original Task

$TASK_DESCRIPTION

## Check All 8 Dimensions

1. Task Coverage — does the plan cover all aspects of the task?
2. Task Completeness — does every task have Files, Do, TDD, Verify?
3. Dependency Ordering — are tasks in correct order?
4. Scope Sanity — 2-5 tasks, each fits one atomic commit?
5. Specificity Check — are Do/Verify fields specific (not vague)?
6. TDD Correctness — are TDD flags appropriate?
7. Risk Assessment — any destructive/breaking operations?
8. Context Budget — total plan fits agent context?

<files_to_read>
.shipit/PLAN.md
.shipit/PROJECT.md
.shipit/config.json
./CLAUDE.md
</files_to_read>
"
)
```

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `$TASK_DESCRIPTION` | User's chosen prompt (from Step 1.5) | The original task to validate against |
