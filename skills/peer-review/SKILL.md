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
[5] Spawn shipit-peer-reviewer agent
        |
        v
[6] Agent fetches MR diff via GitLab MCP
        |
        v
[7] Agent runs /pr-review-toolkit:review-pr
        |
        v
[8] Agent posts review comments on GitLab MR
        |
        v
[9] Agent approves MR or requests changes
        |
        v
[10] Summary returned to user
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
- GitLab MR not found or inaccessible — returns error to user
- MR already merged or closed — warns user, skips approval action
- Review toolkit failure — falls back to manual diff review patterns
