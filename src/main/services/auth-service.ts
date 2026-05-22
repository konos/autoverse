import { EventEmitter } from "events";
import { BrowserWindow, session } from "electron";
import { maskToken } from "../../shared/mask";
import type { AuthStatus, AuthEvent, CredentialLoginResult } from "../../shared/types";
import { logService } from "./log-service";

const FANS_ME_URL =
  "https://fanevent-v2.weverse.io/api/fan-api/v1/fans/me";
const VALIDATE_TIMEOUT_MS = 5_000;

const LOGIN_URL =
  "https://account.weverse.io/ko/login/credential?client_id=weverse&v=4";

export interface FansMe {
  fanId: number;
  [key: string]: unknown;
}

export class AuthService extends EventEmitter {
  private cachedToken: string | null = null;
  private cachedFanId: number | undefined = undefined;
  private loginWindow: BrowserWindow | null = null;

  // Headless login state
  private headlessWindow: BrowserWindow | null = null;

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
   * Headless credential login — opens an invisible BrowserWindow,
   * fills email/password via DOM injection, waits for OTP if needed.
   */
  async credentialLogin(email: string, password: string): Promise<CredentialLoginResult> {
    logService.info("AuthService", "credentialLogin(headless): starting");
    this._emit({ type: "credential-login-progress", message: "로그인 시도 중...", timestamp: Date.now() });

    this.cleanupHeadless();

    const ses = session.fromPartition("persist:weverse");
    try {
      const old = await ses.cookies.get({ name: "we2_access_token" });
      for (const c of old) {
        const scheme = c.secure ? "https" : "http";
        const domain = c.domain?.startsWith(".") ? c.domain.slice(1) : c.domain;
        await ses.cookies.remove(`${scheme}://${domain}${c.path ?? "/"}`, c.name).catch(() => {});
      }
    } catch { /* ok */ }

    const win = new BrowserWindow({
      width: 500,
      height: 700,
      show: false,
      webPreferences: {
        partition: "persist:weverse",
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    this.headlessWindow = win;

    try {
      await win.loadURL(LOGIN_URL);
      logService.info("AuthService", "credentialLogin(headless): login page loaded");

      // Wait for the email input to appear
      await win.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error("login form timeout")), 15000);
          const check = () => {
            const el = document.querySelector('input[placeholder="your@email.com"]');
            if (el) { clearTimeout(t); resolve(true); }
            else setTimeout(check, 200);
          };
          check();
        });
      `);

      // Fill email and password using Chromium Input.insertText for real keystroke simulation
      const emailInput = await win.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector('input[placeholder="your@email.com"]');
          if (!el) throw new Error("email input not found");
          el.focus();
          el.value = '';
          return true;
        })();
      `);
      if (emailInput) {
        await win.webContents.insertText(email);
      }
      await new Promise(r => setTimeout(r, 200));

      const pwInput = await win.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector('input[type="password"]');
          if (!el) throw new Error("password input not found");
          el.focus();
          el.value = '';
          return true;
        })();
      `);
      if (pwInput) {
        await win.webContents.insertText(password);
      }
      await new Promise(r => setTimeout(r, 200));

      // Verify values were actually set
      const inputState = await win.webContents.executeJavaScript(`
        (function() {
          const emailEl = document.querySelector('input[placeholder="your@email.com"]');
          const pwEl = document.querySelector('input[type="password"]');
          return {
            emailLen: emailEl?.value?.length ?? -1,
            pwLen: pwEl?.value?.length ?? -1,
          };
        })();
      `) as { emailLen: number; pwLen: number };
      logService.info("AuthService", `credentialLogin(headless): input state — email=${inputState.emailLen} chars, pw=${inputState.pwLen} chars`);

      // Wait for React state to update — poll until login button is enabled
      const btnEnabled = await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          let tries = 0;
          const check = () => {
            const btns = Array.from(document.querySelectorAll('button'));
            const loginBtn = btns.find(b => b.textContent.trim() === '로그인');
            if (loginBtn && !loginBtn.disabled) { resolve(true); return; }
            tries++;
            if (tries > 30) { resolve(false); return; }
            setTimeout(check, 200);
          };
          setTimeout(check, 300);
        });
      `) as boolean;

      if (!btnEnabled) {
        logService.warn("AuthService", "credentialLogin(headless): login button still disabled after input, dumping page state");
        const debugInfo = await win.webContents.executeJavaScript(`
          (function() {
            const emailInput = document.querySelector('input[placeholder="your@email.com"]');
            const pwInput = document.querySelector('input[type="password"]');
            const btns = Array.from(document.querySelectorAll('button'));
            const loginBtn = btns.find(b => b.textContent.trim() === '로그인');
            return {
              emailValue: emailInput?.value ?? 'NOT FOUND',
              pwLength: pwInput?.value?.length ?? -1,
              loginBtnFound: !!loginBtn,
              loginBtnDisabled: loginBtn?.disabled ?? null,
              url: location.href,
            };
          })();
        `).catch(() => ({}));
        logService.info("AuthService", `credentialLogin(headless): debug=${JSON.stringify(debugInfo)}`);
        this.cleanupHeadless();
        return { success: false, message: "로그인 버튼이 활성화되지 않았습니다. 이메일/비밀번호를 확인해주세요." };
      }

      await win.webContents.executeJavaScript(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button'));
          const loginBtn = btns.find(b => b.textContent.trim() === '로그인');
          if (!loginBtn) throw new Error("login button not found");
          loginBtn.click();
        })();
      `);

      logService.info("AuthService", "credentialLogin(headless): login button clicked, waiting for response");

      // Wait for OTP input, redirect, token cookie, or error
      const result = await new Promise<string>((resolve) => {
        const timeout = setTimeout(() => resolve("timeout"), 25000);
        let resolved = false;
        const done = (val: string) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          clearInterval(pollTimer);
          resolve(val);
        };

        // Poll DOM for OTP or error + check cookies
        const pollTimer = setInterval(async () => {
          if (resolved || win.isDestroyed()) return;
          try {
            // Check DOM state
            const domState = await win.webContents.executeJavaScript(`
              (function() {
                const otpInput = document.querySelector('input[placeholder="인증코드 6자리"]');
                if (otpInput) return 'otp';
                const recaptcha = document.querySelector('.AuthLoginCredentialWidgetUi_recapcha_wrapper__oMA4m');
                if (recaptcha) return 'otp';
                // Check for error text inside text-field error wrappers (specific to Weverse login form)
                const errWraps = document.querySelectorAll('.text-field_error_wrap__9nRXJ .text-field_error_text__BwsFg, [class*="error_message"]');
                for (const el of errWraps) {
                  const t = el.textContent.trim();
                  if (t.length > 3) return 'error:' + t;
                }
                return null;
              })();
            `) as string | null;
            if (domState) { done(domState); return; }

            // Check cookies
            const tokenFound = await this.extractTokenFromCookies();
            if (tokenFound) { done("token"); return; }
          } catch { /* window may be navigating */ }
        }, 500);

        // Also listen for navigation events
        const onNav = async (_e: Electron.Event, url: string) => {
          logService.info("AuthService", `credentialLogin(headless): navigated to ${url}`);
          if (!url.includes("account.weverse.io/ko/login")) {
            await new Promise(r => setTimeout(r, 1500));
            const tokenFound = await this.extractTokenFromCookies();
            if (tokenFound) done("token");
          }
        };
        win.webContents.on("did-navigate", onNav);
        win.webContents.on("did-navigate-in-page", onNav);
      });

      logService.info("AuthService", `credentialLogin(headless): result=${result}`);

      if (result === "token") {
        logService.info("AuthService", "credentialLogin(headless): token obtained directly");
        this.cleanupHeadless();
        return { success: true };
      }

      if (result === "otp") {
        logService.info("AuthService", "credentialLogin(headless): OTP required");
        this._emit({ type: "otp-required", message: "이메일 OTP 인증이 필요합니다. 이메일을 확인해주세요.", timestamp: Date.now() });
        return { success: false, needOtp: true, message: "이메일 OTP 인증이 필요합니다." };
      }

      if (result === "timeout") {
        const token = await this.extractTokenFromCookies();
        if (token) {
          this.cleanupHeadless();
          return { success: true };
        }

        // Dump page state for debugging
        const debugInfo = await win.webContents.executeJavaScript(`
          (function() {
            return { url: location.href, title: document.title, bodyLen: document.body?.innerHTML?.length ?? 0 };
          })();
        `).catch(() => ({}));
        logService.error("AuthService", `credentialLogin(headless): timeout, debug=${JSON.stringify(debugInfo)}`);

        const msg = "로그인 응답 대기 시간 초과";
        this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
        this.cleanupHeadless();
        return { success: false, message: msg };
      }

      if (result.startsWith("error:")) {
        const msg = result.slice(6);
        logService.error("AuthService", `credentialLogin(headless): form error: ${msg}`);
        this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
        this.cleanupHeadless();
        return { success: false, message: msg };
      }

      this.cleanupHeadless();
      return { success: false, message: "알 수 없는 상태" };
    } catch (err) {
      const msg = `로그인 오류: ${err instanceof Error ? err.message : String(err)}`;
      logService.error("AuthService", msg);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      this.cleanupHeadless();
      return { success: false, message: msg };
    }
  }

  /**
   * Submit OTP code into the headless browser window.
   */
  async submitOtp(otpCode: string): Promise<CredentialLoginResult> {
    if (!this.headlessWindow || this.headlessWindow.isDestroyed()) {
      return { success: false, message: "로그인 세션이 없습니다. 다시 로그인해주세요." };
    }

    logService.info("AuthService", "submitOtp(headless): entering OTP");
    this._emit({ type: "credential-login-progress", message: "OTP 인증 중...", timestamp: Date.now() });

    const win = this.headlessWindow;

    try {
      // Fill OTP code
      await win.webContents.executeJavaScript(`
        (function() {
          const otpInput = document.querySelector('input[placeholder="인증코드 6자리"]');
          if (!otpInput) throw new Error("OTP input not found");

          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ).set;
          nativeInputValueSetter.call(otpInput, ${JSON.stringify(otpCode)});
          otpInput.dispatchEvent(new Event('input', { bubbles: true }));
          otpInput.dispatchEvent(new Event('change', { bubbles: true }));
        })();
      `);

      await new Promise(r => setTimeout(r, 500));

      // Click the OTP confirm button
      await win.webContents.executeJavaScript(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button'));
          const confirmBtn = btns.find(b => b.textContent.trim() === '인증코드 확인');
          if (!confirmBtn) throw new Error("OTP confirm button not found");
          if (confirmBtn.disabled) throw new Error("OTP confirm button is disabled — check code length");
          confirmBtn.click();
        })();
      `);

      logService.info("AuthService", "submitOtp(headless): OTP confirm clicked, waiting for result");

      // Wait for redirect/token or error
      const token = await this.waitForTokenAfterOtp(win);
      if (token) {
        this.cleanupHeadless();
        return { success: true };
      }

      // Check for error message in the page
      const errorMsg = await win.webContents.executeJavaScript(`
        (function() {
          const errs = document.querySelectorAll('[class*="error"], [class*="Error"], [role="alert"]');
          for (const el of errs) {
            const t = el.textContent.trim();
            if (t.length > 3) return t;
          }
          return null;
        })();
      `).catch(() => null) as string | null;

      const msg = errorMsg ?? "OTP 인증 실패";
      logService.error("AuthService", `submitOtp(headless): ${msg}`);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { success: false, message: msg };
    } catch (err) {
      const msg = `OTP 오류: ${err instanceof Error ? err.message : String(err)}`;
      logService.error("AuthService", msg);
      this._emit({ type: "login-failed", message: msg, timestamp: Date.now() });
      return { success: false, message: msg };
    }
  }

  private async waitForTokenAfterOtp(win: BrowserWindow): Promise<boolean> {
    const maxWait = 20_000;
    const interval = 500;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      if (win.isDestroyed()) return false;

      const token = await this.extractTokenFromCookies();
      if (token) return true;

      // Check if URL navigated away from login page (indicates success)
      const url = win.webContents.getURL();
      if (url.includes("weverse.io") && !url.includes("account.weverse.io")) {
        logService.info("AuthService", `submitOtp: redirected to ${url}, checking cookies`);
        await new Promise(r => setTimeout(r, 1000));
        const tokenAfterRedirect = await this.extractTokenFromCookies();
        if (tokenAfterRedirect) return true;
      }

      await new Promise(r => setTimeout(r, interval));
    }

    return false;
  }

  private async extractTokenFromCookies(): Promise<boolean> {
    const ses = session.fromPartition("persist:weverse");
    const cookies = await ses.cookies.get({ name: "we2_access_token" }).catch(() => []);

    for (const c of cookies) {
      if (c.value && !this.isTokenExpired(c.value)) {
        this.cachedToken = c.value;
        logService.info("AuthService", `extractTokenFromCookies: token len=${c.value.length}`);
        this._emit({ type: "login-success", message: `토큰 추출 성공: ${maskToken(c.value)}`, timestamp: Date.now() });
        this.validateToken().catch((err) => {
          logService.error("AuthService", `post-credential-login validateToken failed: ${String(err)}`);
        });
        return true;
      }
    }
    return false;
  }

  private cleanupHeadless(): void {
    if (this.headlessWindow && !this.headlessWindow.isDestroyed()) {
      this.headlessWindow.close();
    }
    this.headlessWindow = null;
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
