import { describe, it, expect } from "vitest";
import { describeTokenValidationFailure, type TokenValidationFailureKind } from "../token-validation-failure";

const ALL_KINDS: TokenValidationFailureKind[] = [
  "unauthorized",
  "http-error",
  "parse-error",
  "missing-fan-id",
];

describe("describeTokenValidationFailure", () => {
  // Test 1: 네 kind 각각에 대해 message 가 비어 있지 않은 한국어 문장이며 서로 다르다.
  it("네 kind 모두 비어있지 않은 서로 다른 한국어 문장을 반환한다", () => {
    const messages = ALL_KINDS.map((kind) => describeTokenValidationFailure(kind).message);

    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(ALL_KINDS.length);
  });

  // Test 2: "http-error" 에 { status: 503 } 을 주면 identifier 에 그 상태 코드가 담긴다.
  // status 를 주지 않으면 identifier 는 상태 코드를 지어내지 않는다.
  it("http-error: status 가 주어지면 identifier 에 그 상태 코드가 담긴다", () => {
    const result = describeTokenValidationFailure("http-error", { status: 503 });
    expect(result.identifier).toBe("HTTP 503");
  });

  it("http-error: status 가 없으면 identifier 를 지어내지 않는다", () => {
    const result = describeTokenValidationFailure("http-error");
    expect(result.identifier).toBeUndefined();
  });

  // Test 3 (전수 부정 단언): 네 kind 전부에 대해 반환된 message 와 identifier
  // 어디에도 반증된 이메일 인증코드 서사가 들어가지 않는다.
  it.each(ALL_KINDS)(
    "kind '%s' 는 반증된 이메일 인증코드 서사(오지 않을 메일 안내)를 포함하지 않는다",
    (kind) => {
      const result = describeTokenValidationFailure(kind, { status: 503 });
      expect(result.message).not.toMatch(/이메일로.*코드|인증코드가 발송|OTP/);
      expect(result.identifier ?? "").not.toMatch(/이메일로.*코드|인증코드가 발송|OTP/);
    }
  );

  // Test 4 (계약 단언): 두 번째 인자 타입에는 서버 응답 텍스트를 담을 수 있는 필드가 없다.
  // 타입 수준 단언 — npm run typecheck 가 이 계약의 가드다.
  it("두 번째 인자 타입에 서버 응답 텍스트를 담을 필드가 존재하지 않는다 (타입 계약)", () => {
    // @ts-expect-error — rawBody 는 context 타입에 존재하지 않는다. 서버 응답 텍스트가
    // 이 함수로 들어올 타입 경로가 없다는 것을 컴파일 타임에 고정한다.
    describeTokenValidationFailure("http-error", { status: 500, rawBody: "서버 응답 원문" });
    expect(true).toBe(true);
  });

  // Test 5: identifier 가 없는 kind 의 반환 객체에는 그 프로퍼티 자체가 존재하지 않는다.
  it("unauthorized 반환 객체에는 identifier 프로퍼티 자체가 없다", () => {
    const result = describeTokenValidationFailure("unauthorized");
    expect("identifier" in result).toBe(false);
  });

  it("http-error 를 status 없이 호출하면 identifier 프로퍼티 자체가 없다", () => {
    const result = describeTokenValidationFailure("http-error");
    expect("identifier" in result).toBe(false);
  });
});
