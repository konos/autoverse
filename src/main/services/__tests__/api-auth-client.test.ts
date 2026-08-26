/**
 * Unit tests for ApiAuthClient — account→fanevent token ladder (R019).
 * Electron 의존성 없음. fetch를 주입(DI)해서 모킹 — 실네트워크 0회.
 *
 * Phase 06 Plan 04 (D-02): 이 스위트는 원래 계정 API 3단계 로그인
 * (otp-sessions → by-credentials → by-credentials-with-otp)도 검증했으나,
 * 그 계약이 05-01 HAR 실측으로 반증되어 관련 describe 3개(otp-session/
 * otp verify/error)를 통째로 삭제했다. 사다리(exchange/ladder)와 tracer,
 * 민감정보 취지는 남은 메서드(exchangeForService/probeFaneventToken/
 * acquireFaneventToken)를 대상으로 그대로 유지·재작성한다.
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

function callInit(fetchFn: typeof globalThis.fetch, index = 0): [string, RequestInit] {
  const mock = fetchFn as unknown as ReturnType<typeof vi.fn>;
  const call = mock.mock.calls[index] as [string, RequestInit];
  return call;
}

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

  it("exchange 관측성: 정상 응답이면 응답 키 목록과 hasAccessToken/accessTokenLen 이 로그로 남고 토큰 값 자체는 남지 않는다 (A3)", async () => {
    const fetchFn = makeFetchQueue([
      { status: 200, body: { accessToken: "exchanged-tok-value", serviceUserId: "u1" } },
    ]);
    const client = new ApiAuthClient(fetchFn);

    const result = await client.exchangeForService("account-tok");

    expect(result.accessToken).toBe("exchanged-tok-value");
    const infoMock = logService.info as unknown as ReturnType<typeof vi.fn>;
    const allInfoArgs = infoMock.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    expect(allInfoArgs).toContain("exchangeForService response keys=");
    expect(allInfoArgs).toContain("hasAccessToken=true");
    expect(allInfoArgs).toContain("accessTokenLen=19");
    expect(allInfoArgs).not.toContain("exchanged-tok-value");
  });

  it("exchange 방어: accessToken 이 없으면 EXCHANGE_RESPONSE_MALFORMED 로 즉시 실패한다 (조용한 undefined 전파 금지)", async () => {
    const fetchFn = makeFetchQueue([{ status: 200, body: { serviceUserId: "u1" } }]);
    const client = new ApiAuthClient(fetchFn);

    await expect(client.exchangeForService("account-tok")).rejects.toMatchObject({
      code: "EXCHANGE_RESPONSE_MALFORMED",
    });
    await expect(client.exchangeForService("account-tok")).rejects.toBeInstanceOf(ApiAuthError);
  });

  it("exchange 방어: accessToken 이 빈 문자열이면 EXCHANGE_RESPONSE_MALFORMED 로 실패한다", async () => {
    const fetchFn = makeFetchQueue([{ status: 200, body: { accessToken: "" } }]);
    const client = new ApiAuthClient(fetchFn);

    await expect(client.exchangeForService("account-tok")).rejects.toMatchObject({
      code: "EXCHANGE_RESPONSE_MALFORMED",
    });
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
//
// Phase 06 Plan 04 재작성: 옛 tracer 는 삭제된 4개 메서드(requestOtpSession →
// loginWithCredentials → verifyOtp → acquireFaneventToken)를 순서대로
// 체이닝했다. 이제 계정 토큰은 AuthService.credentialLogin() 의 헤드리스
// 브라우저 로그인에서 나온다(이 클라이언트의 책임 밖) — 남은 사다리만으로
// "계정 토큰 → 팬이벤트 토큰 + fanId" 를 얻는 종단 시나리오로 다시 쓴다.

describe("ApiAuthClient tracer", () => {
  it("tracer end-to-end: 헤드리스 로그인이 확보한 계정 토큰을 사다리에 흘려 팬이벤트 토큰과 fanId 를 얻는다 (rung1 direct)", async () => {
    const fetchFn = makeFetchQueue([
      { status: 200, body: { fanId: 7 } }, // /fans/me (rung1 direct succeeds)
    ]);
    const client = new ApiAuthClient(fetchFn);

    // credentialLogin() 의 헤드리스 브라우저 로그인이 확보했다고 가정하는 계정 토큰.
    const accountAccessToken = "account-tok-from-headless-login";

    const faneventToken = await client.acquireFaneventToken(accountAccessToken);

    expect(faneventToken).toEqual({ token: accountAccessToken, source: "direct", fanId: 7 });
  });

  it("tracer end-to-end: rung1 이 401 이면 exchangeForService 를 거쳐 팬이벤트 토큰을 얻는다 (rung2 exchange)", async () => {
    const fetchFn = makeFetchQueue([
      { status: 401 }, // first /fans/me (rung1 fails)
      { status: 200, body: { accessToken: "exchanged-tok" } }, // by-access-token
      { status: 200, body: { fanId: 8 } }, // second /fans/me (rung2 succeeds)
    ]);
    const client = new ApiAuthClient(fetchFn);

    const faneventToken = await client.acquireFaneventToken("account-tok-from-headless-login");

    expect(faneventToken).toEqual({ token: "exchanged-tok", source: "exchange", fanId: 8 });
  });
});

// ── sensitive data ───────────────────────────────────────────────────────
//
// 옛 민감정보 테스트는 password/otpCode 를 다뤘으나 그 필드들은 삭제된
// requestOtpSession/loginWithCredentials/verifyOtp 전용이었다 — 이 클라이언트는
// 더 이상 비밀번호/OTP 코드를 다루지 않는다. 남은 메서드가 다루는 민감정보는
// 계정/팬이벤트 액세스 토큰이므로, 그 값이 로그에 원문으로 남지 않는다는
// 취지를 유지한 채 재작성한다.

describe("ApiAuthClient 민감정보", () => {
  it("민감정보: 계정/팬이벤트 액세스 토큰 원문이 어떤 로그 인자에도 포함되지 않는다", async () => {
    const accountAccessToken = "account-tok-real-value-should-not-leak";
    const exchangedAccessToken = "exchanged-tok-real-value-should-not-leak";

    const fetchFn = makeFetchQueue([
      { status: 401 }, // rung1 direct fails
      { status: 200, body: { accessToken: exchangedAccessToken } }, // by-access-token
      { status: 200, body: { fanId: 7 } }, // rung2 succeeds
    ]);
    const client = new ApiAuthClient(fetchFn);

    await client.acquireFaneventToken(accountAccessToken);

    const spies = [logService.info, logService.warn, logService.error, logService.debug] as ReturnType<
      typeof vi.fn
    >[];
    const allArgs = spies
      .flatMap((spy) => spy.mock.calls)
      .map((call) => JSON.stringify(call))
      .join("\n");

    expect(allArgs).not.toContain(accountAccessToken);
    expect(allArgs).not.toContain(exchangedAccessToken);
  });
});
