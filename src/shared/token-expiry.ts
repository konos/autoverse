/**
 * 토큰 만료를 신청 예정 시각 기준으로 사전 판정하는 순수 모듈(R022, D-08~D-11).
 *
 * - 데스크탑 런타임 의존성이 없다 — main(`apply-engine.ts`)과 renderer 양쪽에서
 *   재사용하기 위해서다(`login-failure.ts` 가 세운 관례를 그대로 따른다).
 * - `parseJwtExpMs()` 는 `auth-service.ts` 의 `isTokenExpired()` 가 쓰는 파싱
 *   절차를 그대로 옮기되 **판정 의미를 바꾼다** — `isTokenExpired()` 는 파싱
 *   실패를 "만료 아님"으로 흡수하지만, 이 함수는 실패를 `null` 로 그대로
 *   흘려보내 `evaluateTokenExpiry()` 의 `unknown` 상태로 이어지게 한다(D-11).
 *   `isTokenExpired()` 자체는 로그인 유지용 폴백이 그대로 필요하므로 건드리지
 *   않는다.
 * - 어떤 함수도 `Date.now()` 를 직접 읽지 않는다 — 판정에 필요한 시각은 전부
 *   인자로 받는다(같은 입력 → 항상 같은 출력, 외부 호출 없음, D-08).
 */

/** 만료 판정의 세 상태 — exhaustive switch 로 소비할 것, default 분기를 두지 않는다. */
export type TokenExpiryState =
  | { status: "safe" }
  | { status: "warning"; expAt: number }
  | { status: "unknown" };

/**
 * 재로그인에 실제로 필요한 시간을 근거로 한 고정 여유시간(ms), D-09.
 *
 * 산출 근거: 헤드리스 로그인 폼 로드 대기 15초(`auth-service.ts` 의 login form
 * timeout) + 로그인 응답 대기 25초(`auth-service.ts` 의 25000ms 타임아웃) =
 * 기계적 대기만 40초. 여기에 캡차 챌린지가 뜨면 브라우저 방식으로 전환해 사람이
 * 직접 푸는 시간이 더 필요하다. 실측 데이터가 없어 보수적으로 3분으로 크게
 * 잡았다 — D-12 가 "경고는 신청을 차단하지 않는다"를 이미 보장하므로 상수가
 * 다소 커서 생기는 비용은 경고가 조금 더 자주 뜨는 것뿐이고, 반대로 작으면
 * 경고 자체가 무의미해진다(비대칭 리스크). 이 숫자는 이 상수에만 존재해야
 * 하며 호출부에 리터럴로 다시 쓰지 않는다. 사용자 설정 UI 는 만들지 않는다(D-09).
 */
export const RELOGIN_HEADROOM_MS = 180_000;

/**
 * JWT `exp` 클레임을 ms epoch 로 파싱한다. 어떤 입력에도 throw 하지 않고,
 * 토큰 원문을 반환값·예외 메시지 어디에도 담지 않는다(R010).
 *
 * `null`/빈 문자열/3분절이 아님/`exp` 가 숫자가 아님/base64 디코드 실패/JSON
 * 파싱 실패 — 전부 `null` 을 반환한다. `isTokenExpired()` 와 달리 실패를
 * "만료 아님"으로 흡수하지 않는다(D-11).
 */
export function parseJwtExpMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * `exp`(ms epoch), 신청 예정 시각(ms epoch), 여유시간(ms) 을 받아 세 상태 중
 * 하나를 반환한다. 부수효과 없음, 시각을 직접 읽지 않음 — 같은 입력에는 항상
 * 같은 출력이 나온다.
 *
 * - `expMs === null` → `unknown` (D-11)
 * - `expMs < plannedSubmitAtMs + headroomMs` → `warning` (엄격 미만 비교 —
 *   경계값(`expMs === plannedSubmitAtMs + headroomMs`)은 `safe`)
 * - 그 외 → `safe`
 */
export function evaluateTokenExpiry(
  expMs: number | null,
  plannedSubmitAtMs: number,
  headroomMs: number,
): TokenExpiryState {
  if (expMs === null) {
    return { status: "unknown" };
  }
  if (expMs < plannedSubmitAtMs + headroomMs) {
    return { status: "warning", expAt: expMs };
  }
  return { status: "safe" };
}
