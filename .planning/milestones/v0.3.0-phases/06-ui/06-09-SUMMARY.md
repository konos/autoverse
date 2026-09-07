---
phase: 06-ui
plan: 09
subsystem: auth
tags: [electron-main, masking, korean-copy, tdd, gap-closure, documentation-correction]

# Dependency graph
requires:
  - phase: 06-ui (06-05, 06-VERIFICATION, 06-REVIEW)
    provides: "06-05가 세운 'buildFailureResult()가 유일한 마스킹 관문'이라는 전제, 06-VERIFICATION.md gap 2 / 06-REVIEW.md CR-02가 지목한 결함 위치와 근거"
provides:
  - "describeTokenValidationFailure() — validateToken() 4개 실패 지점 전용 상태 코드 기반 확정 한국어 안내. context 타입에 서버 텍스트 필드가 없어 구조적으로 원문 유입을 막는다"
  - "AuthService.emitTokenValidationFailure() — validateToken()의 네 실패 지점이 공유하는 단일 emit 관문. describeTokenValidationFailure() → 식별자 병기 → maskSensitive() → _emit()"
  - "06-05-SUMMARY.md의 반증된 완료 선언에 대한 D-11 정정(원문 보존 + [VOID] + 정정문, 프론트매터/본문 양쪽)"
affects: [06-10]

# Actuals (#2632)
actuals:
  tokens: 6003
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "구조적 봉인 — 마스킹 규칙 보강(패턴 매칭) 대신, 서버 응답 텍스트를 담을 필드 자체가 없는 타입으로 노출 경로를 원천 차단. login-failure.ts의 identifier도 같은 원칙을 따르지만, 여기서는 함수 시그니처 자체가 그 원칙을 강제한다"
    - "단일 emit 관문 — validateToken()의 서로 다른 4개 실패 분기가 emitTokenValidationFailure() 하나로 수렴, buildFailureResult()가 credentialLogin() 쪽에서 하는 역할을 validateToken() 쪽에서 반복"

key-files:
  created:
    - src/shared/token-validation-failure.ts
    - src/shared/__tests__/token-validation-failure.test.ts
  modified:
    - src/main/services/auth-service.ts
    - src/main/services/__tests__/auth-service.test.ts
    - .planning/phases/06-ui/06-05-SUMMARY.md

key-decisions:
  - "검증자가 제시한 두 선택지(A: maskSensitive()로 원문 감싸기 / B: 상태 코드 기반 고정 문구로 대체) 중 B를 택했다 — maskSensitive()의 SENSITIVE_PATTERNS 13개 규칙 전부가 `key: value` 문맥에 의존하는데(mask.ts 직접 확인), 서버 응답 본문은 임의 구조라 문맥 없는 토큰 형태 문자열이 그 규칙을 그대로 통과한다(06-REVIEW.md WR-02). A안은 노출을 줄이는 것처럼 보이지만 보장하지 않는 두 번째 '검증되지 않은 완전성 주장'이 될 뻔했다. B안은 서버 텍스트가 애초에 문구 조립 함수의 타입 경로로 들어올 수 없게 만들어, 마스킹 규칙의 완전성에 의존하지 않는다"
  - "describeTokenValidationFailure()의 두 번째 인자 타입을 `{ status?: number }`로 좁혀 원문 유입 경로를 구조적으로 차단하고, 이 계약을 런타임이 아니라 @ts-expect-error 타입 단언(Test 4)으로 고정했다 — 런타임 값이 아니라 컴파일 타임 타입 표면이 곧 보안 경계이므로 typecheck가 그 가드다"
  - "06-05-SUMMARY.md의 반증된 완료 선언 두 곳(frontmatter key-decisions 세 번째 항목, 본문 Decisions Made 3번 절)을 D-11/06-03 관례대로 원문 보존 + [VOID] 마킹 + 정정문 병기로 처리했다 — 삭제하면 왜 틀렸는지가 사라져 재발 방지 근거가 사라진다"

patterns-established:
  - "실패 안내 모듈의 시그니처가 곧 보안 경계 — describeTokenValidationFailure()처럼 '서버 텍스트를 받을 수 없는 타입'을 만들면, 호출부가 실수로 원문을 넘기려 해도 typecheck가 막는다. mapLoginFailure()류(자유 문자열 detail을 받아 호출부의 마스킹 책임에 의존)보다 한 단계 더 강한 방어선"

requirements-completed: [R020]

coverage:
  - id: D1
    description: "validateToken() 4개 실패 지점 전용 상태 코드 기반 확정 한국어 안내 모듈(describeTokenValidationFailure())을 신설 — context 타입에 서버 텍스트 필드가 없다"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/token-validation-failure.test.ts#describeTokenValidationFailure (10 tests: 4-kind 전수, http-error identifier 유무, 부정 단언, @ts-expect-error 타입 계약, identifier 프로퍼티 부재)"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run typecheck:main — @ts-expect-error 라인이 실제로 타입 에러를 잡고 있음을 0-에러 종료로 확인"
        status: pass
    human_judgment: false
  - id: D2
    description: "validateToken()의 네 실패 지점(401 세션 복원 실패/!res.ok/JSON 파싱 실패/fanId 없음)이 emitTokenValidationFailure() 단일 관문으로 재배선되어, 서버 응답 원문이 더 이상 렌더러로 나가지 않는다"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.validateToken (신규 describe, 4개 실패 케이스 — 키 접두사 없는 150+자 토큰 형태 문자열이 emit된 message에 없음을 단언)"
        status: pass
      - kind: other
        ref: "grep -c 'rawBody.slice(0, 200)' src/main/services/auth-service.ts == 0; awk 범위 내 'this.emitTokenValidationFailure(' 카운트 == 4"
        status: pass
    human_judgment: false
  - id: D3
    description: "서버 응답 본문은 logService 진단 경로(rawBody.slice(0, 500) 라인)에 그대로 남아 관측성이 줄지 않았다"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.validateToken '진단 보존' 테스트 — logService.info spy가 토큰 형태 원문을 포함한 호출을 확인"
        status: pass
      - kind: other
        ref: "grep -c 'rawBody.slice(0, 500)' src/main/services/auth-service.ts == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "06-05-SUMMARY.md의 반증된 완료 선언(두 로그인 모드 공유 경로가 '자동으로 혜택을 받는다')이 D-11 관례로 정정됨 — 원문 보존, 두 위치(frontmatter/본문) 모두 [VOID] + 정정문"
    verification:
      - kind: other
        ref: "gsd-tools query frontmatter.validate --schema summary → valid:true; grep -c VOID>=2, 혜택>=2(원문 보존), 816970a>=1, CR-02>=1, 06-09>=1 — 전부 충족"
        status: pass
    human_judgment: false
  - id: D5
    description: "전체 회귀 없음 — 전체 테스트 스위트(339개, 06-08까지의 324개 기준선 대비 15개 증가) green, 두 typecheck(main/renderer) + build green, package.json/package-lock.json 무변경"
    verification:
      - kind: unit
        ref: "npm test — 18 files, 339 tests"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run typecheck:main && npm run build — 전부 0 에러; git diff --stat cd8a025 HEAD -- package.json package-lock.json 공백"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 09: validateToken() 마스킹 관문 gap closure + 06-05 완료 선언 정정 Summary

**두 로그인 모드가 공유하는 `validateToken()`의 네 실패 지점이 서버 응답 원문(최대 200자)을 마스킹 없이 렌더러로 흘려보내던 정보 노출(CR-02)을, 서버 텍스트를 담을 수 없는 타입의 상태 코드 기반 확정 한국어 안내 모듈로 구조적으로 봉인했다 — 그리고 이 경로를 "자동으로 커버된다"고 잘못 선언했던 06-05-SUMMARY.md를 D-11 관례로 정정했다.**

## Performance

- **Duration:** 약 7분
- **Started:** 2026-08-26T16:37:24+09:00 (Task 1 RED 커밋 기준)
- **Completed:** 2026-08-26T16:44:18+09:00 (Task 3 커밋 기준)
- **Tasks:** 3/3
- **Files modified:** 5 (2 신규, 3 수정)

## Accomplishments

- **Task 1:** `src/shared/token-validation-failure.ts`를 신설했다. `describeTokenValidationFailure(kind, context?)`가 `unauthorized`/`http-error`/`parse-error`/`missing-fan-id` 4가지 kind를 상태 코드 기반 확정 한국어 문구로 매핑한다. `context: { status?: number }`에는 서버 응답 텍스트를 담을 필드가 없다 — 원문이 이 함수로 들어올 타입 경로 자체가 없다. `login-failure.ts`와 같은 tier·같은 관용구(exhaustive switch, `default` 없음)를 쓰지만 별개의 union이며, `LoginFailureReason`은 참조도 확장도 하지 않는다.
- **Task 2:** `AuthService`에 private `emitTokenValidationFailure(kind, eventType, context?)`를 추가해 `validateToken()`의 네 실패 지점(401 세션 복원 실패 → `token-expired`, `!res.ok`/JSON 파싱 실패/`fanId` 없음 → `login-failed`)을 이 단일 관문으로 재배선했다. `rawBody.slice(0, 200)` 표현은 `validateToken()`에서 완전히 사라졌다. 식별자는 `buildLadderFailureEvent()`가 이미 쓰는 "`{message} (식별자: {identifier})`" 병기 관용구로 붙이고, 최종 문자열을 `maskSensitive()`에 통과시킨 뒤 `_emit()`한다 — 우리가 만든 확정 문구뿐이라 마스킹이 실제로 바꿀 것은 없지만, "렌더러로 나가는 문구는 전부 마스킹 관문을 통과한다"는 전제(06-05가 세웠다가 이 경로에서 깨진 바로 그 전제)를 실제로 참으로 만들기 위해서다. `rawBody.slice(0, 500)` 진단 라인은 그대로 남아 있다.
- **Task 3:** `06-05-SUMMARY.md`의 반증된 완료 선언 두 곳(frontmatter `key-decisions` 세 번째 항목, 본문 `## Decisions Made` 3번 절 — "두 모드가 공유하는 경로는 ... 자동으로 혜택을 받는다")을 06-03이 확립한 D-11 관례(원문 보존 + `[VOID]` 마킹 + 정정문 병기)로 정정했다.

## Task Commits

Each task was committed atomically (Task 1/2는 TDD RED→GREEN, Task 3는 문서 전용 단일 커밋):

1. **Task 1 RED: token-validation-failure 실패 테스트** - `390a089` (test)
2. **Task 1 GREEN: describeTokenValidationFailure() 구현** - `21b7a61` (feat)
3. **Task 2 RED: validateToken() rawBody 유출 회귀 테스트** - `c628b57` (test)
4. **Task 2 GREEN: validateToken() 네 지점 재배선** - `38ea0d7` (feat)
5. **Task 3: 06-05-SUMMARY.md 정정** - `d26b2bf` (docs)

**Plan metadata:** (이 커밋 다음)

## Files Created/Modified

- `src/shared/token-validation-failure.ts` (신규) — `describeTokenValidationFailure()`, `TokenValidationFailureKind`, `TokenValidationGuidance`, `TokenValidationGuidanceContext`
- `src/shared/__tests__/token-validation-failure.test.ts` (신규) — 10개 테스트 (전수 매핑, identifier 유무, 부정 단언, 타입 계약, identifier 프로퍼티 부재)
- `src/main/services/auth-service.ts` — `emitTokenValidationFailure()` 신설, `validateToken()`의 4개 실패 지점 재배선, import 추가
- `src/main/services/__tests__/auth-service.test.ts` — `AuthService.validateToken` describe 신설(5개 테스트), `makeTextFetchQueue`/`injectCachedToken` 헬퍼 추가
- `.planning/phases/06-ui/06-05-SUMMARY.md` — frontmatter/본문 두 곳 D-11 정정

## Decisions Made

**1. 검증자의 A안(`maskSensitive()`로 원문 감싸기)을 기각하고 B안(상태 코드 기반 고정 문구)을 택했다.**

`src/shared/mask.ts`를 직접 읽어 확인한 결과 `SENSITIVE_PATTERNS` 13개 규칙 전부가 `key["']?\s*[:=]` 형태의 키-값 문맥에 의존한다. 서버 응답 본문은 임의 구조의 문자열이라, 키 이름 접두사 없이 놓인 토큰 형태 문자열은 이 규칙 어느 것도 통과한다. A안(감싸기)은 노출을 줄이는 것처럼 보이지만 보장하지 않는다 — 이 phase가 이미 06-05에서 "검증 없이 완전성을 선언"해 한 번 당한 실패를 형태만 바꿔 반복하는 셈이었다. B안은 서버 텍스트가 문구 조립 함수의 타입 경로에 애초에 들어올 수 없게 만들어 패턴 매칭의 완전성에 의존하지 않는다. Task 2의 회귀 테스트는 정확히 이 차이를 증명하도록 설계했다 — 픽스처가 **키 접두사 없는** 150자 이상 토큰 형태 문자열이라, A안이었다면 통과했을 케이스를 잡는다.

**2. `TokenValidationGuidanceContext`를 `{ status?: number }`로 좁혀 타입 계약을 보안 경계로 썼다.**

런타임 검증이 아니라 함수 시그니처 자체가 "서버 텍스트를 받을 수 없다"를 강제한다. Task 1의 Test 4는 이 계약을 `@ts-expect-error` 라인으로 고정했다 — `npm run typecheck`가 이 계약의 상시 가드다.

**3. Task 2의 acceptance criterion 하나(raw `this._emit(` 잔존 개수)가 실제 코드와 어긋났다 — 플랜의 계산 오차로 판단하고 실제 동작을 우선했다.**

플랜은 "`awk .../validateToken/,/^  \}$/` 범위 내 `this._emit(` 잔존 개수 == 2 (네트워크/타임아웃 분기 + 성공 분기 둘뿐)"을 요구했다. 그러나 같은 범위 안에는 이 두 곳 외에도 로컬 JWT 만료 검사(`localExpired`) 분기의 `_emit()` 호출이 하나 더 있다 — 이 분기는 네트워크 호출 이전에 실행되고 하드코딩된 고정 문구("JWT 만료 — 다시 로그인해주세요")만 담아 rawBody를 전혀 쓰지 않으므로 CR-02의 네 실패 지점(401/`!res.ok`/파싱 실패/fanId 없음)에 속하지 않는다. 같은 태스크의 `<action>`은 "validateToken()의 나머지(로컬 만료 검사, 타임아웃/네트워크 에러 분기, 성공 경로)는 건드리지 않는다"고 명시적으로 금지했다. 두 지시(로컬 만료 검사를 건드리지 말 것 vs 잔존 `_emit` 정확히 2개)는 동시에 만족할 수 없다 — 실제 잔존 개수는 3이다(`localExpired`/네트워크·타임아웃 catch/성공). "네 지점만 고친다"는 gap의 범위 정의를 우선해 로컬 만료 분기는 건드리지 않았고, 이 acceptance criterion의 정확한 숫자만 플랜 저자의 계산 오차로 판단해 벗어났다. `emitTokenValidationFailure(` 호출 개수(정확히 4)와 `rawBody.slice(0, 200)` 잔존(0)이라는, gap의 실질을 검증하는 두 acceptance criterion은 모두 충족한다.

## Deviations from Plan

### Auto-fixed Issues

None — Rule 1~3 트리거(버그/누락된 필수 기능/블로킹 이슈) 없음.

### Plan-Text Discrepancy (신규 코드 문제 아님)

**1. [Task 2 acceptance criterion 오차] 잔존 `this._emit(` 개수가 플랜이 명시한 2가 아니라 3이다**
- **Found during:** Task 2 acceptance criteria 검증
- **Issue:** 위 "Decisions Made #3" 참고 — 플랜의 두 지시(로컬 만료 검사 무변경 vs 잔존 개수 정확히 2)가 서로 충돌한다.
- **Resolution:** 로컬 만료 검사(`localExpired`) 분기는 CR-02의 네 지점에 속하지 않고(서버 텍스트를 담지 않음), 같은 태스크가 명시적으로 "건드리지 말 것"이라 지시했으므로 그대로 두었다. 실제 잔존 개수는 3(`localExpired` + 네트워크/타임아웃 catch + 성공)이며, gap의 실질(rawBody 유출 제거, 4개 지점 재배선)을 검증하는 다른 acceptance criterion들은 전부 충족한다.
- **Files modified:** 없음(코드 변경 아님, 검증 판단의 문제)
- **Verification:** `awk '/async validateToken\(/,/^  \}$/' src/main/services/auth-service.ts | grep -c 'this._emit('` → 3 (플랜 기대치 2와 다름). `... | grep -c 'this.emitTokenValidationFailure('` → 4 (플랜 기대치와 일치). `grep -c 'rawBody.slice(0, 200)'` → 0 (플랜 기대치와 일치).

---

**Total deviations:** 0 코드 자동수정, 1 plan-text 불일치(문서화 후 실질 기준으로 해소).
**Impact on plan:** gap의 핵심 목표(서버 원문이 렌더러 화면에 도달하지 않는다)는 온전히 달성됐다. 어긋난 것은 지엽적인 grep 숫자 하나뿐이며, 로컬 만료 분기를 건드리지 않은 것은 오히려 같은 태스크의 다른 명시적 지시를 준수한 결과다.

## Issues Encountered

None.

## User Setup Required

None - 외부 서비스 설정 변경 없음.

## Next Phase Readiness

- `06-VERIFICATION.md` gap 2 / `06-REVIEW.md` CR-02가 코드·테스트로 해소됐다. `06-10-PLAN.md`가 남은 같은-루트 우회(WR-02 `SENSITIVE_PATTERNS` 문맥 한계, WR-03 미분류 7번째 실패 경로, IN-02 헤드리스 이메일 디버그 덤프)를 이어받는다 — 이 플랜은 그 세 항목의 범위를 침범하지 않았다(`credentialLogin()`/`buildFailureResult()` 무변경).
- `WR-04`(`settings:set-login-mode` 런타임 미검증)와 `IN-01`(`readSettings()` 오류 로그가 원인과 무관하게 항상 "파싱 실패"로 기록)은 06-09-PLAN.md의 `<review_disposition>`이 명시적으로 **DEFER**했다 — 두 gap(CR-01/CR-02) 어느 쪽과도 뿌리를 공유하지 않고, severity가 ASVS L1 블로킹 임계값 아래이며, Phase 07이 `settings.json` 위에 설정 항목을 더 쌓을 때(D-05가 예고한 시점) 같은 파일(`settings-store.ts`)을 함께 고치는 편이 gap closure 범위를 부풀리지 않는다.
- 06-05-SUMMARY.md의 완료 선언이 정정되어, 다음에 이 문서를 읽는 phase가 "이미 커버됐다"는 근거로 재검증을 건너뛸 수 없다.
- 블로커 없음.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/shared/token-validation-failure.ts
- FOUND: src/shared/__tests__/token-validation-failure.test.ts
- FOUND: src/main/services/auth-service.ts (emitTokenValidationFailure present)
- FOUND: .planning/phases/06-ui/06-05-SUMMARY.md (VOID markers present)
- FOUND commit: 390a089 (test, Task 1 RED)
- FOUND commit: 21b7a61 (feat, Task 1 GREEN)
- FOUND commit: c628b57 (test, Task 2 RED)
- FOUND commit: 38ea0d7 (feat, Task 2 GREEN)
- FOUND commit: d26b2bf (docs, Task 3)
- Re-ran `npx vitest run src/shared/__tests__/token-validation-failure.test.ts` → 10 passed
- Re-ran `npx vitest run src/main/services/__tests__/auth-service.test.ts` → 50 passed
- Re-ran full suite `npm test` → 339 passed (18 files)
- Re-ran `npm run typecheck` → 0 errors
- Re-ran `npm run typecheck:main` → 0 errors
- Re-ran `npm run build` → passing
- `grep -c 'rawBody.slice(0, 200)' src/main/services/auth-service.ts` → 0
- `grep -c 'rawBody.slice(0, 500)' src/main/services/auth-service.ts` → 1
- `awk '/async validateToken\(/,/^  \}$/' ... | grep -c 'this.emitTokenValidationFailure('` → 4
- `node ~/.claude/gsd-core/bin/gsd-tools.cjs query frontmatter.validate .planning/phases/06-ui/06-05-SUMMARY.md --schema summary` → valid:true
- `git diff --stat cd8a025 HEAD -- package.json package-lock.json` → 공백
- 전체 acceptance_criteria (Task 1: 6개, Task 2: 9개 중 8개 — 1개는 위 "Plan-Text Discrepancy" 참고, Task 3: 7개) → 그 1개를 제외하고 전부 PASS
