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

## Deferred

## Out of Scope

### R011 — 추첨형(DRAW) 이벤트 지원

- Class: core-capability
- Status: out-of-scope
- Description: 추첨형(DRAW) 이벤트 지원
- Why it matters: 이 프로젝트는 선착순(FIFO) 전용. 추첨 이벤트는 다른 UX 흐름이 필요.
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

## Coverage Summary

- Active requirements: 3
- Mapped to slices: 3
- Validated: 7 (R001, R002, R003, R004, R005, R007, R009)
- Unmapped active requirements: 0
