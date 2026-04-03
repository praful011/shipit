---
name: shipit:peer-qa
description: Automate peer QA — Jira ticket selection, browser testing with Playwright, screenshot capture, Jira comments, ticket transition
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
Automate the peer QA workflow. Fetch Jira tickets in "Peer QA" status assigned to the current user, let the user select one, gather context from the ticket and linked GitLab MR, then spawn the peer-qa agent for browser-based testing with screenshot evidence and Jira reporting.
</objective>

<process>

## Step 1: Load Context

Read `./CLAUDE.md` if it exists. Follow all project-specific guidelines.

## Step 2: Fetch Peer QA Tickets from Jira

Query Jira for tickets assigned to the current user in "Peer QA" status:

```
mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql(
  jql: 'status = "Peer QA" AND assignee = currentUser()',
  fields: ["summary", "assignee", "status", "customfield_*"]
)
```

If no tickets are found, inform the user: "No tickets currently in Peer QA status assigned to you." and stop.

## Step 3: Display Ticket List

Format the results as a numbered list for the user:

```
## Peer QA Tickets

| # | Key | Summary | Assignee |
|---|-----|---------|----------|
| 1 | PROJ-123 | Add outage map feature | @developer |
| 2 | PROJ-456 | Fix notification display | @developer2 |
```

## Step 4: User Selects Ticket

Use `AskUserQuestion` to ask the user which ticket to test:

```
AskUserQuestion(
  question: "Which ticket would you like to QA test? Enter the number from the list above.",
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
4. **Issue comments** — Fetch all comments and scan for MR URLs. Use the most recent comment containing an MR URL (latest takes priority).

If no MR URL is found in any of these locations, inform the user: "No merge request URL found on ticket <KEY> (checked fields, remote links, description, and comments). Please add the MR link to the ticket and try again." and stop.

## Step 6: Ask for Target Website URL

Use `AskUserQuestion` to ask the user for the website URL to test against:

```
AskUserQuestion(
  question: "What is the target website URL for QA testing? (Press Enter for default)",
  options: [
    { label: "https://demo.outagemap.us/ (Default)", description: "Use the default demo site" },
    { label: "Enter custom URL", description: "Specify a different URL to test against" }
  ]
)
```

If the user selects "Enter custom URL", ask a follow-up question for the actual URL.

Store the selected URL as `WEBSITE_URL`.

## Step 7: Spawn Peer QA Agent

Before spawning, fetch the MR details from GitLab to get the source branch and understand the changes:

```
mcp__gitlab__get_merge_request_details(
  project: "<project_path>",
  merge_request_iid: <MR_IID>
)
```

Extract `source_branch`, `target_branch`, and `title` from the response.

Spawn the `shipit-peer-qa` agent with the gathered context:

```
Task(
  subagent_type="shipit:shipit-peer-qa",
  prompt="First, read your agent definition at agents/shipit-peer-qa.md for your role and instructions.

QA test the changes for Jira ticket <TICKET_KEY>: <TICKET_SUMMARY>

Merge Request URL: <MR_URL>
Jira Ticket Key: <TICKET_KEY>
Ticket Summary: <TICKET_SUMMARY>
MR Source Branch: <SOURCE_BRANCH>
MR Target Branch: <TARGET_BRANCH>
GitLab Project Path: <PROJECT_PATH>
Website URL: <WEBSITE_URL>

IMPORTANT: Use the GitLab API to fetch the MR diff to understand what changed. Then generate test scenarios based on the changes and test them using browser automation.

<files_to_read>
./CLAUDE.md
</files_to_read>"
)
```

## Step 8: Display QA Summary

Once the agent returns, display its QA summary to the user. Include:
- QA verdict (pass / fail)
- Number of test scenarios executed
- Number of screenshots captured and posted
- Summary of pass/fail results
- Jira ticket transition status
- Link to the Jira ticket

</process>

<success_criteria>
- [ ] Jira MCP called to fetch tickets with status = "Peer QA" AND assignee = currentUser()
- [ ] Tickets displayed as numbered list
- [ ] User selected a ticket via AskUserQuestion
- [ ] MR URL extracted from ticket (checks fields, remote links, description, AND comments)
- [ ] User asked for target website URL (with default https://demo.outagemap.us/)
- [ ] MR details fetched from GitLab (source branch, target branch)
- [ ] Peer QA agent spawned with ticket context, MR URL, and website URL
- [ ] Agent instructed to use GitLab API for MR diff
- [ ] QA summary displayed to user
</success_criteria>
