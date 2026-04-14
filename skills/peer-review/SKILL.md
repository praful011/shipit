---
name: peer-review
description: End-to-end peer review workflow — Jira or GitLab-native MR selection, code review, comments, approval, pattern learning, and issue tracking
---

# Peer Review

## Purpose

Automate the peer review workflow with two entry paths: **Jira flow** (tickets in "Peer Review" status → extract MR) or **GitLab flow** (MRs assigned to you directly). Both paths converge at automated code review with GitLab comments, approval/rejection, pattern learning on the MR's source branch, and automatic GitLab issue creation for critical findings.

## Prerequisites

| Dependency | Required | Description |
|-----------|----------|-------------|
| Jira MCP (Atlassian) | For Jira flow | Must be configured with access to the Jira project containing peer review tickets |
| GitLab MCP | Yes | Must be configured with access to fetch MRs, post comments, approve/reject, and create issues |
| `shipit:shipit-review` (new) or `pr-review-toolkit:review-pr` (legacy) | Yes | Review engine. Selected by `peer_review.engine` in `.shipit/config.json`. Default is `pr-review-toolkit` during Phase 1; flips to `shipit-review` after parity verification. |

## Workflow Overview

```
User invokes /shipit:peer-review
        |
        v
[1] Choose review source: Jira or GitLab
        |
    ----+----
    |        |
    v        v
 [JIRA]   [GITLAB]
    |        |
    v        v
[2] Fetch   [2] Fetch MRs
 tickets     assigned to me
    |        |
    v        v
[3] User selects ticket/MR
        |
        v
[4] Extract MR URL (Jira: fields → remote links → description → comments)
        |
        v
[5] git fetch origin (HARD GATE — blocks on failure)
        |
        v
[6] Spawn shipit-peer-reviewer agent (with MR source branch)
        |
        v
[7] Agent fetches MR diff via GitLab API (primary source of truth)
        |
        v
[8] Agent runs Skill("shipit:shipit-review", ...) OR /pr-review-toolkit:review-pr (by config)
        |
        v
[9] Agent posts review comments on GitLab MR
        |
        v
[10] Agent approves MR or requests changes
        |
        v
[11] Extract patterns → commit on MR source branch → push (best-effort)
        |
        v
[12] Create GitLab issues for CRITICAL findings (best-effort)
        |
        v
[13] Summary returned to user
```

## Review Mode Selection

When `peer_review.ask_mode_each_run` is `true` (the default), Step 5.5 of `/shipit:peer-review` prompts the user to choose a review mode before spawning the reviewer agent. This allows per-run control over depth vs. speed.

| Mode | Behavior | Approximate Time |
|------|----------|-----------------|
| `efficiency` | Single-pass review; fastest; good for small or low-risk diffs | Fast |
| `balanced` | Standard multi-specialist pass; recommended for most MRs | Moderate |
| `depth` | Full six-specialist deep review; highest signal; best for complex or security-sensitive changes | Slower |

When `peer_review.ask_mode_each_run` is `false`, the mode is read silently from `peer_review.default_mode` in `.shipit/config.json` and the user is not prompted.

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

## MCP Dependencies

### Jira MCP Tools (Jira flow only)

| Tool | Used In | Purpose |
|------|---------|---------|
| `searchJiraIssuesUsingJql` | Command (Step 3J) | Fetch tickets where `status = "Peer Review"` |
| `getJiraIssue` | Command (Step 6J) | Get full ticket details to extract MR URL |
| `getJiraIssueRemoteIssueLinks` | Command (Step 6J, fallback) | Find MR URL in remote links if not in custom field |
| Comment scanning | Command (Step 6J, fallback) | Scan issue comments for MR URLs if not in description |

### GitLab MCP Tools

| Tool | Used In | Purpose |
|------|---------|---------|
| `list_merge_requests` | Command (Step 3G) | Fetch MRs assigned to user (GitLab flow) |
| `get_merge_request_details` | Command (Step 8) | Get MR source branch for pattern commits |
| MR fetch | Agent (Step 2) | Get merge request metadata and diff |
| MR comment | Agent (Step 5) | Post review summary and inline comments |
| MR approve | Agent (Step 6) | Approve the merge request when review passes |
| `create_issue` | Agent (Step 6.6) | Create GitLab issues for CRITICAL findings |

## Branch Sync Gate

Before spawning the reviewer agent, the command runs `git fetch origin` as a **hard gate**. This ensures:

- Local remote tracking refs are fresh (for context reads around MR changes)
- The GitLab API diff (primary source of truth) is complemented by up-to-date local state
- Zero risk to working tree — `git fetch` only updates remote tracking refs

If the fetch fails (network, auth), the workflow stops and informs the user. Reviews cannot proceed with potentially stale remote state.

## Learning Loop — Project-Specific Pattern Extraction

After each review, the agent extracts CRITICAL and IMPORTANT findings into a skill file **in the reviewed project's repo** at `.claude/skills/pr-review-patterns/SKILL.md`. This creates a feedback loop where Claude learns from review findings and avoids repeating the same mistakes.

### How It Works

1. Filter review results to CRITICAL + IMPORTANT severity only
2. Generalize each finding (remove MR-specific details like file names, variable names)
3. Read existing skill file in the project repo (create from template if missing)
4. Deduplicate against ALL existing entries (cross-reviewer — handles multiple reviewers)
5. Append only genuinely new patterns
6. Enforce 30-entry cap (CRITICAL priority over IMPORTANT)
7. Switch to MR source branch, commit, and push (patterns flow into target branch via MR)

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Skills in project repo (not shipit) | Claude reads them automatically when working on that project |
| Cross-reviewer dedup | Multiple reviewers may find similar issues across different MRs |
| Best-effort only | Pattern extraction failures must never block review completion |
| Commit on MR source branch + push | Patterns merge with target branch (e.g., dev) when MR is merged, not stranded on reviewer's branch |
| 30-entry cap | Prevents unbounded growth; CRITICAL entries take priority |
| GitLab issues for CRITICAL | Formal tracking for critical issues ensures they can't be missed or forgotten |

## Components

### Command: `/shipit:peer-review`

- **File:** `commands/peer-review.md`
- **Role:** Entry point. Handles Jira interaction (ticket listing, user selection, MR URL extraction) and spawns the reviewer agent.
- **User interaction:** Displays ticket list, asks user to select one.

### Agent: `shipit-peer-reviewer`

- **File:** `agents/shipit-peer-reviewer.md`
- **Role:** Performs the actual code review. Fetches MR from GitLab, runs the review toolkit, posts comments, and approves or requests changes.
- **Input:** MR URL, Jira ticket key, ticket summary, MR source branch, MR target branch, GitLab project path.
- **Output:** Structured review result with verdict, issues found, actions taken, pattern commit status, and GitLab issues created.

## Integration Points

| System | Integration |
|--------|-------------|
| **Jira** | Reads tickets in "Peer Review" status; extracts MR URLs from custom fields, remote links, description, or comments |
| **GitLab** | Lists MRs assigned for review; fetches MR diffs; posts review comments; approves or requests changes; creates issues for CRITICAL findings |
| **shipit-review** (new) | First-party review engine. Orchestrates six specialists (correctness, security, performance, error-handling, test, intent) across three modes (efficiency/balanced/depth). |
| **pr-review-toolkit** (legacy, still supported) | External review engine kept live via `peer_review.engine = "pr-review-toolkit"` during Phase 1 rollout. |
| **ShipIt ecosystem** | Follows ShipIt command/agent patterns; can be invoked alongside other ShipIt commands |

## Review Outcome Criteria

| Verdict | Condition |
|---------|-----------|
| **APPROVE** | No CRITICAL issues, no IMPORTANT issues |
| **REQUEST CHANGES** | Any CRITICAL issue, or 2+ IMPORTANT issues, or 1 IMPORTANT issue affecting functionality/security |

## Error Handling

The workflow handles these failure modes:
- No tickets in "Peer Review" status — informs user, stops
- No MR URL on selected ticket — informs user, stops
- `git fetch origin` fails — blocks review, informs user (hard gate)
- GitLab MR not found or inaccessible — returns error to user
- MR already merged or closed — warns user, skips approval action
- Review toolkit failure — falls back to manual diff review patterns
- Pattern extraction failure — logs warning, continues (best-effort, never blocks review)
- Branch checkout failure (dirty working tree) — skips pattern commit, continues
- GitLab issue creation failure — logs warning, continues (best-effort)
