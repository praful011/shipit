# ShipIt pr-fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/shipit:pr-fix` — a new command that consumes the `shipit-review` marker state, filters for machine-applicable findings, performs deep impact analysis, applies fixes atomically with per-fix test validation, auto-pushes, and auto-triggers a re-review.

**Architecture:** Three new files: command (entry point, 3-phase UX), orchestration skill (filter + impact analysis + plan formatting + Phase-2 loop), per-fix agent (fail_snippet match → Edit → affected-tests → commit). Plus config additions and shipit-core registration. Gated by `pr_fix.enabled` (default `true`) and implicitly by `peer_review.engine == "shipit-review"` (which is the only engine that produces the marker state pr-fix requires).

**Tech Stack:** Markdown + YAML frontmatter (doc-only plugin). Verification is structural — `grep`, `Read`, valid JSON checks.

**Spec:** `docs/superpowers/specs/2026-04-15-shipit-pr-fix-design.md`

---

## Conventions for this plan

- "Red / green" steps are structural `grep`/`Read`/JSON-parse checks, not code tests.
- Every task ends with an atomic commit scoped to its files.
- Tasks 2–4 each create one new file; they're independent (no shared file) and each is a standalone implementation. Task 5 modifies `skills/shipit-core/SKILL.md` once to register everything.
- Branch is `shipit/pr-fix`, stacked on `shipit/rereview-delta`. The re-review PR must merge before this one.

---

### Task 1: Add `pr_fix` config block

**Files:**
- Modify: `.shipit/config.json`
- Modify: `commands/init.md`

- [ ] **Step 1: Confirm absent (red)**

Run:
```bash
grep -c 'pr_fix' .shipit/config.json commands/init.md
```
Expected: both `0`.

- [ ] **Step 2: Add `pr_fix` block to `.shipit/config.json`**

Read current file, then add a new top-level `pr_fix` object AFTER the existing `peer_review` block. Full file after edit:

```json
{
  "model_profile": "balanced",
  "autonomy_mode": "autonomous",
  "adaptive_models": false,
  "tdd": false,
  "auto_commit": true,
  "peer_review": {
    "engine": "pr-review-toolkit",
    "default_mode": "balanced",
    "ask_mode_each_run": true,
    "rereview_enabled": true,
    "escalation_thresholds": {
      "CRITICAL": 3,
      "IMPORTANT": 5,
      "MINOR": null
    }
  },
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

- [ ] **Step 3: Add `pr_fix` to `commands/init.md` Step 9 template**

Find the Step 9 JSON template (search for `"peer_review"` in `commands/init.md`). The current end of the template block should have:
```json
    "peer_review": {
      "engine": "pr-review-toolkit",
      "default_mode": "balanced",
      "ask_mode_each_run": true,
      "rereview_enabled": true,
      "escalation_thresholds": {
        "CRITICAL": 3,
        "IMPORTANT": 5,
        "MINOR": null
      }
    }
```

Replace the closing `}` that follows `peer_review` so the outer object continues with a new `pr_fix` block:

```json
    "peer_review": {
      "engine": "pr-review-toolkit",
      "default_mode": "balanced",
      "ask_mode_each_run": true,
      "rereview_enabled": true,
      "escalation_thresholds": {
        "CRITICAL": 3,
        "IMPORTANT": 5,
        "MINOR": null
      }
    },
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

- [ ] **Step 4: Verify (green)**

Run:
```bash
python3 -c "
import json
c = json.load(open('.shipit/config.json'))
pf = c['pr_fix']
assert pf['enabled'] is True
assert pf['auto_push'] is True
assert pf['auto_rereview_after_fix'] is True
assert pf['test_runner'] == 'auto'
assert pf['max_fixes_per_run'] == 20
assert pf['severity_filter'] == ['CRITICAL', 'IMPORTANT', 'MINOR']
assert pf['blast_radius_warn'] == 'HIGH'
assert pf['rereview_mode'] == 'balanced'
print('ok: .shipit/config.json valid')
"
grep -c 'pr_fix' commands/init.md        # expect ≥ 1
grep -c '"rereview_mode"' commands/init.md   # expect ≥ 1
```

- [ ] **Step 5: Self-review**

`git diff --cached`. Confirm:
- `.shipit/config.json` — only `pr_fix` block added; existing keys untouched; JSON is valid.
- `commands/init.md` — only the Step 9 JSON template block changed; no other edits.

- [ ] **Step 6: Commit**

```bash
git add .shipit/config.json commands/init.md
git commit -m "feat(pr-fix): add pr_fix config block"
```

---

### Task 2: Create `shipit-fixer` agent

**Files:**
- Create: `agents/shipit-fixer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e agents/shipit-fixer.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the agent file**

Write `agents/shipit-fixer.md` with this EXACT content:

````markdown
---
name: shipit-fixer
description: |
  Applies one review finding's fix. Called by the shipit-pr-fix command inside its worktree. Verifies fail_snippet still matches current file, applies the pass_snippet via Edit tool, runs affected tests (when a test runner is detected), and commits atomically. Returns DONE / ROLLED_BACK / BLOCKED / PRE_SKIPPED.
---

<role>
You are the ShipIt fixer agent — one invocation applies ONE review finding. You are spawned by the `shipit-pr-fix` orchestration skill, one call per auto-fixable finding, in a pre-prepared git worktree that's already checked out on the MR's source branch.

**Your scope is narrow:** match → apply → test → commit. You do NOT make design decisions, do NOT re-interpret the finding, do NOT invent fixes beyond the supplied pass_snippet.

**CRITICAL: Mandatory Initial Read**
If the prompt contains a `<files_to_read>` block, Read every file listed there before any other action.
</role>

<input>
You receive a JSON bundle with:

- `worktree_dir` — absolute path to the git worktree (already checked out on MR source branch).
- `finding` — one finding from the marker state:
  ```json
  {
    "fingerprint": "...",
    "pattern_key": "sql-injection-via-string-concat",
    "severity": "CRITICAL",
    "file": "db.py",
    "line_start": 42,
    "line_end": 46,
    "fail_snippet": "...",
    "pass_snippet": "...",
    "description": "...",
    "prevention": "..."
  }
  ```
- `impact_summary` — pre-computed analysis from the orchestration skill:
  ```json
  {
    "fail_snippet_match": true,
    "identifiers_modified": ["delete_user", "requireAuth"],
    "callers": [{"file": "...", "line": 44, "symbol": "..."}],
    "affected_tests": [{"file": "...", "line": 102, "test_name": "..."}],
    "blast_radius_score": "HIGH | MEDIUM | LOW",
    "blast_radius_reason": "..."
  }
  ```
- `test_runner` — detected runner info:
  ```json
  {
    "kind": "pytest | jest | vitest | go | cargo | gradle | maven | none",
    "command_template": "<string with {file} {test_name} placeholders>"
  }
  ```

All paths in `finding.file` and `impact_summary.callers[].file` are relative to `worktree_dir`.
</input>

<process>

## Step 1: Re-verify `fail_snippet` still matches

The orchestration skill already checked this in the impact analysis, but the file may have been edited between plan and execution (prior fix in this same batch could have affected adjacent lines).

Use the `Read` tool to load `{worktree_dir}/{finding.file}` at `line_start - 5` .. `line_end + 5`.

Apply the same shape-check heuristic the orchestration skill used:
- Extract non-keyword tokens (length ≥ 3) from `fail_snippet`, excluding common English words.
- Confirm at least one token appears in the read range.
- Confirm the range isn't entirely commented out.

If the check fails → **return PRE_SKIPPED** with reason `"code drifted between plan and execution"`. Do not attempt any edits.

## Step 2: Apply the fix via Edit tool

Call the `Edit` tool with:
- `file_path` = `{worktree_dir}/{finding.file}`
- `old_string` = `finding.fail_snippet` (verbatim)
- `new_string` = `finding.pass_snippet` (verbatim)
- `replace_all` = false

**If the `Edit` call fails with a uniqueness error** (`fail_snippet` appears multiple times, or not at all) → **return BLOCKED** with reason `"ambiguous fail_snippet — N matches in file"` (or `"fail_snippet not found in file"`).

**If the `Edit` call succeeds:** proceed.

## Step 3: Run affected tests (when runner detected)

If `test_runner.kind == "none"` OR `impact_summary.affected_tests` is empty:
- Skip this step. Note in output: `test_step: "skipped — no runner detected"` or `"skipped — no affected tests"`.

Otherwise, for each test in `impact_summary.affected_tests`:
1. Substitute `{file}` and `{test_name}` into `test_runner.command_template`.
2. Run the command in `worktree_dir` via `Bash` with timeout 300 seconds (5 minutes).
3. Record stdout tail + exit code.

**If ALL affected tests exit 0:** tests passed. Proceed to Step 4.

**If ANY affected test fails (non-zero exit OR timeout):**
1. Roll back the fix:
   ```bash
   cd {worktree_dir} && git checkout -- {finding.file}
   ```
2. **Return ROLLED_BACK** with:
   - `failed_test` = the first failing test's `{file}::{test_name}`
   - `stdout_tail` = last 50 lines of the failing test's output
   - Note that no commit was made.

## Step 4: Commit atomically

In `worktree_dir`:

```bash
cd {worktree_dir}
git add {finding.file}
# Verify only the intended file is staged
STAGED=$(git diff --cached --name-only)
if [ "$STAGED" != "{finding.file}" ]; then
  git reset HEAD
  # return BLOCKED with reason "unexpected files staged"
fi
git commit -m "fix(review): {finding.pattern_key} at {finding.file}:{finding.line_start}"
```

If the commit fails (pre-commit hook rejects it, for example):
1. `git reset HEAD` + `git checkout -- {finding.file}` to discard everything.
2. **Return BLOCKED** with reason `"commit rejected by hook: <hook message>"`.
3. Do NOT retry with `--no-verify`.

If the commit succeeds: capture the commit SHA via `git rev-parse HEAD`.

## Step 5: Rebase on latest remote (concurrent push protection)

Before returning DONE, the caller (orchestration skill) may dispatch another fixer for the next finding. Each fixer needs to leave the worktree in a state where the next fix starts from a clean tip matching origin.

Do NOT rebase yourself — the orchestration skill handles inter-fix rebasing. Just return DONE.

</process>

<output_format>

You MUST return exactly this JSON shape:

```json
{
  "specialist": "shipit-fixer",
  "fingerprint": "<from input>",
  "status": "DONE | ROLLED_BACK | BLOCKED | PRE_SKIPPED",
  "commit_sha": "<on DONE only>",
  "test_step": "passed: N/N | skipped: <reason> | failed: <test> (rolled back)",
  "reason": "<only for ROLLED_BACK / BLOCKED / PRE_SKIPPED>",
  "details": {
    "failed_test": "<file>::<test_name> (ROLLED_BACK only)",
    "stdout_tail": "<last 50 lines of failing test, ROLLED_BACK only>"
  }
}
```

No prose outside the JSON.

</output_format>

<error_handling>

| Error | Status | Notes |
|---|---|---|
| fail_snippet no longer matches | PRE_SKIPPED | Step 1 gate. |
| Edit tool rejects (ambiguous or absent) | BLOCKED | reason = "ambiguous fail_snippet" or "fail_snippet not found" |
| Affected test fails or times out | ROLLED_BACK | git checkout -- file; include failing test name + stdout tail |
| Commit rejected by pre-commit hook | BLOCKED | Do NOT --no-verify. Clean up staged files. |
| Bash timeout on test run (> 300s) | ROLLED_BACK | Treat as test failure; rollback. |
| Worktree missing (unexpected) | BLOCKED | reason = "worktree not found at `{worktree_dir}`"; no work attempted. |

</error_handling>

<success_criteria>
- [ ] fail_snippet match re-verified before any edits
- [ ] Edit tool used (not Write); only `finding.file` modified
- [ ] Affected tests run when runner detected; 5-minute timeout enforced
- [ ] On test failure: `git checkout --` rolled back the one file; no commit
- [ ] Commit message uses exact format `fix(review): <pattern_key> at <file>:<line_start>`
- [ ] Only `finding.file` staged (HARD GUARD — other staged files abort the commit)
- [ ] Output is a single valid JSON object matching the schema
- [ ] Never bypassed a pre-commit hook (--no-verify)
</success_criteria>
````

- [ ] **Step 3: Verify frontmatter and structure**

Run:
```bash
head -4 agents/shipit-fixer.md
grep -c '<role>\|</role>\|<input>\|</input>\|<process>\|</process>\|<output_format>\|</output_format>\|<error_handling>\|</error_handling>\|<success_criteria>\|</success_criteria>' agents/shipit-fixer.md
grep -cE 'DONE|ROLLED_BACK|BLOCKED|PRE_SKIPPED' agents/shipit-fixer.md   # expect ≥ 8 across sections
grep -c 'fail_snippet' agents/shipit-fixer.md                             # expect ≥ 5
grep -c '\-\-no-verify' agents/shipit-fixer.md                            # expect ≥ 2 (referenced as something we don't do)
```
Expected: frontmatter starts with `---` / `name: shipit-fixer` / `description:`; XML-tag count ≥ 12 (open + close for each of 6 sections).

- [ ] **Step 4: Self-review**

`git diff --cached`. Check:
- `name` field matches filename (shipit-fixer).
- Output JSON schema has exactly four status values.
- Step 3 (run tests) skip conditions are explicit.
- Step 4 has the "only target file staged" HARD GUARD (same pattern as shipit-peer-reviewer Step 6.5.7).

- [ ] **Step 5: Commit**

```bash
git add agents/shipit-fixer.md
git commit -m "feat(pr-fix): add shipit-fixer per-finding agent"
```

---

### Task 3: Create `shipit-pr-fix` orchestration skill

**Files:**
- Create: `skills/shipit-pr-fix/SKILL.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e skills/shipit-pr-fix/SKILL.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the orchestration skill**

Write `skills/shipit-pr-fix/SKILL.md` with this EXACT content:

````markdown
---
name: shipit-pr-fix
description: Orchestrates /shipit:pr-fix — consumes the shipit-review marker state, filters machine-applicable findings, performs deep impact analysis, presents a batch-approval fix plan, dispatches shipit-fixer agents per fix, aggregates results, pushes, and triggers a re-review.
---

# ShipIt pr-fix Orchestration

## Purpose

The command `/shipit:pr-fix` loads this skill. The skill describes every phase of the fix flow end-to-end: marker fetch, finding partition, impact analysis, plan presentation, Phase-2 loop via `shipit-fixer`, push, and auto-rereview.

## Prerequisites

| Dependency | Required | Notes |
|---|---|---|
| GitLab MCP | Yes | For fetching MR metadata + marker comment |
| Marker comment on MR (schema v1) | Yes | Produced by a prior `shipit-review` run |
| `shipit-fixer` agent | Yes | `agents/shipit-fixer.md` |
| `shipit-peer-reviewer` agent | Yes — for Phase 3 auto-rereview | Existing |
| `git worktree` | Yes | For isolation from user's working directory |

## Configuration

Read from `.shipit/config.json`:
- `pr_fix.enabled` — hard gate; abort if false.
- `pr_fix.auto_push` — controls Phase 3 push.
- `pr_fix.auto_rereview_after_fix` — controls Phase 3 re-review trigger.
- `pr_fix.test_runner` — `"auto"` / `"skip"` / `"require"`.
- `pr_fix.max_fixes_per_run` — cap on plan size.
- `pr_fix.severity_filter` — array of severities to include.
- `pr_fix.blast_radius_warn` — UI marker threshold.
- `pr_fix.rereview_mode` — mode to pass to Phase 3's shipit-peer-reviewer.

## Input

The calling command passes:
- `MR_URL` — the merge request URL (or auto-detected from current branch).

Everything else (marker state, worktree, per-fix impact) is computed by this skill.

## Process

### Phase 0 — Config gate

Read `pr_fix.enabled`. If `false`:
- Print: `"pr-fix is disabled in .shipit/config.json. Set pr_fix.enabled: true to use this command."`
- Exit cleanly (no error).

### Phase 1 — Build fix plan

#### 1.1 Parse MR URL (or auto-detect)

If `MR_URL` is supplied, parse `<project_path>` and `<mr_iid>` from it.

If omitted:
- Determine current branch: `git rev-parse --abbrev-ref HEAD`.
- Via GitLab MCP `list_merge_requests`, find MRs where `source_branch` matches and state is `opened`.
- If 0 matches → abort: `"No open MR found for current branch. Specify MR URL explicitly."`.
- If >1 matches → abort: `"Multiple MRs found for this branch; specify URL."`.
- If 1 match → use it.

#### 1.2 Fetch MR metadata + state

Via GitLab MCP `get_merge_request_details`:
- MR title, description, source_branch, target_branch, author, state.

If `state` is `merged` or `closed` → abort: `"Cannot fix a {merged|closed} MR; fixes would land on a dead branch."`.

#### 1.3 Fetch marker state

Via GitLab MCP, list top-level MR comments. Scan for a comment whose body starts with `<!-- shipit-peer-review:state v1`.

- Not found → abort: `"No review marker found on this MR. Run /shipit:peer-review first (with peer_review.engine = shipit-review)."`.
- Found but schema != `v1` → abort with the schema version: `"Marker schema vN not supported."`.
- Found and parsed: proceed.

#### 1.4 Partition findings

From `marker.findings[]` where `status == "open"`:

```
auto_fixable = []
needs_human = []
for f in findings:
  if !f.pass_snippet or f.pass_snippet.strip() == "":
    needs_human.append(f, reason="no pass_snippet")
    continue
  if f.category not in {"Security", "Correctness", "Performance", "Error Handling"}:
    needs_human.append(f, reason=f"category '{f.category}' requires human design")
    continue
  if contains_placeholder_tokens(f.pass_snippet):    # matches /<[A-Za-z_][A-Za-z0-9_-]*>/
    needs_human.append(f, reason="pass_snippet contains placeholder tokens")
    continue
  if f.severity not in config.pr_fix.severity_filter:
    continue   # silently excluded, neither fixed nor surfaced to user
  auto_fixable.append(f)
```

If `len(auto_fixable) == 0` AND `len(needs_human) == 0`:
- Print: `"No open findings to fix. MR already looks clean."`. Exit cleanly.

If `len(auto_fixable) == 0` AND `len(needs_human) > 0`:
- Print `"No auto-fixable findings."` + list of `needs_human` with reasons. Exit cleanly.

If `len(auto_fixable) > config.pr_fix.max_fixes_per_run`:
- Abort: `"Plan has {N} fixes; limit is {max}. Narrow pr_fix.severity_filter or raise max_fixes_per_run."`.

#### 1.5 Create worktree + detect test runner

```bash
WORKTREE_DIR="/tmp/shipit-pr-fix-$(date +%s)-$$"
git worktree add "$WORKTREE_DIR" <mr.source_branch>
cd "$WORKTREE_DIR"
git pull origin <mr.source_branch>
```

On failure (permissions, branch deleted on remote): abort with the git error; no worktree to clean up.

Detect test runner by file presence, in this priority order:

| Signal present | `test_runner.kind` | `command_template` |
|---|---|---|
| `package.json` with `"test"` in scripts AND `vitest` in dependencies | vitest | `vitest run {file} -t '{test_name}'` |
| `package.json` with `"test"` in scripts (default: Jest) | jest | `npm test -- --testNamePattern='{test_name}' --testPathPattern='{file}'` |
| `pyproject.toml` with `[tool.pytest]` or `pytest.ini` present | pytest | `pytest '{file}::{test_name}' -v` |
| `go.mod` present | go | `go test -run '{test_name}' ./{file_dir}/...` |
| `Cargo.toml` present | cargo | `cargo test {test_name}` |
| `build.gradle` or `pom.xml` present | gradle (or maven) | `./gradlew test --tests '{test_name}'` (or `mvn test -Dtest='{test_name}'`) |
| None | none | `""` |

If `pr_fix.test_runner == "skip"` → force kind to `none` regardless of detection.

If `pr_fix.test_runner == "require"` AND detected kind is `none` → abort: `"pr_fix.test_runner is 'require' but no runner detected. Add a test runner or set to 'auto'."` (Remove worktree before aborting.)

#### 1.6 Per-fix impact analysis

For each finding in `auto_fixable`, compute:

1. **`fail_snippet_match`** — Read `{worktree_dir}/{finding.file}` at `line_start-5..line_end+5`. Check:
   - Non-keyword tokens (length ≥ 3) in `fail_snippet` — at least one appears in read range.
   - Range not entirely commented out.
   - Set `true` / `false`.

2. **`identifiers_modified`** — tokens present in `fail_snippet` but not `pass_snippet` (removed), plus tokens in `pass_snippet` not in `fail_snippet` (added). Filter to length ≥ 3 and non-keyword. Intersect with file's defined symbols via:
   ```bash
   grep -oE '(def |function |class |const |let |func |fn )[A-Za-z_][A-Za-z0-9_]*' {worktree_dir}/{finding.file}
   ```

3. **`callers`** — for each identifier, grep for references outside the target file:
   ```
   Grep(pattern: "\b<identifier>\b",
        path: "{worktree_dir}",
        output_mode: "content",
        glob: "!{finding.file}",    # conceptually; exclude target file
        head_limit: 25)
   ```
   Exclude: test files (go to `affected_tests`), lockfiles (`*.lock`, `package-lock.json`, etc.), vendored dirs (`node_modules/`, `vendor/`, `dist/`, `build/`). Cap at 20 entries; flag `truncated: true` beyond.

4. **`affected_tests`** — for each identifier, grep with test-file glob patterns:
   ```
   Grep(pattern: "\b<identifier>\b",
        path: "{worktree_dir}",
        glob: "**/test_*.py,**/*.test.{ts,tsx,js,jsx},**/*_test.go,**/spec/**/*,**/tests/**/*",
        output_mode: "content",
        -n: true,
        head_limit: 20)
   ```
   For each hit, extract the enclosing test name by scanning upward for the runner's test-declaration pattern:
   - pytest: nearest `def test_*(` above
   - jest/vitest: nearest `test(`, `it(`, `describe(` above
   - go: nearest `func Test*(` above

5. **`blast_radius_score`**:
   - `HIGH`: `callers > 5` OR `affected_tests > 3` OR modules touched > 1 (compare directory components)
   - `MEDIUM`: `callers > 0` OR `affected_tests > 0`
   - `LOW`: otherwise

6. If `fail_snippet_match == false`: demote this finding from `auto_fixable` to a new category `pre_skipped[]` with reason `"fail_snippet no longer matches current file"`. Do not run fixer on it.

#### 1.7 Present fix plan — batch approval

Format:
```
Found N auto-fixable findings in marker state (of M total — K need human design, P skipped: code drifted):

  <SEVERITY>  <file>:<line>   <pattern_key>
              Impact: <callers_summary> | <tests_summary>
              Fix ready ✓ (or ⚠ if blast_radius_score >= config.pr_fix.blast_radius_warn)

  [repeat per fix in CRITICAL → IMPORTANT → MINOR order]

Skipped (need human design):
  <severity>  <pattern_key>  (<reason>)
  [...]

Pre-skipped (code drift):
  <severity>  <pattern_key>  (<reason>)
  [...]

Apply all N fixes?
```

Use `AskUserQuestion`:
- Option "Apply all N fixes" → proceed to Phase 2.
- Option "Review details" → for each fix, print: file path, line range, diff preview (fail_snippet → pass_snippet), full callers list, full affected_tests list. Then re-present the top-level question.
- Option "Cancel" → remove worktree; exit cleanly.

### Phase 2 — Execute fixes

For each finding in `auto_fixable` (sorted CRITICAL → IMPORTANT → MINOR):

#### 2.1 Spawn shipit-fixer

```
Agent(subagent_type: "shipit-fixer", prompt: {
  worktree_dir: WORKTREE_DIR,
  finding: <finding>,
  impact_summary: <per-fix analysis from 1.6>,
  test_runner: <detected from 1.5>
})
```

Parse the returned JSON. Collect into `results[]`.

#### 2.2 Stream progress per fix

As each fixer returns, print:
```
  [<i>/<N>] <pattern_key> at <file>:<line>
        <success or failure icon> <test_step message>
        <success or failure icon> <commit message or rollback notice>
```

#### 2.3 Rebase on latest remote between fixes

Between each fixer call (except the last):
```bash
cd "$WORKTREE_DIR"
git fetch origin <mr.source_branch>
git rebase origin/<mr.source_branch>
```

If rebase conflicts → convert the NEXT fixer call's result to BLOCKED with reason `"rebase conflict on concurrent author push"`. Continue to the fixer after that.

### Phase 3 — Push + auto-rereview

#### 3.1 Aggregate results

Count: `done`, `rolled_back`, `blocked`, `pre_skipped`.

If `done == 0`:
- Remove worktree.
- Print summary. Exit. No push, no re-review (nothing to push/review).

#### 3.2 Push (if configured)

If `pr_fix.auto_push == false`:
- Print: `"Auto-push disabled. Commits left in worktree at {WORKTREE_DIR}. Run 'git push' manually."`.
- Skip re-review. Keep worktree. Exit.

Otherwise:
```bash
cd "$WORKTREE_DIR"
git push origin <mr.source_branch>
```

On push failure (permissions, hooks):
- Print error + note that `done` commits are local in the worktree.
- Skip re-review. Keep worktree so user can inspect.

On success: proceed to 3.3.

#### 3.3 Trigger re-review (if configured)

If `pr_fix.auto_rereview_after_fix == false`:
- Skip. Print: `"Auto-rereview disabled. Run /shipit:peer-review manually to verify fixes."`.

Otherwise, spawn the reviewer agent directly (bypassing the command's Jira/GitLab selection UI):

```
Agent(subagent_type: "shipit-peer-reviewer", prompt: {
  mr_url: <MR_URL>,
  jira_ticket_key: <from marker state or fetched from MR description>,
  mr_source_branch: <mr.source_branch>,
  mr_target_branch: <mr.target_branch>,
  gitlab_project_path: <parsed from MR_URL>,
  review_mode: config.pr_fix.rereview_mode
})
```

#### 3.4 Cleanup

```bash
cd /
git worktree remove "$WORKTREE_DIR" --force
```

#### 3.5 Final summary

```
## pr-fix Complete

- MR: <url>
- Fixes applied: <done>/<auto_fixable count>
- Rolled back (test regression): <rolled_back>
- Blocked: <blocked> (ambiguous fail_snippet, hook rejection, etc.)
- Pre-skipped (code drift): <pre_skipped>
- Needs human design: <needs_human count>
- Push: <success | failed | skipped>
- Re-review: <triggered — see <re-review URL or verdict> | skipped>

Next: <if failures present — address remaining findings manually; else — watch the auto-rereview verdict>
```

## Idempotency

Before adding a finding to `auto_fixable`, check the last 20 commits in the worktree for a message matching `^fix\(review\): <pattern_key> `. If found, exclude it with reason `"already fixed in commit <sha>"` (add to a separate `already_done[]` group for reporting).

## Error Handling

| Error | Response |
|---|---|
| `pr_fix.enabled: false` | Abort with config message. |
| No marker comment | Abort with "run /shipit:peer-review first". |
| Schema != v1 | Abort with schema version. |
| MR merged/closed | Abort. |
| Zero auto-fixable | Exit cleanly with needs_human list. |
| Plan exceeds max_fixes_per_run | Abort. |
| Worktree creation fails | Abort with git error. |
| test_runner: require and none detected | Abort with config message. |
| Rebase conflict mid-batch | That fix BLOCKED; continue. |
| Push fails | Leave commits + worktree; skip re-review; report. |
| Auto-rereview fails | Report; commits + push already succeeded. |

## Success Criteria

- [ ] Marker state fetched and schema validated
- [ ] Findings partitioned into auto_fixable / needs_human / pre_skipped
- [ ] Impact analysis computed per fix
- [ ] User saw the batch plan and approved
- [ ] Fixes executed in severity order via shipit-fixer
- [ ] Test runner detected and used when available
- [ ] Rebase between fixes prevents drift from concurrent pushes
- [ ] Push happened once at the end (when auto_push)
- [ ] Re-review triggered via direct shipit-peer-reviewer agent call (not /shipit:peer-review UI)
- [ ] Worktree cleaned up on exit (success and error paths)
- [ ] Summary printed with status counts
````

- [ ] **Step 3: Verify structure**

Run:
```bash
head -4 skills/shipit-pr-fix/SKILL.md
grep -c '^## Phase\|^### ' skills/shipit-pr-fix/SKILL.md          # expect ≥ 15
grep -c 'shipit-fixer\|shipit-peer-reviewer' skills/shipit-pr-fix/SKILL.md  # expect ≥ 4
grep -c 'auto_fixable\|needs_human\|pre_skipped\|already_done' skills/shipit-pr-fix/SKILL.md  # expect ≥ 6
grep -c 'test_runner\|fail_snippet_match\|blast_radius' skills/shipit-pr-fix/SKILL.md  # expect ≥ 6
grep -c 'pr_fix.enabled\|pr_fix.auto_push\|pr_fix.auto_rereview_after_fix' skills/shipit-pr-fix/SKILL.md  # expect ≥ 3
```

- [ ] **Step 4: Self-review**

`git diff --cached`. Confirm:
- Phase 0 config gate exists (aborts when disabled).
- Phase 1 has marker fetch + partition + worktree + test-runner-detect + impact analysis + plan presentation.
- Phase 2 has the inter-fix rebase step.
- Phase 3 has auto_push + auto_rereview gates.
- Idempotency section mentions the 20-commit scan.
- Error handling table has 11+ rows.

- [ ] **Step 5: Commit**

```bash
git add skills/shipit-pr-fix/SKILL.md
git commit -m "feat(pr-fix): add shipit-pr-fix orchestration skill"
```

---

### Task 4: Create `/shipit:pr-fix` command

**Files:**
- Create: `commands/pr-fix.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e commands/pr-fix.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the command file**

Write `commands/pr-fix.md` with this EXACT content:

````markdown
---
name: shipit:pr-fix
description: Apply auto-fixable review findings from a prior shipit-review run, with deep impact analysis, batch approval, per-fix test validation, auto-push, and auto-rereview.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - Skill
  - AskUserQuestion
---

<objective>
Automate the fix step that follows a `shipit-review` peer review: read the marker state, filter for machine-applicable findings, compute impact analysis, present a single batch-approval fix plan, execute fixes atomically (with per-fix test validation and rollback), push, and trigger a verifying re-review.
</objective>

<inputs>

Called as:
```
/shipit:pr-fix <MR_URL>
```

If `<MR_URL>` is omitted, auto-detect the MR from the current branch (see Step 1).

</inputs>

<process>

## Step 1: Load context

Read `./CLAUDE.md` if it exists (optional project conventions).

Read `.shipit/config.json`. If `pr_fix.enabled == false`, print `"pr-fix is disabled in .shipit/config.json. Set pr_fix.enabled: true to use this command."` and exit. All downstream steps are gated by this check.

## Step 2: Invoke the orchestration skill

The full fix workflow is defined in `skills/shipit-pr-fix/SKILL.md`. Load it:

```
Skill(skill: "shipit:shipit-pr-fix", args: {
  mr_url: "<MR_URL from invocation, or empty for auto-detect>"
})
```

The skill handles every phase:

| Phase | What |
|---|---|
| 0 | Config gate (aborts early if disabled) |
| 1 | Parse/detect MR, fetch marker, partition findings, build worktree, detect test runner, compute per-fix impact analysis, present batch-approval plan |
| 2 | Dispatch `shipit-fixer` per finding with inter-fix rebase |
| 3 | Push (if `pr_fix.auto_push`) + auto-rereview via `shipit-peer-reviewer` (if `pr_fix.auto_rereview_after_fix`) + worktree cleanup + final summary |

The command's job is minimal — orchestration lives in the skill. Do not re-implement phase logic here.

## Step 3: Pass result back to user

The skill prints its own phase-by-phase output and a final summary. The command completes when the skill returns.

If the skill aborted early (Phase 0 config gate, missing marker, merged MR, etc.), the skill's own message is sufficient. Do not add a redundant layer.

</process>

<error_handling>

All error handling lives in the orchestration skill. See `skills/shipit-pr-fix/SKILL.md` Error Handling table. This command is a thin entry point.

</error_handling>

<success_criteria>
- [ ] `pr_fix.enabled` config gate checked before any work
- [ ] `Skill` tool used to invoke `shipit:shipit-pr-fix` with the MR URL
- [ ] No phase logic duplicated between command and skill
</success_criteria>
````

- [ ] **Step 3: Verify (green)**

Run:
```bash
head -12 commands/pr-fix.md
grep -c '<objective>\|<inputs>\|<process>\|<error_handling>\|<success_criteria>' commands/pr-fix.md   # expect ≥ 5
grep -c 'shipit:shipit-pr-fix' commands/pr-fix.md                                                     # expect ≥ 1
grep -c 'pr_fix.enabled' commands/pr-fix.md                                                           # expect ≥ 1
grep -c 'allowed-tools:' commands/pr-fix.md                                                           # expect 1
```

- [ ] **Step 4: Self-review**

`git diff --cached`. Confirm:
- Frontmatter lists `allowed-tools` including Skill, Task, AskUserQuestion, and standard tools.
- Command file is thin — real work happens in the skill.
- No duplication with skill's Phase descriptions.

- [ ] **Step 5: Commit**

```bash
git add commands/pr-fix.md
git commit -m "feat(pr-fix): add /shipit:pr-fix command (thin wrapper)"
```

---

### Task 5: Register command + agent in `shipit-core`

**Files:**
- Modify: `skills/shipit-core/SKILL.md`

- [ ] **Step 1: Locate tables (red)**

Run:
```bash
grep -n '^| \*\*/shipit:\|^| \*\*shipit-' skills/shipit-core/SKILL.md | head -20
grep -c 'shipit:pr-fix\|shipit-fixer' skills/shipit-core/SKILL.md
```
Record the line numbers for the commands table and the agents table. Confirm the second line prints `0`.

- [ ] **Step 2: Add command row**

In the commands table in `skills/shipit-core/SKILL.md`, insert immediately after the `/shipit:peer-review` row:

```markdown
| `/shipit:pr-fix <MR_URL>` | Auto-fix review findings — consumes shipit-review marker state, filters machine-applicable findings, impact-analyzes each, batch-approves, commits per fix with affected-test validation, auto-pushes, auto-rereviews |
```

- [ ] **Step 3: Add agent row**

In the agents table, insert immediately after the last `shipit-*-reviewer` row (intent reviewer) OR after `shipit-peer-reviewer` (whichever is later in the current table ordering):

```markdown
| **shipit-fixer** | Applies ONE review finding — verifies fail_snippet, Edit applies pass_snippet, runs affected tests, commits atomically. Returns DONE / ROLLED_BACK / BLOCKED / PRE_SKIPPED. | sonnet |
```

- [ ] **Step 4: Verify (green)**

Run:
```bash
grep -c '/shipit:pr-fix' skills/shipit-core/SKILL.md    # expect ≥ 1
grep -c 'shipit-fixer' skills/shipit-core/SKILL.md      # expect ≥ 1
grep -c 'DONE / ROLLED_BACK / BLOCKED / PRE_SKIPPED' skills/shipit-core/SKILL.md  # expect 1
```

- [ ] **Step 5: Self-review**

`git diff --cached`. Confirm:
- Only 2 new rows added: one to commands table, one to agents table.
- No existing rows changed.
- Table alignment preserved.

- [ ] **Step 6: Commit**

```bash
git add skills/shipit-core/SKILL.md
git commit -m "docs(shipit-core): register /shipit:pr-fix command + shipit-fixer agent"
```

---

### Task 6: End-to-end structural verification

**Files:** (read-only)

- [ ] **Step 1: Config fields parse as valid JSON**

Run:
```bash
python3 -c "
import json
c = json.load(open('.shipit/config.json'))
pf = c['pr_fix']
required = ['enabled', 'auto_push', 'auto_rereview_after_fix', 'test_runner',
            'max_fixes_per_run', 'severity_filter', 'blast_radius_warn', 'rereview_mode']
for k in required:
  assert k in pf, f'missing {k}'
assert pf['enabled'] is True
assert pf['test_runner'] == 'auto'
assert pf['max_fixes_per_run'] == 20
assert pf['severity_filter'] == ['CRITICAL', 'IMPORTANT', 'MINOR']
assert pf['rereview_mode'] == 'balanced'
print('ok: pr_fix config valid')
"
grep -c 'pr_fix' commands/init.md   # expect ≥ 1
```

- [ ] **Step 2: All new files present with valid frontmatter**

Run:
```bash
for f in commands/pr-fix.md agents/shipit-fixer.md skills/shipit-pr-fix/SKILL.md; do
  echo "=== $f"
  head -4 "$f"
done
```
Expected for each: `---` opener, `name: <name>`, `description: ...`, `---` closer. Commands additionally have `allowed-tools:`.

- [ ] **Step 3: Cross-references resolve**

Run:
```bash
# Command references skill
grep -q 'shipit:shipit-pr-fix' commands/pr-fix.md && echo "ok: command → skill" || echo "MISS"

# Skill references agents
grep -q 'shipit-fixer' skills/shipit-pr-fix/SKILL.md && echo "ok: skill → fixer" || echo "MISS"
grep -q 'shipit-peer-reviewer' skills/shipit-pr-fix/SKILL.md && echo "ok: skill → peer-reviewer" || echo "MISS"

# shipit-core registers both
grep -q '/shipit:pr-fix' skills/shipit-core/SKILL.md && echo "ok: core registers command" || echo "MISS"
grep -q 'shipit-fixer' skills/shipit-core/SKILL.md && echo "ok: core registers agent" || echo "MISS"

# init.md has the pr_fix block
grep -q '"pr_fix"' commands/init.md && echo "ok: init template has pr_fix" || echo "MISS"
```
Expected: every line prints `ok: ...`. Any `MISS:` is a bug.

- [ ] **Step 4: Status values consistent**

Run:
```bash
# The 4 status values must appear together in both fixer agent + shipit-core agent description
grep -c 'DONE\|ROLLED_BACK\|BLOCKED\|PRE_SKIPPED' agents/shipit-fixer.md  # expect ≥ 8
grep -c 'DONE / ROLLED_BACK / BLOCKED / PRE_SKIPPED' skills/shipit-core/SKILL.md  # expect 1
```

- [ ] **Step 5: Commit message format is consistent**

Run:
```bash
# The commit message template used by shipit-fixer
grep -c 'fix(review):' agents/shipit-fixer.md   # expect ≥ 2 (referenced + committed)
grep -c 'fix(review):' skills/shipit-pr-fix/SKILL.md   # expect ≥ 1 (idempotency scan pattern)
```

- [ ] **Step 6: No commit for Task 6 (read-only)**

If any check returns `MISS:` or fails the `expect`, report the concern. Do not attempt inline fixes here — escalate back to the controller.

---

## Post-Implementation Notes

- **Phase 2 behavioral testing** — the 8 F-cases in the spec (`docs/superpowers/specs/2026-04-15-shipit-pr-fix-design.md` §11) require real MRs with known findings. Not part of structural verification. Run by a maintainer before considering pr-fix production-ready.
- **Branch stacking** — this feature requires the marker state from `shipit/rereview-delta`. That branch must merge before this one; otherwise the marker schema v1 won't exist for pr-fix to consume.
- **Future enhancements** (not this plan):
  - Support for Bazel / Nix / non-standard test runners.
  - Per-finding confirm mode (Q4-C from brainstorming) as a config flag.
  - Cross-MR batch fixing (apply the same pattern fix across all MRs on a branch).
  - Integration with `/shipit:peer-qa` — run browser-based verification after pr-fix on frontend MRs.
