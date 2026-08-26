import { useState } from "react";
import type { AuthStatus, LoginMode } from "../../shared/types";

interface LoginPanelProps {
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: (clearCredentials: boolean) => void;
  onValidateToken: () => void;
  loginMode: LoginMode;
  lockedByEnv: boolean;
  onSetLoginMode: (mode: LoginMode) => void;
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
}: LoginPanelProps) {
  const loginState = getLoginState(status, loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [credMessage, setCredMessage] = useState<string | null>(null);

  const handleCredentialLogin = async () => {
    if (!email || !password) return;
    setCredLoading(true);
    setCredMessage(null);
    try {
      const result = await window.api.auth.credentialLogin(email, password);
      if (!result.success) {
        setCredMessage(result.message ?? "로그인 실패");
      }
    } catch (err) {
      setCredMessage(err instanceof Error ? err.message : "로그인 오류");
    } finally {
      setCredLoading(false);
    }
  };

  const isActive = !loading && !status.isLoggedIn && !credLoading;
  const tabsDisabled = credLoading || loading || lockedByEnv;

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
      <div className="login-mode-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <button
          className={`btn ${loginMode === "api" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onSetLoginMode("api")}
          style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
          disabled={tabsDisabled}
        >
          API 로그인
        </button>
        <button
          className={`btn ${loginMode === "browser" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onSetLoginMode("browser")}
          style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
          disabled={tabsDisabled}
        >
          브라우저 로그인
        </button>
      </div>

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
          {status.hasStoredCredentials && (
            <button
              className="btn btn-secondary"
              onClick={() => onLogout(true)}
              disabled={loading}
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", color: "var(--color-error)" }}
            >
              로그아웃 + 자격 증명 삭제
            </button>
          )}
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
              {credMessage && (
                <p className="error-message" role="alert">{credMessage}</p>
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
