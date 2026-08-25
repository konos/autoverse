/**
 * ApiAuthClient — pure HTTP client for the Weverse account API.
 *
 * Implements the 3-step credential login (otp-sessions → by-credentials →
 * by-credentials-with-otp) plus the account→fanevent token ladder (R019):
 *   rung 1: try the account token directly against /fans/me
 *   rung 2: exchange via by-access-token, then retry /fans/me
 *
 * This module never imports the electron package and never touches
 * Electron's session/cookies APIs — it must stay independent of the
 * "persist:weverse" cookie partition used by the headless browser login
 * path (Pitfall 4, T-05-05).
 */
import { maskToken } from "../../shared/mask";
import { logService } from "./log-service";

const ACCOUNT_API_BASE = "https://accountapi.weverse.io/web/api";
const FANS_ME_URL = "https://fanevent-v2.weverse.io/api/fan-api/v1/fans/me";
const ACCOUNT_TIMEOUT_MS = 10_000;
const TARGET_SERVICE_ID = "weverse";

// PROJECT.md's verified contract only lists the field name, not the value.
// 0 (session-lifetime cookie) is sent first; if the server rejects it with
// -26000, the Task 3 checkpoint retries once with 2592000 (30 days).
const REFRESH_TOKEN_COOKIE_TTL = 0;

export class ApiAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

export interface OtpSession {
  otpSessionId: string;
  expiresIn?: number;
}

export interface AccountTokens {
  accessToken: string;
  refreshToken?: string;
  serviceUserId?: string;
  expiresIn?: number;
}

export type FaneventTokenSource = "direct" | "exchange";

export interface FaneventToken {
  token: string;
  source: FaneventTokenSource;
  fanId: number;
}

export class ApiAuthClient {
  private readonly fetch: typeof globalThis.fetch;

  constructor(fetchFn: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  // ── Header/fetch plumbing ────────────────────────────────────────────

  private accountHeaders(): Record<string, string> {
    return {
      "X-ACC-APP-VERSION": "4.7.1",
      "X-ACC-APP-SECRET": "5419526f1c624b38b10787e5c10b2a7a",
      "X-ACC-SERVICE-ID": TARGET_SERVICE_ID,
      "X-ACC-LANGUAGE": "ko",
      "X-ACC-TRACE-ID": crypto.randomUUID(),
      "Content-Type": "application/json",
    };
  }

  private timedFetch(
    url: string,
    init: RequestInit,
    timeoutMs = ACCOUNT_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return this.fetch(url, { ...init, signal: controller.signal }).finally(
      () => clearTimeout(timer),
    );
  }

  private async postAccount<T>(
    path: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${ACCOUNT_API_BASE}${path}`;
    let res: Response;
    try {
      res = await this.timedFetch(url, {
        method: "POST",
        headers: { ...this.accountHeaders(), ...extraHeaders },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "네트워크 타임아웃"
          : `네트워크 에러: ${String(err)}`;
      logService.error("ApiAuthClient", `postAccount ${path} error: ${msg}`);
      throw new ApiAuthError("NETWORK_ERROR", msg);
    }

    if (!res.ok) {
      let errBody: unknown;
      try {
        errBody = await res.json();
      } catch {
        throw new ApiAuthError(
          "HTTP_ERROR",
          `계정 API 실패: HTTP ${res.status}`,
          res.status,
        );
      }
      const code =
        errBody && typeof errBody === "object" && "code" in errBody
          ? String((errBody as Record<string, unknown>).code)
          : "HTTP_ERROR";
      const message =
        errBody && typeof errBody === "object" && "message" in errBody
          ? String((errBody as Record<string, unknown>).message)
          : `계정 API 실패: HTTP ${res.status}`;
      logService.error(
        "ApiAuthClient",
        `postAccount ${path} failed status=${res.status} code=${code} message=${message}`,
      );
      throw new ApiAuthError(code, message, res.status);
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiAuthError("PARSE_ERROR", `${path} 응답 JSON 파싱 실패`);
    }
  }

  // ── Public login steps ───────────────────────────────────────────────

  async requestOtpSession(email: string): Promise<OtpSession> {
    logService.info("ApiAuthClient", `requestOtpSession email=${email.slice(0, 3)}***`);
    const raw = await this.postAccount<Record<string, unknown>>("/v2/auth/otp-sessions", { email });

    // Observability (05-01 결함 B): 응답 스키마가 가정과 다르면 조용히 undefined
    // 를 by-credentials 로 흘려보내는 대신, 여기서 즉시 드러낸다. 키 이름과
    // 존재여부/길이만 로그에 남기고 otpSessionId 값 자체나 이메일 전체는 남기지
    // 않는다. expiresIn 은 민감정보가 아니므로 값을 그대로 남긴다.
    const keys = raw && typeof raw === "object" ? Object.keys(raw) : [];
    const otpSessionIdValue = raw && typeof raw === "object" ? raw.otpSessionId : undefined;
    const hasOtpSessionId = typeof otpSessionIdValue === "string" && otpSessionIdValue.length > 0;
    const expiresIn = raw && typeof raw === "object" ? raw.expiresIn : undefined;
    logService.info(
      "ApiAuthClient",
      `requestOtpSession response keys=[${keys.join(",")}] hasOtpSessionId=${hasOtpSessionId} otpSessionIdLen=${hasOtpSessionId ? (otpSessionIdValue as string).length : 0} expiresIn=${expiresIn ?? "absent"}`,
    );

    if (!hasOtpSessionId) {
      logService.error(
        "ApiAuthClient",
        "requestOtpSession: otpSessionId missing or not a non-empty string — refusing to proceed to by-credentials",
      );
      throw new ApiAuthError(
        "OTP_SESSION_MALFORMED",
        "OTP 세션 응답에 otpSessionId 가 없습니다 — 서버 응답 스키마가 예상과 다릅니다",
      );
    }

    return {
      otpSessionId: otpSessionIdValue as string,
      expiresIn: typeof expiresIn === "number" ? expiresIn : undefined,
    };
  }

  async loginWithCredentials(
    email: string,
    password: string,
    otpSessionId: string,
  ): Promise<AccountTokens> {
    return this.postAccount<AccountTokens>("/v4/auth/token/by-credentials", {
      email,
      password,
      otpSessionId,
    });
  }

  async verifyOtp(
    email: string,
    password: string,
    otpSessionId: string,
    otpCode: string,
  ): Promise<AccountTokens> {
    return this.postAccount<AccountTokens>(
      "/v3/auth/token/by-credentials-with-otp",
      {
        email,
        password,
        otpSessionId,
        otpCode,
        refreshTokenCookieTtl: REFRESH_TOKEN_COOKIE_TTL,
      },
    );
  }

  async exchangeForService(
    accountAccessToken: string,
    targetServiceId: string = TARGET_SERVICE_ID,
    departureServiceId: string = TARGET_SERVICE_ID,
  ): Promise<AccountTokens> {
    logService.info(
      "ApiAuthClient",
      `exchangeForService departure=${departureServiceId} target=${targetServiceId}`,
    );
    return this.postAccount<AccountTokens>(
      "/v2/auth/token/by-access-token",
      { targetServiceId },
      {
        Authorization: `Bearer ${accountAccessToken}`,
        "X-ACC-SERVICE-ID": departureServiceId,
      },
    );
  }

  async probeFaneventToken(token: string): Promise<number | null> {
    let res: Response;
    try {
      res = await this.timedFetch(FANS_ME_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-FEV-APP-SOURCE": "FAN_EVENT",
          Accept: "application/json, text/plain, */*",
        },
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "네트워크 타임아웃"
          : `네트워크 에러: ${String(err)}`;
      logService.error("ApiAuthClient", `probeFaneventToken error: ${msg}`);
      throw new ApiAuthError("NETWORK_ERROR", msg);
    }

    if (res.status === 401) {
      return null;
    }

    if (!res.ok) {
      throw new ApiAuthError(
        "HTTP_ERROR",
        `팬이벤트 토큰 확인 실패: HTTP ${res.status}`,
        res.status,
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ApiAuthError("PARSE_ERROR", "/fans/me 응답 JSON 파싱 실패");
    }

    if (
      body &&
      typeof body === "object" &&
      "fanId" in body &&
      typeof (body as Record<string, unknown>).fanId === "number"
    ) {
      return (body as Record<string, unknown>).fanId as number;
    }
    return null;
  }

  // ── Ladder ────────────────────────────────────────────────────────────

  /**
   * R019 ladder: try the account token directly against /fans/me (rung 1),
   * and only if that fails (401), exchange it via by-access-token and
   * retry (rung 2). Never swallows a total failure — a caller that gets
   * FANEVENT_TOKEN_UNAVAILABLE must treat the whole login as failed
   * (Pitfall 5).
   */
  async acquireFaneventToken(accountAccessToken: string): Promise<FaneventToken> {
    logService.info(
      "ApiAuthClient",
      `acquireFaneventToken rung1(direct) token=${maskToken(accountAccessToken)}`,
    );
    const directFanId = await this.probeFaneventToken(accountAccessToken);
    if (directFanId !== null) {
      logService.info("ApiAuthClient", `acquireFaneventToken rung1 succeeded fanId=${directFanId}`);
      return { token: accountAccessToken, source: "direct", fanId: directFanId };
    }

    logService.info("ApiAuthClient", "acquireFaneventToken rung1 failed(401) — trying rung2(exchange)");
    const exchanged = await this.exchangeForService(accountAccessToken);
    const exchangedFanId = await this.probeFaneventToken(exchanged.accessToken);
    if (exchangedFanId !== null) {
      logService.info(
        "ApiAuthClient",
        `acquireFaneventToken rung2 succeeded fanId=${exchangedFanId} token=${maskToken(exchanged.accessToken)}`,
      );
      return { token: exchanged.accessToken, source: "exchange", fanId: exchangedFanId };
    }

    logService.error("ApiAuthClient", "acquireFaneventToken: both rungs returned 401");
    throw new ApiAuthError(
      "FANEVENT_TOKEN_UNAVAILABLE",
      "팬이벤트 토큰을 확보하지 못했습니다 — 계정 토큰 직접 사용과 by-access-token 교환이 모두 401",
    );
  }
}
