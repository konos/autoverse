import { EventEmitter } from "events";
import { BrowserWindow, net, session } from "electron";
import { maskToken } from "../../shared/mask";
import type { AuthStatus, AuthEvent, CredentialLoginResult } from "../../shared/types";
import { logService } from "./log-service";

const FANS_ME_URL =
  "https://fanevent-v2.weverse.io/api/fan-api/v1/fans/me";
const VALIDATE_TIMEOUT_MS = 5_000;

const ACCOUNT_API = "https://accountapi.weverse.io";
const ACC_APP_SECRET = "5419526f1c624b38b10787e5c10b2a7a";
const ACC_SERVICE_ID = "weverse";

function accountHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-acc-app-secret": ACC_APP_SECRET,
    "x-acc-service-id": ACC_SERVICE_ID,
    "x-acc-trace-id": crypto.randomUUID(),
    "x-acc-app-version": "4.5.0",
    "x-acc-language": "ko",
    Origin: "https://account.weverse.io",
    Referer: "https://account.weverse.io/",
  };
}

export interface FansMe {
  fanId: number;
  [key: string]: unknown;
}

/**
 * AuthService — manages Weverse login lifecycle and token validation.
 *
 * Events:
 *   login-success        { token: string (masked) }
 *   login-failed         { message: string }
 *   cookie-extraction-failed  { message: string }
 *   token-validated      { fanId: number }
 *   token-expired        { message: string }
 */
export class AuthService extends EventEmitter {
  private cachedToken: string | null = null;
  private cachedFanId: number | undefined = undefined;
  private loginWindow: BrowserWindow | null = null;

  // Credential login state
  private pendingCredEmail: string | null = null;
  private pendingCredPassword: string | null = null;
  private pendingOtpSessionId: string | null = null;

  get token(): string | null {
    return this.cachedToken;
  }

  getStatus(): AuthStatus {
    if (!this.cachedToken) return { isLoggedIn: false };
    return {
      isLoggedIn: true,
      fanId: this.cachedFanId,
      tokenPreview: maskToken(this.cachedToken),
    };
  }

  /**
   * Credential login — pure API calls, no browser window.
   * Step 1: POST /v4/auth/token/by-credentials
   * If OTP required (-25044), emits otp-required and returns { needOtp: true }.
   * If OTP not required, extracts token from session cookies.
   */
  async credentialLogin(email: string, password: string): Promise<CredentialLoginResult> {
    logService.info("AuthService", "credentialLogin: starting");
    this._emit({ type: "credential-login-progress", message: "로그인 시도 중...", timestamp: Date.now() });

    this.pendingCredEmail = email;
    this.pendingCredPassword = password;

    const ses = session.fromPartition("persist:weverse");
    // Clear old cookies
    try {
      const old = await ses.cookies.get({ name: "we2_access_token" });
      for (const c of old) {
        const scheme = c.secure ? "https" : "http";
        const domain = c.domain?.startsWith(".") ? c.domain.slice(1) : c.domain;
        await ses.cookies.remove(`${scheme}://${domain}${c.path ?? "/"}`, c.name).catch(() => {});
      }
    } catch { /* ok */ }

    try {
      const body = JSON.stringify({ email, password });
      const res = await this.accountFetch("POST", "/web/api/v4/auth/token/by-credentials", body);
      const text = await res.text();
      logService.info("AuthService", `credentialLogin: status=${res.status} body=${text.slice(0, 300)}`);

      if (res.status === 200) {
        // OTP not needed — token should be in cookies
        return this.extractTokenFromSession();
      }

      if (res.status === 400) {
        let parsed: { code?: number; otpSessionId?: string } = {};
        try { parsed = JSON.parse(text); } catch { /* ignore */ }

        if (parsed.code === -25044) {
          // OTP required — need to get otpSessionId from response or generate session
          if (parsed.otpSessionId) {
            this.pendingOtpSessionId = parsed.otpSessionId;
          }
          // Send OTP email
          await this.sendOtp();
          this._emit({ type: "otp-required", message: "이메일 OTP 인증이 필요합니다. 이메일을 확인해주세요.", timestamp: Date.now() });
          return { success: false, needOtp: true, message: "이메일 OTP 인증이 필요합니다." };
        }

        const msg = `로그인 실패: ${text.slice(0, 200)}`;
        this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
        return { success: false, message: msg };
      }

      const msg = `로그인 실패: HTTP ${res.status}`;
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { success: false, message: msg };
    } catch (err) {
      const msg = `로그인 네트워크 오류: ${err instanceof Error ? err.message : String(err)}`;
      logService.error("AuthService", msg);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { success: false, message: msg };
    }
  }

  /**
   * Step 2 (if OTP required): User submits 6-digit OTP code.
   * POST /v3/auth/token/by-credentials-with-otp
   */
  async submitOtp(otpCode: string): Promise<CredentialLoginResult> {
    if (!this.pendingCredEmail || !this.pendingCredPassword) {
      return { success: false, message: "로그인 세션이 없습니다. 다시 로그인해주세요." };
    }

    logService.info("AuthService", "submitOtp: submitting OTP code");
    this._emit({ type: "credential-login-progress", message: "OTP 인증 중...", timestamp: Date.now() });

    try {
      const body: Record<string, string> = {
        email: this.pendingCredEmail,
        password: this.pendingCredPassword,
        otpCode,
      };
      if (this.pendingOtpSessionId) {
        body.otpSessionId = this.pendingOtpSessionId;
      }

      const res = await this.accountFetch(
        "POST",
        "/web/api/v3/auth/token/by-credentials-with-otp",
        JSON.stringify(body),
      );
      const text = await res.text();
      logService.info("AuthService", `submitOtp: status=${res.status} bodyLen=${text.length}`);

      if (res.status === 200) {
        return this.extractTokenFromSession();
      }

      const msg = `OTP 인증 실패: HTTP ${res.status} — ${text.slice(0, 200)}`;
      logService.error("AuthService", msg);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { success: false, message: msg };
    } catch (err) {
      const msg = `OTP 네트워크 오류: ${err instanceof Error ? err.message : String(err)}`;
      logService.error("AuthService", msg);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { success: false, message: msg };
    }
  }

  /** Send OTP email via POST /v2/auth/otp */
  private async sendOtp(): Promise<void> {
    const body: Record<string, string> = {};
    if (this.pendingOtpSessionId) {
      body.otpSessionId = this.pendingOtpSessionId;
    }
    try {
      const res = await this.accountFetch("POST", "/web/api/v2/auth/otp", JSON.stringify(body));
      logService.info("AuthService", `sendOtp: status=${res.status}`);
    } catch (err) {
      logService.error("AuthService", `sendOtp error: ${String(err)}`);
    }
  }

  /** Extract we2_access_token from session cookies after successful auth */
  private async extractTokenFromSession(): Promise<CredentialLoginResult> {
    // First try GET /v2/auth/token which may return the token in the response body
    try {
      const tokenRes = await this.accountFetch("GET", "/web/api/v2/auth/token", undefined);
      const tokenText = await tokenRes.text();
      logService.info("AuthService", `extractTokenFromSession: GET auth/token status=${tokenRes.status} bodyLen=${tokenText.length}`);

      if (tokenRes.status === 200 && tokenText.length > 0) {
        try {
          const tokenData = JSON.parse(tokenText) as { accessToken?: string; token?: string };
          const token = tokenData.accessToken ?? tokenData.token;
          if (token) {
            logService.info("AuthService", `extractTokenFromSession: got token from response body len=${token.length}`);
            this.cachedToken = token;
            this._emit({ type: "login-success", message: `토큰 추출 성공: ${maskToken(token)}`, timestamp: Date.now() });
            this.validateToken().catch((err) => {
              logService.error("AuthService", `post-credential-login validateToken failed: ${String(err)}`);
            });
            return { success: true };
          }
        } catch { /* body isn't JSON with token, try cookies */ }
      }
    } catch (err) {
      logService.warn("AuthService", `extractTokenFromSession: GET auth/token failed: ${String(err)}`);
    }

    // Fallback: check cookies
    const wvSession = session.fromPartition("persist:weverse");
    const cookies = await wvSession.cookies.get({ name: "we2_access_token" }).catch(() => []);
    logService.info("AuthService", `extractTokenFromSession: found ${cookies.length} we2_access_token cookies`);

    for (const c of cookies) {
      if (c.value && !this.isTokenExpired(c.value)) {
        this.cachedToken = c.value;
        logService.info("AuthService", `extractTokenFromSession: cookie token len=${c.value.length}`);
        this._emit({ type: "login-success", message: `토큰 추출 성공: ${maskToken(c.value)}`, timestamp: Date.now() });
        this.validateToken().catch((err) => {
          logService.error("AuthService", `post-credential-login validateToken failed: ${String(err)}`);
        });
        return { success: true };
      }
    }

    const msg = "로그인 성공했으나 토큰을 추출하지 못했습니다";
    logService.error("AuthService", msg);
    this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
    return { success: false, message: msg };
  }

  /** Make an API request to accountapi.weverse.io using Electron net (cookie-aware) */
  private accountFetch(
    method: string,
    path: string,
    body: string | undefined,
  ): Promise<{ status: number; text: () => Promise<string> }> {
    const url = `${ACCOUNT_API}${path}`;
    return new Promise((resolve, reject) => {
      const req = net.request({
        method,
        url,
        partition: "persist:weverse",
      });
      const headers = accountHeaders();
      for (const [k, v] of Object.entries(headers)) {
        req.setHeader(k, v);
      }
      req.on("response", (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const fullBody = Buffer.concat(chunks).toString("utf-8");
          resolve({
            status: response.statusCode,
            text: () => Promise.resolve(fullBody),
          });
        });
        response.on("error", reject);
      });
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  }

  /** Open Weverse login in a child BrowserWindow with isolated cookie partition */
  async login(parentWindow: BrowserWindow | null): Promise<void> {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus();
      return;
    }

    this.loginWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: parentWindow ?? undefined,
      webPreferences: {
        partition: "persist:weverse",
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const win = this.loginWindow;
    let tokenExtracted = false;

    // Flush all cookies from the weverse partition so the user actually
    // goes through the login flow instead of re-extracting an expired token.
    const session = win.webContents.session;
    try {
      const allCookies = await session.cookies.get({ name: "we2_access_token" });
      for (const c of allCookies) {
        const scheme = c.secure ? "https" : "http";
        const domain = c.domain?.startsWith(".") ? c.domain.slice(1) : c.domain;
        await session.cookies.remove(`${scheme}://${domain}${c.path ?? "/"}`, c.name).catch(() => {});
      }
    } catch { /* no cookies to clear */ }

    const pollForToken = async () => {
      if (tokenExtracted || win.isDestroyed()) return;

      const cookies = await win.webContents.session.cookies.get({
        domain: ".weverse.io",
        name: "we2_access_token",
      }).catch(() => []);

      if (cookies.length > 0 && cookies[0].value) {
        if (this.isTokenExpired(cookies[0].value)) {
          logService.warn("AuthService", "pollForToken: extracted token is expired, ignoring — waiting for fresh login");
          return;
        }
        tokenExtracted = true;
        this.cachedToken = cookies[0].value;
        logService.info("AuthService", `login-success we2_access_token len=${this.cachedToken.length} token=${maskToken(this.cachedToken)}`);
        this._emit({
          type: "login-success",
          message: `토큰 추출 성공: ${maskToken(this.cachedToken)}`,
          timestamp: Date.now(),
        });
        win.close();
        this.validateToken().catch((err) => {
          logService.error("AuthService", `post-login validateToken failed: ${String(err)}`);
        });
        return;
      }

      // Also try without leading dot
      const cookies2 = await win.webContents.session.cookies.get({
        domain: "weverse.io",
        name: "we2_access_token",
      }).catch(() => []);

      if (cookies2.length > 0 && cookies2[0].value) {
        if (this.isTokenExpired(cookies2[0].value)) {
          logService.warn("AuthService", "pollForToken: extracted token (no-dot) is expired, ignoring — waiting for fresh login");
          return;
        }
        tokenExtracted = true;
        this.cachedToken = cookies2[0].value;
        logService.info("AuthService", `login-success we2_access_token (no-dot) len=${this.cachedToken.length} token=${maskToken(this.cachedToken)}`);
        this._emit({
          type: "login-success",
          message: `토큰 추출 성공: ${maskToken(this.cachedToken)}`,
          timestamp: Date.now(),
        });
        win.close();
        this.validateToken().catch((err) => {
          logService.error("AuthService", `post-login validateToken failed: ${String(err)}`);
        });
        return;
      }
    };

    // Poll for we2_access_token every 500ms after login window opens
    const pollInterval = setInterval(() => {
      pollForToken().catch(() => {});
    }, 500);

    // Also poll on every navigation
    win.webContents.on("did-navigate", async (_e, url) => {
      logService.info("AuthService", `navigation: ${url}`);
      await pollForToken();
    });

    win.webContents.on("did-navigate-in-page", async (_e, url) => {
      logService.info("AuthService", `navigation(in-page): ${url}`);
      await pollForToken();
    });

    win.on("closed", () => {
      clearInterval(pollInterval);
      this.loginWindow = null;
      if (!tokenExtracted) {
        this._emit({
          type: "cookie-extraction-failed",
          message: "로그인 창이 토큰 없이 닫혔습니다",
          timestamp: Date.now(),
        });
      }
    });

    // Start on weverse.io — it will redirect to account.weverse.io for login,
    // then back to weverse.io after login completes, setting we2_access_token
    await win.loadURL("https://weverse.io");
  }

  /**
   * Validate cached token against GET /fans/me.
   * Emits token-validated (200) or token-expired (401) or login-failed (network error).
   */
  async validateToken(): Promise<AuthStatus> {
    if (!this.cachedToken) {
      return { isLoggedIn: false };
    }

    const localExpired = this.isTokenExpired(this.cachedToken);
    if (localExpired) {
      logService.warn("AuthService", "JWT exp is in the past — skipping server call, token is expired");
      this._emit({
        type: "token-expired",
        message: "JWT 만료 — 다시 로그인해주세요",
        timestamp: Date.now(),
      });
      this.cachedToken = null;
      this.cachedFanId = undefined;
      return { isLoggedIn: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      VALIDATE_TIMEOUT_MS
    );

    // Diagnostic: log token shape to verify it's really a JWT we2_access_token
    const tokenParts = this.cachedToken.split(".");
    const tokenPrefix = this.cachedToken.slice(0, 20);
    logService.info("AuthService", `validateToken: token shape — parts=${tokenParts.length} prefix=${tokenPrefix}... len=${this.cachedToken.length}`);
    logService.info("AuthService", `validateToken: calling GET ${FANS_ME_URL}`);

    // Log the exact headers being sent (token masked)
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.cachedToken}`,
      "X-FEV-APP-SOURCE": "FAN_EVENT",
      Accept: "application/json, text/plain, */*",
    };
    logService.info("AuthService", `validateToken: headers — ${Object.keys(reqHeaders).join(", ")}`);

    let res: Response;
    try {
      res = await fetch(FANS_ME_URL, {
        headers: reqHeaders,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? `검증 타임아웃 (${VALIDATE_TIMEOUT_MS / 1000}초)`
          : `네트워크 에러: ${err instanceof Error ? err.message : String(err)}`;
      logService.error("AuthService", `validateToken fetch error: ${msg}`);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { isLoggedIn: false };
    }
    clearTimeout(timer);

    logService.info("AuthService", `validateToken response: ${res.status} ${res.statusText}`);

    // Read response body for diagnostics
    let rawBody: string;
    try {
      rawBody = await res.text();
    } catch {
      rawBody = "(body read failed)";
    }
    logService.info("AuthService", `validateToken body: ${rawBody.slice(0, 500)}`);

    if (res.status === 401) {
      this._emit({
        type: "token-expired",
        message: `401 응답 — ${rawBody.slice(0, 200)}`,
        timestamp: Date.now(),
      });
      this.cachedToken = null;
      this.cachedFanId = undefined;
      return { isLoggedIn: false };
    }

    if (!res.ok) {
      const msg = `GET /fans/me ${res.status}: ${res.statusText} — ${rawBody.slice(0, 200)}`;
      logService.error("AuthService", msg);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { isLoggedIn: false };
    }

    let body: FansMe;
    try {
      body = JSON.parse(rawBody) as FansMe;
    } catch {
      this._emit({
        type: "login-failed",
        message: `GET /fans/me 응답 JSON 파싱 실패: ${rawBody.slice(0, 200)}`,
        timestamp: Date.now(),
      });
      return { isLoggedIn: false };
    }

    if (!body.fanId) {
      this._emit({
        type: "login-failed",
        message: `GET /fans/me 응답에 fanId 없음: ${rawBody.slice(0, 200)}`,
        timestamp: Date.now(),
      });
      return { isLoggedIn: false };
    }

    this.cachedFanId = body.fanId;
    logService.info("AuthService", `token-validated fanId=${body.fanId}`);
    this._emit({
      type: "token-validated",
      message: `fanId=${body.fanId} 검증 성공`,
      timestamp: Date.now(),
    });

    return {
      isLoggedIn: true,
      fanId: body.fanId,
      tokenPreview: maskToken(this.cachedToken),
    };
  }

  /**
   * Parse JWT exp claim and return true if expired.
   * Returns false (not expired) on any parse failure to avoid false positives.
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        logService.info("AuthService", `isTokenExpired: not a JWT (${parts.length} parts), assuming not expired`);
        return false;
      }
      const payload = JSON.parse(
        Buffer.from(
          parts[1].replace(/-/g, "+").replace(/_/g, "/"),
          "base64"
        ).toString("utf-8")
      ) as { exp?: number };
      if (typeof payload.exp !== "number") {
        logService.info("AuthService", `isTokenExpired: no exp claim, assuming not expired`);
        return false;
      }
      const nowMs = Date.now();
      const expMs = payload.exp * 1000;
      const expired = expMs < nowMs;
      logService.info("AuthService", `isTokenExpired: exp=${new Date(expMs).toISOString()} now=${new Date(nowMs).toISOString()} expired=${expired}`);
      return expired;
    } catch (err) {
      logService.error("AuthService", `isTokenExpired parse error: ${String(err)}`);
      return false;
    }
  }

  private _emit(event: AuthEvent): void {
    this.emit(event.type, event);
    // Also forward as generic 'auth-event' for IPC broadcast
    this.emit("auth-event", event);
  }
}

export const authService = new AuthService();
