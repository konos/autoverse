---
phase: 06-ui
plan: 02
subsystem: auth
tags: [login, error-handling, korean-copy, pure-function, vitest]

requires:
  - phase: 06-ui (같은 페이즈, 앞선 계획)
    provides: "06-01의 settings-store/설정 IPC — 이 플랜은 그 위에 직접 얹지 않고 독립된 순수 모듈로 존재"
provides:
  - "`LoginFailureReason` 6개 값 union — captcha/form-error/timeout/network-error/token-ladder-failed/unknown"
  - "`mapLoginFailure()` — 사유별 UI-SPEC 확정 한국어 안내로 매핑하는 순수 함수(exhaustive switch)"
  - "`truncateFormError()` + `FORM_ERROR_MAX_LENGTH=120` — 동적 폼 오류 텍스트 전처리"
  - "`LoginFailureGuidance` 인터페이스 — message/suggestBrowserSwitch/identifier?/logDetail?"
affects: [06-05 (auth-service.ts 배선), 06-06 (LoginPanel.tsx 배선)]

actuals:
  tokens: 2464
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "shared/ 순수 함수 모듈: electron/main 의존성 없이 union 타입 + 결과 인터페이스 + 단일 export 함수 (mask.ts/form-parser.ts 관례 계승)"

key-files:
  created:
    - src/shared/login-failure.ts
    - src/shared/__tests__/login-failure.test.ts
  modified: []

key-decisions:
  - "form-error 사유에서 detail 이 undefined/공백이면 '로그인 실패' 로 폴백 — UI-SPEC 에 명시된 문구가 없어 기존 LoginPanel.tsx 관례(`result.message ?? '로그인 실패'`)를 그대로 채택"
  - "identifier 는 network-error/token-ladder-failed/unknown 세 사유에서만 프로퍼티 자체를 설정하고, captcha/timeout/form-error 는 프로퍼티를 아예 넣지 않음 — 렌더러가 `undefined` 식별자를 잘못 표시할 여지를 타입/구조 수준에서 차단"
  - "마스킹은 이 모듈에서 하지 않음 — 파일 머리 주석과 prohibitions 로 3중 고정된 계약대로 호출부(06-05) 책임으로 남김. 리터럴 'maskSensitive' 문자열조차 파일에 넣지 않아 acceptance grep 을 통과시킴"

requirements-completed: []  # R020 은 03/04/05/06/07 여러 플랜이 공유 선언 — 전부 완료돼야 표에서 Complete 로 전환 (shared-ID gate)

coverage:
  - id: D1
    description: "6개 LoginFailureReason 전부가 UI-SPEC 확정 한국어 문구로 매핑되고, 캡차가 더 이상 이메일 코드 안내로 흐르지 않는다 (R020, D-13)"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/login-failure.test.ts#mapLoginFailure"
        status: pass
    human_judgment: false
  - id: D2
    description: "동적 form-error 텍스트가 120자에서 잘려 화면에 표시되고, 잘리지 않은 원문은 logDetail 로 로그 경로에 보존된다 (UI-SPEC E5 overflow/long-text)"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/login-failure.test.ts#truncateFormError"
        status: pass
      - kind: unit
        ref: "src/shared/__tests__/login-failure.test.ts#mapLoginFailure - form-error 전처리 통합"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-26
status: complete
---

# Phase 6 Plan 2: 로그인 실패 사유 매핑 Summary

**`mapLoginFailure()` 순수 함수 — 6개 실패 사유를 UI-SPEC 확정 한국어 안내로 고정하고, 캡차 오진(D-13)을 되돌리지 않도록 exhaustive switch 로 봉인**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-26T04:05:00Z
- **Completed:** 2026-08-26T04:20:00Z
- **Tasks:** 2
- **Files modified:** 2 (둘 다 신규 생성)

## Accomplishments

- `LoginFailureReason` union(정확히 6개 값)과 `mapLoginFailure()`를 신설해 실패 안내가 auth-service 곳곳의 `if`로 흩어지지 않도록 단일 진입점으로 고정했다
- 캡차 신호가 더 이상 "메일로 코드가 발송됐다"는 반증된 서사로 흐르지 않는다 — `Weverse가 보안 확인을 요구해...` 문구로 명확히 매핑되고 `suggestBrowserSwitch: true`가 브라우저 전환 버튼 노출을 유도한다
- 미매핑 실패(`unknown`)도 다음 행동 문장 + 식별자를 함께 반환해 조용히 무시되는 실패 경로를 없앴다 (D-14)
- 동적인 Weverse 폼 오류 텍스트를 120자에서 말줄임표로 잘라 화면에 안전하게 표시하면서, `logDetail`로 원문을 유실 없이 로그 경로에 보존한다

## Task Commits

TDD RED-GREEN 사이클로 진행 (Task 1·2가 같은 파일/테스트 세트를 공유해 하나의 사이클로 묶임):

1. **RED: 실패 사유 union + 폼 오류 전처리 실패 테스트 작성** - `e49220a` (test)
2. **GREEN: `mapLoginFailure()` + `truncateFormError()` 구현** - `9f95938` (feat)

REFACTOR 단계는 생략 — GREEN 구현이 이미 최소하고 깔끔해 별도 정리가 필요하지 않았다.

**Plan metadata:** (이 커밋 다음)

## Files Created/Modified

- `src/shared/login-failure.ts` - `LoginFailureReason` union, `LoginFailureGuidance` 인터페이스, `mapLoginFailure()`, `truncateFormError()`, `FORM_ERROR_MAX_LENGTH` 상수 (104줄)
- `src/shared/__tests__/login-failure.test.ts` - 17개 테스트: 6개 사유 전수 매핑 검증, identifier 부재/보존 검증, 반증 서사 부정 단언, truncateFormError 경계값(119/120/121자) 검증 (134줄)

## Decisions Made

- **form-error 폴백 문구:** UI-SPEC이 detail-undefined 케이스의 정확한 문구를 지정하지 않아, 기존 `LoginPanel.tsx`의 `result.message ?? "로그인 실패"` 관례를 그대로 채택했다. 향후 UI-SPEC이 이 케이스를 명시하면 정정 필요.
- **identifier 프로퍼티 자체 부재:** `undefined` 값을 넣는 대신 프로퍼티 자체를 생략해, 렌더러가 "정의되지 않은 값이 찍히는" 렌더링을 타입/구조 수준에서 원천 차단했다 (UI-SPEC E5 partial).
- **파일 내 "maskSensitive"/"electron" 리터럴 완전 배제:** acceptance_criteria가 이 두 문자열의 grep count 0을 요구했고, 파일 머리 주석에서도 이를 우회 표현으로 대체했다 (e.g. "electron/main" → "데스크탑 런타임").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 파일 머리 주석의 "electron" 리터럴이 acceptance_criteria를 위반**
- **Found during:** Task 1 (acceptance_criteria 검증 루프)
- **Issue:** 초안 주석에 "electron/main 프로세스 의존성이 없다"라고 썼는데, acceptance_criteria가 `grep -c "electron" src/shared/login-failure.ts`가 0이어야 한다고 요구했다 (전체 파일 기준, 주석 예외 없음). 초안은 1건으로 실패.
- **Fix:** "electron/main" 표현을 "데스크탑 런타임"으로 교체 — 의미는 동일하게 유지하면서 금지어를 제거했다.
- **Files modified:** src/shared/login-failure.ts
- **Verification:** `grep -c "electron" src/shared/login-failure.ts` → 0
- **Committed in:** `9f95938` (GREEN 커밋에 포함, 별도 수정 커밋 없이 최초 커밋 전에 수정됨)

---

**Total deviations:** 1 auto-fixed (Rule 1 - acceptance_criteria 위반 버그)
**Impact on plan:** 커밋 전에 잡힌 사소한 워딩 이슈로, 스코프 확장 없음.

## Issues Encountered

- `npx vitest`/`npx tsc` 등 명령이 rtk 훅에 의해 출력이 필터링되어 실제 실패 원인이 가려졌다 (`PASS (0) FAIL (0)`만 출력). `rtk proxy npx vitest run ...`로 우회해 원본 출력을 확인했다. Task 실행에는 영향 없음 — 환경 이슈일 뿐 코드 결함 아님.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `LoginFailureReason`(6개 값)과 `LoginFailureGuidance` 필드(`message`, `suggestBrowserSwitch`, `identifier?`, `logDetail?`)가 확정됐다 — 06-05(auth-service.ts 배선)와 06-06(LoginPanel.tsx 배선)이 이 어휘를 그대로 가져다 쓰면 된다.
- 06-05는 이 모듈이 반환하는 `identifier`/`logDetail`을 렌더러로 넘기기 전에 반드시 마스킹 헬퍼로 감싸야 한다(T-06-06, R010) — 이 플랜은 마스킹을 의도적으로 하지 않았다.
- 06-06은 `suggestBrowserSwitch === true`일 때만 "브라우저 로그인으로 전환" 버튼을 노출하는 조건으로 이 필드를 그대로 쓰면 된다.
- 블로커 없음.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/shared/login-failure.ts
- FOUND: src/shared/__tests__/login-failure.test.ts
- FOUND commit: e49220a (test)
- FOUND commit: 9f95938 (feat)
- Re-ran `npx vitest run src/shared/__tests__/login-failure.test.ts` → 17 passed
- Re-ran `npm run typecheck` → 0 errors
- Re-ran full suite `npx vitest run` → 278 passed (15 files), no regressions
