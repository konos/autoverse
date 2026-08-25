/**
 * Unit tests for account-token-capture.ts pure functions.
 *
 * No `vi.mock` declaration in this file — that absence is the structural
 * proof that the module under test has zero Electron runtime dependency.
 */
import { describe, it, expect } from "vitest";
import {
  pickAccountTokenCookie,
  summarizeCookies,
  describeTokenShape,
  type CookieLike,
} from "../account-token-capture";

const LONG_VALUE = "a".repeat(427);

describe("accountTokenDiscovery — pickAccountTokenCookie", () => {
  it("빈 배열이면 null", () => {
    expect(pickAccountTokenCookie([])).toBeNull();
  });

  it("we2_access_token 하나뿐이면 null (팬이벤트 토큰은 계정 토큰이 아니다)", () => {
    const cookies: CookieLike[] = [
      { name: "we2_access_token", value: LONG_VALUE, domain: ".weverse.io" },
    ];
    expect(pickAccountTokenCookie(cookies)).toBeNull();
  });

  it("we2_access_token 과 계정 토큰 후보가 함께 있으면 계정 토큰 후보를 고른다", () => {
    const accCookie: CookieLike = {
      name: "acc_token",
      value: LONG_VALUE,
      domain: "account.weverse.io",
    };
    const cookies: CookieLike[] = [
      { name: "we2_access_token", value: LONG_VALUE, domain: ".weverse.io" },
      accCookie,
    ];
    expect(pickAccountTokenCookie(cookies)).toEqual(accCookie);
  });

  it("값 길이가 100자 미만인 쿠키는 후보에서 제외한다", () => {
    const cookies: CookieLike[] = [
      { name: "session_id", value: "short", domain: "weverse.io" },
    ];
    expect(pickAccountTokenCookie(cookies)).toBeNull();
  });

  it("후보가 여럿이면 account 를 포함하는 도메인을 우선한다", () => {
    const nonAccount: CookieLike = { name: "tok_a", value: LONG_VALUE, domain: "weverse.io" };
    const account: CookieLike = { name: "tok_b", value: LONG_VALUE, domain: "account.weverse.io" };
    expect(pickAccountTokenCookie([nonAccount, account])).toEqual(account);
    expect(pickAccountTokenCookie([account, nonAccount])).toEqual(account);
  });

  it("도메인 우선순위가 동률이면 값이 가장 긴 것을 고른다 — 결정적(입력 순서 무관)", () => {
    const shorter: CookieLike = { name: "tok_a", value: "x".repeat(150), domain: "account.weverse.io" };
    const longer: CookieLike = { name: "tok_b", value: "x".repeat(200), domain: "account.weverse.io" };
    expect(pickAccountTokenCookie([shorter, longer])).toEqual(longer);
    expect(pickAccountTokenCookie([longer, shorter])).toEqual(longer);
  });
});

describe("summarizeCookies masking", () => {
  it("픽스처 쿠키의 value 문자열이 결과에 포함되지 않는다", () => {
    const secretValue = "super-secret-value-should-not-leak";
    const cookies: CookieLike[] = [
      { name: "acc_token", value: secretValue, domain: "account.weverse.io", httpOnly: true },
    ];
    const summary = summarizeCookies(cookies);
    expect(summary).not.toContain(secretValue);
    expect(summary).toContain("acc_token(domain=account.weverse.io,len=");
    expect(summary).toContain("httpOnly=true");
  });

  it("여러 쿠키를 콤마로 구분해 하나의 문자열로 합친다", () => {
    const cookies: CookieLike[] = [
      { name: "a", value: "1234", domain: "x.com" },
      { name: "b", value: "56789", domain: "y.com" },
    ];
    const summary = summarizeCookies(cookies);
    expect(summary).toBe("a(domain=x.com,len=4,httpOnly=false),b(domain=y.com,len=5,httpOnly=false)");
  });

  it("빈 배열이면 빈 문자열", () => {
    expect(summarizeCookies([])).toBe("");
  });
});

describe("describeTokenShape", () => {
  it("점 3개 조각(JWT 형태) → parts=3, looksLikeJwt=true", () => {
    const result = describeTokenShape("a.b.c");
    expect(result).toContain("parts=3");
    expect(result).toContain("looksLikeJwt=true");
  });

  it("불투명 토큰(점 없음) → parts=1, looksLikeJwt=false", () => {
    const result = describeTokenShape("opaque");
    expect(result).toContain("parts=1");
    expect(result).toContain("looksLikeJwt=false");
  });

  it("토큰 원문 조각을 결과 문자열에 노출하지 않는다", () => {
    const result = describeTokenShape("secretpart1.secretpart2.secretpart3");
    expect(result).not.toContain("secretpart1");
    expect(result).not.toContain("secretpart2");
    expect(result).not.toContain("secretpart3");
  });
});
