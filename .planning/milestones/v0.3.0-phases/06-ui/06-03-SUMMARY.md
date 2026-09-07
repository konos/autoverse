---
phase: 06-ui
plan: 03
subsystem: docs
tags: [requirements-traceability, roadmap, documentation-correction, void-marking]

# Dependency graph
requires:
  - phase: 05-api
    provides: "2026-08-25 HAR 실측 증거(05-01-SUMMARY.md) — 반증된 로그인 계약의 1차 근거"
  - phase: 06-ui (06-CONTEXT.md)
    provides: "D-08/D-09/D-11/D-12 정정 정책과 정정문 내용"
provides:
  - "REQUIREMENTS.md R020/R021 — 반증된 서술 VOID 마킹 + 실제 매핑 대상으로 정정"
  - "ROADMAP.md Phase 06 성공 기준 2/3 — VOID 마킹 + 정정문, 성공 기준 1 — D-03 의도적 편차 명시"
  - "Traceability 표 R020/R021 Proof 열 갱신(unmapped 해소)"
affects: [06-05, 06-06, 06-07]

actuals:
  tokens: 1168
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "[VOID — 사유] 접두 + 정정문 병기 — 반증된 서술을 삭제 대신 보존하는 이 저장소의 정본 포맷(R018/Phase 05 섹션에서 이미 확립, 이번 플랜이 REQUIREMENTS/ROADMAP 양쪽에 동일 포맷으로 확장)"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "R021 제목에 [정정 — 2026-08-26] 표기를 붙이고 Description 내 반증 원문은 VOID 접두로 감싼 채 보존, 정정문을 바로 아래 병기 (D-08, D-11)"
  - "R020 Notes의 에러코드 목록은 [VOID — 도달 불가]로 마킹 — 삭제하지 않고 D-12가 재정의한 6가지 실제 실패 신호 매핑을 병기, 구현 위치(src/shared/login-failure.ts)를 명시"
  - "ROADMAP Phase 06 SC1은 문구를 그대로 두되 D-03의 의도적 편차(브라우저 모드 무인 자동 로그인 제거)를 인용 블록으로 덧붙여 verify 단계의 오판(회귀로 오인)을 예방"
  - "ROADMAP Phase 06 SC2/SC3도 REQUIREMENTS와 동일한 VOID+정정 포맷을 사용해 두 문서 간 서술 불일치를 남기지 않음"

patterns-established: []

requirements-completed: [R020, R021]

coverage:
  - id: D1
    description: "REQUIREMENTS.md R021 Description의 반증된 'OTP 강제' 서술을 VOID 마킹하고 D-08의 실제 제약(reCAPTCHA 실패 시 브라우저 전환 필요, 자동 재로그인 없음)으로 정정, 근거 경로(05-01-SUMMARY.md) 명시"
    requirement: "R021"
    verification:
      - kind: other
        ref: "grep -c VOID / grep -c 05-01-SUMMARY.md / grep -c reCAPTCHA|보안 확인 on .planning/REQUIREMENTS.md — all >=1"
        status: pass
    human_judgment: false
  - id: D2
    description: "REQUIREMENTS.md R020 Notes의 도달 불가 에러코드 목록을 VOID 마킹하고 D-12의 6가지 실제 실패 신호 매핑 + 구현 위치(src/shared/login-failure.ts)로 정정"
    requirement: "R020"
    verification:
      - kind: other
        ref: "grep -c login-failure.ts / grep -c -- -25044 (원문 보존) on .planning/REQUIREMENTS.md — both >=1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Traceability 표 R020/R021 Proof 열을 unmapped에서 2026-08-26 D-11 정정 서술로 갱신"
    verification:
      - kind: other
        ref: "grep -n '^| R020|^| R021' .planning/REQUIREMENTS.md — Proof column no longer 'unmapped'"
        status: pass
    human_judgment: false
  - id: D4
    description: "ROADMAP.md Phase 06 SC2(OTP 고지)와 SC3(에러코드 안내)를 VOID 마킹 + 정정문 병기, SC1에 D-03 의도적 편차 인용 블록 추가"
    verification:
      - kind: other
        ref: "sed -n '/^### Phase 06/,/^### Phase 07/p' .planning/ROADMAP.md | grep -c VOID (>=2), grep -c '의도적 편차|의도된 변경' (>=1), grep -c 06-CONTEXT.md (>=1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "국소 치환만 수행 — Phase 05/07 섹션과 플랜 목록(06-01-PLAN.md 등)이 손상되지 않고 그대로 남음"
    verification:
      - kind: other
        ref: "git diff --stat HEAD~2 HEAD (REQUIREMENTS.md, ROADMAP.md만 표시); grep -c '### Phase 05|### Phase 06|### Phase 07' == 3; Phase 05 섹션 기존 VOID 마킹 잔존 확인"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 06 Plan 03: 로그인 방식 선택 UI + 실패 안내 — 문서 정정 Summary

**2026-08-25 HAR 실측으로 반증된 R020/R021 서술과 ROADMAP Phase 06 성공 기준 2·3을 VOID 마킹 + 정정문 병기로 처리하고, SC1의 의도적 편차(D-03)를 로드맵에 명시했다.**

## Performance

- **Duration:** 약 12분
- **Started:** 2026-08-26T04:07:11Z (STATE.md last_updated 기준)
- **Completed:** 2026-08-26T04:10:02Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- REQUIREMENTS.md R021: "매 로그인마다 이메일 OTP 필요" 원문을 삭제하지 않고 `[VOID — 2026-08-25 HAR 반증]` 로 감싼 뒤, D-08이 확정한 실제 제약 2가지(reCAPTCHA 실패 시 브라우저 전환 필요 / 자동 재로그인 없음)를 정정문으로 병기. 제목 줄에 `[정정 — 2026-08-26]` 표기 추가.
- REQUIREMENTS.md R020: 도달 불가한 에러코드 목록(`-25003`/`-25044`/`-26000`/`-26004`/`RESTRICTED_OVERSEAS_LOGIN`/`PASSWORD_RESET_REQUIRED`)을 `[VOID — 도달 불가]` 로 마킹, D-12가 재정의한 6가지 실제 실패 신호(캡차/폼 오류/타임아웃/네트워크 오류/토큰 사다리 실패/미매핑)와 구현 위치(`src/shared/login-failure.ts`)를 병기.
- Traceability 표의 R020·R021 Proof 열을 `unmapped`에서 정정 근거 서술로 갱신.
- ROADMAP.md Phase 06 SC2·SC3을 Phase 05 섹션이 확립한 `[VOID — 2026-08-25 HAR 반증]` 정본 포맷과 동일하게 마킹하고 정정문을 병기.
- ROADMAP.md Phase 06 SC1에 D-03의 의도적 편차(브라우저 모드 무인 자동 로그인 제거)를 근거·판정 지침과 함께 인용 블록으로 추가해, verify 단계가 이를 회귀로 오판하지 않도록 사전 차단.

## Task Commits

Each task was committed atomically:

1. **Task 1: REQUIREMENTS.md R021 · R020 정정 (VOID 마킹 + 정정문)** - `b0d928c` (docs)
2. **Task 2: ROADMAP.md Phase 06 성공 기준 정정 + SC1 의도적 편차 명시** - `d3c1feb` (docs)

_Note: 이 플랜은 문서 전용이며 TDD 대상이 아니다._

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - R021 제목·Description·Notes 정정, R020 Notes 정정, Traceability 표 R020/R021 행 갱신
- `.planning/ROADMAP.md` - Phase 06 섹션의 성공 기준 1(편차 주석)·2(VOID+정정)·3(VOID+정정)만 국소 치환

## Decisions Made
- R021 제목의 `[정정 — 2026-08-26]` 표기는 R018이 이미 쓴 `[보류 — 2026-08-25]` 형태를 그대로 따라 저장소 내 일관성을 유지했다.
- ROADMAP SC1은 문구 자체를 바꾸지 않고 인용 블록(`>`)으로 편차 주석만 덧붙였다 — SC1 자체는 반증되지 않았고 의도적으로 위반되는 것이므로 VOID 마킹 대상이 아니라는 구분을 유지하기 위함.
- Coverage Summary(REQUIREMENTS.md 최하단)는 상태 전이(active→validated 등)가 없으므로 수치를 변경하지 않았다 — 플랜 지시사항 그대로.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- REQUIREMENTS.md와 ROADMAP.md가 이제 서로 모순되지 않는 정정된 서술을 공유한다 — 06-05/06-06 구현자와 06-07 verify 에이전트가 반증된 전제를 다시 주워 들 위험이 제거됐다.
- ROADMAP SC1의 의도적 편차가 명시돼, 06-04(무인 자동 로그인 가드 재정의, D-03 구현)가 완료된 뒤 06-07 verify가 이를 회귀로 오판하지 않을 근거가 문서에 남았다.
- 블로커 없음. Wave 1의 나머지 의존 관계(06-01·06-02 완료, 06-04는 이 둘 완료 후 진행)는 이 플랜의 영향을 받지 않는다.

---
*Phase: 06-ui*
*Completed: 2026-08-26*

## Self-Check: PASSED
- FOUND: .planning/phases/06-ui/06-03-SUMMARY.md
- FOUND: b0d928c (Task 1 commit)
- FOUND: d3c1feb (Task 2 commit)
