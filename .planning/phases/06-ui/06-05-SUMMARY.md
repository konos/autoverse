---
phase: 06-ui
plan: 05
subsystem: auth
tags: [electron-main, headless-login, dom-classification, masking, korean-copy, tdd]

# Dependency graph
requires:
  - phase: 06-ui (06-02, 06-04)
    provides: "06-02의 LoginFailureReason/mapLoginFailure() 어휘, 06-04가 남긴 CredentialLoginResult.reason 최소 배선과 credentialLogin() 최신 구조"
provides:
  - "classifyCredentialLoginSignal() — DOM 폴링 원시 신호(캡차/OTP폼/폼오류/타임아웃/null/미지) ↔ LoginFailureReason 을 잇는 유일한 순수 분류 함수 (D-13)"
  - "buildFailureResult() — auth-service.ts 내 R010 마스킹 관문. classifyCredentialLoginSignal()+mapLoginFailure() 결과를 maskSensitive() 로 감싸 CredentialLoginResult 로 반환하는 단일 지점 (T-06-06)"
  - "buildLadderFailureEvent() — 사다리 실패가 login-failed 이벤트로 사용자에게 도달하게 하는 헬퍼 (D-12)"
  - "CredentialLoginResult.identifier 필드 — 마스킹된 식별자를 렌더러 칩용으로 구조화 전달"
affects: [06-06, 06-07]

# Actuals (#2632)
actuals:
  tokens: 5666
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "실패 사유 분류 → 매핑 → 마스킹의 3단 파이프라인을 단일 private 메서드(buildFailureResult)로 강제 — 분기마다 문구/마스킹을 직접 다루지 않게 해 R010 누락을 구조적으로 차단"
    - "비동기 이벤트 전용 헬퍼 분리(buildLadderFailureEvent) — BrowserWindow 전체를 모킹하지 않고도 마스킹 관문을 직접 테스트할 수 있게 하는 테스트 용이성 우선 설계"

key-files:
  created: []
  modified:
    - src/shared/login-failure.ts
    - src/shared/__tests__/login-failure.test.ts
    - src/main/services/auth-service.ts
    - src/main/services/__tests__/auth-service.test.ts
    - src/shared/types.ts

key-decisions:
  - "Task 1(분류)과 Task 2(마스킹/배선)의 GREEN 구현을 하나의 커밋으로 합쳤다 — CredentialLoginResult.identifier 필드가 아직 없는 상태에서 분류 로직만 먼저 커밋하면 타입 불일치 중간 상태가 생기기 때문. 두 태스크의 acceptance_criteria는 커밋 전 개별적으로 grep/vitest로 검증했다."
  - "buildLadderFailureEvent()를 별도 private 메서드로 추출 — Task 3의 회귀 테스트가 헤드리스 BrowserWindow 전체를 모킹하지 않고도 사다리 실패 이벤트의 마스킹/문구를 직접 검증할 수 있게 했다(테스트 설계는 CONTEXT/RESEARCH가 이미 권고한 방향)."
  - "[VOID — 2026-08-26, 06-VERIFICATION.md gap 2/CR-02 반증] 브라우저 모드(login())의 실패 안내는 이번 플랜에서 건드리지 않았다(D-08 재량 항목의 '부분 재사용' 결정) — 두 모드가 공유하는 사다리 실패/토큰 검증 경로는 이미 같은 mapLoginFailure()/emit 경로를 타므로 자동으로 혜택을 받지만, login()의 보이는 창 흐름 자체는 변경하지 않았다. 사용자가 실제 브라우저 창에서 오류를 직접 보고 있어 추가 번역의 이득이 작고, D-03이 이미 브라우저 모드 동작을 한 번 바꾼 상황에서 변경 표면을 넓히면 회귀 판정이 어려워지기 때문. [정정] validateToken()의 네 emit 지점은 실제로는 mapLoginFailure()/buildFailureResult()를 거치지 않고 서버 응답 원문을 마스킹 없이 그대로 내보내고 있었다(CR-02, 06-VERIFICATION.md gap 2) — '자동으로 혜택을 받는다'는 서술은 검증되지 않은 채 틀렸다. 이 코드는 phase 06 이전(2026-05-14, 커밋 816970a)부터 있던 경로이며 06-05가 도입한 결함은 아니다. 06-09가 상태 코드 기반 확정 문구(describeTokenValidationFailure())로 대체하고 회귀 테스트를 추가해 이 경로를 해소했다(2026-08-26)."

patterns-established:
  - "실패 안내 3단 파이프라인 — classify(원시 신호) → map(사유→문구) → mask(문구/식별자) — 각 단계가 별도 함수/메서드로 분리돼 있어 향후 새 실패 사유가 추가돼도 마스킹 누락 없이 동일 경로를 강제로 통과한다."

requirements-completed: []  # R020 은 03/04/05/06/07 형제 플랜과 공유 ID — gsd-tools requirements ready-ids 확인 결과 0/1 ready (형제 플랜 SUMMARY 미완료). 전부 완료되면 자동 Complete 전환

coverage:
  - id: D1
    description: "캡차 위젯 감지가 더 이상 OTP/이메일 코드 서사로 오분류되지 않는다 — classifyCredentialLoginSignal()이 'captcha'와 'otp-form'을 분리하고, 셀렉터 실패(null)/미지 신호 모두 미매핑 폴백으로 안전하게 떨어진다 (D-13, D-14)"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/login-failure.test.ts#classifyCredentialLoginSignal (7 cases: captcha/otp-form/error/timeout/null/unknown-string/empty-error)"
        status: pass
      - kind: other
        ref: "grep -c \"return 'captcha'\" == 1, grep -c \"return 'otp'\" == 0 within the executeJavaScript DOM-polling literal in auth-service.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "렌더러로 반환되는 모든 실패 message/identifier가 maskSensitive()를 통과한다 — 토큰 형태 문자열이 화면에 노출되지 않는다 (R010, T-06-06/T-06-17 계열)"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.buildFailureResult — 토큰 형태 문자열 마스킹 회귀 2건 (network-error identifier, form-error message)"
        status: pass
      - kind: other
        ref: "maskSensitive() 제거 후 재실행 시 폼 오류 마스킹 테스트가 즉시 실패함을 수동 확인(작성 중 회귀 주입 테스트) — 테스트가 실제로 결함을 잡는지 검증"
        status: pass
    human_judgment: false
  - id: D3
    description: "사다리(토큰 확보) 실패가 로그에만 남지 않고 login-failed 이벤트로 사용자에게 도달한다 (D-12)"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.buildLadderFailureEvent — login-failed 타입 + 사다리 문구 + 마스킹된 식별자 병기"
        status: pass
      - kind: other
        ref: "sed -n '/runAccountTokenLadderSpike(\"credentialLogin\")/,/});/p' auth-service.ts | grep -c _emit == 2 (then/catch 양쪽)"
        status: pass
    human_judgment: false
  - id: D4
    description: "전체 회귀 없음 — 기존 auth-service 테스트(31개) 및 전체 스위트(294개)가 그대로 통과, 두 typecheck(main/renderer) + build 통과"
    verification:
      - kind: unit
        ref: "npm test — 15 files, 294 tests"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run typecheck:main && npm run build — 전부 0 에러"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 05: 로그인 실패 안내 재배선 — 캡차 오진 수정 + 마스킹 관문 Summary

**`classifyCredentialLoginSignal()` 순수 분류 함수로 캡차→OTP 오진(D-13)을 근본적으로 고치고, `buildFailureResult()` 단일 관문으로 모든 실패 message/identifier가 `maskSensitive()`를 강제로 통과하게 배선했다 — 사다리 실패도 이제 `login-failed` 이벤트로 사용자에게 도달한다.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-26T05:24:00Z (RED 커밋 기준)
- **Completed:** 2026-08-26T05:31:00Z
- **Tasks:** 3 of 3
- **Files modified:** 5

## Accomplishments

- **Task 1 (D-13):** `src/shared/login-failure.ts`에 `classifyCredentialLoginSignal(raw: string | null)`을 추가해 DOM 폴링 원시 신호를 `LoginFailureReason`으로 분류하는 유일한 지점을 만들었다. `auth-service.ts`의 `executeJavaScript` DOM 폴링 문자열에서 캡차 위젯 감지 시 `'captcha'`를, 인증코드 입력창 감지 시 `'otp-form'`을 반환하도록 분리했다(과거에는 둘 다 `'otp'`를 반환해 캡차가 "이메일 OTP 필요"로 오독됐다). 셀렉터 실패(`null`)와 미지 신호는 모두 `otp-form`과 함께 미매핑 폴백(`"unknown"`)으로 안전하게 떨어진다.
- **Task 2 (D-12/D-14/R010):** `credentialLogin()`의 실패 분기 전체(캡차/OTP폼/폼오류/타임아웃/미지/예외/사다리 실패)를 `classifyCredentialLoginSignal()` + 06-02의 `mapLoginFailure()` + 신설한 `buildFailureResult()` 마스킹 관문으로 통일했다. `buildFailureResult()`가 `maskSensitive()`를 명시적으로 적용하는 R010의 유일한 지점이다. `CredentialLoginResult.identifier` 필드를 `shared/types.ts`에 추가해 마스킹된 식별자를 구조화된 형태로 렌더러에 전달하고, 사다리 실패는 `buildLadderFailureEvent()`를 통해 `login-failed` 이벤트로 발행돼 이제 사용자에게 도달한다(과거에는 로그만 남았다). `AuthEvent` union에서 소비자가 없는 `"otp-required"` 타입을 제거했다.
- **Task 3 (회귀 테스트):** `auth-service.test.ts`에 `buildFailureResult()`/`buildLadderFailureEvent()`를 직접 호출하는 계약 테스트 12건을 추가했다 — 6개 실패 사유 전체를 순회하며 반증된 이메일 인증코드 서사 부재를 단언하는 테이블 테스트, 토큰 형태 문자열이 `identifier`/`message`에 마스킹된 형태로만 남는지 검증하는 R010 회귀 테스트 2건, 캡차/타임아웃 사유에 `identifier` 속성 자체가 없음을 확인하는 테스트, 사다리 실패 이벤트 검증 2건이 포함된다. `06-VALIDATION.md`의 06-05 T1/T3 행을 green으로 갱신했다.

## Task Commits

1. **Task 1 RED: classifyCredentialLoginSignal 실패 테스트 작성** - `7bb2bc7` (test)
2. **Task 1+2 GREEN: DOM 신호 분류 + 마스킹된 실패 사유 배선** - `9031a4b` (feat)
3. **리팩터: buildLadderFailureEvent 테스트 용이성 추출** - `f68b8a1` (refactor)
4. **Task 3: 캡차 사유 · 마스킹 관문 회귀 테스트** - `1b21c0b` (test)

**Plan metadata:** (이 커밋 다음)

## Files Created/Modified

- `src/shared/login-failure.ts` — `classifyCredentialLoginSignal()` 추가 (41줄)
- `src/shared/__tests__/login-failure.test.ts` — classify 함수 테스트 8건 추가 (43줄)
- `src/main/services/auth-service.ts` — DOM 폴링 신호 분리, `credentialLogin()` 실패 분기 통일, `buildFailureResult()`/`buildLadderFailureEvent()` 신설, 사다리 실패 emit 추가
- `src/main/services/__tests__/auth-service.test.ts` — 실패 안내 회귀 describe 2개, 테스트 12건 추가 (131줄)
- `src/shared/types.ts` — `CredentialLoginResult.identifier?: string` 추가, `AuthEvent`에서 `"otp-required"` 제거

## Decisions Made

**1. Task 1과 Task 2의 GREEN 구현을 하나의 커밋으로 합쳤다.**

플랜은 Task 1(`classifyCredentialLoginSignal` 분류)과 Task 2(마스킹 + `CredentialLoginResult.identifier` 배선)를 별도 태스크로 나눴지만, 두 변경은 같은 코드 영역에서 타입 수준으로 얽혀 있다 — 분류 함수만 먼저 커밋하면 `buildFailureResult()`가 아직 존재하지 않는 `CredentialLoginResult.identifier` 필드를 참조하는 중간 상태가 생긴다. 두 태스크의 `<acceptance_criteria>`를 각각 grep/vitest로 개별 검증한 뒤(본문 "Files Created/Modified" 이전의 검증 로그 참조) 하나의 `feat` 커밋으로 묶었다. Task 2에는 전용 테스트 파일이 지정돼 있지 않아(`<files>`가 `auth-service.ts`/`types.ts`만 지정) 이 결정이 TDD 게이트 구조에 미치는 영향은 아래 "TDD Gate Compliance"에 기록했다.

**2. `buildLadderFailureEvent()`를 별도 private 메서드로 추출했다.**

Task 3는 "주입이 지나치게 얽히면 `classifyCredentialLoginSignal()` + `mapLoginFailure()` 조합을 직접 호출하는 계약 테스트로 대체하되, 마스킹 관문 케이스만은 반드시 `auth-service` 쪽에서 검증하라"고 명시했다. 이 저장소는 DOM 테스트 환경이 없고 기존 `electron` 모크도 `BrowserWindow: vi.fn()` 수준이라 `credentialLogin()`을 실제로 끝까지 태울 수 없다. 그래서 사다리 실패 이벤트의 문구 조립 로직을 `buildLadderFailureEvent(detail: string): AuthEvent`로 추출해 `attachAccountTokenCapture`와 같은 기존 패턴(캐스팅을 통한 private 메서드 직접 호출)으로 테스트했다. `_emit()` 호출 자체는 `credentialLogin()` 내부에 그대로 남겨 Task 2의 acceptance_criteria(`_emit` grep)가 계속 성립한다.

**3. 브라우저 모드(`login()`)의 실패 안내는 건드리지 않았다 (D-08 재량 항목 결정, plan action (5) 반영).**

**부분 재사용** 결정: 두 모드가 공유하는 경로(사다리 실패, 토큰 검증 실패 — `validateToken()`의 `login-failed` emit)는 이미 같은 코드 경로를 타므로 이 플랜의 수정 혜택을 자동으로 받는다. 반면 `login()` 자체의 보이는 창 흐름(`pollForToken`, `did-navigate` 핸들러)은 변경하지 않았다 — 사용자가 실제 브라우저 창에서 오류를 직접 보고 있어 추가 번역의 이득이 작고, D-03이 이미 브라우저 모드 동작(무인 자동 로그인 차단 확대)을 한 번 바꾼 상황에서 변경 표면을 넓히면 회귀 판정이 어려워지기 때문이다.

> **[VOID — 2026-08-26 정정, 06-VERIFICATION.md gap 2 / 06-REVIEW.md CR-02]** 위 문단의 "두 모드가
> 공유하는 경로 ... 이 플랜의 수정 혜택을 자동으로 받는다"는 서술은 검증되지 않은 채 틀렸다.
> 실제 코드에서 `validateToken()`의 네 실패 emit 지점(401 세션 복원 실패, `!res.ok`, JSON 파싱
> 실패, `fanId` 없음)은 `mapLoginFailure()`/`buildFailureResult()`를 전혀 거치지 않고, 서버 응답
> 원문(`rawBody`) 최대 200자를 마스킹 없이 그대로 렌더러로 내보내고 있었다. 이 경로는
> **phase 06 이전(2026-05-14, 커밋 `816970a`)부터 있던 코드**이며 이 플랜(06-05)이 도입한
> 결함이 아니다 — 06-05의 실제 잘못은 이 사실을 코드로 검증하지 않고 "자동으로 혜택을 받는다"고
> 선언한 것이다. `06-09-PLAN.md`가 `src/shared/token-validation-failure.ts`의
> `describeTokenValidationFailure()`로 네 지점을 상태 코드 기반 확정 한국어 문구로 재배선하고
> 회귀 테스트로 잠가 이 경로를 해소했다.

## R020/동시성 가정 (planner_assumptions, 그대로 옮김)

플랜 프론트매터의 `planner_assumptions`가 명시한 가정은 이 실행에서도 유효하며, 코드 수준에서 재검증하지 않았다:

- 자격증명 로그인은 한 번에 하나만 진행된다고 가정한다. main 프로세스에는 두 번째 `credentialLogin()` 호출을 막는 락이 없다 — 두 번 겹쳐 호출되면 두 번째 호출이 첫 번째 헤드리스 창을 정리하고(`cleanupHeadless()`) 자기 창을 연다. 이 경우 **마지막 시도의 결과만 사용자에게 표시된다.**
- 로그인 진행 중 사용자가 모드를 바꿔도 진행 중인 시도는 취소되지 않는다(D-07). 결과는 시도 당시의 경로 기준으로 안내된다.
- 이 가정이 틀리면(예: 향후 다중 창) 두 시도의 안내가 뒤섞일 수 있다. 그 시점에 main 쪽 진행 중 플래그를 도입할 것.

## 확정된 DOM 신호 어휘

`credentialLogin()`의 `executeJavaScript` DOM 폴링이 반환하는 원시 신호(전체 경로):

| 신호 | 의미 | `classifyCredentialLoginSignal()` 결과 |
|---|---|---|
| `'captcha'` | reCAPTCHA 위젯 감지 (D-13 수정) | `{ reason: "captcha" }` |
| `'otp-form'` | 인증코드 입력창 감지 (도달 불가에 가까움) | `{ reason: "unknown", detail: "otp-form" }` |
| `'error:<본문>'` | Weverse 폼 오류 텍스트 | `{ reason: "form-error", detail: <본문> }` (본문 공백이면 `unknown`) |
| `'timeout'` | 25초 응답 대기 초과 | `{ reason: "timeout" }` |
| `null` | 모든 셀렉터 실패 | `{ reason: "unknown" }` |
| 그 밖의 문자열 | Weverse 배포 변경 등 미지 신호 | `{ reason: "unknown", detail: <원문> }` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 타입 일관성] Task 1/Task 2 GREEN 커밋 병합**

- **Found during:** Task 1 GREEN 구현 착수 직후
- **Issue:** Task 1만 먼저 커밋하면 `buildFailureResult()`(Task 2 산출물)가 존재하지 않는 상태에서 `credentialLogin()`의 분기 로직이 `reason` 필드만 반환하고 masking/identifier가 없는 중간 상태가 되어, 곧바로 이어지는 Task 2 커밋 전까지 타입 불일치는 없지만 R010 마스킹이 일시적으로 누락되는 상태가 된다.
- **Fix:** 두 태스크의 acceptance_criteria를 각각 독립적으로(grep + vitest) 검증한 뒤 하나의 `feat` 커밋으로 병합했다(위 "Decisions Made" 1번 참조).
- **Files modified:** src/main/services/auth-service.ts, src/shared/types.ts, src/shared/login-failure.ts
- **Verification:** Task 1/Task 2 acceptance_criteria 전체 grep + `npx vitest run` + `npm run typecheck:main` 개별 확인 (본문 상단 로그)
- **Committed in:** `9031a4b`

---

**Total deviations:** 1 auto-fixed (Rule 1 — 태스크 경계보다 타입/기능 일관성을 우선한 커밋 병합. 스코프 확장 없음, 코드 변경 내용은 플랜이 지시한 그대로).
**Impact on plan:** 태스크 산출물은 계획과 동일하다. 커밋 경계만 조정했다.

## TDD Gate Compliance

**Task 1** (`tdd="true"`, 대상 파일 `login-failure.test.ts`): RED(`7bb2bc7`) → GREEN(`9031a4b`) 게이트 확인됨. RED 커밋에서 `classifyCredentialLoginSignal is not a function` TypeError로 8개 테스트가 의도대로 실패했다. GREEN 커밋에서 25/25 통과.

**Task 2** (`tdd="true"`, `<files>`에 전용 테스트 파일 미지정 — `auth-service.ts`/`types.ts`만 지정): 이 태스크 자체의 RED 커밋은 없다. Task 2의 구현(마스킹/식별자/사다리 emit)은 Task 1과 같은 `9031a4b` 커밋에 포함됐고, 그 GREEN 상태는 기존 `auth-service.test.ts` 31개 테스트(회귀 없음)로만 검증됐다 — 이 시점에는 아직 Task 2 전용 새 테스트가 없었다. **Task 2 자체는 형식적인 RED 단계를 갖지 않는다.**

**Task 3** (`tdd="true"`, 대상 파일 `auth-service.test.ts`): 테스트를 작성한 시점에 이미 Task 1+2 구현(`buildFailureResult`/`buildLadderFailureEvent`)이 커밋돼 있었으므로, 12개 신규 테스트는 **작성 즉시 전부 통과했다 — 형식적인 RED 단계가 없었다.** `tdd.md`의 "Unexpected GREEN in RED phase" 규칙에 따라 이것이 실제 결함인지 확인하기 위해, `maskSensitive()` 적용 라인을 수동으로 되돌려 폼 오류 마스킹 테스트가 즉시 실패하는지 검증했다(위 로그: `AssertionError: expected 'accessToken=aaaa…' not to contain 'aaaa…'`). 테스트가 실제로 결함을 잡는다는 것을 확인한 뒤 원복하고 재통과를 확인했다.

**왜 이렇게 됐는가:** 플랜이 Task 2를 `tdd="true"`로 표시했지만 전용 테스트 파일을 지정하지 않아, Task 2의 구현이 사실상 Task 1의 GREEN 단계에 흡수됐다. 그 결과 Task 3의 회귀 테스트는 "이미 존재하는 동작을 잠그는" 순수 회귀 테스트가 됐고, 이는 태스크 이름("실패 안내 회귀 테스트")과도 일치한다 — RED 단계가 구조적으로 불가능했을 뿐, 테스트 자체는 위 수동 회귀 주입으로 유효성이 확인됐다.

## Issues Encountered

None.

## User Setup Required

None - 외부 서비스 설정 변경 없음.

## Next Phase Readiness

- 06-06(LoginPanel.tsx 배선)이 이 플랜의 산출물을 그대로 소비하면 된다: `CredentialLoginResult.reason`으로 `suggestBrowserSwitch` 여부를 재파싱 없이 판단할 수 있고, `identifier`가 존재할 때만 작은 칩으로 렌더링하면 된다(캡차/타임아웃은 필드 자체가 없음).
- 06-06/06-07은 R020 요구사항의 나머지 커버리지를 담당한다. R020은 03/04/05/06/07 여러 플랜이 공유 선언해 이 플랜만으로는 아직 `Complete`로 전환되지 않는다(`gsd-tools requirements ready-ids` 확인: 0/1 ready).
- 블로커 없음.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/shared/login-failure.ts
- FOUND: src/main/services/auth-service.ts
- FOUND commit: 7bb2bc7 (test, RED)
- FOUND commit: 9031a4b (feat, GREEN)
- FOUND commit: f68b8a1 (refactor)
- FOUND commit: 1b21c0b (test)
- Re-ran `npx vitest run src/shared/__tests__/login-failure.test.ts` → 25 passed
- Re-ran `npx vitest run src/main/services/__tests__/auth-service.test.ts` → 45 passed
- Re-ran full suite `npm test` → 294 passed (15 files)
- Re-ran `npm run typecheck` → 0 errors
- Re-ran `npm run typecheck:main` → 0 errors
- Re-ran `npm run build` → passing
- 전체 acceptance_criteria (Task 1: 7개, Task 2: 8개, Task 3: 5개) → 전부 PASS (본문 검증 로그 기록)
