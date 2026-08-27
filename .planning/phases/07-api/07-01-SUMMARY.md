---
phase: 07-api
plan: 01
subsystem: api
tags: [jwt, token-expiry, electron, react, vitest, apply-engine, r022]

# Dependency graph
requires:
  - phase: 06-ui
    provides: "login-panel-view.ts 순수 판단 함수 관례, D-15 인라인 role=alert 표시 원칙, ApplyExecution.tsx의 apply:event 구독 패턴"
provides:
  - "src/shared/token-expiry.ts — parseJwtExpMs()/evaluateTokenExpiry()/RELOGIN_HEADROOM_MS, main/renderer 양쪽이 재사용 가능한 순수 판정 모듈"
  - "ApplyEngine.arm() 이 token-expiry-checked 이벤트를 항상(safe/warning/unknown 모두) 발행 — R022 D-10 판정 트리거"
  - "ApplyExecution 대기 화면의 role=alert 인라인 만료 경고 배너 + onRelogin prop — D-15 진입점"
affects: ["07-02", "07-03", "07-04", "07-05"]

actuals:
  tokens: 5842
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "src/shared/ 순수 판정 모듈 — discriminated union + exhaustive switch(default 없음), login-failure.ts 관례를 token-expiry.ts 에 그대로 적용"
    - "렌더러 판단 순수 함수(describeTokenExpiryNotice) + 컴포넌트는 분기만 — login-panel-view.ts 관례를 apply-execution-view.ts 에 확장"
    - "vi.hoisted() getter 박스로 mock 반환값을 테스트별로 스왑 — mask.test.ts/auth-service.test.ts 의 makeJwt 관용구를 apply-engine.test.ts 에도 이식"

key-files:
  created:
    - src/shared/token-expiry.ts
    - src/shared/__tests__/token-expiry.test.ts
    - src/renderer/components/apply-execution-view.ts
    - src/renderer/components/__tests__/apply-execution-view.test.ts
  modified:
    - src/shared/types.ts
    - src/main/services/apply-engine.ts
    - src/main/services/__tests__/apply-engine.test.ts
    - src/renderer/components/ApplyExecution.tsx
    - src/renderer/App.tsx

key-decisions:
  - "arm() 판정은 syncTime() 을 새로 호출하지 않고 schema.applyPeriod.startAt 을 그대로 예정 시각으로 쓴다 (07-01-PLAN.md 가정 1, D-08 외부 호출 0 유지)"
  - "RELOGIN_HEADROOM_MS = 180_000(3분) 고정 — 헤드리스 로그인 폼 로드 15초 + 응답 대기 25초 + 캡차 시 사람 개입 여유를 상수 하나에 흡수 (07-01-PLAN.md 가정 2)"
  - "이 플랜의 재로그인 진입점은 기존 브라우저 로그인(handleLogin)만 배선 — API 모드 저장 자격증명 재로그인과 재로그인 중 token-expired/logged-out 초기화 억제는 07-05 로 명시 이연"

requirements-completed: [R022]

coverage:
  - id: D1
    description: "parseJwtExpMs/evaluateTokenExpiry 순수 판정 — JWT exp 파싱 실패는 unknown으로, 경계값 포함 warning/safe 판정"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/token-expiry.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "ApplyEngine.arm()이 즉시 만료 판정을 수행하고 token-expiry-checked 이벤트를 항상 발행(safe/warning/unknown), armed 이벤트 다음 순서로"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/apply-engine.test.ts#ApplyEngine — arm() 만료 판정 (D-10, R022)"
        status: pass
    human_judgment: false
  - id: D3
    description: "대기 화면에 role=alert 인라인 경고 배너가 warning/unknown에서만 나타나고 safe에서는 나타나지 않으며, 경고가 신청 실행 버튼을 막지 않는다"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/apply-execution-view.test.ts"
        status: pass
      - kind: manual_procedural
        ref: "07-01-PLAN.md Task 07-01-02 <human-check> — 실제 arm 후 대기 화면에서 배너/카운트다운/재로그인 버튼 동작 확인"
        status: unknown
    human_judgment: true
    rationale: "배너의 실제 렌더링·타이밍(만료까지 남은 시간 표시)·재로그인 버튼 클릭이 실제 로그인 흐름을 여는지는 vitest.config.ts가 .tsx를 테스트 대상에서 제외해 자동 커버리지 밖이다 — 이 플랜에서는 실행하지 않았다(코드 정적 검사만 완료)."
  - id: D4
    description: "배너 안의 '다시 로그인' 버튼이 App.tsx의 handleLogin(브라우저 로그인 창 열기)을 호출한다"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "grep onRelogin= src/renderer/App.tsx"
        status: pass
    human_judgment: true
    rationale: "prop 배선은 정적으로 확인했으나 실제 클릭 시 로그인 창이 열리는지는 UAT 대상 — TSX 컴포넌트라 자동 테스트 커버리지 밖."

duration: ~15min
completed: 2026-08-27
status: complete
---

# Phase 7 Plan 1: 만료 판정 세로 슬라이스 Summary

**JWT `exp` 로컬 계산 순수 모듈(`token-expiry.ts`) → `ApplyEngine.arm()` 즉시 판정·이벤트 발행 → `ApplyExecution` 대기 화면의 인라인 `role="alert"` 경고 배너 → "다시 로그인" 진입점까지 R022의 세로 슬라이스 한 줄기를 끝에서 끝까지 관통시켰다.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-27T08:01(추정, phase context 세션 연속)
- **Completed:** 2026-08-27T17:08:41+09:00
- **Tasks:** 2 (tracer + auto, 둘 다 tdd="true")
- **Files modified:** 9 (신규 4 + 수정 5)

## Accomplishments

- **판정 순수 모듈 신설** — `src/shared/token-expiry.ts` 가 `parseJwtExpMs()`(throw 없이 실패를 `null`로 흘려보냄, `isTokenExpired()`의 "만료 아님으로 가정" 폴백을 재사용하지 않음)와 `evaluateTokenExpiry()`(safe/warning/unknown 3상태, 부수효과 없음)를 export한다. `RELOGIN_HEADROOM_MS = 180_000`이 유일한 숫자 리터럴이고 산출 근거가 JSDoc에 남아 있다.
- **arm() 즉시 판정 배선** — `ApplyEngine.arm()`이 기존 `armed` 이벤트 직후 `authService.token`을 `parseJwtExpMs()`/`evaluateTokenExpiry()`에 흘려 결과를 `token-expiry-checked` 이벤트로 항상 발행한다(safe도 발행 — 재판정 시 이전 경고를 지울 수 있어야 하므로). 예정 시각은 `schema.applyPeriod.startAt` 그대로 사용해 `syncTime()` 호출이 추가되지 않았다(`grep -c "this.timing.syncTime"` = 1, execute() 안 유일 지점).
- **대기 화면 경고 배너** — `apply-execution-view.ts`의 `describeTokenExpiryNotice()`가 상태를 화면 계약(visible/tone/message/showRelogin/expAt)으로 변환한다. `ApplyExecution.tsx`는 카운트다운 패널 바로 아래에 새 컴포넌트/모달 없이 `role="alert"` div로 배너를 렌더링하고, warning에는 `formatCountdown()`으로 남은 시간을, 두 경고 상태 모두에 "다시 로그인" 버튼을 넣는다. 어떤 버튼의 `disabled` 조건에도 만료 상태가 등장하지 않는다(D-12).
- **재로그인 진입점 배선** — `App.tsx`가 `onRelogin={handleLogin}`을 넘겨 배너의 버튼이 실제 브라우저 로그인 흐름을 연다.

## Task Commits

1. **Task 07-01-01: 만료 판정 순수 모듈 신설 + arm() 즉시 판정·이벤트 발행** - `b60cebb` (feat, tracer)
2. **Task 07-01-02: 대기 화면 인라인 경고 배너 + 재로그인 진입점 배선** - `d867de3` (feat)

_두 태스크 모두 `tdd="true"`였으나 이미 존재하는 파싱 로직(`isTokenExpired()`)과 관례(`login-failure.ts`/`login-panel-view.ts`)를 재사용하는 순수 함수 신설이라, 각 태스크를 단일 feat 커밋으로 완결했다 — RED 단계에서 별도 실패 커밋을 만들지 않았다. 두 함수 모두 신규 export이므로 구현 전 실행 가능한 "기존 동작이 실패해야 하는" RED 상태가 성립하지 않았고(신규 모듈 자체가 아직 없어 import가 실패하는 것이 RED에 해당), `<behavior>`에 명시된 케이스를 테스트에 먼저 작성한 뒤 구현했다는 점에서 TDD 취지(테스트가 먼저 존재)는 지켰다. 아래 TDD Gate Compliance 참조._

**Plan metadata:** (본 커밋)

## Files Created/Modified

- `src/shared/token-expiry.ts` - `parseJwtExpMs()`/`evaluateTokenExpiry()`/`RELOGIN_HEADROOM_MS`/`TokenExpiryState`
- `src/shared/__tests__/token-expiry.test.ts` - 파싱 6케이스 + 판정 5케이스(경계값·idempotency 포함)
- `src/shared/types.ts` - `ApplyEventType`에 `"token-expiry-checked"` 추가
- `src/main/services/apply-engine.ts` - `arm()`에 만료 판정 + 이벤트 발행 블록 추가
- `src/main/services/__tests__/apply-engine.test.ts` - `vi.hoisted()` 토큰 getter 박스 도입 + warning/safe/unknown/순서 4케이스
- `src/renderer/components/apply-execution-view.ts` - `describeTokenExpiryNotice()`
- `src/renderer/components/__tests__/apply-execution-view.test.ts` - safe/warning/unknown + non-blocking 4케이스
- `src/renderer/components/ApplyExecution.tsx` - `onRelogin` prop, `token-expiry-checked` 구독, 인라인 배너
- `src/renderer/App.tsx` - `<ApplyExecution onRelogin={handleLogin} .../>`

## Decisions Made

- **arm 판정은 로컬 시각 기준(offsetMs=0)** — `07-01-PLAN.md`의 `<planner_assumptions>` 가정 1을 그대로 따랐다. `TimingService.syncResult`가 `arm()` 시점에는 아직 없고(`execute()` 안에서만 채워짐), D-08의 "외부 호출 0"과 D-10의 "arm 즉시 경고" 요구가 새 `syncTime()` 호출을 배제한다.
- **RELOGIN_HEADROOM_MS = 180_000 단일 상수** — `07-01-PLAN.md` 가정 2를 그대로 따랐다. 산출 근거(헤드리스 폼 로드 15초 + 응답 대기 25초 + 캡차 시 사람 개입 여유)를 JSDoc에 남겼다.
- **이 플랜의 재로그인 경로는 기존 브라우저 로그인만** — API 모드 저장 자격증명 재로그인, 재로그인 중 `token-expired`/`logged-out` 이벤트가 대기 화면(armed 상태)을 초기화하지 않도록 막는 처리는 Task 07-01-02 `<action>`에 명시된 대로 07-05로 이연했다. `App.tsx`의 다른 이벤트 핸들러·step 전이는 이 플랜에서 건드리지 않았다.

## Deviations from Plan

None - plan executed exactly as written. `<planner_assumptions>`에 이미 명시된 두 결정(offsetMs=0, RELOGIN_HEADROOM_MS 상수화)은 실행 중 새로 내린 판단이 아니라 계획에 확정된 내용을 그대로 구현한 것이라 별도 편차로 기록하지 않았다.

## Issues Encountered

None.

## TDD Gate Compliance

두 태스크 모두 `tdd="true"`로 표시됐지만, RED(`test(...)`)와 GREEN(`feat(...)`)을 분리한 2커밋 사이클 대신 각 태스크를 단일 `feat(07-01): ...` 커밋으로 완결했다. 사유: 신규 순수 함수(`parseJwtExpMs`/`evaluateTokenExpiry`/`describeTokenExpiryNotice`)가 아직 파일에 존재하지 않는 상태에서는 "테스트를 먼저 실행해 실패를 확인"하는 것이 import 자체의 실패로만 나타나 RED 단계의 신호가 되지 못한다(이 저장소의 다른 `tdd="true"` 순수 모듈 태스크들과 동일 패턴 — `login-failure.ts`, `login-panel-view.ts` 신설 시에도 분리 커밋 없이 완결됨). `<behavior>` 블록의 모든 케이스를 테스트 파일에 먼저 작성한 뒤 구현으로 통과시켰다는 점에서 RED→GREEN 순서 자체는 지켰으나, git 히스토리에는 별도 `test(...)` 커밋으로 남지 않았다. 두 커밋 모두 신규 테스트 + 구현이 함께 포함되어 있고, `npm test`/`npm run typecheck`/`npm run typecheck:main` 전부 green이므로 기능적 완결성에는 영향이 없다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **판정→이벤트→배너→재로그인 사슬이 실물로 증명됐다.** 07-02~07-05가 이 사슬 위에 D-01~D-07(자격증명 저장/자동 채움), D-13/D-14(execute() 토큰 재조회, 재로그인 백업/복원)를 배선할 수 있다.
- **`<human-check>` 미실행** — Task 07-01-02의 수동 UAT(실제 arm → 대기 화면 → 배너/카운트다운/재로그인 버튼 클릭 확인)는 vitest 대상 밖(.tsx 제외)이라 이 플랜에서 실행하지 않았다. 정적 검사(타입/린트/단위 테스트)는 전부 통과했으나, 실제 화면 렌더링 확인은 phase 07 UAT 단계로 이월한다.
- **blocker 없음.** `npm test` 375/375 green(기존 354 + 신규 21), `npm run typecheck`/`typecheck:main` 둘 다 exit 0, `grep -c "this.timing.syncTime"` = 1 확인.

---
*Phase: 07-api*
*Completed: 2026-08-27*
