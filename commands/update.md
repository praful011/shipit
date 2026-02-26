---
name: shipit:update
description: Update ShipIt plugin to latest version from remote
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
Update the ShipIt plugin to the latest version by pulling from the git remote.
</objective>

<process>

## Step 1: Find Plugin Location

Determine where ShipIt is installed. Check these locations in order:
1. `${CLAUDE_PLUGIN_ROOT}` (preferred — set by Claude Code)
2. Common marketplace paths:
   - `~/.claude/plugins/marketplaces/shipit-marketplace`
   - `~/.claude/plugins/cache/shipit-marketplace/shipit/1.0.0`

Use the first location that exists and contains a `.git` directory.

If no git repo found, tell the user:
"ShipIt was not installed via git. Please reinstall with `/plugin marketplace add praful011/shipit` then `/plugin install shipit@shipit-marketplace`."

## Step 2: Check Current Version

```bash
cd <plugin-dir> && git log --oneline -1
```

Read the `VERSION` file for the current version number:
```bash
cat <plugin-dir>/VERSION
```

Also read `.claude-plugin/plugin.json` for the plugin metadata version.

## Step 3: Fetch Latest

```bash
cd <plugin-dir> && git fetch origin main
```

## Step 4: Show Changes

Check if there are updates available:

```bash
cd <plugin-dir> && git log HEAD..origin/main --oneline
```

If no new commits, tell the user: "ShipIt is already up to date!" and stop.

If there are new commits, show the user:
- Number of new commits
- Summary of changes (commit messages)
- Files that will change:
  ```bash
  cd <plugin-dir> && git diff --stat HEAD..origin/main
  ```

## Step 5: Confirm Update

Ask the user: "Update ShipIt to latest? This will pull N new commits."

Options:
- **Yes, update** — Proceed with the update
- **No, skip** — Cancel the update

## Step 6: Apply Update

```bash
cd <plugin-dir> && git pull origin main
```

## Step 7: Show Result

Read the updated `VERSION` file and `CHANGELOG.md` for the new version details.

Display:
- Previous version → New version
- Previous commit → New commit
- Changes from CHANGELOG.md (just the latest version section)
- Reminder: "Restart Claude Code to load the updated plugin."

If `CHANGELOG.md` exists, show the relevant section for the new version so the user knows what changed.

</process>
