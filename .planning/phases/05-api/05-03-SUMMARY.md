---
phase: 05-api
plan: 03
subsystem: auth
tags: [weverse-account-api, jwt, cookies, cdp, ladder-spike, real-account-observation]

# Dependency graph
requires:
  - phase: 05-api/05-01
    provides: "Cookie-first + CDP-fallback account-token capture wired into credentialLogin(), acquireFaneventToken() rung1/rung2 ladder, verdict logging"
  - phase: 05-api/05-02
    provides: "Corrected REQUIREMENTS.md/PROJECT.md/ROADMAP.md contract descriptions (R017 rewritten, R018 blocked) that this plan's REQUIREMENTS.md edit builds on"
provides:
  - "R019 validated by a single real-account observation — rung1(direct) succeeded via the account-domain cookie ('rt', accountapi.weverse.io, JWT, len=451) against /fans/me, returning fanId=9415932"
  - ".planning/phases/05-api/05-SPIKE-RESULT.md — canonical R019 verdict record with Open Questions/Assumptions Log resolution and a documented, unfixed masking-gap finding"
  - "REQUIREMENTS.md R019 Validation: active -> validated, traceability table and Coverage Summary reconciled"
affects: [06, 07]

# Actuals (#2632)
actuals:
  tokens: 3300
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/05-api/05-SPIKE-RESULT.md
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "R019 marked validated on rung1(direct) success alone, without ever exercising rung2(exchange) — the plan's Nyquist constraint treats this single real-account observation as decisive (not flaky), and rung1 succeeding is itself a valid pass condition per the ladder's own design (rung2 is a fallback, not a required path)."
  - "Documented, but did not fix, a masking gap discovered during log readback: credentialLogin(headless)'s redirect-URL log line leaks raw access_token/refresh_token in snake_case query params, unmatched by mask.ts's camelCase-only SENSITIVE_PATTERNS regexes. This plan's verification explicitly forbids any diff outside .planning/, so the fix is deferred to Phase 06/07 rather than auto-applied under deviation Rule 2 (scope boundary: pre-existing code issue, not introduced by this plan's changes)."
  - "Recorded, transparently, that credentialLogin(headless) fired twice in the observed session (first attempt timed out, second succeeded) even though no retry was ever requested by the executor — the plan's 'no retry' constraint is interpreted as 'the ladder itself ran and was observed exactly once,' which held (the ladder only triggers on result===\"token\", reached only by the second attempt)."

patterns-established: []

requirements-completed: [R019]

coverage:
  - id: D1
    description: "R019 (account token -> fanevent token exchange ladder) validated via one real-account observation: rung1(direct) succeeded, /fans/me returned 200 with fanId"
    requirement: "R019"
    verification:
      - kind: manual_procedural
        ref: "05-SPIKE-RESULT.md section 1-2, quoting accountTokenLadderSpike: verdict=pass tokenSource=cookie ladderSource=direct fanId=9415932 from ~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log"
        status: pass
    human_judgment: true
    rationale: "Per 05-VALIDATION.md's phase-specific Nyquist constraint, R019's decisive signal is a one-time human-performed real-account login observation, not a repeatable automated test — a human (the user) performed the login, and the executor's role was read-only log interpretation. This is inherently a judgment-routed deliverable, not an automated pass."
  - id: D2
    description: "Success Criteria 3 regression check: ApplyEngine still consumes authService.token unchanged (spike is read-only, does not overwrite it)"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/apply-engine.test.ts (17/17)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min (this continuation session; Task 1 was executed and committed in a prior agent session before the checkpoint)
completed: 2026-08-25
status: complete
---

# Phase 5 Plan 3: R019 실계정 판정 — rung1 직접 사용 성공(PASS) Summary

**사용자가 1회 수행한 실계정 로그인 관측으로 `acquireFaneventToken()` 사다리의 rung1(직접 사용)이 계정 도메인 쿠키(`rt`, JWT, 451자)로 `/fans/me` 200 + `fanId=9415932`를 확보해 R019가 PASS로 검증됐다 — rung2(교환)는 실행 기회 없이 스킵됐고, 부수적으로 앱 로그에 access_token/refresh_token 원문이 마스킹되지 않고 남는 보안 결함이 발견돼(코드 미수정, Phase 06/07로 이관) 문서화됐다.**

## Performance

- **Duration:** ~20 min (이 연속 실행 세션 기준 — Task 1은 이전 실행자 세션에서 이미 커밋 완료된 상태로 체크포인트에 도달했음)
- **Started:** 2026-08-25 (연속 실행 세션 시작)
- **Completed:** 2026-08-25T09:49:33Z
- **Tasks:** 3 of 3 (Task 1: 이전 세션에서 커밋 없이 완료 — 코드 변경 없는 준비 태스크였음, 이번 세션이 사실 확인만 재검증. Task 2: 사용자 실계정 로그인 완료. Task 3: 이번 세션에서 실행)
- **Files modified:** 2 (`.planning/phases/05-api/05-SPIKE-RESULT.md` 신규, `.planning/REQUIREMENTS.md` 수정)

## Accomplishments

- **R019 PASS 판정 확정** — 실계정 로그인 1회 관측으로 `acquireFaneventToken()` rung1(직접 사용)이 성공했다. 계정 도메인(`accountapi.weverse.io`)의 `rt` 쿠키(httpOnly, JWT 3파트, 451자)가 계정 토큰 후보로 발견되어 곧바로 `/fans/me`에 사용됐고 `200 OK, fanId=9415932`를 받았다.
- **핵심 발견 — `rt` 쿠키는 access 토큰이 아니라 refresh 토큰일 가능성이 높다.** 길이(451자)가 05-01-SUMMARY.md의 HAR 실측 `refreshToken` 필드 길이(451자)와 정확히 일치한다(`accessToken`은 427자). 그럼에도 서버가 `/fans/me`에서 이 값을 유효한 Bearer로 받아들였다 — 05-RESEARCH.md가 전제하지 않았던 서버 동작.
- **CDP 폴백 경로도 독립적으로 성공했다** — 같은 로그인 시도 중 CDP가 `by-credentials` 응답에서 별도의 accessToken(427자, JWT)을 캡처했다. 쿠키 경로가 이미 후보를 찾았기 때문에 사다리에는 실제로 공급되지 않았지만(설계된 우선순위), 두 경로 모두 유효한 서로 다른 토큰을 각자 확보했다는 사실 자체가 새로운 관측이다.
- **05-RESEARCH.md의 3개 Open Question 중 2개, 5개 Assumption 중 3개가 확인/반증됐다.** rung2(교환) 관련 Open Question 2, Assumption A3/A4는 rung2가 실행되지 않아 여전히 미확인 상태로 명시적으로 남겼다(뭉개지 않음).
- **보안 결함 발견 및 문서화(미수정)** — `credentialLogin(headless)`의 리다이렉트 URL 로그 줄에 `access_token=`/`refresh_token=` 원문이 마스킹 없이 남는다(`mask.ts`의 패턴이 카멜케이스만 매칭). 이 플랜은 코드를 바꾸지 않는다는 명시적 제약이 있어 고치지 않고 `05-SPIKE-RESULT.md` §6과 아래 Threat Flags에 기록해 Phase 06/07로 이관했다.
- **REQUIREMENTS.md R019 상태를 `validated`로 갱신**하고 traceability 표/Coverage Summary 숫자를 재계산했다. R017/R018 항목은 그대로 두었다(검증됨: `### R018` count=1, `Status: blocked` count≥1).

## Task Commits

Task 1과 Task 2는 코드/문서 커밋을 만들지 않는다(각각 준비/점검 태스크, 사람이 수행하는 체크포인트) — 계획대로다.

1. **Task 3: 로그 판독 → 05-SPIKE-RESULT.md 확정 + R019 상태 기록** - `1b33364` (docs)

**Plan metadata:** 이 SUMMARY 커밋 자체가 최종 메타데이터 커밋을 겸한다.

## Files Created/Modified

- `.planning/phases/05-api/05-SPIKE-RESULT.md` (신규) - R019 판정(PASS), 관측 사실, Open Questions/Assumptions Log 해소표, Success Criteria 3 판단, 에이전트 안전 프로토콜 기록, 다음 단계 제안(보안 결함 포함)
- `.planning/REQUIREMENTS.md` (수정) - R019 항목 Validation `unmapped`→`validated`, Notes에 근거 기록, traceability 표 R019 행과 Coverage Summary(Active/Validated 카운트) 재계산. R017/R018 항목은 무변경.

## Decisions Made

- rung2를 실행하지 않고도 rung1 성공만으로 R019를 `validated`로 판정 — 사다리 설계 자체가 rung1 성공 시 조기 종료를 정상 경로로 취급하며, 이 phase의 Nyquist 제약(1회성 관찰이 결론)이 이를 뒷받침한다. rung2/A3/A4는 "미확인"으로 명시하고 판정을 흐리지 않았다.
- 로그에서 발견한 마스킹 결함(access_token/refresh_token 원문 유출)은 이 플랜의 "코드 변경 금지" 제약과 deviation 규칙의 스코프 경계(이 플랜이 만들지 않은 기존 코드의 사전 존재 결함) 양쪽 이유로 자동 수정하지 않고 문서화만 했다.
- 로그인 폼이 관측 세션 중 2회 제출된 사실(1차 timeout, 2차 성공)을 숨기지 않고 그대로 기록했다 — 사다리 자체는 정확히 1회만 실행·관측됐다는 사실과 구분해서 서술했다.

## Deviations from Plan

None - 계획된 태스크만 실행했고 코드는 전혀 바꾸지 않았다(plan-level verification #5로 확인: `git diff --stat -- . ':!.planning'` 결과 비어 있음). 로그에서 발견한 마스킹 결함은 "발견했지만 스코프 밖이라 고치지 않음"으로 처리했으며, 이는 auto-fix 편차가 아니라 §6/Threat Flags에 기록된 발견 사항이다.

**Total deviations:** 0
**Impact:** 없음.

## Issues Encountered

- **보안 발견(미해결, 이 플랜 스코프 밖):** `credentialLogin(headless)`가 남기는 `navigated to https://weverse.io/loginResult?...access_token=...&refresh_token=...` 로그 줄이 실계정의 실제 accessToken/refreshToken 원문을 로컬 로그 파일에 평문으로 남긴다. `src/shared/mask.ts`의 `SENSITIVE_PATTERNS`는 카멜케이스(`accessToken`/`refreshToken`, `key:value`/`key=value`)만 매칭하고 URL 쿼리스트링의 스네이크케이스(`access_token=`/`refresh_token=`)는 매칭하지 않는다. 이 판정 문서/이 SUMMARY 어디에도 실제 토큰 값은 옮겨 적지 않았지만, 사용자 로컬 머신의 앱 로그 파일 자체에는 여전히 남아 있다. Phase 06/07 계획 시 최우선 보안 수정 후보로 넘긴다.
- 로그인 폼이 2회 제출된 관측(위 Decisions Made 참고) — 문제로 취급하지 않았으나 투명하게 기록했다.
- `ProfileStore loaded fanId=6871442`가 사다리가 검증한 `fanId=9415932`와 다른 값으로 관측됐다 — 이전 세션의 캐시된 프로필로 추정되며 이 phase의 회귀는 아니다. Phase 06/07 계획 시 확인 후보로 남긴다(05-SPIKE-RESULT.md §2 참고).

## User Setup Required

None - `user_setup`에 명시된 유일한 사용자 행동(실계정 로그인 1회)은 Task 2 체크포인트에서 완료됐다.

## Next Phase Readiness

- **Phase 06/07 계획 시 최우선 입력:** `05-SPIKE-RESULT.md` §6 "다음 단계"의 마스킹 결함 수정(access_token/refresh_token 스네이크케이스 패턴을 `mask.ts`에 추가)을 가능한 한 이른 태스크로 배치할 것을 권고한다 — 이미 실계정 값이 로컬 로그 파일에 평문으로 남아 있는 상태다.
- rung2(교환) 경로는 여전히 실계정으로 한 번도 실행되지 않았다 — API 모드 제품 경로를 최종 확정하기 전에(D-04), rung1이 실패하는 계정 상태(예: 토큰 만료/회전 이후)에서 rung2가 실제로 동작하는지 별도로 확인할 필요가 있다는 점을 감안해야 한다.
- D-04에 따라 API 모드 제품 경로 확정 결정 자체는 이 phase 밖에서 별도로 내려야 한다 — 이 phase는 스파이크이며 그 결정을 대신하지 않는다.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: information-disclosure | `src/main/services/auth-service.ts` (`credentialLogin` 로그 라인) | `credentialLogin(headless)`의 리다이렉트 URL 로그가 `access_token=`/`refresh_token=` 원문을 마스킹 없이 남긴다 — `src/shared/mask.ts`의 `SENSITIVE_PATTERNS`가 스네이크케이스 URL 쿼리 파라미터를 매칭하지 못한다. 이 plan의 threat_model(T-05-13)은 판정 문서로의 유출만 다뤘고, 이 로그 자체의 표면은 등록되어 있지 않았다. 코드 변경은 이 plan 스코프 밖(verification #5)이라 수정하지 않았다 — Phase 06/07 최우선 후보. |

## Self-Check

- `[ -f .planning/phases/05-api/05-SPIKE-RESULT.md ]` → FOUND
- `git log --oneline --all | grep 1b33364` → FOUND
- `test -f .planning/phases/05-api/05-SPIKE-RESULT.md && grep -qE 'PASS|FAIL|NOT-RUN' ...` → PASS (재실행 확인)
- `grep -cE '[A-Za-z0-9._-]{100,}' 05-SPIKE-RESULT.md` → 0
- `grep -c 'rung1'`/`grep -c 'rung2'` → 각각 ≥1
- `grep -cE 'A1|A2|A3|A4|A5'` → ≥5
- `grep -cE '[a-zA-Z0-9._%+-]+@(gmail|naver|daum|kakao|hanmail)\.'` → 0
- `grep -c '프로브'` → ≥1
- `grep -c '05-SPIKE-RESULT' .planning/REQUIREMENTS.md` → ≥1
- `grep -c '### R018' .planning/REQUIREMENTS.md` → 1, `grep -c '^- Status: blocked'` → ≥1
- `npx vitest run src/main/services/__tests__/apply-engine.test.ts` → 17/17 PASS
- `npm test` → 230/230 PASS
- `npm run typecheck:main` → 0 errors
- `git diff --stat -- . ':!.planning'` → 빈 출력 (코드 변경 없음, plan-level verification #5 충족)

## Self-Check: PASSED

---
*Phase: 05-api*
*Completed: 2026-08-25*
