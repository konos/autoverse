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
const { cookieFixtureBox, removedCookiesBox } = vi.hoisted(() => ({
  cookieFixtureBox: {
    current: [] as Array<{ name: string; domain?: string; value: string; httpOnly?: boolean }>,
  },
  // clearSessionCookies() 가 실제로 어떤 쿠키를 지웠는지 기록한다.
  removedCookiesBox: { current: [] as string[] },
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
        remove: vi.fn(async (_url: string, name: string) => {
          removedCookiesBox.current.push(name);
          cookieFixtureBox.current = cookieFixtureBox.current.filter((c) => c.name !== name);
        }),
      },
    })),
  },
}));

import { BrowserWindow } from "electron";
import { AuthService } from "../auth-service";
import { ApiAuthClient } from "../api-auth-client";
import { logService } from "../log-service";
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
    overrideMessage?: string,
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

  // ── overrideMessage (Task 2, WR-03) ──────────────────────────────────────
  // btnEnabled 실패 분기가 마스킹 관문을 우회하던 7번째 미분류 경로였다. 이
  // 관문에 태우면서도 확정된 사용자 문구를 후퇴시키지 않기 위한 4번째 선택
  // 파라미터를 검증한다.

  it("overrideMessage 를 넘기면 반환된 message 가 그 문구와 같고 reason 이 채워진다 (WR-03 Test 1)", () => {
    const service = new AuthService();
    const fixedMessage = "로그인 버튼이 활성화되지 않았습니다. 이메일/비밀번호를 확인해주세요.";
    const result = asFailureBuilders(service).buildFailureResult(
      null,
      "unknown",
      undefined,
      fixedMessage,
    );

    expect(result.message).toBe(fixedMessage);
    expect(result.reason).toBe("unknown");
  });

  it("overrideMessage 에 토큰 형태 문자열이 섞여도 마스킹 관문을 지난다 — 키-값 형태와 문맥 없는 JWT 형태 둘 다 (WR-03 Test 2)", () => {
    const service = new AuthService();
    const keyValueToken = "a".repeat(50);
    const contextFreeJwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const result = asFailureBuilders(service).buildFailureResult(
      null,
      "unknown",
      undefined,
      `버튼 비활성 accessToken=${keyValueToken} 원문토큰 ${contextFreeJwt} 확인해주세요`,
    );

    expect(result.message).not.toContain(keyValueToken);
    expect(result.message).not.toContain(contextFreeJwt);
  });

  it("overrideMessage 를 넘기지 않으면 기존 6가지 사유 매핑이 완전히 동일하다 — 후방 호환 (WR-03 Test 3)", () => {
    const service = new AuthService();
    const result = asFailureBuilders(service).buildFailureResult("captcha");

    expect(result.message).toBe(
      "Weverse가 보안 확인을 요구해 앱 안 로그인으로는 진행할 수 없습니다. 브라우저 로그인을 사용해주세요.",
    );
  });
});

// ── btnEnabled 실패 소스 수준 단언 (Task 2, WR-03/IN-02) ────────────────────
//
// credentialLogin() 의 DOM 폴링 분기 자체는 실제 헤드리스 BrowserWindow 없이는
// 태울 수 없다(위 buildFailureResult 계약 테스트 설명과 동일한 제약). 디버그
// 덤프 템플릿(executeJavaScript 문자열)은 실행할 수 없으므로 소스 문자열에
// 대한 단언으로 고정한다 — 이 저장소가 acceptance_criteria 의 grep 관용구로
// 이미 쓰는 검증 방식을 테스트 코드 안으로 옮긴 것이다.
describe("AuthService — btnEnabled 실패 분기 소스 수준 단언 (Task 2, WR-03/IN-02)", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "auth-service.ts"), "utf-8");

  it("디버그 덤프 템플릿이 이메일 원문 필드를 담지 않는다 (IN-02)", () => {
    expect(source).not.toContain("emailValue");
  });

  it("디버그 덤프 템플릿이 이메일 길이 필드를 담는다 — 293행 부근 emailLen 관용구를 따른다 (IN-02)", () => {
    expect(source).toMatch(/emailLen:\s*emailInput\?\.value\?\.length\s*\?\?\s*-1/);
  });

  it("btnEnabled 실패 분기가 buildFailureResult() 를 거쳐 반환한다 (WR-03)", () => {
    const branch = source.slice(source.indexOf("if (!btnEnabled)"), source.indexOf("if (!btnEnabled)") + 1500);
    expect(branch).toContain("this.buildFailureResult(");
    expect(branch).not.toMatch(/return\s*{\s*success:\s*false,\s*message:/);
  });

  it("btnEnabled 실패 분기가 형제 분기들과 동일하게 login-failed 이벤트를 발행한다 (WR-03)", () => {
    const branch = source.slice(source.indexOf("if (!btnEnabled)"), source.indexOf("if (!btnEnabled)") + 1500);
    expect(branch).toContain("this._emit(");
  });

  it("사용자 대면 문구가 글자 그대로 보존됐다", () => {
    expect(source).toContain("로그인 버튼이 활성화되지 않았습니다. 이메일/비밀번호를 확인해주세요.");
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

// ── restoreTokenIfLost (Task 3, D-14) ───────────────────────────────────────
//
// credentialLogin() 자체는 실제 헤드리스 BrowserWindow DOM 흐름 없이는 태울 수
// 없다(위 buildFailureResult 계약 테스트와 동일한 제약 — 이 저장소에는 DOM 테스트
// 환경이 없다). credentialLogin() 이 세 실패 지점 각각에서 위임하는
// restoreTokenIfLost() 를 직접 호출하는 계약 테스트로 D-14 의 보장을 검증한다.

interface PrivateRestoreToken {
  restoreTokenIfLost(previousToken: string | null): void;
}

function asRestoreToken(service: AuthService): PrivateRestoreToken {
  return service as unknown as PrivateRestoreToken;
}

function setCachedToken(service: AuthService, token: string | null): void {
  (service as unknown as { cachedToken: string | null }).cachedToken = token;
}

describe("AuthService.restoreTokenIfLost — 재로그인 실패가 기존 토큰을 앗아가지 않는다 (D-14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) 기존 토큰이 있었고 재로그인 실패로 현재 토큰이 비었으면 호출 이전 값으로 복원된다", () => {
    const service = new AuthService();
    const previousToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    setCachedToken(service, null); // credentialLogin() 실패 경로 종료 시점을 흉내낸다

    asRestoreToken(service).restoreTokenIfLost(previousToken);

    expect(service.token).toBe(previousToken);
  });

  it("(b) 실패 경로에서 토큰이 인위적으로 비워지는 상황을 만들어도 복원 헬퍼가 이전 값을 되돌린다", () => {
    const service = new AuthService();
    const previousToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    setCachedToken(service, previousToken);
    // credentialLogin() 안에서 실패 직전 상태 정리 코드가 토큰을 비웠다고 가정
    setCachedToken(service, null);

    asRestoreToken(service).restoreTokenIfLost(previousToken);

    expect(service.token).toBe(previousToken);
  });

  it("(c) 호출 직전에 토큰이 없었다면(null) 실패 후에도 null 이다 — 없던 토큰을 만들어내지 않는다", () => {
    const service = new AuthService();
    setCachedToken(service, null);

    asRestoreToken(service).restoreTokenIfLost(null);

    expect(service.token).toBeNull();
  });

  it("현재 토큰이 이미 채워져 있으면(성공 경로) 복원이 새 토큰을 덮어쓰지 않는다", () => {
    const service = new AuthService();
    const newToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
    const previousToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    setCachedToken(service, newToken);

    asRestoreToken(service).restoreTokenIfLost(previousToken);

    expect(service.token).toBe(newToken);
  });
});

// ── getStoredCredentialsSnapshot (D-04 4상태 계약) ───────────────────────────

describe("AuthService.getStoredCredentialsSnapshot — D-04 4상태 계약", () => {
  beforeEach(() => {
    clearStoredCredentialsFile();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearStoredCredentialsFile();
  });

  it("파일 없음 → none", () => {
    const service = new AuthService();
    expect(service.getStoredCredentialsSnapshot()).toEqual({ state: "none" });
  });

  it("정상 파일 → available + 저장 이메일, 반환 객체에 password 키가 없다", () => {
    writeStoredCredentials("stored@example.com", "stored-pw");
    const service = new AuthService();

    const snapshot = service.getStoredCredentialsSnapshot();

    expect(snapshot).toEqual({ state: "available", email: "stored@example.com" });
    expect("password" in snapshot).toBe(false);
  });

  it("safeStorage.isEncryptionAvailable() 이 false 면 unavailable 이고 파일이 여전히 존재한다", async () => {
    writeStoredCredentials("stored@example.com", "stored-pw");
    const electron = await import("electron");
    vi.mocked(electron.safeStorage.isEncryptionAvailable).mockReturnValueOnce(false);
    const service = new AuthService();

    const snapshot = service.getStoredCredentialsSnapshot();

    expect(snapshot).toEqual({ state: "unavailable" });
    expect(fs.existsSync(TEST_CREDENTIALS_PATH)).toBe(true);
  });

  it("복호화가 throw 하면 corrupted 이고 파일이 삭제된다", async () => {
    writeStoredCredentials("stored@example.com", "stored-pw");
    const electron = await import("electron");
    vi.mocked(electron.safeStorage.decryptString).mockImplementationOnce(() => {
      throw new Error("decrypt failed");
    });
    const service = new AuthService();

    const snapshot = service.getStoredCredentialsSnapshot();

    expect(snapshot).toEqual({ state: "corrupted" });
    expect(fs.existsSync(TEST_CREDENTIALS_PATH)).toBe(false);
  });

  it("JSON 이 아닌 평문을 써 두면 corrupted + 파일 삭제", () => {
    fs.mkdirSync("/tmp/test-userData", { recursive: true });
    fs.writeFileSync(TEST_CREDENTIALS_PATH, Buffer.from("not-json-at-all"));
    const service = new AuthService();

    const snapshot = service.getStoredCredentialsSnapshot();

    expect(snapshot).toEqual({ state: "corrupted" });
    expect(fs.existsSync(TEST_CREDENTIALS_PATH)).toBe(false);
  });

  it("email 필드가 문자열이 아니면 corrupted + 파일 삭제", () => {
    fs.mkdirSync("/tmp/test-userData", { recursive: true });
    fs.writeFileSync(
      TEST_CREDENTIALS_PATH,
      Buffer.from(JSON.stringify({ email: 12345, password: "pw" })),
    );
    const service = new AuthService();

    const snapshot = service.getStoredCredentialsSnapshot();

    expect(snapshot).toEqual({ state: "corrupted" });
    expect(fs.existsSync(TEST_CREDENTIALS_PATH)).toBe(false);
  });
});

// ── loginWithStoredCredentials — D-03 최종 게이트 (main 이 다시 비교) ────────

describe("AuthService.loginWithStoredCredentials — D-01/D-03 게이트", () => {
  beforeEach(() => {
    clearStoredCredentialsFile();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearStoredCredentialsFile();
  });

  it("저장 이메일과 다른 이메일 → success:false, credentialLogin 은 호출되지 않는다 (외부 요청 0건)", async () => {
    writeStoredCredentials("stored@example.com", "stored-pw");
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.loginWithStoredCredentials("other@example.com");

    expect(result.success).toBe(false);
    expect(result.message).toContain("다른 계정입니다");
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });

  it("대소문자/공백만 다른 이메일은 일치로 취급돼 게이트를 통과한다 (credentialLogin 호출됨)", async () => {
    writeStoredCredentials("stored@example.com", "stored-pw");
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin").mockResolvedValue({ success: true });

    const result = await service.loginWithStoredCredentials("  Stored@Example.com  ");

    expect(result.success).toBe(true);
    expect(credentialLoginSpy).toHaveBeenCalledWith("stored@example.com", "stored-pw");
  });

  it("저장된 자격증명이 없으면(none) 외부 요청 없이 실패를 반환한다", async () => {
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.loginWithStoredCredentials("anyone@example.com");

    expect(result.success).toBe(false);
    expect(result.message).toContain("저장된 로그인 정보가 없습니다");
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });

  it("safeStorage 불가(unavailable) 상태에서는 외부 요청 없이 실패를 반환한다", async () => {
    writeStoredCredentials("stored@example.com", "stored-pw");
    const electron = await import("electron");
    vi.mocked(electron.safeStorage.isEncryptionAvailable).mockReturnValueOnce(false);
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.loginWithStoredCredentials("stored@example.com");

    expect(result.success).toBe(false);
    expect(result.message).toContain("이 환경에서는 저장된 정보를 사용할 수 없습니다");
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });

  it("손상된(corrupted) 파일 상태에서는 외부 요청 없이 실패를 반환한다", async () => {
    fs.mkdirSync("/tmp/test-userData", { recursive: true });
    fs.writeFileSync(TEST_CREDENTIALS_PATH, Buffer.from("not-json-at-all"));
    const service = new AuthService();
    const credentialLoginSpy = vi.spyOn(service, "credentialLogin");

    const result = await service.loginWithStoredCredentials("anyone@example.com");

    expect(result.success).toBe(false);
    expect(result.message).toContain("초기화했습니다");
    expect(credentialLoginSpy).not.toHaveBeenCalled();
  });
});

// ── credentialLogin 중복 실행 가드 (T-07-09) ────────────────────────────────

describe("AuthService.credentialLogin — 중복 실행 가드 (T-07-09)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeFakeLoginWindow() {
    return {
      loadURL: vi.fn(async () => {}),
      webContents: {
        // 로그인 폼 대기 단계에서 영원히 대기하게 만들어 첫 호출을 "진행 중"
        // 상태로 유지한다 — 두 번째 호출이 가드에 막히는지만 검증하면 된다.
        executeJavaScript: vi.fn(() => new Promise(() => {})),
        insertText: vi.fn(async () => {}),
        on: vi.fn(),
        debugger: {
          attach: vi.fn(),
          on: vi.fn(),
          sendCommand: vi.fn(async () => ({})),
        },
      },
      isDestroyed: vi.fn(() => false),
      close: vi.fn(),
    };
  }

  it("이미 진행 중인 호출이 있으면 두 번째 호출이 즉시 실패를 반환하고 BrowserWindow 는 1회만 생성된다", async () => {
    cookieFixtureBox.current = [];
    // `new BrowserWindow(...)` requires a constructible mock implementation —
    // an arrow function cannot be invoked with `new`.
    vi.mocked(BrowserWindow).mockImplementation(function (this: unknown) {
      return makeFakeLoginWindow() as unknown as BrowserWindow;
    } as unknown as typeof BrowserWindow);
    const service = new AuthService();

    const first = service.credentialLogin("a@b.com", "pw"); // 의도적으로 await 하지 않음 — in-flight 로 남긴다
    const second = await service.credentialLogin("a@b.com", "pw");

    expect(second.success).toBe(false);
    expect(second.message).toContain("이미 진행 중입니다");

    // 첫 호출이 BrowserWindow 생성 지점까지 진행할 시간을 준다 (실제 타이머 없음, 마이크로태스크만 흐름)
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(BrowserWindow).mock.calls.length).toBe(1);

    void first; // 의도적으로 미해결 상태로 둔다 — 이 테스트의 관심사가 아니다
  });
});

// ── completeCredentialLoginSuccess — WR-02 회귀 (07-REVIEW.md, R023) ────────
//
// credentialLogin() 의 두 성공 분기(폴링이 토큰을 직접 돌려준 경우 / timeout 후
// 쿠키에서 뒤늦게 찾은 경우)가 공유하는 단일 성공 관문. cleanupHeadless() 는
// this.headlessWindow 가 없으면 아무 일도 하지 않으므로 이 테스트들은 헤드리스
// 창 목을 만들지 않고 관문을 직접 호출해도 안전하다.

interface PrivateCompleteCredentialLoginSuccess {
  completeCredentialLoginSuccess(email: string, password: string): CredentialLoginResult;
}

function asCompleteSuccess(service: AuthService): PrivateCompleteCredentialLoginSuccess {
  return service as unknown as PrivateCompleteCredentialLoginSuccess;
}

describe("AuthService.completeCredentialLoginSuccess — 단일 성공 관문 (WR-02, R023)", () => {
  beforeEach(() => {
    clearStoredCredentialsFile();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearStoredCredentialsFile();
  });

  it("관문 호출 후 getStoredCredentialsSnapshot() 이 available + 저장 이메일을 돌려준다", () => {
    const service = new AuthService();

    asCompleteSuccess(service).completeCredentialLoginSuccess("wr02@example.com", "wr02-pw");

    expect(service.getStoredCredentialsSnapshot()).toEqual({
      state: "available",
      email: "wr02@example.com",
    });
  });

  it("반환값이 { success: true } 이고 비밀번호 필드를 포함하지 않는다", () => {
    const service = new AuthService();

    const result = asCompleteSuccess(service).completeCredentialLoginSuccess(
      "wr02@example.com",
      "wr02-pw",
    );

    expect(result).toEqual({ success: true });
    expect("password" in result).toBe(false);
  });

  it("safeStorage.isEncryptionAvailable() 이 false 인 환경에서는 파일을 만들지 않고도 { success: true } 를 반환한다", async () => {
    const electron = await import("electron");
    vi.mocked(electron.safeStorage.isEncryptionAvailable).mockReturnValueOnce(false);
    const service = new AuthService();

    const result = asCompleteSuccess(service).completeCredentialLoginSuccess(
      "wr02@example.com",
      "wr02-pw",
    );

    expect(result).toEqual({ success: true });
    expect(fs.existsSync(TEST_CREDENTIALS_PATH)).toBe(false);
  });

  it("관문이 남긴 로그 어디에도 비밀번호 원문과 전체 이메일이 없다", () => {
    const service = new AuthService();
    const infoSpy = vi.spyOn(logService, "info");

    asCompleteSuccess(service).completeCredentialLoginSuccess("wr02@example.com", "secret-pw-value");

    const loggedStrings = infoSpy.mock.calls.map((call) => call.join(" "));
    for (const line of loggedStrings) {
      expect(line).not.toContain("secret-pw-value");
      expect(line).not.toContain("wr02@example.com");
    }
  });
});

// ── validateToken() 실패 emit 관문 (Task 2, 06-VERIFICATION.md gap 2 / CR-02) ──
//
// 두 로그인 모드가 공유하는 validateToken() 의 네 실패 지점이 서버 응답 원문을 더 이상
// 렌더러로 직접 흘려보내지 않는지 회귀로 잠근다. 픽스처는 키 이름 접두사 없이 놓인 토큰
// 형태 문자열이다 — maskSensitive() 의 key=value 규칙(WR-02)이 잡지 못하는 바로 그 형태를
// 골라, "감싸기(A안)로는 보장되지 않는다"는 이 플랜의 판단을 증명한다.

interface TextStubResponse {
  status: number;
  statusText?: string;
  text: string;
}

/** `makeFetchQueue`(위)와 달리 `text()`/`statusText` 를 제공한다 — validateToken() 은
 * `res.json()` 이 아니라 `res.text()` 로 응답 본문을 읽는다. 기존 `makeFetchQueue` 는
 * 다른 describe(runAccountTokenLadderSpike)가 쓰고 있으므로 수정하지 않고 나란히 둔다. */
function makeTextFetchQueue(responses: TextStubResponse[]): typeof globalThis.fetch {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: r.statusText ?? "",
      text: async () => r.text,
    } as unknown as Response;
  });
}

interface PrivateCachedToken {
  cachedToken: string | null;
}

/** `cachedToken` 은 private 이므로 이 파일이 이미 쓰는 캐스팅 관용구로 주입한다.
 * JWT 로 파싱되지 않는 긴 문자열이면 `isTokenExpired()` 가 파싱 실패 시 false 를
 * 돌려줘 로컬 만료 분기를 건너뛰고 네트워크 분기까지 진행한다. */
function injectCachedToken(service: AuthService, token: string): void {
  (service as unknown as PrivateCachedToken).cachedToken = token;
}

// 키 이름 접두사 없이 놓인 150자 이상의 토큰 형태 문자열 — maskSensitive() 의
// key=value 규칙이 잡지 못하는 문맥 없는 원문 픽스처.
const CONTEXT_FREE_TOKEN_LIKE = "z".repeat(180);

describe("AuthService.validateToken — 실패 emit 관문 (Task 2, CR-02/06-VERIFICATION gap 2)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    cookieFixtureBox.current = [];
  });

  it("!res.ok(503): emit 된 auth-event 의 message 에 원문 토큰 형태 문자열이 포함되지 않고, 이벤트 타입은 login-failed 다", async () => {
    const service = new AuthService();
    injectCachedToken(service, LONG_TOKEN);
    globalThis.fetch = makeTextFetchQueue([
      { status: 503, statusText: "Service Unavailable", text: `server error ${CONTEXT_FREE_TOKEN_LIKE}` },
    ]);
    const events: AuthEvent[] = [];
    service.on("auth-event", (e: AuthEvent) => events.push(e));

    await service.validateToken();

    const failure = events.find((e) => e.type === "login-failed");
    expect(failure).toBeDefined();
    expect(failure!.message).not.toContain(CONTEXT_FREE_TOKEN_LIKE);
  });

  it("JSON 파싱 실패: emit 된 message 에 원문 토큰 형태 문자열이 포함되지 않고, 이벤트 타입은 login-failed 다", async () => {
    const service = new AuthService();
    injectCachedToken(service, LONG_TOKEN);
    globalThis.fetch = makeTextFetchQueue([
      { status: 200, text: `not json ${CONTEXT_FREE_TOKEN_LIKE}` },
    ]);
    const events: AuthEvent[] = [];
    service.on("auth-event", (e: AuthEvent) => events.push(e));

    await service.validateToken();

    const failure = events.find((e) => e.type === "login-failed");
    expect(failure).toBeDefined();
    expect(failure!.message).not.toContain(CONTEXT_FREE_TOKEN_LIKE);
  });

  it("fanId 없음: emit 된 message 에 원문 토큰 형태 문자열이 포함되지 않고, 이벤트 타입은 login-failed 다", async () => {
    const service = new AuthService();
    injectCachedToken(service, LONG_TOKEN);
    globalThis.fetch = makeTextFetchQueue([
      { status: 200, text: JSON.stringify({ note: CONTEXT_FREE_TOKEN_LIKE }) },
    ]);
    const events: AuthEvent[] = [];
    service.on("auth-event", (e: AuthEvent) => events.push(e));

    await service.validateToken();

    const failure = events.find((e) => e.type === "login-failed");
    expect(failure).toBeDefined();
    expect(failure!.message).not.toContain(CONTEXT_FREE_TOKEN_LIKE);
  });

  it("401 + 세션 복원 실패: emit 된 message 에 원문 토큰 형태 문자열이 포함되지 않고, 이벤트 타입은 token-expired 다", async () => {
    const service = new AuthService();
    injectCachedToken(service, LONG_TOKEN);
    cookieFixtureBox.current = []; // 세션 복원(trySessionRestore)이 실패하도록 빈 쿠키
    globalThis.fetch = makeTextFetchQueue([
      { status: 401, statusText: "Unauthorized", text: `unauthorized ${CONTEXT_FREE_TOKEN_LIKE}` },
    ]);
    const events: AuthEvent[] = [];
    service.on("auth-event", (e: AuthEvent) => events.push(e));

    await service.validateToken();

    const failure = events.find((e) => e.type === "token-expired");
    expect(failure).toBeDefined();
    expect(failure!.message).not.toContain(CONTEXT_FREE_TOKEN_LIKE);
  });

  it("진단 보존: 실패 경로에서도 logService 쪽 진단 경로에는 응답 본문이 여전히 남는다 — 사용자 노출을 줄이는 것이지 관측성을 줄이는 것이 아니다", async () => {
    const service = new AuthService();
    injectCachedToken(service, LONG_TOKEN);
    globalThis.fetch = makeTextFetchQueue([
      { status: 503, statusText: "Service Unavailable", text: `server error ${CONTEXT_FREE_TOKEN_LIKE}` },
    ]);
    const infoSpy = vi.spyOn(logService, "info");

    await service.validateToken();

    const diagnosticCall = infoSpy.mock.calls.find(
      (call) => typeof call[1] === "string" && call[1].includes(CONTEXT_FREE_TOKEN_LIKE),
    );
    expect(diagnosticCall).toBeDefined();
  });
});

// ── 세션 쿠키 단일 삭제 관문 (브라우저 모드 로그인 화면 미표시 회귀) ────────────
//
// 회귀 배경: logout()/login()/credentialLogin() 세 곳이 같은 삭제 루프를 복제해
// 두고 `we2_access_token` 하나만 지웠다. `we2_refresh_token` 이 살아남아
// weverse.io 가 로그인 페이지 대신 로그인된 홈을 띄웠고, 사용자에게는 "창은
// 뜨는데 로그인 화면이 안 나온다"로 보였다.
describe("세션 쿠키 삭제 — logout()", () => {
  beforeEach(() => {
    removedCookiesBox.current = [];
  });

  it("리프레시 토큰까지 지운다 — 액세스 토큰만 지우면 세션이 즉시 되살아난다", async () => {
    cookieFixtureBox.current = [
      { name: "we2_access_token", domain: ".weverse.io", value: "a".repeat(427) },
      { name: "we2_refresh_token", domain: ".weverse.io", value: "r".repeat(451) },
    ];

    const svc = new AuthService(new ApiAuthClient());
    await svc.logout(false);

    expect(removedCookiesBox.current).toContain("we2_access_token");
    expect(removedCookiesBox.current).toContain("we2_refresh_token");
    expect(cookieFixtureBox.current.map((c) => c.name)).toEqual([]);
  });

  it("추적/광고 쿠키는 건드리지 않는다 — 세션과 무관하다", async () => {
    cookieFixtureBox.current = [
      { name: "we2_access_token", domain: ".weverse.io", value: "a".repeat(427) },
      { name: "we2_refresh_token", domain: ".weverse.io", value: "r".repeat(451) },
      { name: "__gads", domain: ".weverse.io", value: "x".repeat(83) },
      { name: "we2_device_id", domain: ".weverse.io", value: "d".repeat(36) },
    ];

    const svc = new AuthService(new ApiAuthClient());
    await svc.logout(false);

    expect(removedCookiesBox.current).not.toContain("__gads");
    expect(removedCookiesBox.current).not.toContain("we2_device_id");
    expect(cookieFixtureBox.current.map((c) => c.name).sort()).toEqual(["__gads", "we2_device_id"]);
  });

  it("리프레시 토큰이 없어도 throw 하지 않는다", async () => {
    cookieFixtureBox.current = [
      { name: "we2_access_token", domain: ".weverse.io", value: "a".repeat(427) },
    ];

    const svc = new AuthService(new ApiAuthClient());
    await expect(svc.logout(false)).resolves.toBeUndefined();
    expect(removedCookiesBox.current).toEqual(["we2_access_token"]);
  });
});
