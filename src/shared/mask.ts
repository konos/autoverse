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

/**
 * Mask email: local-part first char + asterisks, domain preserved (D-07, R010, IN-02).
 * 도메인을 마스킹하지 않는 이유 — D-07 이 요구하는 저장 상태문("이 기기에 {마스킹된
 * 이메일} 로그인 정보가...")은 사용자가 어느 계정인지 알아볼 수 있어야 쓸모가 있다.
 * `"@"` 가 여러 개면 마지막 `"@"` 를 도메인 경계로 본다 — `maskName()` 과 동일한
 * "빈 값/해석 불가 → 고정 문자열" 방어적 스타일을 따른다.
 */
export function maskEmail(email: string): string {
  if (!email) return "***";
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return "***";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!local) return "***";
  const maskedLocal =
    local.length === 1 ? `${local}*` : `${local[0]}${"*".repeat(local.length - 1)}`;
  return `${maskedLocal}@${domain}`;
}

/**
 * URL 에서 쿼리스트링과 프래그먼트를 통째로 잘라낸다 — 경로까지만 남긴다.
 *
 * 로그인 리다이렉트(`/loginResult?topath=/&access_token=…&refresh_token=…`)처럼
 * 자격증명이 쿼리 파라미터로 실려 오는 URL 이 있다. `SENSITIVE_PATTERNS` 의
 * snake_case 쿼리 규칙이 이를 마스킹하지만, 마스킹된 조각(앞 20자 + 뒤 20자)조차
 * 로그에 남길 이유가 없는 경로다. 어느 화면으로 이동했는지만 알면 충분하므로
 * 값이 실릴 수 있는 부분 전체를 버린다.
 *
 * 파싱 불가한 입력은 `"?"`/`"#"` 첫 등장 위치로 자르는 폴백을 쓴다 — 이 함수는
 * 어떤 입력에도 throw 하지 않는다(로그 경로에서 호출되므로).
 */
export function stripUrlQuery(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    const cut = url.search(/[?#]/);
    return cut === -1 ? url : url.slice(0, cut);
  }
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
  // D-07/R010/IN-02 — 저장 상태문·로그로 이메일이 나갈 때 반드시 통과해야 하는
  // 관문. 06-REVIEW IN-02 가 지적한 공백(이메일 전용 마스킹 규칙 부재)을 닫는다.
  // 키 뒤에 곧바로 :/= 가 오는 경우만 매칭되므로 `emailLen=12` 같은 진단 로그는
  // 훼손되지 않는다.
  [/(email["']?\s*[:=]\s*["']?)([^"',}\s]+)/g, (_, k, v) => `${k}${maskEmail(v)}`],
  // 06-REVIEW WR-02 — 2차 방어선(구조 기반, 키 문맥 불필요). 위 13개 규칙은
  // 전부 `key["']?\s*[:=]` 형태의 키-값 문맥에 의존하므로, 서버가 임의 문장
  // 안에 토큰 형태 문자열을 섞어 돌려주면(키 이름 접두사 없이) 전부 통과시킨다.
  // 이 규칙은 키를 요구하지 않고 JWT 의 구조 자체(base64url 문자 집합 3분절이
  // 점으로 이어진 형태)만 매칭한다. 각 분절 최소 10자 하한은 도메인
  // (예: accountapi.weverse.io — 가운데 분절 "weverse" 7자로 미달), 파일/모듈
  // 경로(예: auth-service.ts — 확장자 분절 2자로 미달), 시맨틱 버전 문자열이
  // 우연히 걸리지 않도록 mask.test.ts 의 훼손 방지 케이스로 역산해 정했다.
  //
  // 반드시 배열 맨 끝에 둘 것: 앞선 키-값 규칙들이 먼저 돌아 이미 마스킹된
  // 자리는 maskToken() 의 생략 표기("...")가 들어가 3분절 형태가 아니게
  // 되므로, 이 규칙이 그 결과를 다시 건드리지 않는다 — 순서 의존적이다.
  //
  // 이 규칙조차 완전하지 않다: 토큰이 JWT 구조(점 3분절)가 아니면 여전히
  // 통과한다. 1차 방어선은 06-09 가 validateToken() 에 세운 "서버 텍스트를
  // 사용자 문구 경로에 아예 넣지 않는다"는 구조적 처치이고, 이 규칙은 그
  // 원칙을 적용하지 않은(또는 적용할 수 없는) 나머지 경로를 위한 2차
  // 방어선이다. 이 규칙의 존재를 근거로 원문 전달을 다시 허용하지 말 것.
  [/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, (m: string) => maskToken(m)],
];

/** Apply all R010 masking rules to an arbitrary text string */
export function maskSensitive(text: string): string {
  let result = text;
  for (const [pattern, replacer] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacer as Parameters<typeof String.prototype.replace>[1]);
  }
  return result;
}
