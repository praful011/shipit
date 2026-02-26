---
name: shipit:rollback
description: Rollback to a previous task checkpoint
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Rollback the codebase to a previous ShipIt checkpoint. Each task creates a git tag checkpoint before execution, allowing safe rollback if something goes wrong.
</objective>

<process>

## Step 1: List Checkpoints

Find all ShipIt checkpoint tags:

```bash
git tag -l "shipit/checkpoint-*" --sort=-creatordate
```

If no checkpoints found:
> "No checkpoints found. Checkpoints are created automatically when tasks execute. You can still use `git log` to find commits to revert to."

**GATE: At least one checkpoint exists.**

## Step 2: Show Checkpoint Details

For each checkpoint, show:
```bash
# Get the commit info for each tag
git log --oneline -1 <tag>
```

Display as a table:
```
## Available Checkpoints

| # | Checkpoint | Task | Commit | Date |
|---|-----------|------|--------|------|
| 1 | shipit/checkpoint-task-3 | Before Task 3 | abc1234 | 2024-01-15 |
| 2 | shipit/checkpoint-task-2 | Before Task 2 | def5678 | 2024-01-15 |
| 3 | shipit/checkpoint-task-1 | Before Task 1 | ghi9012 | 2024-01-15 |
```

Also show current HEAD:
```bash
git log --oneline -1 HEAD
```

## Step 3: Ask User

```
AskUserQuestion: "Which checkpoint to rollback to?"
- Option 1: "Latest checkpoint (before last task)"
- Option 2: "Choose a specific checkpoint"
- Option 3: "Cancel — don't rollback"
```

If "Choose specific": list all checkpoints and let user pick.

## Step 4: Confirm

Show what will be lost:
```bash
git log --oneline <checkpoint>..HEAD
```

```
AskUserQuestion: "This will undo N commits. Are you sure?"
- Option 1: "Yes, rollback (creates a backup branch first)"
- Option 2: "No, cancel"
```

## Step 5: Execute Rollback

**Safety first:** Create a backup branch before rolling back:
```bash
git branch shipit/backup-$(date +%s)
```

Then reset to the checkpoint:
```bash
git reset --hard <checkpoint-tag>
```

Update ShipIt state to match:
- Read the checkpoint task number from the tag name
- Update STATE.md: set `current_task` to the checkpoint task number, `status: executing`
- Truncate HANDOFF.md to remove entries after the checkpoint task

## Step 6: Report

Display:
- What was rolled back (commits undone)
- Backup branch name (in case user wants to recover)
- Current state (which task ShipIt will resume from)
- Suggestion: "Run `/shipit:resume` to continue from the checkpoint."

</process>

<success_criteria>
- [ ] Checkpoints listed with details
- [ ] User confirmed rollback target
- [ ] Backup branch created BEFORE any destructive action
- [ ] Git reset to checkpoint
- [ ] STATE.md updated to match checkpoint
- [ ] HANDOFF.md truncated appropriately
- [ ] Recovery info shown (backup branch name)
</success_criteria>
