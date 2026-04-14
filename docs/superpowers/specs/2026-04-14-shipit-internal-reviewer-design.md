# ShipIt Internal Reviewer — Design Spec

**Date:** 2026-04-14
**Status:** Approved for implementation planning
**Scope:** Peer-review flow only (`/shipit:peer-review` → `shipit-peer-reviewer`). Per-task `shipit-reviewer` used by `/shipit:go` is **out of scope** for this spec.

---

## 1. Problem

`shipit-peer-reviewer` currently delegates its code review step to an external plugin via `Skill("pr-review-toolkit:review-pr", <MR_URL>)`. This creates a hard dependency on a plugin ShipIt does not own and cannot evolve. We want ShipIt to own the review engine end-to-end.

## 2. Goals

1. Remove the `pr-review-toolkit` dependency from the peer-review flow.
2. Ship a first-party review engine (`shipit-review`) that matches or exceeds current quality.
3. Preserve byte-for-byte the surrounding workflow (GitLab fetch, categorization, comment posting, approval, worktree-based pattern commits, GitLab-issue creation for CRITICAL findings).
4. Offer three explicit quality/cost modes the user chooses at review time.
5. Incorporate market-validated techniques (intent inference, codebase-awareness, self-challenge, rule packs with FAIL/PASS examples).
6. Make the learned-patterns skill (`pr-review-patterns`) sharper — concrete examples, deterministic dedup, per-category caps, aging.

## 3. Non-goals

- Replacing `shipit-reviewer` (per-task reviewer used by `/shipit:go`).
- Building a codebase-indexing/code-graph system (Greptile-style). Too much infra for a doc-only plugin.
- Auto-learning custom rules from past human review comments on GitLab.
- Determinism guarantees, finding fingerprints, or incremental re-review. Explicitly out of scope for this spec.
- Running project validation (typecheck/lint/test) during review.
- Adding verdict values beyond `APPROVE` / `REQUEST CHANGES` / `COMMENTS_ONLY` (the last one only for draft MRs).

## 4. Blast radius — what changes vs. what is preserved

Only **Step 3** of `shipit-peer-reviewer` changes. Every other step is untouched.

| Phase in `shipit-peer-reviewer` | Change |
|---|---|
| Step 1 — Parse MR URL | no change |
| Step 2 — Fetch MR metadata + diff via GitLab MCP | no change |
| **Step 3 — Run code review** | **CHANGED** — `Skill("pr-review-toolkit:review-pr", <MR_URL>)` → `Skill("shipit:shipit-review", {mode, diff, mr_title, mr_description, ticket_context, project_path, source_branch, is_draft})` |
| Step 4 — Categorize APPROVE / REQUEST CHANGES | thresholds unchanged; **add** `COMMENTS_ONLY` branch when `is_draft === true` |
| Step 5 — Post summary + inline comments on MR | no change |
| Step 6 — Approve or request changes | skipped when verdict is `COMMENTS_ONLY` |
| Step 6.5 — Pattern extraction → worktree → commit → push to MR source branch | behavior unchanged; **learned skill format upgraded** (see section 9) |
| Step 6.6 — Create GitLab issues for CRITICAL findings | no change |
| Step 7 — Return structured summary | no change |

Safety properties preserved:
- `/tmp/shipit-peer-review-<ts>` worktree isolation — reviewer's working directory is never touched.
- "Only SKILL.md staged" hard guard in Step 6.5.
- MR-already-merged pre-check skips the whole worktree flow.
- Pattern commit lands on MR source branch, flows into target branch via the MR merge.
- GitLab issue creation uses same labels (`peer-review,critical,bug`).

## 5. User-facing change

**Unchanged pre-review automation.** Everything that happens *before* the review itself stays exactly as today:

| Pre-review step | Status |
|---|---|
| Choose review source (Jira flow vs. GitLab flow) | no change |
| Jira — fetch tickets in "Peer Review" status (JQL via Atlassian MCP) | no change |
| Jira — present ticket list, user selects one | no change |
| Jira — extract MR URL (custom field → remote links → description → comments) | no change |
| GitLab — list MRs assigned to reviewer (GitLab MCP) | no change |
| GitLab — present MR list, user selects one | no change |
| `git fetch origin` hard gate | no change |

The **only** new pre-review step is the mode selector, which runs **after** the MR URL is identified and the git-fetch gate passes, **just before** spawning `shipit-peer-reviewer`.

### Mode selector (only new user-facing prompt)

`/shipit:peer-review` asks which review mode to use immediately before spawning the reviewer:

```
Review mode for this MR:
  [1] efficiency — fastest, lowest cost (~30–60s)
  [2] balanced   — specialists self-challenge before reporting (~1–2m, recommended)
  [3] depth      — balanced + randomized cross-pass for highest catch rate (~2–4m)
```

Default: `balanced`. The chosen mode is passed to `shipit-peer-reviewer` and on into `shipit-review`. If `peer_review.ask_mode_each_run` is `false` in `.shipit/config.json` (see section 11), the command skips the prompt and uses `peer_review.default_mode` directly.

## 6. `shipit-review` — architecture (Structure Y)

### 6.1 Files to add

```
skills/shipit-review/SKILL.md                         # orchestration + aggregation + output schema
skills/shipit-review-rules/SKILL.md                   # rule-pack companion (shared with learned patterns)
skills/shipit-review-rules/security.md                # FAIL/PASS pattern pairs for security
skills/shipit-review-rules/performance.md             # FAIL/PASS pattern pairs for performance
skills/shipit-review-rules/error-handling.md          # FAIL/PASS pattern pairs for error handling

agents/shipit-correctness-reviewer.md                 # specialist 1
agents/shipit-security-reviewer.md                    # specialist 2
agents/shipit-performance-reviewer.md                 # specialist 3
agents/shipit-error-handling-reviewer.md              # specialist 4
agents/shipit-test-reviewer.md                        # specialist 5
agents/shipit-intent-reviewer.md                      # specialist 6
```

### 6.2 Six specialists

| Specialist | What it catches |
|---|---|
| `shipit-correctness-reviewer` | logic bugs, off-by-one, null refs, edge cases, copy-paste mistakes, wrong conditionals, dead branches |
| `shipit-security-reviewer` | secrets, injection (SQL, command, template), auth/authz bypass, path traversal, unsafe deserialization, XSS, SSRF |
| `shipit-performance-reviewer` | N+1 queries, blocking I/O on hot path, unbounded loops, missing indexes, expensive re-renders |
| `shipit-error-handling-reviewer` | swallowed errors, empty catch, misused fallbacks, unhandled promise rejections, silent-drop-then-continue |
| `shipit-test-reviewer` | is new logic tested, test quality, missing edge-case coverage, flaky patterns, mocked-over-integration concerns |
| `shipit-intent-reviewer` | does the diff match the stated intent (Jira ticket + MR description)? scope creep; over-broad changes |

Each specialist:
- Is its own agent file with `name`, `description`, `<role>`, `<process>`, `<output_format>` XML sections.
- Is spawned via `Agent(subagent_type: "shipit-<dimension>-reviewer", prompt: ...)` by the `shipit-review` skill.
- Receives the same input bundle (see 6.4) and returns the same output schema (see 6.5).

### 6.3 Three modes

| Mode | Behavior | Target cost/time |
|---|---|---|
| `efficiency` | 6 specialists spawned in parallel; each runs one LLM call; no self-challenge; no cross-pass. | ~30–60s |
| `balanced` *(default)* | 6 specialists spawned in parallel; each specialist's prompt includes an internal self-challenge block ("pick your top findings, try to disprove each, drop the ones you can't confirm") before returning. | ~1–2m |
| `depth` | `balanced` + one additional aggregator pass: a 7th agent call receives the diff in randomized chunk order together with all specialists' findings and looks for gaps / confirms hypotheses. May add or drop findings. | ~2–4m |

Mode is passed as a parameter to every specialist so each can toggle its self-challenge block.

### 6.4 Specialist input bundle

Every specialist receives the same structured input:

```json
{
  "mode": "efficiency|balanced|depth",
  "mr": {
    "url": "...",
    "iid": "...",
    "title": "...",
    "description": "...",
    "source_branch": "...",
    "target_branch": "...",
    "is_draft": false,
    "author": "..."
  },
  "ticket": {
    "key": "PROJ-123",
    "summary": "...",
    "description": "..."
  },
  "diff": {
    "compressed": true,
    "files": [
      { "path": "...", "language": "ts", "hunks": [...], "truncated": false }
    ],
    "skipped_files": [
      { "path": "package-lock.json", "reason": "lockfile" }
    ]
  },
  "intent_summary": "2-4 sentence synthesis of ticket + MR title + MR description",
  "project": {
    "path": "...",
    "claude_md_excerpt": "...",
    "learned_rules": [ ... ],   // from .claude/skills/pr-review-patterns/SKILL.md
    "shipped_rules_refs": [ "skills/shipit-review-rules/security.md", ... ]
  }
}
```

### 6.5 Specialist output schema

Every specialist returns a JSON list of findings:

```json
{
  "specialist": "shipit-security-reviewer",
  "findings": [
    {
      "severity": "CRITICAL | IMPORTANT | MINOR",
      "category": "Security | Correctness | Performance | Error Handling | Testing | Patterns | Intent",
      "pattern_key": "sql-injection-via-string-concat",  // stable snake-case tag
      "file": "api/users.py",
      "line_start": 42,
      "line_end": 46,
      "description": "<concise prose of the issue>",
      "prevention": "<concrete actionable rule>",
      "fail_snippet": "<code excerpt showing the issue>",
      "pass_snippet": "<code excerpt showing correct form>",
      "confidence": "HIGH | MEDIUM | LOW"
    }
  ]
}
```

`pattern_key` is required. It is a stable canonical tag chosen from:
1. The rule-pack skill (`skills/shipit-review-rules/`), or
2. The learned-patterns skill (`.claude/skills/pr-review-patterns/`), or
3. Generated by the specialist in the form `<category-short>-<short-description>` (snake-case) if no existing rule matches.

### 6.6 Severity rubric (unchanged from today's Step 4)

| Severity | Definition |
|---|---|
| **CRITICAL** | security vuln, data loss/corruption, definite bug with user impact, broken auth |
| **IMPORTANT** | probable bug, missing tests on risky logic, perf issue that will bite in production, silent failure |
| **MINOR** | nit, style, non-blocking suggestion |

Step 4's thresholds apply unchanged: any CRITICAL, or 2+ IMPORTANT, or 1 IMPORTANT affecting functionality/security → `REQUEST CHANGES`; otherwise `APPROVE` (or `COMMENTS_ONLY` when `is_draft`).

### 6.7 Orchestration — `skills/shipit-review/SKILL.md`

The skill content, when invoked, instructs the calling agent (`shipit-peer-reviewer`) to:

1. **Pre-process:**
   - Load all three rule-pack category files from `skills/shipit-review-rules/` (security, performance, error-handling).
   - Load `CLAUDE.md` excerpt from project.
   - Load `.claude/skills/pr-review-patterns/SKILL.md` if present.
   - Synthesize `intent_summary` from ticket + MR title/description.
   - Apply PR compression if diff exceeds token budget: sort files by importance (source > config > tests > docs; skip lockfiles + generated files + vendored dirs), chunk large files.
2. **Dispatch specialists in parallel:** six `Agent` calls, one per specialist, each receiving the input bundle (6.4) with the chosen `mode`.
3. **If `mode == depth`:** after specialists return, spawn one aggregator `Agent` call with diff in randomized chunk order + all specialist findings; it returns an amended finding list.
4. **Aggregate:**
   - Dedup by `(file, line_start, line_end, pattern_key)` tuple.
   - Rank by severity, then by confidence, then by dimension.
5. **Return** a JSON object:
   ```json
   {
     "verdict_hint": "APPROVE | REQUEST_CHANGES",
     "critical": [...],
     "important": [...],
     "minor": [...],
     "summary": "<2–3 sentence overall summary>"
   }
   ```
   The shape matches what Step 4/5/6.5/6.6 of `shipit-peer-reviewer` already consume.

## 7. Draft-MR rule

New branch in Step 4 of `shipit-peer-reviewer`:

- If `mr.is_draft === true`:
  - Verdict becomes `COMMENTS_ONLY`.
  - Step 5 runs (post summary + inline comments).
  - Step 6 is **skipped** (no approve, no request-changes action on GitLab).
  - Step 6.5 (pattern extraction) still runs — patterns remain valuable regardless of MR state.
  - Step 6.6 (GitLab issues for CRITICAL) still runs.

## 8. Rule-pack skill — `skills/shipit-review-rules/`

Shared source of truth for both shipped rules and learned rules. All rules use one entry format:

```markdown
### <pattern_key>  — <short title>
**Category:** Security | Correctness | Performance | Error Handling | Testing | Patterns | Intent
**Severity:** CRITICAL | IMPORTANT | MINOR
**Why it matters:** <1–2 sentences>
**Detection heuristic:** <what a reviewer looks for in the diff>

**FAIL**
```<lang>
<code snippet showing the anti-pattern>
```

**PASS**
```<lang>
<code snippet showing the fix>
```
```

Three shipped category files cover universal cross-language patterns: `security.md` (injection, auth, secrets, XSS, SSRF), `performance.md` (N+1, blocking I/O, unbounded loops), and `error-handling.md` (swallowed errors, empty catch, misused fallbacks). **Language-specific footgun packs are deliberately not shipped** — modern Claude has strong baseline knowledge of language idioms, and adding static rule files would duplicate that knowledge and rot. Project-specific language rules emerge naturally through the learned-patterns skill (section 9) when a real review catches one. If a systemic language-specific gap appears in Phase 2 parity testing, add targeted rules as a followup.

## 9. Learned-patterns skill upgrades — `.claude/skills/pr-review-patterns/SKILL.md`

Six improvements applied to Step 6.5 of `shipit-peer-reviewer`:

1. **Same entry format as the rule-pack skill** (section 8). Each learned pattern has `pattern_key`, `category`, `severity`, `why`, `detection heuristic`, `FAIL`, `PASS`. Replace the current prose-only `_Pattern:_ / _Prevention:_` format.
2. **Per-category caps** (total still ~30 but distributed):
   - Security: 10
   - Error Handling: 8
   - Performance: 6
   - Patterns: 4
   - Testing: 4
3. **Metadata per entry** — `created_date`, `applied_count`, `last_matched_date`. Pattern is evicted if `applied_count == 0` and `created_date > 20 reviews ago` (tracked via a rolling review counter in the skill file header), OR if `last_matched_date > 90 days ago` and `applied_count < 3`.
4. **`pattern_key`-based dedup** — dedup is a string match on `pattern_key`. No LLM-judgment ">80% semantic overlap" logic. If a new finding collides with an existing key, increment `applied_count` and update `last_matched_date` instead of adding a new entry.
5. **Consolidation pass** — if 3+ entries share a common prefix in `pattern_key` (e.g., `sql-injection-*`), the extraction step proposes a merged, more general rule with multiple FAIL snippets.
6. **File-path hints in `detection heuristic`** — when a pattern is language- or framework-specific, authors can mention it in the `detection heuristic` field (e.g., "in Python files only" or "when the diff touches `requirements.txt`"). No structured `languages` field is needed — the reviewer reads the heuristic and applies judgment.

These changes run inside Step 6.5's existing worktree commit — no new file ops, same HARD GUARD on "only SKILL.md staged", same commit + push flow, same best-effort failure handling.

## 10. Data flow (end-to-end, one MR)

```
/shipit:peer-review
      |
      v
(NEW) command prompts user for mode: efficiency / balanced / depth
      |
      v
spawn shipit-peer-reviewer(mr_url, ticket_info, mode, …)
      |
      v
[1] parse MR URL
[2] fetch MR metadata + diff + draft flag via GitLab MCP         [unchanged]
      |
      v
[3] (CHANGED) Skill("shipit:shipit-review", {mode, diff, mr, ticket, project_path})
        |
        +-- 3a pre-process: load rule packs (security / performance / error-handling),
        |        CLAUDE.md, learned patterns; synthesize intent; apply PR compression
        +-- 3b spawn 6 specialists in parallel
        +-- 3c (depth only) spawn 1 aggregator with randomized chunk order
        +-- 3d aggregate: dedup by (file, line, pattern_key); rank
        +-- 3e return { verdict_hint, critical[], important[], minor[], summary }
      |
      v
[4] (UPDATED) categorize:
     - if is_draft            -> COMMENTS_ONLY
     - elif any CRITICAL      -> REQUEST CHANGES
     - elif 2+ IMPORTANT      -> REQUEST CHANGES
     - elif 1 IMPORTANT
         affecting fn/sec     -> REQUEST CHANGES
     - else                   -> APPROVE
      |
      v
[5] post summary + inline comments on MR (GitLab MCP)            [unchanged]
      |
      v
[6] approve or request changes (GitLab MCP)                      [skipped if COMMENTS_ONLY]
      |
      v
[6.5] pattern extraction → worktree → commit → push              [upgraded format, same flow]
      |
      v
[6.6] create GitLab issues for each CRITICAL finding             [unchanged]
      |
      v
[7] return structured summary                                    [unchanged]
```

## 11. Configuration

Add to `.shipit/config.json`:

```json
{
  "peer_review": {
    "engine": "shipit-review",              // Phase 1: "pr-review-toolkit" default; Phase 3+: "shipit-review" default
    "default_mode": "balanced",             // efficiency | balanced | depth
    "ask_mode_each_run": true                // if false, skip the prompt and always use default_mode
  }
}
```

`engine` default transitions by rollout phase (see section 12): **Phase 1** default `"pr-review-toolkit"` — `shipit-peer-reviewer` branches on the flag with no user-facing change. **Phase 3** default flips to `"shipit-review"`. **Phase 4** the flag is removed entirely. Users can override the default at any time via `.shipit/config.json`.

## 12. Rollout plan

1. **Phase 1 — Build alongside.** Implement all new files (skill + rule-pack skill + 6 specialist agents + draft-MR rule + Step 6.5 format upgrade). Add `peer_review.engine` config flag (default `pr-review-toolkit`). `shipit-peer-reviewer` branches on the flag — no user-facing change.
2. **Phase 2 — Parity test.** Manually run both engines on at least 5 real MRs per mode (15 runs total). Compare findings; resolve any regressions.
3. **Phase 3 — Flip default.** Change config default to `shipit-review`. Keep the `pr-review-toolkit` code path one release for fallback.
4. **Phase 4 — Remove legacy.** Delete the `pr-review-toolkit` branch in `shipit-peer-reviewer` and the engine flag. `shipit-review` becomes the only engine.

## 13. Verification

**Structural (ShipIt is a doc-only project):**
- Frontmatter valid on every new file (`name`, `description`; `allowed-tools` on commands).
- All `Skill("shipit:shipit-review", …)` references resolve.
- All specialist `subagent_type` names match agent filenames.
- `shipit-peer-reviewer.md` success-criteria checklist updated for new Step 3 call and new `COMMENTS_ONLY` verdict.

**Behavioral (on real MRs):**
- ✅ Seeded MR with a known CRITICAL security finding → surfaces as CRITICAL and gets a GitLab issue.
- ✅ MR with only MINOR findings → APPROVE verdict, no GitLab issues, no pattern commit.
- ✅ Large diff (> token budget) → PR compression activates, review still completes.
- ✅ MR marked as draft → verdict `COMMENTS_ONLY`, no approval/rejection posted, patterns + GitLab issues still created.
- ✅ MR already merged → Step 6.5 worktree flow skipped (matches current behavior).
- ✅ Reviewer with dirty working tree → completely unaffected (worktree isolation preserved).
- ✅ Output JSON from Step 3 satisfies the shape expected by Step 4/5/6.5/6.6.
- ✅ Learned-patterns skill entries match the shared rule-pack format and dedup on `pattern_key`.

## 14. Open questions (resolved in conversation, recorded here)

| Question | Resolution |
|---|---|
| Does this replace `shipit-reviewer` (per-task) too? | No. Scope is peer-review only. |
| Multi-agent or single-agent architecture? | Multi-agent (6 specialists) + optional aggregator in depth mode. |
| Mode selection? | User picks at review time; default `balanced`. |
| Severity scale? | 3 levels (CRITICAL / IMPORTANT / MINOR). Keeping current to avoid reworking downstream thresholds. |
| Verdict set? | `APPROVE` / `REQUEST CHANGES` / `COMMENTS_ONLY` (new, for drafts). |
| Determinism / fingerprinting / incremental re-review? | Out of scope. |
| Fix-introduced regression handling? | Out of scope. |
| Language-specific reviewers or rule packs? | Neither shipped. Trust Claude's base knowledge of language idioms; learned-patterns skill captures project-specific language rules when they actually arise. |
| Validation phase (run tests/lint)? | Out of scope. |
| Learned-patterns format? | Upgrade to rule-pack format; `pattern_key`-based dedup; per-category caps; aging. |

## 15. Assumptions

- GitLab MCP tools (`get_merge_request_details`, comment posting, approval, `create_issue`) remain available as they are today.
- The `is_draft` flag is reliably returned by `get_merge_request_details`. (If not, the draft-MR rule no-ops and we fall back to existing behavior.)
- Specialists spawned via `Agent` with `subagent_type: "shipit-<dimension>-reviewer"` inherit enough context to read project files (CLAUDE.md, rule packs, learned patterns).
- Token budget per specialist is sufficient for the compressed diff + bundled context on typical MRs (≤ ~1500 changed lines). Oversized MRs rely on PR compression; very large MRs may degrade to warning + partial review.
