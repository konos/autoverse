# Phase 07: API 자격 증명 저장 + 토큰 만료 사전 경고 - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 9 (신규 1 + 수정 8)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/shared/token-expiry.ts` (신규) | utility (순수 판정) | transform | `src/shared/login-failure.ts` | exact |
| `src/shared/mask.ts` (수정 — `maskEmail()` 추가) | utility | transform | 같은 파일의 `maskPhone`/`maskMembershipNumber` | exact |
| `src/main/services/auth-service.ts` (수정 — `getStoredEmail()`, D-03 게이트, D-04 삭제+throw, D-14 백업/복원) | service | CRUD + event-driven | `src/main/services/profile-store.ts` (D-04), 자기 자신의 `saveCredentials`/`hasStoredCredentials` (D-03/D-06) | exact |
| `src/main/services/apply-engine.ts` (수정 — `arm()`에서 만료 판정 이벤트, `execute()` D-13 토큰 재조회) | service | event-driven + request-response | 자기 자신의 `arm()`/`execute()` 기존 구조 | exact |
| `src/main/ipc-handlers.ts` (수정 — 신규 `auth:credential-login-stored` 채널) | route (IPC handler) | request-response | 같은 파일의 `auth:credential-login` 핸들러(:49-55) | exact |
| `src/main/preload.ts` (수정 — 신규 채널 노출) | config (IPC bridge) | request-response | 같은 파일의 `auth.credentialLogin` (:18-19) | exact |
| `src/renderer/components/login-panel-view.ts` (수정 — D-02/D-03 이메일 불일치 판정 순수 함수) | hook (순수 판단 모듈) | transform | 같은 파일의 `resolveTabView`/`describeLockedMode` | exact |
| `src/renderer/components/LoginPanel.tsx` (수정 — 프리필, D-06 삭제 버튼 이동, D-07 저장 상태문) | component | request-response | 같은 파일 자체 (조건부 렌더 구조 확장) | exact |
| `src/renderer/components/ApplyExecution.tsx` (수정 — D-15 인라인 경고 + 재로그인 콜백 prop) | component | event-driven | `App.tsx`의 `token-expired`/`logged-out` 이벤트 배선 패턴 | role-match |

## Pattern Assignments

### `src/shared/token-expiry.ts` (신규, utility/transform)

**Analog:** `src/shared/login-failure.ts` (exhaustive switch + discriminated union 관례)

**핵심 패턴 — discriminated union 반환 + exhaustive 처리 관례**
```typescript
// Source: src/shared/login-failure.ts — 이 파일이 확립한 관례를 그대로 따를 것
export type LoginFailureReason =
  | "captcha" | "form-error" | "timeout"
  | "network-error" | "token-ladder-failed" | "unknown";

export function mapLoginFailure(reason: LoginFailureReason, detail?: string): LoginFailureGuidance {
  switch (reason) {
    case "captcha": return { message: "...", suggestBrowserSwitch: true };
    // ... exhaustive, no default — 새 reason 추가 시 컴파일 에러로 누락을 잡는다
  }
}
```

**신규 파일 제안 형태 (RESEARCH.md Pattern 1 그대로):**
```typescript
export type TokenExpiryState =
  | { status: "safe" }
  | { status: "warning"; expAt: number }
  | { status: "unknown" };

export function evaluateTokenExpiry(
  expMs: number | null,
  plannedSubmitAtMs: number,
  bufferMs: number,
): TokenExpiryState {
  if (expMs === null) return { status: "unknown" };
  return expMs < plannedSubmitAtMs + bufferMs
    ? { status: "warning", expAt: expMs }
    : { status: "safe" };
}
```

**exp 파싱 재사용 대상** — `auth-service.ts:1047-1072`의 `isTokenExpired()` 내부 로직(아래)에서
base64url 디코드 + `payload.exp` 추출 부분만 뽑아 별도 헬퍼(`exp: number | null` 반환)로 공유할 것.
`isTokenExpired()`의 "만료 아님으로 가정" 폴백은 그대로 두고, 신규 헬퍼는 실패 시 `null`을 반환해
D-11의 "unknown"으로 이어지게 한다:
```typescript
// Source: src/main/services/auth-service.ts:1047-1072 (실제 파일, 수정하지 않고 파싱부만 추출)
isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) { return false; }
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    ) as { exp?: number };
    if (typeof payload.exp !== "number") { return false; }
    const expMs = payload.exp * 1000;
    return expMs < Date.now();
  } catch (err) { return false; }
}
```

**테스트 파일 위치:** `src/shared/__tests__/token-expiry.test.ts` (신규) — vitest, `.test.ts`만 포함
(`vitest.config.ts`).

---

### `src/shared/mask.ts` (수정, utility/transform)

**Analog:** 같은 파일의 `maskPhone`/`maskMembershipNumber` (마지막 N자만 노출하는 얕은 마스킹)

**기존 패턴 (그대로 복제할 형태)**
```typescript
// Source: src/shared/mask.ts:12-16
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
}
```

**D-07 신설 대상 — `maskEmail()`** (아직 저장소에 없음, IN-02 공백 해소):
로컬파트 첫 글자만 노출 + 도메인 유지 형태를 권장 (예: `k***@weverse.io`). `maskName()`의
"첫 글자 + 나머지 마스킹" 방식을 로컬파트에 적용하는 조합이 기존 관례와 가장 정합적이다:
```typescript
// Source: src/shared/mask.ts:30-34 (maskName, 조합 참고용)
export function maskName(name: string): string {
  if (!name) return "***";
  if (name.length === 1) return `${name}*`;
  return `${name[0]}${"*".repeat(name.length - 1)}`;
}
```

**단일 관문 등록 지점** — `SENSITIVE_PATTERNS` 배열(같은 파일, key=value 로그 매칭용)에도
`email` 키 규칙 추가를 검토할 것. D-07 표시 지점(LoginPanel 상태문)은 화면 문구이지 로그가
아니므로 `maskEmail()` 직접 호출로 충분하나, `AuthStatus`가 로그로도 흐른다는 CONTEXT 경고(재량
항목)에 따라 로그 경로도 함께 마스킹 대상인지 확인할 것.

**테스트:** `src/shared/__tests__/mask.test.ts`에 이메일 케이스 추가 (기존 파일 확장).

---

### `src/main/services/auth-service.ts` (수정, service/CRUD+event-driven)

**Analog 1 (D-04 삭제+throw):** `src/main/services/profile-store.ts`

```typescript
// Source: src/main/services/profile-store.ts (실제 파일, 정확한 D-04 선례)
let json: string;
try {
  json = safeStorage.decryptString(buffer);
} catch (err) {
  logService.error("ProfileStore", `복호화 실패 — 프로필 삭제 후 재입력 필요: ${String(err)}`);
  this._deleteFile(filePath);
  throw new Error("프로필 복호화 실패 — 프로필이 초기화되었습니다");
}
```
D-04 적용 시 `saveCredentials()`의 기존 `isEncryptionAvailable()` 조건(아래)과 대칭을 이루도록,
"safeStorage 불가"와 "복호화/파싱 실패"를 별개 분기로 구분할 것 — 전자는 파일 보존, 후자만 삭제:
```typescript
// Source: src/main/services/auth-service.ts:99-107 (기존 saveCredentials, 대칭 분기 참고)
private saveCredentials(email: string, password: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    logService.warn("AuthService", "safeStorage 사용 불가 — 자격 증명 저장 건너뜀");
    return;
  }
  const json = JSON.stringify({ email, password } satisfies StoredCredentials);
  const encrypted = safeStorage.encryptString(json);
  fs.writeFileSync(getCredentialsPath(), encrypted);
  logService.info("AuthService", `credentials saved for ${email.slice(0, 3)}***`);
}
```

**Analog 2 (D-06/D-07 조회):** 자기 자신의 `hasStoredCredentials()`/`clearCredentials()`
```typescript
// Source: src/main/services/auth-service.ts:109-121 (기존, 이미 구현됨 — 그대로 재사용)
clearCredentials(): void {
  const filePath = getCredentialsPath();
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* ok */ }
    logService.info("AuthService", "credentials cleared");
  }
}
hasStoredCredentials(): boolean {
  return fs.existsSync(getCredentialsPath());
}
```
`getStoredEmail()` 신설은 이 두 메서드와 같은 tier — `getCredentialsPath()` 읽고 복호화해 이메일만
반환, 실패 시 D-04 분기를 태운다.

**D-03 최종 게이트 배치 지점:** `credentialLogin()` 호출 이전, 신규 IPC 핸들러가 호출하는 새
public 메서드(예: `loginWithStoredCredentials(inputEmail)`) 내부. WR-03 선례를 따라 렌더러
`disabled` 판정과 별개로 이메일 비교를 여기서 다시 수행한다.

**D-14 백업/복원 지점** — `credentialLogin()` 시작부 기존 쿠키 제거 직전에 `this.cachedToken`을
지역 변수에 백업하고, 재로그인 실패 시 `this.cachedToken = backup`으로 복원. `commonHeaders()`가
헤더 기반 인증이라는 근거:
```typescript
// Source: src/main/services/weverse-api.ts:13-18
function commonHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-FEV-APP-SOURCE": "FAN_EVENT",
    Accept: "application/json, text/plain, */*",
  };
}
```

**테스트:** `src/main/services/__tests__/auth-service.test.ts` (기존 파일 확장) — D-03/D-04/D-14
케이스 추가.

---

### `src/main/services/apply-engine.ts` (수정, service/event-driven+request-response)

**Analog:** 자기 자신의 `arm()`(현재 구조)과 `execute()`(토큰 캡처 지점)

**D-10 삽입 지점 — `arm()` 끝, `_emitEvent({ type: "armed", ... })` 직전 또는 직후:**
```typescript
// Source: src/main/services/apply-engine.ts (arm(), 실제 구조)
this.selectedRewardIds = selectedRewardIds;
this.selectedConsentIds = consentIds;
this._setPhase("armed");

this._emitEvent({
  type: "armed",
  timestamp: Date.now(),
  data: { rewardIds: selectedRewardIds, consentIds },
});
// ── D-10 삽입 지점: 여기서 evaluateTokenExpiry() 호출 후 별도 이벤트
// (예: type: "token-expiry-checked") 발행. offsetMs=0 권장(Pitfall 4/Open Question 1).
```

**D-13 수정 지점 — `execute()` 내부, `waitUntilSubmitTime()` 이후:**
```typescript
// Source: src/main/services/apply-engine.ts (execute(), 실제 구조 — 현재)
const token = authService.token;                 // (arm 이후 execute 시작 시점, 이르게 캡처됨)
// ...
await this.timing.waitUntilSubmitTime(submitTimeMs);   // 대기, 여기서 시간이 흐른다
// ...
const submitResult = await this.api.submitApplication(
  schema.applyHost, schema.artistCode, schema.eventPublicId,
  token,                                          // ← D-13: 이 token은 stale
  schema.applyToken, payload,
);
```
수정 방향: `waitUntilSubmitTime()` 반환 직후 `const freshToken = authService.token;`을 다시 읽고
`null`이면 기존 `UNAUTHORIZED` 에러 경로(`_emitError("execute", "UNAUTHORIZED", ...)` +
`_setPhase("error")` + throw)를 그대로 재사용한다. 이 에러 경로 자체는 이미 존재하므로(execute()
최상단 참조) 복제해서 대기 이후 지점에도 배치.

**테스트:** `src/main/services/__tests__/apply-engine.test.ts` (기존 파일 확장) — D-10 이벤트 발행,
D-13 토큰 재조회(mid-wait mock 변경) 케이스 추가.

---

### `src/main/ipc-handlers.ts` / `src/main/preload.ts` (수정, route+config/request-response)

**Analog:** 기존 `auth:credential-login` 채널 (handler + preload 양쪽)

```typescript
// Source: src/main/ipc-handlers.ts:49-55
// auth:credential-login — email/password login. D-01: API 모드의 실체가 ...
ipcMain.handle("auth:credential-login", async (_evt, email: string, password: string) =>
  authService.credentialLogin(email, password)
);
```
```typescript
// Source: src/main/preload.ts:15-19
auth: {
  getStatus: () => ipcRenderer.invoke("auth:status"),
  openLogin: () => ipcRenderer.invoke("auth:open-login"),
  credentialLogin: (email: string, password: string) =>
    ipcRenderer.invoke("auth:credential-login", email, password),
```
신규 `auth:credential-login-stored` 채널은 동일한 handle/invoke 짝 패턴을 따르되 **비밀번호 인자
없이 email 하나만 받는다** (D-01). WR-04 선례(`settings:set-login-mode`가 런타임 검증 없이
임의 문자열을 받아들인 결함)를 반복하지 않도록, 신규 핸들러 인자도 `typeof email === "string"`
등 최소 런타임 타입 가드를 추가할 것 — Security Domain 표의 V5 항목이 이 채널을 명시적으로
지목한다.

정리(`removeHandler`) 패턴도 대칭으로 추가:
```typescript
// Source: src/main/ipc-handlers.ts:149-154 (cleanup 블록, 동일 패턴 복제)
ipcMain.removeHandler("auth:credential-login");
```

**테스트:** IPC 핸들러 자체는 통합 성격이라 자동 테스트 대상 밖(기존 관례). `auth-service.ts`의
로직 테스트로 커버.

---

### `src/renderer/components/login-panel-view.ts` (수정, hook/transform)

**Analog:** 같은 파일의 `resolveTabView()` / `describeLockedMode()` — "판단은 순수 함수" 관례

```typescript
// Source: src/renderer/components/login-panel-view.ts:22-28
export function resolveTabView(mode: LoginMode, lockedByEnv: boolean): TabView {
  return {
    active: mode,
    tabsDisabled: lockedByEnv,
    showBadge: lockedByEnv,
  };
}
```
D-03의 이메일 불일치 판정도 같은 모양(입력 몇 개 → 파생 상태 객체)의 신규 순수 함수로 추가한다.
예: `resolveStoredLoginState(inputEmail: string, storedEmail: string | null): { canUseStored: boolean; mismatchNotice: string | null }`. **이 판정은 렌더러의 UI 상태 도출용이며, 실제 게이트는
Main(auth-service.ts)이 다시 수행한다(WR-03 선례) — 여기서는 버튼 disabled/안내 문구만 담당.**

**테스트:** `src/renderer/components/__tests__/login-panel-view.test.ts` (기존 파일 확장, exhaustive
케이스로 신규 함수 커버).

---

### `src/renderer/components/LoginPanel.tsx` (수정, component/request-response)

**Analog:** 파일 자체의 기존 조건부 렌더 구조 (`{!status.isLoggedIn && (...)}` 폼 블록,
`{status.hasStoredCredentials && ...}` 삭제 블록)

D-02(이메일 프리필 + "저장된 비밀번호로 로그인" 버튼), D-06(삭제 버튼을 `isLoggedIn` 조건 밖으로
이동), D-07(저장 상태문 추가)은 모두 이 파일의 기존 JSX 조건부 블록 패턴을 확장하는 형태다 —
새 컴포넌트 파일을 만들지 않는다(D-02 명시). `useState("")` 두 개(이메일/비밀번호 입력값,
:63-64 부근)에 저장된 이메일로 초기화하는 로직을 마운트 시 `useEffect`로 추가.

**주의:** 비밀번호 값은 이 컴포넌트의 어떤 state에도 저장된 비밀번호 원문이 들어가서는 안 된다
(D-01) — "저장된 비밀번호로 로그인" 버튼 클릭은 `email`만 담아 IPC를 호출한다.

**테스트:** JSX 컴포넌트 자체는 `vitest.config.ts`가 `.test.tsx`를 포함하지 않아 자동 테스트 대상
밖 — UAT로만 검증(기존 관례, RESEARCH.md 명시).

---

### `src/renderer/components/ApplyExecution.tsx` (수정, component/event-driven)

**Analog (구조 참고):** `src/renderer/App.tsx`의 `token-expired`/`logged-out` 이벤트 배선
(정확한 라인은 `App.tsx:62-74`, RESEARCH.md에서 확인됨) — 이벤트 수신 → 상태 전이 패턴.

D-15는 새 모달이 아니라 **기존 대기 화면 인라인**에 `role="alert"` 배너 + 재로그인 버튼을 추가하는
것이므로, 06에서 확립된 D-15(06) "인라인 재사용, role=alert 유지" 원칙을 그대로 잇는다. 재로그인
콜백은 `App.tsx`가 소유(LoginPanel 폼이 `isLoggedIn===true`일 때 숨겨지므로 — Pitfall 2)해
`ApplyExecution`에 prop으로 내려준다.

**주의 (Pitfall 3):** `App.tsx:62-74`의 `token-expired`/`logged-out` 핸들러가 `setStep("login")`
+ `setFormSchema(null)`로 화면을 초기화한다. 이 재로그인 흐름이 대기(`apply-execution`) step
도중 이 이벤트를 유발하지 않는지, 유발한다면 이 step에서는 초기화를 억제하는지 반드시 확인할 것
— armed 상태가 날아가면 선착순 이벤트를 통째로 놓친다.

**테스트:** JSX 컴포넌트라 자동 테스트 대상 밖 — UAT.

## Shared Patterns

### 순수 판정 함수 + exhaustive switch/discriminated union
**Source:** `src/shared/login-failure.ts`, `src/shared/token-validation-failure.ts`
**Apply to:** `src/shared/token-expiry.ts`(신규), `login-panel-view.ts`의 D-03 판정 함수
```typescript
// 새 상태 추가 시 컴파일 에러로 누락을 잡는 관례 — default 분기를 두지 않는다
switch (reason) {
  case "captcha": return { ... };
  case "form-error": return { ... };
  // ... exhaustive
}
```

### 삭제-후-재입력 (민감 파일 복호화 실패)
**Source:** `src/main/services/profile-store.ts`
**Apply to:** `src/main/services/auth-service.ts`의 D-04 (credentials.enc 복호화 실패)
```typescript
} catch (err) {
  logService.error("...", `복호화 실패 — ...삭제 후 재입력 필요: ${String(err)}`);
  this._deleteFile(filePath);
  throw new Error("...초기화되었습니다");
}
```

### Main 프로세스 최종 게이트 (렌더러 disabled만 믿지 않음)
**Source:** WR-03 선례(06-REVIEW.md), `hasStoredCredentials()`/`clearCredentials()`의 기존 IPC 노출
방식
**Apply to:** `auth-service.ts`의 D-03 이메일 일치 게이트 — 렌더러(`login-panel-view.ts`)는 UI
비활성화만 담당하고, Main이 신규 IPC 핸들러 내부에서 다시 비교한다.

### 마스킹 단일 관문
**Source:** `src/shared/mask.ts` (`SENSITIVE_PATTERNS`, `maskPhone`/`maskName` 등)
**Apply to:** D-07의 이메일 표시 — 화면 문구/로그 어디든 `maskEmail()` 하나만 거치게 한다. 새
컴포넌트마다 개별 마스킹 로직을 만들지 않는다.

### IPC handle/invoke 짝 + cleanup 대칭
**Source:** `src/main/ipc-handlers.ts` (`auth:*` 핸들러 전체) + `src/main/preload.ts` (`auth.*`)
**Apply to:** 신규 `auth:credential-login-stored` 채널 — handler 등록, preload 노출, cleanup
블록(`removeHandler`) 3곳 모두 대칭으로 추가. WR-04 선례에 따라 인자 런타임 타입 가드 포함.

## No Analog Found

없음 — 9개 파일 모두 코드베이스 내 강한 분석 대상을 찾았다(신규 `token-expiry.ts`도
`login-failure.ts`가 exact 강도의 구조적 analog).

## Metadata

**Analog search scope:** `src/shared/`, `src/main/services/`, `src/main/ipc-handlers.ts`,
`src/main/preload.ts`, `src/renderer/components/`, `src/renderer/App.tsx`
**Files scanned:** `login-failure.ts`, `token-validation-failure.ts`, `mask.ts`,
`profile-store.ts`, `settings-store.ts`, `auth-service.ts`, `apply-engine.ts`, `weverse-api.ts`,
`ipc-handlers.ts`, `preload.ts`, `login-panel-view.ts`, `LoginPanel.tsx`, `ApplyExecution.tsx`,
`App.tsx`, `login-mode-actions.ts`
**Pattern extraction date:** 2026-08-27
