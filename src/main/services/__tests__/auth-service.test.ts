/**
 * Unit tests for AuthService.isTokenExpired() — no Electron deps needed.
 * The method is pure logic: base64url decode → JSON parse → compare exp to Date.now().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Electron mock — must be declared before the module import ─────────────────
vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn(() => "/tmp/test-userData") },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));

import { AuthService } from "../auth-service";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── isTokenExpired ─────────────────────────────────────────────────────────────

describe("AuthService.isTokenExpired", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Positive: valid token (future exp)
  it("future exp → returns false (not expired)", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(service.isTokenExpired(makeJwt({ exp: future }))).toBe(false);
  });

  // Positive: expired token
  it("past exp → returns true (expired)", () => {
    const past = Math.floor(Date.now() / 1000) - 1;
    expect(service.isTokenExpired(makeJwt({ exp: past }))).toBe(true);
  });

  // Boundary: exp exactly 1 hour ago
  it("exp one hour ago → expired", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(service.isTokenExpired(makeJwt({ exp: past }))).toBe(true);
  });

  // Boundary: just expired (1 second ago)
  it("exp 1 second ago → expired", () => {
    const justPast = Math.floor(Date.now() / 1000) - 1;
    expect(service.isTokenExpired(makeJwt({ exp: justPast }))).toBe(true);
  });

  // Boundary: far future
  it("exp far in the future → not expired", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 86400 * 365;
    expect(service.isTokenExpired(makeJwt({ exp: farFuture }))).toBe(false);
  });

  // Negative: no exp claim
  it("no exp claim → false (safe default, never false-positive expire)", () => {
    expect(service.isTokenExpired(makeJwt({}))).toBe(false);
  });

  // Negative: exp is a string (type mismatch)
  it("exp is string type → false (safe default)", () => {
    expect(service.isTokenExpired(makeJwt({ exp: "not-a-number" }))).toBe(false);
  });

  // Negative: exp is null
  it("exp is null → false (safe default)", () => {
    expect(service.isTokenExpired(makeJwt({ exp: null }))).toBe(false);
  });

  // Malformed: not a JWT at all
  it("plain string (not JWT) → false", () => {
    expect(service.isTokenExpired("not-a-jwt")).toBe(false);
  });

  // Malformed: two-part token
  it("two-part token → false", () => {
    expect(service.isTokenExpired("header.payload")).toBe(false);
  });

  // Malformed: empty string
  it("empty string → false", () => {
    expect(service.isTokenExpired("")).toBe(false);
  });

  // Malformed: payload is not valid base64
  it("invalid base64 payload → false (no exception thrown)", () => {
    expect(service.isTokenExpired("header.!!!invalid!!!.sig")).toBe(false);
  });

  // Malformed: payload is valid base64 but not JSON
  it("non-JSON base64 payload → false", () => {
    const badPayload = Buffer.from("not json").toString("base64");
    expect(service.isTokenExpired(`header.${badPayload}.sig`)).toBe(false);
  });

  // Four-part token (extra dot)
  it("four-part token → false (wrong format)", () => {
    expect(service.isTokenExpired("a.b.c.d")).toBe(false);
  });
});

// ── getStatus ─────────────────────────────────────────────────────────────────

describe("AuthService.getStatus", () => {
  it("returns isLoggedIn:false when no token cached", () => {
    const service = new AuthService();
    expect(service.getStatus()).toEqual({ isLoggedIn: false });
  });

  it("returns isLoggedIn:true with tokenPreview when token is set via token property", () => {
    const service = new AuthService();
    // Access via the internal getter — inject long token directly
    const longToken = "A".repeat(20) + "MIDDLE" + "Z".repeat(20);
    // Use type assertion to set private field for testing
    (service as unknown as { cachedToken: string }).cachedToken = longToken;
    const status = service.getStatus();
    expect(status.isLoggedIn).toBe(true);
    expect(status.tokenPreview).toContain("...");
    expect(status.tokenPreview).toMatch(/^A{20}\.\.\.Z{20}$/);
  });
});
