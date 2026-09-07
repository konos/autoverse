---
phase: 07
slug: api
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-09-07
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

레지스터는 7개 PLAN(`07-01` ~ `07-07`)의 `<threat_model>` 블록에서 구성됐다
(`register_authored_at_plan_time: true`). SUMMARY 7개 전부에 `## Threat Flags`
섹션이 없어 — 실행 중 계획 밖의 새 공격 표면이 보고된 사례는 0건이다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → main (`auth:*` IPC) | 렌더러가 보낸 이메일이 메인의 로그인 실행 결정에 쓰인다. 렌더러는 신뢰할 수 없는 입력원. | 이메일(평문) — 비밀번호는 이 경계를 넘지 않는다 (D-01) |
| main → 디스크 (`credentials.enc`) | safeStorage 로 암호화된 이메일+비밀번호. 복호화 결과는 메인 프로세스 메모리를 벗어나지 않는다. | 이메일 + 비밀번호(암호화 저장) |
| main → Weverse (헤드리스 로그인) | 저장 자격증명으로 실제 외부 로그인 요청이 나간다 — 알림 메일 발송이라는 되돌릴 수 없는 부수효과를 동반한다. | 이메일 + 비밀번호(TLS) |
| main → Weverse (신청 POST) | 대기 종료 후 실제로 서버에 가는 `Authorization: Bearer` 값. | 액세스 토큰 |
| main(ApplyEngine) → renderer (`apply:event`) | 만료 판정 결과가 IPC 이벤트로 렌더러에 전달된다. payload 에 토큰 원문이 실리면 R010 위반. | 판정 상태/시각만 |
| main → 로그 파일 | 이메일·토큰이 로그로 흐를 수 있는 경로. R010 마스킹 관문 대상. | 마스킹된 이메일 |
| Weverse 서버 → 앱 | `we2_access_token` JWT 의 `exp` 클레임. 서버 서명값이며 앱은 검증 없이 파싱만 한다 (D-08). | JWT 클레임 |
| renderer 버튼 상태 → 실제 로그인 실행 | 렌더러 `disabled` 는 관문이 아니다. 최종 판정은 메인이 다시 한다 (WR-03). | UI 상태 (비신뢰) |
| 문서(ROADMAP/REQUIREMENTS) → 검증 판정 | 반증된 서술이 남으면 검증자가 없는 기능을 기준으로 오판한다. | 검증 기준 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Information Disclosure | 비밀번호의 공개 타입/IPC 경계 노출 | high | mitigate | `types.ts:265-269,291-302,320` — `StoredCredentialsSnapshot`/`CredentialLoginResult`/`credentialLoginStored(email)` 어디에도 password 필드 없음. `ipc-handlers.ts:82-87` email 만 수신. `LoginPanel.tsx:71,363` `setPassword` 는 사용자 입력 onChange 한 곳뿐, 프리필은 email(:92)만 | closed |
| T-07-02 | Tampering | 저장 자격증명 이메일 게이트 | high | mitigate | `auth-service.ts:254-267` trim+lowercase 정규화 비교, 불일치 시 `credentialLogin()` 미호출. `App.tsx:225` 대기 중 재로그인도 동일 경로 경유 | closed |
| T-07-03 | Information Disclosure | 이메일 표시/로그 경로 | medium | mitigate | `mask.ts:44-54` `maskEmail()` 단일 관문 + `:89` `SENSITIVE_PATTERNS` email 규칙. `login-panel-view.ts:190` statusLine 은 `maskEmail()` 통과값만 사용 | closed |
| T-07-04 | Denial of Service | 손상된 `credentials.enc` | medium | mitigate | `auth-service.ts:153-193` — safeStorage 불가(:153-158)는 파일 보존, 복호화/파싱/필드형식 실패(:162-193)만 `clearCredentials()`. `login-panel-view.ts:212-228` corrupted/unavailable 문구·삭제버튼 분리 | closed |
| T-07-05 | Tampering | 신규 IPC 채널 인자 / `settings:set-login-mode` | medium | mitigate | `ipc-handlers.ts:82-85` `typeof email !== "string"` 검사. `settings-store.ts:123-126` `setLoginMode()` 값 검증 후 위반 시 쓰기 전 throw | closed |
| T-07-06 | Spoofing | `apply-engine.execute()` 의 토큰 캡처 | high | mitigate | `apply-engine.ts:233-235` 대기 종료 직후 `freshToken = authService.token` 재조회, null 이면 UNAUTHORIZED. POST(:287)/tokenPreview(:313)/폴링(:322) 전부 freshToken 사용 | closed |
| T-07-07 | Denial of Service | `credentialLogin()` 실패 시 토큰 상실 | high | mitigate | `auth-service.ts:386` 쿠키 제거(:388) 직전 `previousToken` 백업, `restoreTokenIfLost()` 가 :517/:637/:645 세 실패 지점에서 복원 | closed |
| T-07-08 | Repudiation | `exp` 판독 실패의 `unknown` 3번째 상태 | medium | mitigate | `token-expiry.ts:44-57` `parseJwtExpMs()` 모든 실패 경로 `null` 반환 — "안전"으로 흡수하지 않음. `auth-service.ts:1265-1290` `isTokenExpired()` 의 폴백은 복제되지 않은 독립 구현 | closed |
| T-07-09 | Tampering | 연속 클릭에 의한 중복 헤드리스 로그인 | medium | mitigate | `auth-service.ts:364-372,648-650` `credentialLoginInFlight` 가드가 창 오픈 전 실패 반환, `finally` 해제 | closed |
| T-07-10 | Information Disclosure | 렌더러 메모리의 저장 이메일 평문 | low | accept | Accepted Risks Log R-07-01 참조 | closed |
| T-07-11 | Information Disclosure | `token-expiry-checked` 이벤트 payload | medium | mitigate | `apply-engine.ts:424-433` payload 가 `status`/`expAt`/`plannedSubmitAt`/`headroomMs` 넷으로 고정, 토큰 원문 없음 | closed |
| T-07-12 | Denial of Service | `arm()` 안의 만료 판정 예외 | low | accept | Accepted Risks Log R-07-02 참조 | closed |
| T-07-13 | Tampering | `credentials.enc` 비원자적 쓰기 | low | accept | Accepted Risks Log R-07-03 참조 | closed |
| T-07-14 | Denial of Service | `checkTokenExpiry()` 반복 호출 | low | mitigate | `apply-engine.ts:155-160` 순수 계산 + 이벤트 발행뿐, `phase`/`postSubmitted` 미접근. `relogin-expiry-recheck.test.ts` 재판정 전후 동일성 테스트 PASS | closed |
| T-07-15 | Tampering | 신규 채널의 cleanup 누락 | low | mitigate | `ipc-handlers.ts:188-190,200` 신규 4채널 전부 `removeHandler` 대칭 등록 | closed |
| T-07-16 | Repudiation | 삭제 버튼이 로그인 상태에만 노출되던 구조 | medium | mitigate | `LoginPanel.tsx:287-308` 저장 상태 블록이 `loginMode === "api"` 조건뿐 — `status.isLoggedIn` 밖으로 이동 | closed |
| T-07-17 | Denial of Service | 인증 이벤트의 파괴적 네비게이션 | high | mitigate | `auth-event-navigation.ts:36-60` exhaustive switch — `apply-execution` 에서 `logged-out` 외 전부 `stay`. `App.tsx:65,82,89,97,103,109,115` `setStep`/`setFormSchema` 가 `decision.action` 분기 안에서만 호출 | closed |
| T-07-18 | Repudiation | 재로그인 버튼의 조용한 실패 | medium | mitigate | `App.tsx:232-240` snapshot state(none/corrupted/unavailable)별 `setLoginError` 배너 설정 | closed |
| T-07-19 | Repudiation | 반증된 문서 서술 잔존 | medium | mitigate | `ROADMAP.md:37,38,80,87,141,174` + `REQUIREMENTS.md:174,187,208,225,308-309` `[VOID — …]` 마킹 + 정정문 병기, 원문 삭제 없음 | closed |
| T-07-21 | Tampering | `apply:check-token-expiry` 를 통한 신청 상태 변조 | high | mitigate | 07-06 은 `apply-engine.ts` 를 수정하지 않음(SUMMARY files_modified 부재). `relogin-expiry-recheck.test.ts` "재판정 전후 phase/postSubmitted 동일" PASS | closed |
| T-07-22 | Information Disclosure | `token-expiry-checked` payload 형태 불변 | medium | mitigate | T-07-11 과 동일 코드, 07-06 diff 에 `apply-engine.ts` 없음 — email/token 추가 없음 | closed |
| T-07-23 | Denial of Service | 인증 이벤트마다의 재판정 IPC 호출 | low | accept | Accepted Risks Log R-07-04 참조 | closed |
| T-07-24 | Spoofing | 옛 토큰으로 경고가 해제되는 거짓 안심 | high | mitigate | `_evaluateCurrentTokenExpiry()`(`apply-engine.ts:414-436`)가 매번 현재 `authService.token` 만 읽음 — "시도했다"가 입력에 없음. 실패 대조군(토큰 미교체 → `visible: true` 유지) 테스트 PASS | closed |
| T-07-25 | Denial of Service | 재로그인 버튼 잠금 해제 실패 | medium | mitigate | `App.tsx:216,245-259` `loginLoading` 단일 lock, `finally` 무조건 해제. `ApplyExecution.tsx:248-249` `disabled`/`aria-busy` 가 `reloginLoading` 하나로 배선 | closed |
| T-07-26 | Information Disclosure | `completeCredentialLoginSuccess()` 가 평문 비밀번호를 새 경로로 옮김 | high | mitigate | `auth-service.ts:673-677` 본문 정확히 3줄(`saveCredentials`+`cleanupHeadless`+`return`), 자체 로그 없음. `saveCredentials()`(:117)는 `maskEmail(email)` 만 로그 | closed |
| T-07-27 | Information Disclosure | 반환 타입에 비밀번호 필드 신설 | high | mitigate | `src/shared/types.ts` 가 07-07 커밋 diff 에 전혀 등장하지 않음(마지막 변경은 07-03 `2820c10`). `CredentialLoginResult` 에 password 필드 없음 | closed |
| T-07-28 | Tampering | timeout→쿠키 경로 저장 이메일의 계정 불일치 가능성 | medium | mitigate | `credentialLogin(email,password)`(`auth-service.ts:359`) 스코프 내 인자 재할당 없음 — :609/:615 가 헤드리스 창이 실제 입력한 그 인자를 그대로 전달. D-03 게이트는 `loginWithStoredCredentials()` 가 별도 소유, 우회 경로 없음 | closed |
| T-07-29 | Repudiation | 저장 상태 안내가 낡은 채 잔존 | medium | mitigate | `LoginPanel.tsx:171-174,191-194` 두 로그인 경로의 `finally` 가 대칭적으로 `refreshStoredSnapshot()` 호출 | closed |
| T-07-30 | Information Disclosure | `getStoredCredentials` IPC 호출 빈도 증가 | low | accept | Accepted Risks Log R-07-05 참조 | closed |
| T-07-SC | Tampering | npm/pip/cargo installs (공급망) | high | accept | Accepted Risks Log R-07-06 참조 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-07-01 | T-07-10 | 렌더러가 받는 저장 이메일 평문은 D-01 이 명시적으로 허용한 범위이며, 사용자가 폼에 직접 입력하던 값과 같은 노출 등급이다. 단일 사용자 로컬 데스크톱 앱. 비밀번호에는 이 인수가 적용되지 않는다 — 감사 시 `StoredCredentialsSnapshot` 에 password 갈래가 타입 수준으로 존재하지 않음을 확인(T-07-01 증거). | konos | 2026-09-07 |
| R-07-02 | T-07-12 | 만료 판정이 예외로 `arm()` 을 실패시키면 선착순 이벤트를 놓친다. `parseJwtExpMs()`(`token-expiry.ts:44-57`)가 `!token` 가드 + try/catch 로 전면 감싸여 어떤 입력에도 throw 하지 않음을 감사로 확인 — 잔여 위험(예상 밖 예외)만 낮은 확률·낮은 영향으로 인수한다. | konos | 2026-09-07 |
| R-07-03 | T-07-13 | `saveCredentials()`(`auth-service.ts:109-118`)는 `fs.writeFileSync` 직접 호출이라 원자적 쓰기(tmp+rename)가 아니다. 부분 쓰기가 발생해도 T-07-04 의 손상 감지 → 삭제 → 재입력 안내로 수렴함이 코드로 확인됐고, 단일 사용자 데스크톱 앱에서 동시 쓰기 확률이 낮다. 원자적 쓰기 도입은 별도 항목. | konos | 2026-09-07 |
| R-07-04 | T-07-23 | `_evaluateCurrentTokenExpiry()`(`apply-engine.ts:414-436`)는 외부 호출 0의 로컬 계산이고, `shouldRecheckTokenExpiry()`(`auth-event-navigation.ts:89-99`)의 트리거가 정확히 5종(exhaustive switch)으로 한정됨을 확인. 폭주 상한은 `AuthService` 의 기존 이벤트 발행 빈도에 종속된다. | konos | 2026-09-07 |
| R-07-05 | T-07-30 | `auth:get-stored-credentials` 핸들러(`ipc-handlers.ts:73-75`)의 시그니처·반환 타입이 07-07 에서 미변경(types.ts diff 없음). 호출 빈도만 늘고 노출 필드 집합은 이메일 하나로 불변이며 표시 시 `maskEmail()` 관문을 지난다. | konos | 2026-09-07 |
| R-07-06 | T-07-SC | Phase 07 전체(커밋 30건)에서 `package.json` 변경 0건 — 신규 외부 의존성 추가가 없어 공급망 위협 표면이 이 phase 에서 열리지 않는다. 향후 패키지 설치가 필요해지면 이 인수는 무효이며 package legitimacy 게이트를 먼저 통과해야 한다. | konos | 2026-09-07 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-07 | 30 | 30 | 0 | gsd-security-auditor (retroactive, State B) |

### Security Audit 2026-09-07

| Metric | Count |
|--------|-------|
| Threats found | 30 |
| Closed | 30 |
| Open | 0 |

- 검증 심도: 요구는 ASVS L1(grep-level 존재 확인)이었으나 실제로는 경계 배치·데이터 흐름까지 추적하고 관련 테스트를 직접 실행해 L2~L3 수준으로 수행됐다.
- `npx vitest run` 474/474 PASS, `npm run typecheck` / `npm run typecheck:main` 클린 — T-07-01/T-07-27 의 타입 수준 보장이 컴파일러에 의해 실제로 강제됨을 확인.
- `src/__tests__/relogin-expiry-recheck.test.ts` 6/6 PASS — T-07-21/T-07-24 의 핵심 증거인 "토큰 미교체 시 배너 유지" 실패 대조군 케이스가 실제로 통과.
- 오케스트레이터가 high 위협 4건(T-07-02/06/26/27)의 파일·라인 증거를 독립 spot-check 로 재확인했다.
- 미등록 위협 플래그: 0건 (SUMMARY 7개 전부에 `## Threat Flags` 섹션 부재).
- 감사 중 `mask.ts` 의 `?access_token=` 문자열에 낮은 심각도 인젝션 스캔 플래그가 떴으나, R010 마스킹 정규식이 다루는 URL 쿼리 형식을 설명하는 주석이었다 — 오탐.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-07
