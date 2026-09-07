# Phase 06: 로그인 방식 선택 UI + 실패 안내 - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

**이 phase가 전달하는 것:** 로그인 *메커니즘* 위에 얹히는 **선택 · 고지 · 안내 계층**.

1. 사용자가 로그인 방식을 명시적으로 고르고, 그 선택이 재시작 후에도 유지된다 (R016)
2. 방식의 실제 제약을 선택 시점에 확인해야만 진행할 수 있다 (R021)
3. 로그인이 실패하면 원인을 한국어로 정확히 이해할 수 있다 (R020)

**이 phase가 전달하지 않는 것:** 새 로그인 경로 구현(두 경로 모두 이미 존재), 자격증명 암호화
저장 정책(Phase 07 / R023), 토큰 만료 사전 경고(Phase 07 / R022), 캡차 우회(R013 영구 제외),
캡차 챌린지 발생 시의 새 복구 매커니즘(deferred).

**Phase 05에서 넘어온 미결 결정을 여기서 내린다:** 05-CONTEXT의 **D-04**("API 모드 제품 경로
확정은 사다리 결과를 본 뒤 별도로")가 이 phase의 D-01로 해소된다.

</domain>

<decisions>
## Implementation Decisions

### API 모드의 실체 정의 (D-04 해소)

- **D-01:** **API 모드 = `credentialLogin()` 헤드리스 자동입력 경로.** 사용자가 앱 안에서
  이메일/비밀번호를 입력하면 `show: false` BrowserWindow가 실제 로그인 페이지를 띄워 DOM
  자동입력으로 대신 로그인하고, reCAPTCHA는 그 페이지가 스스로 처리한다.
  - 근거: 순수 HTTP `by-credentials`는 reCAPTCHA 관문에 막힌다(R017/HAR 실측). Phase 05가
    실계정으로 rung1 성립을 확인한 유일하게 동작하는 자격증명 로그인 경로가 이것이다.
  - 사용자 체감은 "창이 뜨지 않는 로그인" — 클라이언트가 원한 "브라우저 없이 통신만으로"에
    실질적으로 가장 가까운 형태다.
  - **Reversibility:** costly — IPC 배선, 모드 게이트, UI 문구, 요구사항 서술이 함께 움직인다.
    되돌리려면 D-02로 제거한 코드를 복원해야 한다.

- **D-02:** **반증된 계약 기반 코드를 이번 phase에서 제거한다** — `credentialLoginApi()`,
  `ApiAuthClient.requestOtpSession()`, `loginWithCredentials()`, `submitOtpApi()`, 그리고
  `ipc-handlers.ts`의 `resolveLoginMode()==="api"` 분기(`auth:credential-login`,
  `auth:submit-otp`), `LoginPanel.tsx`의 OTP 입력 화면(`needOtp` 상태 전체).
  - **유지 대상:** `ApiAuthClient`의 `acquireFaneventToken()` 사다리, `exchangeForService()`
    (rung2), `validateToken()` — R019 자산이며 D-01과 무관하게 유효하다.
  - 근거: 05-CONTEXT **D-07**이 "API 모드 정의가 확정된 뒤 일괄 정리"로 미뤄둔 항목이며,
    D-01이 그 조건을 충족시켰다. 남겨두면 ① 모드 게이트 분기가 살아있어 누군가 다시 배선할
    위험 ② `credentialLoginApi`가 `-25044`를 "OTP 필요"로 오독해 **오지 않을 메일을 기다리게
    하는 거짓 OTP 화면**을 띄우는데, 이는 이 phase의 목표(정확한 안내)와 정면 충돌한다.
  - **Reversibility:** reversible — git 이력에 남으며, 계약이 다시 바뀌면 05-01-SUMMARY.md의
    정본 기록을 근거로 재작성하는 편이 낫다.

- **D-03:** **무인 자동 로그인은 두 모드 모두 차단한다.** `tryAutoLogin()` /
  `tryAutoRelogin()`의 게이트를 *모드 조건*이 아니라 *"외부에 로그인 요청을 발생시키는가"*로
  재정의한다.
  - **허용 (두 모드 공통):** `extractTokenFromCookies()` — 살아있는 쿠키 토큰으로의 **세션
    복원**. 외부 요청이 없고 사용자 경험(재시작 후 바로 사용)을 지킨다.
  - **차단 (두 모드 공통):** 저장된 자격증명으로의 `credentialLogin()` 무인 호출. 외부 로그인
    요청은 **항상 사용자 클릭에서만** 발생한다.
  - 근거: ① 기존 게이트의 명시된 사유("매 로그인마다 OTP 강제")는 반증됐고, 동시에 D-01이
    지정한 바로 그 경로를 막는 모순 상태였다. ② 그럼에도 이 가드에는 **실증된 두 번째 가치**가
    있다 — 05-01에서 `tryAutoLogin()` 모드 게이트 누락으로 **저장된 다른 계정에 헤드리스
    로그인이 시도되어 실제 알림 메일이 발송**됐다. 사유를 정정하되 보호는 유지한다.
    ③ 캡차는 언제든 인터랙티브 챌린지를 띄울 수 있어(05에서 1차 시도 `result=timeout` 실측)
    무인 재로그인은 어느 모드에서든 보장 불가다.
  - **⚠ 로드맵 SC1과의 의도적 편차:** ROADMAP Phase 06 SC1은 "기존 브라우저 로그인 동작은
    변경 없이"라고 쓰여 있으나, 이 결정은 **브라우저 모드의 `tryAutoLogin()` 자격증명 경로도
    제거**한다. 사용자가 트레이드오프를 이해한 상태에서 명시적으로 선택한 편차다. verify 단계는
    이를 회귀가 아니라 의도된 변경으로 판정해야 한다.
  - **부수 효과:** R022(토큰 만료 사전 경고, Phase 07)의 필요성이 API 모드 한정에서 **두 모드
    전체**로 확대된다. Phase 07 계획 시 반영할 것.
  - **Reversibility:** reversible — 게이트 조건 한 곳의 변경.

### 선택기 UI + 선택값 영속 (R016)

- **D-04:** **기존 `LoginPanel.tsx` 탭을 영속 선택기로 승격한다.** 새 UI 영역을 만들지 않고
  현재의 "이메일 로그인 / 브라우저 로그인" 탭을 재사용하되 ① 라벨을 D-01의 실체에 맞게 재작성
  ② 클릭 즉시 영속 저장 ③ **기본값을 `browser`로 변경**(현재 코드는 `credential`이 기본이라
  로드맵 SC1과 어긋난다).
  - 근거: 사용자가 이미 보던 자리에 그대로 있고, 렌더러 `useState` 탭과 메인의
    `resolveLoginMode()`가 **현재 서로 연결돼 있지 않은** 문제를 같은 작업으로 해소한다.

- **D-05:** **선택값은 `userData`의 별도 평문 `settings.json`에 저장한다.** `settings:*` IPC
  네임스페이스를 신설한다(preload에 현재 없음).
  - **`profile.enc`를 쓰지 않는 이유:** `ProfileStore`는 `safeStorage.isEncryptionAvailable()`가
    false면 **예외를 던진다**. 로그인 방식은 비민감 값인데 여기 넣으면 키체인 없는 환경에서
    모드 선택 자체가 깨지고, 프로필을 지우면 로그인 방식도 함께 날아가는 결합이 생긴다.
  - 파일 부재/파싱 실패 시 **기본값(`browser`)으로 조용히 폴백**하고 경고 로그만 남긴다.
  - Phase 07의 설정 항목들도 이 파일 위에 쌓을 수 있다.
  - **Reversibility:** reversible — 저장 위치 변경은 국소적. 단 `settings:*` IPC 채널은 한 번
    열면 preload 계약이 되므로 이름을 신중히 고를 것.

- **D-06:** **`AUTOVERSE_LOGIN_MODE` env가 저장된 설정보다 우선한다** (env가 설정되어 있으면
  저장값을 덮어씀). 기존 `resolveLoginMode()` 시그니처와 `login-mode.test.ts`가 그대로 살아있고,
  개발/QA에서 앱 상태를 건드리지 않고 모드를 강제할 수 있다.
  - **파생 요구사항 (필수):** UI가 거짓말하지 않도록 **선택기에 "환경변수로 고정됨" 표시 +
    조작 불가 상태**를 함께 구현한다. 이것 없이 D-06만 구현하면 사용자가 고른 값과 실제 동작이
    말없이 어긋난다.

- **D-07:** **로그인된 상태에서 방식을 바꾸면 설정만 바뀌고 현재 세션은 유지된다.** 바뀐 방식은
  다음 로그인부터 적용. 신청 대기 중 실수로 탭을 눌러 세션이 날아가는 사고를 방지한다.

### 제약 고지 (R021)

- **D-08:** **고지 문구는 사용자 체감 중심 2가지만 담는다.**
  1. Weverse 보안 확인이 뜨면 이 방식으로는 로그인이 실패할 수 있으며, 그때는 브라우저 방식을
     사용해야 한다
  2. 자동 재로그인이 없으므로 앱을 다시 켜거나 토큰이 만료되면 직접 로그인해야 한다

  헤드리스 동작 방식, rung2 미검증 같은 내부 구현은 문구에 넣지 않는다.
  - **원문 문구 사용 금지:** R021/SC2의 *"매 로그인마다 이메일 OTP 필요"* 는 **반증됐다**
    (HAR 호출 0건). 그대로 쓰면 사용자에게 거짓을 안내하고 오지 않을 메일을 기다리게 한다.
    실제 제약은 reCAPTCHA 관문이다.

- **D-09:** **최초 1회 차단형 모달 + 이후 상시 인라인.** 사용자가 API 모드를 **처음** 선택할 때만
  확인을 받아야 진행되고(ROADMAP SC2의 "확인해야만 진행" 충족), 그 뒤에는 LoginPanel에 짧은
  인라인 안내문을 상시 노출한다. 확인 여부는 `settings.json`에 영속.

- **D-10:** **확인 상태는 고지 문구가 바뀔 때만 초기화한다.** `settings.json`에 *확인한 고지의
  버전*을 함께 저장하고, 제약이나 문구가 개정되면 재확인을 요구한다.
  - 근거: 이 프로젝트는 이미 계약이 한 번 뒤집혔다. 사용자가 낡은 안내만 확인한 채로 남는 것을
    구조적으로 막는다.

- **D-11:** **반증된 문서 서술은 삭제하지 않고 `[VOID]` 마킹 + 정정문 병기로 처리한다.**
  대상: `REQUIREMENTS.md` R021 Description/Notes, `ROADMAP.md` Phase 06 Success Criteria 2.
  - 근거: Phase 05가 세우고 PROJECT.md Key Decisions에 "✓ Good"으로 등록된 원칙("틀린 전제가
    코드보다 넓게 전파된다는 것을 05-01이 실증했다 — 왜 틀렸는지를 남겨야 재발을 막는다")을
    그대로 따른다.

### 실패 사유 한국어 안내 (R020)

- **D-12:** **R020의 대상을 "서버 에러코드 번역"에서 "사용자가 실제로 마주치는 실패의 정확한
  한국어 설명"으로 재정의한다.**
  - R020이 나열한 `-25003`/`-25044`/`-26000`/`-26004`/`RESTRICTED_OVERSEAS_LOGIN`은 전부
    **D-02로 제거하는 순수 HTTP 경로에서만** 발생한다. 그대로 구현하면 도달 불가능한 코드가 된다.
  - **실제 매핑 대상 (`credentialLogin()`의 실패 신호):**

    | 신호 (auth-service.ts) | 실제 의미 | 안내 방향 |
    |---|---|---|
    | `'otp'` (캡차 위젯 감지) | reCAPTCHA 챌린지 | D-13 |
    | `'error:<DOM 텍스트>'` | Weverse 폼이 표시한 오류 (대개 이미 한국어) | 그대로 살리되 전처리 |
    | `'timeout'` (25초) | 응답 대기 초과 | 재시도/브라우저 방식 안내 |
    | 예외 | 네트워크/런타임 오류 | D-14 fallback |
    | 사다리 실패 (`ApiAuthError`) | 토큰 획득 실패 | 재로그인 안내 |

- **D-13:** **캡차 오진을 수정한다 — 이 phase 최우선 안내 수정.** `auth-service.ts:405` 부근의
  ```js
  const recaptcha = document.querySelector('.AuthLoginCredentialWidgetUi_recapcha_wrapper__oMA4m');
  if (recaptcha) return 'otp';
  ```
  는 캡차 위젯을 감지하고도 `'otp'`를 반환한다. 그 결과 사용자는 캡차에 막혔는데 **"이메일로
  OTP가 발송되었습니다"** 를 보고 오지 않을 메일을 기다린다 — Phase 05가 반증한 오독이 UI에
  그대로 살아 있다.
  - 캡차 신호를 별도로 분류하고, 안내는 **설명 + 브라우저 방식 전환 제안**으로 한다:
    "Weverse가 보안 확인을 요구해 앱 안 로그인으로는 진행할 수 없습니다. 브라우저 로그인을
    사용해주세요" + 즉시 전환 버튼.
  - 숨겨진 창을 `show()`해서 사용자가 직접 풀게 하는 흐름은 **새 복구 매커니즘**이므로 이 phase
    범위 밖(deferred).
  - **⚠ 주의:** DOM 셀렉터가 해시 기반 CSS 모듈 클래스명(`__oMA4m`)이라 Weverse 배포마다 깨질
    수 있다. planner는 셀렉터 실패 시의 동작(→ D-14 fallback)을 반드시 정의할 것.

- **D-14:** **매핑되지 않은 실패는 "일반 안내 + 식별자 병기".** "로그인에 실패했습니다. 로그
  패널에서 자세한 내용을 확인하세요" + 원문 코드/식별자를 작게 병기한다. 사용자는 다음 행동을
  알고, 개발자는 문의 시 식별자로 추적할 수 있다. **R010 마스킹 규칙을 반드시 통과시킬 것.**

- **D-15:** **표시 위치는 LoginPanel 인라인.** 기존 `credMessage` / `.error-message` 자리를
  재사용하고 `role="alert"` 접근성을 유지한다. 새 UI 영역이나 모달을 추가하지 않는다(D-09의
  고지 모달과 연달아 뜨는 흐름을 피한다).

### Claude's Discretion

- 두 모드에 최종적으로 붙일 정확한 UI 라벨 문구, 고지 모달의 최종 카피 — 방향(D-08)은 정해졌고
  문장 다듬기는 구현자 재량.
- `settings.json`의 정확한 스키마/키 이름, `settings:*` IPC 채널 이름.
- 고지 버전(D-10)의 표현 방식 — 정수 버전 vs 문구 해시.
- 실패 신호 매핑 테이블을 어디에 둘지(`shared/` 순수 함수 권장 — 테스트 용이).
- 브라우저 모드(`login()`)의 실패 안내를 어디까지 손볼지 — D-12는 헤드리스 경로 중심이지만
  같은 매핑 테이블을 재사용할 수 있으면 그렇게 할 것.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 정정된 로그인 계약 — 최우선 정독
- `.planning/phases/05-api/05-01-SUMMARY.md` — **필수.** HAR 436 entries로 확정된 실제 로그인
  계약, 무효화된 전제 목록, 실사용 피해 2건의 경위. "무효화된 전제(Invalidated Assumptions)"
  섹션이 D-01/D-02/D-08의 1차 근거다.
- `.planning/phases/05-api/05-SPIKE-RESULT.md` — R019 실계정 판정. §2 관측 사실(캡차 timeout,
  쿠키 `rt` 후보, CDP 캡처), §3 미지수 해소 현황(rung2 미실행), §6 다음 단계. D-03의 "캡차는
  언제든 챌린지를 띄운다" 근거.
- `.planning/phases/05-api/05-CONTEXT.md` — **D-04**(API 모드 제품 경로 미결)와 **D-07**(무효
  메서드 정리 시점)이 이 phase의 D-01/D-02로 해소된다. **D-06**(실계정 안전 프로토콜)은 이
  phase에서도 그대로 유효하다.

### 요구사항·로드맵 — 정정 대상 포함
- `.planning/REQUIREMENTS.md` §R016 / §R020 / §R021 — 이 phase의 매핑 요구사항. **R020 Notes의
  에러코드 목록과 R021 Description의 "매 로그인마다 이메일 OTP"는 D-11에 따라 VOID 마킹 + 정정
  대상**이다.
- `.planning/REQUIREMENTS.md` §R017 / §R018 / §R019 — 정정된 계약(R017), 보류된 OTP(R018),
  검증된 사다리(R019). 배경 맥락.
- `.planning/ROADMAP.md` Phase 06 — **Success Criteria 2가 반증된 문구를 담고 있어 D-11 대상.**
  SC1은 D-03과 의도적 편차가 있으므로 verify 단계에서 이 CONTEXT를 함께 읽어야 한다.
- `.planning/PROJECT.md` — "계정 API 계약(2026-08-25 HAR 실측으로 정정)" 표, "핵심 제약",
  Out of Scope의 reCAPTCHA/자동 재로그인 정정 항목, Key Decisions 표.

### 유효한 보조 참조
- `.planning/phases/05-api/05-PATTERNS.md` — 신규 파일 ↔ 기존 유사 코드 매핑.
- `.planning/phases/05-api/05-RESEARCH.md` — reCAPTCHA site key 위치와 호출 그래프는 유효.
  **"스파이크 절차 1~4단계"는 전제 붕괴로 무효** — 그대로 믿지 말 것.

### 확보 불가 자료
- 사용자 제공 HAR(`full weverse.io.har`, 436 entries) — **저장소에 없다.** `05-01-SUMMARY.md`가
  유일한 정본 기록이며, 추가 계약 확인이 필요하면 사용자에게 재요청해야 한다.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/components/LoginPanel.tsx` — **이미 모드 탭 UI가 존재한다**(`"이메일 로그인" /
  "브라우저 로그인"`, `useState<LoginMode>`). D-04가 이것을 승격 대상으로 삼는다. 단 ①
  `useState`라 재시작 시 소실 ② 기본값이 `credential`(로드맵은 browser) ③ **OTP 입력 화면
  (`needOtp`)이 살아 있음**(D-02 제거 대상) ④ `credMessage` / `.error-message` 자리가 D-15의
  안내 표시 지점.
- `src/main/login-mode.ts` — `resolveLoginMode(env)`. **주석에 "Phase 06이 영속 설정으로
  갈아끼울 수 있도록 env를 파라미터로 받게 설계"라고 이미 예고돼 있다.** D-05/D-06의 진입점.
- `src/main/services/auth-service.ts:243` `credentialLogin()` — D-01의 API 모드 본체. 헤드리스
  BrowserWindow + DOM 자동입력.
- `src/main/services/auth-service.ts:939` `login(parentWindow)` — 브라우저 모드 본체. 보이는 창.
- `src/main/services/api-auth-client.ts` — `acquireFaneventToken()` 사다리 / `exchangeForService()`
  / `validateToken()` **유지**. `requestOtpSession` / `loginWithCredentials` **제거**(D-02).
- `src/main/services/profile-store.ts` — safeStorage 저장 패턴의 참고 원본. **단 D-05는 이
  파일을 쓰지 않는다**(`isEncryptionAvailable()` false 시 throw).
- `src/shared/mask.ts` — 마스킹 7종 + snake_case URL 쿼리 파라미터 룰(T-05-17로 추가됨).
  D-14의 식별자 병기가 반드시 통과해야 하는 관문.

### Established Patterns
- **생성자 주입 fetch** — 모든 HTTP 클라이언트가 `fetchFn`을 생성자로 받아 테스트에서 mock 주입.
- **모드 게이트 방어** — `tryAutoLogin()` / `tryAutoRelogin()` 최상단 게이트. 05-01에서 실제
  버그를 잡아낸 가드이므로 **약화시키지 말 것.** D-03은 이 가드를 *제거*하는 게 아니라 조건을
  *정정*하고 두 모드로 확대하는 것이다.
- **관측성 우선** — 서버 응답이 기대와 다르면 조용히 넘어가지 않고 즉시 실패. D-14의 fallback도
  "조용히 무시"가 아니라 "일반 안내 + 로그에 원문"이어야 한다.
- **쿠키 파티션 격리** — `persist:weverse`. `ApiAuthClient`는 electron을 import하지 않는다.
- **한국어 사용자 문구** — 기존 UI/에러 메시지가 전부 한국어. 새 문구도 동일.
- **순수 함수는 `src/shared/`** — `mask.ts`, `form-parser.ts`, `payload-builder.ts`가 모두
  테스트 가능한 순수 모듈. 실패 매핑 테이블도 여기가 적합.

### Integration Points
- `src/main/preload.ts` — **`settings:*` 네임스페이스가 없다.** D-05가 신설해야 한다. 현재는
  `auth:*` / `profile:*` / `apply:*` / `log:*` 4개.
- `src/main/ipc-handlers.ts:51,58` — `resolveLoginMode()==="api"` 분기 2곳. **D-02 제거 대상.**
- `src/main/services/auth-service.ts:170,212` — `tryAutoLogin()` / `tryAutoRelogin()` 모드 게이트.
  **D-03 정정 대상.** 주석의 "매 로그인마다 OTP 필요" 서술도 함께 고칠 것.
- `src/main/services/auth-service.ts:405` 부근 — DOM 폴링의 캡차→`'otp'` 오분류. **D-13 수정 대상.**
- `src/main/services/auth-service.ts:449` — `result === "otp"` 분기의 `otp-required` 이벤트와
  "이메일 OTP 인증이 필요합니다" 문구. D-13과 함께 수정.
- `src/main/__tests__/login-mode.test.ts` — D-06(env 우선)을 유지하면 기존 테스트가 살아있다.
  영속 설정 소스를 추가하는 형태로 확장할 것.

### 알려진 갭 / 주의
- **CSS 모듈 해시 셀렉터 의존** — `.AuthLoginCredentialWidgetUi_recapcha_wrapper__oMA4m`,
  `.text-field_error_wrap__9nRXJ`, `input[placeholder="인증코드 6자리"]` 등이 Weverse 배포마다
  깨질 수 있다. D-13/D-12 구현 시 셀렉터 실패의 폴백을 명시할 것.
- **`ProfileStore` fanId 불일치** — 05-SPIKE-RESULT §2에서 `loaded fanId=6871442` vs 검증된
  `fanId=9415932`. 이 phase 범위 밖이지만 로그인 흐름을 건드리므로 마주칠 수 있다(deferred).
- **로그아웃 버튼 노출 갭** — `LoginPanel.tsx`의 "로그아웃 + 자격 증명 삭제"가
  `status.isLoggedIn === true`일 때만 보인다. 로그인 실패 상태에서 `credentials.enc`를 앱으로
  지울 방법이 없다(deferred, Phase 07 후보).

</code_context>

<specifics>
## Specific Ideas

- **"UI가 거짓말하지 않게 한다"** 가 이 phase 전체를 관통하는 기준으로 반복해서 나타났다.
  D-06의 "환경변수로 고정됨" 표시, D-08의 반증된 문구 사용 금지, D-13의 캡차 오진 수정이
  모두 같은 원칙의 적용이다. 세 곳 중 하나라도 빠지면 사용자는 앱이 말하는 것과 다른 현실을
  마주하게 된다.

- **가장 눈에 띄는 단일 결함은 D-13의 캡차→OTP 오진이다.** 사용자를 *오지 않을 메일을
  기다리게* 만들며, 이는 단순한 문구 오류가 아니라 사용자의 시간을 직접 낭비시킨다.
  planner는 이것을 이 phase의 대표 수정 항목으로 다룰 것.

- **로드맵 SC1과의 편차(D-03)를 숨기지 않기로 했다.** "기존 브라우저 로그인 동작 변경 없이"를
  의도적으로 위반하며, 그 이유(05-01의 실제 계정 오동작 피해 + 캡차 챌린지의 예측 불가능성)를
  CONTEXT에 명시해 verify 단계가 회귀로 오판하지 않게 한다.

</specifics>

<deferred>
## Deferred Ideas

- **캡차 챌린지 시 헤드리스 창을 `show()`해 사용자가 직접 풀게 하는 복구 흐름** — 사용자 경험은
  가장 매끄럽지만 "실패 안내"가 아니라 **새 복구 매커니즘**이다. 별도 phase 후보.
  (D-13에서 논의됨 — 지금은 "브라우저 방식으로 전환 안내"로 대체)
- **rung2(명시적 account→fanevent 토큰 교환) 실경로 검증** — rung1 성공으로 사다리가 조기
  종료돼 **한 번도 실행된 적이 없다.** Open Question 2 / A3 / A4가 여전히 미확인.
  rung1이 깨지는 상황에서 폴백이 실제로 동작하는지는 미지수. (05-SPIKE-RESULT §6)
- **`ProfileStore` fanId 불일치** — `loaded fanId=6871442` vs 검증된 `fanId=9415932`.
  `ProfileStore`가 어느 시점에 갱신되는지 확인 필요. (05-SPIKE-RESULT §2)
- **로그아웃 UI 갭** — 로그인 실패/미시도 상태에서 `credentials.enc`를 앱에서 지울 수 없다.
  Phase 07(자격증명 저장 정책) 후보.
- **운영 조치 — 사용자 직접 수행 필요:** 2026-08-25 실계정 관측 당시의 실토큰이
  `~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log`에 평문으로 남아
  있다. T-05-17 수정(커밋 `186042f`)은 소급 적용되지 않는다. 코드 작업이 아니므로 이 phase에서
  다루지 않지만, 미해결 상태로 남아 있음을 기록한다.
- **`ApplyEngine`의 사다리 토큰 수용 행동 수준 검증** — shape 수준 근거로 사인오프됐다.
  실제 신청은 라이브 FIFO 이벤트에 대한 되돌릴 수 없는 행위라 검증 비용이 리스크를 초과한다.
  (05-UAT.md test 5)

</deferred>

---

*Phase: 06-ui*
*Context gathered: 2026-08-26*
