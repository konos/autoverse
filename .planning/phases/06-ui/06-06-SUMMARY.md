---
phase: 06-ui
plan: 06
subsystem: ui
tags: [react, native-dialog, tdd, korean-copy, ipc, login-mode]

# Dependency graph
requires:
  - phase: 06-ui (06-01, 06-02, 06-05)
    provides: "06-01의 settings:* IPC 4채널 + shouldShowApiModeNotice()/API_MODE_NOTICE_VERSION, 06-02의 LoginFailureReason/mapLoginFailure() 어휘, 06-05의 CredentialLoginResult.reason/identifier 배선(캡차 오진 수정 완료 상태)"
provides:
  - "ApiModeNoticeModal.tsx — 네이티브 <dialog>.showModal() 기반 차단형 고지 모달. 확인/취소가 완전히 분리된 경로이며 좁은 창에서도 확인 버튼에 도달 가능"
  - "login-panel-view.ts — LoginPanel의 판단 로직 5개 순수 함수(resolveTabView/describeLockedMode/shouldShowInlineNotice/decideTabClick/buildFailureView), 21개 테스트로 전수 검증"
  - "LoginPanel — 환경변수 잠금 배지, API 모드 상시 안내 배너, 실패 사유별 한국어 안내(식별자 칩 + 브라우저 전환 버튼)를 갖춘 완성된 선택기"
  - "App.tsx — noticeAck 상태 로드 + handleAckNotice(IPC 실패를 그대로 전파해 LoginPanel의 catch가 모달을 열어둔 채 오류를 표시하게 함)"
affects: [06-07]

# Actuals (#2632)
actuals:
  tokens: 7049
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "네이티브 <dialog> 모달 — 이 저장소 최초의 모달 컴포넌트. .showModal()로 포커스 트랩/backdrop/inert를 브라우저에 위임하고, 확인 경로와 Esc/취소 경로를 prop 레벨에서 물리적으로 분리(onAcknowledge vs onCancel)"
    - "판단 전용 순수 모듈을 실제 import로 테스트 — 기존 profile-form-validation.test.ts의 '복제본을 테스트 파일에 두는' 관례에서 의도적으로 벗어나, login-panel-view.ts를 컴포넌트와 테스트 양쪽이 그대로 import하는 단일 진실 공급원으로 삼음"
    - "TDD RED를 파일 전체 교체가 아니라 스텁 치환으로 수행 — 신규 파일이라도 '구현을 임시로 throw 스텁으로 교체 → 테스트 작성 → 실패 확인 → 원복' 절차를 거쳐 형식적 RED가 아니라 실제로 실패하는 RED 커밋을 만듦"

key-files:
  created:
    - src/renderer/components/ApiModeNoticeModal.tsx
    - src/renderer/components/login-panel-view.ts
    - src/renderer/components/__tests__/login-panel-view.test.ts
  modified:
    - src/renderer/components/LoginPanel.tsx
    - src/renderer/App.tsx
    - src/renderer/styles.css
    - .planning/phases/06-ui/06-VALIDATION.md

key-decisions:
  - "IPC 레벨 예외(자격증명 로그인 catch 블록)를 원문 예외 메시지 노출 대신 network-error 사유의 고정 안내문으로 라우팅 — D-12 매핑표가 '예외 → 네트워크/런타임 오류 → D-14 폴백'을 이미 지정했고, 원문 노출은 6개 확정 문구 계약(R020)을 우회하는 셈이라 Rule 1(버그 수정)로 처리"
  - "buildFailureView()는 result.message(이미 main이 매핑·마스킹한 값)를 우선 사용하고 mapLoginFailure()는 오직 suggestBrowserSwitch 파생에만 쓴다 — 문구를 렌더러에서 되파싱하지 않는다는 계약(플랜 명시)을 그대로 지킴"
  - "identifier가 없는 실패 사유는 반환 객체에 그 필드 자체를 담지 않는다(옵셔널 프로퍼티 생략, undefined 대입이 아님) — '(식별자: undefined)'가 화면에 찍히는 사고를 타입 레벨이 아니라 객체 형태 레벨에서 차단"

patterns-established:
  - "login-panel-view.ts: LoginPanel의 판단 로직 전부(탭 상태·잠금 문구·상시 안내·클릭 판별·실패 뷰)를 한 파일에 순수 함수로 모으고 컴포넌트는 오직 그 반환값만으로 분기 — 이후 LoginPanel에 판단 로직을 새로 추가할 때 이 파일에 함수를 더하는 형태를 재사용"

requirements-completed: []  # R016/R020/R021 은 03/04/05/06/07 형제 플랜들이 공유 선언 — gsd-tools requirements ready-ids 확인 결과 0/3 ready (06-07 미완료로 보류)

coverage:
  - id: D1
    description: "최초 API 모드 선택은 차단형 고지 확인 없이는 진행되지 않는다 — 확인 버튼만이 ack-notice 다음 set-login-mode 순서로 두 IPC를 호출하고, 취소/Esc는 어느 쪽도 호출하지 않는다 (R021, D-09)"
    requirement: "R021"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts#decideTabClick (ackedVersion null/구버전 -> notice, 현재버전 -> save 5건)"
        status: pass
      - kind: other
        ref: "grep -c \"showModal()\" ApiModeNoticeModal.tsx == 1, grep -c \"\\.show()\" == 0, onCancel과 onAcknowledge가 서로 다른 IPC 조합을 호출하는 코드 경로 분리(handleAcknowledge vs handleCancelNotice)"
        status: pass
    human_judgment: true
    rationale: "결정 함수(decideTabClick)와 모달의 포커스 트랩/취소 분리는 단위 테스트와 grep으로 증명되지만, 실제 Electron 창에서 탭 클릭 -> 모달 표시 -> 취소 -> 탭 원복, 확인 -> 재시작 -> 재노출 안 됨의 전체 흐름은 이 실행 환경에 Electron 런타임이 없어 자동화하지 못했다. 06-01/06-05가 동일한 사유로 tracer 체크포인트에서 사용자 확인을 거친 전례를 따른다."
  - id: D2
    description: "환경변수 잠금 상태가 배지·상세 문구·탭 비활성 셋 다 같은 값(lockedByEnv)에서 파생되고, 미설정 시 배지는 아예 렌더링되지 않는다 — 환경변수 원문 값은 어디에도 노출되지 않는다 (D-06, UI-SPEC E2)"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts#resolveTabView / describeLockedMode (5건)"
        status: pass
      - kind: other
        ref: "grep -c \"process.env\" LoginPanel.tsx == 0, grep -c \"환경변수로 고정됨\" LoginPanel.tsx == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "API 모드가 활성인 동안 상시 안내 배너가 로그인 상태와 무관하게 노출되고, 닫기 버튼이 없다 (D-09 후반부)"
    requirement: "R021"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts#shouldShowInlineNotice (2건)"
        status: pass
      - kind: other
        ref: "grep -c \"API 로그인은 Weverse 보안 확인\" LoginPanel.tsx == 1, 배너 JSX가 status.isLoggedIn 조건문 밖에 위치"
        status: pass
    human_judgment: false
  - id: D4
    description: "여섯 가지 실패 사유 전부가 하나의 기존 오류 슬롯(role=alert)에서 정확한 한국어 문장으로 표시되고, 식별자 칩과 전환 버튼은 사유에 맞을 때만 나타난다 — 새 표시 영역이나 두 번째 모달이 생기지 않는다 (R020, D-15)"
    requirement: "R020"
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts#buildFailureView (7건: captcha/form-error/network-error/unknown/success/null/연속호출-누적없음)"
        status: pass
      - kind: other
        ref: "grep -c 'role=\"alert\"' LoginPanel.tsx <= 2 (기존 top-level 오류 슬롯 + 재사용 슬롯, 새 영역 없음), grep -c \"maskSensitive\" LoginPanel.tsx == 0 (마스킹은 main 책임)"
        status: pass
    human_judgment: false
  - id: D5
    description: "고지 확인 저장이 실패하면 모달이 닫히지 않고 모드도 바뀌지 않으며, 좁은 창에서도 확인 버튼에 도달할 수 있다 (UI-SPEC E3 error/overflow)"
    requirement: "R021"
    verification:
      - kind: other
        ref: "handleAcknowledge의 try/catch — onAckNotice 실패 시 catch로 진입해 setNoticeOpen(false)에 도달하지 못함(코드 경로 검사); .notice-modal-body가 max-height:50vh + overflow-y:auto, .notice-modal .button-row가 그 래퍼 밖 형제 요소로 배치됨(styles.css)"
        status: pass
    human_judgment: true
    rationale: "실제 창 크기를 최소로 줄여 확인 버튼이 화면에 남는지, 저장 실패 시 실제로 모달이 열린 채 오류 문구가 보이는지는 Electron 런타임이 필요한 시각적 검증이라 이 환경에서 자동화하지 못했다. 구조적으로는 스크롤 래퍼와 버튼 행이 분리돼 있어 어떤 창 높이에서도 버튼이 스크롤 영역 밖에 남는다."
  - id: D6
    description: "전체 회귀 없음 — 이 플랜이 시작한 시점 대비 전체 vitest 스위트, 두 typecheck(renderer/main), build가 그대로 통과"
    verification:
      - kind: unit
        ref: "npm test — 16 files, 315 tests (플랜 시작 시점 294개 대비 +21, login-panel-view.test.ts 신규분)"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run typecheck:main && npm run build — 전부 0 에러, git diff --stat package.json 공백, --color-* 토큰 11개(변경 전과 동일)"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 06: 로그인 방식 선택 UI + 실패 안내 Summary

**최초 API 모드 선택 시 뜨는 차단형 고지 모달을 네이티브 `<dialog>`로 신설하고, 환경변수 잠금 배지·API 모드 상시 안내·6개 실패 사유 한국어 안내를 모두 순수 판단 함수(`login-panel-view.ts`) 기반으로 `LoginPanel`에 배선했다 — 판단 로직 21개 테스트 전수 통과.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-26T05:36:29Z
- **Completed:** 2026-08-26T05:47:40Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (신규 3, 수정 4)

## Accomplishments

- **Task 1 (D-08/D-09, E3):** `ApiModeNoticeModal.tsx` 신규 작성 — 이 저장소 최초의 모달 컴포넌트. 네이티브 `<dialog>.showModal()`로 포커스 트랩·backdrop·inert 배경을 브라우저에 위임했다. 본문 2문장은 `max-height: 50vh; overflow-y: auto`인 스크롤 래퍼 안에, 확인/취소 버튼 행은 그 래퍼 **밖**에 배치해 창을 아무리 줄여도 확인 버튼에 도달할 수 있다. Esc 키는 `<dialog>`의 네이티브 `cancel` 이벤트로 들어와 취소 버튼과 동일한 `onCancel` prop으로 라우팅되며, 확인 경로(`onAcknowledge`)와 물리적으로 분리돼 있다. `styles.css`에 `dialog::backdrop`, 모달 컨테이너/본문/제목 클래스와 함께 Task 2가 쓸 잠금 배지·상시 안내 배너 클래스도 같은 커밋에서 정의했다(신규 `--color-*` 토큰 0개, `package.json` 변경 없음).
- **Task 2 (D-06/D-09/R021, TDD):** `login-panel-view.ts`에 `resolveTabView()`(탭 활성/비활성/배지 표시를 lockedByEnv 하나에서 함께 파생), `describeLockedMode()`(현재 적용 중인 모드 라벨만 끼워 넣고 환경변수 원문은 절대 노출하지 않음), `shouldShowInlineNotice()`, `decideTabClick()`(잠김 → 재클릭 → API 전환+미확인 → 그 외 전환 순으로 판별)을 순수 함수로 작성했다. `LoginPanel.tsx`는 탭 클릭을 `decideTabClick()`의 반환값만 보고 분기하도록 재작성됐고, 확인은 `settings:ack-notice`가 성공한 뒤에만 `settings:set-login-mode("api")`를 호출하는 순서를 강제한다(취소/Esc는 둘 다 호출하지 않음). `App.tsx`는 `noticeAck` 스냅샷을 마운트 시 로드하고 `handleAckNotice`가 IPC 실패를 그대로 전파해 `LoginPanel`의 catch가 모달을 열어둔 채 저장 실패 문구를 보여줄 수 있게 했다.
- **Task 3 (D-15/R020, TDD):** `buildFailureView()`를 추가해 자격증명 로그인 실패를 오류 슬롯 렌더링용으로 정리한다 — 문구는 main이 이미 매핑·마스킹한 `message`를 그대로 쓰고, `reason`은 오직 `mapLoginFailure()`에서 `suggestBrowserSwitch`만 뽑아내는 데 쓴다(문구 재파싱 없음). `identifier`가 없으면 반환 객체에 그 필드 자체가 없다(undefined 대입이 아니라 프로퍼티 생략) — 화면에 `(식별자: undefined)`가 찍히는 사고를 구조적으로 차단한다. `LoginPanel.tsx`의 기존 `credMessage` 문자열 상태를 `CredentialLoginResult`를 그대로 담는 `credResult`로 교체하고, 기존 `.error-message`/`role="alert"` 슬롯 하나만 갱신하도록 했다(파일 전체 `role="alert"` 개수는 여전히 2 — 최상단 인증 오류 슬롯 + 이 슬롯, 새 영역 미추가). "브라우저 로그인으로 전환" 버튼은 `showBrowserSwitch`가 true일 때만 나타나고 기존 `handleTabClick("browser")`를 재사용해 모달 없이 즉시 저장하며, 잠금 상태에서는 비활성화된다.

## Task Commits

각 태스크는 원자적으로 커밋되었다(Task 2·3은 `tdd="true"` — RED→GREEN 분리 커밋):

1. **Task 1: 차단형 고지 모달 컴포넌트 + 전용 스타일** - `f46631d` (feat)
2. **Task 2 RED: 탭 뷰/잠금 배지/클릭 판별 실패 테스트 작성** - `c5055e0` (test)
3. **Task 2 GREEN: 선택기 UI 완성 배선** - `d370bca` (feat)
4. **Task 3 RED: buildFailureView 실패 테스트 작성** - `7e5995b` (test)
5. **Task 3 GREEN: 실패 안내 렌더링 배선** - `d8e8493` (feat)

**Plan metadata:** (이 커밋 다음)

## Files Created/Modified

- `src/renderer/components/ApiModeNoticeModal.tsx` — 네이티브 dialog 기반 차단형 고지 모달 (신규)
- `src/renderer/components/login-panel-view.ts` — LoginPanel 판단 로직 5개 순수 함수 (신규)
- `src/renderer/components/__tests__/login-panel-view.test.ts` — 21개 테스트, 실제 모듈 import (신규)
- `src/renderer/components/LoginPanel.tsx` — 잠금 배지, 상시 안내, 모달 배선, 실패 뷰 렌더링
- `src/renderer/App.tsx` — noticeAck 상태 로드 + handleAckNotice
- `src/renderer/styles.css` — dialog::backdrop, 모달/배지/배너 클래스 (신규 `--color-*` 토큰 0개)
- `.planning/phases/06-ui/06-VALIDATION.md` — 06-06 검증 행 3개를 green으로 갱신

## Decisions Made

**1. IPC 레벨 예외를 network-error 사유로 라우팅.** `handleCredentialLogin`의 `catch` 블록이 기존에는 원문 JS 예외 메시지(`err.message`)를 그대로 노출했다. 이는 CONTEXT D-12 매핑표가 "예외 → 네트워크/런타임 오류 → D-14 폴백"으로 이미 지정한 경로이자, R020의 "6개 확정 한국어 문구" 계약을 우회하는 것이었으므로 Rule 1(버그 수정)로 `{ success: false, reason: "network-error" }`를 통해 `mapLoginFailure()`의 고정 안내문을 쓰도록 고쳤다.

**2. `buildFailureView()`는 문구를 재생성하지 않는다.** `result.message`(main이 이미 매핑·마스킹)를 우선 사용하고, `mapLoginFailure()`는 오직 `suggestBrowserSwitch` 파생에만 쓴다 — 플랜이 명시한 "렌더러가 문구를 다시 만들지 않는다" 계약을 그대로 지켰다.

**3. TDD RED를 "파일 임시 스텁 치환" 방식으로 수행.** `login-panel-view.ts`는 Task 2와 Task 3 둘 다 기존 파일에 함수를 추가하는 형태였으므로, 진짜 RED를 만들기 위해 (1) 완성된 구현을 스크래치패드에 백업 → (2) 새 함수를 throw하는 스텁 또는 `export {}`만 남긴 빈 파일로 교체 → (3) 테스트 작성 → (4) 실행해 실패 확인 → (5) `test(...)` 커밋 → (6) 백업본 복원 → (7) 재실행해 통과 확인 → (8) `feat(...)` 커밋 순서를 거쳤다. 형식적인 RED가 아니라 실제로 `TypeError: ... is not a function` / `Error: not implemented`로 실패하는 커밋을 남겼다.

## R021/동시성 가정 (planner_assumptions, 그대로 옮김)

플랜 프론트매터의 `planner_assumptions`가 명시한 가정은 이 실행에서도 유효하며, 코드 수준에서 재검증하지 않았다:

- 고지 확인 저장(`settings:ack-notice`)과 모드 저장(`settings:set-login-mode`)은 확인 버튼 클릭 한 번에서 **순차로** 일어난다. 앞의 것이 실패하면 뒤의 것을 실행하지 않는다 — 이 실행에서 `handleAcknowledge`가 정확히 이 순서로 `await`를 두 번 체이닝하고, 첫 `await`가 던지면 `catch`로 바로 빠져 두 번째 `await onSetLoginMode("api")`에 도달하지 않는 것으로 구현했다. 두 쓰기 사이에 프로세스가 죽는 극단적 경우에는 확인만 기록되고 모드는 이전 값으로 남는다(안전한 방향의 실패) — 이는 코드로 강제하지 않고 두 IPC 호출의 원자성 부재를 그대로 받아들인 것이다.
- 모달이 열려 있는 동안 사용자는 배경과 상호작용할 수 없다(네이티브 `<dialog>.showModal()`의 inert 처리). 따라서 모달 표시 중 탭이 다시 눌리는 경합은 발생하지 않는다.
- **확인/취소 두 경로의 부수효과 차이:** 확인(`handleAcknowledge`)은 `onAckNotice` → `onSetLoginMode("api")` 두 IPC를 순서대로 호출하고 성공 시에만 `noticeAck.ackedVersion`과 `loginMode` 상태를 갱신한다. 취소/Esc(`handleCancelNotice`)는 **어느 IPC도 호출하지 않는다** — 모달만 닫고 `noticeSaveError`를 초기화할 뿐, `loginMode`/`noticeAck` 상태 자체를 건드리지 않으므로 탭은 이전 선택으로 "저절로" 남는다(별도 되돌리기 로직 불필요, App.tsx의 편도 갱신 원칙과 동일).
- 이 가정이 틀리다면(예: 향후 비모달 표시로 전환) 확인 이전에 모드가 저장되는 창이 열린다. 그 시점에 두 쓰기를 하나의 원자적 설정 갱신으로 합칠 것.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] IPC 레벨 예외를 원문 노출 대신 network-error 고정 안내로 교체**
- **Found during:** Task 3 (`handleCredentialLogin`의 기존 catch 블록 검토)
- **Issue:** `window.api.auth.credentialLogin()` 호출 자체가 예외를 던지면(IPC 실패 등) 기존 코드가 `err.message`를 그대로 화면에 노출했다 — R020이 요구하는 "정확한 6개 한국어 안내" 계약 밖의 임의 텍스트가 사용자에게 보일 수 있었다.
- **Fix:** `catch` 블록에서 `{ success: false, reason: "network-error" }`를 `credResult`로 설정해 `buildFailureView()`가 `mapLoginFailure("network-error")`의 고정 문구("네트워크 오류로 로그인에 실패했습니다...")를 쓰도록 통일.
- **Files modified:** `src/renderer/components/LoginPanel.tsx`
- **Verification:** `npm run typecheck` 0 에러, 전체 vitest 315/315 통과 (기존 회귀 없음)
- **Committed in:** `d8e8493` (Task 3 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 1 — 이 플랜 Task 3의 범위(실패 안내 렌더링) 안에서 발견된, 계약(R020) 위반 소지가 있던 기존 예외 처리 경로 수정). 스코프 확장 없음.
**Impact on plan:** 정확성/일관성 개선. 새 기능 추가는 없음.

## Issues Encountered

None.

## User Setup Required

None - 외부 서비스 설정 변경 없음.

## Next Phase Readiness

- 06-07이 이 플랜과 동일한 R016/R020/R021을 공유 선언하고 있어, 세 요구사항 모두 아직 `Complete`로 전환되지 않았다(`gsd-tools requirements ready-ids` 확인: 0/3 ready). 06-07 완료 시 자동 전환된다.
- `LoginPanel`의 판단 로직 전부가 `login-panel-view.ts`의 순수 함수로 응집돼 있어, 06-07이 여기 함수를 확장하거나 재사용하기 쉬운 상태다.
- 이 실행 환경에는 Electron 런타임이 없어 "동작" 계열 검증(창 크기 축소 시 확인 버튼 도달, 실제 탭 클릭→모달→취소 흐름, 재시작 후 재노출 안 됨)은 코드 구조 검토와 단위 테스트로만 확인했다 — 06-07 또는 사용자 UAT에서 실제 Electron 세션으로 확인이 필요하다.
- 블로커 없음.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/renderer/components/ApiModeNoticeModal.tsx
- FOUND: src/renderer/components/login-panel-view.ts
- FOUND: src/renderer/components/__tests__/login-panel-view.test.ts
- FOUND commit: f46631d (feat, Task 1)
- FOUND commit: c5055e0 (test, Task 2 RED)
- FOUND commit: d370bca (feat, Task 2 GREEN)
- FOUND commit: 7e5995b (test, Task 3 RED)
- FOUND commit: d8e8493 (feat, Task 3 GREEN)
- Re-ran `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` → 21 passed
- Re-ran full suite `npm test` → 315 passed (16 files)
- Re-ran `npm run typecheck` → 0 errors
- Re-ran `npm run typecheck:main` → 0 errors
- Re-ran `npm run build` → passing
- 전체 acceptance_criteria (Task 1: 11개, Task 2: 9개, Task 3: 8개) → 전부 PASS (본문 검증 로그 기록)
- `git diff --stat package.json` → 공백 (신규 의존성 없음)
- `grep -c "^  --color-" src/renderer/styles.css` → 11 (변경 전과 동일, 신규 색 토큰 없음)

## TDD Gate Compliance

Task 2·3은 `tdd="true"` — 둘 다 RED→GREEN 게이트 확인됨(Task 1은 `type="auto"`, TDD 대상 아님):
- Task 2: RED(`c5055e0`, 실행 시 14개 중 실패 확인) → GREEN(`d370bca`, 14/14 통과)
- Task 3: RED(`7e5995b`, 신규 7건이 `Error: not implemented`로 실패, 기존 14건은 계속 통과) → GREEN(`d8e8493`, 21/21 통과)

두 태스크 모두 위 "Decisions Made #3"에 기록한 "임시 스텁 치환" 절차로 형식적 RED가 아니라 실제로 실패하는 커밋을 만들었다. RED/GREEN 게이트 위반 없음.
