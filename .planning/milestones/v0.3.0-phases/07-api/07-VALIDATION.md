---
phase: 07
slug: api
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.6 |
| **Config file** | `vitest.config.ts` — `include: ["src/**/__tests__/**/*.test.ts"]` (`.test.tsx` 미포함) |
| **Quick run command** | `npx vitest run <touched test file>` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~{N} seconds (planner/executor measures on first full run) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <test file for the touched module>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm test` + `npm run typecheck` + `npm run typecheck:main` must all be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. The planner MUST fill one row per task,
> mapping each to the requirement/test rows below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {07-01-01} | 01 | 1 | R022 | — | `evaluateTokenExpiry()` 3상태 판정(safe/warning/unknown) | unit | `npx vitest run src/shared/__tests__/token-expiry.test.ts` | ❌ W0 | ⬜ pending |
| {TBD} | — | — | R022 | — | `arm()` 호출 시 만료 판정 이벤트가 발행된다 | unit | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ⚠️ 케이스 추가 | ⬜ pending |
| {TBD} | — | — | R022 | — | `execute()`가 `waitUntilSubmitTime()` 이후 갱신된 `authService.token`을 사용한다 (D-13 회귀 방지) | unit | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ⚠️ 케이스 추가 | ⬜ pending |
| {TBD} | — | — | R022 | — | 재로그인 실패 시 기존 토큰이 복원된다 (D-14) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ⚠️ 케이스 추가 | ⬜ pending |
| {TBD} | — | — | R023 | — | 이메일만 프리필하고 비밀번호는 IPC로 나가지 않는다 | unit | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | ⚠️ 케이스 추가 | ⬜ pending |
| {TBD} | — | — | R023 | — | 이메일 불일치 시 저장 비밀번호 로그인 최종 게이트가 Main에서 차단된다 (D-03) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ⚠️ 케이스 추가 | ⬜ pending |
| {TBD} | — | — | R023 | — | `credentials.enc` 복호화/파싱 실패 시 삭제 + throw (D-04) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ⚠️ 케이스 추가 | ⬜ pending |
| {TBD} | — | — | R023 | — | 이메일 마스킹 규칙 (D-07) | unit | `npx vitest run src/shared/__tests__/mask.test.ts` | ⚠️ 케이스 추가 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/__tests__/token-expiry.test.ts` — R022 신규 순수 모듈 커버 (신규 파일)
- [ ] `src/shared/__tests__/mask.test.ts` — 이메일 마스킹 케이스 추가 (R023 / D-07)
- [ ] `src/main/services/__tests__/apply-engine.test.ts` — D-10 (arm 시 경고 이벤트) / D-13 (토큰 재조회) 케이스 추가
- [ ] `src/main/services/__tests__/auth-service.test.ts` — D-03 (이메일 불일치 게이트) / D-04 (복호화 실패 삭제) / D-14 (백업·복원) 케이스 추가
- [ ] `src/renderer/components/__tests__/login-panel-view.test.ts` — D-02 / D-03 판단 함수 케이스 추가
- [ ] 프레임워크 설치: **불필요** — 기존 vitest 재사용

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `LoginPanel.tsx` 이메일/비밀번호 프리필 렌더링 | R023 | JSX 컴포넌트 — `vitest.config.ts`의 `include`가 `.test.tsx`를 포함하지 않음 (저장소 전체의 기존 패턴) | API 모드로 로그인 → 앱 재시작 → 로그인 폼에 이메일/비밀번호가 채워져 있고 OTP 입력란만 비어 있는지 확인 |
| D-06 저장 자격증명 삭제 버튼 노출 위치 | R023 | 동일 (JSX) | 저장된 자격증명이 있을 때만 삭제 버튼이 보이고, 클릭 후 프리필이 사라지는지 확인 |
| `ApplyExecution.tsx` 인라인 재로그인 경고 렌더링 | R022 | 동일 (JSX) | 만료 임박 토큰으로 arm → 대기 화면에 재로그인 필요 경고 + 재로그인 버튼이 표시되는지 확인 |

*렌더러 JSX 컴포넌트 자체가 자동 테스트 대상이 아닌 것은 이 phase가 새로 만드는 갭이 아니라 저장소 전체의 기존 패턴이다.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
