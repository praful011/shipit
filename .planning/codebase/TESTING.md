# Testing Patterns

**Analysis Date:** 2026-04-01

## Project Overview

ShipIt is a pure documentation project — there is no traditional test runner, test files, or automated testing infrastructure. This is a Claude Code plugin consisting entirely of Markdown files that define agents, commands, and skills.

**Testing in ShipIt occurs at structural and content verification levels**, not through automated test execution. The testing framework is built into the workflow processes themselves.

## Verification Framework (Replaces Traditional Testing)

Since ShipIt has no test runner, verification happens through **two parallel verification systems**:

### 1. Process Verification (Built Into Workflows)

**The Iron Law of Verification:**

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

Every agent and command must provide concrete evidence that work is complete. This is enforced through:

- **Gates:** Checkpoints marked with `**GATE: [condition]. Proceed to [next step].**`
- **Evidence requirements:** Maps claims (e.g., "tests pass") to required proof
- **Receipt files:** JSON proof-of-work for task execution (`.shipit/receipts/task-N.json`)

**Verification Levels** (from `skills/verification-standards/SKILL.md`):

| Level | What to Verify | How |
|-------|----------------|-----|
| **Level 1: Tests Pass** | Full test suite execution | Run command, show output with pass/fail counts |
| **Level 2: Spec Compliance** | Every requirement implemented | Line-by-line check against task Do field |
| **Level 3: Quality Check** | No TODOs, FIXMEs, debug code, secrets | Scan files for violations |
| **Level 4: Intent Verification** | Code matches original user request | Compare output to original task description |

**Evidence Mapping** (from `skills/verification-standards/SKILL.md`):

| Claim | Required Evidence |
|-------|------------------|
| "Tests pass" | Test runner output showing pass count and zero failures |
| "Build succeeds" | Build command output with exit code 0 |
| "No lint errors" | Linter output showing zero errors |
| "Feature works" | Verification command output showing expected behavior |
| "Spec complete" | Checklist matching each Do item to implementation |

**Process:** Documented in `skills/verification-standards/SKILL.md`

### 2. Code Review & Pattern Verification

**Reviewer Verification Process** (from `agents/shipit-reviewer.md`):

Each code review has two stages that function as verification gates:

**Stage 1: Spec Compliance Review**
- Check: Does code do EVERYTHING in the task **Do** field?
- Check: Is it correct?
- Check: Were correct files modified (not random others)?
- Check: No over-engineering?
- Check: No under-engineering?
- Check: TDD compliance if required?

**Stage 2: Code Quality Review**

| Category | What to Check |
|----------|---------------|
| **Security** | Hardcoded secrets, unvalidated input, SQL injection, XSS, missing auth checks |
| **Error Handling** | Missing try/catch, unhandled promise rejections, silent failures |
| **Patterns** | Follows PROJECT_CONTEXT.md conventions, consistent naming, proper imports |
| **Testing** | Tests cover happy path + edge cases, assertions are meaningful |
| **Performance** | N+1 queries, missing indexes, unnecessary loops, memory leaks |
| **Cleanup** | No TODO/FIXME, no console.log, no commented-out code, no debug artifacts |
| **Lessons Check** | No repetition of issues from LESSONS.md (previous review findings) |

**Review Result Classification** (from `agents/shipit-reviewer.md`):

| Result | Meaning | Action |
|--------|---------|--------|
| **APPROVED** | Spec compliance + quality checks pass | Proceed to next task |
| **NEEDS FIX** | Issues found (IMPORTANT or lower severity) | Return to executor with specific issues |
| **BLOCKED** | Critical issues found | Stop immediately, fix required before proceeding |

**Process:** Documented in `agents/shipit-reviewer.md`

### 3. Integration Verification

**Integration Checker** (from `agents/shipit-integration-checker.md`):

After all individual tasks pass review, integration testing verifies tasks work TOGETHER:

**Steps:**
1. **Load context** — Read PLAN.md (what was planned), HANDOFF.md (what was actually done), STATE.md, CLAUDE.md
2. **Map task boundaries** — Identify shared interfaces, dependencies, multi-task files
3. **Check integration points** — Verify interface compatibility, API contracts, data flow, shared state
4. **Run end-to-end flows** — Execute full workflows that span multiple tasks
5. **Check for conflicts** — Verify no competing logic or state corruption

**Integration checks:**
- Interface Compatibility: Exported functions/types match what consumers expect
- API Contracts: Request/response shapes consistent
- Configuration Alignment: Shared config values are coherent
- Data Flow Integrity: Data transforms correctly between task boundaries
- State Consistency: Shared state not corrupted
- Dependency Chain: All dependencies satisfied
- Cross-Task Workflows: End-to-end user flows work

**Process:** Documented in `agents/shipit-integration-checker.md`

## TDD (Test-Driven Development) Framework

**The Iron Law:**

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

TDD is enforced as a mandatory workflow for code tasks (not config/docs).

### The Red-Green-Refactor Cycle

**RED — Write Failing Test**
- One test, one behavior
- Clear name describing what should happen
- Use real code, not mocks (unless truly unavoidable)
- Run it. Confirm it FAILS for the RIGHT reason.

**GREEN — Minimal Code**
- Write the simplest code that makes the test pass
- No extra features, no refactoring, no "improvements"
- Run tests. ALL must pass.

**REFACTOR — Clean Up**
- Only after green
- Remove duplication, improve names, extract helpers
- Keep tests green throughout

**COMMIT**
- Atomic commit: `feat: <what-was-added>` or `fix: <what-was-fixed>`

### When TDD Doesn't Apply

- Config files, documentation, infrastructure
- Generated code, migrations
- Still VERIFY these work — just skip the red-green cycle

### Rationalization Prevention

The TDD skill includes a comprehensive **rationalization prevention table** that maps common excuses to their reality:

| Thought | Reality | What To Do |
|---------|---------|------------|
| "Too simple to test" | Simple code has simple tests. Write it in 30 seconds. | STOP → Write the test |
| "I'll test after" | "After" means never. TDD means test FIRST. | STOP → Delete code, write test |
| "Just this once" | "Just this once" always becomes "every time." | STOP → Follow the cycle |
| "Tests after achieve the same goals" | No. TDD catches design issues DURING implementation. | STOP → Delete code, write test |
| "Already manually tested it" | Manual testing is not repeatable, not automated. | STOP → Write an automated test |
| "The test would just be asserting true" | Then the code is trivial and the test takes 10 seconds. | STOP → Write the test |
| "I know this function works" | You think it works. The test PROVES it works. | STOP → Write the test |
| "This is just a wrapper/passthrough" | Wrappers break too. Test the contract. | STOP → Write the test |
| "I'll add tests in the refactor phase" | REFACTOR means cleaning code, not adding missing tests. | STOP → Go back to RED |

**Full TDD specification:** `skills/tdd/SKILL.md`

## Task Execution Verification

### Receipt Files (Proof of Work)

Each task produces a JSON receipt at `.shipit/receipts/task-N.json` that proves execution:

```json
{
  "task_number": 1,
  "task_name": "Task Name",
  "status": "completed",
  "tests_run": true,
  "test_output": "...",
  "verify_result": "pass",
  "verify_command": "npm test",
  "self_review": true,
  "tdd_compliant": true,
  "checkpoint_tag": "shipit/checkpoint-task-1",
  "confidence": "high",
  "files_modified": ["src/file1.ts", "src/file2.ts"],
  "commit_hash": "abc123...",
  "duration_seconds": 45
}
```

**Executor creates checkpoint** before any changes:
```bash
git tag "shipit/checkpoint-task-$TASK_NUMBER" HEAD
```

This allows rollback to pre-task state if needed via `/shipit:rollback`.

**Reviewer verifies receipt** before reviewing code:

| Check | Requirement |
|-------|-------------|
| `tests_run` | Must be `true` — executor ran tests |
| `verify_result` | Must be `"pass"` — verify command succeeded |
| `self_review` | Must be `true` — executor reviewed own diff |
| `tdd_compliant` | Must be `true` if task had `TDD: yes` |
| `checkpoint_tag` | Must exist — executor created git checkpoint |

**Process:** Documented in `agents/shipit-executor.md` (checkpoint creation) and `agents/shipit-reviewer.md` (receipt verification)

## Confidence Scoring (Quality Assurance)

Executors assess confidence BEFORE writing code and record it in the receipt.

### Confidence Levels

| Level | Score | Criteria | Action |
|-------|-------|----------|--------|
| **HIGH** | 80-100% | Clear requirements, familiar patterns, straightforward implementation | Execute normally |
| **MEDIUM** | 50-79% | Some ambiguity, unfamiliar APIs, multiple valid approaches | Execute but flag in receipt — triggers stricter review |
| **LOW** | 0-49% | Unclear requirements, unfamiliar domain, risky changes, uncertain side effects | BLOCK — output `<shipit-blocked>` signal |

### Confidence Assessment Questions

Before writing code, assess:
- Do I understand EXACTLY what this task needs? (If guessing → lower confidence)
- Have I seen this pattern before in this codebase? (If new → lower confidence)
- Could this break existing functionality? (If yes → lower confidence)
- Are there multiple valid approaches and I'm unsure which? (If yes → lower confidence)

**Process:** Documented in `agents/shipit-executor.md` (Step 3.7: Confidence Assessment)

## Learning Loop (Persistent Quality Improvement)

### LESSONS.md File

After each review, critical findings are captured in `.shipit/LESSONS.md`:

```markdown
# Review Findings & Lessons

## Category: error-handling
- Issue: Missing null checks on user input
  Files: src/api/handler.ts (Task 2)
  Pattern: Always validate incoming API parameters before use

## Category: patterns
- Issue: Inconsistent naming in database queries
  Files: src/db/queries.ts (Task 1)
  Pattern: Use snake_case for database fields, camelCase for JS variables
```

### Deferred Issues

Out-of-scope issues found during execution are captured in `.shipit/DEFERRED.md`:

```markdown
# Deferred Issues

## Issue: Missing database migration
Found: Task 3 (added new user fields)
Impact: Schema mismatch in production
Recommendation: Create migration file before next schema change
```

**Process:** Documented in `agents/shipit-conductor.md` (Learning Loop section)

## Pattern Extraction (Peer Review Learning)

After peer reviews, critical findings are extracted into project-specific pattern files at `.claude/skills/pr-review-patterns/SKILL.md`:

**How it works:**
1. Filter review results to CRITICAL + IMPORTANT severity only
2. Generalize each finding (remove MR-specific details)
3. Read existing skill file in the project repo (create from template if missing)
4. Deduplicate against ALL existing entries (cross-reviewer)
5. Append only genuinely new patterns

**Example pattern file:**
```markdown
---
name: pr-review-patterns
description: Critical patterns from peer reviews
---

# PR Review Patterns

## CRITICAL: Missing error handling

Pattern: API endpoints must handle all error cases
Example: `POST /api/users` must handle validation errors, database errors, auth errors
Fix: Wrap endpoint in try/catch, return appropriate status codes

## CRITICAL: Hardcoded configuration

Pattern: No hardcoded environment-specific values
Example: Database URLs, API keys, feature flags
Fix: Load from environment variables or configuration service
```

**Process:** Documented in `skills/peer-review/SKILL.md`

## Analytics & Trust Scoring

### Trust Score

Persistent analytics in `.shipit/analytics.json` track code quality over time:

```json
{
  "trust_score": 75,
  "total_runs": 12,
  "successful_runs": 10,
  "failed_runs": 2,
  "total_tasks_executed": 34,
  "common_failures": ["missing error handling", "flaky test setup"],
  "avg_review_iterations": 1.3,
  "code_health_trend": [85, 87, 84, 90]
}
```

### Trust Score Calculation

- Starts at 50 (neutral)
- +5 per successful run (all tasks pass verification)
- -10 per failed run (verification fails or blocked)
- -5 per task that needed 2+ review iterations
- Max 100, min 0

### Impact on Execution

| Trust Score | Autonomy Effect | Review Depth |
|-------------|-----------------|--------------|
| < 30 | Force `"guided"` mode | Strict review every step |
| 30-70 | Respect config autonomy_mode | Normal review |
| > 70 | Allow `"autonomous"` mode | Lighter review, trust established |

**Process:** Documented in `agents/shipit-conductor.md` (Analytics section)

## Verification Checklist Template

Used by all agents to verify work is complete:

**TDD Verification** (from `skills/tdd/SKILL.md`):
```markdown
- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
- [ ] Failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass
- [ ] All tests pass
- [ ] No warnings or errors in test output
```

**Spec Compliance Verification** (from `agents/shipit-reviewer.md`):
```markdown
- [ ] Does code do EVERYTHING the Do field specified?
- [ ] Is implementation correct?
- [ ] Were correct files modified?
- [ ] No over-engineering?
- [ ] No under-engineering?
- [ ] TDD compliance verified if required?
```

## Forbidden Language in Verification

These words are **NEVER** acceptable in verification claims:

| Forbidden | Why | Replace With |
|-----------|-----|-------------|
| "should work" | Unverified assumption | Run the command and show output |
| "probably fine" | Unverified guess | Run the test and show results |
| "seems correct" | Subjective assessment | Show the evidence |
| "I believe" | Not proof | Show the output |
| "looks good" | Visual assessment without testing | Run the verification command |

**Source:** `skills/verification-standards/SKILL.md`

## Verification Anti-Patterns

Patterns that VIOLATE verification standards:

| Anti-Pattern | Why It's Wrong | Fix |
|-------------|----------------|-----|
| **Assumed verification** | "I wrote the test, so it passes" | Run it and show the output |
| **Partial verification** | "The main test passes" | Run ALL tests |
| **Stale verification** | "Tests passed 3 tasks ago" | Run them again now |
| **Visual verification** | "The code looks right" | Run the verification command |
| **Proxy verification** | "The build passes so the feature works" | Build passing ≠ feature working |

**Source:** `skills/verification-standards/SKILL.md`

## File Paths for Testing Documentation

**Core testing skills:**
- `skills/tdd/SKILL.md` — Test-driven development cycle
- `skills/verification-standards/SKILL.md` — What "verified" means, evidence requirements
- `skills/code-review/SKILL.md` — Code review process with verification checks

**Agent verification processes:**
- `agents/shipit-executor.md` — TDD execution, checkpoint creation, confidence assessment
- `agents/shipit-reviewer.md` — Two-stage review (spec compliance + code quality), receipt verification
- `agents/shipit-verifier.md` — Epic-level verification, integration checking
- `agents/shipit-integration-checker.md` — Integration testing across tasks

**Command verification:**
- `commands/done.md` — Task completion verification and commit

**Learning & improvement:**
- `agents/shipit-conductor.md` — Analytics, trust scoring, learning loop
- `skills/peer-review/SKILL.md` — Pattern extraction from peer reviews

## Success Metrics

ShipIt tracks code health through:

1. **Test coverage:** All tasks have TDD:yes tests (measured in receipts)
2. **Review compliance:** Zero CRITICAL issues pass review
3. **Spec adherence:** Every task passes Stage 1 (spec compliance)
4. **Quality score:** No pattern violations from previous reviews (LESSONS.md)
5. **Trust score:** Persistent metric across all runs (analytics.json)

---

*Testing analysis: 2026-04-01*
