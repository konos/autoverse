/**
 * `token-expiry.ts` 의 실제 모듈을 import 해서 검증한다.
 */
import { describe, it, expect } from "vitest";
import { parseJwtExpMs, evaluateTokenExpiry, RELOGIN_HEADROOM_MS } from "../token-expiry";

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

// ── parseJwtExpMs ────────────────────────────────────────────────────────────

describe("parseJwtExpMs", () => {
  it("정상 JWT 의 exp 를 ms epoch 로 반환한다", () => {
    const expSec = Math.floor(Date.now() / 1000) + 3600;
    expect(parseJwtExpMs(makeJwt({ exp: expSec }))).toBe(expSec * 1000);
  });

  it("null 입력 → null", () => {
    expect(parseJwtExpMs(null)).toBeNull();
  });

  it("빈 문자열 입력 → null", () => {
    expect(parseJwtExpMs("")).toBeNull();
  });

  it("2분절 문자열(JWT 아님) → null", () => {
    expect(parseJwtExpMs("only.two")).toBeNull();
  });

  it("base64 가 깨진 문자열 → null (throw 하지 않는다)", () => {
    expect(parseJwtExpMs("header.!!!not-base64!!!.sig")).toBeNull();
  });

  it("exp 가 문자열인 payload → null", () => {
    const header = base64urlEncode({ alg: "HS256", typ: "JWT" });
    const body = base64urlEncode({ exp: "not-a-number" });
    expect(parseJwtExpMs(`${header}.${body}.sig`)).toBeNull();
  });

  it("exp 없는 payload → null", () => {
    expect(parseJwtExpMs(makeJwt({ sub: "user1" }))).toBeNull();
  });
});

// ── evaluateTokenExpiry ────────────────────────────────────────────────────

describe("evaluateTokenExpiry", () => {
  const plannedSubmitAtMs = 1_000_000;
  const headroomMs = 180_000;

  it("expMs === null → unknown", () => {
    expect(evaluateTokenExpiry(null, plannedSubmitAtMs, headroomMs)).toEqual({ status: "unknown" });
  });

  it("expMs 가 plannedSubmitAtMs + headroomMs 보다 이르면 → warning + expAt", () => {
    const expMs = plannedSubmitAtMs + headroomMs - 1;
    expect(evaluateTokenExpiry(expMs, plannedSubmitAtMs, headroomMs)).toEqual({
      status: "warning",
      expAt: expMs,
    });
  });

  it("경계값(정확히 plannedSubmitAtMs + headroomMs) → safe (엄격 미만 비교)", () => {
    const expMs = plannedSubmitAtMs + headroomMs;
    expect(evaluateTokenExpiry(expMs, plannedSubmitAtMs, headroomMs)).toEqual({ status: "safe" });
  });

  it("충분히 먼 expMs → safe", () => {
    const expMs = plannedSubmitAtMs + headroomMs + 10_000;
    expect(evaluateTokenExpiry(expMs, plannedSubmitAtMs, headroomMs)).toEqual({ status: "safe" });
  });

  it("같은 인자로 반복 호출해도 동일한 결과를 반환한다 (부수효과 없음)", () => {
    const expMs = plannedSubmitAtMs + headroomMs - 5000;
    const first = evaluateTokenExpiry(expMs, plannedSubmitAtMs, headroomMs);
    const second = evaluateTokenExpiry(expMs, plannedSubmitAtMs, headroomMs);
    expect(first).toEqual(second);
  });
});

describe("RELOGIN_HEADROOM_MS", () => {
  it("3분(180000ms) 고정 상수다", () => {
    expect(RELOGIN_HEADROOM_MS).toBe(180_000);
  });
});
