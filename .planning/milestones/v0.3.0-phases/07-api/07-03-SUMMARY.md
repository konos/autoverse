---
phase: 07-api
plan: 03
subsystem: api
tags: [electron, ipc, jwt, vitest, apply-engine, settings-store, r022, r023]

# Dependency graph
requires:
  - phase: 07-01
    provides: "token-expiry.ts 순수 판정 모듈(parseJwtExpMs/evaluateTokenExpiry/RELOGIN_HEADROOM_MS), ApplyEngine.arm() 의 token-expiry-checked 이벤트 발행 배선"
  - phase: 07-02
    provides: "AuthService.getStoredCredentialsSnapshot()/loginWithStoredCredentials()/clearCredentials() — main 프로세스 자격증명 계층, D-04 4상태 계약과 D-01/D-03 main 최종 게이트"
provides:
  - "apply-engine.ts execute() 의 D-13 대기 이후 토큰 재조회(freshToken) — submitApplication/tokenPreview/_pollStatus 전부 대기 이후 토큰 소비"
  - "ApplyEngine.checkTokenExpiry() — arm() 과 계산을 공유하는 D-10 재판정 진입점, private _evaluateCurrentTokenExpiry() 단일 관문"
  - "IPC 채널 4종(handler+preload+타입+cleanup 대칭): auth:get-stored-credentials, auth:credential-login-stored(email 단일 인자, D-01), auth:clear-credentials, apply:check-token-expiry"
  - "SettingsStore.setLoginMode() 저장 진입점 런타임 검증(WR-04) + readSettings() 읽기/파싱 원인 분리 로그(IN-01)"
affects: ["07-04", "07-05"]

actuals:
  tokens: 6714
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "판정 계산 단일 관문 추출 — arm()과 checkTokenExpiry()가 private _evaluateCurrentTokenExpiry()를 공유해 같은 계산이 두 곳에 복제되지 않는다"
    - "IPC 채널 4점 대칭(handler/preload/IpcApi 타입/removeHandler) — 기존 auth:credential-login 관례를 그대로 확장"
    - "저장 진입점 런타임 검증 — IPC 핸들러가 아니라 SettingsStore.setLoginMode() 내부에서 값 집합을 검증해 모든 호출 경로가 한 관문을 지나게 함"

key-files:
  created: []
  modified:
    - src/main/services/apply-engine.ts
    - src/main/services/__tests__/apply-engine.test.ts
    - src/main/ipc-handlers.ts
    - src/main/preload.ts
    - src/shared/types.ts
    - src/main/services/settings-store.ts
    - src/main/services/__tests__/settings-store.test.ts

key-decisions:
  - "freshToken 도입 위치는 waitUntilSubmitTime() 반환 직후, 시간 가드 검사 이전 — syncTime(token) 은 실행 시작 시점의 token 을 그대로 쓴다(D-13이 명시적으로 옮기지 말라고 한 부분)"
  - "arm() 의 만료 판정 블록을 private _evaluateCurrentTokenExpiry(schema) 로 추출해 checkTokenExpiry() 와 공유 — arm() 의 외부 동작(발행 순서, payload 필드)은 변경 없음"
  - "WR-04 검증 지점을 IPC 핸들러가 아니라 SettingsStore.setLoginMode() 내부에 배치 — 저장 진입점 하나가 모든 호출 경로를 커버, ipc-handlers.ts 는 주석 한 줄로만 그 사실을 남기고 중복 검증을 넣지 않음"
  - "IN-01은 readSettings()의 fs.readFileSync 와 JSON.parse 를 별개 try/catch 로 분리 — 폴백 동작(defaultSettings())과 로그 레벨(warn)은 그대로 유지, 로그 문구만 원인별로 구분"

requirements-completed: [R022, R023]

coverage:
  - id: D1
    description: "waitUntilSubmitTime() 반환 이후 authService.token 을 재조회한 freshToken 이 submitApplication()/tokenPreview/_pollStatus() 전부에 쓰이고, freshToken 이 null 이면 UNAUTHORIZED 로 명확히 실패한다(D-13)"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/apply-engine.test.ts#ApplyEngine — execute() D-13 대기 이후 토큰 재조회"
        status: pass
    human_judgment: false
  - id: D2
    description: "ApplyEngine.checkTokenExpiry() 가 스키마 없을 때 이벤트 없이 unknown 을 반환하고, 스키마 있을 때 arm() 과 동일한 계산으로 재판정 후 token-expiry-checked 를 재발행하며, 반복 호출이 phase/postSubmitted 를 훼손하지 않는다(D-10, T-07-14)"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/apply-engine.test.ts#ApplyEngine — checkTokenExpiry() 재판정 진입점 (D-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "신규 IPC 채널 4종(auth:get-stored-credentials, auth:credential-login-stored, auth:clear-credentials, apply:check-token-expiry)이 handler+preload+IpcApi 타입+removeHandler 4곳 대칭을 갖추고, credentialLoginStored 는 이메일 하나만 인자로 받으며 런타임 typeof 검증을 거친다(D-01/D-06, WR-04 선례)"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "grep -c 채널명 ipc-handlers.ts = 2 (4채널 전부), npm run typecheck / typecheck:main exit 0"
        status: pass
    human_judgment: true
    rationale: "채널 등록/타입/cleanup 대칭은 정적 검사(grep+typecheck)로 확인했으나, 렌더러가 실제로 이 채널을 호출해 저장 자격증명 상태를 조회하거나 저장 비밀번호로 로그인하는 흐름은 07-04(렌더러 UI 배선)의 몫이라 이 플랜에서는 IPC 계층까지만 검증했다."
  - id: D4
    description: "SettingsStore.setLoginMode() 가 api/browser 이외 값에 writeSettings() 를 호출하지 않고 throw 하며(WR-04), readSettings() 의 읽기 실패와 파싱 실패가 서로 다른 로그 문구를 남기고 둘 다 기본값(browser)으로 폴백한다(IN-01)"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#SettingsStore.setLoginMode — 런타임 검증 (WR-04), #SettingsStore.getLoginMode — 읽기 실패와 파싱 실패의 로그 문구 구분 (IN-01)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-27
status: complete
---

# Phase 7 Plan 3: 대기 이후 토큰 재조회 + 재판정 진입점 + IPC 계약 확장 Summary

**`apply-engine.ts` 의 대기 이전 토큰 캡처 결함(D-13)을 닫아 재로그인이 실제 POST에 반영되게 하고, `checkTokenExpiry()` 재판정 진입점(D-10)과 저장 자격증명/만료 재판정용 신규 IPC 채널 4종(D-01/D-06)을 열었으며, Phase 06 에서 이월된 WR-04/IN-01 을 함께 닫았다.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-27T17:05(추정, phase context 세션 연속)
- **Completed:** 2026-08-27T17:30:39+09:00
- **Tasks:** 3 (전부 실행, Task 1/2는 `tdd="true"`)
- **Files modified:** 7

## Accomplishments

- **D-13 대기 이후 토큰 재조회** — `execute()` 가 `waitUntilSubmitTime()` 반환 직후(시간 가드 검사 전) `authService.token` 을 `freshToken` 으로 다시 읽는다. `submitApplication()` 의 토큰 인자, `post-submitted` 이벤트의 `tokenPreview`, `_pollStatus()` 의 토큰 인자 모두 `freshToken` 으로 교체됐다. `freshToken` 이 `null` 이면 기존 `UNAUTHORIZED` 3단 처리(에러 이벤트 + error phase + `WeverseApiError` throw)를 그대로 재사용한다. 실행 시작부의 `const token` 은 `syncTime(token)` 호출에만 남아 `grep -c "this.timing.syncTime("` = 1 을 유지한다. 회귀 테스트 4건이 대기 중 토큰 교체/소실 두 경로를 봉인한다.
- **D-10 재판정 진입점** — `arm()` 의 판정 로직을 private `_evaluateCurrentTokenExpiry(schema)` 로 추출해 `arm()` 과 신규 public `checkTokenExpiry()` 가 같은 계산을 공유한다. 스키마가 없으면 이벤트 없이 `unknown` 을 반환하고, 있으면 판정 후 `token-expiry-checked` 를 재발행한다. `phase`/`postSubmitted` 를 건드리지 않아 반복 호출이 신청 상태를 훼손하지 않는다(T-07-14).
- **신규 IPC 채널 4종** — `auth:get-stored-credentials`(인자 없음, `StoredCredentialsSnapshot` 그대로 반환), `auth:credential-login-stored`(email 단일 인자, `typeof email !== "string"` 이면 `authService` 호출 없이 즉시 거부 — WR-04 선례를 신규 채널에서 반복하지 않음), `auth:clear-credentials`(로그아웃 없이 저장 정보만 삭제), `apply:check-token-expiry`. 넷 모두 handler/preload/`IpcApi` 타입/`removeHandler` 4곳 대칭을 갖춘다.
- **Phase 06 이월 항목 폐쇄** — `SettingsStore.setLoginMode()` 가 저장 진입점에서 `"api"`/`"browser"` 외 값을 거부하고 `writeSettings()` 를 호출하지 않는다(WR-04). `readSettings()` 는 `fs.readFileSync` 실패와 `JSON.parse` 실패를 별개 `try/catch` 로 분리해 원인별로 다른 로그 문구를 남기며, 폴백 동작(`defaultSettings()`)과 로그 레벨(`warn`)은 그대로 유지된다(IN-01).

## Task Commits

1. **Task 07-03-01: 대기 이후 토큰 재조회 (D-13)** - `4e866e4` (feat)
2. **Task 07-03-02: 재판정 진입점 + 신규 IPC 채널 4종 (D-10/D-01/D-06)** - `2820c10` (feat)
3. **Task 07-03-03: Phase 06 이월 항목 폐쇄 (WR-04/IN-01)** - `b7e8fd2` (fix)

**Plan metadata:** (본 커밋)

_Task 1/2는 `tdd="true"`였으나, 07-01/07-02 와 동일한 관례(신규 export 심볼이 아직 파일에 없는 상태에서는 "테스트를 먼저 실행해 실패를 확인"하는 것이 import 실패로만 나타나 RED 신호가 되지 못함)를 따라 각 태스크를 단일 `feat(...)` 커밋으로 완결했다. `<behavior>` 블록의 모든 케이스를 테스트 파일에 먼저 작성한 뒤 구현으로 통과시켰다는 점에서 RED→GREEN 순서 취지는 지켰다._

## Files Created/Modified

- `src/main/services/apply-engine.ts` - `freshToken` 재조회 블록(execute), `_evaluateCurrentTokenExpiry()` 추출 + `checkTokenExpiry()` public 메서드
- `src/main/services/__tests__/apply-engine.test.ts` - D-13 대기 중 토큰 교체/소실 4케이스, `checkTokenExpiry()` 재판정 3케이스
- `src/main/ipc-handlers.ts` - `auth:get-stored-credentials`/`auth:credential-login-stored`/`auth:clear-credentials`/`apply:check-token-expiry` handler + removeHandler, `settings:set-login-mode` 주석 정정
- `src/main/preload.ts` - `getStoredCredentials`/`credentialLoginStored`/`clearStoredCredentials`/`checkTokenExpiry` 브리지
- `src/shared/types.ts` - `IpcApi.auth`/`IpcApi.apply` 확장, `TokenExpiryState` import
- `src/main/services/settings-store.ts` - `setLoginMode()` 런타임 검증, `readSettings()` 읽기/파싱 분리
- `src/main/services/__tests__/settings-store.test.ts` - WR-04 2케이스, IN-01 2케이스

## Decisions Made

- **`freshToken` 재조회 위치는 `waitUntilSubmitTime()` 직후, 시간 가드 검사 이전** — 계획이 명시한 지점 그대로. `syncTime(token)` 호출 시점/인자는 옮기지 않았다(D-13 이 명시적으로 그대로 두라고 한 부분).
- **판정 계산 추출 형태를 `_evaluateCurrentTokenExpiry(schema: FormSchema)` private 메서드로 결정** — `arm()` 이 이미 갖고 있던 로그/이벤트 발행 순서를 그대로 옮겨 `arm()` 의 외부 동작이 바뀌지 않았다.
- **WR-04 검증 지점을 `SettingsStore.setLoginMode()` 내부로 결정, IPC 핸들러에는 중복 검증을 넣지 않음** — 계획이 명시한 방향 그대로. 저장 진입점 하나가 모든 호출 경로(현재는 IPC 뿐이지만 향후 다른 경로가 생겨도)를 커버한다.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **execute() 의 토큰 신선도 결함이 실물로 닫혔다.** 재로그인 후 새 토큰이 실제 신청 POST 와 결과 폴링에 반영된다는 것이 회귀 테스트로 봉인됐다.
- **07-04/07-05 가 배선할 수 있는 IPC 계층이 완성됐다.** 렌더러는 `window.api.auth.getStoredCredentials()`/`credentialLoginStored(email)`/`clearStoredCredentials()`/`window.api.apply.checkTokenExpiry()` 를 호출할 수 있다 — 실제 UI 배선(D-02/D-06/D-07 LoginPanel 프리필·삭제 버튼·상태문, D-15 재판정 트리거)은 이 플랜의 범위 밖으로 07-04/07-05 에 남아 있다.
- **Phase 06 이월 항목 2건이 모두 코드와 테스트로 닫혔다.** 06-REVIEW.md 의 WR-04/IN-01 은 이 플랜 완료로 해소됐다.
- **blocker 없음.** `npm test` 409/409 green(기존 398 + 신규 11), `npm run typecheck`/`typecheck:main` 둘 다 exit 0, IPC 채널 4종 각각 handler+removeHandler 2회씩(`grep -c` 확인), `grep -c "this.timing.syncTime("` = 1 유지.

## Self-Check: PASSED

- `src/main/services/apply-engine.ts` 의 `freshToken`/`checkTokenExpiry(`/`_evaluateCurrentTokenExpiry(` — FOUND
- `src/main/ipc-handlers.ts` 의 4개 신규 채널명(handler+removeHandler 각 2회) — FOUND
- `src/main/preload.ts` 의 `credentialLoginStored`/`getStoredCredentials`/`clearStoredCredentials`/`checkTokenExpiry` — FOUND
- `src/shared/types.ts` 의 `IpcApi.auth.credentialLoginStored: (email: string) => ...` 단일 인자 — FOUND
- `src/main/services/settings-store.ts` 의 `setLoginMode` 검증 분기 + `readSettings()` 2개 try 블록 — FOUND
- Commit `4e866e4` (Task 07-03-01) — FOUND in `git log --oneline --all`
- Commit `2820c10` (Task 07-03-02) — FOUND in `git log --oneline --all`
- Commit `b7e8fd2` (Task 07-03-03) — FOUND in `git log --oneline --all`
- 모든 plan `<acceptance_criteria>` 재확인: pass (grep 확인 — freshToken 소비 지점 3곳, syncTime 호출 1회, IPC 채널 4종 각 2회, credentialLoginStored 단일 인자, typeof email 검사, checkTokenExpiry 선언, setLoginMode 검증, readSettings try 2개)
- Plan 레벨 `<verification>`: `npm test` 409/409 pass, `npm run typecheck` exit 0, `npm run typecheck:main` exit 0

---
*Phase: 07-api*
*Completed: 2026-08-27*
