/**
 * Unit tests for ApiAuthClient — Phase 05 pure HTTP account API login +
 * account→fanevent token ladder (R017/R018/R019).
 * Electron 의존성 없음. fetch를 주입(DI)해서 모킹 — 실네트워크 0회.
 */
import { describe, it, expect, vi } from "vitest";
import { ApiAuthClient, ApiAuthError } from "../api-auth-client";

vi.mock("../log-service", () => ({
  logService: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logService } from "../log-service";

// ── Helpers ───────────────────────────────────────────────────────────────

interface StubResponse {
  status: number;
  body?: unknown;
}

/** Returns a fetch mock that serves `responses` in order, repeating the last entry if over-called. */
function makeFetchQueue(responses: StubResponse[]): typeof globalThis.fetch {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    } as unknown as Response;
  });
}

function makeAbortingFetch(): typeof globalThis.fetch {
  return vi.fn(async () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    throw err;
  });
}

function callInit(fetchFn: typeof globalThis.fetch, index = 0): [string, RequestInit] {
  const mock = fetchFn as unknown as ReturnType<typeof vi.fn>;
  const call = mock.mock.calls[index] as [string, RequestInit];
  return call;
}

// ── otp-session ──────────────────────────────────────────────────────────

describe("ApiAuthClient otp-session", () => {
  it("otp-session: POST /v2/auth/otp-sessions 에 email 바디와 6개 공통 헤더를 실어 보낸다", async () => {
    const fetchFn = makeFetchQueue([{ status: 200, body: { otpSessionId: "sess-1" } }]);
    const client = new ApiAuthClient(fetchFn);

    const result = await client.requestOtpSession("user@example.com");

    expect(result.otpSessionId).toBe("sess-1");
    const [url, init] = callInit(fetchFn);
    expect(url).toBe("https://accountapi.weverse.io/web/api/v2/auth/otp-sessions");
    expect(JSON.parse(init.body as string)).toEqual({ email: "user@example.com" });
    const headers = init.headers as Record<string, string>;
    expect(headers["X-ACC-APP-VERSION"]).toBeTruthy();
    expect(headers["X-ACC-APP-SECRET"]).toBeTruthy();
    expect(headers["X-ACC-SERVICE-ID"]).toBeTruthy();
    expect(headers["X-ACC-LANGUAGE"]).toBeTruthy();
    expect(headers["X-ACC-TRACE-ID"]).toBeTruthy();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("trace-id: 연속 두 호출의 X-ACC-TRACE-ID 가 서로 다르다", async () => {
    const fetchFn = makeFetchQueue([
      { status: 200, body: { otpSessionId: "sess-1" } },
      { status: 200, body: { otpSessionId: "sess-2" } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    await client.requestOtpSession("user@example.com");
    await client.requestOtpSession("user@example.com");

    const [, init1] = callInit(fetchFn, 0);
    const [, init2] = callInit(fetchFn, 1);
    const trace1 = (init1.headers as Record<string, string>)["X-ACC-TRACE-ID"];
    const trace2 = (init2.headers as Record<string, string>)["X-ACC-TRACE-ID"];
    expect(trace1).not.toBe(trace2);
  });
});

// ── otp verify ───────────────────────────────────────────────────────────

describe("ApiAuthClient otp verify", () => {
  it("otp verify: by-credentials-with-otp 바디에 email/password/otpSessionId/otpCode/refreshTokenCookieTtl 5개 필드가 모두 들어간다", async () => {
    const fetchFn = makeFetchQueue([
      { status: 200, body: { accessToken: "acc-tok", serviceUserId: "u1" } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    await client.verifyOtp("user@example.com", "P@ssw0rd-test-literal", "sess-1", "654321");

    const [url, init] = callInit(fetchFn);
    expect(url).toBe("https://accountapi.weverse.io/web/api/v3/auth/token/by-credentials-with-otp");
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(
      ["email", "otpCode", "otpSessionId", "password", "refreshTokenCookieTtl"].sort(),
    );
    expect(body.email).toBe("user@example.com");
    expect(body.password).toBe("P@ssw0rd-test-literal");
    expect(body.otpSessionId).toBe("sess-1");
    expect(body.otpCode).toBe("654321");
    expect(typeof body.refreshTokenCookieTtl).toBe("number");
  });
});

// ── error ────────────────────────────────────────────────────────────────

describe("ApiAuthClient error", () => {
  it('error: -25044 응답을 code="-25044" 인 ApiAuthError 로 던진다', async () => {
    const fetchFn = makeFetchQueue([
      { status: 400, body: { code: -25044, message: "이메일 OTP 인증이 필요합니다" } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    await expect(
      client.loginWithCredentials("user@example.com", "pw", "sess-1"),
    ).rejects.toMatchObject({
      code: "-25044",
      message: "이메일 OTP 인증이 필요합니다",
    });
  });

  it('error: -26000 응답을 code="-26000" 으로 전파한다', async () => {
    const fetchFn = makeFetchQueue([
      { status: 400, body: { code: -26000, message: "[ERROR] 잘못된 API 사용입니다." } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    await expect(
      client.loginWithCredentials("user@example.com", "pw", "sess-1"),
    ).rejects.toMatchObject({
      code: "-26000",
      message: "[ERROR] 잘못된 API 사용입니다.",
    });
  });

  it('error: 네트워크 abort 를 code="NETWORK_ERROR" 로 던진다', async () => {
    const client = new ApiAuthClient(makeAbortingFetch());

    await expect(client.requestOtpSession("user@example.com")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    await expect(client.requestOtpSession("user@example.com")).rejects.toBeInstanceOf(ApiAuthError);
  });
});

// ── exchange ─────────────────────────────────────────────────────────────

describe("ApiAuthClient exchange", () => {
  it("exchange: by-access-token 호출이 Authorization Bearer 와 targetServiceId 바디를 갖는다", async () => {
    const fetchFn = makeFetchQueue([
      { status: 200, body: { accessToken: "exchanged-tok" } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    await client.exchangeForService("account-tok");

    const [url, init] = callInit(fetchFn);
    expect(url).toBe("https://accountapi.weverse.io/web/api/v2/auth/token/by-access-token");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer account-tok");
    expect(headers["X-ACC-SERVICE-ID"]).toBe("weverse");
    expect(JSON.parse(init.body as string)).toEqual({ targetServiceId: "weverse" });
  });

  it("exchange: departureServiceId 를 명시하면 X-ACC-SERVICE-ID 헤더가 그 값으로 바뀐다", async () => {
    const fetchFn = makeFetchQueue([
      { status: 200, body: { accessToken: "exchanged-tok" } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    await client.exchangeForService("account-tok", "weverse", "account");

    const [, init] = callInit(fetchFn);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-ACC-SERVICE-ID"]).toBe("account");
  });
});

// ── ladder ───────────────────────────────────────────────────────────────

describe("ApiAuthClient ladder", () => {
  it('ladder rung1: /fans/me 가 account 토큰으로 바로 200 이면 source="direct" 이고 교환 호출이 발생하지 않는다', async () => {
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 42 } }]);
    const client = new ApiAuthClient(fetchFn);

    const result = await client.acquireFaneventToken("account-tok");

    expect(result).toEqual({ token: "account-tok", source: "direct", fanId: 42 });
    const mock = fetchFn as unknown as ReturnType<typeof vi.fn>;
    const urlsCalled = mock.mock.calls.map((c) => c[0]);
    expect(urlsCalled.some((u) => String(u).includes("by-access-token"))).toBe(false);
  });

  it('ladder rung2: /fans/me 가 401 이면 교환 후 재시도해 source="exchange" 를 반환한다', async () => {
    const fetchFn = makeFetchQueue([
      { status: 401 }, // first /fans/me
      { status: 200, body: { accessToken: "exchanged-tok" } }, // by-access-token
      { status: 200, body: { fanId: 99 } }, // second /fans/me
    ]);
    const client = new ApiAuthClient(fetchFn);

    const result = await client.acquireFaneventToken("account-tok");

    expect(result).toEqual({ token: "exchanged-tok", source: "exchange", fanId: 99 });
  });

  it('ladder: 두 사다리 모두 401 이면 code="FANEVENT_TOKEN_UNAVAILABLE" 로 던진다', async () => {
    const fetchFn = makeFetchQueue([
      { status: 401 }, // first /fans/me
      { status: 200, body: { accessToken: "exchanged-tok" } }, // by-access-token
      { status: 401 }, // second /fans/me
    ]);
    const client = new ApiAuthClient(fetchFn);

    await expect(client.acquireFaneventToken("account-tok")).rejects.toMatchObject({
      code: "FANEVENT_TOKEN_UNAVAILABLE",
    });
  });
});

// ── tracer end-to-end ────────────────────────────────────────────────────

describe("ApiAuthClient tracer", () => {
  it("tracer end-to-end: otp-session → by-credentials(-25044) → verifyOtp → acquireFaneventToken 순서로 팬이벤트 토큰과 fanId 를 얻는다", async () => {
    const fetchFn = makeFetchQueue([
      { status: 200, body: { otpSessionId: "sess-1" } }, // otp-sessions
      { status: 400, body: { code: -25044, message: "OTP 필요" } }, // by-credentials
      { status: 200, body: { accessToken: "account-tok", serviceUserId: "u1" } }, // by-credentials-with-otp
      { status: 200, body: { fanId: 7 } }, // /fans/me (rung1 direct succeeds)
    ]);
    const client = new ApiAuthClient(fetchFn);

    const otpSession = await client.requestOtpSession("user@example.com");

    let needOtp = false;
    try {
      await client.loginWithCredentials("user@example.com", "P@ssw0rd-test-literal", otpSession.otpSessionId);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "-25044") {
        needOtp = true;
      } else {
        throw err;
      }
    }
    expect(needOtp).toBe(true);

    const tokens = await client.verifyOtp(
      "user@example.com",
      "P@ssw0rd-test-literal",
      otpSession.otpSessionId,
      "654321",
    );
    const faneventToken = await client.acquireFaneventToken(tokens.accessToken);

    expect(faneventToken).toEqual({ token: "account-tok", source: "direct", fanId: 7 });
  });
});

// ── sensitive data ───────────────────────────────────────────────────────

describe("ApiAuthClient 민감정보", () => {
  it("민감정보: password/otpCode 가 어떤 로그 인자에도 포함되지 않는다", async () => {
    const password = "P@ssw0rd-test-literal";
    const otpCode = "654321";

    const fetchFn = makeFetchQueue([
      { status: 200, body: { otpSessionId: "sess-1" } },
      { status: 400, body: { code: -25044, message: "OTP 필요" } },
      { status: 200, body: { accessToken: "account-tok", serviceUserId: "u1" } },
      { status: 200, body: { fanId: 7 } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    const otpSession = await client.requestOtpSession("user@example.com");
    try {
      await client.loginWithCredentials("user@example.com", password, otpSession.otpSessionId);
    } catch {
      // expected -25044
    }
    const tokens = await client.verifyOtp("user@example.com", password, otpSession.otpSessionId, otpCode);
    await client.acquireFaneventToken(tokens.accessToken);

    const spies = [logService.info, logService.warn, logService.error, logService.debug] as ReturnType<
      typeof vi.fn
    >[];
    const allArgs = spies
      .flatMap((spy) => spy.mock.calls)
      .map((call) => JSON.stringify(call))
      .join("\n");

    expect(allArgs).not.toContain(password);
    expect(allArgs).not.toContain(otpCode);
  });
});
