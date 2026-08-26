/**
 * 로그인 실패 사유를 한국어 안내 문구로 변환하는 순수 모듈.
 *
 * - 데스크탑 런타임 의존성이 없다 — main 프로세스(auth-service.ts)와
 *   renderer(LoginPanel.tsx) 양쪽에서 그대로 재사용하기 위해서다.
 * - "captcha" 사유는 과거에 "OTP 필요"로 잘못 분류되던 신호다(D-13). 이 모듈은 그
 *   오분류를 재도입하지 않는다 — 2026-08-25 HAR 실측상 이메일 인증코드 발송 흐름은
 *   실제 로그인 경로에 존재하지 않는다.
 * - identifier / logDetail 은 이 모듈이 직접 가공(마스킹)하지 않는다. 렌더러로
 *   반환되는 이 필드들은 로그 서비스의 자동 마스킹 경로를 타지 않으므로, 호출부
 *   (auth-service.ts)가 마스킹 헬퍼로 감싸서 넘기는 것이 계약이다(R010, T-06-06).
 */

/** `credentialLogin()`이 실제로 마주치는 실패 신호 — 정확히 6개, 임의로 이름을 바꾸지 말 것. */
export type LoginFailureReason =
  | "captcha"
  | "form-error"
  | "timeout"
  | "network-error"
  | "token-ladder-failed"
  | "unknown";

export interface LoginFailureGuidance {
  /** 화면(.error-message, role="alert")에 그대로 표시할 한국어 문장 */
  message: string;
  /** "브라우저 로그인으로 전환" 버튼을 노출할지 여부 */
  suggestBrowserSwitch: boolean;
  /** 식별자 칩(`(식별자: ...)`)에 표시할 값 — network-error/token-ladder-failed/unknown 에서만 존재 */
  identifier?: string;
  /** 잘리지 않은 원문 — 로그 패널 경로용. form-error 에서 값이 있을 때만 존재 */
  logDetail?: string;
}

/** form-error 화면 표시 상한 — 이 영역의 유일한 길이 계약(UI-SPEC E5 long-text) */
export const FORM_ERROR_MAX_LENGTH = 120;

/**
 * Weverse 폼이 표시한 오류 텍스트를 화면 표시용으로 전처리한다: trim 후 상한 초과 시
 * 말줄임표 한 글자를 붙여 자른다. 빈 문자열/공백만 있는 입력은 빈 문자열을 반환한다
 * (호출부가 폴백 문장을 쓰도록).
 */
export function truncateFormError(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= FORM_ERROR_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, FORM_ERROR_MAX_LENGTH - 1)}…`;
}

/**
 * 실패 사유를 `06-UI-SPEC.md` § Copywriting Contract 의 확정 한국어 안내로 매핑한다.
 * union 에 새 값이 추가되면 이 exhaustive switch 가 컴파일 타임에 누락을 잡는다 —
 * default 로 뭉개지 않는다.
 */
export function mapLoginFailure(reason: LoginFailureReason, detail?: string): LoginFailureGuidance {
  switch (reason) {
    case "captcha":
      return {
        message:
          "Weverse가 보안 확인을 요구해 앱 안 로그인으로는 진행할 수 없습니다. 브라우저 로그인을 사용해주세요.",
        suggestBrowserSwitch: true,
      };

    case "timeout":
      return {
        message: "로그인 응답 대기 시간을 초과했습니다. 다시 시도하거나 브라우저 로그인을 사용해주세요.",
        suggestBrowserSwitch: true,
      };

    case "form-error": {
      const truncated = detail !== undefined ? truncateFormError(detail) : "";
      if (truncated.length === 0) {
        // 빈 화면이 되지 않도록 일반 실패 문장으로 폴백한다(D-14 취지 준용).
        return { message: "로그인 실패", suggestBrowserSwitch: false };
      }
      return {
        message: truncated,
        suggestBrowserSwitch: false,
        logDetail: detail!.trim(),
      };
    }

    case "network-error":
      return {
        message: "네트워크 오류로 로그인에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.",
        suggestBrowserSwitch: false,
        identifier: detail,
      };

    case "token-ladder-failed":
      return {
        message: "로그인은 성공했지만 서비스 이용에 필요한 토큰을 확보하지 못했습니다. 다시 로그인해주세요.",
        suggestBrowserSwitch: false,
        identifier: detail,
      };

    case "unknown":
      return {
        message: "로그인에 실패했습니다. 로그 패널에서 자세한 내용을 확인하세요.",
        suggestBrowserSwitch: false,
        identifier: detail,
      };
  }
}
