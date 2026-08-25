# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R006 — 실시간 동작 로그 패널 + 로그 파일 다운로드

- Class: failure-visibility
- Status: active
- Description: 실시간 동작 로그 패널 + 로그 파일 다운로드
- Why it matters: 고객이 문제 발생 시 로그 파일을 전달하여 원격 디버깅 가능하게 함.
- Source: user
- Primary owning slice: M001-ksbtje/S03
- Supporting slices: M001-ksbtje/S01, M001-ksbtje/S02
- Validation: unmapped
- Notes: 요청/응답 상태코드, 타이밍, 에러 메시지 포함. 개인정보는 마스킹.

### R008 — Windows .exe + macOS .dmg 크로스플랫폼 빌드 배포

- Class: launchability
- Status: active
- Description: Windows .exe + macOS .dmg 크로스플랫폼 빌드 배포
- Why it matters: 비기술 사용자가 설치 파일로 간단히 설치할 수 있어야 함.
- Source: user
- Primary owning slice: M001-ksbtje/S04
- Validation: unmapped
- Notes: electron-builder. 양쪽 OS에서 설치/실행 확인 필수.

### R010 — 개인정보 로그 마스킹

- Class: compliance/security
- Status: active
- Description: 개인정보 로그 마스킹
- Why it matters: 로그 파일이 제3자에게 전달될 수 있으므로 개인정보 노출 방지.
- Source: user
- Primary owning slice: M001-ksbtje/S03
- Validation: unmapped
- Notes: 마스킹 대상: Authorization, applyToken, phoneNumber, birthDate, membershipNumber, firstName, lastName.

## Validated

### R001 — 앱 내 Weverse 로그인 및 쿠키 자동 추출

- Class: core-capability
- Status: validated
- Description: 앱 내 Weverse 로그인 및 쿠키 자동 추출
- Why it matters: 모든 API 호출의 인증 토큰 원천. 이 없이는 아무것도 동작하지 않는다.
- Source: user
- Primary owning slice: M001-ksbtje/S01
- Validation: S01: AuthService.login() BrowserWindow 로그인 → we2_access_token 쿠키 추출(.weverse.io / weverse.io 두 도메인) → GET /api/fan-api/v1/fans/me 토큰 검증 구현. 단위 테스트 16개 포함 57개 전부 통과, tsc 오류 0, 빌드 성공.
- Notes: JWT 만료 시 재로그인 안내. 토큰 자체 갱신은 브라우저 세션에 위임.

### R002 — 이벤트 폼 스키마 조회 및 파싱

- Class: core-capability
- Status: validated
- Description: 이벤트 폼 스키마 조회 및 파싱
- Why it matters: 신청에 필요한 모든 동적 데이터(토큰, 호스트, 회차, 동의항목)의 원천.
- Source: user
- Primary owning slice: M001-ksbtje/S02
- Validation: S02: WeverseApi.fetchFormSchema() 구현, FormSchema 타입 파싱, applyHost 동적 추출(하드코딩 금지 준수). form-parser 단위 테스트 통과, tsc 오류 0, 136개 테스트 모두 통과.
- Notes: formOpenAt 이전에는 400 APPLICATION_001 반환. applyHost는 동적이므로 하드코딩 금지.

### R003 — 서버 시간 동기화 + RTT 보정 정밀 타이밍 POST

- Class: differentiator
- Status: validated
- Description: 서버 시간 동기화 + RTT 보정 정밀 타이밍 POST
- Why it matters: 선착순 이벤트에서 밀리초 단위 타이밍이 성공률을 결정. 이 프로젝트의 핵심 가치.
- Source: user
- Primary owning slice: M001-ksbtje/S02
- Validation: S02: TimingService — Date 헤더 오프셋 + RTT/2 보정(localMidMs = t0 + rttMs/2), calculateFireTime() + waitUntilFireTime() 구현. timing-service 21개 단위 테스트 전부 통과(±2초 오프셋, RTT/2 보정, 시간 가드 포함).
- Notes: KR 리전 CloudFront RTT 보통 20~80ms. 단일 POST만 발사, 연타 금지.

### R004 — 신청 결과 폴링 (REQUESTED → COMPLETED)

- Class: core-capability
- Status: validated
- Description: 신청 결과 폴링 (REQUESTED → COMPLETED)
- Why it matters: 신청이 실제로 접수 완료되었는지 사용자에게 확인시켜줘야 함.
- Source: user
- Primary owning slice: M001-ksbtje/S02
- Validation: S02: ApplyEngine._pollStatus() 구현 — REQUESTED→COMPLETED 최대 15초 폴링, 비-REQUESTED 상태 APPLY_REJECTED 에러 처리. apply-engine 단위 테스트 포함 136개 전부 통과.
- Notes: 최대 ~15초 폴링. COMPLETED 외 상태는 에러 표시.

### R005 — 신청 프로필 암호화 저장 및 재사용

- Class: primary-user-loop
- Status: validated
- Description: 신청 프로필 암호화 저장 및 재사용
- Why it matters: 매번 입력하는 번거로움 제거. 단, 매번 확인은 필수.
- Source: user
- Primary owning slice: M001-ksbtje/S01
- Supporting slices: M001-ksbtje/S02
- Validation: S01: Electron safeStorage 기반 파일 암호화 저장 구현, 복호화 라운드트립 단위 테스트 11개 통과, 앱 재시작 후 자동 로드 확인. 복호화/파싱 실패 시 손상 파일 자동 삭제 로직 포함.
- Notes: safeStorage로 OS 수준 암호화. 자동 채움 후 반드시 사용자 확인.

### R007 — 안전 가드 (시간 가드, 재시도 금지, 단일 계정, 로그 마스킹)

- Class: compliance/security
- Status: validated
- Description: 안전 가드 (시간 가드, 재시도 금지, 단일 계정, 로그 마스킹)
- Why it matters: Weverse 이용약관 준수 및 사용자 계정 보호.
- Source: user
- Primary owning slice: M001-ksbtje/S02
- Validation: S02: postFired 플래그(POST 1회 보장) + isTimeGuardPassed()(startAt-50ms 차단) 이중 안전 가드. S02+S03: maskToken/maskPhone/maskBirthDate + maskSensitive 7종 마스킹 구현. consentIds sorted 비교로 누락/초과 모두 차단. 약관 체크박스 초기값 false 강제.
- Notes: startAt-50ms 이전 POST 금지, POST 200 후 재호출 금지, 약관 동의 자동 체크 금지.

### R009 — 약관 동의 명시적 사용자 확인 (자동 체크 금지)

- Class: compliance/security
- Status: validated
- Description: 약관 동의 명시적 사용자 확인 (자동 체크 금지)
- Why it matters: 사용자 의사 없이 동의 처리되면 안 됨. 스펙 §9 안전 가드.
- Source: user
- Primary owning slice: M001-ksbtje/S02
- Validation: S02: ApplyForm 컴포넌트에서 약관 체크박스 초기값 Object.fromEntries 모두 false. consentIds sorted 비교로 누락/초과 차단. 미체크 시 신청 버튼 비활성 처리.
- Notes: 동의 항목은 GET application 응답의 consents 배열에서 동적 렌더링.

### R016 — 로그인 방식 선택 (API 통신 / 브라우저)

- Class: core-capability
- Status: active
- Description: 사용자가 로그인 방식을 API 통신과 브라우저 중 선택할 수 있고, 선택이 다음 실행에도 유지된다.
- Why it matters: 클라이언트가 브라우저 없이 통신만으로 동작하기를 요청했으나, API 방식은 매 로그인 OTP가 강제되어 선착순 자동화 가치를 훼손한다. 둘 다 제공하고 사용자가 트레이드오프를 선택하게 한다.
- Source: client
- Primary owning slice: v0.3.0/Phase 06
- Validation: unmapped
- Notes: 브라우저 모드가 기본값. 선택값은 설정에 영속 저장.

### R017 — API 자격증명 로그인 (실측 계약)

- Class: core-capability
- Status: active
- Description: 이메일/비밀번호로 위버스 계정 API에 로그인하는 경로는 POST /v4/auth/token/by-credentials **단독 호출**이며, 요청 바디의 otpSessionId 필드는 OTP 세션 식별자가 아니라 reCAPTCHA Enterprise 토큰(실측 2489자)이다.
- Why it matters: 브라우저 엔진 없이 순수 HTTP로 인증하는 경로의 핵심.
- Source: client
- Primary owning slice: v0.3.0/Phase 05
- Validation: unmapped
- Notes: Base URL https://accountapi.weverse.io/web/api. 필수 헤더 X-ACC-APP-VERSION(4.7.1), X-ACC-APP-SECRET, X-ACC-SERVICE-ID(weverse), X-ACC-LANGUAGE, X-ACC-TRACE-ID. otpSessionId 필드는 캡차 토큰 자리이므로 순수 HTTP 클라이언트는 채울 수 없고(R013 영구 제외), 실제 로그인 페이지가 캡차를 스스로 처리하는 헤드리스 BrowserWindow 경로가 현재 유일하게 동작하는 로그인 경로다. -25044는 "이메일 OTP 인증 필요"가 아니라 캡차 토큰 없음/무효를 의미한다. 비밀번호는 평문 전송(TLS), 클라이언트 암호화 없음. 2026-08-25 HAR(436 entries) 실측으로 정정됨 — 근거: .planning/phases/05-api/05-01-SUMMARY.md

### R018 — 이메일 OTP 코드 입력 및 인증 [보류 — 2026-08-25]

- Class: core-capability
- Status: blocked
- Description: API 모드 로그인 시 이메일로 발송된 6자리 OTP를 앱에서 입력해 인증을 완료한다. POST /v2/auth/otp로 발송, POST /v3/auth/token/by-credentials-with-otp로 검증.
- Why it matters: HAR 실측상 실제 로그인 흐름에는 이메일 OTP 단계가 없다(관련 호출 0건) — 캡차 실패 시의 폴백 경로로만 존재할 가능성이 남아 있으나 미입증이다. -25044는 OTP 요구가 아니라 캡차 토큰 없음/무효 신호였다.
- Source: 실서버 검증
- Primary owning slice: none (unmapped — 2026-08-25 Phase 05 매핑 해제)
- Validation: unmapped
- Notes: HAR 상 실제 로그인 흐름에 OTP 단계가 존재하지 않는다(`/v2/auth/otp-sessions`, `/v3/auth/token/by-credentials-with-otp`, `/v2/auth/otp` 호출 0건). 캡차 실패 시의 폴백 경로로만 존재할 가능성이 남아 있으나 05-01 실계정 스파이크에서 OTP 메일이 오지 않아 미입증. OTP 코드는(만약 경로가 실재로 확인되면) 절대 저장하지 않는다. 근거: .planning/phases/05-api/05-01-SUMMARY.md

### R019 — account 토큰 → 팬이벤트 토큰 교환

- Class: core-capability
- Status: active
- Description: API 로그인으로 받은 account 토큰을 팬이벤트 API용 we2_access_token으로 확보해 기존 신청 엔진이 그대로 동작하게 한다.
- Why it matters: 이 교환이 없으면 API 로그인에 성공해도 신청을 못 한다. 두 로그인 경로가 같은 다운스트림 인터페이스로 수렴해야 ApplyEngine을 건드리지 않는다.
- Source: 아키텍처 요구
- Primary owning slice: v0.3.0/Phase 05
- Validation: validated
- Notes: **2026-08-25 실계정 관측으로 검증됨(PASS)** — 근거: `.planning/phases/05-api/05-SPIKE-RESULT.md`. `acquireFaneventToken()` 사다리의 rung1(직접 사용)이 실계정 쿠키(계정 도메인 `rt` 쿠키, JWT 형태)로 `/fans/me` 200 + fanId를 확보했다. rung2(교환)는 rung1 성공으로 실행 기회가 없어 여전히 미검증 — API 모드 제품 경로 확정 전에 감안할 것(05-SPIKE-RESULT.md §6 "다음 단계" 참고). 별도로, 이 관측 과정에서 앱 로그 파일에 access_token/refresh_token 원문이 마스킹 없이 남는 보안 결함이 발견됐다(05-SPIKE-RESULT.md §6) — 코드 변경은 이 phase 스코프 밖이라 Phase 06/07로 이관.

### R020 — API 로그인 실패 사유 한국어 안내

- Class: failure-visibility
- Status: active
- Description: 서버가 반환하는 에러 코드를 사용자가 이해할 수 있는 한국어 메시지로 매핑해 표시한다.
- Why it matters: 코드만 노출하면 사용자가 원인을 알 수 없어 클라이언트 문의로 이어진다.
- Source: user
- Primary owning slice: v0.3.0/Phase 06
- Validation: unmapped
- Notes: 주요 코드 — -25003 WRONG_ID_OR_PASSWORD, -25044 OTP 필요, -26000 잘못된 API 사용, -26004 계정 상태 이상, RESTRICTED_OVERSEAS_LOGIN(해외 로그인 차단), PASSWORD_RESET_REQUIRED. 로그에는 마스킹 규칙(R010) 유지.

### R021 — API 모드 제약 사전 고지

- Class: failure-visibility
- Status: active
- Description: 사용자가 API 모드를 선택할 때 "매 로그인마다 이메일 OTP 입력 필요, 자동 재로그인 불가"를 명시적으로 안내한다.
- Why it matters: 클라이언트는 API 모드가 더 자동화된 방식이라고 기대했으나 실제로는 그 반대다. 기대치 불일치를 선택 시점에 해소한다.
- Source: 실서버 검증
- Primary owning slice: v0.3.0/Phase 06
- Validation: unmapped
- Notes: 캡차 우회는 영구 제외(R013)이므로 제약을 없애는 것이 아니라 알리는 것이 목표.

### R022 — 신청 시각 전 토큰 수명 체크 및 재로그인 유도

- Class: safety-guard
- Status: active
- Description: 신청 예정 시각 기준으로 토큰 잔여 수명을 확인해, 대기 중 만료가 예상되면 사전에 경고하고 재로그인을 유도한다.
- Why it matters: API 모드는 OTP 때문에 자동 재로그인이 불가능하다. 대기 중 만료되면 이벤트를 통째로 놓친다. 사람이 개입할 시간을 미리 확보한다.
- Source: user
- Primary owning slice: v0.3.0/Phase 07
- Validation: unmapped
- Notes: 기존 tryAutoRelogin은 브라우저 모드에서만 유효. JWT exp 클레임 파싱은 기존 isTokenExpired 재사용.

### R023 — API 모드 자격증명 암호화 저장

- Class: core-capability
- Status: active
- Description: API 모드에서도 이메일/비밀번호를 safeStorage로 암호화 저장해 재입력을 생략한다. OTP 코드는 저장하지 않는다.
- Why it matters: 매번 OTP를 입력해야 하는 것만으로도 번거로운데 자격증명까지 재입력하면 실사용이 어렵다.
- Source: user
- Primary owning slice: v0.3.0/Phase 07
- Validation: unmapped
- Notes: 기존 credentials.enc 메커니즘 재사용. safeStorage 불가 환경에서는 저장을 건너뛴다(기존 동작 유지).

## Deferred

## Out of Scope

### R011 — 추첨형(DRAW) 이벤트 지원

- Class: core-capability
- Status: out-of-scope
- Description: 추첨형(DRAW) 이벤트 지원
- Why it matters: 이 프로젝트는 선착순(FIFO) 전용. 추첨 이벤트는 다른 UX 흐름이 필요하다.
- Source: user
- Notes: 사용자가 명시적으로 범위에서 제외

### R012 — 다계정/타인 명의 자동 신청

- Class: anti-feature
- Status: out-of-scope
- Description: 다계정/타인 명의 자동 신청
- Why it matters: Weverse 이용약관 위반이자 다른 팬에 대한 형평성 문제
- Source: user
- Notes: 스펙에서 명시적으로 금지

### R013 — 캡차 우회

- Class: anti-feature
- Status: out-of-scope
- Description: 캡차 우회
- Why it matters: Weverse 이용약관 위반
- Source: user
- Notes: 캡차 노출 시 사용자에게 알림만 표시

### R014 — 라이선스/배포 제한

- Class: constraint
- Status: out-of-scope
- Description: 라이선스/배포 제한
- Why it matters: 스코프 축소를 위해 의도적으로 제외
- Source: user
- Notes: 사용자가 지금 scope에서 제외로 결정

### R015 — 토큰 자체 갱신

- Class: constraint
- Status: out-of-scope
- Description: 토큰 자체 갱신
- Why it matters: 갱신 엔드포인트 미캡처. 브라우저 세션에서 자동 갱신되도록 위임.
- Source: user
- Notes: 만료 시 재로그인 안내로 대체

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | validated | M001-ksbtje/S01 | none | S01: AuthService.login() BrowserWindow 로그인 → we2_access_token 쿠키 추출(.weverse.io / weverse.io 두 도메인) → GET /api/fan-api/v1/fans/me 토큰 검증 구현. 단위 테스트 16개 포함 57개 전부 통과, tsc 오류 0, 빌드 성공. |
| R002 | core-capability | validated | M001-ksbtje/S02 | none | S02: WeverseApi.fetchFormSchema() 구현, FormSchema 타입 파싱, applyHost 동적 추출(하드코딩 금지 준수). form-parser 단위 테스트 통과, tsc 오류 0, 136개 테스트 모두 통과. |
| R003 | differentiator | validated | M001-ksbtje/S02 | none | S02: TimingService — Date 헤더 오프셋 + RTT/2 보정(localMidMs = t0 + rttMs/2), calculateFireTime() + waitUntilFireTime() 구현. timing-service 21개 단위 테스트 전부 통과(±2초 오프셋, RTT/2 보정, 시간 가드 포함). |
| R004 | core-capability | validated | M001-ksbtje/S02 | none | S02: ApplyEngine._pollStatus() 구현 — REQUESTED→COMPLETED 최대 15초 폴링, 비-REQUESTED 상태 APPLY_REJECTED 에러 처리. apply-engine 단위 테스트 포함 136개 전부 통과. |
| R005 | primary-user-loop | validated | M001-ksbtje/S01 | M001-ksbtje/S02 | S01: Electron safeStorage 기반 파일 암호화 저장 구현, 복호화 라운드트립 단위 테스트 11개 통과, 앱 재시작 후 자동 로드 확인. 복호화/파싱 실패 시 손상 파일 자동 삭제 로직 포함. |
| R006 | failure-visibility | active | M001-ksbtje/S03 | M001-ksbtje/S01, M001-ksbtje/S02 | unmapped |
| R007 | compliance/security | validated | M001-ksbtje/S02 | none | S02: postFired 플래그(POST 1회 보장) + isTimeGuardPassed()(startAt-50ms 차단) 이중 안전 가드. S02+S03: maskToken/maskPhone/maskBirthDate + maskSensitive 7종 마스킹 구현. consentIds sorted 비교로 누락/초과 모두 차단. 약관 체크박스 초기값 false 강제. |
| R008 | launchability | active | M001-ksbtje/S04 | none | unmapped |
| R009 | compliance/security | validated | M001-ksbtje/S02 | none | S02: ApplyForm 컴포넌트에서 약관 체크박스 초기값 Object.fromEntries 모두 false. consentIds sorted 비교로 누락/초과 차단. 미체크 시 신청 버튼 비활성 처리. |
| R010 | compliance/security | active | M001-ksbtje/S03 | none | unmapped |
| R011 | core-capability | out-of-scope | none | none | unmapped |
| R012 | anti-feature | out-of-scope | none | none | unmapped |
| R013 | anti-feature | out-of-scope | none | none | unmapped |
| R014 | constraint | out-of-scope | none | none | unmapped |
| R015 | constraint | out-of-scope | none | none | unmapped |
| R016 | core-capability | active | v0.3.0/Phase 06 | none | unmapped |
| R017 | core-capability | active | v0.3.0/Phase 05 | none | 2026-08-25 HAR 실측으로 로그인 계약 정정 — otpSessionId=reCAPTCHA 토큰, 3단계 순서 아님 (근거: 05-01-SUMMARY.md) |
| R018 | core-capability | blocked | none | none | 2026-08-25 Phase 05 매핑 해제 — HAR 상 OTP 단계 부재, 미입증 |
| R019 | core-capability | validated | v0.3.0/Phase 05 | none | 2026-08-25 실계정 관측: rung1(직접 사용)이 계정 도메인 쿠키(JWT)로 /fans/me 200+fanId 확보 (근거: 05-SPIKE-RESULT.md). rung2(교환)는 미실행으로 여전히 미검증 |
| R020 | failure-visibility | active | v0.3.0/Phase 06 | none | unmapped |
| R021 | failure-visibility | active | v0.3.0/Phase 06 | none | unmapped |
| R022 | safety-guard | active | v0.3.0/Phase 07 | none | unmapped |
| R023 | core-capability | active | v0.3.0/Phase 07 | none | unmapped |

## Coverage Summary

- Active requirements: 9 (기존 3 + v0.3.0 신규 6 — R018 은 blocked 로 이동해 제외, R019 는 validated 로 이동해 제외)
- Mapped to slices: 10 (활성+validated 요구사항 전체가 phase에 매핑 완료 — v0.3.0: R016/R020/R021 → Phase 06, R017 → Phase 05, R019 → Phase 05(validated), R018 → blocked/unmapped, R022/R023 → Phase 07)
- Blocked: 1 (R018 — 2026-08-25 Phase 05 매핑 해제, HAR 상 OTP 단계 부재로 미입증)
- Validated: 8 (R001, R002, R003, R004, R005, R007, R009, R019 — R019 는 2026-08-25 실계정 관측으로 validated, 05-SPIKE-RESULT.md 근거)
- Unmapped active requirements: 0
