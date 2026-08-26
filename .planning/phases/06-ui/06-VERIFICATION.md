---
phase: 06-ui
verified: 2026-08-26T08:12:12Z
status: human_needed
score: 7/7 truths verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "사용자가 API 모드를 처음 선택하면 두 가지 고지를 확인해야만 진행할 수 있다 — 확인 저장이 실패하면 모달이 닫히지 않고 모드도 바뀌지 않는다 (ROADMAP SC2 정정본, 06-06-PLAN must_haves) — CR-01, 06-08 로 해소"
    - "렌더러로 돌아가는 실패 문구와 식별자는 마스킹을 통과한 값뿐이다 — 토큰·비밀번호·URL 쿼리스트링이 화면에 노출되지 않는다 (06-05-PLAN must_haves, R010) — CR-02, 06-09/06-10 으로 해소"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "브라우저 모드 선택 → 앱 완전 종료 → 재실행 시 브라우저 탭이 유지되는지 (API→재시작 방향은 06-01 트레이서 체크포인트에서 실제 Electron 세션으로 이미 확인됨 — 반대 방향만 미확인)"
    expected: "재실행 후 로그인 방식 탭이 browser로 표시된다"
    why_human: "실제 앱 재시작이 필요하다 — settings-store.ts의 왕복 로직은 양방향 대칭으로 구현돼 있고 API 방향은 단위 테스트(79-87행)로 커버되지만, 육안 확인 자체는 수행되지 않았다 (06-VALIDATION.md UAT #1)"
  - test: "최초 API 모드 선택 시 고지 모달이 실제로 진행을 막는지, 좁은 창에서도 확인 버튼에 닿는지"
    expected: "모달이 포커스를 잡고 배경 상호작용을 막으며, 창을 최소로 줄여도 확인 버튼이 스크롤 영역 밖에 남아 클릭 가능하다"
    why_human: "네이티브 <dialog> 포커스 트랩과 실제 창 크기에서의 시각적 레이아웃은 Electron 런타임이 필요하다 (06-VALIDATION.md UAT #2, 06-06-SUMMARY.md D1/D5 human_judgment:true)"
  - test: "환경변수로 로그인 방식이 잠기면 실제 화면에 잠금 배지만 표시되고 환경변수 원문 값은 어디에도 보이지 않는지"
    expected: "탭 두 개 모두 비활성화되고 고정 문구(MODE_LABEL) 배지만 보인다"
    why_human: "실제 환경변수를 설정한 채로 앱을 실행해야 확인 가능하다 (06-VALIDATION.md UAT #3)"
  - test: "오타 비밀번호로 실제 로그인 시도 시 서버 에러 코드 대신 한국어 설명 문구가 표시되는지"
    expected: "폼 오류 사유에 맞는 확정 한국어 안내가 표시되고 서버 원문/에러 코드가 노출되지 않는다"
    why_human: "실계정 로그인 시도가 필요하다 — 이 phase의 모든 자동 검증은 스텁 fetch/DOM 신호 기반 단위 테스트로 닫혀 있다 (06-VALIDATION.md UAT #4)"
---

# Phase 06: 로그인 방식 선택 UI + 실패 안내 Verification Report (재검증)

**Phase Goal:** 사용자가 로그인 방식(API 통신/브라우저)을 명시적으로 선택하고, 선택 시 제약을 사전 고지받으며, 로그인 실패 시 원인을 한국어로 이해할 수 있다.
**Verified:** 2026-08-26T08:12:12Z
**Status:** human_needed
**Re-verification:** Yes — gap-closure 라운드(06-08/06-09/06-10) 이후 재검증

> 이 보고서는 ROADMAP.md 원문(성공 기준 2·3은 06-03에서 `[VOID]` 마킹 + 2026-08-26 정정본으로
> 교체됨)을 권위 있는 성공 기준으로 삼는다. 이전 `06-VERIFICATION.md`(2026-08-26T06:15:20Z,
> `gaps_found`, 5/7)가 지목한 두 개의 `partial` 판정 — CR-01(고지 확인 실패 삼킴)과
> CR-02(validateToken() 원문 노출) — 을 이번 재검증이 **대체**한다. SUMMARY.md/REVIEW-GAPS.md의
> "닫혔다"는 선언은 증거로 취급하지 않고, 코드를 직접 읽고 회귀 테스트를 재실행해 독립적으로
> 재확인했다.

## Gap 재검증 결과 요약

| Gap | 이전 판정 | 이번 판정 | 근거 |
|---|---|---|---|
| Gap 1 (CR-01, 고지 확인 실패 삼킴) | ⚠ 부분 실패 | ✓ VERIFIED | `login-mode-actions.ts`의 `saveModeStrict`/`saveModeSafe` 타입 분리 — 아래 상세 |
| Gap 2 (CR-02, validateToken() 원문 노출) | ⚠ 부분 실패 | ✓ VERIFIED | `token-validation-failure.ts`의 구조적 봉인 — 아래 상세 |

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP 정정본 기준) | Status | Evidence |
|---|---|---|---|
| 1 | 사용자가 API 통신 또는 브라우저 로그인 방식을 선택할 수 있고, 선택값은 앱 재시작 후에도 유지된다 (기본값 browser) | ✓ VERIFIED | 이전 검증에서 확인된 대로 변경 없음 — `settings-store.ts`의 원자적 왕복 로직, 24개 단위 테스트. 이번 재검증 대상이 아니다(회귀 없음, 354개 스위트 green으로 재확인). |
| 1b | 기존 브라우저 로그인 동작은 변경 없이 선택기 뒤로 배선된다 — 단, 저장된 자격증명 기반 무인 자동 로그인은 D-03에 따라 의도적으로 제거된다 | ✓ VERIFIED | 변경 없음. `git diff`로 `tryAutoLogin`/`trySessionRestore` 관련 코드가 gap-closure 커밋에서 건드려지지 않았음을 재확인. |
| **2 (Gap 1)** | 사용자가 API 모드를 처음 선택하면 두 가지 고지를 확인해야만 진행할 수 있다 — **확인 저장이 실패하면 모달이 닫히지 않고 모드도 바뀌지 않는다** | ✓ VERIFIED (재검증 통과) | 아래 "Gap 1 상세 재검증" 참고 |
| **3b (Gap 2)** | 렌더러로 반환되는 모든 실패 message/identifier가 마스킹을 거친 값뿐이다 (R010) | ✓ VERIFIED (재검증 통과) | 아래 "Gap 2 상세 재검증" 참고 |
| 3 | `credentialLogin()`이 실제로 마주치는 6가지 실패 신호가 한국어 설명 문구로 표시된다 (D-12) | ✓ VERIFIED | 변경 없음 (06-09/06-10이 명시적으로 `login-failure.ts`/`LoginFailureReason` union을 건드리지 않았다 — `git diff HEAD~1 -- src/shared/login-failure.ts` 공백 확인). |
| 4 | 환경변수로 로그인 방식이 잠기면 두 탭 모두 비활성화되고, 잠금 사실만 표시되며 환경변수 원문 값은 노출되지 않는다 (D-06) | ✓ VERIFIED | 변경 없음. |
| 5 | 반증된 3단계 계정 API 로그인(OTP) 코드와 문서 서술이 코드베이스·요구사항에서 정리되었다 (D-02/D-11/D-12) | ✓ VERIFIED | 변경 없음. `06-05-SUMMARY.md`의 잘못된 완료 선언도 이번 라운드(06-09)에서 D-11 관례대로 `[VOID]` + 정정문으로 처리됨(삭제 아님) — 아래 참고. |

**Score:** 7/7 truths verified (이전 라운드의 2개 partial이 모두 VERIFIED로 전환)

### Gap 1 상세 재검증 — 고지 확인 흐름의 실패 삼킴 (CR-01)

**이전 결함:** `LoginPanel.tsx`의 `handleAcknowledge()`는 `onSetLoginMode()`가 실패 시 예외를
던질 것을 전제로 했지만, 실제 주입된 `App.tsx`의 `handleSetLoginMode()`는 절대 reject하지
않았다. 그 결과 디스크 쓰기가 실패해도 모달이 "성공"으로 닫혔다.

**재검증 절차 (코드 직접 확인):**

1. `src/renderer/login-mode-actions.ts` (신규) — `createLoginModeActions()`가 내부적으로
   두 개의 클로저를 만든다:
   - `saveModeStrict(mode)`: `persistLoginMode()`가 reject하면 그대로 위로 던진다(삼키지 않음).
   - `saveModeSafe(mode)`: `saveModeStrict`를 감싸 예외를 삼키고 배너 문구만 표시한다.

   `grep -n "^export"` 결과 이 파일은 `LOGIN_MODE_SAVE_ERROR`, `NOTICE_SAVE_ERROR`,
   `LoginModeActionDeps`, `AcknowledgeOutcome`, `LoginModeActions`, `createLoginModeActions`
   6개만 export한다 — `saveModeStrict`/`saveModeSafe`는 **함수 스코프 클로저이며 모듈
   스코프에도 존재하지 않는다.** 이전 검증이 "unexported"라고 표현한 것보다 봉인이 더
   강하다 — 다른 모듈이 이 함수를 import할 방법 자체가 없다.

2. **두 반환 함수는 서로 다른 타입이다:**
   - `setLoginMode: (mode: LoginMode) => Promise<void>` (탭 클릭 경로, 절대 reject 안 함)
   - `acknowledgeApiModeNotice: (version: number) => Promise<AcknowledgeOutcome>`
     (`AcknowledgeOutcome = { ok: true } | { ok: false; error: string }`)

   `LoginPanel.tsx`의 `LoginPanelProps`도 이 두 시그니처를 그대로 반영해
   `onSetLoginMode: (mode) => Promise<void>`와 `onAcknowledgeNotice: (version) => Promise<AcknowledgeOutcome>`로
   선언돼 있다 — 파라미터·반환 타입이 모두 달라 두 prop을 서로 바꿔 연결하면 타입체크가 깨진다.
   `App.tsx`는 `onSetLoginMode={loginModeActions.setLoginMode}` /
   `onAcknowledgeNotice={loginModeActions.acknowledgeApiModeNotice}`로 각각 정확히 배선돼 있다
   (`App.tsx:179, 181`).

3. **`LoginPanel.tsx`의 `handleAcknowledge()`(99-108행)가 실제로 실패를 반영하는지 직접 확인:**
   ```
   const outcome = await onAcknowledgeNotice(noticeAck.currentVersion);
   if (outcome.ok) {
     setNoticeOpen(false);
   } else {
     setNoticeSaveError(outcome.error);
   }
   ```
   더 이상 try/catch로 실패를 추론하지 않는다 — `AcknowledgeOutcome.ok`를 직접 분기한다.
   `outcome.ok`가 `false`이면 `setNoticeOpen(false)`가 **호출되지 않는다** — 모달은
   `ApiModeNoticeModal`의 `open` prop이 그대로 `true`로 남아 네이티브 `<dialog>`가 열린 채다.

4. **행동 회귀 테스트로 직접 확인:** `login-mode-actions.test.ts` Test 1이 정확히 이 시나리오를
   검증한다 — `persistLoginMode`가 reject하도록 모킹한 뒤 `acknowledgeApiModeNotice(1)`을 호출해
   `outcome.ok === false`와 `outcome.error === NOTICE_SAVE_ERROR`를 단언한다.
   `npx vitest run src/renderer/__tests__/login-mode-actions.test.ts` → `PASS (7) FAIL (0)`로
   재실행해 확인. Test 5/6은 실패 시 `onModeApplied`가 호출되지 않음(상태 무결성)과
   `onNoticeAcked`가 이미 호출된 상태로 남는 부작용(IN-06, 의도된 트레이드오프)을 각각
   검증한다.

**판정 근거:** 상태 전이 자체("확인 저장 실패 → 모달 유지")는 두 계층으로 나뉘어 증명된다 —
① `acknowledgeApiModeNotice()`가 실패 시 `{ ok: false }`를 반환한다는 사실은 행동 테스트로
직접 증명됐고, ② 그 반환값을 받는 `LoginPanel.tsx`의 분기(`if (outcome.ok) setNoticeOpen(false)`)는
단순 조건문이라 코드를 읽는 것만으로 결정론적으로 확인 가능하다(런타임 DOM이 필요한 애매함이
없다). 두 증거를 합쳐 ✓ VERIFIED로 판정한다 — 다만 `<dialog>`가 실제 화면에서 열린 채로
보이는지, 그 상태에서 인라인 오류 문구가 실제로 렌더링되는지의 **시각적** 확인은 여전히
Electron 런타임이 필요하며, 이는 06-06-SUMMARY.md D5(human_judgment:true)로 이미 등록돼 있고
아래 Human Verification Required에 그대로 이월했다.

**WR-01(저장 중 Esc 경합)도 같은 라운드에서 해소됐는지 확인:** `decideNoticeCancel(saving)`
단일 판단 지점이 Cancel 버튼(`disabled={noticeSaving}`)과 `<dialog>`의 네이티브 `cancel`
이벤트(Esc) 양쪽을 모두 통과하도록 `LoginPanel.tsx:116`에서 배선돼 있다. `settings:set-login-mode`/
`settings:ack-notice`는 main 프로세스에서 동기 `fs.writeFileSync`+`renameSync`로 실행되므로
무한 대기 경로가 없다는 것도 `settings-store.ts` 재확인으로 검증했다.

### Gap 2 상세 재검증 — validateToken() 원문 노출 (CR-02)

**이전 결함:** `validateToken()`의 네 실패 지점(401 세션 복원 실패, `!res.ok`, JSON 파싱 실패,
`fanId` 없음)이 `buildFailureResult()`/`mapLoginFailure()`를 우회하고 서버 응답 원문
`rawBody.slice(0, 200)`을 마스킹 없이 그대로 `_emit()`했다.

**재검증 절차 (코드 직접 확인):**

1. **`rawBody`의 전체 사용처를 재확인:** `grep -n "rawBody" src/main/services/auth-service.ts` →
   4곳뿐이다: 선언(961행), 대입(963/965행), `logService.info` 진단 로그(967행),
   `JSON.parse(rawBody)`(991행). **`_emit()`/`this.emitTokenValidationFailure()` 어디에도
   `rawBody`가 전달되지 않는다** — 이전 검증이 지목한 4개 emit 지점을 직접 읽어 확인.

2. **`src/shared/token-validation-failure.ts`(신규)가 구조적 봉인을 제공하는지 확인:**
   `TokenValidationGuidanceContext`는 `{ status?: number }` 필드 하나뿐이다. 서버 응답 텍스트를
   담을 필드가 타입에 없다 — `describeTokenValidationFailure(kind, context)`의 구현
   (`switch`문 4개 분기 전체)도 `context?.status` 외의 어떤 필드도 읽지 않는다. 실제 호출부
   (`auth-service.ts:979, 985`)는 리터럴 객체(`{ status: res.status }`)만 사용한다.

3. **네 실패 지점이 전부 단일 관문 `emitTokenValidationFailure()`을 거치는지 확인:**
   - 401(세션 복원 실패): `this.emitTokenValidationFailure("unauthorized", "token-expired")` (979행)
   - `!res.ok`: `this.emitTokenValidationFailure("http-error", "login-failed", { status: res.status })` (985행)
   - JSON 파싱 실패: `this.emitTokenValidationFailure("parse-error", "login-failed")` (993행)
   - `fanId` 없음: `this.emitTokenValidationFailure("missing-fan-id", "login-failed")` (998행)

   `emitTokenValidationFailure()`(1030-1040행)는 `describeTokenValidationFailure()`가 반환한
   확정 문구를 `maskSensitive()`에 통과시킨 뒤 `_emit()`한다 — 이 값은 이 모듈이 스스로 만든
   고정 한국어 문구뿐이므로 마스킹이 실제로 바꿀 것은 없지만, "렌더러로 나가는 문구는 전부
   마스킹 관문을 통과한다"는 이 phase의 전제를 이 경로에서도 참으로 만든다.

4. **관측성 손실이 없는지 확인:** `logService.info("AuthService", `validateToken body: ${rawBody.slice(0, 500)}`)`
   (967행)가 모든 분기 이전에 무조건 실행돼 원문 500자가 항상 로그에 남는다 — `rawBody`를
   화면에서 제거했지만 개발자 진단 경로에서는 사라지지 않았다.

5. **행동 테스트로 직접 확인:** `token-validation-failure.test.ts`(7개 테스트)가 4개 kind 모두
   비어있지 않은 서로 다른 한국어 문장을 반환함, `status` context 유무에 따른 identifier 생성
   여부, `unauthorized`/`http-error(status 없음)` 반환 객체에 identifier 프로퍼티 자체가 없음을
   단언한다. `auth-service.test.ts`에 실제 `fetch` 응답을 주입해 `emit`된 `message`에 문맥
   없는 150~180자 토큰형 문자열이 없음을 단언하는 테스트도 포함돼 있다(06-REVIEW-GAPS.md가
   확인한 내용을 재실행으로 재확인). `npx vitest run src/shared/__tests__/token-validation-failure.test.ts src/main/services/__tests__/auth-service.test.ts` → `PASS (125) FAIL (0)`.

**판정 근거:** ✓ VERIFIED. 이 truth는 "원문이 화면에 나타나지 않는다"는 부정 조건이며, 코드가
그 값을 애초에 emit 경로로 흘려보낼 타입/데이터 경로 자체를 갖지 않는다는 사실을 직접 읽어
확인했다(구조적 증명) — 런타임에서만 관측 가능한 상태 전이가 아니라 정적으로 결정되는 데이터
흐름이므로 소스 확인만으로 충분하다.

**IN-05(타입 봉인 서술의 과장)에 대한 판단:** `06-REVIEW-GAPS.md`가 지적한 대로,
`@ts-expect-error` 테스트는 리터럴 객체를 직접 인자로 쓸 때만 초과 프로퍼티 검사에 걸리고,
변수를 거치면 통과한다 — "타입 경로 자체가 없다"는 주석이 TypeScript의 보증 범위보다 강하게
서술돼 있다. 그러나 이 verification의 결론(원문이 emit되지 않는다)에는 영향이 없다 — 실제
구현이 `status` 외 필드를 읽지 않는다는 사실은 변수 경유 여부와 무관하게 성립하고, 두 실제
호출부도 리터럴만 쓴다. 문서 정확도 문제이지 must-have 실패가 아니다.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/renderer/login-mode-actions.ts` | 탭 클릭/고지 확인 두 실패 계약을 타입으로 분리 (06-08) | ✓ VERIFIED | `saveModeStrict`/`saveModeSafe` 함수 스코프 봉인, `AcknowledgeOutcome` 판별 유니온, 7개 단위 테스트 |
| `src/shared/token-validation-failure.ts` | validateToken() 실패 → 상태 코드 기반 확정 문구, 서버 원문 타입 경로 없음 (06-09) | ✓ VERIFIED | `TokenValidationGuidanceContext = { status?: number }`, 7개 단위 테스트 |
| `src/main/services/auth-service.ts` | 단일 자격증명 로그인 경로 + 마스킹된 실패 반환 (D-01/D-02/D-13, R010) | ✓ VERIFIED | `credentialLogin()` 경로 견고(이전과 동일), `validateToken()` 4개 emit 지점이 `emitTokenValidationFailure()` 단일 관문으로 재배선됨, `btnEnabled` 7번째 미분류 경로도 `buildFailureResult()` 관문에 태워짐(06-10) — 더 이상 HOLLOW 아님 |
| `src/renderer/App.tsx` + `src/renderer/components/LoginPanel.tsx` | 고지 확인 ↔ 모드 저장 배선, 탭 상시 렌더링 (D-07, Interaction Contract 1) | ✓ VERIFIED | `handleAcknowledge()`가 `AcknowledgeOutcome.ok`를 직접 분기, 옛 `handleSetLoginMode`/try-catch 추론 로직 완전 제거(`grep -c "handleSetLoginMode"` 0건) — 더 이상 HOLLOW 아님 |
| `src/shared/mask.ts` | 문맥 없는 JWT 형태 문자열도 마스킹 (06-10, WR-02) | ✓ VERIFIED | `SENSITIVE_PATTERNS` 14번째 규칙(구조 기반, 배열 맨 끝), 양성 3 + 훼손 방지 4개 테스트, 기존 13개 규칙 무수정 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `handleAcknowledge()` (LoginPanel.tsx) | `onAcknowledgeNotice()` prop → `acknowledgeApiModeNotice()` (login-mode-actions.ts) | `AcknowledgeOutcome` 판별 유니온 직접 분기 | ✓ WIRED | 이전에는 NOT_WIRED(CR-01) — 이번 라운드에서 타입 수준으로 재배선됨 |
| `validateToken()` 4개 실패 지점 | `emitTokenValidationFailure()` → `describeTokenValidationFailure()` → `maskSensitive()` → `_emit()` | 단일 관문 함수 호출 | ✓ WIRED | 이전에는 NOT_WIRED(CR-02) — 4개 지점 전부 재확인 |
| `buildFailureResult()`의 `overrideMessage` | `maskSensitive(messageText)` | 조건 없이 동일 경로 통과 | ✓ WIRED (마스킹 우회 아님) | `auth-service.ts:511, 525` 직접 확인 — override 여부와 무관하게 동일한 마스킹을 거친다. `overrideMessage`에 토큰형 문자열을 섞은 테스트로 검증됨 |
| `btnEnabled` 실패 분기 | `buildFailureResult()` → `_emit()` | 형제 분기와 동일 형태 | ✓ WIRED | 이전에는 관문을 완전히 우회하는 7번째 경로(WR-03) — 이번 라운드에서 관문에 태워짐, 사용자 문구 보존 확인 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R016 | 06-01, 06-04, 06-06, 06-07, 06-08 | 로그인 방식 선택 + 영속 | ✓ SATISFIED | 이전과 동일 + 06-08이 고지 확인 경로의 저장 실패 계약을 닫음 |
| R020 | 06-02, 06-03, 06-04, 06-05, 06-06, 06-07, 06-09, 06-10 | API 로그인 실패 사유 한국어 안내 | ✓ SATISFIED | `credentialLogin()` 경로(기존) + `validateToken()` 공유 경로(06-09) + 7번째 미분류 경로(06-10) 모두 마스킹 관문을 지난다. 더 이상 부분 충족 아님 |
| R021 | 06-01, 06-03, 06-06, 06-07, 06-08 | API 모드 제약 사전 고지 (차단형) | ✓ SATISFIED | 문구·차단 구조(기존) + 저장 실패 시 계약 위반(CR-01)이 06-08로 해소됨. 더 이상 부분 충족 아님 |

ORPHANED 요구사항 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (없음) | - | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | - | gap-closure 7개 파일 전수 grep 결과 0건 |
| `src/shared/mask.ts` | 66-84 | 문맥 없는 JWT 마스킹 규칙(14번째)이 구조만으로 매칭 — 실제 서버 임의 문자열이 우연히 3분절·10자 이상 구조를 가지면 과잉 마스킹(관측성 저하) 가능. 06-10-SUMMARY.md도 이 규칙이 "완전하지 않다"고 인정하나 과소 마스킹 방향만 언급 | ⚠ Warning | 06-REVIEW-GAPS.md WR-05. 보안 방향(under-masking)의 실패가 아니라 관측성 방향(over-masking)의 실패이며, 이 phase의 두 must-have("노출되지 않는다")를 손상시키지 않는다. 1차 방어선(구조적 봉인, `emitTokenValidationFailure()`)은 이 규칙에 의존하지 않는다. 다음 phase 또는 실사용 보고 시 규칙 하한 조정 권고 |
| `src/shared/token-validation-failure.ts` | 32-35 | "타입 경로 자체가 없다"는 주석이 TypeScript 초과 프로퍼티 검사의 실제 범위(리터럴 인자에서만 적용)보다 강하게 서술됨 | ℹ Info | 06-REVIEW-GAPS.md IN-05. 실제 구현이 `status` 외 필드를 읽지 않아 기능적 위험은 없음 — 문서 정확도 문제 |
| `src/renderer/login-mode-actions.ts` | 77-92 | 확인 경로에서 모드 저장만 실패하면(ack는 성공) 이후 탭 재클릭 시 고지 모달 없이 조용히 재시도됨 — D-09 의도와 충돌하지 않으나 SUMMARY에 결정으로 기록되지 않음 | ℹ Info | 06-REVIEW-GAPS.md IN-06. 코드 변경 불필요 판단 |
| `src/main/services/auth-service.ts` | 983-986 | `!res.ok` 로그 줄에서 `rawBody`가 빠짐 — 관측성 손실은 없음(967행이 모든 분기 전에 무조건 500자 로그) | ℹ Info | 06-REVIEW-GAPS.md IN-07 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 전체 테스트 스위트 green (gap-closure 이후) | `npm test` | `Test Files 18 passed (18)` / `Tests 354 passed (354)` | ✓ PASS |
| Gap 1 회귀 테스트 (CR-01) | `npx vitest run src/renderer/__tests__/login-mode-actions.test.ts` | `PASS (7) FAIL (0)` | ✓ PASS |
| Gap 2 회귀 테스트 (CR-02) | `npx vitest run src/shared/__tests__/token-validation-failure.test.ts src/shared/__tests__/mask.test.ts src/main/services/__tests__/auth-service.test.ts` | `PASS (125) FAIL (0)` | ✓ PASS |
| `_emit()`에 `rawBody` 전달 여부 | `grep -n "rawBody" src/main/services/auth-service.ts` | 4곳 전부 로그/파싱 용도, `_emit()` 인자 아님 | ✓ PASS |
| `overrideMessage`가 관문을 우회하는지 | `sed -n '505,530p' auth-service.ts` 직접 확인 | `maskSensitive(messageText)` — override 여부 무관하게 동일 경로 | ✓ PASS |
| 타입체크 clean | `npm run typecheck`, `npm run typecheck:main` | 각 0 에러 | ✓ PASS |
| 빌드 성공 | `npm run build` | exit 0 | ✓ PASS |
| `login-failure.ts`/`package.json` 무변경 확인 (프로히비션 준수) | `git log --oneline -- src/shared/login-failure.ts package.json package-lock.json` | gap-closure 커밋(06-08~06-10) 어디에도 등장하지 않음 | ✓ PASS |
| `saveModeStrict`/`saveModeSafe` 모듈 밖 재사용 가능성 | `grep -rn "saveModeStrict\|saveModeSafe" src` | `login-mode-actions.ts` 내부(주석 포함)에만 등장 — export 없음, 함수 스코프 | ✓ PASS |

### Probe Execution

이 phase는 마이그레이션/CLI 도구 phase가 아니며 probe 스크립트를 사용하지 않는다.
**SKIPPED (no probe scripts declared or found).**

### WINDOWS.md 편차 항목 판단

06-09가 남긴 `deviation` 항목(`validateToken()`에 raw `_emit()` 2개가 남아야 한다는 acceptance
criterion이 실제로는 3개다)을 직접 재확인했다. 세 번째는 `localExpired` 분기(912행)의 사전
존재 하드코딩 `_emit()`("JWT 만료 — 다시 로그인해주세요")로, 06-09 태스크가 명시적으로 건드리지
말라고 지시한 브랜치다. 이 emit은 `rawBody`나 서버 응답을 전혀 참조하지 않는 고정 한국어
문자열만 담는다 — gap 2가 다루는 "서버 원문 노출" 문제와 무관하다. 별도로 `fetch` catch
블록(953행)의 emit은 `err.message`(JS 런타임 예외 메시지)를 담는데, 이 역시 gap 2가 지목한
4개 지점(401/!res.ok/파싱실패/fanId없음)에 포함되지 않았고 서버 응답 본문이 아니다.

**판단:** 이 편차는 실질적 결함이 아니라 acceptance criterion의 카운트 산정 실수(bookkeeping)다.
gap 2의 본질(서버 응답 원문이 마스킹 없이 렌더러로 전달되지 않는다)은 손상되지 않았다.
`status: open`으로 남겨두는 것이 적절하다 — 정정이 필요한 것은 코드가 아니라 06-09-PLAN의
acceptance criterion 문구다. 다음 phase가 이 편차를 재작업 사유로 오인하지 않도록 여기 명시해
둔다.

### 06-REVIEW-GAPS.md 발견 중 must-have에 영향을 주는 것이 있는지 판단

06-REVIEW-GAPS.md(2026-08-26T17:10:00Z, Critical 0 / Warning 1(WR-05) / Info 3)를 직접 읽고
각 항목이 이번 재검증의 두 must-have("확인해야만 진행" 계약, "마스킹을 통과한 값만 노출")에
영향을 주는지 판단했다:

- **WR-05** (문맥 없는 JWT 규칙의 과잉 마스킹 가능성): 방향이 반대다 — "노출되지 않아야 할 것이
  노출됨"이 아니라 "노출돼야 할 정상 진단 정보가 과도하게 지워질 수 있음". Gap 2의 must-have를
  위협하지 않는다. 위 Anti-Patterns 표에 Warning으로 기록해 다음 phase가 참고하게 했다.
- **IN-05/IN-06/IN-07**: 전부 문서 정확도·의도 명시 부족·로그 줄 분리 관련 Info 수준 관찰이며,
  기능적 결함이 아니라고 리뷰 자체가 명시한다. 재확인 결과 동의한다.

**결론:** 06-REVIEW-GAPS.md의 어떤 발견도 must-have 실패를 재구성하지 않는다.

### 이미 등록된 인간 확인 대기 항목 — 이번 재검증에서도 그대로 유지

이전 검증과 동일하게, 06-VALIDATION.md에 등록된 4개 UAT 항목과 06-06-SUMMARY.md의 2개
`human_judgment: true` 항목(D1: 탭 클릭→모달 표시→취소→탭 원복 등 실제 인터랙션, D5: 저장
실패 시 실제 화면에 모달이 열린 채 오류가 보이는지 + 좁은 창에서 버튼 도달성)은 이번 gap-closure
라운드가 해소한 범위(코드 수준 실패 계약, 마스킹 관문)와 별개의 검증 축이다. Known state에
따르면 다음 두 가지는 사용자가 06-01 트레이서 체크포인트에서 실제 Electron 세션으로 이미
확인했다:
- API 모드 선택 → 앱 완전 종료 → 재실행 시 탭 유지
- 로그인 상태에서 탭 전환 시 "로그인 완료" 배지 유지 (D-07)

**이전 검증과 달리, 이번 재검증은 이 항목들을 frontmatter `human_verification`에 포함시켜
상태를 `human_needed`로 판정한다.** 이전 라운드는 gaps_found(더 높은 우선순위)가 이미 성립해
이 판단이 필요하지 않았다. 이제 코드 수준 gap이 모두 닫힌 상태에서, 이 phase가 정말
"완료"인지 판단하려면 이 4+2개 항목 중 미확인 상태로 남은 것들에 대한 사람의 확인이 필요하다
— 이 검증이 그것을 임의로 통과 처리할 권한은 없다:
- 브라우저 모드 → 재시작 방향의 영속 확인 (API 방향만 실제 확인됨, 코드는 대칭 구현 + 단위 테스트로 신뢰도 높음)
- 최초 고지 차단 동작의 실제 인터랙션(포커스 트랩, 좁은 창에서 버튼 도달성) — D1/D5
- 환경변수 잠금 시 실제 화면 표시
- 오타 비밀번호로 실제 로그인 시도 시 실패 안내 문구

### Gaps Summary

이번 재검증은 06-VERIFICATION.md(2026-08-26T06:15:20Z)가 `gaps_found`로 판정했던 CR-01/CR-02
두 결함이 06-08/06-09/06-10 세 gap-closure 플랜으로 실제 코드 수준에서 닫혔는지 코드를 직접
읽고 회귀 테스트를 재실행해 독립적으로 재확인했다. **두 결함 모두 실제로 닫혔다** — SUMMARY의
"닫혔다" 선언이 아니라 (1) 타입 수준 봉인/구조적 데이터 흐름 차단, (2) 그 봉인을 정확히
겨냥한 행동 회귀 테스트, (3) 소비 지점(LoginPanel.tsx/emitTokenValidationFailure)의 직접
코드 읽기, 세 겹의 독립 증거로 확인했다.

06-REVIEW-GAPS.md가 이번 라운드에서 새로 발견한 4건(Critical 0, Warning 1(WR-05), Info 3)은
어느 것도 must-have를 재손상시키지 않는다 — WR-05는 과잉 마스킹(관측성) 방향의 리스크이지
과소 마스킹(노출) 방향이 아니며, Info 3건은 문서/로그 형식 관찰이다.

`gaps: []`(코드 수준 gap 없음)이지만, 이 phase의 완료 판정에는 여전히 4개의 outstanding UAT +
2개의 human_judgment 항목이 남아 있다 — 이들은 이번 라운드가 새로 만든 것이 아니라
06-VALIDATION.md/06-06-SUMMARY.md에 이미 등록된 항목이며, 이번 재검증은 그것을 임의로
해소된 것으로 선언하지 않는다. 따라서 `status: human_needed`로 판정하며, 다음 단계는 이
4+2개 항목에 대한 실제 Electron 세션 기반 사람 확인이다.

---

_Verified: 2026-08-26T08:12:12Z_
_Verifier: Claude (gsd-verifier)_
_이 보고서는 이전 06-VERIFICATION.md(2026-08-26T06:15:20Z, gaps_found, 5/7)를 대체한다. 이전
보고서의 gap 구조는 위 frontmatter `re_verification.gaps_closed`에 보존했다._
