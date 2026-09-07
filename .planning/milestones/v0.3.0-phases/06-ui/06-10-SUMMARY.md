---
phase: 06-ui
plan: 10
subsystem: auth
tags: [masking, security, korean-copy, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 06-ui (06-05, 06-VERIFICATION, 06-REVIEW, 06-09)
    provides: "06-05가 세운 'buildFailureResult()가 유일한 마스킹 관문'이라는 전제, 06-REVIEW.md WR-02/WR-03/IN-02가 지목한 결함 위치와 근거, 06-09가 남긴 gap 2(CR-02)의 해소 결과와 buildFailureResult() 계약 테스트 관용구"
provides:
  - "SENSITIVE_PATTERNS 의 14번째(마지막) 규칙 — 키 이름 문맥 없이도 JWT 구조(3분절 base64url, 각 10자 이상)를 매칭하는 2차 방어선"
  - "buildFailureResult() 의 overrideMessage 4번째 선택 파라미터 — 확정 문구가 이미 있는 분기를 안내 후퇴 없이 마스킹 관문에 태우는 자리"
  - "credentialLogin() 의 btnEnabled 실패 분기가 buildFailureResult() 를 거쳐 login-failed 이벤트를 형제 분기들과 동일하게 발행"
  - "헤드리스 디버그 덤프에서 이메일 원문 필드(emailValue) 제거, 길이 필드(emailLen)로 교체"
affects: []

# Actuals (#2632)
actuals:
  tokens: 3616
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "2차 방어선 마스킹 규칙 — 키-값 문맥에 의존하는 13개 규칙과 달리 값의 구조(JWT 형태)만으로 매칭. 06-09 의 구조적 봉인(서버 텍스트를 아예 문구 조립 함수에 넣지 않음)이 1차 방어선이고, 이 규칙은 그 원칙을 적용하지 않은/못하는 나머지 경로를 위한 보완이라고 주석에 서열을 못 박음"
    - "확정 문구 override 파라미터 — 사유 분류·문구 조립을 건너뛰고 싶지만 마스킹 관문은 반드시 거쳐야 하는 분기를 위해 buildFailureResult() 에 선택 파라미터를 추가. 기존 3개 파라미터 호출부는 전부 그대로 동작(후방 호환)"

key-files:
  created: []
  modified:
    - src/shared/mask.ts
    - src/shared/__tests__/mask.test.ts
    - src/main/services/auth-service.ts
    - src/main/services/__tests__/auth-service.test.ts

key-decisions:
  - "새 JWT 규칙의 각 분절 최소 길이를 10자로 정했다 — 06-REVIEW.md WR-02 Fix 제안(`[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}`)을 그대로 채택했고, 이 저장소의 실제 계정 API 호스트(`accountapi.weverse.io` — 가운데 분절 `weverse` 7자)로 역산 검증해 도메인이 걸리지 않음을 확인했다. 이 저장소의 실제 진단 로그 문장(토큰 shape 라인)으로도 검증해 훼손이 없음을 확인했다"
  - "overrideMessage 를 4번째(마지막) 선택 파라미터로 추가해 기존 3개 파라미터 호출부 전부를 무변경으로 남겼다 — WR-03 분기 하나만 이 파라미터를 쓴다"
  - "btnEnabled 실패의 overrideReason 을 'unknown'으로 선택했다 — LoginFailureReason 6가지 중 이 분기는 DOM 신호도 아니고 다른 5가지 구체적 사유(캡차/폼오류/타임아웃/네트워크오류/사다리실패)에도 해당하지 않아, 이미 '미매핑 폴백'의 의미로 쓰이는 'unknown'이 가장 정확하다"
  - "credentialLogin() 자체와 headless BrowserWindow DOM 폴링은 이 환경에서 실행할 수 없으므로, WR-03/IN-02 검증은 06-09 가 세운 관용구를 그대로 따랐다 — private 메서드(buildFailureResult)에 대한 계약 테스트, 그리고 실행 불가능한 executeJavaScript 템플릿에 대해서는 소스 파일을 텍스트로 읽어 단언하는 소스 수준 검증"

patterns-established:
  - "소스 수준 단언 테스트 — 실행할 수 없는 코드(headless DOM 템플릿 리터럴)를 fs.readFileSync 로 소스를 읽어 grep/정규식으로 단언하는 방식을 테스트 파일 안으로 옮김. acceptance_criteria 의 bash grep 관용구와 동형(isomorphic)이라 플랜과 테스트가 같은 언어로 같은 사실을 두 번 검증한다"

requirements-completed: [R020]

coverage:
  - id: D1
    description: "SENSITIVE_PATTERNS 배열 맨 끝에 문맥 무관 JWT 형태 마스킹 규칙을 추가 — 키 이름 접두사 없이 문장에 섞인 토큰 형태 문자열도 마스킹되고, 도메인·파일 경로·버전 문자열·기존 진단 로그는 훼손되지 않는다"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/mask.test.ts#maskSensitive — 문맥 무관 JWT 형태 규칙 (WR-02) (신규 7개: 양성 3 + 훼손방지 4)"
        status: pass
      - kind: other
        ref: "grep -vE 주석 필터 후 SENSITIVE_PATTERNS 언급 2회(선언+순회) 확인, 새 규칙이 배열 마지막 항목임을 awk+tail 로 확인, npm test 354개 green"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildFailureResult() 에 overrideMessage 4번째 선택 파라미터를 추가하고, btnEnabled 실패 분기가 이를 통해 마스킹 관문을 거치도록 재배선 — 사용자 문구는 글자 그대로 보존, 형제 분기와 동일하게 login-failed 이벤트 발행"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.buildFailureResult (overrideMessage 3개 신규 테스트) + #AuthService — btnEnabled 실패 분기 소스 수준 단언 (buildFailureResult/_emit 호출, 객체 리터럴 직접 반환 부재, 문구 보존 확인)"
        status: pass
      - kind: other
        ref: "grep -c '로그인 버튼이 활성화되지 않았습니다' == 1; awk 범위 내 this.buildFailureResult(==1, success: false==0, this._emit(==1; git diff HEAD~4 -- src/shared/login-failure.ts 공백(6가지 신호 계약 무변경)"
        status: pass
    human_judgment: false
  - id: D3
    description: "헤드리스 디버그 덤프 템플릿에서 이메일 원문 필드(emailValue)를 제거하고 길이 필드(emailLen)로 교체 — 293행 부근 기존 관용구와 동일한 형태"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService — btnEnabled 실패 분기 소스 수준 단언 (emailValue 부재, emailLen 필드 존재 확인)"
        status: pass
      - kind: other
        ref: "grep -c 'emailValue' src/main/services/auth-service.ts == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "전체 회귀 없음 — 전체 테스트 스위트(354개, 06-09까지의 339개 기준선 대비 15개 증가) green, 두 typecheck(main/renderer) + build green, package.json/package-lock.json 무변경, 기존 테스트 무수정(삭제 줄 0)"
    verification:
      - kind: unit
        ref: "npm test — 354 tests green"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run typecheck:main && npm run build — 전부 0 에러/0 종료; git diff --numstat (RED 커밋 기준) 두 테스트 파일 모두 삭제 줄 0; git diff --stat -- package.json package-lock.json 공백"
        status: pass
    human_judgment: false

duration: 약 3분
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 10: 로그인 방식 선택 UI + 실패 안내 — gap closure (WR-02/WR-03/IN-02) Summary

**gap 2 와 같은 뿌리를 가진 마스킹 관문 우회 경로 세 곳(문맥 없는 JWT 마스킹 한계, 7번째 미분류 실패 반환, 헤드리스 디버그 덤프의 이메일 평문)을 전부 닫아, `buildFailureResult()`가 유일한 마스킹 관문이라는 이 phase의 전제를 실제로 참으로 만들었다.**

## Performance

- **Duration:** 약 3분 (Task 1 RED 커밋 `e0dc6c7` 기준 ~ Task 2 GREEN 커밋 `ff8c08b` 기준)
- **Started:** 2026-08-26T16:52:55+09:00
- **Completed:** 2026-08-26T16:55:15+09:00
- **Tasks:** 2/2
- **Files modified:** 4 (신규 파일 없음, 전부 06-05/06-09가 이미 만든 파일 위에서 작업)

## Accomplishments

- **Task 1 (WR-02):** `src/shared/mask.ts`의 `SENSITIVE_PATTERNS` 배열 맨 끝에 문맥 무관 JWT 형태 마스킹 규칙을 추가했다. 최종 정규식은 `/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g` — 06-REVIEW.md WR-02의 Fix 제안을 그대로 채택했다. 각 분절 최소 10자 하한은 이 저장소의 실제 계정 API 호스트 `accountapi.weverse.io`(가운데 분절 `weverse`가 7자로 미달)와 실제 토큰 shape 진단 로그 문장으로 역산 검증했다 — 두 값 모두 새 규칙에 걸리지 않는다. 배열 맨 끝에 둔 이유(앞선 키-값 규칙이 먼저 마스킹한 자리는 `maskToken()`의 생략 표기 `"..."` 때문에 3분절 형태가 아니게 되므로 이 규칙이 다시 건드리지 않는다)와, 이 규칙조차 JWT 구조가 아닌 토큰은 여전히 통과시킨다는 불완전성(2차 방어선일 뿐, 1차 방어선은 06-09가 세운 구조적 봉인)을 코드 주석에 명시했다. `mask.test.ts`에 새 describe(양성 3 + 훼손방지 4, 총 7개)를 추가했고 기존 45개 테스트는 한 줄도 수정하지 않았다.
- **Task 2 (WR-03 · IN-02):** `buildFailureResult()`에 4번째 선택 파라미터 `overrideMessage?: string`을 추가했다 — 기존 3개 파라미터 호출부(캡차/타임아웃/폼오류/네트워크오류/사다리실패 5개 사유 전부)는 무변경으로 동작한다(후방 호환). `credentialLogin()`의 `btnEnabled` 실패 분기(구 `{ success: false, message: "..." }` 직접 반환)를 `this.buildFailureResult(null, "unknown", undefined, "로그인 버튼이 활성화되지 않았습니다. 이메일/비밀번호를 확인해주세요.")` 호출로 재배선했다 — 사용자 대면 문구는 글자 하나 바뀌지 않았다. 같은 분기에 형제 분기들과 동일한 `this._emit({ type: "login-failed", ... })` 이벤트 발행을 추가해, 상단 배너와 인라인 오류가 이제 같은 정보를 공유한다. 같은 코드 블록의 디버그 덤프 템플릿에서 `emailValue: emailInput?.value ?? 'NOT FOUND'`(이메일 원문)를 `emailLen: emailInput?.value?.length ?? -1`(길이만)로 교체했다 — 바로 위 293행 부근의 기존 관용구와 동일한 형태다. `auth-service.test.ts`에 `buildFailureResult` describe 안에 overrideMessage 신규 테스트 3개를 추가하고, 실행 불가능한(headless DOM) 분기를 위한 별도 소스 수준 단언 describe(5개 테스트 — emailValue 부재, emailLen 존재, buildFailureResult 호출, `_emit` 호출, 문구 보존)를 신설했다.

## Task Commits

Each task was committed atomically (Task 1/2 모두 TDD RED→GREEN):

1. **Task 1 RED: mask.test.ts 문맥 무관 JWT 마스킹 실패 테스트** - `e0dc6c7` (test)
2. **Task 1 GREEN: SENSITIVE_PATTERNS 14번째 규칙 구현** - `de0e1af` (feat)
3. **Task 2 RED: buildFailureResult overrideMessage + btnEnabled 소스 단언 실패 테스트** - `9cd6180` (test)
4. **Task 2 GREEN: btnEnabled 분기 재배선 + 디버그 덤프 이메일 필드 교체** - `ff8c08b` (feat)

**Plan metadata:** (이 커밋 다음)

## Files Created/Modified

- `src/shared/mask.ts` — `SENSITIVE_PATTERNS`에 문맥 무관 JWT 형태 규칙(14번째, 마지막 항목) 추가
- `src/shared/__tests__/mask.test.ts` — 신규 describe `maskSensitive — 문맥 무관 JWT 형태 규칙 (WR-02)` (7개 테스트), 기존 테스트 무수정
- `src/main/services/auth-service.ts` — `buildFailureResult()`에 `overrideMessage` 파라미터 추가, `btnEnabled` 실패 분기 재배선(관문 통과 + 이벤트 발행), 디버그 덤프 `emailValue`→`emailLen` 교체
- `src/main/services/__tests__/auth-service.test.ts` — `PrivateFailureBuilders` 인터페이스에 `overrideMessage` 추가, `buildFailureResult` describe에 신규 테스트 3개, 신규 소스 수준 단언 describe(5개 테스트), 기존 테스트 무수정

## Decisions Made

**1. JWT 규칙의 분절 최소 길이 10자 — 06-REVIEW.md의 제안 정규식을 그대로 채택하고 실측으로 역산 검증했다.**

`SENSITIVE_PATTERNS` 규칙 13개 전부가 `key: value` 문맥에 의존하는 구조적 한계(06-09가 이미 확인)를 메우는 규칙이라, 하한을 너무 낮게 잡으면 정상 진단 텍스트(도메인·경로·버전)를 훼손하고 너무 높게 잡으면 짧은 서명(signature) 분절을 가진 실제 토큰을 놓친다. 06-REVIEW.md WR-02의 Fix 제안(`{10,}`)을 채택한 뒤, 이 저장소의 **실제** 계정 API 호스트(`accountapi.weverse.io`)와 **실제** 토큰 shape 진단 로그 문장(`auth-service.ts` 909행 형태)으로 역산 검증했다 — `weverse`(7자)가 10자 하한에 미달해 도메인은 걸리지 않고, 진단 로그는 실제 dot-3분절 구조가 아니라(`prefix=...` 뒤에 리터럴 "..."만 있어) 애초에 매칭 대상이 아니다. 기존 45개 + 신규 7개 = 52개 `mask.test.ts` 테스트가 전부 green이라 이 선택이 기존 동작 어느 것도 훼손하지 않았음을 실측으로 확인했다.

**2. `overrideMessage`를 4번째 파라미터로 추가해 기존 호출부 전부를 무변경으로 남겼다.**

`buildFailureResult()`는 이미 `credentialLogin()`의 5개 사유(캡차/폼오류/타임아웃/네트워크오류/사다리실패) 호출부가 쓰고 있는 함수다. 새 분기 하나를 위해 시그니처를 바꾸는 대신 선택 파라미터를 맨 끝에 추가해, 기존 5개 호출부가 전부 그대로 동작함을 `auth-service.test.ts`의 기존 테스트(무수정)로 확인했다.

**3. `overrideReason`으로 `"unknown"`을 선택했다.**

`LoginFailureReason` 6개 값 중 `btnEnabled` 실패는 DOM 신호 분류 대상도 아니고(`classifyCredentialLoginSignal()`을 거치지 않는다) 나머지 5개 구체적 사유 중 어느 것도 아니다. `"unknown"`은 이미 `login-failure.ts`에서 "미매핑 폴백"의 의미로 쓰이고 있어, 이 분기의 실제 성격(DOM 신호 분류 체계 밖의 실패)과 정확히 일치한다.

## Deviations from Plan

### Auto-fixed Issues

None — Rule 1~3 트리거(버그/누락된 필수 기능/블로킹 이슈) 없음. 플랜의 `<action>` 지시와 코드가 정확히 일치했다(06-09가 예고한 "라인 번호가 안 맞을 수 있다"는 경고와 달리, 이 플랜이 겨냥한 `mask.ts`·`buildFailureResult()`·`btnEnabled` 분기는 06-09가 건드리지 않은 영역이라 계획대로 진행됐다).

---

**Total deviations:** 0.
**Impact on plan:** 계획대로 실행됐다. 06-09가 남긴 인접 영역 변화(라인 번호 이동 등)는 이 플랜이 겨냥한 세 지점(`mask.ts` 전체, `buildFailureResult()`, `btnEnabled` 분기)과 겹치지 않아 별도 조정이 필요 없었다.

## Issues Encountered

None.

## User Setup Required

None - 외부 서비스 설정 변경 없음.

## Next Phase Readiness

- `06-REVIEW.md`의 10개 발견(Critical 2 + Warning 4 + Info 4)이 전부 처리되거나 근거와 함께 미뤄졌다:
  - CR-01 → 06-08 (해소) · CR-02 → 06-09 (해소)
  - WR-01 → 06-08 (해소) · IN-03 → 06-08 (부분 — 문서화만) · IN-04 → 06-08 (DEFER, UAT #2)
  - WR-04 → 06-09 (DEFER, Phase 07) · IN-01 → 06-09 (DEFER, Phase 07)
  - **WR-02 · WR-03 · IN-02 → 이 플랜 (해소)**
- `.planning/WINDOWS.md`의 열린 항목 1건(06-09가 남긴 `validateToken()` 잔존 `_emit` 개수 3 vs 플랜 기대치 2)은 이 플랜의 범위(`credentialLogin()`의 `btnEnabled` 분기, `mask.ts`)와 겹치지 않아 해소되지 않았다 — `validateToken()`을 건드리지 않았으므로 그대로 열어둔다.
- 이 플랜으로 06-REVIEW.md/06-VERIFICATION.md가 지목한 마스킹 관문 우회 경로(WR-02/WR-03/IN-02)가 모두 코드·테스트로 닫혔다. `credentialLogin()`이 도달 가능한 모든 실패 반환이 이제 `buildFailureResult()`를 거친다(관문 밖에서 렌더러로 나가는 경로 없음).
- 블로커 없음.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/shared/mask.ts (14번째 SENSITIVE_PATTERNS 규칙 존재)
- FOUND: src/shared/__tests__/mask.test.ts (WR-02 describe 존재, 기존 45개 테스트 무수정)
- FOUND: src/main/services/auth-service.ts (overrideMessage 파라미터, btnEnabled 재배선, emailLen 존재)
- FOUND: src/main/services/__tests__/auth-service.test.ts (overrideMessage 테스트 3개 + 소스 단언 5개)
- FOUND: .planning/phases/06-ui/06-10-SUMMARY.md
- FOUND commit: e0dc6c7 (test, Task 1 RED)
- FOUND commit: de0e1af (feat, Task 1 GREEN)
- FOUND commit: 9cd6180 (test, Task 2 RED)
- FOUND commit: ff8c08b (feat, Task 2 GREEN)
- Re-ran `npx vitest run src/shared/__tests__/mask.test.ts` → 57 passed
- Re-ran `npx vitest run src/main/services/__tests__/auth-service.test.ts` → 58 passed
- Re-ran full suite `npm test` → 354 passed (06-09 기준 339 대비 +15)
- Re-ran `npm run typecheck` → 0 errors
- Re-ran `npm run typecheck:main` → 0 errors
- Re-ran `npm run build` → passing
- `grep -c 'emailValue' src/main/services/auth-service.ts` → 0
- `grep -c '로그인 버튼이 활성화되지 않았습니다' src/main/services/auth-service.ts` → 1
- `awk '/if \(!btnEnabled\)/,/^      \}$/' ... | grep -c 'this.buildFailureResult('` → 1
- `awk '/if \(!btnEnabled\)/,/^      \}$/' ... | grep -c 'success: false'` → 0
- `awk '/if \(!btnEnabled\)/,/^      \}$/' ... | grep -c 'this._emit('` → 1
- `git diff HEAD~4 -- src/shared/login-failure.ts` → 공백 (6가지 신호 계약 무변경)
- `git diff --numstat` (RED 커밋 대비) 두 테스트 파일 모두 삭제 줄 0
- `git diff --stat -- package.json package-lock.json` → 공백
- `node ~/.claude/gsd-core/bin/gsd-tools.cjs query frontmatter.validate .planning/phases/06-ui/06-10-SUMMARY.md --schema summary` → valid:true
- 전체 acceptance_criteria (Task 1: 6개, Task 2: 12개) → 전부 PASS
