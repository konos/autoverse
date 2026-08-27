/**
 * `ApplyExecution`의 만료 경고 배너 판단 로직만 담는 순수 모듈 — JSX 없음, DOM 없음.
 *
 * `login-panel-view.ts`가 세운 "판단은 순수 함수, 컴포넌트는 분기만" 관례를
 * 그대로 따른다. `TokenExpiryState`(safe/warning/unknown)를 화면에 필요한
 * 필드(visible/tone/message/showRelogin/expAt)로 변환한다.
 */
import type { TokenExpiryState } from "../../shared/token-expiry";

export interface TokenExpiryNotice {
  visible: boolean;
  tone: "warning" | "info";
  message: string;
  showRelogin: boolean;
  /** warning 상태에서만 존재한다 — safe/unknown 에서는 키 자체가 없다. */
  expAt?: number;
}

const WARNING_MESSAGE = "대기 중 토큰이 만료될 수 있습니다 — 신청 전에 다시 로그인해주세요.";
const UNKNOWN_MESSAGE = "토큰 만료 시각을 확인할 수 없습니다 — 신청 직전에 로그인 상태를 확인해주세요.";

/**
 * 만료 판정 상태를 배너 표시 계약으로 변환한다. 어떤 상태에서도 신청 실행을
 * 막으라는 신호(`blocking` 류 필드)를 반환하지 않는다(D-12) — 이 함수의
 * 반환 타입 자체에 그런 필드가 없다.
 *
 * `expAt`이 없는 상태에서는 반환 객체에 `expAt` 키를 아예 만들지 않는다
 * (렌더러가 `undefined`를 계산에 넣는 사고를 구조적으로 차단 —
 * `buildFailureView()`의 `identifier` 처리와 같은 관례).
 */
export function describeTokenExpiryNotice(state: TokenExpiryState): TokenExpiryNotice {
  switch (state.status) {
    case "safe":
      return { visible: false, tone: "info", message: "", showRelogin: false };

    case "warning":
      return {
        visible: true,
        tone: "warning",
        message: WARNING_MESSAGE,
        showRelogin: true,
        expAt: state.expAt,
      };

    case "unknown":
      return {
        visible: true,
        tone: "info",
        message: UNKNOWN_MESSAGE,
        showRelogin: true,
      };
  }
}
