---
status: complete
phase: 06-ui
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md, 06-06-SUMMARY.md, 06-07-SUMMARY.md, 06-08-SUMMARY.md, 06-09-SUMMARY.md, 06-10-SUMMARY.md
started: 2026-08-26T08:22:08Z
updated: 2026-08-26T08:54:00Z
---

## Current Test

[testing complete]

## Tests

<!-- 1-9: human checkpoints (coverage classify: present / human_judgment) -->

### 1. 최초 API 모드 고지 모달이 진행을 차단한다
expected: |
  고지 미확인 상태(settings.json 의 apiModeNoticeAckedVersion 이 null)에서 앱을 실행하고 'API 로그인' 탭을 처음 누르면 고지 모달이 뜬다.
  - 취소 버튼 또는 Esc 로 닫으면 → 모달이 사라지고 '브라우저 로그인' 탭이 그대로 활성 상태로 남는다 (API 모드로 바뀌지 않는다).
  - 확인 버튼을 눌러야만 → 모달이 닫히고 API 모드로 전환된다.
  - 확인 후 다시 같은 탭을 눌러도 모달이 재노출되지 않는다.
ref: 06-06 D1 (R021, D-09) · 06-VALIDATION Manual-Only #2
result: pass

### 2. 고지 모달 — 좁은 창에서도 확인 버튼에 도달 가능
expected: |
  창을 최소 크기로 줄인 상태에서 고지 모달을 띄워도, 본문은 스크롤되고 확인/취소 버튼 행은 항상 화면 안에 남아 클릭할 수 있다. 버튼이 화면 밖으로 밀려나 도달 불가능해지는 일이 없다.
ref: 06-06 D5 (R021, UI-SPEC E3 overflow)
result: pass

### 3. 고지 확인 저장이 진행 중일 때 Esc/취소가 모달을 닫지 못한다
expected: |
  고지 모달의 확인 버튼을 누른 직후 저장이 진행되는 동안 Esc 키나 취소 버튼을 눌러도 모달이 닫히지 않는다. 저장이 끝난 뒤에야 모달이 닫히고 API 모드로 전환된다.
ref: 06-08 D3 (R021, WR-01)
result: pass

### 4. 로그인 방식 선택이 앱 재시작 후에도 유지된다 — 브라우저 방향
expected: |
  '브라우저 로그인' 탭을 선택한 뒤 앱을 완전히 종료하고 재실행하면, 브라우저 로그인 탭이 선택된 상태로 뜬다.
  (API 방향은 06-01 tracer 체크포인트에서 이미 확인됨 — 이번엔 반대 방향만 확인하면 된다.)
ref: 06-01 D1 (R016) · 06-VALIDATION Manual-Only #1 outstanding 방향
result: pass

### 5. 로그인된 상태에서 모드를 바꿔도 세션이 유지된다
expected: |
  로그인이 완료된 상태에서 로그인 방식 탭을 전환하면, 상태 배지가 '로그인 완료'로 그대로 유지된다. 로그아웃되거나 로그인 화면으로 되돌아가지 않는다.
ref: 06-01 D5 (R016, D-07)
result: pass

### 6. 설정 저장 실패 시 오류 문구가 뜨고 탭이 원래대로 남는다
expected: |
  설정 저장이 실패하는 상황(예: settings.json 이 있는 디렉터리를 읽기 전용으로 만든 뒤 탭 전환)에서 탭을 바꾸면
  - 탭 선택이 이전 상태 그대로 남고,
  - 화면에 '설정 저장에 실패했습니다. 다시 시도해주세요.' 문구가 표시된다.
ref: 06-01 D8 (R016, UI-SPEC E1 error)
result: pass

### 7. 환경변수 잠금 — 선택기가 잠기고 원문 값은 노출되지 않는다
expected: |
  AUTOVERSE_LOGIN_MODE=api 를 설정한 채로 앱을 실행하면
  - 두 탭이 모두 비활성(클릭해도 아무 변화 없음)이고,
  - '환경변수로 고정됨' 배지와 현재 적용 중인 모드 라벨('API 로그인')이 보이며,
  - 배지 문구에 환경변수 원문 값(api)이 그대로 노출되지 않는다.
ref: 06-VALIDATION Manual-Only #3 (R016, D-06) · 06-06 D2 실행 확인
result: pass

### 8. 로그인 실패 시 서버 코드가 아닌 한국어 안내가 뜬다
expected: |
  API 모드에서 **의도적으로 틀린 비밀번호**로 로그인을 시도하면, 서버 에러 코드/원문이 아니라 한국어 설명 문구가 표시된다.
  - 보안 확인(캡차)이 실제로 뜬 경우에만 그 안내 문구와 '브라우저로 전환' 버튼을 함께 확인한다. 캡차를 인위적으로 유발하지 말 것 — 뜨지 않으면 그 하위 항목은 '미관측'으로 기록(통과 아님).
  - 이 테스트는 사용자가 직접 수행한다. 에이전트는 실계정 자격증명을 입력하거나 weverse.io / accountapi.weverse.io 로 어떤 요청도 보내지 않는다(05-CONTEXT D-06).
ref: 06-VALIDATION Manual-Only #4 (R020)
result: pass

### 9. 수동 검증 4항목의 절차가 실제로 실행 가능하다
expected: |
  06-VALIDATION.md 의 Manual-Only Verifications 표에 적힌 명령과 절차를, 문서에 적힌 그대로 따라 했을 때 막힘 없이 실행된다 (명령이 실재하고, 순서가 맞고, 06-07-PLAN.md 의 <verify><human-check> 블록과 내용이 일치한다).
ref: 06-07 D3 (R016/R020/R021)
result: pass
note: |
  검증 중 확인된 문서 결함(사용자 판단으로 pass 처리): 06-VALIDATION.md Manual-Only 표와
  06-07-PLAN.md <verify><human-check> 가 지시하는 `npm run dev` 스크립트는 package.json 에
  존재하지 않는다(scripts: dev:renderer / start / build / ...). 실제 실행 명령은 `npm start`.
  이번 UAT 는 `npm start` 로 수행했다. 문서 문구 정정은 별도 후속 작업.

<!-- 10-48: auto-covered by passing tests (coverage classify: auto_passed) — not presented to the user -->

### 10. [06-01 D2] 설정 파일 부재·손상·미지 값에서도 예외 없이 기본값(browser)으로 폴백하고 경고 로그를 남긴다
expected: 설정 파일 부재·손상·미지 값에서도 예외 없이 기본값(browser)으로 폴백하고 경고 로그를 남긴다
result: pass
source: automated
coverage_id: D2
plan: 06-01

### 11. [06-01 D3] AUTOVERSE_LOGIN_MODE 설정 시 저장값과 무관하게 env 가 적용되고 lockedByEnv 가 true 로 렌더러까지 전달된다(D-06)
expected: AUTOVERSE_LOGIN_MODE 설정 시 저장값과 무관하게 env 가 적용되고 lockedByEnv 가 true 로 렌더러까지 전달된다(D-06)
result: pass
source: automated
coverage_id: D3
plan: 06-01

### 12. [06-01 D4] 탭을 연속으로 빠르게 클릭해도 설정 파일은 항상 완전한 JSON 이며 원자적 tmp+rename 쓰기로만 교체된다
expected: 탭을 연속으로 빠르게 클릭해도 설정 파일은 항상 완전한 JSON 이며 원자적 tmp+rename 쓰기로만 교체된다
result: pass
source: automated
coverage_id: D4
plan: 06-01

### 13. [06-01 D6] OTP 입력 화면(코드 상태·제출 핸들러·submitOtp 호출)이 렌더러에서 완전히 제거되었다(D-02 렌더러 몫)
expected: OTP 입력 화면(코드 상태·제출 핸들러·submitOtp 호출)이 렌더러에서 완전히 제거되었다(D-02 렌더러 몫)
result: pass
source: automated
coverage_id: D6
plan: 06-01

### 14. [06-01 D7] API-mode 고지 확인 버전이 재시작을 넘어 영속되고, 재노출 판단이 렌더링 없이 테스트되는 순수 함수(shouldShowApiModeNotice)로 고정된다(R021, D-10)
expected: API-mode 고지 확인 버전이 재시작을 넘어 영속되고, 재노출 판단이 렌더링 없이 테스트되는 순수 함수(shouldShowApiModeNotice)로 고정된다(R021, D-10)
result: pass
source: automated
coverage_id: D7
plan: 06-01

### 15. [06-02 D1] 6개 LoginFailureReason 전부가 UI-SPEC 확정 한국어 문구로 매핑되고, 캡차가 더 이상 이메일 코드 안내로 흐르지 않는다 (R020, D-13)
expected: 6개 LoginFailureReason 전부가 UI-SPEC 확정 한국어 문구로 매핑되고, 캡차가 더 이상 이메일 코드 안내로 흐르지 않는다 (R020, D-13)
result: pass
source: automated
coverage_id: D1
plan: 06-02

### 16. [06-02 D2] 동적 form-error 텍스트가 120자에서 잘려 화면에 표시되고, 잘리지 않은 원문은 logDetail 로 로그 경로에 보존된다 (UI-SPEC E5 overflow/long-text)
expected: 동적 form-error 텍스트가 120자에서 잘려 화면에 표시되고, 잘리지 않은 원문은 logDetail 로 로그 경로에 보존된다 (UI-SPEC E5 overflow/long-text)
result: pass
source: automated
coverage_id: D2
plan: 06-02

### 17. [06-03 D1] REQUIREMENTS.md R021 Description의 반증된 'OTP 강제' 서술을 VOID 마킹하고 D-08의 실제 제약(reCAPTCHA 실패 시 브라우저 전환 필요, 자동 재로그인 없음)으로 정정, 근거 경로(05-01-SUMMARY.md) 명시
expected: REQUIREMENTS.md R021 Description의 반증된 'OTP 강제' 서술을 VOID 마킹하고 D-08의 실제 제약(reCAPTCHA 실패 시 브라우저 전환 필요, 자동 재로그인 없음)으로 정정, 근거 경로(05-01-SUMMARY.md) 명시
result: pass
source: automated
coverage_id: D1
plan: 06-03

### 18. [06-03 D2] REQUIREMENTS.md R020 Notes의 도달 불가 에러코드 목록을 VOID 마킹하고 D-12의 6가지 실제 실패 신호 매핑 + 구현 위치(src/shared/login-failure.ts)로 정정
expected: REQUIREMENTS.md R020 Notes의 도달 불가 에러코드 목록을 VOID 마킹하고 D-12의 6가지 실제 실패 신호 매핑 + 구현 위치(src/shared/login-failure.ts)로 정정
result: pass
source: automated
coverage_id: D2
plan: 06-03

### 19. [06-03 D3] Traceability 표 R020/R021 Proof 열을 unmapped에서 2026-08-26 D-11 정정 서술로 갱신
expected: Traceability 표 R020/R021 Proof 열을 unmapped에서 2026-08-26 D-11 정정 서술로 갱신
result: pass
source: automated
coverage_id: D3
plan: 06-03

### 20. [06-03 D4] ROADMAP.md Phase 06 SC2(OTP 고지)와 SC3(에러코드 안내)를 VOID 마킹 + 정정문 병기, SC1에 D-03 의도적 편차 인용 블록 추가
expected: ROADMAP.md Phase 06 SC2(OTP 고지)와 SC3(에러코드 안내)를 VOID 마킹 + 정정문 병기, SC1에 D-03 의도적 편차 인용 블록 추가
result: pass
source: automated
coverage_id: D4
plan: 06-03

### 21. [06-03 D5] 국소 치환만 수행 — Phase 05/07 섹션과 플랜 목록(06-01-PLAN.md 등)이 손상되지 않고 그대로 남음
expected: 국소 치환만 수행 — Phase 05/07 섹션과 플랜 목록(06-01-PLAN.md 등)이 손상되지 않고 그대로 남음
result: pass
source: automated
coverage_id: D5
plan: 06-03

### 22. [06-04 D1] 자격증명 로그인 진입점이 하나뿐이다 — auth:credential-login 핸들러의 모드 삼항 분기 제거, credentialLogin() 한 줄 위임 (D-01)
expected: 자격증명 로그인 진입점이 하나뿐이다 — auth:credential-login 핸들러의 모드 삼항 분기 제거, credentialLogin() 한 줄 위임 (D-01)
result: pass
source: automated
coverage_id: D1
plan: 06-04

### 23. [06-04 D2] 반증된 3단계 계정 API 로그인 코드(메서드·IPC 채널·타입 필드·테스트)가 전부 제거됐다 — 사용자 승인 하에 submitOtp()/verifyOtp() 등 확대 삭제 포함 (D-02)
expected: 반증된 3단계 계정 API 로그인 코드(메서드·IPC 채널·타입 필드·테스트)가 전부 제거됐다 — 사용자 승인 하에 submitOtp()/verifyOtp() 등 확대 삭제 포함 (D-02)
result: pass
source: automated
coverage_id: D2
plan: 06-04

### 24. [06-04 D3] 무인 자동 로그인이 두 모드 모두에서 차단되고, 쿠키 세션 복원은 그대로 유지된다 — 모드 조건에서 외부 요청 조건으로 재정의 (D-03, TDD RED→GREEN)
expected: 무인 자동 로그인이 두 모드 모두에서 차단되고, 쿠키 세션 복원은 그대로 유지된다 — 모드 조건에서 외부 요청 조건으로 재정의 (D-03, TDD RED→GREEN)
result: pass
source: automated
coverage_id: D3
plan: 06-04

### 25. [06-04 D4] R019 자산(사다리·서비스 토큰 교환·토큰 검증)이 이번 정리로 손상되지 않았다
expected: R019 자산(사다리·서비스 토큰 교환·토큰 검증)이 이번 정리로 손상되지 않았다
result: pass
source: automated
coverage_id: D4
plan: 06-04

### 26. [06-05 D1] 캡차 위젯 감지가 더 이상 OTP/이메일 코드 서사로 오분류되지 않는다 — classifyCredentialLoginSignal()이 'captcha'와 'otp-form'을 분리하고, 셀렉터 실패(null)/미지 신호 모두 미매핑 폴백으로 안전하게 떨어진다 (D-13, D-14)
expected: 캡차 위젯 감지가 더 이상 OTP/이메일 코드 서사로 오분류되지 않는다 — classifyCredentialLoginSignal()이 'captcha'와 'otp-form'을 분리하고, 셀렉터 실패(null)/미지 신호 모두 미매핑 폴백으로 안전하게 떨어진다 (D-13, D-14)
result: pass
source: automated
coverage_id: D1
plan: 06-05

### 27. [06-05 D2] 렌더러로 반환되는 모든 실패 message/identifier가 maskSensitive()를 통과한다 — 토큰 형태 문자열이 화면에 노출되지 않는다 (R010, T-06-06/T-06-17 계열)
expected: 렌더러로 반환되는 모든 실패 message/identifier가 maskSensitive()를 통과한다 — 토큰 형태 문자열이 화면에 노출되지 않는다 (R010, T-06-06/T-06-17 계열)
result: pass
source: automated
coverage_id: D2
plan: 06-05

### 28. [06-05 D3] 사다리(토큰 확보) 실패가 로그에만 남지 않고 login-failed 이벤트로 사용자에게 도달한다 (D-12)
expected: 사다리(토큰 확보) 실패가 로그에만 남지 않고 login-failed 이벤트로 사용자에게 도달한다 (D-12)
result: pass
source: automated
coverage_id: D3
plan: 06-05

### 29. [06-05 D4] 전체 회귀 없음 — 기존 auth-service 테스트(31개) 및 전체 스위트(294개)가 그대로 통과, 두 typecheck(main/renderer) + build 통과
expected: 전체 회귀 없음 — 기존 auth-service 테스트(31개) 및 전체 스위트(294개)가 그대로 통과, 두 typecheck(main/renderer) + build 통과
result: pass
source: automated
coverage_id: D4
plan: 06-05

### 30. [06-06 D2] 환경변수 잠금 상태가 배지·상세 문구·탭 비활성 셋 다 같은 값(lockedByEnv)에서 파생되고, 미설정 시 배지는 아예 렌더링되지 않는다 — 환경변수 원문 값은 어디에도 노출되지 않는다 (D-06, UI-SPEC E2)
expected: 환경변수 잠금 상태가 배지·상세 문구·탭 비활성 셋 다 같은 값(lockedByEnv)에서 파생되고, 미설정 시 배지는 아예 렌더링되지 않는다 — 환경변수 원문 값은 어디에도 노출되지 않는다 (D-06, UI-SPEC E2)
result: pass
source: automated
coverage_id: D2
plan: 06-06

### 31. [06-06 D3] API 모드가 활성인 동안 상시 안내 배너가 로그인 상태와 무관하게 노출되고, 닫기 버튼이 없다 (D-09 후반부)
expected: API 모드가 활성인 동안 상시 안내 배너가 로그인 상태와 무관하게 노출되고, 닫기 버튼이 없다 (D-09 후반부)
result: pass
source: automated
coverage_id: D3
plan: 06-06

### 32. [06-06 D4] 여섯 가지 실패 사유 전부가 하나의 기존 오류 슬롯(role=alert)에서 정확한 한국어 문장으로 표시되고, 식별자 칩과 전환 버튼은 사유에 맞을 때만 나타난다 — 새 표시 영역이나 두 번째 모달이 생기지 않는다 (R020, D-15)
expected: 여섯 가지 실패 사유 전부가 하나의 기존 오류 슬롯(role=alert)에서 정확한 한국어 문장으로 표시되고, 식별자 칩과 전환 버튼은 사유에 맞을 때만 나타난다 — 새 표시 영역이나 두 번째 모달이 생기지 않는다 (R020, D-15)
result: pass
source: automated
coverage_id: D4
plan: 06-06

### 33. [06-06 D6] 전체 회귀 없음 — 이 플랜이 시작한 시점 대비 전체 vitest 스위트, 두 typecheck(renderer/main), build가 그대로 통과
expected: 전체 회귀 없음 — 이 플랜이 시작한 시점 대비 전체 vitest 스위트, 두 typecheck(renderer/main), build가 그대로 통과
result: pass
source: automated
coverage_id: D6
plan: 06-06

### 34. [06-07 D1] phase 게이트 3종 + 빌드가 green이다 — D-02 대량 삭제(auth-service.ts/api-auth-client.ts/ipc-handlers.ts/LoginPanel.tsx)가 남긴 컴파일 깨짐이 없다
expected: phase 게이트 3종 + 빌드가 green이다 — D-02 대량 삭제(auth-service.ts/api-auth-client.ts/ipc-handlers.ts/LoginPanel.tsx)가 남긴 컴파일 깨짐이 없다
result: pass
source: automated
coverage_id: D1
plan: 06-07

### 35. [06-07 D2] 06-VALIDATION.md Per-Task Verification Map 17행 전부가 실제 태스크 ID·명령·상태로 채워졌다 — TBD/pending 잔존 없음
expected: 06-VALIDATION.md Per-Task Verification Map 17행 전부가 실제 태스크 ID·명령·상태로 채워졌다 — TBD/pending 잔존 없음
result: pass
source: automated
coverage_id: D2
plan: 06-07

### 36. [06-07 D4] 에이전트가 실계정 자격증명을 입력하거나 weverse.io/accountapi.weverse.io로 어떤 요청도 보내지 않았다
expected: 에이전트가 실계정 자격증명을 입력하거나 weverse.io/accountapi.weverse.io로 어떤 요청도 보내지 않았다
result: pass
source: automated
coverage_id: D4
plan: 06-07

### 37. [06-08 D1] 고지 확인 경로에서 settings:set-login-mode 쓰기가 실패하면 확인 결과가 실패로 반환되고, 모달이 열린 채 남으며, loginMode 상태가 바뀌지 않는다 (CR-01 해소)
expected: 고지 확인 경로에서 settings:set-login-mode 쓰기가 실패하면 확인 결과가 실패로 반환되고, 모달이 열린 채 남으며, loginMode 상태가 바뀌지 않는다 (CR-01 해소)
result: pass
source: automated
coverage_id: D1
plan: 06-08

### 38. [06-08 D2] 탭 클릭 경로는 저장 실패 시 예외를 던지지 않고 상단 배너로만 알린다 — 기존 동작 불변
expected: 탭 클릭 경로는 저장 실패 시 예외를 던지지 않고 상단 배너로만 알린다 — 기존 동작 불변
result: pass
source: automated
coverage_id: D2
plan: 06-08

### 39. [06-08 D4] LoginPanel 의 확인 핸들러가 로그인 방식 저장 함수를 prop 으로 받지 않는다 — CR-01 형태의 계약 불일치가 타입 수준에서 표현 불가능
expected: LoginPanel 의 확인 핸들러가 로그인 방식 저장 함수를 prop 으로 받지 않는다 — CR-01 형태의 계약 불일치가 타입 수준에서 표현 불가능
result: pass
source: automated
coverage_id: D4
plan: 06-08

### 40. [06-09 D1] validateToken() 4개 실패 지점 전용 상태 코드 기반 확정 한국어 안내 모듈(describeTokenValidationFailure())을 신설 — context 타입에 서버 텍스트 필드가 없다
expected: validateToken() 4개 실패 지점 전용 상태 코드 기반 확정 한국어 안내 모듈(describeTokenValidationFailure())을 신설 — context 타입에 서버 텍스트 필드가 없다
result: pass
source: automated
coverage_id: D1
plan: 06-09

### 41. [06-09 D2] validateToken()의 네 실패 지점(401 세션 복원 실패/!res.ok/JSON 파싱 실패/fanId 없음)이 emitTokenValidationFailure() 단일 관문으로 재배선되어, 서버 응답 원문이 더 이상 렌더러로 나가지 않는다
expected: validateToken()의 네 실패 지점(401 세션 복원 실패/!res.ok/JSON 파싱 실패/fanId 없음)이 emitTokenValidationFailure() 단일 관문으로 재배선되어, 서버 응답 원문이 더 이상 렌더러로 나가지 않는다
result: pass
source: automated
coverage_id: D2
plan: 06-09

### 42. [06-09 D3] 서버 응답 본문은 logService 진단 경로(rawBody.slice(0, 500) 라인)에 그대로 남아 관측성이 줄지 않았다
expected: 서버 응답 본문은 logService 진단 경로(rawBody.slice(0, 500) 라인)에 그대로 남아 관측성이 줄지 않았다
result: pass
source: automated
coverage_id: D3
plan: 06-09

### 43. [06-09 D4] 06-05-SUMMARY.md의 반증된 완료 선언(두 로그인 모드 공유 경로가 '자동으로 혜택을 받는다')이 D-11 관례로 정정됨 — 원문 보존, 두 위치(frontmatter/본문) 모두 [VOID] + 정정문
expected: 06-05-SUMMARY.md의 반증된 완료 선언(두 로그인 모드 공유 경로가 '자동으로 혜택을 받는다')이 D-11 관례로 정정됨 — 원문 보존, 두 위치(frontmatter/본문) 모두 [VOID] + 정정문
result: pass
source: automated
coverage_id: D4
plan: 06-09

### 44. [06-09 D5] 전체 회귀 없음 — 전체 테스트 스위트(339개, 06-08까지의 324개 기준선 대비 15개 증가) green, 두 typecheck(main/renderer) + build green, package.json/package-lock.json 무변경
expected: 전체 회귀 없음 — 전체 테스트 스위트(339개, 06-08까지의 324개 기준선 대비 15개 증가) green, 두 typecheck(main/renderer) + build green, package.json/package-lock.json 무변경
result: pass
source: automated
coverage_id: D5
plan: 06-09

### 45. [06-10 D1] SENSITIVE_PATTERNS 배열 맨 끝에 문맥 무관 JWT 형태 마스킹 규칙을 추가 — 키 이름 접두사 없이 문장에 섞인 토큰 형태 문자열도 마스킹되고, 도메인·파일 경로·버전 문자열·기존 진단 로그는 훼손되지 않는다
expected: SENSITIVE_PATTERNS 배열 맨 끝에 문맥 무관 JWT 형태 마스킹 규칙을 추가 — 키 이름 접두사 없이 문장에 섞인 토큰 형태 문자열도 마스킹되고, 도메인·파일 경로·버전 문자열·기존 진단 로그는 훼손되지 않는다
result: pass
source: automated
coverage_id: D1
plan: 06-10

### 46. [06-10 D2] buildFailureResult() 에 overrideMessage 4번째 선택 파라미터를 추가하고, btnEnabled 실패 분기가 이를 통해 마스킹 관문을 거치도록 재배선 — 사용자 문구는 글자 그대로 보존, 형제 분기와 동일하게 login-failed 이벤트 발행
expected: buildFailureResult() 에 overrideMessage 4번째 선택 파라미터를 추가하고, btnEnabled 실패 분기가 이를 통해 마스킹 관문을 거치도록 재배선 — 사용자 문구는 글자 그대로 보존, 형제 분기와 동일하게 login-failed 이벤트 발행
result: pass
source: automated
coverage_id: D2
plan: 06-10

### 47. [06-10 D3] 헤드리스 디버그 덤프 템플릿에서 이메일 원문 필드(emailValue)를 제거하고 길이 필드(emailLen)로 교체 — 293행 부근 기존 관용구와 동일한 형태
expected: 헤드리스 디버그 덤프 템플릿에서 이메일 원문 필드(emailValue)를 제거하고 길이 필드(emailLen)로 교체 — 293행 부근 기존 관용구와 동일한 형태
result: pass
source: automated
coverage_id: D3
plan: 06-10

### 48. [06-10 D4] 전체 회귀 없음 — 전체 테스트 스위트(354개, 06-09까지의 339개 기준선 대비 15개 증가) green, 두 typecheck(main/renderer) + build green, package.json/package-lock.json 무변경, 기존 테스트 무수정(삭제 줄 0)
expected: 전체 회귀 없음 — 전체 테스트 스위트(354개, 06-09까지의 339개 기준선 대비 15개 증가) green, 두 typecheck(main/renderer) + build green, package.json/package-lock.json 무변경, 기존 테스트 무수정(삭제 줄 0)
result: pass
source: automated
coverage_id: D4
plan: 06-10

## Summary

total: 48
passed: 48
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
