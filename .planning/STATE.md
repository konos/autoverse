---
gsd_state_version: 1.0
milestone: v0.3.0
milestone_name: 로그인 방식 선택 (API / 브라우저)
current_phase: 06
current_phase_name: 로그인 방식 선택 UI + 실패 안내
status: executing
stopped_at: Completed 06-07-PLAN.md
last_updated: "2026-08-26T06:55:46.189Z"
last_activity: 2026-08-26
last_activity_desc: Phase 06 execution started
state_head: 428a9b0c93948243122dc4c2a41d9ea0cf2a5a9c
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 13
  completed_plans: 10
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-25)

**Core value:** 서버 시간 보정 + RTT 반영으로 선착순 이벤트 신청 POST가 정시에 서버에 도착하는 것.
**Current focus:** Phase 06 — 로그인 방식 선택 UI + 실패 안내

## Current Position

Phase: 06 (로그인 방식 선택 UI + 실패 안내) — READY TO EXECUTE
Plan: 7 of 7
Status: Ready to execute
Last activity: 2026-08-26 — Phase 06 execution started

**Phase 05 결과 (완료 2026-08-25):** R019 사다리는 **rung1(직접 사용)이 실계정에서 성립**함을 1회 관측으로 확인했다 (계정 도메인 쿠키 JWT → `/fans/me` 200 + fanId). rung2(명시적 교환)는 미실행으로 여전히 미검증이다. 로그인 방식 최종 결정(D-04)은 Phase 06 에서 이 결과를 근거로 내린다.

**배경 (유지):** 구 halt 사유(`POST /v4/auth/token/by-credentials` 의 `otpSessionId` 필드가 OTP
세션 ID 가 아니라 reCAPTCHA Enterprise 토큰이며 실제 로그인 흐름에 OTP 단계가 없다는 HAR 증거)는
그대로 유효하다. 이 사실을 전제로 Phase 05 를 **R019 사다리 검증 스파이크**로 재정의했다 —
이미 동작하는 헤드리스 브라우저 로그인으로 account 토큰을 확보하고(D-02), `acquireFaneventToken()`
사다리의 rung1/rung2 를 실계정으로 판정한다(D-03). 로그인 방식의 최종 결정은 사다리 결과 이후다(D-04).
구 05-01(halted)/05-02(blocked) 플랜은 폐기·대체됐다. 정본 근거: `.planning/phases/05-api/05-01-SUMMARY.md`,
결정 사항: `.planning/phases/05-api/05-CONTEXT.md`

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**

- Total plans completed: 3 (v0.3.0 기준)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-04 (M001-ksbtje) | — | — | — |
| 05-07 (v0.3.0) | 0 | 0 | — |
| 05 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 05-api P01 | ~35min | 3 tasks | 6 files |
| Phase 05-api P02 | 20 min | 2 tasks | 3 files |
| Phase 05-api P03 | ~20min | 3 tasks | 2 files |
| Phase 06-ui P01 | 45min | 3 tasks | 11 files |
| Phase 06 P02 | 15min | 2 tasks | 2 files |
| Phase 06-ui P03 | 12min | 2 tasks | 2 files |
| Phase 06 P04 | 42min | 3 tasks | 7 files |
| Phase 06 P05 | 25min | 3 tasks | 5 files |
| Phase 06 P06 | 11 min | 3 tasks | 7 files |
| Phase 06 P07 | 12min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v0.3.0: 브라우저 모드를 기본값으로 유지 — **근거 정정(2026-08-25):** OTP 강제가 아니라 reCAPTCHA 관문 때문에 무인 실행 불가. 결론은 유지
- v0.3.0: API 모드 토큰 만료는 자동 재로그인 대신 사전 경고로 대응 (Phase 07)
- v0.3.0: 로그인 API를 리버싱해 직접 호출 — **부분 무효(2026-08-25):** 번들 분석만으로는 `otpSessionId` 가 캡차 토큰임을 구분하지 못했다. HAR 실측이 계약을 정정
- [Phase 05]: R019 사다리 검증 스파이크 배선 완료 — 쿠키 우선 + CDP 폴백으로 account 토큰 확보해 acquireFaneventToken()에 공급, verdict 로그로 관측 가능. 실계정 판정은 05-03 체크포인트로 이관
- [Phase 05]: R018 삭제 대신 blocked+매핑해제로 기록 (D-05) — HAR 상 OTP 단계 부재, 05-01-SUMMARY.md 근거
- [Phase 05]: R017 항목 본문에서 반증된 옛 엔드포인트 이름 언급을 배제, 반증 서술은 R018 Notes로 분리
- [Phase 05]: ROADMAP Phase 05 Success Criteria 1·2를 삭제 대신 [VOID] 마킹으로 보존 — 학습 자산 기록 원칙
- [Phase 05]: R019 실계정 관측으로 validated — rung1(직접 사용)이 계정 도메인 쿠키(rt, JWT 451자)로 /fans/me 200+fanId 확보. rung2(교환)는 미실행으로 여전히 미검증
- [Phase 05]: credentialLogin 리다이렉트 URL 로그의 토큰 평문 유출(T-05-17) — **Phase 05 내에서 해소됨** (커밋 `186042f`). `mask.ts` 에 snake_case URL 쿼리 파라미터 룰 추가, 회귀 테스트 5건. Phase 06/07 이관 불필요
- [Phase 05]: ApplyEngine 의 사다리 토큰 수용은 실제 신청 없이 shape 수준 근거로 사인오프 — 라이브 FIFO 이벤트에 대한 되돌릴 수 없는 행위라 검증 비용이 리스크를 초과. 잔여 리스크는 D-04 로 인수 (05-UAT.md test 5)
- [Phase 06]: R016: 로그인 방식 영속 설정을 1차 소스로 승격, env는 개발용 덮어쓰기로 강등 — add-alongside 시 사용자가 고른 값과 실제 동작이 말없이 어긋나는 상황을 방지하기 위함
- [Phase 06]: 설정 저장 실패 시 낙관적 갱신+롤백 대신 성공 후에만 상태 갱신하는 편도 방식 채택 — 탭 활성 표시가 props.loginMode에서만 파생되므로 별도 되돌리기 로직이 필요 없음(UI-SPEC E1 error)
- [Phase 06]: R020: mapLoginFailure() 순수 함수로 6개 실패 사유를 UI-SPEC 확정 문구로 고정 — 캡차 오진(D-13) 재발 방지 — 실패 안내가 auth-service 곳곳의 if로 흩어지면 새 사유 추가 시 누락되므로, exhaustive switch로 컴파일 타임 안전망을 걸었다
- [Phase 06]: identifier/logDetail 마스킹은 이 모듈이 하지 않고 호출부(06-05) 책임으로 명시 — 렌더러로 반환되는 필드는 로그 자동 마스킹 경로를 타지 않아, 계약을 파일 주석·prohibitions·06-05 태스크 3중으로 고정했다 (T-06-06, R010)
- [Phase 06]: [Phase 06] R020/R021과 ROADMAP Phase 06 SC2/SC3의 반증된 서술을 VOID 마킹 + 정정문 병기로 처리(D-11) — 삭제 대신 원문 보존 원칙 준수. SC1에는 D-03 의도적 편차(브라우저 모드 무인 자동 로그인 제거) 주석 추가로 verify 단계의 회귀 오판 예방
- [Phase 06]: R016/R020 확대 삭제(D-02): AuthService.submitOtp()/ApiAuthClient.verifyOtp() 및 부속을 CONTEXT 명시 목록 밖까지 삭제 — 사용자가 사전 확인 질문에 '플랜대로 전부 삭제'로 승인
- [Phase 06]: D-03: tryAutoLogin()/tryAutoRelogin() 게이트를 모드 조건에서 외부 로그인 요청 발생 조건으로 재정의, tryAutoRelogin()을 trySessionRestore()로 개명 — 브라우저 모드에도 무인 로그인 차단 확대(로드맵 SC1 의도적 편차)
- [Phase 06]: [Phase 06] classifyCredentialLoginSignal()로 캡차→OTP 오진(D-13) 수정 — DOM 신호 분류를 auth-service.ts 곳곳의 if 대신 단일 순수 함수로 고정
- [Phase 06]: [Phase 06] buildFailureResult()를 R010 마스킹의 단일 관문으로 신설 — CredentialLoginResult.identifier 필드 추가, 사다리 실패는 buildLadderFailureEvent()로 login-failed 이벤트 발행
- [Phase 06]: [Phase 06] 네이티브 <dialog>.showModal() 기반 차단형 고지 모달 신설 — 이 저장소 최초의 모달 컴포넌트, 확인/취소 경로를 물리적으로 분리해 Esc가 확인으로 오인되지 않게 함 — R021의 '확인해야만 진행' 요건은 비차단 표시로는 구조적으로 성립하지 않는다
- [Phase 06]: [Phase 06] login-panel-view.ts — LoginPanel 판단 로직 5개 순수 함수를 실제 모듈로 만들고 테스트가 이를 직접 import — 기존 복제본 테스트 관례에서 의도적으로 벗어남 — 복제본이 아니라 배포되는 코드를 검증하기 위함
- [Phase 06]: [Phase 06] phase 게이트(vitest 315/315 + typecheck×2 + build) green 확인, 06-VALIDATION.md 실제 상태로 갱신 완료
- [Phase 06]: [Phase 06] 수동 UAT 4항목(R016/R020/R021) 중 선택 영속(양방향)만 부분 확인 — API→재시작 방향은 06-01 tracer로 확인됨, 나머지(반대 방향·최초 고지 차단·환경변수 잠금·실패 안내)는 사용자 UAT 대기

### Pending Todos

None yet.

### Blockers/Concerns

- ⚠️ [Phase 05] **rung2(명시적 account→fanevent 토큰 교환) 미검증** — rung1(직접 사용)이 성립해 사다리가 조기 종료됐으므로 교환 경로는 한 번도 실행되지 않았다. rung1 이 깨지는 상황에서 폴백이 실제로 동작하는지는 미지수.
- ⚠️ [Phase 05] **ApplyEngine 의 사다리 토큰 수용이 행동 수준으로 미검증** — shape 수준 근거로 사인오프했다. D-04(로그인 방식 최종 결정)가 이 전제 위에 놓인다.
- ⚠️ [Phase 05] **운영 조치 미완:** 실계정 관측 당시 기록된 실토큰이 `~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log` 에 평문으로 남아 있다. T-05-17 수정은 소급 적용되지 않으므로 사용자가 직접 정리해야 한다.

*해소됨:* ~~R019 (account → we2_access_token 교환) 미검증~~ — 2026-08-25 실계정 1회 관측으로 rung1 성립 확인 (부분 해소, rung2 는 위에 잔존).

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-26T05:58:16.739Z
Stopped at: Completed 06-07-PLAN.md
Resume file: None
