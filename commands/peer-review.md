---
name: shipit:peer-review
description: Automate Jira-to-GitLab peer review — list tickets, select, review MR, post comments, approve/reject
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
Automate the peer review workflow from Jira to GitLab. Fetch tickets in "Peer Review" status, let the user select one, extract the merge request URL, and spawn the peer-reviewer agent to perform a full code review with GitLab comments and approval/rejection.
</objective>

<process>

## Step 1: Load Context

Read `./CLAUDE.md` if it exists. Follow all project-specific guidelines.

## Step 2: Fetch Peer Review Tickets from Jira

Use the Jira MCP to search for tickets in "Peer Review" status:

```
mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql(
  jql: 'status = "Peer Review"',
  fields: ["summary", "assignee", "status", "customfield_*"]
)
```

If no tickets are found, inform the user: "No tickets currently in Peer Review status." and stop.

## Step 3: Display Ticket List

Format the results as a numbered list for the user:

```
## Peer Review Tickets

| # | Key | Summary | Assignee |
|---|-----|---------|----------|
| 1 | PROJ-123 | Add login feature | @developer |
| 2 | PROJ-456 | Fix search bug | @developer2 |
```

## Step 4: User Selects Ticket

Use `AskUserQuestion` to ask the user which ticket to review:

```
AskUserQuestion(
  question: "Which ticket would you like to review? Enter the number from the list above.",
  options: ["1", "2", "3", ...]  // dynamic based on ticket count
)
```

Validate the selection is within range.

## Step 5: Extract MR URL from Jira Ticket

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

If no MR URL is found, inform the user: "No merge request URL found on ticket <KEY>. Please add the MR link to the ticket and try again." and stop.

## Step 6: Spawn Peer Reviewer Agent

Spawn the `shipit-peer-reviewer` agent with the extracted context:

```
Task(
  subagent_type="shipit:shipit-peer-reviewer",
  prompt="First, read your agent definition at agents/shipit-peer-reviewer.md for your role and instructions.

Review the merge request for Jira ticket <TICKET_KEY>: <TICKET_SUMMARY>

Merge Request URL: <MR_URL>
Jira Ticket Key: <TICKET_KEY>

<files_to_read>
./CLAUDE.md
</files_to_read>"
)
```

## Step 7: Display Review Summary

Once the agent returns, display its review summary to the user. Include:
- Review verdict (approved / changes requested)
- Number of comments posted
- Summary of issues found (if any)
- Link to the merge request

</process>

<success_criteria>
- [ ] Jira MCP called to fetch tickets with status = "Peer Review"
- [ ] Tickets displayed as numbered list
- [ ] User selected a ticket via AskUserQuestion
- [ ] MR URL extracted from the selected Jira ticket
- [ ] Peer reviewer agent spawned with MR URL and ticket context
- [ ] Review summary displayed to user
</success_criteria>
