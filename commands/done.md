---
name: shipit:done
description: Verify + finish — runs tests, reviews diff, offers commit/PR/branch
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Verify completed work and offer finishing options (commit, PR, branch).
</objective>

<process>

## Step 1: Deactivate Loop

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs loop deactivate
```

## Step 2: Run Verification

Spawn `shipit-verifier` agent:
```
Task(subagent_type="shipit-verifier", prompt="Verify completed work. Original task from .shipit/PLAN.md")
```

## Step 3: Show Results

Display the verifier's report to the user.

## Step 4: Offer Finishing Options

If verification passes, ask the user:

1. **Commit** — Stage and commit all changes with a summary message
2. **Create PR** — Push to a new branch and create a pull request
3. **Keep working** — Don't finish yet, there's more to do
4. **Just report** — Show what was done but don't commit

## Step 5: Execute Choice

Based on user's choice:
- **Commit:** `git add -A && git commit -m "<summary>"`
- **PR:** Create branch, push, `gh pr create`
- **Keep working:** Do nothing, user will continue
- **Report:** Show diff summary and exit

## Step 6: Clean Up State

Update `.shipit/STATE.md`:
- Set `status: complete`
- Update `updated_at`

Output `<shipit-done/>` to exit any active loop.

</process>
