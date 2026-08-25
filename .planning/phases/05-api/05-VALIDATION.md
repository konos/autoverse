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
>
> **재작성됨 (2026-08-25)** — 이전 판본은 무효화된 3단계 OTP 로그인 계약 위에 서 있었다.
> 근거: `05-01-SUMMARY.md`, 재조사된 `05-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.6 |
| **Config file** | `vitest.config.ts` (프로젝트 루트) |
| **Quick run command** | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts src/main/services/__tests__/auth-service.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8 seconds (quick) / ~20 seconds (full, 195+ tests) |

---

## Sampling Rate

- **After every task commit:** Run the quick command above
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** 전체 스위트 green **AND** R019 실계정 체크포인트의 로그 산출물 확보 (둘 다 필요)
- **Max feedback latency:** 20 seconds

### 이 phase 고유의 Nyquist 제약

R019의 **결정적 신호는 반복 가능한 자동 테스트가 아니라 1회성 사람 관찰**이다. 표준 샘플링
주기는 자동화 가능한 항목(쿠키 판별 로직, CDP 파싱 로직, 사다리 자체)에만 적용된다. R019의
최종 판정은 이 주기 밖에서 **한 번** 일어난다.

플래너/실행자 주의: 이 체크포인트를 "실패해도 재시도하면 되는 자동 테스트"처럼 다루면 안 된다.
**실패는 곧 R019 반증**이므로 즉시 문서화하고 halt 절차를 밟는다 (05-01의 halt가 선례).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | R019 | — | 전체 쿠키 열거 결과에서 account 토큰 후보를 올바르게 판별 (순수 함수) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "accountTokenDiscovery"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | R019 | — | CDP 응답 바디 JSON에서 `accessToken`을 올바르게 추출 (순수 함수, Electron mock 불필요) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "extractAccessTokenFromResponseBody"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | R019 | — | 토큰 캡처 로그에 실제 토큰 값이 남지 않는다 (`maskToken` 경유, 길이/존재 여부만 기록) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "mask"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R019 (rung1) | — | account 토큰을 그대로 `/fans/me`에 써서 200이면 `source: "direct"` 처리 | unit (fetch mock, 기존) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "acquireFaneventToken"` | ✅ | ⬜ pending |
| TBD | TBD | 1 | R019 (rung2) | — | rung1 401 시 `by-access-token` 교환 후 재시도, 성공 시 `source: "exchange"` 처리 | unit (fetch mock, 기존) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "acquireFaneventToken"` | ✅ | ⬜ pending |
| TBD | TBD | 1 | R019 **(핵심 판정)** | — | 실계정으로 account 토큰 확보 → 사다리 통과 → `/fans/me` 200 + fanId | **manual (`checkpoint:human-verify`)** | 해당 없음 — 실계정 + 사람의 로그인 수행 필요 (D-06) | 해당 없음 | ⬜ pending |
| TBD | TBD | 1 | Success Criteria 3 | — | `ApplyEngine`이 `authService.token`을 코드 변경 없이 소비 (회귀) | unit (기존 커버) | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | R017 (D-05) | — | REQUIREMENTS.md에서 무효화된 3단계 서술이 제거됨 | 문서 검증 | `grep -c "otp-sessions" .planning/REQUIREMENTS.md` 결과가 R017 설명 줄에서 0 | 해당 없음 | ⬜ pending |

*Task ID는 플래너가 PLAN.md를 생성한 뒤 채워진다. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] account 토큰 **후보 판별 로직**을 순수 함수로 분리 — 입력은 쿠키 배열, 출력은 후보 하나.
      `session.cookies.get` 목 없이 테스트 가능해야 함
- [ ] **CDP 응답 바디 파싱 로직**을 순수 함수로 분리 — 입력은 JSON 문자열, 출력은 `accessToken`.
      `debugger.sendCommand` 목 없이 테스트 가능해야 함
- [ ] `src/main/services/__tests__/auth-service.test.ts` — 위 두 순수 함수 케이스 추가
      (기존 파일 확장, 기존 electron mock 패턴 재사용)
- [ ] `checkpoint:human-verify` 태스크 — R019 핵심 판정. 태스크 설명에 D-06(사용자가 로그인 수행,
      에이전트 측 프로브는 더미 이메일만) 준수를 명시
- [ ] 프레임워크 설치: **불필요** — vitest 이미 설치됨

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| account 토큰 확보 → 사다리 통과 → 팬이벤트 API 200 | R019 | 실계정 자격증명이 필요하고 실제 로그인 페이지의 reCAPTCHA를 사람이 통과해야 한다. 캡차 우회는 영구 제외(R013)이므로 무인 자동화 경로가 **존재하지 않는다.** D-06에 따라 로그인은 사용자가 직접 수행한다 | 1) 앱을 실행하고 **사용자가 직접** 이메일/비밀번호 입력 (에이전트는 자격증명을 다루지 않는다) 2) 헤드리스 창이 로그인을 완료하면 쿠키 열거 로그 확인 — account 토큰 후보가 잡혔는가 3) 잡히지 않았다면 CDP 폴백이 `by-credentials` 200 응답에서 `accessToken`을 캡처했는지 로그로 확인 4) 사다리 실행 로그 확인: rung1(direct) 결과 → 실패 시 rung2(exchange) 결과 5) `GET /api/fan-api/v1/fans/me`가 200 + fanId 반환이면 **PASS** 6) 어느 rung이 통했는지(`source: direct` / `exchange`) 반드시 기록 7) 둘 다 실패하면 **R019 반증** — 재시도하지 말고 halt 후 결과 문서화 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
