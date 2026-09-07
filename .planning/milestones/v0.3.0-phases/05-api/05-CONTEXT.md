# Phase 05: API 로그인 핵심 흐름 + 토큰 교환 검증 - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning (재설계 — 기존 05-01/05-02는 무효 전제 위에 있음)

<domain>
## Phase Boundary

**이 phase가 전달하는 것:** account 토큰 → 팬이벤트 토큰(`we2_access_token`) 교환 경로(R019)가
실제로 성립하는지를 실계정으로 검증하는 것. 검증 결과가 v0.3.0 API 모드의 최종 정의를 결정한다.

**원래 목표에서 달라진 점:** 로드맵의 Success Criteria 1·2("매 로그인 이메일 OTP 발송",
"by-credentials-with-otp 검증")는 HAR 증거로 반증되어 이 phase의 산출물이 아니다.
Success Criteria 3(토큰 교환 + ApplyEngine 무변경)만 살아 있으며, 이번 phase는 그것을
**스파이크로 검증**하는 데 집중한다.

**이 phase가 전달하지 않는 것:** API 모드의 최종 제품 구현. 사다리 검증 결과가 나온 뒤
별도로 결정한다(D-04). 캡차 토큰의 프로그램적 생성·주입은 영구 제외(R013).

</domain>

<decisions>
## Implementation Decisions

### 재설계 전제 — 확정된 사실

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

### 플랜 처리
- **D-01:** 기존 `05-01-PLAN.md`(halted) / `05-02-PLAN.md`(blocked)는 무효 전제 위에 있으므로
  이번 CONTEXT.md 기준으로 **재작성**한다. 05-02의 "OTP 재발송·만료(expiresIn) 처리" 태스크는
  대상 세션이 실재하지 않으므로 그대로 부활시키지 않는다.

### account 토큰 확보 경로
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

### R019 사다리 검증 범위
- **D-03:** `acquireFaneventToken()`의 **rung1 + rung2 전체**를 검증한다.
  - rung1: account 토큰 단독으로 `GET /fans/me`(`fanevent-v2.weverse.io`) 직접 호출
  - rung2: rung1 실패 시 `by-access-token` 교환 후 `/fans/me` 재시도
  - 브라우저 경로가 이미 `we2_access_token`을 쿠키로 내주지만, 사다리 검증의 가치는 **미래에
    순수 HTTP 로그인 경로가 열릴 때를 대비한 것**이다. 그래서 direct 경로도 함께 확인한다.
  - `acquireFaneventToken()` 구조는 이미 이 형태이므로 로직 재작성이 아니라 **입력 공급**만 필요하다.

### 작업 성격
- **D-04:** 이번 phase는 **스파이크**다. 검증하고 결과를 문서화하는 것이 산출물이며,
  코드는 검증에 필요한 최소한으로 유지한다. "API 모드 = 헤드리스 브라우저로 account 토큰 확보
  + 이후 순수 HTTP"로 제품 경로를 확정하는 결정은 **사다리 결과를 본 뒤** 별도로 내린다.
  - 근거: 마일스톤 최대 리스크(R019)를 조기에 걷어내는 것이 원래 Phase 05의 의도였고,
    사다리가 실패하면 API 모드 정의 자체가 다시 바뀌므로 그 위에 제품 코드를 쌓지 않는다.
  - **Reversibility:** reversible — 스파이크 산출물은 문서와 최소 배선이라 폐기 비용이 낮다.

### 요구사항 정리
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

### 실계정 프로브 안전장치
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

### 잔존 자산 처리
- **D-07:** `ApiAuthClient`의 무효 계약 기반 메서드(`requestOtpSession`,
  `loginWithCredentials`, `submitOtpApi`)는 **스파이크 동안 그대로 둔다.** 사다리 결과가
  나오고 API 모드 정의가 확정된 뒤 일괄 정리한다.
  - 근거: 지금 지우면 캡차 실패 폴백 경로를 재확인할 때 다시 써야 한다. D-04(스파이크 우선)와 일관.

### Claude's Discretion
- 사다리 검증을 어떤 형태로 남길지(문서/회귀 테스트/제품 코드) — 사용자가 별도 논의를
  선택하지 않았으므로 planner 재량. 단 D-04(최소 코드)를 벗어나지 않을 것.
- account 토큰 쿠키의 실제 이름 탐색 방법, `webRequest` 훅의 구체적 배선 지점 — 구현 세부.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 정정된 API 계약 — 최우선
- `.planning/phases/05-api/05-01-SUMMARY.md` — **필수 정독.** HAR 증거로 확정된 실제 로그인
  계약, 무효화된 전제 목록, 보존 대상 자산, 실사용 피해 2건의 경위. 이 phase 재설계의 1차 입력.
  특히 "무효화된 전제 (Invalidated Assumptions)" 섹션과
  "Process Issue — 실행자의 사용자 이메일 오용" 섹션.

### 무효 전제를 포함한 문서 — 읽되 그대로 믿지 말 것
- `.planning/PROJECT.md` "검증된 API 계약 (2026-08-25 실측)" 표 — **3단계 순서와 `otpSessionId`
  설명이 반증됨.** 나머지(Base URL, 필수 헤더, 평문 비밀번호)는 유효.
- `.planning/phases/05-api/05-RESEARCH.md` — 번들 역공학. reCAPTCHA site key 위치와 호출
  그래프는 유효하나 **"스파이크 절차 1~4단계"는 전제 붕괴로 무효.**
- `.planning/phases/05-api/05-01-PLAN.md` — halted. 로그인 스텝 계약이 무효.
- `.planning/phases/05-api/05-02-PLAN.md` — blocked. OTP 재발송·만료 태스크 전체가 무효.

### 유효한 참조
- `.planning/phases/05-api/05-PATTERNS.md` — 신규 파일↔기존 유사 코드 매핑.
- `.planning/phases/05-api/05-VALIDATION.md` — 검증 기준.
- `.planning/REQUIREMENTS.md` §R017/R018/R019 — D-05에 따라 정정 대상.
- `.planning/ROADMAP.md` Phase 05 — Success Criteria 1·2가 무효임이 이미 주석으로 표시됨.

### 확보 불가 자료
- 사용자 제공 HAR(`full weverse.io.har`, 436 entries) — **저장소에 없다.** 세션 한정 자료였고
  `05-01-SUMMARY.md`가 유일한 정본 기록이다. 추가 계약 확인이 필요하면 사용자에게 재요청해야 한다.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/services/api-auth-client.ts` — electron 무의존 HTTP 셸(생성자 주입 fetch,
  10초 타임아웃, `ApiAuthError` 타입드 에러) + `acquireFaneventToken()` 사다리
  (rung1 direct → rung2 exchange). **D-03이 요구하는 구조가 이미 구현되어 있다.**
  필요한 것은 로직 변경이 아니라 유효한 account 토큰 공급.
- `src/main/services/auth-service.ts:212` `credentialLogin()` — 헤드리스 BrowserWindow
  로그인. 실제 로그인 페이지가 캡차를 스스로 처리하므로 **캡차 관문을 우회하지 않고
  통과하는 유일하게 동작 중인 경로.** D-02의 토큰 확보 지점.
- `src/main/login-mode.ts` — `resolveLoginMode()` / `AUTOVERSE_LOGIN_MODE`. env를
  파라미터로 받게 설계되어 Phase 06이 영속 설정으로 갈아끼울 수 있음. 계약과 무관하게 유효.
- `src/shared/mask.ts` — `password`/`otpCode` 마스킹 패턴 추가됨. 유효.
- `src/main/services/timing-service.ts`, `weverse-api.ts` — 생성자 주입 fetch + 타입드 에러
  패턴의 원본. `ApiAuthClient`가 이 패턴을 따름.

### Established Patterns
- **생성자 주입 fetch** — 모든 HTTP 클라이언트가 `fetchFn`을 생성자로 받아 테스트에서
  fetch-mock 주입. 신규 코드도 이 패턴을 따를 것.
- **모드 게이트 방어** — `tryAutoLogin()`/`tryAutoRelogin()` 최상단에서 `resolveLoginMode()`
  체크. API 모드에서는 `extractTokenFromCookies()`도 건너뛴다(다른 모드 잔여 세션의
  조용한 재사용 방지). 05-01에서 실제 버그를 잡아낸 가드이므로 **약화시키지 말 것.**
- **관측성 우선** — 서버 응답이 기대와 다르면 조용히 넘어가지 않고 즉시 실패
  (`OTP_SESSION_MALFORMED` 가드). 계약이 바뀌어도 이 원칙은 유지.
- **쿠키 파티션 격리** — `persist:weverse` 파티션. `ApiAuthClient`는 electron을 import하지
  않으며 이 파티션을 건드리지 않는다(Pitfall 4). D-02의 쿠키 조회는 `AuthService` 쪽에서만.

### Integration Points
- `src/main/services/auth-service.ts:678` `extractTokenFromCookies()` — 현재
  `we2_access_token` 쿠키 하나만 조회. **D-02의 account 토큰 조회를 여기에 확장하거나
  별도 메서드로 분리.**
- `src/main/services/auth-service.ts:229` 헤드리스 `BrowserWindow` 생성 지점 —
  D-02 폴백(응답 캡처)의 `webRequest` 훅을 붙일 자리.
- `src/main/ipc-handlers.ts` — `auth:*` 핸들러가 `resolveLoginMode()` 분기로 배선됨.
  스파이크가 IPC를 새로 열 필요는 없을 가능성이 높음.
- `src/main/services/apply-engine.ts` — R019의 최종 소비자. 사다리가 내놓은 토큰으로
  **코드 변경 없이** 동작해야 한다는 것이 로드맵 Success Criteria 3.

### 알려진 갭 (이 phase 밖이지만 스파이크 중 마주칠 수 있음)
- `LoginPanel.tsx`의 "로그아웃 + 자격 증명 삭제" 버튼이 `status.isLoggedIn === true`일 때만
  노출된다. 로그인 실패/미시도 상태에서는 저장된 `credentials.enc`를 앱 UI로 지울 방법이 없어
  05-01에서 사용자가 터미널로 직접 삭제해야 했다
  (`~/Library/Application Support/weverse-fanevent-apply/credentials.enc`).

</code_context>

<specifics>
## Specific Ideas

- 사용자 지시 그대로: **"헤드리스 브라우저로 account 토큰 얻어서 R019 사다리부터 검증하자."**
  Phase 05의 출발점은 로그인 방식 재설계가 아니라 **사다리 검증**이다.
- 검증 순서가 뒤집혔다는 점이 중요하다: 원래는 "로그인 성공 → 토큰 교환 검증"이었으나,
  이제는 "이미 동작하는 로그인으로 토큰을 얻어 → 교환부터 검증 → 그 결과로 로그인 방식 결정".

</specifics>

<deferred>
## Deferred Ideas

- **사다리 실패 시 분기 결정** — rung1·rung2가 모두 실패하면 R019가 반증되고 v0.3.0 API 모드
  정의 자체가 위태로워진다. 허용 경로(마일스톤 축소 / API 모드 폐기 / 재조사)를 미리 정하지
  않기로 함. 사다리 결과가 나온 뒤 판단.
- **스파이크 산출물 형식** — 문서만 / 회귀 테스트까지 / 제품 코드로 유지. planner 재량으로 남김(D-04 범위 내).
- **Phase 06/07 영향 정리** — R018 보류가 Phase 06 Success Criteria 2("매 로그인마다 이메일 OTP
  필요" 사전 고지)와 Phase 07의 자격증명 저장 전제를 바꾼다. Phase 05 종료 후 정리.
- **API 모드 제품 경로 확정** — D-04에 따라 사다리 결과를 본 뒤 별도 결정.
- **`ApiAuthClient` 무효 메서드 정리** — D-07에 따라 스파이크 종료 후 일괄 처리.
- **로그아웃 UI 갭** — `credentials.enc`를 앱에서 지울 수 없는 문제. Phase 07(자격증명 저장 정책) 후보.

</deferred>

---

*Phase: 05-api*
*Context gathered: 2026-08-25*
