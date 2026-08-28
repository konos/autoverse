---
phase: 07-api
plan: 07
subsystem: auth
tags: [electron, credential-storage, safeStorage, react, gap-closure]

# Dependency graph
requires:
  - phase: 07-02
    provides: saveCredentials()/getStoredCredentialsSnapshot() D-04 4-state contract, maskEmail()
  - phase: 07-04
    provides: resolveStoredLoginState()/refreshStoredSnapshot() and the corrupted-notice UI contract
provides:
  - "completeCredentialLoginSuccess(email, password) — the single success gate credentialLogin()'s two success branches funnel through"
  - "Symmetric finally-block snapshot refresh in LoginPanel.tsx's direct-entry login handler"
affects: [07-VERIFICATION, 07-REVIEW, future auth-service edits touching credentialLogin()]

actuals:
  tokens: 1950
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Single success gate for multi-branch success paths (matches buildFailureResult()/_evaluateCurrentTokenExpiry()/createLoginModeActions() precedent) — a third success path cannot bypass saveCredentials() without going through the gate"

key-files:
  created: []
  modified:
    - src/main/services/auth-service.ts
    - src/main/services/__tests__/auth-service.test.ts
    - src/renderer/components/LoginPanel.tsx

key-decisions:
  - "G-04: close WR-02 with a single completeCredentialLoginSuccess() gate (save + cleanup + result) rather than a one-line saveCredentials() patch on the timeout branch — prevents the same omission recurring if a third success path is ever added"
  - "runAccountTokenLadderSpike() deliberately stays outside the gate and fires only from the result===\"token\" branch — folding it in would add a new external network call on the timeout->cookie path, out of this batch's scope"
  - "G-05: WR-03 closed as a one-line finally-block symmetry fix (refreshStoredSnapshot()) matching handleStoredLogin() — no new state, no new pure function"

patterns-established:
  - "Success-path convergence gate: when a method has N success returns that must all perform the same side effect, extract a single private method that owns the side effect + cleanup + result literal, and make every success branch return its call"

requirements-completed: [R023]

coverage:
  - id: D1
    description: "credentialLogin()'s timeout->cookie-found success path now saves credentials via the shared completeCredentialLoginSuccess() gate, closing WR-02"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.completeCredentialLoginSuccess — 단일 성공 관문 (WR-02, R023)"
        status: pass
    human_judgment: true
    rationale: "The timeout->cookie-found DOM path itself cannot be reproduced without a real headless BrowserWindow login flow (no DOM test environment in this repo, same constraint as the existing buildFailureResult() contract tests). The gate's storage/return/logging behavior is proven by unit tests; the plan's own <human-check> flags this path as hard-to-reproduce and permits recording non-reproduction."
  - id: D2
    description: "handleCredentialLogin()'s finally now calls refreshStoredSnapshot(), matching handleStoredLogin(), so a resolved corrupted notice does not stay stale after a successful direct-entry re-login"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts (resolveStoredLoginState() contract unaffected, re-run green)"
        status: pass
    human_judgment: true
    rationale: ".tsx files are outside vitest.config.ts's include pattern (source-assertion + human-check is this repo's existing pattern for LoginPanel.tsx changes, not a gap introduced by this plan). The plan's <human-check> describes the exact corrupted->available UI transition to confirm."

duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 07 Plan 07: WR-02/WR-03 Gap Closure Summary

**Single-gate fix for credentialLogin()'s save-on-success asymmetry (WR-02) and finally-block symmetry fix for LoginPanel's stale corrupted-credentials notice (WR-03)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-28T08:44:00Z
- **Completed:** 2026-08-28T08:56:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `AuthService.completeCredentialLoginSuccess(email, password)` — a new private gate that both success branches of `credentialLogin()` now funnel through, closing the timeout->cookie-found path's silent `saveCredentials()` skip (WR-02, R023)
- WR-02 regression suite (4 tests) covering: storage result via `getStoredCredentialsSnapshot()`, `{ success: true }` shape with no password field, `safeStorage`-unavailable graceful skip, and no-plaintext-in-logs
- `LoginPanel.tsx`'s `handleCredentialLogin()` `finally` now calls `refreshStoredSnapshot()`, symmetric with `handleStoredLogin()`, so a resolved `corrupted` notice no longer stays stale after a successful direct-entry re-login (WR-03, D-04)

## Task Commits

Each task was committed atomically:

1. **Task 07-07-01 (RED): WR-02 regression test** - `4ddfc7c` (test)
2. **Task 07-07-01 (GREEN): completeCredentialLoginSuccess() gate** - `17d6529` (feat)
3. **Task 07-07-02: LoginPanel finally symmetry** - `d2b73ae` (fix)

_Note: Task 1 carried `tdd="true"` — RED then GREEN, no REFACTOR commit needed (implementation was already minimal after GREEN)._

## Files Created/Modified
- `src/main/services/auth-service.ts` - Added `completeCredentialLoginSuccess()` private gate; rewired the `result === "token"` and `result === "timeout"` (cookie found) success branches to return the gate's result instead of inlining `saveCredentials()`/`cleanupHeadless()`/`{ success: true }`
- `src/main/services/__tests__/auth-service.test.ts` - Added WR-02 regression `describe` block (4 tests) exercising the new gate via the repo's existing private-cast pattern
- `src/renderer/components/LoginPanel.tsx` - Added `refreshStoredSnapshot()` to `handleCredentialLogin()`'s `finally`, with a comment explaining the WR-03 rationale and the G-05 scope boundary

## Decisions Made
- **G-04 (from plan):** Closed WR-02 via a single shared success gate rather than a one-line `saveCredentials()` addition to the timeout branch, matching this repo's established single-gate pattern (`buildFailureResult()`, `_evaluateCurrentTokenExpiry()`, `createLoginModeActions()`). A third success path added later cannot construct `{ success: true }` without also saving credentials.
- **G-04 (from plan):** `runAccountTokenLadderSpike()` intentionally stays outside the gate and fires only from the `result === "token"` branch — moving it into the gate would add a new external network call on the timeout->cookie path, which is out of WR-02's scope and unverified against a real account.
- **G-05 (from plan):** WR-03 closed as a minimal `finally`-block symmetry fix, not a new pure function — the effect is judgment-free and the state it refreshes (`resolveStoredLoginState()`) is already covered by 26 existing cases.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both WR-02 and WR-03 from `07-REVIEW.md` are closed. `07-VERIFICATION.md`'s Anti-Patterns table entries for these two items can be marked resolved.
- `npm test` green at 22 suites / 474 tests (up from 470 — 4 new WR-02 regression tests), `npm run typecheck` and `npm run typecheck:main` both exit 0, `npm run build` exit 0.
- The two `<human-check>` items in this plan (timeout->cookie-found login persisting credentials across restart; corrupted-notice clearing after successful direct re-login) are deferred to end-of-phase UAT per `workflow.human_verify_mode = end-of-phase` — not executed in this run.
- The `flagged_assumptions` block in `07-07-PLAN.md` (A-R023: no spec for concurrent/interrupted credential-save guarantees) remains open by design — not addressed in this batch, and not silently closed.

---
*Phase: 07-api*
*Completed: 2026-08-28*
