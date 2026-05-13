/**
 * Unit tests for ProfileForm validation logic.
 */
import { describe, it, expect } from "vitest";

interface FormState {
  birthDate: string;
  phoneCountryCode: string;
  phoneNumber: string;
}

function validate(form: FormState): string | null {
  if (!form.birthDate) return "생년월일을 입력해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate))
    return "생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).";
  if (!form.phoneNumber) return "전화번호를 입력해주세요.";
  if (!/^\d{9,11}$/.test(form.phoneNumber.replace(/-/g, "")))
    return "전화번호 형식이 올바르지 않습니다.";
  return null;
}

describe("ProfileForm validation — birthDate", () => {
  it("valid form passes", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "01012345678" })).toBeNull();
  });

  it("empty birthDate → error", () => {
    expect(validate({ birthDate: "", phoneCountryCode: "+82", phoneNumber: "01012345678" }))
      .toBe("생년월일을 입력해주세요.");
  });

  it("wrong date format (no dashes) → error", () => {
    expect(validate({ birthDate: "19950314", phoneCountryCode: "+82", phoneNumber: "01012345678" }))
      .toBe("생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).");
  });

  it("partial date → error", () => {
    expect(validate({ birthDate: "1995-03", phoneCountryCode: "+82", phoneNumber: "01012345678" }))
      .toBe("생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).");
  });

  it("letters in date → error", () => {
    expect(validate({ birthDate: "YYYY-MM-DD", phoneCountryCode: "+82", phoneNumber: "01012345678" }))
      .toBe("생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).");
  });
});

describe("ProfileForm validation — phoneNumber", () => {
  it("empty phone → error", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "" }))
      .toBe("전화번호를 입력해주세요.");
  });

  it("too short phone (8 digits) → error", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "12345678" }))
      .toBe("전화번호 형식이 올바르지 않습니다.");
  });

  it("too long phone (12 digits) → error", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "123456789012" }))
      .toBe("전화번호 형식이 올바르지 않습니다.");
  });

  it("phone with dashes (valid after strip)", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "010-1234-5678" })).toBeNull();
  });

  it("letters in phone → error", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "0101234abcd" }))
      .toBe("전화번호 형식이 올바르지 않습니다.");
  });

  it("9-digit phone (minimum valid)", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+1", phoneNumber: "123456789" })).toBeNull();
  });

  it("11-digit phone (maximum valid)", () => {
    expect(validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "01012345678" })).toBeNull();
  });
});
