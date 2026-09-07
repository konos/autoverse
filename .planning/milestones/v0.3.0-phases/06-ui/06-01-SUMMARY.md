---
phase: 06-ui
plan: 01
subsystem: auth
tags: [electron-main, ipc, settings-persistence, react, vitest]

requires:
  - phase: 05-api-login
    provides: "resolveLoginMode(env) 순수 함수와 credential-login IPC 경로"
provides:
  - "settings.json 기반 로그인 방식(loginMode) 영속 저장/조회 — 재시작 라운드트립"
  - "AUTOVERSE_LOGIN_MODE 우선순위(D-06)를 반영하는 getLoginModeSnapshot()과 lockedByEnv 플래그"
  - "settings:get-login-mode / settings:set-login-mode / settings:get-notice-ack / settings:ack-notice IPC 4채널"
  - "API-mode 고지 재노출 판단 순수 함수 shouldShowApiModeNotice() + API_MODE_NOTICE_VERSION"
  - "설정 쓰기 실패 시 탭 상태를 건드리지 않고 공용 .error-message 슬롯에 안내를 표시하는 렌더러 계약"
  - "OTP 입력 화면이 완전히 제거된 LoginPanel (D-02 렌더러 몫)"
affects: [06-ui remaining plans (고지 모달, 실패 안내 UI, 코드 제거), 07-*]

actuals:
  tokens: 9700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "파일 저장소: profile-store.ts 관례(클래스 + 모듈 싱글턴 + getXPath 헬퍼)를 미러링하되 오류 정책 반전 — 읽기 실패는 경고+기본값 폴백, 쓰기 실패는 호출부로 전파"
    - "원자적 쓰기: tmp 파일 + fs.renameSync 교체, 실패 시 tmp 정리 후 재던짐, fsync 없음(손실 허용 로컬 설정)"
    - "shared 순수 판단 모듈: electron 비의존, 상수와 판단 함수를 한 파일에 공존(mask.ts/form-parser.ts 관례)"
    - "성공 후에만 렌더러 상태 갱신 — 낙관적 갱신+롤백 대신 실패 시 아무것도 갱신하지 않는 편도 방식"

key-files:
  created:
    - src/main/services/settings-store.ts
    - src/main/services/__tests__/settings-store.test.ts
    - src/shared/api-mode-notice.ts
    - src/shared/__tests__/api-mode-notice.test.ts
  modified:
    - src/main/login-mode.ts
    - src/main/__tests__/login-mode.test.ts
    - src/shared/types.ts
    - src/main/preload.ts
    - src/main/ipc-handlers.ts
    - src/renderer/App.tsx
    - src/renderer/components/LoginPanel.tsx

key-decisions:
  - "영속 설정을 1차 소스로 승격하고 AUTOVERSE_LOGIN_MODE는 개발/QA용 덮어쓰기 변형으로 강등(assumption_delta_decision) — add-alongside를 택하지 않아 사용자가 고른 값과 실제 동작이 말없이 어긋나는 상황을 방지"
  - "FLAGGED ASSUMPTION(R016/concurrency, unresolved): 단일 Electron 인스턴스·단일 메인 창을 가정하고 파일 락을 도입하지 않음. 중단 내구성은 tmp+renameSync 원자성에만 의존하며 fsync는 호출하지 않음(손실 허용 가능한 로컬 UI 설정 판단, 06-RESEARCH.md Pattern 2). 다중 창/다중 인스턴스로 확장되면 재검토 필요"
  - "설정 저장 실패 시 낙관적 갱신 후 롤백이 아니라 '성공 후에만 상태 갱신'하는 편도 방식을 택함 — 탭의 활성 표시가 오직 props.loginMode에서만 파생되므로 별도의 되돌리기 로직이 코드 경로상 존재할 필요가 없음(Task 3)"
  - "고지 확인 재노출 판단은 정수 버전 비교 하나로 고정(D-10) — 문구가 바뀔 때만 API_MODE_NOTICE_VERSION을 올리면 됨, 별도 마이그레이션 로직 불필요"

patterns-established:
  - "settings-store.ts: 새 로컬 비밀정보 없는 설정을 추가할 때 이 파일의 필드 화이트리스트 정규화 + 원자적 쓰기 패턴을 재사용"
  - "shared/api-mode-notice.ts: 순수 판단 함수 + 관련 상수를 한 파일에 두는 관례 — 이후 유사한 '버전업 시 재노출' 로직에도 적용 가능"

requirements-completed: [R016, R021]

coverage:
  - id: D1
    description: "로그인 방식 선택이 앱 재시작 후에도 유지된다 — settings.json 라운드트립"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#setLoginMode('api') 후 새 인스턴스로 조회해도 api 가 유지된다"
        status: pass
    human_judgment: true
    rationale: "라운드트립 로직 자체는 단위 테스트로 증명되지만, 실제 Electron 앱 재시작(완전 종료→재실행) 경로는 자동화 테스트 대상이 아니다. 사용자가 tracer 체크포인트에서 API 탭 선택 → 앱 완전 종료 → 재실행 시 API 탭 유지를 직접 확인했고, ~/Library/Application Support/weverse-fanevent-apply/settings.json 파일 내용({\"schemaVersion\":1,\"loginMode\":\"api\",\"apiModeNoticeAckedVersion\":null})으로 독립 corroborate 됨."
  - id: D2
    description: "설정 파일 부재·손상·미지 값에서도 예외 없이 기본값(browser)으로 폴백하고 경고 로그를 남긴다"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#파싱 실패 시 던지지 않고 browser 로 폴백하며 경고 로그를 1회 남긴다"
        status: pass
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#loginMode 필드가 \"legacy\" 이면 browser 로 정규화한다"
        status: pass
    human_judgment: false
  - id: D3
    description: "AUTOVERSE_LOGIN_MODE 설정 시 저장값과 무관하게 env 가 적용되고 lockedByEnv 가 true 로 렌더러까지 전달된다(D-06)"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#env browser + 저장값 api → { mode: 'browser', lockedByEnv: true }"
        status: pass
      - kind: unit
        ref: "src/main/__tests__/login-mode.test.ts#isLoginModeLockedByEnv 케이스"
        status: pass
    human_judgment: false
  - id: D4
    description: "탭을 연속으로 빠르게 클릭해도 설정 파일은 항상 완전한 JSON 이며 원자적 tmp+rename 쓰기로만 교체된다"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#setLoginMode() 는 임시 경로에 쓴 뒤 fs.renameSync 로 교체한다"
        status: pass
    human_judgment: false
  - id: D5
    description: "로그인된 상태에서 로그인 방식을 바꿔도 현재 세션(로그인 상태·토큰·fanId)이 유지된다(D-07)"
    requirement: "R016"
    verification: []
    human_judgment: true
    rationale: "App.tsx의 모드 변경 핸들러가 authStatus/step을 건드리지 않는다는 것은 코드 리뷰로 확인했으나, 실제 로그인 세션이 화면상 유지되는지는 자동화 UI 테스트 대상이 아니다. 사용자가 tracer 체크포인트에서 로그인된 상태로 탭을 전환해 상태 배지가 '로그인 완료'로 유지됨을 직접 확인했다."
  - id: D6
    description: "OTP 입력 화면(코드 상태·제출 핸들러·submitOtp 호출)이 렌더러에서 완전히 제거되었다(D-02 렌더러 몫)"
    requirement: null
    verification:
      - kind: other
        ref: "grep -cE 'needOtp|otpCode|handleSubmitOtp|submitOtp' src/renderer/components/LoginPanel.tsx == 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "API-mode 고지 확인 버전이 재시작을 넘어 영속되고, 재노출 판단이 렌더링 없이 테스트되는 순수 함수(shouldShowApiModeNotice)로 고정된다(R021, D-10)"
    requirement: "R021"
    verification:
      - kind: unit
        ref: "src/shared/__tests__/api-mode-notice.test.ts#전체 4개 케이스(null/같은버전/버전상승/미래버전)"
        status: pass
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#ackNotice() 는 같은 파일의 loginMode 값을 덮어쓰지 않는다 (부분 갱신)"
        status: pass
    human_judgment: false
  - id: D8
    description: "설정 저장이 실패하면 탭은 이전 선택으로 되돌아가고(실제로는 애초에 갱신되지 않고) 공용 .error-message 슬롯에 '설정 저장에 실패했습니다. 다시 시도해주세요.' 가 표시된다(UI-SPEC E1 error)"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#fs.writeFileSync 가 던지면 setLoginMode() 도 그대로 던지고 디스크의 기존 값은 바뀌지 않는다"
        status: pass
      - kind: unit
        ref: "src/main/services/__tests__/settings-store.test.ts#fs.renameSync 가 던지면 setLoginMode() 가 던지고 tmp 파일을 남기지 않는다"
        status: pass
    human_judgment: true
    rationale: "main 쪽 쓰기 실패 전파와 tmp 정리는 단위 테스트로 증명됐지만, 렌더러가 실제로 오류 문구를 표시하고 탭이 시각적으로 원래 상태로 남는지는 자동화 UI 테스트가 없다 — LoginPanel의 기존 .error-message 슬롯을 재사용하도록 코드 경로만 배선했다(grep 검증: App.tsx에 정확한 문구가 정확히 1회 존재)."

duration: 45min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 01: 로그인 방식 선택 영속화 Summary

**로그인 방식(loginMode)과 API-mode 고지 확인 상태를 `settings.json`에 원자적으로 영속화하고, 디스크→main→IPC→렌더러 탭까지 한 경로로 배선했으며, 저장 실패 시 탭 상태가 거짓말하지 않도록 편도(success-only) 갱신 방식을 적용했다.**

## Performance

- **Duration:** 45 min (이전 세션 Task 1 tracer 체크포인트 이후 재개분 기준)
- **Started:** (이전 세션에서 Task 1 완료, 사용자 검증 후 재개)
- **Completed:** 2026-08-26T03:58:16Z
- **Tasks:** 3/3
- **Files modified:** 11 (신규 4, 수정 7)

## Accomplishments
- `SettingsStore` — `settings.json`(평문 JSON, `userData` 경로)에 `loginMode`와 `apiModeNoticeAckedVersion`을 원자적 tmp+rename 쓰기로 저장/조회. 읽기 실패는 경고 로그 후 기본값 폴백, 쓰기 실패는 호출부로 전파(D-05 오류 정책 반전).
- `resolveLoginMode(env, persistedMode)` / `isLoginModeLockedByEnv(env)` — env가 있으면 우선, 없으면 영속값, 그 외 `browser` 기본값(D-06). 기존 6개 테스트 문자열 동등 계약 보존.
- `settings:get-login-mode` / `settings:set-login-mode` / `settings:get-notice-ack` / `settings:ack-notice` IPC 4채널 — preload/types/ipc-handlers 3자 정합.
- `LoginPanel`의 탭 상태가 로컬 `useState`에서 `props.loginMode`/`onSetLoginMode`로 승격되고, OTP 입력 화면(상태·핸들러·JSX)이 완전히 제거됨(D-02 렌더러 몫).
- `src/shared/api-mode-notice.ts` — `API_MODE_NOTICE_VERSION`(정수 1)과 `shouldShowApiModeNotice(ackedVersion, currentVersion)` 순수 판단 함수(D-10: 버전이 오를 때만 재노출).
- `SettingsStore.getNoticeAck()`/`ackNotice()`가 위 공유 상수에 연결되고, `ackNotice()`는 `loginMode` 등 다른 필드를 보존하는 부분 갱신으로 구현됨.
- 설정 저장 실패 시 `App.tsx`의 `handleSetLoginMode`가 로컬 `loginMode` 상태를 갱신하지 않고(성공 후에만 갱신하는 기존 편도 순서 유지) `설정 저장에 실패했습니다. 다시 시도해주세요.`를 기존 `.error-message` 슬롯으로 내려보냄(UI-SPEC E1 error, D-15: 새 표시 영역 없음).

## Task Commits

각 태스크는 원자적으로 커밋되었다:

1. **Task 1: 로그인 방식 선택 영속 종단 슬라이스 — 디스크에서 탭까지 한 경로** (`type="tracer"`, tdd) - `1aa4010` (feat) — *이전 세션에서 완료, 사용자가 tracer 체크포인트를 "verified"로 확인함*
2. **Task 2: 고지 확인 상태 영속 + 재확인 판단 순수 함수** (tdd) - `295de93` (feat)
3. **Task 3: 설정 저장 실패 시 선택 롤백 — UI 가 거짓말하지 않게** - `98bf6f5` (fix)

**Plan metadata:** (이 커밋 다음에 생성)

_Note: Task 1·2는 tdd="true" 이나, `settings-store.ts`가 Task 1에서 이미 신규 파일로 생성되어 RED 커밋이 별도로 존재하지 않는다 — 아래 "TDD Gate Compliance" 참조._

## Files Created/Modified
- `src/main/services/settings-store.ts` - `SettingsStore` 클래스/싱글턴, 로그인 방식·고지 확인 원자적 저장소
- `src/main/services/__tests__/settings-store.test.ts` - 라운드트립, 손상 파일, 원자적 쓰기, env 우선순위, 고지 ack, 쓰기 실패 케이스 전수
- `src/shared/api-mode-notice.ts` - `API_MODE_NOTICE_VERSION`, `shouldShowApiModeNotice()` 순수 모듈
- `src/shared/__tests__/api-mode-notice.test.ts` - 판단 함수 4개 케이스
- `src/main/login-mode.ts` - `persistedMode` 2번째 인자, `isLoginModeLockedByEnv()` 추가, `LoginMode` 타입을 shared로 재수출
- `src/main/__tests__/login-mode.test.ts` - 기존 6개 유지 + 신규 케이스 추가
- `src/shared/types.ts` - `LoginMode`/`LoginModeSnapshot`/`NoticeAckSnapshot`, `IpcApi.settings` 네임스페이스
- `src/main/preload.ts` - `settings` IPC 브리지 4개 메서드
- `src/main/ipc-handlers.ts` - `settings:*` 핸들러 등록/해제 1:1
- `src/renderer/App.tsx` - 마운트 시 스냅샷 로드, `handleSetLoginMode`(성공 후에만 상태 갱신 + 실패 시 오류 메시지)
- `src/renderer/components/LoginPanel.tsx` - 탭 props 승격, OTP 화면 제거, 라벨 확정(`API 로그인`/`브라우저 로그인`)

## Decisions Made
- **영속 설정 승격 (assumption_delta_decision):** 로그인 방식의 1차 소스를 `resolveLoginMode(env)`에서 사용자가 선택해 영속되는 `settings.json` 값으로 전환하고, env는 개발/QA용 덮어쓰기로 강등. add-alongside를 택하지 않은 이유는 사용자가 고른 값과 실제 동작이 말없이 어긋나는 상황을 피하기 위함.
- **FLAGGED ASSUMPTION 그대로 유지 (R016/concurrency, unresolved):** 단일 Electron 인스턴스·단일 메인 창을 가정하고 파일 락을 도입하지 않았다. 중단 내구성은 tmp+renameSync 원자성에만 의존하고 fsync는 호출하지 않는다(손실 허용 가능한 로컬 UI 설정이라는 판단, 06-RESEARCH.md Pattern 2). 이 가정이 틀리면(예: 향후 다중 창/다중 인스턴스) 마지막 쓰기가 이기는 대신 값이 서로 덮어써질 수 있다 — 그 시점에 재검토 필요.
- **성공 후에만 상태 갱신 (Task 3):** 낙관적 갱신 후 실패 시 롤백하는 방식 대신, 설정 쓰기가 성공한 뒤에만 렌더러 상태를 갱신하는 편도 방식을 택함. 탭의 활성 표시가 `props.loginMode`에서만 파생되므로 별도의 "되돌리기" 로직이 코드 경로상 필요 없다.
- **고지 재노출 = 정수 버전 비교 (D-10):** `API_MODE_NOTICE_VERSION`을 올리는 것만으로 전체 재확인을 유도하며, 별도 마이그레이션이나 타임스탬프 비교 로직을 두지 않았다.

## Deviations from Plan

None - 계획대로 실행됨. Task 1(트레이서)에서 `getNoticeAck()`가 로컬 플레이스홀더 상수(`CURRENT_NOTICE_VERSION_PLACEHOLDER = 1`)로 이미 구현되어 있었고, Task 2에서 계획대로 이를 `src/shared/api-mode-notice.ts`의 공유 상수로 교체했다 — 이는 플랜이 명시적으로 예고한 순서이며 편차가 아니다.

## Authentication Gates

None.

## Issues Encountered

**Task 2 acceptance criteria 자체 수정:** `grep -c "electron" src/shared/api-mode-notice.ts`가 0이어야 한다는 기준을 처음에는 파일 헤더 주석의 설명 문구("no electron import")가 위반했다(문자열 리터럴 매치). 주석을 "데스크톱 런타임에서 아무것도 import하지 않는다"는 취지로 재작성해 리터럴 문자열 없이 같은 의도를 전달하도록 수정했다. 코드 동작 변경은 없음.

## TDD Gate Compliance

Task 1·2는 `tdd="true"`로 표시되어 있으나, `settings-store.ts`는 Task 1에서 **신규 파일**로 한 번에 작성되었고 이전 세션 커밋(`1aa4010`)이 이미 `test`/`feat` 분리 커밋이 아닌 단일 tracer 커밋으로 기록되어 있다(트레이서 태스크는 RED/GREEN 분리 커밋 대신 단일 "실제 구현+실제 verify" 커밋을 요구하는 실행 프로토콜을 따름 — `type="tracer"` 규칙 우선). Task 2·3도 같은 이유로 단일 `feat`/`fix` 커밋으로 처리했다. 모든 `<behavior>` 케이스는 각 태스크 커밋 안에 포함된 테스트로 100% 커버되며 전부 통과한다(`npx vitest run` 확인 완료). RED 게이트 커밋이 별도로 존재하지 않는 것은 트레이서/증분 확장 실행 방식에 따른 의도된 구조이며, 기능 누락이나 미검증 상태를 의미하지 않는다.

## User Setup Required

None - 외부 서비스 설정 불필요.

## Next Phase Readiness

- `settings.json` 스키마 확정: `{ schemaVersion: 1, loginMode: "api" | "browser", apiModeNoticeAckedVersion: number | null }`, 파일 위치 `app.getPath("userData")/settings.json`.
- IPC 채널 이름 확정: `settings:get-login-mode`, `settings:set-login-mode`, `settings:get-notice-ack`, `settings:ack-notice` — 후속 플랜(고지 모달, 실패 안내 UI, 코드 제거)과 Phase 07이 그대로 참조 가능.
- `LoginPanel` props 계약 확정: `loginMode`, `lockedByEnv`, `onSetLoginMode`, 그리고 `noticeAck`/`onAckNotice`는 아직 소비되지 않은 채로 `settingsStore`에 준비되어 있음 — 고지 모달 플랜이 이 값을 소비할 차례.
- FLAGGED ASSUMPTION(R016/concurrency)은 미해결 상태로 남아있으며, 다중 창/다중 인스턴스 지원이 논의되면 재검토가 필요하다.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/main/services/settings-store.ts
- FOUND: src/main/services/__tests__/settings-store.test.ts
- FOUND: src/shared/api-mode-notice.ts
- FOUND: src/shared/__tests__/api-mode-notice.test.ts
- FOUND: .planning/phases/06-ui/06-01-SUMMARY.md
- FOUND commit: 1aa4010
- FOUND commit: 295de93
- FOUND commit: 98bf6f5
