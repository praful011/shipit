# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- Markdown - Core language for plugin definition (agents, commands, skills, docs)
- JavaScript/Node.js - Runtime hooks and utilities

**Secondary:**
- YAML - Frontmatter in agent/command definitions (metadata)
- JSON - Configuration and state files

## Runtime

**Environment:**
- Node.js (v14+, implicitly assumed)
- Claude Code CLI (latest version required)
- Bash shell (for git operations and utilities)

**Package Manager:**
- Node.js native (no external package manager for ShipIt itself)
- Note: This is a zero-dependency plugin — all logic expressed in Markdown with embedded tool calls

## Frameworks

**Core:**
- Claude Code Plugin Framework - Agent/command orchestration model
- MCP (Model Context Protocol) - Optional integration points for external services

**CLI Utilities:**
- Git CLI - Atomic commits, checkpoints, branch management
- Bash - Command execution, git operations, file inspection

## Key Dependencies

**Critical:**
- Claude Code CLI - Runtime environment for executing agents and commands
- Git - Version control, commit atomicity, branch checkpoints

**Infrastructure (Optional MCP Servers):**
- Engram - Blast radius analysis (optional, enhances planning)
- Depwire - Dependency graph queries (optional, enhances wave safety)
- Context7 - Up-to-date API documentation (optional, enhances research phase)
- Jira MCP - Ticket fetching for peer review workflow (optional, for /shipit:peer-review)
- GitLab MCP - Merge request operations (optional, for /shipit:peer-review)

## Configuration

**Environment:**
- Configured via `.shipit/config.json`
- No .env files — all sensitive credentials expected to be managed by Claude Code MCP integrations
- See `.claude/settings.local.json` for local Claude Code permissions

**Build:**
- `.claude-plugin/plugin.json` — Plugin metadata and version (v3.0.0)
- `.claude-plugin/marketplace.json` — Marketplace publishing configuration
- `hooks/hooks.json` — Statusline hook registration
- `settings.json` — Claude Code statusline command hook

**Key Config Files:**
- `.shipit/config.json` - Model profile (quality|balanced|budget), autonomy mode, adaptive models flag, MCP integrations, auto-commit setting
- `.shipit/STATE.md` - Runtime state: status, current task, total tasks, TDD phase, started_at timestamp
- `.shipit/PLAN.md` - Decomposed task plan with numbered steps
- `.shipit/DESIGN.md` - Design decisions for non-trivial tasks
- `.shipit/PROJECT_CONTEXT.md` - Shared codebase patterns for all agents
- `.shipit/LESSONS.md` - Learning from review findings (prevents repeat mistakes)
- `.shipit/analytics.json` - Trust score, success rates, cost history, code health trends

## Platform Requirements

**Development:**
- Claude Code CLI (latest)
- Git v2.0+
- Bash 4.0+
- Write permission in project directory for `.shipit/` state directory

**Production:**
- Claude Code plugin system
- Git remote access (for peer review workflow)
- Optional: MCP servers if integrations enabled

## Plugin Distribution

**Installation:**
- Via Claude Code marketplace: `/plugin marketplace add praful011/shipit`
- Or direct git clone: `claude --plugin-dir ./shipit`
- Location: `~/.claude/plugins/shipit` or custom via `--plugin-dir`

**Version:**
- Current: 3.0.0 (from `.claude-plugin/plugin.json`)
- Repository: `https://github.com/praful011/shipit`
- License: MIT

---

*Stack analysis: 2026-04-01*
