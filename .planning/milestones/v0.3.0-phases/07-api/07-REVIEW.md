---
phase: 07-api
reviewed: 2026-08-27T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/main/ipc-handlers.ts
  - src/main/preload.ts
  - src/main/services/__tests__/apply-engine.test.ts
  - src/main/services/__tests__/auth-service.test.ts
  - src/main/services/__tests__/settings-store.test.ts
  - src/main/services/apply-engine.ts
  - src/main/services/auth-service.ts
  - src/main/services/settings-store.ts
  - src/renderer/App.tsx
  - src/renderer/__tests__/auth-event-navigation.test.ts
  - src/renderer/auth-event-navigation.ts
  - src/renderer/components/ApplyExecution.tsx
  - src/renderer/components/LoginPanel.tsx
  - src/renderer/components/__tests__/apply-execution-view.test.ts
  - src/renderer/components/__tests__/login-panel-view.test.ts
  - src/renderer/components/apply-execution-view.ts
  - src/renderer/components/login-panel-view.ts
  - src/shared/__tests__/mask.test.ts
  - src/shared/__tests__/token-expiry.test.ts
  - src/shared/mask.ts
  - src/shared/token-expiry.ts
  - src/shared/types.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 07: 코드 리뷰 보고서

**Reviewed:** 2026-08-27
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

이 phase 가 다루는 두 핵심 보증 — (1) 비밀번호가 IPC 경계를 넘지 않는다(D-01), (2)
`credentials.enc` 4상태 계약이 절대 부분 상태로 새지 않는다(D-04), (3) `apply-engine.ts`
의 D-13 POST-직전 토큰 재조회 — 는 코드와 테스트 양쪽에서 견고하게 확인된다.
`IpcApi.auth.credentialLoginStored(email)` 의 타입 시그니처 자체가 비밀번호를 받지
않고, `AuthService.readStoredCredentials()` 는 모든 실패 분기(파일 읽기/복호화/JSON
파싱/필드 타입)에서 `clearCredentials()` 후 `corrupted` 만 반환하며 결코 `password` 를
동반하지 않는다. `apply-engine.ts:233` 의 `freshToken = authService.token` 재조회와
`restoreTokenIfLost()` 는 각각 회귀 테스트로 고정돼 있다.

다만 이 phase 의 두 번째 핵심 기능인 **R022 사전 경고 → 재로그인 → 재판정** 흐름에서,
**브라우저 모드 재로그인이 D-10 의 재판정 보증을 실제로 이행하지 못하는 결함**을
발견했다(CR-01). `settingsStore` 의 기본 로그인 모드가 `"browser"` 이므로 이 결함은
드문 경로가 아니라 기본 경로에서 발생한다. 그 외 세 건의 WARNING 은 신뢰 경계 자체를
깨지는 않지만 "UI 가 거짓말하지 않는다"는 이 phase 를 관통하는 원칙과 R023 저장
보증을 국소적으로 약화시킨다.

## Critical Issues

### CR-01: 브라우저 모드 재로그인은 D-10 재판정을 실제로 트리거하지 못한다

**File:** `src/renderer/App.tsx:203-239` (특히 207-208, 229-237), `src/main/services/auth-service.ts:967,1084`

**Issue:**
`ApplyExecution` 대기 화면의 "다시 로그인" 버튼(D-15)은 `handleReloginFromWaiting()` 을
호출한다. 이 함수는 로그인 시도가 끝난 뒤(성공이든 실패든) `finally` 블록에서
`window.api.apply.checkTokenExpiry()` 를 호출해 D-10 이 요구하는 "재로그인이 발생하면
새 토큰의 exp 로 재판정한다"를 이행하려 한다.

문제는 **브라우저 모드에서 `await window.api.auth.openLogin()` 가 실제 로그인 완료를
기다리지 않는다는 점**이다. `AuthService.login()`(`auth-service.ts:967`)의 마지막 문장은
`await win.loadURL("https://weverse.io")`(`:1084`)이고, 이 `await` 는 팝업 창의 초기
페이지 로드만 기다린다. 실제 로그인 성공은 그 이후 사용자가 팝업에서 자격증명을
입력하고, `pollForToken()`(500ms 간격 폴링) 또는 `did-navigate` 리스너가 쿠키에서
`we2_access_token` 을 추출한 뒤에야 확정된다 — 이 완료 시점은 `openLogin()` 의 반환과
무관하게 훨씬 나중(수 초~수십 초)에 온다.

즉 `handleReloginFromWaiting()` 의 `finally` 블록은 사용자가 실제로 로그인을 마치기
**전에** `checkTokenExpiry()` 를 호출해버린다 — 이 시점엔 `authService.token` 이 아직
만료 임박한 옛 토큰 그대로이므로 재판정은 사실상 무의미한 재확인(경고가 그대로
남거나, 우연히 safe 로 잘못 안심시킬 수도 없음 — 옛 토큰 기준이므로 결과는 변하지
않는다)에 그친다.

이후 실제 로그인이 완료되면 `AuthService` 는 `login-success` 이벤트를 emit 하지만
(`auth-service.ts:1016,1042`), `App.tsx` 의 `onAuthEvent` 핸들러(`App.tsx:66-73`)는 이
이벤트에서 `setAuthStatus`/`setStep` 만 처리할 뿐 `checkTokenExpiry()` 를 다시 호출하지
않는다. `grep` 로 전체 소스를 확인한 결과 `applyEngine.checkTokenExpiry()`(main)와
`window.api.apply.checkTokenExpiry()`(renderer)를 호출하는 지점은 `App.tsx:233` 단
한 곳뿐이다.

결과: 사용자가 경고를 보고 "다시 로그인"을 눌러 브라우저 팝업에서 실제로 재로그인에
성공해도, 대기 화면의 경고 배너는 갱신되지 않고 계속 남아 있거나(또는 애초에 잘못된
시점에 재확인돼 무의미한 상태로) 사용자를 혼란시킨다. `DEFAULT_LOGIN_MODE = "browser"`
(`settings-store.ts:28`)이므로 이 경로는 API 모드로 전환하지 않은 **모든 기본
사용자**가 밟는 경로다. R022 의 존재 이유("사람이 개입할 시간을 미리 확보한다")와
D-14 의 보장문("재로그인 시도가 상황을 더 나쁘게 만들지 않는다")이 실질적으로
"재로그인해도 경고가 그대로 남아 사용자가 신청을 포기하거나 불필요하게 재시도를
반복하게 만든다"는 방향으로 배신당한다 — API 모드( `credentialLoginStored` 는 전체
헤드리스 흐름이 끝날 때까지 `await` 하므로 정상 동작)와 달리 브라우저 모드에서만
발생하는 비대칭 결함이다.

**Fix:**
브라우저 모드 재로그인의 실제 완료를 기다리도록 고쳐야 한다. 두 가지 방향이 가능하다:

1. `AuthService.login()` 이 팝업 창이 닫히거나(`win.on("closed")`) 토큰이 추출될
   때까지 resolve 하지 않는 Promise 를 반환하도록 바꾸고, `openLogin()` IPC 핸들러가
   그 Promise 를 그대로 전달한다.
2. (더 국소적인 수정) `App.tsx` 의 `onAuthEvent` 핸들러에서 `login-success` /
   `token-validated` / `login-failed` / `cookie-extraction-failed` 이벤트를 받을 때,
   현재 단계가 `"apply-execution"` 이면 `window.api.apply.checkTokenExpiry()` 를 함께
   호출해 실제 로그인 결과가 도착하는 시점에 재판정이 일어나게 한다.

```tsx
// App.tsx onAuthEvent 핸들러 예시 (방향 2)
} else if (event.type === "login-success") {
  setLoginError(null);
  window.api.auth.getStatus().then((s) => {
    setAuthStatus(s);
    if (decision.action === "to-profile" && s.fanId !== undefined) {
      setStep("profile");
    }
  });
  if (stepRef.current === "apply-execution") {
    void window.api.apply.checkTokenExpiry();
  }
}
```

회귀 테스트: `handleReloginFromWaiting()` 이 브라우저 모드에서 실제 로그인 완료
전에는 `checkTokenExpiry()` 를 호출하지 않는지(또는 완료 후 재호출되는지)를 검증하는
테스트를 `App.tsx` 수준(또는 위 방향 1을 택했다면 `auth-service.test.ts` 의
`login()` 완료 시점 계약 테스트)으로 추가할 것.

## Warnings

### WR-01: 대기 화면의 "다시 로그인" 버튼이 로딩 상태로 잠기지 않고, 그 결과값도 버려진다

**File:** `src/renderer/components/ApplyExecution.tsx:241-250`, `src/renderer/App.tsx:203-225`

**Issue:**
`ApplyExecution` 의 재로그인 버튼은 `disabled`/`aria-busy` 속성이 전혀 없다 — 같은
파일의 다른 모든 버튼(신청 실행, 신청 확인, 처음으로)이 `executing`/`verifying` 상태로
잠기는 것과 다른 패턴이다. 연속 클릭 시 `handleReloginFromWaiting()` 이 중복 실행될 수
있다.

API 모드에서 이 중복 클릭은 `AuthService` 의 T-07-09 in-flight 가드
(`auth-service.ts:364-371`)에 걸려 두 번째 호출이 `"로그인이 이미 진행 중입니다."`
실패를 반환한다. 그런데 `handleReloginFromWaiting()`(`App.tsx:213`)은
`await window.api.auth.credentialLoginStored(snapshot.email);` 의 반환값을 **전혀
검사하지 않는다** — `result.success` 를 확인하지도, `result.message` 를 화면에 반영하지도
않는다. T-07-09 가드처럼 `_emit()` 을 거치지 않고 단순 반환값으로만 실패를 알리는
경로는 이 함수에서 완전히 소리 없이 사라진다. 사용자는 두 번째 클릭이 왜 아무 반응이
없었는지 알 방법이 없다.

**Fix:**
버튼에 로딩 상태를 연결하고(App.tsx 는 이미 `loginLoading` state 를 갖고 있다 —
`ApplyExecutionProps` 에 `reloginLoading` 을 추가로 넘기거나 `loginLoading` 을 그대로
전달), `credentialLoginStored()` 의 반환값을 확인해 실패 시 `setLoginError()` 로
반영한다.

```tsx
case "available": {
  const result = await window.api.auth.credentialLoginStored(snapshot.email);
  if (!result.success) {
    setLoginError(result.message ?? "재로그인에 실패했습니다.");
  }
  break;
}
```

### WR-02: `credentialLogin()` 의 timeout→쿠키발견 경로는 자격증명을 저장하지 않는다

**File:** `src/main/services/auth-service.ts:614-619`

**Issue:**
`credentialLogin()` 은 DOM 폴링이 `"token"` 을 직접 반환하는 성공 경로(`:591-611`)에서만
`this.saveCredentials(email, password)` 를 호출한다. 그런데 `result === "timeout"` 이지만
그 시점에 `extractTokenFromCookies()` 로 토큰을 뒤늦게 발견하는 경로(`:614-619`)는
`{ success: true }` 를 반환하면서도 `saveCredentials()` 를 호출하지 않는다 — 로그인은
사실상 성공했는데 R023 의 존재 이유(다음 로그인부터 재입력 생략)가 이 경로에서는
조용히 성립하지 않는다. 사용자는 로그인 성공을 보고 다음에도 자동 채움/저장된
비밀번호 로그인이 될 것으로 기대하지만, 실제로는 저장되지 않아 매번 재입력해야 한다.

**Fix:**
두 성공 경로가 `saveCredentials()` 호출을 공유하도록 통합한다.

```ts
if (result === "timeout") {
  const token = await this.extractTokenFromCookies();
  if (token) {
    this.saveCredentials(email, password);
    this.cleanupHeadless();
    return { success: true };
  }
  ...
}
```

### WR-03: 일반 로그인 폼 성공 후 `storedSnapshot` 이 갱신되지 않아 저장 상태문이 낡은 채로 남는다

**File:** `src/renderer/components/LoginPanel.tsx:150-167` (`handleCredentialLogin`), 대조: `:173-187` (`handleStoredLogin`)

**Issue:**
`handleStoredLogin()` 은 성공/실패 후 `finally` 에서 `refreshStoredSnapshot()` 을 호출해
D-04 4상태 표시를 최신화한다. 그런데 이메일/비밀번호를 직접 입력하는 일반 로그인
경로인 `handleCredentialLogin()` 은 이 갱신을 하지 않는다.

예: 저장 파일이 `corrupted` 상태라 "저장된 로그인 정보를 읽지 못해 초기화했습니다 —
다시 입력해주세요." 안내가 떠 있는 상태에서, 사용자가 안내대로 이메일/비밀번호를 직접
입력해 로그인에 성공하면 `credentialLogin()` 내부에서 새 `credentials.enc` 가 정상
저장된다. 하지만 `storedSnapshot` 은 마운트 시점의 `corrupted` 값 그대로 남아, 로그인
완료 후에도(`loginMode === "api"` 블록은 로그인 상태와 무관하게 렌더링되므로) "초기화
했습니다" 안내가 실제로는 해소된 상태를 거짓으로 계속 보여준다. 이 phase 전체를
관통하는 "UI 가 거짓말하지 않는다" 원칙(D-04/D-07)이 이 지점에서 깨진다.

**Fix:**
`handleCredentialLogin()` 의 `finally` 에도 `refreshStoredSnapshot()` 을 추가한다.

```tsx
const handleCredentialLogin = async () => {
  if (!email || !password) return;
  setCredLoading(true);
  setCredResult(null);
  try {
    const result = await window.api.auth.credentialLogin(email, password);
    if (!result.success) {
      setCredResult(result);
    }
  } catch {
    setCredResult({ success: false, reason: "network-error" });
  } finally {
    setCredLoading(false);
    refreshStoredSnapshot();
  }
};
```

---

_Reviewed: 2026-08-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
