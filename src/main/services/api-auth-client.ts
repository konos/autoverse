/**
 * ApiAuthClient — pure HTTP client for the Weverse account API.
 *
 * Implements the account→fanevent token ladder (R019):
 *   rung 1: try the account token directly against /fans/me
 *   rung 2: exchange via by-access-token, then retry /fans/me
 *
 * The 3-step credential login this client originally also implemented
 * (otp-sessions → by-credentials → by-credentials-with-otp) was removed in
 * Phase 06 Plan 04 (D-02) — 2026-08-25 HAR capture showed 0 real calls to
 * otp-sessions/by-credentials-with-otp; the only login path that actually
 * works is AuthService.credentialLogin()'s headless BrowserWindow (D-01).
 * See .planning/phases/05-api/05-01-SUMMARY.md for the disproven contract.
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

  // ── Token exchange / probe (R019 ladder rungs) ─────────────────────────

  async exchangeForService(
    accountAccessToken: string,
    targetServiceId: string = TARGET_SERVICE_ID,
    departureServiceId: string = TARGET_SERVICE_ID,
  ): Promise<AccountTokens> {
    logService.info(
      "ApiAuthClient",
      `exchangeForService departure=${departureServiceId} target=${targetServiceId}`,
    );
    const raw = await this.postAccount<Record<string, unknown>>(
      "/v2/auth/token/by-access-token",
      { targetServiceId },
      {
        Authorization: `Bearer ${accountAccessToken}`,
        "X-ACC-SERVICE-ID": departureServiceId,
      },
    );

    // Observability (Task 3 — A3): by-access-token 200 응답 스키마는 한 번도
    // 실계정으로 관측된 적이 없다. rung2 가 실제로 돌면 이 한 줄이 그 미지수의
    // 답이 된다. 키 이름과 존재여부/길이만 남기고 토큰 값 자체는 남기지 않는다.
    const keys = raw && typeof raw === "object" ? Object.keys(raw) : [];
    const accessTokenValue = raw && typeof raw === "object" ? raw.accessToken : undefined;
    const hasAccessToken = typeof accessTokenValue === "string" && accessTokenValue.length > 0;
    logService.info(
      "ApiAuthClient",
      `exchangeForService response keys=[${keys.join(",")}] hasAccessToken=${hasAccessToken} accessTokenLen=${hasAccessToken ? (accessTokenValue as string).length : 0}`,
    );

    if (!hasAccessToken) {
      logService.error(
        "ApiAuthClient",
        "exchangeForService: accessToken missing or not a non-empty string — refusing to return a malformed exchange result",
      );
      throw new ApiAuthError(
        "EXCHANGE_RESPONSE_MALFORMED",
        "by-access-token 응답에 accessToken 이 없습니다 — 서버 응답 스키마가 예상과 다릅니다",
      );
    }

    return raw as unknown as AccountTokens;
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
