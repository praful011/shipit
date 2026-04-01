---
name: shipit:peer-review
description: Automate peer review — Jira-to-GitLab or GitLab-native. List tickets/MRs, select, review, post comments, approve/reject
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - Skill
  - AskUserQuestion
---

<objective>
Automate the peer review workflow. Supports two modes:
- **Jira flow:** Fetch Jira tickets in "Peer Review" status → extract MR URL → review
- **GitLab flow:** Fetch MRs assigned to you directly from GitLab → review

Both paths converge at MR review: spawn the peer-reviewer agent for full code review with GitLab comments and approval/rejection.
</objective>

<process>

## Step 1: Load Context

Read `./CLAUDE.md` if it exists. Follow all project-specific guidelines.

## Step 2: Choose Review Source

Use `AskUserQuestion` to ask the user where to find reviews:

```
AskUserQuestion(
  question: "Where would you like to find merge requests for review?",
  options: [
    { label: "Jira (Recommended)", description: "Fetch tickets in Peer Review status, extract MR links" },
    { label: "GitLab", description: "Fetch MRs assigned to you directly from GitLab" }
  ]
)
```

**If "GitLab":** Jump to Step 3G (GitLab flow).
**If "Jira":** Continue to Step 2J.

## Step 2J: Ask Jira Review Scope

Use `AskUserQuestion` to ask the user what tickets to fetch:

```
AskUserQuestion(
  question: "Which peer review tickets would you like to see?",
  options: [
    { label: "Only assigned to me (Recommended)", description: "Show only tickets where you are the reviewer/assignee" },
    { label: "All peer review tickets", description: "Show all tickets in Peer Review status from the project" }
  ]
)
```

## Step 3J: Fetch Peer Review Tickets from Jira

Based on the user's choice, build the JQL query:

**If "Only assigned to me":**
```
mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql(
  jql: 'status = "Peer Review" AND assignee = currentUser()',
  fields: ["summary", "assignee", "status", "customfield_*"]
)
```

**If "All peer review tickets":**
```
mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql(
  jql: 'status = "Peer Review"',
  fields: ["summary", "assignee", "status", "customfield_*"]
)
```

If no tickets are found, inform the user: "No tickets currently in Peer Review status." and stop.

## Step 4J: Display Ticket List

Format the results as a numbered list for the user:

```
## Peer Review Tickets

| # | Key | Summary | Assignee |
|---|-----|---------|----------|
| 1 | PROJ-123 | Add login feature | @developer |
| 2 | PROJ-456 | Fix search bug | @developer2 |
```

## Step 5J: User Selects Ticket

Use `AskUserQuestion` to ask the user which ticket to review:

```
AskUserQuestion(
  question: "Which ticket would you like to review? Enter the number from the list above.",
  options: ["1", "2", "3", ...]  // dynamic based on ticket count
)
```

Validate the selection is within range.

## Step 6J: Extract MR URL from Jira Ticket

Fetch the full ticket details to get the merge request URL:

```
mcp__claude_ai_Atlassian__getJiraIssue(
  issueKey: "<selected ticket key>"
)
```

Extract the MR URL from the ticket. Check these locations in order:
1. Custom field containing a GitLab MR URL (look for fields containing `gitlab` or `merge_request` URLs)
2. Remote issue links (`getJiraIssueRemoteIssueLinks`)
3. Issue description (scan for GitLab MR URLs matching `https://.*/merge_requests/\d+`)
4. **Issue comments** — If not found above, fetch all comments and scan for MR URLs:
   ```
   mcp__claude_ai_Atlassian__getJiraIssue(
     issueKey: "<selected ticket key>"
   )
   ```
   Scan each comment body for GitLab MR URLs matching `https://.*/merge_requests/\d+`. Use the most recent comment containing an MR URL (latest takes priority).

If no MR URL is found in any of these locations, inform the user: "No merge request URL found on ticket <KEY> (checked fields, remote links, description, and comments). Please add the MR link to the ticket and try again." and stop.

Continue to Step 7 (Sync Remote Refs).

## Step 3G: Fetch MRs from GitLab (GitLab Flow)

Use GitLab MCP to list merge requests assigned to the current user for review:

```
mcp__gitlab__list_merge_requests(
  state: "opened",
  reviewer_username: "<current user>"
)
```

**Determine current GitLab username:** Use the GitLab MCP project listing or check git remote config to infer the user. If unclear, ask the user for their GitLab username.

If no MRs are found, inform the user: "No open merge requests assigned to you for review." and stop.

## Step 4G: Display MR List

Format the results as a numbered list for the user:

```
## Merge Requests Assigned for Review

| # | Project | MR | Title | Author | Target |
|---|---------|-----|-------|--------|--------|
| 1 | group/project | !42 | Add login feature | @developer | dev |
| 2 | group/project | !56 | Fix search bug | @developer2 | main |
```

## Step 5G: User Selects MR

Use `AskUserQuestion` to ask the user which MR to review:

```
AskUserQuestion(
  question: "Which merge request would you like to review? Enter the number from the list above.",
  options: ["1", "2", "3", ...]  // dynamic based on MR count
)
```

Validate the selection is within range. Extract the MR URL from the selected entry.

Set `TICKET_KEY` to the MR reference (e.g., `project!42`) since there is no Jira ticket in this flow.

Continue to Step 7 (Sync Remote Refs).

## Step 7: Sync Remote Refs (Hard Gate)

<CRITICAL_GATE>
Before spawning the reviewer agent, ensure the local repo has fresh remote tracking refs. This prevents reviewing stale code.

Run `git fetch origin` in the project directory:

```bash
git fetch origin
```

**This is a hard gate.** If the fetch fails (network error, auth failure, etc.):
1. Inform the user: "Failed to fetch remote refs from origin. Cannot proceed with review — remote state may be stale. Please check your network connection and git remote configuration."
2. **Stop the workflow.** Do NOT proceed to spawn the reviewer agent.

**Why this is safe:** `git fetch` only updates remote tracking refs (e.g., `origin/main`). It does NOT modify the working tree, current branch, or any local branches. There is zero risk to the developer's local work.

**Why this is required:** The reviewer agent uses GitLab API for the MR diff (always current), but may also read local files for broader context. Stale remote refs could cause the agent to reference outdated code when providing context around MR changes.
</CRITICAL_GATE>

## Step 8: Spawn Peer Reviewer Agent

Before spawning, fetch the MR source branch name from GitLab MCP:

```
mcp__gitlab__get_merge_request_details(
  project: "<project_path>",
  merge_request_iid: <MR_IID>
)
```

Extract `source_branch` from the response. This is the branch the patterns will be committed to.

Spawn the `shipit-peer-reviewer` agent with the extracted context:

```
Task(
  subagent_type="shipit:shipit-peer-reviewer",
  prompt="First, read your agent definition at agents/shipit-peer-reviewer.md for your role and instructions.

Review the merge request for Jira ticket <TICKET_KEY>: <TICKET_SUMMARY>

Merge Request URL: <MR_URL>
Jira Ticket Key: <TICKET_KEY>
MR Source Branch: <SOURCE_BRANCH>
MR Target Branch: <TARGET_BRANCH>
GitLab Project Path: <PROJECT_PATH>

CRITICAL REMINDER: You MUST use Skill(skill: 'pr-review-toolkit:review-pr', args: '<MR_URL>') for the code review. DO NOT review the code yourself. The Skill tool call is mandatory and must happen before any review output.

IMPORTANT: Use the GitLab API to fetch the MR diff (via GitLab MCP). The API diff is always current from the remote — this is the primary source of truth for what changed. Do NOT rely solely on local file reads for the diff.

<files_to_read>
./CLAUDE.md
</files_to_read>"
)
```

## Step 9: Display Review Summary

Once the agent returns, display its review summary to the user. Include:
- Review verdict (approved / changes requested)
- Number of comments posted
- Summary of issues found (if any)
- Link to the merge request

</process>

<success_criteria>
- [ ] User chose review source (Jira or GitLab)
- [ ] **Jira flow:** Jira MCP called to fetch tickets with status = "Peer Review"
- [ ] **Jira flow:** MR URL extracted (checks fields, remote links, description, AND comments)
- [ ] **GitLab flow:** GitLab MCP called to list MRs assigned to user
- [ ] Tickets/MRs displayed as numbered list
- [ ] User selected a ticket/MR via AskUserQuestion
- [ ] `git fetch origin` executed successfully (hard gate — blocks on failure)
- [ ] MR source branch name passed to peer reviewer agent
- [ ] Peer reviewer agent spawned with MR URL, ticket context, and branch info
- [ ] Agent instructed to use GitLab API for MR diff (primary source of truth)
- [ ] Review summary displayed to user
</success_criteria>
