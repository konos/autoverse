---
gsd_state_version: 1.0
milestone: v0.3.0
milestone_name: 로그인 방식 선택 (API / 브라우저)
status: Awaiting next milestone
stopped_at: Phase 07 complete — all phases complete
last_updated: "2026-09-07T04:15:00.641Z"
last_activity: 2026-09-07
last_activity_desc: Milestone v0.3.0 completed and archived
state_head: 492642adf8816cdc1a1a5f3519900340ba1ec2ba
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 20
  completed_plans: 20
  percent: 100
current_phase: 07
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-07)

**Core value:** 서버 시간 보정 + RTT 반영으로 선착순 이벤트 신청 POST가 정시에 서버에 도착하는 것.
**Current focus:** v0.3.0 마일스톤 종료 처리 — `/gsd-complete-milestone`

## Current Position

Phase: Milestone v0.3.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-09-07 — Milestone v0.3.0 completed and archived

## Performance Metrics

**Velocity:**

- Total plans completed: 20 (v0.3.0 기준)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-04 (M001-ksbtje) | — | — | — |
| 05-07 (v0.3.0) | 0 | 0 | — |
| 05 | 3 | - | - |
| 06 | 10 | - | - |
| 07 | 7 | - | - |

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
| Phase 06-ui P08 | 15min | 3 tasks | 6 files |
| Phase 06-ui P09 | 7min | 3 tasks | 5 files |
| Phase 06 P10 | 3min | 2 tasks | 4 files |
| Phase 07 P01 | 15 min | 2 tasks | 9 files |
| Phase 07 P02 | ~20min | 3 tasks | 5 files |
| Phase 07 P03 | ~25min | 3 tasks | 7 files |
| Phase 07 P04 | ~15min | 2 tasks | 3 files |
| Phase 07 P05 | ~20min | 2 tasks | 5 files |
| Phase 07-api P06 | 6min | 3 tasks | 5 files |
| Phase 07 P07 | 12min | 2 tasks | 3 files |

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
- [Phase 06-ui]: [Phase 06 P08] CR-01 gap closure: 검증자 제안(strict setter 병렬 추가) 대신 모달 경로에서 로그인 방식 저장 함수 prop 자체를 제거 — createLoginModeActions()가 확인 흐름 전체(확인 저장→모드 저장→성패 판정)를 소유하고 LoginPanel은 반환값(AcknowledgeOutcome)만으로 분기, 재발 형태를 타입 수준에서 차단
- [Phase 06-ui]: [Phase 06 P08] WR-01(저장 중 Esc 경합)을 gap 1과 같은 플랜에서 함께 해소 — decideNoticeCancel(saving) 순수 함수로 Cancel 버튼과 네이티브 Esc를 단일 판단 지점에 통합. IN-03은 onDiagnostic JSDoc 문서화로만, IN-04는 06-VALIDATION.md Manual-Only #2 UAT로 이관(DEFER)
- [Phase 06]: [Phase 06-ui] [06-09] CR-02 gap closure: validateToken() 4개 실패 emit을 describeTokenValidationFailure() + emitTokenValidationFailure() 단일 관문으로 재배선 — 서버 텍스트를 담을 수 없는 타입(context: {status?:number})으로 구조적 봉인, maskSensitive() 감싸기(A안)는 SENSITIVE_PATTERNS가 key=value 문맥에만 의존해 보장하지 못하므로 기각
- [Phase 06]: [Phase 06-ui] [06-09] 06-05-SUMMARY.md의 반증된 완료 선언(공유 경로가 '자동으로 혜택을 받는다')을 D-11 관례로 정정 — 원문 보존 + [VOID] + 정정문, phase 06 이전(커밋 816970a)부터 있던 코드임을 명시
- [Phase 06]: 06-10: SENSITIVE_PATTERNS에 문맥 무관 JWT 형태 2차 방어선 규칙 추가 — 06-REVIEW WR-02 Fix 제안(각 분절 10자 이상)을 채택하고 실제 계정 API 도메인/진단 로그로 역산 검증
- [Phase 06]: 06-10: buildFailureResult()에 overrideMessage 4번째 선택 파라미터 추가 — btnEnabled 실패(WR-03)가 확정 문구를 유지한 채 마스킹 관문을 지나도록 재배선, 기존 5개 호출부는 후방 호환으로 무변경
- [Phase 06]: 06-10: 헤드리스 디버그 덤프의 emailValue(이메일 원문)를 emailLen(길이)으로 교체(IN-02) — 06-REVIEW.md WR-02/WR-03/IN-02 전부 해소, phase 06의 10개 리뷰 발견 전부 처리 완료
- [Phase 07]: [Phase 07-01] arm() 만료 판정은 syncTime() 재호출 없이 schema.applyPeriod.startAt 로컬 시각을 그대로 예정 시각으로 사용 — D-08 외부 호출 0 유지, arm() 시점엔 syncResult 가 아직 없음
- [Phase 07]: [Phase 07-01] RELOGIN_HEADROOM_MS=180_000(3분) 단일 상수 — 헤드리스 로그인 폼 로드 15초+응답 대기 25초+캡차 시 사람 개입 여유를 흡수, 호출부 리터럴 재사용 금지
- [Phase 07]: [Phase 07-01] 이 플랜의 재로그인 진입점은 기존 브라우저 로그인(handleLogin)만 배선 — API 모드 저장 자격증명 재로그인·재로그인 중 초기화 억제는 07-05로 이연
- [Phase 07]: [Phase 07] maskEmail() 단일 관문 신설 + SENSITIVE_PATTERNS email 규칙(JWT 구조 규칙 앞) — IN-02 가 지적한 이메일 마스킹 공백을 닫음(D-07/R010)
- [Phase 07]: [Phase 07] getStoredCredentialsSnapshot()/loginWithStoredCredentials() 신설 — credentials.enc 4상태 계약(D-04)과 main 프로세스 이메일 불일치 최종 게이트(D-01/D-03)를 코드로 고정, StoredCredentialsSnapshot 타입에 password 필드 없음
- [Phase 07]: [Phase 07] credentialLoginInFlight 가드(T-07-09) + restoreTokenIfLost()(D-14) — 연속 클릭의 중복 헤드리스 로그인 차단과 재로그인 실패 시 기존 토큰 보존을 credentialLogin() 에 배선
- [Phase 07]: [Phase 07] execute()의 대기 이후 토큰 재조회(D-13) — freshToken을 waitUntilSubmitTime() 직후 재조회해 submitApplication/tokenPreview/_pollStatus 전부에 반영, syncTime(token)만 실행 시작 시점 토큰 유지
- [Phase 07]: [Phase 07] ApplyEngine.checkTokenExpiry() — arm()과 _evaluateCurrentTokenExpiry()를 공유하는 D-10 재판정 진입점, phase/postSubmitted 불변
- [Phase 07]: [Phase 07] 신규 IPC 채널 4종(auth:get-stored-credentials/credential-login-stored/clear-credentials, apply:check-token-expiry) handler+preload+타입+cleanup 4점 대칭 — credentialLoginStored는 email 단일 인자(D-01)
- [Phase 07]: [Phase 07] WR-04/IN-01 이월 항목 폐쇄 — SettingsStore.setLoginMode() 저장 진입점 런타임 검증, readSettings() 읽기/파싱 원인 분리 로그
- [Phase 07]: [Phase 07] resolveStoredLoginState() 순수 함수로 저장 자격증명 4상태 x 이메일 일치 여부 화면 판단을 단일 지점에 고정 — corrupted/unavailable 삭제 버튼 노출 여부를 구조적으로 구분(D-04/D-06)
- [Phase 07]: [Phase 07] LoginPanel.tsx의 '로그아웃 + 자격 증명 삭제' 버튼을 제거하고 삭제 통제권을 로그인 여부와 무관한 D-07 상태문 자리로 통합 — 두 버튼이 겹치는 상태를 남기지 않음(D-06)
- [Phase 07]: [Phase 07] onAuthEvent 구독이 마운트 1회성 useEffect([]) 안이라 step 클로저가 스테일한 문제를 발견 — decideAuthEventNavigation()에 stepRef.current(useRef+동기화 useEffect)를 넘기도록 수정하지 않으면 apply-execution 판정이 실전에서 절대 참이 되지 않아 Pitfall 3 해소가 무효화됨(Rule 1 자동수정)
- [Phase 07]: [Phase 07] handleReloginFromWaiting()의 API 모드 저장 자격증명 상태별 안내 문구는 07-04(resolveStoredLoginState)의 corrupted/unavailable 문구를 재사용하고, 대기 화면에만 있는 none 케이스만 새로 작성
- [Phase 07]: [Phase 07] ROADMAP SC1/REQUIREMENTS R022·R023 Why it matters의 반증된 OTP 서술을 D-11(06) 절차로 정정(VOID+정정문, 원문 보존) — R022 정정문에 D-03(06) 부수효과로 적용범위가 두 모드 전체로 확대됐음을 명시
- [Phase 07-api]: 07-06: shouldRecheckTokenExpiry() 순수 판정 함수를 App.tsx onAuthEvent 안 단일 지점에 배선해 CR-01(재로그인 완료 후 배너가 안 갱신되는 문제)을 닫음 — AuthService.login() 계약 변경(방향 1) 대신 이벤트 재판정(방향 2, G-01)을 채택
- [Phase 07-api]: 07-06: WR-01 재로그인 버튼 잠금은 새 state 없이 기존 loginLoading 을 reloginLoading prop 으로 재사용(G-03); credentialLoginStored() 실패 반환값은 기존 buildFailureView() 로 라우팅해 화면에 표시
- [Phase 07]: G-04: WR-02 closed via a single completeCredentialLoginSuccess() gate (save+cleanup+result) both credentialLogin() success branches funnel through, instead of a one-line saveCredentials() patch on the timeout branch — matches this repo's single-gate precedent (buildFailureResult()/_evaluateCurrentTokenExpiry()/createLoginModeActions()) so a future third success path cannot bypass credential storage.
- [Phase 07]: G-05: WR-03 closed as a one-line finally-block symmetry fix (refreshStoredSnapshot()) in LoginPanel.tsx's handleCredentialLogin(), matching handleStoredLogin() — no new state or pure function, since resolveStoredLoginState() already covers 26 cases.

### Pending Todos

None yet.

### Blockers/Concerns

- ⚠️ [Phase 05] **rung2(명시적 account→fanevent 토큰 교환) 미검증** — rung1(직접 사용)이 성립해 사다리가 조기 종료됐으므로 교환 경로는 한 번도 실행되지 않았다. rung1 이 깨지는 상황에서 폴백이 실제로 동작하는지는 미지수.
- ⚠️ [Phase 05] **ApplyEngine 의 사다리 토큰 수용이 행동 수준으로 미검증** — shape 수준 근거로 사인오프했다. D-04(로그인 방식 최종 결정)가 이 전제 위에 놓인다.
- ⚠️ [Phase 05] **운영 조치 미완:** 실계정 관측 당시 기록된 실토큰이 `~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log` 에 평문으로 남아 있다. T-05-17 수정은 소급 적용되지 않으므로 사용자가 직접 정리해야 한다.

- [Phase 06] **문서 결함:** `06-VALIDATION.md` / `06-07-PLAN.md` 의 수동 검증 지시문이 존재하지 않는 `npm run dev` 를 가리킨다(실제 명령 `npm start`). UAT Test 9 에서 발견, 사용자 판단으로 pass 처리하고 문구 정정은 후속 작업으로 남겼다.

- ⚠️ [Phase 07] **UAT 6항목 전부가 사람 확인 전용** — `.tsx` 렌더러 컴포넌트가 `vitest.config.ts` 의 include(`.test.ts` 만)에 잡히지 않아 렌더링 경로에 자동 회귀망이 없다. include 확장 + 렌더링 테스트 도입은 별도 항목.
- ⚠️ [Phase 07] **T-07-13 인수:** `saveCredentials()` 가 원자적 쓰기(tmp+rename)를 쓰지 않는다. 부분 쓰기는 손상 감지→삭제→재입력 경로로 수렴하지만, 원자적 쓰기 도입은 미해결 항목으로 남는다 (R-07-03).
- ⚠️ [Phase 07] **UAT Test 5 는 정상 경로 확인일 가능성** — timeout→쿠키 느린 경로는 재현이 어려워, 통과가 그 경로 자체의 실증인지 정상 경로 확인인지 구분되지 않는다. 07-07 의 코드·테스트 수준 봉인이 1차 근거다.

*해소됨:* ~~R019 (account → we2_access_token 교환) 미검증~~ — 2026-08-25 실계정 1회 관측으로 rung1 성립 확인 (부분 해소, rung2 는 위에 잔존).
*해소됨:* ~~[Phase 06] 리뷰 이월 2건(WR-04/IN-01) → Phase 07~~ — 07-03 에서 폐쇄. `SettingsStore.setLoginMode()` 가 저장 진입점에서 값 검증 후 위반 시 throw(T-07-05 CLOSED).

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-28T08:48:14.700Z
Stopped at: Phase 07 complete — all phases complete
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
