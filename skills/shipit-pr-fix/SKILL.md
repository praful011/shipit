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
