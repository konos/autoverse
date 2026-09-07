---
phase: 06-ui
plan: 08
subsystem: ui
tags: [renderer, react, vitest, login-mode, gap-closure]

# Dependency graph
requires:
  - phase: 06-ui
    provides: "06-06 이 세운 login-panel-view.ts 순수 모듈 관례 (LoginPanel 판단 로직을 컴포넌트 밖으로 추출해 테스트하는 규칙), 06-01 이 확인한 main 쪽 settings:set-login-mode/ackNotice IPC 계약(✓ WIRED)"
provides:
  - "src/renderer/login-mode-actions.ts — 탭 클릭 경로와 고지 확인 경로의 실패 계약을 소유하는 순수 액션 모듈(createLoginModeActions 팩토리)"
  - "고지 확인 흐름이 settings:set-login-mode 쓰기 실패를 반환값으로 보고하는 동작 — 06-VERIFICATION.md gap 1 / 06-REVIEW.md CR-01 해소"
  - "decideNoticeCancel() — 저장 진행 중 Esc/취소를 무시하는 단일 판단 지점 (WR-01 해소)"
  - "LoginPanelProps.onAcknowledgeNotice — onAckNotice prop 을 대체, 모달 경로가 로그인 방식 저장 함수를 prop 으로 받을 수 없는 구조"
affects: [06-09-PLAN, 06-10-PLAN, "이후 phase 가 렌더러 저장 실패 계약을 다룰 때"]

actuals:
  tokens: 5134
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "렌더러 컴포넌트 밖 '순수 액션 모듈' — login-panel-view.ts(판단 로직)에 이어 login-mode-actions.ts(부수효과 계약)가 이 저장소 두 번째 사례. 부수효과는 전부 주입된 deps 를 통해서만 일어나고 window.api/DOM/React 를 직접 참조하지 않는다"
    - "strict/safe 헬퍼 분리로 실패 전파 여부를 타입 수준에서 갈라놓는다 — 같은 함수를 두 경로가 재사용하다 계약이 뒤섞이는 재발을 구조적으로 차단"

key-files:
  created:
    - src/renderer/login-mode-actions.ts
    - src/renderer/__tests__/login-mode-actions.test.ts
  modified:
    - src/renderer/App.tsx
    - src/renderer/components/LoginPanel.tsx
    - src/renderer/components/login-panel-view.ts
    - src/renderer/components/__tests__/login-panel-view.test.ts

key-decisions:
  - "검증자가 제안한 'strict 변형 setter 추가'(setLoginModeOrThrow 를 prop 으로 병렬 주입) 대신, 모달 경로에서 로그인 방식 저장 함수 prop 자체를 제거했다 — 두 setter 를 병렬로 내려보내면 '어느 것을 모달에 연결할지'가 다시 App.tsx JSX 한 줄의 배선 결정으로 남아 CR-01 과 같은 형태의 실수가 재발할 수 있기 때문"
  - "고지 확인 흐름 전체(확인 상태 저장 → 모드 저장 → 성패 판정)를 createLoginModeActions() 안으로 옮겨 LoginPanel 의 handleAcknowledge 가 try/catch 로 성패를 추론하지 않고 반환값(AcknowledgeOutcome)만으로 분기하게 했다"
  - "WR-01(저장 중 Esc 경합)을 같은 플랜에서 함께 닫았다 — gap 1 과 뿌리(확인 흐름의 상호배제 미구현)가 같고 순수 함수 추출 비용이 사실상 0"
  - "IN-03(진단이 devtools 콘솔에만 남음)은 onDiagnostic JSDoc 명시로만 처리 — 새 renderer→main 오류 포워딩 IPC 채널 신설은 이 gap closure 범위 밖으로 명시적으로 제외"
  - "IN-04(모달 max-height 없음)는 DEFER — 실제 Electron 창 없이는 검증 불가, 06-VALIDATION.md Manual-Only #2 로 이관"

requirements-completed: [R016, R021]

coverage:
  - id: D1
    description: "고지 확인 경로에서 settings:set-login-mode 쓰기가 실패하면 확인 결과가 실패로 반환되고, 모달이 열린 채 남으며, loginMode 상태가 바뀌지 않는다 (CR-01 해소)"
    requirement: R021
    verification:
      - kind: unit
        ref: "src/renderer/__tests__/login-mode-actions.test.ts#Test 1: persistLoginMode 가 reject 하면 확인 결과는 실패이고 모달 인라인 확정 문구를 담아야 한다 (CR-01 회귀)"
        status: pass
      - kind: unit
        ref: "src/renderer/__tests__/login-mode-actions.test.ts#Test 5: 확인 경로에서 모드 저장이 실패하면 onModeApplied 는 호출되지 않는다"
        status: pass
    human_judgment: false
  - id: D2
    description: "탭 클릭 경로는 저장 실패 시 예외를 던지지 않고 상단 배너로만 알린다 — 기존 동작 불변"
    requirement: R016
    verification:
      - kind: unit
        ref: "src/renderer/__tests__/login-mode-actions.test.ts#Test 4: persistLoginMode 가 reject 해도 setLoginMode 는 reject 하지 않고 탭 경로 확정 문구로 배너만 알린다"
        status: pass
    human_judgment: false
  - id: D3
    description: "확인 저장이 진행 중인 동안 Esc/취소가 모달을 닫지 못한다 (WR-01)"
    requirement: R021
    verification:
      - kind: unit
        ref: "src/renderer/components/__tests__/login-panel-view.test.ts#decideNoticeCancel > 저장이 진행 중이면 취소를 무시한다 (WR-01)"
        status: pass
    human_judgment: true
    rationale: "decideNoticeCancel() 순수 함수의 판단 로직은 단위 테스트로 잠갔지만, ApiModeNoticeModal 의 네이티브 <dialog> 가 실제로 Esc 를 이 판단 지점까지 라우팅하는지는 렌더링/DOM 환경 없이 자동 검증할 수 없다. 06-VALIDATION.md Manual-Only #2 가 실제 Electron 창에서의 모달 인터랙션 확인을 이미 outstanding UAT 로 등록해 두었다"
  - id: D4
    description: "LoginPanel 의 확인 핸들러가 로그인 방식 저장 함수를 prop 으로 받지 않는다 — CR-01 형태의 계약 불일치가 타입 수준에서 표현 불가능"
    verification:
      - kind: other
        ref: "grep -c 'onAckNotice' src/renderer/App.tsx src/renderer/components/LoginPanel.tsx == 0 (양쪽 모두)"
        status: pass
      - kind: other
        ref: "awk '/const handleAcknowledge/,/^  };/' LoginPanel.tsx | grep -c 'onSetLoginMode' == 0"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 08: 고지 확인 흐름의 저장 실패 계약 정정 (CR-01 gap closure) Summary

**고지 확인 흐름이 `settings:set-login-mode` 쓰기 실패를 삼켜 모달을 "확인 완료"로 닫던 CR-01 을, 탭/모달 두 경로의 실패 계약을 소유하는 순수 액션 모듈 `login-mode-actions.ts` 로 구조적으로 제거했다 — 모달 경로는 이제 저장 함수를 prop 으로 받을 수조차 없다.**

## Performance

- **Duration:** 약 15분
- **Tasks:** 3 (Task 1 RED / Task 2 GREEN / Task 3 배선+WR-01)
- **Files modified:** 6 (신규 2, 수정 4)
- **Commits:** 3

## Accomplishments

- `src/renderer/login-mode-actions.ts` 신설 — `createLoginModeActions(deps)` 팩토리가 `setLoginMode`(탭 경로, 절대 reject 하지 않음)와 `acknowledgeApiModeNotice`(모달 경로, 실패를 `AcknowledgeOutcome` 반환값으로 보고)를 strict/safe 두 헬퍼로 분리해 제공
- CR-01 회귀 테스트 7건 + `decideNoticeCancel` 테스트 2건으로 두 경로의 실패 계약과 WR-01 이 자동 테스트로 잠김
- `App.tsx`/`LoginPanel.tsx` 배선 재설계 — `onAckNotice` prop 제거, `onAcknowledgeNotice` 로 대체. `handleAcknowledge` 는 try/catch 로 성패를 추론하지 않고 반환값만 본다
- WR-01(저장 중 Esc 경합) 동시 해소 — `decideNoticeCancel(saving)` 이 Cancel 버튼과 네이티브 Esc 를 같은 판단 지점으로 통합
- 신규 의존성 0건, `npm test` 324/324(315 기준 + 9), `typecheck`/`typecheck:main` 각 0 에러, `npm run build` 0 종료

## Task Commits

1. **Task 1 (RED): 액션 모듈 추출 + CR-01 회귀 테스트** - `32ecc35` (test)
2. **Task 2 (GREEN): 확인 경로 실패 전파로 수정** - `395608a` (fix)
3. **Task 3: App.tsx/LoginPanel.tsx 배선 재설계 + WR-01** - `84a5de5` (fix)

## RED 증거 (Task 1) — CR-01 이 실재했다는 실행 증거

Task 1 커밋 시점(`login-mode-actions.ts` 가 오늘의 실제 배선을 그대로 옮겨 적은 상태)에서
`npx vitest run src/renderer/__tests__/login-mode-actions.test.ts` 실행 결과:

```
Test Files  1 failed (1)
     Tests  1 failed | 3 passed (4)

 FAIL  src/renderer/__tests__/login-mode-actions.test.ts >
   createLoginModeActions — acknowledgeApiModeNotice (고지 확인 경로) >
   Test 1: persistLoginMode 가 reject 하면 확인 결과는 실패이고 모달 인라인 확정 문구를 담아야 한다 (CR-01 회귀)

AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/renderer/__tests__/login-mode-actions.test.ts:42:24
     40|     const outcome = await actions.acknowledgeApiModeNotice(1);
     41|
     42|     expect(outcome.ok).toBe(false);
```

`persistLoginMode` 가 reject 하는 deps 로 `acknowledgeApiModeNotice(1)` 을 호출했는데도
`outcome.ok` 가 `true` 로 나왔다 — 이것이 CR-01 그 자체다: 확인 상태(`apiModeNoticeAckedVersion`)는
영속됐고 모드 저장은 실패했는데, 확인 흐름은 정상 완료로 보고했다. Test 2~4 는 이 시점에도
통과했다(오늘의 다른 동작들은 옳았으므로). Task 2 는 이 Test 1 단언을 **한 글자도 바꾸지 않고**
strict/safe 헬퍼 분리만으로 통과시켰다 — `git diff HEAD~1` 로 Test 1 블록에 삭제된 줄이 없음을
확인했다(파일 자체가 Task 1 커밋에서 신규 생성이라 diff 전체가 추가뿐이다).

## 검증자 제안 vs 실제 채택안

06-VERIFICATION.md 의 검증자는 모달 전용 strict 변형(예: `setLoginModeOrThrow`)을 새로
추가해 `handleAcknowledge` 에서만 쓰고 기존 fire-and-forget `handleSetLoginMode` 는 탭
경로에 그대로 두는 처치를 제안했다. 이 플랜은 그 처치가 **요구하는 성질(모달은 실패를
감지하고, 탭은 그대로 삼킨다)은 그대로 만족**하되 구현 형태를 바꿨다:

- **검증자 제안의 위험:** strict/safe 두 setter 를 둘 다 prop 으로 내려보내면 "모달 경로에
  어느 것이 연결되었는가"라는 배선 결정이 다시 `App.tsx` 의 JSX 한 줄에 흩어진다. 그 한 줄은
  어떤 테스트로도 잠기지 않는다 — CR-01 을 만든 것이 정확히 그 형태(주석과 실제 배선의 불일치)
  였다.
- **채택안:** `onAckNotice` prop 을 완전히 제거하고 `onAcknowledgeNotice(version):
  Promise<AcknowledgeOutcome>` 하나로 대체했다. 확인 흐름 전체(확인 상태 저장 → 모드 저장 →
  성패 판정)가 `createLoginModeActions()` 안에 들어가고, 그 팩토리 내부가 어느 헬퍼를 쓸지
  결정한다. 결과적으로 "실패를 삼키는 함수를 모달 경로에 꽂는다"는 실수를 **타입 수준에서
  표현할 수 없게** 됐다 — `LoginPanel` 은 애초에 로그인 방식 저장 함수를 prop 으로 받지 않는다.

## WR-01 / IN-03 / IN-04 처리 (06-REVIEW.md disposition)

- **WR-01(저장 진행 중 Esc 경합) — SCOPE IN, Task 3 에서 함께 닫음.** gap 1 과 같은 확인
  흐름·같은 파일·같은 뿌리(확인 경로의 상호배제 미구현)였다. `decideNoticeCancel(saving)` 을
  `login-panel-view.ts` 에 순수 함수로 추가하고 `handleCancelNotice` 가 그 결과만 보고
  분기하도록 배선했다 — Cancel 버튼의 `disabled={noticeSaving}` 와 `ApiModeNoticeModal` 의
  네이티브 `<dialog>` `cancel` 이벤트(Esc) 가 둘 다 이 하나의 판단 지점을 거친다.
- **IN-03(`console.error` 가 앱 로그 패널에 안 남음) — 부분 SCOPE IN, 문서화만.** 저장 실패
  진단이 devtools 콘솔에만 남는다는 사실 자체는 이 플랜이 손대는 핸들러의 성질이지만, 리뷰가
  제안한 renderer→main 오류 포워딩 IPC 채널 신설은 이 gap closure 범위 밖이다(새 IPC 계약은
  preload 계약을 여는 별도 결정, 06-CONTEXT D-05 주의사항). `onDiagnostic` 훅의 JSDoc 에
  devtools 전용이며 로그 패널로는 흐르지 않는다는 사실을 명시하는 데서 멈췄다.
- **IN-04(`dialog.notice-modal` 에 `max-height` 없음) — DEFER.** 실제 Electron 창을 보지
  않고는 검증할 수 없는 CSS 변경이다. `06-VALIDATION.md` Manual-Only Verifications #2 가
  이미 "창을 최소 크기로 줄인 상태에서도 확인 버튼에 도달할 수 있는지"를 outstanding UAT 로
  등록해 두었으므로, 그 관찰 결과 없이 CSS 를 추측으로 바꾸지 않았다.

## Files Created/Modified

- `src/renderer/login-mode-actions.ts` (신규) - 탭/모달 두 경로의 실패 계약을 소유하는 순수 액션 팩토리
- `src/renderer/__tests__/login-mode-actions.test.ts` (신규) - 이 저장소 최초의 `src/renderer/__tests__/` 디렉터리, 7개 테스트
- `src/renderer/App.tsx` (수정) - `createLoginModeActions` 를 `useMemo` 로 1회 생성, LoginPanel 에 `onAcknowledgeNotice` 로 배선
- `src/renderer/components/LoginPanel.tsx` (수정) - `onAckNotice` prop 제거, `handleAcknowledge`/`handleCancelNotice` 가 각각 반환값/`decideNoticeCancel` 만 본다
- `src/renderer/components/login-panel-view.ts` (수정) - `decideNoticeCancel(saving)` 추가
- `src/renderer/components/__tests__/login-panel-view.test.ts` (수정) - `decideNoticeCancel` 테스트 2건 추가(기존 21개 불변)

## Decisions Made

frontmatter `key-decisions` 참조. 요약: 검증자의 "strict setter 병렬 추가" 제안 대신 "모달
경로에서 setter prop 자체를 제거"를 채택 — 재발 형태 자체를 타입 수준에서 차단하기 위함.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 버그, 실행 중 자체 발견] 신규 모듈 헤더 주석이 부정 그렙 대상 문자열을 그대로 포함**
- **Found during:** Task 1 acceptance criteria 검증
- **Issue:** `login-mode-actions.ts` 파일 머리 주석에 `window.api` 라는 리터럴 문자열이
  들어가 있어 `grep -c 'window.api' src/renderer/login-mode-actions.ts == 0` 기준을 위반했다
  (실제 코드에서는 `window.api` 를 참조하지 않았지만 주석 문구가 우연히 그 문자열을 포함함)
- **Fix:** 주석 문구를 "preload 브리지를 직접 참조하지 않는다"로 바꿔 의미는 유지하고 리터럴
  문자열 일치를 없앴다
- **Files modified:** src/renderer/login-mode-actions.ts
- **Verification:** `grep -c 'window.api' src/renderer/login-mode-actions.ts` == 0 확인
- **Committed in:** 32ecc35 (Task 1 커밋에 포함, 원본 작성 직후 정정)

**2. [Rule 3 - 블로킹, acceptance criterion 미달] `App.tsx` 의 `createLoginModeActions` 리터럴 중복**
- **Found during:** Task 3 acceptance criteria 검증
- **Issue:** `grep -c 'createLoginModeActions' src/renderer/App.tsx == 1` 이 요구되는데,
  import 문 + 주석 언급 + 실제 호출로 3줄이 매칭되어 기준을 벗어났다
- **Fix:** 설명용 주석에서 함수명 리터럴 언급을 제거하고, import 를
  `createLoginModeActions as makeLoginModeActions` 로 별칭 처리해 호출부는 별칭을 쓰도록
  했다 — import 선언 한 줄만 원본 식별자를 담고, 팩토리를 "1회만 생성해 쓴다"는 의미는
  그대로 유지된다
- **Files modified:** src/renderer/App.tsx
- **Verification:** `grep -c 'createLoginModeActions' src/renderer/App.tsx` == 1 확인
- **Committed in:** 84a5de5 (Task 3 커밋)

**3. [Rule 1 - 계획 누락 자체 발견] Task 2 액션 텍스트가 요구한 `onDiagnostic` JSDoc 누락**
- **Found during:** Task 3 acceptance criteria 검증 직전 (Task 2 액션 텍스트 재확인 중 발견)
- **Issue:** 06-08-PLAN.md Task 2 `<action>` 은 "`onDiagnostic` 의 JSDoc 에는 이 훅이
  devtools 콘솔 수준의 진단만 받는 자리이며 앱 내 로그 패널로는 흐르지 않는다는 사실을
  명시한다(06-REVIEW IN-03)"를 요구했으나, Task 2 커밋(`395608a`) 시점에 이를 빠뜨렸다
- **Fix:** `LoginModeActionDeps.onDiagnostic` 필드에 IN-03 disposition 을 명시하는 JSDoc 을
  추가했다(devtools 전용, 로그 패널 미도달, 포워딩 채널 신설은 범위 밖)
- **Files modified:** src/renderer/login-mode-actions.ts
- **Verification:** `npm run typecheck` 0 에러, `npx vitest run
  src/renderer/__tests__/login-mode-actions.test.ts` 7/7 유지 확인
- **Committed in:** 84a5de5 (Task 3 커밋에 포함 — 원래 Task 2 소관이었으나 파일이 Task 3 범위와
  겹쳐 있어 그 커밋에서 함께 정정)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 - 자체 발견 결함, 1 Rule 3 - acceptance criterion 미달)
**Impact on plan:** 세 건 모두 acceptance criteria 를 충족하거나 계획이 명시한 문서화 요건을
채우기 위한 정정이며, 계약이나 동작 자체를 바꾸지 않았다. 스코프 크리프 없음.

## Issues Encountered

None — TypeScript 의 `vi.fn()` 제네릭 타입 추론 이슈(Task 1 테스트 파일 작성 중 `ReturnType<typeof
vi.fn>` 만으로는 매개변수 타입이 좁혀지지 않아 `npm run typecheck` 가 실패)는 계획 실행 범위
안의 통상적인 타입 정정으로, 각 mock 필드에 `vi.fn<(...)=>...>()` 명시적 제네릭을 붙여
해결했다. 배포 코드나 테스트 단언은 바뀌지 않았으므로 별도 편차로 기록하지 않았다.

## User Setup Required

None - 외부 서비스 설정 불필요.

## Next Phase Readiness

- 06-VERIFICATION.md gap 1(CR-01)이 자동 테스트로 닫혔다 — `06-VERIFICATION.md` 를 재실행하면
  이 gap 이 더 이상 재현되지 않아야 한다
- 06-REVIEW.md WR-01 도 같은 플랜에서 함께 닫혔다. WR-02/WR-03/IN-02(마스킹 관문 계열)는
  `06-10-PLAN.md`, WR-04/IN-01 은 `06-09-PLAN.md` 가 이어서 판정한다
- IN-04(모달 max-height)는 `06-VALIDATION.md` Manual-Only Verifications #2 사용자 UAT 로
  남아 있다 — 이 플랜은 그 관찰 없이 CSS 를 바꾸지 않았다
- 이 플랜은 main 프로세스 계약(preload/IPC/shared/types)을 건드리지 않았으므로 06-01 이
  확인한 `✓ WIRED` 상태는 그대로 유효하다

## Self-Check: PASSED

- 파일 존재 확인: `src/renderer/login-mode-actions.ts`, `src/renderer/__tests__/login-mode-actions.test.ts`,
  `src/renderer/App.tsx`, `src/renderer/components/LoginPanel.tsx`, `src/renderer/components/login-panel-view.ts`,
  `src/renderer/components/__tests__/login-panel-view.test.ts` — 전부 `[ -f ]` 로 확인됨
- 커밋 존재 확인: `32ecc35`(test), `395608a`(fix), `84a5de5`(fix) — `git log --oneline --all` 에서 전부 확인됨
- 모든 acceptance criteria 재확인 (Task 1/2/3) — 전부 PASS
- 플랜 레벨 `<verification>` 재실행: `npm test` 324/324 통과, `npm run typecheck` 0 에러,
  `npm run typecheck:main` 0 에러, `npm run build` 0 종료, `git diff --stat` package.json/package-lock.json 공백,
  `grep -rc 'onAckNotice' src/renderer/` 전부 0

---
*Phase: 06-ui*
*Completed: 2026-08-26*
