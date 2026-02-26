---
name: debugging-methodology
description: Scientific debugging method reference — reproduce, hypothesize, test, fix
---

# Debugging Methodology

## The Iron Law

```
NEVER GUESS. ALWAYS VERIFY.
```

Changing code without understanding the root cause creates new bugs. You MUST understand BEFORE you fix.

## The Scientific Method for Debugging

### Phase 1: Reproduce

**CRITICAL: You MUST reproduce the bug before doing anything else.**

- Get the exact error message (copy it, don't paraphrase)
- Write down exact reproduction steps
- Confirm the bug happens consistently
- If you cannot reproduce it, you cannot fix it. Gather more data.

**GATE: Bug reproduced with exact error. Or confirmed intermittent with specific conditions.**

### Phase 2: Hypothesize

Form 2-3 specific, testable hypotheses about the root cause. Rank by likelihood.

**Good hypotheses:**
- "The `getUserById` function returns null when the user ID contains uppercase letters because the query is case-sensitive"
- "The timeout occurs because the database connection pool is exhausted after 10 concurrent requests"

**Bad hypotheses:**
- "Something is wrong with the database" (too vague)
- "It might be a timing issue" (not testable)

### Phase 3: Test

For each hypothesis (most likely first):
1. Design a test that would confirm OR refute it
2. Run the test
3. Record the result
4. If confirmed → Phase 4
5. If refuted → next hypothesis

**CRITICAL: ONE change at a time. Test after each change. Never change two things at once.**

### Phase 4: Fix

1. Write a failing test that reproduces the bug (regression test)
2. Fix the ROOT CAUSE (not symptoms)
3. Verify the test passes
4. Run the FULL test suite
5. Commit: `fix: <what was fixed and why>`

## Rationalization Prevention

| Thought | Reality | Action |
|---------|---------|--------|
| "I think I know what's wrong" | Thinking is not knowing. Test your hypothesis. | STOP → Write a test |
| "Let me just try changing this" | That's guessing, not debugging. | STOP → Form a hypothesis first |
| "It works now, I'm not sure why" | If you don't know why, you didn't fix it. | STOP → Understand the root cause |
| "I'll fix multiple things at once" | Then you won't know which fix worked. | STOP → One change at a time |
| "The bug is intermittent, I can't reproduce" | Add logging. Narrow the conditions. You CAN reproduce it. | STOP → Gather more data |

## Anti-Patterns

- **Shotgun debugging:** Changing random things hoping the bug disappears
- **Print debugging without a hypothesis:** Adding console.logs everywhere instead of thinking
- **Fixing symptoms:** Wrapping in try/catch to silence errors instead of fixing the cause
- **Blaming external factors:** "It must be a library bug" (it's almost never a library bug)
- **The quick fix:** Changing code without understanding, creating a new bug
