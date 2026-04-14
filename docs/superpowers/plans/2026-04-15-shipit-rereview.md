# ShipIt Re-Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add re-review behavior to `shipit-review`: detect prior reviews via a marker comment, review only the delta, skip duplicate inline comments, verify prior-finding status, and escalate unaddressed findings once per severity threshold.

**Architecture:** Additive to the internal reviewer merged in PR #12. No new agents, no new commands. State lives in a single hidden HTML comment on the MR (`<!-- shipit-peer-review:state v1 {...} -->`). Orchestration logic goes in `skills/shipit-review/SKILL.md`; posting/escalation/marker upsert goes in `agents/shipit-peer-reviewer.md`. Gated by `peer_review.rereview_enabled` (default `true`) and the existing `peer_review.engine` flag.

**Tech Stack:** Markdown + YAML frontmatter (doc-only plugin). Verification is structural — `grep`, `Read`, valid JSON checks.

**Spec:** `docs/superpowers/specs/2026-04-15-shipit-rereview-design.md`

---

## Conventions for this plan

- "Red / green" steps here are structural `grep`/`Read`/JSON-parse checks, not code tests.
- Every task ends with an atomic commit scoped to its files.
- Task 4–7 all modify `agents/shipit-peer-reviewer.md` — run them sequentially (not in parallel).
- Feature-flag behavior:
  - `rereview_enabled: false` → Step 0 forces `is_rereview = false`; Steps 4b / idempotent-posting / 5b escalation / Step 7 upsert are all skipped.
  - `escalation_thresholds` missing / all-null → Step 5b does nothing regardless of `rereview_enabled`.

---

### Task 1: Add re-review config fields

**Files:**
- Modify: `.shipit/config.json`
- Modify: `commands/init.md`

- [ ] **Step 1: Confirm fields absent (red)**

Run:
```bash
grep -c 'rereview_enabled' .shipit/config.json commands/init.md
```
Expected: both `0`.

- [ ] **Step 2: Add fields to `.shipit/config.json`**

Read current file, then add `rereview_enabled` and `escalation_thresholds` inside the existing `peer_review` block. After edit the file must be:

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
  }
}
```

- [ ] **Step 3: Add fields to `commands/init.md` Step 9 config template**

Find the Step 9 JSON template (search for `"peer_review"` in `commands/init.md`). The current template ends with:
```json
    "peer_review": {
      "engine": "pr-review-toolkit",
      "default_mode": "balanced",
      "ask_mode_each_run": true
    }
```

Replace the `peer_review` block with:
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

- [ ] **Step 4: Verify (green)**

Run:
```bash
python3 -c "import json; c=json.load(open('.shipit/config.json')); pr=c['peer_review']; print(pr['rereview_enabled'], pr['escalation_thresholds'])"
grep -c 'rereview_enabled' commands/init.md        # expect ≥ 1
grep -c 'escalation_thresholds' commands/init.md   # expect ≥ 1
```
Expected first line: `True {'CRITICAL': 3, 'IMPORTANT': 5, 'MINOR': None}`

- [ ] **Step 5: Commit**

```bash
git add .shipit/config.json commands/init.md
git commit -m "feat(rereview): add rereview_enabled + escalation_thresholds config"
```

---

### Task 2: Add Step 0 (marker detection) and Step 1 tweak to `shipit-review`

**Files:**
- Modify: `skills/shipit-review/SKILL.md`

- [ ] **Step 1: Confirm Step 0 absent (red)**

Run:
```bash
grep -c 'Step 0\|marker detection\|is_rereview' skills/shipit-review/SKILL.md
```
Expected: `0`.

- [ ] **Step 2: Insert Step 0 before Step 1**

Find the `## Process` heading in `skills/shipit-review/SKILL.md`. Immediately before the `### 1. Pre-process` sub-heading, insert this new sub-section:

````markdown
### 0. Marker detection (re-review gate)

Before any other processing, check for prior review state.

1. Read `peer_review.rereview_enabled` from `.shipit/config.json`. If `false`, set `is_rereview = false` and skip to Step 1 — treat this run as a first review.
2. Otherwise, use the GitLab MCP to list comments on the MR.
3. Scan for a top-level MR comment whose body starts with `<!-- shipit-peer-review:state v1`.
4. If found:
   - Extract the JSON payload between the opening `<!-- shipit-peer-review:state v1` and the closing `-->`.
   - Parse as JSON. If parse fails → `is_rereview = false`; log a warning; proceed as first review.
   - Otherwise: set `is_rereview = true`, capture `prior.last_reviewed_sha`, `prior.findings[]`, `prior.mode_used`.
5. If not found: `is_rereview = false`. This is a first review.

The extracted `prior` state is passed through to Step 1 and Step 4b.

### 0b. Config-driven disable

If `peer_review.rereview_enabled == false`, force `is_rereview = false` regardless of marker presence. This is a hard rollback switch — no delta review, no idempotent posting, no escalation, no marker upsert. The pre-existing (first-review-every-run) behavior resumes.

````

- [ ] **Step 3: Add `is_rereview` handling to Step 1 (Pre-process)**

Find `### 1. Pre-process` in the file. After the existing numbered sub-steps (1. parse diff, 2. skip non-review files, 3. PR compression, 4. load project context, 5. synthesize intent_summary), insert a new sub-step 6:

```markdown
6. **If `is_rereview`:** construct two diffs instead of one.
   - `delta_diff` — the diff from `prior.last_reviewed_sha` to the MR head. Compute via the GitLab MCP (`get_merge_request_details` or the compare-commits API) or, if that fails, via local `git log`/`git diff` in a worktree on the MR source branch.
   - `full_diff` — the entire MR diff (as today).
   - If `delta_diff` computation fails (prior SHA not in history after force-push, API error), fall back: use `full_diff` for both values and note this in the Step 5 output under a new `delta_fallback_reason` field.

   Both diffs, plus `prior.findings[]` with their fingerprints, are passed to each specialist in the input bundle. Add these fields:

   ```json
   {
     ...,
     "is_rereview": true,
     "delta_diff": { ... },
     "full_diff": { ... },
     "prior_findings": [ {fingerprint, pattern_key, severity, file, line_start, line_end, status}, ... ]
   }
   ```

   Specialists receive an additional instruction in their prompt:
   > *"This is a re-review. Focus your attention on `delta_diff` (commits since the last review). Additionally, for each entry in `prior_findings`, check whether the fix introduced new issues in your dimension."*

   When `!is_rereview`: pass only the single `diff` field (as today). Omit `delta_diff`, `full_diff`, `prior_findings`.
```

- [ ] **Step 4: Verify (green)**

Run:
```bash
grep -c '### 0. Marker detection' skills/shipit-review/SKILL.md    # expect 1
grep -c 'is_rereview' skills/shipit-review/SKILL.md                # expect ≥ 4
grep -c 'prior_findings' skills/shipit-review/SKILL.md             # expect ≥ 2
grep -c 'delta_diff' skills/shipit-review/SKILL.md                 # expect ≥ 3
grep -c 'rereview_enabled' skills/shipit-review/SKILL.md           # expect ≥ 1
```

- [ ] **Step 5: Self-review**

`git diff --cached`. Confirm:
- Step 0 is inserted BEFORE Step 1 (not after).
- Step 1's existing 5 sub-steps are untouched; only a new sub-step 6 was added.
- No text outside `## Process` was changed.

- [ ] **Step 6: Commit**

```bash
git add skills/shipit-review/SKILL.md
git commit -m "feat(rereview): add Step 0 marker detection + Step 1 delta diff"
```

---

### Task 3: Add Step 4b (prior-findings check) + Step 5 output expansion

**Files:**
- Modify: `skills/shipit-review/SKILL.md`

- [ ] **Step 1: Confirm Step 4b absent (red)**

Run: `grep -c 'Step 4b\|prior-findings check\|prior_findings_status' skills/shipit-review/SKILL.md` → expect `0`.

- [ ] **Step 2: Insert Step 4b after Step 4 (Aggregate)**

Find `### 4. Aggregate` in the `## Process` section. Immediately after Step 4's body ends (before `### 5. Return`), insert:

````markdown
### 4b. Prior-findings check (re-review only)

Skip entirely if `is_rereview == false`.

For each entry `P` in `prior.findings`:

1. **Read** the file `P.file` at lines `P.line_start..P.line_end` (tolerance ±5 lines to accommodate trivial shifts from unrelated edits above).
2. **Shape check:** build the identifier set — the set of non-keyword tokens (length ≥ 3) in `P.fail_snippet` that aren't common English words. Does the current read range contain at least one identifier from this set, AND is the range not fully commented-out / removed?
   - **Yes** → mark `P.status = open`. Increment `P.times_seen` (or set to 1 if missing).
3. **No** → scan the current-run findings list for any finding with `pattern_key == P.pattern_key` in the same file (any line):
   - **Found** → mark `P.status = resolved-by-refactor`. Do not increment `times_seen`. The new-location finding is already in the current-run output via normal aggregation.
   - **Not found** → mark `P.status = fixed`. `P` will be dropped from the marker state in Step 7 (of `shipit-peer-reviewer`).

Produce a `prior_findings_status[]` list with one entry per prior finding:

```json
{
  "fingerprint": "<unchanged from prior>",
  "pattern_key": "...",
  "severity": "CRITICAL|IMPORTANT|MINOR",
  "file": "...",
  "line_start": 42,
  "line_end": 46,
  "status": "open|fixed|resolved-by-refactor",
  "times_seen": 3,
  "last_escalated_at_n": 0,
  "gitlab_comment_id": 12345,
  "first_seen_at": "<unchanged>"
}
```
````

- [ ] **Step 3: Expand Step 5 (Return) output schema**

Find `### 5. Return` in the file. Replace the JSON schema block with:

```json
{
  "verdict_hint": "APPROVE | REQUEST_CHANGES",
  "critical": [ <finding>, ... ],
  "important": [ <finding>, ... ],
  "minor": [ <finding>, ... ],
  "summary": "<2–3 sentence overview>",
  "is_rereview": true,
  "delta_range": {"from": "<prior_sha>", "to": "<current_head>", "n_commits": 3},
  "delta_fallback_reason": null,
  "prior_findings_status": [ <entry from Step 4b>, ... ]
}
```

Add a short paragraph after the schema:

```markdown
The last three fields are included only when `is_rereview == true`. `delta_fallback_reason` is non-null only if Step 1's `delta_diff` computation failed (e.g., `"prior_sha_not_in_history"`). `shipit-peer-reviewer` consumes these fields in its updated Step 5 (idempotent posting), Step 5b (escalation), and Step 7 (marker upsert).
```

- [ ] **Step 4: Verify (green)**

Run:
```bash
grep -c '### 4b\. Prior-findings check' skills/shipit-review/SKILL.md   # expect 1
grep -c 'prior_findings_status' skills/shipit-review/SKILL.md            # expect ≥ 2
grep -c 'times_seen' skills/shipit-review/SKILL.md                        # expect ≥ 2
grep -c 'resolved-by-refactor' skills/shipit-review/SKILL.md              # expect ≥ 2
grep -c 'delta_fallback_reason' skills/shipit-review/SKILL.md             # expect ≥ 2
```

- [ ] **Step 5: Commit**

```bash
git add skills/shipit-review/SKILL.md
git commit -m "feat(rereview): add Step 4b prior-findings check + Step 5 output expansion"
```

---

### Task 4: Idempotent inline-comment posting in `shipit-peer-reviewer` Step 5

**Files:**
- Modify: `agents/shipit-peer-reviewer.md`

- [ ] **Step 1: Locate Step 5 inline-comment posting (red)**

Run:
```bash
grep -n '## Step 5: Post Review Comments\|Inline comments' agents/shipit-peer-reviewer.md
```
Record the line range of Step 5's inline-comments sub-section. Confirm:
```bash
grep -c 'fingerprint\|prior_findings_status' agents/shipit-peer-reviewer.md
```
Expected: `0`.

- [ ] **Step 2: Insert fingerprint + idempotency block before the inline-comment posting instructions**

Find the sub-section in Step 5 that says "Inline comments (if supported by GitLab MCP) — Post specific comments on the relevant lines of the diff for each issue found." Replace it with:

````markdown
2. **Inline comments (idempotent):** For each finding in `critical[] ∪ important[] ∪ minor[]`:

   a. Compute `fingerprint = sha1("<file>|<line_start>|<line_end>|<pattern_key>")`.

   b. Check `prior_findings_status[]` for an entry with the same fingerprint:
      - **If match with `status: open`** → the inline comment already exists at `gitlab_comment_id`. **Skip posting**. Record the existing `gitlab_comment_id` for use in the new marker state.
      - **If match with `status: resolved-by-refactor`** → the same bug class moved to a new location. Post a new inline comment at the new location. Reference the original GitLab issue URL from the matched entry (if present) in the comment body: `_(moved from a previously-flagged location; see original issue #X)_`.
      - **If no match** → new finding. Post a new inline comment via GitLab MCP. Capture the returned `gitlab_comment_id`.

   c. Record the final `(fingerprint, gitlab_comment_id)` pair for Step 7's marker upsert.

   When `is_rereview == false`, `prior_findings_status` is empty → every finding is posted as new (existing behavior).
````

- [ ] **Step 3: Refine Step 6.6 to skip duplicate GitLab issues on refactor**

Find `## Step 6.6: Create GitLab Issues for CRITICAL Findings (Best-Effort)` in the same file. Inside subsection `### 6.6.1: Create One Issue Per CRITICAL Finding`, insert this new note immediately before the existing `mcp__gitlab__create_issue(...)` call:

```markdown
**Skip on refactor (re-review only):** Before creating an issue, check `prior_findings_status[]`. If any entry has `status == "resolved-by-refactor"` AND the same `pattern_key` as this new CRITICAL finding, **skip the issue-creation call**. The original GitLab issue (from the review that first surfaced this pattern) already tracks this bug class. Instead, append a line to the inline comment body: `_(tracked in prior issue from peer review — see <prior-issue-url-if-known>)_`. If the prior `gitlab_issue_url` was not captured, just skip issue creation silently — the inline comment is sufficient.
```

- [ ] **Step 4: Verify (green)**

Run:
```bash
grep -c 'fingerprint' agents/shipit-peer-reviewer.md                      # expect ≥ 3
grep -c 'sha1.*file.*line_start.*line_end.*pattern_key' agents/shipit-peer-reviewer.md  # expect ≥ 1
grep -c 'prior_findings_status' agents/shipit-peer-reviewer.md            # expect ≥ 3
grep -c 'resolved-by-refactor' agents/shipit-peer-reviewer.md             # expect ≥ 2
grep -c 'Skip on refactor' agents/shipit-peer-reviewer.md                 # expect 1
```

- [ ] **Step 5: Commit**

```bash
git add agents/shipit-peer-reviewer.md
git commit -m "feat(rereview): idempotent comment posting + skip duplicate issues on refactor"
```

---

### Task 5: Re-review summary comment template

**Files:**
- Modify: `agents/shipit-peer-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `grep -c 'Prior findings:\|Delta reviewed:\|Re-review —' agents/shipit-peer-reviewer.md` → expect `0`.

- [ ] **Step 2: Update Step 5's summary comment block**

Find the "Summary comment" sub-section in Step 5 (look for `## Automated Peer Review —` in a code block). Replace the summary-comment template section with:

````markdown
1. **Summary comment** — Post a top-level MR comment.

   **When `is_rereview == false`** (first review), use this template:
   ```
   ## Automated Peer Review — <Jira Ticket Key>

   **Verdict:** APPROVED | CHANGES REQUESTED | COMMENTS_ONLY
   **Issues Found:** N critical, N important, N minor

   ### Summary
   <brief overview of findings>

   ### Issues
   | # | Severity | Category | Description |
   |---|----------|----------|-------------|
   | 1 | CRITICAL | Security | <description> |

   ---
   _Review performed by ShipIt peer-review agent (<mode>)._
   ```

   **When `is_rereview == true`** (re-review), use this template instead:
   ```
   ## Re-review — <Jira Ticket Key> — MR !<iid>

   **Verdict:** APPROVED | CHANGES REQUESTED | COMMENTS_ONLY
   **New this run:** <N> findings (<C> CRITICAL, <I> IMPORTANT, <M> MINOR)
   **Prior findings:** <O_crit> CRITICAL / <O_imp> IMPORTANT / <O_min> MINOR still open; <F> fixed; <R> refactored away
   **Delta reviewed:** `<from_sha>` → `<to_sha>` (<n_commits> commits)<delta_fallback_note>

   ### New findings
   | # | Severity | Category | Description | File:Line |
   |---|----------|----------|-------------|-----------|

   ### Prior findings still unaddressed
   | # | Severity | Pattern | File:Line | times_seen |
   |---|----------|---------|-----------|------------|

   _Prior unaddressed findings: see original inline comments._

   ---
   _Review performed by ShipIt peer-review agent (<mode>)._
   ```

   `<delta_fallback_note>` is empty when `delta_fallback_reason == null`. When non-null (e.g., after a force-push), append ` — delta fallback: <reason>; reviewed full MR diff this run` to the Delta reviewed line.

   Populate counts from the orchestration-skill output:
   - `<N>`, `<C>`, `<I>`, `<M>`: counts of `critical + important + minor` from this run.
   - `<O_crit>`, `<O_imp>`, `<O_min>`: counts of entries in `prior_findings_status` with `status == "open"`, grouped by severity.
   - `<F>`, `<R>`: counts with `status == "fixed"` and `status == "resolved-by-refactor"`.
````

- [ ] **Step 3: Verify (green)**

Run:
```bash
grep -c 'Re-review — <Jira Ticket Key>' agents/shipit-peer-reviewer.md       # expect 1
grep -c 'Prior findings still unaddressed' agents/shipit-peer-reviewer.md    # expect 1
grep -c 'Delta reviewed' agents/shipit-peer-reviewer.md                      # expect 1
grep -c 'delta_fallback_note\|delta_fallback_reason' agents/shipit-peer-reviewer.md  # expect ≥ 2
```

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-peer-reviewer.md
git commit -m "feat(rereview): add re-review summary comment template"
```

---

### Task 6: Step 5b escalation-reply logic

**Files:**
- Modify: `agents/shipit-peer-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `grep -c 'Step 5b\|escalation\|last_escalated_at_n' agents/shipit-peer-reviewer.md` → expect `0`.

- [ ] **Step 2: Insert Step 5b after Step 5**

Find `## Step 6: Approve or Request Changes`. Immediately before it, insert a new step:

````markdown
## Step 5b: Escalation Replies (re-review only)

Skip entirely if `is_rereview == false`.

Read `peer_review.escalation_thresholds` from `.shipit/config.json`. For each entry `P` in `prior_findings_status` where `P.status == "open"`:

1. Look up `threshold = escalation_thresholds[P.severity]`. If `null` or missing → skip this finding.
2. If `P.times_seen >= threshold` AND `P.last_escalated_at_n < threshold`:
   - Post a reply on the original comment thread (via GitLab MCP's comment-reply or discussion-note API, using `P.gitlab_comment_id` as the target):
     ```
     ⚠ Still unaddressed after <P.times_seen> reviews. This is a <P.severity> finding (<P.pattern_key>).
     ```
   - Set `P.last_escalated_at_n = P.times_seen`.
3. Record the updated `last_escalated_at_n` for Step 7's marker upsert.

**Notes:**

- Subsequent thresholds are supported trivially by updating the config, e.g., `escalation_thresholds: {"CRITICAL": [3, 6, 10]}`. For v1, single-threshold-per-severity is sufficient; array support is a follow-up enhancement.
- If `escalation_thresholds` is missing or empty, this step is a no-op regardless of `rereview_enabled`.
- Reply posting failures (permissions, MCP errors) are logged and do not block Step 6 or later.
````

- [ ] **Step 3: Verify (green)**

Run:
```bash
grep -c '## Step 5b: Escalation Replies' agents/shipit-peer-reviewer.md     # expect 1
grep -c 'last_escalated_at_n' agents/shipit-peer-reviewer.md                # expect ≥ 3
grep -c 'escalation_thresholds' agents/shipit-peer-reviewer.md              # expect ≥ 2
```

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-peer-reviewer.md
git commit -m "feat(rereview): add Step 5b escalation replies for unaddressed findings"
```

---

### Task 7: Step 7 marker-state upsert

**Files:**
- Modify: `agents/shipit-peer-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `grep -c 'marker upsert\|shipit-peer-review:state' agents/shipit-peer-reviewer.md` → expect `0`.

- [ ] **Step 2: Rewrite Step 7 (Return Summary)**

Find `## Step 7: Return Summary`. Replace its body with:

````markdown
## Step 7: Upsert Marker State + Return Summary

### 7.1 Build new marker state

Skip marker upsert if `is_rereview == false` AND `peer_review.rereview_enabled == false` (no re-review machinery active). Otherwise, build the new state:

```json
{
  "schema": "v1",
  "last_reviewed_sha": "<MR head SHA at the start of this run>",
  "reviewed_at": "<ISO-8601 now>",
  "mode_used": "<efficiency|balanced|depth>",
  "findings": [ ... ]
}
```

The `findings[]` array is assembled as follows:

1. **Prior open findings (carried forward):** every entry from `prior_findings_status` with `status == "open"`. Include updated `times_seen`, `last_escalated_at_n`, and `gitlab_comment_id`.
2. **New findings (this run):** every finding posted in Step 5, each with:
   - `fingerprint`: computed in Step 5.
   - `pattern_key`, `severity`, `file`, `line_start`, `line_end`: from the finding.
   - `status`: `"open"`.
   - `first_seen_at`: current ISO-8601 timestamp.
   - `times_seen`: `1`.
   - `last_escalated_at_n`: `0`.
   - `gitlab_comment_id`: the ID returned from the posting call.
3. **Exclude:** entries with `status == "fixed"` or `status == "resolved-by-refactor"`. Their new-location counterparts (if any) are already in #2.

**Cap:** if `findings.length > 200`, sort by `(severity ASC by priority: MINOR, IMPORTANT, CRITICAL)` then by `first_seen_at DESC`, and truncate. Add `"truncated_at": <original_length>` at the top level of the marker payload. CRITICAL entries are always preserved (never evicted by the cap).

### 7.2 Upsert the marker comment

Serialize the state as JSON, wrap in:
```
<!-- shipit-peer-review:state v1
<JSON>
-->
```

Via GitLab MCP:
1. List top-level MR comments.
2. Find the one whose body begins with `<!-- shipit-peer-review:state v1`.
3. If found → edit it to the new body.
4. If not found → create a new top-level MR comment with this body.

If the edit fails (permissions, MCP error), fall back: post a new marker comment and log that the old one is stale. First-review-path behavior for this run's outcome remains unaffected.

### 7.3 Return structured summary

Return to the calling command:

```
## Peer Review Complete

- **Ticket:** <JIRA_KEY> — <ticket summary>
- **MR:** <MR_URL>
- **Verdict:** APPROVED | CHANGES REQUESTED | COMMENTS_ONLY
- **Mode:** <efficiency|balanced|depth>
- **Re-review:** yes | no
- **New findings:** N critical, N important, N minor
- **Prior findings:** N still open, N fixed, N refactored away (only when re-review)
- **Escalations posted:** N (only when re-review)
- **Action Taken:** MR approved | Changes requested | Comments only (draft)
- **Marker:** upserted | fallback-created | not-applicable
```
````

- [ ] **Step 3: Verify (green)**

Run:
```bash
grep -c 'Upsert Marker State' agents/shipit-peer-reviewer.md                   # expect 1
grep -c 'shipit-peer-review:state v1' agents/shipit-peer-reviewer.md           # expect ≥ 2
grep -c 'truncated_at' agents/shipit-peer-reviewer.md                          # expect ≥ 1
grep -c 'Re-review:' agents/shipit-peer-reviewer.md                            # expect ≥ 1
```

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-peer-reviewer.md
git commit -m "feat(rereview): upsert marker state comment in Step 7"
```

---

### Task 8: Update `skills/peer-review/SKILL.md` documentation

**Files:**
- Modify: `skills/peer-review/SKILL.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `grep -c 'Re-review\|rereview_enabled\|escalation_thresholds' skills/peer-review/SKILL.md` → expect `0`.

- [ ] **Step 2: Add a "Re-review Behavior" section**

Append this section immediately after `## Review Mode Selection`:

````markdown
## Re-review Behavior

When the engine is `shipit-review` and `peer_review.rereview_enabled` is `true` (default), running `/shipit:peer-review` on an MR that has been reviewed before produces a **re-review** with these differences from a first review:

| Behavior | First review | Re-review |
|---|---|---|
| Diff reviewed | Full MR | Commits since last review (delta), with prior findings in context |
| Inline comments | Post for every finding | Skip findings whose fingerprint was already posted (idempotent) |
| Prior findings | N/A | Checked: `open` / `fixed` / `resolved-by-refactor` |
| Regression detection | N/A | Specialists get a prompt to flag bugs introduced by the fix commit |
| Summary comment | "Automated Peer Review" template | "Re-review" template showing new + prior + delta range |
| Marker state | Created | Updated in place |

### Escalation

Unaddressed `open` findings have a `times_seen` counter. When `times_seen` crosses `peer_review.escalation_thresholds[severity]`, the bot posts a single reply on the original comment thread (not a spam loop). Defaults:

| Severity | Default threshold |
|---|---|
| CRITICAL | 3 reviews |
| IMPORTANT | 5 reviews |
| MINOR | disabled |

Set any threshold to `null` to disable escalation for that severity.

### Rollback

Three independent dials:
1. `peer_review.engine: "pr-review-toolkit"` → disables the entire internal engine (re-review included).
2. `peer_review.engine: "shipit-review"` + `rereview_enabled: false` → internal engine runs but treats every run as a first review.
3. `escalation_thresholds: {...all null}` → re-review active, escalation disabled.

Prior marker comments left on MRs by earlier runs are not destructive — they are simply ignored when `rereview_enabled` is `false`.
````

- [ ] **Step 3: Verify (green)**

Run:
```bash
grep -c '## Re-review Behavior' skills/peer-review/SKILL.md           # expect 1
grep -c 'rereview_enabled' skills/peer-review/SKILL.md                # expect ≥ 2
grep -c 'escalation_thresholds' skills/peer-review/SKILL.md           # expect ≥ 1
```

- [ ] **Step 4: Commit**

```bash
git add skills/peer-review/SKILL.md
git commit -m "docs(peer-review): document re-review behavior and escalation"
```

---

### Task 9: Update flowcharts

**Files:**
- Modify: `docs/peer-review-flowchart.md`
- Modify: `review flowchart.txt`

- [ ] **Step 1: Locate current flowchart nodes (red)**

Run:
```bash
grep -n 'Step 5.5\|Spawn peer-reviewer\|Spawn Peer Reviewer' docs/peer-review-flowchart.md "review flowchart.txt" 2>/dev/null
grep -c 'marker\|Re-review' docs/peer-review-flowchart.md     # expect 0
```

- [ ] **Step 2: Add a re-review branch in `docs/peer-review-flowchart.md`**

In the Mermaid-style / block flow, find where the `shipit-review` engine is called. Immediately within that branch, add a sub-branch showing:

```
     Call shipit-review skill
           │
           ▼
    ┌────────────────────────────────┐
    │ Step 0: Check marker comment   │
    │ on MR for prior review state   │
    └─────┬──────────────────┬───────┘
      found│                  │ not found
           ▼                  ▼
    is_rereview=true     is_rereview=false
     (delta review,       (full diff, as
     prior-findings        first review)
     check, escalation)
           │                  │
           └──────┬───────────┘
                  ▼
       Specialists run, aggregate
                  │
                  ▼
           Step 7: Upsert
           marker comment
```

Also add a footnote / paragraph below the diagram:

```markdown
**Re-review vs first review** — controlled by `peer_review.rereview_enabled` in `.shipit/config.json`. Disabling forces every run to behave as a first review regardless of marker presence. Escalation replies are controlled independently via `peer_review.escalation_thresholds`.
```

- [ ] **Step 3: Add the same to `review flowchart.txt`**

Add an ASCII-art version of the marker-detect branch inside the `shipit-review` engine box. Keep existing box-drawing characters consistent. The exact position: within or adjacent to the existing shipit-review engine box, add this sub-block:

```
  ┌─ Step 0: Marker? ──┐
  │  (first review vs. │
  │   re-review gate)  │
  └────────────────────┘
           │
  ┌────────┴─────────┐
  │ first:  full diff│
  │ re:     delta +  │
  │         prior-   │
  │         findings │
  │         check    │
  └──────────────────┘
```

And add a trailing line at the bottom: `Step 7: Upsert marker state (re-review only).`

- [ ] **Step 4: Verify (green)**

Run:
```bash
grep -c 'marker\|Re-review\|is_rereview' docs/peer-review-flowchart.md         # expect ≥ 2
grep -c 'Marker\|Re-review\|marker state' "review flowchart.txt"                # expect ≥ 2
```

- [ ] **Step 5: Commit**

```bash
git add docs/peer-review-flowchart.md "review flowchart.txt"
git commit -m "docs: update peer-review flowchart for re-review and marker state"
```

---

### Task 10: Append re-review test cases to the parity-test checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `grep -c 'Re-review Test Cases\|R1\|marker comment' docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md` → expect `0`.

- [ ] **Step 2: Append a Re-review Test Cases section**

Add to the end of the file:

```markdown
---

## Re-review Test Cases (Phase 2 addendum)

After the base parity matrix passes, run these six re-review cases. Each requires a real MR you can push to.

| # | Case | Setup | Expected |
|---|---|---|---|
| R1 | First review | MR never reviewed by `shipit-review` | Marker comment created on MR with `schema: v1`, `last_reviewed_sha`, `findings[]`. Summary uses first-review template. |
| R2 | Re-review, no dev changes | Re-run without pushing new commits | Marker updated with new `reviewed_at`; zero new inline comments; summary shows `N` prior still open. |
| R3 | Re-review, unrelated push | Dev pushes an unrelated change (e.g., log line) | Delta reviewed only; prior findings remain `open`; `times_seen` incremented; no escalation yet. |
| R4 | Re-review, fix applied | Dev addresses a prior CRITICAL | Prior CRITICAL marked `fixed` and dropped from marker. Summary reports "fixed: 1". Verdict APPROVE if nothing else open. |
| R5 | Fix-introduces-new-bug | Dev "fixes" a CRITICAL by removing try/catch (introducing a silent-drop bug) | Prior finding `fixed`; new error-handling finding posted. Verdict respects the new finding. |
| R6 | Escalation threshold | Third re-review with the same CRITICAL still open (`times_seen` reaches 3) | One reply posted on the original comment thread: `⚠ Still unaddressed after 3 reviews`. `last_escalated_at_n = 3`. Fourth re-review with no change → no additional reply. |

### Rollback verification

After the re-review cases pass, set `peer_review.rereview_enabled: false` and run `/shipit:peer-review` once. Expected:

- Step 0 immediately returns `is_rereview = false`.
- Full MR diff reviewed (not delta).
- Summary uses first-review template.
- No marker upsert (old marker on MR is left alone, not deleted).
```

- [ ] **Step 3: Verify (green)**

Run:
```bash
grep -c 'Re-review Test Cases' docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md   # expect 1
grep -cE '^\| R[1-6] ' docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md          # expect 6
grep -c 'Rollback verification' docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md # expect 1
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md
git commit -m "docs(rereview): add R1-R6 parity test cases + rollback check"
```

---

### Task 11: End-to-end structural verification

**Files:** (read-only)

- [ ] **Step 1: Config fields parse as valid JSON**

Run:
```bash
python3 -c "
import json
c = json.load(open('.shipit/config.json'))
pr = c['peer_review']
assert 'rereview_enabled' in pr
assert 'escalation_thresholds' in pr
assert pr['escalation_thresholds']['CRITICAL'] == 3
assert pr['escalation_thresholds']['IMPORTANT'] == 5
assert pr['escalation_thresholds']['MINOR'] is None
print('ok: config fields valid')
"
```
Expected: `ok: config fields valid`.

- [ ] **Step 2: `shipit-review` orchestration has all re-review hooks**

Run:
```bash
for kw in '### 0. Marker detection' 'is_rereview' 'delta_diff' 'prior_findings' '### 4b. Prior-findings check' 'prior_findings_status' 'delta_fallback_reason' 'resolved-by-refactor'; do
  grep -q "$kw" skills/shipit-review/SKILL.md && echo "ok: $kw" || echo "MISS: $kw"
done
```
Expected: every line `ok: ...`.

- [ ] **Step 3: `shipit-peer-reviewer` has posting / escalation / marker upsert**

Run:
```bash
for kw in 'fingerprint' 'sha1' 'prior_findings_status' 'Re-review — <Jira' '## Step 5b: Escalation Replies' 'last_escalated_at_n' 'Upsert Marker State' 'shipit-peer-review:state v1' 'truncated_at'; do
  grep -q "$kw" agents/shipit-peer-reviewer.md && echo "ok: $kw" || echo "MISS: $kw"
done
```
Expected: every line `ok: ...`.

- [ ] **Step 4: Doc syncs and checklist addendum**

Run:
```bash
grep -q '## Re-review Behavior' skills/peer-review/SKILL.md && echo "ok: peer-review doc"
grep -q 'marker\|Re-review' docs/peer-review-flowchart.md && echo "ok: flowchart .md"
grep -q 'Marker\|Re-review\|marker state' "review flowchart.txt" && echo "ok: flowchart .txt"
grep -q 'Re-review Test Cases' docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md && echo "ok: parity addendum"
```
Expected: every line `ok: ...`.

- [ ] **Step 5: No new files leaked**

Run:
```bash
git diff --name-status main..HEAD | awk '$1=="A"'
```
Expected: only `docs/superpowers/specs/2026-04-15-shipit-rereview-design.md` and `docs/superpowers/plans/2026-04-15-shipit-rereview.md`. No new agent or skill files (feature is purely additive to existing ones).

- [ ] **Step 6: No commit. Task 11 is read-only verification.**

If any line in Steps 1–5 prints `MISS:` or unexpected output, report it as a Concern. Do not try to fix inside Task 11 — escalate back to the controller.

---

## Post-Implementation Notes

- **Phase 2 parity test** — run R1 through R6 from Task 10 on real MRs before considering this feature stable. Requires a project where you can push commits to an MR without side effects.
- **Default state** — `rereview_enabled` ships as `true`. But the main engine still defaults to `pr-review-toolkit`, so re-review stays dormant until a user flips `peer_review.engine` to `"shipit-review"`. No user-visible impact at merge time.
- **Future enhancements** (not this plan):
  - Multi-threshold escalation (`escalation_thresholds: {"CRITICAL": [3, 6, 10]}`).
  - Optional: Mandatory CRITICAL second-pass (deferred from earlier discussions).
  - Cleanup plan: once stable for two releases, delete the `rereview_enabled` flag and `peer_review.engine == "pr-review-toolkit"` path together.
