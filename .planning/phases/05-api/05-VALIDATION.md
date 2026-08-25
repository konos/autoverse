---
phase: 5
slug: api
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-25
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.6 |
| **Config file** | `vitest.config.ts` (프로젝트 루트) |
| **Quick run command** | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds (quick) / ~20 seconds (full, 163+ tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/main/services/__tests__/api-auth-client.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green AND the R019 실계정 스파이크 결과가 로그로 확보되어야 함
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | R019 | — | 실계정 토큰 교환이 성공하고 반환 토큰으로 fanevent API 호출이 200을 반환 | manual (checkpoint:human-verify) | 해당 없음 — 실계정 + 이메일 OTP 필요 | 해당 없음 | ⬜ pending |
| TBD | TBD | 0 | R017 | — | 요청 바디/헤더 조립 시 password가 로그에 남지 않음 | unit (fetch mock) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "otp-session"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | R017 | — | -26000/-25044/-25003 에러 코드를 손실 없이 상위로 전파 | unit (400/401 응답 스텁) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "error"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | R018 | — | by-credentials-with-otp 요청에 otpCode/otpSessionId 포함 | unit (fetch mock) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "otp verify"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | R018 | — | OTP 코드가 saveCredentials()로 저장되지 않음 | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "credentialLoginApi"` | ❌ W0 (기존 파일 확장) | ⬜ pending |
| TBD | TBD | 0 | R019 | — | 교환 호출의 헤더(Authorization Bearer)/바디(targetServiceId) 형태가 정확 | unit (fetch mock) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "exchange"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R019 | — | ApplyEngine이 authService.token을 코드 변경 없이 소비 (회귀) | unit (기존 커버) | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ✅ | ⬜ pending |

*Task ID는 플래너가 PLAN.md를 생성한 뒤 채워진다. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/services/__tests__/api-auth-client.test.ts` — R017/R018/R019 요청 조립 로직 커버 (신규 파일, `timing-service.test.ts`의 주입 fetch 패턴 재사용)
- [ ] `src/main/services/__tests__/auth-service.test.ts` — `credentialLoginApi`/`submitOtpApi` 케이스 추가 (기존 파일 확장, electron mock 패턴 재사용)
- [ ] 프레임워크 설치: **불필요** — vitest 이미 설치됨
- [ ] R019 실계정 스파이크 — `checkpoint:human-verify` 태스크로 Wave 0에 배치 (자동화 불가)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 실계정 API 로그인 → 토큰 교환 → 팬이벤트 API 호출 성공 | R019 | 실계정 자격증명과 이메일 OTP 수신이 필요해 자동화 불가. reCAPTCHA 우회는 영구 제외(R013)이므로 무인 자동화 경로가 존재하지 않음 | 1) 앱을 API 모드로 실행하고 사용자가 직접 이메일/비밀번호 입력 (개발자가 자격증명을 대신 다루지 않는다) 2) 수신된 6자리 OTP 입력 3) `by-credentials-with-otp` 응답의 accessToken 확보 확인 4) 폴백 순서대로 시도: ① 교환 없이 fanevent API 직접 호출 → ② `POST /v2/auth/token/by-access-token` (`{targetServiceId}`) 교환 후 호출 → ③ 헤드리스 브라우저 리다이렉트 체인 완주 5) `GET /api/fan-api/v1/fans/me`가 200 + fanId를 반환하면 PASS 6) 어느 경로가 통했는지 로그로 남긴다 |
| OTP 이메일이 실제로 발송됨 | R018 | 외부 메일 수신 확인 필요 | API 모드 로그인 제출 후 해당 계정 메일함에 6자리 코드가 도착하는지 확인. `expiresIn` 값과 실제 만료 시각이 일치하는지 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
