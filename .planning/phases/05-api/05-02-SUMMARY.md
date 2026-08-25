---
phase: 05-api
plan: 02
subsystem: docs
tags: [requirements-traceability, project-contract, roadmap, har-evidence, weverse-account-api]

# Dependency graph
requires:
  - phase: 05-api/05-01
    provides: "HAR-confirmed real login contract (Invalidated Assumptions section) — the sole evidentiary basis for every correction made in this plan"
provides:
  - "REQUIREMENTS.md R017 rewritten from the invalidated 3-step OTP login description to the HAR-confirmed single-call by-credentials contract"
  - "REQUIREMENTS.md R018 transitioned active -> blocked, unmapped from Phase 05, with cited HAR evidence and no deletion of the requirement record"
  - "REQUIREMENTS.md traceability table and Coverage Summary numbers reconciled with the R018 status change"
  - "PROJECT.md account API contract table and constraint paragraph corrected to reflect reCAPTCHA-gated single-call login instead of a 3-step OTP flow"
  - "ROADMAP.md Phase 05 Goal/Requirements/Success Criteria rewritten for the R019 ladder-validation spike, with voided Success Criteria 1-2 marked [VOID] rather than deleted"
affects: [05-03, 06, 07]

# Actuals (#2632)
actuals:
  tokens: 3200
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - .planning/ROADMAP.md

key-decisions:
  - "R018 was transitioned to blocked and unmapped rather than deleted or left active — per D-05 and the plan's explicit prohibition, deletion would erase the record that an email-OTP step was ever a live requirement candidate; blocked preserves it as a re-evaluatable, sourced entry."
  - "R017's item title and description were rewritten to describe the HAR-confirmed single-call contract without ever naming the two invalidated endpoints (/v2/auth/otp-sessions, /v3/auth/token/by-credentials-with-otp) inside the R017 block itself — that falsification narrative was deliberately placed in R018's Notes instead, so the 'what is the current contract' and 'what got disproven' concerns live in separate, non-conflicting sections."
  - "ROADMAP Phase 05 Success Criteria 1 and 2 were kept in the document with a [VOID — 2026-08-25 HAR 반증] prefix instead of being struck through or removed, matching the plan's directive that invalidation history is a project learning asset, not something to erase."
  - "PROJECT.md's Target features bullet list (above the corrected contract table) was left untouched — it still describes the old 3-step/OTP framing. This was a deliberate scope decision: the plan's action block scoped Task 2 explicitly to the contract table and the paragraph below it (lines ~33-45), not the feature bullet list above it. Flagged here rather than silently left as a stale-doc risk."

patterns-established: []

requirements-completed: [R017, R018]

coverage:
  - id: D1
    description: "REQUIREMENTS.md R017 rewritten to the HAR-confirmed single-call by-credentials contract; R018 demoted to blocked/unmapped with cited evidence; traceability table and Coverage Summary reconciled"
    requirement: "R017"
    verification:
      - kind: other
        ref: "grep-based acceptance criteria run against .planning/REQUIREMENTS.md (see Task 1 in 05-02-PLAN.md) — otp-sessions=0 in R017 block, reCAPTCHA>=1 in R017 block, Status: blocked=1 in R018 block, traceability row '| R018 | core-capability | blocked |' present, ### R018 count=1 (not deleted), 05-01-SUMMARY.md cited in both blocks"
        status: pass
    human_judgment: false
  - id: D2
    description: "PROJECT.md account API contract table and ROADMAP.md Phase 05 Goal/Success Criteria corrected to remove the invalidated 3-step OTP login claim, while preserving the invalidation record"
    requirement: "R018"
    verification:
      - kind: other
        ref: "grep-based acceptance criteria run against .planning/PROJECT.md and .planning/ROADMAP.md (see Task 2 in 05-02-PLAN.md) — 05-01-SUMMARY.md and reCAPTCHA Enterprise cited in PROJECT.md, invalidated phrases (OTP 세션 생성 시에만 / 매 로그인마다 OTP / 검증된 API 계약) absent from the contract section, VOID count=2 in ROADMAP Phase 05 block, Phase 06/07 headers intact, no real-account email domains introduced"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-25
status: complete
---

# Phase 5 Plan 2: 반증된 API 로그인 계약 문서 정정 Summary

**REQUIREMENTS.md/PROJECT.md/ROADMAP.md 세 문서가 더 이상 반증된 3단계 이메일 OTP 로그인 계약을 사실로 서술하지 않도록 정정하고, R018을 삭제 없이 blocked·매핑 해제 상태로 기록했다 — 05-01-SUMMARY.md의 HAR 실측 결과가 유일한 근거.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-25 (직전 시각 미기록 — 세션 시작 시 `record_start_time` 단계를 건너뜀, 완료 시각으로 역산)
- **Completed:** 2026-08-25T09:25:21Z
- **Tasks:** 2 of 2
- **Files modified:** 3 (REQUIREMENTS.md, PROJECT.md, ROADMAP.md — 정확히 plan의 `files_modified` 목록과 일치)

## Accomplishments

- REQUIREMENTS.md R017: 제목/Description/Notes를 "3단계 로그인" 서술에서 HAR 실측 계약(`by-credentials` 단독 호출, `otpSessionId` = reCAPTCHA Enterprise 토큰)으로 전면 교체. R017 항목 안에서는 `otp-sessions`/`by-credentials-with-otp` 엔드포인트를 한 번도 언급하지 않음 (반증 서술은 R018로 분리).
- REQUIREMENTS.md R018: `Status: active` → `blocked`, `Primary owning slice`를 Phase 05에서 매핑 해제, HAR 근거(호출 0건, `-25044`의 실제 의미, 05-01 스파이크에서 OTP 메일 미수신)를 Notes에 기록. 항목 자체는 삭제하지 않음.
- REQUIREMENTS.md traceability 표 R017/R018 행 및 Coverage Summary 숫자(Active 11→10, Mapped 11→10, Blocked 1 신설)를 R018 상태 변경에 맞춰 재계산.
- PROJECT.md "검증된 API 계약" 표를 "계정 API 계약 (2026-08-25 HAR 실측으로 정정)"으로 개명하고, 세션 생성/OTP 로그인 행을 "실제 흐름에 등장하지 않음 — R018 보류"로, reCAPTCHA 행을 "로그인 요청 자체의 필수 입력"으로 정정. 핵심 제약 문단도 "캡차 관문이 실제 게이트"로 교체.
- ROADMAP.md Phase 05 Goal/Requirements/Success Criteria를 R019 사다리 검증 스파이크로 재정의. Success Criteria 1·2는 삭제 대신 `[VOID — 2026-08-25 HAR 반증]` 접두로 기록 보존. 상단 마일스톤 목록의 Phase 05 한 줄 설명과 HALTED 콜아웃 아래 재설계 완료 안내 한 줄도 갱신.

## Task Commits

Each task was committed atomically:

1. **Task 1: REQUIREMENTS.md 정정 — R017 서술 교체, R018 보류 처리 (D-05)** - `3250f40` (docs)
2. **Task 2: PROJECT.md API 계약 표 + ROADMAP Phase 05 Goal/Success Criteria 정정** - `42a5243` (docs)

_Note: 이 SUMMARY 커밋 자체가 plan metadata 커밋을 겸한다 (`final_commit` 단계에서 STATE.md/ROADMAP.md/REQUIREMENTS.md와 함께)._

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - R017 계약 서술 교체, R018 blocked 전환, traceability/Coverage Summary 정합
- `.planning/PROJECT.md` - 계정 API 계약 표 및 핵심 제약 문단 정정
- `.planning/ROADMAP.md` - Phase 05 Goal/Requirements/Success Criteria 재작성, HALTED 콜아웃 아래 재설계 완료 안내 추가

## Decisions Made

- R018을 삭제가 아니라 `blocked` + 사유 + 매핑 해제로 기록 (D-05 요구사항, plan의 명시적 금지사항 준수).
- R017 항목 본문에서 구 엔드포인트 이름을 전혀 언급하지 않아, "현재 계약"과 "무엇이 반증됐는지"의 서술 위치를 분리.
- ROADMAP Success Criteria 1·2를 삭제 대신 `[VOID]` 마킹으로 보존 — 프로젝트의 학습 자산이라는 plan의 원칙 준수.
- PROJECT.md "Target features" 불릿 목록(계약 표보다 위)은 이번 태스크 스코프 밖이라 손대지 않음 — 여전히 구 3단계/OTP 표현을 담고 있어 표와 국지적으로 어긋나는 상태로 남음 (아래 Known Stubs 참고).

## Deviations from Plan

None - plan executed exactly as written. 모든 acceptance criteria와 plan-level verification이 수정 없이 1차 통과했다.

**Total deviations:** 0
**Impact:** 없음.

## Known Stubs / Residual Inconsistencies

- **PROJECT.md "Target features" 불릿 목록** (계약 표 위, milestone 섹션 상단부)이 여전히 "API 로그인 경로 신규 구현 — `otp-sessions` → `by-credentials` → `by-credentials-with-otp` 3단계"와 "이메일 OTP 입력 흐름 — API 모드는 매 로그인마다 OTP 필수"라는 반증된 서술을 담고 있다. 이 플랜의 Task 2 action 범위는 명시적으로 "33-45행 부근의 계약 표 블록"으로 한정돼 있었고, 이 불릿 목록은 그 범위 밖이었으므로 손대지 않았다. 결과적으로 같은 파일 안에서 계약 표(정정됨)와 Target features 목록(구 서술 유지) 사이에 국지적 모순이 남는다. 다음 문서 정리 태스크(05-03 이후 또는 Phase 06/07 계획 시점)에서 함께 정리할 후보로 남긴다.

## Threat Flags

None found — 이 플랜은 threat_model의 4개 항목(T-05-08~T-05-11) 모두를 scoped Edit·grep 검증으로 커버했고, 새로운 보안 관련 표면을 추가하지 않았다.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-03 (R019 실계정 판정 체크포인트)은 이 플랜이 만든 정정된 REQUIREMENTS.md/PROJECT.md/ROADMAP.md를 전제로 진행하면 된다 — R017/R018 상태 변경이 05-03의 실행에 영향을 주지 않는다(05-03은 코드 검증 태스크이며 이 문서들을 수정하지 않는다).
- 위 "Known Stubs"에 기록한 PROJECT.md Target features 불릿의 잔존 모순은 05-03의 블로커가 아니지만, Phase 06/07 계획 단계에서 R018 매핑 해제가 미치는 영향(Phase 06 Success Criteria 2, Phase 07 자격증명 저장 전제)과 함께 정리할 것을 권고한다 (05-CONTEXT.md의 deferred 항목과 동일 사안).

## Self-Check

- `[ -f .planning/REQUIREMENTS.md ]` → FOUND
- `[ -f .planning/PROJECT.md ]` → FOUND
- `[ -f .planning/ROADMAP.md ]` → FOUND
- `git log --oneline --all | grep 3250f40` → FOUND
- `git log --oneline --all | grep 42a5243` → FOUND
- Task 1 `<verify>` (otp-sessions=0, Status:blocked=1, traceability blocked row present) → PASS (re-run above)
- Task 2 `<verify>` (05-01-SUMMARY.md + reCAPTCHA Enterprise cited, VOID=2, Phase 06/07 intact) → PASS (re-run above)
- Plan-level `<verification>` (5 checks: otp-sessions=0, Status:blocked>=1, ### R0 count=23 unchanged, ### Phase 0 count=3 unchanged, git diff --stat limited to declared 3 files) → PASS (re-run above)

## Self-Check: PASSED

---
*Phase: 05-api*
*Completed: 2026-08-25*
