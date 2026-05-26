import { useEffect, useState } from "react";
import type { AuthStatus, AuthEvent, FormSchema } from "../shared/types";
import LoginPanel from "./components/LoginPanel";
import ProfileForm from "./components/ProfileForm";
import EventSetup from "./components/EventSetup";
import ApplyForm from "./components/ApplyForm";
import ApplyExecution from "./components/ApplyExecution";
import LogPanel from "./components/LogPanel";
import "./styles.css";

type AppStep = "login" | "profile" | "event-setup" | "apply-form" | "apply-execution";

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<AppStep>("login");
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);

  useEffect(() => {
    window.api.auth.getStatus().then((s) => {
      setAuthStatus(s);
      if (s.isLoggedIn) setStep("profile");
    });

    const unsubscribe = window.api.onAuthEvent((event: AuthEvent) => {
      if (event.type === "login-success") {
        setLoginError(null);
        window.api.auth.getStatus().then((s) => {
          setAuthStatus(s);
          if (s.fanId !== undefined) setStep("profile");
        });
      } else if (event.type === "token-validated") {
        window.api.auth.getStatus().then((s) => {
          setAuthStatus(s);
          if (s.fanId !== undefined) setStep("profile");
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
      } else if (event.type === "logged-out") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError(null);
        setStep("login");
        setFormSchema(null);
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

  const handleLogout = async (clearCredentials: boolean) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await window.api.auth.logout(clearCredentials);
      setAuthStatus({ isLoggedIn: false });
      setStep("login");
      setFormSchema(null);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "로그아웃 중 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleValidateToken = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const s = await window.api.auth.validateToken();
      setAuthStatus(s);
      if (!s.isLoggedIn) {
        setStep("login");
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "토큰 검증 중 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleProfileSaved = () => {
    setStep("event-setup");
  };

  const handleFormFetched = (schema: FormSchema) => {
    setFormSchema(schema);
    setStep("apply-form");
  };

  const handleArmed = () => {
    setStep("apply-execution");
  };

  const handleReset = () => {
    setFormSchema(null);
    setStep("event-setup");
  };

  return (
    <main className="app">
      <h1 className="app-title">Weverse Fanevent Apply</h1>

      <LoginPanel
        status={authStatus}
        loading={loginLoading}
        error={loginError}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onValidateToken={handleValidateToken}
      />

      {step === "profile" && authStatus.isLoggedIn && authStatus.fanId !== undefined && (
        <ProfileForm fanId={authStatus.fanId} onSaved={handleProfileSaved} />
      )}

      {step === "event-setup" && authStatus.isLoggedIn && (
        <EventSetup onFormFetched={handleFormFetched} />
      )}

      {step === "apply-form" && formSchema !== null && authStatus.fanId !== undefined && (
        <ApplyForm
          schema={formSchema}
          fanId={authStatus.fanId}
          onArmed={handleArmed}
        />
      )}

      {step === "apply-execution" && formSchema && (
        <ApplyExecution onReset={handleReset} applyPeriod={formSchema.applyPeriod} eventId={formSchema.eventPublicId} />
      )}

      <LogPanel />
    </main>
  );
}
