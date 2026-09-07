# Phase 06: 로그인 방식 선택 UI + 실패 안내 - Research

**Researched:** 2026-08-26
**Domain:** Electron/React 데스크톱 앱의 로컬 설정 영속화, IPC 계약 확장, 실패 신호 분류/한국어 안내, 접근성 모달
**Confidence:** HIGH (전체 코드베이스 실측 기반 — 신규 외부 지식 의존도가 낮은 phase)

## Summary

이 phase는 새 기능을 만드는 것이 아니라 **이미 존재하는 두 로그인 경로(`credentialLogin()` 헤드리스,
`login()` 브라우저) 위에 선택·고지·안내 계층을 얹는 작업**이다. 코드 실측 결과, 이 phase가 손대야 할
표면은 생각보다 좁고 명확하다 — `resolveLoginMode()` 시그니처 확장, 신규 `settings:*` IPC 3~4개, 기존
`LoginPanel.tsx` 탭의 소유권을 `useState`에서 영속 설정으로 이전, `auth-service.ts`의 DOM 폴링 결과를
캡차/폼에러/타임아웃으로 재분류하는 순수 함수 하나, 그리고 `ApiAuthClient`/`AuthService`에서 반증된
3단계 로그인 계약 관련 메서드를 제거하는 작업이다.

가장 중요한 실측 발견은 세 가지다. 첫째, `resolveLoginMode(env)`의 기존 시그니처와 `login-mode.test.ts`의
6개 테스트를 깨지 않으면서 D-06(설정 폴백)을 추가하는 방법은 **두 번째 선택적 매개변수를 추가**하는
것이다(기존 테스트는 이 매개변수를 전달하지 않으므로 그대로 통과한다). 둘째, `logService.log()`는
`maskSensitive()`를 **자동으로** 적용하지만(모든 로그 라인 통과), **렌더러에 보여줄 `CredentialLoginResult.message`
필드는 이 자동 마스킹 경로를 거치지 않는다** — D-14의 식별자 병기 문구는 로그가 아니라 별도로
`maskSensitive()`를 통과시켜야 R010을 만족한다. 셋째, `api-auth-client.test.ts`의 7개 describe 블록 중
5개(`otp-session`/`otp verify`/`error`/`tracer`/`민감정보`)가 D-02로 제거되는 메서드를 직접 호출하고 있어
전면 재작성이 필요하고, `auth-service.test.ts`의 "브라우저 모드... 기존 동작 무변경 (D-01 회귀 확인)"이라는
이름의 테스트는 D-03 적용 후 **그 이름 자체가 틀리게 된다**(더 이상 "무변경"이 아니라 의도된 변경이다) —
삭제가 아니라 이름과 단언을 D-03에 맞게 다시 써야 한다.

**Primary recommendation:** 새 npm 패키지를 추가하지 않는다(electron-store는 ESM-only라 이 프로젝트의
CommonJS main 프로세스에서 `require()`할 수 없음을 확인함 — 기존 `profile-store.ts`처럼 얇은 `fs` 래퍼로
`settings.json`을 구현). 모달은 네이티브 `<dialog>.showModal()`을 쓴다(포커스 트랩·Esc·backdrop이 내장돼
있어 이 코드베이스의 "UI 라이브러리 없음" 관례와 정확히 들어맞는다). 실패 신호 매핑은 `src/shared/`의
순수 함수 하나(`mapLoginFailure()` 류)로 구현하고, 렌더러 컴포넌트 로직 테스트는 이 코드베이스의 기존
관례(`profile-form-validation.test.ts`)를 따라 **컴포넌트를 렌더링하지 않고 판단 로직만 추출해 단위
테스트**한다(jsdom/RTL 의존성 없음, 그대로 유지).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 로그인 방식 탭 UI (선택/표시) | Frontend/Renderer (React) | — | 순수 표시·상호작용, 상태 소유권만 main으로 이전 |
| 선택값 영속 저장 (`settings.json`) | Backend/Main (Electron main, `fs`) | — | `userData` 디렉토리 접근은 main 프로세스 전용 |
| env-vs-설정 우선순위 해소 | Backend/Main (`login-mode.ts` 순수 함수) | Shared 원칙 | `process.env`는 main에서만 신뢰 가능한 입력 |
| `settings:*` IPC 계약 | Bridge (`preload.ts` contextBridge) | Backend/Main (`ipc-handlers.ts`) | 기존 4개 네임스페이스(`auth`/`profile`/`apply`/`log`)와 동일 패턴 |
| 제약 고지 모달 (최초 1회 차단) | Frontend/Renderer (React + native `<dialog>`) | Backend/Main (확인 버전 영속) | UI는 렌더러, "확인했다"는 사실의 기록은 main |
| 확인 버전 영속 | Backend/Main (`settings.json`) | — | 재시작 후에도 재확인 요구 여부를 판단해야 함 |
| 실패 신호 분류(캡차/폼에러/타임아웃/네트워크/사다리 실패) | Shared (`src/shared/` 순수 함수) | Backend/Main (`auth-service.ts` 호출부) | 순수 함수라야 vitest로 렌더링 없이 전수 테스트 가능 (mask.ts/form-parser.ts 관례) |
| 실패 안내 표시 (인라인, `role="alert"`) | Frontend/Renderer (`LoginPanel.tsx`) | — | D-15: 기존 `credMessage`/`.error-message` 자리 재사용, 새 UI 영역 금지 |
| 반증된 API 로그인 코드 제거 (D-02) | Backend/Main (`auth-service.ts`, `api-auth-client.ts`, `ipc-handlers.ts`) | — | 순수 삭제 작업, 새 계층 없음 |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**API 모드의 실체 정의 (D-04 해소)**

- **D-01:** API 모드 = `credentialLogin()` 헤드리스 자동입력 경로. 사용자가 앱 안에서 이메일/비밀번호를
  입력하면 `show: false` BrowserWindow가 실제 로그인 페이지를 띄워 DOM 자동입력으로 대신 로그인하고,
  reCAPTCHA는 그 페이지가 스스로 처리한다. 순수 HTTP `by-credentials`는 reCAPTCHA 관문에 막히므로
  (R017/HAR 실측), Phase 05가 실계정으로 rung1 성립을 확인한 이 경로가 유일하게 동작하는 자격증명
  로그인 경로다. Reversibility: costly.

- **D-02:** 반증된 계약 기반 코드를 이번 phase에서 제거한다 — `credentialLoginApi()`,
  `ApiAuthClient.requestOtpSession()`, `loginWithCredentials()`, `submitOtpApi()`, 그리고
  `ipc-handlers.ts`의 `resolveLoginMode()==="api"` 분기(`auth:credential-login`, `auth:submit-otp`),
  `LoginPanel.tsx`의 OTP 입력 화면(`needOtp` 상태 전체). 유지 대상: `ApiAuthClient`의
  `acquireFaneventToken()` 사다리, `exchangeForService()`(rung2), `validateToken()` — R019 자산이며
  D-01과 무관하게 유효하다. `credentialLoginApi`가 `-25044`를 "OTP 필요"로 오독해 오지 않을 메일을
  기다리게 하는 거짓 OTP 화면을 띄우는 문제가 남겨두면 안 되는 근거다. Reversibility: reversible.

- **D-03:** 무인 자동 로그인은 두 모드 모두 차단한다. `tryAutoLogin()`/`tryAutoRelogin()`의 게이트를
  *모드 조건*이 아니라 *"외부에 로그인 요청을 발생시키는가"*로 재정의한다. 허용(두 모드 공통):
  `extractTokenFromCookies()` — 살아있는 쿠키 토큰으로의 세션 복원. 차단(두 모드 공통): 저장된
  자격증명으로의 `credentialLogin()` 무인 호출. 외부 로그인 요청은 항상 사용자 클릭에서만 발생한다.
  근거: 기존 게이트의 명시된 사유("매 로그인마다 OTP 강제")는 반증됐고, 05-01에서 `tryAutoLogin()`
  모드 게이트 누락으로 저장된 다른 계정에 헤드리스 로그인이 시도되어 실제 알림 메일이 발송됐다.
  캡차는 언제든 인터랙티브 챌린지를 띄울 수 있어(05에서 1차 시도 `result=timeout` 실측) 무인
  재로그인은 어느 모드에서든 보장 불가다. **⚠ 로드맵 SC1과의 의도적 편차:** ROADMAP Phase 06 SC1은
  "기존 브라우저 로그인 동작은 변경 없이"라고 쓰여 있으나, 이 결정은 브라우저 모드의 `tryAutoLogin()`
  자격증명 경로도 제거한다. verify 단계는 이를 회귀가 아니라 의도된 변경으로 판정해야 한다. 부수 효과:
  R022(토큰 만료 사전 경고, Phase 07)의 필요성이 두 모드 전체로 확대된다. Reversibility: reversible.

**선택기 UI + 선택값 영속 (R016)**

- **D-04:** 기존 `LoginPanel.tsx` 탭을 영속 선택기로 승격한다. 새 UI 영역을 만들지 않고 현재의
  "이메일 로그인 / 브라우저 로그인" 탭을 재사용하되 ① 라벨을 D-01의 실체에 맞게 재작성 ② 클릭 즉시
  영속 저장 ③ 기본값을 `browser`로 변경(현재 코드는 `credential`이 기본이라 로드맵 SC1과 어긋난다).

- **D-05:** 선택값은 `userData`의 별도 평문 `settings.json`에 저장한다. `settings:*` IPC 네임스페이스를
  신설한다(preload에 현재 없음). `profile.enc`를 쓰지 않는 이유: `ProfileStore`는
  `safeStorage.isEncryptionAvailable()`가 false면 예외를 던진다. 로그인 방식은 비민감 값인데 여기 넣으면
  키체인 없는 환경에서 모드 선택 자체가 깨지고, 프로필을 지우면 로그인 방식도 함께 날아가는 결합이
  생긴다. 파일 부재/파싱 실패 시 기본값(`browser`)으로 조용히 폴백하고 경고 로그만 남긴다. Phase 07의
  설정 항목들도 이 파일 위에 쌓을 수 있다. Reversibility: reversible. 단 `settings:*` IPC 채널은 한 번
  열면 preload 계약이 되므로 이름을 신중히 고를 것.

- **D-06:** `AUTOVERSE_LOGIN_MODE` env가 저장된 설정보다 우선한다(env가 설정되어 있으면 저장값을 덮어씀).
  기존 `resolveLoginMode()` 시그니처와 `login-mode.test.ts`가 그대로 살아있고, 개발/QA에서 앱 상태를
  건드리지 않고 모드를 강제할 수 있다. 파생 요구사항(필수): UI가 거짓말하지 않도록 선택기에
  "환경변수로 고정됨" 표시 + 조작 불가 상태를 함께 구현한다.

- **D-07:** 로그인된 상태에서 방식을 바꾸면 설정만 바뀌고 현재 세션은 유지된다. 바뀐 방식은 다음
  로그인부터 적용. 신청 대기 중 실수로 탭을 눌러 세션이 날아가는 사고를 방지한다.

**제약 고지 (R021)**

- **D-08:** 고지 문구는 사용자 체감 중심 2가지만 담는다: (1) Weverse 보안 확인이 뜨면 이 방식으로는
  로그인이 실패할 수 있으며, 그때는 브라우저 방식을 사용해야 한다. (2) 자동 재로그인이 없으므로 앱을
  다시 켜거나 토큰이 만료되면 직접 로그인해야 한다. 헤드리스 동작 방식, rung2 미검증 같은 내부 구현은
  문구에 넣지 않는다. **원문 문구 사용 금지:** R021/SC2의 "매 로그인마다 이메일 OTP 필요"는 반증됐다
  (HAR 호출 0건). 그대로 쓰면 사용자에게 거짓을 안내하고 오지 않을 메일을 기다리게 한다. 실제 제약은
  reCAPTCHA 관문이다.

- **D-09:** 최초 1회 차단형 모달 + 이후 상시 인라인. 사용자가 API 모드를 처음 선택할 때만 확인을
  받아야 진행되고(ROADMAP SC2의 "확인해야만 진행" 충족), 그 뒤에는 LoginPanel에 짧은 인라인 안내문을
  상시 노출한다. 확인 여부는 `settings.json`에 영속.

- **D-10:** 확인 상태는 고지 문구가 바뀔 때만 초기화한다. `settings.json`에 확인한 고지의 버전을 함께
  저장하고, 제약이나 문구가 개정되면 재확인을 요구한다. 근거: 이 프로젝트는 이미 계약이 한 번
  뒤집혔다. 사용자가 낡은 안내만 확인한 채로 남는 것을 구조적으로 막는다.

- **D-11:** 반증된 문서 서술은 삭제하지 않고 `[VOID]` 마킹 + 정정문 병기로 처리한다. 대상:
  `REQUIREMENTS.md` R021 Description/Notes, `ROADMAP.md` Phase 06 Success Criteria 2. 근거: Phase 05가
  세우고 PROJECT.md Key Decisions에 "✓ Good"으로 등록된 원칙("틀린 전제가 코드보다 넓게 전파된다는
  것을 05-01이 실증했다 — 왜 틀렸는지를 남겨야 재발을 막는다")을 그대로 따른다.

**실패 사유 한국어 안내 (R020)**

- **D-12:** R020의 대상을 "서버 에러코드 번역"에서 "사용자가 실제로 마주치는 실패의 정확한 한국어
  설명"으로 재정의한다. R020이 나열한 `-25003`/`-25044`/`-26000`/`-26004`/`RESTRICTED_OVERSEAS_LOGIN`은
  전부 D-02로 제거하는 순수 HTTP 경로에서만 발생한다. 실제 매핑 대상(`credentialLogin()`의 실패 신호):
  `'otp'`(캡차 위젯 감지) → reCAPTCHA 챌린지 → D-13, `'error:<DOM 텍스트>'` → Weverse 폼이 표시한 오류
  (대개 이미 한국어) → 그대로 살리되 전처리, `'timeout'`(25초) → 응답 대기 초과 → 재시도/브라우저 방식
  안내, 예외 → 네트워크/런타임 오류 → D-14 fallback, 사다리 실패(`ApiAuthError`) → 토큰 획득 실패 →
  재로그인 안내.

- **D-13:** 캡차 오진을 수정한다 — 이 phase 최우선 안내 수정. `auth-service.ts:405` 부근이 캡차 위젯을
  감지하고도 `'otp'`를 반환해, 사용자가 캡차에 막혔는데 "이메일로 OTP가 발송되었습니다"를 보고 오지
  않을 메일을 기다린다. 캡차 신호를 별도로 분류하고, 안내는 설명 + 브라우저 방식 전환 제안으로 한다:
  "Weverse가 보안 확인을 요구해 앱 안 로그인으로는 진행할 수 없습니다. 브라우저 로그인을 사용해주세요"
  + 즉시 전환 버튼. 숨겨진 창을 `show()`해서 사용자가 직접 풀게 하는 흐름은 새 복구 매커니즘이므로
  이 phase 범위 밖(deferred). **⚠ 주의:** DOM 셀렉터가 해시 기반 CSS 모듈 클래스명(`__oMA4m`)이라
  Weverse 배포마다 깨질 수 있다. planner는 셀렉터 실패 시의 동작(→ D-14 fallback)을 반드시 정의할 것.

- **D-14:** 매핑되지 않은 실패는 "일반 안내 + 식별자 병기". "로그인에 실패했습니다. 로그 패널에서
  자세한 내용을 확인하세요" + 원문 코드/식별자를 작게 병기한다. R010 마스킹 규칙을 반드시 통과시킬 것.

- **D-15:** 표시 위치는 LoginPanel 인라인. 기존 `credMessage`/`.error-message` 자리를 재사용하고
  `role="alert"` 접근성을 유지한다. 새 UI 영역이나 모달을 추가하지 않는다(D-09의 고지 모달과 연달아
  뜨는 흐름을 피한다).

### Claude's Discretion

- 두 모드에 최종적으로 붙일 정확한 UI 라벨 문구, 고지 모달의 최종 카피 — 방향(D-08)은 정해졌고
  문장 다듬기는 구현자 재량.
- `settings.json`의 정확한 스키마/키 이름, `settings:*` IPC 채널 이름.
- 고지 버전(D-10)의 표현 방식 — 정수 버전 vs 문구 해시.
- 실패 신호 매핑 테이블을 어디에 둘지(`shared/` 순수 함수 권장 — 테스트 용이).
- 브라우저 모드(`login()`)의 실패 안내를 어디까지 손볼지 — D-12는 헤드리스 경로 중심이지만 같은
  매핑 테이블을 재사용할 수 있으면 그렇게 할 것.

### Deferred Ideas (OUT OF SCOPE)

- 캡차 챌린지 시 헤드리스 창을 `show()`해 사용자가 직접 풀게 하는 복구 흐름 — 별도 phase 후보.
- rung2(명시적 account→fanevent 토큰 교환) 실경로 검증 — rung1 성공으로 사다리가 조기 종료돼 한 번도
  실행된 적이 없다.
- `ProfileStore` fanId 불일치 — `loaded fanId=6871442` vs 검증된 `fanId=9415932`.
- 로그아웃 UI 갭 — 로그인 실패/미시도 상태에서 `credentials.enc`를 앱에서 지울 수 없다. Phase 07 후보.
- 운영 조치 — 2026-08-25 실계정 관측 당시의 실토큰이 로그 파일에 평문으로 남아 있다. 코드 작업이
  아니므로 이 phase에서 다루지 않지만, 미해결 상태로 남아 있음을 기록한다.
- `ApplyEngine`의 사다리 토큰 수용 행동 수준 검증 — shape 수준 근거로 사인오프됐다.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R016 | 사용자가 로그인 방식을 API 통신과 브라우저 중 선택할 수 있고, 선택이 다음 실행에도 유지된다 | `settings.json` 스키마 설계(Q1), `settings:*` IPC 계약(Q2), `resolveLoginMode()` 확장(Q3), `LoginPanel.tsx` 탭 승격 경로(D-04) — 모두 아래 Architecture Patterns/Code Examples에 구체화 |
| R020 | API 로그인 실패 사유를 사용자가 이해할 수 있는 한국어 메시지로 매핑 (D-12로 재정의: `credentialLogin()`의 실제 실패 신호 대상) | 실패 신호 분류 순수 함수 설계(Q5), 캡차 오진 수정(D-13), R010 마스킹 경로의 렌더러-노출 갭 발견(Common Pitfalls) |
| R021 | API 모드 선택 시 제약 사전 고지 (D-08로 재정의: reCAPTCHA 제약 + 자동 재로그인 불가, OTP 문구 금지) | 네이티브 `<dialog>` 모달 패턴(Q7), 고지 버전 영속 스키마(D-10), REQUIREMENTS.md/ROADMAP.md VOID 마킹 정확한 포맷(Q8) |

</phase_requirements>

## Standard Stack

### Core

이 phase는 **신규 런타임 의존성을 추가하지 않는다.** 기존 스택(Electron 33.3.1, React 18.3.1, TypeScript
5.7.2, Vite 6.0.5, vitest 4.1.6)만으로 모든 요구사항을 구현할 수 있음을 실측으로 확인했다.

| Library | Version | Purpose | Why Standard (이 코드베이스 기준) |
|---------|---------|---------|--------------|
| (신규 없음) | — | `settings.json` 영속화 | `fs` 모듈만으로 충분 — `profile-store.ts`가 이미 이 패턴 |
| 네이티브 `<dialog>` | Chromium 내장 (Electron 33 = Chromium 130대) | D-09 차단형 고지 모달 | 포커스 트랩·Esc·top-layer·`::backdrop`이 브라우저 내장 [CITED: https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (없음) | — | — | 이 phase는 supporting 의존성도 요구하지 않는다 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 얇은 `fs` 기반 `settings.json` 래퍼 | `electron-store` (npm, latest 11.0.2) | **채택하지 않음.** `electron-store@11`은 ESM-only(`package.json`에 `type:module`)이고, 이 프로젝트의 `tsconfig.main.json`은 `"module": "CommonJS"`로 main 프로세스를 컴파일한다 [VERIFIED: tsconfig.main.json:6] — `require()`가 `ERR_REQUIRE_ESM`으로 즉시 실패한다 [CITED: https://github.com/electron-react-boilerplate/electron-react-boilerplate/issues/3112]. 동적 `import()`로 우회 가능하지만 2~3개 키뿐인 설정 파일에 비대칭적으로 큰 복잡도를 추가한다. `ProfileStore`(41줄)와 동일 규모의 커스텀 래퍼가 이 코드베이스 관례에 맞다. |
| 네이티브 `<dialog>` | 커스텀 오버레이 `<div>` + 수동 포커스 트랩 | 포커스 트랩/Esc/backdrop을 직접 구현해야 하고, 이 코드베이스엔 참고할 기존 모달 컴포넌트가 전혀 없다(`grep -riE "dialog\|modal\|overlay"` over `src/renderer/styles.css` → 0 matches) [VERIFIED: src/renderer/styles.css]. `.show()`(non-modal)가 아니라 `.showModal()`을 반드시 써야 트랩/backdrop이 적용된다는 점만 구현자가 주의하면 됨. |

**Installation:**
```bash
# 이 phase는 npm install 을 실행하지 않는다.
```

## Package Legitimacy Audit

> 이 phase는 외부 패키지를 설치하지 않는다 — Package Legitimacy Gate 프로토콜 실행 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| electron-store | npm | 성숙(수년) | 높음 | github.com/sindresorhus/electron-store | 검토했으나 채택 안 함 | **NOT ADOPTED** — ESM-only가 이 프로젝트의 CommonJS main 프로세스와 비호환(위 Alternatives Considered 참고). 정당성/평판 문제가 아니라 순수 기술 비호환 사유. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────── Renderer (React) ───────────────────────────────┐
│                                                                                  │
│  App.tsx (mount)                                                                │
│    │ useEffect: window.api.settings.getLoginMode()  ──────────────┐            │
│    │ useEffect: window.api.auth.getStatus()                       │            │
│    ▼                                                               │            │
│  LoginPanel.tsx                                                    │            │
│    ├─ mode tabs (persisted, not useState) ◄─────────────────────────┘          │
│    │    "이메일 로그인"(API=credentialLogin) │ "브라우저 로그인"(login())        │
│    │    lockedByEnv=true → 탭 disabled + "환경변수로 고정됨" 배지               │
│    │                                                                            │
│    ├─ [최초 API 선택 시] NoticeModal (native <dialog>.showModal())              │
│    │    확인 클릭 → window.api.settings.ackApiModeNotice(version)               │
│    │                                                                            │
│    ├─ [이후 API 모드 상시] 짧은 인라인 안내문 (D-08 문구)                        │
│    │                                                                            │
│    └─ 실패 시: credMessage 자리, role="alert"                                   │
│         message = mapLoginFailure(reason, detail).message  (D-15)               │
│                                                                                  │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                     │ IPC (contextBridge, preload.ts)
┌────────────────────────────────────▼──────────────────────────────────────────┐
│                              Main Process (Electron)                           │
│                                                                                  │
│  ipc-handlers.ts                                                               │
│    settings:get-login-mode  → { mode, lockedByEnv }                            │
│    settings:set-login-mode  → settingsStore.setLoginMode()                     │
│    settings:get-notice-ack  → { ackedVersion, currentVersion }                 │
│    settings:ack-notice      → settingsStore.ackApiModeNotice()                 │
│    auth:credential-login    → authService.credentialLogin() (모드 분기 없음)    │
│    auth:auto-login          → authService.tryAutoLogin()                       │
│                                                                                  │
│  login-mode.ts                                                                 │
│    resolveLoginMode(env, persistedMode?) ── env 우선, else persisted, else browser │
│    isLoginModeLockedByEnv(env) ── boolean                                      │
│                                                                                  │
│  settings-store.ts (신규, profile-store.ts 패턴 미러링, throw 없음)             │
│    getLoginMode() / setLoginMode() / getNoticeAck() / ackNotice()              │
│    파싱 실패 → 기본값(browser) 폴백 + 경고 로그                                 │
│    ↓ fs.readFileSync/writeFileSync                                             │
│    userData/settings.json                                                      │
│                                                                                  │
│  auth-service.ts :: credentialLogin()                                          │
│    DOM 폴링 결과(otp→captcha 재분류/error:/timeout/exception)                   │
│      → src/shared/login-failure.ts :: classifyLoginFailure() (순수 함수)        │
│      → CredentialLoginResult.message = maskSensitive(mapLoginFailure(...))     │
│                                                                                  │
│  tryAutoLogin() / tryAutoRelogin() (D-03 재정의)                                │
│    쿠키 세션 복원(허용, 두 모드 공통) / credentialLogin() 무인 호출(차단, 공통)  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── shared/
│   ├── login-failure.ts        # 신규 — D-12/D-13/D-14 실패 신호 → 한국어 안내 순수 함수
│   ├── mask.ts                 # 기존 — 변경 없음 (maskSensitive는 로그 경로만 자동 적용됨에 주의)
│   └── types.ts                # 수정 — LoginMode, 설정 IPC 타입, CredentialLoginResult 확장(reason?)
├── main/
│   ├── login-mode.ts           # 수정 — resolveLoginMode(env, persistedMode?) + isLoginModeLockedByEnv(env)
│   ├── preload.ts              # 수정 — settings:* 4개 API 추가
│   ├── ipc-handlers.ts         # 수정 — settings:* 핸들러 등록, auth:credential-login/submit-otp 모드 분기 제거
│   └── services/
│       ├── settings-store.ts   # 신규 — profile-store.ts 패턴, throw 없음, 기본값 폴백
│       ├── auth-service.ts     # 수정 — credentialLoginApi/submitOtpApi/finishApiLogin 삭제, DOM 폴링 재분류
│       └── api-auth-client.ts  # 수정 — requestOtpSession/loginWithCredentials 삭제 (verifyOtp는 Open Question)
└── renderer/
    ├── components/
    │   ├── LoginPanel.tsx      # 수정 — 탭을 props로 승격, needOtp 삭제, D-15 인라인 안내
    │   └── ApiModeNoticeModal.tsx  # 신규 — native <dialog>, D-09
    └── App.tsx                 # 수정 — mount 시 settings:get-login-mode 조회 후 LoginPanel에 전달
```

### Pattern 1: `resolveLoginMode()` 하위 호환 확장 (D-06)

**What:** 기존 시그니처를 깨지 않고 두 번째 선택적 매개변수로 영속 설정값을 받는다.
**When to use:** D-06의 "env 우선 → 설정값 → browser" 우선순위를 구현할 때.
**Example:**
```typescript
// Source: src/main/login-mode.ts:18-26 [VERIFIED: src/main/login-mode.ts:18-26] (기존 코드, 확장 방향 제안)
export function resolveLoginMode(
  env: NodeJS.ProcessEnv = process.env,
  persistedMode?: LoginMode,
): LoginMode {
  const raw = env[LOGIN_MODE_ENV];
  if (typeof raw === "string" && raw.trim().toLowerCase() === "api") {
    return "api";
  }
  if (persistedMode === "api") return "api";
  return "browser";
}

export function isLoginModeLockedByEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[LOGIN_MODE_ENV];
  return typeof raw === "string" && raw.trim().length > 0;
}
```
`login-mode.test.ts`의 6개 기존 테스트는 `resolveLoginMode(fakeEnv)` 형태로 두 번째 인자 없이 호출하므로
(`persistedMode`가 `undefined`) 위 확장으로도 100% 그대로 통과한다 [VERIFIED: src/main/__tests__/login-mode.test.ts:9-32].
`isLoginModeLockedByEnv()`를 반환 타입을 바꾸지 않고 별도 함수로 분리한 이유: `resolveLoginMode()`의
반환 타입을 객체로 바꾸면 기존 `expect(resolveLoginMode(...)).toBe("browser")` 식의 단언(문자열 동등
비교)이 전부 깨진다.

### Pattern 2: `settings-store.ts` — throw 없는 폴백 (D-05)

**What:** `ProfileStore`와 같은 파일 저장 관례를 따르되, 암호화 미가용 시 예외를 던지는 대신 조용히
기본값으로 폴백한다.
**When to use:** 비민감 설정값(로그인 모드, 고지 확인 버전) 저장 전반.
**Example:**
```typescript
// Source: src/main/services/profile-store.ts 패턴 참고, 새 파일 skeleton
// [VERIFIED: src/main/services/profile-store.ts:14-34] — 대조: ProfileStore.saveProfile()은
// safeStorage.isEncryptionAvailable()===false 일 때 throw 한다("평문 저장 거부").
// settings-store.ts는 이 phase 목적상 정반대로 동작해야 한다(D-05: "조용히 기본값 폴백").
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { logService } from "./log-service";

const SETTINGS_FILENAME = "settings.json";
const SCHEMA_VERSION = 1;
const DEFAULT_LOGIN_MODE = "browser" as const;

interface SettingsFile {
  schemaVersion: number;
  loginMode: "api" | "browser";
  apiModeNoticeAckedVersion: number | null;
}

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), SETTINGS_FILENAME);
}

function readSettings(): SettingsFile {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) {
    return { schemaVersion: SCHEMA_VERSION, loginMode: DEFAULT_LOGIN_MODE, apiModeNoticeAckedVersion: null };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SettingsFile>;
    return {
      schemaVersion: SCHEMA_VERSION,
      loginMode: parsed.loginMode === "api" ? "api" : DEFAULT_LOGIN_MODE,
      apiModeNoticeAckedVersion:
        typeof parsed.apiModeNoticeAckedVersion === "number" ? parsed.apiModeNoticeAckedVersion : null,
    };
  } catch (err) {
    logService.warn("SettingsStore", `settings.json 파싱 실패 — 기본값(browser) 폴백: ${String(err)}`);
    return { schemaVersion: SCHEMA_VERSION, loginMode: DEFAULT_LOGIN_MODE, apiModeNoticeAckedVersion: null };
  }
}

function writeSettings(next: SettingsFile): void {
  const filePath = getSettingsPath();
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2));
  fs.renameSync(tmpPath, filePath); // 같은 디렉토리 내 rename은 POSIX에서 원자적
}
```
임시파일+rename 패턴은 표준 관행이다: 같은 파일시스템 내 `rename()`은 원자적이라 읽는 쪽이 절반만
쓰인 상태를 절대 보지 않는다 [CITED: https://github.com/npm/write-file-atomic]. 이 파일 크기(수십
바이트~수백 바이트)에서 매 쓰기마다 `fsync()`까지 강제하는 것은 과함 — 손실 허용 가능한 로컬 UI 설정이지
WAL/DB 수준의 내구성 요구가 아니다 [CITED: https://0xkiire.com/crash-consistency-fsync-rename/].

### Pattern 3: 네이티브 `<dialog>` 차단형 고지 모달 (D-09)

**What:** 포커스 트랩·Esc·backdrop이 내장된 브라우저 네이티브 모달.
**When to use:** API 모드 최초 선택 시 D-09의 "확인해야만 진행" 요건.
**Example:**
```tsx
// Source: 브라우저 표준 API 기반 skeleton (신규 파일 제안)
import { useEffect, useRef } from "react";

interface ApiModeNoticeModalProps {
  open: boolean;
  onAcknowledge: () => void;
}

export default function ApiModeNoticeModal({ open, onAcknowledge }: ApiModeNoticeModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal(); // .show()가 아니라 .showModal() — 트랩/backdrop 필수
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby="api-mode-notice-title">
      <h2 id="api-mode-notice-title">API 로그인 방식 안내</h2>
      <p>Weverse 보안 확인(캡차)이 뜨면 이 방식으로는 로그인이 실패할 수 있으며, 그때는 브라우저 방식을
        사용해야 합니다.</p>
      <p>자동 재로그인이 없으므로 앱을 다시 켜거나 토큰이 만료되면 직접 로그인해야 합니다.</p>
      <button onClick={onAcknowledge}>확인했습니다</button>
    </dialog>
  );
}
```
`showModal()`은 문서의 나머지 부분을 inert 처리하고(탭/클릭/스크린리더 불가), 포커스를 다이얼로그
안에 가두며, Esc를 자동으로 닫기에 연결하고, backdrop과 함께 top layer에 렌더링한다
[CITED: https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/]. `<dialog>`는
암묵적으로 `dialog` role을 가지므로 별도 `role="alertdialog"`를 원하면 명시적으로 추가해야 한다 —
다만 이 phase의 용도(정보 확인, 위험한 되돌릴 수 없는 작업 경고가 아님)에는 기본 `dialog` role로 충분하다.

### Pattern 4: 실패 신호 분류 순수 함수 (D-12/D-13/D-14)

**What:** `credentialLogin()`의 DOM 폴링 결과 문자열을 타입드 사유로 변환하고, 사유별 한국어 안내를
생성하는 순수 함수.
**When to use:** `auth-service.ts`의 폴링 결과 처리부와 (선택) 브라우저 모드 실패 처리부.
**Example:**
```typescript
// Source: src/main/services/auth-service.ts:398-411 [VERIFIED: src/main/services/auth-service.ts:398-411]
// 현재 코드 원문 (재분류 대상):
//   const otpInput = document.querySelector('input[placeholder="인증코드 6자리"]');
//   if (otpInput) return 'otp';
//   const recaptcha = document.querySelector('.AuthLoginCredentialWidgetUi_recapcha_wrapper__oMA4m');
//   if (recaptcha) return 'otp';   // ← D-13이 고치는 오분류: 캡차인데 'otp'를 반환
//   const errWraps = document.querySelectorAll('.text-field_error_wrap__9nRXJ .text-field_error_text__BwsFg, [class*="error_message"]');
//   for (const el of errWraps) {
//     const t = el.textContent.trim();
//     if (t.length > 3) return 'error:' + t;
//   }
//   return null;

// src/shared/login-failure.ts (신규, 제안)
export type LoginFailureReason =
  | "captcha"
  | "form-error"
  | "timeout"
  | "network-error"
  | "token-ladder-failed"
  | "unknown";

export interface LoginFailureGuidance {
  message: string;
  suggestBrowserSwitch: boolean;
  identifier?: string; // D-14 병기용 — 호출부가 maskSensitive()로 감싼 뒤 넘길 것
}

export function mapLoginFailure(
  reason: LoginFailureReason,
  detail?: string,
): LoginFailureGuidance {
  switch (reason) {
    case "captcha":
      return {
        message: "Weverse가 보안 확인을 요구해 앱 안 로그인으로는 진행할 수 없습니다. 브라우저 로그인을 사용해주세요.",
        suggestBrowserSwitch: true,
      };
    case "form-error":
      return { message: detail ?? "로그인 실패", suggestBrowserSwitch: false };
    case "timeout":
      return {
        message: "로그인 응답 대기 시간을 초과했습니다. 다시 시도하거나 브라우저 로그인을 사용해주세요.",
        suggestBrowserSwitch: true,
      };
    case "network-error":
      return { message: "네트워크 오류로 로그인에 실패했습니다.", suggestBrowserSwitch: false, identifier: detail };
    case "token-ladder-failed":
      return { message: "로그인은 성공했지만 서비스 토큰 확보에 실패했습니다. 다시 로그인해주세요.", suggestBrowserSwitch: false, identifier: detail };
    default:
      return {
        message: "로그인에 실패했습니다. 로그 패널에서 자세한 내용을 확인하세요.",
        suggestBrowserSwitch: false,
        identifier: detail,
      };
  }
}
```
이 함수는 `mask.ts`/`form-parser.ts`와 동일하게 electron import 없는 순수 함수라 vitest로 렌더링 없이
전수(exhaustive) 테스트가 가능하다 [VERIFIED: src/shared/form-parser.ts:1-4] (동일 관례).

### Anti-Patterns to Avoid

- **`credMessage`/식별자 필드에 `maskSensitive()`를 거치지 않은 원문을 그대로 넣기:** `logService.log()`는
  모든 메시지에 `maskSensitive()`를 자동 적용하지만 [VERIFIED: src/main/services/log-service.ts:12-13,
  `const maskedMessage = maskSensitive(message);`], `CredentialLoginResult.message`처럼 렌더러로 직접
  반환되는 필드는 이 경로를 거치지 않는다. D-14의 식별자 병기는 **호출부가 명시적으로**
  `maskSensitive()`를 적용해야 R010을 만족한다.
- **`.show()`를 `.showModal()` 대신 쓰기:** `show()`는 non-modal이라 top layer/backdrop/inert
  background/포커스 트랩/Esc 처리가 전혀 없다 [CITED: 위 Pattern 3 출처]. D-09의 "확인해야만 진행"
  요건을 만족시키지 못한다.
- **`resolveLoginMode()`의 반환 타입을 객체로 바꾸기:** `login-mode.test.ts`의 6개 테스트가 문자열
  동등 비교(`toBe("browser")`)를 단언하므로 즉시 깨진다. `isLoginModeLockedByEnv()`를 별도 함수로 분리할 것.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 차단형 모달의 포커스 트랩/Esc/backdrop | 커스텀 오버레이 + `document.activeElement` 추적 로직 | 네이티브 `<dialog>.showModal()` | 브라우저가 이미 완전히 구현. 이 코드베이스엔 참고할 기존 모달이 전무해 처음부터 만들면 접근성 결함이 나기 쉽다. |
| `settings.json` 원자적 쓰기 | 커스텀 락 파일/재시도 로직 | `fs.writeFileSync(tmp)` + `fs.renameSync()` | POSIX `rename()`은 이미 원자적 — 추가 락 메커니즘은 이 규모(수백 바이트 로컬 설정)에 과함. |
| 실패 신호 → 한국어 매핑의 완전성 검증 | 산발적 `if`/`switch`를 auth-service.ts 곳곳에 흩뿌리기 | 단일 순수 함수 + exhaustive switch (TypeScript가 누락된 case를 컴파일 타임에 잡아줌) | 사유가 6종으로 고정돼 있고 앞으로도 늘어날 수 있어, 한 곳에 모아야 새 사유 추가 시 매핑 누락을 방지할 수 있다. |

**Key insight:** 이 phase의 진짜 위험은 "무엇을 새로 만들 것인가"가 아니라 "이미 있는 코드의 어느
부분이 반증된 전제 위에 서 있는가"를 정확히 식별하는 것이다 — Don't Hand-Roll보다 Runtime State
Inventory/Common Pitfalls 섹션이 이 phase의 실제 리스크 표면이다.

## Runtime State Inventory

> 이 phase는 리네임/리브랜드는 아니지만 D-02(코드 제거)·D-03(게이트 재정의)가 기존 동작을 바꾸므로,
> "코드를 다 고친 뒤에도 남아있는 런타임 상태가 있는가"를 명시적으로 점검한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `credentials.enc`(email+password, safeStorage 암호화) — D-01/D-02 전후로 저장 포맷이 동일(`StoredCredentials { email, password }`) [VERIFIED: src/main/services/auth-service.ts:38-41, 95-104]. API 모드로 이전에 저장된 자격증명도 그대로 재사용 가능 — **마이그레이션 불필요.** | 없음 |
| Live service config | 없음 — 이 phase는 외부 서비스 설정을 만들지 않는다 (Weverse 서버 상태는 이 phase 스코프 밖). | 없음 — 확인됨 |
| OS-registered state | 없음 — Task Scheduler/launchd/pm2 등 OS 레벨 등록을 만들지 않는다. | 없음 — 확인됨 |
| Secrets/env vars | `AUTOVERSE_LOGIN_MODE` — 이름·의미 불변, `resolveLoginMode()` 시그니처만 확장(2번째 매개변수 추가, 하위 호환). 기존 QA/개발 스크립트에서 이 변수를 참조하는 곳이 있다면 영향 없음. | 없음 — 확인됨, 코드 편집만 |
| Build artifacts | 신규 파일(`settings-store.ts`, `login-failure.ts`, `ApiModeNoticeModal.tsx`)은 기존 `npm run build` 파이프라인(`tsc -p tsconfig.main.json` + `vite build`)에 자동 포함됨 — 별도 빌드 설정 변경 불필요 [VERIFIED: package.json scripts, tsconfig.main.json include: `"src/main/**/*", "src/shared/**/*"`]. | 없음 |

**신규로 생기는 런타임 상태:** `userData/settings.json` — 이 phase가 처음 만든다. 파일 부재는 정상
상태(첫 실행)이며 기본값(`browser`, 미확인)으로 폴백해야 한다(위 Pattern 2).

## Common Pitfalls

### Pitfall 1: `resolveLoginMode()` 반환 타입을 바꿔 기존 테스트를 깨뜨림
**What goes wrong:** D-06 구현 시 "락 상태도 같이 반환하면 편하니까"라는 이유로
`resolveLoginMode(): { mode: LoginMode; lockedByEnv: boolean }`처럼 시그니처를 바꾸면
`login-mode.test.ts`의 6개 테스트가 전부 깨진다.
**Why it happens:** "한 함수가 관련 정보를 다 반환하면 편하다"는 자연스러운 리팩터링 충동.
**How to avoid:** `isLoginModeLockedByEnv(env)`를 별도 순수 함수로 분리한다(위 Pattern 1).
**Warning signs:** `npm test` 실행 시 `login-mode.test.ts`의 `toBe("browser")` 계열 단언이 실패.

### Pitfall 2: D-14 식별자 병기가 R010을 우회함
**What goes wrong:** 실패 사유가 `ApiAuthError`나 예외 메시지를 그대로 `CredentialLoginResult.message`에
넣으면, 이 필드는 `logService`를 거치지 않으므로 `maskSensitive()`의 자동 적용을 받지 못한다
[VERIFIED: src/main/services/log-service.ts:12-13]. 만약 예외 메시지 안에 우연히 민감 패턴과
겹치는 문자열이 들어가면(예: 네트워크 에러 스택 트레이스에 URL 쿼리스트링이 포함) 렌더러 화면에
그대로 노출될 수 있다.
**Why it happens:** "로그에 이미 마스킹되니까 괜찮겠지"라는 착각 — 로그 경로와 렌더러 반환 경로는
서로 다른 파이프라인이다.
**How to avoid:** D-14 identifier를 만드는 지점에서 명시적으로 `maskSensitive(identifier)`를 호출한다.
**Warning signs:** 실패 메시지 UI 스냅샷에 `accessToken`/`refreshToken`/URL 쿼리스트링 등이 그대로 보임.

### Pitfall 3: `needOtp` 제거가 `auth-service.ts`의 `'otp'` DOM 감지 분기를 죽은 코드로 남김
**What goes wrong:** D-02는 `LoginPanel.tsx`의 `needOtp` UI 전체를 제거하라고 명시하지만,
`auth-service.ts:399-401`의 `input[placeholder="인증코드 6자리"]` 셀렉터 기반 `'otp'` 반환 분기
(D-13이 고치는 캡차 오분류와는 별개 분기)는 명시적 제거 대상이 아니다. UI가 사라진 뒤에도 이 분기가
살아있으면, 만에 하나 서버가 실제로 OTP 입력 폼을 띄우는 상황에서 `credentialLogin()`이
`{ success: false, needOtp: true }`를 반환해도 **호출할 UI가 없다** — 사용자는 원인 불명의 무응답을
겪는다. (자세한 내용은 아래 Open Questions 1.)
**Why it happens:** D-02의 제거 목록이 렌더러 UI와 main 서비스 코드에 걸쳐 있어 어느 한쪽만 지우기
쉽다.
**How to avoid:** planner는 이 OTP DOM 분기의 최종 목적지를 D-12 매핑 테이블에 명시적으로 편입시키거나
(예: `"unknown"` reason으로 라우팅), 왜 그대로 두는지 근거를 남겨야 한다.
**Warning signs:** `credentialLogin()`이 `needOtp: true`를 반환하는데 `LoginPanel.tsx`에 이를 소비하는
코드가 없어 타입 경고 없이 조용히 무시됨.

### Pitfall 4: `api-auth-client.test.ts`의 교차 의존 테스트를 부분 삭제해 컴파일이 깨짐
**What goes wrong:** `describe("ApiAuthClient tracer", ...)`와 `describe("ApiAuthClient 민감정보", ...)`
테스트가 `requestOtpSession()` → `loginWithCredentials()` → `verifyOtp()` → `acquireFaneventToken()`을
한 시퀀스로 체이닝한다 [VERIFIED: src/main/services/__tests__/api-auth-client.test.ts:318-350, 355-387].
`requestOtpSession`/`loginWithCredentials`만 지우고 이 두 describe 블록을 남겨두면 즉시 컴파일 에러가
난다.
**Why it happens:** D-02의 제거 목록이 소스 파일 기준으로만 적혀 있어, 테스트 파일 쪽 교차 의존을
놓치기 쉽다.
**How to avoid:** 아래 표(제거 대상 코드와 영향받는 테스트 전체 목록) 참고 — 삭제/재작성 대상 테스트를
먼저 확정한 뒤 소스를 지운다.
**Warning signs:** `npm test` 실행 시 `TS2339: Property 'requestOtpSession' does not exist` 류의
컴파일 에러.

### Pitfall 5: "D-01 회귀 확인"이라는 이름의 테스트가 D-03 적용 후 거짓말을 하게 됨
**What goes wrong:** `auth-service.test.ts`의 `it("브라우저 모드(환경변수 미설정)에서는 게이트가
동작하지 않는다 — 기존 동작 무변경 (D-01 회귀 확인)", ...)` [VERIFIED:
src/main/services/__tests__/auth-service.test.ts:210-224]는 "브라우저 모드는 게이트가 없다"는 것을
검증하려는 의도였다. 하지만 D-03은 브라우저 모드에도 동일 게이트(자격증명 기반 무인 로그인 차단)를
적용하기로 **의도적으로** 결정했다 — 이는 CONTEXT.md가 명시한 "로드맵 SC1과의 의도적 편차"다. 이
테스트를 안 고치고 그대로 두면 이름과 실제 동작이 어긋난 채 통과하거나(우연히), 혹은 실패해서
"회귀"로 오인될 수 있다.
**Why it happens:** D-03의 게이트 재정의(모드 조건 → "외부 로그인 요청 발생 여부" 조건)는 브라우저
모드의 결과값 자체는 크게 안 바뀔 수 있지만(저장된 자격증명이 없으면 이 테스트는 원래도
`credentialLogin` 호출 없이 통과했음), 게이트가 발동하는 **이유**가 바뀐다.
**How to avoid:** planner는 이 테스트의 이름과 주석을 D-03 문구("두 모드 공통 게이트, 브라우저 모드도
예외 아님")로 다시 쓰고, 저장된 자격증명이 있는 브라우저 모드 케이스를 추가해 진짜 회귀(자격증명이
있어도 무인 호출이 차단되는지)를 검증해야 한다.
**Warning signs:** 코드 리뷰 시 테스트 이름이 CONTEXT.md D-03의 "의도적 편차" 서술과 모순됨.

## Code Examples

앞의 Architecture Patterns 섹션(Pattern 1~4)에 이 phase가 필요로 하는 모든 코드 예시가 포함되어 있다
— 별도 절 생략(중복 방지).

## D-02 제거 블라스트 반경 — 정밀 목록

이 표는 CONTEXT.md D-02의 텍스트(`credentialLoginApi()`, `ApiAuthClient.requestOtpSession()`,
`loginWithCredentials()`, `submitOtpApi()`, `ipc-handlers.ts`의 `resolveLoginMode()==="api"` 분기,
`LoginPanel.tsx`의 `needOtp`)를 실제 파일 라인 번호까지 대조한 결과다.

| 대상 | 위치 | 조치 | 근거 |
|------|------|------|------|
| `AuthService.credentialLoginApi()` | `auth-service.ts:581-618` | 삭제 | D-02 명시 |
| `AuthService.submitOtpApi()` | `auth-service.ts:623-644` | 삭제 | D-02 명시 |
| `AuthService.finishApiLogin()` (private) | `auth-service.ts:651-688` | 삭제 (고아화됨) | 위 두 메서드만 호출 — D-02 명시 목록엔 없지만 호출자가 모두 사라지므로 함께 제거해야 미사용 코드가 남지 않음 |
| `AuthService.apiLoginState` 필드 | `auth-service.ts:64` | 삭제 | `credentialLoginApi`/`finishApiLogin`에서만 읽고 씀 |
| `ApiAuthClient.requestOtpSession()` | `api-auth-client.ts:147-179` | 삭제 | D-02 명시 |
| `ApiAuthClient.loginWithCredentials()` | `api-auth-client.ts:181-191` | 삭제 | D-02 명시 |
| `ApiAuthClient.verifyOtp()` | `api-auth-client.ts:193-209` | **Open Question 2** | D-02 명시 목록에 이름이 없음 — `submitOtpApi()`만 호출하는데 그게 사라지므로 고아화됨. 논리적으로는 함께 제거가 맞지만 CONTEXT.md가 명시하지 않아 임의 확대 해석 위험 |
| `OtpSession` 인터페이스 | `api-auth-client.ts:38-41` | `requestOtpSession` 삭제 시 동반 삭제 | 그 메서드의 반환 타입 전용 |
| `REFRESH_TOKEN_COOKIE_TTL` 상수 | `api-auth-client.ts:25` | `verifyOtp` 삭제 시 동반 삭제 | `verifyOtp()` 본문에서만 사용 |
| `ApiAuthClient.acquireFaneventToken()` | `api-auth-client.ts:313-340` | **유지** | D-02 명시 — R019 자산 |
| `ApiAuthClient.exchangeForService()` | `api-auth-client.ts:211-252` | **유지** | D-02 명시 |
| `ApiAuthClient.probeFaneventToken()` | `api-auth-client.ts:254-302` | **유지** | `acquireFaneventToken()`이 내부적으로 사용 — 명시되진 않았으나 자명 |
| `AuthService.validateToken()` | `auth-service.ts:1063` | **유지, 무관** | CONTEXT.md D-02가 언급하는 "validateToken()"은 이 메서드다(ApiAuthClient에는 동명 메서드가 존재하지 않음 [VERIFIED: src/main/services/api-auth-client.ts:1-341, 전체에서 `validateToken` 미검출]) — 두 모드 공통으로 쓰이는 브라우저 모드 시절부터의 메서드, D-02와 무관하게 원래도 유지 대상 |
| `ipc-handlers.ts` `auth:credential-login` 분기 | `ipc-handlers.ts:50-54` | `resolveLoginMode()==="api"` 삼항 제거, `authService.credentialLogin(email, password)`만 남김 | D-02 명시 |
| `ipc-handlers.ts` `auth:submit-otp` 분기 | `ipc-handlers.ts:57-61` | `resolveLoginMode()==="api"` 삼항 제거, `authService.submitOtp(otpCode)`만 남김 — 채널 자체는 유지 | D-02 텍스트가 "분기 제거"라고만 하고 채널 삭제까지 말하지 않음. 단, needOtp UI가 사라지면 이 채널의 실질 호출자가 없어짐(**Open Question 1**과 연결) |
| `LoginPanel.tsx` `needOtp` 상태 전체 | `LoginPanel.tsx:42, 222-266` (JSX 블록), `handleSubmitOtp`(65-84) | 삭제 | D-02 명시 |
| `LoginPanel.tsx` `mode` useState | `LoginPanel.tsx:38` | props로 승격(제거 아님, 소유권 이전) | D-04 |

**영향받는 테스트 (전체 목록):**

| 테스트 파일 | describe 블록 | 상태 |
|---|---|---|
| `api-auth-client.test.ts` | `ApiAuthClient otp-session` (라인 57-140) | 삭제 — `requestOtpSession` 전용 |
| `api-auth-client.test.ts` | `ApiAuthClient otp verify` (라인 141-165) | 삭제 — `verifyOtp` 전용 |
| `api-auth-client.test.ts` | `ApiAuthClient error` (라인 166-206) | 삭제 — `loginWithCredentials` 에러 매핑 전용 |
| `api-auth-client.test.ts` | `ApiAuthClient exchange` (라인 207-263) | **유지, 무변경** |
| `api-auth-client.test.ts` | `ApiAuthClient ladder` (라인 264-317) | **유지, 무변경** |
| `api-auth-client.test.ts` | `ApiAuthClient tracer` (라인 318-350) | 삭제 또는 전면 재작성 — 4개 제거 메서드를 순서대로 체이닝 [VERIFIED: api-auth-client.test.ts:318-350] |
| `api-auth-client.test.ts` | `ApiAuthClient 민감정보` (라인 355-387) | 재작성 필요 — 동일하게 제거 메서드 체이닝 [VERIFIED: api-auth-client.test.ts:356-387]. "password/otpCode가 로그에 안 남는다"는 취지 자체는 여전히 유효하므로 남은 메서드(`credentialLogin` 등)를 대상으로 다시 써야 함 |
| `auth-service.test.ts` | `AuthService.tryAutoLogin API 모드 게이트` (라인 172-224) | **이름·단언 재작성 필요** — 특히 "브라우저 모드... D-01 회귀 확인" 테스트(210-224)가 D-03 적용 후 의미가 바뀜(Pitfall 5) |
| `auth-service.test.ts` | `AuthService.runAccountTokenLadderSpike` 등 | **유지, 무변경** — `credentialLoginApi`/`submitOtpApi`와 무관 |

## State of the Art

이 phase는 외부 생태계 트렌드보다 **자체 프로젝트 계약의 정정**이 핵심이므로 통상적 "구식 vs 최신
접근법" 비교는 해당사항이 제한적이다. 유일하게 관련 있는 항목:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 3단계 이메일 OTP 로그인 계약을 사실로 가정 | `credentialLogin()` 헤드리스 자동입력이 유일하게 동작하는 API 모드 경로 | 2026-08-25 (Phase 05 HAR 실측) | R020/R021의 매핑 대상과 고지 문구가 전면 재정의됨(D-12, D-08) — 이 phase가 그 재정의를 코드/문서에 반영하는 작업 |

**Deprecated/outdated:**
- `credentialLoginApi()`/`submitOtpApi()`/3단계 계정 API 로그인 순서: HAR 436 entries 실측으로 반증,
  이 phase에서 코드 삭제.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `settings:*` IPC를 get/set 세분화(4개 채널: get-login-mode/set-login-mode/get-notice-ack/ack-notice)로 설계하는 것이 이 코드베이스 관례에 맞다는 판단 | Architecture Patterns, 채널 이름은 discretion | 실제로는 단일 `settings:get`/`settings:set(partial)` 형태가 더 관례에 맞을 수 있음 — CONTEXT.md가 정확한 채널 이름을 discretion으로 남겼으므로 이 자체는 리스크 낮음(둘 다 D-05 충족) |
| A2 | 네이티브 `<dialog>`의 `role="dialog"`(암묵) 만으로 D-09의 접근성 요건을 충분히 만족하고, `role="alertdialog"`로의 명시적 승격은 불필요하다는 판단 | Pattern 3 | 스크린리더 사용자에게 "돌이킬 수 없는 결정을 확인하라"는 긴급도가 `alertdialog`보다 약하게 전달될 수 있음 — UAT에서 스크린리더 QA 시 재검토 필요 |
| A3 | `ApiAuthClient.verifyOtp()`를 `requestOtpSession`/`loginWithCredentials`와 함께 제거하는 것이 D-02의 취지에 부합한다는 판단 | D-02 블라스트 반경 표, Open Question 2 | CONTEXT.md 원문이 이 메서드를 명시하지 않아, 사용자가 의도적으로 남겨두려 한 것이라면 임의 삭제가 될 위험 — Open Question으로 별도 표시함 |
| A4 | `input[placeholder="인증코드 6자리"]` 기반 `'otp'` DOM 분기는 D-13의 캡차 재분류와 별개이며 D-02가 명시적으로 제거 대상에 포함하지 않았다는 판단 | Pitfall 3, Open Question 1 | 이 분기를 그대로 두면 죽은 코드/무응답 리스크, 지우면 CONTEXT.md 미명시 범위 확대 — 어느 쪽이든 사용자 확인 필요 |

## Open Questions

1. **`needOtp` UI 제거 후 `auth-service.ts`의 `'otp'`(OTP 입력창 감지) 분기는 어떻게 되어야 하는가?**
   - What we know: D-02는 `LoginPanel.tsx`의 `needOtp` UI 전체를 명시적으로 제거 대상으로 지정한다.
     `auth-service.ts:399-401`의 `input[placeholder="인증코드 6자리"]` 셀렉터 기반 분기(캡차 분기와는
     별개, D-13이 다루는 것은 그 다음 줄의 recaptcha 셀렉터다)는 D-02의 제거 목록에 이름으로 등장하지
     않는다. HAR 실측(R018, 05-01-SUMMARY.md)은 실제 로그인 흐름에 이 OTP 단계가 전혀 등장하지
     않는다는 것도 확인했다 — 즉 이 분기는 이론상 도달 불가능에 가깝다.
   - What's unclear: (a) 이 분기를 그대로 남겨두되 D-12 매핑 테이블에 새 사유("unmapped-otp-signal"
     류)로 편입시켜 D-14 fallback으로 라우팅할지, (b) `submitOtp()`/`auth:submit-otp` IPC 채널까지
     함께 제거해 코드베이스에서 OTP 개념 자체를 완전히 걷어낼지, CONTEXT.md가 명시적으로 정하지 않았다.
   - Recommendation: R018이 "삭제가 아니라 blocked" 상태로 보존되고 있다는 이 프로젝트의 기존 원칙
     (05-02-SUMMARY.md)과 일관되게, **(a)를 기본으로 권장** — 코드를 지우지 않고 D-12 매핑에
     "unknown" 사유로 편입시켜 안전하게 무해화한다. 다만 이는 CONTEXT.md 재해석이므로 planner는
     discuss 라운드 없이 이 방향으로 확정하기보다, PLAN.md에 이 선택과 근거를 명시적으로 기록해야 한다.

2. **`ApiAuthClient.verifyOtp()`를 제거해야 하는가?**
   - What we know: D-02가 명시하는 제거 목록은 `credentialLoginApi()`, `requestOtpSession()`,
     `loginWithCredentials()`, `submitOtpApi()` 4개다. `verifyOtp()`는 이름으로 등장하지 않는다.
     하지만 `verifyOtp()`의 유일한 호출자는 `submitOtpApi()`이며(그 자체가 삭제 대상), 삭제하지 않으면
     미사용(dead) public 메서드로 남는다.
   - What's unclear: D-02 작성 시 `verifyOtp()`를 의도적으로 제외한 것인지(예: 미래 어느 시점 rung2
     검증이나 OTP 폴백 경로 재도입 시 재사용하려는 의도), 단순 누락인지 CONTEXT.md 텍스트만으로는
     판단할 수 없다.
   - Recommendation: 위 D-02 블라스트 반경 표의 로직(호출자가 전부 사라지면 함께 제거)을 따르되,
     제거 시 이 Open Question을 인용해 "CONTEXT.md 명시 목록 밖의 확대 삭제"임을 SUMMARY에 명확히
     기록할 것을 권장한다.

3. **`ProfileStore` fanId 불일치가 이 phase의 UAT를 오염시킬 가능성**
   - What we know: 05-SPIKE-RESULT.md §2가 `ProfileStore`에 캐시된 `fanId=6871442`와 사다리가 검증한
     `fanId=9415932`의 불일치를 이미 기록했다. Deferred 항목으로 명시돼 있다.
   - What's unclear: 이 phase의 UAT(사용자가 실제로 API 모드를 선택 후 헤드리스 로그인을 수행하는
     체크포인트)에서 이 불일치가 화면에 노출돼 "이 phase가 만든 버그"로 오인될 위험이 있는지.
   - Recommendation: planner/UAT 스크립트에 "fanId 표시값이 05-SPIKE-RESULT.md의 알려진 불일치와
     일치하면 이 phase의 회귀가 아니다"라는 주석을 남겨 향후 verify 단계의 오판을 예방.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.6 [VERIFIED: package.json devDependencies] |
| Config file | `vitest.config.ts` — `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts"]` [VERIFIED: vitest.config.ts:1-15] |
| Quick run command | `npx vitest run src/shared/__tests__/login-failure.test.ts` (신규 파일 기준, 파일명은 구현자 결정) |
| Full suite command | `npm test` (== `vitest run`) |

**중요 관찰:** `environment: "node"`이고 jsdom/happy-dom/@testing-library/react 의존성이 전혀 없다
[VERIFIED: package.json — devDependencies에 testing-library/jsdom 부재]. 기존 렌더러 로직 테스트
관례(`src/renderer/components/__tests__/profile-form-validation.test.ts`)는 **컴포넌트를 렌더링하지
않고, 판단 로직을 컴포넌트 밖의 순수 함수로 추출해 그 함수만 테스트**한다 [VERIFIED:
src/renderer/components/__tests__/profile-form-validation.test.ts:1-30]. 이 phase도 동일 관례를
따라야 한다 — 예: "API 모드 최초 선택 시 모달을 띄워야 하는가"라는 판단(`ackedVersion` vs
`currentVersion` 비교)을 `ApiModeNoticeModal.tsx` 안의 JSX 로직이 아니라 별도 순수 함수
(`shouldShowApiModeNotice(ackedVersion, currentVersion): boolean`)로 뽑아 테스트한다.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R016 | env 없음 + 저장된 설정 `api` → `resolveLoginMode()` returns `"api"` | unit | `npx vitest run src/main/__tests__/login-mode.test.ts` | ❌ Wave 0 (기존 파일에 케이스 추가) |
| R016 | env 설정됨 → `isLoginModeLockedByEnv()` returns `true`, 저장된 설정 무시 | unit | 위와 동일 파일 | ❌ Wave 0 |
| R016 | `settings.json` 파싱 실패 시 기본값(`browser`) 폴백 | unit | `npx vitest run src/main/services/__tests__/settings-store.test.ts` | ❌ Wave 0 (신규) |
| R020 | 캡차 감지 → `mapLoginFailure("captcha")`가 D-13 문구를 반환 | unit | `npx vitest run src/shared/__tests__/login-failure.test.ts` | ❌ Wave 0 (신규) |
| R020 | 식별자 필드가 `maskSensitive()`를 통과한 값만 담김 | unit | 위와 동일 파일 (호출부 통합 테스트로 `auth-service.test.ts`에도 추가 권장) | ❌ Wave 0 |
| R021 | 최초 API 모드 선택 시 `shouldShowApiModeNotice(null, 1)` → `true` | unit | `npx vitest run src/shared/__tests__/notice-ack.test.ts` (또는 settings-store 테스트에 통합) | ❌ Wave 0 (신규) |
| R021 | 확인 후 재선택 시 같은 버전이면 모달 재노출 안 함 | unit | 위와 동일 | ❌ Wave 0 |
| R020/R021 | 실제 Weverse 헤드리스 로그인으로 캡차/타임아웃/에러 문구가 실제로 뜨는지 | manual-only | — (실계정 로그인 필요) | N/A — human checkpoint |

### Sampling Rate

- **Per task commit:** 해당 태스크가 건드린 파일의 quick run (예: `npx vitest run src/shared/__tests__/login-failure.test.ts`)
- **Per wave merge:** `npm test` (전체 스위트, D-02 삭제로 인한 컴파일 깨짐 여부까지 포함)
- **Phase gate:** `npm test` + `npm run typecheck:main` + `npm run typecheck` 모두 green — D-02 삭제
  작업은 타입 에러로 실패가 가장 먼저 드러나는 종류의 변경이라 typecheck를 반드시 게이트에 포함할 것.

### Wave 0 Gaps

- [ ] `src/main/services/__tests__/settings-store.test.ts` — 신규, `getLoginMode`/`setLoginMode`/
  `getNoticeAck`/`ackNotice` 및 파싱 실패 폴백 커버
- [ ] `src/shared/__tests__/login-failure.test.ts` — 신규, `mapLoginFailure()` 6개 reason 전수 테스트
- [ ] `src/main/__tests__/login-mode.test.ts` — 기존 파일 확장, `persistedMode` 인자 케이스 추가
- [ ] `src/main/services/__tests__/api-auth-client.test.ts` — 5개 describe 블록 삭제/재작성 (위 표 참고)
- [ ] `src/main/services/__tests__/auth-service.test.ts` — `tryAutoLogin API 모드 게이트` describe
  블록 이름/단언 재작성(D-03), `credentialLoginApi`/`submitOtpApi` 관련 spy/mock 정리
- 프레임워크 신규 설치: 불필요 — vitest 이미 존재

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 간접적 (yes) | 이 phase는 새 인증 메커니즘을 만들지 않음 — 기존 `credentialLogin()`/`login()` 그대로. 다만 D-03의 자동 재로그인 차단은 인증 흐름의 안전장치 강화 |
| V3 Session Management | yes | D-03: 쿠키 세션 복원은 허용, 자격증명 기반 무인 재인증은 두 모드 공통 차단 — "외부 요청은 항상 사용자 클릭에서" 원칙 |
| V4 Access Control | no | 단일 사용자 로컬 데스크톱 앱, 역할 기반 접근 제어 대상 없음 |
| V5 Input Validation | yes | `settings.json` 파싱 시 `JSON.parse` 실패/스키마 불일치를 반드시 방어적으로 처리(위 Pattern 2) — 사용자가 파일을 직접 수정해도 앱이 깨지지 않아야 함 |
| V6 Cryptography | no (의도적) | D-05가 명시적으로 `settings.json`을 평문으로 결정 — 비민감 값이므로 암호화 불필요. `safeStorage`는 `credentials.enc`에만 유지(무변경) |
| V7 Error Handling & Logging | yes | R010 마스킹(`mask.ts`) — 로그 경로는 자동 적용되지만, D-14 렌더러 노출 식별자는 호출부가 명시적으로 적용해야 함(Pitfall 2, 이 phase의 최대 리스크) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `settings.json`을 사용자가 직접 편집해 `lockedByEnv` 없이 API 모드로 전환 | Tampering | 위협 아님으로 판단 — 단일 사용자 로컬 파일, 본인 계정으로만 로그인 가능(민감 정보 없음). D-05가 이미 "파싱 실패 시 기본값 폴백"으로 방어적 처리를 요구 |
| D-14 fallback 식별자에 토큰/에러 스택이 실려 렌더러 화면에 노출 | Information Disclosure | Pitfall 2 — 호출부에서 `maskSensitive()` 명시 적용 |
| CSS 모듈 해시 셀렉터(`__oMA4m`)가 Weverse 배포로 깨져 캡차를 오분류 | (STRIDE 외, 신뢰성) | D-13이 이미 인지 — 셀렉터 실패 시 `null`을 반환해 D-14 fallback으로 자연스럽게 떨어지도록 설계(예외를 던지지 않음) |
| `tryAutoLogin()`/`tryAutoRelogin()` 게이트 완화로 다른 계정에 의도치 않은 로그인 시도 | Spoofing(계정 오용) | 05-01에서 실제로 발생했던 사고(D-03의 근거) — 게이트를 "모드 조건"에서 "무인 여부 조건"으로 바꿔 재발 방지. 이 게이트를 약화시키는 방향의 변경은 threat_model에서 반드시 별도 플래그할 것 |

## Sources

### Primary (HIGH confidence)
- `src/main/services/profile-store.ts`, `src/main/preload.ts`, `src/main/ipc-handlers.ts`,
  `src/main/services/auth-service.ts`, `src/main/services/api-auth-client.ts`, `src/main/login-mode.ts`,
  `src/renderer/components/LoginPanel.tsx`, `src/renderer/App.tsx`, `src/shared/mask.ts`,
  `src/shared/form-parser.ts`, `src/shared/types.ts`, `src/main/main.ts`, `src/main/services/log-service.ts`,
  `vitest.config.ts`, `tsconfig.main.json`, `package.json` — 전부 이번 세션에 직접 Read/Bash cat으로 열람
- `src/main/__tests__/login-mode.test.ts`, `src/main/services/__tests__/auth-service.test.ts`,
  `src/main/services/__tests__/api-auth-client.test.ts`, `src/renderer/components/__tests__/profile-form-validation.test.ts`
- `.planning/phases/05-api/05-01-SUMMARY.md`, `.planning/phases/05-api/05-SPIKE-RESULT.md`,
  `.planning/phases/05-api/05-CONTEXT.md`, `.planning/phases/05-api/05-02-PLAN.md`,
  `.planning/phases/05-api/05-02-SUMMARY.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`,
  `.planning/STATE.md`, `.planning/phases/06-ui/06-CONTEXT.md`

### Secondary (MEDIUM confidence)
- [How to Build Accessible Modals with Focus Traps](https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/) — 네이티브 `<dialog>.showModal()` 동작 확인
- [write-file-atomic (npm/GitHub)](https://github.com/npm/write-file-atomic) — 임시파일+rename 원자적 쓰기 패턴
- [Crash Consistency: fsync(), rename(), and Durability](https://0xkiire.com/crash-consistency-fsync-rename/) — fsync 필요성 판단 근거
- [electron-react-boilerplate issue #3112](https://github.com/electron-react-boilerplate/electron-react-boilerplate/issues/3112) — ESM-only 패키지의 CJS main 프로세스 비호환 확인
- `npm view electron-store version` (11.0.2), `npm view electron-store engines` (`node >=20`) — 레지스트리 직접 조회

### Tertiary (LOW confidence)
- 없음 — 모든 외부 웹 검색 결과는 --verified 크로스체크를 거쳐 MEDIUM으로 승격시켰거나, 코드베이스
  직접 열람(HIGH)으로 대체함

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 신규 의존성 없음, 기존 스택 그대로. electron-store 비채택 근거는 tsconfig 실측 + 공식 이슈 트래커 교차 확인.
- Architecture: HIGH — 모든 call site, 라인 번호, 테스트 파일 의존 관계를 직접 코드 열람으로 확인.
- Pitfalls: HIGH — 5개 pitfall 전부 실제 코드/테스트 파일에서 발견된 구체적 사실에 근거(추측 아님).
- Security Domain: MEDIUM — ASVS 카테고리 적용 판단은 일반 원칙(training knowledge) 기반이나, 구체적
  위협 패턴은 이 프로젝트의 실제 사고 이력(05-01의 오발송 메일)에 근거.

**Research date:** 2026-08-26
**Valid until:** 이 phase 실행 완료 시까지 (코드베이스 구조 기반 연구라 프로젝트 코드가 바뀌지 않는
한 만료되지 않음. 외부 라이브러리 버전 확인 사항은 30일 기준 재검증 권장)
