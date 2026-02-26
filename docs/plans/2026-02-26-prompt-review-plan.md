# Prompt Review Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a prompt quality review step to `/shipit:go` and `/shipit:plan` that scores, improves, and lets users choose their preferred prompt before execution.

**Architecture:** New skill file `skills/prompt-review/SKILL.md` contains centralized scoring criteria and improvement logic. Both `commands/go.md` and `commands/plan.md` reference this skill as a new "Step 1.5" between loading context and analyzing the task. Chosen prompts are appended to `.shipit/prompts/history.md`.

**Tech Stack:** Markdown skill files (Claude Code plugin system), no runtime code changes.

---

### Task 1: Create the Prompt Review Skill

**Files:**
- Create: `skills/prompt-review/SKILL.md`

**Step 1: Create the skill directory**

Run: `mkdir -p skills/prompt-review`

**Step 2: Write the skill file**

Create `skills/prompt-review/SKILL.md` with this exact content:

```markdown
---
name: prompt-review
description: Reviews and improves user prompts before ShipIt execution
---

# Prompt Review

Review the user's task prompt for quality and generate an improved version before proceeding with execution.

## When This Runs

This step runs as "Step 1.5" in `/shipit:go` and `/shipit:plan`, after loading context but before analyzing the task.

## Scoring Criteria

Score the prompt on these weighted criteria (each 0-100, then weighted):

| Criterion | Weight | What to Check |
|-----------|--------|---------------|
| Clarity | 25% | Is the intent immediately clear? Can you tell what the user wants without guessing? |
| Specificity | 25% | Are requirements detailed enough to act on? Are key terms defined, not vague? |
| Actionability | 25% | Can this be directly executed? Are deliverables implicit or explicit? |
| Grammar/Spelling | 15% | Proper English, no typos, readable sentence structure |
| Scope Definition | 10% | Are boundaries defined? Is it clear what's included and excluded? |

**Final Score** = (Clarity × 0.25) + (Specificity × 0.25) + (Actionability × 0.25) + (Grammar × 0.15) + (Scope × 0.10)

Round to nearest whole number. Express as percentage (e.g., "35%").

## Improvement Guidelines

When generating the improved prompt:

1. **Fix spelling and grammar** — Correct all typos and grammatical errors
2. **Expand vague terms** — "auth" → "user authentication with login, signup, and session management"
3. **Add implicit requirements** — If "add auth" clearly needs a database model, mention it
4. **Define scope** — Add what's included if the original is open-ended
5. **Use imperative language** — Start with an action verb: "Implement", "Add", "Create", "Fix"
6. **Stay concise** — Keep to 1-2 sentences max. Don't over-specify.
7. **Preserve intent** — Never change what the user actually wants, only clarify it

## Process

1. **Score the original prompt** using the criteria above
2. **Generate an improved version** following the guidelines
3. **Score the improved version** using the same criteria
4. **Present to user** using AskUserQuestion:

```
Your prompt: "$ORIGINAL_PROMPT"
Your prompt quality: $ORIGINAL_SCORE%

Improved prompt: "$IMPROVED_PROMPT"
Improved prompt quality: $IMPROVED_SCORE%
```

Use AskUserQuestion with these options:
- Option 1: "Continue with improved prompt (Recommended)" — description: the improved prompt text
- Option 2: "Keep my original prompt" — description: the original prompt text

5. **Save to history** — Append the result to `.shipit/prompts/history.md`
6. **Return the chosen prompt** — Use the chosen prompt as `$ARGUMENTS` for subsequent steps

## History File Format

Create `.shipit/prompts/` directory if it doesn't exist. Append to `.shipit/prompts/history.md`:

```markdown
## $TIMESTAMP
- **Original:** $ORIGINAL_PROMPT
- **Original Score:** $ORIGINAL_SCORE%
- **Improved:** $IMPROVED_PROMPT
- **Improved Score:** $IMPROVED_SCORE%
- **Used:** original|improved
```

If the file doesn't exist yet, create it with this header first:

```markdown
# ShipIt Prompt History

> Log of all prompts reviewed by ShipIt. Each entry shows the original, improved version, and which was used.

```
```

**Step 3: Verify the file exists and is well-formed**

Run: `cat skills/prompt-review/SKILL.md | head -5`
Expected: Shows the frontmatter with `name: prompt-review`

**Step 4: Commit**

```bash
git add skills/prompt-review/SKILL.md
git commit -m "feat: add prompt-review skill with scoring criteria and improvement guidelines"
```

---

### Task 2: Add Prompt Review Step to go.md

**Files:**
- Modify: `commands/go.md:28-29` (between Step 1 and Step 2)

**Step 1: Add Step 1.5 to go.md**

Insert the following block between `## Step 1: Load Context` (after its content ends at line 27) and `## Step 2: Analyze Task Complexity` (currently line 29):

```markdown

## Step 1.5: Prompt Review

Review and improve the user's task prompt before proceeding.

Follow the process defined in the `prompt-review` skill (`skills/prompt-review/SKILL.md`):

1. **Score the original prompt** on Clarity (25%), Specificity (25%), Actionability (25%), Grammar (15%), Scope (10%)
2. **Generate an improved version** — fix spelling, expand vague terms, add implicit requirements, use imperative language
3. **Score the improved version** using the same criteria
4. **Present both to the user** using AskUserQuestion:
   - Show original prompt and its score
   - Show improved prompt and its score
   - Option 1: "Continue with improved prompt (Recommended)"
   - Option 2: "Keep my original prompt"
5. **Save to history** — Append the entry to `.shipit/prompts/history.md` (create file and directory if needed)
6. **Use the chosen prompt** as `$ARGUMENTS` for all subsequent steps

```

**Step 2: Renumber subsequent steps**

After inserting Step 1.5, renumber the existing steps:
- Step 2 → Step 2 (no change, "1.5" doesn't shift numbering)

No renumbering needed — "Step 1.5" sits cleanly between 1 and 2.

**Step 3: Update the Step 4.5 (HANDOFF.md) reference**

The existing flow references `## Step 4.5: Initialize HANDOFF.md` — this numbering pattern is already used, so "Step 1.5" is consistent.

**Step 4: Verify the file is valid**

Run: `cat commands/go.md | grep "## Step"` to confirm step ordering: 1, 1.5, 2, 3, 4, 5, 6, 7

**Step 5: Commit**

```bash
git add commands/go.md
git commit -m "feat: add prompt review step (1.5) to /shipit:go command"
```

---

### Task 3: Add Prompt Review Step to plan.md

**Files:**
- Modify: `commands/plan.md:22-23` (between Step 1 and Step 2)

**Step 1: Add Step 1.5 to plan.md**

Insert the following block between `## Step 1: Load Context` (after its content ends at line 22) and `## Step 2: Quick Brainstorm` (currently line 24):

```markdown

## Step 1.5: Prompt Review

Review and improve the user's task prompt before proceeding.

Follow the process defined in the `prompt-review` skill (`skills/prompt-review/SKILL.md`):

1. **Score the original prompt** on Clarity (25%), Specificity (25%), Actionability (25%), Grammar (15%), Scope (10%)
2. **Generate an improved version** — fix spelling, expand vague terms, add implicit requirements, use imperative language
3. **Score the improved version** using the same criteria
4. **Present both to the user** using AskUserQuestion:
   - Show original prompt and its score
   - Show improved prompt and its score
   - Option 1: "Continue with improved prompt (Recommended)"
   - Option 2: "Keep my original prompt"
5. **Save to history** — Append the entry to `.shipit/prompts/history.md` (create file and directory if needed)
6. **Use the chosen prompt** as `$ARGUMENTS` for all subsequent steps

```

**Step 2: Verify the file is valid**

Run: `cat commands/plan.md | grep "## Step"` to confirm step ordering: 1, 1.5, 2, 3, 4, 5, 6

**Step 3: Commit**

```bash
git add commands/plan.md
git commit -m "feat: add prompt review step (1.5) to /shipit:plan command"
```

---

### Task 4: Update shipit-core Skill with Prompt Review Mention

**Files:**
- Modify: `skills/shipit-core/SKILL.md:25-30` (the "How It Works" section)

**Step 1: Update the "How It Works" section**

In `skills/shipit-core/SKILL.md`, modify the "How It Works" section to insert a new item after the current item 1. Change:

```markdown
## How It Works

1. **`/shipit:go`** is the main command. Use it for 90% of work.
2. It auto-detects task complexity (quick/medium/large) and routes accordingly.
```

To:

```markdown
## How It Works

1. **`/shipit:go`** is the main command. Use it for 90% of work.
2. It first reviews your prompt quality, suggests an improved version, and lets you choose.
3. It auto-detects task complexity (quick/medium/large) and routes accordingly.
```

And renumber the remaining items (old 3→4, 4→5, 5→6, 6→7).

**Step 2: Update the command count**

Change line 8 from:
```
ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, and smart task decomposition into 8 commands.
```
To:
```
ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, smart task decomposition, and prompt quality review into 10 commands.
```

**Step 3: Add HANDOFF.md to State Files section**

In the "State Files" section, add:
```markdown
- `.shipit/prompts/history.md` — Prompt review history log
```

**Step 4: Verify**

Run: `cat skills/shipit-core/SKILL.md` and confirm the new item appears in "How It Works"

**Step 5: Commit**

```bash
git add skills/shipit-core/SKILL.md
git commit -m "feat: document prompt review in shipit-core skill"
```

---

### Task 5: Final Verification

**Step 1: Check all files are consistent**

Run these commands:
```bash
# Verify skill file exists
ls skills/prompt-review/SKILL.md

# Verify go.md has Step 1.5
grep "Step 1.5" commands/go.md

# Verify plan.md has Step 1.5
grep "Step 1.5" commands/plan.md

# Verify shipit-core mentions prompt review
grep -i "prompt" skills/shipit-core/SKILL.md
```

Expected: All commands succeed with matching output.

**Step 2: Review the full diff**

Run: `git diff HEAD~4 --stat` to see all changed files.

Expected:
```
 commands/go.md                  | modified
 commands/plan.md                | modified
 skills/prompt-review/SKILL.md   | new file
 skills/shipit-core/SKILL.md     | modified
```

**Step 3: Test manually (optional)**

In a new Claude Code session with this plugin, run:
```
/shipit:go devlop auth for user authentication
```

Expected behavior:
1. Loads context
2. Scores the prompt (should be low due to "devlop" typo and vagueness)
3. Shows improved prompt with higher score
4. Asks user to choose
5. Proceeds with chosen prompt
