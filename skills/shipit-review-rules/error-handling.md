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
