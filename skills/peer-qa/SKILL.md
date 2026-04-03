---
name: peer-qa
description: End-to-end peer QA workflow — Jira ticket selection, browser-based testing via Playwright/Puppeteer, screenshot evidence, Jira comments, ticket transition
---

# Peer QA

## Purpose

Automate the peer QA workflow with browser-based testing. Fetch Jira tickets in "Peer QA" status assigned to the current user, analyze the linked GitLab MR to understand what changed, generate test scenarios, execute them in a browser with screenshot capture, post all evidence to Jira, and transition the ticket based on the QA outcome.

## Prerequisites

| Dependency | Required | Description |
|-----------|----------|-------------|
| Jira MCP (Atlassian) | Yes | Must be configured with access to the Jira project containing peer QA tickets |
| GitLab MCP | Yes | Must be configured to fetch MR details and diffs |
| Browser MCP (Playwright or Puppeteer) | Yes | At least one browser automation MCP must be configured. Playwright preferred, Puppeteer as fallback. |

## Workflow Overview

```
User invokes /shipit:peer-qa
        |
        v
[1] Fetch Jira tickets (status = "Peer QA", assignee = currentUser())
        |
        v
[2] Display ticket list, user selects one
        |
        v
[3] Extract MR URL from ticket (fields → remote links → description → comments)
        |
        v
[4] Ask for target website URL (default: https://demo.outagemap.us/)
        |
        v
[5] Fetch MR details from GitLab (source branch, diff)
        |
        v
[6] Spawn shipit-peer-qa agent
        |
        v
[7] Agent analyzes MR diff + ticket description
        |
        v
[8] Agent generates test scenarios
        |
        v
[9] Agent detects browser MCP (HARD GATE — Playwright preferred, Puppeteer fallback)
        |
     available?
    /         \
  yes          no
   |            |
   |     [9b] Auto-setup Playwright
   |     (install + configure + verify)
   |            |
   |         works?
   |        /      \
   |      yes      no → BLOCKED (manual setup needed)
   |        |
   +--------+
        |
        v
[10] Agent executes each scenario in browser, captures screenshot per scenario
        |
        v
[11] Agent posts summary table + ALL screenshots as Jira comments
        |
        v
[12] Agent transitions Jira ticket (pass → forward, fail → backward)
        |
        v
[13] Agent cleans up temporary Playwright assets
        |
        v
[14] Summary returned to user
```

## MCP Dependencies

### Jira MCP Tools

| Tool | Used In | Purpose |
|------|---------|---------|
| `searchJiraIssuesUsingJql` | Command (Step 2) | Fetch tickets where `status = "Peer QA" AND assignee = currentUser()` |
| `getJiraIssue` | Command (Step 5), Agent (Step 2) | Get full ticket details, extract MR URL, read description |
| `getJiraIssueRemoteIssueLinks` | Command (Step 5, fallback) | Find MR URL in remote links if not in custom field |
| `addCommentToJiraIssue` | Agent (Step 6) | Post summary table and individual screenshot comments |
| `getTransitionsForJiraIssue` | Agent (Step 7) | Get available ticket transitions |
| `transitionJiraIssue` | Agent (Step 7) | Move ticket to next status based on QA result |

### GitLab MCP Tools

| Tool | Used In | Purpose |
|------|---------|---------|
| `get_merge_request_details` | Command (Step 7), Agent (Step 2) | Get MR metadata, source branch, diff |

### Browser MCP Tools (Playwright preferred)

| Tool | Used In | Purpose |
|------|---------|---------|
| `browser_navigate` | Agent (Step 5) | Navigate to target website URL |
| `browser_click` | Agent (Step 5) | Click elements during test execution |
| `browser_type` | Agent (Step 5) | Type into input fields |
| `browser_screenshot` | Agent (Step 5) | Capture screenshot per scenario (mandatory) |
| `browser_select_option` | Agent (Step 5) | Select dropdown options |
| `browser_hover` | Agent (Step 5) | Hover over elements |
| `browser_wait_for_selector` | Agent (Step 5) | Wait for elements to appear |
| `browser_evaluate` | Agent (Step 5) | Run JavaScript for complex checks |
| `browser_close` | Agent (Step 8) | Close browser after testing |

### Browser MCP Tools (Puppeteer fallback)

| Tool | Used In | Purpose |
|------|---------|---------|
| `puppeteer_navigate` | Agent (Step 5) | Navigate to target website URL |
| `puppeteer_click` | Agent (Step 5) | Click elements during test execution |
| `puppeteer_fill` | Agent (Step 5) | Fill input fields |
| `puppeteer_screenshot` | Agent (Step 5) | Capture screenshot per scenario |
| `puppeteer_evaluate` | Agent (Step 5) | Run JavaScript for complex checks |

## Components

### Command: `/shipit:peer-qa`

- **File:** `commands/peer-qa.md`
- **Role:** Entry point. Handles Jira interaction (ticket listing, user selection, MR URL extraction, website URL prompt) and spawns the QA agent.
- **User interaction:** Displays ticket list, asks user to select one, asks for website URL.

### Agent: `shipit-peer-qa`

- **File:** `agents/shipit-peer-qa.md`
- **Role:** Performs the actual QA testing. Analyzes MR changes, generates test scenarios, executes browser tests, captures screenshots, posts evidence to Jira, transitions ticket.
- **Input:** MR URL, Jira ticket key, ticket summary, MR source/target branch, GitLab project path, website URL.
- **Output:** Structured QA result with verdict, test results table, screenshots posted count, transition status.

## Integration Points

| System | Integration |
|--------|-------------|
| **Jira** | Reads tickets in "Peer QA" status; extracts MR URLs; posts QA results and screenshots as comments; transitions ticket status |
| **GitLab** | Fetches MR details and diffs to understand what changed |
| **Browser (Playwright/Puppeteer)** | Executes test scenarios in a real browser; captures screenshots as evidence |
| **ShipIt ecosystem** | Follows ShipIt command/agent patterns; can be invoked alongside other ShipIt commands |

## QA Outcome Criteria

| Verdict | Condition |
|---------|-----------|
| **PASS** | All test scenarios pass — ticket transitions forward |
| **FAIL** | Any test scenario fails — ticket transitions backward |

## Error Handling

The workflow handles these failure modes:
- No tickets in "Peer QA" status — informs user, stops
- No MR URL on selected ticket — informs user, stops
- GitLab MR not found or inaccessible — returns error to user
- No browser MCP available — returns error to user
- Website unreachable — returns error to user
- Browser navigation/interaction fails — marks scenario as FAIL, continues with remaining scenarios
- Screenshot capture fails — logs warning, continues testing
- Jira comment posting fails — logs warning, returns results in summary
- Jira transition fails — logs warning, asks user to manually transition
- MR already merged — proceeds with QA of deployed changes
