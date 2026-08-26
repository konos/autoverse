import { describe, it, expect } from "vitest";
import {
  mapLoginFailure,
  truncateFormError,
  classifyCredentialLoginSignal,
  FORM_ERROR_MAX_LENGTH,
  type LoginFailureReason,
} from "../login-failure";

const ALL_REASONS: LoginFailureReason[] = [
  "captcha",
  "form-error",
  "timeout",
  "network-error",
  "token-ladder-failed",
  "unknown",
];

describe("mapLoginFailure", () => {
  it("captcha: UI-SPEC 캡차 문구 + 브라우저 전환 제안 + identifier 부재", () => {
    const result = mapLoginFailure("captcha");
    expect(result.message).toBe(
      "Weverse가 보안 확인을 요구해 앱 안 로그인으로는 진행할 수 없습니다. 브라우저 로그인을 사용해주세요."
    );
    expect(result.suggestBrowserSwitch).toBe(true);
    expect(result.identifier).toBeUndefined();
  });

  it("timeout: UI-SPEC 타임아웃 문구 + 브라우저 전환 제안 + identifier 부재", () => {
    const result = mapLoginFailure("timeout");
    expect(result.message).toBe(
      "로그인 응답 대기 시간을 초과했습니다. 다시 시도하거나 브라우저 로그인을 사용해주세요."
    );
    expect(result.suggestBrowserSwitch).toBe(true);
    expect(result.identifier).toBeUndefined();
  });

  it("form-error: 전달된 텍스트를 그대로 message 로 반환, 전환 제안 없음", () => {
    const result = mapLoginFailure("form-error", "비밀번호가 올바르지 않습니다.");
    expect(result.message).toBe("비밀번호가 올바르지 않습니다.");
    expect(result.suggestBrowserSwitch).toBe(false);
  });

  it("form-error: detail 이 undefined 면 빈 화면 대신 일반 실패 문장으로 폴백", () => {
    const result = mapLoginFailure("form-error", undefined);
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.suggestBrowserSwitch).toBe(false);
  });

  it("network-error: UI-SPEC 네트워크 문구 + identifier 보존", () => {
    const result = mapLoginFailure("network-error", "ECONNRESET");
    expect(result.message).toBe(
      "네트워크 오류로 로그인에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요."
    );
    expect(result.identifier).toBe("ECONNRESET");
  });

  it("token-ladder-failed: UI-SPEC 사다리 문구 + identifier 보존", () => {
    const result = mapLoginFailure("token-ladder-failed", "ApiAuthError: rung1");
    expect(result.message).toBe(
      "로그인은 성공했지만 서비스 이용에 필요한 토큰을 확보하지 못했습니다. 다시 로그인해주세요."
    );
    expect(result.identifier).toBe("ApiAuthError: rung1");
  });

  it("unknown: UI-SPEC 미매핑 문구 + identifier 보존", () => {
    const result = mapLoginFailure("unknown", "x");
    expect(result.message).toBe("로그인에 실패했습니다. 로그 패널에서 자세한 내용을 확인하세요.");
    expect(result.identifier).toBe("x");
  });

  it("6개 사유 전부에서 message 가 비어 있지 않다", () => {
    for (const reason of ALL_REASONS) {
      const result = mapLoginFailure(reason, "detail");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("6개 사유 전부에서 반증된 이메일 인증코드 서사가 등장하지 않는다", () => {
    for (const reason of ALL_REASONS) {
      const result = mapLoginFailure(reason, "detail");
      expect(result.message).not.toMatch(/이메일로.*코드|인증코드|OTP/);
    }
  });

  it("매핑된 사유(캡차·타임아웃)는 identifier 속성 자체를 갖지 않는다", () => {
    expect("identifier" in mapLoginFailure("captcha")).toBe(false);
    expect("identifier" in mapLoginFailure("timeout")).toBe(false);
  });
});

describe("truncateFormError", () => {
  it("앞뒤 공백을 제거하고 길이 변화 없이 반환한다", () => {
    expect(truncateFormError("  로그인 실패  ")).toBe("로그인 실패");
  });

  it("정확히 120자인 입력은 그대로 반환하고 말줄임표가 붙지 않는다", () => {
    const input = "가".repeat(FORM_ERROR_MAX_LENGTH);
    const result = truncateFormError(input);
    expect(result).toBe(input);
    expect(result.endsWith("…")).toBe(false);
  });

  it("119자 입력(경계값)은 그대로 반환된다", () => {
    const input = "가".repeat(FORM_ERROR_MAX_LENGTH - 1);
    expect(truncateFormError(input)).toBe(input);
  });

  it("121자 입력(경계값)은 121자보다 짧아지고 마지막 문자가 말줄임표다", () => {
    const input = "가".repeat(FORM_ERROR_MAX_LENGTH + 1);
    const result = truncateFormError(input);
    expect(result.length).toBeLessThan(121);
    expect(result.endsWith("…")).toBe(true);
  });

  it("빈 문자열/공백만 있는 입력은 빈 결과를 반환한다", () => {
    expect(truncateFormError("")).toBe("");
    expect(truncateFormError("   ")).toBe("");
  });
});

describe("classifyCredentialLoginSignal", () => {
  it("'captcha' 신호 → reason 'captcha' (D-13 오분류 수정)", () => {
    expect(classifyCredentialLoginSignal("captcha")).toEqual({ reason: "captcha" });
  });

  it("'otp-form' 신호 → reason 'unknown' + detail (도달 불가에 가까운 신호를 미매핑 폴백으로 라우팅)", () => {
    const result = classifyCredentialLoginSignal("otp-form");
    expect(result.reason).toBe("unknown");
    expect(result.detail).toBe("otp-form");
  });

  it("'error:<본문>' 신호 → reason 'form-error' + detail 분리", () => {
    expect(classifyCredentialLoginSignal("error:비밀번호가 올바르지 않습니다.")).toEqual({
      reason: "form-error",
      detail: "비밀번호가 올바르지 않습니다.",
    });
  });

  it("'timeout' 신호 → reason 'timeout'", () => {
    expect(classifyCredentialLoginSignal("timeout")).toEqual({ reason: "timeout" });
  });

  it("null (셀렉터가 아무것도 못 찾음) → reason 'unknown', detail 없음", () => {
    expect(classifyCredentialLoginSignal(null)).toEqual({ reason: "unknown" });
  });

  it("완전히 새로운 문자열 → reason 'unknown' + detail 에 원문 보존", () => {
    expect(classifyCredentialLoginSignal("완전히 새로운 문자열")).toEqual({
      reason: "unknown",
      detail: "완전히 새로운 문자열",
    });
  });

  it("'error:' (본문 없음) → reason 'unknown' — 빈 폼 오류를 폼 오류로 취급하지 않는다", () => {
    expect(classifyCredentialLoginSignal("error:")).toEqual({ reason: "unknown" });
  });

  it("'error:   ' (공백만 있는 본문) → reason 'unknown'", () => {
    expect(classifyCredentialLoginSignal("error:   ")).toEqual({ reason: "unknown" });
  });
});

describe("mapLoginFailure - form-error 전처리 통합", () => {
  it("130자 텍스트는 message 가 잘린 형태다", () => {
    const longText = "가".repeat(130);
    const result = mapLoginFailure("form-error", longText);
    expect(result.message.length).toBeLessThan(121);
    expect(result.message.endsWith("…")).toBe(true);
  });

  it("130자 텍스트는 원문이 logDetail 로 유실 없이 노출된다 (로그 경로용)", () => {
    const longText = "가".repeat(130);
    const result = mapLoginFailure("form-error", longText);
    expect(result.logDetail).toBe(longText);
  });
});
