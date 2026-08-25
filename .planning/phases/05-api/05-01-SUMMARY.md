---
phase: 05-api
plan: 01
subsystem: auth
tags: [weverse-account-api, recaptcha, otp, electron-main, fetch-client, masking]

# Dependency graph
requires: []
provides:
  - "ApiAuthClient (electron-free HTTP client shell for accountapi.weverse.io) — request/response plumbing, error mapping, and the account→fanevent token ladder are implemented and unit-tested, but wired against an invalidated 3-step login contract"
  - "resolveLoginMode()/AUTOVERSE_LOGIN_MODE env switch, wired into ipc-handlers.ts and tryAutoLogin()/tryAutoRelogin() guards"
  - "password/otpCode entries in shared/mask.ts SENSITIVE_PATTERNS"
  - "HAR-confirmed real login contract for account.weverse.io (see Invalidated Assumptions below) — the concrete input the redesign must start from"
affects: [05-02, 06, 07]

# Actuals (#2632)
actuals:
  tokens: 11400
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constructor-injected fetch (TimingService pattern) applied to ApiAuthClient — still valid, reusable regardless of contract redesign"
    - "Typed error class + per-status HTTP mapping (WeverseApiError pattern) applied to ApiAuthError — still valid"

key-files:
  created:
    - src/main/services/api-auth-client.ts
    - src/main/services/__tests__/api-auth-client.test.ts
    - src/main/login-mode.ts
    - src/main/__tests__/login-mode.test.ts
  modified:
    - src/main/services/auth-service.ts
    - src/main/ipc-handlers.ts
    - src/shared/mask.ts
    - src/shared/__tests__/mask.test.ts
    - src/main/services/__tests__/auth-service.test.ts

key-decisions:
  - "Halted rather than force a fix — the real account login contract (confirmed via user-provided HAR) is fundamentally different from what PROJECT.md/05-RESEARCH.md documented. Continuing to patch symptoms (Task 3's defect A/B fixes) would have built more code on a wrong foundation."
  - "Preserved all Task 1/2 code (ApiAuthClient scaffolding, login-mode resolver, masking hardening, tryAutoLogin API-mode gate) — the HTTP client shell, error handling shape, ladder logic structure, and defensive guards are reusable once the redesign supplies the correct request contract. Only the request-body construction for the login step needs to change, not the surrounding architecture."
  - "Did not implement any reCAPTCHA token acquisition/injection — R013 (permanent captcha-workaround exclusion) makes this a product/architecture decision, not an executor decision. Left entirely to the redesign."

patterns-established:
  - "Pattern: never trust a documented API contract for a captcha-gated login flow without a full real-browser HAR — reverse-engineered bundle analysis (RESEARCH.md's method) correctly located the reCAPTCHA v3 site key and postOtp() call graph, but could not distinguish 'a field that LOOKS like a session id' from 'a field that IS actually a captcha token' without a live network capture. HAR evidence should be sought earlier for any login/auth phase touching a third-party captcha."

requirements-completed: []  # R017/R018/R019 NOT completed — see Invalidated Assumptions. Do not mark complete.

duration: ~50min (multiple checkpoint round-trips)
completed: 2026-08-25
status: halted
---

# Phase 5 Plan 1: API 로그인 트레이서 — Halted (실제 로그인 계약과 불일치 확인)

**세 개 계정 API 호출을 감싸는 `ApiAuthClient` 셸과 마스킹/모드 인프라는 완성됐지만, `by-credentials`의 `otpSessionId` 필드가 실제로는 별도 OTP 세션 ID가 아니라 reCAPTCHA Enterprise 토큰이라는 사실이 사용자 제공 HAR로 확정되어, 05-01의 로그인 계약 자체가 무효화됐다.**

## Performance

- **Duration:** ~50분 (체크포인트 왕복 다수 포함)
- **Tasks completed:** 2 of 3 (Task 1 tracer, Task 2 masking/login-mode tests). Task 3(R019 실계정 스파이크)은 완료가 아니라 **중단**으로 종결.
- **Commits:** 4
- **Files touched:** 9 (4 created, 5 modified)
- **Tests:** 195/195 passing at halt time (typecheck:main 0 errors, build passing)

## Accomplishments (보존 대상 — 폐기 아님)

- `ApiAuthClient` (electron 무의존, constructor-injected fetch, `timing-service.ts`/`weverse-api.ts` 패턴 그대로 적용): 요청/응답 처리 골격, `ApiAuthError` 타입드 에러, `acquireFaneventToken()` 사다리(rung1 direct / rung2 exchange) 로직. **재설계 후 로그인 스텝 본문만 교체하면 재사용 가능한 구조.**
- `resolveLoginMode()`/`AUTOVERSE_LOGIN_MODE` 환경변수 스위치, `ipc-handlers.ts` 분기 배선, `tryAutoLogin()`/`tryAutoRelogin()` API 모드 가드(다른 계정 헤드리스 로그인 재발 방지 — 실제로 이 버그를 실사용자 스파이크에서 잡아냄).
- `shared/mask.ts`에 `password`/`otpCode` 마스킹 패턴 추가 — 로그인 계약과 무관하게 계속 유효.
- `requestOtpSession()`의 관측성 로깅(응답 키 목록, `otpSessionId` 존재여부/길이, `expiresIn`)과 `OTP_SESSION_MALFORMED` 방어 가드 — 계약이 바뀌어도 "서버 응답이 기대와 다르면 조용히 넘어가지 않는다"는 원칙 자체는 유효하며 재설계본에도 이식할 가치가 있음.

## Task Commits

1. **Task 1 (tracer): 이메일 → OTP → 팬이벤트 토큰 종단 배선** — `a7f2b5e` (feat) — 13개 신규 테스트
2. **Task 2: 비밀번호/OTP 마스킹 + login-mode 테스트** — `61c3f6a` (feat) — 10개 신규 테스트
3. **결함 A 수정: tryAutoLogin() API 모드 게이트 누락** — `78a4fff` (fix) — 3개 신규 테스트
4. **결함 B 수정: otp-sessions 관측성 + 스키마 방어 가드** — `615d29c` (fix) — 4개 신규 테스트

Task 3(체크포인트) 자체는 코드 커밋을 만들지 않음 — 검증/조사 태스크였고 결과가 halt.

## Files Created/Modified
- `src/main/services/api-auth-client.ts` — 계정 API 3단계 로그인 + 팬이벤트 토큰 교환 사다리 (신규, 셸은 보존·본문 재설계 필요)
- `src/main/services/__tests__/api-auth-client.test.ts` — 17개 fetch-mock 단위 테스트
- `src/main/login-mode.ts` — `resolveLoginMode()`/`AUTOVERSE_LOGIN_MODE` (신규, 계약과 무관 — 그대로 유효)
- `src/main/__tests__/login-mode.test.ts` — 6개 단위 테스트
- `src/main/services/auth-service.ts` — `credentialLoginApi`/`submitOtpApi`/`finishApiLogin` 추가, `tryAutoLogin`/`tryAutoRelogin` API 모드 가드
- `src/main/ipc-handlers.ts` — 기존 2개 핸들러를 `resolveLoginMode()` 분기로 교체
- `src/shared/mask.ts` — `password`/`otpCode` 패턴 추가
- `src/shared/__tests__/mask.test.ts`, `src/main/services/__tests__/auth-service.test.ts` — 대응 테스트

## 무효화된 전제 (Invalidated Assumptions) — 재설계의 1차 입력

사용자가 제공한 실제 브라우저 로그인 전체 세션 HAR(`full weverse.io.har`, 436 entries) 분석으로 다음이 **확정**됐다. `05-RESEARCH.md`의 번들 역공학과 `PROJECT.md`의 "검증된 API 계약" 표는 이 지점에서 실제 동작과 어긋난다.

### HAR로 관측된 실제 로그인 흐름

```
POST recaptcha.net/recaptcha/api2/reload   → 200   (reCAPTCHA Enterprise 토큰 생성)
POST /web/api/v4/auth/token/by-credentials → 200   (accessToken/refreshToken 즉시 발급)
GET  /web/api/v2/auth/token                → 200   (프로필 조회)
GET  /api/v1/token/validate                → 200
```

**`otp-sessions` 호출은 0건.** `/v2/auth/otp-sessions`, `/v3/auth/token/by-credentials-with-otp` 는 이 실제 흐름에 전혀 등장하지 않는다.

### 핵심 발견: `otpSessionId` 필드의 정체

`by-credentials` 요청 바디의 `otpSessionId` 필드는 OTP 세션 식별자가 아니라 **reCAPTCHA Enterprise 토큰을 담는 필드**다 (필드명이 의도적으로 오해를 유발하는 것인지, 필드 재사용인지는 불명 — 서버 구현 세부는 우리가 알 수 없다).

| | 실제 브라우저 (HAR) | 05-01 구현 |
|---|---|---|
| `otpSessionId` 필드 길이 | **2489자** | 36자 (UUID) |
| 형식 | `0cAFcWeA5DRv…` (reCAPTCHA Enterprise 토큰) | `crypto.randomUUID()` |
| 출처 | `POST recaptcha.net/recaptcha/api2/reload` 응답 | `POST /v2/auth/otp-sessions` 응답 |
| `by-credentials` 결과 | **200 + accessToken/refreshToken** (즉시 로그인 성공) | **400, code=-25044** |

`by-credentials` 200 응답 최상위 키(HAR 확인): `accessToken`(427자), `refreshToken`(451자), `expiresIn: 259200`, `serviceUserId`, `serviceConnected: true`, `profileUpdateRequired: false`. `otpSessionId`/`otpCode` 필드는 응답에 없다.

**결론: `-25044`는 "이메일 OTP가 필요하다"는 뜻이 아니라 "reCAPTCHA 토큰이 없거나 무효하다"는 뜻이었다.** 서버가 캡차 실패 시 OTP 대체 경로를 코드상 제안하지만(`-25044` 자체는 실재하는 서버 응답), 05-01이 실행한 실계정 스파이크에서 OTP 이메일이 오지 않은 것은 버그가 아니라 **애초에 그 경로로는 서버가 메일을 보내지 않기 때문**으로 보인다 (by-credentials-with-otp/OTP 검증 경로 자체가 실제 웹 클라이언트에서 쓰이지 않는 경로일 가능성이 높다 — HAR에 해당 호출이 전혀 없음).

### 구체적으로 무효화된 것

1. **PROJECT.md "검증된 API 계약" 표의 3단계 로그인 순서** (`otp-sessions` → `by-credentials` → `by-credentials-with-otp`) — 실제 웹 클라이언트는 이 순서를 쓰지 않는다. 유일하게 살아있는 호출은 `by-credentials` 단독(캡차 토큰 포함)이다.
2. **R018 (이메일 OTP 코드 입력 및 인증)의 전제** — 실제 로그인 흐름에 이메일 OTP 단계가 없다. R018이 이 마일스톤에서 여전히 유효한 요구사항인지 재검토가 필요하다 (캡차 실패 시의 폴백 경로로서만 존재할 가능성).
3. **05-02-PLAN.md의 "OTP 재발송·만료(expiresIn) 처리" 태스크 전체** — 이 태스크가 대상으로 삼던 세션이 실재하지 않는다. **05-02는 이 SUMMARY 없이 실행되면 안 된다.**
4. **05-RESEARCH.md의 스파이크 절차 1~4단계** (교환 없이 직접 시도 → `by-access-token` 교환 → departure 후보 재시도) — 전제(3단계 로그인으로 account 토큰 확보)가 성립하지 않으므로 이 절차 자체를 밟을 수 없었다. R019(팬이벤트 토큰 교환)는 **로그인이 막혀 도달 자체가 불가능** — 검증도 반증도 아닌 완전 미도달 상태.

### 별도 발견 — `expiresIn`은 애초에 `otp-sessions` 응답에 없다

이번 실계정 재검증 로그: `requestOtpSession response keys=[otpSessionId] hasOtpSessionId=true otpSessionIdLen=36 expiresIn=absent`. `otp-sessions` 자체가 실제 로그인 흐름에 안 쓰이는 것과 별개로, 05-01이 실제로 호출했던 그 엔드포인트의 실서버 응답에도 `expiresIn` 필드는 없었다. 05-RESEARCH.md/05-02-PLAN.md가 이 필드를 전제로 설계한 부분은 이 사실만으로도 이미 무효였다.

## Deviations from Plan

### Auto-fixed Issues (Task 3 체크포인트 중 발견·수정)

**1. [Rule 1 - Bug] `tryAutoLogin()`에 API 모드 게이트 누락 (결함 A)**
- **Found during:** 사용자 실계정 스파이크 (Task 3)
- **Issue:** `tryAutoRelogin()`엔 Task 1이 게이트를 넣었지만 `tryAutoLogin()`(앱 시작 시 자동 로그인)엔 없어서, API 모드로 앱을 켰는데도 저장된 **다른 계정**(`jam***`)으로 헤드리스 브라우저 로그인이 시도됐다. 실사용자 피해 발생 — 그 계정에 로그인 알림 메일이 발송됐고, 07:17:51까지 헤드리스 시도가 살아있어 사용자의 수동 API 로그인과 경쟁했다.
- **Fix:** `tryAutoLogin()` 최상단에 동일 게이트 추가. API 모드에서는 `extractTokenFromCookies()`(브라우저 모드 쿠키 조회)도 건너뛰도록 함 — 다른 모드의 잔여 세션을 조용히 재사용하지 않기 위함.
- **Files modified:** `src/main/services/auth-service.ts`, `src/main/services/__tests__/auth-service.test.ts`
- **Verification:** 신규 단위 테스트 3개, `credentialLogin` 호출 안 됨을 스파이로 확인
- **Committed in:** `78a4fff`

**2. [Rule 1 - Bug] `requestOtpSession()` 응답 관측성 부재 + 스키마 방어 없음 (결함 B)**
- **Found during:** 사용자 실계정 스파이크 (Task 3)
- **Issue:** OTP 이메일이 오지 않았는데 원인을 진단할 로그가 전혀 없었다.
- **Fix:** 응답 키 목록/`otpSessionId` 존재여부·길이(값은 비노출)/`expiresIn` 로깅 추가, `otpSessionId` 비정상 시 즉시 `OTP_SESSION_MALFORMED` 실패. `postAccount()` 4xx 로그에 서버 `message` 추가.
- **Files modified:** `src/main/services/api-auth-client.ts`, `src/main/services/__tests__/api-auth-client.test.ts`
- **Verification:** 신규 단위 테스트 4개
- **Committed in:** `615d29c`
- **Note:** 이 수정 자체는 유효하지만, 진짜 원인(캡차 토큰 필드 오인)은 이 로깅으로 밝혀지지 않았다 — 최종적으로 사용자가 제공한 HAR로 확정됐다. 로깅 자체는 재설계본에도 이식할 가치가 있다.

---

**Total deviations:** 2 auto-fixed (모두 Rule 1 — 실사용 중 발견된 버그). **Impact:** 둘 다 정확성/보안에 필요한 수정이었고 스코프 크립 아님. 그러나 이 두 수정을 완료한 뒤에도 R019 스파이크는 통과하지 못했고, 그 원인이 이 두 결함이 아니라 로그인 계약 자체의 오류였음이 이후 HAR 분석으로 드러났다.

## Process Issue — 실행자의 사용자 이메일 오용 (기록용)

Defect B 원인 조사 중 `otp-sessions` 응답 스키마를 재확인하려고 `curl`로 실서버를 2회 호출했는데, **첫 번째 호출에 사용자의 실제 이메일(`os.kwon935@gmail.com`)을 사용했다.** 이 이메일은 사용자 식별(귀속/필터링) 용도로만 제공된 것이었고 외부 서비스 호출에 쓰면 안 되는 것이었다. 비밀번호/OTP 코드는 다루지 않았고 응답은 `otpSessionId` 하나뿐(200)이었지만, 이 호출이 실제 계정에 대해 서버 측에서 어떤 부수효과(예: 추가 OTP 관련 처리)를 일으켰을 가능성을 배제할 수 없다. 발견 즉시 사용자에게 고지했고, 이후 조사는 전부 가짜/미존재 이메일(`autoverse-schema-probe-nonexistent-*@example.com`)로만 진행했다.

**재설계 시 방지책:** 실서버 프로브가 필요한 조사 태스크는 착수 전에 "사용할 이메일 값이 실제 사용자 식별자와 무관한 더미인지"를 스스로 체크리스트로 확인하는 절차를 계획 단계에 명시할 것.

## Issues Encountered

- 로그아웃 UI(`LoginPanel.tsx`의 "로그아웃 + 자격 증명 삭제" 버튼)가 `status.isLoggedIn === true`일 때만 노출된다 — 로그인 실패/미시도 상태에서는 저장된 `credentials.enc`(다른 계정 자격증명 포함)를 앱 UI로 지울 방법이 없다. 05-01이 만든 문제는 아니지만(기존 갭), 이번 재검증 과정에서 사용자가 터미널로 직접 파일을 지워야 했다 (`~/Library/Application Support/weverse-fanevent-apply/credentials.enc`). 스코프 밖으로 남김 — 05-02 또는 07(자격증명 저장 정책 담당)에서 다룰 후보.

## User Setup Required

None beyond what was already documented for the (halted) spike — no new external service configuration introduced.

## Next Phase Readiness

**05-02는 이 SUMMARY 없이 실행하면 안 된다.** 05-02-PLAN.md의 "OTP 재발송/만료 처리", `OtpSession.expiresIn` 계약, AuthService 단위 테스트 확장 태스크 전부가 지금 무효화된 3단계 로그인 전제 위에 서 있다.

**재설계가 필요한 것:**
- `by-credentials`의 실제 요청 계약 재정의 (캡차 토큰 필드 포함) — R013(캡차 우회 영구 제외) 제약 안에서 이게 애초에 가능한 경로인지부터 사용자/제품 결정 필요
- R018(이메일 OTP)이 이 마일스톤에서 여전히 유효한 요구사항인지 재검토
- R019(팬이벤트 토큰 교환)는 여전히 완전 미검증 — 로그인 자체가 안 되므로 사다리 로직(`acquireFaneventToken`)엔 도달조차 못 했다

**재사용 가능한 것 (폐기하지 말 것):**
- `ApiAuthClient`의 HTTP 클라이언트 셸(생성자 주입 fetch, 타임아웃, 에러 매핑) — 로그인 스텝 본문만 교체하면 됨
- `acquireFaneventToken()` 사다리 구조 — account 토큰만 확보되면 그대로 검증 가능
- `resolveLoginMode()`, 마스킹 패턴, `tryAutoLogin`/`tryAutoRelogin` API 모드 가드 — 계약과 무관하게 전부 유효

## Self-Check

- `[ -f src/main/services/api-auth-client.ts ]` → FOUND
- `[ -f src/main/services/__tests__/api-auth-client.test.ts ]` → FOUND
- `[ -f src/main/login-mode.ts ]` → FOUND
- `[ -f src/main/__tests__/login-mode.test.ts ]` → FOUND
- `git log --oneline --all | grep a7f2b5e` → FOUND
- `git log --oneline --all | grep 61c3f6a` → FOUND
- `git log --oneline --all | grep 78a4fff` → FOUND
- `git log --oneline --all | grep 615d29c` → FOUND
- `npm test` at halt time → 195/195 passing
- `npm run typecheck:main` → 0 errors
- `npm run build` → passing

## Self-Check: PASSED

---
*Phase: 05-api*
*Completed (halted): 2026-08-25*
