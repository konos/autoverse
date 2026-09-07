---
phase: 06-ui
reviewed: 2026-08-26T17:10:00Z
depth: standard
round: gap-closure (06-08, 06-09, 06-10)
files_reviewed: 7
files_reviewed_list:
  - src/renderer/login-mode-actions.ts
  - src/renderer/App.tsx
  - src/renderer/components/LoginPanel.tsx
  - src/renderer/components/login-panel-view.ts
  - src/shared/token-validation-failure.ts
  - src/shared/mask.ts
  - src/main/services/auth-service.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 06: Gap Closure Code Review Report (06-08 · 06-09 · 06-10)

**Reviewed:** 2026-08-26T17:10:00Z
**Depth:** standard
**Files Reviewed:** 7 (+ 5개 테스트 파일을 근거로 정독)
**Status:** issues_found (Critical 0건 — WARNING/INFO만 발견)

## Summary

06-08/06-09/06-10 세 개의 gap-closure 플랜이 06-REVIEW.md의 CR-01·CR-02와 06-VERIFICATION.md의 두 gap을 실제로 코드 수준에서 닫았는지 독립적으로 재검증했다. 코드를 직접 읽고, `npm test`(354/354 green), `npm run typecheck` / `npm run typecheck:main`(각 0 에러), `git diff --stat`(package.json/package-lock.json 무변경)을 재실행해 SUMMARY.md들의 주장을 검증 근거로 삼지 않고 재확인했다.

**결론: CR-01·CR-02 모두 실제로 닫혔고, "재배선"이 아니라 "재발 불가능한 구조"로 닫혔다.** Critical 등급 발견은 없다.

- **CR-01(고지 확인 흐름의 실패 삼킴):** `login-mode-actions.ts`의 `saveModeStrict`/`saveModeSafe` 분리가 타입 수준에서 실제로 강제된다. `LoginPanelProps.onAcknowledgeNotice: (version) => Promise<AcknowledgeOutcome>`와 `onSetLoginMode: (mode) => Promise<void>`는 파라미터·반환 타입이 모두 달라, "실패를 삼키는 헬퍼를 확인 경로에 잘못 연결"하는 CR-01과 같은 형태의 실수를 컴파일러가 막는다. `saveModeStrict`는 모듈 밖으로 export되지 않아 다른 컴포넌트가 실수로 재사용할 경로 자체가 없다. `login-mode-actions.test.ts`의 Test 1이 Task 1(RED) 시점에 실제로 실패했다는 실행 로그가 SUMMARY에 보존돼 있어 "CR-01이 실재했다"는 증거와 "닫혔다"는 증거 둘 다 코드로 확인된다.
- **CR-02(validateToken() rawBody 유출):** `describeTokenValidationFailure()`의 두 번째 인자 타입이 `{ status?: number }` 뿐이라 서버 응답 원문이 문구 조립 함수로 들어올 타입 경로가 없다. `validateToken()`의 네 실패 지점(401/`!res.ok`/파싱 실패/`fanId` 없음) 전부가 `emitTokenValidationFailure()` 단일 관문으로 재배선됐고, `rawBody.slice(0, 200)` 문자열은 소스에서 완전히 사라졌다(`grep -c` 재확인 0건). 진단용 `rawBody.slice(0, 500)` 로그 라인은 그대로 남아 관측성 손실도 없다. `auth-service.test.ts`의 신규 테스트가 실제 `fetch` 응답을 주입해 `emit`된 `message`에 문맥 없는(키 접두사 없는) 150~180자 토큰형 문자열이 없음을 실행 수준에서 단언한다 — 소스 텍스트 스캔이 아니라 진짜 동작 검증이다.
- **WR-01(저장 중 Esc 경합):** `decideNoticeCancel(saving)` 단일 판단 지점이 Cancel 버튼(`disabled={noticeSaving}`)과 `ApiModeNoticeModal`의 네이티브 `<dialog>` `cancel` 이벤트(Esc) 양쪽 진입점을 모두 통과하도록 배선됐다. 저장이 멈춰있을 위험(무한 대기)도 실제로는 없다 — `settings:set-login-mode`/`settings:ack-notice`는 main 프로세스에서 `fs.writeFileSync`+`renameSync`로 완전히 동기적으로 실행되므로 IPC Promise가 영원히 pending 상태로 남을 실질적 경로가 없다.
- **WR-03/IN-02(btnEnabled 미분류 분기 + 이메일 평문 덤프):** `buildFailureResult()`의 4번째 선택 파라미터 `overrideMessage`는 마스킹 관문을 우회하는 자리가 아니다 — `overrideMessage`가 주어져도 `maskSensitive(messageText)`를 동일하게 통과한다(`auth-service.ts:511, 525` 직접 확인). `btnEnabled` 분기가 이제 형제 5개 사유와 동일하게 `login-failed` 이벤트를 발행하고, 디버그 덤프의 `emailValue`(이메일 원문)는 `emailLen`(길이)으로 교체됐다 — `grep -c 'emailValue'` 재확인 0건.
- **WR-02(문맥 없는 토큰 마스킹):** `SENSITIVE_PATTERNS`에 JWT 3분절 구조를 키 문맥 없이 매칭하는 14번째 규칙이 추가됐다. ReDoS 위험은 없다(중첩 정량자·모호한 backtracking 없음, 고정 리터럴 구분자). 배열 맨 끝에 위치해 앞선 13개 규칙이 이미 마스킹한 `maskToken()` 출력(`"..."` 3점 생략 표기, 단일 점 2개가 아니라 3개 연속)과 충돌하지 않음을 직접 추적해 확인했다. 다만 이 규칙 자체의 완전성에는 한계가 있다 — 아래 WR-05 참고.

이 외에 발견한 것은 전부 Info 등급이며, 기능적 결함이 아니라 문서/견고성 관찰이다.

## Warnings

### WR-05: 문맥 없는 JWT 마스킹 규칙이 3분절 구조를 가진 비민감 텍스트(긴 서브도메인 체인 등)를 과도하게 마스킹할 수 있다 — 테스트가 검증한 것보다 좁은 안전 범위

**File:** `src/shared/mask.ts:66-84`

**Issue:**

06-10이 추가한 14번째 규칙(`/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g`)은 "점으로 이어진 3개 세그먼트, 각 10자 이상"이라는 구조만으로 매칭한다. `mask.test.ts`의 훼손 방지 테스트(Test 4~7)는 **이 저장소의 실제 값**(계정 API 호스트, 소스 파일 경로, `electron@37.2.0` 류 semver, 실제 진단 로그 문장) 네 가지에 대해서만 무손상을 확인했다. 이 네 가지는 전부 "라벨이 3개 미만이거나, 라벨 중 하나가 10자 미만"이라는 공통점으로 우연히 안전하다.

그러나 이 규칙이 실제로 적용되는 지점(`buildFailureResult()`의 `identifier`/`message`, 특히 `network-error`/`token-ladder-failed`/`unknown` 사유의 `identifier = detail`)에는 `err.message`(JS 런타임 예외 메시지)나 `ApiAuthError.message`(Weverse 계정 API가 임의로 채워 보내는 JSON `message` 필드)처럼 **이 프로젝트가 값을 통제할 수 없는 임의 문자열**이 들어온다. 이런 문자열이 예를 들어

- 3개 이상의 하이픈 포함 서브도메인 라벨(각 10자 이상)로 구성된 URL(예: `https://very-long-subdomain-name.another-long-part.example-host.com/...`),
- 10자 이상씩 3개로 쪼개지는 임의의 진단 식별자(예: 특정 CDN/추적 파라미터, 빌드 해시 체인)

를 우연히 포함하면, 이 규칙은 그 부분을 `***`(40자 이하는 완전 삭제, `maskToken()` 참고)로 지워버린다. 이는 **보안 방향의 실패(under-masking)가 아니라 관측성 방향의 실패(over-masking)** — 사용자에게 필요한 실제 오류 맥락이 근거 없이 사라져 "일반 안내 + 식별자 병기"(D-14)의 "식별자"가 정작 식별에 쓸모없는 `***`가 될 수 있다. 06-10-SUMMARY.md도 코드 주석에서 "이 규칙조차 완전하지 않다"고 스스로 명시했지만, 그 불완전성의 반대 방향(과소 마스킹)만 언급하고 과잉 마스킹 방향은 문서화하지 않았다.

이것이 CR-01/CR-02 같은 "닫힌 것으로 잘못 선언된 결함"은 아니다 — 06-09/06-10이 세운 진짜 방어선(구조적 봉인, `emitTokenValidationFailure()`)은 이 규칙에 의존하지 않는다. 이 규칙은 명시적으로 "2차 방어선"이라고 스스로를 낮춰 부르고 있어 완전성 주장 자체를 하지 않는다. 그럼에도 실제로 서버가 통제하는 임의 문자열이 이 규칙을 통과하는 경로(`token-ladder-failed`/`network-error`/`unknown` identifier)가 여전히 열려 있고, 그 경로에서 이 규칙이 유일한 방어선이므로, 과잉 마스킹으로 인한 관측성 저하 가능성은 실사용 중 재현 가능한 리스크로 기록해 둘 가치가 있다.

**Fix:** 필수 조치는 아니지만, 세그먼트 하한을 도메인 레이블 관례(예: 라벨 길이보다 "점으로 구분된 세그먼트가 정확히 3개이고 전체 길이가 JWT 크기 하한(예: 60자) 이상"인 경우로 조건 강화)로 좁히거나, `identifier`처럼 사람이 읽는 자리에는 이 규칙 적용 여부를 별도 플래그로 제어해 과잉 마스킹 사례가 실제로 보고되면 조정할 수 있게 로그(logService, 자동 마스킹 미적용 원문)에는 규칙을 적용하지 않는 비대칭 정책을 검토할 것. 최소한 `mask.test.ts`에 "3라벨 서브도메인 URL이 과잉 마스킹된다"는 사실을 인지하는 회귀 테스트를 추가해 향후 조정 시 의도치 않은 동작 변화를 감지할 수 있게 하는 것을 권한다.

## Info

### IN-05: `TokenValidationGuidanceContext`의 "타입 경로 자체가 없다"는 설명이 TypeScript의 초과 프로퍼티 검사 한계를 넘어서는 강한 보증처럼 서술돼 있다

**File:** `src/shared/token-validation-failure.ts:32-35`, `src/shared/__tests__/token-validation-failure.test.ts:47-52`

**Issue:** `describeTokenValidationFailure()`의 `@ts-expect-error` 테스트는 `describeTokenValidationFailure("http-error", { status: 500, rawBody: "서버 응답 원문" })`처럼 **리터럴 객체를 인자 자리에 직접 쓸 때만** TypeScript 초과 프로퍼티 검사(excess property check)에 걸린다는 사실을 검증한다. 그러나 `const ctx = { status: 500, rawBody: "..." }; describeTokenValidationFailure("http-error", ctx)`처럼 변수를 거쳐 전달하면 TypeScript의 구조적 타이핑상 초과 프로퍼티 검사가 적용되지 않아 컴파일이 통과한다 — 주석("원문이 이 함수로 들어올 타입 경로 자체가 없다")이 시사하는 것보다 실제 타입 경계는 좁다.

다만 이것이 실질적 위험으로 이어지지는 않는다 — `describeTokenValidationFailure()`/`emitTokenValidationFailure()`의 구현은 `context?.status` 외의 어떤 필드도 읽지 않으므로, 변수를 거쳐 초과 프로퍼티가 전달되더라도 런타임에 그 값이 실제로 문구 조립에 쓰이는 경로가 없다. 실제 두 호출부(`auth-service.ts:979, 985`)도 리터럴 객체(`{ status: res.status }`)만 사용해 문제가 되지 않는다.

**Fix:** 코드 자체를 바꿀 필요는 없다. 주석/문서의 "구조적 봉인"이라는 표현을 "리터럴 인자 + 함수 구현이 `status` 외 필드를 읽지 않음, 두 조건의 조합으로 보장됨"처럼 더 정확하게 다듬는 것을 권한다 — 다음 사람이 이 함수에 필드를 추가하면서 "타입이 막아준다"는 전제를 과신하지 않도록.

### IN-06: 고지 확인 저장이 부분 실패(ack 성공 · 모드 저장 실패)하면, 이후 탭 재클릭 시 고지 모달 없이 조용히 재시도된다 — 의도된 동작이지만 문서화되지 않음

**File:** `src/renderer/login-mode-actions.ts:77-92`, `src/renderer/components/login-panel-view.ts:69-83`

**Issue:** `acknowledgeApiModeNotice()`는 `persistNoticeAck(version)`을 먼저 실행하고 그 다음 `saveModeStrict("api")`를 실행한다. `login-mode-actions.test.ts`의 Test 6이 이 순서의 부작용을 정확히 문서화한다 — "확인 경로에서 모드 저장이 실패해도 `onNoticeAcked`는 이미 호출된 상태다(어긋난 상태가 관측 가능하다 — gap 1의 핵심)". 즉 디스크 쓰기가 일시적으로 실패하면: 고지 확인 버전(`apiModeNoticeAckedVersion`)은 영속되지만 `loginMode`는 그대로 `browser`로 남는다. 모달은 정확히 gap 1이 요구한 대로 열린 채 오류를 보여준다(정상 동작). 그러나 사용자가 그 자리에서 재시도하지 않고 모달을 취소한 뒤, **나중에 다시 API 탭을 클릭**하면 `decideTabClick()`은 `shouldShowApiModeNotice(ackedVersion, currentVersion)`이 이미 `false`이므로 모달을 다시 띄우지 않고 `{ action: "save", mode: "api" }`(탭 클릭 fire-and-forget 경로)로 즉시 재시도한다.

이것은 D-09("사용자가 API 모드를 처음 선택할 때만 확인을 받아야 진행된다")의 문언과 정확히 충돌하지는 않는다 — 사용자는 이미 "확인했습니다" 버튼을 눌러 고지 내용을 실제로 읽고 동의했고, 그 다음 저장이 실패한 것은 고지 자체와 무관한 디스크 I/O 문제였다. 따라서 재확인 없이 재시도를 허용하는 것이 사용자 경험상 합리적인 설계 선택일 수 있다. 다만 이 트레이드오프가 06-08-PLAN/SUMMARY 어디에도 명시적 결정으로 기록되지 않았고, 오직 테스트 이름의 괄호 안 문구로만 남아 있다 — 다음 사람이 "ack와 모드 저장을 원자적 트랜잭션으로 묶어야 하는가"를 고민할 때 이 케이스가 의도된 것인지 우연한 부작용인지 판단할 근거가 부족하다.

**Fix:** 코드 변경은 불필요하다고 판단한다(현재 동작이 D-09 의도에 부합). `06-08-SUMMARY.md`의 `key-decisions`에 이 순서 선택("ack-then-mode, 부분 실패 시 재확인 생략")을 명시적 결정으로 한 줄 추가할 것을 권한다 — 검증 스크립트가 아니라 사람이 다음에 이 코드를 읽을 때 의도를 즉시 파악할 수 있게.

### IN-07: `!res.ok` 분기의 `logService.error` 로그 문구에서 `rawBody`가 빠졌다 — 관측성 손실은 없지만 로그 문구 자체가 이전보다 짧아졌다

**File:** `src/main/services/auth-service.ts:983-986`

**Issue:** CR-02 이전에는 `!res.ok` 분기의 `logService.error` 호출이 `GET /fans/me ${res.status}: ${res.statusText} — ${rawBody.slice(0, 200)}` 형태로 상태 코드와 응답 본문 일부를 한 줄에 함께 남겼다. 06-09 이후에는 `logService.error("AuthService", \`GET /fans/me ${res.status}: ${res.statusText}\`)`로 바뀌어 이 특정 로그 줄에서 `rawBody`가 빠졌다. 관측성 자체는 손실되지 않는다 — 같은 함수 앞부분의 `logService.info("AuthService", \`validateToken body: ${rawBody.slice(0, 500)}\`)`(967행)가 모든 분기 이전에 무조건 실행되어 원문 500자가 항상 로그에 남기 때문이다(06-09-SUMMARY D3가 정확히 이 사실을 근거로 "관측성 손실 없음"을 주장했고, 재확인 결과 사실이다). 다만 두 로그 줄이 서로 다른 레벨(`info`/`error`)과 서로 다른 위치에 분리되어 있어, 로그 파일을 `grep`으로 훑는 사람이 "GET /fans/me 503" 에러 줄만 보고 본문을 놓칠 수 있다.

**Fix:** 선택 사항. 필요하면 `!res.ok` 로그 줄에 "본문은 위 validateToken body 로그 참고"라는 주석을 붙이거나, `error` 레벨 로그에도 `rawBody.slice(0, 200)`을 유지해 같은 줄에서 완결되게 할 수 있다. 우선순위는 낮다 — R010 마스킹 관문 밖(순수 로그 경로)이라 자동 마스킹이 이미 적용되는 자리이므로 보안 이슈는 아니다.

---

_Reviewed: 2026-08-26T17:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: gap-closure (06-08, 06-09, 06-10) — 06-REVIEW.md(1차)는 이 리뷰가 대체하지 않으며 원본 그대로 보존됨_
