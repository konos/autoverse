/**
 * Unit tests for resolveLoginMode() — D-01 기본값(브라우저) + api 값 파싱.
 * process.env 를 전역 변조하지 않는다 — 가짜 env 객체를 직접 주입해 검증.
 *
 * Phase 06: persistedMode 2번째 인자(D-06)와 isLoginModeLockedByEnv() 를 추가로 검증한다.
 * 아래 6개는 Phase 05 원본 테스트 — persistedMode 인자 없이 호출되므로 그대로 통과한다.
 */
import { describe, it, expect } from "vitest";
import { resolveLoginMode, isLoginModeLockedByEnv, LOGIN_MODE_ENV } from "../login-mode";

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

describe("resolveLoginMode — persistedMode (D-06)", () => {
  it('resolveLoginMode({}, "api") → api (env 미설정, 저장값 우선)', () => {
    expect(resolveLoginMode({}, "api")).toBe("api");
  });

  it("resolveLoginMode({}, undefined) → browser", () => {
    expect(resolveLoginMode({}, undefined)).toBe("browser");
  });

  it('env "browser" + 저장값 "api" → browser (env 가 완전한 override)', () => {
    expect(resolveLoginMode({ [LOGIN_MODE_ENV]: "browser" }, "api")).toBe("browser");
  });

  it('env "api" + 저장값 "browser" → api (env 가 저장값을 덮어씀)', () => {
    expect(resolveLoginMode({ [LOGIN_MODE_ENV]: "api" }, "browser")).toBe("api");
  });
});

describe("isLoginModeLockedByEnv", () => {
  it('빈 문자열 → false (잠금 아님)', () => {
    expect(isLoginModeLockedByEnv({ [LOGIN_MODE_ENV]: "" })).toBe(false);
  });

  it('"apix" 같은 오타여도 값이 있으면 → true (잠금)', () => {
    expect(isLoginModeLockedByEnv({ [LOGIN_MODE_ENV]: "apix" })).toBe(true);
  });

  it("환경변수 미설정 → false", () => {
    expect(isLoginModeLockedByEnv({})).toBe(false);
  });
});
