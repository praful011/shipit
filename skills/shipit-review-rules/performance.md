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
