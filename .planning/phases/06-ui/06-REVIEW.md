---
phase: 06-ui
reviewed: 2026-08-26T06:09:12Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/main/services/settings-store.ts
  - src/shared/api-mode-notice.ts
  - src/shared/login-failure.ts
  - src/main/login-mode.ts
  - src/shared/types.ts
  - src/main/preload.ts
  - src/main/ipc-handlers.ts
  - src/main/services/auth-service.ts
  - src/main/services/api-auth-client.ts
  - src/renderer/App.tsx
  - src/renderer/components/LoginPanel.tsx
  - src/renderer/components/ApiModeNoticeModal.tsx
  - src/renderer/components/login-panel-view.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-26T06:09:12Z
**Depth:** standard
**Files Reviewed:** 13 (+ styles.css 부분 검토)
**Status:** issues_found

## Summary

Phase 06(로그인 방식 선택 UI + 실패 안내)의 7개 플랜 산출물을 06-CONTEXT.md의 D-01~D-15 결정과 대조하며 검토했다. **D-02(반증된 API 로그인 코드 삭제)는 완전히 깨끗하다** — `submitOtp`/`verifyOtp`/`credentialLoginApi`/`OtpSession`/`needOtp`/`auth:submit-otp` 등 삭제 대상 전부가 코드에서 실제로 사라졌고 고아 참조가 없다. **D-03(무인 로그인 가드)도 실제로 held** — `tryAutoLogin()`/`trySessionRestore()` 어느 경로도 `credentialLogin()`을 호출하지 않으며, `credentialLogin()` 호출자는 IPC 핸들러 한 곳뿐이다. **IPC 3자 정합(preload/ipc-handlers/types)도 `settings:*` 4채널 전부 등록·해제·타입 선언이 일치**한다.

반면 이 phase가 최우선으로 챙기겠다고 선언한 두 축(①마스킹 관문의 완전성, ②고지 모달의 "확인해야만 진행" 계약)에서 각각 **실제로 검증되지 않은 채 남은 결함**을 발견했다:

1. `ApiModeNoticeModal`의 "확인했습니다" 흐름(`handleAcknowledge`)이 `onSetLoginMode()`가 실패 시 예외를 던질 것으로 가정하지만, 그 구현(`App.tsx`의 `handleSetLoginMode`)은 자신의 실패를 스스로 삼키고 절대 reject하지 않는다 — 모드 저장이 실제로 실패해도 모달은 "성공"으로 닫힌다.
2. `validateToken()`의 실패 경로(401/파싱 실패/fanId 없음)가 서버 응답 본문 최대 200자를 `maskSensitive()`를 거치지 않고 `AuthEvent`로 렌더러에 직접 흘려보낸다 — 06-05-SUMMARY.md는 이 경로가 "이미 같은 mapLoginFailure()/emit 경로를 타 자동으로 혜택을 받는다"고 기록했지만, 코드상 그 경로는 `buildFailureResult()`를 전혀 거치지 않는다.

이 외에 마스킹 규칙의 구조적 한계, 6개 확정 문구 계약을 우회하는 미분류 실패 분기, 설정 IPC의 런타임 입력 검증 부재 등을 WARNING으로 기록했다.

## Critical Issues

### CR-01: 고지 모달 확인 흐름이 로그인 방식 저장 실패를 감지하지 못한다 — "확인해야만 진행"이 거짓으로 성공 보고될 수 있음

**File:** `src/renderer/App.tsx:130-139`, `src/renderer/components/LoginPanel.tsx:95-107`

**Issue:**

`LoginPanel.tsx`의 `handleAcknowledge()`는 다음과 같이 구현되어 있다:

```ts
const handleAcknowledge = async () => {
  setNoticeSaving(true);
  setNoticeSaveError(null);
  try {
    await onAckNotice(noticeAck.currentVersion);
    await onSetLoginMode("api");   // ← 이 호출이 실패하면 catch로 빠질 것을 전제
    setNoticeOpen(false);
  } catch {
    setNoticeSaveError("저장에 실패했습니다. 다시 시도해주세요.");
  } finally {
    setNoticeSaving(false);
  }
};
```

하지만 `onSetLoginMode` prop으로 주입되는 `App.tsx`의 `handleSetLoginMode`는 자기 자신의 실패를 절대 밖으로 던지지 않는다:

```ts
const handleSetLoginMode = async (mode: LoginMode) => {
  try {
    await window.api.settings.setLoginMode(mode);
    setLoginModeState(mode);
    setLoginError(null);
  } catch (err) {
    console.error("로그인 방식 설정 저장 실패:", err);
    setLoginError("설정 저장에 실패했습니다. 다시 시도해주세요.");
  }
  // rethrow 없음 — 항상 정상적으로 resolve된다
};
```

`handleSetLoginMode`는 원래 탭 클릭 경로(`handleTabClick` → `void onSetLoginMode(mode)`, fire-and-forget)를 위해 설계된 함수이고, 그 용도에서는 "실패를 스스로 삼키고 상단 `loginError` 배너로만 알린다"는 설계가 App.tsx 자체 주석(122-129행)에도 명시되어 올바르다. 문제는 **같은 함수가 `handleAcknowledge`에서 `await` + `catch`로 재사용되면서, "실패하면 reject한다"는 정반대의 계약을 요구받는다**는 점이다.

결과: `settings:set-login-mode` IPC 쓰기가 실제로 실패해도(디스크 쓰기 오류, `renameSync` 실패 등 — `settings-store.ts`가 명시적으로 재던지는 케이스), `await onSetLoginMode("api")`는 정상적으로 resolve되고, `setNoticeOpen(false)`가 실행되어 **모달이 "확인 완료"로 닫힌다.** 사용자는 API 모드가 적용됐다고 믿지만 실제로는 `loginMode` 상태가 바뀌지 않았고(App.tsx 상단의 일반 `.error-message` 슬롯에만 조용히 오류가 표시된다), `noticeAck.ackedVersion`은 이미 영속되어 있어 다음에 다시 API 탭을 눌러도 고지 모달이 재노출되지 않는다.

이는 06-CONTEXT.md D-09("최초 1회 차단형 모달... 확인해야만 진행")와 06-06-SUMMARY.md의 coverage D5("고지 확인 저장이 실패하면 모달이 닫히지 않고 모드도 바뀌지 않으며")가 실제로는 **`settings:ack-notice` 실패 케이스에서만** 성립하고, **`settings:set-login-mode` 실패 케이스에서는 성립하지 않음**을 뜻한다. 이 phase가 반복적으로 표방한 "UI가 거짓말하지 않게 한다" 원칙(06-CONTEXT.md `<specifics>`)에 정면으로 위배되는 지점이다. `App.tsx`/`LoginPanel.tsx` 모두 렌더러 컴포넌트라 자동 테스트 커버리지가 없고(순수 함수 `login-panel-view.ts`만 21개 테스트로 커버됨), 이 결함은 어떤 자동 테스트로도 잡히지 않는다.

**Fix:** `handleAcknowledge` 전용으로 실패 시 reject하는 별도 헬퍼를 두거나(예: `App.tsx`에 `setLoginModeOrThrow` 추가), `handleAcknowledge`가 `onSetLoginMode` 호출 후 반환값/상태를 직접 검증하도록 바꾼다.

```ts
// App.tsx — 모달 전용 경로는 실패를 삼키지 않는다
const setLoginModeOrThrow = async (mode: LoginMode) => {
  await window.api.settings.setLoginMode(mode);
  setLoginModeState(mode);
  setLoginError(null);
};

// 기존 handleSetLoginMode(탭 클릭용)는 setLoginModeOrThrow를 감싸 그대로 유지
const handleSetLoginMode = async (mode: LoginMode) => {
  try {
    await setLoginModeOrThrow(mode);
  } catch (err) {
    console.error("로그인 방식 설정 저장 실패:", err);
    setLoginError("설정 저장에 실패했습니다. 다시 시도해주세요.");
  }
};

// LoginPanel에는 onSetLoginMode(탭용, 항상 resolve) 와
// onSetLoginModeStrict(모달 확인용, 실패 시 reject) 두 prop을 분리해 전달한다.
```

---

### CR-02: `validateToken()` 실패 경로가 서버 응답 본문(최대 200자)을 마스킹 없이 렌더러로 직접 전달한다

**File:** `src/main/services/auth-service.ts:955-960, 964-967, 974-978, 983-988`

**Issue:**

06-CONTEXT.md D-12/D-14와 06-05-SUMMARY.md는 "렌더러로 반환되는 모든 실패 message/identifier가 `maskSensitive()`를 통과한다"(coverage D2)고 명시하고, 그 근거로 `buildFailureResult()`를 R010 마스킹의 "유일한 관문"으로 만들었다고 기록했다. 06-05-SUMMARY.md는 나아가 "두 모드가 공유하는 경로(사다리 실패, **토큰 검증 실패 — `validateToken()`의 `login-failed` emit**)는 이미 같은 `mapLoginFailure()`/emit 경로를 타므로 자동으로 혜택을 받는다"고 명시적으로 주장한다.

그러나 실제 `validateToken()` 코드는 `buildFailureResult()`/`mapLoginFailure()`를 전혀 호출하지 않는다. 대신 서버 응답 원문(`rawBody`)을 직접 잘라 `_emit()`으로 내보낸다:

```ts
// 401 응답, 세션 복원도 실패한 경우
this._emit({
  type: "token-expired",
  message: `401 응답 — ${rawBody.slice(0, 200)}`,
  timestamp: Date.now(),
});

// !res.ok
const msg = `GET /fans/me ${res.status}: ${res.statusText} — ${rawBody.slice(0, 200)}`;
this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });

// JSON 파싱 실패
this._emit({
  type: "login-failed",
  message: `GET /fans/me 응답 JSON 파싱 실패: ${rawBody.slice(0, 200)}`,
  timestamp: Date.now(),
});

// fanId 없음
this._emit({
  type: "login-failed",
  message: `GET /fans/me 응답에 fanId 없음: ${rawBody.slice(0, 200)}`,
  timestamp: Date.now(),
});
```

`_emit()`은 `logService`를 거치지 않고(그쪽만 자동 `maskSensitive()`가 적용된다) `auth-event` → `ipc-handlers.ts`의 `forwardAuthEvent` → `mainWindowRef.webContents.send("auth:event", ...)` 로 **렌더러에 직접 전달**되며, `App.tsx`의 `onAuthEvent` 리스너가 이 `message`를 그대로 `loginError` state에 넣어 화면에 렌더링한다. 즉 서버가 돌려준 원문 200자가 마스킹 없이 그대로 사용자 화면에 노출된다.

이 코드 자체는 phase 06 이전부터 있던 경로이며 06-05가 직접 수정하지 않았다는 점은 확인했다(`git log -S`로 06-05 이전부터 존재). 하지만: ① 이 phase의 대표 산출물인 `buildFailureResult()`가 "모든 실패 반환 경로의 유일한 마스킹 관문"이라는 전제를 세우면서, 실제로는 그 전제가 성립하지 않는 경로를 그대로 남겨뒀고, ② 06-05-SUMMARY.md가 이 경로를 "자동으로 커버된다"고 명시적으로(그리고 틀리게) 기록했다 — 이는 검증되지 않은 채 통과 처리된 완전성 주장이다. `validateToken()`은 두 로그인 모드 모두가 공유하는 경로이므로 영향 범위도 좁지 않다.

**Fix:** `validateToken()`의 네 개 emit 지점에서 `rawBody` 원문 대신, `maskSensitive(rawBody.slice(0, 200))`을 적용하거나(최소 조치), 가능하면 D-12 매핑 테이블처럼 상태 코드 기반의 고정 안내 문구로 대체한다.

```ts
this._emit({
  type: "token-expired",
  message: `401 응답 — ${maskSensitive(rawBody.slice(0, 200))}`,
  timestamp: Date.now(),
});
```

동시에 06-05-SUMMARY.md의 "자동으로 혜택을 받는다" 서술을 이 사실에 맞게 정정할 것 — 다음 phase가 이 잘못된 완료 선언을 근거로 재검증을 건너뛸 위험이 있다.

## Warnings

### WR-01: `<dialog>` Escape 취소가 진행 중인 확인 저장을 가로막지 못하는 경합

**File:** `src/renderer/components/LoginPanel.tsx:95-112`, `src/renderer/components/ApiModeNoticeModal.tsx:76-86`

**Issue:** "확인했습니다" 버튼 클릭으로 `handleAcknowledge()`가 실행되는 동안(`noticeSaving === true`), 취소 버튼은 `disabled={saving}`으로 막혀 있지만 **Escape 키는 막혀 있지 않다.** `ApiModeNoticeModal`의 `onCancel` 핸들러는 `<dialog>`의 네이티브 `cancel` 이벤트(Escape)로도 그대로 호출되고, `handleCancelNotice()`는 `noticeSaving` 상태를 확인하지 않은 채 즉시 `setNoticeOpen(false)`를 실행해 모달을 시각적으로 닫는다. 그 사이 이미 진행 중이던 `handleAcknowledge()`의 `await onSetLoginMode("api")`가 나중에 성공하면, 사용자가 방금 "취소"한 것처럼 보였음에도 로그인 방식이 조용히 `api`로 바뀐다. 06-06-SUMMARY.md는 "확인과 취소/Esc는 완전히 분리된 경로"라고 설계 의도를 밝혔지만, 저장이 진행 중인 구간에서의 상호 배제(mutual exclusion)는 구현되지 않았다.

**Fix:** `handleCancelNotice`에 저장 진행 중 가드를 추가한다.

```ts
const handleCancelNotice = () => {
  if (noticeSaving) return; // 확인 저장이 진행 중이면 취소를 무시한다
  setNoticeOpen(false);
  setNoticeSaveError(null);
};
```

### WR-02: `maskSensitive()`는 `key: value` 패턴 매칭이라 문맥 없는 원문 토큰은 통과한다

**File:** `src/shared/mask.ts:38-66`, `src/main/services/auth-service.ts:478-507`

**Issue:** `buildFailureResult()`가 렌더러로 나가는 `message`/`identifier`에 `maskSensitive()`를 명시적으로 적용하는 것은 올바르다. 그러나 `maskSensitive()`의 마스킹 규칙(`SENSITIVE_PATTERNS`)은 전부 `accessToken=`/`accessToken:` 같은 **키 이름이 값 바로 앞에 붙어 있는 경우만** 매칭한다. `token-ladder-failed`/`network-error` 사유의 `identifier`는 `ApiAuthError.message`(Weverse 계정 API가 JSON `message` 필드로 내려주는 임의 문자열, `api-auth-client.ts:123-126`)나 JS 런타임 예외의 `.message`를 그대로 담는데, 이 문자열이 "accessToken=" 같은 인식 가능한 접두사 없이 토큰 형태 문자열을 포함하면(예: 서버가 "이미 사용된 토큰: eyJhbGci...를 재사용할 수 없습니다"처럼 응답하는 경우) `maskSensitive()`는 이를 마스킹하지 못하고 그대로 UI 식별자 칩에 노출한다. `auth-service.test.ts`의 R010 회귀 테스트 2건도 정확히 `accessToken=${tokenLike}` 형태만 검증하고 있어(582-606행), 이 gap을 잡아내지 못한다.

**Fix:** 최소한 JWT 구조(`[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`)에 대한 문맥 무관 마스킹 규칙을 `SENSITIVE_PATTERNS`에 추가하거나, `identifier`에 실릴 수 있는 값의 출처(서버 임의 문자열)를 화이트리스트가 아닌 블랙리스트 방식으로 신뢰하지 않도록 재검토할 것.

### WR-03: "로그인 버튼이 활성화되지 않았습니다" 실패가 `buildFailureResult()`/6개 확정 문구 체계를 완전히 우회한다

**File:** `src/main/services/auth-service.ts:312-332`

**Issue:** `credentialLogin()`의 `btnEnabled` 체크 실패 분기는 `classifyCredentialLoginSignal()`/`mapLoginFailure()`/`buildFailureResult()`를 거치지 않고 `{ success: false, message: "로그인 버튼이 활성화되지 않았습니다. 이메일/비밀번호를 확인해주세요." }`를 직접 반환한다. `reason` 필드도 설정되지 않는다. 이는 06-02-SUMMARY.md/06-05-SUMMARY.md가 반복해서 명시한 "6개 `LoginFailureReason` 전부가 확정 문구로 매핑되고"(D1 계열 커버리지)라는 완전성 주장과 어긋나는, 실제로 도달 가능한 **7번째, 미분류 실패 경로**다. 현재는 이 문구 자체에 민감정보가 없어 즉각적인 유출 위험은 없지만, 향후 이 메시지에 디버그 정보(예: 입력값 길이, DOM 상태)가 추가되면 마스킹 관문을 우회한 채로 렌더러에 도달하는 새로운 진입점이 된다. `_emit({type:"login-failed", ...})` 이벤트도 이 분기에서는 발생하지 않아, `App.tsx`의 `onAuthEvent` 기반 배너와 `LoginPanel`의 인라인 오류가 서로 다른 정보를 가질 수 있다.

**Fix:** 이 분기도 `classifyCredentialLoginSignal`에 새 신호(예: `"button-disabled"`)를 추가하거나 최소한 `overrideReason: "unknown"`으로 `buildFailureResult()`를 거치도록 통일한다.

### WR-04: `settings:set-login-mode` IPC 핸들러가 `mode` 값을 런타임에 검증하지 않는다

**File:** `src/main/ipc-handlers.ts:118-120`, `src/main/services/settings-store.ts:102-106`

**Issue:** `ipcMain.handle("settings:set-login-mode", async (_evt, mode: LoginMode) => { settingsStore.setLoginMode(mode); })`은 `mode`를 `LoginMode`("api" | "browser")로 캐스팅만 할 뿐 런타임 검증이 없다. `SettingsStore.setLoginMode()`도 값을 정규화하지 않고 그대로 `writeSettings()`에 넘긴다. `readSettings()`는 다음 읽기 시점에 `parsed.loginMode === "api" ? "api" : DEFAULT_LOGIN_MODE`로 정규화하므로 디스크 파일이 영구히 오염되지는 않지만, **쓰기 자체는 "성공"으로 보고되고 임의 문자열이 파일에 그대로 저장된다.** 현재 정상적인 렌더러 코드 경로에서는 TypeScript 유니온 타입 덕분에 `"api"`/`"browser"` 외의 값이 전달될 일이 없지만, `contextIsolation`이 켜져 있어도 `window.api.settings.setLoginMode(...)`는 런타임에는 평범한 함수 호출이라 타입 검사를 우회할 수 있는 어떤 코드(향후 리팩터링 실수, 다른 진입점 추가 등)에도 방어벽이 없다.

**Fix:** IPC 핸들러 또는 `setLoginMode()` 진입점에서 명시적으로 검증한다.

```ts
ipcMain.handle("settings:set-login-mode", async (_evt, mode: LoginMode) => {
  if (mode !== "api" && mode !== "browser") {
    throw new Error(`invalid login mode: ${String(mode)}`);
  }
  settingsStore.setLoginMode(mode);
});
```

## Info

### IN-01: `readSettings()`의 오류 로그가 실제 원인과 무관하게 항상 "파싱 실패"로 기록된다

**File:** `src/main/services/settings-store.ts:64-67`
**Issue:** `try { JSON.parse(...) } catch (err) { logService.warn(..., "settings.json 파싱 실패 — 기본값(browser) 폴백: ...") }` — 이 catch 블록은 `fs.readFileSync()`의 실패(권한 오류, I/O 오류 등)도 함께 잡는데, 로그 메시지는 무조건 "파싱 실패"라고 단정한다. `String(err)`가 뒤에 붙어 실제 원인 추적은 가능하지만, 메시지 자체가 오도할 수 있다.
**Fix:** 메시지를 "설정 읽기 실패"처럼 원인 중립적인 문구로 바꾸거나, `fs.readFileSync`와 `JSON.parse`를 분리해 각각 다른 메시지를 남긴다.

### IN-02: 헤드리스 로그인 디버그 덤프가 이메일 평문을 로그에 남긴다 (phase 06 이전부터 존재, 미수정)

**File:** `src/main/services/auth-service.ts:314-329`
**Issue:** `btnEnabled` 실패 시 덤프하는 `debugInfo.emailValue`는 사용자가 입력한 이메일 원문이며, `mask.ts`의 `SENSITIVE_PATTERNS`에는 이메일 전용 규칙이 없어 `logService`의 자동 마스킹을 통과해 로그 파일에 그대로 남는다. 이 코드는 phase 06 이전(`3c00bf5`)부터 존재해 이번 phase가 도입한 결함은 아니지만, 이번 phase가 바로 이 DOM 폴링 영역(캡차 오분류 수정)을 손댔음에도 이 인접 지점은 그대로 남았다. 이 phase의 "credential/token 마스킹 게이트" 목표와 직접 관련이 있어 함께 기록한다.
**Fix:** `mask.ts`에 `email` 필드 마스킹 규칙 추가를 검토하거나, 이 디버그 덤프에서 `emailValue`를 `emailLen`(길이)으로 대체한다(이미 293행에서 `inputState.emailLen`으로 이 패턴을 쓰고 있다).

### IN-03: `App.tsx`의 설정 저장 실패 로그가 `console.error`로 나가 앱 자체 로그 패널에 남지 않는다

**File:** `src/renderer/App.tsx:136`
**Issue:** `handleSetLoginMode`의 catch 블록이 `console.error(...)`를 사용한다 — 이는 devtools 콘솔에만 남고, 앱 내 `LogPanel`(main 프로세스의 `logService` 기반)에는 나타나지 않아 사용자가 로그 다운로드로 문제를 재현할 때 이 정보가 빠진다. 다른 렌더러 오류 처리와의 일관성도 없다.
**Fix:** 렌더러 전용 오류를 main으로 전달할 IPC가 없다면 최소한 주석으로 devtools 전용임을 명시하거나, 향후 phase에서 renderer→main 오류 포워딩 채널을 고려한다.

### IN-04: `dialog.notice-modal`에 명시적 `max-height`가 없어 매우 짧은 뷰포트에서의 동작이 브라우저 UA 기본값에 의존한다

**File:** `src/renderer/styles.css:385-393`
**Issue:** `.notice-modal-body`는 `max-height: 50vh; overflow-y: auto`로 스스로 스크롤하지만, `dialog.notice-modal` 자체에는 `max-height`가 없다. 대부분의 Chromium 환경에서는 UA 기본 스타일(`max-height: calc(100% - 6px - 2em)` 등)이 적용돼 실사용에 문제가 없을 가능성이 높지만, 06-06-SUMMARY.md 자신도 이 항목을 `human_judgment: true`(Electron 런타임 미확인)로 남겼다 — 이 리뷰도 실제 렌더링을 확인할 수 없어 결정적 결함으로 단정하지 않고 참고용으로만 남긴다.
**Fix:** 실제 Electron 창에서 매우 짧은 높이로 UAT할 때 이 지점을 함께 확인할 것. 필요하면 `dialog.notice-modal { max-height: 90vh; }`를 명시적으로 추가해 UA 기본값 의존을 없앤다.

---

_Reviewed: 2026-08-26T06:09:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
