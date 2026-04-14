# ShipIt Internal Reviewer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first-party peer-review engine (`shipit-review`) that replaces the `pr-review-toolkit` dependency in `shipit-peer-reviewer` Step 3, preserving all surrounding Jira/GitLab automation, worktree pattern commits, and GitLab-issue creation.

**Architecture:** A new orchestration skill (`skills/shipit-review/SKILL.md`) spawns six specialist review agents in parallel (correctness, security, performance, error-handling, test, intent). A shared rule-pack skill (`skills/shipit-review-rules/`) holds cross-language FAIL/PASS patterns. A config flag (`peer_review.engine`) gates which engine runs so we can build alongside pr-review-toolkit and flip the default only after parity is verified.

**Tech Stack:** Markdown + YAML frontmatter (ShipIt is a doc-only plugin — no build, no runtime tests). Verification is **structural**: file presence, frontmatter validity, cross-reference consistency, and content-shape checks via `grep` and `Read`.

**Spec:** `docs/superpowers/specs/2026-04-14-shipit-internal-reviewer-design.md`

---

## Conventions for this plan

- **"Tests" in this plan are structural checks** — grep/Read verifications that prove a file exists, has expected frontmatter, or references the right names. Run them from the repo root: `/home/tops/Workspace/allplugin/shipit`.
- **Each new file must start with valid YAML frontmatter** containing at least `name` and `description`. Commands additionally need `allowed-tools`. Verify with: `head -20 <file>`.
- **Each task ends with a commit** scoped to just that task's files.
- **Rollout is feature-flagged** — tasks 1-12 build alongside the old path; task 13 adds the flag; task 14 branches on it. The old `pr-review-toolkit` code path stays live until a future plan handles Phase 3/4 cleanup.

---

### Task 1: Create rule-pack skill entry and security rules

**Files:**
- Create: `skills/shipit-review-rules/SKILL.md`
- Create: `skills/shipit-review-rules/security.md`

- [ ] **Step 1: Confirm target files don't exist (red)**

Run:
```bash
test ! -e skills/shipit-review-rules/SKILL.md && echo "SKILL.md absent ✓" || echo "FAIL: already exists"
test ! -e skills/shipit-review-rules/security.md && echo "security.md absent ✓" || echo "FAIL: already exists"
```
Expected: both `absent ✓`.

- [ ] **Step 2: Create the rule-pack skill entry**

Write `skills/shipit-review-rules/SKILL.md`:
```markdown
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
```

- [ ] **Step 3: Create `security.md` with canonical rules**

Write `skills/shipit-review-rules/security.md`:
````markdown
# Security Rules

Canonical FAIL/PASS patterns for the `shipit-security-reviewer` specialist. Every review loads this file via the `shipit-review` orchestration skill.

---

### sql-injection-via-string-concat — SQL query built by string concatenation
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** Attacker-controlled input flows unescaped into SQL, enabling exfiltration, tampering, or destructive statements.
**Detection heuristic:** diff adds a SQL string that contains a template placeholder, `+`, `f"..."` (Python), backtick interpolation (JS/TS), or `%s` with user input outside a parameter list.

**FAIL**
```python
query = f"SELECT * FROM users WHERE email = '{user_email}'"
cursor.execute(query)
```

**PASS**
```python
cursor.execute("SELECT * FROM users WHERE email = %s", (user_email,))
```

---

### hardcoded-secret-in-source — API key, token, or password literal in code
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** Secrets in source are exfiltratable via the repo, logs, and build artifacts, and they outlive the commit that added them.
**Detection heuristic:** diff adds a string literal matching secret-shaped patterns (sk-..., AKIA..., 32+ hex chars assigned to a variable named key/token/secret/password).

**FAIL**
```ts
const apiKey = "sk-proj-abc123def456..."
```

**PASS**
```ts
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error("OPENAI_API_KEY not configured")
```

---

### shell-exec-user-input — Shell command built from untrusted input
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** Shell metacharacters in user input enable arbitrary command execution on the host.
**Detection heuristic:** diff adds `exec`, `system`, `child_process.exec`, `os.system`, or backticks whose argument concatenates a variable that originated from request/input/body/argv.

**FAIL**
```js
child_process.exec(`ls ${userInput}`)
```

**PASS**
```js
child_process.execFile("ls", [userInput])
```

---

### missing-authz-on-mutating-route — Route that changes state does not verify caller's authority
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** Any authenticated user (or unauthenticated request if auth is missing entirely) can mutate data that should require ownership or a role.
**Detection heuristic:** diff adds or modifies a POST/PUT/PATCH/DELETE handler that references a record's owner/id but performs the mutation without checking caller vs. owner or role.

**FAIL**
```ts
app.delete("/users/:id", async (req, res) => {
  await db.users.delete({ where: { id: req.params.id } })
  res.status(204).end()
})
```

**PASS**
```ts
app.delete("/users/:id", requireAuth, async (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" })
  }
  await db.users.delete({ where: { id: req.params.id } })
  res.status(204).end()
})
```

---

### xss-via-innerhtml — User content rendered via innerHTML without sanitization
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** Attacker-controlled markup executes in the victim's browser context, enabling session theft, phishing, and drive-by attacks.
**Detection heuristic:** diff assigns `element.innerHTML =` or renders `dangerouslySetInnerHTML` with a value whose origin is request data, query params, DB content, or external API response.

**FAIL**
```ts
commentEl.innerHTML = comment.body
```

**PASS**
```ts
commentEl.textContent = comment.body
// or, if HTML really is required:
commentEl.innerHTML = DOMPurify.sanitize(comment.body, { ALLOWED_TAGS: ["b", "i", "em"] })
```

---

### ssrf-via-unchecked-url-fetch — Outbound fetch uses a URL supplied by the user
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** Attacker can pivot through the server to reach internal services (metadata endpoints, RDS, admin dashboards, link-local addresses) unreachable from the internet.
**Detection heuristic:** diff calls `fetch`/`requests.get`/`http.Get` with a URL that originated from request/input/body/params and no allowlist or IP-range validation is present.

**FAIL**
```ts
const resp = await fetch(req.body.imageUrl)
```

**PASS**
```ts
const parsed = new URL(req.body.imageUrl)
if (!ALLOWED_HOSTS.has(parsed.hostname)) {
  return res.status(400).json({ error: "host not allowed" })
}
const resp = await fetch(parsed.toString())
```

---

### path-traversal-via-join — File path built from user input without containment check
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** `..` segments in user input escape the intended directory, exposing arbitrary files readable by the process.
**Detection heuristic:** diff calls `path.join` / `os.path.join` / `filepath.Join` with a segment that originated from request data, and the resulting path is passed to open/read/send without a containment check.

**FAIL**
```py
full = os.path.join(UPLOAD_DIR, request.args["name"])
return send_file(full)
```

**PASS**
```py
name = request.args["name"]
full = os.path.realpath(os.path.join(UPLOAD_DIR, name))
if not full.startswith(os.path.realpath(UPLOAD_DIR) + os.sep):
    abort(400)
return send_file(full)
```

---

### unsafe-deserialization-of-user-input — Deserialization of a format that executes code or instantiates arbitrary classes from untrusted bytes
**Category:** Security
**Severity:** CRITICAL
**Why it matters:** Gadget chains in the deserializer reach RCE even if the application never explicitly calls dangerous code.
**Detection heuristic:** diff calls `pickle.loads`, `yaml.load` (without `SafeLoader`), `Marshal.load`, or `ObjectInputStream.readObject` on bytes that came from request/body/file-upload/cache/queue.

**FAIL**
```py
data = pickle.loads(request.body)
```

**PASS**
```py
data = json.loads(request.body)
# or, if binary is required: validate with a schema, not pickle
```
````

- [ ] **Step 4: Verify structure**

Run:
```bash
head -5 skills/shipit-review-rules/SKILL.md
grep -c "^### " skills/shipit-review-rules/security.md
grep -c "^\*\*FAIL\*\*$" skills/shipit-review-rules/security.md
grep -c "^\*\*PASS\*\*$" skills/shipit-review-rules/security.md
```
Expected: frontmatter starts with `---` and has `name:` + `description:`; 8 `###` entries in `security.md`; 8 FAIL and 8 PASS sections.

- [ ] **Step 5: Commit**

```bash
git add skills/shipit-review-rules/SKILL.md skills/shipit-review-rules/security.md
git commit -m "feat(reviewer): add rule-pack skill entry and security rules"
```

---

### Task 2: Add performance and error-handling rule files

**Files:**
- Create: `skills/shipit-review-rules/performance.md`
- Create: `skills/shipit-review-rules/error-handling.md`

- [ ] **Step 1: Confirm absent (red)**

Run:
```bash
test ! -e skills/shipit-review-rules/performance.md && echo "performance absent ✓" || echo "FAIL"
test ! -e skills/shipit-review-rules/error-handling.md && echo "error-handling absent ✓" || echo "FAIL"
```
Expected: both `absent ✓`.

- [ ] **Step 2: Create `performance.md`**

Write `skills/shipit-review-rules/performance.md`:
````markdown
# Performance Rules

Canonical FAIL/PASS patterns for the `shipit-performance-reviewer` specialist.

---

### n-plus-one-query-in-loop — Query issued inside a loop that iterates a parent set
**Category:** Performance
**Severity:** IMPORTANT
**Why it matters:** Latency scales linearly with the parent set size; scales catastrophically under load or with growing data.
**Detection heuristic:** diff adds a loop over a collection whose body calls a DB or HTTP client using a field from the iterated element.

**FAIL**
```ts
for (const user of users) {
  user.posts = await db.posts.findMany({ where: { userId: user.id } })
}
```

**PASS**
```ts
const posts = await db.posts.findMany({ where: { userId: { in: users.map(u => u.id) } } })
const byUser = new Map<string, Post[]>()
for (const p of posts) (byUser.get(p.userId) ?? byUser.set(p.userId, []).get(p.userId))!.push(p)
for (const user of users) user.posts = byUser.get(user.id) ?? []
```

---

### blocking-io-in-async-hot-path — Synchronous I/O inside an event-loop / request handler
**Category:** Performance
**Severity:** IMPORTANT
**Why it matters:** Blocks all concurrent work on the same worker; tail latency collapses under load.
**Detection heuristic:** diff inside an `async` function or request handler calls `fs.readFileSync`, `execSync`, blocking socket ops, or sync DB APIs.

**FAIL**
```ts
app.get("/config", (req, res) => {
  const raw = fs.readFileSync("config.json", "utf8")
  res.json(JSON.parse(raw))
})
```

**PASS**
```ts
app.get("/config", async (req, res) => {
  const raw = await fs.promises.readFile("config.json", "utf8")
  res.json(JSON.parse(raw))
})
```

---

### unbounded-loop-over-user-input — Iteration count supplied by request without a cap
**Category:** Performance
**Severity:** IMPORTANT
**Why it matters:** A single request can exhaust CPU or memory; trivially weaponized into DoS.
**Detection heuristic:** diff adds a `for` / `while` / `.map` / `Array.from({length: N})` whose iteration count comes from request.body/query/params and no max-bound is enforced.

**FAIL**
```ts
const items = Array.from({ length: req.body.count }, (_, i) => buildItem(i))
```

**PASS**
```ts
const count = Math.min(Math.max(0, req.body.count | 0), 1000)
const items = Array.from({ length: count }, (_, i) => buildItem(i))
```

---

### missing-index-on-hot-query — New query filters/sorts by a column with no index
**Category:** Performance
**Severity:** IMPORTANT
**Why it matters:** Full-table scans degrade as table grows; invisible until production data reaches a threshold.
**Detection heuristic:** diff adds a `WHERE col = ?`, `ORDER BY col`, or `JOIN ON col` on a large table where the column isn't the primary key and no matching index exists in recent schema migrations.

**FAIL**
```sql
-- query added in diff
SELECT * FROM audit_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50;
-- but no index on (tenant_id, created_at) exists in the schema
```

**PASS**
```sql
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created
  ON audit_events (tenant_id, created_at DESC);
```

---

### catastrophic-regex-backtracking — Regex with nested quantifiers applied to user input
**Category:** Performance
**Severity:** IMPORTANT
**Why it matters:** Pathological input triggers exponential backtracking → worker stalls for seconds or minutes per request.
**Detection heuristic:** diff adds a regex matching shapes like `(a+)+`, `(.*)*`, `(\w+)+` and applies it to user-controlled strings.

**FAIL**
```js
const re = /^(a+)+$/
re.test(req.body.value)
```

**PASS**
```js
const re = /^a+$/           // no nested quantifier
re.test(req.body.value)
```
````

- [ ] **Step 3: Create `error-handling.md`**

Write `skills/shipit-review-rules/error-handling.md`:
````markdown
# Error Handling Rules

Canonical FAIL/PASS patterns for the `shipit-error-handling-reviewer` specialist.

---

### empty-catch-swallows-error — try/catch with empty or log-only catch body
**Category:** Error Handling
**Severity:** IMPORTANT
**Why it matters:** The caller believes the operation succeeded; the system continues in a broken state with no signal.
**Detection heuristic:** diff adds a `catch` / `except` whose body is empty, a bare `pass`, `return null/[]/undefined`, or only a `console.log` with no rethrow and no alternative action.

**FAIL**
```ts
try {
  await processPayment(order)
} catch (e) {
  console.error(e)
}
```

**PASS**
```ts
try {
  await processPayment(order)
} catch (e) {
  logger.error("payment_failed", { orderId: order.id, err: e })
  throw new PaymentError("payment processing failed", { cause: e })
}
```

---

### return-empty-on-error-silent-drop — Catch returns empty collection, masking failure as "no results"
**Category:** Error Handling
**Severity:** CRITICAL
**Why it matters:** Downstream callers cannot distinguish "zero items" from "subsystem is broken," so failures compound silently across a fleet.
**Detection heuristic:** diff adds a helper whose catch block returns `[]`, `{}`, or `None` without logging, without a fleet-wide error counter, and without propagating to the caller.

**FAIL**
```ts
async function fetchCounties(utility: string): Promise<County[]> {
  try {
    return await db.counties.findMany({ where: { utility } })
  } catch {
    return []
  }
}
```

**PASS**
```ts
async function fetchCounties(utility: string): Promise<County[]> {
  try {
    return await db.counties.findMany({ where: { utility } })
  } catch (e) {
    logger.error("fetch_counties_failed", { utility, err: e })
    errorCounter.inc({ kind: "db", utility })
    return []
  }
}
// and: a fleet-wide check alerts when errorCounter exceeds N consecutive failures
```

---

### unhandled-promise-rejection — Async call without await or .catch
**Category:** Error Handling
**Severity:** IMPORTANT
**Why it matters:** Rejection is invisible to the caller; in Node it may terminate the process on future versions; in browsers it fills the console and masks real failures.
**Detection heuristic:** diff adds a bare call to an `async` function or a `.then()` chain without a terminal `.catch()` and not inside a try/catch.

**FAIL**
```ts
function onClick() {
  saveDraft(content)    // async, no await, no .catch
}
```

**PASS**
```ts
function onClick() {
  saveDraft(content).catch(e => {
    logger.error("save_draft_failed", { err: e })
    toast.error("Could not save draft — check your connection.")
  })
}
```

---

### fallback-masks-root-cause — Exception handler substitutes a default that hides a real bug
**Category:** Error Handling
**Severity:** IMPORTANT
**Why it matters:** Symptom goes away; root cause persists and ships. Debugging is harder because the stack trace never reaches a log.
**Detection heuristic:** diff's catch computes a default value (zero, empty, cached) when the error is not a known recoverable kind (e.g., `NotFoundError`).

**FAIL**
```py
try:
    balance = get_account_balance(user_id)
except Exception:
    balance = 0.0
```

**PASS**
```py
try:
    balance = get_account_balance(user_id)
except AccountNotFound:
    balance = 0.0
except Exception as e:
    logger.exception("balance lookup failed", extra={"user_id": user_id})
    raise
```
````

- [ ] **Step 4: Verify structure**

Run:
```bash
grep -c "^### " skills/shipit-review-rules/performance.md      # expect 5
grep -c "^### " skills/shipit-review-rules/error-handling.md   # expect 4
grep -c "^\*\*FAIL\*\*$" skills/shipit-review-rules/performance.md
grep -c "^\*\*PASS\*\*$" skills/shipit-review-rules/error-handling.md
```
Expected: 5, 4, 5, 4.

- [ ] **Step 5: Commit**

```bash
git add skills/shipit-review-rules/performance.md skills/shipit-review-rules/error-handling.md
git commit -m "feat(reviewer): add performance and error-handling rule packs"
```

---

### Task 3: Create `shipit-correctness-reviewer` specialist agent

**Files:**
- Create: `agents/shipit-correctness-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e agents/shipit-correctness-reviewer.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the agent file**

Write `agents/shipit-correctness-reviewer.md`:
```markdown
---
name: shipit-correctness-reviewer
description: |
  Correctness specialist for the ShipIt internal reviewer. Spawned by the shipit-review orchestration skill. Finds logic bugs, off-by-one, null refs, edge-case misses, copy-paste mistakes, wrong conditionals, dead branches. Returns structured JSON findings.
---

<role>
You are the correctness specialist for the ShipIt internal peer-review engine. You are spawned in parallel with five sibling specialists (security, performance, error-handling, test, intent) by the `shipit-review` skill. Your single job is to find correctness defects in the merge-request diff you are given.

**CRITICAL: Mandatory Initial Read**
If the prompt contains a `<files_to_read>` block, Read every file listed there before any other action.
</role>

<input>
You receive a JSON bundle with:
- `mode`: "efficiency" | "balanced" | "depth"
- `mr`: URL, IID, title, description, source_branch, target_branch, is_draft, author
- `ticket`: Jira ticket key, summary, description
- `diff`: compressed list of files with `path`, `language`, `hunks`, `truncated`, `skipped_files`
- `intent_summary`: 2–4 sentence synthesis of ticket + MR title/description
- `project`: `path`, `claude_md_excerpt`, `learned_rules`, `shipped_rules_refs`
</input>

<process>

## Step 1: Scope yourself

You are the correctness specialist. Do NOT flag security, performance, error-handling, test coverage, or intent-misalignment issues — those are owned by sibling specialists. Stay in your lane.

Within correctness, look for:
- **Off-by-one errors** — loop bounds, slice ranges, pagination, array indexing
- **Null / undefined refs** — calling a method or reading a field on a value that may be nullish on some path
- **Wrong conditionals** — `&&` vs `||`, inverted checks, missing negation, comparing the wrong side
- **Copy-paste mistakes** — a block duplicated with one value forgotten to be updated
- **Dead branches** — code unreachable under any realistic input
- **State-machine bugs** — impossible transitions, missing transitions
- **Concurrency hazards** — races, missing locks, non-atomic read-modify-write
- **Incorrect data-flow** — wrong variable passed, wrong key used to look up, semantics changed in subtle ways

## Step 2: Read the project's shipped and learned rules

The input bundle includes `project.learned_rules` (from `.claude/skills/pr-review-patterns/SKILL.md`) and `project.shipped_rules_refs`. Load them. When you find a pattern that matches a `pattern_key` from either source, cite that key in your finding.

## Step 3: Iterate the diff

For each hunk in each file:
1. Read the `hunks` and also read the surrounding file context via the Read tool if you need it to judge whether a change is safe.
2. If the diff references a function that lives elsewhere, Read that definition.
3. Write down every candidate correctness defect as you find it.

## Step 4: Self-challenge (balanced / depth modes only)

<CRITICAL_GATE>
If `mode` is `balanced` or `depth`, you MUST run this block before returning findings.
</CRITICAL_GATE>

For each candidate finding:
1. State the assumption that makes it a bug.
2. Try to disprove that assumption by reading adjacent code, the PR description, or the ticket.
3. If you cannot disprove it with the evidence available, keep the finding at `HIGH` confidence.
4. If partially disproved, lower confidence to `MEDIUM` but keep the finding.
5. If fully disproved, drop the finding.

In `efficiency` mode, skip this block and emit all candidate findings at the confidence the prompt judgment assigns.

## Step 5: Emit structured output

Return a single JSON object matching the schema in `<output_format>`. Do not write prose outside the JSON.
</process>

<output_format>
You MUST return exactly this JSON shape and nothing else:

```json
{
  "specialist": "shipit-correctness-reviewer",
  "findings": [
    {
      "severity": "CRITICAL | IMPORTANT | MINOR",
      "category": "Correctness",
      "pattern_key": "<stable snake-case tag>",
      "file": "<path from diff>",
      "line_start": 42,
      "line_end": 46,
      "description": "<one-sentence concise prose>",
      "prevention": "<one-sentence actionable rule>",
      "fail_snippet": "<the offending code>",
      "pass_snippet": "<the corrected code>",
      "confidence": "HIGH | MEDIUM | LOW"
    }
  ]
}
```

If you find nothing, return `{"specialist": "shipit-correctness-reviewer", "findings": []}`.

`pattern_key` MUST be a snake-case tag. Prefer an existing key from `project.learned_rules` or the shipped rule packs if one matches. If none matches, invent a tag in the form `<short-issue>-<short-modifier>` (e.g., `off-by-one-on-slice-end`, `nullish-deref-on-optional-field`).
</output_format>

<error_handling>
| Error | Response |
|---|---|
| Input bundle missing `diff` | Return `{"specialist": "shipit-correctness-reviewer", "findings": [], "error": "missing diff"}` |
| All diff files `truncated: true` | Emit findings from what is readable; add a MINOR finding `pattern_key: "review-truncated-by-compression"` noting the review was partial. |
</error_handling>

<success_criteria>
- [ ] Findings restricted to correctness dimension (no security/perf/error-handling/test/intent)
- [ ] Each finding cites a `pattern_key`
- [ ] Balanced/depth runs included a self-challenge pass
- [ ] Output is a single valid JSON object matching the schema
</success_criteria>
```

- [ ] **Step 3: Verify frontmatter and structure**

Run:
```bash
head -5 agents/shipit-correctness-reviewer.md
grep -c "<role>\|<input>\|<process>\|<output_format>\|<success_criteria>" agents/shipit-correctness-reviewer.md
```
Expected: first 5 lines include `---` / `name: shipit-correctness-reviewer` / `description:`; XML-tag count ≥ 10 (open + close for each of the 5 sections).

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-correctness-reviewer.md
git commit -m "feat(reviewer): add correctness specialist agent"
```

---

### Task 4: Create `shipit-security-reviewer` specialist agent

**Files:**
- Create: `agents/shipit-security-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e agents/shipit-security-reviewer.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the agent file**

Use the same structure as Task 3's agent but with these substitutions:
- `name`: `shipit-security-reviewer`
- `description`: `Security specialist for the ShipIt internal reviewer. Finds secrets, injection (SQL/command/template), auth/authz bypass, path traversal, unsafe deserialization, XSS, SSRF. Returns structured JSON findings.`
- Step 1 "Within correctness" block replaced with a "Within security" list: hardcoded secrets; SQL/command/template injection; authn/authz bypass (missing guard on mutating routes; IDOR); path traversal; SSRF; XSS via `innerHTML`/`dangerouslySetInnerHTML`; unsafe deserialization (`pickle.loads`, `yaml.load`); insecure crypto (MD5/SHA1 for passwords, `Math.random` for tokens); missing rate-limit on auth endpoints; CSRF on state-changing routes.
- `category` field in the output JSON: `"Security"`
- `specialist` field: `"shipit-security-reviewer"`
- Sibling list (in opening paragraph) names the other 5.

Write the full file following exactly the Task 3 template shape.

- [ ] **Step 3: Verify**

Run:
```bash
head -5 agents/shipit-security-reviewer.md
grep -c '"Security"' agents/shipit-security-reviewer.md
grep -c 'shipit-security-reviewer' agents/shipit-security-reviewer.md
```
Expected: valid frontmatter; `"Security"` appears in the output schema; agent name referenced at least 3 times (frontmatter + output spec + success criteria).

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-security-reviewer.md
git commit -m "feat(reviewer): add security specialist agent"
```

---

### Task 5: Create `shipit-performance-reviewer` specialist agent

**Files:**
- Create: `agents/shipit-performance-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e agents/shipit-performance-reviewer.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the agent file**

Use the Task 3 template with these substitutions:
- `name`: `shipit-performance-reviewer`
- `description`: `Performance specialist for the ShipIt internal reviewer. Finds N+1 queries, blocking I/O on hot path, unbounded loops over user input, missing indexes on hot queries, catastrophic-backtracking regexes. Returns structured JSON findings.`
- Step 1 scope: N+1 query patterns; blocking sync I/O inside async handlers or event loops; unbounded loops / allocations whose size comes from user input; missing indexes on new WHERE/ORDER/JOIN columns (inspect schema migrations in the diff or recent history); catastrophic regex backtracking; expensive re-renders / re-computations inside hot paths; missing pagination on list endpoints.
- `category` in output: `"Performance"`
- `specialist`: `"shipit-performance-reviewer"`

- [ ] **Step 3: Verify** — same shape as Task 4 Step 3.

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-performance-reviewer.md
git commit -m "feat(reviewer): add performance specialist agent"
```

---

### Task 6: Create `shipit-error-handling-reviewer` specialist agent

**Files:**
- Create: `agents/shipit-error-handling-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e agents/shipit-error-handling-reviewer.md && echo ok`

- [ ] **Step 2: Write the agent file**

Use Task 3 template with these substitutions:
- `name`: `shipit-error-handling-reviewer`
- `description`: `Error-handling specialist for the ShipIt internal reviewer. Finds swallowed errors, empty catch, fallbacks that mask root causes, silent-drop-then-continue, unhandled promise rejections. Returns structured JSON findings.`
- Step 1 scope: empty or log-only catch blocks; `return []`/`{}`/`None` in catch without logging + counter; unhandled promise rejections (missing `await`/`.catch`); fallbacks that substitute defaults for unknown error kinds; removal of try/catch in refactors without an explicit reason; missing error propagation in middleware; silent drop of failures inside background tasks / workers.
- `category` in output: `"Error Handling"`
- `specialist`: `"shipit-error-handling-reviewer"`

- [ ] **Step 3: Verify** — same shape as Task 4 Step 3.

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-error-handling-reviewer.md
git commit -m "feat(reviewer): add error-handling specialist agent"
```

---

### Task 7: Create `shipit-test-reviewer` specialist agent

**Files:**
- Create: `agents/shipit-test-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e agents/shipit-test-reviewer.md && echo ok`

- [ ] **Step 2: Write the agent file**

Use Task 3 template with these substitutions:
- `name`: `shipit-test-reviewer`
- `description`: `Test specialist for the ShipIt internal reviewer. Judges whether new logic has adequate test coverage, flags missing edge-case tests, identifies flaky patterns and mock-over-integration concerns. Returns structured JSON findings.`
- Step 1 scope: new non-trivial logic merged without any accompanying test change; tests that only check the happy path when the logic has obvious error branches; tests that mock the system under test; tests that assert on implementation details instead of behavior; flaky patterns (time-based assertions, network in unit tests, parallel-test shared state); tests that would pass even if the implementation were broken (circular testing).
- `category` in output: `"Testing"`
- `specialist`: `"shipit-test-reviewer"`

- [ ] **Step 3: Verify** — same shape as Task 4 Step 3.

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-test-reviewer.md
git commit -m "feat(reviewer): add test specialist agent"
```

---

### Task 8: Create `shipit-intent-reviewer` specialist agent

**Files:**
- Create: `agents/shipit-intent-reviewer.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e agents/shipit-intent-reviewer.md && echo ok`

- [ ] **Step 2: Write the agent file**

Use Task 3 template with these substitutions:
- `name`: `shipit-intent-reviewer`
- `description`: `Intent specialist for the ShipIt internal reviewer. Judges whether the diff matches the stated intent (Jira ticket + MR description), flags scope creep and over-broad changes. Returns structured JSON findings.`
- Step 1 scope: diff contains changes unrelated to the stated intent (scope creep); diff solves a different problem than the ticket/description implies (wrong problem); significant refactor mixed into a fix commit without justification; ticket's acceptance criteria partially unaddressed by the diff; the change overshoots the ticket (over-broad) when a narrow change was sufficient.
- `category` in output: `"Intent"`
- `specialist`: `"shipit-intent-reviewer"`
- Unique input note: this specialist leans heavily on `ticket` and `intent_summary`. Re-read both before every finding.

- [ ] **Step 3: Verify** — same shape as Task 4 Step 3.

- [ ] **Step 4: Commit**

```bash
git add agents/shipit-intent-reviewer.md
git commit -m "feat(reviewer): add intent specialist agent"
```

---

### Task 9: Create `shipit-review` orchestration skill

**Files:**
- Create: `skills/shipit-review/SKILL.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e skills/shipit-review/SKILL.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the orchestration skill**

Write `skills/shipit-review/SKILL.md`:
````markdown
---
name: shipit-review
description: ShipIt internal peer-review engine — orchestrates six specialists (correctness, security, performance, error-handling, test, intent) across three user-selectable modes (efficiency, balanced, depth) and returns a structured JSON finding list for shipit-peer-reviewer to post, categorize, and act on.
---

# ShipIt Review Engine

## Purpose

The review engine called by `shipit-peer-reviewer` at Step 3. Replaces the external `pr-review-toolkit:review-pr` skill with a first-party implementation. Only Step 3 of the peer-review flow changes — Jira/GitLab listing, selection, comment posting, approval, worktree-based pattern commits, and GitLab-issue creation all remain owned by the peer-reviewer agent.

## Prerequisites

| Dependency | Required | Notes |
|---|---|---|
| GitLab MCP | Yes | `shipit-peer-reviewer` has already used it to fetch the MR metadata + diff before calling this skill |
| Rule-pack files | Yes | `skills/shipit-review-rules/security.md`, `performance.md`, `error-handling.md` |
| Specialist agents | Yes | `shipit-correctness-reviewer`, `shipit-security-reviewer`, `shipit-performance-reviewer`, `shipit-error-handling-reviewer`, `shipit-test-reviewer`, `shipit-intent-reviewer` |

## Input

The caller (`shipit-peer-reviewer`) invokes this skill with:

```json
{
  "mode": "efficiency|balanced|depth",
  "mr": { "url": "...", "iid": "...", "title": "...", "description": "...",
          "source_branch": "...", "target_branch": "...", "is_draft": false, "author": "..." },
  "ticket": { "key": "PROJ-123", "summary": "...", "description": "..." },
  "raw_diff": "<unified diff text from GitLab MCP>",
  "project_path": "<absolute path to reviewed repo>",
  "source_branch": "<MR source branch>"
}
```

## Process

### 1. Pre-process

1. **Parse the diff.** Split into per-file hunks. Tag each file with a language (from extension: `.ts`/`.tsx` → ts, `.py` → py, `.go` → go, `.rs` → rust, etc.).
2. **Skip non-review files.** Exclude lockfiles (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `poetry.lock`, `pnpm-lock.yaml`), generated files (`dist/`, `build/`, `*.pb.go`), vendored dirs (`node_modules/`, `vendor/`), and binary files. Record them in `skipped_files`.
3. **Apply PR compression** if total retained-diff size exceeds the token budget (threshold: ≥ 80 000 characters of diff text):
   - Sort retained files by importance: source > config/schema > tests > docs.
   - Chunk any single file whose own diff exceeds 20 000 characters into ≤ 20 000-char chunks, marking `truncated: true` on any chunks that get dropped past budget.
4. **Load project context.**
   - Read `<project_path>/CLAUDE.md` if present; capture ≤ 2 000 characters as `claude_md_excerpt`.
   - Read `<project_path>/.claude/skills/pr-review-patterns/SKILL.md` if present; parse rule entries; write them into `project.learned_rules`.
   - Resolve the three shipped rule-pack paths: `skills/shipit-review-rules/security.md`, `performance.md`, `error-handling.md`. Pass the absolute paths as `project.shipped_rules_refs`.
5. **Synthesize `intent_summary`.** 2–4 sentences merging: `ticket.summary` + `ticket.description` + `mr.title` + `mr.description`. State what the author intends to change and why.

### 2. Dispatch specialists in parallel

Spawn six `Agent` calls in a single tool-call block (so they run concurrently):

- `Agent(subagent_type: "shipit-correctness-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-security-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-performance-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-error-handling-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-test-reviewer", prompt: <bundle JSON>)`
- `Agent(subagent_type: "shipit-intent-reviewer", prompt: <bundle JSON>)`

The bundle JSON is the exact shape specified in each specialist's `<input>` section. Every specialist receives the same bundle with the same `mode`.

### 3. Depth-mode cross-pass

If `mode == "depth"`, after the six specialists return:

1. Concatenate all specialist findings into one list.
2. Build a randomized-chunk-order version of the diff: take the retained files, shuffle file order, and re-linearize the hunks.
3. Spawn one more `Agent(subagent_type: "general-purpose", prompt: <aggregator prompt>)` that receives the randomized-order diff and the combined findings list. Instruct it to:
   - Identify findings that should be dropped (duplicates, disproven).
   - Identify findings that were missed and should be added.
   - Return a `{ added: [...], dropped_pattern_keys: [...] }` JSON object.
4. Apply the aggregator's adds/drops.

### 4. Aggregate

1. **Dedup** across specialists: collapse findings with the same `(file, line_start, line_end, pattern_key)` tuple. Keep the highest-confidence copy. If they disagree on severity, keep the highest.
2. **Bucket** by severity into `critical`, `important`, `minor`.
3. **Rank within each bucket** by confidence (HIGH > MEDIUM > LOW), then by dimension order (Security > Correctness > Error Handling > Performance > Testing > Intent > Patterns).
4. **Compute `verdict_hint`:**
   - Any CRITICAL → `REQUEST_CHANGES`
   - Else 2+ IMPORTANT → `REQUEST_CHANGES`
   - Else 1 IMPORTANT of category Security or Correctness → `REQUEST_CHANGES`
   - Else → `APPROVE`
5. **Compose `summary`:** 2–3 sentences naming the most significant findings and overall code quality.

### 5. Return

Return a single JSON object:

```json
{
  "verdict_hint": "APPROVE | REQUEST_CHANGES",
  "critical": [ <finding>, ... ],
  "important": [ <finding>, ... ],
  "minor": [ <finding>, ... ],
  "summary": "<2–3 sentence overview>"
}
```

Every `<finding>` preserves the specialist's output schema fields (`severity`, `category`, `pattern_key`, `file`, `line_start`, `line_end`, `description`, `prevention`, `fail_snippet`, `pass_snippet`, `confidence`).

## Error Handling

| Error | Response |
|---|---|
| A specialist returns invalid JSON | Retry once with a stricter prompt. If still invalid, treat as empty findings and include a MINOR finding `pattern_key: "specialist-output-malformed"` naming which specialist. |
| A specialist times out | Treat as empty findings; include a MINOR finding `pattern_key: "specialist-timeout"`. |
| Depth-mode aggregator fails | Skip the cross-pass (falls back to balanced behavior). Include a MINOR finding `pattern_key: "depth-aggregator-skipped"`. |
| PR compression cannot fit within budget | Review the highest-importance chunks only; include a MINOR finding `pattern_key: "review-truncated-by-compression"` noting which files were skipped. |

## Success Criteria

- [ ] All six specialists were spawned in parallel
- [ ] Depth mode ran the aggregator; other modes did not
- [ ] Findings deduped by `(file, line_start, line_end, pattern_key)` tuple
- [ ] `verdict_hint` computed via the fixed rubric
- [ ] Output is a single valid JSON object matching the schema above
````

- [ ] **Step 3: Verify structure**

Run:
```bash
head -5 skills/shipit-review/SKILL.md
grep -c 'shipit-.*-reviewer' skills/shipit-review/SKILL.md       # expect ≥ 6
grep -c 'verdict_hint' skills/shipit-review/SKILL.md             # expect ≥ 3
grep -c 'pattern_key' skills/shipit-review/SKILL.md              # expect ≥ 4
```

- [ ] **Step 4: Commit**

```bash
git add skills/shipit-review/SKILL.md
git commit -m "feat(reviewer): add shipit-review orchestration skill"
```

---

### Task 10: Add `peer_review` block to default `.shipit/config.json`

**Files:**
- Modify: `.shipit/config.json`

- [ ] **Step 1: Read current config**

Run: `cat .shipit/config.json`
Expected current contents:
```json
{
  "model_profile": "balanced",
  "autonomy_mode": "autonomous",
  "adaptive_models": false,
  "tdd": false,
  "auto_commit": true
}
```

- [ ] **Step 2: Verify the new `peer_review` block is absent (red)**

Run: `grep -c '"peer_review"' .shipit/config.json`
Expected: `0`.

- [ ] **Step 3: Add the block**

Replace the file contents with:
```json
{
  "model_profile": "balanced",
  "autonomy_mode": "autonomous",
  "adaptive_models": false,
  "tdd": false,
  "auto_commit": true,
  "peer_review": {
    "engine": "pr-review-toolkit",
    "default_mode": "balanced",
    "ask_mode_each_run": true
  }
}
```

Note: `engine` defaults to `pr-review-toolkit` during Phase 1 — the new engine is wired up but gated. A future plan flips the default to `shipit-review` once parity is confirmed.

- [ ] **Step 4: Verify the block is present (green)**

Run:
```bash
python3 -c "import json; c = json.load(open('.shipit/config.json')); pr = c['peer_review']; print('engine =', pr['engine']); print('default_mode =', pr['default_mode']); print('ask_mode_each_run =', pr['ask_mode_each_run'])"
```
Expected:
```
engine = pr-review-toolkit
default_mode = balanced
ask_mode_each_run = True
```

- [ ] **Step 5: Commit**

```bash
git add .shipit/config.json
git commit -m "feat(reviewer): add peer_review config block (gated on pr-review-toolkit)"
```

---

### Task 11: Add mode selector prompt to `/shipit:peer-review` command

**Files:**
- Modify: `commands/peer-review.md`

- [ ] **Step 1: Identify the insertion point**

Run:
```bash
grep -n "Step 6: Spawn shipit-peer-reviewer\|Spawn the peer-reviewer agent" commands/peer-review.md
```
Use the first matching line as the anchor. The new mode selector runs immediately before that step. If the anchor is not present, search for the `git fetch origin` hard gate and insert after it.

- [ ] **Step 2: Verify the selector is absent (red)**

Run: `grep -c 'ask_mode_each_run\|Which review mode' commands/peer-review.md`
Expected: `0`.

- [ ] **Step 3: Insert the new step**

Immediately before the step that spawns `shipit-peer-reviewer`, insert a new step:

````markdown
## Step 5.5: Ask Review Mode

Read `.shipit/config.json`. If `peer_review.ask_mode_each_run` is `false`, skip this step and use `peer_review.default_mode` as the `<MODE>` value passed to the agent in the next step.

Otherwise use `AskUserQuestion`:

```
AskUserQuestion(
  question: "Which review mode should the reviewer use for this MR?",
  options: [
    { label: "Balanced (Recommended)", description: "Specialists self-challenge before reporting (~1–2 min)" },
    { label: "Efficiency",             description: "Fastest, lowest cost (~30–60 s)" },
    { label: "Depth",                  description: "Balanced + randomized cross-pass for highest catch rate (~2–4 min)" }
  ]
)
```

Map the selection to the `<MODE>` token: `Balanced → balanced`, `Efficiency → efficiency`, `Depth → depth`.

Pass `<MODE>` as an explicit field in the `Review Mode:` line of the agent prompt in Step 6. The reviewer will forward it to the `shipit-review` skill.
````

- [ ] **Step 4: Update the Step-6 (spawn) prompt payload**

Find the `Task(...)` invocation that spawns `shipit-peer-reviewer`. In its `prompt` argument, add a new bullet line after the GitLab Project Path line:

```
Review Mode: <MODE>
```

- [ ] **Step 5: Verify (green)**

Run:
```bash
grep -c 'Step 5.5: Ask Review Mode' commands/peer-review.md
grep -c 'Review Mode: <MODE>' commands/peer-review.md
```
Expected: `1` and `≥ 1`.

- [ ] **Step 6: Commit**

```bash
git add commands/peer-review.md
git commit -m "feat(reviewer): add review-mode selector to /shipit:peer-review"
```

---

### Task 12: Branch `shipit-peer-reviewer` Step 3 on the engine flag

**Files:**
- Modify: `agents/shipit-peer-reviewer.md`

This is the switch that turns on the new engine without removing the old one. The specifics:
- Accept a `Review Mode:` input.
- At Step 3, read `peer_review.engine` from `.shipit/config.json`.
- If `shipit-review`: call the new skill with the bundle.
- Else: call `pr-review-toolkit:review-pr` (existing behavior).

- [ ] **Step 1: Read current Step 3 and input block**

Run:
```bash
grep -n "## Step 1: Parse Input\|## Step 3: Run Code Review" agents/shipit-peer-reviewer.md
sed -n '18,40p' agents/shipit-peer-reviewer.md    # the <project_context> block
sed -n '48,75p' agents/shipit-peer-reviewer.md    # Step 3
```
Record the current line ranges for the subsequent edits.

- [ ] **Step 2: Add `Review Mode` to the input contract**

In the `<project_context>` block, under "Input from command:", add a bullet:

```
- `Review Mode` — one of `efficiency` | `balanced` | `depth` (from /shipit:peer-review Step 5.5)
```

- [ ] **Step 3: Replace Step 3 body with an engine-switch**

Replace the entire Step 3 section (including `<CRITICAL_GATE>`) with:

````markdown
## Step 3: Run Code Review (Engine-Switched)

Read `peer_review.engine` from `.shipit/config.json` in the ShipIt plugin root (not the reviewed project).

### 3a. If engine == "shipit-review" (new first-party engine)

<CRITICAL_GATE>
Your very next tool call in this step MUST be:

```
Skill(skill: "shipit:shipit-review", args: {
  "mode": "<Review Mode from input>",
  "mr": { "url": "<MR URL>", "iid": "<IID>", "title": "<title>", "description": "<description>",
          "source_branch": "<MR Source Branch>", "target_branch": "<MR Target Branch>",
          "is_draft": <bool>, "author": "<author>" },
  "ticket": { "key": "<Jira Key>", "summary": "<summary>", "description": "<description>" },
  "raw_diff": "<unified diff from Step 2>",
  "project_path": "<cwd of reviewed repo>",
  "source_branch": "<MR Source Branch>"
})
```

This is a HARD GATE. Do NOT review the diff yourself in this branch. Do NOT spawn specialist agents directly. The `shipit-review` skill owns the whole review pipeline and returns findings in the schema below.
</CRITICAL_GATE>

### 3b. If engine == "pr-review-toolkit" (legacy — unchanged behavior)

<CRITICAL_GATE>
Your very next tool call MUST be:

```
Skill(skill: "pr-review-toolkit:review-pr", args: "<MR_URL>")
```

This is a HARD GATE. Call the Skill tool, wait for results, proceed.
</CRITICAL_GATE>

### 3c. Either way — normalize findings

Both engines return a finding list. Normalize into an internal structure:

```json
{
  "verdict_hint": "APPROVE | REQUEST_CHANGES",
  "critical": [ {severity, category, pattern_key, file, line_start, line_end, description, prevention, fail_snippet, pass_snippet, confidence} ],
  "important": [...],
  "minor": [...],
  "summary": "<2–3 sentence overall>"
}
```

If the legacy `pr-review-toolkit` result lacks `pattern_key` or `line_start/line_end`, synthesize them from the available file + description fields so downstream steps (Step 6.5 dedup, Step 5 inline comments) work uniformly. Synthesized `pattern_key` values use the form `<category-short>-legacy-<short-slug>`.
````

- [ ] **Step 4: Update Step 4 to add the draft-MR branch**

Find `## Step 4: Categorize Review Outcome`. Replace its body with:

```markdown
## Step 4: Categorize Review Outcome

Three verdicts now:

- **COMMENTS_ONLY** — when `mr.is_draft === true`. Comments will be posted (Step 5) and patterns/issues still extracted (Step 6.5/6.6), but no approve or request-changes action on GitLab.
- **REQUEST CHANGES** — when the review found:
  - Any CRITICAL issue, OR
  - 2 or more IMPORTANT issues, OR
  - 1 IMPORTANT issue of category Security or Correctness.
- **APPROVE** — otherwise.
```

- [ ] **Step 5: Skip Step 6 when `COMMENTS_ONLY`**

Find `## Step 6: Approve or Request Changes`. At the top of the step, add:

```markdown
**If verdict is `COMMENTS_ONLY`: skip this step entirely. Do not approve. Do not request changes. Proceed to Step 6.5.**
```

- [ ] **Step 6: Update the success-criteria checklist**

In `<success_criteria>`, replace the line `- [ ] Code review performed via /pr-review-toolkit:review-pr` with:

```
- [ ] Code review performed via Step 3a (`shipit-review`) or Step 3b (`pr-review-toolkit:review-pr`) per config
- [ ] `Review Mode` input captured and forwarded when using `shipit-review`
- [ ] `COMMENTS_ONLY` branch handled when `mr.is_draft === true`
```

- [ ] **Step 7: Verify (green)**

Run:
```bash
grep -c 'Step 3a\|Step 3b' agents/shipit-peer-reviewer.md           # expect ≥ 2
grep -c 'shipit:shipit-review' agents/shipit-peer-reviewer.md       # expect ≥ 1
grep -c 'COMMENTS_ONLY' agents/shipit-peer-reviewer.md              # expect ≥ 3
grep -c 'Review Mode' agents/shipit-peer-reviewer.md                # expect ≥ 2
```

- [ ] **Step 8: Commit**

```bash
git add agents/shipit-peer-reviewer.md
git commit -m "feat(reviewer): engine-switch Step 3, draft-MR COMMENTS_ONLY branch"
```

---

### Task 13: Upgrade learned-patterns skill format in Step 6.5

**Files:**
- Modify: `agents/shipit-peer-reviewer.md` (Step 6.5 only)

The old Step 6.5 writes free-prose patterns with `_Pattern:_ / _Prevention:_`, dedupes by LLM-judgment overlap, and caps globally at 30. We replace all three with `pattern_key`-based logic and the shared rule-pack entry format.

- [ ] **Step 1: Read current Step 6.5 subsections**

Run:
```bash
grep -n "### 6.5.1\|### 6.5.2\|### 6.5.3\|### 6.5.4\|### 6.5.5\|### 6.5.6\|### Skill File Template" agents/shipit-peer-reviewer.md
```
Record line numbers for each subsection.

- [ ] **Step 2: Replace the entry format (6.5.1) and template**

Find subsection `### 6.5.1: Filter and Generalize Findings`. Replace its body with:

````markdown
From the review results, extract each CRITICAL and IMPORTANT finding. For each, produce an entry in the **rule-pack format** (same shape as `skills/shipit-review-rules/*.md`):

```markdown
### <pattern_key>  — <short title>
**Category:** Security | Correctness | Performance | Error Handling | Testing | Patterns | Intent
**Severity:** CRITICAL | IMPORTANT
**Why it matters:** <1–2 generalized sentences; no MR-specific names>
**Detection heuristic:** <what a reviewer should look for in a diff>

**FAIL**
\`\`\`<lang>
<generalized code showing the anti-pattern>
\`\`\`

**PASS**
\`\`\`<lang>
<generalized code showing the fix>
\`\`\`

<!-- meta: created_date=YYYY-MM-DD applied_count=0 last_matched_date=YYYY-MM-DD -->
```

Use the `pattern_key` produced by the specialist in Step 3's JSON output. Do NOT invent a new key if one exists.
````

- [ ] **Step 3: Replace the template file section**

Find `### Skill File Template`. Replace its fenced `markdown` block with:

````markdown
```markdown
---
name: pr-review-patterns
description: Code patterns to avoid — learned from peer reviews. Read before writing code.
---

<!-- shipit:review-counter=0 -->

# Learned Patterns from Peer Reviews

Patterns below were captured during peer reviews and use the shared rule-pack format
(see `skills/shipit-review-rules/` in the ShipIt plugin). Each entry has a stable
`pattern_key`, category, severity, why, detection heuristic, FAIL and PASS snippets,
and a meta line tracking applied_count + last_matched_date.

**Per-category caps:** Security 10, Error Handling 8, Performance 6, Patterns 4, Testing 4.
**Eviction:** Entry removed when `applied_count == 0` and 20+ reviews have happened since
`created_date`, OR `last_matched_date` is older than 90 days and `applied_count < 3`.

## Security
_No patterns yet._

## Error Handling
_No patterns yet._

## Patterns
_No patterns yet._

## Testing
_No patterns yet._

## Performance
_No patterns yet._
```
````

- [ ] **Step 4: Replace dedup logic (6.5.3 and 6.5.4)**

Find `### 6.5.3: Clean Up Existing Duplicates` and `### 6.5.4: Deduplicate New Patterns Against Existing Entries`. Replace BOTH subsections with one new subsection:

````markdown
### 6.5.3: Deduplicate by `pattern_key`

Dedup is a pure string match on the `pattern_key` field. No LLM-judgment semantic-overlap check.

For each new finding:
1. Search existing entries for one with the same `pattern_key`.
2. If found: increment its `applied_count` in the meta line, update `last_matched_date` to today's date, do NOT add a new entry.
3. If not found: add the new entry under the matching `## <Category>` heading with `created_date = today`, `applied_count = 0`, `last_matched_date = today`.

After adding new entries, scan for a consolidation opportunity: if 3+ entries in the same category share a common `pattern_key` prefix (e.g., `sql-injection-*`), add a TODO comment at the top of the category section proposing a merged rule. Do not auto-merge — leave the suggestion for a human reviewer.
````

- [ ] **Step 5: Replace the 30-entry cap (6.5.5)**

Find `### 6.5.5: Enforce 30-Entry Cap`. Replace its body with:

````markdown
### 6.5.5: Enforce Per-Category Caps and Aging Eviction

**Caps:**

| Category | Max entries |
|---|---|
| Security | 10 |
| Error Handling | 8 |
| Performance | 6 |
| Patterns | 4 |
| Testing | 4 |

**Before adding a new entry**, if the target category is at its cap, evict the least valuable existing entry in that category using the following order:

1. **Expired by age** — entries where `applied_count == 0` and 20+ reviews have happened since `created_date`.
2. **Expired by staleness** — entries where `last_matched_date > 90 days ago` and `applied_count < 3`.
3. **Lowest `applied_count`** — tie-break on oldest `created_date`.

Increment the file-header review counter (`<!-- shipit:review-counter=N -->`) by 1 every time Step 6.5 runs, regardless of whether new entries were added.

CRITICAL entries still take priority: if a CRITICAL is being added and the only available evictable entries are other CRITICAL entries, skip the cap for this run rather than evict another CRITICAL.
````

- [ ] **Step 6: Update the file-write subsection (6.5.6)**

Find `### 6.5.6: Write Updated Skill File`. Replace the "Each entry format" block with:

```markdown
Each entry uses the rule-pack format defined in 6.5.1. Entries live under the matching `## <Category>` heading and are separated by `---` dividers. The file-header review counter (`<!-- shipit:review-counter=N -->`) is incremented once per Step 6.5 run.
```

- [ ] **Step 7: Verify (green)**

Run:
```bash
grep -c 'pattern_key' agents/shipit-peer-reviewer.md                 # expect ≥ 3
grep -c 'applied_count' agents/shipit-peer-reviewer.md               # expect ≥ 4
grep -c 'rule-pack format' agents/shipit-peer-reviewer.md            # expect ≥ 1
grep -c 'Per-category caps\|Per-Category Caps' agents/shipit-peer-reviewer.md   # expect ≥ 1
grep -c '>80% semantic overlap' agents/shipit-peer-reviewer.md       # expect 0 (old dedup removed)
```

- [ ] **Step 8: Commit**

```bash
git add agents/shipit-peer-reviewer.md
git commit -m "feat(reviewer): upgrade learned-patterns skill to rule-pack format + pattern_key dedup"
```

---

### Task 14: Update `skills/peer-review/SKILL.md` documentation

**Files:**
- Modify: `skills/peer-review/SKILL.md`

- [ ] **Step 1: Read current prerequisites**

Run:
```bash
grep -n 'pr-review-toolkit\|review engine' skills/peer-review/SKILL.md
```

- [ ] **Step 2: Update prerequisites table**

Replace the row `| `/pr-review-toolkit:review-pr` | Yes | Existing code review skill used as the review engine |` with:

```
| `shipit:shipit-review` (new) or `pr-review-toolkit:review-pr` (legacy) | Yes | Review engine. Selected by `peer_review.engine` in `.shipit/config.json`. Default is `pr-review-toolkit` during Phase 1; flips to `shipit-review` after parity verification. |
```

- [ ] **Step 3: Update workflow diagram and Integration Points**

In the ASCII workflow, replace the line `[8] Agent runs /pr-review-toolkit:review-pr` with:

```
[8] Agent runs Skill("shipit:shipit-review", ...) OR /pr-review-toolkit:review-pr (by config)
```

In the `## Integration Points` table, replace the `**pr-review-toolkit**` row with two rows:

```
| **shipit-review** (new) | First-party review engine. Orchestrates six specialists (correctness, security, performance, error-handling, test, intent) across three modes (efficiency/balanced/depth). |
| **pr-review-toolkit** (legacy, still supported) | External review engine kept live via `peer_review.engine = "pr-review-toolkit"` during Phase 1 rollout. |
```

- [ ] **Step 4: Add a "Review Mode" section**

Append immediately after the `## Workflow Overview` section:

```markdown
## Review Mode Selection

When `peer_review.ask_mode_each_run` is `true` (default), the command prompts the user at Step 5.5 to pick a mode:

| Mode | Behavior | Time |
|---|---|---|
| `efficiency` | 6 specialists, single pass each | ~30–60 s |
| `balanced` (default) | Specialists self-challenge before reporting | ~1–2 min |
| `depth` | Balanced + randomized cross-pass aggregator | ~2–4 min |

When `ask_mode_each_run` is `false`, `peer_review.default_mode` is used silently.
```

- [ ] **Step 5: Verify (green)**

Run:
```bash
grep -c 'shipit-review' skills/peer-review/SKILL.md                  # expect ≥ 3
grep -c 'ask_mode_each_run' skills/peer-review/SKILL.md              # expect ≥ 2
grep -c 'peer_review.engine' skills/peer-review/SKILL.md             # expect ≥ 1
```

- [ ] **Step 6: Commit**

```bash
git add skills/peer-review/SKILL.md
git commit -m "docs(peer-review): document shipit-review engine and mode selection"
```

---

### Task 15: Update shipit-core plugin index

**Files:**
- Modify: `skills/shipit-core/SKILL.md`

- [ ] **Step 1: Locate the agents table**

Run: `grep -n '^| \*\*shipit-' skills/shipit-core/SKILL.md`
Expected: a markdown table of agents with columns for name/purpose/model.

- [ ] **Step 2: Verify new agents absent (red)**

Run: `grep -c 'shipit-correctness-reviewer\|shipit-security-reviewer\|shipit-performance-reviewer\|shipit-error-handling-reviewer\|shipit-test-reviewer\|shipit-intent-reviewer' skills/shipit-core/SKILL.md`
Expected: `0`.

- [ ] **Step 3: Insert six new rows**

Immediately after the `shipit-peer-reviewer` row (or if absent, immediately after the `shipit-debugger` row), insert:

```markdown
| **shipit-correctness-reviewer** | Correctness specialist used by `shipit-review`: logic bugs, off-by-one, null refs, edge cases | sonnet |
| **shipit-security-reviewer** | Security specialist: secrets, injection, authz, XSS, SSRF, path traversal | sonnet |
| **shipit-performance-reviewer** | Performance specialist: N+1, blocking I/O, unbounded loops, missing indexes | sonnet |
| **shipit-error-handling-reviewer** | Error-handling specialist: swallowed errors, empty catch, silent drops | sonnet |
| **shipit-test-reviewer** | Test specialist: coverage of new logic, test quality, flaky patterns | sonnet |
| **shipit-intent-reviewer** | Intent specialist: diff-vs-intent alignment, scope creep | sonnet |
```

- [ ] **Step 4: Verify (green)**

Run:
```bash
grep -c 'shipit-correctness-reviewer\|shipit-security-reviewer\|shipit-performance-reviewer\|shipit-error-handling-reviewer\|shipit-test-reviewer\|shipit-intent-reviewer' skills/shipit-core/SKILL.md
```
Expected: `≥ 6`.

- [ ] **Step 5: Commit**

```bash
git add skills/shipit-core/SKILL.md
git commit -m "docs(shipit-core): register six specialist reviewer agents"
```

---

### Task 16: Sync peer-review flowcharts

**Files:**
- Modify: `docs/peer-review-flowchart.md`
- Modify: `review flowchart.txt` (if present)

- [ ] **Step 1: Locate the pr-review-toolkit references**

Run:
```bash
grep -n 'pr-review-toolkit' docs/peer-review-flowchart.md "review flowchart.txt" 2>/dev/null
```

- [ ] **Step 2: For each match, update the caller**

Replace each occurrence that names the review engine with:
```
Skill("shipit:shipit-review")  [or pr-review-toolkit legacy per peer_review.engine]
```

Wherever the flowchart names the 5 legacy sub-agents (code-reviewer, silent-failure-hunter, pr-test-analyzer, type-design-analyzer, comment-analyzer), add a parenthetical:
```
(or the 6 ShipIt specialists when engine = shipit-review)
```

- [ ] **Step 3: Add a mode-selector box to the diagram**

Insert a new node/box in the command-phase swimlane between the `git fetch origin` gate and the `Spawn peer-reviewer` box, labeled:
```
Step 5.5: Ask mode (efficiency | balanced | depth)
```

- [ ] **Step 4: Verify (green)**

Run:
```bash
grep -c 'shipit:shipit-review\|ShipIt specialists\|Ask mode' docs/peer-review-flowchart.md
```
Expected: `≥ 2`.

- [ ] **Step 5: Commit**

```bash
git add docs/peer-review-flowchart.md "review flowchart.txt" 2>/dev/null
git commit -m "docs: update peer-review flowchart for shipit-review engine and mode selector"
```

---

### Task 17: Write parity test checklist

**Files:**
- Create: `docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md`

- [ ] **Step 1: Confirm absent (red)**

Run: `test ! -e docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md && echo ok`
Expected: `ok`.

- [ ] **Step 2: Write the checklist**

Write the file:

```markdown
# ShipIt Internal Reviewer — Parity Test Checklist (Phase 2)

**Goal:** Before flipping `peer_review.engine` default to `shipit-review`, confirm the new engine matches or exceeds `pr-review-toolkit` on a sample of real MRs across all three modes.

**Scope:** Manual smoke test. Run by a ShipIt maintainer. Not automatable until a behavioral test harness exists.

## Test Matrix

15 runs total. Pick 5 real MRs that differ on these axes — one with a clear CRITICAL (e.g., secrets), one with only MINOR/nit findings, one with a large diff (>20k chars), one marked draft, one merged already (for the skip-worktree path).

For each MR, run the workflow twice — once with `peer_review.engine = "pr-review-toolkit"`, once with `"shipit-review"` — across all three modes.

| # | MR | Legacy engine | Mode | shipit-review | Notes |
|---|---|---|---|---|---|
| 1 | MR with known CRITICAL | ☐ | efficiency | ☐ |  |
| 2 |  | ☐ | balanced | ☐ |  |
| 3 |  | ☐ | depth | ☐ |  |
| 4 | MR with only MINOR | ☐ | balanced | ☐ |  |
| 5 | Large-diff MR | ☐ | balanced | ☐ |  |
| 6 |  | ☐ | depth | ☐ |  |
| 7 | Draft MR | ☐ | balanced | ☐ | confirm COMMENTS_ONLY verdict |
| 8 | Already-merged MR | ☐ | balanced | ☐ | confirm worktree step skipped |
| 9 | Security-heavy MR | ☐ | balanced | ☐ |  |
| 10 |  | ☐ | depth | ☐ |  |
| 11 | Perf-heavy MR | ☐ | balanced | ☐ |  |
| 12 |  | ☐ | efficiency | ☐ |  |
| 13 | Error-handling-heavy MR | ☐ | balanced | ☐ |  |
| 14 | Scope-creep MR | ☐ | balanced | ☐ | confirm intent specialist flags it |
| 15 | Random open MR | ☐ | balanced | ☐ |  |

## Acceptance Criteria

- [ ] CRITICAL findings produced by legacy are also produced by `shipit-review` in at least one mode (balanced or depth).
- [ ] `shipit-review` produces **no more than 2× the count** of IMPORTANT findings vs. legacy on the same MR (noise bar).
- [ ] MINOR churn is ignored — not a pass/fail criterion.
- [ ] Draft MR run produces `COMMENTS_ONLY` verdict with `shipit-review`.
- [ ] Merged MR skips the worktree pattern-commit step with `shipit-review`.
- [ ] Large-diff MR completes under 4 min in depth mode.
- [ ] No run surfaces a `specialist-output-malformed` MINOR.

## Sign-Off

Once all 15 rows are checked and all acceptance criteria are met, the maintainer writes a short summary in this file and opens a follow-up MR that flips `peer_review.engine` default from `"pr-review-toolkit"` to `"shipit-review"`.
```

- [ ] **Step 3: Verify (green)**

Run:
```bash
wc -l docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md
grep -c '^\| ' docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md
```
Expected: ≥ 40 lines; ≥ 16 table rows (header + 15 test rows).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md
git commit -m "docs: add Phase 2 parity-test checklist for shipit-review rollout"
```

---

### Task 18: End-to-end structural verification

**Files:** (no file changes — read-only verification)

- [ ] **Step 1: Every new file has valid frontmatter**

Run:
```bash
for f in \
  skills/shipit-review/SKILL.md \
  skills/shipit-review-rules/SKILL.md \
  skills/shipit-review-rules/security.md \
  skills/shipit-review-rules/performance.md \
  skills/shipit-review-rules/error-handling.md \
  agents/shipit-correctness-reviewer.md \
  agents/shipit-security-reviewer.md \
  agents/shipit-performance-reviewer.md \
  agents/shipit-error-handling-reviewer.md \
  agents/shipit-test-reviewer.md \
  agents/shipit-intent-reviewer.md
do
  echo "--- $f"
  head -4 "$f"
done
```
Expected for SKILL.md and agent files: `---` then `name:` then `description:` then `---`. Rule-pack category files (`security.md`, `performance.md`, `error-handling.md`) do NOT need frontmatter — they start with `# <Title>`.

- [ ] **Step 2: Cross-references resolve**

Run:
```bash
# shipit-review skill mentions all six specialists
for s in correctness security performance error-handling test intent; do
  grep -q "shipit-$s-reviewer" skills/shipit-review/SKILL.md \
    && echo "ok: shipit-$s-reviewer referenced" \
    || echo "MISS: shipit-$s-reviewer"
done

# peer-reviewer has both engine branches
grep -q 'shipit:shipit-review' agents/shipit-peer-reviewer.md && echo "ok: new engine wired"
grep -q 'pr-review-toolkit:review-pr' agents/shipit-peer-reviewer.md && echo "ok: legacy engine still present"

# command has the mode selector
grep -q 'Step 5.5: Ask Review Mode' commands/peer-review.md && echo "ok: mode selector present"

# config has the peer_review block
python3 -c "import json; c=json.load(open('.shipit/config.json')); assert 'peer_review' in c; print('ok: peer_review block present')"
```
Expected: every line prints `ok: ...`. Any `MISS:` is a bug — fix before proceeding.

- [ ] **Step 3: No leftover `languages:` field from earlier spec revisions**

Run: `grep -rn '^\*\*Languages:\*\*' skills/shipit-review-rules/`
Expected: no output (the `languages` field was intentionally dropped).

- [ ] **Step 4: Commit verification log (optional)**

If the team wants a record, save the output of Steps 1–3 to `docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-verification.log` and commit. Otherwise skip.

---

## Post-Implementation Notes

- **Phase 2 (parity test)** is tracked in `docs/superpowers/plans/2026-04-14-shipit-internal-reviewer-parity-test.md` (Task 17). Run by hand; not part of this plan's automation.
- **Phase 3 (flip default)** is a one-line change to `.shipit/config.json` — `peer_review.engine: "shipit-review"`. Belongs in a follow-up plan after parity is signed off.
- **Phase 4 (remove legacy)** — delete Step 3b branch from `shipit-peer-reviewer.md`, delete the engine flag, remove `pr-review-toolkit` references from docs. Also a follow-up plan, one release after Phase 3.
