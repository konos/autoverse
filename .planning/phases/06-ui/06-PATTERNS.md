# Phase 06: 로그인 방식 선택 UI + 실패 안내 - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 10 (new/modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/main/services/settings-store.ts` (new) | service | file-I/O (CRUD on local JSON) | `src/main/services/profile-store.ts` | role-match (same file-store shape, inverted error policy) |
| `src/main/login-mode.ts` (modify) | utility | transform (pure resolver) | itself — extend in place | exact (same file, additive change) |
| `src/shared/login-failure.ts` (new) | utility | transform (pure classification) | `src/shared/mask.ts` / `src/shared/form-parser.ts` | exact (same tier, same "pure function + exhaustive switch" idiom) |
| `src/main/preload.ts` (modify) | config/bridge | request-response (IPC bridge) | itself — extend `auth`/`profile` pattern with new `settings` namespace | exact |
| `src/main/ipc-handlers.ts` (modify) | controller | request-response (IPC handlers) | itself — extend + remove `resolveLoginMode()==="api"` branches | exact |
| `src/shared/types.ts` (modify) | model | transform (type contracts) | itself — extend `IpcApi`, `CredentialLoginResult`, add `LoginMode`/`SettingsSnapshot` types | exact |
| `src/renderer/components/LoginPanel.tsx` (modify) | component | request-response (renders + calls IPC) | itself — promote `useState` tab to props-driven persisted selector | exact |
| `src/renderer/components/ApiModeNoticeModal.tsx` (new) | component | request-response (modal confirm/cancel) | `LoginPanel.tsx`'s `button-row`/`.btn` usage (no existing modal in codebase) | role-match (no dialog analog exists; compose from existing button/card idioms) |
| `src/main/services/auth-service.ts` (modify) | service | event-driven (DOM polling → event emit) | itself — modify DOM-poll classification + delete API-login methods (D-02) + gate rewrite (D-03) | exact |
| `src/main/services/api-auth-client.ts` (modify) | service | request-response (HTTP client) | itself — delete `requestOtpSession`/`loginWithCredentials`, keep ladder methods | exact |

## Pattern Assignments

### `src/main/services/settings-store.ts` (service, file-I/O)

**Analog:** `src/main/services/profile-store.ts` (96 lines, full file read)

**Imports pattern** (profile-store.ts lines 1-6):
```typescript
import { safeStorage, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type { Profile } from "../../shared/types";
import { maskPhone, maskBirthDate } from "../../shared/mask";
import { logService } from "./log-service";
```
For `settings-store.ts`, drop `safeStorage` (D-05: plaintext, no encryption) and mask imports (no PII); keep `fs`, `path`, `app`, `logService`, and import `LoginMode` / settings types from `../../shared/types`.

**Path resolution pattern** (profile-store.ts lines 8-12):
```typescript
const PROFILE_FILENAME = "profile.enc";

function getProfilePath(): string {
  return path.join(app.getPath("userData"), PROFILE_FILENAME);
}
```
Mirror exactly with `SETTINGS_FILENAME = "settings.json"` and `getSettingsPath()`.

**Core CRUD pattern — INVERTED error handling (critical divergence):** `ProfileStore.getProfile()` (lines 36-77) throws on missing encryption / parse failure and deletes the corrupt file. `settings-store.ts` MUST NOT throw — D-05 requires silent fallback to `{ loginMode: "browser", apiModeNoticeAckedVersion: null }` with only a `logService.warn(...)` call, never `logService.error()` + throw. Use RESEARCH.md's Pattern 2 skeleton (already vetted against this exact analog) as the literal starting point — it already encodes this inversion:
```typescript
function readSettings(): SettingsFile {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) {
    return { schemaVersion: SCHEMA_VERSION, loginMode: DEFAULT_LOGIN_MODE, apiModeNoticeAckedVersion: null };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SettingsFile>;
    return {
      schemaVersion: SCHEMA_VERSION,
      loginMode: parsed.loginMode === "api" ? "api" : DEFAULT_LOGIN_MODE,
      apiModeNoticeAckedVersion:
        typeof parsed.apiModeNoticeAckedVersion === "number" ? parsed.apiModeNoticeAckedVersion : null,
    };
  } catch (err) {
    logService.warn("SettingsStore", `settings.json 파싱 실패 — 기본값(browser) 폴백: ${String(err)}`);
    return { schemaVersion: SCHEMA_VERSION, loginMode: DEFAULT_LOGIN_MODE, apiModeNoticeAckedVersion: null };
  }
}
```

**Write pattern — diverge from profile-store.ts's direct `writeFileSync`:** use atomic tmp+rename (RESEARCH.md Pattern 2, `writeSettings()`) since settings.json is read on every mode toggle and app boot, unlike the write-once profile.enc.

**Class vs singleton export pattern** (profile-store.ts lines 14, 96):
```typescript
export class ProfileStore { /* ... */ }
export const profileStore = new ProfileStore();
```
Mirror: `export class SettingsStore { getLoginMode()/setLoginMode()/getNoticeAck()/ackNotice() }` + `export const settingsStore = new SettingsStore();`. `ipc-handlers.ts` imports the singleton the same way it imports `profileStore`.

**Logging pattern** (profile-store.ts line 33): `logService.info("ProfileStore", ...)` → use `logService.info("SettingsStore", ...)` / `logService.warn("SettingsStore", ...)`, same call signature.

---

### `src/main/login-mode.ts` (utility, transform) — modify in place

**Current file (26 lines, full file read) — exact current contract to preserve:**
```typescript
export type LoginMode = "api" | "browser";
export const LOGIN_MODE_ENV = "AUTOVERSE_LOGIN_MODE";

export function resolveLoginMode(
  env: NodeJS.ProcessEnv = process.env,
): LoginMode {
  const raw = env[LOGIN_MODE_ENV];
  if (typeof raw === "string" && raw.trim().toLowerCase() === "api") {
    return "api";
  }
  return "browser";
}
```

**Required extension (D-06), copy RESEARCH.md Pattern 1 verbatim — it was verified against the exact existing test file:**
```typescript
export function resolveLoginMode(
  env: NodeJS.ProcessEnv = process.env,
  persistedMode?: LoginMode,
): LoginMode {
  const raw = env[LOGIN_MODE_ENV];
  if (typeof raw === "string" && raw.trim().toLowerCase() === "api") {
    return "api";
  }
  if (persistedMode === "api") return "api";
  return "browser";
}

export function isLoginModeLockedByEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[LOGIN_MODE_ENV];
  return typeof raw === "string" && raw.trim().length > 0;
}
```

**Critical constraint:** DO NOT change `resolveLoginMode()`'s return type to an object — `src/main/__tests__/login-mode.test.ts` (32 lines, full file read) asserts `.toBe("browser")` / `.toBe("api")` string equality 6 times:
```typescript
expect(resolveLoginMode({})).toBe("browser");
expect(resolveLoginMode({ [LOGIN_MODE_ENV]: "api" })).toBe("api");
// ...4 more identical-shape assertions
```
All 6 pass unmodified because they call `resolveLoginMode(fakeEnv)` with no second argument (`persistedMode` stays `undefined` → falls through to `"browser"` unless env says `"api"`). Add new tests for the `persistedMode` param and `isLoginModeLockedByEnv()` in the same file, same `describe`/`it` style with Korean test names.

---

### `src/shared/login-failure.ts` (utility, transform) — new file

**Analog:** `src/shared/mask.ts` (75 lines, full file read) + `src/shared/form-parser.ts` (imports lines 1-20 read)

**Imports pattern (form-parser.ts line 1):**
```typescript
import type { FormSchema, Reward } from "./types";
```
`login-failure.ts` should similarly have zero `electron` import and only import types from `./types` — this is what makes it renderer/main-agnostic and vitest-testable without a DOM.

**Pure-function-with-interface-result pattern (form-parser.ts lines 3-6):**
```typescript
export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}
export function validateFormSchema(schema: FormSchema): SchemaValidationResult { ... }
```
Mirror this shape for `mapLoginFailure()`: an exported `LoginFailureReason` union type + `LoginFailureGuidance` interface + a single exported function performing an exhaustive `switch`. RESEARCH.md's Pattern 4 code block is the concrete skeleton to start from — reuse it as-is except confirm the exact Korean copy strings against `06-UI-SPEC.md`'s "Failure reason → copy" table (the UI-SPEC strings are canon/final; RESEARCH.md's strings are close but UI-SPEC is the later, checker-approved source — prefer UI-SPEC wording verbatim).

**R010 masking integration pattern (mask.ts lines 68-75):**
```typescript
export function maskSensitive(text: string): string {
  let result = text;
  for (const [pattern, replacer] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacer as Parameters<typeof String.prototype.replace>[1]);
  }
  return result;
}
```
`login-failure.ts` itself should NOT call `maskSensitive()` internally (keep it a pure classifier with no cross-module coupling beyond types) — per UI-SPEC's "Identifier format" section and RESEARCH.md Pitfall 2, the **call site** (`auth-service.ts` or `LoginPanel.tsx`) must wrap any `identifier` field with `maskSensitive()` before it reaches `CredentialLoginResult.message`, since that field bypasses `logService`'s automatic masking (`log-service.ts:12-13`, `const maskedMessage = maskSensitive(message);` — verified via RESEARCH.md citation, not independently re-read here as it is out of this phase's modified-file set).

---

### `src/main/preload.ts` (bridge, request-response) — modify

**Full file read (51 lines).** Exact namespace pattern to replicate for `settings:*`:
```typescript
// Existing profile namespace (lines 17-21) — template for settings namespace
profile: {
  save: (profile: Profile) => ipcRenderer.invoke("profile:save", profile),
  get: () => ipcRenderer.invoke("profile:get"),
  clear: () => ipcRenderer.invoke("profile:clear"),
},
```
New block to add to the `api: IpcApi` object (channel names are Claude's Discretion per CONTEXT — suggested to match ipc-handlers.ts section below):
```typescript
settings: {
  getLoginMode: () => ipcRenderer.invoke("settings:get-login-mode"),
  setLoginMode: (mode: LoginMode) => ipcRenderer.invoke("settings:set-login-mode", mode),
  getNoticeAck: () => ipcRenderer.invoke("settings:get-notice-ack"),
  ackNotice: (version: number) => ipcRenderer.invoke("settings:ack-notice", version),
},
```
Also remove the `submitOtp` entry (line 10-11) per D-02 — `needOtp`/OTP screen is deleted, but confirm against `auth-service.ts`'s legacy `'otp'` DOM branch fate (RESEARCH.md Pitfall 3 / Open Question 1) before deleting the IPC channel outright — the planner must decide whether `submitOtp` channel is fully removed or repointed to the D-14 unknown-fallback path.

**Import line to extend (line 2):** add `LoginMode` (from `../main/login-mode` or re-exported via `../shared/types` — Claude's Discretion, but prefer `shared/types.ts` since preload.ts currently only imports from `../shared/types`, not from `../main/*`).

---

### `src/main/ipc-handlers.ts` (controller, request-response) — modify

**Full file read (157 lines).** Handler registration pattern (lines 41-76) to extend:
```typescript
ipcMain.handle("auth:status", async () => authService.getStatus());
// ...
ipcMain.handle("auth:auto-login", async () =>
  authService.tryAutoLogin()
);
```
New `settings:*` handlers follow the same one-liner-per-channel style, delegating to `settingsStore`:
```typescript
ipcMain.handle("settings:get-login-mode", async () => {
  const persisted = settingsStore.getLoginMode();
  const mode = resolveLoginMode(process.env, persisted);
  return { mode, lockedByEnv: isLoginModeLockedByEnv(process.env) };
});
ipcMain.handle("settings:set-login-mode", async (_evt, mode: LoginMode) => {
  settingsStore.setLoginMode(mode);
});
ipcMain.handle("settings:get-notice-ack", async () => settingsStore.getNoticeAck());
ipcMain.handle("settings:ack-notice", async (_evt, version: number) => {
  settingsStore.ackNotice(version);
});
```

**D-02 removal target — exact lines to delete/replace (lines 49-61):**
```typescript
// auth:credential-login — email/password login (mode-dependent: API vs headless browser)
ipcMain.handle("auth:credential-login", async (_evt, email: string, password: string) =>
  resolveLoginMode() === "api"
    ? authService.credentialLoginApi(email, password)
    : authService.credentialLogin(email, password)
);

// auth:submit-otp — submit OTP code for credential login (mode-dependent)
ipcMain.handle("auth:submit-otp", async (_evt, otpCode: string) =>
  resolveLoginMode() === "api"
    ? authService.submitOtpApi(otpCode)
    : authService.submitOtp(otpCode)
);
```
Replace with a single unconditional handler (D-01: `credentialLogin()` IS the API-mode implementation now, no branching needed):
```typescript
ipcMain.handle("auth:credential-login", async (_evt, email: string, password: string) =>
  authService.credentialLogin(email, password)
);
```
Delete the `auth:submit-otp` handler entirely (D-02) unless the planner decides to keep the channel as dead-but-registered for the Pitfall 3 fallback case (unlikely — prefer full removal + `unregisterIpcHandlers()` line 143 update, matching the removal pattern already visible in the file's own `unregisterIpcHandlers()` mirroring of `registerIpcHandlers()`).

**Also update `unregisterIpcHandlers()` (lines 136-157)** — every new `settings:*` handle needs a matching `ipcMain.removeHandler("settings:...")` line, following the existing 1:1 register/unregister symmetry already established for all other namespaces.

---

### `src/shared/types.ts` (model) — modify

**Full relevant section read (types.ts:225-298).** Extension points:

`CredentialLoginResult` (lines 257-261) — add `reason?: LoginFailureReason` per RESEARCH.md's "Recommended Project Structure" note (`types.ts # 수정 — LoginMode, 설정 IPC 타입, CredentialLoginResult 확장(reason?)`):
```typescript
export interface CredentialLoginResult {
  success: boolean;
  needOtp?: boolean;   // D-02: consider removing if `needOtp` UI is fully deleted — check auth-service.ts branch fate first
  message?: string;
  reason?: LoginFailureReason; // new — lets LoginPanel re-derive guidance/actions without re-parsing message text
}
```

`IpcApi` (lines 263-292) — add `settings` namespace matching the `profile`/`auth` sibling shape (lines 273-277 as the direct template):
```typescript
settings: {
  getLoginMode: () => Promise<{ mode: LoginMode; lockedByEnv: boolean }>;
  setLoginMode: (mode: LoginMode) => Promise<void>;
  getNoticeAck: () => Promise<{ ackedVersion: number | null; currentVersion: number }>;
  ackNotice: (version: number) => Promise<void>;
};
```
Import `LoginMode` from `../main/login-mode` — check for existing cross-boundary import precedent first (types.ts currently has no `../main/*` imports visible in the read range; if none exist anywhere in the file, define `LoginMode` locally in `shared/types.ts` instead and have `main/login-mode.ts` import it from there, to keep the dependency direction `main → shared`, not `shared → main`).

---

### `src/renderer/components/LoginPanel.tsx` (component, request-response) — modify

**Full file read (284 lines).** This is the central modification target — extend props, not internal `useState`, per D-04 + UI-SPEC Interaction Contract point 1.

**Current props (lines 4-11):**
```typescript
interface LoginPanelProps {
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: (clearCredentials: boolean) => void;
  onValidateToken: () => void;
}
```
New props needed (mode state now owned by `App.tsx`/main via `settings:get-login-mode`, not local `useState`):
```typescript
interface LoginPanelProps {
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: (clearCredentials: boolean) => void;
  onValidateToken: () => void;
  loginMode: LoginMode;                 // new — from App.tsx state, sourced via settings:get-login-mode
  lockedByEnv: boolean;                 // new
  onSetLoginMode: (mode: LoginMode) => void; // new — App.tsx wraps window.api.settings.setLoginMode + local state update
  noticeAck: { ackedVersion: number | null; currentVersion: number }; // new
  onAckNotice: (version: number) => void; // new
}
```

**Delete target — `needOtp` state + OTP screen (D-02), exact lines:**
- Line 14: `type LoginMode = "credential" | "browser";` → delete local type, import `LoginMode` from `../../shared/types` instead (now `"api" | "browser"` per D-01/D-06).
- Lines 41-42: `const [otpCode, setOtpCode] = useState("");` / `const [needOtp, setNeedOtp] = useState(false);` → delete both.
- Lines 65-84: `handleSubmitOtp` function → delete entirely.
- Lines 222-266: the `{mode === "credential" && needOtp && (...)}` JSX block (OTP input screen) → delete entirely.
- Line 38: `const [mode, setMode] = useState<LoginMode>("credential");` → delete; `mode` now comes from `props.loginMode` (default changes from `"credential"` to `"browser"` per D-04, but this happens at the `settings-store.ts` default level, not here).

**Tab click handler pattern to modify (lines 158-175) — current:**
```tsx
<button
  className={`btn ${mode === "credential" ? "btn-primary" : "btn-secondary"}`}
  onClick={() => { setMode("credential"); setNeedOtp(false); setCredMessage(null); }}
  style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
  disabled={credLoading || loading}
>
  이메일 로그인
</button>
```
New version: label → `API 로그인` (UI-SPEC copywriting contract), `disabled={credLoading || loading || lockedByEnv}`, `onClick` calls a new local handler (not raw `setMode`) that: (1) if `mode === "api"` already active, no-op; (2) else if switching TO `"api"`, check `shouldShowApiModeNotice(noticeAck.ackedVersion, noticeAck.currentVersion)` (UI-SPEC Interaction Contract point 2) — if true, open `ApiModeNoticeModal` instead of calling `onSetLoginMode` directly; if false, call `props.onSetLoginMode("api")` immediately; (3) else switching to `"browser"`, call `props.onSetLoginMode("browser")` directly (no notice needed).

**Structural move (UI-SPEC Interaction Contract point 1) — CRITICAL:** the entire tab block (currently nested inside `{!status.isLoggedIn && (...)}` at line 156) must move OUTSIDE that conditional so tabs render and remain clickable when `status.isLoggedIn === true` too (D-07). Only the credential form / browser-login button (lines 177+) stay inside the `!status.isLoggedIn` gate.

**Failure message region — reuse exactly, this is D-15's mandate (lines 206-208, existing):**
```tsx
{credMessage && (
  <p className="error-message" role="alert">{credMessage}</p>
)}
```
No structural change needed here — only the *source* of `credMessage` changes: instead of raw `result.message`, compute via `mapLoginFailure(result.reason, result.message).message` (from new `src/shared/login-failure.ts`), and conditionally render the "브라우저 로그인으로 전환" button per UI-SPEC's `suggestBrowserSwitch` flag, plus the masked-identifier `.token-preview` chip per UI-SPEC's "Identifier format" section.

**`handleCredentialLogin` pattern to modify (lines 46-63) — remove the `needOtp` branch:**
```typescript
const handleCredentialLogin = async () => {
  if (!email || !password) return;
  setCredLoading(true);
  setCredMessage(null);
  try {
    const result = await window.api.auth.credentialLogin(email, password);
    if (result.needOtp) {                              // ← delete this branch (D-02)
      setNeedOtp(true);
      setCredMessage("이메일로 OTP 코드가 발송되었습니다. 확인 후 입력해주세요.");
    } else if (!result.success) {
      setCredMessage(result.message ?? "로그인 실패");
    }
  } catch (err) {
    setCredMessage(err instanceof Error ? err.message : "로그인 오류");
  } finally {
    setCredLoading(false);
  }
};
```
New version drops the `needOtp` branch and routes `!result.success` through `mapLoginFailure()`.

---

### `src/renderer/components/ApiModeNoticeModal.tsx` (component, request-response) — new file

**No direct analog exists in the codebase** (`grep -riE "dialog|modal|overlay"` over `styles.css` → 0 matches, per UI-SPEC/RESEARCH.md). Compose from RESEARCH.md's Pattern 3 skeleton (already vetted against native `<dialog>` semantics) + `LoginPanel.tsx`'s existing button/card class usage for visual consistency:

```tsx
// RESEARCH.md Pattern 3 skeleton — use as literal starting point
import { useEffect, useRef } from "react";

interface ApiModeNoticeModalProps {
  open: boolean;
  onAcknowledge: () => void;
  onCancel: () => void; // add — UI-SPEC requires explicit cancel path distinct from acknowledge
}

export default function ApiModeNoticeModal({ open, onAcknowledge, onCancel }: ApiModeNoticeModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal(); // .showModal() not .show() — focus trap/backdrop
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby="api-mode-notice-title" onCancel={onCancel /* Escape key */}>
      <h2 id="api-mode-notice-title">API 로그인 방식 안내</h2>
      <p>Weverse 보안 확인(캡차)이 뜨면 이 방식으로 로그인이 실패할 수 있습니다. 이 경우 브라우저 로그인 방식을 사용해주세요.</p>
      <p>자동 재로그인 기능이 없습니다. 앱을 다시 시작하거나 로그인 토큰이 만료되면 직접 다시 로그인해야 합니다.</p>
      <div className="button-row">
        <button className="btn btn-primary" onClick={onAcknowledge}>확인했습니다</button>
        <button className="btn btn-secondary" onClick={onCancel}>취소</button>
      </div>
    </dialog>
  );
}
```
Button classes (`btn btn-primary` / `btn btn-secondary`, `button-row` wrapper) are copied verbatim from `LoginPanel.tsx` lines 209-218's existing button-row idiom — this keeps the modal visually consistent without a new CSS system. Copy strings are FINAL per `06-UI-SPEC.md` "Notice modal" table — do not paraphrase.

**Critical: `onCancel` must NOT call `onAcknowledge`'s side effects.** Per UI-SPEC Interaction Contract point 3, only clicking "확인했습니다" may trigger `settings:ack-notice` + `settings:set-login-mode("api")`; Escape/Cancel must leave both unwritten and revert the visually-selected tab in the parent (`LoginPanel.tsx`) to its prior value.

**New CSS needed (no existing analog):** `dialog::backdrop { background: rgba(0,0,0,0.4); }` and a `max-height` + `overflow-y: auto` rule on the dialog body per UI-SPEC E3 "overflow" resolution — model the scrollable-body-with-pinned-buttons layout on `.consent-body`'s existing `max-height: 120px; overflow-y: auto;` pattern (styles.css lines 264-271) but apply to the dialog's inner content wrapper, not the whole `<dialog>`, so the button row stays pinned outside the scroll area.

---

### `src/main/services/auth-service.ts` (service, event-driven) — modify

**Targeted reads: lines 1-60 (imports/setup), 160-260 (tryAutoLogin/tryAutoRelogin gates), 390-470 (DOM polling + result branches).**

**D-13 fix target — exact current miscategorization (auth-service.ts, DOM poll block, `executeJavaScript` string):**
```javascript
const otpInput = document.querySelector('input[placeholder="인증코드 6자리"]');
if (otpInput) return 'otp';
const recaptcha = document.querySelector('.AuthLoginCredentialWidgetUi_recapcha_wrapper__oMA4m');
if (recaptcha) return 'otp';   // ← BUG: captcha reported as 'otp'
const errWraps = document.querySelectorAll('.text-field_error_wrap__9nRXJ .text-field_error_text__BwsFg, [class*="error_message"]');
for (const el of errWraps) {
  const t = el.textContent.trim();
  if (t.length > 3) return 'error:' + t;
}
return null;
```
Fix: separate the recaptcha check into its own return value (e.g. `'captcha'` instead of reusing `'otp'`), leaving the OTP-input-field check's fate to be resolved per RESEARCH.md Pitfall 3 (route dead OTP branch into the D-14 `unknown` fallback rather than deleting the DOM check, since a real OTP form appearing with no handling would produce silent failure).

**Result-branch dispatch pattern to modify — current `'otp'` branch (auth-service.ts, near line 449):**
```typescript
if (result === "otp") {
  logService.info("AuthService", "credentialLogin(headless): OTP required");
  this._emit({ type: "otp-required", message: "이메일 OTP 인증이 필요합니다. 이메일을 확인해주세요.", timestamp: Date.now() });
  return { success: false, needOtp: true, message: "이메일 OTP 인증이 필요합니다." };
}
```
Replace with a `'captcha'` branch that emits a login-failed event and returns `{ success: false, reason: "captcha", message: <UI-SPEC captcha copy> }` — no `needOtp: true` (D-02 deletes that contract).

**Gate pattern to rewrite (D-03) — current `tryAutoLogin()` gate (lines ~170-182):**
```typescript
if (resolveLoginMode() === "api") {
  logService.info(
    "AuthService",
    "tryAutoLogin: API 모드는 저장된 자격증명으로 자동 로그인 불가 — 매 로그인마다 OTP 필요 (사용자 개입 대기)",
  );
  return false;
}
// First check if existing token in cookies is still valid
const tokenFound = await this.extractTokenFromCookies();
if (tokenFound) { ... return true; }
const creds = this.loadCredentials();
if (!creds) { ... return false; }
// ...then calls this.credentialLogin(creds.email, creds.password) unconditionally for browser mode
```
Per D-03, the mode check must be deleted (both modes now share one gate), and the `this.credentialLogin(creds.email, creds.password)` unattended call at the bottom of `tryAutoLogin()` must ALSO be deleted for both modes — only `extractTokenFromCookies()` cookie-restore stays. Same rewrite pattern applies to `tryAutoRelogin()` (lines ~212+), which has the identical structure (mode gate → `credentialLogin()` call) and must be reduced to cookie-restore only (if cookie restore isn't applicable there, `tryAutoRelogin()` may end up simply always returning `false` post-D-03 — planner must confirm against D-03's exact wording: "차단(두 모드 공통): 저장된 자격증명으로의 `credentialLogin()` 무인 호출").

**D-02 deletion targets (verify via grep, not fully read in this pass — auth-service.ts is 1236 lines):** `credentialLoginApi()`, `submitOtpApi()`, any `finishApiLogin`-named helpers. Planner/implementer should `grep -n "credentialLoginApi\|submitOtpApi\|finishApiLogin" src/main/services/auth-service.ts` before editing to get exact line numbers, since these were not in the read ranges above (auth-service.ts is 1236 lines total — only 3 of ~12 sections were read for this pattern map per the "stop at 3-5 strong analogs" rule; this file IS its own analog, so no external analog search was needed for it).

---

### `src/main/services/api-auth-client.ts` (service, request-response) — modify

**Not read this pass (RESEARCH.md's Recommended Project Structure and CONTEXT.md's D-02 already specify the exact method names to delete: `requestOtpSession()`, `loginWithCredentials()`). Keep:** `acquireFaneventToken()`, `exchangeForService()`, `validateToken()`. Same "constructor-injected fetchFn" pattern noted in CONTEXT.md's Established Patterns section applies unchanged — no new HTTP client shape needed, this is a pure deletion task within an existing class.

---

## Shared Patterns

### R010 Masking — mandatory at renderer-bound failure identifiers
**Source:** `src/shared/mask.ts:69-75` (`maskSensitive()`), verified NOT auto-applied to `CredentialLoginResult.message` (RESEARCH.md Pitfall 2, citing `log-service.ts:12-13` — not independently re-read this pass, cited via RESEARCH.md).
**Apply to:** `src/main/services/auth-service.ts` (wherever a `LoginFailureGuidance.identifier` is constructed from an exception/error-code string before being placed on `CredentialLoginResult`), and optionally `src/shared/login-failure.ts`'s call sites in `LoginPanel.tsx` as defense-in-depth per UI-SPEC's `form-error` row ("still pass through `maskSensitive()` before rendering").
```typescript
import { maskSensitive } from "../../shared/mask";
// at the point CredentialLoginResult.message/identifier is assembled:
identifier: maskSensitive(rawErrorString),
```

### Pure-function-in-shared/ + exhaustive-switch idiom
**Source:** `src/shared/mask.ts`, `src/shared/form-parser.ts` (both electron-free, imported by both main and renderer-adjacent test files).
**Apply to:** `src/shared/login-failure.ts` (new). No `electron` import, no side effects, `switch` over a closed union so TypeScript catches missing cases at compile time (per RESEARCH.md Don't Hand-Roll table).

### profile.enc-style file store, but inverted error policy
**Source:** `src/main/services/profile-store.ts` (class + module-level singleton export, `getXPath()` helper, `fs.existsSync` guard, try/catch around parse with recovery-by-deletion).
**Apply to:** `src/main/services/settings-store.ts` (new). Diverges deliberately on throw-vs-fallback (D-05) and gains atomic tmp+rename writes (not present in profile-store.ts, which does a single `writeFileSync`) since settings.json is written far more frequently (every mode toggle) than profile.enc (explicit save action only).

### IPC namespace symmetry (preload ↔ ipc-handlers ↔ shared/types IpcApi)
**Source:** `src/main/preload.ts` (4 existing namespaces: `auth`, `profile`, `apply`, `log`), `src/main/ipc-handlers.ts` (`registerIpcHandlers()` / `unregisterIpcHandlers()` 1:1 symmetry), `src/shared/types.ts` (`IpcApi` interface mirrors preload's `api` object shape exactly).
**Apply to:** new `settings` namespace — must be added in all three files in the same shape simultaneously, or renderer TypeScript will not compile against `window.api.settings.*`.

### Existing button/card visual idiom (no component library)
**Source:** `src/renderer/styles.css` lines 148-224 (`.btn`, `.btn-primary`, `.btn-secondary`, `.button-row`, `.error-message`, `.success-message`, `.muted`), `src/renderer/components/LoginPanel.tsx` throughout.
**Apply to:** `ApiModeNoticeModal.tsx` (new) and any modified `LoginPanel.tsx` JSX — reuse class names verbatim, never introduce new button/card CSS classes; use inline `style={{}}` for one-off layout only, matching the codebase's existing convention (visible throughout `LoginPanel.tsx`, e.g. line 126 `style={{ gap: "0.5rem" }}`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `ApiModeNoticeModal.tsx` | component | request-response | No dialog/modal component exists anywhere in the codebase (`grep -riE "dialog\|modal\|overlay"` over `styles.css` → 0 matches, confirmed in both RESEARCH.md and UI-SPEC.md). Built from RESEARCH.md's Pattern 3 skeleton + composed from `LoginPanel.tsx`'s existing button-row idiom rather than from a true structural analog. |

## Metadata

**Analog search scope:** `src/main/**`, `src/renderer/components/**`, `src/shared/**`, `src/renderer/styles.css`
**Files read in full:** `LoginPanel.tsx` (284 lines), `login-mode.ts` (26 lines), `profile-store.ts` (96 lines), `preload.ts` (51 lines), `ipc-handlers.ts` (157 lines), `mask.ts` (75 lines), `login-mode.test.ts` (32 lines), `types.ts` (lines 225-298), `styles.css` (lines 1-280)
**Files partially read (targeted, non-overlapping):** `auth-service.ts` (1236 lines total; read lines 1-60, 160-260, 390-470 — 3 non-overlapping sections covering imports/gates/DOM-poll+dispatch), `form-parser.ts` (lines 1-20, imports/shape only)
**Files not read (deletion targets only, names sourced from CONTEXT.md/RESEARCH.md):** `api-auth-client.ts` — exact methods to delete already specified by D-02, no pattern extraction needed for a pure deletion.
**Pattern extraction date:** 2026-08-26
