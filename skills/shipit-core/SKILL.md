---
name: shipit-core
description: Core ShipIt plugin awareness - injected at session start
---

# ShipIt

ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, smart task decomposition, prompt quality review, confidence-aware execution, adaptive model selection, progressive autonomy, code health tracking, and 13 commands into one seamless workflow.

## Commands

| Command | Purpose |
|---------|---------|
| `/shipit:go <task>` | Smart router — auto-detects complexity, plans, executes with confidence scoring, loops until done |
| `/shipit:quick <task>` | Fast execution — skip optional agents, just TDD and commit (1-2 files only) |
| `/shipit:plan <desc>` | Quick brainstorm + plan — review before executing |
| `/shipit:init [name]` | Lightweight project setup — creates .shipit/ with PROJECT.md and config.json |
| `/shipit:resume` | Resume from last session — spawns conductor to continue from STATE.md |
| `/shipit:status` | Show current progress — tasks, completion %, blockers |
| `/shipit:debug <issue>` | Systematic debugging with persistent state |
| `/shipit:done` | Verify + finish — runs tests, reviews diff, offers commit/PR |
| `/shipit:health` | Diagnose and repair ShipIt state files |
| `/shipit:rollback` | Rollback to a previous task checkpoint |
| `/shipit:discuss <topic>` | Discussion mode — chat about project, no code changes |
| `/shipit:update` | Update ShipIt to latest version from remote |
| `/shipit:peer-review` | Automate peer review — Jira-to-GitLab or GitLab-native MR selection, code review, comments, approval |
| `/shipit:peer-qa` | Automate peer QA — browser testing, screenshots, Jira comments, ticket transition |
| `/shipit:help` | Show usage guide |

## CRITICAL: How ShipIt Works

**When `/shipit:go` or `/shipit:plan` is invoked, you MUST follow the defined step sequence. This is NON-NEGOTIABLE.**

### Thin Orchestrator Architecture

The main conversation is a **thin orchestrator** that handles only the first steps, then delegates everything to a fresh-context **conductor agent**:

**Main orchestrator (~15% context):**
1. **Load context** — Read `.shipit/` state files, `CLAUDE.md`, analytics.json
2. **Prompt review (MANDATORY)** — Score the prompt, generate improved version, present to user via AskUserQuestion
3. **Requirement discovery** — If Specificity < 60%, ask 2-4 focused questions
4. **Analyze complexity** — Explore codebase, classify as quick/medium/large
5. **Branch isolation** — For medium/large tasks, create isolated feature branch
6. **Delegate to conductor** — Spawn shipit-conductor with task context

**Conductor agent (fresh 200k context):**
7. **Load analytics** — Read trust score, failure patterns, cost history
8. **Generate codebase context** — Write PROJECT_CONTEXT.md with real code examples
9. **Auto-CLAUDE.md** — Generate coding guide if none exists
10. **Research** — For large tasks: spawn researcher before planning
11. **Plan** — Spawn planner (with self-validation, dependency-aware waves)
12. **Execute waves** — Spawn executors with confidence scoring, adaptive model selection
13. **Verify receipts** — Check JSON proof-of-work for each task
14. **Review + extract lessons** — Reviewer checks spec + quality + patterns, writes LESSONS.md
15. **Handle replans** — If executor signals approach failure, re-plan remaining tasks
16. **Verify** — Epic-level requirement review + integration check (merged verifier)
17. **Track health** — Calculate code health delta, update analytics
18. **Return status** — complete/incomplete/blocked/failed

**If conductor returns "incomplete"** (context budget reached), main spawns a NEW conductor. Max 3 conductor spawns.

## Agents

| Agent | Purpose | Default Model (balanced) |
|-------|---------|------------------------|
| **shipit-conductor** | Orchestrates plan-to-completion with autonomy management | sonnet |
| **shipit-researcher** | Researches how to implement before planning (large tasks) | sonnet |
| **shipit-planner** | Breaks tasks into atomic steps with self-validation + wave assignment | sonnet |
| **shipit-executor** | Executes one task with TDD, confidence scoring, checkpoints | sonnet (adaptive) |
| **shipit-reviewer** | Reviews: receipt + spec + quality + patterns, extracts lessons | haiku |
| **shipit-verifier** | Epic-level requirements + integration check (merged) | sonnet |
| **shipit-debugger** | Scientific method debugging with persistent state | sonnet |
| **shipit-correctness-reviewer** | Correctness specialist used by `shipit-review`: logic bugs, off-by-one, null refs, edge cases | sonnet |
| **shipit-security-reviewer** | Security specialist: secrets, injection, authz, XSS, SSRF, path traversal | sonnet |
| **shipit-performance-reviewer** | Performance specialist: N+1, blocking I/O, unbounded loops, missing indexes | sonnet |
| **shipit-error-handling-reviewer** | Error-handling specialist: swallowed errors, empty catch, silent drops | sonnet |
| **shipit-test-reviewer** | Test specialist: coverage of new logic, test quality, flaky patterns | sonnet |
| **shipit-intent-reviewer** | Intent specialist: diff-vs-intent alignment, scope creep | sonnet |

## Auto-Loop Signals

- `<shipit-done/>` — All work complete, exit loop
- `<shipit-blocked>description</shipit-blocked>` — Need user input
- `<shipit-replan>reason</shipit-replan>` — Planned approach failed, need to replan remaining tasks

## State Files

- `.shipit/PROJECT.md` — What we're building
- `.shipit/STATE.md` — Current position and progress
- `.shipit/PLAN.md` — Active plan with tasks
- `.shipit/RESEARCH.md` — Pre-planning research (large tasks)
- `.shipit/PROJECT_CONTEXT.md` — Shared codebase patterns (all agents read this)
- `.shipit/LESSONS.md` — Review findings for future executors (learning loop)
- `.shipit/HANDOFF.md` — Cumulative context from completed tasks
- `.shipit/handoffs/task-N.md` — Per-task handoff files (parallel-safe)
- `.shipit/receipts/task-N.json` — Machine-verifiable proof of execution (with confidence)
- `.shipit/analytics.json` — Persistent analytics (trust score, cost, health trend)
- `.shipit/DEFERRED.md` — Out-of-scope issues found during execution
- `.shipit/config.json` — Preferences (TDD, autonomy mode, model profile, MCP hooks)
- `.shipit/loop.md` — Loop state (auto-managed)
- `.shipit/prompts/history.md` — Prompt review history log
- `.shipit/debug/DEBUG.md` — Debugging session state

## Principles

1. **TDD by default** — Write the failing test first, always.
2. **Atomic commits** — One commit per task. Stage files individually.
3. **Supervised autonomy** — Three modes (guided/supervised/autonomous) based on trust score.
4. **Confidence-aware execution** — Executor self-rates confidence. LOW = stop and ask human.
5. **Step gates** — Each step MUST complete before the next begins.
6. **Self-validating plans** — Planner checks 8 dimensions + dependency-aware wave safety.
7. **Per-task review** — Every task reviewed. Lessons extracted to LESSONS.md.
8. **Scope boundaries** — Out-of-scope issues go to DEFERRED.md. Max 3 auto-fix attempts.
9. **Context budgets** — Max 5 tasks per plan. Fresh context per agent.
10. **Thin orchestrator** — Main context stays under 20%.
11. **Wave-based parallel** — Same-wave tasks run simultaneously.
12. **Parallel-safe handoffs** — Individual files, merged after waves.
13. **Git checkpoints** — Tag before each task. Rollback anytime.
14. **Adaptive model selection** — Dynamic per-task model choice based on complexity.
15. **Re-anchoring** — Every executor re-reads original task to prevent drift.
16. **Receipt-based proof** — JSON receipts with confidence, tests, verify result.
17. **Self-review** — Executors check own diff before committing.
18. **Shared codebase context** — PROJECT_CONTEXT.md ensures consistent code style.
19. **Learning loop** — LESSONS.md propagates review findings to future executors.
20. **Adaptive re-planning** — When approach fails, replan remaining tasks (not redo completed).
21. **Epic-level verification** — Check ALL original requirements with evidence.
22. **Progressive autonomy** — Trust score builds over sessions. Earn more autonomy.
23. **Code health tracking** — Track if codebase gets better or worse per task.
24. **Failure analytics** — Persistent learning from failures across sessions.
25. **Cost awareness** — Track token cost per task, respect budget limits.
26. **MCP integration hooks** — Optional blast radius (Engram), dependency graph (Depwire), docs (Context7).
27. **Requirement discovery** — Vague tasks trigger Socratic questioning before planning.
28. **Auto-CLAUDE.md** — Generate coding guide when none exists.
