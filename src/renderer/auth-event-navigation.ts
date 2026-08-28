/**
 * `App.tsx`의 인증 이벤트 → 화면 전이 판단만 담는 순수 모듈 — JSX 없음, DOM 없음.
 *
 * `App.tsx`의 기존 `onAuthEvent` 핸들러(`login-success`/`token-validated`/
 * `login-failed`/`token-expired`/`cookie-extraction-failed`/`logged-out`)는
 * "인증 이벤트가 발생하면 로그인 화면으로 되돌아간다"는 전제로 Phase 05/06에서
 * 작성됐다. 신청 대기(`apply-execution`) 중 재로그인이라는 이 phase가 처음 만드는
 * 상황에서는 그 전제가 armed 상태와 `formSchema`를 파괴한다
 * (07-RESEARCH.md Pitfall 3) — 사용자가 경고를 보고 재로그인하는 순간 신청 준비가
 * 통째로 사라지면, 선착순 이벤트에서는 경고 자체가 함정이 된다.
 *
 * 판단을 컴포넌트 밖 순수 함수로 고정해 (이벤트 종류 × 현재 단계)의 조합이 전부
 * 테스트로 덮이게 한다 — `login-panel-view.ts`/`login-mode-actions.ts`가 세운
 * "판단은 순수 함수, 부수효과는 호출부" 관례를 그대로 잇는다.
 */
import type { AuthEvent } from "../shared/types";

/** `App.tsx`에서 이관됨 — 이 모듈이 정본(source of truth)이고 `App.tsx`는 여기서 import한다. */
export type AppStep = "login" | "profile" | "event-setup" | "apply-form" | "apply-execution";

export type AuthEventNavigationDecision =
  | { action: "stay" }
  | { action: "to-profile" }
  | { action: "to-login" }
  | { action: "to-login-and-clear-schema" };

/**
 * 신청 대기(`apply-execution`) 중에는 사용자가 명시적으로 로그아웃 버튼을 누른
 * `logged-out` 이벤트에만 로그인 화면으로 되돌아간다 — 그 밖의 모든 인증 이벤트
 * (재로그인 성공/실패, 토큰 만료, 쿠키 추출 실패 포함)는 armed 상태와
 * `formSchema`를 지키기 위해 `"stay"`로 판정한다. 명시적 행위(로그아웃)와 사고
 * (재로그인 실패, 만료)를 구분하는 것이 이 함수의 핵심이다.
 *
 * `apply-execution`이 아닌 단계에서는 기존 `App.tsx` 동작을 그대로 재현한다.
 */
export function decideAuthEventNavigation(
  eventType: AuthEvent["type"],
  step: AppStep,
): AuthEventNavigationDecision {
  if (step === "apply-execution") {
    if (eventType === "logged-out") {
      return { action: "to-login-and-clear-schema" };
    }
    return { action: "stay" };
  }

  switch (eventType) {
    case "login-success":
    case "token-validated":
      return { action: "to-profile" };
    case "login-failed":
    case "token-expired":
    case "cookie-extraction-failed":
      return { action: "to-login" };
    case "logged-out":
      return { action: "to-login-and-clear-schema" };
    case "credential-login-progress":
      return { action: "stay" };
  }
}

/**
 * 재로그인이 실제로 끝났는지를 인증 이벤트로부터 판정한다(CR-01, D-10, R022).
 *
 * `AuthService.login()`은 팝업의 초기 페이지 로드만 `await`하고 반환하므로
 * "재로그인 요청이 반환됐다"는 사실은 "재로그인이 끝났다"와 다른 사건이다.
 * `App.tsx`의 `handleReloginFromWaiting()` `finally` 블록에서 곧바로
 * `checkTokenExpiry()`를 부르면 옛 토큰으로 판정하게 되는 이유가 이것이다 —
 * 실제 완료를 알려주는 유일한 신호는 그 뒤에 도착하는 인증 이벤트다.
 * `login-success`는 브라우저 모드(`pollForToken()`)와 API 모드
 * (`extractTokenFromCookies()`) 양쪽 모두에서 `cachedToken`을 채운 **직후**
 * emit되므로, 이 이벤트를 받은 시점의 `authService.token`은 이미 새 토큰이다.
 *
 * `apply-execution` 단계가 아니면 재판정할 배너 자체가 없으므로 모든 이벤트에서
 * `false`다. `apply-execution` 단계에서는 `logged-out`(명시적 로그아웃 —
 * `decideAuthEventNavigation()`이 화면을 되돌리고 스키마를 비우는 유일한
 * 이벤트, 배너 자체가 사라진다)과 `credential-login-progress`(진행 중 신호,
 * 토큰이 아직 바뀌지 않았다)만 `false`이고 나머지 5개 이벤트는 전부 `true`다 —
 * 실패·만료·쿠키 추출 실패도 정직하게 재판정해야 배너가 거짓말하지 않는다.
 *
 * `AuthEvent["type"]` 전체를 덮는 exhaustive switch로 구현하고 default 분기를
 * 두지 않는다 — 새 인증 이벤트가 추가되면 컴파일 에러로 판단 누락이 드러난다.
 */
export function shouldRecheckTokenExpiry(eventType: AuthEvent["type"], step: AppStep): boolean {
  if (step !== "apply-execution") {
    return false;
  }

  switch (eventType) {
    case "login-success":
    case "token-validated":
    case "login-failed":
    case "token-expired":
    case "cookie-extraction-failed":
      return true;
    case "credential-login-progress":
    case "logged-out":
      return false;
  }
}
