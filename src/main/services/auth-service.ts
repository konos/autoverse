import { EventEmitter } from "events";
import { BrowserWindow } from "electron";
import { maskToken } from "../../shared/mask";
import type { AuthStatus, AuthEvent } from "../../shared/types";

const FANS_ME_URL =
  "https://fanevent-v2.weverse.io/api/fan-api/v1/fans/me";
const VALIDATE_TIMEOUT_MS = 5_000;
const LOGIN_TIMEOUT_MS = 30_000;

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
  private loginWindow: BrowserWindow | null = null;

  get token(): string | null {
    return this.cachedToken;
  }

  getStatus(): AuthStatus {
    if (!this.cachedToken) return { isLoggedIn: false };
    return {
      isLoggedIn: true,
      tokenPreview: maskToken(this.cachedToken),
    };
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
        // Isolated persistent session so Weverse cookies don't bleed into main window
        partition: "persist:weverse",
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const win = this.loginWindow;

    // Hard timeout — close window if login takes too long
    const timeoutHandle = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.close();
        this._emit({
          type: "login-failed",
          message: `로그인 타임아웃 (${LOGIN_TIMEOUT_MS / 1000}초)`,
          timestamp: Date.now(),
        });
      }
    }, LOGIN_TIMEOUT_MS);

    win.webContents.on("did-navigate", async (_e, url) => {
      // Treat navigation away from account.weverse.io as login completion signal
      if (
        url.includes("weverse.io") &&
        !url.includes("account.weverse.io") &&
        !url.includes("login")
      ) {
        clearTimeout(timeoutHandle);
        const extracted = await this.extractToken(win);
        if (extracted) {
          win.close();
        }
      }
    });

    win.on("closed", () => {
      clearTimeout(timeoutHandle);
      this.loginWindow = null;
      if (!this.cachedToken) {
        this._emit({
          type: "cookie-extraction-failed",
          message: "로그인 창이 토큰 없이 닫혔습니다",
          timestamp: Date.now(),
        });
      }
    });

    await win.loadURL("https://account.weverse.io");
  }

  /**
   * Extract we2_access_token from the given window's session.
   * Falls back to .weverse.io (no leading dot) if dotted domain returns nothing.
   */
  async extractToken(win: BrowserWindow): Promise<string | null> {
    // Try both cookie domain variants
    const queries = [
      { domain: ".weverse.io", name: "we2_access_token" },
      { domain: "weverse.io", name: "we2_access_token" },
    ];

    for (const q of queries) {
      let cookies;
      try {
        cookies = await win.webContents.session.cookies.get(q);
      } catch (err) {
        console.error(`[AuthService] cookies.get failed for domain ${q.domain}:`, err);
        continue;
      }

      if (cookies.length > 0 && cookies[0].value) {
        this.cachedToken = cookies[0].value;
        console.log(
          `[AuthService] login-success token=${maskToken(this.cachedToken)}`
        );
        this._emit({
          type: "login-success",
          message: `토큰 추출 성공: ${maskToken(this.cachedToken)}`,
          timestamp: Date.now(),
        });
        return this.cachedToken;
      }
    }

    this._emit({
      type: "cookie-extraction-failed",
      message: "we2_access_token 쿠키를 찾지 못했습니다",
      timestamp: Date.now(),
    });
    return null;
  }

  /**
   * Validate cached token against GET /fans/me.
   * Emits token-validated (200) or token-expired (401) or login-failed (network error).
   */
  async validateToken(): Promise<AuthStatus> {
    if (!this.cachedToken) {
      return { isLoggedIn: false };
    }

    // Check JWT exp claim before network call to save a round trip
    if (this.isTokenExpired(this.cachedToken)) {
      this._emit({
        type: "token-expired",
        message: "JWT exp 클레임이 만료됨",
        timestamp: Date.now(),
      });
      this.cachedToken = null;
      return { isLoggedIn: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      VALIDATE_TIMEOUT_MS
    );

    let res: Response;
    try {
      res = await fetch(FANS_ME_URL, {
        headers: { Authorization: `Bearer ${this.cachedToken}` },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? `검증 타임아웃 (${VALIDATE_TIMEOUT_MS / 1000}초)`
          : `네트워크 에러: ${err instanceof Error ? err.message : String(err)}`;
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { isLoggedIn: false };
    }
    clearTimeout(timer);

    if (res.status === 401) {
      this._emit({
        type: "token-expired",
        message: "401 응답 — 토큰 만료, 재로그인 필요",
        timestamp: Date.now(),
      });
      this.cachedToken = null;
      return { isLoggedIn: false };
    }

    if (!res.ok) {
      const msg = `GET /fans/me ${res.status}: ${res.statusText}`;
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { isLoggedIn: false };
    }

    let body: FansMe;
    try {
      body = (await res.json()) as FansMe;
    } catch {
      this._emit({
        type: "login-failed",
        message: "GET /fans/me 응답 JSON 파싱 실패",
        timestamp: Date.now(),
      });
      return { isLoggedIn: false };
    }

    if (!body.fanId) {
      this._emit({
        type: "login-failed",
        message: "GET /fans/me 응답에 fanId 없음",
        timestamp: Date.now(),
      });
      return { isLoggedIn: false };
    }

    console.log(`[AuthService] token-validated fanId=${body.fanId}`);
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
      if (parts.length !== 3) return false;
      // Base64url → Base64 → JSON
      const payload = JSON.parse(
        Buffer.from(
          parts[1].replace(/-/g, "+").replace(/_/g, "/"),
          "base64"
        ).toString("utf-8")
      ) as { exp?: number };
      if (typeof payload.exp !== "number") return false;
      return payload.exp * 1000 < Date.now();
    } catch {
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
