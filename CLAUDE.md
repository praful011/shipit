# ShipIt Plugin — Claude Code Guidelines

## Project Type
Claude Code plugin consisting of Markdown files: agents, commands, skills, docs.

## File Structure
- `agents/*.md` — Agent definitions with YAML frontmatter + XML-tagged sections
- `commands/*.md` — Command definitions with YAML frontmatter + XML-tagged sections
- `skills/*/SKILL.md` — Skill documentation with Prerequisites, Workflow, Components
- `.shipit/` — Runtime state (STATE.md, PLAN.md, HANDOFF.md, config.json, analytics.json)

## Conventions
- YAML frontmatter: `name`, `description` (and `allowed-tools` for commands)
- Process steps: `## Step N: Title` format, numbered sequentially
- Hard gates: `<CRITICAL_GATE>` XML tags
- Success criteria: `- [ ]` checkbox lists
- Error handling: Markdown tables mapping error to response
- Tool call examples in fenced code blocks
- Kebab-case for all file names

## No Build/Test
This is a pure documentation project. No build system, linter, or test runner.
Verification is structural: files exist, frontmatter is valid, cross-references are consistent.
