# Milestones

## v0.3.0 로그인 방식 선택 (API / 브라우저) (Shipped: 2026-09-07)

**Phases completed:** 3 phases, 20 plans, 48 tasks

**Closeout:** override_closeout — 전 페이즈(05·06·07)가 `phase_complete: true` + verification `passed` 였으나, v0.3.0 요구사항 2건(R017/R018)이 충족되지 않은 채 out-of-scope 로 재분류돼 종료했다.

**Known verification overrides:** 0 newly acknowledged, 0 carried forward from a prior close

**Stats:** 14일 (2026-08-25 → 2026-09-07) · 커밋 157개(feat 31) · `src/` diff 39 파일 +6,485 / −352 · `src/` 12,188 LOC (TS/TSX) · 테스트 파일 22개 · 테스트 474개 green · 신규 외부 의존성 0건 · 보안 위협 74건 CLOSED(Phase 06 44 + Phase 07 30, 양쪽 `threats_open: 0`)

**Milestone audit:** 실행하지 않음 — R017/R018 의 미충족 사유가 외부 제약(reCAPTCHA 관문)으로 이미 확정돼 감사가 같은 결론을 반복할 뿐이라고 판단, 사용자 승인 하에 생략.

### Known Gaps

- **R017 API 자격증명 로그인(순수 HTTP 경로)** — out-of-scope 로 이동. 계약 자체는 2026-08-25 HAR 실측으로 확정됐다(`POST /v4/auth/token/by-credentials` 단독 호출, `otpSessionId` 는 reCAPTCHA Enterprise 토큰). 그러나 캡차 관문이 사람/브라우저 개입을 요구해 "브라우저 엔진 없이 순수 HTTP 인증" 이라는 요건 자체가 성립하지 않는다. 우회는 R013 으로 영구 제외. 동작하는 유일한 경로는 헤드리스 BrowserWindow 다.
- **R018 이메일 OTP 코드 입력 및 인증** — blocked → out-of-scope. HAR 실측 호출 0건으로 OTP 단계가 실제 로그인 흐름에 존재하지 않는다. 미구현이 아니라 대상 부재이며, Phase 06 D-02 가 관련 코드를 전량 삭제했다.
- **R019 rung2 미검증** — rung1(직접 사용)이 성립해 사다리가 조기 종료되면서 명시적 account→fanevent 토큰 교환 경로는 한 번도 실행되지 않았다. rung1 이 깨질 때 폴백이 실제로 동작하는지는 미지수.
- **렌더링 경로 자동 회귀망 부재** — `.tsx` 컴포넌트가 `vitest.config.ts` 의 include(`.test.ts` 만)에 잡히지 않는다. Phase 07 UAT 6항목이 전부 사람 확인 전용이 된 원인.
- **`saveCredentials()` 비원자적 쓰기** — 부분 쓰기는 손상 감지→삭제→재입력 경로로 수렴하지만(T-07-13/R-07-03 로 인수), 원자적 쓰기 도입은 미해결.
- **M001 이월 요구사항 3건** — R006(로그 패널)·R008(크로스플랫폼 빌드)·R010(로그 마스킹)이 traceability 표에 `active`/`unmapped` 로 남아 있다. PROJECT.md 서술상으로는 M001 에서 구현됐으나 표가 갱신되지 않았다. v0.3.0 스코프 밖이라 이번 종료에서 판정하지 않았다.
- **운영 조치 미완** — 실계정 관측 당시 로그(`~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log`)에 토큰 평문이 남아 있다. T-05-17 수정은 소급 적용되지 않아 사용자가 직접 정리해야 한다.

**Key accomplishments:**

- REQUIREMENTS.md/PROJECT.md/ROADMAP.md 세 문서가 더 이상 반증된 3단계 이메일 OTP 로그인 계약을 사실로 서술하지 않도록 정정하고, R018을 삭제 없이 blocked·매핑 해제 상태로 기록했다 — 05-01-SUMMARY.md의 HAR 실측 결과가 유일한 근거.
- 사용자가 1회 수행한 실계정 로그인 관측으로 `acquireFaneventToken()` 사다리의 rung1(직접 사용)이 계정 도메인 쿠키(`rt`, JWT, 451자)로 `/fans/me` 200 + `fanId=9415932`를 확보해 R019가 PASS로 검증됐다 — rung2(교환)는 실행 기회 없이 스킵됐고, 부수적으로 앱 로그에 access_token/refresh_token 원문이 마스킹되지 않고 남는 보안 결함이 발견돼(코드 미수정, Phase 06/07로 이관) 문서화됐다.
- 로그인 방식(loginMode)과 API-mode 고지 확인 상태를 `settings.json`에 원자적으로 영속화하고, 디스크→main→IPC→렌더러 탭까지 한 경로로 배선했으며, 저장 실패 시 탭 상태가 거짓말하지 않도록 편도(success-only) 갱신 방식을 적용했다.
- `mapLoginFailure()` 순수 함수 — 6개 실패 사유를 UI-SPEC 확정 한국어 안내로 고정하고, 캡차 오진(D-13)을 되돌리지 않도록 exhaustive switch 로 봉인
- 2026-08-25 HAR 실측으로 반증된 R020/R021 서술과 ROADMAP Phase 06 성공 기준 2·3을 VOID 마킹 + 정정문 병기로 처리하고, SC1의 의도적 편차(D-03)를 로드맵에 명시했다.
- D-01/D-02/D-03 을 각각 하나의 태스크로 집행 — 자격증명 로그인 진입점을 `credentialLogin()` 헤드리스 경로 하나로 확정하고, 05-01 이 반증한 3단계 계정 API 계약 코드를 전량 제거했으며, 무인 자동 로그인 가드를 "모드" 조건에서 "외부 로그인 요청 발생 여부" 조건으로 재정의해 브라우저 모드에도 확대 적용했다.
- `classifyCredentialLoginSignal()` 순수 분류 함수로 캡차→OTP 오진(D-13)을 근본적으로 고치고, `buildFailureResult()` 단일 관문으로 모든 실패 message/identifier가 `maskSensitive()`를 강제로 통과하게 배선했다 — 사다리 실패도 이제 `login-failed` 이벤트로 사용자에게 도달한다.
- 최초 API 모드 선택 시 뜨는 차단형 고지 모달을 네이티브 `<dialog>`로 신설하고, 환경변수 잠금 배지·API 모드 상시 안내·6개 실패 사유 한국어 안내를 모두 순수 판단 함수(`login-panel-view.ts`) 기반으로 `LoginPanel`에 배선했다 — 판단 로직 21개 테스트 전수 통과.
- phase 게이트 3종(vitest 315/315, typecheck×2, build)을 green으로 확인하고, 06-VALIDATION.md의 17개 검증 행·Wave 0 체크리스트·수동 검증 4항목 절차를 실제 상태로 채워 R016/R020/R021 shared-ID 게이트를 해제했다 — 수동 검증 자체는 사용자 UAT로 이관.
- 고지 확인 흐름이 `settings:set-login-mode` 쓰기 실패를 삼켜 모달을 "확인 완료"로 닫던 CR-01 을, 탭/모달 두 경로의 실패 계약을 소유하는 순수 액션 모듈 `login-mode-actions.ts` 로 구조적으로 제거했다 — 모달 경로는 이제 저장 함수를 prop 으로 받을 수조차 없다.
- 두 로그인 모드가 공유하는 `validateToken()`의 네 실패 지점이 서버 응답 원문(최대 200자)을 마스킹 없이 렌더러로 흘려보내던 정보 노출(CR-02)을, 서버 텍스트를 담을 수 없는 타입의 상태 코드 기반 확정 한국어 안내 모듈로 구조적으로 봉인했다 — 그리고 이 경로를 "자동으로 커버된다"고 잘못 선언했던 06-05-SUMMARY.md를 D-11 관례로 정정했다.
- gap 2 와 같은 뿌리를 가진 마스킹 관문 우회 경로 세 곳(문맥 없는 JWT 마스킹 한계, 7번째 미분류 실패 반환, 헤드리스 디버그 덤프의 이메일 평문)을 전부 닫아, `buildFailureResult()`가 유일한 마스킹 관문이라는 이 phase의 전제를 실제로 참으로 만들었다.
- JWT `exp` 로컬 계산 순수 모듈(`token-expiry.ts`) → `ApplyEngine.arm()` 즉시 판정·이벤트 발행 → `ApplyExecution` 대기 화면의 인라인 `role="alert"` 경고 배너 → "다시 로그인" 진입점까지 R022의 세로 슬라이스 한 줄기를 끝에서 끝까지 관통시켰다.
- 이메일 전용 마스킹 관문(`maskEmail()`) 신설, `credentials.enc` 4상태 정직한 계약(`getStoredCredentialsSnapshot()`), 저장 비밀번호 로그인의 main 프로세스 이메일 불일치 최종 게이트(`loginWithStoredCredentials()`), 중복 클릭 방지 in-flight 가드, 재로그인 실패 시 기존 토큰 복원(`restoreTokenIfLost()`)까지 R023 의 신뢰 경계를 코드로 고정했다.
- `apply-engine.ts` 의 대기 이전 토큰 캡처 결함(D-13)을 닫아 재로그인이 실제 POST에 반영되게 하고, `checkTokenExpiry()` 재판정 진입점(D-10)과 저장 자격증명/만료 재판정용 신규 IPC 채널 4종(D-01/D-06)을 열었으며, Phase 06 에서 이월된 WR-04/IN-01 을 함께 닫았다.
- `resolveStoredLoginState()` 순수 함수로 저장 자격증명의 4가지 화면 상태(없음/사용가능/손상/불가)를 이메일 일치 여부까지 포함해 단일 지점에서 판정하고, `LoginPanel.tsx`에 이메일 프리필·"저장된 비밀번호로 로그인" 보조 버튼·D-07 저장 상태문·로그인 여부와 무관한 삭제 버튼을 배선해 R023의 재입력 생략 UX를 완성했다.
- 대기 화면 재로그인 진입점(`handleReloginFromWaiting`)이 모드별 실제 로그인을 시작하고, 순수 함수 `decideAuthEventNavigation()`이 `apply-execution` 단계에서 명시적 로그아웃만 화면을 초기화하도록 판정해 armed 상태를 보호했으며, ROADMAP/REQUIREMENTS의 반증된 OTP 서술 3곳을 D-11(06) 절차로 정정했다.
- 브라우저 모드에서 `login-success` 인증 이벤트가 만료 재판정(`ApplyEngine.checkTokenExpiry()`)을 실제로 촉발하도록 `shouldRecheckTokenExpiry()` 순수 판정 함수와 단일 호출 지점을 배선하고, 재로그인 버튼에 로딩 잠금과 실패 사유 표시를 추가했다.
- Single-gate fix for credentialLogin()'s save-on-success asymmetry (WR-02) and finally-block symmetry fix for LoginPanel's stale corrupted-credentials notice (WR-03)

---
