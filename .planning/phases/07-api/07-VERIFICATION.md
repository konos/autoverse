---
phase: 07-api
verified: 2026-08-27T00:00:00Z
status: gaps_found
score: 10/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "재로그인이 끝나면 새 토큰의 exp 로 만료가 다시 판정되어 경고가 갱신되거나 사라진다 (D-10, 07-05 must-have; R022)"
    status: failed
    reason: >
      브라우저 모드(기본 로그인 모드, DEFAULT_LOGIN_MODE = "browser")에서 AuthService.login()이
      팝업 창의 초기 loadURL()만 await 하고 반환한다 — 실제 로그인 완료(500ms 폴링 또는
      did-navigate 리스너로 we2_access_token 쿠키를 추출하는 시점)를 기다리는 Promise 가 없다.
      App.tsx 의 handleReloginFromWaiting()은 openLogin() 이 반환하는 즉시(=팝업 최초 로드 직후,
      사용자가 아직 로그인하지 않은 시점) finally 블록에서 checkTokenExpiry()를 호출해 옛 토큰
      기준으로 무의미한 재확인을 한다. 이후 사용자가 실제로 로그인을 완료해 login-success 이벤트가
      도착해도, onAuthEvent 핸들러의 login-success 분기(App.tsx:66-73)는 setAuthStatus/setStep 만
      호출할 뿐 checkTokenExpiry()를 재호출하지 않는다. 결과적으로 대기 화면 경고 배너는 사용자가
      실제로 재로그인에 성공한 뒤에도 갱신되지 않고 남는다. DEFAULT_LOGIN_MODE가 "browser"이므로
      API 모드로 전환하지 않은 모든 기본 사용자가 이 결함 경로를 밟는다(07-REVIEW.md CR-01, 코드
      직접 대조로 재확인함). API 모드(credentialLoginStored)는 헤드리스 로그인 전체가 끝날 때까지
      await 하므로 정상 동작한다 — 결함은 브라우저 모드에서만 발생하는 비대칭이다.
    artifacts:
      - path: "src/renderer/App.tsx"
        issue: "handleReloginFromWaiting()의 finally 블록(L229-237)이 실제 로그인 완료 이전에 checkTokenExpiry()를 호출하고, onAuthEvent의 login-success 분기(L66-73)는 apply-execution 단계에서도 checkTokenExpiry()를 재호출하지 않는다"
      - path: "src/main/services/auth-service.ts"
        issue: "login()(L967-1085)이 win.loadURL()의 초기 페이지 로드만 await하고 반환한다 — 팝업이 닫히거나 토큰이 추출될 때까지 기다리는 Promise 계약이 없다"
    missing:
      - "login()이 팝업이 닫히거나(win.on('closed')) 토큰이 추출될 때까지 resolve하지 않는 Promise를 반환하도록 하거나, App.tsx의 onAuthEvent가 apply-execution 단계에서 login-success/token-validated/login-failed/cookie-extraction-failed 수신 시 checkTokenExpiry()를 재호출하도록 배선한다"
      - "브라우저 모드에서 재로그인 완료 후 실제로 경고가 갱신·해제되는지 검증하는 회귀 테스트(App.tsx 수준 또는 위 방향을 택했다면 auth-service.test.ts의 login() 완료 시점 계약 테스트)"
human_verification:
  - test: "만료 임박(또는 exp를 읽을 수 없는) 토큰 상태로 arm해 대기 화면에 진입한다"
    expected: "대기 화면 카운트다운 아래에 role=\"alert\" 경고와 '다시 로그인' 버튼이 보이고, 경고가 떠 있는 동안에도 신청 실행 버튼이 계속 눌린다"
    why_human: ".tsx 렌더러 컴포넌트는 vitest.config.ts의 include(.test.ts만 포함)에 잡히지 않아 실제 렌더링은 자동 테스트 대상이 아니다(07-01 PLAN human-check, 저장소 전체의 기존 패턴)"
  - test: "API 모드로 로그인 → 앱 종료 후 재시작 → 로그인 폼 확인. 이메일 칸이 저장된 주소로 채워져 있고 비밀번호 칸은 비어 있는지, '저장된 비밀번호로 로그인'으로 재입력 없이 로그인되는지, 이메일을 다른 주소로 바꾸면 버튼이 비활성화되고 '다른 계정입니다' 안내가 뜨는지, 로그아웃 상태에서도 상태문과 삭제 버튼이 보이고 삭제하면 함께 사라지는지 확인한다"
    expected: "네 가지 시나리오(프리필/저장 비밀번호 로그인/이메일 불일치 차단/삭제) 모두 문서대로 동작한다"
    why_human: "LoginPanel.tsx JSX 렌더링 — 순수 함수 resolveStoredLoginState()는 자동 테스트로 커버되지만 실제 화면 반영은 수동 확인 대상이다(07-04 PLAN human-check)"
  - test: "대기 화면에서 '다시 로그인'을 눌러 ① API 모드에서 비밀번호 재입력 없이, ② 브라우저 모드에서 로그인 창으로 재로그인이 시작되는지, ③ 재로그인 성공·실패 어느 쪽이든 대기 화면과 카운트다운이 유지되고 처음 화면으로 돌아가지 않는지, ④ 재로그인이 성공하면 경고가 사라지거나 갱신되는지, ⑤ 저장된 자격증명이 없는 API 모드에서 '다시 로그인'을 누르면 이유가 화면에 표시되는지 확인한다"
    expected: "다섯 시나리오 모두 문서대로 동작한다"
    why_human: "대기 화면 인증 이벤트 흐름은 실계정·타이밍 의존적이라 자동화 대상 밖이다(07-05 PLAN human-check). 단, 시나리오 ④(브라우저 모드 재로그인 후 경고 갱신)는 이미 CR-01로 코드 검토·정적 분석 양쪽에서 실패가 확인된 상태이므로, 이 UAT는 그 결함을 재확인하는 절차가 될 가능성이 높다 — 아래 Gaps 항목 참조"
---

# Phase 07: API 자격 증명 저장 + 토큰 만료 사전 경고 Verification Report

**Phase Goal:** API 모드 사용자가 매 로그인마다 자격증명을 재입력하지 않아도 되고, 신청 대기 중 토큰이 만료되기 전에 재로그인할 시간을 사전에 확보한다.
**Verified:** 2026-08-27
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (ROADMAP SC1, 정정됨) API 모드로 한 번 로그인하면 다음 로그인 시 이메일이 자동으로 채워지고, 비밀번호를 다시 입력하지 않고 로그인할 수 있다. 비밀번호 칸 자체는 프리필되지 않는다(D-01 의도적 편차) | ✓ VERIFIED | `login-panel-view.ts:resolveStoredLoginState()` — `available` 상태에서 `showStoredLoginButton: true`; `LoginPanel.tsx`가 `refreshStoredSnapshot()`에서 `email` state만 채우고(L82-90) `password` state는 어디서도 저장값으로 설정되지 않음; `loginWithStoredCredentials(inputEmail)`이 이메일 하나만 인자로 받고 `CredentialLoginResult`에 비밀번호 필드가 없음(auth-service.ts:224-267). 26개 `resolveStoredLoginState` 테스트 케이스로 4상태×이메일 일치/불일치/공백 커버 |
| 2 | (ROADMAP SC2) 신청 예정 시각까지 대기하는 도중 토큰이 만료될 것으로 예상되면, 신청이 실행되기 전에 재로그인 필요 경고가 사용자에게 표시된다 | ✓ VERIFIED | `apply-engine.ts` `arm()`이 `evaluateTokenExpiry()`를 호출해 `token-expiry-checked` 이벤트를 즉시 발행(L417-431); `ApplyExecution.tsx:219-245`가 `describeTokenExpiryNotice()`로 `role="alert"` 배너 + "다시 로그인" 버튼을 렌더링; `apply-engine.test.ts` D-10 스위트 (a)-(d) 4케이스로 warning/safe/unknown/이벤트 순서 회귀 고정 |
| 3 | (07-05 must-have, D-10) 재로그인이 끝나면 새 토큰의 exp로 만료가 다시 판정되어 경고가 갱신되거나 사라진다 | ✗ FAILED | 브라우저 모드(기본값)에서 실패 — 아래 Gaps 참조. `checkTokenExpiry()` 자체(main 계산 로직)는 정상이며 회귀 테스트도 존재(apply-engine.test.ts L314-352)하지만, App.tsx의 호출 타이밍이 잘못돼 실제 재로그인 완료 시점에 도달하지 못한다(CR-01) |
| 4 | (07-02 must-have, D-01) 저장된 자격증명이 있으면 메인 프로세스가 이메일만 렌더러에 알려주고, 비밀번호는 메인 프로세스 밖으로 나가지 않는다 | ✓ VERIFIED | `getStoredCredentialsSnapshot()`이 `StoredCredentialsSnapshot`(email만 포함) 반환(auth-service.ts:206-208); `readStoredCredentials()`의 private 반환값 중 `password`는 `loginWithStoredCredentials()` 내부에서만 소비되고 리턴되지 않음; `IpcApi.auth.credentialLoginStored(email)` 타입 시그니처 자체가 비밀번호를 받지 않음(preload.ts:29) |
| 5 | (07-02 must-have, D-03) 입력된 이메일이 저장된 이메일과 다르면 메인 프로세스가 외부 로그인 요청 전에 거부한다 | ✓ VERIFIED | `loginWithStoredCredentials()`의 정규화 비교(L256-264)가 `credentialLogin()` 호출 전에 실패를 반환; 회귀 테스트 auth-service.test.ts:878-936 "D-01/D-03 게이트" 스위트 |
| 6 | (07-02 must-have, D-04) credentials.enc 복호화/파싱 실패 시 파일이 삭제되고 4상태 계약이 정직하게 안내된다 | ✓ VERIFIED | `readStoredCredentials()`의 모든 실패 분기(파일 읽기/복호화/JSON 파싱/필드 타입, L144-192)가 `clearCredentials()` 호출 후 `corrupted`만 반환; `login-panel-view.ts` corrupted/unavailable 각각 다른 안내 문구; 테스트 auth-service.test.ts:799-877 D-04 4상태 스위트 |
| 7 | (07-03 must-have, D-13) 대기가 끝난 뒤 신청 POST에 실리는 토큰은 대기 이후 시점의 authService.token이다 | ✓ VERIFIED | `apply-engine.ts:233` `const freshToken = authService.token;`이 `waitUntilSubmitTime()` 반환 직후, POST 구성 이전에 위치; 없으면 UNAUTHORIZED로 명확히 실패(L234-238); 회귀 테스트 "execute() D-13 대기 이후 토큰 재조회"(apply-engine.test.ts:414~) |
| 8 | (07-02 must-have, D-14) 재로그인 시도가 실패해도 시도 이전 토큰이 메모리에 남아 신청에 계속 쓰일 수 있다 | ✓ VERIFIED | `restoreTokenIfLost(previousToken)`이 `cachedToken === null && previousToken !== null`일 때만 복원(auth-service.ts:759-765), 실패 경로 2곳(L517, L640, L648)에서 호출; 3케이스 회귀 테스트(auth-service.test.ts:749-798) |
| 9 | (07-04 must-have, D-06) 저장된 로그인 정보가 있으면 로그인 여부와 무관하게 삭제 버튼이 보인다 | ✓ VERIFIED | `resolveStoredLoginState()`가 `available`/`unavailable` 모두 `showClearButton: true` 반환(login-panel-view.ts:196, 224) — 로그인 상태를 인자로 받지 않으므로 로그인 여부와 무관하게 노출됨; LoginPanel.tsx가 로그인 상태 블록과 별개로 이 값을 그대로 렌더링(L295 부근) |
| 10 | (07-05 must-have, Pitfall 3) 신청 대기 중 인증 이벤트가 발생해도 armed 상태와 폼 스키마가 유지된다 — 명시적 로그아웃만 예외 | ✓ VERIFIED | `decideAuthEventNavigation()`이 apply-execution 단계에서 `logged-out`만 `to-login-and-clear-schema`로 판정, 나머지 6개 이벤트 전부 `stay`(auth-event-navigation.test.ts "전수 확인" 케이스); App.tsx의 `onAuthEvent`가 이 반환값의 `action`에 따라서만 `setStep`/`setFormSchema` 호출 |
| 11 | (07-05 must-have, D-11/06) ROADMAP SC1과 REQUIREMENTS R022/R023의 반증된 OTP 서술이 삭제 대신 [VOID]+정정문으로 보존된다 | ✓ VERIFIED | ROADMAP.md L141-150, REQUIREMENTS.md L203-219에서 원문이 `**[VOID — ...]**`로 마킹된 채 남아 있고 바로 뒤에 `**정정된 기준/정정 —**` 문단이 병기됨. 정정문이 D-01의 의도적 편차(비밀번호 미프리필)를 명시 |

**Score:** 10/11 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/token-expiry.ts` | parseJwtExpMs / evaluateTokenExpiry / RELOGIN_HEADROOM_MS | ✓ VERIFIED | 81줄, 3개 export 모두 존재, token-expiry.test.ts 15케이스 |
| `src/renderer/components/apply-execution-view.ts` | describeTokenExpiryNotice | ✓ VERIFIED | 존재·wired (ApplyExecution.tsx import·호출) |
| `src/shared/mask.ts` | maskEmail / SENSITIVE_PATTERNS email 규칙 | ✓ VERIFIED | 존재, mask.test.ts에서 8케이스 |
| `src/main/services/auth-service.ts` | getStoredCredentialsSnapshot / loginWithStoredCredentials | ✓ VERIFIED | 존재, wired via IPC |
| IPC 4채널 (get-stored-credentials/credential-login-stored/clear-credentials/check-token-expiry) | handler+preload+타입+removeHandler 4곳 대칭 | ✓ VERIFIED | ipc-handlers.ts/preload.ts 양쪽 확인, removeHandler 4개 모두 존재(L188-200) |
| `src/renderer/components/login-panel-view.ts` | resolveStoredLoginState() | ✓ VERIFIED | 존재, 26개 테스트 케이스, LoginPanel.tsx에서 wired |
| `src/renderer/auth-event-navigation.ts` | decideAuthEventNavigation() | ✓ VERIFIED | 존재, App.tsx에서 wired, 전수 테스트 |
| `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md` VOID 정정 | Phase 07 SC1, R022/R023 Why it matters | ✓ VERIFIED | 확인됨 (위 truth #11) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `apply-engine.arm()` | `evaluateTokenExpiry()` → `apply:event(token-expiry-checked)` → `ApplyExecution` 배너 | 직접 호출 체인 | ✓ WIRED | apply-engine.ts:417-431 → App.tsx 이벤트 구독 → ApplyExecution.tsx:219 |
| `ApplyExecution` `onRelogin` prop | `App.tsx` `handleReloginFromWaiting` | prop 전달 | ✓ WIRED | ApplyExecution.tsx:245 `onClick={onRelogin}` ← App.tsx:280 `onRelogin={handleReloginFromWaiting}` |
| `waitUntilSubmitTime()` 반환 | `authService.token` 재조회 → `submitApplication()` | 직접 코드 순서 | ✓ WIRED | apply-engine.ts:221-233 |
| `preload.credentialLoginStored(email)` | `ipc-handlers` 런타임 가드 → `auth-service` 이메일 게이트 | IPC 체인 | ✓ WIRED | preload.ts:29 → ipc-handlers.ts:82 → auth-service.ts:224-264 |
| `getStoredCredentialsSnapshot()` 4상태 | 렌더러 안내 문구 4종 | `resolveStoredLoginState()` | ✓ WIRED | login-panel-view.ts:175-228 |
| `checkTokenExpiry()` | `token-expiry-checked` 재발행 → 대기 화면 배너 갱신 | 단일 호출 지점 | ⚠️ **PARTIAL — 브라우저 모드에서 호출 타이밍이 잘못됨** | App.tsx:233 단 한 곳에서만 호출되며, 이 호출이 실제 로그인 완료 이전에 발생(브라우저 모드). `login-success` 이벤트 수신 시점에는 재호출되지 않음(App.tsx:66-73). API 모드는 `credentialLoginStored`가 완료를 await하므로 정상 |
| `decideAuthEventNavigation()` | `setStep`/`setFormSchema` 호출 여부 | 반환값 분기 | ✓ WIRED | App.tsx:62-100 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| D-10 checkTokenExpiry() 재판정 로직 자체 | `npx vitest run src/main/services/__tests__/apply-engine.test.ts -t "checkTokenExpiry"` | 3/3 pass | ✓ PASS |
| D-13 대기 이후 토큰 재조회 | `npx vitest run src/main/services/__tests__/apply-engine.test.ts -t "D-13"` | pass | ✓ PASS |
| D-14 토큰 복원 | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "D-14"` | 3/3 pass | ✓ PASS |
| apply-execution 단계 인증 이벤트 전수 판정 | `npx vitest run src/renderer/__tests__/auth-event-navigation.test.ts` | pass | ✓ PASS |
| 전체 테스트 스위트 | `npm test` | 455/455, 21 suites | ✓ PASS |
| 타입체크 (renderer/main) | `npm run typecheck && npm run typecheck:main` | 0 errors | ✓ PASS |
| 빌드 | `npm run build` | exit 0 | ✓ PASS |
| CR-01 재현: 브라우저 모드 `login()`이 실제 로그인 완료 전에 resolve하는지 | 코드 직독(`auth-service.ts:967-1085`) — 마지막 문장이 `await win.loadURL(...)`이고 토큰 추출은 이후 비동기 콜백(폴링/did-navigate)에서만 일어남 | 확인됨 — resolve 시점과 실제 로그인 완료 시점이 분리됨 | ✗ FAIL (재현됨, 07-REVIEW.md CR-01과 일치) |

*자동 테스트가 미치지 못하는 대기 화면 렌더링·실계정 로그인 흐름은 Human Verification 항목으로 이동(아래 참조).*

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|--------------|--------------|--------------|--------|----------|
| R022 | 07-01, 07-02, 07-03, 07-05 | 신청 시각 전 토큰 수명 체크 및 재로그인 유도 | ⚠️ SATISFIED WITH GAP | 초기 경고 표시(SC2)·D-13 토큰 재조회·D-14 복원·armed 상태 보존은 전부 확인됨. 다만 재로그인 이후 재판정(D-10 UI 반영)이 기본 로그인 모드(브라우저)에서 동작하지 않음 — 위 gaps 참조 |
| R023 | 07-02, 07-04 | API 모드 자격증명 암호화 저장 | ✓ SATISFIED | 이메일 프리필, 저장 비밀번호 로그인, D-01/D-03/D-04/D-06/D-07 전부 코드·테스트로 확인 |

**참고:** `requirements.mark-complete`가 R022/R023를 `not_found`로 반환한 것은 CLI 검증기가 gsd-core 기본 `- [ ] **REQ-ID**` 체크박스 표면을 찾기 때문이며, 이 저장소는 `### R0NN —` 헤딩 + `ID`헤딩 트레이서빌리티 표를 관례로 쓴다(Phase 06의 R016/R020/R021도 동일 패턴). 코드 상의 실질적 요구사항 이행은 위 표에서 직접 확인했으므로 이 불일치는 커버리지 갭이 아니다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/App.tsx` | 203-237 | `handleReloginFromWaiting()`이 브라우저 모드 재로그인 완료를 기다리지 않고 `checkTokenExpiry()`를 호출 | 🛑 Blocker | 위 Gaps 항목(truth #3) — R022의 재판정 보증이 기본 로그인 모드에서 무력화됨 |
| `src/renderer/components/ApplyExecution.tsx` | 241-250 | "다시 로그인" 버튼에 `disabled`/`aria-busy` 없음, `App.tsx`가 `credentialLoginStored()`의 반환값을 검사하지 않음(WR-01) | ⚠️ Warning | 연속 클릭 시 T-07-09 in-flight 가드가 두 번째 시도를 조용히 실패시키지만 사용자에게 그 사실이 전달되지 않음 |
| `src/main/services/auth-service.ts` | 614-619 | `credentialLogin()`의 timeout→쿠키발견 성공 경로가 `saveCredentials()`를 호출하지 않음(WR-02) | ⚠️ Warning | 이 특정 경로(25초 타임아웃 후 쿠키에서 뒤늦게 토큰 발견)로 로그인에 성공하면 R023의 "다음부터 재입력 생략" 약속이 조용히 성립하지 않음 — 다만 정상 경로(폴링이 직접 토큰 반환)는 영향 없음 |
| `src/renderer/components/LoginPanel.tsx` | 150-166 | `handleCredentialLogin()`의 `finally`에 `refreshStoredSnapshot()` 누락(WR-03; `handleStoredLogin()`은 존재) | ⚠️ Warning | `corrupted` 안내가 뜬 상태에서 사용자가 지시대로 재입력해 로그인에 성공해도 안내 문구가 갱신 없이 남아 D-04 4상태 표시가 낡은 채 유지됨 |

TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER 마커: 이 phase가 수정한 13개 파일 전체에서 0건.

### Human Verification Required

(Harvested from `<verify><human-check>` blocks in 07-01/07-04/07-05 PLAN.md — `workflow.human_verify_mode = end-of-phase`; frontmatter has full detail.)

1. **경고 배너 렌더링 및 조작 비차단(07-01)** — 만료 임박 토큰으로 arm → 대기 화면 진입 → 경고·재로그인 버튼 노출 확인, 경고 중에도 신청 실행 버튼 동작 확인. `.tsx` 렌더링은 vitest 대상 밖.
2. **저장 자격증명 화면 4시나리오(07-04)** — 프리필/저장 비밀번호 로그인/이메일 불일치 차단/삭제. LoginPanel.tsx JSX 렌더링은 vitest 대상 밖.
3. **대기 중 재로그인 5시나리오(07-05)** — 특히 시나리오 ④("재로그인이 성공하면 경고가 사라지거나 갱신된다")는 CR-01로 이미 실패가 정적 분석으로 확인된 상태이므로, 이 UAT 항목은 사람이 실계정으로 재현해 결함을 재확인하는 절차가 될 가능성이 높다. 나머지(①②③⑤)는 이 verification에서 코드상 정상 배선을 확인했다.

### Gaps Summary

이 phase는 R023(저장 자격증명)의 신뢰 경계와 핵심 안전장치(D-01/D-03/D-04/D-13/D-14, Pitfall 3 armed 상태 보존)를 코드와 테스트 양쪽에서 견고하게 구현했다. `npm test`(455/455) · `npm run typecheck`/`typecheck:main` · `npm run build` 모두 깨끗하고, 이 phase가 손댄 파일 전체에 미해결 디버그 마커가 없다.

다만 **R022의 두 번째 축 — "재로그인이 실제로 경고를 해소한다"는 보증(D-10 재판정)이 기본 로그인 모드(브라우저)에서 실제로 이행되지 않는다**(07-REVIEW.md CR-01, 코드 직접 대조로 재확인함). `AuthService.login()`이 팝업의 초기 로드만 기다리고 반환하기 때문에, 대기 화면의 "다시 로그인" 이후 호출되는 `checkTokenExpiry()`는 사용자가 실제로 로그인을 마치기 전에 실행되고, 실제 로그인 완료 이벤트(`login-success`)가 나중에 도착해도 재호출되지 않는다. ROADMAP SC2의 문자 그대로("신청 실행 전에 경고가 표시된다")는 초기 경고 발행만으로 충족되어 VERIFIED이지만, 07-05-PLAN.md가 명시적으로 선언한 must-have 진실("재로그인이 끝나면... 경고가 갱신되거나 사라진다")은 기본 경로에서 거짓이다. D-13(대기 이후 토큰 재조회)이 신청 POST 자체의 정합성은 지켜주므로 **신청 결과의 안전성 자체는 훼손되지 않지만**, 경고 UI가 사용자에게 잘못된 신호를 계속 보내 "재로그인해도 소용없다"는 인상을 주거나 불필요한 재시도를 유발할 수 있다 — 이 phase 전체를 관통하는 "UI가 거짓말하지 않는다" 원칙의 정면 위반이다.

추가로 세 건의 Warning(WR-01/02/03)이 남아 있다 — 재로그인 버튼의 로딩 잠금 부재, 특정 로그인 성공 경로에서의 저장 누락, 저장 상태문 갱신 누락. 모두 신뢰 경계 자체를 깨지는 않지만 향후 정리가 필요하다.

**권장 조치:** CR-01 수정(App.tsx의 `onAuthEvent`가 apply-execution 단계에서 인증 결과 이벤트 수신 시 `checkTokenExpiry()`를 재호출하도록 배선하는 것이 가장 국소적인 수정) 후 재검증. WR-01/02/03은 phase를 막지 않지만 같은 배치의 후속 plan에서 닫는 것을 권장한다.

---

_Verified: 2026-08-27_
_Verifier: Claude (gsd-verifier)_
