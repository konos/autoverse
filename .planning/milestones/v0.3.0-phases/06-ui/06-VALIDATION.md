---
phase: 06
slug: ui
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-26
gate_verified: 2026-08-26T14:52:00Z
gate_verified_by: 06-07 T1
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase 06` from `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.6 (package.json devDependencies) |
| **Config file** | `vitest.config.ts` — `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts"]` |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npm test` (== `vitest run`) |
| **Estimated runtime** | ~10–20 seconds (163 existing unit tests, node environment) |

**Critical constraint — no DOM test environment.** `environment: "node"` and there is no
jsdom / happy-dom / @testing-library/react dependency. The established renderer convention
(`src/renderer/components/__tests__/profile-form-validation.test.ts`) is to **extract the
decision logic out of the component into a pure function and test that function only** —
components are never rendered in tests. Every new renderer-side decision in this phase
(e.g. "should the API-mode notice modal appear?") MUST be extracted this way to be testable.

**Typecheck belongs in the gate.** D-02 deletes methods across `auth-service.ts`,
`api-auth-client.ts`, `ipc-handlers.ts`, and `LoginPanel.tsx`; that class of change surfaces
first as a type error, not a test failure. `npm run typecheck:main` and `npm run typecheck`
are part of the phase gate, not optional.

---

## Sampling Rate

- **After every task commit:** Run the quick command for the file(s) the task touched
- **After every plan wave:** Run `npm test` — catches compile breakage from D-02 deletions
- **Before `/gsd-verify-work`:** `npm test` + `npm run typecheck:main` + `npm run typecheck` all green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This table is seeded from RESEARCH.md's
> requirement→test map and MUST be completed with real task IDs during planning.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01 T1 | 06-01 | 1 | R016 | T-06-05 | env absent + persisted `api` -> `resolveLoginMode()` returns `"api"` | unit | `npx vitest run src/main/__tests__/login-mode.test.ts` | ✅ 확장(existing) | ✅ green |
| 06-01 T1 | 06-01 | 1 | R016 | T-06-03 | env set -> `lockedByEnv` true, persisted value ignored (UI must show locked state) | unit | `npx vitest run src/main/__tests__/login-mode.test.ts` | ✅ 확장(existing) | ✅ green |
| 06-01 T1 | 06-01 | 1 | R016 | T-06-01 | corrupt/missing `settings.json` -> silent fallback to `browser`, never throws | unit | `npx vitest run src/main/services/__tests__/settings-store.test.ts` | ✅ 신규 | ✅ green |
| 06-01 T1 | 06-01 | 1 | R016 | T-06-02 | atomic tmp+rename write - rapid consecutive writes never leave a partial file | unit | `npx vitest run src/main/services/__tests__/settings-store.test.ts` | ✅ 신규 | ✅ green |
| 06-01 T3 | 06-01 | 1 | R016 | - | write failure propagates to the caller and the persisted value is unchanged (UI-SPEC E1 error) | unit | `npx vitest run src/main/services/__tests__/settings-store.test.ts` | ✅ 신규 | ✅ green |
| 06-01 T2 | 06-01 | 1 | R021 | - | first API-mode selection -> notice required (`shouldShowApiModeNotice(null, v)` true) | unit | `npx vitest run src/shared/__tests__/api-mode-notice.test.ts` | ✅ 신규 | ✅ green |
| 06-01 T2 | 06-01 | 1 | R021 | - | same acknowledged version -> modal not re-shown; bumped version -> re-shown (D-10) | unit | `npx vitest run src/shared/__tests__/api-mode-notice.test.ts` | ✅ 신규 | ✅ green |
| 06-02 T1 | 06-02 | 1 | R020 | T-06-19 | captcha signal -> D-13 Korean copy, never the disproven email-code narrative (table test over every reason) | unit | `npx vitest run src/shared/__tests__/login-failure.test.ts` | ✅ 신규 | ✅ green |
| 06-02 T2 | 06-02 | 1 | R020 | T-06-07 | dynamic form-error text trimmed and capped at 120 chars; untruncated original kept for the log path | unit | `npx vitest run src/shared/__tests__/login-failure.test.ts` | ✅ 신규 | ✅ green |
| 06-04 T3 | 06-04 | 2 | R016/SC1 | T-06-12 | D-03: cookie session restore allowed in BOTH modes; stored-credential auto-login blocked in BOTH | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ✅ 재작성(rewrite existing describe) | ✅ green |
| 06-04 T2 | 06-04 | 2 | R016 | T-06-13 | disproven-contract methods removed; remaining ApiAuthClient tests only call live methods | unit | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts` | ✅ 교체(repair) | ✅ green |
| 06-05 T1 | 06-05 | 3 | R020 | T-06-21 | raw DOM signal -> reason mapping incl. `null` (broken selector) and unknown strings -> unmapped fallback | unit | `npx vitest run src/shared/__tests__/login-failure.test.ts` | ✅ 확장(extend) | ✅ green |
| 06-05 T3 | 06-05 | 3 | R020 | T-06-17 / R010 | identifier and message returned to the renderer pass `maskSensitive()` - no raw token/query-string leak | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ✅ 확장(extend) | ✅ green |
| 06-06 T2 | 06-06 | 4 | R021 | T-06-22 | tab-click decision: first API selection opens the notice and does NOT persist; locked state does nothing | unit | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | ✅ 신규 | ✅ green |
| 06-06 T2 | 06-06 | 4 | R016 | T-06-23 | locked badge detail names the applied mode label, never the raw env value | unit | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | ✅ 신규 | ✅ green |
| 06-06 T3 | 06-06 | 4 | R020 | T-06-24 | failure view: browser-switch button only for the reasons that ask for it; no chip when identifier is absent | unit | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | ✅ 신규 | ✅ green |
| 06-07 T1 | 06-07 | 5 | R016/R020/R021 | T-06-13 | phase gate - full suite + both typechecks green (D-02 deletions surface as type errors first) | gate | `npm test && npm run typecheck:main && npm run typecheck` | ✅ 기존 스크립트(existing) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**2026-08-26 06-07 실행 기록:** 위 17개 행 전부, 각 Automated Command 를 개별 실행해(그룹 실행 `npx vitest run <7개 파일>` → 134 tests, 0 failures) 확인했다. 전체 스위트(`npm test`)는 16 files / 315 tests / 0 failures. `npm run typecheck:main` · `npm run typecheck` 둘 다 0 에러. `npm run build` 0 으로 종료. `git diff --stat package.json package-lock.json` 공백(phase 전체 신규 의존성 0건, D-02 대량 삭제 이후에도 타입 안전 유지).

---

## Wave 0 Requirements

- [x] `src/main/services/__tests__/settings-store.test.ts` — **new.** `getLoginMode` / `setLoginMode` / notice-ack read+write, corrupt-file and missing-file fallback (06-01, confirmed on disk 2026-08-26)
- [x] `src/shared/__tests__/login-failure.test.ts` — **new.** Exhaustive cases for every failure reason in the mapping union, incl. the unmapped fallback (D-14) (06-02, extended by 06-05)
- [x] `src/shared/__tests__/notice-ack.test.ts` — **folded into `src/shared/__tests__/api-mode-notice.test.ts`** (06-01) — 4 cases (null/same-version/bumped-version/future-version), not a separate file. Deviation from the seeded filename is intentional per 06-01-PLAN's own module naming (`shared/api-mode-notice.ts`), not a gap.
- [x] `src/main/__tests__/login-mode.test.ts` — **extended.** Persisted-setting precedence cases added; original 6 env-only cases still pass (06-01)
- [x] `src/main/services/__tests__/api-auth-client.test.ts` — **repaired.** 3 of 7 `describe` blocks deleted (D-02 disproven contract), remaining 4 cover `acquireFaneventToken` / `exchangeForService` / `probeFaneventToken` / `validateToken` — 15 grep-verified references intact (06-04)
- [x] `src/main/services/__tests__/auth-service.test.ts` — **repaired.** The unattended-login gate `describe` block was rewritten (not deleted) to assert the D-03 mode-independent behavior; `credentialLoginApi` / `submitOtpApi` spies removed with their now-deleted callees (06-04)
- Framework install: **not needed** — vitest already present, confirmed no new devDependency added (`git diff --stat package.json` empty).

---

## Manual-Only Verifications

> **에이전트가 준비한 것(06-07 T2, 2026-08-26):** `npm run build` 로 앱이 빌드되는 것을 확인했고,
> 아래 4항목의 지시문을 실제로 사용자가 그대로 따라 할 수 있는 절차로 확정했다. **에이전트는
> 실행하지 않았다** — `npm run dev` 를 백그라운드로 띄우거나 실계정 로그인을 시도하는 어떤
> 명령도 실행하지 않았다(05-CONTEXT D-06). 아래 4항목은 06-07-PLAN.md Task 2 의
> `<verify><human-check>` 로도 등록되어 phase 종료 UAT 로 수확된다 — 이 표는 그 지시문의 실행
> 가능한 원본이다.

| # | Behavior | Requirement | Why Manual | Test Instructions | 상태 (2026-08-26) |
|---|----------|-------------|------------|-------------------|-------------------|
| 1 | 선택 영속 — 앱 재시작 후 선택값이 유지되는지 (양방향) | R016 | Requires a real Electron app restart cycle | `npm run dev` → API 로그인 탭 선택 → 앱 완전 종료 → 재실행 → API 탭이 선택된 상태로 뜨는지 확인. 이어서 브라우저 로그인 탭으로 바꾸고 종료→재실행을 반복해 반대 방향도 확인. | **부분 확인.** API→재시작 방향은 06-01 tracer 체크포인트에서 사용자가 이미 "verified"로 확인함 (`~/Library/Application Support/weverse-fanevent-apply/settings.json` 이 독립적으로 `{"schemaVersion":1,"loginMode":"api","apiModeNoticeAckedVersion":null}` 을 보여 corroborate됨, 06-01-SUMMARY.md D1). **브라우저→재시작 반대 방향은 미확인 — outstanding.** |
| 2 | 최초 고지 차단 — 모달이 실제로 진행을 막는지, 좁은 창에서도 확인 버튼에 닿는지 | R021 | Interaction-level; no DOM test environment in this project | 고지 미확인 상태에서 API 탭을 처음 누르면 모달이 뜨고, 취소/Esc 로 닫으면 브라우저 탭이 그대로 활성이며, 확인 버튼을 눌러야만 API 모드로 바뀐다. 창을 최소 크기로 줄인 상태에서도 확인 버튼에 도달할 수 있는지 함께 본다. 확인 후 같은 탭을 다시 눌렀을 때 모달이 재노출되지 않아야 한다. | **미확인 — outstanding.** 06-06-SUMMARY.md D1/D5가 `human_judgment: true`로 명시 이관한 항목. 결정 함수(`decideTabClick`)와 모달 구조(스크롤 래퍼 밖 버튼 행)는 단위 테스트/코드 검토로 증명됐으나 실제 Electron 창 동작은 미확인. |
| 3 | 환경변수 잠금 — 선택기가 잠기고 잠금 사실만 표시(원문 값 미노출) | R016 (D-06) | Requires launching Electron with the env var set | `AUTOVERSE_LOGIN_MODE=api npm run dev` → 두 탭이 모두 비활성이고 `환경변수로 고정됨` 배지와 현재 적용 중인 모드 라벨이 보여야 한다. 탭을 눌러도 아무 변화가 없어야 하고, 배지 문구에 환경변수 원문 값이 보이면 안 된다. | **미확인 — outstanding.** 06-06-SUMMARY.md D2가 코드 구조(`process.env` grep 0, 배지 문구 grep 1)로만 증명, 실제 실행 화면 미확인. |
| 4 | 실패 안내 — 틀린 비밀번호 시 서버 에러 코드가 아니라 한국어 설명 문구 | R020 | Requires a real Weverse login attempt; reCAPTCHA cannot be triggered deterministically and MUST NOT be automated (R013) | **User performs the login with an intentionally wrong password.** Agent may only read logs. Agent must never enter the user's real email/password or issue any request to weverse.io / accountapi.weverse.io — dummy `*@example.com` only (05-CONTEXT D-06, non-negotiable). 보안 확인(캡차)이 실제로 뜬 경우에만 그 안내와 브라우저 전환 버튼을 확인 — 캡차를 인위적으로 유발하지 말 것. 뜨지 않으면 그 하위 항목은 "미관측"으로 기록(통과 아님). | **미확인 — outstanding.** 실계정 로그인이 필요해 이 실행에서 시도하지 않았다(prohibitions 준수). `mapLoginFailure()`/`buildFailureView()` 는 단위 테스트로 6개 사유 전수 검증됨(06-02/06-06 SUMMARY). |

> **Known confound (from 05-SPIKE-RESULT §2):** `ProfileStore` loads a cached `fanId` that
> differs from the ladder-verified one. This predates Phase 06 and is a deferred item — do
> not let it be misdiagnosed as a Phase 06 regression during UAT.

> **Known intentional change (D-03):** 저장된 자격증명이 있어도 앱 시작 시 자동으로 로그인되지
> 않는다. 이는 D-03의 의도된 결정이며 회귀가 아니다(ROADMAP Phase 06 SC1 편차 주석 참고, 06-04-SUMMARY.md).

**agent-side automated check (2026-08-26):** `npm run build` → 0 종료 (앱이 빌드되고 사용자가 `npm run dev` 로 즉시 실행할 수 있는 상태라는 증거). 에이전트는 `npm run dev` 를 실행하지 않았고, 로그인 관련 어떤 명령도 실행하지 않았다.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 06-01~06-06의 모든 태스크가 unit test 또는 grep 기반 `<automated>` verify를 가지며, 06-07 T1이 phase 게이트를 담당
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — 각 플랜 SUMMARY의 Task Commits 절에서 태스크마다 자동 verify(vitest/grep/typecheck)가 확인됨, 연속 3개 이상 비어있는 구간 없음
- [x] Wave 0 covers all MISSING references — 위 Wave 0 Requirements 6항목 전부 파일 존재 확인됨
- [x] No watch-mode flags — 모든 Automated Command가 `vitest run`(watch 아님)
- [x] Feedback latency < 20s — `npm test` 전체 스위트 실측 1.65s (315 tests, 16 files)
- [x] `npm run typecheck:main` and `npm run typecheck` in the phase gate (D-02 deletion safety) — 06-07 T1 게이트 행에 포함, 둘 다 0 에러로 실행 확인
- [x] `nyquist_compliant` set to `true` in frontmatter — 위 프론트매터(줄 7)에서 설정됨

**Approval:** 자동 게이트 ✅ (2026-08-26, 06-07 T1: `npm test` 315/315 + `npm run typecheck:main` 0 에러 + `npm run typecheck` 0 에러 + `npm run build` 0 종료 + 신규 의존성 0건). 수동 UAT 4항목 중 1항목(선택 영속)은 API→재시작 방향만 06-01 tracer 체크포인트에서 확인됐다 — 반대 방향(브라우저→재시작)과 나머지 3항목(최초 고지 차단·환경변수 잠금·실패 안내) 전부는 사용자 확인 대기 — `status: validated` 로의 전이는 이 문서 소관이 아니라 별도 verify 워크플로(`/gsd-verify-work`) 소관이다.

**Approval:** pending
