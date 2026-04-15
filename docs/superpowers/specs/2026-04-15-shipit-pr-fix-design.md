# ShipIt pr-fix — Design Spec

**Date:** 2026-04-15
**Status:** Approved for implementation planning
**Scope:** New command `/shipit:pr-fix` that consumes `shipit-review` marker state, filters machine-applicable findings, performs deep impact analysis, applies fixes atomically with per-fix test validation, auto-pushes, and auto-triggers a re-review.

**Depends on:**
- `shipit-review` engine and its output schema (PR #12, merged).
- `shipit-review` marker state on the MR (PR for the re-review feature, branch `shipit/rereview-delta` — must be merged first).

---

## 1. Problem

`shipit-review` produces structured findings with concrete `pass_snippet` fixes, but a human still applies each one by hand. For mechanical fixes (SQL injection → parameterized query; silent drop → log + counter + re-raise; missing authz → guard), this is repetitive and error-prone.

## 2. Goals

1. Auto-apply machine-fixable findings with minimum user friction.
2. Single batch approval, not per-fix confirms.
3. Deep impact analysis (callers, affected tests, blast-radius score) before each fix.
4. Per-fix test validation with automatic rollback on regression.
5. Atomic commits (one per finding) so the follow-up re-review can correlate fixes to findings via the existing `prior-findings-check`.
6. Auto-push + auto-rereview to close the loop without manual steps.

## 3. Non-goals

- Fixing findings from `pr-review-toolkit` (legacy engine — no structured pass snippets).
- Multi-MR batch fixing.
- Cross-repo fixes.
- Rewriting commit history.
- Resolving merge conflicts with concurrent author pushes beyond a single rebase attempt per fix.
- Fixing intent / test-coverage / scope / design findings (these go to `needs_human[]` and are listed but not auto-applied).

## 4. Command interface

Invocation:
```
/shipit:pr-fix <MR_URL>
```

If `<MR_URL>` is omitted, auto-detect from the current branch: `git config branch.<current>.remote` → look up the MR via GitLab MCP whose `source_branch == <current>`. Abort if zero or multiple matches.

### Phase 1 — Fix plan (batch approval)

Prints a summary like:
```
Found 5 auto-fixable findings in marker state (of 8 total — 3 need human design):

  CRITICAL  db.py:42       sql-injection-via-string-concat
            Impact: no callers affected | 0 tests cover this range
            Fix ready ✓

  CRITICAL  auth.py:108    missing-authz-on-mutating-route
            Impact: 3 callers (users.py, admin.py, billing.py) | 2 tests affected
            Fix ready ✓

  IMPORTANT scraper.ts:55  return-empty-on-error-silent-drop
            Impact: 76 call sites (all providers) | 4 tests affected
            Fix ready ⚠ (high blast radius)

  ...

Skipped (need human design):
  IMPORTANT  scope-creep-unrelated-refactor       (intent finding)
  IMPORTANT  missing-test-for-edge-case           (test finding)
  MINOR      comment-out-of-date                  (review judgment)

Apply all 5 fixes? [Apply all / Review details / Cancel]
```

User picks via `AskUserQuestion`:
- **Apply all** → proceed to Phase 2.
- **Review details** → per-fix expanded preview (diff of fail → pass, callers list, tests list), then returns to the three-option prompt.
- **Cancel** → remove the worktree; exit 0 with no changes.

### Phase 2 — Execution progress

Streams per-fix status:
```
Applying fixes...
  [1/5] sql-injection-via-string-concat at db.py:42
        ✓ fail_snippet matches current file
        ✓ 0 affected tests
        ✓ fix applied
        ✓ no test runner detected (skipping test run)
        ✓ committed: fix(review): sql-injection-via-string-concat at db.py:42
  [2/5] missing-authz-on-mutating-route at auth.py:108
        ✓ fail_snippet matches current file
        ✓ 2 affected tests
        ✓ fix applied
        ✓ running affected tests... PASS (2/2)
        ✓ committed: fix(review): missing-authz-on-mutating-route at auth.py:108
  [3/5] return-empty-on-error-silent-drop at scraper.ts:55
        ✓ fail_snippet matches current file
        ✓ 4 affected tests
        ✓ fix applied
        ✗ running affected tests... FAIL (1/4: test_provider_resilience)
        ↺ rolled back this fix
        ⚠ skipped — manual fix required
  ...
```

### Phase 3 — Push + re-review

```
Committed: 4/5 fixes
Skipped:   1/5 (test regression — see output above)

Pushing to origin/outage-2312...
Triggering /shipit:peer-review for verification...

[re-review runs, produces new marker state, posts updated summary comment]

## Peer Review Complete (re-review)
  New findings: 0
  Prior findings: 3 fixed / 1 still open (from failed fix) / 0 refactored
  Verdict: CHANGES REQUESTED (1 CRITICAL still open)
```

## 5. Architecture

### 5.1 New files

| File | Responsibility |
|---|---|
| `commands/pr-fix.md` | Entry point. Parses MR URL, orchestrates Phases 1–3. |
| `agents/shipit-fixer.md` | One invocation per fix. fail_snippet match → Edit apply → affected-test run → commit. Returns DONE / ROLLED_BACK / BLOCKED / PRE_SKIPPED. |
| `skills/shipit-pr-fix/SKILL.md` | Orchestration knowledge: filter marker findings, compute impact analysis, format the fix plan, drive Phase 2 loop, aggregate results. |

### 5.2 Modified files

| File | Nature |
|---|---|
| `.shipit/config.json` | Add `pr_fix` top-level block. |
| `commands/init.md` | Mirror `pr_fix` in the default config template. |
| `skills/shipit-core/SKILL.md` | Register `/shipit:pr-fix` in the commands table and `shipit-fixer` in the agents table. |

### 5.3 Integrations (no modification)

- Marker state on the MR (produced by `shipit-review` / `shipit-peer-reviewer` Step 7).
- `/shipit:peer-review` command (invoked from Phase 3 via `Skill(skill: "shipit:peer-review")` or equivalent).
- GitLab MCP for fetching MR metadata and comments.
- `git push` (via shell in the worktree) for publishing fix commits — not MCP.
- `git worktree` for isolation from the user's working directory.

## 6. Data flow (end-to-end, one run)

```
/shipit:pr-fix <MR_URL>
       |
       v
[1] Parse MR URL (or auto-detect). Extract project path + IID via GitLab MCP.
       |
       v
[2] Fetch marker state via GitLab MCP.
    Find `<!-- shipit-peer-review:state v1 {JSON} -->`.
    If absent → abort with "run /shipit:peer-review first."
    If schema != v1 → abort.
       |
       v
[3] Partition marker.findings where status == "open":
      auto_fixable[]  — has pass_snippet + pattern_key in {Security, Correctness, Performance, Error Handling} + non-placeholder
      needs_human[]   — otherwise
       |
       v
[4] Create worktree on MR source branch:
      WORKTREE_DIR=/tmp/shipit-pr-fix-<ts>
      git worktree add "$WORKTREE_DIR" <mr.source_branch>
      git pull origin <mr.source_branch>  (inside worktree)
       |
       v
[5] Per-fix impact analysis (see Section 7).
    For each finding in auto_fixable[]:
      - fail_snippet_match? (shape check, ±5 lines tolerance)
      - identifiers_modified = tokens in fail_snippet removed or in pass_snippet added
      - callers  = grep for identifiers in non-test files (excl. target file, lockfiles, vendored)
      - affected_tests = grep in test-file glob patterns, extract test names
      - blast_radius_score ∈ {LOW, MEDIUM, HIGH}
       |
       v
[6] Phase 1 — show plan; AskUserQuestion. On Cancel: worktree remove; exit.
       |
       v
[7] Phase 2 — ordered by severity (CRITICAL → IMPORTANT → MINOR).
    For each finding:
      spawn Agent(subagent_type: "shipit-fixer",
                  prompt: { worktree_dir, finding, impact_summary, test_runner })
      agent:
        a. Re-verify fail_snippet match in the file (paranoid).
        b. Apply fix via Edit tool (requires fail_snippet uniqueness).
        c. If test runner exists AND affected_tests > 0:
             Run affected_tests in worktree (5-minute timeout).
             On FAIL: git checkout -- <file>; return ROLLED_BACK.
        d. git add <file> && git commit -m "fix(review): <pattern_key> at <file>:<line_start>".
        e. Before next fix: git fetch + git rebase origin/<source_branch>;
             on rebase conflict: abort this fix as BLOCKED; continue with remaining.
      collect per-fix status.
       |
       v
[8] Phase 3:
    If any DONE and pr_fix.auto_push == true:
      cd "$WORKTREE_DIR" && git push origin <mr.source_branch>
      If push fails → leave commits local; skip re-review; report.
    If push succeeded and pr_fix.auto_rereview_after_fix == true:
      Spawn shipit-peer-reviewer agent directly via Task tool, with:
        MR URL, Jira ticket info (recoverable from marker state or MR metadata),
        Review Mode = pr_fix.rereview_mode (default "balanced"),
        source/target branches.
      Skip the /shipit:peer-review command's Jira/GitLab selection phase and
      mode prompt — we already have all inputs.
    git worktree remove "$WORKTREE_DIR" --force.
    Print final summary (DONE / ROLLED_BACK / BLOCKED / PRE_SKIPPED counts + re-review link).
```

## 7. Impact analysis specification

Per-fix, the orchestration skill computes this JSON shown in the plan:

```json
{
  "fingerprint": "<sha1 from marker>",
  "pattern_key": "missing-authz-on-mutating-route",
  "file": "auth.py",
  "line_start": 108,
  "line_end": 120,
  "fail_snippet_match": true,
  "identifiers_modified": ["delete_user", "requireAuth"],
  "callers": [
    {"file": "users.py", "line": 44, "symbol": "delete_user"},
    {"file": "admin.py", "line": 89, "symbol": "delete_user"},
    {"file": "billing.py", "line": 12, "symbol": "delete_user"}
  ],
  "affected_tests": [
    {"file": "tests/test_auth.py", "line": 102, "test_name": "test_delete_user_requires_auth"},
    {"file": "tests/test_users.py", "line": 210, "test_name": "test_user_deletion_flow"}
  ],
  "blast_radius_score": "HIGH",
  "blast_radius_reason": "3 callers in other modules; 2 tests affected"
}
```

### 7.1 Field computation

| Field | Method |
|---|---|
| `fail_snippet_match` | Read file at `line_start±5..line_end±5`. At least one non-keyword identifier (length ≥ 3) from `fail_snippet` present in range AND range not entirely commented out. |
| `identifiers_modified` | Non-keyword tokens (length ≥ 3) in `fail_snippet` but NOT in `pass_snippet` (removed), plus tokens in `pass_snippet` but NOT in `fail_snippet` (added). Intersect with the file's defined symbols (via `grep -E 'def \|function \|class \|const \|let \|func '`). |
| `callers` | For each identifier, `Grep` project root. Exclude: target file, test files (→ `affected_tests`), lockfiles, vendored dirs, generated files. Cap at 20; flag `truncated`. |
| `affected_tests` | For each identifier, `Grep` in test-file glob patterns (`**/test_*.py`, `**/*.test.{ts,tsx,js,jsx}`, `**/*_test.go`, `**/spec/**/*`, `**/tests/**/*`). Extract enclosing test name via regex for the detected runner's convention. |
| `blast_radius_score` | HIGH: callers > 5 OR tests > 3 OR modules_touched > 1. MEDIUM: callers > 0 OR tests > 0. LOW: no external references. |

### 7.2 Test runner auto-detection

On worktree creation, detect in this order:

| Signal | Runner | Command pattern |
|---|---|---|
| `package.json` with `"test"` script | npm/yarn/pnpm (Jest/Vitest) | `npm test -- --testNamePattern='<names>'` or `vitest run -t '<names>'` |
| `pyproject.toml` with `[tool.pytest]` or `pytest.ini` | pytest | `pytest <file>::<name> -v` |
| `go.mod` | go test | `go test -run '<Name>' ./...` |
| `Cargo.toml` | cargo test | `cargo test <name>` |
| `build.gradle` or `pom.xml` | gradle/maven | `./gradlew test --tests '<names>'` |
| None detected | — | Skip test step; note in summary. |

If detection fires but command fails (missing deps) → treat as "no test runner" + warn in summary. Do not abort the fix flow.

## 8. Error handling & edge cases

| Case | Behavior |
|---|---|
| No marker comment | Abort. "No review found on this MR. Run `/shipit:peer-review` first." |
| Marker schema != v1 | Abort. "Marker schema `vN` not supported by this ShipIt version." |
| Marker engine was `pr-review-toolkit` | Abort. "Legacy review output lacks fix snippets. Re-review with `peer_review.engine: \"shipit-review\"`." |
| All findings filtered to needs_human[] | Exit cleanly with list. Not an error. |
| MR merged or closed | Abort. Fixing commits on a merged MR lands them on a dead branch. |
| MR is draft | Proceed. Drafts are typical targets. |
| User's working dir has uncommitted changes | Preserved — worktree lives in `/tmp/`, not touched. |
| Source branch can't be checked out in worktree | Abort. Return the git error. |
| Concurrent author push mid-run | Between fixes: `git fetch` + `git rebase origin/<source>`. On conflict → fix BLOCKED; continue. On final push: if rebase conflicts, abort push + leave commits local + flag. |
| Test runner hangs | 5-minute timeout per affected-test run. Treat as ROLLED_BACK. |
| Push fails (permission, hook rejection) | Commits stay local. Report. No re-review. |
| Auto-rereview fails | Report; commits + push already succeeded; user can re-run `/shipit:peer-review` manually. |
| Pre-commit hook blocks the commit | `git reset HEAD` + `git checkout -- <file>`; mark BLOCKED. Do NOT use `--no-verify`. |
| `fail_snippet` non-unique in file | Edit tool requires uniqueness. Mark BLOCKED with "ambiguous fail_snippet". |
| `pass_snippet` has placeholders (`<allowlist>`, `<TODO>`) | Detect `<...>` tokens; route to `needs_human[]` in Step 3; don't attempt apply. |
| Fingerprint already in a prior pr-fix commit (re-run on same MR) | Scan last 20 commits for `fix(review): <pattern_key>` matching. Skip with "already fixed in `<sha>`". |
| Worktree cleanup fails | Force-remove with `--force`; log warning. |

## 9. Configuration

Add a new top-level block (not inside `peer_review`):

```json
{
  ...
  "peer_review": { ... },
  "pr_fix": {
    "enabled": true,
    "auto_push": true,
    "auto_rereview_after_fix": true,
    "test_runner": "auto",
    "max_fixes_per_run": 20,
    "severity_filter": ["CRITICAL", "IMPORTANT", "MINOR"],
    "blast_radius_warn": "HIGH",
    "rereview_mode": "balanced"
  }
}
```

| Field | Purpose |
|---|---|
| `enabled` | Hard gate. `false` → command aborts with "pr-fix disabled in config." |
| `auto_push` | `false` → fixes commit locally; user pushes manually. |
| `auto_rereview_after_fix` | `false` → no Phase 3 re-review trigger. |
| `test_runner` | `"auto"` (detect), `"skip"` (force off), `"require"` (abort if none detected). |
| `max_fixes_per_run` | Cap on findings per run. Default 20. If plan has more, abort with "too many fixes; narrow `severity_filter`." |
| `severity_filter` | Limit findings to these severities. Default includes all. |
| `blast_radius_warn` | Findings at or above this score get a `⚠` in the plan. UX only. |
| `rereview_mode` | Which mode (efficiency / balanced / depth) to use for the auto-triggered Phase 3 re-review. Default `balanced`. |

Mirror in `commands/init.md`'s default template.

## 10. Rollout

1. Implement all tasks on branch `shipit/pr-fix` (stacked on `shipit/rereview-delta`).
2. Structural verification.
3. Merge with `pr_fix.enabled: true` default. But `peer_review.engine` still defaults to `pr-review-toolkit`, so pr-fix is only reachable when a user has opted into the new engine.
4. Once the main engine default flips (separate future plan), pr-fix is active for everyone.
5. Cleanup plan later: remove the `enabled` flag after two releases of stable use.

## 11. Testing plan

### Structural (doc-only plugin)

- Config fields parse as JSON.
- `commands/pr-fix.md` has valid frontmatter (`name`, `description`, `allowed-tools`) + `<objective>` + `<process>` + success criteria.
- `agents/shipit-fixer.md` has frontmatter + `<role>` + `<input>` + `<process>` + `<output_format>` + `<error_handling>` + `<success_criteria>`.
- `skills/shipit-pr-fix/SKILL.md` has frontmatter + Purpose + Prerequisites + Process + Output.
- `shipit-core` registers `/shipit:pr-fix` in the commands table and `shipit-fixer` in the agents table.
- All cross-references resolve (command → skill → agent).

### Behavioral (manual, on real MRs)

| # | Case | Setup | Expected |
|---|---|---|---|
| F1 | Happy path | 3 CRITICAL security findings with clear pass_snippets; Python project with pytest | Plan shows 3 + impact summaries; batch approve; 3 commits; affected tests pass per fix; push; re-review marks 3 fixed; verdict APPROVE. |
| F2 | Mixed fixable/unfixable | 3 auto-fixable + 2 intent/design | Plan shows 3 fixable + 2 needs-human separately; 3 commits; re-review marks 3 fixed + 2 still open. |
| F3 | Test regression | Fix to security check breaks a test asserting insecure behavior | That fix rolls back; no commit; others succeed; summary reports 1 skipped with test name. |
| F4 | Code drift | MR reviewed last week; author edited a flagged line unrelated to the finding | fail_snippet_match false → PRE_SKIPPED; others apply; summary flags drift. |
| F5 | No test runner | Node project without `"test"` script | Skip test step; all fixes commit; re-review runs; summary notes no runner detected. |
| F6 | High blast radius | Fix touches helper used by many callers | Plan shows `HIGH ⚠`; user sees before approving; affected-tests run; rollback on regression. |
| F7 | No marker | MR reviewed with `pr-review-toolkit` (legacy) | Abort with clear message. |
| F8 | Re-run idempotency | Re-run pr-fix on an MR where fixes already applied | Scan recent commits for `fix(review): <pattern_key>` matches → skip with "already fixed in `<sha>`"; no new commits. |

### Rollback verification

- `pr_fix.enabled: false` → abort with clear message; no worktree.
- `auto_push: false` → commits happen; no push; no re-review.
- `auto_rereview_after_fix: false` → commits + push; no re-review.

## 12. Open questions (resolved in conversation)

| Question | Resolution |
|---|---|
| Source of findings? | Marker state only (A). Requires prior `shipit-review` run. |
| Which findings to fix? | Machine-applicable only (C) — has `pass_snippet` + mechanical `pattern_key` category + no placeholders. |
| Impact analysis depth? | Deep (C) — callers + affected tests + blast radius. No forced test execution; handled separately. |
| Human-in-the-loop level? | Batch approval (B) — one decision point at Phase 1. |
| Tests after fix? | Auto-detect runner; if present, run affected tests per fix (E + C); rollback the one fix on failure. |
| Post-fix flow? | Atomic commits + auto-push + auto-rereview (A). |

## 13. Assumptions

- `git worktree` is available on all systems ShipIt runs on (same assumption as Step 6.5 pattern commits — already proven).
- GitLab MCP supports: list MR comments, get MR metadata, push (via git directly), trigger a chain re-review through the existing `/shipit:peer-review` flow.
- The reviewed project's repo is accessible at `project_path` for the worktree source.
- The `Edit` tool's uniqueness requirement (fail_snippet must match exactly once in the target file) catches ambiguous-fix cases; no custom disambiguation logic needed.
- Test runner detection via file presence is sufficient for v1. Projects with non-standard runners (Bazel, Nix) get "no runner detected" and skip tests.
- Pre-commit hooks, if present, are correctly enforced (we do not `--no-verify`).
- `shipit-fixer` runs cheaply enough (one Edit + one test run + one commit) that no model-selection logic is needed — use `sonnet` by default.
