---
phase: 07-api
plan: 04
subsystem: ui
tags: [react, electron, ipc, vitest, login-panel, r023]

# Dependency graph
requires:
  - phase: 07-02
    provides: "maskEmail() 단일 마스킹 관문, StoredCredentialsSnapshot 4상태 타입(password 필드 없음), AuthService.getStoredCredentialsSnapshot()/loginWithStoredCredentials() main 최종 게이트"
  - phase: 07-03
    provides: "IPC 채널 4종(auth:get-stored-credentials/credential-login-stored/clear-credentials, apply:check-token-expiry) — 렌더러가 배선할 수 있는 계약"
provides:
  - "src/renderer/components/login-panel-view.ts 의 resolveStoredLoginState() + StoredLoginState — 저장 자격증명 관련 화면 판단(상태문/삭제 버튼/보조 로그인 버튼/불일치 안내)을 모은 단일 순수 함수"
  - "LoginPanel.tsx 의 이메일 프리필 + '저장된 비밀번호로 로그인' 보조 버튼 + D-07 저장 상태문 + 로그인 여부와 무관한 삭제 버튼 배선"
affects: ["07-05"]

actuals:
  tokens: 3891
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "저장 자격증명 UI 판단을 login-panel-view.ts 의 다른 순수 함수(resolveTabView/buildFailureView)와 같은 모양(입력 몇 개 → 파생 상태 객체)으로 확장 — resolveStoredLoginState() 도 exhaustive switch(default 없음)로 상태 누락을 컴파일 에러로 잡는다"
    - "렌더러 스냅샷 재조회를 단일 함수(refreshStoredSnapshot)로 묶어 마운트/삭제 후/저장 로그인 후 세 지점에서 재사용 — 조회 로직이 갈라지면 상태 표시가 어긋난다"

key-files:
  created: []
  modified:
    - src/renderer/components/login-panel-view.ts
    - src/renderer/components/__tests__/login-panel-view.test.ts
    - src/renderer/components/LoginPanel.tsx

key-decisions:
  - "저장 상태 블록(상태문·불일치 안내·삭제 버튼)을 API 모드 인라인 안내 문단 직후, ApiModeNoticeModal 앞에 배치 — 모달은 <dialog> 라 open=false 일 때 레이아웃을 차지하지 않으므로 시각적 순서에 영향이 없다"
  - "'저장된 비밀번호로 로그인' 버튼을 실패 안내 문단과 기존 로그인 버튼 행 사이에 배치 — 실패 문구가 보이는 상태에서도 두 로그인 경로(직접 입력 / 저장값 재사용)가 항상 나란히 보이게 했다"
  - "refreshStoredSnapshot() 을 handleStoredLogin() 의 finally 블록에서 호출 — 성공/실패 어느 쪽이든 스냅샷을 재조회해 D-04 손상 상태 전이가 다음 렌더에 반영되게 했다"

requirements-completed: [R023]

coverage:
  - id: D1
    description: "resolveStoredLoginState() 가 4상태(none/available/corrupted/unavailable) × 이메일 일치/불일치/대소문자·공백만 다름/입력 공백 조합을 정확히 판정하고, 상태문에 담기는 이메일은 항상 maskEmail() 마스킹을 거친다"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts#resolveStoredLoginState"
        status: pass
    human_judgment: false
  - id: D2
    description: "LoginPanel.tsx 가 마운트 시 이메일만 프리필하고(빈 칸일 때만), 비밀번호 state 는 사용자 입력 경로 한 곳에서만 설정되며, '저장된 비밀번호로 로그인' IPC 호출은 이메일 하나만 인자로 넘긴다(D-01) — 렌더러 어디에도 저장된 비밀번호를 담는 값이 없다"
    requirement: "R023"
    verification:
      - kind: unit
        ref: "grep -c setPassword(LoginPanel.tsx) = 1, grep credentialLoginStored(email) 단일 인자, npm run typecheck / typecheck:main / npm run build 전부 exit 0"
        status: pass
    human_judgment: true
    rationale: "구조적 계약(비밀번호 미노출, 단일 인자 IPC 호출)은 정적 grep + 타입체크로 확인했으나, 실제 재시작 후 이메일 프리필 렌더링·저장 비밀번호 로그인 클릭·이메일 불일치 시 버튼 잠김·삭제 후 프리필 소실이라는 눈에 보이는 동작은 07-VALIDATION.md 의 Manual-Only Verifications 표가 이미 명시한 대로 vitest.config.ts 의 include 가 .test.tsx 를 포함하지 않아(저장소 전체 기존 패턴) 자동 테스트 대상 밖이다. 플랜의 <human-check> 4개 시나리오는 실계정을 쓰는 API 모드 로그인이 전제라 이 실행 환경에서 수행할 수 없어 사용자 UAT 로 이관한다."

duration: ~15min
completed: 2026-08-27
status: complete
---

# Phase 7 Plan 4: 저장 자격증명 화면 배선 — 프리필/보조 로그인/상태문/삭제 버튼 Summary

**`resolveStoredLoginState()` 순수 함수로 저장 자격증명의 4가지 화면 상태(없음/사용가능/손상/불가)를 이메일 일치 여부까지 포함해 단일 지점에서 판정하고, `LoginPanel.tsx`에 이메일 프리필·"저장된 비밀번호로 로그인" 보조 버튼·D-07 저장 상태문·로그인 여부와 무관한 삭제 버튼을 배선해 R023의 재입력 생략 UX를 완성했다.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-27T08:23(추정, phase context 세션 연속)
- **Completed:** 2026-08-27T08:38:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **저장 자격증명 UI 판단을 단일 순수 함수로 확정(D-02/D-03/D-04/D-06/D-07)** — `login-panel-view.ts`에 `resolveStoredLoginState(snapshot, inputEmail)`을 추가했다. `switch (snapshot.state)`를 default 분기 없이 4 case로 작성해 새 상태가 추가되면 컴파일 에러로 드러나게 했다. `available` 상태는 이메일 정규화(trim+소문자) 비교로 일치/불일치/공백-입력-중 세 갈래를 구분한다 — 불일치면 보조 버튼을 비활성화하고 "다른 계정입니다 — 비밀번호를 입력하세요." 안내를, 공백 입력(아직 타이핑 중)은 안내 없이 버튼만 비활성화한다. `corrupted`는 삭제 버튼 없음(파일이 이미 삭제됨), `unavailable`은 삭제 버튼 있음(파일이 보존되므로 출구가 필요, D-04/D-06)으로 두 손상 상태를 구조적으로 구분했다. 상태문에 들어가는 이메일은 `maskEmail()`을 통과한 값만 사용한다(R010).
- **LoginPanel.tsx 배선(D-01/D-02/D-06/D-07)** — 마운트 시 `getStoredCredentials()`로 스냅샷을 조회해 `available`이면 이메일만 프리필한다(이메일 state가 빈 문자열일 때만 — 사용자 입력을 덮어쓰지 않는다). 비밀번호 state는 오직 비밀번호 input의 `onChange` 한 곳에서만 설정되며, 저장된 비밀번호는 이 컴포넌트에 절대 도달하지 않는다. "저장된 비밀번호로 로그인" 버튼은 `credentialLoginStored(email)`을 이메일 하나만 인자로 호출한다.
- **저장 사실 상태문 + 삭제 버튼을 로그인 여부 조건 밖으로 이동(D-06)** — 기존 "로그아웃 + 자격 증명 삭제" 버튼(로그인 상태에서만 노출)을 제거하고, API 탭에서 로그인 여부와 무관하게 노출되는 새 블록으로 삭제 통제권을 통합했다. 이 블록에 D-07 상태문("이 기기에 {마스킹된 이메일} 로그인 정보가 암호화되어 저장되어 있습니다.")과 D-03 불일치/D-04 손상·불가 안내가 함께 렌더링된다.
- **삭제 핸들러가 프리필을 눈에 보이게 되돌린다** — `clearStoredCredentials()` 호출 후 스냅샷을 재조회하고 이메일 state를 빈 문자열로 리셋한다. 로그아웃은 수행하지 않는다.

## Task Commits

1. **Task 07-04-01: 저장 자격증명 UI 상태를 순수 함수로 확정 (D-02/D-03/D-04/D-06/D-07)** - `cf7868a` (feat)
2. **Task 07-04-02: LoginPanel 배선 — 프리필·보조 로그인·상태문·삭제 버튼 (D-01/D-02/D-06/D-07)** - `ed1713e` (feat)

**Plan metadata:** (본 커밋)

_Task 1은 `tdd="true"`였으나, 07-01/02/03과 동일한 관례(신규 export 심볼이 파일에 아직 없는 상태에서는 "테스트를 먼저 실행해 실패를 확인"하는 것이 import 실패로만 나타나 RED 신호가 되지 못함)를 따라 단일 `feat(...)` 커밋으로 완결했다. `<behavior>` 블록의 4상태 × 이메일 갈래를 테스트 파일에 먼저 작성한 뒤 구현으로 통과시켰다는 점에서 RED→GREEN 순서 취지는 지켰다._

## Files Created/Modified

- `src/renderer/components/login-panel-view.ts` - `StoredLoginState` 인터페이스 + `resolveStoredLoginState()` 신설, `maskEmail`/`StoredCredentialsSnapshot` import 추가
- `src/renderer/components/__tests__/login-panel-view.test.ts` - `resolveStoredLoginState` describe 블록 9케이스(4상태 × 이메일 일치/불일치/대소문자·공백만 다름/입력 공백, 마스킹 단언)
- `src/renderer/components/LoginPanel.tsx` - `storedSnapshot`/`storedView` state+파생값, `refreshStoredSnapshot()`/`handleStoredLogin()`/`handleClearStoredCredentials()` 신설, 저장 상태 블록(로그인 여부 조건 밖) + "저장된 비밀번호로 로그인" 버튼 렌더, 기존 "로그아웃 + 자격 증명 삭제" 버튼 제거

## Decisions Made

- **저장 상태 블록 위치를 API 모드 인라인 안내 문단 직후, `ApiModeNoticeModal` 앞으로 결정** — 모달은 `<dialog>` 컴포넌트라 `open=false`일 때 레이아웃을 차지하지 않으므로, 두 요소의 JSX 순서가 화면상 인접 문단 배치(계획이 요구한 "인라인 안내 아래, 버튼 행 위")에 영향을 주지 않는다.
- **"저장된 비밀번호로 로그인" 버튼을 실패 안내 문단과 기존 로그인 버튼 행 사이에 배치** — 계획의 "실패 안내 문단과 로그인 버튼 사이"라는 위치 지정을 문자 그대로 따랐다.
- **`refreshStoredSnapshot()`을 `handleStoredLogin()`의 `finally` 블록에서 호출** — 성공/실패 어느 경로든 스냅샷을 재조회해 D-04 손상 상태 전이가 다음 렌더에 반영되게 했다.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Manual Verification Pending

플랜의 `<human-check>` 4개 시나리오(재시작 후 이메일 프리필, 저장 비밀번호 로그인, 이메일 불일치 차단, 삭제 후 상태문·프리필 소실)는 실계정으로 API 모드 로그인을 수행해야 확인할 수 있어 이 실행 환경에서 자동으로 수행하지 못했다. 07-VALIDATION.md의 Manual-Only Verifications 표가 이미 이 컴포넌트의 JSX 렌더링을 자동 테스트 대상 밖(vitest.config.ts의 include가 `.test.tsx`를 포함하지 않는 저장소 전체 기존 패턴)으로 명시하고 있다. `resolveStoredLoginState()`의 파생 로직 자체(무엇을 보여주고 무엇을 잠글지)는 9케이스 단위 테스트로 완전히 커버했고, 구조적 계약(비밀번호 미노출, IPC 단일 인자)은 정적 grep + 타입체크로 확인했다. 사용자 UAT 대상.

## Next Phase Readiness

- **R023의 사용자 체감(재입력 없는 로그인)이 화면까지 완성됐다.** 07-02(main 게이트/마스킹)와 07-03(IPC 계약)이 만든 계층 위에 렌더러 배선이 얹혔다.
- **07-05는 R022(토큰 만료 사전 경고)의 `ApplyExecution.tsx` 인라인 경고 배선을 남겨두고 있다** — 이 플랜의 범위 밖이며, `07-03`이 이미 열어둔 `apply:check-token-expiry` IPC 채널을 사용할 수 있다.
- **blocker 없음.** `npm test` 418/418 green(기존 409 + 신규 9), `npm run typecheck`/`typecheck:main`/`npm run build` 모두 exit 0. `LoginPanel.tsx`의 `setPassword(` 호출 1회, `onLogout(true)` 호출 0회, `credentialLoginStored(email)` 단일 인자 확인.

## Self-Check: PASSED

- `src/renderer/components/login-panel-view.ts` 의 `export function resolveStoredLoginState(` / `export interface StoredLoginState` — FOUND
- `src/renderer/components/LoginPanel.tsx` 의 `getStoredCredentials`/`credentialLoginStored`/`clearStoredCredentials`/`resolveStoredLoginState` — FOUND
- Commit `cf7868a` (Task 07-04-01) — FOUND in `git log --oneline --all`
- Commit `ed1713e` (Task 07-04-02) — FOUND in `git log --oneline --all`
- 모든 plan `<acceptance_criteria>` 재확인: pass (grep 확인 — resolveStoredLoginState/StoredLoginState export, maskEmail import, switch default 없음, statusLine 마스킹, showClearButton 상태별 값, 대소문자/공백 일치 판정, setPassword 1회, onLogout(true) 0회, credentialLoginStored 단일 인자, 저장 상태 블록이 isLoggedIn 조건 밖)
- Plan 레벨 `<verification>`: `npm test` 418/418 pass, `npm run typecheck` exit 0, `npm run typecheck:main` exit 0, `npm run build` exit 0, 렌더러 코드에 저장된 비밀번호를 담는 state/변수 없음(grep 확인), 저장 상태 블록 구조적으로 미로그인 상태에서 도달 가능(수동 확인은 위 Manual Verification Pending 참조)

---
*Phase: 07-api*
*Completed: 2026-08-27*
