---
name: codebase-context
description: Codebase context generation — shared PROJECT_CONTEXT.md for all agents
---

# Codebase Context

## Purpose

Generate a shared `PROJECT_CONTEXT.md` that ALL agents read. This prevents each agent from independently discovering patterns (wasting context) and ensures consistent code style across tasks.

## When to Generate

- During `/shipit:init` — create from initial codebase scan
- During the conductor's planning phase — refresh before planning
- When CLAUDE.md doesn't exist — auto-generate as fallback

## What to Capture

### Code Patterns (from 2-3 real examples)
```
## Code Examples

### Function style
```typescript
// From src/auth/middleware.ts:15
export async function verifyToken(req: Request): Promise<User | null> {
  // ... actual project code ...
}
```

### Test style
```typescript
// From src/auth/__tests__/middleware.test.ts:8
describe('verifyToken', () => {
  it('should return null for expired tokens', async () => {
    const result = await verifyToken(expiredReq);
    expect(result).toBeNull();
  });
});
```

### Error handling style
```typescript
// From src/api/users.ts:42
try {
  const user = await db.users.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
} catch (err) {
  logger.error('Failed to fetch user', { id, error: err });
  throw err;
}
```
```

### Conventions
- **Import style:** relative vs absolute, barrel exports
- **Naming:** camelCase/PascalCase/snake_case for files, functions, classes
- **File organization:** feature-based, layer-based, or hybrid
- **Error handling:** try/catch, Result types, error codes
- **Logging:** what logger, what format

### Infrastructure
- **Test runner:** framework, config location, run command
- **Linter:** tool, config location, run command
- **Build:** tool, config, output directory
- **Package manager:** npm, yarn, pnpm, bun

## Format

Write to `.shipit/PROJECT_CONTEXT.md`:

```markdown
# Project Context

> Auto-generated codebase analysis. ALL agents MUST read this before writing code.

## Conventions
- **Language:** TypeScript 5.x, strict mode
- **Import style:** Relative imports, barrel exports from index.ts
- **Naming:** camelCase for functions/variables, PascalCase for classes/types
- **File naming:** kebab-case.ts
- **Error handling:** try/catch with custom error classes, always log with context

## Code Examples

### How this project writes functions
[2-3 real code snippets from the actual codebase]

### How this project writes tests
[1-2 real test examples from the actual codebase]

### How this project handles errors
[1 real error handling example from the actual codebase]

## Infrastructure
- **Test:** vitest, run with `npm test`, config at vitest.config.ts
- **Lint:** eslint, run with `npm run lint`, config at .eslintrc.js
- **Build:** vite, run with `npm run build`, output at dist/

## Key Patterns
- All API routes use express Router pattern (see src/api/index.ts)
- Database access through repository pattern (see src/db/repositories/)
- Auth middleware required on all /api/* routes (see src/middleware/auth.ts)
```

## Rules

- **Real code only** — every example MUST come from the actual codebase with file:line reference
- **Max 100 lines** — keep it concise, agents have limited context
- **Update on each plan** — patterns may change as code evolves
- **No assumptions** — only document what you can verify from the code
