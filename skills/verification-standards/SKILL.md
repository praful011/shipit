---
name: verification-standards
description: Verification standards — what "verified" means, evidence requirements, anti-patterns
---

# Verification Standards

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

"It should work" is not verification. "The tests pass" without showing output is not verification. Run the command. Show the output. Then claim completion.

## What "Verified" Means

### Level 1: Tests Pass
- Run the FULL test suite (not just new tests)
- Show the output with pass/fail counts
- ALL tests must pass (not "most" or "the important ones")

### Level 2: Spec Compliance
- Every requirement in the task has corresponding implementation
- Line-by-line check against the Do field
- No missing pieces, no extra pieces

### Level 3: Quality Check
- No TODOs, FIXMEs, or HACK comments in new code
- No console.log, debug artifacts, or temporary code
- No hardcoded secrets or test credentials
- No commented-out code blocks

### Level 4: Intent Verification
- The code does what the USER ASKED FOR (not just what the plan says)
- Read the original task description again — does the output match?
- Would the user look at this and say "yes, that's what I wanted"?

## Evidence Requirements

**CRITICAL: Every verification claim MUST have evidence.**

| Claim | Required Evidence |
|-------|------------------|
| "Tests pass" | Test runner output showing pass count and zero failures |
| "Build succeeds" | Build command output with exit code 0 |
| "No lint errors" | Linter output showing zero errors |
| "Feature works" | Verification command output showing expected behavior |
| "Spec complete" | Checklist matching each Do item to implementation |

## Forbidden Language

These words are NEVER acceptable in verification:

| Forbidden | Why | Replace With |
|-----------|-----|-------------|
| "should work" | Unverified assumption | Run the command and show output |
| "probably fine" | Unverified guess | Run the test and show results |
| "seems correct" | Subjective assessment | Show the evidence |
| "I believe" | Not proof | Show the output |
| "looks good" | Visual assessment without testing | Run the verification command |

## Rationalization Prevention

| Thought | Reality | Action |
|---------|---------|--------|
| "I already tested this mentally" | Mental testing finds 0 bugs. Real testing finds bugs. | STOP → Run the tests |
| "The code is straightforward, no need to verify" | Straightforward code breaks in straightforward ways | STOP → Run verification |
| "Tests take too long" | Broken code in production takes longer | STOP → Run the tests |
| "I'll verify at the end" | Verify each task. Not at the end. Issues compound. | STOP → Verify now |
| "The previous task's tests cover this" | Maybe. Run them and prove it. | STOP → Run the full suite |

## Anti-Patterns

- **Assumed verification:** "I wrote the test, so it passes" (run it and see)
- **Partial verification:** "The main test passes" (run ALL tests)
- **Stale verification:** "Tests passed 3 tasks ago" (run them again now)
- **Visual verification:** "The code looks right" (run the verification command)
- **Proxy verification:** "The build passes so the feature works" (build passing ≠ feature working)
