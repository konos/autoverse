import { useEffect, useState } from "react";
import type { AuthStatus, AuthEvent } from "../shared/types";
import LoginPanel from "./components/LoginPanel";
import ProfileForm from "./components/ProfileForm";
import "./styles.css";

type AppStep = "login" | "profile";

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<AppStep>("login");

  useEffect(() => {
    window.api.auth.getStatus().then((s) => {
      setAuthStatus(s);
      if (s.isLoggedIn) setStep("profile");
    });

    const unsubscribe = window.api.onAuthEvent((event: AuthEvent) => {
      if (event.type === "login-success" || event.type === "token-validated") {
        window.api.auth.getStatus().then((s) => {
          setAuthStatus(s);
          setStep("profile");
          setLoginError(null);
        });
      } else if (event.type === "login-failed") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError(event.message ?? "로그인에 실패했습니다.");
        setStep("login");
      } else if (event.type === "token-expired") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError("토큰이 만료되었습니다. 다시 로그인해주세요.");
        setStep("login");
      } else if (event.type === "cookie-extraction-failed") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError(event.message ?? "쿠키 추출에 실패했습니다.");
        setStep("login");
      }
    });

    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await window.api.auth.openLogin();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleProfileSaved = () => {
    // profile saved — no step change needed (still in profile step)
  };

  return (
    <main className="app">
      <h1 className="app-title">Weverse Fanevent Apply</h1>

      <LoginPanel
        status={authStatus}
        loading={loginLoading}
        error={loginError}
        onLogin={handleLogin}
      />

      {step === "profile" && authStatus.isLoggedIn && authStatus.fanId !== undefined && (
        <ProfileForm fanId={authStatus.fanId} onSaved={handleProfileSaved} />
      )}
    </main>
  );
}
