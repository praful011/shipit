---
name: tdd
description: TDD reference for ShipIt executor — RED GREEN REFACTOR cycle
---

# TDD: Red-Green-Refactor

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote code before the test? Delete it. Start over. No exceptions.

## The Cycle

### RED — Write Failing Test
- One test, one behavior
- Clear name describing what should happen
- Use real code, not mocks (unless truly unavoidable)
- Run it. Confirm it FAILS. Confirm it fails for the RIGHT reason.

### GREEN — Minimal Code
- Write the simplest code that makes the test pass
- No extra features, no refactoring, no "improvements"
- Run tests. ALL must pass.

### REFACTOR — Clean Up
- Only after green
- Remove duplication, improve names, extract helpers
- Keep tests green throughout

### COMMIT
- Atomic commit: `feat: <what-was-added>` or `fix: <what-was-fixed>`

## When TDD Doesn't Apply

- Config files, documentation, infrastructure
- Generated code, migrations
- Still VERIFY these work — just skip the red-green cycle

## Rationalization Prevention

**CRITICAL: If you catch yourself thinking any of these, STOP IMMEDIATELY. You are about to violate TDD.**

| Thought | Reality | What To Do |
|---------|---------|------------|
| "Too simple to test" | Simple code has simple tests. Write it in 30 seconds. | STOP → Write the test |
| "I'll test after" | "After" means never. TDD means test FIRST. | STOP → Delete code, write test |
| "Just this once" | "Just this once" always becomes "every time." | STOP → Follow the cycle |
| "Tests after achieve the same goals" | No. TDD catches design issues DURING implementation. After-the-fact tests only check what you already built. | STOP → Delete code, write test |
| "Already manually tested it" | Manual testing is not repeatable, not automated, and will not catch regressions. | STOP → Write an automated test |
| "The test would just be asserting true" | Then the code is trivial and the test takes 10 seconds. Write it. | STOP → Write the test |
| "I know this function works" | You think it works. The test PROVES it works. Thinking is not proof. | STOP → Write the test |
| "This is just a wrapper/passthrough" | Wrappers break too. Test the contract. | STOP → Write the test |
| "I'll add tests in the refactor phase" | REFACTOR means cleaning code, not adding missing tests. Tests go in RED. | STOP → Go back to RED |

**The universal rule:** If the thought includes "skip", "after", "later", "just", "too simple", or "already" — that thought is a TDD violation. Delete any code you wrote and start with the test.

## Verification Checklist

- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
- [ ] Failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass
- [ ] All tests pass
- [ ] No warnings or errors in test output
