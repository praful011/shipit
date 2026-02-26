# Prompt Review Feature Design

**Date:** 2026-02-26
**Status:** Approved

## Overview

Add a prompt quality review step as the first action in `/shipit:go` and `/shipit:plan`. When a user submits a task prompt, ShipIt will:

1. Score the original prompt quality (percentage)
2. Generate an improved, Claude-optimized version
3. Score the improved version
4. Present both to the user with scores
5. Let the user choose which prompt to proceed with
6. Save the prompt to a history log

## Architecture

### Flow

```
User prompt → Load Context → Prompt Review (NEW) → Analyze Complexity → ...
```

The prompt review step sits between "Load Context" (Step 1) and "Analyze Task Complexity" (Step 2) in both `go.md` and `plan.md`.

### Scoring Criteria (Weighted)

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Clarity | 25% | Is the intent immediately clear? |
| Specificity | 25% | Are requirements detailed enough to act on? |
| Actionability | 25% | Can this be directly executed without guessing? |
| Grammar/Spelling | 15% | Proper English, no typos |
| Scope Definition | 10% | Are boundaries and deliverables defined? |

Score = sum of weighted criterion scores (0-100%).

### Improvement Guidelines

The skill instructs Claude to:
- Fix spelling and grammar
- Make vague terms specific (e.g., "auth" → "user authentication with login, signup, and session management")
- Add implicit requirements that are clearly needed
- Define scope boundaries
- Use imperative, action-oriented language
- Keep the improved prompt concise (1-2 sentences max)

### User Interaction

Using `AskUserQuestion` with two options:

```
Your prompt quality: 35%
Improved prompt: "Implement user authentication system with login, signup, and session management"
Improved prompt quality: 88%

Options:
1. Continue with improved prompt (Recommended)
2. Keep my original prompt
```

### Prompt History

Saved to `.shipit/prompts/history.md` with append-only entries:

```markdown
# Prompt History

## 2026-02-26T10:00:00Z
- **Original:** devlop auth for user authentication
- **Original Score:** 35%
- **Improved:** Implement user authentication system with login, signup, and session management
- **Improved Score:** 88%
- **Used:** improved
```

## Files

### New Files

1. **`skills/prompt-review/SKILL.md`** — Centralized prompt review logic with scoring criteria and improvement guidelines
2. **`.shipit/prompts/history.md`** — Auto-created prompt history (runtime, not committed)

### Modified Files

3. **`commands/go.md`** — Add "Step 1.5: Prompt Review" between Load Context and Analyze Complexity
4. **`commands/plan.md`** — Add "Step 1.5: Prompt Review" between Load Context and Quick Brainstorm
5. **`skills/shipit-core/SKILL.md`** — Mention prompt review in "How It Works" section

## Decisions

- **Approach:** Separate skill file (not inline, not agent) — DRY and right abstraction level
- **Scoring:** Percentage-based (0-100%)
- **Storage:** Append-only history file at `.shipit/prompts/history.md`
- **Scope:** Applies to `/shipit:go` and `/shipit:plan` only
- **User choice:** Always ask — never auto-improve silently
