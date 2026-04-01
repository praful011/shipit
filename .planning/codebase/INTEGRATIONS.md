# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**Jira (Optional):**
- Service: Atlassian Jira for ticket management
- What it's used for: Fetching peer review tickets via `/shipit:peer-review` command
- MCP Client: `mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql` / `mcp__claude_ai_Atlassian__getJiraIssue`
- Auth: Handled by Claude Code MCP integration (Jira token/credentials in Claude Code settings)
- Integration point: `commands/peer-review.md` (Step 3-4)
- Enabled via: Optional MCP configuration in `.shipit/config.json`

**GitLab (Optional):**
- Service: GitLab for merge request management and code review
- What it's used for: Fetching MR diff, posting review comments, approving/requesting changes
- MCP Client: GitLab API via Claude Code MCP
- Auth: Handled by Claude Code MCP integration (GitLab token in Claude Code settings)
- Integration points:
  - `agents/shipit-peer-reviewer.md` (Steps 2, 5-6) - MR fetch, comment posting, approval
  - `commands/peer-review.md` (Step 6.5) - Hard gate for `git fetch origin`
- API Usage:
  - GET MR metadata and diff (primary source of truth)
  - POST review comments and discussions
  - PUT approval/change request state
- Enabled via: Optional MCP configuration in `.shipit/config.json`

## Data Storage

**Databases:**
- None direct integration in ShipIt itself
- ShipIt operates on existing project codebases (PostgreSQL, MySQL, MongoDB, etc.)
- No persistent state in external databases — all state in `.shipit/` directory
- Connection handling: Delegated to executing agents/project code

**File Storage:**
- Local filesystem only (`.shipit/` directory structure)
- State files:
  - `STATE.md` - Current execution state
  - `PLAN.md` - Task decomposition
  - `DESIGN.md` - Design decisions
  - `PROJECT_CONTEXT.md` - Shared codebase context
  - `LESSONS.md` - Learning from reviews
  - `HANDOFF.md` - Inter-agent handoffs
  - `config.json` - Configuration
  - `analytics.json` - Persistent metrics (trust score, cost history)
  - `receipts/*.json` - Task completion evidence

**Caching:**
- None - ShipIt runs fresh in each agent context
- Git state cached via `git fetch origin` (for peer review)

## Authentication & Identity

**Auth Provider:**
- None internal — ShipIt delegates to Claude Code's MCP authentication
- Credentials managed entirely by Claude Code CLI settings
- MCP tokens stored in Claude Code's secure settings (not in ShipIt files)

**Implementation:**
- Claude Code handles Jira API authentication (OAuth/token)
- Claude Code handles GitLab API authentication (OAuth/token)
- No credentials stored in `.env` or `.shipit/config.json`
- All API calls routed through Claude Code's MCP layer

## Monitoring & Observability

**Error Tracking:**
- None external — errors logged to agent outputs
- Hard gates document failure points with user messaging

**Logs:**
- Execution logs: In agent outputs and `.shipit/` state files
- Failure history: Persisted in `.shipit/analytics.json`
  - `common_failures` array tracks repeat issues
  - Cost history with token estimates
  - Trust score trend and success rates
- Task receipts: JSON evidence files in `.shipit/receipts/`
  - Raw test output (not summaries)
  - Verification results
  - Code review findings

**Statusline Hook:**
- `hooks/statusline.js` - Shows real-time execution state in Claude Code UI
- Reads: `.shipit/STATE.md`, `.shipit/PLAN.md`, `.shipit/loop.md`
- Displays: Branch + changes, task progress (2/5), TDD phase, elapsed time, context window %

## CI/CD & Deployment

**Hosting:**
- GitHub (repository hosting)
- Marketplace: Claude Code plugin marketplace (via `praful011/shipit`)

**CI Pipeline:**
- None automated — this is a pure plugin/documentation project
- No build system, no linting, no automated tests
- Verification is structural (YAML frontmatter, file existence, cross-references)

**Deployment:**
- Installed via Claude Code marketplace or direct git clone
- No deployment artifacts beyond git push
- Version managed in `.claude-plugin/plugin.json`

## Environment Configuration

**Required env vars:**
- None - ShipIt requires zero environment setup
- Optional: Git credentials for `git fetch origin` (handled by system git config)
- Optional: Jira/GitLab credentials (managed by Claude Code MCP, not ShipIt)

**Secrets location:**
- Not applicable to ShipIt itself
- Project credentials: Managed by Claude Code's MCP integration settings
- Git SSH keys: System git config (`~/.ssh/`)
- No `.env` files created or read by ShipIt

## Webhooks & Callbacks

**Incoming:**
- None - ShipIt is pull-based only

**Outgoing:**
- Git: Pushes commits and tags to remote (during `/shipit:done` or auto-commit)
- Jira: Posts task completion comments (optional, via skill)
- GitLab: Posts review comments and approval state (via `/shipit:peer-review`)

**Git Integration:**
- `git fetch origin` - Hard gate before peer review to ensure fresh MR state
- `git commit` - Atomic commits with ShipIt message format
- `git tag` - Checkpoint tags for each task (safe rollback)
- `git push` - Pushes to origin (auto-commit or user-initiated)

## Optional MCP Server Integrations

**If configured in `.shipit/config.json`:**

```json
{
  "mcp_integrations": {
    "blast_radius": "engram",      // Optional
    "dependency_graph": "depwire",  // Optional
    "docs": "context7"              // Optional
  }
}
```

**Engram (Blast Radius):**
- When: Before executor spawn during planning
- Purpose: Determine which files change together
- Usage: Include in executor context to prevent unintended side effects
- Reference: `agents/shipit-conductor.md` (MCP Integration Hooks section)

**Depwire (Dependency Graph):**
- When: During planning phase
- Purpose: Query import graph for wave safety validation
- Usage: Ensure parallel tasks don't have hidden dependencies
- Reference: `agents/shipit-conductor.md` (MCP Integration Hooks section)

**Context7 (API Docs):**
- When: During research step (when learning about external APIs)
- Purpose: Fetch up-to-date library documentation
- Usage: Enhance researcher context with current API signatures
- Reference: `agents/shipit-conductor.md` (MCP Integration Hooks section)

**Non-blocking behavior:** If an MCP server is configured but unavailable, ShipIt logs a warning and continues. Never blocks execution.

---

*Integration audit: 2026-04-01*
