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
