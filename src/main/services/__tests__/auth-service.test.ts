/**
 * Unit tests for AuthService.isTokenExpired() — no Electron deps needed.
 * The method is pure logic: base64url decode → JSON parse → compare exp to Date.now().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Mutable cookie fixture, wired through the mocked `session.fromPartition` ──
// `vi.hoisted()` is required because `vi.mock()` factories are hoisted above
// all imports — referencing an ordinary outer `let` here would throw
// "Cannot access before initialization".
const { cookieFixtureBox } = vi.hoisted(() => ({
  cookieFixtureBox: {
    current: [] as Array<{ name: string; domain?: string; value: string; httpOnly?: boolean }>,
  },
}));

// ── Electron mock — must be declared before the module import ─────────────────
vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn(() => "/tmp/test-userData") },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
  session: {
    fromPartition: vi.fn(() => ({
      cookies: {
        get: vi.fn(async (filter?: { name?: string }) => {
          if (filter && filter.name) {
            return cookieFixtureBox.current.filter((c) => c.name === filter.name);
          }
          return cookieFixtureBox.current;
        }),
      },
    })),
  },
}));

import { BrowserWindow } from "electron";
import { AuthService } from "../auth-service";
import { ApiAuthClient } from "../api-auth-client";
import type { LoginFailureReason } from "../../../shared/login-failure";
import type { AuthEvent, CredentialLoginResult } from "../../../shared/types";

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

// `app.getPath` is mocked to "/tmp/test-userData" above — mirrors
// getCredentialsPath() in auth-service.ts (userData + "credentials.enc").
const TEST_CREDENTIALS_PATH = path.join("/tmp/test-userData", "credentials.enc");

/** Writes a real (mock-encrypted) credentials file so hasStoredCredentials() is genuinely true. */
function writeStoredCredentials(email: string, password: string): void {
  fs.mkdirSync("/tmp/test-userData", { recursive: true });
  fs.writeFileSync(TEST_CREDENTIALS_PATH, Buffer.from(JSON.stringify({ email, password })));
}

function clearStoredCredentialsFile(): void {
  try {
    fs.unlinkSync(TEST_CREDENTIALS_PATH);
  } catch {
    /* not present — ok */
  }
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


// ── 무인 로그인 차단 (두 모드 공통, D-03) ──────────────────────────────────
//
// Phase 06 Plan 04 재정의: 가드 조건이 *모드*("API 모드는 매 로그인마다 OTP
// 강제")에서 *"외부에 로그인 요청을 발생시키는가"*로 바뀌었다. 05-01의 반증
// (HAR 호출 0건)으로 옛 사유는 무효화됐고, 동시에 D-01이 지정한 API 모드의
// 실체(credentialLogin 헤드리스 경로)를 막는 모순 상태였다. 이 describe 는
// 저장된 자격증명으로의 무인 로그인은 두 모드 모두에서 차단되고, 살아있는
// 쿠키 토큰으로의 세션 복원은 두 모드 모두에서 허용됨을 검증한다.

describe("AuthService.tryAutoLogin — 무인 로그인 차단 (두 모드 공통)", () => {
  const ENV_KEY = "AUTOVERSE_LOGIN_MODE";
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env[ENV_KEY];
    cookieFixtureBox.current = [];
    clearStoredCredentialsFile();
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalEnv;
    vi.restoreAllMocks();
    cookieFixtureBox.current = [];
    clearStoredCredentialsFile();
  });

  it("API 모드 + 저장된 자격증명 있음 → credentialLogin(헤드리스) 을 호출하지 않고 false 를 반환한다", async () => {
    process.env[ENV_KEY] = "api";
    writeStoredCredentials("stored@example.com", "stored-pw");
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.tryAutoLogin();

    expect(result).toBe(false);
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });

  it("브라우저 모드 + 저장된 자격증명 있음 → credentialLogin(헤드리스) 을 호출하지 않는다 (D-03 핵심 회귀 — 이전에는 호출했다)", async () => {
    delete process.env[ENV_KEY];
    writeStoredCredentials("stored@example.com", "stored-pw");
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.tryAutoLogin();

    expect(result).toBe(false);
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });

  it("두 모드 모두 저장된 자격증명이 없으면 false 를 반환하고 사용자 개입이 필요함을 로그로 남긴다", async () => {
    delete process.env[ENV_KEY];
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.tryAutoLogin();

    expect(result).toBe(false);
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });

  it("두 모드 모두 쿠키에 살아있는 토큰이 있으면 true 를 반환한다 (세션 복원 허용, 무인 로그인 아님)", async () => {
    process.env[ENV_KEY] = "api";
    cookieFixtureBox.current = [
      { name: "we2_access_token", value: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }), domain: "weverse.io" },
    ];
    const service = new AuthService();
    // extractTokenFromCookies() fire-and-forgets validateToken() — stub it so
    // no real network fetch is attempted (safety: no live Weverse requests).
    vi.spyOn(service, "validateToken").mockResolvedValue({ isLoggedIn: true });
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.tryAutoLogin();

    expect(result).toBe(true);
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });
});

// ── trySessionRestore (구 tryAutoRelogin 의 정직한 후신, D-03) ─────────────

describe("AuthService.trySessionRestore — 무인 로그인 없이 세션 복원만 시도", () => {
  interface PrivateSessionRestore {
    trySessionRestore(): Promise<boolean>;
  }

  beforeEach(() => {
    cookieFixtureBox.current = [];
    clearStoredCredentialsFile();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cookieFixtureBox.current = [];
    clearStoredCredentialsFile();
  });

  it("저장된 자격증명이 있어도 credentialLogin(헤드리스) 을 호출하지 않는다", async () => {
    writeStoredCredentials("stored@example.com", "stored-pw");
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await (service as unknown as PrivateSessionRestore).trySessionRestore();

    expect(result).toBe(false);
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });

  it("쿠키에 살아있는 토큰이 있으면 true 를 반환한다 (세션 복원 성공)", async () => {
    cookieFixtureBox.current = [
      { name: "we2_access_token", value: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }), domain: "weverse.io" },
    ];
    const service = new AuthService();
    vi.spyOn(service, "validateToken").mockResolvedValue({ isLoggedIn: true });
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await (service as unknown as PrivateSessionRestore).trySessionRestore();

    expect(result).toBe(true);
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });
});

// ── runAccountTokenLadderSpike (Phase 05 재설계 — R019 사다리 검증) ─────────

interface StubResponse {
  status: number;
  body?: unknown;
}

/** Serves `responses` in order, repeating the last entry if over-called (mirrors api-auth-client.test.ts). */
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

const LONG_TOKEN = "a".repeat(150);

describe("AuthService.runAccountTokenLadderSpike", () => {
  beforeEach(() => {
    cookieFixtureBox.current = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cookieFixtureBox.current = [];
  });

  it("종단(pass): 쿠키 후보가 있고 /fans/me 가 200+fanId 를 주면 tokenSource=cookie, ladderSource=direct 를 반환한다", async () => {
    cookieFixtureBox.current = [
      { name: "acc_token", value: LONG_TOKEN, domain: "account.weverse.io" },
    ];
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 12345 } }]);
    const service = new AuthService(new ApiAuthClient(fetchFn));

    const result = await service.runAccountTokenLadderSpike("test");

    expect(result).toEqual({
      verdict: "pass",
      tokenSource: "cookie",
      ladderSource: "direct",
      fanId: 12345,
      reason: "ok",
    });
  });

  it("종단(fail/none): 쿠키 후보가 없고 CDP 캡처도 없으면 사다리를 호출하지 않고 fail/none 을 반환한다", async () => {
    cookieFixtureBox.current = [];
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 1 } }]);
    const service = new AuthService(new ApiAuthClient(fetchFn));

    const result = await service.runAccountTokenLadderSpike("test");

    expect(result.verdict).toBe("fail");
    expect(result.tokenSource).toBe("none");
    expect(result.ladderSource).toBeNull();
    const mock = fetchFn as unknown as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls.length).toBe(0);
  });

  it("단일 비행: 진행 중인 호출이 있을 때 두 번째 호출은 즉시 skipped/already-running 을 반환한다", async () => {
    cookieFixtureBox.current = [
      { name: "acc_token", value: LONG_TOKEN, domain: "account.weverse.io" },
    ];
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 1 } }]);
    const service = new AuthService(new ApiAuthClient(fetchFn));

    const first = service.runAccountTokenLadderSpike("first");
    const second = await service.runAccountTokenLadderSpike("second");

    expect(second).toEqual({
      verdict: "skipped",
      tokenSource: "none",
      ladderSource: null,
      fanId: null,
      reason: "already-running",
    });

    await first;
  });

  it("멱등: 연속 2회 호출해도 BrowserWindow 목이 0회 호출되고, by-credentials(로그인) 요청이 0건이다", async () => {
    cookieFixtureBox.current = [
      { name: "acc_token", value: LONG_TOKEN, domain: "account.weverse.io" },
    ];
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 1 } }]);
    const service = new AuthService(new ApiAuthClient(fetchFn));

    await service.runAccountTokenLadderSpike("call-1");
    await service.runAccountTokenLadderSpike("call-2");

    expect(vi.mocked(BrowserWindow).mock.calls.length).toBe(0);

    const mock = fetchFn as unknown as ReturnType<typeof vi.fn>;
    const urlsCalled = mock.mock.calls.map((c) => String(c[0]));
    expect(urlsCalled.some((u) => u.includes("by-credentials"))).toBe(false);
  });

  it("비침습: 스파이크 호출 전후로 authService.token 값이 변하지 않는다", async () => {
    cookieFixtureBox.current = [
      { name: "acc_token", value: LONG_TOKEN, domain: "account.weverse.io" },
    ];
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 1 } }]);
    const service = new AuthService(new ApiAuthClient(fetchFn));

    const before = service.token;
    await service.runAccountTokenLadderSpike("test");
    const after = service.token;

    expect(after).toBe(before);
  });

  it("CDP 후보만 있고 쿠키 후보가 없으면 tokenSource=cdp 로 사다리를 태운다", async () => {
    cookieFixtureBox.current = [];
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 55 } }]);
    const service = new AuthService(new ApiAuthClient(fetchFn));
    (service as unknown as { accountTokenCapture: unknown }).accountTokenCapture = {
      getCapturedAccessToken: () => "b".repeat(150),
      sawResponse: true,
      detachReason: null,
    };

    const result = await service.runAccountTokenLadderSpike("test");

    expect(result.verdict).toBe("pass");
    expect(result.tokenSource).toBe("cdp");
    expect(result.ladderSource).toBe("direct");
    expect(result.fanId).toBe(55);
  });

  it("쿠키 후보와 CDP 후보가 둘 다 있으면 쿠키가 우선한다", async () => {
    cookieFixtureBox.current = [
      { name: "acc_token", value: LONG_TOKEN, domain: "account.weverse.io" },
    ];
    const fetchFn = makeFetchQueue([{ status: 200, body: { fanId: 77 } }]);
    const service = new AuthService(new ApiAuthClient(fetchFn));
    (service as unknown as { accountTokenCapture: unknown }).accountTokenCapture = {
      getCapturedAccessToken: () => "cdp-should-not-be-used".padEnd(150, "z"),
      sawResponse: true,
      detachReason: null,
    };

    const result = await service.runAccountTokenLadderSpike("test");

    expect(result.tokenSource).toBe("cookie");
  });
});

// ── attachAccountTokenCapture (CDP 배선, Task 2) ────────────────────────────

describe("AuthService.attachAccountTokenCapture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeFakeWin(overrides?: Partial<{ attach: () => void }>) {
    return {
      webContents: {
        debugger: {
          attach: overrides?.attach ?? vi.fn(),
          on: vi.fn(),
          sendCommand: vi.fn(async () => ({})),
        },
      },
    };
  }

  it("attach 실패는 예외를 던지지 않고 경고 로그 후 정상 반환한다 — 쿠키 경로만으로 계속 진행", () => {
    const service = new AuthService();
    const fakeWin = makeFakeWin({
      attach: () => {
        throw new Error("Another debugger is already attached to the WebContents");
      },
    });

    expect(() => {
      (service as unknown as { attachAccountTokenCapture: (win: unknown) => void }).attachAccountTokenCapture(
        fakeWin,
      );
    }).not.toThrow();
  });

  it("attach 성공 시 Network.enable 을 호출하고 message/detach 리스너를 등록한다", () => {
    const service = new AuthService();
    const fakeWin = makeFakeWin();

    (service as unknown as { attachAccountTokenCapture: (win: unknown) => void }).attachAccountTokenCapture(
      fakeWin,
    );

    const dbg = fakeWin.webContents.debugger;
    expect(dbg.attach).toHaveBeenCalledWith("1.3");
    expect(dbg.on).toHaveBeenCalledWith("detach", expect.any(Function));
    expect(dbg.on).toHaveBeenCalledWith("message", expect.any(Function));
    expect(dbg.sendCommand).toHaveBeenCalledWith("Network.enable");
  });
});

// ── 실패 안내 회귀 (Task 3, D-13/D-14/R010) ──────────────────────────────
//
// credentialLogin() 자체는 실제 헤드리스 BrowserWindow DOM 흐름 없이는 태울 수
// 없다(이 저장소에는 DOM 테스트 환경이 없다). 대신 credentialLogin() 이 내부적으로
// 위임하는 두 private 메서드(buildFailureResult / buildLadderFailureEvent)를 직접
// 호출하는 계약 테스트로 대체한다 — 마스킹을 적용하는 책임이 이 파일(auth-service.ts)에
// 있으므로(06-RESEARCH.md Pitfall 2), 마스킹 회귀 케이스는 반드시 여기서 검증한다.

interface PrivateFailureBuilders {
  buildFailureResult(
    rawSignal: string | null,
    overrideReason?: LoginFailureReason,
    overrideDetail?: string,
  ): CredentialLoginResult;
  buildLadderFailureEvent(detail: string): AuthEvent;
}

function asFailureBuilders(service: AuthService): PrivateFailureBuilders {
  return service as unknown as PrivateFailureBuilders;
}

const ALL_LOGIN_FAILURE_REASONS: LoginFailureReason[] = [
  "captcha",
  "form-error",
  "timeout",
  "network-error",
  "token-ladder-failed",
  "unknown",
];

describe("AuthService.buildFailureResult — DOM 신호 분류 + 마스킹 관문 (D-13/D-14/R010)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("캡차 신호(raw='captcha') → reason 'captcha' + 브라우저 로그인 전환 안내", () => {
    const service = new AuthService();
    const result = asFailureBuilders(service).buildFailureResult("captcha");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("captcha");
    expect(result.message).toContain("브라우저 로그인");
  });

  it("타임아웃 신호(raw='timeout') → reason 'timeout'", () => {
    const service = new AuthService();
    const result = asFailureBuilders(service).buildFailureResult("timeout");

    expect(result.reason).toBe("timeout");
  });

  it.each(ALL_LOGIN_FAILURE_REASONS)(
    "사유 '%s' 는 반증된 이메일 인증코드 서사(오지 않을 메일 안내)를 포함하지 않는다",
    (reason) => {
      const service = new AuthService();
      const result = asFailureBuilders(service).buildFailureResult(null, reason, "detail");

      expect(result.message).not.toMatch(/이메일로.*코드|인증코드가 발송|OTP/);
    },
  );

  it("토큰 형태 문자열을 담은 예외 detail 은 identifier 에 마스킹된 형태로만 남는다 (R010 회귀, T-06-17 계열)", () => {
    const service = new AuthService();
    const tokenLike = "a".repeat(150);
    const result = asFailureBuilders(service).buildFailureResult(
      null,
      "network-error",
      `accessToken=${tokenLike}`,
    );

    expect(result.identifier).toBeDefined();
    expect(result.identifier).not.toContain(tokenLike);
    expect(result.message).not.toContain(tokenLike);
  });

  it("폼 오류 message 에 토큰 형태 문자열이 섞여도 maskSensitive() 를 거쳐 원문이 남지 않는다 (R010 회귀)", () => {
    const service = new AuthService();
    const tokenLike = "a".repeat(50);
    const result = asFailureBuilders(service).buildFailureResult(
      null,
      "form-error",
      `accessToken=${tokenLike} 로그인 실패`,
    );

    expect(result.message).not.toContain(tokenLike);
  });

  it("캡차·타임아웃 사유의 반환 객체에는 identifier 속성 자체가 없다 (undefined 렌더링 차단)", () => {
    const service = new AuthService();
    expect("identifier" in asFailureBuilders(service).buildFailureResult("captcha")).toBe(false);
    expect("identifier" in asFailureBuilders(service).buildFailureResult("timeout")).toBe(false);
  });

  it("사다리 실패(token-ladder-failed) → 사다리 안내 문구 + identifier 보존", () => {
    const service = new AuthService();
    const result = asFailureBuilders(service).buildFailureResult(
      null,
      "token-ladder-failed",
      "ApiAuthError: rung1",
    );

    expect(result.message).toContain("서비스 이용에 필요한 토큰");
    expect(result.identifier).toBe("ApiAuthError: rung1");
  });
});

describe("AuthService.buildLadderFailureEvent — 사다리 실패가 사용자에게 도달한다 (D-12)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("login-failed 타입 이벤트를 반환하고 message 가 사다리 실패 안내 문구다", () => {
    const service = new AuthService();
    const event = asFailureBuilders(service).buildLadderFailureEvent("ApiAuthError: rung1");

    expect(event.type).toBe("login-failed");
    expect(event.message).toContain("서비스 이용에 필요한 토큰");
  });

  it("식별자가 문장 뒤에 마스킹된 형태로 병기된다 (비동기 이벤트 경로 — 구조화 필드 자리 없음)", () => {
    const service = new AuthService();
    const tokenLike = "b".repeat(150);
    const event = asFailureBuilders(service).buildLadderFailureEvent(`accessToken=${tokenLike}`);

    expect(event.message).toContain("(식별자:");
    expect(event.message).not.toContain(tokenLike);
  });
});
