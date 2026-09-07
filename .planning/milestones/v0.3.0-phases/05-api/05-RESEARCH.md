# Phase 5: API 로그인 핵심 흐름 + 토큰 교환 검증 - Research

**Researched:** 2026-08-25
**Domain:** Electron 메인 프로세스 — 헤드리스 BrowserWindow 로그인에서 계정 토큰을 확보하는 두 가지 배관(쿠키 열거 / CDP 응답 캡처) + 이미 구현된 account→fanevent 토큰 사다리(`acquireFaneventToken()`) 검증
**Confidence:** MEDIUM — Electron 쿠키/디버거 API 자체는 설치된 `electron.d.ts`로 직접 검증(HIGH)했으나, 이 phase의 핵심 미지수(계정 토큰 쿠키의 실제 이름, `we2_access_token`/계정 토큰이 정말 JWT 형태인지, `by-access-token` 성공 응답 스키마)는 여전히 실계정 스파이크 없이는 확인 불가능하다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 재설계 전제 — 확정된 사실

05-01 실계정 스파이크 + 사용자 제공 HAR(436 entries)로 확정된 실제 로그인 계약.
`PROJECT.md`의 "검증된 API 계약" 표와 `05-RESEARCH.md`의 번들 역공학 결론은 이 지점에서
실제 동작과 어긋난다. **아래가 정본이다.**

| 항목 | 문서상 전제 (무효) | HAR 실측 (정본) |
|---|---|---|
| 로그인 단계 | `otp-sessions` → `by-credentials` → `by-credentials-with-otp` | `by-credentials` **단독** |
| `otpSessionId` 필드 | OTP 세션 ID (36자 UUID) | **reCAPTCHA Enterprise 토큰 (2489자)** |
| 이메일 OTP | 매 로그인 강제 | 흐름에 **존재하지 않음** (호출 0건) |
| `-25044` | "이메일 OTP 인증 필요" | "캡차 토큰 없음/무효" |
| `otp-sessions` 응답 `expiresIn` | 존재 가정 | **absent** (실서버 응답에 없음) |

**귀결:** 순수 HTTP만으로는 `by-credentials`를 통과할 수 없다. reCAPTCHA가 API 모드의 실제 게이트다.

#### 플랜 처리
- **D-01:** 기존 `05-01-PLAN.md`(halted) / `05-02-PLAN.md`(blocked)는 무효 전제 위에 있으므로
  이번 CONTEXT.md 기준으로 **재작성**한다. 05-02의 "OTP 재발송·만료(expiresIn) 처리" 태스크는
  대상 세션이 실재하지 않으므로 그대로 부활시키지 않는다.

#### account 토큰 확보 경로
- **D-02:** 헤드리스 BrowserWindow 로그인(`auth-service.ts:212` `credentialLogin()`)으로
  실제 로그인 페이지가 캡차를 처리하게 하고, 거기서 account 토큰을 확보한다.
  **쿠키 우선 + 응답 캡처 폴백:**
  1. `persist:weverse` 쿠키 파티션에서 account 토큰 쿠키를 조회 (현재
     `extractTokenFromCookies()`는 `we2_access_token` 하나만 읽으므로 확장 필요)
  2. 쿠키에 없으면 헤드리스 창의 `webRequest`/`webContents`로
     `POST /v4/auth/token/by-credentials`의 200 응답에서 `accessToken`을 캡처
  - 근거: 쿠키 이름/존재 여부는 미확인이라 단독 의존이 위험하고, 응답에 `accessToken`(427자)이
    있다는 것은 HAR로 확인된 사실이므로 폴백이 확실하다. 스파이크 1회로 두 질문을 동시에 해소한다.
  - **Reversibility:** reversible — 토큰 확보 지점만 바뀌는 국소 변경. `ApiAuthClient` 셸과
    사다리 로직은 이 선택과 무관하게 그대로 유지된다.

#### R019 사다리 검증 범위
- **D-03:** `acquireFaneventToken()`의 **rung1 + rung2 전체**를 검증한다.
  - rung1: account 토큰 단독으로 `GET /fans/me`(`fanevent-v2.weverse.io`) 직접 호출
  - rung2: rung1 실패 시 `by-access-token` 교환 후 `/fans/me` 재시도
  - 브라우저 경로가 이미 `we2_access_token`을 쿠키로 내주지만, 사다리 검증의 가치는 **미래에
    순수 HTTP 로그인 경로가 열릴 때를 대비한 것**이다. 그래서 direct 경로도 함께 확인한다.
  - `acquireFaneventToken()` 구조는 이미 이 형태이므로 로직 재작성이 아니라 **입력 공급**만 필요하다.

#### 작업 성격
- **D-04:** 이번 phase는 **스파이크**다. 검증하고 결과를 문서화하는 것이 산출물이며,
  코드는 검증에 필요한 최소한으로 유지한다. "API 모드 = 헤드리스 브라우저로 account 토큰 확보
  + 이후 순수 HTTP"로 제품 경로를 확정하는 결정은 **사다리 결과를 본 뒤** 별도로 내린다.
  - 근거: 마일스톤 최대 리스크(R019)를 조기에 걷어내는 것이 원래 Phase 05의 의도였고,
    사다리가 실패하면 API 모드 정의 자체가 다시 바뀌므로 그 위에 제품 코드를 쌓지 않는다.
  - **Reversibility:** reversible — 스파이크 산출물은 문서와 최소 배선이라 폐기 비용이 낮다.

#### 요구사항 정리
- **D-05:** `REQUIREMENTS.md`를 실측에 맞게 정정한다.
  - **R018 (이메일 OTP 코드 입력 및 인증)** → status를 `blocked`/`unverified`로 내리고
    사유 명시: *"HAR상 실제 로그인 흐름에 OTP 단계가 존재하지 않음(호출 0건). 캡차 실패 시
    폴백 경로로만 존재할 가능성이 남아 있으나 05-01 실계정 스파이크에서 OTP 메일 미수신 —
    미입증."* Phase 05 매핑에서 해제.
  - **R017 (API 3단계 자격증명 로그인)** → Description의 "3단계"(`otp-sessions` →
    `by-credentials`) 서술을 위 실측 계약 표로 교체. 요구사항 자체는 유지하되 전제를 정정.
  - 근거: 문서가 반증된 계약을 계속 "검증됨"으로 주장하는 상태를 먼저 끝낸다. 다음 실행자가
    같은 함정에 빠지는 것을 막는 것이 스파이크보다 우선한다.
  - **Reversibility:** reversible — 문서 상태 변경.

#### 실계정 프로브 안전장치
- **D-06:** **실계정 로그인은 사용자가 직접 수행한다.** Claude는 배선·분석·로그 판독만 맡고
  자격증명(이메일/비밀번호)을 직접 다루지 않는다.
  - 배경: 05-01에서 두 건의 실사용 피해가 발생했다 — (1) `tryAutoLogin()` API 모드 게이트
    누락으로 저장된 **다른 계정**에 헤드리스 로그인이 시도되어 알림 메일 발송,
    (2) 실행자가 사용자의 실제 이메일(`os.kwon935@gmail.com`)로 외부 API를 호출.
  - **비협상 기준선 (사용자 선택 여부와 무관):** Claude 측에서 실서버 프로브가 필요하면
    사용자 식별자와 무관한 더미 이메일(`*@example.com` 등)만 사용한다. 착수 전 플랜 단계에서
    이를 명시적으로 확인한다.
  - **선택되지 않은 안전장치 (기록용):** 스파이크 전 `credentials.enc` 선삭제, 프로브 1회
    제한·재시도 금지. 사용자가 선택하지 않았으므로 플랜에 강제하지 않는다.

#### 잔존 자산 처리
- **D-07:** `ApiAuthClient`의 무효 계약 기반 메서드(`requestOtpSession`,
  `loginWithCredentials`, `submitOtpApi`)는 **스파이크 동안 그대로 둔다.** 사다리 결과가
  나오고 API 모드 정의가 확정된 뒤 일괄 정리한다.
  - 근거: 지금 지우면 캡차 실패 폴백 경로를 재확인할 때 다시 써야 한다. D-04(스파이크 우선)와 일관.

### Claude's Discretion
- 사다리 검증을 어떤 형태로 남길지(문서/회귀 테스트/제품 코드) — 사용자가 별도 논의를
  선택하지 않았으므로 planner 재량. 단 D-04(최소 코드)를 벗어나지 않을 것.
- account 토큰 쿠키의 실제 이름 탐색 방법, `webRequest` 훅의 구체적 배선 지점 — 구현 세부.

### Deferred Ideas (OUT OF SCOPE)
- **사다리 실패 시 분기 결정** — rung1·rung2가 모두 실패하면 R019가 반증되고 v0.3.0 API 모드
  정의 자체가 위태로워진다. 허용 경로(마일스톤 축소 / API 모드 폐기 / 재조사)를 미리 정하지
  않기로 함. 사다리 결과가 나온 뒤 판단.
- **스파이크 산출물 형식** — 문서만 / 회귀 테스트까지 / 제품 코드로 유지. planner 재량으로 남김(D-04 범위 내).
- **Phase 06/07 영향 정리** — R018 보류가 Phase 06 Success Criteria 2("매 로그인마다 이메일 OTP
  필요" 사전 고지)와 Phase 07의 자격증명 저장 전제를 바꾼다. Phase 05 종료 후 정리.
- **API 모드 제품 경로 확정** — D-04에 따라 사다리 결과를 본 뒤 별도 결정.
- **`ApiAuthClient` 무효 메서드 정리** — D-07에 따라 스파이크 종료 후 일괄 처리.
- **로그아웃 UI 갭** — `credentials.enc`를 앱에서 지울 수 없는 문제. Phase 07(자격증명 저장 정책) 후보.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|--------------------|
| R019 | account 토큰 → 팬이벤트 토큰(`we2_access_token`) 교환 (이 phase의 실질적 목표) | Architecture Patterns(Pattern 1~3), Validation Architecture의 R019 행, Pitfall 3/4가 사다리 입력 확보와 rung1/rung2 검증 방법을 다룸. `acquireFaneventToken()`은 이미 구현·테스트됨(Don't Hand-Roll) — 이 research는 유효한 입력을 어떻게 확보하는지에 집중. |
| R017 | API 자격증명 로그인 (D-05에 따라 Description의 "3단계" 서술을 HAR 실측 계약으로 교체 대상 — `by-credentials` 단독, `otpSessionId`=캡차 토큰) | State of the Art 표가 구/신 계약 대조표를 제공, Validation Architecture에 REQUIREMENTS.md 정정 검증 행 포함. 이 phase는 R017의 로그인 로직 자체를 다시 구현하지 않는다(헤드리스 경로가 이미 동작 중) — 문서 정정만 해당. |
| R018 | 이메일 OTP 코드 입력 및 인증 — **D-05에 따라 status `blocked`/`unverified`로 내리고 Phase 05 매핑에서 해제.** 이 research는 R018을 위한 구현 지침을 제공하지 않는다. | 해당 없음 — REQUIREMENTS.md 정정만 필요(Validation Architecture 표의 R017 행 참고, R018은 문서 정정 대상이지 구현 대상이 아님). |
</phase_requirements>

## Summary

이 phase는 더 이상 "API 3단계 로그인 구현"이 아니다. `05-01-SUMMARY.md`가 사용자 제공 HAR(436 entries)로 확정한 대로, 실제 `by-credentials` 요청의 `otpSessionId` 필드는 OTP 세션 ID가 아니라 reCAPTCHA Enterprise 토큰이며, 순수 HTTP로는 이 필드를 채울 방법이 없다(R013 — 캡차 우회 영구 제외). 따라서 이 phase는 **"이미 캡차를 스스로 처리하는, 실제로 동작 중인 헤드리스 브라우저 로그인에서 계정 토큰을 뽑아내, 이미 구현되어 있는 `acquireFaneventToken()` 사다리(rung1 direct / rung2 exchange)를 실계정으로 검증하는 스파이크"**로 재정의됐다.

기술적으로 새로 필요한 것은 두 가지뿐이다. (1) `session.fromPartition("persist:weverse").cookies.get({})`로 파티션의 **모든** 쿠키를 열거해 계정 토큰으로 보이는 쿠키를 찾는 경로, (2) 쿠키에 없을 경우를 대비해 `webContents.debugger` + Chrome DevTools Protocol(`Network.getResponseBody`)로 `POST /v4/auth/token/by-credentials`의 200 응답 바디에서 `accessToken`을 직접 캡처하는 폴백 경로. 두 API 모두 설치된 Electron 33.4.11의 타입 정의(`node_modules/electron/electron.d.ts`)에서 이 세션이 직접 읽어 확인했다. `acquireFaneventToken()` 사다리 자체(rung1 `/fans/me` 직접 호출, rung2 `by-access-token` 교환 후 재시도)는 `api-auth-client.ts`에 이미 완성되어 있고 17개 단위 테스트로 커버되어 있다 — 로직을 새로 짤 필요는 없고, 유효한 계정 토큰이라는 **입력**만 공급하면 된다.

가장 큰 리스크는 코드가 아니라 **미검증 가정**이다. 계정 토큰 쿠키의 실제 이름은 알려져 있지 않다(현재 `extractTokenFromCookies()`는 `we2_access_token` 하나만 조회한다 — 계정 토큰과 다른 쿠키다). `by-access-token` 교환의 성공 응답 스키마와 `X-ACC-SERVICE-ID`(departure) 올바른 값은 05-RESEARCH(구)에서 번들 역공학 + 라이브 프로브로 MEDIUM 신뢰도까지만 확인됐고 200 성공 응답은 한 번도 관찰되지 않았다. 계정 토큰/교환된 토큰이 실제로 JWT(점 3개 형태) 구조인지도 미확인이다. 이 research는 이 미지수들을 코드로 감추지 않고 **로그로 드러내는 스파이크 배선**을 설계하는 데 집중한다.

**Primary recommendation:** `AuthService.credentialLogin()`(헤드리스, `auth-service.ts:212`)이 이미 하는 일(캡차를 실제 로그인 페이지가 처리하고 로그인을 완료하는 것)은 그대로 두고, 그 성공 시점에 (a) `persist:weverse` 파티션의 전체 쿠키를 열거해 계정 토큰 후보를 로그로 남기고, (b) 실패 시 로그인 창의 `webContents.debugger`를 `by-credentials` POST 직전에 attach해 응답 바디를 캡처하는 두 경로를 **모두 배선**하되 최소 코드로 유지하고(D-04), 확보된 토큰을 기존 `acquireFaneventToken()`에 그대로 흘려 넣어 rung1/rung2 결과를 로그로 관찰한다. 실계정 로그인 자체는 사용자가 수행한다(D-06) — Claude는 배선·로그 판독만 한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 실계정 로그인 수행(자격증명 입력, 캡차 통과) | 사람(사용자) | Browser/Client (헤드리스 BrowserWindow, Chromium 렌더러) | D-06 — 자격증명은 Claude가 다루지 않는다. 렌더러는 실제 weverse 로그인 페이지의 React 앱이 그대로 실행되는 것뿐, autoverse 코드가 아니다. |
| 계정 토큰 확보(쿠키 열거 / CDP 응답 캡처) | API/Backend (Electron main process — `AuthService`) | — | `session.cookies`, `webContents.debugger`는 main 프로세스 전용 API. 렌더러/사람이 아니라 main이 소유해야 하는 유일한 계층. |
| account → fanevent 토큰 사다리(`acquireFaneventToken`) | API/Backend (`ApiAuthClient`, electron 무의존) | — | 순수 HTTP 클라이언트 셸. Electron을 import하지 않는 것이 Pitfall 4의 핵심 — 쿠키 파티션과 절대 섞이면 안 된다. |
| 확보한 토큰으로 신청 수행(`ApplyEngine`) | API/Backend | — | 이미 존재하는 소비자, 이 phase에서 변경 없음(Success Criteria 3). `authService.token` getter 뒤에서만 소비. |
| 신청 결과 UI 표시 | Frontend Server(SSR 아님, Electron 렌더러 React) | — | 이 phase 밖 — `LoginPanel.tsx` 등은 Phase 06 담당. |

## Standard Stack

### Core

이 phase는 **신규 외부 패키지를 추가하지 않는다.** 필요한 API는 모두 이미 설치된 Electron(33.4.11)과 Node.js(v24.14.1, `fetch`/`crypto.randomUUID` 내장) 범위 안에 있다.

| API | 출처 | Purpose | Why Standard |
|---|---|---|---|
| `session.fromPartition("persist:weverse").cookies.get(filter)` | Electron 내장 (`electron.d.ts`) | `persist:weverse` 파티션의 쿠키 열거/조회 | main 프로세스에서 httpOnly 쿠키까지 읽을 수 있는 유일한 공식 API. 이미 `extractTokenFromCookies()`가 이 API를 쓰고 있음(대상만 확장). |
| `webContents.debugger` (CDP) | Electron 내장 (`electron.d.ts`) | 특정 네트워크 응답의 바디를 읽는 유일한 방법 | `webRequest.onCompleted`는 응답 바디를 제공하지 않음(Pitfall 참조) — CDP가 유일한 공식 경로. |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| (없음) | — | — | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `webContents.debugger` + CDP `Network.getResponseBody` | preload 스크립트에 `window.fetch`를 몽키패치해 요청/응답을 가로채는 방식 | preload는 `contextIsolation: true`(현재 헤드리스 창 설정, `auth-service.ts:236`) 하에서도 동작 가능하지만, 로그인 페이지가 `fetch`가 아니라 `XMLHttpRequest`나 다른 네트워크 스택을 쓸 경우 놓칠 수 있다. CDP는 렌더러가 어떤 JS API로 요청했든 네트워크 계층에서 관찰하므로 더 안정적이다 — 이번 phase에서는 CDP를 1차 폴백으로, preload 몽키패치는 채택하지 않는다. |
| 쿠키 열거(`{}`) | 이름을 추측해 `cookies.get({ name: "..." })`로 직접 조회 | 이름을 모르는 상태이므로(D-02 배경) 추측 조회는 실패 시 "이름이 틀렸다"와 "쿠키 자체가 없다"를 구분 못 한다. 전체 열거가 스파이크 목적(발견)에 맞다. |

**Installation:** 불필요 — 신규 의존성 없음.

## Package Legitimacy Audit

**해당 없음.** 이 phase는 신규 외부 패키지를 설치하지 않는다(Electron/Node 내장 API만 사용). 패키지 정당성 검증 절차를 실행할 대상이 없다.

## Architecture Patterns

### System Architecture Diagram

```
[사람 — 실계정 로그인 수행 (D-06)]
   │  이메일/비밀번호 입력, reCAPTCHA는 로그인 페이지가 자체 처리
   ▼
[헤드리스 BrowserWindow] (auth-service.ts:229, 기존 credentialLogin() 그대로)
   │  실제 account.weverse.io 로그인 페이지 실행
   │  POST /v4/auth/token/by-credentials (200, accessToken 포함) ← HAR 확정 경로
   │
   ├─(경로 A: 쿠키)──▶ [session.fromPartition("persist:weverse").cookies.get({})]
   │                     전체 쿠키 열거 → 계정 토큰 후보 판별(길이/형태 휴리스틱)
   │                     성공하면 경로 B 생략
   │
   └─(경로 B: 폴백, 쿠키에 없을 때)──▶ [webContents.debugger + CDP]
                         Network.enable → Network.responseReceived(by-credentials)
                         → Network.getResponseBody(requestId) → JSON.accessToken 추출

   [계정 토큰 확보] (경로 A 또는 B 중 먼저 성공한 것)
   ▼
[ApiAuthClient.acquireFaneventToken(accountAccessToken)] (api-auth-client.ts:289, 이미 구현됨 — 입력만 공급)
   │
   ├─ rung1: GET /fans/me (Authorization: Bearer <계정 토큰> 그대로) ──▶ 200이면 종료(source="direct")
   │
   └─ rung1 401 시 rung2:
         POST /v2/auth/token/by-access-token (Authorization: Bearer <계정 토큰>, X-ACC-SERVICE-ID: weverse, body {targetServiceId:"weverse"})
         → 교환된 accessToken으로 GET /fans/me 재시도 ──▶ 200이면 종료(source="exchange")

   [팬이벤트 토큰 확보 또는 FANEVENT_TOKEN_UNAVAILABLE]
   ▼
[AuthService.cachedToken] ← authService.token getter
   ▼
[ApplyEngine] (apply-engine.ts:55,146,323 — authService.token만 읽음, 코드 변경 없음 — Success Criteria 3)
```

### Recommended Project Structure

새 파일을 추가할지, `auth-service.ts`에 메서드만 얹을지는 Claude's Discretion(CONTEXT.md)이지만, 테스트 가능성 관점에서의 권고:

```
src/main/services/
├── auth-service.ts            # 기존. credentialLogin()은 변경 없음. 성공 후 토큰 캡처 훅만 추가.
├── api-auth-client.ts         # 기존. acquireFaneventToken() 변경 없음 — 입력 공급만.
└── (선택) account-token-capture.ts  # 신규 — 순수 판별 로직만 분리하면 Electron mock 없이 단위 테스트 가능
    - pickAccountTokenCookie(cookies: Electron.Cookie[]): Electron.Cookie | null   ← 순수 함수, 휴리스틱만
    - extractAccessTokenFromResponseBody(body: string): string | null             ← 순수 함수, JSON 파싱만
    (session.cookies.get(...) 호출과 debugger.attach/sendCommand 자체는 auth-service.ts에 얇게 남긴다 —
     Electron API 호출부까지 분리하면 목킹 비용이 커지고 D-04 최소 코드 원칙에 어긋난다)
```

### Pattern 1: 전체 쿠키 열거로 미지의 토큰 쿠키 찾기

**What:** 이름을 모르는 쿠키를 찾기 위해 빈 필터로 파티션 전체를 열거한다.
**When to use:** D-02 경로 A — 계정 토큰 쿠키명이 확인되지 않은 상태에서 최초 탐색.
**Evidence:** `[VERIFIED: node_modules/electron/electron.d.ts:19020-19025]` — `CookiesGetFilter.url` 필드 주석: *"Retrieves cookies which are associated with `url`. Empty implies retrieving cookies of all URLs."* 이 주석은 `url` 필터를 설명하지만, `get({})`(모든 필드 생략)로 호출하면 사실상 파티션 내 전체 쿠키가 반환된다는 것이 이 타입 정의와 기존 `extractTokenFromCookies()`가 `{ name: "we2_access_token" }`만 넘겨 부분집합을 받는 대조로 확인된다.
**Domain 매칭:** `[VERIFIED: node_modules/electron/electron.d.ts:19030-19033]` — `domain` 필드 주석: *"Retrieves cookies whose domains match or are subdomains of `domains`."* 즉 `domain: ".weverse.io"`로 필터링하면 `account.weverse.io`도 포함될 가능성이 있으나, **로그인이 `account.weverse.io`에서 일어나므로 토큰 쿠키가 그 도메인에만 스코프되어 `.weverse.io`로 안 잡힐 위험이 있다 — 그래서 domain 필터를 아예 생략하고 전량 열거해야 한다.**
**httpOnly 가시성:** `[VERIFIED: node_modules/electron/electron.d.ts:6691-6694]` — 반환되는 `Cookie` 객체에 `httpOnly?: boolean` 필드가 존재한다: *"Whether the cookie is marked as HTTP only."* 이 필드가 응답에 노출된다는 것 자체가, main 프로세스의 `session.cookies.get()`이 httpOnly 쿠키의 **값까지** 반환한다는 근거다(렌더러의 `document.cookie`와 달리 main 프로세스는 이 제약을 우회한다 — Electron의 잘 알려진 설계).

```typescript
// 설계 예시 — 정확한 판별 휴리스틱은 실측 없이 확정 불가 (ASSUMED, 스파이크로 검증 대상)
const ses = session.fromPartition("persist:weverse");
const allCookies = await ses.cookies.get({}); // 파티션 전체, 도메인/이름 필터 없음
logService.info(
  "AuthService",
  `accountTokenDiscovery: found ${allCookies.length} cookies — ` +
    allCookies.map(c => `${c.name}(domain=${c.domain},len=${c.value?.length ?? 0},httpOnly=${c.httpOnly})`).join(", "),
);
// 후보 판별: we2_access_token이 아니면서 값 길이가 account accessToken(HAR 관측 427자)에 근접하고
// account.weverse.io 계열 도메인에 스코프된 쿠키. 정확한 이름/도메인은 미지수 — 이 로그가 1차 산출물.
```

### Pattern 2: CDP로 특정 POST 응답 바디 캡처 (쿠키 폴백)

**What:** `webContents.debugger`를 붙여 `by-credentials` 요청의 200 응답 바디에서 `accessToken`을 직접 읽는다.
**When to use:** D-02 경로 B — 경로 A(쿠키)에서 후보를 찾지 못했을 때만.
**Evidence — attach/message 패턴:** `[CITED: electronjs.org/docs/latest/api/debugger]` (WebFetch 요약, seam 신뢰도 LOW — 아래 `[VERIFIED]` 타입 정의로 핵심 부분 교차 확인함):
```javascript
win.webContents.debugger.attach('1.1')
win.webContents.debugger.on('message', (event, method, params) => { /* ... */ })
win.webContents.debugger.sendCommand('Network.enable')
```
**Evidence — detach 조건:** `[VERIFIED: node_modules/electron/electron.d.ts:6959-6962]` — `Debugger.on('detach', ...)` 주석 원문: *"Emitted when the debugging session is terminated. This happens either when `webContents` is closed or devtools is invoked for the attached `webContents`."* → 헤드리스 창은 `show: false`(`auth-service.ts:232`)라 사람이 DevTools를 여는 경로는 없지만, 코드가 실수로 `openDevTools()`를 호출하면 캡처가 조용히 끊긴다 — 이 스파이크 코드에는 `openDevTools()` 호출을 추가하면 안 된다.
**Evidence — `getResponseBody`:** `[CITED: chromedevtools.github.io/devtools-protocol (Network.getResponseBody)]` — 파라미터는 `requestId`(문자열) 하나, 반환값은 `{ body: string, base64Encoded: boolean }`. `requestId`는 `Network.responseReceived` 이벤트의 파라미터에서 얻는다.
**미확인 타이밍 이슈 (`[ASSUMED]`):** CDP의 일반적 관례상 `getResponseBody`는 `Network.responseReceived` 직후가 아니라 `Network.loadingFinished`(또는 `loadingFailed`) 이후에 호출해야 body가 완전히 채워져 있다고 알려져 있으나, 이번 세션에서 이 특정 순서 요구사항을 1차 문서로 직접 확인하지 못했다. 구현 시 `responseReceived`에서 `requestId`만 저장하고, `loadingFinished` 이벤트를 받은 뒤 `getResponseBody`를 호출하는 순서로 배선할 것을 권고한다(안전한 기본값).

```typescript
// 설계 예시 — attach는 loadURL(LOGIN_URL) 직전에 해야 by-credentials 요청을 놓치지 않는다
const dbg = win.webContents.debugger;
try {
  dbg.attach("1.3");
} catch (err) {
  logService.warn("AuthService", `accountTokenCapture: debugger attach 실패 — ${String(err)}`);
  // 쿠키 경로(A)만으로 진행. 스파이크를 중단시키지 않는다.
}

let capturedRequestId: string | null = null;
dbg.on("message", (_event, method, params) => {
  if (method === "Network.responseReceived" && params.response?.url?.includes("/v4/auth/token/by-credentials")) {
    capturedRequestId = params.requestId;
  }
  if (method === "Network.loadingFinished" && params.requestId === capturedRequestId) {
    dbg.sendCommand("Network.getResponseBody", { requestId: params.requestId })
      .then((result: { body: string; base64Encoded: boolean }) => {
        const parsed = JSON.parse(result.body) as { accessToken?: string };
        if (parsed.accessToken) {
          logService.info("AuthService", `accountTokenCapture(CDP): accessToken len=${parsed.accessToken.length}`);
          // maskToken()으로만 로그 — 원문 절대 로그 금지
        }
      })
      .catch((err) => logService.error("AuthService", `getResponseBody 실패: ${String(err)}`));
  }
});
dbg.sendCommand("Network.enable").catch((err) => logService.warn("AuthService", `Network.enable 실패: ${String(err)}`));
```

### Pattern 3: 사다리 입력만 교체 (로직은 그대로)

**What:** `finishApiLogin()`(`auth-service.ts:613-650`)이 이미 `acquireFaneventToken()`을 호출해 rung1/rung2를 시도하고 `cachedToken`을 설정하는 전체 흐름을 갖추고 있다.
**Evidence:** `[VERIFIED: src/main/services/auth-service.ts:613-650]` — 해당 메서드는 이미 "account-login success alone never sets cachedToken" 주석(611행)과 함께, `acquireFaneventToken(tokens.accessToken)` 호출 → 성공 시에만 `this.cachedToken = token` 대입 구조를 갖고 있다.
**When to use:** 스파이크 배선의 마지막 단계 — 경로 A/B로 확보한 계정 토큰 문자열을 `this.apiClient.acquireFaneventToken(capturedAccountToken)`에 그대로 넣는다. `finishApiLogin()` 자체를 재작성할 필요가 없다 — 다만 현재 `finishApiLogin`은 `AccountTokens` 타입(`{ accessToken, refreshToken?, ... }`)을 받으므로, 캡처 경로가 순수 문자열 하나만 반환한다면 `{ accessToken: capturedToken }` 형태로 감싸 호출한다.

### Anti-Patterns to Avoid

- **CDP 캡처를 위해 `webRequest.onCompleted`를 시도하는 것:** 이 API는 요청 메타데이터(URL, 상태 코드, 헤더)만 제공하고 응답 바디는 제공하지 않는다 — 응답 바디가 필요한 이 phase의 요구사항을 충족하지 못한다. CDP `Network.getResponseBody`가 유일한 공식 경로다.
- **경로 B(CDP)를 로그인 페이지 로드 이후에 attach하는 것:** `by-credentials` 요청은 로그인 버튼 클릭 즉시 발생한다(HAR 관측). `win.loadURL(LOGIN_URL)` 이전에 `debugger.attach()` + `Network.enable`을 완료해 두지 않으면 요청을 놓친다.
- **계정 토큰과 fanevent 토큰을 같은 쿠키 이름으로 취급하는 것:** `we2_access_token`은 fanevent 토큰(최종 산출물)이고, 계정 토큰은 그 이전 단계 산출물로 **다른 이름의 쿠키**일 가능성이 높다(또는 쿠키로 전혀 노출되지 않을 수도 있다 — 그래서 경로 B가 필요하다). `extractTokenFromCookies()`를 계정 토큰 탐색에 그대로 재사용하면 안 된다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| 계정 토큰 → fanevent 토큰 사다리 로직 | 새 교환/재시도 상태 머신 | `ApiAuthClient.acquireFaneventToken()` (기존, `api-auth-client.ts:289`) | 이미 구현·단위 테스트됨(rung1/rung2, 17개 테스트). D-03이 요구하는 구조가 그대로 이 코드다 — 입력만 다르면 된다. |
| JWT `exp` 파싱/만료 판정 | 새 JWT 디코더 | `AuthService.isTokenExpired()` (기존, `auth-service.ts:966-992`) | base64url 디코드 + `exp` 클레임 비교를 이미 구현. 파싱 실패 시 `false`(만료 아님)로 안전하게 폴백하는 방어 로직까지 포함. |
| 민감정보 로그 마스킹 | 새 정규식/마스킹 함수 | `shared/mask.ts`의 `maskToken()`/`SENSITIVE_PATTERNS` (기존, `password`/`otpCode` 이미 포함) | 캡처한 계정 토큰을 로그에 남길 때도 반드시 `maskToken()`을 통과시킨다 — 원문 로그는 R010 위반. |
| CDP 프로토콜 클라이언트 | 자체 WebSocket/CDP 래퍼 | `webContents.debugger` (Electron 내장) | Electron이 이미 CDP 세션을 프로세스 내부에서 관리 — 별도 포트/프로세스 없이 안전하게 attach 가능. |

**Key insight:** 이 phase에서 "새로 만들어야 하는 것"은 사실상 없다. `acquireFaneventToken()`, `isTokenExpired()`, `maskToken()`, `finishApiLogin()` 모두 05-01에서 이미 완성됐다. 유일한 신규 코드는 "계정 토큰을 어디서 뽑아오는가"라는 배관 부분(경로 A/B)뿐이다 — 이것이 D-04("최소 코드")가 성립하는 이유다.

## Common Pitfalls

### Pitfall 1: 쿠키 도메인 필터를 좁게 걸어 계정 토큰 쿠키를 놓친다
**What goes wrong:** `extractTokenFromCookies()`의 기존 패턴을 그대로 복사해 `{ domain: ".weverse.io", name: "..." }`처럼 좁게 필터링하면, `account.weverse.io`에만 스코프된 쿠키가 안 잡힌다.
**Why it happens:** 로그인은 `account.weverse.io`에서 일어나지만(`LOGIN_URL`, `auth-service.ts:15-16`), 기존 코드는 전부 `we2_access_token`(최종 fanevent 토큰, `weverse.io` 계열)만 다뤄왔기 때문에 도메인 습관이 그쪽으로 굳어 있다.
**How to avoid:** Pattern 1처럼 도메인/이름 필터 없이 `{}`로 전량 열거한다.
**Warning signs:** 열거된 쿠키 수가 0이거나 `we2_access_token` 하나뿐이면 필터가 여전히 좁혀져 있다는 신호.

### Pitfall 2: CDP 캡처가 조용히 실패하는데 스파이크가 이를 감지 못한다
**What goes wrong:** `debugger.attach()`가 예외 없이 성공했다고 착각하거나, `detach` 이벤트를 무시하면 `by-credentials` 응답을 놓쳐도 아무 로그가 안 남는다.
**Why it happens:** `attach()`는 이미 다른 디버거가 붙어 있으면 throw하고(`[CITED: electronjs.org/docs/latest/api/debugger]`), devtools가 열리면 `detach` 이벤트가 발생한다(`[VERIFIED: electron.d.ts:6959-6962]`) — 둘 다 명시적으로 핸들링하지 않으면 "캡처 시도는 했지만 아무것도 못 얻음" 상태가 "시도조차 안 함"과 로그상 구분이 안 된다.
**How to avoid:** `attach()`를 try/catch로 감싸고, `on('detach', ...)`을 등록해 사유를 로그로 남긴다. 캡처 시도가 최소 1건이라도 `Network.responseReceived`를 관측했는지 별도로 로그해, "요청 자체를 못 봤다"와 "요청은 봤지만 body 파싱 실패"를 구분한다.
**Warning signs:** `capturedRequestId`가 끝까지 `null`이면 요청을 못 본 것 — attach 타이밍(Pattern 2 Anti-Pattern 참고)을 의심한다.

### Pitfall 3: 계정 토큰/교환된 토큰이 JWT가 아닐 수 있다는 것을 무시한다
**What goes wrong:** `isTokenExpired()`를 호출해 만료 판정을 신뢰하지만, 토큰이 실제로 점 3개짜리 JWT가 아니면 이 함수는 `false`(만료 아님)를 반환하고 조용히 넘어간다.
**Why it happens:** 05-RESEARCH(구)의 가정 A4("교환된/로그인 토큰이 JWT 형태")가 지금까지 한 번도 실측 확인되지 않았다(`[VERIFIED: .planning/phases/05-api/05-RESEARCH.md:403]` — 원문: *"A4 | 교환된/로그인 토큰이 JWT 형태이며 기존 `isTokenExpired()`(exp 클레임 파싱)로 만료 판정이 가능하다"*, 신뢰도는 표에 기재되지 않았으나 이후 실계정 검증 없이 넘어감). `we2_access_token` 자체가 JWT인지도 R001 통과만으로는 증명되지 않는다 — `isTokenExpired()`가 파싱 실패 시 안전하게 `false`로 폴백하기 때문에, JWT가 아니어도 앱이 "정상 동작하는 것처럼" 보일 수 있다.
**How to avoid:** 기존 `validateToken()`의 진단 로그 패턴을 재사용한다 — `[VERIFIED: src/main/services/auth-service.ts:858-861]` 원문: `const tokenParts = this.cachedToken.split(".");` / `const tokenPrefix = this.cachedToken.slice(0, 20);` / `logService.info("AuthService", \`validateToken: token shape — parts=${tokenParts.length} prefix=${tokenPrefix}... len=${this.cachedToken.length}\`);` — 이 세 줄과 동일한 형태를 계정 토큰과 교환된 토큰 각각에 대해서도 찍어, 스파이크 로그만으로 "이게 실제로 JWT인가"를 사후에 판단할 수 있게 한다.
**Warning signs:** `parts=1`(점이 아예 없음)이면 JWT가 아니라 불투명(opaque) 토큰일 가능성이 높다 — Phase 07의 R022(토큰 잔여 수명 체크)가 이 경우 무력화된다는 것을 미리 기록해 둘 가치가 있다(이 phase 범위 밖, Deferred 후보).

### Pitfall 4: `by-access-token` 교환의 성공 스키마/departure 값을 검증된 사실처럼 다룬다
**What goes wrong:** `exchangeForService()`(`api-auth-client.ts:211-228`)가 이미 구현돼 있다는 이유로 이 계약이 확정된 것으로 착각하기 쉽다.
**Why it happens:** 05-RESEARCH(구)는 이 엔드포인트의 **존재**와 **인증 단계까지 요청이 통과한다는 것**은 실서버 라이브 프로브로 확인했지만(`[VERIFIED: 원 문서 121행 인용]` 아래 참고), **200 성공 응답은 유효한 계정 토큰이 없어 한 번도 관찰하지 못했다** — `targetServiceId: "weverse"` 값도, `X-ACC-SERVICE-ID`(departure) 값도 여전히 MEDIUM/LOW 신뢰도다.
**How to avoid:** 스파이크 로그에 rung2 시도의 정확한 요청/응답(코드/메시지, 토큰은 마스킹)을 남긴다. rung2도 실패하면 다음 시도값으로 `X-ACC-SERVICE-ID`를 바꿔보는 것을 "이 phase의 다음 스텝"이 아니라 "관찰된 사실"로 문서화한다 — 코드를 억지로 통과시키려 하지 않는다(D-04 스파이크 정신).
**Warning signs:** rung2가 -26000/401을 반환하면 departure 값이 원인 후보 1순위.

### Pitfall 5: 실계정 이메일 대신 더미 이메일 규칙을 스파이크 코드에만 걸고 사람이 수행하는 실제 로그인에는 강제하지 않는다
**What goes wrong:** D-06의 "더미 이메일만 사용" 규칙은 **Claude(에이전트)가 스스로 실서버를 프로브할 때만** 적용된다. 사람이 직접 수행하는 실계정 로그인 자체는 당연히 실제 이메일을 쓴다. 이 둘을 혼동해 사람의 실계정 로그인 흐름에까지 더미 이메일 검증 로직을 끼워 넣으면 스파이크가 성립하지 않는다.
**Why it happens:** D-06 배경의 실제 사고(05-01에서 실행자가 `os.kwon935@gmail.com`으로 `otp-sessions`를 직접 curl 호출)는 **에이전트가 스스로** 외부 API를 호출한 사례였다 — 사람이 앱 UI로 로그인한 것이 아니었다.
**How to avoid:** 계획 단계에서 "에이전트가 직접 실행하는 모든 curl/fetch/스크립트"와 "사람이 앱을 통해 수행하는 로그인"을 명확히 분리해 문서화한다. 전자에만 `*@example.com` 더미 규칙을 건다.
**Warning signs:** 태스크 설명에 "Claude가 로그인 API를 curl로 호출"이라는 표현이 있으면 즉시 더미 이메일 여부를 체크리스트로 확인한다.

## Code Examples

Pattern 1/2/3 섹션의 코드가 이 phase의 검증된 패턴 예시다. 아래는 세 경로를 하나로 묶는 상위 흐름 스케치(설계 예시, 미검증 부분은 주석으로 표시):

```typescript
// auth-service.ts 확장 스케치 — 실제 배선 세부는 planner/executor 재량 (Claude's Discretion, CONTEXT.md)
private async captureAccountToken(win: BrowserWindow): Promise<string | null> {
  // 경로 B(CDP)는 loadURL 이전에 준비돼야 by-credentials 요청을 놓치지 않는다
  const capture = this.setupResponseCapture(win); // Pattern 2

  // ... 기존 credentialLogin()의 폼 입력/버튼 클릭 로직 그대로 ...

  // 경로 A: 로그인 성공(토큰 쿠키 감지) 후 전체 쿠키 열거
  const fromCookies = await this.discoverAccountTokenCookie(); // Pattern 1
  if (fromCookies) return fromCookies;

  // 경로 B 폴백: CDP가 캡처한 값
  return capture.getCapturedAccessToken(); // null 가능 — 그러면 스파이크는 "실패, 원인 미상"으로 로그하고 종료
}
```

## State of the Art

| 구 계약(무효, 문서에 아직 남아있을 수 있음) | 실측 정본(HAR, `05-01-SUMMARY.md`) | 변경 시점 | Impact |
|---|---|---|---|
| `otp-sessions` → `by-credentials` → `by-credentials-with-otp` 3단계 로그인 | `by-credentials` **단독** (`otpSessionId` 필드 = reCAPTCHA Enterprise 토큰) | 2026-08-25 (05-01 halt) | 순수 HTTP 로그인 경로 자체가 성립하지 않음 — 헤드리스 브라우저가 유일하게 동작하는 경로. |
| 이메일 OTP가 매 로그인 강제 | 실제 흐름에 OTP 단계가 **존재하지 않음**(호출 0건) | 2026-08-25 | R018을 이 phase에서 unmapped/blocked 처리(D-05). |
| `-25044` = "OTP 필요" | `-25044` = "캡차 토큰 없음/무효" | 2026-08-25 | R020(에러 코드 한국어 매핑, Phase 06)의 -25044 설명도 영향받음 — 이 phase 밖이지만 기록. |
| `otp-sessions` 응답에 `expiresIn` 존재 가정 | 실서버 응답에 `expiresIn` 없음 (`OtpSession.expiresIn` 필드는 항상 `undefined`) | 2026-08-25 | `api-auth-client.ts`의 `OtpSession` 타입은 이미 `expiresIn?: number`(optional)로 방어돼 있음 — 추가 수정 불필요. |
| Phase 05 목표: "3단계 로그인 구현" | Phase 05 목표: "이미 동작하는 헤드리스 로그인에서 토큰을 뽑아 사다리 검증" (R019 우선) | 2026-08-25 (CONTEXT.md D-02~D-04) | 이 phase의 모든 코드 작업이 로그인 구현이 아니라 토큰 캡처 배관 + 관측으로 축소됨. |

**Deprecated/outdated:**
- `ApiAuthClient.requestOtpSession()` / `loginWithCredentials()` / `verifyOtp()`(옛 3단계 로그인 메서드) — D-07에 따라 스파이크 동안은 코드에 **남겨두되 호출하지 않는다.** 삭제는 사다리 결과 확정 후.
- `AuthService.credentialLoginApi()` / `submitOtpApi()`(`auth-service.ts:543-606`) — 위 옛 메서드를 호출하는 상위 진입점. 동일하게 남겨두되, 이 phase의 스파이크 배선은 이 메서드들을 경유하지 않고 `credentialLogin()`(헤드리스) 경로에 직접 훅을 건다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | CDP `getResponseBody`는 `Network.responseReceived` 직후가 아니라 `Network.loadingFinished` 이후에 호출해야 body가 완전하다 | Pattern 2 | 틀리면 body가 비어있거나 파싱 실패 — Pitfall 2의 "요청은 봤지만 파싱 실패" 케이스로 이어짐. loadingFinished 대기로 완화 가능한 저위험. |
| A2 | 계정 토큰 쿠키의 존재 여부와 이름은 실측 전까지 알 수 없다(쿠키로 전혀 노출되지 않을 수도 있음) | Pattern 1 / D-02 배경 | 틀리면(쿠키가 아예 없으면) 경로 A가 항상 빈 결과를 반환하고 경로 B(CDP)가 유일한 경로가 됨 — 이미 이중 경로로 설계했으므로 스파이크 자체는 견딤. |
| A3 | `by-access-token` 응답의 필드 스키마(`accessToken`/`refreshToken`/`serviceUserId`/`expiresIn`)가 `by-credentials` 응답과 동일하다 | Pattern 3 / `AccountTokens` 타입 재사용 | 틀리면 `exchangeForService()`의 반환 타입 캐스팅이 실제 필드를 놓칠 수 있음 — 스파이크 로그에서 rung2 원본 응답 키 목록을 반드시 남겨 확인해야 함(구 `requestOtpSession()`의 관측성 패턴을 재사용할 가치 있음). |
| A4 | `X-ACC-SERVICE-ID`(departure) 값 `"weverse"`가 교환 요청에 올바른 값이다 | Pitfall 4 | 이미 05-RESEARCH(구)에서 LOW 신뢰도로 플래그됨(A1, 구 문서). 틀리면 rung2가 -26000/401로 계속 실패 — 대체 departure 후보 실험이 다음 단계로 필요. |
| A5 | 계정 토큰/교환된 토큰이 JWT(점 3개) 구조다 | Pitfall 3 | 틀려도 `isTokenExpired()`가 안전하게 폴백하므로 이 phase 자체는 깨지지 않지만, Phase 07(R022, 토큰 수명 사전 경고)의 전제가 흔들림 — 이 phase가 확보한 로그가 Phase 07 계획의 입력이 돼야 함. |

**이 표가 비어있지 않은 이유:** 이 phase의 성격 자체가 "미검증 가정을 실계정으로 검증하는 스파이크"이므로, 모든 핵심 계약이 확인 전까지 `[ASSUMED]`로 남는 것이 정상이다. 05-01의 실패가 바로 이 표를 만들지 않고(혹은 만들었어도 무시하고) 코드를 진행한 결과였다.

## Open Questions

1. **계정 토큰 쿠키의 실제 이름은 무엇인가?**
   - What we know: `we2_access_token`은 fanevent 토큰이지 계정 토큰이 아니다. 계정 토큰이 쿠키로 노출된다면 다른 이름일 것이다.
   - What's unclear: 그런 쿠키가 존재하는지 자체가 불확실하다(존재하지 않고 응답 바디로만 전달될 수도 있음).
   - Recommendation: Pattern 1의 전체 열거 로그가 1차 답이다. 이 phase의 스파이크 실행 자체가 이 질문에 대한 실험이다.

2. **`by-access-token` 200 성공 응답의 정확한 필드 스키마는?**
   - What we know: 엔드포인트가 실존하고 `Authorization` 헤더를 요구한다는 것은 확인됨(구 05-RESEARCH, 라이브 프로브).
   - What's unclear: 유효한 계정 토큰으로 실제 호출했을 때의 200 응답 필드 전체 목록.
   - Recommendation: rung2가 실행되면(rung1이 실패하는 경우) 응답 키 목록을 반드시 로그로 남긴다(A3 참고).

3. **rung1(직접 사용)이 성공할 가능성은 얼마나 되는가?**
   - What we know: CONTEXT.md D-03은 두 rung을 모두 검증하라고 명시한다 — 이는 사용자가 이미 "브라우저 경로는 어차피 we2_access_token 쿠키를 직접 내주므로, rung1이 통할 가능성은 낮다"고 예상하고 있다는 뜻으로 읽힌다(D-03 원문 참고).
   - What's unclear: 그래도 rung1을 시도할 가치(미래 순수 HTTP 로그인 경로 대비)는 D-03에 이미 정당화되어 있다.
   - Recommendation: rung1 실패를 "버그"가 아니라 "예상된 관찰"로 취급하고 로그로만 남긴다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 헤드리스 BrowserWindow, `session.cookies`, `webContents.debugger` | ✓ | 33.4.11 (package.json 선언: `^33.3.1`) `[VERIFIED: node_modules/electron/package.json]` | — |
| Node.js | 빌드/테스트 실행, 내장 `fetch`/`crypto.randomUUID` | ✓ | v24.14.1 `[VERIFIED: node --version, 이 세션]` | — |
| vitest | 단위 테스트 프레임워크 | ✓ | ^4.1.6 (package.json) | — |
| Chrome DevTools Protocol (Electron 내장 Chromium) | Pattern 2 응답 캡처 | ✓ (Electron에 내장, 별도 설치 불필요) | Electron 33.4.11의 Chromium 버전에 대응 — 정확한 CDP 버전은 실측 확인 안 함 `[ASSUMED — 실행 시 debugger.attach()가 성공하면 호환된다고 간주]` | — |
| 실계정 이메일 계정(OTP 등 관련 없음, 캡차 확인용) | D-06 사람 수행 로그인 | 사용자 소유 — 이 세션에서 확인 대상 아님 | — | — |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** 없음 — 모든 필요한 API/런타임이 이미 설치·설정되어 있다.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.6 `[VERIFIED: package.json]` |
| Config file | `vitest.config.ts` (프로젝트 루트) |
| Quick run command | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts src/main/services/__tests__/auth-service.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| R019 (rung1) | 계정 토큰을 그대로 `/fans/me`에 써서 200이 오면 direct 성공 처리 | unit (fetch mock, 이미 존재) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "acquireFaneventToken"` | ✅ (`api-auth-client.test.ts`, 17개 테스트 중 일부) |
| R019 (rung2) | rung1 401 시 `by-access-token` 교환 후 재시도, 성공 시 exchange 처리 | unit (fetch mock, 이미 존재) | 위와 동일 파일, 같은 `-t` 필터 | ✅ |
| R019 (신규) | 전체 쿠키 열거에서 계정 토큰 후보를 올바르게 판별한다 | unit (신규 — `session.cookies.get` 목) | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "accountTokenDiscovery"` | ❌ Wave 0 — 판별 로직을 순수 함수로 분리해야 목킹 없이 테스트 가능 |
| R019 (신규) | CDP 응답 바디 JSON에서 `accessToken`을 올바르게 추출한다 | unit (신규 — 순수 파싱 함수, Electron mock 불필요) | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "extractAccessTokenFromResponseBody"` | ❌ Wave 0 |
| R019 (핵심, 자동화 불가) | 실계정으로 계정 토큰 확보 → 사다리 통과 → `/fans/me` 200 | manual (`checkpoint:human-verify`) | 해당 없음 — 실계정 + 사람의 로그인 수행 필요(D-06) | 해당 없음 |
| R017 (설명 정정, D-05) | REQUIREMENTS.md의 3단계 서술을 실측 계약으로 교체 | 문서 검증 (자동화 대상 아님) | `grep -c "otp-sessions.*by-credentials.*by-credentials-with-otp" .planning/REQUIREMENTS.md`가 0이어야 함 | 해당 없음 |
| Success Criteria 3 | `ApplyEngine`이 `authService.token`을 코드 변경 없이 소비 (회귀) | unit (기존 커버) | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ✅ |

### Sampling Rate

- **Per task commit:** `npx vitest run src/main/services/__tests__/api-auth-client.test.ts src/main/services/__tests__/auth-service.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** 전체 스위트 green **AND** R019 실계정 체크포인트의 로그 산출물 확보(둘 다 필요 — 아래 참고)

**이 phase 고유의 Nyquist 제약:** R019의 결정적 신호(실계정 사다리 통과 여부)는 **반복 가능한 자동 테스트가 아니라 1회성 사람 관찰**이다(연구 질문 6). 표준 샘플링 주기(태스크마다 quick run, 웨이브마다 full suite)는 위 표의 자동화 가능한 항목(쿠키 판별 로직, CDP 파싱 로직, 사다리 자체)에는 그대로 적용되지만, R019의 최종 판정은 이 반복 주기 밖에서 **한 번** 일어난다. 플래너는 이 체크포인트를 다른 자동화된 태스크들과 같은 웨이브에 두되, "실패해도 재시도 가능한 자동 테스트"처럼 취급하면 안 된다 — 실패 시 사다리 자체가 R019를 반증하는 결과이므로 즉시 문서화하고 중단(halt) 절차를 밟아야 한다(05-01의 halt 절차가 이미 이 프로젝트의 선례).

### Wave 0 Gaps

- [ ] 계정 토큰 후보 판별 로직(전체 쿠키 목록 → 후보 하나)을 순수 함수로 분리 — `session.cookies.get` 목 없이 테스트 가능해야 함
- [ ] CDP 응답 바디 JSON 파싱 로직을 순수 함수로 분리 — `debugger.sendCommand` 목 없이 테스트 가능해야 함
- [ ] `src/main/services/__tests__/auth-service.test.ts`에 위 두 순수 함수에 대한 케이스 추가(기존 파일 확장, Electron mock 패턴 재사용)
- [ ] `checkpoint:human-verify` 태스크 — R019 핵심 판정, Wave 0(또는 마지막 웨이브)에 배치, 더미 이메일 규칙(D-06) 준수 여부를 태스크 설명에 명시
- [ ] 프레임워크 설치: **불필요** — vitest 이미 설치됨

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | 실계정 자격증명은 사람이 헤드리스 로그인 페이지에 직접 입력한다(D-06) — Claude 측 코드는 비밀번호 문자열을 절대 다루지 않는다. 기존 `saveCredentials()`(safeStorage 암호화)는 변경 없이 재사용. |
| V3 Session Management | yes | 캡처한 계정/fanevent 토�큰의 만료 판정은 `isTokenExpired()`(기존) 재사용 — 새 세션 관리 로직을 만들지 않는다. |
| V4 Access Control | 부분 적용 | 단일 계정 모델(R012 다계정 금지, out-of-scope)이 이미 강제됨. 이 phase는 추가 접근 제어를 도입하지 않지만, 잘못된 계정으로 로그인이 트리거되지 않도록 `resolveLoginMode()` 가드(defect A, 05-01)를 약화시키지 않는다. |
| V5 Input Validation | yes | 에이전트가 직접 실행하는 모든 실서버 프로브는 착수 전 이메일이 `*@example.com` 패턴인지 검증한다(D-06 비협상 기준선) — 사람이 앱으로 수행하는 실계정 로그인에는 해당 없음(Pitfall 5 참고). |
| V6 Cryptography | yes | JWT `exp` 클레임 파싱(`isTokenExpired()`)만 재사용, 서명 검증은 하지 않음(기존과 동일 — 이 phase가 새로 도입하는 암호화 관련 코드 없음). 캡처한 토큰 값을 로그에 남길 때는 `maskToken()` 필수. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| 캡처한 계정 토큰/응답 바디를 로그에 원문으로 남김 | Information Disclosure | `maskToken()`/`SENSITIVE_PATTERNS`(기존, `shared/mask.ts`)를 캡처 로그 경로에도 예외 없이 적용. 응답 바디 전체를 `JSON.stringify`해 로그로 남기지 않는다(길이/키 목록만). |
| 잘못된(저장된 다른) 계정으로 헤드리스 로그인이 자동 트리거됨 | Elevation of Privilege / 사용자 피해 (05-01 defect A 선례) | `tryAutoLogin()`/`tryAutoRelogin()`의 `resolveLoginMode()` API 모드 가드를 그대로 유지 — 이 phase의 스파이크 배선은 `credentialLogin()`(사람이 명시적으로 트리거)에만 훅을 걸고, 자동 로그인 경로는 건드리지 않는다. |
| `webContents.debugger`가 원격 디버깅 포트/외부 프로세스에 노출됨 | Elevation of Privilege | `debugger.attach()`는 프로세스 내부 CDP 세션이며 네트워크 포트를 열지 않는다 — 별도 `--remote-debugging-port` 플래그를 이 스파이크에서 추가하지 않는다. IPC로 debugger 제어권을 렌더러에 노출하지 않는다. |
| 에이전트가 실서버 프로브에 실제 사용자 이메일을 재사용함(05-01 Process Issue 선례) | Information Disclosure / 사용자 피해 | D-06 비협상 기준선 — 착수 전 더미 이메일(`*@example.com`) 체크리스트 확인을 태스크 자체에 명시. |

## Sources

### Primary (VERIFIED — 이 세션에 직접 Read/실행하여 확인)
- `.planning/phases/05-api/05-01-SUMMARY.md` — HAR 확정 로그인 계약, 무효화된 전제, 실사용 피해 경위 (전문 정독)
- `.planning/phases/05-api/05-CONTEXT.md` — D-01~D-07 락인 결정, Claude's Discretion, Deferred Ideas
- `src/main/services/auth-service.ts` — `credentialLogin()`(212), `extractTokenFromCookies()`(678), `isTokenExpired()`(966), `finishApiLogin()`(613), BrowserWindow 생성(229) 전문 정독
- `src/main/services/api-auth-client.ts` — `acquireFaneventToken()`(289), `exchangeForService()`(211), `probeFaneventToken()`(230) 전문 정독
- `node_modules/electron/electron.d.ts:19020-19050` (`CookiesGetFilter`), `:6672-6716`(`Cookie`), `:6955-6995`(`Debugger`) — Electron 33.4.11 실제 타입 정의
- `node_modules/electron/package.json` — 설치된 Electron 버전 33.4.11 확인
- `package.json` — vitest ^4.1.6, electron ^33.3.1 선언 확인
- `.planning/phases/05-api/05-RESEARCH.md`(구, 이번에 덮어쓰기 대상) — `by-access-token` 발견 절(11, 96-153행)만 인용, 절차 1~4단계는 무효로 취급
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/05-api/05-PATTERNS.md`, `.planning/phases/05-api/05-VALIDATION.md` — 전문 정독
- `src/main/services/apply-engine.ts` (grep 확인) — `authService.token` 소비 지점 3곳(55, 146, 323행)

### Secondary (CITED — 공식 문서, WebFetch 요약으로 확인 후 상당 부분 위 VERIFIED 소스로 교차 확인)
- [electronjs.org/docs/latest/api/cookies](https://www.electronjs.org/docs/latest/api/cookies) — `session.cookies.get()` 필터/도메인 매칭 설명 (핵심 문구는 `electron.d.ts`로 교차 확인 완료)
- [electronjs.org/docs/latest/api/debugger](https://www.electronjs.org/docs/latest/api/debugger) — `attach`/`sendCommand`/`on('message')` 사용 패턴, detach 조건(핵심 문구는 `electron.d.ts`로 교차 확인 완료)
- [chromedevtools.github.io/devtools-protocol (Network.getResponseBody)](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-getResponseBody) — 파라미터/반환 스키마

### Tertiary (LOW confidence — 교차 확인 안 됨, 검증 대상으로 명시)
- CDP `getResponseBody`가 `loadingFinished` 이후에 호출돼야 한다는 타이밍 규칙 (A1, Assumptions Log) — 훈련 지식, 1차 문서로 이번 세션에 직접 확인 못함

## Metadata

**Confidence breakdown:**
- Electron 쿠키/CDP API 메커니즘 자체: HIGH — 설치된 `electron.d.ts`를 직접 읽어 확인
- 계정 토큰 쿠키 존재/이름, `by-access-token` 성공 스키마, 토큰의 JWT 여부: LOW — 실계정 없이는 검증 불가, 이 phase의 스파이크가 검증 대상 그 자체
- 사다리 로직(`acquireFaneventToken`) 자체: HIGH — 이미 구현되고 단위 테스트된 기존 코드를 그대로 재사용

**Research date:** 2026-08-25
**Valid until:** 이 phase의 스파이크 결과가 나오는 즉시 재검토 필요(추정 유효기간 없음 — 실계정 검증이 이 문서의 핵심 미지수를 대체해야 함). Electron API 부분은 30일 기준으로 안정적.
