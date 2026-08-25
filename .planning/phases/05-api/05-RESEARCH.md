# Phase 05: API 로그인 핵심 흐름 + 토큰 교환 검증 - Research

**Researched:** 2026-08-25
**Domain:** Weverse account API 리버싱 — 자격증명 로그인 3단계 + 계정 토큰 → 팬이벤트 토큰 교환
**Confidence:** MEDIUM (핵심 리스크 R019는 실계정 없이 완전 검증 불가 — 아래 "핵심 리스크" 절 참조)

## Summary

Phase 05는 기존 헤드리스 브라우저 로그인(`AuthService.credentialLogin`)과 별도로, 순수 HTTP(fetch)만으로 로그인을 완료하는 두 번째 경로를 추가한다. 3단계 로그인 계약(otp-sessions → by-credentials → by-credentials-with-otp)은 이미 실서버로 검증되어 `.planning/PROJECT.md`에 정본으로 기록되어 있으므로 이 문서에서 재검증하지 않는다.

이 문서의 핵심은 R019(계정 토큰 → 팬이벤트 토큰 교환)다. `account.weverse.io`의 실제 프로덕션 JS 번들을 다운로드해 역공학한 결과, 다음이 밝혀졌다: 계정 앱은 서비스 간 토큰 교환을 위한 전용 엔드포인트 `POST /web/api/v2/auth/token/by-access-token`를 가지고 있으며, 이 엔드포인트는 실서버에 실제로 존재하고(라이브 프로브로 확인) `Authorization: Bearer <계정 토큰>` + `X-ACC-SERVICE-ID` + JSON body `{targetServiceId}`를 받는다. 이 호출은 **순수 JSON API**이며 쿠키·리다이렉트·브라우저 실행이 필요 없다 — 이는 R019가 헤드리스 브라우저 없이 해결 가능하다는 강력한 근거다. 다만 반환된 `accessToken`이 `fanevent-v2.weverse.io`에서 그대로 `we2_access_token`처럼 동작하는지는 실계정 없이는 최종 검증이 불가능하며, 이는 **명시적으로 실행해야 할 스파이크 실험**으로 아래에 기술한다.

**Primary recommendation:** `POST /v2/auth/token/by-access-token` (body `{targetServiceId:"weverse"}`, header `X-ACC-SERVICE-ID: weverse`, `Authorization: Bearer <accessToken from by-credentials(-with-otp)>`)을 호출해 받은 `accessToken`을 그대로 `AuthService.cachedToken`에 대입하는 순수 HTTP 경로로 구현을 시작하되, Wave 0에 "실계정 스파이크" 태스크를 배치해 (a) by-credentials(-with-otp)가 반환한 토큰을 교환 없이 바로 `/fans/me`에 써보고, 실패하면 (b) `by-access-token` 교환을 거쳐 다시 시도하는 2단계 폴백 검증을 수행한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 3단계 자격증명 로그인 (R017) | API/Backend (Electron main) | — | `auth-service.ts`가 이미 main 프로세스에서 모든 인증 로직을 소유. 렌더러는 IPC로만 접근 |
| OTP 입력 UI (R018) | Browser/Client (renderer) | API/Backend (검증 호출) | 입력 UI는 렌더러, OTP 검증 POST는 main의 새 API 클라이언트가 수행 |
| 계정→팬이벤트 토큰 교환 (R019) | API/Backend (Electron main) | — | 순수 HTTP 교환이므로 브라우저 컨텍스트 불필요 (교환 실패 시 폴백만 브라우저 필요) |
| 신청 엔진 (ApplyEngine) 연동 | API/Backend | — | 코드 변경 없이 `authService.token` getter를 그대로 소비 — 이미 `apply-engine.ts:55,146`에서 확인 |

## User Constraints

이 phase에는 `/gsd-discuss-phase`로 생성된 CONTEXT.md가 없다 (`.planning/phases/05-api/`에 `*-CONTEXT.md` 파일 없음). 따라서 이 절은 생략하고, `.planning/PROJECT.md`의 "검증된 API 계약" 표와 "핵심 제약"을 실질적 락인 제약으로 취급한다:

- Base URL: `https://accountapi.weverse.io/web/api` [VERIFIED: PROJECT.md 2026-08-25 실측]
- 3단계: `POST /v2/auth/otp-sessions` → `POST /v4/auth/token/by-credentials` → `POST /v3/auth/token/by-credentials-with-otp` [VERIFIED: PROJECT.md]
- 필수 헤더 5종 (APP-VERSION, APP-SECRET, SERVICE-ID, LANGUAGE, TRACE-ID) [VERIFIED: PROJECT.md + 이번 세션 번들 재확인, 아래 참조]
- 비밀번호 평문 전송 (클라이언트 암호화 없음) [VERIFIED: PROJECT.md]
- API 모드는 매 로그인마다 OTP 강제, 자동 재로그인 불가 — 브라우저 모드가 기본값 유지 [VERIFIED: PROJECT.md, Key Decision]
- R013 캡차 우회는 영구 제외 — 이 연구에서도 우회 방안을 제안하지 않음

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R017 | 이메일/비밀번호로 위버스 계정 API에 직접 로그인 (otp-sessions → by-credentials) | "Standard Stack", "Code Examples" 절의 `ApiAuthClient` 설계 + 실서버 검증된 요청/응답 필드 |
| R018 | 이메일 OTP 코드 입력 및 인증 (otp-sessions에서 발송, by-credentials-with-otp로 검증) | "OTP UI 흐름" 절 — 기존 `LoginPanel.tsx`/`auth:submit-otp` IPC 재사용 가능 여부 분석 |
| R019 | account 토큰 → 팬이벤트 토큰(we2_access_token) 교환 | "핵심 리스크: 토큰 교환" 절 — `by-access-token` 엔드포인트 발견 + 실서버 프로브 + 스파이크 설계 |

## 핵심 리스크: account 토큰 → 팬이벤트 토큰(we2_access_token) 교환 (R019)

### 조사 방법

`https://account.weverse.io/ko/login/credential?client_id=weverse&v=4` 페이지의 프로덕션 Next.js 번들(빌드ID `Xe_PgvTmjPYuQO_eSFsEX`)을 `curl`로 직접 다운로드해 역공학했다. 로그인 성공 후 컴포넌트(`pages/login/credential-30043a5bf5c86ddc.js`)에서 시작해, `startAuthAccountUpdate` → `/auth/update` 페이지(`pages/auth/update-f3e9f79bf43e59ca.js`) → SSO 교환 페이지(`/sso`, `pages/sso-96cc5f5b76e40832.js`) → 실제 API 호출 모듈(청크 `6175-c264b6482d83bb27.js`)까지 웹팩 모듈 참조(`n(모듈번호)`)를 따라가며 추적했다. 이 방식은 이미 `.planning/PROJECT.md`에 기록된 3단계 로그인 계약을 검증할 때 사용한 것과 동일한 방법이다. **실계정으로 로그인을 시도하지 않았고, 캡차 우회는 설계하지 않았다.**

### 발견 1 — 로그인 완료 후 흐름 (계정 앱 내부)

`pages/login/credential` 청크의 `LoginComplete` 컴포넌트(모듈 67950):
```js
// Source: account.weverse.io bundle, pages/login/credential-30043a5bf5c86ddc.js (2026-08-25 다운로드)
q = function () {
  var e = useRecoilValue(A.tokenResponse),          // by-credentials(-with-otp) 응답이 저장된 atom
      t = useModule21311().startAuthAccountUpdate;
  logEvent("login/complete", { sns_type: "EMAIL", service_user_id: e?.serviceUserId });
  return <RunOnce doSomething={() => t(e)} />;       // startAuthAccountUpdate(tokenResponse)
}
```
`startAuthAccountUpdate` (모듈 21311, 동일 청크 내부):
```js
// Source: 위와 동일, module 21311
startAuthAccountUpdate: (tokenResponse, simpleRedirect) => {
  setAuthTokenAtom(tokenResponse);   // 클라이언트 메모리 상태(Recoil-like)에 저장, 쿠키 아님
  setSimpleRedirectAtom(!!simpleRedirect);
  router.push({ pathname: "/auth/update", query: router.query });  // 같은 오리진 내 클라이언트 사이드 라우팅
}
```
`[CITED: account.weverse.io bundle pages/login/credential-30043a5bf5c86ddc.js]` — 이 시점에서 `by-credentials(-with-otp)` 응답 객체(`tokenResponse`)는 `accessToken`, `serviceUserId`를 최소 포함한다 (동일 응답 shape가 앱 전역 `AuthContextProvider`에서도 `e.accessToken`/`e.serviceUserId`로 소비됨 — 모듈 38644).

### 발견 2 — 실제 서비스 간 토큰 교환 엔드포인트

`/sso` 페이지(모듈 2492, 청크 `sso-96cc5f5b76e40832.js`)가 진짜 교환 로직을 담고 있다:
```js
// Source: account.weverse.io bundle, pages/sso-96cc5f5b76e40832.js (2026-08-25 다운로드)
async function exchangeToken({ departure, accessToken, onSuccess, onFailure }) {
  const { redirectUriPrefixes } = await getServiceConfig(destination); // GET /v3/{serviceId}
  if (!isAllowedRedirectUri(redirectUri, redirectUriPrefixes)) {
    return onFailure("INVALID_REDIRECT_URI");
  }
  try {
    const result = await ES(
      { targetServiceId: destination },
      { headers: { "X-ACC-SERVICE-ID": departure, Authorization: `Bearer ${accessToken}` } }
    );
    onSuccess(result);
  } catch (err) { /* onFailure(...) */ }
}
```
`ES` 함수의 정의(모듈 35688, 청크 `6175-c264b6482d83bb27.js`):
```js
// Source: account.weverse.io bundle, chunk 6175-c264b6482d83bb27.js (2026-08-25 다운로드)
// n.d(n, { DS: ..., ES: function(){return o}, pQ: ..., q2: function(){return i} })
i = createFetch("/web/api/v2/auth/token/by-exchange-key", HttpMethod.POST); // QR/기기 간 로그인 — 이 phase와 무관
o = createFetch("/web/api/v2/auth/token/by-access-token", HttpMethod.POST); // ★ R019가 찾던 교환 엔드포인트
c = createFetch("/web/api/v2/auth/token", HttpMethod.DELETE);              // 로그아웃/토큰 폐기
u = createFetch("/web/api/v2/qr/login-sessions/:sessionId", HttpMethod.PUT);
```
`[CITED: account.weverse.io bundle chunk 6175-c264b6482d83bb27.js]`

**결론: `POST /web/api/v2/auth/token/by-access-token`이 계정 토큰 → 대상 서비스 토큰 교환 엔드포인트다.**
- Base fetch는 다른 모든 계정 API 호출과 동일하게 `https://accountapi.weverse.io`로 고정되어 있다 (모듈 66642 `createBaseFetch("https://accountapi.weverse.io", ...)`) `[CITED: account.weverse.io bundle _app.js module 66642]`.
- 요청 헤더: `Authorization: Bearer <계정 accessToken>`, `X-ACC-SERVICE-ID: <departure>` (교환을 요청하는 출발 서비스), 그 외 5개 공통 헤더(APP-VERSION, APP-SECRET, LANGUAGE, TRACE-ID)는 자동 부착됨.
- 요청 바디: `{ targetServiceId: "weverse" }` — 헤더 상수 enum(모듈 17946)에서 `WEVERSE_ALT = "weverse"`(운영), `WEVERSE = "weverse-test"`(테스트)로 확인됨 `[CITED: account.weverse.io bundle _app.js module 17946]`.

### 발견 3 — 실서버 라이브 프로브로 엔드포인트 존재 및 계약 확인

실계정 없이도 엔드포인트의 존재와 헤더 계약을 검증할 수 있었다:

```bash
# Authorization 헤더 누락
curl -X POST https://accountapi.weverse.io/web/api/v2/auth/token/by-access-token \
  -H "X-ACC-SERVICE-ID: weverse" -d '{"targetServiceId":"weverse"}' ...
# → HTTP 400 {"code":-26000,"message":"[ERROR] 잘못된 API 사용입니다.\nAuthorization header"}

# 잘못된 Bearer 토큰
curl ... -H "Authorization: Bearer invalid-token-test" -d '{"targetServiceId":"weverse"}' ...
# → HTTP 401 {"code":-25000,"message":"유효하지 않거나 만료된 토큰입니다."}
```
`[VERIFIED: accountapi.weverse.io 실서버 라이브 프로브, 2026-08-25]` — 이 두 응답은 (1) 엔드포인트가 실존하고, (2) 서버가 `Authorization` 헤더를 명시적으로 요구하며, (3) `targetServiceId` 필드를 포함한 JSON 바디 형식을 서버가 파싱 단계에서 거부하지 않고 인증 단계까지 통과시킨다는 것(즉 바디 스키마가 번들 추정과 일치)는 것을 실증한다. 유효한 계정 토큰이 없어 200 성공 응답은 관찰하지 못했다.

### 발견 4 — 교환된 토큰이 실제로 `we2_access_token` 쿠키가 되는 경로 (참고용, 우리 구현엔 불필요할 가능성)

`by-access-token` 성공 시 반환값(`accessToken`, `refreshToken`, `serviceUserId`, `expiresIn` 필드 — 모듈 56459 `IH` 함수가 이 4개 필드만 필터링하는 것에서 확인)은 계정 앱에서 다음과 같이 대상 서비스(`weverse.io`)로 전달된다:
```js
// Source: account.weverse.io bundle chunk 6072-e2e22801ed7d7107.js, module 56459
IH = ({ redirectUri, token }) => {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(token).filter(([k]) =>
    ["accessToken","refreshToken","serviceUserId","expiresIn"].includes(k))) {
    url.searchParams.set(camelToSnake(k), v); // access_token, refresh_token, service_user_id, expires_in
  }
  return url;
};
RH = ({ token, url }) => {
  setCookie("wa_access_token", token.accessToken);      // 계정 자신의 도메인 쿠키
  setCookie("wa_service_user_id", token.serviceUserId);
  window.location.replace(url);                          // 전체 페이지 네비게이션
};
```
`[CITED: account.weverse.io bundle chunk 6072-e2e22801ed7d7107.js, module 56459]`

즉 정상적인 웹 흐름에서는 교환된 토큰이 URL 쿼리 파라미터(`access_token=...`)로 `weverse.io`에 전달되고, **weverse.io 자신의 프론트엔드 코드**(이번 조사에서 다운로드하지 않음 — 별도 도메인/번들)가 이를 읽어 `we2_access_token` 쿠키로 저장하는 것으로 추정된다. 이 전달 방식(camelCase→snake_case, URL 쿼리 파라미터 릴레이)은 표준 OAuth 스타일 토큰 릴레이이며, "cookie" 방식 대신 **URL을 통한 순수 값 전달**이라는 점이 중요하다 — 값 자체는 base64/서명 없이 원문 그대로 전달되므로, `by-access-token`이 반환하는 `accessToken` 필드는 **아마도 `we2_access_token` 쿠키에 최종적으로 들어가는 것과 동일한 문자열**이다.

### 결론 및 확신도

| 주장 | 확신도 |
|---|---|
| `POST /web/api/v2/auth/token/by-access-token`가 서비스 간 토큰 교환 엔드포인트다 | HIGH — 번들 코드 + 실서버 라이브 프로브로 이중 확인 |
| 요청 형식: `Authorization: Bearer <계정 토큰>` + `X-ACC-SERVICE-ID: <departure>` + body `{targetServiceId}` | MEDIUM — 번들에서 확인(CITED), 라이브 프로브가 부분 확인(바디 필드명까지는 검증 못함, 토큰 검증에서 막힘) |
| `targetServiceId: "weverse"`가 올바른 값이다 | MEDIUM — enum 상수 `WEVERSE_ALT="weverse"`에서 CITED, 실사용 확인 못함 |
| `departure`(`X-ACC-SERVICE-ID`) 값도 `"weverse"`면 충분하다 | LOW — 이미 로그인 호출 자체가 `X-ACC-SERVICE-ID: weverse`로 이루어지므로 반환된 계정 토큰이 이미 "weverse" 컨텍스트로 스코프됐을 가능성이 있다. 이 경우 교환이 불필요(no-op)하거나 다른 departure 값이 필요할 수 있음 — **미검증** |
| 교환된 `accessToken`이 `fanevent-v2.weverse.io`에서 곧바로 `we2_access_token`과 동등하게 동작한다(Bearer로 사용 가능) | LOW — 논리적으로 강하게 뒷받침되지만(발견 4), 실계정 없이는 확정 불가 |
| `by-credentials(-with-otp)`가 반환하는 토큰 자체가 이미 교환 없이 `fanevent-v2`에서 통하는 경우도 있을 수 있다 | LOW — 아직 검증되지 않은 가설이지만 검증 비용이 가장 저렴하므로 스파이크의 첫 시도로 권장 |

### 권장 스파이크 절차 (Wave 0, 실계정 필요 — 반드시 사람이 실행)

이것은 **자동화 불가능한 checkpoint:human-verify 태스크**로 계획에 포함시켜야 한다. 이유: 실서버 로그인은 실계정 자격증명 + 이메일 OTP 코드 입력을 요구하므로 unit test로 재현할 수 없다.

1. 실계정으로 `POST /v2/auth/otp-sessions` → `POST /v4/auth/token/by-credentials` → (OTP 발송) → `POST /v3/auth/token/by-credentials-with-otp`를 순수 fetch로 호출한다.
2. **1차 시도(가장 저렴)**: `by-credentials-with-otp` 응답의 `accessToken`을 그대로 `Authorization: Bearer <token>`으로 `GET https://fanevent-v2.weverse.io/api/fan-api/v1/fans/me`에 넣어본다. 200이면 R019는 **교환 단계 자체가 불필요** — 가장 단순한 결과.
3. **1차 실패 시(401)**: `POST /web/api/v2/auth/token/by-access-token`을 `Authorization: Bearer <account accessToken>`, `X-ACC-SERVICE-ID: weverse`, body `{"targetServiceId":"weverse"}`로 호출한다. 응답 JSON의 `accessToken`을 다시 2번 방식으로 `/fans/me`에 테스트한다.
4. **2차도 실패 시**: `X-ACC-SERVICE-ID`(departure) 값을 다른 후보(`account`, `wemember` 등 — 정확한 열거값은 번들에 없으므로 실험적으로 시도)로 바꿔가며 재시도한다. 그래도 실패하면 헤드리스 BrowserWindow를 재사용해 `/auth/update` → `/sso` 리다이렉트 체인을 실제로 태우고 최종 `we2_access_token` 쿠키를 추출하는 브라우저 폴백(기존 `credentialLogin`의 쿠키 폴링 로직 재사용, `auth-service.ts:535-551`)으로 대체한다. 이 경우도 여전히 로그인 자체(otp-sessions/by-credentials 3단계)는 순수 HTTP로 하고, 마지막 교환 단계만 숨겨진 BrowserWindow로 완료하는 하이브리드 구조가 가능하다.
5. 성공한 단계와 실패한 단계, 정확한 응답 바디(마스킹 후)를 로그에 남겨 Phase 05 실행 시 재현 가능하게 한다.

**실패 시 예상 추가 소요**: PROJECT.md에 이미 0.5~1일로 견적되어 있음(STATE.md 블로커 항목) — 이 견적은 유지 타당하다.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js 내장 `fetch` | Electron 33 번들 (Chromium/Node 20+) | 3단계 로그인 + 토큰 교환 HTTP 호출 | 이미 `weverse-api.ts`, `timing-service.ts`가 전부 내장 fetch만 사용 — 새 HTTP 라이브러리 도입 불필요 `[VERIFIED: src/main/services/weverse-api.ts:28, src/main/services/timing-service.ts:43]` |
| Node 내장 `crypto.randomUUID()` | Node 20+ (Electron 33 런타임 내장) | `X-ACC-TRACE-ID` 헤더용 UUID 생성 | 코드베이스에 uuid 관련 외부 패키지가 전혀 없음(`grep` 결과 0건) — 내장 API로 충분, 새 의존성 불필요 |

### Supporting

없음 — 이 phase는 새 외부 패키지를 도입하지 않는다.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 내장 `fetch` | `axios`, `node-fetch` | 기존 코드베이스 관례(WeverseApi/TimingService)와 불일치, 불필요한 의존성 추가 |
| `crypto.randomUUID()` | `uuid` npm 패키지 | 외부 의존성 불필요하게 추가 — Node 내장으로 충분 |

**Installation:** 없음 (신규 npm 설치 불필요).

## Package Legitimacy Audit

**해당 없음 — 이 phase는 신규 외부 패키지를 설치하지 않는다.** `fetch`와 `crypto.randomUUID()` 모두 Node.js/Electron 런타임 내장이며 기존 코드베이스(`weverse-api.ts`, `timing-service.ts`)에서 이미 검증된 패턴이다.

## Architecture Patterns

### System Architecture Diagram

```
[Renderer: LoginPanel.tsx]
        │  IPC invoke: auth:credential-login(email, pw)  (Phase 06에서 모드 분기 추가 예정)
        ▼
[Main: ipc-handlers.ts]
        │  authService.credentialLogin(email, pw)   ← 기존 헤드리스 경로 (변경 없음)
        │  authService.credentialLoginApi(email, pw) ← 신규 API 경로 (Phase 05)
        ▼
[Main: AuthService (auth-service.ts)]
        │
        ├─▶ [신규] ApiAuthClient.requestOtpSession(email)
        │        POST accountapi.weverse.io/web/api/v2/auth/otp-sessions
        │        → { otpSessionId }
        │
        ├─▶ [신규] ApiAuthClient.loginWithCredentials(email, pw, otpSessionId)
        │        POST .../v4/auth/token/by-credentials
        │        → 200(즉시 성공, 드묾) | -25044(OTP 필요 — 항상 발생 예상)
        │
        ├─▶ (OTP 이메일 발송은 otp-sessions 호출 시 자동 트리거됨 — 별도 /v2/auth/otp 재발송 API 존재)
        │
        ├─▶ [신규] ApiAuthClient.verifyOtp(email, pw, otpSessionId, otpCode)
        │        POST .../v3/auth/token/by-credentials-with-otp
        │        → { accessToken, refreshToken, serviceUserId, expiresIn }
        │
        ├─▶ [신규] ApiAuthClient.exchangeForService(accountAccessToken, targetServiceId)
        │        POST .../v2/auth/token/by-access-token
        │        → { accessToken, ... }  (스파이크로 검증 — R019)
        │
        └─▶ this.cachedToken = <최종 확보된 토큰>   ← 기존 브라우저 경로와 동일한 필드에 대입
                     │
                     ▼
        [authService.token getter — 변경 없음]
                     │
                     ▼
        [ApplyEngine (apply-engine.ts:55, 146)] — authService.token을 그대로 소비, 코드 0줄 변경
                     │
                     ▼
        [WeverseApi → fanevent-v2.weverse.io] — Authorization: Bearer <token> 그대로 사용
```

### Recommended Project Structure
```
src/main/services/
├── auth-service.ts        # 기존 — cachedToken/getStatus/isTokenExpired 등 재사용, 신규 public 메서드만 추가
├── api-auth-client.ts      # 신규 — 3단계 로그인 + 토큰 교환 HTTP 호출 캡슐화 (TimingService 패턴을 따름: 생성자에 fetch 주입)
└── __tests__/
    └── api-auth-client.test.ts   # 신규 — vi.fn() fetch 모킹, 네트워크 없이 단위 테스트
```

### Pattern 1: 생성자 주입 fetch — 테스트 가능한 HTTP 클라이언트
**What:** `TimingService`가 이미 사용 중인 패턴 — `constructor(fetchFn = globalThis.fetch)`로 fetch를 주입받아 실제 네트워크 호출 없이 유닛 테스트 가능하게 함.
**When to use:** 신규 `ApiAuthClient` 전체.
**Example:**
```typescript
// Source: src/main/services/timing-service.ts:20-25 (기존 코드, 검증된 패턴)
export class TimingService {
  private readonly fetch: typeof globalThis.fetch;
  constructor(fetchFn: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetchFn;
  }
}
```
신규 `ApiAuthClient`도 동일한 형태로 구현할 것을 권장:
```typescript
// 신규 코드 — 위 패턴을 그대로 따름 (제안, 미검증 — 플래너가 최종 결정)
export class ApiAuthClient {
  private readonly fetch: typeof globalThis.fetch;
  constructor(fetchFn: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetchFn;
  }
  async requestOtpSession(email: string): Promise<{ otpSessionId: string }> { /* ... */ }
  async loginWithCredentials(email: string, password: string, otpSessionId: string): Promise<ApiLoginResult> { /* ... */ }
  async verifyOtp(email: string, password: string, otpSessionId: string, otpCode: string): Promise<ApiLoginResult> { /* ... */ }
  async exchangeForService(accountAccessToken: string, targetServiceId: string): Promise<{ accessToken: string }> { /* ... */ }
}
```
테스트는 `timing-service.test.ts:10-27`의 `makeFetchWith(...)` 헬퍼 패턴을 그대로 재사용할 수 있다.

### Pattern 2: AuthService에 API 경로를 나란히 추가 (기존 헤드리스 경로는 건드리지 않음)
**What:** `AuthService`는 이미 `cachedToken`(모듈 단위 상태) + `getStatus()` + `isTokenExpired()` + `_emit()`(AuthEvent 스트림) + `saveCredentials/loadCredentials`(safeStorage 암호화 저장)를 갖고 있다. 이들은 로그인 *방식*과 무관한 공통 로직이므로 그대로 재사용한다.
**When to use:** `credentialLoginApi(email, password)`와 `submitOtpApi(otpCode)`라는 새 public 메서드를 `AuthService`에 추가하고, 내부적으로 `ApiAuthClient`를 사용해 최종 토큰을 얻으면 기존 `this.cachedToken = token`, `this._emit({type:"login-success",...})`, `this.validateToken()` 흐름에 그대로 합류시킨다.
**Example:**
```typescript
// 기존 헤드리스 경로 — 재사용할 부분 (auth-service.ts)
// cachedToken 필드:                     line 33
// isTokenExpired():                     line 823-849  (순수 함수, 방식 무관 — 그대로 재사용)
// saveCredentials()/loadCredentials():  line 58-82     (safeStorage 암호화 — 그대로 재사용, Phase 07에서 API 모드도 이 메커니즘 재사용 예정)
// _emit()/AuthEvent 스트림:             line 851-855   (그대로 재사용 — IPC auth:event 채널이 자동으로 전달)
// getStatus():                          line 46-54     (그대로 재사용 — 토큰 존재 여부만 확인)
```
**브라우저 전용이라 API 모드에 적용 불가한 부분:**
```typescript
// auth-service.ts — 이 부분들은 headless BrowserWindow 전용, API 모드에서 사용 금지
// headlessWindow 필드 + cleanupHeadless():        line 39, 553-558
// extractTokenFromCookies() (session.cookies.get): line 535-551
// tryAutoRelogin() (line 158-179)는 credentialLogin()을 호출하므로 API 모드에선 재사용 불가
//   — PROJECT.md에 이미 문서화됨: "API 모드는 자동 재로그인 불가, OTP가 사람 개입을 요구"
//   — Phase 05에서는 tryAutoRelogin을 API 경로에 배선하지 않는다 (Phase 07에서 사전 경고로 별도 처리)
```

### Anti-Patterns to Avoid
- **ApplyEngine이나 WeverseApi를 수정해 "로그인 모드" 개념을 알게 하는 것:** 요구사항 자체가 "코드 변경 없이 그대로 동작"이다. `authService.token`이 어떤 경로로 채워졌든 문자열 하나만 반환하면 되므로, ApplyEngine/WeverseApi 계층에 절대 API/브라우저 분기를 넣지 않는다 — `apply-engine.ts:55,146`은 오늘도 앞으로도 `authService.token`만 읽어야 한다.
- **credentialLogin(헤드리스)과 credentialLoginApi(신규)를 하나의 메서드로 합쳐 내부 if/else로 분기하는 것:** 두 경로는 실패 모드·타임아웃·재시도 정책이 근본적으로 다르다(헤드리스는 DOM 폴링 25초 타임아웃, API는 순수 HTTP 응답). 별도 public 메서드로 유지해야 Phase 06의 모드 선택 UI가 명확하게 배선할 수 있다.
- **OTP 코드를 어떤 형태로든 저장하는 것:** R018 노트에 "OTP 코드는 절대 저장하지 않는다"고 명시됨 — `saveCredentials()`는 email/password만 저장하고 OTP는 절대 인자로 넘기지 않는다(기존 헤드리스 경로도 이미 이렇게 동작함, `auth-service.ts:379,478`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT exp 파싱/만료 판정 | 새 JWT 파서 | 기존 `AuthService.isTokenExpired()` (line 823) | 이미 base64url 디코드 + 파싱 실패 안전 폴백까지 구현되어 있고 12개 유닛 테스트로 커버됨. 교환된 토큰이 JWT 형태라면(대부분의 계정 토큰이 JWT임) 그대로 재사용 가능 |
| 민감정보 로그 마스킹 | 새 마스킹 정규식 | `maskToken()`, `maskSensitive()` (`shared/mask.ts`) | R010 마스킹 규칙이 이미 7종 구현되어 있고 이메일/비밀번호/OTP 코드도 이 유틸로 마스킹해야 함 — 특히 API 로그인 요청 바디를 로깅할 때 password 필드가 노출되지 않도록 `maskSensitive()` 패턴을 확장해야 함 (현재 `SENSITIVE_PATTERNS`에 `password`/`otpCode` 키가 없음 — Phase 05에서 추가 필요, 아래 Pitfall 참조) |
| 자격증명 암호화 저장 | 새 저장 메커니즘 | 기존 `saveCredentials()`/`loadCredentials()` (safeStorage) | Phase 07 담당이지만 Phase 05 설계 시 인터페이스를 미리 호환되게 잡아둘 것 — email/password 필드만 저장하는 기존 `StoredCredentials` 타입을 그대로 재사용 가능 |
| UUID 생성 | 커스텀 랜덤 문자열 생성기 | `crypto.randomUUID()` | Node 내장, 충돌 없는 표준 UUID v4 |

**Key insight:** 이 phase의 대부분은 "새로 만드는 것"이 아니라 "기존 AuthService의 관식(idiom)을 그대로 복제해 두 번째 로그인 경로를 추가하는 것"이다. `isTokenExpired`, `_emit`, `saveCredentials`, `getStatus`는 이미 로그인 방식과 무관하게 설계돼 있으므로 재사용이 자연스럽다.

## Common Pitfalls

### Pitfall 1: `X-ACC-TRACE-ID`를 재사용하거나 생략
**What goes wrong:** 여러 요청에 동일한 trace ID를 쓰거나 헤더를 빠뜨리면 서버가 요청을 거부하거나(이미 `-26000` 패턴으로 관찰됨) 디버깅이 어려워진다.
**Why it happens:** 헤더가 5개나 되고 매 요청마다 새로 생성해야 한다는 사실을 놓치기 쉽다.
**How to avoid:** `ApiAuthClient`의 공통 fetch 래퍼(`commonHeaders()`와 유사한 헬퍼, `weverse-api.ts:13-19` 패턴 참조)에서 매 호출마다 `crypto.randomUUID()`로 새로 생성해 주입한다.
**Warning signs:** 서버가 `-26000 잘못된 API 사용입니다` 반환.

### Pitfall 2: OTP 세션 만료 처리 누락 (R018 노트: "재발송 및 만료(expiresIn) 처리 포함")
**What goes wrong:** `otp-sessions` 호출 시 반환되는 `otpSessionId`와, OTP 발송 시 반환되는 `expiresIn`(초 단위)을 추적하지 않으면 사용자가 만료된 세션으로 `by-credentials-with-otp`를 호출해 알 수 없는 에러를 받는다.
**Why it happens:** 기존 헤드리스 경로는 DOM 안에서 브라우저가 만료를 알아서 표시해주지만, API 경로는 앱이 직접 카운트다운/재발송 로직을 관리해야 한다.
**How to avoid:** `verifyOtp` 실패 시 서버 에러 코드를 확인하고, 만료로 판단되면 `POST /v2/auth/otp`(재발송, body `{otpSessionId}`)를 다시 호출하는 경로를 `AuthEvent`로 노출한다. 이 UX 문구 자체는 Phase 06(R020) 담당이지만, Phase 05는 최소한 "OTP 만료됨" 이벤트 타입을 emit할 수 있는 구조는 만들어야 한다.
**Warning signs:** 사용자가 오래 기다렸다가 OTP를 입력하면 알 수 없는 실패.

### Pitfall 3: 비밀번호/OTP 코드가 로그에 평문으로 남음
**What goes wrong:** `shared/mask.ts`의 `SENSITIVE_PATTERNS`(line 38-46)는 `Authorization`, `applyToken`, `phoneNumber`, `birthDate`, `membershipNumber`, `firstName`, `lastName` 7종만 마스킹한다. `password`, `otpCode`는 이 목록에 없다.
**Why it happens:** 기존 헤드리스 경로는 비밀번호를 DOM에 직접 입력하므로 로그에 JSON 바디로 남을 일이 없었다. API 경로는 `logService.info(...)` 호출 시 요청 바디를 그대로 문자열화하면 비밀번호가 그대로 로그 파일에 기록될 위험이 있다.
**How to avoid:** (1) 요청 바디를 로깅할 때 `password`/`otpCode` 필드를 절대 포함하지 않도록 로그 문자열을 직접 구성한다(전체 바디를 JSON.stringify하지 않는다). (2) `shared/mask.ts`의 `SENSITIVE_PATTERNS`에 `password`, `otpCode` 항목을 추가하는 것도 방어선으로 권장 — R010 요구사항의 정신(개인정보 로그 마스킹)을 API 로그인 경로에도 동일하게 적용해야 한다.
**Warning signs:** 코드 리뷰에서 `logService.info(..., JSON.stringify(requestBody))` 같은 패턴 발견 시 즉시 수정.

### Pitfall 4: `persist:weverse` 세션 파티션과의 쿠키 간섭
**What goes wrong:** API 로그인은 쿠키를 전혀 사용하지 않지만(순수 fetch, Electron `session` 미경유), 만약 구현 중 실수로 `session.fromPartition("persist:weverse")`를 거치는 fetch(예: Electron의 `net.fetch` 대신 실수로 BrowserWindow의 webContents.session을 통한 요청)를 사용하면, 브라우저 모드에서 남은 `we2_access_token` 쿠키와 뒤섞여 어느 로그인 방식의 토큰인지 혼동될 수 있다.
**Why it happens:** 기존 코드베이스의 모든 쿠키 관련 로직이 `session.fromPartition("persist:weverse")`를 공유한다(`auth-service.ts:104,192,536,585`).
**How to avoid:** `ApiAuthClient`는 반드시 Node 내장 전역 `fetch`(Electron main 프로세스의 `globalThis.fetch`, Chromium net stack이지만 Electron `session`과 독립적)만 사용하고 `session`/`cookies` API를 절대 참조하지 않는다. 이는 이미 `weverse-api.ts`, `timing-service.ts`가 검증한 패턴과 동일하다.
**Warning signs:** API 로그인 성공 후에도 여전히 `we2_access_token` 쿠키를 조회하려는 코드가 있다면 설계 오류.

### Pitfall 5: 토큰 교환 실패를 로그인 실패와 동일하게 취급
**What goes wrong:** `by-credentials-with-otp`는 성공했지만 `by-access-token` 교환이 실패하는 경우(R019의 미검증 리스크가 실제로 발생하는 경우), 사용자에게는 "로그인 성공"처럼 보이다가 신청 시점에 401이 터지는 최악의 UX가 된다.
**Why it happens:** 두 단계(로그인 성공 vs 팬이벤트 토큰 확보 성공)를 하나의 boolean으로 뭉뚱그리면 이 구분이 사라진다.
**How to avoid:** `credentialLoginApi()`는 (1) 계정 로그인 성공, (2) 팬이벤트 토큰 교환 성공을 별개 단계로 emit하고, `this.cachedToken`은 **(2)까지 성공했을 때만** 채운다. (2)가 실패하면 로그인 전체를 실패로 처리하고 명확한 에러를 노출한다(Success Criteria 3번이 요구하는 "실계정으로 we2_access_token 교환까지 검증"과 정확히 부합).
**Warning signs:** `getStatus().isLoggedIn === true`인데 `applyEngine.fetchForm()`이 401을 반환하는 상황.

## Code Examples

### 3단계 로그인 요청 형태 (실서버 검증 완료 + 번들 재확인)
```typescript
// Source: .planning/PROJECT.md "검증된 API 계약" 표 (2026-08-25 실측) + 이번 세션 번들 대조 확인
// account.weverse.io bundle chunk 6072-e2e22801ed7d7107.js에서 요청 필드명이 정확히 일치함을 재확인:
//   POST /v2/auth/otp-sessions            body: { email }
//   POST /v4/auth/token/by-credentials     body: { email, password, otpSessionId }
//   POST /v3/auth/token/by-credentials-with-otp
//                                          body: { email, password, otpSessionId, otpCode, refreshTokenCookieTtl }
//   POST /v2/auth/otp (재발송)             body: { otpSessionId }  →  { expiresIn }

const commonHeaders = (uuid: string) => ({
  "X-ACC-APP-VERSION": "4.7.1",
  "X-ACC-APP-SECRET": "5419526f1c624b38b10787e5c10b2a7a",
  "X-ACC-SERVICE-ID": "weverse",
  "X-ACC-LANGUAGE": "ko",
  "X-ACC-TRACE-ID": uuid,
  "Content-Type": "application/json",
});
```

### 토큰 교환 요청 형태 (번들 CITED + 실서버 헤더 계약 VERIFIED, 바디 필드 성공 응답 미검증)
```typescript
// Source: account.weverse.io bundle chunk 6175-c264b6482d83bb27.js (module 35688, export ES)
// + 실서버 프로브 2026-08-25 (400/401 응답으로 헤더 요구사항 확인)
async function exchangeForFanevent(accountAccessToken: string, uuid: string) {
  const res = await fetch(
    "https://accountapi.weverse.io/web/api/v2/auth/token/by-access-token",
    {
      method: "POST",
      headers: {
        ...commonHeaders(uuid),
        Authorization: `Bearer ${accountAccessToken}`,
      },
      body: JSON.stringify({ targetServiceId: "weverse" }),
    }
  );
  // 200 예상 시 body: { accessToken, refreshToken, serviceUserId, expiresIn } — 미검증, 스파이크로 확인 필요
  return res.json();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 헤드리스 BrowserWindow 로그인만 지원 (v0.2.0) | 순수 HTTP API 로그인 경로 추가 (v0.3.0, 이 phase) | 2026-08-25 milestone 시작 | 두 경로가 공존 — 사용자가 Phase 06에서 선택. ApplyEngine은 어느 경로든 무관하게 동작 |

**Deprecated/outdated:** 없음 — 기존 헤드리스 경로는 계속 유지되며 기본값(default)으로 남는다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `by-access-token` 교환 시 `X-ACC-SERVICE-ID`(departure) 값도 `"weverse"`로 충분하다 | 핵심 리스크 절, "발견 3" 표 | 잘못되면 -26000/401 계열 에러로 교환이 계속 실패 — 스파이크에서 다른 departure 후보를 시도해야 함 |
| A2 | `by-access-token`이 반환하는 `accessToken`이 `fanevent-v2.weverse.io`에서 `we2_access_token`과 동등하게 Bearer로 통한다 | 핵심 리스크 절, 발견 4 + 결론 표 | 틀리면 브라우저 폴백(헤드리스 리다이렉트 체인 완주 후 쿠키 추출)으로 전환해야 하며, ApplyEngine 연동 방식은 동일하게 유지 가능(문자열 토큰 하나만 필요하므로) |
| A3 | `by-credentials-with-otp` 응답의 `accessToken`이 교환 없이도 곧바로 `fanevent-v2`에서 통할 수 있다(가장 단순한 경우) | 핵심 리스크 절, 결론 표 | 틀리면(가능성 높음 — 서비스별로 토큰이 분리되어 있을 가능성) A2 경로로 폴백, 추가 비용 없음(스파이크 절차에 이미 순서대로 포함됨) |
| A4 | 교환된/로그인 토큰이 JWT 형태이며 기존 `isTokenExpired()`(exp 클레임 파싱)로 만료 판정이 가능하다 | Don't Hand-Roll 절 | JWT가 아니면 `isTokenExpired()`가 항상 "만료 아님"으로 안전 폴백하므로 크래시는 없지만, 만료 사전 경고(R022, Phase 07)가 무력화될 수 있음 |

**권장:** A1, A2, A3는 Wave 0 스파이크(실계정 필요, checkpoint:human-verify)로 순차 검증한다. A4는 스파이크 중 토큰 페이로드를 확인하는 것으로 함께 검증 가능하다.

## Open Questions

1. **`by-access-token` 성공 응답의 정확한 필드 스키마**
   - What we know: 실패 응답(400/401)의 에러 코드/메시지 형태와, 번들에서 유추한 성공 시 필드(`accessToken`, `refreshToken`, `serviceUserId`, `expiresIn`)
   - What's unclear: 필드명이 정확히 이 4개뿐인지, `expiresIn`이 초/밀리초인지
   - Recommendation: 스파이크 실행 시 마스킹된 응답 바디를 로그로 남겨 플래너/실행자가 실제 스키마를 `shared/types.ts`에 반영

2. **`X-ACC-SERVICE-ID`(departure) 올바른 값**
   - What we know: 로그인 3단계 자체는 `weverse`로 고정
   - What's unclear: 교환 호출의 departure가 `weverse`와 동일해도 되는지, 다른 값(`account` 등, enum에 없음)이 필요한지
   - Recommendation: 스파이크에서 `weverse`를 1차 시도, 실패 시 402/403/-26000 계열 에러 메시지를 단서로 재시도

3. **교환이 완전히 불필요할 가능성**
   - What we know: 발견 4에서 계정 토큰과 서비스별 토큰이 개념적으로 분리되어 있음을 확인
   - What's unclear: `by-credentials-with-otp`를 이미 `X-ACC-SERVICE-ID: weverse`로 호출했으므로 반환된 토큰이 이미 "weverse" 서비스에 스코프되어 있어 교환이 생략 가능할 수도 있음
   - Recommendation: 스파이크 1번 항목(가장 저렴)으로 우선 확인 — 이게 참이면 R019 구현이 대폭 단순해짐(추가 HTTP 호출 0개)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 내장 `fetch` | 3단계 로그인 + 토큰 교환 HTTP 호출 | ✓ | Electron 33 내장 (Node 20+) | — |
| Node 내장 `crypto.randomUUID()` | X-ACC-TRACE-ID 생성 | ✓ | Node 20+ 내장 | — |
| `accountapi.weverse.io` 실서버 접근 | 전체 로그인 흐름 | ✓ (본 세션에서 라이브 프로브 성공) | — | — |
| 실계정 자격증명 + 이메일 접근 (OTP 수신) | Wave 0 스파이크 검증 | ✗ (연구 세션에서는 사용 불가) | — | checkpoint:human-verify 태스크로 실행자/사용자가 직접 수행 |

**Missing dependencies with no fallback:**
- 실계정 자격증명 — R019 스파이크는 사람이 직접 실행해야 하며 자동화된 CI로 대체 불가.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.6 |
| Config file | `vitest.config.ts` (프로젝트 루트) |
| Quick run command | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R017 | otp-sessions → by-credentials 요청 바디/헤더 조립이 정확하다 | unit (fetch mock) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "otp-session"` | ❌ Wave 0 |
| R017 | -26000/-25044 등 에러 코드를 그대로 상위로 전파한다 | unit (fetch mock, 400/401 응답 스텁) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "error"` | ❌ Wave 0 |
| R018 | by-credentials-with-otp 요청에 otpCode/otpSessionId가 포함된다 | unit (fetch mock) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "otp verify"` | ❌ Wave 0 |
| R018 | OTP 코드가 saveCredentials()로 저장되지 않는다 | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "credentialLoginApi"` | ❌ Wave 0 (기존 파일에 추가) |
| R019 | 계정 토큰 → 교환 호출 요청 형태(헤더/바디)가 정확하다 | unit (fetch mock) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "exchange"` | ❌ Wave 0 |
| R019 | 실계정으로 we2_access_token(또는 동등 토큰) 교환이 성공하고 ApplyEngine이 그대로 사용 가능하다 | manual (checkpoint:human-verify) | 해당 없음 — 실계정+이메일 OTP 필요, 자동화 불가 | 해당 없음 |
| R019 | ApplyEngine이 `authService.token`을 코드 변경 없이 소비한다 | unit (기존 `apply-engine.test.ts`가 이미 커버) | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ✓ (기존 파일, 회귀 확인용으로 재실행) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/main/services/__tests__/api-auth-client.test.ts`
- **Per wave merge:** `npm test` (전체 163+개 기존 테스트 + 신규 테스트 회귀 확인)
- **Phase gate:** 전체 스위트 green + R019 스파이크(수동) 성공 로그 확보 후 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/main/services/__tests__/api-auth-client.test.ts` — R017/R018/R019 요청 조립 로직 커버 (신규 파일, `timing-service.test.ts`의 `makeFetchWith()` 패턴 재사용)
- [ ] `src/main/services/__tests__/auth-service.test.ts`에 `credentialLoginApi`/`submitOtpApi` 테스트 케이스 추가 (기존 파일 확장, electron mock 패턴 재사용 — line 8-16)
- [ ] 프레임워크 설치: 불필요 — vitest 이미 설치됨
- [ ] R019 실계정 스파이크: checkpoint:human-verify 태스크로 Wave 0에 명시적으로 배치 (자동화 불가)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | 서버 측 3단계 자격증명 검증(otp-sessions/by-credentials/by-credentials-with-otp) — 클라이언트는 서버 응답을 신뢰하고 자체 인증 로직을 만들지 않는다 |
| V3 Session Management | yes | 토큰(JWT로 추정)의 `exp` 클레임을 신뢰하고 로컬 세션 갱신 로직을 만들지 않는다 — 기존 `isTokenExpired()` 재사용 |
| V4 Access Control | no | 이 phase는 단일 사용자 단일 계정 앱(R012 다계정 금지)이므로 서버 측 권한 분리 로직 해당 없음 |
| V5 Input Validation | yes | 이메일/비밀번호/OTP 코드 입력값을 서버로 그대로 전달 — 클라이언트 측에서 OTP는 6자리 숫자로 제한(기존 `LoginPanel.tsx:236` 패턴 재사용), 비밀번호는 검증 로직 없이 그대로 전달(서버가 검증) |
| V6 Cryptography | yes (제약 있음) | 비밀번호는 평문으로 TLS 위에 전송된다(클라이언트 측 RSA/해시 없음) — **이는 Weverse 서버 자체의 설계이며 이 프로젝트가 새로 도입하는 취약점이 아니다.** 대신 (1) 로그/디스크에 비밀번호 평문이 남지 않도록 마스킹(Pitfall 3), (2) `safeStorage`(OS 키체인 기반)로 저장 시에만 암호화(Phase 07 담당이지만 인터페이스는 이 phase에서 호환되게 설계) |

### Known Threat Patterns for 이 스택

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 로그 파일을 통한 자격증명/OTP 코드 유출 | Information Disclosure | Pitfall 3 참조 — 요청 바디 전체를 `JSON.stringify`해서 로깅하지 않고, `password`/`otpCode` 필드를 절대 로그 문자열에 포함하지 않는다 |
| 토큰 교환 실패를 숨기고 로그인 성공으로 오인 | Spoofing (사실상 신청 실패로 이어지는 논리 결함) | Pitfall 5 참조 — 계정 로그인 성공과 팬이벤트 토큰 확보 성공을 별개 단계로 분리, 후자가 실패하면 전체 로그인 실패로 처리 |
| `X-ACC-TRACE-ID` 재사용으로 인한 요청 추적성 저하 | Repudiation | Pitfall 1 참조 — 매 요청마다 `crypto.randomUUID()`로 신규 생성 |
| API 모드가 브라우저 모드의 쿠키 세션과 뒤섞임 | Tampering (세션 혼동) | Pitfall 4 참조 — API 경로는 `session`/`cookies` API를 절대 사용하지 않고 순수 fetch만 사용 |

## Sources

### Primary (HIGH confidence)
- `accountapi.weverse.io` 실서버 라이브 프로브 (2026-08-25, 이번 세션 curl 실행) — `by-access-token` 엔드포인트 존재, `Authorization` 헤더 필수, 400/401 에러 코드 실측
- `.planning/PROJECT.md` "검증된 API 계약" 표 (2026-08-25 실측, 이번 세션에서 재-크로스체크) — 3단계 로그인 계약 전체
- 기존 코드베이스: `src/main/services/auth-service.ts`, `apply-engine.ts`, `weverse-api.ts`, `timing-service.ts`, `ipc-handlers.ts`, `LoginPanel.tsx`, `shared/types.ts`, `shared/mask.ts` (전부 이번 세션에서 Read 도구로 직접 읽음)

### Secondary (MEDIUM confidence)
- `account.weverse.io` 프로덕션 Next.js 번들 역공학 (빌드ID `Xe_PgvTmjPYuQO_eSFsEX`, 2026-08-25 다운로드): `pages/login/credential-30043a5bf5c86ddc.js`, `pages/auth/update-f3e9f79bf43e59ca.js`, `pages/sso-96cc5f5b76e40832.js`, 청크 `6072-e2e22801ed7d7107.js`, `6175-c264b6482d83bb27.js`, `6810-76d0712dd3df4194.js`, `_app.js` — `by-access-token` 엔드포인트 발견, 헤더/필드명 계약, SSO 토큰 릴레이 메커니즘

### Tertiary (LOW confidence)
- 없음 — 이번 연구는 전부 실코드(번들) 또는 실서버 응답에 기반했으며, 순수 web search/훈련 지식에만 의존한 주장은 없음

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 기존 코드베이스 패턴을 그대로 확장, 신규 의존성 없음
- Architecture: HIGH — 기존 AuthService/ApplyEngine 인터페이스 경계가 이미 로그인 방식과 무관하게 설계되어 있음을 코드로 확인
- R019 토큰 교환: MEDIUM (엔드포인트/계약) / LOW (성공 응답의 실제 팬이벤트 호환성) — 실계정 스파이크 필수
- Pitfalls: HIGH — 기존 마스킹/쿠키/세션 관례를 코드에서 직접 확인 후 도출

**Research date:** 2026-08-25
**Valid until:** 7일 (Weverse 계정 API는 리버싱 기반 비공식 계약이며 서버 측 변경 위험이 상존 — fast-moving으로 분류)
