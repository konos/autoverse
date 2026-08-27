import { useEffect, useState } from "react";
import type {
  AuthStatus,
  LoginMode,
  CredentialLoginResult,
  StoredCredentialsSnapshot,
} from "../../shared/types";
import type { AcknowledgeOutcome } from "../login-mode-actions";
import ApiModeNoticeModal from "./ApiModeNoticeModal";
import {
  resolveTabView,
  describeLockedMode,
  shouldShowInlineNotice,
  decideTabClick,
  buildFailureView,
  decideNoticeCancel,
  resolveStoredLoginState,
} from "./login-panel-view";

interface LoginPanelProps {
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: (clearCredentials: boolean) => void;
  onValidateToken: () => void;
  loginMode: LoginMode;
  lockedByEnv: boolean;
  onSetLoginMode: (mode: LoginMode) => Promise<void>;
  noticeAck: { ackedVersion: number | null; currentVersion: number };
  onAcknowledgeNotice: (version: number) => Promise<AcknowledgeOutcome>;
}

type LoginState = "idle" | "logging-in" | "logged-in" | "expired";

function getLoginState(status: AuthStatus, loading: boolean): LoginState {
  if (loading) return "logging-in";
  if (status.isLoggedIn) return "logged-in";
  return "idle";
}

const STATE_LABELS: Record<LoginState, string> = {
  idle: "미로그인",
  "logging-in": "로그인 중...",
  "logged-in": "로그인 완료",
  expired: "토큰 만료",
};

const STATE_COLORS: Record<LoginState, string> = {
  idle: "var(--color-muted)",
  "logging-in": "var(--color-warning)",
  "logged-in": "var(--color-success)",
  expired: "var(--color-error)",
};

export default function LoginPanel({
  status,
  loading,
  error,
  onLogin,
  onLogout,
  onValidateToken,
  loginMode,
  lockedByEnv,
  onSetLoginMode,
  noticeAck,
  onAcknowledgeNotice,
}: LoginPanelProps) {
  const loginState = getLoginState(status, loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [credResult, setCredResult] = useState<CredentialLoginResult | null>(null);
  const failureView = buildFailureView(credResult);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [noticeSaveError, setNoticeSaveError] = useState<string | null>(null);
  const [storedSnapshot, setStoredSnapshot] = useState<StoredCredentialsSnapshot>({ state: "none" });

  const tabView = resolveTabView(loginMode, lockedByEnv);
  const storedView = resolveStoredLoginState(storedSnapshot, email);

  // 저장 자격증명 스냅샷을 다시 조회한다. 마운트 시 1회 + 삭제/저장 비밀번호
  // 로그인 이후 재조회에 재사용한다. available 이면 이메일을 프리필하되(D-02),
  // 사용자가 이미 무언가 입력한 뒤 덮어쓰지 않도록 이메일 state 가 빈 문자열일
  // 때만 적용한다. **비밀번호 state 는 여기서도 절대 건드리지 않는다** —
  // 저장된 비밀번호는 이 컴포넌트에 도달하지 않는다(D-01).
  const refreshStoredSnapshot = () => {
    window.api.auth.getStoredCredentials().then((snapshot) => {
      setStoredSnapshot(snapshot);
      if (snapshot.state === "available") {
        setEmail((prev) => (prev === "" ? snapshot.email : prev));
      }
    });
  };

  useEffect(() => {
    refreshStoredSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Interaction Contract 2/3: the tab click handler only branches on
  // decideTabClick()'s result — it never decides on its own whether to open
  // the modal or persist directly.
  const handleTabClick = (next: LoginMode) => {
    const decision = decideTabClick({
      next,
      current: loginMode,
      lockedByEnv,
      ackedVersion: noticeAck.ackedVersion,
    });
    if (decision.action === "none") return;
    if (decision.action === "notice") {
      setNoticeSaveError(null);
      setNoticeOpen(true);
      return;
    }
    void onSetLoginMode(decision.mode);
  };

  // Only "확인했습니다" calls onAcknowledgeNotice. Cancel/Esc never reach
  // this handler. onAcknowledgeNotice (createLoginModeActions()) owns the
  // ack-then-mode-save ordering and the strict failure contract — this
  // handler only branches on the returned AcknowledgeOutcome, it never
  // infers success/failure via try/catch (06-08 gap closure, CR-01).
  const handleAcknowledge = async () => {
    setNoticeSaving(true);
    setNoticeSaveError(null);
    const outcome = await onAcknowledgeNotice(noticeAck.currentVersion);
    if (outcome.ok) {
      setNoticeOpen(false);
    } else {
      setNoticeSaveError(outcome.error);
    }
    setNoticeSaving(false);
  };

  // WR-01: the Cancel button's disabled={noticeSaving} alone doesn't cover
  // Esc — ApiModeNoticeModal routes the native `cancel` event (Esc) through
  // this same handler, bypassing the button's disabled attribute entirely.
  // decideNoticeCancel() is the single point both entry paths go through.
  const handleCancelNotice = () => {
    const decision = decideNoticeCancel(noticeSaving);
    if (decision === "close") {
      setNoticeOpen(false);
      setNoticeSaveError(null);
    }
  };

  const handleCredentialLogin = async () => {
    if (!email || !password) return;
    setCredLoading(true);
    setCredResult(null);
    try {
      const result = await window.api.auth.credentialLogin(email, password);
      if (!result.success) {
        setCredResult(result);
      }
    } catch {
      // IPC-level exception (not a mapped LoginFailureReason from main) —
      // route through the same network-error copy as D-14's fallback bucket
      // instead of surfacing a raw, unmapped exception string.
      setCredResult({ success: false, reason: "network-error" });
    } finally {
      setCredLoading(false);
    }
  };

  // 저장된 비밀번호로 로그인한다(D-02). credentialLoginStored() 는 이메일 하나만
  // 인자로 받는다 — 저장된 비밀번호는 main 프로세스 밖으로 나가지 않는다(D-01).
  // 결과 처리/로딩 표시는 handleCredentialLogin() 과 동일한 방식을 따르고,
  // 성공/실패 후 스냅샷을 다시 조회해 손상 상태 전이(D-04)가 화면에 반영되게 한다.
  const handleStoredLogin = async () => {
    setCredLoading(true);
    setCredResult(null);
    try {
      const result = await window.api.auth.credentialLoginStored(email);
      if (!result.success) {
        setCredResult(result);
      }
    } catch {
      setCredResult({ success: false, reason: "network-error" });
    } finally {
      setCredLoading(false);
      refreshStoredSnapshot();
    }
  };

  // 저장 정보만 지운다 — 로그아웃은 하지 않는다(D-06). 삭제 후 스냅샷을 다시
  // 조회해 상태문/버튼을 갱신하고, 이메일 state 를 빈 문자열로 되돌려
  // 프리필이 사라지는 것을 삭제의 눈에 보이는 결과로 만든다.
  const handleClearStoredCredentials = async () => {
    await window.api.auth.clearStoredCredentials();
    setEmail("");
    refreshStoredSnapshot();
  };

  const isActive = !loading && !status.isLoggedIn && !credLoading;
  const tabsDisabled = credLoading || loading || tabView.tabsDisabled;

  return (
    <section className="card" aria-labelledby="login-heading">
      <h2 id="login-heading" className="card-title">
        Weverse 로그인
      </h2>

      <div className="status-row">
        <span className="status-label">상태</span>
        <span
          className="status-badge"
          style={{ color: STATE_COLORS[loginState] }}
          aria-live="polite"
        >
          {STATE_LABELS[loginState]}
        </span>
      </div>

      {status.fanId && (
        <div className="status-row">
          <span className="status-label">Fan ID</span>
          <span className="status-value">{status.fanId}</span>
        </div>
      )}

      {status.tokenPreview && (
        <div className="status-row">
          <span className="status-label">토큰</span>
          <code className="token-preview">{status.tokenPreview}</code>
        </div>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {/* D-07: tabs render regardless of login state — changing mode never
          touches the current session (status badge above stays untouched). */}
      <div className="login-mode-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: tabView.showBadge ? "0.35rem" : "0.75rem" }}>
        <button
          className={`btn ${loginMode === "api" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => handleTabClick("api")}
          style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
          disabled={tabsDisabled}
        >
          API 로그인
        </button>
        <button
          className={`btn ${loginMode === "browser" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => handleTabClick("browser")}
          style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
          disabled={tabsDisabled}
        >
          브라우저 로그인
        </button>
      </div>

      {/* D-06: env-lock badge — renders only when lockedByEnv is true, never
          reserves empty space otherwise (UI-SPEC E2 empty). */}
      {tabView.showBadge && (
        <>
          <span className="login-mode-badge">환경변수로 고정됨</span>
          <p className="login-mode-badge-detail">{describeLockedMode(loginMode)}</p>
        </>
      )}

      {/* D-09: persistent inline notice — visible for as long as API mode is
          active, independent of login state, no dismiss button. */}
      {shouldShowInlineNotice(loginMode) && (
        <p className="login-mode-notice">
          API 로그인은 Weverse 보안 확인(캡차) 시 실패할 수 있으며, 자동 재로그인을 지원하지 않습니다.
        </p>
      )}

      {/* D-06/D-07: 저장 사실 상태문 + 삭제 버튼 — 로그인 여부 조건 밖이라
          미로그인 상태에서도 보인다. loginMode === "api" 노출 조건은 D-07 이
          API 탭을 지정했기 때문이다. */}
      {loginMode === "api" && (
        <>
          {storedView.statusLine && <p className="login-mode-notice">{storedView.statusLine}</p>}
          {storedView.notice && (
            <p className="error-message" role="alert">
              {storedView.notice}
            </p>
          )}
          {storedView.showClearButton && (
            <div className="button-row" style={{ marginBottom: "0.5rem" }}>
              <button
                className="btn btn-secondary"
                onClick={() => void handleClearStoredCredentials()}
                disabled={loading}
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", color: "var(--color-error)" }}
              >
                저장된 로그인 정보 삭제
              </button>
            </div>
          )}
        </>
      )}

      <ApiModeNoticeModal
        open={noticeOpen}
        saving={noticeSaving}
        saveError={noticeSaveError}
        onAcknowledge={handleAcknowledge}
        onCancel={handleCancelNotice}
      />

      {status.isLoggedIn && (
        <div className="button-row" style={{ gap: "0.5rem" }}>
          <button
            className="btn btn-secondary"
            onClick={onValidateToken}
            disabled={loading}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
          >
            토큰 검증
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onLogout(false)}
            disabled={loading}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
          >
            로그아웃
          </button>
        </div>
      )}

      {!status.isLoggedIn && (
        <>
          {loginMode === "api" && (
            <>
              <div className="form-field">
                <label className="form-label" htmlFor="login-email">이메일</label>
                <input
                  id="login-email"
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  disabled={!isActive}
                  autoComplete="email"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="login-password">비밀번호</label>
                <input
                  id="login-password"
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  disabled={!isActive}
                  autoComplete="current-password"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCredentialLogin(); }}
                />
              </div>
              {failureView.visible && (
                <p className="error-message" role="alert">
                  {failureView.message}
                  {failureView.identifier !== undefined && (
                    <code className="token-preview" style={{ marginLeft: "0.35rem" }}>
                      (식별자: {failureView.identifier})
                    </code>
                  )}
                </p>
              )}
              {storedView.showStoredLoginButton && (
                <div className="button-row" style={{ marginBottom: "0.5rem" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void handleStoredLogin()}
                    disabled={!isActive || !storedView.storedLoginEnabled}
                    aria-busy={credLoading}
                  >
                    저장된 비밀번호로 로그인
                  </button>
                </div>
              )}
              <div className="button-row">
                <button
                  className="btn btn-primary"
                  onClick={handleCredentialLogin}
                  disabled={!isActive || !email || !password}
                  aria-busy={credLoading}
                >
                  {credLoading ? "로그인 중..." : "로그인"}
                </button>
                {failureView.visible && failureView.showBrowserSwitch && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleTabClick("browser")}
                    disabled={tabsDisabled}
                  >
                    브라우저 로그인으로 전환
                  </button>
                )}
              </div>
            </>
          )}

          {loginMode === "browser" && (
            <div className="button-row">
              <button
                className="btn btn-primary"
                onClick={onLogin}
                disabled={loading || status.isLoggedIn}
                aria-busy={loading}
              >
                {loading ? "로그인 중..." : "브라우저로 로그인"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
