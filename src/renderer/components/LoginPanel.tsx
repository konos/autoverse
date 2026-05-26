import { useState } from "react";
import type { AuthStatus } from "../../shared/types";

interface LoginPanelProps {
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: (clearCredentials: boolean) => void;
  onValidateToken: () => void;
}

type LoginState = "idle" | "logging-in" | "logged-in" | "expired";
type LoginMode = "credential" | "browser";

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

export default function LoginPanel({ status, loading, error, onLogin, onLogout, onValidateToken }: LoginPanelProps) {
  const loginState = getLoginState(status, loading);
  const [mode, setMode] = useState<LoginMode>("credential");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [needOtp, setNeedOtp] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credMessage, setCredMessage] = useState<string | null>(null);

  const handleCredentialLogin = async () => {
    if (!email || !password) return;
    setCredLoading(true);
    setCredMessage(null);
    try {
      const result = await window.api.auth.credentialLogin(email, password);
      if (result.needOtp) {
        setNeedOtp(true);
        setCredMessage("이메일로 OTP 코드가 발송되었습니다. 확인 후 입력해주세요.");
      } else if (!result.success) {
        setCredMessage(result.message ?? "로그인 실패");
      }
    } catch (err) {
      setCredMessage(err instanceof Error ? err.message : "로그인 오류");
    } finally {
      setCredLoading(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!otpCode || otpCode.length !== 6) return;
    setCredLoading(true);
    setCredMessage(null);
    try {
      const result = await window.api.auth.submitOtp(otpCode);
      if (result.success) {
        setNeedOtp(false);
        setOtpCode("");
        setEmail("");
        setPassword("");
      } else {
        setCredMessage(result.message ?? "OTP 인증 실패");
      }
    } catch (err) {
      setCredMessage(err instanceof Error ? err.message : "OTP 인증 오류");
    } finally {
      setCredLoading(false);
    }
  };

  const isActive = !loading && !status.isLoggedIn && !credLoading;

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
          <div className="login-mode-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <button
              className={`btn ${mode === "credential" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { setMode("credential"); setNeedOtp(false); setCredMessage(null); }}
              style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
              disabled={credLoading || loading}
            >
              이메일 로그인
            </button>
            <button
              className={`btn ${mode === "browser" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { setMode("browser"); setNeedOtp(false); setCredMessage(null); }}
              style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
              disabled={credLoading || loading}
            >
              브라우저 로그인
            </button>
          </div>

          {mode === "credential" && !needOtp && (
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

          {mode === "credential" && needOtp && (
            <>
              <p className="muted" style={{ marginBottom: "0.5rem" }}>
                이메일로 발송된 6자리 OTP 코드를 입력해주세요.
              </p>
              <div className="form-field">
                <label className="form-label" htmlFor="login-otp">OTP 코드</label>
                <input
                  id="login-otp"
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6자리 코드"
                  disabled={credLoading}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmitOtp(); }}
                />
              </div>
              {credMessage && (
                <p className={credMessage.includes("발송") ? "success-message" : "error-message"} role="alert">
                  {credMessage}
                </p>
              )}
              <div className="button-row">
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitOtp}
                  disabled={credLoading || otpCode.length !== 6}
                  aria-busy={credLoading}
                >
                  {credLoading ? "인증 중..." : "OTP 인증"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setNeedOtp(false); setOtpCode(""); setCredMessage(null); }}
                  disabled={credLoading}
                >
                  취소
                </button>
              </div>
            </>
          )}

          {mode === "browser" && (
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
