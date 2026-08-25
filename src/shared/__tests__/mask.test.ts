import { describe, it, expect } from "vitest";
import { maskToken, maskPhone, maskBirthDate, maskMembershipNumber, maskName, maskSensitive } from "../mask";

// ── Helpers ──────────────────────────────────────────────────────────────────

function base64urlEncode(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function makeJwt(payload: object): string {
  const header = base64urlEncode({ alg: "HS256", typ: "JWT" });
  const body = base64urlEncode(payload);
  return `${header}.${body}.fakesig`;
}

/** Mirror of AuthService.isTokenExpired — tested inline to avoid Electron deps */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf-8")
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

// ── maskToken ─────────────────────────────────────────────────────────────────

describe("maskToken", () => {
  it("empty string → ***", () => {
    expect(maskToken("")).toBe("***");
  });

  it("short token (≤40 chars) → ***", () => {
    expect(maskToken("short")).toBe("***");
    expect(maskToken("A".repeat(40))).toBe("***");
  });

  it("long token: preserves first 20 and last 20 chars with ellipsis", () => {
    const long = "A".repeat(20) + "MIDDLE" + "Z".repeat(20);
    const result = maskToken(long);
    expect(result).toBe(`${"A".repeat(20)}...${"Z".repeat(20)}`);
  });

  it("exactly 41 chars → masked", () => {
    const token = "A".repeat(20) + "B" + "Z".repeat(20);
    const result = maskToken(token);
    expect(result.startsWith("A".repeat(20))).toBe(true);
    expect(result.endsWith("Z".repeat(20))).toBe(true);
    expect(result.includes("...")).toBe(true);
  });
});

// ── maskPhone ─────────────────────────────────────────────────────────────────

describe("maskPhone", () => {
  it("empty string → ****", () => {
    expect(maskPhone("")).toBe("****");
  });

  it("too short (< 4 chars) → ****", () => {
    expect(maskPhone("010")).toBe("****");
    expect(maskPhone("1")).toBe("****");
  });

  it("shows only last 4 digits", () => {
    expect(maskPhone("01012345678")).toBe("****5678");
  });

  it("exactly 4 chars → shows all 4 as suffix", () => {
    expect(maskPhone("1234")).toBe("****1234");
  });
});

// ── maskBirthDate ─────────────────────────────────────────────────────────────

describe("maskBirthDate", () => {
  it("empty string → ****-**-**", () => {
    expect(maskBirthDate("")).toBe("****-**-**");
  });

  it("YYYY-MM-DD → shows year only", () => {
    expect(maskBirthDate("1990-05-15")).toBe("1990-**-**");
  });

  it("shorter than 4 chars → preserves what is there", () => {
    expect(maskBirthDate("199")).toBe("199-**-**");
  });
});

// ── maskMembershipNumber ──────────────────────────────────────────────────────

describe("maskMembershipNumber", () => {
  it("empty string → ****", () => {
    expect(maskMembershipNumber("")).toBe("****");
  });

  it("short (< 4 chars) → ****", () => {
    expect(maskMembershipNumber("123")).toBe("****");
  });

  it("shows only last 4 chars", () => {
    expect(maskMembershipNumber("MEM123456")).toBe("****3456");
  });

  it("exactly 4 chars → shows all as suffix", () => {
    expect(maskMembershipNumber("1234")).toBe("****1234");
  });
});

// ── maskName ──────────────────────────────────────────────────────────────────

describe("maskName", () => {
  it("empty string → ***", () => {
    expect(maskName("")).toBe("***");
  });

  it("single char → char + *", () => {
    expect(maskName("J")).toBe("J*");
  });

  it("shows only first char + asterisks", () => {
    expect(maskName("John")).toBe("J***");
  });

  it("Korean name → first char + asterisks", () => {
    expect(maskName("김철수")).toBe("김**");
  });
});

// ── maskSensitive ─────────────────────────────────────────────────────────────

describe("maskSensitive", () => {
  it("masks Authorization header value", () => {
    const text = "Authorization: Bearer abcdefghijklmnopqrst1234567890uvwxyz";
    const result = maskSensitive(text);
    expect(result).toContain("Authorization:");
    expect(result).not.toContain("Bearer abcdefghijklmnopqrst1234567890uvwxyz");
  });

  it("masks password value in a serialized object string (email/otpSessionId preserved)", () => {
    const text = '{"email":"a@b.com","password":"SuperSecret123!","otpSessionId":"abc"}';
    const result = maskSensitive(text);
    expect(result).not.toContain("SuperSecret123!");
    expect(result).toContain('"email":"a@b.com"');
    expect(result).toContain('"otpSessionId":"abc"');
  });

  it("masks otpCode value", () => {
    const text = '{"otpCode":"123456"}';
    const result = maskSensitive(text);
    expect(result).not.toContain("123456");
  });

  it("masks password= (equals-separated) form", () => {
    const text = "password=SuperSecret123!";
    const result = maskSensitive(text);
    expect(result).not.toContain("SuperSecret123!");
  });

  it("existing 7 rules still work together (Authorization + phoneNumber regression)", () => {
    const text = 'Authorization: Bearer abcdefghijklmnopqrst1234567890uvwxyz, phoneNumber: "01012345678"';
    const result = maskSensitive(text);
    expect(result).not.toContain("Bearer abcdefghijklmnopqrst1234567890uvwxyz");
    expect(result).toContain("****5678");
  });

  it("masks applyToken in JSON-like text", () => {
    const text = `applyToken: "abcdefghijklmnopqrst1234567890uvwxyz12345"`;
    const result = maskSensitive(text);
    expect(result).toContain("applyToken:");
    expect(result).not.toContain("abcdefghijklmnopqrst1234567890uvwxyz12345");
  });

  it("masks phoneNumber", () => {
    const text = `phoneNumber: "01012345678"`;
    const result = maskSensitive(text);
    expect(result).toContain("phoneNumber:");
    expect(result).toContain("****5678");
  });

  it("masks birthDate", () => {
    const text = `birthDate: "1990-05-15"`;
    const result = maskSensitive(text);
    expect(result).toContain("birthDate:");
    expect(result).toContain("1990-**-**");
  });

  it("masks membershipNumber", () => {
    const text = `membershipNumber: "MEM98765"`;
    const result = maskSensitive(text);
    expect(result).toContain("membershipNumber:");
    expect(result).toContain("****8765");
  });

  it("masks firstName", () => {
    const text = `firstName: "Alice"`;
    const result = maskSensitive(text);
    expect(result).toContain("firstName:");
    expect(result).toContain("A****");
  });

  it("masks lastName", () => {
    const text = `lastName: "Smith"`;
    const result = maskSensitive(text);
    expect(result).toContain("lastName:");
    expect(result).toContain("S****");
  });

  it("plain text with no sensitive data returns unchanged", () => {
    const text = "user clicked the button at 10:00";
    expect(maskSensitive(text)).toBe(text);
  });

  it("masks multiple fields in one string", () => {
    const text = `phoneNumber: "01099998888", birthDate: "2000-01-01"`;
    const result = maskSensitive(text);
    expect(result).toContain("****8888");
    expect(result).toContain("2000-**-**");
  });

  it("empty string returns empty string", () => {
    expect(maskSensitive("")).toBe("");
  });
});

// ── isTokenExpired (JWT exp parsing) ─────────────────────────────────────────

describe("isTokenExpired", () => {
  const past = Math.floor(Date.now() / 1000) - 3600;
  const future = Math.floor(Date.now() / 1000) + 3600;

  it("past exp → expired", () => {
    expect(isTokenExpired(makeJwt({ exp: past }))).toBe(true);
  });

  it("future exp → valid", () => {
    expect(isTokenExpired(makeJwt({ exp: future }))).toBe(false);
  });

  it("no exp claim → not expired (safe default)", () => {
    expect(isTokenExpired(makeJwt({}))).toBe(false);
  });

  it("malformed JWT (non-base64 payload) → not expired (safe default)", () => {
    expect(isTokenExpired("not.a.jwt")).toBe(false);
  });

  it("empty string → not expired (safe default)", () => {
    expect(isTokenExpired("")).toBe(false);
  });

  it("two-part string → not expired", () => {
    expect(isTokenExpired("only.two")).toBe(false);
  });

  it("exp exactly at current second boundary — treats as expired", () => {
    const nowSec = Math.floor(Date.now() / 1000) - 1;
    expect(isTokenExpired(makeJwt({ exp: nowSec }))).toBe(true);
  });
});
