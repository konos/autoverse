---
phase: 05
slug: api
status: blocked
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 1
asvs_level: 1
created: 2026-08-25
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 헤드리스 Chromium 렌더러 → Electron main | 실제 weverse 로그인 페이지(우리 코드 아님)가 실행되는 렌더러의 네트워크 응답을 main 이 CDP 로 읽는다 | 신뢰할 수 없는 외부 응답 바디, 토큰 재료 |
| `persist:weverse` 쿠키 파티션 → `AuthService` | 브라우저 세션이 남긴 쿠키 값을 main 프로세스가 httpOnly 제약 없이 읽는다 | 자격증명급 비밀 (we2_access_token, rt) |
| `AuthService` → `logService` → 로그 파일 | 캡처한 토큰/응답 재료가 디스크에 영구 기록되는 지점 | 토큰 원문 (T-05-17 유출 지점) |
| `ApiAuthClient` → 외부 API (accountapi / fanevent) | 확보한 토큰이 외부 서버로 나가는 지점 | 베어러 토큰 |
| 계획 문서 → 미래 실행자 | 문서가 주장하는 "검증된 계약" 이 다음 실행자의 코드 전제가 된다 | 설계 전제 (무결성) |
| 사람(사용자) → 앱 로그인 폼 | 실계정 자격증명이 시스템에 들어오는 유일한 지점 | 실계정 이메일/비밀번호 |
| 에이전트 → 외부 실서버 | 에이전트가 직접 HTTP 를 쏘는 경로 (05-01 에서 실이메일 유출 선례) | 실계정 식별자 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | CDP 응답 처리 (`auth-service.ts`, `account-token-capture.ts`) | high | mitigate | `auth-service.ts:810` 이 `describeTokenShape()` 결과만 기록, 바디 전문 미기록. `mask.ts:50-52` 가 accessToken/refreshToken/otpSessionId 2차 방어선 | closed |
| T-05-02 | Information Disclosure | `summarizeCookies()` 쿠키 인벤토리 로그 | high | mitigate | `account-token-capture.ts:53-60` 이 name/domain/len/httpOnly 만 방출. `account-token-capture.test.ts:66-75` 가 픽스처 value 부재를 고정 | closed |
| T-05-03 | Elevation of Privilege | `webContents.debugger` attach 범위 | medium | mitigate | `auth-service.ts:260-271` 헤드리스 창 1개로 한정. `remote-debugging-port` 0건, `ipc-handlers.ts` debugger 노출 0건, `main.ts:25-27` openDevTools 는 isDev + mainWindow 한정 | closed |
| T-05-04 | Spoofing / 사용자 피해 | 저장된 다른 계정으로 자동 로그인 트리거 | high | mitigate | `auth-service.ts:170,212` API 모드 가드. `auth-service.test.ts:313` 멱등 테스트 (BrowserWindow 0회, by-credentials 0건) | closed |
| T-05-05 | Tampering | `ApiAuthClient` 의 electron/쿠키 파티션 결합 | medium | mitigate | `api-auth-client.ts` electron import 0건 (grep 재검증) | closed |
| T-05-06 | Denial of Service | 스파이크 HTTP 왕복이 로그인 응답 지연 | low | mitigate | `auth-service.ts:439` fire-and-forget. `spikeInFlight` 단일 비행 가드 (67/852/866/934) | closed |
| T-05-07 | Tampering | CDP 응답 바디가 예상과 다른 형태로 도착 | medium | mitigate | `extractAccessTokenFromResponseBody()` 예외 미발생 (try/catch + 타입 가드). `account-token-capture.test.ts:113-137` 6케이스 | closed |
| T-05-08 | Tampering | REQUIREMENTS.md / ROADMAP.md 전체 덮어쓰기로 인한 기록 소실 | high | mitigate | scoped Edit 강제. `### Phase 06`=1, `### Phase 07`=1 (grep 재검증) | closed |
| T-05-09 | Repudiation | 정정이 근거 없이 이루어져 되돌려짐 | medium | mitigate | `05-01-SUMMARY.md` 인용: REQUIREMENTS.md 3회, PROJECT.md 1회 (grep 재검증) | closed |
| T-05-10 | Information Disclosure | 정정 예시에 실계정 이메일/비밀번호/토큰 원문 기입 | high | mitigate | 3개 문서 전체에서 실계정 이메일 도메인 패턴 0건 (grep 재검증) | closed |
| T-05-11 | Information Disclosure | 캡차 우회 방법이 문서에 기록됨 | high | mitigate | 3개 문서에서 우회 방법 서술 0건 (R013 영구 제외 준수) | closed |
| T-05-12 | Information Disclosure | 에이전트가 실서버 프로브에 사용자 실이메일 재사용 | high | mitigate | `05-SPIKE-RESULT.md` §5 자체점검 1항 — 실이메일 프로브 0회. 문서 내 실도메인 이메일 0건 | closed |
| T-05-13 | Information Disclosure | 판정 문서에 토큰 값·응답 바디 전문 전사 | high | mitigate | `05-SPIKE-RESULT.md` 100자 이상 연속 토큰 문자열 0건, 실이메일 도메인 0건 (grep 재검증) | closed |
| T-05-14 | Spoofing / 사용자 피해 | 앱 시작 시 다른 계정 자동 로그인 → 알림 메일 | high | mitigate | `05-SPIKE-RESULT.md` §5 3항 — `credentials.enc` 존재/수정시각만 확인, 내용 미열람 | closed |
| T-05-15 | Repudiation | 실패를 flaky 로 오인해 재시도 → 반복 로그인 알림 | medium | mitigate | `05-SPIKE-RESULT.md` §2 — 사다리 정확히 1회 실행, 에이전트 재시도 요청 0회 | closed |
| T-05-16 | Elevation of Privilege | 판정 통과를 위한 캡차 우회/토큰 주입/파라미터 브루트포스 | high | mitigate | `05-SPIKE-RESULT.md` 캡차 우회 언급 0건. §6 의 departure 브루트포스는 미실행 "다음 단계 제안" 으로만 기록 | closed |
| **T-05-17** | **Information Disclosure** | **`auth-service.ts:423,704,1033,1038` 네비게이션 URL 로그** | **high** | **mitigate** | **없음 — `mask.ts` `SENSITIVE_PATTERNS` 는 camelCase `key:`/`key=` 형태만 매칭하며 snake_case URL 쿼리 파라미터 룰이 없다** | **open** |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Open Threat Detail — T-05-17

**출처:** 계획 시점 등록부에 없음. `05-03-SUMMARY.md` 의 `## Threat Flags` 에서 발견되어 등록부에 추가됨.

**실증 (감사관 수행):** 합성 리다이렉트 URL 로그 라인
(`"...navigated to https://weverse.io/loginResult?access_token=eyJ...&refresh_token=eyJ...&service_user_id=abc123"`)
을 실제 `maskSensitive()` 함수에 통과시킨 결과 **출력이 입력과 바이트 단위로 동일** — 토큰 값이 전혀
마스킹되지 않고 통과했다.

**현재 노출:** 가설이 아니다. `05-03-SUMMARY.md` 의 실계정 관측으로 인해 실제 `accessToken`/`refreshToken`
값이 사용자 로컬 로그 파일에 평문으로 존재한다:
`~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log`

**해소 조건:**
1. `src/shared/mask.ts` `SENSITIVE_PATTERNS` 에 snake_case URL 쿼리 파라미터 마스킹 룰 추가
   (`access_token=`, `refresh_token=`, `service_user_id=`)
2. 이미 기록된 로그 파일 정리 (별도 조치 — 코드 수정만으로는 소급 적용되지 않음)
3. `/gsd-secure-phase 05` 재실행

**스코프 근거:** `05-03-SUMMARY.md` 가 "코드 변경은 이 plan 스코프 밖(verification #5)이라 수정하지
않았다 — Phase 06/07 최우선 후보" 로 명시. 이번 감사에서 `block_on: high` 임계를 충족하여 차단 위협으로 승격.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks. (T-05-17 은 사용자 판단에 따라 수용하지 않고 수정 대상으로 유지 — 2026-08-25)

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-25 | 17 | 16 | 1 | gsd-security-auditor (ASVS L1, block_on: high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [ ] `threats_open: 0` confirmed — **1 open (T-05-17)**
- [ ] `status: verified` set in frontmatter

**Approval:** pending — blocked on T-05-17
