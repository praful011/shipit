---
name: shipit-review
description: ShipIt internal peer-review engine — orchestrates six specialists (correctness, security, performance, error-handling, test, intent) across three user-selectable modes (efficiency, balanced, depth) and returns a structured JSON finding list for shipit-peer-reviewer to post, categorize, and act on.
---

# ShipIt Review Engine

## Purpose

The review engine called by `shipit-peer-reviewer` at Step 3. Replaces the external `pr-review-toolkit:review-pr` skill with a first-party implementation. Only Step 3 of the peer-review flow changes — Jira/GitLab listing, selection, comment posting, approval, worktree-based pattern commits, and GitLab-issue creation all remain owned by the peer-reviewer agent.

## Prerequisites

| Dependency | Required | Notes |
|---|---|---|
| GitLab MCP | Yes | `shipit-peer-reviewer` has already used it to fetch the MR metadata + diff before calling this skill |
| Rule-pack files | Yes | `skills/shipit-review-rules/security.md`, `performance.md`, `error-handling.md` |
| Specialist agents | Yes | `shipit-correctness-reviewer`, `shipit-security-reviewer`, `shipit-performance-reviewer`, `shipit-error-handling-reviewer`, `shipit-test-reviewer`, `shipit-intent-reviewer` |

## Input

The caller (`shipit-peer-reviewer`) invokes this skill with:

```json
{
  "mode": "efficiency|balanced|depth",
  "mr": { "url": "...", "iid": "...", "title": "...", "description": "...",
          "source_branch": "...", "target_branch": "...", "is_draft": false, "author": "..." },
  "ticket": { "key": "PROJ-123", "summary": "...", "description": "..." },
  "raw_diff": "<unified diff text from GitLab MCP>",
  "project_path": "<absolute path to reviewed repo>",
  "source_branch": "<MR source branch>"
}
```

## Process

### 1. Pre-process

1. **Parse the diff.** Split into per-file hunks. Tag each file with a language (from extension: `.ts`/`.tsx` → ts, `.py` → py, `.go` → go, `.rs` → rust, etc.).
2. **Skip non-review files.** Exclude lockfiles (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `poetry.lock`, `pnpm-lock.yaml`), generated files (`dist/`, `build/`, `*.pb.go`), vendored dirs (`node_modules/`, `vendor/`), and binary files. Record them in `skipped_files`.
3. **Apply PR compression** if total retained-diff size exceeds the token budget (threshold: ≥ 80 000 characters of diff text):
   - Sort retained files by importance: source > config/schema > tests > docs.
   - Chunk any single file whose own diff exceeds 20 000 characters into ≤ 20 000-char chunks, marking `truncated: true` on any chunks that get dropped past budget.
4. **Load project context.**
   - Read `<project_path>/CLAUDE.md` if present; capture ≤ 2 000 characters as `claude_md_excerpt`.
   - Read `<project_path>/.claude/skills/pr-review-patterns/SKILL.md` if present; parse rule entries; write them into `project.learned_rules`.
   - Resolve the three shipped rule-pack paths: `skills/shipit-review-rules/security.md`, `performance.md`, `error-handling.md`. Pass the absolute paths as `project.shipped_rules_refs`.
5. **Synthesize `intent_summary`.** 2–4 sentences merging: `ticket.summary` + `ticket.description` + `mr.title` + `mr.description`. State what the author intends to change and why.

### 2. Dispatch specialists in parallel

Spawn six `Agent` calls in a single tool-call block (so they run concurrently):

- `Agent(subagent_type: "shipit-correctness-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-security-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-performance-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-error-handling-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-test-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-intent-reviewer", prompt: <bundle JSON>)`

The bundle JSON is the exact shape specified in each specialist's `<input>` section. Every specialist receives the same bundle with the same `mode`.

### 3. Depth-mode cross-pass

If `mode == "depth"`, after the six specialists return:

1. Concatenate all specialist findings into one list.
2. Build a randomized-chunk-order version of the diff: take the retained files, shuffle file order, and re-linearize the hunks.
3. Spawn one more `Agent(subagent_type: "general-purpose", prompt: <aggregator prompt>)` that receives the randomized-order diff and the combined findings list. Instruct it to:
   - Identify findings that should be dropped (duplicates, disproven).
   - Identify findings that were missed and should be added.
   - Return a `{ added: [...], dropped_pattern_keys: [...] }` JSON object.
4. Apply the aggregator's adds/drops.

### 4. Aggregate

1. **Dedup** across specialists: collapse findings with the same `(file, line_start, line_end, pattern_key)` tuple. Keep the highest-confidence copy. If they disagree on severity, keep the highest.
2. **Bucket** by severity into `critical`, `important`, `minor`.
3. **Rank within each bucket** by confidence (HIGH > MEDIUM > LOW), then by dimension order (Security > Correctness > Error Handling > Performance > Testing > Intent > Patterns).
4. **Compute `verdict_hint`:**
   - Any CRITICAL → `REQUEST_CHANGES`
   - Else 2+ IMPORTANT → `REQUEST_CHANGES`
   - Else 1 IMPORTANT of category Security or Correctness → `REQUEST_CHANGES`
   - Else → `APPROVE`
5. **Compose `summary`:** 2–3 sentences naming the most significant findings and overall code quality.

### 5. Return

Return a single JSON object:

```json
{
  "verdict_hint": "APPROVE | REQUEST_CHANGES",
  "critical": [ <finding>, ... ],
  "important": [ <finding>, ... ],
  "minor": [ <finding>, ... ],
  "summary": "<2–3 sentence overview>"
}
```

Every `<finding>` preserves the specialist's output schema fields (`severity`, `category`, `pattern_key`, `file`, `line_start`, `line_end`, `description`, `prevention`, `fail_snippet`, `pass_snippet`, `confidence`).

## Error Handling

| Error | Response |
|---|---|
| A specialist returns invalid JSON | Retry once with a stricter prompt. If still invalid, treat as empty findings and include a MINOR finding `pattern_key: "specialist-output-malformed"` naming which specialist. |
| A specialist times out | Treat as empty findings; include a MINOR finding `pattern_key: "specialist-timeout"`. |
| Depth-mode aggregator fails | Skip the cross-pass (falls back to balanced behavior). Include a MINOR finding `pattern_key: "depth-aggregator-skipped"`. |
| PR compression cannot fit within budget | Review the highest-importance chunks only; include a MINOR finding `pattern_key: "review-truncated-by-compression"` noting which files were skipped. |

## Success Criteria

- [ ] All six specialists were spawned in parallel
- [ ] Depth mode ran the aggregator; other modes did not
- [ ] Findings deduped by `(file, line_start, line_end, pattern_key)` tuple
- [ ] `verdict_hint` computed via the fixed rubric
- [ ] Output is a single valid JSON object matching the schema above
