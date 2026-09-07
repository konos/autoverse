---
phase: 06-ui
plan: 07
subsystem: testing
tags: [phase-gate, validation-contract, uat-registration, vitest, typescript]

# Dependency graph
requires:
  - phase: 06-ui (06-01 ~ 06-06)
    provides: "settings-store 영속화, login-failure 매핑, 문서 정정, 반증 코드 제거, 실패 안내 재배선, 선택기 UI — 이 플랜이 검증하는 전체 phase 산출물"
provides:
  - "green phase gate (npm test + typecheck:main + typecheck + build) — D-02 대량 삭제 이후 컴파일 깨짐 없음을 확인"
  - "06-VALIDATION.md 실제 상태 갱신 — 17개 Per-Task Verification Map 행, Wave 0 체크리스트, Manual-Only Verifications 4항목 실행 가능한 절차, wave_0_complete/nyquist_compliant: true"
  - "R016/R020/R021 shared-ID gate 해제 — 형제 플랜(03/04/05/06/07) 전부 SUMMARY 완료로 requirements ready-ids 3/3 ready"
affects: [07 (다음 phase), 사용자 UAT]

actuals:
  tokens: 5254
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "검증 계약 문서 갱신: Automated Command 를 실제로 실행해 결과를 기록 — grep 카운트 요건 위반 없이 프론트매터/체크리스트/표 3곳을 정합되게 갱신하는 패턴"

key-files:
  created: []
  modified:
    - .planning/phases/06-ui/06-VALIDATION.md

key-decisions:
  - "Task 1(게이트 실행+검증맵 갱신)과 Task 2(수동 검증 준비)를 하나의 커밋으로 병합 — 두 태스크가 같은 단일 문서(06-VALIDATION.md)의 서로 다른 섹션(검증맵/Wave0 vs Manual-Only/Sign-Off)을 수정하고 중간에 독립적으로 커밋 가능한 상태가 없어, 태스크 경계보다 문서 정합성을 우선했다(06-05가 동일 사유로 이미 선례를 남김)"
  - "수동 검증 4항목 중 '선택 영속'은 부분 확인으로 기록 — 06-01 tracer 체크포인트가 API→재시작 방향만 실제 확인했고 브라우저→재시작 반대 방향은 이 실행에서도 미확인이므로, 통과로 뭉뚱그리지 않고 방향별로 분리해 기록했다(prohibitions: 확인되지 않은 항목을 통과로 기록하지 않는다)"
  - "nyquist_compliant/wave_0_complete를 true로 전환 — Validation Sign-Off 7항목 전부가 실제 실행 결과로 충족을 확인한 뒤에만 전환했다. status는 validated로 바꾸지 않음(별도 verify 워크플로 소관, 플랜 명시 제약 준수)"

patterns-established: []

requirements-completed: [R016, R020, R021]

coverage:
  - id: D1
    description: "phase 게이트 3종 + 빌드가 green이다 — D-02 대량 삭제(auth-service.ts/api-auth-client.ts/ipc-handlers.ts/LoginPanel.tsx)가 남긴 컴파일 깨짐이 없다"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "npm test — 16 files, 315 tests, 0 failures"
        status: pass
      - kind: other
        ref: "npm run typecheck:main && npm run typecheck && npm run build — 전부 0 종료"
        status: pass
    human_judgment: false
  - id: D2
    description: "06-VALIDATION.md Per-Task Verification Map 17행 전부가 실제 태스크 ID·명령·상태로 채워졌다 — TBD/pending 잔존 없음"
    requirement: null
    verification:
      - kind: other
        ref: "grep -c TBD == 0, grep -c '^| 06-.*pending |' == 0, 7개 테스트 파일을 그룹 실행(134 tests, 0 failures)해 개별 재확인"
        status: pass
    human_judgment: false
  - id: D3
    description: "수동 검증 4항목(선택 영속·최초 고지 차단·환경변수 잠금·실패 안내)의 실행 가능한 절차가 06-VALIDATION.md에 확정되고, phase 종료 UAT로 harvest될 06-07-PLAN.md의 <verify><human-check> 블록과 정합한다"
    requirement: "R016/R020/R021"
    verification: []
    human_judgment: true
    rationale: "이 4항목은 정의상 실제 Electron 앱 실행과(항목 4는) 실계정 로그인이 필요해 이 저장소의 테스트 환경(node, DOM 없음)으로는 도달 불가능하다 — 에이전트는 절차를 확정하고 npm run build로 실행 가능 상태만 증명했다. 실행 자체는 사용자 몫이다(05-CONTEXT D-06)."
  - id: D4
    description: "에이전트가 실계정 자격증명을 입력하거나 weverse.io/accountapi.weverse.io로 어떤 요청도 보내지 않았다"
    requirement: null
    verification:
      - kind: other
        ref: "이 실행에서 실행한 명령 이력 전체 — npm test/typecheck/build/vitest run/grep/git 뿐, npm run dev 또는 로그인 관련 명령 없음"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 07: 로그인 방식 선택 UI + 실패 안내 — 검증 게이트 Summary

**phase 게이트 3종(vitest 315/315, typecheck×2, build)을 green으로 확인하고, 06-VALIDATION.md의 17개 검증 행·Wave 0 체크리스트·수동 검증 4항목 절차를 실제 상태로 채워 R016/R020/R021 shared-ID 게이트를 해제했다 — 수동 검증 자체는 사용자 UAT로 이관.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-26T05:52:22Z (첫 `npm test` 실행)
- **Completed:** 2026-08-26T05:56:11Z (커밋 시각)
- **Tasks:** 2/2
- **Files modified:** 1 (`06-VALIDATION.md`)

## Accomplishments

- **Task 1 (게이트 + 검증맵):** `npm test`(16 files/315 tests), `npm run typecheck:main`, `npm run typecheck`, `npm run build` 전부 0 종료로 확인 — D-02 대량 삭제(4개 파일에 걸친 메서드/IPC/타입 제거)가 남긴 컴파일 깨짐이 없음을 phase 종료 시점에 재확인했다. `git diff --stat package.json package-lock.json` 공백으로 phase 전체 신규 의존성 0건도 재확인.
- 06-VALIDATION.md의 Per-Task Verification Map 17행 전부를 대상 테스트 파일을 실제로 그룹 실행(134 tests, 0 failures)해 File Exists/Status 두 열을 실제 상태(✅ 신규/확장/교체 + ✅ green)로 갱신했다. `⬜ pending`이 남아있던 11행이 전부 ✅로 전환됐다(06-05/06-06이 이미 채운 6행은 유지).
- Wave 0 Requirements 체크리스트 6항목을 디스크 상태로 재확인해 체크 — `notice-ack.test.ts`가 별도 파일이 아니라 `api-mode-notice.test.ts`로 흡수됐음을 06-01-SUMMARY.md 근거로 명시했다(계획 대비 파일명 편차이나 06-01 자신의 설계였고 커버리지 누락 아님).
- Validation Sign-Off 7항목을 실제 실행 결과(feedback latency 1.65s 실측, watch 플래그 없음, gate 내 typecheck 2종 확인 등)로 채우고 `wave_0_complete: true`, `nyquist_compliant: true`로 프론트매터를 전환했다. `status`는 `draft`로 유지(별도 verify 워크플로 소관, 플랜 명시 제약).
- **Task 2 (수동 검증 준비):** `npm run build` 재확인(0 종료 — 사용자가 즉시 실행할 수 있는 상태의 증거) 후, Manual-Only Verifications 표를 실행 가능한 절차로 재작성했다. 06-01 tracer 체크포인트에서 이미 사용자가 확인한 "API 탭 선택→재시작→API 탭 유지"(settings.json 파일 내용으로 독립 corroborate)를 선택 영속 항목에 **부분 확인**으로 정확히 반영하고, 반대 방향(브라우저→재시작)은 미확인으로 명시해 통과로 뭉뚱그리지 않았다. fanId 혼동 요인(05-SPIKE-RESULT §2)과 D-03 의도된 자동 로그인 제거를 다시 인용해 verify 단계의 오판을 예방했다.
- 에이전트는 `npm run dev`를 한 번도 실행하지 않았고, 실계정 자격증명을 입력하거나 weverse.io/accountapi.weverse.io로 어떤 요청도 보내지 않았다(prohibitions 준수, 이 세션의 전체 명령 이력으로 확인 가능).

## Task Commits

Task 1과 Task 2가 동일한 단일 문서(`06-VALIDATION.md`)의 서로 다른 섹션을 수정하고 그 사이에 독립적으로 커밋 가능한 중간 상태가 없어(아래 Deviations 참고), 하나의 커밋으로 병합했다:

1. **Task 1+2: 게이트 실행 + 검증 계약 문서 실제 상태 갱신** - `63f8c04` (docs)

**Plan metadata:** (이 커밋 다음 — 본 SUMMARY 커밋)

## Files Created/Modified

- `.planning/phases/06-ui/06-VALIDATION.md` — Per-Task Verification Map 17행 실제 상태, Wave 0 체크리스트, Manual-Only Verifications 4항목 절차 확정, Validation Sign-Off 7항목, 프론트매터 `wave_0_complete`/`nyquist_compliant` → true

## Decisions Made

- **Task 1/2 커밋 병합:** 두 태스크가 정확히 같은 파일의 서로 다른 섹션을 수정하며, 06-VALIDATION.md는 하나의 정합된 문서로 존재해야 검증 계약으로서 의미가 있다 — 섹션별로 쪼개 커밋하면 중간 커밋에서 "게이트는 green인데 수동 검증 절차는 옛 버전"인 비일관 상태가 생긴다. 06-05-SUMMARY.md가 동일 사유(타입/문서 일관성 우선)로 이미 선례를 남겼다.
- **선택 영속 항목을 "부분 확인"으로 기록:** 06-01 tracer 체크포인트가 검증한 것은 "API 탭 선택 → 재시작 → API 탭 유지" 한 방향뿐이다. 플랜 Task 2는 명시적으로 "이어서 브라우저 탭으로 바꾸고 반대 방향도 확인"을 요구하는데, 이 방향은 아직 아무도 확인하지 않았다. prohibitions("확인되지 않은 항목을 통과로 기록하지 않는다")를 지키기 위해 방향별로 분리해 기록했다.

## Deviations from Plan

None — 계획대로 실행됨. 유일한 실행상 선택(Task 1/2 커밋 병합)은 위 "Decisions Made"에 근거와 함께 기록했으며, 두 태스크의 acceptance_criteria는 커밋 전 각각 개별적으로 grep/명령 실행으로 검증했다(본문 상단 Accomplishments 참조).

## Issues Encountered

**`requirements.mark-complete` no-op for R016/R020/R021.** `gsd-tools query requirements.ready-ids`이 3/3 ready를 확인했지만, 이어서 실행한 `requirements.mark-complete R016 R020 R021`은 세 항목 모두 `not_found`(surface: checkbox)로 아무것도 갱신하지 못했다. 원인: 이 프로젝트의 `.planning/REQUIREMENTS.md`는 GSD 표준 체크박스 스키마(`- [ ] R016`)가 아니라 이 저장소가 Phase 01부터 확립한 산문형 스키마(`- Status: active|validated|blocked|out-of-scope`)를 쓴다. 이 스키마에는 "complete"라는 상태값 자체가 없다 — 완료된 요구사항도 `active`로 남아 있다가, 실제 검증(예: R019가 05-SPIKE-RESULT.md의 실계정 관측으로 `validated`로 전이한 사례)이 있을 때만 `validated`로 바뀐다. `requirements.mark-complete`는 이 산문형 스키마를 인식하지 못했고, 다행히 아무것도 손상시키지 않고(`updated: false`) 안전하게 no-op으로 끝났다. **에이전트는 이 스키마 불일치를 손으로 봉합하지 않았다** — "complete"라는 이 저장소에 없는 상태값을 임의로 삽입하면 오히려 R019 등 기존 항목들과 어휘가 어긋나게 된다. R016/R020/R021의 실제 완료 반영은 이 프로젝트의 기존 관행대로 트레이서빌리티 표의 Validation 열(이미 03에서 D-11 정정 서술로 채워짐)과, 향후 `/gsd-verify-work`/`/gsd-validate-phase`가 실제 UAT 결과를 근거로 `validated`로 전이시키는 별도 단계에 맡긴다.

## User Setup Required

None - 외부 서비스 설정 불필요. 다만 아래 "Next Phase Readiness"의 UAT 4항목은 사용자가 `npm run dev`로 앱을 실행해 직접 수행해야 한다.

## Next Phase Readiness

### 수동 검증 4항목 최종 상태 (통과/실패/미관측)

| # | 항목 | 요구사항 | 상태 | 근거 |
|---|------|----------|------|------|
| 1 | 선택 영속 (양방향) | R016 | **부분 확인** — API→재시작 방향만 통과, 브라우저→재시작 방향 **미확인** | 06-01 tracer 체크포인트(사용자가 "verified"로 확인) + settings.json 독립 corroborate. 반대 방향은 이번 실행에서도 시도하지 않음(에이전트는 `npm run dev`를 실행하지 않았음) |
| 2 | 최초 고지 차단 (좁은 창 포함) | R021 | **미확인** — 사용자 UAT 필요 | 06-06-SUMMARY.md D1/D5가 `human_judgment: true`로 이관. 결정 함수/모달 구조는 단위 테스트로 증명됨 |
| 3 | 환경변수 잠금 (원문 값 미노출) | R016 (D-06) | **미확인** — 사용자 UAT 필요 | 06-06-SUMMARY.md D2가 코드 구조(grep)로만 증명 |
| 4 | 실패 안내 (오타 비밀번호, 캡차는 관측시만) | R020 | **미확인** — 사용자 UAT 필요, 실계정 필요 | `mapLoginFailure()`/`buildFailureView()` 6개 사유 전수 단위 테스트 통과(06-02/06-06). 실제 Weverse 응답은 미관측 |

**결론: 4항목 중 3.5항목이 사용자 UAT 대기 상태다.** 이 SUMMARY는 아무것도 통과로 임의 승격하지 않았다 — 06-07-PLAN.md Task 2의 `<verify><human-check>` 블록이 phase 종료 시 이 4항목 전체를 사용자에게 한 번에 제시하도록 이미 등록돼 있다(플랜 자체의 사전 등록, 이 SUMMARY가 추가로 등록할 필요 없음).

### 06-01/06-05/06-06이 남긴 동시성(concurrency) 가정 — 다음 phase로 이관

이 세 가정은 코드 수준에서 검증되지 않은 채 남아 있으며, 단일 Electron 인스턴스·단일 창을 전제한다:

1. **(06-01) 설정 파일 동시 쓰기:** 파일 락 없음. 중단 내구성은 tmp+`renameSync` 원자성에만 의존하고 `fsync` 미호출(손실 허용 가능한 로컬 UI 설정이라는 판단). 다중 창/다중 인스턴스로 확장되면 마지막 쓰기가 이기는 대신 값이 섞일 수 있다 — 재검토 필요.
2. **(06-05) 동시 로그인 시도:** main 프로세스에 두 번째 `credentialLogin()` 호출을 막는 락이 없다. 겹쳐 호출되면 두 번째 호출이 첫 번째 헤드리스 창을 정리하고 자기 창을 열며, **마지막 시도의 결과만 사용자에게 표시된다.** 로그인 진행 중 사용자가 모드를 바꿔도 진행 중인 시도는 취소되지 않는다(D-07) — 결과는 시도 당시의 경로 기준으로 안내된다.
3. **(06-06) 고지 확인 + 모드 저장의 비원자성:** `settings:ack-notice`와 `settings:set-login-mode`가 확인 버튼 클릭 한 번에서 순차 `await` 체이닝으로 일어난다 — 두 쓰기 사이에 프로세스가 죽으면 확인만 기록되고 모드는 이전 값으로 남는다(안전한 방향의 실패이나 코드로 강제되지 않음). 모달이 열려있는 동안은 네이티브 `<dialog>.showModal()`의 inert 처리로 배경 탭 클릭 경합은 발생하지 않는다.

이 세 가정 모두 "단일 사용자, 단일 창, 순차 상호작용"을 전제로 한 로컬 데스크톱 앱이라는 이 프로젝트의 현재 범위에서는 리스크가 낮다고 판단됐으나, 명시적으로 재검토된 적은 없다. 다음 phase(07, 토큰 만료 사전 경고)가 여러 창/백그라운드 갱신을 도입한다면 이 세 가정을 먼저 재검토할 것.

### Phase 06 종합

- phase 게이트(테스트·타입체크·빌드) green, `06-VALIDATION.md` 실제 상태 반영 완료, `nyquist_compliant`/`wave_0_complete` true.
- R016/R020/R021 shared-ID 게이트가 이 SUMMARY로 해제된다 — `requirements ready-ids` 확인 결과 3/3 ready.
- ROADMAP Phase 06 성공 기준 3개 중 실제 앱 동작 확인이 필요한 부분은 사용자 UAT(위 표) 결과를 기다린다. SC2/SC3은 이미 06-03에서 VOID+정정 처리됐고, SC1은 D-03 의도적 편차 주석이 남아 있다(회귀 아님).
- 블로커: 없음(신규). Phase 05에서 이월된 blocker 3건(rung2 미검증, ApplyEngine shape-only 사인오프, 평문 토큰 로그 잔존)은 이 phase의 영향 밖이며 STATE.md에 그대로 유지된다.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: .planning/phases/06-ui/06-VALIDATION.md
- FOUND commit: 63f8c04
- Re-ran `npm test` → 315/315 passed (16 files)
- Re-ran `npm run typecheck:main` → 0 errors
- Re-ran `npm run typecheck` → 0 errors
- Re-ran `npm run build` → 0 exit
- `grep -c TBD .planning/phases/06-ui/06-VALIDATION.md` → 0
- `grep -c "^| 06-.*pending |" .planning/phases/06-ui/06-VALIDATION.md` → 0
- `grep -c "nyquist_compliant: true" .planning/phases/06-ui/06-VALIDATION.md` → 1
- `git diff --stat package.json package-lock.json` → empty
- `node gsd-tools.cjs query requirements.ready-ids 06-07-PLAN.md R016 R020 R021` → 3/3 ready
