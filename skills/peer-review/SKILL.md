---
name: peer-review
description: End-to-end peer review workflow — Jira ticket selection to GitLab MR review, comments, and approval
---

# Peer Review

## Purpose

Automate the peer review workflow from Jira to GitLab. This skill connects the Jira ticketing system with GitLab merge request reviews, enabling a streamlined process where developers can select a ticket in "Peer Review" status and have an automated code review performed on the associated merge request.

## Prerequisites

| Dependency | Required | Description |
|-----------|----------|-------------|
| Jira MCP (Atlassian) | Yes | Must be configured with access to the Jira project containing peer review tickets |
| GitLab MCP | Yes | Must be configured with access to fetch MRs, post comments, and approve/reject |
| `/pr-review-toolkit:review-pr` | Yes | Existing code review skill used as the review engine |

## Workflow Overview

```
User invokes /shipit:peer-review
        |
        v
[1] Fetch Jira tickets (status = "Peer Review")
        |
        v
[2] Display numbered ticket list
        |
        v
[3] User selects ticket
        |
        v
[4] Extract MR URL from Jira ticket
        |
        v
[5] git fetch origin (HARD GATE — blocks on failure)
        |
        v
[6] Spawn shipit-peer-reviewer agent
        |
        v
[7] Agent fetches MR diff via GitLab API (primary source of truth)
        |
        v
[8] Agent runs /pr-review-toolkit:review-pr
        |
        v
[9] Agent posts review comments on GitLab MR
        |
        v
[10] Agent approves MR or requests changes
        |
        v
[11] Extract patterns to project skill file (best-effort)
        |
        v
[12] Summary returned to user
```

## MCP Dependencies

### Jira MCP Tools

| Tool | Used In | Purpose |
|------|---------|---------|
| `searchJiraIssuesUsingJql` | Command (Step 2) | Fetch tickets where `status = "Peer Review"` |
| `getJiraIssue` | Command (Step 5) | Get full ticket details to extract MR URL |
| `getJiraIssueRemoteIssueLinks` | Command (Step 5, fallback) | Find MR URL in remote links if not in custom field |

### GitLab MCP Tools

| Tool | Used In | Purpose |
|------|---------|---------|
| MR fetch | Agent (Step 2) | Get merge request metadata and diff |
| MR comment | Agent (Step 5) | Post review summary and inline comments |
| MR approve | Agent (Step 6) | Approve the merge request when review passes |

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
7. Commit locally (user pushes when ready)

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Skills in project repo (not shipit) | Claude reads them automatically when working on that project |
| Cross-reviewer dedup | Multiple reviewers may find similar issues across different MRs |
| Best-effort only | Pattern extraction failures must never block review completion |
| Local commit only | User controls when patterns are shared with the team |
| 30-entry cap | Prevents unbounded growth; CRITICAL entries take priority |

## Components

### Command: `/shipit:peer-review`

- **File:** `commands/peer-review.md`
- **Role:** Entry point. Handles Jira interaction (ticket listing, user selection, MR URL extraction) and spawns the reviewer agent.
- **User interaction:** Displays ticket list, asks user to select one.

### Agent: `shipit-peer-reviewer`

- **File:** `agents/shipit-peer-reviewer.md`
- **Role:** Performs the actual code review. Fetches MR from GitLab, runs the review toolkit, posts comments, and approves or requests changes.
- **Input:** MR URL, Jira ticket key, ticket summary.
- **Output:** Structured review result with verdict, issues found, and actions taken.

## Integration Points

| System | Integration |
|--------|-------------|
| **Jira** | Reads tickets in "Peer Review" status; extracts MR URLs from custom fields or remote links |
| **GitLab** | Fetches MR diffs; posts review comments; approves or requests changes |
| **pr-review-toolkit** | Provides the code review engine (security, quality, patterns, testing checks) |
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
