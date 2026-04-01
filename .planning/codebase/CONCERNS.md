# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**External Skill Dependency — pr-review-toolkit**

- Issue: The peer-review workflow has a hard dependency on `/pr-review-toolkit:review-pr` skill which is NOT defined in this codebase. If the skill doesn't exist or becomes unavailable, the workflow partially fails.
- Files: `agents/shipit-peer-reviewer.md:45-70`, `commands/peer-review.md:138`
- Impact: Peer review agent will fail at Step 3 if the skill is not available. Although there is a fallback to manual review (line 70 of shipit-peer-reviewer.md), this downgrade is not automatic — the agent must detect the failure and switch strategy.
- Fix approach: Document the skill as a runtime requirement in `CLAUDE.md` under dependencies. Add explicit version/contract requirements for the skill (what methods it must expose, expected output format).

**External Project Repo Assumption — .claude/skills/pr-review-patterns/SKILL.md**

- Issue: Step 6.5 of `shipit-peer-reviewer.md` assumes the reviewed project has a `.claude/skills/pr-review-patterns/` directory structure. If this directory doesn't exist or the project uses a different convention, file writes will fail silently (marked as best-effort in Step 6.5:126).
- Files: `agents/shipit-peer-reviewer.md:150-191`, `agents/shipit-peer-reviewer.md:202`
- Impact: Pattern extraction failures don't block review completion (by design), but they also silently drop learning that could prevent future mistakes. Users won't know patterns weren't captured unless they manually check the review task output.
- Fix approach: Create the directory before writing (use `mkdir -p`) and log success/failure explicitly. Alternatively, validate directory existence at Step 6.5:2 before proceeding.

**Wave Dependency Ordering — Parallel Execution Risk**

- Issue: The conductor executes tasks in waves based on file-level analysis, but tasks within a wave can have temporal ordering requirements not captured by the dependency graph. Example: If Task A modifies a skill file that Task B reads, running them in parallel may cause Task B to read stale data.
- Files: `agents/shipit-planner.md:120-141`, `agents/shipit-conductor.md:265-350`
- Impact: Race conditions in parallel execution if tasks share transitive dependencies (A modifies X, B modifies X, C reads X). Currently mitigated by requiring explicit dependency analysis, but tool limitations could miss implicit ordering.
- Fix approach: Add explicit "read-before" and "write-after" constraints in task definitions. Use MCP dependency_graph integration (optional, line 137 of shipit-conductor.md) to validate wave safety.

**Context Budget — Conductor Overflow**

- Issue: The conductor manages context budget per wave and can return `"incomplete"` when budget is exceeded. However, the main orchestrator (`commands/go.md:202`) shows context budget exhaustion is handled by re-spawning conductors (max 3 attempts). If a single task requires more than the agent context window, it will fail and block all 3 retries.
- Files: `agents/shipit-conductor.md:415-421`, `commands/go.md:38-50`
- Impact: Large tasks (>100KB of changes) may fail at execution and become unrecoverable without manual intervention. The "max 3 conductor spawns" limit is artificial — should be based on task complexity.
- Fix approach: Split large tasks at planning time. Add task size estimation to `shipit-planner.md` validation. Recommend max 50KB per task for safe execution.

**Replan Limit — Single Retry**

- Issue: If a task's planned approach fails (e.g., API incompatible, library switching), the conductor spawns a planner to replan remaining tasks. But only max 1 replan is allowed per run (line 409 of shipit-conductor.md). If the replan also fails, the entire run is blocked.
- Files: `agents/shipit-conductor.md:396-409`, `agents/shipit-executor.md:304-307`
- Impact: Complex features that need 2+ iterations to get the approach right will fail. No graceful degradation.
- Fix approach: Allow 2 replans per run, with increasing severity (first replan full, second replan remaining tasks only). Log replans to analytics for pattern detection.

## Known Bugs

**Silent Failures in Skill File Write**

- Symptoms: Pattern extraction completes, but skill file is never updated. User discovers this by manually checking the reviewed project's repo.
- Files: `agents/shipit-peer-reviewer.md:189-208`
- Trigger: Directory doesn't exist, permissions denied on project repo, git commit fails
- Workaround: Create `.claude/skills/pr-review-patterns/SKILL.md` manually before running peer review. Or manually commit the patterns after review.

**Stale Remote Refs During Review**

- Symptoms: Peer reviewer agent reads local files to provide context, but those files may be out of date if the remote has newer commits.
- Files: `commands/peer-review.md:104-122`
- Trigger: User hasn't pulled recent changes, or another team member pushed while review is running
- Workaround: Run `git pull` before `/shipit:peer-review` (but Step 7 only runs `git fetch`, not pull)

**Git Fetch Can Fail Silently in Concurrent Environments**

- Symptoms: `git fetch origin` succeeds but returns stale refs due to network race conditions (e.g., push in progress on origin)
- Files: `commands/peer-review.md:104-122`
- Trigger: High-velocity team pushing to origin simultaneously
- Workaround: None at script level. Recommendation: add delay or retry with exponential backoff to `git fetch origin`.

## Security Considerations

**MCP Server Configuration Exposure**

- Risk: Jira MCP and GitLab MCP require credentials to access external systems. If credentials are exposed in config files or environment, they could be leaked.
- Files: `agents/shipit-conductor.md:140`, `.shipit/config.json`
- Current mitigation: MCP servers are configured externally (not in ShipIt codebase). Credentials are managed by Claude Code runtime.
- Recommendations: Document that `.shipit/config.json` should not contain secrets. Use environment variables or MCP server auth tokens only. Add to CLAUDE.md security section.

**GitLab MCP Permissions Not Validated**

- Risk: If the GitLab MCP token doesn't have permissions to approve MRs, the approval step will silently fail. No warning to user.
- Files: `agents/shipit-peer-reviewer.md:111-120`
- Current mitigation: Error handling table at line 294 documents insufficient permissions, but fallback is not automatic.
- Recommendations: Add pre-check in peer-review command (Step 2) to validate GitLab token has `api` scope. Fail fast before spawning agent.

**Pattern Extraction May Leak Sensitive Code Patterns**

- Risk: Step 6.5 extracts "generalized patterns" from code review findings. If the generalization is insufficient, a pattern could retain sensitive details (e.g., "avoid hardcoding API keys in config.py" reveals a file name and attack vector).
- Files: `agents/shipit-peer-reviewer.md:132-146`
- Current mitigation: Instructions say to "remove all MR-specific details", but judgment call on what's safe.
- Recommendations: Add explicit list of unsafe pattern elements (file paths, env var names, URLs). Use regex or manual review before committing patterns.

## Performance Bottlenecks

**Parallel Wave Execution Overhead**

- Problem: Spawning multiple executor agents in parallel (per wave) multiplies token cost and context overhead. No optimization for wave size.
- Files: `agents/shipit-conductor.md:265-350`
- Cause: Each executor is a fresh context window (200k tokens). 3 parallel executors = 600k tokens overhead just for initialization.
- Improvement path: Batch small tasks within a wave into single executor spawn. Conductor could estimate task sizes and group.

**Analytics.json Polling**

- Problem: Conductor reads and updates `analytics.json` after each wave. No atomic writes — concurrent conductors could corrupt the file.
- Files: `agents/shipit-conductor.md:44-74`, `agents/shipit-conductor.md:462-467`
- Cause: Markdown files don't support transactions. Multiple concurrent runs could race.
- Improvement path: Implement file-lock mechanism (mkdir atomicity) or move analytics to a dedicated API. Document as limitation for concurrent runs.

**Context Budget Checking Is Manual**

- Problem: Conductor manually checks context budget at line 415-421, but the check is heuristic (word count, task estimate). Actual token count won't be known until execution, leading to overruns.
- Files: `agents/shipit-conductor.md:415-421`, `.shipit/config.json`
- Cause: No token metering at agent spawn time. Cost tracking is post-hoc in analytics.
- Improvement path: Add pre-spawn token estimation (count tokens before spawning executor). Allow configurable max tokens per wave.

## Fragile Areas

**Wave-Based Parallel Execution Architecture**

- Files: `agents/shipit-conductor.md`, `agents/shipit-planner.md`
- Why fragile: Wave assignment is static at plan time. If actual dependency graph is more complex than expected, or if a task's implementation reveals new dependencies, waves can't be reordered. Planner must be 100% accurate.
- Safe modification: Never add tasks dynamically after planning. If replanning, recompute all waves, not just remaining tasks.
- Test coverage: No integration test for wave safety. Recommend manual tracing of import graphs for large plans.

**Skill File Deduplication Logic**

- Files: `agents/shipit-peer-reviewer.md:158-181`
- Why fragile: Deduplication uses >80% semantic overlap (subjective judgment). Two reviewers might flag the same issue differently, causing duplicates to slip through (80% match is borderline). Alternative: entry is genuinely different even though root cause is similar, causing false positives (deleting entries that should coexist).
- Safe modification: Keep deduplication logs in HANDOFF.md so reviewers can audit. Add "last review date" to each pattern.
- Test coverage: No way to test deduplication without seeding many patterns manually. Recommend tracking duplicates in analytics.

**Replan-After-Failure Recovery**

- Files: `agents/shipit-conductor.md:396-409`, `agents/shipit-executor.md:304-307`
- Why fragile: If Task N fails and triggers replan, the new PLAN.md only covers tasks N-end. But HANDOFF.md and STATE.md still contain data from tasks 1-N. If replanning goes wrong and needs another pass, state becomes inconsistent.
- Safe modification: Before replanning, snapshot current STATE.md and HANDOFF.md. If second replan fails, restore from snapshot instead of compounding.
- Test coverage: No test for replan recovery. Manual testing only.

**Best-Effort Pattern Extraction**

- Files: `agents/shipit-peer-reviewer.md:122-208`
- Why fragile: Entire Step 6.5 is marked best-effort (line 126), so failures are silently logged. If directory creation fails, file write fails, or git commit fails, the step completes as success but patterns are lost. Review will be approved/rejected correctly, but learning is lost.
- Safe modification: Make pattern extraction failures into warnings that are logged to a `.shipit/WARNINGS.md` file for user visibility. Allow user to manually retry pattern extraction later.
- Test coverage: No test for write failures. Recommend dry-run in peer-review command before spawning agent.

## Scaling Limits

**Analytics.json Growth**

- Current capacity: Unlimited growth (no cap defined)
- Limit: As cost_history and code_health_trend arrays grow, file size grows unbounded. No pruning mechanism.
- Scaling path: Implement rolling window (keep last 50 runs, prune older). Archive old analytics to `analytics-archive.json`.

**Skills Directory Size**

- Current capacity: Skill files are reference docs (no data). Only `pr-review-patterns/SKILL.md` grows (30-entry cap per project).
- Limit: If ShipIt is used across many projects, `skills/pr-review-patterns/` directories could proliferate in each project. No cleanup.
- Scaling path: Document skill cleanup policy (e.g., "delete patterns older than 90 days"). Add skill-cleanup command.

**Context Window Per Agent**

- Current capacity: 200k tokens per executor, planner, researcher, etc.
- Limit: Large codebases (>2MB source code) may not fit in a single agent context. Projects can't be larger than 2MB.
- Scaling path: Implement code summarization before context loading. Use MCP dependency_graph to load only relevant files, not entire codebase.

## Dependencies at Risk

**Jira MCP Integration**

- Risk: Peer-review command assumes Jira MCP is configured (`mcp__claude_ai_Atlassian__*` calls at line 45, 92 of commands/peer-review.md). If Jira MCP is not available, all peer-review workflows fail at Step 3.
- Impact: No fallback mechanism. Users can't work around missing Jira MCP.
- Migration plan: Add configuration check in peer-review command before spawning agent. If Jira MCP is missing, ask user for manual ticket selection (copy-paste MR URL).

**GitLab MCP Integration**

- Risk: Peer-reviewer agent uses GitLab MCP to fetch MR, post comments, and approve (lines 36-120 of shipit-peer-reviewer.md). Multiple hard dependencies.
- Impact: If GitLab MCP fails at any step, review is incomplete. Fallback to manual diff review (line 70) is only for review step, not for MR fetching or approval.
- Migration plan: Separate review logic from MR fetching/approval. Allow manual MR fetch (user provides diff text) for review-only use cases.

**pr-review-toolkit Skill**

- Risk: High-level risk. This skill is external to ShipIt and provides the entire code review engine (line 66 of shipit-peer-reviewer.md). If unavailable, all reviews are downgraded to manual.
- Impact: Peer reviews become slower and less consistent. Manual review (fallback) uses shipit's own code-review skill, which is lower-fidelity.
- Migration plan: Document pr-review-toolkit as required dependency in CLAUDE.md. Version-pin the skill. Add pre-check in peer-review command.

## Missing Critical Features

**No Peer Review Approval History**

- Problem: When peer-reviewer agent approves/rejects an MR, there's no persistent record of the decision or timeline.
- Blocks: Audit trails, compliance reporting, trend analysis (which reviewers approve fastest?)
- Recommendation: Add approval metadata to HANDOFF.md after each peer review (timestamp, reviewer, decision, issues found).

**No Pattern Lifecycle Management**

- Problem: Patterns in `.claude/skills/pr-review-patterns/SKILL.md` have no creation date, no last-seen date, no deprecation mechanism.
- Blocks: Identifying stale patterns, removing obsolete checks, understanding pattern freshness
- Recommendation: Add metadata to each pattern (date_added, times_found, last_found_date). Remove patterns not found in 90 days.

**No Wave Validation Before Execution**

- Problem: Planner assigns waves, but there's no tool to validate that wave assignments are actually safe (no hidden dependencies).
- Blocks: Catching wave ordering bugs before parallel execution fails
- Recommendation: Add shipit-wave-validator agent. Spawn after planning, before execution. Validate dependency graph against file imports.

**No Rollback for Pattern Extraction**

- Problem: If pattern extraction writes a malformed skill file, the review completes but the project repo is corrupted.
- Blocks: Safe pattern extraction rollback, recovery from bad deduplication
- Recommendation: Add `rollback-patterns` command. Restore `.claude/skills/pr-review-patterns/SKILL.md` from previous commit.

## Test Coverage Gaps

**Peer Review Workflow with Missing Jira/GitLab MCP**

- What's not tested: Fallback behavior when Jira MCP is unavailable (can't list tickets) or GitLab MCP is unavailable (can't fetch MR or post comments)
- Files: `commands/peer-review.md`, `agents/shipit-peer-reviewer.md`
- Risk: Users will hit runtime failures instead of clear error messages
- Priority: HIGH — affects all peer-review workflows

**Pattern Deduplication with Large Skill Files**

- What's not tested: Deduplication logic when skill file has 30 entries. Does algorithm correctly identify >80% overlap? Does it preserve CRITICAL entries?
- Files: `agents/shipit-peer-reviewer.md:158-181`
- Risk: Stale patterns accumulate, skill file fills with duplicates, learning loop degrades
- Priority: MEDIUM — affects long-term pattern quality

**Wave Parallel Execution with Shared Dependencies**

- What's not tested: Do parallel executors in same wave correctly handle file-level conflicts? What happens if Task A modifies X and Task B also modifies X in parallel?
- Files: `agents/shipit-planner.md:120-141`, `agents/shipit-conductor.md:265-350`
- Risk: Merge conflicts, task failures, corrupted files
- Priority: MEDIUM — affects correctness of parallel execution

**Replan Recovery After Second Failure**

- What's not tested: If replan fails, does state remain consistent? Can conductor recover?
- Files: `agents/shipit-conductor.md:396-409`
- Risk: Inconsistent state, manual cleanup needed
- Priority: LOW — uncommon scenario, but catastrophic when it happens

**Git Fetch Timeout and Retry**

- What's not tested: If `git fetch origin` times out or partially succeeds, does hard gate block correctly?
- Files: `commands/peer-review.md:104-122`
- Risk: Stale refs, incorrect reviews, silent failures
- Priority: MEDIUM — affects review accuracy in slow networks

## Technical Debt Summary

| Area | Severity | Impact | Fix Complexity |
|------|----------|--------|-----------------|
| External skill dependencies (pr-review-toolkit) | HIGH | Review workflow fails | LOW (document + pre-check) |
| Pattern extraction directory handling | MEDIUM | Silent failures | LOW (mkdir -p + logging) |
| Wave dependency ordering | MEDIUM | Race conditions in parallel execution | MEDIUM (add constraint validation) |
| Context budget estimation | MEDIUM | Large tasks fail unrecoverable | MEDIUM (task size estimation) |
| Replan single-retry limit | MEDIUM | Complex features block | LOW (increase limit to 2) |
| Analytics file atomicity | LOW | Concurrent run corruption (rare) | HIGH (move to API or lock) |
| Skill file deduplication accuracy | MEDIUM | Stale/duplicate patterns accumulate | MEDIUM (add audit logs + aging) |
| Best-effort pattern extraction | MEDIUM | Learning silently lost | LOW (add warnings file) |
| Missing rollback for patterns | MEDIUM | Corrupted skill files unrecoverable | LOW (add command) |

---

*Concerns audit: 2026-04-01*
