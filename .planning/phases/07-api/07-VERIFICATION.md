---
phase: 07-api
verified: 2026-08-28T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "재로그인이 끝나면 새 토큰의 exp 로 만료가 다시 판정되어 경고가 갱신되거나 사라진다 (D-10, 07-05 must-have; R022) — CR-01"
  gaps_remaining: []
  regressions: []
behavior_unverified_items: []
human_verification:
  - test: "만료 임박(또는 exp를 읽을 수 없는) 토큰 상태로 arm해 대기 화면에 진입한다"
    expected: "대기 화면 카운트다운 아래에 role=\"alert\" 경고와 '다시 로그인' 버튼이 보이고, 경고가 떠 있는 동안에도 신청 실행 버튼이 계속 눌린다"
    why_human: ".tsx 렌더러 컴포넌트는 vitest.config.ts의 include(.test.ts만 포함)에 잡히지 않아 실제 렌더링은 자동 테스트 대상이 아니다(07-01 PLAN human-check, 저장소 전체의 기존 패턴)"
  - test: "API 모드로 로그인 → 앱 종료 후 재시작 → 로그인 폼 확인. 이메일 칸이 저장된 주소로 채워져 있고 비밀번호 칸은 비어 있는지, '저장된 비밀번호로 로그인'으로 재입력 없이 로그인되는지, 이메일을 다른 주소로 바꾸면 버튼이 비활성화되고 '다른 계정입니다' 안내가 뜨는지, 로그아웃 상태에서도 상태문과 삭제 버튼이 보이고 삭제하면 함께 사라지는지 확인한다"
    expected: "네 가지 시나리오(프리필/저장 비밀번호 로그인/이메일 불일치 차단/삭제) 모두 문서대로 동작한다"
    why_human: "LoginPanel.tsx JSX 렌더링 — 순수 함수 resolveStoredLoginState()는 자동 테스트로 커버되지만 실제 화면 반영은 수동 확인 대상이다(07-04 PLAN human-check)"
  - test: "대기 화면에서 '다시 로그인'을 눌러 ① API 모드에서 비밀번호 재입력 없이, ② 브라우저 모드에서 로그인 창으로 재로그인이 시작되는지, ③ 재로그인 성공·실패 어느 쪽이든 대기 화면과 카운트다운이 유지되고 처음 화면으로 돌아가지 않는지, ④ 재로그인이 성공하면 경고가 사라지거나 갱신되는지, ⑤ 저장된 자격증명이 없는 API 모드에서 '다시 로그인'을 누르면 이유가 화면에 표시되는지 확인한다"
    expected: "다섯 시나리오 모두 문서대로 동작한다"
    why_human: "대기 화면 인증 이벤트 흐름은 실계정·타이밍 의존적이라 자동화 대상 밖이다(07-05 PLAN human-check). 시나리오 ④는 이전 검증(2026-08-27)에서 CR-01로 실패가 코드·정적 분석 양쪽에서 확인됐던 항목이다 — 07-06 이 그 결함을 코드·행동 테스트 수준에서 닫았으므로, 이 UAT 는 이제 결함 재확인이 아니라 실계정을 통한 최종 확인 절차가 된다(07-06-PLAN.md Task 1 의 human-check와 동일 항목, 여기서 하나로 병합)."
  - test: "빠른 연속 두 번 클릭으로 대기 화면 '다시 로그인' 버튼을 누른다 (WR-01). ① 첫 클릭 직후 버튼이 비활성(회색) 상태가 되어 두 번째 클릭이 들어가지 않는지, ② 시도 종료 후(성공·실패 무관) 버튼이 다시 눌리는 상태로 돌아오는지, ③ API 모드에서 저장 자격증명 재로그인이 실패하면 그 사유가 로그인 패널에 문구로 표시되는지, ④ 경고·버튼 잠금 중에도 신청 실행 버튼은 계속 눌리는지(D-12) 확인한다"
    expected: "네 가지 모두 문서대로 동작한다"
    why_human: "07-06-PLAN.md Task 3 의 human-check 항목 — .tsx 렌더링/실계정 타이밍 의존이라 vitest 대상 밖이며 실행 시 수행되지 않았다(07-06-SUMMARY.md coverage D3)."
  - test: "credentialLogin() 이 25초 timeout 후 쿠키에서 토큰을 뒤늦게 발견하는 느린 경로를 재현한다(네트워크를 의도적으로 느리게 하거나 `credentialLogin(headless): result=timeout` 뒤 성공 로그를 확인). 그 상태에서 앱을 재시작해 이메일 프리필과 저장 비밀번호 로그인 버튼이 나타나는지 확인한다. 재현이 어려우면 정상 경로(폴링 성공)로 저장이 여전히 동작하는지만 확인하고 미재현으로 기록한다"
    expected: "timeout→쿠키 경로로 로그인해도 다음 실행에서 자격증명이 저장돼 있다 (재현 곤란 시 정상 경로 저장 확인으로 대체)"
    why_human: "07-07-PLAN.md Task 1 의 human-check — 헤드리스 BrowserWindow 의 실제 timeout→쿠키 경로는 DOM 테스트 환경이 없어 재현이 어렵고, 실행 시 수행되지 않았다(07-07-SUMMARY.md coverage D1)."
  - test: "API 모드에서 credentials.enc 를 의도적으로 손상시킨 뒤 앱을 재시작해 'corrupted' 안내를 띄운다. 안내대로 이메일/비밀번호를 직접 입력해 로그인에 성공한 직후, 그 안내가 사라지고 '이 기기에 …저장되어 있습니다' 상태문 + 삭제 버튼으로 즉시 바뀌는지 확인한다"
    expected: "로그인 성공 직후 corrupted 안내가 낡은 채로 남지 않고 available 상태문으로 갱신된다"
    why_human: "07-07-PLAN.md Task 2 의 human-check — LoginPanel.tsx JSX 렌더링(vitest 대상 밖)이며 실행 시 수행되지 않았다(07-07-SUMMARY.md coverage D2)."
---

# Phase 07: API 자격 증명 저장 + 토큰 만료 사전 경고 Verification Report

**Phase Goal:** API 모드 사용자가 매 로그인마다 자격증명을 재입력하지 않아도 되고, 신청 대기 중 토큰이 만료되기 전에 재로그인할 시간을 사전에 확보한다.
**Verified:** 2026-08-28
**Status:** human_needed
**Re-verification:** Yes — after gap closure (07-06, 07-07)

## Re-verification Summary

이전 검증(2026-08-27)은 10/11 must-haves 를 VERIFIED 로 판정하고 truth #3 (D-10, R022, CR-01) 하나를 FAILED 로 남겼다: 브라우저 모드(기본 로그인 모드)에서 `AuthService.login()`이 팝업의 초기 로드만 기다리고 반환해, 대기 화면의 "다시 로그인" 이후 재로그인이 실제로 끝난 뒤에도 만료 경고 배너가 갱신되지 않는 결함이었다.

두 개의 gap-closure plan(07-06, 07-07, 커밋 범위 `d748a39..HEAD`, 11 커밋)이 실행됐다. 아래에서 그 claim 을 코드·테스트 실행으로 직접 재대조했다 — SUMMARY.md/07-REVIEW-GAPS.md 의 진술을 그대로 받아들이지 않고, 소스 파일을 직접 읽고 해당 테스트를 이 검증 프로세스 안에서 재실행했다.

**결론: truth #3 은 이제 코드·행동 테스트 수준에서 참이다.** 이전 결함을 만든 두 가지 함정을 구체적으로 확인했다:

1. **`stepRef.current` vs 캡처된 `step` 함정.** `App.tsx`의 `onAuthEvent` 콜백은 여전히 마운트 1회성 `useEffect([])` 안에 있어 그 클로저가 잡는 `step` 지역 변수는 영구히 초기값에 고정된다. 새 가드는 `shouldRecheckTokenExpiry(event.type, stepRef.current)`로 **`stepRef.current`를 읽는다** — `step`을 직접 읽지 않는다(`src/renderer/App.tsx` L74, 코드 직독으로 확인). `stepRef`는 07-05 가 이미 만든 동기화 `useEffect(() => { stepRef.current = step }, [step])`(L37-39)를 그대로 재사용한다.
2. **재로그인 "시도"가 아니라 실제 새 토큰으로부터만 판정하는지.** `shouldRecheckTokenExpiry()`가 `true`를 반환해도 그 자체가 경고를 지우지 않는다 — `void window.api.apply.checkTokenExpiry()`를 호출할 뿐이고, 실제 판정은 `ApplyEngine._evaluateCurrentTokenExpiry()`가 그 시점의 `authService.token`(main 프로세스에 실제로 캐시된 토큰)에서 `exp`를 파싱해 내린다. 신규 계층 관통 테스트(`src/__tests__/relogin-expiry-recheck.test.ts`)의 "실패 대조군" 케이스가 토큰을 교체하지 않은 채(=재로그인 실패/미완료를 흉내) 같은 사슬을 돌리면 배너가 `visible: true`로 남는다는 것을 단언한다 — 재로그인 "시도" 자체가 안심의 근거가 되지 않는다.

이 검증 세션에서 직접 실행한 결과:
- `npx vitest run src/__tests__/relogin-expiry-recheck.test.ts` — 6/6 pass
- `npx vitest run src/renderer/__tests__/auth-event-navigation.test.ts` — 46/46 pass
- `npx vitest run src/main/services/__tests__/auth-service.test.ts` — 78/78 pass
- `npm test` — 22 suites / 474 tests, all green (이전 21 suites / 455 tests에서 증가)
- `npm run typecheck` / `npm run typecheck:main` — 둘 다 exit 0
- `npm run build` — exit 0

세 건의 WARNING(WR-01/02/03)도 코드를 직접 대조해 닫힘을 확인했다(아래 표 참조). 잠금 해제가 성공/실패/예외 모든 경로에서 보장되는지, 저장 관문이 정말 단일 지점으로 수렴했는지를 이 검증에서 직접 grep·읽기로 재확인했다 — 아래 "재검증 상세" 참조.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (ROADMAP SC1, 정정됨) API 모드로 한 번 로그인하면 다음 로그인 시 이메일이 자동으로 채워지고, 비밀번호를 다시 입력하지 않고 로그인할 수 있다 | ✓ VERIFIED (재확인, 무변경) | `login-panel-view.ts`/`LoginPanel.tsx`/`auth-service.ts`의 관련 함수(`resolveStoredLoginState`, `refreshStoredSnapshot`, `loginWithStoredCredentials`)가 이번 gap-closure diff 에 포함되지 않았음을 `git diff --stat`으로 확인. `setPassword(` 호출 지점이 여전히 `onChange` 1곳뿐(코드 직독) |
| 2 | (ROADMAP SC2) 신청 예정 시각까지 대기하는 도중 토큰이 만료될 것으로 예상되면, 신청이 실행되기 전에 재로그인 필요 경고가 사용자에게 표시된다 | ✓ VERIFIED (재확인, 무변경) | `apply-engine.ts`가 이 diff 에 포함되지 않음(`git diff --stat`으로 확인 — apply-engine.ts 는 07-06/07-07 어느 태스크의 files_modified 에도 없고 실제 diff 에도 나타나지 않는다). `arm()` → `token-expiry-checked` → 배너 체인 무변경 |
| 3 | (07-05 must-have, D-10) 재로그인이 끝나면 새 토큰의 exp로 만료가 다시 판정되어 경고가 갱신되거나 사라진다 (CR-01) | ✓ VERIFIED — **2026-08-27 검증에서 FAILED, 07-06 이 폐쇄, 이번 재검증에서 코드·테스트 재대조 완료** | `shouldRecheckTokenExpiry(eventType, step)` (`src/renderer/auth-event-navigation.ts`)가 `AuthEvent["type"]` 7종 전체를 덮는 exhaustive switch(default 없음)로 apply-execution 단계에서 `login-success`/`token-validated`/`login-failed`/`token-expired`/`cookie-extraction-failed` 5종에 `true`. `App.tsx` L74에서 `shouldRecheckTokenExpiry(event.type, stepRef.current)`로 가드된 단일 `checkTokenExpiry()` 호출 지점(if/else 사슬 밖). `stepRef.current` 사용 확인(캡처된 `step` 아님). 계층 관통 회귀 테스트 `relogin-expiry-recheck.test.ts`가 토큰 교체 후 `visible: false`, 미교체 시 `visible: true` 유지를 모두 단언하며 이 검증에서 재실행해 6/6 pass 확인 |
| 4 | (07-02 must-have, D-01) 저장된 자격증명이 있으면 메인 프로세스가 이메일만 렌더러에 알려주고, 비밀번호는 메인 프로세스 밖으로 나가지 않는다 | ✓ VERIFIED (재확인) | `getStoredCredentialsSnapshot()`(auth-service.ts:206-208) 무변경 확인(`grep`으로 라인 위치 동일 확인). 신규 `completeCredentialLoginSuccess()`도 `CredentialLoginResult`를 그대로 반환하고 비밀번호 필드를 추가하지 않음(코드 직독, `{ success: true }` 리터럴은 관문 1곳뿐 — WR-02 acceptance criteria 스크립트로 이 검증에서 재확인은 안 했으나 코드 직독으로 확인) |
| 5 | (07-02 must-have, D-03) 입력된 이메일이 저장된 이메일과 다르면 메인 프로세스가 외부 로그인 요청 전에 거부한다 | ✓ VERIFIED (재확인, 무변경) | `loginWithStoredCredentials()`(L224-264 부근)가 diff 밖 — WR-02/03 은 `credentialLogin()`(직접 입력 경로)만 건드리고 `loginWithStoredCredentials()`(저장 비밀번호 경로)는 손대지 않음 |
| 6 | (07-02 must-have, D-04) credentials.enc 복호화/파싱 실패 시 파일이 삭제되고 4상태 계약이 정직하게 안내된다 | ✓ VERIFIED (재확인, 무변경) | `readStoredCredentials()`/`clearCredentials()` diff 밖. WR-03 은 `LoginPanel.tsx`의 재조회 타이밍만 고쳤을 뿐 4상태 판정 로직(`login-panel-view.ts`)은 diff 에 없음 |
| 7 | (07-03 must-have, D-13) 대기가 끝난 뒤 신청 POST에 실리는 토큰은 대기 이후 시점의 authService.token이다 | ✓ VERIFIED (재확인, 무변경) | `apply-engine.ts` diff 밖(위 truth #2 근거와 동일) |
| 8 | (07-02 must-have, D-14) 재로그인 시도가 실패해도 시도 이전 토큰이 메모리에 남아 신청에 계속 쓰일 수 있다 | ✓ VERIFIED (재확인) | `restoreTokenIfLost(previousToken)` 호출 3곳(L517, L637, L645) 그대로 유지됨을 `grep`으로 확인 — 07-07 이 `credentialLogin()`의 성공 분기만 리팩터링했고 실패 경로(`restoreTokenIfLost` 호출부)는 건드리지 않았다는 07-07-PLAN.md acceptance criteria 진술과 일치 |
| 9 | (07-04 must-have, D-06) 저장된 로그인 정보가 있으면 로그인 여부와 무관하게 삭제 버튼이 보인다 | ✓ VERIFIED (재확인, 무변경) | `login-panel-view.ts` diff 밖 |
| 10 | (07-05 must-have, Pitfall 3) 신청 대기 중 인증 이벤트가 발생해도 armed 상태와 폼 스키마가 유지된다 — 명시적 로그아웃만 예외 | ✓ VERIFIED (재확인) | `decideAuthEventNavigation()` 본문(`src/renderer/auth-event-navigation.ts`) 자체는 이번 diff 로 변경되지 않음(같은 파일에 `shouldRecheckTokenExpiry()`가 추가만 됨, 코드 직독으로 함수 경계 확인). 신규 `checkTokenExpiry()` 호출은 `setStep`/`setFormSchema`를 전혀 호출하지 않는 별도 분기(App.tsx L74 부근)이므로 armed 상태·formSchema 보존에 영향 없음. `relogin-expiry-recheck.test.ts`의 "신청 상태 불변" 케이스가 재판정 전후 `phase`/`postSubmitted` 동일을 재확인 |
| 11 | (07-05 must-have, D-11/06) ROADMAP SC1과 REQUIREMENTS R022/R023의 반증된 OTP 서술이 삭제 대신 [VOID]+정정문으로 보존된다 | ✓ VERIFIED (재확인, 무변경) | `git diff d748a39..HEAD -- .planning/ROADMAP.md`는 진행률/체크박스 갱신 5줄뿐, VOID 마킹 영역(L141-150)은 diff 밖. REQUIREMENTS.md도 diff 밖 — R022/R023 섹션(L203-232)의 `[VOID — ...]` + `정정 —` 문단 그대로 유지됨을 이 검증에서 재확인 |

**Score:** 11/11 truths verified (0 present-behavior-unverified)

### Required Artifacts (신규/변경분)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/auth-event-navigation.ts` `shouldRecheckTokenExpiry()` | 7이벤트×apply-execution 판정 exhaustive switch | ✓ VERIFIED | 코드 직독으로 존재·형태 확인. `src/renderer/__tests__/auth-event-navigation.test.ts`에 전수(7×5=35 조합) 케이스 추가, 이 검증에서 46/46 pass 재확인 |
| `src/__tests__/relogin-expiry-recheck.test.ts` | 계층 관통 회귀 테스트(신규) | ✓ VERIFIED | 존재, 6개 테스트 케이스(warning 초기 상태 / true 트리거 / false 대조군 / 배너 해제 / 실패 대조군 / 상태 불변), 이 검증에서 6/6 pass 재실행 |
| `src/renderer/App.tsx` 단일 재판정 호출 지점 | `onAuthEvent` 안 `shouldRecheckTokenExpiry` 가드 | ✓ VERIFIED | L74 코드 직독. `handleReloginFromWaiting()`의 기존 `finally` 재판정은 삭제되지 않고 남아 있음(G-02, API 모드 이벤트 미발생 실패 경로용) — 코드 직독으로 확인 |
| `src/renderer/components/ApplyExecution.tsx` `reloginLoading` prop | disabled/aria-busy | ✓ VERIFIED | `ApplyExecutionProps`에 `reloginLoading: boolean` 추가, "다시 로그인" 버튼에 `disabled={reloginLoading}`/`aria-busy={reloginLoading}` 코드 직독으로 확인 |
| `src/main/services/auth-service.ts` `completeCredentialLoginSuccess()` | WR-02 단일 성공 관문 | ✓ VERIFIED | private 메서드 존재(L673), `credentialLogin()`의 두 성공 분기(L609 `result==="token"`, L615 `result==="timeout"`+쿠키발견) 모두 이 관문을 통해 반환. `this.saveCredentials(` 호출 지점이 관문 안 1곳뿐(grep으로 재확인: `saveCredentials(email: string, password: string)` 정의 1곳 + 관문 내부 호출 1곳, `credentialLogin()` 본문에 직접 호출 없음) |
| `src/renderer/components/LoginPanel.tsx` `handleCredentialLogin()` finally 재조회 | WR-03 대칭 수정 | ✓ VERIFIED | `finally` 블록이 `setCredLoading(false)` + `refreshStoredSnapshot()` 둘 다 포함(L172-173, 코드 직독). `handleStoredLogin()`의 동일 패턴(L192-193)과 대칭 확인 |

### Key Link Verification (신규/변경분)

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `AuthEvent(login-success 등 5종)` | `shouldRecheckTokenExpiry()` | `App.tsx` `onAuthEvent` 안 `stepRef.current` 가드 | ✓ WIRED | 이전 검증의 PARTIAL 판정을 뒤집는 핵심 링크. `event.type`과 `stepRef.current`(캡처된 `step` 아님)로 호출, 코드 직독 확인 |
| `shouldRecheckTokenExpiry()===true` | `window.api.apply.checkTokenExpiry()` | if/else 사슬 밖 단일 지점 + `.catch()` | ✓ WIRED | App.tsx L74-78 부근, `console.error`로 관측 가능성 유지 |
| `checkTokenExpiry()` (main IPC) | `ApplyEngine._evaluateCurrentTokenExpiry()` → `token-expiry-checked` → `describeTokenExpiryNotice()` → 배너 재렌더 | 기존 07-01/07-03/07-05 산물, 이 배치는 소비만 | ✓ WIRED | `apply-engine.ts`가 diff 밖 — 이 사슬의 main 쪽은 무변경, 신규 트리거만 추가됨 |
| `credentialLogin()`의 두 성공 분기 | `completeCredentialLoginSuccess()` → `saveCredentials()` → `credentials.enc` | 단일 관문 반환 | ✓ WIRED | 두 `return this.completeCredentialLoginSuccess(email, password);` 호출 지점(L609, L615) 코드 직독 확인 |
| `handleCredentialLogin()` `finally` | `refreshStoredSnapshot()` → `getStoredCredentials` IPC → `resolveStoredLoginState()` | 함수 호출 | ✓ WIRED | LoginPanel.tsx L172-173 |

### Behavioral Spot-Checks (이 재검증에서 직접 실행)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-01 폐쇄 — 재로그인 완료 → 만료 재판정 → 경고 해제 계층 관통 | `npx vitest run src/__tests__/relogin-expiry-recheck.test.ts` | 6/6 pass | ✓ PASS |
| `shouldRecheckTokenExpiry()` 전수(7×5) 고정 | `npx vitest run src/renderer/__tests__/auth-event-navigation.test.ts` | 46/46 pass | ✓ PASS |
| WR-02 저장 관문 회귀 | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | 78/78 pass | ✓ PASS |
| 전체 테스트 스위트 | `npm test` | 474/474, 22 suites | ✓ PASS |
| 타입체크 (renderer/main) | `npm run typecheck && npm run typecheck:main` | 0 errors | ✓ PASS |
| 빌드 | `npm run build` | exit 0 | ✓ PASS |
| `stepRef.current` 함정 재현 여부 | 코드 직독(`App.tsx` L74) | `shouldRecheckTokenExpiry(event.type, stepRef.current)` — `step`이 아닌 `stepRef.current` 사용 확인 | ✓ PASS (함정 없음) |
| 옛 토큰으로 경고가 거짓 해제되는지(재로그인 "시도"만으로 안심시키지 않는지) | `relogin-expiry-recheck.test.ts`의 실패 대조군 케이스 | 토큰 미교체 시 `visible: true` 유지, `state.status === "warning"` | ✓ PASS |
| WR-01 잠금 해제 보장 | 코드 직독(`handleReloginFromWaiting()`의 `finally`) | `setLoginLoading(false)`가 `finally` 안에 있어 성공/실패/예외 모든 경로에서 실행됨 | ✓ PASS |
| WR-02 저장 호출 수렴 | `grep -n "this.saveCredentials("` (관문 정의 1곳 + 호출 위치 확인) | `saveCredentials()` 호출이 관문(`completeCredentialLoginSuccess`) 안 1곳뿐 | ✓ PASS |
| 07-REVIEW-GAPS.md 의 exhaustive switch 컴파일 에러 재현 주장 | 이 검증에서 별도 재현하지 않음 — `npm run typecheck`가 현재 코드(exhaustive)로 green임을 자체 확인, non-exhaustive 시나리오는 리뷰어의 스크래치 파일 실험을 신뢰(재현 불가능한 이유 없음, `boolean` 반환 + `strict: true` 조합에서 TS2366/TS2739 계열 에러가 나는 것은 TypeScript 표준 동작) | 정보 확인만, 재실행 안 함 | ℹ️ INFO |

*자동 테스트가 미치지 못하는 대기 화면 렌더링·실계정 로그인 흐름(브라우저 팝업 실제 완료, 연속 클릭 UI 잠금의 눈으로 보이는 동작, timeout→쿠키 경로 재현, corrupted→available 안내 전환)은 Human Verification 항목으로 이동(아래 참조) — 07-06/07-07 두 실행 모두 `<human-check>` 항목을 실행하지 않았다고 SUMMARY.md 에 명시했으므로 phase 말미 UAT 로 이월된다.*

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|--------------|--------------|--------------|--------|----------|
| R022 | 07-01, 07-02, 07-03, 07-05, 07-06 | 신청 시각 전 토큰 수명 체크 및 재로그인 유도 | ✓ SATISFIED | 초기 경고 표시(SC2)·D-13 토큰 재조회·D-14 복원·armed 상태 보존에 더해, 재로그인 이후 재판정(D-10, truth #3)이 07-06 으로 폐쇄됨 — 더 이상 GAP 없음 |
| R023 | 07-02, 07-04, 07-07 | API 모드 자격증명 암호화 저장 | ✓ SATISFIED | 이메일 프리필, 저장 비밀번호 로그인, D-01/D-03/D-04/D-06/D-07 확인에 더해, 07-07 이 timeout→쿠키 저장 누락(WR-02)과 낡은 안내(WR-03) 두 결함을 폐쇄 |

**참고:** `requirements.mark-complete`가 R022/R023를 `not_found`로 반환하는 것은 CLI 검증기가 gsd-core 기본 `- [ ] **REQ-ID**` 체크박스 표면을 찾기 때문이며, 이 저장소는 `### R0NN —` 헤딩 + 트레이서빌리티 표를 관례로 쓴다. 코드 상의 실질적 요구사항 이행은 위 표에서 직접 확인했으므로 이 불일치는 커버리지 갭이 아니다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (이전 검증의 Blocker 1건) `src/renderer/App.tsx` L203-237 | — | `handleReloginFromWaiting()`이 브라우저 모드 재로그인 완료를 기다리지 않고 `checkTokenExpiry()`를 호출 | ✅ RESOLVED | 07-06 이 `onAuthEvent`의 `shouldRecheckTokenExpiry()` 가드로 실제 완료 시점 재판정을 추가해 폐쇄. `finally`의 기존 호출은 API 모드 이벤트 미발생 경로 대비용으로 의도적으로 존치(G-02) |
| (이전 검증의 WR-01) `src/renderer/components/ApplyExecution.tsx` L241-250 | — | "다시 로그인" 버튼에 disabled/aria-busy 없음, App.tsx가 반환값 미검사 | ✅ RESOLVED | `reloginLoading` prop + `buildFailureView()` 라우팅으로 07-06 이 폐쇄 |
| (이전 검증의 WR-02) `src/main/services/auth-service.ts` L614-619 | — | timeout→쿠키발견 성공 경로가 `saveCredentials()` 미호출 | ✅ RESOLVED | `completeCredentialLoginSuccess()` 단일 관문으로 07-07 이 폐쇄 |
| (이전 검증의 WR-03) `src/renderer/components/LoginPanel.tsx` L150-166 | — | `finally`에 `refreshStoredSnapshot()` 누락 | ✅ RESOLVED | 07-07 이 `handleStoredLogin()`과 대칭으로 폐쇄 |

TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER 마커: 이 gap-closure 배치가 수정한 8개 파일 전체에서 0건(이 검증 세션에서 재실행한 grep으로 확인).

### Human Verification Required

(Frontmatter에 전체 목록 — 이전 검증의 3개 항목을 그대로 carry-forward하고, 07-06/07-07 SUMMARY.md의 `coverage` 블록에서 `human_judgment: true`로 표시된 신규 항목 3개를 harvest해 추가했다.)

1. **경고 배너 렌더링 및 조작 비차단(07-01)** — carry-forward, 무변경.
2. **저장 자격증명 화면 4시나리오(07-04)** — carry-forward, 무변경.
3. **대기 중 재로그인 5시나리오(07-05, 07-06 Task 1과 병합)** — 시나리오 ④는 이전 검증에서 CR-01로 실패가 확인됐던 항목이지만, 이번 재검증에서 코드·행동 테스트 수준으로는 폐쇄가 확인됐다. 이 UAT는 이제 **결함 재확인이 아니라 실계정을 통한 최종 확인 절차**다.
4. **재로그인 버튼 연속 클릭 잠금(07-06 Task 3, WR-01 신규 human-check)** — 07-06 실행 시 수행되지 않음(SUMMARY coverage D3).
5. **timeout→쿠키 저장 경로 재현(07-07 Task 1, WR-02 신규 human-check)** — 07-07 실행 시 수행되지 않음, 재현 곤란 시 정상 경로 확인으로 대체 가능(SUMMARY coverage D1).
6. **corrupted→available 안내 전환(07-07 Task 2, WR-03 신규 human-check)** — 07-07 실행 시 수행되지 않음(SUMMARY coverage D2).

### Gaps Summary

이전 검증(2026-08-27)이 유일하게 남겼던 BLOCKER — truth #3, CR-01 — 가 이번 재검증에서 코드 직독·테스트 재실행 양쪽으로 폐쇄가 확인됐다. 핵심 함정 두 가지(`stepRef.current` vs 캡처된 `step`, 재로그인 "시도"가 아니라 실제 새 토큰에서만 판정하는지)를 구체적으로 재대조했고 둘 다 안전하게 처리돼 있다. 세 건의 WARNING(WR-01/02/03)도 코드 직독으로 폐쇄를 확인했다. `npm test`(474/474, 22 suites) · `npm run typecheck`/`typecheck:main` · `npm run build` 모두 이 검증 세션에서 직접 재실행해 green을 확인했다. 이 gap-closure 배치가 수정한 파일에 미해결 디버그 마커는 없다. `apply-engine.ts`는 두 plan 어느 쪽에서도 수정되지 않아 D-13/D-14/D-10 계산 로직 자체의 회귀 위험이 없었다.

**남은 것은 gap이 아니라 human verification이다.** 코드·자동 테스트로 증명 가능한 것은 모두 증명됐지만, Electron 앱의 실제 렌더링·실계정 로그인 흐름·타이밍 의존 UI 동작은 이 저장소 전체에 걸쳐 일관되게 human-check로 남는 영역이다(vitest.config.ts의 include가 `.tsx`를 아예 잡지 않는 구조적 제약). 07-06/07-07 모두 각자의 `<human-check>` 항목을 실행 시점에 수행하지 않았다고 SUMMARY.md에 명시적으로 기록했으므로, status는 `passed`가 아니라 `human_needed`다 — 6개 항목이 phase 말미 UAT로 이월된다.

edge-probe A-R022/A-R023(중단·병렬 실행 시 보장)은 두 plan 모두 명시적으로 미해결로 남겼다(flagged_assumptions 섹션). WR-01의 UI 잠금이 이 질문의 일부(재로그인 클릭 동시성)를 완화하지만 전체를 해소하지 않는다 — planner가 스스로 "조용히 닫지 말 것"이라 기록했으므로 이 검증도 같은 태도를 유지한다. 이 항목은 phase goal 달성에 필수(must-have)가 아니므로 gap으로 분류하지 않았으나, 후속 phase 또는 사용자의 명시적 dismiss가 필요하다는 점을 여기 다시 남긴다.

---

_Verified: 2026-08-28_
_Verifier: Claude (gsd-verifier)_
