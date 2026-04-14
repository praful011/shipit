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
