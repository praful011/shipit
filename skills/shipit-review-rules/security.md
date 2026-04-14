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
