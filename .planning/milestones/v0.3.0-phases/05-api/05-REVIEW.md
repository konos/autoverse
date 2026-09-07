---
phase: 05-api
reviewed: 2026-08-25T10:00:15Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/main/services/account-token-capture.ts
  - src/main/services/__tests__/account-token-capture.test.ts
  - src/main/services/auth-service.ts
  - src/main/services/__tests__/auth-service.test.ts
  - src/main/services/api-auth-client.ts
  - src/main/services/__tests__/api-auth-client.test.ts
  - src/main/login-mode.ts
  - src/main/__tests__/login-mode.test.ts
  - src/main/ipc-handlers.ts
  - src/shared/mask.ts
  - src/shared/__tests__/mask.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 05-api: Code Review Report

**Reviewed:** 2026-08-25T10:00:15Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the R019 ladder-validation spike: `account-token-capture.ts`'s pure
helpers, the CDP-fallback wiring and `runAccountTokenLadderSpike()` in
`auth-service.ts`, the `ApiAuthClient` HTTP login/ladder implementation,
`login-mode.ts`'s env-var gate, the IPC wiring, and the `mask.ts` additions
for `accessToken`/`refreshToken`/`otpSessionId`.

The spike's own non-invasiveness, single-flight, and no-new-BrowserWindow
invariants all check out — `runAccountTokenLadderSpike()` never assigns
`cachedToken`/`cachedFanId`, the `spikeInFlight` guard is race-free (set
synchronously before the first `await`), and it is only ever reached from
inside `credentialLogin()`'s existing success branch, not exposed via IPC.
No new instance of the raw-URL-logs-a-token class was found in this phase's
own code — every log call added by this phase routes account/fanevent
token values through `describeTokenShape()`/`maskToken()` or omits the
value entirely (cookie/CDP diagnostics only ever log name/domain/length/
httpOnly/shape, matching the phase's stated invariant).

One genuine security defect was found in the masking layer that this phase
extended: the shared `SENSITIVE_PATTERNS` capture-group regex in
`src/shared/mask.ts` stops at the first space (or comma/brace) inside a
sensitive value, so any `accessToken`/`refreshToken`/`otpSessionId`/
`password`/`otpCode` value that happens to contain one of those characters
is only partially redacted — the remainder is written verbatim to the
persisted log file and broadcast to the renderer over IPC. This directly
undermines the phase's own "no raw token reaches any log string" invariant
in the case the assumption (secrets never contain spaces) doesn't hold.
Flagged as a Critical finding since this is the mechanism the entire phase
relies on as the last line of defense.

The remaining findings are memory-hygiene, resource-cleanup, and
robustness gaps in the CDP wiring and the pre-existing headless
credential-login path, plus two low-priority Info items.

## Critical Issues

### CR-01: `maskSensitive()` regex only masks up to the first space/comma/brace, leaking the remainder of the secret value

**File:** `src/shared/mask.ts:38-58`
**Issue:**
Every rule in `SENSITIVE_PATTERNS` (including the three added by this phase
for `accessToken`, `refreshToken`, `otpSessionId`, plus the pre-existing
`password`/`otpCode`/`applyToken` rules that share the same capture-group
shape) uses the character class `[^"',}\s]+` for the value to redact. This
class excludes whitespace, so if the actual secret value contains a space
(or a literal `,`/`}` that isn't the JSON delimiter), only the leading
substring up to that character gets passed through `maskToken`/`maskPhone`/
etc — everything after it is left in the output untouched.

Reproduced directly against the exported patterns:
```
maskSensitive('accessToken=abc def.ghi')
  → "accessToken=MASKED(abc) def.ghi"      // " def.ghi" leaks
maskSensitive(JSON.stringify({accessToken: "abc def.ghi"}))
  → '{"accessToken":"MASKED(abc) def.ghi"}' // even quoted JSON leaks — the
                                             // closing quote and everything
                                             // after it survives verbatim
```
`log-service.ts`'s `maskData()` calls `JSON.stringify(data)` and then
`maskSensitive()` on the result — this is the exact code path Phase 05's
new diagnostic logging (`logService.info/error` calls with `data`) and any
future caller will go through, so this is not merely a theoretical gap in
an unused helper; it is the single mechanism the phase's own security
invariant ("no raw token... may reach any log string") depends on. Nothing
in the codebase currently guarantees `accessToken`/`refreshToken`/
`otpSessionId`/`password` values are space-free — `otpSessionId` is
documented (mask.test.ts comment, line 159-162) as actually holding a
2489-char reCAPTCHA Enterprise token, and `password` is user-supplied
without a space-forbidding validator anywhere in this codebase.

**Fix:** Match the actual value up to its closing delimiter (the quote
character that opened it, when present), not up to the first whitespace:
```ts
// Before:
[/(accessToken["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],

// After — capture the opening quote (if any) and match up to its matching
// closing quote, falling back to a delimiter-only match when unquoted:
[
  /(accessToken\s*[:=]\s*)(?:"([^"]*)"|'([^']*)'|(\S+))/g,
  (full, prefix: string, dq?: string, sq?: string, bare?: string) => {
    const val = dq ?? sq ?? bare ?? "";
    const quote = dq !== undefined ? '"' : sq !== undefined ? "'" : "";
    return `${prefix}${quote}${maskToken(val)}${quote}`;
  },
],
```
Apply the same pattern to every rule in `SENSITIVE_PATTERNS`. Add a
regression test asserting a value containing an embedded space (e.g.
`{"password":"super secret"}`) is fully redacted, not just up to the first
space — the current test suite (`mask.test.ts`) has no such case, which is
why this shipped undetected.

## Warnings

### WR-01: `pendingCredentials` (plaintext password) is never cleared on the direct-success or any failure path of `credentialLogin()`

**File:** `src/main/services/auth-service.ts:247, 436-491`
**Issue:** `credentialLogin()` sets `this.pendingCredentials = { email, password }` unconditionally at the top (line 247). The only code path that ever resets it back to `null` is the OTP branch, inside `submitOtp()`'s success handler (line 542-544). Every other path out of `credentialLogin()` — the direct-token success branch (line 436-447), the OTP-required branch (449-453), the timeout branch (455-474), the form-error branch (476-482), the "알 수 없는 상태" branch (484-485), and the catch-all error branch (486-492) — leaves `this.pendingCredentials` holding the plaintext password for the remaining lifetime of the singleton `authService`. Compare with `finishApiLogin()` in the API-mode path, which explicitly nulls out the equivalent `this.apiLoginState` (containing the same plaintext password) on every exit, success or failure.
**Fix:** Clear `this.pendingCredentials = null` in the direct-success branch (after `saveCredentials`) and in every failure branch of `credentialLogin()`, mirroring what `finishApiLogin()` already does for `apiLoginState`:
```ts
if (result === "token") {
  this.saveCredentials(email, password);
  this.pendingCredentials = null; // add this
  void this.runAccountTokenLadderSpike("credentialLogin").catch(...);
  this.cleanupHeadless();
  return { success: true };
}
```

### WR-02: CDP debugger is never explicitly detached on headless-window cleanup

**File:** `src/main/services/auth-service.ts:734-739, 748-829`
**Issue:** `attachAccountTokenCapture()` calls `dbg.attach("1.3")` and registers `Network.enable` on every `credentialLogin()` call, but `cleanupHeadless()` only calls `win.close()` — it never calls `dbg.detach()`. Electron typically tears down the debugger when the underlying `WebContents` is destroyed, but this is implicit and undocumented behavior to rely on; if a future change reuses a `WebContents` (e.g., pooling) or if `win.close()` is ever delayed/cancelled by a `beforeunload` handler on the login page, a debugger could remain attached, causing the *next* `dbg.attach("1.3")` call to throw "Another debugger is already attached" (a failure mode the code already anticipates and swallows at line 766-774, but which would then silently disable CDP capture for that attempt without an obvious root cause).
**Fix:** Call `dbg.detach()` defensively in `cleanupHeadless()` before `win.close()`, wrapped in try/catch since `detach()` throws if nothing is attached:
```ts
private cleanupHeadless(): void {
  if (this.headlessWindow && !this.headlessWindow.isDestroyed()) {
    try { this.headlessWindow.webContents.debugger.detach(); } catch { /* not attached */ }
    this.headlessWindow.close();
  }
  this.headlessWindow = null;
}
```

### WR-03: `pendingRequestId` tracks only one in-flight `by-credentials` request — a resubmit can silently drop the captured response

**File:** `src/main/services/auth-service.ts:748-821`
**Issue:** `pendingRequestId` is a single closure-scoped variable shared across the whole CDP `message` listener's lifetime. If the login form is submitted twice against the same window (e.g., the user retries after a validation error, or the by-credentials call is itself retried by the page), a second `Network.responseReceived` for `BY_CREDENTIALS_PATH` overwrites `pendingRequestId` before the first request's `Network.loadingFinished` arrives. When the first request's `loadingFinished` event does arrive, `params?.requestId === pendingRequestId` is now `false` (it now holds the second request's id), so the first response body is silently never fetched — no error, no log, just a missed capture. Since this capture is exactly what the CDP-fallback path of `runAccountTokenLadderSpike()` depends on when no cookie candidate exists, this can quietly undermine the very observability the spike exists to provide.
**Fix:** Track in-flight requests in a `Map<requestId, true>` (or a `Set`) instead of a single variable, and process each `loadingFinished` independently:
```ts
const pendingRequestIds = new Set<string>();
// on responseReceived: pendingRequestIds.add(requestId)
// on loadingFinished: if (pendingRequestIds.has(params.requestId)) { pendingRequestIds.delete(params.requestId); ...fetch body... }
```

### WR-04: `BY_CREDENTIALS_PATH` is matched via unanchored substring on the full response URL

**File:** `src/main/services/auth-service.ts:785, 18`
**Issue:** `url.includes(BY_CREDENTIALS_PATH)` matches the literal string `/v4/auth/token/by-credentials` anywhere in the URL — including query strings, hash fragments, or a lookalike path on an unrelated host that happens to embed this substring (e.g. `https://evil.example/?next=/v4/auth/token/by-credentials`). Given the headless window only ever navigates to `LOGIN_URL` and stays within Weverse's own login flow, the realistic risk is low, but the CDP listener has no origin check, so any future change to the login page (embedded third-party iframe, ad content, redirect chain) could cause the capture logic to key off an untrusted response.
**Fix:** Parse the URL and check both origin and pathname:
```ts
const parsed = url ? new URL(url) : null;
if (parsed?.hostname.endsWith("weverse.io") && parsed.pathname === BY_CREDENTIALS_PATH) { ... }
```

## Info

### IN-01: Hardcoded `X-ACC-APP-SECRET` value in `ApiAuthClient`

**File:** `src/main/services/api-auth-client.ts:70`
**Issue:** `accountHeaders()` embeds `"X-ACC-APP-SECRET": "5419526f1c624b38b10787e5c10b2a7a"` as a literal string. This matches the generic "hardcoded secret" scan pattern. Project docs (`PROJECT.md`, `REQUIREMENTS.md`) confirm this is an intentionally fixed, publicly-observable header value the official Weverse web client itself sends (not a per-user credential), so this is not a live vulnerability — but it's worth a one-line comment at the call site pointing to that documentation so a future secret-scan doesn't need to re-derive the context, and so nobody "fixes" it into an env var that then goes stale/missing.
**Fix:** Add a comment referencing `REQUIREMENTS.md`/`PROJECT.md`'s API contract entry directly above line 70.

### IN-02: `credentialLogin()` has grown into a ~250-line, deeply-nested function

**File:** `src/main/services/auth-service.ts:243-493`
**Issue:** This function now handles DOM polling, keystroke simulation, OTP/error/timeout branching, CDP capture kickoff, and ladder-spike kickoff all inline, with nesting exceeding 4 levels in places (the `pollTimer` callback inside the `Promise` executor inside the `try` block). This predates Phase 05 but Phase 05 added two more integration points (`attachAccountTokenCapture`, `runAccountTokenLadderSpike`) into the same function body, increasing its complexity further.
**Fix:** Extract the DOM-interaction steps (fill email/password, wait-for-button-enabled, click) and the result-polling `Promise` into named private helper methods to make the control flow easier to follow and unit-test in isolation.

### IN-03: `executeJavaScript` result types are asserted, not validated, at runtime

**File:** `src/main/services/auth-service.ts:320-329, 333-346`
**Issue:** Results of `win.webContents.executeJavaScript(...)` are cast with `as { emailLen: number; pwLen: number }` / `as boolean` without any runtime shape check. If the page's DOM structure changes in a way that causes the injected script to return `undefined` or a differently-shaped object, the code will silently proceed with `NaN`/`undefined` field access rather than failing fast with a clear diagnostic.
**Fix:** Low priority given this is inherently loosely-typed browser-automation code; if hardened later, add a minimal runtime guard (e.g. `typeof x === "object" && typeof x.emailLen === "number"`) before trusting the cast.

---

_Reviewed: 2026-08-25T10:00:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
