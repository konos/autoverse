---
phase: 06
slug: ui
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-26
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

레지스터 출처: 10개 `*-PLAN.md` 전부의 `<threat_model>` 블록
(`register_authored_at_plan_time: true`). ASVS L1 · `security_block_on: high`
이므로 검증 깊이는 grep-level 이며, 단축 규칙(threats_open 0 + 계획 시점 레지스터
+ L1)에 따라 별도 감사 에이전트는 실행하지 않았다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 렌더러 → main (contextBridge IPC) | 렌더러가 보내는 모드 값은 신뢰하지 않는다 — main 이 `"api" \| "browser"` 로 정규화 | 로그인 모드 문자열, 고지 확인 버전 |
| 디스크 → main (`settings.json`) | 사용자/타 프로세스가 직접 편집 가능한 평문 파일. 파싱은 방어적 | 3필드 설정 스키마 (민감정보 없음) |
| `process.env` → main | 개발/QA 덮어쓰기 입력. UI 에 원문 미노출 | `AUTOVERSE_LOGIN_MODE` 원문 |
| Weverse DOM/서버 응답 → 앱 | 완전히 통제 밖의 임의 문자열. 길이·구조·내용 무가정 | 실패 문구, 식별자, 토큰 검증 응답 본문 |
| main `AuthEvent.message` → 렌더러 화면 | `_emit()` 은 logService 자동 마스킹을 거치지 않는 별도 경로 | 사용자 안내 문구, 마스킹된 식별자 |
| 앱 → Weverse 서버 | 외부 로그인 요청이 실계정에 보안 이벤트를 발생시킴 | 자격증명, 세션 쿠키 |
| 저장된 자격증명(`credentials.enc`) → 로그인 실행 | 사용자 의사 없이 자격증명이 쓰일 수 있는 지점 | safeStorage 암호화 자격증명 |
| 헤드리스 디버그 덤프 → 로그 파일 | 진단 목적 수집이 디스크에 PII 를 남기는 경로 | 이메일/비밀번호 입력값 |
| 에이전트 → 사용자 실계정 | 05-CONTEXT D-06 이 금지하는 유일한 외부 로그인 촉발 지점 | 실계정 자격증명 |
| 문서 → 후속 구현자/에이전트 | 틀린 서술이 남으면 코드로 전파 | 요구사항·로드맵·SUMMARY 서술 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Tampering | `settings.json` 파싱 (`settings-store.ts`) | low | mitigate | 필드별 화이트리스트 정규화 + 파싱 실패 시 기본값 폴백 — `settings-store.ts:60` `parsed.loginMode === "api" ? "api" : DEFAULT_LOGIN_MODE` | closed |
| T-06-02 | Tampering | 쓰기 중단으로 인한 부분 기록 파일 | low | mitigate | tmp + `renameSync` 원자 교체, 실패 시 tmp 정리 — `settings-store.ts:77-88` | closed |
| T-06-03 | Information Disclosure | 잠금 상태 표시가 env 원문 노출 | low | mitigate | IPC 가 `lockedByEnv: boolean` 만 전달 (`types.ts:235`); 렌더러 `process.env` 접근 0건 | closed |
| T-06-04 | Information Disclosure | 설정 파일에 민감정보 혼입 | medium | mitigate | 3필드 스키마 고정 (`settings-store.ts:31,42,59`); 자격증명은 `credentials.enc`(safeStorage) 전용 | closed |
| T-06-05 | Spoofing | 렌더러가 임의 문자열을 모드로 주입 | low | mitigate | main 이 `"api"` 정확 일치만 승격, 나머지 `"browser"` 정규화 | closed |
| T-06-06 | Information Disclosure | `LoginFailureGuidance.identifier` 가 토큰/쿼리스트링 전달 | high | mitigate | 호출부 마스킹 계약 — `auth-service.ts:528` `result.identifier = maskSensitive(guidance.identifier)`; 06-05 회귀 테스트 | closed |
| T-06-07 | Denial of Service (UI) | 외부 DOM 텍스트 과길이로 화면 밀림 | low | mitigate | `FORM_ERROR_MAX_LENGTH = 120` 상한 + 말줄임 (`login-failure.ts:35,85,88`) | closed |
| T-06-08 | Spoofing | Weverse 폼 텍스트가 앱 안내처럼 보임 | low | accept | D-12 의 명시적 결정. 마스킹 + 길이 상한으로 피해 표면 제한 — AR-01 참조 | closed |
| T-06-09 | Tampering (정보 무결성) | 반증된 서술이 문서에 남아 재전파 | medium | mitigate | VOID 마킹 + 정정문 병기 — REQUIREMENTS.md 4건 / ROADMAP.md 6건 | closed |
| T-06-10 | Repudiation | 삭제 편집으로 "왜 틀렸는지" 기록 소실 | medium | mitigate | 원문 보존 — `-25044` 잔존 REQUIREMENTS.md 3건 / ROADMAP.md 2건 | closed |
| T-06-11 | Tampering | 전체 덮어쓰기로 타 phase 항목 소실 | medium | mitigate | 국소 치환만 허용; Phase 05/07 섹션 잔존 확인 | closed |
| T-06-12 | Spoofing (계정 오용) | `tryAutoLogin()` 의 무인 `credentialLogin()` | high | mitigate | 두 모드 모두에서 무인 호출 제거 — `auth-service.ts:151-178` 은 쿠키 세션 복원만 수행; `trySessionRestore()` 동일 | closed |
| T-06-13 | Tampering | 반증된 로그인 경로 잔존 → 재배선 | high | mitigate | `submitOtp` / `credentialLoginApi` 비테스트 코드 잔존 1건(mask.ts 주석)뿐 — 실행 경로 0건 | closed |
| T-06-14 | Denial of Service (사용자) | 삭제된 IPC 채널 호출로 무응답 | medium | mitigate | 렌더러 호출부 제거 + 타입 시그니처 삭제로 컴파일 타임 노출; `typecheck` 0 에러 | closed |
| T-06-15 | Information Disclosure | 삭제 과정에서 R019 자산(사다리·교환) 손상 | medium | mitigate | `api-auth-client.test.ts` 4개 describe(`acquireFaneventToken`/`exchangeForService`/`probeFaneventToken`/`validateToken`) 유지·통과 | closed |
| T-06-16 | Elevation of Privilege | reCAPTCHA 우회 코드 혼입 | high | mitigate | R013 영구 제외. `auth-service.ts:382-383` 는 위젯 감지 후 `'captcha'` 반환만 — 해결 코드 0건 | closed |
| T-06-17 | Information Disclosure | `CredentialLoginResult.message`/식별자 원문 노출 | high | mitigate | `auth-service.ts:525,528` 반환 직전 `maskSensitive()` 적용 + 마스킹 회귀 테스트 | closed |
| T-06-18 | Elevation of Privilege | 캡차 우회/자동 해결 코드 유입 | high | mitigate | R013 영구 제외 — 감지→안내까지만 | closed |
| T-06-19 | Denial of Service (사용자 시간) | 캡차를 OTP 로 오독 | high | mitigate | union 에서 `"otp"` 제거(0건), `'captcha'`/`'otp-form'` 신호 분리 (`login-failure.ts:41,43,57`) + 전 사유 테이블 테스트 | closed |
| T-06-20 | Repudiation | 사다리 실패가 로그에만 남음 | medium | mitigate | `login-failed` 이벤트 발행 (`auth-service.ts:345,467,474`) → `App.tsx:58` 소비 | closed |
| T-06-21 | Tampering (신뢰성) | 해시 기반 CSS 셀렉터 파손 → 오분류 | medium | mitigate | `raw: string \| null` 설계, `null` → 미매핑 폴백 (`login-failure.ts:51,53`) + `null` 케이스 테스트 | closed |
| T-06-22 | Repudiation | Esc/취소가 확인으로 처리돼 고지 없이 API 모드 저장 | high | mitigate | `decideTabClick()` (`login-panel-view.ts:69`) 로 확인/취소 경로 분리 + 전수 테스트 | closed |
| T-06-23 | Information Disclosure | 잠금 배지가 env 원문 노출 | low | mitigate | 불리언만 전달, 고정 모드 라벨만 삽입; 렌더러 `process.env` grep 0건 | closed |
| T-06-24 | Information Disclosure | 식별자 칩이 미마스킹 값 표시 | high | mitigate | 마스킹은 main 단일 지점; 렌더러 `maskSensitive` 호출 0건 (grep 검증) | closed |
| T-06-25 | Denial of Service (사용자) | 좁은 창에서 확인 버튼 도달 불가 | medium | mitigate | `.notice-modal-body { max-height:50vh; overflow-y:auto }`, `.button-row` 는 스크롤 영역 밖 (`styles.css:399,417`) — UAT Test 2 실행 확인 | closed |
| T-06-26 | Tampering | 잠금 상태에서 전환 버튼으로 우회 변경 | medium | mitigate | `resolveTabView()` 가 `tabsDisabled`/`showBadge` 를 `lockedByEnv` 단일 입력에서 파생 (`login-panel-view.ts:23-27,70`) — UAT Test 7 실행 확인 | closed |
| T-06-27 | Spoofing (계정 오용) | 에이전트가 실계정으로 로그인 시도 | high | mitigate | 절차적 통제 — 로그인은 사용자가 수행, 에이전트는 로그만 읽음. 06-07/06-08 SUMMARY 의 명령 이력으로 준수 확인; UAT Test 8 도 사용자 수행 | closed |
| T-06-28 | Repudiation | 미관측 항목이 통과로 기록됨 | high | mitigate | 통과/실패/미관측 3분류 강제; 캡차 하위 항목만 미관측 허용 — 06-UAT.md Test 8 지시문에 명시 | closed |
| T-06-29 | Elevation of Privilege | 캡차 인위 유발·우회 시도 | high | mitigate | R013 영구 제외 — 유발 금지가 prohibitions 및 UAT 지시문에 고정 | closed |
| T-06-30 | Repudiation | 고지 확인 흐름이 저장 실패를 성공으로 보고 (CR-01) | high | mitigate | `acknowledgeApiModeNotice` 가 실패를 반환값으로 전달하는 strict 헬퍼로 분리 (`login-mode-actions.ts:11,17,48`) + RED 회귀 테스트 | closed |
| T-06-31 | Tampering (상태 무결성) | 확인 버전만 영속된 어긋난 설정 상태 | high | mitigate | 06-08 Task 2 Test 5/6 이 어긋난 상태를 관측 가능하게 만들고, 실패 시 모달이 열린 채 유지 | closed |
| T-06-32 | Repudiation | 저장 진행 중 Esc 취소 후 뒤늦은 성공 적용 (WR-01) | medium | mitigate | `decideNoticeCancel(saving)` (`login-panel-view.ts:143`) 이 저장 중 취소를 무시 — 두 진입 경로가 이 단일 지점 경유 (`LoginPanel.tsx:114-116`) · UAT Test 3 실행 확인 | closed |
| T-06-33 | Information Disclosure | 저장 실패 진단이 devtools 콘솔에만 남음 (IN-03) | low | accept | 새 IPC 계약 신설은 범위 밖. `onDiagnostic` JSDoc 에 devtools 전용 명시 — AR-02 참조 | closed |
| T-06-34 | Information Disclosure | `validateToken()` 실패 emit 이 응답 원문 200자 노출 (CR-02, R010) | high | mitigate | `describeTokenValidationFailure()` 확정 문구만 렌더러로 전달 (`auth-service.ts:1019,1035`); 인자 타입에서 텍스트 필드 제거로 구조적 봉인 | closed |
| T-06-35 | Information Disclosure | 마스킹의 키-값 문맥 의존 때문에 감싸기만으로는 불충분 (WR-02) | high | mitigate | 감싸기(A안) 기각, 구조적 제거(B안) 채택. 키 접두사 없는 토큰 픽스처 회귀 테스트 | closed |
| T-06-36 | Repudiation | 06-05-SUMMARY 의 거짓 완료 선언이 재검증 생략 근거가 됨 | medium | mitigate | D-11 관례로 두 곳 정정, 원문 보존 (06-05-SUMMARY.md 정정 마킹 2건) | closed |
| T-06-37 | Denial of Service (진단 가치) | 고정 문구 대체로 진단 정보 소실 | low | mitigate | `auth-service.ts:967` 의 `validateToken body: ${rawBody.slice(0, 500)}` 진단 라인 생존 (logService 자동 마스킹 경유) | closed |
| T-06-38 | Tampering | 실패 신호 union 변경으로 ROADMAP SC3 계약 흔들림 | medium | mitigate | `token-validation-failure.ts` 별도 모듈; `login-failure.ts` 무변경·참조 0건 | closed |
| T-06-39 | Information Disclosure | 문맥 없는 JWT 형태 문자열이 키-값 규칙 통과 (WR-02) | medium | mitigate | 구조 기반 2차 방어선 규칙 추가 (`mask.ts:69`) — 1차는 06-09 의 "서버 텍스트 미진입" | closed |
| T-06-40 | Information Disclosure | 버튼 비활성 실패 분기가 마스킹 관문 우회 (WR-03) | medium | mitigate | `auth-service.ts:316-339` 이 `"unknown"` + overrideMessage 로 `buildFailureResult()` 관문 경유 | closed |
| T-06-41 | Information Disclosure | 헤드리스 디버그 덤프가 이메일 평문 기록 (IN-02, R010) | medium | mitigate | 값 필드를 길이 필드로 교체 — `auth-service.ts:293-294,325-326` `emailLen`/`pwLen` | closed |
| T-06-42 | Tampering (진단 손상) | 과도한 JWT 정규식이 정상 진단 텍스트 훼손 | medium | mitigate | 음성 케이스 4건 요구 + 기존 스위트 무수정 통과 강제 — `npm test` 315 tests / 0 failures | closed |
| T-06-43 | Repudiation | 2차 방어선을 근거로 원문 전달이 재허용됨 | medium | mitigate | `mask.ts:79` 주석이 규칙의 불완전성(점 3분절 아닌 토큰은 통과)을 명시 | closed |
| T-06-SC | Tampering | npm/pip/cargo 설치 (공급망) | high | mitigate | phase 06 전체 신규 의존성 0건 — `git diff --stat -- package.json package-lock.json` 공백; deps 2 / devDeps 9 로 phase 시작 시점과 동일 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-06-08 | Weverse 로그인 폼이 실제로 표시한 텍스트를 사용자에게 그대로 전달하는 것이 D-12 의 명시적 결정이다. `maskSensitive()` 마스킹과 `FORM_ERROR_MAX_LENGTH = 120` 길이 상한으로 피해 표면을 제한한 뒤 수용한다. severity low — 블로킹 임계값(high) 미만. | 06-02-PLAN (D-12) | 2026-08-26 |
| AR-02 | T-06-33 | 렌더러→main 오류 포워딩 채널 신설은 기존 gap 어느 쪽과도 뿌리를 공유하지 않는 새 IPC 계약이다. `onDiagnostic` JSDoc 에 devtools 전용임을 명시하는 선에서 수용하고 채널 신설은 후속 phase 후보로 남긴다. severity low — 블로킹 임계값(high) 미만. | 06-08-PLAN (IN-03) | 2026-08-26 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-26 | 44 | 44 | 0 | /gsd-secure-phase 06 (orchestrator, ASVS L1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-26
