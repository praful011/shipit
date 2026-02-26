---
name: requirement-discovery
description: Socratic requirement discovery — interactive questioning to surface hidden requirements before planning
---

# Requirement Discovery

## Purpose

Surface hidden requirements, edge cases, and decisions BEFORE planning. The prompt review improves text quality. Requirement discovery improves CONTENT quality — it finds what the user forgot to mention.

## When to Use

- **Always** for large tasks (6+ files)
- **Optionally** for medium tasks if the task description is vague
- **Never** for quick tasks (too much overhead)

## Process

### Phase 1: Parse the Request
Identify what the user explicitly asked for. Then identify what's IMPLICIT:
- "Add auth" implies: user model, login endpoint, session/token management, middleware, logout, error handling
- "Add payment" implies: payment provider, webhook handling, error states, refund flow
- "Add API endpoint" implies: validation, error responses, auth, rate limiting, documentation

### Phase 2: Identify Decision Points
List decisions the user hasn't made:
- Technology choices (OAuth vs JWT, Redis vs Memcached)
- Behavior choices (what happens on error? on edge case?)
- Scope boundaries (does "add auth" include social login? 2FA? password reset?)

### Phase 3: Ask Focused Questions
Use AskUserQuestion with 2-4 targeted questions. Each question should:
- Be specific, not open-ended
- Offer concrete options (not "what do you think?")
- Include a recommended default
- Explain WHY the choice matters

**Good questions:**
```
"For user authentication, which approach?"
- Option 1: "JWT tokens (stateless, good for APIs) (Recommended)"
- Option 2: "Session cookies (stateful, good for web apps)"
- Option 3: "OAuth 2.0 (third-party auth)"
```

**Bad questions:**
- "What kind of auth do you want?" (too vague)
- "Should I add error handling?" (obviously yes)
- "Any preferences?" (not specific enough)

### Phase 4: Document Decisions
Append discovered requirements to the task description that gets passed to the planner:

```
Original: "Add user authentication"
Enriched: "Add user authentication with JWT tokens. Include: user registration endpoint, login endpoint returning JWT, auth middleware for protected routes, token refresh endpoint. Use bcrypt for password hashing. Return 401 for invalid/expired tokens. Store users in existing PostgreSQL database."
```

## Integration

Requirement discovery happens DURING the prompt review step (Step 1.5) when the orchestrator detects a vague task:

1. Score the prompt (existing prompt review)
2. If Specificity score < 60%: trigger requirement discovery
3. Ask 2-4 focused questions
4. Enrich the improved prompt with answers
5. Present enriched prompt to user for confirmation

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do This Instead |
|-------------|-------------|-----------------|
| Asking 10 questions | User fatigue, slows start | Max 4 targeted questions |
| Asking obvious questions | "Should I write tests?" wastes time | Only ask real decisions |
| Open-ended questions | "What do you want?" gets vague answers | Offer specific options |
| Asking after planning | Discoveries in planning require re-planning | Ask before planning |
