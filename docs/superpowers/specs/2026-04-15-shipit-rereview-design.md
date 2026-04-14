# ShipIt Re-Review — Design Spec

**Date:** 2026-04-15
**Status:** Approved for implementation planning
**Scope:** Re-review behavior for the internal `shipit-review` engine. Gated by a new config flag, additive to the engine merged in PR #12.

---

## 1. Problem

`shipit-review` today treats every run on the same MR as a first review. This causes four concrete pains:

1. Re-reads the whole diff, not just commits since the last review.
2. Can post duplicate inline comments for findings already flagged.
3. Doesn't verify whether fixes actually addressed original findings.
4. Can't surface regressions introduced *by* the fix commit.

Additionally: a CRITICAL finding that stays unaddressed across many reviews fades into the background of the MR's comment history — silent persistence feels wrong for genuinely important issues.

## 2. Goals

1. Detect prior reviews of the same MR via a marker comment; extract prior findings.
2. On re-review, review only the commits since the last review (the delta), while keeping prior findings in context.
3. Never re-post an inline comment for a finding already commented (idempotent on fingerprint).
4. Verify each prior finding: `still-open`, `fixed`, or `resolved-by-refactor`.
5. Surface fix-introduced regressions as new findings.
6. Escalate unfixed findings after a severity-specific threshold of reviews — exactly one reply per threshold, not spam.

## 3. Non-goals

- Mandatory CRITICAL second-pass (still deferred from prior design discussions).
- Determinism guarantees — same MR reviewed twice need not produce byte-identical comments.
- Cross-reviewer collaboration (two humans re-running on the same MR simultaneously).
- Pattern-skill revision — the Step 6.5 learned-patterns flow (`.claude/skills/pr-review-patterns/SKILL.md`) is already upgraded and is not touched here.
- Replacing `pr-review-toolkit` — this feature is only active under `peer_review.engine: "shipit-review"`.

## 4. Marker comment state schema

On every review, the bot writes or updates a single HTML-comment marker on the MR discussion:

```
<!-- shipit-peer-review:state v1
{
  "schema": "v1",
  "last_reviewed_sha": "abc123def",
  "reviewed_at": "2026-04-15T10:30:00Z",
  "mode_used": "balanced",
  "findings": [
    {
      "fingerprint": "<sha1(file|line_start|line_end|pattern_key)>",
      "pattern_key": "sql-injection-via-string-concat",
      "severity": "CRITICAL",
      "file": "db.py",
      "line_start": 42,
      "line_end": 46,
      "status": "open",
      "first_seen_at": "2026-04-14T09:15:00Z",
      "times_seen": 2,
      "last_escalated_at_n": 0,
      "gitlab_comment_id": 12345
    }
  ]
}
-->
```

### Field semantics

| Field | Meaning |
|---|---|
| `schema` | Version of the marker format. Incremented if the schema changes in an incompatible way. |
| `last_reviewed_sha` | Commit SHA at the time of the most recent review. Used to compute the delta. |
| `reviewed_at` | ISO-8601 timestamp of the most recent review. |
| `mode_used` | The mode (`efficiency` / `balanced` / `depth`) of the most recent review. |
| `findings[]` | All findings that were `open` OR newly introduced in the most recent review. Fixed findings from prior reviews are dropped to keep the state bounded. |
| `findings[].fingerprint` | SHA-1 of `<file>|<line_start>|<line_end>|<pattern_key>`. Strict tuple — exact match required for idempotency. |
| `findings[].status` | `open` — still present in the code. `fixed` — no longer present. `resolved-by-refactor` — code moved; the same pattern may appear at a new location (captured as a new finding). |
| `findings[].times_seen` | Count of reviews in which this finding has been `open`. Initialised to 1 on first detection; incremented each re-review while `open`. |
| `findings[].last_escalated_at_n` | The `times_seen` value at which this finding was last escalated via a reply comment. 0 = never escalated. |
| `findings[].gitlab_comment_id` | The GitLab discussion-note ID of the inline comment that was posted for this finding. Used to avoid duplicate posting and to locate the thread for escalation replies. |

### Storage

- The marker is a single hidden HTML comment in the MR's top-level discussion.
- `shipit-peer-reviewer` Step 7 upserts this comment (edits if present, creates if not) at the end of every run.
- If the marker cannot be read or written (permissions / API failure), the flow degrades to first-review behavior for the current run and logs the failure in the output summary.

## 5. Flow changes in `shipit-review` (the orchestration skill)

### Step 0 — Marker detection (new)

Before Step 1 (Pre-process):

1. Use GitLab MCP to list comments on the MR.
2. Scan for a top-level comment containing `<!-- shipit-peer-review:state v1`.
3. If found: parse the JSON payload. Record `prior.last_reviewed_sha`, `prior.findings[]`. Set `is_rereview = true`.
4. If absent or parse fails: `is_rereview = false`; proceed as first review.

### Step 1 tweak — Pre-process

When `is_rereview`:
- Build `delta_diff` — the diff between `prior.last_reviewed_sha` and the MR head.
- Build `full_diff` — the entire MR diff (as today).
- Pass both to each specialist as part of the input bundle, plus `prior.findings` with their fingerprints.
- The specialist prompt gets an additional instruction:
  > *"This is a re-review. Focus your attention on the `delta_diff` (commits since the last review). Additionally, for each prior finding listed below, check whether the fix introduced new issues in your dimension."*

When `!is_rereview`: unchanged behavior (single `diff` bundle as today).

### Step 4b — Prior-findings check (new)

Runs after aggregation, before return. Inputs: `prior.findings[]`, the current-run findings, and Read access to the project files.

For each prior finding `P`:

1. **Read** the current file at `P.line_start..P.line_end` (tolerance ±5 lines for trivial shifts due to unrelated edits above).
2. **If** the read range still contains text matching the shape of `P` (concrete heuristic: at least one identifier from the original `fail_snippet` appears in the current range, AND the current range is not fully commented-out / removed). The identifier set is the set of non-keyword tokens in the original `fail_snippet`, excluding common words shorter than 3 characters. This is a pragmatic text-level check — no AST parsing — so it may false-negative on aggressive renames; in that case the finding marks as `fixed` and a genuine surviving bug will be re-caught by the specialist in its normal diff review:
   - Mark `P.status = open`.
   - `P.times_seen += 1`.
3. **Else**: scan current-run findings for one with `pattern_key == P.pattern_key` in the same file (any line):
   - **If found**: mark `P.status = resolved-by-refactor`. The new location is captured as a new finding in the current run (already included in aggregation output). `P.times_seen` is not incremented.
   - **If not found**: mark `P.status = fixed`. Drop `P` from the new marker state (will not carry forward).

Heuristic for step 2 intentionally uses "tolerance ±5 lines + shape match" rather than exact-string match, so that adding a blank line above doesn't mark a finding as `fixed`.

### Step 5 output — expand the return shape

Add `prior_findings_status` to the JSON returned to `shipit-peer-reviewer`:

```json
{
  "verdict_hint": "APPROVE | REQUEST_CHANGES",
  "critical": [...],
  "important": [...],
  "minor": [...],
  "summary": "...",
  "is_rereview": true,
  "delta_range": {"from": "abc123", "to": "def456", "n_commits": 3},
  "prior_findings_status": [
    {"fingerprint": "...", "status": "open|fixed|resolved-by-refactor", "times_seen": 3, "pattern_key": "...", "file": "...", "gitlab_comment_id": 12345}
  ]
}
```

When `!is_rereview`: `is_rereview: false`, `prior_findings_status: []`.

## 6. Flow changes in `shipit-peer-reviewer`

### Step 5 — Idempotent inline comment posting

For each new finding from the current run:
1. Compute `fingerprint = sha1(file|line_start|line_end|pattern_key)`.
2. Check `prior_findings_status[]` for a matching fingerprint.
3. **If match with `status: open`** → skip posting. The existing inline comment at `gitlab_comment_id` is still there.
4. **If match with `status: resolved-by-refactor`** → post a new inline comment at the new location (same pattern moved).
5. **If no match** → new finding. Post a new inline comment. Capture the returned `gitlab_comment_id`.

### Step 5 — Updated summary comment template

When `is_rereview`:

```markdown
## Re-review — MR !<iid>

**New this run:** <N> findings (<C> CRITICAL, <I> IMPORTANT, <M> MINOR)
**Prior findings:** <O_crit> CRITICAL / <O_imp> IMPORTANT / <O_min> MINOR still open; <F> fixed; <R> refactored away
**Delta reviewed:** `<from_sha>` → `<to_sha>` (<n_commits> commits)

### New findings
| # | Severity | Category | Description | File:Line |
|---|----------|----------|-------------|-----------|
…

### Prior findings still unaddressed
| # | Severity | Pattern | File:Line | times_seen |
|---|----------|---------|-----------|------------|
…

_Prior unaddressed findings: see original inline comments._

---
_Review performed by ShipIt peer-review agent (<mode>)._
```

When `!is_rereview`: use the existing first-review summary format (unchanged).

### Step 5b — Escalation replies (new, inside Step 5)

After posting new inline comments, iterate over `prior_findings_status[]` where `status == open`:

1. Read `escalation_thresholds[finding.severity]` from `.shipit/config.json`.
2. If the threshold is `null` → no escalation for this severity. Skip.
3. If `finding.times_seen >= threshold` AND `finding.last_escalated_at_n < threshold`:
   - Post **one** reply on the original comment thread (`gitlab_comment_id`):
     > ⚠ Still unaddressed after {times_seen} reviews. This is a {severity} finding ({pattern_key}).
   - Set `finding.last_escalated_at_n = finding.times_seen`.
4. Subsequent thresholds (e.g., 3 then 6 then 10) are supported if the config specifies an array; for v1, single-threshold-per-severity is sufficient.

### Step 6 — Approve / request changes

Verdict logic is unchanged. `COMMENTS_ONLY` (draft) + `REQUEST CHANGES` + `APPROVE` thresholds apply to the UNION of new findings + prior-findings-still-open. A CRITICAL that has been open for 5 reviews still counts as a CRITICAL for the verdict.

### Step 6.5 — Pattern extraction (unchanged)

Still runs. Still extracts CRITICAL + IMPORTANT into `.claude/skills/pr-review-patterns/SKILL.md`. Re-review does not change Step 6.5's behavior.

### Step 6.6 — GitLab issues for CRITICAL (refined)

Only create GitLab issues for **new** CRITICAL findings in this run (not for prior-open CRITICALs — the issue was already created in the review that first surfaced them).

**Exception to prevent duplicate issues on refactor:** if a new CRITICAL finding has the same `pattern_key` as a `prior_findings_status[]` entry with `status: resolved-by-refactor`, do NOT create a new GitLab issue — the old one already tracks this bug class. Post the inline comment as normal, but reuse the original GitLab issue link in the comment body.

### Step 7 — Marker upsert (new)

At the end of the flow, compose the new marker JSON:
- `last_reviewed_sha` = MR head at start of this run.
- `reviewed_at` = now (ISO-8601).
- `mode_used` = the mode this run used.
- `findings` = `[open from prior, with times_seen updated] + [new from this run, with times_seen=1]`.
  Findings marked `fixed` are dropped. Findings marked `resolved-by-refactor` are dropped (their new-location counterparts are already in the new set).
- Each finding carries its `fingerprint`, `pattern_key`, `severity`, `file`, `line_start`, `line_end`, `status: open`, `first_seen_at`, `times_seen`, `last_escalated_at_n`, `gitlab_comment_id`.

Upsert the marker via GitLab MCP: if a marker comment exists, edit it; else, create a new top-level comment.

## 7. Configuration

Add two fields to the `peer_review` block in `.shipit/config.json` and `commands/init.md`'s default template:

```json
"peer_review": {
  "engine": "shipit-review",
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

- `rereview_enabled: false` → Step 0 always sets `is_rereview = false`; Steps 4b, 5 idempotency, 5b escalation, and 7 upsert are skipped. Every run is a first review.
- `escalation_thresholds` missing / empty / all-null → Step 5b does nothing regardless of `rereview_enabled`.

Two dials, so operations can disable escalation without disabling re-review, or disable everything by flipping `rereview_enabled`.

## 8. Edge cases

| Case | Behavior |
|---|---|
| Dev pushes unrelated changes only | Prior findings stay `open`; summary reports "X still unaddressed"; no duplicate inline posts. |
| Dev fixes CRITICAL X and introduces CRITICAL Y | Prior X → `fixed` (dropped from marker). Y → new inline + new in marker. Verdict `REQUEST CHANGES`. |
| Dev force-pushes (history rewritten) | `prior.last_reviewed_sha` may not exist in the MR history. `delta_diff` falls back to the full MR diff; `is_rereview` remains `true`; prior findings are still checked against current code. |
| Marker comment manually deleted | Treated as first review. Non-destructive — inline comments from prior reviews still exist on the MR. |
| Marker comment schema version newer than the reviewer expects | Log warning, treat as first review, overwrite on Step 7 with current schema. |
| Two reviewers run simultaneously | Race on marker upsert; last write wins. Idempotent posting prevents duplicate inline comments. Escalation may fire twice if both runs cross the threshold independently. Acceptable — rare, not destructive. |
| GitLab comment edit fails (permissions) | Fall back: post a new marker comment; the old one becomes stale. Log in output. |
| Project file at `file:line` was deleted between reviews | Prior-findings check reads return empty → cross-reference scan of current-run findings → if `pattern_key` not found, mark `fixed`. |
| Very large marker state (hundreds of findings) | Marker JSON may grow large. Cap at 200 findings per MR; evict oldest-by-first_seen_at when over cap. Document in marker payload as `truncated_at: N`. |
| Review mode changed between runs (balanced → efficiency) | No special handling; `mode_used` just reflects the most recent mode. Prior findings are kept regardless of which mode found them. |
| `escalation_thresholds.CRITICAL = 1` (immediate escalation) | Supported. Escalates on the first re-review where the CRITICAL is still open. |

## 9. Testing plan

ShipIt is doc-only → structural checks + behavioral manual smoke tests.

### Structural

- All new config fields parse as valid JSON.
- `skills/shipit-review/SKILL.md` Step 0 references GitLab MCP tools that exist.
- `agents/shipit-peer-reviewer.md` Step 5/5b/7 content references marker schema v1 consistently.
- Flowcharts include the marker-detect branch and escalation-reply node.
- No references to `prior_findings` or the marker survive in files outside `shipit-review` and `shipit-peer-reviewer` (scope hygiene).

### Behavioral (manual, on real MRs)

Six cases. Add as an appendix to the existing parity-test checklist:

| # | Case | Expected |
|---|---|---|
| R1 | First review of a new MR | Marker created; summary uses "first review" language; inline comments posted. |
| R2 | Re-review with no dev changes | Marker updated; 0 new inline comments; summary shows `N` prior still open. |
| R3 | Re-review after unrelated push | Delta reviewed only; prior findings stay `open`; no escalation yet (below threshold). |
| R4 | Re-review after fix of a CRITICAL | Prior CRITICAL marked `fixed` and dropped from marker; summary reports "fixed: 1"; verdict APPROVE if nothing else open. |
| R5 | Re-review after fix-introduces-new-bug | Prior finding `fixed`; new finding posted + included in marker; verdict respects new finding. |
| R6 | Escalation — CRITICAL still open on review 3 | One reply posted on the original thread; `last_escalated_at_n = 3`. Review 4 with same state → no additional reply. |

### Rollback test

Set `rereview_enabled: false` mid-test. Next run:
- Step 0 forces `is_rereview = false`.
- Specialists review the full diff as today.
- Summary uses first-review language.
- No marker upsert at Step 7.
- Prior marker comment on the MR remains unchanged (not cleaned up — not destructive).

## 10. Rollout

Single plan, single branch. Feature is gated two ways (`engine` + `rereview_enabled`) so we can merge before flipping the default engine.

1. Implement all tasks on a feature branch.
2. Structural verification.
3. Merge with `rereview_enabled: true` as the default and the main engine still defaulting to `pr-review-toolkit`. No user impact yet.
4. When the main engine default flips to `shipit-review` (separate future plan), re-review turns on automatically.
5. If problems surface, a user can set `rereview_enabled: false` as a rollback per-project.
6. Once stable for two releases, a cleanup plan removes the `rereview_enabled` flag.

## 11. Files touched

| File | Nature of change |
|---|---|
| `skills/shipit-review/SKILL.md` | Add Step 0, Step 1 tweak, Step 4b, Step 5 output expansion |
| `agents/shipit-peer-reviewer.md` | Idempotent posting in Step 5, summary-comment template, Step 5b escalation, Step 7 marker upsert |
| `.shipit/config.json` | Add `rereview_enabled` and `escalation_thresholds` |
| `commands/init.md` | Mirror the two new fields in the default config template |
| `skills/peer-review/SKILL.md` | Document re-review flow, escalation, new config fields |
| `docs/peer-review-flowchart.md` | Add marker-detect branch + escalation-reply node |
| `review flowchart.txt` | Same |

No new files. No new agents.

## 12. Open questions (resolved in conversation)

| Question | Resolution |
|---|---|
| Where does marker state live? | Hidden HTML comment on MR discussion (portable, self-cleaning). |
| Fingerprint granularity? | Strict tuple `(file, line_start, line_end, pattern_key)`. Same as the aggregation dedup tuple. |
| What if dev pushes unrelated changes? | Prior findings stay `open`; not lost; no re-post of inline comments. |
| What if a finding stays unfixed across many reviews? | Escalation reply posts once per severity-specific threshold. Default CRITICAL = 3, IMPORTANT = 5, MINOR = off. |
| New specialist agent for prior-findings check? | No — logic lives in `shipit-review/SKILL.md` as a post-aggregation step. |
| CRITICAL auto-second-pass? | Deferred. Not in scope. |

## 13. Assumptions

- GitLab MCP supports listing MR comments, creating a top-level MR comment, editing an existing comment, and posting a reply on an existing comment thread. If any of these is missing, Step 0 or Step 7 degrades to first-review behavior for the affected run.
- The `delta_diff` construction (commits since `last_reviewed_sha`) can be computed from the GitLab MCP's MR-commits API or a local `git log` in a worktree on the MR source branch. If neither works, fall back to `full_diff` — the re-review still functions, it just doesn't focus on the delta.
- Marker comments created by earlier versions of this feature are readable by later versions (schema-version-aware). If a future incompatible schema ships, the reader gracefully falls back to first-review behavior and overwrites on Step 7.
- Token budget impact of the new flow is small: prior findings are a short JSON; delta_diff is usually smaller than full_diff; escalation replies are single-sentence. No specialist is called more times per run. Net effect: re-reviews may cost less than first reviews.
