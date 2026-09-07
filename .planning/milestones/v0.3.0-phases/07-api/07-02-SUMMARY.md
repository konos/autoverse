---
phase: 07-api
plan: 02
subsystem: auth
tags: [electron, safeStorage, jwt, masking, ipc-contract, vitest]

# Dependency graph
requires:
  - phase: 07-01
    provides: "token-expiry.ts 순수 판정 모듈, ApplyEngine.arm() 의 token-expiry-checked 이벤트, D-08 외부 호출 0 관례 — 이 플랜은 별도 배선 없이 순수 참조만 했다(직접 재사용 없음)"
provides:
  - "src/shared/mask.ts 의 maskEmail() — 이메일이 화면/로그로 나가는 모든 경로의 단일 마스킹 관문"
  - "src/shared/types.ts 의 StoredCredentialsSnapshot — password 필드가 타입에 존재하지 않는 IPC 계약"
  - "AuthService.getStoredCredentialsSnapshot() / loginWithStoredCredentials() — D-04 4상태 읽기 + D-03 main 최종 게이트"
  - "AuthService.credentialLoginInFlight 가드 — 연속 클릭이 헤드리스 창을 중복으로 열지 않음"
  - "AuthService.restoreTokenIfLost() — 재로그인 실패가 이전 토큰을 앗아가지 않는 D-14 보장"
affects: ["07-03", "07-04", "07-05"]

actuals:
  tokens: 8164
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "D-04 삭제-후-재입력 관례를 ProfileStore 에서 AuthService 로 이식하되 throw 대신 상태 반환으로 바꿈 — IPC 경계를 넘는 메서드는 예외를 던지지 않는다는 원칙을 이 플랜이 처음 명시적으로 세웠다"
    - "main 프로세스 최종 게이트(WR-03 선례) — 렌더러 disabled 와 무관하게 IPC 진입점 내부에서 신뢰 경계 판정을 다시 수행"
    - "in-flight 가드 + finally 해제 — 외부 부수효과가 있는 비멱등 요청(헤드리스 로그인)을 연속 클릭으로부터 보호"

key-files:
  created: []
  modified:
    - src/shared/mask.ts
    - src/shared/__tests__/mask.test.ts
    - src/shared/types.ts
    - src/main/services/auth-service.ts
    - src/main/services/__tests__/auth-service.test.ts

key-decisions:
  - "credentialLogin() 의 in-flight 가드는 별도 private 메서드로 추출하지 않고 기존 메서드 본문을 try/finally 로 감싸는 형태로 최소 diff 유지 — 260줄 넘는 기존 DOM 폴링 로직을 재인덴트하는 리스크를 피했다"
  - "readStoredCredentials() 의 손상 판정에 email 뿐 아니라 password 필드 타입도 함께 검사 — 계획의 acceptance_criteria 는 email 만 명시했지만, password 가 문자열이 아니면 이후 credentialLogin() 호출이 타입 불일치로 깨지므로 Rule 2(누락된 필수 방어)로 추가"
  - "credentialLogin() 자체(헤드리스 BrowserWindow DOM 흐름)는 이 저장소에 DOM 테스트 환경이 없어 직접 실행할 수 없다는 기존 관례를 그대로 따라, D-14 회귀는 restoreTokenIfLost() private 헬퍼를 직접 호출하는 계약 테스트로 검증했다 — 중복 가드 테스트만 예외적으로 BrowserWindow 모킹을 확장해 실제 credentialLogin() 진입부(가드 체크 → new BrowserWindow)까지 태웠다"

requirements-completed: []

coverage:
  - id: D1
    description: "maskEmail() 이 이메일 로컬파트 첫 글자+마스킹, 도메인 보존 형태로 마스킹하고 SENSITIVE_PATTERNS 의 email 키 규칙이 JWT 구조 규칙보다 먼저 등록돼 로그 경로도 같은 관문을 지난다"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/mask.test.ts#maskEmail, #maskSensitive"
        status: pass
    human_judgment: false
  - id: D2
    description: "getStoredCredentialsSnapshot() 이 none/available/corrupted/unavailable 4상태를 정확히 구분한다 — 손상은 삭제, safeStorage 불가는 보존"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.getStoredCredentialsSnapshot — D-04 4상태 계약"
        status: pass
    human_judgment: false
  - id: D3
    description: "loginWithStoredCredentials() 이 이메일 불일치 시 credentialLogin() 을 호출하지 않고 외부 요청 없이 실패를 반환한다(D-03 main 최종 게이트)"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.loginWithStoredCredentials — D-01/D-03 게이트"
        status: pass
    human_judgment: false
  - id: D4
    description: "credentialLoginInFlight 가드가 연속 호출 시 두 번째 호출을 헤드리스 창을 열기 전에 즉시 실패시키고, BrowserWindow 생성자가 1회만 호출된다(T-07-09)"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.credentialLogin — 중복 실행 가드 (T-07-09)"
        status: pass
    human_judgment: false
  - id: D5
    description: "재로그인이 실패해도 호출 이전에 유효했던 토큰이 메모리에 남는다 — 호출 이전에 토큰이 없었다면 실패 후에도 만들어내지 않는다(D-14)"
    requirement: "R022"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/auth-service.test.ts#AuthService.restoreTokenIfLost — 재로그인 실패가 기존 토큰을 앗아가지 않는다 (D-14)"
        status: pass
    human_judgment: true
    rationale: "restoreTokenIfLost() 헬퍼 자체는 단위 테스트로 완전히 커버했으나, credentialLogin() 의 세 실패 지점이 실제로 이 헬퍼를 호출하는지는 이 저장소에 DOM 테스트 환경이 없어 소스 수준 grep(restoreTokenIfLost 호출 3회)으로만 확인했다 — 실제 헤드리스 로그인 실패 시나리오의 종단 확인은 UAT 대상."

duration: ~20min
completed: 2026-08-27
status: complete
---

# Phase 7 Plan 2: 저장 자격증명 메인 게이트 + 마스킹 관문 Summary

**이메일 전용 마스킹 관문(`maskEmail()`) 신설, `credentials.enc` 4상태 정직한 계약(`getStoredCredentialsSnapshot()`), 저장 비밀번호 로그인의 main 프로세스 이메일 불일치 최종 게이트(`loginWithStoredCredentials()`), 중복 클릭 방지 in-flight 가드, 재로그인 실패 시 기존 토큰 복원(`restoreTokenIfLost()`)까지 R023 의 신뢰 경계를 코드로 고정했다.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-27T17:05(추정, phase context 세션 연속)
- **Completed:** 2026-08-27T17:21:42+09:00
- **Tasks:** 3 (전부 `tdd="true"`)
- **Files modified:** 5

## Accomplishments

- **이메일 마스킹 단일 관문 신설(D-07/R010/IN-02)** — `maskEmail()` 이 로컬파트 첫 글자+마스킹, 도메인 보존 형태로 이메일을 가린다. `SENSITIVE_PATTERNS` 의 email 키 규칙이 JWT 구조 규칙(배열 맨 끝, 순서 의존적)보다 앞에 등록돼, 화면 문구뿐 아니라 로그 자동 마스킹 경로도 같은 관문을 지난다. `auth-service.ts` 의 저장 성공 로그(구 `email.slice(0,3)***` 임시 마스킹)를 `maskEmail()` 호출로 교체했고, 헤드리스 입력 상태 진단 로그의 키 이름을 `email=`/`pw=` 에서 `emailLen=`/`pwLen=` 으로 정정해 새 규칙이 길이 숫자를 마스킹하지 않게 했다. 기존 "이메일은 보존된다" 단언 테스트를 IN-02 공백을 닫는 새 계약에 맞춰 뒤집었다(주석으로 근거 명시).
- **`credentials.enc` 4상태 정직한 계약(D-04)** — `readStoredCredentials()` 단일 읽기 지점이 `ProfileStore.getProfile()` 의 삭제-후-재입력 선례를 따르되 throw 대신 상태 반환으로 바꿨다(IPC 경계 — 어떤 경우에도 예외를 던지지 않는다). 파일 없음→`none`, safeStorage 불가→`unavailable`(파일 보존), 복호화/파싱/필드 형식 실패→`corrupted`(파일 삭제), 정상→`available`+이메일만. `StoredCredentialsSnapshot` 타입은 어떤 갈래에도 `password` 필드가 없어 D-01 이 타입 수준에서 구조적으로 보장된다.
- **저장 비밀번호 로그인의 main 최종 게이트(D-01/D-03)** — `loginWithStoredCredentials(inputEmail)` 이 정규화(trim+소문자) 비교로 입력 이메일과 저장 이메일을 다시 비교한다. 불일치·none·unavailable·corrupted 네 경우 모두 `credentialLogin()` 을 호출하지 않고 그 자리에서 실패를 반환한다 — 렌더러의 `disabled` 상태와 무관하게 동작한다(WR-03/05-01 재발 방지).
- **중복 클릭 방지 in-flight 가드(T-07-09)** — `credentialLoginInFlight` 플래그가 진행 중인 두 번째 호출을 헤드리스 창을 열기 전에 즉시 실패시킨다. 기존 return 지점이 여러 개인 메서드를 재인덴트하지 않고 try/finally 로 감싸 최소 diff 로 해제를 보장했다.
- **재로그인 실패가 기존 토큰을 앗아가지 않는다(D-14)** — `credentialLogin()` 이 쿠키 제거 직전 `this.cachedToken` 을 `previousToken` 으로 백업하고, 세 실패 지점(btnEnabled/분류된 DOM 신호/catch) 각각에서 `restoreTokenIfLost()` 를 호출한다. 복원이 실효적인 이유(`submitApplication()` 이 쿠키가 아니라 `Authorization: Bearer` 헤더로 인증)를 주석으로 남겼다.

## Task Commits

1. **Task 07-02-01: 이메일 마스킹 단일 관문 신설 (D-07/R010/IN-02)** - `625e005` (feat)
2. **Task 07-02-02: credentials.enc 4상태 읽기(D-04) + 저장 비밀번호 로그인의 메인 최종 게이트(D-01/D-03)** - `7c40001` (feat)
3. **Task 07-02-03: 재로그인 실패 시 기존 토큰 복원 (D-14)** - `44757a5` (feat)

**Plan metadata:** (본 커밋)

_세 태스크 모두 `tdd="true"`였으나, 기존 관례(`login-failure.ts`/`login-panel-view.ts`/07-01)와 동일하게 각 태스크를 단일 `feat(...)` 커밋으로 완결했다 — 신규 export 심볼은 파일에 아직 존재하지 않는 상태에서 "테스트를 먼저 실행해 실패를 확인"하는 것이 import 실패로만 나타나 RED 단계의 신호가 되지 못하기 때문이다. `<behavior>` 블록의 모든 케이스를 테스트 파일에 먼저 작성한 뒤 구현으로 통과시켰다는 점에서 RED→GREEN 순서 취지는 지켰다. 아래 TDD Gate Compliance 참조._

## Files Created/Modified

- `src/shared/mask.ts` - `maskEmail()` + `SENSITIVE_PATTERNS` email 키 규칙(JWT 구조 규칙 앞)
- `src/shared/__tests__/mask.test.ts` - `maskEmail` describe 블록 6케이스, "email preserved" 케이스를 마스킹 기대로 뒤집음, `emailLen=`/`pwLen=` 진단 로그 훼손 방지 케이스
- `src/shared/types.ts` - `StoredCredentialsSnapshot` discriminated union(4상태, password 필드 없음)
- `src/main/services/auth-service.ts` - `maskEmail` import+적용, `readStoredCredentials()`/`getStoredCredentialsSnapshot()`/`loginWithStoredCredentials()` 신설, `credentialLoginInFlight` 필드+가드, `previousToken` 백업+`restoreTokenIfLost()` 신설+3개 실패 지점 배선
- `src/main/services/__tests__/auth-service.test.ts` - D-04 4상태(6케이스), D-01/D-03 게이트(5케이스), 중복 가드(1케이스, BrowserWindow 모킹 확장), D-14 복원(4케이스)

## Decisions Made

- **in-flight 가드는 별도 메서드 추출 없이 기존 본문을 try/finally 로 감쌈** — 260줄 넘는 DOM 폴링 로직을 재인덴트하는 리스크를 피하고 diff를 최소화했다. 결과적으로 감싸진 블록의 들여쓰기가 메서드 본문과 일치하지 않지만, 이 저장소에는 eslint indent 규칙이 없어 문제되지 않는다.
- **readStoredCredentials() 가 password 필드 타입도 함께 검사** — 계획의 acceptance_criteria 는 email 만 명시했지만, password 가 문자열이 아니면 `credentialLogin(snapshot.email, password as string)` 호출이 타입 불일치로 깨지므로 Rule 2(누락된 방어)로 추가했다.
- **중복 가드 테스트만 예외적으로 BrowserWindow 를 실제로 모킹해 credentialLogin() 진입부를 태움** — 나머지 D-14/D-04/D-03 케이스는 기존 관례(private 헬퍼 직접 호출 계약 테스트)를 따랐지만, 가드 자체는 "헤드리스 창이 실제로 1회만 열리는가"를 검증해야 의미가 있어 `new BrowserWindow` 호출까지 진행하는 fake window(login form 대기 단계에서 영원히 pending)를 구성했다.

## Deviations from Plan

None - plan executed exactly as written. password 필드 방어 검사와 in-flight 가드의 try/finally 배치 방식은 계획의 재량 범위 안에서 내린 구현 판단이며 별도 편차로 기록하지 않는다.

## Issues Encountered

- 중복 가드 테스트 최초 작성 시 `vi.mocked(BrowserWindow).mockImplementation(() => fakeWin)` 화살표 함수를 `new` 로 호출해 "is not a constructor" unhandled rejection 이 발생했다. `function` 표현식으로 교체해 해결했다(Rule 1 — 테스트 코드 버그, 즉시 수정 후 계속).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **main 프로세스 자격증명 계층이 실물로 증명됐다.** 07-03(렌더러 이메일 프리필/저장 비밀번호 로그인 버튼/D-06 삭제 버튼 이동/D-07 상태문)이 `getStoredCredentialsSnapshot()`/`loginWithStoredCredentials()` 위에 IPC 채널과 UI 를 배선할 수 있다.
- **IPC 채널/preload 브리지는 이 플랜의 범위 밖** — `auth:get-stored-credentials`/`auth:credential-login-stored`/`auth:clear-credentials` 신설은 07-03 이 담당한다(07-PATTERNS.md 가 이미 정확한 배치 지점을 확인해 뒀다).
- **blocker 없음.** `npm test` 398/398 green(기존 375 + 신규 23), `npm run typecheck`/`typecheck:main` 둘 다 exit 0, `grep -c "restoreTokenIfLost"` = 5(선언 1 + 호출 3 + 주석 언급 1), `grep -n loginWithStoredCredentials` 로 메인 게이트 존재 확인.

## Self-Check: PASSED

- `src/shared/mask.ts` 의 `export function maskEmail(` — FOUND
- `src/shared/types.ts` 의 `StoredCredentialsSnapshot` — FOUND
- `src/main/services/auth-service.ts` 의 `getStoredCredentialsSnapshot(`/`loginWithStoredCredentials(`/`credentialLoginInFlight`/`restoreTokenIfLost` — FOUND
- Commit `625e005` (Task 07-02-01) — FOUND in `git log --oneline --all`
- Commit `7c40001` (Task 07-02-02) — FOUND in `git log --oneline --all`
- Commit `44757a5` (Task 07-02-03) — FOUND in `git log --oneline --all`
- 모든 plan `<acceptance_criteria>` 재확인: pass (grep 확인 — maskEmail 순서/emailLen=/StoredCredentialsSnapshot 4리터럴/credentialLoginInFlight finally/restoreTokenIfLost 5회)
- Plan 레벨 `<verification>`: `npm test` 398/398 pass, `npm run typecheck` exit 0, `npm run typecheck:main` exit 0, `grep -rn loginWithStoredCredentials` 확인, tryAutoLogin() 기존 4케이스 계속 green

---
*Phase: 07-api*
*Completed: 2026-08-27*
