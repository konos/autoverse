/**
 * 토큰 검증(validateToken()) 실패를 한국어 안내 문구로 변환하는 순수 모듈.
 *
 * 06-VERIFICATION.md gap 2(CR-02) 처치: `validateToken()`의 네 실패 지점이 서버 응답
 * 원문(rawBody)을 마스킹 없이 렌더러로 직접 흘려보내던 결함을 구조적으로 막는다.
 *
 * `maskSensitive()`(src/shared/mask.ts)의 `SENSITIVE_PATTERNS`는 전부 `key: value`
 * 형태의 문맥에 의존한다 — 키 이름이 값 바로 앞에 붙어 있지 않은 문맥 없는 원문 토큰은
 * 통과시킨다(06-REVIEW.md WR-02). 그래서 이 모듈은 "원문을 감싸서 가리는" 방식(A안,
 * 기각됨) 대신 "원문이 애초에 이 함수로 들어올 길을 두지 않는" 방식(B안)을 택했다 —
 * 아래 {@link TokenValidationGuidanceContext}에는 서버 응답 텍스트를 담을 수 있는
 * 필드가 없다. 마스킹 규칙의 완전성에 의존하지 않고 타입 계약으로 막는다.
 *
 * - `login-failure.ts`와 같은 tier·같은 관용구(exhaustive switch)를 쓰지만, 여기 쓰는
 *   {@link TokenValidationFailureKind}는 그쪽 6가지 실패 신호 union과는 **별개의 union**이다
 *   — ROADMAP SC3 정정본과 D-12가 확정한 그 계약을 이 모듈은 참조도 확장도 하지 않는다.
 * - `identifier`는 전부 이 모듈이 스스로 만든 값(HTTP 상태 코드, 고정 문자열)이다 —
 *   서버가 준 문자열이 identifier로 흘러들 수 있는 경로가 없다.
 */

/**
 * `validateToken()`이 실제로 마주치는 실패 지점 — 정확히 4개.
 * `unauthorized`(401 이후 세션 복원까지 실패), `http-error`(2xx 아님),
 * `parse-error`(응답 JSON 파싱 실패), `missing-fan-id`(200이지만 fanId 부재).
 */
export type TokenValidationFailureKind =
  | "unauthorized"
  | "http-error"
  | "parse-error"
  | "missing-fan-id";

/** 서버 응답 텍스트를 담을 필드가 없다 — 이 타입이 곧 구조적 봉인이다. */
export interface TokenValidationGuidanceContext {
  status?: number;
}

export interface TokenValidationGuidance {
  /** 화면에 그대로 표시할 한국어 문장 */
  message: string;
  /** 식별자 칩에 병기할 짧은 값 — 이 모듈이 만든 값만 담긴다(HTTP 상태 코드 등) */
  identifier?: string;
}

/**
 * 토큰 검증 실패 kind를 확정 한국어 안내로 매핑한다. union에 새 값이 추가되면 이
 * exhaustive switch가 컴파일 타임에 누락을 잡는다 — `default`로 뭉개지 않는다.
 *
 * @param kind 실패 지점 종류
 * @param context 부가 정보. `status`가 주어졌을 때만 `http-error`의 identifier에
 *   HTTP 상태 코드가 담긴다 — 값이 없으면 identifier 자체를 만들지 않는다(지어내지 않음).
 */
export function describeTokenValidationFailure(
  kind: TokenValidationFailureKind,
  context?: TokenValidationGuidanceContext
): TokenValidationGuidance {
  switch (kind) {
    case "unauthorized":
      return {
        message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
      };

    case "http-error": {
      const guidance: TokenValidationGuidance = {
        message:
          "서버 요청이 실패했습니다. 잠시 후 다시 시도하거나 로그 패널에서 자세한 내용을 확인하세요.",
      };
      if (context?.status !== undefined) {
        guidance.identifier = `HTTP ${context.status}`;
      }
      return guidance;
    }

    case "parse-error":
      return {
        message: "서버 응답을 이해하지 못했습니다. 로그 패널에서 자세한 내용을 확인하세요.",
        identifier: "응답 형식 오류",
      };

    case "missing-fan-id":
      return {
        message: "계정 정보를 확인하지 못했습니다. 다시 로그인해주세요.",
        identifier: "계정 정보 누락",
      };
  }
}
