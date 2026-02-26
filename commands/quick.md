---
name: shipit:quick
description: Quick task execution — skip optional agents, just TDD and commit
argument-hint: "<task description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

<objective>
Execute a quick task directly with TDD enforcement but WITHOUT the full orchestration pipeline. No prompt review, no planning agents, no conductor, no reviewers. Just: understand → test → implement → verify → commit.

Use this for tasks you KNOW are quick (1-2 files, clear scope). If you discover mid-task that it's bigger than expected, STOP and tell the user to use `/shipit:go` instead.
</objective>

<critical_rules>

**This command is for QUICK tasks only.** If any of these are true, STOP and redirect to `/shipit:go`:
- Task requires modifying more than 2 files
- Task requires creating new files beyond test files
- Task scope is unclear or ambiguous
- Task has dependencies on other systems you don't understand

</critical_rules>

<process>

## Step 1: Load Context

Read these files if they exist (skip if missing):
- `.shipit/PROJECT.md` — project context
- `.shipit/config.json` — preferences (especially TDD setting)
- `./CLAUDE.md` — project conventions

**GATE: Context loaded.**

## Step 2: Understand the Task

Use Glob and Grep to find relevant files. Read the files you'll modify to understand the current state.

**Scope check:** If this requires more than 2 files, STOP:
> "This task is bigger than quick. Run `/shipit:go $ARGUMENTS` for the full pipeline."

**GATE: Relevant files identified and read. Confirmed scope is quick (1-2 files).**

## Step 3: Execute with TDD

**If config.tdd is true (default):**

a. **RED** — Write a failing test first.
```bash
# Run the test — it MUST fail
```

b. **GREEN** — Write minimal code to make the test pass.
```bash
# Run the test — it MUST pass now
```

c. **REFACTOR** — Clean up if needed. Run tests again.

**If config.tdd is false or task is non-code (config, docs):**

a. Make the change as described
b. Run appropriate verification (linter, build, etc.)

**GATE: Tests pass (or verification succeeds).**

## Step 4: Commit

Stage files individually (NEVER `git add .`):
```bash
git add src/specific/file.ts
git add src/specific/file.test.ts
git status --short
```

Commit with proper type prefix:
```bash
git commit -m "{type}: {description}

- {key change 1}
- {key change 2}
"
```

**GATE: `git log -1` shows the new commit.**

## Step 5: Done

Tell the user what was done:
- Files changed
- Tests added/modified
- Commit hash

Output `<shipit-done/>`

</process>

<success_criteria>
- [ ] Context loaded (PROJECT.md, config.json, CLAUDE.md)
- [ ] Scope confirmed as quick (1-2 files)
- [ ] TDD enforced if enabled (test written FIRST, seen FAIL, then implementation)
- [ ] All tests pass
- [ ] Files staged individually
- [ ] Atomic commit with proper type prefix
- [ ] `<shipit-done/>` output
</success_criteria>
