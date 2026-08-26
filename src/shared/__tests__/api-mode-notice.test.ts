/**
 * Unit tests for shouldShowApiModeNotice() — pure decision function, no
 * rendering, no electron. Mirrors the profile-form-validation.test.ts
 * convention of testing judgment logic in isolation.
 */
import { describe, it, expect } from "vitest";
import { API_MODE_NOTICE_VERSION, shouldShowApiModeNotice } from "../api-mode-notice";

describe("API_MODE_NOTICE_VERSION", () => {
  it("정수 1 이다", () => {
    expect(API_MODE_NOTICE_VERSION).toBe(1);
    expect(Number.isInteger(API_MODE_NOTICE_VERSION)).toBe(true);
  });
});

describe("shouldShowApiModeNotice", () => {
  it("한 번도 확인하지 않았으면(null) true 를 반환한다", () => {
    expect(shouldShowApiModeNotice(null, 1)).toBe(true);
  });

  it("같은 버전을 확인했으면 false 를 반환한다 (재노출 없음)", () => {
    expect(shouldShowApiModeNotice(1, 1)).toBe(false);
  });

  it("확인한 버전보다 현재 버전이 높으면 true 를 반환한다 (D-10 재확인 요구)", () => {
    expect(shouldShowApiModeNotice(0, 1)).toBe(true);
  });

  it("확인한 버전이 현재 버전보다 높아도(미래 값) false 를 반환한다", () => {
    expect(shouldShowApiModeNotice(2, 1)).toBe(false);
  });
});
