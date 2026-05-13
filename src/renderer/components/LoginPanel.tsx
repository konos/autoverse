import type { AuthStatus } from "../../shared/types";

interface LoginPanelProps {
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  onLogin: () => void;
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

export default function LoginPanel({ status, loading, error, onLogin }: LoginPanelProps) {
  const loginState = getLoginState(status, loading);

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

      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={onLogin}
          disabled={loading || status.isLoggedIn}
          aria-busy={loading}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </div>
    </section>
  );
}
