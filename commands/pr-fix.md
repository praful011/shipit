---
name: shipit:pr-fix
description: Apply auto-fixable review findings from a prior shipit-review run, with deep impact analysis, batch approval, per-fix test validation, auto-push, and auto-rereview.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - Skill
  - AskUserQuestion
---

<objective>
Automate the fix step that follows a `shipit-review` peer review: read the marker state, filter for machine-applicable findings, compute impact analysis, present a single batch-approval fix plan, execute fixes atomically (with per-fix test validation and rollback), push, and trigger a verifying re-review.
</objective>

<inputs>

Called as:
```
/shipit:pr-fix <MR_URL>
```

If `<MR_URL>` is omitted, auto-detect the MR from the current branch (see Step 1).

</inputs>

<process>

## Step 1: Load context

Read `./CLAUDE.md` if it exists (optional project conventions).

Read `.shipit/config.json`. If `pr_fix.enabled == false`, print `"pr-fix is disabled in .shipit/config.json. Set pr_fix.enabled: true to use this command."` and exit. All downstream steps are gated by this check.

## Step 2: Invoke the orchestration skill

The full fix workflow is defined in `skills/shipit-pr-fix/SKILL.md`. Load it:

```
Skill(skill: "shipit:shipit-pr-fix", args: {
  mr_url: "<MR_URL from invocation, or empty for auto-detect>"
})
```

The skill handles every phase:

| Phase | What |
|---|---|
| 0 | Config gate (aborts early if disabled) |
| 1 | Parse/detect MR, fetch marker, partition findings, build worktree, detect test runner, compute per-fix impact analysis, present batch-approval plan |
| 2 | Dispatch `shipit-fixer` per finding with inter-fix rebase |
| 3 | Push (if `pr_fix.auto_push`) + auto-rereview via `shipit-peer-reviewer` (if `pr_fix.auto_rereview_after_fix`) + worktree cleanup + final summary |

The command's job is minimal — orchestration lives in the skill. Do not re-implement phase logic here.

## Step 3: Pass result back to user

The skill prints its own phase-by-phase output and a final summary. The command completes when the skill returns.

If the skill aborted early (Phase 0 config gate, missing marker, merged MR, etc.), the skill's own message is sufficient. Do not add a redundant layer.

</process>

<error_handling>

All error handling lives in the orchestration skill. See `skills/shipit-pr-fix/SKILL.md` Error Handling table. This command is a thin entry point.

</error_handling>

<success_criteria>
- [ ] `pr_fix.enabled` config gate checked before any work
- [ ] `Skill` tool used to invoke `shipit:shipit-pr-fix` with the MR URL
- [ ] No phase logic duplicated between command and skill
</success_criteria>
