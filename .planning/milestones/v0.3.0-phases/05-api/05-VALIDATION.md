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
| 05-01-T1 (tracer) | 05-01 | 1 | R019 | T-05-02 | 전체 쿠키 열거 결과에서 account 토큰 후보를 올바르게 판별 (순수 함수) | unit | `npx vitest run src/main/services/__tests__/account-token-capture.test.ts -t "accountTokenDiscovery"` | ❌ T1이 생성 | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | R019 | T-05-07 | CDP 응답 바디 JSON에서 `accessToken`을 올바르게 추출 (순수 함수, Electron mock 불필요) | unit | `npx vitest run src/main/services/__tests__/account-token-capture.test.ts -t "extractAccessTokenFromResponseBody"` | ❌ T2가 추가 | ⬜ pending |
| 05-01-T1 / 05-01-T3 | 05-01 | 1 | R019 | T-05-01, T-05-02 | 토큰/쿠키 캡처 로그에 실제 값이 남지 않는다 (길이·형태만 기록, `SENSITIVE_PATTERNS` 2차 방어) | unit | `npx vitest run src/main/services/__tests__/account-token-capture.test.ts -t "masking" && npx vitest run src/shared/__tests__/mask.test.ts -t "accessToken"` | ❌ T1/T3이 생성 | ⬜ pending |
| 05-01-T1 (tracer) | 05-01 | 1 | R019 **(종단)** | T-05-04, T-05-06 | 쿠키 열거 → 후보 판별 → 사다리 → verdict 한 줄기가 통째로 동작하고, 멱등·단일비행·비침습이 보장된다 | unit (종단, electron mock + fetch mock) | `npx vitest run src/main/services/__tests__/auth-service.test.ts -t "runAccountTokenLadderSpike"` | ❌ T1이 생성 | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | R019 (rung1) | — | account 토큰을 그대로 `/fans/me`에 써서 200이면 `source: "direct"` 처리 | unit (fetch mock, 기존) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "acquireFaneventToken"` | ✅ | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | R019 (rung2) | — | rung1 401 시 `by-access-token` 교환 후 재시도, 성공 시 `source: "exchange"` 처리 + 응답 키 관측 | unit (fetch mock, 기존 + 신규) | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts -t "exchangeForService"` | ✅ | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | R019 | T-05-05 | `ApiAuthClient`가 Electron/쿠키 파티션과 결합하지 않는다 (Pitfall 4) | 소스 게이트 | `test "$(grep -cE '^[[:space:]]*import .* from "electron"' src/main/services/api-auth-client.ts)" = "0"` | ✅ | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | R017 / R018 (D-05) | T-05-08, T-05-09 | REQUIREMENTS.md에서 무효화된 3단계 서술이 R017 항목에서 제거되고 R018이 blocked·매핑 해제된다 | 문서 검증 | `test "$(sed -n '/^### R017/,/^### R018/p' .planning/REQUIREMENTS.md \| grep -c 'otp-sessions')" = "0"` | 해당 없음 | ⬜ pending |
| 05-02-T2 | 05-02 | 1 | R017 (D-05) | T-05-10, T-05-11 | PROJECT.md / ROADMAP.md가 반증된 계약을 사실로 서술하지 않는다 | 문서 검증 | `grep -q 'reCAPTCHA Enterprise' .planning/PROJECT.md && test "$(sed -n '/^### Phase 05/,/^### Phase 06/p' .planning/ROADMAP.md \| grep -c 'VOID')" = "2"` | 해당 없음 | ⬜ pending |
| 05-03-T1 | 05-03 | 2 | R019 | T-05-12, T-05-14 | 체크포인트 착수 전 에이전트 안전 프로토콜 5항목 자체 점검 + 저장 자격증명 상태 고지 준비 | 준비/게이트 | `npm run build && npx vitest run src/main/services/__tests__/auth-service.test.ts -t "runAccountTokenLadderSpike"` | ❌ 05-01 선행 | ⬜ pending |
| 05-03-T2 (checkpoint) | 05-03 | 2 | R019 **(핵심 판정)** | T-05-12, T-05-15, T-05-16 | 실계정으로 account 토큰 확보 → 사다리 통과 → `/fans/me` 200 + fanId | **manual (`checkpoint:human-verify`, `gate="blocking-human"`)** | 해당 없음 — 실계정 + 사람의 로그인 수행 필요 (D-06). auto-mode 에서도 자동 승인되지 않는다 | 해당 없음 | ⬜ pending |
| 05-03-T3 | 05-03 | 2 | Success Criteria 3 | T-05-13 | `ApplyEngine`이 `authService.token`을 코드 변경 없이 소비 (회귀) + 판정 문서에 토큰 원문 부재 | unit (기존 커버) + 문서 게이트 | `npx vitest run src/main/services/__tests__/apply-engine.test.ts && test "$(grep -cE '[A-Za-z0-9._-]{100,}' .planning/phases/05-api/05-SPIKE-RESULT.md)" = "0"` | ✅ / ❌ T3이 생성 | ⬜ pending |

*Task ID 는 `{plan}-T{n}` 규칙. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Wave 0 배치에 대한 메모:** 이전 판본은 순수 함수 테스트를 별도 Wave 0 으로 분리했으나, 재플랜에서는
`05-01-T1`(tracer) 이 순수 함수·테스트 파일·종단 배선을 한 태스크에서 함께 만든다. Tracer 는 계층별로 쪼개면
성립하지 않기 때문이다(종단 한 줄기가 태스크의 정의). 따라서 Wave 0 산출물은 별도 웨이브가 아니라
**05-01-T1 안에서 가장 먼저 만들어지고**, T1 의 `<verify>` 가 통과하는 시점에 Wave 0 요건이 동시에 충족된다.
순수 함수 테스트 파일이 `auth-service.test.ts` 가 아니라 신규 `account-token-capture.test.ts` 로 옮겨간 이유는
"Electron 목 없이 테스트 가능해야 한다" 는 Wave 0 요건을 **구조적으로** 증명하기 위해서다 —
그 파일에는 모듈 목 선언이 0건이어야 한다는 게이트가 걸려 있다.

---

## Wave 0 Requirements

모든 항목이 **05-01-T1(tracer) 내부**에서 충족된다 (위 배치 메모 참조).

- [ ] account 토큰 **후보 판별 로직**을 순수 함수로 분리 — 입력은 쿠키 배열, 출력은 후보 하나.
      `session.cookies.get` 목 없이 테스트 가능해야 함 → `pickAccountTokenCookie()` (05-01-T1)
- [ ] **CDP 응답 바디 파싱 로직**을 순수 함수로 분리 — 입력은 JSON 문자열, 출력은 `accessToken`.
      `debugger.sendCommand` 목 없이 테스트 가능해야 함 → `extractAccessTokenFromResponseBody()` (05-01-T2)
- [ ] `src/main/services/__tests__/account-token-capture.test.ts` — 위 두 순수 함수 케이스.
      **이 파일에는 모듈 목 선언이 0건이어야 한다** (Electron 분리의 구조적 증명, 05-01-T1 인수 기준)
- [ ] `src/main/services/__tests__/auth-service.test.ts` — 종단 케이스(쿠키→판별→사다리→verdict) +
      멱등/단일비행/비침습 케이스. 기존 electron mock 을 `vi.hoisted()` 가변 픽스처로 확장 (05-01-T1)
- [ ] `checkpoint:human-verify` 태스크 — R019 핵심 판정. `gate="blocking-human"` 으로 auto-mode 자동 승인을
      차단하고, 태스크 설명에 D-06(사용자가 로그인 수행, 에이전트 측 프로브는 더미 이메일만) 준수와
      실패 시 재시도 금지·halt 절차를 명시 (05-03-T2)
- [ ] 프레임워크 설치: **불필요** — vitest 이미 설치됨

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| account 토큰 확보 → 사다리 통과 → 팬이벤트 API 200 | R019 | 실계정 자격증명이 필요하고 실제 로그인 페이지의 reCAPTCHA를 사람이 통과해야 한다. 캡차 우회는 영구 제외(R013)이므로 무인 자동화 경로가 **존재하지 않는다.** D-06에 따라 로그인은 사용자가 직접 수행한다 | 전체 절차는 `05-03-PLAN.md` 의 `05-03-T2` 체크포인트 `<how-to-verify>` 가 정본이다. 요약: 1) 앱을 브라우저 모드로 실행하고 **사용자가 직접** 이메일/비밀번호 입력 (에이전트는 자격증명을 다루지 않는다) 2) 쿠키 열거 로그(`accountTokenDiscovery: candidate=`) 확인 — account 토큰 후보가 잡혔는가 3) 잡히지 않았다면 CDP 폴백(`accountTokenCapture(CDP):`)이 `by-credentials` 200 응답에서 `accessToken`을 캡처했는지 확인 4) 사다리 로그 확인: rung1(direct) → 실패 시 rung2(exchange) 5) `accountTokenLadderSpike: verdict=pass` + fanId 면 **PASS** 6) 어느 rung이 통했는지(`ladderSource=direct` / `exchange`) 반드시 기록 7) 둘 다 실패하면 **R019 반증** — 재시도하지 말고 halt 후 `05-SPIKE-RESULT.md` 에 결과 문서화 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
