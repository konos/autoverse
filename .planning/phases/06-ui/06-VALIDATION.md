---
phase: 06
slug: ui
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
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
| 06-01 T1 | 06-01 | 1 | R016 | T-06-05 | env absent + persisted `api` -> `resolveLoginMode()` returns `"api"` | unit | `npx vitest run src/main/__tests__/login-mode.test.ts` | W0 (extend existing) | ⬜ pending |
| 06-01 T1 | 06-01 | 1 | R016 | T-06-03 | env set -> `lockedByEnv` true, persisted value ignored (UI must show locked state) | unit | `npx vitest run src/main/__tests__/login-mode.test.ts` | W0 (extend existing) | ⬜ pending |
| 06-01 T1 | 06-01 | 1 | R016 | T-06-01 | corrupt/missing `settings.json` -> silent fallback to `browser`, never throws | unit | `npx vitest run src/main/services/__tests__/settings-store.test.ts` | W0 (new) | ⬜ pending |
| 06-01 T1 | 06-01 | 1 | R016 | T-06-02 | atomic tmp+rename write - rapid consecutive writes never leave a partial file | unit | `npx vitest run src/main/services/__tests__/settings-store.test.ts` | W0 (new) | ⬜ pending |
| 06-01 T3 | 06-01 | 1 | R016 | - | write failure propagates to the caller and the persisted value is unchanged (UI-SPEC E1 error) | unit | `npx vitest run src/main/services/__tests__/settings-store.test.ts` | W0 (new) | ⬜ pending |
| 06-01 T2 | 06-01 | 1 | R021 | - | first API-mode selection -> notice required (`shouldShowApiModeNotice(null, v)` true) | unit | `npx vitest run src/shared/__tests__/api-mode-notice.test.ts` | W0 (new) | ⬜ pending |
| 06-01 T2 | 06-01 | 1 | R021 | - | same acknowledged version -> modal not re-shown; bumped version -> re-shown (D-10) | unit | `npx vitest run src/shared/__tests__/api-mode-notice.test.ts` | W0 (new) | ⬜ pending |
| 06-02 T1 | 06-02 | 1 | R020 | T-06-19 | captcha signal -> D-13 Korean copy, never the disproven email-code narrative (table test over every reason) | unit | `npx vitest run src/shared/__tests__/login-failure.test.ts` | W0 (new) | ⬜ pending |
| 06-02 T2 | 06-02 | 1 | R020 | T-06-07 | dynamic form-error text trimmed and capped at 120 chars; untruncated original kept for the log path | unit | `npx vitest run src/shared/__tests__/login-failure.test.ts` | W0 (new) | ⬜ pending |
| 06-04 T3 | 06-04 | 2 | R016/SC1 | T-06-12 | D-03: cookie session restore allowed in BOTH modes; stored-credential auto-login blocked in BOTH | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | W0 (rewrite existing describe) | ⬜ pending |
| 06-04 T2 | 06-04 | 2 | R016 | T-06-13 | disproven-contract methods removed; remaining ApiAuthClient tests only call live methods | unit | `npx vitest run src/main/services/__tests__/api-auth-client.test.ts` | W0 (repair) | ⬜ pending |
| 06-05 T1 | 06-05 | 3 | R020 | T-06-21 | raw DOM signal -> reason mapping incl. `null` (broken selector) and unknown strings -> unmapped fallback | unit | `npx vitest run src/shared/__tests__/login-failure.test.ts` | W0 (extend) | ✅ green |
| 06-05 T3 | 06-05 | 3 | R020 | T-06-17 / R010 | identifier and message returned to the renderer pass `maskSensitive()` - no raw token/query-string leak | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | W0 (extend) | ✅ green |
| 06-06 T2 | 06-06 | 4 | R021 | T-06-22 | tab-click decision: first API selection opens the notice and does NOT persist; locked state does nothing | unit | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | W0 (new) | ⬜ pending |
| 06-06 T2 | 06-06 | 4 | R016 | T-06-23 | locked badge detail names the applied mode label, never the raw env value | unit | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | W0 (new) | ⬜ pending |
| 06-06 T3 | 06-06 | 4 | R020 | T-06-24 | failure view: browser-switch button only for the reasons that ask for it; no chip when identifier is absent | unit | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | W0 (new) | ⬜ pending |
| 06-07 T1 | 06-07 | 5 | R016/R020/R021 | T-06-13 | phase gate - full suite + both typechecks green (D-02 deletions surface as type errors first) | gate | `npm test && npm run typecheck:main && npm run typecheck` | existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/services/__tests__/settings-store.test.ts` — **new.** `getLoginMode` / `setLoginMode` / notice-ack read+write, corrupt-file and missing-file fallback
- [ ] `src/shared/__tests__/login-failure.test.ts` — **new.** Exhaustive cases for every failure reason in the mapping union, incl. the unmapped fallback (D-14)
- [ ] `src/shared/__tests__/notice-ack.test.ts` — **new** (may be folded into settings-store tests). Notice-version acknowledgement logic (D-09/D-10)
- [ ] `src/main/__tests__/login-mode.test.ts` — **extend existing.** Add persisted-setting precedence cases; the 6 existing env cases must keep passing (RESEARCH proposes a backward-compatible optional second parameter)
- [ ] `src/main/services/__tests__/api-auth-client.test.ts` — **repair.** 5 of 7 `describe` blocks reference methods deleted by D-02 and will not compile; delete or rewrite them (keep `acquireFaneventToken` / `exchangeForService` / `validateToken` coverage)
- [ ] `src/main/services/__tests__/auth-service.test.ts` — **repair.** The `describe` block currently named for the old API-mode gate asserts the pre-D-03 behavior and its name becomes factually wrong; rewrite rather than delete. Clean up `credentialLoginApi` / `submitOtpApi` spies.
- Framework install: **not needed** — vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 캡차 챌린지가 실제로 떴을 때 D-13 안내와 브라우저 전환 버튼이 노출되는지 | R020 | Requires a real Weverse login attempt; reCAPTCHA cannot be triggered deterministically and MUST NOT be automated (R013) | **User performs the login.** Agent may only read logs. Agent must never enter the user's real email/password or issue any request to weverse.io / accountapi.weverse.io — dummy `*@example.com` only (05-CONTEXT D-06, non-negotiable). |
| 최초 API 모드 선택 시 차단형 모달이 실제로 진행을 막는지 | R021 | Interaction-level; no DOM test environment in this project | User selects API mode in the running app and confirms the flow cannot proceed without acknowledgement |
| 앱 재시작 후 선택값이 유지되는지 | R016 | Requires a real Electron app restart cycle | User selects API mode, quits, relaunches, confirms selector state and that the notice does not re-appear |
| `AUTOVERSE_LOGIN_MODE` 설정 시 선택기가 잠기고 "환경변수로 고정됨"이 표시되는지 | R016 (D-06) | Requires launching Electron with the env var set | `AUTOVERSE_LOGIN_MODE=api npm run dev` → selector shows locked state and is not operable |

> **Known confound (from 05-SPIKE-RESULT §2):** `ProfileStore` loads a cached `fanId` that
> differs from the ladder-verified one. This predates Phase 06 and is a deferred item — do
> not let it be misdiagnosed as a Phase 06 regression during UAT.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `npm run typecheck:main` and `npm run typecheck` in the phase gate (D-02 deletion safety)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
