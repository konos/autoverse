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
