import { EventEmitter } from "events";
import { BrowserWindow, session, safeStorage, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { maskToken, maskSensitive, maskEmail } from "../../shared/mask";
import type {
  AuthStatus,
  AuthEvent,
  CredentialLoginResult,
  StoredCredentialsSnapshot,
} from "../../shared/types";
import {
  mapLoginFailure,
  classifyCredentialLoginSignal,
  type LoginFailureReason,
} from "../../shared/login-failure";
import {
  describeTokenValidationFailure,
  type TokenValidationFailureKind,
} from "../../shared/token-validation-failure";
import { logService } from "./log-service";
import { ApiAuthClient, ApiAuthError } from "./api-auth-client";
import {
  pickAccountTokenCookie,
  summarizeCookies,
  describeTokenShape,
  extractAccessTokenFromResponseBody,
  type CookieLike,
} from "./account-token-capture";

const BY_CREDENTIALS_PATH = "/v4/auth/token/by-credentials";

const FANS_ME_URL =
  "https://fanevent-v2.weverse.io/api/fan-api/v1/fans/me";
const VALIDATE_TIMEOUT_MS = 5_000;

const LOGIN_URL =
  "https://account.weverse.io/ko/login/credential?client_id=weverse&v=4";

const CREDENTIALS_FILENAME = "credentials.enc";

function getCredentialsPath(): string {
  return path.join(app.getPath("userData"), CREDENTIALS_FILENAME);
}

export interface FansMe {
  fanId: number;
  [key: string]: unknown;
}

interface StoredCredentials {
  email: string;
  password: string;
}

/** R019 사다리 검증 스파이크의 종단 결과 (05-01 재설계). */
export interface AccountTokenLadderSpikeResult {
  verdict: "pass" | "fail" | "skipped";
  tokenSource: "cookie" | "cdp" | "none";
  ladderSource: "direct" | "exchange" | null;
  fanId: number | null;
  reason: string;
}

export class AuthService extends EventEmitter {
  private cachedToken: string | null = null;
  private cachedFanId: number | undefined = undefined;
  private loginWindow: BrowserWindow | null = null;
  private autoReloginInProgress = false;

  // T-07-09 — 연속 클릭이 헤드리스 창을 중복으로 열지 않게 막는 가드. 외부에
  // 부수효과(알림 메일 등)가 있는 요청이라 멱등하지 않으므로, 앱이 직접 억제한다.
  private credentialLoginInFlight = false;

  // Headless login state
  private headlessWindow: BrowserWindow | null = null;

  private apiClient: ApiAuthClient;

  // Account-token ladder spike state (Phase 05 재설계 — R019 검증)
  private spikeInFlight = false;
  private accountTokenCapture: {
    getCapturedAccessToken(): string | null;
    sawResponse: boolean;
    detachReason: string | null;
  } | null = null;

  constructor(apiClient: ApiAuthClient = new ApiAuthClient()) {
    super();
    this.apiClient = apiClient;
  }

  get token(): string | null {
    return this.cachedToken;
  }

  getStatus(): AuthStatus {
    if (!this.cachedToken) return { isLoggedIn: false };
    return {
      isLoggedIn: true,
      fanId: this.cachedFanId,
      tokenPreview: maskToken(this.cachedToken),
      hasStoredCredentials: this.hasStoredCredentials(),
    };
  }

  // ── Credential storage (safeStorage encrypted) ──────────────────────────

  private saveCredentials(email: string, password: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      logService.warn("AuthService", "safeStorage 사용 불가 — 자격 증명 저장 건너뜀");
      return;
    }
    const json = JSON.stringify({ email, password } satisfies StoredCredentials);
    const encrypted = safeStorage.encryptString(json);
    fs.writeFileSync(getCredentialsPath(), encrypted);
    logService.info("AuthService", `credentials saved for ${maskEmail(email)}`);
  }

  clearCredentials(): void {
    const filePath = getCredentialsPath();
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ok */ }
      logService.info("AuthService", "credentials cleared");
    }
  }

  hasStoredCredentials(): boolean {
    return fs.existsSync(getCredentialsPath());
  }

  /**
   * `credentials.enc` 의 단일 읽기 지점(D-04) — 복호화를 한 번만 수행하고
   * 공개용 스냅샷과 내부용 비밀번호를 분리해 돌려준다. `ProfileStore.getProfile()`
   * 의 삭제+throw 선례를 따르되, IPC 경계를 넘어야 하므로 throw 대신 상태
   * 반환으로 바꾼다 — 어떤 경우에도 예외를 던지지 않는다.
   *
   * - safeStorage 자체가 불가한 환경은 파일을 삭제하지 않는다(키체인이 돌아올
   *   수 있다) — "unavailable" 로만 안내한다.
   * - 읽기/복호화/JSON 파싱 실패, 또는 email 필드가 문자열이 아니면 손상으로
   *   판정해 `clearCredentials()` 로 파일을 삭제한다(삭제 로직을 새로 만들지
   *   않는다) — "corrupted" 로 안내한다.
   */
  private readStoredCredentials(): {
    snapshot: StoredCredentialsSnapshot;
    password: string | null;
  } {
    const filePath = getCredentialsPath();
    if (!fs.existsSync(filePath)) {
      return { snapshot: { state: "none" }, password: null };
    }

    if (!safeStorage.isEncryptionAvailable()) {
      logService.warn(
        "AuthService",
        "credentials 읽기: safeStorage 사용 불가 — 파일은 보존하고 사용 불가로만 안내",
      );
      return { snapshot: { state: "unavailable" }, password: null };
    }

    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (err) {
      logService.error("AuthService", `credentials 파일 읽기 실패 — 삭제 후 재입력 필요: ${String(err)}`);
      this.clearCredentials();
      return { snapshot: { state: "corrupted" }, password: null };
    }

    let json: string;
    try {
      json = safeStorage.decryptString(buffer);
    } catch (err) {
      logService.error("AuthService", `credentials 복호화 실패 — 삭제 후 재입력 필요: ${String(err)}`);
      this.clearCredentials();
      return { snapshot: { state: "corrupted" }, password: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      logService.error("AuthService", `credentials JSON 파싱 실패 — 삭제 후 재입력 필요: ${String(err)}`);
      this.clearCredentials();
      return { snapshot: { state: "corrupted" }, password: null };
    }

    const candidate = parsed as Partial<StoredCredentials>;
    if (typeof candidate.email !== "string" || typeof candidate.password !== "string") {
      logService.error("AuthService", "credentials 필드 형식 불일치 — 삭제 후 재입력 필요");
      this.clearCredentials();
      return { snapshot: { state: "corrupted" }, password: null };
    }

    return {
      snapshot: { state: "available", email: candidate.email },
      password: candidate.password,
    };
  }

  /**
   * D-04 4상태 계약의 공개 창구 — `password` 를 이 메서드 밖으로 내보내는 경로를
   * 만들지 않는다. 어떤 경우에도 throw 하지 않는다(IPC 핸들러가 그대로 렌더러에
   * 넘길 수 있어야 한다).
   */
  getStoredCredentialsSnapshot(): StoredCredentialsSnapshot {
    return this.readStoredCredentials().snapshot;
  }

  /**
   * 저장된 비밀번호로 로그인한다(D-01/D-02/D-03). 입력 이메일이 저장 이메일과
   * 다르면 **외부 요청 없이** — `credentialLogin()` 을 호출하지 않고 — 그 자리에서
   * 실패를 반환한다.
   *
   * 이 게이트가 렌더러의 버튼 `disabled` 상태와 독립적으로, main 프로세스 안에서
   * 다시 수행돼야 하는 이유: WR-03(06-REVIEW)에서 버튼 비활성 실패가 렌더러 쪽
   * 관문을 우회한 실제 발견이 있었고, 05-01 에서는 저장된 *다른* 계정에 헤드리스
   * 로그인이 나가 실제 알림 메일이 발송된 사고가 있었다. 이 메서드는 사용자 클릭
   * 에서만 호출되는 IPC 경로 전용이며, `tryAutoLogin()`/`trySessionRestore()` 의
   * 무인 로그인 차단을 우회하지 않는다 — D-03(06) 은 그대로 유지된다.
   *
   * 반환되는 `CredentialLoginResult` 에는 어떤 경우에도 비밀번호가 담기지 않는다.
   */
  async loginWithStoredCredentials(inputEmail: string): Promise<CredentialLoginResult> {
    const { snapshot, password } = this.readStoredCredentials();

    if (snapshot.state === "none") {
      return this.buildFailureResult(
        null,
        "unknown",
        undefined,
        "저장된 로그인 정보가 없습니다 — 비밀번호를 입력해주세요.",
      );
    }

    if (snapshot.state === "unavailable") {
      return this.buildFailureResult(
        null,
        "unknown",
        undefined,
        "이 환경에서는 저장된 정보를 사용할 수 없습니다 — 비밀번호를 입력해주세요.",
      );
    }

    if (snapshot.state === "corrupted") {
      return this.buildFailureResult(
        null,
        "unknown",
        undefined,
        "저장된 로그인 정보를 읽지 못해 초기화했습니다 — 다시 입력해주세요.",
      );
    }

    // snapshot.state === "available" — D-03 최종 게이트. 정규화(trim + 소문자)
    // 비교에서 불일치하면 credentialLogin() 을 호출하지 않는다.
    const normalizedInput = inputEmail.trim().toLowerCase();
    const normalizedStored = snapshot.email.trim().toLowerCase();
    if (normalizedInput !== normalizedStored) {
      return this.buildFailureResult(
        null,
        "unknown",
        undefined,
        "다른 계정입니다 — 비밀번호를 입력하세요.",
      );
    }

    return this.credentialLogin(snapshot.email, password as string);
  }

  // ── Logout ──────────────────────────────────────────────────────────────

  async logout(clearCredentials = false): Promise<void> {
    this.cachedToken = null;
    this.cachedFanId = undefined;
    this.cleanupHeadless();

    // Clear cookies from the weverse session partition
    const ses = session.fromPartition("persist:weverse");
    try {
      const cookies = await ses.cookies.get({ name: "we2_access_token" });
      for (const c of cookies) {
        const scheme = c.secure ? "https" : "http";
        const domain = c.domain?.startsWith(".") ? c.domain.slice(1) : c.domain;
        await ses.cookies.remove(`${scheme}://${domain}${c.path ?? "/"}`, c.name).catch(() => {});
      }
    } catch { /* ok */ }

    if (clearCredentials) {
      this.clearCredentials();
    }

    logService.info("AuthService", `logout: clearCredentials=${clearCredentials}`);
    this._emit({ type: "logged-out", message: "로그아웃 완료", timestamp: Date.now() });
  }

  // ── Auto-login on app start ─────────────────────────────────────────────

  async tryAutoLogin(): Promise<boolean> {
    // 무인 로그인 차단 (D-03) — 가드 조건을 *모드*에서 *"외부에 로그인 요청을
    // 발생시키는가"*로 재정의했다. 두 모드 모두에서 저장된 자격증명으로의
    // credentialLogin() 무인 호출은 하지 않는다. 근거는 둘이다: ① 이 가드의
    // 예전 사유("API 모드는 매 로그인마다 OTP 강제")는 05-01의 HAR 실측
    // (실제 로그인 흐름에 OTP 호출 0건)으로 반증됐다. ② 그럼에도 이 가드
    // 자체는 실증된 가치가 있다 — 05-01에서 이 가드(당시 API 모드 한정)가
    // tryAutoLogin() 에는 누락돼 있어 저장된 다른 계정으로 헤드리스 로그인이
    // 시도됐고, 실제로 그 계정에 알림 메일이 발송됐다. 사유는 정정하되
    // 보호는 약화가 아니라 두 모드로 확대해서 유지한다. main.ts 앱 시작
    // 경로와 ipc-handlers.ts 의 `auth:auto-login` 핸들러가 모두 이 메서드
    // 하나로 수렴하므로, 여기 한 곳의 게이트로 두 진입점이 함께 막힌다.
    //
    // 살아있는 쿠키 토큰으로의 세션 복원은 외부 요청을 발생시키지 않으므로
    // 계속 허용한다 — 재시작 후 바로 사용할 수 있는 경험을 지킨다.
    const tokenFound = await this.extractTokenFromCookies();
    if (tokenFound) {
      logService.info("AuthService", "tryAutoLogin: existing cookie token found — session restored");
      return true;
    }

    logService.info(
      "AuthService",
      "tryAutoLogin: no valid session cookie — 저장된 자격증명이 있어도 무인 로그인은 시도하지 않는다. 사용자가 직접 로그인해야 합니다",
    );
    return false;
  }

  // ── Session restore on token expiry ─────────────────────────────────────

  /**
   * 구 tryAutoRelogin() 의 정직한 후신 (D-03). 더 이상 어떤 형태의 로그인도
   * 수행하지 않는다 — 쿠키에 남아있는 유효한 세션을 복원하는 것만 한다.
   * 저장된 자격증명으로의 무인 credentialLogin() 호출은 tryAutoLogin() 과
   * 같은 이유로 완전히 제거됐다(05-01 사고 재발 방지). 진행 중 중복 실행을
   * 막던 플래그는 그대로 유지한다.
   */
  private async trySessionRestore(): Promise<boolean> {
    if (this.autoReloginInProgress) return false;

    this.autoReloginInProgress = true;
    try {
      const tokenFound = await this.extractTokenFromCookies();
      if (tokenFound) {
        logService.info("AuthService", "trySessionRestore: existing cookie token found — session restored");
        return true;
      }
      logService.info(
        "AuthService",
        "trySessionRestore: no valid session cookie — 사용자가 직접 로그인해야 합니다",
      );
      return false;
    } finally {
      this.autoReloginInProgress = false;
    }
  }

  /**
   * Headless credential login — opens an invisible BrowserWindow,
   * fills email/password via DOM injection, waits for OTP if needed.
   */
  async credentialLogin(email: string, password: string): Promise<CredentialLoginResult> {
    // T-07-09 in-flight 가드 — 헤드리스 창을 열기 전에 반환해야 연속 클릭이
    // 중복 헤드리스 로그인 요청을 Weverse 로 내보내지 않는다(외부에 부수효과가
    // 있는 요청이라 멱등하지 않다). 해제는 finally 로만 보장한다 — 이 메서드는
    // return 지점이 여러 개다.
    if (this.credentialLoginInFlight) {
      return this.buildFailureResult(
        null,
        "unknown",
        undefined,
        "로그인이 이미 진행 중입니다.",
      );
    }
    this.credentialLoginInFlight = true;
    try {
    logService.info("AuthService", "credentialLogin(headless): starting");
    this._emit({ type: "credential-login-progress", message: "로그인 시도 중...", timestamp: Date.now() });

    this.cleanupHeadless();

    // D-14 — 기존 we2_access_token 쿠키를 제거하기 직전에 현재 토큰을 백업한다.
    // 대기 중 재로그인이 캡차에 막혀 실패해도, 곧 만료되지만 아직 유효했던 토큰을
    // restoreTokenIfLost() 가 복원한다("재로그인 시도가 상황을 더 나쁘게 만들지
    // 않는다"). 현재 코드는 이 메서드가 실패 경로에서 this.cachedToken 을 직접
    // 비우지 않아 이 보장이 우연히 성립하는 상태다 — D-14 는 그 우연을 계약으로
    // 고정한다. 복원이 실효적인 이유: submitApplication() 은 쿠키가 아니라
    // Authorization: Bearer 헤더로 인증한다(weverse-api.ts:13-18 commonHeaders()).
    const previousToken = this.cachedToken;

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
    this.attachAccountTokenCapture(win);

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
      logService.info("AuthService", `credentialLogin(headless): input state — emailLen=${inputState.emailLen} chars, pwLen=${inputState.pwLen} chars`);

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
              emailLen: emailInput?.value?.length ?? -1,
              pwLength: pwInput?.value?.length ?? -1,
              loginBtnFound: !!loginBtn,
              loginBtnDisabled: loginBtn?.disabled ?? null,
              url: location.href,
            };
          })();
        `).catch(() => ({}));
        logService.info("AuthService", `credentialLogin(headless): debug=${JSON.stringify(debugInfo)}`);
        // WR-03 (06-REVIEW.md) — 이 분기는 classifyCredentialLoginSignal()/
        // mapLoginFailure() 를 거치지 않는 DOM 신호가 아니므로 overrideReason
        // "unknown" + overrideMessage 로 buildFailureResult() 관문에 태운다.
        // 사용자 대면 문구는 글자 그대로 유지한다 — 관문 통과가 목적이지 안내를
        // 후퇴시키는 것이 아니다.
        const failureResult = this.buildFailureResult(
          null,
          "unknown",
          undefined,
          "로그인 버튼이 활성화되지 않았습니다. 이메일/비밀번호를 확인해주세요.",
        );
        this._emit({ type: "login-failed", message: failureResult.message ?? "로그인 실패", timestamp: Date.now() });
        this.cleanupHeadless();
        this.restoreTokenIfLost(previousToken);
        return failureResult;
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
                // D-13: 캡차 위젯 감지는 별도 신호로 분리한다 — 과거에는 이 분기가
                // 'otp'를 반환해 사용자가 오지 않을 이메일 코드를 기다리게 했다.
                const recaptcha = document.querySelector('.AuthLoginCredentialWidgetUi_recapcha_wrapper__oMA4m');
                if (recaptcha) return 'captcha';
                // 인증코드 입력창은 이론상 도달 불가에 가깝지만, 실제로 뜨는 경우
                // 조용한 무응답이 되지 않도록 별도 신호로 유지한다(미매핑 폴백으로 라우팅).
                const otpInput = document.querySelector('input[placeholder="인증코드 6자리"]');
                if (otpInput) return 'otp-form';
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
        this.saveCredentials(email, password);
        // D-12 사다리 실패 행: 로그인은 성공했지만 서비스 토큰 확보에 실패하면
        // 사용자에게도 그 사실이 도달해야 한다 — 로그에만 남기고 끝내지 않는다.
        void this.runAccountTokenLadderSpike("credentialLogin")
          .then((spikeResult) => {
            if (spikeResult.verdict === "fail") {
              this._emit(this.buildLadderFailureEvent(spikeResult.reason));
            }
          })
          .catch((err) => {
            const rawDetail = err instanceof Error ? err.message : String(err);
            logService.error(
              "AuthService",
              `runAccountTokenLadderSpike(credentialLogin) failed: ${rawDetail}`,
            );
            this._emit(this.buildLadderFailureEvent(rawDetail));
          });
        this.cleanupHeadless();
        return { success: true };
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
      }

      // D-13: 캡차/OTP폼/폼오류/타임아웃/미지 신호 전부를 classifyCredentialLoginSignal()
      // 하나를 거쳐 사유로 분류한다. 캡차 위젯 감지가 더 이상 "OTP 필요"로 오분류되지
      // 않는다 — 캡차 신호에는 이메일 코드 서사를 절대 붙이지 않는다.
      const failureResult = this.buildFailureResult(result);
      logService.info(
        "AuthService",
        `credentialLogin(headless): classified reason=${failureResult.reason} raw=${result}`,
      );
      this._emit({ type: "login-failed", message: failureResult.message ?? "로그인 실패", timestamp: Date.now() });
      this.cleanupHeadless();
      this.restoreTokenIfLost(previousToken);
      return failureResult;
    } catch (err) {
      const rawDetail = err instanceof Error ? err.message : String(err);
      const failureResult = this.buildFailureResult(null, "network-error", rawDetail);
      logService.error("AuthService", `credentialLogin(headless) exception: ${rawDetail}`);
      this._emit({ type: "login-failed", message: failureResult.message ?? "로그인 실패", timestamp: Date.now() });
      this.cleanupHeadless();
      this.restoreTokenIfLost(previousToken);
      return failureResult;
    }
    } finally {
      this.credentialLoginInFlight = false;
    }
  }

  /**
   * DOM 폴링 원시 신호(또는 명시적 사유/디테일)를 마스킹을 통과한
   * {@link CredentialLoginResult} 로 변환하는 단일 관문(R010, T-06-06).
   *
   * `mapLoginFailure()`가 돌려주는 `message`/`identifier`는 렌더러로 직접 반환되는
   * 값이라 로그 자동 마스킹 경로를 타지 않는다 — 그래서 이 메서드가 반환 직전에
   * `maskSensitive()`를 명시적으로 적용하는 유일한 지점이다. `logDetail`은 마스킹하지
   * 않고 그대로 `logService`에 넘긴다(그쪽은 자동 마스킹이 적용된다).
   *
   * @param rawSignal DOM 폴링 결과 문자열(또는 이 경로를 타지 않는 호출부는 `null`)
   * @param overrideReason `rawSignal` 분류를 건너뛰고 사유를 직접 지정할 때 사용
   *   (예외/사다리 실패처럼 DOM 신호가 아닌 경로)
   * @param overrideDetail `overrideReason`과 함께 쓰는 디테일 원문
   * @param overrideMessage 06-REVIEW WR-03 — 확정된 사용자 문구가 이미 있는 분기를
   *   안내를 후퇴시키지 않고 마스킹 관문에 태우기 위한 자리. 주어지면
   *   `mapLoginFailure()`가 돌려주는 문구 대신 이 문자열을 쓰되, 기존 문구와
   *   완전히 동일하게 `maskSensitive()`를 통과시킨다. 사유 결정/`logDetail`
   *   처리/`identifier` 마스킹 등 나머지 동작은 그대로다.
   */
  private buildFailureResult(
    rawSignal: string | null,
    overrideReason?: LoginFailureReason,
    overrideDetail?: string,
    overrideMessage?: string,
  ): CredentialLoginResult {
    const { reason, detail } =
      overrideReason !== undefined
        ? { reason: overrideReason, detail: overrideDetail }
        : classifyCredentialLoginSignal(rawSignal);

    const guidance = mapLoginFailure(reason, detail);
    const messageText = overrideMessage !== undefined ? overrideMessage : guidance.message;

    // 잘리지 않은 원문은 logService 로 보낸다 — 그쪽 자동 마스킹이 적용되므로
    // 여기서 다시 마스킹하지 않는다.
    if (guidance.logDetail) {
      logService.info("AuthService", `credentialLogin(headless): form error detail=${guidance.logDetail}`);
    }

    // R010 마스킹 관문 — message/identifier 는 렌더러로 직접 반환되는 값이라
    // 로그 자동 마스킹 경로를 타지 않는다. 여기가 그 유일한 관문이다(T-06-06).
    // overrideMessage 가 주어져도 동일하게 이 관문을 통과한다.
    const result: CredentialLoginResult = {
      success: false,
      reason,
      message: maskSensitive(messageText),
    };
    if (guidance.identifier !== undefined) {
      result.identifier = maskSensitive(guidance.identifier);
    }
    return result;
  }

  /**
   * D-12 사다리 실패 행 — 로그인 자체는 성공했지만 `acquireFaneventToken()` 사다리가
   * 실패한 경우의 `login-failed` 이벤트를 만든다. 구조화된 필드를 실을 자리가 없는
   * 비동기 이벤트 경로이므로 식별자를 문장 뒤에 `(식별자: ...)` 형태로 병기한다
   * (구조화된 `CredentialLoginResult.identifier` 필드를 쓰는 동기 반환 경로와는
   * 다른 처리 방식 — 두 경로 모두 `buildFailureResult()`를 거쳐 마스킹을 통과한다).
   */
  private buildLadderFailureEvent(detail: string): AuthEvent {
    const failureResult = this.buildFailureResult(null, "token-ladder-failed", detail);
    const message =
      failureResult.identifier !== undefined
        ? `${failureResult.message} (식별자: ${failureResult.identifier})`
        : (failureResult.message ?? "로그인 실패");
    return { type: "login-failed", message, timestamp: Date.now() };
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

  /**
   * D-14 — 대기 중 재로그인이 실패했는데 `this.cachedToken` 이 비어 있으면(호출
   * 직전에 있던 토큰이 사라졌으면) 이전 토큰으로 되돌린다. "없던 토큰을 만들어
   * 내지 않는다" — `previousToken` 이 애초에 `null` 이었으면 아무 것도 하지
   * 않는다. 현재 `credentialLogin()` 은 실패 경로에서 `this.cachedToken` 을
   * 직접 비우지 않아 이 보장이 우연히 성립하는 상태다 — 이 헬퍼와 회귀 테스트가
   * 그 우연을 계약으로 고정한다(앞으로 실패 시 상태 정리 코드가 추가되더라도
   * 보장이 깨지지 않는다).
   */
  private restoreTokenIfLost(previousToken: string | null): void {
    if (this.cachedToken === null && previousToken !== null) {
      this.cachedToken = previousToken;
      logService.warn(
        "AuthService",
        `credentialLogin(headless): 재로그인 실패 — 이전 토큰 복원 ${maskToken(previousToken)}`,
      );
    }
  }

  /**
   * CDP 폴백 배선 (D-02 경로 B) — `by-credentials` 200 응답에서 `accessToken`을
   * 캡처해 `this.accountTokenCapture` 핸들에 보관한다. 쿠키에 계정 토큰이 없을
   * 때만 `runAccountTokenLadderSpike()`가 이 핸들을 읽는다. attach 실패는
   * 쿠키 경로만으로 계속 진행할 수 있도록 예외를 삼키고 경고만 남긴다
   * (Pitfall 2 — "시도조차 안 함"과 "조용한 캡처 실패"를 로그에서 구분).
   */
  private attachAccountTokenCapture(win: BrowserWindow): void {
    let capturedAccessToken: string | null = null;
    let sawResponse = false;
    let detachReason: string | null = null;
    let pendingRequestId: string | null = null;

    this.accountTokenCapture = {
      getCapturedAccessToken: () => capturedAccessToken,
      get sawResponse() {
        return sawResponse;
      },
      get detachReason() {
        return detachReason;
      },
    };

    const dbg = win.webContents.debugger;

    try {
      dbg.attach("1.3");
    } catch (err) {
      logService.warn(
        "AuthService",
        `accountTokenCapture(CDP): attach failed=${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    logService.info("AuthService", "accountTokenCapture(CDP): attach ok");

    dbg.on("detach", (_event, reason) => {
      detachReason = reason;
      logService.warn("AuthService", `accountTokenCapture(CDP): detached reason=${reason}`);
    });

    dbg.on("message", (_event, method, params) => {
      if (method === "Network.responseReceived") {
        const url = params?.response?.url as string | undefined;
        if (url && url.includes(BY_CREDENTIALS_PATH)) {
          pendingRequestId = params?.requestId as string;
          sawResponse = true;
          logService.info(
            "AuthService",
            `accountTokenCapture(CDP): responseSeen requestId=${pendingRequestId} status=${params?.response?.status}`,
          );
        }
        return;
      }

      if (method === "Network.loadingFinished" && params?.requestId === pendingRequestId && pendingRequestId) {
        const requestId = pendingRequestId;
        pendingRequestId = null;
        dbg
          .sendCommand("Network.getResponseBody", { requestId })
          .then((result: { body: string; base64Encoded: boolean }) => {
            const rawBody = result.base64Encoded
              ? Buffer.from(result.body, "base64").toString("utf-8")
              : result.body;
            const token = extractAccessTokenFromResponseBody(rawBody);
            if (token) {
              capturedAccessToken = token;
              logService.info(
                "AuthService",
                `accountTokenCapture(CDP): accessToken captured ${describeTokenShape(token)}`,
              );
            }
          })
          .catch((err: unknown) => {
            logService.error(
              "AuthService",
              `accountTokenCapture(CDP): getResponseBody failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }
    });

    dbg.sendCommand("Network.enable").catch((err: unknown) => {
      logService.warn(
        "AuthService",
        `accountTokenCapture(CDP): Network.enable failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  /**
   * R019 사다리 검증 스파이크 (D-02/D-03/D-04) — `persist:weverse` 파티션의
   * 쿠키를 필터 없이 전량 열거해 계정 토큰 후보를 고르고(쿠키 우선), 없으면
   * `attachAccountTokenCapture()`가 채워둔 CDP 캡처 핸들로 폴백한 뒤
   * `acquireFaneventToken()` 사다리에 흘려 verdict를 로그로 남긴다.
   *
   * 관측이 목적인 스파이크이므로 어떤 실패 경로도 예외를 던지지 않는다.
   * `this.cachedToken`/`this.cachedFanId`에는 절대 대입하지 않는다 — 이
   * 메서드가 ApplyEngine이 읽는 `authService.token`을 바꾸면 안 된다.
   */
  async runAccountTokenLadderSpike(trigger: string): Promise<AccountTokenLadderSpikeResult> {
    const logVerdict = (
      result: AccountTokenLadderSpikeResult,
    ): AccountTokenLadderSpikeResult => {
      logService.info(
        "AuthService",
        `accountTokenLadderSpike: verdict=${result.verdict} tokenSource=${result.tokenSource} ladderSource=${result.ladderSource ?? "none"} fanId=${result.fanId ?? "none"} reason=${result.reason}`,
      );
      return result;
    };

    if (this.spikeInFlight) {
      logService.info(
        "AuthService",
        `runAccountTokenLadderSpike: already running — skipping this call (trigger=${trigger})`,
      );
      return logVerdict({
        verdict: "skipped",
        tokenSource: "none",
        ladderSource: null,
        fanId: null,
        reason: "already-running",
      });
    }

    this.spikeInFlight = true;
    try {
      const ses = session.fromPartition("persist:weverse");
      const cookies = (await ses.cookies.get({})) as CookieLike[];
      logService.info(
        "AuthService",
        `accountTokenDiscovery: partition=persist:weverse cookies=${cookies.length}`,
      );
      logService.info("AuthService", `accountTokenDiscovery: ${summarizeCookies(cookies)}`);

      const candidate = pickAccountTokenCookie(cookies);
      let token: string | null = null;
      let tokenSource: AccountTokenLadderSpikeResult["tokenSource"] = "none";

      if (candidate) {
        logService.info(
          "AuthService",
          `accountTokenDiscovery: candidate=${candidate.name}@${candidate.domain ?? "?"} len=${candidate.value.length}`,
        );
        token = candidate.value;
        tokenSource = "cookie";
      } else {
        logService.info("AuthService", "accountTokenDiscovery: candidate=none");
        const cdpToken = this.accountTokenCapture?.getCapturedAccessToken() ?? null;
        if (cdpToken) {
          token = cdpToken;
          tokenSource = "cdp";
        }
      }

      if (!token) {
        const reason = `no account token — cookieCandidate=none cdpSawResponse=${this.accountTokenCapture?.sawResponse ?? false} cdpDetach=${this.accountTokenCapture?.detachReason ?? "none"}`;
        logService.info("AuthService", `accountTokenLadderSpike: ${reason}`);
        return logVerdict({
          verdict: "fail",
          tokenSource: "none",
          ladderSource: null,
          fanId: null,
          reason,
        });
      }

      logService.info(
        "AuthService",
        `accountTokenLadderSpike: tokenSource=${tokenSource} ${describeTokenShape(token)} matchesWe2Cookie=${token === this.cachedToken}`,
      );

      try {
        const { source, fanId } = await this.apiClient.acquireFaneventToken(token);
        return logVerdict({
          verdict: "pass",
          tokenSource,
          ladderSource: source,
          fanId,
          reason: "ok",
        });
      } catch (err) {
        const reason =
          err instanceof ApiAuthError ? `${err.code}: ${err.message}` : String(err);
        return logVerdict({
          verdict: "fail",
          tokenSource,
          ladderSource: null,
          fanId: null,
          reason,
        });
      }
    } finally {
      this.spikeInFlight = false;
    }
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
      logService.warn("AuthService", "JWT exp is in the past — attempting session restore");
      this.cachedToken = null;
      this.cachedFanId = undefined;

      const restored = await this.trySessionRestore();
      if (restored) {
        return this.getStatus();
      }

      this._emit({
        type: "token-expired",
        message: "JWT 만료 — 다시 로그인해주세요",
        timestamp: Date.now(),
      });
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
      logService.warn("AuthService", "validateToken: 401 — attempting session restore");
      this.cachedToken = null;
      this.cachedFanId = undefined;

      const restored = await this.trySessionRestore();
      if (restored) {
        return this.getStatus();
      }

      this.emitTokenValidationFailure("unauthorized", "token-expired");
      return { isLoggedIn: false };
    }

    if (!res.ok) {
      logService.error("AuthService", `GET /fans/me ${res.status}: ${res.statusText}`);
      this.emitTokenValidationFailure("http-error", "login-failed", { status: res.status });
      return { isLoggedIn: false };
    }

    let body: FansMe;
    try {
      body = JSON.parse(rawBody) as FansMe;
    } catch {
      this.emitTokenValidationFailure("parse-error", "login-failed");
      return { isLoggedIn: false };
    }

    if (!body.fanId) {
      this.emitTokenValidationFailure("missing-fan-id", "login-failed");
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
   * `validateToken()`의 네 실패 지점이 공유하는 단일 emit 관문(06-VERIFICATION.md gap 2,
   * CR-02 처치). `describeTokenValidationFailure()`가 반환한 확정 문구만 렌더러로 나간다 —
   * 이 메서드의 `context`는 서버 응답 텍스트를 담을 수 있는 필드가 없으므로 원문이 이
   * 경로로 들어올 타입 경로 자체가 없다.
   *
   * 식별자가 있으면 `buildLadderFailureEvent()`가 이미 쓰는 것과 동일한 병기 관용구
   * (`"{message} (식별자: {identifier})"`)로 문장 뒤에 붙인다 — 비동기 이벤트 경로에는
   * 구조화된 필드를 실을 자리가 없다는 같은 이유다. 최종 문자열을 `maskSensitive()`에
   * 통과시킨 뒤 `_emit()`한다 — 이 값은 우리가 만든 확정 문구뿐이라 마스킹이 실제로
   * 바꿀 것은 없지만, "렌더러로 나가는 문구는 전부 마스킹 관문을 통과한다"는 전제를
   * 이 경로에서도 참으로 만들기 위해서다(06-05가 세웠다가 이 경로에서 깨졌던 전제).
   */
  private emitTokenValidationFailure(
    kind: TokenValidationFailureKind,
    eventType: "token-expired" | "login-failed",
    context?: { status?: number },
  ): void {
    const guidance = describeTokenValidationFailure(kind, context);
    const message =
      guidance.identifier !== undefined
        ? `${guidance.message} (식별자: ${guidance.identifier})`
        : guidance.message;
    this._emit({ type: eventType, message: maskSensitive(message), timestamp: Date.now() });
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
