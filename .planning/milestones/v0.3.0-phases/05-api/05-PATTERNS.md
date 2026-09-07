# Phase 5: API 로그인 핵심 흐름 + 토큰 교환 검증 - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/main/services/api-auth-client.ts` (new) | service | request-response (HTTP client, multi-step) | `src/main/services/weverse-api.ts` (error/response shape) + `src/main/services/timing-service.ts` (constructor-injected fetch) | role-match (composite of two analogs) |
| `src/main/services/__tests__/api-auth-client.test.ts` (new) | test | request-response (fetch mock) | `src/main/services/__tests__/timing-service.test.ts` | exact |
| `src/main/services/auth-service.ts` (modified — add `credentialLoginApi`, `submitOtpApi`) | service | event-driven + request-response | itself (`credentialLogin`/`submitOtp` existing methods — extend same class, same idioms) | exact |
| `src/main/services/__tests__/auth-service.test.ts` (modified — add cases) | test | event-driven | itself (existing `describe` blocks, Electron mock pattern) | exact |
| `src/shared/types.ts` (modified — add `ApiLoginResult`/token-exchange types) | model (shared types) | n/a (type defs) | itself (`CredentialLoginResult`, `AuthEvent` interfaces) | exact |
| `src/shared/mask.ts` (modified — add `password`/`otpCode` to `SENSITIVE_PATTERNS`) | utility | transform | itself (`SENSITIVE_PATTERNS` array, line 38-46) | exact |
| `src/main/ipc-handlers.ts` (modified — no new channels required this phase, but if Phase 06 wiring needed, add IPC entries) | route/controller | request-response | itself (`auth:credential-login`/`auth:submit-otp` handlers, line 48-56) | exact |

Note: Phase 05 scope is primarily `api-auth-client.ts` (new) + `auth-service.ts` extension + shared types/mask updates. No new IPC channels are strictly required for Phase 05 per RESEARCH.md (IPC wiring for mode selection is Phase 06); however the exact same registration/teardown pattern in `ipc-handlers.ts` should be used if the planner decides to expose `credentialLoginApi`/`submitOtpApi` via IPC in this phase for testability.

## Pattern Assignments

### `src/main/services/api-auth-client.ts` (service, request-response — new)

**Primary analog:** `src/main/services/timing-service.ts` (constructor-injected fetch)
**Secondary analog:** `src/main/services/weverse-api.ts` (typed error class + timedFetch + per-status mapping)

**Constructor-injected fetch pattern** (`timing-service.ts:20-25`):
```typescript
export class TimingService {
  private readonly fetch: typeof globalThis.fetch;
  constructor(fetchFn: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetchFn;
  }
}
```
Apply verbatim to `ApiAuthClient`:
```typescript
export class ApiAuthClient {
  private readonly fetch: typeof globalThis.fetch;
  constructor(fetchFn: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetchFn;
  }
}
```

**Typed error class pattern** (`weverse-api.ts:33-42`):
```typescript
export class WeverseApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "WeverseApiError";
  }
}
```
Copy this shape as `ApiAuthError` (code + message + statusCode), since the account API returns numeric error codes like `-25044`, `-26000` (see RESEARCH.md "발견 3").

**timedFetch + AbortController pattern** (`weverse-api.ts:21-31`):
```typescript
function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}
```
`ApiAuthClient` must use `this.fetch` (injected) instead of the module-level global `fetch` used here, to remain consistent with the `TimingService` DI pattern (this is the one deviation planner must apply: combine both analogs — timedFetch's abort/timeout shape, but call through `this.fetch`).

**Common headers helper pattern** (`weverse-api.ts:13-19`):
```typescript
function commonHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-FEV-APP-SOURCE": "FAN_EVENT",
    Accept: "application/json, text/plain, */*",
  };
}
```
For `ApiAuthClient`, replicate this shape but for the account API's 5 required headers (per RESEARCH.md "Code Examples" section — `X-ACC-APP-VERSION`, `X-ACC-APP-SECRET`, `X-ACC-SERVICE-ID`, `X-ACC-LANGUAGE`, `X-ACC-TRACE-ID` generated fresh per call via `crypto.randomUUID()`, per Pitfall 1).

**Per-status error mapping pattern** (`weverse-api.ts:69-103`, `fetchFormSchema`):
```typescript
if (res.status === 400) {
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  const code = /* extract code from body */;
  logService.error("WeverseApi", `... 400 code=${code} ...`);
  throw new WeverseApiError(code, /* mapped message */, 400);
}
if (res.status === 401) {
  throw new WeverseApiError("UNAUTHORIZED", "토큰이 만료됐습니다...", 401);
}
if (!res.ok) {
  throw new WeverseApiError("HTTP_ERROR", `... HTTP ${res.status}`, res.status);
}
```
`ApiAuthClient` must replicate this per-status branching for the account API's own error codes (e.g. `-25044` OTP required, `-26000` bad request — surface these as distinct error codes on `ApiAuthError` rather than collapsing to generic messages, per Pitfall 5's spirit of not conflating failure states).

**Network/timeout error handling pattern** (`weverse-api.ts:60-67`):
```typescript
try {
  res = await timedFetch(url, { method: "GET", headers: commonHeaders(token) });
} catch (err) {
  const msg =
    err instanceof Error && err.name === "AbortError"
      ? "네트워크 타임아웃"
      : `네트워크 에러: ${String(err)}`;
  logService.error("WeverseApi", `... error: ${msg}`);
  throw new WeverseApiError("NETWORK_ERROR", msg);
}
```
Copy this exact try/catch shape for every `ApiAuthClient` method (`requestOtpSession`, `loginWithCredentials`, `verifyOtp`, `exchangeForService`).

**Masking on log lines** (`weverse-api.ts:52`, `132`, `235`):
```typescript
logService.info("WeverseApi", `fetchFormSchema eventId=${eventId} token=${maskToken(token)}`);
```
`ApiAuthClient` must NEVER log `password` or `otpCode` fields directly (per RESEARCH.md Pitfall 3) — log only non-sensitive fields (email prefix, otpSessionId, masked token via `maskToken()` from `shared/mask.ts`). Never `JSON.stringify` a full request body that includes password/otpCode.

---

### `src/main/services/__tests__/api-auth-client.test.ts` (test — new)

**Analog:** `src/main/services/__tests__/timing-service.test.ts`

**Fetch-mock helper pattern** (`timing-service.test.ts:10-27`):
```typescript
function makeFetchWith(
  dateHeader: string | null,
  responseDelayMs = 0,
): typeof globalThis.fetch {
  return vi.fn(async () => {
    if (responseDelayMs > 0) {
      await new Promise((r) => setTimeout(r, responseDelayMs));
    }
    return {
      headers: { get: (name: string) => /* ... */ },
      ok: true,
      status: 200,
    } as unknown as Response;
  });
}
```
Adapt this into a `makeFetchWith(status, jsonBody)` helper that returns a mocked `Response` with `.json()`, `.status`, `.ok` for the three-step login + exchange call sequence. No Electron mocking needed since `ApiAuthClient` has zero Electron dependency (pure fetch), matching `TimingService`'s test isolation.

Construct client under test the same way: `const svc = new ApiAuthClient(makeFetchWith(...))` (constructor injection, no `vi.mock` needed for this file).

---

### `src/main/services/auth-service.ts` (service, event-driven — modified, add methods)

**Analog:** itself — existing `credentialLogin`/`submitOtp` methods (same class, same conventions)

**Progress-event + success/failure emission pattern** (`auth-service.ts:185-188, 377-388`):
```typescript
async credentialLogin(email: string, password: string): Promise<CredentialLoginResult> {
  logService.info("AuthService", "credentialLogin(headless): starting");
  this._emit({ type: "credential-login-progress", message: "로그인 시도 중...", timestamp: Date.now() });
  // ...
  if (result === "token") {
    this.saveCredentials(email, password);
    return { success: true };
  }
  if (result === "otp") {
    this._emit({ type: "otp-required", message: "이메일 OTP 인증이 필요합니다...", timestamp: Date.now() });
    return { success: false, needOtp: true, message: "..." };
  }
}
```
New `credentialLoginApi(email, password)` must follow the identical emission contract: emit `credential-login-progress` at start, `otp-required` when the server demands OTP (`-25044` from `ApiAuthClient`), and on final success set `this.cachedToken` + call `this.validateToken()` — but **only after** the token-exchange step succeeds (per RESEARCH.md Pitfall 5 — do not set `cachedToken` on account-login success alone; wait for exchange result). Reuse `CredentialLoginResult` return shape (`{ success, needOtp?, message? }`).

**Credential persistence reuse** (`auth-service.ts:58-67`, `saveCredentials`):
```typescript
private saveCredentials(email: string, password: string): void {
  if (!safeStorage.isEncryptionAvailable()) { /* warn, skip */ return; }
  const json = JSON.stringify({ email, password } satisfies StoredCredentials);
  const encrypted = safeStorage.encryptString(json);
  fs.writeFileSync(getCredentialsPath(), encrypted);
}
```
`credentialLoginApi` should call this exact existing private method on full success (email/password only — never persist `otpCode`, matching the existing headless path's behavior at line 379/478).

**`_emit` dual-channel pattern** (`auth-service.ts:851-855`):
```typescript
private _emit(event: AuthEvent): void {
  this.emit(event.type, event);
  this.emit("auth-event", event);
}
```
New methods must call `this._emit(...)` — never `this.emit(...)` directly — so IPC forwarding in `ipc-handlers.ts` (`authService.on("auth-event", forwardAuthEvent)`) picks up new event types automatically. New `AuthEvent` type variants (e.g. token-exchange progress/failure) must be added to the `AuthEvent["type"]` union in `shared/types.ts` first.

**isTokenExpired reuse (no changes needed)** (`auth-service.ts:823-849`) — call as-is on whatever token is finally cached (account token or exchanged token), consistent with Don't-Hand-Roll guidance in RESEARCH.md.

---

### `src/main/services/__tests__/auth-service.test.ts` (test — modified, add cases)

**Analog:** itself — existing Electron mock + `describe` block structure

**Electron mock pattern** (`auth-service.test.ts:7-16`):
```typescript
vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn(() => "/tmp/test-userData") },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));
```
Reuse verbatim — this must remain declared before importing `AuthService`. New tests for `credentialLoginApi`/`submitOtpApi` will additionally need to inject a mocked `ApiAuthClient` (constructor-DI or module-level mock via `vi.mock("../api-auth-client")`) since `AuthService` will instantiate/call it internally.

**JWT test helper reuse** (`auth-service.test.ts:22-33`, `base64urlEncode`/`makeJwt`) — reuse directly to construct fake exchanged tokens for `isTokenExpired`/`validateToken` interaction tests.

---

### `src/shared/types.ts` (model — modified, add types)

**Analog:** itself — `CredentialLoginResult` (line 257-261), `AuthEvent` (line 243-255)

```typescript
export interface CredentialLoginResult {
  success: boolean;
  needOtp?: boolean;
  message?: string;
}
```
Add new types following this exact shape convention (flat interface, optional fields for branching state), e.g.:
```typescript
export interface ApiLoginResult {
  success: boolean;
  needOtp?: boolean;
  message?: string;
}
export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  serviceUserId?: string;
  expiresIn?: number;
}
```
Extend the `AuthEvent["type"]` union (line 244-252) by adding new literal members (e.g. `"otp-expired"`, `"token-exchange-progress"`, `"token-exchange-failed"`) in the same string-literal-union style — do not introduce a discriminated-union redesign.

---

### `src/shared/mask.ts` (utility — modified, add patterns)

**Analog:** itself — `SENSITIVE_PATTERNS` array (line 38-46)

```typescript
const SENSITIVE_PATTERNS: Array<[RegExp, (match: string, key: string, val: string) => string]> = [
  [/(Authorization:\s*)([^\s,}]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  [/(applyToken["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  // ... 5 more entries, same [regex, replacer] tuple shape
];
```
Add two new tuples for `password` and `otpCode` following the identical `(["']?\s*[:=]\s*["']?)([^"',}\s]+)` regex shape, masked via `maskToken()` (full redaction, since these have no safe partial-reveal convention unlike phone/name). This directly satisfies RESEARCH.md Pitfall 3's explicit recommendation.

---

## Shared Patterns

### Constructor-injected fetch (testability)
**Source:** `src/main/services/timing-service.ts:20-25`
**Apply to:** `api-auth-client.ts` (mandatory — this is the phase's core new-service pattern)
```typescript
constructor(fetchFn: typeof globalThis.fetch = globalThis.fetch) {
  this.fetch = fetchFn;
}
```

### Typed error + per-status HTTP mapping
**Source:** `src/main/services/weverse-api.ts:33-42, 69-103`
**Apply to:** `api-auth-client.ts` — new `ApiAuthError` class, mapping account-API numeric codes (`-25044`, `-26000`, etc.) to distinct `code` values rather than generic strings.

### AuthEvent emission via `_emit()`
**Source:** `src/main/services/auth-service.ts:851-855`
**Apply to:** All new `AuthService` methods — never call `this.emit()` directly; always route through `_emit()` so `ipc-handlers.ts`'s existing `auth-event` forwarding picks up new event types with zero changes to `ipc-handlers.ts`.

### Sensitive-field masking before any log line
**Source:** `src/shared/mask.ts` (`maskToken`, `SENSITIVE_PATTERNS`)
**Apply to:** `api-auth-client.ts` and `auth-service.ts` new methods — never `JSON.stringify` a request/response body containing `password` or `otpCode`; log only non-sensitive fields plus `maskToken()`-wrapped tokens.

### IPC registration/teardown symmetry
**Source:** `src/main/ipc-handlers.ts:48-56, 137-138`
**Apply to:** If the planner decides to expose new methods via IPC in this phase (optional — Phase 06 owns UI wiring), add corresponding `ipcMain.handle(...)` in `registerIpcHandlers()` and matching `ipcMain.removeHandler(...)` in `unregisterIpcHandlers()`, mirroring the `auth:credential-login`/`auth:submit-otp` pair exactly.

## No Analog Found

None — all files in scope have at least a role-match analog within the existing codebase (the new `api-auth-client.ts` is a composite of two strong analogs, `timing-service.ts` for DI shape and `weverse-api.ts` for HTTP error handling shape).

## Metadata

**Analog search scope:** `src/main/services/`, `src/main/services/__tests__/`, `src/main/ipc-handlers.ts`, `src/shared/`
**Files scanned:** `timing-service.ts`, `weverse-api.ts`, `auth-service.ts`, `timing-service.test.ts`, `auth-service.test.ts`, `ipc-handlers.ts`, `shared/types.ts`, `shared/mask.ts` (8 files, all fully read)
**Pattern extraction date:** 2026-08-25
