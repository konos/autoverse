---
phase: 06-ui
plan: 04
subsystem: auth
tags: [electron-main, headless-login, ipc, dead-code-removal, tdd]

# Dependency graph
requires:
  - phase: 05-api
    provides: "05-01-SUMMARY.md 의 반증된 3단계 계정 API 로그인 계약 기록 — 이 플랜이 삭제하는 코드의 근거"
  - phase: 06-ui (06-01, 06-02)
    provides: "settings-store.ts/login-mode.ts persistedMode 배선(06-01), login-failure.ts LoginFailureReason 어휘(06-02) — 이 플랜이 소비"
provides:
  - "단일 자격증명 로그인 진입점 — auth:credential-login 이 모드 분기 없이 AuthService.credentialLogin() 한 줄로 위임 (D-01)"
  - "반증된 3단계 계정 API 로그인 코드 완전 제거 — 메서드·IPC 채널·타입 필드·테스트 전부 (D-02)"
  - "두 모드 공통 무인 로그인 차단 가드 — tryAutoLogin()/trySessionRestore() 가 모드가 아니라 '외부 로그인 요청 발생 여부'로 게이트한다 (D-03)"
affects: [06-05, 06-06, 06-07, 07]

# Actuals (#2632)
actuals:
  tokens: 13500
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "가드 재정의 원칙 — '모드가 무엇인가'가 아니라 '이 코드가 외부에 로그인 요청을 발생시키는가'로 조건을 세운다. 반증된 사유 위에 세워진 가드는 사유만 정정하고 보호 범위는 넓히는 방향으로만 바꾼다(약화 금지)."
    - "삭제 시 호출자 → 정의 순서 — 컴파일이 중간 상태에서도 통과하도록 IPC 핸들러/preload/타입 먼저 정리한 뒤 서비스 메서드 본체를 지운다."

key-files:
  created: []
  modified:
    - src/main/services/auth-service.ts
    - src/main/services/__tests__/auth-service.test.ts
    - src/main/services/api-auth-client.ts
    - src/main/services/__tests__/api-auth-client.test.ts
    - src/main/ipc-handlers.ts
    - src/main/preload.ts
    - src/shared/types.ts

key-decisions:
  - "CONTEXT D-02 명시 목록을 넘어 AuthService.submitOtp()/ApiAuthClient.verifyOtp() 및 부속(OtpSession, REFRESH_TOKEN_COOKIE_TTL, CredentialLoginResult.needOtp, IpcApi.auth.submitOtp, auth:submit-otp 채널)까지 확대 삭제 — 사용자가 오케스트레이터의 사전 확인 질문에 '플랜대로 전부 삭제'로 명시적으로 승인했다(집행 전 승인, 조용한 확대 아님)."
  - "tryAutoLogin()/trySessionRestore() 양쪽이 저장된 자격증명을 더 이상 읽지 않게 되면서 loadCredentials() 가 고아 메서드가 됐다 — 삭제 대신 남겨뒀다면 D-02/D-03 이 경계하는 '다시 배선될 수 있는 죽은 경로'를 새로 만드는 셈이라 함께 제거했다(계획에 명시되지 않은 필연적 파생 정리)."
  - "tryAutoRelogin() 을 trySessionRestore() 로 개명 — 이제 이 메서드는 어떤 형태의 로그인도 수행하지 않고 쿠키 세션 복원만 하므로, 이름이 실제 동작과 일치해야 한다는 이 플랜의 관통 기준을 그대로 적용했다."

patterns-established:
  - "테스트에서 사라진 private 메서드(loadCredentials)를 spyOn 하는 대신, mock-encrypted credentials.enc 파일을 실제 fs 에 기록해 '저장된 자격증명이 실재한다'는 상태를 증명하는 패턴 — safeStorage 모킹이 이미 실 fs 위에서 동작하므로 프로덕션 경로에 더 가깝다."

requirements-completed: []  # R016/R020 은 06-06/06-07(R016) 및 06-05/06-06/06-07(R020) 형제 플랜이 아직 SUMMARY 가 없어 공유-ID 게이트에 의해 보류 — gsd-tools requirements ready-ids 로 재평가됨

coverage:
  - id: D1
    description: "자격증명 로그인 진입점이 하나뿐이다 — auth:credential-login 핸들러의 모드 삼항 분기 제거, credentialLogin() 한 줄 위임 (D-01)"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts — 전체 스위트 (31 tests)"
        status: pass
      - kind: other
        ref: "grep -c 'resolveLoginMode() === \"api\"' src/main/ipc-handlers.ts == 0; grep -c 'authService.credentialLogin(email, password)' src/main/ipc-handlers.ts == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "반증된 3단계 계정 API 로그인 코드(메서드·IPC 채널·타입 필드·테스트)가 전부 제거됐다 — 사용자 승인 하에 submitOtp()/verifyOtp() 등 확대 삭제 포함 (D-02)"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/api-auth-client.test.ts — 전체 스위트 (11 tests)"
        status: pass
      - kind: other
        ref: "grep -vE 위 acceptance_criteria 의 부정 grep 9종 (auth-service.ts/ipc-handlers.ts/preload.ts/types.ts/api-auth-client.ts) 전부 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "무인 자동 로그인이 두 모드 모두에서 차단되고, 쿠키 세션 복원은 그대로 유지된다 — 모드 조건에서 외부 요청 조건으로 재정의 (D-03, TDD RED→GREEN)"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.tryAutoLogin — 무인 로그인 차단 (두 모드 공통) / #AuthService.trySessionRestore"
        status: pass
      - kind: other
        ref: "sed -n '/async tryAutoLogin/,/^  }/p' ... | grep -c 'this.credentialLogin(' == 0; grep -c trySessionRestore == 5"
        status: pass
    human_judgment: false
  - id: D4
    description: "R019 자산(사다리·서비스 토큰 교환·토큰 검증)이 이번 정리로 손상되지 않았다"
    verification:
      - kind: unit
        ref: "npm test — 전체 스위트 272 tests"
        status: pass
      - kind: other
        ref: "grep -c 'acquireFaneventToken|exchangeForService|probeFaneventToken' src/main/services/api-auth-client.ts == 15"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 04: 반증된 API 로그인 코드 제거 + 무인 로그인 가드 재정의 Summary

**D-01/D-02/D-03 을 각각 하나의 태스크로 집행 — 자격증명 로그인 진입점을 `credentialLogin()` 헤드리스 경로 하나로 확정하고, 05-01 이 반증한 3단계 계정 API 계약 코드를 전량 제거했으며, 무인 자동 로그인 가드를 "모드" 조건에서 "외부 로그인 요청 발생 여부" 조건으로 재정의해 브라우저 모드에도 확대 적용했다.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-08-26T14:02:00Z (추정 — 세션 시작 시각)
- **Completed:** 2026-08-26T14:44:00Z
- **Tasks:** 3 of 3
- **Files modified:** 7
- **Diff size (chars/4, HEAD~4..HEAD src/):** ~13,500 tokens (plan estimate: 72,000 — 대폭 하회, 순수 삭제/재정의 작업이라 신규 코드가 거의 없었기 때문)

## Accomplishments

- Task 1 (D-01/D-02): `AuthService.credentialLoginApi()`/`submitOtpApi()`/`finishApiLogin()`/`apiLoginState` 및 (사용자 승인 하 확대 삭제) `submitOtp()`/`waitForTokenAfterOtp()`/`pendingCredentials` 제거. `ipc-handlers.ts` 의 `auth:credential-login` 핸들러가 모드 삼항 없이 `credentialLogin()` 한 줄로 위임하도록 정리하고 `auth:submit-otp` 채널·핸들러·unregister 대칭을 함께 삭제. `preload.ts`/`shared/types.ts` 에서 `submitOtp`/`needOtp` 를 제거하고 `CredentialLoginResult.reason?: LoginFailureReason` 을 추가. DOM 폴링의 `'otp'` 분기는 반증된 "이메일 OTP 필요" 문구 대신 06-02 `mapLoginFailure("unknown", ...)` 결과를 사용하도록 최소 변경.
- Task 2 (D-02 확대): `ApiAuthClient.requestOtpSession()`/`loginWithCredentials()`/`verifyOtp()`(및 `OtpSession`/`REFRESH_TOKEN_COOKIE_TTL`) 제거 — Task 1 이 유일한 호출자를 지우면서 고아가 됐다. R019 자산(`acquireFaneventToken`/`exchangeForService`/`probeFaneventToken`)은 무변경 보존. 테스트 파일에서 삭제 대상 전용 describe 3개(otp-session/otp verify/error)를 통째로 지우고, tracer/민감정보 describe 를 남은 사다리 메서드만으로 재작성.
- Task 3 (D-03, TDD): `tryAutoLogin()`/`tryAutoRelogin()` 의 게이트를 `resolveLoginMode() === "api"` 조건에서 "쿠키 세션 복원만 허용, 저장된 자격증명으로의 무인 로그인은 두 모드 모두 차단" 조건으로 재정의. `tryAutoRelogin()` 을 `trySessionRestore()` 로 개명(더 이상 어떤 로그인도 수행하지 않으므로). RED 테스트 커밋 후 GREEN 구현 — 브라우저 모드 + 저장된 자격증명이 있어도 헤드리스 로그인이 호출되지 않는 회귀 테스트를 신규 추가.

## Task Commits

1. **Task 1: 반증된 계정 API 로그인 코드 제거 + 자격증명 로그인 단일 경로 확정 (D-01/D-02)** - `d0f3611` (feat)
2. **Task 2: ApiAuthClient 고아 메서드 제거 + 교차 의존 테스트 재작성** - `8fc9f9b` (refactor)
3. **Task 3 RED: 무인 로그인 가드 재정의 실패 테스트 작성** - `2592f60` (test)
4. **Task 3 GREEN: 무인 로그인 가드 재정의 구현 (D-03)** - `b2feb2d` (feat)

**Plan metadata:** (이 커밋 이후 기록)

## Files Created/Modified

- `src/main/services/auth-service.ts` — API 모드 전용 로그인 메서드/필드 전량 삭제, `tryAutoLogin()`/`trySessionRestore()` 재정의, `loadCredentials()` 고아 메서드 제거
- `src/main/services/__tests__/auth-service.test.ts` — D-03 게이트 describe 재작성, `trySessionRestore` describe 신설, fs 기반 stored-credentials 테스트 헬퍼 추가
- `src/main/services/api-auth-client.ts` — `requestOtpSession`/`loginWithCredentials`/`verifyOtp` 및 부속 타입/상수 제거
- `src/main/services/__tests__/api-auth-client.test.ts` — 삭제 대상 전용 describe 3개 제거, tracer/민감정보 재작성 (7→4 describe)
- `src/main/ipc-handlers.ts` — `auth:credential-login` 단일 위임, `auth:submit-otp` 채널 제거, 미사용 `resolveLoginMode` import 정리
- `src/main/preload.ts` — `submitOtp` 바인딩 제거
- `src/shared/types.ts` — `CredentialLoginResult.needOtp` → `reason?: LoginFailureReason`, `IpcApi.auth.submitOtp` 제거

## Decisions Made

**1. CONTEXT D-02 명시 목록을 넘어선 확대 삭제 — 사용자 사전 승인**

플랜 작성 시점의 CONTEXT D-02 는 `credentialLoginApi()`/`requestOtpSession()`/`loginWithCredentials()`/`submitOtpApi()`/`ipc-handlers.ts` 의 모드 분기/`LoginPanel.tsx` 의 OTP 화면을 명시했다. 이 플랜은 그 목록에 없는 다음 항목도 함께 삭제했다:

- `AuthService.submitOtp()` (헤드리스 창에 OTP 코드를 타이핑하던 메서드) — 렌더러의 OTP 입력 화면이 06-01 에서 이미 사라져 호출자가 0이 됐고, `auth:submit-otp` IPC 채널도 이 플랜이 함께 삭제한다.
- `ApiAuthClient.verifyOtp()` 및 부속 `OtpSession`/`REFRESH_TOKEN_COOKIE_TTL` — 유일한 호출자였던 `AuthService.submitOtpApi()` 가 Task 1에서 삭제되면서 고아가 됐고, 테스트 2건(단위 테스트 1개 + tracer end-to-end 1개)도 이 계약을 전제하고 있었다.
- `AuthService.waitForTokenAfterOtp()`/`pendingCredentials` — `submitOtp()` 전용 헬퍼/필드로, `submitOtp()` 삭제와 동시에 고아가 됐다.
- `AuthService.loadCredentials()` (Task 3 파생) — `tryAutoLogin()`/`trySessionRestore()` 양쪽이 더 이상 저장된 자격증명을 읽지 않게 되면서 호출자가 0이 됐다.

**근거:** 오케스트레이터가 집행 전 이 확대 범위를 사용자에게 명시적으로 제시했고, 사용자는 "플랜대로 전부 삭제"를 선택했다(좁은 대안 두 가지를 거부). 이 승인은 `<user_decision>` 블록으로 이 실행 프롬프트에 기록됐으며, 조용한 스코프 확장이 아니라 사전 확인을 거친 결정이다. 코드 근거: `AuthService.submitOtp()`/`waitForTokenAfterOtp()`/`pendingCredentials` 는 06-01 이후 렌더러 소비자가 0이었고(`grep` 확인), `ApiAuthClient.verifyOtp()` 는 이 플랜의 Task 1이 유일한 호출자를 지우기 전까지만 도달 가능했다. `loadCredentials()` 는 Task 1/2가 아니라 Task 3의 직접적 파생 결과다.

**2. `tryAutoRelogin()` → `trySessionRestore()` 개명**

이 메서드가 더 이상 어떤 형태의 로그인도 수행하지 않고 쿠키 세션 복원만 하게 되면서, "재로그인"이라는 이름이 사실과 어긋나게 됐다. "테스트 이름이 실제 동작과 일치해야 한다"는 이 플랜의 must_haves 조건을 코드 심볼 이름에도 동일하게 적용했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - 고아 코드 정리, Task 3 파생] `loadCredentials()` 를 컴파일 에러로 발견하고 삭제**

- **Found during:** Task 3 GREEN 구현 (`npm run typecheck:main`)
- **Issue:** `tryAutoLogin()`/`trySessionRestore()` 재작성 후 `loadCredentials()` 의 호출자가 0이 되어 `noUnusedLocals` 컴파일 에러(TS6133) 발생.
- **Fix:** `loadCredentials()` 메서드를 삭제. `StoredCredentials` 인터페이스는 `saveCredentials()` 가 여전히 사용하므로 유지.
- **Files modified:** `src/main/services/auth-service.ts`, `src/main/services/__tests__/auth-service.test.ts` (private 메서드 spyOn 대신 fs 기반 실제 credentials.enc 파일 작성 패턴으로 테스트 재작성)
- **Verification:** `npm run typecheck:main` 0 에러, 관련 테스트 4건 통과
- **Committed in:** `b2feb2d` (Task 3 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 1/3 — 이 플랜 자신의 변경이 직접 유발한 고아 코드 정리). 사용자 승인 확대 삭제(D-02 관련 4개 심볼)는 편차가 아니라 명시적 승인 범위이므로 위 "Decisions Made" 섹션에 별도로 기록했다.
**Impact on plan:** 전부 정확성/스코프 요구사항 준수에 필요한 조치였다. 계획되지 않은 새 기능 추가는 없었다.

## Known Stubs

None — 세 태스크 모두 실제 배선과 자동 테스트로 검증됐다. `CredentialLoginResult.reason` 필드의 캡차/OTP 신호 세분화(현재는 `"unknown"` 으로 뭉뚱그림)는 스텁이 아니라 06-05 소관으로 명시 이관된 범위다(D-13은 이 플랜 밖).

## Issues Encountered

None.

## User Setup Required

None — 외부 서비스 설정 변경 없음.

## Next Phase Readiness

- 06-05(실패 안내 배선)는 이 플랜이 남긴 `CredentialLoginResult.reason: "unknown"` 최소 수정 위에서, 캡차/폼 에러/타임아웃 등을 실제로 구분하는 작업을 이어받는다.
- 06-06/06-07 은 R016/R020 요구사항의 나머지 커버리지를 담당하며, 두 요구사항 모두 이 플랜과 공유 ID라 아직 `Complete` 로 표시되지 않는다(공유-ID 게이트가 형제 플랜 완료를 기다린다).
- Phase 07(토큰 만료 사전 경고, R022)은 D-03 의 부수 효과로 이제 API 모드뿐 아니라 두 모드 전체에서 필요해졌다 — STATE.md 에 이미 기록된 사항, 계획 시 반영 필요.

## Self-Check

- `[ -f src/main/services/auth-service.ts ]` → FOUND
- `[ -f src/main/services/api-auth-client.ts ]` → FOUND
- `git log --oneline --all | grep d0f3611` → FOUND
- `git log --oneline --all | grep 8fc9f9b` → FOUND
- `git log --oneline --all | grep 2592f60` → FOUND
- `git log --oneline --all | grep b2feb2d` → FOUND
- `npm test` → 272/272 passing
- `npm run typecheck` → 0 errors
- `npm run typecheck:main` → 0 errors
- `npm run build` → passing
- 전체 acceptance_criteria (Task 1: 10개, Task 2: 6개, Task 3: 9개) → 전부 PASS (grep 결과 위 본문에 기록)

## Self-Check: PASSED

## TDD Gate Compliance

Task 3 는 `tdd="true"` — RED(`2592f60`)→GREEN(`b2feb2d`) 게이트 확인:
- RED: `test(06-04): add failing tests for mode-independent unattended-login guard (D-03)` — 5개 테스트가 의도대로 실패(브라우저 모드 회귀 케이스는 구 게이트 하에서 헤드리스 BrowserWindow 생성 시도로 예외, 세션 복원 케이스는 구 게이트가 API 모드를 먼저 차단해 false 반환, `trySessionRestore` 는 메서드 자체가 없어 TypeError)
- GREEN: `feat(06-04): redefine unattended-login guard from mode to external-request condition (D-03)` — 31/31 통과
- REFACTOR: 불필요(구현이 이미 최소·명확) — 별도 커밋 없음

---
*Phase: 06-ui*
*Completed: 2026-08-26*
