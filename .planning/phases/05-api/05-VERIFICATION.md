---
phase: 05-api
verified: 2026-08-25T10:08:18Z
status: human_needed
score: 20/21 must-haves verified
behavior_unverified: 1
overrides_applied: 0
human_verification:
  - test: "Confirm ApplyEngine actually submits an application end-to-end using a token obtained through the account-token ladder (rung1/rung2), not just the existing browser-mode we2_access_token."
    expected: "ApplyEngine's POST-application flow succeeds unchanged when authService.token holds a ladder-derived account-domain token (e.g. the observed accountapi.weverse.io `rt` cookie value), exactly as ROADMAP Phase 05 Success Criteria 3's second clause requires ('ApplyEngine이 이 토큰을 코드 변경 없이 그대로 사용해 신청을 수행할 수 있다')."
    why_human: "05-SPIKE-RESULT.md §4 explicitly states this was judged only at the shape/type level (both sources are opaque strings) and was never wired end-to-end — the spike is read-only by design and did not overwrite authService.token or trigger an apply. The only automated evidence is the pre-existing apply-engine.test.ts regression suite (17/17), which does not exercise this specific token source. No test or log evidence proves ApplyEngine actually accepts this token in a live apply call. This is a real risk to carry into the Phase 06/07 product-path decision (D-04), not merely a spike loose end already flagged for later action."
---

# Phase 05: API 로그인 핵심 흐름 + 토큰 교환 검증 Verification Report

**Phase Goal:** 이미 동작 중인 헤드리스 로그인에서 계정 토큰을 확보해 account → 팬이벤트 토큰 사다리(R019)가 실계정에서 성립하는지 1회 관찰로 판정하고, 반증된 로그인 계약을 문서에서 제거한다.
**Verified:** 2026-08-25T10:08:18Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Context Notes Applied

Per the phase-specific guidance for this run:

1. **R018 de-scoping is treated as the intended outcome**, not a gap. Verified below that the de-scoping was done correctly (status, cited rationale, unmapped owner, traceability/Coverage Summary consistency) — see Requirements Coverage.
2. **ROADMAP Success Criteria 1 and 2 are `[VOID — 2026-08-25 HAR 반증]`** and are excluded from scoring as failures — only Success Criteria 3 is scored.
3. **`05-01-SUMMARY.md` is a two-generation file.** The current `05-01-PLAN.md` was verified against the bottom `## 재설계 실행 (2차, 2026-08-25)` section, not the superseded upper body.
4. **CR-01 (mask.ts value-class truncates at whitespace) and the raw-URL redirect-log token leak** are pre-existing defects (git blame 2026-05 / commit 2ff4339) already recorded in 05-SPIKE-RESULT.md §6 and deferred to Phase 06/07. Not re-filed as new gaps here — reported for completeness only under Anti-Patterns.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | [VOID — HAR 반증] 이메일 OTP 발송 3단계 로그인 | N/A (void, not scored) | ROADMAP.md line 37, explicitly disproven and marked void |
| 2 | [VOID — HAR 반증] OTP 검증 완료로 로그인 완료 | N/A (void, not scored) | ROADMAP.md line 38, explicitly disproven and marked void |
| 3a | account 토큰이 실계정으로 we2_access_token 교환 사다리에서 성립하는지 1회 관측으로 판정된다 | ✓ VERIFIED | `05-SPIKE-RESULT.md` §1-2: `accountTokenLadderSpike: verdict=pass tokenSource=cookie ladderSource=direct fanId=9415932`. `acquireFaneventToken()` (`src/main/services/api-auth-client.ts:313-336`) rung1 called `/fans/me` directly and returned `fanId`, matching the ladder's own designed "pass on rung1" semantics. REQUIREMENTS.md R019 updated to `validated` citing this record. Note: this is a **rung1 (direct-use) pass, not an exchange (rung2) pass** — R019's own Notes field is transparent about this ("rung2는 미실행으로 여전히 미검증"), and this document treats rung1 success as satisfying the requirement's intent because the code's own ladder design treats rung1 success as a valid terminal state, not merely a fallback bypass. |
| 3b | ApplyEngine이 이 토큰을 코드 변경 없이 그대로 사용해 신청을 수행할 수 있다 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `05-SPIKE-RESULT.md` §4 explicitly self-reports: "이는 형태(shape) 수준의 판단이지 실제 배선 테스트는 아니다... 검증되지 않았다." Only regression evidence is the pre-existing `apply-engine.test.ts` (17/17, unrelated to the new token source) confirming no code-level regression, not that the actual application flow accepts this token. Routed to Human Verification below — this cannot be proven by grep/type-shape reasoning alone; it requires either a live/staged apply attempt or an explicit human sign-off accepting shape-level reasoning as sufficient for a D-04 spike. |

**Score (ROADMAP-level):** 1 verified, 1 present-behavior-unverified, 2 void (not scored) — out of the phase's single live Success Criteria (3), the token-ladder half is proven, the ApplyEngine-consumption half is not.

### Observable Truths — Plan Must-Haves (05-01: R019 wiring)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `credentialLogin()` 토큰 확보 성공 시 `runAccountTokenLadderSpike()` 자동 1회 실행 + verdict 로그 | ✓ VERIFIED | `auth-service.ts:439` fire-and-forget call inside `result === "token"` branch; `logVerdict()` at `auth-service.ts:842-850` emits `verdict/tokenSource/ladderSource/fanId` in one line. Observed live in `05-SPIKE-RESULT.md` §1. |
| 2 | 쿠키 전량 열거, 값은 절대 로그에 없음 (이름/도메인/길이/httpOnly만) | ✓ VERIFIED | `summarizeCookies()` (`account-token-capture.ts:53-60`) never accesses `.value` in output; `accountTokenDiscovery: candidate=...len=...` line at `auth-service.ts:883` logs only name/domain/length. Confirmed no raw cookie value appears in `05-SPIKE-RESULT.md`. |
| 3 | 쿠키 후보 없으면 CDP 캡처 accessToken이 사다리 입력으로 사용됨 | ✓ VERIFIED | `auth-service.ts:887-894`; test `"CDP 후보만 있고 쿠키 후보가 없으면 tokenSource=cdp 로 사다리를 태운다"` (`auth-service.test.ts:344-358`) passes. |
| 4 | 스파이크는 `cachedToken`을 덮어쓰지 않음 | ✓ VERIFIED | Code never assigns `this.cachedToken`/`this.cachedFanId` inside `runAccountTokenLadderSpike()` (only reads it for the `matchesWe2Cookie` log comparison, `auth-service.ts:910`). Test `"비침습: 스파이크 호출 전후로 authService.token 값이 변하지 않는다"` passes. |
| 5 | 연속 2회 호출해도 BrowserWindow 0회 생성, login 엔드포인트 요청 0건 | ✓ VERIFIED | Test `"멱등: 연속 2회 호출해도 BrowserWindow 목이 0회 호출되고, by-credentials(로그인) 요청이 0건이다"` (`auth-service.test.ts:313-328`) passes. |
| 6 | 단일 비행 가드 — 재진입 호출은 `verdict=skipped reason=already-running` | ✓ VERIFIED | `auth-service.ts:852-864`; test `"단일 비행: ..."` (`auth-service.test.ts:292-311`) passes. |
| 7 | CDP attach는 창당 최대 1회, 실패/detach 시 예외를 삼키지 않고 로그 후 쿠키 경로만 진행 | ✓ VERIFIED | `attachAccountTokenCapture()` called once per headless window (`auth-service.ts:271`); attach wrapped in try/catch logging `attach failed=...` (`auth-service.ts:767-774`); `detach` handler logs a warning (`auth-service.ts:777-779`) rather than throwing. |
| 8 | R018 경로는 이 phase가 추가하는 어떤 코드 경로도 호출하지 않음 (backstop) | ✓ VERIFIED (backstop, non-inferable — as declared) | `requestOtpSession`/`loginWithCredentials`/`verifyOtp`/`credentialLoginApi`/`submitOtpApi` remain in the codebase but are not called from any of the 05-01(2nd-run) diff (`account-token-capture.ts`, `auth-service.ts`'s new `runAccountTokenLadderSpike`/`attachAccountTokenCapture`, `api-auth-client.ts`'s `exchangeForService` hardening, `mask.ts`). **Flag for awareness, not a phase gap:** the OTP/credential-API IPC wiring itself (`ipc-handlers.ts:51-59` calling `credentialLoginApi`/`submitOtpApi` when `resolveLoginMode()==="api"`) predates this phase (from the first, halted 05-01 run) and still exists in the tree — reachable only via the `AUTOVERSE_LOGIN_MODE=api` env var, with no UI toggle yet (Phase 06 scope), so it is not user-reachable today. This is unchanged by, not introduced by, this phase. |

### Observable Truths — Plan Must-Haves (05-02: document correction)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | REQUIREMENTS.md R017에 구 3단계 순서 서술 없음, HAR 계약으로 대체 | ✓ VERIFIED | REQUIREMENTS.md lines 132-141: describes single-call `by-credentials`, `otpSessionId` = reCAPTCHA token; no mention of `otp-sessions`/`by-credentials-with-otp` inside the R017 block. |
| 2 | R018 Status=blocked, 사유+근거 파일 경로 명시, owning slice ≠ Phase 05 | ✓ VERIFIED | REQUIREMENTS.md lines 143-152: `Status: blocked`, `Primary owning slice: none (unmapped...)`, cites `05-01-SUMMARY.md`. |
| 3 | traceability 표/Coverage Summary 숫자가 R018 상태와 정합 | ✓ VERIFIED | REQUIREMENTS.md lines 278-291: traceability row `R018 | ... | blocked`, Coverage Summary states "Blocked: 1", "Active requirements: 9", "Validated: 8" — internally consistent. |
| 4 | PROJECT.md 계약 표가 3단계/캡차-세션전용 주장을 더 이상 사실로 서술하지 않고 근거 인용 | ✓ VERIFIED | PROJECT.md lines 33-45: table retitled "계정 API 계약 (2026-08-25 HAR 실측으로 정정)", cites `05-01-SUMMARY.md` and "reCAPTCHA Enterprise ... 필수 입력". |
| 5 | ROADMAP Phase 05 Goal/SC가 반증된 OTP 전제를 목표로 서술하지 않음 | ✓ VERIFIED | ROADMAP.md lines 30-39: Goal rewritten to R019 ladder spike; SC1/SC2 marked `[VOID — 2026-08-25 HAR 반증]`; SC3 is the sole live criterion. |
| 6 | 정정된 문서에 실제 이메일/비밀번호/토큰 원문 없음 | ✓ VERIFIED | Grepped REQUIREMENTS.md/PROJECT.md/ROADMAP.md changed sections — no email-domain patterns or long token-like strings found. |

**Residual finding (not scored against these must-haves, which were correctly narrow-scoped to the contract table only):** PROJECT.md's "Target features" bullet list (lines 27-28, above the corrected contract table) and its milestone checklist line 79 ("R017 API 3단계 자격증명 로그인") still describe the disproven 3-step/mandatory-OTP flow as current/planned fact, unflagged as void or historical. This is the same document the corrected contract table lives in. It was **transparently disclosed** by the executor itself in `05-02-SUMMARY.md`'s "Known Stubs / Residual Inconsistencies" section as explicitly out of Task 2's scoped diff (lines ~33-45 only) and deferred to a later doc-cleanup pass — not concealed. Given the phase's literal Goal text says "반증된 로그인 계약을 문서에서 제거한다" (remove the disproven contract from the documents), this is a genuine, if narrow and already-owned, gap against the Goal's literal wording. **Not elevated to a blocking gap** because: (a) it was not claimed as done by any plan's must-haves, (b) the authoritative capability contract (REQUIREMENTS.md) and the specific "계약 표" both are corrected, and (c) it was self-disclosed rather than hidden. Recorded here so it is not silently dropped — recommend folding into the Phase 06/07 planning pass as the SUMMARY itself suggests.

### Observable Truths — Plan Must-Haves (05-03: real-account verdict)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 05-SPIKE-RESULT.md 존재, verdict/tokenSource/ladderSource/fanId/rung1·rung2 관측 포함 | ✓ VERIFIED | File exists, 216 lines, contains all required fields (§1-2). |
| 2 | 사다리 재시도 없이 halt, 실계정 재로그인 0회 | ✓ VERIFIED | §2 explicitly distinguishes "form submitted twice due to a client-side timeout, ladder itself ran exactly once" — transparently documented, matches the "no ladder retry" constraint precisely rather than obscuring the double form-submit. |
| 3 | REQUIREMENTS.md R019 Validation 상태가 관측 결과로 갱신 | ✓ VERIFIED | REQUIREMENTS.md line 162-163, 280: `validated`, cites `05-SPIKE-RESULT.md`, and explicitly documents rung2 as still unverified rather than glossing over it. |
| 4 | 05-SPIKE-RESULT.md에 실제 이메일/비밀번호/토큰 원문 없음 | ✓ VERIFIED | Grep for real-domain emails and 80+ char token-like strings: 0 matches. |
| 5 | 에이전트 직접 실행 프로브가 있었다면 더미 이메일 사용 기록, 0건이면 0건 기록 | ✓ VERIFIED | §5: "에이전트가 이 phase(05-01~05-03) 전체에서 직접 실행한 실서버 프로브 건수: 0건" — explicitly stated. |
| 6 | 쿠키 후보 미발견 vs CDP 미관측 구분 기록 | ✓ VERIFIED | §3 final paragraph explicitly states neither case occurred and explains why no ambiguous "판정 불가" bucket applies. |

**Score:** 20/21 must-haves verified (1 present-behavior-unverified, routed to human verification; 4 void ROADMAP criteria excluded from the denominator; the 1 residual PROJECT.md documentation gap is recorded but not counted against a specific must-have since none claimed it).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/services/account-token-capture.ts` | 4 pure functions, electron-free | ✓ VERIFIED | 95 lines; exports `pickAccountTokenCookie`, `summarizeCookies`, `describeTokenShape`, `extractAccessTokenFromResponseBody`; 0 electron imports (grep-confirmed). |
| `src/main/services/__tests__/account-token-capture.test.ts` | Unit tests, no electron mock | ✓ VERIFIED | 139 lines, 20 tests. |
| `src/main/services/auth-service.ts` | `runAccountTokenLadderSpike()` + `attachAccountTokenCapture()` + DI | ✓ VERIFIED | Both symbols present and wired (see truth table above). |
| `src/shared/mask.ts` | accessToken/refreshToken/otpSessionId patterns added | ✓ VERIFIED | 3 new patterns present (lines ~50-52), but see CR-01 below — pre-existing regex weakness inherited, not newly introduced. |
| `.planning/REQUIREMENTS.md` | R017 corrected + R018 blocked + R019 validated | ✓ VERIFIED | All three confirmed above. |
| `.planning/PROJECT.md` | Corrected contract table | ✓ VERIFIED (with residual noted) | Contract table corrected; "Target features" bullets above it stale (see residual finding). |
| `.planning/ROADMAP.md` | Redesigned Phase 05 Goal/SC | ✓ VERIFIED | SC1/2 VOID, SC3 live, Goal rewritten. |
| `.planning/phases/05-api/05-SPIKE-RESULT.md` | R019 verdict record | ✓ VERIFIED | 216 lines, all required sections present. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `auth-service.ts` | `account-token-capture.ts` | `pickAccountTokenCookie()` | ✓ WIRED | Called at `auth-service.ts:876`. |
| `auth-service.ts` | `api-auth-client.ts` | `acquireFaneventToken()` | ✓ WIRED | Called at `auth-service.ts:914`, ladder logic unchanged from original design. |
| `auth-service.ts` | `account-token-capture.ts` | `extractAccessTokenFromResponseBody()` | ✓ WIRED | Referenced in CDP message handler (per 05-01-SUMMARY task 2 diff; confirmed present in `account-token-capture.ts` export list and used in CDP capture path). |
| `.planning/REQUIREMENTS.md` | `05-01-SUMMARY.md` | R017/R018 correction cites HAR evidence | ✓ WIRED | Both R017 Notes and R018 Notes cite the file path. |
| `.planning/PROJECT.md` | `05-01-SUMMARY.md` | contract table cites same evidence | ✓ WIRED | Confirmed. |
| `.planning/phases/05-api/05-SPIKE-RESULT.md` | app log file | quoted `accountTokenLadderSpike` line | ✓ WIRED | §1 quotes the exact log line. |
| `.planning/REQUIREMENTS.md` | `05-SPIKE-RESULT.md` | R019 Validation cites verdict doc | ✓ WIRED | Confirmed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite still green after phase changes | `npx vitest run` | `PASS (230) FAIL (0)` | ✓ PASS |
| Main-process typecheck clean | `npm run typecheck:main` | 0 errors | ✓ PASS |
| Single-flight guard test | (included in full run above — `auth-service.test.ts` "단일 비행" case) | pass | ✓ PASS |
| No new `vi.mock` declarations in pure-function test file | `grep -c "vi.mock" account-token-capture.test.ts` | 0 | ✓ PASS |
| Ladder end-to-end wiring vs. real ApplyEngine apply flow | N/A — would require a live/staged apply attempt | not run | ? SKIP (routed to Human Verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R017 | 05-02 | API 자격증명 로그인 (실측 계약) | ✓ SATISFIED | REQUIREMENTS.md rewritten to HAR-confirmed single-call contract. |
| R018 | 05-02 | 이메일 OTP 코드 입력 및 인증 | ✓ SATISFIED (correctly de-scoped, per instructions treated as intended outcome, not a gap) | `Status: blocked`, unmapped from Phase 05, rationale + evidence cited, traceability/Coverage Summary consistent. |
| R019 | 05-01 + 05-03 | account 토큰 → 팬이벤트 토큰 교환 | ✓ SATISFIED (rung1 path), ⚠️ caveat on ApplyEngine-consumption clause | `validated` in REQUIREMENTS.md, backed by `05-SPIKE-RESULT.md`; rung2 and end-to-end ApplyEngine wiring explicitly still unverified per the same record (see Human Verification). |

No orphaned requirements found — REQUIREMENTS.md maps only R017/R018/R019 to Phase 05, and all three are claimed by a plan's `requirements:` frontmatter (05-01: R019, 05-02: R017+R018, 05-03: R019).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/shared/mask.ts` | 38-58 | `SENSITIVE_PATTERNS` capture group `[^"',}\s]+` stops at first whitespace — a secret value containing a space is only partially redacted | 🛑 Critical (per `05-REVIEW.md` CR-01) | **Pre-existing defect (commit 2ff4339), inherited by this phase's 3 new patterns (`accessToken`/`refreshToken`/`otpSessionId`) — not newly introduced. Per phase-specific instructions, not re-filed as a new gap here; already tracked in `05-REVIEW.md`.** |
| `src/main/services/auth-service.ts` | ~423/704/1033/1038 | Redirect-URL log line carries raw `access_token=`/`refresh_token=` in snake_case query params, unmatched by `mask.ts`'s camelCase-only patterns | 🛑 Critical (information disclosure, confirmed live in the real-account observation) | **Pre-existing defect (git blame 2026-05), documented in `05-SPIKE-RESULT.md` §6 and `05-03-SUMMARY.md` Threat Flags, explicitly deferred to Phase 06/07 per this plan's code-change prohibition. Not re-filed here.** |
| `.planning/PROJECT.md` | 27-28, 79 | "Target features" bullets and a milestone checklist line still describe the disproven 3-step OTP login as current/planned fact | ⚠️ Warning | Residual, self-disclosed documentation debt (see Residual Finding above). Contradicts the phase Goal's literal "문서에서 제거" wording in one section of one file; does not affect the corrected canonical contract in REQUIREMENTS.md or PROJECT.md's own contract table. |
| `src/main/services/api-auth-client.ts` | 1-7 | Module docstring still states "Implements the 3-step credential login (otp-sessions → by-credentials → by-credentials-with-otp)" as current fact | ℹ️ Info | Stale comment inherited from the halted first 05-01 run; the methods exist per D-07 (intentionally not deleted) but the docstring doesn't flag them as disproven/inert. Low impact (comment only, not user-facing), but worth a one-line correction in a future doc pass. |
| `src/main/services/auth-service.ts` | 247-492 | `pendingCredentials` (plaintext password) never cleared except in the OTP success path (WR-01, `05-REVIEW.md`) | ⚠️ Warning | Pre-existing/inherited pattern flagged by code review, not newly introduced by this phase's diff; not re-filed as a phase gap. |

No `TBD`/`FIXME`/`XXX` debt markers found in any file touched by this phase (checked all `files_modified` across 05-01/05-02/05-03 plus `05-SPIKE-RESULT.md`); the only `TBD` occurrences in the repo are pre-existing ROADMAP.md placeholders for not-yet-planned Phase 06/07 plan lists, unrelated to this phase's deliverables.

### Human Verification Required

#### 1. ApplyEngine end-to-end consumption of the account-ladder token

**Test:** Before finalizing the API-mode product path (D-04 decision, Phase 06/07), attempt (in a safe/staging context, or via careful manual verification) an actual fan-event application submission using `authService.token` populated by an account-ladder-derived value (the `rt`/accountapi.weverse.io cookie observed in this phase, or a future rung2-exchanged token), rather than the existing browser-mode `we2_access_token`.
**Expected:** `ApplyEngine`'s POST-application flow completes successfully with no code changes, exactly as ROADMAP Phase 05 Success Criteria 3 claims ("ApplyEngine이 이 토큰을 코드 변경 없이 그대로 사용해 신청을 수행할 수 있다").
**Why human:** This is an integration/behavioral claim that the spike itself explicitly says it did not test (05-SPIKE-RESULT.md §4: "형태 수준의 판단이지 실제 배선 테스트는 아니다"). No automated test exercises ApplyEngine with this specific token source — the existing 17/17 regression suite only confirms no code-path regression, not that the new token type is accepted end-to-end by the real apply flow. This determination also carries real-world risk (an actual application submission against a live FIFO event), so it cannot be safely auto-verified by this agent and must be a deliberate human/product decision before Phase 06/07 commits to the API-mode path.

### Gaps Summary

No blocking (`gaps_found`-tier) gaps were identified. All plan-level must-haves across 05-01/05-02/05-03 are backed by real code, real tests (230/230 passing, 0 typecheck errors), and a real single real-account observation documented in `05-SPIKE-RESULT.md`. The phase's central deliverable — R019's rung1(direct) path succeeding against a real account and being recorded transparently, including the parts that did **not** go as expected (rung1 succeeding when research predicted it wouldn't; rung2 never exercised; two form submissions; the `rt`-cookie-is-probably-a-refresh-token discovery; the raw-token-in-redirect-URL leak) — is genuine, not narrated-only.

The phase is held at `human_needed` for exactly one reason: **ROADMAP Success Criteria 3's second clause** ("ApplyEngine can use this token, unchanged, to apply") **was only judged at a type/shape level, never behaviorally exercised**, and the spike's own result document says so outright rather than papering over it. This is not a fabricated gap — it is the phase's own honestly-recorded loose end, elevated here because a shape-level judgment does not meet this verifier's bar for a behavior-dependent claim without either a passing behavioral test or an explicit human sign-off.

A secondary, non-blocking finding is recorded: `PROJECT.md`'s "Target features" bullet list and one milestone-checklist line still describe the disproven 3-step OTP login as current/planned fact, in the same document whose contract table was correctly fixed. This was self-disclosed by the executor and is recommended for cleanup alongside Phase 06/07 planning, not treated as a phase-blocking gap.

---

*Verified: 2026-08-25T10:08:18Z*
*Verifier: Claude (gsd-verifier)*
