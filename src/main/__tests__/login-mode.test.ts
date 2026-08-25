/**
 * Unit tests for resolveLoginMode() — D-01 기본값(브라우저) + api 값 파싱.
 * process.env 를 전역 변조하지 않는다 — 가짜 env 객체를 직접 주입해 검증.
 */
import { describe, it, expect } from "vitest";
import { resolveLoginMode, LOGIN_MODE_ENV } from "../login-mode";

describe("resolveLoginMode", () => {
  it("환경변수 미설정 → browser (D-01 기본값)", () => {
    expect(resolveLoginMode({})).toBe("browser");
  });

  it('"api" → api', () => {
    expect(resolveLoginMode({ [LOGIN_MODE_ENV]: "api" })).toBe("api");
  });

  it('" API " (공백 + 대문자) → api', () => {
    expect(resolveLoginMode({ [LOGIN_MODE_ENV]: " API " })).toBe("api");
  });

  it('"browser" → browser', () => {
    expect(resolveLoginMode({ [LOGIN_MODE_ENV]: "browser" })).toBe("browser");
  });

  it('"apix" 같은 오타 → browser (안전 폴백)', () => {
    expect(resolveLoginMode({ [LOGIN_MODE_ENV]: "apix" })).toBe("browser");
  });

  it("빈 문자열 → browser", () => {
    expect(resolveLoginMode({ [LOGIN_MODE_ENV]: "" })).toBe("browser");
  });
});
