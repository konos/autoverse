/**
 * Unit tests for mask.ts — run with: ts-node src/shared/__tests__/mask.test.ts
 * No external test framework needed.
 */
import { maskToken, maskPhone, maskBirthDate } from "../mask";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS: ${message}`);
}

function runMaskTokenTests(): void {
  console.log("\n[maskToken]");
  assert(maskToken("") === "***", "empty string → ***");
  assert(maskToken("short") === "***", "short token (≤40 chars) → ***");
  const long = "A".repeat(20) + "MIDDLE" + "Z".repeat(20);
  const result = maskToken(long);
  assert(result.startsWith("A".repeat(20)), "first 20 chars preserved");
  assert(result.endsWith("Z".repeat(20)), "last 20 chars preserved");
  assert(result.includes("..."), "ellipsis present");
  assert(result === `${"A".repeat(20)}...${"Z".repeat(20)}`, "exact format");
}

function runMaskPhoneTests(): void {
  console.log("\n[maskPhone]");
  assert(maskPhone("") === "****", "empty phone → ****");
  assert(maskPhone("010") === "****", "too short → ****");
  assert(maskPhone("01012345678") === "****5678", "shows last 4 digits");
}

function runMaskBirthDateTests(): void {
  console.log("\n[maskBirthDate]");
  assert(maskBirthDate("") === "****-**-**", "empty date → ****-**-**");
  assert(maskBirthDate("1990-05-15") === "1990-**-**", "shows year only");
}

// JWT isTokenExpired tests — import auth-service logic inline to avoid Electron deps
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

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

function runIsTokenExpiredTests(): void {
  console.log("\n[isTokenExpired]");
  const past = Math.floor(Date.now() / 1000) - 3600;
  const future = Math.floor(Date.now() / 1000) + 3600;

  assert(isTokenExpired(makeJwt({ exp: past })) === true, "past exp → expired");
  assert(isTokenExpired(makeJwt({ exp: future })) === false, "future exp → valid");
  assert(isTokenExpired(makeJwt({})) === false, "no exp claim → not expired (safe default)");
  assert(isTokenExpired("not.a.jwt") === false, "malformed JWT → not expired (safe default)");
  assert(isTokenExpired("") === false, "empty string → not expired (safe default)");
  assert(isTokenExpired("only.two") === false, "two-part string → not expired");
}

try {
  runMaskTokenTests();
  runMaskPhoneTests();
  runMaskBirthDateTests();
  runIsTokenExpiredTests();
  console.log("\n✓ All tests passed\n");
} catch (e) {
  console.error("\n✗", e instanceof Error ? e.message : e);
  process.exit(1);
}
