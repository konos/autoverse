import { useState } from "react";
import type { AuthStatus, LoginMode, CredentialLoginResult } from "../../shared/types";
import type { AcknowledgeOutcome } from "../login-mode-actions";
import ApiModeNoticeModal from "./ApiModeNoticeModal";
import {
  resolveTabView,
  describeLockedMode,
  shouldShowInlineNotice,
  decideTabClick,
  buildFailureView,
  decideNoticeCancel,
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

  const tabView = resolveTabView(loginMode, lockedByEnv);

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
