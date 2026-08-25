/**
 * JWT/PII masking utilities — never log full tokens or personal data.
 * Slice constraint: "앞 20자 + ... + 뒤 20자"
 */

export function maskToken(token: string): string {
  if (!token) return "***";
  if (token.length <= 40) return "***";
  return `${token.slice(0, 20)}...${token.slice(-20)}`;
}

/** Mask phone number: show only last 4 digits */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
}

/** Mask birth date: show only year */
export function maskBirthDate(birthDate: string): string {
  if (!birthDate) return "****-**-**";
  return `${birthDate.slice(0, 4)}-**-**`;
}

/** Mask membership number: show only last 4 chars */
export function maskMembershipNumber(num: string): string {
  if (!num || num.length < 4) return "****";
  return `****${num.slice(-4)}`;
}

/** Mask name: show only first char + asterisks */
export function maskName(name: string): string {
  if (!name) return "***";
  if (name.length === 1) return `${name}*`;
  return `${name[0]}${"*".repeat(name.length - 1)}`;
}

// R010 sensitive field patterns (key=value style in serialized objects/logs)
const SENSITIVE_PATTERNS: Array<[RegExp, (match: string, key: string, val: string) => string]> = [
  [/(Authorization:\s*)([^\s,}]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  // password/otpCode (Phase 05 API 로그인 경로) — 2차 방어선. maskToken은 40자
  // 이하 입력을 전부 "***"로 지우므로 실제 비밀번호/6자리 OTP 길이에서 완전 삭제된다.
  [/(password["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  [/(otpCode["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  [/(applyToken["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  // Phase 05 재설계 — account token ladder spike/exchange 경로에서 새로 로그에
  // 등장할 수 있는 토큰 필드 3종. otpSessionId 는 05-01 실측상 세션 식별자가
  // 아니라 reCAPTCHA Enterprise 토큰(2489자)을 담는 자리이므로 자격증명급
  // 비밀로 취급한다. 키 뒤에 곧바로 :/= 가 오는 경우만 매칭되므로
  // `otpSessionIdLen=36`/`hasOtpSessionId=true` 같은 진단 로그는 매칭되지 않는다.
  [/(accessToken["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  [/(refreshToken["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  [/(otpSessionId["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  // T-05-17 (Phase 05 보안 감사) — snake_case URL 쿼리 파라미터 룰.
  // 위 규칙들은 camelCase JSON 키(`accessToken":"…`) 형태만 매칭하므로,
  // OAuth 리다이렉트 URL 이 `?access_token=eyJ…&refresh_token=eyJ…` 형태로
  // 로그에 실릴 때(`auth-service.ts` 의 did-navigate / submitOtp 로그 라인)
  // 토큰이 평문으로 통과했다. 값 종결자에 `&`/`#` 를 포함해야 쿼리 문자열의
  // 다음 파라미터까지 삼키지 않는다. 키 뒤에 곧바로 `=` 가 오는 경우만
  // 매칭되므로 `access_token_len=64` 같은 진단 로그는 훼손되지 않는다.
  [/((?:access_token|refresh_token|service_user_id)=)([^&#\s"',}]+)/g, (_, k, v) => `${k}${maskToken(v)}`],
  [/(phoneNumber["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskPhone(v)}`],
  [/(birthDate["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskBirthDate(v)}`],
  [/(membershipNumber["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskMembershipNumber(v)}`],
  [/(firstName["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskName(v)}`],
  [/(lastName["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskName(v)}`],
];

/** Apply all R010 masking rules to an arbitrary text string */
export function maskSensitive(text: string): string {
  let result = text;
  for (const [pattern, replacer] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacer as Parameters<typeof String.prototype.replace>[1]);
  }
  return result;
}
