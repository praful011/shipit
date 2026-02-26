---
name: code-review
description: Code review guidelines — what to check, severity levels, review process
---

# Code Review

## Purpose

Code review catches bugs, enforces patterns, and ensures quality BEFORE issues compound. Review after EVERY task, not just at the end.

## Two-Stage Review Process

### Stage 1: Spec Compliance

Does the implementation match EXACTLY what was specified?

| Check | Question |
|-------|----------|
| **Completeness** | Does the code do EVERYTHING the spec says? |
| **Accuracy** | Does it do it CORRECTLY? |
| **Files** | Were the correct files modified (not random other files)? |
| **No Over-Engineering** | Was ONLY what was specified implemented? No extras? |
| **No Under-Engineering** | Are there missing pieces the spec required? |
| **TDD Compliance** | If TDD required, were tests written FIRST? |

### Stage 2: Code Quality

| Category | What to Check |
|----------|---------------|
| **Security** | Hardcoded secrets, unvalidated input, SQL injection, XSS, missing auth |
| **Error Handling** | Missing try/catch, unhandled promises, silent failures |
| **Patterns** | Follows project conventions, consistent naming, proper imports |
| **Testing** | Tests cover happy path + edge cases, assertions are meaningful |
| **Performance** | N+1 queries, missing indexes, unnecessary loops |
| **Cleanup** | No TODOs, no console.log, no commented-out code, no debug artifacts |

## Severity Levels

| Severity | Definition | Action |
|----------|-----------|--------|
| **CRITICAL** | Security vulnerability, data loss, broken functionality | BLOCK — fix before ANY next work |
| **IMPORTANT** | Missing error handling, inadequate tests, pattern violations | FIX — fix before next task |
| **MINOR** | Style issues, naming, minor optimizations | NOTE — track but don't block |

## Rationalization Prevention

| Thought | Reality | Action |
|---------|---------|--------|
| "The code works, good enough" | Working code can still have security holes, missing tests, and pattern violations | STOP → Review fully |
| "This is a small change, skip review" | Small changes introduce small bugs that compound | STOP → Review it |
| "I wrote it, I know it's correct" | Self-review is blind to your own assumptions | STOP → Review against the spec |
| "The tests pass, ship it" | Passing tests don't check for security, patterns, or cleanup | STOP → Review quality |

## Evidence Requirements

**CRITICAL: No review claim without evidence.**

- "Tests pass" → Show test output with pass count
- "No security issues" → List what you checked
- "Spec compliant" → Reference each spec point and where it's implemented
- "Clean code" → Confirm no TODOs, no debug code, no console.logs
