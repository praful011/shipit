# Coding Conventions

**Analysis Date:** 2026-04-01

## Project Overview

ShipIt is a pure documentation project — a Claude Code plugin consisting entirely of Markdown files. There is no production code, build system, or runtime. All conventions apply to Markdown content, YAML frontmatter, and structural patterns.

## File Naming Conventions

**Files:**
- Kebab-case for all file names (no spaces, no underscores, lowercase with hyphens)
- Examples: `shipit-conductor.md`, `shipit:go.md`, `requirement-discovery.md`, `pr-review-patterns.md`
- Agents: `agents/<name>.md`
- Commands: `commands/<name>.md`
- Skills: `skills/<skill-name>/SKILL.md`

**Directories:**
- Kebab-case for all directories
- Examples: `agents/`, `commands/`, `skills/`, `.claude/`, `.shipit/`, `.planning/`

## YAML Frontmatter

**Required fields for agents** (`agents/*.md`):
```yaml
---
name: shipit-<name>
description: |
  Multi-line description of the agent's purpose and spawning context
---
```

**Required fields for commands** (`commands/*.md`):
```yaml
---
name: shipit:<command-name>
description: Short command description
argument-hint: "<expected arguments>"
allowed-tools:
  - ToolName
  - AnotherTool
---
```

**Required fields for skills** (`skills/<skill-name>/SKILL.md`):
```yaml
---
name: <skill-name>
description: Multi-line skill description
---
```

All frontmatter fields use lowercase keys. Descriptions wrap to multiple lines with `|` for multiline strings.

## Content Structure

### Agent Documents

Agents follow a consistent internal structure:

```
1. YAML frontmatter (name, description)
2. <role> XML tag — Agent identity and core responsibility
3. <critical_rules> XML tag (if applicable) — Non-negotiable constraints
4. <project_context> XML tag — What files to read first
5. <process> XML tag — Numbered steps (Step N: Title format)
6. Additional sections (analytics, autonomy modes, special handling)
```

**Pattern example from `shipit-conductor.md`:**
```markdown
---
name: shipit-conductor
description: |
  Orchestrates plan-to-completion...
---

<role>
You are the ShipIt conductor agent...
</role>

<critical_rules>
CRITICAL: You MUST follow...
</critical_rules>

<project_context>
Before starting, load context...
</project_context>

<process>
## Step 1: Load Context
...
## Step 2: ...
</process>
```

Location: `agents/shipit-conductor.md`, `agents/shipit-executor.md`, `agents/shipit-planner.md`, etc.

### Command Documents

Commands have a simpler structure:

```
1. YAML frontmatter (name, description, argument-hint, allowed-tools)
2. <objective> XML tag — What the command does
3. <critical_rules> XML tag — Process constraints
4. <process> XML tag — Numbered steps
5. Error handling tables (if applicable)
```

**Pattern from `commands/go.md`:**
```markdown
---
name: shipit:go
description: Smart router...
allowed-tools:
  - Read
  - Write
---

<objective>
Execute a task end-to-end...
</objective>

<critical_rules>
CRITICAL: You MUST follow...
</critical_rules>

<process>
## Step 1: Load Context
...
</process>
```

Location: `commands/go.md`, `commands/init.md`, `commands/plan.md`, etc.

### Skill Documents

Skills document workflows, patterns, and decision frameworks:

```
1. YAML frontmatter (name, description)
2. ## Purpose — Why this skill exists
3. ## When to Use — Applicability rules
4. ## Process — Workflow phases
5. ## Anti-Patterns — What not to do
```

**Pattern from `skills/tdd/SKILL.md`:**
```markdown
---
name: tdd
description: TDD reference...
---

# TDD: Red-Green-Refactor

## The Iron Law
[Statement of the core principle]

## The Cycle
[Ordered steps]

## When TDD Doesn't Apply
[Exceptions]

## Rationalization Prevention
[Anti-patterns table]

## Verification Checklist
[Checklist format]
```

Location: `skills/<skill-name>/SKILL.md` (e.g., `skills/tdd/SKILL.md`, `skills/git-workflow/SKILL.md`)

## XML Tags

**Standard XML tags used throughout:**
- `<role>` — Agent/command identity
- `<objective>` — What the command/agent does
- `<critical_rules>` — Non-negotiable constraints
- `<rationalization_prevention>` — Anti-patterns that violate conventions
- `<process>` — Workflow steps
- `<project_context>` — Context loading requirements
- `<shipit-done/>` — Signal: work complete
- `<shipit-blocked>description</shipit-blocked>` — Signal: needs user input
- `<shipit-replan>reason</shipit-replan>` — Signal: approach failed, replan needed
- `<CRITICAL_GATE>` — Blocking decision point

Location patterns: `agents/`, `commands/`, `skills/`

## Process Steps

**Numbering:**
- Format: `## Step N: Title`
- Must be sequential (Step 1, Step 2, Step 3, not 1.0, 1.1, etc.)
- Each step must be a major checkpoint in the workflow

**Example from `shipit-planner.md`:**
```markdown
## Step 1: Parse Task
[Content]

## Step 2: Analyze Codebase
[Content]

## Step 3: Classify Complexity
[Content]
```

**Gates:**
- Mark end of major step with: `**GATE: [condition met]. Proceed to [next step].**`
- Gates prevent skipping steps or entering invalid states
- Example: `**GATE: All 8 dimensions pass. Plan is ready.**`

## Emphasis & Formatting

**Critical statements:**
- Use `**CRITICAL:**` prefix for non-negotiable rules
- Example: `**CRITICAL: You MUST follow the steps below ONE AT A TIME, IN ORDER.`

**Strong emphasis:**
- Use `**bold**` for key terms, field names, and important concepts
- Example: `**Files** listed`, `**Do** instructions`, `**Verify** command`

**Code blocks:**
- Use fenced code blocks with language hints
- Bash examples: ` ```bash ... ``` `
- Markdown examples: ` ```markdown ... ``` `
- JSON/config examples: ` ```json ... ``` `

**Tables:**
- Used for decision matrices, severity levels, tool capabilities
- Format: `| Column 1 | Column 2 | Column 3 |` with alignment
- Example from `code-review/SKILL.md`:
```markdown
| Severity | Definition | Action |
|----------|-----------|--------|
| **CRITICAL** | Security vulnerability | BLOCK |
```

## Error Handling & Decision Frameworks

**Severity Classification (standard pattern):**

All error/issue documentation uses this severity model:

| Severity | Definition | Action |
|----------|-----------|--------|
| **CRITICAL** | Security vulnerability, data loss, broken functionality, blocking gate | BLOCK — fix immediately before proceeding |
| **IMPORTANT** | Missing error handling, inadequate tests, pattern violations, moderate issues | FIX — fix before next task |
| **MINOR** | Style issues, naming, optimizations, low impact | NOTE — track but don't block |

**Pattern sources:**
- `skills/code-review/SKILL.md` — Code review severity levels
- `skills/verification-standards/SKILL.md` — Verification evidence requirements
- `agents/shipit-reviewer.md` — Review severity classification

**Rationalization Prevention:**

Every agent/skill that can be violated includes a `<rationalization_prevention>` section with a table mapping rationalizations to their reality:

| Thought | Reality | Action |
|---------|---------|--------|
| Rationalization | Why it's wrong | What to do instead |

Example from `skills/tdd/SKILL.md`:
```markdown
| Thought | Reality | What To Do |
|---------|---------|------------|
| "Too simple to test" | Simple code has simple tests | STOP → Write the test |
| "I'll test after" | "After" means never | STOP → Delete code, write test |
```

## Naming Patterns

**Agent names:**
- Format: `shipit-<adjective or noun>` (always kebab-case)
- Examples: `shipit-conductor`, `shipit-executor`, `shipit-planner`, `shipit-reviewer`, `shipit-verifier`
- Never: `shipit_executor`, `ShipItExecutor`, `shipit executor`

**Command names:**
- Format: `/shipit:<command>` (lowercase, kebab-case after colon)
- Examples: `/shipit:go`, `/shipit:quick`, `/shipit:plan`, `/shipit:init`
- Prefixed with the plugin namespace `shipit:`

**Skill names:**
- Format: lowercase, kebab-case, stored as directory
- Examples: `tdd`, `git-workflow`, `code-review`, `requirement-discovery`
- SKILL.md file is always uppercase `SKILL.md`

**Variable/field names:**
- Lowercase with underscores in JSON/frontmatter fields
- Examples: `autonomy_mode`, `trust_score`, `tasks_executed`, `total_runs`
- Never camelCase in configuration

## Comments & Explanation

**When to explain:**
- Complex workflow logic (multi-step processes)
- Non-obvious constraints or gates
- Rationalization prevention sections (explain the pitfall)
- Tables with decision criteria

**Inline emphasis:**
- Use bold for technical terms when first introduced
- Example: "The **conductor** agent orchestrates the pipeline..."

**Section headers:**
- Use H2 (`##`) for major sections
- Use H3 (`###`) for subsections
- Avoid going deeper than H3 for clarity

## Import/Reference Patterns

**File references:**
- Use backticks for file paths: `` `agents/shipit-conductor.md` ``
- Always include relative path from project root
- Examples: `` `.shipit/STATE.md` ``, `` `.shipit/PLAN.md` ``, `` `skills/tdd/SKILL.md` ``

**Cross-references:**
- Reference other agents/commands by name
- Example: "Spawned by `/shipit:go` after Step 1-2"
- Example: "Read `.shipit/PROJECT_CONTEXT.md` if it exists"

**External tool references:**
- List allowed tools in command YAML: `allowed-tools: [Read, Write, Bash, AskUserQuestion]`
- Document tool usage in process steps
- Example from `commands/go.md`: `allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion]`

## Success Criteria & Checklists

**Format:**
- Use checkbox lists for verification: `- [ ] Item to check`
- Use bold for major categories
- Example from `skills/tdd/SKILL.md`:
```markdown
## Verification Checklist

- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
- [ ] Failed for expected reason (feature missing, not typo)
```

**Decision matrices:**
- Use tables to map conditions to actions
- Always include a "Condition" column, a "Result" column, and an "Action" column
- Example from `agents/shipit-executor.md`:
```markdown
| Level | Score | Criteria | Action |
|-------|-------|----------|--------|
| **HIGH** | 80-100% | Clear requirements | Execute normally |
```

## State File Conventions

**State files live in `.shipit/` directory:**
- `.shipit/STATE.md` — Current execution position (Markdown frontmatter + status)
- `.shipit/PLAN.md` — Active plan with task breakdown (Markdown with YAML frontmatter)
- `.shipit/HANDOFF.md` — Cumulative context from completed tasks
- `.shipit/PROJECT_CONTEXT.md` — Shared codebase patterns (generated by conductor)
- `.shipit/LESSONS.md` — Review findings for future executors (learning loop)
- `.shipit/config.json` — Configuration (model profile, autonomy mode, MCP hooks)
- `.shipit/analytics.json` — Persistent analytics (trust score, cost, health trend)
- `.shipit/receipts/task-N.json` — Machine-verifiable proof of execution per task

**Documentation location:** Documented in `skills/shipit-core/SKILL.md` and `agents/shipit-conductor.md`

## Key Documentation Patterns

### The Iron Law Pattern

Foundational principles are stated as absolute rules:

```markdown
## The Iron Law

```
[STATEMENT IN CODE BLOCK]
```

[Explanation and rationalization prevention]
```

**Examples:**
- From `skills/tdd/SKILL.md`: `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`
- From `skills/verification-standards/SKILL.md`: `NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`

### Decision Point Pattern

Complex decisions are documented with:
1. Decision name
2. Options table (with pros/cons or cost/quality tradeoffs)
3. Recommendation
4. When each option applies

**Example from `skills/shipit-core/SKILL.md` (autonomy modes):**
```markdown
| Mode | Behavior | When to Use |
|------|----------|-------------|
| **guided** | Pause after EACH step | New projects, trust score < 30 |
| **supervised** | Auto-execute within waves | Default, day-to-day |
| **autonomous** | Full autopilot | Trust score > 70 |
```

### Anti-Pattern Table Pattern

Every violable convention documents what NOT to do:

```markdown
| Anti-Pattern | Why It's Bad | Do This Instead |
|-------------|-------------|-----------------|
| Pattern | Consequence | Correct approach |
```

**From `requirement-discovery/SKILL.md`:**
```markdown
| Asking 10 questions | User fatigue | Max 4 targeted questions |
```

---

*Convention analysis: 2026-04-01*
