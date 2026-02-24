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

## Rationalizations That Mean "Start Over"

- "Too simple to test"
- "I'll test after"
- "Just this once"
- "Tests after achieve the same goals"
- "Already manually tested it"

All of these mean: delete code, start with the test.

## Verification Checklist

- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
- [ ] Failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass
- [ ] All tests pass
- [ ] No warnings or errors in test output
