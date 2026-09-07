---
phase: 07-api
plan: 05
subsystem: api
tags: [react, electron, jwt, vitest, apply-execution, auth-events, r022, r023]

# Dependency graph
requires:
  - phase: 07-01
    provides: "ApplyExecution.tsx의 role=alert 인라인 만료 경고 배너 + onRelogin prop 진입점(07-01이 임시로 handleLogin에 배선)"
  - phase: 07-03
    provides: "apply:check-token-expiry IPC 채널(ApplyEngine.checkTokenExpiry() 재판정 진입점), auth:get-stored-credentials/credential-login-stored IPC 채널"
provides:
  - "src/renderer/auth-event-navigation.ts — AppStep(App.tsx에서 이관)/AuthEventNavigationDecision/decideAuthEventNavigation() 순수 판단 모듈. apply-execution 단계에서는 logged-out 만 화면을 초기화하고 그 밖의 모든 인증 이벤트는 armed 상태와 formSchema를 지킨다(Pitfall 3 해소)"
  - "App.tsx의 handleReloginFromWaiting() — 대기 화면 재로그인 진입점. 브라우저 모드는 openLogin(), API 모드는 저장 스냅샷 조회 후 available일 때만 credentialLoginStored(email) 호출, 그 밖의 상태는 이유를 배너로 표시. 어느 경로든 마지막에 checkTokenExpiry()로 D-10 재판정"
  - "ROADMAP Phase 07 SC1 · REQUIREMENTS R022/R023 Why it matters의 반증된 OTP 서술을 D-11(06) 절차로 정정(VOID 마킹 + 정정문 병기, 원문 보존)"
affects: []

actuals:
  tokens: 5125
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "순수 판단 모듈(discriminated union + exhaustive switch, default 없음) — login-failure.ts/login-panel-view.ts 관례를 auth-event-navigation.ts 에 그대로 적용"
    - "마운트 시 한 번만 등록되는 useEffect([]) 안에서 최신 상태를 읽어야 할 때 useRef + 별도 동기화 useEffect 로 스테일 클로저를 피하는 패턴(stepRef) — 이 저장소에서 처음 등장"

key-files:
  created:
    - src/renderer/auth-event-navigation.ts
    - src/renderer/__tests__/auth-event-navigation.test.ts
  modified:
    - src/renderer/App.tsx
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "onAuthEvent 구독이 마운트 시 한 번만 등록되는 useEffect([]) 안에 있어, 그 클로저가 잡는 step 값이 초기값('login')에 영구히 고정된다는 것을 발견 — decideAuthEventNavigation()에 stepRef.current(useRef + 별도 useEffect로 최신 step과 동기화)를 넘기도록 수정하지 않으면 Pitfall 3 판정 자체가 항상 'login' 단계로 잘못 평가되어 이 플랜의 목적이 무효화된다. 계획에 명시되지 않은 정정이라 Rule 1(버그 자동수정)로 처리했다"
  - "handleReloginFromWaiting()의 API 모드 실패 안내 3문구(none/corrupted/unavailable)는 07-04의 resolveStoredLoginState() 문구와 방향을 맞추되 대기 화면 맥락(비밀번호 입력 폼이 없음)에 맞게 'none' 케이스만 새로 작성 — corrupted/unavailable은 07-04 문구를 그대로 재사용"
  - "logged-out 이벤트의 setStep/setFormSchema 호출은 decision.action === 'to-login-and-clear-schema' 분기 안에 유지 — 이 분기는 step 과 무관하게 항상 그 값으로 판정되므로 실행 결과는 기존과 동일하지만, '모든 setStep 호출이 decision 분기 안에서만 일어난다'는 계획의 acceptance criteria를 코드 구조로 충족시켰다"

requirements-completed: [R022, R023]

coverage:
  - id: D1
    description: "decideAuthEventNavigation()이 apply-execution 단계에서 logged-out만 to-login-and-clear-schema로, 그 밖의 6개 이벤트(login-success/token-validated/login-failed/token-expired/cookie-extraction-failed/credential-login-progress) 전부를 stay로 판정하고, 그 밖의 단계(login/profile/event-setup/apply-form)에서는 기존 App.tsx 동작(to-profile/to-login/to-login-and-clear-schema/stay)을 그대로 재현한다"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/renderer/__tests__/auth-event-navigation.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "App.tsx의 onAuthEvent 핸들러가 decideAuthEventNavigation()의 반환값으로만 setStep/setFormSchema를 분기하고, stepRef(useRef)로 마운트 시점 클로저의 스테일 step 문제를 해소한다"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "npm run typecheck / typecheck:main exit 0, grep 확인 — decideAuthEventNavigation import, setStep 호출 7곳 전부 decision 분기 또는 무관한 기존 핸들러(handleLogout/handleValidateToken/handleProfileSaved/handleFormFetched/handleArmed/handleReset) 안"
        status: pass
    human_judgment: true
    rationale: "정적 검사(타입체크+grep)로 구조적 계약은 확인했으나, 실제 대기 화면에서 재로그인 성공/실패 후에도 카운트다운과 armed 상태가 화면에 유지되는지는 vitest.config.ts가 .tsx를 테스트 대상에서 제외해 자동 커버리지 밖이다(07-01/07-04와 동일한 저장소 전체 관례) — 07-VALIDATION.md의 human-check로 phase 말미 UAT 이관."
  - id: D3
    description: "App.tsx의 handleReloginFromWaiting()이 loginMode에 따라 브라우저(openLogin)/API(getStoredCredentials → available일 때만 credentialLoginStored) 경로로 분기하고, available이 아닌 3상태(none/corrupted/unavailable) 각각 다른 이유를 setLoginError로 표시하며, 성공·실패 무관하게 마지막에 checkTokenExpiry()를 호출한다"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "grep -c 'credentialLoginStored\\|checkTokenExpiry\\|onRelogin=' src/renderer/App.tsx, npm run typecheck exit 0"
        status: pass
    human_judgment: true
    rationale: "IPC 호출 배선과 분기 구조는 정적 검사로 확인했으나, 실제 API 모드 재로그인이 성공하는지·경고가 갱신/소멸되는지·저장된 자격증명이 없을 때 배너에 이유가 뜨는지는 실계정이 필요한 UAT 시나리오다(플랜의 <human-check> 5개 항목, 07-VALIDATION.md에 이관)."
  - id: D4
    description: "ROADMAP Phase 07 SC1과 REQUIREMENTS R022/R023 Why it matters의 반증된 OTP 서술 3곳이 삭제 없이 [VOID] 마킹 + 정정문으로 보존되고, R022/R023의 Class/Status/Description 필드는 변경되지 않는다"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "grep -c VOID .planning/ROADMAP.md(8, 이전 대비 +1) / .planning/REQUIREMENTS.md(8, 이전 대비 +4), git diff .planning/REQUIREMENTS.md 로 Class/Status/Description 라인 미변경 확인"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-27
status: complete
---

# Phase 7 Plan 5: 대기 중 재로그인 + 인증 이벤트 네비게이션 가드 + 문서 정정 Summary

**대기 화면 재로그인 진입점(`handleReloginFromWaiting`)이 모드별 실제 로그인을 시작하고, 순수 함수 `decideAuthEventNavigation()`이 `apply-execution` 단계에서 명시적 로그아웃만 화면을 초기화하도록 판정해 armed 상태를 보호했으며, ROADMAP/REQUIREMENTS의 반증된 OTP 서술 3곳을 D-11(06) 절차로 정정했다.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-27 (phase context 세션 연속)
- **Completed:** 2026-08-27
- **Tasks:** 2
- **Files modified:** 5 (신규 2 + 수정 3)

## Accomplishments

- **인증 이벤트 네비게이션 판정을 순수 함수로 고정(Pitfall 3)** — `src/renderer/auth-event-navigation.ts`가 `AppStep`(App.tsx에서 이관)과 `decideAuthEventNavigation(eventType, step)`을 export한다. `apply-execution` 단계에서는 `logged-out`만 `to-login-and-clear-schema`로 판정하고 나머지 6개 이벤트(로그인 성공/실패, 토큰 검증/만료, 쿠키 추출 실패, 저장 로그인 진행)는 전부 `stay`다. 그 밖의 단계에서는 기존 `App.tsx` 동작(`to-profile`/`to-login`/`to-login-and-clear-schema`)을 그대로 재현한다. `default` 없는 exhaustive switch로 새 이벤트 타입 추가 시 컴파일 에러가 나게 했다.
- **App.tsx의 onAuthEvent 재구성** — `setAuthStatus`/`setLoginError`는 이벤트별 기존 로직 그대로 유지하고, `setStep`/`setFormSchema` 호출만 `decision.action` 분기 안에서 일어나도록 재배선했다. 대기 중 `token-expired`로 `isLoggedIn`이 `false`가 돼도 `step`은 그대로 `apply-execution`에 머문다.
- **스테일 클로저 버그를 계획 실행 중 발견해 자동 수정(Rule 1)** — `onAuthEvent` 구독은 마운트 시 한 번만 도는 `useEffect([])` 안에 있어, 그 클로저가 잡는 `step` state는 초기값 `"login"`에 고정된다. `decideAuthEventNavigation()`에 이 값을 그대로 넘기면 `apply-execution` 판정이 실제로는 절대 일어나지 않아 이 플랜의 목적 자체가 무효화된다. `useRef<AppStep>` + 별도 `useEffect(() => { stepRef.current = step }, [step])`로 최신값을 추적해 해결했다.
- **대기 중 재로그인 진입점 배선(D-15, Pitfall 2)** — `handleReloginFromWaiting()`이 `<ApplyExecution onRelogin={...} />`에 연결됐다(07-01이 임시로 넣어둔 `handleLogin` 대체). 브라우저 모드는 `openLogin()`, API 모드는 `getStoredCredentials()` 스냅샷을 조회해 `available`일 때만 `credentialLoginStored(email)`을 호출하고, `none`/`corrupted`/`unavailable`은 각각 다른 이유를 `setLoginError`로 표시한다(버튼이 조용히 아무 일도 하지 않는 상태를 만들지 않음, T-07-18). 시도 결과와 무관하게 `finally`에서 `checkTokenExpiry()`를 호출해 D-10 재판정을 트리거하며, 이 호출 자체의 실패는 흐름을 막지 않게 감쌌다.
- **반증된 문서 서술 3곳 정정(D-11(06))** — ROADMAP Phase 07 SC1의 "OTP 코드만 다시 입력하면 된다"와 REQUIREMENTS R022/R023의 `Why it matters`에 `[VOID — 2026-08-25 HAR 반증]` 마킹 + 정정문을 병기했다. 원문은 삭제하지 않았다. SC1 정정문에는 D-01의 의도적 편차(비밀번호 칸은 채워지지 않는다)를 명시했다. R022 정정문은 D-03(06)의 부수효과로 요구사항 적용 범위가 API 모드 한정에서 두 모드 전체로 확대됐음을 함께 기록했다. Traceability 표의 R022/R023 `Proof` 열도 `unmapped`에서 정정 사실 기록으로 갱신했다.

## Task Commits

1. **Task 07-05-01: 대기 중 재로그인 흐름 + 인증 이벤트 네비게이션 판정 (D-10/D-15, Pitfall 2/3)** - `c0f2d1f` (feat)
2. **Task 07-05-02: 반증된 문서 서술 정정 — ROADMAP SC1 · REQUIREMENTS R022/R023 (D-11/06 절차)** - `8cdb65b` (docs)

_Task 1은 `tdd="true"`였으나, 07-01/02/03/04와 동일한 관례(신규 export 심볼이 파일에 아직 없는 상태에서는 "테스트를 먼저 실행해 실패를 확인"하는 것이 import 실패로만 나타나 RED 신호가 되지 못함)를 따라 단일 `feat(...)` 커밋으로 완결했다. `<behavior>` 블록의 모든 (이벤트 종류 × 단계) 조합을 테스트 파일에 먼저 작성한 뒤 구현으로 통과시켰다는 점에서 RED→GREEN 순서 취지는 지켰다._

## Files Created/Modified

- `src/renderer/auth-event-navigation.ts` - `AppStep`/`AuthEventNavigationDecision`/`decideAuthEventNavigation()` 신설
- `src/renderer/__tests__/auth-event-navigation.test.ts` - 37개 케이스(apply-execution 전수 6+1, 그 밖 4단계 × 6종 이벤트, 반환값 타입 전수 확인)
- `src/renderer/App.tsx` - `AppStep` import로 전환(로컬 선언 제거), `stepRef` 신설, `onAuthEvent` 핸들러 재구성, `handleReloginFromWaiting()` 신설, `onRelogin={handleReloginFromWaiting}` 배선
- `.planning/ROADMAP.md` - Phase 07 SC1에 `[VOID]` + 정정문 병기
- `.planning/REQUIREMENTS.md` - R022/R023 `Why it matters`에 `[VOID]` + 정정문 병기, Traceability `Proof` 갱신

## Decisions Made

- **stepRef(useRef) 도입 — 계획에 없던 발견, Rule 1로 자동 수정.** `App.tsx`의 `onAuthEvent` 구독은 마운트 1회성 `useEffect([])` 안에 있다. 이 태스크 이전에는 이 핸들러가 `step`을 읽지 않았으므로 문제가 없었으나, `decideAuthEventNavigation(eventType, step)` 호출을 추가하는 순간 그 `step`이 스테일 클로저(영구히 `"login"`)라는 것이 드러났다. 고치지 않으면 `apply-execution` 판정 경로가 실행 중 한 번도 참이 되지 않아, 이 플랜이 막으려는 Pitfall 3가 코드상으로는 고쳐진 것처럼 보이지만 실제로는 전혀 작동하지 않는다 — 계획에 명시되지 않았지만 정확성에 직결되는 결함이라 Rule 1(버그 자동수정)으로 처리했다.
- **handleReloginFromWaiting의 API 모드 실패 문구** — `corrupted`/`unavailable` 문구는 07-04의 `resolveStoredLoginState()`가 이미 확정한 문구를 그대로 재사용해 같은 상황에 다른 문구가 뜨는 일이 없게 했다. `none`은 07-04에는 없던 케이스(그쪽은 폼이 항상 보이므로 안내가 필요 없었다)라 대기 화면 맥락에 맞게 새로 작성했다.
- **logged-out 분기를 계획대로 decision.action 체크 안에 유지** — 실행 결과는 이전과 동일(logged-out은 항상 to-login-and-clear-schema)이지만, "모든 setStep 호출이 decision 반환값 분기 안에서만 일어난다"는 acceptance criteria를 코드 구조로 명시적으로 충족시켰다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `step` 스테일 클로저로 인해 apply-execution 판정이 실행되지 않는 문제**
- **Found during:** Task 07-05-01 구현 중 (`onAuthEvent`를 `decideAuthEventNavigation()`으로 재배선하는 단계)
- **Issue:** `onAuthEvent` 구독이 `useEffect(() => {...}, [])` 안에 있어 그 클로저가 잡는 `step` state가 컴포넌트 마운트 시점 값("login")에 고정된다. `decideAuthEventNavigation(event.type, step)`을 그대로 호출하면 이후 사용자가 `apply-execution`으로 넘어가도 이 핸들러 안의 `step`은 계속 `"login"`으로 보여, `apply-execution` 전용 분기(armed 상태 보호)가 실전에서 단 한 번도 참이 되지 않는다.
- **Fix:** `const stepRef = useRef<AppStep>(step)`와 `useEffect(() => { stepRef.current = step }, [step])`를 추가하고, `onAuthEvent` 핸들러 안에서는 `step` 대신 `stepRef.current`를 `decideAuthEventNavigation()`에 넘긴다.
- **Files modified:** `src/renderer/App.tsx`
- **Verification:** `auth-event-navigation.test.ts` 37케이스 전부 pass, `npm run typecheck`/`typecheck:main` exit 0. (런타임 동작 자체는 vitest가 `.tsx`를 커버하지 않아 자동 확인 밖 — `07-VALIDATION.md`의 human-check로 이관.)
- **Committed in:** `c0f2d1f` (Task 07-05-01 커밋에 포함)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** 이 수정 없이는 Task 07-05-01의 핵심 목표(Pitfall 3 해소) 자체가 실전에서 작동하지 않았을 것이다. 스코프 확장이 아니라 계획이 요구한 정확성을 실제로 달성하기 위한 필수 수정.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **R022(토큰 만료 사전 경고)의 세로 슬라이스가 대기 화면 재로그인까지 끝에서 끝으로 완결됐다.** `token-expiry.ts`(07-01) → `arm()`/`checkTokenExpiry()`(07-01/07-03) → 인라인 경고 배너(07-01) → `handleReloginFromWaiting()`(07-05) → `checkTokenExpiry()` 재판정(07-05)까지 사슬이 실물로 이어졌고, 그 과정에서 armed 상태와 `formSchema`가 파괴되지 않는다는 것이 순수 함수 단위 테스트로 봉인됐다.
- **R023(자격증명 저장)도 화면(07-04)에 이어 대기 화면 재진입 경로(07-05)까지 완결됐다.**
- **문서 정합성 확보** — ROADMAP/REQUIREMENTS의 반증된 OTP 서술이 검증 단계를 오도할 여지가 사라졌다. 이 phase가 마지막 plan이므로, 이제 R022/R023이 `requirements.ready-ids`에서 더 이상 보류되지 않는다(아래 self-check 참조).
- **`<human-check>` 5개 시나리오 미실행** — 대기 화면 배너/재로그인 버튼/카운트다운 유지/재판정 갱신/저장 자격증명 없음 안내는 vitest 대상 밖(`.tsx` 제외)이고 실계정이 필요해 이 실행 환경에서 수행하지 못했다. `07-VALIDATION.md`의 Manual-Only Verifications로 phase 말미 UAT에 이관한다.
- **blocker 없음.** `npm test` 455/455 green(기존 418 + 신규 37), `npm run typecheck`/`typecheck:main`/`npm run build` 모두 exit 0.

## Self-Check: PASSED

- `src/renderer/auth-event-navigation.ts` — FOUND
- `src/renderer/__tests__/auth-event-navigation.test.ts` — FOUND
- Commit `c0f2d1f` (Task 07-05-01) — FOUND in `git log --oneline --all`
- Commit `8cdb65b` (Task 07-05-02) — FOUND in `git log --oneline --all`
- 모든 plan `<acceptance_criteria>` 재확인: pass — `export function decideAuthEventNavigation(`/`export type AppStep` 존재, `App.tsx`의 `setStep(` 호출이 전부 `decision.action` 분기 또는 무관한 기존 핸들러 안, `apply-execution`+`token-expired` → `stay`(테스트로 단언), `apply-execution`+`logged-out` → `to-login-and-clear-schema`(테스트로 단언), `App.tsx`가 `credentialLoginStored`/`checkTokenExpiry` 호출, `onRelogin={handleReloginFromWaiting}` 배선, ROADMAP/REQUIREMENTS VOID 마킹 + 정정문 + Class/Status/Description 불변
- Plan 레벨 `<verification>`: `npm test` 455/455 pass, `npm run typecheck` exit 0, `npm run typecheck:main` exit 0, `npm run build` exit 0

---
*Phase: 07-api*
*Completed: 2026-08-27*
