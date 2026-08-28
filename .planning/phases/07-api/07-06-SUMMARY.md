---
phase: 07-api
plan: 06
subsystem: auth
tags: [react, electron, ipc, jwt, vitest]

# Dependency graph
requires:
  - phase: 07-api (07-01/07-03/07-05)
    provides: ApplyEngine.checkTokenExpiry()/token-expiry-checked/describeTokenExpiryNotice() chain (D-10), apply:check-token-expiry IPC channel, decideAuthEventNavigation()/stepRef seam, buildFailureView()/login-panel-view.ts
provides:
  - shouldRecheckTokenExpiry(eventType, step) pure decision seam closing CR-01 (07-VERIFICATION.md missing truth #3)
  - Single guarded checkTokenExpiry() call site in App.tsx's onAuthEvent, wired to actual login completion (login-success/token-validated/login-failed/token-expired/cookie-extraction-failed)
  - Cross-layer regression test proving the full chain: near-expiry arm() -> warning banner -> relogin (token replaced) -> banner clears
  - ApplyExecutionProps.reloginLoading + disabled/aria-busy on the "다시 로그인" button (WR-01)
  - handleReloginFromWaiting() API-mode branch now surfaces credentialLoginStored() failures via buildFailureView() instead of discarding them
affects: [07-VERIFICATION, 07-REVIEW, future phases touching App.tsx onAuthEvent or ApplyExecution]

actuals:
  tokens: 3460
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "shouldRecheckTokenExpiry() follows the repo's established 'decision is a pure function, side effect is the caller's job' convention (login-panel-view.ts, auth-event-navigation.ts, apply-execution-view.ts)"
    - "Cross-layer chain tests live in src/__tests__/ (not under any single layer's __tests__/) when a regression spans renderer decision + main engine + renderer view — vitest.config.ts's include glob already covers this path"

key-files:
  created:
    - src/__tests__/relogin-expiry-recheck.test.ts
  modified:
    - src/renderer/auth-event-navigation.ts
    - src/renderer/App.tsx
    - src/renderer/__tests__/auth-event-navigation.test.ts
    - src/renderer/components/ApplyExecution.tsx

key-decisions:
  - "G-01 (from PLAN): chose the App.tsx event-rewiring direction over changing AuthService.login()'s resolve contract — the latter was rated one-way (published IPC contract change, new permanent-pending failure mode) and rejected in the plan; this execution implemented exactly that chosen direction, no re-litigation"
  - "G-02 (from PLAN): kept the finally-block recheck in handleReloginFromWaiting() as the sole trigger for auth-event-less failure paths (API mode none/corrupted/unavailable), only corrected its comment which falsely claimed it fires 'when relogin finishes'"
  - "G-03 (from PLAN): reused loginLoading as ApplyExecution's reloginLoading prop instead of adding new state — handleReloginFromWaiting() already owns that value's full lifecycle"

patterns-established:
  - "Exhaustive switch with no default branch for AuthEvent[\"type\"]-keyed decisions (shouldRecheckTokenExpiry mirrors decideAuthEventNavigation's shape) — new auth event types surface as compile errors"

requirements-completed: [R022]

coverage:
  - id: D1
    description: "브라우저 모드에서 재로그인이 실제로 완료된 시점(login-success)에 새 토큰의 exp 로 만료가 다시 판정되어 대기 화면 경고가 갱신/해제된다 (CR-01, D-10, R022)"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/__tests__/relogin-expiry-recheck.test.ts#재로그인 성공(토큰 교체) 후 checkTokenExpiry() 를 부르면 배너가 사라진다(visible=false)"
        status: pass
      - kind: unit
        ref: "src/__tests__/relogin-expiry-recheck.test.ts#토큰을 교체하지 않은 채(재로그인 실패) 같은 사슬을 돌리면 배너가 visible=true 로 남는다"
        status: pass
      - kind: unit
        ref: "src/__tests__/relogin-expiry-recheck.test.ts#재판정 전후로 getState().phase 와 postSubmitted 가 동일하다"
        status: pass
    human_judgment: true
    rationale: "자동 테스트는 renderer 판정 + main 엔진 + renderer 뷰를 조립한 사슬을 pure-function 수준에서 증명하지만, 실제 Electron 앱에서 브라우저 팝업으로 로그인을 완료했을 때 대기 화면 배너가 눈으로 갱신되는지는 07-VERIFICATION.md Human Verification #3 시나리오 ④(npm start 필요)로만 확인된다 — 이 실행에서 수동 UAT 는 실행하지 않았다."
  - id: D2
    description: "shouldRecheckTokenExpiry() 의 (7 이벤트 × 5 단계) 판정 전 조합이 전수 테스트로 고정된다"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/renderer/__tests__/auth-event-navigation.test.ts#shouldRecheckTokenExpiry — 재로그인 완료 시점 재판정 트리거 (CR-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "재로그인 버튼이 시도 중 잠기고 끝나면 풀리며, 저장 자격증명 재로그인 실패 사유가 화면에 도달한다 (WR-01)"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts#buildFailureView"
        status: pass
    human_judgment: true
    rationale: "buildFailureView() 재사용 자체는 기존 테스트로 덮이지만, 연속 클릭 시 버튼이 실제로 비활성화되는지·시도 종료 후 다시 눌리는지·실패 문구가 화면에 도달하는지는 07-06-PLAN.md Task 3 의 human-check 항목(npm start 수동 확인)으로만 검증된다 — 이 실행에서 수동 UAT 는 실행하지 않았다."

duration: 6min
completed: 2026-08-28
status: complete
---

# Phase 07 Plan 06: 재로그인 완료 → 만료 재판정 연결 (CR-01) + 재로그인 버튼 잠금 (WR-01) Summary

**브라우저 모드에서 `login-success` 인증 이벤트가 만료 재판정(`ApplyEngine.checkTokenExpiry()`)을 실제로 촉발하도록 `shouldRecheckTokenExpiry()` 순수 판정 함수와 단일 호출 지점을 배선하고, 재로그인 버튼에 로딩 잠금과 실패 사유 표시를 추가했다.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-28T08:36:00Z (approx, based on baseline test run)
- **Completed:** 2026-08-28T08:40:42Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Closed 07-VERIFICATION.md's only failing observable truth (#3): after a real browser-mode relogin completes, the waiting-screen expiry banner now re-evaluates against the new token instead of surviving on the stale one. `AuthService.login()` resolving after only the popup's initial `loadURL()` is no longer mistaken for login completion — the `login-success` auth event is.
- Added `shouldRecheckTokenExpiry(eventType, step)` to `auth-event-navigation.ts`: an exhaustive-switch pure function returning `true` for the 5 apply-execution completion/failure events and `false` for `credential-login-progress`/`logged-out`, false outside `apply-execution`.
- Wired exactly one guarded `checkTokenExpiry()` call site inside `App.tsx`'s `onAuthEvent`, placed right after `decideAuthEventNavigation()` and outside the per-event `if/else if` chain — no scattering across 6 branches.
- Cross-layer regression test (`src/__tests__/relogin-expiry-recheck.test.ts`) proves the whole chain: near-expiry token → `arm()` → warning banner → token replaced (simulated successful relogin) → `checkTokenExpiry()` → banner clears; plus a failure control (no token replacement → banner stays) and a state-invariance check (`phase`/`postSubmitted` unchanged across rechecks, T-07-14).
- Closed WR-01: `ApplyExecution`'s "다시 로그인" button now has `disabled`/`aria-busy` driven by a new `reloginLoading` prop (reusing `App.tsx`'s existing `loginLoading` state per G-03, no new state added), and `handleReloginFromWaiting()`'s API-mode `available` branch now surfaces `credentialLoginStored()` failures via the existing `buildFailureView()` instead of discarding the return value.

## Task Commits

Each task was committed atomically:

1. **Task 07-06-01: 재로그인 완료 → 만료 재판정 → 경고 해제 (CR-01)** — RED: `f5095d6` (test), GREEN: `2eb1d4b` (feat)
2. **Task 07-06-02: shouldRecheckTokenExpiry() 전수 케이스 고정** — `b5937ef` (test)
3. **Task 07-06-03: 재로그인 버튼 로딩 잠금 + 실패 사유 표시 (WR-01)** — `404eb4f` (feat)

_TDD tasks produced RED→GREEN commit pairs; Task 2 was test-only pinning of already-implemented behavior (tests passed on first run — expected, since the implementation shipped in Task 1) and Task 3 was a standard `type="auto"` task._

## Files Created/Modified

- `src/__tests__/relogin-expiry-recheck.test.ts` - New cross-layer regression test (renderer decision + main `ApplyEngine` + renderer view)
- `src/renderer/auth-event-navigation.ts` - Added `shouldRecheckTokenExpiry(eventType, step)` export
- `src/renderer/App.tsx` - Single guarded `checkTokenExpiry()` call site in `onAuthEvent`; corrected the `finally`-block comment in `handleReloginFromWaiting()`; imported and used `buildFailureView()`; passed `reloginLoading={loginLoading}` to `<ApplyExecution>`
- `src/renderer/__tests__/auth-event-navigation.test.ts` - Added the 7-event × 5-step `shouldRecheckTokenExpiry()` matrix (test-only)
- `src/renderer/components/ApplyExecution.tsx` - Added `reloginLoading: boolean` to `ApplyExecutionProps`; `disabled`/`aria-busy` on the "다시 로그인" button

## Decisions Made

- Followed the plan's G-01/G-02/G-03 design decisions exactly as specified — no re-litigation of the rejected `AuthService.login()` resolve-contract direction.
- No new IPC channel, no new state, no changes to `apply-engine.ts` or `auth-service.ts` (both were explicitly out of scope per the plan's success criteria and threat register T-07-21).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both `src/main/services/apply-engine.ts` and `src/main/services/auth-service.ts` remain untouched, confirmed via `git status`/`git diff --stat` after each task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `npm test`: 22 suites, 470 tests, all green (baseline was 21 suites / 455 tests before this plan; +1 suite / +15 tests).
- `npm run typecheck` and `npm run typecheck:main`: both exit 0.
- `npm run build`: exit 0.
- **Outstanding human verification (not run in this execution):** 07-VERIFICATION.md Human Verification #3 scenario ④ (real browser-mode relogin via `npm start`, confirming the banner visibly clears) and 07-06-PLAN.md Task 3's human-check (rapid double-click lock behavior, failure message surfacing in API mode, D-12 independence from the submit button). Both are captured as `human_judgment: true` in this SUMMARY's `coverage` block and should be exercised during phase-level UAT.
- Edge-probe A-R022 (concurrency contract for interrupted/parallel relogin) remains unresolved per the plan's own `<flagged_assumptions>` — this plan mitigates the WR-01 slice of it (UI-level click lock) but does not close the broader question. Flagged for a future phase or explicit user dismissal, not silently closed.

---
*Phase: 07-api*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 6 key-files (5 created/modified source files + this SUMMARY.md) confirmed present on disk via `[ -f ]`.
- All 4 task commit hashes (`f5095d6`, `2eb1d4b`, `b5937ef`, `404eb4f`) confirmed present via `git log --oneline --all`.
- `npm test`: 22 suites / 470 tests, all passing (re-verified after Task 3).
- `npm run typecheck` and `npm run typecheck:main`: both exit 0.
- `npm run build`: exit 0.
- Plan-level `<verification>` re-checked: exactly 2 `checkTokenExpiry()` call sites in `App.tsx` (line 74 guarded, line 254 in `handleReloginFromWaiting()`'s `finally`); `src/main/services/apply-engine.ts` and `src/main/services/auth-service.ts` confirmed untouched via `git diff --stat`.
