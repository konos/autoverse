---
phase: 06-ui
verified: 2026-08-26T06:15:20Z
status: gaps_found
score: 5/7 truths verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "사용자가 API 모드를 처음 선택하면 두 가지 고지를 확인해야만 진행할 수 있다 — 확인 저장이 실패하면 모달이 닫히지 않고 모드도 바뀌지 않는다 (ROADMAP SC2 정정본, 06-06-PLAN must_haves)"
    status: partial
    reason: >
      정상 경로(쓰기 성공)에서는 "확인해야만 진행" 계약이 그대로 성립한다. 그러나
      settings:set-login-mode IPC 쓰기가 실패하는 경로에서는 계약이 깨진다.
      LoginPanel.tsx의 handleAcknowledge()는 onSetLoginMode()가 실패 시 예외를
      던질 것을 전제로 try/catch를 구성했지만, App.tsx의 handleSetLoginMode()는
      자신의 실패를 catch해 loginError 배너에만 표시하고 절대 다시 던지지 않는다
      (App.tsx:130-139). 그 결과 디스크 쓰기 오류로 settings:set-login-mode가
      실제로 실패해도 handleAcknowledge()의 await onSetLoginMode("api")는 정상
      resolve되어 setNoticeOpen(false)가 실행되고, 모달은 "확인 완료"로 닫힌다.
      loginMode 상태는 실제로 바뀌지 않았지만 apiModeNoticeAckedVersion은 이미
      영속되어, 다음에 API 탭을 다시 눌러도 고지 모달이 재노출되지 않는다.
    artifacts:
      - path: "src/renderer/App.tsx"
        issue: "handleSetLoginMode(130-139행)가 실패를 삼키고 절대 reject하지 않는다 — 탭 클릭 경로(fire-and-forget)에는 맞지만, 모달 확인 경로가 요구하는 '실패 시 reject' 계약과 충돌한다."
      - path: "src/renderer/components/LoginPanel.tsx"
        issue: "handleAcknowledge(95-107행)가 onSetLoginMode 실패 시 reject를 전제로 catch를 구성했지만, 실제로 주입되는 함수는 절대 reject하지 않는다."
    missing:
      - "모달 전용 strict 버전(예: setLoginModeOrThrow)을 추가해 handleAcknowledge에서만 사용하고, 기존 fire-and-forget용 handleSetLoginMode는 탭 클릭 경로에 그대로 남긴다."
      - "App.tsx/LoginPanel.tsx에 대한 렌더러 컴포넌트 테스트가 전혀 없어(순수 함수 login-panel-view.ts만 테스트됨) 이 결함이 자동화로 잡히지 않는다 — 최소한 회귀 방지용 커버리지가 필요하다."
  - truth: "렌더러로 돌아가는 실패 문구와 식별자는 마스킹을 통과한 값뿐이다 — 토큰·비밀번호·URL 쿼리스트링이 화면에 노출되지 않는다 (06-05-PLAN must_haves, R010)"
    status: partial
    reason: >
      credentialLogin()의 실패 경로(buildFailureResult() 경유)는 maskSensitive()를
      명시적으로 통과하며 올바르게 마스킹된다 — SC3가 요구하는 6가지 실패 신호
      매핑은 정확하다. 그러나 두 모드가 공유하는 validateToken()의 네 개 emit
      지점(401 세션 복원 실패, !res.ok, JSON 파싱 실패, fanId 없음)은
      buildFailureResult()/mapLoginFailure()를 전혀 거치지 않고, 서버 응답 원문
      rawBody 최대 200자를 마스킹 없이 그대로 _emit() → auth-event IPC →
      App.tsx의 loginError로 흘려보낸다(auth-service.ts:955-988). 06-05-SUMMARY.md는
      이 경로가 "이미 같은 mapLoginFailure()/emit 경로를 타 자동으로 혜택을
      받는다"고 기록했으나 코드상 사실이 아니다.
    artifacts:
      - path: "src/main/services/auth-service.ts"
        issue: "validateToken()의 네 개 _emit() 호출(955-960, 964-967, 974-978, 983-988행)이 maskSensitive()를 거치지 않은 rawBody.slice(0,200)을 message에 직접 담는다."
    missing:
      - "네 개 emit 지점에서 maskSensitive(rawBody.slice(0, 200))로 감싸거나, D-12 매핑 테이블처럼 상태 코드 기반 고정 안내 문구로 대체한다."
      - "06-05-SUMMARY.md의 '자동으로 혜택을 받는다'는 서술을 이 사실에 맞게 정정한다 — 다음 phase가 이 잘못된 완료 선언을 근거로 재검증을 건너뛸 위험이 있다."
deferred: []
---

# Phase 06: 로그인 방식 선택 UI + 실패 안내 Verification Report

**Phase Goal:** 사용자가 로그인 방식(API 통신/브라우저)을 명시적으로 선택하고, 선택 시 제약을 사전 고지받으며, 로그인 실패 시 원인을 한국어로 이해할 수 있다.
**Verified:** 2026-08-26T06:15:20Z
**Status:** gaps_found
**Re-verification:** No — initial verification

> 이 보고서는 ROADMAP.md 원문(성공 기준 2·3은 06-03에서 `[VOID]` 마킹 + D-08/D-09/D-11/D-12
> 정정본으로 교체됨)을 권위 있는 성공 기준으로 삼는다. SUMMARY.md의 완료 선언은 증거로
> 취급하지 않고, 아래 각 항목을 코드에서 직접 재확인했다.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP 정정본 기준) | Status | Evidence |
|---|---|---|---|
| 1 | 사용자가 API 통신 또는 브라우저 로그인 방식을 선택할 수 있고, 선택값은 앱 재시작 후에도 유지된다 (기본값 browser) | ✓ VERIFIED | `settings-store.ts`의 `setLoginMode()`/`getLoginMode()`가 tmp+rename 원자적 쓰기로 `userData/settings.json`에 영속하고, `readSettings()`가 `"api"` 외 모든 값을 `DEFAULT_LOGIN_MODE="browser"`로 정규화한다 — 쓰기·읽기 로직이 두 방향에 대해 대칭이다(양방향 왕복 로직 자체는 대칭적으로 구현되어 있으나, 실제 앱 재시작을 통한 브라우저→재시작 방향의 육안 확인은 06-VALIDATION.md에 outstanding UAT로 별도 등록돼 있음 — 아래 "이미 등록된 인간 확인 대기 항목" 참고). `settings-store.test.ts`에 `api` 방향 재시작 라운드트립 단위 테스트(79-87행)가 존재하고 315개 테스트 스위트 전체가 green이다. |
| 1b | 기존 브라우저 로그인 동작은 변경 없이 선택기 뒤로 배선된다 — 단, 저장된 자격증명 기반 무인 자동 로그인(`tryAutoLogin`/`tryAutoRelogin`)은 D-03에 따라 의도적으로 제거된다 | ✓ VERIFIED | `auth-service.ts:147-206` — `tryAutoLogin()`은 쿠키 세션 복원만 시도하고 `credentialLogin()`을 호출하지 않는다(주석으로 명시). `trySessionRestore()`(구 `tryAutoRelogin()`의 후신, 178-206행)도 동일. `credentialLogin()`의 유일한 호출자는 `ipc-handlers.ts:53`의 `auth:credential-login` 핸들러뿐 — `grep -rn "\.credentialLogin("` 결과 확인. ROADMAP Phase 06 SC1 아래 "⚠ 의도적 편차 (D-03)" 주석이 이 편차를 회귀가 아닌 의도된 변경으로 명시. |
| 2 | 사용자가 API 모드를 처음 선택하면 ①Weverse 보안 확인 실패 가능성 ②자동 재로그인 부재 — 두 가지 고지를 확인해야만 진행할 수 있다 (D-08/D-09) | ⚠ 부분 실패 (정상 경로만 성립) | `ApiModeNoticeModal.tsx`는 `<dialog>.showModal()`(네이티브 포커스 트랩·backdrop)을 쓰는 차단형 모달이며, 두 문구 모두 D-08 정정본과 정확히 일치하고 반증된 이메일 OTP 서사가 없다. `decideTabClick()`(login-panel-view.ts)는 `shouldShowApiModeNotice(ackedVersion, currentVersion)`이 true일 때만 모달을 열고, 취소/Esc는 `onCancel`로 완전히 분리돼 모드를 저장하지 않는다 — 단위 테스트로 검증됨. **그러나** `settings:set-login-mode` 쓰기가 실패하는 경로에서 "확인해야만 진행" 계약이 거짓으로 성공 보고된다 — 아래 gaps 참고 (CR-01, App.tsx:130-139 / LoginPanel.tsx:95-107). |
| 3 | `credentialLogin()`이 실제로 마주치는 6가지 실패 신호(캡차/폼 오류/타임아웃/네트워크·런타임 오류/토큰 사다리 실패/미매핑)가 서버 에러 코드 대신 한국어 설명 문구로 표시된다 (D-12) | ✓ VERIFIED | `src/shared/login-failure.ts`의 `mapLoginFailure()`가 6개 `LoginFailureReason` 전부를 exhaustive switch로 매핑하며(신규 값 추가 시 컴파일 타임에 누락 검출), 캡차는 D-13 정정 문구("보안 확인... 브라우저 로그인 사용")로 올바르게 매핑돼 반증된 OTP 서사가 사라졌다. `buildFailureResult()`(auth-service.ts:478-511)가 `message`/`identifier`에 `maskSensitive()`를 명시적으로 적용하는 유일한 관문이며, `credentialLogin()`의 정상 실패 경로들(캡차/타임아웃/폼 오류/사다리 실패/예외)이 전부 이 관문을 거친다. `login-failure.test.ts` 29개 테스트로 6개 사유 전수 검증. `-25003/-25044/-26000/-26004/해외 로그인 차단`은 D-02가 제거한 순수 HTTP 경로에서만 발생해 도달 불가함이 REQUIREMENTS.md/ROADMAP.md에 `[VOID]`로 정정 기록돼 있다. |
| 3b | 렌더러로 반환되는 모든 실패 message/identifier가 마스킹을 거친 값뿐이다 (R010, 06-05-PLAN must_haves) | ⚠ 부분 실패 | `credentialLogin()` 경로는 위와 같이 정확히 마스킹된다. **그러나** 두 모드가 공유하는 `validateToken()`의 네 개 실패 emit 지점이 서버 응답 원문 최대 200자를 마스킹 없이 그대로 렌더러에 전달한다 — 아래 gaps 참고 (CR-02, auth-service.ts:955-988). SC3 자체(credentialLogin의 6개 신호)는 손상되지 않지만, 이 phase가 "buildFailureResult()가 유일한 마스킹 관문"이라고 세운 전제가 실제로는 두 모드 공유 경로 하나에서 성립하지 않는다. |
| 4 | 환경변수로 로그인 방식이 잠기면 두 탭 모두 비활성화되고, 잠금 사실만 표시되며 환경변수 원문 값은 노출되지 않는다 (D-06) | ✓ VERIFIED | `resolveLoginMode()`/`isLoginModeLockedByEnv()`(login-mode.ts)가 env 우선순위를 결정하는 유일한 지점이고, `describeLockedMode()`(login-panel-view.ts)는 `MODE_LABEL` 고정 문자열 두 개 중 하나만 끼워 넣어 env 원문 값이 입력/출력 어디에도 등장하지 않는다. `resolveTabView()`가 `active`/`tabsDisabled`/`showBadge` 세 값을 모두 `lockedByEnv`에서 파생시켜 서로 다른 값에서 UI가 거짓말할 여지가 없다. `settings-store.test.ts`(156-175행)로 env 우선순위 단위 테스트 확인. |
| 5 | 반증된 3단계 계정 API 로그인(OTP) 코드와 문서 서술이 코드베이스·요구사항에서 정리되었다 (D-02/D-11/D-12) | ✓ VERIFIED | `grep -rn "submitOtp\|verifyOtp\|credentialLoginApi\|OtpSession\|needOtp\|auth:submit-otp"` 결과 0건. REQUIREMENTS.md R020/R021, ROADMAP.md Phase 06 SC2/SC3에 `[VOID]` 마킹 + 정정문 + 근거 경로가 병기되어 있고, 반증된 원문은 삭제되지 않고 보존됨(`-25044` grep 다수 잔존 확인). |

**Score:** 5/7 truths verified (2 partial — 코드 결함으로 실패 경로에서만 계약이 깨짐, 정상 경로는 성립)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/main/services/settings-store.ts` | 원자적 설정 영속 (D-04/D-05) | ✓ VERIFIED | 존재·실질적 구현·`ipc-handlers.ts`에서 사용·24개 단위 테스트로 배선 확인 |
| `src/shared/api-mode-notice.ts` | 고지 버전 재노출 판정 (D-10) | ✓ VERIFIED | `shouldShowApiModeNotice()` 순수 함수, `login-panel-view.ts`의 `decideTabClick()`에서 사용 |
| `src/main/login-mode.ts` | env 우선순위 결정 (D-06) | ✓ VERIFIED | `resolveLoginMode()`/`isLoginModeLockedByEnv()`, `settings-store.ts`에서 사용 |
| `src/shared/login-failure.ts` | 실패 사유 → 한국어 안내 (D-12/D-13/D-14, R020) | ✓ VERIFIED | `mapLoginFailure()`/`classifyCredentialLoginSignal()`, `auth-service.ts`·`login-panel-view.ts`에서 사용, 29개 테스트 |
| `src/main/services/auth-service.ts` | 단일 자격증명 로그인 경로 + 마스킹된 실패 반환 (D-01/D-02/D-13, R010) | ⚠ HOLLOW (부분) | `credentialLogin()` 경로는 견고하나 `validateToken()`의 4개 emit 지점이 마스킹 관문을 우회함 (CR-02) |
| `src/renderer/components/ApiModeNoticeModal.tsx` | 차단형 고지 모달 (D-08/D-09) | ✓ VERIFIED | 네이티브 `<dialog>.showModal()`, 확정 문구 2종, Esc/취소 분리 |
| `src/renderer/App.tsx` + `src/renderer/components/LoginPanel.tsx` | 고지 확인 ↔ 모드 저장 배선, 탭 상시 렌더링 (D-07, Interaction Contract 1) | ⚠ HOLLOW (부분) | 탭 상시 렌더링·정상 경로 배선은 맞으나 `handleAcknowledge`↔`handleSetLoginMode` 계약 불일치 (CR-01) — 아무 렌더러 컴포넌트 테스트도 이 결함을 잡지 못함 |
| `src/renderer/components/login-panel-view.ts` | 순수 판단 로직 (탭 클릭 결정·잠금 배지·실패 뷰) | ✓ VERIFIED | `resolveTabView`/`decideTabClick`/`buildFailureView`/`describeLockedMode`, 21개 테스트로 커버 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `preload.ts` settings 네임스페이스 | `shared/types.ts` IpcApi.settings | 시그니처 일치 | ✓ WIRED | 4채널(`get-login-mode`/`set-login-mode`/`get-notice-ack`/`ack-notice`) 등록·해제·타입 선언 전부 일치 (리뷰 확인 + grep 재확인) |
| `ipc-handlers.ts` settings:set-login-mode | `SettingsStore.setLoginMode()` | 직접 호출, catch 없음 | ✓ WIRED (하지만 렌더러 소비 지점에서 문제) | main 프로세스는 실패를 삼키지 않고 그대로 reject 전파 — `settings-store.test.ts` 219-249행으로 확인. 문제는 이 reject를 소비하는 렌더러 쪽 계약(CR-01)에 있다. |
| `handleAcknowledge()` (LoginPanel.tsx) | `onSetLoginMode()` prop → `handleSetLoginMode()` (App.tsx) | await + catch | ✗ NOT_WIRED (계약 불일치) | `handleSetLoginMode()`가 절대 reject하지 않아 `handleAcknowledge()`의 catch가 실패 시에도 실행되지 않는다 (CR-01) |
| `credentialLogin()` 실패 반환 | `buildFailureResult()` → `maskSensitive()` | 명시적 래핑 | ✓ WIRED | auth-service.ts:446-511 |
| `validateToken()` 실패 emit | `maskSensitive()` | (경로 없음) | ✗ NOT_WIRED | auth-service.ts:955-988이 `buildFailureResult()`/`mapLoginFailure()`를 우회하고 rawBody 원문을 직접 emit (CR-02) |
| `CredentialLoginResult.reason` | `mapLoginFailure().suggestBrowserSwitch` → 전환 버튼 노출 | `buildFailureView()` | ✓ WIRED | login-panel-view.ts, LoginPanel.tsx:300 |
| `lockedByEnv` | 탭 disabled ↔ 배지 렌더링 | `resolveTabView()` 단일 파생 지점 | ✓ WIRED | 세 값이 한 함수에서 파생돼 불일치 불가능 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R016 | 06-01, 06-04, 06-06, 06-07 | 로그인 방식 선택 + 영속 | ✓ SATISFIED | settings-store.ts 영속 로직, resolveTabView 배선, D-03 무인 로그인 가드 확인 |
| R020 | 06-02, 06-03, 06-04, 06-05, 06-06, 06-07 | API 로그인 실패 사유 한국어 안내 | ✓ SATISFIED (credentialLogin 경로) — validateToken 공유 경로는 마스킹 우회 | login-failure.ts 6개 사유 매핑 정확, 단 CR-02가 별도 공유 경로에서 R010(마스킹) 원칙을 어김 |
| R021 | 06-01, 06-03, 06-06, 06-07 | API 모드 제약 사전 고지 (차단형) | ✓ SATISFIED (정상 경로) — 실패 경로는 CR-01로 계약 위반 | ApiModeNoticeModal.tsx 문구·차단 구조 정확, 단 저장 실패 시 거짓 성공 보고 (CR-01) |

ORPHANED 요구사항 없음 — REQUIREMENTS.md에서 Phase 06으로 매핑된 R016/R020/R021이 모두 7개 플랜 중 하나 이상의 `requirements` 필드에 등장한다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (없음) | - | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | - | phase가 수정한 13개 파일 전수 grep 결과 0건 |
| `src/renderer/App.tsx` | 130-139 | 실패를 삼키고 재던지지 않는 catch — 호출부가 서로 다른 계약을 기대 | 🛑 Blocker | CR-01, 위 gaps 참고 |
| `src/main/services/auth-service.ts` | 955-988 | 마스킹 관문을 우회하는 원문 노출 | 🛑 Blocker | CR-02, 위 gaps 참고 |
| `src/renderer/components/LoginPanel.tsx` | 109-112 | `handleCancelNotice`가 `noticeSaving` 진행 중 가드 없음 — 확인 저장 중 Esc를 눌러도 취소로 시각적으로 닫히고, 진행 중이던 저장이 이후 성공하면 조용히 API 모드로 전환됨 | ⚠ Warning | 06-REVIEW.md WR-01. 이번 검증에서 phase 목표(SC2 "확인해야만 진행")의 직접 실패 사유로 분류하지는 않았으나 관련 레이스 컨디션. |
| `src/shared/mask.ts` | 38-66 | `maskSensitive()`가 `key: value` 패턴만 매칭 — 문맥 없는 원문 토큰(예: 서버가 임의 문자열 안에 토큰형 문자열을 포함해 반환하는 경우)은 통과 가능 | ⚠ Warning | 06-REVIEW.md WR-02 |
| `src/main/services/auth-service.ts` | 312-332 | "로그인 버튼이 활성화되지 않았습니다" 실패가 `buildFailureResult()`/6개 사유 체계를 완전히 우회하는 7번째 미분류 경로 | ⚠ Warning | 06-REVIEW.md WR-03 |
| `src/main/ipc-handlers.ts` | 118-120 | `settings:set-login-mode` 핸들러가 `mode` 값을 런타임 검증하지 않음 | ⚠ Warning | 06-REVIEW.md WR-04 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 전체 테스트 스위트 green | `npm test` (`rtk vitest run`) | `PASS (315) FAIL (0)` — 16개 파일 | ✓ PASS |
| 타입체크 clean (게이트 문서·orchestrator 사전 측정치 인용, 이번 검증에서 재확인 안 함 — 코드 변경 없는 검증 세션이라 결과가 달라질 수 없음) | `npm run typecheck`, `npm run typecheck:main` | orchestrator 사전 측정: 0 에러 | ✓ PASS (인용) |
| 빌드 성공 (orchestrator 사전 측정치 인용) | `npm run build` | orchestrator 사전 측정: exit 0 | ✓ PASS (인용) |
| CR-02 rawBody 노출 코드 도입 시점 | `git log -S"rawBody.slice(0, 200)" -- src/main/services/auth-service.ts` | 커밋 816970a, 2026-05-14 — Phase 06(2026-08-26) 훨씬 이전 | ✓ PASS (리뷰의 "phase 06 이전부터 존재" 주장 확인) |
| `credentialLogin()` 단일 호출자 확인 | `grep -rn "\.credentialLogin(" src/main` | `ipc-handlers.ts:53` 한 곳뿐 | ✓ PASS |
| 반증된 OTP 코드 완전 삭제 확인 | `grep -rn "submitOtp\|verifyOtp\|credentialLoginApi\|OtpSession\|needOtp\|auth:submit-otp"` | 0건 | ✓ PASS |

### Probe Execution

이 phase는 마이그레이션/CLI 도구 phase가 아니며 `scripts/*/tests/probe-*.sh` 관례를 사용하지 않는다. PLAN/SUMMARY/VALIDATION 어디에도 probe 스크립트 언급이 없다. **SKIPPED (no probe scripts declared or found).**

### 이미 등록된 인간 확인 대기 항목 (이번 검증에서 새로 발견한 것 아님)

이 phase의 06-VALIDATION.md는 이미 4개의 자동화 불가 UAT 항목과 06-06-SUMMARY.md의 2개
`human_judgment: true` 항목을 등록해 두었다. known_state에 따르면 사용자가 이번 실행 중
다음 두 가지는 실제 Electron 세션으로 직접 확인했다:
- API 모드 선택 → 앱 완전 종료 → 재실행 시 탭 유지
- 로그인 상태에서 탭 전환 시 "로그인 완료" 배지 유지 (D-07)

다음은 여전히 미확인 상태이며, 이 보고서가 임의로 통과 처리하지 않는다:
- 브라우저 모드 → 재시작 방향의 영속 확인 (코드상 대칭 구현·단위 테스트로 API 방향만 직접
  커버되어 신뢰도는 높으나, 육안 확인 자체는 미수행)
- 최초 고지 차단 동작의 실제 인터랙션(포커스 트랩, 좁은 창에서 버튼 도달성)
- 환경변수 잠금 시 실제 화면 표시
- 오타 비밀번호로 실제 로그인 시도 시 실패 안내 문구

이 항목들은 gaps_found 판정에 영향을 주지 않는다(이미 06-VALIDATION.md에 별도 등록되어
있고, 이 검증이 다시 만들어내는 새 발견이 아니다). 다만 CR-01/CR-02 gap이 해결된 후에도
이 UAT 항목들은 별도로 인간이 확인해야 한다.

### Gaps Summary

이번 검증은 06-REVIEW.md가 지목한 2개 Critical 발견을 코드를 직접 읽어 독립적으로
재확인했고, 둘 다 실재하는 결함으로 확정했다.

1. **CR-01 (SC2에 직결):** 고지 모달의 "확인했습니다" 흐름은 `settings:set-login-mode`
   쓰기가 실제로 실패하는 경우 그 실패를 감지하지 못하고 모달을 "성공"으로 닫는다.
   `App.tsx`의 `handleSetLoginMode`가 탭 클릭(fire-and-forget)용으로 설계된 "실패를
   삼키고 절대 재던지지 않는" 구현을 모달 확인 경로에 그대로 재사용하면서 발생한
   계약 불일치다. 정상 경로(디스크 쓰기 성공)에서는 문제가 없다. 렌더러 컴포넌트
   테스트가 전무해 이 결함은 어떤 자동 테스트로도 잡히지 않는다.
2. **CR-02 (R010/마스킹 원칙에 직결, SC3의 credentialLogin 6개 신호 자체는 손상 안 됨):**
   두 로그인 모드가 공유하는 `validateToken()`의 네 개 실패 emit 지점이 서버 응답
   원문 최대 200자를 마스킹 없이 그대로 렌더러에 전달한다. 06-05-SUMMARY.md는 이
   경로가 "자동으로 마스킹 혜택을 받는다"고 명시적으로(그리고 틀리게) 기록했다 —
   이는 검증되지 않은 채 통과 처리된 완전성 주장이었다. phase 06 이전부터 있던
   코드라 06-05가 직접 도입한 결함은 아니지만, 이 phase가 "buildFailureResult()가
   유일한 마스킹 관문"이라는 전제를 세우면서 그 전제가 성립하지 않는 공유 경로를
   그대로 남겨뒀다.

두 결함 모두 `overrides:`로 수용할 만한 "의도된 편차"가 아니라 명백한 구현 결함이며,
D-03(무인 자동 로그인 제거)처럼 ROADMAP에 문서화된 의도적 편차와는 성격이 다르다.
VERIFICATION.md 프론트매터에 override 항목을 추가하지 않았다.

이 phase의 나머지 산출물 — 방식 선택 영속, env 잠금, D-02 코드 삭제, 6개 실패 신호의
credentialLogin 경로 매핑·마스킹, UI-SPEC 22개 항목 중 코드로 확인 가능한 대부분 —
은 코드 직접 확인 결과 견고했다.

---

_Verified: 2026-08-26T06:15:20Z_
_Verifier: Claude (gsd-verifier)_
