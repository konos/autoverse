/**
 * account-token-capture — pure functions for account-token discovery
 * (Phase 05 — R019 사다리 검증 스파이크).
 *
 * This module deliberately imports nothing from "electron" and nothing
 * from "./log-service" — it only transforms inputs it is handed. All
 * cookie enumeration, CDP wiring, and logging live in AuthService; this
 * module only decides what the gathered data means. That separation is
 * the structural proof (enforced by the accompanying test file, which
 * declares zero `vi.mock`) that the discovery logic is testable without
 * an Electron runtime.
 */

export interface CookieLike {
  name: string;
  domain?: string;
  value: string;
  httpOnly?: boolean;
}

const FANEVENT_COOKIE_NAME = "we2_access_token";
const MIN_ACCOUNT_TOKEN_LENGTH = 100;

/**
 * Picks the most likely account-token cookie out of a full, unfiltered
 * cookie enumeration. Excludes the known fanevent-token cookie name and
 * anything too short to plausibly be a real token (session/tracking
 * cookies). Deterministic: prefers a domain containing "account", and
 * breaks remaining ties by longest value.
 */
export function pickAccountTokenCookie(cookies: CookieLike[]): CookieLike | null {
  const candidates = cookies.filter(
    (c) =>
      c.name !== FANEVENT_COOKIE_NAME &&
      typeof c.value === "string" &&
      c.value.length >= MIN_ACCOUNT_TOKEN_LENGTH,
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const sorted = [...candidates].sort((a, b) => {
    const aAccount = a.domain?.includes("account") ? 1 : 0;
    const bAccount = b.domain?.includes("account") ? 1 : 0;
    if (aAccount !== bAccount) return bAccount - aAccount;
    return b.value.length - a.value.length;
  });

  return sorted[0];
}

/** Value-free cookie inventory string — never includes any cookie's `value`. */
export function summarizeCookies(cookies: CookieLike[]): string {
  return cookies
    .map(
      (c) =>
        `${c.name}(domain=${c.domain ?? "?"},len=${c.value.length},httpOnly=${Boolean(c.httpOnly)})`,
    )
    .join(",");
}

/**
 * Structural description of a token — never includes any slice of the
 * token itself (unlike `validateToken()`'s existing 20-char prefix log,
 * this capture path may see fully opaque tokens, so no value fragment is
 * exposed at all).
 */
export function describeTokenShape(token: string): string {
  const parts = token.split(".").length;
  return `parts=${parts} len=${token.length} looksLikeJwt=${parts === 3}`;
}
