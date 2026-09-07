# Autoverse

## What This Is

Weverse 팬이벤트 선착순(FIFO) 신청을 자동화하는 Electron 데스크탑 앱. 본인 단일 계정으로 서버 시간 동기화 후 정시에 POST가 도착하도록 정밀 타이밍 신청을 수행한다. 특정 소수 고객(팬)에게 제공하며 Windows/macOS 크로스플랫폼으로 배포한다. **M001-ksbtje MVP 완성 — 2026-05-13.**

## Core Value

서버 시간 보정 + RTT 반영으로 선착순 이벤트 신청 POST가 정시에 서버에 도착하는 것. 이것이 수동 신청 대비 핵심 차별점이다.

## Project Shape

- **Complexity:** complex
- **Why:** Electron 크로스플랫폼 빌드, 웹 세션 쿠키 추출, 서버 시간 동기화 + RTT 보정, 암호화 프로필 저장, 동적 applyHost 대응 등 여러 기술 영역이 교차한다.

## Current State

**M001-ksbtje 완료 (2026-05-13), 이후 v0.2.0에서 로그인을 헤드리스 방식으로 전환.** 4개 슬라이스 전부 complete, 163개 단위 테스트 통과, tsc 오류 0, macOS .dmg 95MB + Windows .exe 84MB 아티팩트 생성 완료.

**v0.3.0 전체 phase 완료 (2026-09-07)** — 클라이언트 요청으로 로그인 방식(API 통신 / 브라우저) 선택 기능 추가. Phase 05(R019 사다리 검증) · Phase 06(로그인 방식 선택 UI + 실패 안내) · Phase 07(자격증명 저장 + 토큰 만료 사전 경고) 전부 완료. 마일스톤 종료 처리(`/gsd-complete-milestone`)만 남았다. **Phase 07 종료 시점 (2026-09-07):** 플랜 7/7 실행(트레이서 + 웨이브 4단계 5개 + gap closure 2개), 테스트 474개 green, typecheck 2종 green, 신규 의존성 0건, UAT 6/6 통과, 보안 위협 30건 전부 CLOSED(`threats_open: 0`, accept 6건은 R-07-01~06 으로 기록).

## Current Milestone: v0.3.0 로그인 방식 선택 (API / 브라우저)

**Goal:** 사용자가 로그인 방식을 API 통신과 브라우저 중 선택할 수 있게 하고, 각 방식의 제약을 앱이 명확히 안내한다.

**Target features:**
- ~~API 로그인 경로 신규 구현 — `otp-sessions` → `by-credentials` → `by-credentials-with-otp` 3단계~~ **[VOID 2026-08-25]** HAR 실측상 3단계 순서는 존재하지 않는다 (아래 계약 표 참조). 실제 경로는 `by-credentials` 단독 호출이며 reCAPTCHA Enterprise 토큰이 필수 입력이다
- ~~이메일 OTP 입력 흐름 — API 모드는 매 로그인마다 OTP 필수~~ **[VOID 2026-08-25]** HAR 호출 0건 — OTP 단계 자체가 실제 로그인 흐름에 없다 (R018 보류). 근거: `.planning/phases/05-api/05-01-SUMMARY.md`
- 토큰 교환 — account 토큰(`wa_access_token`) → 팬이벤트용 `we2_access_token`
- ✓ 방식 선택 UI — 브라우저 모드 기본값, API는 선택 옵션 **(Phase 06 완료)** — 차단형 고지 모달 · 환경변수 잠금 배지 · 6개 실패 사유 한국어 안내 포함
- ✓ 토큰 만료 사전 경고 — 신청 시각 전 토큰 수명 체크 후 재로그인 유도 **(Phase 07 완료)** — `arm()` 즉시 판정 + 대기 화면 인라인 경고 · 대기 중 재로그인 · 재로그인 완료 시 자동 재판정
- ✓ API 모드 자격증명 암호화 저장 — safeStorage 저장 + 이메일 프리필 + 저장 비밀번호 로그인 **(Phase 07 완료)** — 평문 비밀번호는 IPC·렌더러·React state 어디에도 존재하지 않는다(D-01)

**계정 API 계약 (2026-08-25 HAR 실측으로 정정):**

| 항목 | 값 |
|---|---|
| Base URL | `https://accountapi.weverse.io/web/api` |
| 세션 생성 | 실제 웹 클라이언트 로그인 흐름에 등장하지 않음(HAR 호출 0건) — R018 보류 |
| 로그인 | `POST /v4/auth/token/by-credentials` **단독 호출** — body `{email, password, otpSessionId}` (`otpSessionId` = reCAPTCHA Enterprise 토큰(실측 2489자) — OTP 세션 식별자가 아니다) |
| OTP 로그인 | 실제 웹 클라이언트 로그인 흐름에 등장하지 않음(HAR 호출 0건) — R018 보류 |
| 필수 헤더 | `X-ACC-APP-VERSION: 4.7.1`, `X-ACC-APP-SECRET`, `X-ACC-SERVICE-ID: weverse`, `X-ACC-LANGUAGE`, `X-ACC-TRACE-ID` |
| 비밀번호 | 평문 전송 (TLS 위) — 클라이언트 측 RSA/암호화 없음 |
| reCAPTCHA | reCAPTCHA Enterprise — 자격증명 로그인 요청 자체의 필수 입력. 순수 HTTP 로는 채울 수 없다 |

**핵심 제약 (2026-08-25 HAR 실측으로 정정):** 순수 HTTP 로그인은 reCAPTCHA 관문에서 막힌다 — `-25044`는 "이메일 OTP 인증 필요"가 아니라 **캡차 토큰 없음/무효** 신호였다. 캡차 우회는 R013 으로 영구 제외이므로, 현재 동작하는 유일한 로그인 경로는 실제 로그인 페이지를 띄우는 헤드리스 BrowserWindow 다. 근거: `.planning/phases/05-api/05-01-SUMMARY.md`.

## Architecture / Key Patterns

- **스택:** Electron + TypeScript + React (Vite 빌드)
- **인증:** Electron BrowserWindow(v0.2.0부터 `show: false` 헤드리스)로 weverse.io 로그인 → `session.cookies.get()`으로 `we2_access_token` 추출. `.weverse.io` / `weverse.io` 두 도메인 변형 모두 시도. 쿠키는 `persist:weverse` 파티션에 격리.
- **프로필 저장:** Electron `safeStorage` API로 OS 수준 암호화 후 앱 데이터 폴더에 저장. 복호화 실패 시 손상 파일 자동 삭제.
- **HTTP:** Node.js 내장 fetch. ApplyEngine은 WeverseApi + TimingService를 생성자 DI로 주입받음.
- **시간 동기화:** 서버 `Date` 헤더 파싱 → 오프셋 계산 → RTT/2 보정(localMidMs = t0 + rttMs/2) → `startAt` 정시 도착
- **안전 가드:** postFired 플래그(POST 1회 보장) + isTimeGuardPassed()(startAt-50ms 차단) 이중 가드
- **로그:** LogService(EventEmitter 싱글톤) + maskSensitive 7종 마스킹 + LogPanel 실시간 UI + logs/YYYY-MM-DD.log 일별 파일
- **IPC:** auth:*, profile:*, apply:*, log:* 4개 네임스페이스로 main↔renderer 분리
- **빌드:** `electron-builder`로 macOS .dmg(arm64, 95MB) + Windows NSIS .exe(arm64, 84MB)

## Requirements

전체 계약과 커버리지 매핑은 `.planning/REQUIREMENTS.md`가 정본이다. 아래는 요약이다.

### Validated

- ✓ R001 앱 내 Weverse 로그인 및 쿠키 자동 추출 — M001/S01
- ✓ R002 이벤트 폼 스키마 조회 및 파싱 — M001/S02
- ✓ R003 서버 시간 동기화 + RTT 보정 정밀 타이밍 POST — M001/S02
- ✓ R004 신청 결과 폴링 (REQUESTED → COMPLETED) — M001/S02
- ✓ R005 신청 프로필 암호화 저장 및 재사용 — M001/S01
- ✓ R007 안전 가드 (시간 가드, 재시도 금지, 단일 계정, 로그 마스킹) — M001/S02
- ✓ R009 약관 동의 명시적 사용자 확인 — M001/S02
- ✓ R019 account 토큰 → 팬이벤트 토큰 교환 — v0.3.0 / Phase 05 (실계정 1회 관측: rung1 직접 사용이 계정 도메인 쿠키로 `/fans/me` 200+fanId 확보. **rung2(명시적 교환)는 미실행으로 여전히 미검증**)
- ✓ R016 로그인 방식 선택 (API 통신 / 브라우저) — v0.3.0 / Phase 06 (`settings.json` 영속 + `AUTOVERSE_LOGIN_MODE` 잠금, UAT Test 1·4·7 실행 확인)
- ✓ R020 API 로그인 실패 사유 한국어 안내 — v0.3.0 / Phase 06 (`mapLoginFailure()` 6개 신호 전수 매핑, UAT Test 8 실행 확인)
- ✓ R021 API 모드 제약 사전 고지 — v0.3.0 / Phase 06 (차단형 `<dialog>` 고지 모달, UAT Test 1·2·3 실행 확인)
- ✓ R022 신청 시각 전 토큰 수명 체크 및 재로그인 유도 — v0.3.0 / Phase 07 (`token-expiry.ts` 순수 판정 + `arm()` 즉시 경고 + 대기 중 재로그인 + `shouldRecheckTokenExpiry()` 재판정 seam, UAT Test 1·3·4 실행 확인)
- ✓ R023 API 모드 자격증명 암호화 저장 — v0.3.0 / Phase 07 (safeStorage 저장 + `credentials.enc` 4상태 읽기 + 이메일 불일치 메인 게이트, UAT Test 2·5·6 실행 확인)

### Active

- [ ] R006 실시간 동작 로그 패널 + 로그 파일 다운로드
- [ ] R008 Windows .exe + macOS .dmg 크로스플랫폼 빌드 배포
- [ ] R010 개인정보 로그 마스킹
- [ ] R017 API 자격증명 로그인 (실측 계약 — `by-credentials` 단독 + reCAPTCHA) — v0.3.0
- [ ] R018 이메일 OTP 코드 입력 및 인증 — **보류 (blocked, Phase 매핑 해제)** — HAR 상 OTP 단계 부재로 미입증

### Out of Scope

- R011 추첨형(DRAW) 이벤트 지원 — 선착순(FIFO) 전용 프로젝트
- R012 다계정/타인 명의 자동 신청 — anti-feature. 약관 위반 및 형평성 문제. **클라이언트가 v0.4.0으로 요청한 항목이므로 진행 시 이 결정을 명시적으로 재검토해야 함**
- R013 캡차 우회 — anti-feature. 약관 위반. 영구 제외
- R014 라이선스/배포 제한 — 스코프 축소를 위해 제외
- R015 토큰 자체 갱신 — 갱신 엔드포인트 미캡처. 재로그인 안내로 대체 (R022가 이를 구현)

## Milestone Sequence

- [x] M001-ksbtje: Weverse 팬이벤트 선착순 신청 자동화 앱 — 로그인, 신청 엔진, 로그 시스템, 크로스플랫폼 빌드까지 전체 MVP — **완료 2026-05-13**
- [ ] v0.3.0: 로그인 방식 선택 (API 통신 / 브라우저) — **진행 중**

## Out of Scope

- **다계정 동시 신청** — 별도 마일스톤(v0.4.0 후보)으로 분리. 저장소·세션·엔진 전반의 다중화가 필요해 스코프가 독립적이며, 같은 IP에서 동시 신청 시 플랫폼 제재 리스크를 클라이언트가 먼저 확인해야 한다.
- **reCAPTCHA 우회** — 계정 정지 및 법적 리스크. 영구 제외. **(2026-08-25 정정)** 우회 대상이 아니라 명시적으로 안내할 제약은 'OTP 강제'가 아니라 **reCAPTCHA 관문 자체**다 — 순수 HTTP 로그인이 불가능한 근본 원인이며, 그래서 헤드리스 BrowserWindow 가 유일한 경로다.
- **API 모드 자동 재로그인** — **(2026-08-25 정정)** 불가 사유는 OTP 가 아니라 reCAPTCHA 다. 캡차가 사람/브라우저 개입을 요구하므로 무인 재로그인은 여전히 불가능하며, 결론(사전 경고로 대체)은 그대로 유지된다.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 브라우저 모드를 기본값으로 유지 | ~~API 모드는 매 로그인 OTP가 강제되어~~ **(2026-08-25 근거 정정)** API 모드는 매 로그인 reCAPTCHA 관문에 막혀 무인 실행이 불가능하다 — 결론은 유지, 사유가 바뀌었다 | ✓ Good (근거 강화) |
| API 모드 토큰 만료는 사전 경고로 대응 | 자동 재로그인이 불가능하므로, 이벤트를 놓치기 전에 사용자가 개입할 시간을 준다 | ✓ Good — Phase 07 에서 R022 로 구현·검증 완료 |
| 로그인 API를 리버싱해 직접 호출 | 번들 분석 + 실서버 프로브로 계약을 검증함 (2026-08-25) | ⚠️ 부분 무효 — 번들 분석만으로는 `otpSessionId` 가 캡차 토큰임을 구분하지 못했다. HAR 실측이 계약을 정정 (05-01-SUMMARY.md) |
| [Phase 05] 반증된 계약을 삭제 대신 VOID 마킹으로 보존 | 틀린 전제가 코드보다 넓게 전파된다는 것을 05-01 이 실증했다 — 왜 틀렸는지를 남겨야 재발을 막는다 | ✓ Good |
| [Phase 05] R019 는 1회 실계정 관측으로 판정 | 반복 가능한 자동 테스트로는 얻을 수 없는 신호이며, 반복 로그인은 계정 리스크를 키운다 | ✓ Good — rung1 성립 확인 |
| [Phase 05] ApplyEngine 의 사다리 토큰 수용은 shape 수준 근거로 사인오프 | 실제 신청 시도는 라이브 FIFO 이벤트에 대한 되돌릴 수 없는 행위라 검증 비용이 리스크를 초과한다 | ⚠️ 잔여 리스크 — D-04 로 인수 |
| [Phase 06] D-03: 무인 자동 로그인 차단을 브라우저 모드까지 확대 | 게이트 조건을 *모드*에서 *"외부에 로그인 요청을 발생시키는가"*로 재정의했다. 05-01 에서 모드 게이트 누락으로 저장된 타 계정에 헤드리스 로그인이 시도돼 실제 알림 메일이 발송된 사고가 근거다. ROADMAP Phase 06 SC1 의 의도적 편차 | ✓ Good — 쿠키 세션 복원은 유지해 재시작 경험 손실 없음 |
| [Phase 06] D-02: 반증된 3단계 계정 API 로그인 코드를 주석 처리 대신 전면 삭제 | 반증된 경로가 코드에 남으면 재배선된다(T-06-13). 사용자가 확대 삭제를 명시 승인 | ✓ Good — 잔존 실행 경로 0건, typecheck 로 컴파일 타임 검출 |
| [Phase 06] R021 고지를 비차단 배너가 아닌 네이티브 `<dialog>.showModal()` 차단형 모달로 구현 | "확인해야만 진행"이라는 요건은 비차단 표시로는 구조적으로 성립하지 않는다. 확인/취소 경로를 물리적으로 분리해 Esc 가 확인으로 오인되지 않게 한다 | ✓ Good — UAT Test 1·2·3 실행 확인 |
| [Phase 06] 마스킹을 main 프로세스 단일 관문(`buildFailureResult()`/`_emit()`)으로 집중 | 렌더러가 재가공하면 이중 지점이 생겨 어느 쪽이 진실인지 모호해진다. 렌더러의 `maskSensitive` 호출 0건을 grep 게이트로 강제 | ✓ Good — T-06-06/17/24/34/35 CLOSED |
| [Phase 06] CR-02 처치로 `maskSensitive()` 감싸기(A안) 대신 구조적 제거(B안) 채택 | `SENSITIVE_PATTERNS` 가 `key: value` 문맥에 의존해, 키 접두사 없는 토큰 문자열은 감싸도 통과한다. 서버 텍스트를 담을 수 없는 타입으로 봉인하는 편이 보장이 강하다 | ✓ Good — 문맥 무관 JWT 규칙을 2차 방어선으로 추가(06-10) |
| [Phase 07] D-01: 비밀번호를 IPC 경계 너머로 절대 보내지 않음 — 이메일만 프리필 | 저장 비밀번호를 input 칸에 되채우면 렌더러 메모리·DevTools·스크린샷에 평문이 상주한다. "재입력 없이 로그인"이라는 사용자 체감은 IPC 인자를 이메일 하나로 두고 메인이 복호화·전송하는 것으로 충족된다 | ✓ Good — `StoredCredentialsSnapshot`/`CredentialLoginResult` 어디에도 password 필드가 없어 타입 수준에서 강제됨(T-07-01/27 CLOSED) |
| [Phase 07] D-03: 저장 자격증명 이메일 일치 판정을 렌더러 `disabled` 가 아닌 메인 게이트로 | 05-01 에서 렌더러 게이트 누락으로 타 계정에 헤드리스 로그인이 시도돼 실제 알림 메일이 발송된 사고가 근거다. 렌더러 비활성화는 안내이지 관문이 아니다 | ✓ Good — `auth-service.ts` 가 trim+lowercase 정규화 비교 후 불일치 시 `credentialLogin()` 을 호출하지 않음(T-07-02 CLOSED) |
| [Phase 07] D-11: `exp` 판독 실패를 "만료 아님"으로 흡수하지 않고 `unknown` 3번째 상태로 노출 | 기존 `isTokenExpired()` 의 "assuming not expired" 폴백을 복제하면 판독 실패가 조용한 거짓 안심이 된다. 선착순 이벤트에서는 그 침묵이 실질 피해다 | ✓ Good — `parseJwtExpMs()` 가 모든 실패 경로에서 `null` 반환, 폴백 미복제(T-07-08 CLOSED) |
| [Phase 07] D-13: 대기 종료 직후 토큰을 재조회해 POST 에 신선한 값을 사용 | 대기 진입 시점에 캡처한 토큰을 그대로 쓰면 "경고를 보고 재로그인했는데 그 결과가 POST 에 반영되지 않는" 상태가 된다 — R022 전체가 경고만 뜨고 아무것도 구하지 못하는 기능이 되어버린다 | ✓ Good — `freshToken` 이 POST/폴링/이벤트 프리뷰 전부에 사용됨(T-07-06 CLOSED) |
| [Phase 07] D-12: 만료 경고가 떠 있어도 신청 실행을 막지 않음 | 경고는 정보이지 차단이 아니다. 만료 판정이 틀렸을 때 사용자가 신청 자체를 못 하게 되는 것이 만료된 토큰으로 실패하는 것보다 나쁘다 | ✓ Good — UAT Test 1·4 에서 경고·버튼 잠금 중에도 신청 실행 버튼 동작 확인 |
| [Phase 07] 05-05: `stepRef(useRef)` 도입 — 계획에 없던 스테일 클로저 결함을 Rule 1 로 자동 수정 | `onAuthEvent` 구독이 마운트 1회성 `useEffect([])` 안에 있어 `step` 이 영구히 `"login"` 으로 고정돼 있었다. 고치지 않으면 `apply-execution` 판정 경로가 한 번도 참이 되지 않아 Pitfall 3 방어가 코드상으로만 존재하게 된다 | ✓ Good — 계획 밖이지만 정확성에 직결. 이런 결함은 리뷰가 아니라 실행 중에만 드러난다 |
| [Phase 07] G-04: WR-02 를 timeout 분기 한 줄 추가가 아닌 단일 성공 관문 수렴으로 폐쇄 | 한 줄 추가는 세 번째 성공 경로가 생기면 같은 누락이 재발한다. 관문으로 수렴하면 `{ success: true }` 를 자격증명 저장 없이 구성할 수 없다 | ✓ Good — 저장소의 기존 단일 관문 패턴(`buildFailureResult()`, `_evaluateCurrentTokenExpiry()`)과 일치 |
| [Phase 07] CR-01 은 코드·테스트로 닫고 UAT 는 실계정 최종 확인으로만 운용 | 재로그인 성공 시 경고 해제는 07-06 이 계층 관통 회귀 테스트(실패 대조군 포함)로 봉인했다. UAT 를 결함 재확인 절차로 다시 쓰면 자동 테스트가 이미 준 신호를 사람이 반복하는 비용만 남는다 | ✓ Good — UAT Test 3 시나리오 ④ 통과로 최종 확인 |

## Known Limitations (Post-M001)

- 코드 서명 미적용 — macOS Gatekeeper / Windows SmartScreen 경고 발생. 퍼블릭 배포 시 Apple Developer ID 공증 + Microsoft Authenticode 인증서 필요.
- arm64 단일 아키텍처 — x64 사용자를 위한 universal binary / x64 exe 미지원.
- 자동 업데이트 미구현 — 신버전 시 수동 재설치 필요.
- 로그 파일 로테이션 미구현 — 장기 운영 시 디스크 사용량 증가 가능성.
- Electron 런타임 종단 E2E 미수행 — 실제 이벤트 환경에서의 검증 예정.
- `06-VALIDATION.md` / `06-07-PLAN.md` 의 수동 검증 지시문이 존재하지 않는 `npm run dev` 스크립트를 가리킨다 (실제 명령은 `npm start`). Phase 06 UAT Test 9 에서 발견, 문구 정정은 후속 작업.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-07 after Phase 07*
