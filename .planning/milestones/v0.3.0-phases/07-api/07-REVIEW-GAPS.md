---
phase: 07-api
reviewed: 2026-08-28T08:53:49Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/renderer/auth-event-navigation.ts
  - src/renderer/App.tsx
  - src/renderer/components/ApplyExecution.tsx
  - src/main/services/auth-service.ts
  - src/renderer/components/LoginPanel.tsx
  - src/__tests__/relogin-expiry-recheck.test.ts
  - src/renderer/__tests__/auth-event-navigation.test.ts
  - src/main/services/__tests__/auth-service.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 07: Gap-Closure Code Review (07-06 / 07-07)

**Reviewed:** 2026-08-28T08:53:49Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** clean

## Summary

리뷰 대상은 `d748a39..HEAD` 범위의 11개 커밋(플랜 07-06, 07-07)이며, 07-VERIFICATION.md 가 지목한 4개 결함(CR-01, WR-01, WR-02, WR-03)의 종결 여부만 판단했다. 결론부터 말하면 **네 결함 모두 실제로 닫혔고**, 이 diff 가 새로 만들어낸 회귀나 결함은 발견하지 못했다. `npm test`(22 스위트/474 테스트), `npm run typecheck`, `npm run typecheck:main` 모두 이 diff 를 포함한 상태에서 재실행해 green 을 직접 확인했다.

**CR-01 (blocker) — 닫힘.** `shouldRecheckTokenExpiry(eventType, step)` 는 `AuthEvent["type"]` 7종을 전부 덮는 exhaustive switch 이고 `default` 분기가 없다. `boolean` 반환 타입 + `strict: true` 조합에서 새 이벤트 타입 추가 시 실제로 컴파일 에러가 나는지 별도 스크래치 파일로 재현해 확인했다(비exhaustive 버전은 `TS2366`로 실패, exhaustive 버전은 통과). `App.tsx`의 호출부는 `shouldRecheckTokenExpiry(event.type, stepRef.current)`를 쓴다 — `stepRef`는 07-05 때 이미 만들어진 패턴(`useEffect(() => { stepRef.current = step }, [step])`)이고, `git diff`로 확인한 결과 이번 07-06/07-07 diff 는 `stepRef` 자체를 건드리지 않고 기존 최신값 추적 패턴을 그대로 재사용했다 — 우려했던 "마운트 시점 클로저가 `step`을 `"login"`에 고정시키는" 함정을 피했다. `checkTokenExpiry()` 호출은 `setStep`/`setFormSchema` 를 전혀 건드리지 않는 별도 분기라 armed 상태·`formSchema`가 보존된다(Pitfall 3).

**WR-01 — 닫힘.** `ApplyExecution.tsx`의 "다시 로그인" 버튼에 `disabled={reloginLoading}`/`aria-busy={reloginLoading}`가 붙었고, `App.tsx`는 별도 state 를 만들지 않고 기존 `loginLoading`을 그대로 흘려보낸다(`handleReloginFromWaiting()`이 시작/종료 시점에 이미 set/clear). `handleReloginFromWaiting()`의 API 모드 `"available"` 분기도 `credentialLoginStored()`의 반환값을 더 이상 버리지 않고 `buildFailureView()`로 판정해 `setLoginError`한다. 잠금 해제는 `finally` 블록 안에 있어 성공/실패/예외 모든 경로에서 반드시 풀린다 — 사용자를 가둘 수 있는 경로를 찾지 못했다.

**WR-02 — 닫힘.** `completeCredentialLoginSuccess(email, password)`가 `credentialLogin()`의 두 성공 분기(`result === "token"` 직접 성공, `result === "timeout"` 후 쿠키 발견) 모두에서 호출되도록 단일 관문화됐다. `git diff`로 이전 코드를 확인한 결과 timeout→쿠키 경로는 실제로 `saveCredentials()`를 호출하지 않고 있었다는 것과, 지금은 두 경로 모두 이 관문을 통과해야만 `{ success: true }`를 만들 수 있는 구조라는 것을 확인했다. `runAccountTokenLadderSpike()`는 의도한 대로 `result === "token"` 분기에만 남아 있고, `completeCredentialLoginSuccess()` 안으로 들어가지 않았다 — timeout→쿠키 경로가 새 외부 네트워크 호출을 얻지 않는다는 계획의 전제가 실제 코드와 일치한다. `auth-service.test.ts`의 신규 회귀 스위트가 `getStoredCredentialsSnapshot()` 전이, 반환값에 `password` 필드 부재, `safeStorage` 비활성 환경에서의 안전한 동작, 로그에 비밀번호/전체 이메일이 없는지까지 커버한다.

**WR-03 — 닫힘.** `LoginPanel.tsx`의 `handleCredentialLogin()` `finally`에 `refreshStoredSnapshot()`이 추가돼 `handleStoredLogin()`과 정확히 같은 비대칭 프리필 가드(이메일이 빈 문자열일 때만 채움)를 공유한다. 사용자가 `corrupted` 안내를 보고 직접 로그인에 성공하면 `completeCredentialLoginSuccess()`가 새 `credentials.enc`를 쓰고, 이 재조회가 스냅샷을 `available`로 갱신해 해소된 안내가 화면에 남지 않는다.

민감정보 취급(D-01/T-07-26)도 함께 확인했다 — `completeCredentialLoginSuccess()`는 자체 로그를 남기지 않고, `saveCredentials()`의 유일한 로그 라인은 `maskEmail()`을 거친다. 반환값(`CredentialLoginResult`)에는 `password` 필드 자체가 타입에 없다. 이 관문이 새로 만든 로그·반환값·이벤트 페이로드 어디에도 평문 비밀번호가 닿는 경로를 찾지 못했다.

IPC 4점 대칭 관점에서는 이번 diff 가 `preload`/`ipc-handlers`/타입 정의 파일을 전혀 건드리지 않았음을 `git diff --stat`으로 확인했다 — 새 채널 없음.

아래는 기능적 결함이 아닌, 유지보수성 관점의 사소한 문서 부정확성 1건뿐이다.

## Info

### IN-01: `completeCredentialLoginSuccess()` 문서 주석이 실제 마스킹 구현과 다르게 설명됨

**File:** `src/main/services/auth-service.ts:670-671`
**Issue:** `completeCredentialLoginSuccess()`의 JSDoc은 "저장 관련 로그는 `saveCredentials()` 안의 기존 `email.slice(0, 3)***` 마스킹 형태 하나뿐이다"라고 설명하지만, `saveCredentials()`(114-118행)가 실제로 남기는 로그는 `maskEmail(email)`을 통과한 값이다(`shared/mask.ts:44-54`). `maskEmail()`은 로컬 파트 첫 글자 + 나머지 길이만큼의 `*` + `@도메인` 형태(예: `abc@x.com` → `a**@x.com`)로, 주석이 묘사하는 "이메일 앞 3글자 + `***`" 형태(예: `abc***`, 도메인 노출 여부가 다름)와 마스킹 규칙 자체가 다르다. 실제 동작(구조 기반 `maskEmail`)이 주석이 묘사하는 것보다 안전하므로 보안 결함은 아니지만, 이 주석만 읽고 마스킹 형태를 판단하는 향후 유지보수자에게는 오해의 소지가 있다.
**Fix:** 주석을 실제 구현에 맞게 정정한다.
```diff
-   * 이 관문은 자체 로그를 남기지 않는다 — 저장 관련 로그는 `saveCredentials()`
-   * 안의 기존 `email.slice(0, 3)***` 마스킹 형태 하나뿐이다(T-07-26).
+   * 이 관문은 자체 로그를 남기지 않는다 — 저장 관련 로그는 `saveCredentials()`
+   * 안의 기존 `maskEmail()` 마스킹 형태(로컬 첫 글자 + `*` 반복 + `@도메인`)
+   * 하나뿐이다(T-07-26).
```

---

_Reviewed: 2026-08-28T08:53:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
