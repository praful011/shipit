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

**Final Score** = (Clarity x 0.25) + (Specificity x 0.25) + (Actionability x 0.25) + (Grammar x 0.15) + (Scope x 0.10)

Round to nearest whole number. Express as percentage (e.g., "35%").

## Improvement Guidelines

When generating the improved prompt:

1. **Fix spelling and grammar** — Correct all typos and grammatical errors
2. **Expand vague terms** — "auth" -> "user authentication with login, signup, and session management"
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
