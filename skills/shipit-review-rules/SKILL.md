---
name: shipit-review-rules
description: Shared rule-pack for ShipIt internal reviewer — cross-language FAIL/PASS patterns for security, performance, and error-handling dimensions. Loaded by specialist review agents.
---

# ShipIt Review Rules

## Purpose

A shared source of truth for review patterns used by the `shipit-review` orchestration skill and its six specialist agents. Entries are cross-language; language-specific footguns are deliberately not shipped (modern Claude has strong baseline knowledge of language idioms). Project-specific language rules emerge via the learned-patterns skill (`pr-review-patterns`) when real reviews catch them.

## Category Files

| File | Scope |
|---|---|
| `security.md` | injection, auth/authz, secrets, XSS, SSRF, path traversal, unsafe deserialization |
| `performance.md` | N+1, blocking I/O on hot path, unbounded loops, missing indexes, inefficient regex |
| `error-handling.md` | swallowed errors, empty catch, misused fallbacks, unhandled promise rejections |

## Entry Format

Every rule in every category file uses this exact structure:

```markdown
### <pattern_key>  — <short title>
**Category:** Security | Correctness | Performance | Error Handling | Testing | Patterns | Intent
**Severity:** CRITICAL | IMPORTANT | MINOR
**Why it matters:** <1–2 sentences>
**Detection heuristic:** <what a reviewer looks for in the diff>

**FAIL**
\`\`\`<lang>
<code snippet showing the anti-pattern>
\`\`\`

**PASS**
\`\`\`<lang>
<code snippet showing the fix>
\`\`\`
```

`pattern_key` is a stable snake-case tag (e.g., `sql-injection-via-string-concat`). Specialists cite this key in their findings so downstream dedup and the learned-patterns skill can collapse repeated issues without LLM-judgment overlap checks.

## Usage

The `shipit-review` orchestration skill loads all three category files into the specialist input bundle at pre-process time. Specialists treat shipped rules and learned rules (`.claude/skills/pr-review-patterns/SKILL.md`) uniformly — one format, one mental model.
